'use strict';
// jsdom smoke support for the IB11 V-VIEW verifier (test code). It SIMULATES
// what only a real browser provides - image loading (slow / 404 routes), a
// layout model (viewport, stage, media box from the viewer's own transform:
// scale and rotation), video playback (gplay_sim.cjs), focus movement, page
// navigation and operator input - so the runner -> recorder -> evaluator chain
// can be exercised and fault-tested. It is not browser evidence.
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const srv = require('./vview_server.cjs');
const { mediaSim } = require('./gplay_sim.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const TOOLBAR = 45;
function layout(w, env) {
  const parse = (s) => { const g = (re, d) => { const m = re.exec(s || ''); return m ? Number(m[1]) : d; }; return { tx: g(/translate\((-?[\d.]+)px/, 0), ty: g(/translate\(-?[\d.]+px, (-?[\d.]+)px/, 0), z: g(/ scale\((-?[\d.]+)\)/, 1), r: g(/rotate\((-?[\d.]+)deg\)/, 0) }; };
  const R = (x, y, wd, ht) => ({ x, y, left: x, top: y, width: wd, height: ht, right: x + wd, bottom: y + ht });
  const orig = w.Element.prototype.getBoundingClientRect;
  w.Element.prototype.getBoundingClientRect = function () {
    if (!this.isConnected) return R(0, 0, 0, 0);
    const ov = w.document.querySelector('#be-viewer-overlay');
    const shown = ov && ov.style.display === 'flex';
    if (this.classList && this.classList.contains('be-viewer-stage')) return shown ? R(0, 0, env.vw, env.vh - TOOLBAR) : R(0, 0, 0, 0);
    if (shown && this.parentElement && this.parentElement.classList && this.parentElement.classList.contains('be-viewer-stage') && /^(IMG|VIDEO)$/.test(this.tagName)) {
      // a pending image keeps its painted box (Chrome) although its natural size reads 0
      const nw = this.tagName === 'IMG' ? (this.naturalWidth || (this.__img && this.__img.lw) || 0) : this.videoWidth; const nh = this.tagName === 'IMG' ? (this.naturalHeight || (this.__img && this.__img.lh) || 0) : this.videoHeight;
      if (!nw || !nh) return R((env.vw) / 2, (env.vh - TOOLBAR) / 2, 0, 0);
      const t = parse(this.style.transform); const q = Math.abs(Math.round(t.r / 90)) % 2;
      const bw = (q ? nh : nw) * t.z; const bh = (q ? nw : nh) * t.z;
      return R(env.vw / 2 + t.tx - bw / 2, (env.vh - TOOLBAR) / 2 + t.ty - bh / 2, bw, bh);
    }
    if (shown && this.closest && this.closest('.be-media-state')) return R(env.vw / 2 - 60, (env.vh - TOOLBAR) / 2, 120, 20);
    return orig.call(this);
  };
  // Hit testing like a browser: the deepest element under the point whose
  // computed pointer-events is not 'none' (jsdom computes the inherited value).
  w.document.elementFromPoint = (x, y) => {
    const hits = [...w.document.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    const depth = (el) => { let n = 0; for (let a = el; a; a = a.parentElement) n++; return n; };
    hits.sort((a, b) => depth(b) - depth(a));
    return hits.find((el) => w.getComputedStyle(el).pointerEvents !== 'none') || w.document.body;
  };
  Object.defineProperty(w, 'innerWidth', { configurable: true, get: () => env.vw });
  Object.defineProperty(w, 'innerHeight', { configurable: true, get: () => env.vh });
}
// Image loading as measured in real Chrome (IB11-P7 first attempt): an image
// already loaded in the document (including the page's card thumbnails) is
// reused synchronously when assigned (natural size at once; load queued);
// a source that must be fetched reads naturalWidth/Height 0 and complete
// false while the previously painted image keeps its box (lw/lh) until the
// new image's dimensions arrive (header), after which the progressively
// loading image is painted at its own size.
function images(w, env, pageId, requests) {
  const IP = w.HTMLImageElement.prototype;
  const DIM = { thumb: [160, 80], mid: [800, 400], wide: [2000, 1000], slow: [1600, 800], v169: [320, 180] };
  const avail = new Map();
  const RE = /\/vview\/img\/[0-9a-f]+\/([A-Z0-9_]+)-(thumb|wide|slow|fail|mid|v169)\.png/;
  const st = (el) => (el.__img = el.__img || { complete: false, nw: 0, nh: 0, lw: 0, lh: 0, gen: 0 });
  Object.defineProperty(IP, 'complete', { configurable: true, get() { return this.__img ? this.__img.complete : true; } });
  Object.defineProperty(IP, 'naturalWidth', { configurable: true, get() { return this.__img ? this.__img.nw : 0; } });
  Object.defineProperty(IP, 'naturalHeight', { configurable: true, get() { return this.__img ? this.__img.nh : 0; } });
  const d = Object.getOwnPropertyDescriptor(IP, 'src');
  Object.defineProperty(IP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) {
    d.set.call(this, v); const el = this; const s = st(el); const g = ++s.gen; const url = d.get.call(this);
    const m = RE.exec(String(url));
    if (!m) { s.complete = true; return; }
    const kind = m[2]; const at = (ms, fn) => w.setTimeout(() => { if (s.gen === g) fn(); }, ms);
    if (!avail.has(url) && DIM[kind] && [...w.document.querySelectorAll('article img')].some((i) => i !== el && i.src === url)) avail.set(url, DIM[kind]); // a card thumbnail the page already loaded
    if (avail.has(url)) { const [aw, ah] = avail.get(url); s.complete = true; s.nw = aw; s.nh = ah; s.lw = 0; s.lh = 0; at(0, () => el.dispatchEvent(new w.Event('load'))); return; }
    if (s.nw > 0) { s.lw = s.nw; s.lh = s.nh; } s.nw = 0; s.nh = 0; s.complete = false;
    requests.push({ page: pageId, label: `${m[1]}-${kind}`, status: kind === 'fail' ? 404 : 200, end: 'complete' });
    const done = (dims) => { s.complete = true; s.nw = dims[0]; s.nh = dims[1]; s.lw = 0; s.lh = 0; avail.set(url, dims); el.dispatchEvent(new w.Event('load')); };
    if (kind === 'fail') at(50, () => { s.complete = true; s.nw = 0; s.nh = 0; s.lw = 0; s.lh = 0; el.dispatchEvent(new w.Event('error')); });
    else if (kind === 'slow') { at(env.slowHeaderMs, () => { s.nw = 1600; s.nh = 800; s.lw = 0; s.lh = 0; }); at(env.slowCompleteMs, () => done([1600, 800])); }
    else at(kind === 'thumb' ? 20 : (kind === 'mid' || kind === 'v169' ? 30 : 50), () => done(DIM[kind]));
  } });
  const VP = w.HTMLVideoElement.prototype;
  Object.defineProperty(VP, 'videoWidth', { configurable: true, get() { return this.hasAttribute('src') ? 1280 : 0; } });
  Object.defineProperty(VP, 'videoHeight', { configurable: true, get() { return this.hasAttribute('src') ? 720 : 0; } });
}

// Operator driver: answers each prompt once (unless skipped).
function makeDriver(w, env, pageId, arrivals, skip) {
  const done = new Set();
  const doc = w.document;
  const K = (target, key, init = {}) => { const e = new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }); (target || doc.body).dispatchEvent(e); return e; };
  const click = (el) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }); el.dispatchEvent(e); return e; };
  const pdown = (el) => el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
  const art = (role) => doc.querySelector(`article[data-vview-role="${role}"]`);
  const navigate = (card) => { w.setTimeout(() => { arrivals.push({ page: pageId, card, wall: Date.now(), attempt: 1 }); w.dispatchEvent(new w.Event('pagehide')); }, 300); };
  const video = () => doc.querySelector('.be-viewer-stage video');
  // Native (UA) toggle: uses the simulator's media functions captured before the
  // package loaded, so it never passes through page-level play()/pause() wrappers
  // - like Chrome's native controls, which do not call page JavaScript.
  const toggle = (v) => { if (v.paused) w.__uaPlay.call(v).catch(() => {}); else w.__uaPause.call(v); };
  const shown = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { if (n.hidden || w.getComputedStyle(n).display === 'none') return false; } return true; };
  const focusables = () => [...doc.querySelectorAll('a[href], button')].filter((x) => x.isConnected && shown(x));
  // a browser Tab: dispatched to the focused element, then the native move unless prevented
  const tabMove = (shift) => { const a = doc.activeElement; const e = K(a, 'Tab', shift ? { shiftKey: true } : {}); if (e.defaultPrevented) return; const f = focusables(); const i = f.indexOf(a); const n = shift ? f[(i <= 0 ? f.length : i) - 1] : f[(i + 1) % f.length]; if (n) n.focus(); };
  const RULES = [
    ['F11 once', () => { env.vw = 1920; env.vh = 1080; w.dispatchEvent(new w.Event('resize')); }],
    ['F11 again', () => { env.vw = 1600; env.vh = 900; w.dispatchEvent(new w.Event('resize')); }],
    ['Right Arrow key', () => K(doc.activeElement, 'ArrowRight')],
    ['Windows+PrtScn', () => K(doc.activeElement, 'Enter')],
    ['Alt+O', () => K(doc.activeElement, 'o', { altKey: true })],
    ['Press F once', () => K(doc.activeElement, 'f')],
    ['Press D once', () => K(doc.activeElement, 'd')],
    ['Ctrl+F', () => K(doc.activeElement, 'f', { ctrlKey: true })],
    ['Ctrl+D', () => K(doc.activeElement, 'd', { ctrlKey: true })],
    ['play/pause button', () => { const v = video(); if (!v) return; if (env.nativeControl === 'surface') { pdown(v); click(v); } toggle(v); if (env.nativeControl !== 'nofocus') { v.setAttribute('tabindex', '-1'); v.focus(); } }],
    // Space models: 'native' (default; as observed in real Chrome) - the focused
    // native control consumes Space, no page-visible key event, UA toggle;
    // 'page' - keydown reaches the page, the native default toggles after
    // dispatch unless prevented; 'none' - nothing happens.
    ['Space bar', () => { const a = doc.activeElement; if (env.spaceMode === 'none') return; if (env.spaceMode === 'native' && a && a.tagName === 'VIDEO') { toggle(a); return; } const e = K(a, ' '); if (!e.defaultPrevented && a && a.tagName === 'VIDEO') w.setTimeout(() => toggle(a), 120); }],
    ['PINK', () => { const im = art('FOCUS_M').querySelector('img'); pdown(im); click(im); }],
    ['Escape', () => K(doc.activeElement, 'Escape')],
    ['BLUE', () => { const l = art('FOCUS_K').querySelector('a'); l.focus(); w.setTimeout(() => { K(l, 'Enter'); click(l); }, 50); }],
    ['Shift and press Tab', () => tabMove(true)],
    ['Tab once', () => tabMove(false)],
    ['Close', () => { const b = [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith('Close')); b.focus(); click(b); }],
    // Recovery NATIVE: the operator clicks where the link visibly is; the event
    // goes to whatever the browser hit-tests there.
    ['dark empty area', () => { const el = doc.elementFromPoint(40, 40) || doc.body; el.dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 40, clientY: 40 })); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: 40, clientY: 40 })); }],
    ['visible underlined', () => { const l = doc.querySelector('.be-viewer-native-fallback'); if (!l) return; const r = l.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2; const el = doc.elementFromPoint(cx, cy) || doc.body;
      const init = { bubbles: true, cancelable: true, button: 0, clientX: cx, clientY: cy };
      if (env.nativeClick === 'outside') { init.clientX = r.right + 40; }
      el.dispatchEvent(new w.MouseEvent('pointerdown', init)); const e = new w.MouseEvent('click', init); el.dispatchEvent(e);
      if (el.closest && el.closest('.be-viewer-native-fallback') && !e.defaultPrevented) navigate('NATIVE'); }],
    ['Open native post', () => { const l = doc.querySelector('.be-viewer-native-fallback'); const e = click(l); if (!e.defaultPrevented) navigate('NATIVE'); }],
    ['ORANGE', () => { const im = art('VD6A').querySelector('img'); const e = click(im); if (!e.defaultPrevented) navigate('VD6A'); }],
  ];
  return () => {
    const p = doc.querySelector('#ib11v-panel'); if (!p) return;
    const text = p.textContent || '';
    if (!/ACTION NEEDED/.test(doc.title)) return;
    for (const [k, fn] of RULES) {
      const id = `${k}|${text}`;
      if (text.includes(k)) { if (!done.has(id)) { done.add(id); if (!skip.includes(k)) fn(); } return; } // first matching rule only
    }
  };
}

