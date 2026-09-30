'use strict';
// IB08 diagnosis A: dispose is not terminal on e621/e926 listings.
// Runs the REAL production userscript in jsdom (IB07 harness). Sequence:
// enhance -> gallery.dispose() -> wait past the 400 ms body-observer debounce
// (and after an unrelated body mutation) -> count re-enhanced cards.
// Causal variants of production isolate the path:
//   noBodyReinit   - the app-level body observer never re-inits the gallery;
//   markerKept     - dispose leaves data-be-gallery-init on the container;
//   proposedFix    - the PROPOSED correction (not in production): the body
//                    observer skips a container the gallery module disposed,
//                    while explicit gallery.init() and a genuinely new
//                    container still work.
// On production a0f3041 the terminal-dispose invariant is a KNOWN FAILURE
// (reproduced); each causal variant must make dispose terminal.
// Fixtures are synthetic. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const BLOB = h.gitBlobId(PROD);
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

const M = 'https://static.example';
const card = (id) => `<article class="thumbnail" data-id="${id}" data-file-ext="png" data-file-url="${M}/f${id}.png" data-sample-url="${M}/sample/s${id}.jpg"
  data-preview-url="${M}/p${id}.jpg" data-preview-webp="${M}/p${id}.webp"><a href="/posts/${id}"><picture><source srcset="${M}/p${id}.webp" type="image/webp"><source srcset="${M}/p${id}.jpg" type="image/jpeg"><img src="${M}/p${id}.jpg" alt=""></picture></a></article>`;
const listing = (host) => ({ url: `https://${host}/posts`, html: `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${[1, 2, 3, 4, 5].map(card).join('')}</section></body></html>` });

const mut = (s, from, to) => { if (s.split(from).length !== 2) throw new Error(`pattern not unique: ${from.slice(0, 60)}`); return s.replace(from, to); };
const VARIANTS = {
  production: (s) => s,
  noBodyReinit: (s) => mut(s, 'if (container && !container.dataset.beGalleryInit) {', 'if (false) {'),
  markerKept: (s) => mut(s, "galleryOwner.ownAttribute(galleryContainer, 'data-be-gallery-init', '1');", "galleryContainer.setAttribute('data-be-gallery-init', '1');"),
  proposedFix: (s) => mut(mut(mut(mut(s,
    '\t\tlet galleryContainer = null;', '\t\tlet galleryContainer = null;\n\t\tconst disposedContainers = new WeakSet(); // proposed IB08 correction'),
    '\t\t\tconst isNewContainer = galleryContainer !== container;', '\t\t\tdisposedContainers.delete(container);\n\t\t\tconst isNewContainer = galleryContainer !== container;'),
    '\t\t\trestorePaginatorVisibility();\n\t\t\tdisposeCardOwners();\n\t\t\tgalleryOwner?.dispose();\n\t\t\tgalleryOwner = null;\n\t\t\tgalleryContainer = null;',
    '\t\t\trestorePaginatorVisibility();\n\t\t\tdisposeCardOwners();\n\t\t\tgalleryOwner?.dispose();\n\t\t\tgalleryOwner = null;\n\t\t\tif (galleryContainer) disposedContainers.add(galleryContainer);\n\t\t\tgalleryContainer = null;'),
    'if (container && !container.dataset.beGalleryInit) {', 'if (container && !container.dataset.beGalleryInit && !BE.modules.gallery.wasDisposed(container)) {')
    .replace('setupInfiniteScroll, getThumbRendition };', 'setupInfiniteScroll, getThumbRendition, wasDisposed: (c) => disposedContainers.has(c) };'),
};

const owned = (d) => [...d.querySelectorAll('source')].filter((s) => /\/sample\//.test(s.getAttribute('srcset') || '')).length;
const wrapped = (d) => d.querySelectorAll('article.be-thumb-wrap').length;

async function sequence(src, host) {
  const c = h.load({ ...listing(host), source: src });
  await h.sleep(300);
  const d = c.window.document;
  const container = d.querySelector('#posts-container');
  const o = { ownedBefore: owned(d) };
  c.BE.modules.gallery.dispose();
  o.ownedAtDispose = owned(d); o.markerAtDispose = container.hasAttribute('data-be-gallery-init');
  await h.sleep(700);
  o.ownedAfterDebounce = owned(d); o.wrappedAfterDebounce = wrapped(d);
  d.body.appendChild(d.createElement('div')); // unrelated page change
  await h.sleep(700);
  o.ownedAfterBodyMutation = owned(d);
  // Explicit re-init must still work (IB04 reinit cycles), and dispose again must return to native.
  c.BE.modules.gallery.init(container); c.BE.modules.gallery.enhanceThumbnails(container);
  await h.sleep(50);
  o.ownedAfterExplicitInit = owned(d);
  c.BE.modules.gallery.dispose();
  await h.sleep(700);
  o.ownedAfterSecondDispose = owned(d);
  // A genuinely new container (SPA swap) must still be enhanced.
  const fresh = d.createElement('section'); fresh.id = 'posts-container'; fresh.innerHTML = [6, 7].map(card).join('');
  container.replaceWith(fresh);
  await h.sleep(700);
  o.ownedInNewContainer = owned(d);
  c.window.close();
  return o;
}

async function main() {
  const out = {};
  for (const host of ['e621.net', 'e926.net']) {
    for (const [name, fn] of Object.entries(VARIANTS)) out[`${host} ${name}`] = await sequence(fn(PROD), host);
    const p = out[`${host} production`];
    check(`${host} production: restoration happens at dispose (0 owned, marker removed)`, p.ownedBefore === 5 && p.ownedAtDispose === 0 && p.markerAtDispose === false, JSON.stringify(p));
    check(`${host} production: KNOWN FAILURE reproduced - all cards re-owned within the 400 ms debounce, with no other page change`, p.ownedAfterDebounce === 5 && p.wrappedAfterDebounce === 5, JSON.stringify(p));
    for (const v of ['noBodyReinit', 'markerKept']) {
      const r = out[`${host} ${v}`];
      check(`${host} cause isolated (${v}): dispose stays terminal`, r.ownedAtDispose === 0 && r.ownedAfterDebounce === 0 && r.ownedAfterBodyMutation === 0, JSON.stringify(r));
    }
    const f = out[`${host} proposedFix`];
    check(`${host} proposed fix: dispose terminal after debounce and after an unrelated body mutation`, f.ownedAtDispose === 0 && f.ownedAfterDebounce === 0 && f.ownedAfterBodyMutation === 0, JSON.stringify(f));
    check(`${host} proposed fix: explicit init still enhances; a second dispose is terminal`, f.ownedAfterExplicitInit === 5 && f.ownedAfterSecondDispose === 0, JSON.stringify(f));
    check(`${host} proposed fix: a genuinely new container is still enhanced (SPA swap kept)`, f.ownedInNewContainer === 2, JSON.stringify(f));
  }
  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB08', diagnosis: 'A (dispose not terminal)', production_blob: BLOB, fixtures: 'synthetic', observations: out,
    checks: results.length, passed, failed: results.length - passed, failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'dispose-lifecycle-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
