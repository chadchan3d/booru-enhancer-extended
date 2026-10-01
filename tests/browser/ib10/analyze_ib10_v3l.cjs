'use strict';
// IB10 V3-L analysis. Re-classifies every recorded generation with the shared
// classifier (authoritative) and summarizes USABLE generations per host x
// container. Sizes are reported as the observed distribution of exact data-size
// values; no size bands are predefined. DOM/media state and Resource Timing are
// summarized separately; neither is read as proof that transfer stopped.
// Revision 1.1: card ordinals are per session (page load), so distinct cards are
// counted per session; after-ready generations are split into what the element
// state shows (complete at leave / grew after leave / idle partial / loading
// without growth); first versus repeat hovers are split; --aggregate writes a
// sanitized aggregate (no per-generation records, sizes rounded to 0.1 MB,
// resolution classes instead of exact dimensions) suitable for the public record.
// Usage: node analyze_ib10_v3l.cjs <result.json> [<result.json> ...] [--json out.json] [--aggregate out.json]
const fs = require('fs');
const { classify } = require('./v3l_classify.js');

const dist = (xs) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? { n: v.length, min: v[0], median: v[Math.floor((v.length - 1) / 2)], max: v[v.length - 1] } : null; };
const tally = (xs) => xs.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});

function analyze(docs) {
  const all = [];
  const files = [];
  for (const d of docs) {
    files.push({ site: d.site, identity: d.production_body_identity, version: d.version, runtime: d.runtime, sanitationGuard: d.sanitationGuard || null });
    (d.sessions || []).forEach((s, si) => { for (const g of s.generations) all.push({ ...g, _session: `${files.length - 1}:${si}`, classification: classify(g) }); });
  }
  const groups = {};
  for (const g of all) (groups[`${g.host}|${g.container}`] = groups[`${g.host}|${g.container}`] || []).push(g);
  const summary = {};
  for (const [k, gs] of Object.entries(groups)) {
    const u = gs.filter((g) => g.classification.status === 'USABLE');
    const by = (leave) => u.filter((g) => g.classification.leave === leave);
    const at = (g, key) => (g.samples[key] && g.samples[key].element) || null;
    const growth = (g) => { const a = at(g, 'leave'); const b = at(g, 'p5'); return a && b ? Math.round((b.bufferedEnd - a.bufferedEnd) * 100) / 100 : null; };
    // Element-level only (not a byte measurement).
    const afterState = (g) => {
      const a = at(g, 'leave'); const b = at(g, 'p5'); if (!a || !b) return 'UNSAMPLED';
      const dur = a.duration || b.duration; const full = (x) => !!dur && x.bufferedEnd >= dur - 0.05;
      if (full(a)) return 'COMPLETE_AT_LEAVE';
      if (b.bufferedEnd - a.bufferedEnd > 0.05) return full(b) ? 'GREW_AFTER_LEAVE_TO_FULL' : 'GREW_AFTER_LEAVE';
      return b.networkState === 1 ? 'IDLE_PARTIAL_NO_GROWTH' : 'LOADING_NO_GROWTH';
    };
    const side = (xs) => ({
      n: xs.length,
      p5HoldsSrc: xs.filter((g) => at(g, 'p5')?.holdsSrc === 1).length,
      p5Attached: xs.filter((g) => at(g, 'p5')?.attached === 1).length,
      p5NetworkState: tally(xs.map((g) => at(g, 'p5')?.networkState)),
      bufferedGrowthLeaveToP5Seconds: dist(xs.map(growth)),
      fullyBufferedAt5s: xs.filter((g) => g.classification.fullyBufferedAt5s).length,
      rtCompleted: xs.filter((g) => g.classification.rtCompleted).length,
      rtSizesHidden: xs.filter((g) => g.classification.rtSizesHidden).length,
      rtNoEntry: xs.filter((g) => !(g.resourceTiming || []).length).length,
    });
    summary[k] = {
      generations: gs.length, status: tally(gs.map((g) => g.classification.status)),
      excludedReasons: tally(gs.filter((g) => g.classification.status !== 'USABLE').flatMap((g) => g.classification.reasons)),
      usable: u.length,
      dataSizeBytes: dist(u.map((g) => g.dataSize)),
      dimensions: tally(u.map((g) => (g.width && g.height ? `${g.width}x${g.height}` : 'unknown'))),
      distinctCards: new Set(u.map((g) => `${g._session}:${g.cardOrdinal}`)).size, repeatHovers: u.filter((g) => g.hoverOnCard > 1).length,
      afterReadyState: tally(by('AFTER_READY').map(afterState)),
      afterReadyStateFirstHover: tally(by('AFTER_READY').filter((g) => g.hoverOnCard === 1).map(afterState)),
      loadeddataMsFirstHover: dist(by('AFTER_READY').filter((g) => g.hoverOnCard === 1).map((g) => g.element.readiness.loadeddata)),
      loadeddataMsRepeatHover: dist(by('AFTER_READY').filter((g) => g.hoverOnCard > 1).map((g) => g.element.readiness.loadeddata)),
      bufferedGrowthWhereGrewSeconds: dist(by('AFTER_READY').filter((g) => afterState(g).startsWith('GREW')).map(growth)),
      networkStateLeaveP1P5: tally(by('AFTER_READY').map((g) => ['leave', 'p1', 'p5'].map((k) => at(g, k)?.networkState).join('/'))),
      beforeReadyReleasedAtLeave: by('BEFORE_READY').filter((g) => g.element && g.element.srcRemovedT.length && Math.abs(g.element.srcRemovedT[0] - g.leaveT) <= 5).length,
      quickPassesUnder200ms: u.filter((g) => g.leaveT < 200).length,
      quickPassesUnder200msWithSource: u.filter((g) => g.leaveT < 200 && g.element && g.element.srcSetT != null).length,
      rtEntries: u.reduce((n, g) => n + (g.resourceTiming || []).length, 0),
      rtEntriesWithSizes: u.reduce((n, g) => n + (g.resourceTiming || []).filter((e) => e.transferSize > 0 || e.encodedBodySize > 0 || e.decodedBodySize > 0).length, 0),
      srcAssignMs: dist(u.map((g) => g.element && g.element.srcSetT)),
      loadeddataMs: dist(u.map((g) => g.element && g.element.readiness.loadeddata)),
      firstFrameMs: dist(u.map((g) => g.element && g.element.firstFrame)),
      stayMs: dist(u.map((g) => g.leaveT)),
      leave: tally(u.map((g) => g.classification.leave)),
      leaveBeforeReady: side(by('BEFORE_READY')),
      leaveAfterReady: side(by('AFTER_READY')),
      maxHoldingHoverVideos: Math.max(0, ...u.flatMap((g) => Object.values(g.samples).map((s) => s.holdingHoverVideos))),
      mutedAtEveryPlay: u.every((g) => !g.element || g.element.calls.filter((c) => c[1] === 'play').every((c) => c[2] === 'muted')),
    };
  }
  return { files, summary, generations: all.length };
}

