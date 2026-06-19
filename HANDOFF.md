# HANDOFF — Close all Phase 0–12 open items: resize() + offset of boolean regions (Phase 5/9) — ✅ SHIPPED (v0.14.0)

Closed the last three non-Phase-13 boxes on the roadmap. Engine + editor change.

1. **`resize([x,y,z], auto)`** — was a warn-only no-op. Engine now emits `{kind:'resize',
   params:{newsize, auto[]}}`; the editor realizes it (`resizeBrush`) by building the child's union
   brush at identity, reading its geometry bounding box, and applying a per-axis scale so the bbox
   matches `newsize`. A `0`/omitted axis stays unscaled unless its `auto` flag is set, then it takes
   the first explicitly-sized axis's factor (proportional). Scales about origin; works inside booleans
   (geomBrush branch) and shows as a "Resize" group in the Model Tree. Verified via bbox readback:
   `resize([30,20,5]) cube(10)`→[30,20,5] exact; `resize([30,0,0],auto=true) cube(10)`→[30,30,30];
   `resize([40,0,0]) sphere(10)`→[40,20,20].

2. **`offset()` of a boolean region** — single-contour offset stayed analytic (`offsetRings`, crisp
   miter/round); a boolean-region child used to pass through unchanged. Now `applyOffsetTree`
   rasterizes the region (`treeInside` predicate over the collect2D op-tree → coverage grid),
   runs a chamfer **distance transform** (`distanceField`), grows (`r>0`/`delta>0`) or shrinks
   (`<0`) the mask by the offset distance, and re-traces with the existing `marchSquares`. Round
   joins, multi-region + holes supported (exact joins would need a 2D clipper — noted). Verified:
   `offset(r=3) difference(){square([20,20],c);circle(6)}`→~26mm outer (raster ≈25.8, ~0.6%);
   `offset(r=-2)` of a union shrinks 20→~16. No console errors.

3. **Phase 2 special vars** — verified already-complete (`$t` drives dims, `$children`=2 in a
   user module, `$vp*` read echoes the live camera, `$vpd=` write reports `assigned`); flipped to `[x]`.

**Scoreboard:** Phases 2, 5, 9, 10, 12 headers now `[x]`. Every Phase 0–12 box is checked. Only
**Phase 13 (conformance harness)** + the optional openscad-wasm differential check remain.

### Deferred
Raster offset of boolean regions approximates curves/joins (resolution-bounded, like `projection`);
`delta`/`chamfer` joins on a boolean region render round. resize of purely-2D children isn't special-cased.

---

# HANDOFF — 3MF / AMF mesh import (Phase 10) — ✅ SHIPPED (v0.13.0)

`import("file.3mf")` and `import("file.amf")` now render, flowing through the **same mesh pipeline
as STL/OFF** (triangle-soup `Float32Array` → `_imports` store → `importGeometry`/`importMesh`,
booleans via three-bvh-csg with zeroed uv). Editor-only change — engine already emitted the
`{kind:'import', ext}` node. Verified via `eval_js` with synthetic files: 3MF (stored **and**
raw-deflate ZIP entries) → 4-tri tetra, vertices indexed correctly; AMF (plain XML) → 2 tris; an
injected 3MF renders read-only with **no import warnings**.

### How it works (Editor.dc.html only)
- `parse3MF(buffer)` (async): `unzipEntries` → find `*/3dmodel.model` → `meshXmlToPositions(xml,'3mf')`.
- `parseAMF(buffer)`: `PK` magic → unzip + find `*.amf`; else decode XML directly → `meshXmlToPositions(xml,'amf')`.
- `meshXmlToPositions`: DOMParser over every `<mesh>`. 3MF: `<vertex x/y/z>` + `<triangle v1/v2/v3>`.
  AMF: `<vertex><coordinates><x/y/z>` + `<volume><triangle><v1/v2/v3>`. Merges all meshes (per-mesh
  vertex indexing); returns a flat triangle-soup `Float32Array`.
- `unzipEntries(buffer)`: minimal pure-JS ZIP reader (EOCD scan → central directory → local headers).
  Method 0 (stored) sliced directly; method 8 (raw deflate) inflated via `inflateRaw` =
  `DecompressionStream('deflate-raw')`. No zip64.
