'use strict';
// IB11-P2 (V-D1) permanent regression: an established viewer media-failure
// state and its native recovery link must survive a late same-post update
// that does not change the media (the open-time enrichment arriving after the
// failure, or a duplicate/superseded delivery of the same cached post), while
// a same-post update that starts a new load is still applied.
//
// Every check runs on three sources:
//   repair    - the working-tree production (must PASS);
//   prior     - 9aeab36 / blob 039b99e, the pre-P2 artifact (the V-D1 checks
//               must FAIL there: known-failure oracle);
//   mutant    - the repair with the unconditional clearMediaState() restored
//               at the top of updatePost (fault control: must FAIL).
// Preservation checks must hold on all three. jsdom computes inherited
// pointer-events; a small layout stub plus a pointer-events-aware
// elementFromPoint() gives browser-like hit testing for the V-D8 interplay.
// Usage: node tests/host/ib11/p2_vd1_failure_durable.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const PRIOR = hh.sourceAt('9aeab36', '039b99e81fe844d864cbcc047cdca1e5b16ee1e2');
const MUTANT = mustReplace(REPAIR, '\t\t\tupdateStatus(post);\n\n\t\t\tif (!mediaEl) {', '\t\t\tupdateStatus(post);\n\t\t\tclearMediaState();\n\n\t\t\tif (!mediaEl) {');
const M = 'https://static.example';

const BOX = { overlay: [0, 0, 1000, 845], stage: [0, 0, 1000, 800], state: [420, 388, 200, 24], link: [520, 392, 80, 16] };
async function session(source, { video = [] } = {}) {
  let clock = null; const calls = [];
  const fx = hh.listing('e621.net', 3);
  const c = h.load({ url: fx.url, html: fx.html, source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w);
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    [...w.document.querySelectorAll('article')].forEach((a, i) => { if (!video.includes(i)) return; a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); a.setAttribute('data-size', '5000000'); });
    const MP = w.HTMLMediaElement.prototype;
    for (const k of ['play', 'pause', 'load']) { const f = MP[k]; MP[k] = function (...a) { calls.push(k); return f.apply(this, a); }; }
    const R = ([x, y, wd, ht]) => ({ x, y, left: x, top: y, width: wd, height: ht, right: x + wd, bottom: y + ht });
    const orig = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      const ov = w.document.querySelector('#be-viewer-overlay');
      if (!this.isConnected || !ov || ov.style.display !== 'flex') return orig.call(this);
      if (this === ov) return R(BOX.overlay);
      if (this.classList.contains('be-viewer-stage')) return R(BOX.stage);
      if (this.classList.contains('be-viewer-native-fallback')) return R(BOX.link);
      if (this.classList.contains('be-media-state')) return R(BOX.state);
      return orig.call(this);
    };
    w.document.elementFromPoint = (x, y) => {
      const hits = [...w.document.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
      const depth = (el) => { let n = 0; for (let a = el; a; a = a.parentElement) n++; return n; };
      hits.sort((a, b) => depth(b) - depth(a));
      return hits.find((el) => w.getComputedStyle(el).pointerEvents !== 'none') || w.document.body;
    };
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document; const BE = c.BE; const V = BE.modules.viewer;
  const art = (i) => doc.querySelectorAll('article')[i];
  const media = () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video');
  const s = {
    w, doc, BE, V, clock, calls, art, media,
    open: async (i) => { art(i).querySelector('img').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0); },
    key: async (k) => { doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); await clock.advance(0); },
    fail: async () => { media().dispatchEvent(new w.Event('error')); await clock.advance(50); },
    update: async (post) => { V.updatePost(post); await clock.advance(0); },
    cached: (i) => ({ ...BE.modules.gallery.getCachedPost(art(i).getAttribute('data-id')) }),
    state: () => { const st = doc.querySelector('.be-viewer-stage .be-media-state'); const l = st && st.querySelector('.be-viewer-native-fallback'); return { text: st ? st.textContent.replace(l ? l.textContent : '', '').trim() : '', link: !!l, href: l ? l.href : null }; },
    native: (i) => art(i).querySelector('a').href,
    clickAt: (x, y) => { const t = doc.elementFromPoint(x, y); const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); t.dispatchEvent(e); return { target: t, prevented: e.defaultPrevented }; },
  };
  return s;
}
const LC = [BOX.link[0] + BOX.link[2] / 2, BOX.link[1] + BOX.link[3] / 2];

