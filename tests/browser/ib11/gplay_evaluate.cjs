'use strict';
// IB11 G-PLAY E evaluator (revision 1.0). Turns the controlled results
// (IB11_GPLAY_Controlled.user.js + gplay_server.cjs) into explicit per-cell
// verdicts. Three things are kept apart and never inferred from one another:
//   PREFERENCE  what production assigned (autoplay/loop/muted/defaultMuted/
//               volume/controls/preload at the first src) and later writes;
//   CAPABILITY  what the browser did: PLAYED only with a 'playing' event AND
//               currentTime advancing past 0.2 s; BLOCKED = no playback and no
//               error; ERROR = a media error; IDLE = autoplay off and no play()
//               attempted; CLOSED_BEFORE_READY; NONE = no viewer video. An
//               assigned autoplay attribute is never evidence of playback;
//   LIFECYCLE   release at close/replacement, stale generations, failure state.
// Criteria (a cell FAILs on any):
//   T0   page identity MATCH_EXPECTED_ARTIFACT; no trusted input outside a
//        prompt (otherwise the cell is CONTAMINATED and counts as missing);
//   PREF first viewer video's assigned values equal the cell's preferences
//        (muted and defaultMuted = mute; volume = stored if remember-volume,
//        else 1; controls on; preload auto);
//   MUTE no production write to muted after assignment (no forced remute);
//   PLAY every play() whose promise resolved is followed by 'playing'; no
//        'playing' without a resolved play() or an autoplay attribute; a
//        pending/rejected outcome is never counted as playback;
//   REL  at the cell end every viewer video is detached, holds no src, paused;
//   NOAUTO   autoplay=false: no production play() call and no 'play' event;
//   LOOP     after the near-end seek: loop=false -> 'ended' and no wrap;
//            loop=true -> a wrap and no 'ended' (INCONCLUSIVE if never played);
//   VOL      remember-volume on: first video at the stored volume, the harness
//            change stored, the next video at the new volume; off: volume 1,
//            nothing stored, next video at 1;
//   API      the metadata-update play() was called by production and its
//            outcome recorded (resolved or a rejection name);
//   FAILN    media failure: a failed-to-load state with a native post link;
//   CLOSE    close while pending/playing: no 'playing' after close; the
//            pending request did not complete a full body after close;
//   STALE    after moving to B: no 'playing' on A after B exists; the stage
//            never shows a failure for B; A released;
//   RETRY    (arm N) if the unmuted autoplay was BLOCKED, the trusted Space
//            press produced a resolved production play() (togglePlayPause)
//            and playback; if autoplay already played, recorded NOT_BLOCKED;
//   DELIB    (arm U) the trusted Unmute leaves A unmuted (no production
//            remute); B starts muted (preference) at A's volume.
// G-PLAY(TC) E: PASS only if all 4 pages and all cells are present and clean
// and every criterion passes. The capability table reports exactly what was
// observed; a blocked capability is acceptable only with its tested fallback.
// Usage: node gplay_evaluate.cjs <ib11-gplay-results.json>
const fs = require('fs');

const REVISION = '1.0';
const PAGES = ['N-mp4', 'N-webm', 'U-mp4', 'U-webm'];
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.011;
const has = (v, n) => v.ev.some((e) => e[1] === n);
const evAfter = (v, n, t) => v.ev.filter((e) => e[1] === n && e[0] > t);
const prodPlays = (v) => v.calls.filter((c) => c[1] === 'play' && c[2] !== 'harness');
const played = (v) => has(v, 'playing') && v.maxTime > 0.2;
function capability(vs, c = null) {
  if (!vs.length) return 'NONE';
  const v = vs[0];
  if (played(v)) return 'PLAYED';
  if (has(v, 'error')) return 'ERROR';
  if (c && c.name === 'CLOSEPEND') return 'CLOSED_BEFORE_READY';
  if (v.assigned && !v.assigned.autoplay && !v.calls.some((q) => q[1] === 'play')) return 'IDLE';
  return 'BLOCKED';
}
const markT = (c, what) => (c.marks.find((m) => m.what === what) || {}).t;

