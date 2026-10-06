'use strict';
// IB11-E0 local structural characterization of the existing viewer (production
// 4d793a2 / blob 002bdfd, working tree). No production change.
//
// Each check pins what production does TODAY (jsdom, fake clock, simulated
// media events, inert network). Checks marked [DEFECT] or [FINDING] are
// witnesses of current behavior that IB11 may later change; they pass while
// the behavior is present. Every check is fault-sensitive: it carries source
// mutants that must flip it. For witnesses the mutant is a REPAIR PROBE (a
// candidate change applied only to a test copy, to prove the witness detects
// the behavior); it is not a chosen fix.
// Browser media behavior (real decode, autoplay policy, native controls,
// real focus/navigation) is out of scope here; see tests/browser/ib11.
// Usage: node tests/host/ib11/viewer_baseline.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const EXPECTED_BLOB = '002bdfd1a88adf8ed851df7ed768e6189e2bc958';
const PROD = h.productionSource();
const M = 'https://static.example';

// ---- session ----
async function session({ source = PROD, settings = {}, video = [], n = 3 } = {}) {
  let clock = null; const log = []; const els = [];
  const st = { stageW: 1000, stageH: 800, play: 'resolve', spies: [] };
  const fx = hh.listing('e621.net', n);
  const c = h.load({ url: fx.url, html: fx.html, source, settings, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.Element.prototype.setPointerCapture = function () {};
    [...w.document.querySelectorAll('article')].forEach((a, i) => {
      if (!video.includes(i)) return;
      a.setAttribute('data-file-ext', 'webm');
      a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm'));
      a.setAttribute('data-size', '5000000');
    });
    const gbr = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList && this.classList.contains('be-viewer-stage')) return { x: 0, y: 0, left: 0, top: 0, width: st.stageW, height: st.stageH, right: st.stageW, bottom: st.stageH };
      return gbr.call(this);
    };
    for (const [P, wk, hk] of [[w.HTMLImageElement.prototype, 'naturalWidth', 'naturalHeight'], [w.HTMLVideoElement.prototype, 'videoWidth', 'videoHeight']]) {
      Object.defineProperty(P, wk, { configurable: true, get() { return this.__nat ? this.__nat[0] : 0; } });
      Object.defineProperty(P, hk, { configurable: true, get() { return this.__nat ? this.__nat[1] : 0; } });
    }
    const idx = (el) => els.indexOf(el);
    const MP = w.HTMLMediaElement.prototype;
    MP.play = function () { log.push([clock.now(), idx(this), 'play']); return st.play === 'reject' ? Promise.reject(new w.DOMException('blocked', 'NotAllowedError')) : Promise.resolve(); };
    MP.pause = function () { log.push([clock.now(), idx(this), 'pause']); };
    MP.load = function () { log.push([clock.now(), idx(this), 'load']); };
    const ra = w.Element.prototype.removeAttribute;
    w.Element.prototype.removeAttribute = function (k) { if (els.includes(this) && k === 'src') log.push([clock.now(), idx(this), 'removeSrc']); return ra.call(this, k); };
    w.open = (u) => { st.spies.push(['window.open', String(u)]); return null; };
    const ce = w.document.createElement.bind(w.document);
    w.document.createElement = (tag, ...a) => { const el = ce(tag, ...a); if (/^(img|video)$/i.test(String(tag)) && String(new Error().stack).includes('buildMedia')) els.push(el); return el; };
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const BE = c.BE;
  BE.modules.favorites.toggle = (p) => { st.spies.push(['favorite', p && p.id]); };
  BE.modules.downloader.downloadPost = (p) => { st.spies.push(['download', p && p.id]); };
  const doc = w.document;
  const stage = () => doc.querySelector('.be-viewer-stage');
  const overlay = () => doc.querySelector('#be-viewer-overlay');
  const media = () => stage()?.querySelector('img, video') || null;
  const art = (i) => doc.querySelectorAll('article')[i];
  const img = (i) => art(i).querySelector('img');
  const a = {
    w, BE, doc, log, els, st, c,
    wait: (ms) => clock.advance(ms),
    click(i, init = {}) { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }); img(i).dispatchEvent(e); return clock.advance(0).then(() => e); },
    async key(key, init = {}, target = doc) { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }); target.dispatchEvent(e); await clock.advance(0); return e; },
    async fire(el, name) { if (el) el.dispatchEvent(new w.Event(name)); await clock.advance(0); },
    async loaded(el, nw, nh) { if (!el) return; el.__nat = [nw, nh]; await a.fire(el, el.tagName === 'VIDEO' ? 'loadeddata' : 'load'); },
    async btn(title) { const b = [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith(title)); b.click(); await clock.advance(0); return b; },
    async resize(wd, ht) { st.stageW = wd; st.stageH = ht; w.dispatchEvent(new w.Event('resize')); await clock.advance(150); },
    open: async (post, nav = {}) => { const r = BE.modules.viewer.open(post, nav, {}); await clock.advance(0); return r; },
    update: async (post) => { BE.modules.viewer.updatePost(post); await clock.advance(0); },
    stage, overlay, media, art, img,
    state: () => stage()?.querySelector('.be-media-state')?.textContent || null,
    link: () => stage()?.querySelector('.be-viewer-native-fallback') || null,
    isOpen: () => BE.modules.viewer.isOpen(),
    flex: () => overlay()?.style.display === 'flex',
    tf: () => { const s = media()?.style.transform || ''; const g = (re) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
      return { tx: g(/translate\((-?[\d.]+)px/), scale: g(/ scale\((-?[\d.]+)\)/), rot: g(/rotate\((-?[\d.]+)deg\)/), fx: g(/scaleX\((-?[\d.]+)\)/), fy: g(/scaleY\((-?[\d.]+)\)/) }; },
    ops: (el) => log.filter((x) => x[1] === els.indexOf(el)).map((x) => x[2]),
    errors: () => c.errors.slice(),
  };
  return a;
}
const post = (id, o = {}) => ({ id: String(id), originalUrl: '', sampleUrl: '', previewUrl: '', mediaType: 'unknown', postUrl: `https://e621.net/posts/${id}`, width: 0, height: 0, ...o });
const S = (s) => JSON.stringify(s);
const near = (x, y) => x !== null && Math.abs(x - y) < 1e-6;
const vset = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`be:setting:viewer.${k}`, JSON.stringify(v)]));

