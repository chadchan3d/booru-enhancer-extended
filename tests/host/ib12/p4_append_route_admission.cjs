'use strict';
// IB12-P4 (automatic append route admission) permanent regression.
// Designer decision: automatic append is admitted ONLY on the Rule34 native listing
// route (rule34.xxx, index.php?page=post&s=list; tags are ordinary parameters).
// Every other route stays native-pagination-only and the saved gallery.infiniteScroll
// preference is left as it is (inert there).
// Also closes IB12 item 9's missing deterministic append failures on the admitted
// route: 403 (auth-required), 429 (rate-limited) and 5xx exhausting the finite retry
// budget all stop append, reveal the native paginator and keep appended content.
// Harness: the real production source in jsdom (item9 harness). GM_xmlhttpRequest
// answers listing pages from a route table; the IntersectionObserver is a stub the
// test triggers; BE.net.request and the adapter's calculateNextUrl are counted
// pass-through. Sources: repair (working tree) and the prior artifact 466a480
// (pre-P4, global append), which must fail the unadmitted-route checks; the failure
// cases are missing coverage, not ruled defects, so the prior passes them.
// Usage: node tests/host/ib12/p4_append_route_admission.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const fx = require(path.resolve(__dirname, '../ib07/item9_fixtures.cjs'));

const SOURCES = { repair: h.productionSource(), prior: hh.sourceAt('466a480', '3be0e1f849909a3b394c256b12dc09376f44df12') };
const R34 = 'https://rule34.xxx/index.php?page=post&s=list';
const r34Card = (id) => `<span class="thumb"><a id="p${id}" href="/index.php?page=post&amp;s=view&amp;id=${id}"><img class="preview" src="${fx.MEDIA}/thumbnails/10/thumbnail_${fx.hex(id)}.jpg?${id}" alt="tag_a" title="tag_a"></a></span>`;
const r34Page = (ids, nextPid) => `<!doctype html><html><head></head><body><div class="image-list">${ids.map(r34Card).join('')}</div><div id="paginator">${nextPid !== null ? `<a href="?page=post&amp;s=list&amp;pid=${nextPid}" alt="next">&gt;</a>` : ''}</div></body></html>`;
const danbooru = () => ({ url: 'https://danbooru.donmai.us/posts', html: `<!doctype html><html><head></head><body><div id="posts-container">${[7001, 7002, 7003].map((id) => `<article id="post_${id}" class="post-preview"><a href="/posts/${id}"><img src="${fx.MEDIA}/p/${id}.jpg"></a></article>`).join('')}</div><div class="paginator"><span>1</span></div></body></html>` });

async function session(source, { url, html, routes = {}, settings = {} }) {
  const io = []; const transport = []; const settingWrites = [];
  const c = h.load({ url, html, source, settings, setup: (w) => {
    w.IntersectionObserver = class { constructor(cb) { this.cb = cb; io.push(this); } observe() {} unobserve() {} disconnect() { this.off = true; } takeRecords() { return []; } };
    const gmSet = w.GM_setValue; w.GM_setValue = (k, v) => { if (/infiniteScroll/.test(k)) settingWrites.push(v); return gmSet(k, v); };
    w.GM_xmlhttpRequest = (opts) => {
      const u = new URL(opts.url, url); const pid = u.searchParams.get('pid');
      transport.push(u.pathname + u.search);
      const r = (pid !== null && routes[pid]) || { status: 404, body: 'not found' };
      w.setTimeout(() => opts.onload && opts.onload({ status: r.status, statusText: '', responseText: r.body, responseHeaders: 'content-type: text/html', finalUrl: u.href, readyState: 4 }), 5);
      return { abort() {} };
    };
  } });
  const w = c.window; await h.sleep(80);
  const doc = w.document; const BE = c.BE;
  const pagination = []; const calc = [];
  const reqOrig = BE.net.request; BE.net.request = function counted(opts) { if (opts && opts.operation === 'gallery-pagination') pagination.push(opts.url); return reqOrig.apply(this, arguments); };
  const pg = BE.adapters.active && BE.adapters.active.pagination;
  if (pg && pg.calculateNextUrl) { const co = pg.calculateNextUrl; pg.calculateNextUrl = function countedCalc() { calc.push(1); return co.apply(this, arguments); }; }
  const pag = () => doc.querySelector('#paginator, .paginator, .pagination');
  return {
    w, doc, BE, pagination, calc, settingWrites, transport,
    sentinel: () => doc.getElementById('be-infinite-scroll-sentinel'),
    observers: () => io.filter((o) => !o.off).length,
    hidden: () => !!pag() && pag().classList.contains('be-pagination-hidden'),
    ids: () => [...doc.querySelectorAll('span.thumb a[id^="p"]')].map((a) => a.id.slice(1)),
    card: (id) => doc.querySelector(`#p${id}`)?.closest('span.thumb'),
    trigger: async (ms = 120) => { const o = io.filter((x) => !x.off).pop(); if (o) o.cb([{ isIntersecting: true }]); await h.sleep(ms); },
    setPref: async (v) => { BE.settings.set('gallery.infiniteScroll', v); await h.sleep(60); },
  };
}
const inert = (a) => !a.sentinel() && a.observers() === 0 && a.pagination.length === 0 && a.calc.length === 0 && !a.hidden();

