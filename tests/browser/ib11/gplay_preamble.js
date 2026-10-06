/* IB11 G-PLAY PREAMBLE — test code, not production.
 * Installed before the unchanged production body, in the same script world.
 * Observe-only recorder for the existing viewer's <video> elements (owner from
 * the call stack: viewer buildMedia). Per element it records, separately:
 *   - PREFERENCE as assigned: autoplay / loop / muted / defaultMuted / volume /
 *     controls / preload at the first src assignment, and every later write to
 *     muted / volume with its writer (production or harness);
 *   - CALLS: src (cell-relative label only), removeSrc, load, pause, play, with
 *     the play() caller (updatePost / togglePlayPause / other) and the promise
 *     outcome (resolved, or the rejection name), recorded without altering the
 *     promise production receives;
 *   - EVENTS: play, playing, pause, ended, error, emptied, abort, volumechange,
 *     loadeddata, waiting, plus "wrap" (currentTime moved backwards > 0.5 s
 *     without a harness seek) and the maximum currentTime;
 *   - SAMPLES every 250 ms: attached, holds src, paused, muted, volume,
 *     currentTime, networkState, readyState; and the viewer stage state text
 *     and native-link presence.
 * Actual playback is never inferred from an assigned attribute: a cell counts
 * as played only from 'playing' plus advancing currentTime (evaluator).
 * It changes no value production reads, except IB11G_LOCATION: a test-only
 * location object passed to the production body as its `location` parameter,
 * reporting hostname e621.net on this local fixture. Nothing is sent anywhere. */
