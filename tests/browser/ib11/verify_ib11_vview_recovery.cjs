'use strict';
// Local qualification of the IB11 V-VIEW NATIVE + VD6A recovery (IB11-E4; no
// real browser - the browser run belongs to the operator):
//   1. static: package current and its production body byte-identical to
//      4d793a2; the recovery plan is exactly NATIVE_R (NATIVE) + TAKEOVER (VD6A);
//   2. server (--media): recovery pages, NATIVE_R forwards to TAKEOVER after a
//      no-navigation result, arrivals and attempts recorded, recovery probe;
//   3. smoke (jsdom + vview_sim.cjs; browser-like hit testing honoring
//      pointer-events): an original run with the real run's shape (MAIN
//      complete except NATIVE, no TAKEOVER) merged with the recovery gives one
//      explicit report with per-cell sources and provenance;
//   4. NATIVE characterizes both outcomes: the current non-interactive link is
//      DEFECT_CONFIRMED with evidence PASS; a working link (test-copy
//      production change) is BEHAVIOR_OK;
//   5. faults: outside-box, untrusted, invisible link, hit-test mismatch,
//      missing pointer-events evidence, arrival without the prompted click,
//      duplicate/ambiguous/unauthorized/mismatched recovery evidence.
// Usage: node verify_ib11_vview_recovery.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const srv = require('./vview_server.cjs');
const { evaluate, REVISION, MAIN_CELLS } = require('./vview_evaluate.cjs');
const { smoke } = require('./vview_sim.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 900) });
const REPO = path.resolve(__dirname, '../../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---- 1. static ----
const PKG = fs.readFileSync(b.OUT, 'utf8');
check('package matches a fresh build', PKG === b.build().text);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('package executes the committed production body byte for byte (009155841b19…e945)', body(PKG) === split(PROD).body && sha(body(PKG)) === '009155841b194df21a4e1d22bd3f40b5d63e2f58cfa5485b06fd4e66bd64e945');
const rp = srv.plan({ recovery: true });
check('recovery plan: NATIVE_R (one failing image card NATIVE) then TAKEOVER (VD6A); authorized cells NATIVE, VD6A', rp.length === 2 && rp[0].id === 'NATIVE_R' && rp[0].cards.map((c) => `${c.role}:${c.media}`).join() === 'NATIVE:fail' && rp[1].id === 'TAKEOVER' && rp[1].cards.map((c) => c.role).join() === 'VD6A' && srv.RECOVERY_CELLS.join() === 'NATIVE,VD6A');

async function serverChecks(mediaDir) {
  const port = 18798; let file = null;
  const out = path.join(require('os').tmpdir(), `ib11-vview-recovery-${process.pid}.json`);
  const s = srv.createServer({ mediaDir, port, out, recovery: true, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const [pn, pt] = s.pages;
  const post = async (pg, client) => (await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pg.token, identity: 'MATCH_EXPECTED_ARTIFACT', ...client }) })).json();
  const inv = await post(pn, { error: 'PROMPT_TIMEOUT NATIVE x', cells: {} });
  const ok = await post(pn, { error: null, cells: { NATIVE: { rev: '1.3' } } });
  const nat = await fetch(`${base}/posts/${pn.cards[0].id}`); const natText = await nat.text();
  await new Promise((r) => s.server.close(r));
  try { file = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); } catch { file = null; }
  check('server recovery: an INVALID attempt is kept and does not advance', !inv.next && s.attempts[0].client.error);
  check('server recovery: a valid NATIVE_R result without navigation forwards to the TAKEOVER page', ok.next === `/posts?page=${pt.token}`, JSON.stringify(ok));
  check('server recovery: /posts/<id> records a NATIVE_R arrival and forwards to TAKEOVER', nat.status === 200 && s.arrivals.some((a) => a.page === 'NATIVE_R' && a.card === 'NATIVE') && natText.includes(pt.token));
  check('server recovery: results file probe ib11-vview-recovery with the authorized cells and both attempts', file && file.probe === 'ib11-vview-recovery' && file.recoveryCells.join() === 'NATIVE,VD6A' && file.pages.length === 2 && file.pages.map((p) => p.attempt).join() === '1,2', JSON.stringify(file && { probe: file.probe, pages: file.pages.length }));
}