- `loadImportFiles` now dispatches `.3mf`→`parse3MF`, `.amf`→`parseAMF`, `.off`→`parseOFF`, else STL,
  and **awaits parsers that return a Promise** (the async unzip path). Accept/drop filters + the
  "Import mesh" button title + the unsupported-format warning all widened to include 3MF/AMF.

### Not done (deferred)
3MF build-item / component transforms and AMF units are ignored (common single-object, identity-transform
case is exact); 3MF color/material resources not read. Offset of boolean regions and the conformance
harness (Phase 13) remain.

---

# HANDOFF — Global `$fn` UI control (Phase 12) — ✅ SHIPPED (v0.12.0)

The bottom status-bar `$fn` chip is now an interactive picker (Auto / 16 / 24 / 32 / 48 / 64 / 96 / 128).
Picking a value sets `state.fn` and re-applies: advanced (read-only) programs re-evaluate with the new
value passed as the engine's global `$fn` default; simple GUI programs re-tessellate (`rebuildScene`)
and refresh the `$fn = …` line in the generated code. **Fixed the long-standing no-op** on the run path
(`$fn: this.state.fn && this.state.fn < 100 ? 0 : 0` always passed `0`) → now passes `this.state.fn`.
"Auto" (0) means the engine falls back to `$fa`/`$fs`; a program's own top-level `$fn=` still overrides
the global (hoisted assignment wins). Editor-only change. Verified via `eval_js`: menu toggles;
`setFn(0)`→`state.fn=0`, `gfn()=64` (GUI preview floor); `run('sphere(10)',{$fn:8})`→`params.$fn=8`,
`{$fn:128}`→`128`; `'$fn=64; sphere(10)'` with global 8 → `64` (override). GUI lathe/cylinder builders
use `gfn()` so Auto never feeds 0 segments.

- **State:** `fn` (default 48; 0 = Auto), `fnMenuOpen`.
- **Handlers:** `toggleFnMenu`/`closeFnMenu`/`setFn(v)`; `gfn()` = `fn>0 ? fn : 64` (GUI tessellation floor).
- **renderVals:** `fnVal` ('auto' when 0), `fnBtnStyle`, `fnOptions` (label/active/onClick/style), `fnMenuOpen`.
- **Deferred:** per-call `$fa`/`$fs` UI; the picker doesn't surface a free numeric entry (preset list only).

---

# HANDOFF — Code-editor line gutter + error markers (Phase 12) — ✅ SHIPPED (v0.11.0)

The code drawer's `<textarea>` now has a **scroll-synced line-number gutter**; lines the engine
reports an error on are marked red (bold red number + faint red row tint + a red bar on the gutter's
inner edge). Editor-only change. Verified via `eval_js`: `cube(;` on line 4 → `errorLines:[4]`, gutter
row 4 tinted/barred, console error `… (line 4)`; fixing the program clears all markers (`errorLines:[]`,
0 tinted rows); numbers stay aligned (textarea soft-wrap disabled with `white-space:pre`, gutter
shares font/line-height/top-padding and tracks `scrollTop` on the textarea's `onScroll`).

- **State:** `errorLines: []`; `finishAdvanced` sets it from `res.errors` lines (>0) and carries `line`
  on each console-log row; the simple-program path and `exitReadOnly` clear it.
- **renderVals:** `gutterRows` = `state.code` line count → `{n, isError, style, barStyle}` via the
  errorLines set (re-renders live as you type); `setGutter`, `onCodeScroll`.
- **Deferred:** in-textarea squiggles/tooltips (gutter only); warnings aren't line-marked (most carry
  no line); global `$fn` UI control is still the remaining Phase 12 box.

---

# HANDOFF — Code-editor line gutter + error markers (Phase 12) — IN PROGRESS (target v0.11.0)

