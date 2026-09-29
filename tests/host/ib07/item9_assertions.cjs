'use strict';
// IB07 §3 item 9 assertions: only the REQUIRED/OPEN cells of
// docs/implementation/IB07_ACCEPTANCE_APPLICABILITY.md.
//   Group 1  request behavior: T1 and T2 (IB01 oracles) for Rule34, e621, e926,
//            Gelbooru; on-demand zero requests for Rule34, e621, e926.
//   Group 2  exact identity validation: Rule34, e621, e926.
//   Group 3  sample/original slot correctness: Rule34, e621, e926.
// Assertions state the IB07 invariant (native facts first; unknown remains
// unknown), not current implementation quirks. Every assertion has a
// source-mutant control that must flip its verdict. A case the qualified
// evidence cannot decide is reported INCONCLUSIVE with the missing G-HOST fact.
// Expected verdicts are held in EXPECTED; like the IB01 known-failure register,
// the runner exits 0 only when every verdict and every control matches it, so
// a production change that alters any verdict fails the run until recorded.
const path = require('path');
const { loadAndStart, pointerSweep, sleep, productionSource, gitBlobId } = require('./item9_harness.cjs');
const fx = require('./item9_fixtures.cjs');
const { oracles } = require(path.resolve(__dirname, '../../assertions/ib01/oracles.cjs'));

const PRODUCTION_BLOB = '30cadd68ebc6ca357a029ebdf1cfb028f081ee7b'; // Booru_Enhancer.user.js with the IB07 slot-inference restriction (9cade1a + two lines)
const SOURCE = productionSource();