// ---- cases: { id, name, run(src) -> obs, ok(obs), mutants: [[label, from, to]] } ----
const CASES = [];
const add = (id, name, run, ok, mutants) => CASES.push({ id, name, run, ok, mutants });

// A. Takeover and synchronous failure
add('A1', 'plain left click on a card: viewer takes over synchronously (opened, native navigation cancelled), target = the clicked card, media = card original file',
  async (src) => { const a = await session({ source: src }); const e = await a.click(0);
    return { open: a.isOpen(), prevented: e.defaultPrevented, id: a.BE.modules.viewer.currentPost?.id, src: a.media()?.getAttribute('src'), file: a.art(0).getAttribute('data-file-url') }; },
  (o) => o.open && o.prevented && o.id === '101' && o.src === o.file,
  [['takeover no longer cancels native navigation', '\t\t\tBE.modules.hover.endForViewer?.();\n\t\t\te.preventDefault();', '\t\t\tBE.modules.hover.endForViewer?.();']]);
add('A2', 'modifier and middle clicks keep native behavior (no viewer, not cancelled): ctrl, meta, shift, alt, button 1',
  async (src) => { const out = []; for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) { const a = await session({ source: src }); const e = await a.click(0, init); out.push([a.isOpen(), e.defaultPrevented]); } return out; },
  (o) => o.every(([op, pr]) => !op && !pr),
  [['modifier keys not checked', 'if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;', 'if (e.button !== 0) return;']]);
add('A3', 'viewer.enabled = false: ordinary click keeps native behavior',
  async (src) => { const a = await session({ source: src, settings: vset({ enabled: false }) }); const e = await a.click(0); return { open: a.isOpen(), prevented: e.defaultPrevented }; },
  (o) => !o.open && !o.prevented,
  [['enabled preference ignored', "\t\t\tif (!BE.settings.get('viewer.enabled')) return;\n\n\t\t\t// Never hijack", '\t\t\t// Never hijack']]);
add('A4', '[FINDING] the per-card "Open viewer" action button opens the viewer even when viewer.enabled = false (explicit action, not an ordinary click)',
  async (src) => { const a = await session({ source: src, settings: vset({ enabled: false }) }); const b = a.art(0).querySelector('[data-be-action="viewer"]'); b.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await a.wait(0); return { open: a.isOpen() }; },
  (o) => o.open,
  [['repair probe: action button honors viewer.enabled', "\t\t\tif (action === 'viewer') {\n\t\t\t\topenViewerForThumb(img, thumb);", "\t\t\tif (action === 'viewer') {\n\t\t\t\tif (BE.settings.get('viewer.enabled')) openViewerForThumb(img, thumb);"]]);
add('A5', '[DEFECT V-D6a] synchronous failure during takeover (stored remembered volume 1.5 on a video card): native navigation is NOT cancelled (correct), but the overlay is left displayed with an empty stage',
  async (src) => { const a = await session({ source: src, video: [0], settings: { 'be:viewer:volume': '1.5' } }); const e = await a.click(0);
    return { prevented: e.defaultPrevented, flex: a.flex(), media: !!a.media(), state: a.state(), threw: a.errors().length >= 0 }; },
  (o) => !o.prevented && o.flex && !o.media && o.state === null,
  [['takeover cancels navigation even when open threw', '\t\t\tif (!opened) return;\n\t\t\tBE.modules.hover.endForViewer?.();', '\t\t\tBE.modules.hover.endForViewer?.();'],
    ['repair probe: overlay shown only after media was built', "\t\t\toverlay.style.display = 'flex';\n\t\t\treplaceMedia(post);", "\t\t\treplaceMedia(post);\n\t\t\toverlay.style.display = 'flex';"]]);
add('A6', '[DEFECT V-D6b] synchronous failure during in-viewer navigation (ArrowRight to a video card while the stored volume is 1.5): the viewer stays open on the new target with an empty stage, no message and no native link (blank, uncommunicated failure)',
  async (src) => { const a = await session({ source: src, video: [1], settings: { 'be:viewer:volume': '1.5' } }); await a.click(0); await a.key('ArrowRight'); await a.wait(400);
    return { open: a.isOpen(), id: a.BE.modules.viewer.currentPost?.id, media: !!a.media(), state: a.state(), link: !!a.link() }; },
  (o) => o.open && o.id === '102' && !o.media && o.state === null && !o.link,
  [['repair probe: build failure shows the failed state', '\t\t\tmediaEl = buildMedia(post);\n', "\t\t\ttry { mediaEl = buildMedia(post); } catch (err) { mediaEl = null; showMediaState('Media failed to load', ++mediaGeneration, 0, true); return; }\n"]]);

