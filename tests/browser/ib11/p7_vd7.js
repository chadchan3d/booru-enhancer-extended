  // [IB11-P7] V-D7 qualification (automatic; no operator input). Cards: VD7P
  // (quick 2000x1000 image); VD7 (160x80 thumb placeholder, the page's own
  // card thumbnail, so already loaded; slow 1600x800 original); VD7X (800x400
  // placeholder fetched by the viewer; slow original).
  // Real Chrome (first P7 attempt): an <img> whose src is replaced by a URL
  // that must be fetched reads naturalWidth/Height 0 while the old image stays
  // painted, so the placeholder is identified by its REAL LAYOUT rectangle
  // (the fitted placeholder footprint), never by naturalWidth. Every animation
  // frame records the painted state: the last placeholder frame and the first
  // full-image frame are compared (both painted states).
  //  P7STAGE: open VD7P, wait for its original, ArrowRight onto VD7; samples at
  //   300 ms and 1000 ms; frames until 500 ms after the upgrade.
  //  P7XFORM: open VD7X; wait for the retained-placeholder state; apply Rotate
  //   right, Flip horizontal, Flip vertical, Zoom in x2 and a pan with the viewer
  //   controls before the original completes; measure the same way.
  async function P7_VD7(out) {
    BE.settings.set('viewer.fitMode', 'fit-both');
    const raf = (f) => (window.requestAnimationFrame ? window.requestAnimationFrame(f) : setTimeout(f, 16));
    const rect = (el) => { if (!el || !el.isConnected) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
    const PH = { VD7: { label: 'VD7-thumb', dims: [160, 80] }, VD7X: { label: 'VD7X-mid', dims: [800, 400] } };
    const nearPx = (a, b) => Math.abs(a - b) <= Math.max(2, 0.005 * Math.abs(b));
    // fit-both footprint of a placeholder in the current stage (12 px padding per side)
    const fitted = (role) => { const s = rect(stage()); if (!s) return null; const [pw, ph] = PH[role].dims; const z = Math.min((s.w - 24) / pw, (s.h - 24) / ph); return { w: pw * z, h: ph * z, z }; };
    const isFullImg = (el) => !!el && /-slow$/.test(V.labelOf(el.getAttribute('src'))) && el.complete && el.naturalWidth === 1600;
    const shot = (el) => ({ t: V.t(), wall: Date.now(), rect: rect(el), stageRect: rect(stage()), transform: el ? el.style.transform : null, nw: el ? el.naturalWidth : 0, nh: el ? el.naturalHeight : 0, complete: el ? el.complete : null,
      srcLabel: el ? V.labelOf(el.getAttribute('src')) : '', firstLabel: el && V.rec(el) ? V.rec(el).label : '', currentId: BE.modules.viewer.currentPost ? String(BE.modules.viewer.currentPost.id) : null,
      inStage: (stage() ? stage().querySelectorAll('img, video').length : 0), inOverlay: document.querySelectorAll('#be-viewer-overlay img, #be-viewer-overlay video').length, state: stageInfo().state, open: isOpen(), full: isFullImg(el) });
    // the retained placeholder: right target, one media element, the target's placeholder was the first rendition,
    // not (yet) the completed original, and painted at the fitted placeholder footprint
    const retained = (el, role, id) => { const s = shot(el); const f = fitted(role);
      return !!s.rect && !!f && s.currentId === id && s.inStage === 1 && s.firstLabel === PH[role].label && !s.full && s.rect.w > 0 && s.rect.h > 0 && nearPx(s.rect.w, f.w) && nearPx(s.rect.h, f.h); };
    const watch = () => {
      let on = true; let frames = 0; let blank = 0; const blanks = []; let firstShownT = null; const t0 = V.t(); let lastPlaceholder = null; let firstFull = null;
      const tick = () => { if (!on) return; frames++; const st = stage(); const ms = st ? [...st.querySelectorAll('img, video')] : [];
        const vis = ms.filter((m) => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
        // a blank stage counts once the target's image has been displayed (the navigation fetch gap before it is firstShownMs)
        if (!vis.length) { if (firstShownT !== null) { blank++; if (blanks.length < 10) blanks.push({ t: V.t(), n: ms.length }); } }
        else { if (firstShownT === null) firstShownT = V.t(); const m = vis[0];
          const f = { t: V.t(), wall: Date.now(), rect: rect(m), transform: m.style.transform, nw: m.naturalWidth, nh: m.naturalHeight, srcLabel: V.labelOf(m.getAttribute('src')), complete: m.complete };
          if (isFullImg(m)) { if (!firstFull) firstFull = f; } else lastPlaceholder = f; }
        raf(tick); };
      raf(tick); return { stop() { on = false; return { frames, blank, blanks, firstShownMs: firstShownT === null ? null : firstShownT - t0, lastPlaceholder, firstFull }; } };
    };
    // the element's own load once it holds the completed original (post-handler state)
    const upgradeOf = (el) => new Promise((resolve) => { el.addEventListener('load', () => { if (isFullImg(el)) resolve(shot(el)); }); });

    // ---- P7STAGE ----
    cell = 'P7STAGE';
    await openCard('VD7P');
    const prevOk = await waitFor(() => { const m = stageMedia(); return !!m && /VD7P-wide/.test(V.labelOf(m.getAttribute('src'))) && m.complete && m.naturalWidth === 2000; }, 15000);
    const prev = shot(stageMedia());
    const tNav = V.t();
    key('ArrowRight'); await sleep(0);
    const el = stageMedia(); const w0 = watch(); const up0 = upgradeOf(el); const idS = String(cfg.cards.VD7);
    const samples = [];
    for (const at of [300, 1000]) { await sleep(Math.max(0, tNav + at - V.t())); const m = stageMedia(); samples.push({ at, ...shot(m), retained: retained(m, 'VD7', idS), fitted: fitted('VD7') }); }
    const upAt = await Promise.race([up0, sleep(30000).then(() => null)]);
    await sleep(500); const after = shot(stageMedia()); const frames0 = w0.stop();
    out.cells.P7STAGE = { prevId: String(cfg.cards.VD7P), targetId: idS, prevOk, prev, samples, upgrade: upAt, after, sameElement: stageMedia() === el, frames: frames0, outsideTrusted: outside.P7STAGE || 0 };
    closeViewer(); await sleep(300);

    // ---- P7XFORM ----
    cell = 'P7XFORM';
    const idX = String(cfg.cards.VD7X);
    await openCard('VD7X'); const ex = stageMedia(); const up1 = upgradeOf(ex); const w1 = watch();
    const phOk = await waitFor(() => retained(ex, 'VD7X', idX), 10000); await sleep(100);
    const fittedShot = { ...shot(ex), fitted: fitted('VD7X'), retained: retained(ex, 'VD7X', idX) };
    btn('Rotate right').click(); btn('Flip horizontal').click(); btn('Flip vertical').click(); btn('Zoom in').click(); btn('Zoom in').click();
    const r0 = rect(ex); const px = r0 ? r0.cx : 400; const py = r0 ? r0.cy : 400; const PE = window.PointerEvent || MouseEvent;
    const pe = (type, x, y) => ex.dispatchEvent(new PE(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
    pe('pointerdown', px, py); pe('pointermove', px + 40, py - 25); pe('pointerup', px + 40, py - 25);
    await sleep(150);
    const transformed = shot(ex);
    const upAt1 = await Promise.race([up1, sleep(30000).then(() => null)]);
    await sleep(500); const after1 = shot(stageMedia()); const frames1 = w1.stop();
    out.cells.P7XFORM = { targetId: idX, phOk, fittedShot, transformed, upgrade: upAt1, after: after1, sameElement: stageMedia() === ex, frames: frames1, outsideTrusted: outside.P7XFORM || 0 };
    closeViewer();

    out.outsideTrusted = outside;
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say('P7 RECORDED', 'Return the results file.'); document.title = 'P7 RECORDED';
  }
