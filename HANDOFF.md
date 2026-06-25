# ===================================================================================================
# BACKLOG — GitHub library import + BOSL2 preset + Thread menu (filed 2026-06-25) — [ ] NOT STARTED
#   (Advanced-mode feature; depends on the Basic/Advanced toggle above)
# ===================================================================================================
# FEATURE (restated): import OpenSCAD libraries straight from a **GitHub repo** so `use`/`include`
# resolve against them. Ship a one-click **"Include BOSL2"** preset (Belfry OpenSCAD Library v2).
# With BOSL2 loaded, expose a curated **Thread / Screws menu** that inserts BOSL2 calls
# (`threaded_rod`, `screw`, `nut`, `screw_hole`, …). All of this lives in **Advanced mode** only.
#
# WHY TRACTABLE: the Phase-10 include/use engine already resolves library files from an in-memory
# `_scadFiles` store (`opts.files`); this feature just FILLS that store from GitHub instead of (only)
# drag-drop, and adds curated insert UI on top.
#
# KEY CAVEAT (must fix first): the current resolver keys files by **lowercased basename**. BOSL2 uses
# subfolder include paths (`include <BOSL2/std.scad>`) and ~100 interdependent files, so the
# include/use resolver + `_scadFiles` map must become **path-aware** (key by normalized relative
# path, fall back to basename) before BOSL2 links. Engine `resolveImports` keying changes too.
#
# BUILD ORDER:
#  1. [ ] Path-aware library store: `_scadFiles` keyed by normalized rel-path (e.g. `bosl2/std.scad`)
#         with basename fallback; engine `resolveImports` matches `<dir/file.scad>` against it.
#  2. [ ] GitHub fetcher: given owner/repo[/ref], fetch the file tree (GitHub API or a pinned release
#         tarball) and pull every `.scad` via `raw.githubusercontent.com` (CORS-OK) into the store.
#         Show progress; cache in memory for the session. Handle rate limits / large repos gracefully.
#  3. [ ] Library panel UI (Advanced only): "Add from GitHub…" (owner/repo/ref field) + an
#         **Include BOSL2** preset button (pinned to a known-good tag). Lists loaded libs w/ remove.
#  4. [ ] Thread / Screws insert menu (Advanced + BOSL2 loaded): curated parametric inserts that emit
#         `include <BOSL2/std.scad> include <BOSL2/threading.scad>` (once) + the chosen call with a
#         small param form (diameter, pitch, length, …). Renders read-only via the engine.
#  5. [ ] Copy + version badge + VERSION bump; release snapshot.
#
# OPEN Q' for the user: (a) which libraries to preset beyond BOSL2 (e.g. NopSCADlib, Round-Anything)?
#   (b) fetch live at runtime each session, or vendor a pinned BOSL2 snapshot into the project so it
#   works offline? (Live = always current but needs network + risks rate limits; vendored = offline +
#   deterministic but adds repo weight.) (c) how deep should the Thread menu go — just threaded rods,
#   or full screws/nuts/washers? RECOMMEND: vendor a pinned BOSL2 for reliability; rods+screws+nuts v1.
# ===================================================================================================

# ===================================================================================================
# BACKLOG — Basic / Advanced authoring mode (filed 2026-06-25) — ✅ SHIPPED v0.39.0
# ===================================================================================================
# A top-bar **Basic | Advanced** segmented toggle (persisted to localStorage, defaults Basic). BASIC
# hides the Parameters toolbar button, the Add-shape flyout's `2D · for extrude` section, and the
# extrude actions (2D shape-panel "Extrude to 3D" buttons + the tree context-menu Linear/Rotate
# extrude items). ADVANCED reveals all of it. Anything that already EXISTS stays editable: the
# Parameters button still shows in Basic when `this.vars.length > 0`, and a loaded program's geometry
# always renders (Basic only hides AUTHORING affordances, never geometry or the read-only view).
# Touch-points (Editor.dc.html): state `mode`; `setMode`; renderVals `advancedMode`/`showParamsBtn`/
# `sshShowExtrude`/`setBasic`/`setAdvanced`/`basicTabStyle`/`advTabStyle`; template gates on the
# params button, the flyout 2D section, the shape-panel extrude block; ctx-menu `nIs2D && advanced`.
# DEFERRED: auto-flip to Advanced on loading a 2D/extrude/param doc (chose "keep params button when
# params exist" instead — simpler, no surprise mode switches).
# ===================================================================================================

# ===================================================================================================

