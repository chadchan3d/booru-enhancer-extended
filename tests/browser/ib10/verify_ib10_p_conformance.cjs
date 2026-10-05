'use strict';
// Local qualification of the IB10 P-stage conformance packages and evaluator
// (no real browser; the browser runs belong to the operator):
//   1. static: packages current; executed body = committed IB10 production body
//      (8324552 / 4258ad7) byte for byte; @match scope; host substitution maps MP4
//      runs to e926.net and WebM runs to e621.net;
//   2. smoke (jsdom, fake clock, simulated readiness): the controlled package on
//      both containers and the live observer on both hosts run the new production
//      path (dwell, release at leave) and record it;
//   3. the evaluator on synthetic results, with fault controls.
// Usage: node verify_ib10_p_conformance.cjs
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib10_p_conformance.cjs');
const { evaluateControlled, evaluateLive } = require('./p_conformance_ib10.cjs');
const { analyzeRun } = require('./analyze_ib10_v3c.cjs');
const srv = require('./v3c_server.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 600) });
const REPO = path.resolve(__dirname, '../../..');
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---- 1. static ----
const C = fs.readFileSync(b.OUT_CONTROLLED, 'utf8'); const L = fs.readFileSync(b.OUT_LIVE, 'utf8');
const fresh = b.build();
check('packages match a fresh build', C === fresh.controlled && L === fresh.live);
check('production at the pinned commit is blob 4258ad7 and equals the working tree', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB && h.gitBlobId(h.productionSource()) === b.EXPECTED_PRODUCTION_BLOB);
const body = (t, o, c) => t.slice(t.indexOf(o) + o.length, t.indexOf(c));
check('both packages execute the committed IB10 production body byte for byte (no hooks)', body(C, b.C_WRAP_OPEN, b.C_WRAP_CLOSE) === split(PROD).body && body(L, b.L_WRAP_OPEN, b.L_WRAP_CLOSE) === split(PROD).body);
const metaOf = (t) => split(t).meta.split('\n').filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join();
check('scope: controlled matches only the local server (8794); live matches only e621.net and e926.net', metaOf(C) === 'http://127.0.0.1:8794/*' && metaOf(L) === '*://e621.net/*,*://e926.net/*');
check('controlled host substitution: MP4 runs report e926.net, WebM runs e621.net (test only)', C.includes("container === 'mp4' ? 'e926.net' : 'e621.net'") && C.includes('get hostname() { return IB10P_HOST; }'));

// ---- 2. smoke ----
function mediaSim(w, clock) {
  const MP = w.HTMLMediaElement.prototype; const d = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); const el = this; const g = (el.__g = (el.__g || 0) + 1); w.setTimeout(() => { if (el.__g === g && el.hasAttribute('src')) { el.__rs = 2; el.dispatchEvent(new w.Event('loadeddata')); } }, 120); } });
  const ra = w.Element.prototype.removeAttribute; w.Element.prototype.removeAttribute = function (n) { if (this instanceof w.HTMLMediaElement && n === 'src') this.__g = (this.__g || 0) + 1; return ra.call(this, n); };
  Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rs || 0; } });
  Object.defineProperty(MP, 'networkState', { configurable: true, get() { return this.hasAttribute('src') ? 2 : 0; } });
}
const baseSetup = (w, clock) => { w.performance.now = () => clock.now(); w.performance.getEntriesByName = () => []; /* jsdom lacks Resource Timing; Chrome provides it */ if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); if (!w.TextEncoder) w.TextEncoder = TextEncoder; if (!w.PointerEvent) w.PointerEvent = w.MouseEvent; };
async function controlledSmoke(container, scenario = 'LEAVE_LOADEDDATA') {
  const run = { token: 'feedfacefeedface', scenario, container, transport: 'RANGE', size: container === 'mp4' ? 3623853 : 3091428 };
  let clock = null; let posted = null;
  const c = h.load({ url: `http://127.0.0.1:${b.PORT}/posts?run=${run.token}`, html: srv.page(run, b.PORT), source: C, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); baseSetup(w, clock); mediaSim(w, clock);
    w.fetch = async (u, o) => { if (String(u) === '/v3c/result') { posted = JSON.parse(o.body); return { json: async () => ({ next: null }) }; } return new Promise(() => {}); };
  } });
  for (let i = 0; i < 400 && !posted; i++) { await h.sleep(0); await clock.advance(100); }
  c.window.close();
  return posted;
}
async function liveSmoke(host, ext) {
  let clock = null; const menu = {};
  const c = h.load({ url: `https://${host}/posts`, html: hh.listing(host, 3).html, source: L, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); baseSetup(w, clock); mediaSim(w, clock);
    w.GM_registerMenuCommand = (n, fn) => { menu[n] = fn; return 0; };
    for (const [i, a] of [...w.document.querySelectorAll('article')].entries()) if (i < 2) { a.setAttribute('data-file-ext', ext); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, `.${ext}`)); a.setAttribute('data-size', '5000000'); }
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const img = (i) => w.document.querySelectorAll('article')[i].querySelector('img');
  menu[Object.keys(menu).find((k) => k.startsWith('IB10L: Start'))](); await clock.advance(0);
  const hover = async (i, ms) => { img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(ms); img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(100); };
  await hover(0, 40); await hover(0, 600); await hover(1, 600); await hover(1, 60); await clock.advance(6000);
  const p = menu[Object.keys(menu).find((k) => k.startsWith('IB10L: Show results'))](); for (let i = 0; i < 20; i++) { await clock.advance(200); await h.sleep(0); } await p;
  const json = JSON.parse(w.document.querySelector('#ib10l-result textarea').value); w.close();
  return json;
}
const trusted = (doc) => JSON.parse(JSON.stringify(doc, (k, v) => (k === 'trigger' ? 'TRUSTED' : v)));

