'use strict';
// IB11-P4 (V-D6a) permanent regression: when the viewer build throws
// synchronously during an ordinary card-click takeover, the native navigation
// is not cancelled AND the failed takeover leaves no displayed viewer shell or
// partial viewer state behind. The throw is the characterized production one:
// stored remembered volume 1.5 on a video card makes buildMedia's
// `el.volume = vol` throw IndexSizeError inside viewer.open (E0 A5). The seam
// is observed through production's own catch, which logs
// "[Gallery] viewer takeover failed before open" with the error.
//
// Every check runs on three sources:
//   repair  - the working-tree production (must PASS);
//   prior   - 48e44d9 / blob f2b46eb, the pre-P4 artifact (the V-D6a checks
//             must FAIL there: known-failure oracle);
//   mutant  - the repair with the failed-takeover cleanup removed (fault
//             control: the V-D6a checks must FAIL).
// Preservation checks must hold on all three. Favorite, Download and
// window.open are recording stubs in the test page only.
// Usage: node tests/host/ib11/p4_vd6a_takeover_safe.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const PRIOR = hh.sourceAt('48e44d9', 'f2b46eb443e153e03123742fb5d4baa4be761dd6');
const MUTANT = mustReplace(REPAIR, '\t\t\t\tif (!wasOpen) BE.modules.viewer.close();\n', '');
const VOL = { 'be:viewer:volume': '1.5' };

const BOX = { overlay: [0, 0, 1000, 845], stage: [0, 0, 1000, 800], state: [420, 388, 200, 24], link: [520, 392, 80, 16] };
async function session(source, { settings = {}, video = [] } = {}) {
  let clock = null; const calls = []; const spies = []; const logged = [];
  const fx = hh.listing('e621.net', 3);
  const c = h.load({ url: fx.url, html: fx.html, source, settings, setup: (w) => {
    clock = hh.installFakeClock(w);
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    [...w.document.querySelectorAll('article')].forEach((a, i) => { if (!video.includes(i)) return; a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); a.setAttribute('data-size', '5000000'); });
    const MP = w.HTMLMediaElement.prototype;
    for (const k of ['play', 'pause']) { const f = MP[k]; MP[k] = function (...a) { calls.push(k); return f.apply(this, a); }; }
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
    w, doc, BE, V, clock, calls, spies, art, logged,
    overlay: () => doc.querySelector('#be-viewer-overlay'),
    stage: () => doc.querySelector('.be-viewer-stage'),
    media: () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video'),
    click: async (i, init = {}) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); art(i).querySelector('img').dispatchEvent(e); await clock.advance(0); return e; },
    key: async (k, mods = {}, target = doc) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }); target.dispatchEvent(e); await clock.advance(0); return e; },
    count: (kind) => spies.filter((x) => x[0] === kind).length,
    id: () => V.currentPost && String(V.currentPost.id),
    // The characterized seam: production's takeover catch logged a synchronous IndexSizeError.
    seamThrew: () => logged.some((a) => a[0] === '[Gallery] viewer takeover failed before open' && a[1] && a[1].name === 'IndexSizeError'),
  };
  return s;
}
// A failed takeover: armed volume 1.5, ordinary click on the video card 0.
const failed = async (src, extra = {}) => { const s = await session(src, { video: [0], settings: { ...VOL, ...extra } }); const e = await s.click(0); return { s, e }; };
const noShell = (s) => s.overlay() === null || s.overlay().style.display !== 'flex';