# ===================================================================================================
# HANDOFF — Touch / iPad UX (Backlog B6) — IN PROGRESS (target v0.38.0)
# ===================================================================================================
# FEATURE (restated): the editor's only right-click-dependent surface is the **Model-Tree context
# menu** (group/op/extrude/move/duplicate/delete). On iPad there is no right-click, so that menu —
# and therefore most structural editing — is unreachable. The 3D viewport already works on touch
# (OrbitControls = 1-finger orbit / 2-finger pan+zoom; gizmo + push/pull run on Pointer Events;
# there is NO viewport right-click menu to replace). Floating-panel drag is mouse-only. Make all of
# this touch-usable WITHOUT regressing desktop.
#
# SCOPE (v1):
#  1. [ ] Kebab (⋮) actions button on every actionable tree row — always-visible on-screen
#         affordance that opens the SAME context menu, anchored to the button. Universal (mouse +
#         touch), needs no gesture timing. (normal rows: always; read-only rows: only `root` rows.)
#  2. [ ] Long-press a tree row (touch/pen only) → opens the context menu at the touch point
#         (~480ms, cancel on >8px move or early release; light haptic if available). Mouse keeps
#         right-click. closeCtx ignores a close within 350ms of opening so the release-tap on the
#         full-screen backdrop doesn't instantly dismiss the just-opened menu.
#  3. [ ] Floating panels draggable on touch: startPanelDrag → Pointer Events (pointermove/up/
#         cancel on window) instead of mouse events; the 5 panel headers switch onMouseDown→
#         onPointerDown and get `touch-action:none`.
#  4. [ ] Touch-aware copy: coarse-pointer detection (`matchMedia('(pointer: coarse)')`) → the tree
#         footer hint says "long-press or ⋮ for actions" on touch (reorder via the menu's Move
#         up/down, since HTML5 drag-reorder doesn't fire on touch); right-click wording on desktop.
#  5. [ ] Factor `showCtxFor(id, x, y)` so right-click, kebab, and long-press all open the menu the
#         same way (handles read-only + normal branches); onCtx/openCtx delegate to it.
#  6. [ ] Version badge + VERSION → 0.38.0; release snapshot OpenSCAD-GUI-v0.38.0.
#
# DEFERRED (v2): native touch drag-to-reorder in the tree (rebuild HTML5 DnD on pointer events);
# a dedicated mobile tool palette / bottom sheet; hover-only face overlay hint on touch.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — Model-tree booleans on evaluated (read-only) shapes — IN PROGRESS (target v0.36.0)
#   (Backlog Items 2 + 3, filed 2026-06-24; tackled 2026-06-25)
# ===================================================================================================
# FEATURE (restated): in the read-only/advanced evaluated view, let the user SELECT 2+ arbitrary
# top-level evaluated rows (GUI prims, evaluated subtrees, mixes) and combine them into a
# union()/difference()/intersection()/hull() — by wrapping the selected statements' SOURCE-LINE
# spans in a block and re-running. Item 3 (nestable) falls out for free: a combined block is one
# top-level call statement, so its __src spans the whole block and re-selecting it + combining again
# wraps it in a clean OUTER block (nested, not flattened).
#
# WHY TRACTABLE: same source-splice machinery as read-only delete (row.srcLines {start,end}, 1-based
# inclusive) + read-only group-transform (multmatrix wrap). We extract each selected row's line span,
# remove them, and re-emit them inside one `op() { … }` block at the topmost span's position.
#
# ORDER: difference uses SELECTION order (first selected = base); union/intersection/hull use source
# order. Reordering pure geometry statements is safe (defs/vars stay in place).
#
# BUILD ORDER (all Editor.dc.html):
#  1. [x] Multi-select in read-only: onSelect read-only branch honors meta/ctrl/shift to toggle a root
#         row (with srcLines) into selectedIds; plain click = single. onCtx keeps an existing multi-sel.
#  2. [x] updateGizmo: read-only branch detaches the gizmo when selIds.length >= 2 (combine mode).
#  3. [x] groupReadOnlySelection(op): collect selected root rows' srcLines (absorb preceding
#         //push/pull + @scs-xform marker lines like delete does), bail on overlap, extract bodies,
#         remove all spans, insert one `op(){ <indented bodies> }` block at the topmost span start,
#         re-run. _roReselectTop set so the new combined item re-selects after the run.
#  4. [x] Read-only combine UI: a panel (reuse comboBtn grid) shown when ≥2 root rows selected, +
#         context-menu items "Group as Union/Difference/Intersection/Hull". canCombineReadOnly().
#  5. [x] Copy: read-only badge / tree hint mention multi-select + combine.
#  6. [x] Verified via eval_js: 2 cubes + linear_extrude → multi-select 2 cubes → Group as Union →
#         `union(){ cube; translate cube }` wrapping both, renders, still read-only; Difference uses
#         base-first (selecting cube then sphere → `difference(){ cube; sphere }`); re-select the union
#         row + extrude → Difference → NESTED `difference(){ union(){…}; linear_extrude… }` (Item 3, not
#         flattened); delete on the combined Union row removes the whole block. Also fixed a latent bug:
#         hasShapePanel now gated on !readOnly (selecting a row in read-only no longer pops an empty
#         shape inspector). SHIPPED v0.36.0.
#
# BACKLOG (filed 2026-06-25) — linear_extrude results get NO edge detection for fillet/chamfer.
#   ✅ FIXED v0.37.0. Root cause: evalBrush's extrude branch never set node._rawGeo, so
#   buildGroupEdges bailed (`if (!node._rawGeo) return`) → no edges, no pick proxies; and emitNode
#   hard-coded `isExtrude(node) ? []` so even a stored treatment wouldn't codegen. Fix (Editor.dc.html):
#   (1) extrude branch of evalBrush now sets `node._rawGeo = geom` and runs applyEdgeTreatBrush when
#   treatments exist (before placement); (2) emitNode reads edgeTreatments for extrudes too, routing
#   through emitGroupWithEdges → `difference(){ linear_extrude(...){profile} edge_fillet/chamfer }`.
#   scanET already walked extrude (group) nodes so the edge_* module defs emit. Verified: a square
#   linear_extrude exposes 12 edges (4 top rim + 4 bottom rim + 4 vertical corners), filleting a corner
#   rebuilds the rounded solid and emits a clean difference that round-trips through ScadEngine.run with
#   0 errors. KNOWN LIMIT (shared with boolean edges): a circle extrude's faceted side seams (>8°
#   dihedral) register as extra pickable verticals; rims still chain into one edge. Nested extrudes
#   (inside a boolean) don't expose edges — only top-level, same as boolean groups.
# ===================================================================================================

