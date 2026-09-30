// ==UserScript==
// @name         IB09 V2 Hover Cost Pilot Probe
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib09-v2-hover-cost
// @version      1.0.0
// @description  Read-only, bounded, sanitized measurement of real browser resource cost for native e621/e926 card renditions (IB09 G-HOVER V2 pilot).
// @author       ChadChan3D
// @license      MIT
// @match        *://e621.net/*
// @match        *://e926.net/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* IB09 V2 hover-cost pilot probe. Evidence only; this is not production and
 * not a hover implementation.
 *
 * What it does, on a logged-out e621/e926 /posts listing with the normal
 * enhancer disabled:
 *   - selects a bounded set of IB08-pattern still-image cards;
 *   - loads their native PREVIEW / SAMPLE / FILE renditions into DETACHED
 *     Image objects (never inserted into the page) and reads the browser's
 *     own Resource Timing entries for those exact URLs;
 *   - REUSE: assigns an already-loaded URL to a new Image (the t=0 overlay
 *     path) and records whether any new fetch occurred;
 *   - ABORT: starts a cold SAMPLE load, sets src = 'data:,' after 40 ms (the
 *     production cancel mechanism), then reloads the same URL to learn
 *     whether the cancelled fetch still reached the cache; an uncancelled
 *     CONTROL arm on other cards gives the time scale.
 * It changes nothing in the page apart from its own result box; it makes no
 * request other than those image loads; no storage, cookies or account data.
 * Output: per-slot aggregates only (counts, class tallies, sizes in KiB and
 * durations rounded to 10 ms, as min/median/max), never URLs, IDs or
 * per-card values. A leak guard withholds any output carrying a raw value. */
