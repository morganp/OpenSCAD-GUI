/* scad-engine.js — a real OpenSCAD interpreter (lex -> parse -> evaluate -> geometry tree).
 * Dependency-free and THREE-agnostic: emits an abstract GeomNode tree the host realizes.
 * Exposes window.ScadEngine = { lex, parse, run, Mat, VERSION }.
 * Coverage: see CLAUDE.md roadmap. This file targets Phases 0-7 core (+3 builtins). */
(function () {
  'use strict';
  const DEG = Math.PI / 180;

  /* ============================ mat4 (column-major, THREE-compatible) ============================ */
  const Mat = {
    identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    multiply(a, b) { // a*b
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
      }
      return o;
    },
    translate(x, y, z) { const m = Mat.identity(); m[12]=x; m[13]=y; m[14]=z; return m; },
    scale(x, y, z) { const m = Mat.identity(); m[0]=x; m[5]=y; m[10]=z; return m; },
    rotAxis(angleDeg, ax, ay, az) {
      let len = Math.hypot(ax, ay, az); if (len < 1e-9) return Mat.identity();
      ax/=len; ay/=len; az/=len;
      const a = angleDeg*DEG, c = Math.cos(a), s = Math.sin(a), t = 1-c;
      return [
        t*ax*ax+c,    t*ax*ay+s*az, t*ax*az-s*ay, 0,
        t*ax*ay-s*az, t*ay*ay+c,    t*ay*az+s*ax, 0,
        t*ax*az+s*ay, t*ay*az-s*ax, t*az*az+c,    0,
        0,0,0,1
      ];
    },
    // OpenSCAD rotate([x,y,z]) = rotate z then y then x  (applied Rz*Ry*Rx)
    rotXYZ(x, y, z) {
      let m = Mat.rotAxis(z, 0,0,1);
      m = Mat.multiply(m, Mat.rotAxis(y, 0,1,0));
      m = Mat.multiply(m, Mat.rotAxis(x, 1,0,0));
      return m;
    },
    mirror(x, y, z) {
      const len = Math.hypot(x, y, z); if (len < 1e-9) return Mat.identity();
      const nx=x/len, ny=y/len, nz=z/len;
      return [
        1-2*nx*nx, -2*ny*nx, -2*nz*nx, 0,
        -2*nx*ny, 1-2*ny*ny, -2*nz*ny, 0,
        -2*nx*nz, -2*ny*nz, 1-2*nz*nz, 0,
        0,0,0,1
      ];
    },
    // multmatrix accepts a 4x4 or 4x3 row-major nested array -> column-major flat
    fromRows(rows) {
      const m = Mat.identity();
      for (let r = 0; r < Math.min(4, rows.length); r++) {
        const row = rows[r] || [];
        for (let c = 0; c < 4; c++) m[c*4+r] = (row[c] != null ? row[c] : (r===c?1:0));
      }
      return m;
    },
  };

  /* ============================ LEXER ============================ */
  const PUNCT = ['<=','>=','==','!=','&&','||','[',']','{','}','(',')',';',',',':','=','+','-','*','/','%','^','<','>','!','?','.','#'];
  function lex(src) {
    const toks = []; let i = 0, line = 1, col = 1;
    const n = src.length;
    const adv = (k) => { for (let j=0;j<k;j++){ if (src[i]==='\n'){line++;col=1;} else col++; i++; } };
    while (i < n) {
      const ch = src[i];
      if (ch === '\n' || ch === ' ' || ch === '\t' || ch === '\r') { adv(1); continue; }
      if (ch === '/' && src[i+1] === '/') { while (i<n && src[i] !== '\n') adv(1); continue; }
      if (ch === '/' && src[i+1] === '*') { adv(2); while (i<n && !(src[i]==='*'&&src[i+1]==='/')) adv(1); adv(2); continue; }
      const startLine = line, startCol = col;
      // number
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i+1]))) {
        let s = ''; 
        while (i<n && /[0-9.]/.test(src[i])) { s += src[i]; adv(1); }
        if (i<n && (src[i]==='e'||src[i]==='E')) { s += src[i]; adv(1); if (src[i]==='+'||src[i]==='-'){ s+=src[i]; adv(1);} while (i<n && /[0-9]/.test(src[i])){ s+=src[i]; adv(1);} }
        toks.push({ t:'num', v: parseFloat(s), line:startLine, col:startCol });
        continue;
      }
      // string
      if (ch === '"') {
        adv(1); let s = '';
        while (i<n && src[i] !== '"') {
          if (src[i] === '\\') { adv(1); const e = src[i]; s += (e==='n'?'\n':e==='t'?'\t':e==='r'?'\r':e==='\\'?'\\':e==='"'?'"':e); adv(1); }
          else { s += src[i]; adv(1); }
        }
        adv(1);
        toks.push({ t:'str', v:s, line:startLine, col:startCol });
        continue;
      }
      // identifier / $special / keyword
      if (/[A-Za-z_$]/.test(ch)) {
        let s = ''; while (i<n && /[A-Za-z0-9_$]/.test(src[i])) { s += src[i]; adv(1); }
        const kw = ['module','function','if','else','for','intersection_for','let','true','false','undef','include','use','each'];
        toks.push({ t: kw.includes(s) ? s : 'ident', v:s, line:startLine, col:startCol });
        continue;
      }
      // include/use angle path  <....>
      if (ch === '<') {
        // only treat as path if previous token is include/use
        const prev = toks[toks.length-1];
        if (prev && (prev.t === 'include' || prev.t === 'use')) {
          adv(1); let s=''; while (i<n && src[i] !== '>') { s += src[i]; adv(1); } adv(1);
          toks.push({ t:'path', v:s, line:startLine, col:startCol }); continue;
        }
      }
      // punctuation (longest match)
      let matched = null;
      for (const p of PUNCT) { if (src.startsWith(p, i)) { if (!matched || p.length > matched.length) matched = p; } }
      if (matched) { toks.push({ t:matched, v:matched, line:startLine, col:startCol }); adv(matched.length); continue; }
      // unknown char — skip with a token so parser can report
      adv(1);
    }
    toks.push({ t:'eof', v:null, line, col });
    return toks;
  }

  /* ============================ PARSER (Pratt) ============================ */
  function parse(src) {
    const toks = lex(src);
    let p = 0;
    const peek = (k) => toks[p + (k||0)];
    const at = (t) => toks[p].t === t;
    const next = () => toks[p++];
    const expect = (t) => { if (toks[p].t !== t) err(`expected '${t}' but got '${toks[p].t}'`, toks[p]); return toks[p++]; };
    const errors = [];
    function err(msg, tok) { const e = new Error(msg + ` (line ${tok?tok.line:'?'})`); e.line = tok?tok.line:0; throw e; }

    // ---- expressions ----
    // precedence
    const PREC = { '?':1, '||':2, '&&':3, '==':4,'!=':4, '<':5,'<=':5,'>':5,'>=':5, '+':6,'-':6, '*':7,'/':7,'%':7, '^':9 };
    function parseExpr(min) {
      min = min || 0;
      let left = parseUnary();
      while (true) {
        const t = peek().t;
        if (t === '?' && PREC['?'] >= min) {
          next(); const a = parseExpr(0); expect(':'); const b = parseExpr(PREC['?']);
          left = { e:'ternary', c:left, a, b }; continue;
        }
        const prec = PREC[t];
        if (prec == null || prec < min) break;
        next();
        const rightAssoc = (t === '^');
        const right = parseExpr(rightAssoc ? prec : prec + 1);
        left = { e:'binary', op:t, a:left, b:right };
      }
      return left;
    }
    function parseUnary() {
      const t = peek().t;
      if (t === '!' || t === '-' || t === '+') { next(); return { e:'unary', op:t, x: parseUnary() }; }
      return parsePostfix();
    }
    function parsePostfix() {
      let x = parsePrimary();
      while (true) {
        if (at('[')) { next(); const idx = parseExpr(0); expect(']'); x = { e:'index', obj:x, idx }; }
        else if (at('.')) { next(); const key = expect('ident').v; x = { e:'dot', obj:x, key }; }
        else if (at('(') && (x.e === 'ident' || x.e === 'paren')) { // call on a name
          const name = x.name; const args = parseArgs(); x = { e:'call', name, args };
        }
        else break;
      }
      return x;
    }
    function parseArgs() {
      expect('('); const args = [];
      while (!at(')')) {
        let name = null;
        if (at('ident') && peek(1).t === '=') { name = next().v; next(); }
        args.push({ name, expr: parseExpr(0) });
        if (at(',')) next(); else break;
      }
      expect(')');
      return args;
    }
    function parsePrimary() {
      const tok = peek();
      switch (tok.t) {
        case 'num': next(); return { e:'num', v:tok.v };
        case 'str': next(); return { e:'str', v:tok.v };
        case 'true': next(); return { e:'bool', v:true };
        case 'false': next(); return { e:'bool', v:false };
        case 'undef': next(); return { e:'undef' };
        case 'ident': next(); return { e:'ident', name:tok.v };
        case 'let': { next(); expect('('); const assigns = parseAssignList(); expect(')'); const body = parseExpr(0); return { e:'let', assigns, body }; }
        case 'function': { next(); expect('('); const params = parseParamList(); expect(')'); const body = parseExpr(0); return { e:'lambda', params, body }; }
        case '(': { next(); const inner = parseExpr(0); expect(')'); return inner; }
        case '[': return parseVectorOrRange();
        default: err(`unexpected '${tok.t}' in expression`, tok);
      }
    }
    function parseVectorOrRange() {
      expect('[');
      if (at(']')) { next(); return { e:'vector', items:[] }; }
      // list comprehension?  [ for (...) ... ] or [ each ... ] or [ if(...) ... ]
      if (at('for') || at('each') || at('if') || at('let')) {
        const body = parseListCompBody();
        expect(']');
        return { e:'listcomp', body };
      }
      const first = parseExpr(0);
      if (at(':')) {
        next(); const second = parseExpr(0);
        if (at(':')) { next(); const third = parseExpr(0); expect(']'); return { e:'range', start:first, step:second, end:third }; }
        expect(']'); return { e:'range', start:first, step:null, end:second };
      }
      const items = [first];
      while (at(',')) { next(); if (at(']')) break; items.push(parseExpr(0)); }
      expect(']');
      return { e:'vector', items };
    }
    // list comprehension generator body (subset): for / if / let / each / bare expr
    function parseListCompBody() {
      if (at('for')) {
        next(); expect('(');
        const gens = parseForGenerators();
        if (at(';')) {
          // C-style comprehension: [ for (init; cond; next) expr ]
          next(); const cond = parseExpr(0); expect(';');
          const updates = parseForGenerators(); expect(')');
          const body = parseListCompBody();
          return { c:'cfor', inits: gens, cond, updates, body };
        }
        expect(')');
        const body = parseListCompBody();
        return { c:'for', gens, body };
      }
      if (at('let')) { next(); expect('('); const assigns = parseAssignList(); expect(')'); const body = parseListCompBody(); return { c:'let', assigns, body }; }
      if (at('if')) {
        next(); expect('('); const cond = parseExpr(0); expect(')');
        const then = parseListCompBody();
        let els = null;
        if (at('else')) { next(); els = parseListCompBody(); }
        return { c:'if', cond, then, els };
      }
      if (at('each')) { next(); return { c:'each', expr: parseListCompBody() }; }
      // bare expression element (may be followed by , for multiple)
      const first = parseExpr(0);
      if (at(',')) { const items = [first]; while (at(',')) { next(); if (at(']')) break; items.push(parseListCompBody()); } return { c:'seq', items }; }
      return { c:'expr', expr:first };
    }
    function parseAssignList() {
      const assigns = [];
      while (at('ident')) {
        const name = next().v; expect('='); const expr = parseExpr(0);
        assigns.push({ name, expr });
        if (at(',')) next(); else break;
      }
      return assigns;
    }
    function parseForGenerators() { // i = range/list (, j = ...)  used by for-statement & comp
      const gens = [];
      while (at('ident')) {
        const name = next().v; expect('='); const expr = parseExpr(0);
        gens.push({ name, expr });
        if (at(',')) next(); else break;
      }
      return gens;
    }
    function parseParamList() { // module/function params: name or name=default
      const params = [];
      while (at('ident') || (peek().t && peek().t.startsWith('$'))) {
        const name = next().v; let def = null;
        if (at('=')) { next(); def = parseExpr(0); }
        params.push({ name, def });
        if (at(',')) next(); else break;
      }
      return params;
    }

    // ---- statements ----
    function parseProgram() {
      const stmts = [];
      while (!at('eof')) {
        const s = parseStatement();
        if (s) stmts.push(s);
      }
      return { stmts };
    }
    function parseBlockOrStatement() {
      if (at('{')) { next(); const stmts = []; while (!at('}') && !at('eof')) { const s = parseStatement(); if (s) stmts.push(s); } expect('}'); return { stmts }; }
      const s = parseStatement(); return { stmts: s ? [s] : [] };
    }
    function parseStatement() {
      const tok = peek();
      // modifier characters
      if (tok.t === '*' || tok.t === '!' || tok.t === '#' || tok.t === '%') {
        next(); const inner = parseStatement();
        const mod = tok.t === '*' ? 'disable' : tok.t === '!' ? 'root' : tok.t === '#' ? 'highlight' : 'background';
        return inner ? { t:'modifier', mod, stmt:inner } : null;
      }
      if (tok.t === ';') { next(); return null; }
      if (tok.t === '{') { return { t:'block', body: parseBlockOrStatement() }; }
      if (tok.t === 'include' || tok.t === 'use') { const kind = next().t; const path = at('path') ? next().v : ''; return { t:kind, path }; }
      if (tok.t === 'module') { next(); const name = expect('ident').v; expect('('); const params = parseParamList(); expect(')'); const body = parseBlockOrStatement(); return { t:'moduledef', name, params, body }; }
      if (tok.t === 'function') { next(); const name = expect('ident').v; expect('('); const params = parseParamList(); expect(')'); expect('='); const expr = parseExpr(0); if (at(';')) next(); return { t:'functiondef', name, params, expr }; }
      if (tok.t === 'for' || tok.t === 'intersection_for') { const kind = next().t; expect('('); const gens = parseForGenerators(); expect(')'); const body = parseBlockOrStatement(); return { t:kind, gens, body }; }
      if (tok.t === 'if') { next(); expect('('); const cond = parseExpr(0); expect(')'); const then = parseBlockOrStatement(); let els = null; if (at('else')) { next(); els = parseBlockOrStatement(); } return { t:'if', cond, then, els }; }
      if (tok.t === 'let') { next(); expect('('); const assigns = parseAssignList(); expect(')'); const body = parseBlockOrStatement(); return { t:'letblock', assigns, body }; }
      // assignment:  ident = expr ;
      if (tok.t === 'ident' && peek(1).t === '=') { const name = next().v; next(); const expr = parseExpr(0); if (at(';')) next(); return { t:'assign', name, expr }; }
      // module call: ident ( args )  [child block | ;]
      if (tok.t === 'ident') {
        const name = next().v; const args = parseArgs();
        let children = null;
        if (at('{') || isInstantiationAhead()) children = parseBlockOrStatement();
        else if (at(';')) next();
        return { t:'call', name, args, children };
      }
      // unknown — skip token to recover
      err(`unexpected '${tok.t}'`, tok);
    }
    function isInstantiationAhead() {
      // a call followed immediately by another call/modifier (no semicolon) takes it as a single child
      const t = peek().t;
      return t === 'ident' || t === '*' || t === '!' || t === '#' || t === '%' || t === 'for' || t === 'if' || t === 'intersection_for' || t === 'let';
    }

    try {
      const prog = parseProgram();
      return { ast: prog, errors };
    } catch (e) {
      errors.push({ msg: e.message, line: e.line || 0 });
      return { ast: { stmts: [] }, errors };
    }
  }

  // export parse/lex now; evaluator appended below
  window.ScadEngine = { lex, parse, Mat, VERSION: '0.1' };
})();