# ===================================================================================================
# BACKLOG — Smooth circular extrudes + model-tree unions (filed 2026-06-24)
# ===================================================================================================
# Item 1 — Smooth push/pull of circular faces  ✅ SHIPPED v0.34.0–v0.35.1
#   Push/pulling a cylinder/tube face used to dump the marching-squares-traced boundary as a raw
#   polygon → faceted, jaggy re-extrude. v0.34.0–v0.35.0 added analytic circle/arc classification in
#   `faceProfileScad`. v0.35.1 fixed the ROOT cause: faceData now extracts the EXACT mesh boundary
#   edge-loops (faceEdgeRings) — clean N-gon, exact radius/centre, no raster bias — and only falls
#   back to the lossy rasterize+marching-squares trace for non-manifold CSG seams. Low-$fn cylinders
#   now detect/emit correctly instead of dumping a 250-point jaggy staircase.
#
# Item 2 — Model-tree unions for advanced/evaluated shapes  [ ] FUTURE (not started)
#   Today "Group as Union/Difference/Intersection" only works on simple GUI authoring nodes. When the
#   scene is read-only (advanced evaluated tree) you can't select arbitrary evaluated rows and union
#   them. Goal: allow creating a union (and other booleans) from ANY selection — GUI prims, evaluated
#   subtrees, mixes — by wrapping the selected statements' source-line spans (reuse the `__src` /
#   row.srcLines splice machinery already used by read-only delete + group-transform) in a
#   `union() { … }` block and re-running.
#
# Item 3 — Nestable unions  [ ] FUTURE (not started)
#   Unions (and booleans generally) must nest arbitrarily — a union containing a difference containing
#   a union, etc. The authoring tree already nests groups; the gap is the read-only/advanced path and
#   making the source-wrap composition (Item 2) recursive so wrapping an already-wrapped selection
#   produces clean nested blocks rather than flattening or stacking redundant wrappers.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — Group transform on evaluated (read-only) subtrees — IN PROGRESS (target v0.32.0)
# ===================================================================================================
# FEATURE (restated): in the read-only evaluated view, a user can SELECT a top-level item and
# MOVE / ROTATE / SCALE it as a whole group, even though it came from a for-loop / module / etc.
# The whole evaluated subtree moves together (no per-instance edit — that would need rewriting the
# generator). Edits round-trip to source: the statement's lines get wrapped in a single
# `multmatrix(...)` whose matrix accumulates across repeated drags (no nested-wrapper stacking).
#
# WHY THIS IS TRACTABLE (and per-instance isn't): wrapping ONE statement in a transform maps cleanly
# to wrapping its source lines. Editing one generated instance has no source location to write to.
#
# FOUNDATION REUSED: the B2 read-only-delete path already stamps every top-level geom node with a
# source line span (engine `__src` → tree `row.srcLines = {start,end}`, 1-based inclusive) and
# splices source + re-runs. This feature reuses srcLines for the wrap, and the existing transform
# gizmo (this.tc) for the drag.
#
# BUILD ORDER (all Editor.dc.html):
#  1. [x] finishAdvanced: render each TOP-LEVEL evaluated node into its OWN sub-group (was one flat
#         grp). Tag each sub `userData.roTopIndex`; stash in `this._roGroups[topIndex]`. Indices align
#         with the tree rows' `topIndex`.
#  2. [x] updateGizmo: read-only branch — when the selected row is a top-level row with srcLines and
#         a matching sub-group, reset that group to identity and attach the move/rotate/scale gizmo to
#         it (`this._roGizmoRow`). Otherwise detach.
#  3. [x] onGizmoChange/onGizmoEnd: short-circuit in read-only. End → `applyReadOnlyGizmo()`: read the
#         sub-group's local matrix (= delta in SCAD space, since the engine group is identity); if not
#         identity, `applyReadOnlyTransform(row, deltaM4)`.
#  4. [x] applyReadOnlyTransform: find row.srcLines; if those lines are already an `@scs-xform`
#         `multmatrix([...]) { }` wrapper, parse M_old and emit M_new = delta · M_old replacing it;
#         else wrap the body in `// @scs-xform\nmultmatrix(M_delta) {\n  <body>\n}`. Set code + re-run.
#         Reselect the same topIndex after the run so the gizmo stays on the item.
#  5. [x] Matrix helpers: m4ToScad (column-major THREE elements → OpenSCAD row-major nested array,
#         trimmed) + parseScsMultmatrix (regex 16 nums → THREE.Matrix4). multmatrix order: M_new =
#         delta.multiply(M_old).
#  6. [x] Copy: read-only badge + tree hint updated to say top-level items can be moved/rotated/scaled.
#  7. [x] Verify via eval_js: for-loop of cubes → select top row → translate → source gains one
#         multmatrix wrapper, renders moved, bbox shifts; drag again → SAME wrapper, matrix composed
#         (no nesting); rotate + scale compose too; delete still works on the wrapped row.
# ===================================================================================================
#
# BACKLOG — Extrude bugs + UX (filed 2026-06-22, not yet scheduled)
# ===================================================================================================
# Extrude correctness
#   [x] B1. RESOLVED v0.32.1. The literal report ("geometry below z=0 not extruded") no longer
#           reproduces — the engine's collect2D `apply2` uses only x,y of each matrix, so a 2D profile
#           at ANY z extrudes correctly (verified: translate z=-10/-50, center=true, negative height,
#           rotate below plane, rotate_extrude profiles spanning negative Z — all render with correct
#           bboxes). The one real adjacent bug found + fixed: the viewport-only z=0.3 resting lift on
#           authored 2D shapes (so the flat sheet doesn't z-fight the floor) was being BAKED INTO the
#           generated OpenSCAD as `translate([0,0,0.3])`. emitPrimitive now zeroes the emitted z for
#           circle/square/polygon (unless a pz expr is bound) — 2D geometry lives at z=0 in code.
#   [~] B2. Once an extrusion has happened, objects are NO LONGER DELETABLE.
#           PARTIAL FIX v0.31.0: read-only (evaluated) view now supports deleting any TOP-LEVEL item —
#           click its Model-Tree row (or select it) and hit delete/trash; the engine stamps each
#           top-level geom node with its source line span (__src) and the editor splices those lines out
#           and re-runs. Deleting back down to a simple program drops you back into the GUI authoring tree.
#           STILL TODO: delete of NESTED items inside a boolean/extrude (needs sub-statement provenance).
# Model-tree cleanliness
#   [x] B3. Extruding made the Model Tree messy with nested groups. FIXED v0.31.0: serializeGeom now runs
#           a collapse pass — anonymous single-child structural (multmatrix/wrap) groups collapse into
#           their child, empty groups drop, and an extrude/offset/resize/projection over a single 2D leaf
#           folds into ONE leaf row ("Linear extrude  h5 · circle"). One row per real thing.
# Live dimension editing
#   [x] B4. linear_extrude: show an EDITABLE dimension box (height) that live-updates as you drag the
#           extrude, and lets you type an exact value to drive it.  — SHIPPED v0.30.0 (push/pull HUD,
#           deferred commit: drag previews → release shows editable mm box → type+Enter/✓ applies, Esc/✕ cancels).
#   [x] B5. rotate_extrude: same, but an EDITABLE degrees box that live-updates while dragging and is
#           typeable.  — SHIPPED v0.30.0 (same HUD, ° unit, revolve mode).
# Touch / iPad
#   [ ] B6. Investigate a touch UX for devices with no native right-click (iPad): replace right-click
#           context menus / right-drag gestures with long-press, on-screen buttons, or a tool palette.
# ===================================================================================================
#
# HANDOFF — Render regression harness (dev collateral) + `!` modifier fix — ✅ SHIPPED (v0.28.0)
#
# The render battery is DEV COLLATERAL — it lives in `tests/` (NOT `public/`) and is not loaded by
# the shipped app. `tests/render-tests.js` defines `window.ScadRenderTests`; it renders each .scad
# case through the live editor's own `realizeNode` pipeline (its `measure(editor, src)` helper) and
# asserts mesh count + triangle count + world bbox. Run it by injecting the file into a running
# editor and calling `ScadRenderTests.run(window.__editor)` (see `tests/README.md`). Nothing about
# the user-facing editor changed for testing — no buttons, panels, state, or `measureRender` method.
#
# THE ONE SHIPPED CHANGE is a real bug fix the battery caught: the `!` (root/show-only) modifier
# never suppressed siblings — the engine set `arr.__root = true` on the returned ARRAY, which the
# parent block's `out.push(...g)` spread silently discarded. Conformance missed it (its `!` case
# only asserts the subtree renders, not that others are hidden). Fix: engine now tags each NODE
# `n.__root = true`; both render paths (finishAdvanced + the harness) filter ALL `__root` nodes.
# Verified: render battery 36/36, conformance still 113/113, app loads clean with no test UI.
#
# (conformance.js stays in public/ + its status-bar "run tests" button — that was the intentional
#  Phase-13 deliverable; only the new render battery was pulled out as collateral.)
#
# ---------------------------------------------------------------------------------------------------
#
# HANDOFF — Binary STL export — ✅ SHIPPED (v0.27.0)
# The tool could import meshes (STL/OFF/3MF/AMF) and save .scad text, but had no way to get the
# RENDERED model out for 3D printing/slicing. New top-menu "Export STL" button (next to Save .scad)
# downloads model.stl (binary). Editor-only.
#   - exportMeshes(): allSolids() + traverse(_engineGroup) → every rendered solid, EXCLUDING helper
#     overlays (ghost/hinge/face overlay live on the scene directly, not in those collections).
#   - exportSTL(): clone each mesh geo, applyMatrix4(matrixWorld) → world tris (indexed + non-indexed),
#     write 80-byte header + uint32 count + per-tri (computed facet normal + 3 verts + uint16 attr).
#     Same Z-up space as OpenSCAD. Blob('model/stl') → anchor download.
# VERIFIED via eval_js (blob captured, download stubbed): GUI cube → 12 tris, size 684 = 84+12·50,
# round-trips through parseSTL to bbox [-20,-20,0]..[20,20,40]; GUI CSG difference(sphere,cube) →
# 2348 tris; advanced for-loop of 4 cubes (read-only engine group) → 48 tris. All buffer sizes exact.
# DEFERRED: ASCII STL, OBJ/3MF export, per-color export, unit/scale options (STL is unitless mm).
#
# ---------------------------------------------------------------------------------------------------
#
# HANDOFF — Slice 6: Face push/pull — ✅ SHIPPED (linear v0.25.0, revolve v0.26.0)
# REVOLVE (v0.26.0): the push/pull tool now has a Linear | Revolve toggle (floating segmented
# control, top-center, when the tool is active; state.ppMode). In Revolve mode, press-drag a face
# near one of its boundary edges: the nearest boundary edge becomes the hinge axis (highlighted as a
# yellow rod) and horizontal drag sweeps the face around it (0.6°/px, ±360°) — live green ghost +
# live angle readout; release applies a union of the swept solid.
#   - buildRevolveData(face, hitWorld): outer ring's nearest boundary segment → hinge A,W; build a
#     frame Xg = N×W (radial, flipped so the face interior is +Xg ⇒ profile x≥0), Yg = W×Xg (= +N, so
#     +angle sweeps OUTWARD), Zg = W. Face points → profile [x=rel·Xg, y=rel·W]. Returns {profile,
#     M(=makeBasis(Xg,Yg,W)@A), A, W}.
#   - updateRevolveGhost (revolveSolid(profile,{angle,$fn}) · applyMatrix4(M)), showHinge/clearHinge.
#   - applyRevolve: append `multmatrix(M) rotate_extrude(angle=θ,$fn) polygon(points,paths)` (x clamped
#     ≥0; one path per ring → holes) → union via top-level implicit union → runCode → read-only.
#   - movePushPull/startPushPull/endPushPull branch on pp.mode ('linear'|'revolve'); onPointerMove/Down
#     pass the event through for the pixel-delta angle.
# VERIFIED via eval_js: top face of a 40³ cube, hinge = its +X edge (axis W=[0,1,0] ✓), profile x
# 0..40 ✓; revolve 90° → green ghost bbox z 40→80 (flap sweeps up/out); applied → engine 0 errors/
# warnings, render bbox → [-20,-20,0]..[20,20,80], 2 meshes, code carries multmatrix+rotate_extrude(90).
# REVOLVE DEFERRED v2: revolve-as-cut (currently add/union only); explicit edge pick (uses nearest
# boundary segment, so a heavily raster-simplified curved outline gives a coarse hinge); angle
# snapping / numeric entry; direction toggle.
#
# ---------------------------------------------------------------------------------------------------
#
# HANDOFF — Slice 6: Face push/pull (linear) — ✅ SHIPPED v1 (v0.25.0)
# Pick any face of the rendered solid and drag along its normal: out = add material (union),
# in = cut a pocket (difference). Works on BOTH simple-GUI solids and the advanced evaluated
# group (faces are picked off whatever is actually rendered, so the appended code always aligns).
#
# UX: new left-toolbar tool "Push/pull" (cube+arrow icon, shortcut **E**). In the tool, hovering a
# face shows a translucent cyan overlay of the face outline; press-drag projects the pointer onto the
# face normal → live translucent prism preview (green = add / outward, red = cut / inward) + a live
# ±mm readout in the status bar; release applies (≥0.1mm) or cancels. OrbitControls is disabled
# during the drag (pointer captured on the canvas).
#
# PIPELINE (all in public/Editor.dc.html, "SLICE 6: FACE PUSH/PULL" section):
# - ppMeshes(): allSolids() + traverse(_engineGroup) → every pickable result mesh.
# - pickFaceAtPointer(): raycast ppMeshes; clone hit.object.geometry, applyMatrix4(matrixWorld) →
#   world-space geo; pickFace(wg, hit.faceIndex) → {rings2D, frame, normal, center, area} (reuses the
#   existing faceTrisAt/faceData raster+marching-squares face detector).
# - frameMat(face, inward): Matrix4 from face.frame; inward negates the +Z (normal) basis column so
#   the extrude points INTO the solid.
# - showFaceOverlay (ShapeGeometry from rings2D, lifted 0.08 along N), updatePPGhost (linearSolid
#   prism, colored by direction), ppDistance (closest-point of the pointer ray to the normal axis).
# - start/move/endPushPull: drag lifecycle; endPushPull applies if |dist|≥0.1.
# - buildPrismScad(face,dist,inward): `multmatrix([rows]) linear_extrude(height=|d|) polygon(points,
#   paths)` — rings emitted as points + one path per ring (even-odd holes preserved). Rows are the
#   (maybe flipped) frame in OpenSCAD row form.
# - applyPushPull: ADD → append the prism statement (top-level implicit union). CUT → wrap the whole
#   current program in `difference(){ <code> <inward prism> }`. Sets code + runCode() → engine renders
#   read-only.
# - Wiring: onPointerMove/Down/Up branch on state.tool==='pushpull'; pickPush handler; toolbar button
#   (btnPush) + shortcut 'e'; status-bar hint shows the live ±mm; pickSelect/pickMove clear pp ghost.
#
# VERIFIED via eval_js: +X face of a toolbar cube (40³ @ z=20), add +10mm → engine renders 0 errors,
# render bbox x-max 20→30 (others unchanged); top face cut −12mm → program wraps in difference(),
# renders 0 errors, 1 mesh, outer bbox unchanged (interior pocket). Both prisms emit valid OpenSCAD
# that ScadEngine.run evaluates clean.
#
# DEFERRED (v2): rotational push/pull (revolve a face about a chosen boundary edge); numeric distance
# entry / snapping; connectivity-split faces (a face that wraps a concave corner is currently merged
# by coplanarity only); GUI round-trip (push/pull always lands in read-only advanced); picking a face
# whose outline the raster tracer simplifies heavily on tiny features. The Slice-6 face-detection
# foundation (faceClusters notes) is otherwise fully consumed.
#
# ---------------------------------------------------------------------------------------------------
#
# HANDOFF — Slice 5: Boolean-edge fillet/chamfer (simplest useful v1) — ✅ SHIPPED (v0.24.0)
# Verified via eval_js: detection on a stacked/L union → 12/15 convex edges (chained); difference
# notch → 3 concave edges; apply convex fillet r=6 → tris 62→311, bbox preserved (rounds OUTER
# corner, normals correct); 4-edge fillet keeps bbox −20..20/0..50; generated OpenSCAD
# (difference(){union(){…} multmatrix edge_fillet}) round-trips through ScadEngine.run → 0 errors;
# primitive-edge fillet path unchanged (no regression). KNOWN GAP: reentrant concave edges from a
# *union* are missed (CSG T-junction / mismatched tessellation leaves them as 1-tri boundary edges);
# concave from *difference* works. Plus the deferred items below.
#
# (original plan)
#
# GOAL: pick a sharp feature edge CREATED BY a union/difference/intersection group result and apply
# an analytic fillet (round) or chamfer (flat), live + exported to valid OpenSCAD.
#
# APPROACH (reuses the working primitive edge-treatment machinery):
# - detectGroupEdges(geo): from the group's RAW boolean result geometry (group-local), build an
#   undirected edge map (quantized verts), find edges shared by 2 faces whose dihedral > 8deg.
#   convex = dot(nA, apexB - aA) < 0. Per segment store {mid, U=nA, V=nB, len, convex}. The edge
#   tangent E = U×V (always ⟂ both face normals), matching cuboidMaskGeom's basis convention.
# - chainEdgeSegs: greedily chain connected segments with same convex flag + tangent continuity
#   (<35deg) into pickable polylines (straight edges + smooth curves chain; corners split).
# - RENDER: evalBrush stashes node._rawGeo (pre-treatment), then applyEdgeTreatBrush subtracts the
#   convex tools / unions the concave tools. Tool per seg = extruded corner profile placed by
#   basis(U,V,E): convex fillet = square−quarter-disc@origin (subtract); convex chamfer = triangle;
#   concave fillet = square−disc@(r,r) (union); concave chamfer = corner triangle. uv zeroed for CSG.
# - PICK: proxies (invisible cylinders per seg, userData{kind:'groupEdgeProxy',shapeId,edgeId})
#   built for every top-level group, children of node.group, included in allProxies(). Detection runs
#   off _rawGeo so edge ids stay STABLE across rebuilds (treatments applied after stashing) → toggle
#   + reselect work. Hover/select highlight = merged cylinders baked to world via group.matrixWorld.
# - DATA: group.edgeTreatments = { [edgeId]: {type,size,convex,segs:[{mid,U,V,len}]} }. Plain data,
#   serializes clean (syncShapesState picks fields explicitly). _cloneForDup copies it.
# - CODEGEN: emitNode wraps the group's op-block — difference(){op; convexTools} and/or
#   union(){…; concaveTools}, each tool = multmatrix(M) edge_fillet/edge_chamfer/edge_round_in/
#   edge_chamfer_in. Modules emitted on demand. Renders correctly via the advanced engine.
# - DEFERRED v1: fillet doesn't follow live child-dimension edits (stored seg geometry goes stale);
#   group-edge fillets don't GUI-round-trip from a code Run (stay valid OpenSCAD, may drop read-only);
#   concave-only seams in unions still pickable. Iterate later.
#
# ===== KNOWN BUGS (fix later) =====
# BUG-A: ✅ FIXED v0.25.1 — Model Tree panel is now draggable (header has onMouseDown=dragTree via
#        startPanelDrag('tree'); container style = panelStyle('tree', base) → treePanelStyle hole).
# BUG-B: ✅ FIXED v0.25.1 — a raw multi-selection (before grouping) now offers Hull alongside
#        Union/Difference/Intersection, in the Model-Tree multi-select panel (now a 2×2 grid with a
#        ⬢ Hull button → groupHull) AND the right-click context menu ("Group as Hull").
#        groupSelection() label map extended for 'hull'. Verified: 2 cubes → Group as Hull → hull()
#        group, renders 1 mesh, codegen emits hull(){…}, engine 0 errors.
# ==================================

