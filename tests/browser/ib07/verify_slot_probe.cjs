'use strict';
// Local verification for IB07_Slot_Provenance_Probe.js (no live site).
// Every output branch runs against a jsdom fixture; every output is scanned
// for raw values planted in the fixtures; probe mutants that leak must be
// caught. Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.resolve(__dirname, '../../host/ib07/node_modules/jsdom'));

const PROBE = fs.readFileSync(path.join(__dirname, 'IB07_Slot_Provenance_Probe.js'), 'utf8').replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : detail });

// Raw values planted in fixtures; none may appear in any output.
const H = '0123456789abcdef0123456789abcdef';
const RAW = ['90001', '90002', '90003', H, 'q7', 'media.example', 'http', 'secret_tag', 'Secret Title', 'some_person', '2026-01-01T00', 'rule34.xxx/index', 'e621.net/posts'];
const leaks = (text) => RAW.filter((r) => text.includes(r));

function run(url, html, { probe = PROBE, natural = null } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const w = dom.window;
  if (natural) {
    for (const [sel, [wd, ht]] of Object.entries(natural)) {
      for (const el of w.document.querySelectorAll(sel)) {
        Object.defineProperty(el, 'naturalWidth', { value: wd });
        Object.defineProperty(el, 'naturalHeight', { value: ht });
        Object.defineProperty(el, 'complete', { value: true });
      }
    }
  }
  let requests = 0;
  w.fetch = () => { requests++; return new Promise(() => {}); };
  w.XMLHttpRequest = class { open() { requests++; } send() {} };
  let text = '';
  w.console.log = (t) => { text = String(t); };
  w.eval(probe);
  dom.window.close();
  return { text, json: text ? JSON.parse(text) : null, requests };
}

// ---- fixtures -------------------------------------------------------------
const M = 'https://media.example';
const r34 = ({ img = true, textLink = false, imagesLink = false, displayed = 'images' } = {}) => {
  const src = displayed === 'samples' ? `${M}/samples/q7/sample_${H}.jpg?90001` : `${M}/images/q7/${H}.jpeg?90001`;
  return `<!doctype html><html><body title="Secret Title">
    ${img ? `<img id="image" src="${src}" width="850" height="478" alt="secret_tag">` : ''}
    <ul id="stats"><li>Id: 90001</li><li>Posted: 2026-01-01T00:00</li><li>By: some_person</li><li>Size: 1920x1080</li><li>Source: ${M}/some_person/status/90002</li></ul>
    <ul>
      ${textLink ? `<li><a href="${M}/images/q7/${H}.jpeg?90001">Original image</a></li>` : ''}
      ${imagesLink ? `<li><a href="${M}/images/q7/${H}.jpeg?90001">download</a></li>` : ''}
      <li><a href="/index.php?page=post&amp;s=list&amp;tags=secret_tag">secret_tag</a></li>
    </ul></body></html>`;
};
const card = (id, { sample = 'present', equalFile = false } = {}) => {
  const file = `${M}/data/q7/${H}.png`;
  const sampleAttr = sample === 'absent' ? '' : sample === 'empty' ? 'data-sample-url=""'
    : `data-sample-url="${equalFile ? file : `${M}/data/sample/q7/${H}.jpg`}"`;
  return `<article class="thumbnail" data-id="${id}" data-tags="secret_tag" data-md5="${H}" data-created-at="2026-01-01T00:00:00Z"
    data-file-ext="png" data-width="1448" data-height="2048" data-q7-${id}="x" data-file-url="${file}" ${sampleAttr}
    data-preview-url="${M}/data/preview/q7/${H}.jpg" data-preview-webp="${M}/data/preview/q7/${H}.webp">
    <a href="/posts/${id}" title="Secret Title"><picture><source srcset="${M}/data/preview/q7/${H}.webp">
    <img src="${M}/data/preview/q7/${H}.jpg" alt="secret_tag"></picture></a></article>`;
};
const listing = (cards) => `<!doctype html><html><body><div id="posts-container">${cards.join('')}</div></body></html>`;
const e6post = ({ sample, shown }) => {
  const file = `${M}/data/q7/${H}.png`;
  const samp = `${M}/data/sample/q7/${H}.jpg`;
  return `<!doctype html><html><body>
    <section id="image-container" data-id="90001" data-tags="secret_tag" data-md5="${H}" data-width="1448" data-height="2048"
      data-file-url="${file}" ${sample === 'present' ? `data-sample-url="${samp}"` : ''} data-created-at="2026-01-01T00:00:00Z">
      <picture><img id="image" src="${shown === 'file' ? file : samp}" alt="secret_tag" title="Secret Title"></picture></section>
    <a href="${file}">View original</a><a href="/posts?tags=secret_tag">secret_tag</a></body></html>`;
};

