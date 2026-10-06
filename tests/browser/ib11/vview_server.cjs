'use strict';
// IB11 V-VIEW controlled server (test code, not production).
// Serves two e621-shaped /posts fixture pages (MAIN, TAKEOVER), generated plain
// PNG images (no third-party content), the IB10 WebM fixture for the video
// cards, a controlled native-post destination that records arrival, and
// collects the package's results (fetch POST or sendBeacon).
//   images (generated in memory, deterministic):
//     thumb  160x80 solid      - card preview/sample (served at once)
//     wide   2000x1000 solid   - fast original (V-D4, focus/keyboard cards)
//     slow   1600x800 noise    - original held 1.5 s before headers, then
//                                streamed at 512 KiB/s (V-D7)
//     fail   404               - a real failed media request (V-D1, NATIVE)
//   native destination /posts/<id> (the e621 native post route the adapter
//   builds): records the arrival (server time, page, card) and forwards to the
//   next page.
// Attempts: every posted attempt is kept with its number. An attempt with an
// error (prompt timeout etc.) is INVALID; the page can be retried by reloading.
// The results file is rewritten after every post/arrival.
// Output: sanitized JSON (labels, times, states, sizes, brand versions; no
// paths, URLs or IDs beyond the fixture's own synthetic card ids).
// G3 preflight (--g3-preflight): one page (G3PRE) with one video card; the
// same package runs only the G3 cell (evidence-tool qualification only).
// Usage: node vview_server.cjs --media <fixture folder> [--port 8797] [--out <file>] [--g3-preflight]
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { MEDIA, verifyMedia } = require('../ib10/v3c_server.cjs');

const PORT = 8797;
const SLOW = { headerDelayMs: 1500, bytesPerSecond: 512 * 1024, chunk: 16 * 1024 };

// ---- deterministic PNG generation ----
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
function png(w, h, pixel) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { const o = y * (w * 3 + 1); raw[o] = 0; for (let x = 0; x < w; x++) { const [r, g, b] = pixel(x, y); raw[o + 1 + x * 3] = r; raw[o + 2 + x * 3] = g; raw[o + 3 + x * 3] = b; } }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
function images() {
  let s = 0x2545f491; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s & 0xff; };
  const out = {
    thumb: png(160, 80, () => [90, 140, 200]),
    wide: png(2000, 1000, (x) => (x < 1000 ? [200, 120, 60] : [60, 160, 90])),
    slow: png(1600, 800, () => [rnd(), rnd(), rnd()]),
  };
  return Object.fromEntries(Object.entries(out).map(([k, b]) => [k, { buf: b, size: b.length, sha256: crypto.createHash('sha256').update(b).digest('hex') }]));
}
const DIMS = { thumb: [160, 80], wide: [2000, 1000], slow: [1600, 800] };

