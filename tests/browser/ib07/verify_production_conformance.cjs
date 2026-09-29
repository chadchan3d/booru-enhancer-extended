'use strict';
// Local verification for the IB07 Gelbooru production-conformance build.
// Static: derived script is current, body is byte-identical to the committed artifact,
// metadata changes are limited, postamble uses no network/storage/click APIs.
// Stub: runs the postamble against fake BE/GM/DOM scenarios, confirms each
// check reacts to its defect, and confirms no raw value reaches the output.
// This does not exercise live Gelbooru; that evidence belongs to the operator.
const fs = require('fs');
const path = require('path');
const { build, split, POSTAMBLE_MARKER, WRAP_OPEN, WRAP_FN_HEAD, WRAP_CLOSE, OUT, COMMIT } = require('./build_production_conformance.cjs');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail });

const derived = fs.readFileSync(OUT, 'utf8');
const built = build();
check('derived script matches a fresh build from the committed artifact', derived === built.text);
check('derived script is LF-only', !derived.includes('\r'));
try { new Function(derived); check('derived script parses', true); } catch (e) { check('derived script parses', false, e.message); }

const wrapAt = derived.indexOf(WRAP_OPEN);
const closeAt = derived.indexOf(WRAP_CLOSE);
const markerAt = derived.indexOf(POSTAMBLE_MARKER);
check('production body is byte-identical to the committed artifact inside the wrapper',
  wrapAt > 0 && closeAt > wrapAt && derived.slice(wrapAt + WRAP_OPEN.length, closeAt) === built.body);
check('production body appears exactly once', derived.split(built.body).length === 2);
check('wrapper is invoked exactly once, before the postamble',
  derived.split('IB07P_PRODUCTION_BODY();').length === 2 && derived.indexOf('IB07P_PRODUCTION_BODY();') < markerAt);

// The function object the browser would create for the wrapper. Its
// Function.prototype.toString text is what the postamble hashes.
const wrapperSource = derived.slice(wrapAt + WRAP_OPEN.length - WRAP_FN_HEAD.length, closeAt + 1);
const intendedFn = (0, eval)(`(${wrapperSource})`);
check('engine toString of the wrapper reproduces it exactly', Function.prototype.toString.call(intendedFn) === wrapperSource);

const meta = split(derived).meta.split('\n');
const orig = split(require('child_process').execFileSync('git', ['-C', path.resolve(__dirname, '../../..'), 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 << 20 })).meta.split('\n');
const added = meta.filter((l) => !orig.includes(l));
const removed = orig.filter((l) => !meta.includes(l));
check('metadata adds only name/namespace/match/connect lines',
  added.every((l) => /^\/\/ @(name|namespace|match|connect)\s/.test(l)), JSON.stringify(added));
check('metadata removes only name/namespace/match/connect/update lines',
  removed.every((l) => /^\/\/ @(name|namespace|match|connect|downloadURL|updateURL)\s/.test(l)), JSON.stringify(removed));
check('only gelbooru.com is matched and connected',
  meta.filter((l) => /^\/\/ @match\s/.test(l)).join() === '// @match        *://gelbooru.com/*'
  && meta.filter((l) => /^\/\/ @connect\s/.test(l)).join() === '// @connect      gelbooru.com');
check('no public update target', !meta.some((l) => /@(downloadURL|updateURL)/.test(l)));