**Feature:** the code drawer's plain `<textarea>` gains a **scroll-synced line-number gutter**, and
lines the engine reports an error on are **marked red** in the gutter (red bold number + faint red
row tint + a red bar on the gutter's inner edge). The engine already attaches `line` to every parse
and evaluate error (`e.line`, surfaced as `res.errors[i].line`); this just plumbs it to the UI.

**Build order (Editor.dc.html only):**
1. [ ] State `errorLines: []`. finishAdvanced sets it from `res.errors` (lines > 0); the simple-program
       path and `exitReadOnly` clear it. Carry `line` on each console-log entry too.
2. [ ] Template: wrap the textarea in a flex row — a `ref`'d gutter `<div>` (overflow hidden, matched
       font/line-height/top-padding) + the textarea (now `white-space:pre; overflow:auto`, transparent
       bg, `onScroll` syncs `gutter.scrollTop`). One gutter row per source line.
3. [ ] renderVals: `gutterRows` = `state.code` lines → `{n, isError, style, barStyle}` using the
       errorLines set; `setGutter`, `onCodeScroll`.
4. [ ] Verify: a syntax error (`cube(;`) marks its line red in the gutter + console; fixing it clears
       the marker; line numbers stay aligned while scrolling a long file; soft-wrap disabled so 1
       source line = 1 gutter row.

---

# HANDOFF — DXF 2D import (Phase 10) — ✅ SHIPPED (v0.10.0)

`import("file.dxf")` now renders, flowing through the **same pipeline as SVG** (`primitive2d`
shape `import`, `dim:2`; rings parsed editor-side at load, stored in the shared `_svg` map,
attached at run). Editor-only change — `parseDXF` + helpers, the `.dxf` warning short-circuit
removed, drop/file-input/accept widened. Verified via `eval_js`: a 4-`LINE` square chains to one
closed ring → `linear_extrude(3) import("plate.dxf")` renders an exact 20×20×3 solid; `CIRCLE`,
closed `LWPOLYLINE`, `LWPOLYLINE` w/ bulge=1 (→ full circle, 49 pts), and full `ELLIPSE` each
parse to one ring; no console errors.

### How it works (Editor.dc.html only — engine already emitted the dxf node)
- `parseDXF(text)`: reads the ASCII `ENTITIES` section as group-code/value pairs, splits into
  entity blocks. `LINE`→2-pt open seg; `ARC`→open arc; open/closed `LWPOLYLINE` (10/20 verts,
  42 bulge, 70&1 closed); old-style `POLYLINE`/`VERTEX`/`SEQEND` (second re-walk pass); `CIRCLE`
  & full `ELLIPSE`→closed rings, partial→open seg; `SPLINE`→polyline through fit (11/21) else
  control (10/20) points. **No Y-flip** (DXF is y-up). Binary DXF detected & skipped.
- `chainDxfSegments`: joins open segments end-to-end by endpoint match (tol = bbox-diag·1e-4)
  into closed rings — how separate LINE/ARC entities become a polygon outline.
- `arcFromBulge` + `circleFrom3`: bulge → arc via circumcircle-through-apex (sign-robust).
- `loadSvgFiles` dispatches `.dxf`→`parseDXF`, else `parseSVG`; both store into `_svg`. Drop,
  file input `accept`, and the toolbar button title now include DXF.

### Not done (deferred)
Bulge on old-style `POLYLINE` arcs uses the same sampler (fine); `INSERT` block references and
the `BLOCKS` section are skipped (only the `ENTITIES` section is read); `TEXT`/`DIMENSION`/`POINT`
ignored. 3MF/AMF (zip/xml meshes), offset of boolean regions, and the conformance harness remain.

---

# HANDOFF — DXF 2D import (Phase 10) — IN PROGRESS (target v0.10.0)

**Feature:** render `import("file.dxf")` — the last gap in the 2D import trio (SVG already ships).
DXF flows through the **exact same pipeline as SVG**: the engine already emits a `primitive2d`
(shape `import`, `dim:2`, `ext:'dxf'`); the editor parses the DXF at load into 2D rings, stores
them in the shared `_svg` map, and attaches them at run (sync). No engine change needed — only
the editor's DXF warning short-circuit is removed and a `parseDXF` added.

**DXF scope (ASCII R12+ DXF):**
- Read the `ENTITIES` section (group-code/value pairs). Coordinates are already y-up (CAD math
  orientation) → **no flip** (unlike SVG).
