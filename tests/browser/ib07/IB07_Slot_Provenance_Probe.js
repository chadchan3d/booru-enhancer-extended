/* IB07 slot-provenance passive probe — G-HOST evidence only.
 * Resolves three INCONCLUSIVE §3 item 9 cases in
 * tests/host/ib07/item9-result.json:
 *   G3-3c-rule34.xxx  post page with img#image but no native Original link;
 *   G3-3d-e621.net    listing card without data-sample-url;
 *   G3-3d-e926.net    same, on e926.
 * Read-only: one DOM read, no fetch/XHR, no clicks, no navigation, no cookie
 * or storage access. Values are compared in memory; the output holds only a
 * fixed site label, enums, booleans and numeric dimensions. No URL, host, id,
 * hash, path segment, tag, title or text content is ever printed.
 */
(() => {
  'use strict';
  const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'webm', 'mp4', 'swf'];
  const out = { probe: 'ib07-slot-provenance', version: '1.0.0' };
  const host = location.hostname.replace(/^www\./, '');
  const num = (v) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : null);
  const attrState = (el, name) => (!el.hasAttribute(name) ? 'absent' : (el.getAttribute(name) || '').trim() === '' ? 'empty' : 'present');
  const pathOf = (raw) => { try { return new URL(raw, location.href).pathname; } catch { return ''; } };
  const sameResource = (a, b) => { try { return !!a && !!b && new URL(a, location.href).href === new URL(b, location.href).href; } catch { return false; } };
  const pathClass = (raw) => {
    const p = pathOf(raw);
    if (!p) return 'none';
    if (/\/samples\//i.test(p)) return 'samples-path';
    if (/\/images\//i.test(p)) return 'images-path';
    if (/\/thumbnails\//i.test(p)) return 'thumbnails-path';
    return 'other-path';
  };
  const schemaKey = (n) => /^data-[a-z0-9-]{1,40}$/.test(n) && !/\d{3,}/.test(n);
  const extOf = (raw) => { const e = (pathOf(raw).split('.').pop() || '').toLowerCase(); return IMAGE_EXTS.includes(e) ? e : (e ? 'other' : 'none'); };
  const statsSize = () => {
    const text = [...document.querySelectorAll('li, dd, dt, #stats, .stats')]
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ');
    const m = text.match(/\bSize:\s*(\d+)\s*x\s*(\d+)\b/i);
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
  };

  function rule34() {
    out.site = 'rule34.xxx';
    const params = new URLSearchParams(location.search);
    if (!(params.get('page') === 'post' && params.get('s') === 'view' && params.get('id'))) {
      out.routeClass = 'not-post-view';
      out.status = 'NOT_FOUND';
      out.reason = 'open a Rule34 post page (page=post&s=view)';
      return;
    }
    out.routeClass = 'post-view';
    const img = document.querySelector('img#image');
    const anchors = [...document.querySelectorAll('a[href]')];
    // The two ways production recognizes an original link, recorded separately.
    const textLink = anchors.find((a) => (a.textContent || '').trim().toLowerCase() === 'original image') || null;
    const imagesLink = anchors.find((a) => /\/images\/[^?#]+/i.test(a.getAttribute('href') || '')) || null;
    const facts = {
      imgImagePresent: !!img,
      originalTextLinkPresent: !!textLink,
      imagesPathLinkPresent: !!imagesLink,
    };
    if (img) {
      const src = img.currentSrc || img.getAttribute('src') || '';
      const stats = statsSize();
      facts.displayedPathClass = pathClass(src);
      facts.displayedFilenameHasSamplePrefix = /(^|\/)sample_[^/]*$/i.test(pathOf(src));
      facts.displayedExtension = extOf(src);
      facts.imageLoaded = !!img.complete && img.naturalWidth > 0;
      facts.displayedNaturalWidth = img.naturalWidth || null;
      facts.displayedNaturalHeight = img.naturalHeight || null;
      facts.imgWidthAttribute = num(img.getAttribute('width'));
      facts.imgHeightAttribute = num(img.getAttribute('height'));
      facts.statisticsSizePresent = !!stats;
      facts.statisticsWidth = stats ? stats.width : null;
      facts.statisticsHeight = stats ? stats.height : null;
      facts.displayedDimensionsEqualStatistics = stats && facts.imageLoaded
        ? (img.naturalWidth === stats.width && img.naturalHeight === stats.height) : null;
      facts.displayedEqualsTextLinkTarget = textLink ? sameResource(src, textLink.href) : null;
      facts.displayedEqualsImagesPathLinkTarget = imagesLink ? sameResource(src, imagesLink.href) : null;
      facts.imagesPathImgElementCount = [...document.querySelectorAll('img')].filter((i) => pathClass(i.currentSrc || i.getAttribute('src') || '') === 'images-path').length;
      facts.resizeMarkerPresent = [...document.querySelectorAll('[id], [class]')]
        .some((el) => /resize/i.test(`${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`));
    }
    out.facts = facts;
    if (!img) { out.status = 'NOT_QUALIFIED'; out.reason = 'no img#image on this post page'; return; }
    if (textLink || imagesLink) { out.status = 'NOT_QUALIFIED'; out.reason = 'this post has a native original link; find a post without one'; return; }
    out.status = 'QUALIFIED';
    out.reason = 'img#image present and no native original link';
  }

  // Post page of a card found on the listing: what the site displays when the
  // native container has no data-sample-url (the path item 9 G3-3d exercises).
  function e6Post() {
    out.routeClass = 'post-page';
    const c = document.querySelector('#image-container[data-id]');
    if (!c) { out.status = 'NOT_FOUND'; out.reason = 'no #image-container on this post page'; return; }
    const img = document.querySelector('#image-container img#image, img#image');
    const file = c.getAttribute('data-file-url') || '';
    const sample = c.getAttribute('data-sample-url') || '';
    const shown = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
    const loaded = !!img && !!img.complete && img.naturalWidth > 0;
    const w = num(c.getAttribute('data-width'));
    const h = num(c.getAttribute('data-height'));
    out.facts = {
      sampleAttr: attrState(c, 'data-sample-url'),
      fileAttr: attrState(c, 'data-file-url'),
      fileExtension: extOf(file) !== 'none' ? extOf(file) : 'unknown',
      imgImagePresent: !!img,
      displayedEqualsFile: img ? sameResource(shown, file) : null,
      displayedEqualsSample: img && sample ? sameResource(shown, sample) : null,
      pictureSourceCount: c.querySelectorAll('picture source').length,
      dataWidth: w,
      dataHeight: h,
      imageLoaded: loaded,
      displayedNaturalWidth: loaded ? img.naturalWidth : null,
      displayedNaturalHeight: loaded ? img.naturalHeight : null,
      displayedDimensionsEqualData: loaded && w && h ? (img.naturalWidth === w && img.naturalHeight === h) : null,
      viewOriginalLinkPresent: [...document.querySelectorAll('a[href]')].some((a) => /view original/i.test((a.textContent || '').trim())),
      containerClassMentionsSampleOrOriginal: /sample|original/i.test(typeof c.className === 'string' ? c.className : ''),
    };
    if (out.facts.sampleAttr === 'present') { out.status = 'NOT_QUALIFIED'; out.reason = 'this post has data-sample-url; open a card the listing run reported as lacking it'; return; }
    out.status = 'QUALIFIED';
    out.reason = 'post container lacks data-sample-url';
  }

  function e6(label) {
    out.site = label;
    if (/^\/posts\/\d+/.test(location.pathname)) { e6Post(); return; }
    out.routeClass = /^\/(posts)?\/?$/.test(location.pathname) ? 'listing' : 'other';
    const cards = [...new Set(document.querySelectorAll('article.thumbnail, article.post-preview, article[data-id]'))];
    const agg = { cardsTotal: cards.length, sampleAbsent: 0, sampleEmpty: 0, samplePresent: 0,
      samplePresentEqualsFile: 0, samplePresentDiffersFromFile: 0, samplePresentFileAbsent: 0 };
    const qualifying = [];
    for (const card of cards) {
      const s = attrState(card, 'data-sample-url');
      const f = attrState(card, 'data-file-url');
      if (s === 'absent') agg.sampleAbsent++;
      else if (s === 'empty') agg.sampleEmpty++;
      else {
        agg.samplePresent++;
        if (f !== 'present') agg.samplePresentFileAbsent++;
        else if (sameResource(card.getAttribute('data-sample-url'), card.getAttribute('data-file-url'))) agg.samplePresentEqualsFile++;
        else agg.samplePresentDiffersFromFile++;
      }
      if (s !== 'present') qualifying.push(card);
    }
    out.aggregate = agg;
    out.qualifyingCards = qualifying.slice(0, 3).map((card) => {
      const file = card.getAttribute('data-file-url') || '';
      const preview = card.getAttribute('data-preview-url') || '';
      const previewWebp = card.getAttribute('data-preview-webp') || '';
      const img = card.querySelector('picture img, img');
      const rendered = img ? (img.currentSrc || img.getAttribute('src') || '') : '';
      const names = [...card.attributes].map((a) => a.name).filter((n) => n.startsWith('data-'));
      return {
        sampleAttr: attrState(card, 'data-sample-url'),
        fileAttr: attrState(card, 'data-file-url'),
        previewAttr: attrState(card, 'data-preview-url'),
        previewWebpAttr: attrState(card, 'data-preview-webp'),
        fileExtension: extOf(file) !== 'none' ? extOf(file) : (IMAGE_EXTS.includes(String(card.getAttribute('data-file-ext') || '').toLowerCase()) ? String(card.getAttribute('data-file-ext')).toLowerCase() : 'unknown'),
        renderedImgPresent: !!img,
        renderedEqualsFile: img ? sameResource(rendered, file) : null,
        renderedEqualsPreview: img ? sameResource(rendered, preview) : null,
        renderedEqualsPreviewWebp: img ? sameResource(rendered, previewWebp) : null,
        pictureSourceCount: card.querySelectorAll('picture source').length,
        dataWidth: num(card.getAttribute('data-width')),
        dataHeight: num(card.getAttribute('data-height')),
        renderedNaturalWidth: img && img.naturalWidth ? img.naturalWidth : null,
        renderedNaturalHeight: img && img.naturalHeight ? img.naturalHeight : null,
        // Attribute names only (fixed schema keys such as data-md5); a name
        // with a run of 3+ digits could embed an id and is withheld.
        dataAttributeNames: names.filter(schemaKey).sort(),
        dataAttributeNamesWithheld: names.filter((n) => !schemaKey(n)).length,
        classMentionsSampleOrOriginal: /sample|original/i.test(typeof card.className === 'string' ? card.className : ''),
      };
    });
    if (!cards.length) { out.status = 'NOT_FOUND'; out.reason = 'no listing cards on this page'; return; }
    if (!qualifying.length) { out.status = 'NOT_QUALIFIED'; out.reason = 'every card on this page has data-sample-url; try another listing page'; return; }
    out.status = 'QUALIFIED';
    out.reason = 'at least one card lacks data-sample-url';
  }

  if (host === 'rule34.xxx') rule34();
  else if (host === 'e621.net') e6('e621.net');
  else if (host === 'e926.net') e6('e926.net');
  else { out.site = 'unsupported'; out.status = 'NOT_FOUND'; out.reason = 'run on rule34.xxx, e621.net or e926.net'; }

  console.log(JSON.stringify(out, null, 2));
})();
