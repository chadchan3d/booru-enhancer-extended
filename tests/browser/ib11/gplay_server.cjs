'use strict';
// IB11 G-PLAY controlled server (test code, not production).
// Serves e621-shaped /posts fixture pages, one per (arm, container), the two
// IB10 media fixtures under per-page unique no-store URLs (Range honored, no
// throttle), and collects the package's per-cell results.
//   - media identity: the IB10 fixtures, checked against their pinned SHA-256
//     (ib10/v3c_server.cjs verifyMedia) before the server starts;
//   - arms: N = no user activation on the page until the final RETRY prompt;
//     U = the operator's Start click gives the page sticky user activation;
//   - special media labels: *-FAIL answers 404; *-PEND holds the response for
//     3 s before headers (a load that is still pending at close).
// Output: sanitized JSON (no paths, URLs or IDs; cell labels, times, states,
// browser/manager brand versions).
// Usage: node gplay_server.cjs --media <dir> [--port 8796] [--out <file>]
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MEDIA, verifyMedia } = require('../ib10/v3c_server.cjs');

const PORT = 8796;
const PEND_MS = 3000;
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f6a5cf0000000049454e44ae426082', 'hex');

// prefs: [autoplay, loop, mute, rememberVolume]; vol = stored remembered volume.
const P = (autoplay, loop, mute, rv) => ({ autoplay, loop, mute, rememberVolume: rv });
const N_CELLS = [
  ['PREF', 'OBSERVE', P(true, true, true, true), 0.37, ['A']],
  ['UNMUTED', 'OBSERVE', P(true, true, false, true), 0.37, ['A']],
  ['NOAUTO', 'OBSERVE', P(false, true, true, true), 0.37, ['A']],
  ['LOOPF', 'LOOP', P(true, false, true, true), 0.37, ['A']],
  ['LOOPT', 'LOOP', P(true, true, true, true), 0.37, ['A']],
  ['RVOFF', 'VOLUME', P(true, true, true, false), 0.37, ['A', 'B']],
  ['RVON', 'VOLUME', P(true, true, true, true), 0.37, ['A', 'B']],
  ['PLAYREJ', 'PLAYAPI', P(true, true, false, true), 0.37, ['A']],
  ['FAIL', 'OBSERVE', P(true, true, true, true), 0.37, ['FAIL']],
  ['CLOSEPEND', 'CLOSEPEND', P(true, true, true, true), 0.37, ['PEND']],
  ['CLOSEPLAY', 'CLOSEPLAY', P(true, true, true, true), 0.37, ['A']],
  ['STALE', 'STALE', P(true, true, true, true), 0.37, ['A', 'B']],
  ['RETRY', 'RETRY', P(true, true, false, true), 0.37, ['A']],
];
const U_CELLS = [
  ['UNMUTED', 'OBSERVE', P(true, true, false, true), 0.37, ['A']],
  ['PLAYAPI', 'PLAYAPI', P(true, true, false, true), 0.37, ['A']],
  ['DELIB', 'DELIB', P(true, true, true, true), 0.37, ['A', 'B']],
];
const ARMS = { N: N_CELLS, U: U_CELLS };
const CONTAINERS = ['mp4', 'webm'];

function plan() {
  const pages = [];
  for (const arm of ['N', 'U']) for (const container of CONTAINERS) {
    pages.push({ token: crypto.randomBytes(8).toString('hex'), id: `${arm}-${container}`, arm, container,
      cells: ARMS[arm].map(([name, kind, prefs, storedVolume, cards]) => ({ id: `${arm}-${container}-${name}`, name, kind, prefs, storedVolume, cards: cards.map((c) => `${arm}-${container}-${name}-${c}`) })) });
  }
  return pages;
}

