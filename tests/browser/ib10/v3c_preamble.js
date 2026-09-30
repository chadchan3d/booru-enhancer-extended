/* IB10 V3-C PREAMBLE — test code, not production.
 * Installed before the unchanged production body, in the same script world.
 * Observe-only: it records every <video> production creates (owner from the
 * call stack: hover upgradeWhenReady / viewer buildMedia), its src assignments
 * (card label only), src removal, load/pause/play calls, media events with
 * readyState / networkState / buffered end, the first presented frame
 * (requestVideoFrameCallback) and sampled element state (attached, in the
 * hover overlay, holds src, networkState, readyState, buffered end, paused).
 * It changes no value production reads, except IB10C_LOCATION: a test-only
 * location object passed to the production body as its `location` parameter,
 * reporting hostname e621.net on this local fixture (href/origin/pathname/search
 * stay the real local page values). Nothing is sent anywhere by this preamble. */
var IB10C_LOCATION = {
  get hostname() { return 'e621.net'; },
  get host() { return 'e621.net'; },
  get href() { return window.location.href; },
  get origin() { return window.location.origin; },
  get protocol() { return window.location.protocol; },
  get pathname() { return window.location.pathname; },
  get search() { return window.location.search; },
  get hash() { return window.location.hash; },
  toString() { return window.location.href; },
};
var IB10C = (function () {
  'use strict';
  const t = () => Math.round(performance.now());
  const videos = [];
  const marks = [];
  let trustedPointer = 0;
  const labelOf = (u) => { const m = /\/([ABC])\.(mp4|webm)(?:$|[?#])/.exec(String(u || '')); return m ? m[1] : (u ? 'OTHER' : ''); };
  const ownerOf = (st) => (st.includes('upgradeWhenReady') ? 'hover' : (st.includes('buildMedia') ? 'viewer' : 'other'));
  const bufEnd = (el) => { try { const b = el.buffered; return b.length ? Math.round(b.end(b.length - 1) * 100) / 100 : 0; } catch { return -1; } };
  const EVENTS = ['loadstart', 'progress', 'suspend', 'abort', 'emptied', 'stalled', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing', 'waiting', 'play', 'pause', 'ended', 'error'];
  function track(el, stack) {
    const r = { i: videos.length, owner: ownerOf(stack), created: t(), label: '', ev: [], calls: [], states: [], firstFrame: null, last: '' };
    el.__ib10c = r; videos.push(el);
    for (const name of EVENTS) el.addEventListener(name, () => r.ev.push([t(), name, el.readyState, el.networkState, bufEnd(el)]));
    if (typeof el.requestVideoFrameCallback === 'function') el.requestVideoFrameCallback(() => { if (r.firstFrame === null) r.firstFrame = t(); });
  }
  const ce = document.createElement;
  document.createElement = function createElement(tag, ...a) {
    const el = ce.call(document, tag, ...a);
    if (String(tag).toLowerCase() === 'video') track(el, String(new Error().stack));
    return el;
  };
  const MP = HTMLMediaElement.prototype;
  const srcDesc = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, enumerable: srcDesc.enumerable, get() { return srcDesc.get.call(this); }, set(v) {
    if (this.__ib10c) { const l = labelOf(v); this.__ib10c.calls.push([t(), 'src', l]); if (!this.__ib10c.label) this.__ib10c.label = l; }
    srcDesc.set.call(this, v);
  } });
  const ra = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function removeAttribute(n) { if (this.__ib10c && n === 'src') this.__ib10c.calls.push([t(), 'removeSrc']); return ra.call(this, n); };
  for (const k of ['load', 'pause', 'play']) { const f = MP[k]; MP[k] = function (...a) { if (this.__ib10c) this.__ib10c.calls.push([t(), k, this.muted ? 'muted' : 'UNMUTED']); return f.apply(this, a); }; }
  const sample = () => {
    for (const el of videos) {
      const r = el.__ib10c;
      const s = [el.isConnected ? 1 : 0, el.isConnected && el.closest('#be-hover-preview') ? 1 : 0, el.hasAttribute('src') && el.getAttribute('src') !== '' ? 1 : 0, el.networkState, el.readyState, bufEnd(el), el.paused ? 1 : 0];
      const k = s.join(',');
      if (k !== r.last) { r.last = k; r.states.push([t(), ...s]); }
    }
  };
  setInterval(sample, 50);
  for (const type of ['pointermove', 'pointerover', 'pointerdown', 'wheel']) document.addEventListener(type, (e) => { if (e.isTrusted) trustedPointer++; }, true);
  return {
    t, videos, marks, sample, labelOf,
    mark(what, extra = {}) { sample(); marks.push({ t: t(), what, ...extra }); },
    get trustedPointer() { return trustedPointer; },
    snapshot() { sample(); return videos.map((el) => { const { last, ...r } = el.__ib10c; return r; }); },
  };
})();
