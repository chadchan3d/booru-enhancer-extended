'use strict';
// IB11-P7 (V-D7) permanent regression: an image target with a distinct lower
// rendition (sample, else preview) opens on that placeholder; once it is shown
// the original is downloaded in a DETACHED preload element while the displayed
// placeholder stays untouched; when the original has completely loaded it is
// assigned to the displayed element (the browser reuses the image already
// loaded in the document, so the switch is synchronous) and the zoom is
// rescaled in the same task so the apparent on-screen view is kept: pan,
// rotation, flips and the manual/fit mode are kept; configured Fit is NOT
// invoked. A failed original keeps the placeholder and shows the failure with
// the native link. Stale readiness (closed viewer, other target) is ignored.
//
// Image model = real Chrome, as measured by the first P7 browser attempt
// (raw b28fbf3d…72d2):
//  - an image already loaded in the document is reused synchronously when
//    assigned (naturalWidth/complete immediately; load queued at 0 ms);
//  - a src that must be fetched makes the element PENDING: naturalWidth/Height
//    0 and complete false, while the old image stays painted (its layout box
//    retained);
//  - when the pending image's dimensions arrive (header) Chrome replaces the
//    painted image with the progressively loading original at its own size;
//  - requestAnimationFrame runs after queued load tasks (fake clock: 16 ms).
// Apparent geometry = painted size x zoom (exchanged at odd quarter turns)
// plus the pan offset.
//
// Sources: repair (working tree, must PASS everything); prior 39a5ae1 (pre-
// P7); pre-correction b856a62 (in-place pending upgrade: the first browser
// attempt's production); mutants NO-PLACEHOLDER (direct original), RAW-ZOOM
// (the upgrade keeps the numeric zoom) and IN-PLACE (the detached preload
// removed: the original is assigned to the displayed element at once). Each
// check states which sources must fail it (null = not constrained); the
// preservation checks hold on all of them.
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
  preCorrection: hh.sourceAt('b856a62', 'b88af3817e8aa3a813272a30115204f39854d58c'),
  noPlaceholder: mustReplace(REPAIR, "\t\t\tif (!post?.originalUrl || fullUrl !== post.originalUrl) return '';\n", "\t\t\treturn '';\n"),
  rawZoom: mustReplace(REPAIR, '\t\t\tif (pw > 0 && ph > 0 && fw > 0 && fh > 0) zoom *= Math.min(pw / fw, ph / fh);\n', ''),
  inPlace: mustReplace(REPAIR, '\t\t\tpre.src = st.full;\n', '\t\t\tswapToFull(el, generation, st);\n'),
};
const M = 'https://static.example';
const vset = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`be:setting:viewer.${k}`, JSON.stringify(v)]));
const CARD = [1448, 2048]; const SAMPLE = [724, 1024]; const LINK_BOX = [520, 392, 80, 16];

