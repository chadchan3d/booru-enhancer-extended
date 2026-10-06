'use strict';
// Local qualification of the IB11 G-PLAY E package and evaluator (no real
// browser; the browser run belongs to the operator):
//   1. static: package current; executed body = committed production 4d793a2
//      body byte for byte; @match scope; server plan and media verification;
//   2. smoke (jsdom, fake clock, a media SIMULATOR modelling an autoplay policy:
//      muted autoplay allowed, unmuted only after user activation; loop/ended;
//      404; a pending load): all 4 pages run end to end and the evaluator
//      passes. The simulator is not browser evidence; it only proves the
//      runner/recorder/evaluator chain works and is fault-sensitive;
//   3. fault controls: production-mutant packages (identity forced to MATCH so
//      a behavioral criterion, not identity, must catch them) and evidence /
//      evaluator faults on the smoke results.
// Usage: node verify_ib11_gplay.cjs
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_gplay.cjs');
const srv = require('./gplay_server.cjs');
const { evaluate, REVISION } = require('./gplay_evaluate.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 700) });
const REPO = path.resolve(__dirname, '../../..');
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---- 1. static ----
const PKG = fs.readFileSync(b.OUT, 'utf8');
const fresh = b.build();
check('package matches a fresh build', PKG === fresh.text);
check('production at the pinned commit is blob 002bdfd and equals the working tree', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB && h.gitBlobId(h.productionSource()) === b.EXPECTED_PRODUCTION_BLOB);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('the package executes the committed production body byte for byte (no hooks)', body(PKG) === split(PROD).body);
check('scope: matches only the local G-PLAY server', split(PKG).meta.split('\n').filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === `http://127.0.0.1:${srv.PORT}/*`);
const pl = srv.plan();
check('plan: 4 pages (N/U x MP4/WebM); arm N 13 cells ending with RETRY; arm U 3 cells incl. DELIB', pl.length === 4 && pl.filter((p) => p.arm === 'N').every((p) => p.cells.length === 13 && p.cells[12].name === 'RETRY') && pl.filter((p) => p.arm === 'U').every((p) => p.cells.length === 3 && p.cells[2].name === 'DELIB'));
let refused = false; try { srv.createServer({ mediaDir: path.join(__dirname, 'no-such-dir') }); } catch { refused = true; }
check('server refuses to start without the pinned media fixtures', refused);

// ---- 2. smoke ----
const DURATION = 12;
function mediaSim(w, clock, env) {
  const MP = w.HTMLMediaElement.prototype;
  const st = (el) => (el.__sim = el.__sim || { playing: false, ct: 0, timer: null, gen: 0 });
  const fire = (el, n) => el.dispatchEvent(new w.Event(n));
  const stop = (el) => { const s = st(el); s.playing = false; if (s.timer) { w.clearInterval(s.timer); s.timer = null; } };
  const allowed = (el) => el.muted || env.activation;
  const start = (el) => { const s = st(el); if (s.playing) return; s.playing = true; fire(el, 'play'); fire(el, 'playing');
    s.timer = w.setInterval(() => { if (!s.playing) return; s.ct += 0.25; if (s.ct >= DURATION) { if (el.loop) { s.ct = 0; fire(el, 'timeupdate'); } else { s.ct = DURATION; stop(el); fire(el, 'timeupdate'); fire(el, 'pause'); fire(el, 'ended'); return; } } fire(el, 'timeupdate'); }, 250); };
  Object.defineProperty(MP, 'paused', { configurable: true, get() { return !st(this).playing; } });
  Object.defineProperty(MP, 'duration', { configurable: true, get() { return this.hasAttribute('src') ? DURATION : NaN; } });
  Object.defineProperty(MP, 'currentTime', { configurable: true, get() { return st(this).ct; }, set(v) { st(this).ct = Number(v); fire(this, 'timeupdate'); } });
  const sd = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, get() { return sd.get.call(this); }, set(v) {
    sd.set.call(this, v); const el = this; const s = st(el); stop(el); s.ct = 0; const g = ++s.gen; const u = String(v);
    const delay = /-PEND\./.test(u) ? 3000 : 60;
    w.setTimeout(() => { if (s.gen !== g || !el.hasAttribute('src')) return; if (/-FAIL\./.test(u)) { fire(el, 'error'); return; } fire(el, 'loadedmetadata'); fire(el, 'loadeddata'); fire(el, 'canplay'); if (el.autoplay && allowed(el)) start(el); }, delay);
  } });
  const md = Object.getOwnPropertyDescriptor(MP, 'muted');
  Object.defineProperty(MP, 'muted', { configurable: true, get() { return md.get.call(this); }, set(v) { md.set.call(this, v); if (!v && st(this).playing && !env.activation) { stop(this); fire(this, 'pause'); } } });
  const ra = w.Element.prototype.removeAttribute;
  w.Element.prototype.removeAttribute = function (n) { if (this instanceof w.HTMLMediaElement && n === 'src') { const s = st(this); s.gen++; stop(this); } return ra.call(this, n); };
  MP.play = function () { const el = this; if (!el.hasAttribute('src')) return Promise.reject(new w.DOMException('no src', 'NotSupportedError'));
    if (!allowed(el)) return Promise.reject(new w.DOMException('blocked', 'NotAllowedError'));
    const g = st(el).gen; return new Promise((res, rej) => w.setTimeout(() => { if (st(el).gen !== g || !el.hasAttribute('src')) { rej(new w.DOMException('aborted', 'AbortError')); return; } start(el); res(); }, 60)); };
  MP.pause = function () { if (st(this).playing) { stop(this); fire(this, 'pause'); } };
  MP.load = function () { if (!this.hasAttribute('src')) { stop(this); fire(this, 'emptied'); } };
  Object.defineProperty(w.navigator, 'userActivation', { configurable: true, value: { get hasBeenActive() { return env.activation; }, get isActive() { return env.activation; } } });
}
async function runPage(pg, source) {
  let clock = null; let posted = null; const env = { activation: false };
  const c = h.load({ url: `http://127.0.0.1:${srv.PORT}/posts?page=${pg.token}`, html: srv.page(pg, srv.PORT, { mp4: 3623853, webm: 3091428 }), source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.GM_info = { scriptHandler: 'jsdom-sim', version: '0' };
    mediaSim(w, clock, env);
    w.fetch = async (u, o) => { if (String(u) === '/gplay/result') { posted = JSON.parse(o.body); return { json: async () => ({ next: null }) }; } return new Promise(() => {}); };
  } });
  const w = c.window;
  for (let i = 0; i < 3000 && !posted; i++) {
    await h.sleep(0); await clock.advance(100);
    const btn = w.document.querySelector('#ib11g-panel button'); const msg = w.document.querySelector('#ib11g-panel div')?.textContent || '';
    if (btn && btn.style.display !== 'none') { env.activation = true; btn.click(); }
    else if (/SPACE/.test(msg) && !w.__spaced) { w.__spaced = true; env.activation = true; w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })); }
  }
  w.close();
  return posted;
}
// jsdom events are untrusted; the operator's prompt inputs are real. Mark the
// prompt inputs trusted (never the cells' synthetic clicks/keys).
const trustPrompts = (cl) => { if (!cl) return cl; if (cl.start) cl.start.trusted = true; for (const c of cl.cells) for (const m of c.marks) if (m.what === 'retry-key' || m.what === 'unmute') m.trusted = true; return cl; };
async function smoke(source, { forceIdentity = false } = {}) {
  const pages = [];
  for (const pg of srv.plan()) {
    const cl = trustPrompts(await runPage(pg, source));
    if (cl && forceIdentity) cl.identity = 'MATCH_EXPECTED_ARTIFACT';
    pages.push({ page: pg.id, client: cl, requests: [] });
  }
  return { probe: 'ib11-gplay-controlled', pages };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const cellOf = (doc, id) => doc.pages.flatMap((p) => p.client.cells).find((c) => c.id === id);

async function main() {
  const doc = await smoke(PKG);
  const r = evaluate(doc);
  check(`smoke: all 4 pages ran end to end; identity MATCH; evaluator revision ${REVISION} PASS on simulated media`, r.pass && r.complete, JSON.stringify({ missing: r.missingPages, pageFailures: r.pageFailures, failures: r.failures.slice(0, 4), counts: r.counts }));
  const cap = r.capabilityTable;
  check('smoke capability table follows the simulated policy (not the assigned attributes): N muted autoplay PLAYED, N unmuted autoplay BLOCKED, N autoplay=false IDLE (no play attempted), U unmuted PLAYED',
    cap['N-mp4'] && cap['N-mp4'].PREF === 'PLAYED' && cap['N-mp4'].UNMUTED === 'BLOCKED' && cap['N-webm'].UNMUTED === 'BLOCKED' && cap['N-mp4'].NOAUTO === 'IDLE' && cap['N-mp4'].CLOSEPEND === 'CLOSED_BEFORE_READY' && cap['U-mp4'].UNMUTED === 'PLAYED' && cap['N-mp4'].FAIL === 'ERROR', JSON.stringify(cap));
  const rej = r.pages.find((p) => p.page === 'N-mp4').cells.find((c) => c.id.endsWith('PLAYREJ'));
  check('smoke: the metadata-update play() without activation is recorded as rejected (NotAllowedError) and the cell is not counted as played', rej && rej.detail.api && rej.detail.api[0] === 'NotAllowedError' && rej.capability === 'BLOCKED', JSON.stringify(rej));
  const retry = r.pages.find((p) => p.page === 'N-webm').cells.find((c) => c.id.endsWith('RETRY'));
  check('smoke: explicit Play retry (trusted Space -> production togglePlayPause) resolved and played after the blocked autoplay', retry && retry.detail.retry === 'resolved' && retry.status === 'PASS', JSON.stringify(retry));

  // ---- 3a. production-mutant packages ----
  const mut = (from, to) => b.build({ bodyTransform: (x) => mustReplace(x, from, to) }).text;
  const pf = async (name, src, code) => { const rr = evaluate(await smoke(src, { forceIdentity: true }));
    check(`fault production: ${name}: caught (${code})`, !rr.pass && rr.failures.some((c) => c.fails.some((f) => f.startsWith(code))), JSON.stringify(rr.failures.slice(0, 3))); };
  await pf('explicit mute=false forcibly remuted', mut("\t\t\t\tel.muted = !!BE.settings.get('viewer.muteVideo');", '\t\t\t\tel.muted = true;'), 'PREF');
  await pf('autoplay=false still plays automatically', mut("\t\t\t\tel.autoplay = !!BE.settings.get('viewer.autoplayVideo');", '\t\t\t\tel.autoplay = true;'), 'NOAUTO');
  await pf('loop=false ignored', mut("\t\t\t\tel.loop = !!BE.settings.get('viewer.loopVideo');", '\t\t\t\tel.loop = true;'), 'LOOP');
  await pf('remembered volume lost', mut('\t\t\t\t\tel.volume = vol;\n', ''), 'VOL');
  await pf('older generation keeps playing after replacement (previous media not stopped)', mut('\t\t\tstopMedia(old);\n', ''), 'STALE');
  await pf('close leaves the old video active', mut('\t\t\tstopMedia(mediaEl);\n\t\t\tmediaEl = null;', '\t\t\tmediaEl = null;'), 'CLOSE');
  await pf('native recovery link removed after failure', mut('\t\t\t\t\tif (nativeUrl) {', '\t\t\t\t\tif (false) {'), 'FAILN');
  await pf('Space no longer retries play (togglePlayPause pauses only)', mut('\t\t\t\tmediaEl.paused ? mediaEl.play().catch(() => {}) : mediaEl.pause();', '\t\t\t\tmediaEl.pause();'), 'RETRY');
  await pf('production re-mutes after a deliberate unmute', mut("\t\t\t\tel.addEventListener('loadeddata', () => onMediaReady(el, generation));", "\t\t\t\tel.addEventListener('loadeddata', () => onMediaReady(el, generation)); el.addEventListener('volumechange', () => { if (!el.muted && BE.settings.get('viewer.muteVideo')) el.muted = true; });"), 'MUTE');

  // ---- 3b. evidence / evaluator faults on the smoke result ----
  const ef = (name, f, code) => { const d = clone(doc); f(d); const rr = evaluate(d); check(`fault evidence: ${name}: caught${code ? ` (${code})` : ''}`, !rr.pass && (!code || rr.failures.some((c) => c.fails.some((x) => x.startsWith(code))) || rr.pageFailures.length || !rr.complete), JSON.stringify({ pf: rr.pageFailures, f: rr.failures.slice(0, 2), complete: rr.complete })); };
  ef('rejected play reported as success (outcome "resolved" without playback)', (d) => { const v = cellOf(d, 'N-mp4-PLAYREJ').videos[0]; v.calls.filter((q) => q[1] === 'play').forEach((q) => { q[4] = 'resolved'; }); }, 'PLAY');
  ef("unmuted autoplay assigned but never played is still reported 'playing'", (d) => { const v = cellOf(d, 'N-webm-UNMUTED').videos[0]; v.assigned.autoplay = false; v.ev.push([v.created + 500, 'playing', 0, 1]); v.maxTime = 3; }, 'PLAY');
  ef('a newer target shows the old generation failure', (d) => { const c = cellOf(d, 'N-mp4-STALE'); c.stage.push([c.videos[1].created + 10, { state: 'Video failed to load', link: 'card-post', open: true }]); }, 'STALE');
  ef('old video still holds its source at the cell end', (d) => { cellOf(d, 'N-webm-CLOSEPLAY').videos[0].now.holdsSrc = 1; }, 'REL');
  ef('page identity mismatch', (d) => { d.pages[1].client.identity = 'MISMATCH'; });
  ef('trusted input outside a prompt contaminates the cell', (d) => { cellOf(d, 'N-mp4-NOAUTO').trustedOutsidePrompt = 1; });
  ef('a page is missing', (d) => { d.pages.pop(); });
  ef('retry press not trusted', (d) => { cellOf(d, 'N-mp4-RETRY').marks.forEach((m) => { if (m.what === 'retry-key') m.trusted = false; }); }, 'RETRY');
  ef('arm U Start click not trusted', (d) => { d.pages[2].client.start.trusted = false; });

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_GPLAY_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-gplay-verification', commit: b.COMMIT, blob: b.EXPECTED_PRODUCTION_BLOB, evaluatorRevision: REVISION, passed, total: results.length,
    smokeCapabilityTable: cap, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
