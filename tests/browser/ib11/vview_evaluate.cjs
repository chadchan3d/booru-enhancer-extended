'use strict';
// IB11 V-VIEW evaluator (revision 1.3; earlier revisions differ in G3 and NATIVE,
// see below). A CHARACTERIZATION probe: for every
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
//   G3   [1.1] native-control premise, observed through consequences
//        (Chrome's controls are a closed UA shadow tree): a TRUSTED play/pause
//        transition on the video during the click prompt, not caused by page
//        JavaScript, not preceded by a page-visible click on the video surface,
//        after which the video has focus (never invented).
//        [1.2] Space: the focused native control may consume Space before the
//        page sees it (observed in real Chrome), so a DOM keydown is NOT
//        required; it is recorded as supplemental (keyVisible). E: the video is
//        focused before and after the Space prompt; a play/pause transition
//        occurs in the bounded prompt window (60 s) - or, if none, a visible
//        Space shows the press happened (then the finding is "no toggle");
//        no page JavaScript other than production's key handler
//        (togglePlayPause) touched play()/pause() before the first transition.
//        Without any transition and without a visible key the result is
//        INCONCLUSIVE (INVALID). Media events' isTrusted is not used as proof of
//        cause. F (descriptive): native-only single | production-handled single
//        (default suppressed) -> BEHAVIOR_OK; double toggle (two transitions or
//        back to the starting state) | no toggle -> DEFECT_CONFIRMED; with the
//        paths implicated (production handler ran, key visible, defaultPrevented).
//   FOCUS_M / FOCUS_K  E: trusted inputs, an invoking element in the target
//        card, viewer opened and closed, descriptors present. F: OBSERVED
//        (focus after open, Tab targets, return to the invoker).
//   NATIVE  (record revision 1.0-1.2, MAIN page) E: failure link visible, trusted
//        click ON the link, page left, destination arrival. That form cannot
//        characterize a link that does not receive clicks (the first full run
//        timed out there), so it is superseded by:
//   NATIVE  [1.3 record, recovery page NATIVE_R] characterizes a working OR a
//        broken link. E: link box nonzero; computed pointer-events of the link
//        and its ancestors recorded; elementFromPoint at the link centre
//        recorded and consistent with pointer-events; destination = the card's
//        /posts/<id>; one TRUSTED click inside the recorded box while the link
//        was present (the target need not be the link); navigation outcome
//        observed; a destination arrival without (before) the prompted click is
//        INVALID. F: BEHAVIOR_OK when the click targets the link, hit-testing
//        finds the link and the destination is reached; DEFECT_CONFIRMED when
//        the click cannot target the link, no navigation follows, and
//        pointer-events/hit-testing show the link is not interactive (a
//        confirmed defect is evidence PASS); anything else is ambiguous
//        (INVALID).
//   VD6A E: trusted ordinary click; the seam threw; overlay state recorded; a
//        page exit without a destination arrival is a FAIL. F: separates
//        "overlay left shown (blank) while native navigation proceeds" from
//        "native recovery blocked" (no navigation and no communicated failure);
//        a failure shown in the viewer with a native link is BEHAVIOR_OK.
// Recovery merge [1.3]: evaluate(original, { recovery, provenance }) takes the
// completed MAIN evidence from the original file and ONLY the authorized
// cells from a separately hashed recovery file (probe ib11-vview-recovery):
// NATIVE from page NATIVE_R and VD6A from page TAKEOVER, each from exactly one
// valid recovery attempt with identity MATCH. Unknown pages/cells, duplicate
// valid attempts, identity mismatch, a VD6A present in both files, or a wrong
// probe are rejected. Every cell reports its source; the raw files are never
// modified.
// Usage: node vview_evaluate.cjs <ib11-vview-results.json> [--recovery <ib11-vview-recovery.json>] [--g3-preflight-ref <ib11-vview-g3-preflight.json>]
//        node vview_evaluate.cjs --preflight <ib11-vview-g3-preflight.json>
//        node vview_evaluate.cjs --p1 <ib11-p1-native.json>
//        node vview_evaluate.cjs --p2 <ib11-p2-vd1.json>
//        node vview_evaluate.cjs --p3 <ib11-p3-vd5.json>
//        node vview_evaluate.cjs --p4 <ib11-p4-vd6a.json>
//        node vview_evaluate.cjs --p5 <ib11-p5-vd6b.json>
//        node vview_evaluate.cjs --p6 tests/results/ib11-p6-vd4.json
const fs = require('fs');

