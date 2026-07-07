# TODO

## Feature requests

- [ ] **Better zoom control / snap-to-fit-all.** Add a "fit all" zoom function (frame the
  whole model in the viewport) and generally better zoom control. (Logged 2026-07-07.)

- [ ] **Custom shapes (module instances) in the tree viewer.** Unknown-but-defined library
  modules (e.g. `capsule()` from an @github import) should appear in the Model Tree as
  named module-instance nodes with translate/rotate/scale editing. In progress 2026-07-07;
  plan in HANDOFF.md.

- [x] **Open a file passed on the URL** (deep link). `index.html?github=owner/repo[@ref]
  [/path/to/file.scad]` (github.com URLs accepted, `&file=<basename>` picks entry) or
  `?file=<url>`. Whole repo fetched via the @github path so includes + nested tags
  resolve; entry file promoted to the editor and run. Shipped v0.58.0; e2e scenario 2
  in tests/github-import-case.e2e.js. (Logged + shipped 2026-07-07.)
