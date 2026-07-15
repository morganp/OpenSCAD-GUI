// ===================================================================================================
// scad-emitter.js — authoring-tree → OpenSCAD source-text generator
// ---------------------------------------------------------------------------------------------------
// Extracted from Editor.dc.html (v0.53.0) as the last authoring-layer unit (after scad-engine.js,
// mesh-parsers.js, scad-authoring.js). Unlike the parser, the emitter is coupled to a few editor/THREE
// helpers, so it ships as a FACTORY that closes over an injected context:
//
//   const emitter = window.ScadEmitter({
//     fmt, gfn,                 // number formatter + effective $fn (read live editor state)
//     isGroup, isExtrude,       // tree predicates
//     cylProfile,               // (rBot,rTop,h,treatments) -> [[x,y]...]  (shared with the renderer)
//     edgeMatrix,               // (edge, r) -> THREE.Matrix4      (primitive edge-treatment placement)
//     groupEdgeMatrix,          // (seg, r, convex) -> THREE.Matrix4 (boolean-edge tool placement)
//     matStr,                   // (THREE.Matrix4) -> "[[...],...]" OpenSCAD multmatrix literal
//   });
//   emitter.emitNode(node, level, out);   // pushes lines into the `out` string array
//
// Output is the GUI's canonical OpenSCAD and MUST be byte-identical to the pre-extraction emitter —
// regenCode feeds it into the @scs-tree snapshot equality check, so any drift breaks the GUI round-trip.
// ===================================================================================================
(function () {
  'use strict';

  window.ScadEmitter = function (ctx) {
    const fmt = ctx.fmt, gfn = ctx.gfn, isGroup = ctx.isGroup, isExtrude = ctx.isExtrude,
      cylProfile = ctx.cylProfile, edgeMatrix = ctx.edgeMatrix,
      groupEdgeMatrix = ctx.groupEdgeMatrix, matStr = ctx.matStr, namedTreats = ctx.namedTreats;

    function ind(level) { return '  '.repeat(level); }

    function emitNode(node, level, out) {
      const pad = ind(level);
      if (isGroup(node)) {
        const gp = node.pos || [0, 0, 0];
        if (gp[0] || gp[1] || gp[2]) out.push(pad + `translate([${fmt(gp[0])}, ${fmt(gp[1])}, ${fmt(gp[2])}])`);
        const rl = rotLine(node, pad); if (rl) out.push(rl);
        let header;
        if (isExtrude(node)) {
          const d = node.dims || {};
          if (node.op === 'rotate_extrude') header = `rotate_extrude(angle = ${fmt(d.angle == null ? 360 : d.angle)}, $fn = ${gfn()})`;
          else { const tw = d.twist || 0, esc = (d.escale == null ? 1 : d.escale), dyn = (tw !== 0 || esc !== 1); header = `linear_extrude(height = ${fmt(d.height == null ? 30 : d.height)}${tw ? `, twist = ${fmt(tw)}` : ''}${esc !== 1 ? `, scale = ${fmt(esc)}` : ''}${dyn ? `, slices = ${Math.max(8, Math.ceil(Math.abs(tw) / 6))}` : ''})`; }
        } else header = node.op + '()';
        const ets = Object.values(node.edgeTreatments || {});
        if (!ets.length) {
          out.push(pad + header + ' {');
          for (const c of node.children) emitNode(c, level + 1, out);
          out.push(pad + '}');
          return;
        }
        emitGroupWithEdges(node, header, ets, level, out);
        return;
      }
      emitPrimitive(node, level, out);
    }

    // Slice 5: wrap a group's op-block with convex (difference) / concave (union) edge tools
    function emitGroupWithEdges(node, header, ets, level, out) {
      const F = (n) => fmt(n);
      const convex = ets.filter(t => t.convex), concave = ets.filter(t => !t.convex);
      const emitOp = (lvl) => {
        const p = ind(lvl);
        out.push(p + header + ' {');
        for (const c of node.children) emitNode(c, lvl + 1, out);
        out.push(p + '}');
      };
      const emitTool = (t, lvl) => {
        const p = ind(lvl);
        const mod = t.convex ? (t.type === 'fillet' ? 'edge_fillet' : 'edge_chamfer') : (t.type === 'fillet' ? 'edge_round_in' : 'edge_chamfer_in');
        out.push(p + `// ${t.convex ? 'convex' : 'concave'} ${t.type} r=${F(t.size)}`);
        for (const seg of t.segs) {
          const M = groupEdgeMatrix(seg, t.size, t.convex);
          out.push(p + `multmatrix(${matStr(M)})`);
          out.push(p + `  ${mod}(${F(seg.len + 0.04)}, ${F(t.size)});`);
        }
      };
      const diffBlock = (lvl) => {
        if (!convex.length) { emitOp(lvl); return; }
        const p = ind(lvl);
        out.push(p + 'difference() {');
        emitOp(lvl + 1);
        for (const t of convex) emitTool(t, lvl + 1);
        out.push(p + '}');
      };
      if (!concave.length) { diffBlock(level); return; }
      const p = ind(level);
      out.push(p + 'union() {');
      diffBlock(level + 1);
      for (const t of concave) emitTool(t, level + 1);
      out.push(p + '}');
    }

    function rotLine(node, pad) {
      const r = node.rot || [0, 0, 0];
      if (!r[0] && !r[1] && !r[2]) return null;
      const F = (n) => fmt(n);
      return pad + `rotate([${F(r[0])}, ${F(r[1])}, ${F(r[2])}])`;
    }

    // Slice 5 for feature primitives (tube/wedge/reflex-polygon): wrap the placed base with the same
    // convex (difference) / concave (union) edge tools the group path uses. Convex named-edge output
    // (cuboid/cylinder) is unaffected — those carry no seg treatments and never reach here.
    function emitPrimitiveWithEdges(s, ets, level, out) {
      const F = (n) => fmt(n);
      const pad = ind(level);
      const is2D = s.type === 'circle' || s.type === 'square' || s.type === 'polygon';
      const pzTok = is2D && !(s.expr && s.expr.pz) ? '0' : posTok(s, 'pz');
      const pos = `[${posTok(s, 'px')}, ${posTok(s, 'py')}, ${pzTok}]`;
      const convex = ets.filter(t => t.convex), concave = ets.filter(t => !t.convex);
      const emitTool = (t, lvl) => {
        const p = ind(lvl);
        const mod = t.convex ? (t.type === 'fillet' ? 'edge_fillet' : 'edge_chamfer') : (t.type === 'fillet' ? 'edge_round_in' : 'edge_chamfer_in');
        out.push(p + `// ${t.convex ? 'convex' : 'concave'} ${t.type} r=${F(t.size)}`);
        for (const seg of t.segs) {
          const M = groupEdgeMatrix(seg, t.size, t.convex);
          out.push(p + `multmatrix(${matStr(M)})`);
          out.push(p + `  ${mod}(${F(seg.len + 0.04)}, ${F(t.size)});`);
        }
      };
      const emitBase = (lvl) => { const p = ind(lvl); out.push(p + baseCall(s).replace(/\n/g, '\n' + p) + ';'); };
      const diffBlock = (lvl) => {
        if (!convex.length) { emitBase(lvl); return; }
        const p = ind(lvl);
        out.push(p + 'difference() {');
        emitBase(lvl + 1);
        for (const t of convex) emitTool(t, lvl + 1);
        out.push(p + '}');
      };
      out.push(pad + '// ' + s.label);
      out.push(pad + `translate(${pos})`);
      { const rl = rotLine(s, pad); if (rl) out.push(rl); }
      if (!concave.length) { diffBlock(level); return; }
      out.push(pad + 'union() {');
      diffBlock(level + 1);
      for (const t of concave) emitTool(t, level + 1);
      out.push(pad + '}');
    }
    function emitPrimitive(s, level, out) {
      const F = (n) => fmt(n);
      const pad = ind(level);
      // custom module instance: translate/rotate/scale prefixes + the call with its raw args verbatim
      if (s.type === 'custom') {
        out.push(pad + '// ' + s.label);
        out.push(pad + `translate([${posTok(s, 'px')}, ${posTok(s, 'py')}, ${posTok(s, 'pz')}])`);
        { const rl = rotLine(s, pad); if (rl) out.push(rl); }
        if (s.scl && (s.scl[0] !== 1 || s.scl[1] !== 1 || s.scl[2] !== 1)) {
          out.push(pad + `scale([${F(s.scl[0])}, ${F(s.scl[1])}, ${F(s.scl[2])}])`);
        }
        out.push(pad + '  ' + s.name + '(' + (s.argsSrc || '') + ');');
        return;
      }
      const segTreats = Object.values(s.edgeTreatments || {}).filter(t => t.segs && t.segs.length);
      if (segTreats.length) { emitPrimitiveWithEdges(s, segTreats, level, out); return; }
      const treats = Object.entries(namedTreats(s));
      const is2D = s.type === 'circle' || s.type === 'square' || s.type === 'polygon';
      // 2D shapes carry a small viewport-only z lift (restingPos 0.3) to avoid z-fighting the floor;
      // never emit it — OpenSCAD 2D geometry lives at z=0 and extrudes ignore the source z anyway.
      const pzTok = is2D && !(s.expr && s.expr.pz) ? '0' : posTok(s, 'pz');
      const pos = `[${posTok(s, 'px')}, ${posTok(s, 'py')}, ${pzTok}]`;
      out.push(pad + '// ' + s.label);
      if (s.type === 'cylinder' && treats.length) {
        out.push(pad + '// rims: ' + treats.map(([k, t]) => k.toLowerCase() + ' ' + t.type + ' r=' + F(t.size)).join(', '));
        out.push(pad + `translate(${pos})`);
        { const rl = rotLine(s, pad); if (rl) out.push(rl); }
        out.push(pad + '  ' + cylinderScad(s).replace(/\n/g, '\n' + pad) + ';');
      } else if (!treats.length) {
        out.push(pad + `translate(${pos})`);
        { const rl = rotLine(s, pad); if (rl) out.push(rl); }
        out.push(pad + '  ' + baseCall(s).replace(/\n/g, '\n' + pad) + ';');
      } else {
        out.push(pad + `translate(${pos})`);
        { const rl = rotLine(s, pad); if (rl) out.push(rl); }
        out.push(pad + 'difference() {');
        out.push(pad + '  ' + baseCall(s) + ';');
        for (const [name, t] of treats) {
          const e = s.edges.find(x => x.name === name);
          if (!e) continue;
          const M = edgeMatrix(e, t.size);
          const mod = t.type === 'fillet' ? 'edge_fillet' : 'edge_chamfer';
          out.push(pad + `  // ${name} (${t.type} r=${F(t.size)})`);
          out.push(pad + `  multmatrix(${matStr(M)})`);
          out.push(pad + `    ${mod}(${F(e.length + 0.02)}, ${F(t.size)});`);
        }
        out.push(pad + '}');
      }
    }

    function dimTok(s, key) {
      const e = s.expr && s.expr[key];
      if (e) return e;
      if (key === 'x' || key === 'y' || key === 'z') return fmt(s.dims[key]);
      if (key === 'h') return fmt(s.dims.h);
      if (key === 'd') return fmt(s.dims.r * 2);
      if (key === 'r1') return fmt(s.dims.r);
      if (key === 'r2') return fmt(s.dims.r2 != null ? s.dims.r2 : s.dims.r);
      return '0';
    }
    function posTok(s, key) {
      const e = s.expr && s.expr[key];
      if (e) return e;
      const i = { px: 0, py: 1, pz: 2 }[key];
      return fmt(s.pos[i]);
    }
    function baseCall(s) {
      if (s.type === 'cuboid') return `cube([${dimTok(s, 'x')}, ${dimTok(s, 'y')}, ${dimTok(s, 'z')}], center = true)`;
      if (s.type === 'sphere') return `sphere(d = ${dimTok(s, 'd')})`;
      if (s.type === 'torus') {
        const fn = gfn();
        return `rotate_extrude($fn = ${fn})\n  translate([${fmt(s.dims.ring)}, 0, 0])\n  circle(r = ${fmt(s.dims.tube)}, $fn = ${fn})`;
      }
      if (s.type === 'tube') {
        return `difference() {\n  cylinder(h = ${dimTok(s, 'h')}, d = ${dimTok(s, 'd')}, center = true);\n  cylinder(h = ${dimTok(s, 'h')} + 0.2, d = ${fmt((s.dims.ri || 0) * 2)}, center = true);\n}`;
      }
      if (s.type === 'wedge') {
        const hx = s.dims.x / 2, hz = s.dims.z / 2;
        return `rotate([90, 0, 0])\n  linear_extrude(height = ${dimTok(s, 'y')}, center = true)\n  polygon([[${fmt(-hx)}, ${fmt(-hz)}], [${fmt(hx)}, ${fmt(-hz)}], [${fmt(-hx)}, ${fmt(hz)}]])`;
      }
      if (s.type === 'circle') return `circle(d = ${dimTok(s, 'd')}, $fn = ${gfn()})`;
      if (s.type === 'square') return `square([${dimTok(s, 'x')}, ${dimTok(s, 'y')}], center = true)`;
      if (s.type === 'polygon') {
        const pts = (s.dims.pts && s.dims.pts.length >= 3) ? s.dims.pts : [[-20, -20], [20, -20], [20, 20]];
        return `polygon([${pts.map(p => `[${fmt(p[0])}, ${fmt(p[1])}]`).join(', ')}])`;
      }
      const d = s.dims;
      const sides = (d.sides && d.sides >= 3) ? Math.round(d.sides) : 0;
      const tapered = (d.r2 != null && Math.abs(d.r2 - d.r) > 1e-9) || sides;
      if (!tapered) return `cylinder(h = ${dimTok(s, 'h')}, d = ${dimTok(s, 'd')}, center = true)`;
      const fn = sides ? `, $fn = ${sides}` : '';
      return `cylinder(h = ${dimTok(s, 'h')}, r1 = ${dimTok(s, 'r1')}, r2 = ${dimTok(s, 'r2')}, center = true${fn})`;
    }
    function cylinderScad(s) {
      const pts = cylProfile(s.dims.r, s.dims.r2 != null ? s.dims.r2 : s.dims.r, s.dims.h, namedTreats(s));
      const poly = pts.map(p => `[${fmt(p[0])}, ${fmt(p[1])}]`).join(', ');
      const note = (s.expr && (s.expr.d || s.expr.h)) ? '  // note: treated cylinder \u2014 dimensions baked numerically\n    ' : '';
      return `${note}rotate_extrude()\n    polygon([${poly}])`;
    }

    return { emitNode, emitPrimitive, emitPrimitiveWithEdges, emitGroupWithEdges, rotLine, baseCall, cylinderScad, dimTok, posTok, ind };
  };
})();
