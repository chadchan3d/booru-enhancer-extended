'use strict';
// IB11-P5 (V-D6b) permanent regression: when the media build throws
// synchronously during navigation INSIDE an already-open viewer, the viewer
// stays open on the failing target and communicates the failure (failure text
// plus the target's native-post link), with no partial or resurrected media.
// The throw is the characterized production one: the viewer is open on an
// image, the stored remembered volume is 1.5, and ArrowRight moves to a video
// card, so buildMedia's `el.volume = vol` throws IndexSizeError (E0 A6). The
// seam is observed by wrapping the media `volume` setter in the test page and
// recording throws whose stack passes through buildMedia (production is not
// modified by the test).
//
// Every check runs on three sources:
//   repair  - the working-tree production (must PASS);
//   prior   - fe1e06b / blob f232863, the pre-P5 artifact (the V-D6b checks
//             must FAIL there: known-failure oracle);
//   mutant  - the repair with the in-viewer failure handling bypassed (the
//             build error is rethrown as before; fault control: the V-D6b
//             checks must FAIL).
// Preservation checks must hold on all three. Favorite, Download and
// window.open are recording stubs in the test page only.
// Usage: node tests/host/ib11/p5_vd6b_inviewer_failure.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const PRIOR = hh.sourceAt('fe1e06b', 'f2328634aac5d4c597361699f71155f0eb11ac17');
const MUTANT = mustReplace(REPAIR, '\t\t\t\tif (rethrowBuildError) throw err;\n', '\t\t\t\tthrow err;\n');
const VOL = { 'be:viewer:volume': '1.5' };

const BOX = { overlay: [0, 0, 1000, 845], stage: [0, 0, 1000, 800], state: [420, 388, 200, 24], link: [520, 392, 80, 16] };
async function session(source, { settings = {}, video = [] } = {}) {
  let clock = null; const calls = []; const spies = []; const logged = []; const seam = [];
  const fx = hh.listing('e621.net', 3);
  const c = h.load({ url: fx.url, html: fx.html, source, settings, setup: (w) => {
    clock = hh.installFakeClock(w);
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    [...w.document.querySelectorAll('article')].forEach((a, i) => { if (!video.includes(i)) return; a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); a.setAttribute('data-size', '5000000'); });
    const MP = w.HTMLMediaElement.prototype;
    for (const k of ['play', 'pause']) { const f = MP[k]; MP[k] = function (...a) { calls.push(k); return f.apply(this, a); }; }
    // Seam recorder: the production volume assignment, observed (not changed).
    const vd = Object.getOwnPropertyDescriptor(MP, 'volume');
    Object.defineProperty(MP, 'volume', { configurable: true, enumerable: vd.enumerable, get: vd.get,
      set(v) { try { vd.set.call(this, v); } catch (e) { seam.push({ name: e && e.name, value: Number(v), fromBuildMedia: String(new Error().stack).includes('buildMedia') }); throw e; } } });
    w.open = (u) => { spies.push(['open', String(u)]); return null; };
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
  BE.modules.favorites.toggle = (p) => { spies.push(['favorite', p && String(p.id)]); };
  BE.modules.downloader.downloadPost = (p) => { spies.push(['download', p && String(p.id)]); };
  const le = BE.log.error; BE.log.error = (...a) => { logged.push(a); try { return le.apply(BE.log, a); } catch { return undefined; } };
  const art = (i) => doc.querySelectorAll('article')[i];
  const s = {
    w, doc, BE, V, clock, calls, spies, art, logged, seam,
    overlay: () => doc.querySelector('#be-viewer-overlay'),
    stage: () => doc.querySelector('.be-viewer-stage'),
    media: () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video'),
    mediaCount: () => doc.querySelectorAll('#be-viewer-overlay img, #be-viewer-overlay video').length,
    state: () => { const st = doc.querySelector('.be-viewer-stage .be-media-state'); return st ? st.textContent : null; },
    link: () => doc.querySelector('.be-viewer-stage .be-viewer-native-fallback'),
    status: () => (doc.querySelector('.be-viewer-status') || {}).textContent || '',
    click: async (i, init = {}) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); art(i).querySelector('img').dispatchEvent(e); await clock.advance(0); return e; },
    // Keys are dispatched as in a page: an exception thrown by a listener is reported, not rethrown to the dispatcher.
    key: async (k, mods = {}, target = doc) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }); target.dispatchEvent(e); await clock.advance(0); return e; },
    count: (kind) => spies.filter((x) => x[0] === kind).length,
    id: () => V.currentPost && String(V.currentPost.id),
    cardId: (i) => art(i).getAttribute('data-id'),
    seamThrew: () => seam.some((x) => x.name === 'IndexSizeError' && x.value === 1.5 && x.fromBuildMedia),
  };
  return s;
}
// Valid open image (card 0), then in-viewer ArrowRight onto the video card 1 with volume 1.5 armed.
const failedNav = async (src) => {
  const s = await session(src, { video: [1], settings: VOL }); await s.click(0);
  const start = { open: s.V.isOpen(), id: s.id(), tag: s.media() && s.media().tagName, src: s.media() && s.media().getAttribute('src'), state: s.state() };
  const startOk = start.open && start.id === s.cardId(0) && start.tag === 'IMG' && start.src === s.art(0).getAttribute('data-file-url') && start.state === null && s.seam.length === 0;
  const oldMedia = s.media();
  await s.key('ArrowRight'); await s.clock.advance(400);
  return { s, startOk, oldMedia };
};
const failedOk = (s) => s.seamThrew() && s.V.isOpen() && s.id() === s.cardId(1);
const nativeOf = (s, i) => new URL(s.art(i).querySelector('a').getAttribute('href'), s.w.location.href).href;

