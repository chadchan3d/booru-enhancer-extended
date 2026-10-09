'use strict';
// IB12-P2 (append liveness / native paginator recovery) permanent regression.
// Invariant: automatic append never stops making useful forward progress while
// leaving native pagination hidden.
//   G1: a next page whose identity was already visited ends append; the native
//       paginator must be revealed (prior: it stayed hidden).
//   G2: a fetched page with zero unique posts ends append for this page context
//       and reveals the paginator; the next URL is not chased (prior: IDLE with
//       the paginator hidden, so append could stall, or chased on a re-trigger).
// Harness: the real production source in jsdom (item9 harness) on an e621 listing
// with a native #paginator. GM_xmlhttpRequest answers listing pages from a route
// table (by the `page` query value) and counts them; the IntersectionObserver is
// a stub the test triggers. "Terminal" = a further trigger dispatches no request.
// Sources: repair (working tree) and the prior artifact ba6e600 (pre-P2), which
// must fail checks 1 and 2.
// Usage: node tests/host/ib12/p2_append_liveness.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));

const SOURCES = { repair: h.productionSource(), prior: hh.sourceAt('ba6e600', 'c6d6655fb6d38c6fb4c2e9bb59f47c756c461913') };
const PAG = (next) => `<nav id="paginator" class="paginator">${next ? `<a rel="next" href="/posts?page=${next}">Next</a>` : ''}</nav>`;
const PAGE = (ids, next) => `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${ids.map((id) => hh.card(String(id))).join('')}</section>${PAG(next)}</body></html>`;
const R = {
  ok: (ids, next) => ({ status: 200, body: PAGE(ids, next) }),
  status: (status) => ({ status, body: '<html><body>error</body></html>' }),
  malformed: () => ({ status: 200, body: '<html><body><div>no gallery here</div></body></html>' }),
  empty: (next) => ({ status: 200, body: PAGE([], next) }),
};

async function session(source, routes) {
  const io = []; const requests = [];
  const html = PAGE([101, 102, 103], 2);
  const c = h.load({ url: 'https://e621.net/posts', html, source, setup: (w) => {
    w.IntersectionObserver = class { constructor(cb) { this.cb = cb; io.push(this); } observe() {} unobserve() {} disconnect() { this.off = true; } takeRecords() { return []; } };
    w.GM_xmlhttpRequest = (opts) => {
      const u = new URL(opts.url, 'https://e621.net/posts'); const page = u.searchParams.get('page');
      if (u.pathname === '/posts' && page) requests.push(page);
      const r = (u.pathname === '/posts' && page && routes[page]) || { status: 404, body: 'not found' };
      w.setTimeout(() => opts.onload && opts.onload({ status: r.status, statusText: '', responseText: r.body, responseHeaders: 'content-type: text/html', finalUrl: u.href, readyState: 4 }), 5);
      return { abort() {} };
    };
  } });
  const w = c.window; await h.sleep(60);
  const doc = w.document;
  const pag = () => doc.querySelector('#paginator');
  return {
    w, doc, requests,
    hidden: () => !!pag() && pag().classList.contains('be-pagination-hidden'),
    ids: () => [...doc.querySelectorAll('#posts-container article')].map((a) => a.getAttribute('data-id')),
    trigger: async () => { const o = io.filter((x) => !x.off).pop(); if (o) o.cb([{ isIntersecting: true }]); await h.sleep(80); },
  };
}

const CHECKS = [
  ['P2-1 [G1] visited-page loop after a successful append: no request for the visited page, append terminal, paginator revealed, appended cards kept', async (src) => {
    const a = await session(src, { 2: R.ok([201, 202, 203], 2) }); // page 2 links back to itself
    await a.trigger(); const hiddenAfterSuccess = a.hidden() && a.ids().includes('201');
    await a.trigger(); await a.trigger();
    return hiddenAfterSuccess && a.requests.join() === '2' && !a.hidden() && ['101', '201', '202', '203'].every((id) => a.ids().includes(id)); }, { prior: false }],
  ['P2-2 [G2] a zero-unique-post page with a further next URL: exactly that one request, no chase on later triggers, append terminal, paginator revealed, readable content kept', async (src) => {
    const a = await session(src, { 2: R.ok([201, 202], 3), 3: R.ok([101, 201], 4), 4: R.ok([401], 5) });
    await a.trigger(); const ok2 = a.hidden(); await a.trigger(); // page 3: duplicates only
    const afterDup = a.requests.join(); await a.trigger(); await a.trigger();
    return ok2 && afterDup === '2,3' && a.requests.join() === '2,3' && !a.hidden() && !a.ids().includes('401') && ['101', '102', '103', '201', '202'].every((id) => a.ids().includes(id)); }, { prior: false }],
  ['P2-3 normal append: unique posts appended, paginator hidden after the demonstrated success, still eligible (the next trigger fetches the next page)', async (src) => {
    const a = await session(src, { 2: R.ok([201, 202], 3), 3: R.ok([301], 4) });
    await a.trigger(); const s1 = a.hidden() && a.ids().includes('202'); await a.trigger();
    return s1 && a.requests.join() === '2,3' && a.ids().includes('301') && a.hidden(); }, { prior: true }],
  ['P2-4 ordinary failure/end after a successful append still reveals the paginator and keeps appended cards: 404, malformed page, empty page, no next link', async (src) => {
    const cases = { notFound: R.status(404), malformed: R.malformed(), empty: R.empty(4), end: R.ok([301], null) };
    for (const [, third] of Object.entries(cases)) {
      const a = await session(src, { 2: R.ok([201], 3), 3: third });
      await a.trigger(); if (!a.hidden()) return false; await a.trigger(); await a.trigger();
      if (a.hidden() || !a.ids().includes('201') || a.requests.filter((p) => p === '3').length !== 1) return false;
    }
    return true; }, { prior: true }],
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
  fs.writeFileSync(path.join(__dirname, 'p2-append-liveness-result.json'), `${JSON.stringify({ test: 'ib12-p2-append-liveness', productionBlob: h.gitBlobId(h.productionSource()), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
