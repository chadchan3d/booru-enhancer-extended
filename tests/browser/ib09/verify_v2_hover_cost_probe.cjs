'use strict';
// Local qualification for IB09_V2_Hover_Cost_Probe.user.js (no live site).
// jsdom loads no images and has no Resource Timing, so the verifier supplies a
// synthetic browser model:
//   - image loads: detached Image src assignments complete after a per-URL
//     delay; 'data:,' cancels them (abortMode 'cancel': no entry and no cache;
//     'continue': the fetch completes into the cache anyway);
//   - Resource Timing: performance.getEntriesByName returns synthetic entries.
//     Sizes are exposed or restricted (all zero, as without Timing-Allow-Origin),
//     and the buffer is seeded with unrelated resources to catch contamination;
//   - cache on reuse: 'memory' (no entry), 'disk' (entry, transfer 0) or
//     'none' (full transfer again).
// Each scenario's aggregates are checked against the model. Every output is
// scanned for planted raw values, and the page must stay unchanged. Every
// fault-control mutant must be caught.
// Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require(path.resolve(__dirname, '../../host/ib07/node_modules/jsdom'));

const FILE = 'IB09_V2_Hover_Cost_Probe.user.js';
const SRC = fs.readFileSync(path.join(__dirname, FILE), 'utf8').replace(/\r\n/g, '\n');
const FAST = (s) => s.replace('const LOAD_TIMEOUT_MS = 20000;', 'const LOAD_TIMEOUT_MS = 1500;').replace('const ENTRY_WAIT_MS = 1500;', 'const ENTRY_WAIT_MS = 15;').replace('const ABORT_OBSERVE_MS = 4000;', 'const ABORT_OBSERVE_MS = 200;');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

const M = 'https://static.example';
const H = '0123456789abcdef0123456789abcdef';
const U = (id) => ({ file: `${M}/data/${H}_${id}.png`, sample: `${M}/data/sample/${H}_${id}.jpg`, preview: `${M}/data/preview/${H}_${id}.jpg`, webp: `${M}/data/preview/${H}_${id}.webp` });
const SIZES = { webp: 20 * 1024, sample: 300 * 1024, file: 2000 * 1024 };
const card = (id) => { const u = U(id); return `<article class="thumbnail" data-id="${id}" data-md5="${H}" data-file-ext="png" data-file-url="${u.file}" data-sample-url="${u.sample}"
  data-preview-url="${u.preview}" data-preview-webp="${u.webp}"><a href="/posts/${id}"><picture><source srcset="${u.webp}" type="image/webp"><source srcset="${u.preview}" type="image/jpeg"><img src="${u.preview}" alt=""></picture></a></article>`; };
const ids = (n) => Array.from({ length: n }, (_, i) => String(70001 + i));
const page = ({ anon = 'true', n = 20, enhancer = false } = {}) => `<!doctype html><html><head></head><body data-user-is-anonymous="${anon}">
  <section id="posts-container"${enhancer ? ' class="be-gallery-grid"' : ''}>${ids(n).map(card).join('')}</section></body></html>`;
const RAW = ['70001', '70002', '70010', H, 'static.example', 'http', '/posts/', '/data/'];
const leaks = (t) => RAW.filter((r) => t.includes(r));