// [name, fn, preserve]: preserve=false -> V-D6b check (must fail on prior and mutant)
const CHECKS = [
  ['P5-1 [V-D6b] valid open image -> in-viewer ArrowRight onto the video target; the buildMedia volume seam throws IndexSizeError (1.5); the viewer stays open on the failing target and shows "Media failed to load" (not a blank stage)', async (src) => {
    const { s, startOk } = await failedNav(src); return startOk && failedOk(s) && /^Media failed to load/.test(s.state() || ''); }, false],
  ['P5-2 [V-D6b] the failure carries the failing target\'s native-post link, pointer-interactive and hit-tested at its centre (V-D8 semantics)', async (src) => {
    const { s } = await failedNav(src); const l = s.link();
    return failedOk(s) && !!l && l.href === nativeOf(s, 1) && s.w.getComputedStyle(l).pointerEvents !== 'none' && s.doc.elementFromPoint(BOX.link[0] + 40, BOX.link[1] + 8) === l; }, false],
  ['P5-3 [V-D6b] coherent viewer: no partial or resurrected media (no img/video in the viewer; the previous image detached), and the status names the failing target', async (src) => {
    const { s, oldMedia } = await failedNav(src);
    return failedOk(s) && s.mediaCount() === 0 && !!oldMedia && !oldMedia.isConnected && s.status().startsWith(`#${s.cardId(1)}`) && !!s.state(); }, false],
  ['P5-4 [V-D6b] the communicated failure is durable: a late same-post update for the failing target keeps the failure text and native link (no blank)', async (src) => {
    const { s } = await failedNav(src);
    // As production delivers it: enrichSinglePost(...).then(updatePost).catch(log) absorbs a throw.
    try { s.V.updatePost({ ...s.BE.modules.gallery.getCachedPost(s.cardId(1)) }); } catch { /* the enrichment chain's catch */ }
    await s.clock.advance(500);
    return failedOk(s) && /^Media failed to load/.test(s.state() || '') && !!s.link() && s.link().href === nativeOf(s, 1) && s.mediaCount() === 0; }, false],
  ['P5-5 [preserved] after the in-viewer failure the viewer stays operable: ArrowLeft navigates back to the image (shown, no failure state) and Escape closes and cleans up', async (src) => {
    const { s } = await failedNav(src); const e = await s.key('ArrowLeft'); await s.clock.advance(50);
    const back = s.id() === s.cardId(0) && s.media()?.tagName === 'IMG' && s.state() === null && e.defaultPrevented;
    await s.key('Escape'); return back && !s.V.isOpen() && s.V.currentPost == null && s.stage().childElementCount === 0; }, true],
  ['P5-6 [preserved] successful in-viewer navigation (image -> image -> back) unchanged: media follows the target, no state, no build error', async (src) => {
    const s = await session(src); await s.click(0); await s.key('ArrowRight'); const a = s.id() === s.cardId(1) && s.media()?.getAttribute('src') === s.art(1).getAttribute('data-file-url');
    await s.key('ArrowLeft'); return a && s.id() === s.cardId(0) && s.media()?.getAttribute('src') === s.art(0).getAttribute('data-file-url') && s.state() === null && s.seam.length === 0 && s.logged.length === 0; }, true],
  ['P5-7 [preserved] successful in-viewer navigation onto a video (valid stored volume 0.5): a video at volume 0.5, no build error', async (src) => {
    const s = await session(src, { video: [1], settings: { 'be:viewer:volume': '0.5' } }); await s.click(0); await s.key('ArrowRight');
    const v = s.media(); return s.id() === s.cardId(1) && v?.tagName === 'VIDEO' && v.volume === 0.5 && s.seam.length === 0 && s.logged.length === 0; }, true],
  ['P5-8 [preserved] P4 / V-D6a: a failed takeover from a closed viewer still abandons the shell (seam threw; navigation not cancelled; overlay not displayed; no current post; no in-viewer failure state)', async (src) => {
    const s = await session(src, { video: [0], settings: VOL }); const e = await s.click(0);
    return s.seamThrew() && !e.defaultPrevented && !s.V.isOpen() && s.V.currentPost == null && s.state() === null && s.logged.some((a) => a[0] === '[Gallery] viewer takeover failed before open'); }, true],
  ['P5-9 [preserved] successful takeover: image and video cards open, navigation cancelled; modifier and viewer.enabled=false clicks stay native', async (src) => {
    const a = await session(src); const e1 = await a.click(0); const ok1 = a.V.isOpen() && e1.defaultPrevented && a.media()?.tagName === 'IMG';
    const b = await session(src, { video: [0] }); const e2 = await b.click(0); const ok2 = b.V.isOpen() && e2.defaultPrevented && b.media()?.tagName === 'VIDEO';
    const c = await session(src); const e3 = await c.click(0, { ctrlKey: true }); const d = await session(src, { settings: { 'be:setting:viewer.enabled': 'false' } }); const e4 = await d.click(0);
    return ok1 && ok2 && !c.V.isOpen() && !e3.defaultPrevented && !d.V.isOpen() && !e4.defaultPrevented; }, true],
  ['P5-10 [preserved] P1 / V-D8: a load failure shows the native link, pointer-interactive and hit-tested', async (src) => {
    const s = await session(src); await s.click(0); s.media().dispatchEvent(new s.w.Event('error')); await s.clock.advance(50);
    const l = s.link(); return !!l && s.w.getComputedStyle(l).pointerEvents !== 'none' && s.doc.elementFromPoint(BOX.link[0] + 40, BOX.link[1] + 8) === l; }, true],
  ['P5-11 [preserved] P2 / V-D1: a late same-post update keeps an established load-failure state and native link', async (src) => {
    const s = await session(src); await s.click(0); s.media().dispatchEvent(new s.w.Event('error')); await s.clock.advance(50);
    s.V.updatePost({ ...s.BE.modules.gallery.getCachedPost(s.cardId(0)) }); await s.clock.advance(500);
    return /^Media failed to load/.test(s.state() || '') && !!s.link(); }, true],
  ['P5-12 [preserved] P3 / V-D5: Ctrl+F / Ctrl+D inert and not prevented; unmodified f favorites', async (src) => {
    const s = await session(src); await s.click(0); const a = await s.key('f', { ctrlKey: true }); const b = await s.key('d', { ctrlKey: true }); const n0 = s.count('favorite') + s.count('download'); const c = await s.key('f');
    return n0 === 0 && !a.defaultPrevented && !b.defaultPrevented && s.count('favorite') === 1 && c.defaultPrevented; }, true],
  ['P5-13 [preserved] close / cleanup: Escape on an open video hides the overlay, pauses and releases the video, empties the stage', async (src) => {
    const s = await session(src, { video: [0] }); await s.click(0); const v = s.media(); const p0 = s.calls.filter((x) => x === 'pause').length; await s.key('Escape');
    return !s.V.isOpen() && s.calls.filter((x) => x === 'pause').length > p0 && !v.hasAttribute('src') && s.stage().childElementCount === 0 && s.V.currentPost == null; }, true],
  ['P5-14 [preserved] playback: Space plays a paused viewer video (togglePlayPause), prevented', async (src) => {
    const s = await session(src, { video: [0] }); await s.click(0); const n0 = s.calls.filter((x) => x === 'play').length; const e = await s.key(' ');
    return s.calls.filter((x) => x === 'play').length > n0 && e.defaultPrevented; }, true],
  ['P5-15 [preserved] no focus behavior: opening, and the in-viewer failure, move no focus (focus item not started)', async (src) => {
    const s = await session(src, { video: [1], settings: VOL }); const l = s.art(0).querySelector('a'); l.focus(); await s.click(0); const ok1 = !s.overlay().contains(s.doc.activeElement);
    const before = s.doc.activeElement; await s.key('ArrowRight'); await s.clock.advance(50); return ok1 && s.doc.activeElement === before; }, true],
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
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior fe1e06b ${r.prior}, mutant ${r.mutant}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p5-vd6b-inviewer-failure-result.json'), `${JSON.stringify({ probe: 'ib11-p5-vd6b', productionBlob: blob, prior: 'fe1e06b', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
