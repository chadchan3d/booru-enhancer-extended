/* IB08P E621/E926 RENDITION PRODUCTION CONFORMANCE POSTAMBLE — test code, not production.
 * The production body above runs verbatim inside IB07P_PRODUCTION_BODY (IB07
 * wrapper convention). This postamble runs synchronously right after it,
 * before production's asynchronous init mounts the gallery. It snapshots the
 * native listing (in memory) and records every rendition-attribute write
 * (src/srcset/sizes/media/type) and every node change inside <picture>, so
 * production's writes are judged against the native page, not its own
 * report. It changes nothing, except in the explicit dispose test: that test
 * simulates the site editing, moving and replacing nodes, then calls
 * production's own gallery dispose. Output: statuses, enums, booleans and
 * counts only; a leak guard withholds anything carrying a captured value.
 *
 * Revision 2 (after the first live run):
 *   - every recorded write is attributed when it happens: native card media
 *     from the load snapshot, card media added later, enhancer UI created
 *     later, pre-existing native nodes, or other later nodes. It also records
 *     whether the new value is a native sample/file URL of a card (the
 *     enhancer rendition signature);
 *   - P06 fails on unexpected card-media writes or any enhancer-signature
 *     write outside the owned cards; other off-card writes are reported by
 *     region instead of being counted as enhancer writes;
 *   - P09 accepts the expected rendition when a card's native file and
 *     sample URLs are the same (alias), and reports alias counts;
 *   - D01 judges dispose writes at dispose time; D10 fails on any enhancer
 *     rendition write after dispose (re-enhancement).
 *
 * Revision 3 (after the second live run): D10 measures re-enhancement
 * directly: calls through BE.modules.gallery.init, new owners
 * (BE.ownership.create), enhancer action bars inserted, and enhancer
 * rendition-signature writes, all after dispose. An enhancer class still on a
 * card (be-thumb-wrap) is stale state, not re-enhancement. It is reported
 * separately with whether the site touched that card's class attribute
 * after load (class-mutation categories, counts only).
 *
 * Revision 4 (presentation residue): D11 fails if any rule of the enhancer
 * stylesheet (selector mentioning be-thumb or be-gallery-grid) still matches
 * a card, its image or the gallery container after dispose. Stale class
 * tokens may remain (IB04 rule), but they must have no enhancer presentation. */
