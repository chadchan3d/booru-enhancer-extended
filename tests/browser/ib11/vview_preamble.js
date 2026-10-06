/* IB11 V-VIEW PREAMBLE — test code, not production.
 * Installed before the unchanged production body, in the same script world.
 * Observe-only recorder for the existing viewer:
 *   - every <img>/<video> production's viewer creates (owner from the call
 *     stack: buildMedia): its src label (fixture label only), load / error /
 *     play / pause / playing events;
 *   - play() / pause() calls on viewer video with their caller
 *     (togglePlayPause or other), without altering what production receives;
 *   - the synchronous-failure seam: an exception thrown by a media `volume`
 *     assignment is recorded (name, whether buildMedia was on the stack) and
 *     RETHROWN unchanged, so production sees exactly the original behavior.
 * It changes no value production reads, except IB11V_LOCATION: a test-only
 * location object passed to the production body as its `location` parameter,
 * reporting hostname e621.net on this local fixture. Nothing is sent anywhere. */
var IB11V_LOCATION = {
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
var IB11V = (function () {
  'use strict';
  const t = () => Math.round(performance.now());
  const media = [];
  const seam = [];
  const calls = [];
  const labelOf = (u) => { const m = /\/vview\/(?:img|video)\/[0-9a-f]+\/([A-Z0-9_]+-?[a-z]*)\.(png|webm)(?:$|[?#])/.exec(String(u || '')); return m ? m[1] : (u ? 'OTHER' : ''); };
  const EVENTS = ['load', 'error', 'play', 'pause', 'playing', 'loadeddata'];
  function track(el) {
    const r = { i: media.length, tag: el.tagName, created: t(), label: '', ev: [] };
    el.__ib11v = r; media.push(el);
    for (const n of EVENTS) el.addEventListener(n, () => r.ev.push([t(), n]));
  }
  const ce = document.createElement;
  document.createElement = function createElement(tag, ...a) {
    const el = ce.call(document, tag, ...a);
    if (/^(img|video)$/i.test(String(tag)) && String(new Error().stack).includes('buildMedia')) track(el);
    return el;
  };
  for (const P of [HTMLImageElement.prototype, HTMLMediaElement.prototype]) {
    const d = Object.getOwnPropertyDescriptor(P, 'src');
    Object.defineProperty(P, 'src', { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); }, set(v) { if (this.__ib11v && !this.__ib11v.label) this.__ib11v.label = labelOf(v); d.set.call(this, v); } });
  }
  const MP = HTMLMediaElement.prototype;
  const vd = Object.getOwnPropertyDescriptor(MP, 'volume');
  Object.defineProperty(MP, 'volume', { configurable: true, enumerable: vd.enumerable, get() { return vd.get.call(this); }, set(v) {
    try { vd.set.call(this, v); } catch (e) { seam.push({ t: t(), name: (e && e.name) || 'Error', fromBuildMedia: String((e && e.stack) || new Error().stack).includes('buildMedia') || String(new Error().stack).includes('buildMedia'), value: Number(v) }); throw e; }
  } });
  for (const k of ['play', 'pause']) {
    const f = MP[k];
    MP[k] = function (...a) { if (this.__ib11v) calls.push([t(), this.__ib11v.i, k, String(new Error().stack).includes('togglePlayPause') ? 'togglePlayPause' : 'other']); return f.apply(this, a); };
  }
  return { t, media, seam, calls, labelOf, rec: (el) => (el && el.__ib11v) || null };
})();
