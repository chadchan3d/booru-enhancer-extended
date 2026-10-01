'use strict';
// IB10 V3-R analysis. Per cell: the first hover of A and the revisit of A, with
// element readiness (relative to each element's own source assignment) kept
// apart from the server's request/byte log for card A (aligned on the client
// clock). Only requests that start on the cell's own page are used (a re-run of
// a cell reuses its token). Revisit classification, from the server log only:
//   NO_NEW_REQUEST     - no request for A started at/after the revisit enter;
//   VALIDATED_304      - a revisit request was answered 304;
//   RESTART_FROM_ZERO  - a revisit request started at byte 0 (or got a 200 full
//                        body) and re-sent bytes already sent before the revisit;
//   PARTIAL_REFETCH    - a revisit request started later than 0 but still re-sent
//                        bytes already sent before the revisit;
//   RESUME             - revisit requests only fetched bytes not sent before.
// Paired comparison: AS-IS vs RELEASE for each cache x container x gap.
// Usage: node analyze_ib10_v3r.cjs <results.json> [--json out.json]
const fs = require('fs');

const at = (writes, tc) => { let b = 0; for (const [t, cum] of writes) { if (t <= tc) b = cum; else break; } return b; };
function overlap(a, b) { let n = 0; for (const [s1, e1] of a) for (const [s2, e2] of b) n += Math.max(0, Math.min(e1, e2) - Math.max(s1, s2)); return n; }

function analyzeCell(run) {
  const c = run.client || {};
  const origin = c.timeOrigin || 0;
  const toC = (e) => (e == null ? null : Math.round(e - origin));
  const marks = c.marks || [];
  const m = (what, phase) => marks.find((x) => x.what === what && (!phase || x.phase === phase));
  const enter1 = m('enter', 'first'); const leave1 = m('leave', 'first'); const enter2 = m('enter', 'revisit'); const leaveB = m('leave', 'pass'); const enterB = m('enter', 'pass');
  const T = { enter1: enter1?.t ?? null, leave1: leave1?.t ?? null, enter2: enter2?.t ?? null };
  const hoverA = (c.videos || []).filter((v) => v.owner === 'hover' && v.label === 'A');
  const first = hoverA.find((v) => T.enter2 == null || v.created < T.enter2) || null;
  const revisit = hoverA.find((v) => T.enter2 != null && v.created >= T.enter2) || null;
  const evT = (v, name) => { const e = v && v.ev.find((x) => x[1] === name); return e ? e[0] : null; };
  const srcT = (v) => { const x = v && v.calls.find((y) => y[1] === 'src'); return x ? x[0] : null; };
  const rel = (v, t) => (t == null || srcT(v) == null ? null : t - srcT(v));
  const stateAt = (v, tc) => { let s = null; for (const x of (v ? v.states : [])) { if (x[0] <= tc) s = x; else break; } return s; };
  const elInfo = (v) => (v ? {
    srcAssignAfterEnterMs: srcT(v) != null ? srcT(v) - (v === first ? T.enter1 : T.enter2) : null,
    loadedmetadataMs: rel(v, evT(v, 'loadedmetadata')), loadeddataMs: rel(v, evT(v, 'loadeddata')), canplayMs: rel(v, evT(v, 'canplay')), playingMs: rel(v, evT(v, 'playing')), firstFrameMs: rel(v, v.firstFrame),
  } : null);
  const sLeave = stateAt(first, T.leave1);
  const sAtRevisit = stateAt(first, T.enter2);
  const reqsAll = (run.requests || []).filter((r) => r.t0 >= origin).map((r) => ({ ...r, t0c: toC(r.t0), tEndc: toC(r.tEnd), writesc: r.writes.map(([t, b]) => [toC(t), b]) }));
  const A = reqsAll.filter((r) => r.card === 'A');
  const firstPhase = A.filter((r) => T.enter2 == null || r.t0c < T.enter2);
  const revisitPhase = A.filter((r) => T.enter2 != null && r.t0c >= T.enter2);
  const ranges = (rs, until = Infinity) => rs.map((r) => [r.rangeStart || 0, (r.rangeStart || 0) + at(r.writesc, until)]);
  const sentBeforeRevisit = ranges(firstPhase, T.enter2 ?? Infinity);
  const firstLeave = {
    requests: firstPhase.length,
    activeAtLeave: firstPhase.filter((r) => r.t0c <= T.leave1 && (r.end === 'open-at-run-end' || (r.tEndc != null && r.tEndc > T.leave1))).length,
    bytesBeforeLeave: firstPhase.reduce((n, r) => n + at(r.writesc, T.leave1), 0),
    bytesLeaveToRevisit: firstPhase.reduce((n, r) => n + at(r.writesc, T.enter2 ?? Infinity) - at(r.writesc, T.leave1), 0),
    endAfterLeaveMs: firstPhase.filter((r) => r.tEndc != null && r.tEndc > T.leave1).map((r) => `${r.end}@${r.tEndc - T.leave1}`),
    stillOpenAtRevisit: firstPhase.filter((r) => r.end === 'open-at-run-end' || (r.tEndc != null && T.enter2 != null && r.tEndc > T.enter2)).length,
    elementAtLeave: sLeave && { connected: sLeave[1], inHover: sLeave[2], holdsSrc: sLeave[3], networkState: sLeave[4], readyState: sLeave[5], bufferedEnd: sLeave[6] },
    elementAtRevisit: sAtRevisit && { connected: sAtRevisit[1], holdsSrc: sAtRevisit[3], networkState: sAtRevisit[4], bufferedEnd: sAtRevisit[6] },
    releasedAtLeave: !!first && first.calls.some((x) => x[1] === 'removeSrc' && Math.abs(x[0] - T.leave1) <= 5),
  };
  const rLoaded = revisit && evT(revisit, 'loadeddata'); const rFrame = revisit && revisit.firstFrame;
  const revisitReqs = revisitPhase.map((r) => ({ t0FromRevisit: r.t0c - T.enter2, range: r.req.range, ifRange: !!r.req.ifRange, ifNoneMatch: !!r.req.ifNoneMatch, ifModifiedSince: !!r.req.ifModifiedSince,
    status: r.status, rangeStart: r.rangeStart ?? null, bytesSent: r.bytesSent, end: r.end, endFromRevisit: r.tEndc != null ? r.tEndc - T.enter2 : null }));
  const refetched = overlap(sentBeforeRevisit, ranges(revisitPhase));
  let cls = 'NO_NEW_REQUEST';
  if (revisitPhase.length) {
    if (revisitPhase.some((r) => r.status === 304)) cls = 'VALIDATED_304';
    else if (refetched > 0) cls = revisitPhase.some((r) => (r.rangeStart || 0) === 0 || r.status === 200) ? 'RESTART_FROM_ZERO' : 'PARTIAL_REFETCH';
    else cls = 'RESUME';
  }
  const bytesBy = (tc) => (tc == null ? null : revisitPhase.reduce((n, r) => n + at(r.writesc, tc), 0));
  return {
    cell: run.cell, identity: c.identity, contaminated: (c.trustedPointerEvents || 0) > 0, error: c.error || null,
    timing: { holdAfterReadyMs: leave1 && m('ready', 'first') ? leave1.t - m('ready', 'first').t : null, bPassMs: leaveB && enterB ? leaveB.t - enterB.t : null, actualGapMs: T.enter2 != null && T.leave1 != null ? T.enter2 - T.leave1 : null },
    first: elInfo(first), revisit: elInfo(revisit), hoverElementsA: hoverA.length,
    firstLeave,
    revisitTransport: { classification: cls, newRequests: revisitPhase.length, requests: revisitReqs, refetchedBytes: refetched, bytesBeforeRevisitLoadeddata: bytesBy(rLoaded), bytesBeforeRevisitFirstFrame: bytesBy(rFrame) },
    bRequests: reqsAll.filter((r) => r.card === 'B').map((r) => ({ status: r.status, bytesSent: r.bytesSent, end: r.end })),
  };
}

