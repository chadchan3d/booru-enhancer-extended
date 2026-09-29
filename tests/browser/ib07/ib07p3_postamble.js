/* IB07P3 RULE34/E621/E926 PRODUCTION CONFORMANCE POSTAMBLE — test code, not production.
 * The production body above runs verbatim inside IB07P_PRODUCTION_BODY.
 * Scope: IB07 G-HOST production conformance for the admitted native contexts:
 * Rule34 listing and image post; e621 and e926 listing and image post.
 * Read-only: no clicks, no navigation, no requests of its own, no production
 * preference access. The result holds only check statuses, booleans, counts,
 * code constants and enums; no URL, id, hash, tag, title or host value. */
(() => {
  'use strict';

  const RESULT_KEY = 'ib07p3:last-result:v1';
  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function () {\n';
  const OBSERVE_MS = 5000;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const BE = window.BE;

  // Request observation, as in the qualified Gelbooru postamble: BE.net looks
  // up BE.runtime.request / nativeFetch at call time. Counts only.
  const requests = { total: 0, sameOrigin: 0, crossOrigin: 0, unparsable: 0, byTransport: { request: 0, nativeFetch: 0 } };
  function recordRequest(transport, url) {
    requests.total++;
    requests.byTransport[transport]++;
    try {
      if (new URL(String(url), location.href).origin === location.origin) requests.sameOrigin++;
      else requests.crossOrigin++;
    } catch { requests.unparsable++; }
  }
  function wrapTransport(name) {
    const original = BE?.runtime?.[name];
    if (typeof original !== 'function') return false;
    BE.runtime[name] = function wrappedTransport(...args) {
      recordRequest(name, name === 'request' ? args[0]?.url : args[0]);
      return original.apply(this, args);
    };
    return true;
  }
  function netSnapshot() {
    const d = BE?.net?._debug;
    return d ? { queueLength: Number(d.queueLength) || 0, inFlightReadCount: Number(d.inFlightReadCount) || 0 } : null;
  }
  const netAtPostambleLoad = netSnapshot();
  const transportsWrapped = { request: wrapTransport('request'), nativeFetch: wrapTransport('nativeFetch') };

  // C00: hash of the executed production wrapper's source text (method
  // qualified by the Gelbooru run; GM_info exposes no script source).
  async function sourceIdentity() {
    if (typeof IB07P_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB07P_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const body = text.slice(WRAP_FN_HEAD.length, -1);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  async function waitForAdapter(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (BE?.adapters?.active) return BE.adapters.active;
      await sleep(100);
    }
    return BE?.adapters?.active || null;
  }

  function show(text) {
    document.querySelector('#ib07p3-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib07p3-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'width:100%;height:75vh;background:#000;color:#eee';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.onclick = () => root.remove();
    root.append(ta, close);
    document.body.appendChild(root);
    ta.focus();
    ta.select();
  }

  // ---- helpers (all comparisons in memory) ----------------------------------
  const same = (a, b) => { try { return !!a && !!b && new URL(a, location.href).href === new URL(b, location.href).href; } catch { return false; } };
  const attr = (el, n) => (el && el.hasAttribute(n) ? el.getAttribute(n) : null);
  const num = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : Number(v));
  const status = (cond) => (cond ? 'PASS' : 'FAIL');
  const HOSTS = { 'rule34.xxx': 'rule34.xxx', 'e621.net': 'e621.net', 'e926.net': 'e926.net' };
  const EXPECTED_ADAPTER = { 'rule34.xxx': 'gelbooru-family', 'e621.net': 'e621', 'e926.net': 'e621' };

  function routeOf(site) {
    const p = new URLSearchParams(location.search);
    if (site === 'rule34.xxx') {
      if (p.get('page') === 'post' && p.get('s') === 'view' && p.get('id')) return { context: 'post-view', routeId: p.get('id') };
      if (p.get('page') === 'post' && p.get('s') === 'list') return { context: 'listing', routeId: null };
      return { context: 'other', routeId: null };
    }
    const m = location.pathname.match(/^\/posts\/(\d+)/);
    if (m) return { context: 'post-view', routeId: m[1] };
    if (/^\/(posts)?\/?$/.test(location.pathname)) return { context: 'listing', routeId: null };
    return { context: 'other', routeId: null };
  }

  const UNKNOWN_FIELDS = (post) => ({
    fileSize: post.fileSize === 0,
    md5: post.md5 === '',
    createdAt: post.createdAt === '',
    favCount: post.favCount === 0,
    preview: post.previewUrl === '',
    categoryArrays: ['artists', 'characters', 'copyrights', 'generalTags', 'metaTags'].every((k) => Array.isArray(post[k]) && post[k].length === 0),
  });

  // ---- Rule34 --------------------------------------------------------------
  async function rule34Post(ctx, adapter, check) {
    const img = document.querySelector('img#image');
    const nativeSample = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
    const anchors = [...document.querySelectorAll('a[href]')];
    const originalLink = anchors.find((a) => (a.textContent || '').trim().toLowerCase() === 'original image'
      || /\/images\/[^?#]+/i.test(a.getAttribute('href') || '')) || null;
    const nativeOriginal = originalLink ? originalLink.href : '';
    const statsText = [...document.querySelectorAll('li, dd, dt, #stats, .stats')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
    const size = statsText.match(/\bSize:\s*(\d+)\s*x\s*(\d+)\b/i);
    const nativeBefore = { sample: nativeSample, links: anchors.length };

    const before = requests.total;
    const post = await adapter.fetchPost(ctx.routeId);
    const other = await adapter.fetchPost('0');
    const requestsDuringPost = requests.total - before;

    const imgAfter = document.querySelector('img#image');
    const nativeUnchanged = !!imgAfter && (imgAfter.currentSrc || imgAfter.getAttribute('src') || '') === nativeBefore.sample
      && document.querySelectorAll('a[href]').length === nativeBefore.links;
    let postUrlSameRoute = false;
    if (post) { try { const u = new URL(post.postUrl); postUrlSameRoute = u.origin === location.origin && u.searchParams.get('id') === ctx.routeId && u.searchParams.get('s') === 'view'; } catch { /* stays false */ } }
    const unknown = post ? UNKNOWN_FIELDS(post) : null;

    check('R03', 'production produces a Post on the qualified image-post route', status(!!post));
    check('R04', 'identity: Post id and URL agree with the route; another id gives no Post', status(!!post && String(post.id) === ctx.routeId && postUrlSameRoute && other === null));
    check('R05', 'sample slot holds the native img#image resource', status(!!post && !!nativeSample && post.sampleUrl === nativeSample));
    check('R06', 'original slot: native original link target when present, empty when absent (fail closed)',
      status(!!post && (originalLink ? same(post.originalUrl, nativeOriginal) : post.originalUrl === '')), { nativeOriginalLinkPresent: !!originalLink });
    check('R07', 'sample and original stay distinct when the native page exposes distinct resources',
      post && originalLink && nativeSample && !same(nativeSample, nativeOriginal) ? status(!same(post.sampleUrl, post.originalUrl)) : 'NOT_APPLICABLE');
    check('R08', 'original dimensions come from the native Statistics size',
      size ? status(!!post && post.width === Number(size[1]) && post.height === Number(size[2])) : 'UNAVAILABLE', { statisticsSizePresent: !!size });
    check('R09', 'unobserved fields stay unknown (file size, md5, date, favorites, preview, category arrays)',
      status(!!unknown && Object.values(unknown).every(Boolean)), { unknownKept: unknown });
    check('R10', 'native page untouched by Post production', status(nativeUnchanged));
    check('R11', 'Post carries the canonical site identity rule34', status(!!post && post.siteId === 'rule34'));
    check('R12', 'Post records the known single-item count (pageCount === 1)', status(!!post && post.pageCount === 1));
    return { requestsDuringPost, observations: { siteId: post ? post.siteId : null, mediaType: post ? post.mediaType : null, nativeOriginalLinkPresent: !!originalLink, statisticsSizePresent: !!size } };
  }

  async function rule34Listing(ctx, adapter, check) {
    const imgs = adapter.getThumbElements(document);
    let mismatches = 0;
    let firstId = null;
    for (const img of imgs) {
      const a = img.closest('a');
      const href = a ? (a.getAttribute('href') || '') : '';
      const nativeId = (href.match(/[?&]id=(\d+)/) || [])[1] || ((a && a.id) || '').replace(/^p(\d+)$/, '$1') || null;
      const got = adapter.getThumbPostId(img);
      if (!nativeId || String(got) !== String(nativeId)) mismatches++;
      if (!firstId && nativeId) firstId = nativeId;
    }
    const before = requests.total;
    const listingPost = firstId ? await adapter.fetchPost(firstId) : undefined;
    const requestsDuringPost = requests.total - before;
    check('L03', 'native cards are recognized by the adapter', status(imgs.length > 0), { cards: imgs.length });
    check('L04', 'card identity agrees with the native post link', status(imgs.length > 0 && mismatches === 0), { mismatches });
    check('L05', 'no Post is built from a listing card (enrichment deferred; nothing guessed)', firstId ? status(listingPost === null) : 'UNAVAILABLE');
    return { requestsDuringPost, observations: { cards: imgs.length, identityMismatches: mismatches } };
  }

  // ---- e621 / e926 -----------------------------------------------------------
  const RATING = { s: 'safe', q: 'questionable', e: 'explicit' };
  function e6Mismatches(el, post, postPage) {
    const file = attr(el, 'data-file-url') || '';
    const sampleAttr = attr(el, 'data-sample-url');
    const sample = sampleAttr || '';
    const m = {
      identity: String(post.id) !== String(attr(el, 'data-id')),
      original: file ? !same(post.originalUrl, file) : post.originalUrl !== '',
      sample: sample ? !same(post.sampleUrl, sample) : post.sampleUrl !== '',
      relation: sample && file ? (same(sample, file) !== same(post.sampleUrl, post.originalUrl)) : false,
      facts: post.width !== (num(attr(el, 'data-width')) || 0) || post.height !== (num(attr(el, 'data-height')) || 0)
        || post.fileSize !== (num(attr(el, 'data-size')) || 0) || post.md5 !== (attr(el, 'data-md5') || '')
        || post.score !== (num(attr(el, 'data-score')) || 0) || post.rating !== (RATING[attr(el, 'data-rating')] || 'unknown'),
      site: post.siteId !== (location.hostname === 'e926.net' ? 'e926' : 'e621'),
      allTags: post.allTags.length !== String(attr(el, 'data-tags') || '').split(/\s+/).filter(Boolean).length,
    };
    if (postPage) {
      const preview = attr(el, 'data-preview-webp') || attr(el, 'data-preview-url') || '';
      m.preview = preview ? !same(post.previewUrl, preview) : false;
      const rows = [...document.querySelectorAll('#tag-list li.tag-list-item[data-category][data-name]')];
      const count = (c) => rows.filter((r) => r.getAttribute('data-category') === c).length;
      m.categories = post.artists.length !== count('artist') || post.characters.length !== count('character')
        || post.copyrights.length !== count('copyright') || post.generalTags.length !== count('general') || post.metaTags.length !== count('meta');
      const src = document.querySelector('#post-information li.source-links .source-link a[href]');
      m.source = src ? !same(post.source, src.href) : post.source !== '';
    }
    return { m, sampleState: sampleAttr === null ? 'absent' : sample ? (file && same(sample, file) ? 'equals-file' : 'distinct') : 'empty' };
  }

  async function e6Post(ctx, adapter, check) {
    const c = document.querySelector('#image-container[data-id]');
    const before = requests.total;
    const post = c ? await adapter.fetchPost(ctx.routeId) : null;
    const other = c ? await adapter.fetchPost('0') : null;
    const requestsDuringPost = requests.total - before;
    const r = post && c ? e6Mismatches(c, post, true) : null;
    check('E03', 'production produces a Post on the qualified image-post route', status(!!post));
    check('E04', 'identity: Post id equals the route id and the native container id; another id gives no Post',
      status(!!post && String(post.id) === ctx.routeId && String(attr(c, 'data-id')) === ctx.routeId && !!r && !r.m.identity && other === null));
    check('E05', 'original slot equals native data-file-url', status(!!r && !r.m.original));
    check('E06', 'sample slot equals native data-sample-url when present, empty when absent (fail closed)', status(!!r && !r.m.sample), { sampleState: r ? r.sampleState : null });
    check('E07', 'sample/original relation matches native (explicit equality kept, distinct kept distinct)', status(!!r && !r.m.relation));
    check('E08', 'native file facts (dimensions, size, md5, score, rating), site and tags reach the Post', status(!!r && !r.m.facts && !r.m.site && !r.m.allTags));
    check('E09', 'preview, tag categories and source come from their native elements', status(!!r && !r.m.preview && !r.m.categories && !r.m.source));
    check('E10', 'Post records the known single-item count (pageCount === 1)', status(!!post && post.pageCount === 1));
    return { requestsDuringPost, observations: { sampleState: r ? r.sampleState : null } };
  }

  async function e6Listing(ctx, adapter, check) {
    const cards = [...new Set(document.querySelectorAll('article.thumbnail, article.post-preview, article[data-id]'))].filter((el) => attr(el, 'data-id'));
    const ids = cards.map((el) => attr(el, 'data-id'));
    const before = requests.total;
    const posts = ids.length ? await adapter.fetchThumbBatch(ids) : [];
    const onDemand = ids.length ? await adapter.fetchPost(ids[0]) : null;
    const missing = ids.length ? await adapter.fetchPost('0') : null;
    const requestsDuringPost = requests.total - before;
    const byId = new Map((posts || []).map((p) => [String(p.id), p]));
    const counts = { cards: cards.length, postsReturned: byId.size, identity: 0, original: 0, sample: 0, relation: 0, facts: 0, site: 0, allTags: 0,
      sampleDistinct: 0, sampleEqualsFile: 0, sampleAbsent: 0, sampleEmpty: 0, pageCountNotOne: 0 };
    for (const el of cards) {
      const post = byId.get(String(attr(el, 'data-id')));
      if (!post) { counts.identity++; continue; }
      if (post.pageCount !== 1) counts.pageCountNotOne++;
      const r = e6Mismatches(el, post, false);
      for (const k of ['identity', 'original', 'sample', 'relation', 'facts', 'site', 'allTags']) if (r.m[k]) counts[k]++;
      counts[{ distinct: 'sampleDistinct', 'equals-file': 'sampleEqualsFile', absent: 'sampleAbsent', empty: 'sampleEmpty' }[r.sampleState]]++;
    }
    const onDemandSame = !!onDemand && !!byId.get(String(onDemand.id)) && JSON.stringify(onDemand) === JSON.stringify(byId.get(String(onDemand.id)));
    check('EL03', 'native cards produce Posts through the production batch path', status(cards.length > 0 && byId.size === cards.length), { cards: cards.length, postsReturned: byId.size });
    check('EL04', 'identity: every Post matches its card id; on-demand Post equals batch Post; unknown id gives no Post',
      status(cards.length > 0 && counts.identity === 0 && onDemandSame && missing === null));
    check('EL05', 'original slot equals native data-file-url on every card', status(cards.length > 0 && counts.original === 0), { mismatches: counts.original });
    check('EL06', 'sample slot equals native data-sample-url when present, empty when absent (fail closed)', status(cards.length > 0 && counts.sample === 0), { mismatches: counts.sample });
    check('EL07', 'sample/original relation matches native on every card', status(cards.length > 0 && counts.relation === 0), { mismatches: counts.relation });
    check('EL08', 'native file facts, site and tags reach every Post', status(cards.length > 0 && counts.facts === 0 && counts.site === 0 && counts.allTags === 0));
    check('EL09', 'every card Post records the known single-item count (pageCount === 1)', status(cards.length > 0 && counts.pageCountNotOne === 0), { mismatches: counts.pageCountNotOne });
    return { requestsDuringPost, observations: counts };
  }

  // ---- run ----------------------------------------------------------------
  async function run() {
    const checks = [];
    const check = (id, name, st, detail = null) => checks.push({ id, name, status: st, detail });
    const identity = await sourceIdentity();
    const adapter = await waitForAdapter(10000);
    const site = HOSTS[location.hostname.replace(/^www\./, '')] || null;
    const ctx = site ? routeOf(site) : { context: 'other', routeId: null };

    check('C00', 'browser runs the expected production body', identity === 'MATCH_EXPECTED_ARTIFACT' ? 'PASS' : 'FAIL', identity);
    check('C01', 'qualified host and context', status(!!site && (ctx.context === 'post-view' || ctx.context === 'listing')), ctx.context);
    const isPost = !!(adapter && typeof adapter.isPostPage === 'function' && adapter.isPostPage());
    check('C02', 'expected adapter active, post-page detection agrees with the context',
      status(!!site && adapter?.id === EXPECTED_ADAPTER[site] && isPost === (ctx.context === 'post-view')), adapter?.id || null);

    let hostResult = { requestsDuringPost: 0, observations: null };
    if (site && adapter && adapter.id === EXPECTED_ADAPTER[site]) {
      try {
        if (site === 'rule34.xxx') hostResult = ctx.context === 'post-view' ? await rule34Post(ctx, adapter, check) : ctx.context === 'listing' ? await rule34Listing(ctx, adapter, check) : hostResult;
        else hostResult = ctx.context === 'post-view' ? await e6Post(ctx, adapter, check) : ctx.context === 'listing' ? await e6Listing(ctx, adapter, check) : hostResult;
      } catch (error) {
        check('X01', 'host checks completed without error', 'FAIL', error?.name || 'Error');
      }
    }

    await sleep(OBSERVE_MS);
    check('C13', 'no enhancer request while producing Posts', status(transportsWrapped.request && transportsWrapped.nativeFetch && hostResult.requestsDuringPost === 0));
    check('C14', 'no enhancer request from postamble load through the observation window', status(requests.total === 0));

    const failed = checks.filter((c) => c.status === 'FAIL');
    const result = {
      probe: { name: 'IB07 Rule34/e621/e926 Production Conformance', version: '1.0.0', productionVersion: BE?.VERSION || null },
      environment: {
        userAgent: navigator.userAgent,
        gmInfo: typeof GM_info !== 'undefined' ? { scriptHandler: GM_info.scriptHandler, version: GM_info.version } : null,
      },
      site,
      context: ctx.context,
      sourceContract: {
        productionArtifact: 'IB07 production with slot-inference restriction',
        productionBodyIdentity: identity,
        identityMethod: 'SHA-256 of Function.prototype.toString of the executed production wrapper, compared in-browser with the expected body',
        metadataChange: 'unique test userscript identity; @match and @connect narrowed to rule34.xxx, e621.net, e926.net; public update targets removed; production body run inside a named wrapper function; test postamble appended',
      },
      summary: { checks: checks.length, failed: failed.length, status: failed.length ? 'FAIL' : 'PASS' },
      checks,
      observations: {
        host: hostResult.observations,
        requests: {
          transportsWrapped,
          duringPostProduction: hostResult.requestsDuringPost,
          sincePostambleLoad: { ...requests, byTransport: { ...requests.byTransport } },
          observationWindowMs: OBSERVE_MS,
          netAtPostambleLoad,
          netAtEnd: netSnapshot(),
          limitation: 'requests issued synchronously during startup, before this postamble loaded, are not counted; netAtPostambleLoad shows any still queued or in flight',
        },
      },
      boundaries: {
        liveSite: true,
        scope: 'IB07 G-HOST production conformance: native listing and image post',
        productionPreferences: false,
        notTested: ['video/GIF', 'pagination', 'hover', 'favorite/action', 'download', 'rendition policy', 'Gelbooru and other family hosts'],
      },
    };
    const text = JSON.stringify(result, null, 2);
    GM_setValue(RESULT_KEY, text);
    console.log(text);
    show(text);
    return result;
  }

  GM_registerMenuCommand('IB07P3: Run production conformance on this page', () => run());
  GM_registerMenuCommand('IB07P3: Show/export last result', () => show(GM_getValue(RESULT_KEY, '') || JSON.stringify({ error: 'No completed run yet.' }, null, 2)));
})();
