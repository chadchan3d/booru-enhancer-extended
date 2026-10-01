'use strict';
// Local qualification of the IB10 V3-R revisit/cache experiment (no real browser;
// the real-browser run belongs to the operator). Covers:
//   1. variant identity: AS-IS body = committed production body; RELEASE body =
//      production + exactly one test-only line at the hide() anchor;
//   2. behavior scope: RELEASE differs from production ONLY by releasing an
//      installed hover video at leave (removeAttribute('src') + load()); pending
//      leaves, sustained hovers, A->B and the IB09 still-image path are identical;
//   3. the REAL package in jsdom (fake clock, simulated readiness): per-variant
//      identity, hold >= 1 s after readiness, B quick pass < 100 ms, revisit gap,
//      first/revisit elements, source cleanup by variant;
//   4. the server over real HTTP: fixture gate, cache headers per arm, conditional
//      requests (304 / If-Range), exact Range, byte accounting, end reasons, plan;
//   5. the analyzer's revisit classification on synthetic logs.
// Fault controls must each be caught. Usage: node verify_ib10_v3r.cjs --media <dir>
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib10_v3r.cjs');
const { analyzeCell, analyze } = require('./analyze_ib10_v3r.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 600) });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MEDIA_DIR = arg('--media');
const REPO = path.resolve(__dirname, '../../..');
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const PROD_BODY = split(PROD).body;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadMutated = (file, from, to) => { const src = mustReplace(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), from, to); const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file)); m._compile(src, file); return m.exports; };

// ---------- 1. static / identity ----------
const derived = fs.readFileSync(b.OUT, 'utf8');
check('derived package matches a fresh build', derived === b.build().text);
check('production blob at the pinned commit is 22e843c; working-tree production unchanged', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB
  && h.gitBlobId(h.productionSource()) === b.EXPECTED_PRODUCTION_BLOB);
const { asis, release } = b.extractBodies(derived);
check('AS-IS body equals the committed production body byte for byte', asis === PROD_BODY);
check('RELEASE body = production + exactly one inserted test-only line at the hide() anchor (removing it restores production)', release !== PROD_BODY && release.split(b.RELEASE_LINE).length === 2 && release.replace(b.RELEASE_LINE, '') === PROD_BODY
  && release.includes(b.RELEASE_ANCHOR.replace('\t\t\thoverEl.style.display', '')));
