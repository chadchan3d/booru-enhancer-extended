'use strict';
// Local verification for IB08_V9R_Baseline_Probe.user.js (no live site).
// Runs both captures against jsdom fixtures for e621 and e926, watches the card
// trees for any mutation, counts every network/storage/cookie path, scans
// every output for raw planted values, and requires each fault-control mutant
// to be caught. Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require(path.resolve(__dirname, '../../host/ib07/node_modules/jsdom'));

const PROBE_FILE = 'IB08_V9R_Baseline_Probe.user.js';
const PROBE = fs.readFileSync(path.join(__dirname, PROBE_FILE), 'utf8').replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

// Raw values planted in fixtures; none may appear in any output.
const H = '0123456789abcdef0123456789abcdef';
const RAW = ['90001', '90002', '90003', '90004', '90005', '90006', '90007', '90008', '90009', '90010', H, 'q7',
  'static.example', 'media.example', 'http', 'secret_tag', 'Secret Title', 'some_person', '2026-01-01T00', '/posts/', '/data/', '?sig=', '#frag'];
const leaks = (text) => RAW.filter((r) => text.includes(r));

// ---- fixtures -------------------------------------------------------------
const M = 'https://static.example';
const urls = (id) => ({
  file: `${M}/data/q7/${H}.png?sig=${id}`,
  sample: `${M}/data/sample/q7/${H}.jpg?sig=${id}`,
  preview: `${M}/data/preview/q7/${H}.jpg?sig=${id}`,
  webp: `${M}/data/preview/q7/${H}.webp?sig=${id}`,
});
function card(id, { picture = true, img = true, srcset = null, badSrcset = false } = {}) {
  const u = urls(id);
  const imgSrcset = badSrcset ? ` srcset="${u.preview} 1x,,,${u.sample} two"` : srcset ? ` srcset="${srcset}" sizes="(max-width: 600px) 100px, 200px"` : '';
  const imgTag = img ? `<img src="${u.preview}"${imgSrcset} alt="secret_tag" class="has-cropped-true">` : '<span>no image</span>';
  const body = picture && img
    ? `<picture><source srcset="${u.webp}" type="image/webp"><source srcset="${u.preview}" type="image/jpeg">${imgTag}</picture>`
    : imgTag;
  return `<article class="thumbnail" data-id="${id}" data-tags="secret_tag" data-md5="${H}" data-created-at="2026-01-01T00:00:00Z"
    data-file-ext="png" data-width="1448" data-height="2048" data-file-url="${u.file}" data-sample-url="${u.sample}"
    data-preview-url="${u.preview}" data-preview-webp="${u.webp}" data-uploader="some_person">
    <a href="/posts/${id}#frag" title="Secret Title">${body}</a></article>`;
}
const listing = (cards) => `<!doctype html><html><body><section class="posts-container">${cards.join('')}</section></body></html>`;
const ids = (n) => Array.from({ length: n }, (_, i) => String(90001 + i));