// Sanitized aggregate: counts and distributions only; no per-generation record,
// sizes rounded to 0.1 MB, resolution classes instead of exact dimensions.
function aggregate(docs) {
  const a = analyze(docs);
  const mb = (d) => (d ? { n: d.n, min: +(d.min / 1e6).toFixed(1), median: +(d.median / 1e6).toFixed(1), max: +(d.max / 1e6).toFixed(1) } : null);
  const all = [];
  docs.forEach((d, fi) => (d.sessions || []).forEach((s, si) => s.generations.forEach((g) => all.push({ ...g, _k: `${fi}:${si}:${g.cardOrdinal}` }))));
  const out = {};
  for (const [k, v] of Object.entries(a.summary)) {
    const [host, container] = k.split('|');
    const firsts = all.filter((g) => g.host === host && g.container === container && g.hoverOnCard === 1 && classify(g).status === 'USABLE');
    const band = (x) => (x < 5e6 ? '<5MB' : x < 20e6 ? '5-20MB' : x < 50e6 ? '20-50MB' : '>=50MB');
    const res = (g) => { const m = Math.min(g.width || 0, g.height || 0); return !m ? 'unknown' : m <= 720 ? '<=720p' : m <= 1080 ? '1080p' : '>1080p'; };
    const { dataSizeBytes, dimensions, ...rest } = v;
    out[k] = { ...rest, dataSizeMB: mb(dataSizeBytes), firstHoverSizeBands: tally(firstHoverSizes(firsts).map(band)), firstHoverResolution: tally(firsts.map(res)) };
  }
  return { files: a.files.map(({ site, identity, version, runtime, sanitationGuard }) => ({ site, identity, version, runtime, sanitationGuard })), generations: a.generations, summary: out };
}
function firstHoverSizes(gs) { return gs.map((g) => g.dataSize).filter(Number.isFinite); }

module.exports = { analyze, aggregate };

if (require.main === module) {
  const args = process.argv.slice(2);
  const ji = args.indexOf('--json');
  const out = ji >= 0 ? args.splice(ji, 2)[1] : null;
  const ai = args.indexOf('--aggregate');
  const agg = ai >= 0 ? args.splice(ai, 2)[1] : null;
  const docs = args.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const a = analyze(docs);
  if (out) fs.writeFileSync(out, JSON.stringify(a, null, 1) + '\n');
  if (agg) fs.writeFileSync(agg, JSON.stringify(aggregate(docs), null, 1) + '\n');
  console.log(JSON.stringify(agg ? aggregate(docs) : a, null, 1));
}
