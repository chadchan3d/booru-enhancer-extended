'use strict';
// Local qualification for IB08_V9R_Ownership_Experiment.user.js (no live site).
// jsdom has no image selection, so currentSrc is modelled on the prototype:
// the first <source> before the <img> in its <picture> with a supported type
// and a srcset wins, otherwise img src. The model is live, so every attribute
// or node change is reflected immediately. The verifier checks the
// experiment's self-report AND the final DOM independently, watches untouched
// cards, counts network/storage/cookie/GM/click paths, scans outputs for raw
// planted values, and requires every fault-control mutant to be caught.
// Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require(path.resolve(__dirname, '../../host/ib07/node_modules/jsdom'));

const FILE = 'IB08_V9R_Ownership_Experiment.user.js';
const SRC = fs.readFileSync(path.join(__dirname, FILE), 'utf8').replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

const H = '0123456789abcdef0123456789abcdef';
const RAW = ['9000', H, 'q7', 'static.example', 'http', 'secret_tag', 'Secret Title', 'some_person', '2026-01-01T00', '/posts/', '/data/', '?sig=', '#frag'];
const leaks = (text) => RAW.filter((r) => text.includes(r));
// A mutant that throws inside an async menu handler must count as caught, not kill the verifier.
let asyncCrashes = 0;
process.on('unhandledRejection', () => { asyncCrashes++; });

// ---- fixtures -----------------------------------------------------------------
const M = 'https://static.example';
const U = (id) => ({
  file: `${M}/data/q7/${H}.png?sig=${id}`, sample: `${M}/data/sample/q7/${H}.jpg?sig=${id}`,
  preview: `${M}/data/preview/q7/${H}.jpg?sig=${id}`, webp: `${M}/data/preview/q7/${H}.webp?sig=${id}`,
});
// kind: 'ok' or a malformed variant
function card(id, kind = 'ok') {
  const u = U(id);
  let ext = 'png'; let sampleAttr = `data-sample-url="${u.sample}"`;
  let s1 = `<source srcset="${u.webp}" type="image/webp">`;
  let s2 = `<source srcset="${u.preview}" type="image/jpeg">`;
  let img = `<img src="${u.preview}" alt="secret_tag" class="has-cropped-true">`;
  let wrap = (inner) => `<picture>${inner}</picture>`;
  switch (kind) {
    case 'video': ext = 'webm'; break;
    case 'noSample': sampleAttr = ''; break;
    case 'noPicture': wrap = (inner) => inner; s1 = ''; s2 = ''; break;
    case 'oneSource': s2 = ''; break;
    case 'threeSources': s2 += `<source srcset="${u.preview}" type="image/png">`; break;
    case 'sizes': s1 = `<source srcset="${u.webp}" type="image/webp" sizes="100px">`; break;
    case 'media': s2 = `<source srcset="${u.preview}" type="image/jpeg" media="(min-width: 1px)">`; break;
    case 'multiSrcset': s1 = `<source srcset="${u.webp} 1x, ${u.sample} 2x" type="image/webp">`; break;
    case 'imgSrcset': img = `<img src="${u.preview}" srcset="${u.preview} 1x" alt="secret_tag">`; break;
    case 'foreignWebp': s1 = `<source srcset="${M}/other/${H}.webp" type="image/webp">`; break;
    case 'sampleIsPreview': sampleAttr = `data-sample-url="${u.preview}"`; break;
    case 'swappedTypes': s1 = `<source srcset="${u.webp}" type="image/jpeg">`; break;
    default: break;
  }
  return `<article class="thumbnail" data-id="${id}" data-tags="secret_tag" data-md5="${H}" data-created-at="2026-01-01T00:00:00Z"
    data-file-ext="${ext}" data-width="1448" data-height="2048" data-file-url="${u.file}" ${sampleAttr}
    data-preview-url="${u.preview}" data-preview-webp="${u.webp}" data-uploader="some_person"><a href="/posts/${id}#frag" title="Secret Title">${wrap(`${s1}${s2}${img}`)}</a></article>`;
}
const MALFORMED = ['video', 'noSample', 'noPicture', 'oneSource', 'threeSources', 'sizes', 'media', 'multiSrcset', 'imgSrcset', 'foreignWebp', 'sampleIsPreview', 'swappedTypes'];
const EXPECTED_REASON = {
  video: 'UNSUPPORTED_MEDIA', noSample: 'MISSING_NATIVE_FACT', noPicture: 'NO_PICTURE', oneSource: 'SOURCE_SHAPE', threeSources: 'SOURCE_SHAPE',
  sizes: 'SOURCE_SIZES_OR_MEDIA', media: 'SOURCE_SIZES_OR_MEDIA', multiSrcset: 'SOURCE_SRCSET_NOT_SINGLE', imgSrcset: 'IMG_SHAPE',
  foreignWebp: 'WEBP_SOURCE_NOT_NATIVE_PREVIEW', sampleIsPreview: 'SAMPLE_NOT_DISTINCT', swappedTypes: 'SOURCE_TYPES',
};
// Malformed cards come FIRST so a broken pattern gate would select them.
const page = (supported, malformed = MALFORMED) => {
  const cards = [...malformed.map((k, i) => card(String(90100 + i), k)), ...Array.from({ length: supported }, (_, i) => card(String(90001 + i)))];
  return `<!doctype html><html><body><section class="posts-container">${cards.join('')}</section></body></html>`;
};

