'use strict';
// IB13-E0 downloader baseline (characterization, not a repair test). It runs the
// REAL current production source (item9 harness, jsdom) with a FAKE download manager
// and intercepted anchor clicks on fake time; no file is written and no real manager
// is used. Each case records two different counts that IB13 must keep apart:
//   logical JS outcomes  - settlements of downloadPost (its Promise value + the one
//                          completion/fallback/failure toast);
//   underlying dispatches - transfer/handoff opportunities actually started:
//                          manager calls (GM_download / GM.download) + anchor clicks.
// A check PASSES when it reproduces the stated current-production fact. The facts
// include known defects (the 8 s overlap); passing means "baseline reproduced".
// Usage: node tests/host/ib13/e0_downloader_baseline.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));

const SRC = h.productionSource();
const ORIG = 'https://static.example/data/ab/cd/0123456789abcdef.png';

// mode: how the fake manager behaves. 'gm' = GM_download (callbacks; returns {abort});
// 'promise' = GM.download only (Promise, no callbacks); 'both' = GM_download that calls
// back AND returns a Promise.
async function session({ mode = 'gm', settings = {} } = {}) {
  let clock = null; const calls = []; const anchors = []; const toasts = [];
  const fx = hh.listing('e621.net', 1);
  const c = h.load({ url: fx.url, html: fx.html, settings, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    const record = (opts) => { const call = { url: opts.url, name: opts.name, opts, aborted: 0 }; calls.push(call); return call; };
    if (mode === 'gm' || mode === 'both') {
      w.GM_download = (opts) => {
        const call = record(opts);
        const handle = { abort() { call.aborted++; } };
        if (mode === 'both') return Object.assign(new w.Promise((res, rej) => { call.res = res; call.rej = rej; }), handle);
        return handle;
      };
    } else {
      w.GM_download = undefined;
      w.GM = { download: (opts) => { const call = record(opts); return new w.Promise((res, rej) => { call.res = res; call.rej = rej; }); } };
    }
    w.HTMLAnchorElement.prototype.click = function interceptedClick() { anchors.push({ href: this.href, download: this.download, t: clock.now() }); };
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const BE = c.BE;
  const showOrig = BE.modules.toast.show;
  BE.modules.toast.show = function recorded(text, kind) { toasts.push({ text: String(text), kind, t: clock.now() }); return showOrig.apply(this, arguments); };
  const outcomes = [];
  const post = (id) => ({ id: String(id), originalUrl: ORIG.replace('0123456789abcdef', `0123456789ab${id}`), sampleUrl: '', previewUrl: '', mediaType: 'image', md5: '', rating: 'safe', score: 0,
    artists: ['artist_b'], characters: ['char_a'], copyrights: ['copy_c'], generalTags: [], metaTags: [], allTags: [], createdAt: '', width: 0, height: 0 });
  const start = (id = 501) => { const p = BE.modules.downloader.downloadPost(post(id)); p.then((v) => outcomes.push({ id, value: v, t: clock.now() })); return p; };
  const settlementToasts = () => toasts.filter((x) => /^Download complete|^Download started via browser|^Download failed$/.test(x.text));
  const flush = () => clock.advance(0);
  return { w, BE, clock, calls, anchors, toasts, outcomes, start, settlementToasts, flush,
    counts: () => ({ logicalOutcomes: outcomes.length, settlementToasts: settlementToasts().length, managerCalls: calls.length, anchorDispatches: anchors.length, underlyingDispatches: calls.length + anchors.length, aborts: calls.reduce((n, x) => n + x.aborted, 0) }) };
}

const CASES = [
  ['E0-1 slow unresolved GM transfer past 8 s: at 7999 ms nothing else happens; at 8000 ms the browser fallback anchor dispatches while the manager attempt is still unresolved and NOT aborted; one JS settlement (true, "Download started via browser"); a later manager success still arrives and is ignored by JS - 1 logical outcome, 2 underlying dispatches', async () => {
    const s = await session(); s.start(); await s.clock.advance(7999); const before = s.counts();
    await s.clock.advance(1); const at8 = s.counts();
    s.calls[0].opts.onload(); await s.flush(); const late = s.counts();
    return { before, at8, late, fallbackToast: s.settlementToasts().map((x) => x.text),
      ok: before.anchorDispatches === 0 && before.logicalOutcomes === 0 && at8.anchorDispatches === 1 && at8.aborts === 0 && at8.logicalOutcomes === 1 && s.outcomes[0].value === true
        && /^Download started via browser/.test(s.settlementToasts()[0].text) && late.logicalOutcomes === 1 && late.underlyingDispatches === 2 && late.settlementToasts === 1 }; }],
  ['E0-2 manager terminal error (onerror): an automatic second dispatch (anchor) follows immediately; 1 logical outcome, 2 underlying dispatches', async () => {
    const s = await session(); s.start(); await s.flush(); s.calls[0].opts.onerror(new Error('denied')); await s.flush(); const k = s.counts(); await s.clock.advance(9000);
    return { counts: k, after: s.counts(), ok: k.anchorDispatches === 1 && k.logicalOutcomes === 1 && k.underlyingDispatches === 2 && s.counts().underlyingDispatches === 2 }; }],
  ['E0-2b manager timeout callback (ontimeout): the same automatic anchor fallback', async () => {
    const s = await session(); s.start(); await s.flush(); s.calls[0].opts.ontimeout(); await s.flush();
    return { counts: s.counts(), ok: s.counts().anchorDispatches === 1 && s.counts().underlyingDispatches === 2 }; }],
  ['E0-3 callback-only success before 8 s: one manager attempt, no fallback (the still-armed 8 s timer finds it settled)', async () => {
    const s = await session(); s.start(); await s.clock.advance(100); s.calls[0].opts.onload(); await s.clock.advance(9000);
    return { counts: s.counts(), ok: s.counts().managerCalls === 1 && s.counts().anchorDispatches === 0 && s.counts().logicalOutcomes === 1 && s.outcomes[0].value === true && /^Download complete/.test(s.settlementToasts()[0].text) }; }],
  ['E0-4 Promise-only success (GM.download, no callbacks) before 8 s: one manager attempt, no fallback', async () => {
    const s = await session({ mode: 'promise' }); s.start(); await s.clock.advance(100); s.calls[0].res(); await s.clock.advance(9000);
    return { counts: s.counts(), ok: s.counts().managerCalls === 1 && s.counts().anchorDispatches === 0 && s.counts().logicalOutcomes === 1 && s.outcomes[0].value === true }; }],
  ['E0-4b Promise-only rejection: the automatic anchor fallback (2 underlying dispatches)', async () => {
    const s = await session({ mode: 'promise' }); s.start(); await s.flush(); s.calls[0].rej(new Error('failed')); await s.flush();
    return { counts: s.counts(), ok: s.counts().anchorDispatches === 1 && s.counts().underlyingDispatches === 2 && s.counts().logicalOutcomes === 1 }; }],
  ['E0-5 callback + Promise: onload then the Promise also resolves -> both feed the same settlement; settled once; one manager attempt; a later Promise rejection after a callback success is ignored (no fallback)', async () => {
    const a = await session({ mode: 'both' }); a.start(); await a.flush(); a.calls[0].opts.onload(); a.calls[0].res(); await a.clock.advance(9000);
    const b = await session({ mode: 'both' }); b.start(); await b.flush(); b.calls[0].opts.onload(); b.calls[0].rej(new Error('late')); await b.clock.advance(9000);
    const c = await session({ mode: 'both' }); c.start(); await c.flush(); c.calls[0].rej(new Error('first')); await c.flush(); c.calls[0].opts.onload(); await c.flush();
    return { okThenResolve: a.counts(), okThenReject: b.counts(), rejectThenLateOnload: c.counts(),
      ok: a.counts().managerCalls === 1 && a.counts().settlementToasts === 1 && a.counts().anchorDispatches === 0 && b.counts().anchorDispatches === 0 && b.counts().settlementToasts === 1
        && c.counts().anchorDispatches === 1 && c.counts().logicalOutcomes === 1 && c.counts().settlementToasts === 1 }; }],
  ['E0-6 two downloadPost calls for the SAME post before completion: two independent manager attempts (no shared in-flight operation); past 8 s, two anchor fallbacks - 2 logical outcomes, 4 underlying dispatches', async () => {
    const s = await session(); s.start(501); s.start(501); await s.flush(); const k = s.counts(); await s.clock.advance(8000);
    return { beforeTimeout: k, after: s.counts(), sameUrl: s.calls.length === 2 && s.calls[0].url === s.calls[1].url, ok: k.managerCalls === 2 && s.calls[0].url === s.calls[1].url && s.counts().anchorDispatches === 2 && s.counts().underlyingDispatches === 4 && s.counts().logicalOutcomes === 2 }; }],
  ['E0-7 two DIFFERENT posts: independent attempts and settlements (one succeeds, the other times out to its own fallback)', async () => {
    const s = await session(); s.start(501); s.start(502); await s.clock.advance(100); s.calls[0].opts.onload(); await s.clock.advance(8000);
    return { counts: s.counts(), ok: s.counts().managerCalls === 2 && s.calls[0].url !== s.calls[1].url && s.counts().anchorDispatches === 1 && s.anchors[0].href === s.calls[1].url && s.counts().logicalOutcomes === 2 }; }],
  ['E0-8 browser fallback knows only that a.click() was attempted: the intercepted click does nothing, yet downloadPost resolves true with "Download started via browser" - no file completion is known', async () => {
    const s = await session(); s.start(); await s.flush(); s.calls[0].opts.onerror(new Error('x')); await s.flush();
    const a = s.anchors[0];
    return { anchor: { download: a && a.download, hrefIsOriginal: !!a && a.href === s.calls[0].url }, value: s.outcomes[0] && s.outcomes[0].value, ok: !!a && a.download === s.calls[0].name && s.outcomes[0].value === true && /^Download started via browser/.test(s.settlementToasts()[0].text) }; }],
  ['E0-9 download.retries (0 vs 10) does not change the attempt count: a manager error gives the same 1 manager call + 1 anchor in both', async () => {
    const run = async (v) => { const s = await session({ settings: { 'be:setting:download.retries': JSON.stringify(v) } }); const eff = s.BE.settings.get('download.retries'); s.start(); await s.flush(); s.calls[0].opts.onerror(new Error('x')); await s.clock.advance(20000); return { effective: eff, ...s.counts() }; };
    const r0 = await run(0); const r10 = await run(10);
    return { retries0: r0, retries10: r10, ok: r0.effective === 0 && r10.effective === 10 && r0.managerCalls === 1 && r10.managerCalls === 1 && r0.anchorDispatches === 1 && r10.anchorDispatches === 1 }; }],
];

// ---- naming baseline (BE.naming, synthetic tags only) ----
async function naming() {
  const s = await session();
  const { BE } = s;
  const P = (o = {}) => ({ id: '123', originalUrl: 'https://static.example/a/b.png', sampleUrl: '', mediaType: 'image', md5: '', rating: 'safe', score: 7, width: 640, height: 480, createdAt: '2026-01-02T03:04:05Z',
    artists: ['artist_b'], characters: ['char_a'], copyrights: ['copy_c'], ...o });
  const set = (k, v) => BE.settings.set(k, v);
  const out = {};
  out.defaultTemplate = BE.settings.get('download.filenameTemplate');
  out.defaultName = BE.naming.build(P());
  out.maxCharactersDefault3 = BE.naming.build(P({ characters: ['c_one', 'c_two', 'c_three', 'c_four'] }));
  out.unknowns = BE.naming.build(P({ artists: [], characters: [], copyrights: [] }));
  set('download.filenameTemplate', '{copyright} | {artist} | {md5} | {rating} | {score} | {resolution} | {date}');
  out.otherFields = BE.naming.build(P({ copyrights: [] }));
  set('download.tagDelimiter', ' & '); set('download.maxCharacters', 2); set('download.filenameTemplate', '{character}');
  out.delimiterAndMax = BE.naming.build(P({ characters: ['c_one', 'c_two', 'c_three'] }));
  out.qualifierStripped = BE.naming.build(P({ characters: ['name_x_(series_y)'] }));
  set('download.filenameTemplate', '{nonexistent}');
  out.emptyFallsBackToId = BE.naming.build(P());
  out.emptyNoIdFallsBackToDownload = BE.naming.build(P({ id: '' }));
  set('download.filenameTemplate', '{page} {id}');
  out.pageFieldNotSupported = BE.naming.build(P());
  set('download.filenameTemplate', 'a/b\\c?d%e*f:g|h"i<j>k   l');
  out.sanitized = BE.naming.build(P());
  set('download.filenameTemplate', 'x'.repeat(300));
  out.truncatedLength = BE.naming.build(P()).length;
  out.sanitizeEmpty = BE.dom.sanitizeFilename('   ');
  out.ext = {
    png: BE.naming.extensionFor(P()),
    queryStripped: BE.naming.extensionFor(P({ originalUrl: 'https://static.example/a/b.webm?123' })),
    upper: BE.naming.extensionFor(P({ originalUrl: 'https://static.example/a/b.JPG' })),
    sampleUsedWhenNoOriginal: BE.naming.extensionFor(P({ originalUrl: '', sampleUrl: 'https://static.example/s.jpeg' })),
    noExtImage: BE.naming.extensionFor(P({ originalUrl: 'https://static.example/file?ext=png' })),
    noExtVideo: BE.naming.extensionFor(P({ originalUrl: 'https://static.example/file', mediaType: 'video' })),
  };
  let threw = null; try { BE.naming.build({ id: '9' }); } catch (e) { threw = e.constructor.name; }
  out.malformedPostWithoutArrays = threw ? `throws ${threw}` : 'no throw';
  const ep = { id: '9', originalUrl: '', sampleUrl: '', previewUrl: '', mediaType: 'unknown', width: 0, height: 0, fileSize: 0, md5: '', rating: 'unknown', score: 0, artists: [], characters: [], copyrights: [], createdAt: '' };
  set('download.filenameTemplate', '{character} - {artist} ({id})'); set('download.tagDelimiter', ', ');
  out.emptyPostShape = BE.naming.build(ep);
  const expect = {
    defaultTemplate: '{character} - {artist} ({id})',
    defaultName: 'Char A - Artist B (123)',
    maxCharactersDefault3: 'C One, C Two, C Three - Artist B (123)',
    unknowns: 'Unknown Character - Unknown Artist (123)',
    otherFields: 'Unknown Copyright _ Artist B _ 123 _ safe _ 7 _ 640x480 _ 2026-01-02',
    delimiterAndMax: 'C One & C Two',
    qualifierStripped: 'Name X',
    emptyFallsBackToId: '123',
    emptyNoIdFallsBackToDownload: 'download',
    pageFieldNotSupported: '123',
    sanitized: 'a_b_c_d_e_f_g_h_i_j_k l',
    truncatedLength: 180,
    sanitizeEmpty: 'untitled',
    malformedPostWithoutArrays: 'throws TypeError',
    emptyPostShape: 'Unknown Character - Unknown Artist (9)',
  };
  const extExpect = { png: 'png', queryStripped: 'webm', upper: 'JPG', sampleUsedWhenNoOriginal: 'jpeg', noExtImage: 'jpg', noExtVideo: 'mp4' };
  const mism = Object.entries(expect).filter(([k, v]) => out[k] !== v).map(([k]) => k).concat(Object.entries(extExpect).filter(([k, v]) => out.ext[k] !== v).map(([k]) => `ext.${k}`));
  return { observed: out, ok: mism.length === 0, mismatches: mism };
}

// ---- static source facts (entry surfaces, facade, Open Original) ----
function staticFacts() {
  const src = SRC;
  const f = {
    facadeIsDirectGM: /download: \(typeof GM_download === 'function'\) \? GM_download\s*\n\s*: \(\(typeof GM !== 'undefined' && typeof GM\.download === 'function'\) \? \(opts\) => GM\.download\(opts\) : \(\) => undefined\)/.test(src) && /BE\.gm = _GM;/.test(src),
    noRuntimeDownload: !/BE\.runtime\.download\b/.test(src),
    timer8s: /setTimeout\(\(\) => \{ if \(!settled\) finishFail\(new Error\('GM_download timed out'\)\); \}, 8000\);/.test(src),
    fallbackInFinishFail: /const finishFail = \(err\) => \{[\s\S]{0,200}const ok = browserFallbackDownload\(resolved\.originalUrl, filename\);/.test(src),
    retriesReadNotUsed: /const retries = BE\.settings\.get\('download\.retries'\) \?\? 3;/.test(src) && (src.match(/\bretries\b/g) || []).length > 0 && !/retries\s*[-+<>]/.test(src.slice(src.indexOf("const retries = BE.settings.get('download.retries')"), src.indexOf('return { downloadPost, browserFallbackDownload, resolveOriginalUrl };'))),
    downloadPostCallSites: (src.match(/BE\.modules\.downloader\.downloadPost\(/g) || []).length,
    openModeHonoredOnlyInActionHandlers: (src.match(/BE\.settings\.get\('download\.openMode'\)/g) || []).length === 1,
  };
  f.ok = f.facadeIsDirectGM && f.noRuntimeDownload && f.timer8s && f.fallbackInFinishFail && f.retriesReadNotUsed && f.downloadPostCallSites === 4 && f.openModeHonoredOnlyInActionHandlers;
  return f;
}

async function main() {
  const results = [];
  const st = staticFacts();
  results.push({ name: 'E0-S static: BE.gm.download is the direct GM_download / GM.download facade (no BE.runtime download); the 8 s timer and the fallback inside finishFail are present; download.retries is read but unused; 4 downloadPost call sites (viewer button, viewer key, thumbnail action, shared post-page/toolbar handler); download.openMode is read only by the post-page/toolbar Open Original handler', pass: st.ok, observed: st });
  for (const [name, fn] of CASES) { let r; try { r = await fn(); } catch (e) { r = { ok: false, error: e.message }; } results.push({ name, pass: !!r.ok, observed: { ...r, ok: undefined } }); }
  const nm = await naming();
  results.push({ name: 'E0-N naming baseline reproduced (template, ID fallback, max characters, delimiter, Unknown values, qualifier strip, empty-name fallback, no page field, sanitation, 180-char cap, extension inference; malformed Post without arrays throws, the production Post shape does not)', pass: nm.ok, observed: nm });
  const passed = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  -- ${JSON.stringify(r.observed).slice(0, 600)}`}`);
  console.log(`\n${passed}/${results.length} baseline facts reproduced (production blob ${h.gitBlobId(SRC)})`);
  const sanitize = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'opts' || k === 'res' || k === 'rej' ? undefined : (typeof v === 'string' ? v.replace(/https?:\/\/[^\s"]+/g, '<url>') : v))));
  fs.writeFileSync(path.join(__dirname, 'e0-downloader-baseline-result.json'), `${JSON.stringify({ test: 'ib13-e0-downloader-baseline', productionBlob: h.gitBlobId(SRC), passed, total: results.length, results: sanitize(results) }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
