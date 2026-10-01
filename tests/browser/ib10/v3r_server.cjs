'use strict';
// IB10 V3-R controlled revisit/cache server (test code, not production).
// Extends the V3-C setup (same fixtures, SHA-256 gate, Range-capable throttled
// transport, per-request byte accounting) with two cache arms:
//   NO_STORE  - Cache-Control: no-store (no ordinary HTTP-cache reuse);
//   CACHEABLE - Cache-Control: public, max-age=3600; a strong ETag (stable per
//               URL); Last-Modified (fixed). Conditional requests are honored:
//               If-None-Match / If-Modified-Since without Range -> 304;
//               Range with If-Range -> 206 if it matches the ETag or the
//               Last-Modified date, otherwise a 200 full response.
// Every cell has its own unique media URLs (cold first hover). Per request it
// logs start/end, the relevant request headers (Range, If-None-Match,
// If-Modified-Since, If-Range, Cache-Control, Pragma), status, response range,
// cumulative bytes handed to the socket, and the end reason. The throttle
// (256 KiB/s) exists only to make buffering observable.
// Usage: node v3r_server.cjs --media <dir> [--port 8792] [--out <file>]
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MEDIA, verifyMedia } = require('./v3c_server.cjs');

const VARIANTS = ['ASIS', 'RELEASE'];
const CACHES = ['NO_STORE', 'CACHEABLE'];
const CONTAINERS = ['mp4', 'webm'];
const GAPS = [500, 5000];
const THROTTLE_BPS = 256 * 1024;
const CHUNK = 16 * 1024;
const LAST_MODIFIED = 'Thu, 01 Jan 2026 00:00:00 GMT';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f6a5cf0000000049454e44ae426082', 'hex');

// 16 cells; the two variants of each condition run back to back.
function plan() {
  const cells = [];
  for (const cache of CACHES) for (const container of CONTAINERS) for (const gap of GAPS) for (const variant of VARIANTS) {
    cells.push({ token: crypto.randomBytes(8).toString('hex'), variant, cache, container, gap });
  }
  return cells;
}

