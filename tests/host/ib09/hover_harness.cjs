'use strict';
// IB09 reusable hover harness (E-stage characterization; reusable for later IB09
// implementation tests). Runs the REAL production userscript in jsdom through
// the IB07 harness, with:
//   - a fake clock: setTimeout/setInterval/requestAnimationFrame are replaced
//     before production evaluates; time moves only through clock.advance(ms);
//   - an image-source recorder: every HTMLImageElement src assignment is
//     recorded with its time relative to pointer-enter, the production path
//     that made it (from the call stack), the hover generation, whether the
//     element was attached, and its native-slot class (PREVIEW / SAMPLE / FILE
//     / UNKNOWN, or CANCEL for the 'data:,' abort sentinel);
//   - controllable completion: images whose source is assigned stay pending
//     (complete === false) until the test fires load or error on them;
//   - generation tracking: BE.modules.hover.show / hide are wrapped (the
//     gallery calls them through these properties); gen = number of shows;
//   - hover-overlay installs: every node added to #be-hover-preview, with the
//     generation its source was assigned in (stale-install detection);
//   - metadata: adapter fetchPost, gallery enrichSinglePost / getCachedPost;
//   - network: the IB07 harness transports (GM_xmlhttpRequest, fetch, XHR,
//     sendBeacon, GM_download).
// Output contains no URLs: sources are reported only as native-slot classes.
// Fixtures are synthetic. Requires `npm install` in tests/host/ib07.
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const M = 'https://static.example';
const H = '0123456789abcdef0123456789abcdef';
const U = (id) => ({ file: `${M}/data/${H}_${id}.png`, sample: `${M}/data/sample/${H}_${id}.jpg`, preview: `${M}/data/preview/${H}_${id}.jpg`, webp: `${M}/data/preview/${H}_${id}.webp` });
const card = (id) => { const u = U(id); return `<article class="thumbnail" data-id="${id}" data-file-ext="png" data-width="1448" data-height="2048" data-file-url="${u.file}" data-sample-url="${u.sample}"
  data-preview-url="${u.preview}" data-preview-webp="${u.webp}"><a href="/posts/${id}" class="thm-link"><picture><source srcset="${u.webp}" type="image/webp"><source srcset="${u.preview}" type="image/jpeg"><img src="${u.preview}" alt=""></picture></a></article>`; };
const listing = (host, n = 3) => ({ url: `https://${host}/posts`, html: `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${Array.from({ length: n }, (_, i) => card(String(101 + i))).join('')}</section></body></html>` });

// Native-slot classification of a source URL against one card's native facts.
function classifySlot(url, cardEl, base) {
  if (!url) return 'UNKNOWN';
  if (url === 'data:,') return 'CANCEL';
  let abs; try { abs = new URL(url, base).href; } catch { return 'UNKNOWN'; }
  const facts = [['PREVIEW', 'data-preview-url'], ['PREVIEW', 'data-preview-webp'], ['SAMPLE', 'data-sample-url'], ['FILE', 'data-file-url']];
  const labels = [];
  for (const [label, attr] of facts) {
    const v = cardEl && cardEl.getAttribute(attr);
    let a = ''; try { a = v ? new URL(v, base).href : ''; } catch { a = ''; }
    if (a && a === abs && !labels.includes(label)) labels.push(label);
  }
  return labels.length ? labels.join('|') : 'UNKNOWN';
}

const PATHS = ['showImmediateThumbnail', 'upgradeWhenReady', 'cancelPendingUpgrade', 'installMedia', 'createMediaEl', 'replaceMedia', 'openViewerForThumb', 'applySiteThumbMedia'];
function pathFromStack() {
  const st = String(new Error().stack || '');
  for (const p of PATHS) if (st.includes(p)) return p;
  return 'OTHER';
}

function installFakeClock(w) {
  let now = 0; let seq = 0; const q = new Map();
  w.setTimeout = (fn, ms = 0, ...a) => { const id = ++seq; q.set(id, { t: now + Math.max(0, Number(ms) || 0), fn: () => (typeof fn === 'function' ? fn(...a) : null), iv: 0 }); return id; };
  w.clearTimeout = (id) => { q.delete(id); };
  w.setInterval = (fn, ms = 0) => { const id = ++seq; const iv = Math.max(1, Number(ms) || 1); q.set(id, { t: now + iv, fn, iv }); return id; };
  w.clearInterval = (id) => { q.delete(id); };
  w.requestAnimationFrame = (fn) => w.setTimeout(() => fn(now), 16);
  w.cancelAnimationFrame = (id) => { q.delete(id); };
  const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r)); };
  async function advance(ms) {
    const end = now + ms;
    for (;;) {
      await flush();
      let next = null;
      for (const [id, e] of q) if (e.t <= end && (!next || e.t < next[1].t || (e.t === next[1].t && id < next[0]))) next = [id, e];
      if (!next) break;
      const [id, e] = next;
      now = e.t;
      if (e.iv) e.t += e.iv; else q.delete(id);
      try { e.fn(); } catch { /* production errors are its own */ }
    }
    now = end;
    await flush();
  }
  return { now: () => now, advance, pendingTimers: () => q.size };
}

