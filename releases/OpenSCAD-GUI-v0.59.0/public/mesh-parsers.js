/* ===================================================================================================
   mesh-parsers.js — pure file-format parsers extracted from Editor.dc.html (v0.51.0 refactor).

   Side-effect-free: each function takes raw bytes/text and returns geometry data
   (Float32Array triangle soup, 2D ring arrays, or heightmap matrices). No 'this', no THREE,
   no editor state — the editor's importMesh/surfaceGeometry/loadSvgFiles layers turn this data
   into scene geometry. Exposed as window.MeshParsers so the DC can call it after a user drops a file.

   Public entry points (called from Editor.dc.html):
     parseSTL(arrayBuffer) -> { positions } | null      (binary + ASCII auto-detect)
     parseOFF(text)        -> { positions } | null
     parse3MF(arrayBuffer) -> Promise<{ positions }|null>
     parseAMF(arrayBuffer) -> Promise<{ positions }|null>
     parseDAT(text)        -> { rows, cols, data, min, max } | null      (surface heightmap)
     parsePNG(dataUrl)     -> Promise<{ rows, cols, data, min, max, isImage }|null>
     parseSVG(text)        -> [[ [x,y], ... ], ...]      (closed contours, y-up)
     parseDXF(text)        -> [[ [x,y], ... ], ...]
   =================================================================================================== */
(function () {
  'use strict';

  // DAT: whitespace-separated float matrix; '#'-leading and blank lines ignored.
function parseDAT(text) {
    const rowsArr = [];
    let cols = 0;
    for (let line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t[0] === '#' || t[0] === '!') continue;
      const nums = t.split(/[\s,]+/).map(Number).filter(v => !Number.isNaN(v));
      if (!nums.length) continue;
      rowsArr.push(nums); if (nums.length > cols) cols = nums.length;
    }
    const rows = rowsArr.length;
    if (rows < 2 || cols < 2) return null;
    const data = new Float32Array(rows * cols);
    let min = Infinity, max = -Infinity;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const v = rowsArr[r][c] != null ? rowsArr[r][c] : 0;
      data[r * cols + c] = v; if (v < min) min = v; if (v > max) max = v;
    }
    return { rows, cols, data, min, max };
  }
  // PNG (or any image dataURL): luminance 0..100; row 0 -> Y=0; invert handled at realize.
function parsePNG(dataUrl, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const cols = img.naturalWidth, rows = img.naturalHeight;
          if (cols < 2 || rows < 2) { resolve(null); return; }
          const cv = document.createElement('canvas'); cv.width = cols; cv.height = rows;
          const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const px = cx.getImageData(0, 0, cols, rows).data;
          const data = new Float32Array(rows * cols);
          let min = Infinity, max = -Infinity;
          for (let i = 0; i < rows * cols; i++) {
            const o = i * 4;
            const v = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255 * 100;
            data[i] = v; if (v < min) min = v; if (v > max) max = v;
          }
          resolve({ rows, cols, data, min, max, isImage: true });
        } catch (e) { reject(e); }
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // --- SVG parsing → array of closed contours [[x,y],…] in OpenSCAD (y-up) space ---
function identMat2() { return [1, 0, 0, 1, 0, 0]; }                                   // [a,b,c,d,e,f]
function applyMat2(m, p) { return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]; }
function mulMat2(a, b) { // compose: apply b then a
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
  }
function svgTransform(str) {
    let m = identMat2(); if (!str) return m;
    const re = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/g; let t;
    while ((t = re.exec(str))) {
      const a = t[2].trim().split(/[\s,]+/).map(Number);
      const d2r = Math.PI / 180; let lm = identMat2();
      if (t[1] === 'translate') lm = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
      else if (t[1] === 'scale') lm = [a[0] || 1, 0, 0, (a.length > 1 ? a[1] : a[0]) || 1, 0, 0];
      else if (t[1] === 'rotate') { const c = Math.cos((a[0]||0)*d2r), s = Math.sin((a[0]||0)*d2r); let r = [c, s, -s, c, 0, 0]; if (a.length >= 3) { r = mulMat2([1,0,0,1,a[1],a[2]], mulMat2(r, [1,0,0,1,-a[1],-a[2]])); } lm = r; }
      else if (t[1] === 'matrix') lm = [a[0]||0, a[1]||0, a[2]||0, a[3]||0, a[4]||0, a[5]||0];
      else if (t[1] === 'skewX') lm = [1, 0, Math.tan((a[0]||0)*d2r), 1, 0, 0];
      else if (t[1] === 'skewY') lm = [1, Math.tan((a[0]||0)*d2r), 0, 1, 0, 0];
      m = mulMat2(m, lm);
    }
    return m;
  }
