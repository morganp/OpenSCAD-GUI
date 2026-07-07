# TODO

## Feature requests

- [ ] **Better zoom control / snap-to-fit-all.** Add a "fit all" zoom function (frame the
  whole model in the viewport) and generally better zoom control. (Logged 2026-07-07.)

- [x] **Custom shapes (module instances) in the tree viewer.** Library modules (e.g.
  `capsule()` from an @github import) appear in the Model Tree as named module-instance
  nodes with translate/rotate/scale editing; advanced/read-only trees show named module
  rows too. Shipped v0.59.0; e2e scenario 3 in tests/. (Logged + shipped 2026-07-07.)

- [x] **Open a file passed on the URL** (deep link). `index.html?github=owner/repo[@ref]
  [/path/to/file.scad]` (github.com URLs accepted, `&file=<basename>` picks entry) or
  `?file=<url>`. Whole repo fetched via the @github path so includes + nested tags
  resolve; entry file promoted to the editor and run. Shipped v0.58.0; e2e scenario 2
  in tests/github-import-case.e2e.js. (Logged + shipped 2026-07-07.)
