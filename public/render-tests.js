/* render-tests.js — render regression harness for the SCAD editor.
 *
 * Unlike conformance.js (which checks ENGINE output only — geom-node kinds/counts, echo strings),
 * this battery runs each .scad case through the FULL pipeline (engine -> realize -> THREE meshes)
 * and asserts on the rendered result: mesh count, triangle count, and world bounding-box extents.
 * It catches regressions in realizeNode / CSG / extrude / 2D / hull that conformance can't see.
 *
 * Needs the live editor (THREE + CSG): window.ScadRenderTests.run(editor, globalOpts) is ASYNC and
 * calls editor.measureRender(src) per case. Returns the same report shape as ScadConformance.run.
 *
 *   add(section, name, src, expect, opts)
 *   expect = {
 *     mesh:    minimum mesh count (default 1)
 *     meshMax: maximum mesh count (optional)
 *     tris:    minimum triangle count (optional)
 *     noErr:   true (default) -> case fails if the run reports any error
 *     box:     [[xmin,ymin,zmin],[xmax,ymax,zmax]] expected world bbox (+/- tol)
 *     box2d:   [[xmin,ymin],[xmax,ymax]] -> check x/y only (bare 2D slabs)
 *     tol:     bbox tolerance (default 0.6)
 *     nonEmpty:true -> just require a non-empty bbox (size used for hard-to-predict shapes, e.g. text)
 *     empty:   true -> require 0 meshes rendered (e.g. * disable modifier)
 *   }
 */