function parseSVG(text) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svg = doc.querySelector('svg'); if (!svg) return [];
    let vbH = 0; const vb = svg.getAttribute('viewBox');
    if (vb) { const p = vb.trim().split(/[\s,]+/).map(Number); if (p.length === 4) vbH = p[3]; }
    if (!vbH) { const h = parseFloat(svg.getAttribute('height')); if (!isNaN(h)) vbH = h; }
    const flip = (p) => [p[0], vbH - p[1]];   // SVG y-down → OpenSCAD y-up
    const rings = [];
    const num = (el, a, d) => { const v = parseFloat(el.getAttribute(a)); return isNaN(v) ? (d || 0) : v; };
    const push = (contour, m) => { if (contour && contour.length >= 2) rings.push(contour.map(p => flip(applyMat2(m, p)))); };
    const walk = (el, mat) => {
      for (const ch of el.children) {
        const tag = ch.tagName.toLowerCase();
        if (tag === 'defs' || tag === 'clippath' || tag === 'mask') continue;
        const m = mulMat2(mat, svgTransform(ch.getAttribute('transform')));
        if (tag === 'g' || tag === 'a' || tag === 'svg') { walk(ch, m); continue; }
        if (tag === 'path') { for (const c of svgPathContours(ch.getAttribute('d') || '')) push(c, m); }
        else if (tag === 'rect') {
          const x = num(ch,'x'), y = num(ch,'y'), w = num(ch,'width'), h = num(ch,'height');
          if (w > 0 && h > 0) push([[x,y],[x+w,y],[x+w,y+h],[x,y+h]], m);
        }
        else if (tag === 'circle') { push(svgEllipsePts(num(ch,'cx'), num(ch,'cy'), num(ch,'r'), num(ch,'r')), m); }
        else if (tag === 'ellipse') { push(svgEllipsePts(num(ch,'cx'), num(ch,'cy'), num(ch,'rx'), num(ch,'ry')), m); }
        else if (tag === 'polygon' || tag === 'polyline') { push(svgPointList(ch.getAttribute('points')), m); }
        else if (ch.children && ch.children.length) walk(ch, m);
      }
    };
    walk(svg, identMat2());
    return rings.filter(r => r.length >= 3);
  }
function svgEllipsePts(cx, cy, rx, ry) {
    if (!(rx > 0) || !(ry > 0)) return null;
    const n = Math.max(16, Math.ceil(Math.PI * (rx + ry) / 3)); const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return pts;
  }
function svgPointList(str) {
    if (!str) return null; const n = str.trim().split(/[\s,]+/).map(Number); const pts = [];
    for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
    return pts;
  }
  // path 'd' → array of contours (subpaths), beziers/arcs flattened
