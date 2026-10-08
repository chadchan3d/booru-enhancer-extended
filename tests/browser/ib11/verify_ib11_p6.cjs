'use strict';
// Local qualification of the IB11-P6 (V-D4) browser qualification package (no
// real browser - the trusted resizes and the screenshot belong to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P6 repair (39a5ae1); runner = V-VIEW runner + exactly the declared P6
//      patches; the evidence-pinned V-VIEW and P1-P5 packages unchanged; scope;
//      results path tests/results/ (git-ignored except its README);
//   2. server (--media): the P6 page and probe; the default output path;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies;
//   4. faults: the same probe on the pre-P6 artifact (24ee7c2) and on a
//      rotation-blind mutant are NOT QUALIFIED (rotated overflow); evidence
//      faults are rejected.
// Usage: node verify_ib11_p6.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p2 = require('./build_ib11_p2.cjs');
const p5 = require('./build_ib11_p5.cjs');
const p6 = require('./build_ib11_p6.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP6, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = 'd445d442a9e937186de4d99eea9a958252d9850dcba272a8b5448d364333b439';

// ---- 1. static ----
const PKG = fs.readFileSync(p6.OUT, 'utf8');
check('P6 package matches a fresh build', PKG === p6.buildP6().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P6 package executes the committed repair body byte for byte (39a5ae1 / blob 0a7f57f, body d445d442…b439); the working tree is that blob', git('rev-parse', `${p6.P6_COMMIT}:Booru_Enhancer.user.js`).trim() === p6.P6_EXPECTED_BLOB && body(PKG) === split(git('show', `${p6.P6_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p6.P6_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p6.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P6 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
const pinned = { 'IB11_VVIEW_Controlled.user.js': '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a', 'IB11_P1_Native.user.js': '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718', 'IB11_P2_VD1.user.js': 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a', 'IB11_P3_VD5.user.js': 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6', 'IB11_P4_VD6A.user.js': '8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2', 'IB11_P5_VD6B.user.js': '2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b' };
check('the evidence-pinned V-VIEW and P1-P5 packages are unchanged', Object.entries(pinned).every(([f, s]) => sha(fs.readFileSync(path.join(__dirname, f))) === s) && fs.readFileSync(p5.OUT, 'utf8') === p5.buildP5().text && fs.readFileSync(p2.OUT, 'utf8') === p2.buildP2().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P6 Rotated-Fit/.test(metaOf(PKG, 'name')) && /ib11-p6-vd4/.test(metaOf(PKG, 'namespace')));
check('the P6 cell: fit-both, the viewer\'s own Rotate right control, two prompted resizes, then the screenshot step (Windows+PrtScn, confirmed with Enter; no page click)', PKG.includes("BE.settings.set('viewer.fitMode', 'fit-both');\n    await openCard('VD4');") && PKG.includes("btn('Rotate right').click();") && PKG.includes("'F11 #1'") && PKG.includes("'F11 #2'") && PKG.includes("prompt('Press Windows+PrtScn once to save a screenshot of this screen, then press Enter.'"));
const pp = srv.plan({ p6: true });
check('P6 plan: one page P6_VD4 with the wide image card VD4', pp.length === 1 && pp[0].id === 'P6_VD4' && pp[0].cards.length === 1 && pp[0].cards[0].role === 'VD4' && pp[0].cards[0].media === 'wide', JSON.stringify(pp));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
check('results path: tests/results/ exists with a tracked README; ib11-p6-vd4.json and a screenshot there are git-ignored; the README is not', fs.existsSync(path.join(REPO, 'tests/results/README.md')) && ign('tests/results/ib11-p6-vd4.json') && ign('tests/results/ib11-p6-vd4.png') && !ign('tests/results/README.md'));
const srvSrc = fs.readFileSync(path.join(__dirname, 'vview_server.cjs'), 'utf8');
check('server --p6 default output is tests/results/ib11-p6-vd4.json (directory created if missing)', srvSrc.includes("p6 ? path.resolve(__dirname, '../../results/ib11-p6-vd4.json')") && srvSrc.includes('fs.mkdirSync(path.dirname(out), { recursive: true });') && path.resolve(__dirname, '../../results/ib11-p6-vd4.json') === path.join(REPO, 'tests', 'results', 'ib11-p6-vd4.json'));

async function serverChecks(mediaDir) {
  const port = 18804; const out = path.join(require('os').tmpdir(), `ib11-p6-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p6: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p6: page served; results file probe ib11-p6-vd4 with the wide fixture dimensions', /"page":"P6_VD4"/.test(html) && file && file.probe === 'ib11-p6-vd4' && file.fixtures && file.fixtures.wide && String(file.fixtures.wide.dims) === '2000,1000', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p6: true });
  const r = evaluateP6(clone(doc));
  const d = r.cells.VD4 && r.cells.VD4.finding.detail;
  check(`smoke (revision ${REVISION}): repaired production -> V-D4 REPAIR QUALIFIED`, r.verdict === 'V-D4 REPAIR QUALIFIED', JSON.stringify(r));
  check('smoke: after each resize the rotated media lies within the Fit area and the stage (no overflow), rotate(90deg) present; the screenshot step saw the rotated fit', d && d.fitArea.afterResize1.inside && d.fitArea.afterResize2.inside && /rotate\(90deg\)/.test(d.screenshotState.transform), JSON.stringify(d));

  // ---- faults: production ----
  { const pre = p6.buildP6({ commit: '24ee7c2', expectedBlob: '68e37d1c9071d2ae78ae44b31f0082cd51010992' }).text; const { doc: dd } = await smoke(pre, { p6: true }); const rr = evaluateP6(dd);
    check('fault: the same probe on the pre-P6 artifact 24ee7c2 -> NOT QUALIFIED (VD4 evidence PASS, DEFECT_CONFIRMED: rotated media exceeds the stage after both resizes)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD4.evidence === 'PASS' && rr.cells.VD4.finding.code === 'DEFECT_CONFIRMED' && !rr.cells.VD4.finding.detail.fitArea.afterResize1.inside && !rr.cells.VD4.finding.detail.fitArea.afterResize2.inside, JSON.stringify(rr.cells)); }
  { const mut = p6.buildP6({ bodyTransform: (x) => mustReplace(x, '\t\t\tconst width = quarterTurns ? intrinsic.height : intrinsic.width;\n\t\t\tconst height = quarterTurns ? intrinsic.width : intrinsic.height;\n', '\t\t\tconst width = intrinsic.width;\n\t\t\tconst height = intrinsic.height;\n') }).text; const { doc: dd } = await smoke(mut, { p6: true, forceIdentity: true }); const rr = evaluateP6(dd);
    check('fault: rotation-blind mutant -> NOT QUALIFIED (DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD4.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells.VD4)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells); const rr = evaluateP6(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, v: rr.cells.VD4 && rr.cells.VD4.reasons })); };
  ef('untrusted (synthetic) resize', (dd, c) => { c.VD4.resize1.trusted = false; });
  ef('fit mode not fit-both', (dd, c) => { c.VD4.fitMode = 'fit-width'; });
  ef('fixture not complete at 2000x1000', (dd, c) => { c.VD4.s0.media.nw = 1000; });
  ef('zero stage rectangle after resize 2', (dd, c) => { c.VD4.sB.stage.h = 0; });
  ef('rotation missing after resize 1', (dd, c) => { c.VD4.sA.media.transform = 'translate(0px, 0px) scale(0.5) rotate(0deg)'; });
  ef('rotation not applied by the control', (dd, c) => { c.VD4.sRot.media.transform = ''; });
  ef('rotated media overflows the stage after resize 2', (dd, c) => { c.VD4.sB.media.rect.h = c.VD4.sB.stage.h + 40; c.VD4.sB.media.rect.y = -20; });
  ef('rotated media exceeds the Fit area (inside the stage, beyond stage - 24)', (dd, c) => { c.VD4.sA.media.rect.h = c.VD4.sA.stage.h - 10; c.VD4.sA.media.rect.y = 5; });
  ef('the two resizes did not change the stage', (dd, c) => { c.VD4.sB.stage = { ...c.VD4.sA.stage }; });
  ef('trusted input outside a prompt', (dd, c) => { c.VD4.outsideTrusted = 1; });
  ef('screenshot step not completed', (dd, c) => { delete c.SHOT; });
  ef('screenshot step untrusted', (dd, c) => { c.SHOT.enter.trusted = false; });
  ef('rotated fit not on screen at the screenshot step', (dd, c) => { c.SHOT.sC.open = false; });
  ef('wrong production artifact', (dd) => { dd.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (dd) => { dd.pages.push({ ...clone(dd.pages[0]), attempt: 2 }); });
  { const rr = evaluateP6({ probe: 'ib11-p5-vd6b' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P6_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p6-verification', p6Commit: p6.P6_COMMIT, p6Blob: p6.P6_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
