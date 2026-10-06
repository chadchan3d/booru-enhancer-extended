'use strict';
// IB11 V-VIEW evaluator (revision 1.0). A CHARACTERIZATION probe: for every
// cell it reports two separate things:
//   evidence  PASS | FAIL | INVALID - did the probe validly and unambiguously
//             observe what the cell is designed to observe (trusted operator
//             input, right artifact, right fixture route, real dimensions,
//             the failure seam really threw, ...). A PASS can document a defect;
//   finding   the PRODUCT result: DEFECT_CONFIRMED | DEFECT_NOT_REPRODUCED |
//             BEHAVIOR_OK | OBSERVED (descriptive) | CONTROL_ONLY, with detail.
// Known defects are never required to pass; they are observed.
// Page rules: exactly one valid attempt per page (no error); more than one is
// AMBIGUOUS (FAIL); INVALID attempts are listed, never used. Identity must be
// MATCH_EXPECTED_ARTIFACT. Any trusted input outside a prompt during a cell
// makes that cell INVALID.
// Cells and criteria (E = evidence, F = finding):
//   VD7  E: open at 300/1000/3000 ms; stage dims > 0; early media is the slow
//        original route (VD7-slow) and NOT complete at 300 ms; the original
//        later completes at its fixture dimensions; the server saw the route.
//        F: DEFECT_CONFIRMED if no visible staged placeholder (thumb) at 300
//        and 1000 ms; detail = what was visible (area, loading text).
//   VD4  E: both F11 resizes trusted; fit-both; wide fixture complete at
//        2000x1000; unrotated fit inside the stage (sanity); rotate(90deg)
//        applied; nonzero dims. F: DEFECT_CONFIRMED if the rotated media
//        exceeds the stage after either real resize.
//   VD6B E: started from a valid open image; the seam threw from buildMedia;
//        the selection moved to the failing target; nonzero stage.
//        F: DEFECT_CONFIRMED if the viewer is open with no media, no state
//        text and no native link (blank, uncommunicated).
//   VD1  E: a real failure (error event; 404 route; state + native link).
//        F: DEFECT_CONFIRMED if the same-ID update erased state and link.
//   VD5SYN  control only (synthetic events; never browser evidence).
//   VD5  E: Ctrl+F and Ctrl+D both trusted, with ctrlKey. F: per chord,
//        DEFECT_CONFIRMED if the Favorite / Download stub ran; records
//        defaultPrevented (browser shortcut suppressed); DEFECT_NOT_REPRODUCED
//        if neither ran.
//   G3   E: trusted pointerdown on the video and trusted Space; focus at Space
//        is the video (premise). F: BEHAVIOR_OK for exactly one effective
//        toggle; DEFECT_CONFIRMED for zero or two (double toggle).
//   FOCUS_M / FOCUS_K  E: trusted inputs, an invoking element in the target
//        card, viewer opened and closed, descriptors present. F: OBSERVED
//        (focus after open, Tab targets, return to the invoker).
//   NATIVE  E: failure link visible (nonzero box), trusted click, the page
//        left and the native destination recorded the arrival.
//        F: BEHAVIOR_OK if native recovery navigated.
//   VD6A E: trusted ordinary click; the seam threw; overlay state recorded; a
//        page exit without a destination arrival is a FAIL. F: separates
//        "overlay left shown (blank) while native navigation proceeds" from
//        "native recovery blocked" (no navigation and no communicated failure);
//        a failure shown in the viewer with a native link is BEHAVIOR_OK.
// Usage: node vview_evaluate.cjs <ib11-vview-results.json>
const fs = require('fs');

const REVISION = '1.0';
const MAIN_CELLS = ['VD7', 'VD6B', 'VD1', 'VD5SYN', 'VD4', 'VD5', 'G3', 'FOCUS_M', 'FOCUS_K', 'NATIVE'];
const TAKEOVER_CELLS = ['VD6A'];
const dimsOk = (b) => !!b && b.w > 0 && b.h > 0;
const overflow = (s) => { const m = s && s.media && s.media.rect; const st = s && s.stage; if (!m || !st) return null; return { left: st.x - m.x, top: st.y - m.y, right: (m.x + m.w) - (st.x + st.w), bottom: (m.y + m.h) - (st.y + st.h) }; };
const exceeds = (o) => !!o && Object.values(o).some((v) => v > 1);
const isTrusted = (r) => !!r && r.trusted === true;

function cellResult(id, ev, finding) { return { id, evidence: ev.length ? (ev.some((x) => x.startsWith('INVALID')) ? 'INVALID' : 'FAIL') : 'PASS', reasons: ev, finding }; }

