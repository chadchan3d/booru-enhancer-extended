/* IB10 V3-L PREAMBLE — test code, not production. Observe-only recorder.
 * Installed before the unchanged production body, in the same script world.
 * Every wrapper records and then calls the original with the same arguments and
 * returns its result; nothing is assigned, removed, paused, played or loaded by
 * this code. It records, for each <video> production creates: the owner (hover
 * upgradeWhenReady / viewer buildMedia, from the call stack), the hover
 * generation it was created in, src assignments (as "matches the card's
 * data-file-url" only; never the URL), src removal, load/pause/play calls, media
 * events with readyState / networkState / buffered end, and the first presented
 * frame (requestVideoFrameCallback). Generation numbers are assigned by the
 * postamble (IB10L.setGeneration). Nothing is sent anywhere. */
var IB10L = (function () {
  'use strict';
  const t0 = performance.now();
  const t = () => Math.round(performance.now() - t0);
  const videos = [];
  let generation = 0;
  let cardFileUrl = '';
  const abs = (u) => { try { return u ? new URL(u, window.location.href).href : ''; } catch { return ''; } };
  const ownerOf = (st) => (st.includes('upgradeWhenReady') ? 'hover' : (st.includes('buildMedia') ? 'viewer' : 'other'));
  const bufEnd = (el) => { try { const b = el.buffered; return b && b.length ? Math.round(b.end(b.length - 1) * 100) / 100 : 0; } catch { return -1; } };
  const EVENTS = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing', 'waiting', 'stalled', 'suspend', 'abort', 'emptied', 'error', 'pause', 'play', 'ended'];
  function track(el, stack) {
    const r = { owner: ownerOf(stack), gen: generation, created: t(), srcMatchesCardFile: null, srcSetT: null, srcRemovedT: [], calls: [], ev: [], firstFrame: null };
    el.__ib10l = r; videos.push(el);
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
    const r = this.__ib10l;
    if (r && r.srcSetT === null) { r.srcSetT = t(); r.srcMatchesCardFile = !!cardFileUrl && abs(String(v)) === cardFileUrl; }
    return srcDesc.set.call(this, v);
  } });
  const ra = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function removeAttribute(n) { if (this.__ib10l && n === 'src') this.__ib10l.srcRemovedT.push(t()); return ra.call(this, n); };
  for (const k of ['load', 'pause', 'play']) { const f = MP[k]; MP[k] = function (...a) { if (this.__ib10l) this.__ib10l.calls.push([t(), k, this.muted ? 'muted' : 'UNMUTED']); return f.apply(this, a); }; }
  const state = (el) => ({ attached: el.isConnected ? 1 : 0, inHover: el.isConnected && el.closest('#be-hover-preview') ? 1 : 0, holdsSrc: el.hasAttribute('src') && el.getAttribute('src') !== '' ? 1 : 0,
    networkState: el.networkState, readyState: el.readyState, bufferedEnd: bufEnd(el), duration: Number.isFinite(el.duration) ? Math.round(el.duration * 100) / 100 : null, paused: el.paused ? 1 : 0 });
  return {
    t, videos, state,
    setGeneration(g, fileUrl) { generation = g; cardFileUrl = abs(fileUrl); },
    hoverFor(g) { return videos.filter((v) => v.__ib10l.owner === 'hover' && v.__ib10l.gen === g); },
    holdingHoverCount() { return videos.filter((v) => v.__ib10l.owner === 'hover' && v.hasAttribute('src') && v.getAttribute('src') !== '').length; },
  };
})();
