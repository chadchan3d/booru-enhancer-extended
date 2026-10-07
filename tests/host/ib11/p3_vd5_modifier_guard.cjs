'use strict';
// IB11-P3 (V-D5) permanent regression: while the viewer is open, Ctrl/Meta/Alt
// chords must not trigger ordinary viewer commands and must not be
// preventDefault-ed by the viewer (the browser/OS shortcut stays available);
// unmodified viewer keybinds behave exactly as before. Bindings are taken
// from production's settings defaults (keys.close Escape, keys.next
// ArrowRight, keys.prev ArrowLeft, keys.download d, keys.favorite f,
// keys.openOriginal o, keys.playPause Space) plus one custom binding.
//
// Every check runs on three sources:
//   repair  - the working-tree production (must PASS);
//   prior   - bef4437 / blob 56c495e, the pre-P3 artifact (the V-D5 checks
//             must FAIL there: known-failure oracle);
//   mutant  - the repair with the modifier guard removed (fault control: the
//             V-D5 checks must FAIL).
// Preservation checks must hold on all three. Favorite, Download and
// window.open are recording stubs in the test page only.
// Usage: node tests/host/ib11/p3_vd5_modifier_guard.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const PRIOR = hh.sourceAt('bef4437', '56c495e2c726a5a17f443d89d729fbd8f206eb46');
const MUTANT = mustReplace(REPAIR, '\t\t\tif (e.ctrlKey || e.metaKey || e.altKey) return;\n', '');

const BOX = { overlay: [0, 0, 1000, 845], stage: [0, 0, 1000, 800], state: [420, 388, 200, 24], link: [520, 392, 80, 16] };
async function session(source, { settings = {}, video = [] } = {}) {
  let clock = null; const calls = []; const spies = [];
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
  const art = (i) => doc.querySelectorAll('article')[i];
  const s = {
    w, doc, BE, V, clock, calls, spies, art,
    media: () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video'),
    open: async (i) => { art(i).querySelector('img').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0); },
    key: async (k, mods = {}, target = doc) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }); target.dispatchEvent(e); await clock.advance(0); return e; },
    count: (kind) => spies.filter((x) => x[0] === kind).length,
    id: () => V.currentPost && String(V.currentPost.id),
  };
  return s;
}
// One chord: no viewer command, not prevented, viewer still open on the same post.
const chord = (k, mods, kind) => async (src) => { const s = await session(src); await s.open(0); const id0 = s.id(); const n0 = s.count(kind); const e = await s.key(k, mods);
  return s.count(kind) === n0 && !e.defaultPrevented && s.V.isOpen() && s.id() === id0; };

