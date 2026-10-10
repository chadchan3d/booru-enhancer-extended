/* IB12E2 RULE34 NATIVE BACK AND PAGE-ADDRESS OBSERVER POSTAMBLE — test code, not production.
 * The body above is production (commit 466a480) UNCHANGED, run once inside the
 * IB07P wrapper so its executed source can be hashed. This observer changes no
 * production behaviour, settings, history, scrolling or append:
 *   - BE.net.request / BE.net.json are wrapped pass-through (same arguments, same
 *     returned promise) only to see which native listing URL supplied each
 *     appended batch and to count enhancer requests after a return;
 *   - probe state survives the same-tab navigations under ONE sessionStorage key
 *     (KEY below); post IDs and URLs stay in its private part and never reach the
 *     output;
 *   - a small panel offers plain native links (outside the gallery, so the
 *     enhancer does not intercept them); for the fresh-load test only, it makes
 *     the listing BFCache-ineligible (an unload listener and a held Web Lock)
 *     right before leaving, and records the browser's own evidence.
 * Flow: collect two appended native pages -> C = first card of the second batch ->
 * normal Back -> fresh-load Back -> fresh load of C's observed native page.
 * Output: pid values, ordinals, rectangles, scroll positions, flags; a leak guard
 * withholds the result if any URL, post ID or tag query would appear. */
