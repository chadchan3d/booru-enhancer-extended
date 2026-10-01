'use strict';
// IB10 V3-L analysis. Re-classifies every recorded generation with the shared
// classifier (authoritative) and summarizes USABLE generations per host x
// container. Sizes are reported as the observed distribution of exact data-size
// values; no size bands are predefined. DOM/media state and Resource Timing are
// summarized separately; neither is read as proof that transfer stopped.
// Usage: node analyze_ib10_v3l.cjs <result.json> [<result.json> ...] [--json out.json]
const fs = require('fs');
const { classify } = require('./v3l_classify.js');

const dist = (xs) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? { n: v.length, min: v[0], median: v[Math.floor((v.length - 1) / 2)], max: v[v.length - 1] } : null; };
const tally = (xs) => xs.reduce((m, x) => { m[x] = (m[x] || 0) + 1; return m; }, {});

function analyze(docs) {
  const all = [];
  const files = [];
  for (const d of docs) {
    files.push({ site: d.site, identity: d.production_body_identity, version: d.version, runtime: d.runtime, sanitationGuard: d.sanitationGuard || null });
    for (const s of d.sessions || []) for (const g of s.generations) all.push({ ...g, classification: classify(g) });
  }
  const groups = {};
  for (const g of all) (groups[`${g.host}|${g.container}`] = groups[`${g.host}|${g.container}`] || []).push(g);
  const summary = {};
  for (const [k, gs] of Object.entries(groups)) {
    const u = gs.filter((g) => g.classification.status === 'USABLE');
    const by = (leave) => u.filter((g) => g.classification.leave === leave);
    const at = (g, key) => (g.samples[key] && g.samples[key].element) || null;
    const growth = (g) => { const a = at(g, 'leave'); const b = at(g, 'p5'); return a && b ? Math.round((b.bufferedEnd - a.bufferedEnd) * 100) / 100 : null; };
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
      distinctCards: new Set(u.map((g) => g.cardOrdinal)).size, repeatHovers: u.filter((g) => g.hoverOnCard > 1).length,
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

module.exports = { analyze };

if (require.main === module) {
  const args = process.argv.slice(2);
  const ji = args.indexOf('--json');
  const out = ji >= 0 ? args.splice(ji, 2)[1] : null;
  const a = analyze(args.map((f) => JSON.parse(fs.readFileSync(f, 'utf8'))));
  if (out) fs.writeFileSync(out, JSON.stringify(a, null, 1) + '\n');
  console.log(JSON.stringify(a, null, 1));
}