function svgPathContours(d) {
    const toks = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/gi); if (!toks) return [];
    let i = 0; const contours = []; let cur = []; let cx = 0, cy = 0, sx = 0, sy = 0; let cmd = '', pcx = 0, pcy = 0, prevCmd = '';
    const rd = () => parseFloat(toks[i++]);
    const isCmd = (t) => /^[a-zA-Z]$/.test(t);
    const start = () => { if (cur.length >= 2) contours.push(cur); cur = []; };
    const lineTo = (x, y) => { cur.push([x, y]); cx = x; cy = y; };
    const flatCubic = (x1,y1,x2,y2,x,y) => { const n = 16; for (let k=1;k<=n;k++){ const t=k/n, u=1-t; const X=u*u*u*cx+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x; const Y=u*u*u*cy+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y; cur.push([X,Y]); } cx=x; cy=y; };
    const flatQuad = (x1,y1,x,y) => { const n = 14; for (let k=1;k<=n;k++){ const t=k/n, u=1-t; const X=u*u*cx+2*u*t*x1+t*t*x; const Y=u*u*cy+2*u*t*y1+t*t*y; cur.push([X,Y]); } cx=x; cy=y; };
    while (i < toks.length) {
      if (isCmd(toks[i])) { cmd = toks[i++]; } // else: implicit repeat of last cmd
      const rel = cmd === cmd.toLowerCase(); const C = cmd.toUpperCase();
      const bx = rel ? cx : 0, by = rel ? cy : 0;
      if (C === 'M') { start(); const x = rd()+bx, y = rd()+by; cur.push([x,y]); cx=x; cy=y; sx=x; sy=y; cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') { lineTo(rd()+bx, rd()+by); }
      else if (C === 'H') { lineTo(rd()+bx, cy); }
      else if (C === 'V') { lineTo(cx, rd()+by); }
      else if (C === 'C') { const x1=rd()+bx,y1=rd()+by,x2=rd()+bx,y2=rd()+by,x=rd()+bx,y=rd()+by; flatCubic(x1,y1,x2,y2,x,y); pcx=x2; pcy=y2; }
      else if (C === 'S') { const sm=(prevCmd==='C'||prevCmd==='S'); const x1=sm?2*cx-pcx:cx, y1=sm?2*cy-pcy:cy; const x2=rd()+bx,y2=rd()+by,x=rd()+bx,y=rd()+by; flatCubic(x1,y1,x2,y2,x,y); pcx=x2; pcy=y2; }
      else if (C === 'Q') { const x1=rd()+bx,y1=rd()+by,x=rd()+bx,y=rd()+by; flatQuad(x1,y1,x,y); pcx=x1; pcy=y1; }
      else if (C === 'T') { const sm=(prevCmd==='Q'||prevCmd==='T'); const x1=sm?2*cx-pcx:cx, y1=sm?2*cy-pcy:cy; const x=rd()+bx,y=rd()+by; flatQuad(x1,y1,x,y); pcx=x1; pcy=y1; }
      else if (C === 'A') { const rx=rd(),ry=rd(),rot=rd(),laf=rd(),sf=rd(),x=rd()+bx,y=rd()+by; flatArc(cur,cx,cy,rx,ry,rot,laf,sf,x,y); cx=x; cy=y; }
      else if (C === 'Z') { if (cur.length) { cur.push([sx,sy]); } start(); cx=sx; cy=sy; }
      else { i++; }                                   // unknown — skip a token
      prevCmd = C;
    }
    start();
    return contours;
  }
  // endpoint-arc → sampled points appended to `out`
function flatArc(out, x1, y1, rx, ry, rotDeg, laf, sf, x2, y2) {
    if (rx === 0 || ry === 0) { out.push([x2, y2]); return; }
    rx = Math.abs(rx); ry = Math.abs(ry);
    const phi = rotDeg * Math.PI / 180, cp = Math.cos(phi), sp = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    let r2 = (x1p*x1p)/(rx*rx) + (y1p*y1p)/(ry*ry); if (r2 > 1) { const s = Math.sqrt(r2); rx *= s; ry *= s; }
    let num = rx*rx*ry*ry - rx*rx*y1p*y1p - ry*ry*x1p*x1p; num = num < 0 ? 0 : num;
    const den = rx*rx*y1p*y1p + ry*ry*x1p*x1p;
    let co = (den === 0 ? 0 : Math.sqrt(num / den)); if (laf === sf) co = -co;
    const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => { const d = Math.sqrt((ux*ux+uy*uy)*(vx*vx+vy*vy)); let c = (ux*vx+uy*vy)/(d||1); c = Math.max(-1, Math.min(1, c)); let a = Math.acos(c); if (ux*vy - uy*vx < 0) a = -a; return a; };
    let th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sf && dth > 0) dth -= 2 * Math.PI; else if (sf && dth < 0) dth += 2 * Math.PI;
    const n = Math.max(8, Math.ceil(Math.abs(dth) / (Math.PI / 16)));
    for (let k = 1; k <= n; k++) {
      const th = th1 + dth * (k / n);
      const ex = cx + rx * Math.cos(th) * cp - ry * Math.sin(th) * sp;
      const ey = cy + rx * Math.cos(th) * sp + ry * Math.sin(th) * cp;
      out.push([ex, ey]);
    }
  }
  // ============ DXF 2D IMPORT (Phase 10: import .dxf → rings → 2D pipeline) ============
  // DXF coords are already y-up (CAD math orientation) — no flip needed (unlike SVG).