const R34URL = 'https://rule34.xxx/index.php?page=post&s=view&id=90001';
const cases = [
  ['rule34 qualified: img#image, no original link', R34URL, r34({ displayed: 'images' }), { natural: { 'img#image': [1920, 1080] } },
    (j) => j.status === 'QUALIFIED' && j.facts.displayedPathClass === 'images-path' && j.facts.displayedDimensionsEqualStatistics === true && j.facts.statisticsWidth === 1920],
  ['rule34 qualified, displayed sample path, dimensions differ', R34URL, r34({ displayed: 'samples' }), { natural: { 'img#image': [850, 478] } },
    (j) => j.status === 'QUALIFIED' && j.facts.displayedPathClass === 'samples-path' && j.facts.displayedFilenameHasSamplePrefix === true && j.facts.displayedDimensionsEqualStatistics === false],
  ['rule34 not qualified: Original image text link', R34URL, r34({ textLink: true, displayed: 'samples' }), {},
    (j) => j.status === 'NOT_QUALIFIED' && j.facts.originalTextLinkPresent === true],
  ['rule34 not qualified: /images/ link without the text', R34URL, r34({ imagesLink: true, displayed: 'samples' }), {},
    (j) => j.status === 'NOT_QUALIFIED' && j.facts.imagesPathLinkPresent === true && j.facts.originalTextLinkPresent === false],
  ['rule34 not qualified: no img#image', R34URL, r34({ img: false }), {},
    (j) => j.status === 'NOT_QUALIFIED' && j.facts.imgImagePresent === false],
  ['rule34 wrong route: listing', 'https://rule34.xxx/index.php?page=post&s=list', r34(), {},
    (j) => j.status === 'NOT_FOUND' && j.routeClass === 'not-post-view'],
  ['e621 qualified: card without data-sample-url', 'https://e621.net/posts', listing([card(90001), card(90002, { sample: 'absent' })]), { natural: { img: [150, 200] } },
    (j) => j.status === 'QUALIFIED' && j.aggregate.sampleAbsent === 1 && j.qualifyingCards[0].sampleAttr === 'absent' && j.qualifyingCards[0].renderedEqualsPreview === true
      && j.qualifyingCards[0].dataAttributeNamesWithheld === 1 && j.qualifyingCards[0].dataAttributeNames.includes('data-md5')],
  ['e621 qualified: empty data-sample-url', 'https://e621.net/posts', listing([card(90003, { sample: 'empty' })]), {},
    (j) => j.status === 'QUALIFIED' && j.aggregate.sampleEmpty === 1 && j.qualifyingCards[0].sampleAttr === 'empty'],
  ['e621 not qualified: all samples present, one equal to file', 'https://e621.net/posts', listing([card(90001), card(90002, { equalFile: true })]), {},
    (j) => j.status === 'NOT_QUALIFIED' && j.aggregate.samplePresentEqualsFile === 1 && j.aggregate.samplePresentDiffersFromFile === 1],
  ['e621 not found: no cards', 'https://e621.net/posts', '<!doctype html><html><body></body></html>', {},
    (j) => j.status === 'NOT_FOUND' && j.aggregate.cardsTotal === 0],
  ['e621 post page qualified: container without data-sample-url, file displayed', 'https://e621.net/posts/90001', e6post({ sample: 'absent', shown: 'file' }), { natural: { 'img#image': [1448, 2048] } },
    (j) => j.status === 'QUALIFIED' && j.routeClass === 'post-page' && j.facts.displayedEqualsFile === true && j.facts.displayedDimensionsEqualData === true && j.facts.displayedEqualsSample === null],
  ['e621 post page not qualified: container has data-sample-url', 'https://e621.net/posts/90001', e6post({ sample: 'present', shown: 'sample' }), {},
    (j) => j.status === 'NOT_QUALIFIED' && j.facts.displayedEqualsSample === true && j.facts.displayedEqualsFile === false],
  ['e621 post page without #image-container', 'https://e621.net/posts/90001', '<!doctype html><html><body></body></html>', {},
    (j) => j.status === 'NOT_FOUND' && j.routeClass === 'post-page'],
  ['e926 qualified: card without data-sample-url', 'https://e926.net/posts?page=2', listing([card(90001, { sample: 'absent' })]), {},
    (j) => j.status === 'QUALIFIED' && j.site === 'e926.net'],
  ['unsupported host', 'https://gelbooru.com/index.php?page=post&s=list', '<!doctype html><html><body></body></html>', {},
    (j) => j.status === 'NOT_FOUND' && j.site === 'unsupported'],
];

