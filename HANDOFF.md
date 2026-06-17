# HANDOFF — `projection(cut)` render (Phase 9 tail)

**Status: ✅ SHIPPED (this session).** `projection()` and `projection(cut=true)` now render and
feed `linear_extrude`. Verified via `eval_js`: `projection() cube(10,center=true)` → 10×10 flat
slab; `projection(cut=true) sphere(10)` → Ø20 disc; washer `difference(){cube([20,20,4],c);
cylinder(r=4,c)}` → 2 rings (outer area 400 + hole ≈48), square edges simplified to 9 verts;
`linear_extrude(4) projection() sphere(8)` → solid disc prism. No console errors.

### How it works (Editor.dc.html, no engine change beyond a clearer warn)
- `projectionRings(node)`: unions the projection's 3D children into one CSG brush in the
  projection-local frame. For `cut=true`, intersects it with a thin box slab at z=0 (CSG
  INTERSECTION) so the footprint = the cross-section; otherwise uses the whole solid.
- `silhouetteRings(geo)`: CPU-rasterizes every triangle's XY footprint (point-in-tri at cell
  centers) into a binary coverage grid (≤320 cells on the long axis, capped ~200k cells).
- `marchSquares(...)`: marching squares over the grid (14-case edge-pair table, saddle cases
  split), stitches segments into closed loops by exact midpoint-key adjacency, then
  Douglas-Peucker simplifies each ring. Returns world-XY rings; even-odd nesting (outer vs
  hole, multi-region) is resolved downstream by the existing `ringsToShapes`.
- Wired into `collect2D` (the projection branch returned `null` before): it now bakes the
  accumulated matrix into the rings and returns a `{leaf,rings}`, so projection works both
  standalone (flat slab via `flat2DMesh`) and under an extrude (push-down prism).

### Not done (deferred)
Rings are raster-traced so curved outlines are polyline approximations (resolution-bounded, not
exact polygons); `projection` of `import`ed meshes waits on Phase 10. Offset of boolean regions
and the conformance harness (Phase 13) still open.

---

# HANDOFF — `text()` font shaping (Phase 9 tail)

**Status: ✅ SHIPPED (this session).** `text(...)` now renders (bare 2D slab + under
`linear_extrude`/`rotate_extrude`). Verified via `eval_js`: `linear_extrude(4) text("CAD",
halign="center")` → 1 mesh / 1476 tris, correct bbox; bare `text("Hi")` → flat slab; unknown
`font=` falls back to the bundled face with no crash.

### How it works
- **Engine** (`scad-engine.js`): `text()` emits `{kind:'primitive2d', shape:'text', rings:[],
  params:{text,size,font,halign,valign,spacing,direction}}` — no font work (engine stays pure/sync).
- **Editor** (`Editor.dc.html`): loads **opentype.js** (CDN, like three) + a vendored variable
  **Roboto** (`public/Roboto-Regular.ttf`, opentype reads the default instance). `runAdvanced`
  collects text nodes, `await ensureFont()`, shapes each via `textToRings()` (glyph paths →
  flattened beziers → y-up rings, with `halign`/`valign`/`spacing`), assigns `node.rings`, THEN
  realizes — so text flows through the existing 2D pipeline unchanged.
- **Multi-region fix:** replaced single-outer `ringsToShape` with `ringsToShapes()` (even-odd
  containment → multiple `THREE.Shape`s, holes assigned to nearest enclosing outer) + `mergeGeos()`.
  `linearSolid` now extrudes/merges every region, so multi-glyph text and disjoint polygons work.
  This also fixes disjoint `polygon(paths=...)`.

### Not done (deferred)
Multiple font *families* (only Roboto bundled — `font=` warns-free fallback), `$fn`-driven curve
quality (fixed 8-step flatten), RTL/`direction`, `text` metrics exactness vs. real OpenSCAD.

---

# HANDOFF — Phase 9: 2D subsystem + extrusions (+ hull/minkowski)

