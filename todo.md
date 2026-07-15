# TODO

## Feature requests

- [ ] **Better zoom control / snap-to-fit-all.** Add a "fit all" zoom function (frame the
  whole model in the viewport) and generally better zoom control. (Logged 2026-07-07.)

- [x] **Custom shapes (module instances) in the tree viewer.** Library modules (e.g.
  `capsule()` from an @github import) appear in the Model Tree as named module-instance
  nodes with translate/rotate/scale editing; advanced/read-only trees show named module
  rows too. Shipped v0.59.0; e2e scenario 3 in tests/. (Logged + shipped 2026-07-07.
  Clobbered by the 0.59.0 release refactor; restored + unit-tested v0.63.0, 2026-07-15.)

- [x] **Open a file passed on the URL** (deep link). `index.html?github=owner/repo[@ref]
  [/path/to/file.scad]` (github.com URLs accepted) or `?file=<url>`. Whole repo fetched
  via the @github path so includes + nested tags resolve; entry file promoted to the
  editor and run. Shipped v0.58.0; e2e scenario 2 in tests/github-import-case.e2e.js.
  (Logged + shipped 2026-07-07. Clobbered by the 0.59.0 refactor; re-implemented v0.62.0
  as loadFromUrl; nested @github tags on the deep-link path restored v0.63.0, 2026-07-15.)

- [x] **`// @github:` auto-import tag** (incl. nested tags). Shipped v0.57.0; clobbered by
  the 0.59.0 release refactor (root cause of the hinged_box_demo deep-link report);
  restored v0.63.0 with unit cases in the conformance GUI battery + e2e scenario 1.
  (Restored 2026-07-15.)
