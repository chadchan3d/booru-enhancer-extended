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
      const nw = this.tagName === 'IMG' ? this.naturalWidth : this.videoWidth; const nh = this.tagName === 'IMG' ? this.naturalHeight : this.videoHeight;
      if (!nw || !nh) return R((env.vw) / 2, (env.vh - TOOLBAR) / 2, 0, 0);
      const t = parse(this.style.transform); const q = Math.abs(Math.round(t.r / 90)) % 2;
      const bw = (q ? nh : nw) * t.z; const bh = (q ? nw : nh) * t.z;
      return R(env.vw / 2 + t.tx - bw / 2, (env.vh - TOOLBAR) / 2 + t.ty - bh / 2, bw, bh);
    }
    if (shown && this.closest && this.closest('.be-media-state')) return R(env.vw / 2 - 60, (env.vh - TOOLBAR) / 2, 120, 20);
    return orig.call(this);
  };
  Object.defineProperty(w, 'innerWidth', { configurable: true, get: () => env.vw });
  Object.defineProperty(w, 'innerHeight', { configurable: true, get: () => env.vh });
}
function images(w, env, pageId, requests) {
  const IP = w.HTMLImageElement.prototype;
  const st = (el) => (el.__img = el.__img || { complete: false, nw: 0, nh: 0, gen: 0 });
  Object.defineProperty(IP, 'complete', { configurable: true, get() { return this.__img ? this.__img.complete : true; } });
  Object.defineProperty(IP, 'naturalWidth', { configurable: true, get() { return this.__img ? this.__img.nw : 0; } });
  Object.defineProperty(IP, 'naturalHeight', { configurable: true, get() { return this.__img ? this.__img.nh : 0; } });
  const d = Object.getOwnPropertyDescriptor(IP, 'src');
  Object.defineProperty(IP, 'src', { configurable: true, get() { return d.get.call(this); }, set(v) {
    d.set.call(this, v); const el = this; const s = st(el); s.complete = false; s.nw = 0; s.nh = 0; const g = ++s.gen;
    const m = /\/vview\/img\/[0-9a-f]+\/([A-Z0-9_]+)-(thumb|wide|slow|fail)\.png/.exec(String(v));
    if (!m) { s.complete = true; return; }
    const kind = m[2]; const at = (ms, fn) => w.setTimeout(() => { if (s.gen === g) fn(); }, ms);
    requests.push({ page: pageId, label: `${m[1]}-${kind}`, status: kind === 'fail' ? 404 : 200, end: 'complete' });
    if (kind === 'fail') at(50, () => { s.complete = true; el.dispatchEvent(new w.Event('error')); });
    else if (kind === 'slow') { at(env.slowHeaderMs, () => { s.nw = 1600; s.nh = 800; }); at(env.slowCompleteMs, () => { s.complete = true; el.dispatchEvent(new w.Event('load')); }); }
    else { const [nw, nh] = kind === 'thumb' ? [160, 80] : [2000, 1000]; at(kind === 'thumb' ? 20 : 50, () => { s.complete = true; s.nw = nw; s.nh = nh; el.dispatchEvent(new w.Event('load')); }); }
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
  const toggle = (v) => { if (v.paused) v.play().catch(() => {}); else v.pause(); };
  const focusables = () => [...doc.querySelectorAll('a[href], button')].filter((x) => x.isConnected);
  const RULES = [
    ['F11 once', () => { env.vw = 1920; env.vh = 1080; w.dispatchEvent(new w.Event('resize')); }],
    ['F11 again', () => { env.vw = 1600; env.vh = 900; w.dispatchEvent(new w.Event('resize')); }],
    ['Ctrl+F', () => K(doc.activeElement, 'f', { ctrlKey: true })],
    ['Ctrl+D', () => K(doc.activeElement, 'd', { ctrlKey: true })],
    ['play/pause button', () => { const v = video(); if (!v) return; pdown(v); click(v); toggle(v); v.setAttribute('tabindex', '-1'); v.focus(); }],
    ['Space bar', () => { const a = doc.activeElement; const e = K(a, ' '); if (!e.defaultPrevented && a && a.tagName === 'VIDEO') w.setTimeout(() => toggle(a), 120); }], // native default after dispatch
    ['PINK', () => { const im = art('FOCUS_M').querySelector('img'); pdown(im); click(im); }],
    ['Escape', () => K(doc.activeElement, 'Escape')],
    ['BLUE', () => { const l = art('FOCUS_K').querySelector('a'); l.focus(); w.setTimeout(() => { K(l, 'Enter'); click(l); }, 50); }],
    ['Tab once', () => { const a = doc.activeElement; K(a, 'Tab'); const f = focusables(); const i = f.indexOf(a); const n = f[(i + 1) % f.length]; if (n) n.focus(); }],
    ['Close', () => { const b = [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith('Close')); b.focus(); click(b); }],
    ['Open native post', () => { const l = doc.querySelector('.be-viewer-native-fallback'); const e = click(l); if (!e.defaultPrevented) navigate('NATIVE'); }],
    ['ORANGE', () => { const im = art('VD6A').querySelector('img'); const e = click(im); if (!e.defaultPrevented) navigate('VD6A'); }],
  ];
  return () => {
    const p = doc.querySelector('#ib11v-panel'); if (!p) return;
    const text = p.textContent || '';
    if (!/ACTION NEEDED/.test(doc.title)) return;
    for (const [k, fn] of RULES) {
      const id = `${k}|${text}`;
      if (text.includes(k) && !done.has(id)) { done.add(id); if (!skip.includes(k)) fn(); return; }
    }
  };
}

async function runPage(pg, source, { skip = [], maxMs = 300000 } = {}) {
  let clock = null; let posted = null; const env = { vw: 1600, vh: 900, activation: true, slowHeaderMs: 1500, slowCompleteMs: 9000 };
  const arrivals = []; const requests = [];
  const sizes = { webm: 3091428, thumb: 269, wide: 11362, slow: 3842038 };
  const c = h.load({ url: `http://127.0.0.1:${srv.PORT}/posts?page=${pg.token}`, html: srv.page(pg, srv.PORT, sizes), source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.GM_info = { scriptHandler: 'jsdom-sim', version: '0' };
    mediaSim(w, clock, env); layout(w, env); images(w, env, pg.id, requests);
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
  if (c.G3) { T(c.G3.click); T(c.G3.space); }
  if (c.FOCUS_M) { T(c.FOCUS_M.pointer); T(c.FOCUS_M.click); T(c.FOCUS_M.escape); }
  if (c.FOCUS_K) { T(c.FOCUS_K.enter); (c.FOCUS_K.tabs || []).forEach(T); T(c.FOCUS_K.closeClick); }
  if (c.NATIVE) T(c.NATIVE.click);
  if (c.VD6A) T(c.VD6A.click);
  return client;
}
async function smoke(source, { skip = [], forceIdentity = false } = {}) {
  const pages = []; const arrivals = []; const requests = []; const uis = [];
  for (const pg of srv.plan()) {
    const r = await runPage(pg, source, { skip });
    const cl = trustOperator(r.client);
    if (cl && forceIdentity) cl.identity = 'MATCH_EXPECTED_ARTIFACT';
    pages.push({ page: pg.id, attempt: 1, client: cl }); arrivals.push(...r.arrivals); requests.push(...r.requests); uis.push({ page: pg.id, ...r.ui });
  }
  return { doc: { probe: 'ib11-vview', version: '1.0.0', fixtures: { slow: { dims: [1600, 800] }, wide: { dims: [2000, 1000] }, thumb: { dims: [160, 80] } }, pages, arrivals, requests }, uis };
}

module.exports = { smoke, runPage, trustOperator };