for (const [name, url, html, opts, expect] of cases) {
  const r = run(url, html, opts);
  check(`branch: ${name}`, r.json && expect(r.json), r.text.slice(0, 400));
  check(`sanitized: ${name}`, leaks(r.text).length === 0, leaks(r.text).join(', '));
  check(`no request: ${name}`, r.requests === 0, String(r.requests));
}

// ---- sanitation fault sensitivity: leaking mutants must be caught ----------
const mutants = [
  ['raw displayed URL', "facts.displayedPathClass = pathClass(src);", "facts.displayedPathClass = pathClass(src); facts.raw = src;", R34URL, r34()],
  ['raw file URL on a card', "sampleAttr: attrState(card, 'data-sample-url'),", "sampleAttr: attrState(card, 'data-sample-url'), raw: file,", 'https://e621.net/posts', listing([card(90002, { sample: 'absent' })])],
  ['unfiltered attribute names', 'dataAttributeNames: names.filter(schemaKey).sort(),', 'dataAttributeNames: names.sort(),', 'https://e621.net/posts', listing([card(90002, { sample: 'absent' })])],
  ['page URL in output', "out.routeClass = 'post-view';", "out.routeClass = 'post-view'; out.page = location.href;", R34URL, r34()],
  ['raw displayed URL on an e621 post page', "sampleAttr: attrState(c, 'data-sample-url'),", "sampleAttr: attrState(c, 'data-sample-url'), raw: shown,", 'https://e621.net/posts/90001', e6post({ sample: 'absent', shown: 'file' })],
];
for (const [name, from, to, url, html] of mutants) {
  if (PROBE.split(from).length !== 2) { check(`mutant applies: ${name}`, false, 'pattern not found once'); continue; }
  const r = run(url, html, { probe: PROBE.replace(from, to) });
  check(`sanitation catches mutant: ${name}`, leaks(r.text).length > 0, 'mutant output was not flagged');
}

// ---- static ------------------------------------------------------------------
try { new Function(PROBE); check('probe parses', true); } catch (e) { check('probe parses', false, e.message); }
check('probe uses no request, click, navigation, cookie or storage API',
  !/\bfetch\(|XMLHttpRequest|sendBeacon|\.click\(|location\.(assign|replace)|location\.href\s*=|document\.cookie|localStorage|sessionStorage/.test(PROBE));
check('probe is LF-only', !fs.readFileSync(path.join(__dirname, 'IB07_Slot_Provenance_Probe.js'), 'utf8').includes('\r'));

const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({ suite: 'ib07-slot-provenance-probe-verify', total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
