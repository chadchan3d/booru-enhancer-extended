'use strict';
// Local qualification of the IB10 V3-C controlled experiment (no real browser;
// the real-browser run belongs to the operator). Covers:
//   1. static pinning: the derived package is current; its executed body is the
//      committed production body (b9d133c / 22e843c) byte for byte; metadata only
//      matches the local server; the preamble/runner never write settings;
//   2. the server over real HTTP: fixture SHA-256 gate, RANGE / NORANGE / FAST
//      responses, exact byte ranges, no-store, byte accounting and end reasons
//      (complete / client-abort / open-at-run-end), run plan, result collection;
//   3. a jsdom smoke run of the REAL package (fake clock, simulated readiness;
//      jsdom has no media stack, so this checks the recorder and runner, not
//      browser media behavior);
//   4. the analyzer on synthetic transport logs.
// Fault controls must each be caught. Usage: node verify_ib10_v3c.cjs --media <dir>
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib10_v3c.cjs');
const srv = require('./v3c_server.cjs');
const { analyzeRun } = require('./analyze_ib10_v3c.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 500) });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MEDIA_DIR = arg('--media');
const REPO = path.resolve(__dirname, '../../..');

// ---------- 1. static ----------
function staticChecks() {
  const derived = fs.readFileSync(b.OUT, 'utf8');
  const built = b.build();
  check('derived package matches a fresh build', derived === built.text);
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  check('production blob at the pinned commit is 22e843c', blob === b.EXPECTED_PRODUCTION_BLOB);
  const prod = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const body = derived.slice(derived.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, derived.indexOf(b.WRAP_CLOSE));
  check('executed body equals the committed production body byte for byte (no hooks, no patch)', body === split(prod).body);
  const meta = split(derived).meta.split('\n');
  check('matches only the local V3-C server; no update target; no remote @connect', meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === 'http://127.0.0.1:8790/*' && !meta.some((l) => /@(downloadURL|updateURL|connect)\b/.test(l)));
  const pre = derived.slice(0, derived.indexOf(b.WRAP_OPEN)).slice(derived.indexOf('/* IB10 V3-C PREAMBLE'));
  const post = derived.slice(derived.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length);
  check('preamble/runner never write settings or storage, never touch cookies, and send only to the local /v3c/result', !/settings\.set\(|GM_setValue|GM_deleteValue|localStorage|sessionStorage|document\.cookie|GM_xmlhttpRequest|sendBeacon|XMLHttpRequest/.test(pre + post) && (post.match(/fetch\(/g) || []).length === 1 && post.includes("fetch('/v3c/result'"));
  check('the only production-visible substitution is the location parameter (hostname e621.net)', /get hostname\(\) \{ return 'e621\.net'; \}/.test(pre) && b.WRAP_OPEN === 'const IB10C_PRODUCTION_BODY = function (location) {\n');
  return { derived, built };
}

// ---------- 2. server ----------
function get(port, p, headers = {}, { abortAfterMs = null, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method, headers }, (res) => {
      const chunks = []; let n = 0;
      res.on('data', (c) => { chunks.push(c); n += c.length; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), n, aborted: false }));
      res.on('error', () => {});
      if (abortAfterMs != null) setTimeout(() => { req.destroy(); resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), n, aborted: true }); }, abortAfterMs);
    });
    req.on('error', (e) => { if (abortAfterMs == null) reject(e); });
    req.end();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serverChecks() {
  // SHA-256 gate
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'ib10v3c-'));
  for (const m of Object.values(srv.MEDIA)) fs.copyFileSync(path.join(MEDIA_DIR, m.file), path.join(bad, m.file));
  fs.appendFileSync(path.join(bad, srv.MEDIA.webm.file), Buffer.from([0]));
  let refused = false; try { srv.createServer({ mediaDir: bad, port: 8799, log: () => {} }); } catch (e) { refused = /SHA-256 mismatch/.test(e.message); }
  check('fault altered fixture: the server refuses to start (SHA-256 gate)', refused);
  fs.rmSync(bad, { recursive: true, force: true });

  const port = 8791;
  const s = srv.createServer({ mediaDir: MEDIA_DIR, port, log: () => {} });
  await s.listen();
  check('run plan: 3 transports x 2 containers x 9 scenarios = 54 runs, unique tokens', s.runs.length === 54 && new Set(s.runs.map((r) => r.token)).size === 54);
  const pick = (transport, container) => s.runs.find((r) => r.transport === transport && r.container === container);
  const mp4 = fs.readFileSync(path.join(MEDIA_DIR, srv.MEDIA.mp4.file));
  const webm = fs.readFileSync(path.join(MEDIA_DIR, srv.MEDIA.webm.file));

  // page
  const R1 = pick('RANGE', 'mp4');
  const pg = await get(port, `/posts?run=${R1.token}`);
  const html = pg.body.toString('utf8');
  check('fixture page: no-store; logged-out marker; 3 e621-shaped video cards with per-run media URLs and data-size', pg.status === 200 && pg.headers['cache-control'] === 'no-store' && html.includes('data-user-is-anonymous="true"')
    && (html.match(/<article class="thumbnail"/g) || []).length === 3 && (html.match(new RegExp(`/v3c/media/${R1.token}/[ABC]\\.mp4`, 'g')) || []).length === 3 && html.includes(`data-size="${mp4.length}"`), html.slice(0, 300));
  check('unknown run token and cross-container media are refused (404)', (await get(port, '/posts?run=0000000000000000')).status === 404 && (await get(port, `/v3c/media/${R1.token}/A.webm`)).status === 404);

  // exact range
  const r = await get(port, `/v3c/media/${R1.token}/A.mp4`, { Range: 'bytes=1000-1999' });
  check('RANGE: bytes=1000-1999 -> 206, exact Content-Range, Accept-Ranges, no-store, identical bytes', r.status === 206 && r.headers['content-range'] === `bytes 1000-1999/${mp4.length}` && r.headers['accept-ranges'] === 'bytes' && r.headers['cache-control'] === 'no-store' && r.body.equals(mp4.subarray(1000, 2000)));
  // throttled abort
  const t0 = Date.now();
  const a = await get(port, `/v3c/media/${R1.token}/B.mp4`, { Range: 'bytes=0-' }, { abortAfterMs: 500 });
  await sleep(300);
  const rec = s.requests.find((x) => x.card === 'B' && x.token === R1.token);
  check('RANGE throttled: open-ended range -> 206; client abort at 500 ms is logged as client-abort; bytes stop growing after the abort', a.status === 206 && rec && rec.end === 'client-abort' && rec.bytesSent < mp4.length && rec.bytesSent >= 64 * 1024 && rec.bytesSent <= 256 * 1024 && rec.tEnd - t0 < 900 && rec.writes.every((w, i, arr) => i === 0 || w[1] >= arr[i - 1][1]), JSON.stringify(rec && { ...rec, writes: rec.writes.length }));
  const before = rec.bytesSent; await sleep(400);
  check('RANGE throttled: no bytes are handed to the socket after client-abort', rec.bytesSent === before);
  // NORANGE
  const RN = pick('NORANGE', 'webm');
  const n = await get(port, `/v3c/media/${RN.token}/A.webm`, { Range: 'bytes=1000-1999' }, { abortAfterMs: 300 });
  const recN = s.requests.find((x) => x.token === RN.token);
  check('NORANGE: Range header ignored -> 200 full length, no Accept-Ranges', n.status === 200 && Number(n.headers['content-length']) === webm.length && !('accept-ranges' in n.headers) && recN.status === 200 && recN.range === 'bytes=1000-1999');
  // FAST
  const RF = pick('FAST', 'webm');
  const tf = Date.now();
  const f = await get(port, `/v3c/media/${RF.token}/A.webm`, { Range: 'bytes=0-' });
  const recF = s.requests.find((x) => x.token === RF.token);
  check('FAST: unthrottled full transfer completes; identical bytes; logged complete with bytesSent = size', f.status === 206 && f.body.equals(webm) && recF.end === 'complete' && recF.bytesSent === webm.length && Date.now() - tf < 3000);
  // open request at run end
  const RO = pick('RANGE', 'webm');
  const pending = get(port, `/v3c/media/${RO.token}/A.webm`, { Range: 'bytes=0-' }, { abortAfterMs: 1500 });
  await sleep(300);
  const post = await new Promise((resolve) => { const q = http.request({ host: '127.0.0.1', port, path: '/v3c/result', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => { const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => resolve(JSON.parse(Buffer.concat(c).toString()))); }); q.end(JSON.stringify({ token: RO.token, marks: [] })); });
  const stored = s.results.find((x) => x.run.scenario === RO.scenario && x.run.transport === 'RANGE' && x.run.container === 'webm');
  check('result POST: stored with the run, next run URL returned; a request still streaming is marked open-at-run-end', typeof post.next === 'string' && stored && stored.requests.length === 1 && stored.requests[0].end === 'open-at-run-end' && stored.requests[0].openAtRunEnd === true, JSON.stringify(post));
  await pending;
  await new Promise((r) => s.server.close(r));
}

