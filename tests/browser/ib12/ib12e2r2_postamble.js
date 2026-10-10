/* IB12E2R2 RULE34 NATIVE BACK AND PAGE-ADDRESS OBSERVER POSTAMBLE (guided, GM run state) — test code, not production.
 * Revision 2 of the E2 recorder (IB12-E2R2). The measurement functions are the E2 recorder's,
 * byte for byte. Changed: (1) the run state lives in ONE Tampermonkey probe key
 * (GM_getValue/GM_setValue/GM_deleteValue; never the enhancer settings) because the E2R sessionStorage
 * state did not survive real navigation; (2) a run starts only from an explicit START action,
 * never by itself; (3) lost/corrupt state, an unexpected route/phase and a return that is not a
 * browser Back abort the run explicitly; (4) the panel shows STEP X OF 4 and a monotonic
 * progress line. E2 and E2R stay historical.
 * The body above is production (commit 466a480) UNCHANGED, run once inside the
 * IB07P wrapper so its executed source can be hashed. This observer changes no
 * production behaviour, settings, history, scrolling or append:
 *   - BE.net.request / BE.net.json are wrapped pass-through (same arguments, same
 *     returned promise) only to see which native listing URL supplied each
 *     appended batch and to count enhancer requests after a return;
 *   - probe state survives the same-tab navigations under ONE probe key (E2R2: a Tampermonkey key)
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
  const VERSION = '1.2.0-gm-state';
  const KEY = 'ib12-e2r2-run-state'; // the one Tampermonkey probe key (test instrumentation, not a setting)
  const STATE_V = 'ib12-e2r2/1';
  const ACTIVE = 'ib12-e2r2-active'; // secondary sessionStorage marker: detects a lost run, never the run state
  const CANONICAL = 'https://rule34.xxx/index.php?page=post&s=list';
  const SITE = location.hostname === 'rule34.xxx' ? 'rule34.xxx' : null;
  const SNAP_MS = [300, 1500];
  const BE = window.BE;
  const r1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : null);
  const T0 = performance.now();
  const now = () => performance.now() - T0;

  // ---- probe state (E2R2: one Tampermonkey probe key; a sessionStorage marker only detects loss) ----
  const GMOK = typeof GM_getValue === 'function' && typeof GM_setValue === 'function' && typeof GM_deleteValue === 'function';
  const marker0 = () => { try { return sessionStorage.getItem(ACTIVE); } catch { return null; } };
  // load(): null = no run; { lost: true } = a run should exist but its state is unavailable, corrupt or incompatible.
  const load = () => {
    if (!GMOK) return marker0() ? { lost: true } : null;
    let raw; try { raw = GM_getValue(KEY, null); } catch { return { lost: true }; }
    if (raw === null || raw === undefined) return marker0() ? { lost: true } : null;
    try { const v = JSON.parse(raw); return v && v.v === STATE_V && v.pub && v.priv ? v : { lost: true }; } catch { return { lost: true }; }
  };
  const save = (s) => { try { if (s && !s.lost) GM_setValue(KEY, JSON.stringify(s)); } catch (e) { err('save', e); } };
  const clearRun = () => { try { if (GMOK) GM_deleteValue(KEY); } catch { /* noop */ } try { sessionStorage.removeItem(ACTIVE); } catch { /* noop */ } };
  let S = load();
  function err(where, e) {
    try { const st = S && !S.lost ? S : load(); if (!st || st.lost) return; if (st.pub.probeErrors.length < 10) st.pub.probeErrors.push({ where, message: String((e && e.message) || e).replace(/https?:\/\/\S+/g, '<url>').slice(0, 160) }); save(st); } catch { /* noop */ }
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
      if (!S || S.lost || !isList || (S.phase !== 'away1' && S.phase !== 'away2')) return;
      const which = S.phase === 'away1' ? 'back1' : 'back2';
      returnT = now(); listingSinceReturn = []; otherSinceReturn = 0; inputSinceReturn = 0;
      const ret = { persisted: !!e.persisted, ...navFacts(), atPageshow: snapshot(), snaps: [] };
      // IB12-E2R2: only a browser Back counts (BFCache restore, or a back_forward load of the canonical listing)
      if (!canonicalHere() || (!ret.persisted && ret.navigationType !== 'back_forward')) { returnT = null; abort('UNEXPECTED NAVIGATION'); return; }
      S.pub[which] = ret; save(S); render();
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
  // Guided panel (IB12-E2R2): STEP X OF 4, a monotonic progress line, exactly one next action;
  // rebuilt only when its content changes.
  const canonicalHere = () => isList && here.pid === 0 && !here.tags;
  function abort(kind) { if (!S || S.lost) return; S.phase = 'aborted'; S.abort = kind; save(S); render(); }
  function bigLink(text, href, onClick) {
    const a = document.createElement('a'); a.textContent = text; a.href = href; a.dataset.ib12e2Action = '1';
    a.style.cssText = 'display:block;margin:10px 0 4px;padding:12px 14px;background:#ff2d95;color:#fff;font:bold 17px/1.2 sans-serif;text-align:center;text-decoration:none;border-radius:6px;border:3px solid #fff';
    a.addEventListener('click', onClick); return a;
  }
  // A new run: created explicitly, then the canonical listing opens in the same tab (the link's own navigation).
  function startRun() {
    clearRun();
    S = { v: STATE_V, phase: 'starting', abort: null, pub: null, priv: null };
    S.pub = { probe: PROBE, version: VERSION, site: SITE, start: null, batches: [], C: null, leave1: null, back1: null, freshArm: null, leave2: null, back2: null, pageCheck: null, production_body_identity: null, runtime: null, probeErrors: [], complete: false };
    S.priv = { start: null, knownCount: 0, batchUrls: [], batchIds: [], cId: null, cHref: null, cBatchUrl: null, state1: null, state2: null };
    save(S); try { sessionStorage.setItem(ACTIVE, '1'); } catch { /* noop */ }
  }
  function progress() {
    const ph = S && !S.lost ? S.phase : null; const order = ['starting', 'collect', 'away1', 'back1done', 'away2', 'back2done', 'pagecheck', 'done'];
    const at = order.indexOf(ph); const reached = (p) => at >= order.indexOf(p) && at >= 0;
    const m = (ok) => (ok ? '✓' : '○');
    return `Completed: Start ${m(reached('collect'))} | Normal Back ${m(reached('back1done'))} | Fresh Back ${m(reached('back2done'))} | Page Check ${m(reached('done'))}`;
  }
  function view() {
    const ph = S && !S.lost ? S.phase : null;
    const v = (step, title, lines, action, kind = 'normal') => ({ step, title, lines, action, kind });
    const aborted = (kind, why) => v(null, `TEST ABORTED — ${kind}`, [why || 'This run cannot produce evidence. Press START OVER.'], ['START OVER', CANONICAL, 'start'], 'invalid');
    if (S && S.lost) return aborted('RUN STATE LOST');
    if (!S) return v(0, 'Ready to start', ['One click opens the Rule34 listing and starts the test.'], ['START IB12-E2 TEST', CANONICAL, 'start']);
    if (ph === 'aborted') return aborted(S.abort || 'UNEXPECTED NAVIGATION');
    if (S.pub && S.pub.probeErrors && S.pub.probeErrors.length) return aborted('PROBE ERROR', 'The test recorded an internal error. This run cannot produce evidence. Press START OVER.');
    if (ph === 'starting') return v(1, 'STEP 1 OF 4 — LOAD TWO APPENDED PAGES', ['Opening the listing…'], null, 'recording');
    if (ph === 'collect') {
      const c = findC(); const n = S.pub.batches.filter((b) => b.inserted > 0).length;
      if (!S.priv.cId) return v(1, 'STEP 1 OF 4 — LOAD TWO APPENDED PAGES', [`Appended pages: ${Math.min(n, 2)} / 2`, 'Scroll down slowly.'], null);
      const vv = vis(c.wrap);
      if (!vv || vv.visibleFraction < 0.5) return v(1, 'STEP 1 OF 4 — LOAD TWO APPENDED PAGES', ['Appended pages: 2 / 2', 'C FOUND — scroll until the pink card is visible.'], null);
      return v(1, 'STEP 1 OF 4 — LOAD TWO APPENDED PAGES', ['Appended pages: 2 / 2', 'C is visible. Click the button below (not the card).'], ['OPEN C POST IN SAME TAB', S.priv.cHref, 'away1']);
    }
    if (ph === 'away1' && isView) return v(2, 'STEP 2 OF 4 — NORMAL BACK TEST', ['Press Chrome Back once'], null);
    if (ph === 'away2' && isView) return v(3, 'STEP 3 OF 4 — FRESH-LOAD BACK TEST', ['Press Chrome Back once'], null);
    if (ph === 'away1' || ph === 'away2') {
      const secs = returnT === null ? 0 : Math.max(0, Math.ceil((SNAP_MS[SNAP_MS.length - 1] - (now() - returnT)) / 1000));
      return v(ph === 'away1' ? 2 : 3, 'BACK DETECTED — RECORDING', ['Do not scroll or click.', `Recording… ${secs ? `(${secs} s)` : ''}`.trim()], null, 'recording');
    }
    if (ph === 'back1done') {
      const c = findC();
      if (c.wrap) { const vv = vis(c.wrap); if (!vv || vv.visibleFraction < 0.5) return v(3, 'STEP 3 OF 4 — FRESH-LOAD BACK TEST', ['NORMAL BACK RECORDED ✓', 'Scroll until the pink card is visible.'], null); }
      return v(3, 'STEP 3 OF 4 — FRESH-LOAD BACK TEST', ['NORMAL BACK RECORDED ✓', 'Click the button below (not the card).'], ['OPEN C POST IN SAME TAB', S.priv.cHref, 'away2']);
    }
    if (ph === 'back2done') {
      const fresh = !!(S.pub.back2 && S.pub.back2.freshLoadConfirmed);
      return v(4, 'STEP 4 OF 4 — CHECK OBSERVED NATIVE PAGE', [fresh ? 'FRESH BACK CONFIRMED ✓' : 'FRESH-LOAD BACK RECORDED ✓ — Chrome used BFCache; fresh Back was not achieved. This is a valid recorded outcome.', 'Click the button below.'], ['OPEN OBSERVED PAGE', S.priv.cBatchUrl, 'pagecheck']);
    }
    if (ph === 'pagecheck') return v(4, 'STEP 4 OF 4 — CHECK OBSERVED NATIVE PAGE', ['Checking…'], null, 'recording');
    if (ph === 'done') return v(4, 'TEST COMPLETE — 4 OF 4 ✓', ['Use Download results in the result box.'], null, 'complete');
    return aborted('RUN STATE LOST');
  }
  function render() {
    try {
      if (!SITE) return;
      if (isList && S && !S.lost && S.priv) updateMarker(findC().wrap);
      const v = view(); v.progress = progress(); const key = JSON.stringify(v);
      if (key === lastView && panel) return;
      lastView = key;
      if (!panel) {
        panel = document.createElement('div'); panel.id = 'ib12e2-panel';
        panel.style.cssText = 'position:fixed;left:12px;bottom:12px;width:400px;z-index:2147483646;background:#111;color:#fff;padding:12px 14px;border:3px solid #ff2d95;border-radius:8px;font:15px/1.4 sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.6)';
        document.body.appendChild(panel);
      }
      panel.textContent = '';
      const head = document.createElement('div'); head.dataset.ib12e2Head = '1';
      head.textContent = `IB12-E2 TEST — ${v.step === null ? 'ABORTED' : `STEP ${v.step} OF 4`}`;
      head.style.cssText = 'font:bold 13px/1.2 sans-serif;color:#ff8ac6;letter-spacing:.04em;margin-bottom:4px';
      const prog = document.createElement('div'); prog.dataset.ib12e2Progress = '1'; prog.textContent = v.progress;
      prog.style.cssText = 'font:12px/1.3 sans-serif;color:#ccc;margin-bottom:8px';
      const title = document.createElement('div'); title.dataset.ib12e2Title = '1'; title.textContent = v.title;
      title.style.cssText = `font:bold 18px/1.25 sans-serif;margin-bottom:6px;color:${v.kind === 'invalid' ? '#ff6b6b' : v.kind === 'recording' ? '#ffd166' : v.kind === 'complete' ? '#7ee787' : '#fff'}`;
      panel.append(head, prog, title);
      for (const line of v.lines) { const d = document.createElement('div'); d.dataset.ib12e2Line = '1'; d.textContent = line; panel.appendChild(d); }
      if (v.action) {
        const [text, href, act] = v.action;
        panel.appendChild(bigLink(text, href, () => {
          if (act === 'start') startRun();
          else if (act === 'away1') leave('away1');
          else if (act === 'away2') { armFresh(); leave('away2'); }
          else { S.phase = 'pagecheck'; save(S); }
        }));
      }
      if (v.kind === 'normal' && S && !S.lost && v.step) {
        const em = document.createElement('div'); em.style.cssText = 'margin-top:14px;padding-top:8px;border-top:1px solid #444;font-size:11px;color:#999';
        const b = document.createElement('a'); b.textContent = 'Emergency: Reset test (clears this run)'; b.href = CANONICAL; b.dataset.ib12e2Reset = '1';
        b.style.cssText = 'font-size:11px;color:#999';
        b.addEventListener('click', () => clearRun());
        em.appendChild(b); panel.appendChild(em);
      }
      if (v.kind === 'complete') {
        const b = document.createElement('button'); b.textContent = 'Show results'; b.dataset.ib12e2Show = '1';
        b.style.cssText = 'margin-top:8px'; b.addEventListener('click', () => { if (!document.getElementById('ib12e2-result')) finish(); });
        panel.appendChild(b);
      }
    } catch (e) { err('render', e); }
  }
  let lastView = null;
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

  // ---- start (IB12-E2R2): never silent; every route is checked against the phase ----
  try {
    if (S && !S.lost && SITE) {
      const ph = S.phase; const viewId = isView ? new URL(location.href).searchParams.get('id') : null;
      if (ph === 'starting') {
        if (canonicalHere()) {
          const list = cards();
          S.pub.start = { pid: here.pid, hasTags: !!here.tags, cardCount: list.length, scrollY: r1(window.scrollY) };
          S.priv.start = { page: here.page, s: here.s, tags: here.tags }; S.priv.knownCount = list.length;
          S.phase = 'collect'; save(S);
        } else abort('UNEXPECTED NAVIGATION');
      } else if (ph === 'collect' || ph === 'back1done' || ph === 'back2done') { if (!canonicalHere()) abort('UNEXPECTED NAVIGATION'); }
      else if (ph === 'away1' || ph === 'away2') { if (!(isView && viewId === S.priv.cId) && !canonicalHere()) abort('UNEXPECTED NAVIGATION'); }
      else if (ph === 'pagecheck') {
        const want = params(S.priv.cBatchUrl);
        if (isList && want.page === here.page && want.s === here.s && want.pid === here.pid && want.tags === here.tags) { pageCheck(); finish(); }
        else abort('UNEXPECTED NAVIGATION');
      }
    }
    const tick = () => render();
    if (document.body) tick(); else window.addEventListener('DOMContentLoaded', tick, { once: true });
    setInterval(tick, 500);
  } catch (e) { err('start', e); }
})();