var IB11G_LOCATION = {
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
var IB11G = (function () {
  'use strict';
  const t = () => Math.round(performance.now());
  const videos = [];
  const stageLog = [];
  let cell = '';
  let harness = 0;
  let seeking = false;
  const labelOf = (u) => { const m = /\/media\/[0-9a-f]+\/([A-Za-z0-9_-]+)\.(mp4|webm)(?:$|[?#])/.exec(String(u || '')); return m ? m[1] : (u ? 'OTHER' : ''); };
  const callerOf = (st) => (st.includes('togglePlayPause') ? 'togglePlayPause' : (st.includes('updatePost') ? 'updatePost' : 'other'));
  const EVENTS = ['play', 'playing', 'pause', 'ended', 'error', 'emptied', 'abort', 'loadeddata', 'waiting'];
  const state = (el) => ({ attached: el.isConnected ? 1 : 0, holdsSrc: el.hasAttribute('src') && el.getAttribute('src') !== '' ? 1 : 0, paused: el.paused ? 1 : 0, muted: el.muted ? 1 : 0,
    volume: Math.round(el.volume * 1000) / 1000, currentTime: Math.round(el.currentTime * 100) / 100, networkState: el.networkState, readyState: el.readyState });
  function track(el) {
    const r = { i: videos.length, cell, created: t(), label: '', assigned: null, writes: [], calls: [], ev: [], maxTime: 0, lastTime: 0, states: [], last: '' };
    el.__ib11g = r; videos.push(el);
    for (const name of EVENTS) el.addEventListener(name, () => r.ev.push([t(), name, el.muted ? 1 : 0, Math.round(el.currentTime * 100) / 100]));
    el.addEventListener('volumechange', () => r.ev.push([t(), 'volumechange', el.muted ? 1 : 0, Math.round(el.volume * 1000) / 1000]));
    el.addEventListener('timeupdate', () => {
      const ct = el.currentTime;
      if (!seeking && ct < r.lastTime - 0.5) r.ev.push([t(), 'wrap', el.muted ? 1 : 0, Math.round(ct * 100) / 100]);
      r.lastTime = ct; if (ct > r.maxTime) r.maxTime = Math.round(ct * 100) / 100;
    });
  }
  const ce = document.createElement;
  document.createElement = function createElement(tag, ...a) {
    const el = ce.call(document, tag, ...a);
    if (String(tag).toLowerCase() === 'video' && String(new Error().stack).includes('buildMedia')) track(el);
    return el;
  };
  const MP = HTMLMediaElement.prototype;
  const srcDesc = Object.getOwnPropertyDescriptor(MP, 'src');
  Object.defineProperty(MP, 'src', { configurable: true, enumerable: srcDesc.enumerable, get() { return srcDesc.get.call(this); }, set(v) {
    const r = this.__ib11g;
    if (r) {
      const l = labelOf(v); r.calls.push([t(), 'src', l]); if (!r.label) r.label = l;
      if (!r.assigned) r.assigned = { autoplay: this.autoplay, loop: this.loop, muted: this.muted, defaultMuted: this.defaultMuted, volume: Math.round(this.volume * 1000) / 1000, controls: this.controls, preload: this.preload };
    }
    srcDesc.set.call(this, v);
  } });
  for (const k of ['muted', 'volume']) {
    const d = Object.getOwnPropertyDescriptor(MP, k);
    Object.defineProperty(MP, k, { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); }, set(v) {
      const r = this.__ib11g;
      if (r && r.assigned) r.writes.push([t(), k, k === 'muted' ? (v ? 1 : 0) : Math.round(Number(v) * 1000) / 1000, harness ? 'harness' : 'production']);
      d.set.call(this, v);
    } });
  }
  const ra = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function removeAttribute(n) { if (this.__ib11g && n === 'src') this.__ib11g.calls.push([t(), 'removeSrc']); return ra.call(this, n); };
  for (const k of ['load', 'pause']) { const f = MP[k]; MP[k] = function (...a) { if (this.__ib11g) this.__ib11g.calls.push([t(), k, harness ? 'harness' : 'production']); return f.apply(this, a); }; }
  const play = MP.play;
  MP.play = function (...a) {
    const r = this.__ib11g;
    const p = play.apply(this, a);
    if (r) {
      const c = [t(), 'play', harness ? 'harness' : callerOf(String(new Error().stack)), this.muted ? 1 : 0, 'pending'];
      r.calls.push(c);
      if (p && typeof p.then === 'function') p.then(() => { c[4] = 'resolved'; c.push(t()); }, (e) => { c[4] = (e && e.name) || 'rejected'; c.push(t()); });
    }
    return p;
  };
  const stageNow = () => {
    const st = document.querySelector('.be-viewer-stage');
    const s = st && st.querySelector('.be-media-state');
    const link = st && st.querySelector('.be-viewer-native-fallback');
    return { state: s ? s.textContent.replace(link ? link.textContent : '', '').trim() : '', link: link ? (/^\/posts\/\d+$/.test(new URL(link.href, location.href).pathname) ? 'card-post' : 'other') : '', open: !!window.BE?.modules?.viewer?.isOpen?.() };
  };
  let lastStage = '';
  const sample = () => {
    for (const el of videos) {
      const r = el.__ib11g; const s = state(el); const k = JSON.stringify(s);
      if (k !== r.last) { r.last = k; r.states.push([t(), s]); }
    }
    const s = stageNow(); const k = JSON.stringify(s);
    if (k !== lastStage) { lastStage = k; stageLog.push([t(), cell, s]); }
  };
  setInterval(sample, 250);
  return {
    t, videos, stageLog, sample, labelOf, stageNow, state,
    set cell(c) { cell = c; },
    get cell() { return cell; },
    async asHarness(fn) { harness++; try { return await fn(); } finally { harness--; } },
    seek(el, time) { seeking = true; harness++; try { el.currentTime = time; } finally { harness--; } setTimeout(() => { seeking = false; if (el.__ib11g) el.__ib11g.lastTime = el.currentTime; }, 300); },
    forCell(c) { sample(); return videos.filter((el) => el.__ib11g.cell === c).map((el) => { const { last, lastTime, ...r } = el.__ib11g; return { ...r, now: state(el) }; }); },
  };
})();
