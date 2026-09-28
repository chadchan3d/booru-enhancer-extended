/* Gelbooru V1-N passive probe — IB07 G-HOST evidence only.
 * Read-only DOM observation. No fetch/XHR, no clicks, no favorite/account
 * mutation, no cookie/localStorage access. Every value below is sanitized
 * at the point of extraction: nothing raw is ever assigned to a variable
 * before its placeholder substitution runs.
 *
 * Placeholders used (per AGENTS.md sanitation policy):
 *   <id>        - a post's own identity (query id=, anchor p<digits>,
 *                 [data-id]/[data-post-id])
 *   <hash>      - a 32/40-char hex content hash (MD5/SHA1) in a path
 *   <bucket>    - a 2-hex-char directory derived from the content hash
 *   <handle>    - the first path segment of an external Source link
 *   <segment>   - any later external Source path segment that is not a
 *                 known structural word (usernames, titles, slugs)
 *   <host>      - any cross-origin host; origin is never printed, only
 *                 whether it is same-origin or external
 *   (query strings are always dropped, never inspected - signed/tokenized
 *   media URLs must not be committed per IB07_HOST_FACTS.md "Evidence expected")
 *
 * Pagination cursor values (Gelbooru/Rule34 pid=) are NOT a post identity
 * and are left literal, consistent with the already-committed Rule34 V1-N
 * record ("href shape: ?page=post&s=list&pid=42").
 */
