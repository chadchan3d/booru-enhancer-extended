'use strict';
// IB10 P-stage conformance evaluator (approved behavior: G-VIDEO(class, cell)
// PASS(scope); owner decision V3-R Option A). Turns operator results into
// explicit PASS/FAIL per criterion. Element/DOM state and server bytes stay
// separate; only the controlled run has byte evidence.
//
// Controlled (IB10_P_Controlled.user.js + v3c_server.cjs, all 54 V3-C cells):
//   C1 identity MATCH_EXPECTED_ARTIFACT; clean selection 54/54 (select_clean);
//   C2 dwell: every hover video's source >= 190 ms after its enter; a 40 ms pass
//      (LEAVE_PENDING) creates no hover video and no media request;
//   C3 every hover play muted;
//   C4 at the end no hover video holds a source or is attached; at most one
//      hover video holds a source at any sampled time;
//   C5 transport (server): every request has completed or ended within 100 ms of
//      the hover-ending event that followed it (leave / viewer click / dispose);
//      nothing is still streaming at run end; <= 64 KiB after the last cleanup.
//      Viewer cells: the viewer's own request may continue (viewer policy, IB11);
//      there the hover element must be released at the click and never installed.
// Live (IB10_P_Live_Observer.user.js), per usable generation on an admitted card
// (e621 WebM <= 100 MB, e926 MP4 < 50 MB). Revision 1.1 (evaluator correction,
// see IB10_P_STAGE.md section 6): the dwell rules use the exact 200 ms threshold
// (no tolerance), and the leave sample accepts the HTML media load algorithm's
// transient post-reset state.
//   L1 no hover video created: the hover ended no later than the 200 ms dwell
//      (stay <= 200; a leave at exactly 200 ms can run before the dwell timer task).
//      A stay above 200 ms without a hover video FAILS (sustained hover, no preview);
//   L2 a hover video was created: exactly one, its source assigned >= 200 ms after
//      enter (both are integer-ms values, so a real >= 200 ms delay never reads
//      below 200), and it is the card's own file;
//   L3 at leave (sampled synchronously after production's cleanup): detached and
//      no source held; networkState NETWORK_EMPTY (0) or NETWORK_NO_SOURCE (3),
//      the state load() sets synchronously before the next stable state; at
//      +1 s and +5 s: detached, no source, NETWORK_EMPTY (0). At most one hover
//      video holds a source at any sample;
//   L4 every play muted.
//   Host evidence: >= 8 usable admitted generations, >= 2 quick passes, >= 3
//   sustained hovers that produced a preview, >= 3 after-ready leaves.
// Byte-level termination is proved by the controlled run (C5), not here.
// Targeted (revision 1.2, IB10 reopen: poster/View fallback; IB10_P_STAGE.md
// section 8), on IB10_PF_Live_Observer.user.js. Revision 1.1 is unchanged.
//   T0 identity MATCH_EXPECTED_ARTIFACT, no sanitation block;
//   positive: admitted generations judged by L1-L4; per host >= 4 usable,
//      >= 1 quick pass, >= 2 sustained hovers that produced a preview;
//   negative (every recorded video-card generation outside the admitted class,
//      whatever its trigger or viewer state):
//   N1 production created no hover video (hoverElements 0, no element record);
//   N2 no hover video holds a source at leave, +1 s or +5 s;
//      evidence per host: >= 3 trusted sustained (stay > 200 ms) excluded hovers
//      with all samples, of the required class (e621 MP4; e926 WebM). e926 MP4
//      >= 50 MB and other classes are reported, not required;
//   V1 View reachable: per host >= 1 excluded generation in which the viewer
//      opened (the operator clicked the card), all samples taken and no hover
//      video (hoverElements measured 0).
// Usage: node p_conformance_ib10.cjs controlled <results.json>
//        node p_conformance_ib10.cjs live <result.json> [...]
//        node p_conformance_ib10.cjs targeted <e621.json> <e926.json>
const fs = require('fs');
const { select } = require('./select_clean_ib10_v3c.cjs');
const { analyzeRun } = require('./analyze_ib10_v3c.cjs');
const { classify } = require('./v3l_classify.js');