// ---------- 3. jsdom smoke of the package ----------
async function smoke(text, scenario, { passLocation = true } = {}) {
  const run = { token: 'feedfacefeedface', scenario, container: 'mp4', transport: 'RANGE', size: 1234 };
  const html = srv.page(run, 8790);
  let clock = null; let posted = null;
  let src = text;
  if (!passLocation) src = src.replace('IB10C_PRODUCTION_BODY(IB10C_LOCATION);', 'IB10C_PRODUCTION_BODY(window.location);');
  const c = h.load({ url: `http://127.0.0.1:8790/posts?run=${run.token}`, html, source: src, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w);
    w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.fetch = async (u, o) => { if (String(u) === '/v3c/result') { posted = JSON.parse(o.body); return { json: async () => ({ next: null }) }; } return new Promise(() => {}); };
    // simulated media: readiness 120 ms after a src assignment unless the src is removed first
    const MP = w.HTMLMediaElement.prototype;
    const d = Object.getOwnPropertyDescriptor(MP, 'src');
    Object.defineProperty(MP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); const el = this; const gen = (el.__g = (el.__g || 0) + 1); w.setTimeout(() => { if (el.__g === gen && el.hasAttribute('src')) { el.__rs = 2; el.dispatchEvent(new w.Event('loadeddata')); } }, 120); } });
    Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rs || 0; } });
  } });
  const w = c.window;
  // jsdom does not navigate; the runner's final location.assign is inert here.
  for (let i = 0; i < 400 && !posted; i++) { await h.sleep(0); await clock.advance(100); }
  await h.sleep(20);
  w.close();
  return posted;
}

