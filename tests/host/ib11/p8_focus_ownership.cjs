'use strict';
// IB11-P8 (focus ownership/return) permanent regression. Owner decision: the
// viewer owns focus while open (initial focus: its Close button); Tab and
// Shift+Tab stay within the viewer-owned controls (the current viewer DOM,
// boundaries wrap); closing restores the invoking origin, else the declared
// fallback, else nothing. A context-less new open returns to the element
// focused before it; an open viewer keeps its return targets.
//
// Harness: the browser's native Tab move is emulated after dispatch when the
// viewer did not prevent the event (next/previous rendered tabbable element
// of the WHOLE page, wrapping), so an untrapped Tab really escapes to the page
// controls behind the overlay; Ctrl/Meta/Alt+Tab belong to the browser and
// move nothing in the page. A click on the empty stage blurs focus to body
// first, as in a browser.
//
// Sources: repair (working tree); prior 7e4c643 (pre-P8); mutants
// NO-ACQUIRE (no initial focus), NO-TRAP (no Tab trap), NO-RESTORE (no focus
// return on close), NO-IMPLICIT (no implicit origin for context-less opens),
// REPLACE-ORIGIN (an open viewer replaces its return origin), EARLY-FOCUS
// (focus taken before the media build), TRAP-ALL (modified Tab trapped too).
// Each check states which sources must fail it (null = not constrained); the
// prior's apparent "return" is never accepted alone: every return check first
// requires focus to have been inside the viewer.
// Usage: node tests/host/ib11/p8_focus_ownership.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const ACQ = '\t\t\tif (closeBtn && (!wasOpen || !overlay.contains(document.activeElement))) closeBtn.focus({ preventScroll: true });\n';
const TRAP = "\t\t\tif (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) { trapTab(e); return; }\n";
const IMPLICIT = '\t\t\telse if (!wasOpen) returnFocusOrigin = usableReturnTarget(before) ? before : null;\n';
const SOURCES = {
  repair: REPAIR,
  prior: hh.sourceAt('7e4c643', '5da8fd9d69a65af6009fed66a0874bb8b96ce64b'),
  noAcquire: mustReplace(REPAIR, ACQ, ''),
  noTrap: mustReplace(REPAIR, TRAP, ''),
  noRestore: mustReplace(REPAIR, '\t\t\tif (shouldReturnFocus) {\n\t\t\t\tif (usableReturnTarget(returnFocusOrigin))', '\t\t\tif (false) {\n\t\t\t\tif (usableReturnTarget(returnFocusOrigin))'),
  noImplicit: mustReplace(REPAIR, IMPLICIT, '\t\t\telse if (!wasOpen) returnFocusOrigin = null;\n'),
  replaceOrigin: mustReplace(REPAIR, IMPLICIT, '\t\t\telse returnFocusOrigin = usableReturnTarget(before) ? before : null;\n'),
  earlyFocus: mustReplace(REPAIR, "\t\t\toverlay.style.display = 'flex';\n\t\t\treplaceMedia(post, { rethrowBuildError: !wasOpen });", "\t\t\toverlay.style.display = 'flex';\n\t\t\tif (closeBtn) closeBtn.focus();\n\t\t\treplaceMedia(post, { rethrowBuildError: !wasOpen });"),
  trapAll: mustReplace(REPAIR, TRAP, "\t\t\tif (e.key === 'Tab') { trapTab(e); return; }\n"),
};
const M = 'https://static.example';
const LINK_BOX = [520, 392, 80, 16];
const TABBABLE = 'a[href], button, input, select, textarea, video[controls], audio[controls], [tabindex]';

