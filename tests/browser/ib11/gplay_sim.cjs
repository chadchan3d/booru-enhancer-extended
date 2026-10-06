'use strict';
// Shared jsdom smoke support for the IB11 G-PLAY verifiers (test code). A media
// SIMULATOR models an autoplay policy (muted autoplay allowed, unmuted play
// only after user activation), loop/ended, a 404, a held load, and the reset
// Chrome performs when production releases a video (removeAttribute('src') +
// load(): 'abort', 'emptied', currentTime back to 0). It is not browser
// evidence; it only exercises the runner -> recorder -> evaluator chain.
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const srv = require('./gplay_server.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const DURATION = 12;
function mediaSim(w, clock, env) {
  const MP = w.HTMLMediaElement.prototype;
  const st = (el) => (el.__sim = el.__sim || { playing: false, ct: 0, timer: null, gen: 0 });
  const fire = (el, n) => el.dispatchEvent(new w.Event(n));
  const stop = (el) => { const s = st(el); s.playing = false; if (s.timer) { w.clearInterval(s.timer); s.timer = null; } };
  const allowed = (el) => (el.muted && env.mutedAutoplay !== false) || env.activation;
  const start = (el) => { const s = st(el); if (s.playing) return; s.playing = true; fire(el, 'play'); fire(el, 'playing');
    s.timer = w.setInterval(() => { if (!s.playing) return; s.ct += 0.25; if (s.ct >= DURATION) { if (el.loop) { s.ct = 0; fire(el, 'timeupdate'); } else { s.ct = DURATION; stop(el); fire(el, 'timeupdate'); fire(el, 'pause'); fire(el, 'ended'); return; } } fire(el, 'timeupdate'); }, 250); };
  Object.defineProperty(MP, 'paused', { configurable: true, get() { return !st(this).playing; } });
  Object.defineProperty(MP, 'duration', { configurable: true, get() { return this.hasAttribute('src') ? DURATION : NaN; } });
  Object.defineProperty(MP, 'currentTime', { configurable: true, get() { return st(this).ct; }, set(v) { st(this).ct = Number(v); fire(this, 'timeupdate'); } });
  const sd = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, get() { return sd.get.call(this); }, set(v) {
    sd.set.call(this, v); const el = this; const s = st(el); stop(el); s.ct = 0; const g = ++s.gen; const u = String(v);
    const delay = /-PEND\./.test(u) ? 3000 : 60;
    w.setTimeout(() => { if (s.gen !== g || !el.hasAttribute('src')) return; if (/-FAIL\./.test(u)) { fire(el, 'error'); return; } fire(el, 'loadedmetadata'); fire(el, 'loadeddata'); fire(el, 'canplay'); if (el.autoplay && allowed(el)) start(el); }, delay);
  } });
  const md = Object.getOwnPropertyDescriptor(MP, 'muted');
  Object.defineProperty(MP, 'muted', { configurable: true, get() { return md.get.call(this); }, set(v) { md.set.call(this, v); if (!v && st(this).playing && !env.activation) { stop(this); fire(this, 'pause'); } } });
  const ra = w.Element.prototype.removeAttribute;
  w.Element.prototype.removeAttribute = function (n) { if (this instanceof w.HTMLMediaElement && n === 'src') { const s = st(this); s.gen++; stop(this); } return ra.call(this, n); };
  MP.play = function () { const el = this; if (!el.hasAttribute('src')) return Promise.reject(new w.DOMException('no src', 'NotSupportedError'));
    if (!allowed(el)) return Promise.reject(new w.DOMException('blocked', 'NotAllowedError'));
    const g = st(el).gen; return new Promise((res, rej) => w.setTimeout(() => { if (st(el).gen !== g || !el.hasAttribute('src')) { rej(new w.DOMException('aborted', 'AbortError')); return; } start(el); res(); }, 60)); };
  MP.pause = function () { if (st(this).playing) { stop(this); fire(this, 'pause'); } };
  // Chrome on release: load() without a source aborts the old fetch, empties the
  // element and resets the playback position to 0 (observed in the first run).
  MP.load = function () { if (!this.hasAttribute('src')) { const s = st(this); stop(this); const was = s.ct; s.ct = 0; fire(this, 'abort'); fire(this, 'emptied'); if (was) fire(this, 'timeupdate'); } };
  Object.defineProperty(w.navigator, 'userActivation', { configurable: true, value: { get hasBeenActive() { return env.activation; }, get isActive() { return env.activation; } } });
}