- Entities → contours:
  - `LINE` (10/20→11/21) → 2-pt open segment.
  - `LWPOLYLINE` (10/20 verts, 42 bulge per-vert, 70&1 closed) → polyline, bulge arcs sampled.
  - `POLYLINE`/`VERTEX`/`SEQEND` (old style, 10/20 per VERTEX, 70&1 closed) → polyline + bulge.
  - `CIRCLE` (10/20 center, 40 r) → closed ring.
  - `ARC` (10/20, 40 r, 50 start°, 51 end°, CCW) → open arc segment.
  - `ELLIPSE` (10/20 center, 11/21 major-axis vec, 40 ratio, 41 start, 42 end param) → ring/arc.
  - `SPLINE` → polyline through fit pts (11/21) else control pts (10/20); 70&1 closed.
  - `POINT/TEXT/DIMENSION/INSERT` → skipped (INSERT block refs unsupported — noted).
- **Endpoint chaining:** open segments (LINE/ARC/open polylines) are joined end-to-end by
  matching endpoints (tolerance) into closed rings — how real DXF outlines (many separate
  LINE/ARC entities) become polygons. `chainDxfSegments`.
- Bulge → arc via circumcircle-through-apex (`arcFromBulge` + `circleFrom3`), robust on sign.

**Build order:**
1. [ ] `parseDXF(text)` + `arcFromBulge`/`circleFrom3`/`chainDxfSegments` (editor).
2. [ ] `loadSvgFiles` dispatches `.dxf` → `parseDXF`, else `parseSVG` (shared `_svg` store).
3. [ ] Drop/file-input/accept + button title accept `.dxf`; remove the "DXF not parsed yet" warn.
4. [ ] Verify via `eval_js`: LINE-chain square, LWPOLYLINE w/ bulge, CIRCLE, ARC chain, ELLIPSE;
       `linear_extrude(2) import("x.dxf")` renders; missing file warns.

---

# HANDOFF — SVG 2D import (Phase 10) — ✅ SHIPPED (v0.9.0)

`import("file.svg")` now renders. The engine emits a `primitive2d` (shape `import`, `dim:2`) so
SVG flows through the existing 2D→extrude/boolean pipeline (same path as `text`). The editor
parses the SVG at load into 2D rings and attaches them at run (sync), like text shaping:
- `Editor.parseSVG` (DOMParser): walks `path` (full `d` grammar M/L/H/V/C/S/Q/T/A/Z with
  cubic/quad bezier + endpoint-arc flattening), `rect`, `circle`, `ellipse`, `polygon`,
  `polyline`; composes nested `<g transform>` (translate/scale/rotate/matrix/skewX/skewY);
  Y-flips to OpenSCAD (y-up) using the viewBox/height. Skips `defs`/`clipPath`/`mask`.
- Loaded via the drag-drop / "Import mesh" provider (`.svg`); auto-appends
  `linear_extrude(2) import("…");`. Listed in the chip strip with path count + remove.
- Multiple contours feed the even-odd region builder (holes work, as with `text`).
Verified: rect/circle/polygon/path(cubic+arc)/`<g>` parse; Y-flip correct; extrudes + renders.
DXF still logs "not parsed yet".

---

# HANDOFF — language gaps: C-style comprehension + assign() + parent_module — ✅ SHIPPED (v0.8.0)

Three small engine-only additions (all in `scad-engine.js`), verified via `ScadEngine.run` echo:
- **C-style list comprehension** `[ for (init; cond; next) expr ]`: parser detects `;` after the
  first generator and emits a `cfor` comp node; `runComp` inits once, loops while `cond`, applies
  `next` updates **simultaneously** (snapshot then assign) each pass. Op-guarded. Multiple
  comma-separated init/next vars supported. `[for(i=0,j=10;i<j;i=i+1,j=j-2)[i,j]]` → `[[0,10],[1,8],[2,6],[3,4]]`.
- **`assign(a=1,…){…}`** (deprecated): `execStmt` case binds named args into a child scope and
  evaluates the child block as a `let`; emits a deprecation warning.
