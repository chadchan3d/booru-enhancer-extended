'use strict';
// Local qualification of the IB11-P3 (V-D5) browser qualification package (no
// real browser - the trusted-key run belongs to the operator):
//   1. static: package current; executed body byte-identical to the committed
//      P3 repair (48e44d9); runner = V-VIEW runner + exactly the declared P3
//      patches; the evidence-pinned V-VIEW, P1 and P2 packages unchanged; scope;
//   2. server (--media): the P3 page and probe;
//   3. smoke (jsdom + vview_sim.cjs): the repaired production qualifies (Ctrl+F,
//      Ctrl+D, Alt+O fire no viewer command and are not prevented; unmodified F
//      and D still Favorite / Download once, prevented);
//   4. faults: the same probe on the pre-P3 artifact (bef4437) and on a mutant
//      without the modifier guard are NOT QUALIFIED; an over-broad guard that
//      breaks the unmodified F binding is NOT QUALIFIED; evidence faults are
//      rejected.
// Usage: node verify_ib11_p3.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const p1 = require('./build_ib11_p1.cjs');
const p2 = require('./build_ib11_p2.cjs');
const p3 = require('./build_ib11_p3.cjs');
const srv = require('./vview_server.cjs');
const { evaluateP3, REVISION } = require('./vview_evaluate.cjs');
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
const REPAIR_BODY_SHA = 'c42b71dbb7d660595be20095bac47cc1712a85381464d8327814895fa4745995';
const GUARD = '\t\t\tif (e.ctrlKey || e.metaKey || e.altKey) return;\n';

