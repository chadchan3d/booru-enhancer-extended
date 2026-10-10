'use strict';
// Local qualification of the IB12-E2 Rule34 observation package (no real browser):
//   1. static: package current; executed body byte-identical to production 466a480
//      (= the working tree); scope rule34.xxx only; the recorder makes no history,
//      scroll, focus, settings, network or event-cancelling call; its only storage
//      is one sessionStorage key; request wrappers pass-through; results path
//      git-ignored;
//   2. recorder smoke (jsdom; FAKE production surface; one shared sessionStorage
//      across the simulated documents): two appended batches -> C chosen from the
//      second -> normal Back as a BFCache restore (C kept) -> fresh-load Back (a new
//      document without the appended cards) -> fresh load of C's observed native
//      page (C present) => the run completes, values are recorded, the output is
//      sanitized and the evaluator says CASE B; a second Back that is not a fresh
//      load => FRESH BACK NOT ACHIEVED;
//   3. evaluator: CASE A, CASE C and an INVALID (input during a return) from edits.
// Usage: node verify_ib12_e2.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const B = require('./build_ib12_e2.cjs');
const { evaluate } = require('./evaluate_ib12_e2.cjs');
const { WRAP_OPEN, WRAP_CLOSE, split } = require('../ib07/build_production_conformance.cjs');
const { JSDOM } = require(require.resolve('jsdom', { paths: [path.resolve(__dirname, '../../host/ib07')] }));

const REPO = path.resolve(__dirname, '../../..');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 900) });
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---- 1. static ----
const built = B.build();
const PKG = fs.readFileSync(B.OUT, 'utf8');
check('package matches a fresh build', PKG === built.text);
const execBody = PKG.slice(PKG.indexOf(WRAP_OPEN) + WRAP_OPEN.length, PKG.indexOf(WRAP_CLOSE));
const workTree = fs.readFileSync(path.join(REPO, 'Booru_Enhancer.user.js'), 'utf8').replace(/\r\n/g, '\n');
check('executed body = production 466a480 byte for byte (blob 3be0e1f, body 9fa6ab28…36b3) = the working tree; no hooks',
  execBody === split(git('show', `${B.COMMIT}:Booru_Enhancer.user.js`)).body && sha(execBody) === B.EXPECTED_BODY_SHA256 && git('rev-parse', `${B.COMMIT}:Booru_Enhancer.user.js`).trim() === B.EXPECTED_PRODUCTION_BLOB && split(workTree).body === execBody);
