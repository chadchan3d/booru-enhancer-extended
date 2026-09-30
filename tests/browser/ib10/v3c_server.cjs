'use strict';
// IB10 V3-C controlled server (test code, not production).
// Serves an e621-shaped /posts fixture page per run, the two supplied media
// fixtures under per-run unique no-store URLs, and collects results.
//   - media identity: both fixtures are checked against pinned SHA-256 values
//     before the server starts (it refuses otherwise);
//   - transports: RANGE (206 + Accept-Ranges, throttled), NORANGE (Range header
//     ignored, 200 full body, no Accept-Ranges, throttled) and FAST (RANGE,
//     unthrottled). The throttle exists only to make lifecycle/transfer timing
//     observable; it is not a product policy or byte limit;
//   - per request: start/end (server epoch ms), Range header, status, response
//     range, bytes handed to the socket (cumulative write log), end reason
//     (complete / client-abort / open-at-run-end);
//   - per run: the client's recorded events (posted by the package) and the
//     server requests for that run's token; the next run URL is returned.
// Usage: node v3c_server.cjs --media <dir> [--port 8790] [--out <file>] [--only <scenario,...>]
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEDIA = {
  mp4: { file: 'ib10_v3c_fixture.mp4', type: 'video/mp4', sha256: '9ba765f0a3c0e8035f96de18bf9f364d750ff1e9698d80ffe579494ee308b45e' },
  webm: { file: 'ib10_v3c_fixture.webm', type: 'video/webm', sha256: '467649067aecd56d4d49ca9885eb87a6df5150af1bae6f565a1dba8b3eeb4a61' },
};
const SCENARIOS = ['LEAVE_PENDING', 'LEAVE_LOADEDDATA', 'LEAVE_FIRST_FRAME', 'CYCLES_5', 'A_TO_B', 'VIEWER_PENDING', 'VIEWER_INSTALLED', 'VIEWER_CLOSE', 'DISPOSE'];
const TRANSPORTS = ['RANGE', 'NORANGE', 'FAST'];
const CONTAINERS = ['mp4', 'webm'];
const THROTTLE_BPS = 256 * 1024; // observability only
const CHUNK = 16 * 1024;
// 1x1 PNG used for every card preview (no third-party content).
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8cfc0f01f0005000201a5f6a5cf0000000049454e44ae426082', 'hex');

function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function verifyMedia(dir) {
  const out = {};
  for (const [k, m] of Object.entries(MEDIA)) {
    const p = path.join(dir, m.file);
    if (!fs.existsSync(p)) throw new Error(`missing fixture ${m.file}`);
    const h = sha256(p);
    if (h !== m.sha256) throw new Error(`fixture ${m.file} SHA-256 mismatch`);
    out[k] = { path: p, size: fs.statSync(p).size, sha256: h };
  }
  return out;
}

function plan(only) {
  const runs = [];
  const scen = only && only.length ? SCENARIOS.filter((s) => only.includes(s)) : SCENARIOS;
  for (const transport of TRANSPORTS) for (const container of CONTAINERS) for (const scenario of scen) {
    runs.push({ token: crypto.randomBytes(8).toString('hex'), scenario, container, transport });
  }
  return runs;
}

