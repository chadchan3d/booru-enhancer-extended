'use strict';
// IB12-P2 (append liveness / native paginator recovery) permanent regression.
// Invariant: automatic append never stops making useful forward progress while
// leaving native pagination hidden.
//   G1: a next page whose identity was already visited ends append; the native
//       paginator must be revealed (prior: it stayed hidden).
//   G2: a fetched page with zero unique posts ends append for this page context
//       and reveals the paginator; the next URL is not chased (prior: IDLE with
//       the paginator hidden, so append could stall, or chased on a re-trigger).
// Scope history: P2 was qualified (`3fcbf15`, records IB12_P_STAGE §3) with e621
// listing fixtures while automatic append was global. P4 (`11af9f6`) admitted
// automatic append on the Rule34 native listing only, so this permanent regression
// was realigned (IB12 closeout) to that surviving route; the invariants and checks
// are unchanged.
// Harness: the real production source in jsdom (item9 harness) on a Rule34 native
// listing (rule34.xxx/index.php?page=post&s=list) with a native #paginator next link
// (`pid` pagination). GM_xmlhttpRequest answers listing pages from a route table (by
// `pid`) and counts them; the IntersectionObserver is a stub the test triggers.
// "Terminal" = a further trigger dispatches no request.
// Sources: repair (working tree) and the prior artifact ba6e600 (pre-P2; global
// append, so it runs on this route), which must fail checks 1 and 2.
// Usage: node tests/host/ib12/p2_append_liveness.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const fx = require(path.resolve(__dirname, '../ib07/item9_fixtures.cjs'));

const SOURCES = { repair: h.productionSource(), prior: hh.sourceAt('ba6e600', 'c6d6655fb6d38c6fb4c2e9bb59f47c756c461913') };
const URL0 = 'https://rule34.xxx/index.php?page=post&s=list';
const card = (id) => `<span class="thumb"><a id="p${id}" href="/index.php?page=post&amp;s=view&amp;id=${id}"><img class="preview" src="${fx.MEDIA}/thumbnails/10/thumbnail_${fx.hex(id)}.jpg?${id}" alt="tag_a" title="tag_a"></a></span>`;
const PAGE = (ids, nextPid) => `<!doctype html><html><head></head><body><div class="image-list">${ids.map(card).join('')}</div><div id="paginator">${nextPid !== null ? `<a href="?page=post&amp;s=list&amp;pid=${nextPid}" alt="next">&gt;</a>` : ''}</div></body></html>`;
const R = {
  ok: (ids, next) => ({ status: 200, body: PAGE(ids, next) }),
  status: (status) => ({ status, body: '<html><body>error</body></html>' }),
  malformed: () => ({ status: 200, body: '<html><body><div>no gallery here</div></body></html>' }),
  empty: (next) => ({ status: 200, body: PAGE([], next) }),
};

async function session(source, routes) {
  const io = []; const requests = [];
  const c = h.load({ url: URL0, html: PAGE([101, 102, 103], 42), source, setup: (w) => {
    w.IntersectionObserver = class { constructor(cb) { this.cb = cb; io.push(this); } observe() {} unobserve() {} disconnect() { this.off = true; } takeRecords() { return []; } };
    w.GM_xmlhttpRequest = (opts) => {
      const u = new URL(opts.url, URL0); const pid = u.searchParams.get('pid');
      if (u.searchParams.get('s') === 'list' && pid !== null) requests.push(pid);
      const r = (pid !== null && routes[pid]) || { status: 404, body: 'not found' };
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
    ids: () => [...doc.querySelectorAll('.image-list span.thumb a[id^="p"]')].map((a) => a.id.slice(1)),
    trigger: async () => { const o = io.filter((x) => !x.off).pop(); if (o) o.cb([{ isIntersecting: true }]); await h.sleep(80); },
  };
}

const CHECKS = [
  ['P2-1 [G1] visited-page loop after a successful append: no request for the visited page, append terminal, paginator revealed, appended cards kept', async (src) => {
    const a = await session(src, { 42: R.ok([201, 202, 203], 42) }); // pid 42 links back to itself
    await a.trigger(); const hiddenAfterSuccess = a.hidden() && a.ids().includes('201');
    await a.trigger(); await a.trigger();
    return hiddenAfterSuccess && a.requests.join() === '42' && !a.hidden() && ['101', '201', '202', '203'].every((id) => a.ids().includes(id)); }, { prior: false }],
  ['P2-2 [G2] a zero-unique-post page with a further next URL: exactly that one request, no chase on later triggers, append terminal, paginator revealed, readable content kept', async (src) => {
    const a = await session(src, { 42: R.ok([201, 202], 84), 84: R.ok([101, 201], 126), 126: R.ok([401], 168) });
    await a.trigger(); const ok2 = a.hidden(); await a.trigger(); // pid 84: duplicates only
    const afterDup = a.requests.join(); await a.trigger(); await a.trigger();
    return ok2 && afterDup === '42,84' && a.requests.join() === '42,84' && !a.hidden() && !a.ids().includes('401') && ['101', '102', '103', '201', '202'].every((id) => a.ids().includes(id)); }, { prior: false }],
  ['P2-3 normal append: the native advancing page is fetched, unique posts appended, paginator hidden after the demonstrated success, still eligible (the next trigger fetches the next native page)', async (src) => {
    const a = await session(src, { 42: R.ok([201, 202], 84), 84: R.ok([301], 126) });
    await a.trigger(); const s1 = a.hidden() && a.ids().includes('202'); await a.trigger();
    return s1 && a.requests.join() === '42,84' && a.ids().includes('301') && a.hidden(); }, { prior: true }],
  ['P2-4 ordinary failure/end after a successful append still reveals the paginator and keeps appended cards: 404, malformed page, empty page, no next link', async (src) => {
    const cases = { notFound: R.status(404), malformed: R.malformed(), empty: R.empty(126), end: R.ok([301], null) };
    for (const [, third] of Object.entries(cases)) {
      const a = await session(src, { 42: R.ok([201], 84), 84: third });
      await a.trigger(); if (!a.hidden()) return false; await a.trigger(); await a.trigger();
      if (a.hidden() || !a.ids().includes('201') || a.requests.filter((p) => p === '84').length !== 1) return false;
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
  fs.writeFileSync(path.join(__dirname, 'p2-append-liveness-result.json'), `${JSON.stringify({ test: 'ib12-p2-append-liveness', route: 'rule34-native-listing (realigned after P4)', productionBlob: h.gitBlobId(h.productionSource()), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