function evalCell(id, c, ctx) {
  const ev = []; const bad = (s) => ev.push(`FAIL ${s}`); const inv = (s) => ev.push(`INVALID ${s}`);
  if (!c) { inv('cell missing'); return cellResult(id, ev, null); }
  if (c.outsideTrusted) inv(`${c.outsideTrusted} trusted input(s) outside a prompt`);
  const req = (label) => ctx.requests.filter((r) => r.page === ctx.page && r.label === label);
  let finding = null;
  switch (id) {
    case 'VD7': {
      const s = c.samples || [];
      if (s.length !== 3 || !s.every((x) => x.open)) bad('viewer not open at all three samples');
      if (!s.every((x) => dimsOk(x.stage))) bad('missing/zero stage dimensions');
      const e = s[0] || {};
      if (!e.media || e.media.label !== 'VD7-slow') bad(`early media is not the slow original route (${e.media && e.media.label})`);
      if (e.media && e.media.complete === true) inv('original already complete at the early sample');
      const dims = ctx.fixtures.slow && ctx.fixtures.slow.dims;
      if (!c.final || !c.final.media || c.final.media.complete !== true || !dims || c.final.media.nw !== dims[0] || c.final.media.nh !== dims[1]) inv('slow original never completed at its fixture dimensions');
      if (!req('VD7-slow').some((r) => r.status === 200)) bad('slow original route not requested from the fixture server');
      const vis = (x) => ({ at: x.at, placeholder: (x.visible || []).some((v) => /-thumb$/.test(v.label) && v.area > 0), originalArea: (x.visible || []).filter((v) => /-slow$/.test(v.label)).reduce((a, v) => a + v.area, 0), state: x.state });
      const early = s.slice(0, 2).map(vis);
      finding = early.length === 2 && early.every((x) => !x.placeholder) ? { code: 'DEFECT_CONFIRMED', detail: { noStagedPlaceholder: true, samples: s.map(vis) } } : { code: 'BEHAVIOR_OK', detail: { samples: s.map(vis) } };
      break;
    }
    case 'VD4': {
      if (!isTrusted(c.resize1) || !isTrusted(c.resize2)) inv('resize not trusted (not a real browser resize)');
      if (c.fitMode !== 'fit-both') bad(`fit mode ${c.fitMode}`);
      const d = ctx.fixtures.wide && ctx.fixtures.wide.dims;
      if (!c.s0 || !c.s0.media || c.s0.media.complete !== true || !d || c.s0.media.nw !== d[0] || c.s0.media.nh !== d[1]) bad('wide fixture not complete at its dimensions');
      for (const k of ['s0', 'sA', 'sB']) if (!c[k] || !dimsOk(c[k].stage) || !c[k].media || !dimsOk(c[k].media.rect)) bad(`missing/zero dimensions at ${k}`);
      if (c.s0 && exceeds(overflow(c.s0))) bad('unrotated fit already overflows (measurement unreliable)');
      for (const k of ['sA', 'sB']) if (!c[k] || !c[k].media || !/rotate\(90deg\)/.test(c[k].media.transform || '')) bad(`rotation not applied at ${k}`);
      const oA = overflow(c.sA); const oB = overflow(c.sB);
      finding = { code: exceeds(oA) || exceeds(oB) ? 'DEFECT_CONFIRMED' : 'BEHAVIOR_OK', detail: { afterResize1: oA, afterResize2: oB, stageA: c.sA && c.sA.stage, mediaA: c.sA && c.sA.media && c.sA.media.rect } };
      break;
    }
    case 'VD6B': {
      if (!c.before || !c.before.open || !c.before.media || c.before.media.complete !== true || c.before.currentId !== c.fromId) bad('did not start from a valid open image');
      if (!(c.seam || []).some((x) => x.fromBuildMedia)) inv('failure seam did not throw from buildMedia');
      const a = c.after1000 || {};
      if (a.currentId !== c.toId) bad(`selection did not move to the failing target (${a.currentId})`);
      if (!dimsOk(a.stage)) bad('missing/zero stage dimensions');
      const blank = a.open && !a.media && !a.state && !a.link;
      finding = { code: blank ? 'DEFECT_CONFIRMED' : 'BEHAVIOR_OK', detail: { open: a.open, media: !!a.media, state: a.state, link: a.link, children: a.children, previousMediaConnected: c.prevConnected, seam: (c.seam || []).map((x) => x.name) } };
      break;
    }
    case 'VD1': {
      const f = c.failed || {};
      if (!c.failedSeen || !c.failEvent || f.link !== 'card-post' || !/failed/i.test(f.state || '')) inv('no real media failure with state and native link');
      if (!req('VD1-fail').some((r) => r.status === 404)) bad('failure route not requested from the fixture server');
      const a = c.after500 || {};
      finding = { code: !a.link && !a.state && c.sameMedia ? 'DEFECT_CONFIRMED' : 'BEHAVIOR_OK', detail: { before: { state: f.state, link: f.link }, after0: c.after0 && { state: c.after0.state, link: c.after0.link }, after500: { state: a.state, link: a.link }, sameMedia: c.sameMedia } };
      break;
    }
    case 'VD5SYN': {
      if (!(c.events || []).length) bad('no control events');
      if ((c.events || []).some((e) => e.trusted)) bad('a synthetic control event reports trusted');
      finding = { code: 'CONTROL_ONLY', detail: (c.events || []).map((e) => ({ key: e.key, fav: e.fav, dl: e.dl, defaultPrevented: e.defaultPrevented })) };
      break;
    }
    case 'VD5': {
      const ch = c.chords || [];
      for (const want of ['f', 'd']) {
        const x = ch.find((y) => y.want === want);
        if (!x) { inv(`Ctrl+${want.toUpperCase()} not recorded`); continue; }
        if (!isTrusted(x)) inv(`Ctrl+${want.toUpperCase()} not trusted (synthetic input is not browser evidence)`);
        if (!x.ctrlKey || String(x.key).toLowerCase() !== want) bad(`Ctrl+${want.toUpperCase()} modifier/key fields wrong`);
      }
      const F = ch.find((y) => y.want === 'f') || {}; const D = ch.find((y) => y.want === 'd') || {};
      const per = { ctrlF: { favorite: F.fav > 0, download: F.dl > 0, defaultPrevented: F.defaultPrevented, openBefore: F.openBefore, openAfter: F.openAfter },
        ctrlD: { favorite: D.fav > 0, download: D.dl > 0, defaultPrevented: D.defaultPrevented, openBefore: D.openBefore, openAfter: D.openAfter } };
      finding = { code: per.ctrlF.favorite || per.ctrlD.download ? 'DEFECT_CONFIRMED' : 'DEFECT_NOT_REPRODUCED', detail: per };
      break;
    }
    case 'G3': {
      if (!isTrusted(c.click) || !c.clickTargetIsVideo) inv('no trusted click on the video control');
      if (!c.space || !isTrusted(c.space)) inv('Space not trusted');
      if (!c.space || !c.space.active || c.space.active.tag !== 'VIDEO') inv(`premise not met: the native video control was not focused at Space (${c.space && c.space.active && c.space.active.tag})`);
      const toggles = (c.events || []).length; const effective = c.pausedBefore !== c.pausedAfter;
      finding = { code: toggles === 1 && effective ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { toggles, effective, kind: toggles === 0 ? 'no toggle' : (toggles === 1 ? 'single' : 'double'), productionHandler: (c.prodCalls || []).some((x) => x[3] === 'togglePlayPause'), defaultPrevented: c.space && c.space.defaultPrevented } };
      break;
    }
    case 'FOCUS_M': case 'FOCUS_K': {
      const role = id;
      const inputs = id === 'FOCUS_M' ? [c.pointer, c.click, c.escape] : [c.enter, ...(c.tabs || []), c.closeClick];
      if (!inputs.every(isTrusted)) inv('an operator input was not trusted');
      if (!c.invoker || c.invoker.card !== role) bad('no invoking element in the target card');
      if (!c.opened || !c.closed) bad('viewer did not open and close');
      if (id === 'FOCUS_K' && (c.tabs || []).length !== 3) bad('Tab sampling incomplete');
      for (const k of ['afterOpen300', 'afterClose300']) if (!c[k]) bad(`focus descriptor missing (${k})`);
      const same = (a, b) => !!a && !!b && a.card === b.card && a.tag === b.tag;
      finding = { code: 'OBSERVED', detail: { invoker: c.invoker, afterOpen: c.afterOpen300, movedIntoViewer: !!(c.afterOpen300 && c.afterOpen300.inOverlay), beforeClose: c.beforeClose || null,
        afterClose: c.afterClose300, returnedToInvoker: same(c.afterClose300, c.invoker),
        tabs: id === 'FOCUS_K' ? (c.tabs || []).map((t) => ({ after: t.after, inOverlay: !!(t.after && t.after.inOverlay) })) : undefined,
        tabLeftOverlay: id === 'FOCUS_K' ? (c.tabs || []).some((t) => t.after && !t.after.inOverlay) : undefined } };
      break;
    }
    case 'NATIVE': {
      const f = c.failed || {};
      if (f.link !== 'card-post' || !dimsOk(f.linkBox)) bad('native link not visible after the failure');
      if (!isTrusted(c.click)) inv('native link click not trusted (programmatic clicks are not evidence)');
      const arrived = ctx.arrivals.some((a) => a.page === 'MAIN' && a.card === 'NATIVE' && (!c.click || a.wall >= c.click.wall - 100));
      if (!c.navigated) bad('the page did not leave after the click');
      if (!arrived) bad('navigation never reached the native destination');
      finding = { code: arrived ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { linkVisible: dimsOk(f.linkBox), navigated: !!c.navigated, arrived, clickPrevented: c.clickPrevented } };
      break;
    }
    case 'VD6A': {
      if (!isTrusted(c.click)) inv('ordinary card click not trusted');
      if (!(c.seam || []).some((x) => x.fromBuildMedia)) inv('failure seam did not throw from buildMedia');
      if (!c.overlayAtClick) bad('overlay state at the failure not recorded');
      const arrived = ctx.arrivals.some((a) => a.page === 'TAKEOVER' && a.card === 'VD6A' && (!c.click || a.wall >= c.click.wall - 100));
      if (c.navigated && !arrived) bad('page left but never reached the native destination');
      const o = c.overlayAtClick || {};
      const overlayShown = o.display === 'flex';
      const communicated = overlayShown && !!o.state && o.link === 'card-post';
      const blocked = !arrived && !communicated;
      const summary = communicated ? 'failure shown in the viewer with a native link'
        : (blocked ? 'native recovery blocked' : (overlayShown ? 'overlay left shown (blank); native recovery not blocked' : 'no defect observed'));
      finding = { code: communicated || (!overlayShown && arrived) ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED',
        detail: { overlayShownAtFailure: overlayShown, overlayAtFailure: { display: o.display, children: o.children, media: !!o.media, state: o.state, link: o.link }, nativeNavigationCancelled: c.defaultPrevented, nativeNavigationOccurred: !!c.navigated, destinationArrived: arrived, overlayAtLeave: c.overlayAtLeave, summary } };
      break;
    }
    default: inv('unknown cell');
  }
  return cellResult(id, ev, finding);
}