async function session(source, { settings = {}, video = [] } = {}) {
  let clock = null; const st = { stageW: 1000, stageH: 800 }; const calls = []; const spies = []; const focusins = [];
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
    for (const [P, wk, hk] of [[w.HTMLImageElement.prototype, 'naturalWidth', 'naturalHeight'], [w.HTMLVideoElement.prototype, 'videoWidth', 'videoHeight']]) {
      Object.defineProperty(P, wk, { configurable: true, get() { return this.__nat ? this.__nat[0] : 0; } });
      Object.defineProperty(P, hk, { configurable: true, get() { return this.__nat ? this.__nat[1] : 0; } });
    }
    const MP = w.HTMLMediaElement.prototype;
    MP.play = function () { calls.push('play'); return Promise.resolve(); }; MP.pause = function () { calls.push('pause'); }; MP.load = function () {};
    w.open = (u) => { spies.push(['open', String(u)]); return null; };
    w.document.addEventListener('focusin', (e) => focusins.push(e.target), true);
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document; const BE = c.BE; const V = BE.modules.viewer;
  BE.modules.favorites.toggle = (p) => { spies.push(['favorite', p && String(p.id)]); };
  const art = (i) => doc.querySelectorAll('article')[i];
  const overlay = () => doc.querySelector('#be-viewer-overlay');
  const rendered = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { if (n.hidden) return false; if (w.getComputedStyle(n).display === 'none') return false; } return true; };
  const pageTabbables = () => [...doc.querySelectorAll(TABBABLE)].filter((el) => el.tabIndex >= 0 && !el.disabled && rendered(el));
  const a = {
    w, doc, BE, V, st, calls, spies, focusins, art, overlay, pageTabbables,
    wait: (ms) => clock.advance(ms),
    link: (i) => art(i).querySelector('a'),
    cardId: (i) => art(i).getAttribute('data-id'),
    closeBtn: () => [...doc.querySelectorAll('.be-viewer-btn')].find((b) => b.title.startsWith('Close')),
    btn: (title) => [...doc.querySelectorAll('.be-viewer-btn')].find((b) => b.title.startsWith(title)),
    media: () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video'),
    active: () => doc.activeElement,
    inViewer: () => !!overlay() && overlay().contains(doc.activeElement),
    // mouse origin: the press focuses the card link, then the click opens
    mouseOpen: async (i) => { const l = a.link(i); l.focus(); const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); l.querySelector('img').dispatchEvent(e); await clock.advance(0); return e; },
    // keyboard origin: the link is focused (by Tab), Enter activates it (a click on the link)
    keyOpen: async (i) => { const l = a.link(i); l.focus(); l.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); l.dispatchEvent(e); await clock.advance(0); return e; },
    key: async (k, mods = {}) => { const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }); (doc.activeElement || doc.body).dispatchEvent(e); await clock.advance(0); return e; },
    // Tab as a browser does it: dispatch, then the native move unless prevented (modified Tab is the browser's)
    tab: async (shift = false, mods = {}) => {
      const e = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true, ...mods }); (doc.activeElement || doc.body).dispatchEvent(e);
      if (!e.defaultPrevented && !mods.ctrlKey && !mods.metaKey && !mods.altKey) { const list = pageTabbables(); const i = list.indexOf(doc.activeElement); const next = shift ? list[(i <= 0 ? list.length : i) - 1] : list[(i + 1) % list.length]; if (next) next.focus(); }
      await clock.advance(0); return e; },
    clickEl: async (el) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); el.dispatchEvent(e); await clock.advance(0); return e; },
    // press on the empty stage: a non-focusable area blurs focus to body, then the click
    stageClick: async () => { if (doc.activeElement && doc.activeElement !== doc.body) doc.activeElement.blur(); return a.clickEl(doc.querySelector('.be-viewer-stage')); },
    viewerFocusables: () => [...overlay().querySelectorAll(TABBABLE)].filter((el) => el.tabIndex >= 0 && !el.disabled && rendered(el)),
  };
  return a;
}