(function () {
  const C = [];
  const add = (s, n, src, expect, opts) => C.push({ s, n, src, expect: expect || {}, opts });

  /* ---------------- 3D primitives ---------------- */
  add('3D primitives', 'cube(10)', 'cube(10);',
    { mesh: 1, tris: 12, box: [[0, 0, 0], [10, 10, 10]] });
  add('3D primitives', 'cube([2,3,4], center)', 'cube([2,3,4], center=true);',
    { mesh: 1, box: [[-1, -1.5, -2], [1, 1.5, 2]] });
  add('3D primitives', 'sphere(r=5)', 'sphere(r=5);',
    { mesh: 1, tris: 100, box: [[-5, -5, -5], [5, 5, 5]], tol: 0.7 });
  add('3D primitives', 'cylinder(h=10, r=4)', 'cylinder(h=10, r=4);',
    { mesh: 1, box: [[-4, -4, 0], [4, 4, 10]], tol: 0.7 });
  add('3D primitives', 'cone (r1=5, r2=0)', 'cylinder(h=10, r1=5, r2=0);',
    { mesh: 1, box: [[-5, -5, 0], [5, 5, 10]], tol: 0.7 });
  add('3D primitives', 'polyhedron (tetra)',
    'polyhedron(points=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]], faces=[[0,2,1],[0,1,3],[1,2,3],[0,3,2]]);',
    { mesh: 1, box: [[0, 0, 0], [1, 1, 1]], tol: 0.05 });

  /* ---------------- Transformations ---------------- */
  add('Transformations', 'translate', 'translate([5,6,7]) cube(2);',
    { mesh: 1, box: [[5, 6, 7], [7, 8, 9]] });
  add('Transformations', 'rotate([0,0,90])', 'rotate([0,0,90]) cube([4,2,2]);',
    { mesh: 1, box: [[-2, 0, 0], [0, 4, 2]] });
  add('Transformations', 'rotate(a,[axis])', 'rotate(90,[1,0,0]) cube([2,2,6]);',
    { mesh: 1, box: [[0, -6, 0], [2, 0, 2]] });
  add('Transformations', 'scale', 'scale([2,1,1]) cube(5);',
    { mesh: 1, box: [[0, 0, 0], [10, 5, 5]] });
  add('Transformations', 'mirror', 'mirror([1,0,0]) translate([2,0,0]) cube(2);',
    { mesh: 1, box: [[-4, 0, 0], [-2, 2, 2]] });
  add('Transformations', 'multmatrix', 'multmatrix([[1,0,0,3],[0,1,0,0],[0,0,1,0],[0,0,0,1]]) cube(2);',
    { mesh: 1, box: [[3, 0, 0], [5, 2, 2]] });
  add('Transformations', 'color (geometry intact)', 'color("red") cube(4);',
    { mesh: 1, box: [[0, 0, 0], [4, 4, 4]] });
  add('Transformations', 'resize([20,0,0])', 'resize([20,0,0]) cube(10);',
    { mesh: 1, box: [[0, 0, 0], [20, 10, 10]] });

  /* ---------------- Booleans ---------------- */
  add('Booleans', 'union', 'union(){ cube(10); translate([5,5,5]) cube(10); }',
    { mesh: 1, box: [[0, 0, 0], [15, 15, 15]] });
  add('Booleans', 'difference (extent kept)', 'difference(){ cube(10); translate([5,5,-1]) cube(12); }',
    { mesh: 1, box: [[0, 0, 0], [10, 10, 10]] });
  add('Booleans', 'intersection', 'intersection(){ cube(10); translate([5,5,5]) cube(10); }',
    { mesh: 1, box: [[5, 5, 5], [10, 10, 10]] });
  add('Booleans', 'difference hollows out',
    'difference(){ cube(20, center=true); sphere(7); }',
    { mesh: 1, box: [[-10, -10, -10], [10, 10, 10]] });

  /* ---------------- Flow / modules ---------------- */
  add('Flow & modules', 'for loop (3 cubes)', 'for(i=[0:2]) translate([i*10,0,0]) cube(2);',
    { mesh: 3, box: [[0, 0, 0], [22, 2, 2]] });
  add('Flow & modules', 'user module', 'module box(){ cube(3); } box();',
    { mesh: 1, box: [[0, 0, 0], [3, 3, 3]] });
  add('Flow & modules', 'recursion (stack)',
    'module stk(n){ if(n>0){ translate([0,0,n]) cube(2); stk(n-1); } } stk(3);',
    { mesh: 3, box: [[0, 0, 1], [2, 2, 5]] });
  add('Flow & modules', 'if / else (else branch)', 'if(1>2) cube(1); else sphere(5);',
    { mesh: 1, box: [[-5, -5, -5], [5, 5, 5]], tol: 0.7 });
  add('Flow & modules', 'children() pass-through', 'module wrap(){ children(); } wrap() cube(4);',
    { mesh: 1, box: [[0, 0, 0], [4, 4, 4]] });

  /* ---------------- 2D + extrusion ---------------- */
  add('2D & extrude', 'linear_extrude', 'linear_extrude(height=6) square(4);',
    { mesh: 1, box: [[0, 0, 0], [4, 4, 6]] });
  add('2D & extrude', 'linear_extrude (center)', 'linear_extrude(height=6, center=true) square(4, center=true);',
    { mesh: 1, box: [[-2, -2, -3], [2, 2, 3]] });
  add('2D & extrude', 'linear_extrude difference (washer)',
    'linear_extrude(height=4) difference(){ circle(10); circle(6); }',
    { mesh: 1, box: [[-10, -10, 0], [10, 10, 4]], tol: 0.8 });
  add('2D & extrude', 'rotate_extrude (torus)', 'rotate_extrude() translate([10,0]) circle(2);',
    { mesh: 1, box: [[-12, -12, -2], [12, 12, 2]], tol: 0.8 });
  add('2D & extrude', 'bare 2D circle (slab)', 'circle(5);',
    { mesh: 1, box2d: [[-5, -5], [5, 5]], tol: 0.7 });
  add('2D & extrude', 'bare 2D square (slab)', 'square([8,6]);',
    { mesh: 1, box2d: [[0, 0], [8, 6]] });

  /* ---------------- Hull / Minkowski ---------------- */
  add('Hull & Minkowski', 'hull (two spheres)', 'hull(){ translate([10,0,0]) sphere(3); sphere(3); }',
    { mesh: 1, box: [[-3, -3, -3], [13, 3, 3]], tol: 0.8 });
  add('Hull & Minkowski', 'minkowski (rounded cube)', 'minkowski(){ cube(10); sphere(2); }',
    { mesh: 1, box: [[-2, -2, -2], [12, 12, 12]], tol: 1.0 });

  /* ---------------- text() ---------------- */
  add('Text', 'linear_extrude text', 'linear_extrude(3) text("Hi", size=10);',
    { mesh: 1, tris: 20, nonEmpty: true });

  /* ---------------- Modifiers ---------------- */
  add('Modifiers', '* disable', '*cube(20); sphere(3);',
    { mesh: 1, box: [[-3, -3, -3], [3, 3, 3]], tol: 0.7 });
  add('Modifiers', '# highlight (still renders)', '#cube(4);',
    { mesh: 1, box: [[0, 0, 0], [4, 4, 4]] });
  add('Modifiers', '% background (still renders)', '%cube(4);',
    { mesh: 1, box: [[0, 0, 0], [4, 4, 4]] });
  add('Modifiers', '! root (only that subtree)', 'cube(40); !translate([0,0,0]) sphere(3);',
    { mesh: 1, box: [[-3, -3, -3], [3, 3, 3]], tol: 0.7 });

  function checkCase(c, m) {
    const e = c.expect || {};
    if (e.noErr !== false && m.errors && m.errors.length)
      return 'errors: ' + m.errors.map(x => x.msg).join('; ');
    if (e.empty) return m.meshCount === 0 ? true : ('expected nothing rendered, got ' + m.meshCount + ' mesh');
    const meshMin = e.mesh != null ? e.mesh : 1;
    if (m.meshCount < meshMin) return 'expected \u2265' + meshMin + ' mesh, got ' + m.meshCount;
    if (e.meshMax != null && m.meshCount > e.meshMax) return 'expected \u2264' + e.meshMax + ' mesh, got ' + m.meshCount;
    if (e.tris != null && m.tris < e.tris) return 'expected \u2265' + e.tris + ' tris, got ' + m.tris;
    if (e.nonEmpty) {
      if (!m.bbox) return 'empty bbox \u2014 nothing rendered';
      const sz = m.bbox.max[0] - m.bbox.min[0];
      if (!(sz > 0.01)) return 'degenerate bbox (x size ' + sz.toFixed(3) + ')';
    }
    const tol = e.tol != null ? e.tol : 0.6;
    const lbl = ['x', 'y', 'z'];
    if (e.box) {
      if (!m.bbox) return 'no geometry / empty bbox';
      for (let i = 0; i < 3; i++) {
        if (Math.abs(m.bbox.min[i] - e.box[0][i]) > tol)
          return 'min' + lbl[i] + ' ' + m.bbox.min[i].toFixed(2) + ' \u2260 ' + e.box[0][i] + ' (\u00b1' + tol + ')';
        if (Math.abs(m.bbox.max[i] - e.box[1][i]) > tol)
          return 'max' + lbl[i] + ' ' + m.bbox.max[i].toFixed(2) + ' \u2260 ' + e.box[1][i] + ' (\u00b1' + tol + ')';
      }
    }
    if (e.box2d) {
      if (!m.bbox) return 'no geometry / empty bbox';
      for (let i = 0; i < 2; i++) {
        if (Math.abs(m.bbox.min[i] - e.box2d[0][i]) > tol)
          return 'min' + lbl[i] + ' ' + m.bbox.min[i].toFixed(2) + ' \u2260 ' + e.box2d[0][i] + ' (\u00b1' + tol + ')';
        if (Math.abs(m.bbox.max[i] - e.box2d[1][i]) > tol)
          return 'max' + lbl[i] + ' ' + m.bbox.max[i].toFixed(2) + ' \u2260 ' + e.box2d[1][i] + ' (\u00b1' + tol + ')';
      }
    }
    return true;
  }

  // short bbox label for the panel detail line of a passing case
  function bboxStr(m) {
    if (!m || !m.bbox) return m && m.meshCount ? (m.meshCount + ' mesh') : 'empty';
    const f = n => (Math.round(n * 10) / 10);
    const a = m.bbox.min.map(f).join(','), b = m.bbox.max.map(f).join(',');
    return m.meshCount + ' mesh \u00b7 ' + m.tris + ' tris \u00b7 [' + a + ']\u2026[' + b + ']';
  }

  async function run(editor, globalOpts) {
    if (!editor || typeof editor.measureRender !== 'function') throw new Error('editor not ready');
    const sections = {};
    let passed = 0;
    for (const c of C) {
      let ok = false, detail = '', metrics = null;
      try {
        metrics = await editor.measureRender(c.src, c.opts || {});
        const r = checkCase(c, metrics);
        if (r === true) ok = true; else detail = (typeof r === 'string') ? r : 'check failed';
      } catch (err) { ok = false; detail = 'threw: ' + (err && err.message || err); }
      if (ok) passed++;
      (sections[c.s] = sections[c.s] || []).push({
        name: c.n, ok, detail, src: c.src,
        info: ok ? bboxStr(metrics) : detail,
      });
    }
    const sectionList = Object.keys(sections).map(name => {
      const cases = sections[name];
      const p = cases.filter(x => x.ok).length;
      return { name, passed: p, total: cases.length, cases };
    });
    return {
      passed, total: C.length, failed: C.length - passed,
      coveragePct: Math.round((passed / C.length) * 1000) / 10,
      sections: sectionList,
    };
  }

  window.ScadRenderTests = { cases: C, run };
})();
