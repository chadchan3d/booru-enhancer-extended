'use strict';
// Local qualification of the IB11-P7 (V-D7) browser qualification package (no
// real browser - the real layout run belongs to the operator). Second package:
// the first attempt (package da6b9f88…, raw b28fbf3d…72d2) showed that Chrome
// reads naturalWidth 0 for a pending in-place src while the old image stays
// painted, and paints the progressive original once its header arrives; the
// production (7e4c643) and this probe were corrected accordingly.
//   1. static: package current; executed body byte-identical to the corrected
//      repair (7e4c643); runner = V-VIEW runner + exactly the declared P7
//      patches; the evidence-pinned V-VIEW and P1-P6 packages unchanged; scope;
//      results path; the simulator models the measured Chrome image semantics;
//      the probe never waits on a placeholder's naturalWidth;
//   2. server (--media): the P7 page (VD7P; VD7 with the thumb; VD7X with the
//      800x400 placeholder) and probe;
//   3. smoke (jsdom + vview_sim.cjs): the corrected production qualifies;
//   4. faults: the pre-P7 artifact (39a5ae1), the first-attempt production
//      (b856a62), the no-placeholder, raw-zoom and in-place mutants are NOT
//      QUALIFIED; the first-attempt probe logic (waiting on naturalWidth) run
//      against the first-attempt production is NOT QUALIFIED; evidence faults
//      (including transforms captured after the original completed) are
//      rejected.
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
const REPAIR_BODY_SHA = '822a5a20e1a387340618c08267b8bd7a09b2bf1ce0ab463ad371a99a4b37780d';
const NO_PLACEHOLDER = (x) => mustReplace(x, "\t\t\tif (!post?.originalUrl || fullUrl !== post.originalUrl) return '';\n", "\t\t\treturn '';\n");
const RAW_ZOOM = (x) => mustReplace(x, '\t\t\tif (pw > 0 && ph > 0 && fw > 0 && fh > 0) zoom *= Math.min(pw / fw, ph / fh);\n', '');
const IN_PLACE = (x) => mustReplace(x, '\t\t\tpre.src = st.full;\n', '\t\t\tswapToFull(el, generation, st);\n');
const PROBE = fs.readFileSync(path.join(__dirname, 'p7_vd7.js'), 'utf8').replace(/\r\n/g, '\n');