async function main() {
  for (const container of ['mp4', 'webm']) {
    const p = await controlledSmoke(container);
    const hv = p ? p.videos.filter((v) => v.owner === 'hover') : [];
    const enter = p && p.marks.find((m) => m.what === 'enter');
    const leave = p && p.marks.find((m) => m.what === 'leave');
    const src = hv[0] && hv[0].calls.find((c) => c[1] === 'src');
    check(`controlled smoke ${container}: identity MATCH; hover video source at the 200 ms dwell; released (removeSrc) at leave`, p && p.identity === 'MATCH_EXPECTED_ARTIFACT' && hv.length === 1 && src && src[0] - enter.t === 200 && hv[0].calls.some((c) => c[1] === 'removeSrc' && c[0] === leave.t), JSON.stringify(p && { id: p.identity, calls: hv[0] && hv[0].calls, marks: p.marks.slice(0, 5) }));
    const q = await controlledSmoke(container, 'LEAVE_PENDING');
    check(`controlled smoke ${container}: 40 ms pass creates no hover video`, q && q.videos.filter((v) => v.owner === 'hover').length === 0);
  }
  for (const [host, ext] of [['e621.net', 'webm'], ['e926.net', 'mp4']]) {
    const d = await liveSmoke(host, ext);
    const r = evaluateLive([trusted(d)]);
    const g = d.sessions[0].generations;
    check(`live smoke ${host} ${ext}: identity MATCH; quick pass made no hover video; rests released at leave (L1-L4 pass for all 4 generations)`, d.production_body_identity === 'MATCH_EXPECTED_ARTIFACT' && g.length === 4 && g[0].hoverElements === 0 && r.failures.length === 0 && r.counts.PASS === 4, JSON.stringify({ counts: r.counts, failures: r.failures, g0: g[0].hoverElements }));
  }

  // ---- 3. evaluator: synthetic controlled results ----
  const mk = (scenario, mode, container, mutate = (x) => x) => {
    const O = 1e6;
    const base = { run: { scenario, container, transport: mode }, client: { identity: 'MATCH_EXPECTED_ARTIFACT', timeOrigin: O, trustedPointerEvents: 0, error: null,
      marks: [{ t: 10, what: 'start' }, { t: 100, what: 'enter', card: 'A' }, { t: 700, what: 'leave', card: 'A' }, { t: 700, what: 'cleanup', kind: 'leave' }, { t: 5700, what: 'windowEnd' }],
      videos: [{ owner: 'hover', label: 'A', created: 300, ev: [[420, 'loadeddata']], calls: [[300, 'src', 'A'], [300, 'load', 'muted'], [420, 'play', 'muted'], [700, 'pause', 'muted'], [700, 'removeSrc'], [700, 'load', 'muted']], firstFrame: 430,
        states: [[300, 0, 0, 1, 2, 0, 0, 1], [420, 1, 1, 1, 2, 2, 1.2, 0], [700, 0, 0, 0, 0, 0, 0, 1]] }] },
      requests: [{ id: 1, card: 'A', t0: O + 305, range: 'bytes=0-', status: 206, length: 3000000, bytesSent: 400000, writes: [[O + 600, 300000], [O + 700, 400000]], tEnd: O + 702, end: 'client-abort' }] };
    return mutate(base);
  };
  const doc = (runs) => ({ media: {}, runs });
  const allCells = (mutate = null, which = null) => { const out = []; for (const t of srv.TRANSPORTS) for (const c of srv.CONTAINERS) for (const s of srv.SCENARIOS) {
    let r = s === 'LEAVE_PENDING' ? mk(s, t, c, (x) => { x.client.videos = []; x.requests = []; return x; }) : mk(s, t, c);
    if (s.startsWith('VIEWER_')) r.client.marks.splice(2, 0, { t: 690, what: 'click', card: 'A' });
    if (mutate && (!which || which(s, t, c))) r = mutate(r);
    out.push(r);
  } return doc(out); };
  const good = evaluateControlled(allCells());
  check('evaluator controlled: a conforming synthetic run passes all 54 cells', good.pass && good.cells.length === 54, JSON.stringify(good.cells.filter((x) => !x.pass).slice(0, 2)));
  const f1 = evaluateControlled(allCells((r) => { r.requests[0].end = 'open-at-run-end'; r.requests[0].tEnd = null; r.requests[0].writes.push([1e6 + 3000, 900000]); return r; }, (s) => s === 'LEAVE_LOADEDDATA'));
  check('fault abandoned transfer keeps streaming after leave: caught (C5)', !f1.pass && f1.cells.some((x) => x.fails.some((f) => f.startsWith('C5'))));
  const f2 = evaluateControlled(allCells((r) => { r.client.videos[0].calls[0][0] = 110; r.client.videos[0].created = 110; return r; }, (s) => s === 'A_TO_B'));
  check('fault dwell bypassed (source 10 ms after enter): caught (C2)', !f2.pass && f2.cells.some((x) => x.fails.some((f) => f.startsWith('C2'))));
  const f3 = evaluateControlled(allCells((r) => { r.client.videos[0].calls = r.client.videos[0].calls.filter((c) => c[1] !== 'removeSrc'); r.client.videos[0].states[2] = [700, 0, 0, 1, 2, 2, 1.2, 1]; return r; }, (s) => s === 'DISPOSE'));
  check('fault release omitted (source still held at the end): caught (C4)', !f3.pass && f3.cells.some((x) => x.fails.some((f) => f.startsWith('C4'))));
  const f4 = evaluateControlled(allCells((r) => { r.client.videos[0].calls = r.client.videos[0].calls.filter((c) => c[1] !== 'removeSrc'); return r; }, (s) => s === 'VIEWER_INSTALLED'));
  check('fault viewer takeover does not release the hover: caught (C5 viewer)', !f4.pass && f4.cells.some((x) => x.fails.some((f) => f.includes('viewer click'))));
  const f5 = evaluateControlled(allCells((r) => { r.client.identity = 'MISMATCH'; return r; }, (s, t, c) => s === 'CYCLES_5' && t === 'FAST' && c === 'mp4'));
  check('fault artifact mismatch: caught (C1)', !f5.pass);
  const f6 = evaluateControlled(allCells((r) => { r.client.videos[0].calls[2][2] = 'UNMUTED'; return r; }, (s) => s === 'LEAVE_FIRST_FRAME'));
  check('fault audible hover: caught (C3)', !f6.pass && f6.cells.some((x) => x.fails.some((f) => f.startsWith('C3'))));
  const f7 = evaluateControlled(allCells((r) => { r.client.videos = [{ ...mk('X', 'RANGE', 'mp4').client.videos[0] }]; r.requests = [mk('X', 'RANGE', 'mp4').requests[0]]; return r; }, (s) => s === 'LEAVE_PENDING'));
  check('fault 40 ms pass starts video work: caught (C2)', !f7.pass);
  const inc = evaluateControlled(doc(allCells().runs.slice(0, 50)));
  check('evaluator controlled: an incomplete run (50 of 54 cells) does not pass', !inc.pass && !inc.complete);

  // ---- evaluator: synthetic live results (revision 1.1 criteria) ----
  // A created hover video looks like the Chrome evidence: NETWORK_NO_SOURCE (3) right
  // after cleanup at the leave sample, NETWORK_EMPTY (0) at +1 s and +5 s.
  const elemAt = (k) => ({ attached: 0, inHover: 0, holdsSrc: 0, networkState: k === 'leave' ? 3 : 0, readyState: 0, bufferedEnd: 0, duration: null, paused: 1 });
  const gen = (host, container, stay, video = stay > 200) => ({ host, container, dataSize: 5000000, trigger: 'TRUSTED', leaveT: stay, viewerOpened: false, hoverElements: video ? 1 : 0, cardOrdinal: 1, hoverOnCard: 1,
    element: video ? { srcMatchesCardFile: true, srcSetT: 200, srcRemovedT: [stay], calls: [[200, 'load', 'muted'], [320, 'play', 'muted'], [stay, 'pause', 'muted'], [stay, 'load', 'muted']], readiness: { loadeddata: stay > 320 ? 320 : null }, firstFrame: stay > 330 ? 330 : null, events: [] } : null,
    samples: Object.fromEntries(['leave', 'p1', 'p5'].map((k) => [k, { t: 0, element: video ? elemAt(k) : null, holdingHoverVideos: 0, viewerOpen: false, hidden: false }])) });
  const liveDoc = (site, gens) => ({ site, production_body_identity: 'MATCH_EXPECTED_ARTIFACT', runtime: {}, sessions: [{ generations: gens }] });
  const STAYS = [40, 60, 200, 600, 900, 1200, 300, 2000, 700, 50, 1500];
  const set = (host, ext, mut = null) => STAYS.map((st) => (mut || ((x) => x))(gen(host, ext, st)));
  const both = (e621mut, e926mut) => evaluateLive([liveDoc('e621.net', set('e621.net', 'webm', e621mut)), liveDoc('e926.net', set('e926.net', 'mp4', e926mut))]);
  const okLive = both();
  check('evaluator live: conforming sessions pass, including NETWORK_NO_SOURCE (3) at the synchronous leave sample and a no-video leave at exactly 200 ms', okLive.pass && okLive.hosts['e621.net'].quickPasses === 4 && okLive.hosts['e621.net'].sustainedWithPreview === 7, JSON.stringify(okLive.hosts));
  const at = (stay, k, patch) => (g) => (g.leaveT === stay ? { ...g, samples: { ...g.samples, [k]: { ...g.samples[k], element: { ...g.samples[k].element, ...patch } } } } : g);
  const lf = (name, res, prefix) => check(`fault live: ${name}: caught (${prefix})`, !res.pass && res.failures.some((x) => x.fails.some((f) => f.startsWith(prefix))), JSON.stringify(res.failures.slice(0, 2)));
  lf('source still owned at the leave sample', both(at(900, 'leave', { holdsSrc: 1 })), 'L3');
  lf('element still attached at the leave sample', both(at(900, 'leave', { attached: 1 })), 'L3');
  lf('network still LOADING at the leave sample', both(at(900, 'leave', { networkState: 2 })), 'L3');
  lf('NETWORK_NO_SOURCE still present at +1 s (not EMPTY)', both(at(600, 'p1', { networkState: 3 })), 'L3');
  lf('network still LOADING at +5 s', both(null, at(1200, 'p5', { networkState: 2 })), 'L3');
  lf('source still held at +5 s', both(at(700, 'p5', { holdsSrc: 1 })), 'L3');
  lf('source assigned before the dwell (199 ms)', both((g) => (g.leaveT === 600 ? { ...g, element: { ...g.element, srcSetT: 199 } } : g)), 'L2');
  lf('sustained hover never produced a video (600 ms stay, none created)', both((g) => (g.leaveT === 600 ? { ...gen('e621.net', 'webm', 600, false) } : g)), 'L1');
  lf('a 201 ms stay without a video (beyond the exact dwell)', both((g) => (g.leaveT === 50 ? gen('e621.net', 'webm', 201, false) : g)), 'L1');
  lf('unmuted playback', both(null, (g) => (g.leaveT === 900 ? { ...g, element: { ...g.element, calls: [[200, 'load', 'muted'], [320, 'play', 'UNMUTED']] } } : g)), 'L4');
  lf('two hover videos hold a source at once', both((g) => (g.leaveT === 2000 ? { ...g, samples: { ...g.samples, p1: { ...g.samples.p1, holdingHoverVideos: 2 } } } : g)), 'L3');
  const never = both((g) => (g.hoverElements ? gen('e621.net', 'webm', 150, false) : g));
  check('fault live: an implementation that never creates hover videos cannot pass (no sustained preview evidence)', !never.pass && never.hosts['e621.net'].sustainedWithPreview === 0, JSON.stringify(never.hosts['e621.net']));
  lf('a quick pass created a video before the dwell', both(null, (g) => (g.leaveT === 40 ? { ...gen('e926.net', 'mp4', 40, true), element: { ...gen('e926.net', 'mp4', 600).element, srcSetT: 10 } } : g)), 'L2');
  const lf4 = evaluateLive([liveDoc('e621.net', set('e621.net', 'webm').map((g) => ({ ...g, container: 'mp4' }))), liveDoc('e926.net', set('e926.net', 'mp4'))]);
  check('evaluator live: out-of-scope cards (e621 MP4) are not counted as admitted evidence, so the host lacks usable evidence and the run does not pass', !lf4.pass && lf4.hosts['e621.net'].usable === 0);

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB10', stage: 'P-stage conformance packages + evaluator, local qualification (no real browser)', production_commit: b.COMMIT, production_blob: b.EXPECTED_PRODUCTION_BLOB,
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB10_P_CONFORMANCE_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2; // stays non-zero if main never completes (an unsettled promise would otherwise exit 0 silently)
main().catch((e) => { console.error(e); process.exitCode = 1; });
