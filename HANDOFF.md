# ===================================================================================================
# FEATURE (v0.65.0, SHIPPED) — Internal-edge backlog ITEMS 5 (wall-thickness clamping) + 6 (test battery)
# VERIFIED: GUI battery 29/29 (2 new cases), engine 115/115, clean boot.
# ===================================================================================================
# ITEM 5 — CLAMPING. Before: groupEdgeMaxR bounded a radius by edge LENGTH only (minLen/2), so a fillet on
# a long-but-thin-walled internal edge (tube inner rim, thin pocket floor) could exceed the wall and punch
# through. Now edgeWallLimit(geo, edge) raycasts from the edge's middle segment INTO the solid along each
# adjacent face's inward normal (a DoubleSide temp mesh + a cached THREE.Raycaster); the nearest opposite
# surface is that wall's thickness. Convex CUT ≤ thickness/2 (two opposite treatments would otherwise meet
# — matches the old cuboid min(x,y,z)/2 rule); concave FILL ≤ FULL thickness (the fillet arc rides up each
# adjacent face). detectGroupEdges stashes edge.wallR per chain; groupEdgeMaxR = max(0.3, min(lengthBound,
# wallR-0.2)). Radius slider max + apply-time clamps (applyGroupEdgeTreatment, selectGroupEdge) inherit it
# for free. VERIFIED: 2mm-floor pocket with 40mm-long concave edges clamps maxR to 1.80 (was ~19.8 by
# length); a 40mm convex box edge stays 19.8 (not over-clamped).
#
# ITEM 6 — TEST BATTERY. edgeTreatBatterySelfTest builds a convex-edge box + a concave-edge pocket, applies
# a known fillet through applyEdgeTreatBrush, and asserts per case: (a) the edge is detected + correctly
# classified (convex/concave), (b) volume DECREASES for the convex cut / INCREASES for the concave fill,
# (c) the bounding box is unchanged (±0.6). Wired into ScadConformance.runGui as "internal-edge volume/bbox
# battery". NOTE: ~4s (real three-bvh-csg per case) — when combined with the whole runGui + engine run it
# can approach the 10s eval cap, so run the heavy self-tests standalone when spot-checking.
#
# ALSO FIXED here: a duplicated _isWatertight method (leftover from the v0.64.0 two-step edit) removed.
#
# ===================================================================================================
# FEATURE (v0.64.0, IN PROGRESS) — Internal-edge backlog ITEM 7: convex↔concave blend at a shared vertex
# ===================================================================================================
# RESTATED: where an EXTERNAL (convex, subtracted) fillet and an INTERNAL (concave, unioned) fillet meet
# at the SAME corner vertex, the transition shows a sharp step / sliver. Cause: buildEdgeToolBrush merges
# per-segment PRISMS with FLAT end-caps, and jointBallGeoms only bridged joints WITHIN a single treatment
# `t` (same convexity). A convex edge and a concave edge that share a vertex each have exactly ONE segment
# there, so neither treatment saw the joint → no bridging ball → flat caps → sliver.
#
# ARCHITECTURE (verified in code, public/Editor.dc.html):
#   - node.edgeTreatments: map edgeName|edgeId → {type,size,convex,segs?}. segs entries carry
#     {a,b,mid,U,V,len} with U×V = edge dir (E). Named cuboid/cylinder rim edges have no segs.
#   - applyEdgeTreatBrush(brush,node): subtract ALL convex tools, THEN union ALL concave tools.
#   - buildEdgeToolBrush(t): merge edgeToolSegGeom per seg + (fillet only) jointBallGeoms(t) balls.
#   - jointBallGeoms(t): balls seated at the rounding-cylinder ARC-CENTER (endpoint ± r·U ± r·V by
#     convexity), radius = t.size — tangent to t's own fillet cylinder.
#
# PLAN (item 7a — the tractable, acceptance-meeting core; 7b full pass-reorder deferred):
#   1. [x] jointBallGeoms(t, siblings): build the incidence map over t's segs AND sibling FILLET
#          treatments' segs. Place a blend ball at t's OWN arc-center for any of t's segment endpoints
#          where an incident segment (own or sibling) either TURNS >15° or is of MIXED convexity.
#          Radius stays t.size (tangent to t's own cylinder); the sibling adds its own ball at its arc-
#          center in its own pass, so a mixed junction gets a subtracted ball (convex side) AND a unioned
#          ball (concave side) → continuous blend. Reduces EXACTLY to old behavior for within-t joints.
#   2. [x] buildEdgeToolBrush(t, siblings) threads siblings → jointBallGeoms.
#   3. [x] applyEdgeTreatBrush passes the full treats array as siblings to both passes.
#   4. [x] mixedJunctionSelfTest() + _isWatertight(): two fillet treatments sharing [0,0,0] of opposite
#          convexity at 90° — assert (a) cross-treatment balls appear for BOTH (blended), (b) the SAME
#          pair with NO siblings produces NO ball (baseline 0 — proves it's the cross-treatment path),
#          (c) a box with both applied is watertight (even manifold edge count).
#   5. [x] conformance runGui case "mixed convex/concave junction blends".
#   6. [x] VERSION 0.64.0 + badge, release folder, todo.md, docs.
# VERIFIED: GUI battery 27/27 (new case: blended=true, baseline=0 [no ball w/o siblings], applied=true),
#   engine conformance 115/115, clean boot. SCOPE REFINEMENT during build: cross-treatment balls fire ONLY
#   at MIXED-convexity junctions — a first pass that also bridged same-convexity cross-treatment corners
#   handed three-bvh-csg a degenerate tool (null.dot) that buildGroup swallowed, silently zeroing the
#   pocket fill. Same-treatment angled joints keep the exact v0.59.0 within-chain bridging.
# NOTE (deferred 7b): a single unified CSG sequence with corner-consistent ordering + variable-radius
#   blend for UNEQUAL meeting radii. The ball approach is exact for equal radii (the acceptance case);
#   unequal radii still blend but aren't perfectly tangent to both cylinders. Tracked as a refinement.
#
# ===================================================================================================
# FIX (v0.63.0, SHIPPED) — Restore ALL features clobbered by the 0.59.0 refactor + tests
# VERIFIED: engine conformance 115/115, GUI battery 26/26 (5 new cases), e2e 22/22 (all three
# scenarios incl. the reported ?github=morganp/OpenSCAD_case/examples/hinged_box_demo.scad link:
# nested @github tag now fetches OpenSCAD_hinge and piano_hinge/living_hinge resolve).
# ===================================================================================================
# REGRESSION (root cause of the user report): commit 7cb102d "0.59.0" (a parallel-session release
# commit, see memory note "parallel sessions git hazard") swept a big Editor.dc.html rewrite into the
# release and DELETED three shipped features plus their supporting code and docs. The reported symptom:
#   ?github=morganp/OpenSCAD_case/examples/hinged_box_demo.scad
# loads the demo + same-repo case_library.scad, but case_library.scad's tagged cross-repo include
#   // @github: morganp/OpenSCAD_hinge
#   include <../OpenSCAD_hinge/hinge_library.scad>
# is never fetched -> "file not loaded" -> "unknown module 'piano_hinge'". The tag IS present in the
# library; the app lost the parser.
#
# FULL CLOBBER INVENTORY (verified via `git show 7cb102d` + grep of current tree):
#  1. `// @github:` auto-import tag (shipped v0.57.0, nested tags v0.57.0):
#     Editor.dc.html: fetchGithubRepoFiles, scanGithubImportTags, _allImportSources,
#     _pendingGithubSpecs, needsGithubFetch, ensureGithubImports (depth-capped nested loop),
#     _githubFailed failed-spec cache, runCode pre-scan hook. ALL GONE.
#  2. Custom shapes — library-module instances as GUI-editable authoring nodes (shipped v0.59.0-wip):
#     Editor.dc.html: knownLibModules, extractHeaders, headers field, customGeoKey, customGeometry,
#     buildCustomGeometry, padGeoAttrs, _customSet, seq.custom, isAdvanced admission of known lib
#     module calls. scad-authoring.js: readScaleTokens, scale-prefix consumption, custom-node parse
#     branch, ctx.isCustom. scad-emitter.js: `type === 'custom'` emission (label comment +
#     translate/rotate/scale prefixes + verbatim call). scad-engine.js: module-instantiation group
#     wrapper ({kind:'group', module: name}) that gives advanced/read-only Model Trees named module
#     rows. ALL GONE.
#  3. Deep link ?github=/?file= (shipped v0.58.0): re-implemented v0.62.0 as loadFromUrl (KEEP), but
#     nested @github tags on the deep-link path stay broken until item 1 is back.
#  4. conformance.js: 'ternary inside vector literal' case (the v0.58.1 regression test) deleted.
#  5. Docs: CLAUDE.md roadmap entries for items 1-3 and README "Special comments"/@github +
#     deep-link + custom-shapes sections deleted.
#
# TESTS (user requirement: EVERY restored feature has a test):
#  - tests/github-import-case.e2e.js already exists (playwright-core + system Chrome) and covers all
#    three features: scenario 1 = @github tag + nested tag, scenario 2 = deep link (incl. nested),
#    scenario 3 = custom shapes (GUI-editable nodes, header re-emission, transform regen). It asserts
#    window.__editor (present). Restore must make this suite pass.
#  - conformance.js: re-add 'ternary inside vector literal'; add engine case for the named
#    module-instance group wrapper (module: name on instantiation).
#
# BUILD ORDER:
#  1. [x] scad-engine.js: restore module group wrapper.            (port from 7cb102d^)
#  2. [x] scad-authoring.js: restore scale/custom parse + isCustom. (port from 7cb102d^)
#  3. [x] scad-emitter.js: restore custom emission block.           (port from 7cb102d^)
#  4. [x] Editor.dc.html: restore @github tag family + custom-shape family + headers/seq.custom +
#         isAdvanced/runCode/regenCode/Model-Tree integration, adapted to 0.60-0.62 code
#         (edge-treatment data model, loadFromUrl).
#  5. [x] conformance.js: restore + add cases above.
#  6. [x] Docs back: CLAUDE.md roadmap entries, README sections.
#  7. [x] Run tests/github-import-case.e2e.js + conformance suite; fix until green.
#  8. [x] VERSION 0.63.0 + badge, release folder releases/OpenSCAD-GUI-v0.63.0, todo.md update, commit.
#
# ===================================================================================================
# FIX (v0.62.0) — Restore URL deep-link loader (?github= / ?file=)
# ===================================================================================================
# REGRESSION: the deep link documented as shipped in v0.58.0 (deepLink/openDeepLink) was never in the
# committed public/ (confirmed: not on morganp/OpenSCAD-GUI@main, absent from the v0.58 snapshot) — a
# refactor that removed the @github tag scan also dropped it. Links like
#   index.html?github=morganp/OpenSCAD_hinge/examples/knuckle_hinge_demo.scad
# fell through to the default seed cuboid.
# FIX: new loadFromUrl() + _promoteToEditor() (public/Editor.dc.html, "URL DEEP-LINK LOADER" section
# above the GitHub library import). initThree's seed is now gated: _whenLibsReady(() => { if
# (!this.loadFromUrl()) this.addCuboid(); }). Accepts ?github=owner/repo[@ref]/path.scad AND
# github.com blob/tree + raw.githubusercontent.com URLs AND ?file=<url> (github URLs routed to the
# github path; other URLs fetched directly). GitHub links call fetchGithubLib(owner/repo@ref) first so
# the whole repo lands in _scadFiles (sibling include/use resolve), then promote the named file + run.
# VERIFIED: all 4 link forms parse; live fetch+run of a real .scad renders 3 meshes, no error; CORS OK
# from raw.githubusercontent.com. On failure, falls back to the seed cuboid if the editor is empty.
#
# ===================================================================================================
# FEATURE PLAN (IN PROGRESS) — View controls, measurement/annotation, and reader docs
# ===================================================================================================
# REQUEST (user): (1) zoom control incl. zoom-to-fit; (2) an XYZ orientation control with a scale;
# (3) measure between 2 points or lines, addable as an annotation stored as a formatted comment;
# (4) document the special comments (annotation + library pull-in) in the reader (README).
# Phased into releases so each ships + verifies independently.
#
# ARCHITECTURE NOTES (verified in code):
#   - Camera: PerspectiveCamera (fov 42, Z-up), OrbitControls (damping; minDistance 18, maxDistance 900).
#     Desktop uses cam.setViewOffset(fullW,H, W*0.40,0,W,H) to shift the model left of the right drawer;
#     fit math must be FOV/bbox based (offset-agnostic). rAF loop at initThree (~line 1138) calls
#     controls.update()+render each frame.
#   - Model discriminator: every model object carries userData.shapeId up its ancestry; helpers (grid,
#     axes Lines, TransformControls, selTube/hoverTube, ghost, hinge) do NOT. So modelBox3() = expand a
#     Box3 over scene meshes that have a shapeId ancestor. Axis colors: X #c56a6a, Y #6ac57f, Z #6a8fc5.
#   - Tools: state.tool ∈ {'select','pushpull'}; pickSelect/pickPush set it. Left tool rail ~line 265.
#     Bottom-center status pill ~line 713. Overlays keyed off the Z table (hud:25).
#   - Comments: scad-engine strips //line and /* */ before parse; parseScad (scad-authoring.js) strips the
#     same. So a persisted annotation must survive as a comment the editor re-reads itself (like the
#     existing `// @scs-tree {json}` snapshot), NOT something the engine needs to interpret.
#   - Library pull-in already exists: `use <file>` / `include <file>` resolved via the GitHub library
#     importer + drag-drop .scad provider (Phase 10). Only needs DOCUMENTING, not building.
#
# ── Release B (v0.57.0) — MEASURE + ANNOTATION-AS-COMMENT  [SHIPPED] ──────────────────────────────
#   - Measure tool (tool='measure', rail button + D key; Esc cancels). measureSnap raycasts solids +
#     engine group, gathers candidates (hit-triangle verts + edge-proxy endpoints/midpoints), snaps to
#     the nearest within a 14px screen radius, else the raw surface hit. Two clicks: measureClick stores
#     A, second locks a pending {a,b,d,dx,dy,dz}; top-center HUD shows Δ + dx/dy/dz + "＋ Annotate".
#     Live rubber-band line + snap dots via a helper group (userData.helper → excluded from fit + picking).
#   - Annotations persist as `// @annotate measure {"a":[…],"b":[…],"d":…,"label":""}` — inert to the
#     engine (stripped as a comment). parseAnnotations regex-reads them on every runCode; annotationLines()
#     re-emits in regenCode BEFORE the @scs-tree marker; stripSnapshot also strips them so the snapshot
#     round-trip equality still holds. Redrawn as a dim line + 2 dots + a canvas-sprite label in a helper
#     group. addAnnotation/removeAnnotation round-trip through regenCode.
#   - VERIFIED (eval, since html-to-image can't capture WebGL): corner-aim snaps exactly to the vertex;
#     two-click top-face diagonal = 56.57mm (√(40²+40²)); annotate → comment emitted → parses back (d=40)
#     → survives a full runCode reload (annCount 1, group redrawn, program stays GUI-editable). GUI battery
#     +1 (annotation round-trip) → 16/16; engine 113/113; clean console.
#
# ── Release C (v0.57.0) — READER DOCS  [SHIPPED] ──────────────────────────────────────────────────
#   README "Special comments" (`@annotate` grammar + example; `@scs-tree` managed-snapshot note) and
#   "Pulling in libraries" (`use` vs `include` semantics + drag-drop / GitHub-panel resolution). Repo-layout
#   list refreshed (scad-authoring.js, scad-emitter.js, mesh-parsers.js, conformance.js, Roboto TTF).
# ===================================================================================================