function parseDXF(text) {
    const s = String(text);
    if (/AutoCAD Binary DXF/.test(s.slice(0, 64))) return [];   // binary DXF unsupported
    const lines = s.split(/\r\n|\r|\n/);
    // group-code/value pairs
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = parseInt(lines[i].trim(), 10);
      if (isNaN(code)) continue;
      pairs.push([code, lines[i + 1].trim()]);
    }
    // collect ENTITIES section pairs
    const ents = []; let inEnt = false;
    for (let k = 0; k < pairs.length; k++) {
      const c = pairs[k][0], v = pairs[k][1];
      if (c === 0 && v === 'SECTION') { const nm = (pairs[k + 1] && pairs[k + 1][0] === 2) ? pairs[k + 1][1] : ''; inEnt = (nm === 'ENTITIES'); continue; }
      if (c === 0 && v === 'ENDSEC') { inEnt = false; continue; }
      if (inEnt) ents.push([c, v]);
    }
    // split into entity blocks (each begins at a code-0 type marker)
    const blocks = []; let cur = null;
    for (const [c, v] of ents) {
      if (c === 0) { if (cur) blocks.push(cur); cur = (v === 'ENDSEC') ? null : { type: v, codes: [] }; }
      else if (cur) cur.codes.push([c, v]);
    }
    if (cur) blocks.push(cur);

    const closed = [];   // rings ready as-is (circles, closed polylines, full ellipses)
    const segs = [];     // open polylines (lines, arcs, open polylines) → chained later
    const TAU = Math.PI * 2;
    const get = (b, code) => { for (const [c, v] of b.codes) if (c === code) return parseFloat(v); return undefined; };
    const flag = (b, code) => { const v = get(b, code); return isNaN(v) ? 0 : (v | 0); };

    // sample a center-arc from a0 to a1 (degrees, CCW) into points
    const sampleArc = (cx, cy, r, a0deg, a1deg) => {
      let a0 = a0deg * Math.PI / 180, a1 = a1deg * Math.PI / 180;
      while (a1 <= a0) a1 += TAU;
      const sweep = a1 - a0, n = Math.max(2, Math.ceil(sweep / (Math.PI / 24))), pts = [];
      for (let i = 0; i <= n; i++) { const a = a0 + sweep * i / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return pts;
    };

    for (const b of blocks) {
      const t = (b.type || '').toUpperCase();
      if (t === 'LINE') {
        const x1 = get(b, 10), y1 = get(b, 20), x2 = get(b, 11), y2 = get(b, 21);
        if ([x1, y1, x2, y2].every(n => !isNaN(n))) segs.push([[x1, y1], [x2, y2]]);
      } else if (t === 'CIRCLE') {
        const cx = get(b, 10), cy = get(b, 20), r = get(b, 40);
        if (!isNaN(cx) && !isNaN(cy) && r > 0) { const ring = sampleArc(cx, cy, r, 0, 360); ring.pop(); closed.push(ring); }
      } else if (t === 'ARC') {
        const cx = get(b, 10), cy = get(b, 20), r = get(b, 40), a0 = get(b, 50), a1 = get(b, 51);
        if (!isNaN(cx) && !isNaN(cy) && r > 0) segs.push(sampleArc(cx, cy, r, a0 || 0, isNaN(a1) ? 360 : a1));
      } else if (t === 'ELLIPSE') {
        const cx = get(b, 10), cy = get(b, 20), mx = get(b, 11), my = get(b, 21);
        const ratio = get(b, 40), p0 = get(b, 41), p1 = get(b, 42);
        if (!isNaN(cx) && !isNaN(mx)) {
          const major = Math.hypot(mx, my), rot = Math.atan2(my, mx), minor = major * (ratio || 1);
          let s0 = isNaN(p0) ? 0 : p0, s1 = isNaN(p1) ? TAU : p1; while (s1 <= s0) s1 += TAU;
          const full = (s1 - s0) >= TAU - 1e-6, sweep = s1 - s0, n = Math.max(8, Math.ceil(sweep / (Math.PI / 24))), pts = [];
          for (let i = 0; i <= n; i++) {
            const u = s0 + sweep * i / n, ca = Math.cos(u), sa = Math.sin(u);
            pts.push([cx + major * ca * Math.cos(rot) - minor * sa * Math.sin(rot), cy + major * ca * Math.sin(rot) + minor * sa * Math.cos(rot)]);
          }
          if (full) { pts.pop(); closed.push(pts); } else segs.push(pts);
        }
      } else if (t === 'LWPOLYLINE') {
        const verts = []; let v = null;
        for (const [c, val] of b.codes) {
          if (c === 10) { if (v) verts.push(v); v = { x: parseFloat(val), y: 0, bulge: 0 }; }
          else if (c === 20 && v) v.y = parseFloat(val);
          else if (c === 42 && v) v.bulge = parseFloat(val);
        }
        if (v) verts.push(v);
        const ring = dxfPolyPoints(verts, (flag(b, 70) & 1) === 1);
        if (ring) { if ((flag(b, 70) & 1) === 1) closed.push(ring); else segs.push(ring); }
      }
    }
    // gather VERTEX runs for old-style POLYLINE (re-walk blocks, tracking the active polyline)
    let active = null;
    for (const b of blocks) {
      const t = (b.type || '').toUpperCase();
      if (t === 'POLYLINE') { active = { closed: (flag(b, 70) & 1) === 1, verts: [] }; }
      else if (t === 'VERTEX' && active) { active.verts.push({ x: get(b, 10), y: get(b, 20), bulge: get(b, 42) || 0 }); }
      else if (t === 'SEQEND' && active) {
        const ring = dxfPolyPoints(active.verts.filter(p => !isNaN(p.x) && !isNaN(p.y)), active.closed);
        if (ring) { if (active.closed) closed.push(ring); else segs.push(ring); }
        active = null;
      } else if (t !== 'VERTEX') { active = null; }
    }
    // SPLINE → polyline through fit points (11/21) else control points (10/20)
    for (const b of blocks) {
      if ((b.type || '').toUpperCase() !== 'SPLINE') continue;
      const fit = [], ctrl = []; let fx = null, cxp = null;
      for (const [c, val] of b.codes) {
        if (c === 11) { fx = parseFloat(val); } else if (c === 21 && fx !== null) { fit.push([fx, parseFloat(val)]); fx = null; }
        else if (c === 10) { cxp = parseFloat(val); } else if (c === 20 && cxp !== null) { ctrl.push([cxp, parseFloat(val)]); cxp = null; }
      }
      const pts = fit.length >= 2 ? fit : ctrl;
      if (pts.length >= 2) { if ((flag(b, 70) & 1) === 1) { pts.push(pts[0]); closed.push(pts); } else segs.push(pts); }
    }

    const chained = chainDxfSegments(segs);
    return closed.concat(chained).filter(r => r && r.length >= 3);
  }
  // vertices [{x,y,bulge}] → flattened polyline (bulge edges sampled as arcs); wraps if closed
