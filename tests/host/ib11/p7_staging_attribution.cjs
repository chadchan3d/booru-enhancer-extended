'use strict';
// IB11-P7 attribution diagnostic for the closed P1-P6 regressions. V-D7 makes
// an image card open on its sample placeholder, so those suites' assertions
// that the opened media IS the original file, or that one error event on the
// opened media is THE target failure, no longer model the current lifecycle.
// This runs each closed suite unmodified twice:
//   as-is    - against the working-tree production (staging active);
//   neutral  - against the same production with the staging disabled (no
//              placeholder at open; enrichment upgrades swap directly):
//              p7_neutral_staging_preload.cjs.
// Attribution holds when every neutral run passes completely (for the E0
// characterization: when its neutral failures are exactly the set already
// known before P7), i.e. each additional as-is failure is caused by the
// staging source rule alone. The suites' historical result files are
// restored byte for byte after each run.
// Usage: node tests/host/ib11/p7_staging_attribution.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SUITES = [
  ['p1_native_link', 'p1-native-link-result.json'],
  ['p2_vd1_failure_durable', 'p2-vd1-failure-durable-result.json'],
  ['p3_vd5_modifier_guard', 'p3-vd5-modifier-guard-result.json'],
  ['p4_vd6a_takeover_safe', 'p4-vd6a-takeover-safe-result.json'],
  ['p5_vd6b_inviewer_failure', 'p5-vd6b-inviewer-failure-result.json'],
  ['p6_vd4_rotated_fit', 'p6-vd4-rotated-fit-result.json'],
  // E0: before P7 (at 39a5ae1) it already failed exactly S0 (pin) and the
  // repaired witnesses A5, A6, C3, E5, G2.
  ['viewer_baseline', 'viewer-baseline-result.json', ['S0', 'A5', 'A6', 'C3', 'E5', 'G2']],
];
const PRELOAD = path.join(__dirname, 'p7_neutral_staging_preload.cjs');
const run = (suite, neutral) => {
  let out = '';
  try { out = execFileSync(process.execPath, [...(neutral ? ['-r', PRELOAD] : []), path.join(__dirname, `${suite}.cjs`)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stdout || ''); }
  const m = /(\d+)\/(\d+) checks passed/.exec(out);
  const failed = out.split('\n').filter((l) => l.startsWith('FAIL')).map((l) => l.slice(6, 6 + l.slice(6).search(/ {2}\[| {2}-- |$/)));
  return { passed: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, failed };
};

const results = [];
const idOf = (f) => f.split(' ')[0];
for (const [suite, resultFile, known] of SUITES) {
  const rf = path.join(__dirname, resultFile); const saved = fs.readFileSync(rf);
  try {
    const asIs = run(suite, false); const neutral = run(suite, true);
    const attributed = neutral.passed !== null && (known ? neutral.failed.map(idOf).sort().join() === [...known].sort().join() : neutral.passed === neutral.total);
    results.push({ suite, asIs, neutral, knownBeforeP7: known || [], stagingAttributed: asIs.failed.filter((f) => !neutral.failed.includes(f)), attributed });
  } finally { fs.writeFileSync(rf, saved); }
}
for (const r of results) {
  console.log(`${r.attributed ? 'PASS' : 'FAIL'}  ${r.suite}: as-is ${r.asIs.passed}/${r.asIs.total}, staging neutralized ${r.neutral.passed}/${r.neutral.total}${r.knownBeforeP7.length ? ` (neutral failures = known pre-P7 set ${r.knownBeforeP7.join(', ')})` : ''}`);
  for (const f of r.stagingAttributed) console.log(`        staging-attributed: ${f}`);
  for (const f of r.neutral.failed) console.log(`        also fails neutralized (pre-P7): ${f}`);
}
const ok = results.every((r) => r.attributed);
console.log(`\n${results.filter((r) => r.attributed).length}/${results.length} suites: every as-is failure beyond the pre-P7 set is attributed to the staging source rule`);
fs.writeFileSync(path.join(__dirname, 'p7-staging-attribution-result.json'), `${JSON.stringify({ probe: 'ib11-p7-staging-attribution', results }, null, 1)}\n`);
process.exitCode = ok ? 0 : 1;