(() => {
  'use strict';

  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function () {\n';
  const SETTLE_MS = 2500;
  const LOAD_WAIT_MS = 8000;
  const SAMPLE_CARDS = 5;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const BE = window.BE;
  const SITES = ['e621.net', 'e926.net'];
  const SITE = SITES.includes(location.hostname) ? SITES[SITES.indexOf(location.hostname)] : null;
  const RENDITION_ATTRS = ['src', 'srcset', 'sizes', 'media', 'type'];
  const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const SINGLE = /^[^\s,]+(?:\s+\d+(?:\.\d+)?[wx])?$/;
  const SAFE = /^[^\s,]+$/;
  const abs = (u) => { try { return u ? new URL(u, location.href).href : ''; } catch { return ''; } };
  const first = (srcset) => String(srcset || '').trim().split(/\s+/)[0];

  // ---- request observation (counts only), as in the IB07 postambles ----------------
  const requests = { total: 0 };
  for (const name of ['request', 'nativeFetch']) {
    const original = BE?.runtime?.[name];
    if (typeof original === 'function') BE.runtime[name] = function wrappedTransport(...args) { requests.total++; return original.apply(this, args); };
  }

  // ---- native snapshot and write recorder, before production mounts -----------------
  const galleryEnhancedAtLoad = !!document.querySelector('.be-thumb-wrap');
  const attrsOf = (el) => (el ? RENDITION_ATTRS.map((n) => el.getAttribute(n)) : null);
  function classify(article) {
    const d = (n) => article.getAttribute(n);
    if (!d('data-id') || !IMAGE_EXT.has(String(d('data-file-ext') || '').toLowerCase())) return 'UNSUPPORTED';
    if (!d('data-preview-url') || !d('data-preview-webp') || !SAFE.test((d('data-sample-url') || '').trim())) return 'UNSUPPORTED';
    const imgs = article.querySelectorAll('img');
    if (imgs.length !== 1 || article.querySelectorAll('picture').length !== 1) return 'UNSUPPORTED';
    const img = imgs[0];
    const picture = img.parentElement;
    if (!picture || picture.localName !== 'picture') return 'UNSUPPORTED';
    const kids = [...picture.children];
    if (kids.length !== 3 || kids[2] !== img || kids[0].localName !== 'source' || kids[1].localName !== 'source') return 'UNSUPPORTED';
    const [s1, s2] = kids;
    if (s1.getAttribute('type') !== 'image/webp' || s2.getAttribute('type') !== 'image/jpeg') return 'UNSUPPORTED';
    for (const s of [s1, s2]) if (s.hasAttribute('sizes') || s.hasAttribute('media') || !SINGLE.test(String(s.getAttribute('srcset') || '').trim())) return 'UNSUPPORTED';
    if (!img.hasAttribute('src') || img.hasAttribute('srcset') || img.hasAttribute('sizes')) return 'UNSUPPORTED';
    const w = abs(first(s1.getAttribute('srcset'))); const j = abs(first(s2.getAttribute('srcset')));
    if (w !== abs(d('data-preview-webp')) || w === j) return 'UNSUPPORTED';
    const sample = abs(d('data-sample-url').trim());
    if (sample === w || sample === j) return 'UNSUPPORTED';
    return 'PATTERN';
  }
  const native = new Map();
  for (const a of document.querySelectorAll('article.thumbnail, article.post-preview')) {
    const img = a.querySelector('img');
    const picture = img ? img.parentElement : null;
    native.set(a, {
      cls: classify(a), img, picture, sources: picture ? [...picture.querySelectorAll('source')] : [],
      sourceAttrs: picture ? [...picture.querySelectorAll('source')].map(attrsOf) : [], imgAttrs: attrsOf(img), pictureAttrs: attrsOf(picture),
      facts: { webp: abs(a.getAttribute('data-preview-webp')), preview: abs(a.getAttribute('data-preview-url')), sample: abs(a.getAttribute('data-sample-url')), file: abs(a.getAttribute('data-file-url')) },
      sampleRaw: (a.getAttribute('data-sample-url') || '').trim(), fileRaw: (a.getAttribute('data-file-url') || '').trim(),
    });
  }
  const preexisting = new WeakSet(document.querySelectorAll('*'));
  const cardMedia = new WeakSet();
  for (const n of native.values()) for (const el of [n.picture, n.img, ...n.sources]) if (el) cardMedia.add(el);
  const signatureValues = new Set();
  for (const n of native.values()) for (const v of [n.sampleRaw, n.fileRaw]) if (v) { signatureValues.add(v); signatureValues.add(abs(v)); }
  const regionOf = (t) => {
    if (cardMedia.has(t)) return 'CARD_MEDIA';
    if (['picture', 'source', 'img'].includes(t.localName) && t.closest && t.closest('article')) return 'LATE_CARD_MEDIA';
    if (!preexisting.has(t) && t.closest && t.closest('[id^="be-"], [class*="be-"]')) return 'ENHANCER_UI';
    if (preexisting.has(t)) return 'NATIVE_PREEXISTING';
    return 'LATE_OTHER';
  };
  // Direct re-enhancement instruments (counts by phase; production looks these properties up at call time).
  const calls = {};
  const bump = (k) => { calls[phase] = calls[phase] || { galleryInit: 0, ownersCreated: 0, thumbWrapper: 0, actionBarsAdded: 0 }; calls[phase][k]++; };
  if (BE?.modules?.gallery && typeof BE.modules.gallery.init === 'function') {
    const initOrig = BE.modules.gallery.init;
    BE.modules.gallery.init = function countedInit(...a) { bump('galleryInit'); return initOrig.apply(this, a); };
  }
  if (BE?.ownership && typeof BE.ownership.create === 'function') {
    const createOrig = BE.ownership.create;
    BE.ownership.create = function countedCreate(...a) { bump('ownersCreated'); return createOrig.apply(this, a); };
  }
  for (const ad of BE?.adapters?.registry || []) {
    const gw = ad.getThumbWrapper;
    if (typeof gw === 'function') ad.getThumbWrapper = function countedWrapper(...a) { bump('thumbWrapper'); return gw.apply(this, a); };
  }
  new MutationObserver((recs) => { for (const r of recs) for (const n of r.addedNodes) if (n.classList && n.classList.contains('be-thumb-actions')) bump('actionBarsAdded'); })
    .observe(document.documentElement, { subtree: true, childList: true });
  // Class-attribute history of the snapshot cards (in memory; categories only).
  const classLog = [];
  const classObserver = new MutationObserver((recs) => { for (const r of recs) classLog.push(r); });
  const classAtLoad = new Map();
  for (const a of document.querySelectorAll('article.thumbnail, article.post-preview')) { classAtLoad.set(a, a.getAttribute('class') || ''); classObserver.observe(a, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }); }
  function classHistory() {
    classLog.push(...classObserver.takeRecords());
    const byCard = new Map();
    for (const r of classLog) { if (!byCard.has(r.target)) byCard.set(r.target, []); byCard.get(r.target).push(r); }
    const cats = { ENHANCER_ADD: 0, ENHANCER_REMOVE: 0, UNCHANGED_REWRITE: 0, OTHER_TOKEN_CHANGE: 0 };
    const nativeTouchedCards = new Set();
    const toks = (v) => new Set(String(v || '').split(/\s+/).filter(Boolean));
    for (const [card, rs] of byCard) {
      rs.forEach((r, i) => {
        const before = toks(r.oldValue);
        const after = toks(i + 1 < rs.length ? rs[i + 1].oldValue : card.getAttribute('class'));
        const added = [...after].filter((t) => !before.has(t)); const removed = [...before].filter((t) => !after.has(t));
        if (added.length === 1 && added[0] === 'be-thumb-wrap' && !removed.length) cats.ENHANCER_ADD++;
        else if (removed.length === 1 && removed[0] === 'be-thumb-wrap' && !added.length) cats.ENHANCER_REMOVE++;
        else if (!added.length && !removed.length) { cats.UNCHANGED_REWRITE++; nativeTouchedCards.add(card); }
        else { cats.OTHER_TOKEN_CHANGE++; nativeTouchedCards.add(card); }
      });
    }
    return { cats, nativeTouchedCards };
  }
  const log = []; // { phase, r, region, signature }
  let phase = 'production';
  const keep = (r) => r.type === 'attributes' || (r.type === 'childList'
    && (r.target.localName === 'picture' || [...r.addedNodes, ...r.removedNodes].some((n) => ['picture', 'source', 'img'].includes(n.localName))));
  const entry = (r) => ({ phase, r, region: regionOf(r.target),
    signature: r.type === 'attributes' && signatureValues.has(String(r.target.getAttribute(r.attributeName) || '').trim()) });
  const recorder = new MutationObserver((recs) => { for (const r of recs) if (keep(r)) log.push(entry(r)); });
  recorder.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: RENDITION_ATTRS, attributeOldValue: true });
  const flush = () => { for (const r of recorder.takeRecords()) if (keep(r)) log.push(entry(r)); };

  async function sourceIdentity() {
    if (typeof IB07P_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB07P_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const body = text.slice(WRAP_FN_HEAD.length, -1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  // All native labels the displayed URL matches (a card's file and sample URLs can be the same).
  function relations(img, n) {
    const url = img ? img.currentSrc || '' : '';
    const out = [];
    if (url) for (const [label, v] of [['NATIVE_PREVIEW_WEBP', n.facts.webp], ['NATIVE_PREVIEW', n.facts.preview], ['NATIVE_SAMPLE', n.facts.sample], ['NATIVE_FILE', n.facts.file]]) if (v && v === url) out.push(label);
    return out.length ? out : ['UNKNOWN'];
  }
  const relation = (img, n) => relations(img, n)[0];
  async function waitForImages(imgs) {
    const deadline = Date.now() + LOAD_WAIT_MS;
    while (Date.now() < deadline) { if (imgs.every((i) => !i || i.complete)) { await sleep(300); return true; } await sleep(200); }
    return false;
  }
  const loginMarker = () => { const v = document.body?.getAttribute('data-user-is-anonymous'); return v === null || v === undefined ? 'ABSENT' : v === 'true' ? 'TRUE' : v === 'false' ? 'FALSE' : 'OTHER'; };
  const inView = (a) => { const r = a.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; };
  const viewport = () => ({ width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 });

  function guard(text) {
    const raw = new Set();
    for (const [a, n] of native) {
      for (const k of ['data-id', 'data-md5', 'data-preview-url', 'data-preview-webp', 'data-sample-url', 'data-file-url']) { const v = a.getAttribute(k); if (v && v.length >= 3) { raw.add(v); raw.add(abs(v)); } }
      for (const s of n.sourceAttrs) if (s[1]) raw.add(s[1]);
      if (n.imgAttrs && n.imgAttrs[0]) raw.add(n.imgAttrs[0]);
    }
    const leaked = [...raw].some((v) => text.includes(v)) || /https?:\/\//i.test(text);
    return leaked ? JSON.stringify({ probe: 'ib08p-rendition-conformance', site: SITE, sanitationGuard: 'BLOCKED' }, null, 2) : text;
  }
  function show(text) {
    document.querySelector('#ib08p-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib08p-result';
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
    return text;
  }

  // Expected WebP srcset for a pattern card under the current quality (native strings).
  const expectedWebp = (n, quality, owned) => (!owned || quality === 'preview' ? n.sourceAttrs[0][1] : quality === 'original' ? n.fileRaw : n.sampleRaw);
  const expectedEnum = (n, quality, loggedOut) => {
    if (!loggedOut) return 'NATIVE_OUT_OF_SCOPE';
    if (n.cls !== 'PATTERN') return 'NATIVE_UNSUPPORTED';
    if (quality === 'sample') return 'OWNED_SAMPLE';
    if (quality === 'original') return SAFE.test(n.fileRaw) ? 'OWNED_ORIGINAL' : 'NATIVE_UNSUPPORTED';
    return 'NATIVE_PREVIEW';
  };
  const expectedRelation = { OWNED_SAMPLE: 'NATIVE_SAMPLE', OWNED_ORIGINAL: 'NATIVE_FILE', NATIVE_PREVIEW: 'NATIVE_PREVIEW_WEBP' };

  function baseChecks(check) {
    check('P01', 'qualified host and /posts listing route', !!SITE && /^\/posts\/?$/.test(location.pathname));
    check('P02', 'e621 adapter active and gallery enhanced', BE?.adapters?.active?.id === 'e621' && document.querySelectorAll('.be-thumb-wrap').length > 0);
    check('P03', 'write recorder was installed before the gallery was enhanced', !galleryEnhancedAtLoad);
  }

  // ---- command: check this page under the current quality --------------------------------
  async function checkPage() {
    if (!SITE) return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', error: 'unsupported host' }, null, 2));
    const checks = [];
    const check = (id, name, ok, detail = null) => checks.push({ id, name, status: ok === null ? 'NOT_APPLICABLE' : ok ? 'PASS' : 'FAIL', detail });
    flush();
    const identity = await sourceIdentity();
    check('P00', 'executed production body is the expected artifact', identity === 'MATCH_EXPECTED_ARTIFACT', { identity });
    baseChecks(check);
    const marker = loginMarker();
    const loggedOut = marker === 'TRUE';
    const quality = BE.settings.get('media.thumbQuality');
    const cards = [...native.keys()];
    const counts = { cardsOnPage: cards.length, pattern: 0, unsupported: 0, enumMismatch: 0, writeMismatch: 0, stateMismatch: 0, identityMismatch: 0, relationMismatch: 0, relationUnsettled: 0 };
    const byEnum = {};
    const prodEntries = log.filter((x) => x.phase === 'production');
    const prodWrites = prodEntries.map((x) => x.r);
    const writesOn = (nodes) => prodWrites.filter((r) => nodes.includes(r.target));
    const ownedNodes = new Set();
    const sampled = [];
    for (const a of cards) {
      const n = native.get(a);
      if (n.cls === 'PATTERN') counts.pattern++; else counts.unsupported++;
      const got = BE.modules.gallery.getThumbRendition(a);
      byEnum[got || 'NONE'] = (byEnum[got || 'NONE'] || 0) + 1;
      const want = expectedEnum(n, quality, loggedOut);
      if (got !== want) counts.enumMismatch++;
      const owned = want === 'OWNED_SAMPLE' || want === 'OWNED_ORIGINAL';
      const cardNodes = [n.picture, n.img, ...n.sources].filter(Boolean);
      if (owned && n.sources[0]) ownedNodes.add(n.sources[0]);
      const w = writesOn(cardNodes);
      const okWrites = owned ? (w.length === 1 && w[0].type === 'attributes' && w[0].target === n.sources[0] && w[0].attributeName === 'srcset') : w.length === 0;
      if (!okWrites) counts.writeMismatch++;
      const img = a.querySelector('img');
      const picture = img ? img.parentElement : null;
      const sources = picture ? [...picture.querySelectorAll('source')] : [];
      if (img !== n.img || picture !== n.picture || sources.length !== n.sources.length || sources.some((s, k) => s !== n.sources[k])) counts.identityMismatch++;
      const stateOk = n.cls !== 'PATTERN'
        ? JSON.stringify(sources.map(attrsOf)) === JSON.stringify(n.sourceAttrs) && JSON.stringify(attrsOf(img)) === JSON.stringify(n.imgAttrs)
        : sources[0].getAttribute('srcset') === expectedWebp(n, quality, owned) && JSON.stringify(attrsOf(sources[1])) === JSON.stringify(n.sourceAttrs[1])
          && JSON.stringify(attrsOf(img)) === JSON.stringify(n.imgAttrs) && JSON.stringify(attrsOf(sources[0]).filter((_, k) => k !== 1)) === JSON.stringify(n.sourceAttrs[0].filter((_, k) => k !== 1));
      if (!stateOk) counts.stateMismatch++;
      if (n.cls === 'PATTERN' && loggedOut && sampled.length < SAMPLE_CARDS && inView(a)) sampled.push({ a, n, img, want });
    }
    const offCard = {};
    for (const x of prodEntries) if (x.region !== 'CARD_MEDIA') { const k = `${x.region}:${x.r.target.localName}.${x.r.attributeName || 'children'}`; offCard[k] = (offCard[k] || 0) + 1; }
    // Enhancer rendition signature on a native node other than an owned card's WebP source.
    const strayEnhancerWrites = prodEntries.filter((x) => x.signature && x.region !== 'ENHANCER_UI' && !ownedNodes.has(x.r.target)).length;
    const settled = await waitForImages(sampled.map((s) => s.img));
    const relationCounts = {};
    let sampledAliased = 0;
    for (const s of sampled) {
      const rels = relations(s.img, s.n);
      const key = rels.join('|');
      relationCounts[key] = (relationCounts[key] || 0) + 1;
      if (rels.length > 1) sampledAliased++;
      if (!rels.includes(expectedRelation[s.want])) counts.relationMismatch++;
    }
    const fileEqualsSampleCards = [...native.values()].filter((n) => n.cls === 'PATTERN' && n.facts.file && n.facts.file === n.facts.sample).length;
    check('P04', 'login marker recorded (data-user-is-anonymous)', marker === 'TRUE' || marker === 'FALSE', { marker });
    check('P05', 'every card reports the contract provenance for its pattern, login state and quality', counts.enumMismatch === 0, { byEnum });
    check('P06', loggedOut ? 'owned cards: exactly one write, on the WebP source srcset; no enhancer rendition write anywhere else' : 'logged in: zero enhancer rendition writes on any card or node',
      counts.writeMismatch === 0 && strayEnhancerWrites === 0,
      { writeMismatch: counts.writeMismatch, strayEnhancerSignatureWrites: strayEnhancerWrites, totalRecordedWrites: prodWrites.length, offCardWritesByRegion: offCard });
    check('P07', 'final attributes: WebP srcset = expected native string; JPEG source, img and non-pattern cards unchanged', counts.stateMismatch === 0, { stateMismatch: counts.stateMismatch });
    check('P08', 'picture/source/img node identity unchanged on every card', counts.identityMismatch === 0, { identityMismatch: counts.identityMismatch });
    check('P09', 'selected rendition (currentSrc) matches the quality on sampled in-view pattern cards (settled = loads also complete; informational)', loggedOut ? (sampled.length > 0 && counts.relationMismatch === 0) : null,
      { sampled: sampled.length, relations: relationCounts, sampledAliased, fileEqualsSampleCards, settled });
    check('P10', 'saved quality intent is a valid stored value (read only)', ['preview', 'sample', 'original'].includes(quality), { quality });
    check('P11', 'no enhancer request observed from postamble load to this check', requests.total === 0, { requests: requests.total });
    const result = {
      probe: 'ib08p-rendition-conformance', site: SITE, command: 'check', quality, loginMarker: marker, viewport: viewport(),
      production_body_identity: identity, counts, checks,
      summary: { checks: checks.length, failed: checks.filter((c) => c.status === 'FAIL').length, status: checks.some((c) => c.status === 'FAIL') ? 'FAIL' : 'PASS' },
    };
    return show(guard(JSON.stringify(result, null, 2)));
  }

  // ---- command: dispose test (logged out, sample), step 1 wide / step 2 narrowed -----------
  let disposeRun = null;
  async function disposeStep1() {
    if (!SITE) return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', error: 'unsupported host' }, null, 2));
    if (disposeRun) return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', site: SITE, error: 'Dispose step 1 already ran on this page load. Reload to repeat.' }, null, 2));
    flush();
    const quality = BE.settings.get('media.thumbQuality');
    const pattern = [...native.keys()].filter((a) => native.get(a).cls === 'PATTERN' && BE.modules.gallery.getThumbRendition(a) === 'OWNED_SAMPLE');
    const chosen = (pattern.filter(inView).length >= SAMPLE_CARDS ? pattern.filter(inView) : pattern).slice(0, SAMPLE_CARDS);
    if (loginMarker() !== 'TRUE' || quality !== 'sample' || chosen.length < SAMPLE_CARDS) {
      return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', site: SITE, error: 'Needs a logged-out /posts page with Grid thumbnail quality = Sample and at least five owned sample cards.', quality, loginMarker: loginMarker(), ownedSampleCards: pattern.length }, null, 2));
    }
    const ownedTotal = [...native.keys()].filter((a) => BE.modules.gallery.getThumbRendition(a) === 'OWNED_SAMPLE').length;
    // Simulated site changes (test code), recorded separately from production writes.
    phase = 'simulation';
    const [, c2, c3, c4, c5] = chosen.map((a) => native.get(a));
    const fresh = (tag, attrs) => { const el = document.createElement(tag); RENDITION_ATTRS.forEach((k, i) => { if (attrs && attrs[i] !== null) el.setAttribute(k, attrs[i]); }); return el; };
    c2.sources[0].setAttribute('srcset', c2.sourceAttrs[1][1]);
    c3.sources[1].after(c3.sources[0]);
    c4.sources[0].replaceWith(fresh('source', c4.sourceAttrs[0]));
    const p = fresh('picture', c5.pictureAttrs); c5.sourceAttrs.forEach((s) => p.append(fresh('source', s))); const ni = fresh('img', c5.imgAttrs); ni.alt = ''; p.append(ni); c5.picture.replaceWith(p);
    flush();
    phase = 'dispose';
    BE.modules.gallery.dispose();
    flush();
    phase = 'after';
    const disposeWrites = log.filter((x) => x.phase === 'dispose').map((x) => x.r);
    const nativeOf = (t) => [...native.values()].find((n) => n.sources[0] === t);
    const restoredAtDispose = disposeWrites.filter((r) => r.type === 'attributes' && r.attributeName === 'srcset' && nativeOf(r.target) && r.target.getAttribute('srcset') === nativeOf(r.target).sourceAttrs[0][1]).length;
    disposeRun = { chosen, ownedTotal, viewportA: viewport(), disposeWrites, restoredAtDispose };
    return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', site: SITE, step: 'Dispose step 1 done', next: 'Close this box, narrow the SAME window, wait about 5 seconds, then run Dispose step 2.' }, null, 2));
  }

  async function disposeStep2() {
    if (!SITE) return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', error: 'unsupported host' }, null, 2));
    if (!disposeRun) return show(JSON.stringify({ probe: 'ib08p-rendition-conformance', site: SITE, error: 'Dispose step 1 has not run on this page load.' }, null, 2));
    await sleep(SETTLE_MS);
    flush();
    const checks = [];
    const check = (id, name, ok, detail = null) => checks.push({ id, name, status: ok ? 'PASS' : 'FAIL', detail });
    const identity = await sourceIdentity();
    check('P00', 'executed production body is the expected artifact', identity === 'MATCH_EXPECTED_ARTIFACT', { identity });
    const [c1, c2, c3, c4, c5] = disposeRun.chosen.map((a) => native.get(a));
    const cur = (a) => { const img = a.querySelector('img'); const pic = img ? img.parentElement : null; return { img, pic, sources: pic ? [...pic.querySelectorAll('source')] : [] }; };
    const [k1, k2, k3, k4, k5] = disposeRun.chosen.map(cur);
    await waitForImages([k1.img, k2.img, k3.img, k4.img, k5.img]);
    const dw = disposeRun.disposeWrites;
    const expectedDisposeWrites = disposeRun.ownedTotal - 3; // native edit kept, two disconnected owned sources
    check('D01', 'dispose writes only WebP-source srcset restorations to the native value (judged at dispose time), one per remaining owned card, no node operations',
      dw.length === expectedDisposeWrites && disposeRun.restoredAtDispose === expectedDisposeWrites,
      { disposeWrites: dw.length, restoredAtDispose: disposeRun.restoredAtDispose, expected: expectedDisposeWrites });
    const after = log.filter((x) => x.phase === 'after');
    const ac = calls.after || { galleryInit: 0, ownersCreated: 0, thumbWrapper: 0, actionBarsAdded: 0 };
    const signatureAfter = after.filter((x) => x.signature && x.region !== 'ENHANCER_UI').length;
    const { cats, nativeTouchedCards } = classHistory();
    const stale = [...native.keys()].filter((a) => a.classList.contains('be-thumb-wrap'));
    check('D10', 'no re-enhancement after dispose: no gallery.init call, no new owner, no action bar inserted, no enhancer rendition write (dispose is terminal)',
      ac.galleryInit === 0 && ac.ownersCreated === 0 && ac.actionBarsAdded === 0 && signatureAfter === 0,
      { afterDispose: { galleryInitCalls: ac.galleryInit, ownersCreated: ac.ownersCreated, actionBarsAdded: ac.actionBarsAdded, thumbWrapperCalls: ac.thumbWrapper, signatureWrites: signatureAfter,
        cardMediaWrites: after.filter((x) => x.region === 'CARD_MEDIA' || x.region === 'LATE_CARD_MEDIA').length },
      staleState: { cardsWithEnhancerClass: stale.length, ofWhichSiteTouchedClass: stale.filter((a) => nativeTouchedCards.has(a)).length, classMutationCategories: cats } });
    check('D02', 'control card restored and shows the native WebP preview', k1.sources[0].getAttribute('srcset') === c1.sourceAttrs[0][1] && relation(k1.img, c1) === 'NATIVE_PREVIEW_WEBP');
    check('D03', 'native edit kept through dispose', k2.sources[0] === c2.sources[0] && c2.sources[0].getAttribute('srcset') === c2.sourceAttrs[1][1] && relation(k2.img, c2) === 'NATIVE_PREVIEW');
    check('D04', 'moved source: native order kept, WebP srcset restored', k3.sources[0] === c3.sources[1] && k3.sources[1] === c3.sources[0] && c3.sources[0].getAttribute('srcset') === c3.sourceAttrs[0][1] && relation(k3.img, c3) === 'NATIVE_PREVIEW');
    check('D05', 'replaced source untouched and native', k4.sources[0] !== c4.sources[0] && JSON.stringify(attrsOf(k4.sources[0])) === JSON.stringify(c4.sourceAttrs[0]) && relation(k4.img, c4) === 'NATIVE_PREVIEW_WEBP');
    check('D06', 'replaced picture untouched and native', k5.pic !== c5.picture && JSON.stringify(k5.sources.map(attrsOf)) === JSON.stringify(c5.sourceAttrs) && relation(k5.img, c5) === 'NATIVE_PREVIEW_WEBP');
    const residue = [...document.querySelectorAll('article source, article img')].filter((el) => [...native.values()].some((n) => (n.sampleRaw && el.getAttribute('srcset') === n.sampleRaw) || (n.sampleRaw && el.getAttribute('src') === n.sampleRaw))).length;
    const restoredOthers = [...native.keys()].filter((a) => !disposeRun.chosen.includes(a)).every((a) => { const n = native.get(a); const c = cur(a); return JSON.stringify(c.sources.map(attrsOf)) === JSON.stringify(n.sourceAttrs) && JSON.stringify(attrsOf(c.img)) === JSON.stringify(n.imgAttrs); });
    check('D07', 'every other card is back to its native rendition attributes; no sample residue on connected nodes', restoredOthers && residue === 0, { residue });
    const enhancerRules = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules || []) if (r.selectorText && /be-thumb|be-gallery-grid/.test(r.selectorText)) enhancerRules.push(r.selectorText);
    }
    const matchesAny = (el) => !!el && enhancerRules.some((sel) => { try { return el.matches(sel); } catch { return false; } });
    const cardsNow = [...native.keys()].filter((a) => a.isConnected);
    const galleryRoot = cardsNow[0] ? cardsNow[0].closest('#posts-container, .posts-container') : null;
    const presentation = {
      enhancerRules: enhancerRules.length,
      cardsWithEnhancerPresentation: cardsNow.filter(matchesAny).length,
      imagesWithEnhancerPresentation: cardsNow.filter((a) => matchesAny(a.querySelector('img'))).length,
      containerWithEnhancerPresentation: matchesAny(galleryRoot),
      staleCardTokens: cardsNow.filter((a) => a.classList.contains('be-thumb-wrap')).length,
      staleImageTokens: cardsNow.filter((a) => a.querySelector('img')?.classList.contains('be-thumb-img')).length,
      containerKeepsGalleryClass: !!galleryRoot && galleryRoot.classList.contains('be-gallery-grid'),
    };
    check('D11', 'no enhancer presentation after dispose: no enhancer stylesheet rule matches any card, image or the gallery container (stale tokens may remain)',
      enhancerRules.length > 0 && presentation.cardsWithEnhancerPresentation === 0 && presentation.imagesWithEnhancerPresentation === 0 && !presentation.containerWithEnhancerPresentation, presentation);
    check('D08', 'viewport narrowed between steps (dispose, then resize)', viewport().width < disposeRun.viewportA.width, { before: disposeRun.viewportA, after: viewport() });
    check('D09', 'no enhancer request observed', requests.total === 0, { requests: requests.total });
    const result = { probe: 'ib08p-rendition-conformance', site: SITE, command: 'dispose', production_body_identity: identity, checks,
      summary: { checks: checks.length, failed: checks.filter((c) => c.status === 'FAIL').length, status: checks.some((c) => c.status === 'FAIL') ? 'FAIL' : 'PASS' } };
    return show(guard(JSON.stringify(result, null, 2)));
  }

  const register = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : null;
  if (register) {
    register('IB08P: Check this page (current quality)', () => checkPage());
    register('IB08P: Dispose test step 1 (wide window)', () => disposeStep1());
    register('IB08P: Dispose test step 2 (after narrowing)', () => disposeStep2());
  }
  window.IB08P = { checkPage, disposeStep1, disposeStep2 }; // local verifier entry points
})();