const meta = split(derived).meta.split('\n');
check('matches only the local V3-R server; no update target; no @connect', meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === 'http://127.0.0.1:8792/*' && !meta.some((l) => /@(downloadURL|updateURL|connect)\b/.test(l)));
const post = derived.slice(derived.indexOf('/* IB10 V3-R RUNNER POSTAMBLE'));
check('runner writes no settings/storage and sends only to /v3r/result', !/settings\.set\(|GM_setValue|localStorage|sessionStorage|document\.cookie|GM_xmlhttpRequest|XMLHttpRequest|sendBeacon/.test(post) && (post.match(/fetch\(/g) || []).length === 1 && post.includes("fetch('/v3r/result'"));

// ---------- 2. behavior scope (production vs RELEASE-patched production) ----------
function mediaModel(w, clock, log) {
  const MP = w.HTMLMediaElement.prototype;
  const d = Object.getOwnPropertyDescriptor(MP, 'src');
  let seq = 0; const ids = new WeakMap(); const id = (el) => { if (!ids.has(el)) ids.set(el, ++seq); return ids.get(el); };
  Object.defineProperty(MP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) {
    d.set.call(this, v); const el = this; el.__rs = 0; const g = (el.__g = (el.__g || 0) + 1); log.push([clock.now(), id(el), 'src']);
    w.setTimeout(() => { if (el.__g === g && el.hasAttribute('src')) { el.__rs = 2; el.dispatchEvent(new w.Event('loadeddata')); } }, 120);
  } });
  const ra = w.Element.prototype.removeAttribute;
  w.Element.prototype.removeAttribute = function (n) { if (this instanceof w.HTMLMediaElement && n === 'src') { log.push([clock.now(), id(this), 'removeSrc']); this.__g = (this.__g || 0) + 1; } return ra.call(this, n); };
  for (const k of ['load', 'pause', 'play']) { const f = MP[k]; MP[k] = function (...a) { log.push([clock.now(), id(this), k]); return f.apply(this, a); }; }
  Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rs || 0; } });
}
async function scopeRun(source, seq) {
  let clock = null; const log = [];
  const html = hh.listing('e621.net', 3).html;
  const c = h.load({ url: 'https://e621.net/posts', html, source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    for (const [i, a] of [...w.document.querySelectorAll('article')].entries()) if (i < 2) { a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); }
    mediaModel(w, clock, log);
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const img = (i) => w.document.querySelectorAll('article')[i].querySelector('img');
  const api = { enter: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(0); }, leave: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(0); }, wait: (ms) => clock.advance(ms) };
  const t0 = clock.now(); await seq(api); w.close();
  return log.map(([t, e, k]) => [t - t0, e, k]);
}
const SCOPE = {
  sustained: async (a) => { await a.enter(0); await a.wait(1000); },
  pendingLeave: async (a) => { await a.enter(0); await a.wait(40); await a.leave(0); await a.wait(500); },
  readyLeave: async (a) => { await a.enter(0); await a.wait(300); await a.leave(0); await a.wait(500); },
  aToB: async (a) => { await a.enter(0); await a.wait(300); await a.leave(0); await a.enter(1); await a.wait(300); await a.leave(1); await a.wait(500); },
  cycles: async (a) => { for (let k = 0; k < 5; k++) { await a.enter(0); await a.wait(300); await a.leave(0); await a.wait(100); } },
};
const RELEASE_SRC = mustReplace(PROD.replace(/\r\n/g, '\n'), b.RELEASE_ANCHOR, mustReplace(b.RELEASE_ANCHOR, '\t\t\thoverEl.style.display', b.RELEASE_LINE + '\t\t\thoverEl.style.display'));
async function scopeChecks() {
  for (const [name, seq] of Object.entries(SCOPE)) {
    const p = await scopeRun(PROD, seq); const r = await scopeRun(RELEASE_SRC, seq);
    const extra = r.filter((x) => !p.some((y) => JSON.stringify(y) === JSON.stringify(x)));
    const missing = p.filter((x) => !r.some((y) => JSON.stringify(y) === JSON.stringify(x)));
    const installedLeave = ['readyLeave', 'aToB', 'cycles'].includes(name);
    const ok = missing.length === 0 && (installedLeave ? extra.length > 0 && extra.every((x) => x[2] === 'removeSrc' || x[2] === 'load') && extra.filter((x) => x[2] === 'removeSrc').length === extra.filter((x) => x[2] === 'load').length : extra.length === 0);
    check(`behavior scope ${name}: RELEASE ${installedLeave ? 'adds only removeSrc+load on installed videos at leave' : 'is identical to production'}`, ok, JSON.stringify({ extra, missing }));
  }
  // IB09 still-image path unchanged
  const q = async (source) => { const s = await hh.session({ host: 'e621.net', quality: 'preview', source }); s.startAt(); await s.enter(0); await s.wait(300); const u = s.rec.assigns.find((a) => a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (u) await s.complete(u); await s.wait(200); await s.leave(0); await s.wait(300); const tl = hh.timeline(s); s.close(); return JSON.stringify({ a: tl.assigns, i: tl.installs, m: tl.metadata }); };
  check('behavior scope: the IB09 still-image hover path is identical under RELEASE', (await q(PROD.replace(/\r\n/g, '\n'))) === (await q(RELEASE_SRC)));
}

// ---------- 3. package smoke ----------
async function smoke(text, cell) {
  const { page } = require('./v3r_server.cjs');
  const full = { token: 'feedfacefeedface', ...cell };
  const html = page(full, 1234);
  let clock = null; let posted = null;
  const c = h.load({ url: `http://127.0.0.1:8792/posts?run=${full.token}`, html, source: text, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.fetch = async (u, o) => { if (String(u) === '/v3r/result') { posted = JSON.parse(o.body); return { json: async () => ({ next: null }) }; } return new Promise(() => {}); };
    const MP = w.HTMLMediaElement.prototype; const d = Object.getOwnPropertyDescriptor(MP, 'src');
    Object.defineProperty(MP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); const el = this; const g = (el.__g = (el.__g || 0) + 1); w.setTimeout(() => { if (el.__g === g && el.hasAttribute('src')) { el.__rs = 2; el.dispatchEvent(new w.Event('loadeddata')); } }, 120); } });
    Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rs || 0; } });
  } });
  const w = c.window;
  for (let i = 0; i < 500 && !posted; i++) { await h.sleep(0); await clock.advance(50); }
  w.close();
  return posted;
}
async function smokeChecks() {
  const out = {};
  for (const variant of ['ASIS', 'RELEASE']) for (const gap of [500, 5000]) out[`${variant}${gap}`] = await smoke(derived, { variant, cache: 'NO_STORE', container: 'mp4', gap });
  for (const [k, p] of Object.entries(out)) {
    const variant = k.startsWith('ASIS') ? 'ASIS' : 'RELEASE'; const gap = Number(k.replace(/\D/g, ''));
    const run = { cell: { variant, cache: 'NO_STORE', container: 'mp4', gap }, client: p, requests: [] };
    const a = p && analyzeCell(run);
    check(`smoke ${k}: identity MATCH_${variant}; two hover A elements (first + revisit); revisit readiness recorded`, p && p.identity === `MATCH_${variant}` && a.hoverElementsA === 2 && a.first.loadeddataMs === 120 && a.revisit && a.revisit.loadeddataMs === 120, JSON.stringify(p && { id: p.identity, marks: p.marks }));
    check(`smoke ${k}: hold >= 1000 ms after readiness; B quick pass < 100 ms; revisit gap ${gap} ms (+/- 30)`, a && a.timing.holdAfterReadyMs >= 1000 && a.timing.bPassMs < 100 && Math.abs(a.timing.actualGapMs - gap) <= 30, JSON.stringify(a && a.timing));
    check(`smoke ${k}: source cleanup by variant (${variant === 'RELEASE' ? 'installed A released at leave' : 'installed A keeps its src at leave'})`, a && (variant === 'RELEASE' ? a.firstLeave.releasedAtLeave === true : a.firstLeave.releasedAtLeave === false), JSON.stringify(a && a.firstLeave));
    check(`smoke ${k}: no remote URL, no trusted pointer events, no runner error`, p && !/https?:\/\/(?!127\.0\.0\.1)/.test(JSON.stringify(p)) && p.trustedPointerEvents === 0 && !p.error);
  }
  // faults
  const noPatch = b.build({ releaseTransform: (x) => x.replace(b.RELEASE_LINE, '') }).text;
  const np = await smoke(noPatch, { variant: 'RELEASE', cache: 'NO_STORE', container: 'mp4', gap: 500 });
  const npa = np && analyzeCell({ cell: { variant: 'RELEASE' }, client: np, requests: [] });
  check('fault RELEASE patch missing: caught (identity MISMATCH and no release at leave)', np && np.identity === 'MISMATCH' && npa.firstLeave.releasedAtLeave === false);
  const swap = b.build({ asisTransform: (x) => b.releaseBody(x) }).text;
  const sw = await smoke(swap, { variant: 'ASIS', cache: 'NO_STORE', container: 'mp4', gap: 500 });
  check('fault variant swap (AS-IS cell runs the RELEASE body): caught (identity MISMATCH)', sw && sw.identity === 'MISMATCH');
  const badGap = b.build({ postTransform: (x) => mustReplace(x, 'R.t() >= tLeave + cfg.gap', 'R.t() >= tLeave + cfg.gap / 10') }).text;
  const bg = await smoke(badGap, { variant: 'ASIS', cache: 'NO_STORE', container: 'mp4', gap: 5000 });
  const bga = bg && analyzeCell({ cell: { variant: 'ASIS' }, client: bg, requests: [] });
  check('fault gap scheduling wrong: caught (actual gap far from 5000 ms)', bga && Math.abs(bga.timing.actualGapMs - 5000) > 30, JSON.stringify(bga && bga.timing));
}

