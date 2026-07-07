# TODO

## Feature requests

- [x] **Open a file passed on the URL** (deep link). `index.html?github=owner/repo[@ref]
  [/path/to/file.scad]` (github.com URLs accepted, `&file=<basename>` picks entry) or
  `?file=<url>`. Whole repo fetched via the @github path so includes + nested tags
  resolve; entry file promoted to the editor and run. Shipped v0.58.0; e2e scenario 2
  in tests/github-import-case.e2e.js. (Logged + shipped 2026-07-07.)
