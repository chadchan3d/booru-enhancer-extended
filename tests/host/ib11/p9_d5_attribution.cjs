'use strict';
// IB11-P9 attribution diagnostic. Each closed suite (P1-P8 regressions and the
// E0 characterization) runs unmodified twice: as-is, and with only the P9
// type-change view transfer disabled (p9_neutral_d5_preload.cjs). Attribution
// holds when the neutral failures are exactly the failure sets recorded at P8
// (P7 staging- and P8 focus-attributed, pins and repaired witnesses) and the
// only as-is change is E0 D5 (the repaired finding). Historical result files
// are restored byte for byte.
// Usage: node tests/host/ib11/p9_d5_attribution.cjs
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const P8_ERA = {
  p1_native_link: ['P1-1', 'P1-2', 'P1-3', 'P1-4', 'P1-6'],
  p2_vd1_failure_durable: ['P2-1', 'P2-2', 'P2-3', 'P2-6', 'P2-11'],
  p3_vd5_modifier_guard: ['P3-14', 'P3-15', 'P3-16'],
  p4_vd6a_takeover_safe: ['P4-4', 'P4-10', 'P4-11', 'P4-15'],
  p5_vd6b_inviewer_failure: ['P5-1', 'P5-6', 'P5-10', 'P5-11', 'P5-15'],
  p6_vd4_rotated_fit: [],
  p7_vd7_staged_placeholder: ['P7-23'],
  p8_focus_ownership: [],
  viewer_baseline: ['S0', 'A1', 'A5', 'A6', 'B1', 'C1', 'C3', 'D1', 'E3', 'E5', 'F2', 'G2'],
};
const P9_ATTRIBUTED = { viewer_baseline: ['D5'] };
const RESULT = {
  p1_native_link: 'p1-native-link-result.json', p2_vd1_failure_durable: 'p2-vd1-failure-durable-result.json', p3_vd5_modifier_guard: 'p3-vd5-modifier-guard-result.json',
  p4_vd6a_takeover_safe: 'p4-vd6a-takeover-safe-result.json', p5_vd6b_inviewer_failure: 'p5-vd6b-inviewer-failure-result.json', p6_vd4_rotated_fit: 'p6-vd4-rotated-fit-result.json',
  p7_vd7_staged_placeholder: 'p7-vd7-staged-placeholder-result.json', p8_focus_ownership: 'p8-focus-ownership-result.json', viewer_baseline: 'viewer-baseline-result.json',
};
const PRE = path.join(__dirname, 'p9_neutral_d5_preload.cjs');
const idOf = (f) => f.split(' ')[0];
const run = (suite, neutral) => {
  let out = '';
  try { out = execFileSync(process.execPath, [...(neutral ? ['-r', PRE] : []), path.join(__dirname, `${suite}.cjs`)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { out = String(e.stdout || ''); }
  const m = /(\d+)\/(\d+) checks passed/.exec(out);
  return { passed: m ? Number(m[1]) : null, total: m ? Number(m[2]) : null, failed: out.split('\n').filter((l) => l.startsWith('FAIL')).map((l) => idOf(l.slice(6))) };
};
const same = (a, b) => [...a].sort().join() === [...b].sort().join();

const results = [];
for (const suite of Object.keys(P8_ERA)) {
  const rf = path.join(__dirname, RESULT[suite]); const saved = fs.readFileSync(rf);
  try {
    const asIs = run(suite, false); const neutral = run(suite, true);
    const p9Attributed = asIs.failed.filter((f) => !neutral.failed.includes(f));
    const attributed = neutral.passed !== null && same(neutral.failed, P8_ERA[suite]) && same(p9Attributed, P9_ATTRIBUTED[suite] || []) && neutral.failed.every((f) => asIs.failed.includes(f));
    results.push({ suite, asIs, neutral, p9Attributed, attributed });
  } finally { fs.writeFileSync(rf, saved); }
}
for (const r of results) console.log(`${r.attributed ? 'PASS' : 'FAIL'}  ${r.suite}: as-is ${r.asIs.passed}/${r.asIs.total}, P9 neutralized ${r.neutral.passed}/${r.neutral.total} (= the P8-era set)${r.p9Attributed.length ? `; P9-attributed: ${r.p9Attributed.join(', ')}` : ''}`);
const ok = results.every((r) => r.attributed);
console.log(`\n${results.filter((r) => r.attributed).length}/${results.length} suites: the only change from the P8-era results is the repaired E0 D5`);
fs.writeFileSync(path.join(__dirname, 'p9-d5-attribution-result.json'), `${JSON.stringify({ probe: 'ib11-p9-d5-attribution', results }, null, 1)}\n`);
process.exitCode = ok ? 0 : 1;
