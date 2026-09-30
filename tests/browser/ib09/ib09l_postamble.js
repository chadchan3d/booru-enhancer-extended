/* IB09L DWELL LIVE CHECK POSTAMBLE — test code, not production.
 * The body above is production (commit 91fa86d) with the qualified 200 ms dwell
 * prototype and observe-only IB09L_HOOK calls. This observer records the
 * operator's REAL pointer hovers (it generates no events) in bounded sessions.
 * Per hover generation, in memory only:
 *   enter/leave times, entry rendition (PREVIEW/SAMPLE/FILE/UNKNOWN),
 *   every hover media assignment (from the hooks, so timing does not depend
 *   on cache state), dwell firing, upgrade start and install (displayable)
 *   times, cancellation, stale-blocked and stale-installed events, and moves
 *   to another card. Also Resource Timing for cost only: NETWORK / CACHE /
 *   REVALIDATED / SIZE_UNAVAILABLE / NO_ENTRY. NO_ENTRY is never read as zero
 *   cost, and unknown cache state is never called cold.
 * Output: per-session aggregates (counts, class tallies, times rounded to 10 ms
 * as n/min/median/max). No URLs, IDs or per-card values; a leak guard withholds
 * anything else. No request, storage or cookie access of its own. */
(() => {
  'use strict';

  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const DWELL_MS = __DWELL_MS__;
  const WRAP_FN_HEAD = 'function () {\n';
  const MAX_GENERATIONS = 80; // per session (bounded)
  const MAX_SESSIONS = 6;     // per page load
  const RT_WAIT_MS = 1500;
  const BE = window.BE;
  const SITES = ['e621.net', 'e926.net'];
  const SITE = SITES.includes(location.hostname) ? SITES[SITES.indexOf(location.hostname)] : null;
  const now = () => performance.now();
  const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let session = null; const sessions = [];
  let gen = null; // current generation record
  const elKind = new WeakMap(); // media element -> { gen, kind }

  function slotOf(url, card) {
    if (!url || !card) return 'UNKNOWN';
    const a = abs(url);
    const labels = [];
    for (const [label, attr] of [['PREVIEW', 'data-preview-url'], ['PREVIEW', 'data-preview-webp'], ['SAMPLE', 'data-sample-url'], ['FILE', 'data-file-url']]) if (a && a === abs(card.getAttribute(attr)) && !labels.includes(label)) labels.push(label);
    return labels.length ? labels.join('|') : 'UNKNOWN';
  }

  // Card media class from the native file extension (IB09 still-image rule applies to STILL only;
  // VIDEO is IB10 scope and ANIMATED needs its own eligibility; both are reported separately).
  function mediaClassOf(card) {
    const ext = String(card?.getAttribute('data-file-ext') || '').toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'STILL';
    if (['webm', 'mp4', 'mov'].includes(ext)) return 'VIDEO';
    if (['gif', 'apng'].includes(ext)) return 'ANIMATED';
    return 'UNKNOWN';
  }

  // ---- hooks from the instrumented body (observe only) ----
  IB09L_HOOK = function hook(ev, d) {
    if (!session || !gen) return;
    const t = now();
    if (ev === 'assign') {
      const slot = slotOf(d.url, gen.card);
      const rec = { t, kind: d.kind, slot, token: d.token, url: d.url };
      if (d.kind === 'thumb' && gen.token === null) gen.token = d.token;
      gen.assigns.push(rec);
      if (d.el) elKind.set(d.el, { g: gen, rec });
    } else if (ev === 'install') {
      const k = d.el && elKind.get(d.el);
      if (k) {
        k.rec.installT = t;
        if (k.g !== gen || gen.leaveT !== null) session.staleInstalled++;
      }
    } else if (ev === 'installBlocked' || ev === 'staleBlocked') session.staleBlocked++;
    else if (ev === 'dwell') { if (d.current) gen.dwellT = t; }
    else if (ev === 'cancel') { const k = d.el && elKind.get(d.el); if (k) k.rec.cancelledT = t; }
  };

  // ---- generation tracking via the gallery's property calls ----
  const hover = BE?.modules?.hover;
  if (hover) {
    const showOrig = hover.show; const hideOrig = hover.hide;
    hover.show = function observedShow(img, ...rest) {
      if (session && session.generations.length < MAX_GENERATIONS) {
        const card = img?.closest?.('article') || null;
        const prev = session.generations[session.generations.length - 1];
        gen = { card, enterT: now(), leaveT: null, token: null, dwellT: null, assigns: [],
          entrySlot: slotOf(img?.currentSrc || img?.getAttribute?.('src') || '', card),
          media: mediaClassOf(card), usableSample: !!(card && String(card.getAttribute('data-sample-url') || '').trim()),
          cardImageLoadingAtEnter: !!img && img.complete === false,
          fromOtherCard: !!prev && prev.card !== card && prev.leaveT !== null && now() - prev.leaveT < 1000,
          reentrySameCard: !!prev && prev.card === card };
        session.generations.push(gen);
      } else { gen = null; if (session) session.dropped++; }
      return showOrig.call(this, img, ...rest);
    };
    hover.hide = function observedHide(...a) { if (gen && gen.leaveT === null) gen.leaveT = now(); return hideOrig.apply(this, a); };
  }

  // ---- analysis ----
  const r10 = (x) => Math.round(x / 10) * 10;
  const dist = (xs) => { const v = xs.filter(Number.isFinite).map(r10).sort((a, b) => a - b); return v.length ? { n: v.length, min: v[0], median: v[Math.floor((v.length - 1) / 2)], max: v[v.length - 1] } : 'NONE'; };
  function costClass(url, since) {
    const es = (performance.getEntriesByName(url, 'resource') || []).filter((e) => e.startTime >= since - 1);
    if (!es.length) return { cls: 'NO_ENTRY' };
    const e = es[0];
    const sized = e.transferSize > 0 || e.encodedBodySize > 0 || e.decodedBodySize > 0;
    if (!sized) return { cls: e.deliveryType === 'cache' ? 'CACHE' : 'SIZE_UNAVAILABLE' };
    if (e.transferSize === 0) return { cls: 'CACHE' };
    if (e.encodedBodySize > 0 && e.transferSize < e.encodedBodySize && e.transferSize < 2048) return { cls: 'REVALIDATED' };
    return { cls: 'NETWORK', kib: Math.round(e.transferSize / 1024) };
  }
  const rtFrom = (url, t0) => (performance.getEntriesByName(abs(url), 'resource') || []).filter((e) => e.startTime >= t0 - 1);
  function attributeEntries(x) {
    const out = { UPGRADE: 0, REUSE: 0, DISPLAY_STILL_LOADING: 0, OTHER: 0 };
    if (!x.card) return out;
    const end = x.enterT + DWELL_MS;
    for (const attr of ['data-sample-url', 'data-file-url']) {
      const u = abs(x.card.getAttribute(attr));
      if (!u) continue;
      for (const e of performance.getEntriesByName(u, 'resource') || []) {
        if (e.startTime < x.enterT || e.startTime >= end) continue; // in flight before hover, or after dwell
        const mine = x.assigns.filter((a) => a.url && abs(a.url) === u && e.startTime >= a.t - 1 && a.t < end);
        if (mine.some((a) => a.kind !== 'thumb')) out.UPGRADE++;
        else if (mine.some((a) => a.kind === 'thumb') && !x.cardImageLoadingAtEnter) out.REUSE++;
        else if (x.cardImageLoadingAtEnter) out.DISPLAY_STILL_LOADING++;
        else out.OTHER++;
      }
    }
    return out;
  }
  function analyze(s) {
    const g = s.generations;
    const tally = (xs) => xs.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});
    const up = (x) => x.assigns.filter((a) => a.kind !== 'thumb');
    const firstUp = (x) => up(x)[0] || null;
    const stay = (x) => (x.leaveT === null ? null : x.leaveT - x.enterT);
    // Revision 1.2: the still-image rule is evaluated over STILL cards only.
    const eligible = g.filter((x) => x.media === 'STILL' && x.entrySlot === 'PREVIEW' && x.dwellT !== null);
    const started = eligible.filter((x) => firstUp(x));
    const costs = started.map((x) => costClass(firstUp(x).url, firstUp(x).t));
    return {
      condition: s.condition, quality: s.quality, generations: g.length, droppedBeyondCap: s.dropped,
      entryRendition: tally(g.map((x) => x.entrySlot)),
      stayMs: dist(g.map(stay)),
      quickPassesUnderDwell: g.filter((x) => stay(x) !== null && stay(x) < DWELL_MS).length,
      dwellReached: g.filter((x) => x.dwellT !== null).length,
      thumbNotDisplayedRendition: g.filter((x) => x.assigns.some((a) => a.kind === 'thumb' && a.slot !== x.entrySlot)).length,
      newMediaBeforeDwell: g.filter((x) => up(x).some((a) => a.t - x.enterT < DWELL_MS)).length,
      // Revision 1.3: every Resource Timing entry for this card's SAMPLE/FILE that starts inside
      // [enter, enter + dwell) is attributed exactly once (see attributeEntries):
      //   UPGRADE - its URL was assigned by the hover code as an upgrade in this generation and the
      //             entry started at/after that assignment (the only class that violates the rule);
      //   REUSE   - the V3 overlay reused the displayed rendition, the card image was already loaded
      //             at enter, and the entry started at/after that assignment (V3 cost observation);
      //   DISPLAY_STILL_LOADING - the card's own displayed image was still loading at enter (grid load);
      //   OTHER   - native / lazy / revalidation / unrelated to any hover assignment.
      hoverLoadsBeforeDwell: g.filter((x) => attributeEntries(x).UPGRADE > 0).length,
      renditionReuseFetchesBeforeDwell: g.filter((x) => attributeEntries(x).REUSE > 0).length,
      cardDisplayLoadsDuringHover: g.filter((x) => attributeEntries(x).DISPLAY_STILL_LOADING > 0).length,
      unattributedCardMediaLoadsDuringHover: g.filter((x) => attributeEntries(x).OTHER > 0).length,
      cardImageLoadingAtEnter: g.filter((x) => x.cardImageLoadingAtEnter).length,
      quickPassesStartingUpgrade: g.filter((x) => stay(x) !== null && stay(x) < DWELL_MS && up(x).length > 0).length,
      previewUpgrades: {
        eligibleGenerations: eligible.length,
        started: started.length,
        exactlyOnePerGeneration: eligible.every((x) => up(x).length <= 1),
        startOffsetMs: dist(started.map((x) => firstUp(x).t - x.enterT)),
        startedBeforeDwell: started.filter((x) => firstUp(x).t - x.enterT < DWELL_MS).length,
        targetSlots: tally(started.map((x) => firstUp(x).slot)),
        upgradeKinds: tally(started.map((x) => firstUp(x).kind)),
        nativeSampleTargets: started.filter((x) => firstUp(x).slot === 'SAMPLE').length,
        sampleFileAliasTargets: started.filter((x) => firstUp(x).slot === 'SAMPLE|FILE').length,
        pureFileTargets: started.filter((x) => firstUp(x).slot === 'FILE').length,
        otherTargets: started.filter((x) => !['SAMPLE', 'SAMPLE|FILE', 'FILE'].includes(firstUp(x).slot)).length,
        eligibleWithoutUsableSample: eligible.filter((x) => !x.usableSample).length,
        startedWithoutUsableSample: started.filter((x) => !x.usableSample).length,
        displayableAfterDwellMs: dist(started.filter((x) => firstUp(x).installT).map((x) => firstUp(x).installT - (x.enterT + DWELL_MS))),
        displayed: started.filter((x) => firstUp(x).installT).length,
        leftBeforeDisplayable: started.filter((x) => !firstUp(x).installT && x.leaveT !== null).length,
        costClasses: tally(costs.map((c) => c.cls)),
        networkTransferKiB: (() => { const v = costs.filter((c) => c.kib !== undefined).map((c) => c.kib).sort((a, b) => a - b); return v.length ? { n: v.length, min: v[0], median: v[Math.floor((v.length - 1) / 2)], max: v[v.length - 1] } : 'NONE'; })(),
      },
      mediaClasses: tally(g.map((x) => x.media)),
      otherMediaClasses: Object.fromEntries(['VIDEO', 'ANIMATED', 'UNKNOWN'].map((m) => { const xs = g.filter((x) => x.media === m); return [m, { generations: xs.length, dwellReached: xs.filter((x) => x.dwellT !== null).length,
        upgradesStarted: xs.filter((x) => firstUp(x)).length, upgradeKinds: tally(xs.filter((x) => firstUp(x)).map((x) => firstUp(x).kind)), targetSlots: tally(xs.filter((x) => firstUp(x)).map((x) => firstUp(x).slot)),
        startedBeforeDwell: xs.filter((x) => firstUp(x) && firstUp(x).t - x.enterT < DWELL_MS).length }]; })),
      upgradesOnSampleOrFileCards: g.filter((x) => (x.entrySlot === 'SAMPLE' || x.entrySlot === 'FILE') && up(x).length > 0).length,
      fileDowngradedToSample: g.filter((x) => x.entrySlot === 'FILE' && up(x).some((a) => a.slot.includes('SAMPLE'))).length,
      staleBlocked: s.staleBlocked, staleInstalled: s.staleInstalled,
      movedFromAnotherCard: g.filter((x) => x.fromOtherCard).length,
      reentrySameCard: g.filter((x) => x.reentrySameCard).length,
      usefulness: s.usefulness,
    };
  }

  async function sourceIdentity() {
    if (typeof IB07P_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB07P_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }
  function guard(text) {
    const raw = new Set();
    for (const a of document.querySelectorAll('article')) for (const k of ['data-id', 'data-md5', 'data-preview-url', 'data-preview-webp', 'data-sample-url', 'data-file-url']) { const v = a.getAttribute(k); if (v && v.length >= 3) { raw.add(v); raw.add(abs(v)); } }
    for (const s of sessions) for (const x of s.generations) for (const a of x.assigns) if (a.url) raw.add(a.url);
    const leaked = [...raw].some((v) => text.includes(v)) || /https?:\/\//i.test(text);
    return leaked ? JSON.stringify({ probe: 'ib09l-dwell-live-check', site: SITE, sanitationGuard: 'BLOCKED' }, null, 2) : text;
  }
  function show(text) {
    document.querySelector('#ib09l-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib09l-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta = document.createElement('textarea'); ta.value = text; ta.readOnly = true; ta.style.cssText = 'width:100%;height:75vh;background:#000;color:#eee';
    const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => root.remove();
    root.append(ta, close); document.body.appendChild(root); ta.focus(); ta.select();
  }
  // Revision 1.1 (operator report): every message other than Show results is a small,
  // transient, click-through toast in the bottom-left corner. It is never focusable, never
  // over the gallery's pointer path, and removed automatically. The full result box
  // (show) appears only for "IB09L: Show results", after the session has ended.
  let toastTimer = null;
  function toast(message, ms = 2500) {
    document.querySelector('#ib09l-toast')?.remove();
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.id = 'ib09l-toast';
    el.textContent = message;
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:280px;z-index:2147483647;pointer-events:none;background:rgba(17,17,17,.85);color:#eee;padding:4px 8px;border-radius:4px;font:12px/1.3 sans-serif';
    document.body.appendChild(el);
    toastTimer = setTimeout(() => el.remove(), ms);
  }

  function start(condition) {
    if (!SITE || !/^\/posts\/?$/.test(location.pathname)) return toast('IB09L: open a logged-out e621/e926 /posts listing', 5000);
    if (document.body?.getAttribute('data-user-is-anonymous') !== 'true') return toast('IB09L: must be logged out', 5000);
    if (!hover) return toast('IB09L: hover module not available', 5000);
    if (sessions.length >= MAX_SESSIONS) return toast('IB09L: session limit reached; reload the page', 5000);
    document.querySelector('#ib09l-result')?.remove(); // never leave an earlier result box over the gallery
    session = { condition, quality: BE.settings.get('media.thumbQuality'), generations: [], dropped: 0, staleBlocked: 0, staleInstalled: 0, usefulness: { useful: 0, late: 0, tooLate: 0 } };
    sessions.push(session); gen = null;
    toast(`IB09L recording (${condition.toLowerCase()}, ${session.quality})`);
  }
  function mark(kind) {
    if (!session) return toast('IB09L: no active session');
    const last = [...session.generations].reverse().find((x) => x.entrySlot === 'PREVIEW' && x.assigns.some((a) => a.kind !== 'thumb'));
    if (last && !last.marked) { last.marked = true; session.usefulness[kind]++; toast(`IB09L: marked ${kind}`, 1500); }
    else toast('IB09L: no unmarked upgrade to mark', 1500);
  }
  async function results() {
    session = null; gen = null; // recording ends before any result UI appears
    document.querySelector('#ib09l-toast')?.remove();
    await sleep(RT_WAIT_MS);
    const identity = await sourceIdentity();
    const out = { probe: 'ib09l-dwell-live-check', version: '1.3.0', site: SITE, dwellMs: DWELL_MS, production_body_identity: identity, sessions: sessions.map(analyze),
      notes: 'Timing comes from hooks in the running code (cache-independent). Cost classes come from Resource Timing: NO_ENTRY is not zero cost, and unknown cache state is not cold.' };
    show(guard(JSON.stringify(out, null, 2)));
    return out;
  }

  const reg = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : null;
  if (reg) {
    reg('IB09L: Start session — ordinary network', () => start('ORDINARY'));
    reg('IB09L: Start session — throttled network', () => start('THROTTLED'));
    reg('IB09L: Mark last upgrade — useful', () => mark('useful'));
    reg('IB09L: Mark last upgrade — noticeable but late', () => mark('late'));
    reg('IB09L: Mark last upgrade — too late to matter', () => mark('tooLate'));
    reg('IB09L: Show results (ends the session)', () => results());
  }
})();
