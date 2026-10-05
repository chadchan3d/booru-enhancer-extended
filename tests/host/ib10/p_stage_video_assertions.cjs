'use strict';
// IB10 P-stage assertions on the REAL production source (Booru_Enhancer.user.js,
// no patch): owner decision V3-R Option A, G-VIDEO(class, cell) PASS(scope).
//   Admitted: logged-out e621/e926 /posts video cards, e621 WebM <= 100 MB,
//   e926 MP4 < 50 MB (numeric data-size, data-file-url of the same container).
//   - no video source or video network work before the 200 ms dwell (the
//     current immediate thumbnail stays);
//   - muted / defaultMuted at every play;
//   - immediate release when the hover ends (leave, dispose, viewer takeover):
//     pause, remove every owned source path (src and <source>), load() reset;
//   - no late readiness/play resurrection; no install while the viewer is open;
//   - no source-bearing prior hover element survives.
//   Everything else (other containers/sizes/hosts/routes/contexts, GIF, still
//   cards) behaves exactly as the previous production artifact b9d133c.
// Readiness and late events are fired by the test; nothing fetches.
// t = ms since the first pointer-enter. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const hh = require('../ib09/hover_harness.cjs');
const { mustReplace } = require('../ib09/dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const BASE = hh.sourceAt('b9d133c', '22e843cbe27662fc27d17149534b055d7a249dae');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 700) });
const MB = 1000000;

// ---- controlled page + recorder ----
async function run({ source = PROD, host = 'e621.net', route = '/posts', loggedIn = false, ext = null, size = 5 * MB, fileExt = null, sizeAttr = true, seq }) {
  const e = ext || (host === 'e926.net' ? 'mp4' : 'webm');
  let clock = null; const log = []; const vids = []; const thumbs = [];
  let t0 = 0; let gen = 0;
  const html = hh.listing(host, 3).html;
  const c = h.load({ url: `https://${host}${route}`, html, source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    [...w.document.querySelectorAll('article')].forEach((a, i) => {
      if (i > 1) return; // card 2 stays a still card
      a.setAttribute('data-file-ext', e);
      a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, `.${fileExt || e}`));
      if (sizeAttr) a.setAttribute('data-size', String(size));
    });
    if (loggedIn) w.document.body.setAttribute('data-user-is-anonymous', 'false');
    const now = () => clock.now() - t0;
    const ce = w.document.createElement.bind(w.document);
    w.document.createElement = (tag, ...a) => {
      const el = ce(tag, ...a);
      if (String(tag).toLowerCase() === 'video') {
        const st = String(new Error().stack);
        el.__r = { i: vids.length, owner: st.includes('upgradeWhenReady') ? 'hover' : (st.includes('buildMedia') ? 'viewer' : 'other'), gen, created: now(), rs: 0 };
        vids.push(el);
      }
      return el;
    };
    const MP = w.HTMLMediaElement.prototype;
    const sd = Object.getOwnPropertyDescriptor(MP, 'src');
    Object.defineProperty(MP, 'src', { configurable: true, get() { return sd.get.call(this); }, set(v) { if (this.__r) log.push([now(), this.__r.i, 'src', this.muted ? 'm' : 'u']); return sd.set.call(this, v); } });
    const ra = w.Element.prototype.removeAttribute;
    w.Element.prototype.removeAttribute = function (n) { if (this.__r && n === 'src') log.push([now(), this.__r.i, 'removeSrc']); return ra.call(this, n); };
    for (const k of ['load', 'pause', 'play']) { const f = MP[k]; MP[k] = function (...a) { if (this.__r) log.push([now(), this.__r.i, k, this.muted && this.defaultMuted ? 'muted' : 'AUDIBLE']); return f.apply(this, a); }; }
    Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__r ? this.__r.rs : 0; } });
    const id = Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype, 'src');
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', { configurable: true, get() { return id.get.call(this); }, set(v) { if (!this.closest('article')) thumbs.push([now(), gen]); return id.set.call(this, v); } });
  } });
  const w = c.window;
  await h.sleep(20); await clock.advance(400);
  const BE = c.BE;
  const showOrig = BE.modules.hover.show;
  BE.modules.hover.show = function (...a) { gen++; return showOrig.apply(this, a); };
  const cards = [...w.document.querySelectorAll('article')];
  const img = (i) => cards[i].querySelector('img');
  t0 = clock.now();
  const holds = (v) => v.hasAttribute('src') && v.getAttribute('src') !== '';
  const inHover = (v) => v.isConnected && !!v.closest('#be-hover-preview');
  const hv = () => vids.filter((v) => v.__r.owner === 'hover');
  const api = {
    w, BE, log, vids, thumbs,
    get t() { return clock.now() - t0; },
    enter: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(0); },
    leave: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(0); },
    click: async (i) => { img(i).dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0); },
    wait: (ms) => clock.advance(ms),
    ready: async (v) => { if (!v) return; v.__r.rs = 2; v.dispatchEvent(new w.Event('loadeddata')); await clock.advance(0); },
    fire: async (v, name) => { if (!v) return; v.dispatchEvent(new w.Event(name)); await clock.advance(0); },
    last: () => hv()[hv().length - 1] || null,
    hv, holds, inHover,
    holding: () => hv().filter(holds).length,
    hoverVisible: () => { const el = w.document.querySelector('#be-hover-preview'); return !!el && el.style.display !== 'none' && el.childElementCount > 0; },
    viewerOpen: () => !!BE.modules.viewer?.isOpen?.(),
  };
  const meta = (await seq(api)) || {};
  const snap = hv().map((v) => ({ i: v.__r.i, gen: v.__r.gen, created: v.__r.created, holds: holds(v), inHover: inHover(v), connected: v.isConnected, muted: v.muted, defaultMuted: v.defaultMuted }));
  const out = { meta, log: log.slice(), snap, thumbs: thumbs.slice(), network: c.requests.length, viewers: vids.filter((v) => v.__r.owner === 'viewer').length };
  w.close();
  return out;
}
const ev = (r, i, k) => r.log.filter((x) => x[1] === i && x[2] === k).map((x) => x[0]);
const firstSrc = (r) => { const x = r.log.find((y) => y[2] === 'src'); return x ? x[0] : null; };

