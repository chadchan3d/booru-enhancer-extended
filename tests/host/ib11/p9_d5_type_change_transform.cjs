'use strict';
// IB11-P9 (E0 D5, designer ruling: an IB11 defect) permanent regression. When
// an open viewer's target, shown as an image, is revealed by metadata to be a
// video, the element is rebuilt IMG -> VIDEO for the SAME target. A deliberate
// manual view must survive: manual mode, pan, rotation and both flips kept, and
// once the video's size is known the zoom is rescaled so the video occupies the
// image's apparent on-screen size (the P7 rule: what the user sees, not the
// raw scale). A non-manual view keeps ordinary configured Fit. The transfer is
// one-shot and bound to the replacement element and media generation: a later
// target, close, or stale readiness cannot apply it. Differing aspect ratios
// use bounded containment (the accepted P7 limitation).
//
// Harness: the P7 Chrome image model (images loaded in the document are
// reused synchronously; a fetched src reads 0x0 with the painted box kept);
// videos report their size only from the moment the test delivers metadata.
// Apparent geometry = displayed size x zoom (exchanged at odd quarter turns),
// centre = stage centre + pan.
//
// Sources: repair; prior 9d86484 (pre-P9); mutants REFIT (the manual view is
// never kept: the old reset), RAW-SCALE (manual kept without the apparent-view
// rescale), STALE-GEN (the transfer is neither cleared on replacement nor
// bound to its element/generation). Each check states which sources must fail
// it (null = not constrained); preservation checks hold on all.
// Usage: node tests/host/ib11/p9_d5_type_change_transform.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const SOURCES = {
  repair: REPAIR,
  prior: hh.sourceAt('9d86484', '8453be9447820978b7d4a2886ea9ae2bf4e87c10'),
  refit: mustReplace(REPAIR, "\t\t\t\tconst keepView = manualZoom && currentElementType === 'image' && wantedElementType === 'video';\n", '\t\t\t\tconst keepView = false;\n'),
  rawScale: mustReplace(REPAIR, '\t\t\tif (manualZoom && pw > 0 && ph > 0 && vw > 0 && vh > 0) zoom *= Math.min(pw / vw, ph / vh);\n', ''),
  staleGen: mustReplace(mustReplace(REPAIR, '\t\t\tif (!t || t.el !== el || t.generation !== generation) return;\n', '\t\t\tif (!t) return;\n'), '\t\t\tconst old = mediaEl;\n\t\t\ttypeTransfer = null;\n', '\t\t\tconst old = mediaEl;\n'),
};
const M = 'https://static.example';
const IMG = [300, 150]; const VID = [1600, 800]; const STAGE = [1000, 800];

