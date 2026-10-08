'use strict';
// IB11-P7 (V-D7) permanent regression: an image target with a distinct lower
// rendition (sample, else preview) opens on that placeholder; once it is shown,
// the original is requested IN PLACE and the placeholder stays displayed until
// the original is ready (the browser keeps the current image while a new src
// is pending, then switches and fires load in one task). At the upgrade the
// apparent on-screen view is kept: the zoom is rescaled so the original
// occupies the placeholder's rendered size; pan, rotation, flips and the
// manual/fit mode are kept; configured Fit is NOT invoked. A failed original
// restores the placeholder and shows the failure with the native link. Stale
// readiness (closed viewer, other target) is ignored.
//
// The harness models image loading: an <img>'s displayed (natural) size is
// its current image, which changes only when the test completes a load
// (finish) or a failure (fail), as in the browser's pending-request rule.
// Apparent geometry = displayed size x zoom, exchanged at odd quarter turns;
// pan = the translate() offset.
//
// Sources: repair (working tree, must PASS everything); prior 39a5ae1 / blob
// 0a7f57f (pre-P7); mutant NO-PLACEHOLDER (direct-original restored); mutant
// RAW-ZOOM (the upgrade keeps the raw numeric zoom: the apparent-size jump).
// Each V-D7 check states which sources must FAIL it; preservation checks
// must hold on all four.
// Usage: node tests/host/ib11/p7_vd7_staged_placeholder.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const SOURCES = {
  repair: REPAIR,
  prior: hh.sourceAt('39a5ae1', '0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6'),
  noPlaceholder: mustReplace(REPAIR, "\t\t\tif (!post?.originalUrl || fullUrl !== post.originalUrl) return '';\n", "\t\t\treturn '';\n"),
  rawZoom: mustReplace(REPAIR, '\t\t\tif (pw > 0 && ph > 0 && fw > 0 && fh > 0) zoom *= Math.min(pw / fw, ph / fh);\n', ''),
};
const M = 'https://static.example';
const vset = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`be:setting:viewer.${k}`, JSON.stringify(v)]));
const CARD = [1448, 2048]; const SAMPLE = [724, 1024]; const LINK_BOX = [520, 392, 80, 16];