const KIB = 1024;
const DWELL_MS = 200;
const NETWORK_EMPTY = 0;
const NETWORK_NO_SOURCE = 3;
function evaluateControlled(doc) {
  const { doc: clean, report } = select(doc);
  const runs = clean.runs.map((r) => ({ raw: r, a: analyzeRun(r) }));
  const out = [];
  for (const { raw, a } of runs) {
    const fails = [];
    const marks = a.marks;
    const enters = marks.filter((m) => m.what === 'enter').map((m) => m.t);
    const enders = marks.filter((m) => m.what === 'leave' || m.what === 'click' || m.what === 'dispose').map((m) => m.t);
    const hover = (raw.client.videos || []).filter((v) => v.owner === 'hover');
    if (a.identity !== 'MATCH_EXPECTED_ARTIFACT') fails.push(`C1 identity ${a.identity}`);
    for (const v of hover) {
      const src = v.calls.find((c) => c[1] === 'src');
      const enter = enters.filter((t) => t <= v.created).pop();
      if (!src || enter == null || src[0] - enter < 190) fails.push(`C2 source ${src ? src[0] - enter : 'none'} ms after enter`);
      if (v.calls.some((c) => c[1] === 'play' && c[2] !== 'muted')) fails.push('C3 unmuted play');
    }
    if (a.scenario === 'LEAVE_PENDING' && (hover.length || a.transport.requests.length)) fails.push(`C2 40 ms pass created ${hover.length} hover video(s), ${a.transport.requests.length} request(s)`);
    if (a.event.holdingSrcAtEnd) fails.push(`C4 ${a.event.holdingSrcAtEnd} hover video(s) hold a source at the end`);
    if (a.event.elements.some((e) => e.atEnd && e.atEnd.connected)) fails.push('C4 hover video still attached at the end');
    if (a.event.maxHoldingSrcSimultaneously > 1) fails.push(`C4 ${a.event.maxHoldingSrcSimultaneously} hover videos held a source at once`);
    const viewerCell = a.scenario.startsWith('VIEWER_');
    if (viewerCell) {
      const click = marks.find((m) => m.what === 'click');
      for (const v of hover) {
        const rel = v.calls.find((c) => c[1] === 'removeSrc');
        if (!rel || (click && rel[0] - click.t > 100)) fails.push('C5 hover video not released at the viewer click');
      }
    } else {
      for (const q of a.transport.requests) {
        const endT = q.tEnd;
        const nextEnd = enders.filter((t) => t >= q.t0).shift();
        if (q.end === 'open-at-run-end') fails.push(`C5 request still streaming at run end (card ${q.card})`);
        else if (nextEnd != null && endT != null && endT > nextEnd + 100) fails.push(`C5 request ended ${endT - nextEnd} ms after the hover ended (${q.end})`);
      }
      if (a.transport.bytesAfterCleanupWithin5s > 64 * KIB) fails.push(`C5 ${a.transport.bytesAfterCleanupWithin5s} bytes after the last cleanup`);
    }
    out.push({ cell: `${a.mode} ${a.container} ${a.scenario}`, pass: fails.length === 0, fails,
      transport: { requests: a.transport.requests.length, completeBeforeCleanup: a.transport.requestsCompleteBeforeCleanup, activeAtCleanup: a.transport.requestsActiveAtCleanup, bytesAfterCleanupWithin5s: a.transport.bytesAfterCleanupWithin5s, ends: a.transport.requests.map((q) => q.end) } });
  }
  const complete = report.missing.length === 0 && report.duplicated.length === 0 && report.kept === 54;
  return { kind: 'controlled', selection: report, complete, pass: complete && out.every((x) => x.pass), cells: out };
}