function evaluateCell(c, pg, requests) {
  const fails = [];
  const vs = c.videos || [];
  const A = vs[0] || null; const B = vs[1] || null;
  const f = (code, msg) => fails.push(`${code} ${msg}`);
  if (c.trustedOutsidePrompt) return { id: c.id, status: 'CONTAMINATED', fails: [`T0 ${c.trustedOutsidePrompt} trusted input(s) outside a prompt`] };
  const cap = capability(vs, c);
  if (c.name !== 'CLOSEPEND' && !A) f('PREF', 'no viewer video was created');
  if (A && A.assigned) {
    const x = A.assigned; const p = c.prefs; const vol = p.rememberVolume ? c.storedVolume : 1;
    if (x.autoplay !== p.autoplay || x.loop !== p.loop || x.muted !== p.mute || x.defaultMuted !== p.mute || x.controls !== true || x.preload !== 'auto' || !near(x.volume, vol)) f('PREF', `assigned ${JSON.stringify(x)} for ${JSON.stringify(p)} stored ${c.storedVolume}`);
  } else if (A) f('PREF', 'no src assignment recorded');
  for (const v of vs) {
    if (v.writes.some((w) => w[1] === 'muted' && w[3] === 'production')) f('MUTE', `production wrote muted after assignment on ${v.label}`);
    for (const p of prodPlays(v).concat(v.calls.filter((q) => q[1] === 'play' && q[2] === 'harness'))) if (p[4] === 'resolved' && !evAfter(v, 'playing', p[0] - 1).length && !v.ev.some((e) => e[1] === 'playing' && e[0] >= p[0] - 300)) f('PLAY', `play() resolved on ${v.label} without 'playing'`);
    if (has(v, 'playing') && !v.calls.some((q) => q[1] === 'play' && q[4] === 'resolved') && !(v.assigned && v.assigned.autoplay)) f('PLAY', `'playing' on ${v.label} without autoplay or a resolved play()`);
    if (v.now.attached || v.now.holdsSrc || !v.now.paused) f('REL', `${v.label} at cell end: ${JSON.stringify(v.now)}`);
  }
  let detail = {};
  switch (c.name) {
    case 'NOAUTO':
      if (A && (prodPlays(A).length || has(A, 'play'))) f('NOAUTO', `autoplay=false but ${prodPlays(A).length} production play() call(s) / play event`);
      break;
    case 'LOOPF': case 'LOOPT': {
      const ts = markT(c, 'seek-near-end');
      if (!A || !played(A) || ts == null) { detail.loop = 'INCONCLUSIVE'; f('LOOP', 'never played or no near-end seek (inconclusive)'); break; }
      const ended = evAfter(A, 'ended', ts).length; const wrap = evAfter(A, 'wrap', ts).length;
      if (c.prefs.loop ? (!wrap || ended) : (!ended || wrap)) f('LOOP', `loop=${c.prefs.loop}: ended ${ended}, wrap ${wrap}`);
      detail.loop = { ended, wrap };
      break;
    }
    case 'RVOFF': case 'RVON': {
      const want = c.prefs.rememberVolume ? 0.6 : c.storedVolume;
      if (!near(c.storeVolumeAfter, want)) f('VOL', `stored volume after ${c.storeVolumeAfter}, expected ${want}`);
      const bVol = B && B.assigned ? B.assigned.volume : null;
      if (!near(bVol, c.prefs.rememberVolume ? 0.6 : 1)) f('VOL', `next video volume ${bVol}`);
      break;
    }
    case 'PLAYREJ': case 'PLAYAPI': {
      const api = A ? A.calls.filter((q) => q[1] === 'play' && q[2] === 'updatePost') : [];
      if (!api.length) f('API', 'metadata update made no production play() call');
      else if (api.some((q) => q[4] === 'pending')) f('API', 'play() outcome never settled');
      detail.api = api.map((q) => q[4]);
      break;
    }
    case 'FAIL': {
      const s = c.stage.find(([, x]) => /failed to load/i.test(x.state) && x.link === 'card-post');
      if (!s) f('FAILN', 'no failed state with a native post link');
      break;
    }
    case 'CLOSEPEND': case 'CLOSEPLAY': {
      const tc = (c.marks.find((m) => m.what === 'key' && m.key === 'Escape') || {}).t;
      if (tc == null) { f('CLOSE', 'no close'); break; }
      for (const v of vs) if (evAfter(v, 'playing', tc + 50).length) f('CLOSE', `'playing' on ${v.label} after close`);
      if (c.name === 'CLOSEPLAY' && !(A && played(A))) f('CLOSE', 'never played before close (inconclusive)');
      if (c.name === 'CLOSEPEND') { const full = requests.filter((r) => r.label.endsWith('-PEND') && r.end === 'complete' && r.bytesSent > 1000000); if (full.length) f('CLOSE', 'pending request completed a full body after close'); }
      break;
    }
    case 'STALE': {
      if (!B) { f('STALE', 'no second video'); break; }
      if (evAfter(A, 'playing', B.created).length) f('STALE', "'playing' on A after B was created");
      if (c.stage.some(([t, x]) => t >= B.created && /failed/i.test(x.state))) f('STALE', 'failure state shown for B');
      detail.aPlay = A.calls.filter((q) => q[1] === 'play' && q[2] === 'updatePost').map((q) => q[4]);
      break;
    }
    case 'RETRY': {
      const tk = markT(c, 'retry-key'); const km = c.marks.find((m) => m.what === 'retry-key');
      if (!A) break;
      const before = A.ev.some((e) => e[1] === 'playing' && e[0] < (tk || Infinity)) && A.maxTime > 0.2;
      if (before) { detail.retry = 'NOT_BLOCKED'; break; }
      if (!km || !km.trusted) { f('RETRY', 'no trusted Space press'); break; }
      const tp = A.calls.filter((q) => q[1] === 'play' && q[2] === 'togglePlayPause' && q[0] >= tk - 50);
      if (!tp.length || tp[0][4] !== 'resolved' || !evAfter(A, 'playing', tk - 50).length) f('RETRY', `retry play ${tp.length ? tp[0][4] : 'missing'}; playing after ${evAfter(A, 'playing', tk - 50).length}`);
      detail.retry = tp.length ? tp[0][4] : 'missing';
      break;
    }
    case 'DELIB': {
      const um = c.marks.find((m) => m.what === 'unmute');
      if (!um || !um.trusted) { f('DELIB', 'no trusted Unmute click'); break; }
      if (!A || !A.writes.some((w) => w[1] === 'muted' && w[2] === 0 && w[3] === 'harness')) f('DELIB', 'unmute not applied');
      const tB = B ? B.created : Infinity;
      if (A && A.ev.some((e) => e[1] === 'volumechange' && e[0] > um.t && e[0] < tB && e[2] === 1)) f('DELIB', 'A was re-muted after the deliberate unmute');
      if (!B || !B.assigned || B.assigned.muted !== true || !near(B.assigned.volume, A && A.assigned ? A.assigned.volume : -1)) f('DELIB', `B ${JSON.stringify(B && B.assigned)}`);
      break;
    }
    default: break;
  }
  return { id: c.id, status: fails.length ? 'FAIL' : 'PASS', capability: cap, activation: c.activationBefore, fails, detail };
}

