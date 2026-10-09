/* IB12E1 E621 TIER-0 VIEWER RETURN OBSERVER POSTAMBLE — test code, not production.
 * The body above is production (commit ac3c9e8) UNCHANGED, run once inside the
 * IB07P wrapper so its executed source can be hashed. This observer changes no
 * production behaviour, history, settings, storage or network:
 *   - BE.modules.viewer.open is wrapped pass-through (same arguments, same
 *     return value) only to learn the current target and its focus origin;
 *   - a capture-phase keydown listener snapshots state when Escape is pressed
 *     (it never prevents or stops the event);
 *   - a MutationObserver on the viewer overlay detects the close;
 *   - a click-through marker shows card A and a click-through status line.
 * Output: card ordinals (never post IDs), rectangles, scroll positions and focus
 * facts; a leak guard withholds the result if any URL or post ID would appear.
 * After the measurement the result appears in a box with a Download button. */
(() => {
  'use strict';

  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function () {\n';
  const PROBE = 'ib12-e1-e621-tier0';
  const VERSION = '1.0.0';
  const SITE = location.hostname === 'e621.net' ? 'e621.net' : null;
  const SETTLE_MS = [250, 1000];
  const BE = window.BE;
  const r1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  const T0 = performance.now();
  const now = () => performance.now() - T0; // relative ms (never an absolute clock)

  const rec = {
    probe: PROBE, version: VERSION, site: SITE, route: null, loggedOut: null, production_body_identity: null, runtime: null,
    viewport: null, startScrollY: null, cardCount: null, markedA: null,
    opens: [], firstOpenWasA: null, A: null, C: null, cOutsideOriginalViewport: false,
    beforeClose: null, close: null, afterClose: [], inputAfterClose: 0,
    productionLogErrors: 0, probeErrors: [], complete: false,
  };
  const err = (where, e) => { if (rec.probeErrors.length < 10) rec.probeErrors.push({ where, message: String((e && e.message) || e).replace(/https?:\/\/\S+/g, '<url>').slice(0, 160) }); };

  // ---- cards (read-only adapter calls) ----
  const adapter = () => BE?.adapters?.active;
  function cards() {
    const a = adapter(); if (!a) return [];
    const out = [];
    for (const img of a.getThumbElements(document)) {
      const wrap = (a.getThumbWrapper && a.getThumbWrapper(img)) || null;
      const id = a.getThumbPostId(img);
      if (wrap && id && !out.some((c) => c.wrap === wrap)) out.push({ wrap, id: String(id) });
    }
    return out;
  }
  let cardList = [];
  const ordinalOf = (id) => cardList.findIndex((c) => c.id === String(id));
  const wrapOf = (id) => { const i = ordinalOf(id); return i >= 0 ? cardList[i].wrap : null; };
  function docRect(el) {
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    return { top: r1(r.top + window.scrollY), left: r1(r.left + window.scrollX), w: r1(r.width), h: r1(r.height) };
  }
  function visibility(el) {
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect(); const vh = window.innerHeight;
    const vis = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return { viewTop: r1(r.top), viewBottom: r1(r.bottom), visibleFraction: r.height > 0 ? r1(vis / r.height) : 0 };
  }

  // ---- click-through UI ----
  let statusEl = null; let markerEl = null;
  function status(text) {
    try {
      if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.setAttribute('aria-hidden', 'true');
        statusEl.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:320px;z-index:2147483646;pointer-events:none;background:rgba(17,17,17,.88);color:#fff;padding:6px 10px;border-radius:4px;font:13px/1.35 sans-serif';
        document.body.appendChild(statusEl);
      }
      statusEl.textContent = `IB12-E1: ${text}`;
    } catch (e) { err('status', e); }
  }
  function markA(wrap) {
    const d = docRect(wrap); if (!d) return;
    markerEl = document.createElement('div');
    markerEl.setAttribute('aria-hidden', 'true');
    markerEl.style.cssText = `position:absolute;top:${d.top - 4}px;left:${d.left - 4}px;width:${d.w + 8}px;height:${d.h + 8}px;border:4px solid #ff2d95;border-radius:6px;box-sizing:border-box;pointer-events:none;z-index:2147483645`;
    document.body.appendChild(markerEl);
  }

  // ---- setup after production mounted ----
  function setup() {
    try {
      rec.route = /^\/posts\/?$/.test(location.pathname) ? '/posts' : 'OTHER';
      rec.loggedOut = document.body?.getAttribute('data-user-is-anonymous') === 'true';
      rec.viewport = { w: window.innerWidth, h: window.innerHeight };
      rec.startScrollY = r1(window.scrollY);
      cardList = cards();
      rec.cardCount = cardList.length;
      if (!SITE || rec.route !== '/posts') return status('open a logged-out e621.net /posts listing.');
      if (!rec.loggedOut) return status('log out first (this check needs a logged-out listing).');
      const vh = window.innerHeight;
      const i = cardList.findIndex((c) => { const r = c.wrap.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= vh; });
      if (i < 0) return status('no fully visible card found; scroll to the top and reload.');
      rec.markedA = i; markA(cardList[i].wrap);
      status('click the card outlined in pink (A) to open the viewer.');
    } catch (e) { err('setup', e); }
  }

  // ---- observe the viewer (pass-through wrapper) ----
  let lastOrigin = null; let lastId = null; let original = null;
  function onOpen(post, context) {
    const id = post && post.id != null ? String(post.id) : null;
    if (id && ordinalOf(id) < 0) cardList = cards(); // a card added after setup
    const wrap = id ? wrapOf(id) : null;
    const o = { t: r1(now()), ordinal: id ? ordinalOf(id) : -1, rect: docRect(wrap), scrollY: r1(window.scrollY),
      originIsInCard: !!(context && context.origin && wrap && wrap.contains(context.origin)) };
    if (rec.opens.length < 60) rec.opens.push(o);
    if (rec.opens.length === 1) {
      rec.firstOpenWasA = o.ordinal === rec.markedA;
      rec.A = { ordinal: o.ordinal, rect: o.rect, scrollY: o.scrollY };
      original = { top: window.scrollY, bottom: window.scrollY + window.innerHeight };
    }
    lastOrigin = (context && context.origin) || null; lastId = id;
    const outside = !!o.rect && !!original && (o.rect.top >= original.bottom || o.rect.top + o.rect.h <= original.top);
    rec.C = { ordinal: o.ordinal, rect: o.rect, steps: rec.opens.length - 1 };
    rec.cOutsideOriginalViewport = rec.opens.length > 1 && outside;
    status(rec.cOutsideOriginalViewport ? 'the current card is outside the original view. Press Escape ONCE, then do not touch anything.' : 'click the viewer\'s Next ▶ button (top bar) until told to stop.');
  }
  const viewer = BE?.modules?.viewer;
  if (viewer && typeof viewer.open === 'function') {
    const openOrig = viewer.open;
    viewer.open = function observedOpen(post, navigation, context) {
      const ret = openOrig.apply(this, arguments);
      try { if (!closed) onOpen(post, context); } catch (e) { err('open', e); }
      return ret;
    };
  } else err('viewer', 'viewer module not available');

  // ---- close: Escape snapshot (capture, never prevented) + overlay observer ----
  let closed = false;
  window.addEventListener('keydown', (e) => {
    try {
      if (e.key !== 'Escape' || closed || !rec.opens.length) return;
      rec.beforeClose = { t: r1(now()), scrollY: r1(window.scrollY), cRect: docRect(wrapOf(lastId)), cVisibility: visibility(wrapOf(lastId)) };
    } catch (x) { err('escape', x); }
  }, true);
  for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart']) {
    window.addEventListener(type, () => { if (closed && !rec.complete) rec.inputAfterClose++; }, { capture: true, passive: true });
  }
  function focusFacts() {
    const a = document.activeElement; const wrap = wrapOf(lastId);
    return { tag: a ? a.tagName : null, isBody: a === document.body, isCOrigin: !!a && a === lastOrigin, insideC: !!(a && wrap && wrap.contains(a)), connected: !!(a && a.isConnected) };
  }
  function snap(label) {
    const wrap = wrapOf(lastId);
    rec.afterClose.push({ label, t: r1(now()), scrollY: r1(window.scrollY), cConnected: !!(wrap && wrap.isConnected), cRect: docRect(wrap), cVisibility: visibility(wrap), focus: focusFacts() });
  }
  function onClosed() {
    if (closed || !rec.opens.length) return;
    closed = true;
    try {
      rec.close = { t: r1(now()), via: rec.beforeClose ? 'Escape' : 'other' };
      snap('sync');
      requestAnimationFrame(() => { try { snap('frame'); } catch (e) { err('frame', e); } });
      for (const ms of SETTLE_MS) setTimeout(() => { try { snap(`${ms}ms`); } catch (e) { err('settle', e); } }, ms);
      setTimeout(finish, SETTLE_MS[SETTLE_MS.length - 1] + 200);
    } catch (e) { err('close', e); }
  }
  let overlayObserver = null;
  function watchOverlay() {
    const ov = document.getElementById('be-viewer-overlay');
    if (!ov) return false;
    overlayObserver = new MutationObserver(() => { if (ov.style.display === 'none') onClosed(); });
    overlayObserver.observe(ov, { attributes: true, attributeFilter: ['style'] });
    return true;
  }
  const overlayPoll = setInterval(() => { if (watchOverlay()) clearInterval(overlayPoll); }, 200);

  // production BE.log.error, counted only (pass-through, no messages kept)
  if (BE?.log && typeof BE.log.error === 'function') {
    const logOrig = BE.log.error;
    BE.log.error = function countedError() { rec.productionLogErrors++; return logOrig.apply(this, arguments); };
  }
  window.addEventListener('error', (e) => err('window', e.error || e.message));

  // ---- identity, runtime, sanitation, output ----
  async function sourceIdentity() {
    if (typeof IB07P_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB07P_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }
  function runtime() {
    const ua = navigator.userAgentData;
    const browser = ua && ua.brands ? ua.brands.map((b) => `${b.brand} ${b.version}`).join('; ') : 'UNKNOWN';
    const gi = typeof GM_info === 'object' && GM_info ? GM_info : null;
    return { browser, platform: (ua && ua.platform) || 'UNKNOWN', manager: gi ? `${gi.scriptHandler || '?'} ${gi.version || '?'}` : 'UNKNOWN' };
  }
  function guard(text) {
    const ids = cardList.map((c) => c.id).filter((v) => v.length >= 4);
    const leaked = /https?:\/\//i.test(text) || ids.some((v) => new RegExp(`(^|[^0-9.])${v}([^0-9]|$)`).test(text));
    return leaked ? JSON.stringify({ probe: PROBE, version: VERSION, site: SITE, sanitationGuard: 'BLOCKED' }, null, 2) : text;
  }
  function show(text) {
    const root = document.createElement('div');
    root.id = 'ib12e1-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const note = document.createElement('div'); note.textContent = 'IB12-E1 RECORDED. Download the results (or copy the text) and save it as tests/results/ib12-e1-e621-tier0.json.';
    const ta = document.createElement('textarea'); ta.value = text; ta.readOnly = true; ta.style.cssText = 'width:100%;height:65vh;background:#000;color:#eee';
    const dl = document.createElement('button'); dl.textContent = 'Download results';
    dl.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'ib12-e1-e621-tier0.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
    const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => root.remove();
    root.append(note, ta, dl, close); document.body.appendChild(root);
  }
  async function finish() {
    try {
      if (overlayObserver) overlayObserver.disconnect();
      rec.production_body_identity = await sourceIdentity();
      rec.runtime = runtime();
      rec.complete = true;
      statusEl?.remove(); markerEl?.remove();
      const text = guard(JSON.stringify(rec, null, 2));
      window.__IB12E1_RESULT__ = text;
      show(text);
    } catch (e) { err('finish', e); }
  }

  const start = () => setTimeout(setup, 800);
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start, { once: true });
})();
