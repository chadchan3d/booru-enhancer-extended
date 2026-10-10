'use strict';
// IB12-P3 (G3: appended-card enhancement parity) permanent regression.
// Defect: loadNextPage did a partial manual setup of appended cards and called
// buildThumbActions / applySiteThumbMedia WITHOUT an owner, so both returned
// early: no action bar, no admitted rendition, no card-owner lifecycle.
// Repair: the attached native clone goes through enhanceThumbnail(img), the same
// owner-based path as an initial card.
// Scope history: P3 was qualified (`466a480`, records IB12_P_STAGE §4) with e621
// listing fixtures while automatic append was global. P4 (`11af9f6`) admitted
// automatic append on the Rule34 native listing only, so this permanent regression
// was realigned (IB12 closeout) to that surviving route.
// RETIRED (not run): the former P3-3 (appended e621 OWNED_SAMPLE rendition parity)
// and P3-4 (appended e621 out-of-scope rendition) checks are SUPERSEDED BY P4 ROUTE
// ADMISSION - e621 automatic append unavailable; no appended-e621 rendition claim
// remains. Ordinary e621 IB08 rendition of native cards stays covered by IB08.
// Harness: the real production source in jsdom (item9 harness) on a Rule34 native
// listing with a native #paginator next link; GM_xmlhttpRequest serves listing pages
// from a route table (by `pid`); the IntersectionObserver is a triggerable stub.
// Sources: repair (working tree) and the prior artifact 3fcbf15 (pre-P3; global
// append, so it runs on this route), which must fail the three G3 checks.
// Usage: node tests/host/ib12/p3_appended_card_parity.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const fx = require(path.resolve(__dirname, '../ib07/item9_fixtures.cjs'));

const SOURCES = { repair: h.productionSource(), prior: hh.sourceAt('3fcbf15', '5d0b1cf16ca9d75575b29615cb6de5d703ebfef0') };
const URL0 = 'https://rule34.xxx/index.php?page=post&s=list';
const cardHtml = (id) => `<span class="thumb"><a id="p${id}" href="/index.php?page=post&amp;s=view&amp;id=${id}"><img class="preview" src="${fx.MEDIA}/thumbnails/10/thumbnail_${fx.hex(id)}.jpg?${id}" alt="tag_a" title="tag_a"></a></span>`;
const PAGE = (ids, nextPid) => `<!doctype html><html><head></head><body><div class="image-list">${ids.map(cardHtml).join('')}</div><div id="paginator">${nextPid !== null ? `<a href="?page=post&amp;s=list&amp;pid=${nextPid}" alt="next">&gt;</a>` : ''}</div></body></html>`;
const RETIRED = [
  ['P3-3 (former) admitted e621 rendition parity for an appended card (OWNED_SAMPLE; disposal restores the native WebP srcset)', 'SUPERSEDED BY P4 ROUTE ADMISSION - e621 automatic append unavailable; no appended-e621 rendition claim remains'],
  ['P3-4 (former) out-of-scope (logged-in) e621 context: the appended card makes no rendition mutation', 'SUPERSEDED BY P4 ROUTE ADMISSION - e621 automatic append unavailable; no appended-e621 rendition claim remains'],
];

