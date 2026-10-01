/* IB10 V3-L CLASSIFY — test code, not production. Shared by the in-page observer
 * (progress counter only) and the offline analyzer (authoritative).
 * Per recorded video-card hover generation:
 *   CONTAMINATED - not triggered by a trusted (real) pointer event, the viewer was
 *                  opened during the generation's window or open at a sample point,
 *                  or the page was hidden at any sample point;
 *   AMBIGUOUS    - production created no hover <video> for it, created more than
 *                  one, its src was not the card's own data-file-url, or the leave
 *                  / +1 s / +5 s samples are missing;
 *   USABLE       - otherwise.
 * Readiness = first 'loadeddata' on the generation's hover element.
 * leave: BEFORE_READY (leave earlier than readiness, or no readiness) or AFTER_READY.
 * Transfer observations are kept apart and never inferred from DOM state:
 *   rtCompleted   - a Resource Timing entry for the card's file with responseEnd > 0;
 *   rtSizesHidden - such entries exist but expose no sizes (cross-origin);
 *   fullyBufferedAt5s - element-level: buffered end reaches the media duration. */
var IB10L_CLASSIFY = (function () {
  'use strict';
  function classify(g) {
    const reasons = [];
    const contaminated = [];
    if (g.trigger !== 'TRUSTED') contaminated.push(`trigger ${g.trigger}`);
    const samples = ['leave', 'p1', 'p5'].map((k) => (g.samples || {})[k]).filter(Boolean);
    if (g.viewerOpened || samples.some((s) => s.viewerOpen)) contaminated.push('viewer open');
    if (samples.some((s) => s.hidden)) contaminated.push('page hidden');
    const el = g.element;
    if (!g.hoverElements) reasons.push('no hover video created');
    if (g.hoverElements > 1) reasons.push('more than one hover video in the generation');
    if (el && el.srcMatchesCardFile !== true) reasons.push('hover src is not the card data-file-url');
    if (g.leaveT == null) reasons.push('no leave');
    for (const k of ['leave', 'p1', 'p5']) if (!(g.samples || {})[k]) reasons.push(`missing ${k} sample`);
    const readyT = el && el.readiness ? el.readiness.loadeddata : null;
    const leave = g.leaveT == null ? 'NONE' : (readyT != null && readyT <= g.leaveT ? 'AFTER_READY' : 'BEFORE_READY');
    const p5 = (g.samples || {}).p5;
    const p5el = p5 && p5.element;
    const rt = g.resourceTiming || [];
    return {
      status: contaminated.length ? 'CONTAMINATED' : (reasons.length ? 'AMBIGUOUS' : 'USABLE'),
      reasons: contaminated.concat(reasons),
      leave,
      rtCompleted: rt.some((e) => e.responseEnd > 0),
      rtSizesHidden: rt.length > 0 && rt.every((e) => !(e.transferSize > 0 || e.encodedBodySize > 0 || e.decodedBodySize > 0)),
      fullyBufferedAt5s: !!(p5el && p5el.duration && p5el.bufferedEnd >= p5el.duration - 0.05),
    };
  }
  return { classify };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = IB10L_CLASSIFY;