async function session(source, { settings = {}, video = [] } = {}) {
  let clock = null; const st = { stageW: 1000, stageH: 800 }; const calls = []; const spies = []; const logged = [];
  const fx = hh.listing('e621.net', 3);
  const c = h.load({ url: fx.url, html: fx.html, source, settings, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.Element.prototype.setPointerCapture = function () {};
    [...w.document.querySelectorAll('article')].forEach((a, i) => { if (!video.includes(i)) return; a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); a.setAttribute('data-size', '5000000'); });
    const R = ([x, y, wd, ht]) => ({ x, y, left: x, top: y, width: wd, height: ht, right: x + wd, bottom: y + ht });
    const gbr = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList && this.classList.contains('be-viewer-stage')) return R([0, 0, st.stageW, st.stageH]);
      const ov = w.document.querySelector('#be-viewer-overlay');
      if (this.isConnected && ov && ov.style.display === 'flex') {
        if (this.classList.contains('be-viewer-native-fallback')) return R(LINK_BOX);
        if (this.classList.contains('be-media-state')) return R([420, 388, 200, 24]);
      }
      return gbr.call(this);
    };
    // hit testing as the browser does it: deepest box at the point that is pointer-interactive
    w.document.elementFromPoint = (x, y) => {
      const hits = [...w.document.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
      const depth = (el) => { let n = 0; for (let q = el; q; q = q.parentElement) n++; return n; };
      hits.sort((p, q) => depth(q) - depth(p));
      return hits.find((el) => w.getComputedStyle(el).pointerEvents !== 'none') || w.document.body;
    };
    // Displayed (current-request) size: changes only when a load completes.
    for (const [P, wk, hk] of [[w.HTMLImageElement.prototype, 'naturalWidth', 'naturalHeight'], [w.HTMLVideoElement.prototype, 'videoWidth', 'videoHeight']]) {
      Object.defineProperty(P, wk, { configurable: true, get() { return this.__cur ? this.__cur[0] : 0; } });
      Object.defineProperty(P, hk, { configurable: true, get() { return this.__cur ? this.__cur[1] : 0; } });
    }
    const MP = w.HTMLMediaElement.prototype;
    MP.play = function () { calls.push('play'); return Promise.resolve(); }; MP.pause = function () { calls.push('pause'); }; MP.load = function () {};
    w.open = (u) => { spies.push(['open', String(u)]); return null; };
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document; const BE = c.BE; const V = BE.modules.viewer;
  BE.modules.favorites.toggle = (p) => { spies.push(['favorite', p && String(p.id)]); };
  const le = BE.log.error; BE.log.error = (...a) => { logged.push(a); try { return le.apply(BE.log, a); } catch { return undefined; } };
  const media = () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video');
  const art = (i) => doc.querySelectorAll('article')[i];
  const a = {
    w, doc, BE, V, st, calls, spies, logged, art, media,
    wait: (ms) => clock.advance(ms),
    cardId: (i) => art(i).getAttribute('data-id'),
    file: (i) => art(i).getAttribute('data-file-url'),
    sample: (i) => art(i).getAttribute('data-sample-url'),
    post: (i) => `https://e621.net/posts/${art(i).getAttribute('data-id')}`,
    click: async (i, init = {}) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); art(i).querySelector('img').dispatchEvent(e); await clock.advance(0); return e; },
    key: async (k, mods = {}) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }); doc.dispatchEvent(e); await clock.advance(0); return e; },
    btn: async (title) => { [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith(title)).click(); await clock.advance(0); },
    resize: async (wd, ht) => { st.stageW = wd; st.stageH = ht; w.dispatchEvent(new w.Event('resize')); await clock.advance(150); },
    // complete the element's pending load at the given size / fail it (current image becomes broken)
    finish: async (el, dims) => { el.__cur = dims; el.dispatchEvent(new w.Event(el.tagName === 'VIDEO' ? 'loadeddata' : 'load')); await clock.advance(0); },
    fail: async (el) => { el.__cur = null; el.dispatchEvent(new w.Event('error')); await clock.advance(0); },
    drag: async (dx, dy) => { const el = media(); el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); el.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 100 + dx, clientY: 100 + dy })); el.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true })); await clock.advance(0); },
    stateText: () => { const s = doc.querySelector('.be-viewer-stage .be-media-state'); return s ? s.textContent : null; },
    link: () => doc.querySelector('.be-viewer-stage .be-viewer-native-fallback'),
    id: () => V.currentPost && String(V.currentPost.id),
    tf: () => { const s = media()?.style.transform || ''; const g = (re) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
      return { tx: g(/translate\((-?[\d.]+)px/), ty: g(/translate\(-?[\d.]+px, (-?[\d.]+)px/), scale: g(/ scale\((-?[\d.]+)\)/), rot: g(/rotate\((-?[\d.]+)deg\)/), fx: g(/scaleX\((-?[\d.]+)\)/), fy: g(/scaleY\((-?[\d.]+)\)/) }; },
  };
  // apparent (rendered) footprint of the displayed image
  a.view = () => { const el = media(); const t = a.tf(); if (!el || !el.__cur || t.scale === null) return null; const odd = Math.abs(Math.round((t.rot || 0) / 90)) % 2 === 1;
    const [nw, nh] = el.__cur; return { w: (odd ? nh : nw) * t.scale, h: (odd ? nw : nh) * t.scale, tx: t.tx, ty: t.ty, rot: t.rot, fx: t.fx, fy: t.fy, scale: t.scale }; };
  return a;
}
const near = (x, y, tol = 1e-6) => typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) <= tol;
const sameView = (b, f) => !!b && !!f && near(b.w, f.w) && near(b.h, f.h) && b.tx === f.tx && b.ty === f.ty && b.rot === f.rot && b.fx === f.fx && b.fy === f.fy;
const fitBoth = ([nw, nh], [sw, sh]) => Math.min((sw - 24) / nw, (sh - 24) / nh);