async function smokeChecks(derived) {
  const leaks = (o) => /https?:\/\/(?!127\.0\.0\.1)/.test(JSON.stringify(o));
  const S = {};
  for (const sc of ['LEAVE_LOADEDDATA', 'CYCLES_5', 'VIEWER_INSTALLED', 'DISPOSE', 'LEAVE_PENDING']) S[sc] = await smoke(derived, sc);
  const hv = (p) => (p ? p.videos.filter((v) => v.owner === 'hover') : []);
  const mk = (p, what) => (p ? p.marks.filter((m) => m.what === what) : []);
  const L = S.LEAVE_LOADEDDATA;
  check('smoke LEAVE_LOADEDDATA: identity MATCH; gallery enhanced on the shimmed e621 host; one hover <video> for card A, owner from the stack', L && L.identity === 'MATCH_EXPECTED_ARTIFACT' && mk(L, 'start')[0]?.enhanced && hv(L).length === 1 && hv(L)[0].label === 'A', JSON.stringify(L && { id: L.identity, marks: L.marks, v: L.videos.length }));
  const v = hv(L)[0];
  check('smoke LEAVE_LOADEDDATA: src set at enter; loadeddata recorded; muted play; leave -> pause; cleanup mark; window end >= cleanup + 5000', v && v.calls.some((x) => x[1] === 'src' && x[2] === 'A') && v.ev.some((e) => e[1] === 'loadeddata') && v.calls.some((x) => x[1] === 'play' && x[2] === 'muted') && v.calls.some((x) => x[1] === 'pause')
    && mk(L, 'windowEnd')[0].t - mk(L, 'cleanup')[0].t >= 5000, JSON.stringify(v));
  check('smoke CYCLES_5: five enters/leaves and five hover elements', S.CYCLES_5 && mk(S.CYCLES_5, 'enter').length === 5 && mk(S.CYCLES_5, 'leave').length === 5 && hv(S.CYCLES_5).length === 5, JSON.stringify(S.CYCLES_5 && S.CYCLES_5.marks));
  const VI = S.VIEWER_INSTALLED;
  check('smoke VIEWER_INSTALLED: click opens the viewer; its <video> is recorded with owner viewer', VI && mk(VI, 'viewer')[0]?.open === true && VI.videos.some((x) => x.owner === 'viewer'), JSON.stringify(VI && VI.marks));
  check('smoke DISPOSE: dispose mark and cleanup recorded', S.DISPOSE && mk(S.DISPOSE, 'dispose').length === 1 && mk(S.DISPOSE, 'cleanup')[0]?.kind === 'dispose');
  const P = S.LEAVE_PENDING;
  check('smoke LEAVE_PENDING: leave at ~40 ms precedes readiness; src removed', P && hv(P)[0] && !hv(P)[0].ev.some((e) => e[1] === 'loadeddata') && hv(P)[0].calls.some((x) => x[1] === 'removeSrc'), JSON.stringify(P && hv(P)[0]));
  check('smoke outputs: no remote URL, no trusted pointer events (scripted only), no runner error', Object.values(S).every((p) => p && !leaks(p) && p.trustedPointerEvents === 0 && !p.error), JSON.stringify(Object.values(S).map((p) => p && p.error)));
  // faults
  const tampered = b.build({ bodyTransform: (x) => x.replace('const HOVER_DWELL_MS = 200;', 'const HOVER_DWELL_MS = 201;') }).text;
  const T = await smoke(tampered, 'LEAVE_LOADEDDATA');
  check('fault executed body differs from production: identity MISMATCH', T && T.identity === 'MISMATCH', T && T.identity);
  const N = await smoke(derived, 'LEAVE_LOADEDDATA', { passLocation: false });
  check('fault host substitution removed: the e621 path does not run (no hover video) - the shim is load-bearing', N && hv(N).length === 0, JSON.stringify(N && N.videos.length));
}