function page(pg, port, sizes) {
  let id = 7000;
  const card = (label) => {
    const media = `/gplay/media/${pg.token}/${label}.${pg.container}`;
    id++;
    return `<article class="thumbnail" data-id="${id}" data-file-ext="${pg.container}" data-width="1280" data-height="720" data-size="${sizes[pg.container]}" data-file-url="${media}" data-sample-url="/gplay/p.png?${label}" data-preview-url="/gplay/p.png?${label}"><a href="/posts/${id}" class="thm-link"><img src="/gplay/p.png?${label}" alt=""></a></article>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>IB11 G-PLAY</title></head><body data-user-is-anonymous="true">
<section id="posts-container">${pg.cells.flatMap((c) => c.cards).map(card).join('')}</section>
<script type="application/json" id="ib11g-run">${JSON.stringify({ token: pg.token, page: pg.id, arm: pg.arm, container: pg.container, cells: pg.cells, port })}</script>
</body></html>`;
}

function createServer({ mediaDir, port = PORT, out = null, log = console.log }) {
  const media = verifyMedia(mediaDir);
  const pages = plan();
  const byToken = new Map(pages.map((p) => [p.token, p]));
  const sizes = Object.fromEntries(Object.entries(media).map(([k, m]) => [k, m.size]));
  const requests = [];
  const results = [];
  function serveMedia(req, res, pg, label) {
    const rec = { page: pg.id, label, t0: Date.now(), range: req.headers.range ? 'range' : null, status: 0, bytesSent: 0, tEnd: null, end: null };
    requests.push(rec);
    if (/-FAIL$/.test(label)) { rec.status = 404; rec.end = 'complete'; rec.tEnd = Date.now(); res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
    const go = () => {
      if (res.destroyed) { rec.end = 'client-abort'; rec.tEnd = Date.now(); return; }
      const m = media[pg.container]; const total = m.size;
      let start = 0; let end = total - 1;
      const headers = { 'Content-Type': MEDIA[pg.container].type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
      const mr = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (mr) {
        if (mr[1] !== '') { start = Number(mr[1]); if (mr[2] !== '') end = Math.min(Number(mr[2]), total - 1); } else if (mr[2] !== '') start = Math.max(0, total - Number(mr[2]));
        if (start > end || start >= total) { rec.status = 416; rec.end = 'complete'; rec.tEnd = Date.now(); res.writeHead(416, { 'Content-Range': `bytes */${total}` }); return res.end(); }
        rec.status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
      } else rec.status = 200;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(rec.status, headers);
      const stream = fs.createReadStream(m.path, { start, end });
      stream.on('data', (b) => { rec.bytesSent += b.length; });
      res.on('close', () => { if (!rec.end) { rec.end = res.writableFinished ? 'complete' : 'client-abort'; rec.tEnd = Date.now(); } stream.destroy(); });
      stream.pipe(res);
    };
    if (/-PEND$/.test(label)) setTimeout(go, PEND_MS); else go();
    return undefined;
  }
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (p === '/gplay/p.png') { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'Content-Length': PNG.length }); return res.end(PNG); }
    if (p === '/gplay/start') { res.writeHead(302, { Location: `/posts?page=${pages[0].token}`, 'Cache-Control': 'no-store' }); return res.end(); }
    if (p === '/posts') {
      const pg = byToken.get(url.searchParams.get('page'));
      if (!pg) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end('unknown page'); }
      const body = Buffer.from(page(pg, port, sizes));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      return res.end(body);
    }
    const mm = /^\/gplay\/media\/([0-9a-f]{16})\/([A-Za-z0-9_-]+)\.(mp4|webm)$/.exec(p);
    if (mm) {
      const pg = byToken.get(mm[1]);
      if (!pg || pg.container !== mm[3]) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
      return serveMedia(req, res, pg, mm[2]);
    }
    if (p === '/gplay/result' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let client = null; try { client = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { client = null; }
        const pg = client && byToken.get(client.token);
        if (!pg) { res.writeHead(400, { 'Cache-Control': 'no-store' }); return res.end('{}'); }
        delete client.token;
        results.push({ page: pg.id, client, requests: requests.filter((r) => r.page === pg.id).map(({ page: _p, ...r }) => ({ ...r, end: r.end || 'open-at-page-end' })) });
        const idx = pages.indexOf(pg);
        const next = pages[idx + 1] ? `/posts?page=${pages[idx + 1].token}` : '/gplay/done';
        log(`IB11 G-PLAY page ${idx + 1}/${pages.length} ${pg.id}: ${(client.cells || []).length} cell(s)`);
        if (!pages[idx + 1]) finalize();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ next }));
      });
      return undefined;
    }
    if (p === '/gplay/done') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('IB11 G-PLAY complete. Return the results file.'); }
    res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end();
  });
  function finalize() {
    const doc = { probe: 'ib11-gplay-controlled', version: '1.0.0', media: Object.fromEntries(Object.entries(media).map(([k, m]) => [k, { size: m.size, sha256: m.sha256 }])), pages: results };
    if (out) { fs.writeFileSync(out, `${JSON.stringify(doc, null, 1)}\n`); log(`IB11 G-PLAY results written: ${path.basename(out)}`); }
    server.emit('gplay-done', doc);
  }
  return { server, pages, media, requests, results, finalize, listen: () => new Promise((r) => server.listen(port, '127.0.0.1', r)) };
}

module.exports = { createServer, plan, page, PORT, PEND_MS, N_CELLS, U_CELLS, CONTAINERS };

if (require.main === module) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const mediaDir = arg('--media');
  if (!mediaDir) { console.error('usage: node gplay_server.cjs --media <dir> [--port 8796] [--out <file>]'); process.exit(2); }
  const port = Number(arg('--port', String(PORT)));
  const out = arg('--out', path.join(process.cwd(), 'ib11-gplay-results.json'));
  let s;
  try { s = createServer({ mediaDir, port, out }); } catch (e) { console.error(`IB11 G-PLAY refused: ${e.message}`); process.exit(1); }
  s.listen().then(() => console.log(`IB11 G-PLAY: media SHA-256 verified; ${s.pages.length} pages. Open http://127.0.0.1:${port}/gplay/start in the Tampermonkey Chrome profile.`));
  s.server.on('gplay-done', () => console.log('IB11 G-PLAY: all pages complete.'));
  process.on('SIGINT', () => { s.finalize(); s.server.close(() => process.exit(0)); });
}