// ---------- 4. server ----------
function req(port, p, headers = {}, { abortAfterMs = null } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', () => {});
      if (abortAfterMs != null) setTimeout(() => { r.destroy(); resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), aborted: true }); }, abortAfterMs);
    });
    r.on('error', (e) => { if (abortAfterMs == null) reject(e); });
    r.end();
  });
}
async function serverChecks(srv, port, label = '') {
  const s = srv.createServer({ mediaDir: MEDIA_DIR, port, log: () => {} });
  await s.listen();
  const out = {};
  try {
    const cells = s.cells;
    out.plan = cells.length === 16 && new Set(cells.map((c) => c.token)).size === 16
      && ['ASIS', 'RELEASE'].every((v) => cells.filter((c) => c.variant === v).length === 8) && ['NO_STORE', 'CACHEABLE'].every((v) => cells.filter((c) => c.cache === v).length === 8)
      && ['mp4', 'webm'].every((v) => cells.filter((c) => c.container === v).length === 8) && [500, 5000].every((v) => cells.filter((c) => c.gap === v).length === 8)
      && cells.every((c, i) => i % 2 === 0 ? c.variant === 'ASIS' && cells[i + 1].variant === 'RELEASE' && cells[i + 1].cache === c.cache && cells[i + 1].container === c.container && cells[i + 1].gap === c.gap : true);
    const NS = cells.find((c) => c.cache === 'NO_STORE' && c.container === 'mp4');
    const CA = cells.find((c) => c.cache === 'CACHEABLE' && c.container === 'webm');
    const mp4 = fs.readFileSync(path.join(MEDIA_DIR, 'ib10_v3c_fixture.mp4'));
    const webm = fs.readFileSync(path.join(MEDIA_DIR, 'ib10_v3c_fixture.webm'));
    const etag = s.etagFor(CA, 'A', s.media.webm.sha256);
    const pg = await req(port, `/posts?run=${NS.token}`);
    out.page = pg.status === 200 && pg.headers['cache-control'] === 'no-store' && pg.body.toString().includes('"variant":"ASIS"') && pg.body.toString().includes(`/v3r/media/${NS.token}/A.mp4`);
    const r1 = await req(port, `/v3r/media/${NS.token}/A.mp4`, { Range: 'bytes=1000-1999' });
    out.noStoreHeaders = r1.headers['cache-control'] === 'no-store' && !r1.headers.etag && !r1.headers['last-modified'] && r1.headers['accept-ranges'] === 'bytes';
    out.exactRange = r1.status === 206 && r1.headers['content-range'] === `bytes 1000-1999/${mp4.length}` && r1.body.equals(mp4.subarray(1000, 2000));
    const r2 = await req(port, `/v3r/media/${CA.token}/A.webm`, { Range: 'bytes=0-99' });
    out.cacheableHeaders = r2.headers['cache-control'] === 'public, max-age=3600' && r2.headers.etag === etag && r2.headers['last-modified'] === 'Thu, 01 Jan 2026 00:00:00 GMT' && r2.status === 206 && r2.body.equals(webm.subarray(0, 100));
    const r3 = await req(port, `/v3r/media/${CA.token}/A.webm`, { 'If-None-Match': etag });
    out.conditional304 = r3.status === 304 && r3.body.length === 0;
    const r4 = await req(port, `/v3r/media/${NS.token}/B.mp4`, { 'If-None-Match': etag, Range: 'bytes=0-99' });
    out.noStoreIgnoresValidators = r4.status === 206 && r4.body.length === 100;
    const r5 = await req(port, `/v3r/media/${CA.token}/B.webm`, { Range: 'bytes=10-19', 'If-Range': s.etagFor(CA, 'B', s.media.webm.sha256) });
    const r6 = await req(port, `/v3r/media/${CA.token}/C.webm`, { Range: 'bytes=10-19', 'If-Range': '"stale"' }, { abortAfterMs: 300 });
    out.ifRange = r5.status === 206 && r5.body.equals(webm.subarray(10, 20)) && r6.status === 200;
    const t0 = Date.now();
    await req(port, `/v3r/media/${NS.token}/C.mp4`, { Range: 'bytes=0-' }, { abortAfterMs: 500 });
    await sleep(300);
    const rec = s.requests.find((x) => x.token === NS.token && x.card === 'C');
    const before = rec && rec.bytesSent; await sleep(300);
    out.accounting = !!rec && rec.end === 'client-abort' && rec.bytesSent >= 64 * 1024 && rec.bytesSent <= 256 * 1024 && rec.bytesSent === before && rec.tEnd - t0 < 900 && rec.writes[rec.writes.length - 1][1] === rec.bytesSent;
    const full = await req(port, `/v3r/media/${CA.token}/A.webm`, { Range: 'bytes=3000000-' });
    const recF = s.requests.filter((x) => x.token === CA.token && x.card === 'A').pop();
    out.accountingComplete = full.status === 206 && full.body.length === webm.length - 3000000 && recF.end === 'complete' && recF.bytesSent === full.body.length && recF.rangeStart === 3000000;
    out.reqHeadersLogged = s.requests.some((x) => x.req.ifNoneMatch === etag) && s.requests.some((x) => x.req.ifRange === '"stale"');
  } finally { await new Promise((r) => s.server.close(r)); }
  return out;
}