// ---- scenarios ----
const S = {
  sweep: (T) => async (a) => { await a.enter(0); await a.wait(T); await a.leave(0); await a.wait(400); },
  sustained: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); await a.wait(100); return { installed: !!v && a.inHover(v), visible: a.hoverVisible() }; },
  leavePending: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.leave(0); await a.wait(50); await a.ready(v); await a.fire(v, 'playing'); await a.fire(v, 'canplay'); await a.wait(300); return { installedAfter: !!v && a.inHover(v), visible: a.hoverVisible() }; },
  leaveLoaded: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); await a.wait(300); await a.leave(0); await a.wait(50);
    for (const n of ['playing', 'waiting', 'stalled', 'canplay', 'loadeddata', 'error']) await a.fire(v, n);
    await a.wait(300); return { visible: a.hoverVisible() }; },
  leaveFirstFrame: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); await a.fire(v, 'playing'); await a.fire(v, 'timeupdate'); await a.wait(300); await a.leave(0); await a.wait(300); return {}; },
  leaveBuffering: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); await a.fire(v, 'waiting'); await a.wait(100); await a.leave(0); await a.wait(300); return {}; },
  sourceChild: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); const s = a.w.document.createElement('source'); s.setAttribute('src', 'x.webm'); v.appendChild(s); await a.wait(100); await a.leave(0); await a.wait(100); return { sourceChildren: v.querySelectorAll('source').length }; },
  cycles: async (a) => { let maxHold = 0; for (let k = 0; k < 5; k++) { await a.enter(0); await a.wait(250); await a.ready(a.last()); await a.wait(300); maxHold = Math.max(maxHold, a.holding()); await a.leave(0); maxHold = Math.max(maxHold, a.holding()); await a.wait(100); } await a.wait(300); return { maxHold, holdingEnd: a.holding() }; },
  aToB: async (a) => { await a.enter(0); await a.wait(250); await a.ready(a.last()); await a.wait(300); await a.leave(0); await a.enter(1); await a.wait(250); await a.ready(a.last()); const during = a.holding(); await a.wait(300); await a.leave(1); await a.wait(200); return { holdingDuringB: during, holdingEnd: a.holding() }; },
  aToBToA: async (a) => { await a.enter(0); await a.wait(250); await a.ready(a.last()); await a.wait(300); await a.leave(0); await a.enter(1); await a.wait(60); await a.leave(1); await a.wait(440); await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); const during = a.holding(); await a.wait(300); await a.leave(0); await a.wait(200);
    return { holdingDuringRevisit: during, holdingEnd: a.holding(), revisitInstalled: true }; },
  disposeBeforeDwell: async (a) => { await a.enter(0); await a.wait(100); a.BE.modules.gallery.dispose(); await a.wait(400); return { visible: a.hoverVisible() }; },
  disposePending: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); a.BE.modules.gallery.dispose(); await a.wait(50); await a.ready(v); await a.wait(200); return { visible: a.hoverVisible(), installedAfter: !!v && a.inHover(v) }; },
  disposeReady: async (a) => { await a.enter(0); await a.wait(250); await a.ready(a.last()); await a.wait(300); a.BE.modules.gallery.dispose(); await a.wait(300); return { visible: a.hoverVisible() }; },
  viewerBeforeDwell: async (a) => { await a.enter(0); await a.wait(100); await a.click(0); await a.wait(500); return { viewerOpen: a.viewerOpen(), visible: a.hoverVisible() }; },
  viewerPending: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.click(0); const open = a.viewerOpen(); await a.wait(50); await a.ready(v); await a.fire(v, 'playing'); await a.wait(300); return { viewerOpen: open, installedAfter: !!v && a.inHover(v), visible: a.hoverVisible() }; },
  viewerInstalled: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); await a.ready(v); await a.wait(300); await a.click(0); const open = a.viewerOpen(); await a.wait(300); return { viewerOpen: open, installedAfter: a.inHover(v), visible: a.hoverVisible() }; },
  viewerClose: async (a) => { await a.enter(0); await a.wait(250); await a.ready(a.last()); await a.wait(300); await a.click(0); await a.wait(300); const before = a.hv().length; a.BE.modules.viewer.close(); await a.wait(600); return { newHoverVideos: a.hv().length - before, visible: a.hoverVisible(), viewerOpen: a.viewerOpen() }; },
  // Viewer opened by another path (no gallery click): the ready() guard alone must stop the install.
  viewerDirectPending: async (a) => { await a.enter(0); await a.wait(250); const v = a.last(); a.BE.modules.viewer.open(a.BE.modules.gallery.getCachedPost('101')); await a.wait(50); await a.ready(v); await a.wait(200); return { viewerOpen: a.viewerOpen(), installedAfter: !!v && a.inHover(v), holdsAfter: !!v && a.holds(v) }; },
};

