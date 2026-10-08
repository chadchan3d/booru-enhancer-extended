'use strict';
// Local qualification of the IB11-P8 (focus ownership/return) browser package
// (no real browser - the trusted keyboard and mouse input belong to the
// operator):
//   1. static: package current; executed body byte-identical to the committed
//      P8 repair (9d86484); runner = V-VIEW runner + exactly the declared P8
//      patches; the evidence-pinned V-VIEW and P1-P7 packages unchanged; scope;
//      results path; the simulator's Tab honours preventDefault;
//   2. server (--media): the P8 page and probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies;
//   4. faults: the pre-P8 artifact (7e4c643) and the no-acquire, no-trap and
//      no-restore mutants are NOT QUALIFIED; evidence faults are rejected.
// Usage: node verify_ib11_p8.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p7 = require('./build_ib11_p7.cjs');
const p8 = require('./build_ib11_p8.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP8, REVISION } = require('./vview_evaluate.cjs');
const { smoke } = require('./vview_sim.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 900) });
const REPO = path.resolve(__dirname, '../../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const REPAIR_BODY_SHA = '7745efafde2013fa98329c0ff6c9dd9d94995098129b763b05b7abdccd8cf205';
const NO_ACQUIRE = (x) => mustReplace(x, '\t\t\tif (closeBtn && (!wasOpen || !overlay.contains(document.activeElement))) closeBtn.focus({ preventScroll: true });\n', '');
const NO_TRAP = (x) => mustReplace(x, "\t\t\tif (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) { trapTab(e); return; }\n", '');
const NO_RESTORE = (x) => mustReplace(x, '\t\t\tif (shouldReturnFocus) {\n\t\t\t\tif (usableReturnTarget(returnFocusOrigin))', '\t\t\tif (false) {\n\t\t\t\tif (usableReturnTarget(returnFocusOrigin))');

// ---- 1. static ----
const PKG = fs.readFileSync(p8.OUT, 'utf8');
check('P8 package matches a fresh build', PKG === p8.buildP8().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P8 package executes the committed repair body byte for byte (9d86484 / blob 8453be9, body 7745efaf…f205); the working tree is that blob', git('rev-parse', `${p8.P8_COMMIT}:Booru_Enhancer.user.js`).trim() === p8.P8_EXPECTED_BLOB && body(PKG) === split(git('show', `${p8.P8_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p8.P8_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p8.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P8 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
const pinned = { 'IB11_VVIEW_Controlled.user.js': '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a', 'IB11_P1_Native.user.js': '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718', 'IB11_P2_VD1.user.js': 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a', 'IB11_P3_VD5.user.js': 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6', 'IB11_P4_VD6A.user.js': '8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2', 'IB11_P5_VD6B.user.js': '2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b', 'IB11_P6_VD4.user.js': '77f233fe68de1a88b6807a7ddbb0fe646ff5ad07a40fc53189b0bf0aea381055', 'IB11_P7_VD7.user.js': '2fee6862a9f6c540cf8dcdfd8be5ecc19cfec5b0892bf8e10a38f31f7f6251ab' };
check('the evidence-pinned V-VIEW and P1-P7 packages are unchanged', Object.entries(pinned).every(([f, s]) => sha(fs.readFileSync(path.join(__dirname, f))) === s) && fs.readFileSync(p7.OUT, 'utf8') === p7.buildP7().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P8 Focus Ownership/.test(metaOf(PKG, 'name')) && /ib11-p8-focus/.test(metaOf(PKG, 'namespace')));
const probe = fs.readFileSync(path.join(__dirname, 'p8_focus.js'), 'utf8');
check('probe: every focus step is a prompted operator input; the invoking element is captured at the opening input itself; identity flags (Close, first viewer control, invoker, body) are recorded per step', /prompt\('Click the PINK-outlined card once\.'\)/.test(probe) && /invEl = \(ck\.e\.target\.closest/.test(probe) && /if \(e\.key === 'Enter' && inK\(\)\) \{ invEl = document\.activeElement; return true; \}/.test(probe) && /isClose: a === closeBtn\(\), isFirst:/.test(probe) && /isInvoker: !!invEl && a === invEl, isBody:/.test(probe));
const pp = srv.plan({ p8: true });
check('P8 plan: one page P8_FOCUS: FOCUS_K (first), FOCUS_M, VD5', pp.length === 1 && pp[0].id === 'P8_FOCUS' && pp[0].cards.map((c) => c.role).join() === 'FOCUS_K,FOCUS_M,VD5', JSON.stringify(pp));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
const srvSrc = fs.readFileSync(path.join(__dirname, 'vview_server.cjs'), 'utf8');
check('results path: --p8 defaults to tests/results/ib11-p8-focus.json, which is git-ignored', srvSrc.includes("p8 ? path.resolve(__dirname, '../../results/ib11-p8-focus.json')") && ign('tests/results/ib11-p8-focus.json'));
const simSrc = fs.readFileSync(path.join(__dirname, 'vview_sim.cjs'), 'utf8');
check('the simulator\'s Tab is a browser Tab: dispatched to the focused element, native move only when not prevented, over rendered controls', simSrc.includes("const e = K(a, 'Tab', shift ? { shiftKey: true } : {}); if (e.defaultPrevented) return;") && simSrc.includes("(x) => x.isConnected && shown(x)"));

async function serverChecks(mediaDir) {
  const port = 18806; const out = path.join(require('os').tmpdir(), `ib11-p8-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p8: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p8: page served with the blue (FOCUS_K) and pink (FOCUS_M) cards; results file probe ib11-p8-focus', /"page":"P8_FOCUS"/.test(html) && /data-vview-role="FOCUS_K"/.test(html) && /data-vview-role="FOCUS_M"/.test(html) && file && file.probe === 'ib11-p8-focus', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p8: true });
  const r = evaluateP8(clone(doc));
  check(`smoke (revision ${REVISION}): repaired production -> P8 FOCUS QUALIFIED`, r.verdict === 'P8 FOCUS QUALIFIED', JSON.stringify(r).slice(0, 900));
  const m = r.cells.P8M.finding.detail; const k = r.cells.P8K.finding.detail;
  check('smoke P8M: focus acquired on Close; Tab wraps to the first viewer control; Shift+Tab wraps to Close; Escape returns to the pink card link', m && m.acquired && m.tabWrap && m.shiftWrap && m.returned, JSON.stringify(m));
  check('smoke P8K: Enter opens with focus on Close; Shift+Tab moves natively inside; Tab back to Close; Tab wraps to the first; Close returns to the blue card link', k && k.viaEnter && k.acquired && k.nativeInside && k.backToClose && k.wrap && k.returned, JSON.stringify(k));

  // ---- faults: production ----
  const prod = async (name, text, pred, force = true) => { const { doc: dd } = await smoke(text, { p8: true, forceIdentity: force }); const rr = evaluateP8(dd); check(name, rr.verdict === 'NOT QUALIFIED' && pred(rr), JSON.stringify(rr.cells).slice(0, 700)); };
  await prod('fault: the pre-P8 artifact 7e4c643 -> NOT QUALIFIED (focus never enters the viewer; Tab reaches the cards behind it; its apparent return is not accepted)', p8.buildP8({ commit: '7e4c643', expectedBlob: '5da8fd9d69a65af6009fed66a0874bb8b96ce64b' }).text, (rr) => !rr.cells.P8M.finding.detail.acquired && !rr.cells.P8K.finding.detail.acquired && rr.cells.P8K.finding.detail.returned === true, false);
  await prod('fault: no-acquire mutant -> NOT QUALIFIED (initial focus stays outside the viewer)', p8.buildP8({ bodyTransform: NO_ACQUIRE }).text, (rr) => !rr.cells.P8M.finding.detail.acquired);
  await prod('fault: no-trap mutant -> NOT QUALIFIED (Tab from Close escapes behind the overlay)', p8.buildP8({ bodyTransform: NO_TRAP }).text, (rr) => !rr.cells.P8M.finding.detail.tabWrap);
  await prod('fault: no-restore mutant -> NOT QUALIFIED (focus not returned to the invoker on close)', p8.buildP8({ bodyTransform: NO_RESTORE }).text, (rr) => !rr.cells.P8M.finding.detail.returned && !rr.cells.P8K.finding.detail.returned);
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells); const rr = evaluateP8(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, m: rr.cells.P8M && rr.cells.P8M.reasons, k: rr.cells.P8K && rr.cells.P8K.reasons })); };
  const onCard = (x, card) => { x.inOverlay = false; x.isClose = false; x.isFirst = false; x.active = { tag: 'A', cls: 'thm-link', title: '', card, inOverlay: false, panel: false }; };
  ef('initial focus stayed on the card (mouse origin)', (dd, c) => { onCard(c.P8M.afterOpen300, 'FOCUS_M'); c.P8M.afterOpen300.isInvoker = true; });
  ef('focus never entered the viewer yet "returned" (keyboard origin)', (dd, c) => { onCard(c.P8K.afterOpen300, 'FOCUS_K'); c.P8K.afterOpen300.isInvoker = true; });
  ef('Tab escaped behind the overlay', (dd, c) => { onCard(c.P8M.steps.find((x) => x.label === 'tab').after, 'FOCUS_K'); });
  ef('Shift+Tab escaped behind the overlay', (dd, c) => { onCard(c.P8M.steps.find((x) => x.label === 'shiftTab').after, 'VD5'); });
  ef('the keyboard wrap escaped', (dd, c) => { onCard(c.P8K.steps.find((x) => x.label === 'tab2').after, 'FOCUS_K'); });
  ef('close result is body', (dd, c) => { const a = c.P8M.afterClose300; a.isBody = true; a.isInvoker = false; a.active = { tag: 'BODY' }; });
  ef('the claimed invoker does not match the actual opening origin', (dd, c) => { c.P8K.invoker = { ...c.P8K.invoker, card: 'VD5' }; });
  ef('focus after close is a card link but not the invoking element', (dd, c) => { c.P8M.afterClose300.isInvoker = false; });
  ef('synthetic (untrusted) Tab', (dd, c) => { c.P8M.steps[0].trusted = false; });
  ef('synthetic (untrusted) Enter', (dd, c) => { c.P8K.enter.trusted = false; });
  ef('a Tab captured after the viewer had closed', (dd, c) => { c.P8K.steps[1].openAtCapture = false; });
  ef('Escape captured after the viewer had closed', (dd, c) => { c.P8M.escape.openAtCapture = false; });
  ef('a modified (Ctrl) Tab used as traversal evidence', (dd, c) => { c.P8M.steps[0].ctrlKey = true; });
  ef('trusted input outside a prompt', (dd, c) => { c.P8K.outsideTrusted = 1; });
  ef('wrong production artifact', (dd) => { dd.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (dd) => { dd.pages.push({ ...clone(dd.pages[0]), attempt: 2 }); });
  { const rr = evaluateP8({ probe: 'ib11-p7-vd7' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P8_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p8-verification', p8Commit: p8.P8_COMMIT, p8Blob: p8.P8_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
