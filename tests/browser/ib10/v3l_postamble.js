/* IB10 V3-L OBSERVER POSTAMBLE — test code, not production. Observe-only.
 * Records the operator's REAL hovers on video cards (it generates no events) on a
 * logged-out e621/e926 /posts listing, in bounded sessions. Generation tracking
 * wraps the gallery's own BE.modules.hover.show/hide property calls and always
 * calls the originals with the same arguments (the IB09 observer pattern). For
 * each video-card generation it samples the hover element(s) at leave (after
 * production's own cleanup ran), +1 s and +5 s, plus the count of hover-owned
 * <video> elements still holding a source, and reads Resource Timing for the
 * card's file where the browser exposes it. DOM/media state and network timing
 * are recorded separately; neither is turned into a claim that bytes stopped.
 * Output: sanitized JSON on "Show results" (no URLs, post IDs or hashes; exact
 * data-size and native dimensions are kept as requested). No request, storage,
 * cookie or settings access of its own. */
(() => {
  'use strict';
  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function () {\n';
  const MAX_USABLE = 40;        // per session (one session per host is expected)
  const MAX_GENERATIONS = 120;  // raw video-card generations per session (bound)
  const MAX_SESSIONS = 4;       // per page load
  const VIDEO_EXT = ['mp4', 'webm', 'mov'];
  const SITES = ['e621.net', 'e926.net'];
  const SITE = SITES.includes(window.location.hostname) ? window.location.hostname : null;
  const R = IB10L;
  const C = IB10L_CLASSIFY;
  const BE = window.BE;
  const hover = BE && BE.modules && BE.modules.hover;
  const abs = (u) => { try { return u ? new URL(u, window.location.href).href : ''; } catch { return ''; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let session = null; const sessions = [];
  let gen = null;
  let lastPointer = { trusted: null, t: -1e9 };
  const fileUrlOf = new WeakMap(); // generation -> absolute card file URL (never output)
  const cardOrdinal = new Map();   // card element -> ordinal (never output)

  document.addEventListener('pointerover', (e) => { lastPointer = { trusted: e.isTrusted, t: R.t() }; }, true);

  function startOk() {
    if (!SITE || !/^\/posts\/?$/.test(window.location.pathname)) return 'IB10L: open a logged-out e621/e926 /posts listing';
    if (document.body?.getAttribute('data-user-is-anonymous') !== 'true') return 'IB10L: must be logged out';
    if (!hover) return 'IB10L: hover module not available';
    if (!BE.settings?.get?.('media.hoverPreview')) return 'IB10L: hover preview is turned off in the enhancer settings';
    if (sessions.length >= MAX_SESSIONS) return 'IB10L: session limit reached; reload the page';
    return null;
  }

  const usableSoFar = () => (session ? session.generations.filter((g) => g.final && C.classify(g).status === 'USABLE').length : 0);

  function sample(g, key) {
    const els = R.hoverFor(g.n);
    g.samples[key] = {
      t: R.t() - g.enterT,
      element: els.length ? R.state(els[0]) : null,
      holdingHoverVideos: R.holdingHoverCount(),
      viewerOpen: !!BE.modules.viewer?.isOpen?.(),
      hidden: document.visibilityState === 'hidden',
    };
  }

  function finalize(g) {
    const els = R.hoverFor(g.n);
    g.hoverElements = els.length;
    const r = els[0] && els[0].__ib10l;
    const firstEv = (name) => { const e = r && r.ev.find((x) => x[1] === name); return e ? e[0] - g.enterT : null; };
    g.element = r ? {
      srcMatchesCardFile: r.srcMatchesCardFile,
      srcSetT: r.srcSetT == null ? null : r.srcSetT - g.enterT,
      srcRemovedT: r.srcRemovedT.map((x) => x - g.enterT),
      calls: r.calls.map(([x, k, m]) => [x - g.enterT, k, m]),
      readiness: { loadedmetadata: firstEv('loadedmetadata'), loadeddata: firstEv('loadeddata'), canplay: firstEv('canplay'), playing: firstEv('playing') },
      firstFrame: r.firstFrame == null ? null : r.firstFrame - g.enterT,
      events: r.ev.map(([x, name, rs, ns, be]) => [x - g.enterT, name, rs, ns, be]),
    } : null;
    const url = fileUrlOf.get(g);
    const base = performance.now() - R.t(); // performance-time origin of R.t()
    g.resourceTiming = (url ? performance.getEntriesByName(url, 'resource') : [])
      .filter((e) => e.startTime >= base + g.enterT - 1)
      .map((e) => ({ initiatorType: e.initiatorType, startT: Math.round(e.startTime - base - g.enterT), responseEnd: e.responseEnd > 0 ? Math.round(e.responseEnd - base - g.enterT) : 0,
        transferSize: e.transferSize || 0, encodedBodySize: e.encodedBodySize || 0, decodedBodySize: e.decodedBodySize || 0 }));
    g.final = true;
    if (session && session.generations.includes(g) && usableSoFar() >= MAX_USABLE && !session.capNoted) { session.capNoted = true; toast(`IB10L: ${MAX_USABLE} usable video hovers recorded; choose Show results`, 6000); }
  }

  // Viewer opens (pass-through wrapper of the module property production calls):
  // every generation still inside its observation window is marked.
  const viewer = BE && BE.modules && BE.modules.viewer;
  if (viewer && typeof viewer.open === 'function') {
    const openOrig = viewer.open;
    viewer.open = function observedViewerOpen(...a) {
      if (session) for (const g of session.generations) if (!g.final) g.viewerOpened = true;
      return openOrig.apply(this, a);
    };
  }

  if (hover) {
    const showOrig = hover.show; const hideOrig = hover.hide;
    hover.show = function observedShow(img, ...rest) {
      gen = null; R.setGeneration(0, '');
      const card = img && img.closest ? img.closest('article') : null;
      const ext = String(card?.getAttribute('data-file-ext') || '').toLowerCase();
      if (session && card && VIDEO_EXT.includes(ext)) {
        if (session.generations.length >= MAX_GENERATIONS || usableSoFar() >= MAX_USABLE) session.droppedBeyondCap++;
        else {
          if (!cardOrdinal.has(card)) cardOrdinal.set(card, cardOrdinal.size + 1);
          const n = session.generations.length + 1;
          const onCard = session.generations.filter((x) => x._card === card).length + 1;
          const now = R.t();
          const g = { n, host: SITE, container: ext, dataSize: Number(card.getAttribute('data-size')) || null,
            width: Number(card.getAttribute('data-width')) || null, height: Number(card.getAttribute('data-height')) || null,
            cardOrdinal: cardOrdinal.get(card), hoverOnCard: onCard,
            trigger: lastPointer.trusted === true && now - lastPointer.t < 1000 ? 'TRUSTED' : (lastPointer.trusted === false && now - lastPointer.t < 1000 ? 'SYNTHETIC' : 'UNKNOWN'),
            enterT: now, leaveT: null, samples: {}, viewerOpened: false, final: false };
          Object.defineProperty(g, '_card', { value: card, enumerable: false });
          fileUrlOf.set(g, abs(card.getAttribute('data-file-url')));
          session.generations.push(g); gen = g;
          R.setGeneration(n, card.getAttribute('data-file-url'));
        }
      } else if (session && card) session.otherHovers++;
      return showOrig.call(this, img, ...rest);
    };
    hover.hide = function observedHide(...a) {
      const g = gen;
      const out = hideOrig.apply(this, a);
      if (g && g.leaveT === null) {
        g.leaveT = R.t() - g.enterT;
        sample(g, 'leave');
        setTimeout(() => sample(g, 'p1'), 1000);
        setTimeout(() => { sample(g, 'p5'); finalize(g); }, 5000);
      }
      return out;
    };
  }

  async function identity() {
    if (typeof IB10L_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB10L_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('') === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  function guard(text) {
    const raw = new Set();
    for (const a of document.querySelectorAll('article')) for (const k of ['data-id', 'data-md5', 'data-preview-url', 'data-preview-webp', 'data-sample-url', 'data-file-url']) { const v = a.getAttribute(k); if (v && v.length >= 3) { raw.add(v); raw.add(abs(v)); } }
    const leaked = [...raw].some((v) => text.includes(`"${v}"`) || (v.length > 8 && text.includes(v))) || /https?:\/\//i.test(text);
    return leaked ? JSON.stringify({ probe: 'ib10-v3l-live', site: SITE, sanitationGuard: 'BLOCKED' }, null, 2) : text;
  }
  function show(text) {
    document.querySelector('#ib10l-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib10l-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta = document.createElement('textarea'); ta.value = text; ta.readOnly = true; ta.style.cssText = 'width:100%;height:75vh;background:#000;color:#eee';
    const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => root.remove();
    root.append(ta, close); document.body.appendChild(root); ta.focus(); ta.select();
  }
  let toastTimer = null;
  function toast(message, ms = 2500) {
    document.querySelector('#ib10l-toast')?.remove();
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.id = 'ib10l-toast';
    el.textContent = message;
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:280px;z-index:2147483647;pointer-events:none;background:rgba(17,17,17,.85);color:#eee;padding:4px 8px;border-radius:4px;font:12px/1.3 sans-serif';
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), ms);
  }

  function start() {
    const refusal = startOk();
    if (refusal) return toast(refusal, 5000);
    document.querySelector('#ib10l-result')?.remove();
    session = { startedT: R.t(), generations: [], droppedBeyondCap: 0, otherHovers: 0, capNoted: false };
    sessions.push(session); gen = null;
    toast('IB10L recording video-card hovers');
    return session;
  }
  function counts(gs) {
    const cls = gs.map((g) => ({ g, c: C.classify(g) }));
    const tally = (xs) => xs.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});
    const usable = cls.filter((x) => x.c.status === 'USABLE');
    return { generations: gs.length, status: tally(cls.map((x) => x.c.status)), usableByContainer: tally(usable.map((x) => x.g.container)),
      usableLeave: tally(usable.map((x) => x.c.leave)), maxHoldingHoverVideos: Math.max(0, ...gs.flatMap((g) => Object.values(g.samples).map((s) => s.holdingHoverVideos))) };
  }
  async function results() {
    const ending = session; session = null; gen = null;
    document.querySelector('#ib10l-toast')?.remove();
    if (ending) { const end = Date.now() + 5600; while (ending.generations.some((g) => g.leaveT !== null && !g.final) && Date.now() < end) await sleep(100); }
    for (const s of sessions) for (const g of s.generations) if (!g.final) finalize(g);
    const out = { probe: 'ib10-v3l-live', version: '1.0.0', site: SITE, production_body_identity: await identity(),
      runtime: { browser: (navigator.userAgentData?.brands || []).map((b) => `${b.brand} ${b.version}`).join('; ') || null, manager: typeof GM_info === 'object' ? `${GM_info.scriptHandler || ''} ${GM_info.version || ''}`.trim() : null },
      sessions: sessions.map((s) => ({ droppedBeyondCap: s.droppedBeyondCap, otherHovers: s.otherHovers, summary: counts(s.generations),
        generations: s.generations.map((g) => ({ ...g, classification: C.classify(g) })) })),
      notes: 'DOM/media state and Resource Timing are recorded separately; neither proves that network transfer stopped.' };
    show(guard(JSON.stringify(out, null, 1)));
    return out;
  }

  const reg = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : null;
  if (reg) {
    reg('IB10L: Start session (video hovers)', () => start());
    reg('IB10L: Show results (ends the session)', () => results());
  }
})();