// ---- harness ----------------------------------------------------------------
async function run(url, html, opts = {}) {
  const { probe = PROBE, curA = () => '', curB = curA, between = null, captures = 'AB', widthA = 1600, widthB = 900 } = opts;
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const counters = { network: 0, storage: 0, cookieWrites: 0, cookieReads: 0, gmOther: 0, clicks: 0 };
  const menu = {};
  const state = { phase: 'A' };
  w.innerWidth = widthA; w.innerHeight = 1000; w.devicePixelRatio = 1;
  w.setTimeout = (fn) => { Promise.resolve().then(fn); return 0; };
  w.fetch = () => { counters.network++; return new Promise(() => {}); };
  w.XMLHttpRequest = class { open() { counters.network++; } send() {} };
  for (const name of ['GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue', 'GM_deleteValue', 'GM_download', 'GM_openInTab', 'GM_setClipboard']) w[name] = () => { counters.gmOther++; };
  w.GM = { xmlHttpRequest: () => { counters.gmOther++; } };
  w.GM_registerMenuCommand = (label, fn) => { menu[label] = fn; };
  for (const store of [w.localStorage, w.sessionStorage]) {
    for (const m of ['setItem', 'removeItem', 'clear']) { const orig = store[m].bind(store); store[m] = (...a) => { counters.storage++; return orig(...a); }; }
  }
  const cookieDesc = Object.getOwnPropertyDescriptor(w.Document.prototype, 'cookie');
  Object.defineProperty(w.document, 'cookie', { get() { counters.cookieReads++; return cookieDesc.get.call(this); }, set(v) { counters.cookieWrites++; cookieDesc.set.call(this, v); } });
  const origClick = w.HTMLElement.prototype.click;
  w.HTMLElement.prototype.click = function (...a) { counters.clicks++; return origClick.apply(this, a); };

  const imgs = [...w.document.querySelectorAll('article img')];
  const instrument = (img, i) => {
    Object.defineProperty(img, 'currentSrc', { configurable: true, get: () => (state.phase === 'A' ? curA(i) : curB(i)) });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, get: () => (state.phase === 'A' ? 150 : 300) });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, get: () => (state.phase === 'A' ? 200 : 400) });
    Object.defineProperty(img, 'complete', { configurable: true, value: true });
    img.getBoundingClientRect = () => ({ width: state.phase === 'A' ? 200 : 120, height: 180, top: 10, bottom: 190, left: 0, right: 200 });
  };
  imgs.forEach(instrument);

  const container = w.document.querySelector('.posts-container');
  const before = container ? container.outerHTML : '';
  const mutations = [];
  const mo = new w.MutationObserver((recs) => mutations.push(...recs));
  if (container) mo.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });

  w.eval(probe);
  const tick = () => new Promise((r) => setTimeout(r, 20));
  const read = () => w.document.querySelector('#ib08-v9r-result textarea')?.value || '';
  const labels = Object.keys(menu);
  const invoke = async (prefix) => { const k = labels.find((l) => l.startsWith(prefix)); if (k) menu[k](); await tick(); return read(); };

  const out = {};
  if (captures.includes('A')) out.textA = await invoke('IB08 baseline: Capture A');
  await new Promise((r) => { if (container) mo.takeRecords().forEach((m) => mutations.push(m)); r(); });
  const probeMutationsA = mutations.length;
  if (between) { mo.disconnect(); between(w, instrument); }
  state.phase = 'B'; w.innerWidth = widthB;
  if (captures.includes('B')) out.textB = await invoke('IB08 baseline: Capture B');
  if (container) mutations.push(...mo.takeRecords());
  const after = w.document.querySelector('.posts-container')?.outerHTML || '';
  mo.disconnect();
  let json = null; try { json = out.textB ? JSON.parse(out.textB) : null; } catch { json = null; }
  dom.window.close();
  return { ...out, json, counters, menu: labels, mutations: between ? probeMutationsA : mutations.length, unchanged: between ? true : before === after };
}

const clean = (name, r) => {
  check(`${name}: no leak`, leaks((r.textA || '') + (r.textB || '')).length === 0, leaks((r.textA || '') + (r.textB || '')).join(','));
  check(`${name}: no card-tree mutation`, r.mutations === 0 && r.unchanged, `mutations=${r.mutations}`);
  check(`${name}: no network/GM request`, r.counters.network === 0 && r.counters.gmOther === 0, JSON.stringify(r.counters));
  check(`${name}: no storage or cookie access`, r.counters.storage === 0 && r.counters.cookieWrites === 0 && r.counters.cookieReads === 0, JSON.stringify(r.counters));
  check(`${name}: no clicks`, r.counters.clicks === 0, JSON.stringify(r.counters));
};

const E6 = 'https://e621.net/posts?tags=secret_tag&page=2';
const E9 = 'https://e926.net/posts?tags=secret_tag';
const webpOf = (i) => urls(ids(10)[i]).webp;