function dxfPolyPoints(verts, isClosed) {
    verts = (verts || []).filter(v => !isNaN(v.x) && !isNaN(v.y));
    if (verts.length < 2) return null;
    const pts = [[verts[0].x, verts[0].y]];
    const edges = isClosed ? verts.length : verts.length - 1;
    for (let i = 0; i < edges; i++) {
      const a = verts[i], b = verts[(i + 1) % verts.length];
      const arc = arcFromBulge([a.x, a.y], [b.x, b.y], a.bulge || 0);
      for (const p of arc) pts.push(p);
    }
    return pts;
  }
  // p1→p2 with a DXF bulge value → sampled arc points (excludes p1, includes p2)
function arcFromBulge(p1, p2, bulge) {
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    const dx = x2 - x1, dy = y2 - y1, chord = Math.hypot(dx, dy);
    if (!bulge || chord < 1e-9) return [[x2, y2]];
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -dy / chord, ny = dx / chord;
    const sag = (chord / 2) * bulge;                 // signed sagitta (bulge>0 → left of p1→p2)
    const ax = mx + nx * sag, ay = my + ny * sag;    // apex on the arc
    const c = circleFrom3([x1, y1], [ax, ay], [x2, y2]);
    if (!c) return [[x2, y2]];
    const TAU = Math.PI * 2, cx = c.cx, cy = c.cy, r = c.r;
    const a0 = Math.atan2(y1 - cy, x1 - cx), aa = Math.atan2(ay - cy, ax - cx), a1 = Math.atan2(y2 - cy, x2 - cx);
    const norm = (a) => { while (a < 0) a += TAU; return a % TAU; };
    const ccwSpan = norm(a1 - a0), apexSpan = norm(aa - a0);
    const ccw = apexSpan <= ccwSpan;
    let s = a0, e = a1; if (ccw) { while (e < s) e += TAU; } else { while (e > s) e -= TAU; }
    const sweep = Math.abs(e - s), n = Math.max(2, Math.ceil(sweep / (Math.PI / 24))), out = [];
    for (let i = 1; i <= n; i++) { const a = s + (e - s) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }
function circleFrom3(A, B, C) {
    const ax = A[0], ay = A[1], bx = B[0], by = B[1], cx = C[0], cy = C[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    return { cx: ux, cy: uy, r: Math.hypot(ax - ux, ay - uy) };
  }
  // join open segments end-to-end (endpoint match) into closed rings
function chainDxfSegments(segs) {
    segs = (segs || []).map(s => s.slice()).filter(s => s && s.length >= 2);
    if (!segs.length) return [];
    // tolerance scaled to drawing size
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const s of segs) for (const p of s) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
    const diag = Math.hypot(maxx - minx, maxy - miny) || 1;
    const tol = Math.max(1e-6, diag * 1e-4);
    const eq = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol;
    const out = [];
    while (segs.length) {
      let chain = segs.shift(), extended = true;
      while (extended) {
        extended = false;
        if (eq(chain[0], chain[chain.length - 1]) && chain.length >= 4) break;
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i], h = chain[0], t = chain[chain.length - 1], sh = s[0], st = s[s.length - 1];
          if (eq(t, sh)) { chain = chain.concat(s.slice(1)); }
          else if (eq(t, st)) { chain = chain.concat(s.slice(0, -1).reverse()); }
          else if (eq(h, st)) { chain = s.slice(0, -1).concat(chain); }
          else if (eq(h, sh)) { chain = s.slice(1).reverse().concat(chain); }
          else continue;
          segs.splice(i, 1); extended = true; break;
        }
      }
      out.push(chain);
    }
    return out;
  }