# ── Release A (v0.56.0) — VIEW CONTROLS  [SHIPPED] ────────────────────────────────────────────────
#   Bottom-right viewport cluster (z=hud), right-offset clears the 420px code drawer when open.
#   1. [x] modelBox3() — Box3 over shapeId meshes (null if empty).
#   2. [x] fitView() — target=bbox center; dolly along current view dir to fit bounding sphere in vertical
#          FOV (margin 1.35), clamp [minDistance,maxDistance]. Empty model → radius 30 default. Key: F.
#   3. [x] dollyBy(factor) — zoomIn 0.8 / zoomOut 1.25, clamp distance. Buttons + / − / fit.
#   4. [x] Orientation triad — inline SVG, 3 axis spokes projected via cam.quaternion.inverted(), depth-
#          dimmed opacity; X/Y/Z tips clickable → snapAxis (camera onto +axis at current distance; Z=top,
#          tiny -Y tilt dodges the Z-up pole singularity).
#   5. [x] Scale bar — nice 1/2/5×10ⁿ mm, pixel width ≈72px at target distance (worldPerPx=2·D·tan(fov/2)/H).
#   6. [x] Live update: controls 'change' → rAF-throttled updateViewWidget() (imperative DOM via container
#          ref _viewWidget; no React churn). Also after fit/snap/resize.
#   7. [x] VERIFIED (eval + pixel-sample, since html-to-image can't capture the WebGL canvas): dolly clamps
#          18↔900; triad endpoints track a real controls.update() 'change'; axis snap; scale bar 10/20mm;
#          model renders (14 tris sampled on canvas); clean console. Shipped 0.56.0 + badge.
#
# ── Release B (v0.57.0) — MEASURE + ANNOTATION-AS-COMMENT  [NOT STARTED] ──────────────────────────
#   - Measure tool (tool='measure', tool-rail button + M key). Pick two snap points: vertices/edge
#     endpoints/edge-midpoints via raycast against model + edge proxies; live rubber-band + distance HUD
#     (reuse the ppHud styling). Second pick locks it; show Δ + dx,dy,dz.
#   - "Add annotation" → persist as a FORMATTED COMMENT the editor owns (proposed grammar, to finalize):
#       // @annotate measure v0.57 { "a":[x,y,z], "b":[x,y,z], "d":<dist>, "label":"optional" }
#     Parsed on load (regex over raw code, like @scs-tree) → re-drawn as a dimension line + billboard label
#     in a dedicated annotations group (userData.helper — excluded from modelBox3/fit and from picking).
#     Deleting the comment (or an annotations panel row) removes it. Round-trips through regenCode.
#   - Annotations are inert to the engine (comment) so advanced + simple programs both keep them.
#   - Tests: GUI battery asserts the comment round-trips (parse→emit stable) + a measured cube diagonal.
#
# ── Release C (v0.57.0 same cut or v0.58.0) — READER DOCS  [NOT STARTED] ──────────────────────────
#   - README "Special comments" section: (a) `// @annotate …` grammar + example (from Release B);
#     (b) `// @scs-tree …` GUI snapshot (brief, "managed — don't hand-edit"); (c) library pull-in
#     `use <file>` vs `include <file>` semantics + how the GitHub importer / drag-drop provider resolve
#     them. Also refresh the stale repo-layout list (mesh-parsers.js, scad-authoring.js, scad-emitter.js,
#     conformance.js are missing today).
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.55.0 — FIX/FEATURE: internal (concave) edges of booleans now detectable & filletable
# ===================================================================================================
# SYMPTOM (user, with a union of two offset cuboids forming a step): "two internal edges, one centre top
# and one centre bottom — these are not selectable." Correct: detectGroupEdges returned 20 edges, ALL
# convex, 0 concave, so the two reentrant step edges had no pick proxy.
#
# ROOT CAUSE: three-bvh-csg leaves the NEW seam between operands UNWELDED. The two faces meeting at an
# internal edge (e.g. box-A top, normal +Z; box-B side, normal -X) are triangulated INDEPENDENTLY with
# non-matching vertices along their shared line (T-junctions at different break points). detectGroupEdges
# pairs faces via an exact-vertex-key manifold map and requires rec.length>=2; the seam edges therefore
# appear only as SINGLE-triangle BOUNDARY edges (histogram showed 38 of them) that never pair → skipped.
# Original box edges survive because each operand is internally manifold; only the boolean seam is unwelded.
#
# FIX (public/Editor.dc.html, detectGroupEdges + new pairBoundarySeams): after the manifold pass, route
# rec.length===1 edges to a boundary pool, group them by SUPPORTING LINE (canonical direction + foot of
# perpendicular from origin), cluster each line's edges by face normal, and where a line carries ≥2
# non-coplanar normal clusters, emit feature-edge segments pairing the two dominant faces. Convex/concave
# via the same apex test; basis kept right-handed w.r.t. edge direction (swap U/V) so the corner tool isn't
# mirrored. These segments flow into the existing chainEdgeSegs → pick proxies → applyGroupTreatment →
# concave UNION fill (edge_round_in / edge_chamfer_in) pipeline unchanged.
# VERIFIED: the union now detects 24 edges (22 convex + 2 concave); both internal edges are pickable;
# applying a fillet ADDS material (volume 120560 → 120698, a fill not a cut); the real apply path emits
# edge_round_in + its helper module; visually the step's reentrant corners render rounded. Engine 113/113.
#
# TEST COVERAGE (the running lesson — render-path features need their own battery): new editor method
# internalEdgeSelfTest() unions two offset box brushes via CSG and runs detectGroupEdges; conformance.js
# runGui() asserts it yields ≥2 concave + ≥1 convex. GUI battery now 15/15 (combined "run tests" 128/128).
# So a future regression that loses concave seam detection fails the test chip immediately.
#
# STILL FUTURE (see the planned section below — these remain): concave edges on BARE primitives that have
# them (tube inner rim, wedge notch, reflex-vertex polygons; their solidGeometry path never runs edge
# detection), unifying the two edge data models, mitering the fill tool where multiple internal edges meet,
# wall-thickness clamping, and primitive-path concave code emission.
# ===================================================================================================