// ---- harness ------------------------------------------------------------------------
async function run(url, html, { src = SRC, steps = [1, 2], widthB = 900 } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const counters = { network: 0, gm: 0, storage: 0, cookie: 0, clicks: 0 };
  const menu = {};
  w.innerWidth = 1600; w.innerHeight = 1000; w.devicePixelRatio = 1;
  w.setTimeout = (fn) => { Promise.resolve().then(fn); return 0; };
  w.fetch = () => { counters.network++; return new Promise(() => {}); };
  w.XMLHttpRequest = class { open() { counters.network++; } send() {} };
  for (const n of ['GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue', 'GM_deleteValue', 'GM_download', 'GM_openInTab', 'GM_setClipboard']) w[n] = () => { counters.gm++; };
  w.GM_registerMenuCommand = (label, fn) => { menu[label] = fn; };
  for (const store of [w.localStorage, w.sessionStorage]) for (const m of ['setItem', 'removeItem', 'clear', 'getItem']) { const o = store[m].bind(store); store[m] = (...a) => { counters.storage++; return o(...a); }; }
  const cd = Object.getOwnPropertyDescriptor(w.Document.prototype, 'cookie');
  Object.defineProperty(w.document, 'cookie', { get() { counters.cookie++; return cd.get.call(this); }, set(v) { counters.cookie++; cd.set.call(this, v); } });
  const oc = w.HTMLElement.prototype.click;
  w.HTMLElement.prototype.click = function (...a) { counters.clicks++; return oc.apply(this, a); };
  const SUPPORTED_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);
  Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { configurable: true, get() {
    const p = this.parentElement;
    if (p && p.localName === 'picture') {
      for (const ch of p.children) {
        if (ch === this) break;
        if (ch.localName !== 'source' || !ch.getAttribute('srcset')) continue;
        const t = ch.getAttribute('type');
        if (t && !SUPPORTED_TYPES.has(t)) continue;
        return new URL(ch.getAttribute('srcset').trim().split(/\s+/)[0], w.location.href).href;
      }
    }
    return this.getAttribute('src') ? new URL(this.getAttribute('src'), w.location.href).href : '';
  } });
  Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });

  const container = w.document.querySelector('.posts-container');
  const arts = [...container.querySelectorAll('article')];
  const initialSig = new Map(arts.map((a) => [a, a.innerHTML]));
  const cmo = new w.MutationObserver(() => {});
  cmo.observe(container, { subtree: true, attributes: true, childList: true, characterData: true });

  const crashesBefore = asyncCrashes;
  w.eval(src);
  const tick = () => new Promise((r) => setTimeout(r, 30));
  const read = () => w.document.querySelector('#ib08-v9r-result textarea')?.value || '';
  const invoke = async (prefix) => { const k = Object.keys(menu).find((l) => l.startsWith(prefix)); if (k) menu[k](); await tick(); return read(); };
  const out = { texts: [] };
  if (steps.includes(1)) out.texts.push(await invoke('IB08 ownership: Step 1'));
  w.innerWidth = widthB;
  if (steps.includes(2)) out.texts.push(await invoke('IB08 ownership: Step 2'));
  out.containerRecords = cmo.takeRecords();
  cmo.disconnect();
  try { out.json = JSON.parse(out.texts[out.texts.length - 1]); } catch { out.json = null; }
  out.all = out.texts.join('\n');
  out.w = w; out.arts = arts; out.initialSig = initialSig; out.counters = counters; out.menu = Object.keys(menu);
  return out;
}
const finish = (r) => r.w.close();