function evaluate(doc) {
  const problems = []; const invalidAttempts = []; const pages = {};
  if (!doc || doc.probe !== 'ib11-vview') return { kind: 'vview', revision: REVISION, evidencePass: false, problems: ['not an ib11-vview result'], cells: [] };
  for (const pid of ['MAIN', 'TAKEOVER']) {
    const all = (doc.pages || []).filter((p) => p.page === pid);
    for (const p of all) if (p.client && p.client.error) invalidAttempts.push({ page: pid, attempt: p.attempt, error: p.client.error });
    const valid = all.filter((p) => p.client && !p.client.error);
    if (valid.length > 1) problems.push(`AMBIGUOUS: ${valid.length} valid attempts for ${pid}`);
    if (!valid.length) problems.push(`no valid attempt for ${pid}`);
    pages[pid] = valid.length === 1 ? valid[0] : null;
    if (pages[pid] && pages[pid].client.identity !== 'MATCH_EXPECTED_ARTIFACT') problems.push(`${pid} identity ${pages[pid].client.identity}`);
  }
  const cells = [];
  for (const [pid, ids] of [['MAIN', MAIN_CELLS], ['TAKEOVER', TAKEOVER_CELLS]]) {
    const p = pages[pid];
    const ctx = { page: pid, fixtures: doc.fixtures || {}, requests: doc.requests || [], arrivals: doc.arrivals || [] };
    for (const id of ids) {
      if (!p) { cells.push({ id, evidence: 'INVALID', reasons: [`INVALID page ${pid} has no single valid attempt`], finding: null }); continue; }
      const r = evalCell(id, p.client.cells && p.client.cells[id], ctx);
      if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') { r.evidence = 'FAIL'; r.reasons.push('FAIL wrong production artifact'); }
      cells.push(r);
    }
  }
  const runtime = pages.MAIN ? pages.MAIN.client.runtime : null;
  const evidencePass = !problems.length && cells.every((c) => c.evidence === 'PASS');
  return { kind: 'vview', revision: REVISION, runtime, problems, invalidAttempts, evidencePass,
    counts: cells.reduce((m, c) => { m[c.evidence] = (m[c.evidence] || 0) + 1; return m; }, {}),
    findings: Object.fromEntries(cells.map((c) => [c.id, c.finding ? c.finding.code : null])), cells };
}

module.exports = { evaluate, evalCell, REVISION, MAIN_CELLS, TAKEOVER_CELLS, overflow };

if (require.main === module) {
  const r = evaluate(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.evidencePass ? 0 : 1;
}
