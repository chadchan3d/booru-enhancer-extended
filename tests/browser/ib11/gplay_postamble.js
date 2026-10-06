/* IB11 G-PLAY RUNNER POSTAMBLE — test code, not production.
 * Runs the cells of one page (arm x container) on the local fixture only. Each
 * cell sets the four viewer playback preferences and the remembered volume in
 * THIS TEST SCRIPT's own storage (never the production script's), opens the
 * existing viewer through the gallery's own click path (a synthetic click is
 * not user activation), drives the cell, closes the viewer with Escape and
 * records what production did. Hover preview is turned off on these pages so
 * hover video cannot interfere. Operator prompts (arm U Start, DELIB Unmute,
 * arm N RETRY Space) wait for a trusted input; any trusted input outside a
 * prompt is counted against the cell. Results go to the local server only. */
(async () => {
  'use strict';
  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function (location) {\n';
  const R = IB11G;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms) => { const end = performance.now() + ms; while (performance.now() < end) { if (fn()) return true; await sleep(25); } return !!fn(); };
  let cfg = null;
  try { cfg = JSON.parse(document.getElementById('ib11g-run').textContent); } catch { cfg = null; }
  if (!cfg || location.hostname !== '127.0.0.1') return;
  const BE = window.BE;

  async function identity() {
    if (typeof IB11G_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB11G_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('') === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  // ---- operator panel and trusted-input accounting ----
  let trusted = 0; let promptOpen = false; let promptHits = 0;
  for (const type of ['pointerdown', 'keydown', 'click']) document.addEventListener(type, (e) => { if (!e.isTrusted) return; if (promptOpen) promptHits++; else trusted++; }, true);
  const panel = document.createElement('div');
  panel.id = 'ib11g-panel';
  panel.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647;background:#111;color:#eee;border:2px solid #888;padding:8px 10px;font:14px/1.4 sans-serif;max-width:360px';
  const msg = document.createElement('div'); panel.appendChild(msg);
  const btn = document.createElement('button'); btn.style.cssText = 'display:none;margin-top:6px;font-size:16px;padding:6px 14px'; panel.appendChild(btn);
  document.body.appendChild(panel);
  const say = (t) => { msg.textContent = `IB11 G-PLAY ${cfg.page}: ${t}`; };
  async function promptClick(label, text, onClick) {
    say(text); btn.textContent = label; btn.style.display = 'inline-block'; promptOpen = true;
    let done = false; let wasTrusted = false;
    const h = async (e) => { wasTrusted = e.isTrusted; if (onClick) await onClick(e); done = true; };
    btn.addEventListener('click', h, { once: true });
    await waitFor(() => done, 120000);
    btn.style.display = 'none'; promptOpen = false;
    return { done, trusted: wasTrusted };
  }
  async function promptKey(key, text) {
    say(text); promptOpen = true;
    let hit = null;
    const h = (e) => { if (e.key === key) { hit = { trusted: e.isTrusted }; } };
    document.addEventListener('keydown', h, true);
    await waitFor(() => !!hit, 120000);
    document.removeEventListener('keydown', h, true); promptOpen = false;
    return hit || { trusted: false, timeout: true };
  }

  // ---- production entry points used by the cells (all production paths) ----
  const cards = () => [...document.querySelectorAll('article')];
  const cardOf = (label) => cards().find((a) => a.getAttribute('data-file-url')?.includes(`/${label}.`));
  const urlOf = (label) => new URL(`/gplay/media/${cfg.token}/${label}.${cfg.container}`, location.href).href;
  const marks = [];
  const mark = (what, extra = {}) => { R.sample(); marks.push({ t: R.t(), cell: R.cell, what, ...extra }); };
  const click = (label) => { mark('open', { card: label }); cardOf(label).querySelector('img').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); };
  const key = (k) => { mark('key', { key: k }); document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
  const current = () => R.videos.filter((el) => el.__ib11g.cell === R.cell && el.isConnected).pop() || null;
  const playing = (el) => !!el && el.__ib11g.ev.some((e) => e[1] === 'playing') && el.__ib11g.maxTime > 0.2;
  async function setPrefs(c) {
    await R.asHarness(async () => {
      BE.settings.set('viewer.autoplayVideo', c.prefs.autoplay);
      BE.settings.set('viewer.loopVideo', c.prefs.loop);
      BE.settings.set('viewer.muteVideo', c.prefs.mute);
      BE.settings.set('viewer.rememberVolume', c.prefs.rememberVolume);
      await BE.store.set('viewer:volume', c.storedVolume);
    });
  }

  const KINDS = {
    async OBSERVE(c) { click(c.cards[0]); await sleep(4000); },
    async LOOP(c) {
      click(c.cards[0]);
      const el = await (async () => { await waitFor(() => playing(current()), 6000); return current(); })();
      mark(playing(el) ? 'playing' : 'not-playing');
      if (el && Number.isFinite(el.duration) && el.duration > 2) { R.seek(el, el.duration - 1); mark('seek-near-end'); }
      await sleep(4000);
    },
    async VOLUME(c) {
      click(c.cards[0]); await sleep(1500);
      const el = current(); if (el) await R.asHarness(() => { el.volume = 0.6; }); mark('harness-volume', { v: 0.6 });
      await sleep(500); key('ArrowRight'); await sleep(2500);
    },
    async PLAYAPI(c) {
      click(c.cards[0]); await sleep(1500);
      const id = cardOf(c.cards[0]).getAttribute('data-id');
      const cached = BE.modules.gallery.getCachedPost(id);
      mark('metadata-update', { to: `${c.cards[0]}2` });
      BE.modules.viewer.updatePost({ ...cached, originalUrl: urlOf(`${c.cards[0]}2`) });
      await sleep(3000);
    },
    async CLOSEPEND(c) { click(c.cards[0]); await sleep(300); key('Escape'); await sleep(4500); },
    async CLOSEPLAY(c) { click(c.cards[0]); await waitFor(() => playing(current()), 6000); mark(playing(current()) ? 'playing' : 'not-playing'); key('Escape'); await sleep(2000); },
    async STALE(c) {
      click(c.cards[0]); await sleep(800);
      const id = cardOf(c.cards[0]).getAttribute('data-id');
      mark('metadata-update', { to: `${c.cards[0]}2` });
      BE.modules.viewer.updatePost({ ...BE.modules.gallery.getCachedPost(id), originalUrl: urlOf(`${c.cards[0]}2`) });
      key('ArrowRight'); await sleep(3000);
    },
    async RETRY(c) {
      click(c.cards[0]); await sleep(2500);
      const r = await promptKey(' ', 'press the SPACE bar once now (Play retry).');
      mark('retry-key', r); await sleep(3000);
    },
    async DELIB(c) {
      click(c.cards[0]); await waitFor(() => playing(current()), 6000); mark(playing(current()) ? 'playing' : 'not-playing');
      const r = await promptClick('Unmute', 'click "Unmute" (deliberate unmute of the playing video).', async () => { const el = current(); if (el) await R.asHarness(() => { el.muted = false; }); });
      mark('unmute', { trusted: r.trusted }); await sleep(2000);
      key('ArrowRight'); await sleep(3000);
    },
  };

  // ---- run ----
  say('starting…');
  await waitFor(() => BE && BE.store?.isReady && BE.modules?.viewer && document.querySelector('.be-thumb-wrap'), 15000);
  const id = await identity();
  await R.asHarness(async () => { BE.settings.set('media.hoverPreview', false); });
  const out = { token: cfg.token, page: cfg.page, arm: cfg.arm, container: cfg.container, identity: id,
    runtime: { browser: (navigator.userAgentData?.brands || []).map((b) => `${b.brand} ${b.version}`).join('; ') || 'unavailable', manager: (typeof GM_info !== 'undefined' && GM_info) ? `${GM_info.scriptHandler} ${GM_info.version}` : 'unavailable' },
    start: null, cells: [], error: null };
  try {
    if (cfg.arm === 'U') { const r = await promptClick('Start', 'click "Start" (gives this page user activation).'); out.start = { trusted: r.trusted }; }
    else say('running; keep the mouse outside the window until asked.');
    for (const c of cfg.cells) {
      R.cell = c.id; const t0 = R.t(); const before = trusted; promptHits = 0;
      await setPrefs(c);
      const activationBefore = navigator.userActivation ? navigator.userActivation.hasBeenActive : null;
      say(`cell ${c.name}…`);
      await KINDS[c.kind](c);
      if (BE.modules.viewer.isOpen()) key('Escape');
      await sleep(1000);
      out.cells.push({ id: c.id, name: c.name, kind: c.kind, prefs: c.prefs, storedVolume: c.storedVolume, t0, tEnd: R.t(), activationBefore,
        trustedOutsidePrompt: trusted - before, promptInputs: promptHits, storeVolumeAfter: BE.store.get('viewer:volume'),
        marks: marks.filter((m) => m.cell === c.id), stage: R.stageLog.filter((s) => s[1] === c.id).map(([tt, , s]) => [tt, s]), videos: R.forCell(c.id) });
    }
  } catch (e) { out.error = String(e && e.message || e).slice(0, 300); }
  say('posting results…');
  try {
    const res = await fetch('/gplay/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) });
    const j = await res.json();
    say(j.next === '/gplay/done' ? 'all pages complete.' : 'next page…');
    if (j.next) setTimeout(() => { location.href = j.next; }, 500);
  } catch (e) { say(`could not post results: ${String(e && e.message || e)}`); }
})();
