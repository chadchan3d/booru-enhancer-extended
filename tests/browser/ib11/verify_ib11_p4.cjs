'use strict';
// Local qualification of the IB11-P4 (V-D6a) browser qualification package (no
// real browser - the trusted-click run belongs to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P4 repair (fe1e06b); runner = the V-VIEW runner, unpatched; the
//      evidence-pinned V-VIEW, P1, P2 and P3 packages unchanged; scope;
//   2. server (--media): the TAKEOVER page, the native destination arrival,
//      probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies (the
//      volume seam throws from buildMedia, navigation is not cancelled, no
//      viewer shell or partial state remains, the native post is reached);
//   4. faults: the same probe on the pre-P4 artifact (48e44d9) and on a mutant
//      without the cleanup are NOT QUALIFIED (overlay left shown); evidence
//      faults are rejected.
// Usage: node verify_ib11_p4.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p1 = require('./build_ib11_p1.cjs');
const p2 = require('./build_ib11_p2.cjs');
const p3 = require('./build_ib11_p3.cjs');
const p4 = require('./build_ib11_p4.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP4, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = '4fd694e7cb24509953559249c65e3b95e695793e1b250730a108d9bf216d282b';
const CLEANUP = '\t\t\t\tif (!wasOpen) BE.modules.viewer.close();\n';

// ---- 1. static ----
const PKG = fs.readFileSync(p4.OUT, 'utf8');
check('P4 package matches a fresh build', PKG === p4.buildP4().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P4 package executes the committed repair body byte for byte (fe1e06b / blob f232863, body 4fd694e7…282b); the working tree is that blob', git('rev-parse', `${p4.P4_COMMIT}:Booru_Enhancer.user.js`).trim() === p4.P4_EXPECTED_BLOB && body(PKG) === split(git('show', `${p4.P4_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p4.P4_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
check('runner = the V-VIEW runner, unpatched (the TAKEOVER / VD6A cell as used for the E-stage evidence)', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === post.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
check('the evidence-pinned V-VIEW (598ba6c5…), P1 (5842a1da…), P2 (d38963eb…) and P3 (d29d590b…) packages are unchanged', sha(fs.readFileSync(b.OUT)) === '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a' && sha(fs.readFileSync(p1.OUT)) === '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718' && sha(fs.readFileSync(p2.OUT)) === 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a' && sha(fs.readFileSync(p3.OUT)) === 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6' && fs.readFileSync(p3.OUT, 'utf8') === p3.buildP3().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P4 Failed-Takeover/.test(metaOf(PKG, 'name')) && /ib11-p4-vd6a/.test(metaOf(PKG, 'namespace')));
check('the failure seam is the package recorder (media volume setter), not a production change; the VD6A cell arms stored volume 1.5', PKG.includes("fromBuildMedia: String((e && e.stack) || new Error().stack).includes('buildMedia')") && post.includes("await BE.store.set('viewer:volume', 1.5);\n    const rec = { card: 'VD6A'") && !body(PKG).includes('IB11V'));
const pp = srv.plan({ p4: true });
check('P4 plan: one page TAKEOVER with the one video card VD6A', pp.length === 1 && pp[0].id === 'TAKEOVER' && pp[0].cards.length === 1 && pp[0].cards[0].role === 'VD6A' && pp[0].cards[0].kind === 'video', JSON.stringify(pp));

async function serverChecks(mediaDir) {
  const port = 18802; const out = path.join(require('os').tmpdir(), `ib11-p4-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p4: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  await (await fetch(`${base}/posts/${pg.cards[0].id}`)).text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p4: page served; /posts/<id> records a TAKEOVER arrival; results file probe ib11-p4-vd6a', /"page":"TAKEOVER"/.test(html) && s.arrivals.some((a) => a.page === 'TAKEOVER' && a.card === 'VD6A') && file && file.probe === 'ib11-p4-vd6a', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p4: true });
  const r = evaluateP4(clone(doc));
  const d = r.cells.VD6A && r.cells.VD6A.finding.detail;
  check(`smoke (revision ${REVISION}): repaired production -> V-D6a REPAIR QUALIFIED`, r.verdict === 'V-D6a REPAIR QUALIFIED', JSON.stringify(r));
  check('smoke: the volume seam threw IndexSizeError from buildMedia; native navigation not cancelled; the native post reached', d && d.seamThrew && d.seamError === 'IndexSizeError' && d.nativeNavigationCancelled === false && d.nativeNavigationOccurred && d.destinationArrived, JSON.stringify(d));
  check('smoke: right after the failure no viewer shell or partial state remains (overlay not displayed, not open, no current post, empty stage); not displayed at page exit', d && d.shellAfterFailure.display !== 'flex' && d.shellAfterFailure.open === false && d.shellAfterFailure.currentId == null && d.shellAfterFailure.children === 0 && d.shellAfterFailure.overlayAtLeave !== 'flex', JSON.stringify(d));

  // ---- faults: production ----
  { const pre = p4.buildP4({ commit: '48e44d9', expectedBlob: 'f2b46eb443e153e03123742fb5d4baa4be761dd6' }).text; const { doc: dd } = await smoke(pre, { p4: true }); const rr = evaluateP4(dd);
    check('fault: the same probe on the pre-P4 artifact 48e44d9 -> NOT QUALIFIED (VD6A evidence PASS, DEFECT_CONFIRMED: seam threw, navigation proceeded, overlay left shown with the failed post current)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD6A.evidence === 'PASS' && rr.cells.VD6A.finding.code === 'DEFECT_CONFIRMED' && rr.cells.VD6A.finding.detail.seamThrew && rr.cells.VD6A.finding.detail.shellAfterFailure.display === 'flex', JSON.stringify(rr.cells)); }
  { const mut = p4.buildP4({ bodyTransform: (x) => mustReplace(x, CLEANUP, '') }).text; const { doc: dd } = await smoke(mut, { p4: true, forceIdentity: true }); const rr = evaluateP4(dd);
    check('fault: mutant without the failed-takeover cleanup -> NOT QUALIFIED (DEFECT_CONFIRMED, overlay left shown)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD6A.finding.code === 'DEFECT_CONFIRMED' && rr.cells.VD6A.finding.detail.shellAfterFailure.display === 'flex', JSON.stringify(rr.cells.VD6A)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells.VD6A); const rr = evaluateP4(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, v: rr.cells.VD6A })); };
  ef('untrusted (programmatic) card click', (dd, c) => { c.click.trusted = false; });
  ef('the seam did not throw', (dd, c) => { c.seam = []; });
  ef('native navigation cancelled', (dd, c) => { c.defaultPrevented = true; });
  ef('overlay state at the failure not recorded', (dd, c) => { c.overlayAtClick = null; });
  ef('overlay displayed at the failure', (dd, c) => { c.overlayAtClick.display = 'flex'; c.overlayAtClick.open = true; });
  ef('failed post still current', (dd, c) => { c.overlayAtClick.currentId = '8001'; });
  ef('stage not empty', (dd, c) => { c.overlayAtClick.children = 1; });
  ef('overlay displayed at page exit', (dd, c) => { c.overlayAtLeave = 'flex'; });
  ef('page did not leave', (dd, c) => { c.navigated = false; });
  ef('no native destination arrival', (dd) => { dd.arrivals = []; });
  ef('trusted input outside a prompt', (dd, c) => { c.outsideTrusted = 1; });
  ef('wrong production artifact', (dd) => { dd.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (dd) => { dd.pages.push({ ...clone(dd.pages[0]), attempt: 2 }); });
  { const rr = evaluateP4({ probe: 'ib11-vview-recovery' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P4_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p4-verification', p4Commit: p4.P4_COMMIT, p4Blob: p4.P4_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