(() => {
  'use strict';

  const SITES = ['e621.net', 'e926.net'];
  const SITE = SITES.includes(location.hostname) ? SITES[SITES.indexOf(location.hostname)] : null;
  const PER_ARM = 4;             // cards per arm (bounded)
  const MAX_CARDS = PER_ARM * 4; // reuse-preview, cold/reuse, abort, control - all distinct
  const SWEEP_MS = 40;
  const LOAD_TIMEOUT_MS = 20000;
  const ENTRY_WAIT_MS = 1500;
  const ABORT_OBSERVE_MS = 4000;
  const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };

  // ---- card selection (IB08 pattern, logged out) -------------------------------------
  function patternCard(a) {
    const d = (n) => a.getAttribute(n);
    if (!d('data-id') || !IMAGE_EXT.has(String(d('data-file-ext') || '').toLowerCase())) return null;
    const img = a.querySelector('picture > img');
    const pic = img && img.parentElement;
    if (!pic || pic.children.length !== 3 || pic.children[2] !== img) return null;
    const [s1, s2] = pic.children;
    if (s1.localName !== 'source' || s2.localName !== 'source' || s1.getAttribute('type') !== 'image/webp' || s2.getAttribute('type') !== 'image/jpeg') return null;
    const preview = abs(d('data-preview-webp')); const sample = abs(d('data-sample-url')); const file = abs(d('data-file-url'));
    if (!preview || !sample || !file || sample === file || sample === preview) return null;
    return { article: a, img, slots: { PREVIEW: preview, SAMPLE: sample, FILE: file } };
  }

  // ---- measurement helpers ----------------------------------------------------------
  function load(url, { cancelAfter = null } = {}) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      const img = new Image();
      let done = false;
      const finish = (state) => { if (done) return; done = true; resolve({ url, state, t0, t1: performance.now() }); };
      img.onload = () => finish('LOADED');
      img.onerror = () => finish('ERROR');
      img.decoding = 'async';
      img.src = url;
      if (cancelAfter !== null) setTimeout(() => { if (!done) { img.onload = null; img.onerror = null; img.src = 'data:,'; finish('CANCELLED'); } }, cancelAfter);
      setTimeout(() => finish('TIMEOUT'), LOAD_TIMEOUT_MS);
    });
  }
  const entriesFor = (url, since) => (performance.getEntriesByName(url, 'resource') || []).filter((e) => e.startTime >= since - 1);

  // Classify one observation. Size fields of 0 on every counter are "not exposed" (cross-origin
  // without Timing-Allow-Origin), never zero bytes; no entry at all after a successful load means
  // the browser served it without a Resource Timing fetch (typically its in-memory image cache).
  function classify(res, entries) {
    if (res.state === 'ERROR' || res.state === 'TIMEOUT') return { cls: 'FAILED' };
    if (res.state === 'CANCELLED') return { cls: 'CANCELLED' };
    if (!entries.length) return { cls: 'NO_ENTRY' };
    const e = entries[entries.length - 1];
    const sized = e.transferSize > 0 || e.encodedBodySize > 0 || e.decodedBodySize > 0;
    const delivery = typeof e.deliveryType === 'string' ? e.deliveryType : null;
    let cls;
    if (!sized) cls = delivery === 'cache' ? 'CACHE' : 'SIZE_UNAVAILABLE';
    else if (e.transferSize === 0) cls = 'CACHE';
    else if (e.encodedBodySize > 0 && e.transferSize < e.encodedBodySize && e.transferSize < 2048) cls = 'REVALIDATED';
    else cls = 'NETWORK';
    return { cls, sized, transfer: sized ? e.transferSize : null, encoded: sized ? e.encodedBodySize : null, decoded: sized ? e.decodedBodySize : null, duration: e.duration };
  }

  const kib = (b) => Math.round(b / 1024);
  const r10 = (ms) => Math.round(ms / 10) * 10;
  function dist(values) {
    const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return 'UNAVAILABLE';
    return { n: v.length, min: v[0], median: v[Math.floor((v.length - 1) / 2)], max: v[v.length - 1] };
  }
  function summarize(obs) {
    const classes = {};
    for (const o of obs) classes[o.cls] = (classes[o.cls] || 0) + 1;
    const sized = obs.filter((o) => o.sized);
    return {
      observations: obs.length, classes,
      transferKiB: dist(sized.map((o) => kib(o.transfer))),
      encodedKiB: dist(sized.map((o) => kib(o.encoded))),
      decodedKiB: dist(sized.map((o) => kib(o.decoded))),
      sizeUnavailable: obs.filter((o) => ['NETWORK', 'CACHE', 'REVALIDATED', 'SIZE_UNAVAILABLE'].includes(o.cls) && !o.sized).length,
      loadMs: dist(obs.filter((o) => o.loadMs !== null).map((o) => r10(o.loadMs))),
    };
  }
  async function measure(url, opts) {
    const res = await load(url, opts);
    await sleep(ENTRY_WAIT_MS);
    const c = classify(res, entriesFor(url, res.t0));
    return { ...c, state: res.state, loadMs: res.state === 'LOADED' ? res.t1 - res.t0 : null };
  }

  // ---- leak guard -----------------------------------------------------------------------
  function guard(text, cards) {
    const raw = new Set();
    for (const a of document.querySelectorAll('article')) for (const k of ['data-id', 'data-md5', 'data-preview-url', 'data-preview-webp', 'data-sample-url', 'data-file-url']) { const v = a.getAttribute(k); if (v && v.length >= 3) { raw.add(v); raw.add(abs(v)); } }
    for (const c of cards) for (const u of Object.values(c.slots)) raw.add(u);
    const leaked = [...raw].some((v) => text.includes(v)) || /https?:\/\//i.test(text);
    return leaked ? JSON.stringify({ probe: 'ib09-v2-hover-cost', site: SITE, sanitationGuard: 'BLOCKED' }, null, 2) : text;
  }
  function show(text) {
    document.querySelector('#ib09-v2-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib09-v2-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta = document.createElement('textarea');
    ta.value = text; ta.readOnly = true;
    ta.style.cssText = 'width:100%;height:75vh;background:#000;color:#eee';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.onclick = () => root.remove();
    root.append(ta, close);
    document.body.appendChild(root);
    ta.focus(); ta.select();
  }
  const err = (message, extra = {}) => show(JSON.stringify({ probe: 'ib09-v2-hover-cost', site: SITE, error: message, ...extra }, null, 2));

  let running = false;
  async function run() {
    if (!SITE) return err('unsupported host');
    if (running) return;
    if (!/^\/posts\/?$/.test(location.pathname)) return err('open the /posts listing first');
    if (document.body?.getAttribute('data-user-is-anonymous') !== 'true') return err('must be logged out (data-user-is-anonymous is not "true")');
    if (document.querySelector('.be-gallery-grid, .be-thumb-wrap, #be-hover-preview, #be-root')) return err('the normal enhancer is active on this page; disable it and reload');
    if (typeof performance?.getEntriesByName !== 'function') return err('Resource Timing is not available in this browser');
    running = true;
    show(JSON.stringify({ probe: 'ib09-v2-hover-cost', site: SITE, status: 'running (about a minute); do not scroll or close the tab' }, null, 2));
    try { performance.setResourceTimingBufferSize?.(2000); } catch { /* optional */ }
    const cards = [...document.querySelectorAll('article')].map(patternCard).filter(Boolean).slice(0, MAX_CARDS);
    if (cards.length < MAX_CARDS) { running = false; return err('INSUFFICIENT pattern cards', { patternCards: cards.length, needed: MAX_CARDS }); }
    const arm = (i) => cards.slice(i * PER_ARM, (i + 1) * PER_ARM);
    const [reuseArm, coldArm, abortArm, controlArm] = [arm(0), arm(1), arm(2), arm(3)];

    // Capability: does the page's own native preview load expose sizes?
    const nativePreviewEntries = cards.map((c) => (performance.getEntriesByName(c.slots.PREVIEW, 'resource') || [])[0]).filter(Boolean);
    const capability = {
      resourceTiming: true,
      nativePreviewEntriesFound: nativePreviewEntries.length,
      nativePreviewSizesExposed: nativePreviewEntries.filter((e) => e.transferSize > 0 || e.encodedBodySize > 0).length,
      deliveryTypeField: nativePreviewEntries.some((e) => typeof e.deliveryType === 'string'),
    };

    // A. Current displayed rendition reused in a new Image (the t=0 overlay path): PREVIEW as displayed natively.
    const reusePreview = [];
    for (const c of reuseArm) reusePreview.push(await measure(c.img.currentSrc || c.slots.PREVIEW));
    // B. Cold SAMPLE and FILE loads, then reuse of each (a displayed rendition reused).
    const cold = { SAMPLE: [], FILE: [] }; const reuse = { SAMPLE: [], FILE: [] };
    for (const c of coldArm) for (const slot of ['SAMPLE', 'FILE']) {
      cold[slot].push(await measure(c.slots[slot]));
      reuse[slot].push(await measure(c.slots[slot]));
    }
    // C. Abort arm: cold SAMPLE cancelled at the sweep interval, then a follow-up load of the same URL.
    const abortObs = [];
    for (const c of abortArm) {
      const res = await load(c.slots.SAMPLE, { cancelAfter: SWEEP_MS });
      await sleep(ABORT_OBSERVE_MS);
      const after = entriesFor(c.slots.SAMPLE, res.t0);
      const followRes = await load(c.slots.SAMPLE);
      await sleep(ENTRY_WAIT_MS);
      const follow = classify(followRes, entriesFor(c.slots.SAMPLE, followRes.t0));
      let outcome;
      if (res.state === 'LOADED') outcome = 'COMPLETED_BEFORE_CANCEL';
      else if (follow.cls === 'FAILED') outcome = 'NOT_MEASURABLE';
      else if (follow.cls === 'NETWORK') outcome = 'CANCEL_PREVENTED_FULL_TRANSFER';
      else if (follow.cls === 'CACHE' || follow.cls === 'NO_ENTRY') outcome = 'CANCELLED_FETCH_STILL_REACHED_CACHE';
      else outcome = 'NOT_MEASURABLE';
      abortObs.push({ state: res.state, entryAfterCancel: after.length > 0, entryTransferSized: after.some((e) => e.transferSize > 0), followCls: follow.cls, outcome });
    }
    // D. Control arm: cold SAMPLE, not cancelled.
    const control = [];
    for (const c of controlArm) control.push(await measure(c.slots.SAMPLE));

    const tally = (xs, k) => xs.reduce((m, x) => { m[x[k]] = (m[x[k]] || 0) + 1; return m; }, {});
    const reuseVerdict = (obs) => {
      if (obs.some((o) => o.cls === 'NETWORK' || o.cls === 'REVALIDATED')) return 'TRANSFER_OBSERVED';
      if (obs.length && obs.every((o) => o.cls === 'NO_ENTRY' || o.cls === 'CACHE')) return 'NO_ADDITIONAL_TRANSFER_OBSERVED_IN_THIS_SAMPLE';
      return 'NOT_MEASURABLE';
    };
    const result = {
      probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE, route: 'posts-listing', loginState: 'LOGGED_OUT',
      evidenceGate: 'IB09 G-HOVER V2 pilot (cost only; no dwell decision)',
      sampling: { perArm: PER_ARM, arms: ['REUSE_PREVIEW', 'COLD_AND_REUSE_SAMPLE_FILE', 'ABORT_SAMPLE', 'CONTROL_SAMPLE'], distinctCards: cards.length, sweepMs: SWEEP_MS },
      capability,
      slots: {
        PREVIEW: { reuseOfDisplayed: summarize(reusePreview) },
        SAMPLE: { cold: summarize(cold.SAMPLE), reuseAfterLoad: summarize(reuse.SAMPLE), controlCold: summarize(control) },
        FILE: { cold: summarize(cold.FILE), reuseAfterLoad: summarize(reuse.FILE) },
      },
      abort: { observations: abortObs.length, startStates: tally(abortObs, 'state'), entryAfterCancel: abortObs.filter((o) => o.entryAfterCancel).length,
        entryAfterCancelWithTransferSize: abortObs.filter((o) => o.entryTransferSized).length, followUpClasses: tally(abortObs, 'followCls'), outcomes: tally(abortObs, 'outcome'),
        controlCompleted: control.filter((o) => o.state === 'LOADED').length },
      conclusions: {
        currentRenditionReuse: { PREVIEW: reuseVerdict(reusePreview), SAMPLE: reuseVerdict(reuse.SAMPLE), FILE: reuseVerdict(reuse.FILE) },
        freeClaim: 'NOT_CLAIMED: observations cover this sample, cache state and session only',
      },
      limits: 'Sizes are reported only where the browser exposes them; SIZE_UNAVAILABLE is never counted as zero. NO_ENTRY means loaded without a Resource Timing fetch (typically the in-memory image cache). Abort outcomes are inferred from a follow-up load of the same URL.',
    };
    running = false;
    show(guard(JSON.stringify(result, null, 2), cards));
  }

  GM_registerMenuCommand('IB09 V2: Run hover-cost pilot on this page', () => { run(); });
})();