// ---- 1. static ----
const PKG = fs.readFileSync(p7.OUT, 'utf8');
check('P7 package matches a fresh build', PKG === p7.buildP7().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('P7 package executes the corrected repair body byte for byte (7e4c643 / blob 5da8fd9, body 822a5a20…780d); the working tree is that blob', git('rev-parse', `${p7.P7_COMMIT}:Booru_Enhancer.user.js`).trim() === p7.P7_EXPECTED_BLOB && body(PKG) === split(git('show', `${p7.P7_COMMIT}:Booru_Enhancer.user.js`)).body && sha(body(PKG)) === REPAIR_BODY_SHA && h.gitBlobId(h.productionSource()) === p7.P7_EXPECTED_BLOB);
const post = fs.readFileSync(path.join(__dirname, 'vview_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = post; for (const [f, t] of p7.PATCHES) patched = mustReplace(patched, f, t);
check('runner = the V-VIEW runner + exactly the declared P7 patches', PKG.slice(PKG.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', REPAIR_BODY_SHA));
const pinned = { 'IB11_VVIEW_Controlled.user.js': '598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a', 'IB11_P1_Native.user.js': '5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718', 'IB11_P2_VD1.user.js': 'd38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a', 'IB11_P3_VD5.user.js': 'd29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6', 'IB11_P4_VD6A.user.js': '8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2', 'IB11_P5_VD6B.user.js': '2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b', 'IB11_P6_VD4.user.js': '77f233fe68de1a88b6807a7ddbb0fe646ff5ad07a40fc53189b0bf0aea381055' };
check('the evidence-pinned V-VIEW and P1-P6 packages are unchanged', Object.entries(pinned).every(([f, s]) => sha(fs.readFileSync(path.join(__dirname, f))) === s) && fs.readFileSync(p6.OUT, 'utf8') === p6.buildP6().text);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: local fixture server only; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /P7 Staged-Placeholder/.test(metaOf(PKG, 'name')) && /ib11-p7-vd7/.test(metaOf(PKG, 'namespace')));
check('probe: automatic (no prompt); the placeholder is judged by its layout footprint, never by waiting on naturalWidth; frames record the last painted placeholder and the first painted full image', !/prompt\(/.test(PROBE) && !/waitFor\([^\n]*naturalWidth === (160|800)/.test(PROBE) && PROBE.includes("nearPx(s.rect.w, f.w) && nearPx(s.rect.h, f.h)") && PROBE.includes('if (isFullImg(m)) { if (!firstFull) firstFull = f; } else lastPlaceholder = f;'));
const pp = srv.plan({ p7: true });
check('P7 plan: one page P7_VD7: VD7P (wide), VD7 (slow, thumb placeholder), VD7X (slow, 800x400 placeholder)', pp.length === 1 && pp[0].id === 'P7_VD7' && pp[0].cards.map((c) => `${c.role}:${c.media}:${c.ph || 'thumb'}`).join() === 'VD7P:wide:thumb,VD7:slow:thumb,VD7X:slow:mid', JSON.stringify(pp));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
const srvSrc = fs.readFileSync(path.join(__dirname, 'vview_server.cjs'), 'utf8');
check('results path: --p7 defaults to tests/results/ib11-p7-vd7.json, which is git-ignored', srvSrc.includes("p7 ? path.resolve(__dirname, '../../results/ib11-p7-vd7.json')") && ign('tests/results/ib11-p7-vd7.json'));
const simSrc = fs.readFileSync(path.join(__dirname, 'vview_sim.cjs'), 'utf8');
check('the simulator models the measured Chrome image semantics: synchronous reuse of images loaded in the document (incl. card thumbnails); a fetched src reads 0x0 while the painted box is retained; the progressive original is painted once its header arrives', simSrc.includes("if (avail.has(url)) { const [aw, ah] = avail.get(url); s.complete = true; s.nw = aw; s.nh = ah;") && simSrc.includes('if (s.nw > 0) { s.lw = s.nw; s.lh = s.nh; } s.nw = 0; s.nh = 0; s.complete = false;') && simSrc.includes("at(env.slowHeaderMs, () => { s.nw = 1600; s.nh = 800; s.lw = 0; s.lh = 0; });") && simSrc.includes("(this.naturalWidth || (this.__img && this.__img.lw) || 0)"));

async function serverChecks(mediaDir) {
  const port = 18805; const out = path.join(require('os').tmpdir(), `ib11-p7-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, p7: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const pg = s.pages[0];
  const html = await (await fetch(`${base}/posts?page=${pg.token}`)).text();
  const mid = await fetch(`${base}/vview/img/${pg.token}/VD7X-mid.png`); const midOk = mid.status === 200 && (await mid.arrayBuffer()).byteLength > 0;
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: null, cells: {} }) });
  await new Promise((r) => s.server.close(r));
  let file = null; try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server --p7: page served; VD7 samples the thumb, VD7X the 800x400 placeholder (served); results file probe ib11-p7-vd7 with slow 1600x800, thumb 160x80, mid 800x400', /"page":"P7_VD7"/.test(html) && /data-sample-url="\/vview\/img\/[0-9a-f]+\/VD7-thumb\.png"/.test(html) && /data-sample-url="\/vview\/img\/[0-9a-f]+\/VD7X-mid\.png"/.test(html) && midOk && file && file.probe === 'ib11-p7-vd7' && String(file.fixtures.slow.dims) === '1600,800' && String(file.fixtures.thumb.dims) === '160,80' && String(file.fixtures.mid.dims) === '800,400', JSON.stringify(file && file.probe));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  const { doc } = await smoke(PKG, { p7: true });
  const r = evaluateP7(clone(doc));
  check(`smoke (revision ${REVISION}): corrected production -> V-D7 REPAIR QUALIFIED`, r.verdict === 'V-D7 REPAIR QUALIFIED', JSON.stringify(r).slice(0, 900));
  const sd = r.cells.P7STAGE.finding.detail; const xd = r.cells.P7XFORM.finding.detail;
  check('smoke P7STAGE: VD7\'s thumb painted at the fitted footprint at 300 and 1000 ms with the original pending; no blank frame; the first full frame keeps the last placeholder frame\'s geometry', sd && sd.early.every((x) => x.ownPlaceholder && x.fittedFootprint && x.originalPending) && sd.frames.blank === 0 && sd.lastPlaceholderFitted && sd.geometryFirstFullFrame.ok && sd.geometryAfter500.ok, JSON.stringify(sd));
  check('smoke P7XFORM: transforms applied to the retained 800x400 placeholder before completion and held until the upgrade; rotation, flips, pan kept; scale x 0.5; geometry kept', xd && xd.fitOk && xd.applied && xd.heldUntilUpgrade && xd.geometryFirstFullFrame.ok && xd.geometryAfter500.ok, JSON.stringify(xd));

  // ---- faults: production ----
  const prod = async (name, text, pred, force = true) => { const { doc: dd } = await smoke(text, { p7: true, forceIdentity: force }); const rr = evaluateP7(dd); check(name, rr.verdict === 'NOT QUALIFIED' && pred(rr), JSON.stringify(rr.cells).slice(0, 700)); };
  await prod('fault: the pre-P7 artifact 39a5ae1 -> NOT QUALIFIED (no placeholder at 300/1000 ms)', p7.buildP7({ commit: '39a5ae1', expectedBlob: '0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6' }).text, (rr) => rr.cells.P7STAGE.finding.detail.early.every((x) => !x.ownPlaceholder), false);
  await prod('fault: the first-attempt production b856a62 -> NOT QUALIFIED (the placeholder painted far below its fitted footprint, as measured in Chrome; the progressive original at the old zoom in XFORM)', p7.buildP7({ commit: 'b856a62', expectedBlob: 'b88af3817e8aa3a813272a30115204f39854d58c' }).text, (rr) => rr.cells.P7STAGE.finding.detail.early.every((x) => x.ownPlaceholder && !x.fittedFootprint) && !rr.cells.P7XFORM.finding.detail.geometryFirstFullFrame.ok, false);
  await prod('fault: no-placeholder mutant -> NOT QUALIFIED (no placeholder)', p7.buildP7({ bodyTransform: NO_PLACEHOLDER }).text, (rr) => rr.cells.P7STAGE.finding.detail.early.every((x) => !x.ownPlaceholder));
  await prod('fault: raw-zoom mutant -> NOT QUALIFIED (staging intact; the first full frame jumps in both cells)', p7.buildP7({ bodyTransform: RAW_ZOOM }).text, (rr) => rr.cells.P7STAGE.finding.detail.early.every((x) => x.fittedFootprint) && !rr.cells.P7STAGE.finding.detail.geometryFirstFullFrame.ok && !rr.cells.P7XFORM.finding.detail.geometryFirstFullFrame.ok);
  await prod('fault: in-place mutant (detached preload removed) -> NOT QUALIFIED (placeholder misfitted while the original is pending)', p7.buildP7({ bodyTransform: IN_PLACE }).text, (rr) => rr.cells.P7STAGE.finding.detail.early.some((x) => !x.fittedFootprint) || !rr.cells.P7STAGE.finding.detail.geometryFirstFullFrame.ok);
  // ---- fault: the first-attempt probe logic ----
  { const OLD_WAIT = 'const phOk = await waitFor(() => retained(ex, \'VD7X\', idX), 10000); await sleep(100);';
    const text = b.build({ commit: 'b856a62', expectedBlob: 'b88af3817e8aa3a813272a30115204f39854d58c', postTransform: (pst) => p7.PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to.replace(OLD_WAIT, 'const phOk = await waitFor(() => ex.naturalWidth === 800 && ex.naturalHeight === 400, 10000); await sleep(100);')), pst) }).text;
    const { doc: dd } = await smoke(text, { p7: true }); const rr = evaluateP7(dd);
    check('fault: the first-attempt probe logic (waiting on the placeholder\'s naturalWidth) against the first-attempt production -> NOT QUALIFIED (the wait cannot succeed; the transforms land after the original completed)', rr.verdict === 'NOT QUALIFIED' && rr.cells.P7XFORM.finding.detail && !rr.cells.P7XFORM.finding.detail.applied, JSON.stringify(rr.cells.P7XFORM).slice(0, 700)); }
  // ---- faults: evidence ----
  const ef = (name, f) => { const dd = clone(doc); f(dd, dd.pages[0].client.cells); const rr = evaluateP7(dd); check(`fault evidence: ${name}: NOT QUALIFIED`, rr.verdict === 'NOT QUALIFIED', JSON.stringify({ p: rr.problems, s: rr.cells.P7STAGE && rr.cells.P7STAGE.reasons, x: rr.cells.P7XFORM && rr.cells.P7XFORM.reasons })); };
  ef('the previous target was not shown first', (dd, c) => { c.P7STAGE.prevOk = false; });
  ef('early media is another post\'s image', (dd, c) => { c.P7STAGE.samples[0].firstLabel = 'VD7P-thumb'; });
  ef('placeholder painted far below its fitted footprint (the first-attempt Chrome state)', (dd, c) => { const x = c.P7STAGE.samples[0]; x.rect.w /= 10; x.rect.h /= 10; });
  ef('early media is the completed original', (dd, c) => { const x = c.P7STAGE.samples[1]; x.full = true; x.nw = 1600; x.nh = 800; x.complete = true; x.srcLabel = 'VD7-slow'; });
  ef('original already complete at an early sample', (dd, c) => { c.P7STAGE.samples[0].t = c.P7STAGE.upgrade.t + 1; });
  ef('wrong target at an early sample', (dd, c) => { c.P7STAGE.samples[1].currentId = c.P7STAGE.prevId; });
  ef('two media elements at an early sample', (dd, c) => { c.P7STAGE.samples[0].inStage = 2; });
  ef('a blank frame after the placeholder was shown', (dd, c) => { c.P7STAGE.frames.blank = 1; });
  ef('the last painted placeholder frame is a progressive original (not the fitted thumb)', (dd, c) => { c.P7STAGE.frames.lastPlaceholder.rect.w *= 10; c.P7STAGE.frames.lastPlaceholder.rect.h *= 10; });
  ef('no painted full-image frame', (dd, c) => { c.P7STAGE.frames.firstFull = null; });
  ef('geometry jump at the first full frame (stage)', (dd, c) => { c.P7STAGE.frames.firstFull.rect.w *= 10; });
  ef('upgrade on a different element', (dd, c) => { c.P7STAGE.sameElement = false; });
  ef('no upgrade observed', (dd, c) => { c.P7STAGE.upgrade = null; });
  ef('state text left after the upgrade', (dd, c) => { c.P7STAGE.after.state = 'Loading media…'; });
  ef('retained placeholder never reached (XFORM)', (dd, c) => { c.P7XFORM.phOk = false; });
  ef('transforms captured after the original completed', (dd, c) => { const x = c.P7XFORM.transformed; x.full = true; x.nw = 1600; x.nh = 800; x.complete = true; x.srcLabel = 'VD7X-slow'; x.t = c.P7XFORM.upgrade.t + 5; });
  ef('transforms not held until the upgrade', (dd, c) => { c.P7XFORM.frames.lastPlaceholder.transform = c.P7XFORM.fittedShot.transform; });
  ef('rotation lost at the first full frame', (dd, c) => { c.P7XFORM.frames.firstFull.transform = c.P7XFORM.frames.firstFull.transform.replace('rotate(90deg)', 'rotate(0deg)'); });
  ef('flip lost at the first full frame', (dd, c) => { c.P7XFORM.frames.firstFull.transform = c.P7XFORM.frames.firstFull.transform.replace('scaleY(-1)', 'scaleY(1)'); });
  ef('pan lost at the first full frame', (dd, c) => { c.P7XFORM.frames.firstFull.transform = c.P7XFORM.frames.firstFull.transform.replace(/translate\([^)]*\)/, 'translate(0px, 0px)'); });
  ef('raw scale kept after the upgrade', (dd, c) => { c.P7XFORM.after.transform = c.P7XFORM.transformed.transform; });
  ef('geometry drift 500 ms after the upgrade (transform)', (dd, c) => { c.P7XFORM.after.rect.cx += 5; });
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
