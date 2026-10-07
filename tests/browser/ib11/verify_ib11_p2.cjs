'use strict';
// Local qualification of the IB11-P2 (V-D1) browser qualification package (no
// real browser - the trusted-click run belongs to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P2 repair (bef4437); runner = V-VIEW runner + exactly the declared P2
//      patches; the evidence-pinned V-VIEW and P1 packages unchanged; scope;
//   2. server (--media): the P2 page, the native destination arrival, probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies (the
//      failure state and link survive the late same-post update; the link then
//      receives a click and reaches the native post);
//   4. faults: the same probe on the pre-P2 artifact (9aeab36) and on a mutant
//      restoring the unconditional clear are NOT QUALIFIED (VD1P2
//      DEFECT_CONFIRMED); evidence faults are rejected.
// Usage: node verify_ib11_p2.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p1 = require('./build_ib11_p1.cjs');
const p2 = require('./build_ib11_p2.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP2, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = 'a6d7bcc18b3fb9d2f4383eca2d00ecd13494155d9bb1c82a8e6b518ff4834839';

// ---- 1. static ----
const PKG = fs.readFileSync(p2.OUT, 'utf8');
check('P2 package matches a fresh build', PKG === p2.buildP2().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P2 package executes the committed repair body byte for byte (bef4437 / blob 56c495e, body a6d7bcc1…4839); the working tree is that blob', git('rev-parse', `${p2.P2_COMMIT}:Booru_Enhancer.user.js`).trim() === p2.P2_EXPECTED_BLOB && body(PKG) === split(git('show', `${p2.P2_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p2.P2_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p2.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P2 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
check('the evidence-pinned V-VIEW (598ba6c5…) and P1 (5842a1da…) packages are unchanged', sha(fs.readFileSync(b.OUT)) === '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a' && sha(fs.readFileSync(p1.OUT)) === '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718' && fs.readFileSync(p1.OUT, 'utf8') === p1.buildP1().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P2 Failure-State/.test(metaOf(PKG, 'name')) && /ib11-p2-vd1/.test(metaOf(PKG, 'namespace')));
const pp = srv.plan({ p2: true });
check('P2 plan: one page P2_VD1 with one failing image card', pp.length === 1 && pp[0].id === 'P2_VD1' && pp[0].cards.length === 1 && pp[0].cards[0].media === 'fail');

async function serverChecks(mediaDir) {
  const port = 18800; const out = path.join(require('os').tmpdir(), `ib11-p2-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p2: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  await (await fetch(`${base}/posts/${pg.cards[0].id}`)).text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p2: page served; /posts/<id> records a P2_VD1 arrival; results file probe ib11-p2-vd1', /"page":"P2_VD1"/.test(html) && s.arrivals.some((a) => a.page === 'P2_VD1' && a.card === 'NATIVE') && file && file.probe === 'ib11-p2-vd1', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p2: true });
  const r = evaluateP2(clone(doc));
  const v = r.cells.VD1P2; const n = r.cells.NATIVE; const raw = doc.pages[0].client.cells.VD1P2;
  check(`smoke (revision ${REVISION}): repaired production -> V-D1 REPAIR QUALIFIED`, r.verdict === 'V-D1 REPAIR QUALIFIED', JSON.stringify(r));
  check('smoke: real failure (error event, failure text, native link); after the late same-post update the failure text and link remain at 0 ms and 500 ms; same media element and same link node', v.evidence === 'PASS' && v.finding.code === 'BEHAVIOR_OK' && raw.failEvent && raw.sameMedia && raw.sameLinkNode && raw.after500.link === 'card-post', JSON.stringify({ v, raw: { a0: raw.after0.link, a5: raw.after500.link } }));
  check('smoke: the link remains usable after the update (revision-1.3 NATIVE BEHAVIOR_OK: hit test and click on the link, not prevented, destination reached)', n && n.evidence === 'PASS' && n.finding.code === 'BEHAVIOR_OK' && n.finding.detail.clickTargetIsLink && n.finding.detail.destinationArrived, JSON.stringify(n));

  // ---- faults: production ----
  { const pre = p2.buildP2({ commit: '9aeab36', expectedBlob: '039b99e81fe844d864cbcc047cdca1e5b16ee1e2' }).text; const { doc: d } = await smoke(pre, { p2: true }); const rr = evaluateP2(d);
    check('fault: the same probe on the pre-P2 artifact 9aeab36 -> NOT QUALIFIED (VD1P2 evidence PASS, DEFECT_CONFIRMED: failure text and link erased; no NATIVE click)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD1P2.evidence === 'PASS' && rr.cells.VD1P2.finding.code === 'DEFECT_CONFIRMED' && !rr.cells.NATIVE, JSON.stringify(rr.cells)); }
  { const mut = p2.buildP2({ bodyTransform: (x) => mustReplace(x, '\t\t\tupdateStatus(post);\n\n\t\t\tif (!mediaEl) {', '\t\t\tupdateStatus(post);\n\t\t\tclearMediaState();\n\n\t\t\tif (!mediaEl) {') }).text; const { doc: d } = await smoke(mut, { p2: true, forceIdentity: true }); const rr = evaluateP2(d);
    check('fault: mutant restoring the unconditional clearMediaState() -> NOT QUALIFIED (DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD1P2.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells.VD1P2)); }
  { const mut = p2.buildP2({ bodyTransform: (x) => mustReplace(x, "text-decoration:underline;pointer-events:auto;';", "text-decoration:underline;';") }).text; const { doc: d } = await smoke(mut, { p2: true, forceIdentity: true }); const rr = evaluateP2(d);
    check('fault: V-D8 regressed (link not pointer-interactive) -> NOT QUALIFIED (link survives but NATIVE DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD1P2.finding.code === 'BEHAVIOR_OK' && rr.cells.NATIVE.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const d = clone(doc); f(d, d.pages[0].client.cells); const rr = evaluateP2(d); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, v: rr.cells.VD1P2, n: rr.cells.NATIVE && rr.cells.NATIVE.reasons })); };
  ef('no real failure before the update (no error event)', (d, c) => { c.VD1P2.failEvent = false; });
  ef('failure state absent before the update', (d, c) => { c.VD1P2.before.link = ''; });
  ef('media element replaced (not a same-media update)', (d, c) => { c.VD1P2.sameMedia = false; });
  ef('link erased 500 ms after the update', (d, c) => { c.VD1P2.after500.link = ''; });
  ef('trusted input outside a prompt', (d, c) => { c.VD1P2.outsideTrusted = 1; });
  ef('untrusted (programmatic) link click', (d, c) => { c.NATIVE.click.trusted = false; });
  ef('no native destination arrival', (d) => { d.arrivals = []; });
  ef('wrong production artifact', (d) => { d.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (d) => { d.pages.push({ ...clone(d.pages[0]), attempt: 2 }); });
  { const rr = evaluateP2({ probe: 'ib11-p1-native' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P2_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p2-verification', p2Commit: p2.P2_COMMIT, p2Blob: p2.P2_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