const CHECKS = [
  ['P4-1 Rule34 admitted listing: sentinel and observer install; a trigger requests the NATIVE next page (pid 42); unique posts append; the paginator hides only after that success; append stays live', async (src) => {
    const a = await session(src, { url: R34, html: r34Page([1001, 1002], 42), routes: { 42: { status: 200, body: r34Page([2001, 2002], 84) }, 84: { status: 200, body: r34Page([3001], 126) } } });
    const installed = !!a.sentinel() && a.observers() === 1 && !a.hidden();
    await a.trigger(); const first = a.pagination.length === 1 && /pid=42/.test(a.pagination[0]) && a.ids().includes('2002') && a.hidden() && a.calc.length === 0;
    await a.trigger();
    return installed && first && a.pagination.length === 2 && /pid=84/.test(a.pagination[1]) && a.ids().includes('3001') && a.BE.settings.get('gallery.infiniteScroll') === true; }, { prior: true }],
  ['P4-2 Rule34 non-list route (page=post&s=view, with a gallery container present): append not admitted - no sentinel, observer or request; native paginator untouched; preference still true', async (src) => {
    const a = await session(src, { url: 'https://rule34.xxx/index.php?page=post&s=view&id=1001', html: r34Page([1001, 1002], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) } } });
    await a.trigger(); return inert(a) && a.BE.settings.get('gallery.infiniteScroll') === true; }, { prior: false }],
  ['P4-3 gelbooru.com listing (same adapter, native next link): adapter membership is not admission - no sentinel, observer or request; paginator native; preference unchanged', async (src) => {
    const g = fx.gelbooruListing({ withContainer: true });
    const a = await session(src, { url: g.url, html: g.html, routes: { 42: { status: 200, body: g.html } } });
    await a.trigger(); return a.BE.adapters.active.id === 'gelbooru-family' && inert(a) && a.BE.settings.get('gallery.infiniteScroll') === true; }, { prior: false }],
  ['P4-4 Danbooru listing whose calculateNextUrl could synthesize page=2: the continuation is never invoked or used - zero pagination requests, no sentinel, native pagination untouched', async (src) => {
    const d = danbooru(); const a = await session(src, { url: d.url, html: d.html });
    await a.trigger();
    const couldSynthesize = /page=2/.test(a.BE.adapters.active.pagination.calculateNextUrl.call(a.BE.adapters.active.pagination, d.url) || ''); a.calc.length = Math.max(0, a.calc.length - 1);
    return a.BE.adapters.active.id === 'danbooru' && couldSynthesize && inert(a); }, { prior: false }],
  ['P4-5a unadmitted route: preference true at startup -> inert; toggled false -> still inert; toggled true -> still inert; the stored value follows only the operator (exactly the two writes)', async (src) => {
    const g = fx.gelbooruListing({ withContainer: true }); const a = await session(src, { url: g.url, html: g.html });
    const s0 = inert(a); await a.setPref(false); const s1 = inert(a) && a.BE.settings.get('gallery.infiniteScroll') === false; await a.setPref(true); await a.trigger();
    return s0 && s1 && inert(a) && a.BE.settings.get('gallery.infiniteScroll') === true && a.settingWrites.length === 2; }, { prior: false }],
  ['P4-5b admitted Rule34: disabling removes the sentinel/observer and restores the paginator; re-enabling restores admitted append', async (src) => {
    const a = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) }, 84: { status: 200, body: r34Page([3001], 126) } } });
    await a.trigger(); const hid = a.hidden(); await a.setPref(false);
    const off = !a.sentinel() && a.observers() === 0 && !a.hidden(); await a.setPref(true); const on = !!a.sentinel() && a.observers() === 1;
    await a.trigger(); return hid && off && on && a.pagination.length === 2 && a.ids().includes('3001'); }, { prior: true }],
  ['P4-6 [preserved P2/P3 on admitted Rule34] loop -> paginator visible, terminal; zero-unique page -> paginator visible, no chase; the appended card has the same action bar as an initial card and disposal reverts it', async (src) => {
    const loop = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 42) } } });
    await loop.trigger(); await loop.trigger(); await loop.trigger();
    const okLoop = loop.pagination.length === 1 && !loop.hidden() && loop.ids().includes('2001');
    const dup = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) }, 84: { status: 200, body: r34Page([1001, 2001], 126) }, 126: { status: 200, body: r34Page([4001], 168) } } });
    await dup.trigger(); await dup.trigger(); await dup.trigger(); await dup.trigger();
    const okDup = dup.pagination.length === 2 && !dup.hidden() && !dup.ids().includes('4001');
    const bar = (a, id) => [...(a.card(id)?.querySelectorAll('.be-thumb-actions [data-be-action]') || [])].map((b) => b.dataset.beAction).join();
    const p = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) } } });
    await p.trigger(); const parity = bar(p, '2001') !== '' && bar(p, '2001') === bar(p, '1001') && p.card('2001').classList.contains('be-thumb-wrap');
    p.BE.modules.gallery.dispose(); const reverted = !!p.card('2001') && bar(p, '2001') === '' && !p.card('2001').classList.contains('be-thumb-wrap');
    return okLoop && okDup && parity && reverted; }, { prior: true }],
  ['P4-7 [item 9] 403 after a successful append: terminal (one request, no repeat on later triggers), paginator visible, appended content kept', async (src) => {
    const a = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) }, 84: { status: 403, body: 'forbidden' } } });
    await a.trigger(); await a.trigger(); await a.trigger();
    return a.pagination.length === 2 && a.transport.filter((t) => /pid=84/.test(t)).length === 1 && !a.hidden() && a.ids().includes('2001'); }, { prior: true }],
  ['P4-8 [item 9] 429 after a successful append: terminal after the gate\'s rate-limited handling (one transport attempt), paginator visible, appended content kept', async (src) => {
    const a = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) }, 84: { status: 429, body: 'slow down' } } });
    await a.trigger(); await a.trigger(); await a.trigger();
    return a.pagination.length === 2 && a.transport.filter((t) => /pid=84/.test(t)).length === 1 && !a.hidden() && a.ids().includes('2001'); }, { prior: true }],
  ['P4-9 [item 9] 5xx on every attempt: the finite retry budget is used (4 attempts) then append stops; paginator visible; appended content kept; no further request', async (src) => {
    const a = await session(src, { url: R34, html: r34Page([1001], 42), routes: { 42: { status: 200, body: r34Page([2001], 84) }, 84: { status: 503, body: 'unavailable' } } });
    await a.trigger(); await a.trigger(3200); await a.trigger(300);
    return a.pagination.length === 2 && a.transport.filter((t) => /pid=84/.test(t)).length === 4 && !a.hidden() && a.ids().includes('2001'); }, { prior: true }],
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
  fs.writeFileSync(path.join(__dirname, 'p4-append-route-admission-result.json'), `${JSON.stringify({ test: 'ib12-p4-append-route-admission', productionBlob: h.gitBlobId(h.productionSource()), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
