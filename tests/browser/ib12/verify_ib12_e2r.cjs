'use strict';
// Local qualification of the IB12-E2R guided Rule34 observation package (no real
// browser). E2R changes only the operator panel of the E2 recorder:
//   1. static: package current; executed body = production 466a480 = the working
//      tree; Rule34-only scope; the E2 package unchanged (historical); every
//      measurement function of the recorder byte-identical to the E2 recorder's;
//      no history-write/scroll/focus/network/settings/event-cancelling call; one
//      sessionStorage key; results path git-ignored;
//   2. guided flow (jsdom; FAKE production surface; one shared sessionStorage across
//      the simulated documents): the panel shows exactly the specified state at
//      each step - STEP 1 page counts, C FOUND, one OPEN C POST action; STEP 2 on the
//      post page; BACK DETECTED - RECORDING with no action and no reset; STEP 3; STEP
//      4 with "Fresh Back confirmed" or the BFCache outcome text; TEST COMPLETE - and
//      the evidence is the E2 evidence (evaluator CASE B; FRESH BACK NOT ACHIEVED for
//      a non-fresh second Back); an out-of-flow post page shows TEST STATE INVALID.
// Usage: node verify_ib12_e2r.cjs
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
const built = B.buildE2R();
const PKG = fs.readFileSync(B.E2R.out, 'utf8');
check('E2R package matches a fresh build', PKG === built.text);
const execBody = PKG.slice(PKG.indexOf(WRAP_OPEN) + WRAP_OPEN.length, PKG.indexOf(WRAP_CLOSE));
const workTree = fs.readFileSync(path.join(REPO, 'Booru_Enhancer.user.js'), 'utf8').replace(/\r\n/g, '\n');
check('executed body = production 466a480 byte for byte (blob 3be0e1f, body 9fa6ab28…36b3) = the working tree',
  execBody === split(git('show', `${B.COMMIT}:Booru_Enhancer.user.js`)).body && sha(execBody) === B.EXPECTED_BODY_SHA256 && split(workTree).body === execBody);