const admitted = (g) => (g.host === 'e621.net' && g.container === 'webm' && g.dataSize > 0 && g.dataSize <= 100000000) || (g.host === 'e926.net' && g.container === 'mp4' && g.dataSize > 0 && g.dataSize < 50000000);
function evaluateLive(docs) {
  const rows = [];
  const files = docs.map((d) => ({ site: d.site, identity: d.production_body_identity, runtime: d.runtime, sanitationGuard: d.sanitationGuard || null }));
  for (const d of docs) for (const s of d.sessions || []) for (const g of s.generations) {
    const c = classify(g);
    if (c.status === 'CONTAMINATED') { rows.push({ host: g.host, admitted: admitted(g), status: 'CONTAMINATED', reasons: c.reasons }); continue; }
    if (!admitted(g)) { rows.push({ host: g.host, admitted: false, status: 'OUT_OF_SCOPE' }); continue; }
    const fails = [];
    const el = g.element;
    if (g.leaveT == null || !g.samples.leave || !g.samples.p1 || !g.samples.p5) { rows.push({ host: g.host, admitted: true, status: 'INCOMPLETE' }); continue; }
    if (!g.hoverElements) {
      if (g.leaveT > DWELL_MS) fails.push(`L1 sustained hover (${g.leaveT} ms) produced no hover video`);
    } else if (g.hoverElements !== 1 || !el) fails.push(`L2 ${g.hoverElements} hover videos in one generation`);
    else {
      if (el.srcSetT == null || el.srcSetT < DWELL_MS) fails.push(`L2 source at ${el.srcSetT} ms (before the ${DWELL_MS} ms dwell)`);
      if (el.srcMatchesCardFile !== true) fails.push('L2 source is not the card file');
      if (el.calls.some((x) => x[1] === 'play' && x[2] !== 'muted')) fails.push('L4 unmuted play');
      for (const k of ['leave', 'p1', 'p5']) {
        const e = g.samples[k].element;
        const okNetwork = k === 'leave' ? (e && (e.networkState === NETWORK_EMPTY || e.networkState === NETWORK_NO_SOURCE)) : (e && e.networkState === NETWORK_EMPTY);
        if (!e || e.holdsSrc || e.attached || !okNetwork) fails.push(`L3 at ${k}: holdsSrc ${e && e.holdsSrc}, attached ${e && e.attached}, networkState ${e && e.networkState}`);
      }
    }
    for (const k of ['leave', 'p1', 'p5']) if (g.samples[k].holdingHoverVideos > 1) fails.push(`L3 ${g.samples[k].holdingHoverVideos} hover videos held a source at ${k}`);
    rows.push({ host: g.host, admitted: true, status: fails.length ? 'FAIL' : 'PASS', stay: g.leaveT, video: !!g.hoverElements, afterReady: c.leave === 'AFTER_READY', fails });
  }
  const by = (host) => { const r = rows.filter((x) => x.host === host && x.admitted && (x.status === 'PASS' || x.status === 'FAIL'));
    return { usable: r.length, pass: r.filter((x) => x.status === 'PASS').length, fail: r.filter((x) => x.status === 'FAIL').length,
      quickPasses: r.filter((x) => !x.video && x.stay <= DWELL_MS).length, sustainedWithPreview: r.filter((x) => x.video).length, afterReady: r.filter((x) => x.afterReady).length }; };
  const hosts = { 'e621.net': by('e621.net'), 'e926.net': by('e926.net') };
  const pass = files.every((f) => f.identity === 'MATCH_EXPECTED_ARTIFACT' && !f.sanitationGuard) && Object.values(hosts).every((h) => h.fail === 0 && h.usable >= 8 && h.afterReady >= 3 && h.quickPasses >= 2 && h.sustainedWithPreview >= 3);
  return { kind: 'live', files, hosts, pass, failures: rows.filter((x) => x.status === 'FAIL'), counts: rows.reduce((m, x) => { m[x.status] = (m[x.status] || 0) + 1; return m; }, {}) };
}

