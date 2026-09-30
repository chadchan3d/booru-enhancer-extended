'use strict';
// Local qualification for IB09_Dwell_Live_Check.user.js (no live site).
// Static: the package is pinned. The derived script is current; its body minus
// the observe-only hooks equals applyDwellPrototype(committed production
// 91fa86d, 200 ms); metadata is narrowed. Runtime: the REAL derived script
// runs in jsdom with a fake clock (performance.now is tied to it) and a
// synthetic image-load / Resource Timing model. Scripted pointer sequences
// stand in for the operator here only; the probe itself generates no events.
// Checks cover the invariants, timing attribution under cache/no-entry,
// sanitation and bounded sampling. Every fault-control mutant must be caught.
// Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib09_live_package.cjs');
const { split, WRAP_OPEN, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');
const { applyDwellPrototype, mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

// ---- static pinning ----
const derived = fs.readFileSync(b.OUT, 'utf8');
const built = b.build();
const REPO = path.resolve(__dirname, '../../..');
const prodAtCommit = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
check('derived script matches a fresh build', derived === built.text);
check('production blob at the pinned commit is bbaf9ac', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB);
const bodyInScript = derived.slice(derived.indexOf(WRAP_OPEN) + WRAP_OPEN.length, derived.indexOf(WRAP_CLOSE));
check('executed body minus the observe-only hooks equals the qualified 200 ms prototype of the committed production', b.stripHooks(bodyInScript) === split(applyDwellPrototype(prodAtCommit, { dwellMs: 200 })).body);
check('hooks are pure additions: 8 IB09L_HOOK calls, each guarded by typeof, none assigns production state', (bodyInScript.match(/IB09L_HOOK\(/g) || []).length === 8 && (bodyInScript.match(/typeof IB09L_HOOK === 'function' && IB09L_HOOK\(/g) || []).length === 8);
check('dwell constant in the executed body is 200', /const HOVER_DWELL_MS = 200;/.test(bodyInScript));
const meta = split(derived).meta.split('\n');
check('only e621/e926 matched and connected; no update target', meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === '*://e621.net/*,*://e926.net/*' && !meta.some((l) => /@(downloadURL|updateURL)/.test(l)));
const post = derived.slice(derived.indexOf(b.POSTAMBLE_MARKER));
check('observer makes no request, storage, cookie or settings write, and dispatches no pointer events', !/\bfetch\(|XMLHttpRequest|GM_xmlhttpRequest\(|localStorage|sessionStorage|document\.cookie|settings\.set\(|dispatchEvent|new MouseEvent|new PointerEvent/.test(post));

// ---- runtime model ----
const M = hh.M;
async function run({ url = 'https://e621.net/posts', quality = 'preview', text = derived, model = {}, script, html = null }) {
  const { delay = 150, cachedSamples = false } = model;
  const menu = {}; let clock = null; const entries = []; const pending = new Set(); const cached = new Set();
  const c = h.load({ url, html: html || hh.listing(new URL(url).hostname, 4).html, source: text, settings: { 'be:setting:media.thumbQuality': JSON.stringify(quality) }, setup: (w) => {
    clock = hh.installFakeClock(w);
    w.performance.now = () => clock.now();
    w.performance.getEntriesByName = (n, t) => entries.filter((e) => e.name === n && (!t || e.entryType === t));
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    w.GM_registerMenuCommand = (name, fn) => { menu[name] = fn; return 0; };
    const desc = Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype, 'src');
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', { configurable: true, get() { return desc.get.call(this); }, set(v) {
      desc.set.call(this, v);
      if (this.closest && this.closest('article')) return;
      const u = String(v); const img = this;
      if (u === 'data:,') { if (img.__cancel) img.__cancel(); return; }
      const isCached = cached.has(u) || (cachedSamples && u.includes('/sample/'));
      const start = clock.now(); let cancelled = false;
      pending.add(img); img.__cancel = () => { cancelled = true; pending.delete(img); };
      w.setTimeout(() => {
        if (cancelled) return;
        if (!isCached) entries.push({ name: u, entryType: 'resource', startTime: start, duration: clock.now() - start, transferSize: 300 * 1024 + 300, encodedBodySize: 300 * 1024, decodedBodySize: 600 * 1024 });
        cached.add(u); pending.delete(img); img.dispatchEvent(new w.Event('load'));
      }, isCached ? 5 : delay);
    } });
    Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { configurable: true, get() { return !pending.has(this); } });
    Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { configurable: true, get() {
      const p = this.parentElement;
      if (p && p.localName === 'picture') for (const ch of p.children) { if (ch === this) break; if (ch.localName === 'source' && ch.getAttribute('srcset')) return new URL(ch.getAttribute('srcset').trim().split(/\s+/)[0], w.location.href).href; }
      return this.getAttribute('src') ? new URL(this.getAttribute('src'), w.location.href).href : '';
    } });
  } });
  const w = c.window;
  await h.sleep(30); await clock.advance(400);
  const cards = [...w.document.querySelectorAll('article')];
  const img = (i) => cards[i].querySelector('img');
  const api = {
    enter: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(0); },
    leave: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(0); },
    wait: (ms) => clock.advance(ms),
    menu: async (label) => { const k = Object.keys(menu).find((x) => x.startsWith(label)); const p = menu[k](); await clock.advance(2000); return p; },
  };
  { const k = Object.keys(menu).find((x) => x.startsWith('IB09L: Start session — ordinary')); menu[k](); await clock.advance(0); }
  const own = () => [...w.document.querySelectorAll('[id^="ib09l"]')];
  const uiAtStart = { resultBox: !!w.document.querySelector('#ib09l-result'), textareas: w.document.querySelectorAll('textarea').length,
    ownElements: own().length, allClickThrough: own().every((el) => el.style.pointerEvents === 'none'), toastSmall: own().every((el) => el.id !== 'ib09l-toast' || (el.style.maxWidth === '280px' && el.style.position === 'fixed')) };
  await clock.advance(3000);
  const uiAfter = { ownElements: own().length };
  await script(api);
  const uiDuring = { resultBox: !!w.document.querySelector('#ib09l-result'), nonClickThrough: own().filter((el) => el.style.pointerEvents !== 'none').length };
  await api.menu('IB09L: Show results');
  const txt = w.document.querySelector('#ib09l-result textarea')?.value || '';
  let json = null; try { json = JSON.parse(txt); } catch { json = null; }
  const out = { text: txt, json, network: c.requests.length, uiAtStart, uiAfter, uiDuring };
  w.close();
  return out;
}
// Operator-like pointer mix (for the verifier only): quick passes, dwells, A->B, re-entry, leave before completion.
const MIX = async (a) => {
  for (const [i, stay] of [[0, 40], [1, 120], [2, 199], [0, 300], [1, 800], [2, 250], [3, 60]]) { await a.enter(i); await a.wait(stay); await a.leave(i); await a.wait(30); }
  await a.enter(0); await a.wait(30); await a.leave(0); await a.enter(1); await a.wait(400); await a.leave(1); await a.wait(30);  // A->B
  await a.enter(2); await a.wait(50); await a.leave(2); await a.enter(2); await a.wait(400); await a.leave(2); await a.wait(30);  // re-entry
  await a.enter(3); await a.wait(260); await a.leave(3); await a.wait(400);                                                      // leave before load completes
};
const RAW = ['101', '102', '103', '104', '0123456789abcdef', 'static.example', 'http'];
const leaks = (t) => RAW.filter((r) => t.includes(r));