# HANDOFF — Duplicate (v0.23.0): `Cmd/Ctrl+D` or right-click → Duplicate deep-clones the selected
# shape or group (`_cloneForDup` regenerates ids recursively, copies dims/pos/rot/treatments/expr,
# skips THREE refs), inserts after the original (top-level copies offset +14,+14 XY), selects + renders
# it. Verified: prim + group (deep, distinct child ids) duplicate, copies render, codegen updates.

# HANDOFF — Rotation gizmo + movable/rotatable groups + group hull — IN PROGRESS (v0.17.0)

## Feature (restated)
1. Shapes have **Move** and **Resize** gizmos but no **Rotate** — add a third gizmo mode.
2. **Groups** (boolean assemblies) must be **movable and rotatable** as a whole (they had no gizmo).
3. Groups gain a **Hull** operation alongside Union / Difference / Intersection.

## Data model
- A node's rotation is `node.rot = [rx,ry,rz]` (degrees, OpenSCAD `rotate([x,y,z])` order).
  Absent ⇒ `[0,0,0]`; only written when non-zero (no migration of existing spawn sites needed).
- Groups gain optional `node.pos` / `node.rot` (default `[0,0,0]`) so a whole assembly can be
  translated/rotated; members keep their own local pos/rot inside the group frame.

