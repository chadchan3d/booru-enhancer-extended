'use strict';
// Local qualification of the IB10 reopen (poster/View fallback) targeted live
// conformance package and evaluator revision 1.2 (no real browser; the browser
// run belongs to the operator):
//   1. static: package current; executed body = committed corrected production
//      body byte for byte; @match scope; distinct script name/namespace; the
//      8324552 evidence packages unchanged;
//   2. smoke (jsdom, fake clock, simulated readiness): the PF observer on both
//      hosts with admitted and excluded video cards; the same session on the old
//      8324552 package (excluded cards auto-play) must fail the evaluator;
//   3. the targeted evaluator on synthetic results, with fault controls.
// Usage: node verify_ib10_pf_conformance.cjs
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib10_p_conformance.cjs');
const pf = require('./build_ib10_pf_conformance.cjs');
const { evaluateTargeted, REVISION_TARGETED } = require('./p_conformance_ib10.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 600) });
const REPO = path.resolve(__dirname, '../../..');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const PROD = git('show', `${pf.PF_COMMIT}:Booru_Enhancer.user.js`);
const FALLBACK = "\t\t\t} else if (resolved.mediaType === 'video' || guessMediaType(resolved.url) === 'video') {";

// ---- 1. static ----
const L = fs.readFileSync(pf.OUT_PF_LIVE, 'utf8');
const fresh = pf.buildPf();
check('PF package matches a fresh build', L === fresh.live);
check('production at the PF commit is the expected blob and equals the working tree', git('rev-parse', `${pf.PF_COMMIT}:Booru_Enhancer.user.js`).trim() === pf.PF_EXPECTED_BLOB && h.gitBlobId(h.productionSource()) === pf.PF_EXPECTED_BLOB);
const body = (t, o, c) => t.slice(t.indexOf(o) + o.length, t.indexOf(c));
check('the PF package executes the committed corrected production body byte for byte (no hooks)', body(L, b.L_WRAP_OPEN, b.L_WRAP_CLOSE) === split(PROD).body);
check('the executed body contains the poster/View fallback; the 8324552 body does not', split(PROD).body.includes(FALLBACK) && !split(git('show', `${b.COMMIT}:Booru_Enhancer.user.js`)).body.includes(FALLBACK));
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: matches only e621.net and e926.net', metaOf(L, 'match') === '*://e621.net/*,*://e926.net/*');
const P_LIVE = fs.readFileSync(b.OUT_LIVE, 'utf8');
check('distinct script name and namespace from the 8324552 live package (installs side by side, never replaces it)', metaOf(L, 'name') !== metaOf(P_LIVE, 'name') && metaOf(L, 'namespace') !== metaOf(P_LIVE, 'namespace') && metaOf(L, 'name').includes('PF'));
const old = b.build();
check('the 8324552 evidence packages are unchanged (still equal a fresh pinned build)', fs.readFileSync(b.OUT_CONTROLLED, 'utf8') === old.controlled && P_LIVE === old.live);

// ---- 2. smoke ----
function mediaSim(w) {
  const MP = w.HTMLMediaElement.prototype; const d = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, v); const el = this; const g = (el.__g = (el.__g || 0) + 1); w.setTimeout(() => { if (el.__g === g && el.hasAttribute('src')) { el.__rs = 2; el.dispatchEvent(new w.Event('loadeddata')); } }, 120); } });
  const ra = w.Element.prototype.removeAttribute; w.Element.prototype.removeAttribute = function (n) { if (this instanceof w.HTMLMediaElement && n === 'src') this.__g = (this.__g || 0) + 1; return ra.call(this, n); };
  Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rs || 0; } });
  Object.defineProperty(MP, 'networkState', { configurable: true, get() { return this.hasAttribute('src') ? 2 : 0; } });
}
const baseSetup = (w, clock) => { w.performance.now = () => clock.now(); w.performance.getEntriesByName = () => []; if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true }); if (!w.TextEncoder) w.TextEncoder = TextEncoder; };
// Card 0 admitted; cards 1-2 excluded (the host's required negative class); card 3
// a further excluded class (e621 WebM > 100 MB / e926 MP4 >= 50 MB).
const CARDS = { 'e621.net': [['webm', 5000000], ['mp4', 5000000], ['mp4', 8000000], ['webm', 150000000]], 'e926.net': [['mp4', 5000000], ['webm', 5000000], ['webm', 8000000], ['mp4', 60000000]] };
async function liveSmoke(source, host) {
  let clock = null; const menu = {};
  const c = h.load({ url: `https://${host}/posts`, html: hh.listing(host, 5).html, source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); baseSetup(w, clock); mediaSim(w);
    w.GM_registerMenuCommand = (n, fn) => { menu[n] = fn; return 0; };
    for (const [i, a] of [...w.document.querySelectorAll('article')].entries()) if (CARDS[host][i]) { const [ext, size] = CARDS[host][i]; a.setAttribute('data-file-ext', ext); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, `.${ext}`)); a.setAttribute('data-size', String(size)); }
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const img = (i) => w.document.querySelectorAll('article')[i].querySelector('img');
  menu[Object.keys(menu).find((k) => k.startsWith('IB10L: Start'))](); await clock.advance(0);
  const enter = (i) => img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true }));
  const leave = (i) => img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body }));
  const hover = async (i, ms) => { enter(i); await clock.advance(ms); leave(i); await clock.advance(100); };
  await hover(0, 40); await hover(0, 600); await hover(0, 900); await hover(0, 60);
  await hover(1, 600); await hover(2, 900); await hover(1, 1200); await hover(3, 700);
  await clock.advance(6000);
  // View: click an excluded card while hovering it; then close the viewer.
  enter(2); await clock.advance(400);
  img(2).dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(300);
  const viewerOpened = !!w.BE.modules.viewer?.isOpen?.();
  leave(2); await clock.advance(6000); w.BE.modules.viewer?.close?.(); await clock.advance(200);
  const p = menu[Object.keys(menu).find((k) => k.startsWith('IB10L: Show results'))](); for (let i = 0; i < 20; i++) { await clock.advance(200); await h.sleep(0); } await p;
  const json = JSON.parse(w.document.querySelector('#ib10l-result textarea').value); w.close();
  return { json, viewerOpened };
}
const trusted = (doc) => JSON.parse(JSON.stringify(doc, (k, v) => (k === 'trigger' ? 'TRUSTED' : v)));