function evaluate(doc) {
  const pages = doc.pages || [];
  const out = [];
  const missing = PAGES.filter((p) => !pages.some((x) => x.page === p));
  for (const pg of pages) {
    const cl = pg.client || {};
    const cells = (cl.cells || []).map((c) => evaluateCell(c, pg, pg.requests || []));
    out.push({ page: pg.page, identity: cl.identity, runtime: cl.runtime, start: cl.start, error: cl.error, cells });
  }
  const pageFails = out.filter((p) => p.identity !== 'MATCH_EXPECTED_ARTIFACT' || p.error || (p.page.startsWith('U-') && !(p.start && p.start.trusted)));
  const allCells = out.flatMap((p) => p.cells);
  const expectedCells = 2 * 13 + 2 * 3;
  const complete = !missing.length && allCells.length === expectedCells && allCells.every((c) => c.status !== 'CONTAMINATED');
  const capabilityTable = Object.fromEntries(out.map((p) => [p.page, Object.fromEntries(p.cells.map((c) => [c.id.split('-').slice(2).join('-'), c.capability]))]));
  const pass = complete && !pageFails.length && allCells.every((c) => c.status === 'PASS');
  return { kind: 'gplay', revision: REVISION, missingPages: missing, complete, pageFailures: pageFails.map((p) => ({ page: p.page, identity: p.identity, error: p.error, start: p.start })),
    pass, counts: allCells.reduce((m, c) => { m[c.status] = (m[c.status] || 0) + 1; return m; }, {}), capabilityTable, failures: allCells.filter((c) => c.status !== 'PASS'), pages: out };
}

module.exports = { evaluate, evaluateCell, capability, REVISION };

if (require.main === module) {
  const r = evaluate(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.pass ? 0 : 1;
}