// B. Placeholder / staged loading
add('B1', '[DEFECT V-D7] image card: the viewer loads the original file directly (no staged thumbnail/sample placeholder) and shows no loading state while it loads',
  async (src) => { const a = await session({ source: src }); await a.click(0); await a.wait(400);
    const els = a.stage().querySelectorAll('img, video'); return { n: els.length, src: a.media()?.getAttribute('src'), file: a.art(0).getAttribute('data-file-url'), state: a.state() }; },
  (o) => o.n === 1 && o.src === o.file && o.state === null,
  [['repair probe: images show a loading state', '\t\t\t} else if (post?.metadataPending) {', '\t\t\t} else if (true) {'],
    ['repair probe: stage the sample first', '\t\t\treturn post?.originalUrl || post?.sampleUrl || post?.previewUrl || \'\';\n\t\t}\n\n\t\tfunction intrinsicSize', '\t\t\treturn post?.sampleUrl || post?.originalUrl || post?.previewUrl || \'\';\n\t\t}\n\n\t\tfunction intrinsicSize']]);
add('B2', 'video card: the non-video preview is the poster; "Loading video…" appears after 180 ms and clears at loadeddata',
  async (src) => { const a = await session({ source: src, video: [0] }); await a.click(0); const v = a.media(); await a.wait(100); const s100 = a.state(); await a.wait(100); const s200 = a.state(); await a.loaded(v, 640, 360);
    return { tag: v?.tagName, poster: v?.getAttribute('poster') || '', s100, s200, after: a.state() }; },
  (o) => o.tag === 'VIDEO' && /\/preview\//.test(o.poster) && o.s100 === null && o.s200 === 'Loading video…' && o.after === null,
  [['poster not set', "\t\t\t\tif (post.previewUrl && guessMediaType(post.previewUrl) !== 'video') el.poster = post.previewUrl;\n", '']]);
add('B3', 'metadata-pending target (no original yet): sample/preview shown with "Loading media…" after 220 ms',
  async (src) => { const a = await session({ source: src }); await a.open(post(900, { previewUrl: `${M}/p/900.jpg`, sampleUrl: `${M}/s/900.jpg`, mediaType: 'image', metadataPending: true })); await a.wait(250);
    return { src: a.media()?.getAttribute('src'), state: a.state() }; },
  (o) => o.src === `${M}/s/900.jpg` && o.state === 'Loading media…',
  [['pending state removed', '\t\t\t} else if (post?.metadataPending) {', '\t\t\t} else if (false) {']]);

// C. Failure and native recovery
add('C1', 'image failure after takeover: "Media failed to load" plus an "Open native post" link to the card post; the link click is not intercepted',
  async (src) => { const a = await session({ source: src }); await a.click(0); await a.fire(a.media(), 'error'); const l = a.link();
    let prevented = null; if (l) { const e = new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); l.addEventListener('click', (x) => { x.preventDefault(); }, { once: true }); const before = e.defaultPrevented; l.dispatchEvent(e); prevented = before; }
    return { state: a.state(), href: l?.getAttribute('href') || null, native: a.art(0).querySelector('a').href, open: a.isOpen(), prevented }; },
  (o) => /^Media failed to load/.test(o.state || '') && o.href === o.native && o.open && o.prevented === false,
  [['native link removed', '\t\t\t\t\tif (nativeUrl) {', '\t\t\t\t\tif (false) {']]);
add('C2', 'video failure after takeover: "Video failed to load" plus the native link',
  async (src) => { const a = await session({ source: src, video: [0] }); await a.click(0); await a.fire(a.media(), 'error'); return { state: a.state(), link: !!a.link() }; },
  (o) => /^Video failed to load/.test(o.state || '') && o.link,
  [['video error not shown', "showMediaState('Video failed to load', generation, 0, true);", 'void 0;']]);
add('C3', '[DEFECT V-D1] a later same-ID metadata update with an unchanged URL (late enrichment) erases the failed state and its native link; the failed media stays (blank, uncommunicated failure)',
  async (src) => { const a = await session({ source: src }); await a.click(0); const el = a.media(); await a.fire(el, 'error'); const before = !!a.link();
    await a.update({ ...a.BE.modules.gallery.getCachedPost('101') }); await a.wait(400); return { before, after: !!a.link(), state: a.state(), same: a.media() === el }; },
  (o) => o.before && !o.after && o.state === null && o.same,
  [['repair probe: update keeps the state when the URL is unchanged', '\t\t\tupdateStatus(post);\n\t\t\tclearMediaState();\n', '\t\t\tupdateStatus(post);\n']]);
add('C4', '[FINDING] a target without postUrl (direct viewer.open callers) fails with no native link',
  async (src) => { const a = await session({ source: src }); await a.open(post(950, { originalUrl: `${M}/o/950.png`, mediaType: 'image', postUrl: '' })); await a.fire(a.media(), 'error'); return { state: a.state(), link: !!a.link() }; },
  (o) => /^Media failed to load/.test(o.state || '') && !o.link,
  [['repair probe: fall back to the page URL', '\t\t\t\t\tconst nativeUrl = currentPost?.postUrl;', '\t\t\t\t\tconst nativeUrl = currentPost?.postUrl || location.href;']]);