// Runs one page. prompts: 'click' answers every prompt (Start/Unmute button,
// SPACE); 'start' answers only Start; 'none' answers nothing (prompt timeout). Returns the posted client
// result and the final operator-panel state.
async function runPage(pg, source, { prompts = 'click', mutedAutoplay = true, maxMs = 400000 } = {}) {
  let clock = null; let posted = null; const env = { activation: false, mutedAutoplay };
  const c = h.load({ url: `http://127.0.0.1:${srv.PORT}/posts?page=${pg.token}`, html: srv.page(pg, srv.PORT, { mp4: 3623853, webm: 3091428 }), source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.GM_info = { scriptHandler: 'jsdom-sim', version: '0' };
    mediaSim(w, clock, env);
    w.fetch = async (u, o) => { if (String(u) === '/gplay/result') { posted = JSON.parse(o.body); return { json: async () => ({ next: null }) }; } return new Promise(() => {}); };
  } });
  const w = c.window;
  let promptSeen = null;
  for (let i = 0; i < maxMs / 100 && !posted; i++) {
    await h.sleep(0); await clock.advance(100);
    const btn = w.document.querySelector('#ib11g-panel button'); const msg = w.document.querySelector('#ib11g-panel div')?.textContent || '';
    if (btn && btn.style.display !== 'none') {
      if (!promptSeen) promptSeen = { panelCss: w.document.querySelector('#ib11g-panel').style.cssText, title: w.document.title };
      if (prompts === 'click' || (prompts === 'start' && btn.textContent === 'Start')) { env.activation = true; btn.click(); }
    } else if (/SPACE/.test(msg) && !w.__spaced && prompts === 'click') { w.__spaced = true; env.activation = true; w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })); }
  }
  await clock.advance(1000);
  const ui = { msg: w.document.querySelector('#ib11g-panel div')?.textContent || '', title: w.document.title, promptSeen };
  w.close();
  return { client: posted, ui };
}
// jsdom events are untrusted; the operator's prompt inputs are real. Mark the
// prompt inputs trusted (never the cells' synthetic clicks/keys).
const trustPrompts = (cl) => { if (!cl) return cl; if (cl.start) cl.start.trusted = true; for (const c of cl.cells || []) for (const m of c.marks) if (m.what === 'retry-key' || m.what === 'unmute') m.trusted = true; return cl; };
async function smoke(source, { forceIdentity = false, recovery = false, prompts = 'click', mutedAutoplay = true } = {}) {
  const pages = []; const uis = [];
  for (const pg of srv.plan({ recovery })) {
    const { client, ui } = await runPage(pg, source, { prompts, mutedAutoplay });
    const cl = prompts === 'click' ? trustPrompts(client) : client;
    if (cl && forceIdentity) cl.identity = 'MATCH_EXPECTED_ARTIFACT';
    pages.push(recovery ? { page: pg.id, attempt: 1, client: cl, requests: [] } : { page: pg.id, client: cl, requests: [] });
    uis.push({ page: pg.id, ...ui });
  }
  return { doc: recovery ? { probe: 'ib11-gplay-recovery', recoveryCells: srv.RECOVERY_CELLS, pages } : { probe: 'ib11-gplay-controlled', pages }, uis };
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const cellOf = (doc, id) => doc.pages.flatMap((p) => p.client.cells).find((c) => c.id === id);

module.exports = { mediaSim, runPage, trustPrompts, smoke, clone, cellOf, DURATION };
