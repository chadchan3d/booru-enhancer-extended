// ==UserScript==
// @name         IB08 V9-R Reversible Rendition Ownership Experiment
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib08-v9r-ownership
// @version      1.0.0
// @description  Isolated IB08 E-stage experiment: one owned srcset mutation per card, simulated native changes, dispose, resize (G-RENDITION evidence).
// @author       ChadChan3D
// @license      MIT
// @match        *://e621.net/*
// @match        *://e926.net/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* IB08 V9-R ownership experiment — isolated E stage; not production code.
 * Scope: only cards matching the observed logged-out listing pattern
 * (picture > source[image/webp] + source[image/jpeg] + img; single-candidate
 * source srcsets; no sizes/media; img src only). Anything else stays untouched.
 * The experiment's "enhancer" side owns exactly one attribute per card (the
 * WebP source's srcset, set to the card's own native sample URL) and never
 * creates, clones, moves, replaces or removes nodes. A separate, clearly
 * marked section simulates the site ("native") changing the page after the
 * mutation. Output holds only ordinals, enums, booleans, counts and
 * dimensions; a leak guard withholds any output containing a raw value. */
(() => {
  'use strict';

  const SCENARIOS = ['CONTROL', 'NATIVE_EDIT', 'MOVED_SOURCE', 'REPLACED_SOURCE', 'REPLACED_PICTURE'];
  const SETTLE_MS = 2500;
  const LOAD_WAIT_MS = 8000;
  const MAX_SCAN = 400;
  const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const SITE = location.hostname === 'e621.net' || location.hostname === 'e926.net' ? location.hostname : null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };
  const SINGLE = /^[^\s,]+(?:\s+\d+(?:\.\d+)?[wx])?$/;
  const firstUrl = (srcset) => abs(String(srcset || '').trim().split(/\s+/)[0]);
  const attrsOf = (el) => [...el.attributes].map((a) => [a.name, a.value]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  const px = (n) => (Number.isFinite(n) ? Math.round(n) : null);

  let run = null; // in-memory only
  let lastResult = null;

  // ---- pattern gate: only the observed native pattern is supported -------------------
  function classify(article) {
    const d = (n) => article.getAttribute(n);
    if (!d('data-id')) return 'NO_ID';
    if (!IMAGE_EXT.has(String(d('data-file-ext') || '').toLowerCase())) return 'UNSUPPORTED_MEDIA';
    if (!d('data-sample-url') || !d('data-preview-webp') || !d('data-preview-url')) return 'MISSING_NATIVE_FACT';
    const imgs = article.querySelectorAll('img');
    if (imgs.length !== 1) return 'IMG_COUNT';
    const img = imgs[0];
    const picture = img.parentElement;
    if (!picture || picture.localName !== 'picture' || article.querySelectorAll('picture').length !== 1) return 'NO_PICTURE';
    const kids = [...picture.children];
    if (kids.length !== 3 || kids[0].localName !== 'source' || kids[1].localName !== 'source' || kids[2] !== img) return 'SOURCE_SHAPE';
    const [s1, s2] = kids;
    if (s1.getAttribute('type') !== 'image/webp' || s2.getAttribute('type') !== 'image/jpeg') return 'SOURCE_TYPES';
    for (const s of [s1, s2]) {
      if (s.hasAttribute('sizes') || s.hasAttribute('media')) return 'SOURCE_SIZES_OR_MEDIA';
      if (!SINGLE.test(String(s.getAttribute('srcset') || '').trim())) return 'SOURCE_SRCSET_NOT_SINGLE';
    }
    if (!img.hasAttribute('src') || img.hasAttribute('srcset') || img.hasAttribute('sizes')) return 'IMG_SHAPE';
    if (firstUrl(s1.getAttribute('srcset')) !== abs(d('data-preview-webp'))) return 'WEBP_SOURCE_NOT_NATIVE_PREVIEW';
    if (firstUrl(s2.getAttribute('srcset')) === firstUrl(s1.getAttribute('srcset'))) return 'SOURCES_NOT_DISTINCT';
    const sample = d('data-sample-url').trim();
    if (!/^[^\s,]+$/.test(sample)) return 'SAMPLE_NOT_SRCSET_SAFE';
    if (abs(sample) === firstUrl(s1.getAttribute('srcset')) || abs(sample) === firstUrl(s2.getAttribute('srcset'))) return 'SAMPLE_NOT_DISTINCT';
    return 'SUPPORTED';
  }

  // Rendition-relevant attribute signature (in memory only) for untouched-card checks.
  const renditionSig = (article) => [...article.querySelectorAll('picture, source, img')].map((el) =>
    el.localName + JSON.stringify(['src', 'srcset', 'sizes', 'media', 'type'].map((n) => el.getAttribute(n)))).join('|');

  // ---- ENHANCER-SIDE OWNER BEGIN (attribute ownership only; no node operations) ------
  function makeOwner() {
    const records = [];
    const mo = new MutationObserver((recs) => mark(recs));
    const mark = (recs) => { for (const r of recs) for (const rec of records) if (rec.node === r.target && rec.attr === r.attributeName) rec.nativeTouched = true; };
    return {
      ownAttribute(node, attr, value) {
        const rec = { node, attr, originalPresent: node.hasAttribute(attr), originalValue: node.getAttribute(attr), ownedValue: value, nativeTouched: false };
        records.push(rec);
        node.setAttribute(attr, value);
        mo.observe(node, { attributes: true, attributeFilter: [attr] }); // observed after our own write
        return rec;
      },
      dispose() {
        mark(mo.takeRecords());
        mo.disconnect();
        return records.map((rec) => {
          if (rec.nativeTouched) return 'SKIPPED_NATIVE_TOUCHED';
          if (!rec.node.isConnected) return 'SKIPPED_DISCONNECTED';
          if (rec.node.getAttribute(rec.attr) !== rec.ownedValue) return 'SKIPPED_VALUE_CHANGED';
          if (rec.originalPresent) rec.node.setAttribute(rec.attr, rec.originalValue);
          else rec.node.removeAttribute(rec.attr);
          return 'RESTORED';
        });
      },
    };
  }
  const applyRendition = (owner, c) => owner.ownAttribute(c.sources[0], 'srcset', c.ownedValue);
  // ---- ENHANCER-SIDE OWNER END ----------------------------------------------------------

  // ---- NATIVE-SIMULATION BEGIN (stands in for the site changing its own page) ----------
  const fresh = (tag, attrs) => { const el = document.createElement(tag); for (const [n, v] of attrs) el.setAttribute(n, v); return el; };
  const NATIVE = {
    NATIVE_EDIT: (c) => c.sources[0].setAttribute('srcset', c.s2Srcset),
    MOVED_SOURCE: (c) => c.sources[1].after(c.sources[0]),
    REPLACED_SOURCE: (c) => c.sources[0].replaceWith(fresh('source', c.base.sources[0])),
    REPLACED_PICTURE: (c) => {
      const p = fresh('picture', c.base.picture);
      c.base.sources.forEach((a) => p.append(fresh('source', a)));
      p.append(fresh('img', c.base.img));
      c.picture.replaceWith(p);
    },
  };
  // ---- NATIVE-SIMULATION END --------------------------------------------------------------

  function relation(url, c) {
    if (!url) return 'UNKNOWN';
    const labels = [['NATIVE_PREVIEW_WEBP', c.facts.webp], ['NATIVE_PREVIEW', c.facts.preview], ['NATIVE_SAMPLE', c.facts.sample], ['NATIVE_FILE', c.facts.file],
      ['SOURCE_1_SRCSET', firstUrl(c.origS1Srcset)], ['SOURCE_2_SRCSET', firstUrl(c.s2Srcset)], ['IMG_SRC', c.facts.imgSrc]];
    for (const [label, v] of labels) if (v && v === url) return label;
    let same = false; try { same = new URL(url).origin === location.origin; } catch { /* stays false */ }
    return same ? 'OTHER_SAME_ORIGIN' : 'UNKNOWN';
  }

  function observe(c) {
    const img = c.article.querySelector('img');
    const picture = img ? img.closest('picture') : null;
    const sources = picture ? [...picture.querySelectorAll('source')] : [];
    const s1 = c.sources[0];
    const v = s1.getAttribute('srcset');
    const s1SrcsetState = !s1.hasAttribute('srcset') ? 'ABSENT' : v === c.origS1Srcset ? 'ORIGINAL' : v === c.ownedValue ? 'ENHANCER_VALUE' : v === c.s2Srcset ? 'NATIVE_EDIT_VALUE' : 'OTHER';
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const newNodes = [];
    if (picture && picture !== c.picture) newNodes.push(same(attrsOf(picture), c.base.picture));
    if (img && img !== c.img) newNodes.push(same(attrsOf(img), c.base.img));
    sources.forEach((s, i) => { if (!c.sources.includes(s)) newNodes.push(same(attrsOf(s), c.base.sources[i] || [])); });
    const rect = img ? img.getBoundingClientRect() : null;
    return {
      sameCardNode: c.article.isConnected,
      sameImgNode: img === c.img,
      samePictureNode: picture === c.picture,
      sourceOrder: sources.map((s) => (s === c.sources[0] ? 'S1' : s === c.sources[1] ? 'S2' : 'NEW')).join(','),
      sourceCount: sources.length,
      s1Connected: s1.isConnected,
      s1SrcsetState,
      replacementNodesMatchNative: newNodes.length ? newNodes.every(Boolean) : 'not-applicable',
      currentSrcRelation: relation(img ? img.currentSrc || '' : '', c),
      imageComplete: !!img && !!img.complete,
      rendered: rect ? { width: px(rect.width), height: px(rect.height) } : null,
      natural: img ? { width: img.naturalWidth || 0, height: img.naturalHeight || 0 } : null,
    };
  }

  // Expected outcomes per scenario (the experiment's own predictions, checked in-browser).
  const SAME_NODES = { sameCardNode: true, sameImgNode: true, samePictureNode: true };
  const EXPECT = {
    afterApply: { ...SAME_NODES, sourceOrder: 'S1,S2', s1SrcsetState: 'ENHANCER_VALUE', currentSrcRelation: 'NATIVE_SAMPLE' },
    CONTROL: { dispose: 'RESTORED', after: { ...SAME_NODES, sourceOrder: 'S1,S2', s1SrcsetState: 'ORIGINAL', currentSrcRelation: 'NATIVE_PREVIEW_WEBP' } },
    NATIVE_EDIT: { native: { ...SAME_NODES, sourceOrder: 'S1,S2', s1SrcsetState: 'NATIVE_EDIT_VALUE', currentSrcRelation: 'NATIVE_PREVIEW' }, dispose: 'SKIPPED_NATIVE_TOUCHED',
      after: { ...SAME_NODES, sourceOrder: 'S1,S2', s1SrcsetState: 'NATIVE_EDIT_VALUE', currentSrcRelation: 'NATIVE_PREVIEW' } },
    MOVED_SOURCE: { native: { ...SAME_NODES, sourceOrder: 'S2,S1', s1SrcsetState: 'ENHANCER_VALUE', currentSrcRelation: 'NATIVE_PREVIEW' }, dispose: 'RESTORED',
      after: { ...SAME_NODES, sourceOrder: 'S2,S1', s1SrcsetState: 'ORIGINAL', currentSrcRelation: 'NATIVE_PREVIEW' } },
    REPLACED_SOURCE: { native: { ...SAME_NODES, sourceOrder: 'NEW,S2', s1Connected: false, replacementNodesMatchNative: true, currentSrcRelation: 'NATIVE_PREVIEW_WEBP' }, dispose: 'SKIPPED_DISCONNECTED',
      after: { ...SAME_NODES, sourceOrder: 'NEW,S2', s1Connected: false, replacementNodesMatchNative: true, currentSrcRelation: 'NATIVE_PREVIEW_WEBP' } },
    REPLACED_PICTURE: { native: { sameCardNode: true, sameImgNode: false, samePictureNode: false, sourceOrder: 'NEW,NEW', replacementNodesMatchNative: true, currentSrcRelation: 'NATIVE_PREVIEW_WEBP' }, dispose: 'SKIPPED_DISCONNECTED',
      after: { sameCardNode: true, sameImgNode: false, samePictureNode: false, sourceOrder: 'NEW,NEW', replacementNodesMatchNative: true, currentSrcRelation: 'NATIVE_PREVIEW_WEBP' } },
  };
  const mismatches = (phase, got, want) => Object.entries(want || {}).filter(([k, v]) => got[k] !== v).map(([k]) => `${phase}.${k}`);

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 });
  const enhancerMarkersPresent = () => !!document.querySelector('.be-thumb-wrap, .be-thumb-img, #be-toast-container, .be-gallery-grid');
  async function waitForImages(cards) {
    const deadline = Date.now() + LOAD_WAIT_MS;
    while (Date.now() < deadline) {
      if (cards.every((c) => { const img = c.article.querySelector('img'); return !img || img.complete; })) { await sleep(300); return true; }
      await sleep(200);
    }
    return false;
  }

  // ---- leak guard ---------------------------------------------------------------------
  function guard(text) {
    const raw = new Set();
    for (const a of run ? run.allArticles : []) {
      for (const n of ['data-id', 'data-md5', 'data-preview-url', 'data-preview-webp', 'data-sample-url', 'data-file-url']) { const v = a.getAttribute(n); if (v && v.length >= 3) { raw.add(v); raw.add(abs(v)); } }
    }
    for (const c of run ? run.cards : []) for (const v of [c.origS1Srcset, c.s2Srcset, c.ownedValue, c.facts.imgSrc]) if (v) raw.add(v);
    const leaked = [...raw].some((v) => v && text.includes(v)) || /https?:\/\//i.test(text) || /data:|blob:/.test(text);
    return leaked ? JSON.stringify({ probe: 'ib08-v9r-ownership', site: SITE, sanitationGuard: 'BLOCKED', note: 'output withheld: a raw captured value would have been emitted' }, null, 2) : text;
  }

  function show(text) {
    document.querySelector('#ib08-v9r-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib08-v9r-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.readOnly = true;
    ta.style.cssText = 'width:100%;height:75vh;background:#000;color:#eee';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.onclick = () => root.remove();
    root.append(ta, close);
    document.body.appendChild(root);
    ta.focus();
    ta.select();
  }
  const err = (message) => show(JSON.stringify({ probe: 'ib08-v9r-ownership', site: SITE, error: message }, null, 2));

  // ---- step 1: baseline, owned mutation, simulated native changes, dispose (wide) ---------
  async function step1() {
    if (!SITE) return err('unsupported host');
    if (run) return err('Step 1 already ran on this page load. Reload the page to start again.');
    document.querySelector('#ib08-v9r-result')?.remove();
    const allArticles = [...document.querySelectorAll('article.thumbnail, article.post-preview')].slice(0, MAX_SCAN);
    const classes = allArticles.map(classify);
    const reasons = {};
    classes.forEach((k) => { reasons[k] = (reasons[k] || 0) + 1; });
    const supported = allArticles.filter((a, i) => classes[i] === 'SUPPORTED');
    const inView = supported.filter((a) => { const r = a.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; });
    const chosen = (inView.length >= SCENARIOS.length ? inView : supported).slice(0, SCENARIOS.length);
    run = { allArticles, cards: [] };
    if (chosen.length < SCENARIOS.length) {
      run.result = { probe: 'ib08-v9r-ownership', version: '1.0.0', site: SITE, experimentVerdict: 'INSUFFICIENT', cardsScanned: allArticles.length, classification: reasons, note: 'Fewer than five cards match the observed pattern; nothing was changed.' };
      lastResult = guard(JSON.stringify(run.result, null, 2));
      return show(lastResult);
    }
    const sigs = new Map(allArticles.map((a) => [a, renditionSig(a)]));
    const cards = chosen.map((article, i) => {
      const img = article.querySelector('img');
      const picture = img.parentElement;
      const sources = [...picture.querySelectorAll('source')];
      return {
        card: `CARD_${String(i + 1).padStart(2, '0')}`, scenario: SCENARIOS[i], article, img, picture, sources,
        origS1Srcset: sources[0].getAttribute('srcset'), s2Srcset: sources[1].getAttribute('srcset'),
        ownedValue: article.getAttribute('data-sample-url').trim(),
        facts: { webp: abs(article.getAttribute('data-preview-webp')), preview: abs(article.getAttribute('data-preview-url')), sample: abs(article.getAttribute('data-sample-url')), file: abs(article.getAttribute('data-file-url')), imgSrc: abs(img.getAttribute('src')) },
        base: { picture: attrsOf(picture), sources: sources.map(attrsOf), img: attrsOf(img) },
        phases: {},
      };
    });
    run.cards = cards;
    cards.forEach((c) => { c.phases.baseline = observe(c); });
    const watch = new MutationObserver(() => {});
    cards.forEach((c) => watch.observe(c.article, { subtree: true, attributes: true, childList: true }));

    const owner = makeOwner();
    cards.forEach((c) => applyRendition(owner, c));
    const applyRecords = watch.takeRecords();
    run.applyMutationRecords = applyRecords.length;
    run.applyRecordsAllOwnedSrcset = applyRecords.every((r) => r.type === 'attributes' && r.attributeName === 'srcset' && cards.some((c) => c.sources[0] === r.target));
    run.settledAfterApply = await waitForImages(cards);
    cards.forEach((c) => { c.phases.afterApply = observe(c); });

    cards.forEach((c) => { if (NATIVE[c.scenario]) NATIVE[c.scenario](c); });
    watch.takeRecords();
    run.settledAfterNative = await waitForImages(cards);
    cards.forEach((c) => { c.phases.afterNativeAction = NATIVE[c.scenario] ? observe(c) : 'not-applicable'; });

    const outcomes = owner.dispose();
    const disposeRecords = watch.takeRecords();
    watch.disconnect();
    cards.forEach((c, i) => { c.dispose = outcomes[i]; });
    run.disposeMutationRecords = disposeRecords.length;
    run.disposeRecordsAllOwnedSrcset = disposeRecords.every((r) => r.type === 'attributes' && r.attributeName === 'srcset' && cards.some((c) => c.sources[0] === r.target));
    run.settledAfterDispose = await waitForImages(cards);
    cards.forEach((c) => { c.phases.afterDispose = observe(c); });
    run.sigs = sigs;
    run.viewportStep1 = viewport();
    run.enhancerMarkersStep1 = enhancerMarkersPresent();
    run.classification = reasons;
    run.route = /^\/(posts)?\/?$/.test(location.pathname) ? 'listing' : 'other';
    lastResult = null;
    show(guard(JSON.stringify({ probe: 'ib08-v9r-ownership', site: SITE, step: 'Step 1 done (mutation applied, native changes simulated, disposed)', scenarioCards: cards.length, viewportStep1: run.viewportStep1,
      next: 'Close this window, narrow the SAME browser window, wait about 5 seconds, then run Step 2.' }, null, 2)));
  }

  // ---- step 2: after the operator narrows the window --------------------------------------
  async function step2() {
    if (!SITE) return err('unsupported host');
    if (!run) return err('Step 1 has not run on this page load.');
    if (run.result) return show(lastResult);
    document.querySelector('#ib08-v9r-result')?.remove();
    await sleep(SETTLE_MS);
    const settled = await waitForImages(run.cards);
    const vp = viewport();
    const narrowed = vp.width < run.viewportStep1.width;
    const cards = run.cards.map((c) => {
      c.phases.afterResize = observe(c);
      const e = EXPECT[c.scenario];
      const miss = [
        ...mismatches('baseline', c.phases.baseline, { ...SAME_NODES, sourceOrder: 'S1,S2', s1SrcsetState: 'ORIGINAL', currentSrcRelation: 'NATIVE_PREVIEW_WEBP' }),
        ...mismatches('afterApply', c.phases.afterApply, EXPECT.afterApply),
        ...(e.native ? mismatches('afterNativeAction', c.phases.afterNativeAction, e.native) : []),
        ...(c.dispose === e.dispose ? [] : ['dispose']),
        ...mismatches('afterDispose', c.phases.afterDispose, e.after),
        ...mismatches('afterResize', c.phases.afterResize, e.after),
      ];
      return { card: c.card, scenario: c.scenario, ...c.phases, dispose: c.dispose, expectationMismatches: miss };
    });
    const scenarioSet = new Set(run.cards.map((c) => c.article));
    let otherChecked = 0; let otherChanged = 0; let unsupportedChecked = 0; let unsupportedChanged = 0;
    for (const a of run.allArticles) {
      if (scenarioSet.has(a)) continue;
      const changed = !a.isConnected || renditionSig(a) !== run.sigs.get(a);
      if (classify(a) === 'SUPPORTED') { otherChecked++; if (changed) otherChanged++; } else { unsupportedChecked++; if (changed) unsupportedChanged++; }
    }
    const allMet = cards.every((c) => c.expectationMismatches.length === 0) && narrowed && run.applyMutationRecords === run.cards.length && run.applyRecordsAllOwnedSrcset
      && run.disposeRecordsAllOwnedSrcset && run.disposeMutationRecords === cards.filter((c) => c.dispose === 'RESTORED').length && otherChanged === 0 && unsupportedChanged === 0;
    const result = {
      probe: 'ib08-v9r-ownership', version: '1.0.0', site: SITE, route: run.route,
      evidenceGate: 'G-RENDITION (IB08 E stage: reversible ownership on the observed pattern)',
      status: 'E-STAGE OBSERVATION (not a gate result)',
      enhancerMarkersPresentAtStep1: run.enhancerMarkersStep1, enhancerMarkersPresentAtStep2: enhancerMarkersPresent(),
      cardsScanned: run.allArticles.length, classification: run.classification, scenarioCards: cards.length,
      viewportStep1: run.viewportStep1, viewportStep2: vp, viewportNarrowed: narrowed,
      applyMutationRecords: run.applyMutationRecords, applyRecordsAllOwnedSrcset: run.applyRecordsAllOwnedSrcset,
      disposeMutationRecords: run.disposeMutationRecords, disposeRecordsAllOwnedSrcset: run.disposeRecordsAllOwnedSrcset,
      imagesSettled: { afterApply: run.settledAfterApply, afterNativeAction: run.settledAfterNative, afterDispose: run.settledAfterDispose, afterResize: settled },
      cards,
      otherSupportedCards: { checked: otherChecked, renditionChanged: otherChanged },
      unsupportedCards: { checked: unsupportedChecked, renditionChanged: unsupportedChanged },
      experimentVerdict: allMet ? 'ALL_EXPECTATIONS_MET' : 'EXPECTATION_MISMATCH',
      limits: 'Native changes are simulated by the experiment, not performed by the site. Relations are labels only; no sharpness is inferred from tile size. Image loads caused by the srcset change are ordinary browser loads of the card\'s own native sample.',
    };
    run.result = result;
    lastResult = guard(JSON.stringify(result, null, 2));
    show(lastResult);
  }

  GM_registerMenuCommand('IB08 ownership: Step 1 (wide window)', () => { step1(); });
  GM_registerMenuCommand('IB08 ownership: Step 2 (after narrowing) and show result', () => { step2(); });
  GM_registerMenuCommand('IB08 ownership: Show last result', () => show(lastResult || JSON.stringify({ probe: 'ib08-v9r-ownership', error: 'No completed result on this page load.' }, null, 2)));
})();