// D. Generations, replacement, cleanup
add('D1', 'rapid different-post navigation: a late metadata update for the previous post is ignored (post-ID guard)',
  async (src) => { const a = await session({ source: src }); await a.click(0); await a.key('ArrowRight'); await a.update(post(101, { originalUrl: `${M}/o/late.png`, mediaType: 'image' }));
    return { id: a.BE.modules.viewer.currentPost?.id, src: a.media()?.getAttribute('src'), file1: a.art(1).getAttribute('data-file-url') }; },
  (o) => o.id === '102' && o.src === o.file1,
  [['post-ID guard removed', '\t\t\tif (!currentPost || String(currentPost.id) !== String(post.id)) return;', '\t\t\tif (!currentPost) return;']]);
add('D2', 'stale callbacks: loadeddata/canplay/playing/error/waiting from the previous video do not touch the current target\'s state',
  async (src) => { const a = await session({ source: src, video: [0, 1] }); await a.click(0); const v0 = a.media(); await a.key('ArrowRight'); await a.wait(200); const s = a.state();
    for (const n of ['loadeddata', 'canplay', 'playing', 'error', 'waiting', 'stalled']) await a.fire(v0, n); await a.wait(300);
    return { s, after: a.state(), cur: a.media() !== v0 }; },
  (o) => o.s === 'Loading video…' && o.after === 'Loading video…' && o.cur,
  [['readiness guard removed', '\t\t\tif (el !== mediaEl || generation !== mediaGeneration) return;\n\t\t\tclearMediaState();', '\t\t\tclearMediaState();'],
    ['old error applied to the current generation', "if (el === mediaEl && generation === mediaGeneration) {\n\t\t\t\t\t\tshowMediaState('Video failed to load', generation, 0, true);", "{\n\t\t\t\t\t\tshowMediaState('Video failed to load', mediaGeneration, 0, true);"],
    ['canplay guard removed', "\t\t\t\tel.addEventListener('canplay', () => {\n\t\t\t\t\tif (el === mediaEl && generation === mediaGeneration) clearMediaState();", "\t\t\t\tel.addEventListener('canplay', () => {\n\t\t\t\t\tclearMediaState();"]]);
add('D3', 'replacement stops the previous video: pause, src removed, load(); old element detached',
  async (src) => { const a = await session({ source: src, video: [0, 1] }); await a.click(0); const v0 = a.media(); await a.key('ArrowRight'); return { ops: a.ops(v0), src: v0.hasAttribute('src'), conn: v0.isConnected }; },
  (o) => o.ops.includes('pause') && o.ops.includes('removeSrc') && o.ops.includes('load') && !o.src && !o.conn,
  [['previous media not stopped', '\t\t\tstopMedia(old);\n', '']]);
add('D4', '[FINDING] rapid same-ID metadata generations: no generation guard; the last applied update wins regardless of request order (an older result can replace a newer URL)',
  async (src) => { const a = await session({ source: src }); await a.open(post(920, { originalUrl: `${M}/o/v1.png`, mediaType: 'image' }));
    await a.update(post(920, { originalUrl: `${M}/o/v2.png`, mediaType: 'image' })); const mid = a.media()?.getAttribute('src'); await a.update(post(920, { originalUrl: `${M}/o/v1.png`, mediaType: 'image' })); return { mid, src: a.media()?.getAttribute('src') }; },
  (o) => o.mid === `${M}/o/v2.png` && o.src === `${M}/o/v1.png`,
  [['URL changes not applied in place', '\t\t\t\t} else {\n\t\t\t\t\tmediaEl.src = nextUrl;\n\t\t\t\t}', '\t\t\t\t}']]);
add('D5', 'image placeholder -> video when metadata reveals a video: the element is rebuilt as <video>; rotation/flip kept; [FINDING] manual zoom and pan are discarded (refit)',
  async (src) => { const a = await session({ source: src }); await a.open(post(930, { previewUrl: `${M}/p/930.jpg`, sampleUrl: `${M}/p/930.jpg`, mediaType: 'image', metadataPending: true }));
    await a.loaded(a.media(), 300, 150); await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Zoom in'); const z = a.tf().scale;
    await a.update(post(930, { previewUrl: `${M}/p/930.jpg`, originalUrl: `${M}/o/930.webm`, mediaType: 'video' })); await a.wait(50); await a.loaded(a.media(), 640, 360);
    return { tag: a.media()?.tagName, imgs: a.stage().querySelectorAll('img').length, tf: a.tf(), z }; },
  (o) => o.tag === 'VIDEO' && o.imgs === 0 && o.tf.rot === 90 && o.tf.fx === -1 && !near(o.tf.scale, o.z),
  [['type change not rebuilt', '\t\t\tif (currentElementType !== wantedElementType || previousType !== nextType) {', '\t\t\tif (false) {'],
    ['repair probe: replacement keeps manual zoom', '\t\t\t\treplaceMedia(post);\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tif (nextUrl', '\t\t\t\treplaceMedia(post, { preserveManualZoom: true });\n\t\t\t\treturn;\n\t\t\t}\n\n\t\t\tif (nextUrl']]);