// [name, fn, preserve]: preserve=false -> V-D5 check (must fail on prior and mutant)
const CHECKS = [
  ['P3-1 [V-D5] Ctrl+F: no viewer Favorite; not prevented (browser Find stays available)', chord('f', { ctrlKey: true }, 'favorite'), false],
  ['P3-2 [V-D5] Ctrl+D: no viewer Download; not prevented (browser bookmark stays available)', chord('d', { ctrlKey: true }, 'download'), false],
  ['P3-3 [V-D5] Meta+D and Meta+F: no viewer Download / Favorite; not prevented', async (src) => (await chord('d', { metaKey: true }, 'download')(src)) && (await chord('f', { metaKey: true }, 'favorite')(src)), false],
  ['P3-4 [V-D5] Alt+O and Alt+F: no viewer Open original / Favorite; not prevented', async (src) => (await chord('o', { altKey: true }, 'open')(src)) && (await chord('f', { altKey: true }, 'favorite')(src)), false],
  ['P3-5 [V-D5] Alt+ArrowLeft and Ctrl+ArrowRight: no viewer navigation; Ctrl+Escape does not close; none prevented', async (src) => {
    const s = await session(src); await s.open(1); const id0 = s.id();
    const a = await s.key('ArrowLeft', { altKey: true }); const b = await s.key('ArrowRight', { ctrlKey: true }); const c = await s.key('Escape', { ctrlKey: true });
    return s.id() === id0 && s.V.isOpen() && !a.defaultPrevented && !b.defaultPrevented && !c.defaultPrevented; }, false],
  ['P3-6 [V-D5] a customized binding (keys.favorite = g) is guarded the same way: Ctrl+G does not favorite (unmodified g does)', async (src) => {
    const s = await session(src, { settings: { 'be:setting:keys.favorite': '"g"' } }); await s.open(0);
    const e1 = await s.key('g', { ctrlKey: true }); const n1 = s.count('favorite'); const e2 = await s.key('g'); const n2 = s.count('favorite');
    return n1 === 0 && !e1.defaultPrevented && n2 === 1 && e2.defaultPrevented; }, false],
  ['P3-7 [preserved] unmodified f -> Favorite once, prevented', async (src) => { const s = await session(src); await s.open(0); const e = await s.key('f'); return s.count('favorite') === 1 && e.defaultPrevented; }, true],
  ['P3-8 [preserved] unmodified d -> Download once, prevented', async (src) => { const s = await session(src); await s.open(0); const e = await s.key('d'); return s.count('download') === 1 && e.defaultPrevented; }, true],
  ['P3-9 [preserved] unmodified o -> Open original once, prevented', async (src) => { const s = await session(src); await s.open(0); const e = await s.key('o'); return s.count('open') === 1 && e.defaultPrevented; }, true],
  ['P3-10 [preserved] ArrowRight / ArrowLeft navigate, Escape closes; all prevented', async (src) => {
    const s = await session(src); await s.open(0); const a = await s.key('ArrowRight'); const i1 = s.id(); const b = await s.key('ArrowLeft'); const i0 = s.id(); const c = await s.key('Escape');
    return i1 === s.art(1).getAttribute('data-id') && i0 === s.art(0).getAttribute('data-id') && !s.V.isOpen() && a.defaultPrevented && b.defaultPrevented && c.defaultPrevented; }, true],
  ['P3-11 [preserved] Space plays a paused viewer video (togglePlayPause), prevented', async (src) => {
    const s = await session(src, { video: [0] }); await s.open(0); const n0 = s.calls.filter((x) => x === 'play').length; const e = await s.key(' ');
    return s.calls.filter((x) => x === 'play').length > n0 && e.defaultPrevented; }, true],
  ['P3-12 [preserved] Shift unchanged: Shift+ArrowRight still navigates; Shift+F (key "F") matches no binding', async (src) => {
    const s = await session(src); await s.open(0); await s.key('ArrowRight', { shiftKey: true }); const nav = s.id() === s.art(1).getAttribute('data-id');
    const e = await s.key('F', { shiftKey: true }); return nav && s.count('favorite') === 0 && !e.defaultPrevented; }, true],
  ['P3-13 [preserved] keys are inert while the viewer is closed (not prevented, no action)', async (src) => {
    const s = await session(src); await s.open(0); await s.key('Escape'); const e1 = await s.key('f'); const e2 = await s.key('f', { ctrlKey: true });
    return s.count('favorite') === 0 && !e1.defaultPrevented && !e2.defaultPrevented; }, true],
  ['P3-14 [preserved] V-D1: a late same-post update keeps the failure state and native link', async (src) => {
    const s = await session(src); await s.open(0); s.media().dispatchEvent(new s.w.Event('error')); await s.clock.advance(50);
    s.V.updatePost({ ...s.BE.modules.gallery.getCachedPost(s.art(0).getAttribute('data-id')) }); await s.clock.advance(500);
    const st = s.doc.querySelector('.be-media-state'); return !!st && /^Media failed to load/.test(st.textContent) && !!s.doc.querySelector('.be-viewer-native-fallback'); }, true],
  ['P3-15 [preserved] V-D8: the native link is pointer-interactive and hit-tested at its centre', async (src) => {
    const s = await session(src); await s.open(0); s.media().dispatchEvent(new s.w.Event('error')); await s.clock.advance(50);
    const l = s.doc.querySelector('.be-viewer-native-fallback'); return !!l && s.w.getComputedStyle(l).pointerEvents !== 'none' && s.doc.elementFromPoint(BOX.link[0] + 40, BOX.link[1] + 8) === l; }, true],
  ['P3-16 [preserved] no focus change: opening the viewer does not move focus into it (focus item not started)', async (src) => {
    const s = await session(src); const l = s.art(0).querySelector('a'); l.focus(); await s.open(0); const ov = s.doc.querySelector('#be-viewer-overlay'); return !ov.contains(s.doc.activeElement); }, true],
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
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior bef4437 ${r.prior}, mutant ${r.mutant}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p3-vd5-modifier-guard-result.json'), `${JSON.stringify({ probe: 'ib11-p3-vd5', productionBlob: blob, prior: 'bef4437', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