**Status: ✅ SHIPPED (this session).** The 2D pipeline + extrudes are live and verified by
GPU pixel-readback (the WebGL viewport can't be DOM-screenshotted). hull/minkowski upgraded
from "union fallback" to real geometry via `ConvexGeometry`.

### Feature restated
Render `circle / square / polygon` (2D), `linear_extrude / rotate_extrude` (2D→3D),
`offset / projection`, 2D booleans/transforms, and real `hull() / minkowski()`.

### Architecture (how it fits the existing two-rep model)
- **Engine** (`scad-engine.js`) stays THREE-agnostic and now emits two new node kinds plus a
  `dim` tag (2 or 3) on every node:
  - `{ kind:'primitive2d', shape:'circle'|'square'|'polygon', rings:[[[x,y],…],…], matrix, dim:2 }`
  - `{ kind:'extrude', mode:'linear'|'rotate', params:{…}, children:[…2D subtree…], matrix, dim:3 }`
  - `{ kind:'offset2d', params:{r,delta,chamfer}, children, matrix, dim:2 }`
  - `{ kind:'projection', params:{cut}, children, matrix, dim:2 }`
  - `hull` / `minkowski` now emit real `kind:'op'` nodes (were `union`).
  - `circle` is tessellated to an N-gon ring using the same `$fn/$fa/$fs` resolver.
- **Editor** realizes the new nodes by reusing what's already loaded:
  - **2D booleans under an extrude → 3D CSG on extruded prisms.** `linear_extrude(h)
    difference(){A;B}` ≡ `difference(){ linear_extrude(h)A; linear_extrude(h)B }`. Valid for
    linear & rotate extrude (equal z-range / shared axis), so we push the extrude down to each
    2D leaf, build a Brush per leaf (ExtrudeGeometry / custom twist-scale loft / Lathe), and
    combine with three-bvh-csg — **no 2D polygon clipper needed**.
  - `collect2D(node, mat)` walks the in-extrude 2D subtree, baking the in-extrude transforms
    into each leaf's ring points (2D matrix apply), preserving the op/group structure.
  - **Standalone 2D** (a 2D node not under an extrude) renders as a flat double-sided
    `ShapeGeometry` sheet in the XY plane (what OpenSCAD shows for bare 2D).
  - **hull / minkowski** via `three/addons/geometries/ConvexGeometry.js` (ConvexHull):
    hull = convex hull of all descendant vertices; minkowski = hull of pairwise vertex sums
    (exact for convex operands, approximates concave — logged).
  - **offset**: basic per-ring offset (round for `r`, miter for `delta`) on a single contour;
    offset of a boolean region is passed through with a warn (needs a 2D clipper — deferred).

### Build order
1. Engine: 2D primitives + extrude/offset/projection nodes + `dim` tagging + real hull/mink ops.
2. Editor: import ConvexGeometry; `collect2D`; extrude realize (linear/rotate) w/ 2D-CSG;
   flat 2D sheet; hull/minkowski via ConvexGeometry; offset (basic).
3. Verify via `eval_js(window.ScadEngine.run(src))` (node shapes/dims) + mesh counts in scene.

### Done / partial this session
- [x] engine 2D nodes + dims   - [x] linear_extrude (twist/scale loft)   - [x] rotate_extrude (full+partial)
- [x] 2D booleans (3D-CSG push-down)   - [x] flat 2D slab   - [x] hull/minkowski (ConvexGeometry)
- [~] offset (basic single-contour)   - [~] projection (node emitted, render TODO)   - [ ] text (warn — needs fonts)

### Verified (eval_js on window.__editor.runAdvanced + GPU readPixels)
circle/square/polygon, linear_extrude (incl. twist=300 scale=0.15 loft), rotate_extrude
(full torus + 270° partial w/ caps), `linear_extrude difference(){circle;circle}` washer,
offset, hull (sphere+cube), minkowski (rounded box), and a `for`-loop of twisted extrudes —
all produce lit geometry (16–29% viewport coverage) with no console errors.

---

# HANDOFF — Real OpenSCAD interpreter (Phases 0–7 core slice)

**Status: ✅ SHIPPED (this session).** The interpreter (`scad-engine.js`) + editor wiring are
live: simple programs stay GUI-editable; advanced programs (cones, all transforms, math,
loops, `if`/`let`, user modules & functions, list comprehensions, color, modifiers) evaluate
and render **read-only** with an evaluated Model Tree, a read-only badge, and an echo/warn/
error console. See CLAUDE.md for the per-phase scoreboard (Phases 0,1,4,6,7,11 done; 2,3,5,8,12
partial). **Next major lift: Phase 9 (2D subsystem + extrusions).**

**Task (original):** replace the regex parser with a real interpreter so the viewer can **render**
arbitrary OpenSCAD, not just the GUI subset. This handoff covers the foundational slice:
Phase 0 (lexer/parser/AST) + 1 (values/operators) + 2 (scopes/special vars/echo/assert) +
3 (built-in functions) + 4 (primitives incl. cone & polyhedron) + 5 core (translate/rotate/
scale/mirror/multmatrix/color) + 6 (booleans) + 7 core (for/if/let/intersection_for, user
modules & functions, children). Deferred to later turns: 2D subsystem + extrudes (Phase 9),
hull/minkowski/offset (Phase 5 tail), list comprehensions (Phase 8), import/surface/include
(Phase 10), modifier render styling polish (Phase 11), conformance harness (Phase 13).

See `CLAUDE.md` for the durable phase scoreboard — update its checkboxes when a phase lands.

## Architecture decision

**Standalone engine module `scad-engine.js`** (plain JS, dependency-free, no THREE). It does
`lex → parse → evaluate` and emits an **abstract geometry tree** (GeomNode). The Editor DC
imports it (`<x-import component-from-global-scope="ScadEngine" from="./scad-engine.js">` is
not needed since it's not a component — instead load it in `<helmet>` as a plain
`<script src="scad-engine.js">` so `window.ScadEngine` is available) and *realizes* the geom
tree into THREE meshes / three-bvh-csg brushes with matrices baked in. Keeping geometry
abstract makes the engine unit-testable via `eval_js(window.ScadEngine.run(src))` with zero
rendering.

### GeomNode (engine output, THREE-agnostic)
```
{ kind:'primitive', type, params, matrix:[16], color?, mod? }     // cube/sphere/cylinder/polyhedron
{ kind:'op', op:'union'|'difference'|'intersection'|'hull'|'minkowski', children, matrix, color?, mod? }
{ kind:'group', children, matrix, color?, mod? }                   // implicit union container
```
- `matrix` = column-major 16-float (same convention as THREE.Matrix4) accumulated from the
  enclosing transforms; the engine bakes transform stack into each node's `matrix`.
- `color` = `[r,g,b,a]` (0–1) inherited down until overridden.
- `mod` = modifier char on this subtree: `'disable'|'root'|'highlight'|'background'` (Phase 11).
- 2D primitives (Phase 9) will add `kind:'primitive2d'` + `kind:'extrude'` later.

### Engine internals
- **mat4** mini-lib (identity/multiply/translate/rotateAxis(deg)/rotateXYZ(deg)/scale/mirror).
- **lex(src)** → tokens: numbers (`1e3`,`.5`,`1.5`), strings (`"..."` w/ escapes), idents,
  `$`-idents, punctuation/operators (incl. `<=,>=,==,!=,&&,||,**`-no, `^`), `//` + `/* */`.
- **Parser** (Pratt for expressions):
  - precedence: `?:` < `||` < `&&` < equality < relational < `+ -` < `* / %` < unary `! - +`
    < `^` (right-assoc) < postfix `[] .` / call.
  - expr AST: num/str/bool/undef, ident, vector `[…]`, range `[a:b]`/`[a:s:b]`, index, dot,
    unary, binary, ternary, call, `let(...)expr`, lambda `function(x) expr`.
  - stmt AST: assign, echo, assert, moduledef, functiondef, call(name,args,children-block),
    for, intersection_for, if/else, let-block, modifier(char,stmt), include/use (parsed, noop).
- **Evaluator**:
  - Scope = `{vars:Map, parent}`. Per block: hoist+evaluate assignments (source order,
    last-wins) and register module/function defs, THEN execute child statements in order to
    build geometry. Forward refs to fns/modules work via hoist.
  - Values: JS number, boolean, string, `undefined`(=undef), Array(vector), `{__range}`,
    `{__fn}` (function literal/closure).
  - Special vars resolved from scope: `$fn`(0=auto) `$fa`(12) `$fs`(2) `$t`(0) `$preview`(true)
    `$children`. `fragments(r)` = `$fn>0 ? max($fn,3) : ceil(max(min(360/$fa, r*2*PI/$fs),5))`.
  - Builtins (Phase 3): `abs sign sin cos tan asin acos atan atan2 floor round ceil ln log
    pow sqrt exp min max norm cross len concat lookup str chr ord search rands
    is_undef is_bool is_num is_string is_list is_function version version_num`. Trig in degrees.
  - Geometry builtins → GeomNode: `cube sphere cylinder polyhedron` (Phase 4);
    `translate rotate scale mirror multmatrix color union difference intersection` (Phase 5/6);
    `for intersection_for if let` produce/combine children (Phase 7). Unknown/2D builtins →
    push a warning, render nothing.
  - User modules: bind args (positional + named + defaults), set `$children`/`children([i])`
    to the instantiation's evaluated child geom, expand body. User functions + lambdas:
    eval expr in arg-bound scope. Recursion via scope chain (guard depth ~ 100k ops).
  - `echo`→echos[]; `assert(false)`→error (halts that subtree, logged).
- **run(src, opts)** → `{ geom:GeomNode[], echos:[], warnings:[], errors:[], ast }`.

## Editor wiring
1. Load `scad-engine.js` in `<helmet>`.
2. On **Run**: `ScadEngine.run(code)`.
   - **Simple-program detector** `isSimpleProgram(ast)`: only top-level numeric assigns +
     `translate`-wrapped or bare `cube/cylinder/sphere` + `union/difference/intersection`
     groups. If simple → keep today's GUI hydrate path (`parseScad`, editable).
   - Else → **read-only evaluated render**: `realizeGeom(geom)` builds meshes (matrix baked
     via `geometry.applyMatrix4`), booleans via three-bvh-csg, color/mod materials. Set
     `state.readOnly=true`, show status chip "read-only — advanced features", disable gizmo +
     edge tools + inspector edits, populate Model Tree from the geom hierarchy (view only).
3. **Console panel**: bottom-left collapsible; lists echos (gray), warnings (amber), errors
   (red) with the offending source line when known. Toggle button in toolbar.
4. Keep all existing GUI behavior intact for simple programs (regression guard).

### realizeGeom (Editor side)
- primitive → `primGeometry(type, params, $fn)` (cube Box; sphere Sphere(fragments); cylinder
  Lathe/Cylinder w/ r1≠r2 cone; polyhedron BufferGeometry from points/faces fan-triangulated)
  → `applyMatrix4(node.matrix)` → Mesh (or Brush for boolean parents).
- op union/intersection/difference → recursive brushes (reuse evalBrush pattern), result Mesh.
- hull/minkowski → warning + fall back to union of children (visually approximate) this turn.
- color → material color/opacity; mod highlight/background → tinted/ghost materials; disable →
  skip; root → render only that subtree.

## Build order (verify each via eval_js on window.ScadEngine)
1. mat4 + lexer.  Verify token stream of a mixed snippet.
2. Pratt expression parser + a tiny expr evaluator.  Verify `2+3*4^2 == 50`, vectors, ranges,
   `[1,2,3]*2`, `v.x`, `a[1]`, `cond?x:y`, `let(a=2)a*a`.
3. Statement parser → AST.  Verify a module def + for + if parse without error.
4. Evaluator: scopes + builtins + geometry builtins + transforms + booleans.  Verify
   `run('translate([10,0,0]) rotate([0,0,45]) cube(5);').geom[0].matrix` and a difference.
5. for/if/let/intersection_for + user modules/functions + children.  Verify a `for` ring of
   cubes (N children) and a user module instantiated twice.
6. Editor: import + detector + realizeGeom + read-only render + console panel.
7. Regression: existing simple GUI programs still hydrate & stay editable.

## Verification notes
- Engine is pure data → test with `eval_js(JSON.stringify(window.ScadEngine.run(src)))` (strip
  the `matrix` floats or round them). The **WebGL viewport can't be screenshotted** — verify
  rendering functionally (count meshes in scene, check geom tree), DOM chrome screenshots fine.
- When a phase lands, tick its boxes in `CLAUDE.md` and add a short DONE note here.

---

## ✅ DONE (prior sessions) — see bottom of file for details
Variables/parametric dims · Sphere + nestable U/D/I boolean groups w/ live CSG · draggable
floating panels. (Full notes retained below.)