// ---- plan ----
// Card roles per page, in DOM order. FOCUS_K is first so one Tab reaches it.
const MAIN_CARDS = [
  ['FOCUS_K', 'img', 'wide'], ['VD7', 'img', 'slow'], ['VD4', 'img', 'wide'], ['VD6B_A', 'img', 'wide'], ['VD6B_B', 'video', 'webm'],
  ['VD1', 'img', 'fail'], ['VD5SYN', 'img', 'wide'], ['VD5', 'img', 'wide'], ['G3', 'video', 'webm'], ['FOCUS_M', 'img', 'wide'], ['NATIVE', 'img', 'fail'],
];
const TAKEOVER_CARDS = [['VD6A', 'video', 'webm']];
const PREFLIGHT_CARDS = [['G3', 'video', 'webm']];
function plan({ preflight = false } = {}) {
  let id = 8000;
  const mk = (pageId, cards) => ({ token: crypto.randomBytes(8).toString('hex'), id: pageId,
    cards: cards.map(([role, kind, media]) => ({ role, kind, media, id: String(++id) })) });
  return preflight ? [mk('G3PRE', PREFLIGHT_CARDS)] : [mk('MAIN', MAIN_CARDS), mk('TAKEOVER', TAKEOVER_CARDS)];
}
const OUTLINE = { FOCUS_K: '#3b82f6', FOCUS_M: '#ec4899', VD6A: '#f59e0b' };
function page(pg, port, sizes) {
  const card = (c) => {
    const ext = c.kind === 'video' ? 'webm' : 'png';
    const file = c.media === 'webm' ? `/vview/video/${pg.token}/${c.role}.webm` : `/vview/img/${pg.token}/${c.role}-${c.media}.png`;
    const size = c.media === 'webm' ? sizes.webm : (sizes[c.media] || 1000);
    const [w, h] = c.media === 'webm' ? [1280, 720] : (DIMS[c.media] || [2000, 1000]);
    return `<article class="thumbnail" data-id="${c.id}" data-vview-role="${c.role}" data-file-ext="${ext}" data-width="${w}" data-height="${h}" data-size="${size}" data-file-url="${file}" data-sample-url="/vview/img/${pg.token}/${c.role}-thumb.png" data-preview-url="/vview/img/${pg.token}/${c.role}-thumb.png"><a href="/posts/${c.id}" class="thm-link"><img src="/vview/img/${pg.token}/${c.role}-thumb.png" alt="card ${c.role}"></a></article>`;
  };
  const css = Object.entries(OUTLINE).map(([role, color]) => `article[data-vview-role="${role}"]{outline:8px solid ${color};outline-offset:2px}`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>IB11 V-VIEW</title><style>body{padding-top:190px}${css}</style></head><body data-user-is-anonymous="true">
<section id="posts-container">${pg.cards.map(card).join('')}</section>
<script type="application/json" id="ib11v-run">${JSON.stringify({ token: pg.token, page: pg.id, cards: Object.fromEntries(pg.cards.map((c) => [c.role, c.id])), port })}</script>
</body></html>`;
}

function createServer({ mediaDir, port = PORT, out = null, preflight = false, log = console.log }) {
  const media = verifyMedia(mediaDir);
  const imgs = images();
  const pages = plan({ preflight });
  const byToken = new Map(pages.map((p) => [p.token, p]));
  const sizes = { webm: media.webm.size, ...Object.fromEntries(Object.entries(imgs).map(([k, v]) => [k, v.size])) };
  const attempts = []; const arrivals = []; const requests = [];
  const write = () => {
    const doc = { probe: preflight ? 'ib11-vview-g3-preflight' : 'ib11-vview', version: '1.0.0', slowTransport: SLOW,
      fixtures: { webm: { size: media.webm.size, sha256: media.webm.sha256 }, ...Object.fromEntries(Object.entries(imgs).map(([k, v]) => [k, { size: v.size, sha256: v.sha256, dims: DIMS[k] }])) },
      pages: attempts, arrivals, requests };
    if (out) fs.writeFileSync(out, `${JSON.stringify(doc, null, 1)}\n`);
    return doc;
  };
  const complete = () => pages.every((p) => attempts.some((a) => a.page === p.id && !a.client.error)) && (preflight || (arrivals.some((a) => a.page === 'MAIN') && arrivals.some((a) => a.page === 'TAKEOVER')));
  function serveImage(req, res, pg, role, kind) {
    const rec = { page: pg.id, label: `${role}-${kind}`, t0: Date.now(), status: 0, bytes: 0, writes: [], end: null };
    requests.push(rec);
    if (kind === 'fail') { rec.status = 404; rec.end = 'complete'; res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
    const im = imgs[kind]; if (!im) { rec.status = 404; rec.end = 'complete'; res.writeHead(404); return res.end(); }
    if (kind !== 'slow') { rec.status = 200; rec.bytes = im.size; rec.end = 'complete'; res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'Content-Length': im.size }); return res.end(im.buf); }
    setTimeout(() => {
      if (res.destroyed) { rec.end = 'client-abort'; return; }
      rec.status = 200; res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'Content-Length': im.size });
      let pos = 0; let timer = null;
      res.on('close', () => { if (!rec.end) rec.end = res.writableFinished ? 'complete' : 'client-abort'; clearTimeout(timer); });
      const step = () => {
        if (res.destroyed) return;
        const n = Math.min(SLOW.chunk, im.size - pos);
        if (n <= 0) { res.end(); rec.end = 'complete'; return; }
        res.write(im.buf.subarray(pos, pos + n)); pos += n; rec.bytes = pos; rec.writes.push([Date.now(), pos]);
        timer = setTimeout(step, Math.round((n / SLOW.bytesPerSecond) * 1000));
      };
      step();
    }, SLOW.headerDelayMs);
    return undefined;
  }
  function serveVideo(req, res, pg, role) {
    const m = media.webm; const total = m.size; let start = 0; let end = total - 1;
    const headers = { 'Content-Type': MEDIA.webm.type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const mr = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    let status = 200;
    if (mr) {
      if (mr[1] !== '') { start = Number(mr[1]); if (mr[2] !== '') end = Math.min(Number(mr[2]), total - 1); } else if (mr[2] !== '') start = Math.max(0, total - Number(mr[2]));
      if (start > end || start >= total) { res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end(); }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
    }
    headers['Content-Length'] = end - start + 1;
    requests.push({ page: pg.id, label: `${role}-webm`, t0: Date.now(), status, end: 'streamed' });
    res.writeHead(status, headers);
    const st = fs.createReadStream(m.path, { start, end }); res.on('close', () => st.destroy()); st.pipe(res);
    return undefined;
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (p === '/vview/start') { res.writeHead(302, { Location: `/posts?page=${pages[0].token}`, 'Cache-Control': 'no-store' }); return res.end(); }
    if (p === '/posts') {
      const pg = byToken.get(url.searchParams.get('page'));
      if (!pg) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end('unknown page'); }
      const body = Buffer.from(page(pg, port, sizes));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      return res.end(body);
    }
    let m = /^\/vview\/img\/([0-9a-f]{16})\/([A-Z0-9_]+)-(thumb|wide|slow|fail)\.png$/.exec(p);
    if (m) { const pg = byToken.get(m[1]); if (!pg) { res.writeHead(404); return res.end(); } return serveImage(req, res, pg, m[2], m[3]); }
    m = /^\/vview\/video\/([0-9a-f]{16})\/([A-Z0-9_]+)\.webm$/.exec(p);
    if (m) { const pg = byToken.get(m[1]); if (!pg) { res.writeHead(404); return res.end(); } return serveVideo(req, res, pg, m[2]); }
    m = /^\/posts\/(\d+)$/.exec(p);
    if (m) {
      const pg = pages.find((x) => x.cards.some((c) => c.id === m[1]));
      const card = pg && pg.cards.find((c) => c.id === m[1]);
      arrivals.push({ page: pg ? pg.id : 'UNKNOWN', card: card ? card.role : 'UNKNOWN', wall: Date.now(), attempt: pg ? attempts.filter((a) => a.page === pg.id).length : 0 });
      write();
      log(`IB11 V-VIEW native destination reached from ${pg ? pg.id : 'unknown page'} (${card ? card.role : 'unknown card'})`);
      const idx = pg ? pages.indexOf(pg) : -1;
      const next = idx >= 0 && pages[idx + 1] ? `/posts?page=${pages[idx + 1].token}` : '/vview/done';
      const body = Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2;url=${next}"><title>Native post reached</title></head><body style="font:24px sans-serif;padding:40px">Native post page reached. Continuing…</body></html>`);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      return res.end(body);
    }
    if (p === '/vview/result' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let client = null; try { client = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { client = null; }
        const pg = client && byToken.get(client.token);
        if (!pg) { res.writeHead(400, { 'Cache-Control': 'no-store' }); return res.end('{}'); }
        delete client.token;
        attempts.push({ page: pg.id, attempt: attempts.filter((a) => a.page === pg.id).length + 1, received: Date.now(), client });
        write();
        log(`IB11 V-VIEW ${pg.id} attempt ${attempts.filter((a) => a.page === pg.id).length}${client.error ? ` INVALID (${client.error}); reload the page to retry` : ' recorded'}`);
        if (complete()) log('IB11 V-VIEW: all pages complete.');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end('{}');
      });
      return undefined;
    }
    if (p === '/vview/done') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('IB11 V-VIEW complete. Return the results file.'); }
    res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end();
  });
  return { server, pages, images: imgs, attempts, arrivals, requests, write, complete, listen: () => new Promise((r) => server.listen(port, '127.0.0.1', r)) };
}

module.exports = { createServer, plan, page, images, png, PORT, SLOW, DIMS, MAIN_CARDS, TAKEOVER_CARDS, PREFLIGHT_CARDS };

if (require.main === module) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const mediaDir = arg('--media');
  if (!mediaDir) { console.error('usage: node vview_server.cjs --media <dir> [--port 8797] [--out <file>]'); process.exit(2); }
  const port = Number(arg('--port', String(PORT)));
  const preflight = process.argv.includes('--g3-preflight');
  const out = arg('--out', path.join(process.cwd(), preflight ? 'ib11-vview-g3-preflight.json' : 'ib11-vview-results.json'));
  let s;
  try { s = createServer({ mediaDir, port, out, preflight }); } catch (e) { console.error(`IB11 V-VIEW refused: ${e.message}`); process.exit(1); }
  s.listen().then(() => { s.write(); console.log(`IB11 V-VIEW: media SHA-256 verified; ${s.pages.length} pages${preflight ? ' (G3 PREFLIGHT only)' : ''}. Open http://127.0.0.1:${port}/vview/start in the Tampermonkey Chrome profile.`); });
}