async function session(source, routes) {
  const io = []; const requests = [];
  const c = h.load({ url: URL0, html: PAGE([101, 102], 42), source, setup: (w) => {
    w.IntersectionObserver = class { constructor(cb) { this.cb = cb; io.push(this); } observe() {} unobserve() {} disconnect() { this.off = true; } takeRecords() { return []; } };
    w.GM_xmlhttpRequest = (opts) => {
      const u = new URL(opts.url, URL0); const pid = u.searchParams.get('pid');
      if (u.searchParams.get('s') === 'list' && pid !== null) requests.push(pid);
      const body = (pid !== null && routes[pid]) || null;
      w.setTimeout(() => opts.onload && opts.onload({ status: body ? 200 : 404, statusText: '', responseText: body || 'not found', responseHeaders: 'content-type: text/html', finalUrl: u.href, readyState: 4 }), 5);
      return { abort() {} };
    };
  } });
  const w = c.window; await h.sleep(60);
  const doc = w.document; const G = c.BE.modules.gallery;
  const card = (id) => doc.querySelector(`#p${id}`)?.closest('span.thumb');
  return {
    w, doc, G, requests, card,
    actions: (id) => [...(card(id)?.querySelectorAll('.be-thumb-actions') || [])],
    actionSurface: (id) => [...(card(id)?.querySelectorAll('.be-thumb-actions [data-be-action]') || [])].map((b) => b.dataset.beAction).join(),
    enhanced: (id) => { const a = card(id); const img = a?.querySelector('img'); return !!a && a.classList.contains('be-thumb-wrap') && !!img && img.classList.contains('be-thumb-img') && img.dataset.bePostId === String(id); },
    hidden: () => doc.querySelector('#paginator').classList.contains('be-pagination-hidden'),
    trigger: async () => { const o = io.filter((x) => !x.off).pop(); if (o) o.cb([{ isIntersecting: true }]); await h.sleep(80); },
  };
}

const CHECKS = [
  ['P3-1 [G3] an appended card receives normal enhancement: present, enhancer classes and post ID, exactly one action bar with the same action surface as an initial card', async (src) => {
    const a = await session(src, { 42: PAGE([201], 84) }); await a.trigger();
    return !!a.card(201) && a.enhanced(201) && a.actions(201).length === 1 && a.actionSurface(201) !== '' && a.actionSurface(201) === a.actionSurface(101); }, { prior: false }],
  ['P3-2 [G3] owner-backed lifecycle: re-enhancing does not duplicate the bar; gallery disposal removes the enhancer UI and reverts the owned classes/post ID on the appended card while the card itself stays', async (src) => {
    const a = await session(src, { 42: PAGE([201], 84) }); await a.trigger();
    a.G.enhanceThumbnails(a.doc.querySelector('.image-list')); const once = a.actions(201).length === 1;
    a.G.dispose();
    const art = a.card(201); const img = art && art.querySelector('img');
    return once && !!art && a.actions(201).length === 0 && !art.classList.contains('be-thumb-wrap') && !img.classList.contains('be-thumb-img') && !img.hasAttribute('data-be-post-id') && a.actions(101).length === 0; }, { prior: false }],
  ['P3-6 [G3] the appended card enters the canonical owner path: the gallery records a rendition provenance for it exactly as for an initial card (enhanceThumbnail ran; none on the prior)', async (src) => {
    const a = await session(src, { 42: PAGE([201], 84) }); await a.trigger();
    const init = a.G.getThumbRendition(a.card(101)); const app = a.G.getThumbRendition(a.card(201));
    return typeof init === 'string' && app === init; }, { prior: false }],
  ['P3-5 [preserved] P2 liveness: normal append stays live (next trigger fetches the next native page); a zero-unique page then stops append and reveals the paginator', async (src) => {
    const a = await session(src, { 42: PAGE([201], 84), 84: PAGE([301], 126), 126: PAGE([101, 201], 168) });
    await a.trigger(); await a.trigger(); const live = a.requests.join() === '42,84' && !!a.card(301) && a.hidden();
    await a.trigger(); await a.trigger();
    return live && a.requests.join() === '42,84,126' && !a.hidden(); }, { prior: true }],
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
  for (const [name, why] of RETIRED) console.log(`RETIRED  ${name}  -- ${why}`);
  console.log(`\n${passed}/${results.length} checks passed; ${RETIRED.length} retired as non-applicable (production blob ${h.gitBlobId(h.productionSource())})`);
  fs.writeFileSync(path.join(__dirname, 'p3-appended-card-parity-result.json'), `${JSON.stringify({ test: 'ib12-p3-appended-card-parity', route: 'rule34-native-listing (realigned after P4)', productionBlob: h.gitBlobId(h.productionSource()), passed, total: results.length, results, retired: RETIRED.map(([name, reason]) => ({ name, reason })) }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
