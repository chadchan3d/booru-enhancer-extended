'use strict';
// Synthetic host fixtures for the IB07 §3 item 9 assertions. Structure follows
// the committed V1-N records (IB07_RULE34_V1N.md, IB07_E621_V1N.md,
// IB07_E926_V1N.md, IB07_GELBOORU_V1N.md). Every id, hash, host and tag value
// is synthetic. Where a record did not observe a wrapper or container, the
// fixture uses a production candidate selector and says so in `assumptions`.

const hex = (n) => n.toString(16).padStart(32, '0');
const MEDIA = 'https://media.example';

// ---- Rule34.xxx ----------------------------------------------------------
function rule34Listing(ids = [1001, 1002, 1003]) {
  const cards = ids.map((id) => `
    <span class="thumb"><a id="p${id}" href="/index.php?page=post&amp;s=view&amp;id=${id}">
      <img class="preview" src="${MEDIA}/thumbnails/10/thumbnail_${hex(id)}.jpg?${id}" alt="tag_a tag_b" title="tag_a tag_b score:1 rating:safe">
    </a></span>`).join('');
  return {
    url: 'https://rule34.xxx/index.php?page=post&s=list',
    html: `<!doctype html><html><head></head><body><div class="image-list">${cards}</div>
      <div id="paginator"><a href="?page=post&amp;s=list&amp;pid=42" alt="next">&gt;</a></div></body></html>`,
    assumptions: ['container .image-list and span.thumb wrapper are production candidate selectors, not recorded in the V1-N record'],
  };
}

function rule34Post({ id = 1001, routeId = id, sample = true, original = true } = {}) {
  const sampleUrl = `${MEDIA}/samples/10/sample_${hex(id)}.jpg?${id}`;
  const originalUrl = `${MEDIA}/images/10/${hex(id)}.jpeg?${id}`;
  return {
    url: `https://rule34.xxx/index.php?page=post&s=view&id=${routeId}`,
    sampleUrl,
    originalUrl,
    html: `<!doctype html><html><head></head><body>
      ${sample ? `<img id="image" src="${sampleUrl}">` : ''}
      <ul id="stats">
        <li>Id: ${id}</li><li>Size: 1920x1080</li><li>Source: native</li><li>Rating: Explicit</li><li>Score: 3</li>
      </ul>
      <ul>${original ? `<li><a href="${originalUrl}">Original image</a></li>` : '<li><a href="/index.php?page=help">Help</a></li>'}</ul>
    </body></html>`,
  };
}

// ---- e621.net / e926.net ---------------------------------------------------
function e6Attrs(id, { sample = 'distinct', file = true } = {}) {
  const fileUrl = `${MEDIA}/data/aa/bb/${hex(id)}.png`;
  const sampleUrl = sample === 'distinct' ? `${MEDIA}/data/sample/aa/bb/${hex(id)}.jpg`
    : sample === 'equal' ? fileUrl : null;
  const attrs = {
    'data-id': id, 'data-tags': 'tag_a tag_b', 'data-rating': 's', 'data-file-ext': 'png',
    'data-width': 1448, 'data-height': 2048, 'data-size': 123456, 'data-md5': hex(id),
    'data-score': 5, 'data-fav-count': 2, 'data-created-at': '2026-01-01T00:00:00Z',
    'data-preview-url': `${MEDIA}/data/preview/aa/bb/${hex(id)}.jpg`,
    'data-preview-webp': `${MEDIA}/data/preview/aa/bb/${hex(id)}.webp`,
  };
  if (sampleUrl) attrs['data-sample-url'] = sampleUrl;
  if (file) attrs['data-file-url'] = fileUrl;
  const html = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
  return { html, fileUrl: file ? fileUrl : '', sampleUrl: sampleUrl || '' };
}

function e6Listing(host, ids = [2001, 2002, 2003], opts = {}) {
  const facts = {};
  const cards = ids.map((id) => {
    const a = e6Attrs(id, opts[id] || {});
    facts[id] = a;
    return `<article class="thumbnail" ${a.html}><a href="/posts/${id}"><picture>
      <source type="image/webp" srcset="${MEDIA}/data/preview/aa/bb/${hex(id)}.webp">
      <img src="${MEDIA}/data/preview/aa/bb/${hex(id)}.jpg" alt=""></picture></a></article>`;
  }).join('');
  return {
    url: `https://${host}/posts`,
    facts,
    html: `<!doctype html><html><head></head><body><div id="posts-container">${cards}</div></body></html>`,
    assumptions: ['container #posts-container is a production candidate selector, not recorded in the V1-N record'],
  };
}

function e6Post(host, { id = 3001, routeId = id, sample = 'distinct', file = true } = {}) {
  const a = e6Attrs(id, { sample, file });
  const shown = a.sampleUrl || a.fileUrl;
  return {
    url: `https://${host}/posts/${routeId}`,
    fileUrl: a.fileUrl,
    sampleUrl: a.sampleUrl,
    html: `<!doctype html><html><head></head><body>
      <section id="image-container" ${a.html}><picture>
        <img id="image" class="fit-window" src="${shown}"></picture></section>
      <section id="tag-list"><ul class="tag-list general-tag-list">
        <li class="tag-list-item" data-name="tag_a" data-category="general" data-count="10"><a>tag a</a></li>
      </ul></section>
    </body></html>`,
  };
}

// ---- Gelbooru.com ----------------------------------------------------------
// The V1-N listing matched thumbnails through the candidate selector list but
// none of the container selectors. Case A mirrors that; case B adds a
// candidate container so the enrichment path is exercised, not skipped.
function gelbooruListing({ withContainer = false, ids = [4001, 4002, 4003] } = {}) {
  const cards = ids.map((id) => `
    <article class="thumbnail-preview"><a href="/index.php?page=post&amp;s=view&amp;id=${id}&amp;tags=all">
      <img src="${MEDIA}/thumbnails/aa/bb/thumbnail_${hex(id)}.jpg" alt="tag_a tag_b" title="tag_a tag_b"></a></article>`).join('');
  const grid = withContainer ? `<div id="post-list-posts">${cards}</div>` : `<main>${cards}</main>`;
  return {
    url: 'https://gelbooru.com/index.php?page=post&s=list&tags=all',
    html: `<!doctype html><html><head></head><body>${grid}
      <div id="paginator"><a href="?page=post&amp;s=list&amp;tags=all&amp;pid=42" alt="next">&gt;</a></div></body></html>`,
    assumptions: [
      'article.thumbnail-preview is one of the production candidate thumbnail selectors; which candidate matched live was not recorded',
      withContainer ? 'case B: #post-list-posts is a production candidate container that did NOT match live; used only to exercise enrichment'
        : 'case A: no candidate container, as observed live',
    ],
  };
}

module.exports = { rule34Listing, rule34Post, e6Listing, e6Post, gelbooruListing, hex, MEDIA };