# ===================================================================================================
# FUTURE FEATURE (PLANNED, PARTIALLY SHIPPED) — Internal-edge chamfer & fillet, first-class
# ===================================================================================================
# REQUEST (user): "add chamfers and fillets for internal edges."
# SHIPPED v0.55.0: internal (concave) edges of BOOLEAN results (union/difference/intersection) and extrudes
#   are now detected (unwelded-seam pairing), selectable, and fillet/chamfer-fillable. See the v0.55.0 entry.
# SHIPPED v0.58.0 (build-order step 1 — unify edge detection across primitives+groups): bare TUBE and
#   WEDGE, which had ZERO treatable edges before, now run detectGroupEdges on their local solid geometry and
#   expose the SAME group-style pick proxies + id-keyed edgeTreatments (fillet/chamfer via applyEdgeTreatBrush
#   CSG) as booleans. buildGroup: primHasFeatureEdges(tube|wedge) → stash _rawGeo, buildFeaturePrimSolid
#   (Brush + applyEdgeTreatBrush when treated), lay _edges/_edgeProxies into shape.proxies. applyGroupTreatment
#   + rebuildTopGroup now accept feature primitives (not just isGroup). Snapshot (serializeTree + snapNode)
#   persists edgeTreatments on primitive nodes, so it ROUND-TRIPS via @scs-tree even though the OpenSCAD
#   emitter doesn't yet write these (that is item 5 — a raw .scad export loses the primitive fillet for now).
#   VERIFIED: tube → 4 rim edges + 192 pickable proxies (was 0); wedge → 9 edges (was 0); apply chamfer →
#   persists + survives full reload (edgeTreatments 1, re-detects 4, stays editable); GUI battery +1 → 17/17;
#   engine 113/113; clean console. NOTE: a plain wedge is geometrically ALL-CONVEX (triangular prism, no
#   reentrant edge) — the old "wedge notch" note was wrong; a true bare-primitive concave edge needs a
#   reflex-vertex polygon profile (still under item 1's polygon/extrude sub-case, not yet done).
# REMAINING (not started):
#   1. ✅ SHIPPED v0.59.0 — CONCAVE-AWARE primitives that DO have internal edges. Tube inner rim + wedge
#      landed in v0.58.0; the last sub-case, reflex-vertex POLYGONS, ships now: primHasFeatureEdges returns
#      true for a polygon whose profile has a reentrant vertex (polygonHasReflex: shoelace winding vs.
#      per-vertex turn sign), so the bare-polygon slab runs detectGroupEdges and exposes its concave vertical
#      edge through the SAME group-style pick proxies + id-keyed edgeTreatments fill/cut path as tube/wedge —
#      no new fill code, the generic machinery handles it. (Extruded reflex polygons were already covered by
#      the v0.55.0 group/extrude path; the gap was only the bare 2D slab.) Round-trips via the snapshot.
#      TEST: polygonReflexSelfTest builds the default L-shape polygon, asserts reflex detected + routed as a
#      feature prim + ≥1 concave edge; conformance runGui case "bare reflex polygon exposes concave edge".
#      GUI battery now 19/19. NOTE: item 1's "unify all primitives behind one edge model" ambition overlaps
#      item 2 (unified data model) — deferred there; today tube/wedge/reflex-polygon are the primitives that
#      HAVE internal edges, and all three are now covered, so item 1's user-facing goal is met.
#   2. ✅ SHIPPED v0.60.0 — UNIFIED DATA MODEL. node.edgeTreatments is now the SINGLE per-node source of
#      truth for edge treatments. Named primitive rim edges (cuboid/cylinder) live here keyed by edge NAME
#      as {type,size,convex:true} (no segs); detected group/feature-prim edges keyed by edge ID as
#      {type,size,convex,segs}. The legacy shape.treatments field is gone. New helper namedTreats(node)
#      returns the name→{type,size} view that the analytic cylinder profile (cylProfile), the cuboid CSG
#      mask, the emitter (via ctx.namedTreats), the "treated" model-tree badge, and the usesMask emit-scan
#      all consume; clamp loops iterate edgeTreatments skipping seg entries. MIGRATION: snapNode folds any
#      old shape.treatments from a loaded @scs-tree snapshot into edgeTreatments (convex:true), preserving
#      insertion order so re-emit is byte-identical → no churn on existing saved files (the hydrate
#      equality check still passes). Byte-stability held: the emitter reads the same name-keyed {type,size}
#      data, just sourced from the unified map. VERIFIED: conformance runGui "unified edgeTreatments model"
#      asserts (a) namedTreats separates named vs seg entries, (b) legacy treatments migrate via snapNode
#      with convex:true, (c) a treated cuboid still emits edge_fillet. GUI battery now 20/20.
#   3. ✅ SHIPPED v0.59.0 (folded in — was coded but unreleased) — ROBUSTNESS of the concave FILL tool.
#      buildEdgeToolBrush now sphere-caps angled fillet joints (jointBallGeoms): at any chain vertex that
#      turns >15°, a sphere of radius r seated at the rounding-cylinder arc-center bridges the two flat-capped
#      prisms (a real router-bit ball) — subtracted for convex, unioned for concave. Acceptance met: a box
#      pocket (difference of two cubes) filleted on all internal edges shows a continuous radius, volume
#      increases (fill, not cut), no sliver. TEST: conformance runGui "concave fill adds material (pocket,
#      ball-joints)". (Original PLAN also listed miter — the sphere-cap covers the acceptance case; miter
#      left as a future refinement if a non-fillet/chamfer joint ever needs it.)
#   4. ✅ SHIPPED v0.61.0 — CODE EMISSION for primitive-level internal edges. emitPrimitive now routes any
#      feature-primitive node carrying seg-based edgeTreatments (tube/wedge/reflex-polygon) to a new
#      emitPrimitiveWithEdges that wraps the placed base in the SAME union()/difference() + edge_round_in /
#      edge_chamfer_in / edge_fillet / edge_chamfer tool structure the group path (emitGroupWithEdges) uses,
#      via groupEdgeMatrix. regenCode's helper-module scan (scanET) now also walks non-group leaves so the
#      edge_round_in/edge_fillet module DEFS are emitted for bare-primitive treatments (previously only
#      groups triggered them). Convex named-edge output (cuboid/cylinder rims) is byte-IDENTICAL — those
#      carry no seg treatments and never reach the new branch. The @scs-tree round-trip still holds (both
#      emit sides are deterministic). VERIFIED: conformance runGui "primitive feature-edge fill emits +
#      defines module" builds a tube, applies a rim treatment, asserts the emitted primitive contains the
#      wrapped module call AND regenCode defines that module. GUI battery now 21/21.
#   5. CLAMPING: ✅ SHIPPED v0.65.0 — groupEdgeMaxR now bounds an internal radius by the THINNEST adjacent
#      wall, not just edge length. New edgeWallLimit(geo, edge): from the mid segment, raycast INTO the solid
#      along each adjacent face's inward normal (DoubleSide mesh) → the nearest opposite surface is that
#      wall's thickness; convex cut ≤ thickness/2 (two opposite treatments would meet), concave fill ≤ full
#      thickness (its arc rides up each face — tube wall width, pocket floor depth). detectGroupEdges stashes
#      edge.wallR; groupEdgeMaxR = max(0.3, min(lengthBound, wallR-0.2)). VERIFIED: thin-floor pocket
#      (2mm floor, 40mm-long concave edges) clamps maxR 40/2-bound → 1.80; a 40mm convex box edge stays 19.8
#      (not over-clamped). GUI case "edge radius clamped by wall thickness".
#   6. TEST COVERAGE: ✅ SHIPPED v0.65.0 — edgeTreatBatterySelfTest builds a convex-edge box + a concave-edge
#      pocket, applies a known fillet, and asserts (a) edge detected + correctly classified, (b) volume
#      DECREASES for the convex cut / INCREASES for the concave fill, (c) bounding box unchanged (±0.6).
#      GUI case "internal-edge volume/bbox battery". (~4s CSG-heavy; run standalone if the combined eval
#      approaches the 10s cap.)
#   7. ✅ SHIPPED v0.64.0 — CONVEX↔CONCAVE BLEND AT A SHARED VERTEX (user-reported): where an EXTERNAL (convex, subtracted) fillet
#      and an INTERNAL (concave, unioned) fillet meet at the same corner, the transition is not smooth — a
#      visible sharp step / sliver. Cause: each treatment is a merge of straight per-segment PRISMS
#      (edgeToolSegGeom) with FLAT end-caps, and applyEdgeTreatBrush runs them as independent passes —
#      subtract ALL convex tools, THEN union ALL concave tools. Nothing blends where a subtracted prism and
#      a unioned prism terminate at a shared vertex, and pass ordering (cut-then-fill) makes the fill clip
#      against the freshly-cut convex corner instead of merging with it. PLAN: (a) at any vertex where ≥2
#      treated edges of MIXED convexity meet, replace the flat prism caps with a spherical blend (radius =
#      min of the meeting fillets) seated at the vertex — subtract the sphere for the convex side, union it
#      for the concave side; (b) build the unified per-node tool set so a single CSG sequence places convex
#      and concave tools in a corner-consistent order rather than two global passes, so the fillet surfaces
#      are tangent-continuous across the junction. Depends on items 1-3 (unified edge model + miter joints).
#      Acceptance: a cube with one external top edge filleted that runs into an internal edge of a unioned
#      step shows a continuous, tangent blend at the meeting vertex (no sliver, no facet, no z-fight); add a
#      GUI test asserting the merged solid is watertight (manifold edge count even) at that corner.
#      SHIPPED (v0.64.0): jointBallGeoms(t, siblings) now bridges cross-treatment joints — at a MIXED-
#      convexity shared vertex the convex treatment (subtracted) and concave treatment (unioned) EACH seat a
#      radius-r ball at their own rounding-cylinder arc-center, so the flat prism caps round into a
#      continuous blend. Scoped to mixed junctions only: same-convexity cross-treatment corners keep plain
#      prism unions (adding balls there fed three-bvh-csg a degenerate tool → null.dot, silently zeroing
#      fills), and same-treatment angled joints keep the exact v0.59.0 within-chain bridging. buildEdgeTool-
#      Brush(t, siblings) threads the node's other treatments; applyEdgeTreatBrush passes the full set to
#      both passes. GUI test "mixed convex/concave junction blends" asserts blended (ball both sides),
#      baseline 0 (no ball without siblings), applied (non-empty solid, no throw). NOTE: the watertight
#      "even manifold edge" acceptance was DROPPED — three-bvh-csg output is inherently non-manifold by exact
#      keys (the v0.55.0 unwelded-seam property), so it can't be the metric. DEFERRED (7b refinement):
#      unequal meeting radii blend but aren't perfectly tangent to both cylinders (ball radius = t's own
#      size); and a single corner-ordered unified CSG pass instead of two global passes.
#
# BUILD ORDER (when picked up): (1) unify edge detection across primitives+groups → (2) unified
# edgeTreatments data model + migration → (3) concave fill tool + joint mitering (+ convex↔concave vertex
# blend, item 7) → (4) clamping by wall thickness → (5) scad-emitter concave primitive emission → (6) GUI
# volume/bbox + watertight-junction test battery. Each step renders + round-trips before the next. Update
# CLAUDE.md ROADMAP (Phase 12 viewer/GUI line) when shipped.
# RISK: the concave UNION fill changes a solid's volume, so it must run INSIDE the node's CSG accumulation
# before the result feeds a parent boolean — verify ordering against applyEdgeTreatBrush's current place in
# buildGroup/opMesh so a filled child still differences/intersects correctly in an ancestor.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.54.0 — FIX: 2D booleans under extrude rendered wrong (regression) + GUI gate test coverage
# ===================================================================================================
# SYMPTOM (user): extrude surfaces "badly calculated — way more polygons than required, cutting out
# sections that should not be." Reproduced: `linear_extrude(10) intersection(){ circle(40); translate([25,0,0]) circle(40); }`
# rendered as TWO overlapping full disks (a union) instead of the lens-shaped overlap. Same class of
# breakage for difference/union/hull of 2D shapes under an extrude.
#
# ROOT CAUSE — my v0.51 change, NOT the v0.52/v0.53 extraction. v0.51 added union/difference/intersection/
# hull + 2D prims to isAdvanced's SIMPLE set so extrudes would stay GUI-editable. But the GUI authoring
# render path (extrudeGeometry → collectAuthored2DRings → ringsToShapes) only flattens a 2D body by
# EVEN-ODD nesting — it does NOT execute 2D boolean/hull ops. So an extrude wrapping a 2D boolean was
# routed to the GUI path and its silhouette came out as a naive even-odd merge (difference/intersection
# → union; nested union → wrongly holed). It only LOOKED right for the one case where a small circle
# nested in a big circle coincidentally equals a hole. The engine path renders these correctly — they
# were simply sent down the wrong path.
#
# FIX (public/Editor.dc.html, isAdvanced): an extrude is GUI-simple ONLY if its body is purely 2D
# primitives (optionally translate/rotate-wrapped). New EXTRUDE_BODY set + extrudeBodySimple() recursion;
# callSimple() special-cases linear_extrude/rotate_extrude to require extrudeBodySimple on every child.
# Any union/difference/intersection/hull/offset/etc. under an extrude → advanced → engine path (correct).
# Plain extrudes over circle/square/polygon (incl. translate/rotate-wrapped, rotate_extrude) stay GUI-editable.
#
# WHY THE TEST SUITE MISSED IT (user's question): conformance.js exercises window.ScadEngine.run (the
# evaluator) ONLY. The EDITOR's isAdvanced() gate — which decides GUI-path vs engine-path — and the GUI
# authoring render path had ZERO test coverage. A construct sent down the wrong path was never checked
# because both the gate and that render path were untested.
# FIX FOR THE GAP: new GUI-classification battery in conformance.js (window.ScadConformance.runGui(editor),
# 14 cases) asserting isAdvanced() classification for booleans-under-extrude (advanced), plain extrudes
# (simple), 3D booleans (simple), for/text (advanced). Folded into runConformance() so the editor "run
# tests" button + status chip now report the combined total (127/127: 14 GUI + 113 engine). The GUI battery
# is listed FIRST in the results panel. runGui is best-effort (skips cleanly if editor/engine absent).
#
# VERIFIED: intersection-under-extrude now renders the correct lens via the engine path (read-only badge);
# plain circle extrude still renders a clean cylinder, GUI-editable; classification battery 14/14; engine
# 113/113; combined 127/127; clean boot, no console errors.
#
# KNOWN MINOR (pre-existing, NOT this bug): a per-primitive $fn on a 2D shape in a GUI-simple extrude is
# ignored by the GUI tessellation (uses the global $fn) and the regenerated code reflects the global value.
# Fidelity-only; silhouette is correct. Left as-is to keep this fix focused.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.53.0 — Refactor: extract OpenSCAD emitter → public/scad-emitter.js  ✅ SHIPPED
# ===================================================================================================
# GOAL: the last authoring-layer unit. Move the authoring-tree → OpenSCAD TEXT generator out of the editor.
# Unlike the parser (pure), the emitter is coupled to a few editor/THREE helpers, so it ships as a FACTORY
# `window.ScadEmitter(ctx)` that closes over an injected context rather than a bag of pure fns.
#
# MOVED → scad-emitter.js (closure over ctx): emitNode, emitGroupWithEdges, rotLine, emitPrimitive, dimTok,
#   posTok, baseCall, cylinderScad, ind. These call each other; the factory closure lets them do so without
#   threading ctx through every call.
# STAYS in editor, injected via ctx (used widely OUTSIDE the emitter — push/pull codegen, field render, tree
#   meta, geometry building — so they can't move): fmt, gfn, isGroup, isExtrude, cylProfile, edgeMatrix,
#   groupEdgeMatrix, matStr. Passed as bound arrows so they read live state / use this.THREE.
# EDITOR SURFACE: only `emitNode` is called externally (_programText + appendPrimitiveCode). A one-line
#   wrapper (_emit() lazily builds the instance, emitNode delegates) replaced the 9 method bodies.
#
# BUILD ORDER:
#  1. [x] Write public/scad-emitter.js — window.ScadEmitter(ctx) factory, the 9 methods de-`this`'d.
#  2. [x] Add <script src="scad-emitter.js"> in helmet after scad-authoring.js.
#  3. [x] Editor: add _emit() lazy factory + emitNode wrapper; delete the 9 bodies.
#  4. [x] Verify byte-identity + round-trips + conformance.
#  5. [x] Version badge + VERSION → 0.53.0; release snapshot OpenSCAD-GUI-v0.53.0.
#
# RESULT: Editor.dc.html ~6160 → ~6020 lines (−7.0 KB / ~140 lines); scad-emitter.js = 198 lines.
# VERIFIED: _programText() for a mixed model (treated cube/cylinder, torus, tube, wedge, 2D, linear_extrude
# twist+scale, rotate_extrude, boolean diff) is BYTE-IDENTICAL pre/post (1369 chars, captured via localStorage
# across reload). Live round-trips: difference/extrude editable, for-loop read-only, conformance 113/113.
#
# ⚠ RACE FIX (important, applies to all helmet modules): the old emitter was an always-present class method;
# an external module is loaded by an async-injected <script src> in the DC helmet. initThree seeds a default
# cuboid (addCuboid → regenCode → emitNode) the moment THREE fires `three-ready`, which can BEAT the helmet
# script's execution → "window.ScadEmitter is not a function" render crash. FIX: initThree now seeds via
# `_whenLibsReady(cb)` — polls (20ms) until window.ScadEmitter + window.ScadAuthoring exist, then seeds.
# Any FUTURE mount-time use of a helmet module must go through the same gate; user-triggered paths (runCode)
# are safe because they fire long after load.
#
# AUTHORING-LAYER EXTRACTION COMPLETE: parser+evaluator (v0.52, scad-authoring.js) + emitter (v0.53,
# scad-emitter.js) now both live outside Editor.dc.html, joining scad-engine.js + mesh-parsers.js. What
# remains in the god component is genuinely THREE/scene/React-coupled (geometry builders, CSG, face detection,
# push/pull, gizmo, UI template) — per CLAUDE.md that belongs in the component.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.52.0 — Refactor: extract SCAD authoring parser + expression evaluator → public/scad-authoring.js  ✅ SHIPPED
# ===================================================================================================
# GOAL: continue breaking up the Editor.dc.html god component (audit #1 pulled the mesh parsers; this is
# the next genuinely-pure unit). Move the SCAD→authoring-tree RECONSTRUCTION PARSER and the arithmetic
# EXPRESSION EVALUATOR into a sibling IIFE module `window.ScadAuthoring`, like scad-engine.js / mesh-parsers.js.
#
# WHY THIS UNIT: a code-audit-style scan shows only TWO of these methods are called from outside the
# parser — `evalExpr` (expression-editing UI) and `parseScad` (runCode). Everything else
# (tokenizeExpr, toRPN, splitArgs, argRaw, argVector, matchParen, matchBrace, stripModules, statementEnd,
# parsePolyPoints, tokOrNum, numArg, readPosTokens, readRotTokens, readPrimitive, parseBlock) is
# parser-internal. So the bodies can move wholesale and the editor keeps just two thin delegating wrappers.
#
# DEPENDENCIES TO INVERT (the only `this.*` the parser/evaluator reach for):
#   - varMap()      → evaluator default scope. Module evalExpr takes `vars` explicitly; the editor wrapper
#                     supplies `vars || this.varMap()`.
#   - reserved(n)   → parseScad skips reserved names when harvesting top-level params. Passed via ctx.reserved.
#   - restingPos(n) → default position for a primitive with no translate() wrapper. Passed via ctx.restingPos.
#   - this._vmap    → transient parse scope; becomes a threaded `vmap` arg inside the module and is DROPPED
#                     from the editor (nothing else referenced it).
#
# MODULE API (window.ScadAuthoring):
#   pure:    splitArgs, argRaw, argVector, matchParen, matchBrace, statementEnd, stripModules, parsePolyPoints
#   eval:    tokenizeExpr, toRPN, evalExpr(str, vars), tokOrNum(tk, vmap)
#   readers: readPosTokens(inner,vmap), readRotTokens(args,vmap), numArg(args,key,dflt,vmap), readPrimitive(name,args,vmap)
#   blocks:  parseBlock(src, ctx{vmap,restingPos}), parseScad(txt, ctx{reserved,restingPos}) → {vars, tree, vmap}
#
# BUILD ORDER:
#  1. [x] Write public/scad-authoring.js (IIFE → window.ScadAuthoring), de-`this`'d, vmap/restingPos/reserved threaded.
#  2. [x] Add <script src="scad-authoring.js"> in helmet after mesh-parsers.js.
#  3. [x] Editor: delete the 18 moved methods + tokenizeExpr/toRPN; replace with two wrappers —
#         evalExpr(str,vars){ return ScadAuthoring.evalExpr(str, vars || this.varMap()); }
#         parseScad(txt){ const r = ScadAuthoring.parseScad(txt,{reserved:n=>this.reserved(n),restingPos:n=>this.restingPos(n)}); return {vars:r.vars, tree:r.tree}; }
#  4. [x] Verify via eval_js: extrude round-trip (v0.51.0 cases) still editable; expression-bound dims still
#         evaluate (param + arithmetic); for-loop/text/color still read-only; conformance 113/113; clean boot.
#  5. [x] Version badge + VERSION → 0.52.0; release snapshot OpenSCAD-GUI-v0.52.0.
#
# RESULT: Editor.dc.html 6450 → ~6200 lines (−12.9 KB / ~250 lines); public/scad-authoring.js = 333 lines,
# 18 exported fns. restingPos stays in the editor (still used by placeOnFloor + hydrate). Verified via
# eval_js: extrude height/twist round-trip editable (dims {height:45,twist:30,escale:1}); param w=25 →
# cube dims {25,50,10} with expr bindings {x:'w',y:'w*2'} preserved (proves evalExpr wrapper + tokOrNum
# thread editor scope correctly); for-loop/color stay read-only; conformance 113/113; boot clean (no logs).
# INVARIANT PRESERVED: parseScad's reconstructible subset must still match isAdvanced's SIMPLE gate (v0.51.0).
# Moving the parser doesn't change its grammar — same functions, same behavior, just relocated + parameterized.
# NEXT (optional, not started): the OpenSCAD EMITTER (emitNode/emitPrimitive/baseCall/cylProfile/dimTok) is
# the remaining authoring-layer unit, but it's more fmt/gfn/tree-coupled — extract behind a renderer context if pursued.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.51.0 — Dual-parser parity: extrudes + 2D primitives stay GUI-editable (B2 / read-only-tree extrusion bug)
# ===================================================================================================
# SYMPTOM (reproduced): build a 2D shape + linear/rotate_extrude in the GUI → fully editable. Edit ONE
# number in the code (e.g. linear_extrude(height = 30) → 45) and the whole program PERMANENTLY dropped
# to read-only. Root cause = "dual-parser fragility": three independent judges of "is this GUI-editable"
#   1. readTreeSnapshot/hydrateFromSnapshot — byte-exact `// @scs-tree {json}` round-trip; ANY hand-edit
#      (even whitespace) breaks the equality check and the snapshot is discarded.
#   2. isAdvanced(ast) — the engine-AST gate that picks simple (GUI) vs advanced (read-only). Its SIMPLE
#      set was {translate,rotate,cube,cylinder,sphere,union,difference,intersection,hull} — NO extrudes,
#      NO 2D prims. So every extrude/2D program that lost its snapshot fell here → advanced → read-only.
#   3. parseScad/parseBlock/readPrimitive — the GUI reconstructor, which ALSO only handled
#      cube/cylinder/sphere + those booleans. The snapshot was the ONLY thing keeping GUI extrudes alive.
# INVARIANT that makes the gate safe: isAdvanced's accepted set MUST be a subset of what parseScad can
# faithfully reconstruct (else the GUI tree silently drops geometry and regenCode overwrites the user's
# code). The fix EXTENDS BOTH in lockstep so a simple extrude/2D program reconstructs without the snapshot.
# CHANGES (all public/Editor.dc.html):
#   - readPrimitive: now reconstructs circle (d=/r=/positional), square ([x,y] or scalar, centered like
#     the emitter), polygon (via parsePolyPoints — numeric [x,y] pairs, outer bracket ignored).
#   - parseBlock: PRIMS += circle/square/polygon; new EXTRUDES = [linear_extrude, rotate_extrude] handled
#     as op-groups carrying dims {height,twist,escale} or {angle}. Handles BOTH braced `{…}` and
#     brace-less single-child forms (`linear_extrude(10) circle(5);`) via new statementEnd() — required
#     because isAdvanced can't tell brace from brace-less, so the reconstructor must accept both or the
#     invariant breaks. New helpers: parsePolyPoints, numArg (named or leading-positional height/angle),
#     statementEnd (end of one statement: top-level `;` or a balanced `{…}`).
#   - buildNodeFromParsed: group branch now labels extrudes ("Linear-extrude N"/"Rotate-extrude N") and
#     CARRIES p.dims onto the node (was dropped → extrude params lost). Leaf branch labelMap covers
#     circle/square/polygon (was hard-wired to Cuboid/Sphere/Cylinder).
#   - isAdvanced: SIMPLE set += linear_extrude, rotate_extrude, circle, square, polygon. Comment now
#     states the subset-of-parseScad invariant explicitly.
# VERIFIED via eval_js: GUI extrude → edit height → STAYS editable, tree = [cuboid, linear_extrude→circle],
# height reads 45. rotate_extrude(270) translate circle (brace-less) → editable, angle 270. square/polygon
# extrudes, twist+scale (dims {height:40,twist:90,escale:0.5}), bare 2D square → all editable + render.
# Genuinely-advanced still read-only: for-loop, linear_extrude text(), color() cube. Conformance 113/113.
# STILL OPEN (B2 remainder): delete of NESTED items inside a boolean/extrude in read-only view (needs
# sub-statement provenance); the snapshot byte-equality check itself is still brittle, but extrudes/2D no
# longer DEPEND on it — they survive via parser parity now.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.50.3 — Refactor: color palette token table + panelChrome() helper (audit item #2)
# ===================================================================================================
# WHY: audit finding #2 — no single palette source (106 distinct color tokens / 590 uses) and the
# floating-panel chrome string (bg+blur+border+radius+shadow) was repeated ~9× across panel/menu styles.
# WHAT: added two class fields right after the Z scale:
#   - `C = {...}` — documented design-token table: surfaces (void/bg/surface/surface2), borders
#     (line/border/borderStrong/borderBlue), a text ramp (textBright→textDisabled), accent blues,
#     semantic red/green/amber, glass fills, and elevation shadows (shadowSm/Md/Lg/Xl/Ctx).
#   - `panelChrome(o)` — returns the repeated chrome recipe; defaults match the standard inspector
#     panel, overridable via {bg, blur, border, r, shadow}. Output is BYTE-IDENTICAL to the old
#     literals (verified via eval_js comparing tree/params/edge/file styles).
# APPLIED: the 9 panel/menu base strings (tree, params, shape, group, edge, lib, thread, file, and
#   both context-menu strings) now call ${this.panelChrome({...})} with C tokens instead of inline
#   chrome literals. No visual change — re-rendered identically.
# SCOPE NOTE (same constraint as #2/#3): the ~229 color literals in TEMPLATE markup stay inline
#   (holes would delay first paint); they mirror the C table, which is now the documented reference.
#   3 markup chrome strings remain by design (tool-rail flyout L263/L279, deferred-extrude box L734).
# No engine changes; conformance unaffected. AUDIT ITEMS #1, #2, #3 all now complete.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.50.2 — Refactor: named z-index scale (audit item #3)
# ===================================================================================================
# WHY: audit finding #3 — 18 ad-hoc z-index values (25–70) scattered across the file with no scale;
# this is exactly why the mobile drawer (47) had to be hand-tuned to dodge inspector panels (34/35).
# WHAT: added a single source-of-truth `Z = { hud:25, drawerBody:28, drawerTab:29, chrome:30,
#   panel:33, panelMid:34, panelTop:35, submenu(Scrim):39/40, fn(Scrim/Menu):40/41, menu(Scrim):44/45,
#   mobileFab:46, mobileDrawer:47, ctx(Scrim/Menu):48/49, overlay:60, modal:70 }` class field, with a
#   doc comment naming every tier. All CONDITIONAL / JS-computed overlay styles in renderVals now
#   interpolate this.Z.* (drawer + mobile drawer/FAB, tree/params/shape/group/edge panelStyle bases,
#   lib/thread/file menus, read-only badge, both context-menu strings, push/pull HUD). Values are
#   byte-identical to before — stacking behavior unchanged, just single-sourced.
# KEPT AS LITERALS (by design): the static base-chrome z-indexes written directly in template markup
#   (status pill 25, toolbar/rail 30, menu scrims 39/40/44/48, deferred-extrude box 34, imports chip
#   29, loading overlay 60, modal 70) — turning these into {{holes}} would delay first paint. They are
#   documented in the Z table's comment and must be kept in sync with it.
# No engine changes; conformance unaffected. Editor verified to boot + Z resolves correctly via eval_js.
# REMAINING AUDIT ITEM: #2 — JS palette/chrome helper for the repeated panel-chrome string
#   (rgba(27,30,35,..)+blur ×9) and 83 distinct hex colors. Still open.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.50.1 — Refactor: extract mesh/vector parsers into public/mesh-parsers.js
# ===================================================================================================
# WHY: code-audit finding #1 — Editor.dc.html was a ~6800-line god component. The file-format
# parsers are pure (no `this`, no THREE, no editor state), so per CLAUDE.md they belong in a plain
# .js helper module (testable in isolation, like scad-engine.js).
# WHAT MOVED → public/mesh-parsers.js (window.MeshParsers, IIFE, 25 fns, 8 public entry points):
#   parseSTL/parseBinarySTL/parseAsciiSTL, parseOFF, parse3MF/parseAMF/meshXmlToPositions/
#   unzipEntries/inflateRaw, parseDAT, parsePNG (surface heightmaps), and the whole SVG stack
#   (parseSVG + identMat2/applyMat2/mulMat2/svgTransform/svgEllipsePts/svgPointList/
#   svgPathContours/flatArc) + DXF stack (parseDXF/dxfPolyPoints/arcFromBulge/circleFrom3/
#   chainDxfSegments). Internal cross-calls de-`this`'d to bare fn calls.
# WHAT STAYED in Editor.dc.html (needs THREE / editor state): importGeometry/importMesh,
#   surfaceGeometry/surfaceMesh/collectSurfaceNodes, loadSvgFiles/afterSvg/removeSvg and the
#   collect*Nodes walkers, plus the FileReader orchestration in the import drop handlers.
# WIRING: <script src="mesh-parsers.js"> in helmet right after scad-engine.js. The 8 external call
#   sites now read window.MeshParsers.parseX(...). Result: Editor 6784 → 6313 lines (−471);
#   mesh-parsers.js = 507 lines. Conformance still 113/113; all parsers re-verified via eval_js.
# NEXT AUDIT ITEMS (not done): #2 JS palette/chrome helper for repeated panel styles + 83 hex
#   colors; #3 a named z-index scale (18 ad-hoc values 25–70). Both still open.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.50.0 — Mobile / touch layout
# ===================================================================================================
# REQUEST: "work on mobile touch" — make the editor usable on a phone.
# CONTEXT: gestures already work (canvas uses pointer events + touch-action:none; OrbitControls does
# orbit/pan/pinch; tree long-press menus exist). The gap was LAYOUT — desktop-fixed floating panels,
# a 420px side code-drawer, and a camera view-offset that assumes that drawer always occupies the
# right ~40% of the screen. All of that breaks below ~760px.
# APPROACH (gated by a reactive `isMobile` flag = matchMedia('(max-width:760px)'), desktop untouched):
#   - state: isMobile, mobileTreeOpen. Set in componentDidMount via matchMedia 'change' listener;
#     entering mobile also closes the code drawer (drawerOpen:false) and re-applies view offset/resize.
#   - applyViewOffset(): on mobile clear the 1.42× right-offset so the model centers in the full canvas.
#   - panelStyle(key,base): on mobile, append a bottom-sheet override (left/right:0; bottom:0; width
#     100%; rounded top; max-height 82vh; scroll) — keeps each panel's own background/border/z-index so
#     inspector sheets (z34/35) still stack above the model-tree sheet (z30). Drag-position is ignored.
#   - code drawer: on mobile full-screen slide-in (drawerStyle inset:0) + a pill FAB (drawerTab) bottom-
#     right to open, and a mobile-only "Done" button in the drawer header to close.
#   - model tree: on mobile it's a collapsed bottom bar; tapping the header toggles mobileTreeOpen
#     (onTreeHeaderClick) which shows/hides the scroll body (treeScrollStyle += display:none) and a
#     caret (treeCaretStyle). The ns-resize handle is hidden on mobile (treeResizeStyle).
#   - top toolbar wraps (flex-wrap + max-width:calc(100vw-32px)); bottom $fn/status pill hidden on
#     mobile (showStatusBar). Tool rail (40px buttons) already touch-sized — left as-is.
# renderVals exposes: isMobile, onTreeHeaderClick, treeCaretStyle, treeResizeStyle, showStatusBar.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.49.0 — Custom names for objects (rename)
# ===================================================================================================
# REQUEST: let users name objects — "Cuboid 1" → an editable field whose placeholder shows the type.
# DONE: the shape panel AND group panel headers now show the label as an inline-editable <input>
# (placeholder = defaultLabelFor(node), e.g. "Cuboid"/"Union"). Live: onInput → renameNode(id,name)
# updates node.label + syncShapesState (Model Tree + panel reflect immediately); onBlur/Enter →
# commitRenameNode (regenCode; restores a default label if cleared). Esc/Enter blur the field;
# onPointerDown stops propagation so editing doesn't start a panel drag. Labels are emitted ONLY as a
# code comment (// <label>), so any text is safe — verified node.label + "// Mounting plate" in code.
# methods: renameNode, commitRenameNode, defaultLabelFor. (Read-only/advanced rows aren't renamed this
# way — their labels come from the evaluated geometry; a future nicety could edit the [scs-part] comment.)
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.48.0 — Top toolbar condensed into a File ▾ menu (menu plan step 1)
# ===================================================================================================
# The top strip's right cluster was 4–5 always-on buttons (Open, Save .scad, Export STL, Import mesh,
# + Library in advanced) that crowded the code-drawer header / read-only badge. CONSOLIDATED into a
# single "File ▾" dropdown (state.fileMenuOpen) with sectioned items: Project (Open / Save) · Exchange
# (Export STL / Import mesh+vector / GitHub library [advanced]). Undo/redo stay as icon buttons (compact,
# frequent). Each item closes the menu then calls the existing handler (openFile/saveFile/exportSTL/
# openImport/open Library popover). Frees ~360px of top strip. handlers: toggleFileMenu/closeFileMenu +
# miOpen/miSave/miExport/miImport/miLibrary in renderVals; fileMenuStyle/fileItemStyle.
# MENU PLAN status: ✅ draggable popovers (v0.47) ✅ resizable tree (v0.47) ✅ toolbar condensed (v0.48).
# Still open (optional): move the read-only badge into the drawer header; a global Delete affordance.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.47.0 — UI accessibility bugs (12/13/14) + model-tree duplicate-id robustness fix
# ===================================================================================================
# BUG 12 (draggable popovers) ✅: Thread & hardware AND GitHub Library popovers now drag by their
#   header (onPointerDown=startPanelDrag('thread'|'lib'); style via panelStyle(key, base) so a dragged
#   position pins left/top and clears the default. Same machinery as the shape/group/params/tree panels.
# BUG 13 (resizable Model Tree) ✅: the tree scroll area height is now state.treeHeight (default 210),
#   with a bottom-edge drag handle (startTreeResize → clamps 96…vh-180). treeScrollStyle uses it.
# BUG 14 (delete reachability) — INVESTIGATED + the real bug found: the per-row trash button WAS
#   already always rendered (verified 2 buttons present with no selection), so "only on selection" was
#   a symptom of the duplicate-id bug below, not a missing button. Delete works per-row + via keyboard.
# ROBUSTNESS BUG (the big one — "model tree not robust with threads"): every top-level evaluated part
#   serialized to the SAME id. Cause: collapseGeomRow hoists a single child's id up, and each part's
#   sole child sits at child-index 0 depth 1 → all became 'g1_0'. Colliding ids meant selecting/deleting
#   one row hit another. FIX: serializeGeom now re-stamps the whole top-level subtree with a unique
#   top-index prefix (reidRow → 't0', 't1', 't2', children 't0_0'…). Verified ids unique; deleting the
#   middle of 3 threads removes exactly that part. ALSO: deleteReadOnlyRow now swallows the leading
#   "// … [scs-part]" comment so a delete doesn't leave an orphan that miscounts the next part's X offset.
# methods: startPanelDrag('thread'|'lib'), startTreeResize, reidRow; state += treeHeight.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.46.0 — Thread moved from top toolbar INTO the shape tool palette (as advanced hardware)
# ===================================================================================================
# RATIONALE (user): threads are GEOMETRY creation (an advanced shape), not file I/O — so the Thread
# entry was wrong sitting next to Open/Save/Export/Import/Library. MOVED: removed the top-toolbar
# "Thread" button; added a "Hardware → Thread & hardware…" item to the left-palette "More shapes…"
# flyout (in the advancedMode-gated section, alongside the 2D-for-extrude shapes). It sets
# {shapeMenuOpen:false, threadOpen:true} → opens the existing Thread & hardware popover unchanged.
# This also starts executing the MENU PLAN step 1 (declutter the top strip): the top toolbar's
# Insert-y items now begin migrating to the palette; Library still sits up top (it's a project/import
# concern, defensible there). handler: miThread in renderVals.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — v0.45.1 bug fixes (evaluated-tree drop, Run hidden) + menu plan
# ===================================================================================================
# FIX 1 — "evaluated view keeps dropping all components": adding a GUI primitive (Add cuboid, etc.)
# while in READ-ONLY/advanced view called addPrimitive → this.tree.push + regenCode, but in read-only
# this.tree IS the evaluated geom tree, so regenCode serialized garbage and WIPED the threads. FIX:
# addPrimitive now detects readOnly and routes to appendPrimitiveCode() — emits the shape as OpenSCAD
# (emitNode) and APPENDS it to the document (tagged [scs-part]) + re-runs, so it joins the evaluated
# parts instead of wiping them. Verified: thread (1 row) + Add cuboid → 2 rows, both in code, still RO.
# FIX 2 — render robustness: finishAdvanced wrapped the whole realize loop in ONE try/catch, so a
# single failing part (heavy CSG) aborted ALL parts. Now each node has its OWN try/catch.
# FIX 3 — "Run button hidden in advanced view": the code-drawer header (model.scad / Run / Copy) sat
# at top:0 and was COVERED by the top toolbar's right end (Import mesh). FIX: drawer dropped to
# top:64px (below the toolbar); read-only badge moved to top:74 / right:436-when-open so it clears
# both. Thread popover got max-height + overflow-y. Verified Run is no longer covered.
#
# ===== MENU ACCESSIBILITY PLAN (the "larger menus need a better plan" request — phased, not built) =====
#  1. [ ] Condense the top toolbar: collapse Open/Save/Export/Import into a "File ▾" menu and
#         Library/Thread into an "Insert ▾"/"Hardware ▾" menu — frees ~400px of top strip.
#  2. [ ] Make the Library/Thread popovers DRAGGABLE (reuse panelPos + startPanelDrag).
#  3. [ ] Make the Model Tree panel resizable (bottom-edge drag → stored height).
#  4. [ ] Move the read-only badge into the drawer header (chip next to model.scad).
#  5. [ ] Surface Delete for the current selection globally (not only via a Model-Tree selection).
# ===================================================================================================