const postamble = derived.slice(markerAt);
check('postamble makes no request, click, cookie or page-storage access',
  !/\bfetch\(|XMLHttpRequest|GM_xmlhttpRequest\(|GM_download\(|\.click\(|document\.cookie|localStorage|sessionStorage/.test(postamble));

// ---- stub scenarios ------------------------------------------------------
const ORIGIN = 'https://gelbooru.com';
const ROUTE_ID = '4242424';
const SAMPLE = 'https://media.example//samples/aa/bb/sample_0123456789abcdef0123456789abcdef.jpg';
const ORIGINAL = 'https://media.example/images/aa/bb/0123456789abcdef0123456789abcdef.png';
const RAW = [ROUTE_ID, 'media.example', '0123456789abcdef', '/samples/', '/images/aa'];

function goodPost(over = {}) {
  return {
    id: ROUTE_ID, siteId: 'gelbooru', mediaType: 'image', sampleUrl: SAMPLE, originalUrl: ORIGINAL, previewUrl: '',
    width: 1448, height: 2048, score: 3, rating: 'unknown', fileSize: 0, md5: '', source: '', createdAt: '',
    allTags: [], artists: [], characters: [], copyrights: [], generalTags: [], metaTags: [],
    postUrl: `${ORIGIN}/index.php?page=post&s=view&id=${ROUTE_ID}`, pageCount: 1, ...over,
  };
}

async function scenario({ post = goodPost(), nativeOriginal = ORIGINAL, video = 0, requestInFetch = false, productionFn = intendedFn } = {}) {
  const menu = {};
  const BE = {
    VERSION: 'test',
    net: { _debug: { queueLength: 0, inFlightReadCount: 0 } },
    runtime: { request: () => ({}), nativeFetch: async () => ({}) },
    adapters: { active: null },
  };
  BE.adapters.active = {
    id: 'gelbooru-family',
    isPostPage: () => true,
    getPostId: () => ROUTE_ID,
    fetchPost: async (id) => {
      if (requestInFetch) BE.runtime.request({ url: `${ORIGIN}/index.php?page=dapi&id=${id}` });
      return typeof post === 'function' ? post(id) : post;
    },
  };
  const img = { currentSrc: SAMPLE, getAttribute: () => SAMPLE, naturalWidth: 850, naturalHeight: 1202 };
  const document = {
    querySelector: (s) => (s === 'img#image' ? img : s === 'li a[href*="/images/"]' ? (nativeOriginal ? { href: nativeOriginal } : null) : null),
    querySelectorAll: (s) => (s === 'video' ? { length: video } : s.startsWith('li, dd') ? [{ textContent: 'Size: 1448x2048 | Score: 3' }] : []),
    body: { appendChild() {} },
    createElement: () => ({ style: {}, append() {}, focus() {}, select() {} }),
  };
  const location = { hostname: 'gelbooru.com', origin: ORIGIN, search: `?page=post&s=view&id=${ROUTE_ID}`, href: `${ORIGIN}/index.php?page=post&s=view&id=${ROUTE_ID}` };
  const store = {};
  const fast = postamble.replace('const OBSERVE_MS = 5000;', 'const OBSERVE_MS = 0;');
  const logs = [];
  // GM_info carries no scriptSource, matching Tampermonkey's documented GM_info.
  new Function('window', 'document', 'location', 'navigator', 'console', 'GM_info', 'GM_setValue', 'GM_getValue', 'GM_registerMenuCommand', 'IB07P_PRODUCTION_BODY', fast)(
    { BE }, document, location, { userAgent: 'stub' }, { log: (t) => logs.push(t) },
    { scriptHandler: 'stub', version: '0', scriptMetaStr: '' },
    (k, v) => { store[k] = v; }, (k, d) => store[k] ?? d, (name, fn) => { menu[name] = fn; }, productionFn);
  const result = await menu['IB07P: Run Gelbooru production conformance']();
  const text = logs.join('\n');
  const status = Object.fromEntries(result.checks.map((c) => [c.id, c.status]));
  return { result, text, status };
}

(async () => {
  const leaks = (text) => RAW.filter((r) => text.includes(r));

  let s = await scenario();
  check('happy path: all checks PASS and identity matches the expected artifact',
    s.result.summary.status === 'PASS' && s.status.C00 === 'PASS' && s.status.C08 === 'PASS', JSON.stringify(s.status));
  check('happy path: no raw value in output', leaks(s.text).length === 0, leaks(s.text).join());

  s = await scenario({ post: null, video: 2 });
  check('video-only disable is reported (C12 FAIL, C03 FAIL)', s.status.C12 === 'FAIL' && s.status.C03 === 'FAIL', JSON.stringify(s.status));
  check('video scenario: no raw value in output', leaks(s.text).length === 0);

  s = await scenario({ post: goodPost({ originalUrl: SAMPLE }), nativeOriginal: '' });
  check('original fabricated from sample is reported (C09 FAIL)', s.status.C09 === 'FAIL', JSON.stringify(s.status));

  s = await scenario({ requestInFetch: true });
  check('request during Post production is reported (C13 and C14 FAIL)', s.status.C13 === 'FAIL' && s.status.C14 === 'FAIL', JSON.stringify(s.status));
  check('request scenario: no raw value in output', leaks(s.text).length === 0, leaks(s.text).join());

  s = await scenario({ post: goodPost({ rating: 'safe' }) });
  check('guessed rating is reported (C11 FAIL)', s.status.C11 === 'FAIL');

  s = await scenario({ post: goodPost({ siteId: 'gelbooru-family' }) });
  check('other Post path is reported (C03 FAIL)', s.status.C03 === 'FAIL');

  s = await scenario({ post: goodPost({ pageCount: null }) });
  check('unknown pageCount on the Gelbooru Post is reported (C15 FAIL)', s.status.C15 === 'FAIL', JSON.stringify(s.status));

  s = await scenario({ post: goodPost({ id: '999' }) });
  check('identity disagreement is reported (C04 FAIL)', s.status.C04 === 'FAIL');

  // C00 fault sensitivity: only the intended executed body may match.
  const c00 = async (fn) => { const r = await scenario({ productionFn: fn }); return [r.status.C00, r.result.sourceContract.productionBodyIdentity]; };
  const evalFn = (src) => (0, eval)(`(${src})`);
  let [st, id] = await c00(intendedFn);
  check('C00 PASS for the intended body without GM_info.scriptSource', st === 'PASS' && id === 'MATCH_EXPECTED_ARTIFACT', id);
  [st, id] = await c00(evalFn(wrapperSource.replace('function gelbooruNativeImagePost(id) {', 'function gelbooruNativeImagePost(id) { void 0;')));
  check('C00 FAIL when one production line is altered (MISMATCH)', st === 'FAIL' && id === 'MISMATCH', id);
  [st, id] = await c00(evalFn(wrapperSource.replace(/\}$/, 'void 0;\n}')));
  check('C00 FAIL when a statement is appended to the body (MISMATCH)', st === 'FAIL' && id === 'MISMATCH', id);
  [st, id] = await c00(evalFn(`${WRAP_FN_HEAD}/* imitation made by a harness */\n}`));
  check('C00 FAIL for a harness-manufactured stand-in (MISMATCH)', st === 'FAIL' && id === 'MISMATCH', id);
  [st, id] = await c00(null); // null, not undefined: undefined would select the default
  check('C00 FAIL when the wrapper is absent (UNAVAILABLE)', st === 'FAIL' && id === 'UNAVAILABLE', id);
  [st, id] = await c00(evalFn(wrapperSource.replace(/\n/g, '\r\n')));
  check('C00 PASS when the manager stored the same body with CRLF', st === 'PASS' && id === 'MATCH_EXPECTED_ARTIFACT', id);

  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({ suite: 'ib07-gelbooru-production-conformance-verify', total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exitCode = 1;
})();
