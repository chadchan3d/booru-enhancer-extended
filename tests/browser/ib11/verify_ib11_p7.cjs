'use strict';
// Local qualification of the IB11-P7 (V-D7) browser qualification package (no
// real browser - the real layout run belongs to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P7 repair (b856a62); runner = V-VIEW runner + exactly the declared P7
//      patches; the evidence-pinned V-VIEW and P1-P6 packages unchanged; scope;
//      results path; the simulator models the browser's pending-request rule;
//   2. server (--media): the P7 page (VD7P, VD7, VD7X) and probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies;
//   4. faults: the pre-P7 artifact (39a5ae1), the no-placeholder mutant and the
//      raw-zoom mutant are NOT QUALIFIED for the declared cells; evidence
//      faults are rejected.
// Usage: node verify_ib11_p7.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p6 = require('./build_ib11_p6.cjs');
const p7 = require('./build_ib11_p7.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP7, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = '8c964f02b72c133a40bc5d51df295eb91e6f0ee1f73c2dcf6ac2a09dcacc0ad5';
const NO_PLACEHOLDER = (x) => mustReplace(x, "\t\t\tif (!post?.originalUrl || fullUrl !== post.originalUrl) return '';\n", "\t\t\treturn '';\n");
const RAW_ZOOM = (x) => mustReplace(x, '\t\t\tif (pw > 0 && ph > 0 && fw > 0 && fh > 0) zoom *= Math.min(pw / fw, ph / fh);\n', '');

// ---- 1. static ----
const PKG = fs.readFileSync(p7.OUT, 'utf8');
check('P7 package matches a fresh build', PKG === p7.buildP7().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P7 package executes the committed repair body byte for byte (b856a62 / blob b88af38, body 8c964f02…0ad5); the working tree is that blob', git('rev-parse', `${p7.P7_COMMIT}:Booru_Enhancer.user.js`).trim() === p7.P7_EXPECTED_BLOB && body(PKG) === split(git('show', `${p7.P7_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p7.P7_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p7.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P7 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
const pinned = { 'IB11_VVIEW_Controlled.user.js': '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a', 'IB11_P1_Native.user.js': '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718', 'IB11_P2_VD1.user.js': 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a', 'IB11_P3_VD5.user.js': 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6', 'IB11_P4_VD6A.user.js': '8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2', 'IB11_P5_VD6B.user.js': '2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b', 'IB11_P6_VD4.user.js': '77f233fe68de1a88b6807a7ddbb0fe646ff5ad07a40fc53189b0bf0aea381055' };
check('the evidence-pinned V-VIEW and P1-P6 packages are unchanged', Object.entries(pinned).every(([f, s]) => sha(fs.readFileSync(path.join(__dirname, f))) === s) && fs.readFileSync(p6.OUT, 'utf8') === p6.buildP6().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P7 Staged-Placeholder/.test(metaOf(PKG, 'name')) && /ib11-p7-vd7/.test(metaOf(PKG, 'namespace')));
check('the P7 page is automatic (no prompt) and measures the upgrade inside the original\'s own load (complete) after production\'s handler', !/prompt\(/.test(fs.readFileSync(path.join(__dirname, 'p7_vd7.js'), 'utf8')) && PKG.includes("el.addEventListener('load', () => { if (el.complete && /-slow$/.test(V.labelOf(el.getAttribute('src')))) resolve(shot(el)); }); });"));
const pp = srv.plan({ p7: true });
check('P7 plan: one page P7_VD7: VD7P (wide), VD7 and VD7X (slow originals with thumb placeholders)', pp.length === 1 && pp[0].id === 'P7_VD7' && pp[0].cards.map((c) => `${c.role}:${c.media}`).join() === 'VD7P:wide,VD7:slow,VD7X:slow', JSON.stringify(pp));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
const srvSrc = fs.readFileSync(path.join(__dirname, 'vview_server.cjs'), 'utf8');
check('results path: --p7 defaults to tests/results/ib11-p7-vd7.json, which is git-ignored', srvSrc.includes("p7 ? path.resolve(__dirname, '../../results/ib11-p7-vd7.json')") && ign('tests/results/ib11-p7-vd7.json') && ign('tests/results/ib11-p7-vd7.png'));
check('the simulator models the browser pending-request rule (a displayed image stays current until the new source completes)', fs.readFileSync(path.join(__dirname, 'vview_sim.cjs'), 'utf8').includes('const pending = s.complete && s.nw > 0; s.complete = false; if (!pending) { s.nw = 0; s.nh = 0; }'));

async function serverChecks(mediaDir) {
  const port = 18805; const out = path.join(require('os').tmpdir(), `ib11-p7-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p7: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  const th = await fetch(`${base}/vview/img/${pg.token}/VD7-thumb.png`); const thumbOk = th.status === 200 && (await th.arrayBuffer()).byteLength > 0;
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p7: page served with distinct thumb sample/preview per card; VD7 thumb served; results file probe ib11-p7-vd7 with slow 1600x800 and thumb 160x80', /"page":"P7_VD7"/.test(html) && /data-sample-url="\/vview\/img\/[0-9a-f]+\/VD7-thumb\.png"/.test(html) && /data-file-url="[^"]*VD7-slow\.png"/.test(html) && thumbOk && file && file.probe === 'ib11-p7-vd7' && String(file.fixtures.slow.dims) === '1600,800' && String(file.fixtures.thumb.dims) === '160,80', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p7: true });
  const r = evaluateP7(clone(doc));
  check(`smoke (revision ${REVISION}): repaired production -> V-D7 REPAIR QUALIFIED`, r.verdict === 'V-D7 REPAIR QUALIFIED', JSON.stringify(r).slice(0, 900));
  const sd = r.cells.P7STAGE.finding.detail; const xd = r.cells.P7XFORM.finding.detail;
  check('smoke P7STAGE: VD7\'s own placeholder displayed at 300 and 1000 ms with the original pending; no blank frame; upgrade on the same element with the geometry kept', sd && sd.early.every((x) => x.placeholder && x.originalPending) && sd.frames.blank === 0 && sd.upgraded && sd.geometryAtUpgrade.ok && sd.geometryAfter500.ok, JSON.stringify(sd));
  check('smoke P7XFORM: rotation, both flips, pan and manual zoom kept; scale rescaled 160/1600; geometry kept', xd && xd.applied && xd.upgraded && xd.geometryAtUpgrade.ok && Math.abs(xd.scaleAtUpgrade - xd.scaleBefore / 10) < 1e-6, JSON.stringify(xd));

  // ---- faults: production ----
  { const pre = p7.buildP7({ commit: '39a5ae1', expectedBlob: '0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6' }).text; const { doc: dd } = await smoke(pre, { p7: true }); const rr = evaluateP7(dd);
    check('fault: the pre-P7 artifact 39a5ae1 -> NOT QUALIFIED (P7STAGE DEFECT_CONFIRMED: the slow original is the early media, no placeholder)', rr.verdict === 'NOT QUALIFIED' && rr.cells.P7STAGE.finding.code === 'DEFECT_CONFIRMED' && rr.cells.P7STAGE.finding.detail.early.every((x) => !x.placeholder), JSON.stringify(rr.cells.P7STAGE).slice(0, 600)); }
  { const { doc: dd } = await smoke(p7.buildP7({ bodyTransform: NO_PLACEHOLDER }).text, { p7: true, forceIdentity: true }); const rr = evaluateP7(dd);
    check('fault: no-placeholder mutant (direct original) -> NOT QUALIFIED (P7STAGE DEFECT_CONFIRMED, no placeholder)', rr.verdict === 'NOT QUALIFIED' && rr.cells.P7STAGE.finding.code === 'DEFECT_CONFIRMED' && rr.cells.P7STAGE.finding.detail.early.every((x) => !x.placeholder), JSON.stringify(rr.cells.P7STAGE).slice(0, 600)); }
  { const { doc: dd } = await smoke(p7.buildP7({ bodyTransform: RAW_ZOOM }).text, { p7: true, forceIdentity: true }); const rr = evaluateP7(dd);
    check('fault: raw-zoom mutant (scale kept at the upgrade) -> NOT QUALIFIED (staging intact; P7STAGE and P7XFORM geometry jump x10, DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.P7STAGE.finding.detail.early.every((x) => x.placeholder) && !rr.cells.P7STAGE.finding.detail.geometryAtUpgrade.ok && rr.cells.P7XFORM.finding.code === 'DEFECT_CONFIRMED' && !rr.cells.P7XFORM.finding.detail.geometryAtUpgrade.ok, JSON.stringify(rr.cells).slice(0, 900)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells); const rr = evaluateP7(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, s: rr.cells.P7STAGE && rr.cells.P7STAGE.reasons, x: rr.cells.P7XFORM && rr.cells.P7XFORM.reasons })); };
  ef('the previous target was not shown first', (dd, c) => { c.P7STAGE.prevOk = false; });
  ef('early media is another post\'s image', (dd, c) => { c.P7STAGE.samples[0].firstLabel = 'VD7P-thumb'; });
  ef('early media is the original (1600x800)', (dd, c) => { c.P7STAGE.samples[1].nw = 1600; c.P7STAGE.samples[1].nh = 800; });
  ef('original already complete at an early sample', (dd, c) => { c.P7STAGE.samples[0].complete = true; });
  ef('wrong target at an early sample', (dd, c) => { c.P7STAGE.samples[1].currentId = c.P7STAGE.prevId; });
  ef('two media elements at an early sample', (dd, c) => { c.P7STAGE.samples[0].inStage = 2; });
  ef('a blank frame after the placeholder was shown', (dd, c) => { c.P7STAGE.frames.blank = 1; });
  ef('no upgrade observed', (dd, c) => { c.P7STAGE.upgrade = null; });
  ef('upgrade on a different element', (dd, c) => { c.P7STAGE.sameElement = false; });
  ef('geometry jump at the upgrade (stage)', (dd, c) => { c.P7STAGE.upgrade.rect.w *= 10; });
  ef('state text left after the upgrade', (dd, c) => { c.P7STAGE.after.state = 'Loading media…'; });
  ef('rotation lost at the upgrade', (dd, c) => { c.P7XFORM.upgrade.transform = c.P7XFORM.upgrade.transform.replace('rotate(90deg)', 'rotate(0deg)'); });
  ef('flip lost at the upgrade', (dd, c) => { c.P7XFORM.upgrade.transform = c.P7XFORM.upgrade.transform.replace('scaleY(-1)', 'scaleY(1)'); });
  ef('pan lost at the upgrade', (dd, c) => { c.P7XFORM.upgrade.transform = c.P7XFORM.upgrade.transform.replace(/translate\([^)]*\)/, 'translate(0px, 0px)'); });
  ef('raw scale kept at the upgrade', (dd, c) => { c.P7XFORM.after.transform = c.P7XFORM.transformed.transform; });
  ef('geometry drift 500 ms after the upgrade (transform)', (dd, c) => { c.P7XFORM.after.rect.cx += 5; });
  ef('transforms not applied before the original completed', (dd, c) => { c.P7XFORM.earlyComplete = true; });
  ef('trusted input outside a prompt', (dd, c) => { c.P7STAGE.outsideTrusted = 1; });
  ef('wrong production artifact', (dd) => { dd.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (dd) => { dd.pages.push({ ...clone(dd.pages[0]), attempt: 2 }); });
  { const rr = evaluateP7({ probe: 'ib11-p6-vd4' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P7_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p7-verification', p7Commit: p7.P7_COMMIT, p7Blob: p7.P7_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