async function main() {
  const docs = []; const oldDocs = [];
  for (const host of ['e621.net', 'e926.net']) {
    const { json, viewerOpened } = await liveSmoke(L, host);
    docs.push(trusted(json));
    const gens = json.sessions[0].generations;
    check(`PF smoke ${host}: identity MATCH; viewer opened from an excluded card; excluded cards created no hover video; admitted card did`, json.production_body_identity === 'MATCH_EXPECTED_ARTIFACT' && viewerOpened && gens.filter((g) => g.cardOrdinal !== 1).every((g) => g.hoverElements === 0) && gens.some((g) => g.hoverElements === 1), JSON.stringify(gens.map((g) => [g.container, g.dataSize, g.leaveT, g.hoverElements, g.viewerOpened])));
    oldDocs.push(trusted((await liveSmoke(old.live, host)).json));
  }
  const r = evaluateTargeted(docs);
  check(`PF smoke: targeted evaluator revision ${REVISION_TARGETED} passes both hosts (positive, negative, View)`, r.pass, JSON.stringify({ hosts: r.hosts, failures: r.failures.slice(0, 3) }));
  const ro = evaluateTargeted(oldDocs);
  check('fault package: the same session on the 8324552 package (old automatic hover video for excluded cards) fails N1 on both hosts', !ro.pass && ['e621.net', 'e926.net'].every((x) => !ro.hosts[x].negativeOk) && ro.failures.some((f) => f.fails.some((m) => m.startsWith('N1'))), JSON.stringify(ro.hosts));

  // ---- 3. evaluator: synthetic results ----
  const elemAt = (k) => ({ attached: 0, inHover: 0, holdsSrc: 0, networkState: k === 'leave' ? 3 : 0, readyState: 0, bufferedEnd: 0, duration: null, paused: 1 });
  const gen = (host, container, stay, { video = stay > 200, size = 5000000, viewer = false, trigger = 'TRUSTED' } = {}) => ({ host, container, dataSize: size, trigger, leaveT: stay, viewerOpened: viewer, hoverElements: video ? 1 : 0, cardOrdinal: 1, hoverOnCard: 1, final: true,
    element: video ? { srcMatchesCardFile: true, srcSetT: 200, srcRemovedT: [stay], calls: [[200, 'load', 'muted'], [320, 'play', 'muted'], [stay, 'pause', 'muted'], [stay, 'load', 'muted']], readiness: { loadeddata: stay > 320 ? 320 : null }, firstFrame: stay > 330 ? 330 : null, events: [] } : null,
    samples: Object.fromEntries(['leave', 'p1', 'p5'].map((k) => [k, { t: 0, element: video ? elemAt(k) : null, holdingHoverVideos: 0, viewerOpen: false, hidden: false }])) });
  const doc = (site, gens) => ({ site, production_body_identity: 'MATCH_EXPECTED_ARTIFACT', runtime: {}, sessions: [{ generations: gens }] });
  const hostSet = (host, adm, neg) => [...[40, 600, 900, 1500].map((s) => gen(host, adm, s)), ...[600, 900, 1200].map((s) => gen(host, neg, s, { video: false })), gen(host, neg, 700, { video: false, viewer: true })];
  const set = (mut = (x) => x) => [doc('e621.net', mut(hostSet('e621.net', 'webm', 'mp4'), 'e621.net')), doc('e926.net', mut(hostSet('e926.net', 'mp4', 'webm'), 'e926.net'))];
  const ok = evaluateTargeted(set());
  check('evaluator targeted: a conforming synthetic result passes', ok.pass && ok.hosts['e621.net'].negative.requiredSustained === 3 && ok.hosts['e926.net'].viewOk, JSON.stringify(ok.hosts));
  const tf = (name, res, prefix) => check(`fault targeted: ${name}: caught${prefix ? ` (${prefix})` : ''}`, !res.pass && (!prefix || res.failures.some((x) => x.fails.some((f) => f.startsWith(prefix)))), JSON.stringify({ hosts: res.hosts, f: res.failures.slice(0, 2) }));
  const on = (host, fn) => (gens, h0) => (h0 === host ? fn(gens) : gens);
  tf('excluded e621 MP4 hover created a video (old automatic path)', evaluateTargeted(set(on('e621.net', (g) => g.map((x, i) => (i === 5 ? { ...gen('e621.net', 'mp4', 900), samples: x.samples } : x))))), 'N1');
  tf('excluded e926 WebM: a hover video still holds a source at +5 s', evaluateTargeted(set(on('e926.net', (g) => g.map((x, i) => (i === 4 ? { ...x, samples: { ...x.samples, p5: { ...x.samples.p5, holdingHoverVideos: 1 } } } : x))))), 'N2');
  tf('excluded hover with a video under a synthetic trigger is still a failure', evaluateTargeted(set(on('e621.net', (g) => g.concat([gen('e621.net', 'mp4', 900, { trigger: 'SYNTHETIC' })])))), 'N1');
  tf('e926 MP4 >= 50 MB auto-played', evaluateTargeted(set(on('e926.net', (g) => g.concat([gen('e926.net', 'mp4', 900, { size: 60000000 })])))), 'N1');
  tf('required negative class missing (e621 has only WebM > 100 MB negatives)', evaluateTargeted(set(on('e621.net', (g) => g.map((x) => (x.container === 'mp4' ? { ...x, container: 'webm', dataSize: 150000000 } : x))))));
  tf('only two sustained required negatives', evaluateTargeted(set(on('e926.net', (g) => g.filter((x, i) => i !== 6)))));
  tf('untrusted negatives are not counted as evidence', evaluateTargeted(set(on('e621.net', (g) => g.map((x, i) => (i >= 4 && i <= 6 ? { ...x, trigger: 'SYNTHETIC' } : x))))));
  tf('no View evidence (no excluded card opened in the viewer)', evaluateTargeted(set(on('e926.net', (g) => g.filter((x) => !x.viewerOpened)))));
  tf('View evidence without its samples (unfinalized) is not counted', evaluateTargeted(set(on('e621.net', (g) => g.map((x) => (x.viewerOpened ? { ...x, samples: { leave: x.samples.leave }, hoverElements: undefined } : x))))));
  tf('admitted sustained hover without a preview (fallback applied to the admitted class)', evaluateTargeted(set(on('e621.net', (g) => g.map((x, i) => (i === 2 ? gen('e621.net', 'webm', 900, { video: false }) : x))))), 'L1');
  tf('admitted source before the dwell', evaluateTargeted(set(on('e926.net', (g) => g.map((x, i) => (i === 1 ? { ...x, element: { ...x.element, srcSetT: 150 } } : x))))), 'L2');
  tf('artifact identity mismatch', evaluateTargeted(set().map((d, i) => (i === 0 ? { ...d, production_body_identity: 'MISMATCH' } : d))));
  tf('sanitation guard blocked a result', evaluateTargeted(set().map((d, i) => (i === 1 ? { ...d, sanitationGuard: 'BLOCKED' } : d))));

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB10_PF_CONFORMANCE_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib10-pf-conformance-verification', pfCommit: pf.PF_COMMIT, pfBlob: pf.PF_EXPECTED_BLOB, evaluatorRevision: REVISION_TARGETED, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