// Open card 0 (a cached e621 image post with a distinct sample) and show its placeholder.
async function staged(src, opts = {}) {
  const a = await session(src, opts); await a.click(0); const el = a.media();
  const atOpen = { src: el && el.getAttribute('src'), id: a.id(), n: a.doc.querySelectorAll('.be-viewer-stage img, .be-viewer-stage video').length };
  const placeholderFirst = atOpen.src === a.sample(0) && atOpen.id === a.cardId(0) && atOpen.n === 1;
  await a.finish(el, SAMPLE);
  return { a, el, placeholderFirst };
}

// [name, fn, expected-per-source]; expected false = must fail there. P = preservation (true everywhere).
const P = { prior: true, noPlaceholder: true, rawZoom: true };
const STAGE = { prior: false, noPlaceholder: false, rawZoom: true };
const VIEW_STAGED = { prior: false, noPlaceholder: false, rawZoom: false };
const VIEW_UPDATE = { prior: false, noPlaceholder: true, rawZoom: false };
const CHECKS = [
  ['P7-1 [V-D7 staging] a card click opens on the selected target\'s distinct sample (not the original, not another post); one media element; viewer on the target', async (src) => {
    const a = await session(src); await a.click(0); const el = a.media();
    return !!el && el.getAttribute('src') === a.sample(0) && el.getAttribute('src') !== a.file(0) && a.id() === a.cardId(0) && a.V.isOpen() && a.doc.querySelectorAll('.be-viewer-stage img, .be-viewer-stage video').length === 1; }, STAGE],
  ['P7-2 [V-D7 staging] once the placeholder is shown the original is requested in place; the placeholder stays displayed (not presented as ready early); no state; target unchanged', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); await a.wait(400);
    return placeholderFirst && a.media() === el && el.getAttribute('src') === a.file(0) && el.naturalWidth === SAMPLE[0] && a.stateText() === null && a.id() === a.cardId(0) && near(a.tf().scale, fitBoth(SAMPLE, [1000, 800])); }, STAGE],
  ['P7-3 [V-D7 view] non-manual upgrade: the original replaces the placeholder on the same element with the same apparent size and position (no blank, no jump); target unchanged', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); const before = a.view(); await a.finish(el, CARD); const after = a.view();
    return placeholderFirst && a.media() === el && sameView(before, after) && near(after.scale, before.scale * SAMPLE[0] / CARD[0]) && a.id() === a.cardId(0) && a.stateText() === null; }, VIEW_STAGED],
  ['P7-4 [V-D7 view] no configured refit at the upgrade: with the stage changed silently (no resize event), the upgrade keeps the placeholder\'s apparent size instead of fitting the new stage', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); const before = a.view(); a.st.stageW = 600; a.st.stageH = 500; await a.finish(el, CARD); const after = a.view();
    return placeholderFirst && sameView(before, after) && !near(after.scale, fitBoth(CARD, [600, 500])); }, VIEW_STAGED],
  ['P7-5 [V-D7 staging] after the upgrade a real resize still refits a non-manual view (configured Fit, rotation-aware)', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); await a.finish(el, CARD); await a.resize(1400, 700);
    return placeholderFirst && near(a.tf().scale, fitBoth(CARD, [1400, 700])); }, STAGE],
  ['P7-6 [V-D7 view] manual zoom, pan, rotation, horizontal and vertical flips applied to the placeholder survive the upgrade in apparent screen space (scale rescaled, view identical)', async (src) => {
    const { a, el, placeholderFirst } = await staged(src);
    await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Flip vertical'); await a.btn('Zoom in'); await a.btn('Zoom in'); await a.drag(30, -20);
    const before = a.view(); await a.finish(el, CARD); const after = a.view();
    return placeholderFirst && before.rot === 90 && before.fx === -1 && before.fy === -1 && before.tx === 30 && before.ty === -20 && sameView(before, after) && near(after.scale, before.scale * SAMPLE[0] / CARD[0]); }, VIEW_STAGED],
  ['P7-7 [V-D7 staging] close before the original is ready: the viewer stays closed and inert when the original later completes', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); await a.key('Escape'); await a.finish(el, CARD); await a.wait(200);
    return placeholderFirst && !a.V.isOpen() && a.V.currentPost == null && a.doc.querySelector('.be-viewer-stage').childElementCount === 0 && !el.isConnected; }, STAGE],
  ['P7-8 [V-D7 staging] rapid navigation away before the old original is ready: its late readiness does not replace the new target\'s view', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); await a.key('ArrowRight'); const el1 = a.media(); await a.finish(el1, SAMPLE); const v1 = a.view();
    await a.finish(el, CARD); await a.wait(200);
    return placeholderFirst && a.id() === a.cardId(1) && a.media() === el1 && el1 !== el && !el.isConnected && el1.getAttribute('src') === a.file(1) && sameView(v1, a.view()); }, STAGE],
  ['P7-9 [V-D7 staging] the original fails while the placeholder is shown: the placeholder is restored and stays visible, "Full image failed to load" is shown with the target\'s pointer-usable native link; nothing blank', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); const before = a.view(); await a.fail(el); const srcAfterFail = el.getAttribute('src'); await a.finish(el, SAMPLE); await a.wait(300);
    const l = a.link(); const s = a.doc.querySelector('.be-viewer-stage .be-media-state');
    return placeholderFirst && srcAfterFail === a.sample(0) && a.media() === el && sameView(before, a.view()) && /^Full image failed to load/.test(a.stateText() || '') && !!l && l.href === a.post(0)
      && a.w.getComputedStyle(l).pointerEvents === 'auto' && a.w.getComputedStyle(s).pointerEvents === 'none' && a.id() === a.cardId(0); }, STAGE],
  ['P7-10 [V-D7 view] same-post upgrade by enrichment (metadata-pending sample 300x150 -> original 3000x1500, manual zoom): same element, apparent size kept (no 10x jump), rotation kept', async (src) => {
    const a = await session(src); a.V.open({ id: '963', previewUrl: `${M}/p/963.jpg`, sampleUrl: `${M}/p/963.jpg`, mediaType: 'image', metadataPending: true, postUrl: 'https://e621.net/posts/963' }); await a.wait(0);
    const el = a.media(); await a.finish(el, [300, 150]); await a.btn('Rotate right'); await a.btn('Zoom in'); const before = a.view();
    a.V.updatePost({ id: '963', previewUrl: `${M}/p/963.jpg`, sampleUrl: `${M}/p/963.jpg`, originalUrl: `${M}/o/963.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/963' }); await a.wait(0);
    const pending = el.getAttribute('src') === `${M}/o/963.png` && el.naturalWidth === 300; await a.finish(el, [3000, 1500]);
    return pending && a.media() === el && sameView(before, a.view()) && near(a.view().scale, before.scale / 10); }, VIEW_UPDATE],
  ['P7-24 [V-D7 staging + V-D1] the staged-upgrade failure is durable: a late same-post update with unchanged data keeps the restored placeholder, "Full image failed to load" and the link', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); await a.fail(el); await a.finish(el, SAMPLE);
    a.V.updatePost({ ...a.BE.modules.gallery.getCachedPost(a.cardId(0)) }); await a.wait(500);
    return placeholderFirst && a.media() === el && el.getAttribute('src') === a.sample(0) && el.naturalWidth === SAMPLE[0] && /^Full image failed to load/.test(a.stateText() || '') && !!a.link() && a.link().href === a.post(0); }, STAGE],
  ['P7-25 [V-D7 staging + V-D8] the staged-upgrade failure link is hit-tested at its centre, and a click there targets it, is not prevented and does not close the viewer', async (src) => {
    const { a, el, placeholderFirst } = await staged(src); await a.fail(el); await a.finish(el, SAMPLE);
    const l = a.link(); const hit = a.doc.elementFromPoint(LINK_BOX[0] + 40, LINK_BOX[1] + 8);
    const e = new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: LINK_BOX[0] + 40, clientY: LINK_BOX[1] + 8 }); if (hit) hit.dispatchEvent(e); await a.wait(0);
    return placeholderFirst && !!l && hit === l && !e.defaultPrevented && a.V.isOpen(); }, STAGE],
  ['P7-26 [V-D7 staging] a failing placeholder is not a target failure: the original is loaded directly (no state); if the original then fails, the ordinary "Media failed to load" with the native link', async (src) => {
    const a = await session(src); await a.click(0); const el = a.media(); const first = el.getAttribute('src') === a.sample(0);
    await a.fail(el); const direct = el.getAttribute('src') === a.file(0) && a.stateText() === null; await a.fail(el);
    return first && direct && /^Media failed to load/.test(a.stateText() || '') && !!a.link() && a.link().href === a.post(0); }, STAGE],
  // ---- preservation ----
  ['P7-11 [preserved] no distinct placeholder (sample = preview = original): direct original load, unchanged', async (src) => {
    const a = await session(src); a.V.open({ id: '971', originalUrl: `${M}/o/971.png`, sampleUrl: `${M}/o/971.png`, previewUrl: `${M}/o/971.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/971' }); await a.wait(0);
    const el = a.media(); await a.finish(el, [2000, 1000]); return el.getAttribute('src') === `${M}/o/971.png` && near(a.tf().scale, fitBoth([2000, 1000], [1000, 800])); }, P],
  ['P7-12 [preserved] metadata-pending target: sample shown with "Loading media…" after 220 ms (no staging)', async (src) => {
    const a = await session(src); a.V.open({ id: '900', previewUrl: `${M}/p/900.jpg`, sampleUrl: `${M}/s/900.jpg`, mediaType: 'image', metadataPending: true, postUrl: 'https://e621.net/posts/900' }); await a.wait(250);
    return a.media()?.getAttribute('src') === `${M}/s/900.jpg` && a.stateText() === 'Loading media…'; }, P],
  ['P7-13 [preserved] video card: VIDEO with the preview as poster, "Loading video…" after 180 ms, cleared at loadeddata (no image staging)', async (src) => {
    const a = await session(src, { video: [0] }); await a.click(0); const v = a.media(); await a.wait(200); const s200 = a.stateText(); await a.finish(v, [640, 360]);
    return v.tagName === 'VIDEO' && /\/preview\//.test(v.getAttribute('poster') || '') && v.getAttribute('src') === a.file(0) && s200 === 'Loading video…' && a.stateText() === null; }, P],
  ['P7-14 [preserved] ordinary image failure without a placeholder: "Media failed to load" with the pointer-usable native link (V-D8)', async (src) => {
    const a = await session(src); a.V.open({ id: '972', originalUrl: `${M}/o/972.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/972' }); await a.wait(0); await a.fail(a.media());
    const l = a.link(); return /^Media failed to load/.test(a.stateText() || '') && !!l && a.w.getComputedStyle(l).pointerEvents === 'auto'; }, P],
  ['P7-15 [preserved] V-D1: a late same-post update keeps an established failure state and link', async (src) => {
    const a = await session(src); const p = { id: '973', originalUrl: `${M}/o/973.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/973' }; a.V.open(p); await a.wait(0); await a.fail(a.media());
    a.V.updatePost({ ...p }); await a.wait(500); return /^Media failed to load/.test(a.stateText() || '') && !!a.link(); }, P],
  ['P7-16 [preserved] V-D5: Ctrl+F does not favorite and is not prevented; f favorites', async (src) => {
    const a = await session(src); await a.click(0); const e1 = await a.key('f', { ctrlKey: true }); const n = a.spies.length; const e2 = await a.key('f');
    return n === 0 && !e1.defaultPrevented && a.spies.filter((x) => x[0] === 'favorite').length === 1 && e2.defaultPrevented; }, P],
  ['P7-17 [preserved] V-D6a: a failed takeover (stored volume 1.5, video card) abandons the shell; navigation not cancelled', async (src) => {
    const a = await session(src, { video: [0], settings: { 'be:viewer:volume': '1.5' } }); const e = await a.click(0);
    return !e.defaultPrevented && !a.V.isOpen() && a.V.currentPost == null; }, P],
  ['P7-18 [preserved] V-D6b: from an open image, ArrowRight onto a video with volume 1.5 shows the failure with the target\'s native link', async (src) => {
    const a = await session(src, { video: [1], settings: { 'be:viewer:volume': '1.5' } }); await a.click(0); await a.key('ArrowRight'); await a.wait(50);
    return a.V.isOpen() && a.id() === a.cardId(1) && /^Media failed to load/.test(a.stateText() || '') && !!a.link() && a.link().href === a.post(1) && !a.media(); }, P],
  ['P7-19 [preserved] P6 / V-D4 and all four configured Fit modes: after a direct load, each mode matches its formula; a 90-degree resize refit uses the exchanged dimensions', async (src) => {
    for (const [mode, want] of [['fit-both', Math.min(976 / 2000, 776 / 1000)], ['fit-width', 976 / 2000], ['fit-height', 776 / 1000], ['original-size', 1]]) {
      const a = await session(src, { settings: vset({ fitMode: mode }) }); a.V.open({ id: '974', originalUrl: `${M}/o/974.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/974' }); await a.wait(0);
      await a.finish(a.media(), [2000, 1000]); if (!near(a.tf().scale, want)) return false; }
    const b = await session(src); b.V.open({ id: '975', originalUrl: `${M}/o/975.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/975' }); await b.wait(0); await b.finish(b.media(), [2000, 1000]);
    await b.btn('Rotate right'); await b.resize(1000, 800); return near(b.tf().scale, Math.min(976 / 1000, 776 / 2000)); }, P],
  ['P7-20 [preserved] manual zoom and pan survive an ordinary resize; E6: the Fit button resets rotation and flips', async (src) => {
    const a = await session(src); a.V.open({ id: '976', originalUrl: `${M}/o/976.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/976' }); await a.wait(0); await a.finish(a.media(), [2000, 1000]);
    await a.btn('Zoom in'); await a.drag(15, 5); const z = a.tf(); await a.resize(1400, 700); const t = a.tf();
    await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Fit'); const f = a.tf();
    return t.scale === z.scale && t.tx === 15 && t.ty === 5 && f.rot === 0 && f.fx === 1; }, P],
  ['P7-21 [preserved] successful in-viewer navigation and close: ArrowRight moves to the next target, Escape closes and empties the stage', async (src) => {
    const a = await session(src); await a.click(0); await a.key('ArrowRight'); const ok = a.id() === a.cardId(1) && !!a.media(); await a.key('Escape');
    return ok && !a.V.isOpen() && a.doc.querySelector('.be-viewer-stage').childElementCount === 0; }, P],
  ['P7-22 [preserved] playback: Space plays a paused viewer video; Escape pauses and releases it', async (src) => {
    const a = await session(src, { video: [0] }); await a.click(0); const v = a.media(); const n0 = a.calls.filter((x) => x === 'play').length; await a.key(' ');
    const played = a.calls.filter((x) => x === 'play').length > n0; await a.key('Escape'); return played && a.calls.includes('pause') && !v.hasAttribute('src'); }, P],
  ['P7-23 [preserved] focus unchanged: opening the viewer and the staged upgrade move no focus', async (src) => {
    const a = await session(src); const l = a.art(1).querySelector('a'); l.focus(); await a.click(0); const el = a.media(); await a.finish(el, SAMPLE); await a.finish(el, CARD);
    return a.doc.activeElement === l; }, P],
];

async function main() {
  const results = [];
  const blob = h.gitBlobId(REPAIR);
  for (const [name, fn, expect] of CHECKS) {
    const got = {}; let err = null;
    try { for (const [k, src] of Object.entries(SOURCES)) got[k] = !!(await fn(src)); } catch (e) { err = String(e && e.stack || e).slice(0, 400); }
    const pass = !err && got.repair === true && Object.entries(expect).every(([k, v]) => got[k] === v);
    results.push({ name, ...got, expected: expect, pass, err });
  }
  let failed = 0;
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior 39a5ae1 ${r.prior}, noPlaceholder ${r.noPlaceholder}, rawZoom ${r.rawZoom}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p7-vd7-staged-placeholder-result.json'), `${JSON.stringify({ probe: 'ib11-p7-vd7', productionBlob: blob, prior: '39a5ae1', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