(() => {
  'use strict';

  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function () {\n';
  const PROBE = 'ib12-e2-rule34';
  const VERSION = '1.0.0';
  const KEY = 'ib12e2';
  const SITE = location.hostname === 'rule34.xxx' ? 'rule34.xxx' : null;
  const SNAP_MS = [300, 1500];
  const BE = window.BE;
  const r1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  const T0 = performance.now();
  const now = () => performance.now() - T0;

  // ---- probe state (sessionStorage, one key) ----
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { err('save', e); } };
  let S = load();
  function err(where, e) {
    try { const st = S || load(); if (!st) return; if (st.pub.probeErrors.length < 10) st.pub.probeErrors.push({ where, message: String((e && e.message) || e).replace(/https?:\/\/\S+/g, '<url>').slice(0, 160) }); save(st); } catch { /* noop */ }
  }

  // ---- route facts (never the URL itself) ----
  const params = (u) => { const x = new URL(u, location.href); return { page: x.searchParams.get('page'), s: x.searchParams.get('s'), pid: x.searchParams.has('pid') ? Number(x.searchParams.get('pid')) : 0, tags: x.searchParams.get('tags') || '' }; };
  const here = params(location.href);
  const isList = !!SITE && here.page === 'post' && here.s === 'list';
  const isView = !!SITE && here.page === 'post' && here.s === 'view';

  // ---- cards (read-only adapter calls) ----
  const adapter = () => BE?.adapters?.active;
  function cards() {
    const a = adapter(); if (!a) return [];
    const root = (a.getGalleryContainer && a.getGalleryContainer()) || document;
    const out = [];
    for (const img of a.getThumbElements(root)) {
      const wrap = (a.getThumbWrapper && a.getThumbWrapper(img)) || null; const id = a.getThumbPostId(img);
      if (wrap && id && !out.some((c) => c.wrap === wrap)) out.push({ wrap, id: String(id) });
    }
    return out;
  }
  const findC = () => { const id = S && S.priv.cId; if (!id) return { i: -1, wrap: null }; const list = cards(); const i = list.findIndex((c) => c.id === id); return { i, wrap: i >= 0 ? list[i].wrap : null }; };
  function vis(el) {
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect(); const vh = window.innerHeight;
    const v = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return { docTop: r1(r.top + window.scrollY), viewTop: r1(r.top), h: r1(r.height), visibleFraction: r.height > 0 ? r1(v / r.height) : 0 };
  }
  const stateText = () => { try { return JSON.stringify(history.state === undefined ? null : history.state); } catch { return '"<unserializable>"'; } };
  function snapshot() {
    const list = cards(); const c = findC();
    const appendedIds = new Set((S.priv.batchIds || []).flat());
    return { scrollY: r1(window.scrollY), cardCount: list.length, appendedCardsPresent: list.filter((x) => appendedIds.has(x.id)).length,
      cConnected: !!c.wrap, cOrdinal: c.i, c: vis(c.wrap), historyStateIsNull: history.state === null || history.state === undefined };
  }

  // ---- request observation (pass-through wrappers) ----
  let listingSinceReturn = null; let otherSinceReturn = 0; let returnT = null;
  if (BE?.net && typeof BE.net.request === 'function') {
    const reqOrig = BE.net.request;
    BE.net.request = function observedRequest(opts) {
      const p = reqOrig.apply(this, arguments);
      try {
        if (opts && opts.operation === 'gallery-pagination') {
          if (listingSinceReturn) listingSinceReturn.push(params(opts.url).pid);
          if (S && S.phase === 'collect') { const url = opts.url; p.then(() => setTimeout(() => recordBatch(url), 0), () => setTimeout(() => recordBatch(url, true), 0)); }
        } else if (returnT !== null) otherSinceReturn++;
      } catch (e) { err('request', e); }
      return p;
    };
  }
  if (BE?.net && typeof BE.net.json === 'function') {
    const jsonOrig = BE.net.json;
    BE.net.json = function observedJson() { const p = jsonOrig.apply(this, arguments); if (returnT !== null) otherSinceReturn++; return p; };
  }
  function recordBatch(url, failed = false) {
    try {
      if (!S || S.phase !== 'collect') return;
      const list = cards(); const known = S.priv.knownCount; const ids = list.slice(known).map((c) => c.id);
      const p = params(url);
      S.pub.batches.push({ n: S.pub.batches.length + 1, pid: p.pid, sameRoute: p.page === S.priv.start.page && p.s === S.priv.start.s && p.tags === S.priv.start.tags,
        failed, inserted: ids.length, ordinalFrom: ids.length ? known : null, ordinalTo: ids.length ? list.length - 1 : null });
      S.priv.batchUrls.push(url); S.priv.batchIds.push(ids); S.priv.knownCount = list.length;
      const nonEmpty = S.pub.batches.map((b, i) => [b, i]).filter(([b]) => b.inserted > 0);
      if (!S.priv.cId && nonEmpty.length >= 2) {
        const i = nonEmpty[1][1];
        S.priv.cId = S.priv.batchIds[i][0]; S.priv.cBatchUrl = S.priv.batchUrls[i];
        const c = findC(); S.priv.cHref = c.wrap && c.wrap.querySelector('a[href]') ? c.wrap.querySelector('a[href]').href : null;
        S.pub.C = { batch: i + 1, batchPid: S.pub.batches[i].pid, ordinal: c.i, laterThanFirstBatch: S.pub.batches[i].pid > nonEmpty[0][0].pid, hasNativePostLink: !!S.priv.cHref };
      }
      save(S);
    } catch (e) { err('batch', e); }
  }

  // ---- navigation evidence ----
  function navFacts() {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    const reasons = [];
    const walk = (n) => { if (!n) return; for (const r of n.reasons || []) reasons.push(String(r.reason || r).replace(/[^a-z0-9-]/gi, '').slice(0, 40)); for (const ch of n.children || []) walk(ch); };
    try { walk(nav && nav.notRestoredReasons); } catch { /* noop */ }
    return { navigationType: nav ? nav.type : 'UNKNOWN', notRestoredReasons: nav && 'notRestoredReasons' in nav ? reasons : 'UNSUPPORTED' };
  }
  let inputSinceReturn = 0;
  for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart']) window.addEventListener(type, () => { if (returnT !== null) inputSinceReturn++; }, { capture: true, passive: true });
  window.addEventListener('pageshow', (e) => {
    try {
      S = load();
      if (!S || !isList || (S.phase !== 'away1' && S.phase !== 'away2')) return;
      const which = S.phase === 'away1' ? 'back1' : 'back2';
      returnT = now(); listingSinceReturn = []; otherSinceReturn = 0; inputSinceReturn = 0;
      const ret = { persisted: !!e.persisted, ...navFacts(), atPageshow: snapshot(), snaps: [] };
      S.pub[which] = ret; save(S);
      for (const ms of SNAP_MS) setTimeout(() => {
        try {
          S = load(); const r = S.pub[which];
          r.snaps.push({ label: `${ms}ms`, ...snapshot() });
          if (ms === SNAP_MS[SNAP_MS.length - 1]) {
            r.listingRequestsAfterReturn = listingSinceReturn.length; r.listingPidsAfterReturn = listingSinceReturn.slice(0, 10);
            r.otherEnhancerRequestsAfterReturn = otherSinceReturn; r.inputAfterReturn = inputSinceReturn;
            r.historyStateUnchanged = stateText() === (which === 'back1' ? S.priv.state1 : S.priv.state2);
            if (which === 'back2') r.freshLoadConfirmed = !r.persisted && r.navigationType === 'back_forward';
            S.phase = which === 'back1' ? 'back1done' : 'back2done'; returnT = null;
          }
          save(S); render();
        } catch (x) { err('snap', x); }
      }, ms);
    } catch (x) { err('pageshow', x); }
  });

  // ---- panel (outside the gallery; plain native links) ----
  let panel = null; let marker = null;
  function link(text, href, onClick) { const a = document.createElement('a'); a.textContent = text; a.href = href; a.style.cssText = 'display:block;margin-top:6px;color:#9cf;font-weight:bold'; a.addEventListener('click', onClick); return a; }
  function button(text, onClick) { const b = document.createElement('button'); b.textContent = text; b.style.cssText = 'margin-top:6px;margin-right:6px'; b.addEventListener('click', onClick); return b; }
  // The panel is rebuilt only when its content changes (a click never lands on a link being replaced).
  let lastView = null;
  function view() {
    const items = []; const say = (t) => items.push(['say', t]); const go = (t, href, act) => items.push(['link', t, href, act]);
    const ph = S ? S.phase : null;
    if (isView) { say(ph === 'away1' || ph === 'away2' ? 'now press the browser Back button.' : 'open a logged-out rule34.xxx listing (index.php?page=post&s=list).'); return items; }
    if (!isList) { say('open a logged-out rule34.xxx listing (index.php?page=post&s=list).'); return items; }
    const c = findC();
    if (ph === 'collect') {
      const n = S.pub.batches.filter((b) => b.inserted > 0).length;
      if (!S.priv.cId) say(`scroll down slowly; appended pages so far: ${n} of 2.`);
      else if (!c.wrap) say('C was chosen but is not on this page; press Reset and start again.');
      else {
        const v = vis(c.wrap);
        if (!v || v.visibleFraction < 0.5) say('C (outlined in pink) is on the 2nd appended page. Scroll until C is visible.');
        else { say('C is visible. Step 1:'); go('1) Open C\'s post page (normal Back test)', S.priv.cHref, 'away1'); }
      }
    } else if (ph === 'back1done') { say('normal Back recorded. Step 2 (do not scroll first):'); go('2) Open C\'s post page (fresh-load Back test)', S.priv.cHref, 'away2'); }
    else if (ph === 'back2done') { say(S.pub.back2 && S.pub.back2.freshLoadConfirmed ? 'fresh-load Back recorded. Step 3:' : 'Back recorded, but it was NOT a fresh load (BFCache still used). Step 3 records this:'); go('3) Open C\'s observed native page', S.priv.cBatchUrl, 'pagecheck'); }
    else if (ph === 'away1' || ph === 'away2') say('waiting for the return to settle (about 2 s); do not touch anything.');
    else if (ph === 'done') say('RECORDED. Use the result box (Download), or Reset for a new run.');
    if (ph !== 'pagecheck') items.push(['reset']);
    return items;
  }
  function render() {
    try {
      if (!SITE) return;
      if (isList) updateMarker(findC().wrap);
      const items = view(); const key = JSON.stringify(items);
      if (key === lastView && panel) return;
      lastView = key;
      if (!panel) { panel = document.createElement('div'); panel.id = 'ib12e2-panel'; panel.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:340px;z-index:2147483646;background:rgba(17,17,17,.92);color:#fff;padding:8px 10px;border-radius:4px;font:13px/1.35 sans-serif'; document.body.appendChild(panel); }
      panel.textContent = '';
      for (const [kind, text, href, act] of items) {
        if (kind === 'say') { const d = document.createElement('div'); d.textContent = `IB12-E2: ${text}`; panel.appendChild(d); }
        else if (kind === 'link') panel.appendChild(link(text, href, () => { if (act === 'away1') leave('away1'); else if (act === 'away2') { armFresh(); leave('away2'); } else { S.phase = 'pagecheck'; save(S); } }));
        else panel.appendChild(button('Reset', () => { try { sessionStorage.removeItem(KEY); } catch { /* noop */ } location.reload(); }));
      }
    } catch (e) { err('render', e); }
  }
  function updateMarker(wrap) {
    if (!wrap || !wrap.isConnected) { if (marker) marker.style.display = 'none'; return; }
    if (!marker) { marker = document.createElement('div'); marker.setAttribute('aria-hidden', 'true'); document.body.appendChild(marker); }
    const r = wrap.getBoundingClientRect();
    marker.style.cssText = `position:absolute;top:${r.top + window.scrollY - 4}px;left:${r.left + window.scrollX - 4}px;width:${r.width + 8}px;height:${r.height + 8}px;border:4px solid #ff2d95;border-radius:6px;box-sizing:border-box;pointer-events:none;z-index:2147483645`;
  }
  function leave(phase) {
    try {
      const snap = snapshot();
      if (phase === 'away1') { S.pub.leave1 = snap; S.priv.state1 = stateText(); } else { S.pub.leave2 = snap; S.priv.state2 = stateText(); }
      S.phase = phase; save(S); // the native link then navigates normally (not prevented)
    } catch (e) { err('leave', e); }
  }
  let held = null;
  function armFresh() {
    const armed = [];
    try { window.addEventListener('unload', () => {}); armed.push('unload-listener'); } catch (e) { err('arm-unload', e); }
    try { if (navigator.locks && navigator.locks.request) { navigator.locks.request('ib12e2-bfcache-ineligible', () => new Promise((resolve) => { held = resolve; })); armed.push('web-lock'); } } catch (e) { err('arm-lock', e); }
    S.pub.freshArm = armed;
  }

  // ---- native later-page check (fresh load of the observed URL; native DOM only) ----
  function pageCheck() {
    const list = cards(); const i = list.findIndex((c) => c.id === S.priv.cId);
    const want = params(S.priv.cBatchUrl); const got = here;
    S.pub.pageCheck = { urlMatchesObserved: location.href === new URL(S.priv.cBatchUrl, location.href).href, sameParams: want.page === got.page && want.s === got.s && want.pid === got.pid && want.tags === got.tags,
      pid: got.pid, navigationType: navFacts().navigationType, cardCount: list.length, cOnPage: i >= 0, cOrdinalOnPage: i };
    S.phase = 'done'; save(S);
  }

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
    const ua = navigator.userAgentData; const gi = typeof GM_info === 'object' && GM_info ? GM_info : null;
    return { browser: ua && ua.brands ? ua.brands.map((b) => `${b.brand} ${b.version}`).join('; ') : 'UNKNOWN', platform: (ua && ua.platform) || 'UNKNOWN', manager: gi ? `${gi.scriptHandler || '?'} ${gi.version || '?'}` : 'UNKNOWN' };
  }
  function guard(text) {
    const secret = [...new Set([...(S.priv.batchIds || []).flat(), ...cards().map((c) => c.id), S.priv.cId].filter((v) => v && String(v).length >= 4).map(String))];
    const tags = [S.priv.start.tags, ...(S.priv.batchUrls || []).map((u) => params(u).tags)].filter((t) => t && t.length >= 2);
    const leaked = /https?:\/\//i.test(text) || secret.some((v) => new RegExp(`(^|[^0-9.])${v}([^0-9]|$)`).test(text)) || tags.some((t) => text.includes(t));
    return leaked ? JSON.stringify({ probe: PROBE, version: VERSION, site: SITE, sanitationGuard: 'BLOCKED' }, null, 2) : text;
  }
  async function finish() {
    try {
      S.pub.production_body_identity = await sourceIdentity(); S.pub.runtime = runtime(); S.pub.complete = true; save(S);
      const text = guard(JSON.stringify(S.pub, null, 2));
      window.__IB12E2_RESULT__ = text;
      const root = document.createElement('div'); root.id = 'ib12e2-result';
      root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
      const note = document.createElement('div'); note.textContent = 'IB12-E2 RECORDED. Download the results (or copy the text) and save it as tests/results/ib12-e2-rule34.json.';
      const ta = document.createElement('textarea'); ta.value = text; ta.readOnly = true; ta.style.cssText = 'width:100%;height:65vh;background:#000;color:#eee';
      const dl = document.createElement('button'); dl.textContent = 'Download results';
      dl.onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = 'ib12-e2-rule34.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
      const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => root.remove();
      root.append(note, ta, dl, close); document.body.appendChild(root);
    } catch (e) { err('finish', e); }
  }

  // ---- start ----
  try {
    // A new run starts on a listing when there is none (Reset clears it); a finished run starts over.
    if (isList && (!S || S.phase === 'done')) {
      {
        const list = cards();
        S = { phase: 'collect',
          pub: { probe: PROBE, version: VERSION, site: SITE, start: { pid: here.pid, hasTags: !!here.tags, cardCount: list.length, scrollY: r1(window.scrollY) }, batches: [], C: null,
            leave1: null, back1: null, freshArm: null, leave2: null, back2: null, pageCheck: null, production_body_identity: null, runtime: null, probeErrors: [], complete: false },
          priv: { start: { page: here.page, s: here.s, tags: here.tags }, knownCount: list.length, batchUrls: [], batchIds: [], cId: null, cHref: null, cBatchUrl: null, state1: null, state2: null } };
        save(S);
      }
    }
    if (isList && S && S.phase === 'pagecheck') { pageCheck(); finish(); }
    const tick = () => render();
    if (document.body) tick(); else window.addEventListener('DOMContentLoaded', tick, { once: true });
    setInterval(tick, 500);
  } catch (e) { err('start', e); }
})();