async function runPage(pg, source, { skip = [], maxMs = 300000, nativeControl = 'focus', spaceMode = 'native', nativeClick = 'center' } = {}) {
  let clock = null; let posted = null; const env = { vw: 1600, vh: 900, activation: true, slowHeaderMs: 1500, slowCompleteMs: 9000, nativeControl, spaceMode, nativeClick };
  const arrivals = []; const requests = [];
  const sizes = { webm: 3091428, thumb: 269, wide: 11362, slow: 3842038 };
  const c = h.load({ url: `http://127.0.0.1:${srv.PORT}/posts?page=${pg.token}`, html: srv.page(pg, srv.PORT, sizes), source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.GM_info = { scriptHandler: 'jsdom-sim', version: '0' };
    mediaSim(w, clock, env); layout(w, env); images(w, env, pg.id, requests);
    w.__uaPlay = w.HTMLMediaElement.prototype.play; w.__uaPause = w.HTMLMediaElement.prototype.pause;
    w.fetch = async (u, o) => { if (String(u) === '/vview/result') { posted = JSON.parse(o.body); return { json: async () => ({}) }; } return new Promise(() => {}); };
    w.navigator.sendBeacon = (u, blob) => { blob.text().then((t) => { posted = JSON.parse(t); }); return true; };
  } });
  const w = c.window;
  const drive = makeDriver(w, env, pg.id, arrivals, skip);
  for (let i = 0; i < maxMs / 100 && !posted; i++) { await h.sleep(0); await clock.advance(100); drive(); }
  for (let i = 0; i < 5; i++) { await h.sleep(0); await clock.advance(100); }
  const ui = { msg: w.document.querySelector('#ib11v-panel')?.textContent || '', title: w.document.title };
  w.close();
  return { client: posted, arrivals, requests, ui };
}
// jsdom events are untrusted; mark exactly the operator-prompt inputs trusted.
function trustOperator(client) {
  if (!client || !client.cells) return client;
  const T = (r) => { if (r) r.trusted = true; };
  const c = client.cells;
  if (c.VD4) { T(c.VD4.resize1); T(c.VD4.resize2); }
  if (c.VD5) (c.VD5.chords || []).forEach(T);
  if (c.G3) { T(c.G3.control); if (c.G3.space) (c.G3.space.keys || []).forEach(T); }
  if (c.FOCUS_M) { T(c.FOCUS_M.pointer); T(c.FOCUS_M.click); T(c.FOCUS_M.escape); }
  if (c.FOCUS_K) { T(c.FOCUS_K.enter); (c.FOCUS_K.tabs || []).forEach(T); T(c.FOCUS_K.closeClick); }
  if (c.NATIVE) { T(c.NATIVE.click); T(c.NATIVE.pointer); }
  if (c.STAGECLOSE) T(c.STAGECLOSE.click);
  if (c.P3KEYS) (c.P3KEYS.rows || []).forEach(T);
  if (c.VD6A) T(c.VD6A.click);
  if (c.VD6BP5) T(c.VD6BP5.key);
  if (c.SHOT) T(c.SHOT.enter);
  if (c.P8M) { T(c.P8M.pointer); T(c.P8M.click); T(c.P8M.escape); (c.P8M.steps || []).forEach(T); }
  if (c.P8K) { T(c.P8K.enter); T(c.P8K.closeClick); (c.P8K.steps || []).forEach(T); }
  return client;
}
async function smoke(source, { skip = [], forceIdentity = false, nativeControl = 'focus', spaceMode = 'native', preflight = false, recovery = false, p1 = false, p2 = false, p3 = false, p4 = false, p5 = false, p6 = false, p7 = false, p8 = false, p9 = false, nativeClick = 'center' } = {}) {
  const pages = []; const arrivals = []; const requests = []; const uis = [];
  for (const pg of srv.plan({ preflight, recovery, p1, p2, p3, p4, p5, p6, p7, p8, p9 })) {
    const r = await runPage(pg, source, { skip, nativeControl, spaceMode, nativeClick, maxMs: preflight ? 120000 : 300000 });
    const cl = trustOperator(r.client);
    if (cl && forceIdentity) cl.identity = 'MATCH_EXPECTED_ARTIFACT';
    pages.push({ page: pg.id, attempt: 1, client: cl }); arrivals.push(...r.arrivals); requests.push(...r.requests); uis.push({ page: pg.id, ...r.ui });
  }
  return { doc: { probe: p9 ? 'ib11-p9-d5' : p8 ? 'ib11-p8-focus' : p7 ? 'ib11-p7-vd7' : p6 ? 'ib11-p6-vd4' : p5 ? 'ib11-p5-vd6b' : p4 ? 'ib11-p4-vd6a' : p3 ? 'ib11-p3-vd5' : p2 ? 'ib11-p2-vd1' : p1 ? 'ib11-p1-native' : recovery ? 'ib11-vview-recovery' : (preflight ? 'ib11-vview-g3-preflight' : 'ib11-vview'), version: '1.0.0', fixtures: { slow: { dims: [1600, 800] }, wide: { dims: [2000, 1000] }, thumb: { dims: [160, 80] } }, pages, arrivals, requests }, uis };
}

module.exports = { smoke, runPage, trustOperator };
