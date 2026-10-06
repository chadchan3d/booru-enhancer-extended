'use strict';
// Local qualification of the IB11 G-PLAY E package and evaluator (no real
// browser; the browser run belongs to the operator):
//   1. static: package current; executed body = committed production 4d793a2
//      body byte for byte; @match scope; server plan and media verification;
//   2. smoke (jsdom, fake clock, the media SIMULATOR in gplay_sim.cjs: muted
//      autoplay allowed, unmuted only after user activation; loop/ended; 404; a
//      pending load; Chrome's position reset when a video is released): all 4
//      pages run end to end and the evaluator passes. The simulator is not browser evidence; it only proves the
//      runner/recorder/evaluator chain works and is fault-sensitive;
//   3. fault controls: production-mutant packages (identity forced to MATCH so
//      a behavioral criterion, not identity, must catch them) and evidence /
//      evaluator faults on the smoke results.
// Usage: node verify_ib11_gplay.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_gplay.cjs');
const srv = require('./gplay_server.cjs');
const { evaluate, REVISION } = require('./gplay_evaluate.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 700) });
const REPO = path.resolve(__dirname, '../../..');
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---- 1. static ----
const PKG = fs.readFileSync(b.OUT, 'utf8');
const fresh = b.build();
check('package matches a fresh build', PKG === fresh.text);
check('production at the pinned commit is blob 002bdfd and equals the working tree', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB && h.gitBlobId(h.productionSource()) === b.EXPECTED_PRODUCTION_BLOB);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('the package executes the committed production body byte for byte (no hooks)', body(PKG) === split(PROD).body);
check('scope: matches only the local G-PLAY server', split(PKG).meta.split('\n').filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === `http://127.0.0.1:${srv.PORT}/*`);
const pl = srv.plan();
check('plan: 4 pages (N/U x MP4/WebM); arm N 13 cells ending with RETRY; arm U 3 cells incl. DELIB', pl.length === 4 && pl.filter((p) => p.arm === 'N').every((p) => p.cells.length === 13 && p.cells[12].name === 'RETRY') && pl.filter((p) => p.arm === 'U').every((p) => p.cells.length === 3 && p.cells[2].name === 'DELIB'));
let refused = false; try { srv.createServer({ mediaDir: path.join(__dirname, 'no-such-dir') }); } catch { refused = true; }
check('server refuses to start without the pinned media fixtures', refused);

// ---- 2. smoke (shared simulator: gplay_sim.cjs) ----
const { smoke: smokeRun, clone, cellOf } = require('./gplay_sim.cjs');
const smoke = async (source, opts = {}) => (await smokeRun(source, opts)).doc;
// Revision 1.0 of the evaluator, read from git (b1dbaa9), to show the LOOP defect and its correction.
function evaluatorAt(commit) {
  const Module = require('module');
  const text = execFileSync('git', ['-C', REPO, 'show', `${commit}:tests/browser/ib11/gplay_evaluate.cjs`], { encoding: 'utf8' });
  const m = new Module(path.join(__dirname, `gplay_evaluate@${commit}.cjs`), module); m.filename = m.id; m.paths = Module._nodeModulePaths(__dirname); m._compile(text, m.filename);
  return m.exports;
}

async function main() {
  const doc = await smoke(PKG);
  const r = evaluate(doc);
  check(`smoke: all 4 pages ran end to end; identity MATCH; evaluator revision ${REVISION} PASS on simulated media`, r.pass && r.complete, JSON.stringify({ missing: r.missingPages, pageFailures: r.pageFailures, failures: r.failures.slice(0, 4), counts: r.counts }));
  const cap = r.capabilityTable;
  check('smoke capability table follows the simulated policy (not the assigned attributes): N muted autoplay PLAYED, N unmuted autoplay BLOCKED, N autoplay=false IDLE (no play attempted), U unmuted PLAYED',
    cap['N-mp4'] && cap['N-mp4'].PREF === 'PLAYED' && cap['N-mp4'].UNMUTED === 'BLOCKED' && cap['N-webm'].UNMUTED === 'BLOCKED' && cap['N-mp4'].NOAUTO === 'IDLE' && cap['N-mp4'].CLOSEPEND === 'CLOSED_BEFORE_READY' && cap['U-mp4'].UNMUTED === 'PLAYED' && cap['N-mp4'].FAIL === 'ERROR', JSON.stringify(cap));
  const rej = r.pages.find((p) => p.page === 'N-mp4').cells.find((c) => c.id.endsWith('PLAYREJ'));
  check('smoke: the metadata-update play() without activation is recorded as rejected (NotAllowedError) and the cell is not counted as played', rej && rej.detail.api && rej.detail.api[0] === 'NotAllowedError' && rej.capability === 'BLOCKED', JSON.stringify(rej));
  const retry = r.pages.find((p) => p.page === 'N-webm').cells.find((c) => c.id.endsWith('RETRY'));
  check('smoke: explicit Play retry (trusted Space -> production togglePlayPause) resolved and played after the blocked autoplay', retry && retry.detail.retry === 'resolved' && retry.status === 'PASS', JSON.stringify(retry));

  // ---- 3a. production-mutant packages ----
  const mut = (from, to) => b.build({ bodyTransform: (x) => mustReplace(x, from, to) }).text;
  const pf = async (name, src, code) => { const rr = evaluate(await smoke(src, { forceIdentity: true }));
    check(`fault production: ${name}: caught (${code})`, !rr.pass && rr.failures.some((c) => c.fails.some((f) => f.startsWith(code))), JSON.stringify(rr.failures.slice(0, 3))); };
  await pf('explicit mute=false forcibly remuted', mut("\t\t\t\tel.muted = !!BE.settings.get('viewer.muteVideo');", '\t\t\t\tel.muted = true;'), 'PREF');
  await pf('autoplay=false still plays automatically', mut("\t\t\t\tel.autoplay = !!BE.settings.get('viewer.autoplayVideo');", '\t\t\t\tel.autoplay = true;'), 'NOAUTO');
  await pf('loop=false ignored', mut("\t\t\t\tel.loop = !!BE.settings.get('viewer.loopVideo');", '\t\t\t\tel.loop = true;'), 'LOOP');
  await pf('remembered volume lost', mut('\t\t\t\t\tel.volume = vol;\n', ''), 'VOL');
  await pf('older generation keeps playing after replacement (previous media not stopped)', mut('\t\t\tstopMedia(old);\n', ''), 'STALE');
  await pf('close leaves the old video active', mut('\t\t\tstopMedia(mediaEl);\n\t\t\tmediaEl = null;', '\t\t\tmediaEl = null;'), 'CLOSE');
  await pf('native recovery link removed after failure', mut('\t\t\t\t\tif (nativeUrl) {', '\t\t\t\t\tif (false) {'), 'FAILN');
  await pf('Space no longer retries play (togglePlayPause pauses only)', mut('\t\t\t\tmediaEl.paused ? mediaEl.play().catch(() => {}) : mediaEl.pause();', '\t\t\t\tmediaEl.pause();'), 'RETRY');
  await pf('production re-mutes after a deliberate unmute', mut("\t\t\t\tel.addEventListener('loadeddata', () => onMediaReady(el, generation));", "\t\t\t\tel.addEventListener('loadeddata', () => onMediaReady(el, generation)); el.addEventListener('volumechange', () => { if (!el.muted && BE.settings.get('viewer.muteVideo')) el.muted = true; });"), 'MUTE');

  // ---- 3b. evidence / evaluator faults on the smoke result ----
  const ef = (name, f, code) => { const d = clone(doc); f(d); const rr = evaluate(d); check(`fault evidence: ${name}: caught${code ? ` (${code})` : ''}`, !rr.pass && (!code || rr.failures.some((c) => c.fails.some((x) => x.startsWith(code))) || rr.pageFailures.length || !rr.complete), JSON.stringify({ pf: rr.pageFailures, f: rr.failures.slice(0, 2), complete: rr.complete })); };
  ef('rejected play reported as success (outcome "resolved" without playback)', (d) => { const v = cellOf(d, 'N-mp4-PLAYREJ').videos[0]; v.calls.filter((q) => q[1] === 'play').forEach((q) => { q[4] = 'resolved'; }); }, 'PLAY');
  ef("unmuted autoplay assigned but never played is still reported 'playing'", (d) => { const v = cellOf(d, 'N-webm-UNMUTED').videos[0]; v.assigned.autoplay = false; v.ev.push([v.created + 500, 'playing', 0, 1]); v.maxTime = 3; }, 'PLAY');
  ef('a newer target shows the old generation failure', (d) => { const c = cellOf(d, 'N-mp4-STALE'); c.stage.push([c.videos[1].created + 10, { state: 'Video failed to load', link: 'card-post', open: true }]); }, 'STALE');
  ef('old video still holds its source at the cell end', (d) => { cellOf(d, 'N-webm-CLOSEPLAY').videos[0].now.holdsSrc = 1; }, 'REL');
  ef('page identity mismatch', (d) => { d.pages[1].client.identity = 'MISMATCH'; });
  ef('trusted input outside a prompt contaminates the cell', (d) => { cellOf(d, 'N-mp4-NOAUTO').trustedOutsidePrompt = 1; });
  ef('a page is missing', (d) => { d.pages.pop(); });
  ef('retry press not trusted', (d) => { cellOf(d, 'N-mp4-RETRY').marks.forEach((m) => { if (m.what === 'retry-key') m.trusted = false; }); }, 'RETRY');
  ef('arm U Start click not trusted', (d) => { d.pages[2].client.start.trusted = false; });

  // ---- 3c. LOOP close/reset boundary (revision 1.1) ----
  const loopf = cellOf(doc, 'N-mp4-LOOPF'); const la = loopf.videos[0]; const esc = loopf.marks.find((m) => m.what === 'key' && m.key === 'Escape').t;
  const seek = loopf.marks.find((m) => m.what === 'seek-near-end').t;
  check('the simulator reproduces the first-run artifact: a reset "wrap" (with abort/emptied) right after the close of a loop=false cell, after a genuine ended', la.ev.some((e) => e[1] === 'wrap' && e[0] >= esc) && la.ev.some((e) => e[1] === 'emptied' && e[0] >= esc) && la.ev.some((e) => e[1] === 'ended' && e[0] > seek && e[0] < esc), JSON.stringify(la.ev.filter((e) => e[0] > seek)));
  const old = evaluatorAt('b1dbaa9');
  const r10 = old.evaluate(clone(doc)); const r11 = evaluate(clone(doc));
  const st = (rr, id) => rr.pages.flatMap((p) => p.cells).find((c) => c.id === id).status;
  check('revision 1.0 (git b1dbaa9) fails both LOOPF cells on that artifact; revision 1.1 passes them', old.REVISION === '1.0' && st(r10, 'N-mp4-LOOPF') === 'FAIL' && st(r10, 'N-webm-LOOPF') === 'FAIL' && st(r11, 'N-mp4-LOOPF') === 'PASS' && st(r11, 'N-webm-LOOPF') === 'PASS', JSON.stringify([st(r10, 'N-mp4-LOOPF'), st(r11, 'N-mp4-LOOPF')]));
  const lf = (name, id, mutate, expectPass) => { const d = clone(doc); const c = cellOf(d, id); mutate(c, c.videos[0], c.marks.find((m) => m.what === 'seek-near-end').t, c.marks.find((m) => m.what === 'key' && m.key === 'Escape').t); const rr = evaluate(d); const s1 = st(rr, id);
    check(`LOOP control: ${name}: ${expectPass ? 'passes' : 'caught'}`, expectPass ? s1 === 'PASS' : (s1 === 'FAIL' && rr.failures.find((x) => x.id === id).fails.some((x) => x.startsWith('LOOP'))), JSON.stringify(rr.failures.filter((x) => x.id === id))); };
  lf('loop=false + genuine ended before close + later cleanup reset wraps', 'N-webm-LOOPF', (c, v, ts, tc) => { v.ev.push([tc + 1, 'wrap', 1, 0], [tc + 2, 'wrap', 1, 0]); }, true);
  lf('loop=false + a genuine pre-close wrap', 'N-mp4-LOOPF', (c, v, ts, tc) => { v.ev.push([ts + 500, 'wrap', 1, 0]); }, false);
  lf('loop=false without ended', 'N-mp4-LOOPF', (c, v) => { v.ev = v.ev.filter((e) => e[1] !== 'ended'); }, false);
  lf('loop=true with a pre-close ended', 'N-mp4-LOOPT', (c, v, ts) => { v.ev.push([ts + 900, 'ended', 1, 12]); }, false);
  lf('loop=true without a pre-close wrap', 'N-webm-LOOPT', (c, v, ts, tc) => { v.ev = v.ev.filter((e) => !(e[1] === 'wrap' && e[0] < tc)); }, false);
  lf('loop=true whose only wrap is the cleanup reset (cannot satisfy loop=true)', 'N-mp4-LOOPT', (c, v, ts, tc) => { v.ev = v.ev.filter((e) => !(e[1] === 'wrap' && e[0] < tc)); v.ev.push([tc + 1, 'wrap', 1, 0]); }, false);
  lf('loop=true whose wrap coincides with a production removeSrc (reset boundary without Escape)', 'N-webm-LOOPT', (c, v, ts, tc) => { v.ev = v.ev.filter((e) => !(e[1] === 'wrap' && e[0] < tc)); c.marks = c.marks.filter((m) => m.what !== 'key'); v.calls.push([ts + 700, 'removeSrc']); v.ev.push([ts + 701, 'wrap', 1, 0]); }, false);

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_GPLAY_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-gplay-verification', commit: b.COMMIT, blob: b.EXPECTED_PRODUCTION_BLOB, evaluatorRevision: REVISION, passed, total: results.length,
    smokeCapabilityTable: cap, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