/* ============================ EVALUATOR ============================ */
(function () {
  'use strict';
  const Mat = window.ScadEngine.Mat;
  const DEG = Math.PI / 180;
  const isNum = (x) => typeof x === 'number' && !isNaN(x);
  const isVec = (x) => Array.isArray(x);
  const isStr = (x) => typeof x === 'string';
  const isRange = (x) => x && typeof x === 'object' && x.__range;
  const isFn = (x) => x && typeof x === 'object' && x.__fn;
  const UNDEF = undefined;

  function rangeToList(r) {
    const out = []; let s = r.start, st = r.step == null ? 1 : r.step, e = r.end;
    if (st === 0 || !isNum(s) || !isNum(e) || !isNum(st)) return out;
    if (st > 0) { for (let v = s; v <= e + 1e-9; v += st) out.push(v); }
    else { for (let v = s; v >= e - 1e-9; v += st) out.push(v); }
    return out;
  }
  function toList(x) { return isRange(x) ? rangeToList(x) : (isVec(x) ? x : []); }
  function num(x, d) { return isNum(x) ? x : (d == null ? 0 : d); }
  function vec3(x, d) {
    d = d || [0,0,0];
    if (isNum(x)) return [x,x,x];
    if (isVec(x)) return [num(x[0],d[0]), num(x[1],d[1]), num(x[2],d[2])];
    return d.slice();
  }

  class Scope {
    constructor(parent) { this.vars = new Map(); this.parent = parent; this.modules = new Map(); this.functions = new Map(); }
    get(name) {
      let s = this; while (s) { if (s.vars.has(name)) return s.vars.get(name); s = s.parent; } return UNDEF;
    }
    getModule(name) { let s = this; while (s) { if (s.modules.has(name)) return s.modules.get(name); s = s.parent; } return null; }
    getFunction(name) { let s = this; while (s) { if (s.functions.has(name)) return s.functions.get(name); s = s.parent; } return null; }
    child() { return new Scope(this); }
  }

  /* ---- include/use resolution: splice referenced .scad files into the AST ----
     include <f>: inline ALL of f's statements (vars, defs, geometry) at that point.
     use <f>:    import ONLY f's module + function definitions (no vars/geometry).
     Files come from opts.files = { "basename.scad" (lowercased): sourceText }. */
  function basenameKey(p) {
    if (!p) return '';
    const parts = String(p).split(/[\\/]/);
    return (parts[parts.length - 1] || '').toLowerCase();
  }
  function resolveImports(stmts, files, ctx, stack) {
    const out = [];
    for (const s of stmts) {
      if (s && (s.t === 'include' || s.t === 'use')) {
        const key = basenameKey(s.path);
        if (!key) continue;
        const src = files[key];
        if (src == null) {
          const tag = 'inc:' + key;
          if (!ctx.warnedSet.has(tag)) { ctx.warnedSet.add(tag); ctx.warnings.push({ msg: s.t + ' <' + s.path + '>: file not loaded \u2014 drag the .scad file onto the viewport' }); }
          continue;
        }
        if (stack.indexOf(key) !== -1) {
          const tag = 'cyc:' + key;
          if (!ctx.warnedSet.has(tag)) { ctx.warnedSet.add(tag); ctx.warnings.push({ msg: s.t + ' <' + s.path + '>: circular reference skipped' }); }
          continue;
        }
        const sub = window.ScadEngine.parse(src);
        for (const e of (sub.errors || [])) ctx.errors.push({ msg: '(' + key + ') ' + e.msg, line: e.line || 0 });
        const subStmts = resolveImports((sub.ast && sub.ast.stmts) || [], files, ctx, stack.concat(key));
        if (s.t === 'include') { for (const x of subStmts) out.push(x); }
        else { for (const x of subStmts) if (x && (x.t === 'moduledef' || x.t === 'functiondef')) out.push(x); }
      } else {
        out.push(s);
      }
    }
    return out;
  }

  function run(src, opts) {
    opts = opts || {};
    const parsed = window.ScadEngine.parse(src);
    const echos = [], warnings = [], errors = parsed.errors.slice();
    const ctx = { echos, warnings, errors, ops: 0, maxOps: opts.maxOps || 4000000, warnedSet: new Set(), moduleStack: [] };
    // resolve include/use against provided files (warns if any referenced file is missing)
    let topStmts = (parsed.ast && parsed.ast.stmts) || [];
    if (topStmts.some(s => s && (s.t === 'include' || s.t === 'use'))) {
      topStmts = resolveImports(topStmts, opts.files || {}, ctx, []);
      parsed.ast = { stmts: topStmts };
    }
    const root = new Scope(null);
    // special variable defaults
    root.vars.set('$fn', opts.$fn != null ? opts.$fn : 0);
    root.vars.set('$fa', 12); root.vars.set('$fs', 2);
    root.vars.set('$t', opts.$t || 0); root.vars.set('$preview', true);
    const vp = opts.viewport || {};
    root.vars.set('$vpr', vp.vpr || [55,0,25]); root.vars.set('$vpt', vp.vpt || [0,0,0]);
    root.vars.set('$vpd', vp.vpd != null ? vp.vpd : 500); root.vars.set('$vpf', vp.vpf != null ? vp.vpf : 22.5);
    root.vars.set('PI', Math.PI);
    root.vars.set('$parent_modules', 0);
    let geom = [];
    try { geom = evalBlock(parsed.ast, root, ctx, []); }
    catch (e) { errors.push({ msg: String(e.message || e), line: e.line || 0 }); }
    // report viewport vars + whether the script assigned them at top level (for camera write-back)
    const vpAssigned = {};
    for (const s of topStmts) if (s && s.t === 'assign') {
      if (s.name === '$vpr') vpAssigned.vpr = true;
      else if (s.name === '$vpt') vpAssigned.vpt = true;
      else if (s.name === '$vpd') vpAssigned.vpd = true;
      else if (s.name === '$vpf') vpAssigned.vpf = true;
    }
    const viewport = {
      vpr: root.vars.get('$vpr'), vpt: root.vars.get('$vpt'),
      vpd: root.vars.get('$vpd'), vpf: root.vars.get('$vpf'),
      assigned: vpAssigned,
    };
    return { geom, echos, warnings, errors, ast: parsed.ast, viewport };
  }

  function warn(ctx, msg) { if (!ctx.warnedSet.has(msg)) { ctx.warnedSet.add(msg); ctx.warnings.push({ msg }); } }

  /* ---- block execution: hoist assigns + defs, then run statements for geometry ---- */
  function evalBlock(block, scope, ctx, childGeom) {
    const stmts = block.stmts || [];
    // hoist module/function defs
    for (const s of stmts) {
      if (s.t === 'moduledef') scope.modules.set(s.name, s);
      else if (s.t === 'functiondef') scope.functions.set(s.name, s);
    }
    // assignments: source order, last wins (collect last expr per name)
    const lastAssign = new Map();
    for (const s of stmts) if (s.t === 'assign') lastAssign.set(s.name, s.expr);
    for (const [name, expr] of lastAssign) {
      try { scope.vars.set(name, evalExpr(expr, scope, ctx)); } catch (e) { errors_push(ctx, e); }
    }
    // geometry-producing statements in order
    const out = [];
    for (const s of stmts) {
      const g = execStmt(s, scope, ctx, childGeom);
      if (g) { if (Array.isArray(g)) out.push(...g); else out.push(g); }
    }
    return out;
  }
  function errors_push(ctx, e) { ctx.errors.push({ msg: String(e.message || e), line: e.line || 0 }); }

  /* ---- statement execution -> GeomNode | GeomNode[] | null ---- */
  function execStmt(s, scope, ctx, childGeom) {
    if (++ctx.ops > ctx.maxOps) throw new Error('evaluation too large (op limit)');
    switch (s.t) {
      case 'assign': case 'moduledef': case 'functiondef': case 'include': case 'use': return null;
      case 'block': return evalBlock(s.body, scope.child(), ctx, childGeom);
      case 'modifier': {
        if (s.mod === 'disable') return null;
        const g = execStmt(s.stmt, scope, ctx, childGeom);
        const arr = g ? (Array.isArray(g)?g:[g]) : [];
        arr.forEach(n => { tagMod(n, s.mod); });
        // '!' root/show-only: tag each node so the renderer can show ONLY this subtree.
        // (Tagging the array object was lost by the parent's `out.push(...g)` spread.)
        if (s.mod === 'root') { arr.__root = true; arr.forEach(n => { if (n) n.__root = true; }); }
        return arr;
      }
      case 'letblock': {
        const sc = scope.child();
        for (const a of s.assigns) sc.vars.set(a.name, evalExpr(a.expr, sc, ctx));
        return evalBlock(s.body, sc, ctx, childGeom);
      }
      case 'if': {
        const c = truthy(evalExpr(s.cond, scope, ctx));
        const b = c ? s.then : s.els;
        return b ? evalBlock(b, scope.child(), ctx, childGeom) : null;
      }
      case 'for': {
        const out = [];
        iterateGens(s.gens, scope, ctx, (sc) => { const g = evalBlock(s.body, sc, ctx, childGeom); out.push(...g); });
        return out;
      }
      case 'intersection_for': {
        const groups = [];
        iterateGens(s.gens, scope, ctx, (sc) => { groups.push(evalBlock(s.body, sc, ctx, childGeom)); });
        if (!groups.length) return null;
        let acc = { kind:'group', children: groups[0], matrix: Mat.identity(), dim: dimOf(groups[0]) };
        for (let i=1;i<groups.length;i++) acc = { kind:'op', op:'intersection', children:[acc, { kind:'group', children:groups[i], matrix:Mat.identity(), dim: dimOf(groups[i]) }], matrix:Mat.identity(), dim: acc.dim };
        return acc;
      }
      case 'call': return execCall(s, scope, ctx, childGeom);
      default: return null;
    }
  }
  function tagMod(n, mod) { if (!n) return; if (mod === 'highlight') n.mod = 'highlight'; else if (mod === 'background') n.mod = 'background'; }

  function iterateGens(gens, scope, ctx, cb) {
    const rec = (i, sc) => {
      if (i >= gens.length) { cb(sc); return; }
      const g = gens[i];
      const listVal = evalExpr(g.expr, sc, ctx);
      const list = toList(listVal);
      for (const v of list) { const s2 = sc.child(); s2.vars.set(g.name, v); rec(i+1, s2); }
    };
    rec(0, scope.child());
  }

  /* ---- module call: builtin geometry/transform/boolean, or user module ---- */
  function execCall(s, scope, ctx, parentChildGeom) {
    const name = s.name;
    const A = (i) => s.args[i] ? evalExpr(s.args[i].expr, scope, ctx) : UNDEF;
    const named = {}; let pos = [];
    for (const a of s.args) { if (a.name) named[a.name] = evalExpr(a.expr, scope, ctx); else pos.push(evalExpr(a.expr, scope, ctx)); }
    const arg = (i, key, d) => { if (key && named[key] !== undefined) return named[key]; if (pos[i] !== undefined) return pos[i]; return d; };
    const childBlock = s.children;
    const evalChildren = () => childBlock ? evalBlock(childBlock, scope.child(), ctx, parentChildGeom) : [];

    switch (name) {
      /* ---- 3D primitives ---- */
      case 'cube': {
        let size = arg(0,'size',1); const center = truthy(arg(1,'center',false));
        const sz = isVec(size) ? vec3(size,[1,1,1]) : [num(size,1),num(size,1),num(size,1)];
        return prim('cube', { size:sz, center }, Mat.identity());
      }
      case 'sphere': {
        let r = arg(0,'r', undefined); const d = named['d'];
        if (d !== undefined) r = num(d)/2; if (r === undefined) r = 1; r = num(r,1);
        return prim('sphere', { r, $fn: resolveFn(scope, r, named) }, Mat.identity());
      }
      case 'cylinder': {
        const h = num(arg(0,'h',1),1); const center = truthy(named['center'] !== undefined ? named['center'] : false);
        let r1 = named['r1'], r2 = named['r2']; const d1 = named['d1'], d2 = named['d2'];
        let r = named['r'] !== undefined ? named['r'] : (pos[1]); const d = named['d'];
        if (d !== undefined) r = num(d)/2;
        if (d1 !== undefined) r1 = num(d1)/2; if (d2 !== undefined) r2 = num(d2)/2;
        if (r1 === undefined) r1 = (r !== undefined ? num(r) : 1);
        if (r2 === undefined) r2 = (r !== undefined ? num(r) : r1);
        const rr = Math.max(num(r1), num(r2), 0.0001);
        return prim('cylinder', { h, r1:num(r1), r2:num(r2), center, $fn: resolveFn(scope, rr, named) }, Mat.identity());
      }
      case 'polyhedron': {
        const points = arg(0,'points',[]); const faces = (named['faces']!==undefined?named['faces']:(named['triangles']!==undefined?named['triangles']:pos[1])) || [];
        return prim('polyhedron', { points: isVec(points)?points:[], faces: isVec(faces)?faces:[] }, Mat.identity());
      }
      /* ---- transforms ---- */
      case 'translate': { const v = vec3(arg(0,'v',[0,0,0])); return wrap(Mat.translate(v[0],v[1],v[2]), evalChildren()); }
      case 'scale': { const v = vec3(arg(0,'v',[1,1,1]),[1,1,1]); return wrap(Mat.scale(v[0]||1,v[1]||1,v[2]||1), evalChildren()); }
      case 'mirror': { const v = vec3(arg(0,'v',[1,0,0])); return wrap(Mat.mirror(v[0],v[1],v[2]), evalChildren()); }
      case 'rotate': {
        const a = arg(0,'a',0); const v = named['v'] !== undefined ? named['v'] : (pos[1]);
        let m;
        if (isVec(a)) { const e = vec3(a); m = Mat.rotXYZ(e[0],e[1],e[2]); }
        else if (v !== undefined && isVec(v)) { const ax = vec3(v); m = Mat.rotAxis(num(a), ax[0],ax[1],ax[2]); }
        else { m = Mat.rotAxis(num(a), 0,0,1); }
        return wrap(m, evalChildren());
      }
      case 'multmatrix': { const rows = arg(0,'m',null); const m = isVec(rows) ? Mat.fromRows(rows) : Mat.identity(); return wrap(m, evalChildren()); }
      case 'resize': {
        const ns = arg(0, 'newsize', named['newsize']);
        const size = isVec(ns) ? [num(ns[0],0), num(ns[1],0), num(ns[2],0)] : [0,0,0];
        const auto = named['auto'] !== undefined ? named['auto'] : pos[1];
        const autoV = isVec(auto) ? [truthy(auto[0]), truthy(auto[1]), truthy(auto[2])] : [truthy(auto), truthy(auto), truthy(auto)];
        return { kind:'resize', params:{ newsize:size, auto:autoV }, children: evalChildren(), matrix: Mat.identity(), dim:3 };
      }
      case 'color': {
        const c = arg(0,'c', named['c']); const alpha = named['alpha'] !== undefined ? num(named['alpha']) : (pos[1] !== undefined ? num(pos[1]) : undefined);
        const rgba = colorToRGBA(c, alpha);
        const kids = evalChildren();
        const node = { kind:'group', children: kids, matrix: Mat.identity(), color: rgba, dim: dimOf(kids) };
        return node;
      }
      /* ---- booleans ---- */
      case 'union': { const k = evalChildren(); return { kind:'op', op:'union', children: k, matrix: Mat.identity(), dim: dimOf(k) }; }
      case 'difference': { const k = evalChildren(); return { kind:'op', op:'difference', children: k, matrix: Mat.identity(), dim: dimOf(k) }; }
      case 'intersection': { const k = evalChildren(); return { kind:'op', op:'intersection', children: k, matrix: Mat.identity(), dim: dimOf(k) }; }
      case 'hull': { const k = evalChildren(); return { kind:'op', op:'hull', children: k, matrix: Mat.identity(), dim: dimOf(k) }; }
      case 'minkowski': { const k = evalChildren(); return { kind:'op', op:'minkowski', children: k, matrix: Mat.identity(), dim: dimOf(k) }; }
      case 'render': case 'group': { const k = evalChildren(); return { kind:'group', children: k, matrix: Mat.identity(), dim: dimOf(k) }; }
      /* ---- 2D primitives ---- */
      case 'circle': {
        let r = named['r']; const d = named['d'];
        if (d !== undefined) r = num(d)/2; if (r === undefined) r = (pos[0] !== undefined ? num(pos[0]) : 1);
        r = num(r, 1);
        return prim2d('circle', [tessCircle(r, resolveFn(scope, r, named))]);
      }
      case 'square': {
        let size = arg(0,'size',1); const center = truthy(arg(1,'center',false));
        const wh = isVec(size) ? [num(size[0],1), num(size[1],1)] : [num(size,1), num(size,1)];
        const x0 = center ? -wh[0]/2 : 0, y0 = center ? -wh[1]/2 : 0;
        const ring = [[x0,y0],[x0+wh[0],y0],[x0+wh[0],y0+wh[1]],[x0,y0+wh[1]]];
        return prim2d('square', [ring]);
      }
      case 'polygon': {
        const points = arg(0,'points',[]); const paths = named['paths'] !== undefined ? named['paths'] : pos[1];
        const pts = (isVec(points)?points:[]).map(p => [num(p&&p[0]), num(p&&p[1])]);
        let rings;
        if (isVec(paths) && paths.length && isVec(paths[0])) rings = paths.map(path => path.map(i => pts[num(i)]).filter(Boolean));
        else rings = [pts];
        return prim2d('polygon', rings.filter(r => r.length >= 3));
      }
      /* ---- extrusions / 2D operators (Phase 9) ---- */
      case 'linear_extrude': {
        const h = num(arg(0,'height', named['height'] !== undefined ? named['height'] : pos[0]), 100);
        const center = truthy(named['center']);
        const twist = num(named['twist'], 0);
        const sc = named['scale']; const scale = isVec(sc) ? [num(sc[0],1),num(sc[1],1)] : (sc !== undefined ? [num(sc,1),num(sc,1)] : [1,1]);
        let slices = named['slices'] !== undefined ? Math.max(1, Math.floor(num(named['slices']))) : Math.max(1, Math.ceil(Math.abs(twist)/15) || 1);
        if (twist === 0 && (scale[0] === 1 && scale[1] === 1)) slices = 1;
        const kids = evalChildren();
        return { kind:'extrude', mode:'linear', params:{ height:h, center, twist, scale, slices }, children: kids, matrix: Mat.identity(), dim:3 };
      }
      case 'rotate_extrude': {
        const angle = num(arg(0,'angle', named['angle']), 360);
        const kids = evalChildren();
        const fn = resolveFn(scope, 50, named);
        return { kind:'extrude', mode:'rotate', params:{ angle, $fn:fn }, children: kids, matrix: Mat.identity(), dim:3 };
      }
      case 'offset': {
        const r = named['r'] !== undefined ? num(named['r']) : (pos[0] !== undefined && named['delta'] === undefined ? num(pos[0]) : undefined);
        const delta = named['delta'] !== undefined ? num(named['delta']) : undefined;
        const chamfer = truthy(named['chamfer']);
        const kids = evalChildren();
        return { kind:'offset2d', params:{ r, delta, chamfer }, children: kids, matrix: Mat.identity(), dim:2 };
      }
      case 'projection': {
        const cut = truthy(named['cut']);
        const kids = evalChildren();
        warn(ctx, cut ? 'projection(cut=true): cross-section traced from the z=0 slab' : 'projection(): silhouette traced from the top-down footprint');
        return { kind:'projection', params:{ cut }, children: kids, matrix: Mat.identity(), dim:2 };
      }
      case 'text': {
        const t = arg(0,'text', named['text']);
        const tv = (t === undefined || t === null) ? '' : (typeof t === 'string' ? t : echoStr(t));
        const size = num(named['size'] !== undefined ? named['size'] : (pos[1] !== undefined ? pos[1] : 10), 10);
        const font = named['font'] !== undefined ? String(named['font']) : '';
        const halign = named['halign'] !== undefined ? String(named['halign']) : 'left';
        const valign = named['valign'] !== undefined ? String(named['valign']) : 'baseline';
        const spacing = num(named['spacing'], 1);
        const direction = named['direction'] !== undefined ? String(named['direction']) : 'ltr';
        // rings are shaped by the editor (font loading is async + THREE-side); engine just carries params
        return { kind:'primitive2d', shape:'text', rings: [], params:{ text:tv, size, font, halign, valign, spacing, direction }, matrix: Mat.identity(), dim:2 };
      }
      case 'import': {
        const file = arg(0, 'file', named['file']);
        const fn = (typeof file === 'string') ? file : '';
        const center = truthy(named['center']);
        const convexity = named['convexity'];
        const ext = (fn.split('.').pop() || '').toLowerCase();
        const is2d = ext === 'svg' || ext === 'dxf';
        if (!fn) { warn(ctx, 'import(): missing file name'); return null; }
        // 2D vector imports flow through the 2D pipeline as a primitive2d (rings attached editor-side)
        if (is2d) return { kind:'primitive2d', shape:'import', params:{ file: fn, center, ext, convexity }, rings: [], matrix: Mat.identity(), dim:2 };
        // 3D mesh geometry is supplied editor-side from the uploaded-file store (sync at realize)
        return { kind:'import', params:{ file: fn, center, ext, convexity }, matrix: Mat.identity(), dim: 3 };
      }
      case 'surface': {
        const file = arg(0, 'file', named['file']);
        const fn = (typeof file === 'string') ? file : '';
        if (!fn) { warn(ctx, 'surface(): missing file name'); return null; }
        const center = truthy(named['center']);
        const invert = truthy(named['invert']);
        const convexity = named['convexity'];
        // heightmap geometry is supplied editor-side from the uploaded-file store (sync at realize)
        return { kind:'surface', params:{ file: fn, center, invert, convexity }, matrix: Mat.identity(), dim:3 };
      }
      case 'echo': { ctx.echos.push({ msg: s.args.map(a => echoStr(evalExpr(a.expr, scope, ctx))).join(', ') }); return null; }
      case 'assign': {
        // deprecated: assign(a=1, b=2) { ... } — treat as a let() over the child block
        warn(ctx, 'assign() is deprecated \u2014 treated as let()');
        const sc = scope.child();
        for (const a of s.args) if (a.name) sc.vars.set(a.name, evalExpr(a.expr, scope, ctx));
        return childBlock ? evalBlock(childBlock, sc, ctx, parentChildGeom) : [];
      }
      case 'assert': { const cond = truthy(arg(0)); if (!cond) { const m = s.args[1] ? echoStr(arg(1)) : 'assertion failed'; ctx.errors.push({ msg:'assert: '+m }); } return null; }
      case 'children': {
        const cg = parentChildGeom || [];
        const idx = s.args.length ? arg(0) : undefined;
        if (idx === undefined) return cg.slice();
        if (isVec(idx)) return idx.map(i => cg[i]).filter(Boolean);
        if (isRange(idx)) return rangeToList(idx).map(i => cg[i]).filter(Boolean);
        return cg[num(idx)] ? [cg[num(idx)]] : [];
      }
      default: {
        // user module
        const mod = scope.getModule(name);
        if (!mod) { warn(ctx, "unknown module '"+name+"'"); return null; }
        return instantiateModule(mod, s, scope, ctx, parentChildGeom);
      }
    }
  }

  function instantiateModule(mod, callStmt, callScope, ctx, parentChildGeom) {
    const sc = new Scope(modDefScope(mod, callScope));
    bindParams(mod.params, callStmt.args, callScope, sc, ctx);
    // children of THIS instantiation
    const childGeom = callStmt.children ? evalBlock(callStmt.children, callScope.child(), ctx, parentChildGeom) : [];
    sc.vars.set('$children', childGeom.length);
    sc.vars.set('$parent_modules', ctx.moduleStack.length);
    ctx.moduleStack.push(mod.name);
    try { return evalBlock(mod.body, sc, ctx, childGeom); }
    finally { ctx.moduleStack.pop(); }
  }
  function modDefScope(mod, callScope) { return callScope; } // lexical-ish: defs see call scope chain (sufficient for most)

  function bindParams(params, args, callScope, targetScope, ctx) {
    const named = {}; const pos = [];
    for (const a of (args||[])) { if (a.name) named[a.name] = evalExpr(a.expr, callScope, ctx); else pos.push(evalExpr(a.expr, callScope, ctx)); }
    params.forEach((pm, i) => {
      let v;
      if (named[pm.name] !== undefined) v = named[pm.name];
      else if (pos[i] !== undefined) v = pos[i];
      else if (pm.def != null) v = evalExpr(pm.def, targetScope, ctx);
      else v = UNDEF;
      targetScope.vars.set(pm.name, v);
    });
  }

  function prim(type, params, matrix) { return { kind:'primitive', type, params, matrix, dim:3 }; }
  // dimension of a container from its children: 2 only if it has children and all are 2D.
  function dimOf(children) {
    const cs = (children||[]).filter(Boolean);
    if (!cs.length) return 3;
    return cs.every(c => c.dim === 2) ? 2 : 3;
  }
  function wrap(matrix, children) {
    // push matrix into children (accumulate); keep as group with matrix for clarity
    return { kind:'group', children, matrix, dim: dimOf(children) };
  }
  /* ---- 2D primitive helpers ---- */
  function prim2d(shape, rings) { return { kind:'primitive2d', shape, rings, matrix: Mat.identity(), dim:2 }; }
  function tessCircle(r, fn) {
    const n = Math.max(3, Math.floor(fn || 24)); const ring = [];
    for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n; ring.push([r*Math.cos(a), r*Math.sin(a)]); }
    return ring;
  }

  function resolveFn(scope, r, named) {
    let fn = named['$fn'] !== undefined ? num(named['$fn']) : num(scope.get('$fn'), 0);
    const fa = num(scope.get('$fa'), 12), fs = num(scope.get('$fs'), 2);
    if (fn > 0) return Math.max(3, Math.floor(fn));
    return Math.max(5, Math.ceil(Math.max(Math.min(360/fa, r*2*Math.PI/fs), 5)));
  }

  /* ---- expressions ---- */
  function evalExpr(e, scope, ctx) {
    if (++ctx.ops > ctx.maxOps) throw new Error('evaluation too large (op limit)');
    switch (e.e) {
      case 'num': return e.v;
      case 'str': return e.v;
      case 'bool': return e.v;
      case 'undef': return UNDEF;
      case 'ident': {
        const v = scope.get(e.name);
        return v;
      }
      case 'vector': return e.items.map(it => evalExpr(it, scope, ctx));
      case 'range': return { __range:true, start:num(evalExpr(e.start,scope,ctx)), step: e.step?num(evalExpr(e.step,scope,ctx)):null, end:num(evalExpr(e.end,scope,ctx)) };
      case 'index': {
        const o = evalExpr(e.obj, scope, ctx); const idx = evalExpr(e.idx, scope, ctx);
        if (isVec(o) && isNum(idx)) return o[idx];
        if (isStr(o) && isNum(idx)) return o[idx];
        if (isRange(o)) return rangeToList(o)[num(idx)];
        return UNDEF;
      }
      case 'dot': {
        const o = evalExpr(e.obj, scope, ctx);
        const map = { x:0, y:1, z:2 };
        if (isVec(o) && e.key in map) return o[map[e.key]];
        return UNDEF;
      }
      case 'unary': {
        const x = evalExpr(e.x, scope, ctx);
        if (e.op === '!') return !truthy(x);
        if (e.op === '-') return isVec(x) ? x.map(v=>-v) : -num(x);
        return isVec(x) ? x.slice() : num(x);
      }
      case 'ternary': return truthy(evalExpr(e.c, scope, ctx)) ? evalExpr(e.a, scope, ctx) : evalExpr(e.b, scope, ctx);
      case 'binary': return evalBinary(e.op, evalExpr(e.a, scope, ctx), evalExpr(e.b, scope, ctx));
      case 'let': { const sc = scope.child(); for (const a of e.assigns) sc.vars.set(a.name, evalExpr(a.expr, sc, ctx)); return evalExpr(e.body, sc, ctx); }
      case 'lambda': return { __fn:true, params:e.params, body:e.body, closure:scope };
      case 'listcomp': { const out = []; runComp(e.body, scope, ctx, out); return out; }
      case 'call': return evalFnCall(e, scope, ctx);
      default: return UNDEF;
    }
  }

  function runComp(body, scope, ctx, out) {
    switch (body.c) {
      case 'for': {
        const rec = (i, sc) => {
          if (i >= body.gens.length) { runComp(body.body, sc, ctx, out); return; }
          const g = body.gens[i]; const list = toList(evalExpr(g.expr, sc, ctx));
          for (const v of list) { const s2 = sc.child(); s2.vars.set(g.name, v); rec(i+1, s2); }
        };
        rec(0, scope.child()); break;
      }
      case 'cfor': {
        // C-style: init once, loop while cond, apply updates each pass (updates evaluated simultaneously)
        const sc = scope.child();
        for (const a of body.inits) sc.vars.set(a.name, evalExpr(a.expr, sc, ctx));
        let guard = 0;
        while (truthy(evalExpr(body.cond, sc, ctx))) {
          if (++ctx.ops > ctx.maxOps || ++guard > 500000) throw new Error('evaluation too large (op limit)');
          runComp(body.body, sc, ctx, out);
          const upd = body.updates.map(a => [a.name, evalExpr(a.expr, sc, ctx)]);
          for (const [n, v] of upd) sc.vars.set(n, v);
        }
        break;
      }
      case 'let': { const sc = scope.child(); for (const a of body.assigns) sc.vars.set(a.name, evalExpr(a.expr, sc, ctx)); runComp(body.body, sc, ctx, out); break; }
      case 'if': { if (truthy(evalExpr(body.cond, scope, ctx))) runComp(body.then, scope, ctx, out); else if (body.els) runComp(body.els, scope, ctx, out); break; }
      case 'each': { const v = compValue(body.expr, scope, ctx); toList(v).forEach(x=>out.push(x)); break; }
      case 'seq': { body.items.forEach(it => runComp(it, scope, ctx, out)); break; }
      case 'expr': out.push(evalExpr(body.expr, scope, ctx)); break;
    }
  }
  function compValue(body, scope, ctx) { if (body.c === 'expr') return evalExpr(body.expr, scope, ctx); const tmp=[]; runComp(body, scope, ctx, tmp); return tmp; }

  function truthy(x) { if (x === undefined || x === false || x === null) return false; if (x === 0) return false; if (x === '') return false; if (isVec(x) && x.length === 0) return false; return true; }

  function evalBinary(op, a, b) {
    switch (op) {
      case '+': if (isVec(a)&&isVec(b)) return a.map((v,i)=>num(v)+num(b[i])); if (isStr(a)||isStr(b)) return ''+a+b; return num(a)+num(b);
      case '-': if (isVec(a)&&isVec(b)) return a.map((v,i)=>num(v)-num(b[i])); return num(a)-num(b);
      case '*':
        if (isVec(a)&&isNum(b)) return a.map(v=>num(v)*b);
        if (isNum(a)&&isVec(b)) return b.map(v=>num(v)*a);
        if (isVec(a)&&isVec(b)) { let s=0; for (let i=0;i<a.length;i++) s+=num(a[i])*num(b[i]); return s; } // dot
        return num(a)*num(b);
      case '/': if (isVec(a)&&isNum(b)) return a.map(v=>num(v)/b); return num(a)/num(b);
      case '%': return num(a)%num(b);
      case '^': return Math.pow(num(a), num(b));
      case '==': return eq(a,b);
      case '!=': return !eq(a,b);
      case '<': return num(a)<num(b);
      case '<=': return num(a)<=num(b);
      case '>': return num(a)>num(b);
      case '>=': return num(a)>=num(b);
      case '&&': return truthy(a)&&truthy(b);
      case '||': return truthy(a)||truthy(b);
    }
    return UNDEF;
  }
  function eq(a,b){ if (isVec(a)&&isVec(b)) { if (a.length!==b.length) return false; for (let i=0;i<a.length;i++) if (!eq(a[i],b[i])) return false; return true;} return a===b; }

  function evalFnCall(e, scope, ctx) {
    const name = e.name;
    const args = e.args.map(a => ({ name:a.name, v: evalExpr(a.expr, scope, ctx) }));
    const P = (i) => args[i] ? args[i].v : undefined;
    const np = {}; const pv = [];
    for (const a of args) { if (a.name) np[a.name]=a.v; else pv.push(a.v); }
    const A = (i,key)=> (key && np[key]!==undefined)?np[key]:pv[i];
    const M = Math;
    switch (name) {
      case 'abs': return M.abs(num(P(0))); case 'sign': return M.sign(num(P(0)));
      case 'sin': return M.sin(num(P(0))*DEG); case 'cos': return M.cos(num(P(0))*DEG); case 'tan': return M.tan(num(P(0))*DEG);
      case 'asin': return M.asin(num(P(0)))/DEG; case 'acos': return M.acos(num(P(0)))/DEG; case 'atan': return M.atan(num(P(0)))/DEG;
      case 'atan2': return M.atan2(num(P(0)), num(P(1)))/DEG;
      case 'floor': return M.floor(num(P(0))); case 'ceil': return M.ceil(num(P(0))); case 'round': return M.round(num(P(0)));
      case 'ln': return M.log(num(P(0))); case 'log': return M.log(num(P(0)))/M.LN10; case 'exp': return M.exp(num(P(0)));
      case 'pow': return M.pow(num(P(0)),num(P(1))); case 'sqrt': return M.sqrt(num(P(0)));
      case 'min': { const a = (pv.length===1&&isVec(pv[0]))?pv[0]:pv; return M.min.apply(M, a.map(num)); }
      case 'max': { const a = (pv.length===1&&isVec(pv[0]))?pv[0]:pv; return M.max.apply(M, a.map(num)); }
      case 'norm': { const v=P(0); return isVec(v)?M.hypot.apply(M, v.map(num)):M.abs(num(v)); }
      case 'cross': { const a=P(0),b=P(1); if (isVec(a)&&isVec(b)&&a.length>=3&&b.length>=3) return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; return undefined; }
      case 'len': { const v=P(0); return isVec(v)?v.length:(isStr(v)?v.length:undefined); }
      case 'concat': { let out=[]; for (const a of pv) { if (isVec(a)) out=out.concat(a); else out.push(a); } return out; }
      case 'str': return pv.map(rawStr).join('');
      case 'chr': { const v=P(0); if (isVec(v)) return v.map(c=>String.fromCodePoint(num(c))).join(''); return String.fromCodePoint(num(v)); }
      case 'ord': { const v=P(0); return isStr(v)&&v.length?v.codePointAt(0):undefined; }
      case 'lookup': { const k=num(P(0)); const tbl=P(1); if (!isVec(tbl)||!tbl.length) return undefined; let lo=tbl[0],hi=tbl[tbl.length-1]; for (let i=0;i<tbl.length-1;i++){ const a=tbl[i],b=tbl[i+1]; if (num(a[0])<=k&&k<=num(b[0])){ const t=(k-a[0])/((b[0]-a[0])||1); return a[1]+(b[1]-a[1])*t; } } return k<=num(lo[0])?lo[1]:hi[1]; }
      case 'search': { const m=P(0), tbl=P(1); const res=[]; const list=isVec(tbl)?tbl:[]; const keys=isStr(m)?m.split(''):(isVec(m)?m:[m]); for (const key of keys){ const hits=[]; for (let i=0;i<list.length;i++){ const cell=isVec(list[i])?list[i][0]:list[i]; if (eq(cell,key)||cell===key){ hits.push(i); break; } } res.push(hits.length?hits[0]:[]); } return isStr(m)?res:res; }
      case 'rands': { const lo=num(P(0)),hi=num(P(1)),cnt=num(P(2),1); const out=[]; for (let i=0;i<cnt;i++) out.push(lo+Math.random()*(hi-lo)); return out; }
      case 'is_undef': return P(0)===undefined; case 'is_bool': return typeof P(0)==='boolean'; case 'is_num': return isNum(P(0));
      case 'is_string': return isStr(P(0)); case 'is_list': return isVec(P(0)); case 'is_function': return isFn(P(0));
      case 'version': return [2021,1,0]; case 'version_num': return 20210100;
      case 'parent_module': { const i = num(P(0), 0); const st = ctx.moduleStack || []; const idx = st.length - 2 - i; return idx >= 0 ? st[idx] : undefined; }
      default: {
        // user function
        const fn = scope.getFunction(name);
        if (fn) { const sc = new Scope(scope); bindParams(fn.params, e.args, scope, sc, ctx); return evalExpr(fn.expr, sc, ctx); }
        // function-literal variable
        const lit = scope.get(name);
        if (isFn(lit)) { const sc = lit.closure.child(); bindParams(lit.params, e.args, scope, sc, ctx); return evalExpr(lit.body, sc, ctx); }
        return undefined;
      }
    }
  }

  function numStr(v) { return String(+(+v).toFixed(6)); }
  function echoStr(v) {
    if (v === undefined) return 'undef'; if (v === true) return 'true'; if (v === false) return 'false';
    if (isVec(v)) return '['+v.map(echoStr).join(', ')+']';
    if (isRange(v)) return '['+numStr(v.start)+' : '+numStr(v.step==null?1:v.step)+' : '+numStr(v.end)+']';
    if (isStr(v)) return '"'+v+'"';
    if (isNum(v)) return numStr(v);
    if (isFn(v)) return 'function';
    return String(v);
  }
  function rawStr(v) { return isStr(v) ? v : echoStr(v); }

  const CNAMES = { black:[0,0,0],white:[1,1,1],red:[1,0,0],green:[0,.5,0],blue:[0,0,1],yellow:[1,1,0],cyan:[0,1,1],magenta:[1,0,1],gray:[.5,.5,.5],grey:[.5,.5,.5],orange:[1,.65,0],purple:[.5,0,.5],pink:[1,.75,.8],brown:[.6,.3,.1],lime:[0,1,0],navy:[0,0,.5],teal:[0,.5,.5],silver:[.75,.75,.75],gold:[1,.84,0],skyblue:[.53,.81,.92] };
  function colorToRGBA(c, alpha) {
    let rgba = [.8,.8,.8,1];
    if (isStr(c)) {
      if (c[0] === '#') {
        const h = c.slice(1);
        const p = (s)=>parseInt(s,16)/255;
        if (h.length===3) rgba=[p(h[0]+h[0]),p(h[1]+h[1]),p(h[2]+h[2]),1];
        else if (h.length===6) rgba=[p(h.slice(0,2)),p(h.slice(2,4)),p(h.slice(4,6)),1];
        else if (h.length===8) rgba=[p(h.slice(0,2)),p(h.slice(2,4)),p(h.slice(4,6)),p(h.slice(6,8))];
      } else { const k = CNAMES[c.toLowerCase()]; if (k) rgba=[k[0],k[1],k[2],1]; }
    } else if (isVec(c)) { rgba=[num(c[0],.8),num(c[1],.8),num(c[2],.8), c[3]!==undefined?num(c[3]):1]; }
    if (alpha !== undefined) rgba[3] = num(alpha);
    return rgba;
  }

  window.ScadEngine.run = run;
})();
