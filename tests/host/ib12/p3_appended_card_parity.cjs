'use strict';
// IB12-P3 (G3: appended-card enhancement parity) permanent regression.
// Defect: loadNextPage did a partial manual setup of appended cards and called
// buildThumbActions / applySiteThumbMedia WITHOUT an owner, so both returned
// early: no action bar, no admitted IB08 rendition, no card-owner lifecycle.
// Repair: the attached native clone goes through enhanceThumbnail(img), the same
// owner-based path as an initial card.
// Harness: the real production source in jsdom (item9 harness) on an e621 listing
// (IB08 card pattern from hover_harness.card) with a native #paginator;
// GM_xmlhttpRequest serves listing pages from a route table; the
// IntersectionObserver is a triggerable stub. Sources: repair (working tree) and
// the prior artifact 3fcbf15 (pre-P3), which must fail checks 1-3.
// Usage: node tests/host/ib12/p3_appended_card_parity.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));

const SOURCES = { repair: h.productionSource(), prior: hh.sourceAt('3fcbf15', '5d0b1cf16ca9d75575b29615cb6de5d703ebfef0') };
const PAGE = (ids, next, anon = true) => `<!doctype html><html><head></head><body data-user-is-anonymous="${anon}"><section id="posts-container">${ids.map((id) => hh.card(String(id))).join('')}</section><nav id="paginator" class="paginator">${next ? `<a rel="next" href="/posts?page=${next}">Next</a>` : ''}</nav></body></html>`;

async function session(source, routes, { anon = true } = {}) {
  const io = []; const requests = [];
  const c = h.load({ url: 'https://e621.net/posts', html: PAGE([101, 102], 2, anon), source, setup: (w) => {
    w.IntersectionObserver = class { constructor(cb) { this.cb = cb; io.push(this); } observe() {} unobserve() {} disconnect() { this.off = true; } takeRecords() { return []; } };
    w.GM_xmlhttpRequest = (opts) => {
      const u = new URL(opts.url, 'https://e621.net/posts'); const page = u.searchParams.get('page');
      if (u.pathname === '/posts' && page) requests.push(page);
      const body = (u.pathname === '/posts' && page && routes[page]) || null;
      w.setTimeout(() => opts.onload && opts.onload({ status: body ? 200 : 404, statusText: '', responseText: body || 'not found', responseHeaders: 'content-type: text/html', finalUrl: u.href, readyState: 4 }), 5);
      return { abort() {} };
    };
  } });
  const w = c.window; await h.sleep(60);
  const doc = w.document; const G = c.BE.modules.gallery;
  const card = (id) => doc.querySelector(`#posts-container article[data-id="${id}"]`);
  const webp = (id) => card(id)?.querySelector('source[type="image/webp"]')?.getAttribute('srcset');
  return {
    w, doc, G, requests, card, webp,
    actions: (id) => [...(card(id)?.querySelectorAll('.be-thumb-actions') || [])],
    actionSurface: (id) => [...(card(id)?.querySelectorAll('.be-thumb-actions [data-be-action]') || [])].map((b) => b.dataset.beAction).join(),
    enhanced: (id) => { const a = card(id); const img = a?.querySelector('img'); return !!a && a.classList.contains('be-thumb-wrap') && !!img && img.classList.contains('be-thumb-img') && img.dataset.bePostId === String(id); },
    hidden: () => doc.querySelector('#paginator').classList.contains('be-pagination-hidden'),
    trigger: async () => { const o = io.filter((x) => !x.off).pop(); if (o) o.cb([{ isIntersecting: true }]); await h.sleep(80); },
  };
}

const CHECKS = [
  ['P3-1 [G3] an appended card receives normal enhancement: present, enhancer classes and post ID, exactly one action bar with the same action surface as an initial card', async (src) => {
    const a = await session(src, { 2: PAGE([201], 3) }); await a.trigger();
    return !!a.card(201) && a.enhanced(201) && a.actions(201).length === 1 && a.actionSurface(201) !== '' && a.actionSurface(201) === a.actionSurface(101); }, { prior: false }],
  ['P3-2 [G3] owner-backed lifecycle: re-enhancing does not duplicate the bar; gallery disposal removes the enhancer UI and reverts the owned classes/post ID on the appended card while the card itself stays', async (src) => {
    const a = await session(src, { 2: PAGE([201], 3) }); await a.trigger();
    a.G.enhanceThumbnails(a.doc.querySelector('#posts-container')); const once = a.actions(201).length === 1;
    a.G.dispose();
    const art = a.card(201); const img = art && art.querySelector('img');
    return once && !!art && a.actions(201).length === 0 && !art.classList.contains('be-thumb-wrap') && !img.classList.contains('be-thumb-img') && !img.hasAttribute('data-be-post-id') && a.actions(101).length === 0; }, { prior: false }],
  ['P3-3 [G3] admitted e621 rendition parity: the appended card gets the same admitted result as an initial card (OWNED_SAMPLE, WebP srcset = its sample); disposal restores its native WebP srcset', async (src) => {
    const a = await session(src, { 2: PAGE([201], 3) }); await a.trigger();
    const same = a.G.getThumbRendition(a.card(201)) === 'OWNED_SAMPLE' && a.G.getThumbRendition(a.card(101)) === 'OWNED_SAMPLE' && a.webp(201) === hh.U('201').sample;
    a.G.dispose(); return same && a.webp(201) === hh.U('201').webp; }, { prior: false }],
  ['P3-4 an out-of-scope context (not logged out) stays native: the appended card makes no rendition mutation (WebP srcset native; provenance out of scope like the initial card)', async (src) => {
    const a = await session(src, { 2: PAGE([201], 3, false) }, { anon: false }); await a.trigger();
    return !!a.card(201) && a.webp(201) === hh.U('201').webp && [undefined, null, 'NATIVE_OUT_OF_SCOPE'].includes(a.G.getThumbRendition(a.card(201))) && a.G.getThumbRendition(a.card(101)) === 'NATIVE_OUT_OF_SCOPE'; }, { prior: true }],
  ['P3-5 [preserved] P2 liveness: normal append stays live (next trigger fetches the next page); a zero-unique page then stops append and reveals the paginator', async (src) => {
    const a = await session(src, { 2: PAGE([201], 3), 3: PAGE([301], 4), 4: PAGE([101, 201], 5) });
    await a.trigger(); await a.trigger(); const live = a.requests.join() === '2,3' && !!a.card(301) && a.hidden();
    await a.trigger(); await a.trigger();
    return live && a.requests.join() === '2,3,4' && !a.hidden(); }, { prior: true }],
];

async function main() {
  const results = [];
  for (const [name, fn, expect] of CHECKS) {
    const got = {};
    for (const [k, src] of Object.entries(SOURCES)) { try { got[k] = !!(await fn(src)); } catch (e) { got[k] = `ERROR ${e.message}`; } }
    const pass = got.repair === true && Object.entries(expect).every(([k, v]) => got[k] === v);
    results.push({ name, pass, got });
  }
  const passed = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [${Object.entries(r.got).map(([k, v]) => `${k} ${v}`).join(', ')}]`);
  console.log(`\n${passed}/${results.length} checks passed (production blob ${h.gitBlobId(h.productionSource())})`);
  fs.writeFileSync(path.join(__dirname, 'p3-appended-card-parity-result.json'), `${JSON.stringify({ test: 'ib12-p3-appended-card-parity', productionBlob: h.gitBlobId(h.productionSource()), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