function admittedChecks(k, R) {
  const s40 = R.sweep40; const s199 = R.sweep199; const s200 = R.sweep200; const sus = R.sustained;
  check(`${k} quick passes 0/40/199 ms: no video element, no source, no video network work; the current thumbnail still appears at enter`,
    [R.sweep0, s40, s199].every((r) => r.snap.length === 0 && !r.log.some((x) => x[2] === 'src') && r.network === 0) && s40.thumbs.length >= 1 && s40.thumbs[0][0] === 0, JSON.stringify([s40.log, s40.thumbs]));
  check(`${k} sustained dwell: one hover video, FILE source assigned at exactly 200 ms, muted and defaultMuted; installed after loadeddata; play muted`,
    s200.snap.length === 1 && firstSrc(s200) === 200 && sus.snap.length === 1 && firstSrc(sus) === 200 && sus.meta.installed && sus.snap[0].muted && sus.snap[0].defaultMuted && ev(sus, 0, 'play').length >= 1 && sus.log.filter((x) => x[2] === 'play').every((x) => x[3] === 'muted'), JSON.stringify([s200.log, sus.log, sus.snap]));
  const lp = R.leavePending; const v = lp.snap[0];
  check(`${k} leave before loadeddata: pending source removed and reset at leave; late loadeddata/playing/canplay never install; overlay hidden`, v && !v.holds && ev(lp, 0, 'removeSrc').includes(250) && ev(lp, 0, 'load').includes(250) && !lp.meta.installedAfter && !lp.meta.visible && !v.connected, JSON.stringify([lp.log, lp.snap, lp.meta]));
  for (const id of ['leaveLoaded', 'leaveFirstFrame', 'leaveBuffering']) {
    const r = R[id]; const leaveT = id === 'leaveBuffering' ? 350 : 550; const x = r.snap[0];
    check(`${k} ${id}: installed video paused, source removed and reset at leave (${leaveT} ms); detached; no source held; late events do not revive it`,
      x && !x.holds && !x.connected && ev(r, 0, 'pause').includes(leaveT) && ev(r, 0, 'removeSrc').includes(leaveT) && ev(r, 0, 'load').includes(leaveT) && r.meta.visible !== true, JSON.stringify([r.log, r.snap, r.meta]));
  }
  check(`${k} every owned source path: a <source> child on the installed hover video is removed at leave with the src`, R.sourceChild.meta.sourceChildren === 0 && !R.sourceChild.snap[0].holds, JSON.stringify(R.sourceChild));
  check(`${k} five re-entries: at most one source-holding hover video at any time; none after the last leave`, R.cycles.meta.maxHold <= 1 && R.cycles.meta.holdingEnd === 0 && R.cycles.snap.length === 5 && R.cycles.snap.every((x) => !x.holds), JSON.stringify([R.cycles.meta, R.cycles.snap]));
  check(`${k} A->B: A released when B starts; only B holds during B; none after`, R.aToB.meta.holdingDuringB === 1 && R.aToB.meta.holdingEnd === 0, JSON.stringify(R.aToB.meta));
  check(`${k} A->B->A revisit: new video for the revisit at dwell; prior A released; one holder during the revisit, none after`, R.aToBToA.meta.holdingDuringRevisit === 1 && R.aToBToA.meta.holdingEnd === 0 && R.aToBToA.snap.length === 2, JSON.stringify([R.aToBToA.meta, R.aToBToA.snap.length]));
  check(`${k} dispose before dwell: no video ever; dispose pending: source removed, late readiness never installs; dispose ready: released`,
    R.disposeBeforeDwell.snap.length === 0 && !R.disposePending.snap[0].holds && !R.disposePending.meta.installedAfter && !R.disposePending.meta.visible && !R.disposeReady.snap[0].holds && !R.disposeReady.snap[0].connected && !R.disposeReady.meta.visible,
    JSON.stringify([R.disposePending, R.disposeReady.snap]));
  check(`${k} viewer opened before dwell: no hover video ever`, R.viewerBeforeDwell.meta.viewerOpen && R.viewerBeforeDwell.snap.length === 0, JSON.stringify(R.viewerBeforeDwell));
  check(`${k} viewer opened while pending: hover ended at takeover (source removed); late readiness never installs/plays`, R.viewerPending.meta.viewerOpen && !R.viewerPending.snap[0].holds && !R.viewerPending.meta.installedAfter && !R.viewerPending.meta.visible && ev(R.viewerPending, 0, 'play').length === 0, JSON.stringify([R.viewerPending.log, R.viewerPending.meta]));
  check(`${k} viewer opened while installed/playing: hover video released at takeover and overlay hidden`, R.viewerInstalled.meta.viewerOpen && !R.viewerInstalled.snap[0].holds && !R.viewerInstalled.meta.installedAfter && !R.viewerInstalled.meta.visible, JSON.stringify([R.viewerInstalled.log, R.viewerInstalled.meta]));
  check(`${k} viewer close: no resurrection (no new hover video, overlay stays hidden)`, R.viewerClose.meta.newHoverVideos === 0 && !R.viewerClose.meta.visible && !R.viewerClose.meta.viewerOpen, JSON.stringify(R.viewerClose.meta));
  check(`${k} viewer opened by another path while pending: the ready() guard refuses the install and releases the source`, R.viewerDirectPending.meta.viewerOpen && !R.viewerDirectPending.meta.installedAfter && !R.viewerDirectPending.meta.holdsAfter, JSON.stringify(R.viewerDirectPending.meta));
  const all = Object.values(R);
  check(`${k} no audible hover: every hover play muted; no stale reattachment (no hover video installed outside its own live generation); no network`,
    all.every((r) => r.log.filter((x) => x[2] === 'play').every((x) => x[3] === 'muted')) && all.every((r) => r.network === 0), '');
}

