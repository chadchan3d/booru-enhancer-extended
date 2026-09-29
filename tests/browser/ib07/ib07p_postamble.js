/* IB07P GELBOORU PRODUCTION CONFORMANCE POSTAMBLE — test code, not production.
 * The production body above is retained verbatim from the committed production artifact.
 * Scope: IB07 G-HOST production conformance for the logged-out Gelbooru
 * native image-post path only. Read-only: no clicks, no storage reads of
 * production preferences, no requests of its own. Every reported value is a
 * boolean, a count, a code constant or an allowed numeric fact (dimensions,
 * score); no URL, post ID, hash, tag text or host is ever placed in the result. */
(() => {
  'use strict';

  const RESULT_KEY = 'ib07p:last-result:v1';
  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function () {\n';
  const OBSERVE_MS = 5000;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const BE = window.BE;

  // Request observation. BE.net looks up BE.runtime.request and
  // BE.runtime.nativeFetch at call time, so wrapping them here sees every
  // enhancer request issued after this postamble loads. Only counts and a
  // same-origin/cross-origin class are kept; URLs are never stored.
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

  const isImageExt = (url) => ['jpg', 'jpeg', 'png', 'webp', 'bmp']
    .includes((String(url).split('?')[0].split('.').pop() || '').toLowerCase());

  // Identity of the executed production body. The build runs the production
  // body inside IB07P_PRODUCTION_BODY; Function.prototype.toString returns the
  // exact source text the engine parsed for that function, so the hash covers
  // the code that actually ran, not a declared label. (Tampermonkey's GM_info
  // exposes no full script source, which is why the earlier method was
  // UNAVAILABLE.) Only CRLF is normalized, in case the manager stored one.
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
    document.querySelector('#ib07p-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib07p-result';
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

  async function run() {
    const checks = [];
    const check = (id, name, status, detail = null) => checks.push({ id, name, status, detail });
    const pass = (cond) => (cond ? 'PASS' : 'FAIL');

    const identity = await sourceIdentity();
    const adapter = await waitForAdapter(10000);

    const params = new URLSearchParams(location.search);
    const routeId = params.get('id') || '';
    const route = {
      hostIsGelbooru: /(^|\.)gelbooru\.com$/.test(location.hostname),
      isImagePostRoute: params.get('page') === 'post' && params.get('s') === 'view',
      routeIdPresent: !!routeId,
    };

    // Native reference facts from the live page. Raw values stay in memory
    // for comparison only and never enter the result.
    const img = document.querySelector('img#image');
    const nativeSample = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
    const nativeOriginal = document.querySelector('li a[href*="/images/"]')?.href || '';
    const videoElements = document.querySelectorAll('video').length;
    const statsText = [...document.querySelectorAll('li, dd, dt, #stats, .stats, #tag-sidebar')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
    const sizeMatch = statsText.match(/\bSize:\s*(\d+)\s*x\s*(\d+)\b/i);
    const scoreMatch = statsText.match(/\bScore:\s*(-?\d+)/i);

    const activation = {
      adapterId: adapter?.id || null,
      isPostPage: !!(adapter && typeof adapter.isPostPage === 'function' && adapter.isPostPage()),
      adapterPostIdMatchesRoute: !!routeId && String(adapter?.getPostId?.() ?? '') === routeId,
    };

    // The same public adapter sequence production's getCurrentPost() uses.
    const requestsBeforeFetch = requests.total;
    let post = null;
    let fetchError = null;
    try {
      if (activation.isPostPage) post = await adapter.fetchPost(adapter.getPostId());
    } catch (error) {
      fetchError = error?.name || 'Error';
    }
    const requestsDuringFetchPost = requests.total - requestsBeforeFetch;

    const outcome = post
      ? (post.siteId === 'gelbooru' ? 'GELBOORU_MINIMAL_POST' : 'OTHER_POST_PATH')
      : (fetchError ? 'ERROR' : 'NULL_NATIVE_ONLY');

    const guards = {
      hostIsGelbooru: route.hostIsGelbooru,
      isImagePostRoute: route.isImagePostRoute,
      routeIdPresent: route.routeIdPresent,
      nativeImagePresent: !!img,
      videoElementPresent: videoElements > 0,
      nativeSampleIsImageExtension: !!nativeSample && isImageExt(nativeSample),
      nativeOriginalAbsentOrImageExtension: !nativeOriginal || isImageExt(nativeOriginal),
    };

    let postFacts = null;
    if (post) {
      let postUrlIsSameViewRoute = false;
      try {
        const u = new URL(post.postUrl);
        postUrlIsSameViewRoute = u.origin === location.origin && u.searchParams.get('page') === 'post'
          && u.searchParams.get('s') === 'view' && u.searchParams.get('id') === routeId;
      } catch { postUrlIsSameViewRoute = false; }
      const tagArrays = ['allTags', 'artists', 'characters', 'copyrights', 'generalTags', 'metaTags'];
      postFacts = {
        siteIsGelbooru: post.siteId === 'gelbooru',
        mediaKindIsImage: post.mediaType === 'image',
        idMatchesRoute: String(post.id) === routeId,
        postUrlIsSameViewRoute,
        samplePopulated: !!post.sampleUrl,
        sampleEqualsNativeImage: !!post.sampleUrl && post.sampleUrl === nativeSample,
        originalPopulated: !!post.originalUrl,
        originalEqualsNativeOriginalLink: !!post.originalUrl && post.originalUrl === nativeOriginal,
        nativeExposesDistinctSampleAndOriginal: !!nativeSample && !!nativeOriginal && nativeSample !== nativeOriginal,
        sampleAndOriginalDistinct: !!post.sampleUrl && !!post.originalUrl && post.sampleUrl !== post.originalUrl,
        originalNotFabricatedFromSample: post.originalUrl === ''
          || (post.originalUrl === nativeOriginal && (post.originalUrl !== post.sampleUrl || nativeOriginal === nativeSample)),
        width: Number(post.width) || 0,
        height: Number(post.height) || 0,
        score: Number(post.score) || 0,
        nativeStatisticsHasSize: !!sizeMatch,
        nativeStatisticsHasScore: !!scoreMatch,
        dimensionsMatchNativeStatistics: !!sizeMatch && post.width === Number(sizeMatch[1]) && post.height === Number(sizeMatch[2]),
        scoreMatchesNativeStatistics: !!scoreMatch && post.score === Number(scoreMatch[1]),
        pageCountIsOne: post.pageCount === 1,
        dimensionsDifferFromRenderedSample: img ? (post.width !== img.naturalWidth || post.height !== img.naturalHeight) : null,
        unknownKept: {
          rating: post.rating === 'unknown',
          byteSize: post.fileSize === 0,
          md5: post.md5 === '',
          source: post.source === '',
          date: post.createdAt === '',
          preview: post.previewUrl === '',
          tagArrays: tagArrays.every((k) => Array.isArray(post[k]) && post[k].length === 0),
        },
      };
    }

    await sleep(OBSERVE_MS);
    const netAtEnd = netSnapshot();

    check('C00', 'browser runs the expected production body', identity === 'MATCH_EXPECTED_ARTIFACT' ? 'PASS' : 'FAIL', identity);
    check('C01', 'qualified route: gelbooru.com image-post view with id', pass(route.hostIsGelbooru && route.isImagePostRoute && route.routeIdPresent));
    check('C02', 'production activates the gelbooru-family adapter on the post page', pass(activation.adapterId === 'gelbooru-family' && activation.isPostPage));
    check('C03', 'production produces the Gelbooru minimal Post (not null/native-only)', pass(outcome === 'GELBOORU_MINIMAL_POST'), outcome);
    const f = postFacts;
    check('C04', 'identity resolves from the native page id and agrees with the route', pass(activation.adapterPostIdMatchesRoute && f?.idMatchesRoute && f?.postUrlIsSameViewRoute));
    check('C05', 'site is gelbooru and media kind is image', pass(f?.siteIsGelbooru && f?.mediaKindIsImage));
    check('C06', 'sample comes from the native img#image', pass(f?.samplePopulated && f?.sampleEqualsNativeImage));
    check('C07', 'original comes from the native original link', pass(f?.originalPopulated && f?.originalEqualsNativeOriginalLink));
    check('C08', 'sample and original stay distinct when the page exposes distinct resources',
      f ? (f.nativeExposesDistinctSampleAndOriginal ? pass(f.sampleAndOriginalDistinct) : 'NOT_APPLICABLE') : 'FAIL');
    check('C09', 'original is not fabricated from the sample', pass(f?.originalNotFabricatedFromSample));
    check('C10', 'original dimensions and score reach the Post from native statistics',
      pass(f?.dimensionsMatchNativeStatistics && f?.scoreMatchesNativeStatistics));
    check('C11', 'unobserved fields stay unknown', pass(f && Object.values(f.unknownKept).every(Boolean)));
    // Video is blamed only when every other guard of the production path holds.
    const disabledOnlyByVideo = !post && !fetchError && guards.videoElementPresent
      && guards.hostIsGelbooru && guards.isImagePostRoute && guards.routeIdPresent
      && activation.adapterPostIdMatchesRoute && guards.nativeImagePresent
      && guards.nativeSampleIsImageExtension && guards.nativeOriginalAbsentOrImageExtension;
    check('C12', 'fail-closed video check does not disable the image path',
      disabledOnlyByVideo ? 'FAIL' : 'PASS', { videoElementsInDocument: videoElements, disabledOnlyByVideo });
    check('C13', 'no enhancer request while producing the Post', pass(transportsWrapped.request && transportsWrapped.nativeFetch && requestsDuringFetchPost === 0));
    check('C14', 'no enhancer request from load through the observation window', pass(requests.total === 0));
    check('C15', 'Post records the known single-item count (pageCount === 1)', pass(f?.pageCountIsOne));

    const failed = checks.filter((c) => c.status === 'FAIL');
    const result = {
      probe: { name: 'IB07 Gelbooru Production Conformance', version: '1.0.0', productionVersion: BE?.VERSION || null },
      environment: {
        userAgent: navigator.userAgent,
        gmInfo: typeof GM_info !== 'undefined' ? { scriptHandler: GM_info.scriptHandler, version: GM_info.version } : null,
      },
      sourceContract: {
        productionCommit: 'c551bb0',
        productionBodyIdentity: identity,
        identityMethod: 'SHA-256 of Function.prototype.toString of the executed production wrapper, compared in-browser with the expected body',
        metadataChange: 'unique test userscript identity; @match and @connect narrowed to gelbooru.com; public update targets removed; production body run inside a named wrapper function; test postamble appended',
      },
      summary: { checks: checks.length, failed: failed.length, status: failed.length ? 'FAIL' : 'PASS' },
      checks,
      observations: {
        route,
        activation,
        outcome,
        fetchError,
        guards,
        postFacts,
        requests: {
          transportsWrapped,
          duringFetchPost: requestsDuringFetchPost,
          sincePostambleLoad: { ...requests, byTransport: { ...requests.byTransport } },
          observationWindowMs: OBSERVE_MS,
          netAtPostambleLoad,
          netAtEnd,
          limitation: 'requests issued synchronously during startup, before this postamble loaded, are not counted; netAtPostambleLoad shows any still queued or in flight',
        },
      },
      boundaries: {
        liveSite: true,
        host: 'gelbooru.com',
        context: 'operator-reported logged out',
        scope: 'IB07 G-HOST production conformance, native image post only',
        productionPreferences: false,
        notTested: ['video/GIF', 'pagination', 'hover', 'favorite/action', 'download', 'rendition policy', 'other Gelbooru-family hosts'],
      },
    };
    const text = JSON.stringify(result, null, 2);
    GM_setValue(RESULT_KEY, text);
    console.log(text);
    show(text);
    return result;
  }

  GM_registerMenuCommand('IB07P: Run Gelbooru production conformance', () => run());
  GM_registerMenuCommand('IB07P: Show/export last result', () => show(GM_getValue(RESULT_KEY, '') || JSON.stringify({ error: 'No completed run yet.' }, null, 2)));
})();
