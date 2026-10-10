'use strict';
// Evaluates an IB12-E2 result (tests/results/ib12-e2-rule34.json) and classifies it
// into the assignment's product cases. Observation only: no verdict here passes a
// gate; the designer decides.
//   valid run: identity MATCH; rule34.xxx; complete; no probe error; at least two
//     appended native batches; C from the second, with a later pid; C usefully
//     visible when leaving each time; both returns observed with no operator input
//     during their 1.5 s observation; the page check ran.
//   a return is "useful" when C is connected and >= 0.5 visible at 1500 ms.
//   FRESH BACK NOT ACHIEVED: the second return was not a confirmed fresh load
//     (pageshow.persisted false AND navigation type back_forward) - record and stop.
//   CASE A: both returns useful (native behaviour sufficient).
//   CASE B: the normal return useful, the fresh return not, and C is on its observed
//     native page.
//   CASE C: the fresh return not useful and C is not on its observed native page.
//   OTHER: any other combination (facts listed for the designer).
// Usage: node evaluate_ib12_e2.cjs <result.json>
const fs = require('fs');

const USEFUL = 0.5;
const lastSnap = (r) => (r && r.snaps && r.snaps.length ? r.snaps[r.snaps.length - 1] : null);
const useful = (r) => { const s = lastSnap(r); return !!s && s.cConnected && !!s.c && s.c.visibleFraction >= USEFUL; };

function evaluate(doc) {
  const out = { kind: 'ib12-e2-rule34', verdict: 'INVALID', reasons: [], facts: {} };
  const fail = (m) => out.reasons.push(m);
  if (!doc || doc.probe !== 'ib12-e2-rule34') { fail('not an ib12-e2-rule34 result'); return out; }
  if (doc.sanitationGuard) { fail('the result was withheld by the sanitation guard'); return out; }
  if (doc.production_body_identity !== 'MATCH_EXPECTED_ARTIFACT') fail(`production identity ${doc.production_body_identity}`);
  if (doc.site !== 'rule34.xxx') fail('not rule34.xxx');
  if (!doc.complete) fail('the run did not complete');
  if ((doc.probeErrors || []).length) fail(`probe errors: ${doc.probeErrors.map((e) => e.where).join(', ')}`);
  const batches = (doc.batches || []).filter((b) => b.inserted > 0);
  if (batches.length < 2) fail('fewer than two appended native batches');
  if (!doc.C || !doc.C.laterThanFirstBatch) fail('C is not from a later native page than the first batch');
  for (const k of ['leave1', 'leave2']) if (!doc[k] || !doc[k].c || doc[k].c.visibleFraction < USEFUL) fail(`C was not usefully visible at ${k}`);
  for (const k of ['back1', 'back2']) { if (!lastSnap(doc[k])) fail(`${k} not observed`); else if (doc[k].inputAfterReturn > 0) fail(`operator input during ${k}`); }
  if (!doc.pageCheck) fail('the native page check did not run');
  if (out.reasons.length) return out;

  const f = (r, leave) => { const s = lastSnap(r); return {
    persisted: r.persisted, navigationType: r.navigationType, notRestoredReasons: r.notRestoredReasons,
    cConnected: s.cConnected, cVisibleFraction: s.c ? s.c.visibleFraction : null, scrollYLeave: leave.scrollY, scrollYAfter: s.scrollY,
    cardCount: s.cardCount, appendedCardsPresent: s.appendedCardsPresent, listingRequestsAfterReturn: r.listingRequestsAfterReturn, listingPidsAfterReturn: r.listingPidsAfterReturn,
    otherEnhancerRequestsAfterReturn: r.otherEnhancerRequestsAfterReturn, historyStateUnchanged: r.historyStateUnchanged, useful: useful(r) }; };
  out.facts = {
    startPid: doc.start.pid, startCardCount: doc.start.cardCount, batches: batches.map((b) => ({ pid: b.pid, inserted: b.inserted, ordinals: `${b.ordinalFrom}-${b.ordinalTo}`, sameRoute: b.sameRoute })),
    C: doc.C, normalBack: f(doc.back1, doc.leave1), freshBack: { ...f(doc.back2, doc.leave2), freshLoadConfirmed: !!doc.back2.freshLoadConfirmed, armed: doc.freshArm },
    pageCheck: doc.pageCheck, runtime: doc.runtime,
  };
  const pc = doc.pageCheck;
  const earlierPids = batches.filter((b) => b.pid < doc.C.batchPid).map((b) => b.pid);
  out.facts.freshBack.reconstructionRequests = (doc.back2.listingPidsAfterReturn || []).filter((p) => earlierPids.includes(p) || p === doc.start.pid).length;
  if (!doc.back2.freshLoadConfirmed) { out.verdict = 'FRESH BACK NOT ACHIEVED'; out.reasons.push('the probe-only BFCache-ineligibility did not produce a confirmed fresh back/forward load; record and stop'); return out; }
  const u1 = useful(doc.back1); const u2 = useful(doc.back2);
  if (u1 && u2) out.verdict = 'CASE A';
  else if (u1 && !u2 && pc.cOnPage) out.verdict = 'CASE B';
  else if (!u2 && !pc.cOnPage) out.verdict = 'CASE C';
  else out.verdict = 'OTHER';
  return out;
}

module.exports = { evaluate, USEFUL };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node evaluate_ib12_e2.cjs <result.json>'); process.exit(2); }
  const r = evaluate(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(JSON.stringify(r, null, 2));
  process.exitCode = r.verdict === 'INVALID' ? 1 : 0;
}