async function session(source, { video = [], settings = {} } = {}) {
  let clock = null; const st = { stageW: STAGE[0], stageH: STAGE[1] }; const calls = []; const preloads = []; const avail = new Map();
  const fx = hh.listing('e621.net', 3);
  const c = h.load({ url: fx.url, html: fx.html, source, settings, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.Element.prototype.setPointerCapture = function () {};
    [...w.document.querySelectorAll('article')].forEach((a, i) => { if (!video.includes(i)) return; a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); a.setAttribute('data-size', '5000000'); });
    const gbr = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList && this.classList.contains('be-viewer-stage')) return { x: 0, y: 0, left: 0, top: 0, width: st.stageW, height: st.stageH, right: st.stageW, bottom: st.stageH };
      return gbr.call(this);
    };
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
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document; const BE = c.BE; const V = BE.modules.viewer;
  const media = () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video');
  const art = (i) => doc.querySelectorAll('article')[i];
  const a = {
    w, doc, BE, V, st, calls, preloads, avail, art, media,
    wait: (ms) => clock.advance(ms),
    btn: async (title) => { [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith(title)).click(); await clock.advance(0); },
    key: async (k) => { doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); await clock.advance(0); },
    drag: async (dx, dy) => { const el = media(); el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); el.dispatchEvent(new w.MouseEvent('pointermove', { bubbles: true, clientX: 100 + dx, clientY: 100 + dy })); el.dispatchEvent(new w.MouseEvent('pointerup', { bubbles: true })); await clock.advance(0); },
    finish: async (el, dims) => { el.__cur = dims; el.__complete = true; el.__retained = null; if (el.tagName === 'IMG') avail.set(el.getAttribute('src'), dims); el.dispatchEvent(new w.Event(el.tagName === 'VIDEO' ? 'loadeddata' : 'load')); await clock.advance(0); },
    meta: async (v, dims) => { v.__cur = dims; v.dispatchEvent(new w.Event('loadedmetadata')); await clock.advance(0); },
    fail: async (el) => { el.__cur = null; el.dispatchEvent(new w.Event('error')); await clock.advance(0); },
    stateText: () => { const s = doc.querySelector('.be-viewer-stage .be-media-state'); return s ? s.textContent : null; },
    link: () => doc.querySelector('.be-viewer-stage .be-viewer-native-fallback'),
    id: () => V.currentPost && String(V.currentPost.id),
    tf: () => { const s = media()?.style.transform || ''; const g = (re) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
      return { tx: g(/translate\((-?[\d.]+)px/), ty: g(/translate\(-?[\d.]+px, (-?[\d.]+)px/), scale: g(/ scale\((-?[\d.]+)\)/), rot: g(/rotate\((-?[\d.]+)deg\)/), fx: g(/scaleX\((-?[\d.]+)\)/), fy: g(/scaleY\((-?[\d.]+)\)/) }; },
  };
  a.view = () => { const el = media(); const t = a.tf(); const dims = el && (el.__cur || el.__retained); if (!dims || t.scale === null) return null; const odd = Math.abs(Math.round((t.rot || 0) / 90)) % 2 === 1;
    return { w: (odd ? dims[1] : dims[0]) * t.scale, h: (odd ? dims[0] : dims[1]) * t.scale, cx: STAGE[0] / 2 + t.tx, cy: STAGE[1] / 2 + t.ty, tx: t.tx, ty: t.ty, rot: t.rot, fx: t.fx, fy: t.fy, scale: t.scale, tag: el.tagName }; };
  return a;
}
const near = (x, y, tol = 1e-6) => typeof x === 'number' && typeof y === 'number' && Math.abs(x - y) <= tol;
const fitBoth = ([nw, nh], [sw, sh], odd = false) => { const [rw, rh] = odd ? [nh, nw] : [nw, nh]; return Math.min((sw - 24) / rw, (sh - 24) / rh); };
const post = (id, o = {}) => ({ id: String(id), previewUrl: `${M}/p/${id}.jpg`, sampleUrl: `${M}/p/${id}.jpg`, mediaType: 'image', metadataPending: true, postUrl: `https://e621.net/posts/${id}`, ...o });
const asVideo = (id) => post(id, { originalUrl: `${M}/o/${id}.webm`, mediaType: 'video', metadataPending: false });

// The same target opens as an image (metadata pending), is given a manual view, then metadata reveals a video.
async function manualImage(src, { imgDims = IMG } = {}) {
  const a = await session(src); a.V.open(post(940)); await a.wait(0); const img = a.media(); await a.finish(img, imgDims); await a.wait(20);
  await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Flip vertical'); await a.btn('Zoom in'); await a.btn('Zoom in'); await a.drag(30, -20);
  return { a, img, before: a.view() };
}
async function revealVideo(a, dims = VID, { metaFirst = false } = {}) {
  a.V.updatePost(asVideo(940)); await a.wait(0); const v = a.media(); const gotVideo = !!v && v.tagName === 'VIDEO';
  if (metaFirst) { await a.meta(v, dims); await a.wait(20); } else { await a.wait(20); await a.meta(v, dims); }
  await a.finish(v, dims); await a.wait(50); return { v, gotVideo };
}
const sameView = (b, f, tol = 1e-6) => !!b && !!f && near(b.w, f.w, tol) && near(b.h, f.h, tol) && near(b.cx, f.cx, tol) && near(b.cy, f.cy, tol) && b.rot === f.rot && b.fx === f.fx && b.fy === f.fy;