function parseSTL(buffer) {
    const dv = new DataView(buffer), n = buffer.byteLength;
    if (n >= 84) { const tris = dv.getUint32(80, true); if (84 + tris * 50 === n) return parseBinarySTL(dv, tris); }
    const text = new TextDecoder().decode(buffer);
    if (/^\s*solid/i.test(text) && /facet/i.test(text)) return parseAsciiSTL(text);
    if (n >= 84) { const tris = dv.getUint32(80, true); if (84 + tris * 50 <= n && tris > 0) return parseBinarySTL(dv, tris); }
    return null;
  }
function parseBinarySTL(dv, tris) {
    const pos = new Float32Array(tris * 9); let o = 84, p = 0;
    for (let i = 0; i < tris; i++) {
      o += 12; // skip per-facet normal
      for (let v = 0; v < 3; v++) { pos[p++] = dv.getFloat32(o, true); pos[p++] = dv.getFloat32(o + 4, true); pos[p++] = dv.getFloat32(o + 8, true); o += 12; }
      o += 2; // attribute byte count
    }
    return { positions: pos };
  }
function parseAsciiSTL(text) {
    const verts = []; const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g; let m;
    while ((m = re.exec(text))) verts.push(+m[1], +m[2], +m[3]);
    return { positions: new Float32Array(verts) };
  }
function parseOFF(text) {
    const toks = text.replace(/#.*$/gm, '').trim().split(/\s+/);
    let idx = 0;
    if (toks[0]) { const h = toks[0].toUpperCase(); if (h === 'OFF' || h.endsWith('OFF')) idx = 1; }
    const nV = parseInt(toks[idx++], 10), nF = parseInt(toks[idx++], 10); parseInt(toks[idx++], 10);
    if (!(nV > 0) || !(nF >= 0)) return null;
    const verts = [];
    for (let i = 0; i < nV; i++) { const x = +toks[idx++], y = +toks[idx++], z = +toks[idx++]; verts.push([x, y, z]); }
    const out = [];
    for (let i = 0; i < nF; i++) {
      const k = parseInt(toks[idx++], 10); if (!(k >= 3)) { idx += Math.max(0, k); continue; }
      const f = []; for (let j = 0; j < k; j++) f.push(parseInt(toks[idx++], 10));
      for (let t = 1; t < k - 1; t++) { const a = verts[f[0]], b = verts[f[t]], c = verts[f[t + 1]]; if (a && b && c) out.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]); }
    }
    return { positions: new Float32Array(out) };
  }
  // ---- 3MF (zip of XML) + AMF (XML, optionally zipped) mesh import ----