const cellOf = (doc, id) => { for (const p of doc.pages) if (p.client && p.client.cells && p.client.cells[id]) return p.client.cells[id]; return null; };
const cellR = (r, id) => r.cells.find((c) => c.id === id);

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  // ---- 3. original with the real run's shape ----
  const full = (await smoke(PKG)).doc;
  const orig = clone(full);
  orig.pages = orig.pages.filter((p) => p.page === 'MAIN');
  const n0 = orig.pages[0].client.cells.NATIVE; n0.click = null; n0.navigated = true; n0.overlayAtLeave = 'none';
  orig.arrivals = [];
  const r0 = evaluate(clone(orig));
  check('original (real-run shape): 9 MAIN cells evidence PASS; NATIVE and VD6A INVALID; TAKEOVER missing', r0.counts.PASS === 9 && cellR(r0, 'NATIVE').evidence === 'INVALID' && cellR(r0, 'VD6A').evidence === 'INVALID' && r0.problems.some((x) => /TAKEOVER/.test(x)), JSON.stringify({ counts: r0.counts, problems: r0.problems }));

  const { doc: rec } = await smoke(PKG, { recovery: true });
  const frozen = JSON.stringify(orig);
  const prov = { originalSha256: sha(frozen), recoverySha256: sha(JSON.stringify(rec)), g3Preflight: { sha256: 'x'.repeat(64), verdict: 'G3 PREFLIGHT COMPLETE' } };
  const m = evaluate(orig, { recovery: rec, provenance: prov });
  check(`merge (revision ${REVISION}): one explicit report, evidence PASS on all 11 cells, no merge problems`, m.evidencePass && m.counts.PASS === 11 && m.recovery.problems.length === 0, JSON.stringify({ problems: m.problems, rec: m.recovery, bad: m.cells.filter((c) => c.evidence !== 'PASS') }));
  check('merge: NATIVE and VD6A come from the recovery, the other 9 cells from the original; replaced list and provenance recorded; original document untouched',
    m.sources.NATIVE === 'recovery' && m.sources.VD6A === 'recovery' && MAIN_CELLS.filter((x) => x !== 'NATIVE').every((x) => m.sources[x] === 'original') && m.recovery.replaced.map((x) => x.cell).join() === 'NATIVE,VD6A' && m.provenance.recoverySha256 === prov.recoverySha256 && m.provenance.g3Preflight.verdict === 'G3 PREFLIGHT COMPLETE' && JSON.stringify(orig) === frozen);
  const N = cellR(m, 'NATIVE');
  check('NATIVE (current production): DEFECT_CONFIRMED with evidence PASS - computed pointer-events none, hit test on the stage, the trusted in-box click lands on the stage, viewer closes, no navigation', N.evidence === 'PASS' && N.finding.code === 'DEFECT_CONFIRMED' && N.finding.detail.linkPointerEvents === 'none' && N.finding.detail.hit.isLink === false && N.finding.detail.clickTargetIsLink === false && N.finding.detail.destinationArrived === false && N.finding.detail.viewerAfterClick.open === false, JSON.stringify(N));
  check('VD6A (recovery): characterized as before (overlay left shown; native recovery not blocked)', cellR(m, 'VD6A').evidence === 'PASS' && /overlay left shown/.test(cellR(m, 'VD6A').finding.detail.summary), JSON.stringify(cellR(m, 'VD6A')));

  // ---- 4. working link (test-copy production change only) ----
  { const fixed = b.build({ bodyTransform: (x) => mustReplace(x, "fallback.style.cssText = 'margin-left:8px;color:inherit;text-decoration:underline;';", "fallback.style.cssText = 'margin-left:8px;color:inherit;text-decoration:underline;pointer-events:auto;';") }).text;
    const { doc: rf } = await smoke(fixed, { recovery: true, forceIdentity: true }); const mf = evaluate(clone(orig), { recovery: rf }); const c = cellR(mf, 'NATIVE');
    check('NATIVE characterizes a working link too: with pointer-events:auto on the link (test copy) -> click targets the link, destination reached -> BEHAVIOR_OK, evidence PASS', c.evidence === 'PASS' && c.finding.code === 'BEHAVIOR_OK' && c.finding.detail.clickTargetIsLink && c.finding.detail.destinationArrived, JSON.stringify(c)); }

  // ---- 5. faults ----
  const nf = (name, mut, verdict) => { const r2 = clone(rec); mut(r2, cellOf(r2, 'NATIVE')); const mm = evaluate(clone(orig), { recovery: r2 }); const c = cellR(mm, 'NATIVE');
    check(`fault NATIVE: ${name}: ${verdict}`, !mm.evidencePass && c.evidence === verdict, JSON.stringify(c)); };
  nf('click outside the recorded link box', (d, c) => { c.click.x = c.link.box.x + c.link.box.w + 30; }, 'INVALID');
  nf('synthetic (untrusted) click', (d, c) => { c.click.trusted = false; }, 'INVALID');
  nf('zero-size (invisible) link', (d, c) => { c.link.box.w = 0; }, 'INVALID');
  nf('elementFromPoint mismatch (pointer-events none but the hit test returned the link)', (d, c) => { c.hit.isLink = true; }, 'INVALID');
  nf('pointer-events evidence missing', (d, c) => { delete c.link.pointerEvents; }, 'INVALID');
  nf('ancestor pointer-events evidence missing', (d, c) => { c.link.chain = []; }, 'INVALID');
  nf('destination arrival without the prompted click', (d, c) => { d.arrivals.push({ page: 'NATIVE_R', card: 'NATIVE', wall: c.click.wall - 5000, attempt: 1 }); }, 'INVALID');
  nf('link no longer present when the click arrived', (d, c) => { c.click.linkPresentAtClick = false; }, 'INVALID');
  nf('click on the link but no navigation (ambiguous)', (d, c) => { c.click.targetIsLink = true; }, 'INVALID');
  nf('no prompted click recorded', (d, c) => { c.click = null; }, 'INVALID');
  nf('link destination is not the card native post', (d, c) => { c.link.destination.cardMatch = false; }, 'FAIL');
  { const { doc: ro } = await smoke(PKG, { recovery: true, nativeClick: 'outside' }); const mm = evaluate(clone(orig), { recovery: ro });
    check('browser model: the operator clicks outside the link box -> not accepted; prompt times out; NATIVE_R attempt INVALID; merge rejects (no valid NATIVE recovery)', !mm.evidencePass && mm.recovery.invalidAttempts.some((x) => /NATIVE_R/.test(x.page) && /PROMPT_TIMEOUT/.test(x.error)) && mm.recovery.problems.some((x) => /no valid recovery attempt for NATIVE/.test(x)), JSON.stringify(mm.recovery)); }
  const mf = (name, mut, re) => { const r2 = clone(rec); const o2 = clone(orig); mut(r2, o2); const mm = evaluate(o2, { recovery: r2 }); check(`fault merge: ${name}: rejected`, !mm.evidencePass && mm.recovery && mm.recovery.problems.some((x) => re.test(x)), JSON.stringify(mm.recovery)); };
  mf('duplicate valid recovery attempts', (r2) => { r2.pages.push({ ...clone(r2.pages[0]), attempt: 2 }); }, /AMBIGUOUS/);
  mf('recovery tries to replace a non-authorized cell (VD7)', (r2) => { r2.pages[0].client.cells.VD7 = clone(cellOf(orig, 'VD7')); }, /unauthorized recovery cell VD7/);
  mf('recovery carries an unauthorized page (MAIN)', (r2, o2) => { r2.pages.push(clone(o2.pages[0])); }, /unauthorized recovery page MAIN/);
  mf('recovery identity mismatch', (r2) => { r2.pages[1].client.identity = 'MISMATCH'; }, /identity MISMATCH/);
  mf('VD6A in both the original and the recovery (ambiguous provenance)', (r2, o2) => { o2.pages.push(clone(full.pages.find((p) => p.page === 'TAKEOVER'))); }, /ambiguous provenance/);
  mf('missing VD6A recovery', (r2) => { r2.pages = r2.pages.filter((p) => p.page !== 'TAKEOVER'); }, /no valid recovery attempt for VD6A/);
  { const mm = evaluate(clone(orig), { recovery: clone(orig) }); check('fault merge: wrong recovery probe: rejected', !mm.evidencePass && mm.recovery.problems.some((x) => /not an ib11-vview-recovery/.test(x))); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_VVIEW_RECOVERY_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-vview-recovery-verification', commit: b.COMMIT, blob: b.EXPECTED_PRODUCTION_BLOB, evaluatorRevision: REVISION, passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