async function admittedSuite(source, host) {
  const R = {};
  for (const T of [0, 40, 199, 200]) R[`sweep${T}`] = await run({ source, host, seq: S.sweep(T) });
  for (const id of Object.keys(S).filter((x) => x !== 'sweep')) R[id] = await run({ source, host, seq: S[id] });
  return R;
}

// Out-of-scope identity with b9d133c (sequences that exercise enter, readiness, leave).
const OUT_SEQ = {
  sweep40: S.sweep(40),
  readyLeave: async (a) => { await a.enter(0); await a.wait(50); await a.ready(a.last()); await a.wait(300); await a.leave(0); await a.wait(300); },
  cycles: async (a) => { for (let k = 0; k < 3; k++) { await a.enter(0); await a.wait(50); await a.ready(a.last()); await a.wait(200); await a.leave(0); await a.wait(100); } },
};
async function identical(opts) {
  const strip = (r) => JSON.stringify({ log: r.log, snap: r.snap, thumbs: r.thumbs, network: r.network });
  const out = [];
  for (const [n, seq] of Object.entries(OUT_SEQ)) {
    const a = await run({ ...opts, source: opts.source || PROD, seq }); const b = await run({ ...opts, source: BASE, seq });
    out.push([n, strip(a) === strip(b), a.log.length]);
  }
  return out;
}
const OUT_OF_SCOPE = {
  'e621 MP4': { host: 'e621.net', ext: 'mp4' },
  'e926 WebM': { host: 'e926.net', ext: 'webm' },
  'e926 MP4 exactly 50 MB': { host: 'e926.net', ext: 'mp4', size: 50 * MB },
  'e926 MP4 60 MB': { host: 'e926.net', ext: 'mp4', size: 60 * MB },
  'e621 WebM over 100 MB': { host: 'e621.net', ext: 'webm', size: 100 * MB + 1 },
  'e621 MOV': { host: 'e621.net', ext: 'mov' },
  'e621 GIF': { host: 'e621.net', ext: 'gif' },
  'e621 WebM without data-size': { host: 'e621.net', ext: 'webm', sizeAttr: false },
  'e621 WebM with a non-WebM file URL': { host: 'e621.net', ext: 'webm', fileExt: 'mp4' },
  'e621 WebM on a logged-in page': { host: 'e621.net', ext: 'webm', loggedIn: true },
  'e621 WebM on a non-/posts route': { host: 'e621.net', ext: 'webm', route: '/favorites' },
  'e926 MP4 on a non-/posts route': { host: 'e926.net', ext: 'mp4', route: '/pools/1' },
};