check('the E2 package is unchanged (historical 3e703639…372d; fresh build identical)', sha(fs.readFileSync(B.OUT)) === '3e7036399b7ba25a75647ec4e45a25a19b14f2cc95691fd2c10d819106ec372d' && fs.readFileSync(B.OUT, 'utf8') === B.build().text);
const meta = split(PKG).meta;
check('scope: @match rule34.xxx only; distinct name/namespace', meta.split('\n').filter((l) => /^\/\/ @match\s/.test(l)).join() === '// @match        *://rule34.xxx/*' && /IB12 E2R Rule34/.test(meta) && /ib12-e2r-rule34/.test(meta));
const post = built.postamble;
const e2post = fs.readFileSync(path.join(__dirname, 'ib12e2_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
const fnText = (src, name) => { const m = new RegExp(`\\n  (async )?function ${name}\\(`).exec(src); const i = m ? m.index + 1 : -1; if (i < 0) return null; const j = src.indexOf('\n  }\n', i); return src.slice(i, j); };
const MEASURE = ['cards', 'vis', 'snapshot', 'recordBatch', 'navFacts', 'leave', 'armFresh', 'pageCheck', 'sourceIdentity', 'runtime', 'guard', 'finish'];
const differing = MEASURE.filter((n) => !fnText(post, n) || fnText(post, n) !== fnText(e2post, n));
const block = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
check('evidence unchanged: every measurement function and the request wrappers / pageshow observation are byte-identical to the E2 recorder (only the panel and a panel refresh differ)',
  differing.length === 0 && block(post, '  // ---- request observation', '  function recordBatch') === block(e2post, '  // ---- request observation', '  function recordBatch')
  && block(post, '  window.addEventListener(\'pageshow\'', '  // ---- panel').replace('save(S); render();\n', 'save(S);\n') === block(e2post, '  window.addEventListener(\'pageshow\'', '  // ---- panel'), differing.join());
const forbidden = /pushState|replaceState|history\.(back|go|forward)|scrollTo|scrollBy|scrollIntoView|location\.(href|assign|replace)\s*=(?!=)|location\.assign|\.focus\(|fetch\(|XMLHttpRequest|GM_xmlhttpRequest|GM_setValue|localStorage|document\.cookie|preventDefault|stopPropagation|BE\.settings\.set/;
check('recorder: no history write, scroll, focus, network, settings, cookie/localStorage or event-cancelling call; one sessionStorage key', !forbidden.test(post)
  && (post.match(/sessionStorage\.(getItem|setItem|removeItem)\(KEY/g) || []).length === (post.match(/sessionStorage\.\w+\(/g) || []).length, (post.match(forbidden) || [''])[0]);
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
check('results path tests/results/ib12-e2-rule34.json is git-ignored', ign('tests/results/ib12-e2-rule34.json'));

// ---- 2. guided flow ----
const BASE = 'https://rule34.xxx/index.php';
const URLP = (pid, s = 'list') => `${BASE}?page=post&s=${s}${pid ? `&pid=${pid}` : ''}`;
const ID = (pid, k) => String(70001 + pid + k);
const PER = 42; const COLS = 6; const ROW = 250; const VH = 800;
const cardHtml = (id) => `<span class="thumb" data-id="${id}"><a href="index.php?page=post&s=view&id=${id}"><img src="/t/${id}.jpg"></a></span>`;
const listHtml = (pid) => `<!doctype html><html><body><div class="image-list">${Array.from({ length: PER }, (_, k) => cardHtml(ID(pid, k))).join('')}</div><div id="paginator"><a alt="next" href="${URLP(pid + PER)}">&gt;</a></div></body></html>`;
const WINDOWS = [];
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
  const thumbs = () => (container() ? [...container().querySelectorAll('span.thumb')] : []);
  w.Element.prototype.getBoundingClientRect = function rect() {
    const t = this.closest && this.closest('span.thumb'); const i = t ? thumbs().indexOf(t) : -1;
    if (i < 0) return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
    const top = Math.floor(i / COLS) * ROW + 5 - sy; return { top, left: (i % COLS) * 160, bottom: top + ROW - 10, right: (i % COLS) * 160 + 150, width: 150, height: ROW - 10 };
  };
  w.BE = { adapters: { active: {
    getGalleryContainer: () => container(), getThumbElements: (root) => [...root.querySelectorAll('span.thumb img')],
    getThumbWrapper: (img) => img.closest('span.thumb'), getThumbPostId: (img) => img.closest('span.thumb').getAttribute('data-id') } },
  net: { request: () => Promise.resolve({ status: 200 }), json: () => Promise.resolve({}) } };
  const appendPage = async (pid) => {
    const p = w.BE.net.request({ url: URLP(pid), operation: 'gallery-pagination' }, 3); await p;
    const tmp = new JSDOM(listHtml(pid)).window.document;
    for (const t of tmp.querySelectorAll('span.thumb')) container().appendChild(d.importNode(t, true));
    await sleep(20);
  };
  const bodyText = '// fake production body\n';
  w.eval(`const IB07P_PRODUCTION_BODY = function () {\n${bodyText}};\n` + post.replace('__EXPECTED_BODY_SHA256__', sha(bodyText)));
  const panel = () => {
    const p = d.querySelector('#ib12e2-panel'); if (!p) return null;
    const q = (s) => p.querySelector(s);
    return { head: q('[data-ib12e2-head]')?.textContent, title: q('[data-ib12e2-title]')?.textContent, lines: [...p.querySelectorAll('[data-ib12e2-line]')].map((x) => x.textContent),
      actions: [...p.querySelectorAll('[data-ib12e2-action]')], reset: !!q('[data-ib12e2-reset]') };
  };
  return { w, d, setScroll: (y) => { sy = y; }, appendPage, panel, pageshow: (persisted) => { const e = new w.Event('pageshow'); e.persisted = persisted; w.dispatchEvent(e); } };
}
const tick = () => sleep(600);
const click = (env, a) => a.dispatchEvent(new env.w.MouseEvent('click', { bubbles: true, cancelable: true }));
const S = (env) => env.panel() || {};
const one = (env, text) => { const p = S(env); return p.actions.length === 1 && p.actions[0].textContent === text ? p.actions[0] : null; };

async function flow({ freshBack = true }) {
  const seen = {}; const store = makeStore();
  const a = doc(URLP(0), listHtml(0), store); await tick();
  seen.s1a = S(a);
  await a.appendPage(42); await tick(); seen.s1b = S(a);
  await a.appendPage(84); await tick(); seen.s1c = S(a);
  a.setScroll(Math.floor(84 / COLS) * ROW - 200); await tick(); seen.s1d = S(a);
  const go1 = one(a, 'OPEN C POST IN SAME TAB'); if (!go1) return { seen, error: 'no step-1 action' };
  const cHref = go1.href; click(a, go1);
  const p1 = doc(cHref, '<!doctype html><html><body>post</body></html>', store); await tick(); seen.s2 = S(p1);
  a.pageshow(true); await sleep(200); seen.rec1 = S(a);
  await sleep(1500); await tick(); seen.s3 = S(a);
  const go2 = one(a, 'OPEN C POST IN SAME TAB'); if (!go2) return { seen, error: 'no step-3 action' };
  click(a, go2);
  const p2 = doc(cHref, '<!doctype html><html><body>post</body></html>', store); await tick(); seen.s3post = S(p2);
  let b;
  if (freshBack) { b = doc(URLP(0), listHtml(0), store, { nav: 'back_forward', reasons: ['unload-listener'] }); await sleep(50); b.pageshow(false); }
  else { b = a; a.pageshow(true); }
  await sleep(200); seen.rec2 = S(b);
  await sleep(1500); await tick(); seen.s4 = S(b);
  const go3 = one(b, 'OPEN OBSERVED PAGE'); if (!go3) return { seen, error: 'no step-4 action' };
  const target = go3.href; click(b, go3);
  const c = doc(target, listHtml(Number(new URL(target).searchParams.get('pid'))), store); await tick(); seen.done = S(c);
  const raw = c.w.__IB12E2_RESULT__ || null;
  return { seen, raw, doc: raw ? JSON.parse(raw) : null, resultBox: !!c.d.getElementById('ib12e2-result') };
}

async function main() {
  const r = await flow({ freshBack: true }); const s = r.seen;
  check('STEP 1: "IB12-E2 TEST — STEP 1 OF 4", "STEP 1 — LOAD TWO APPENDED PAGES", counts 0 / 2 and 1 / 2, then "C FOUND — scroll until the pink card is visible." with no action; once C is visible exactly one action "OPEN C POST IN SAME TAB"',
    s.s1a.head === 'IB12-E2 TEST — STEP 1 OF 4' && s.s1a.title === 'STEP 1 — LOAD TWO APPENDED PAGES' && s.s1a.lines.includes('Appended pages: 0 / 2') && s.s1a.actions.length === 0
    && s.s1b.lines.includes('Appended pages: 1 / 2') && s.s1c.lines.includes('C FOUND — scroll until the pink card is visible.') && s.s1c.actions.length === 0 && s.s1d.actions.length === 1, JSON.stringify({ a: s.s1a, b: s.s1b, c: s.s1c, d: s.s1d && s.s1d.lines }));
  check('STEP 2 on the post page: "STEP 2 — NORMAL BACK TEST" and "Now press Chrome\'s Back button once." with no action', s.s2 && s.s2.title === 'STEP 2 — NORMAL BACK TEST' && s.s2.lines[0] === 'Now press Chrome\'s Back button once.' && s.s2.actions.length === 0 && s.s2.head === 'IB12-E2 TEST — STEP 2 OF 4', JSON.stringify(s.s2));
  check('recording after Back: "BACK DETECTED — RECORDING", "Do not scroll or click.", Recording…; no action and no reset control', s.rec1 && s.rec1.title === 'BACK DETECTED — RECORDING' && s.rec1.lines[0] === 'Do not scroll or click.' && /^Recording…/.test(s.rec1.lines[1]) && s.rec1.actions.length === 0 && !s.rec1.reset, JSON.stringify(s.rec1));
  check('STEP 3: "Normal Back: Recorded." and exactly one "OPEN C POST IN SAME TAB"; on the post page "STEP 3 — FRESH-LOAD BACK TEST" + press Back; recording again on return with no action',
    s.s3 && s.s3.title === 'STEP 3 — FRESH-LOAD BACK TEST' && s.s3.lines[0] === 'Normal Back: Recorded.' && s.s3.actions.length === 1 && s.s3post.title === 'STEP 3 — FRESH-LOAD BACK TEST' && s.s3post.lines[0] === 'Now press Chrome\'s Back button once.'
    && s.rec2.title === 'BACK DETECTED — RECORDING' && s.rec2.actions.length === 0 && !s.rec2.reset, JSON.stringify({ s3: s.s3, p: s.s3post, r: s.rec2 }));
  check('STEP 4: "Fresh Back confirmed." and exactly one "OPEN OBSERVED PAGE"; then "TEST COMPLETE" with the result box', s.s4 && s.s4.title === 'STEP 4 — CHECK C\'S OBSERVED NATIVE PAGE' && s.s4.lines[0] === 'Fresh Back confirmed.' && s.s4.actions.length === 1 && s.done.title === 'TEST COMPLETE' && r.resultBox, JSON.stringify({ s4: s.s4, done: s.done }));
  const ev = r.doc ? evaluate(clone(r.doc)) : null;
  check('evidence: the guided run records the E2 evidence (two batches pid 42/84, C ordinal 84) - evaluator CASE B; sanitized output', ev && ev.verdict === 'CASE B' && r.doc.batches.map((x) => x.pid).join() === '42,84' && r.doc.C.ordinal === 84 && r.doc.version === '1.1.0-guided'
    && !/https?:\/\//.test(r.raw) && ![0, 42, 84].some((pid) => Array.from({ length: PER }, (_, k) => ID(pid, k)).some((v) => r.raw.includes(v))), JSON.stringify(ev).slice(0, 500));
  const n = await flow({ freshBack: false });
  const en = n.doc ? evaluate(clone(n.doc)) : null;
  check('non-fresh second Back: STEP 4 states "Chrome used BFCache; fresh Back was not achieved. This is a valid recorded outcome." and the run completes (FRESH BACK NOT ACHIEVED)',
    n.seen.s4 && n.seen.s4.lines[0] === 'Chrome used BFCache; fresh Back was not achieved. This is a valid recorded outcome.' && n.seen.done.title === 'TEST COMPLETE' && en && en.verdict === 'FRESH BACK NOT ACHIEVED', JSON.stringify(n.seen.s4));
  { // a post page opened outside the flow (state collect) -> invalid
    const store = makeStore(); const a = doc(URLP(0), listHtml(0), store); await tick();
    const p = doc(`${BASE}?page=post&s=view&id=1`, '<!doctype html><html><body>post</body></html>', store); await tick();
    check('inconsistent state: a post page opened outside the flow shows "TEST STATE INVALID — press Reset and start over" with a reset control', S(p).title === 'TEST STATE INVALID — press Reset and start over' && S(p).reset && S(p).actions.length === 0, JSON.stringify(S(p)));
  }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB12_E2R_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib12-e2r-verification', commit: B.COMMIT, blob: B.EXPECTED_PRODUCTION_BLOB, bodySha256: B.EXPECTED_BODY_SHA256, packageSha256: sha(PKG), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; }).finally(() => { for (const w of WINDOWS) { try { w.close(); } catch { /* noop */ } } });
