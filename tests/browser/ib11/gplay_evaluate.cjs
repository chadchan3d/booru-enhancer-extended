'use strict';
// IB11 G-PLAY E evaluator (revision 1.1; revision 1.0 differs only as noted). Turns the controlled results
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
//   LOOP     judged only while the tested media is live: events after the
//            near-end seek and BEFORE the close/reset boundary (the first of:
//            the cell's Escape, a production removeSrc on that video, an
//            'abort' or 'emptied' on it). loop=false -> 'ended' and no wrap;
//            loop=true -> a wrap and no 'ended' (INCONCLUSIVE if never played).
//            [1.1] Revision 1.0 counted every event after the seek, so the
//            currentTime reset caused by close cleanup (removeSrc + load ->
//            abort/emptied, time 0) was read as a loop wrap;
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
//   DELIB    (arm U) A actually played before the Unmute prompt [1.1]; the
//            trusted Unmute leaves A unmuted (no production remute); B starts
//            muted (preference) at A's volume.
// Recovery merge [1.1] (evaluate(doc, { recovery, provenance })): a separately
// hashed recovery file (probe ib11-gplay-recovery) may supply ONLY the cells in
// RECOVERY_CELLS. Each must come from exactly one valid recovery attempt (no
// page error, identity MATCH, trusted Start); attempts with an error are
// INVALID and never evidence; two valid attempts for a cell, an unknown cell, a
// cell outside RECOVERY_CELLS or a cell missing from the original are rejected.
// The original raw file is never modified; replaced cells are listed with
// their provenance.
// G-PLAY(TC) E: PASS only if all 4 pages and all cells are present and clean
// and every criterion passes. The capability table reports exactly what was
// observed; a blocked capability is acceptable only with its tested fallback.
// Usage: node gplay_evaluate.cjs <ib11-gplay-results.json> [--recovery <ib11-gplay-recovery.json>]
const fs = require('fs');

const REVISION = '1.1';
const RECOVERY_CELLS = ['U-mp4-DELIB', 'U-webm-DELIB'];
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
      const tk = (c.marks.find((m) => m.what === 'key' && m.key === 'Escape' && m.t >= ts) || {}).t;
      const cands = [tk, ...A.calls.filter((q) => q[1] === 'removeSrc' && q[0] >= ts).map((q) => q[0]), ...A.ev.filter((e) => (e[1] === 'abort' || e[1] === 'emptied') && e[0] >= ts).map((e) => e[0])].filter((x) => typeof x === 'number');
      const boundary = cands.length ? Math.min(...cands) : Infinity;
      const live = (n) => A.ev.filter((e) => e[1] === n && e[0] > ts && e[0] < boundary).length;
      const ended = live('ended'); const wrap = live('wrap');
      detail.boundary = boundary === Infinity ? null : boundary - ts;
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
      if (!A || !A.ev.some((e) => e[1] === 'playing' && e[0] < um.t) || !(A.maxTime > 0.2)) f('DELIB', 'A did not actually play before the Unmute');
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

const pageBad = (p) => p.identity !== 'MATCH_EXPECTED_ARTIFACT' || p.error || (p.page.startsWith('U-') && !(p.start && p.start.trusted));
function mergeRecovery(out, rec, provenance) {
  const problems = []; const replaced = []; const invalidAttempts = [];
  if (!rec || rec.probe !== 'ib11-gplay-recovery') return { problems: ['recovery file is not an ib11-gplay-recovery result'], replaced, invalidAttempts };
  const valid = [];
  for (const pg of rec.pages || []) {
    const cl = pg.client || {};
    const p = { page: pg.page, identity: cl.identity, start: cl.start, error: cl.error };
    if (cl.error) { invalidAttempts.push({ page: pg.page, attempt: pg.attempt || null, error: cl.error }); continue; }
    if (pageBad(p)) { problems.push(`recovery page ${pg.page}: identity ${cl.identity}, start ${JSON.stringify(cl.start)}`); continue; }
    for (const c of cl.cells || []) valid.push({ c, pg });
  }
  for (const { c } of valid) if (!RECOVERY_CELLS.includes(c.id)) problems.push(`recovery cell ${c.id} is not a recoverable cell`);
  for (const id of RECOVERY_CELLS) {
    const hits = valid.filter((x) => x.c.id === id);
    if (hits.length > 1) { problems.push(`ambiguous recovery: ${hits.length} valid attempts for ${id}`); continue; }
    if (!hits.length) { problems.push(`no valid recovery attempt for ${id}`); continue; }
    const page = out.find((p) => p.cells.some((x) => x.id === id));
    if (!page) { problems.push(`${id} is not in the original run`); continue; }
    const { c, pg } = hits[0];
    const idx = page.cells.findIndex((x) => x.id === id);
    const was = page.cells[idx].status;
    page.cells[idx] = { ...evaluateCell(c, pg, pg.requests || []), source: 'recovery' };
    replaced.push({ cell: id, originalStatus: was, recoveryStatus: page.cells[idx].status, recoveryPage: pg.page, attempt: pg.attempt || null, recoverySha256: (provenance && provenance.recoverySha256) || null });
  }
  return { problems, replaced, invalidAttempts };
}

function evaluate(doc, { recovery = null, provenance = null } = {}) {
  const pages = doc.pages || [];
  const out = [];
  const missing = PAGES.filter((p) => !pages.some((x) => x.page === p));
  for (const pg of pages) {
    const cl = pg.client || {};
    const cells = (cl.cells || []).map((c) => ({ ...evaluateCell(c, pg, pg.requests || []), source: 'original' }));
    out.push({ page: pg.page, identity: cl.identity, runtime: cl.runtime, start: cl.start, error: cl.error, cells });
  }
  const merge = recovery ? mergeRecovery(out, recovery, provenance) : null;
  const pageFails = out.filter(pageBad);
  const allCells = out.flatMap((p) => p.cells);
  const expectedCells = 2 * 13 + 2 * 3;
  const complete = !missing.length && allCells.length === expectedCells && allCells.every((c) => c.status !== 'CONTAMINATED');
  const capabilityTable = Object.fromEntries(out.map((p) => [p.page, Object.fromEntries(p.cells.map((c) => [c.id.split('-').slice(2).join('-'), c.capability]))]));
  const pass = complete && !pageFails.length && allCells.every((c) => c.status === 'PASS') && !(merge && merge.problems.length);
  return { kind: 'gplay', revision: REVISION, provenance: provenance || null, recovery: merge, missingPages: missing, complete, pageFailures: pageFails.map((p) => ({ page: p.page, identity: p.identity, error: p.error, start: p.start })),
    pass, counts: allCells.reduce((m, c) => { m[c.status] = (m[c.status] || 0) + 1; return m; }, {}), capabilityTable, failures: allCells.filter((c) => c.status !== 'PASS'), pages: out };
}

module.exports = { evaluate, evaluateCell, capability, mergeRecovery, REVISION, RECOVERY_CELLS };

if (require.main === module) {
  const sha = (f) => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  const ri = process.argv.indexOf('--recovery');
  const recFile = ri > 0 ? process.argv[ri + 1] : null;
  const provenance = { originalSha256: sha(process.argv[2]), recoverySha256: recFile ? sha(recFile) : null };
  const r = evaluate(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), { recovery: recFile ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : null, provenance });
  console.log(JSON.stringify(r, null, 1));
  process.exitCode = r.pass ? 0 : 1;
}