function page(run, port) {
  const card = (id, label) => {
    const media = `/v3c/media/${run.token}/${label}.${run.container}`;
    return `<article class="thumbnail" data-id="${id}" data-file-ext="${run.container}" data-width="1280" data-height="720" data-size="${run.size}" data-file-url="${media}" data-sample-url="/v3c/p.png?${label}" data-preview-url="/v3c/p.png?${label}" data-preview-webp="/v3c/p.png?w${label}"><a href="/posts/${id}" class="thm-link"><picture><source srcset="/v3c/p.png?w${label}" type="image/webp"><source srcset="/v3c/p.png?${label}" type="image/jpeg"><img src="/v3c/p.png?${label}" alt="" width="150" height="150"></picture></a></article>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>IB10 V3-C</title></head><body data-user-is-anonymous="true">
<section id="posts-container">${card('9001', 'A')}${card('9002', 'B')}${card('9003', 'C')}</section>
<script type="application/json" id="ib10c-run">${JSON.stringify({ token: run.token, scenario: run.scenario, container: run.container, transport: run.transport, port })}</script>
</body></html>`;
}

function createServer({ mediaDir, port = 8790, out = null, only = null, log = console.log }) {
  const media = verifyMedia(mediaDir);
  const runs = plan(only);
  for (const r of runs) r.size = media[r.container].size;
  const byToken = new Map(runs.map((r) => [r.token, r]));
  const requests = []; // all media requests
  const results = []; // { run, client, requests }
  let reqSeq = 0;

  function serveMedia(req, res, run, label) {
    const m = media[run.container];
    const total = m.size;
    const rec = { id: ++reqSeq, token: run.token, card: label, t0: Date.now(), method: req.method, range: req.headers.range || null, status: 0, contentRange: null, length: 0, bytesSent: 0, writes: [], tEnd: null, end: null };
    requests.push(rec);
    let start = 0; let end = total - 1;
    const honorRange = run.transport !== 'NORANGE';
    const headers = { 'Content-Type': MEDIA[run.container].type, 'Cache-Control': 'no-store', 'Connection': 'keep-alive' };
    if (honorRange) headers['Accept-Ranges'] = 'bytes';
    const mr = honorRange && rec.range && /^bytes=(\d*)-(\d*)$/.exec(rec.range);
    if (mr) {
      if (mr[1] !== '') { start = Number(mr[1]); if (mr[2] !== '') end = Math.min(Number(mr[2]), total - 1); } else if (mr[2] !== '') { start = Math.max(0, total - Number(mr[2])); }
      if (start > end || start >= total) { rec.status = 416; res.writeHead(416, { 'Content-Range': `bytes */${total}` }); rec.tEnd = Date.now(); rec.end = 'complete'; return res.end(); }
      rec.status = 206; rec.contentRange = `bytes ${start}-${end}/${total}`; headers['Content-Range'] = rec.contentRange;
    } else rec.status = 200;
    rec.length = end - start + 1; headers['Content-Length'] = rec.length;
    res.writeHead(rec.status, headers);
    if (req.method === 'HEAD') { rec.tEnd = Date.now(); rec.end = 'complete'; return res.end(); }
    const fd = fs.openSync(m.path, 'r');
    let pos = start; let closed = false; let timer = null;
    const finish = (why) => { if (rec.end) return; rec.end = why; rec.tEnd = Date.now(); if (timer) clearTimeout(timer); try { fs.closeSync(fd); } catch { /* closed */ } };
    res.on('close', () => { if (!res.writableFinished) { closed = true; finish('client-abort'); } });
    res.on('finish', () => finish('complete'));
    const throttled = run.transport !== 'FAST';
    const step = () => {
      if (closed || rec.end) return;
      const n = Math.min(throttled ? CHUNK : 256 * 1024, end - pos + 1);
      if (n <= 0) { res.end(); return; }
      const buf = Buffer.alloc(n); fs.readSync(fd, buf, 0, n, pos); pos += n;
      rec.bytesSent += n; rec.writes.push([Date.now(), rec.bytesSent]);
      const ok = res.write(buf);
      if (pos > end) { res.end(); return; }
      const next = () => { timer = setTimeout(step, throttled ? Math.round((n / THROTTLE_BPS) * 1000) : 0); };
      if (ok) next(); else res.once('drain', next);
    };
    step();
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const p = url.pathname;
    if (p === '/v3c/p.png') { res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store', 'Content-Length': PNG.length }); return res.end(PNG); }
    if (p === '/v3c/start') { res.writeHead(302, { Location: `/posts?run=${runs[0].token}`, 'Cache-Control': 'no-store' }); return res.end(); }
    if (p === '/posts') {
      const run = byToken.get(url.searchParams.get('run'));
      if (!run) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end('unknown run'); }
      const body = Buffer.from(page(run, port));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      return res.end(body);
    }
    const mm = /^\/v3c\/media\/([0-9a-f]{16})\/([ABC])\.(mp4|webm)$/.exec(p);
    if (mm) {
      const run = byToken.get(mm[1]);
      if (!run || run.container !== mm[3]) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
      return serveMedia(req, res, run, mm[2]);
    }
    if (p === '/v3c/result' && req.method === 'POST') {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        let client = null; try { client = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { client = null; }
        const run = client && byToken.get(client.token);
        if (!run) { res.writeHead(400, { 'Cache-Control': 'no-store' }); return res.end('{}'); }
        const tPost = Date.now();
        const reqs = requests.filter((r) => r.token === run.token).map((r) => ({ ...r, openAtRunEnd: !r.end, end: r.end || 'open-at-run-end' }));
        results.push({ run: { scenario: run.scenario, container: run.container, transport: run.transport }, tPost, client, requests: reqs });
        const idx = runs.indexOf(run);
        const next = runs[idx + 1] ? `/posts?run=${runs[idx + 1].token}` : null;
        log(`IB10 V3-C ${idx + 1}/${runs.length} ${run.transport} ${run.container} ${run.scenario}: ${reqs.length} request(s)`);
        if (!next) finalize();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ next }));
      });
      return undefined;
    }
    if (p === '/v3c/done') { res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('IB10 V3-C complete. Return the results file.'); }
    res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end();
  });

  function finalize() {
    const doc = { probe: 'ib10-v3c-controlled', version: '1.0.0', throttleBytesPerSecond: THROTTLE_BPS,
      media: Object.fromEntries(Object.entries(media).map(([k, m]) => [k, { size: m.size, sha256: m.sha256 }])),
      runs: results.map((r) => ({ ...r, requests: r.requests.map(({ token, ...x }) => x) })).map((r) => { const { client, ...rest } = r; if (client) delete client.token; return { ...rest, client }; }) };
    if (out) { fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n'); log(`IB10 V3-C results written: ${path.basename(out)}`); }
    server.emit('v3c-done', doc);
  }

  return { server, runs, media, requests, results, finalize, listen: () => new Promise((r) => server.listen(port, '127.0.0.1', r)) };
}

module.exports = { createServer, MEDIA, SCENARIOS, TRANSPORTS, CONTAINERS, THROTTLE_BPS, page, plan, verifyMedia };

if (require.main === module) {
  const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const mediaDir = arg('--media');
  if (!mediaDir) { console.error('usage: node v3c_server.cjs --media <dir> [--port 8790] [--out <file>] [--only S1,S2]'); process.exit(2); }
  const port = Number(arg('--port', '8790'));
  const out = arg('--out', path.join(process.cwd(), 'ib10-v3c-results.json'));
  const only = arg('--only') ? arg('--only').split(',') : null;
  let s;
  try { s = createServer({ mediaDir, port, out, only }); } catch (e) { console.error(`IB10 V3-C refused: ${e.message}`); process.exit(1); }
  s.listen().then(() => console.log(`IB10 V3-C: media SHA-256 verified; ${s.runs.length} runs. Open http://127.0.0.1:${port}/v3c/start in the Tampermonkey Chrome profile.`));
  s.server.on('v3c-done', () => console.log('IB10 V3-C: all runs complete.'));
  process.on('SIGINT', () => { s.finalize(); s.server.close(() => process.exit(0)); });
}
