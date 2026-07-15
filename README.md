# OpenSCAD-GUI

A browser-based OpenSCAD editor + viewer. It parses, evaluates, and renders OpenSCAD
programs live: simple programs stay GUI-editable (gizmos, inspector, model tree); advanced
programs are evaluated by a real interpreter and rendered read-only with an evaluated model
tree and an echo/warn/error console.

## Repository layout

```
public/              ← the deployable site — point any static host at this folder
  index.html         ← entrypoint
  Editor.dc.html     ← the editor UI (Design Component, imported by index.html)
  scad-engine.js     ← the OpenSCAD interpreter (lex → parse → evaluate → geometry tree)
  scad-authoring.js  ← SCAD → authoring-tree reconstruction parser + expression evaluator
  scad-emitter.js    ← authoring-tree → OpenSCAD source-text generator
  mesh-parsers.js    ← STL/OFF/3MF/AMF/SVG/DXF/DAT/PNG import parsers
  conformance.js     ← test batteries (engine + GUI classification), run from the editor
  Roboto-Regular.ttf ← bundled font face for text() glyph shaping
  support.js         ← Design Component runtime (required by the .dc.html files)

CLAUDE.md            ← project instructions + the full language-coverage roadmap/scoreboard
HANDOFF.md           ← in-flight design notes / resumable build plan
README.md            ← this file
screenshots/         ← reference captures (not part of the site)
```

Everything the site needs is inside **`public/`**, and every reference within it is
relative — so the folder is fully self-contained and can be copied elsewhere and served
from any path.

## Serving the site

It is plain static files; no build step. Point any static host at `public/`:

```bash
# from the project root
cd public && python3 -m http.server 8000
# then open http://localhost:8000/
```

Or copy/sync `public/` into another site (e.g. `rsync -a public/ /var/www/scad/`,
a `public/` deploy directory on Netlify/Vercel/GitHub Pages, etc.) and serve it from there.

Note: the editor loads three.js, three-bvh-csg, and ConvexGeometry from a CDN at runtime,
so the served site needs network access for those modules.

## Development

The editor is authored as a Design Component (`public/Editor.dc.html`); `index.html` mounts
it. `public/scad-engine.js` is a dependency-free interpreter that emits an abstract geometry
tree, which the editor realizes into three.js meshes / three-bvh-csg brushes.

- `CLAUDE.md` holds the durable per-phase coverage scoreboard — update its checkboxes when a
  feature ships.
- `HANDOFF.md` holds detailed notes for whatever is currently in flight.
- `support.js` is the auto-managed DC runtime; it lives only in `public/`. If the platform
  regenerates a copy at the project root during editing, delete it.

## Special comments

The editor recognizes a few `//` comments that are **inert to the OpenSCAD engine** (comments
are stripped before parsing) but meaningful to the editor. They round-trip through the code —
edit or delete the comment and the editor honors it on the next run.

### `// @annotate measure { … }` — measurement annotations

Created by the **Measure** tool (tool rail, or press **D**): click two points — they snap to
vertices, edge endpoints, and edge midpoints — then press **+ Annotate**. The measurement is
saved as one comment per annotation and redrawn on load as a dimension line + distance label:

```scad
// @annotate measure {"a":[-20,-20,40],"b":[20,-20,40],"d":40,"label":"width"}
```

- `a`, `b` — the two endpoints in model space (mm).
- `d` — the measured distance (mm), shown on the label.
- `label` — optional text prefixed to the distance.

Annotations are overlays only: they never affect geometry, are excluded from zoom-to-fit and
picking, and survive both GUI-editable and advanced (read-only) programs. Delete the comment
(or remove the annotation in the editor) to drop it.

### `// @scs-tree { … }` — GUI authoring snapshot (managed — don't hand-edit)

When a program is GUI-editable, the editor appends a JSON snapshot of the authoring tree so a
reload reproduces the exact Model Tree. It is validated against the code on load: if you
hand-edit the OpenSCAD so the snapshot no longer matches, the snapshot is discarded and the
normal parser/evaluator takes over. Treat it as machine-managed.

## Pulling in libraries (`use` / `include`)

Standard OpenSCAD library statements are supported and resolved two ways:

```scad
use <MCAD/involute_gears.scad>;   // import only its modules & functions
include <params.scad>;            // splice the whole file inline (variables + geometry)
```

- **`use <file>`** brings in only the file's `module`/`function` definitions.
- **`include <file>`** inlines the file's entire statement list (parameters, defs, and geometry).

Both resolve against files you provide to the editor: **drag a `.scad` file onto the viewport**,
or pull one from the **GitHub library** panel. Files are keyed by lowercased basename; nested
`use`/`include` resolve recursively (cycles are guarded). An unresolved file logs a warning in
the console and renders nothing for that reference.
