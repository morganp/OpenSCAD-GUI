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

## Opening a file from the URL (deep link)

The editor can open a `.scad` file passed on the URL, so a plain link drops someone straight
into a rendered model. Two query parameters:

```
index.html?github=owner/repo[@ref][/path/to/file.scad]
index.html?file=<url-to-a-.scad-file>
```

- **`?github=`** takes the same spec grammar as the Library dialog:
  `owner/repo[@ref][/path/to/file.scad]`. github.com URLs (including `/blob/` and `/tree/`
  forms) are accepted too. If the spec names a file, that file opens in the editor; if it
  doesn't, add **`&file=<basename.scad>`** to pick the entry file (with neither, a repo that
  contains exactly one `.scad` opens it, otherwise the files just load as include chips).
- **`?file=`** takes a direct URL. github.com blob / raw.githubusercontent.com URLs are
  treated like `?github=` (the whole repo is fetched so sibling includes resolve); any other
  URL is fetched as plain text into the editor.

The whole repo is fetched through the same path as the manual Library dialog, so
`include <../lib.scad>` siblings and nested `// @github:` import tags resolve automatically.

Example — the [OpenSCAD_case](https://github.com/morganp/OpenSCAD_case) hinged-box demo on the
live deployment:

```
https://lizard-spock.co.uk/openscad-gui/?github=morganp/OpenSCAD_case/examples/hinged_box_demo.scad
```

## Development

The editor is authored as a Design Component (`public/Editor.dc.html`); `index.html` mounts
it. `public/scad-engine.js` is a dependency-free interpreter that emits an abstract geometry
tree, which the editor realizes into three.js meshes / three-bvh-csg brushes.

- `CLAUDE.md` holds the durable per-phase coverage scoreboard — update its checkboxes when a
  feature ships.
- `HANDOFF.md` holds detailed notes for whatever is currently in flight.
- `support.js` is the auto-managed DC runtime; it lives only in `public/`. If the platform
  regenerates a copy at the project root during editing, delete it.