// ---------- 4. analyzer ----------
function analyzerChecks() {
  const origin = 1_000_000;
  const mkRun = (reqs) => ({ run: { scenario: 'LEAVE_LOADEDDATA', container: 'mp4', transport: 'RANGE' }, client: { identity: 'MATCH_EXPECTED_ARTIFACT', timeOrigin: origin, trustedPointerEvents: 0,
    marks: [{ t: 100, what: 'enter' }, { t: 1000, what: 'leave' }, { t: 1000, what: 'cleanup' }, { t: 6000, what: 'windowEnd' }],
    videos: [{ owner: 'hover', label: 'A', created: 100, ev: [[400, 'loadeddata']], calls: [[100, 'src', 'A'], [1000, 'pause']], firstFrame: 450, states: [[100, 0, 0, 1, 2, 0, 0, 1], [400, 1, 1, 1, 2, 2, 3.5, 0], [1000, 0, 0, 1, 2, 2, 3.5, 1], [3000, 0, 0, 1, 1, 4, 9.0, 1]] }] }, requests: reqs });
  const cont = analyzeRun(mkRun([{ id: 1, card: 'A', t0: origin + 150, range: 'bytes=0-', status: 206, length: 3000000, bytesSent: 2000000, writes: [[origin + 500, 500000], [origin + 1000, 1000000], [origin + 3000, 1500000], [origin + 5000, 2000000]], tEnd: null, end: 'open-at-run-end' }]));
  check('analyzer: transfer continuing after leave -> active at cleanup, 1,000,000 bytes within +5 s, still open; element detached but holding src with buffered growth (event and transport kept apart)',
    cont.transport.requestsActiveAtCleanup === 1 && cont.transport.bytesAfterCleanupWithin5s === 1000000 && cont.transport.openAtRunEnd === 1 && cont.event.holdingSrcAtEnd === 1 && cont.event.elements[0].bufferedGrowthAfterCleanup === 5.5, JSON.stringify(cont.transport));
  const stop = analyzeRun(mkRun([{ id: 1, card: 'A', t0: origin + 150, range: 'bytes=0-', status: 206, length: 3000000, bytesSent: 1000000, writes: [[origin + 500, 500000], [origin + 1000, 1000000]], tEnd: origin + 1030, end: 'client-abort' }]));
  check('analyzer: client abort 30 ms after leave -> 0 bytes after cleanup, abort latency 30 ms', stop.transport.bytesAfterCleanupWithin5s === 0 && stop.transport.clientAbortsAfterCleanup.join() === '30', JSON.stringify(stop.transport));
  const done = analyzeRun(mkRun([{ id: 1, card: 'A', t0: origin + 150, range: 'bytes=0-', status: 206, length: 3000000, bytesSent: 3000000, writes: [[origin + 300, 3000000]], tEnd: origin + 310, end: 'complete' }, { id: 2, card: 'A', t0: origin + 2000, range: 'bytes=100-', status: 206, length: 10, bytesSent: 10, writes: [[origin + 2001, 10]], tEnd: origin + 2002, end: 'complete' }]));
  check('analyzer: transfer complete before leave and a re-request after leave are distinguished', done.transport.requestsCompleteBeforeCleanup === 1 && done.transport.requestsStartedAfterCleanup === 1 && done.transport.bytesAfterCleanupWithin5s === 10, JSON.stringify(done.transport));
}

async function main() {
  if (!MEDIA_DIR) { console.error('usage: node verify_ib10_v3c.cjs --media <dir>'); process.exitCode = 2; return; }
  let media = null; try { media = srv.verifyMedia(MEDIA_DIR); } catch (e) { media = null; check(`fixtures present and SHA-256 verified (${e.message})`, false); }
  if (media) check('fixtures present and SHA-256 verified: mp4 9ba765f0..., webm 46764906...', media.mp4.sha256 === srv.MEDIA.mp4.sha256 && media.webm.sha256 === srv.MEDIA.webm.sha256);
  const { derived } = staticChecks();
  if (media) await serverChecks();
  await smokeChecks(derived);
  analyzerChecks();
  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB10', stage: 'E-stage V3-C controlled experiment, local qualification (no real browser)', production_commit: b.COMMIT, production_blob: b.EXPECTED_PRODUCTION_BLOB,
    media: media && Object.fromEntries(Object.entries(media).map(([k, m]) => [k, { size: m.size, sha256: m.sha256 }])),
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB10_V3C_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