add('D6', 'same-element video URL upgrade: src swapped and load(); play() is called only when viewer.autoplayVideo is true',
  async (src) => { const out = {}; for (const ap of [true, false]) { const a = await session({ source: src, settings: vset({ autoplayVideo: ap }) });
      await a.open(post(940, { originalUrl: `${M}/o/940a.webm`, mediaType: 'video' })); const v = a.media(); const n0 = a.ops(v).filter((x) => x === 'play').length;
      await a.update(post(940, { originalUrl: `${M}/o/940b.webm`, mediaType: 'video' })); out[ap] = { same: a.media() === v, src: v.getAttribute('src'), plays: a.ops(v).filter((x) => x === 'play').length - n0, loads: a.ops(v).filter((x) => x === 'load').length }; } return out; },
  (o) => o.true.same && o.true.src.endsWith('940b.webm') && o.true.plays === 1 && o.true.loads >= 1 && o.false.plays === 0,
  [['autoplay=false still plays on upgrade', "\t\t\t\t\tif (BE.settings.get('viewer.autoplayVideo')) mediaEl.play().catch(() => {});", '\t\t\t\t\tmediaEl.play().catch(() => {});']]);
add('D7', 'close before readiness: the video is stopped (pause, src removed, load); later readiness/error from it changes nothing; an image closed before load is inert',
  async (src) => { const a = await session({ source: src, video: [0] }); await a.click(0); const v = a.media(); await a.key('Escape');
    for (const n of ['loadeddata', 'error', 'waiting']) await a.fire(v, n); await a.wait(300);
    const b = await session({ source: src }); await b.click(0); const im = b.media(); await b.key('Escape'); await b.loaded(im, 100, 100); await b.fire(im, 'error');
    return { ops: a.ops(v), src: v.hasAttribute('src'), open: a.isOpen(), stageKids: a.stage().childElementCount, bOpen: b.isOpen(), bKids: b.stage().childElementCount, bErr: b.errors().length }; },
  (o) => o.ops.includes('pause') && o.ops.includes('removeSrc') && !o.src && !o.open && o.stageKids === 0 && !o.bOpen && o.bKids === 0 && o.bErr === 0,
  [['close leaves the old video active', '\t\t\tstopMedia(mediaEl);\n\t\t\tmediaEl = null;', '\t\t\tmediaEl = null;']]);

// E. Fit modes and transforms
const fitRun = (mode, nw, nh) => async (src) => { const a = await session({ source: src, settings: vset({ fitMode: mode }) }); await a.open(post(960, { originalUrl: `${M}/o/960.png`, mediaType: 'image' })); await a.loaded(a.media(), nw, nh); await a.wait(50); return a.tf().scale; };
add('E1', 'fit modes (stage 1000x800, 12 px padding each side): fit-both = min, fit-width, fit-height, original-size = 1, for landscape 2000x1000 and portrait 1000x2000',
  async (src) => { const o = {}; for (const m of ['fit-both', 'fit-width', 'fit-height', 'original-size']) o[m] = [await fitRun(m, 2000, 1000)(src), await fitRun(m, 1000, 2000)(src)]; return o; },
  (o) => near(o['fit-both'][0], 976 / 2000) && near(o['fit-both'][1], 776 / 2000) && near(o['fit-width'][0], 976 / 2000) && near(o['fit-width'][1], 976 / 1000) && near(o['fit-height'][0], 776 / 1000) && near(o['fit-height'][1], 776 / 2000) && o['original-size'].every((x) => near(x, 1)),
  [['fit-width uses the height', "\t\t\tif (mode === 'fit-width') return Math.max(0.01, widthScale);", "\t\t\tif (mode === 'fit-width') return Math.max(0.01, heightScale);"]]);
add('E2', 'resize: refits when zoom is not manual; manual zoom and pan survive a resize',
  async (src) => { const a = await session({ source: src }); await a.open(post(961, { originalUrl: `${M}/o/961.png`, mediaType: 'image' })); await a.loaded(a.media(), 2000, 1000); await a.wait(50);
    await a.resize(500, 400); const fitAfter = a.tf().scale; await a.btn('Zoom in'); const z = a.tf().scale;
    const el = a.media(); el.dispatchEvent(new a.w.PointerEvent('pointerdown', { clientX: 0, clientY: 0, bubbles: true })); el.dispatchEvent(new a.w.PointerEvent('pointermove', { clientX: 30, clientY: 10, bubbles: true })); el.dispatchEvent(new a.w.PointerEvent('pointerup', { bubbles: true }));
    await a.wait(0); const tx = a.tf().tx; await a.resize(900, 700); return { fitAfter, z, after: a.tf(), tx }; },
  (o) => near(o.fitAfter, 476 / 2000) && near(o.after.scale, o.z) && o.tx === 30 && o.after.tx === 30,
  [['resize refits a manual zoom', '\t\t\t\tif (isOpen() && mediaEl && !manualZoom) applyConfiguredFit();', '\t\t\t\tif (isOpen() && mediaEl) applyConfiguredFit();']]);
add('E3', 'rotation and flip survive a same-type placeholder -> better image upgrade (in-place src swap)',
  async (src) => { const a = await session({ source: src }); await a.open(post(962, { previewUrl: `${M}/p/962.jpg`, sampleUrl: `${M}/p/962.jpg`, mediaType: 'image', metadataPending: true })); const el = a.media();
    await a.loaded(el, 300, 150); await a.btn('Rotate right'); await a.btn('Flip vertical');
    await a.update(post(962, { previewUrl: `${M}/p/962.jpg`, originalUrl: `${M}/o/962.png`, mediaType: 'image' })); await a.loaded(a.media(), 3000, 1500);
    return { same: a.media() === el, src: el.getAttribute('src'), tf: a.tf() }; },
  (o) => o.same && o.src === `${M}/o/962.png` && o.tf.rot === 90 && o.tf.fy === -1,
  [['upgrade resets rotation', '\t\t\tcurrentPost = post;\n\t\t\tupdateStatus(post);', '\t\t\tcurrentPost = post;\n\t\t\trotation = 0;\n\t\t\tupdateStatus(post);']]);
