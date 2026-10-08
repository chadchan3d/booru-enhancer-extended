'use strict';
// IB11-P8 attribution diagnostic for the closed P1-P7 regressions and the E0
// characterization. P8 makes the viewer take focus on open, so checks written
// before the focus item ("opening the viewer moves no focus") no longer hold.
// Each suite runs unmodified three times:
//   as-is        - the working-tree production;
//   focusNeutral - the same with only the P8 focus acquisition disabled
//                  (p8_neutral_focus_preload.cjs);
//   bothNeutral  - P8 focus acquisition AND P7 staging disabled (both preloads).
// Attribution holds when:
//   - bothNeutral passes completely (E0: fails exactly its pre-P7 set), and
//   - the focusNeutral failures are exactly the P7 staging-attributed set
//     already recorded (unchanged), so every additional as-is failure is
//     caused by the P8 focus acquisition alone.
// The suites' historical result files are restored byte for byte.
// Usage: node tests/host/ib11/p8_focus_attribution.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const P7_STAGING = {
  p1_native_link: ['P1-1', 'P1-2', 'P1-3', 'P1-4', 'P1-6'],
  p2_vd1_failure_durable: ['P2-1', 'P2-2', 'P2-3', 'P2-6', 'P2-11'],
  p3_vd5_modifier_guard: ['P3-14', 'P3-15'],
  p4_vd6a_takeover_safe: ['P4-4', 'P4-10', 'P4-11'],
  p5_vd6b_inviewer_failure: ['P5-1', 'P5-6', 'P5-10', 'P5-11'],
  p6_vd4_rotated_fit: [],
  p7_vd7_staged_placeholder: [],
  // E0 with focus neutralized: the pre-P7 set plus the P7 staging-attributed checks
  viewer_baseline: ['S0', 'A5', 'A6', 'C3', 'E5', 'G2', 'A1', 'B1', 'C1', 'D1', 'E3'],
};
const BOTH_NEUTRAL_KNOWN = { viewer_baseline: ['S0', 'A5', 'A6', 'C3', 'E5', 'G2'] };
// The P7 regression builds its mutants from the staging code itself, so it cannot run with staging removed: focus-only neutralization applies.
const BOTH_NEUTRAL_NA = new Set(['p7_vd7_staged_placeholder']);
const RESULT = {
  p1_native_link: 'p1-native-link-result.json', p2_vd1_failure_durable: 'p2-vd1-failure-durable-result.json', p3_vd5_modifier_guard: 'p3-vd5-modifier-guard-result.json',
  p4_vd6a_takeover_safe: 'p4-vd6a-takeover-safe-result.json', p5_vd6b_inviewer_failure: 'p5-vd6b-inviewer-failure-result.json', p6_vd4_rotated_fit: 'p6-vd4-rotated-fit-result.json',
  p7_vd7_staged_placeholder: 'p7-vd7-staged-placeholder-result.json', viewer_baseline: 'viewer-baseline-result.json',
};
const P7PRE = path.join(__dirname, 'p7_neutral_staging_preload.cjs');
const P8PRE = path.join(__dirname, 'p8_neutral_focus_preload.cjs');
const idOf = (f) => f.split(' ')[0];
const run = (suite, pre) => {
  let out = '';
  try { out = execFileSync(process.execPath, [...pre.flatMap((p) => ['-r', p]), path.join(__dirname, `${suite}.cjs`)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stdout || ''); }
  const m = /(\d+)\/(\d+) checks passed/.exec(out);
  const failed = out.split('\n').filter((l) => l.startsWith('FAIL')).map((l) => l.slice(6, 6 + l.slice(6).search(/ {2}\[| {2}-- |$/)));
  return { passed: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, failed };
};
const same = (a, b) => [...a].sort().join() === [...b].sort().join();

const results = [];
for (const suite of Object.keys(P7_STAGING)) {
  const rf = path.join(__dirname, RESULT[suite]); const saved = fs.readFileSync(rf);
  try {
    const asIs = run(suite, []); const focusNeutral = run(suite, [P8PRE]); const bothNeutral = BOTH_NEUTRAL_NA.has(suite) ? null : run(suite, [P7PRE, P8PRE]);
    const bothOk = bothNeutral === null || bothNeutral.passed !== null && (BOTH_NEUTRAL_KNOWN[suite] ? same(bothNeutral.failed.map(idOf), BOTH_NEUTRAL_KNOWN[suite]) : bothNeutral.passed === bothNeutral.total);
    const stagingUnchanged = focusNeutral.passed !== null && same(focusNeutral.failed.map(idOf), P7_STAGING[suite]);
    const focusAttributed = asIs.failed.filter((f) => !focusNeutral.failed.includes(f));
    results.push({ suite, asIs, focusNeutral, bothNeutral, focusAttributed, attributed: bothOk && stagingUnchanged });
  } finally { fs.writeFileSync(rf, saved); }
}
for (const r of results) {
  console.log(`${r.attributed ? 'PASS' : 'FAIL'}  ${r.suite}: as-is ${r.asIs.passed}/${r.asIs.total}, focus neutralized ${r.focusNeutral.passed}/${r.focusNeutral.total} (= the P7 staging set), focus+staging neutralized ${r.bothNeutral ? `${r.bothNeutral.passed}/${r.bothNeutral.total}` : 'n/a (needs staging)'}`);
  for (const f of r.focusAttributed) console.log(`        focus-attributed: ${f}`);
}
const ok = results.every((r) => r.attributed);
console.log(`\n${results.filter((r) => r.attributed).length}/${results.length} suites: every as-is failure is the recorded P7 staging set or attributed to the P8 focus acquisition`);
fs.writeFileSync(path.join(__dirname, 'p8-focus-attribution-result.json'), `${JSON.stringify({ probe: 'ib11-p8-focus-attribution', results }, null, 1)}\n`);
process.exitCode = ok ? 0 : 1;
