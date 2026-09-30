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
 * counts only; a leak guard withholds anything carrying a captured value. */
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
  const log = []; // { phase, record }
  let phase = 'production';
  const keep = (r) => r.type === 'attributes' || (r.type === 'childList'
    && (r.target.localName === 'picture' || [...r.addedNodes, ...r.removedNodes].some((n) => ['picture', 'source', 'img'].includes(n.localName))));
  const recorder = new MutationObserver((recs) => { for (const r of recs) if (keep(r)) log.push({ phase, r }); });
  recorder.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: RENDITION_ATTRS, attributeOldValue: true });
  const flush = () => { for (const r of recorder.takeRecords()) if (keep(r)) log.push({ phase, r }); };

  async function sourceIdentity() {
    if (typeof IB07P_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB07P_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const body = text.slice(WRAP_FN_HEAD.length, -1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  function relation(img, n) {
    const url = img ? img.currentSrc || '' : '';
    if (!url) return 'UNKNOWN';
    for (const [label, v] of [['NATIVE_PREVIEW_WEBP', n.facts.webp], ['NATIVE_PREVIEW', n.facts.preview], ['NATIVE_SAMPLE', n.facts.sample], ['NATIVE_FILE', n.facts.file]]) if (v && v === url) return label;
    return 'UNKNOWN';
  }
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
    const prodWrites = log.filter((x) => x.phase === 'production').map((x) => x.r);
    const writesOn = (nodes) => prodWrites.filter((r) => nodes.includes(r.target));
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
    const unexplained = prodWrites.filter((r) => ![...native.values()].some((n) => [n.picture, n.img, ...n.sources].includes(r.target))).length;
    const settled = await waitForImages(sampled.map((s) => s.img));
    const relations = {};
    for (const s of sampled) {
      const rel = relation(s.img, s.n);
      relations[rel] = (relations[rel] || 0) + 1;
      if (rel !== expectedRelation[s.want]) counts.relationMismatch++;
    }
    check('P04', 'login marker recorded (data-user-is-anonymous)', marker === 'TRUE' || marker === 'FALSE', { marker });
    check('P05', 'every card reports the contract provenance for its pattern, login state and quality', counts.enumMismatch === 0, { byEnum });
    check('P06', loggedOut ? 'owned cards: exactly one write, on the WebP source srcset; all other cards: none' : 'logged in: zero rendition writes on any card', counts.writeMismatch === 0 && unexplained === 0, { writeMismatch: counts.writeMismatch, unexplainedWrites: unexplained, totalRenditionWrites: prodWrites.length });
    check('P07', 'final attributes: WebP srcset = expected native string; JPEG source, img and non-pattern cards unchanged', counts.stateMismatch === 0, { stateMismatch: counts.stateMismatch });
    check('P08', 'picture/source/img node identity unchanged on every card', counts.identityMismatch === 0, { identityMismatch: counts.identityMismatch });
    check('P09', 'displayed rendition (currentSrc) matches the quality on sampled in-view pattern cards', loggedOut ? (sampled.length > 0 && counts.relationMismatch === 0) : null, { sampled: sampled.length, relations, settled });
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
    disposeRun = { chosen, ownedTotal, viewportA: viewport(), disposeWrites: log.filter((x) => x.phase === 'dispose').map((x) => x.r) };
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
    check('D01', 'dispose writes only WebP-source srcset restorations, one per remaining owned card, no node operations',
      dw.length === expectedDisposeWrites && dw.every((r) => r.type === 'attributes' && r.attributeName === 'srcset' && r.target.getAttribute('srcset') === [...native.values()].find((n) => n.sources[0] === r.target)?.sourceAttrs[0][1]),
      { disposeWrites: dw.length, expected: expectedDisposeWrites });
    check('D02', 'control card restored and shows the native WebP preview', k1.sources[0].getAttribute('srcset') === c1.sourceAttrs[0][1] && relation(k1.img, c1) === 'NATIVE_PREVIEW_WEBP');
    check('D03', 'native edit kept through dispose', k2.sources[0] === c2.sources[0] && c2.sources[0].getAttribute('srcset') === c2.sourceAttrs[1][1] && relation(k2.img, c2) === 'NATIVE_PREVIEW');
    check('D04', 'moved source: native order kept, WebP srcset restored', k3.sources[0] === c3.sources[1] && k3.sources[1] === c3.sources[0] && c3.sources[0].getAttribute('srcset') === c3.sourceAttrs[0][1] && relation(k3.img, c3) === 'NATIVE_PREVIEW');
    check('D05', 'replaced source untouched and native', k4.sources[0] !== c4.sources[0] && JSON.stringify(attrsOf(k4.sources[0])) === JSON.stringify(c4.sourceAttrs[0]) && relation(k4.img, c4) === 'NATIVE_PREVIEW_WEBP');
    check('D06', 'replaced picture untouched and native', k5.pic !== c5.picture && JSON.stringify(k5.sources.map(attrsOf)) === JSON.stringify(c5.sourceAttrs) && relation(k5.img, c5) === 'NATIVE_PREVIEW_WEBP');
    const residue = [...document.querySelectorAll('article source, article img')].filter((el) => [...native.values()].some((n) => (n.sampleRaw && el.getAttribute('srcset') === n.sampleRaw) || (n.sampleRaw && el.getAttribute('src') === n.sampleRaw))).length;
    const restoredOthers = [...native.keys()].filter((a) => !disposeRun.chosen.includes(a)).every((a) => { const n = native.get(a); const c = cur(a); return JSON.stringify(c.sources.map(attrsOf)) === JSON.stringify(n.sourceAttrs) && JSON.stringify(attrsOf(c.img)) === JSON.stringify(n.imgAttrs); });
    check('D07', 'every other card is back to its native rendition attributes; no sample residue on connected nodes', restoredOthers && residue === 0, { residue });
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
