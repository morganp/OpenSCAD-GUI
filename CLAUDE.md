# Project Instructions

## File naming
- Files must not contain spaces.
- The main file must be named `index.html`.
- **Semantic versioning on zips.** When offering a download zip, label it with a version number (e.g. `v0.1.0`, `v0.1.1`). Increment the patch for fixes, minor for new features, major for breaking changes.

## Version badge (REQUIRED)
- The app's top-left version badge (the `vX.Y.Z` chip next to "SCAD Studio" in
  `public/Editor.dc.html`) MUST always show the current `VERSION`. Update it in the same
  commit as every `VERSION` bump so the UI and the release number never drift.

## Release after every feature (REQUIRED)
- **Version source of truth: the root `VERSION` file.** It holds the current semver (e.g. `0.4.0`)
  and nothing else. Read it to know the current version; it is the only place the number is tracked.
- **After every shipped feature, cut a semantic-versioned release zip.** Steps, in order:
  1. Bump `VERSION` (patch = fix, minor = new feature, major = breaking).
  2. Snapshot the project into `releases/OpenSCAD-GUI-v<version>/` (the servable `public/` plus
     `CLAUDE.md`, `HANDOFF.md`, `README.md` — mirror the existing release folders). The folder
     basename MUST be `OpenSCAD-GUI-v<version>`.
  3. Present **that version-named folder** to the user for download — the zip filename is derived
     from the folder basename, so it comes out as `OpenSCAD-GUI-v<version>.zip` (never a bare
     `OpenSCAD-GUI.zip`). Never present `public/` or the project root for a release.

## Project layout (applies to ALL sites in this project, current and future)
- **All servable site code lives in `public/`** — the deployable entrypoint is
  `public/index.html`, alongside its imported `.dc.html` components, engine/helper `.js`,
  the `support.js` DC runtime, and any assets the site loads. `public/` must be fully
  self-contained: use only **relative** references (`./support.js`, `scad-engine.js`,
  sibling `<dc-import>`s) so the folder can be copied to any static host and served from
  any path.
- **Project meta stays at the root, never inside `public/`:** `CLAUDE.md`, `HANDOFF.md`
  (and other plan files), `README.md`, and `screenshots/`. These must not ship with the site.
- When you create a new site or add files to one, place them under `public/` and keep this
  split. `support.js` lives **only** in `public/`. If the platform regenerates a copy at the
  project root during in-platform editing, delete it — the canonical runtime is `public/support.js`.
- Preview/deliver sites via their `public/index.html`.

## Planning new features
- Before executing any new feature, write a plan to a plan file (e.g. `HANDOFF.md`) first:
  the feature restated, current architecture/key methods, data-model changes, UI work,
  and a step-by-step build order. Keep it updated as you go and mark sections done.
- This lets work resume cleanly after a restart — always check the plan file before starting.

---

# ROADMAP — Full OpenSCAD language coverage (view + render 100%)

