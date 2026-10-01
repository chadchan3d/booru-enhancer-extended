'use strict';
// IB10 V3-C clean-cell selection (applied before analyze_ib10_v3c.cjs).
// The server attaches every request for a run token to each result posted for
// that token, so a rerun of a contaminated or abandoned attempt (same token)
// also lists the earlier attempt's requests. Rule, deterministic:
//   1. drop results with trusted pointer events > 0, an identity other than
//      MATCH_EXPECTED_ARTIFACT, or a runner error;
//   2. in each kept result, keep only requests that started at or after that
//      page's own performance.timeOrigin (the earlier attempts' requests are
//      negative on this page's clock);
//   3. require exactly one kept result per scenario x container x transport.
// Usage: node select_clean_ib10_v3c.cjs <results.json> <clean.json> [<all-rebased.json>]
const fs = require('fs');
const { SCENARIOS, CONTAINERS, TRANSPORTS } = require('./v3c_server.cjs');

function select(doc) {
  const dropped = [];
  const kept = [];
  for (const r of doc.runs) {
    const c = r.client || {};
    const why = (c.trustedPointerEvents || 0) > 0 ? `contaminated (${c.trustedPointerEvents} trusted pointer events)` : (c.identity !== 'MATCH_EXPECTED_ARTIFACT' ? `identity ${c.identity}` : (c.error ? `error ${c.error}` : null));
    if (why) { dropped.push({ ...r.run, why }); continue; }
    const own = r.requests.filter((q) => q.t0 >= c.timeOrigin);
    kept.push({ ...r, requests: own, excludedEarlierAttemptRequests: r.requests.length - own.length });
  }
  const key = (x) => `${x.transport}|${x.container}|${x.scenario}`;
  const cells = new Map();
  for (const r of kept) { const k = key(r.run); cells.set(k, (cells.get(k) || 0) + 1); }
  const expected = TRANSPORTS.flatMap((t) => CONTAINERS.flatMap((c) => SCENARIOS.map((s) => `${t}|${c}|${s}`)));
  const missing = expected.filter((k) => !cells.has(k));
  const duplicated = [...cells].filter(([, n]) => n > 1).map(([k]) => k);
  return { doc: { ...doc, runs: kept }, report: { entries: doc.runs.length, dropped, kept: kept.length, expectedCells: expected.length, missing, duplicated,
    excludedEarlierAttemptRequests: kept.filter((r) => r.excludedEarlierAttemptRequests).map((r) => ({ ...r.run, n: r.excludedEarlierAttemptRequests })) } };
}

// Sanitation: rebase every absolute time to the run's own page time origin (ms),
// so the committed evidence carries no wall-clock timestamps. Relative timing,
// and therefore the analysis, is unchanged.
function rebase(doc) {
  return { ...doc, runs: doc.runs.map((r) => {
    const o = (r.client && r.client.timeOrigin) || 0;
    const rel = (x) => (x == null ? x : Math.round((x - o) * 10) / 10);
    const { tPost, ...rest } = r;
    return { ...rest, tPostRel: rel(tPost), client: r.client && { ...r.client, timeOrigin: 0 },
      requests: r.requests.map((q) => ({ ...q, t0: rel(q.t0), tEnd: rel(q.tEnd), writes: q.writes.map(([t, b]) => [rel(t), b]) })) };
  }) };
}

module.exports = { select, rebase };

if (require.main === module) {
  const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const { doc: clean, report } = select(doc);
  console.log(JSON.stringify(report, null, 1));
  if (report.missing.length || report.duplicated.length) { console.error('clean selection incomplete'); process.exitCode = 1; }
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(rebase(clean), null, 1) + '\n');
  if (process.argv[4]) fs.writeFileSync(process.argv[4], JSON.stringify(rebase(doc), null, 1) + '\n'); // all entries, rebased (provenance)
}