// [name, fn, preserve]: preserve=false -> V-D6a check (must fail on prior and mutant)
const CHECKS = [
  ['P4-1 [V-D6a] synchronous build throw on an ordinary takeover (stored volume 1.5, IndexSizeError): native navigation not cancelled and no viewer overlay left displayed', async (src) => {
    const { s, e } = await failed(src); return s.seamThrew() && !e.defaultPrevented && noShell(s) && !s.V.isOpen(); }, false],
  ['P4-2 [V-D6a] no partial viewer state remains: no current post, empty stage (no media, no state text), and the late enrichment for the failed post is ignored', async (src) => {
    const { s } = await failed(src); await s.clock.advance(500);
    const st = s.stage(); return s.seamThrew() && s.V.currentPost == null && (!st || st.childElementCount === 0) && !s.V.isOpen(); }, false],
  ['P4-3 [V-D6a] the failed shell is not active: viewer keys stay inert afterwards (Escape / ArrowRight / f not prevented, no navigation, no favorite)', async (src) => {
    const { s } = await failed(src); const a = await s.key('Escape'); const b = await s.key('ArrowRight'); const c = await s.key('f');
    return s.seamThrew() && !a.defaultPrevented && !b.defaultPrevented && !c.defaultPrevented && s.count('favorite') === 0 && s.V.currentPost == null; }, false],
  ['P4-4 [preserved] successful ordinary takeover (image card): viewer opens, native navigation cancelled, media = the card file, no takeover error', async (src) => {
    const s = await session(src); const e = await s.click(0);
    return s.V.isOpen() && e.defaultPrevented && s.id() === s.art(0).getAttribute('data-id') && s.media()?.getAttribute('src') === s.art(0).getAttribute('data-file-url') && s.logged.length === 0; }, true],
  ['P4-5 [preserved] successful ordinary takeover (video card, valid stored volume 0.5): viewer opens with a video at volume 0.5, cancelled, no error', async (src) => {
    const s = await session(src, { video: [0], settings: { 'be:viewer:volume': '0.5' } }); const e = await s.click(0); const v = s.media();
    return s.V.isOpen() && e.defaultPrevented && v?.tagName === 'VIDEO' && v.volume === 0.5 && s.logged.length === 0; }, true],
  ['P4-6 [preserved] Ctrl / Meta / Shift / Alt / middle clicks stay native even with the failing state armed (no viewer, not cancelled, no build attempted)', async (src) => {
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const s = await session(src, { video: [0], settings: VOL }); const e = await s.click(0, init);
      if (s.V.isOpen() || e.defaultPrevented || s.logged.length || !noShell(s)) return false; }
    return true; }, true],
  ['P4-7 [preserved] viewer.enabled = false: ordinary click stays native (no viewer, not cancelled, no build attempted)', async (src) => {
    const s = await session(src, { video: [0], settings: { ...VOL, 'be:setting:viewer.enabled': 'false' } }); const e = await s.click(0);
    return !s.V.isOpen() && !e.defaultPrevented && s.logged.length === 0 && noShell(s); }, true],
  ['P4-8 [preserved] after a failed takeover, an ordinary click on an image card takes over normally', async (src) => {
    const { s } = await failed(src); const e = await s.click(1);
    return s.V.isOpen() && e.defaultPrevented && s.id() === s.art(1).getAttribute('data-id') && s.media()?.tagName === 'IMG'; }, true],
  ['P4-9 [out of scope, unchanged] V-D6b: an in-viewer ArrowRight onto the failing video still leaves the viewer open on it with an empty stage (not touched by P4)', async (src) => {
    const s = await session(src, { video: [1], settings: VOL }); await s.click(0); await s.key('ArrowRight'); await s.clock.advance(400);
    return s.V.isOpen() && s.id() === s.art(1).getAttribute('data-id') && !s.media(); }, true],
  ['P4-10 [preserved] V-D8: the native link is pointer-interactive and hit-tested at its centre', async (src) => {
    const s = await session(src); await s.click(0); s.media().dispatchEvent(new s.w.Event('error')); await s.clock.advance(50);
    const l = s.doc.querySelector('.be-viewer-native-fallback'); return !!l && s.w.getComputedStyle(l).pointerEvents !== 'none' && s.doc.elementFromPoint(BOX.link[0] + 40, BOX.link[1] + 8) === l; }, true],
  ['P4-11 [preserved] V-D1: a late same-post update keeps the failure state and native link', async (src) => {
    const s = await session(src); await s.click(0); s.media().dispatchEvent(new s.w.Event('error')); await s.clock.advance(50);
    s.V.updatePost({ ...s.BE.modules.gallery.getCachedPost(s.art(0).getAttribute('data-id')) }); await s.clock.advance(500);
    const st = s.doc.querySelector('.be-media-state'); return !!st && /^Media failed to load/.test(st.textContent) && !!s.doc.querySelector('.be-viewer-native-fallback'); }, true],
  ['P4-12 [preserved] V-D5: Ctrl+F / Ctrl+D run no viewer command and are not prevented; unmodified f favorites', async (src) => {
    const s = await session(src); await s.click(0); const a = await s.key('f', { ctrlKey: true }); const b = await s.key('d', { ctrlKey: true }); const n0 = s.count('favorite') + s.count('download'); const c = await s.key('f');
    return n0 === 0 && !a.defaultPrevented && !b.defaultPrevented && s.count('favorite') === 1 && c.defaultPrevented; }, true],
  ['P4-13 [preserved] close / cleanup: Escape on an open video hides the overlay, pauses and releases the video, empties the stage', async (src) => {
    const s = await session(src, { video: [0] }); await s.click(0); const v = s.media(); const p0 = s.calls.filter((x) => x === 'pause').length; await s.key('Escape');
    return !s.V.isOpen() && noShell(s) && s.calls.filter((x) => x === 'pause').length > p0 && !v.hasAttribute('src') && s.stage().childElementCount === 0 && s.V.currentPost == null; }, true],
  ['P4-14 [preserved] playback: Space plays a paused viewer video (togglePlayPause), prevented', async (src) => {
    const s = await session(src, { video: [0] }); await s.click(0); const n0 = s.calls.filter((x) => x === 'play').length; const e = await s.key(' ');
    return s.calls.filter((x) => x === 'play').length > n0 && e.defaultPrevented; }, true],
  ['P4-15 [preserved] no focus behavior: neither a successful nor a failed takeover moves focus (focus item not started)', async (src) => {
    const s = await session(src); const l = s.art(1).querySelector('a'); l.focus(); await s.click(1); const ok1 = !s.overlay().contains(s.doc.activeElement);
    const { s: f } = await failed(src); const l2 = f.art(0).querySelector('a'); l2.focus(); const before = f.doc.activeElement; await f.click(0);
    return ok1 && f.doc.activeElement === before; }, true],
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
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior 48e44d9 ${r.prior}, mutant ${r.mutant}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p4-vd6a-takeover-safe-result.json'), `${JSON.stringify({ probe: 'ib11-p4-vd6a', productionBlob: blob, prior: '48e44d9', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
