/* IB10 V3-R RUNNER POSTAMBLE — test code, not production.
 * One scripted cell per page load on the local fixture only (scripted pointer
 * events are allowed here: controlled fixture, not a live site):
 *   hover A until loadeddata, stay HOLD_AFTER_READY_MS more, leave A;
 *   quick-pass B (< 100 ms); re-enter A GAP ms after leaving it;
 *   wait for the revisit's loadeddata and first frame, stay AFTERMATH_MS,
 *   leave A, observe TAIL_MS more; then post the client timeline to the local
 *   server and load the next cell.
 * The executed production body for the cell's variant is identity-checked. */
(async () => {
  'use strict';
  const EXPECTED = { ASIS: '__ASIS_SHA256__', RELEASE: '__RELEASE_SHA256__' };
  const WRAP_FN_HEAD = 'function (location) {\n';
  const READY_TIMEOUT_MS = 15000;
  const HOLD_AFTER_READY_MS = 1000;
  const B_PASS_MS = 60;
  const AFTERMATH_MS = 3000;
  const TAIL_MS = 1500;
  const R = IB10C;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms) => { const end = performance.now() + ms; while (performance.now() < end) { if (fn()) return true; await sleep(10); } return false; };
  let cfg = null;
  try { cfg = JSON.parse(document.getElementById('ib10r-run').textContent); } catch { cfg = null; }
  if (!cfg || window.location.hostname !== '127.0.0.1') return;

  async function identity() {
    const fn = typeof IB10R_BODIES === 'object' ? IB10R_BODIES[cfg.variant] : null;
    if (typeof fn !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(fn).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    const hex = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === EXPECTED[cfg.variant] ? `MATCH_${cfg.variant}` : 'MISMATCH';
  }

  const card = (label) => [...document.querySelectorAll('article')].find((a) => a.getAttribute('data-file-url')?.includes(`/${label}.`));
  const imgOf = (label) => card(label)?.querySelector('img');
  const enter = (label, extra = {}) => { R.mark('enter', { card: label, ...extra }); imgOf(label).dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); };
  const leave = (label, extra = {}) => { R.mark('leave', { card: label, ...extra }); imgOf(label).dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body })); };
  const hoverFor = (label, after) => R.videos.map((v) => v.__ib10c).filter((r) => r.owner === 'hover' && r.label === label && r.created >= after).pop() || null;
  const has = (r, name) => !!r && r.ev.some((e) => e[1] === name);

  const enhanced = await waitFor(() => !!document.querySelector('.be-thumb-wrap'), 8000);
  R.mark('start', { enhanced, variant: cfg.variant, cache: cfg.cache, container: cfg.container, gap: cfg.gap });
  let error = null;
  try {
    if (enhanced) {
      const t0 = R.t();
      enter('A', { phase: 'first' });
      const ok1 = await waitFor(() => has(hoverFor('A', t0), 'loadeddata'), READY_TIMEOUT_MS);
      R.mark(ok1 ? 'ready' : 'timeout', { card: 'A', phase: 'first' });
      await sleep(HOLD_AFTER_READY_MS);
      leave('A', { phase: 'first' });
      const tLeave = R.t();
      await sleep(20);
      enter('B', { phase: 'pass' }); await sleep(B_PASS_MS); leave('B', { phase: 'pass' });
      await waitFor(() => R.t() >= tLeave + cfg.gap, cfg.gap + 1000);
      const t1 = R.t();
      enter('A', { phase: 'revisit' });
      const ok2 = await waitFor(() => has(hoverFor('A', t1), 'loadeddata'), READY_TIMEOUT_MS);
      R.mark(ok2 ? 'ready' : 'timeout', { card: 'A', phase: 'revisit' });
      const ok3 = await waitFor(() => { const r = hoverFor('A', t1); return !!r && r.firstFrame !== null; }, 3000);
      R.mark(ok3 ? 'frame' : 'frameTimeout', { card: 'A', phase: 'revisit' });
      await sleep(AFTERMATH_MS);
      leave('A', { phase: 'final' });
    }
  } catch (e) { error = String(e && e.message || e).slice(0, 200); }
  await sleep(TAIL_MS);
  R.mark('windowEnd');
  const out = {
    token: cfg.token, variant: cfg.variant, cache: cfg.cache, container: cfg.container, gap: cfg.gap,
    identity: await identity(), timeOrigin: performance.timeOrigin, marks: R.marks, videos: R.snapshot(),
    trustedPointerEvents: R.trustedPointer, error,
    browser: (navigator.userAgentData?.brands || []).map((b) => `${b.brand} ${b.version}`).join('; ') || null,
    manager: typeof GM_info === 'object' ? `${GM_info.scriptHandler || ''} ${GM_info.version || ''}`.trim() : null,
  };
  let next = null;
  try { const res = await fetch('/v3r/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }); next = (await res.json()).next; } catch { next = null; }
  window.location.assign(next || '/v3r/done');
})();