async function run({ url = 'https://e621.net/posts', html = page(), src = SRC, model = {} } = {}) {
  const { sizes = 'exposed', reuse = 'memory', abortMode = 'cancel', delay = 150, deliveryType = false } = model;
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const counters = { network: 0, storage: 0, cookie: 0, loads: 0 };
  const menu = {};
  w.GM_registerMenuCommand = (label, fn) => { menu[label] = fn; };
  w.fetch = () => { counters.network++; return new Promise(() => {}); };
  w.XMLHttpRequest = class { open() { counters.network++; } send() {} };
  for (const store of [w.localStorage, w.sessionStorage]) for (const m of ['setItem', 'removeItem', 'clear', 'getItem']) { const o = store[m].bind(store); store[m] = (...a) => { counters.storage++; return o(...a); }; }
  const cd = Object.getOwnPropertyDescriptor(w.Document.prototype, 'cookie');
  Object.defineProperty(w.document, 'cookie', { get() { counters.cookie++; return cd.get.call(this); }, set(v) { counters.cookie++; cd.set.call(this, v); } });
  // Synthetic Resource Timing.
  const entries = [];
  const t0 = Date.now(); const now = () => Date.now() - t0 + 1000;
  const sizeOf = (u) => (u.endsWith('.webp') ? SIZES.webp : u.includes('/sample/') ? SIZES.sample : u.endsWith('.png') ? SIZES.file : 10 * 1024);
  const push = (name, start, transfer, body) => entries.push({ name, entryType: 'resource', startTime: start, duration: now() - start,
    transferSize: sizes === 'exposed' ? transfer : 0, encodedBodySize: sizes === 'exposed' ? body : 0, decodedBodySize: sizes === 'exposed' ? body * 2 : 0,
    ...(deliveryType ? { deliveryType: transfer === 0 ? 'cache' : '' } : {}) });
  // Native page loads: every card's WebP preview, plus unrelated resources (contamination bait).
  for (const a of w.document.querySelectorAll('article')) push(new URL(a.getAttribute('data-preview-webp')).href, 10, SIZES.webp + 300, SIZES.webp);
  for (let i = 0; i < 30; i++) push(`${M}/unrelated/${i}.png`, 20, 999999, 999999);
  w.performance.getEntriesByName = (name, type) => entries.filter((e) => e.name === name && (!type || e.entryType === type));
  w.performance.getEntriesByType = (type) => entries.filter((e) => e.entryType === type);
  w.performance.setResourceTimingBufferSize = () => {};
  w.performance.now = now;
  const cached = new Set();
  for (const a of w.document.querySelectorAll('article')) cached.add(new URL(a.getAttribute('data-preview-webp')).href);
  const desc = Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype, 'src');
  Object.defineProperty(w.HTMLImageElement.prototype, 'src', { configurable: true, get() { return desc.get.call(this); }, set(v) {
    desc.set.call(this, v);
    if (this.closest('article')) return;
    const u = String(v);
    const img = this;
    if (u === 'data:,') { const p = img.__pending; img.__pending = null; if (p) p(); return; }
    counters.loads++;
    const start = now();
    const idm = u.match(/_(\d+)\.[a-z]+$/); const mixedToggle = !!idm && Number(idm[1]) % 2 === 0; // mixed: even card ids cached, odd re-transfer
    if (cached.has(u) && (reuse === 'memory' || reuse === 'disk' || (reuse === 'mixed' && mixedToggle))) {
      setTimeout(() => { if (reuse === 'disk' || reuse === 'mixed') push(u, start, 0, sizeOf(u)); img.dispatchEvent(new w.Event('load')); }, 5);
      return;
    }
    let cancelled = false;
    img.__pending = () => { cancelled = true; };
    setTimeout(() => {
      if (cancelled && abortMode === 'cancel') return;
      push(u, start, sizeOf(u) + 300, sizeOf(u));
      cached.add(u);
      if (!cancelled) { img.__pending = null; img.dispatchEvent(new w.Event('load')); }
    }, delay);
  } });
  Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { configurable: true, get() {
    const p = this.parentElement;
    if (p && p.localName === 'picture') for (const ch of p.children) { if (ch === this) break; if (ch.localName === 'source' && ch.getAttribute('srcset')) return new URL(ch.getAttribute('srcset'), w.location.href).href; }
    return this.getAttribute('src') ? new URL(this.getAttribute('src'), w.location.href).href : '';
  } });
  const section = w.document.querySelector('section');
  const before = section.outerHTML;
  let crashed = false;
  try { w.eval(FAST(src)); await menu['IB09 V2: Run hover-cost pilot on this page'](); } catch { crashed = true; }
  // Wait for the run to finish (the result box stops saying "running").
  const read = () => w.document.querySelector('#ib09-v2-result textarea')?.value || '';
  for (let i = 0; i < 400 && /"status": "running/.test(read()); i++) await new Promise((r) => setTimeout(r, 25));
  const text = read();
  let json = null; try { json = JSON.parse(text); } catch { json = null; }
  const out = { text, json, counters, unchanged: w.document.querySelector('section').outerHTML === before, crashed };
  w.close();
  return out;
}