- **`parent_module(n)` + `$parent_modules`**: `ctx.moduleStack` tracks active module names
  (pushed in `instantiateModule`, popped in `finally`); `$parent_modules` set on each module
  scope = stack depth at entry; `parent_module(n)` returns `stack[len-2-n]`. Top-level call →
  `undef`/`0`; `inner()` under `outer()` → `"outer"`/`1`.

---

# HANDOFF — `$vp*` ↔ camera binding (Phase 12) — ✅ SHIPPED (v0.7.0)

`$vpr/$vpt/$vpd/$vpf` are now live, in both directions, for the advanced (evaluated) render path:
- **Read (camera → $vp\*):** every run passes the live orbit camera into the engine via
  `opts.viewport` — `$vpt`=target, `$vpd`=distance, `$vpf`=fov, `$vpr`=`[90-elev, 0, -90-azim]`
  (Z-up gimbal). Programs that reference `$vp` re-run (throttled) when the view settles, so the
  values track orbiting. `Editor.viewportFromCamera()`.
- **Write ($vp\* → camera):** the engine reports which `$vp*` were assigned at top level
  (`res.viewport.assigned`) plus their evaluated values; `Editor.applyViewport()` inverts the
  mapping and drives the camera/target/fov. Guarded by `_applyingView` so a programmatic camera
  move doesn't trigger the orbit-end re-run. `$t`-driven `$vpr` therefore animates the view.

Verified: read reflects live camera exactly; write round-trips ([60,0,90]/200/[10,20,5]/30);
orbit re-runs only for `$vp`-reading read-only programs; simple programs clear the flag.

---

# HANDOFF — `surface()` heightmaps (Phase 10) — IN PROGRESS

**Feature:** render `surface(file="…dat|png", center, invert, convexity)` — the last
unimplemented core primitive. Mirrors the existing STL/OFF `import()` provider pipeline:
files are loaded editor-side into a store, the engine emits an abstract node, and the
geometry is realized synchronously from the store at render time.

**Semantics (from OpenSCAD manual, locked):**
- **DAT:** whitespace-separated float matrix. Empty lines + lines starting `#` ignored.
  Rows → Y (first row Y=0), columns → X (first value X=0), unit spacing. `invert` ignored.
- **PNG:** grayscale via linear luminance `0.2126R+0.7152G+0.0722B`, scaled 0..100.
  `invert=true` flips (100 − v). Alpha ignored. Row 0 → Y=0 (same indexing as DAT).
- **Solid:** top surface = heightmap grid (R×C verts, (C-1)×(R-1) quads, 2 tris each).
  A flat base one unit below the **minimum** value (`zBase = min - 1`), plus perimeter side
  walls → a watertight closed mesh (required for three-bvh-csg booleans).
- **center=true:** translate X,Y by `-(C-1)/2, -(R-1)/2` (Z not centered).

**Build order:**
1. [x] Engine: replace the `surface` warn with a node `{kind:'surface', params:{file,center,invert,convexity}, dim:3}`.
2. [x] Editor `parseDAT` (sync) + `parsePNG` (async Image→canvas→luminance) → `_surfaces` Map keyed by lc filename.
3. [x] `loadSurfaceFiles` + drag-drop/`Import mesh` accept `.dat`/`.png`; auto-append `surface("…")` like import.
4. [x] `surfaceGeometry(node)` (watertight solid) + `surfaceMesh(node,pm,col)`; realize branch beside `import`.
5. [x] Chip strip lists loaded heightmaps (grid dims as meta) with remove.
6. [x] Verified: DAT solid renders watertight, live CSG; PNG luminance 0..100 + isImage; center;
      intersection of two surfaces resolves via CSG; missing file warns + renders nothing.

**Status: ✅ SHIPPED (v0.6.0).**

---

# HANDOFF — `include` / `use` file loading (Phase 10)