(() => {
  'use strict';
  if (!/(^|\.)gelbooru\.com$/.test(location.hostname)) {
    console.error('gelbooru-v1n: not on gelbooru.com - aborting, no data read.');
    return;
  }

  const params = new URLSearchParams(location.search);
  const mode = params.get('page') === 'post' && params.get('s') === 'list' ? 'listing'
             : params.get('page') === 'post' && params.get('s') === 'view' ? 'post'
             : 'unrecognized';

  const HASH_RE = /[0-9a-fA-F]{32,40}/g;
  const ID_RE = /(?<=[=/_])\d{3,}(?=[/?&._-]|$)/g;
  const BUCKET_RE = /^[0-9a-fA-F]{2}$/;

  function shapeSameOrigin(rawUrl) {
    if (!rawUrl) return null;
    let u;
    try { u = new URL(rawUrl, location.href); } catch { return null; }
    // Hash-prefix bucket directories are replaced per segment first; the
    // placeholder contains no digits or hex runs for the later passes.
    const path = u.pathname.split('/')
      .map((seg) => (BUCKET_RE.test(seg) ? '<bucket>' : seg))
      .join('/')
      .replace(HASH_RE, '<hash>')
      .replace(ID_RE, '<id>');
    return { sameOrigin: u.origin === location.origin, host: u.origin === location.origin ? u.host : '<host>', pathShape: path };
  }

  // External Source links are shaped by allowlist, not by pattern: only
  // known structural words stay literal. Every other segment is redacted
  // whatever its position, so a handle, title or slug cannot survive.
  const STRUCTURAL_SEGMENTS = new Set(['status', 'statuses', 'i', 'web', 'user', 'users', 'artworks', 'art', 'posts', 'post', 'p', 'illust', 'member', 'members', 'gallery', 'view', 'show', 'works', 'image', 'images', 'media', 'photo', 'photos']);

  function shapeExternal(rawText) {
    if (!rawText) return null;
    // Source values may be displayed without a scheme ("host/path"). Without
    // one, URL() resolves the text relative to this page and the real host
    // becomes the first path segment, shifting the handle to the second.
    let raw = String(rawText).trim();
    const hadScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    if (!hadScheme) raw = `https://${raw.replace(/^\/+/, '')}`;
    let u;
    try { u = new URL(raw); } catch { return null; }
    const path = u.pathname.split('/').map((seg, i) => {
      if (seg === '') return seg;
      if (/^\d+$/.test(seg)) return '<id>';
      if (/^[0-9a-fA-F]{32,40}$/.test(seg)) return '<hash>';
      if (STRUCTURAL_SEGMENTS.has(seg.toLowerCase())) return seg.toLowerCase();
      return i === 1 ? '<handle>' : '<segment>';
    }).join('/');
    return { host: '<host>', schemeShown: hadScheme, pathShape: path || '/' };
  }

  // Mirrors gelbooruPostId() in Booru_Enhancer.user.js (already-shipped,
  // currently-unwired candidate) - reports WHICH strategy resolved, not
  // the resolved value.
  function identityStrategy(el) {
    const a = el.closest('a');
    const href = a?.getAttribute('href') || '';
    if (/[?&]id=\d+/.test(href)) return 'href-id-param';
    if (/^p\d+$/.test(a?.id || '')) return 'anchor-id';
    const wrapper = el.closest('[data-id], [data-post-id]');
    if (wrapper) return 'data-attribute';
    if (/\d+/.test(el.id || '')) return 'element-id';
    return null;
  }

  const out = { probe: 'gelbooru-v1n', mode, pathParamsPresent: [...params.keys()] };

  if (mode === 'listing') {
    const containerSel = ['#post-list-posts', '#post-list', '.content'].find((s) => document.querySelector(s));
    const thumbs = [...document.querySelectorAll(
      '.thumbnail-preview img, article.thumbnail-preview img, span.thumb img, #post-list img.preview, #post-list-posts img, .thumb img',
    )];
    out.gallery = { containerSelectorMatched: containerSel || null, thumbCount: thumbs.length };
    out.cards = thumbs.slice(0, 3).map((img) => ({
      identityStrategy: identityStrategy(img),
      thumbnailUrl: shapeSameOrigin(img.currentSrc || img.getAttribute('src') || ''),
      altTextPresent: !!(img.getAttribute('alt') || '').trim(),
      titleTextPresent: !!(img.getAttribute('title') || '').trim(),
    }));

    const nextSel = ['#paginator a[alt="next"]', '#paginator a[title="next"]', '#paginator a.next',
      '.pagination a[alt="next"]', '.pagination a[title="next"]', '.pagination a.next',
      'a[alt="next"]', 'a[rel="next"]', 'a.next'].find((s) => document.querySelector(s));
    const nextEl = nextSel ? document.querySelector(nextSel) : null;
    let nextParams = [];
    if (nextEl) {
      try { nextParams = [...new URL(nextEl.href, location.href).searchParams.keys()]; } catch { /* ignore */ }
    }
    out.pagination = { matchedSelector: nextSel || null, nextLinkParamNames: nextParams };
  }

  if (mode === 'post') {
    out.postIdentity = { resolvedFromQueryIdParam: params.has('id') };

    const img = document.querySelector('#image, img#image');
    const video = document.querySelector('video source, video#gelcomVideoPlayer source, video');
    out.media = {
      imageSelectorMatched: !!img,
      videoSelectorMatched: !!video,
      imageSrc: img ? shapeSameOrigin(img.currentSrc || img.getAttribute('src') || '') : null,
      videoSrc: video ? shapeSameOrigin(video.currentSrc || video.getAttribute('src') || '') : null,
      naturalWidth: img?.naturalWidth || null,
      naturalHeight: img?.naturalHeight || null,
    };

    const origSel = ['a.download-link', 'a[download]', 'li a[href*="/samples/"]', 'li a[href*="/images/"]']
      .find((s) => document.querySelector(s));
    const origEl = origSel ? document.querySelector(origSel) : null;
    out.originalLink = { matchedSelector: origSel || null, hrefShape: origEl ? shapeSameOrigin(origEl.href) : null };

    const tagLis = [...document.querySelectorAll('.tag-list li, #tag-sidebar li, li[class*="tag-type-"]')];
    const knownCategoryPatterns = ['tag-type-artist', 'tag-type-character', 'tag-type-copyright', 'tag-type-general', 'tag-type-metadata', 'category-0', 'category-1', 'category-3', 'category-4', 'category-5', 'category-6'];
    out.tags = {
      anySelectorMatched: tagLis.length > 0,
      totalCount: tagLis.length,
      categoryClassPatternsObserved: knownCategoryPatterns.filter((p) => tagLis.some((li) => (li.className || '').includes(p))),
    };

    const ratingEl = document.querySelector('[id*="rating"]');
    const ratingText = (ratingEl?.textContent || '').toLowerCase();
    out.rating = {
      selectorMatched: !!ratingEl,
      bucket: ratingText.includes('explicit') ? 'explicit' : ratingText.includes('question') ? 'questionable' : ratingText.includes('safe') ? 'safe' : 'unknown',
    };

    const statsText = [...document.querySelectorAll('li, dd, dt, #stats, .stats, #tag-sidebar')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
    const sizeMatch = statsText.match(/\bSize:\s*(\d+)\s*x\s*(\d+)\b/i);
    const scoreMatch = statsText.match(/\bScore:\s*(-?\d+)/i);
    const sourceMatch = statsText.match(/\bSource:\s*(\S[^|]*)/i);
    out.statsBlock = {
      sizeFound: !!sizeMatch,
      width: sizeMatch ? Number(sizeMatch[1]) : null,
      height: sizeMatch ? Number(sizeMatch[2]) : null,
      scoreFound: !!scoreMatch,
      score: scoreMatch ? Number(scoreMatch[1]) : null,
      dateFound: /\bPosted:|\bDate:/i.test(statsText),
      sourceFound: !!sourceMatch,
      sourceShape: sourceMatch ? shapeExternal(sourceMatch[1].trim()) : null,
    };

    const loginLinkPresent = [...document.querySelectorAll('a[href]')].some((a) => {
      const href = a.getAttribute('href') || '';
      return (/page=account/.test(href) && /s=login/.test(href)) || /\/login(?:[/?]|$)/.test(href);
    });
    out.accountContext = {
      loginLinkPresent,
      possibleAccountIndicatorPresent: !!document.querySelector('[class*="user"], [id*="user"]'),
    };
  }

  console.log(JSON.stringify(out, null, 2));
})();
