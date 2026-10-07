'use strict';
// Local qualification of the IB11-P5 (V-D6b) browser qualification package (no
// real browser - the trusted key and click belong to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P5 repair (24ee7c2); runner = V-VIEW runner + exactly the declared P5
//      patches; the evidence-pinned V-VIEW and P1-P4 packages unchanged; scope;
//   2. server (--media): the P5 page (image card, then the failing video card),
//      the native destination arrival, probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies (the
//      in-viewer failure is shown with the target's native link, which is then
//      clicked and reaches the native post);
//   4. faults: the same probe on the pre-P5 artifact (fe1e06b) and on a mutant
//      that rethrows as before are NOT QUALIFIED (blank viewer); a mutant that
//      breaks the link's pointer usability (V-D8) is NOT QUALIFIED; evidence
//      faults are rejected.
// Usage: node verify_ib11_p5.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p1 = require('./build_ib11_p1.cjs');
const p2 = require('./build_ib11_p2.cjs');
const p3 = require('./build_ib11_p3.cjs');
const p4 = require('./build_ib11_p4.cjs');
const p5 = require('./build_ib11_p5.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP5, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = '062227fa23a6b637098cf553b29a543e03bf342240354a61d1f587bd414d9f26';

// ---- 1. static ----
const PKG = fs.readFileSync(p5.OUT, 'utf8');
check('P5 package matches a fresh build', PKG === p5.buildP5().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P5 package executes the committed repair body byte for byte (24ee7c2 / blob 68e37d1, body 062227fa…9f26); the working tree is that blob', git('rev-parse', `${p5.P5_COMMIT}:Booru_Enhancer.user.js`).trim() === p5.P5_EXPECTED_BLOB && body(PKG) === split(git('show', `${p5.P5_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p5.P5_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p5.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P5 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
const pinned = [[b.OUT, '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a'], [p1.OUT, '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718'], [p2.OUT, 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a'], [p3.OUT, 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6'], [p4.OUT, '8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2']];
check('the evidence-pinned V-VIEW, P1, P2, P3 (d29d590b…) and P4 (8c9fd499…) packages are unchanged', pinned.every(([f, s]) => sha(fs.readFileSync(f)) === s) && fs.readFileSync(p4.OUT, 'utf8') === p4.buildP4().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P5 In-Viewer Build-Failure/.test(metaOf(PKG, 'name')) && /ib11-p5-vd6b/.test(metaOf(PKG, 'namespace')));
check('the failure seam is the package recorder (media volume setter), not a production change; the cell arms stored volume 1.5 only after the image is open and asks for a trusted unmodified ArrowRight', PKG.includes("fromBuildMedia: String((e && e.stack) || new Error().stack).includes('buildMedia')") && !body(PKG).includes('IB11V') && PKG.includes("const prev = stageMedia(); const before = stageInfo(); const statusBefore = statusText();\n    await BE.store.set('viewer:volume', 1.5);") && PKG.includes("e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey"));
const pp = srv.plan({ p5: true });
check('P5 plan: one page P5_VD6B: image card VD6B_A, then the video card NATIVE (the in-viewer ArrowRight target)', pp.length === 1 && pp[0].id === 'P5_VD6B' && pp[0].cards.length === 2 && pp[0].cards[0].role === 'VD6B_A' && pp[0].cards[0].kind === 'img' && pp[0].cards[1].role === 'NATIVE' && pp[0].cards[1].kind === 'video', JSON.stringify(pp));

async function serverChecks(mediaDir) {
  const port = 18803; const out = path.join(require('os').tmpdir(), `ib11-p5-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p5: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  await (await fetch(`${base}/posts/${pg.cards[1].id}`)).text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p5: page served; /posts/<id> records a P5_VD6B arrival for the failing card; results file probe ib11-p5-vd6b', /"page":"P5_VD6B"/.test(html) && s.arrivals.some((a) => a.page === 'P5_VD6B' && a.card === 'NATIVE') && file && file.probe === 'ib11-p5-vd6b', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p5: true });
  const r = evaluateP5(clone(doc));
  const d = r.cells.VD6BP5 && r.cells.VD6BP5.finding.detail;
  check(`smoke (revision ${REVISION}): repaired production -> V-D6b REPAIR QUALIFIED`, r.verdict === 'V-D6b REPAIR QUALIFIED', JSON.stringify(r));
  check('smoke: valid open image; trusted ArrowRight; seam IndexSizeError (1.5) from buildMedia; at 50 ms and 1000 ms open on the target with failure text and the target\'s native link; no media; previous image detached; status names the target', d && !d.blank && d.after50.state && d.after1000.link === 'card-post' && d.linkPath === d.targetPost && d.overlayMedia === 0 && d.previousMediaConnected === false && d.seam.some((x) => x.name === 'IndexSizeError' && x.value === 1.5 && x.fromBuildMedia), JSON.stringify(d));
  check('smoke: the target\'s native link is usable in the same viewer (revision-1.3 NATIVE BEHAVIOR_OK: hit test and trusted click on the link, destination reached)', r.cells.NATIVE && r.cells.NATIVE.evidence === 'PASS' && r.cells.NATIVE.finding.code === 'BEHAVIOR_OK' && r.cells.NATIVE.finding.detail.destinationArrived, JSON.stringify(r.cells.NATIVE));

  // ---- faults: production ----
  { const pre = p5.buildP5({ commit: 'fe1e06b', expectedBlob: 'f2328634aac5d4c597361699f71155f0eb11ac17' }).text; const { doc: dd } = await smoke(pre, { p5: true }); const rr = evaluateP5(dd);
    check('fault: the same probe on the pre-P5 artifact fe1e06b -> NOT QUALIFIED (VD6BP5 evidence PASS, DEFECT_CONFIRMED: blank viewer on the target, stale status, no link to click)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD6BP5.evidence === 'PASS' && rr.cells.VD6BP5.finding.code === 'DEFECT_CONFIRMED' && rr.cells.VD6BP5.finding.detail.blank && !rr.cells.NATIVE, JSON.stringify(rr.cells)); }
  { const mut = p5.buildP5({ bodyTransform: (x) => mustReplace(x, '\t\t\t\tif (rethrowBuildError) throw err;\n', '\t\t\t\tthrow err;\n') }).text; const { doc: dd } = await smoke(mut, { p5: true, forceIdentity: true }); const rr = evaluateP5(dd);
    check('fault: mutant that rethrows the build error as before -> NOT QUALIFIED (DEFECT_CONFIRMED, blank)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD6BP5.finding.code === 'DEFECT_CONFIRMED' && rr.cells.VD6BP5.finding.detail.blank, JSON.stringify(rr.cells.VD6BP5)); }
  { const mut = p5.buildP5({ bodyTransform: (x) => mustReplace(x, "text-decoration:underline;pointer-events:auto;';", "text-decoration:underline;';") }).text; const { doc: dd } = await smoke(mut, { p5: true, forceIdentity: true }); const rr = evaluateP5(dd);
    check('fault: V-D8 regressed (link not pointer-interactive) -> NOT QUALIFIED (failure communicated but NATIVE DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD6BP5.finding.code === 'BEHAVIOR_OK' && rr.cells.NATIVE && rr.cells.NATIVE.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells); const rr = evaluateP5(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, v: rr.cells.VD6BP5 && rr.cells.VD6BP5.reasons, n: rr.cells.NATIVE && rr.cells.NATIVE.reasons })); };
  ef('untrusted (synthetic) ArrowRight', (dd, c) => { c.VD6BP5.key.trusted = false; });
  ef('modified ArrowRight (Shift held)', (dd, c) => { c.VD6BP5.key.shiftKey = true; });
  ef('the seam did not throw', (dd, c) => { c.VD6BP5.seam = []; });
  ef('did not start from a loaded image', (dd, c) => { c.VD6BP5.before.media.complete = false; });
  ef('selection did not reach the failing target', (dd, c) => { c.VD6BP5.after1000.currentId = String(c.VD6BP5.fromId); });
  ef('failure text missing at 50 ms', (dd, c) => { c.VD6BP5.after50.state = ''; });
  ef('native link missing at 1000 ms', (dd, c) => { c.VD6BP5.after1000.link = ''; });
  ef('native link points to another post', (dd, c) => { c.VD6BP5.linkPath = `/posts/${c.VD6BP5.fromId}`; });
  ef('a media element remains in the viewer', (dd, c) => { c.VD6BP5.overlayMedia = 1; });
  ef('the previous image is still attached', (dd, c) => { c.VD6BP5.prevConnected = true; });
  ef('status still names the previous post', (dd, c) => { c.VD6BP5.status = c.VD6BP5.statusBefore; });
  ef('trusted input outside a prompt', (dd, c) => { c.VD6BP5.outsideTrusted = 1; });
  ef('untrusted (programmatic) link click', (dd, c) => { c.NATIVE.click.trusted = false; });
  ef('no native destination arrival', (dd) => { dd.arrivals = []; });
  ef('NATIVE cell missing', (dd, c) => { delete c.NATIVE; });
  ef('wrong production artifact', (dd) => { dd.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (dd) => { dd.pages.push({ ...clone(dd.pages[0]), attempt: 2 }); });
  { const rr = evaluateP5({ probe: 'ib11-p4-vd6a' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P5_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p5-verification', p5Commit: p5.P5_COMMIT, p5Blob: p5.P5_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
