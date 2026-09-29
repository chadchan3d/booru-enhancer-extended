// ==UserScript==
// @name         IB08 V9-R Native Rendition Baseline Probe
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib08-v9r-baseline
// @version      1.0.0
// @description  Read-only baseline of native e621/e926 responsive-image selection (IB08 G-RENDITION evidence).
// @author       ChadChan3D
// @license      MIT
// @match        *://e621.net/*
// @match        *://e926.net/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* IB08 V9-R baseline probe — observational only.
 * Never assigns or removes src/srcset/sizes, never touches <source>/<picture>,
 * never replaces or moves native nodes, never clicks, requests, stores or
 * reads cookies. Two captures on the same page (A: wide, B: after the operator
 * narrows the same window) keep in-memory node references to test identity.
 * The result holds only ordinals, booleans, counts, dimensions and relation
 * labels; a final leak guard blocks output containing any raw captured value. */
(() => {
  'use strict';

  const MAX_CARDS = 6;
  const SETTLE_MS = 2500;
  const LOAD_WAIT_MS = 5000;
  const SITE = location.hostname === 'e621.net' || location.hostname === 'e926.net' ? location.hostname : null;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let captureA = null; // in-memory only
  let lastResult = null;

  // ---- helpers (raw values stay inside these functions) -------------------------
  const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };
  function parseSrcset(value) {
    if (value === null || value === undefined) return { present: false, candidates: null, descriptorKind: 'absent', urls: [] , descriptors: [] };
    const text = String(value).trim();
    if (!text) return { present: true, candidates: 0, descriptorKind: 'empty', urls: [], descriptors: [] };
    const parts = text.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    const urls = []; const descriptors = []; let ok = true; const kinds = new Set();
    for (const part of parts) {
      const m = part.match(/^(\S+)(?:\s+(\d+(?:\.\d+)?[wx]))?$/);
      if (!m) { ok = false; break; }
      urls.push(abs(m[1]));
      descriptors.push(m[2] || '');
      kinds.add(m[2] ? m[2].slice(-1) : 'none');
    }
    if (!ok) return { present: true, candidates: null, descriptorKind: 'UNPARSABLE', urls: [], descriptors: [] };
    const descriptorKind = kinds.size === 1 ? [...kinds][0] : 'mixed';
    return { present: true, candidates: parts.length, descriptorKind, urls, descriptors };
  }
  const MIME = (t) => (t === null ? null : (/^image\/[a-z0-9.+-]{1,20}$/.test(t) ? t : 'OTHER'));
  const px = (n) => (Number.isFinite(n) ? Math.round(n) : null);

  function relationOf(url, card) {
    if (!url) return { primary: 'UNKNOWN', all: [], descriptor: null };
    const all = []; let descriptor = null;
    const facts = [['NATIVE_PREVIEW', card.nativePreview], ['NATIVE_PREVIEW_WEBP', card.nativePreviewWebp], ['NATIVE_SAMPLE', card.nativeSample], ['NATIVE_FILE', card.nativeFile]];
    for (const [label, v] of facts) if (v && v === url) all.push(label);
    if (card.imgSrc && card.imgSrc === url) all.push('IMG_SRC');
    card.imgSrcset.urls.forEach((u, i) => { if (u === url) { all.push(`IMG_SRCSET_CANDIDATE_${i + 1}`); descriptor = descriptor || card.imgSrcset.descriptors[i] || null; } });
    card.sources.forEach((s, si) => s.srcset.urls.forEach((u, i) => { if (u === url) { all.push(`SOURCE_${si + 1}_SRCSET_CANDIDATE_${i + 1}`); descriptor = descriptor || s.srcset.descriptors[i] || null; } }));
    if (all.length) return { primary: all[0], all, descriptor };
    let sameOrigin = false; try { sameOrigin = new URL(url).origin === location.origin; } catch { /* stays false */ }
    return { primary: sameOrigin ? 'OTHER_SAME_ORIGIN' : 'UNKNOWN', all: [], descriptor: null };
  }

  // Raw snapshot of one card: kept in memory, never output directly.
  function snapshot(article) {
    const img = article.querySelector('img');
    const picture = img ? img.closest('picture') : null;
    const sources = picture ? [...picture.querySelectorAll('source')] : [];
    const style = img ? getComputedStyle(img) : null;
    const rect = img ? img.getBoundingClientRect() : null;
    return {
      article, img, picture, sources,
      nativePreview: abs(article.getAttribute('data-preview-url')),
      nativePreviewWebp: abs(article.getAttribute('data-preview-webp')),
      nativeSample: abs(article.getAttribute('data-sample-url')),
      nativeFile: abs(article.getAttribute('data-file-url')),
      rawId: article.getAttribute('data-id') || '',
      imgSrc: img ? abs(img.getAttribute('src')) : '',
      imgSrcPresent: !!img && img.hasAttribute('src'),
      imgSrcset: parseSrcset(img ? img.getAttribute('srcset') : null),
      imgSizesPresent: !!img && img.hasAttribute('sizes'),
      sourceFacts: sources.map((s) => ({
        srcset: parseSrcset(s.getAttribute('srcset')),
        sizesPresent: s.hasAttribute('sizes'),
        mediaPresent: s.hasAttribute('media'),
        type: MIME(s.getAttribute('type')),
      })),
      currentSrc: img ? (img.currentSrc || '') : '',
      rendered: rect ? { width: px(rect.width), height: px(rect.height) } : null,
      natural: img ? { width: img.naturalWidth || 0, height: img.naturalHeight || 0 } : null,
      complete: !!img && !!img.complete,
      objectFit: style ? style.objectFit || null : null,
    };
  }
  const sanitizeSnap = (s) => {
    const card = { ...s, sources: s.sourceFacts };
    const rel = relationOf(s.currentSrc, card);
    return {
      inPicture: !!s.picture,
      sourceCount: s.sources.length,
      img: { srcPresent: s.imgSrcPresent, srcsetPresent: s.imgSrcset.present, srcsetCandidates: s.imgSrcset.candidates, srcsetDescriptorKind: s.imgSrcset.descriptorKind, sizesPresent: s.imgSizesPresent },
      sources: s.sourceFacts.map((f, i) => ({ source: i + 1, srcsetPresent: f.srcset.present, srcsetCandidates: f.srcset.candidates, srcsetDescriptorKind: f.srcset.descriptorKind, sizesPresent: f.sizesPresent, mediaPresent: f.mediaPresent, type: f.type })),
      rendered: s.rendered, natural: s.natural, imageComplete: s.complete, objectFit: s.objectFit,
      currentSrcRelation: rel.primary, currentSrcRelationsAll: rel.all, matchedDescriptor: rel.descriptor,
    };
  };

  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 });
  const enhancerMarkersPresent = () => !!document.querySelector('.be-thumb-wrap, .be-thumb-img, #be-toast-container, .be-gallery-grid');

  function visibleCards() {
    const cards = [...document.querySelectorAll('article.thumbnail[data-id], article.post-preview[data-id]')];
    const inView = cards.filter((a) => { const r = a.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; });
    return { total: cards.length, sampled: (inView.length ? inView : cards).slice(0, MAX_CARDS) };
  }

  async function waitForImages(snaps) {
    const deadline = Date.now() + LOAD_WAIT_MS;
    while (Date.now() < deadline) {
      if (snaps.every((s) => !s.img || s.img.complete)) return true;
      await sleep(200);
    }
    return false;
  }

  // ---- leak guard ---------------------------------------------------------------
  function guard(text, snaps) {
    const raw = new Set();
    for (const s of snaps) {
      for (const v of [s.rawId, s.nativePreview, s.nativePreviewWebp, s.nativeSample, s.nativeFile, s.imgSrc, s.currentSrc, ...s.imgSrcset.urls, ...s.sourceFacts.flatMap((f) => f.srcset.urls)]) if (v && String(v).length >= 3) raw.add(String(v));
      const md5 = s.article.getAttribute('data-md5'); if (md5) raw.add(md5);
    }
    const leaked = [...raw].some((v) => text.includes(v)) || /https?:\/\//i.test(text) || /data:|blob:/.test(text);
    return leaked ? JSON.stringify({ probe: 'ib08-v9r-baseline', site: SITE, sanitationGuard: 'BLOCKED', note: 'output withheld: a raw captured value would have been emitted' }, null, 2) : text;
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

  // ---- captures -------------------------------------------------------------------
  async function runCaptureA() {
    if (!SITE) return show(JSON.stringify({ probe: 'ib08-v9r-baseline', error: 'unsupported host' }, null, 2));
    document.querySelector('#ib08-v9r-result')?.remove();
    const { total, sampled } = visibleCards();
    const snaps = sampled.map(snapshot);
    await waitForImages(snaps);
    captureA = { viewport: viewport(), cardsOnPage: total, snaps: sampled.map(snapshot), route: /^\/(posts)?\/?$/.test(location.pathname) ? 'listing' : 'other', enhancerMarkers: enhancerMarkersPresent() };
    show(guard(JSON.stringify({ probe: 'ib08-v9r-baseline', site: SITE, step: 'A captured', sampledCards: captureA.snaps.length, viewportA: captureA.viewport, next: 'Close this window, narrow the SAME browser window, wait a few seconds, then run Capture B.' }, null, 2), captureA.snaps));
  }

  async function runCaptureB() {
    if (!SITE) return show(JSON.stringify({ probe: 'ib08-v9r-baseline', error: 'unsupported host' }, null, 2));
    if (!captureA) return show(JSON.stringify({ probe: 'ib08-v9r-baseline', site: SITE, error: 'Capture A has not been taken on this page load.' }, null, 2));
    document.querySelector('#ib08-v9r-result')?.remove();
    await sleep(SETTLE_MS);
    const bSnaps = captureA.snaps.map((a) => snapshot(a.article));
    const loaded = await waitForImages(bSnaps);
    const finalB = captureA.snaps.map((a) => snapshot(a.article));
    const cards = captureA.snaps.map((a, i) => {
      const b = finalB[i];
      const sameImgNode = !!a.img && a.img === b.img && a.img.isConnected;
      const samePictureNode = a.picture || b.picture ? (a.picture === b.picture && !!a.picture && a.picture.isConnected) : 'not-applicable';
      const sameSourceNodes = a.sources.length || b.sources.length
        ? (a.sources.length === b.sources.length && a.sources.every((s, k) => s === b.sources[k] && s.isConnected)) : 'not-applicable';
      const A = sanitizeSnap(a); const B = sanitizeSnap(b);
      const changed = a.currentSrc && b.currentSrc ? a.currentSrc !== b.currentSrc : 'unknown';
      return { card: `CARD_${String(i + 1).padStart(2, '0')}`, sameCardNode: a.article === b.article && a.article.isConnected, sameImgNode, samePictureNode, sameSourceNodes,
        currentSrcRelationA: A.currentSrcRelation, currentSrcRelationB: B.currentSrcRelation, currentSrcChanged: changed, conditionA: A, conditionB: B };
    });
    const result = {
      probe: 'ib08-v9r-baseline', version: '1.0.0', site: SITE, route: captureA.route,
      evidenceGate: 'G-RENDITION (IB08 V9-R baseline, native only)',
      enhancerMarkersPresentAtA: captureA.enhancerMarkers, enhancerMarkersPresentAtB: enhancerMarkersPresent(),
      cardsOnPage: captureA.cardsOnPage, sampledCards: cards.length, sampleLimit: MAX_CARDS,
      conditionA: { viewport: captureA.viewport },
      conditionB: { viewport: viewport(), settleMs: SETTLE_MS, allSampledImagesComplete: loaded },
      viewportNarrowed: viewport().width < captureA.viewport.width,
      cards,
      limits: 'Relations are labels only; UNKNOWN means the observed facts do not establish which rendition is displayed. No sharper rendition is inferred from tile size.',
    };
    lastResult = guard(JSON.stringify(result, null, 2), [...captureA.snaps, ...finalB]);
    show(lastResult);
  }

  GM_registerMenuCommand('IB08 baseline: Capture A (wide window)', () => { runCaptureA(); });
  GM_registerMenuCommand('IB08 baseline: Capture B (after narrowing) and show result', () => { runCaptureB(); });
  GM_registerMenuCommand('IB08 baseline: Show last result', () => show(lastResult || JSON.stringify({ probe: 'ib08-v9r-baseline', error: 'No completed result on this page load.' }, null, 2)));
})();