// ---------- 5. analyzer ----------
function analyzerChecks() {
  const O = 1_000_000;
  const client = (extra = {}) => ({ identity: 'MATCH_ASIS', timeOrigin: O, trustedPointerEvents: 0,
    marks: [{ t: 100, what: 'enter', card: 'A', phase: 'first' }, { t: 700, what: 'ready', card: 'A', phase: 'first' }, { t: 1700, what: 'leave', card: 'A', phase: 'first' }, { t: 1720, what: 'enter', card: 'B', phase: 'pass' }, { t: 1780, what: 'leave', card: 'B', phase: 'pass' }, { t: 2200, what: 'enter', card: 'A', phase: 'revisit' }],
    videos: [{ owner: 'hover', label: 'A', created: 101, ev: [[700, 'loadeddata']], calls: [[101, 'src', 'A'], [1700, 'pause']], firstFrame: 690, states: [[101, 0, 0, 1, 2, 0, 0, 1], [1700, 0, 0, 1, 2, 2, 4.5, 1]] },
      { owner: 'hover', label: 'A', created: 2201, ev: [[2231, 'loadeddata']], calls: [[2201, 'src', 'A']], firstFrame: 2235, states: [] }], ...extra });
  const rq = (id, t0, start, sent, end, tEnd, status = 206) => ({ id, card: 'A', t0: O + t0, req: { range: `bytes=${start}-` }, status, rangeStart: start, bytesSent: sent, writes: [[O + t0 + 50, sent]], tEnd: tEnd == null ? null : O + tEnd, end });
  const none = analyzeCell({ cell: { variant: 'ASIS' }, client: client(), requests: [rq(1, 110, 0, 900000, 'open-at-run-end', null)] });
  check('analyzer: AS-IS-like revisit with no new request -> NO_NEW_REQUEST; first transfer still open at revisit', none.revisitTransport.classification === 'NO_NEW_REQUEST' && none.firstLeave.stillOpenAtRevisit === 1 && none.revisit.loadeddataMs === 30, JSON.stringify(none.revisitTransport));
  const restart = analyzeCell({ cell: { variant: 'RELEASE' }, client: client(), requests: [rq(1, 110, 0, 600000, 'client-abort', 1701), rq(2, 2210, 0, 300000, 'open-at-run-end', null)] });
  check('analyzer: released then new request from byte 0 re-sending fetched bytes -> RESTART_FROM_ZERO with refetched bytes > 0; first transfer ended at leave', restart.revisitTransport.classification === 'RESTART_FROM_ZERO' && restart.revisitTransport.refetchedBytes === 300000 && restart.firstLeave.stillOpenAtRevisit === 0 && restart.firstLeave.endAfterLeaveMs.join() === 'client-abort@1', JSON.stringify(restart.revisitTransport));
  const resume = analyzeCell({ cell: { variant: 'RELEASE' }, client: client(), requests: [rq(1, 110, 0, 600000, 'client-abort', 1701), rq(2, 2210, 600000, 100000, 'open-at-run-end', null)] });
  check('analyzer: new request starting after the fetched range -> RESUME (no refetch)', resume.revisitTransport.classification === 'RESUME' && resume.revisitTransport.refetchedBytes === 0);
  const partial = analyzeCell({ cell: { variant: 'RELEASE' }, client: client(), requests: [rq(1, 110, 0, 600000, 'client-abort', 1701), rq(2, 2210, 500000, 200000, 'open-at-run-end', null)] });
  check('analyzer: new request overlapping the fetched range from a later offset -> PARTIAL_REFETCH', partial.revisitTransport.classification === 'PARTIAL_REFETCH' && partial.revisitTransport.refetchedBytes === 100000);
  const v304 = analyzeCell({ cell: { variant: 'RELEASE' }, client: client(), requests: [rq(1, 110, 0, 600000, 'client-abort', 1701), { ...rq(2, 2210, 0, 0, 'complete', 2215, 304), rangeStart: undefined }] });
  check('analyzer: a 304 answer on revisit -> VALIDATED_304', v304.revisitTransport.classification === 'VALIDATED_304');
  const stale = analyzeCell({ cell: { variant: 'RELEASE' }, client: client(), requests: [{ ...rq(9, -30000, 0, 50000, 'client-abort', -29000) }, rq(1, 110, 0, 600000, 'client-abort', 1701)] });
  check('analyzer: requests from an earlier attempt of the same cell (before this page) are excluded', stale.firstLeave.requests === 1);
  const pair = analyze({ runs: [{ cell: { variant: 'ASIS', cache: 'NO_STORE', container: 'mp4', gap: 500 }, client: client(), requests: [rq(1, 110, 0, 900000, 'open-at-run-end', null)] },
    { cell: { variant: 'RELEASE', cache: 'NO_STORE', container: 'mp4', gap: 500 }, client: client({ videos: client().videos.map((v, i) => (i === 1 ? { ...v, ev: [[2700, 'loadeddata']], firstFrame: 2710 } : v)) }), requests: [rq(1, 110, 0, 600000, 'client-abort', 1701), rq(2, 2210, 0, 300000, 'open-at-run-end', null)] }] });
  const cmp = pair.comparison['NO_STORE|mp4|500'];
  check('analyzer: paired comparison reports readiness and first-frame deltas and "new request where AS-IS had none"', cmp.readinessDeltaMs === 469 && cmp.firstFrameDeltaMs === 475 && cmp.releaseNewRequestWhereAsisHadNone === true, JSON.stringify(cmp));
  // fault: classifier ignores refetch overlap
  const mut = loadMutated(path.join(__dirname, 'analyze_ib10_v3r.cjs'), '    else if (refetched > 0) cls =', '    else if (false) cls =');
  const m1 = mut.analyzeCell({ cell: { variant: 'RELEASE' }, client: client(), requests: [rq(1, 110, 0, 600000, 'client-abort', 1701), rq(2, 2210, 0, 300000, 'open-at-run-end', null)] });
  check('fault revisit classifier ignores re-fetched bytes: caught (RESTART reported as RESUME)', m1.revisitTransport.classification !== 'RESTART_FROM_ZERO');
}