const REVISION = '1.3';
const RECOVERY = { NATIVE: 'NATIVE_R', VD6A: 'TAKEOVER' };
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
      const k = c.control || {};
      if (!c.control) { inv('no native-control transition recorded'); break; }
      if (k.trusted !== true) inv('the play/pause transition is not trusted (synthetic media events are not native-control evidence)');
      if ((k.productionCallsDuringPrompt || []).length) inv('the transition was caused by production, not the native control');
      if (k.surfacePointerBeforeTransition) inv('the click hit the video surface, not the native control');
      if (k.pausedBefore === k.pausedAfter) inv('no effective native-control transition');
      if (!k.focusAfter || k.focusAfter.tag !== 'VIDEO' || !c.premise) { inv(`premise not met: the native-control action did not focus the video (${k.focusAfter && k.focusAfter.tag})`); break; }
      const sp = c.space;
      if (!sp) { inv('no Space observation recorded'); break; }
      if (!sp.focusBefore || sp.focusBefore.tag !== 'VIDEO') inv(`video not focused before Space (${sp.focusBefore && sp.focusBefore.tag})`);
      if (!sp.focusAfter || sp.focusAfter.tag !== 'VIDEO') inv(`focus lost during the Space action (${sp.focusAfter && sp.focusAfter.tag})`);
      const tFirst = sp.firstTransition ? sp.firstTransition.t : Infinity;
      const foreign = (sp.jsCalls || []).filter((x) => x.t <= tFirst && x.caller !== 'togglePlayPause');
      if (foreign.length) inv('page JavaScript other than the production key handler called play()/pause() before the first transition');
      const keyVisible = !!sp.keyVisible;
      if (!sp.firstTransition && !keyVisible) inv('INCONCLUSIVE: no media consequence and no visible key in the Space window');
      if (keyVisible && (sp.keys || []).some((x) => x.trusted === false)) inv('a visible Space event is not trusted');
      const n = (sp.transitions || []).length; const effective = sp.pausedBefore !== sp.pausedAfter;
      const prod = (sp.jsCalls || []).some((x) => x.caller === 'togglePlayPause');
      const dp = (sp.keys || []).some((x) => x.type === 'keydown' && x.defaultPrevented);
      let kind; let code;
      if (n === 0) { kind = 'no toggle'; code = 'DEFECT_CONFIRMED'; }
      else if (n === 1 && effective) { kind = prod ? 'production-handled single (default suppressed)' : 'native-only single'; code = 'BEHAVIOR_OK'; if (prod && keyVisible && !dp) kind = 'production-handled single (default not suppressed)'; }
      else { kind = 'double toggle'; code = 'DEFECT_CONFIRMED'; }
      finding = { code, detail: { kind, transitions: n, effective, productionHandler: prod, keyVisible, defaultPrevented: keyVisible ? dp : null, nativeImplicated: n >= 2 || (n === 1 && !prod) } };
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
      if (c.rev === '1.3') {
        const L = c.link || {}; const b = L.box; const k = c.click;
        if (!dimsOk(b)) inv('link not actually visible (zero or missing box)');
        if (!L.pointerEvents || !(L.chain || []).length || (L.chain || []).some((x) => !x.pointerEvents)) inv('pointer-events evidence missing');
        if (!c.hit || !c.hit.target) inv('elementFromPoint not recorded');
        if (!L.destination || L.destination.kind !== 'card-post' || !L.destination.cardMatch) bad('link destination is not the card native post');
        if (!k) inv('no prompted click recorded');
        else {
          if (k.trusted !== true) inv('click not trusted (synthetic clicks are not evidence)');
          const inside = !!b && k.x >= b.x - 1 && k.x <= b.x + b.w + 1 && k.y >= b.y - 1 && k.y <= b.y + b.h + 1;
          if (!inside) inv('click outside the recorded link box');
          if (k.linkPresentAtClick !== true) inv('link not present when the click arrived (viewer already closed)');
        }
        const arrivals = ctx.arrivals.filter((a) => a.page === ctx.page && a.card === 'NATIVE');
        const arrivedAfter = !!k && arrivals.some((a) => a.wall >= k.wall - 100);
        if (arrivals.length && !arrivedAfter) inv('destination arrival without the prompted click');
        if (c.navigated !== true && c.navigated !== false) inv('navigation outcome not observed');
        const peNone = L.pointerEvents === 'none'; const hitLink = !!(c.hit && c.hit.isLink); const tLink = !!(k && k.targetIsLink);
        if (peNone && hitLink) inv('elementFromPoint mismatch: pointer-events none but the hit test returned the link');
        let code = 'INCONCLUSIVE'; let kind = 'ambiguous';
        if (tLink && arrivedAfter && hitLink && !peNone) { code = 'BEHAVIOR_OK'; kind = 'the visible link receives the click and reaches the native post'; }
        else if (!tLink && !arrivedAfter && (peNone || !hitLink)) { code = 'DEFECT_CONFIRMED'; kind = peNone ? 'visible link is not hit-testable (computed pointer-events: none); clicks fall through' : 'visible link is covered by another element'; }
        else inv('ambiguous: click target, hit test and navigation disagree');
        finding = { code, detail: { kind, linkPointerEvents: L.pointerEvents, chain: L.chain, hit: c.hit, clickTarget: k && k.target, clickTargetIsLink: tLink, clickDefaultPrevented: k && k.defaultPrevented, viewerAfterClick: c.after, navigated: c.navigated, destinationArrived: arrivedAfter, outsideBoxClicks: c.outsideBoxClicks } };
        break;
      }
      const f = c.failed || {};
      if (f.link !== 'card-post' || !dimsOk(f.linkBox)) bad('native link not visible after the failure');
      if (!isTrusted(c.click)) inv('native link click not trusted (programmatic clicks are not evidence)');
      const arrived = ctx.arrivals.some((a) => a.page === ctx.page && a.card === 'NATIVE' && (!c.click || a.wall >= c.click.wall - 100));
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