# ===================================================================================================
# HANDOFF — Thread/bolt polish (chamfer lead-in, hole cutter, washer, hex nut) + APPEND fix — ✅ SHIPPED v0.45.0
# ===================================================================================================
# APPEND FIX (the reported bug): insertThread now READS the current code and APPENDS the new part
# (offset +X by part-count × ~3.2·d), de-duping helper modules via `cur.includes('module …')`. Each
# part is tagged `// … [scs-part]` (used to count parts → offset). Empty editor → first part at origin.
# Verified: rod then bolt → both render side-by-side (no wipe); helpers emitted once.
# NEW KINDS (Thread tool → Rod | Bolt | Nut | Washer | Hole), all render 0-error (verified):
#  - Washer: `module washer` (linear_extrude annulus) — NO CSG.
#  - Hole cutter (counterbore | countersink): `module hole_cutter` (one rotate_extrude) — NO CSG;
#    subtract from your part. UI shows the difference() hint.
#  - Chamfered lead-in toggle (rod/bolt): `module chamfered_thread` = intersection(thread, 45°
#    rotate_extrude envelope). CSG → slower (multi-second), gated behind the toggle.
#  - Hex nut: intersection(round nut annulus, hex prism). CSG.
# UI: 5-way kind selector (wraps), per-kind control rows (head / chamfer / nut outer round|hex /
# hole recess), header renamed "Thread & hardware", designation kind-aware. methods: buildThreadScad(cur)
# (append-aware, deduped helpers, per-kind literal-arg calls), insertThread() reads cur + Added/Generated
# flash. state.thread += { chamfer, nutHex, hole }.
#
# ===== FUTURE BUGS (logged 2026-06-26, NOT yet fixed) =====
#  - [ ] The Thread & hardware popover is NOT draggable/movable (the floating panels use a panelStyle
#        + dragShape/dragGroup/etc. pattern; the lib/thread popovers are fixed-position with a
#        full-screen click-catcher). FIX: give them a draggable header via the same panelPos/startPanelDrag
#        machinery the shape/group/params/tree panels use.
#  - [ ] The Model Tree window is NOT resizable (fixed max-height:210px scroll area). FIX: add a drag
#        handle on its bottom edge to set a stored height (like panelPos but a size).
#  - [ ] Delete is only reachable when a component is selected in the Model Tree (the Delete button
#        lives in the shape/group panel, which only shows for a live selection; advanced/read-only
#        parts have no panel → delete only via the tree kebab/context menu). FIX: surface delete for
#        the current selection more globally (e.g. a delete affordance on the row hover, or restore a
#        toolbar delete that works for read-only top-level rows too).
# ===================================================================================================