## Rotation math (the crux)
OpenSCAD `rotate([x,y,z])` = `Rz·Ry·Rx` == three.js Euler **order `'ZYX'`**. So every driven
object sets `rotation.order='ZYX'`; `setEuler(obj,rot)` writes degrees→rad in that order and
`readEuler(obj)` reads `.x/.y/.z` back as the exact `[x,y,z]` for codegen. Helpers added near the
gizmo block.

## Touch-points (all in public/Editor.dc.html)
- **Gizmo:** `_applyGizmoMode` (mode/space: world for move, local for rotate/scale; groups skip
  scale), `updateGizmo` (now also attaches top-level **groups**; ghost gets rotation), `setEuler`/
  `readEuler`, `onGizmoChange`/`onGizmoEnd` (branch on isGroup + rotate mode), `setGizmoRotate`.
- **Render:** `buildGroup` (shape.rot), `buildGroupRender` (group pos/rot + fallback member rot),
  `evalBrush` (member rot + nested-group transform + **hull** via `hullMinkBrush`), `buildGhost`
  (rot), `hullMinkBrush.vertsOf` (apply `matrixWorld` so GUI member transforms count).
- **Codegen:** `rotLine`, `emitPrimitive` (rotate after translate ×3 branches), `emitNode`
  (group translate/rotate wrap; `hull(){}` falls out of `node.op`).
