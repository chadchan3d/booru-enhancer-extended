'use strict';
// Local verification for the IB08 e621/e926 rendition production-conformance
// build (no live site). Static: the derived script is current, its production
// body is byte-identical to the committed artifact, metadata changes are
// limited, and the postamble makes no request and no storage/cookie access.
// Runtime: the REAL derived userscript (production body + postamble) runs in
// jsdom on synthetic listings. jsdom has no image selection, so currentSrc is
// modelled (first supported <source> before the <img> with a srcset, else img
// src). Every check must PASS on the committed artifact, production mutants
// must flip a check, and outputs must not leak planted values.
// Revision 2 adds the first live run's failure classes as regressions:
//   A - dispose then a wait past production's 400 ms body-observer debounce;
//   B - a card whose native file and sample URLs are the same (alias);
//   C - a logged-in page with native and enhancer-UI writes off the cards.
// The committed revision-1 package (commit 595629e) must reproduce each live
// failure shape; revision 2 must attribute it correctly. Production a0f3041
// failed the dispose test (diagnosis A, gallery re-enhanced itself after
// dispose). The corrected production must pass it after the debounce, and a
// production mutant that removes the disposed-container barrier must fail D10.
// Revision 3 adds the second live run's D10 shape: a site-side class touch on
// every card leaves the enhancer class after dispose (stale state). The
// revision-2 package counted that as re-enhancement; revision 3 must not, and
// must still fail D10 on real re-enhancement (barrier removed).
// Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const { build, COMMIT, EXPECTED_PRODUCTION_BLOB, POSTAMBLE_MARKER, OUT } = require('./build_ib08_conformance.cjs');
const { split, WRAP_OPEN, WRAP_FN_HEAD, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

// ---- static ------------------------------------------------------------------
const derived = fs.readFileSync(OUT, 'utf8');
const built = build();
check('derived script matches a fresh build from the committed artifact', derived === built.text);
check('committed production blob is the expected artifact',
  execFileSync('git', ['-C', path.resolve(__dirname, '../../..'), 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === EXPECTED_PRODUCTION_BLOB);
check('derived script is LF-only', !derived.includes('\r'));
try { new Function(derived); check('derived script parses', true); } catch (e) { check('derived script parses', false, e.message); }
const wrapAt = derived.indexOf(WRAP_OPEN);
const closeAt = derived.indexOf(WRAP_CLOSE);
const markerAt = derived.indexOf(POSTAMBLE_MARKER);
check('production body is byte-identical to the committed artifact inside the wrapper', derived.slice(wrapAt + WRAP_OPEN.length, closeAt) === built.body);
check('production body appears exactly once; wrapper invoked once before the postamble', derived.split(built.body).length === 2 && derived.split('IB07P_PRODUCTION_BODY();').length === 2 && derived.indexOf('IB07P_PRODUCTION_BODY();') < markerAt);
const wrapperSource = derived.slice(wrapAt + WRAP_OPEN.length - WRAP_FN_HEAD.length, closeAt + 1);
check('engine toString of the wrapper reproduces it exactly', Function.prototype.toString.call((0, eval)(`(${wrapperSource})`)) === wrapperSource);
const meta = split(derived).meta.split('\n');
const orig = built.originalMeta.split('\n');
check('metadata adds/removes only name/namespace/match/connect/update lines',
  meta.filter((l) => !orig.includes(l)).every((l) => /^\/\/ @(name|namespace|match|connect)\s/.test(l)) && orig.filter((l) => !meta.includes(l)).every((l) => /^\/\/ @(name|namespace|match|connect|downloadURL|updateURL)\s/.test(l)));
check('only e621.net and e926.net matched and connected; no update target',
  meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === '*://e621.net/*,*://e926.net/*'
  && meta.filter((l) => /@connect\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === 'e621.net,e926.net' && !meta.some((l) => /@(downloadURL|updateURL)/.test(l)));
const postamble = derived.slice(markerAt);
check('postamble makes no request, click, navigation, cookie, storage or settings write',
  !/\bfetch\(|XMLHttpRequest|GM_xmlhttpRequest\(|GM_download\(|GM_setValue|\.click\(|location\.(assign|replace)|document\.cookie|localStorage|sessionStorage|settings\.set\(/.test(postamble));

// ---- fixtures ----------------------------------------------------------------
const M = 'https://static.example';
const H = '0123456789abcdef0123456789abcdef';
const U = (id) => ({ file: `${M}/data/${H}_${id}.png`, sample: `${M}/data/sample/${H}_${id}.jpg`, preview: `${M}/data/preview/${H}_${id}.jpg`, webp: `${M}/data/preview/${H}_${id}.webp` });
function card(id, kind = 'ok') {
  const u = U(id);
  if (kind === 'alias') u.file = u.sample; // native file URL == native sample URL
  const ext = kind === 'video' ? 'webm' : 'png';
  const s1 = kind === 'sizes' ? `<source srcset="${u.webp}" type="image/webp" sizes="100px">` : `<source srcset="${u.webp}" type="image/webp">`;
  return `<article class="thumbnail" data-id="${id}" data-md5="${H}" data-file-ext="${ext}" data-file-url="${u.file}" data-sample-url="${u.sample}"
    data-preview-url="${u.preview}" data-preview-webp="${u.webp}"><a href="/posts/${id}" class="thm-link"><picture>${s1}<source srcset="${u.preview}" type="image/jpeg"><img src="${u.preview}" alt=""></picture></a></article>`;
}
const listing = (anon, { alias = false } = {}) => `<!doctype html><html><head></head><body data-user-is-anonymous="${anon}" data-user-level="${anon === 'true' ? '0' : '20'}">
  <header><img id="nav-avatar" src="${M}/ui/avatar.png" alt=""></header>
  <section id="posts-container" class="posts-container">${[...Array.from({ length: 7 }, (_, i) => card(String(9001 + i), alias && i === 2 ? 'alias' : 'ok')), card('9101', 'video'), card('9102', 'sizes')].join('')}</section></body></html>`;
const RAW = ['9001', '9002', '9101', H, 'static.example', 'http'];
const leaks = (t) => RAW.filter((r) => t.includes(r));

const FAST = (text) => text.replace('const SETTLE_MS = 2500;', 'const SETTLE_MS = 0;');
async function runScript({ url = 'https://e621.net/posts', anon = 'true', quality = 'sample', text = derived, steps = ['check'], alias = false, nativeActions = null }) {
  const menu = {};
  const c = h.load({ url, html: listing(anon, { alias }), source: FAST(text), settings: { 'be:setting:media.thumbQuality': JSON.stringify(quality) }, setup: (w) => {
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    w.GM_registerMenuCommand = (name, fn) => { menu[name] = fn; return 0; };
    w.innerWidth = 1600; w.innerHeight = 1000;
    w.Element.prototype.getBoundingClientRect = function rect() { return { top: 10, bottom: 200, left: 0, right: 200, width: 200, height: 190 }; };
    Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
    Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { configurable: true, get() {
      const p = this.parentElement;
      if (p && p.localName === 'picture') for (const ch of p.children) { if (ch === this) break; if (ch.localName === 'source' && ch.getAttribute('srcset')) return new URL(ch.getAttribute('srcset').trim().split(/\s+/)[0], w.location.href).href; }
      return this.getAttribute('src') ? new URL(this.getAttribute('src'), w.location.href).href : '';
    } });
  } });
  await h.sleep(250);
  if (nativeActions) { nativeActions(c.window); await h.sleep(20); }
  const out = {};
  const read = () => { const t = c.window.document.querySelector('#ib08p-result textarea')?.value || ''; try { return { t, j: JSON.parse(t) }; } catch { return { t, j: null }; } };
  for (const step of steps) {
    if (step === 'narrow') { c.window.innerWidth = 900; continue; }
    if (step === 'wait') { await h.sleep(700); continue; } // past production's 400 ms body-observer debounce
    const name = { check: 'IB08P: Check this page (current quality)', d1: 'IB08P: Dispose test step 1 (wide window)', d2: 'IB08P: Dispose test step 2 (after narrowing)' }[step];
    await menu[name]();
    out[step] = read();
  }
  out.requests = c.requests.length;
  c.window.close();
  return out;
}
const statusOf = (j) => Object.fromEntries((j?.checks || []).map((x) => [x.id, x.status]));
const SCEN = [
  ['e621 logged out, sample', { quality: 'sample' }],
  ['e621 logged out, preview', { quality: 'preview' }],
  ['e621 logged out, original', { quality: 'original' }],
  ['e621 logged in, original saved (inert)', { anon: 'false', quality: 'original' }],
  ['e926 logged out, sample', { url: 'https://e926.net/posts', quality: 'sample' }],
  ['e926 logged out, preview', { url: 'https://e926.net/posts', quality: 'preview' }],
  ['e926 logged out, original', { url: 'https://e926.net/posts', quality: 'original' }],
  ['e926 logged in, sample saved (inert)', { url: 'https://e926.net/posts', anon: 'false', quality: 'sample' }],
];
// Diagnosis C: writes that are not enhancer rendition writes (native header image, a late native
// image, an enhancer-UI image), made after production mounted.
// Second live run: a site script rewriting every card's class after enhancement (no token change).
const SITE_CLASS_TOUCH = (w) => { for (const a of w.document.querySelectorAll('article')) a.classList.remove('blacklisted'); };
const OFF_CARD_WRITES = (w) => {
  const d = w.document;
  d.querySelector('#nav-avatar').setAttribute('src', `${M}/ui/avatar2.png`);
  const late = d.createElement('img'); d.body.appendChild(late); late.setAttribute('src', `${M}/ui/late.png`);
  const ui = d.createElement('div'); ui.id = 'be-test-ui'; const uimg = d.createElement('img'); ui.appendChild(uimg); d.body.appendChild(ui); uimg.setAttribute('src', `${M}/ui/overlay.png`);
};
const EXPECT_NA = { 'e621 logged in, original saved (inert)': ['P09'], 'e926 logged in, sample saved (inert)': ['P09'] };

const mut = (text, from, to) => { if (text.split(from).length !== 2) throw new Error(`mutant pattern not unique: ${from.slice(0, 50)}`); return text.replace(from, to); };
const W = "if (!owner.ownAttribute(p.webpSource, 'srcset', target)) return 'REFUSED_NATIVE_TOUCHED';";
const PM = {
  bodyAltered: (t) => mut(t, 'function e6RenditionAdmitted() {', 'function e6RenditionAdmitted() { void 0;'),
  jpegAlsoWritten: (t) => mut(t, W, `${W} owner.ownAttribute(p.webpSource.nextElementSibling, 'srcset', target);`),
  imgSrcWritten: (t) => mut(t, W, `${W} owner.ownAttribute(img, 'src', target);`),
  loginGateRemoved: (t) => mut(t, "document.body?.getAttribute('data-user-is-anonymous') === 'true'", 'true'),
  previewWrites: (t) => mut(t, "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : null;", "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : wrap.getAttribute('data-preview-url');"),
  originalAsSample: (t) => mut(t, "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : null;", "const target = quality === 'sample' || quality === 'original' ? p.sample : null;"),
  clonesSource: (t) => mut(t, W, "{ const n = p.webpSource.cloneNode(true); n.setAttribute('srcset', target); p.webpSource.replaceWith(n); }"),
  ownerBypassed: (t) => mut(t, W, "p.webpSource.setAttribute('srcset', target);"),
  patternGateOff: (t) => mut(t, "if (s.hasAttribute('sizes') || s.hasAttribute('media')) return null;", ''),
  request: (t) => mut(t, W, `${W} BE.net.request({ url: location.origin + '/posts.json' }, 1).catch(() => {});`),
};
const FAULTS = [
  ['production body altered', 'e621 logged out, sample', PM.bodyAltered, ['P00']],
  ['JPEG source also written', 'e621 logged out, sample', PM.jpegAlsoWritten, ['P06', 'P07']],
  ['img src written', 'e926 logged out, sample', PM.imgSrcWritten, ['P06', 'P07']],
  ['login gate removed', 'e621 logged in, original saved (inert)', PM.loginGateRemoved, ['P05', 'P06']],
  ['login gate removed (e926)', 'e926 logged in, sample saved (inert)', PM.loginGateRemoved, ['P05', 'P06']],
  ['preview writes the JPEG preview', 'e621 logged out, preview', PM.previewWrites, ['P06', 'P07']],
  ['original mapped to sample', 'e926 logged out, original', PM.originalAsSample, ['P07', 'P09']],
  ['source node cloned/replaced', 'e621 logged out, sample', PM.clonesSource, ['P08']],
  ['sizes/media pattern check removed', 'e621 logged out, sample', PM.patternGateOff, ['P05', 'P06']],
  ['request from rendition path', 'e621 logged out, sample', PM.request, ['P11']],
];

async function main() {
  const scen = Object.fromEntries(SCEN);
  for (const [name, opts] of SCEN) {
    const r = await runScript(opts);
    const st = statusOf(r.check.j);
    const na = EXPECT_NA[name] || [];
    const bad = Object.entries(st).filter(([id, s]) => (na.includes(id) ? s !== 'NOT_APPLICABLE' : s !== 'PASS'));
    check(`${name}: every check PASS (${Object.keys(st).length} checks)`, Object.keys(st).length === 12 && bad.length === 0, JSON.stringify(bad) + ' ' + r.check.t.slice(0, 200));
    check(`${name}: site identity`, r.check.j && r.check.j.site === new URL(opts.url || 'https://e621.net/posts').hostname);
    check(`${name}: no leak`, leaks(r.check.t).length === 0, leaks(r.check.t).join(','));
  }
  // Revision-1 package (as run live) for the regressions.
  const OLD_REV = '595629e';
  const oldDerived = execFileSync('git', ['-C', path.resolve(__dirname, '../../..'), 'show', `${OLD_REV}:tests/browser/ib08/IB08_Rendition_Production_Conformance.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const BARRIER_REMOVED = (t) => mut(t, 'if (container && !container.dataset.beGalleryInit && !BE.modules.gallery.wasDisposed(container)) {', 'if (container && !container.dataset.beGalleryInit) {');
  for (const host of ['e621.net', 'e926.net']) {
    // A: live shape reproduced by revision 1 (D01 FAIL although the counts match; D02/D05/D06/D07 FAIL; residue).
    const o = await runScript({ url: `https://${host}/posts`, text: oldDerived, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    const os = statusOf(o.d2.j);
    const od = (o.d2.j.checks.find((x) => x.id === 'D01') || {}).detail || {};
    const ores = (o.d2.j.checks.find((x) => x.id === 'D07') || {}).detail || {};
    check(`regression A ${host}: revision-1 package reproduces the live dispose shape (D01 FAIL with writes == expected; D02/D05/D06/D07 FAIL; D03/D04/D08/D09 PASS; residue > 0)`,
      os.D01 === 'FAIL' && od.disposeWrites === od.expected && ['D02', 'D05', 'D06', 'D07'].every((k) => os[k] === 'FAIL') && ['D03', 'D04', 'D08', 'D09'].every((k) => os[k] === 'PASS') && ores.residue > 0, JSON.stringify([os, od, ores]));
    // A: corrected production - dispose stays terminal past the debounce; every D check PASS.
    const r = await runScript({ url: `https://${host}/posts`, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    const st = statusOf(r.d2.j);
    const d10 = (r.d2.j.checks.find((x) => x.id === 'D10') || {}).detail || {};
    check(`${host} dispose test past the debounce on the corrected production: every D check PASS, no re-enhanced card`,
      Object.keys(st).length === 11 && Object.values(st).every((x) => x === 'PASS') && d10.afterDispose.galleryInitCalls === 0 && d10.afterDispose.ownersCreated === 0 && d10.afterDispose.actionBarsAdded === 0 && d10.afterDispose.signatureWrites === 0 && d10.staleState.cardsWithEnhancerClass === 0, JSON.stringify([st, d10]));
    // Second live run shape: site class touch -> revision 2 FAILs D10 on stale class; revision 3 PASSes and reports it as stale state.
    const REV2 = execFileSync('git', ['-C', path.resolve(__dirname, '../../..'), 'show', '87362a6:tests/browser/ib08/IB08_Rendition_Production_Conformance.user.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const r2t = await runScript({ url: `https://${host}/posts`, text: REV2, nativeActions: SITE_CLASS_TOUCH, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    const r2s = statusOf(r2t.d2.j); const r2d = (r2t.d2.j.checks.find((x) => x.id === 'D10') || {}).detail || {};
    check(`regression D10 ${host}: revision-2 package reproduces the second live shape (D10 FAIL only; 0 signature and card-media writes; reenhancedCards > 0)`,
      r2s.D10 === 'FAIL' && Object.entries(r2s).filter(([k]) => k !== 'D10').every(([, v]) => v === 'PASS') && r2d.afterDisposeSignatureWrites === 0 && r2d.afterDisposeCardMediaWrites === 0 && r2d.reenhancedCards > 0, JSON.stringify([r2s, r2d]));
    const r3t = await runScript({ url: `https://${host}/posts`, nativeActions: SITE_CLASS_TOUCH, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    const r3s = statusOf(r3t.d2.j); const r3d = (r3t.d2.j.checks.find((x) => x.id === 'D10') || {}).detail || {};
    check(`${host} revision 3 with a site class touch: every D check PASS; stale enhancer class reported, all on site-touched cards; zero re-enhancement indicators`,
      Object.values(r3s).every((x) => x === 'PASS') && r3d.staleState.cardsWithEnhancerClass > 0 && r3d.staleState.ofWhichSiteTouchedClass === r3d.staleState.cardsWithEnhancerClass
      && r3d.staleState.classMutationCategories.UNCHANGED_REWRITE > 0 && r3d.afterDispose.galleryInitCalls === 0 && r3d.afterDispose.ownersCreated === 0 && r3d.afterDispose.actionBarsAdded === 0, JSON.stringify([r3s, r3d]));
    check(`${host} revision 3 site class touch: no leak`, leaks(r3t.d1.t + r3t.d2.t).length === 0);
    // Fault: production with the barrier removed (the a0f3041 behavior) must fail D10 with the same attribution as live.
    const fb = await runScript({ url: `https://${host}/posts`, text: BARRIER_REMOVED(derived), steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    const fs2 = statusOf(fb.d2.j);
    const fbd = (fb.d2.j.checks.find((x) => x.id === 'D10') || {}).detail || {};
    check(`fault ${host} disposed-container barrier removed: caught by D10 via direct indicators (init call, new owners, action bars, signature writes), D01 still PASS`,
      fs2.D10 === 'FAIL' && ['D02', 'D05', 'D06', 'D07'].every((k) => fs2[k] === 'FAIL') && fs2.D01 === 'PASS'
      && fbd.afterDispose.galleryInitCalls > 0 && fbd.afterDispose.ownersCreated > 0 && fbd.afterDispose.actionBarsAdded > 0 && fbd.afterDispose.signatureWrites > 0, JSON.stringify([fs2, fbd]));
    check(`${host} dispose test: no leak`, leaks(r.d1.t + r.d2.t).length === 0);
    // Immediately after dispose (before the debounce) everything is restored: the owner restoration itself is correct.
    const q = await runScript({ url: `https://${host}/posts`, steps: ['check', 'd1', 'narrow', 'd2'] });
    const qs = statusOf(q.d2.j);
    check(`${host} dispose test before the debounce fires: every D check PASS (owner restoration correct)`, Object.keys(qs).length === 11 && Object.values(qs).every((x) => x === 'PASS'), JSON.stringify(qs));
    const r2 = await runScript({ url: `https://${host}/posts`, steps: ['check', 'd1', 'd2'] });
    check(`${host} dispose test without narrowing: D08 FAIL`, statusOf(r2.d2.j).D08 === 'FAIL');
    const r3 = await runScript({ url: `https://${host}/posts`, anon: 'false', steps: ['d1'] });
    check(`${host} dispose test refused when logged in (no simulation, no dispose)`, r3.d1.j && /Needs a logged-out/.test(r3.d1.j.error || ''));
  }
  // B: file/sample alias under original.
  for (const host of ['e621.net', 'e926.net']) {
    const oldB = await runScript({ url: `https://${host}/posts`, quality: 'original', alias: true, text: oldDerived });
    check(`regression B ${host}: revision-1 package fails P09 on a file==sample alias card (live e926 O shape)`, statusOf(oldB.check.j).P09 === 'FAIL', JSON.stringify(statusOf(oldB.check.j)));
    const b = await runScript({ url: `https://${host}/posts`, quality: 'original', alias: true });
    const p09 = (b.check.j.checks.find((x) => x.id === 'P09') || {}).detail || {};
    check(`${host} original with an alias card: every check PASS; alias recorded as equality facts only`, Object.values(statusOf(b.check.j)).every((x) => x === 'PASS') && p09.sampledAliased === 1 && p09.fileEqualsSampleCards === 1, JSON.stringify([statusOf(b.check.j), p09]));
    check(`${host} alias scenario: no leak`, leaks(b.check.t).length === 0);
  }
  // C: native and enhancer-UI writes off the cards on a logged-in page.
  for (const host of ['e621.net', 'e926.net']) {
    const oldC = await runScript({ url: `https://${host}/posts`, anon: 'false', text: oldDerived, nativeActions: OFF_CARD_WRITES });
    check(`regression C ${host}: revision-1 package counts off-card writes as unexplained and fails P06 (live e926 L shape)`, statusOf(oldC.check.j).P06 === 'FAIL', JSON.stringify(statusOf(oldC.check.j)));
    const c = await runScript({ url: `https://${host}/posts`, anon: 'false', nativeActions: OFF_CARD_WRITES });
    const p06 = (c.check.j.checks.find((x) => x.id === 'P06') || {}).detail || {};
    const regions = Object.keys(p06.offCardWritesByRegion || {});
    check(`${host} logged in with off-card writes: P06 PASS and writes attributed by region (native pre-existing, late native, enhancer UI)`,
      statusOf(c.check.j).P06 === 'PASS' && p06.strayEnhancerSignatureWrites === 0 && ['NATIVE_PREEXISTING:img.src', 'LATE_OTHER:img.src', 'ENHANCER_UI:img.src'].every((k) => regions.includes(k)), JSON.stringify(p06));
    check(`${host} C scenario: no leak`, leaks(c.check.t).length === 0);
  }
  {
    // Fault: an enhancer rendition write on a native non-card node while logged in must fail P06.
    const signatureOnNative = (w) => { OFF_CARD_WRITES(w); w.document.querySelector('#nav-avatar').setAttribute('src', w.document.querySelector('article').getAttribute('data-sample-url')); };
    const f = await runScript({ url: 'https://e926.net/posts', anon: 'false', nativeActions: signatureOnNative });
    check('fault enhancer-signature write on a native non-card node (logged in): caught by P06', statusOf(f.check.j).P06 === 'FAIL', JSON.stringify(statusOf(f.check.j)));
    // Fault: P09 back to first-label semantics must fail the alias scenario.
    const firstLabel = derived.replace("if (!rels.includes(expectedRelation[s.want])) counts.relationMismatch++;", 'if (rels[0] !== expectedRelation[s.want]) counts.relationMismatch++;');
    const g = await runScript({ url: 'https://e926.net/posts', quality: 'original', alias: true, text: firstLabel });
    check('fault P09 first-label comparison: caught on the alias card', firstLabel !== derived && statusOf(g.check.j).P09 === 'FAIL');
    // Fault: D01 judged at step 2 again, on production without the barrier, reproduces the live D01 shape.
    const lateD01 = BARRIER_REMOVED(derived).replace('dw.length === expectedDisposeWrites && disposeRun.restoredAtDispose === expectedDisposeWrites,', "dw.length === expectedDisposeWrites && dw.every((r) => r.target.getAttribute('srcset') === [...native.values()].find((n) => n.sources[0] === r.target)?.sourceAttrs[0][1]),");
    const l = await runScript({ url: 'https://e621.net/posts', text: lateD01, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    check('fault D01 judged after re-enhancement: reproduces the live D01 FAIL', lateD01 !== derived && statusOf(l.d2.j).D01 === 'FAIL');
    // Fault: with D10 disabled, re-enhancement (barrier removed) is attributed by no dispose-time check (D01 stays PASS).
    const noD10 = BARRIER_REMOVED(derived).replace('ac.galleryInit === 0 && ac.ownersCreated === 0 && ac.actionBarsAdded === 0 && signatureAfter === 0,', 'true,');
    const n = await runScript({ url: 'https://e621.net/posts', text: noD10, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    check('fault D10 disabled: the re-enhancement is then attributed by no dispose-time check (D01 stays PASS)', noD10 !== derived && statusOf(n.d2.j).D10 === 'PASS' && statusOf(n.d2.j).D01 === 'PASS');
  }

  {
    // Fault: D10 criterion reverted to the stale-class metric must false-fail on a site class touch.
    const staleMetric = derived.replace('ac.galleryInit === 0 && ac.ownersCreated === 0 && ac.actionBarsAdded === 0 && signatureAfter === 0,', 'stale.length === 0,');
    const sm = await runScript({ url: 'https://e926.net/posts', text: staleMetric, nativeActions: SITE_CLASS_TOUCH, steps: ['check', 'd1', 'narrow', 'wait', 'd2'] });
    check('fault D10 reverted to the stale-class metric: false FAIL on a site class touch (the second live shape)', staleMetric !== derived && statusOf(sm.d2.j).D10 === 'FAIL');
  }

  // Fault controls: production mutants inside the derived script.
  for (const [name, scenario, fn, targets] of FAULTS) {
    let text; try { text = fn(derived); } catch (e) { check(`fault ${name}: mutant applied`, false, e.message); continue; }
    const r = await runScript({ ...scen[scenario], text });
    const st = statusOf(r.check.j);
    const flipped = targets.filter((id) => st[id] === 'FAIL');
    check(`fault ${name}: caught by ${flipped.join('+') || 'nothing'}`, flipped.length > 0, JSON.stringify(st));
  }
  {
    const r = await runScript({ quality: 'sample', steps: ['check', 'd1', 'narrow', 'd2'], text: PM.ownerBypassed(derived) });
    const st = statusOf(r.d2.j);
    check(`fault owner bypassed on apply (dispose cannot restore): caught by ${['D01', 'D02', 'D07'].filter((id) => st[id] === 'FAIL').join('+') || 'nothing'}`, ['D02', 'D07'].some((id) => st[id] === 'FAIL'), JSON.stringify(st));
  }
  {
    const leaky = derived.replace("const leaked = [...raw].some((v) => text.includes(v)) || /https?:\\/\\//i.test(text);", 'const leaked = false;')
      .replace("return { probe: 'ib08p-rendition-conformance', site: SITE, command: 'check'", "return { leak: [...native.values()][0].sampleRaw, probe: 'ib08p-rendition-conformance', site: SITE, command: 'check'");
    const leaky2 = derived.replace("const leaked = [...raw].some((v) => text.includes(v)) || /https?:\\/\\//i.test(text);", 'const leaked = false;')
      .replace("production_body_identity: identity, counts, checks,", 'production_body_identity: identity, counts, checks, leak: [...native.values()][0].sampleRaw,');
    const r = await runScript({ text: leaky2 });
    check('fault postamble leak with guard disabled: caught by leak scan', leaky2 !== derived && leaks(r.check.t).length > 0);
    const guarded = derived.replace('production_body_identity: identity, counts, checks,', 'production_body_identity: identity, counts, checks, leak: [...native.values()][0].sampleRaw,');
    const g = await runScript({ text: guarded });
    check('guard: a leaking postamble build is BLOCKED and leak-free', guarded !== derived && g.check.j && g.check.j.sanitationGuard === 'BLOCKED' && leaks(g.check.t).length === 0);
    void leaky;
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = {
    checkpoint: 'IB08', evidence_gate: 'G-RENDITION', stage: 'P-stage e621/e926 rendition production conformance package, revision 3 (direct re-enhancement indicators in D10), built from 2765b9d; local verification',
    diagnosis_a: 'production a0f3041 failed the dispose test (gallery re-enhanced itself after dispose); the corrected production passes it past the debounce, and the barrier-removed mutant fails D10',
    production_commit: COMMIT, production_source_blob: EXPECTED_PRODUCTION_BLOB, production_body_sha256: built.bodySha,
    derived_script: path.basename(OUT), derived_script_sha256: crypto.createHash('sha256').update(derived).digest('hex'),
    currentSrc_model: 'jsdom has no image selection; modelled as the first <source> with a srcset before the <img>, else img src',
    checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })),
    failures: results.filter((x) => !x.pass),
  };
  fs.writeFileSync(path.join(__dirname, 'IB08_CONFORMANCE_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