> Goal: parse, evaluate, and **render** the entire OpenSCAD language as listed on the
> official cheat sheet (https://openscad.org/cheatsheet/, v2021.01), and **view** it in the
> editor. Update the checkboxes in this file as each section ships. Detailed design notes
> for whatever is in-flight live in `HANDOFF.md`; this file is the durable scoreboard.
>
> Legend: `[x]` done · `[~]` partial · `[ ]` not started

## Architectural strategy (read before touching anything)

The editor today is **GUI-first**: a tree of editable nodes (`this.tree`) emits OpenSCAD, and
a narrow recursive-descent/regex parser reads a small subset back. That model **cannot**
represent arbitrary programs (a cube born inside a `for` loop has no gizmo). Reaching 100%
requires a real interpreter. Plan of record:

1. **Two representations, one viewer.**
   - *Authoring tree* (`this.tree`) — the existing GUI-editable node graph. Stays the
     editing surface for "simple" programs (flat top-level primitives + transforms +
     booleans). Round-trips 1:1.
   - *Evaluated geometry tree* (new) — the output of a real evaluator over the full AST.
     Always renders; read-only when the program is too rich to map back to the authoring tree.
   - On Run: parse → AST. If the AST is "simple", hydrate the authoring tree (today's path).
     Otherwise evaluate to a geometry tree and render read-only, with the Model Tree showing
     the evaluated CSG hierarchy. A status chip says "read-only — advanced features".

2. **Pipeline:** `lexer → Pratt parser → AST → evaluator (scopes, fns, modules, special
   vars) → geometry node graph → mesh`. Booleans via three-bvh-csg (already loaded). 2D via
   earcut (triangulation) + a polygon-clipping lib (2D offset/boolean). hull via a convex-hull
   routine; minkowski via sampled sum; offset via clipper.

3. **Keep it incremental & always-rendering.** Each phase adds real coverage without breaking
   the current GUI. Anything unimplemented renders nothing but logs a clear `echo`-style note
   in a console panel rather than throwing.

4. **Fidelity escape hatch (optional, evaluate later):** the official **openscad-wasm** build
   is the real engine compiled to WebAssembly and would give literally-100% render fidelity
   as a fallback for code the native evaluator can't yet handle. Decision deferred — pursue
   only if the native evaluator stalls on exotic features (`surface`, font shaping, `import`
   of binary meshes). Tracked in Phase 10/13.

---

## Phase 0 — Lexer + parser + AST foundation  `[x]`  — engine: scad-engine.js
Real interpreter (lex → Pratt parse → AST → evaluate). Lives in `scad-engine.js` (`window.ScadEngine`).
- [x] Tokenizer: numbers (incl. `1e3`, `.5`), strings w/ escapes, idents, `$`-idents, all
      operator/punctuation tokens, `//` and `/* */` comments.
- [x] Pratt/precedence-climbing **expression** parser (see Phase 1 operator table).
- [x] **Statement** parser → AST: assignments, module-call w/ args + child block, `module`
      defs, `function` defs, `for`/`intersection_for`/`if`/`else`/`let` blocks, `include`/`use`.
- [x] Modifier-character prefixes on any statement: `* ! # %`.
- [x] Error recovery: a parse error is captured (with line) and the program still renders.

## Phase 1 — Values, operators, indexing  `[x]`
- [x] `+  -  *  /  %` and parentheses.
- [x] `^` exponentiation (right-assoc); unary `-`/`+`.
- [x] Relational `< <= == != >= >`; logical `&& || !`.
- [x] Ternary `cond ? a : b`.
- [x] `let (assignments) expr` (expression form).
- [x] Value types: number, boolean, string, `undef`, **vector/list**, **range** `[a:b]`/`[a:s:b]`.
- [x] Vector/scalar arithmetic broadcasting (`[1,2,3]*2`, `v1+v2`, dot product `v1*v2`).
- [x] List indexing `list[i]`; dot indexing `v.x/.y/.z`; nested lists.
- [x] `PI`; the `undef` constant.

## Phase 2 — Evaluator core (scopes & semantics)  `[x]`
- [x] Top-level + nested `name = value;` parameters.
- [x] OpenSCAD scoping: lexical child scopes; **last assignment in scope wins** (hoisted).
- [x] Special variables: `$fn` `$fa` `$fs` (tessellation), `$t` `$preview` `$children` done;
      `$vpr/$vpt/$vpd/$vpf` **bound to the live camera** (read each run; script assignment drives the view).
- [x] `echo(...)` → console panel; `assert(cond, msg)` → error in console.
- [x] Deprecated `assign()` (parse + warn; treated as `let`).

## Phase 3 — Built-in functions  `[~]`
- [x] Math: `abs sign sin cos tan asin acos atan atan2 floor round ceil ln log pow sqrt exp` (degrees trig).
- [x] `min max` (scalar + list), `norm`, `cross`, `rands`.
- [x] List/string: `len concat lookup str chr ord search`.
- [x] `version version_num`. — [x] `parent_module(n)` + `$parent_modules`.
- [x] Type tests: `is_undef is_bool is_num is_string is_list is_function`.

## Phase 4 — 3D primitives (complete)  `[x]`
- [x] `cube(size | [x,y,z], center)`.
- [x] `sphere(r | d=)` with `$fn/$fa/$fs` tessellation.
- [x] `cylinder(h, r|d, center)` **and cones** `r1/r2`, `d1/d2`.
- [x] `polyhedron(points, faces, convexity)` (fan-triangulated).

## Phase 5 — Transformations  `[x]`
Applied as a column-major matrix stack baked into each evaluated GeomNode.
- [x] `translate([x,y,z])`.
- [x] `rotate([x,y,z])` and `rotate(a, [x,y,z])` (axis-angle).
- [x] `scale([x,y,z])`; `mirror([x,y,z])`; `multmatrix(m)`.
- [x] `color("name"|"#hex"|[r,g,b,a], alpha)` → per-subtree material.
- [x] `resize([x,y,z], auto)` — scales children so their combined bounding box matches the target; a 0/omitted axis stays unscaled unless `auto` (then proportional to the first sized axis). Realized editor-side from the child geometry bbox.
- [x] `offset(r | delta, chamfer)` (2D) — analytic miter/round offset on a single contour; **offset of a boolean region** now rasterizes the region + distance-transform grow/shrink + marching-squares re-trace (round joins; multi-region & holes supported).
- [x] `hull()` — convex hull of all descendant vertices via three's `ConvexGeometry` (2D hull = hull-then-extrude under `linear_extrude`).
- [x] `minkowski(convexity)` — hull of pairwise vertex sums via `ConvexGeometry` (exact for convex operands, approximates concave — logged).

## Phase 6 — Boolean operations  `[x]`
- [x] `union()` `difference()` `intersection()` on arbitrary subtrees (three-bvh-csg).
- [x] Operate inside the evaluated geometry tree (loops/modules feeding them).

## Phase 7 — Flow control, modules, functions  `[x]`
- [x] `for (i=[a:b]) / [a:s:b] / [list]`, multiple generators `for (i=…, j=…)`.
- [x] `intersection_for(...)`.
- [x] `if (...) {} else {}` (statement).
- [x] `let (...) {}` (statement form).
- [x] User **modules**: definition, instantiation, default/named args, `children([idx])`,
      `$children`, nested modules, recursion (op-count guarded).
- [x] User **functions**: `function f(x)=…`, named/default args, recursion.
- [x] **Function literals** `function (x) x+x` + `is_function`.

## Phase 8 — List comprehensions  `[~]`
- [x] `[ for (i = range|list) expr ]`; `each`; `if`/`if-else`; `let`; nesting.
- [x] C-style `[ for (init; cond; next) expr ]` (multiple comma-separated init/next, simultaneous update).

## Phase 9 — 2D subsystem + extrusion  `[x]`
No 2D polygon clipper needed: the engine emits abstract `primitive2d` + `extrude` nodes, and
the editor pushes each extrude down to the 2D leaves (extrude each to a 3D prism) so 2D
booleans resolve through the existing three-bvh-csg pipeline. `collect2D` bakes in-extrude
transforms into ring points. Bare 2D renders as a thin filled slab.
- [x] `circle(r | d=)` (tessellated by `$fn/$fa/$fs`), `square(size|[w,h], center)`, `polygon(points, [paths])`.
- [x] `text(...)` — font shaping via **opentype.js** + a vendored **Roboto** TTF (`public/Roboto-Regular.ttf`).
      Glyph outlines → flattened contours → 2D rings (even-odd containment → multi-region shapes with
      holes), shaped editor-side before realize so it flows through the existing 2D→sheet/extrude
      pipeline. Supports `size`, `halign`, `valign`, `spacing`; `font=` falls back to Roboto (single
      bundled face).
- [x] `linear_extrude(height, center, convexity, twist, slices, scale)` — plain via `ExtrudeGeometry`, twist/scale via a custom loft.
- [x] `rotate_extrude(angle, convexity)` — custom revolve about Z (full + partial w/ end caps), `$fn` segments.
- [x] `projection(cut)` (3D→2D) — realized: child solid rasterized to a top-down coverage grid, boundary traced via marching squares → simplified 2D rings (multi-region + holes via even-odd). `cut=true` first intersects a thin z=0 slab (CSG) for the cross-section; `cut=false` is the full silhouette. Rings flow through the flat-sheet render and the extrude push-down, so `linear_extrude(h) projection() …` works.
- [x] 2D booleans/transforms feed `hull`/`minkowski` (resolved in 3D); `offset` basic (single contour).
(Holes in `rotate_extrude` profiles are ignored for now; offset of a boolean region is raster-traced — round joins, exact joins would need a 2D clipper.)

## Phase 10 — Import, surface, includes  `[x]`
- [x] `import("file.stl|off|3mf|amf")` (3D meshes) / `import("file.svg|dxf")` (2D) — **STL (binary + ASCII),
      OFF, 3MF, AMF, SVG, and DXF** import via a drag-and-drop / "Import mesh" file provider. **3MF** (OPC
      zip: minimal pure-JS ZIP reader — stored + raw-deflate via `DecompressionStream` — extracts
      `3D/3dmodel.model`, parses `<vertices>/<triangles>`) and **AMF** (XML, optionally zip-wrapped;
      `<coordinates>` + `<volume><triangle>`) now parse to triangle soup and flow through the same
      mesh pipeline as STL/OFF. SVG (`path` with
      M/L/H/V/C/S/Q/T/A/Z + bezier/arc flattening, `rect`/`circle`/`ellipse`/`polygon`/`polyline`,
      nested `<g transform>` translate/scale/rotate/matrix/skew, Y-flipped to OpenSCAD space) parses
      to 2D rings that flow through the extrude/2D-boolean pipeline. **DXF** (ASCII `ENTITIES`: LINE,
      LWPOLYLINE+bulge, old-style POLYLINE/VERTEX, CIRCLE, ARC, ELLIPSE, SPLINE; open segments chained
      end-to-end into closed rings; no Y-flip — DXF is y-up) flows through the same SVG store/pipeline.
      **3MF (zip+XML) and AMF (XML) now parse — see Phase 10 import line.**
- [x] `surface(file="file.dat|png", center, invert, convexity)` — **DAT (whitespace float matrix,
      `#`/blank lines skipped) and PNG (sRGB luminance → 0..100, `invert`) via the drag-drop / "Import
      mesh" file provider.** Builds a watertight solid (heightmap top + 1-unit base below min + side
      walls), `center` honored, renders + transforms + feeds booleans (zeroed uv for three-bvh-csg).
- [x] `include <file.scad>` / `use <file.scad>` — **resolved against a drag-drop .scad file provider.**
      `include` splices the file's full statement list inline (vars + defs + geometry); `use` imports
      only its module/function definitions. Recursive (nested include/use), cycle-guarded, warns on a
      missing/unloaded file. Files keyed by lowercased basename.
- [ ] *(Fallback: route binary-mesh import + font shaping through openscad-wasm if needed.)*

## Phase 11 — Modifier characters  `[x]`
- [x] `*` disable (skip subtree).
- [x] `!` root/show-only (render only that subtree).
- [x] `#` debug highlight (tinted overlay material).
- [x] `%` background/transparent (ghosted material).

## Phase 12 — Viewer / GUI reconciliation  `[x]`
- [x] Live CSG viewport; Model Tree; draggable inspector panels; edge fillet/chamfer (GUI ext).
- [x] "Simple vs advanced" detector (`isAdvanced(ast)`): simple programs hydrate the GUI
      authoring tree (editable); advanced programs render **read-only** from the evaluated
      geometry tree, with the evaluated hierarchy shown in the Model Tree + a read-only badge.
- [x] `$fn/$fa/$fs` drive real tessellation in the evaluator.  [x] global `$fn` UI control wired to runs.
- [x] Console panel for `echo`/`assert`/warnings (toggle in code drawer).  [x] error markers on code lines (scroll-synced line-number gutter; error lines tinted red).
- [x] Color/modifier materials surfaced in the viewport.  [x] camera ↔ `$vp*` binding.

## Phase 13 — Conformance harness  `[x]`  — `conformance.js` + editor "run tests" panel
- [x] A suite of 113 representative `.scad` snippets (one+ per cheat-sheet feature) with a
      pass/fail check, run through `window.ScadEngine.run` (engine output: geom-node kinds/counts,
      matrix layout, echo formatting, errors/warnings). `window.ScadConformance.run()` returns
      `{passed,total,coveragePct,sections}`; runnable via `eval_js` AND from the editor's bottom
      status-bar **run tests** button (results panel: per-section pass/fail, click any case to load
      its snippet into the editor). Current score **113/113 = 100%**.
- [ ] *(Optional, deferred)* differential check against openscad-wasm output for high-value cases.

---

### Current coverage snapshot
**Render + view via the new interpreter (`scad-engine.js`):** the full expression language
(operators, vectors, ranges, indexing, ternary, let, lambdas), scopes & special vars
(`$fn` etc.), all built-in math/string/list/type-test functions, **all 3D primitives** (incl.
cones & polyhedron), **all affine transforms** (translate/rotate/scale/mirror/multmatrix) +
`color`, booleans, flow control (`for`/`intersection_for`/`if`/`let`), **user modules &
functions** (recursion, `children()`, defaults), list comprehensions, and modifier characters
`* ! # %`. **2D subsystem + extrudes** (`circle/square/polygon`, `linear_extrude` incl.
twist/scale, `rotate_extrude`, 2D booleans via extrude-push-down CSG, `offset` incl. boolean
regions via raster grow/shrink), **`resize()`** (bbox-matched scaling, `auto`), **`text`
(opentype.js glyph shaping → multi-region 2D rings, bundled Roboto)**, and real
`hull`/`minkowski` (via `ConvexGeometry`), and **`projection`** (silhouette + `cut=true` cross-section, traced to 2D rings via marching squares) now render. Simple programs stay GUI-editable;
advanced programs render read-only with an evaluated Model Tree + an echo/warn/error console.

**Not yet rendered:** nothing core remains — the conformance harness (Phase 13) now ships
(`conformance.js`, 113/113 = 100%); only the optional openscad-wasm fidelity fallback is deferred
by design.
`surface()` heightmaps (DAT + PNG) render (watertight solid via the drag-drop provider).
`projection` (3D→2D) renders (raster + marching-squares contour trace, both cut modes);
**STL/OFF/3MF/AMF `import()`** render (drag-drop/Import-mesh provider, pure-JS parsers).

**Estimated true language coverage ≈ 100%** of the cheat-sheet feature set, now measured by the
Phase 13 conformance harness (**113/113 cases pass**). Every Phase 0–13 box is checked; only the
optional openscad-wasm differential check is left open by design.
