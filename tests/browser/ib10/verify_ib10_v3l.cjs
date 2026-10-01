'use strict';
// Local qualification of the IB10 V3-L live observer (no live site, no real
// browser). Static pinning, then the REAL package in jsdom on an e621-shaped
// listing (2 video cards, 1 still card) with a fake clock and a simulated media
// model: after a src assignment readiness (loadeddata) follows at 120 ms unless
// the src is removed; buffered grows at 2 s of media per second while the
// element holds its src; networkState is LOADING while it holds a src and EMPTY
// after removal. Simulation qualifies the recorder only; it is not live evidence.
// Scripted pointer events are untrusted, so recorded generations classify as
// CONTAMINATED (that is itself checked); the classifier is then checked on a copy
// with the trigger set to TRUSTED. Fault controls must each be caught.
// Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib10_v3l.cjs');
const { classify } = require('./v3l_classify.js');
const { analyze } = require('./analyze_ib10_v3l.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 600) });
const REPO = path.resolve(__dirname, '../../..');
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---------- static ----------
const derived = fs.readFileSync(b.OUT, 'utf8');
check('derived package matches a fresh build', derived === b.build().text);
check('production blob at the pinned commit is 22e843c', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB);
const bodyIn = derived.slice(derived.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, derived.indexOf(b.WRAP_CLOSE));
check('executed body equals the committed production body byte for byte (no hooks)', bodyIn === split(PROD).body);
const meta = split(derived).meta.split('\n');
check('host restriction: @match only e621.net and e926.net; no update target', meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === '*://e621.net/*,*://e926.net/*' && !meta.some((l) => /@(downloadURL|updateURL)/.test(l)));
const own = derived.slice(derived.indexOf('/* IB10 V3-L PREAMBLE'), derived.indexOf(b.WRAP_OPEN)) + derived.slice(derived.indexOf(b.WRAP_CLOSE));
check('observe-only (static): package code never calls pause/play/load/removeAttribute or assigns src/preload/muted/autoplay itself; no settings, storage, cookie or network use',
  !/\.(pause|play|load)\(\s*\)|\.removeAttribute\(\s*['"]src|\.src\s*=[^=]|\.(preload|muted|autoplay|loop|currentTime)\s*=[^=]|settings\.set\(|GM_setValue|GM_deleteValue|localStorage|sessionStorage|document\.cookie|fetch\(|XMLHttpRequest|GM_xmlhttpRequest|sendBeacon/.test(own), (own.match(/\.(pause|play|load)\(\s*\)|\.removeAttribute\(\s*['"]src|\.src\s*=[^=]|\.(preload|muted|autoplay|loop|currentTime)\s*=[^=]|settings\.set\(|fetch\(/g) || []).join(' | '));

// ---------- runtime model ----------
function fixture(w, { loggedIn = false } = {}) {
  const arts = [...w.document.querySelectorAll('article')];
  arts.forEach((a, i) => {
    if (i < 2) { const ext = i === 0 ? 'webm' : 'mp4'; a.setAttribute('data-file-ext', ext); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, `.${ext}`)); a.setAttribute('data-size', String(1000000 + i)); a.setAttribute('data-width', '1280'); a.setAttribute('data-height', '720'); }
  });
  if (loggedIn) w.document.body.setAttribute('data-user-is-anonymous', 'false');
}
// The verifier's own media model and action log sit UNDER the package (installed first).
function mediaModel(w, clock, log, rtEntries) {
  const MP = w.HTMLMediaElement.prototype;
  const d = Object.getOwnPropertyDescriptor(MP, 'src');
  let seq = 0; const ids = new WeakMap(); const id = (el) => { if (!ids.has(el)) ids.set(el, ++seq); return ids.get(el); };
  Object.defineProperty(MP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) {
    d.set.call(this, v); const el = this; el.__srcT = clock.now(); el.__rs = 0; const g = (el.__g = (el.__g || 0) + 1);
    log.push([clock.now(), id(el), 'src']);
    w.setTimeout(() => { if (el.__g === g && el.hasAttribute('src')) { el.__rs = 2; el.dispatchEvent(new w.Event('loadeddata')); } }, 120);
  } });
  const ra = w.Element.prototype.removeAttribute;
  w.Element.prototype.removeAttribute = function (n) { if (this instanceof w.HTMLMediaElement && n === 'src') { log.push([clock.now(), id(this), 'removeSrc']); this.__srcT = null; this.__g = (this.__g || 0) + 1; } return ra.call(this, n); };
  for (const k of ['load', 'pause', 'play']) { const f = MP[k]; MP[k] = function (...a) { log.push([clock.now(), id(this), k]); return f.apply(this, a); }; }
  Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rs || 0; } });
  Object.defineProperty(MP, 'networkState', { configurable: true, get() { return this.hasAttribute('src') ? 2 : 0; } });
  Object.defineProperty(MP, 'duration', { configurable: true, get() { return this.hasAttribute('src') ? 12 : NaN; } });
  Object.defineProperty(MP, 'buffered', { configurable: true, get() { const el = this; const end = el.__srcT == null ? 0 : Math.min(12, ((clock.now() - el.__srcT) / 1000) * 2); return end > 0 ? { length: 1, end: () => end, start: () => 0 } : { length: 0, end: () => 0, start: () => 0 }; } });
  w.performance.getEntriesByName = (n) => rtEntries.filter((e) => e.name === n);
}

