'use strict';
// Local verification for the IB07 Rule34/e621/e926 production-conformance
// build (no live site). Static: the derived script is current, its production
// body is byte-identical to the committed artifact, metadata changes are
// limited, the postamble is read-only. Runtime: the REAL derived userscript
// (production body + postamble) runs in jsdom on host fixtures; each check's
// verdict is compared with an expected register; production and postamble
// mutants must flip the targeted check; leaking mutants must be caught.
// Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const { build, COMMIT, EXPECTED_PRODUCTION_BLOB, POSTAMBLE_MARKER, OUT } = require('./build_r34e6_conformance.cjs');
const { split, WRAP_OPEN, WRAP_FN_HEAD, WRAP_CLOSE } = require('./build_production_conformance.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));
const fx = require(path.resolve(__dirname, '../../host/ib07/item9_fixtures.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

// ---- static -------------------------------------------------------------------
const derived = fs.readFileSync(OUT, 'utf8');
const built = build();
check('derived script matches a fresh build from the committed artifact', derived === built.text);
check('committed production blob is the expected artifact',
  execFileSync('git', ['-C', path.resolve(__dirname, '../../..'), 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === EXPECTED_PRODUCTION_BLOB);
check('derived script is LF-only', !derived.includes('\r'));
try { new Function(derived); check('derived script parses', true); } catch (e) { check('derived script parses', false, e.message); }
const wrapAt = derived.indexOf(WRAP_OPEN);
const closeAt = derived.indexOf(WRAP_CLOSE);
const markerAt = derived.indexOf(POSTAMBLE_MARKER);
check('production body is byte-identical to the committed artifact inside the wrapper', derived.slice(wrapAt + WRAP_OPEN.length, closeAt) === built.body);
check('production body appears exactly once', derived.split(built.body).length === 2);
check('wrapper invoked exactly once, before the postamble', derived.split('IB07P_PRODUCTION_BODY();').length === 2 && derived.indexOf('IB07P_PRODUCTION_BODY();') < markerAt);
const wrapperSource = derived.slice(wrapAt + WRAP_OPEN.length - WRAP_FN_HEAD.length, closeAt + 1);
check('engine toString of the wrapper reproduces it exactly', Function.prototype.toString.call((0, eval)(`(${wrapperSource})`)) === wrapperSource);
const meta = split(derived).meta.split('\n');
const orig = built.originalMeta.split('\n');
const added = meta.filter((l) => !orig.includes(l));
const removed = orig.filter((l) => !meta.includes(l));
check('metadata adds only name/namespace/match/connect lines', added.every((l) => /^\/\/ @(name|namespace|match|connect)\s/.test(l)), JSON.stringify(added));
check('metadata removes only name/namespace/match/connect/update lines', removed.every((l) => /^\/\/ @(name|namespace|match|connect|downloadURL|updateURL)\s/.test(l)), JSON.stringify(removed));
check('only rule34.xxx, e621.net, e926.net matched and connected',
  meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === '*://rule34.xxx/*,*://e621.net/*,*://e926.net/*'
  && meta.filter((l) => /@connect\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === 'rule34.xxx,e621.net,e926.net');
check('no public update target', !meta.some((l) => /@(downloadURL|updateURL)/.test(l)));
const postamble = derived.slice(markerAt);
check('postamble makes no request, click, navigation, cookie or page-storage access',
  !/\bfetch\(|XMLHttpRequest|GM_xmlhttpRequest\(|GM_download\(|\.click\(|location\.(assign|replace)|document\.cookie|localStorage|sessionStorage/.test(postamble));

// ---- runtime ------------------------------------------------------------------
const FAST = (text) => text.replace('const OBSERVE_MS = 5000;', 'const OBSERVE_MS = 0;');
async function runScript(fixture, text) {
  let menu = {};
  const c = h.load({ ...fixture, source: FAST(text), setup: (w) => {
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    w.GM_registerMenuCommand = (name, fn) => { menu[name] = fn; return 0; };
  } });
  await h.sleep(200);
  const logs = [];
  c.window.console.log = (t) => logs.push(String(t));
  const result = await menu['IB07P3: Run production conformance on this page']();
  const out = { result, text: logs.join('\n'), status: Object.fromEntries(result.checks.map((x) => [x.id, x.status])) };
  c.window.close();
  return out;
}
const RAW = ['1001', '2001', '2002', '2003', '3001', '0123456789abcdef', 'media.example', 'http', 'tag_a', 'tag_b', 'Source: native'];
const leaks = (t) => RAW.filter((r) => t.includes(r));

const SCENARIOS = {
  'rule34 post': fx.rule34Post({ id: 1001 }),
  'rule34 post, no native original link (not observed live)': fx.rule34Post({ id: 1001, original: false }),
  'rule34 listing': fx.rule34Listing(),
  'e621 post': fx.e6Post('e621.net', { id: 3001 }),
  'e621 post, no data-sample-url (not observed live)': fx.e6Post('e621.net', { id: 3001, sample: 'absent' }),
  'e621 listing (distinct, equal, absent sample)': fx.e6Listing('e621.net', [2001, 2002, 2003], { 2002: { sample: 'equal' }, 2003: { sample: 'absent' } }),
  'e926 post': fx.e6Post('e926.net', { id: 3001 }),
  'e926 listing (distinct, equal, absent sample)': fx.e6Listing('e926.net', [2001, 2002, 2003], { 2002: { sample: 'equal' }, 2003: { sample: 'absent' } }),
};
// Expected verdicts on the committed artifact: every check PASSes (R07 is not
// applicable without a native original). No check is a known failure.
const EXPECTED_FAIL = {};
const EXPECTED_NA = { 'rule34 post, no native original link (not observed live)': ['R07'] };

// Production mutants (applied to the body inside the derived script).
const mut = (text, from, to) => { if (text.split(from).length !== 2) throw new Error(`mutant pattern not unique: ${from}`); return text.replace(from, to); };
const PM = {
  bodyAltered: (t) => mut(t, 'function gelbooruNativeImagePost(id) {', 'function gelbooruNativeImagePost(id) { void 0;'),
  wrapperAbsent: (t) => mut(mut(t, 'const IB07P_PRODUCTION_BODY = function () {', 'const IB07P_BODY_RENAMED = function () {'), 'IB07P_PRODUCTION_BODY();', 'IB07P_BODY_RENAMED();'),
  r34AdapterWrong: (t) => mut(t, 'hostPattern: /gelbooru\\.com$|safebooru\\.org$|rule34\\.xxx$|', 'hostPattern: /gelbooru\\.com$|safebooru\\.org$|'),
  e6AdapterWrong: (t) => mut(t, 'hostPattern: /e621\\.net$|e926\\.net$/', 'hostPattern: /e621\\.net$/'),
  r34NoIdentity: (t) => mut(t, 'if (!id || String(id) !== String(currentId)) return null;', 'if (!currentId) return null;'),
  e6PostNoIdentity: (t) => mut(t, "if (!container || String(container.dataset?.id || '') !== wanted) return null;", 'if (!container) return null;'),
  e6ListingNoIdentity: (t) => mut(t, ".find((el) => String(el.dataset?.id || '') === wanted);", '.find(() => true);'),
  r34Swapped: (t) => mut(t, "const originalUrl = originalLink?.href || '';", "const originalUrl = img.currentSrc || img.getAttribute('src') || '';"),
  e6Swapped: (t) => mut(t, "const sampleUrl = d.sampleUrl || '';", 'const sampleUrl = fileUrl || d.sampleUrl;'),
  r34FailOpen: (t) => mut(t, "const originalUrl = originalLink?.href || '';", 'const originalUrl = originalLink?.href || sampleUrl;'),
  e6FailOpen: (t) => mut(t, "const sampleUrl = d.sampleUrl || '';", 'const sampleUrl = d.sampleUrl || fileUrl;'),
  familyRequest: (t) => mut(t, '// IB07 safeguard: no family-wide DAPI/HTML resolver is admitted.', "// IB07 safeguard: no family-wide DAPI/HTML resolver is admitted.\nBE.net.request({ url: location.origin + '/index.php?page=dapi&s=post&q=index&id=' + id }, 1).catch(() => {});"),
  e6Request: (t) => mut(t, 'return e6NativePostPage(id) || e621NativeListingPost(id);', 'BE.net.json(`${location.origin}/posts/${id}.json`).catch(() => {}); return e6NativePostPage(id) || e621NativeListingPost(id);'),
  r34FamilySite: (t) => mut(t, "siteId: 'rule34',", "siteId: 'gelbooru-family',"),
  r34PreviewFromSample: (t) => mut(t, 'mediaType: guessMediaType(originalUrl || sampleUrl),', 'previewUrl: sampleUrl, mediaType: guessMediaType(originalUrl || sampleUrl),'),
};
const FAULTS = [
  ['production body altered', 'rule34 post', PM.bodyAltered, { C00: 'FAIL' }],
  ['wrapper absent (identity unavailable)', 'e621 post', PM.wrapperAbsent, { C00: 'FAIL' }],
  ['Rule34 adapter activation wrong', 'rule34 post', PM.r34AdapterWrong, { C02: 'FAIL' }],
  ['e926 adapter activation wrong', 'e926 post', PM.e6AdapterWrong, { C02: 'FAIL' }],
  ['Rule34 route identity check removed', 'rule34 post', PM.r34NoIdentity, { R04: 'FAIL' }],
  ['e621 post identity check removed', 'e621 post', PM.e6PostNoIdentity, { E04: 'FAIL' }],
  ['e926 listing identity check removed', 'e926 listing (distinct, equal, absent sample)', PM.e6ListingNoIdentity, { EL04: 'FAIL' }],
  ['Rule34 sample/original swapped', 'rule34 post', PM.r34Swapped, { R06: 'FAIL' }],
  ['e621 sample/original swapped', 'e621 post', PM.e6Swapped, { E06: 'FAIL' }],
  ['Rule34 fail-open original restored', 'rule34 post, no native original link (not observed live)', PM.r34FailOpen, { R06: 'FAIL' }],
  ['e621 fail-open sample restored (post)', 'e621 post, no data-sample-url (not observed live)', PM.e6FailOpen, { E06: 'FAIL' }],
  ['e926 fail-open sample restored (listing)', 'e926 listing (distinct, equal, absent sample)', PM.e6FailOpen, { EL06: 'FAIL' }],
  ['request while producing a Rule34 Post', 'rule34 post', PM.familyRequest, { C13: 'FAIL', C14: 'FAIL' }],
  ['request while producing an e926 Post', 'e926 post', PM.e6Request, { C13: 'FAIL', C14: 'FAIL' }],
  ['Rule34 preview filled from the sample again', 'rule34 post', PM.r34PreviewFromSample, { R09: 'FAIL' }],
  ['Rule34 family site label restored', 'rule34 post', PM.r34FamilySite, { R11: 'FAIL' }],
];
// Postamble leak mutants (sanitation must catch each).
const LEAKS = [
  ['raw page URL in result', 'rule34 post', (t) => mut(t, "      context: ctx.context,\n", '      context: ctx.context,\n      page: location.href,\n')],
  ['raw sample URL in Rule34 check detail', 'rule34 post', (t) => mut(t, "{ nativeOriginalLinkPresent: !!originalLink });", '{ nativeOriginalLinkPresent: !!originalLink, raw: nativeSample });')],
  ['card ids in e621 listing observations', 'e621 listing (distinct, equal, absent sample)', (t) => mut(t, 'return { requestsDuringPost, observations: counts };', 'return { requestsDuringPost, observations: { ...counts, ids } };')],
  ['post tags in e926 post observations', 'e926 post', (t) => mut(t, "return { requestsDuringPost, observations: { sampleState: r ? r.sampleState : null } };", 'return { requestsDuringPost, observations: { sampleState: r ? r.sampleState : null, tags: post && post.allTags } };')],
];

(async () => {
  for (const [name, fixture] of Object.entries(SCENARIOS)) {
    const r = await runScript(fixture, derived);
    const expFail = EXPECTED_FAIL[name] || [];
    const expNa = EXPECTED_NA[name] || [];
    const bad = Object.entries(r.status).filter(([id, st]) => (expFail.includes(id) ? st !== 'FAIL' : expNa.includes(id) ? st !== 'NOT_APPLICABLE' : !['PASS', 'NOT_APPLICABLE'].includes(st) || (st === 'NOT_APPLICABLE' && !['R07'].includes(id))));
    check(`scenario verdicts as expected: ${name}`, bad.length === 0 && r.status.C00 === 'PASS', JSON.stringify(r.status));
    check(`scenario sanitized: ${name}`, leaks(r.text).length === 0, leaks(r.text).join(', '));
    check(`scenario production requests zero: ${name}`, r.result.observations.requests.sincePostambleLoad.total === 0);
  }
  for (const [name, scenario, mutate, expect] of FAULTS) {
    const r = await runScript(SCENARIOS[scenario], mutate(derived));
    const ok = Object.entries(expect).every(([id, st]) => r.status[id] === st);
    check(`fault flips its check: ${name}`, ok, JSON.stringify(r.status));
  }
  for (const [name, scenario, mutate] of LEAKS) {
    const r = await runScript(SCENARIOS[scenario], mutate(derived));
    check(`sanitation catches leak mutant: ${name}`, leaks(r.text).length > 0, 'mutant output not flagged');
  }
  const failed = results.filter((x) => !x.pass);
  console.log(JSON.stringify({ suite: 'ib07-r34e6-production-conformance-verify', total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