// [name, fn(source) -> boolean, oracle: true = must also hold on prior/mutant (preservation), false = V-D1 check]
const CHECKS = [
  ['P2-1 [V-D1] a late same-post update with unchanged data (the open-time enrichment arriving after the failure) keeps the failure text and native link; the failed media element is unchanged', async (src) => {
    const s = await session(src); await s.open(0); const el = s.media(); await s.fail(); const b = s.state();
    await s.update(s.cached(0)); await s.clock.advance(500); const a = s.state();
    return /^Media failed to load/.test(b.text) && b.link && /^Media failed to load/.test(a.text) && a.link && a.href === s.native(0) && s.media() === el; }, false],
  ['P2-2 [V-D1] superseded same-post work: open A, move to B, back to A, A fails; two late deliveries of the same cached post for A keep the failure state and link', async (src) => {
    const s = await session(src); await s.open(0); await s.key('ArrowRight'); await s.key('ArrowLeft'); await s.fail();
    await s.update(s.cached(0)); await s.update(s.cached(0)); await s.clock.advance(500); const a = s.state();
    return s.V.currentPost.id === s.art(0).getAttribute('data-id') && /^Media failed to load/.test(a.text) && a.link; }, false],
  ['P2-3 [V-D1 + V-D8] after the late same-post update the native link is still usable: hit test at its centre = the link; a click there targets it, is not prevented and does not close the viewer', async (src) => {
    const s = await session(src); await s.open(0); await s.fail(); await s.update(s.cached(0)); await s.clock.advance(200);
    const l = s.doc.querySelector('.be-viewer-native-fallback'); if (!l) return false;
    const r = s.clickAt(...LC); await s.clock.advance(0); return s.doc.elementFromPoint(...LC) === l && r.target === l && !r.prevented && s.V.isOpen(); }, false],
  ['P2-4 [current work] a same-post update that starts a new load (new URL) is still applied after a failure: the failure state is cleared and the new source is loaded', async (src) => {
    const s = await session(src); await s.open(0); const el = s.media(); await s.fail();
    await s.update({ ...s.cached(0), originalUrl: `${M}/o/upgraded.png` }); await s.clock.advance(50);
    return s.media() === el && el.getAttribute('src') === `${M}/o/upgraded.png` && !s.state().link && s.state().text === ''; }, true],
  ['P2-5 [current work] a metadata-pending target is upgraded by its enrichment (sample -> original, in place) and the pending loading state is replaced', async (src) => {
    const s = await session(src);
    await s.clock.advance(0); s.V.open({ id: '990', previewUrl: `${M}/p/990.jpg`, sampleUrl: `${M}/s/990.jpg`, mediaType: 'image', metadataPending: true, postUrl: 'https://e621.net/posts/990' }); await s.clock.advance(250);
    const before = s.state().text; const el = s.media();
    await s.update({ id: '990', previewUrl: `${M}/p/990.jpg`, sampleUrl: `${M}/s/990.jpg`, originalUrl: `${M}/o/990.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/990' });
    return before === 'Loading media…' && s.media() === el && el.getAttribute('src') === `${M}/o/990.png` && s.state().text === ''; }, true],
  ['P2-6 [preserved] a late update for a different post is ignored (post-ID guard): target and media unchanged', async (src) => {
    const s = await session(src); await s.open(0); await s.key('ArrowRight'); const el = s.media();
    await s.update({ ...s.cached(0), originalUrl: `${M}/o/late.png` });
    return s.V.currentPost.id === s.art(1).getAttribute('data-id') && s.media() === el && el.getAttribute('src') === s.art(1).getAttribute('data-file-url'); }, true],
  ['P2-7 [preserved] image -> video type change from metadata rebuilds the element (replaceMedia path)', async (src) => {
    const s = await session(src); s.V.open({ id: '991', previewUrl: `${M}/p/991.jpg`, sampleUrl: `${M}/p/991.jpg`, mediaType: 'image', metadataPending: true }); await s.clock.advance(50);
    await s.update({ id: '991', previewUrl: `${M}/p/991.jpg`, originalUrl: `${M}/o/991.webm`, mediaType: 'video' }); await s.clock.advance(50);
    return s.media() && s.media().tagName === 'VIDEO' && s.doc.querySelectorAll('.be-viewer-stage img').length === 0; }, true],
  ['P2-8 [preserved] same-element video URL upgrade: src swapped, load() and an autoplay play() (playback behavior unchanged)', async (src) => {
    const s = await session(src); s.V.open({ id: '992', originalUrl: `${M}/o/992a.webm`, mediaType: 'video' }); await s.clock.advance(50); const v = s.media(); const n0 = s.calls.length;
    await s.update({ id: '992', originalUrl: `${M}/o/992b.webm`, mediaType: 'video' });
    const c = s.calls.slice(n0); return s.media() === v && v.getAttribute('src') === `${M}/o/992b.webm` && c.includes('load') && c.includes('play'); }, true],
  ['P2-9 [preserved] a click on the empty stage still closes the viewer, and close releases the video (pause, src removed)', async (src) => {
    const s = await session(src, { video: [0] }); await s.open(0); const v = s.media(); const r = s.clickAt(100, 100); await s.clock.advance(0);
    return r.target.classList.contains('be-viewer-stage') && !s.V.isOpen() && !v.hasAttribute('src') && s.calls.includes('pause'); }, true],
  ['P2-10 [preserved] unmodified viewer keys: ArrowRight / ArrowLeft navigate, Escape closes', async (src) => {
    const s = await session(src); await s.open(0); await s.key('ArrowRight'); const a = s.V.currentPost.id; await s.key('ArrowLeft'); const b = s.V.currentPost.id; await s.key('Escape');
    return a === s.art(1).getAttribute('data-id') && b === s.art(0).getAttribute('data-id') && !s.V.isOpen(); }, true],
  ['P2-11 [preserved] native-navigation fallback on a fresh failure (no late update): failure text and native link to the card post, link pointer-interactive (V-D8)', async (src) => {
    const s = await session(src); await s.open(0); await s.fail(); const st = s.state(); const l = s.doc.querySelector('.be-viewer-native-fallback');
    return /^Media failed to load/.test(st.text) && st.href === s.native(0) && !!l && s.w.getComputedStyle(l).pointerEvents !== 'none'; }, true],
];

async function main() {
  const results = [];
  const blob = h.gitBlobId(REPAIR);
  for (const [name, fn, preserve] of CHECKS) {
    let repair = false; let prior = null; let mutant = null; let err = null;
    try { repair = !!(await fn(REPAIR)); prior = !!(await fn(PRIOR)); mutant = !!(await fn(MUTANT)); } catch (e) { err = String(e && e.message || e); }
    const pass = !err && repair && (preserve ? prior === true && mutant === true : prior === false && mutant === false);
    results.push({ name, repair, prior, mutant, pass, err });
  }
  let failed = 0;
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior 9aeab36 ${r.prior}, mutant ${r.mutant}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p2-vd1-failure-durable-result.json'), `${JSON.stringify({ probe: 'ib11-p2-vd1', productionBlob: blob, prior: '9aeab36', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