const ctxOf = (d, page) => ({ page, fixtures: d.fixtures || {}, requests: d.requests || [], arrivals: d.arrivals || [] });
function pick(doc, pid, problems, invalidAttempts, tag = '') {
  const all = (doc.pages || []).filter((p) => p.page === pid);
  for (const p of all) if (p.client && p.client.error) invalidAttempts.push({ page: `${tag}${pid}`, attempt: p.attempt, error: p.client.error });
  const valid = all.filter((p) => p.client && !p.client.error);
  if (valid.length > 1) problems.push(`AMBIGUOUS: ${valid.length} valid attempts for ${tag}${pid}`);
  return valid.length === 1 ? valid[0] : null;
}
function evaluate(doc, { recovery = null, provenance = null } = {}) {
  const problems = []; const invalidAttempts = [];
  if (!doc || doc.probe !== 'ib11-vview') return { kind: 'vview', revision: REVISION, evidencePass: false, problems: ['not an ib11-vview result'], cells: [] };
  const sources = {};
  const main = pick(doc, 'MAIN', problems, invalidAttempts);
  if (!main && !problems.some((x) => /MAIN/.test(x))) problems.push('no valid attempt for MAIN');
  if (main) for (const id of MAIN_CELLS) sources[id] = { c: main.client.cells && main.client.cells[id], ctx: ctxOf(doc, 'MAIN'), source: 'original', identity: main.client.identity };
  const tk = pick(doc, 'TAKEOVER', problems, invalidAttempts);
  if (tk) sources.VD6A = { c: tk.client.cells && tk.client.cells.VD6A, ctx: ctxOf(doc, 'TAKEOVER'), source: 'original', identity: tk.client.identity };
  let merge = null;
  if (recovery) {
    merge = { problems: [], replaced: [], invalidAttempts: [] };
    if (!recovery || recovery.probe !== 'ib11-vview-recovery') merge.problems.push('not an ib11-vview-recovery result');
    else {
      for (const p of recovery.pages || []) {
        if (!Object.values(RECOVERY).includes(p.page)) merge.problems.push(`unauthorized recovery page ${p.page}`);
        for (const k of Object.keys((p.client && p.client.cells) || {})) if (RECOVERY[k] !== p.page) merge.problems.push(`unauthorized recovery cell ${k} on ${p.page}`);
      }
      for (const [id, pid] of Object.entries(RECOVERY)) {
        const before = merge.problems.length;
        const p = pick(recovery, pid, merge.problems, merge.invalidAttempts, 'recovery:');
        if (merge.problems.length > before) continue;
        if (!p) { merge.problems.push(`no valid recovery attempt for ${id}`); continue; }
        if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') { merge.problems.push(`recovery ${pid} identity ${p.client.identity}`); continue; }
        if (id === 'VD6A' && tk) { merge.problems.push('ambiguous provenance: VD6A has a valid attempt in both the original and the recovery'); continue; }
        merge.replaced.push({ cell: id, previousSource: sources[id] ? sources[id].source : null, recoveryPage: pid, attempt: p.attempt, recoverySha256: (provenance && provenance.recoverySha256) || null });
        sources[id] = { c: p.client.cells && p.client.cells[id], ctx: ctxOf(recovery, pid), source: 'recovery', identity: p.client.identity };
      }
    }
  } else if (!tk && !problems.some((x) => /TAKEOVER/.test(x))) problems.push('no valid attempt for TAKEOVER');
  const cells = [];
  for (const id of [...MAIN_CELLS, ...TAKEOVER_CELLS]) {
    const src = sources[id];
    if (!src) { cells.push({ id, evidence: 'INVALID', reasons: ['INVALID no single valid source for this cell'], finding: null, source: null }); continue; }
    const r = evalCell(id, src.c, src.ctx);
    if (src.identity !== 'MATCH_EXPECTED_ARTIFACT') { r.evidence = 'FAIL'; r.reasons.push('FAIL wrong production artifact'); }
    r.source = src.source; cells.push(r);
  }
  for (const pid of ['MAIN', 'TAKEOVER']) { const p = pid === 'MAIN' ? main : tk; if (p && p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') problems.push(`${pid} identity ${p.client.identity}`); }
  const runtime = main ? main.client.runtime : null;
  const evidencePass = !problems.length && !(merge && merge.problems.length) && cells.every((c) => c.evidence === 'PASS');
  return { kind: 'vview', revision: REVISION, runtime, provenance: provenance || null, recovery: merge, problems, invalidAttempts, evidencePass,
    counts: cells.reduce((m, c) => { m[c.evidence] = (m[c.evidence] || 0) + 1; return m; }, {}),
    findings: Object.fromEntries(cells.map((c) => [c.id, c.finding ? c.finding.code : null])),
    sources: Object.fromEntries(cells.map((c) => [c.id, c.source])), cells };
}

// G3 preflight (evidence-tool qualification only; never replaces the V-VIEW G3
// cell): one page (G3PRE), one valid attempt, identity MATCH, and the G3 cell's
// evidence PASS -> "G3 PREFLIGHT COMPLETE"; anything else -> "INVALID".
function evaluatePreflight(doc) {
  if (!doc || doc.probe !== 'ib11-vview-g3-preflight') return { kind: 'g3-preflight', revision: REVISION, verdict: 'INVALID', problems: ['not an ib11-vview-g3-preflight result'] };
  const all = (doc.pages || []).filter((p) => p.page === 'G3PRE');
  const valid = all.filter((p) => p.client && !p.client.error);
  const problems = [];
  if (valid.length !== 1) problems.push(valid.length ? `AMBIGUOUS: ${valid.length} valid attempts` : 'no valid attempt');
  const p = valid[0];
  if (p && p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') problems.push(`identity ${p.client.identity}`);
  const cell = p ? evalCell('G3', p.client.cells && p.client.cells.G3, { page: 'G3PRE', fixtures: doc.fixtures || {}, requests: doc.requests || [], arrivals: [] }) : null;
  const verdict = !problems.length && cell && cell.evidence === 'PASS' ? 'G3 PREFLIGHT COMPLETE' : 'INVALID';
  return { kind: 'g3-preflight', revision: REVISION, verdict, problems, runtime: p ? p.client.runtime : null, cell };
}

// IB11-P1 (V-D8 repair) qualification: one page P1_NATIVE, one valid attempt,
// identity MATCH (the repaired production). STAGECLOSE: E = trusted click on
// the empty stage (target .be-viewer-stage); F = BEHAVIOR_OK if the viewer
// closed. NATIVE: the revision-1.3 rule. Verdict "V-D8 REPAIR QUALIFIED" only
// when both have evidence PASS and NATIVE is BEHAVIOR_OK (the link receives
// the click and reaches the native post) and STAGECLOSE is BEHAVIOR_OK.
function evaluateP1(doc) {
  const out = { kind: 'ib11-p1', revision: REVISION, verdict: 'NOT QUALIFIED', problems: [], cells: {} };
  if (!doc || doc.probe !== 'ib11-p1-native') { out.problems.push('not an ib11-p1-native result'); return out; }
  const invalid = [];
  const p = pick(doc, 'P1_NATIVE', out.problems, invalid);
  out.invalidAttempts = invalid;
  if (!p) { if (!out.problems.length) out.problems.push('no valid attempt for P1_NATIVE'); return out; }
  out.runtime = p.client.runtime;
  if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') out.problems.push(`identity ${p.client.identity}`);
  const sc = p.client.cells && p.client.cells.STAGECLOSE; const reasons = [];
  if (!sc) reasons.push('INVALID no STAGECLOSE record');
  else {
    if (!sc.click || sc.click.trusted !== true) reasons.push('INVALID stage click not trusted');
    if (sc.click && !sc.click.targetIsStage) reasons.push('INVALID click did not land on the empty stage');
    if (sc.outsideTrusted) reasons.push('INVALID trusted input outside a prompt');
  }
  out.cells.STAGECLOSE = { evidence: reasons.length ? 'INVALID' : 'PASS', reasons, finding: sc ? { code: sc.openAfter === false ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { viewerClosed: sc.openAfter === false } } : null };
  out.cells.NATIVE = evalCell('NATIVE', p.client.cells && p.client.cells.NATIVE, ctxOf(doc, 'P1_NATIVE'));
  const n = out.cells.NATIVE; const s = out.cells.STAGECLOSE;
  if (!out.problems.length && n.evidence === 'PASS' && s.evidence === 'PASS' && n.finding && n.finding.code === 'BEHAVIOR_OK' && s.finding.code === 'BEHAVIOR_OK') out.verdict = 'V-D8 REPAIR QUALIFIED';
  return out;
}

// IB11-P2 (V-D1 repair) qualification: one page P2_VD1, one valid attempt,
// identity MATCH. VD1P2: E = a real failure (error event; failure text and
// native link) before the update, the failed media element unchanged, no
// trusted input outside a prompt; F = BEHAVIOR_OK when the failure text and
// the native link are still present 0 ms and 500 ms after the late same-post
// update, DEFECT_CONFIRMED when they were erased. NATIVE (only when the link
// survived): the revision-1.3 rule. Verdict "V-D1 REPAIR QUALIFIED" only when
// VD1P2 is PASS / BEHAVIOR_OK and NATIVE is PASS / BEHAVIOR_OK.
function evaluateP2(doc) {
  const out = { kind: 'ib11-p2', revision: REVISION, verdict: 'NOT QUALIFIED', problems: [], cells: {} };
  if (!doc || doc.probe !== 'ib11-p2-vd1') { out.problems.push('not an ib11-p2-vd1 result'); return out; }
  const invalid = [];
  const p = pick(doc, 'P2_VD1', out.problems, invalid);
  out.invalidAttempts = invalid;
  if (!p) { if (!out.problems.length) out.problems.push('no valid attempt for P2_VD1'); return out; }
  out.runtime = p.client.runtime;
  if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') out.problems.push(`identity ${p.client.identity}`);
  const c = p.client.cells && p.client.cells.VD1P2; const reasons = [];
  if (!c) reasons.push('INVALID no VD1P2 record');
  else {
    const b0 = c.before || {};
    if (!c.failEvent || b0.link !== 'card-post' || !/failed/i.test(b0.state || '')) reasons.push('INVALID no real failure state with a native link before the update');
    if (!c.sameMedia) reasons.push('INVALID the failed media element changed (not a same-media update)');
    if (c.outsideTrusted) reasons.push('INVALID trusted input outside a prompt');
  }
  const kept = (s) => !!s && s.link === 'card-post' && /failed/i.test(s.state || '');
  const preserved = !!c && kept(c.after0) && kept(c.after500);
  out.cells.VD1P2 = { evidence: reasons.length ? 'INVALID' : 'PASS', reasons,
    finding: c ? { code: preserved ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { before: c.before && { state: c.before.state, link: c.before.link }, after0: c.after0 && { state: c.after0.state, link: c.after0.link }, after500: c.after500 && { state: c.after500.state, link: c.after500.link }, sameLinkNode: c.sameLinkNode } } : null };
  if (preserved) out.cells.NATIVE = evalCell('NATIVE', p.client.cells && p.client.cells.NATIVE, ctxOf(doc, 'P2_VD1'));
  const v = out.cells.VD1P2; const n = out.cells.NATIVE;
  if (!out.problems.length && v.evidence === 'PASS' && v.finding.code === 'BEHAVIOR_OK' && n && n.evidence === 'PASS' && n.finding && n.finding.code === 'BEHAVIOR_OK') out.verdict = 'V-D1 REPAIR QUALIFIED';
  return out;
}

// IB11-P3 (V-D5 repair) qualification: one page P3_VD5, one valid attempt,
// identity MATCH. VD5 (trusted Ctrl+F, Ctrl+D; revision-1.3 evidence rule):
// each chord invokes no Favorite / Download and is NOT preventDefault-ed, and
// the viewer stays open. P3KEYS: trusted Alt+O invokes no Open original /
// Favorite / Download and is not prevented; trusted unmodified F invokes
// Favorite exactly once and D invokes Download exactly once, both prevented.
// No trusted input outside a prompt. Verdict "V-D5 REPAIR QUALIFIED" only when
// all hold. defaultPrevented is the viewer's decision, measured by the runner's
// window bubble-phase listener (after production's document listener); for
// Ctrl+D that listener then suppresses Chrome's bookmark (required: no bookmark
// mutation). (Meta is not exercised in real Chrome on Windows: it is the
// Windows key and Win+D shows the desktop; the jsdom regression covers Meta.)
function evaluateP3(doc) {
  const out = { kind: 'ib11-p3', revision: REVISION, verdict: 'NOT QUALIFIED', problems: [], cells: {} };
  if (!doc || doc.probe !== 'ib11-p3-vd5') { out.problems.push('not an ib11-p3-vd5 result'); return out; }
  const invalid = [];
  const p = pick(doc, 'P3_VD5', out.problems, invalid);
  out.invalidAttempts = invalid;
  if (!p) { if (!out.problems.length) out.problems.push('no valid attempt for P3_VD5'); return out; }
  out.runtime = p.client.runtime;
  if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') out.problems.push(`identity ${p.client.identity}`);
  const cells = p.client.cells || {};
  const v = evalCell('VD5', cells.VD5, ctxOf(doc, 'P3_VD5'));
  if (cells.VD5 && cells.VD5.outsideTrusted) out.problems.push('INVALID trusted input outside a prompt (VD5)');
  for (const x of (cells.VD5 && cells.VD5.chords) || []) if (x.defaultPrevented !== true && x.defaultPrevented !== false) out.problems.push(`INVALID Ctrl+${String(x.want).toUpperCase()}: the viewer's defaultPrevented was not measured`);
  { const x = ((cells.VD5 && cells.VD5.chords) || []).find((y) => y.want === 'd'); if (x && x.runnerSuppressedBrowserDefault !== true) out.problems.push('INVALID Ctrl+D: the runner did not suppress the browser bookmark default'); }
  const ch = (cells.VD5 && cells.VD5.chords) || [];
  const chordOk = ['f', 'd'].map((w) => { const x = ch.find((y) => y.want === w); return { want: `ctrl+${w}`, ok: !!x && x.fav === 0 && x.dl === 0 && x.defaultPrevented === false && x.openAfter === true, fav: x && x.fav, dl: x && x.dl, defaultPrevented: x && x.defaultPrevented }; });
  out.cells.VD5 = { evidence: v.evidence, reasons: v.reasons, finding: { code: chordOk.every((x) => x.ok) ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: chordOk } };
  const k = cells.P3KEYS; const reasons = []; const rows = (k && k.rows) || [];
  const row = (w) => rows.find((x) => x.want === w);
  if (!k) reasons.push('INVALID no P3KEYS record');
  else {
    if (k.outsideTrusted) reasons.push('INVALID trusted input outside a prompt');
    for (const w of ['alt+o', 'f', 'd']) { const x = row(w); if (!x) reasons.push(`INVALID ${w} not recorded`); else if (x.trusted !== true) reasons.push(`INVALID ${w} not trusted (synthetic input is not browser evidence)`); }
    const a = row('alt+o'); if (a && (!a.altKey || String(a.key).toLowerCase() !== 'o')) reasons.push('FAIL alt+o modifier/key fields wrong');
    for (const w of ['f', 'd']) { const x = row(w); if (x && (x.ctrlKey || x.metaKey || x.altKey || x.shiftKey || x.key !== w)) reasons.push(`FAIL ${w} not an unmodified key`); }
    for (const x of rows) if (x.defaultPrevented !== true && x.defaultPrevented !== false) reasons.push(`INVALID ${x.want}: the viewer's defaultPrevented was not measured`);
  }
  const a = row('alt+o'); const f = row('f'); const d = row('d');
  const keysOk = !!a && a.open === 0 && a.fav === 0 && a.dl === 0 && a.defaultPrevented === false && !!f && f.fav === 1 && f.defaultPrevented === true && !!d && d.dl === 1 && d.defaultPrevented === true;
  out.cells.P3KEYS = { evidence: reasons.length ? (reasons.some((x) => x.startsWith('INVALID')) ? 'INVALID' : 'FAIL') : 'PASS', reasons,
    finding: { code: keysOk ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { altO: a && { open: a.open, fav: a.fav, dl: a.dl, defaultPrevented: a.defaultPrevented }, f: f && { fav: f.fav, defaultPrevented: f.defaultPrevented }, d: d && { dl: d.dl, defaultPrevented: d.defaultPrevented } } } };
  if (!out.problems.length && out.cells.VD5.evidence === 'PASS' && out.cells.VD5.finding.code === 'BEHAVIOR_OK' && out.cells.P3KEYS.evidence === 'PASS' && out.cells.P3KEYS.finding.code === 'BEHAVIOR_OK') out.verdict = 'V-D5 REPAIR QUALIFIED';
  return out;
}

// IB11-P4 (V-D6a repair) qualification: the unchanged TAKEOVER page, one valid
// attempt, identity MATCH. VD6A (revision-1.3 evidence rule): a trusted
// ordinary click on the armed video card; the volume seam threw from
// buildMedia; navigation not cancelled; the page left and the native
// destination recorded the arrival; the revision-1.3 finding is BEHAVIOR_OK
// (no overlay shown and destination reached). P4 additionally requires that
// right after the failed takeover no viewer shell or partial state remains:
// overlay not displayed, viewer not open, no current post, empty stage (no
// media, no state, no link), and the overlay not displayed at page exit.
// Verdict "V-D6a REPAIR QUALIFIED" only when all hold.
function evaluateP4(doc) {
  const out = { kind: 'ib11-p4', revision: REVISION, verdict: 'NOT QUALIFIED', problems: [], cells: {} };
  if (!doc || doc.probe !== 'ib11-p4-vd6a') { out.problems.push('not an ib11-p4-vd6a result'); return out; }
  const invalid = [];
  const p = pick(doc, 'TAKEOVER', out.problems, invalid);
  out.invalidAttempts = invalid;
  if (!p) { if (!out.problems.length) out.problems.push('no valid attempt for TAKEOVER'); return out; }
  out.runtime = p.client.runtime;
  if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') out.problems.push(`identity ${p.client.identity}`);
  const c = (p.client.cells || {}).VD6A;
  const v = evalCell('VD6A', c, ctxOf(doc, 'TAKEOVER'));
  const o = (c && c.overlayAtClick) || {};
  const shell = { display: o.display, open: o.open, currentId: o.currentId, children: o.children, media: !!o.media, state: o.state || '', link: o.link || '', overlayAtLeave: c && c.overlayAtLeave };
  const reasons = [];
  if (c && c.outsideTrusted) reasons.push('INVALID trusted input outside a prompt');
  if (c && c.defaultPrevented !== false) reasons.push('FAIL native navigation cancelled (or not measured)');
  if (c && c.navigated !== true) reasons.push('FAIL the page did not leave for the native post');
  const clean = o.display !== 'flex' && o.open === false && o.currentId == null && o.children === 0 && !o.media && !o.state && !o.link && c && c.overlayAtLeave !== 'flex';
  out.cells.VD6A = { evidence: v.evidence === 'PASS' && !reasons.some((x) => x.startsWith('INVALID')) ? (reasons.length ? 'FAIL' : 'PASS') : v.evidence === 'PASS' ? 'INVALID' : v.evidence,
    reasons: [...v.reasons, ...reasons], finding: { code: v.finding && v.finding.code === 'BEHAVIOR_OK' && clean ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { ...(v.finding && v.finding.detail), shellAfterFailure: shell, seamThrew: !!(c && (c.seam || []).some((x) => x.fromBuildMedia)), seamError: c && (c.seam || [])[0] && c.seam[0].name } } };
  if (!out.problems.length && out.cells.VD6A.evidence === 'PASS' && out.cells.VD6A.finding.code === 'BEHAVIOR_OK') out.verdict = 'V-D6a REPAIR QUALIFIED';
  return out;
}

// IB11-P5 (V-D6b repair) qualification: one page P5_VD6B, one valid attempt,
// identity MATCH. VD6BP5: a valid open image (VD6B_A: complete, current); a
// trusted unmodified ArrowRight; the recorder seam threw from buildMedia; the
// selection moved to the failing video target (NATIVE). BEHAVIOR_OK only when,
// at 50 ms AND at 1000 ms, the viewer is open on the target with no media in
// the stage, failure text, and the native link to the target's post; no
// img/video anywhere in the viewer; the previous image detached; the status
// names the target. NATIVE (revision-1.3 rule, the same viewer): the link is
// hit-tested, receives a trusted click and reaches the target's native post.
// No trusted input outside a prompt. Verdict "V-D6b REPAIR QUALIFIED" only
// when VD6BP5 and NATIVE are both PASS / BEHAVIOR_OK.
function evaluateP5(doc) {
  const out = { kind: 'ib11-p5', revision: REVISION, verdict: 'NOT QUALIFIED', problems: [], cells: {} };
  if (!doc || doc.probe !== 'ib11-p5-vd6b') { out.problems.push('not an ib11-p5-vd6b result'); return out; }
  const invalid = [];
  const p = pick(doc, 'P5_VD6B', out.problems, invalid);
  out.invalidAttempts = invalid;
  if (!p) { if (!out.problems.length) out.problems.push('no valid attempt for P5_VD6B'); return out; }
  out.runtime = p.client.runtime;
  if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') out.problems.push(`identity ${p.client.identity}`);
  const cells = p.client.cells || {}; const c = cells.VD6BP5; const reasons = [];
  if (!c) reasons.push('INVALID no VD6BP5 record');
  let code = 'DEFECT_CONFIRMED'; let detail = null;
  if (c) {
    const toId = String(c.toId); const fromId = String(c.fromId); const b = c.before || {};
    if (c.outsideTrusted) reasons.push('INVALID trusted input outside a prompt');
    if (!c.key || c.key.trusted !== true) reasons.push('INVALID ArrowRight not trusted (synthetic input is not browser evidence)');
    else if (c.key.key !== 'ArrowRight' || c.key.ctrlKey || c.key.metaKey || c.key.altKey || c.key.shiftKey) reasons.push('FAIL navigation key is not an unmodified ArrowRight');
    if (!(c.seam || []).some((x) => x.fromBuildMedia && x.name === 'IndexSizeError')) reasons.push('INVALID failure seam did not throw IndexSizeError from buildMedia');
    if (!c.ready || !b.open || !b.media || b.media.tag !== 'IMG' || b.media.complete !== true || String(b.currentId) !== fromId || b.state) reasons.push('FAIL did not start from a valid open image');
    const comm = (a) => !!a && a.open === true && String(a.currentId) === toId && !a.media && /failed/i.test(a.state || '') && a.link === 'card-post';
    const a = c.after1000 || {};
    if (String(a.currentId) !== toId) reasons.push(`FAIL selection did not move to the failing target (${a.currentId})`);
    const ok = comm(c.after50) && comm(a) && c.overlayMedia === 0 && c.prevConnected === false && c.linkPath === `/posts/${toId}` && String(c.status || '').startsWith(`#${toId}`);
    const blank = a.open && !a.media && !a.state && !a.link;
    code = ok ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED';
    detail = { blank, after50: c.after50 && { open: c.after50.open, currentId: c.after50.currentId, media: !!c.after50.media, state: c.after50.state, link: c.after50.link },
      after1000: { open: a.open, currentId: a.currentId, media: !!a.media, state: a.state, link: a.link, children: a.children }, overlayMedia: c.overlayMedia, previousMediaConnected: c.prevConnected,
      linkPath: c.linkPath, targetPost: `/posts/${toId}`, status: c.status, statusBefore: c.statusBefore, seam: (c.seam || []).map((x) => ({ name: x.name, value: x.value, fromBuildMedia: x.fromBuildMedia })), keyDefaultPrevented: c.key && c.key.defaultPrevented };
  }
  out.cells.VD6BP5 = { evidence: reasons.some((x) => x.startsWith('INVALID')) ? 'INVALID' : (reasons.length ? 'FAIL' : 'PASS'), reasons, finding: { code, detail } };
  if (cells.NATIVE) { const n = evalCell('NATIVE', cells.NATIVE, ctxOf(doc, 'P5_VD6B')); out.cells.NATIVE = { evidence: n.evidence, reasons: n.reasons, finding: n.finding }; }
  if (!out.problems.length && out.cells.VD6BP5.evidence === 'PASS' && code === 'BEHAVIOR_OK' && out.cells.NATIVE && out.cells.NATIVE.evidence === 'PASS' && out.cells.NATIVE.finding.code === 'BEHAVIOR_OK') out.verdict = 'V-D6b REPAIR QUALIFIED';
  return out;
}

// IB11-P6 (V-D4 repair) qualification: one page P6_VD4, one valid attempt,
// identity MATCH. VD4 (revision-1.3 rule): two trusted resizes; fit-both; the
// wide fixture complete at its dimensions; non-zero stage/media rectangles;
// unrotated fit inside the stage; rotate(90deg) present after each resize;
// BEHAVIOR_OK = no overflow beyond the stage. P6 additionally requires, after
// each resize, the rotated media to lie within the Fit area (stage minus 24 px
// per axis, 2 px rounding tolerance) with the two resizes giving different
// viewports; and the screenshot step completed (trusted Enter) with the
// rotated fit still present. No trusted input outside a prompt. Verdict
// "V-D4 REPAIR QUALIFIED" only when all hold. (The screenshot file itself is
// returned by the operator; its SHA-256 is recorded at closure.)
function evaluateP6(doc) {
  const out = { kind: 'ib11-p6', revision: REVISION, verdict: 'NOT QUALIFIED', problems: [], cells: {} };
  if (!doc || doc.probe !== 'ib11-p6-vd4') { out.problems.push('not an ib11-p6-vd4 result'); return out; }
  const invalid = [];
  const p = pick(doc, 'P6_VD4', out.problems, invalid);
  out.invalidAttempts = invalid;
  if (!p) { if (!out.problems.length) out.problems.push('no valid attempt for P6_VD4'); return out; }
  out.runtime = p.client.runtime;
  if (p.client.identity !== 'MATCH_EXPECTED_ARTIFACT') out.problems.push(`identity ${p.client.identity}`);
  const cells = p.client.cells || {}; const c = cells.VD4;
  const v = evalCell('VD4', c, ctxOf(doc, 'P6_VD4'));
  const reasons = [];
  const fitArea = (s) => { const m = s && s.media && s.media.rect; const st = s && s.stage; if (!m || !st) return null; return { mediaW: m.w, mediaH: m.h, availW: st.w - 24, availH: st.h - 24, inside: m.w <= st.w - 24 + 2 && m.h <= st.h - 24 + 2 }; };
  const fa = { afterResize1: fitArea(c && c.sA), afterResize2: fitArea(c && c.sB) };
  if (c) {
    if (c.outsideTrusted) reasons.push('INVALID trusted input outside a prompt');
    if (!c.sRot || !c.sRot.media || !/rotate\(90deg\)/.test(c.sRot.media.transform || '')) reasons.push('FAIL rotation not applied by the viewer control');
    if (!(c.sA && c.sB && c.sA.stage && c.sB.stage) || (c.sA.stage.w === c.sB.stage.w && c.sA.stage.h === c.sB.stage.h)) reasons.push('FAIL the two resizes did not change the stage');
  }
  const sh = cells.SHOT;
  if (!sh || !sh.enter || sh.enter.trusted !== true) reasons.push('INVALID screenshot step not completed (trusted Enter missing)');
  else {
    if (sh.outsideTrusted) reasons.push('INVALID trusted input outside a prompt (screenshot step)');
    if (!sh.sC || !sh.sC.open || !sh.sC.media || !/rotate\(90deg\)/.test(sh.sC.media.transform || '')) reasons.push('FAIL the rotated fit was not on screen at the screenshot step');
  }
  const insideOk = !!(fa.afterResize1 && fa.afterResize1.inside && fa.afterResize2 && fa.afterResize2.inside);
  const ev = [...v.reasons, ...reasons];
  out.cells.VD4 = { evidence: ev.some((x) => x.startsWith('INVALID')) ? 'INVALID' : (ev.length ? 'FAIL' : 'PASS'), reasons: ev,
    finding: { code: v.finding && v.finding.code === 'BEHAVIOR_OK' && insideOk ? 'BEHAVIOR_OK' : 'DEFECT_CONFIRMED', detail: { ...(v.finding && v.finding.detail), fitArea: fa, mediaB: c && c.sB && c.sB.media && c.sB.media.rect, stageB: c && c.sB && c.sB.stage, viewports: c && (c.resizes || []).map((r) => ({ w: r.w, h: r.h, trusted: r.trusted })), screenshotState: sh && sh.sC && { open: sh.sC.open, transform: sh.sC.media && sh.sC.media.transform } } } };
  if (!out.problems.length && out.cells.VD4.evidence === 'PASS' && out.cells.VD4.finding.code === 'BEHAVIOR_OK') out.verdict = 'V-D4 REPAIR QUALIFIED';
  return out;
}

module.exports = { evaluate, evaluatePreflight, evaluateP1, evaluateP2, evaluateP3, evaluateP4, evaluateP5, evaluateP6, evalCell, REVISION, MAIN_CELLS, TAKEOVER_CELLS, overflow };

if (require.main === module) {
  if (process.argv[2] === '--p6') {
    const r6 = evaluateP6(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    r6.sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(process.argv[3])).digest('hex');
    console.log(JSON.stringify(r6, null, 1)); process.exitCode = r6.verdict === 'V-D4 REPAIR QUALIFIED' ? 0 : 1; return;
  }
  if (process.argv[2] === '--p5') {
    const r5 = evaluateP5(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    r5.sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(process.argv[3])).digest('hex');
    console.log(JSON.stringify(r5, null, 1)); process.exitCode = r5.verdict === 'V-D6b REPAIR QUALIFIED' ? 0 : 1; return;
  }
  if (process.argv[2] === '--p4') {
    const r4 = evaluateP4(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    r4.sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(process.argv[3])).digest('hex');
    console.log(JSON.stringify(r4, null, 1)); process.exitCode = r4.verdict === 'V-D6a REPAIR QUALIFIED' ? 0 : 1; return;
  }
  if (process.argv[2] === '--p3') {
    const r3 = evaluateP3(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    r3.sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(process.argv[3])).digest('hex');
    console.log(JSON.stringify(r3, null, 1)); process.exitCode = r3.verdict === 'V-D5 REPAIR QUALIFIED' ? 0 : 1; return;
  }
  if (process.argv[2] === '--p2') {
    const r2 = evaluateP2(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    r2.sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(process.argv[3])).digest('hex');
    console.log(JSON.stringify(r2, null, 1)); process.exitCode = r2.verdict === 'V-D1 REPAIR QUALIFIED' ? 0 : 1; return;
  }
  if (process.argv[2] === '--p1') {
    const r1 = evaluateP1(JSON.parse(fs.readFileSync(process.argv[3], 'utf8')));
    r1.sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(process.argv[3])).digest('hex');
    console.log(JSON.stringify(r1, null, 1)); process.exitCode = r1.verdict === 'V-D8 REPAIR QUALIFIED' ? 0 : 1; return;
  }
  const pre = process.argv[2] === '--preflight';
  const file = process.argv[pre ? 3 : 2];
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const sha = (f) => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  let r;
  if (pre) r = evaluatePreflight(doc);
  else {
    const rec = arg('--recovery'); const pf = arg('--g3-preflight-ref');
    const provenance = { originalSha256: sha(file), recoverySha256: rec ? sha(rec) : null,
      g3Preflight: pf ? { sha256: sha(pf), verdict: evaluatePreflight(JSON.parse(fs.readFileSync(pf, 'utf8'))).verdict } : null };
    r = evaluate(doc, { recovery: rec ? JSON.parse(fs.readFileSync(rec, 'utf8')) : null, provenance });
  }
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = (pre ? r.verdict === 'G3 PREFLIGHT COMPLETE' : r.evidencePass) ? 0 : 1;
}