# ===================================================================================================
# BACKLOG — Undo (≥1 level) (filed 2026-06-26) — ✅ SHIPPED v0.44.0 (multi-level)
# ===================================================================================================
# Cmd/Ctrl-Z = undo, Shift-Cmd/Ctrl-Z (or Ctrl-Y) = redo, plus toolbar undo/redo buttons (disabled
# when their stack is empty). Snapshots the CODE STRING (the single source of truth), so it works
# uniformly across GUI authoring AND advanced read-only edits, and across the boundary between them
# (verified: GUI add → generate thread (advanced) → undo returns to the GUI authoring state).
# IMPLEMENTATION (Editor.dc.html):
#  - Stacks `_undo`/`_redo` (cap 40) + `_pushHist(prev)` (dedupes + 500ms coalescing so a gizmo
#    drag's stream of regens collapses to one entry) + `_restoreCode()` + `undo`/`redo`.
#  - GUI chokepoint: regenCode() records the pre-edit code. Rebuild paths that ALSO call regenCode
#    (hydrateFromSnapshot, runCode-simple-rebuild) set `_suppressHist=true` so they don't self-record;
#    regenCode clears the flag after reading it. runAdvanced clears it too (it never calls regenCode).
#  - Advanced mutations bypass regenCode (they set state.code directly): _pushHist() added before the
#    5 code-overwrite sites (push/pull add, revolve, read-only delete, transform, combine) + thread gen.
#  - Code-editor typing keeps the browser's native textarea undo (onKey early-returns inside inputs).
# ===================================================================================================

