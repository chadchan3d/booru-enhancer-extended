'use strict';
// Local qualification of the IB11-P1 (V-D8) browser qualification package (no
// real browser - the trusted-click run belongs to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P1 repair (9aeab36); runner = V-VIEW runner + the declared P1 patches;
//      the evidence-pinned V-VIEW package unchanged; local-only scope;
//   2. server (--media): the P1 page, the native destination arrival, probe;
//   3. smoke (jsdom + vview_sim.cjs, pointer-events-aware hit testing):
//      repaired production qualifies (link hit and activated, native post
//      reached; empty-stage click still closes);
//   4. faults: the same package on the pre-repair artifact (4d793a2) and on a
//      mutant restoring pointer-events:none are NOT QUALIFIED (NATIVE
//      DEFECT_CONFIRMED); untrusted clicks, a stage click that does not close,
//      a stage click that misses the stage, wrong identity, missing arrival,
//      duplicate attempts are all rejected.
// Usage: node verify_ib11_p1.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p1 = require('./build_ib11_p1.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP1, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = '35474709e617b3adedbd273c929f683d9d140670748cba0de55ee8baff06c46b';
const VVIEW_EVIDENCE_PKG_SHA = '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a';

// ---- 1. static ----
const PKG = fs.readFileSync(p1.OUT, 'utf8');
check('P1 package matches a fresh build', PKG === p1.buildP1().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P1 package executes the committed repair body byte for byte (9aeab36 / blob 039b99e, body 35474709…c46b); production working tree is that blob', git('rev-parse', `${p1.P1_COMMIT}:Booru_Enhancer.user.js`).trim() === p1.P1_EXPECTED_BLOB && body(PKG) === split(git('show', `${p1.P1_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p1.P1_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p1.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P1 patches (STAGECLOSE + P1 page)', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
check('the evidence-pinned V-VIEW package is unchanged (598ba6c5…)', sha(fs.readFileSync(b.OUT)) === VVIEW_EVIDENCE_PKG_SHA && fs.readFileSync(b.OUT, 'utf8') === b.build().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P1 Native-Link/.test(metaOf(PKG, 'name')) && /ib11-p1-native/.test(metaOf(PKG, 'namespace')));
const pp = srv.plan({ p1: true });
check('P1 plan: one page P1_NATIVE with one failing image card', pp.length === 1 && pp[0].id === 'P1_NATIVE' && pp[0].cards.length === 1 && pp[0].cards[0].media === 'fail');

async function serverChecks(mediaDir) {
  const port = 18799; const out = path.join(require('os').tmpdir(), `ib11-p1-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p1: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  const nat = await fetch(`${base}/posts/${pg.cards[0].id}`); await nat.text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p1: page served; /posts/<id> records a P1_NATIVE arrival; results file probe ib11-p1-native', /"page":"P1_NATIVE"/.test(html) && s.arrivals.some((a) => a.page === 'P1_NATIVE' && a.card === 'NATIVE') && file && file.probe === 'ib11-p1-native', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p1: true });
  const r = evaluateP1(clone(doc));
  const n = r.cells.NATIVE; const sc = r.cells.STAGECLOSE;
  check(`smoke (revision ${REVISION}): repaired production -> V-D8 REPAIR QUALIFIED`, r.verdict === 'V-D8 REPAIR QUALIFIED', JSON.stringify(r));
  check('smoke: nonzero link box; computed pointer-events auto on the link while .be-media-state stays none; hit test at the centre = the link; the trusted click targets the link, is not prevented, reaches the native post; not treated as a stage-close',
    n.evidence === 'PASS' && n.finding.code === 'BEHAVIOR_OK' && n.finding.detail.linkPointerEvents === 'auto' && n.finding.detail.chain[1].cls === 'be-media-state' && n.finding.detail.chain[1].pointerEvents === 'none' && n.finding.detail.hit.isLink && n.finding.detail.clickTargetIsLink && n.finding.detail.clickDefaultPrevented === false && n.finding.detail.destinationArrived, JSON.stringify(n));
  check('smoke: a trusted click on the empty stage still closes the viewer (STAGECLOSE BEHAVIOR_OK)', sc.evidence === 'PASS' && sc.finding.code === 'BEHAVIOR_OK', JSON.stringify(sc));

  // ---- faults: production ----
  { const pre = p1.buildP1({ commit: '4d793a2', expectedBlob: '002bdfd1a88adf8ed851df7ed768e6189e2bc958' }).text; const { doc: d } = await smoke(pre, { p1: true }); const rr = evaluateP1(d);
    check('fault: the same probe on the pre-repair artifact 4d793a2 -> NOT QUALIFIED (NATIVE DEFECT_CONFIRMED, pointer-events none, click lands on the stage)', rr.verdict === 'NOT QUALIFIED' && rr.cells.NATIVE.evidence === 'PASS' && rr.cells.NATIVE.finding.code === 'DEFECT_CONFIRMED' && rr.cells.NATIVE.finding.detail.linkPointerEvents === 'none', JSON.stringify(rr.cells.NATIVE)); }
  { const mut = p1.buildP1({ bodyTransform: (x) => mustReplace(x, "text-decoration:underline;pointer-events:auto;';", "text-decoration:underline;';") }).text; const { doc: d } = await smoke(mut, { p1: true, forceIdentity: true }); const rr = evaluateP1(d);
    check('fault: mutant restoring the broken pointer behavior -> NOT QUALIFIED (NATIVE DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.NATIVE.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells.NATIVE)); }
  { const mut = p1.buildP1({ bodyTransform: (x) => mustReplace(x, "\t\t\tviewerOwner.on(overlay, 'click', (e) => { if (e.target === overlay || e.target === stage) close(); });", "\t\t\tviewerOwner.on(overlay, 'click', (e) => { if (e.target === overlay) close(); });") }).text; const { doc: d } = await smoke(mut, { p1: true, forceIdentity: true }); const rr = evaluateP1(d);
    check('fault: stage click-to-close broken -> NOT QUALIFIED (STAGECLOSE finding DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.STAGECLOSE.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells.STAGECLOSE)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const d = clone(doc); f(d, d.pages[0].client.cells); const rr = evaluateP1(d); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, sc: rr.cells.STAGECLOSE, n: rr.cells.NATIVE && rr.cells.NATIVE.reasons })); };
  ef('untrusted (programmatic) link click', (d, c) => { c.NATIVE.click.trusted = false; });
  ef('click outside the visible link box', (d, c) => { c.NATIVE.click.x = c.NATIVE.link.box.x - 50; });
  ef('zero-size link', (d, c) => { c.NATIVE.link.box.h = 0; });
  ef('no native destination arrival', (d) => { d.arrivals = []; });
  ef('click hit the link but the page never left', (d, c) => { c.NATIVE.navigated = false; d.arrivals = []; });
  ef('untrusted stage click', (d, c) => { c.STAGECLOSE.click.trusted = false; });
  ef('stage click that did not land on the empty stage', (d, c) => { c.STAGECLOSE.click.targetIsStage = false; });
  ef('wrong production artifact', (d) => { d.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (d) => { d.pages.push({ ...clone(d.pages[0]), attempt: 2 }); });
  { const rr = evaluateP1({ probe: 'ib11-vview' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P1_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p1-verification', p1Commit: p1.P1_COMMIT, p1Blob: p1.P1_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