const X = (o) => ({ prior: null, noAcquire: null, noTrap: null, noRestore: null, noImplicit: null, replaceOrigin: null, earlyFocus: null, trapAll: null, ...o });
const P = X({ prior: true, noAcquire: true, noTrap: true, noRestore: true, noImplicit: true, replaceOrigin: true, earlyFocus: true, trapAll: true });
const CHECKS = [
  ['P8-1 [focus] mouse-origin open: focus moves into the viewer (prior leaves it on the invoking card link)', async (src) => {
    const a = await session(src); const l = a.link(0); await a.mouseOpen(0); return a.V.isOpen() && a.inViewer() && a.active() !== l; }, X({ prior: false, noAcquire: false })],
  ['P8-2 [focus] the initial focus after a successful new open is the viewer Close button (mouse and keyboard origin)', async (src) => {
    const a = await session(src); await a.mouseOpen(0); const m = a.active() === a.closeBtn(); await a.key('Escape');
    const b = await session(src); await b.keyOpen(1); return m && b.V.isOpen() && b.active() === b.closeBtn(); }, X({ prior: false, noAcquire: false })],
  ['P8-3 [trap] Tab from the last viewer control (Close) wraps to the first viewer-owned control', async (src) => {
    const a = await session(src); await a.mouseOpen(0); a.closeBtn().focus(); const f = a.viewerFocusables(); const e = await a.tab(false);
    return f[f.length - 1] === a.closeBtn() && a.active() === f[0] && e.defaultPrevented; }, X({ prior: false, noTrap: false })],
  ['P8-4 [trap] Shift+Tab from the first viewer-owned control wraps to the last (Close)', async (src) => {
    const a = await session(src); await a.mouseOpen(0); const f = a.viewerFocusables(); f[0].focus(); const e = await a.tab(true);
    return a.active() === a.closeBtn() && e.defaultPrevented; }, X({ prior: false, noTrap: false })],
  ['P8-5 [trap] page controls behind the overlay never receive focus: two full cycles of Tab and of Shift+Tab stay inside the viewer, visiting every viewer control', async (src) => {
    const a = await session(src); await a.mouseOpen(0); a.closeBtn().focus(); const n = a.viewerFocusables().length; const seen = new Set();
    for (const shift of [false, true]) for (let i = 0; i < 2 * n + 1; i++) { await a.tab(shift); if (!a.inViewer()) return false; seen.add(a.active()); }
    return seen.size === n; }, X({ prior: false, noTrap: false })],
  ['P8-6 [trap] a dynamically present native recovery link joins the current viewer focus set (first, before the toolbar) without allowing escape', async (src) => {
    const a = await session(src); const o = a.link(2); o.focus();
    a.V.open({ id: '981', originalUrl: `${M}/o/981.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/981' }, {}, { origin: o }); await a.wait(0);
    a.media().dispatchEvent(new a.w.Event('error')); await a.wait(50);
    const l = a.doc.querySelector('.be-viewer-native-fallback'); const f = a.viewerFocusables(); if (!l || f[0] !== l) return false;
    a.closeBtn().focus(); await a.tab(false); const toLink = a.active() === l; await a.tab(true); const back = a.active() === a.closeBtn();
    for (let i = 0; i < f.length + 2; i++) { await a.tab(false); if (!a.inViewer()) return false; }
    return toLink && back; }, X({ prior: false, noTrap: false })],
  ['P8-7 [return] Escape restores the invoking origin after the viewer owned focus', async (src) => {
    const a = await session(src); const l = a.link(0); await a.mouseOpen(0); const owned = a.active() === a.closeBtn(); await a.key('Escape');
    return owned && !a.V.isOpen() && a.active() === l; }, X({ prior: false, noAcquire: false, noRestore: false })],
  ['P8-8 [return] the Close button (click) restores the invoking origin', async (src) => {
    const a = await session(src); const l = a.link(1); await a.keyOpen(1); const owned = a.inViewer(); a.closeBtn().focus(); await a.clickEl(a.closeBtn());
    return owned && !a.V.isOpen() && a.active() === l; }, X({ prior: false, noRestore: false })],
  ['P8-9 [return] a click on the empty stage (focus blurred to body first) closes and restores the invoking origin', async (src) => {
    const a = await session(src); const l = a.link(0); await a.mouseOpen(0); const owned = a.inViewer(); await a.stageClick();
    return owned && !a.V.isOpen() && a.active() === l; }, X({ prior: false, noRestore: false })],
  ['P8-10 [return] a removed origin falls back to the declared connected fallback', async (src) => {
    const a = await session(src); const o = a.link(0); const fb = a.link(2); o.focus();
    a.V.open({ id: '982', originalUrl: `${M}/o/982.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/982' }, {}, { origin: o, fallback: fb }); await a.wait(0);
    const owned = a.inViewer(); o.remove(); await a.key('Escape'); return owned && !a.V.isOpen() && a.active() === fb; }, X({ prior: false, noRestore: false })],
  ['P8-11 [return] with neither origin nor fallback, close invents no target and does not throw (focus is not moved to a card or the page)', async (src) => {
    const a = await session(src); if (a.active() && a.active() !== a.doc.body) a.active().blur();
    a.V.open({ id: '983', originalUrl: `${M}/o/983.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/983' }); await a.wait(0);
    await a.key('Escape'); const act = a.active(); return !a.V.isOpen() && (act === a.doc.body || a.overlay().contains(act)) && !a.doc.querySelector('article')?.contains(act); }, P],
  ['P8-12 [return] a context-less viewer.open() returns to the element focused before it (e.g. a page toolbar control)', async (src) => {
    const a = await session(src); const t = a.doc.createElement('button'); t.textContent = 'page tool'; a.doc.body.insertBefore(t, a.doc.body.firstChild); t.focus();
    a.V.open({ id: '984', originalUrl: `${M}/o/984.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/984' }); await a.wait(0);
    const owned = a.active() === a.closeBtn(); await a.key('Escape'); return owned && a.active() === t; }, X({ prior: false, noImplicit: false, noRestore: false })],
  ['P8-13 [return] an operation on an already-open viewer without a context keeps the existing return origin (not the focused viewer control)', async (src) => {
    const a = await session(src); const l = a.link(0); await a.mouseOpen(0); const owned = a.inViewer();
    a.V.open({ id: '985', originalUrl: `${M}/o/985.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/985' }); await a.wait(0);
    const stillInside = a.inViewer(); await a.key('Escape'); return owned && stillInside && a.active() === l; }, X({ prior: false, replaceOrigin: false })],
  ['P8-14 [acquire timing] a synchronous initial takeover failure (stored volume 1.5, video card) does not take focus into the abandoned viewer', async (src) => {
    const a = await session(src, { video: [0], settings: { 'be:viewer:volume': '1.5' } }); const l = a.link(0); l.focus(); a.focusins.length = 0;
    const e = new a.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); l.querySelector('img').dispatchEvent(e); await a.wait(0);
    const ov = a.overlay(); return !a.V.isOpen() && !e.defaultPrevented && a.active() === l && !a.focusins.some((t) => ov && ov.contains(t)); }, X({ prior: true, earlyFocus: false })],
  ['P8-15 [focus] in-viewer navigation keeps focus inside: the focused Next button stays focused across the target change; escaped focus is reclaimed to Close', async (src) => {
    const a = await session(src); await a.mouseOpen(0); const next = a.btn('Next'); next.focus(); await a.clickEl(next);
    const kept = a.V.currentPost && String(a.V.currentPost.id) === a.cardId(1) && a.active() === next;
    a.active().blur(); await a.key('ArrowRight'); const reclaimed = String(a.V.currentPost.id) === a.cardId(2) && a.active() === a.closeBtn();
    return kept && reclaimed; }, X({ prior: false })],
  ['P8-16 [V-D5] Ctrl/Meta/Alt+Tab is not handled as viewer traversal: not prevented, focus not moved by the viewer', async (src) => {
    const a = await session(src); await a.mouseOpen(0); a.closeBtn().focus();
    for (const mods of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { ctrlKey: true, shiftKey: true }]) { const e = await a.tab(!!mods.shiftKey, mods); if (e.defaultPrevented || a.active() !== a.closeBtn()) return false; }
    return true; }, X({ prior: true, trapAll: false })],
  ['P8-17 [inert] while the viewer is closed, Tab is not intercepted and moves through the page natively', async (src) => {
    const a = await session(src); const l = a.link(0); l.focus(); const list = a.pageTabbables(); const e = await a.tab(false);
    return !e.defaultPrevented && a.active() === list[list.indexOf(l) + 1] && !a.V.isOpen(); }, P],
  // ---- preservation ----
  ['P8-18 [preserved] V-D5: Ctrl+F / Ctrl+D inert and not prevented; unmodified f favorites, Escape closes, arrows navigate', async (src) => {
    const a = await session(src); await a.mouseOpen(0); const e1 = await a.key('f', { ctrlKey: true }); const e2 = await a.key('d', { ctrlKey: true }); const n = a.spies.length;
    await a.key('f'); const fav = a.spies.filter((x) => x[0] === 'favorite').length === 1; await a.key('ArrowRight'); const nav = String(a.V.currentPost.id) === a.cardId(1); await a.key('Escape');
    return !e1.defaultPrevented && !e2.defaultPrevented && n === 0 && fav && nav && !a.V.isOpen(); }, P],
  ['P8-19 [preserved] V-D8: the native link is pointer-interactive and hit-tested; a click on it is not prevented and does not close the viewer', async (src) => {
    const a = await session(src); a.V.open({ id: '986', originalUrl: `${M}/o/986.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/986' }); await a.wait(0);
    a.media().dispatchEvent(new a.w.Event('error')); await a.wait(50); const l = a.doc.querySelector('.be-viewer-native-fallback'); const hit = a.doc.elementFromPoint(LINK_BOX[0] + 40, LINK_BOX[1] + 8);
    const e = await a.clickEl(hit); return !!l && hit === l && a.w.getComputedStyle(l).pointerEvents === 'auto' && !e.defaultPrevented && a.V.isOpen(); }, P],
  ['P8-20 [preserved] V-D1: a late same-post update keeps an established failure state and link', async (src) => {
    const a = await session(src); const p = { id: '987', originalUrl: `${M}/o/987.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/987' }; a.V.open(p); await a.wait(0);
    a.media().dispatchEvent(new a.w.Event('error')); await a.wait(50); a.V.updatePost({ ...p }); await a.wait(500); return !!a.doc.querySelector('.be-viewer-native-fallback'); }, P],
  ['P8-21 [preserved] V-D6b: in-viewer navigation onto a failing video communicates the failure with the target\'s link', async (src) => {
    const a = await session(src, { video: [1], settings: { 'be:viewer:volume': '1.5' } }); await a.mouseOpen(0); await a.key('ArrowRight'); await a.wait(50);
    return a.V.isOpen() && String(a.V.currentPost.id) === a.cardId(1) && !!a.doc.querySelector('.be-viewer-native-fallback') && !a.media(); }, P],
  ['P8-22 [preserved] P6 / V-D4: a 90-degree resize refit uses the exchanged dimensions; P7: a card opens on its staged sample', async (src) => {
    const a = await session(src); await a.mouseOpen(0); const staged = a.media().getAttribute('src') === a.art(0).getAttribute('data-sample-url');
    const b = await session(src); b.V.open({ id: '988', originalUrl: `${M}/o/988.png`, mediaType: 'image', postUrl: 'https://e621.net/posts/988' }); await b.wait(0);
    const el = b.media(); el.__nat = [2000, 1000]; el.dispatchEvent(new b.w.Event('load')); await b.wait(20); b.btn('Rotate right').click(); b.st.stageW = 1000; b.st.stageH = 800; b.w.dispatchEvent(new b.w.Event('resize')); await b.wait(150);
    const m = /scale\(([\d.]+)\)/.exec(b.media().style.transform); return staged && !!m && Math.abs(Number(m[1]) - Math.min(976 / 1000, 776 / 2000)) < 1e-9; }, P],
  ['P8-23 [preserved] playback: Space plays a paused viewer video (also while Close is focused) and does not activate the Close button', async (src) => {
    const a = await session(src, { video: [0] }); await a.mouseOpen(0); a.closeBtn().focus(); const n0 = a.calls.filter((x) => x === 'play').length; const e = await a.key(' ');
    return a.calls.filter((x) => x === 'play').length > n0 && e.defaultPrevented && a.V.isOpen(); }, P],
  ['P8-24 [preserved] the Fit button still resets rotation (E6); zoom and flips apply', async (src) => {
    const a = await session(src); await a.mouseOpen(0); await a.clickEl(a.btn('Rotate right')); await a.clickEl(a.btn('Flip horizontal')); await a.clickEl(a.btn('Fit'));
    const t = a.media().style.transform; return /rotate\(0deg\)/.test(t) && /scaleX\(1\)/.test(t) && a.V.isOpen(); }, P],
  ['P8-25 [preserved] close and dispose clean up: the overlay is hidden then removed, keys are inert afterwards', async (src) => {
    const a = await session(src); await a.mouseOpen(0); await a.key('Escape'); const hidden = a.overlay().style.display === 'none' && a.doc.querySelector('.be-viewer-stage').childElementCount === 0;
    await a.mouseOpen(1); a.V.dispose(); await a.wait(0); const e = await a.tab(false); return hidden && !a.overlay() && !e.defaultPrevented; }, P],
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
  fs.writeFileSync(path.join(__dirname, 'p8-focus-ownership-result.json'), `${JSON.stringify({ probe: 'ib11-p8-focus', productionBlob: blob, prior: '7e4c643', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
