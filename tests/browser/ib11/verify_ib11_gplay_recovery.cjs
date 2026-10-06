'use strict';
// Local qualification of the IB11 G-PLAY targeted DELIB recovery (IB11-E1):
//   1. static: the recovery package is the unchanged evidence package
//      (production 4d793a2 body byte for byte, same recorder) plus only the
//      declared runner patches; the evidence package itself is unchanged; the
//      recovery plan is exactly U-mp4-DELIB and U-webm-DELIB;
//   2. smoke (jsdom + gplay_sim.cjs simulator): an original run whose DELIB
//      prompts were never answered (as in the first real run) evaluates 30/2
//      under revision 1.1; the recovery run passes; the merge passes 32/32 with
//      explicit provenance and leaves the original document untouched;
//   3. faults: prompt timeout -> INVALID (not evidence, page does not
//      advance); no playback before the prompt -> INVALID; ambiguous,
//      foreign, missing, wrong-probe, identity, untrusted-Start and
//      untrusted-Unmute recoveries rejected; production re-mute and mute
//      preference faults caught;
//   4. server (--media <fixture folder>): recovery mode keeps INVALID attempts,
//      refuses a second valid attempt, finishes only with one valid attempt per
//      page.
// Usage: node verify_ib11_gplay_recovery.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_gplay.cjs');
const rb = require('./build_ib11_gplay_recovery.cjs');
const srv = require('./gplay_server.cjs');
const { evaluate, REVISION, RECOVERY_CELLS } = require('./gplay_evaluate.cjs');
const { smoke, clone, cellOf } = require('./gplay_sim.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 700) });
const REPO = path.resolve(__dirname, '../../..');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const EVIDENCE_PACKAGE_SHA256 = '3c613d113f39c45025cfdd2a244c6fc5250637fdf6f79cd67e35321e296f078a';
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

// ---- 1. static ----
const REC = fs.readFileSync(rb.OUT, 'utf8');
const fresh = rb.buildRecovery();
check('recovery package matches a fresh build', REC === fresh.text);
check('the evidence-run package is unchanged (fresh build, SHA-256 3c613d11...)', fs.readFileSync(b.OUT, 'utf8') === b.build().text && sha(fs.readFileSync(b.OUT)) === EVIDENCE_PACKAGE_SHA256, sha(fs.readFileSync(b.OUT)));
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('recovery executes the committed production body byte for byte, with the same recorder', body(REC) === split(PROD).body && REC.includes(fs.readFileSync(path.join(__dirname, 'gplay_preamble.js'), 'utf8').replace(/\r\n/g, '\n')));
let reapplied = fresh.original; for (const [f, t] of rb.PATCHES) reapplied = mustReplace(reapplied, f, t);
const runner = REC.slice(REC.indexOf(b.WRAP_CLOSE) + b.WRAP_CLOSE.length);
check(`recovery runner = evidence runner + exactly the ${rb.PATCHES.length} declared patches (prompt visibility, timeout -> INVALID, playback required, no advance on error)`, runner === reapplied && runner !== fresh.original);
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('distinct name/namespace; same local-only scope', metaOf(REC, 'name') !== metaOf(b.build().text, 'name') && metaOf(REC, 'namespace') !== metaOf(b.build().text, 'namespace') && metaOf(REC, 'match') === `http://127.0.0.1:${srv.PORT}/*`);
const rp = srv.plan({ recovery: true });
check('recovery plan: only U-mp4-DELIB and U-webm-DELIB (one cell per page, same preferences)', rp.length === 2 && rp.map((p) => p.cells.map((c) => c.id).join()).join('|') === RECOVERY_CELLS.join('|') && rp.every((p) => p.recovery && p.cells[0].kind === 'DELIB' && p.cells[0].storedVolume === 0.37));

async function serverChecks(mediaDir) {
  const port = 18796;
  let finalDoc = null;
  const s = srv.createServer({ mediaDir, port, recovery: true, log: () => {} });
  s.server.on('gplay-done', (d) => { finalDoc = d; });
  await s.listen();
  const post = async (pg, client) => { const r = await fetch(`http://127.0.0.1:${port}/gplay/result`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: pg.token, ...client }) }); return { status: r.status, body: await r.json() }; };
  const ok = { identity: 'MATCH_EXPECTED_ARTIFACT', start: { trusted: true }, cells: [{ id: 'X' }], error: null };
  const [p1, p2] = s.pages;
  const inv = await post(p1, { ...ok, cells: [], error: 'PROMPT_TIMEOUT Unmute' });
  const v1 = await post(p1, ok);
  const dup = await post(p1, ok);
  const beforeDone = finalDoc;
  const v2 = await post(p2, ok);
  await new Promise((r) => s.server.close(r));
  check('server recovery: an INVALID attempt is kept and does not advance (next null)', inv.status === 200 && inv.body.next === null, JSON.stringify(inv));
  check('server recovery: a valid attempt advances to the next recovery page', v1.status === 200 && /\/posts\?page=/.test(v1.body.next || ''), JSON.stringify(v1));
  check('server recovery: a second valid attempt for the same page is refused (409)', dup.status === 409 && !beforeDone, JSON.stringify(dup));
  check('server recovery: finishes only with one valid attempt per page; the file keeps the INVALID attempt with attempt numbers', v2.body.next === '/gplay/done' && finalDoc && finalDoc.probe === 'ib11-gplay-recovery' && finalDoc.pages.length === 3 && finalDoc.pages.filter((x) => x.client.error).length === 1 && finalDoc.pages.map((x) => x.attempt).join() === '1,2,1', JSON.stringify(finalDoc && finalDoc.pages.map((x) => [x.page, x.attempt, x.client.error])));
}

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  // ---- 2. smoke ----
  const PKG = b.build().text;
  const orig = (await smoke(PKG)).doc;
  for (const id of RECOVERY_CELLS) { const c = cellOf(orig, id); for (const m of c.marks) if (m.what === 'unmute') m.trusted = false; c.promptInputs = 0; for (const v of c.videos) v.writes = v.writes.filter((w) => !(w[1] === 'muted' && w[3] === 'harness')); }
  const r0 = evaluate(clone(orig));
  check(`revision ${REVISION}: an original run whose DELIB prompts were never answered evaluates 30 PASS / 2 FAIL, failing only the two DELIB cells for the missing trusted Unmute`, r0.counts.PASS === 30 && r0.counts.FAIL === 2 && r0.failures.map((x) => x.id).sort().join() === RECOVERY_CELLS.slice().sort().join() && r0.failures.every((x) => x.fails.some((f) => /no trusted Unmute/.test(f))), JSON.stringify(r0.failures));
  const { doc: rec, uis } = await smoke(REC, { recovery: true });
  check('recovery smoke: both pages valid, each with its DELIB cell; the prompt was the large centered panel with an ACTION NEEDED tab title', rec.pages.every((p) => p.client && !p.client.error && p.client.cells.length === 1) && uis.every((u) => u.promptSeen && /translate\(-50%, ?-50%\)/.test(u.promptSeen.panelCss) && /ACTION NEEDED/.test(u.promptSeen.title)), JSON.stringify(uis));
  const frozen = JSON.stringify(orig);
  const prov = { originalSha256: sha(frozen), recoverySha256: sha(JSON.stringify(rec)) };
  const m = evaluate(orig, { recovery: rec, provenance: prov });
  check('merge: original + recovery evaluate PASS 32/32; both DELIB cells replaced (FAIL -> PASS) with the recovery hash and page; no merge problem', m.pass && m.counts.PASS === 32 && m.recovery.problems.length === 0 && m.recovery.replaced.length === 2 && m.recovery.replaced.every((x) => x.originalStatus === 'FAIL' && x.recoveryStatus === 'PASS' && x.recoverySha256 === prov.recoverySha256) && m.provenance.originalSha256 === prov.originalSha256, JSON.stringify({ recovery: m.recovery, failures: m.failures }));
  check('merge leaves the original document unchanged and marks every cell with its source', JSON.stringify(orig) === frozen && m.pages.flatMap((p) => p.cells).filter((c) => c.source === 'recovery').length === 2 && m.pages.flatMap((p) => p.cells).filter((c) => c.source === 'original').length === 30);

  // ---- 3. faults ----
  const t1 = await smoke(REC, { recovery: true, prompts: 'start' });
  const p0 = t1.doc.pages[0].client;
  check('fault: Unmute never clicked -> PROMPT_TIMEOUT; the attempt carries no DELIB cell; the panel says INVALID and the page does not advance', p0 && /PROMPT_TIMEOUT Unmute/.test(p0.error || '') && p0.cells.length === 0 && /INVALID/.test(t1.uis[0].msg) && /INVALID/.test(t1.uis[0].title), JSON.stringify({ err: p0 && p0.error, ui: t1.uis[0] }));
  const tm = evaluate(clone(orig), { recovery: t1.doc });
  check('fault: a timed-out recovery is not evidence (merge fails: no valid attempt; listed as INVALID attempts)', !tm.pass && tm.recovery.problems.some((x) => /no valid recovery attempt/.test(x)) && tm.recovery.invalidAttempts.length === 2, JSON.stringify(tm.recovery));
  const np = await smoke(rb.buildRecovery({ bodyTransform: (x) => mustReplace(x, "\t\t\t\tel.autoplay = !!BE.settings.get('viewer.autoplayVideo');", '\t\t\t\tel.autoplay = false;') }).text, { recovery: true });
  check('fault: no playback before the prompt -> DELIB_NOT_PLAYING; INVALID, not evidence', np.doc.pages.every((p) => /DELIB_NOT_PLAYING/.test(p.client.error || '')) && !evaluate(clone(orig), { recovery: np.doc }).pass, JSON.stringify(np.doc.pages.map((p) => p.client.error)));
  const mf = (name, mutate, re) => { const r2 = clone(rec); mutate(r2); const mm = evaluate(clone(orig), { recovery: r2 }); check(`fault merge: ${name}: rejected`, !mm.pass && (!re || (mm.recovery.problems.some((x) => re.test(x)) || mm.failures.some((c) => c.fails.some((x) => re.test(x))))), JSON.stringify({ problems: mm.recovery.problems, f: mm.failures.slice(0, 2) })); };
  mf('two valid attempts for one cell (ambiguous)', (r2) => { r2.pages.push({ ...clone(r2.pages[0]), attempt: 2 }); }, /ambiguous/);
  mf('a cell outside the recovery set', (r2) => { r2.pages[0].client.cells.push({ ...clone(cellOf(orig, 'N-mp4-PREF')) }); }, /not a recoverable cell/);
  mf('one recovery cell missing', (r2) => { r2.pages.pop(); }, /no valid recovery attempt for U-webm-DELIB/);
  { const mm = evaluate(clone(orig), { recovery: clone(orig) }); check('fault merge: wrong probe: rejected', !mm.pass && mm.recovery.problems.some((x) => /not an ib11-gplay-recovery/.test(x))); }
  mf('recovery identity mismatch', (r2) => { r2.pages[1].client.identity = 'MISMATCH'; }, /identity MISMATCH/);
  mf('recovery Start not trusted', (r2) => { r2.pages[0].client.start.trusted = false; }, /start/);
  mf('recovery Unmute not trusted', (r2) => { for (const m2 of r2.pages[0].client.cells[0].marks) if (m2.what === 'unmute') m2.trusted = false; }, /DELIB no trusted Unmute/);
  mf('A never played before the Unmute', (r2) => { const v = r2.pages[1].client.cells[0].videos[0]; v.ev = v.ev.filter((e) => e[1] !== 'playing'); }, /did not actually play/);
  const pfm = async (name, from, to, re) => { const d = await smoke(rb.buildRecovery({ bodyTransform: (x) => mustReplace(x, from, to) }).text, { recovery: true, forceIdentity: true }); const mm = evaluate(clone(orig), { recovery: d.doc });
    check(`fault production (recovery package): ${name}: caught`, !mm.pass && mm.failures.some((c) => RECOVERY_CELLS.includes(c.id) && c.fails.some((x) => re.test(x))), JSON.stringify({ f: mm.failures.slice(0, 2), p: mm.recovery.problems })); };
  await pfm('production re-mutes A after the deliberate unmute', "\t\t\t\tel.addEventListener('loadeddata', () => onMediaReady(el, generation));", "\t\t\t\tel.addEventListener('loadeddata', () => onMediaReady(el, generation)); el.addEventListener('volumechange', () => { if (!el.muted && BE.settings.get('viewer.muteVideo')) el.muted = true; });", /^(MUTE|DELIB)/);
  await pfm('B ignores the stored mute preference', "\t\t\t\tel.muted = !!BE.settings.get('viewer.muteVideo');", '\t\t\t\tel.muted = false;', /^(PREF|DELIB)/);
  await pfm('B loses the remembered volume', '\t\t\t\t\tel.volume = vol;\n', '', /^(PREF|DELIB)/);

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_GPLAY_RECOVERY_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-gplay-recovery-verification', commit: b.COMMIT, blob: b.EXPECTED_PRODUCTION_BLOB, evaluatorRevision: REVISION, recoveryCells: RECOVERY_CELLS, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