function page(cell, size) {
  const card = (id, label) => {
    const media = `/v3r/media/${cell.token}/${label}.${cell.container}`;
    return `<article class="thumbnail" data-id="${id}" data-file-ext="${cell.container}" data-width="1280" data-height="720" data-size="${size}" data-file-url="${media}" data-sample-url="/v3r/p.png?${label}" data-preview-url="/v3r/p.png?${label}" data-preview-webp="/v3r/p.png?w${label}"><a href="/posts/${id}" class="thm-link"><picture><source srcset="/v3r/p.png?w${label}" type="image/webp"><source srcset="/v3r/p.png?${label}" type="image/jpeg"><img src="/v3r/p.png?${label}" alt="" width="150" height="150"></picture></a></article>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>IB10 V3-R</title></head><body data-user-is-anonymous="true">
<section id="posts-container">${card('9101', 'A')}${card('9102', 'B')}${card('9103', 'C')}</section>
<script type="application/json" id="ib10r-run">${JSON.stringify({ token: cell.token, variant: cell.variant, cache: cell.cache, container: cell.container, gap: cell.gap })}</script>
</body></html>`;
}

function etagFor(cell, label, sha) { return `"${cell.token}-${label}-${sha.slice(0, 16)}"`; }

function createServer({ mediaDir, port = 8792, out = null, log = console.log }) {
  const media = verifyMedia(mediaDir);
  const cells = plan();
  const byToken = new Map(cells.map((c) => [c.token, c]));
  const requests = [];
  const results = [];
  let seq = 0;

  function serveMedia(req, res, cell, label) {
    const m = media[cell.container];
    const total = m.size;
    const h = req.headers;
    const rec = { id: ++seq, token: cell.token, card: label, t0: Date.now(), method: req.method,
      req: { range: h.range || null, ifNoneMatch: h['if-none-match'] || null, ifModifiedSince: h['if-modified-since'] || null, ifRange: h['if-range'] || null, cacheControl: h['cache-control'] || null, pragma: h.pragma || null },
      status: 0, contentRange: null, length: 0, bytesSent: 0, writes: [], tEnd: null, end: null };
    requests.push(rec);
    const etag = etagFor(cell, label, m.sha256);
    const headers = { 'Content-Type': MEDIA[cell.container].type, 'Accept-Ranges': 'bytes', Connection: 'keep-alive' };
    if (cell.cache === 'NO_STORE') headers['Cache-Control'] = 'no-store';
    else { headers['Cache-Control'] = 'public, max-age=3600'; headers.ETag = etag; headers['Last-Modified'] = LAST_MODIFIED; }
    const finishNow = (status) => { rec.status = status; rec.tEnd = Date.now(); rec.end = 'complete'; };
    // Conditional GET without Range (CACHEABLE only).
    if (cell.cache === 'CACHEABLE' && !rec.req.range && (rec.req.ifNoneMatch === etag || (rec.req.ifModifiedSince && !rec.req.ifNoneMatch && Date.parse(rec.req.ifModifiedSince) >= Date.parse(LAST_MODIFIED)))) {
      res.writeHead(304, headers); finishNow(304); return res.end();
    }
    let start = 0; let end = total - 1;
    let honorRange = !!rec.req.range;
    if (honorRange && rec.req.ifRange) honorRange = cell.cache === 'CACHEABLE' && (rec.req.ifRange === etag || rec.req.ifRange === LAST_MODIFIED);
    const mr = honorRange && /^bytes=(\d*)-(\d*)$/.exec(rec.req.range);
    if (mr) {
      if (mr[1] !== '') { start = Number(mr[1]); if (mr[2] !== '') end = Math.min(Number(mr[2]), total - 1); } else if (mr[2] !== '') start = Math.max(0, total - Number(mr[2]));
      if (start > end || start >= total) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${total}` }); finishNow(416); return res.end(); }
      rec.status = 206; rec.contentRange = `bytes ${start}-${end}/${total}`; headers['Content-Range'] = rec.contentRange;
    } else rec.status = 200;
    rec.rangeStart = start;
    rec.length = end - start + 1; headers['Content-Length'] = rec.length;
    res.writeHead(rec.status, headers);
    if (req.method === 'HEAD') { finishNow(rec.status); return res.end(); }
    const fd = fs.openSync(m.path, 'r');
    let pos = start; let closed = false; let timer = null;
    const fin = (why) => { if (rec.end) return; rec.end = why; rec.tEnd = Date.now(); if (timer) clearTimeout(timer); try { fs.closeSync(fd); } catch { /* closed */ } };
    res.on('close', () => { if (!res.writableFinished) { closed = true; fin('client-abort'); } });
    res.on('finish', () => fin('complete'));
    const step = () => {
      if (closed || rec.end) return;
      const n = Math.min(CHUNK, end - pos + 1);
      if (n <= 0) { res.end(); return; }
      const buf = Buffer.alloc(n); fs.readSync(fd, buf, 0, n, pos); pos += n;
      rec.bytesSent += n; rec.writes.push([Date.now(), rec.bytesSent]);
      const ok = res.write(buf);
      if (pos > end) { res.end(); return; }
      const next = () => { timer = setTimeout(step, Math.round((n / THROTTLE_BPS) * 1000)); };
      if (ok) next(); else res.once('drain', next);
    };
    step();
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (p === '/v3r/p.png') { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'Content-Length': PNG.length }); return res.end(PNG); }
    if (p === '/v3r/start') { res.writeHead(302, { Location: `/posts?run=${cells[0].token}`, 'Cache-Control': 'no-store' }); return res.end(); }
    if (p === '/posts') {
      const cell = byToken.get(url.searchParams.get('run'));
      if (!cell) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end('unknown cell'); }
      const body = Buffer.from(page(cell, media[cell.container].size));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      return res.end(body);
    }
    const mm = /^\/v3r\/media\/([0-9a-f]{16})\/([ABC])\.(mp4|webm)$/.exec(p);
    if (mm) {
      const cell = byToken.get(mm[1]);
      if (!cell || cell.container !== mm[3]) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
      return serveMedia(req, res, cell, mm[2]);
    }
    if (p === '/v3r/result' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let client = null; try { client = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { client = null; }
        const cell = client && byToken.get(client.token);
        if (!cell) { res.writeHead(400, { 'Cache-Control': 'no-store' }); return res.end('{}'); }
        const reqs = requests.filter((r) => r.token === cell.token).map((r) => ({ ...r, openAtRunEnd: !r.end, end: r.end || 'open-at-run-end' }));
        results.push({ cell: { variant: cell.variant, cache: cell.cache, container: cell.container, gap: cell.gap }, tPost: Date.now(), client, requests: reqs });
        const idx = cells.indexOf(cell);
        const next = cells[idx + 1] ? `/posts?run=${cells[idx + 1].token}` : null;
        log(`IB10 V3-R ${idx + 1}/${cells.length} ${cell.variant} ${cell.cache} ${cell.container} gap ${cell.gap}: ${reqs.length} request(s)`);
        if (!next) finalize();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ next }));
      });
      return undefined;
    }
    if (p === '/v3r/done') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('IB10 V3-R complete. Return the results file.'); }
    res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end();
  });

  function finalize() {
    const doc = { probe: 'ib10-v3r-controlled', version: '1.0.0', throttleBytesPerSecond: THROTTLE_BPS, lastModified: LAST_MODIFIED,
      media: Object.fromEntries(Object.entries(media).map(([k, m]) => [k, { size: m.size, sha256: m.sha256 }])),
      runs: results.map((r) => { const { client, ...rest } = r; const c = client ? { ...client } : null; if (c) delete c.token;
        return { ...rest, client: c, requests: r.requests.map(({ token, ...x }) => x) }; }) };
    if (out) { fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n'); log(`IB10 V3-R results written: ${path.basename(out)}`); }
    server.emit('v3r-done', doc);
  }

  return { server, cells, media, requests, results, finalize, etagFor, listen: () => new Promise((r) => server.listen(port, '127.0.0.1', r)) };
}

module.exports = { createServer, plan, page, etagFor, VARIANTS, CACHES, CONTAINERS, GAPS, THROTTLE_BPS, LAST_MODIFIED };

if (require.main === module) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const mediaDir = arg('--media');
  if (!mediaDir) { console.error('usage: node v3r_server.cjs --media <dir> [--port 8792] [--out <file>]'); process.exit(2); }
  const port = Number(arg('--port', '8792'));
  const out = arg('--out', path.join(process.cwd(), 'ib10-v3r-results.json'));
  let s;
  try { s = createServer({ mediaDir, port, out }); } catch (e) { console.error(`IB10 V3-R refused: ${e.message}`); process.exit(1); }
  s.listen().then(() => console.log(`IB10 V3-R: media SHA-256 verified; ${s.cells.length} cells. Open http://127.0.0.1:${port}/v3r/start in the Tampermonkey Chrome profile.`));
  s.server.on('v3r-done', () => console.log('IB10 V3-R: all cells complete.'));
  process.on('SIGINT', () => { s.finalize(); s.server.close(() => process.exit(0)); });
}