const X = (o) => ({ prior: null, refit: null, rawScale: null, staleGen: null, ...o });
const P = X({ prior: true, refit: true, rawScale: true, staleGen: true });
const CHECKS = [
  ['P9-1 [D5] the same target is rebuilt IMG -> VIDEO when metadata reveals a video (no image left in the stage)', async (src) => {
    const { a } = await manualImage(src); const { gotVideo } = await revealVideo(a); return gotVideo && a.id() === '940' && a.doc.querySelectorAll('.be-viewer-stage img').length === 0; }, P],
  ['P9-2 [D5] the manual view survives the rebuild in apparent screen space: same rendered size and centre, rotation, both flips and pan kept; the zoom number changes with the intrinsic size', async (src) => {
    const { a, before } = await manualImage(src); await revealVideo(a); const after = a.view();
    return before.rot === 90 && before.fx === -1 && before.fy === -1 && before.tx === 30 && before.ty === -20 && after.tag === 'VIDEO' && sameView(before, after) && after.tx === 30 && after.ty === -20 && !near(after.scale, before.scale) && near(after.scale, before.scale * IMG[0] / VID[0]); }, X({ prior: false, refit: false, rawScale: false })],
  ['P9-3 [D5] manual mode survives: a later resize does not refit, and no configured Fit replaces the view at video readiness', async (src) => {
    const { a, before } = await manualImage(src); await revealVideo(a); const v1 = a.view(); a.st.stageW = 700; a.st.stageH = 500; a.w.dispatchEvent(new a.w.Event('resize')); await a.wait(150);
    const v2 = a.view(); return sameView(before, v1) && near(v2.scale, v1.scale) && !near(v2.scale, fitBoth(VID, [700, 500], true)); }, X({ prior: false, refit: false })],
  ['P9-4 [D5] the same result when the video size is known before the frame queued at the rebuild (an already-ready / cached video)', async (src) => {
    const { a, before } = await manualImage(src); await revealVideo(a, VID, { metaFirst: true }); return sameView(before, a.view()); }, X({ prior: false, refit: false, rawScale: false })],
  ['P9-5 [D5] differing aspect ratio (300x150 image -> 640x480 video): bounded containment - within the image\'s apparent footprint, one side matching; pan, rotation, flips kept', async (src) => {
    const { a, before } = await manualImage(src); await revealVideo(a, [640, 480]); const after = a.view();
    const within = after.w <= before.w + 1e-6 && after.h <= before.h + 1e-6; const oneSide = near(after.w, before.w) || near(after.h, before.h);
    return within && oneSide && near(after.cx, before.cx) && near(after.cy, before.cy) && after.rot === 90 && after.fx === -1 && after.fy === -1; }, X({ prior: false, refit: false, rawScale: false })],
  ['P9-6 [D5 staleness] a pending transfer never reaches a later target: after navigating to another video and zooming it manually, its own metadata does not rescale it', async (src) => {
    const a = await session(src, { video: [1] }); await a.art(0).querySelector('img').dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await a.wait(20);
    const img = a.media(); await a.finish(img, [724, 1024]); await a.wait(20); await a.btn('Zoom in');
    const p = { ...a.BE.modules.gallery.getCachedPost(a.art(0).getAttribute('data-id')), mediaType: 'video', originalUrl: `${M}/o/stale.webm` }; a.V.updatePost(p); await a.wait(20); // transfer pending for card 0
    await a.key('ArrowRight'); await a.wait(20); const v = a.media(); await a.btn('Zoom in'); const z = a.tf().scale; await a.meta(v, VID); await a.wait(20);
    return a.id() === a.art(1).getAttribute('data-id') && v.tagName === 'VIDEO' && near(a.tf().scale, z); }, X({ staleGen: false })],
  ['P9-7 [D5 staleness] close before the video is ready: closed and inert; the late metadata changes nothing', async (src) => {
    const { a } = await manualImage(src); a.V.updatePost(asVideo(940)); await a.wait(0); const v = a.media(); await a.key('Escape'); await a.meta(v, VID); await a.wait(50);
    return !a.V.isOpen() && a.V.currentPost == null && !v.isConnected && a.doc.querySelector('.be-viewer-stage').childElementCount === 0; }, P],
  ['P9-8 [D5 failure] the replacement video fails: "Video failed to load" with the target\'s native link (P5/V-D8 behavior); the viewer stays on the target; nothing resurrected', async (src) => {
    const { a } = await manualImage(src); a.V.updatePost(asVideo(940)); await a.wait(0); const v = a.media(); await a.fail(v); await a.wait(50);
    return a.V.isOpen() && a.id() === '940' && /^Video failed to load/.test(a.stateText() || '') && !!a.link() && a.link().href === 'https://e621.net/posts/940' && a.media() === v && a.doc.querySelectorAll('.be-viewer-stage img').length === 0; }, P],
  ['P9-9 [D5 control] a non-manual (fitted) image -> video change keeps ordinary configured Fit for the video', async (src) => {
    const a = await session(src); a.V.open(post(941)); await a.wait(0); await a.finish(a.media(), IMG); await a.wait(20);
    a.V.updatePost(asVideo(941)); await a.wait(20); const v = a.media(); await a.meta(v, VID); await a.finish(v, VID); await a.wait(50);
    const t = a.tf(); return v.tagName === 'VIDEO' && near(t.scale, fitBoth(VID, STAGE)) && t.tx === 0 && t.ty === 0; }, P],
  // ---- preservation ----
  ['P9-10 [preserved] P7: image -> image staged upgrade keeps the apparent view (manual zoom, rotation)', async (src) => {
    const a = await session(src); a.avail.set(a.art(0).getAttribute('data-sample-url'), [724, 1024]);
    a.art(0).querySelector('img').dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await a.wait(20);
    await a.btn('Rotate right'); await a.btn('Zoom in'); const before = a.view(); const pre = [...a.preloads].reverse()[0]; if (!pre) return false;
    pre.__cur = [1448, 2048]; pre.__complete = true; a.avail.set(pre.getAttribute('src'), [1448, 2048]); pre.dispatchEvent(new a.w.Event('load')); await a.wait(20);
    const after = a.view(); return a.media().tagName === 'IMG' && sameView(before, after) && near(after.scale, before.scale / 2); }, P],
  ['P9-11 [preserved] video playback preferences on the rebuilt video: autoplay/loop/mute reflect the settings; Space plays a paused video', async (src) => {
    const a = await session(src, { settings: { 'be:setting:viewer.autoplayVideo': 'false', 'be:setting:viewer.loopVideo': 'true', 'be:setting:viewer.muteVideo': 'true' } });
    a.V.open(post(942)); await a.wait(0); await a.finish(a.media(), IMG); a.V.updatePost(asVideo(942)); await a.wait(20); const v = a.media(); const n0 = a.calls.filter((x) => x === 'play').length; await a.key(' ');
    return v.tagName === 'VIDEO' && v.autoplay === false && v.loop === true && v.muted === true && a.calls.filter((x) => x === 'play').length > n0; }, P],
  ['P9-12 [preserved] P6: a non-manual rotated video refits on resize with the exchanged dimensions', async (src) => {
    const a = await session(src); a.V.open(asVideo(943)); await a.wait(0); const v = a.media(); await a.meta(v, VID); await a.finish(v, VID); await a.btn('Rotate right');
    a.st.stageW = 1000; a.st.stageH = 800; a.w.dispatchEvent(new a.w.Event('resize')); await a.wait(150); return near(a.tf().scale, fitBoth(VID, STAGE, true)); }, P],
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
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [${Object.keys(SOURCES).map((k) => `${k} ${r[k]}`).join(', ')}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p9-d5-type-change-transform-result.json'), `${JSON.stringify({ probe: 'ib11-p9-d5', productionBlob: blob, prior: '9d86484', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
