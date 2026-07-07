// ===================================================================================================
// scad-authoring.js — SCAD → authoring-tree reconstruction parser + safe arithmetic expression evaluator
// ---------------------------------------------------------------------------------------------------
// Extracted from Editor.dc.html (v0.52.0) as the next pure unit after scad-engine.js / mesh-parsers.js.
// Pure: no `this`, no THREE, no editor/React state. The editor keeps two thin wrappers (evalExpr,
// parseScad) that thread its scope in:
//   - evalExpr(str, vars)            — vars is a { name: number } map; the editor passes this.varMap().
//   - parseScad(txt, ctx)            — ctx.reserved(name)->bool, ctx.restingPos(node)->[x,y,z].
//
// This module reconstructs the SUBSET of OpenSCAD the GUI authoring tree can represent (numeric assigns,
// translate/rotate-wrapped cube/cylinder/sphere + 2D circle/square/polygon, union/difference/intersection/
// hull, and linear_extrude/rotate_extrude over those). It MUST stay in sync with Editor.isAdvanced()'s
// SIMPLE gate — anything that gate admits must round-trip here, or the GUI tree would silently drop geometry.
// ===================================================================================================
(function () {
  'use strict';

  // ---- arithmetic evaluator: tokenize -> shunting-yard -> RPN (no eval()) ----
  function tokenizeExpr(str) {
    if (typeof str !== 'string') return null;
    if (!/^[\sA-Za-z0-9_+\-*/%().]*$/.test(str)) return null;
    return str.match(/([0-9]*\.?[0-9]+|[A-Za-z_]\w*|[-+*/%()])/g) || [];
  }
  function toRPN(toks) {
    const out = [], ops = [];
    const prec = { 'u-': 4, '*': 3, '/': 3, '%': 3, '+': 2, '-': 2 };
    let prev = null;
    for (const t of toks) {
      if (/^[0-9.]/.test(t) || /^[A-Za-z_]/.test(t)) { out.push(t); prev = t; }
      else if (t === '(') { ops.push(t); prev = t; }
      else if (t === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop());
        if (!ops.length) throw new Error('paren'); ops.pop(); prev = t;
      } else {
        let op = t;
        if (t === '-' && (prev === null || prev === '(' || ['+', '-', '*', '/', '%', 'u-'].includes(prev))) op = 'u-';
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top === '(') break;
          if (prec[top] > prec[op] || (prec[top] === prec[op] && op !== 'u-')) out.push(ops.pop());
          else break;
        }
        ops.push(op); prev = op;
      }
    }
    while (ops.length) { const o = ops.pop(); if (o === '(') throw new Error('paren'); out.push(o); }
    return out;
  }
  // evaluate `str` against a { name: number } scope. Throws 'unknown:<name>' for an unbound identifier.
  function evalExpr(str, vars) {
    vars = vars || {};
    const toks = tokenizeExpr(str);
    if (!toks || !toks.length) throw new Error('empty');
    const rpn = toRPN(toks);
    const st = [];
    for (const t of rpn) {
      if (t === 'u-') { st.push(-st.pop()); }
      else if (t.length === 1 && '+-*/%'.includes(t)) {
        const b = st.pop(), a = st.pop();
        st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : t === '/' ? a / b : a % b);
      } else if (/^[0-9.]/.test(t)) { st.push(parseFloat(t)); }
      else { if (!(t in vars)) throw new Error('unknown:' + t); st.push(vars[t]); }
    }
    if (st.length !== 1 || !isFinite(st[0])) throw new Error('eval');
    return st[0];
  }

  // ---- argument-string helpers (paren/bracket aware) ----
  // split a comma list respecting parens; returns trimmed tokens
  function splitArgs(str) {
    const res = []; let depth = 0, cur = '';
    for (const ch of str) {
      if (ch === '(') { depth++; cur += ch; }
      else if (ch === ')') { depth--; cur += ch; }
      else if (ch === ',' && depth === 0) { res.push(cur); cur = ''; }
      else cur += ch;
    }
    res.push(cur);
    return res.map(s => s.trim());
  }
  // raw value token of a named arg (key = …), paren-aware, stops at top-level comma
  function argRaw(args, key) {
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(^|[,(\\s])' + esc + '\\s*=\\s*');
    const m = re.exec(args); if (!m) return null;
    let i = m.index + m[0].length, depth = 0, out = '';
    for (; i < args.length; i++) {
      const ch = args[i];
      if (ch === '(') { depth++; out += ch; }
      else if (ch === ')') { if (depth === 0) break; depth--; out += ch; }
      else if (ch === ',' && depth === 0) break;
      else out += ch;
    }
    return out.trim();
  }
  function argVector(args) { const m = /\[([^\]]*)\]/.exec(args); return m ? m[1] : args; }
  // a token -> { value, expr|null }: pure number = literal, else expression (resolved with vmap)
  function tokOrNum(tk, vmap) {
    const t = (tk || '').trim();
    if (t === '') return { value: 0, expr: null };
    if (/^-?[0-9]*\.?[0-9]+$/.test(t)) return { value: parseFloat(t), expr: null };
    let v = 0; try { v = evalExpr(t, vmap); } catch (_) {}
    return { value: v, expr: t };
  }

  // ---- brace-aware scanners ----
  function matchParen(src, i) { let d = 0; for (let j = i; j < src.length; j++) { if (src[j] === '(') d++; else if (src[j] === ')') { d--; if (d === 0) return j + 1; } } return src.length; }
  function matchBrace(src, i) { let d = 0; for (let j = i; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (d === 0) return j + 1; } } return src.length; }
  function stripModules(src) {
    let out = '', i = 0;
    while (i < src.length) {
      const m = /module\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{/.exec(src.slice(i));
      if (!m) { out += src.slice(i); break; }
      const start = i + m.index;
      out += src.slice(i, start);
      const braceAt = start + m[0].length - 1;
      i = matchBrace(src, braceAt);
    }
    return out;
  }
  // end index (exclusive) of ONE statement starting at i: after its terminating top-level ';',
  // or after a balanced {…} body if that comes first (for a brace-less extrude/transform child).
  function statementEnd(src, i) {
    let d = 0;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (c === '(') d++;
      else if (c === ')') d--;
      else if (d === 0) {
        if (c === '{') return matchBrace(src, j);
        if (c === ';') return j + 1;
      }
    }
    return src.length;
  }

  function readPosTokens(inner, vmap) {
    const toks = splitArgs(inner); const pos = [0, 0, 0], pexpr = {};
    ['px', 'py', 'pz'].forEach((k, i) => { if (toks[i] === undefined) return; const r = tokOrNum(toks[i], vmap); pos[i] = r.value; if (r.expr) pexpr[k] = r.expr; });
    return { pos, pexpr };
  }
  // scale([x,y,z]) -> [x,y,z]; scale(s) -> [s,s,s]
  function readScaleTokens(args, vmap) {
    if (/\[/.test(args)) {
      const toks = splitArgs(argVector(args)); const s = [1, 1, 1];
      toks.forEach((t, i) => { if (i < 3) { const v = tokOrNum(t, vmap).value; if (v) s[i] = +v.toFixed(4); } });
      return s;
    }
    const v = tokOrNum(splitArgs(args)[0] || '1', vmap).value || 1;
    return [+v.toFixed(4), +v.toFixed(4), +v.toFixed(4)];
  }
  // rotate([x,y,z]) -> [x,y,z]; rotate(angle) -> [0,0,angle]
  function readRotTokens(args, vmap) {
    if (/\[/.test(args)) {
      const toks = splitArgs(argVector(args)); const r = [0, 0, 0];
      toks.forEach((t, i) => { if (i < 3) r[i] = +(tokOrNum(t, vmap).value || 0).toFixed(4); });
      return r;
    }
    const a = +(tokOrNum(splitArgs(args)[0] || '0', vmap).value || 0).toFixed(4);
    return [0, 0, a];
  }
  function readPrimitive(name, args, vmap) {
    if (name === 'circle') {
      const dims = { r: 22 }, ex = {};
      const dT = argRaw(args, 'd');
      if (dT != null) { const r = tokOrNum(dT, vmap); dims.r = (r.value || 44) / 2; if (r.expr) ex.d = r.expr; }
      else { const rT = argRaw(args, 'r'); if (rT != null) { const r = tokOrNum(rT, vmap); dims.r = r.value || 22; } else { const f = splitArgs(args)[0]; if (f && !/=/.test(f)) { const r = tokOrNum(f, vmap); dims.r = r.value || 22; } } }
      return { type: 'circle', dims, expr: ex };
    }
    if (name === 'square') {
      const dims = { x: 30, y: 30 }, ex = {};
      if (/\[/.test(args)) {
        const toks = splitArgs(argVector(args));
        ['x', 'y'].forEach((k, i) => { if (toks[i] === undefined) return; const r = tokOrNum(toks[i], vmap); dims[k] = r.value || dims[k]; if (r.expr) ex[k] = r.expr; });
      } else { const f = splitArgs(args)[0]; if (f && !/=/.test(f)) { const r = tokOrNum(f, vmap); dims.x = dims.y = r.value || 30; } }
      return { type: 'square', dims, expr: ex };
    }
    if (name === 'polygon') {
      const pts = parsePolyPoints(args);
      return { type: 'polygon', dims: { pts: pts.length >= 3 ? pts : [[-20, -20], [20, -20], [20, 20]] } };
    }
    if (name === 'cube') {
      const toks = splitArgs(argVector(args)); const dims = { x: 10, y: 10, z: 10 }, ex = {};
      ['x', 'y', 'z'].forEach((k, i) => { if (toks[i] === undefined) return; const r = tokOrNum(toks[i], vmap); dims[k] = r.value || dims[k]; if (r.expr) ex[k] = r.expr; });
      return { type: 'cuboid', dims, expr: ex };
    }
    if (name === 'sphere') {
      const dims = { r: 10 }, ex = {};
      const dT = argRaw(args, 'd');
      if (dT != null) { const r = tokOrNum(dT, vmap); dims.r = (r.value || 20) / 2; if (r.expr) ex.d = r.expr; }
      else { const rT = argRaw(args, 'r'); if (rT != null) { const r = tokOrNum(rT, vmap); dims.r = r.value || 10; } else { const f = splitArgs(args)[0]; if (f) { const r = tokOrNum(f, vmap); dims.r = r.value || 10; } } }
      return { type: 'sphere', dims, expr: ex };
    }
    const dims = { r: 10, h: 10 }, ex = {};
    const hT = argRaw(args, 'h'); if (hT != null) { const r = tokOrNum(hT, vmap); dims.h = r.value || 10; if (r.expr) ex.h = r.expr; }
    // cone / truncated cone: r1/r2 or d1/d2 (two radii) -> tapered cylinder
    const r1T = argRaw(args, 'r1'), r2T = argRaw(args, 'r2');
    const d1T = argRaw(args, 'd1'), d2T = argRaw(args, 'd2');
    if (r1T != null || r2T != null || d1T != null || d2T != null) {
      dims.r = r1T != null ? (tokOrNum(r1T, vmap).value)
        : d1T != null ? (tokOrNum(d1T, vmap).value / 2) : 10;
      dims.r2 = r2T != null ? (tokOrNum(r2T, vmap).value)
        : d2T != null ? (tokOrNum(d2T, vmap).value / 2) : 0;
    } else {
      const dT = argRaw(args, 'd');
      if (dT != null) { const r = tokOrNum(dT, vmap); dims.r = (r.value || 20) / 2; if (r.expr) ex.d = r.expr; }
      else { const rT = argRaw(args, 'r'); if (rT != null) { const r = tokOrNum(rT, vmap); dims.r = r.value || 10; } }
    }
    // low $fn -> faceted prism/pyramid (sides); high $fn left smooth
    const fnT = argRaw(args, '$fn');
    if (fnT != null) { const n = tokOrNum(fnT, vmap).value; if (n >= 3 && n <= 12) dims.sides = Math.round(n); }
    return { type: 'cylinder', dims, expr: ex };
  }
  // parse polygon([[x,y], ...]) point list -> [[x,y], ...] (numeric; outer bracket ignored)
  function parsePolyPoints(args) {
    let s = args; const pe = argRaw(args, 'points'); if (pe != null) s = pe;
    const pts = []; const re = /\[\s*(-?[0-9.]+)\s*,\s*(-?[0-9.]+)\s*\]/g; let m;
    while ((m = re.exec(s)) !== null) pts.push([+parseFloat(m[1]).toFixed(4), +parseFloat(m[2]).toFixed(4)]);
    return pts;
  }
  // numeric value of a named arg (or a leading positional for height/angle), else default
  function numArg(args, key, dflt, vmap) {
    const t = argRaw(args, key);
    if (t != null) { const r = tokOrNum(t, vmap); return (r.value != null && !isNaN(r.value)) ? r.value : dflt; }
    if (key === 'height' || key === 'angle') {
      const f = splitArgs(args)[0];
      if (f && !/=/.test(f)) { const r = tokOrNum(f, vmap); if (!isNaN(r.value)) return r.value; }
    }
    return dflt;
  }

  // ---- recursive, brace-aware statement parser. ctx = { vmap, restingPos } ----
  function parseBlock(src, ctx) {
    const vmap = ctx.vmap, restingPos = ctx.restingPos;
    const nodes = []; let i = 0; const n = src.length;
    const TRANSFORMS = ['scale', 'mirror', 'color', 'multmatrix', 'resize', 'offset'];
    const GROUPS = ['union', 'difference', 'intersection', 'hull'];
    const EXTRUDES = ['linear_extrude', 'rotate_extrude'];
    const PRIMS = ['cube', 'cylinder', 'sphere', 'circle', 'square', 'polygon'];
    while (i < n) {
      while (i < n && /[\s;]/.test(src[i])) i++;
      if (i >= n) break;
      // consume transform prefixes; remember translate/rotate as the node's pos/rot
      // (and scale — kept only on custom module-instance nodes)
      let pos = null, pexpr = null, rot = null, scl = null, guard = 0;
      while (guard++ < 50) {
        const mm = /^([A-Za-z_]\w*)\s*\(/.exec(src.slice(i));
        if (!mm) break;
        const nm = mm[1];
        if (nm === 'translate') {
          const pStart = i + mm[0].length - 1, pEnd = matchParen(src, pStart);
          const r = readPosTokens(argVector(src.slice(pStart + 1, pEnd - 1)), vmap);
          pos = r.pos; pexpr = r.pexpr; i = pEnd; while (i < n && /\s/.test(src[i])) i++; continue;
        }
        if (nm === 'rotate') {
          const pStart = i + mm[0].length - 1, pEnd = matchParen(src, pStart);
          rot = readRotTokens(src.slice(pStart + 1, pEnd - 1), vmap);
          i = pEnd; while (i < n && /\s/.test(src[i])) i++; continue;
        }
        if (nm === 'scale') {
          const pStart = i + mm[0].length - 1, pEnd = matchParen(src, pStart);
          const s2 = readScaleTokens(src.slice(pStart + 1, pEnd - 1), vmap);
          scl = scl ? scl.map((v, k) => +(v * s2[k]).toFixed(4)) : s2;
          i = pEnd; while (i < n && /\s/.test(src[i])) i++; continue;
        }
        if (TRANSFORMS.includes(nm)) { const pStart = i + mm[0].length - 1, pEnd = matchParen(src, pStart); i = pEnd; while (i < n && /\s/.test(src[i])) i++; continue; }
        break;
      }
      const pm = /^([A-Za-z_]\w*)\s*\(/.exec(src.slice(i));
      if (!pm) { i++; continue; }
      const name = pm[1];
      const pStart = i + pm[0].length - 1, pEnd = matchParen(src, pStart);
      const args = src.slice(pStart + 1, pEnd - 1);
      i = pEnd; while (i < n && /\s/.test(src[i])) i++;
      if (GROUPS.includes(name)) {
        if (src[i] === '{') {
          const bEnd = matchBrace(src, i); const inner = src.slice(i + 1, bEnd - 1); i = bEnd;
          const isEdgeTreat = /edge_fillet|edge_chamfer/.test(inner);
          const children = parseBlock(inner, ctx);
          if (isEdgeTreat) {                       // our own edge-treatment wrapper, not a user boolean
            const prim = children.find(c => c.type !== 'group');
            if (prim) { if (pos) { prim.pos = pos; if (pexpr && Object.keys(pexpr).length) prim.expr = { ...pexpr, ...(prim.expr || {}) }; } else prim.pos = restingPos(prim); if (rot && (rot[0] || rot[1] || rot[2])) prim.rot = rot; nodes.push(prim); }
          } else if (children.length) {
            const grp = { type: 'group', op: name, children };
            if (pos && (pos[0] || pos[1] || pos[2])) grp.pos = pos;
            if (rot && (rot[0] || rot[1] || rot[2])) grp.rot = rot;
            nodes.push(grp);
          }
        }
        continue;
      }
      if (EXTRUDES.includes(name)) {
        const dims = name === 'rotate_extrude'
          ? { angle: numArg(args, 'angle', 360, vmap) }
          : { height: numArg(args, 'height', 30, vmap), twist: numArg(args, 'twist', 0, vmap), escale: numArg(args, 'scale', 1, vmap) };
        let children = [];
        if (src[i] === '{') {
          const bEnd = matchBrace(src, i); children = parseBlock(src.slice(i + 1, bEnd - 1), ctx); i = bEnd;
        } else {                                  // brace-less single child: linear_extrude(10) circle(5);
          const sEnd = statementEnd(src, i); children = parseBlock(src.slice(i, sEnd), ctx); i = sEnd;
        }
        if (children.length) {
          const grp = { type: 'group', op: name, dims, children };
          if (pos && (pos[0] || pos[1] || pos[2])) grp.pos = pos;
          if (rot && (rot[0] || rot[1] || rot[2])) grp.rot = rot;
          nodes.push(grp);
        }
        continue;
      }
      if (PRIMS.includes(name)) {
        const node = readPrimitive(name, args, vmap);
        if (pos) { node.pos = pos; if (pexpr && Object.keys(pexpr).length) node.expr = { ...pexpr, ...(node.expr || {}) }; }
        else node.pos = restingPos(node);
        if (rot && (rot[0] || rot[1] || rot[2])) node.rot = rot;
        while (i < n && /[\s;]/.test(src[i])) i++;
        nodes.push(node);
        continue;
      }
      // known library module, no child block -> custom module-instance node (raw args kept verbatim)
      if (ctx.isCustom && ctx.isCustom(name) && src[i] !== '{') {
        const node = { type: 'custom', name, argsSrc: args.trim(), dims: {}, pos: pos || [0, 0, 0] };
        if (pexpr && Object.keys(pexpr).length) node.expr = { ...pexpr };
        if (rot && (rot[0] || rot[1] || rot[2])) node.rot = rot;
        if (scl && (scl[0] !== 1 || scl[1] !== 1 || scl[2] !== 1)) node.scl = scl;
        while (i < n && /[\s;]/.test(src[i])) i++;
        nodes.push(node);
        continue;
      }
      // unknown call -> skip its block or statement
      if (src[i] === '{') i = matchBrace(src, i);
      else { while (i < n && src[i] !== ';' && src[i] !== '{') i++; if (src[i] === ';') i++; }
    }
    return nodes;
  }
  // full program -> { vars:[{name,value}], tree:[node...], vmap }. ctx = { reserved, restingPos }.
  function parseScad(txt, ctx) {
    const clean = txt.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const noMods = stripModules(clean);
    // 1) parameter assignments: NAME = <arithmetic> ;  (skip module-call RHS)
    const vars = []; const vmap = {};
    const varRe = /(?:^|\n)\s*([A-Za-z_]\w*)\s*=\s*([^;{}]+);/g;
    let vm;
    while ((vm = varRe.exec(noMods)) !== null) {
      const name = vm[1], rhs = vm[2].trim();
      if (ctx.reserved(name)) continue;
      if (/[A-Za-z_]\w*\s*\(/.test(rhs)) continue;       // RHS is a call, not a parameter
      if (vars.some(v => v.name === name)) continue;
      let val; try { val = evalExpr(rhs, vmap); } catch (_) { val = parseFloat(rhs); }
      if (val == null || isNaN(val)) continue;
      vmap[name] = val; vars.push({ name, value: +(+val).toFixed(6) });
    }
    // 2) body -> node tree
    const tree = parseBlock(noMods, { vmap, restingPos: ctx.restingPos, isCustom: ctx.isCustom });
    return { vars, tree, vmap };
  }

  window.ScadAuthoring = {
    tokenizeExpr, toRPN, evalExpr,
    splitArgs, argRaw, argVector, tokOrNum,
    matchParen, matchBrace, stripModules, statementEnd,
    readPosTokens, readRotTokens, readScaleTokens, readPrimitive, parsePolyPoints, numArg,
    parseBlock, parseScad,
  };
})();
