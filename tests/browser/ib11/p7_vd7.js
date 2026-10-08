  // [IB11-P7] V-D7 qualification (automatic; no operator input). Cards: VD7P
  // (quick 2000x1000 image), VD7 and VD7X (each a 160x80 thumb as sample/
  // preview and a slow 1600x800 original). The displayed image is read from
  // naturalWidth/Height (the browser keeps the current image while a new src
  // is pending). Geometry is real layout (getBoundingClientRect, unrounded).
  //  P7STAGE: open VD7P, wait for its original, ArrowRight onto VD7 (in-viewer
  //   navigation). Samples at 300 ms and 1000 ms; every animation frame until
  //   500 ms after the upgrade is checked for a blank stage; the upgrade is
  //   measured inside the original's load event (after production's handler,
  //   before paint) and again 500 ms later.
  //  P7XFORM: open VD7X; once its placeholder is displayed, apply Rotate right,
  //   Flip horizontal, Flip vertical, Zoom out x2 (manual zoom; Zoom in is capped at 8) with the viewer
  //   controls and a pointer drag (pan); then measure as above.
  async function P7_VD7(out) {
    BE.settings.set('viewer.fitMode', 'fit-both');
    const raf = (f) => (window.requestAnimationFrame ? window.requestAnimationFrame(f) : setTimeout(f, 16));
    const rect = (el) => { if (!el || !el.isConnected) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
    const shot = (el) => ({ t: V.t(), wall: Date.now(), rect: rect(el), transform: el ? el.style.transform : null, nw: el ? el.naturalWidth : 0, nh: el ? el.naturalHeight : 0, complete: el ? el.complete : null,
      srcLabel: el ? V.labelOf(el.getAttribute('src')) : '', firstLabel: el && V.rec(el) ? V.rec(el).label : '', currentId: BE.modules.viewer.currentPost ? String(BE.modules.viewer.currentPost.id) : null,
      inStage: (stage() ? stage().querySelectorAll('img, video').length : 0), inOverlay: document.querySelectorAll('#be-viewer-overlay img, #be-viewer-overlay video').length, state: stageInfo().state, open: isOpen() });
    const watch = () => {
      let on = true; let frames = 0; let blank = 0; const blanks = []; let last = null; let firstShownT = null; const t0 = V.t();
      const tick = () => { if (!on) return; frames++; const st = stage(); const ms = st ? [...st.querySelectorAll('img, video')] : [];
        const vis = ms.filter((m) => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (m.naturalWidth || m.videoWidth || 0) > 0; });
        // a blank stage counts once the target's image has been displayed (the navigation fetch gap before it is reported as firstShownMs)
        if (!vis.length) { if (firstShownT !== null) { blank++; if (blanks.length < 10) blanks.push({ t: V.t(), n: ms.length }); } } else { if (firstShownT === null) firstShownT = V.t(); last = { t: V.t(), rect: rect(vis[0]), nw: vis[0].naturalWidth, nh: vis[0].naturalHeight, transform: vis[0].style.transform }; }
        raf(tick); };
      raf(tick); return { last: () => last, stop() { on = false; return { frames, blank, blanks, firstShownMs: firstShownT === null ? null : firstShownT - t0 }; } };
    };
    const upgradeOf = (el) => new Promise((resolve) => { el.addEventListener('load', () => { if (el.complete && /-slow$/.test(V.labelOf(el.getAttribute('src')))) resolve(shot(el)); }); }); // the original's own load (the placeholder's load ends with the original pending: complete false)

    // ---- P7STAGE ----
    cell = 'P7STAGE';
    await openCard('VD7P');
    const prevOk = await waitFor(() => { const m = stageMedia(); return !!m && /VD7P-wide/.test(V.labelOf(m.getAttribute('src'))) && m.complete && m.naturalWidth === 2000; }, 15000);
    const prev = shot(stageMedia());
    const w0 = watch(); const tNav = V.t();
    key('ArrowRight'); await sleep(0);
    const el = stageMedia(); const up0 = upgradeOf(el);
    const samples = [];
    for (const at of [300, 1000]) { await sleep(Math.max(0, tNav + at - V.t())); samples.push({ at, ...shot(stageMedia()) }); }
    // resumed in a microtask of the original's load task: no frame since, so last() is the last pre-upgrade frame
    const upAt = await Promise.race([up0, sleep(30000).then(() => null)]); const beforeUpgrade = w0.last();
    await sleep(500); const after = shot(stageMedia()); const frames0 = w0.stop();
    out.cells.P7STAGE = { prevId: String(cfg.cards.VD7P), targetId: String(cfg.cards.VD7), prevOk, prev, samples, beforeUpgrade, upgrade: upAt, after, sameElement: stageMedia() === el, frames: frames0, outsideTrusted: outside.P7STAGE || 0 };
    closeViewer(); await sleep(300);

    // ---- P7XFORM ----
    cell = 'P7XFORM';
    await openCard('VD7X'); const ex = stageMedia(); const up1 = upgradeOf(ex);
    const phOk = await waitFor(() => ex.naturalWidth === 160 && ex.naturalHeight === 80, 10000); await sleep(100);
    const fitted = shot(ex);
    btn('Rotate right').click(); btn('Flip horizontal').click(); btn('Flip vertical').click(); btn('Zoom out').click(); btn('Zoom out').click();
    const r0 = rect(ex); const px = r0.cx; const py = r0.cy; const PE = window.PointerEvent || MouseEvent; const pe = (type, x, y) => ex.dispatchEvent(new PE(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    pe('pointerdown', px, py); pe('pointermove', px + 40, py - 25); pe('pointerup', px + 40, py - 25);
    await sleep(100);
    const w1 = watch(); const transformed = shot(ex); const earlyComplete = ex.complete;
    const upAt1 = await Promise.race([up1, sleep(30000).then(() => null)]); const lastBefore1 = w1.last();
    await sleep(500); const after1 = shot(stageMedia()); const frames1 = w1.stop();
    out.cells.P7XFORM = { targetId: String(cfg.cards.VD7X), phOk, fitted, transformed, earlyComplete, beforeUpgrade: lastBefore1, upgrade: upAt1, after: after1, sameElement: stageMedia() === ex, frames: frames1, outsideTrusted: outside.P7XFORM || 0 };
    closeViewer();

    out.outsideTrusted = outside;
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say('P7 RECORDED', 'Return the results file.'); document.title = 'P7 RECORDED';
  }