const meta = split(PKG).meta;
check('scope: @match rule34.xxx only; distinct name/namespace', meta.split('\n').filter((l) => /^\/\/ @match\s/.test(l)).join() === '// @match        *://rule34.xxx/*' && /IB12 E2 Rule34/.test(meta) && /ib12-e2-rule34/.test(meta));
const post = built.postamble;
const forbidden = /pushState|replaceState|history\.(back|go|forward)|scrollTo|scrollBy|scrollIntoView|location\.(href|assign|replace)\s*=(?!=)|location\.assign|\.focus\(|fetch\(|XMLHttpRequest|GM_xmlhttpRequest|GM_setValue|localStorage|document\.cookie|preventDefault|stopPropagation|BE\.settings\.set/;
check('recorder: no history write, scroll, focus, network, settings, cookie/localStorage or event-cancelling call', !forbidden.test(post), (post.match(forbidden) || [''])[0]);
check('recorder: sessionStorage used only under its one key; BE.net.request/json wrapped pass-through (the same promise returned)',
  (post.match(/sessionStorage\.\w+\(/g) || []).every((m) => /getItem|setItem|removeItem/.test(m)) && (post.match(/sessionStorage\.(getItem|setItem|removeItem)\(KEY/g) || []).length === (post.match(/sessionStorage\.\w+\(/g) || []).length
  && /const p = reqOrig\.apply\(this, arguments\);[\s\S]*?return p;/.test(post) && /const p = jsonOrig\.apply\(this, arguments\);[^\n]*return p;/.test(post));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
check('results path tests/results/ib12-e2-rule34.json is git-ignored', ign('tests/results/ib12-e2-rule34.json'));

// ---- 2. recorder smoke ----
const BASE = 'https://rule34.xxx/index.php';
const URLP = (pid, s = 'list') => `${BASE}?page=post&s=${s}${pid ? `&pid=${pid}` : ''}`;
const ID = (pid, k) => String(70001 + pid + k); // stand-in post IDs (5 digits; the leak guard must keep them out)
const PER = 42; const COLS = 6; const ROW = 250; const VH = 800;
const cardHtml = (id) => `<span class="thumb" data-id="${id}"><a href="index.php?page=post&s=view&id=${id}"><img src="/t/${id}.jpg"></a></span>`;
const listHtml = (pid) => `<!doctype html><html><body><div class="image-list">${Array.from({ length: PER }, (_, k) => cardHtml(ID(pid, k))).join('')}</div><div id="paginator"><a alt="next" href="${URLP(pid + PER)}">&gt;</a></div></body></html>`;

const WINDOWS = []; // every simulated document; closed at the end (the recorder's panel timer would keep them alive)
function makeStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }

function doc(url, html, store, { nav = 'navigate', reasons = [] } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; const d = w.document; let sy = 0; WINDOWS.push(w);
  Object.defineProperty(w, 'sessionStorage', { configurable: true, value: store });
  Object.defineProperty(w, 'scrollY', { configurable: true, get: () => sy });
  Object.defineProperty(w, 'scrollX', { configurable: true, value: 0 });
  Object.defineProperty(w, 'innerHeight', { configurable: true, value: VH });
  Object.defineProperty(w, 'crypto', { configurable: true, value: webcrypto });
  w.TextEncoder = TextEncoder; w.GM_info = { scriptHandler: 'jsdom-smoke', version: '0' };
  w.performance.getEntriesByType = (t) => (t === 'navigation' ? [{ type: nav, notRestoredReasons: { reasons: reasons.map((reason) => ({ reason })), children: [] } }] : []);
  const container = () => d.querySelector('.image-list');
  const thumbs = () => [...container().querySelectorAll('span.thumb')];
  w.Element.prototype.getBoundingClientRect = function rect() {
    const t = this.closest && this.closest('span.thumb'); const i = t ? thumbs().indexOf(t) : -1;
    if (i < 0) return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
    const top = Math.floor(i / COLS) * ROW + 5 - sy; return { top, left: (i % COLS) * 160, bottom: top + ROW - 10, right: (i % COLS) * 160 + 150, width: 150, height: ROW - 10 };
  };
  // FAKE production surface: adapter reads, request gate, and the append continuation
  w.BE = { adapters: { active: {
    getGalleryContainer: () => container(), getThumbElements: (root) => [...root.querySelectorAll('span.thumb img')],
    getThumbWrapper: (img) => img.closest('span.thumb'), getThumbPostId: (img) => img.closest('span.thumb').getAttribute('data-id') } },
  net: { request: () => Promise.resolve({ status: 200 }), json: () => Promise.resolve({}) } };
  const appendPage = async (pid) => {
    const p = w.BE.net.request({ url: URLP(pid), operation: 'gallery-pagination' }, 3);
    await p; // production's own continuation runs after the probe's then()
    const tmp = new JSDOM(listHtml(pid)).window.document;
    for (const t of tmp.querySelectorAll('span.thumb')) container().appendChild(d.importNode(t, true));
    await sleep(20);
  };
  const bodyText = '// fake production body\n';
  w.eval(`const IB07P_PRODUCTION_BODY = function () {\n${bodyText}};\n` + post.replace('__EXPECTED_BODY_SHA256__', sha(bodyText)));
  const linkByStep = (n) => [...d.querySelectorAll('#ib12e2-panel a')].find((a) => a.textContent.startsWith(`${n})`));
  return { w, d, setScroll: (y) => { sy = y; }, appendPage, linkByStep, pageshow: (persisted) => { const e = new w.Event('pageshow'); e.persisted = persisted; w.dispatchEvent(e); } };
}

async function flow({ freshBack = true }) {
  const store = makeStore();
  const a = doc(URLP(0), listHtml(0), store); await sleep(50);
  await a.appendPage(42); await a.appendPage(84);
  a.setScroll(Math.floor(84 / COLS) * ROW - 200); await sleep(600); // C (ordinal 84) in view
  const l1 = a.linkByStep(1); if (!l1) return { error: 'no step-1 link' };
  const cHref = l1.href; l1.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  doc(cHref, '<!doctype html><html><body>post</body></html>', store); // the post page
  a.pageshow(true); await sleep(1700); // normal Back = BFCache restore of the same document
  await sleep(600);
  const l2 = a.linkByStep(2); if (!l2) return { error: 'no step-2 link' };
  l2.dispatchEvent(new a.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  let b;
  if (freshBack) { b = doc(URLP(0), listHtml(0), store, { nav: 'back_forward', reasons: ['unload-listener'] }); await sleep(50); b.pageshow(false); }
  else { b = a; a.pageshow(true); }
  await sleep(1700); await sleep(600);
  const l3 = b.linkByStep(3); if (!l3) return { error: 'no step-3 link' };
  const target = l3.href; l3.dispatchEvent(new b.w.MouseEvent('click', { bubbles: true, cancelable: true }));
  const pid = Number(new URL(target).searchParams.get('pid'));
  const c = doc(target, listHtml(pid), store, { nav: 'navigate' }); await sleep(300);
  const raw = c.w.__IB12E2_RESULT__ || null;
  return { raw, doc: raw ? JSON.parse(raw) : null };
}

async function main() {
  const r = await flow({ freshBack: true });
  const ev = r.doc ? evaluate(clone(r.doc)) : null;
  check('smoke: the full flow completes across documents (shared sessionStorage) and shows a result', r.doc && r.doc.complete && r.doc.production_body_identity === 'MATCH_EXPECTED_ARTIFACT', JSON.stringify(r).slice(0, 600));
  check('smoke: native append facts recorded - two batches with pids 42 and 84 and their ordinal ranges; C = the first card of the second batch (ordinal 84, later pid)',
    r.doc && r.doc.batches.map((x) => `${x.pid}:${x.ordinalFrom}-${x.ordinalTo}`).join() === '42:42-83,84:84-125' && r.doc.C.batchPid === 84 && r.doc.C.ordinal === 84 && r.doc.C.laterThanFirstBatch, JSON.stringify(r.doc && { b: r.doc.batches, C: r.doc.C }));
  check('smoke: returns recorded - back1 BFCache (persisted, C kept), back2 a confirmed fresh back_forward load (C gone, only the starting page), unload-listener armed; page check finds C on its observed page',
    r.doc && r.doc.back1.persisted === true && r.doc.back1.snaps.length === 2 && r.doc.back2.freshLoadConfirmed === true && r.doc.back2.snaps[1].cConnected === false && r.doc.back2.snaps[1].cardCount === 42
    && r.doc.freshArm.includes('unload-listener') && r.doc.pageCheck.cOnPage === true && r.doc.pageCheck.sameParams === true && r.doc.pageCheck.cOrdinalOnPage === 0, JSON.stringify(r.doc && { b1: r.doc.back1, b2: r.doc.back2, pc: r.doc.pageCheck }).slice(0, 900));
  check('smoke: sanitized - no URL, no post ID, no tag text', r.raw && !/https?:\/\//.test(r.raw) && ![0, 42, 84].some((pid) => Array.from({ length: PER }, (_, k) => ID(pid, k)).some((v) => r.raw.includes(v))));
  check('smoke: evaluator on the full flow -> CASE B', ev && ev.verdict === 'CASE B', JSON.stringify(ev).slice(0, 600));
  const n = await flow({ freshBack: false });
  const en = n.doc ? evaluate(clone(n.doc)) : null;
  check('smoke: a second Back that is still a BFCache restore -> FRESH BACK NOT ACHIEVED (record and stop)', en && en.verdict === 'FRESH BACK NOT ACHIEVED', JSON.stringify(en).slice(0, 400));
  if (r.doc) {
    const a2 = clone(r.doc); a2.back2.snaps.forEach((s) => { s.cConnected = true; s.c = { visibleFraction: 1 }; });
    check('evaluator: both returns useful -> CASE A', evaluate(a2).verdict === 'CASE A');
    const c2 = clone(r.doc); c2.pageCheck.cOnPage = false;
    check('evaluator: fresh return loses C and C is not on its observed page -> CASE C', evaluate(c2).verdict === 'CASE C');
    const i2 = clone(r.doc); i2.back1.inputAfterReturn = 1;
    check('evaluator: operator input during a return -> INVALID', evaluate(i2).verdict === 'INVALID');
  }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB12_E2_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib12-e2-verification', commit: B.COMMIT, blob: B.EXPECTED_PRODUCTION_BLOB, bodySha256: B.EXPECTED_BODY_SHA256, packageSha256: sha(PKG), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; }).finally(() => { for (const w of WINDOWS) { try { w.close(); } catch { /* noop */ } } });