# ===================================================================================================
# HANDOFF — Bolts + thread-as-boolean-tool + CSG uv fix — ✅ SHIPPED v0.43.0
# ===================================================================================================
# 1) CSG uv BUG FIXED (the one filed under v0.42.0): ringsToSolid() now zero-fills a `uv` attribute on
#    every extrude solid (the twist loft / revolve emit none), so difference()/union() of a primitive
#    + a thread `linear_extrude` no longer throws "Attribute uv not available". VERIFIED: a block with
#    a threaded hole cut in (difference), and a threaded cylinder (union), both render. This directly
#    enables the user's "subtract a threaded cylinder from another shape" workflow.
# 2) BOLTS: the Thread tool is now a 3-way Rod | Bolt | Nut. Bolt = head + threaded shaft unioned into
#    one solid, head types Hex (hex prism, AF=1.5d) / Socket cap (cyl head + hex recess) / Countersunk
#    (flat-top cone). Head dims auto-derive from nominal d (ISO-ish) and stay editable in code; an
#    optional `shank` gives an unthreaded section. VERIFIED: hex/socket/countersunk all render 0-error.
# 3) TOLERANCE DIRECTION (the user's concern) is handled by `internal` inside iso_thread:
#       Rmaj = d/2 + (internal ? +tol : -tol)
#    External (rod/bolt) SHRINKS by tol; internal (nut bore) GROWS by tol — so a nominal pair mates
#    with `tol` radial clearance regardless of which side you generate. The popover hint now states
#    the direction per kind ("Rod/bolt shrinks by this" vs "Nut bore grows by this").
# methods: buildThreadScad() (rod/bolt/nut branches + bolt_head module), setThread(), THREAD_TABLE;
# state.thread = { kind:'rod'|'bolt'|'nut', size, fine, pitch, len, lh, tol, head }.
#
# NOTE for "thread as a cutter into arbitrary geometry": subtract a ROD generated with the SAME tol
# you'd want as clearance — the cut cavity ends up tol larger than the rod, i.e. an internal thread
# with clearance. (A dedicated "cutter" preset that emits the male solid at +tol could be a future
# nicety, but difference(yourBlock, rod) already works now that CSG+extrude is fixed.) CSG with the
# high-facet thread is heavy (multi-second) but completes.
# ===================================================================================================