function parse3MF(buffer) {
    return unzipEntries(buffer).then(entries => {
      let modelBytes = null;
      for (const [name, data] of entries) { if (/3dmodel\.model$/i.test(name)) { modelBytes = data; break; } }
      if (!modelBytes) for (const [name, data] of entries) { if (/\.model$/i.test(name)) { modelBytes = data; break; } }
      if (!modelBytes) return null;
      return meshXmlToPositions(new TextDecoder().decode(modelBytes), '3mf');
    });
  }
function parseAMF(buffer) {
    const u8 = new Uint8Array(buffer);
    if (u8.length >= 2 && u8[0] === 0x50 && u8[1] === 0x4B) {  // 'PK' -> zip-compressed AMF
      return unzipEntries(buffer).then(entries => {
        let amf = null;
        for (const [name, data] of entries) { if (/\.amf$/i.test(name)) { amf = data; break; } }
        if (!amf) for (const [, data] of entries) { amf = data; break; }
        return amf ? meshXmlToPositions(new TextDecoder().decode(amf), 'amf') : null;
      });
    }
    return meshXmlToPositions(new TextDecoder().decode(u8), 'amf');
  }
  // Parse a 3MF/AMF mesh XML to a flat triangle-soup Float32Array. Merges every <mesh> in the
  // document (build-item / component transforms ignored — common single-object case is exact).
function meshXmlToPositions(xml, kind) {
    let doc;
    try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch (_) { return null; }
    if (!doc || doc.getElementsByTagName('parsererror').length) return null;
    const out = [];
    const meshes = doc.getElementsByTagName('mesh');
    for (const mesh of Array.from(meshes)) {
      const vparent = mesh.getElementsByTagName('vertices')[0];
      if (!vparent) continue;
      const vs = [];
      for (const v of Array.from(vparent.getElementsByTagName('vertex'))) {
        if (kind === '3mf') vs.push([+v.getAttribute('x'), +v.getAttribute('y'), +v.getAttribute('z')]);
        else {
          const c = v.getElementsByTagName('coordinates')[0] || v;
          const g = (t) => { const e = c.getElementsByTagName(t)[0]; return e ? +e.textContent : 0; };
          vs.push([g('x'), g('y'), g('z')]);
        }
      }
      const emit = (i1, i2, i3) => { const a = vs[i1], b = vs[i2], c = vs[i3]; if (a && b && c) out.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2]); };
      if (kind === '3mf') {
        for (const t of Array.from(mesh.getElementsByTagName('triangle'))) emit(+t.getAttribute('v1'), +t.getAttribute('v2'), +t.getAttribute('v3'));
      } else {
        for (const vol of Array.from(mesh.getElementsByTagName('volume'))) {
          for (const t of Array.from(vol.getElementsByTagName('triangle'))) {
            const gi = (tag) => { const e = t.getElementsByTagName(tag)[0]; return e ? parseInt(e.textContent, 10) : -1; };
            emit(gi('v1'), gi('v2'), gi('v3'));
          }
        }
      }
    }
    return out.length >= 9 ? { positions: new Float32Array(out) } : null;
  }
  // Minimal ZIP reader (stored + raw-deflate) → Map(filename → Uint8Array). No zip64.
function unzipEntries(buffer) {
    const u8 = new Uint8Array(buffer), dv = new DataView(buffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i >= u8.length - 22 - 65536; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return Promise.resolve(new Map());
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const jobs = []; const entries = new Map();
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const fnLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commLen = dv.getUint16(p + 32, true);
      const localOff = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + fnLen));
      const lfn = dv.getUint16(localOff + 26, true), lex = dv.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lfn + lex;
      const comp = u8.subarray(dataStart, dataStart + compSize);
      if (method === 0) entries.set(name, comp.slice());
      else if (method === 8) jobs.push(inflateRaw(comp).then(d => entries.set(name, d)).catch(() => {}));
      p += 46 + fnLen + extraLen + commLen;
    }
    return Promise.all(jobs).then(() => entries);
  }
function inflateRaw(bytes) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('DecompressionStream unavailable'));
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter(); w.write(bytes); w.close();
    return new Response(ds.readable).arrayBuffer().then(ab => new Uint8Array(ab));
  }

  window.MeshParsers = {
    parseSTL: parseSTL,
    parseOFF: parseOFF,
    parse3MF: parse3MF,
    parseAMF: parseAMF,
    parseDAT: parseDAT,
    parsePNG: parsePNG,
    parseSVG: parseSVG,
    parseDXF: parseDXF,
  };
})();
