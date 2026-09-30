/* IB10 V3-C RUNNER POSTAMBLE — test code, not production.
 * Runs one scripted scenario per page load on the local fixture only (the
 * scripted pointer events are allowed because this is a controlled fixture,
 * not a live site), keeps observing for 5 s after the scenario's last
 * leave/cleanup, then posts the recorded client timeline to the local server
 * and loads the next run. Event state (client) and transport state (server)
 * are recorded separately. It never changes a production setting. */
(async () => {
  'use strict';
  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function (location) {\n';
  const WINDOW_MS = 5000;
  const READY_TIMEOUT_MS = 10000;
  const R = IB10C;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms) => { const end = performance.now() + ms; while (performance.now() < end) { if (fn()) return true; await sleep(10); } return false; };
  let cfg = null;
  try { cfg = JSON.parse(document.getElementById('ib10c-run').textContent); } catch { cfg = null; }
  if (!cfg || location.hostname !== '127.0.0.1') return;
  const BE = window.BE;

  async function identity() {
    if (typeof IB10C_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB10C_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('') === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  const card = (label) => [...document.querySelectorAll('article')].find((a) => a.getAttribute('data-file-url')?.includes(`/${label}.`));
  const imgOf = (label) => card(label)?.querySelector('img');
  const enter = (label) => { R.mark('enter', { card: label }); imgOf(label).dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); };
  const leave = (label) => { R.mark('leave', { card: label }); imgOf(label).dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body })); };
  const click = (label) => { R.mark('click', { card: label }); imgOf(label).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); };
  const hoverFor = (label, after) => R.videos.map((v) => v.__ib10c).filter((r) => r.owner === 'hover' && r.label === label && r.created >= after).pop() || null;
  const has = (r, name) => !!r && r.ev.some((e) => e[1] === name);
  const waitHover = async (label, after, what) => {
    const ok = await waitFor(() => { const r = hoverFor(label, after); return what === 'frame' ? !!r && r.firstFrame !== null : has(r, 'loadeddata'); }, READY_TIMEOUT_MS);
    R.mark(ok ? `ready:${what}` : `timeout:${what}`, { card: label });
    return ok;
  };
  const cleanup = (kind) => R.mark('cleanup', { kind });

  const S = {
    async LEAVE_PENDING() { enter('A'); await sleep(40); leave('A'); cleanup('leave'); },
    async LEAVE_LOADEDDATA() { const t0 = R.t(); enter('A'); await waitHover('A', t0, 'loadeddata'); leave('A'); cleanup('leave'); },
    async LEAVE_FIRST_FRAME() { const t0 = R.t(); enter('A'); await waitHover('A', t0, 'frame'); leave('A'); cleanup('leave'); },
    async CYCLES_5() { for (let k = 0; k < 5; k++) { const t0 = R.t(); enter('A'); await waitHover('A', t0, 'loadeddata'); await sleep(300); leave('A'); await sleep(300); } cleanup('leave'); },
    async A_TO_B() { let t0 = R.t(); enter('A'); await waitHover('A', t0, 'loadeddata'); leave('A'); t0 = R.t(); enter('B'); await waitHover('B', t0, 'loadeddata'); await sleep(300); leave('B'); cleanup('leave'); },
    async VIEWER_PENDING() { enter('A'); await sleep(40); click('A'); R.mark('viewer', { open: !!BE?.modules?.viewer?.isOpen?.() }); cleanup('takeover'); },
    async VIEWER_INSTALLED() { const t0 = R.t(); enter('A'); await waitHover('A', t0, 'loadeddata'); await sleep(300); click('A'); R.mark('viewer', { open: !!BE?.modules?.viewer?.isOpen?.() }); cleanup('takeover'); },
    async VIEWER_CLOSE() {
      const t0 = R.t(); enter('A'); await waitHover('A', t0, 'loadeddata'); await sleep(300); click('A'); R.mark('viewer', { open: !!BE?.modules?.viewer?.isOpen?.() });
      await sleep(1000); R.mark('viewerClose'); BE?.modules?.viewer?.close?.(); R.mark('viewer', { open: !!BE?.modules?.viewer?.isOpen?.() }); cleanup('viewerClose');
      await sleep(WINDOW_MS); leave('A'); cleanup('leave');
    },
    async DISPOSE() { const t0 = R.t(); enter('A'); await waitHover('A', t0, 'loadeddata'); await sleep(300); R.mark('dispose'); BE?.modules?.gallery?.dispose?.(); cleanup('dispose'); },
  };

  // Wait for production's gallery enhancement (cards wrapped).
  const enhanced = await waitFor(() => !!document.querySelector('.be-thumb-wrap'), 8000);
  R.mark('start', { enhanced, hoverSetting: !!BE?.settings?.get?.('media.hoverPreview'), viewerSetting: !!BE?.settings?.get?.('viewer.enabled') });
  let error = null;
  try { if (enhanced) await S[cfg.scenario](); } catch (e) { error = String(e && e.message || e).slice(0, 200); }
  await sleep(WINDOW_MS);
  R.mark('windowEnd');
  const out = {
    token: cfg.token, scenario: cfg.scenario, container: cfg.container, transport: cfg.transport,
    identity: await identity(), timeOrigin: performance.timeOrigin, marks: R.marks, videos: R.snapshot(),
    trustedPointerEvents: R.trustedPointer, error,
    browser: (navigator.userAgentData?.brands || []).map((b) => `${b.brand} ${b.version}`).join('; ') || null,
    manager: typeof GM_info === 'object' ? `${GM_info.scriptHandler || ''} ${GM_info.version || ''}`.trim() : null,
  };
  let next = null;
  try { const res = await fetch('/v3c/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }); next = (await res.json()).next; } catch { next = null; }
  window.location.assign(next || '/v3c/done');
})();