function analyze(doc) {
  const cells = doc.runs.filter((r) => !((r.client || {}).trustedPointerEvents > 0)).map(analyzeCell);
  const key = (c) => `${c.cell.cache}|${c.cell.container}|${c.cell.gap}`;
  const pairs = {};
  for (const c of cells) (pairs[key(c)] = pairs[key(c)] || {})[c.cell.variant] = c;
  const comparison = Object.fromEntries(Object.entries(pairs).map(([k, p]) => {
    const a = p.ASIS; const r = p.RELEASE;
    const d = (f) => (a && r && a.revisit && r.revisit && a.revisit[f] != null && r.revisit[f] != null ? r.revisit[f] - a.revisit[f] : null);
    return [k, {
      readinessDeltaMs: d('loadeddataMs'), firstFrameDeltaMs: d('firstFrameMs'),
      asis: a && { revisitLoadeddataMs: a.revisit?.loadeddataMs ?? null, revisitFirstFrameMs: a.revisit?.firstFrameMs ?? null, firstColdLoadeddataMs: a.first?.loadeddataMs ?? null, classification: a.revisitTransport.classification, refetchedBytes: a.revisitTransport.refetchedBytes, firstTransferStillOpenAtRevisit: a.firstLeave.stillOpenAtRevisit, bytesLeaveToRevisit: a.firstLeave.bytesLeaveToRevisit },
      release: r && { revisitLoadeddataMs: r.revisit?.loadeddataMs ?? null, revisitFirstFrameMs: r.revisit?.firstFrameMs ?? null, firstColdLoadeddataMs: r.first?.loadeddataMs ?? null, classification: r.revisitTransport.classification, refetchedBytes: r.revisitTransport.refetchedBytes, releasedAtLeave: r.firstLeave.releasedAtLeave, firstTransferStillOpenAtRevisit: r.firstLeave.stillOpenAtRevisit, bytesLeaveToRevisit: r.firstLeave.bytesLeaveToRevisit, endAfterLeaveMs: r.firstLeave.endAfterLeaveMs },
      releaseNewRequestWhereAsisHadNone: !!(a && r && a.revisitTransport.newRequests === 0 && r.revisitTransport.newRequests > 0),
    }];
  }));
  return { media: doc.media, throttleBytesPerSecond: doc.throttleBytesPerSecond, cells, comparison, missingPairs: Object.entries(pairs).filter(([, p]) => !p.ASIS || !p.RELEASE).map(([k]) => k) };
}

module.exports = { analyze, analyzeCell };

if (require.main === module) {
  const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const a = analyze(doc);
  const i = process.argv.indexOf('--json');
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(a, null, 1) + '\n');
  for (const [k, v] of Object.entries(a.comparison)) console.log(k.padEnd(24), JSON.stringify(v));
  if (a.missingPairs.length) console.log('missing pairs:', a.missingPairs.join(', '));
}