async function main() {
  // 1. e621 baseline: picture + 2 sources, currentSrc stays the WebP preview.
  let r = await run(E6, listing(ids(3).map((id) => card(id))), { curA: webpOf });
  clean('e621 baseline', r);
  const j = r.json;
  check('e621: site identity e621.net', j && j.site === 'e621.net', j && j.site);
  check('e621: A step output', /"step": "A captured"/.test(r.textA), r.textA);
  check('e621: viewport A/B recorded with DPR', j && j.conditionA.viewport.width === 1600 && j.conditionB.viewport.width === 900 && j.conditionA.viewport.devicePixelRatio === 1 && j.viewportNarrowed === true, JSON.stringify(j && [j.conditionA, j.conditionB]));
  check('e621: ordinals only', j && j.cards.map((c) => c.card).join() === 'CARD_01,CARD_02,CARD_03', j && j.cards.map((c) => c.card));
  const c1 = j && j.cards[0];
  check('e621: same card/img/picture/source nodes', c1 && c1.sameCardNode === true && c1.sameImgNode === true && c1.samePictureNode === true && c1.sameSourceNodes === true, JSON.stringify(c1));
  check('e621: picture structure facts', c1 && c1.conditionA.inPicture === true && c1.conditionA.sourceCount === 2 && c1.conditionA.sources[0].type === 'image/webp' && c1.conditionA.sources[0].srcsetCandidates === 1 && c1.conditionA.img.srcPresent === true && c1.conditionA.img.srcsetPresent === false, JSON.stringify(c1 && c1.conditionA));
  check('e621: relation labels and unchanged currentSrc', c1 && c1.currentSrcRelationA === 'NATIVE_PREVIEW_WEBP' && c1.currentSrcRelationB === 'NATIVE_PREVIEW_WEBP' && c1.currentSrcChanged === false && c1.conditionA.currentSrcRelationsAll.includes('SOURCE_1_SRCSET_CANDIDATE_1'), JSON.stringify(c1));
  check('e621: rendered and natural dimensions per condition', c1 && c1.conditionA.rendered.width === 200 && c1.conditionB.rendered.width === 120 && c1.conditionA.natural.width === 150 && c1.conditionB.natural.width === 300, JSON.stringify(c1));
  check('e621: menu is the three probe commands only', r.menu.length === 3, r.menu.join('|'));

  // 2. e926 independently: same shape, own identity; currentSrc changes across srcset candidates.
  const setFor = (i) => { const u = urls(ids(10)[i]); return `${u.preview} 150w, ${u.sample} 850w`; };
  r = await run(E9, listing(ids(2).map((id, i) => card(id, { picture: false, srcset: setFor(i) }))),
    { curA: (i) => urls(ids(10)[i]).preview, curB: (i) => urls(ids(10)[i]).sample });
  clean('e926 srcset change', r);
  const k = r.json;
  check('e926: site identity e926.net (not inherited from e621)', k && k.site === 'e926.net', k && k.site);
  const d1 = k && k.cards[0];
  check('e926: no picture -> not-applicable', d1 && d1.samePictureNode === 'not-applicable' && d1.sameSourceNodes === 'not-applicable' && d1.conditionA.inPicture === false && d1.conditionA.sourceCount === 0, JSON.stringify(d1));
  check('e926: srcset candidate counts without URLs', d1 && d1.conditionA.img.srcsetCandidates === 2 && d1.conditionA.img.srcsetDescriptorKind === 'w' && d1.conditionA.img.sizesPresent === true, JSON.stringify(d1 && d1.conditionA.img));
  check('e926: currentSrc changed with candidate relations', d1 && d1.currentSrcChanged === true && d1.currentSrcRelationA === 'NATIVE_PREVIEW' && d1.currentSrcRelationB === 'NATIVE_SAMPLE'
    && d1.conditionA.currentSrcRelationsAll.includes('IMG_SRC') && d1.conditionA.currentSrcRelationsAll.includes('IMG_SRCSET_CANDIDATE_1') && d1.conditionB.currentSrcRelationsAll.includes('IMG_SRCSET_CANDIDATE_2') && d1.conditionB.matchedDescriptor === '850w', JSON.stringify(d1));

  // 3. Bounded sampling.
  r = await run(E6, listing(ids(10).map((id) => card(id))), { curA: webpOf });
  clean('bounded', r);
  check('bounded: 10 cards on page, 6 sampled', r.json && r.json.cardsOnPage === 10 && r.json.sampledCards === 6 && r.json.cards.length === 6 && r.json.sampleLimit === 6, r.json && [r.json.cardsOnPage, r.json.sampledCards]);

  // 4. Same-node comparison detects operator-side replacement (harness replaces, not the probe).
  r = await run(E6, listing(ids(3).map((id) => card(id))), {
    curA: webpOf,
    between: (w, instrument) => {
      const arts = w.document.querySelectorAll('article');
      const img0 = arts[0].querySelector('img'); const n0 = img0.cloneNode(true); instrument(n0, 0); img0.replaceWith(n0);
      const pic1 = arts[1].querySelector('picture'); const p1 = pic1.cloneNode(true); instrument(p1.querySelector('img'), 1); pic1.replaceWith(p1);
      const s2 = arts[2].querySelector('source'); s2.replaceWith(s2.cloneNode(true));
    },
  });
  check('replacement: probe itself mutated nothing before B', r.mutations === 0, r.mutations);
  const rc = r.json && r.json.cards;
  check('replacement: replaced img -> sameImgNode false', rc && rc[0].sameImgNode === false && rc[0].samePictureNode === true, JSON.stringify(rc && rc[0]));
  check('replacement: replaced picture -> samePictureNode/sameSourceNodes/sameImgNode false', rc && rc[1].samePictureNode === false && rc[1].sameSourceNodes === false && rc[1].sameImgNode === false, JSON.stringify(rc && rc[1]));
  check('replacement: replaced source -> sameSourceNodes false only', rc && rc[2].sameSourceNodes === false && rc[2].sameImgNode === true && rc[2].samePictureNode === true, JSON.stringify(rc && rc[2]));
  check('replacement: no leak', leaks(r.textA + r.textB).length === 0, leaks(r.textA + r.textB).join(','));

  // 5. Malformed structures -> UNKNOWN.
  r = await run(E6, listing([card('90001', { img: false }), card('90002', { picture: false, badSrcset: true }), card('90003'), card('90004')]),
    // img index 0 is card 2 (card 1 has no img)
    { curA: (i) => (i === 0 ? 'https://other.example/x.jpg' : ''), curB: (i) => (i === 0 ? 'https://other.example/x.jpg' : '') });
  clean('malformed', r);
  const m = r.json && r.json.cards;
  check('malformed: card without img -> UNKNOWN, changed unknown', m && m[0].currentSrcRelationA === 'UNKNOWN' && m[0].currentSrcChanged === 'unknown' && m[0].sameImgNode === false && m[0].conditionA.inPicture === false, JSON.stringify(m && m[0]));
  check('malformed: unparsable srcset -> null count, UNPARSABLE', m && m[1].conditionA.img.srcsetCandidates === null && m[1].conditionA.img.srcsetDescriptorKind === 'UNPARSABLE', JSON.stringify(m && m[1].conditionA.img));
  check('malformed: unmatched foreign currentSrc -> UNKNOWN', m && m[1].currentSrcRelationA === 'UNKNOWN' && m[1].currentSrcRelationB === 'UNKNOWN', JSON.stringify(m && m[1]));
  check('malformed: empty currentSrc -> UNKNOWN, changed unknown', m && m[2].currentSrcRelationA === 'UNKNOWN' && m[2].currentSrcChanged === 'unknown', JSON.stringify(m && m[2]));

  // 6. Host and sequencing guards.
  r = await run('https://rule34.xxx/index.php?page=post&s=list', listing(ids(2).map((id) => card(id))), { curA: webpOf });
  check('unsupported host: error only, no cards', r.json && r.json.error === 'unsupported host' && !r.json.cards && leaks(r.textA + r.textB).length === 0, r.textB);
  r = await run(E6, listing(ids(2).map((id) => card(id))), { curA: webpOf, captures: 'B' });
  check('B without A: error, no cards', r.json && /Capture A has not been taken/.test(r.json.error) && !r.json.cards, r.textB);

  // 7. In-probe leak guard blocks a leaking build even when the verifier's scan is not consulted.
  const leakyGuarded = PROBE.replace('return { primary: all[0], all, descriptor };', 'return { primary: url, all, descriptor };');
  r = await run(E6, listing(ids(2).map((id) => card(id))), { probe: leakyGuarded, curA: webpOf });
  check('guard: leaking build output is BLOCKED and leak-free', r.json && r.json.sanitationGuard === 'BLOCKED' && leaks(r.textB).length === 0, r.textB);

  // 8. Static scope checks on the probe source.
  const header = PROBE.slice(0, PROBE.indexOf('==/UserScript=='));
  const code = PROBE.slice(PROBE.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const matches = [...header.matchAll(/@match\s+(\S+)/g)].map((x) => x[1]);
  check('static: @match only e621.net and e926.net', matches.join() === '*://e621.net/*,*://e926.net/*', matches.join());
  check('static: only GM_registerMenuCommand granted; no @connect/@require/update URLs', [...header.matchAll(/@grant\s+(\S+)/g)].map((x) => x[1]).join() === 'GM_registerMenuCommand' && !/@(connect|require|resource|updateURL|downloadURL)/.test(header), header);
  const forbidden = ['fetch(', 'XMLHttpRequest', 'GM_xmlhttpRequest', 'GM.', 'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'GM_setValue', 'GM_getValue', 'setAttribute', 'removeAttribute', 'replaceWith', 'replaceChild', 'insertBefore', '.click(', 'srcset =', 'sizes =', '.src =', 'innerHTML', 'outerHTML', 'sendBeacon', 'WebSocket', 'window.open', 'dispatchEvent', 'scrollTo', 'scrollIntoView'];
  const hits = forbidden.filter((f) => code.includes(f));
  check('static: no network, storage, cookie, attribute-write, node-replacement, click or outerHTML API', hits.length === 0, hits.join(','));
  const appends = code.match(/\.(append|appendChild|prepend|before|after)\(/g) || [];
  check('static: only DOM insertion is the probe overlay on document.body', appends.length === 2 && code.includes('root.append(ta, close)') && code.includes('document.body.appendChild(root)'), appends.join(','));

  // 9. Fault controls: each mutant must be caught by the checks above.
  const unguard = (src) => src.replace(/const leaked = [^;]+;/, 'const leaked = false;');
  const faults = [
    ['leaked URL', unguard(PROBE.replace('return { primary: all[0], all, descriptor };', 'return { primary: url, all, descriptor };')), E6],
    ['leaked post ID', unguard(PROBE.replace("card: `CARD_${String(i + 1).padStart(2, '0')}`", 'card: a.rawId')), E6],
    ['mutated src', PROBE.replace("const style = img ? getComputedStyle(img) : null;", "const style = img ? getComputedStyle(img) : null; if (img) img.setAttribute('src', img.getAttribute('src') + '?m');"), E6],
    ['removed srcset', PROBE.replace("const style = img ? getComputedStyle(img) : null;", "const style = img ? getComputedStyle(img) : null; sources.forEach((s) => s.removeAttribute('srcset'));"), E6],
    ['replaced source node', PROBE.replace('const bSnaps = captureA.snaps', 'captureA.snaps.forEach((a) => a.sources.forEach((s) => s.replaceWith(s.cloneNode(true)))); const bSnaps = captureA.snaps'), E6],
    ['e926 relabeled as e621', PROBE.replace("location.hostname : null;", "(location.hostname === 'e926.net' ? 'e621.net' : location.hostname) : null;"), E9],
  ];
  for (const [name, src, url] of faults) {
    if (src === PROBE || src === unguard(PROBE)) { check(`fault ${name}: mutant applied`, false, 'replacement did not apply'); continue; }
    const f = await run(url, listing(ids(3).map((id) => card(id))), { probe: src, curA: webpOf });
    const expectedSite = new URL(url).hostname;
    const by = [];
    if (leaks((f.textA || '') + (f.textB || '')).length) by.push('leak-scan');
    if (f.mutations > 0 || !f.unchanged) by.push('mutation-watch');
    if (!f.json || f.json.site !== expectedSite) by.push('host-identity');
    if (f.json && f.json.cards && f.json.cards.some((c) => c.sameSourceNodes !== true || c.sameImgNode !== true)) by.push('node-identity');
    check(`fault ${name}: caught by ${by.join('+') || 'nothing'}`, by.length > 0, 'mutant passed all checks');
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = {
    checkpoint: 'IB08', evidence_gate: 'G-RENDITION', status: 'EVIDENCE PREPARATION (not a gate result)',
    probe: PROBE_FILE, probe_sha256_lf: crypto.createHash('sha256').update(PROBE).digest('hex'),
    checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })),
    failures: results.filter((x) => !x.pass),
  };
  fs.writeFileSync(path.join(__dirname, 'V9R_BASELINE_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
