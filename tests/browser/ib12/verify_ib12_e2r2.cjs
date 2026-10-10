'use strict';
// Local qualification of the IB12-E2R2 package (no real browser). The real E2R run
// lost its sessionStorage run state across navigation; the E2R verifier hid that by
// sharing one sessionStorage object between simulated documents. Here every document
// is an INDEPENDENT jsdom runtime with its own fresh sessionStorage, and the only
// cross-page persistence is a per-script GM store (Tampermonkey's model).
//   1. static: package current; body = production 466a480 = the working tree; the E2
//      and E2R packages unchanged (historical); every E2 measurement function
//      byte-identical; no history-write/scroll/focus/network/settings call; the GM
//      store used only under the one probe key; results path git-ignored;
//   2. reproduction: the E2R recorder in independent documents shows "not started"
//      on the post page (the real defect);
//   3. E2R2: no state -> one START action and nothing stored; START -> independent
//      listing -> STEP 1 -> C -> independent post page shows STEP 2 -> independent
//      back_forward listing records and continues -> STEP 3 -> STEP 4 -> TEST
//      COMPLETE, the progress line monotonic, evidence recorded;
//   4. missing/corrupt/incompatible state during an active run -> RUN STATE LOST
//      (no Step 1, nothing created); a non-Back return or an off-flow page ->
//      UNEXPECTED NAVIGATION; Reset clears the probe key; START OVER starts anew.
// Usage: node verify_ib12_e2r2.cjs
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
const KEY = 'ib12-e2r2-run-state';

// ---- 1. static ----
const built = B.buildE2R2();
const PKG = fs.readFileSync(B.E2R2.out, 'utf8');
check('E2R2 package matches a fresh build', PKG === built.text);
const execBody = PKG.slice(PKG.indexOf(WRAP_OPEN) + WRAP_OPEN.length, PKG.indexOf(WRAP_CLOSE));
const workTree = fs.readFileSync(path.join(REPO, 'Booru_Enhancer.user.js'), 'utf8').replace(/\r\n/g, '\n');
check('executed body = production 466a480 byte for byte (blob 3be0e1f, body 9fa6ab28…36b3) = the working tree',
  execBody === split(git('show', `${B.COMMIT}:Booru_Enhancer.user.js`)).body && sha(execBody) === B.EXPECTED_BODY_SHA256 && split(workTree).body === execBody);
check('E2 and E2R packages unchanged (historical 3e703639…372d, 0a458aa1…b8fe)', sha(fs.readFileSync(B.OUT)) === '3e7036399b7ba25a75647ec4e45a25a19b14f2cc95691fd2c10d819106ec372d'
  && sha(fs.readFileSync(B.E2R.out)) === '0a458aa17f382f78da4ef230e47bd547a25e2e4e0f21a505f793b1bc62aeb8fe');
