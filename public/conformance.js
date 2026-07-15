/* conformance.js — Phase 13 conformance harness for the SCAD interpreter.
 * A battery of representative .scad snippets (one+ per cheat-sheet feature) with a
 * pass/fail check run through window.ScadEngine.run. Pure + dependency-free (only
 * needs ScadEngine). Exposes window.ScadConformance = { cases, run, flatten }.
 *
 * Each case: { s:section, n:name, src, ck(H,res)->true|string }.
 *   H.echo(i)   -> i-th echo message string (OpenSCAD echo formatting)
 *   H.eq(i,v)   -> echo(i) === v
 *   H.flat      -> all geom nodes flattened (depth-first, incl. children)
 *   H.kindCount/typeCount/shapeCount/opCount(x) -> count of matching nodes
 *   H.find(pred), H.noErr, H.errs, H.warns, H.geom
 * A check returns true to pass, or a string (failure detail) / false to fail.
 * Run via eval_js: window.ScadConformance.run()  ->  { passed,total,coveragePct,sections }
 */
(function () {
  function flatten(geom) {
    const out = [];
    (function walk(a) {
      for (const n of (a || [])) { if (!n) continue; out.push(n); if (n.children) walk(n.children); }
    })(geom);
    return out;
  }

  // approx float compare on an echo'd number string
  function nearStr(s, target, tol) {
    const v = parseFloat(s); return isFinite(v) && Math.abs(v - target) <= (tol == null ? 1e-4 : tol);
  }

  const C = [];
  const add = (s, n, src, ck, opts) => C.push({ s, n, src, ck, opts });

  /* ---------------- Operators & values (Phase 1) ---------------- */
  add('Operators & values', '+ - * / precedence', 'echo(2+3*4);', H => H.eq(0, '14'));
  add('Operators & values', 'parentheses', 'echo((2+3)*4);', H => H.eq(0, '20'));
  add('Operators & values', 'modulo %', 'echo(17%5);', H => H.eq(0, '2'));
  add('Operators & values', 'division', 'echo(10/4);', H => H.eq(0, '2.5'));
  add('Operators & values', 'exponent ^ right-assoc', 'echo(2^3^2);', H => H.eq(0, '512'));
  add('Operators & values', 'unary minus', 'echo(-(5)+2);', H => H.eq(0, '-3'));
  add('Operators & values', 'relational', 'echo(3<5, 5>=5, 4!=4);', H => H.eq(0, 'true, true, false'));
  add('Operators & values', 'equality', 'echo(2==2, "a"=="b");', H => H.eq(0, 'true, false'));
  add('Operators & values', 'logical && || !', 'echo(true&&false, true||false, !false);', H => H.eq(0, 'false, true, true'));
  add('Operators & values', 'ternary ?:', 'echo(3<5 ? "lo" : "hi");', H => H.eq(0, '"lo"'));
  add('Operators & values', 'let() expression', 'echo(let(a=4,b=3) a*b);', H => H.eq(0, '12'));
  add('Operators & values', 'vector*scalar', 'echo([1,2,3]*2);', H => H.eq(0, '[2, 4, 6]'));
  add('Operators & values', 'vector+vector', 'echo([1,2,3]+[10,20,30]);', H => H.eq(0, '[11, 22, 33]'));
  add('Operators & values', 'dot product', 'echo([1,2,3]*[4,5,6]);', H => H.eq(0, '32'));
  add('Operators & values', 'list index []', 'echo([10,20,30][1]);', H => H.eq(0, '20'));
  add('Operators & values', 'dot index .x .y .z', 'echo([7,8,9].x, [7,8,9].z);', H => H.eq(0, '7, 9'));
  add('Operators & values', 'nested lists', 'echo([[1,2],[3,4]][1][0]);', H => H.eq(0, '3'));
  add('Operators & values', 'range value', 'echo([0:2:6]);', H => H.eq(0, '[0 : 2 : 6]'));
  add('Operators & values', 'PI constant', 'echo(PI);', H => nearStr(H.echo(0), Math.PI) || 'got ' + H.echo(0));
  add('Operators & values', 'undef constant', 'echo(undef);', H => H.eq(0, 'undef'));
  add('Operators & values', 'string concat via str', 'echo(str("x=", 1+1));', H => H.eq(0, '"x=2"'));

  /* ---------------- Math functions (Phase 3) ---------------- */
  add('Math functions', 'abs / sign', 'echo(abs(-7), sign(-3));', H => H.eq(0, '7, -1'));
  add('Math functions', 'floor / ceil / round', 'echo(floor(2.7), ceil(2.1), round(2.5));', H => H.eq(0, '2, 3, 3'));
  add('Math functions', 'min / max (scalars+list)', 'echo(min(4,1,3), max([2,9,5]));', H => H.eq(0, '1, 9'));
  add('Math functions', 'pow / sqrt / exp', 'echo(pow(2,8), sqrt(81), exp(0));', H => H.eq(0, '256, 9, 1'));
  add('Math functions', 'ln / log', 'echo(ln(1), log(1000));', H => H.eq(0, '0, 3'));
  add('Math functions', 'sin / cos (degrees)', 'echo(sin(30), cos(60));', H => H.eq(0, '0.5, 0.5'));
  add('Math functions', 'tan / asin / acos', 'echo(tan(45), asin(1), acos(1));', H => H.eq(0, '1, 90, 0'));
  add('Math functions', 'atan / atan2', 'echo(atan(1), atan2(1,1));', H => H.eq(0, '45, 45'));
  add('Math functions', 'norm', 'echo(norm([3,4]));', H => H.eq(0, '5'));
  add('Math functions', 'cross', 'echo(cross([1,0,0],[0,1,0]));', H => H.eq(0, '[0, 0, 1]'));
  add('Math functions', 'rands count', 'echo(len(rands(0,1,5)));', H => H.eq(0, '5'));

  /* ---------------- String & list functions (Phase 3) ---------------- */
  add('String & list', 'len(list)', 'echo(len([1,2,3,4]));', H => H.eq(0, '4'));
  add('String & list', 'len(string)', 'echo(len("hello"));', H => H.eq(0, '5'));
  add('String & list', 'concat', 'echo(concat([1,2],[3],[4,5]));', H => H.eq(0, '[1, 2, 3, 4, 5]'));
  add('String & list', 'str(mixed)', 'echo(str("n", 4, true));', H => H.eq(0, '"n4true"'));
  add('String & list', 'chr / ord', 'echo(chr(65), ord("A"));', H => H.eq(0, '"A", 65'));
  add('String & list', 'search', 'echo(search(3,[1,2,3,4]));', H => H.eq(0, '[2]'));
  add('String & list', 'lookup (interpolated)', 'echo(lookup(5,[[0,0],[10,100]]));', H => H.eq(0, '50'));

  /* ---------------- Type tests (Phase 3) ---------------- */
  add('Type tests', 'is_undef', 'echo(is_undef(undef), is_undef(1));', H => H.eq(0, 'true, false'));
  add('Type tests', 'is_num / is_bool', 'echo(is_num(3), is_bool(true));', H => H.eq(0, 'true, true'));
  add('Type tests', 'is_string / is_list', 'echo(is_string("x"), is_list([1]));', H => H.eq(0, 'true, true'));
  add('Type tests', 'is_function', 'echo(is_function(function(x) x));', H => H.eq(0, 'true'));
  add('Type tests', 'version_num', 'echo(version_num());', H => H.eq(0, '20210100'));

  /* ---------------- 3D primitives (Phase 4) ---------------- */
  add('3D primitives', 'cube', 'cube(5);', H => H.typeCount('cube') === 1 || 'no cube node');
  add('3D primitives', 'cube([x,y,z],center)', 'cube([2,3,4], center=true);', H => H.typeCount('cube') === 1 || 'no cube node');
  add('3D primitives', 'sphere', 'sphere(r=5);', H => H.typeCount('sphere') === 1 || 'no sphere node');
  add('3D primitives', 'cylinder', 'cylinder(h=10, r=4);', H => H.typeCount('cylinder') === 1 || 'no cylinder node');
  add('3D primitives', 'cone (r1/r2)', 'cylinder(h=10, r1=5, r2=0);', H => H.typeCount('cylinder') === 1 || 'no cone node');
  add('3D primitives', 'polyhedron', 'polyhedron(points=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]], faces=[[0,2,1],[0,1,3],[1,2,3],[0,3,2]]);', H => H.typeCount('polyhedron') === 1 || 'no polyhedron node');

  /* ---------------- 2D primitives (Phase 9) ---------------- */
  add('2D primitives', 'circle', 'circle(r=5);', H => H.shapeCount('circle') === 1 || 'no circle node');
  add('2D primitives', 'square', 'square([4,2], center=true);', H => H.shapeCount('square') === 1 || 'no square node');
  add('2D primitives', 'polygon', 'polygon(points=[[0,0],[10,0],[5,8]]);', H => H.shapeCount('polygon') === 1 || 'no polygon node');
  add('2D primitives', 'text', 'text("Hi", size=8, halign="center");', H => H.shapeCount('text') === 1 || 'no text node');

  /* ---------------- Transformations (Phase 5) ---------------- */
  add('Transformations', 'translate', 'translate([5,6,7]) cube(1);', H => {
    const g = H.find(x => x.kind === 'group' && x.matrix && Math.abs(x.matrix[12] - 5) < 1e-6); if (!g) return 'no translated group';
    const m = g.matrix; return (Math.abs(m[13] - 6) < 1e-6 && Math.abs(m[14] - 7) < 1e-6) || 'matrix translate wrong';
  });
  add('Transformations', 'rotate([x,y,z])', 'rotate([0,0,90]) cube(1);', H => {
    // 90deg about Z: column-major m[0]~0, m[1]~1
    const g = H.find(x => x.kind === 'group' && x.matrix && Math.abs(x.matrix[0]) < 1e-6 && Math.abs(x.matrix[1] - 1) < 1e-6);
    return !!g || 'rotation matrix wrong';
  });
  add('Transformations', 'rotate(a,[axis])', 'rotate(90,[0,0,1]) cube(1);', H => !!H.find(x => x.type === 'cube') || 'no cube');
  add('Transformations', 'scale', 'scale([2,3,4]) cube(1);', H => {
    const g = H.find(x => x.kind === 'group' && x.matrix && Math.abs(x.matrix[0] - 2) < 1e-6 && Math.abs(x.matrix[5] - 3) < 1e-6 && Math.abs(x.matrix[10] - 4) < 1e-6);
    return !!g || 'scale matrix wrong';
  });
  add('Transformations', 'mirror', 'mirror([1,0,0]) cube(1);', H => {
    const g = H.find(x => x.kind === 'group' && x.matrix && x.matrix[0] < 0);
    return !!g || 'mirror matrix wrong';
  });
  add('Transformations', 'multmatrix', 'multmatrix([[1,0,0,3],[0,1,0,0],[0,0,1,0],[0,0,0,1]]) cube(1);', H => {
    const g = H.find(x => x.kind === 'group' && x.matrix && Math.abs(x.matrix[12] - 3) < 1e-6);
    return !!g || 'multmatrix translate wrong';
  });
  add('Transformations', 'color (name)', 'color("red") cube(1);', H => {
    const g = H.find(x => x.kind === 'group' && x.color); if (!g) return 'no colored group';
    return (g.color[0] === 1 && g.color[1] === 0 && g.color[2] === 0) || 'color rgb wrong';
  });
  add('Transformations', 'color ([r,g,b,a])', 'color([0,0,1],0.5) cube(1);', H => {
    const g = H.find(x => x.kind === 'group' && x.color); return (g && g.color[3] === 0.5) || 'alpha wrong';
  });
  add('Transformations', 'resize', 'resize([20,0,0]) cube(10);', H => H.kindCount('resize') === 1 || 'no resize node');
  add('Transformations', 'offset (2D)', 'offset(r=2) circle(5);', H => H.kindCount('offset2d') === 1 || 'no offset node');
  add('Transformations', 'hull', 'hull(){ translate([10,0,0]) circle(2); circle(2);}', H => H.opCount('hull') === 1 || 'no hull node');
  add('Transformations', 'minkowski', 'minkowski(){ cube(10); sphere(2);}', H => H.opCount('minkowski') === 1 || 'no minkowski node');

  /* ---------------- Booleans (Phase 6) ---------------- */
  add('Booleans', 'union', 'union(){ cube(1); sphere(1);}', H => H.opCount('union') === 1 || 'no union');
  add('Booleans', 'difference', 'difference(){ cube(2); sphere(1);}', H => H.opCount('difference') === 1 || 'no difference');
  add('Booleans', 'intersection', 'intersection(){ cube(2); sphere(1.3);}', H => H.opCount('intersection') === 1 || 'no intersection');

  /* ---------------- Flow / modules / functions (Phase 7) ---------------- */
  add('Flow & modules', 'for loop (range)', 'for(i=[0:2]) translate([i*3,0,0]) cube(1);', H => H.typeCount('cube') === 3 || ('expected 3 cubes, got ' + H.typeCount('cube')));
  add('Flow & modules', 'for over list', 'for(i=[2,5,9]) translate([i,0,0]) sphere(1);', H => H.typeCount('sphere') === 3 || ('got ' + H.typeCount('sphere')));
  add('Flow & modules', 'for multiple generators', 'for(i=[0:1], j=[0:1]) translate([i,j,0]) cube(1);', H => H.typeCount('cube') === 4 || ('got ' + H.typeCount('cube')));
  add('Flow & modules', 'intersection_for', 'intersection_for(a=[0:60:120]) rotate([0,0,a]) cube([10,2,2],center=true);', H => H.opCount('intersection') >= 1 || 'no intersection');
  add('Flow & modules', 'if / else', 'if(1>2) cube(1); else sphere(2);', H => (H.typeCount('sphere') === 1 && H.typeCount('cube') === 0) || 'wrong branch');
  add('Flow & modules', 'let block (statement)', 'let(s=4) cube(s);', H => H.typeCount('cube') === 1 || 'no cube');
  add('Flow & modules', 'user module', 'module box(){ cube(3);} box();', H => H.typeCount('cube') === 1 || 'module did not expand');
  add('Flow & modules', 'module default/named args', 'module b(w=2,h=3){ cube([w,h,1]);} b(h=5);', H => H.typeCount('cube') === 1 || 'no cube');
  add('Flow & modules', 'children()', 'module wrap(){ children();} wrap() sphere(2);', H => H.typeCount('sphere') === 1 || 'children() did not pass through');
  add('Flow & modules', '$children count', 'module c(){ echo($children);} c(){ cube(1); sphere(1);}', H => H.eq(0, '2'));
  add('Flow & modules', 'recursion (module)', 'module stk(n){ if(n>0){ translate([0,0,n]) cube(1); stk(n-1);}} stk(4);', H => H.typeCount('cube') === 4 || ('got ' + H.typeCount('cube')));
  add('Flow & modules', 'user function', 'function dbl(x)=x*2; echo(dbl(21));', H => H.eq(0, '42'));
  add('Flow & modules', 'function recursion', 'function fib(n)=n<2?n:fib(n-1)+fib(n-2); echo(fib(10));', H => H.eq(0, '55'));
  add('Flow & modules', 'function literal', 'f=function(x) x+1; echo(f(9));', H => H.eq(0, '10'));

  /* ---------------- List comprehensions (Phase 8) ---------------- */
  add('List comprehensions', 'basic', 'echo([for(i=[0:3]) i*i]);', H => H.eq(0, '[0, 1, 4, 9]'));
  add('List comprehensions', 'each', 'echo([for(i=[1,2,3]) each [i,-i]]);', H => H.eq(0, '[1, -1, 2, -2, 3, -3]'));
  add('List comprehensions', 'if filter', 'echo([for(i=[0:5]) if(i%2==0) i]);', H => H.eq(0, '[0, 2, 4]'));
  add('List comprehensions', 'if/else', 'echo([for(i=[0:3]) i%2==0 ? "e" : "o"]);', H => H.eq(0, '["e", "o", "e", "o"]'));
  add('List comprehensions', 'let inside', 'echo([for(i=[0:2]) let(j=i*10) j]);', H => H.eq(0, '[0, 10, 20]'));
  add('List comprehensions', 'nested', 'echo([for(i=[0:1]) for(j=[0:1]) [i,j]]);', H => H.eq(0, '[[0, 0], [0, 1], [1, 0], [1, 1]]'));
  add('List comprehensions', 'C-style for', 'echo([for(i=0,j=10; i<3; i=i+1,j=j-1) [i,j]]);', H => H.eq(0, '[[0, 10], [1, 9], [2, 8]]'));

  /* ---------------- Extrusions (Phase 9) ---------------- */
  add('Extrusions', 'linear_extrude', 'linear_extrude(height=6) square(3);', H => !!H.find(x => x.kind === 'extrude' && x.mode === 'linear') || 'no linear extrude');
  add('Extrusions', 'linear_extrude twist', 'linear_extrude(height=20, twist=180, slices=20) square(5,center=true);', H => {
    const n = H.find(x => x.kind === 'extrude' && x.mode === 'linear'); return (n && n.params.twist === 180) || 'twist not carried';
  });
  add('Extrusions', 'rotate_extrude', 'rotate_extrude() translate([5,0]) circle(1);', H => !!H.find(x => x.kind === 'extrude' && x.mode === 'rotate') || 'no rotate extrude');
  add('Extrusions', 'projection', 'projection() cube(4, center=true);', H => H.kindCount('projection') === 1 || 'no projection node');
  add('Extrusions', 'projection(cut=true)', 'projection(cut=true) sphere(5);', H => {
    const n = H.find(x => x.kind === 'projection'); return (n && n.params.cut === true) || 'cut flag not set';
  });

  /* ---------------- Import / surface / include (Phase 10) ---------------- */
  add('Import & include', 'import 3D node', 'import("part.stl");', H => H.kindCount('import') === 1 || 'no import node');
  add('Import & include', 'import 2D node', 'import("logo.svg");', H => (H.shapeCount('import') === 1) || 'no 2D import node');
  add('Import & include', 'surface node', 'surface(file="hmap.dat", center=true);', H => H.kindCount('surface') === 1 || 'no surface node');
  add('Import & include', 'include splices file', 'include <lib.scad>\ncube(1);', H => H.typeCount('cube') >= 2 || ('expected lib+local cubes, got ' + H.typeCount('cube')),
    { files: { 'lib.scad': 'cube(2);' } });
  add('Import & include', 'use imports defs only', 'use <lib.scad>\nmk();', H => (H.typeCount('sphere') === 1 && H.typeCount('cube') === 0) || 'use brought in geometry',
    { files: { 'lib.scad': 'cube(9); module mk(){ sphere(2);}' } });

  /* ---------------- Special variables (Phase 2) ---------------- */
  add('Special variables', '$fn assignment', '$fn=24; echo($fn);', H => H.eq(0, '24'));
  add('Special variables', '$fa / $fs defaults', 'echo($fa, $fs);', H => H.eq(0, '12, 2'));
  add('Special variables', '$preview', 'echo($preview);', H => H.eq(0, 'true'));
  add('Special variables', '$t default', 'echo($t);', H => H.eq(0, '0'));
  add('Special variables', '$vpt / $vpd present', 'echo(is_list($vpt), is_num($vpd));', H => H.eq(0, 'true, true'));

  /* ---------------- Modifier characters (Phase 11) ---------------- */
  add('Modifiers', '* disable', '*cube(1); sphere(2);', H => (H.typeCount('cube') === 0 && H.typeCount('sphere') === 1) || 'disable did not skip');
  add('Modifiers', '# highlight', '#cube(1);', H => !!H.find(x => x.mod === 'highlight') || 'no highlight tag');
  add('Modifiers', '% background', '%cube(1);', H => !!H.find(x => x.mod === 'background') || 'no background tag');
  add('Modifiers', '! root (renders)', '!cube(1);', H => H.typeCount('cube') === 1 && H.noErr || 'root failed');

  /* ---------------- echo / assert (Phase 2) ---------------- */
  add('echo & assert', 'echo multiple args', 'echo("a", 1, [2,3]);', H => H.eq(0, '"a", 1, [2, 3]'));
  add('echo & assert', 'assert pass (no error)', 'assert(1<2, "ok"); cube(1);', H => H.noErr && H.typeCount('cube') === 1 || 'assert pass errored');
  add('echo & assert', 'assert fail (error)', 'assert(1>2, "boom");', H => (H.errs.length > 0 && /boom/.test(H.errs.map(e => e.msg).join(' '))) || 'assert fail not reported');
  add('echo & assert', 'assign() deprecated', 'assign(a=5){ cube(a);}', H => H.typeCount('cube') === 1 || 'assign did not bind');

  function run(globalOpts) {
    if (!window.ScadEngine) throw new Error('ScadEngine not loaded');
    const sections = {};
    let passed = 0;
    for (const c of C) {
      let ok = false, detail = '';
      try {
        const res = window.ScadEngine.run(c.src, Object.assign({}, globalOpts || {}, c.opts || {}));
        const flat = flatten(res.geom);
        const H = {
          echo: i => (res.echos[i] || {}).msg,
          eq: (i, v) => ((res.echos[i] || {}).msg === v) || ('echo[' + i + ']="' + (res.echos[i] || {}).msg + '" != "' + v + '"'),
          flat, geom: res.geom, errs: res.errors, warns: res.warnings, noErr: res.errors.length === 0,
          kindCount: k => flat.filter(n => n.kind === k).length,
          typeCount: t => flat.filter(n => n.type === t).length,
          shapeCount: sh => flat.filter(n => n.shape === sh).length,
          opCount: o => flat.filter(n => n.op === o).length,
          find: p => flat.find(p),
        };
        const r = c.ck(H, res);
        if (r === true) ok = true; else { ok = false; detail = (typeof r === 'string') ? r : 'check failed'; }
      } catch (e) { ok = false; detail = 'threw: ' + (e && e.message || e); }
      if (ok) passed++;
      (sections[c.s] = sections[c.s] || []).push({ name: c.n, ok, detail, src: c.src });
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

  window.ScadConformance = { cases: C, run, flatten, runGui };

  /* ===================================================================================================
   * GUI render-path classification battery (added v0.54.0 after the extrude-boolean regression).
   * conformance's main battery only exercises window.ScadEngine (the evaluator). It never touched the
   * EDITOR's isAdvanced() gate — the thing that decides "render via GUI authoring path" vs "render via
   * engine (read-only)". A v0.51 change wrongly admitted 2D booleans under linear_extrude/rotate_extrude
   * into the GUI path, which can only even-odd-merge 2D primitives (no boolean execution), so a
   * difference/intersection silhouette came out as a naive union. Nothing caught it because the GUI gate
   * had ZERO coverage. These cases assert the classification directly: { src, advanced }.
   * Invariant under test: a program is GUI-simple ONLY if the GUI authoring path can render it faithfully.
   * =================================================================================================== */
  const G = [];
  const gadd = (n, src, advanced) => G.push({ n, src, advanced });

  // plain extrudes over a single 2D primitive — GUI path handles these (simple)
  gadd('linear_extrude over circle', 'linear_extrude(height=10) circle(d=20,$fn=32);', false);
  gadd('linear_extrude over square', 'linear_extrude(height=8) square([20,30], center=true);', false);
  gadd('linear_extrude over polygon', 'linear_extrude(height=5) polygon([[0,0],[20,0],[10,18]]);', false);
  gadd('translate-wrapped extrude body', 'linear_extrude(height=5) translate([4,0,0]) circle(r=6,$fn=24);', false);
  gadd('rotate_extrude over translated circle', 'rotate_extrude(angle=270,$fn=48) translate([12,0,0]) circle(r=4);', false);
  // 2D booleans/hull under an extrude — GUI path CANNOT execute these → must be advanced (engine path)
  gadd('intersection of 2D under extrude', 'linear_extrude(height=10) intersection(){ circle(d=40,$fn=48); translate([25,0,0]) circle(d=40,$fn=48); }', true);
  gadd('difference of 2D under extrude', 'linear_extrude(height=10) difference(){ circle(d=40,$fn=48); circle(d=20,$fn=48); }', true);
  gadd('union of 2D under extrude', 'linear_extrude(height=10) union(){ circle(d=40,$fn=48); circle(d=20,$fn=48); }', true);
  gadd('hull of 2D under extrude', 'linear_extrude(height=6) hull(){ circle(4,$fn=24); translate([20,0,0]) circle(4,$fn=24); }', true);
  gadd('nested boolean under extrude', 'linear_extrude(height=4) difference(){ square([30,30],center=true); union(){ circle(5,$fn=24); translate([10,0,0]) circle(5,$fn=24); } }', true);
  // 3D primitives + booleans (unchanged GUI capability)
  gadd('bare cube', 'cube([10,20,30], center=true);', false);
  gadd('3D difference', 'difference(){ cube(20,center=true); cylinder(h=30,d=10,center=true); }', false);
  // genuinely advanced constructs stay advanced
  gadd('for loop', 'for(i=[0:3]) translate([i*10,0,0]) cube(5);', true);
  gadd('extruded text', 'linear_extrude(5) text("hi");', true);

  // editor: the live Component instance (window.__editor) — needed for isAdvanced + parse
  function runGui(editor) {
    editor = editor || window.__editor;
    const cases = [];
    let passed = 0;
    const haveEngine = !!(window.ScadEngine && window.ScadEngine.parse);
    const haveEditor = !!(editor && typeof editor.isAdvanced === 'function');
    for (const c of G) {
      let ok = false, detail = '';
      if (!haveEngine || !haveEditor) { detail = 'editor/engine not available'; }
      else {
        try {
          const pp = window.ScadEngine.parse(c.src);
          if (pp.errors && pp.errors.length) { detail = 'parse error: ' + pp.errors[0].msg; }
          else {
            const adv = editor.isAdvanced(pp.ast);
            ok = (adv === c.advanced);
            if (!ok) detail = 'classified ' + (adv ? 'advanced' : 'simple') + ', expected ' + (c.advanced ? 'advanced' : 'simple');
          }
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: c.n, ok, detail, src: c.src });
    }
    // internal-edge detection: a union of two offset boxes must expose its concave seam edges (the
    // unwelded-CSG-seam fix, v0.55.0). detectGroupEdges + a CSG union fixture live on the editor.
    {
      let ok = false, detail = '';
      if (!haveEditor || typeof editor.internalEdgeSelfTest !== 'function') { detail = 'editor self-test unavailable'; }
      else {
        try {
          const r = editor.internalEdgeSelfTest();
          if (!r.ok) { detail = r.reason || 'fixture failed'; }
          else { ok = r.concave >= 2 && r.convex >= 1; if (!ok) detail = 'detected ' + r.concave + ' concave / ' + r.convex + ' convex (want >=2 concave)'; }
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: 'union exposes concave internal edges', ok, detail, src: 'union(){ translate([0,0,20]) cube([40,40,40],true); translate([34,0,29]) cube([40,40,40],true); }' });
    }
    // annotation comment round-trip: an @annotate line parses back with matching endpoints + distance.
    {
      let ok = false, detail = '';
      if (!haveEditor || typeof editor.parseAnnotations !== 'function') { detail = 'editor annotation API unavailable'; }
      else {
        try {
          const src = '// @annotate measure {"a":[0,0,0],"b":[40,0,0],"d":40,"label":"width"}';
          const p = editor.parseAnnotations(src);
          ok = p.length === 1 && p[0].d === 40 && p[0].a[0] === 0 && p[0].b[0] === 40 && p[0].label === 'width';
          if (!ok) detail = 'parsed ' + JSON.stringify(p);
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: 'annotation comment round-trips', ok, detail, src: '// @annotate measure {…}' });
    }
    // bare-primitive feature edges: a tube exposes selectable rim edges via the detected-edge machinery
    // (previously tube/wedge had zero treatable edges). Guards the v0.58.0 primitive edge unification.
    {
      let ok = false, detail = '';
      if (!haveEditor || typeof editor.rebuildScene !== 'function') { detail = 'editor unavailable'; }
      else {
        try {
          const savedTree = editor.tree, savedVars = editor.vars;
          editor.tree = [{ id: 'ct_tube', type: 'tube', label: 'T', dims: { r: 20, ri: 10, h: 30 }, pos: [0, 0, 15], treatments: {} }];
          editor.vars = []; editor.reindex(); editor.rebuildScene();
          const n = editor.tree[0]; const edges = (n && n._edges) || [];
          ok = edges.length >= 4 && (n._edgeProxies || []).length > 0;
          if (!ok) detail = 'detected ' + edges.length + ' edges / ' + ((n && n._edgeProxies || []).length) + ' proxies';
          editor.tree = savedTree; editor.vars = savedVars; editor.reindex(); editor.rebuildScene();
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: 'bare primitive (tube) exposes feature edges', ok, detail, src: 'tube r=20 ri=10 h=30' });
    }
    // concave fill adds material: filleting all internal edges of a box pocket increases solid volume,
    // and ball-joints bridge the corners without throwing. Guards v0.59.0 fill-tool robustness (item 3).
    {
      let ok = false, detail = '';
      if (!haveEditor || typeof editor.rebuildTopGroup !== 'function' || typeof editor.rebuildScene !== 'function') { detail = 'editor unavailable'; }
      else {
        try {
          const vol = (mesh) => { const g = mesh.geometry, p = g.attributes.position, idx = g.index, N = (idx ? idx.count : p.count) / 3; let v = 0; const G = (t, c) => { const i = idx ? idx.getX(3 * t + c) : 3 * t + c; return [p.getX(i), p.getY(i), p.getZ(i)]; }; for (let t = 0; t < N; t++) { const a = G(t, 0), b = G(t, 1), c = G(t, 2); v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6; } return Math.abs(v); };
          const savedTree = editor.tree, savedVars = editor.vars, savedCode = editor.state.code;
          const mk = (x, y, z, tz) => ({ id: 'ct_' + Math.random().toString(36).slice(2, 7), type: 'cuboid', label: 'c', dims: { x, y, z }, pos: [0, 0, tz], treatments: {} });
          const pocket = { id: 'ct_pocket', op: 'difference', label: 'D', children: [mk(50, 50, 30, 0), mk(30, 30, 20, 8)] };
          editor.tree = [pocket]; editor.vars = []; editor.reindex(); editor.rebuildScene();
          const concave = (pocket._edges || []).filter(e => !e.convex);
          const v0 = pocket.solid ? vol(pocket.solid) : 0;
          pocket.edgeTreatments = {};
          for (const ce of concave) pocket.edgeTreatments[ce.id] = { type: 'fillet', size: 3, convex: false, segs: ce.segs.map(s => ({ a: s.a.slice(), b: s.b.slice(), mid: s.mid.slice(), U: s.U.slice(), V: s.V.slice(), len: s.len })) };
          editor.rebuildTopGroup(pocket, { edgeId: concave[0] && concave[0].id });
          const v1 = pocket.solid ? vol(pocket.solid) : 0;
          ok = concave.length >= 4 && v1 > v0;
          if (!ok) detail = 'concave=' + concave.length + ' vol ' + v0.toFixed(0) + '→' + v1.toFixed(0);
          editor.tree = savedTree; editor.vars = savedVars;
          if (editor._codeArea) editor._codeArea.value = savedCode;
          editor.reindex(); editor.rebuildScene();
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: 'concave fill adds material (pocket, ball-joints)', ok, detail, src: 'difference(){ cube(50); pocket }' });
    }
    // bare-primitive concave edges (item 1): a reflex-vertex (L-shape) polygon slab detects the reentrant
    // corner, is routed through the feature-edge machinery, and exposes ≥1 concave vertical edge.
    {
      let ok = false, detail = '';
      if (!haveEditor || typeof editor.polygonReflexSelfTest !== 'function') { detail = 'editor self-test unavailable'; }
      else {
        try {
          const r = editor.polygonReflexSelfTest();
          if (!r.ok) { detail = r.reason || 'fixture failed'; }
          else { ok = r.reflex && r.feature && r.concave >= 1; if (!ok) detail = 'reflex=' + r.reflex + ' feature=' + r.feature + ' concave=' + r.concave; }
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: 'bare reflex polygon exposes concave edge', ok, detail, src: 'polygon(points=[…L-shape…])' });
    }
    // unified edge model (item 2): one node.edgeTreatments map — namedTreats view separates named/seg
    // entries, legacy shape.treatments migrates on load, treated cuboid still emits edge_fillet.
    {
      let ok = false, detail = '';
      if (!haveEditor || typeof editor.unifiedTreatmentSelfTest !== 'function') { detail = 'editor self-test unavailable'; }
      else {
        try {
          const r = editor.unifiedTreatmentSelfTest();
          if (!r.ok) { detail = r.reason || 'fixture failed'; }
          else { ok = r.sepOk && r.migOk && r.emitOk; if (!ok) detail = 'sep=' + r.sepOk + ' migrate=' + r.migOk + ' emit=' + r.emitOk; }
        } catch (e) { detail = 'threw: ' + (e && e.message || e); }
      }
      if (ok) passed++;
      cases.push({ name: 'unified edgeTreatments model (named+seg, migrate, emit)', ok, detail, src: 'shape.treatments ∪ edgeTreatments → edgeTreatments' });
    }
    return { name: 'GUI classification', passed, total: cases.length, cases };
  }

  window.ScadConformance.guiCases = G;
})();