const E6 = 'https://e621.net/posts?tags=secret_tag';
const E9 = 'https://e926.net/posts';

// Independent DOM checks after a full run (does not trust the experiment's report).
function domChecks(r) {
  const supported = r.arts.slice(MALFORMED.length);
  const ids = supported.map((a) => a.getAttribute('data-id'));
  const u = ids.map(U);
  const pic = (i) => supported[i].querySelector('picture');
  const srcsets = (i) => [...pic(i).querySelectorAll('source')].map((s) => s.getAttribute('srcset'));
  const out = {};
  out.control = srcsets(0).join() === [u[0].webp, u[0].preview].join() && pic(0).querySelector('img').currentSrc === u[0].webp;
  out.nativeEdit = srcsets(1).join() === [u[1].preview, u[1].preview].join();
  out.moved = [...pic(2).querySelectorAll('source')].map((s) => s.getAttribute('type')).join() === 'image/jpeg,image/webp' && srcsets(2).join() === [u[2].preview, u[2].webp].join();
  out.replacedSource = srcsets(3).join() === [u[3].webp, u[3].preview].join();
  out.replacedPicture = srcsets(4).join() === [u[4].webp, u[4].preview].join() && pic(4).querySelector('img').currentSrc === u[4].webp;
  // No enhancer residue on any connected node of the pattern cards (malformed fixtures carry their own native sample candidates).
  out.noResidue = !supported.flatMap((a) => [...a.querySelectorAll('source, img')]).some((el) => ['srcset', 'src'].some((a) => (el.getAttribute(a) || '').includes('/sample/')));
  // Cards outside the five scenarios, including every malformed card, are byte-identical.
  out.othersUntouched = r.arts.every((a, i) => (i >= MALFORMED.length && i < MALFORMED.length + 5) || a.innerHTML === r.initialSig.get(a));
  out.cardsConnected = r.arts.every((a) => a.isConnected);
  return out;
}

