/* IB11 V-VIEW RUNNER POSTAMBLE — test code, not production.
 * Runs the V-VIEW cells of one page on the local fixture only. Preferences
 * and the remembered volume are set in THIS TEST SCRIPT's own storage. The
 * viewer's Favorite and Download module functions are replaced by recording
 * stubs IN THIS TEST PAGE ONLY, so no account action or download can happen.
 * Automated cells drive production through its own paths (gallery click,
 * keydown, toolbar buttons, updatePost); operator cells wait for real input:
 * every prompt records the event's isTrusted flag (the evaluator decides),
 * a prompt not answered within 3 minutes makes the page INVALID (error posted,
 * panel says INVALID, no advance; reload to retry), and trusted input outside
 * a prompt is counted against the running cell. Results go to the local
 * server only (fetch, or sendBeacon when the page navigates). */
(async () => {
  'use strict';
  const EXPECTED_BODY_SHA256 = '__EXPECTED_BODY_SHA256__';
  const WRAP_FN_HEAD = 'function (location) {\n';
  const PROMPT_TIMEOUT_MS = 180000;
  const NAV_FALLBACK_MS = 5000;
  const V = IB11V;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const waitFor = async (fn, ms) => { const end = performance.now() + ms; while (performance.now() < end) { if (fn()) return true; await sleep(25); } return !!fn(); };
  let cfg = null;
  try { cfg = JSON.parse(document.getElementById('ib11v-run').textContent); } catch { cfg = null; }
  if (!cfg || location.hostname !== '127.0.0.1') return;
  const BE = window.BE;

  async function identity() {
    if (typeof IB11V_PRODUCTION_BODY !== 'function') return 'UNAVAILABLE';
    const text = Function.prototype.toString.call(IB11V_PRODUCTION_BODY).replace(/\r\n/g, '\n');
    if (!text.startsWith(WRAP_FN_HEAD) || !text.endsWith('}')) return 'UNPARSABLE';
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.slice(WRAP_FN_HEAD.length, -1)));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('') === EXPECTED_BODY_SHA256 ? 'MATCH_EXPECTED_ARTIFACT' : 'MISMATCH';
  }

  // ---- descriptors and measurements (stable, no DOM serialization) ----
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const desc = (el) => {
    if (!el) return null;
    if (el === document.body || el === document.documentElement) return { tag: el.tagName };
    const art = el.closest && el.closest('article');
    return { tag: el.tagName, cls: typeof el.className === 'string' ? el.className.split(/\s+/)[0] || '' : '', title: (el.getAttribute && el.getAttribute('title')) || '',
      card: art ? art.getAttribute('data-vview-role') : '', inOverlay: !!(el.closest && el.closest('#be-viewer-overlay')), panel: !!(el.closest && el.closest('#ib11v-panel')) };
  };
  const stage = () => document.querySelector('.be-viewer-stage');
  const stageMedia = () => { const st = stage(); return st && st.querySelector('img, video'); };
  const isOpen = () => !!BE.modules.viewer.isOpen();
  function stageInfo() {
    const ov = document.querySelector('#be-viewer-overlay'); const st = stage(); const m = stageMedia();
    const s = st && st.querySelector('.be-media-state'); const link = st && st.querySelector('.be-viewer-native-fallback');
    return { t: V.t(), wall: Date.now(), open: isOpen(), display: ov ? ov.style.display : 'absent', stage: box(st), children: st ? st.childElementCount : 0,
      media: m ? { tag: m.tagName, label: V.labelOf(m.getAttribute('src')), rect: box(m), complete: m.tagName === 'IMG' ? m.complete : null, nw: m.naturalWidth || m.videoWidth || 0, nh: m.naturalHeight || m.videoHeight || 0, transform: m.style.transform } : null,
      visible: st ? [...st.querySelectorAll('img, video')].map((x) => ({ tag: x.tagName, label: V.labelOf(x.getAttribute('src')), area: (() => { const b = box(x); return b ? b.w * b.h : 0; })(), nw: x.naturalWidth || x.videoWidth || 0, complete: x.tagName === 'IMG' ? x.complete : null })) : [],
      state: s ? s.textContent.replace(link ? link.textContent : '', '').trim() : '', link: link ? (/^\/posts\/\d+$/.test(new URL(link.href, location.href).pathname) ? 'card-post' : 'other') : '', linkBox: link ? box(link) : null,
      currentId: BE.modules.viewer.currentPost ? String(BE.modules.viewer.currentPost.id) : null };
  }

  // ---- operator panel, prompts and trusted-input accounting ----
  let promptOpen = false; let grace = false; let cell = ''; const outside = {};
  for (const type of ['pointerdown', 'keydown', 'click']) window.addEventListener(type, (e) => { if (!e.isTrusted || promptOpen || grace) return; outside[cell] = (outside[cell] || 0) + 1; }, true);
  const panel = document.createElement('div'); panel.id = 'ib11v-panel';
  const SMALL = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:#111;color:#eee;border:2px solid #888;padding:8px 14px;font:15px/1.4 sans-serif;max-width:90vw;text-align:center';
  const BIG = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:#000;color:#ff0;border:6px solid #ff0;padding:16px 28px;font:bold 26px/1.35 sans-serif;max-width:92vw;text-align:center';
  panel.style.cssText = SMALL; const msg = document.createElement('div'); const sub = document.createElement('div'); sub.style.cssText = 'font-size:18px;margin-top:6px'; panel.append(msg, sub);
  document.body.appendChild(panel);
  const baseTitle = document.title;
  const say = (t, s = '') => { msg.textContent = `IB11 V-VIEW ${cfg.page}: ${t}`; sub.textContent = s; };
  function prompt(text, s = '') { promptOpen = true; panel.style.cssText = BIG; document.title = '>>> ACTION NEEDED <<<'; say(text, s); }
  function endPrompt() { promptOpen = false; panel.style.cssText = SMALL; document.title = baseTitle; }
  // Waits for the first event of `types` matching `pred` (capture phase, before
  // production). Records isTrusted, modifiers and the focus at that moment.
  function expectEvent(types, pred, ms = PROMPT_TIMEOUT_MS, label = 'input') {
    return new Promise((resolve, reject) => {
      const hs = [];
      const done = (v, err) => { for (const [ty, h] of hs) window.removeEventListener(ty, h, true); clearTimeout(tm); if (err) reject(err); else resolve(v); };
      for (const ty of types) {
        const h = (e) => { let ok = false; try { ok = !!pred(e); } catch { ok = false; } if (!ok) return;
          done({ e, type: e.type, t: V.t(), wall: Date.now(), trusted: e.isTrusted, key: e.key, code: e.code, ctrlKey: !!e.ctrlKey, metaKey: !!e.metaKey, altKey: !!e.altKey, shiftKey: !!e.shiftKey,
            target: desc(e.target), active: desc(document.activeElement), openAtCapture: isOpen() }); };
        window.addEventListener(ty, h, true); hs.push([ty, h]);
      }
      const tm = setTimeout(() => done(null, new Error(`PROMPT_TIMEOUT ${cell} ${label}`)), ms);
    });
  }
  const strip = ({ e, ...r }) => r;

  // ---- fixture: stubs, preferences, production entry points ----
  const stubs = { fav: [], dl: [] };
  BE.modules.favorites.toggle = (p) => { stubs.fav.push({ t: V.t(), id: p && String(p.id) }); };
  BE.modules.downloader.downloadPost = (p) => { stubs.dl.push({ t: V.t(), id: p && String(p.id) }); };
  const cardEl = (role) => document.querySelector(`article[data-vview-role="${role}"]`);
  const openCard = async (role) => { cardEl(role).querySelector('img').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await sleep(50); };
  const key = (k, init = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }); document.dispatchEvent(e); return e; };
  const btn = (title) => [...document.querySelectorAll('.be-viewer-btn')].find((b) => b.title.startsWith(title));
  const closeViewer = () => { if (isOpen()) BE.modules.viewer.close(); };
  const imgReady = () => { const m = stageMedia(); return !!m && m.tagName === 'IMG' && m.complete && m.naturalWidth > 0; };

  const CELLS = {
    async VD7() {
      await openCard('VD7'); const t0 = V.t(); const samples = [];
      for (const at of [300, 1000, 3000]) { await sleep(Math.max(0, t0 + at - V.t())); samples.push({ at, ...stageInfo() }); }
      const done = await waitFor(imgReady, 20000);
      const r = { card: 'VD7', samples, final: stageInfo(), completedAfterMs: done ? V.t() - t0 : null };
      closeViewer(); return r;
    },
    async VD4() {
      BE.settings.set('viewer.fitMode', 'fit-both');
      await openCard('VD4'); await waitFor(imgReady, 10000); await sleep(300);
      const s0 = stageInfo();
      btn('Rotate right').click(); await sleep(150);
      const sRot = stageInfo();
      const resizes = [];
      window.addEventListener('resize', (e) => { resizes.push({ t: V.t(), trusted: e.isTrusted, w: window.innerWidth, h: window.innerHeight }); });
      prompt('Press F11 once (the page goes full screen).', 'Wait for the next instruction.');
      const r1 = await expectEvent(['resize'], () => true, PROMPT_TIMEOUT_MS, 'F11 #1'); await sleep(800);
      const sA = stageInfo(); endPrompt();
      prompt('Press F11 again (leave full screen).');
      const r2 = await expectEvent(['resize'], () => true, PROMPT_TIMEOUT_MS, 'F11 #2'); await sleep(800);
      const sB = stageInfo(); endPrompt();
      const r = { card: 'VD4', fitMode: BE.settings.get('viewer.fitMode'), s0, sRot, resize1: strip(r1), sA, resize2: strip(r2), sB, resizes };
      closeViewer(); return r;
    },
    async VD6B() {
      await BE.store.set('viewer:volume', 0.37);
      await openCard('VD6B_A'); await waitFor(imgReady, 10000);
      const prev = stageMedia(); const before = stageInfo();
      await BE.store.set('viewer:volume', 1.5);
      const n0 = V.seam.length;
      key('ArrowRight');
      await sleep(50); const after50 = stageInfo(); await sleep(950); const after1000 = stageInfo();
      const r = { from: 'VD6B_A', to: 'VD6B_B', toId: cfg.cards.VD6B_B, fromId: cfg.cards.VD6B_A, before, after50, after1000, prevConnected: !!prev && prev.isConnected, seam: V.seam.slice(n0) };
      await BE.store.set('viewer:volume', 0.37); closeViewer(); return r;
    },
    async VD1() {
      await openCard('VD1');
      const failedSeen = await waitFor(() => /failed/i.test(stageInfo().state), 6000);
      const el = stageMedia(); const failed = stageInfo();
      const failEvent = !!(V.rec(el) && V.rec(el).ev.some((x) => x[1] === 'error'));
      BE.modules.viewer.updatePost({ ...BE.modules.gallery.getCachedPost(cfg.cards.VD1) });
      const after0 = stageInfo(); await sleep(500); const after500 = stageInfo();
      const r = { card: 'VD1', failedSeen, failEvent, failed, after0, after500, sameMedia: stageMedia() === el };
      closeViewer(); return r;
    },
    async VD5SYN() {
      await openCard('VD5SYN'); const events = [];
      for (const k of ['f', 'd']) {
        if (!isOpen()) await openCard('VD5SYN');
        const f0 = stubs.fav.length; const d0 = stubs.dl.length; const openBefore = isOpen();
        const e = key(k, { ctrlKey: true }); await sleep(100);
        events.push({ key: k, ctrlKey: true, trusted: e.isTrusted, defaultPrevented: e.defaultPrevented, fav: stubs.fav.length - f0, dl: stubs.dl.length - d0, openBefore, openAfter: isOpen() });
      }
      closeViewer(); return { card: 'VD5SYN', events };
    },
    async VD5() {
      await openCard('VD5'); const chords = [];
      for (const want of ['f', 'd']) {
        if (!isOpen()) await openCard('VD5');
        const f0 = stubs.fav.length; const d0 = stubs.dl.length; const openBefore = isOpen();
        prompt(`Hold Ctrl and press ${want.toUpperCase()} once  (Ctrl+${want.toUpperCase()})`);
        const ev = await expectEvent(['keydown'], (e) => String(e.key || '').toLowerCase() === want && (e.ctrlKey || e.metaKey), PROMPT_TIMEOUT_MS, `Ctrl+${want}`);
        await sleep(300);
        chords.push({ want, ...strip(ev), defaultPrevented: ev.e.defaultPrevented, fav: stubs.fav.length - f0, dl: stubs.dl.length - d0, openBefore, openAfter: isOpen() });
        endPrompt(); grace = true;
        say('Recorded.', 'If a browser bar or dialog opened, press Esc to close it. Continuing in 6 seconds…');
        await sleep(6000); grace = false;
      }
      closeViewer(); return { card: 'VD5', chords };
    },
    async G3() {
      await openCard('G3');
      await waitFor(() => { const m = stageMedia(); return !!m && m.tagName === 'VIDEO' && V.rec(m) && V.rec(m).ev.some((x) => x[1] === 'playing'); }, 10000);
      const v = stageMedia(); const rv = V.rec(v);
      // [rev 1.1] Chrome's native controls live in a closed UA shadow tree:
      // their pointer input does not reach page listeners. The native action is
      // observed through its consequences instead: a play/pause transition on
      // this video during the prompt, not caused by production, and then the
      // focus. A page-visible pointerdown on the video surface just before the
      // transition means the click hit the video, not the control.
      const surface = [];
      const onSurface = (e) => { if (e.isTrusted && v && (e.target === v || v.contains(e.target))) surface.push(V.t()); };
      window.addEventListener('pointerdown', onSurface, true);
      const t0 = V.t(); const pausedAtPrompt = v ? v.paused : null;
      prompt('Click the play/pause button at the bottom-left of the video once.', 'Use the video\'s own play/pause button, not the picture.');
      const tr = await new Promise((resolve, reject) => {
        const done = (x, err) => { v.removeEventListener('play', h); v.removeEventListener('pause', h); clearTimeout(tm); if (err) reject(err); else resolve(x); };
        const h = (e) => done({ type: e.type, trusted: e.isTrusted, t: V.t(), wall: Date.now() });
        v.addEventListener('play', h); v.addEventListener('pause', h);
        const tm = setTimeout(() => done(null, new Error('PROMPT_TIMEOUT G3 native control transition')), PROMPT_TIMEOUT_MS);
      });
      endPrompt(); await sleep(600);
      window.removeEventListener('pointerdown', onSurface, true);
      const control = { ...tr, pausedBefore: pausedAtPrompt, pausedAfter: v.paused,
        productionCallsDuringPrompt: V.calls.filter((c) => rv && c[1] === rv.i && c[0] >= t0 && c[0] <= tr.t + 50).map((c) => c[3]),
        surfacePointerBeforeTransition: surface.some((x) => x >= tr.t - 1000 && x <= tr.t), focusAfter: desc(document.activeElement) };
      const premise = !!control.focusAfter && control.focusAfter.tag === 'VIDEO';
      const r = { card: 'G3', revision: '1.1', control, premise };
      if (!premise) { closeViewer(); return r; }  // cell INVALID (no Space prompt); focus is never invented
      const pausedBefore = v.paused; const activeAtPrompt = desc(document.activeElement);
      prompt('Press the Space bar once.');
      const sp = await expectEvent(['keydown'], (e) => e.key === ' ' || e.code === 'Space', PROMPT_TIMEOUT_MS, 'Space');
      await sleep(1500);
      Object.assign(r, { pausedBefore, activeAtPrompt, space: { ...strip(sp), defaultPrevented: sp.e.defaultPrevented },
        pausedAfter: v.paused, events: rv ? rv.ev.filter((x) => x[0] >= sp.t && (x[1] === 'play' || x[1] === 'pause')) : [], prodCalls: V.calls.filter((c) => c[0] >= sp.t && rv && c[1] === rv.i) });
      endPrompt(); closeViewer(); return r;
    },
    async FOCUS_M() {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      const baseline = desc(document.activeElement);
      const onCard = (e) => !!(e.target.closest && e.target.closest('article[data-vview-role="FOCUS_M"]'));
      prompt('Click the PINK-outlined card once.');
      const ckP = expectEvent(['click'], onCard, PROMPT_TIMEOUT_MS + 10000, 'pink card click');
      const pd = await expectEvent(['pointerdown'], onCard, PROMPT_TIMEOUT_MS, 'pink card');
      const ck = await ckP;
      const invoker = desc((ck.e.target.closest && ck.e.target.closest('a')) || ck.e.target);
      const opened = await waitFor(() => isOpen() && BE.modules.viewer.currentPost && String(BE.modules.viewer.currentPost.id) === cfg.cards.FOCUS_M, 5000);
      endPrompt(); await sleep(0); const afterOpen0 = desc(document.activeElement); await sleep(300); const afterOpen300 = desc(document.activeElement);
      prompt('Press Escape once.');
      const esc = await expectEvent(['keydown'], (e) => e.key === 'Escape', PROMPT_TIMEOUT_MS, 'Escape');
      await sleep(0); const afterClose0 = desc(document.activeElement); await sleep(300); const afterClose300 = desc(document.activeElement);
      endPrompt();
      return { card: 'FOCUS_M', baseline, pointer: strip(pd), click: strip(ck), invoker, opened, afterOpen0, afterOpen300, escape: strip(esc), beforeClose: esc.active, afterClose0, afterClose300, closed: !isOpen() };
    },
    async FOCUS_K() {
      if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      const inK = () => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('article[data-vview-role="FOCUS_K"]'));
      prompt('Press Tab until the BLUE-outlined card is focused, then press Enter.');
      const live = setInterval(() => { sub.textContent = inK() ? '✓ The blue card is focused — press Enter now.' : 'Not yet — press Tab.'; }, 100);
      const en = await expectEvent(['keydown'], (e) => e.key === 'Enter' && inK(), PROMPT_TIMEOUT_MS, 'Enter on blue card');
      clearInterval(live);
      const opened = await waitFor(() => isOpen() && BE.modules.viewer.currentPost && String(BE.modules.viewer.currentPost.id) === cfg.cards.FOCUS_K, 5000);
      endPrompt(); await sleep(0); const afterOpen0 = desc(document.activeElement); await sleep(300); const afterOpen300 = desc(document.activeElement);
      const tabs = [];
      for (let i = 1; i <= 3; i++) {
        prompt(`Press Tab once (${i} of 3).`);
        const tb = await expectEvent(['keydown'], (e) => e.key === 'Tab', PROMPT_TIMEOUT_MS, `Tab ${i}`);
        await sleep(200); tabs.push({ trusted: tb.trusted, shiftKey: tb.shiftKey, before: tb.active, after: desc(document.activeElement), open: isOpen() });
      }
      prompt('Click the ✕ (Close) button — the last button of the viewer toolbar at the bottom.');
      const cl = await expectEvent(['click'], (e) => !!(e.target.closest && e.target.closest('.be-viewer-btn') && e.target.closest('.be-viewer-btn').title.startsWith('Close')), PROMPT_TIMEOUT_MS, 'Close button');
      await sleep(0); const afterClose0 = desc(document.activeElement); await sleep(300); const afterClose300 = desc(document.activeElement);
      endPrompt();
      return { card: 'FOCUS_K', enter: strip(en), invoker: en.active, opened, afterOpen0, afterOpen300, tabs, closeClick: strip(cl), afterClose0, afterClose300, closed: !isOpen() };
    },
  };

  // ---- navigation cells (the page ends by leaving it) ----
  // Armed BEFORE the operator's click: the page-exit beacon carries the result.
  function finishOnNavigation(out, cellRec) {
    let sent = false;
    const send = (navigated) => { if (sent) return; sent = true; cellRec.navigated = navigated; cellRec.pagehideWall = navigated ? Date.now() : null; cellRec.overlayAtLeave = (document.querySelector('#be-viewer-overlay') || {}).style ? document.querySelector('#be-viewer-overlay').style.display : 'absent';
      const body = JSON.stringify(out);
      if (navigated && navigator.sendBeacon) navigator.sendBeacon('/vview/result', new Blob([body], { type: 'text/plain' }));
      else fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {}); };
    window.addEventListener('pagehide', () => send(true), { once: true });
    return { clicked() { setTimeout(() => { if (!sent) { send(false); say('The page did not navigate (recorded).', 'Return the results file.'); } }, NAV_FALLBACK_MS); } };
  }
  async function NATIVE(out) {
    cell = 'NATIVE';
    await openCard('NATIVE');
    const ok = await waitFor(() => stageInfo().link === 'card-post', 6000);
    if (!ok) throw new Error('NATIVE_NO_FAILURE_LINK');
    const failed = stageInfo();
    const rec = { card: 'NATIVE', cardId: cfg.cards.NATIVE, failed, click: null, clickPrevented: null };
    out.cells.NATIVE = rec; out.outsideTrusted = outside;
    const isLink = (e) => !!(e.target.closest && e.target.closest('.be-viewer-native-fallback'));
    window.addEventListener('click', (e) => { if (isLink(e)) setTimeout(() => { rec.clickPrevented = e.defaultPrevented; }, 0); }, true);
    const nav = finishOnNavigation(out, rec);
    prompt('Click the underlined "Open native post" link in the middle of the screen.');
    const ck = await expectEvent(['click'], isLink, PROMPT_TIMEOUT_MS, 'native link');
    rec.click = strip(ck);
    endPrompt(); say('Recorded. Leaving for the native post page…');
    nav.clicked();
  }
  async function VD6A(out) {
    cell = 'VD6A';
    await BE.store.set('viewer:volume', 1.5);
    const rec = { card: 'VD6A', cardId: cfg.cards.VD6A, click: null, defaultPrevented: null, overlayAtClick: null, seam: [] };
    const onCard = (e) => !!(e.target.closest && e.target.closest('article[data-vview-role="VD6A"]'));
    const n0 = V.seam.length;
    // Capture phase + a task after dispatch: observes the outcome whether or not
    // production stops propagation, before the next document commits.
    window.addEventListener('click', (e) => { if (!onCard(e)) return; setTimeout(() => { rec.defaultPrevented = e.defaultPrevented; rec.overlayAtClick = stageInfo(); rec.seam = V.seam.slice(n0); }, 0); }, true);
    out.cells.VD6A = rec; out.outsideTrusted = outside;
    const nav = finishOnNavigation(out, rec);
    prompt('Click the ORANGE-outlined video card once.', 'The page will then leave for the native post page.');
    const ck = await expectEvent(['click'], onCard, PROMPT_TIMEOUT_MS, 'orange card');
    rec.click = strip(ck);
    endPrompt();
    nav.clicked();
  }

  // ---- run ----
  say('starting…');
  await waitFor(() => BE && BE.store?.isReady && BE.modules?.viewer && document.querySelector('.be-thumb-wrap'), 15000);
  const out = { token: cfg.token, page: cfg.page, identity: await identity(),
    runtime: { browser: (navigator.userAgentData?.brands || []).map((b) => `${b.brand} ${b.version}`).join('; ') || 'unavailable', platform: navigator.userAgentData?.platform || 'unavailable', manager: (typeof GM_info !== 'undefined' && GM_info) ? `${GM_info.scriptHandler} ${GM_info.version}` : 'unavailable' },
    viewport: { w: window.innerWidth, h: window.innerHeight }, cells: {}, stubs, outsideTrusted: outside, error: null };
  try {
    BE.settings.set('media.hoverPreview', false); BE.settings.set('viewer.autoplayVideo', true); BE.settings.set('viewer.muteVideo', true);
    BE.settings.set('viewer.loopVideo', true); BE.settings.set('viewer.rememberVolume', true); BE.settings.set('viewer.fitMode', 'fit-both');
    await BE.store.set('viewer:volume', 0.37);
    if (cfg.page === 'MAIN') {
      say('running automatic checks; keep hands off until a yellow instruction appears.');
      for (const id of ['VD7', 'VD6B', 'VD1', 'VD5SYN', 'VD4', 'VD5', 'G3', 'FOCUS_M', 'FOCUS_K']) {
        cell = id; const r = await CELLS[id](); r.outsideTrusted = outside[id] || 0; out.cells[id] = r;
        say(`${id} done.`);
      }
      await NATIVE(out);
    } else {
      await VD6A(out);
    }
  } catch (e) {
    out.error = String(e && e.message || e).slice(0, 300);
    endPrompt(); closeViewer();
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say(`INVALID (${out.error}). This attempt is NOT evidence.`, 'Reload this page (F5) to retry.'); document.title = 'INVALID - reload to retry';
  }
})();