const hygiene = (label, r) => {
  check(`${label}: no leak`, leaks(r.text).length === 0, leaks(r.text).join(','));
  check(`${label}: page unchanged; no fetch/XHR, storage or cookie use`, r.unchanged && r.counters.network === 0 && r.counters.storage === 0 && r.counters.cookie === 0, JSON.stringify(r.counters));
};
const KI = (b) => Math.round(b / 1024);
const BOUNDED_LOADS = 4 + 16 + 8 + 4; // reuse-preview + cold/reuse(sample,file) + abort(start + follow-up) + control

async function main() {
  // 1. Sizes exposed, memory-cache reuse, abort cancels the fetch.
  let r = await run({ model: { sizes: 'exposed', reuse: 'memory', abortMode: 'cancel' } });
  let j = r.json;
  hygiene('e621 exposed/memory/cancel', r);
  check('e621: site identity and bounded sampling (16 distinct cards, 32 image loads)', j && j.site === 'e621.net' && j.sampling.distinctCards === 16 && r.counters.loads === BOUNDED_LOADS, JSON.stringify([j && j.sampling, r.counters.loads]));
  check('PREVIEW reuse of the displayed rendition: NO_ENTRY x4, verdict "no additional transfer in this sample", never "free"', j && j.slots.PREVIEW.reuseOfDisplayed.classes.NO_ENTRY === 4 && j.conclusions.currentRenditionReuse.PREVIEW === 'NO_ADDITIONAL_TRANSFER_OBSERVED_IN_THIS_SAMPLE' && /^NOT_CLAIMED/.test(j.conclusions.freeClaim), JSON.stringify(j && j.conclusions));
  check('SAMPLE and FILE cold loads: NETWORK x4 with the modelled KiB (slot classification correct)', j && j.slots.SAMPLE.cold.classes.NETWORK === 4 && j.slots.SAMPLE.cold.encodedKiB.median === KI(SIZES.sample) && j.slots.FILE.cold.encodedKiB.median === KI(SIZES.file) && j.slots.SAMPLE.cold.transferKiB.median === KI(SIZES.sample + 300), JSON.stringify(j && j.slots));
  check('reuse after load (SAMPLE, FILE): NO_ENTRY, no additional transfer', j && j.slots.SAMPLE.reuseAfterLoad.classes.NO_ENTRY === 4 && j.slots.FILE.reuseAfterLoad.classes.NO_ENTRY === 4, JSON.stringify(j && j.slots));
  check('abort (fetch really cancelled): CANCELLED x4, no entry after cancel, follow-up NETWORK, outcome CANCEL_PREVENTED_FULL_TRANSFER x4; control completed x4',
    j && j.abort.startStates.CANCELLED === 4 && j.abort.entryAfterCancel === 0 && j.abort.outcomes.CANCEL_PREVENTED_FULL_TRANSFER === 4 && j.abort.controlCompleted === 4, JSON.stringify(j && j.abort));
  check('capability: native preview entries found with sizes exposed', j && j.capability.nativePreviewEntriesFound === 16 && j.capability.nativePreviewSizesExposed === 16, JSON.stringify(j && j.capability));

  // 2. e926, sizes restricted (no Timing-Allow-Origin), disk-cache reuse, abort cancels.
  r = await run({ url: 'https://e926.net/posts', model: { sizes: 'restricted', reuse: 'disk', abortMode: 'cancel' } });
  j = r.json;
  hygiene('e926 restricted/disk/cancel', r);
  check('e926: site identity e926.net, independent of e621', j && j.site === 'e926.net');
  check('restricted sizes are SIZE_UNAVAILABLE, never zero: transfer/encoded distributions UNAVAILABLE, sizeUnavailable counted',
    j && j.slots.SAMPLE.cold.classes.SIZE_UNAVAILABLE === 4 && j.slots.SAMPLE.cold.transferKiB === 'UNAVAILABLE' && j.slots.SAMPLE.cold.sizeUnavailable === 4 && j.capability.nativePreviewSizesExposed === 0, JSON.stringify(j && j.slots.SAMPLE));
  check('restricted sizes: reuse verdict NOT_MEASURABLE; abort outcome NOT_MEASURABLE (follow-up unsized)', j && j.conclusions.currentRenditionReuse.SAMPLE === 'NOT_MEASURABLE' && j.abort.outcomes.NOT_MEASURABLE === 4, JSON.stringify([j && j.conclusions, j && j.abort]));

  // 3. Abort does not stop the fetch (it completes into the cache).
  r = await run({ model: { sizes: 'exposed', reuse: 'disk', abortMode: 'continue' } });
  j = r.json;
  hygiene('e621 exposed/disk/continue', r);
  check('abort ineffective: entry appears after cancel with transfer, follow-up CACHE, outcome CANCELLED_FETCH_STILL_REACHED_CACHE x4',
    j && j.abort.entryAfterCancel === 4 && j.abort.entryAfterCancelWithTransferSize === 4 && j.abort.outcomes.CANCELLED_FETCH_STILL_REACHED_CACHE === 4, JSON.stringify(j && j.abort));
  check('disk-cache reuse: CACHE x4 (transfer 0, body exposed), verdict no additional transfer in this sample', j && j.slots.SAMPLE.reuseAfterLoad.classes.CACHE === 4 && j.conclusions.currentRenditionReuse.SAMPLE === 'NO_ADDITIONAL_TRANSFER_OBSERVED_IN_THIS_SAMPLE', JSON.stringify(j && j.slots.SAMPLE));

  // 4. Reuse transfers again (no cache).
  r = await run({ model: { sizes: 'exposed', reuse: 'none', abortMode: 'cancel' } });
  j = r.json;
  check('no-cache reuse: NETWORK on reuse, verdict TRANSFER_OBSERVED', j && j.slots.SAMPLE.reuseAfterLoad.classes.NETWORK === 4 && j.conclusions.currentRenditionReuse.SAMPLE === 'TRANSFER_OBSERVED' && j.conclusions.currentRenditionReuse.PREVIEW === 'TRANSFER_OBSERVED', JSON.stringify(j && j.conclusions));

  // 4b. Mixed reuse (some cached, some re-transferred): the verdict must be TRANSFER_OBSERVED, never free.
  r = await run({ model: { sizes: 'exposed', reuse: 'mixed' } });
  j = r.json;
  check('mixed reuse (cache hits and re-transfers): verdict TRANSFER_OBSERVED; a cache hit is not generalized', j && j.slots.SAMPLE.reuseAfterLoad.classes.NETWORK > 0 && (j.slots.SAMPLE.reuseAfterLoad.classes.CACHE || 0) + (j.slots.FILE.reuseAfterLoad.classes.CACHE || 0) > 0 && j.conclusions.currentRenditionReuse.SAMPLE === 'TRANSFER_OBSERVED', JSON.stringify(j && j.slots.SAMPLE.reuseAfterLoad));

  // 5. deliveryType field: restricted sizes but deliveryType 'cache' classify as CACHE.
  r = await run({ url: 'https://e926.net/posts', model: { sizes: 'restricted', reuse: 'disk', deliveryType: true } });
  j = r.json;
  check('restricted sizes with deliveryType=cache: reuse classified CACHE, still never a zero-size claim', j && j.slots.SAMPLE.reuseAfterLoad.classes.CACHE === 4 && j.slots.SAMPLE.reuseAfterLoad.transferKiB === 'UNAVAILABLE' && j.capability.deliveryTypeField === true, JSON.stringify(j && j.slots.SAMPLE.reuseAfterLoad));

  // 6. Refusals: nothing loaded.
  for (const [label, opts, pat] of [
    ['enhancer active', { html: page({ enhancer: true }) }, /enhancer is active/],
    ['logged in', { html: page({ anon: 'false' }) }, /must be logged out/],
    ['not /posts', { url: 'https://e621.net/favorites' }, /\/posts listing/],
    ['too few pattern cards', { html: page({ n: 10 }) }, /INSUFFICIENT/],
    ['unsupported host', { url: 'https://rule34.xxx/index.php?page=post&s=list' }, /unsupported host/],
  ]) {
    r = await run(opts);
    check(`refusal (${label}): error, zero image loads, page unchanged`, r.json && pat.test(r.json.error || '') && r.counters.loads === 0 && r.unchanged && leaks(r.text).length === 0, r.text.slice(0, 200));
  }

  // 7. Guard.
  const leaky = SRC.replace("probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE,", "probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE, leak: cards[0].slots.SAMPLE,");
  r = await run({ src: leaky });
  check('guard: a leaking build is BLOCKED and leak-free', leaky !== SRC && r.json && r.json.sanitationGuard === 'BLOCKED' && leaks(r.text).length === 0, r.text.slice(0, 200));

  // 8. Static scope.
  const header = SRC.slice(0, SRC.indexOf('==/UserScript=='));
  const code = SRC.slice(SRC.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '');
  check('static: @match e621/e926 only; only GM_registerMenuCommand; no @connect/@require', [...header.matchAll(/@match\s+(\S+)/g)].map((x) => x[1]).join() === '*://e621.net/*,*://e926.net/*' && [...header.matchAll(/@grant\s+(\S+)/g)].map((x) => x[1]).join() === 'GM_registerMenuCommand' && !/@(connect|require|resource|updateURL|downloadURL)/.test(header));
  const forbidden = ['fetch(', 'XMLHttpRequest', 'GM_xmlhttpRequest', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'setAttribute', 'removeAttribute', 'replaceWith', 'insertBefore', 'innerHTML', 'outerHTML', '.click(', 'sendBeacon'];
  check('static: no request API other than detached Image loads; no storage/cookie; no page attribute or node writes', forbidden.every((f) => !code.includes(f)), forbidden.filter((f) => code.includes(f)).join(','));

  // 9. Fault controls.
  const unguard = (s) => s.replace("const leaked = [...raw].some((v) => text.includes(v)) || /https?:\\/\\//i.test(text);", 'const leaked = false;');
  const mut = (s, a, b) => { if (s.split(a).length !== 2) throw new Error(`pattern not unique: ${a.slice(0, 60)}`); return s.replace(a, b); };
  const base = { model: { sizes: 'exposed', reuse: 'memory', abortMode: 'cancel' } };
  const faults = [
    ['raw URL leakage', unguard(mut(SRC, "probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE,", "probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE, u: cards[0].slots.FILE,")), base, (x) => leaks(x.text).length > 0],
    ['ID leakage', unguard(mut(SRC, "probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE,", "probe: 'ib09-v2-hover-cost', version: '1.0.0', site: SITE, id: cards[0].article.getAttribute('data-id'),")), base, (x) => leaks(x.text).length > 0],
    ['incorrect slot classification (SAMPLE mapped to the file)', mut(SRC, "const sample = abs(d('data-sample-url')); const file = abs(d('data-file-url'));", "const sample = abs(d('data-file-url')); const file = abs(d('data-sample-url'));"), base, (x) => x.json && x.json.slots && x.json.slots.SAMPLE.cold.encodedKiB.median !== KI(SIZES.sample)],
    ['unavailable transfer size treated as zero', mut(SRC, "const sized = e.transferSize > 0 || e.encodedBodySize > 0 || e.decodedBodySize > 0;", 'const sized = true;'), { url: 'https://e926.net/posts', model: { sizes: 'restricted', reuse: 'disk' } }, (x) => x.json && x.json.slots && (x.json.slots.SAMPLE.cold.transferKiB !== 'UNAVAILABLE' || !x.json.slots.SAMPLE.cold.classes.SIZE_UNAVAILABLE)],
    ['cache hit treated as proof of free future loads', mut(SRC, "      if (obs.some((o) => o.cls === 'NETWORK' || o.cls === 'REVALIDATED')) return 'TRANSFER_OBSERVED';", "      if (obs.some((o) => o.cls === 'NO_ENTRY' || o.cls === 'CACHE')) return 'FREE';\n      if (obs.some((o) => o.cls === 'NETWORK' || o.cls === 'REVALIDATED')) return 'TRANSFER_OBSERVED';"), { model: { sizes: 'exposed', reuse: 'mixed' } }, (x) => x.json && x.json.conclusions && (x.json.conclusions.currentRenditionReuse.SAMPLE !== 'TRANSFER_OBSERVED' || /FREE/.test(JSON.stringify(x.json.conclusions.currentRenditionReuse)))],
    ['completed and cancelled loads not distinguished', mut(SRC, "img.src = 'data:,'; finish('CANCELLED');", "img.src = 'data:,'; finish('LOADED');"), base, (x) => x.json && x.json.abort && (x.json.abort.startStates.CANCELLED !== 4 || !x.json.abort.outcomes.CANCEL_PREVENTED_FULL_TRANSFER)],
    ['e926 relabeled as e621 (host mixing)', mut(SRC, "const SITE = SITES.includes(location.hostname) ? SITES[SITES.indexOf(location.hostname)] : null;", "const SITE = SITES.includes(location.hostname) ? 'e621.net' : null;"), { url: 'https://e926.net/posts', model: base.model }, (x) => x.json && x.json.site !== 'e926.net'],
    ['unrelated resources mixed in (entries not matched by URL)', mut(SRC, "const entriesFor = (url, since) => (performance.getEntriesByName(url, 'resource') || []).filter((e) => e.startTime >= since - 1);", "const entriesFor = (url, since) => (performance.getEntriesByType('resource') || []).filter((e) => e.startTime >= 0);"), base, (x) => x.json && x.json.slots && (x.json.slots.PREVIEW.reuseOfDisplayed.classes.NO_ENTRY !== 4 || x.json.slots.SAMPLE.cold.encodedKiB.median !== KI(SIZES.sample))],
    ['unbounded sampling', mut(SRC, 'const PER_ARM = 4;', 'const PER_ARM = 5;'), { html: page({ n: 30 }), model: base.model }, (x) => x.counters.loads !== BOUNDED_LOADS || (x.json && x.json.sampling && x.json.sampling.distinctCards !== 16)],
    ['page mutation (probe images inserted into cards)', mut(SRC, '      const img = new Image();\n', "      const img = new Image(); document.querySelector('article').appendChild(img);\n"), base, (x) => !x.unchanged],
    ['production-enhancer dependence (enhancer check removed)', mut(SRC, "    if (document.querySelector('.be-gallery-grid, .be-thumb-wrap, #be-hover-preview, #be-root')) return err('the normal enhancer is active on this page; disable it and reload');\n", ''), { html: page({ enhancer: true }), model: base.model }, (x) => x.counters.loads > 0 || !(x.json && /enhancer is active/.test(x.json.error || ''))],
  ];
  for (const [name, src, opts, caught] of faults) {
    const x = await run({ ...opts, src });
    check(`fault ${name}: caught`, caught(x), x.text.slice(0, 250));
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'E stage: V2 hover-cost pilot probe, local qualification (synthetic browser model; not live evidence)', probe: FILE,
    probe_sha256_lf: crypto.createHash('sha256').update(SRC).digest('hex'), checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'V2_HOVER_COST_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