// ---- source mutation helpers ----------------------------------------------
function replaceOnce(src, pattern, replacement) {
  const matches = typeof pattern === 'string' ? src.split(pattern).length - 1 : (src.match(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`)) || []).length;
  if (matches !== 1) throw new Error(`mutation pattern matched ${matches} times: ${pattern}`);
  return src.replace(pattern, replacement);
}
function functionSlice(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);
  let depth = 0;
  for (let i = src.indexOf(') {', start) + 2; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return { start, end: i + 1 };
  }
  throw new Error(`unterminated function ${name}`);
}
function mutateIn(src, name, pattern, replacement) {
  const { start, end } = functionSlice(src, name);
  return src.slice(0, start) + replaceOnce(src.slice(start, end), pattern, replacement) + src.slice(end);
}

// Group 1 mutants: reintroduce the historical request behaviors.
const M = {
  familyStartupDapi: (s) => replaceOnce(
    replaceOnce(s, /(deferred to hover\/click'\);)\s*return;/, '$1'),
    /(strategy passes G-HOST\.\s*)return \[\];/, '$1return gelbooruApiFetch(ids);'),
  familyHoverHtml: (s) => replaceOnce(s, /(if \(gelbooruNative\) return gelbooruNative;\s*)return null;/, '$1return gelbooruFetchPostHTML(id);'),
  familyOnDemandRequest: (s) => replaceOnce(s, /(\/\/ IB07 safeguard: no family-wide DAPI\/HTML resolver is admitted\.)/,
    "$1\nBE.net.request({ url: location.origin + '/index.php?page=post&s=view&id=' + id }, 1).catch(() => {});"),
  e6StartupJson: (s) => replaceOnce(s, 'return ids.map((id) => e621NativeListingPost(id)).filter(Boolean);',
    'BE.net.json(`${location.origin}/posts.json?tags=id:${ids.join(\',\')}`).catch(() => {}); return ids.map((id) => e621NativeListingPost(id)).filter(Boolean);'),
  e6PerPostJson: (s) => replaceOnce(s, 'return e6NativePostPage(id) || e621NativeListingPost(id);',
    'BE.net.json(`${location.origin}/posts/${id}.json`).catch(() => {}); return e6NativePostPage(id) || e621NativeListingPost(id);'),
  e6NoBatch: (s) => replaceOnce(s, 'return ids.map((id) => e621NativeListingPost(id)).filter(Boolean);', 'return [];'),
  // Group 2 mutants: drop each native identity check.
  r34NoIdentity: (s) => mutateIn(s, 'rule34NativeImagePost', 'if (!id || String(id) !== String(currentId)) return null;', 'if (!currentId) return null;'),
  e6PostNoIdentity: (s) => mutateIn(s, 'e6NativePostPage', "if (!container || String(container.dataset?.id || '') !== wanted) return null;", 'if (!container) return null;'),
  e6ListingNoIdentity: (s) => mutateIn(s, 'e621NativeListingPost', ".find((el) => String(el.dataset?.id || '') === wanted);", '.find(() => true);'),
  // Group 3 mutants.
  r34OriginalIntoSample: (s) => mutateIn(s, 'rule34NativeImagePost', "const sampleUrl = img.currentSrc || img.getAttribute('src') || '';", "const sampleUrl = originalLink?.href || img.currentSrc || '';"),
  r34OriginalFromSample: (s) => mutateIn(s, 'rule34NativeImagePost', "const originalUrl = originalLink?.href || '';", 'const originalUrl = originalLink?.href || sampleUrl;'),
  r34SampleFabricated: (s) => mutateIn(s, 'rule34NativeImagePost', 'if (!img) return null;',
    "if (!img) { const o = [...document.querySelectorAll('a[href]')].find((a) => /\\/images\\//.test(a.getAttribute('href') || ''))?.href || ''; return emptyPost({ id: String(id), sampleUrl: o, originalUrl: o, siteId: 'gelbooru-family' }); }"),
  e6OriginalIntoSample: (s) => mutateIn(s, 'normalizeE621NativeElement', "const sampleUrl = d.sampleUrl || '';", 'const sampleUrl = fileUrl || d.sampleUrl;'),
  e6OriginalFabricated: (s) => mutateIn(s, 'normalizeE621NativeElement', "const fileUrl = d.fileUrl || '';", "const fileUrl = d.fileUrl || d.sampleUrl || '';"),
  e6EqualSampleDropped: (s) => mutateIn(s, 'normalizeE621NativeElement', "const sampleUrl = d.sampleUrl || '';", "const sampleUrl = (d.sampleUrl && d.sampleUrl !== d.fileUrl) ? d.sampleUrl : '';"),
  e6SampleFromFile: (s) => mutateIn(s, 'normalizeE621NativeElement', "const sampleUrl = d.sampleUrl || '';", 'const sampleUrl = d.sampleUrl || fileUrl;'),
};

// ---- measurements ----------------------------------------------------------
async function startup(fixture, source) {
  const c = await loadAndStart({ ...fixture, source });
  const r = { adapter: c.adapter?.id || null, cards: c.window.document.querySelectorAll('.be-thumb-wrap').length,
    batchCalls: c.calls.fetchThumbBatch, batchIds: c.calls.fetchThumbBatchIds, ...c.counts() };
  c.window.close();
  return r;
}
async function sweep(fixture, source) {
  const c = await loadAndStart({ ...fixture, source });
  const r = await pointerSweep(c);
  c.window.close();
  return r;
}
async function onDemand(fixture, source, ids) {
  const c = await loadAndStart({ ...fixture, source });
  const before = c.requests.length;
  const posts = [];
  for (const id of ids) posts.push(await c.adapter.fetchPost(String(id)));
  await sleep(100);
  const during = c.requests.slice(before);
  const r = { adapter: c.adapter?.id || null, posts: posts.filter(Boolean).length,
    apiRequests: during.filter((x) => x.kind === 'api').length, postPageRequests: during.filter((x) => x.kind === 'postPage').length,
    otherRequests: during.filter((x) => x.kind === 'other').length };
  c.window.close();
  return r;
}
async function fetchPosts(fixture, source, ids) {
  const c = await loadAndStart({ ...fixture, source });
  const out = [];
  for (const id of ids) {
    const p = await c.adapter.fetchPost(id === null ? '' : String(id));
    out.push(p ? { id: String(p.id), sampleUrl: p.sampleUrl, originalUrl: p.originalUrl } : null);
  }
  c.window.close();
  return out;
}

// ---- assertions ------------------------------------------------------------
const cases = [];
function add(id, group, host, name, measure, verdict, controls, extra = {}) {
  cases.push({ id, group, host, name, measure, verdict, controls, ...extra });
}
const zeroMetadata = (o) => o.apiRequests === 0 && o.postPageRequests === 0;

// Group 1: T1 startup and T2 hover sweep through the IB01 oracles.
const listing = {
  'rule34.xxx': [fx.rule34Listing(), M.familyStartupDapi, M.familyHoverHtml],
  'e621.net': [fx.e6Listing('e621.net'), M.e6StartupJson, (s) => M.e6PerPostJson(M.e6NoBatch(s))],
  'e926.net': [fx.e6Listing('e926.net'), M.e6StartupJson, (s) => M.e6PerPostJson(M.e6NoBatch(s))],
  'gelbooru.com (case B: candidate container)': [fx.gelbooruListing({ withContainer: true }), M.familyStartupDapi, M.familyHoverHtml],
};
for (const [host, [fixture, t1Mutant, t2Mutant]] of Object.entries(listing)) {
  add(`G1-T1-${host.split(' ')[0]}`, 1, host, 'T1: startup issues no enhancer metadata request',
    (src) => startup(fixture, src), (o) => oracles.startupFanout(o).ok,
    [{ name: 'startup metadata request reintroduced', mutate: t1Mutant, expect: false }],
    { requirePathRan: (o) => o.cards > 0 && (host === 'rule34.xxx' ? o.batchCalls === 0 : o.batchCalls > 0) });
  add(`G1-T2-${host.split(' ')[0]}`, 1, host, 'T2: pointer sweep before dwell issues no enhancer metadata request',
    (src) => sweep(fixture, src), (o) => oracles.hoverDwell(o).ok,
    [{ name: 'per-hover metadata request reintroduced', mutate: t2Mutant, expect: false }],
    { requirePathRan: (o) => o.cardsSwept > 0 });
}
// Gelbooru case A mirrors the live markup (no candidate container matched):
// the gallery does not start, so this row is recorded, not counted as proof.
add('G1-T1T2-gelbooru-caseA', 1, 'gelbooru.com (case A: observed markup)', 'T1/T2 on the observed markup: gallery does not start; zero requests',
  async (src) => ({ startup: await startup(fx.gelbooruListing(), src), sweep: await sweep(fx.gelbooruListing(), src) }),
  (o) => oracles.startupFanout(o.startup).ok && oracles.hoverDwell(o.sweep).ok, [],
  { informational: 'path not reached on observed markup (0 enhanced cards); case B carries the proof' });

// Group 1: on-demand zero requests (Rule34, e621, e926; Gelbooru already proven live).
const onDemandFixtures = {
  'rule34.xxx': [fx.rule34Post(), [1001], M.familyOnDemandRequest],
  'e621.net': [fx.e6Post('e621.net'), [3001], M.e6PerPostJson],
  'e926.net': [fx.e6Post('e926.net'), [3001], M.e6PerPostJson],
};
for (const [host, [fixture, ids, mutant]] of Object.entries(onDemandFixtures)) {
  add(`G1-OD-${host}`, 1, host, 'on-demand Post production issues no enhancer metadata request',
    (src) => onDemand(fixture, src, ids), zeroMetadata,
    [{ name: 'on-demand request reintroduced', mutate: mutant, expect: false }],
    { requirePathRan: (o) => o.posts === ids.length });
}

// Group 2: exact identity validation.
add('G2-ID-rule34.xxx', 2, 'rule34.xxx', 'post page: Post only for the exact requested id matching the route; mismatch and missing id give nothing',
  (src) => fetchPosts(fx.rule34Post({ id: 1001 }), src, ['1001', '1002', null]),
  (o) => o[0]?.id === '1001' && o[1] === null && o[2] === null,
  [{ name: 'identity check removed', mutate: M.r34NoIdentity, expect: false }]);
for (const host of ['e621.net', 'e926.net']) {
  add(`G2-ID-post-${host}`, 2, host, 'post page: Post only when the native container id equals the requested id',
    async (src) => ({ match: await fetchPosts(fx.e6Post(host, { id: 3001 }), src, ['3001', '3999']),
      mismatch: await fetchPosts(fx.e6Post(host, { id: 3002, routeId: 3001 }), src, ['3001']) }),
    (o) => o.match[0]?.id === '3001' && o.match[1] === null && o.mismatch[0] === null,
    [{ name: 'post-page identity check removed', mutate: M.e6PostNoIdentity, expect: false }]);
  add(`G2-ID-listing-${host}`, 2, host, 'listing: Post built from the card whose id equals the requested id; unknown id gives nothing',
    async (src) => { const f = fx.e6Listing(host); return { facts: f.facts, posts: await fetchPosts(f, src, ['2002', '2999']) }; },
    (o) => o.posts[0]?.id === '2002' && o.posts[0].originalUrl === o.facts[2002].fileUrl && o.posts[1] === null,
    [{ name: 'listing identity check removed', mutate: M.e6ListingNoIdentity, expect: false }]);
}

// Group 3: sample/original slot correctness.
const r34Distinct = fx.rule34Post({ id: 1001 });
add('G3-3a-rule34.xxx', 3, 'rule34.xxx', 'distinct native sample and original stay in their own slots',
  async (src) => ({ post: (await fetchPosts(r34Distinct, src, ['1001']))[0] }),
  (o) => o.post?.sampleUrl === r34Distinct.sampleUrl && o.post?.originalUrl === r34Distinct.originalUrl,
  [{ name: 'original placed into sample slot', mutate: M.r34OriginalIntoSample, expect: false }]);
// Production fail-closed assertion (IB07 invariant: unknown remains unknown).
// With no native original link the original slot must stay empty; the sample
// stays in its own slot. What such a page means on the host is a separate
// G-HOST fact, NOT OBSERVED LIVE (IB07_SLOT_PROVENANCE_EVIDENCE.md); this row
// does not claim it, and reports it in hostSemantic.
const r34NoOriginal = fx.rule34Post({ id: 1001, original: false });
add('G3-3c-rule34.xxx', 3, 'rule34.xxx', 'no native Original link: original slot stays unknown, sample unchanged (fail closed)',
  async (src) => ({ post: (await fetchPosts(r34NoOriginal, src, ['1001']))[0] }),
  (o) => !!o.post && o.post.originalUrl === '' && o.post.sampleUrl === r34NoOriginal.sampleUrl,
  [{ name: 'original inferred from the sample again', mutate: M.r34OriginalFromSample, expect: false }],
  { finding: 1, hostSemantic: 'NOT OBSERVED LIVE: Rule34 post page with img#image and no native original link' });
add('G3-3d-rule34.xxx', 3, 'rule34.xxx', 'missing native sample is not fabricated (no img#image gives no sample)',
  async (src) => ({ post: (await fetchPosts(fx.rule34Post({ id: 1001, sample: false }), src, ['1001']))[0] }),
  (o) => o.post === null || o.post.sampleUrl === '',
  [{ name: 'sample fabricated from the original link', mutate: M.r34SampleFabricated, expect: false }]);

for (const host of ['e621.net', 'e926.net']) {
  const post = fx.e6Post(host, { id: 3001 });
  add(`G3-3a-post-${host}`, 3, host, 'post page: distinct native sample and original stay in their own slots',
    async (src) => ({ post: (await fetchPosts(post, src, ['3001']))[0] }),
    (o) => o.post?.sampleUrl === post.sampleUrl && o.post?.originalUrl === post.fileUrl && post.sampleUrl !== post.fileUrl,
    [{ name: 'original placed into sample slot', mutate: M.e6OriginalIntoSample, expect: false }]);
  add(`G3-3a-listing-${host}`, 3, host, 'listing: distinct native sample and original stay in their own slots',
    async (src) => { const f = fx.e6Listing(host); return { facts: f.facts, post: (await fetchPosts(f, src, ['2001']))[0] }; },
    (o) => o.post?.sampleUrl === o.facts[2001].sampleUrl && o.post?.originalUrl === o.facts[2001].fileUrl,
    [{ name: 'original placed into sample slot', mutate: M.e6OriginalIntoSample, expect: false }]);
  const noFile = fx.e6Post(host, { id: 3001, file: false });
  add(`G3-3c-${host}`, 3, host, 'missing native original stays missing (not filled from the sample)',
    async (src) => ({ post: (await fetchPosts(noFile, src, ['3001']))[0] }),
    (o) => !!o.post && o.post.originalUrl === '' && o.post.sampleUrl === noFile.sampleUrl,
    [{ name: 'original fabricated from the sample', mutate: M.e6OriginalFabricated, expect: false }]);
  const equal = fx.e6Post(host, { id: 3001, sample: 'equal' });
  add(`G3-3e-${host}`, 3, host, 'native sample equal to the original: slots equal because the native facts say so',
    async (src) => ({ post: (await fetchPosts(equal, src, ['3001']))[0] }),
    (o) => o.post?.sampleUrl === equal.sampleUrl && o.post?.originalUrl === equal.fileUrl,
    [{ name: 'native equal sample dropped', mutate: M.e6EqualSampleDropped, expect: false }]);
  // Production fail-closed assertion; host semantic reported separately.
  const noSample = fx.e6Post(host, { id: 3001, sample: 'absent' });
  add(`G3-3d-${host}`, 3, host, 'no data-sample-url: sample slot stays unknown, file stays original (fail closed)',
    async (src) => ({ post: (await fetchPosts(noSample, src, ['3001']))[0] }),
    (o) => !!o.post && o.post.sampleUrl === '' && o.post.originalUrl === noSample.fileUrl,
    [{ name: 'sample inferred from the file again', mutate: M.e6SampleFromFile, expect: false }],
    { finding: 2, hostSemantic: `NOT OBSERVED LIVE: ${host} card or container without data-sample-url` });
}

// Verdicts at production blob 30cadd6 (slot-inference restriction). Every
// assertion is expected to PASS. Rows with hostSemantic assert production's
// fail-closed behavior only; their host shape stays NOT OBSERVED LIVE.
const EXPECTED = {};

(async () => {
  const blob = gitBlobId(SOURCE);
  const results = [];
  for (const c of cases) {
    const obs = await c.measure(SOURCE);
    let verdict;
    const v = c.verdict(obs);
    if (c.inconclusive) verdict = `INCONCLUSIVE(${v})`;
    else if (c.informational) verdict = v ? 'RECORDED(zero requests; path not reached)' : 'FAIL';
    else verdict = v ? 'PASS' : 'FAIL';
    const pathRan = c.requirePathRan ? !!c.requirePathRan(obs) : null;
    if (pathRan === false) verdict = 'VACUOUS';
    const controls = [];
    for (const ctl of c.controls) {
      const mobs = await c.measure(ctl.mutate(SOURCE));
      const mv = c.verdict(mobs);
      controls.push({ name: ctl.name, expected: ctl.expect, observed: mv, ok: mv === ctl.expect });
    }
    const expected = EXPECTED[c.id] || (c.informational ? 'RECORDED(zero requests; path not reached)' : 'PASS');
    results.push({ id: c.id, group: c.group, host: c.host, name: c.name, verdict, expected, matchesExpected: verdict === expected,
      pathRan, controls, finding: c.finding || null, hostSemantic: c.hostSemantic || null, inconclusiveNeeds: c.inconclusive || null, informational: c.informational || null, observation: obs });
  }
  const controlFailures = results.flatMap((r) => r.controls.filter((x) => !x.ok).map((x) => `${r.id}: ${x.name}`));
  const mismatches = results.filter((r) => !r.matchesExpected).map((r) => `${r.id}: ${r.verdict} (expected ${r.expected})`);
  const summary = {
    suite: 'IB07 §3 item 9 assertions',
    productionBlob: blob,
    productionBlobExpected: PRODUCTION_BLOB,
    productionBlobIsExpected: blob === PRODUCTION_BLOB,
    assertions: results.filter((r) => !r.informational).length,
    pass: results.filter((r) => r.verdict === 'PASS').length,
    recorded: results.filter((r) => r.verdict.startsWith('RECORDED')).map((r) => r.id),
    fail: results.filter((r) => r.verdict === 'FAIL').map((r) => r.id),
    inconclusive: results.filter((r) => r.verdict.startsWith('INCONCLUSIVE')).map((r) => r.id),
    hostSemanticNotObservedLive: results.filter((r) => r.hostSemantic).map((r) => r.id),
    vacuous: results.filter((r) => r.verdict === 'VACUOUS').map((r) => r.id),
    controls: results.reduce((n, r) => n + r.controls.length, 0),
    controlFailures,
    mismatchesAgainstExpected: mismatches,
  };
  // Observations contain only synthetic fixture values; drop URLs and fixture
  // markup from the output anyway.
  const clean = JSON.parse(JSON.stringify({ summary, results }, (k, v) => {
    if (k === 'html') return undefined;
    return /Url$/.test(k) && typeof v === 'string' ? (v ? '<url>' : '') : v;
  }));
  console.log(JSON.stringify(clean, null, 2));
  if (!summary.productionBlobIsExpected || controlFailures.length || mismatches.length || summary.vacuous.length) process.exitCode = 1;
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
