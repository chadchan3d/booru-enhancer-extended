'use strict';
// IB10 V3-C analysis: per run, keeps EVENT state (client: element lifecycle,
// readiness, source removal, detachment, buffered growth) and TRANSPORT state
// (server: requests, bytes handed to the socket, end reason) separate, aligned
// on the client clock (server epoch - performance.timeOrigin). Element-level
// release is never reported as proof that bytes stopped; only the server log is.
// Usage: node analyze_ib10_v3c.cjs <results.json> [--json out.json]
const fs = require('fs');

const WINDOW = 5000;
const at = (writes, tc) => { let b = 0; for (const [t, cum] of writes) { if (t <= tc) b = cum; else break; } return b; };

function analyzeRun(run) {
  const c = run.client || {};
  const origin = c.timeOrigin || 0;
  const toC = (epoch) => (epoch == null ? null : Math.round(epoch - origin));
  const marks = c.marks || [];
  const cleanups = marks.filter((m) => m.what === 'cleanup');
  const firstCleanup = cleanups[0] ? cleanups[0].t : null;
  const lastCleanup = cleanups.length ? cleanups[cleanups.length - 1].t : null;
  const hover = (c.videos || []).filter((v) => v.owner === 'hover');
  const viewer = (c.videos || []).filter((v) => v.owner === 'viewer');
  const evT = (v, name) => { const e = v.ev.find((x) => x[1] === name); return e ? e[0] : null; };
  const callT = (v, name) => v.calls.filter((x) => x[1] === name).map((x) => x[0]);
  const stateAt = (v, tc) => { let s = null; for (const x of v.states) { if (x[0] <= tc) s = x; else break; } return s; };
  // states: [t, connected, inHover, holdsSrc, networkState, readyState, bufferedEnd, paused]
  const holdingAt = (tc) => hover.filter((v) => { const s = stateAt(v, tc); return s && s[3] === 1; }).length;
  const times = [...new Set(hover.flatMap((v) => v.states.map((s) => s[0])))].sort((a, b) => a - b);
  const maxHolding = times.reduce((m, tc) => Math.max(m, holdingAt(tc)), 0);
  const elements = hover.map((v) => {
    const sC = firstCleanup != null ? stateAt(v, firstCleanup) : null;
    const sEnd = v.states[v.states.length - 1] || null;
    return {
      card: v.label, created: v.created, srcSet: callT(v, 'src'), removeSrc: callT(v, 'removeSrc'), load: callT(v, 'load'), pause: callT(v, 'pause'),
      play: v.calls.filter((x) => x[1] === 'play').map((x) => `${x[0]}${x[2] === 'muted' ? '' : ':UNMUTED'}`),
      loadeddata: evT(v, 'loadeddata'), firstFrame: v.firstFrame, abortEv: evT(v, 'abort'), emptied: evT(v, 'emptied'),
      atCleanup: sC && { connected: sC[1], inHover: sC[2], holdsSrc: sC[3], networkState: sC[4], readyState: sC[5], bufferedEnd: sC[6], paused: sC[7] },
      atEnd: sEnd && { connected: sEnd[1], inHover: sEnd[2], holdsSrc: sEnd[3], networkState: sEnd[4], readyState: sEnd[5], bufferedEnd: sEnd[6], paused: sEnd[7] },
      bufferedGrowthAfterCleanup: sC && sEnd ? Math.round((sEnd[6] - sC[6]) * 100) / 100 : null,
    };
  });
  const reqs = (run.requests || []).map((r) => {
    const t0 = toC(r.t0); const tEnd = toC(r.tEnd); const writes = r.writes.map(([t, b]) => [toC(t), b]);
    const o = { id: r.id, card: r.card, t0, range: r.range, status: r.status, contentRange: r.contentRange, length: r.length, bytesSent: r.bytesSent, end: r.end, tEnd };
    if (firstCleanup != null) {
      const C = lastCleanup;
      o.startedAfterCleanup = t0 > C;
      o.completeBeforeCleanup = r.end === 'complete' && tEnd != null && tEnd <= C;
      o.activeAtCleanup = t0 <= C && (r.end === 'open-at-run-end' || (tEnd != null && tEnd > C));
      o.bytesBeforeCleanup = at(writes, C);
      o.bytesInWindowAfterCleanup = at(writes, C + WINDOW) - at(writes, C);
      o.lastWriteAfterCleanupMs = writes.length && writes[writes.length - 1][0] > C ? writes[writes.length - 1][0] - C : null;
      o.endAfterCleanupMs = tEnd != null && tEnd > C ? tEnd - C : null;
    }
    return o;
  });
  const byWhen = (pred) => reqs.filter(pred).reduce((s, r) => s + (r.bytesInWindowAfterCleanup || 0), 0);
  return {
    scenario: run.run.scenario, container: run.run.container, mode: run.run.transport,
    identity: c.identity, contaminated: (c.trustedPointerEvents || 0) > 0, error: c.error || null,
    marks: marks.map((m) => ({ ...m })), cleanupAt: lastCleanup,
    event: { hoverElements: hover.length, viewerElements: viewer.length, maxHoldingSrcSimultaneously: maxHolding, holdingSrcAtEnd: hover.filter((v) => { const s = v.states[v.states.length - 1]; return s && s[3] === 1; }).length, elements },
    transport: {
      requests: reqs,
      requestsActiveAtCleanup: reqs.filter((r) => r.activeAtCleanup).length,
      requestsCompleteBeforeCleanup: reqs.filter((r) => r.completeBeforeCleanup).length,
      bytesAfterCleanupWithin5s: byWhen(() => true),
      requestsStartedAfterCleanup: reqs.filter((r) => r.startedAfterCleanup).length,
      clientAbortsAfterCleanup: reqs.filter((r) => r.end === 'client-abort' && r.endAfterCleanupMs != null).map((r) => r.endAfterCleanupMs),
      openAtRunEnd: reqs.filter((r) => r.end === 'open-at-run-end').length,
    },
  };
}

function analyze(doc) { return { media: doc.media, throttleBytesPerSecond: doc.throttleBytesPerSecond, runs: doc.runs.map(analyzeRun) }; }

module.exports = { analyze, analyzeRun };

if (require.main === module) {
  const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const a = analyze(doc);
  const i = process.argv.indexOf('--json');
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(a, null, 1) + '\n');
  for (const r of a.runs) {
    const t = r.transport; const e = r.event;
    console.log(`${r.mode.padEnd(7)} ${r.container.padEnd(4)} ${r.scenario.padEnd(17)} ${r.identity === 'MATCH_EXPECTED_ARTIFACT' ? 'id-ok' : 'ID-' + r.identity}${r.contaminated ? ' CONTAMINATED' : ''}`
      + ` | hover=${e.hoverElements} maxHold=${e.maxHoldingSrcSimultaneously} holdEnd=${e.holdingSrcAtEnd}`
      + ` | reqs=${t.requests.length} activeAtCleanup=${t.requestsActiveAtCleanup} completeBefore=${t.requestsCompleteBeforeCleanup} bytes+5s=${t.bytesAfterCleanupWithin5s} newAfter=${t.requestsStartedAfterCleanup} aborts=${t.clientAbortsAfterCleanup.join('/')} open=${t.openAtRunEnd}`);
  }
}