- **Parse:** `parseBlock` captures `rotate`→rot, group `pos`/`rot`, `GROUPS += 'hull'`;
  `readRotTokens`; `buildNodeFromParsed` (group pos/rot/hull label, primitive rot); `isAdvanced`
  SIMPLE set `+= 'rotate','hull'` so rotated/hull GUI programs stay editable.
- **UI:** shape panel Rotate tab; group panel Transform (Move/Rotate) tabs + Hull op button
  (2×2 grid); tree context-menu Hull; renderVals (`rotateTab`, `setGizmoRotate`, group gizmo/hull
  props, `showGroupGizmo`).

## Status: DONE (v0.17.0). Verified in-app: rotate + group hull + group translate/rotate round-trip
## through parse→codegen and stay GUI-editable (isAdvanced=false); hull group renders a real mesh;
## gizmo attaches to top-level groups (move=world, rotate=local, scale→falls back to move). Badge
## updated, VERSION=0.17.0, release snapshot cut.

## KNOWN BUG (FIXED v0.18.2) — shared parameter now propagates to siblings during live gizmo edit
When a parameter (variable) is bound to an object's property (e.g. `cube([w,w,w])`), dragging/
resizing/rotating that object writes the new value back into the variable (`setVarValueRaw`/
`setVarValue` from `onGizmoChange`/`onGizmoEnd`/`bakeDim`). Previously only the **dragged** object
re-resolved; **other objects bound to the same parameter refreshed only on the next full rebuild**.
**Fix (Editor.dc.html):** `propagateVarChange(changedVars, activeId, force)` — after a gizmo edit
writes parameters, it re-resolves every OTHER shape whose `expr` references a changed var
(`exprVars(expr)` scans identifiers that name a defined parameter) and rebuilds the distinct
top-level ancestor groups those siblings live in (deduped; the active shape's ancestor is skipped —
the existing `rebuildAncestor`/`rebuildField` already handles it). Heavy CSG is **throttled to ≤20fps
during a continuous drag** (`_lastSibRebuild` + 50ms guard) and **forced on drag end** (`_gizmoEnding`
flag set in `onGizmoEnd`; the translate-end `onGizmoChange()` passes it through; the scale branch
passes `force:true`). `bakeDim` now returns the var name it wrote so the scale path can collect the
changed set. Verified via `eval_js`: two cubes sized by `s` — scaling one 2× sets `s` and resizes
**both** (data + rendered bbox ~10→~23); two cubes positioned by `d` — live-translating one to x=30
sets `d` and moves the **sibling** to y=30 (group.position.y=30) mid-drag.

