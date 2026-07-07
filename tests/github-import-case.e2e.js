#!/usr/bin/env node
// E2E regression test: the `// @github:` import tag auto-fetches a library repo
// (morganp/OpenSCAD_case) and the included module renders.
//
// Run:  cd tests && npm install && npm test
// Needs Google Chrome installed (uses the system Chrome via playwright-core,
// no browser download). Serves ../public on an ephemeral port itself.
//
// Exit code 0 = all assertions pass, 1 = at least one failure (details on stdout).

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const HEADLESS = process.env.HEADED ? false : true;

const CODE = `// @github: morganp/OpenSCAD_case
include <case_library.scad>

hinged_box(
    length        = 120,
    width         = 80,
    height        = 40,
    wall          = 2.4,
    corner_r      = 6,
    div_x         = 2,
    div_y         = 1,
    lid_text      = "TOOLS",
    lid_text_size = 12
);
`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let file = path.normalize(path.join(dir, urlPath === '/' ? 'index.html' : urlPath));
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const srv = await serve(PUBLIC_DIR);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ channel: 'chrome', headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // app + three.js init

  // Type the snippet exactly like a user: click into the code drawer textarea,
  // select-all, insert, then click Run (the click blurs the textarea, which fires
  // the native `change` the DC binding listens for).
  const ta = page.locator('textarea.scad');
  await ta.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+a' : 'Control+a');
  await page.keyboard.insertText(CODE);
  await page.getByRole('button', { name: 'Run' }).first().click();

  // GitHub trees API fetch + raw file downloads + re-run + CSG can take a while.
  await page.waitForTimeout(20000);

  const body = await page.evaluate(() => document.body.innerText);
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok, detail });

  check('library repo auto-fetched (case_library.scad chip present)',
    /case_lib/i.test(body),
    'expected a loaded-file chip for OpenSCAD_case/case_library.scad');
  check('include <case_library.scad> resolved (no missing-file warning for it)',
    !/case_library\.scad[^\n]*file not loaded/i.test(body),
    'engine warned that case_library.scad is not loaded');
  // Since the custom-shape feature (v0.59.0) a bare call to a fetched library module is a
  // SIMPLE program: it renders as a GUI-editable named module-instance node, not read-only.
  check('hinged_box renders as a GUI-editable custom shape (named Model Tree row)',
    /hinged_box 1/i.test(body) && !/read-only/i.test(body),
    'expected a "hinged_box 1" Model Tree row and no read-only badge');
  check('nested @github tag inside case_library.scad also fetched (hinge_library.scad)',
    !/hinge_library\.scad[^\n]*file not loaded/i.test(body),
    'the // @github: morganp/OpenSCAD_hinge tag inside the fetched case_library.scad was not scanned');
  check('living_hinge module resolves',
    !/unknown module 'living_hinge'/i.test(body),
    "engine reported unknown module 'living_hinge'");
  check('no engine render errors in console panel',
    !/ERROR/.test(body),
    (body.split('\n').filter((l) => /error/i.test(l)).join(' | ') || 'ERROR line present'));
  check('no uncaught page errors',
    pageErrors.length === 0,
    pageErrors.join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'github-import-case.last-run.png') });
  await page.close();

  // ---- Scenario 2: deep link — open a file passed on the URL ----
  const page2 = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const pageErrors2 = [];
  page2.on('pageerror', (e) => pageErrors2.push(e.message));
  await page2.goto(base + '/index.html?github=morganp/OpenSCAD_case/examples/hinged_box_demo.scad',
    { waitUntil: 'networkidle' });
  // startup repo fetch + entry promote + run + nested hinge fetch + re-run + CSG
  await page2.waitForTimeout(25000);

  const body2 = await page2.evaluate(() => document.body.innerText);
  const editor2 = await page2.evaluate(() => {
    const ta = document.querySelector('textarea.scad');
    return ta ? ta.value : '';
  });
  check('deep link: demo file promoted to the editor',
    /hinged_box\s*\(/.test(editor2),
    'expected hinged_box(...) in the code drawer, got: ' + editor2.slice(0, 120));
  check('deep link: sibling include auto-fetched (case_library chip)',
    /case_lib/i.test(body2),
    'expected a loaded-file chip for case_library.scad');
  check('deep link: nested hinge repo fetched too',
    !/hinge_library\.scad[^\n]*file not loaded/i.test(body2),
    'hinge_library.scad missing — nested @github tag not resolved on deep link');
  check('deep link: rendered with no console-panel errors',
    !/ERROR/.test(body2),
    (body2.split('\n').filter((l) => /error/i.test(l)).join(' | ') || 'ERROR line present'));
  check('deep link: no uncaught page errors',
    pageErrors2.length === 0,
    pageErrors2.join(' | '));

  await page2.screenshot({ path: path.join(__dirname, 'github-import-deeplink.last-run.png') });
  await page2.close();

  // ---- Scenario 3: custom shapes — library module instances stay GUI-editable ----
  // capsule_example.scad = include + three capsule() calls (two translate-wrapped). With the
  // custom-shape feature this is a SIMPLE program: named nodes in the Model Tree, no read-only
  // badge, and a gizmo-editable tree that regens translate(...) capsule(...) code.
  const page3 = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const pageErrors3 = [];
  page3.on('pageerror', (e) => pageErrors3.push(e.message));
  await page3.goto(base + '/index.html?github=morganp/openscad-interesting-shapes/examples/capsule_example.scad',
    { waitUntil: 'networkidle' });
  await page3.waitForTimeout(20000);

  const body3 = await page3.evaluate(() => document.body.innerText);
  const state3 = await page3.evaluate(() => {
    const ed = window.__editor;
    if (!ed) return null;
    return {
      readOnly: !!ed.state.readOnly,
      types: (ed.tree || []).map((n) => n.type),
      labels: (ed.tree || []).map((n) => n.label),
      headers: ed.headers || [],
      meshes: (() => { let c = 0; ed.scene && ed.scene.traverse((o) => { if (o.isMesh) c++; }); return c; })(),
      code: (ed._codeArea ? ed._codeArea.value : ed.state.code) || '',
    };
  });
  check('custom shapes: editor state reachable', !!state3, 'window.__editor missing');
  if (state3) {
    check('custom shapes: program stays GUI-editable (not read-only)',
      state3.readOnly === false,
      'expected simple/GUI classification, got read-only');
    check('custom shapes: three capsule nodes in the authoring tree',
      state3.types.filter((t) => t === 'custom').length === 3,
      'tree types: ' + JSON.stringify(state3.types));
    check('custom shapes: nodes labeled with the module name',
      state3.labels.filter((l) => /^capsule /.test(l)).length === 3,
      'labels: ' + JSON.stringify(state3.labels));
    check('custom shapes: include header preserved in regenerated code',
      /include <[^>]*interesting_shapes\.scad>/.test(state3.code),
      'regen dropped the include line: ' + state3.code.slice(0, 200));
    check('custom shapes: capsule calls emitted with args',
      (state3.code.match(/capsule\(radius = /g) || []).length === 3,
      'code: ' + state3.code.slice(0, 400));
    check('custom shapes: geometry rendered (meshes present)',
      state3.meshes >= 3,
      'mesh count: ' + state3.meshes);
    // gizmo-equivalent edit: move node 0 via its pos, regen, and confirm the code follows
    const moved = await page3.evaluate(() => {
      const ed = window.__editor;
      const n = (ed.tree || []).find((t) => t.type === 'custom');
      if (!n) return null;
      n.pos = [5, 6, 7];
      ed.rebuildScene(); ed.syncShapesState(); ed.regenCode();
      return (ed._codeArea ? ed._codeArea.value : ed.state.code) || '';
    });
    check('custom shapes: transform edit regens translate([5, 6, 7]) prefix',
      !!moved && /translate\(\[5, 6, 7\]\)/.test(moved),
      'code after move: ' + (moved || '').slice(0, 300));
  }
  check('custom shapes: no console-panel errors',
    !/ERROR/.test(body3),
    (body3.split('\n').filter((l) => /error/i.test(l)).join(' | ') || 'ERROR line present'));
  check('custom shapes: no uncaught page errors',
    pageErrors3.length === 0,
    pageErrors3.join(' | '));

  await page3.screenshot({ path: path.join(__dirname, 'custom-shapes.last-run.png') });
  await browser.close();
  srv.close();

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      -> ' + r.detail}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} assertions passed. Screenshot: tests/github-import-case.last-run.png`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