async function session(source, { settings = {}, video = [], cachedSample = false } = {}) {
  let clock = null; const st = { stageW: 1000, stageH: 800 }; const calls = []; const spies = []; const logged = []; const preloads = []; const avail = new Map();
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
    w.document.elementFromPoint = (x, y) => {
      const hits = [...w.document.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
      const depth = (el) => { let n = 0; for (let q = el; q; q = q.parentElement) n++; return n; };
      hits.sort((p, q) => depth(q) - depth(p));
      return hits.find((el) => w.getComputedStyle(el).pointerEvents !== 'none') || w.document.body;
    };
    // ---- Chrome image model ----
    const IP = w.HTMLImageElement.prototype;
    Object.defineProperty(IP, 'naturalWidth', { configurable: true, get() { return this.__cur ? this.__cur[0] : 0; } });
    Object.defineProperty(IP, 'naturalHeight', { configurable: true, get() { return this.__cur ? this.__cur[1] : 0; } });
    Object.defineProperty(IP, 'complete', { configurable: true, get() { return this.__complete === true; } });
    const d = Object.getOwnPropertyDescriptor(IP, 'src');
    Object.defineProperty(IP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) {
      d.set.call(this, v); const el = this; const dims = avail.get(String(v));
      if (dims) { el.__cur = dims; el.__complete = true; el.__retained = null; w.setTimeout(() => el.dispatchEvent(new w.Event('load')), 0); return; }
      el.__retained = el.__cur || el.__retained || null; el.__cur = null; el.__complete = false;
    } });
    const VP = w.HTMLVideoElement.prototype;
    Object.defineProperty(VP, 'videoWidth', { configurable: true, get() { return this.__cur ? this.__cur[0] : 0; } });
    Object.defineProperty(VP, 'videoHeight', { configurable: true, get() { return this.__cur ? this.__cur[1] : 0; } });
    const ce = w.document.createElement.bind(w.document);
    w.document.createElement = (tag, ...a) => { const el = ce(tag, ...a); if (/^img$/i.test(String(tag)) && String(new Error().stack).includes('startFullPreload')) preloads.push(el); return el; };
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
  if (cachedSample) for (let i = 0; i < 3; i++) avail.set(art(i).getAttribute('data-sample-url'), SAMPLE);
  const a = {
    w, doc, BE, V, st, calls, spies, logged, art, media, preloads, avail,
    wait: (ms) => clock.advance(ms),
    cardId: (i) => art(i).getAttribute('data-id'),
    file: (i) => art(i).getAttribute('data-file-url'),
    sample: (i) => art(i).getAttribute('data-sample-url'),
    post: (i) => `https://e621.net/posts/${art(i).getAttribute('data-id')}`,
    click: async (i, init = {}) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); art(i).querySelector('img').dispatchEvent(e); await clock.advance(0); return e; },
    key: async (k, mods = {}) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }); doc.dispatchEvent(e); await clock.advance(0); return e; },
    btn: async (title) => { [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith(title)).click(); await clock.advance(0); },
    resize: async (wd, ht) => { st.stageW = wd; st.stageH = ht; w.dispatchEvent(new w.Event('resize')); await clock.advance(150); },
    // complete a fetch (the image becomes available in the document) / fail it / deliver its header (dimensions known, still loading)
    finish: async (el, dims) => { el.__cur = dims; el.__complete = true; el.__retained = null; if (el.tagName === 'IMG') avail.set(el.getAttribute('src'), dims); el.dispatchEvent(new w.Event(el.tagName === 'VIDEO' ? 'loadeddata' : 'load')); await clock.advance(0); },
    fail: async (el) => { el.__cur = null; el.__retained = null; el.__complete = true; el.dispatchEvent(new w.Event('error')); await clock.advance(0); },
    header: async (el, dims) => { el.__cur = dims; el.__retained = null; await clock.advance(0); },
    // whatever is fetching the original right now: the detached preload, or (in-place designs) the displayed element
    originalLoader: (i = 0) => { const pre = [...preloads].reverse().find((p) => p.getAttribute('src') === a.file(i)); if (pre) return pre; const el = media(); return el && el.getAttribute('src') === a.file(i) && !el.complete ? el : null; },
    drag: async (dx, dy) => { const el = media(); el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); el.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 100 + dx, clientY: 100 + dy })); el.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true })); await clock.advance(0); },
    stateText: () => { const s = doc.querySelector('.be-viewer-stage .be-media-state'); return s ? s.textContent : null; },
    link: () => doc.querySelector('.be-viewer-stage .be-viewer-native-fallback'),
    id: () => V.currentPost && String(V.currentPost.id),
    tf: () => { const s = media()?.style.transform || ''; const g = (re) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
      return { tx: g(/translate\((-?[\d.]+)px/), ty: g(/translate\(-?[\d.]+px, (-?[\d.]+)px/), scale: g(/ scale\((-?[\d.]+)\)/), rot: g(/rotate\((-?[\d.]+)deg\)/), fx: g(/scaleX\((-?[\d.]+)\)/), fy: g(/scaleY\((-?[\d.]+)\)/) }; },
  };
  // apparent (painted) footprint of the displayed image
  a.view = () => { const el = media(); const t = a.tf(); const dims = el && (el.__cur || el.__retained); if (!dims || t.scale === null) return null; const odd = Math.abs(Math.round((t.rot || 0) / 90)) % 2 === 1;
    return { w: (odd ? dims[1] : dims[0]) * t.scale, h: (odd ? dims[0] : dims[1]) * t.scale, tx: t.tx, ty: t.ty, rot: t.rot, fx: t.fx, fy: t.fy, scale: t.scale }; };
  return a;
}
const near = (x, y, tol = 1e-6) => typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) <= tol;
const sameView = (b, f) => !!b && !!f && near(b.w, f.w) && near(b.h, f.h) && b.tx === f.tx && b.ty === f.ty && b.rot === f.rot && b.fx === f.fx && b.fy === f.fy;
const fitBoth = ([nw, nh], [sw, sh]) => Math.min((sw - 24) / nw, (sh - 24) / nh);
const fittedSample = (a, stage = [1000, 800]) => { const v = a.view(); const z = fitBoth(SAMPLE, stage); return !!v && near(v.w, SAMPLE[0] * z) && near(v.h, SAMPLE[1] * z); };