### Original analysis (kept for reference)
- Want: editing a shared param via gizmo updates every shape bound to it in the live viewport.
- Where to fix: after `setVarValueRaw`/`setVarValue` during a gizmo drag, re-resolve + rebuild
  every shape whose `expr` references that var (not just the active one). `resolveAll()` already
  re-resolves all shapes from `varMap()`; the live path needs to call it (or a scoped variant that
  rebuilds only the affected shapes' groups) and refresh their three.js geometry/position, instead
  of only `resolveShape(activeShape)` + `rebuildField(activeShape)`. Watch perf: throttle the
  multi-shape rebuild during continuous drag (rebuild on `onGizmoChange` may be heavy — consider
  updating sibling transforms live but deferring CSG-heavy rebuilds to `onGizmoEnd`).

---

# HANDOFF — GUI authoring: more shapes + 2D + extrudes + boolean-edge fillets — IN PROGRESS

> The engine renders 100% of OpenSCAD already (read-only, advanced path). This work is about the
> **GUI authoring tree**: making more of the language directly *insertable & gizmo-editable* from
> the toolbar, not just renderable from code. Today the authoring tree models only 3 primitive
> types (cuboid / cylinder / sphere) and edge fillet/chamfer only works on a single primitive.

## Full intended scope (the feature list, restated)
- **A. All 3D solids in an "Add shape" submenu** — cone, pyramid/prism, torus, tube/pipe, wedge
  (+ the existing cuboid/cylinder/sphere). A flyout menu off the left toolbar.
- **B. 2D primitives** — circle, square, polygon as GUI-editable flat shapes.
- **C. Extrusions as GUI operations** — wrap a 2D shape in `linear_extrude` (height/twist/scale)
  or `rotate_extrude` (angle), edited via the inspector.
- **D. Edge fillet/chamfer on UNION / boolean results** — today `cuboidEdges`/`cylinderEdges`
  enumerate edges per primitive and bake a CSG mask into that one solid. Filleting the edges
  *created by* a union/difference is not supported and was always meant to be.

## Authoring-tree primitive pipeline (every touch-point a new prim type needs)
A primitive node `{id,type,label,dims,pos,treatments,edges,...}` flows through:
`addX()` → `addPrimitive` → `buildGroup` (edges + `solidGeometry` + wire + pick proxies) →
inspector `dimFields` (`buildField`+`fieldNumber`/`applyFieldNumber`) → codegen
(`emitPrimitive`/`baseCall`/`dimTok`) → parse-back (`readPrimitive` in `parseScad`, gated by
`isAdvanced` SIMPLE set) → `restingPos` · model-tree `meta`/badge · `seq` counter.

## Round-trip strategy (the crux)
`isAdvanced(ast)` decides GUI-editable (simple) vs read-only (advanced). A new prim **round-trips
as an editable GUI node only if its emitted OpenSCAD is in the SIMPLE set**. Therefore:
- **Cone / Pyramid** emit native `cylinder(h, r1, r2, $fn=n, center=true)` → SIMPLE → fully
  round-trip + keep edge fillets. (We unify them into the existing `cylinder` type with optional
  `r2` (top radius) + `sides` dims — reuses all cylinder code paths.)
- **Torus / Tube / Wedge / 2D / extrudes** emit `rotate_extrude` / `difference` / `polyhedron` /
  `linear_extrude`, which `isAdvanced` flags → on an explicit *Run-from-code* they re-import as
  the **read-only evaluated geometry** (engine renders them correctly). They stay gizmo-editable
  while authored in the GUI; only a code round-trip drops them to read-only. A later slice can add
  full round-trip via GUI marker-comments (`// @scs <type> …`) parsed before `isAdvanced`.

## Build order (shippable slices, each released)
1. **[~] Slice 1 — Add-shape submenu + Cone + Pyramid** (this turn, v0.16.0). Flyout menu;
   `cylinder` type gains optional `r2`+`sides`; cone/pyramid fully round-trip; cone keeps rim
   fillet/chamfer. Touch-points: `addCone`/`addPyramid`, `solidGeometry`, `cylProfile`(→rBot,rTop),
   `cylinderEdges`, `cylWireGeom`, `edgeMaxRadius`, `baseCall`/`dimTok`(r1/r2/$fn), `dimFields`
   (⌀base/⌀top/sides), `fieldNumber`/`applyFieldNumber` (d2/sides), `readPrimitive` (r1/r2/d1/d2/$fn),
   remove the `cylinder r1/r2 → advanced` exclusion in `isAdvanced`.
2. **[x] Slice 2 — Torus / Tube / Wedge** solids (v0.19.0). New authoring-tree primitive types,
   live gizmo-editable with inspector dims (torus ⌀ring/⌀tube, tube ⌀outer/⌀inner/height, wedge
   x/y/z); render via THREE Torus / Lathe-annulus / Extrude-triangle; emit `rotate_extrude` (torus) /
   `difference` of two cylinders (tube) / `rotate([90,0,0]) linear_extrude polygon` (wedge) →
   advanced, so a code round-trip drops them to read-only (engine renders them correctly).
   Touch-points: `addTorus/addTube/addWedge` + `pickShape` map + `seq`; `solidGeometry` (torus/tube/
   wedge branches) + buildGroup wire `baseGeom`; `fieldNumber`/`applyFieldNumber` (ringd/tubed/di);
   `dimFields`; `baseCall` (3 branches) + `emitPrimitive` multiline indent; `restingPos`; tree
   `meta`/dot + grpMembers `badge`; add-shape flyout buttons + `mi*` renderVals. Verified via
   eval_js: all three render (1225/245/24 verts), codegen valid, engine round-trips 4 geom nodes /
   0 errors / advanced=true, inspector fields correct.
3. **[x] Slice 3 — 2D primitives** (circle/square/polygon) as flat editable shapes (v0.20.0, polygon
   point-editor v0.22.0).
   New authoring-tree types rendered as a thin (0.6mm) ExtrudeGeometry sheet resting on the floor,
   gizmo move/resize/rotate like any solid. Circle (⌀) and square (X/Y) are dim-editable; polygon
   ships a default 6-pt L-outline and is placeable but **point-editing is deferred** (Size panel
   empty — a future slice adds a point editor). Emit `circle(d,$fn)` / `square([x,y],center)` /
   `polygon([pts])` → advanced (read-only on code round-trip; engine renders the flat slab).
   Touch-points: `addCircle2D/addSquare2D/addPolygon2D` + `pickShape`/`seq`; `solidGeometry` 2D
   branch (Shape→ExtrudeGeometry, absarc circle); `restingPos` (z=0.3); `dimFields`; `baseCall`
   3 branches; tree `meta`/dot + grpMembers badge; flyout "2D · for extrude" section + `mi*`.
   Verified: render (1152/36/60 verts), codegen valid, engine round-trips 4 nodes / 0 errors,
   inspector fields correct. **Slice 3 complete: polygon point-editor shipped v0.22.0** — selecting
   a polygon shows an editable Points list in the inspector (per-vertex X/Y inputs, delete ×, "+ Add
   point"; min-3 guard), live-rebuilding the sheet + codegen; works on polygons nested in an extrude.
4. **[x] Slice 4 — Extrude operations** (linear_extrude / rotate_extrude wrappers on a 2D child)
   (v0.21.0). Modeled as a **group-like node** (`op:'linear_extrude'|'rotate_extrude'` + `children`,
   params in `dims`) so it reuses ALL group plumbing (reindex/findNode/tree/gizmo move+rotate/
   emitNode). `isExtrude(n)` gates the special cases. Render: `extrudeGeometry` collects the 2D
   subtree's rings (`ringsForType`+`xform2D`+`collectAuthored2DRings`, even-odd holes via
   ringsToShapes) → existing `linearSolid`/`revolveSolid`; zeroed uv added so a nested extrude still
   feeds three-bvh-csg booleans. Authored from a 2D shape's panel buttons or right-click (Linear /
   Rotate extrude) — wraps the shape like grouping. Inspector: extrude params (height/twist/end-scale
   or angle°) via reused field rows + move/rotate gizmo + \"Remove extrude\"; boolean-op buttons hidden.\n   Emits parametric `linear_extrude(height,twist,scale,slices)` / `rotate_extrude(angle,$fn)` →\n   advanced (read-only on code round-trip). `rebuildField` now routes group edits through\n   rebuildScene; `placeOnFloor` uses `restingPos`. Verified: both build geometry (36v / 1728v),\n   height edit → bbox z matches, twist lofts, child editable, engine round-trips 2 nodes / 0 errors.