add('E4', '[FINDING] manual zoom is absolute to native pixels: across a placeholder (300x150) -> original (3000x1500) upgrade the scale is kept, so the apparent size jumps 10x; pan is kept',
  async (src) => { const a = await session({ source: src }); await a.open(post(963, { previewUrl: `${M}/p/963.jpg`, sampleUrl: `${M}/p/963.jpg`, mediaType: 'image', metadataPending: true }));
    await a.loaded(a.media(), 300, 150); await a.btn('Zoom in'); const before = a.tf().scale;
    await a.update(post(963, { previewUrl: `${M}/p/963.jpg`, originalUrl: `${M}/o/963.png`, mediaType: 'image' })); await a.loaded(a.media(), 3000, 1500); return { before, after: a.tf().scale }; },
  (o) => near(o.before, o.after),
  [['repair probe: refit at readiness', '\t\t\tclearMediaState();\n\t\t\tif (!manualZoom) applyConfiguredFit();\n\t\t\telse render();\n\t\t}', '\t\t\tclearMediaState();\n\t\t\tapplyConfiguredFit();\n\t\t}']]);
add('E5', '[DEFECT V-D4] fit ignores rotation: a 2000x1000 image rotated 90 deg and refit on resize is scaled for the unrotated box and overflows the 776 px available height',
  async (src) => { const a = await session({ source: src }); await a.open(post(964, { originalUrl: `${M}/o/964.png`, mediaType: 'image' })); await a.loaded(a.media(), 2000, 1000); await a.wait(50);
    await a.btn('Rotate right'); await a.resize(1000, 800); const s = a.tf().scale; return { scale: s, rotatedHeight: 2000 * s, rot: a.tf().rot }; },
  (o) => o.rot === 90 && o.rotatedHeight > 776 + 1e-6,
  [['repair probe: fit uses the rotated box', '\t\t\tconst { width, height } = intrinsicSize();\n\t\t\tif (!(width > 0) || !(height > 0)) return 1;\n\n\t\t\tconst rect = stage.getBoundingClientRect();\n\t\t\tconst availableWidth',
    '\t\t\tconst nat = intrinsicSize(); const qt = Math.abs(Math.round(rotation / 90)) % 2; const width = qt ? nat.height : nat.width; const height = qt ? nat.width : nat.height;\n\t\t\tif (!(width > 0) || !(height > 0)) return 1;\n\n\t\t\tconst rect = stage.getBoundingClientRect();\n\t\t\tconst availableWidth']]);
