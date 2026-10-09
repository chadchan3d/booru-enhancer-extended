  // [IB11-P9] D5 qualification (automatic; real layout). A controlled target
  // opens as a metadata-pending IMAGE (a 320x180 placeholder, the same 16:9
  // aspect as the pinned fixture video, decoded 640x360); the production enrichment path
  // (viewer.updatePost) then delivers the SAME post as a VIDEO.
  //  P9MAN: before the video exists, a deliberate manual view is applied with
  //   the viewer controls (Rotate right, Flip horizontal, Flip vertical, Zoom in
  //   x2, a pan); after the rebuild and the video's metadata the transform and
  //   the rendered rectangle are measured (and 1000 ms later). Every frame from
  //   the update on is checked for a blank stage.
  //  P9FIT: control - the same change without a manual view must fit the video
  //   by the configured fit-both rule.
  async function P9_D5(out) {
    BE.settings.set('viewer.fitMode', 'fit-both');
    const raf = (f) => (window.requestAnimationFrame ? window.requestAnimationFrame(f) : setTimeout(f, 16));
    const rect = (el) => { if (!el || !el.isConnected) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
    const dims = (el) => (!el ? [0, 0] : el.tagName === 'VIDEO' ? [el.videoWidth, el.videoHeight] : [el.naturalWidth, el.naturalHeight]);
    const shot = (el) => { const [nw, nh] = dims(el); return { t: V.t(), wall: Date.now(), tag: el ? el.tagName : null, nw, nh, rect: rect(el), stageRect: rect(stage()), transform: el ? el.style.transform : null,
      mediaIndex: el && V.rec(el) ? V.rec(el).i : null, currentId: BE.modules.viewer.currentPost ? String(BE.modules.viewer.currentPost.id) : null, inStage: stage() ? stage().querySelectorAll('img, video').length : 0, state: stageInfo().state, open: isOpen() }; };
    const watch = () => {
      let on = true; let frames = 0; let blank = 0; let shown = false;
      const tick = () => { if (!on) return; frames++; const st = stage(); const vis = st ? [...st.querySelectorAll('img, video')].filter((m) => { const r = m.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) : [];
        if (vis.length) shown = true; else if (shown) blank++; raf(tick); };
      raf(tick); return { stop() { on = false; return { frames, blank }; } };
    };
    const base = (id, role) => ({ id, previewUrl: `/vview/img/${cfg.token}/${role}-thumb.png`, sampleUrl: `/vview/img/${cfg.token}/${role}-v169.png`, mediaType: 'image', metadataPending: true, postUrl: `/posts/${id}` });
    const asVideo = (id, role) => ({ ...base(id, role), originalUrl: `/vview/video/${cfg.token}/${role}.webm`, mediaType: 'video', metadataPending: false });
    const run = async (role, manual) => {
      const id = String(cfg.cards[role]);
      BE.modules.viewer.open(base(id, role), {}, {});
      const img = stageMedia(); const imgOk = await waitFor(() => !!img && img.complete && img.naturalWidth === 320 && img.naturalHeight === 180, 10000); await sleep(200);
      const fitted = shot(img);
      if (manual) {
        btn('Rotate right').click(); btn('Flip horizontal').click(); btn('Flip vertical').click(); btn('Zoom in').click(); btn('Zoom in').click();
        const r0 = rect(img); const PE = window.PointerEvent || MouseEvent;
        const pe = (type, x, y) => img.dispatchEvent(new PE(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
        if (r0) { pe('pointerdown', r0.cx, r0.cy); pe('pointermove', r0.cx + 40, r0.cy - 25); pe('pointerup', r0.cx + 40, r0.cy - 25); }
        await sleep(150);
      }
      const before = shot(img);
      const w0 = watch();
      BE.modules.viewer.updatePost(asVideo(id, role)); const tUpdate = V.t();
      const vid = stageMedia(); const rebuilt = shot(vid); let metaSeen = false;
      if (vid) vid.addEventListener('loadedmetadata', () => { metaSeen = true; }, { once: true });
      const metaOk = await waitFor(() => !!vid && vid.tagName === 'VIDEO' && metaSeen && vid.videoWidth > 0, 15000); await sleep(300);
      const after = shot(stageMedia()); await sleep(700); const after1000 = shot(stageMedia());
      const frames = w0.stop();
      const rec = { role, targetId: id, manual, imgOk, fitted, before, tUpdate, rebuilt, metaOk, after, after1000, sameElementAfter: stageMedia() === vid, imageReplaced: vid !== img && !img.isConnected, frames, outsideTrusted: outside[cell] || 0 };
      closeViewer(); await sleep(300);
      return rec;
    };
    cell = 'P9MAN'; out.cells.P9MAN = await run('P9', true);
    cell = 'P9FIT'; out.cells.P9FIT = await run('P9F', false);
    out.outsideTrusted = outside;
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say('P9 RECORDED', 'Return the results file.'); document.title = 'P9 RECORDED';
  }