async function main() {
  for (const host of ['e621.net', 'e926.net']) {
    const r = await run({ url: `https://${host}/posts`, quality: 'preview', script: MIX });
    const s = r.json && r.json.sessions && r.json.sessions[0];
    check(`${host} preview: identity MATCH, site`, r.json && r.json.production_body_identity === 'MATCH_EXPECTED_ARTIFACT' && r.json.site === host, r.text.slice(0, 200));
    check(`${host} preview: 12 generations, PREVIEW at entry, 6 quick passes under dwell, 6 dwells`, s && s.generations === 12 && s.entryRendition.PREVIEW === 12 && s.quickPassesUnderDwell === 6 && s.dwellReached === 6, JSON.stringify(s));
    check(`${host} preview: zero new hover media before dwell (hooks) and zero Resource Timing card-media loads before dwell; quick passes start nothing`, s && s.newMediaBeforeDwell === 0 && s.resourceTimingLoadsBeforeDwell === 0 && s.quickPassesStartingUpgrade === 0 && s.thumbNotDisplayedRendition === 0, JSON.stringify(s));
    check(`${host} preview: one SAMPLE upgrade per eligible dwell, none before 200 ms`, s && s.previewUpgrades.eligibleGenerations === 6 && s.previewUpgrades.started === 6 && s.previewUpgrades.exactlyOnePerGeneration && s.previewUpgrades.startedBeforeDwell === 0 && s.previewUpgrades.startOffsetMs.min >= 200 && JSON.stringify(s.previewUpgrades.targetSlots) === '{"SAMPLE":6}', JSON.stringify(s && s.previewUpgrades));
    check(`${host} preview: every started upgrade is displayed or left before displayable; cold loads NETWORK (displayable 150 ms after dwell), repeats NO_ENTRY (about 10 ms)`, s && s.previewUpgrades.displayed + s.previewUpgrades.leftBeforeDisplayable === 6 && s.previewUpgrades.leftBeforeDisplayable === 3 && s.previewUpgrades.displayableAfterDwellMs.max === 150 && s.previewUpgrades.displayableAfterDwellMs.min === 10 && s.previewUpgrades.costClasses.NETWORK === 3 && s.previewUpgrades.costClasses.NO_ENTRY === 3 && s.previewUpgrades.networkTransferKiB.median === 300, JSON.stringify(s && s.previewUpgrades));
    check(`${host} preview: generation-safe (stale blocked, never installed); A->B and re-entry recorded`, s && s.staleInstalled === 0 && s.staleBlocked >= 0 && s.movedFromAnotherCard >= 1 && s.reentrySameCard >= 1, JSON.stringify(s));
    check(`${host} preview: no leak; no enhancer network request`, leaks(r.text).length === 0 && r.network === 0, leaks(r.text).join(','));
    for (const [q, slot] of [['sample', 'SAMPLE'], ['original', 'FILE']]) {
      const x = await run({ url: `https://${host}/posts`, quality: q, script: MIX });
      const sx = x.json && x.json.sessions[0];
      check(`${host} ${q}: entry ${slot}; no upgrade on SAMPLE/FILE cards; FILE never downgraded`, sx && sx.entryRendition[slot] === 12 && sx.upgradesOnSampleOrFileCards === 0 && sx.fileDowngradedToSample === 0 && sx.newMediaBeforeDwell === 0, JSON.stringify(sx));
    }
  }
  // Cache / no-entry: timing still attributed from the hooks.
  {
    const r = await run({ quality: 'preview', model: { cachedSamples: true }, script: MIX });
    const s = r.json.sessions[0];
    check('cached samples (NO_ENTRY): upgrade start still attributed at >= 200 ms from hooks; cost class NO_ENTRY, not zero-cost', s.previewUpgrades.started === 6 && s.previewUpgrades.startOffsetMs.min >= 200 && s.previewUpgrades.costClasses.NO_ENTRY === 6 && s.previewUpgrades.networkTransferKiB === 'NONE', JSON.stringify(s.previewUpgrades));
  }
  // Bounded sampling.
  {
    const many = async (a) => { for (let k = 0; k < 90; k++) { await a.enter(k % 4); await a.wait(20); await a.leave(k % 4); await a.wait(10); } };
    const r = await run({ quality: 'preview', script: many });
    const s = r.json.sessions[0];
    check('bounded sampling: 90 hovers record 80 generations, 10 dropped', s.generations === 80 && s.droppedBeyondCap === 10, JSON.stringify([s.generations, s.droppedBeyondCap]));
  }

  // UI correction (revision 1.1): non-blocking during recording; results only on request.
  {
    const r = await run({ quality: 'preview', script: MIX });
    check('starting a session leaves no result box and no textarea; only a small click-through toast', r.uiAtStart.resultBox === false && r.uiAtStart.textareas === 0 && r.uiAtStart.ownElements === 1 && r.uiAtStart.allClickThrough && r.uiAtStart.toastSmall, JSON.stringify(r.uiAtStart));
    check('the acknowledgement disappears by itself; nothing of the observer remains over the gallery while recording', r.uiAfter.ownElements === 0 && r.uiDuring.resultBox === false && r.uiDuring.nonClickThrough === 0, JSON.stringify([r.uiAfter, r.uiDuring]));
    check('Show results still returns the sanitized session output', r.json && r.json.version === '1.2.0' && r.json.sessions.length === 1 && leaks(r.text).length === 0, r.text.slice(0, 200));
    // Session data unchanged by the UI correction: same pointer sequence through the previous package (a9543c9).
    const prevPkg = execFileSync('git', ['-C', REPO, 'show', 'a9543c9:tests/browser/ib09/IB09_Dwell_Live_Check.user.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const prevBody = prevPkg.slice(prevPkg.indexOf(WRAP_OPEN) + WRAP_OPEN.length, prevPkg.indexOf(WRAP_CLOSE));
    check('pinning unchanged: the executed body is identical to the previous package body (same production + 200 ms prototype + hooks)', prevBody === bodyInScript);
    const old = await run({ quality: 'preview', text: prevPkg, script: MIX });
    // Every field the previous package reported is unchanged (1.2 only adds fields; this fixture is all STILL cards).
    const pick = (a, b) => (Array.isArray(a) ? a.map((x, i) => pick(x, b ? b[i] : undefined)) : a && typeof a === 'object' ? Object.fromEntries(Object.keys(a).map((k) => [k, pick(a[k], b ? b[k] : undefined)])) : b);
    check('session data unchanged by the UI and reporting corrections (every previously reported field identical for the same pointer sequence)', JSON.stringify(old.json.sessions) === JSON.stringify(pick(old.json.sessions, r.json.sessions)), JSON.stringify([old.json.sessions[0].previewUpgrades, r.json.sessions[0].previewUpgrades]));
    check('regression: the previous package opened a blocking result box at session start (the reported defect)', old.uiAtStart.resultBox === true && old.uiAtStart.allClickThrough === false, JSON.stringify(old.uiAtStart));
    // Usefulness marks.
    const marked = await run({ quality: 'preview', script: async (a) => {
      await a.enter(0); await a.wait(500); await a.leave(0); await a.wait(30); await a.menu('IB09L: Mark last upgrade — useful');
      await a.enter(1); await a.wait(500); await a.leave(1); await a.wait(30); await a.menu('IB09L: Mark last upgrade — noticeable but late');
      await a.menu('IB09L: Mark last upgrade — too late');  // same upgrade: must not double-count
    } });
    const u = marked.json.sessions[0].usefulness;
    check('usefulness marks: one per upgrade, not double-counted; no pointer events generated', u.useful === 1 && u.late === 1 && u.tooLate === 0 && marked.json.sessions[0].generations === 2, JSON.stringify(u));
  }

  // Target-slot provenance regression (e621 A diagnosis): true SAMPLE, SAMPLE/FILE alias,
  // pure FILE (a video post: native file is webm), absent sample, empty sample.
  const H2 = '0123456789abcdef0123456789abcdef';
  const mixCard = (id, { ext = 'png', sample = 'distinct' } = {}) => {
    const file = `${M}/data/${H2}_${id}.${ext}`; const samp = `${M}/data/sample/${H2}_${id}.jpg`;
    const sampleAttr = sample === 'absent' ? '' : sample === 'empty' ? 'data-sample-url=""' : `data-sample-url="${sample === 'alias' ? file : samp}"`;
    return `<article class="thumbnail" data-id="${id}" data-file-ext="${ext}" data-file-url="${file}" ${sampleAttr} data-preview-url="${M}/data/preview/${H2}_${id}.jpg" data-preview-webp="${M}/data/preview/${H2}_${id}.webp"><a href="/posts/${id}"><picture><source srcset="${M}/data/preview/${H2}_${id}.webp" type="image/webp"><source srcset="${M}/data/preview/${H2}_${id}.jpg" type="image/jpeg"><img src="${M}/data/preview/${H2}_${id}.jpg" alt=""></picture></a></article>`;
  };
  const MIXED = `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${[mixCard('101'), mixCard('102', { sample: 'alias' }), mixCard('103', { ext: 'webm' }), mixCard('104', { sample: 'absent' }), mixCard('105', { sample: 'empty' })].join('')}</section></body></html>`;
  const HOVER_ALL = async (a) => { for (let i = 0; i < 5; i++) { await a.enter(i); await a.wait(400); await a.leave(i); await a.wait(30); } };
  {
    const r = await run({ html: MIXED, script: HOVER_ALL });
    const pu = r.json.sessions[0].previewUpgrades; const vid = r.json.sessions[0].otherMediaClasses.VIDEO;
    check('target provenance: STILL eligible 4; started 2 = one true SAMPLE + one SAMPLE/FILE alias; zero pure FILE; the 2 cards without a usable sample start nothing',
      pu.eligibleGenerations === 4 && pu.started === 2 && pu.nativeSampleTargets === 1 && pu.sampleFileAliasTargets === 1 && pu.pureFileTargets === 0 && pu.eligibleWithoutUsableSample === 2 && pu.startedWithoutUsableSample === 0 && JSON.stringify(pu.upgradeKinds) === '{"upgrade":2}', JSON.stringify(pu));
    check('video post reported separately (IB10 scope): 1 generation, one after-dwell upgrade-video to FILE, none before dwell', vid.generations === 1 && vid.upgradesStarted === 1 && JSON.stringify(vid.upgradeKinds) === '{"upgrade-video":1}' && JSON.stringify(vid.targetSlots) === '{"FILE":1}' && vid.startedBeforeDwell === 0, JSON.stringify(vid));
    check('media classes tallied from native file extensions', JSON.stringify(r.json.sessions[0].mediaClasses) === '{"STILL":4,"VIDEO":1}', JSON.stringify(r.json.sessions[0].mediaClasses));
    const prev = execFileSync('git', ['-C', REPO, 'show', 'e93fe4e:tests/browser/ib09/IB09_Dwell_Live_Check.user.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const o = await run({ html: MIXED, text: prev, script: HOVER_ALL });
    check('regression: the previous package (1.1) counts the video post as a PREVIEW still upgrade with a FILE target (the e621 A shape)', o.json.sessions[0].previewUpgrades.targetSlots.FILE === 1 && o.json.sessions[0].previewUpgrades.eligibleGenerations === 5, JSON.stringify(o.json.sessions[0].previewUpgrades));
    const prevBody2 = prev.slice(prev.indexOf(WRAP_OPEN) + WRAP_OPEN.length, prev.indexOf(WRAP_CLOSE));
    check('executed body unchanged by the reporting correction (identical to package 1.1)', prevBody2 === bodyInScript);
  }

  // ---- fault controls ----
  const body = bodyInScript;
  const withBody = (nb) => derived.replace(body, nb).replace(built.bodySha, crypto.createHash('sha256').update(nb, 'utf8').digest('hex')); // re-pinned so behavior (not C00) is tested
  const mb = (a, bb) => withBody(mustReplace(body, a, bb));
  const faults = [
    ['package not pinned (body altered without re-pinning)', derived.replace('const HOVER_DWELL_MS = 200;', 'const HOVER_DWELL_MS = 201;'), 'preview', (x) => x.json.production_body_identity !== 'MATCH_EXPECTED_ARTIFACT'],
    ['upgrade before 200 ms (dwell 150)', mb('const HOVER_DWELL_MS = 200;', 'const HOVER_DWELL_MS = 150;'), 'preview', (x) => x.json.sessions[0].newMediaBeforeDwell > 0 || x.json.sessions[0].previewUpgrades.startedBeforeDwell > 0],
    ['SAMPLE -> SAMPLE', withBody(mustReplace(mustReplace(body, '\t\t\treturn showingPreview && same(resolved.url, wrap.dataset.sampleUrl) && !same(resolved.url, current);', '\t\t\treturn true;'), "\t\t\tif (resolved.mediaType !== 'video' && resolved.url === currentThumbUrl) {\n\t\t\t\tclearMediaState();\n\t\t\t\treturn;\n\t\t\t}", '')), 'sample', (x) => x.json.sessions[0].upgradesOnSampleOrFileCards > 0],
    ['FILE -> SAMPLE', mb('\t\t\tif (!hoverUpgradeEligible(sourceImg, resolved)) { clearMediaState(); return; }\n', ''), 'original', (x) => x.json.sessions[0].fileDowngradedToSample > 0],
    ['stale install after leave (hide invalidates nothing)', mb("\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n\t\t\trequestToken++;\n\t\t\tactiveUpgradeUrl = '';\n\t\t\tclearMediaState();\n\t\t\tcancelPendingUpgrade();", '\t\tfunction hide() {\n\t\t\tclearMediaState();'), 'preview', (x) => x.json.sessions[0].staleInstalled > 0],
    ['old-generation work after re-entry', withBody(mustReplace(mustReplace(mustReplace(body, '\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n', '\t\tfunction hide() {\n'), "\t\t\tclearTimeout(dwellTimer);\n\n\t\t\t// V3", '\n\t\t\t// V3'), "\t\tasync function afterDwell(img, token) {\n", '\t\tasync function afterDwell(img, token) {\n\t\t\ttoken = requestToken;\n')), 'preview', (x) => x.json.sessions[0].newMediaBeforeDwell > 0 || x.json.sessions[0].previewUpgrades.startedBeforeDwell > 0 || x.json.sessions[0].quickPassesStartingUpgrade > 0],
    ['timing attributed from Resource Timing instead of the hooks (cache/no-entry)', derived.replace("      const rec = { t, kind: d.kind, slot, token: d.token, url: d.url };", "      if (d.kind !== 'thumb') return;\n      const rec = { t, kind: d.kind, slot, token: d.token, url: d.url };"), 'preview-cached', (x) => x.json.sessions[0].previewUpgrades.started !== 6],
    ['raw URL leakage', derived.replace("const leaked = [...raw].some((v) => text.includes(v)) || /https?:\\/\\//i.test(text);", 'const leaked = false;').replace("probe: 'ib09l-dwell-live-check', version: '1.2.0', site: SITE,", "probe: 'ib09l-dwell-live-check', version: '1.2.0', site: SITE, u: document.querySelector('article').getAttribute('data-sample-url'),"), 'preview', (x) => leaks(x.text).length > 0],
    ['ID leakage', derived.replace("const leaked = [...raw].some((v) => text.includes(v)) || /https?:\\/\\//i.test(text);", 'const leaked = false;').replace("probe: 'ib09l-dwell-live-check', version: '1.2.0', site: SITE,", "probe: 'ib09l-dwell-live-check', version: '1.2.0', site: SITE, id: document.querySelector('article').getAttribute('data-id'),"), 'preview', (x) => leaks(x.text).length > 0],
    ['unbounded sampling', derived.replace('const MAX_GENERATIONS = 80;', 'const MAX_GENERATIONS = 100000;'), 'preview-many', (x) => x.json.sessions[0].generations > 80],
  ];
  // Target-provenance fault controls on the mixed fixture.
  {
    const fileFallback = withBody(mustReplace(body, '\t\t\treturn showingPreview && same(resolved.url, wrap.dataset.sampleUrl) && !same(resolved.url, current);', '\t\t\treturn showingPreview && (same(resolved.url, wrap.dataset.sampleUrl) || same(resolved.url, wrap.dataset.fileUrl)) && !same(resolved.url, current);'));
    const f1 = await run({ html: MIXED, text: fileFallback, script: HOVER_ALL });
    check('fault erroneous FILE fallback when the sample is absent/invalid: caught (pure FILE target on STILL cards)', f1.json.sessions[0].previewUpgrades.pureFileTargets > 0 && f1.json.sessions[0].previewUpgrades.startedWithoutUsableSample > 0, JSON.stringify(f1.json.sessions[0].previewUpgrades));
    const videoAsStill = derived.replace("if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'STILL';", "return 'STILL';");
    const f2 = await run({ html: MIXED, text: videoAsStill, script: HOVER_ALL });
    check('fault observer counts a video post as STILL: caught (pure FILE target appears in the still-image rule)', videoAsStill !== derived && f2.json.sessions[0].previewUpgrades.pureFileTargets > 0, JSON.stringify(f2.json.sessions[0].previewUpgrades));
  }
  for (const [name, text, mode, caught] of faults) {
    if (text === derived) { check(`fault ${name}: mutant applied`, false, 'no change'); continue; }
    const quality = mode.startsWith('preview') ? 'preview' : mode;
    const script = mode === 'preview-many' ? async (a) => { for (let k = 0; k < 90; k++) { await a.enter(k % 4); await a.wait(20); await a.leave(k % 4); await a.wait(10); } } : MIX;
    let x; try { x = await run({ quality, text, model: { cachedSamples: mode === 'preview-cached' }, script }); } catch (e) { check(`fault ${name}: caught by crash`, true); continue; }
    let ok = false; try { ok = caught(x); } catch { ok = true; }
    check(`fault ${name}: caught`, ok, x.text.slice(0, 250));
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'E-stage held-out live check package (200 ms candidate), local qualification', production_commit: b.COMMIT, production_blob: b.EXPECTED_PRODUCTION_BLOB, executed_body_sha256: built.bodySha,
    derived_script: path.basename(b.OUT), derived_script_sha256: crypto.createHash('sha256').update(derived).digest('hex'), checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB09_LIVE_CHECK_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