// ---- 1. static ----
const PKG = fs.readFileSync(p3.OUT, 'utf8');
check('P3 package matches a fresh build', PKG === p3.buildP3().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P3 package executes the committed repair body byte for byte (48e44d9 / blob f2b46eb, body c42b71db…5995); the working tree is that blob', git('rev-parse', `${p3.P3_COMMIT}:Booru_Enhancer.user.js`).trim() === p3.P3_EXPECTED_BLOB && body(PKG) === split(git('show', `${p3.P3_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p3.P3_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p3.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P3 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
check('the evidence-pinned V-VIEW (598ba6c5…), P1 (5842a1da…) and P2 (d38963eb…) packages are unchanged', sha(fs.readFileSync(b.OUT)) === '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a' && sha(fs.readFileSync(p1.OUT)) === '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718' && sha(fs.readFileSync(p2.OUT)) === 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a' && fs.readFileSync(p2.OUT, 'utf8') === p2.buildP2().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P3 Modifier-Chord/.test(metaOf(PKG, 'name')) && /ib11-p3-vd5/.test(metaOf(PKG, 'namespace')));
check('runner stubs: Favorite, Download and window.open are recording stubs inside the test page (no real favorite, download or tab)', /stubs\.fav/.test(post) && PKG.includes('window.open = (u) => { opened.push(String(u)); return null; };'));
check('runner measures the viewer decision in the window BUBBLE phase (after production) and suppresses only Ctrl/Meta+D (no browser bookmark)', PKG.includes("window.addEventListener('keydown', (e) => {\n      const k = String(e.key || '').toLowerCase();") && PKG.includes("const suppress = (e.ctrlKey || e.metaKey) && k === 'd';") && PKG.includes("viewerOwner.on(document, 'keydown', onKeydown);"));
const pp = srv.plan({ p3: true });
check('P3 plan: one page P3_VD5 with one image card', pp.length === 1 && pp[0].id === 'P3_VD5' && pp[0].cards.length === 1 && pp[0].cards[0].kind === 'img' && pp[0].cards[0].role === 'VD5', JSON.stringify(pp));

async function serverChecks(mediaDir) {
  const port = 18801; const out = path.join(require('os').tmpdir(), `ib11-p3-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p3: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p3: page served; results file probe ib11-p3-vd5', /"page":"P3_VD5"/.test(html) && file && file.probe === 'ib11-p3-vd5', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p3: true });
  const r = evaluateP3(clone(doc));
  check(`smoke (revision ${REVISION}): repaired production -> V-D5 REPAIR QUALIFIED`, r.verdict === 'V-D5 REPAIR QUALIFIED', JSON.stringify(r));
  check('smoke: Ctrl+F and Ctrl+D -> no Favorite, no Download, not prevented, viewer stays open', r.cells.VD5.evidence === 'PASS' && r.cells.VD5.finding.detail.every((x) => x.ok), JSON.stringify(r.cells.VD5));
  const k = r.cells.P3KEYS.finding.detail;
  check('smoke: Alt+O -> no Open original / Favorite / Download, not prevented; unmodified F -> Favorite once (prevented); unmodified D -> Download once (prevented)', k.altO.open === 0 && k.altO.defaultPrevented === false && k.f.fav === 1 && k.f.defaultPrevented === true && k.d.dl === 1 && k.d.defaultPrevented === true, JSON.stringify(k));

  // ---- faults: production ----
  { const pre = p3.buildP3({ commit: 'bef4437', expectedBlob: '56c495e2c726a5a17f443d89d729fbd8f206eb46' }).text; const { doc: d } = await smoke(pre, { p3: true }); const rr = evaluateP3(d);
    check('fault: the same probe on the pre-P3 artifact bef4437 -> NOT QUALIFIED (VD5 and P3KEYS DEFECT_CONFIRMED: Ctrl+F favorites, Ctrl+D downloads, Alt+O opens the original, all prevented)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD5.evidence === 'PASS' && rr.cells.VD5.finding.code === 'DEFECT_CONFIRMED' && rr.cells.P3KEYS.finding.code === 'DEFECT_CONFIRMED' && rr.cells.P3KEYS.finding.detail.altO.open === 1, JSON.stringify(rr.cells)); }
  { const mut = p3.buildP3({ bodyTransform: (x) => mustReplace(x, GUARD, '') }).text; const { doc: d } = await smoke(mut, { p3: true, forceIdentity: true }); const rr = evaluateP3(d);
    check('fault: mutant without the modifier guard -> NOT QUALIFIED (DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD5.finding.code === 'DEFECT_CONFIRMED' && rr.cells.P3KEYS.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells)); }
  { const mut = p3.buildP3({ bodyTransform: (x) => mustReplace(x, GUARD, "\t\t\tif (e.ctrlKey || e.metaKey || e.altKey || e.key === 'f') return;\n") }).text; const { doc: d } = await smoke(mut, { p3: true, forceIdentity: true }); const rr = evaluateP3(d);
    check('fault: over-broad guard (unmodified F no longer favorites) -> NOT QUALIFIED (P3KEYS DEFECT_CONFIRMED)', rr.verdict === 'NOT QUALIFIED' && rr.cells.VD5.finding.code === 'BEHAVIOR_OK' && rr.cells.P3KEYS.finding.code === 'DEFECT_CONFIRMED', JSON.stringify(rr.cells)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const d = clone(doc); f(d, d.pages[0].client.cells); const rr = evaluateP3(d); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, v: rr.cells.VD5, k: rr.cells.P3KEYS && rr.cells.P3KEYS.reasons })); };
  const chord = (c, w) => c.VD5.chords.find((x) => x.want === w);
  const row = (c, w) => c.P3KEYS.rows.find((x) => x.want === w);
  ef('untrusted Ctrl+F', (d, c) => { chord(c, 'f').trusted = false; });
  ef('Ctrl+D prevented', (d, c) => { chord(c, 'd').defaultPrevented = true; });
  ef('Ctrl+F fired Favorite', (d, c) => { chord(c, 'f').fav = 1; });
  ef('Ctrl+F viewer decision not measured', (d, c) => { chord(c, 'f').defaultPrevented = null; });
  ef('Ctrl+D browser bookmark default not suppressed by the runner', (d, c) => { chord(c, 'd').runnerSuppressedBrowserDefault = false; });
  ef('unmodified F viewer decision not measured', (d, c) => { row(c, 'f').defaultPrevented = null; });
  ef('untrusted Alt+O', (d, c) => { row(c, 'alt+o').trusted = false; });
  ef('Alt+O without altKey', (d, c) => { row(c, 'alt+o').altKey = false; });
  ef('Alt+O opened the original', (d, c) => { row(c, 'alt+o').open = 1; });
  ef('unmodified F not recorded', (d, c) => { c.P3KEYS.rows = c.P3KEYS.rows.filter((x) => x.want !== 'f'); });
  ef('unmodified D did not download', (d, c) => { row(c, 'd').dl = 0; });
  ef('unmodified F carried Shift', (d, c) => { row(c, 'f').shiftKey = true; });
  ef('trusted input outside a prompt (P3KEYS)', (d, c) => { c.P3KEYS.outsideTrusted = 1; });
  ef('trusted input outside a prompt (VD5)', (d, c) => { c.VD5.outsideTrusted = 1; });
  ef('wrong production artifact', (d) => { d.pages[0].client.identity = 'MISMATCH'; });
  ef('duplicate valid attempts', (d) => { d.pages.push({ ...clone(d.pages[0]), attempt: 2 }); });
  { const rr = evaluateP3({ probe: 'ib11-p2-vd1' }); check('fault evidence: wrong result type: NOT QUALIFIED', rr.verdict === 'NOT QUALIFIED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_P3_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-p3-verification', p3Commit: p3.P3_COMMIT, p3Blob: p3.P3_EXPECTED_BLOB, repairBodySha256: REPAIR_BODY_SHA, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