add('E6', '[FINDING] the "Fit" button resets rotation and flip as well as zoom/pan',
  async (src) => { const a = await session({ source: src }); await a.open(post(965, { originalUrl: `${M}/o/965.png`, mediaType: 'image' })); await a.loaded(a.media(), 2000, 1000);
    await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Fit'); return a.tf(); },
  (o) => o.rot === 0 && o.fx === 1,
  [['repair probe: Fit keeps rotation', '\t\t\trotation = 0;\n\t\t\tflipH = false;\n\t\t\tflipV = false;\n\t\t\tpanX = 0;\n\t\t\tpanY = 0;\n\t\t\tapplyConfiguredFit();', '\t\t\tpanX = 0;\n\t\t\tpanY = 0;\n\t\t\tapplyConfiguredFit();']]);

// F. Close, dispose, focus
add('F1', 'close returns focus to the native card link when focus was inside the viewer; otherwise focus is left alone',
  async (src) => { const a = await session({ source: src }); await a.click(0); const xb = [...a.doc.querySelectorAll('.be-viewer-btn')].find((q) => q.title.startsWith('Close')); xb.focus(); const x = xb.click() || xb; await a.wait(0); const back = a.doc.activeElement === a.art(0).querySelector('a');
    const b = await session({ source: src }); await b.click(0); const other = b.art(2).querySelector('a'); other.focus(); await b.key('Escape'); return { back, x: !!x, left: b.doc.activeElement === other, closed: !a.isOpen() && !b.isOpen() }; },
  (o) => o.back && o.left && o.closed,
  [['no focus return', '\t\t\t\tif (returnFocusOrigin?.isConnected) returnFocusOrigin.focus();', '\t\t\t\tif (false) returnFocusOrigin.focus();']]);
add('F2', '[FINDING] open does not move focus into the viewer and the overlay has no dialog semantics (no role, no aria-modal)',
  async (src) => { const a = await session({ source: src }); const l = a.art(0).querySelector('a'); l.focus(); await a.click(0); return { inside: a.overlay().contains(a.doc.activeElement), role: a.overlay().getAttribute('role'), modal: a.overlay().getAttribute('aria-modal') }; },
  (o) => !o.inside && o.role === null && o.modal === null,
  [['repair probe: dialog role', "\t\t\toverlay = BE.dom.create('div', { id: 'be-viewer-overlay' });", "\t\t\toverlay = BE.dom.create('div', { id: 'be-viewer-overlay' }); overlay.setAttribute('role', 'dialog');"]]);
add('F3', 'dispose: overlay removed, keys inert, late metadata update is a no-op, and a later open re-initializes',
  async (src) => { const a = await session({ source: src }); await a.click(0); a.BE.modules.viewer.dispose(); await a.wait(0); const gone = !a.overlay();
    await a.key('d'); await a.update(post(101, { originalUrl: `${M}/o/x.png`, mediaType: 'image' })); const spies = a.st.spies.length;
    await a.open(post(970, { originalUrl: `${M}/o/970.png`, mediaType: 'image' })); return { gone, spies, reopened: a.isOpen() && !!a.overlay(), errs: a.errors().length }; },
  (o) => o.gone && o.spies === 0 && o.reopened && o.errs === 0,
  [['owner not disposed', '\t\t\tclose();\n\t\t\tviewerOwner?.dispose();', '\t\t\tclose();']]);

// G. Keyboard
add('G1', 'keys: Escape closes; ArrowRight/ArrowLeft move to the next/previous card; Space plays a paused video; handled keys are preventDefault-ed',
  async (src) => { const a = await session({ source: src, video: [1] }); await a.click(0); const r = await a.key('ArrowRight'); const id1 = a.BE.modules.viewer.currentPost?.id; const v = a.media();
    const sp = await a.key(' '); const plays = a.ops(v).filter((x) => x === 'play').length; await a.key('ArrowLeft'); const id0 = a.BE.modules.viewer.currentPost?.id; const esc = await a.key('Escape');
    return { id1, id0, plays, prevented: [r.defaultPrevented, sp.defaultPrevented, esc.defaultPrevented], closed: !a.isOpen() }; },
  (o) => o.id1 === '102' && o.id0 === '101' && o.plays >= 1 && o.prevented.every(Boolean) && o.closed,
  [['handled keys not prevented', '\t\t\tif (fn) { e.preventDefault(); fn(); }', '\t\t\tif (fn) { fn(); }']]);
add('G2', '[DEFECT V-D5] viewer keys ignore modifiers: Ctrl+F toggles Favorite (an account mutation path) and blocks the browser\'s Find; Ctrl+D downloads; Ctrl+O opens the original',
  async (src) => { const a = await session({ source: src }); await a.click(0); const f = await a.key('f', { ctrlKey: true }); await a.key('d', { ctrlKey: true }); await a.key('o', { metaKey: true });
    return { spies: a.st.spies.map((x) => x[0]), prevented: f.defaultPrevented }; },
  (o) => o.spies.includes('favorite') && o.spies.includes('download') && o.spies.includes('window.open') && o.prevented,
  [['repair probe: modifier guard', "\t\t\tif (!overlay || overlay.style.display !== 'flex') return;\n\t\t\tconst keys = {", "\t\t\tif (!overlay || overlay.style.display !== 'flex') return;\n\t\t\tif (e.ctrlKey || e.metaKey || e.altKey) return;\n\t\t\tconst keys = {"]]);
add('G3', '[FINDING] Space is handled at document level even when the native video control has focus (play() + preventDefault); the real-browser interaction with native controls is UNKNOWN (browser evidence)',
  async (src) => { const a = await session({ source: src, video: [0] }); await a.click(0); const v = a.media(); const e = await a.key(' ', {}, v); return { plays: a.ops(v).filter((x) => x === 'play').length, prevented: e.defaultPrevented }; },
  (o) => o.plays >= 1 && o.prevented,
  [['repair probe: leave keys to a focused media element', '\t\t\tconst fn = keys[e.key];', "\t\t\tconst fn = e.target && e.target.tagName === 'VIDEO' ? null : keys[e.key];"]]);
add('G4', '[FINDING] a rejected play() (autoplay/permission refusal) is swallowed: no blocked-Play state, no message; native controls remain the only Play affordance',
  async (src) => { const a = await session({ source: src, video: [0] }); a.st.play = 'reject'; await a.click(0); const v = a.media(); await a.loaded(v, 640, 360); await a.key(' '); await a.wait(50);
    return { plays: a.ops(v).filter((x) => x === 'play').length, state: a.state(), controls: v.controls, errs: a.errors().length }; },
  (o) => o.plays >= 1 && o.state === null && o.controls === true,
  [['repair probe: blocked-Play state', '\t\t\t\tmediaEl.paused ? mediaEl.play().catch(() => {}) : mediaEl.pause();', "\t\t\t\tmediaEl.paused ? mediaEl.play().catch(() => showMediaState('Play blocked', mediaGeneration, 0, true)) : mediaEl.pause();"]]);
add('G5', 'keys are inert while the viewer is closed: no action and page keys (arrows, Space, Escape) are not prevented',
  async (src) => { const a = await session({ source: src }); await a.click(0); await a.key('Escape'); const ev = []; for (const k of ['ArrowRight', ' ', 'Escape', 'd', 'f']) ev.push((await a.key(k)).defaultPrevented); return { spies: a.st.spies.length, prevented: ev }; },
  (o) => o.spies === 0 && o.prevented.every((x) => !x),
  [['closed-state check removed', "\t\t\tif (!overlay || overlay.style.display !== 'flex') return;\n\t\t\tconst keys = {", '\t\t\tif (!overlay) return;\n\t\t\tconst keys = {']]);

// H. Playback preferences (structural; actual playback needs a browser)
add('H1', 'video element reflects autoplay / loop / mute exactly for all 8 combinations (muted and defaultMuted both follow mute); controls on; preload auto',
  async (src) => { const out = []; for (const ap of [true, false]) for (const lp of [true, false]) for (const mu of [true, false]) {
      const a = await session({ source: src, settings: vset({ autoplayVideo: ap, loopVideo: lp, muteVideo: mu }) }); await a.open(post(980, { originalUrl: `${M}/o/980.webm`, mediaType: 'video' })); const v = a.media();
      out.push({ want: [ap, lp, mu], got: [v.autoplay, v.loop, v.muted, v.defaultMuted, v.controls, v.preload] }); } return out; },
  (o) => o.every(({ want: [ap, lp, mu], got: [gap, glp, gmu, gdm, gc, gp] }) => gap === ap && glp === lp && gmu === mu && gdm === mu && gc === true && gp === 'auto'),
  [['explicit mute=false forcibly remuted', "\t\t\t\tel.muted = !!BE.settings.get('viewer.muteVideo');", '\t\t\t\tel.muted = true;'],
    ['loop=false ignored', "\t\t\t\tel.loop = !!BE.settings.get('viewer.loopVideo');", '\t\t\t\tel.loop = true;'],
    ['autoplay=false ignored', "\t\t\t\tel.autoplay = !!BE.settings.get('viewer.autoplayVideo');", '\t\t\t\tel.autoplay = true;']]);
add('H2', 'remember volume: on -> stored volume applied and changes stored; off -> default volume 1 and nothing stored',
  async (src) => { const a = await session({ source: src, settings: { 'be:viewer:volume': '0.37' } }); await a.open(post(981, { originalUrl: `${M}/o/981.webm`, mediaType: 'video' })); const v = a.media(); const applied = v.volume;
    v.volume = 0.6; await a.fire(v, 'volumechange'); const stored = a.BE.store.get('viewer:volume'); await a.open(post(982, { originalUrl: `${M}/o/982.webm`, mediaType: 'video' })); const next = a.media().volume;
    const b = await session({ source: src, settings: { 'be:viewer:volume': '0.37', ...vset({ rememberVolume: false }) } }); await b.open(post(983, { originalUrl: `${M}/o/983.webm`, mediaType: 'video' })); const w = b.media();
    const offApplied = w.volume; w.volume = 0.2; await b.fire(w, 'volumechange'); return { applied, stored, next, offApplied, offStored: b.BE.store.get('viewer:volume') }; },
  (o) => near(o.applied, 0.37) && near(o.stored, 0.6) && near(o.next, 0.6) && near(o.offApplied, 1) && near(o.offStored, 0.37),
  [['remembered volume lost', '\t\t\t\t\tel.volume = vol;\n', ''],
    ['volume changes not stored', "\t\t\t\t\tel.addEventListener('volumechange', () => BE.store.set('viewer:volume', el.volume));\n", '']]);
add('H3', 'deliberate unmute then next video: the next video starts muted again (mute preference re-applied per video) at the remembered volume',
  async (src) => { const a = await session({ source: src }); await a.open(post(984, { originalUrl: `${M}/o/984.webm`, mediaType: 'video' })); const v = a.media(); v.muted = false; v.volume = 0.5; await a.fire(v, 'volumechange');
    await a.open(post(985, { originalUrl: `${M}/o/985.webm`, mediaType: 'video' })); const n = a.media(); return { muted: n.muted, vol: n.volume, stillUnmutedOld: v.muted === false }; },
  (o) => o.muted === true && near(o.vol, 0.5) && o.stillUnmutedOld,
  [['remembered volume lost', '\t\t\t\t\tel.volume = vol;\n', ''],
    ['mute preference not applied', "\t\t\t\tel.muted = !!BE.settings.get('viewer.muteVideo');", '\t\t\t\tel.muted = false;']]);

async function main() {
  const results = [];
  const blob = h.gitBlobId(PROD);
  results.push({ id: 'S0', name: `production under test is blob ${EXPECTED_BLOB} (4d793a2)`, pass: blob === EXPECTED_BLOB, detail: blob });
  for (const k of CASES) {
    let obs = null; let pass = false; let err = null;
    try { obs = await k.run(PROD); pass = !!k.ok(obs); } catch (e) { err = String(e && e.message || e); }
    const faults = [];
    for (const [label, from, to] of k.mutants) {
      let caught = false; let ferr = null;
      try { const o = await k.run(mustReplace(PROD, from, to)); caught = !k.ok(o); } catch (e) { ferr = String(e && e.message || e); caught = !/anchor matched/.test(ferr); }
      faults.push({ label, caught, error: ferr && ferr.slice(0, 160) });
    }
    results.push({ id: k.id, name: k.name, pass, detail: pass ? '' : S(obs || err).slice(0, 700), faults });
  }
  let failed = 0; let faultsTotal = 0; let faultsCaught = 0;
  for (const r of results) {
    if (!r.pass) failed++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id} ${r.name}${r.pass ? '' : `  -- ${r.detail}`}`);
    for (const f of r.faults || []) { faultsTotal++; if (f.caught) faultsCaught++; else console.log(`  FAULT NOT CAUGHT  ${f.label}${f.error ? ` (${f.error})` : ''}`); }
  }
  const checks = results.length;
  console.log(`\n${checks - failed}/${checks} checks passed; fault controls caught ${faultsCaught}/${faultsTotal}`);
  fs.writeFileSync(path.join(__dirname, 'viewer-baseline-result.json'), `${JSON.stringify({ probe: 'ib11-e0-viewer-baseline', productionBlob: blob, checks, passed: checks - failed, faultsTotal, faultsCaught,
    results: results.map((r) => ({ id: r.id, name: r.name, pass: r.pass, faults: (r.faults || []).map((f) => ({ label: f.label, caught: f.caught })) })) }, null, 1)}\n`);
  process.exitCode = failed === 0 && faultsCaught === faultsTotal ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