async function main() {
  // ---- 1. e621 full run ----
  for (const [label, url, host] of [['e621', E6, 'e621.net'], ['e926', E9, 'e926.net']]) {
    const r = await run(url, page(8));
    const j = r.json;
    check(`${label}: Step 1 interim output`, /Step 1 done/.test(r.texts[0]), r.texts[0]);
    check(`${label}: site identity ${host}`, j && j.site === host, j && j.site);
    check(`${label}: verdict ALL_EXPECTATIONS_MET`, j && j.experimentVerdict === 'ALL_EXPECTATIONS_MET', JSON.stringify(j && j.cards && j.cards.map((c) => c.expectationMismatches)));
    check(`${label}: five scenario cards, ordinals only`, j && j.cards.map((c) => `${c.card}:${c.scenario}`).join() === 'CARD_01:CONTROL,CARD_02:NATIVE_EDIT,CARD_03:MOVED_SOURCE,CARD_04:REPLACED_SOURCE,CARD_05:REPLACED_PICTURE', j && j.cards && j.cards.map((c) => c.card));
    check(`${label}: apply = exactly one owned srcset write per card`, j && j.applyMutationRecords === 5 && j.applyRecordsAllOwnedSrcset === true, j && j.applyMutationRecords);
    check(`${label}: apply keeps picture/source/img identity and selects the native sample`, j && j.cards.every((c) => c.afterApply.sameImgNode && c.afterApply.samePictureNode && c.afterApply.sourceOrder === 'S1,S2' && c.afterApply.currentSrcRelation === 'NATIVE_SAMPLE'), JSON.stringify(j && j.cards.map((c) => c.afterApply)));
    const by = (s) => j && j.cards.find((c) => c.scenario === s);
    check(`${label}: dispose outcomes`, j && ['RESTORED', 'SKIPPED_NATIVE_TOUCHED', 'RESTORED', 'SKIPPED_DISCONNECTED', 'SKIPPED_DISCONNECTED'].join() === j.cards.map((c) => c.dispose).join() && j.disposeMutationRecords === 2 && j.disposeRecordsAllOwnedSrcset, j && j.cards.map((c) => c.dispose).join());
    check(`${label}: control restored to native WebP preview after dispose and resize`, by('CONTROL') && by('CONTROL').afterDispose.s1SrcsetState === 'ORIGINAL' && by('CONTROL').afterResize.currentSrcRelation === 'NATIVE_PREVIEW_WEBP', JSON.stringify(by('CONTROL')));
    check(`${label}: native edit survives dispose`, by('NATIVE_EDIT') && by('NATIVE_EDIT').afterResize.s1SrcsetState === 'NATIVE_EDIT_VALUE' && by('NATIVE_EDIT').afterResize.currentSrcRelation === 'NATIVE_PREVIEW', JSON.stringify(by('NATIVE_EDIT')));
    check(`${label}: moved source keeps native order; owned value restored`, by('MOVED_SOURCE') && by('MOVED_SOURCE').afterResize.sourceOrder === 'S2,S1' && by('MOVED_SOURCE').afterResize.s1SrcsetState === 'ORIGINAL', JSON.stringify(by('MOVED_SOURCE')));
    check(`${label}: replacement source/picture untouched and native`, by('REPLACED_SOURCE') && by('REPLACED_SOURCE').afterResize.replacementNodesMatchNative === true && by('REPLACED_PICTURE').afterResize.replacementNodesMatchNative === true && by('REPLACED_PICTURE').afterResize.samePictureNode === false, JSON.stringify([by('REPLACED_SOURCE'), by('REPLACED_PICTURE')]));
    check(`${label}: viewport narrowed and recorded with DPR`, j && j.viewportNarrowed === true && j.viewportStep1.width === 1600 && j.viewportStep2.width === 900 && j.viewportStep2.devicePixelRatio === 1, JSON.stringify(j && [j.viewportStep1, j.viewportStep2]));
    check(`${label}: malformed cards classified and untouched`, j && MALFORMED.every((k) => j.classification[EXPECTED_REASON[k]] >= 1) && j.classification.SUPPORTED === 8 && j.unsupportedCards.checked === 12 && j.unsupportedCards.renditionChanged === 0 && j.otherSupportedCards.checked === 3 && j.otherSupportedCards.renditionChanged === 0, JSON.stringify(j && [j.classification, j.unsupportedCards, j.otherSupportedCards]));
    const dc = domChecks(r);
    check(`${label}: independent DOM state after run`, Object.values(dc).every(Boolean), JSON.stringify(dc));
    check(`${label}: no crash`, !r.crashed);
    check(`${label}: no leak`, leaks(r.all).length === 0, leaks(r.all).join(','));
    check(`${label}: no network/GM/storage/cookie/click`, Object.values(r.counters).every((n) => n === 0), JSON.stringify(r.counters));
    check(`${label}: three menu commands only`, r.menu.length === 3, r.menu.join('|'));
    finish(r);
  }

  // ---- 2. Unsupported-only / insufficient page: nothing changes ----
  let r = await run(E6, page(4));
  check('insufficient: fewer than five supported -> INSUFFICIENT', r.json && r.json.experimentVerdict === 'INSUFFICIENT' && r.json.classification.SUPPORTED === 4, r.all);
  check('insufficient: zero mutations in the whole listing', r.containerRecords.length === 0, r.containerRecords.length);
  check('insufficient: no leak', leaks(r.all).length === 0, leaks(r.all).join(','));
  finish(r);
  r = await run(E6, page(0));
  check('malformed-only page: INSUFFICIENT, zero mutations', r.json && r.json.experimentVerdict === 'INSUFFICIENT' && r.containerRecords.length === 0 && r.json.classification.SUPPORTED === undefined, r.all);
  finish(r);

  // ---- 3. Host and sequencing guards ----
  r = await run('https://rule34.xxx/index.php?page=post&s=list', page(8));
  check('unsupported host: error only, zero mutations', r.json && r.json.error === 'unsupported host' && r.containerRecords.length === 0, r.all);
  finish(r);
  r = await run(E6, page(8), { steps: [2] });
  check('Step 2 without Step 1: error, zero mutations', r.json && /Step 1 has not run/.test(r.json.error) && r.containerRecords.length === 0, r.all);
  finish(r);
  r = await run(E6, page(8), { widthB: 1600 });
  check('not narrowed: verdict is EXPECTATION_MISMATCH', r.json && r.json.viewportNarrowed === false && r.json.experimentVerdict === 'EXPECTATION_MISMATCH', r.json && r.json.experimentVerdict);
  finish(r);

  // ---- 4. In-experiment leak guard ----
  const leakyReport = SRC.replace("card: `CARD_${String(i + 1).padStart(2, '0')}`", "card: article.getAttribute('data-sample-url')");
  r = await run(E6, page(8), { src: leakyReport });
  check('guard: leaking build output is BLOCKED and leak-free', leakyReport !== SRC && r.json && r.json.sanitationGuard === 'BLOCKED' && leaks(r.all).length === 0, r.all.slice(0, 300));
  finish(r);

  // ---- 5. Static scope checks ----
  const header = SRC.slice(0, SRC.indexOf('==/UserScript=='));
  const code = SRC.slice(SRC.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const section = (a, b) => SRC.slice(SRC.indexOf(a), SRC.indexOf(b));
  const ownerSec = section('ENHANCER-SIDE OWNER BEGIN', 'ENHANCER-SIDE OWNER END');
  const nativeSec = section('NATIVE-SIMULATION BEGIN', 'NATIVE-SIMULATION END');
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const outside = strip(SRC.slice(SRC.indexOf('==/UserScript==')).replace(nativeSec, ''));
  check('static: @match only e621.net and e926.net', [...header.matchAll(/@match\s+(\S+)/g)].map((x) => x[1]).join() === '*://e621.net/*,*://e926.net/*', header);
  check('static: only GM_registerMenuCommand; no @connect/@require/update URLs', [...header.matchAll(/@grant\s+(\S+)/g)].map((x) => x[1]).join() === 'GM_registerMenuCommand' && !/@(connect|require|resource|updateURL|downloadURL)/.test(header), header);
  const forbidden = ['fetch(', 'XMLHttpRequest', 'GM_xmlhttpRequest', 'GM.', 'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'GM_setValue', 'GM_getValue', 'cloneNode', 'innerHTML', 'outerHTML', '.click(', 'sendBeacon', 'WebSocket', 'window.open', 'location.assign', 'location.href =', 'dispatchEvent', 'scrollTo', 'scrollIntoView'];
  const hits = forbidden.filter((f) => code.includes(f));
  check('static: no network, storage, cookie, clone, HTML-string, click or navigation API', hits.length === 0, hits.join(','));
  const nodeOps = ['replaceWith', 'replaceChild', 'insertBefore', 'removeChild', '.remove()', '.after(', '.before(', '.prepend(', 'createElement', '.append(', 'appendChild'];
  check('static: owner section has no node operation and writes only via set/removeAttribute', ownerSec.length > 200 && nodeOps.every((o) => !ownerSec.includes(o)), nodeOps.filter((o) => ownerSec.includes(o)).join(','));
  check('static: the only enhancer-side write is applyRendition -> ownAttribute(sources[0], srcset)', (code.match(/ownAttribute\(/g) || []).length === 2 && code.includes("owner.ownAttribute(c.sources[0], 'srcset', c.ownedValue)"), 'ownAttribute uses changed');
  const outsideOps = nodeOps.filter((o) => outside.includes(o));
  check('static: outside the native simulation, node creation/insertion is only the result overlay', outsideOps.sort().join() === ['.append(', '.remove()', 'appendChild', 'createElement'].sort().join()
    && (outside.match(/createElement\(/g) || []).length === 3 && outside.includes('document.body.appendChild(root)') && (outside.match(/\.remove\(\)/g) || []).length === 4, outsideOps.join(','));
  check('static: setAttribute outside the owner occurs only in the native simulation', (code.match(/setAttribute\(/g) || []).length === 4 && (ownerSec.match(/setAttribute\(/g) || []).length === 2 && (nativeSec.match(/setAttribute\(/g) || []).length === 2, (code.match(/setAttribute\(/g) || []).length);

  // ---- 6. Fault controls ----
  const unguard = (s) => s.replace(/const leaked = [^;]+;/, 'const leaked = false;');
  const faults = [
    ['dispose never restores', SRC.replace('if (rec.originalPresent) rec.node.setAttribute(rec.attr, rec.originalValue);', 'if (false) rec.node.setAttribute(rec.attr, rec.originalValue);')],
    ['dispose overwrites native edit', SRC.replace("if (rec.nativeTouched) return 'SKIPPED_NATIVE_TOUCHED';", '')],
    ['dispose ignores value check and connection', SRC.replace("if (!rec.node.isConnected) return 'SKIPPED_DISCONNECTED';", '').replace("if (rec.nativeTouched) return 'SKIPPED_NATIVE_TOUCHED';", '').replace("if (rec.node.getAttribute(rec.attr) !== rec.ownedValue) return 'SKIPPED_VALUE_CHANGED';", '')],
    ['dispose moves source back (overrides native order)', SRC.replace("if (rec.originalPresent) rec.node.setAttribute(rec.attr, rec.originalValue);", "if (rec.originalPresent) rec.node.setAttribute(rec.attr, rec.originalValue); if (rec.node.previousElementSibling) rec.node.parentElement.prepend(rec.node);")],
    ['dispose writes the current first source (position, not owned node)', SRC.replace("if (rec.originalPresent) rec.node.setAttribute(rec.attr, rec.originalValue);", "if (rec.originalPresent) rec.node.parentElement.querySelector('source').setAttribute(rec.attr, rec.originalValue);")],
    ['owner records its own write as a native touch', SRC.replace("node.setAttribute(attr, value);\n        mo.observe(node, { attributes: true, attributeFilter: [attr] });", "mo.observe(node, { attributes: true, attributeFilter: [attr] });\n        node.setAttribute(attr, value);")],
    ['apply replaces the source node (clone)', SRC.replace("const applyRendition = (owner, c) => owner.ownAttribute(c.sources[0], 'srcset', c.ownedValue);", "const applyRendition = (owner, c) => { const n = c.sources[0].cloneNode(true); n.setAttribute('srcset', c.ownedValue); c.sources[0].replaceWith(n); };")],
    ['apply removes srcset', SRC.replace("const applyRendition = (owner, c) => owner.ownAttribute(c.sources[0], 'srcset', c.ownedValue);", "const applyRendition = (owner, c) => { c.sources.forEach((s) => s.removeAttribute('srcset')); owner.ownAttribute(c.img, 'src', c.ownedValue); };")],
    ['apply also rewrites img src', SRC.replace("const applyRendition = (owner, c) => owner.ownAttribute(c.sources[0], 'srcset', c.ownedValue);", "const applyRendition = (owner, c) => { owner.ownAttribute(c.sources[0], 'srcset', c.ownedValue); c.img.setAttribute('src', c.ownedValue); };")],
    ['pattern gate disabled', SRC.replace("if (!d('data-id')) return 'NO_ID';", "return 'SUPPORTED';")],
    ['e926 relabeled as e621', SRC.replace("location.hostname : null;", "(location.hostname === 'e926.net' ? 'e621.net' : location.hostname) : null;"), E9],
    ['leaked URL', unguard(SRC.replace("return same ? 'OTHER_SAME_ORIGIN' : 'UNKNOWN';", "return url;").replace("for (const [label, v] of labels) if (v && v === url) return label;", ''))],
    ['leaked post ID', unguard(SRC.replace("card: `CARD_${String(i + 1).padStart(2, '0')}`", "card: article.getAttribute('data-id')"))],
    ['script-side request', SRC.replace('const owner = makeOwner();', "const owner = makeOwner(); fetch(location.href);")],
  ];
  for (const [name, src, url = E6] of faults) {
    if (src === SRC || src === unguard(SRC)) { check(`fault ${name}: mutant applied`, false, 'replacement did not apply'); continue; }
    let f;
    try { f = await run(url, page(8), { src }); } catch (e) { check(`fault ${name}: caught by crash`, true); continue; }
    const by = [];
    if (f.crashed) by.push('crash');
    const host = new URL(url).hostname;
    if (!f.json || f.json.site !== host) by.push('host-identity');
    if (!f.json || f.json.experimentVerdict !== 'ALL_EXPECTATIONS_MET') by.push('self-report');
    if (!Object.values(domChecks(f)).every(Boolean)) by.push('independent-dom');
    if (leaks(f.all).length) by.push('leak-scan');
    if (!Object.values(f.counters).every((n) => n === 0)) by.push('api-counter');
    const hitsF = forbidden.filter((x) => src.slice(src.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').includes(x));
    if (hitsF.length) by.push('static');
    check(`fault ${name}: caught by ${by.join('+') || 'nothing'}`, by.length > 0, 'mutant passed all checks');
    finish(f);
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = {
    checkpoint: 'IB08', evidence_gate: 'G-RENDITION', status: 'E-STAGE LOCAL QUALIFICATION (not a gate result)',
    experiment: FILE, experiment_sha256_lf: crypto.createHash('sha256').update(SRC).digest('hex'),
    currentSrc_model: 'jsdom has no image selection; the verifier models it (first supported-type <source> before the <img> with a srcset, else img src). Live selection is the operator run.',
    checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })),
    failures: results.filter((x) => !x.pass),
  };
  fs.writeFileSync(path.join(__dirname, 'V9R_OWNERSHIP_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