5. **[x] Slice 5 — Boolean-edge fillet/chamfer** (v0.24.0, simplest useful v1): detect convex/concave edges on a union/difference
   result mesh (EdgesGeometry angle threshold → edge loops), let the user pick one and apply an
   analytic fillet/chamfer. (Hardest — robust filleting of arbitrary CSG edges; may start with the
   common case of two-primitive intersections.)
6. **[x] Slice 6 — Face push/pull extrude (linear v0.25.0 + revolve v0.26.0)**: pick a face of the evaluated
   solid, drag to **linear-extrude** it along its normal (outward → union, inward → difference) or
   **rotate-extrude** it around a chosen edge/axis. Exports cleanly: the picked face becomes a
   `polygon()` placed on the face plane via `multmatrix`, wrapped in `linear_extrude`/`rotate_extrude`,
   and `union`/`difference`-ed with the model. Shares the result-mesh face/edge detection with Slice 5.

## Slice 6 design — Face push/pull
**Foundation (this turn): face detection.** From the evaluated result `BufferGeometry`:
- `faceClusters(geo)` / `faceTrisAt(geo, triIndex)` — group triangles into **planar faces** by
  quantized (normal, plane-offset). v1 merges coplanar tris (a cube top = 1 face); connectivity-split
  is a later refinement.
- `faceData(geo, tris)` — extract the boundary loop(s): collect every triangle edge, keep edges used
  an odd number of times (boundary), chain them into closed loops by shared endpoints. Build a face
  frame (origin = a boundary vertex, +Z = face normal, U/V in-plane), project the loops to 2D rings
  in that frame. Returns `{ rings2D, frame:Matrix4, normal, center, area }` such that
  `multmatrix(frame) linear_extrude(d) polygon(rings2D)` reproduces a prism standing on the face.
**Then:** pick (raycast result mesh → hit triangle → `faceTrisAt` → highlight loop), a push/pull
gizmo (drag along normal = linear distance; modifier or second handle = revolve angle about a chosen
boundary edge), realize as a new boolean member, emit OpenSCAD. Restructure: wrap the current model
in a `union(){ … }` / `difference(){ … }` with the new extruded solid.
**Open UX questions:** how the user enters the tool (select a face vs a dedicated tool), linear vs
rotational toggle, axis pick for revolve, numeric entry vs drag.

---

# HANDOFF — Phase 13 conformance harness — ✅ SHIPPED (v0.15.0)

The last roadmap phase. A 113-case conformance suite (`public/conformance.js`,
`window.ScadConformance`) exercises one+ snippet per cheat-sheet feature and checks engine
output through `window.ScadEngine.run`. **113/113 pass = 100% coverage.** Runnable via
`eval_js(window.ScadConformance.run())` AND from the editor UI: a **run tests** button in the
bottom status bar (next to `console`) opens a results panel — per-section pass/fail bars, a
coverage meter + ALL PASS badge, and every case clickable to load its `.scad` snippet into the
editor for inspection. Sections with any failure auto-expand.

### What each case checks (engine-level, deterministic — no WebGL needed)
- **echo-based** (most of the language): runs the snippet, compares `res.echos[i].msg` to the
  expected OpenSCAD-formatted string (operators, math/string/list/type-test fns, special vars,
  list comprehensions incl. C-style, recursion, lambdas, `assign()`).
- **geom-node-based**: flattens `res.geom` and counts `kind`/`type`/`shape`/`op` nodes, or
  inspects the wrapping `group` node's column-major `matrix` (translate at m[12..14], scale at
  m[0]/m[5]/m[10], etc.) for the transform cases. Covers 3D + 2D primitives, all transforms,
  booleans, flow/modules/`children()`/`$children`, extrudes, projection, import/surface/
  include-use (with synthetic `opts.files`), and modifier tags (`#`→`mod:highlight`,
  `%`→`mod:background`, `*`→skipped, `!`→renders).
- **error/warn-based**: `assert(false,…)` must populate `res.errors`; `assert(true,…)` must not.

### Files
- `public/conformance.js` — `{ cases, run(globalOpts), flatten }`. `add(section,name,src,ck,opts)`;
  each `ck(H,res)` returns `true` or a failure-detail string. `H` helpers: `echo(i)`, `eq(i,v)`,
  `kindCount/typeCount/shapeCount/opCount`, `find(pred)`, `noErr`, `errs`, `warns`, `flat`.
- `public/Editor.dc.html` — helmet loads `conformance.js`; state `confOpen/confReport/confExpanded`;
  handlers `runConformance` (passes the live global `$fn`), `closeConf`, `toggleConfSection`,
  `loadConfCase`; the status-bar button + the centered results panel; `confSections` renderVals.

### Deferred (by design)
The optional openscad-wasm differential check (Phase 13 second box) — only worthwhile if the
native evaluator ever stalls on exotic features. Every other Phase 0–13 box is now checked.

---



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