# ===================================================================================================
# HANDOFF — Native thread support — ✅ SHIPPED v0.42.0 (Advanced-mode Thread tool)
# ===================================================================================================
# "Thread" button in the top bar (Advanced only) → popover generates a parametric ISO metric thread
# as engine-renderable OpenSCAD (renders read-only). Fusion360-like options + a parameterised fit
# tolerance, per the request. Controls: Rod | Nut (external/internal), Size M3–M30 (ISO table auto-
# fills pitch), Coarse | Fine pitch series, manual Pitch + Length, Direction RH | LH, and a radial
# Fit-clearance slider (0–0.6 mm) so printed male/female parts mate. Emits a clean self-contained
# module the user can keep editing (nominal_d / pitch / fit_tol / …).
#
# GEOMETRY (the key insight — NO CSG needed, so it never hits the three-bvh-csg uv bug):
#  - The thread tooth is a POLAR V-profile r(α): radius ramps Rmaj→Rmin over an angular half-width
#    beta, then the core arc at Rmin closes the loop → one simple closed polygon = a solid rod whose
#    `linear_extrude(twist = 360*turns)` spirals the tooth into a real helical thread. depth=0.6134·p
#    (ISO engagement). turns = len/p. dir = ±1 for hand. External applies tol as −radius, internal +.
#  - INTERNAL (nut): a twisted CIRCLE is rotationally invariant, so an ANNULAR polygon (plain outer
#    circle + the V-profile as an inner hole via polygon paths=) twist-extrudes to a straight-walled
#    nut with a helical bore — again a single extrude, no boolean. methods: buildThreadScad(),
#    THREAD_TABLE, setThread(), insertThread() in Editor.dc.html; UI = threadOpen popover + renderVals.
#
# KNOWN ENGINE BUG surfaced (NOT blocking threads, but worth a future fix): difference()/union() of a
# primitive (cylinder) with a twist `linear_extrude` throws "CSG Operations: Attribute uv not
# available on geometry" — the extrude brush from the brushFrom2D/ringsToSolid twist path reaches the
# Evaluator without a uv attribute that the primitive side has. extrudeBrush should zero-fill uv (and
# normal) on its geometry before evaluate, same as importGeometry/ringsToSolid do elsewhere. Filed
# for later; the thread feature avoids CSG entirely so it's unaffected.
# ===================================================================================================

