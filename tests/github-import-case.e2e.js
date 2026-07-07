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
  check('advanced program rendered read-only',
    /read-only/i.test(body),
    'expected the read-only badge for an advanced (module-defining) program');
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
  check('deep link: rendered read-only with no console-panel errors',
    /read-only/i.test(body2) && !/ERROR/.test(body2),
    (body2.split('\n').filter((l) => /error/i.test(l)).join(' | ') || 'no read-only badge'));
  check('deep link: no uncaught page errors',
    pageErrors2.length === 0,
    pageErrors2.join(' | '));

  await page2.screenshot({ path: path.join(__dirname, 'github-import-deeplink.last-run.png') });
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
