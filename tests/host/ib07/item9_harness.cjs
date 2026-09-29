'use strict';
// IB07 §3 item 9 harness: runs the real production userscript inside jsdom
// against a host fixture. Enhancer request transports (GM_xmlhttpRequest,
// fetch, XMLHttpRequest, sendBeacon, GM_download) are instrumented BEFORE the
// production source is evaluated, so startup requests are counted too. jsdom
// loads no subresources and runs no page scripts, so every recorded request
// is enhancer work; native site networking cannot enter the counts.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');

const PRODUCTION_PATH = path.resolve(__dirname, '../../../Booru_Enhancer.user.js');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function productionSource() {
  return fs.readFileSync(PRODUCTION_PATH, 'utf8').replace(/\r\n/g, '\n');
}

// Git blob id of the LF source, to tie results to a committed production blob.
function gitBlobId(text) {
  const buf = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

// Metadata classes for the IB01 oracles. Pagination and media are "other".
function classify(url) {
  const u = String(url || '');
  if (/[?&]page=dapi\b|\.json(\?|$)|\/api\//i.test(u)) return 'api';
  if (/[?&]page=post&s=view\b|\/posts\/\d+(\?|#|$)/i.test(u)) return 'postPage';
  return 'other';
}

function load({ url, html, source = productionSource(), settings = {} }) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => errors.push(String(e?.message || e)));
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window;

  const requests = [];
  const record = (transport, target) => requests.push({ transport, kind: classify(target) });

  // Instrumented transports: record, then stay pending (no network exists).
  w.GM_xmlhttpRequest = (opts) => { record('GM_xmlhttpRequest', opts?.url); return { abort() {} }; };
  w.fetch = (input) => { record('fetch', typeof input === 'string' ? input : input?.url); return new Promise(() => {}); };
  w.XMLHttpRequest = class { open(m, u) { this.u = u; } send() { record('XMLHttpRequest', this.u); } setRequestHeader() {} abort() {} };
  w.navigator.sendBeacon = (u) => { record('sendBeacon', u); return true; };
  w.GM_download = (opts) => { record('GM_download', opts?.url); };

  // Manager storage and UI APIs, in memory.
  const store = new Map(Object.entries(settings));
  w.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
  w.GM_setValue = (k, v) => { store.set(k, v); };
  w.GM_deleteValue = (k) => { store.delete(k); };
  w.GM_listValues = () => [...store.keys()];
  w.GM_registerMenuCommand = () => 0;
  w.GM_notification = () => {};
  w.GM_addStyle = (css) => { const s = w.document.createElement('style'); s.textContent = css; w.document.head.appendChild(s); return s; };
  w.GM_info = { scriptHandler: 'jsdom-harness', version: '0', script: { name: 'Booru Enhancer Extended', version: '1.2.7.3' } };

  // Browser APIs jsdom lacks; inert stubs that never fire or fetch.
  w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  w.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  if (!w.CSS) w.CSS = {};
  if (typeof w.CSS.escape !== 'function') w.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
  w.requestIdleCallback = (fn) => w.setTimeout(() => fn({ didTimeout: false, timeRemaining: () => 50 }), 0);
  w.cancelIdleCallback = (id) => w.clearTimeout(id);
  w.scrollTo = () => {};
  w.open = () => null;
  w.HTMLMediaElement.prototype.play = function play() { return Promise.resolve(); };
  w.HTMLMediaElement.prototype.pause = function pause() {};
  w.HTMLMediaElement.prototype.load = function mediaLoad() {};

  w.eval(source);

  const BE = w.BE;
  // Call counters on every registered adapter, installed before production's
  // init selects one (jsdom fires DOMContentLoaded after evaluation), so the
  // counts show whether the startup, hover and on-demand paths actually ran.
  const calls = { fetchThumbBatch: 0, fetchThumbBatchIds: 0, fetchPost: 0 };
  for (const entry of BE?.adapters?.registry || []) {
    const batch = entry.fetchThumbBatch;
    if (typeof batch === 'function') entry.fetchThumbBatch = function wrappedBatch(ids) { calls.fetchThumbBatch++; calls.fetchThumbBatchIds += (ids || []).length; return batch.apply(this, arguments); };
    const fetchPost = entry.fetchPost;
    if (typeof fetchPost === 'function') entry.fetchPost = function wrappedFetchPost() { calls.fetchPost++; return fetchPost.apply(this, arguments); };
  }

  const counts = () => ({
    apiRequests: requests.filter((r) => r.kind === 'api').length,
    postPageRequests: requests.filter((r) => r.kind === 'postPage').length,
    otherRequests: requests.filter((r) => r.kind === 'other').length,
    total: requests.length,
  });

  return { dom, window: w, BE, get adapter() { return BE?.adapters?.active || null; }, requests, calls, counts, errors };
}

// Load and wait until production's init has selected an adapter and its
// deferred startup work (setTimeout 0 enrichment) has had time to run.
async function loadAndStart(fixture, settleMs = 150) {
  const ctx = load(fixture);
  await sleep(settleMs);
  return ctx;
}

// Pointer sweep across every enhanced card: enter and leave each wrapper in
// turn without pausing, then observe a short window. Production's hover path
// has no dwell timer before metadata work, so any request it admits for a
// sweep starts within this window.
async function pointerSweep(ctx, windowMs = 100) {
  const w = ctx.window;
  const wraps = [...w.document.querySelectorAll('.be-thumb-wrap')];
  const before = ctx.requests.length;
  const fetchPostBefore = ctx.calls.fetchPost;
  for (const wrap of wraps) {
    const img = wrap.querySelector('img') || wrap;
    img.dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true }));
    img.dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body }));
  }
  await sleep(windowMs);
  const during = ctx.requests.slice(before);
  return {
    cardsSwept: wraps.length,
    fetchPostCalls: ctx.calls.fetchPost - fetchPostBefore,
    apiRequests: during.filter((r) => r.kind === 'api').length,
    postPageRequests: during.filter((r) => r.kind === 'postPage').length,
    otherRequests: during.filter((r) => r.kind === 'other').length,
  };
}

module.exports = { load, loadAndStart, pointerSweep, sleep, productionSource, gitBlobId, classify, PRODUCTION_PATH };
