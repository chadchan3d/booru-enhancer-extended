'use strict';
// Local qualification of the IB11-P9 (E0 D5) browser qualification package (no
// real browser - the real layout run belongs to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P9 repair (ac3c9e8); runner = V-VIEW runner + exactly the declared P9
//      patches; the evidence-pinned V-VIEW and P1-P8 packages unchanged; scope;
//      results path; the 320x180 placeholder has the fixture video's aspect;
//   2. server (--media): the P9 page and probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies;
//   4. faults: the pre-P9 artifact (9d86484) and the refit and raw-scale mutants
//      are NOT QUALIFIED; evidence faults are rejected.
// Usage: node verify_ib11_p9.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p8 = require('./build_ib11_p8.cjs');
const p9 = require('./build_ib11_p9.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP9, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = 'd64df2a6ec8a3b5985ea5ab3f8e425cee4f1608f11c3308de37b94fd1d138127';
const REFIT = (x) => mustReplace(x, "\t\t\t\tconst keepView = manualZoom && currentElementType === 'image' && wantedElementType === 'video';\n", '\t\t\t\tconst keepView = false;\n');
const RAW_SCALE = (x) => mustReplace(x, '\t\t\tif (manualZoom && pw > 0 && ph > 0 && vw > 0 && vh > 0) zoom *= Math.min(pw / vw, ph / vh);\n', '');

// ---- 1. static ----
const PKG = fs.readFileSync(p9.OUT, 'utf8');
check('P9 package matches a fresh build', PKG === p9.buildP9().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P9 package executes the committed repair body byte for byte (ac3c9e8 / blob db54843, body d64df2a6…8127); the working tree is that blob', git('rev-parse', `${p9.P9_COMMIT}:Booru_Enhancer.user.js`).trim() === p9.P9_EXPECTED_BLOB && body(PKG) === split(git('show', `${p9.P9_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p9.P9_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p9.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P9 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
const pinned = { 'IB11_VVIEW_Controlled.user.js': '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a', 'IB11_P1_Native.user.js': '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718', 'IB11_P2_VD1.user.js': 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a', 'IB11_P3_VD5.user.js': 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6', 'IB11_P4_VD6A.user.js': '8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2', 'IB11_P5_VD6B.user.js': '2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b', 'IB11_P6_VD4.user.js': '77f233fe68de1a88b6807a7ddbb0fe646ff5ad07a40fc53189b0bf0aea381055', 'IB11_P7_VD7.user.js': '2fee6862a9f6c540cf8dcdfd8be5ecc19cfec5b0892bf8e10a38f31f7f6251ab', 'IB11_P8_Focus.user.js': '9e938f4ffd2f4239ceeeabf5ad2b69da1e1343efaa439745c69a6c2da1b6d608' };
check('the evidence-pinned V-VIEW and P1-P8 packages are unchanged', Object.entries(pinned).every(([f, s]) => sha(fs.readFileSync(path.join(__dirname, f))) === s) && fs.readFileSync(p8.OUT, 'utf8') === p8.buildP8().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P9 Image-to-Video View/.test(metaOf(PKG, 'name')) && /ib11-p9-d5/.test(metaOf(PKG, 'namespace')));
const probe = fs.readFileSync(path.join(__dirname, 'p9_d5.js'), 'utf8');
check('probe: automatic; the manual view is applied before the update through the production enrichment path (viewer.updatePost) for the SAME post id; metadata is observed by its event', !/prompt\(/.test(probe) && /const before = shot\(img\);\n\s+const w0 = watch\(\);\n\s+BE\.modules\.viewer\.updatePost\(asVideo\(id, role\)\)/.test(probe) && probe.includes("vid.addEventListener('loadedmetadata', () => { metaSeen = true; }, { once: true });"));
const pp = srv.plan({ p9: true });
check('P9 plan: one page P9_D5 with the targets P9 and P9F (video fixture cards)', pp.length === 1 && pp[0].id === 'P9_D5' && pp[0].cards.map((c) => `${c.role}:${c.kind}`).join() === 'P9:video,P9F:video', JSON.stringify(pp));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
const srvSrc = fs.readFileSync(path.join(__dirname, 'vview_server.cjs'), 'utf8');
check('results path: --p9 defaults to tests/results/ib11-p9-d5.json, which is git-ignored; the placeholder is 320x180 (16:9 like the 1280x720 fixture video)', srvSrc.includes("p9 ? path.resolve(__dirname, '../../results/ib11-p9-d5.json')") && ign('tests/results/ib11-p9-d5.json') && srv.DIMS.v169.join() === '320,180' && 320 / 180 === 1280 / 720);

async function serverChecks(mediaDir) {
  const port = 18807; const out = path.join(require('os').tmpdir(), `ib11-p9-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p9: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  const im = await fetch(`${base}/vview/img/${pg.token}/P9-v169.png`); const imOk = im.status === 200 && (await im.arrayBuffer()).byteLength > 0;
  const vd = await fetch(`${base}/vview/video/${pg.token}/P9.webm`, { headers: { Range: 'bytes=0-15' } }); const vdOk = vd.status === 206 || vd.status === 200; try { await vd.arrayBuffer(); } catch { /* noop */ }
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p9: page served; the 320x180 placeholder and the fixture video are served; results file probe ib11-p9-d5', /"page":"P9_D5"/.test(html) && imOk && vdOk && file && file.probe === 'ib11-p9-d5' && String(file.fixtures.v169.dims) === '320,180', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p9: true });
  const r = evaluateP9(clone(doc));
  check(`smoke (revision ${REVISION}): repaired production -> P9 D5 QUALIFIED`, r.verdict === 'P9 D5 QUALIFIED', JSON.stringify(r).slice(0, 900));
  const m = r.cells.P9MAN.finding.detail;
  check('smoke P9MAN: manual view applied before the update; IMG -> VIDEO for the same target; rotation, flips, pan kept; scale x 320/1280; rendered rectangle and centre kept after the metadata and 1000 ms later; no blank frame', m && m.applied && m.rebuilt && m.geometryAfterMetadata.ok && m.geometryAfter1000.ok && Math.abs(m.scaleAfter - m.scaleBefore / 4) < 1e-6 && m.frames.blank === 0, JSON.stringify(m));
  check('smoke P9FIT: without a manual view the video is fitted by fit-both', r.cells.P9FIT.finding.detail.fitOk, JSON.stringify(r.cells.P9FIT));

  // ---- faults: production ----
  const prod = async (name, text, pred, force = true) => { const { doc: dd } = await smoke(text, { p9: true, forceIdentity: force }); const rr = evaluateP9(dd); check(name, rr.verdict === 'NOT QUALIFIED' && pred(rr), JSON.stringify(rr.cells).slice(0, 700)); };
  await prod('fault: the pre-P9 artifact 9d86484 -> NOT QUALIFIED (P9MAN DEFECT_CONFIRMED: the manual view is refitted; the control still fits)', p9.buildP9({ commit: '9d86484', expectedBlob: '8453be9447820978b7d4a2886ea9ae2bf4e87c10' }).text, (rr) => rr.cells.P9MAN.finding.code === 'DEFECT_CONFIRMED' && !rr.cells.P9MAN.finding.detail.geometryAfterMetadata.ok && rr.cells.P9FIT.finding.code === 'BEHAVIOR_OK', false);
  await prod('fault: refit mutant (the manual view is never kept) -> NOT QUALIFIED', p9.buildP9({ bodyTransform: REFIT }).text, (rr) => rr.cells.P9MAN.finding.code === 'DEFECT_CONFIRMED');
  await prod('fault: raw-scale mutant (manual kept without the apparent-view rescale) -> NOT QUALIFIED (x4 apparent jump)', p9.buildP9({ bodyTransform: RAW_SCALE }).text, (rr) => rr.cells.P9MAN.finding.code === 'DEFECT_CONFIRMED' && !rr.cells.P9MAN.finding.detail.geometryAfterMetadata.ok);
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells); const rr = evaluateP9(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, m: rr.cells.P9MAN && rr.cells.P9MAN.reasons })); };
  ef('the image representation was never displayed', (dd, c) => { c.P9MAN.imgOk = false; });
  ef('the video never reported its size', (dd, c) => { c.P9MAN.metaOk = false; });
  ef('the manual view was applied after the update (not before readiness)', (dd, c) => { c.P9MAN.before.t = c.P9MAN.tUpdate + 50; });
  ef('the target changed', (dd, c) => { c.P9MAN.after.currentId = '1'; });
  ef('the image was not replaced by a video', (dd, c) => { c.P9MAN.after.tag = 'IMG'; c.P9MAN.after.nw = 320; c.P9MAN.after.nh = 180; });
  ef('rotation lost', (dd, c) => { c.P9MAN.after.transform = c.P9MAN.after.transform.replace('rotate(90deg)', 'rotate(0deg)'); });
  ef('a flip lost', (dd, c) => { c.P9MAN.after.transform = c.P9MAN.after.transform.replace('scaleX(-1)', 'scaleX(1)'); });
  ef('pan lost', (dd, c) => { c.P9MAN.after.transform = c.P9MAN.after.transform.replace(/translate\([^)]*\)/, 'translate(0px, 0px)'); });
  ef('raw scale kept', (dd, c) => { c.P9MAN.after.transform = c.P9MAN.before.transform; });
  ef('geometry jump after the metadata', (dd, c) => { c.P9MAN.after.rect.w *= 4; });
  ef('a later refit (1000 ms)', (dd, c) => { c.P9MAN.after1000.rect.cx += 10; });
  ef('a blank frame', (dd, c) => { c.P9MAN.frames.blank = 1; });
  ef('state text left after the rebuild', (dd, c) => { c.P9MAN.after.state = 'Loading video…'; });
  ef('the fitted control did not fit', (dd, c) => { c.P9FIT.after.transform = c.P9FIT.after.transform.replace(/ scale\([^)]*\)/, ' scale(2)'); });
  ef('trusted input outside a prompt', (dd, c) => { c.P9MAN.outsideTrusted = 1; });
  ef('wrong production artifact', (dd) => { dd.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (dd) => { dd.pages.push({ ...clone(dd.pages[0]), attempt: 2 }); });
  { const rr = evaluateP9({ probe: 'ib11-p8-focus' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P9_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p9-verification', p9Commit: p9.P9_COMMIT, p9Blob: p9.P9_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
