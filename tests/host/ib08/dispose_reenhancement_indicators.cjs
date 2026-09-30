'use strict';
// IB08 second live run, D10 diagnosis: stale enhancer state versus real
// post-dispose re-enhancement. Runs the REAL production userscript in jsdom
// (IB07 harness) on e621 and e926. Direct instruments, installed before
// production evaluates:
//   initCalls        - calls through BE.modules.gallery.init (the property the
//                      app-level body observer and startup call);
//   ownersCreated    - BE.ownership.create calls (every card owner);
//   wrapperCalls     - adapter getThumbWrapper calls (enhanceThumbnail's first
//                      step, via getWrapperForImg);
//   actionBarsAdded  - .be-thumb-actions nodes inserted (buildThumbActions);
//   renditionWrites  - src/srcset writes whose value is a card's native
//                      sample or file URL (the enhancer rendition signature).
// Stale state: be-thumb-wrap still on a card after dispose.
// Cases: native class touch then dispose (the live D10 shape), no native touch,
// explicit init after dispose (positive control), and the disposed-container
// barrier removed (real re-enhancement, fault control).
// Fixtures are synthetic. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

const M = 'https://static.example';
const card = (id) => `<article class="thumbnail" data-id="${id}" data-file-ext="png" data-file-url="${M}/f${id}.png" data-sample-url="${M}/sample/s${id}.jpg"
  data-preview-url="${M}/p${id}.jpg" data-preview-webp="${M}/p${id}.webp"><a href="/posts/${id}"><picture><source srcset="${M}/p${id}.webp" type="image/webp"><source srcset="${M}/p${id}.jpg" type="image/jpeg"><img src="${M}/p${id}.jpg" alt=""></picture></a></article>`;
const N = 6;
const listing = (host) => ({ url: `https://${host}/posts`, html: `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${Array.from({ length: N }, (_, i) => card(i + 1)).join('')}</section></body></html>` });
const BARRIER_REMOVED = (s) => s.replace('if (container && !container.dataset.beGalleryInit && !BE.modules.gallery.wasDisposed(container)) {', 'if (container && !container.dataset.beGalleryInit) {');

async function run(host, { nativeClassTouch = false, explicitInit = false, source = PROD } = {}) {
  const ind = { initCalls: 0, ownersCreated: 0, wrapperCalls: 0, actionBarsAdded: 0, renditionWrites: 0 };
  let counting = false;
  const c = h.load({ ...listing(host), source, setup: (w) => {
    const signature = new Set();
    for (const a of w.document.querySelectorAll('article')) for (const k of ['data-sample-url', 'data-file-url']) signature.add(a.getAttribute(k));
    new w.MutationObserver((recs) => {
      if (!counting) return;
      for (const r of recs) {
        if (r.type === 'attributes' && signature.has(r.target.getAttribute(r.attributeName))) ind.renditionWrites++;
        if (r.type === 'childList') for (const n of r.addedNodes) if (n.classList && n.classList.contains('be-thumb-actions')) ind.actionBarsAdded++;
      }
    }).observe(w.document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset'] });
    w.__ind = ind; w.__counting = () => counting;
  } });
  const BE = c.BE;
  const initOrig = BE.modules.gallery.init;
  BE.modules.gallery.init = function countedInit(...a) { if (counting) ind.initCalls++; return initOrig.apply(this, a); };
  const createOrig = BE.ownership.create;
  BE.ownership.create = function countedCreate(...a) { if (counting) ind.ownersCreated++; return createOrig.apply(this, a); };
  for (const ad of BE.adapters.registry) {
    const gw = ad.getThumbWrapper;
    if (typeof gw === 'function') ad.getThumbWrapper = function countedWrapper(...a) { if (counting) ind.wrapperCalls++; return gw.apply(this, a); };
  }
  await h.sleep(300);
  const d = c.window.document;
  const container = d.querySelector('#posts-container');
  const enhancedBefore = d.querySelectorAll('article.be-thumb-wrap').length;
  // Native class touch after enhancement (e.g. a site script re-evaluating card classes).
  if (nativeClassTouch) for (const a of d.querySelectorAll('article')) a.classList.remove('blacklisted');
  await h.sleep(20);
  BE.modules.gallery.dispose();
  counting = true;
  await h.sleep(700);
  d.body.appendChild(d.createElement('div'));
  await h.sleep(700);
  if (explicitInit) { BE.modules.gallery.init(container); await h.sleep(100); }
  const o = { enhancedBefore, ...ind,
    staleClassCards: d.querySelectorAll('article.be-thumb-wrap').length,
    sampleResidue: [...d.querySelectorAll('source')].filter((s) => /\/sample\//.test(s.getAttribute('srcset') || '')).length,
    liveActionBars: d.querySelectorAll('.be-thumb-actions').length };
  c.window.close();
  return o;
}

const reenhanced = (o) => o.initCalls > 0 || o.ownersCreated > 0 || o.wrapperCalls > 0 || o.actionBarsAdded > 0 || o.renditionWrites > 0;

async function main() {
  const obs = {};
  for (const host of ['e621.net', 'e926.net']) {
    const touched = obs[`${host} native class touch`] = await run(host, { nativeClassTouch: true });
    const clean = obs[`${host} no native touch`] = await run(host);
    const explicit = obs[`${host} explicit init (positive control)`] = await run(host, { explicitInit: true });
    const barrier = obs[`${host} barrier removed (fault control)`] = await run(host, { source: BARRIER_REMOVED(PROD) });
    check(`${host} live D10 shape reproduced: native class touch leaves be-thumb-wrap on every card after dispose (stale state)`,
      touched.enhancedBefore === N && touched.staleClassCards === N && touched.sampleResidue === 0 && touched.liveActionBars === 0, JSON.stringify(touched));
    check(`${host} ...with zero init calls, owners, wrapper calls, action bars and rendition writes (no re-enhancement)`, !reenhanced(touched), JSON.stringify(touched));
    check(`${host} without a native class touch the owned class is restored (0 stale cards), no re-enhancement`, clean.staleClassCards === 0 && !reenhanced(clean), JSON.stringify(clean));
    check(`${host} positive control: explicit init after dispose registers init, owners, wrapper calls, action bars and rendition writes`,
      explicit.initCalls >= 1 && explicit.ownersCreated >= N && explicit.wrapperCalls >= N && explicit.actionBarsAdded >= N && explicit.renditionWrites >= N, JSON.stringify(explicit));
    check(`${host} fault control: barrier removed - real re-enhancement registers on every indicator`,
      barrier.initCalls >= 1 && barrier.ownersCreated >= N && barrier.wrapperCalls >= N && barrier.actionBarsAdded >= N && barrier.renditionWrites >= N && barrier.sampleResidue === N, JSON.stringify(barrier));
    check(`${host} stale class alone does not imply re-enhancement (the revision-2 D10 metric would count ${touched.staleClassCards} here)`, touched.staleClassCards > 0 && !reenhanced(touched));
  }
  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB08', diagnosis: 'second live run D10 (stale enhancer class vs re-enhancement)', production_blob: h.gitBlobId(PROD), fixtures: 'synthetic',
    observations: obs, checks: results.length, passed, failed: results.length - passed, failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'dispose-reenhancement-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