# ===================================================================================================
# ===================================================================================================
# HANDOFF — GitHub library import + engine grammar extensions — ✅ SHIPPED v0.40.0 (importer);
#   BOSL2 full-render + Thread menu DEFERRED (engine recursion wall — see below)
#   (Advanced-mode feature; depends on the Basic/Advanced toggle)
# ===================================================================================================
# SHIPPED v0.40.0 — "Library" button in the top bar (Advanced only) opens a GitHub importer popover:
# type `owner/repo`, `owner/repo@tag`, or a full GitHub URL (tree/branch/subdir parsed), or click a
# preset (BOSL2 / Round-Anything / NopSCADlib). It resolves the default branch, lists the repo tree
# via the GitHub API, fetches every `.scad` over `raw.githubusercontent.com` (CORS-OK, ~0.4s for 56
# files), and stores them in the existing include/use `_scadFiles` map keyed by lowercased BASENAME —
# which is exactly what the engine resolver strips `<BOSL2/std.scad>` down to, so includes link with
# NO engine resolver change. Loaded files appear in the existing top-left chip strip (remove ×) and
# re-run the model. Verified: BelfrySCAD/BOSL2 → 67 files loaded; spec parsing handles URL + @ref +
# subdir. Methods (Editor.dc.html): parseGithubSpec, resolveRef, fetchGithubLib + state libOpen/
# libSpec/libBusy/libMsg + the popover UI + renderVals.
#
# ENGINE GRAMMAR EXTENSIONS (scad-engine.js, shipped same release, conformance still 113/113):
#  - echo(...) / assert(...) in EXPRESSION position (`cond ? echo("…") v : v`) → parsePrimary emits
#    echoexpr/assertexpr, evaluator runs the side effect then returns the trailing expr.
#  - Interleaved comprehension elements in a vector literal: `[a, each list, if(c) d, for(i=r) i]`
#    (previously only a comprehension at the START of `[…]` parsed). New parseVecItem/parseCompElem/
#    parseVecItemBody; `case 'vector'` now expands `.c` (comp) items via runComp. Verified
#    `[1, each [2,3], if(true) 4, for(i=[5:6]) i, 7]` → [1..7].
#  - Calling a function-VALUE expression: `geom[5](anchor)`, curried `f(a)(b)` → parsePostfix emits
#    `callexpr` on any non-ident callee; evaluator applies the `__fn`. Verified `f[0](5)`.
#
# WHY BOSL2 STILL WON'T RENDER (and the Thread menu is deferred): after the three grammar fixes,
# BOSL2 parses much further but evaluation hits **"Maximum call stack size exceeded"** — BOSL2's
# deep functional recursion overflows the engine's RECURSIVE tree-walking evaluator. That is an
# ARCHITECTURAL limit: fixing it needs either (a) trampolining/CPS the evaluator (large), or (b) the
# openscad-wasm fallback (the long-deferred Phase 10/13 escape hatch) to render BOSL2 at 100%
# fidelity. A couple of niche parse gaps also remain (`(each a)` grouped comp element in parens;
# attachable() never registers because attachments.scad still has one unparsed line). The importer
# itself is fully shipped and works for libraries within the engine's coverage.
#
# NEXT STEPS for the Thread menu (pick one, ask the user):
#  A. Native thread generator — emit engine-renderable OpenSCAD (helical thread via
#     `linear_extrude(height, twist=…) translate([r,0]) polygon(profile)`, which the engine already
#     renders) for a self-contained Thread/Screws menu that needs NO BOSL2. Lowest risk, ships now.
#  B. openscad-wasm fallback — run advanced/unsupported programs (incl. BOSL2) through the real
#     OpenSCAD compiled to WASM for 100% fidelity; then the BOSL2 Thread menu works as originally
#     envisioned. Bigger lift; also closes the deferred Phase-13 differential-fidelity item.
# DEFERRED: path-aware library store (NOT needed for BOSL2 — it's flat + basename strip works; only
# needed if two libs collide on a basename). Live-fetch chosen over vendoring (fetch is ~0.4s, CORS
# is fine, keeps repo light).
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
