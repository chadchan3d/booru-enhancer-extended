'use strict';
// Evaluates an IB12-P1 result (tests/results/ib12-p1-e621-tier0.json): the same A ->
// distant C -> Escape flow as E1, on the P1 production.
//   valid run: the E1 validity rules (identity MATCH, e621.net /posts logged out,
//     complete, Escape close, C != A and entirely outside the original viewport, no
//     probe error, no input after close);
//   P1 TIER0 QUALIFIED: C stays connected and focused (its native origin) at every
//     post-close snapshot; C is usefully visible (visible fraction >= 0.5) from the
//     first snapshot to 1000 ms; exactly one scrollIntoView call, made after close on
//     C's origin, none while the viewer was open; scrollY changed at close and then
//     stayed fixed (sync = frame = 250 ms = 1000 ms: no repeated correction); the
//     page did not scroll while the viewer was open (before close = start);
//   otherwise NOT QUALIFIED / INVALID with reasons.
// Usage: node evaluate_ib12_p1.cjs <result.json>
const fs = require('fs');
const e1 = require('./evaluate_ib12_e1.cjs');

function evaluate(doc) {
  const out = { kind: 'ib12-p1-e621-tier0', verdict: 'INVALID', reasons: [], facts: {} };
  if (!doc || doc.probe !== 'ib12-p1-e621-tier0') { out.reasons.push('not an ib12-p1-e621-tier0 result'); return out; }
  const base = e1.evaluate({ ...doc, probe: 'ib12-e1-e621-tier0' });
  if (base.verdict === 'INVALID') { out.reasons = base.reasons; return out; }
  const snaps = doc.afterClose || []; const calls = doc.scrollIntoViewCalls || [];
  const vis = snaps.map((s) => (s.cVisibility ? s.cVisibility.visibleFraction : 0));
  const ys = snaps.map((s) => s.scrollY);
  const f = {
    aOrdinal: doc.A.ordinal, cOrdinal: doc.C.ordinal, viewerSteps: doc.C.steps,
    startScrollY: doc.startScrollY, scrollYBeforeClose: doc.beforeClose.scrollY, scrollYAfter: snaps.map((s) => `${s.label}:${s.scrollY}`),
    cVisibleFractions: snaps.map((s, i) => `${s.label}:${vis[i]}`),
    cConnected: snaps.every((s) => s.cConnected),
    focusOnCOrigin: snaps.every((s) => s.focus && s.focus.isCOrigin && s.focus.insideC),
    scrollIntoViewCalls: calls.length, callsWhileOpen: calls.filter((c) => c.viewerOpen).length,
    scrollEventsAfterClose: doc.scrollEventsAfterClose, runtime: doc.runtime,
  };
  out.facts = f;
  const fail = (m) => out.reasons.push(m);
  if (!f.cConnected) fail('C did not stay connected');
  if (!f.focusOnCOrigin) fail('focus did not return to C\'s native origin');
  if (!vis.every((v) => v >= e1.USEFUL_VISIBLE)) fail('C was not usefully visible at every post-close snapshot');
  if (calls.length !== 1 || f.callsWhileOpen !== 0 || !calls[0].isCOrigin) fail(`expected exactly one close-time scrollIntoView on C's origin (got ${calls.length}, ${f.callsWhileOpen} while open)`);
  if (doc.beforeClose.scrollY !== doc.startScrollY) fail('the page scrolled while the viewer was open');
  if (ys[0] === doc.beforeClose.scrollY) fail('no correction at close');
  if (!ys.every((y) => y === ys[0])) fail('scrollY moved again after the close-time correction');
  out.verdict = out.reasons.length ? 'NOT QUALIFIED' : 'P1 TIER0 QUALIFIED';
  return out;
}

module.exports = { evaluate };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node evaluate_ib12_p1.cjs <result.json>'); process.exit(2); }
  const r = evaluate(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(JSON.stringify(r, null, 2));
  process.exitCode = r.verdict === 'P1 TIER0 QUALIFIED' ? 0 : 1;
}