**Status: ✅ SHIPPED (this session).** `include <f.scad>` and `use <f.scad>` now resolve against a
drag-drop `.scad` file provider. Verified via `eval_js(window.ScadEngine.run(...,{files}))`:
`use <lib.scad>` imports only the lib's `function`/`module` defs (3 ring geoms from a loop calling
`ring()`/`add()`, the lib's own top-level `cube` NOT executed); `include <lib.scad>` splices the
whole file inline (lib cube + sphere = 2 geoms, the lib's `WIDTH` var available downstream); a
missing file warns ("file not loaded — drag the .scad file onto the viewport") and the rest still
renders; a self-referencing file is cycle-guarded (no hang, "circular reference skipped").

### How it works
- **Engine** (`scad-engine.js`): new `resolveImports(stmts, files, ctx, stack)` runs in `run()` right
  after parse, before `evalBlock`. `include` → splice the referenced file's full (recursively
  resolved) statement list at that point; `use` → keep only `moduledef`/`functiondef` from it.
  `files` = `{ "basename.scad" (lowercased): sourceText }` from `opts.files`. Recursive, cycle-guarded
  (`stack`), and pushes a one-shot warning per missing/cyclic file. Parse errors in a sub-file are
  prefixed `(file) …`. `isAdvanced` already routes any include/use program to `runAdvanced`.
- **Editor** (`Editor.dc.html`): `this._scadFiles` Map (basename-lower → `{name,key,source,lines}`).
  Drag-drop now splits files by extension — `.stl/.off` → `loadImportFiles`, `.scad` → `loadScadFiles`.
  `runAdvanced` passes `files: this.scadFilesMap()` to `ScadEngine.run`. Dropping a `.scad` into an
  **empty** editor opens it as the main document; otherwise it's registered as a library and the
  model re-runs. Libs appear in the same top-left chip strip as meshes (green code-bracket icon,
  "N lines" meta, × to remove). `removeScad` drops + re-runs.

### Not done (deferred)
A used file's own top-level *variables* aren't visible to its functions (only defs are imported — the
common library case works; `use`d file-scope constants don't). No project-filesystem resolution
(uploads/drag only, in-memory for the session). 3MF/AMF + SVG/DXF import, `surface()`, and the
conformance harness (Phase 13) remain.

---



**Status: ✅ SHIPPED (this session).** `import("…stl"|"…off")` now renders. Verified via `eval_js`
with synthetic meshes: binary + ASCII STL and OFF all parse; a tetra renders (4 tris), transforms
(`translate`/`rotate`), feeds booleans (`difference` w/ cylinder → 275 tris, `union` w/ sphere →
228 tris), `center=true` re-centers; an unknown filename logs "file not loaded"; the drag-drop/
file-input flow loads a `File`, stores it, auto-inserts `import("Name.stl");`, shows a chip, and
renders. No console errors.

### How it works (Editor.dc.html + one engine case)
- **Engine** (`scad-engine.js`): `import` now emits `{kind:'import', params:{file,center,ext,
  convexity}, dim:2|3}` (2D for svg/dxf) instead of warning. `surface` still warns.
- **File provider** (editor): "Import mesh" toolbar button + a hidden `.stl,.off` file input +
  drag-and-drop on the viewport (`attachMeshDrop`). `loadImportFiles` reads each as an
  ArrayBuffer, parses, and stores `{name,positions,tris}` in `this._imports` (Map, **lowercased
  filename key**). `afterImport` appends `import("name");` to the code if not already referenced,
  then re-runs. A chip strip (top-left) lists loaded meshes with a remove ×.
- **Parsers** (pure JS, no libs): `parseSTL` (binary detected by `84 + 50·tris === byteLength`,
  else ASCII `vertex` regex), `parseOFF` (header → verts → fan-triangulated faces). All produce a
  flat `Float32Array` of triangle-soup positions.
- **Realize**: `importGeometry(node)` builds a `BufferGeometry` from the stored positions,
  optionally re-centers (`center=true`), computes normals, **and adds a zeroed `uv`** — required
  so three-bvh-csg can match attributes against the primitives (without it, CSG throws
  `aAttr.array`). Wired into `realizeNode` (`importMesh`) and `geomBrush` (Brush for booleans).
  `collectImportNodes` in `runAdvanced` adds a console warning for missing / unsupported files.
  Model-tree shows imports as a `mesh` leaf.

### Not done (deferred)
3MF/AMF (zip/xml meshes), SVG/DXF (2D import), `surface()` heightmaps, and `include`/`use` file
loading. Imported triangle soup isn't welded — fine for render + CSG, but very large meshes are
unoptimized. A persistence story (imports live only in memory for the session) is open.

---

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