// Open card 0 and show its placeholder, Chrome order: placeholder load task, then the frame queued at open.
async function staged(src, { cachedSample = false, ...opts } = {}) {
  const a = await session(src, { ...opts, cachedSample }); await a.click(0); const el = a.media();
  const placeholderFirst = !!el && el.getAttribute('src') === a.sample(0) && a.id() === a.cardId(0) && a.doc.querySelectorAll('.be-viewer-stage img, .be-viewer-stage video').length === 1;
  if (!cachedSample && el && el.getAttribute('src') === a.sample(0)) await a.finish(el, SAMPLE);
  await a.wait(20);
  return { a, el, placeholderFirst };
}
// The original arrives: header first (Chrome may start painting it), then completion.
async function originalArrives(a, i = 0) { const L = a.originalLoader(i); if (!L) return false; await a.header(L, CARD); const mid = a.view(); await a.finish(L, CARD); await a.wait(0); return { mid }; }

// expectations: [repair is always true]; false = must fail; null = not constrained
const X = (prior, preCorrection, noPlaceholder, rawZoom, inPlace) => ({ prior, preCorrection, noPlaceholder, rawZoom, inPlace });
const P = X(true, true, true, true, true);
const CHECKS = [
  ['P7-1 [V-D7 staging] a card click opens on the selected target\'s distinct sample (not the original, not another post); one media element; viewer on the target', async (src) => {
    const a = await session(src); await a.click(0); const el = a.media();
    return !!el && el.getAttribute('src') === a.sample(0) && a.id() === a.cardId(0) && a.V.isOpen() && a.doc.querySelectorAll('.be-viewer-stage img, .be-viewer-stage video').length === 1; }, X(false, null, false, true, true)],
  ['P7-2 [V-D7 Chrome semantics] cached placeholder: after its load and the frame queued at open, the displayed element still holds the placeholder (src, natural size, complete), fitted for the placeholder (not shrunk to the original\'s metadata); the original is fetched by a detached preload', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true });
    const pre = a.preloads.find((p) => p.getAttribute('src') === a.file(0));
    return placeholderFirst && el.getAttribute('src') === a.sample(0) && el.naturalWidth === SAMPLE[0] && el.complete === true && fittedSample(a) && !!pre && !pre.isConnected; }, X(false, false, false, true, false)],
  ['P7-27 [V-D7 Chrome semantics] uncached placeholder behaves the same: still the placeholder, fitted for it, after its load and the queued frame', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: false });
    return placeholderFirst && el.getAttribute('src') === a.sample(0) && el.naturalWidth === SAMPLE[0] && fittedSample(a) && a.stateText() === null; }, X(false, false, false, true, false)],
  ['P7-29 [V-D7 Chrome semantics] while the original downloads (its header arrives before completion) the displayed image is still the placeholder at the same apparent view; no progressive original replaces it', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const before = a.view(); const L = a.originalLoader(); if (!L) return false; await a.header(L, CARD);
    return placeholderFirst && a.media() === el && el.getAttribute('src') === a.sample(0) && sameView(before, a.view()) && fittedSample(a); }, X(false, false, false, true, false)],
  ['P7-3 [V-D7 view] non-manual upgrade: the original replaces the placeholder on the same element, with the same apparent size and position at every step (fitted placeholder, during download, after); target unchanged', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const before = a.view(); const fitted = fittedSample(a); const r = await originalArrives(a); const after = a.view();
    return placeholderFirst && fitted && !!r && sameView(before, r.mid) && a.media() === el && el.getAttribute('src') === a.file(0) && el.naturalWidth === CARD[0] && sameView(before, after) && near(after.scale, before.scale * SAMPLE[0] / CARD[0]) && a.id() === a.cardId(0) && a.stateText() === null; }, X(false, false, false, false, false)],
  ['P7-4 [V-D7 view] no configured refit at the upgrade: with the stage changed silently (no resize event), the upgrade keeps the placeholder\'s apparent size instead of fitting the new stage', async (src) => {
    const { a, placeholderFirst } = await staged(src, { cachedSample: true }); const before = a.view(); const fitted = fittedSample(a); a.st.stageW = 600; a.st.stageH = 500; const r = await originalArrives(a); const after = a.view();
    return placeholderFirst && fitted && !!r && sameView(before, after) && !near(after.scale, fitBoth(CARD, [600, 500])); }, X(false, false, false, false, false)],
  ['P7-5 [V-D7 staging] after the upgrade a real resize still refits a non-manual view (configured Fit, rotation-aware)', async (src) => {
    const { a, placeholderFirst } = await staged(src, { cachedSample: true }); const r = await originalArrives(a); await a.resize(1400, 700);
    return placeholderFirst && !!r && near(a.tf().scale, fitBoth(CARD, [1400, 700])); }, X(false, null, false, true, null)],
  ['P7-6 [V-D7 view] manual zoom, pan, rotation, horizontal and vertical flips applied to the placeholder before the original is ready survive the download and the upgrade in apparent screen space', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true });
    await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Flip vertical'); await a.btn('Zoom in'); await a.btn('Zoom in'); await a.drag(30, -20);
    const before = a.view(); const pending = !!a.originalLoader() && el.getAttribute('src') !== a.file(0) || false; const r = await originalArrives(a); const after = a.view();
    return placeholderFirst && pending && before.rot === 90 && before.fx === -1 && before.fy === -1 && before.tx === 30 && before.ty === -20 && !!r && sameView(before, r.mid) && sameView(before, after) && near(after.scale, before.scale * SAMPLE[0] / CARD[0]); }, X(false, false, false, false, false)],
  ['P7-7 [V-D7 staging] close before the original is ready: the viewer stays closed and inert when the original later completes', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const L = a.originalLoader(); await a.key('Escape'); if (L) await a.finish(L, CARD); await a.wait(200);
    return placeholderFirst && !a.V.isOpen() && a.V.currentPost == null && a.doc.querySelector('.be-viewer-stage').childElementCount === 0 && !el.isConnected; }, X(false, null, false, true, null)],
  ['P7-8 [V-D7 staging] rapid navigation away before the old original is ready: its late readiness does not replace the new target\'s view', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const L = a.originalLoader(); await a.key('ArrowRight'); await a.wait(20); const el1 = a.media(); const v1 = a.view();
    if (L) await a.finish(L, CARD); await a.wait(200);
    return placeholderFirst && a.id() === a.cardId(1) && a.media() === el1 && el1 !== el && !el.isConnected && el1.getAttribute('src') !== a.file(0) && sameView(v1, a.view()); }, X(false, null, false, true, null)],
  ['P7-9 [V-D7 staging] the original fails while the placeholder is shown: the placeholder stays displayed at the same view, "Full image failed to load" is shown with the target\'s pointer-usable native link; nothing blank', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const before = a.view(); const L = a.originalLoader(); if (!L) return false; await a.fail(L); await a.wait(300);
    const l = a.link(); const s = a.doc.querySelector('.be-viewer-stage .be-media-state');
    return placeholderFirst && a.media() === el && el.getAttribute('src') === a.sample(0) && el.naturalWidth === SAMPLE[0] && sameView(before, a.view()) && /^Full image failed to load/.test(a.stateText() || '') && !!l && l.href === a.post(0)
      && a.w.getComputedStyle(l).pointerEvents === 'auto' && a.w.getComputedStyle(s).pointerEvents === 'none' && a.id() === a.cardId(0); }, X(false, false, false, true, false)],
  ['P7-10 [V-D7 view] same-post upgrade by enrichment (metadata-pending sample 300x150 -> original 3000x1500, manual zoom): the sample stays displayed during the download; same element at the end; apparent size kept (no 10x jump); rotation kept', async (src) => {
    const a = await session(src); a.V.open({ id: '963', previewUrl: `${M}/p/963.jpg`, sampleUrl: `${M}/p/963.jpg`, mediaType: 'image', metadataPending: true, postUrl: 'https://e621.net/posts/963' }); await a.wait(0);
    const el = a.media(); await a.finish(el, [300, 150]); await a.wait(20); await a.btn('Rotate right'); await a.btn('Zoom in'); const before = a.view();
    a.V.updatePost({ id: '963', previewUrl: `${M}/p/963.jpg`, sampleUrl: `${M}/p/963.jpg`, originalUrl: `${M}/o/963.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/963' }); await a.wait(20);
    const L = [...a.preloads].reverse().find((p) => p.getAttribute('src') === `${M}/o/963.png`) || (el.getAttribute('src') === `${M}/o/963.png` ? el : null); if (!L) return false;
    await a.header(L, [3000, 1500]); const mid = a.view(); await a.finish(L, [3000, 1500]); await a.wait(0);
    return sameView(before, mid) && a.media() === el && el.getAttribute('src') === `${M}/o/963.png` && sameView(before, a.view()) && near(a.view().scale, before.scale / 10); }, X(false, false, true, false, false)],
  ['P7-28 [V-D7 robustness] if the browser does not reuse the preloaded original (a refetch), the placeholder box is retained while pending and the apparent view is still kept when the element completes', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const before = a.view(); const L = a.originalLoader(); if (!L) return false;
    if (L !== el) { L.__cur = CARD; L.__complete = true; L.dispatchEvent(new a.w.Event('load')); await a.wait(0); } // completed, but NOT registered as reusable
    const pendingOk = el.getAttribute('src') === a.file(0) && sameView(before, a.view()); await a.finish(el, CARD); await a.wait(0);
    return placeholderFirst && pendingOk && a.media() === el && sameView(before, a.view()); }, X(false, false, false, false, null)],
  ['P7-24 [V-D7 staging + V-D1] the staged-upgrade failure is durable: a late same-post update with unchanged data keeps the placeholder, "Full image failed to load" and the link', async (src) => {
    const { a, el, placeholderFirst } = await staged(src, { cachedSample: true }); const L = a.originalLoader(); if (!L) return false; await a.fail(L); await a.wait(20);
    a.V.updatePost({ ...a.BE.modules.gallery.getCachedPost(a.cardId(0)) }); await a.wait(500);
    return placeholderFirst && a.media() === el && el.getAttribute('src') === a.sample(0) && el.naturalWidth === SAMPLE[0] && /^Full image failed to load/.test(a.stateText() || '') && !!a.link() && a.link().href === a.post(0); }, X(false, null, false, true, null)],
  ['P7-25 [V-D7 staging + V-D8] the staged-upgrade failure link is hit-tested at its centre, and a click there targets it, is not prevented and does not close the viewer', async (src) => {
    const { a, placeholderFirst } = await staged(src, { cachedSample: true }); const L = a.originalLoader(); if (!L) return false; await a.fail(L); await a.wait(20);
    const l = a.link(); const hit = a.doc.elementFromPoint(LINK_BOX[0] + 40, LINK_BOX[1] + 8);
    const e = new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: LINK_BOX[0] + 40, clientY: LINK_BOX[1] + 8 }); if (hit) hit.dispatchEvent(e); await a.wait(0);
    return placeholderFirst && !!l && hit === l && !e.defaultPrevented && a.V.isOpen(); }, X(false, null, false, true, null)],
  ['P7-26 [V-D7 staging] a failing placeholder is not a target failure: the original is loaded directly (no state); if the original then fails, the ordinary "Media failed to load" with the native link', async (src) => {
    const a = await session(src); await a.click(0); const el = a.media(); const first = el.getAttribute('src') === a.sample(0);
    await a.fail(el); const direct = el.getAttribute('src') === a.file(0) && a.stateText() === null; await a.fail(el);
    return first && direct && /^Media failed to load/.test(a.stateText() || '') && !!a.link() && a.link().href === a.post(0); }, X(false, null, false, true, null)],
  // ---- preservation ----
  ['P7-11 [preserved] no distinct placeholder (sample = preview = original): direct original load, unchanged', async (src) => {
    const a = await session(src); a.V.open({ id: '971', originalUrl: `${M}/o/971.png`, sampleUrl: `${M}/o/971.png`, previewUrl: `${M}/o/971.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/971' }); await a.wait(0);
    const el = a.media(); await a.finish(el, [2000, 1000]); await a.wait(20); return el.getAttribute('src') === `${M}/o/971.png` && a.preloads.length === 0 && near(a.tf().scale, fitBoth([2000, 1000], [1000, 800])); }, P],
  ['P7-12 [preserved] metadata-pending target: sample shown with "Loading media…" after 220 ms (no staging)', async (src) => {
    const a = await session(src); a.V.open({ id: '900', previewUrl: `${M}/p/900.jpg`, sampleUrl: `${M}/s/900.jpg`, mediaType: 'image', metadataPending: true, postUrl: 'https://e621.net/posts/900' }); await a.wait(250);
    return a.media()?.getAttribute('src') === `${M}/s/900.jpg` && a.stateText() === 'Loading media…'; }, P],
  ['P7-13 [preserved] video card: VIDEO with the preview as poster, "Loading video…" after 180 ms, cleared at loadeddata (no image staging)', async (src) => {
    const a = await session(src, { video: [0] }); await a.click(0); const v = a.media(); await a.wait(200); const s200 = a.stateText(); await a.finish(v, [640, 360]);
    return v.tagName === 'VIDEO' && /\/preview\//.test(v.getAttribute('poster') || '') && v.getAttribute('src') === a.file(0) && s200 === 'Loading video…' && a.stateText() === null && a.preloads.length === 0; }, P],
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
      await a.finish(a.media(), [2000, 1000]); await a.wait(20); if (!near(a.tf().scale, want)) return false; }
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
    const a = await session(src, { cachedSample: true }); const l = a.art(1).querySelector('a'); l.focus(); await a.click(0); await a.wait(20); const L = a.originalLoader(); if (L) await a.finish(L, CARD); await a.wait(20);
    return a.doc.activeElement === l; }, P],
];

async function main() {
  const results = [];
  const blob = h.gitBlobId(REPAIR);
  for (const [name, fn, expect] of CHECKS) {
    const got = {}; let err = null;
    try { for (const [k, src] of Object.entries(SOURCES)) got[k] = !!(await fn(src)); } catch (e) { err = String(e && e.stack || e).slice(0, 400); }
    const pass = !err && got.repair === true && Object.entries(expect).every(([k, v]) => v === null || got[k] === v);
    results.push({ name, ...got, expected: expect, pass, err });
  }
  let failed = 0;
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior 39a5ae1 ${r.prior}, preCorrection b856a62 ${r.preCorrection}, noPlaceholder ${r.noPlaceholder}, rawZoom ${r.rawZoom}, inPlace ${r.inPlace}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p7-vd7-staged-placeholder-result.json'), `${JSON.stringify({ probe: 'ib11-p7-vd7', productionBlob: blob, prior: '39a5ae1', preCorrection: 'b856a62', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
