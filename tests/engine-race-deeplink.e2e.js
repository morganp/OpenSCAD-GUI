#!/usr/bin/env node
// E2E regression test for the v0.63.1 deep-link engine race:
// scad-engine.js loading AFTER the deep-link fetch completes used to make runCode
// fall through to the simple GUI path with no isAdvanced() check. The library call
// (piano_hinge) was dropped, a named arg inside the call ("length = 100,") was
// misparsed as a top-level parameter, and regenCode overwrote the editor with an
// empty program. This test serves scad-engine.js with an artificial delay so the
// race is deterministic, then asserts the loaded file survives.
//
// Run:  cd tests && node engine-race-deeplink.e2e.js
// Needs Google Chrome (system Chrome via playwright-core) + network access to GitHub.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const HEADLESS = process.env.HEADED ? false : true;
const ENGINE_DELAY_MS = 6000; // longer than the GitHub repo fetch so the old bug always fired

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      let file = path.normalize(path.join(dir, urlPath === '/' ? 'index.html' : urlPath));
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      const send = () => {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        fs.createReadStream(file).pipe(res);
      };
      if (path.basename(file) === 'scad-engine.js') setTimeout(send, ENGINE_DELAY_MS);
      else send();
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

  await page.goto(base + '/index.html?github=morganp/OpenSCAD_hinge/examples/piano_hinge_demo.scad',
    { waitUntil: 'domcontentloaded' });
  // engine delay + repo fetch + promote + run + CSG
  await page.waitForTimeout(ENGINE_DELAY_MS + 25000);

  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok, detail });

  const state = await page.evaluate(() => {
    const ed = window.__editor;
    if (!ed) return null;
    return {
      readOnly: !!ed.state.readOnly,
      types: (ed.tree || []).map((n) => n.type),
      labels: (ed.tree || []).map((n) => n.label),
      vars: (ed.vars || []).map((v) => v.name),
      code: (ed._codeArea ? ed._codeArea.value : ed.state.code) || '',
      meshes: (() => { let c = 0; ed.scene && ed.scene.traverse((o) => { if (o.isMesh) c++; }); return c; })(),
    };
  });

  check('editor state reachable', !!state, 'window.__editor missing');
  if (state) {
    check('piano_hinge call survived the delayed-engine load (not clobbered)',
      /piano_hinge\s*\(/.test(state.code),
      'editor code lost the call: ' + state.code.slice(0, 300));
    check('one custom piano_hinge node in the authoring tree',
      state.types.filter((t) => t === 'custom').length === 1,
      'tree types: ' + JSON.stringify(state.types));
    check('no bogus "length" parameter from the named args',
      !state.vars.includes('length'),
      'vars: ' + JSON.stringify(state.vars));
    check('include header preserved',
      /include <[^>]*hinge_library\.scad>/.test(state.code),
      'regen dropped the include line: ' + state.code.slice(0, 300));
    check('geometry rendered (meshes present)',
      state.meshes >= 1,
      'mesh count: ' + state.meshes);
  }
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

  await page.screenshot({ path: path.join(__dirname, 'engine-race-deeplink.last-run.png') });
  await browser.close();
  srv.close();

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      -> ' + r.detail}`);
    if (!r.ok) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} assertions passed. Screenshot: tests/engine-race-deeplink.last-run.png`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