check('scope: @match rule34.xxx only; distinct name/namespace', split(PKG).meta.split('\n').filter((l) => /^\/\/ @match\s/.test(l)).join() === '// @match        *://rule34.xxx/*' && /IB12 E2R2 Rule34/.test(split(PKG).meta) && /ib12-e2r2-rule34/.test(split(PKG).meta));
const post = built.postamble;
const e2post = fs.readFileSync(path.join(__dirname, 'ib12e2_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
const e2rpost = fs.readFileSync(path.join(__dirname, 'ib12e2r_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
const fnText = (src, name) => { const m = new RegExp(`\\n  (async )?function ${name}\\(`).exec(src); if (!m) return null; const i = m.index + 1; return src.slice(i, src.indexOf('\n  }\n', i)); };
const MEASURE = ['cards', 'vis', 'snapshot', 'recordBatch', 'navFacts', 'leave', 'armFresh', 'pageCheck', 'sourceIdentity', 'runtime', 'guard', 'finish'];
const differing = MEASURE.filter((n) => !fnText(post, n) || fnText(post, n) !== fnText(e2post, n));
const block = (src, from, to) => src.slice(src.indexOf(from), src.indexOf(to));
check('evidence unchanged: every E2 measurement function and the request wrappers byte-identical to E2', differing.length === 0 && block(post, '  // ---- request observation', '  function recordBatch') === block(e2post, '  // ---- request observation', '  function recordBatch'), differing.join());
const forbidden = /pushState|replaceState|history\.(back|go|forward)|scrollTo|scrollBy|scrollIntoView|location\.(href|assign|replace)\s*=(?!=)|location\.assign|location\.replace\(|\.focus\(|fetch\(|XMLHttpRequest|GM_xmlhttpRequest|localStorage|document\.cookie|preventDefault|stopPropagation|BE\.settings/;
const gmCalls = post.match(/GM_(getValue|setValue|deleteValue)\(([^,)]*)/g) || [];
check('recorder: no history write, scroll, focus, network, settings, cookie/localStorage or event-cancelling call; GM store used only under the one probe key; sessionStorage only for the loss marker',
  !forbidden.test(post) && gmCalls.length >= 3 && gmCalls.every((c) => /\(KEY$/.test(c)) && (post.match(/sessionStorage\.\w+\((\w+)/g) || []).every((c) => /\(ACTIVE$/.test(c)), (post.match(forbidden) || [''])[0] + JSON.stringify(gmCalls));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
check('results path tests/results/ib12-e2-rule34.json is git-ignored', ign('tests/results/ib12-e2-rule34.json'));

// ---- independent documents ----
const BASE = 'https://rule34.xxx/index.php';
const CANON = `${BASE}?page=post&s=list`;
const URLP = (pid) => `${CANON}${pid ? `&pid=${pid}` : ''}`;
const ID = (pid, k) => String(70001 + pid + k);
const PER = 42; const COLS = 6; const ROW = 250; const VH = 800;
const cardHtml = (id) => `<span class="thumb" data-id="${id}"><a href="index.php?page=post&s=view&id=${id}"><img src="/t/${id}.jpg"></a></span>`;
const listHtml = (pid) => `<!doctype html><html><body><div class="image-list">${Array.from({ length: PER }, (_, k) => cardHtml(ID(pid, k))).join('')}</div><div id="paginator"><a alt="next" href="${URLP(pid + PER)}">&gt;</a></div></body></html>`;
const POST = '<!doctype html><html><body>post</body></html>';
const OPEN = [];
const gmStore = () => new Map(); // Tampermonkey per-script storage (persists across pages)

function doc(recorder, url, html, gm, { nav = 'navigate', reasons = [], preset = null } = {}) {
  for (const o of OPEN.splice(0)) { try { o.close(); } catch { /* noop */ } } // the previous document is gone
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; const d = w.document; let sy = 0; OPEN.push(w);
  if (preset) preset(w);
  Object.defineProperty(w, 'scrollY', { configurable: true, get: () => sy });
  Object.defineProperty(w, 'scrollX', { configurable: true, value: 0 });
  Object.defineProperty(w, 'innerHeight', { configurable: true, value: VH });
  Object.defineProperty(w, 'crypto', { configurable: true, value: webcrypto });
  w.TextEncoder = TextEncoder; w.GM_info = { scriptHandler: 'jsdom-smoke', version: '0' };
  if (gm) { w.GM_getValue = (k, def) => (gm.has(k) ? gm.get(k) : def); w.GM_setValue = (k, v) => gm.set(k, v); w.GM_deleteValue = (k) => gm.delete(k); }
  w.performance.getEntriesByType = (t) => (t === 'navigation' ? [{ type: nav, notRestoredReasons: { reasons: reasons.map((reason) => ({ reason })), children: [] } }] : []);
  const container = () => d.querySelector('.image-list');
  const thumbs = () => (container() ? [...container().querySelectorAll('span.thumb')] : []);
  w.Element.prototype.getBoundingClientRect = function rect() {
    const t = this.closest && this.closest('span.thumb'); const i = t ? thumbs().indexOf(t) : -1;
    if (i < 0) return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
    const top = Math.floor(i / COLS) * ROW + 5 - sy; return { top, left: (i % COLS) * 160, bottom: top + ROW - 10, right: (i % COLS) * 160 + 150, width: 150, height: ROW - 10 };
  };
  w.BE = { adapters: { active: { getGalleryContainer: () => container(), getThumbElements: (root) => [...root.querySelectorAll('span.thumb img')],
    getThumbWrapper: (img) => img.closest('span.thumb'), getThumbPostId: (img) => img.closest('span.thumb').getAttribute('data-id') } },
  net: { request: () => Promise.resolve({ status: 200 }), json: () => Promise.resolve({}) } };
  const appendPage = async (pid) => {
    await w.BE.net.request({ url: URLP(pid), operation: 'gallery-pagination' }, 3);
    const tmp = new JSDOM(listHtml(pid)).window.document;
    for (const t of tmp.querySelectorAll('span.thumb')) container().appendChild(d.importNode(t, true));
    await sleep(20);
  };
  const bodyText = '// fake production body\n';
  w.eval(`const IB07P_PRODUCTION_BODY = function () {\n${bodyText}};\n` + recorder.replace('__EXPECTED_BODY_SHA256__', sha(bodyText)));
  const panel = () => {
    const p = d.querySelector('#ib12e2-panel'); if (!p) return {};
    return { head: p.querySelector('[data-ib12e2-head]')?.textContent, progress: p.querySelector('[data-ib12e2-progress]')?.textContent, title: p.querySelector('[data-ib12e2-title]')?.textContent,
      lines: [...p.querySelectorAll('[data-ib12e2-line]')].map((x) => x.textContent), actions: [...p.querySelectorAll('[data-ib12e2-action]')], reset: p.querySelector('[data-ib12e2-reset]') };
  };
  return { w, d, setScroll: (y) => { sy = y; }, appendPage, panel, pageshow: (persisted) => { const e = new w.Event('pageshow'); e.persisted = persisted; w.dispatchEvent(e); } };
}
const tick = () => sleep(600);
const click = (env, a) => a.dispatchEvent(new env.w.MouseEvent('click', { bubbles: true, cancelable: true }));
const only = (env, text) => { const p = env.panel(); return p.actions && p.actions.length === 1 && p.actions[0].textContent === text ? p.actions[0] : null; };
const stateOf = (gm) => (gm.has(KEY) ? JSON.parse(gm.get(KEY)) : null);
const ticks = (p) => (p.match(/✓/g) || []).length;

async function collectToC(env) {
  await env.appendPage(42); await env.appendPage(84);
  env.setScroll(Math.floor(84 / COLS) * ROW - 200); await tick();
}

async function main() {
  // ---- 2. reproduction of the real E2R defect ----
  {
    const recorder = e2rpost.replace(/__EXPECTED_BODY_SHA256__/, '__EXPECTED_BODY_SHA256__');
    const a = doc(recorder, CANON, listHtml(0), null); await tick(); await collectToC(a);
    const go = only(a, 'OPEN C POST IN SAME TAB'); const href = go && go.href; if (go) click(a, go);
    const p = doc(recorder, href || `${BASE}?page=post&s=view&id=1`, POST, null); await tick();
    check('reproduction: the E2R recorder in independent documents (fresh sessionStorage per page, as in Chrome) shows "IB12-E2 TEST — not started" on the post page - the real defect', !!go && p.panel().title === 'IB12-E2 TEST — not started', JSON.stringify(p.panel()));
  }

  // ---- 3. E2R2 full flow across independent documents ----
  const gm = gmStore(); const progress = [];
  const note = (env) => { const p = env.panel(); if (p.progress) progress.push(p.progress); return p; };
  let env = doc(post, CANON, listHtml(0), gm); await tick();
  const p0 = note(env);
  const start = only(env, 'START IB12-E2 TEST');
  check('no state: "IB12-E2 TEST — STEP 0 OF 4", exactly one action "START IB12-E2 TEST" to the canonical listing; nothing stored until it is clicked',
    p0.head === 'IB12-E2 TEST — STEP 0 OF 4' && !!start && start.href === CANON && !gm.has(KEY), JSON.stringify(p0));
  click(env, start);
  const afterStart = stateOf(gm);
  env = doc(post, CANON, listHtml(0), gm); await tick();
  const p1 = note(env);
  check('START creates the run explicitly (GM probe key, phase starting) and the independent canonical listing shows "STEP 1 OF 4 — LOAD TWO APPENDED PAGES", "Appended pages: 0 / 2", progress "Completed: Start ✓ | Normal Back ○ | Fresh Back ○ | Page Check ○"',
    afterStart && afterStart.phase === 'starting' && p1.head === 'IB12-E2 TEST — STEP 1 OF 4' && p1.title === 'STEP 1 OF 4 — LOAD TWO APPENDED PAGES' && p1.lines[0] === 'Appended pages: 0 / 2'
    && p1.progress === 'Completed: Start ✓ | Normal Back ○ | Fresh Back ○ | Page Check ○' && stateOf(gm).phase === 'collect', JSON.stringify({ afterStart, p1 }));
  await collectToC(env); const pc = note(env);
  const go1 = only(env, 'OPEN C POST IN SAME TAB'); const cHref = go1 && go1.href;
  check('STEP 1 ready: "Appended pages: 2 / 2" and exactly one "OPEN C POST IN SAME TAB"', !!go1 && pc.lines[0] === 'Appended pages: 2 / 2', JSON.stringify(pc));
  if (go1) click(env, go1);
  env = doc(post, cHref, POST, gm); await tick(); const p2 = note(env);
  check('the failure the E2R verifier missed: an independent post-page runtime recovers the run from the GM probe key and shows "STEP 2 OF 4 — NORMAL BACK TEST" / "Press Chrome Back once" (not "not started")',
    p2.head === 'IB12-E2 TEST — STEP 2 OF 4' && p2.title === 'STEP 2 OF 4 — NORMAL BACK TEST' && p2.lines[0] === 'Press Chrome Back once' && p2.actions.length === 0, JSON.stringify(p2));
  env = doc(post, CANON, listHtml(0), gm, { nav: 'back_forward' }); await sleep(50); env.pageshow(false); await sleep(200); const r1 = note(env);
  await sleep(1500); await tick(); const p3 = note(env);
  check('independent listing after Back: "BACK DETECTED — RECORDING" with no controls, then "NORMAL BACK RECORDED ✓" and one "OPEN C POST IN SAME TAB" (STEP 3 OF 4)',
    r1.title === 'BACK DETECTED — RECORDING' && r1.actions.length === 0 && !r1.reset && p3.title === 'STEP 3 OF 4 — FRESH-LOAD BACK TEST' && p3.lines[0] === 'NORMAL BACK RECORDED ✓' && p3.actions.length === 1, JSON.stringify({ r1, p3 }));
  const go2 = only(env, 'OPEN C POST IN SAME TAB'); if (go2) click(env, go2);
  env = doc(post, cHref, POST, gm); await tick(); const p3p = note(env);
  env = doc(post, CANON, listHtml(0), gm, { nav: 'back_forward', reasons: ['unload-listener'] }); await sleep(50); env.pageshow(false); await sleep(1700); await tick(); const p4 = note(env);
  check('STEP 3 post page then STEP 4: "STEP 3 OF 4 — FRESH-LOAD BACK TEST" / "Press Chrome Back once"; after recording "FRESH BACK CONFIRMED ✓" and one "OPEN OBSERVED PAGE"',
    p3p.title === 'STEP 3 OF 4 — FRESH-LOAD BACK TEST' && p3p.lines[0] === 'Press Chrome Back once' && p4.title === 'STEP 4 OF 4 — CHECK OBSERVED NATIVE PAGE' && p4.lines[0] === 'FRESH BACK CONFIRMED ✓' && p4.actions.length === 1, JSON.stringify({ p3p, p4 }));
  const go3 = only(env, 'OPEN OBSERVED PAGE'); const target = go3 && go3.href; if (go3) click(env, go3);
  env = doc(post, target, listHtml(84), gm); await tick(); const p5 = note(env);
  const raw = env.w.__IB12E2_RESULT__ || null; const res = raw ? JSON.parse(raw) : null; const ev = res ? evaluate(clone(res)) : null;
  check('TEST COMPLETE — 4 OF 4 ✓ with the result; the progress line only ever advanced (monotonic) and ends all ✓',
    p5.title === 'TEST COMPLETE — 4 OF 4 ✓' && !!env.d.getElementById('ib12e2-result') && progress.every((p, i) => i === 0 || ticks(p) >= ticks(progress[i - 1])) && ticks(progress[progress.length - 1]) === 4, JSON.stringify({ p5, progress }));
  check('evidence recorded across independent runtimes: two batches (pid 42, 84), C from the second, two back_forward returns (the second confirmed fresh), C found on its observed page; sanitized; evaluator not INVALID',
    res && res.version === '1.2.0-gm-state' && res.batches.map((b) => b.pid).join() === '42,84' && res.C.batchPid === 84 && res.back1.navigationType === 'back_forward' && res.back2.freshLoadConfirmed === true && res.pageCheck.cOnPage === true
    && !/https?:\/\//.test(raw) && ev && ev.verdict !== 'INVALID', JSON.stringify({ ev, res: res && { b: res.batches, pc: res.pageCheck } }).slice(0, 700));

  // ---- 4. loss, unexpected navigation, reset, start over ----
  const marked = (w) => w.sessionStorage.setItem('ib12-e2r2-active', '1');
  {
    const g = gmStore(); const e = doc(post, CANON, listHtml(0), g, { preset: marked }); await tick(); const p = e.panel();
    check('active run but the GM state is missing: "TEST ABORTED — RUN STATE LOST" / "This run cannot produce evidence. Press START OVER."; no Step 1; nothing created',
      p.title === 'TEST ABORTED — RUN STATE LOST' && p.lines[0] === 'This run cannot produce evidence. Press START OVER.' && !g.has(KEY) && p.actions.length === 1 && p.actions[0].textContent === 'START OVER', JSON.stringify(p));
  }
  for (const [label, val] of [['corrupt', '{bad json'], ['incompatible', JSON.stringify({ v: 'old', phase: 'collect', pub: {}, priv: {} })]]) {
    const g = gmStore(); g.set(KEY, val); const e = doc(post, CANON, listHtml(0), g); await tick(); const p = e.panel();
    check(`${label} GM state -> "TEST ABORTED — RUN STATE LOST", no Step 1, the stored value untouched`, p.title === 'TEST ABORTED — RUN STATE LOST' && g.get(KEY) === val, JSON.stringify(p));
  }
  {
    const g = gmStore(); let e = doc(post, CANON, listHtml(0), g); await tick(); click(e, only(e, 'START IB12-E2 TEST'));
    e = doc(post, CANON, listHtml(0), g); await tick(); await collectToC(e); const go = only(e, 'OPEN C POST IN SAME TAB'); click(e, go);
    e = doc(post, CANON, listHtml(0), g, { nav: 'navigate' }); await sleep(50); e.pageshow(false); await tick(); // typed URL instead of Back
    check('a return that is not a browser Back (navigation type navigate) -> "TEST ABORTED — UNEXPECTED NAVIGATION"', e.panel().title === 'TEST ABORTED — UNEXPECTED NAVIGATION' && stateOf(g).phase === 'aborted', JSON.stringify(e.panel()));
    const over = only(e, 'START OVER'); click(e, over);
    check('START OVER clears the aborted run and creates a new run explicitly (phase starting)', stateOf(g) && stateOf(g).phase === 'starting', JSON.stringify(stateOf(g)));
  }
  {
    const g = gmStore(); let e = doc(post, CANON, listHtml(0), g); await tick(); click(e, only(e, 'START IB12-E2 TEST'));
    e = doc(post, CANON, listHtml(0), g); await tick();
    e = doc(post, `${BASE}?page=post&s=view&id=1`, POST, g); await tick(); // a card opened natively during Step 1
    check('an off-flow page during the run (a post page in Step 1) -> "TEST ABORTED — UNEXPECTED NAVIGATION" (not a new run)', e.panel().title === 'TEST ABORTED — UNEXPECTED NAVIGATION', JSON.stringify(e.panel()));
    const g2 = gmStore(); let r = doc(post, CANON, listHtml(0), g2); await tick(); click(r, only(r, 'START IB12-E2 TEST'));
    r = doc(post, CANON, listHtml(0), g2); await tick(); const reset = r.panel().reset; if (reset) click(r, reset);
    check('Reset (emergency control) clears the GM probe key', !!reset && !g2.has(KEY));
  }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB12_E2R2_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib12-e2r2-verification', commit: B.COMMIT, blob: B.EXPECTED_PRODUCTION_BLOB, bodySha256: B.EXPECTED_BODY_SHA256, packageSha256: sha(PKG), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; }).finally(() => { for (const o of OPEN.splice(0)) { try { o.close(); } catch { /* noop */ } } });