const REVISION_TARGETED = '1.2';
const REQUIRED_NEGATIVE = { 'e621.net': 'mp4', 'e926.net': 'webm' };
const excludedClass = (g) => (g.host === 'e926.net' && g.container === 'mp4' && g.dataSize >= 50000000 ? 'e926 MP4 >= 50 MB'
  : `${g.host === 'e621.net' ? 'e621' : 'e926'} ${String(g.container).toUpperCase()}${g.dataSize ? '' : ' (no data-size)'}${g.host === 'e621.net' && g.container === 'webm' && g.dataSize > 100000000 ? ' > 100 MB' : ''}`);
function evaluateTargeted(docs) {
  const live = evaluateLive(docs);
  const neg = [];
  for (const d of docs) for (const s of d.sessions || []) for (const g of s.generations) {
    if (admitted(g)) continue;
    const fails = [];
    if (g.hoverElements || g.element) fails.push(`N1 ${g.hoverElements} hover video(s) created for an excluded card`);
    for (const k of ['leave', 'p1', 'p5']) { const x = (g.samples || {})[k]; if (x && (x.holdingHoverVideos || x.element)) fails.push(`N2 hover video state at ${k} (holding ${x.holdingHoverVideos})`); }
    const complete = g.leaveT != null && ['leave', 'p1', 'p5'].every((k) => (g.samples || {})[k]);
    const clean = g.trigger === 'TRUSTED' && !g.viewerOpened && !['leave', 'p1', 'p5'].some((k) => (g.samples || {})[k] && (g.samples[k].viewerOpen || g.samples[k].hidden));
    neg.push({ host: g.host, cls: excludedClass(g), container: g.container, status: fails.length ? 'FAIL' : 'PASS', fails,
      sustained: clean && complete && g.leaveT > DWELL_MS, view: !!g.viewerOpened && g.trigger === 'TRUSTED' && complete && g.hoverElements === 0 });
  }
  const hosts = {};
  for (const host of ['e621.net', 'e926.net']) {
    const n = neg.filter((x) => x.host === host);
    const classes = {};
    for (const x of n) { const c = (classes[x.cls] = classes[x.cls] || { generations: 0, sustained: 0, view: 0, fail: 0 }); c.generations++; if (x.sustained) c.sustained++; if (x.view) c.view++; if (x.status === 'FAIL') c.fail++; }
    const requiredSustained = n.filter((x) => x.sustained && x.container === REQUIRED_NEGATIVE[host]).length;
    const p = live.hosts[host];
    const positiveOk = p.fail === 0 && p.usable >= 4 && p.quickPasses >= 1 && p.sustainedWithPreview >= 2;
    const negativeOk = n.every((x) => x.status === 'PASS') && requiredSustained >= 3;
    const viewOk = n.some((x) => x.view && x.status === 'PASS');
    hosts[host] = { positive: p, positiveOk, negative: { required: `${host === 'e621.net' ? 'e621' : 'e926'} ${REQUIRED_NEGATIVE[host].toUpperCase()}`, requiredSustained, classes }, negativeOk, viewOk };
  }
  const identityOk = live.files.every((f) => f.identity === 'MATCH_EXPECTED_ARTIFACT' && !f.sanitationGuard);
  const pass = identityOk && Object.values(hosts).every((x) => x.positiveOk && x.negativeOk && x.viewOk);
  return { kind: 'targeted', revision: REVISION_TARGETED, files: live.files, identityOk, hosts, pass,
    failures: live.failures.concat(neg.filter((x) => x.status === 'FAIL')), counts: live.counts };
}

module.exports = { evaluateControlled, evaluateLive, evaluateTargeted, admitted, REVISION_TARGETED };

if (require.main === module) {
  const [mode, ...files] = process.argv.slice(2);
  const docs = files.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
  const r = mode === 'controlled' ? evaluateControlled(docs[0]) : (mode === 'targeted' ? evaluateTargeted(docs) : evaluateLive(docs));
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.pass ? 0 : 1;
}
