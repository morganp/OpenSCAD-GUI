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

  window.ScadConformance = { cases: C, run, flatten };
})();