const SEQ = async (api) => {
  await api.enter(2); await api.wait(300); await api.leave(2); await api.wait(50);          // still card: not recorded
  await api.enter(0); await api.wait(40); await api.leave(0); await api.wait(100);          // G1 leave before ready
  await api.enter(0); await api.wait(300); await api.leave(0); await api.wait(100);         // G2 leave after ready
  for (let k = 0; k < 3; k++) { await api.enter(1); await api.wait(300); await api.leave(1); await api.wait(100); } // G3-G5 after ready
  await api.wait(5200);                                                                     // let G1-G5 windows close
  await api.enter(1); await api.wait(300); await api.click(1); await api.wait(200); api.closeViewer(); await api.leave(1); // G6 viewer opened and closed before leave
  await api.wait(6000);
};

async function run({ text = derived, url = 'https://e621.net/posts', loggedIn = false, seq = SEQ, withPackage = true } = {}) {
  let clock = null; const menu = {}; const log = []; const rt = [];
  const html = hh.listing(new URL(url).hostname, 3).html;
  const c = h.load({ url, html, source: withPackage ? text : PROD, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w);
    w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.GM_registerMenuCommand = (name, fn) => { menu[name] = fn; return 0; };
    fixture(w, { loggedIn });
    mediaModel(w, clock, log, rt);
  } });
  const w = c.window;
  await h.sleep(20); await clock.advance(400);
  const cards = [...w.document.querySelectorAll('article')];
  const img = (i) => cards[i].querySelector('img');
  // a hidden Resource Timing entry for card 0's file (sizes 0, as cross-origin)
  rt.push({ name: new URL(cards[0].getAttribute('data-file-url'), url).href, entryType: 'resource', initiatorType: 'video', startTime: clock.now() + 600, responseEnd: clock.now() + 900, transferSize: 0, encodedBodySize: 0, decodedBodySize: 0 });
  const api = {
    enter: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(0); },
    leave: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(0); },
    click: async (i) => { img(i).dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0); },
    closeViewer: () => c.BE.modules.viewer.close(),
    wait: (ms) => clock.advance(ms),
  };
  const startKey = Object.keys(menu).find((k) => k.startsWith('IB10L: Start session'));
  if (startKey) { menu[startKey](); await clock.advance(0); }
  await seq(api);
  let json = null; let text2 = '';
  const resKey = Object.keys(menu).find((k) => k.startsWith('IB10L: Show results'));
  if (resKey) { const p = menu[resKey](); for (let i = 0; i < 20; i++) { await clock.advance(200); await h.sleep(0); } await p; text2 = w.document.querySelector('#ib10l-result textarea')?.value || ''; try { json = JSON.parse(text2); } catch { json = null; } }
  const out = { json, text: text2, log, network: c.requests.length, menu: Object.keys(menu) };
  w.close();
  return out;
}

