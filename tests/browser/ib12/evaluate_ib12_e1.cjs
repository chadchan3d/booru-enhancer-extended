'use strict';
// Evaluates an IB12-E1 result (tests/results/ib12-e1-e621-tier0.json) against the
// assignment's decision rule for G-PLACE-T(e621, Tier 0), E stage:
//   valid run: identity MATCH, e621.net /posts logged out, complete, Escape close,
//     viewer navigation reached a card C other than the first-opened card A, C was
//     entirely outside the original viewport (the one at the first open), no probe
//     error, and no operator input during the 1000 ms after close;
//   PREMISE ESTABLISHED (-> E PASS): C stays connected; focus returns to C's native
//     origin; scrollY stays within 2 px of its value before close (at every
//     post-close snapshot); C stays substantially outside the view (visible
//     fraction < 0.5 at 1000 ms);
//   BROWSER BRINGS C INTO VIEW: a valid run in which C ends >= 0.5 visible or the
//     page scrolled toward C - record the fact and stop (no repair premise);
//   otherwise NOT ESTABLISHED / INVALID with the reasons.
// Usage: node evaluate_ib12_e1.cjs <result.json>
const fs = require('fs');

const SCROLL_TOLERANCE_PX = 2;
const USEFUL_VISIBLE = 0.5;

function evaluate(doc) {
  const out = { kind: 'ib12-e1-e621-tier0', verdict: 'INVALID', reasons: [], facts: {} };
  const fail = (m) => out.reasons.push(m);
  if (!doc || doc.probe !== 'ib12-e1-e621-tier0') { fail('not an ib12-e1-e621-tier0 result'); return out; }
  if (doc.sanitationGuard) { fail('the result was withheld by the sanitation guard'); return out; }
  if (doc.production_body_identity !== 'MATCH_EXPECTED_ARTIFACT') fail(`production identity ${doc.production_body_identity}`);
  if (doc.site !== 'e621.net' || doc.route !== '/posts') fail('not an e621.net /posts listing');
  if (doc.loggedOut !== true) fail('not logged out');
  if (!doc.complete) fail('the run did not complete');
  if ((doc.probeErrors || []).length) fail(`probe errors: ${doc.probeErrors.map((e) => e.where).join(', ')}`);
  if (!doc.close || doc.close.via !== 'Escape') fail('the viewer was not closed with Escape');
  const opens = doc.opens || [];
  if (opens.length < 2 || !doc.C || doc.C.ordinal === doc.A?.ordinal || doc.C.ordinal < 0) fail('viewer navigation did not reach a different card C');
  if (!doc.cOutsideOriginalViewport) fail('C was not entirely outside the original viewport');
  if (doc.inputAfterClose > 0) fail('operator input during the post-close observation');
  const snaps = doc.afterClose || [];
  const last = snaps.find((s) => s.label === '1000ms');
  if (!doc.beforeClose || !last || snaps.length < 3) fail('missing before/after-close snapshots');
  if (out.reasons.length) return out;

  const dY = snaps.map((s) => Math.abs(s.scrollY - doc.beforeClose.scrollY));
  const facts = {
    aOrdinal: doc.A.ordinal, cOrdinal: doc.C.ordinal, viewerSteps: doc.C.steps, firstOpenWasA: doc.firstOpenWasA,
    scrollYBeforeClose: doc.beforeClose.scrollY, scrollYAfter: snaps.map((s) => `${s.label}:${s.scrollY}`),
    maxScrollChangePx: Math.max(...dY),
    cConnected: snaps.every((s) => s.cConnected),
    focusOnCOrigin: snaps.every((s) => s.focus && s.focus.isCOrigin && s.focus.insideC),
    cVisibleFractionAt1000: last.cVisibility ? last.cVisibility.visibleFraction : null,
    cViewTopAt1000: last.cVisibility ? last.cVisibility.viewTop : null,
    viewportHeight: doc.viewport && doc.viewport.h,
    runtime: doc.runtime,
  };
  out.facts = facts;
  if (!facts.cConnected) fail('C did not stay connected');
  if (!facts.focusOnCOrigin) fail('focus did not return to C\'s native origin');
  if (out.reasons.length) { out.verdict = 'NOT ESTABLISHED'; return out; }
  const stayed = facts.maxScrollChangePx <= SCROLL_TOLERANCE_PX;
  const outOfView = facts.cVisibleFractionAt1000 !== null && facts.cVisibleFractionAt1000 < USEFUL_VISIBLE;
  if (stayed && outOfView) out.verdict = 'PREMISE ESTABLISHED';
  else { out.verdict = 'BROWSER BRINGS C INTO VIEW'; out.reasons.push(stayed ? 'C ended usefully visible without a page scroll' : `the page scrolled ${facts.maxScrollChangePx}px after close`); }
  return out;
}

module.exports = { evaluate, SCROLL_TOLERANCE_PX, USEFUL_VISIBLE };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node evaluate_ib12_e1.cjs <result.json>'); process.exit(2); }
  const r = evaluate(JSON.parse(fs.readFileSync(file, 'utf8')));
  console.log(JSON.stringify(r, null, 2));
  process.exitCode = r.verdict === 'PREMISE ESTABLISHED' ? 0 : 1;
}