async function main() {
  if (!MEDIA_DIR) { console.error('usage: node verify_ib10_v3r.cjs --media <dir>'); process.exitCode = 2; return; }
  const srv = require('./v3r_server.cjs');
  let gate = false; try { srv.createServer({ mediaDir: MEDIA_DIR, port: 8799, log: () => {} }); gate = true; } catch { gate = false; }
  check('fixtures present and SHA-256 verified (mp4 9ba765f0..., webm 46764906...)', gate);
  { const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'ib10v3r-')); for (const f of ['ib10_v3c_fixture.mp4', 'ib10_v3c_fixture.webm']) fs.copyFileSync(path.join(MEDIA_DIR, f), path.join(bad, f)); fs.appendFileSync(path.join(bad, 'ib10_v3c_fixture.mp4'), Buffer.from([1]));
    let refused = false; try { srv.createServer({ mediaDir: bad, port: 8799, log: () => {} }); } catch (e) { refused = /SHA-256 mismatch/.test(e.message); } fs.rmSync(bad, { recursive: true, force: true });
    check('fault altered fixture: the server refuses to start', refused); }
  await scopeChecks();
  await smokeChecks();
  const S = await serverChecks(srv, 8793);
  check('server plan: 16 unique cells = 2 variants x 2 cache x 2 containers x 2 gaps; AS-IS/RELEASE of each condition run back to back', S.plan);
  check('server page: no-store; cell configuration embedded; per-cell media URLs', S.page);
  check('server NO_STORE arm: Cache-Control no-store, no ETag/Last-Modified, Accept-Ranges bytes', S.noStoreHeaders);
  check('server CACHEABLE arm: Cache-Control public, max-age=3600; strong per-URL ETag; fixed Last-Modified', S.cacheableHeaders);
  check('server Range: exact 206 Content-Range and identical bytes', S.exactRange);
  check('server conditional: CACHEABLE If-None-Match -> 304 with no body; NO_STORE ignores validators', S.conditional304 && S.noStoreIgnoresValidators);
  check('server If-Range: matching ETag -> 206; stale validator -> 200 full', S.ifRange);
  check('server accounting: throttled client abort logged as client-abort, bytes stop at the abort; complete transfer bytesSent = bytes received, rangeStart recorded', S.accounting && S.accountingComplete);
  check('server logs the conditional/Range request headers', S.reqHeadersLogged);
  // server faults (mutated module copies)
  const file = path.join(__dirname, 'v3r_server.cjs');
  const F1 = await serverChecks(loadMutated(file, "headers['Cache-Control'] = 'public, max-age=3600';", "headers['Cache-Control'] = 'no-store';"), 8794);
  check('fault cacheable arm emits no-store: caught by the cache-header assertion', !F1.cacheableHeaders);
  const F2 = await serverChecks(loadMutated(file, '      rec.bytesSent += n; rec.writes.push([Date.now(), rec.bytesSent]);', '      rec.bytesSent += 2 * n; rec.writes.push([Date.now(), rec.bytesSent]);'), 8795);
  check('fault byte accounting wrong: caught by the accounting assertion', !(F2.accounting && F2.accountingComplete));
  const F3 = await serverChecks(loadMutated(file, '    let honorRange = !!rec.req.range;', '    let honorRange = false;'), 8796);
  check('fault Range ignored: caught by the exact-range assertion', !F3.exactRange);
  analyzerChecks();

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB10', stage: 'E-stage V3-R revisit/cache experiment, local qualification (no real browser)', production_commit: b.COMMIT, production_blob: b.EXPECTED_PRODUCTION_BLOB,
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB10_V3R_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