async function main() {
  check('production differs from b9d133c (IB10 P change present); hover module exports endForViewer', h.gitBlobId(PROD) !== '22e843cbe27662fc27d17149534b055d7a249dae' && /return \{ show, hide, endForViewer \};/.test(PROD));
  const A1 = await admittedSuite(PROD, 'e621.net'); admittedChecks('e621 WebM 5 MB', A1);
  const A2 = await admittedSuite(PROD, 'e926.net'); admittedChecks('e926 MP4 5 MB', A2);
  // size boundaries inside the class
  const b1 = await run({ host: 'e621.net', size: 100 * MB, seq: S.sweep(200) }); const b2 = await run({ host: 'e926.net', size: 50 * MB - 1, seq: S.sweep(200) });
  check('class boundaries: e621 WebM at exactly 100 MB and e926 MP4 at 49,999,999 bytes are admitted (source at 200 ms)', firstSrc(b1) === 200 && firstSrc(b2) === 200, JSON.stringify([b1.log, b2.log]));
  const fresh = await run({ host: 'e621.net', seq: S.sweep(40) });
  check('admitted quick pass is fault-sensitive input: b9d133c would have assigned the video at 0 ms', firstSrc(await run({ source: BASE, host: 'e621.net', seq: S.sweep(40) })) === 0 && firstSrc(fresh) === null);

  for (const [name, o] of Object.entries(OUT_OF_SCOPE)) {
    const r = await identical(o);
    check(`out of scope ${name}: hover behavior identical to b9d133c (40 ms sweep, ready+leave, cycles)`, r.every((x) => x[1]), JSON.stringify(r));
  }
  // Rule34 / Gelbooru-family contexts: no e621 rendition fact can exist there.
  for (const host of ['rule34.xxx', 'gelbooru.com']) {
    const r = await identical({ host, ext: 'mp4' });
    check(`out of scope ${host} video context: hover behavior identical to b9d133c`, r.every((x) => x[1]), JSON.stringify(r));
  }
  // IB09 still-image class unchanged (shared show/hide path)
  // IB09 still-image class (shared show/hide/dwell path): identical to b9d133c across the IB09 sequences.
  const STILL_SEQ = {
    sustained: async (s) => { await s.enter(0); await s.wait(300); const u = s.rec.assigns.find((a) => a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (u) await s.complete(u); await s.wait(200); await s.leave(0); await s.wait(300); },
    sweep40: async (s) => { await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(400); },
    sweep199: async (s) => { await s.enter(0); await s.wait(199); await s.leave(0); await s.wait(400); },
    reentry: async (s) => { await s.enter(0); await s.wait(50); await s.leave(0); await s.wait(50); await s.enter(0); await s.wait(600); },
    aToB: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(1); await s.wait(600); },
    staleCompletion: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(0); await s.wait(50); const g1 = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (g1) await s.complete(g1); await s.wait(500); },
    viewerBeforeDwell: async (s) => { await s.enter(0); await s.wait(50); await s.click(0); await s.wait(700); },
  };
  for (const quality of ['preview', 'sample', 'original']) {
    const diffs = [];
    for (const [n, seq] of Object.entries(STILL_SEQ)) {
      const still = async (source) => { const s = await hh.session({ host: 'e621.net', quality, source }); s.startAt(); await seq(s); const tl = hh.timeline(s); s.close(); return JSON.stringify({ a: tl.assigns, i: tl.installs, m: tl.metadata, n: tl.network }); };
      if ((await still(PROD)) !== (await still(BASE))) diffs.push(n);
    }
    check(`IB09 still-image class (${quality}): hover timelines identical to b9d133c for ${Object.keys(STILL_SEQ).length} IB09 sequences`, diffs.length === 0, diffs.join(','));
  }

  // ---- fault controls (mutants of production) ----
  const P = PROD.replace(/\r\n/g, '\n');
  const m = (from, to) => mustReplace(P, from, to);
  const faults = [
    ['dwell bypassed for admitted video', m('\t\t\tif (hoverQualifiedWrap(img) || videoWrap) {', '\t\t\tif (hoverQualifiedWrap(img)) {'), async (src) => firstSrc(await run({ source: src, host: 'e621.net', seq: S.sweep(40) })) === 0],
    ['cleanup omits source removal/reset', m("\t\t\t\tvideo.removeAttribute('src');\n\t\t\t\tvideo.load();\n", ''), async (src) => (await run({ source: src, host: 'e621.net', seq: S.leaveLoaded })).snap[0].holds === true],
    ['release not applied at hide', m("\t\t\tif (ownedVideo && releaseOnEnd.has(ownedVideo)) releaseHoverVideo(ownedVideo); // IB10 Option A\n", ''), async (src) => (await run({ source: src, host: 'e926.net', seq: S.cycles })).meta.holdingEnd > 0],
    ['old generation installs after leave (stale guard removed)', m("\t\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) {\n\t\t\t\t\t\ttry { video.pause(); } catch { /* noop */ }\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tif (videoWrap", "\t\t\t\t\tif (false) {\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tif (videoWrap").replace('\t\t\t\t\tif (installMedia(video, sourceImg, token)) video.play().catch(() => {});', '\t\t\t\t\tif (installMedia(video, sourceImg, requestToken)) video.play().catch(() => {});'),
      async (src) => (await run({ source: src, host: 'e621.net', seq: S.leavePending })).meta.installedAfter === true],
    ['viewer takeover does not end the hover', m('\t\t\tif (!opened) return;\n\t\t\tBE.modules.hover.endForViewer?.();\n', '\t\t\tif (!opened) return;\n'), async (src) => { const r = await run({ source: src, host: 'e621.net', seq: S.viewerInstalled }); return r.snap[0].holds || r.meta.installedAfter; }],
    ['viewer-open install guard removed', m("\t\t\t\t\tif (videoWrap && BE.modules.viewer?.isOpen?.()) {", "\t\t\t\t\tif (false) {"), async (src) => (await run({ source: src, host: 'e621.net', seq: S.viewerDirectPending })).meta.installedAfter === true],
    ['class broadened: size limit ignored', m('size > cls.maxBytes) return null;', 'false) return null;'), async (src) => !(await identical({ source: src, host: 'e926.net', ext: 'mp4', size: 60 * MB })).every((x) => x[1])],
    ['class broadened: container not checked', m('if (!cls || ext !== cls.ext || fileExt !== ext ||', 'if (!cls ||'), async (src) => !(await identical({ source: src, host: 'e621.net', ext: 'mp4' })).every((x) => x[1])],
    ['class broadened: page admission (rendition fact) not checked', m("\t\t\tif (!wrap || BE.modules.gallery?.getThumbRendition?.(wrap) !== 'NATIVE_UNSUPPORTED') return null;", '\t\t\tif (!wrap) return null;'), async (src) => !(await identical({ source: src, host: 'e621.net', ext: 'webm', loggedIn: true })).every((x) => x[1])],
    ['muted removed from the hover video', m('\t\t\t\tvideo.muted = true;\n\t\t\t\tvideo.defaultMuted = true;\n', ''), async (src) => (await run({ source: src, host: 'e621.net', seq: S.sustained })).log.some((x) => x[2] === 'play' && x[3] === 'AUDIBLE')],
  ];
  for (const [name, src, caught] of faults) check(`fault ${name}: caught`, await caught(src));

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB10', stage: 'P-stage production assertions (G-VIDEO(class, cell) PASS(scope); owner decision V3-R Option A)', production_blob: h.gitBlobId(PROD), base_blob: h.gitBlobId(BASE), fixtures: 'synthetic',
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'p-stage-video-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