const gens = (r) => (r.json && r.json.sessions && r.json.sessions[0] ? r.json.sessions[0].generations : []);
const trusted = (g) => ({ ...g, trigger: 'TRUSTED' });

async function main() {
  const base = await run();
  const G = gens(base);
  check('identity MATCH_EXPECTED_ARTIFACT; site e621.net; version 1.0.0; menu has only Start/Show results under IB10L', base.json && base.json.production_body_identity === 'MATCH_EXPECTED_ARTIFACT' && base.json.site === 'e621.net' && base.json.version === '1.0.0' && base.menu.filter((m) => m.startsWith('IB10L')).length === 2, base.text.slice(0, 300));
  check('records only video-card hovers: 6 generations (the still card is counted as otherHovers=1)', G.length === 6 && base.json.sessions[0].otherHovers === 1, JSON.stringify(base.json && base.json.sessions[0] && { n: G.length, other: base.json.sessions[0].otherHovers }));
  const [G1, G2, G3, G4, G5, G6] = G;
  check('per-generation facts: host, container as encountered (webm/mp4), exact data-size, native dimensions, card ordinal and repeat count; hover src is the card data-file-url',
    G1 && G1.host === 'e621.net' && G1.container === 'webm' && G1.dataSize === 1000000 && G3.container === 'mp4' && G3.dataSize === 1000001 && G1.width === 1280 && G1.height === 720 && G2.hoverOnCard === 2 && G5.hoverOnCard === 3 && G1.cardOrdinal === 1 && G3.cardOrdinal === 2 && G.every((g) => g.element && g.element.srcMatchesCardFile === true), JSON.stringify(G1));
  check('timing: src assigned at enter (0 ms), loadeddata at 120 ms, leave 40 ms (G1) and 300 ms (G2)', G1.element.srcSetT === 0 && G2.element.readiness.loadeddata === 120 && G1.leaveT === 40 && G2.leaveT === 300 && G1.element.readiness.loadeddata === null, JSON.stringify([G1.element, G2.element.readiness]));
  check('samples at leave, +1 s and +5 s exist with their offsets for every generation', G.every((g) => g.samples.leave && g.samples.p1 && g.samples.p5 && g.samples.p1.t - g.samples.leave.t === 1000 && g.samples.p5.t - g.samples.leave.t === 5000), JSON.stringify(G.map((g) => Object.fromEntries(Object.entries(g.samples).map(([k, v]) => [k, v.t])))));
  check('before-ready leave (G1): production released the source (src removed at 40); element not holding at leave/+5 s', JSON.stringify(G1.element.srcRemovedT) === '[40]' && G1.samples.leave.element.holdsSrc === 0 && G1.samples.p5.element.holdsSrc === 0 && classify(trusted(G1)).leave === 'BEFORE_READY', JSON.stringify(G1.samples));
  check('after-ready leave (G2): detached but holding src, networkState LOADING, buffered grows leave -> +5 s (DOM evidence only)', G2.samples.leave.element.attached === 0 && G2.samples.p5.element.holdsSrc === 1 && G2.samples.p5.element.networkState === 2 && G2.samples.p5.element.bufferedEnd > G2.samples.leave.element.bufferedEnd && classify(trusted(G2)).leave === 'AFTER_READY', JSON.stringify(G2.samples));
  check('accumulation distinguished: holding hover <video> count at each leave rises 0,1,2,3,4,5 (G1 released; G2..G6 retained); +5 s reads 4,4,4,4,4,5', JSON.stringify(G.map((g) => g.samples.leave.holdingHoverVideos)) === '[0,1,2,3,4,5]' && JSON.stringify(G.map((g) => g.samples.p5.holdingHoverVideos)) === '[4,4,4,4,4,5]', JSON.stringify(G.map((g) => [g.samples.leave.holdingHoverVideos, g.samples.p5.holdingHoverVideos])));
  check('Resource Timing recorded only as exposed: one hidden-size entry for card 0 (rtSizesHidden, rtCompleted); others none', G2.resourceTiming.length === 1 && classify(trusted(G2)).rtSizesHidden && classify(trusted(G2)).rtCompleted && G3.resourceTiming.length === 0, JSON.stringify(G2.resourceTiming));
  check('contamination: scripted (untrusted) pointer -> every generation CONTAMINATED as recorded', G.every((g) => g.trigger === 'SYNTHETIC' && g.classification.status === 'CONTAMINATED'), JSON.stringify(G.map((g) => [g.trigger, g.classification.status])));
  check('classification with a TRUSTED trigger: G1-G5 USABLE; G6 CONTAMINATED (viewer opened and closed before its leave)', [G1, G2, G3, G4, G5].every((g) => classify(trusted(g)).status === 'USABLE') && classify(trusted(G6)).status === 'CONTAMINATED' && classify(trusted(G6)).reasons.includes('viewer open'), JSON.stringify(classify(trusted(G6))));
  check('ambiguity rules: missing +5 s sample or no hover element -> AMBIGUOUS', classify({ ...trusted(G2), samples: { leave: G2.samples.leave, p1: G2.samples.p1 } }).status === 'AMBIGUOUS' && classify({ ...trusted(G2), hoverElements: 0, element: null }).status === 'AMBIGUOUS');
  check('muted at every play; no enhancer network request; output has no URL, post ID or hash', G.every((g) => g.element.calls.filter((x) => x[1] === 'play').every((x) => x[2] === 'muted')) && base.network === 0 && !/https?:\/\//.test(base.text) && !/0123456789abcdef/.test(base.text) && !/"10[123]"/.test(base.text), base.text.slice(0, 200));
  const an = analyze([JSON.parse(JSON.stringify(base.json, (k, v) => (k === 'trigger' ? 'TRUSTED' : v)))]);
  check('analyzer: per host x container summary (webm 2 usable, mp4 3 usable + 1 contaminated), leave split and exact data-size distribution', an.summary['e621.net|webm'].usable === 2 && an.summary['e621.net|mp4'].usable === 3 && an.summary['e621.net|mp4'].status.CONTAMINATED === 1 && an.summary['e621.net|webm'].leave.BEFORE_READY === 1 && an.summary['e621.net|mp4'].dataSizeBytes.min === 1000001, JSON.stringify(an.summary));

  // observe-only (runtime): production's media actions are identical with and without the package
  const bare = await run({ withPackage: false });
  const norm = (log) => JSON.stringify(log);
  check('observe-only (runtime): production media actions (src/removeSrc/load/pause/play per element, timed) identical with and without the package', norm(base.log) === norm(bare.log) && base.log.length > 0, `${base.log.length} vs ${bare.log.length}`);

  // route / login restriction
  const li = await run({ loggedIn: true });
  const pp = await run({ url: 'https://e621.net/posts/123' });
  check('scope: no session starts on a logged-in page or a non-/posts route (0 generations recorded)', li.json && li.json.sessions.length === 0 && pp.json && pp.json.sessions.length === 0, JSON.stringify([li.json && li.json.sessions.length, pp.json && pp.json.sessions.length]));

  // bounded sampling
  const capped = await run({ text: b.build({ postTransform: (p) => mustReplace(p, 'const MAX_GENERATIONS = 120;', 'const MAX_GENERATIONS = 2;') }).text });
  check('bounded: generations stop at the cap and the rest are counted as droppedBeyondCap', gens(capped).length === 2 && capped.json.sessions[0].droppedBeyondCap === 4, JSON.stringify(capped.json && capped.json.sessions[0] && { n: gens(capped).length, d: capped.json.sessions[0].droppedBeyondCap }));

  // ---------- fault controls ----------
  const F = [];
  { const r = await run({ text: b.build({ bodyTransform: (x) => x.replace('const HOVER_DWELL_MS = 200;', 'const HOVER_DWELL_MS = 201;') }).text });
    F.push(['production artifact mismatch (tampered body): identity MISMATCH', r.json && r.json.production_body_identity === 'MISMATCH']); }
  { const r = await run({ text: b.build({ preTransform: (p) => mustReplace(p, "MP[k] = function (...a) { if (this.__ib10l) this.__ib10l.calls.push([t(), k, this.muted ? 'muted' : 'UNMUTED']); return f.apply(this, a); };",
      "MP[k] = function (...a) { if (this.__ib10l) this.__ib10l.calls.push([t(), k, this.muted ? 'muted' : 'UNMUTED']); if (k === 'pause' && this.__ib10l) ra.call(this, 'src'); return f.apply(this, a); };") }).text });
    F.push(['accidental production-affecting mutation (pause wrapper also drops src): caught by the runtime observe-only equivalence', norm(r.log) !== norm(bare.log)]); }
  { const t = b.build({ postTransform: (p) => mustReplace(p, "    if (!SITE || !/^\\/posts\\/?$/.test(window.location.pathname)) return 'IB10L: open a logged-out e621/e926 /posts listing';\n    if (document.body?.getAttribute('data-user-is-anonymous') !== 'true') return 'IB10L: must be logged out';\n", '') }).text;
    const r = await run({ text: t, loggedIn: true });
    F.push(['host/route scope failure (route and login checks removed): caught (session recorded on a logged-in page)', r.json && r.json.sessions.length === 1]); }
  { const r = await run({ text: b.build({ postTransform: (p) => mustReplace(p, "      if (session) for (const g of session.generations) if (!g.final) g.viewerOpened = true;\n", '') }).text });
    F.push(['viewer takeover not recorded (open wrapper removed): caught (G6 no longer CONTAMINATED)', gens(r)[5] && classify(trusted(gens(r)[5])).status !== 'CONTAMINATED']); }
  { const r = await run({ text: b.build({ postTransform: (p) => mustReplace(p, "        sample(g, 'leave');\n", '') }).text });
    F.push(['missing leave sampling: caught (generations AMBIGUOUS: missing leave sample)', gens(r).length && gens(r).every((g) => classify(trusted(g)).reasons.includes('missing leave sample'))]); }
  { const r = await run({ text: b.build({ preTransform: (p) => mustReplace(p, "const EVENTS = ['loadstart', 'loadedmetadata', 'loadeddata', ", "const EVENTS = ['loadstart', 'loadedmetadata', ") }).text });
    F.push(['missing readiness recording: caught (after-ready leaves misclassified BEFORE_READY / no loadeddata)', gens(r).length && gens(r).every((g) => g.element.readiness.loadeddata === null) && classify(trusted(gens(r)[1])).leave === 'BEFORE_READY']); }
  { const r = await run({ text: b.build({ postTransform: (p) => mustReplace(p, "        setTimeout(() => { sample(g, 'p5'); finalize(g); }, 5000);\n", "        setTimeout(() => { finalize(g); }, 5000);\n") }).text });
    F.push(['missing +5 s observation: caught (AMBIGUOUS: missing p5 sample)', gens(r).length && gens(r).every((g) => classify(trusted(g)).reasons.includes('missing p5 sample'))]); }
  { const r = await run({ text: b.build({ postTransform: (p) => mustReplace(p, "        setTimeout(() => sample(g, 'p1'), 1000);\n", '') }).text });
    F.push(['missing +1 s observation: caught (AMBIGUOUS: missing p1 sample)', gens(r).length && gens(r).every((g) => classify(trusted(g)).reasons.includes('missing p1 sample'))]); }
  { const r = await run({ text: b.build({ preTransform: (p) => mustReplace(p, "    holdingHoverCount() { return videos.filter((v) => v.__ib10l.owner === 'hover' && v.hasAttribute('src') && v.getAttribute('src') !== '').length; },",
      "    holdingHoverCount() { return videos.filter((v) => v.__ib10l.owner === 'hover' && v.__ib10l.gen === generation && v.hasAttribute('src') && v.getAttribute('src') !== '').length; },") }).text });
    F.push(['accumulation not distinguished (count only the current generation): caught (leave counts are not 0,1,2,3,4,5)', gens(r).length === 6 && JSON.stringify(gens(r).map((g) => g.samples.leave.holdingHoverVideos)) !== '[0,1,2,3,4,5]']); }
  for (const [name, ok] of F) check(`fault ${name}`, ok);

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB10', stage: 'E-stage V3-L live observer, local qualification (simulated media; not live evidence)', production_commit: b.COMMIT, production_blob: b.EXPECTED_PRODUCTION_BLOB,
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB10_V3L_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