// Build a session: production loaded, gallery enhanced, recorder attached. t=0 is set by enter().
async function session({ host = 'e621.net', quality = 'sample', n = 3, source } = {}) {
  let clock = null;
  const rec = { assigns: [], installs: [], meta: [], shows: 0, hides: 0, t0: 0, pending: new Set(), elGen: new WeakMap(), elIndex: new WeakMap() };
  const settings = { 'be:setting:media.thumbQuality': JSON.stringify(quality) };
  const ctx = h.load({ ...listing(host, n), settings, source: source || h.productionSource(), setup: (w) => {
    clock = installFakeClock(w);
    const desc = Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype, 'src');
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', { configurable: true, get() { return desc.get.call(this); },
      set(v) {
        const t = clock.now() - rec.t0;
        const idx = rec.assigns.length;
        const cardEl = rec.focusCard;
        rec.assigns.push({ idx, t, gen: rec.shows, active: rec.shows > rec.hides, path: pathFromStack(), attached: this.isConnected, inHover: !!this.closest?.('#be-hover-preview'),
          slot: classifySlot(String(v), cardEl, w.location.href), el: this });
        rec.elGen.set(this, rec.shows); rec.elIndex.set(this, idx);
        if (String(v) !== 'data:,' && !this.closest?.('article')) rec.pending.add(this);
        desc.set.call(this, v);
      } });
    Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { configurable: true, get() { return !rec.pending.has(this); } });
    Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { configurable: true, get() {
      const p = this.parentElement;
      if (p && p.localName === 'picture') for (const ch of p.children) { if (ch === this) break; if (ch.localName === 'source' && ch.getAttribute('srcset')) return new URL(ch.getAttribute('srcset').trim().split(/\s+/)[0], w.location.href).href; }
      return this.getAttribute('src') ? new URL(this.getAttribute('src'), w.location.href).href : '';
    } });
    new w.MutationObserver((rs) => {
      for (const r of rs) for (const nd of r.addedNodes) {
        if (!(r.target.id === 'be-hover-preview')) continue;
        const t = clock.now() - rec.t0;
        const g = rec.elGen.has(nd) ? rec.elGen.get(nd) : null;
        rec.installs.push({ t, kind: nd.localName, assignedInGen: g, currentGen: rec.shows, hoverActive: rec.shows > rec.hides, assignIdx: rec.elIndex.has(nd) ? rec.elIndex.get(nd) : null });
      }
    }).observe(w.document.documentElement, { subtree: true, childList: true });
  } });
  const w = ctx.window;
  await h.sleep(30);
  await clock.advance(400); // production init (settings, adapter, gallery, startup enrichment)
  const BE = ctx.BE;
  const hover = BE.modules.hover;
  const showOrig = hover.show; const hideOrig = hover.hide;
  hover.show = function wrappedShow(...a) { rec.shows++; return showOrig.apply(this, a); };
  hover.hide = function wrappedHide(...a) { rec.hides++; return hideOrig.apply(this, a); };
  const metaRec = (name) => (...a) => rec.meta.push({ t: clock.now() - rec.t0, name, gen: rec.shows });
  for (const ad of BE.adapters.registry) {
    const fp = ad.fetchPost;
    if (typeof fp === 'function') ad.fetchPost = function countedFetchPost(...a) { metaRec('adapter.fetchPost')(); return fp.apply(this, a); };
  }
  const g = BE.modules.gallery;
  for (const name of ['enrichSinglePost', 'getCachedPost']) { const f = g[name]; if (typeof f === 'function') g[name] = function counted(...a) { metaRec(`gallery.${name}`)(); return f.apply(this, a); }; }
  const requestsBefore = ctx.requests.length;
  const cards = [...w.document.querySelectorAll('article')];
  // All setup-time records are discarded; measurement starts at the first enter().
  rec.assigns.length = 0; rec.installs.length = 0; rec.meta.length = 0; rec.shows = 0; rec.hides = 0;

  const imgOf = (i) => cards[i].querySelector('img');
  const api = {
    ctx, w, BE, clock, rec, cards,
    get t() { return clock.now() - rec.t0; },
    startAt() { rec.t0 = clock.now(); },
    async enter(i) { rec.focusCard = cards[i]; imgOf(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(0); },
    async leave(i) { imgOf(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(0); },
    async wait(ms) { await clock.advance(ms); },
    async click(i) { imgOf(i).dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0); },
    // Complete a recorded (pending) image load: 'load' or 'error'.
    async complete(assign, kind = 'load') { rec.pending.delete(assign.el); assign.el.dispatchEvent(new w.Event(kind)); await clock.advance(0); },
    networkRequests: () => ctx.requests.length - requestsBefore,
    hoverVisible: () => { const el = w.document.querySelector('#be-hover-preview'); return !!el && el.style.display !== 'none' && el.childElementCount > 0; },
    hoverChildGen: () => { const el = w.document.querySelector('#be-hover-preview'); const c = el && el.firstElementChild; return c && rec.elGen.has(c) ? rec.elGen.get(c) : null; },
    close() { w.close(); },
  };
  return api;
}

// Sanitized view of the records (no URLs, no elements).
function timeline(s) {
  return {
    assigns: s.rec.assigns.map(({ t, gen, active, path: p, attached, inHover, slot }) => ({ t, gen, active, path: p, attached, inHover, slot })),
    installs: s.rec.installs.map(({ t, kind, assignedInGen, currentGen, hoverActive }) => ({ t, kind, assignedInGen, currentGen, hoverActive })),
    metadata: s.rec.meta.map(({ t, name, gen }) => ({ t, name, gen })),
    network: s.networkRequests(), shows: s.rec.shows, hides: s.rec.hides,
  };
}

module.exports = { session, timeline, classifySlot, U, card, listing, M };
