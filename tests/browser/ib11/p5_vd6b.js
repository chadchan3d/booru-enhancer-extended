  // [IB11-P5] V-D6b qualification: a valid open image (card VD6B_A), then the
  // stored volume 1.5 is armed and the operator presses ArrowRight once
  // (trusted in-viewer navigation) onto the video card NATIVE, whose media
  // build throws synchronously (recorder seam). The viewer is recorded 50 ms
  // and 1000 ms later. If a failure with the target's native link is shown,
  // the revision-1.3 NATIVE cell then asks for one click on that link in the
  // same open viewer (hit test, target, navigation, destination arrival).
  async function P5_VD6B(out) {
    cell = 'VD6BP5';
    const statusText = () => (document.querySelector('.be-viewer-status') || {}).textContent || '';
    await BE.store.set('viewer:volume', 0.37);
    await openCard('VD6B_A'); const ready = await waitFor(imgReady, 10000); await sleep(300);
    const prev = stageMedia(); const before = stageInfo(); const statusBefore = statusText();
    await BE.store.set('viewer:volume', 1.5);
    const n0 = V.seam.length;
    prompt('Press the Right Arrow key once  (→)', 'Press nothing else.');
    const ev = await expectEvent(['keydown'], (e) => e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey, PROMPT_TIMEOUT_MS, 'ArrowRight');
    await sleep(50); const after50 = stageInfo(); await sleep(950); const after1000 = stageInfo();
    endPrompt();
    const linkEl = document.querySelector('.be-viewer-native-fallback');
    const rec = { from: 'VD6B_A', to: 'NATIVE', fromId: cfg.cards.VD6B_A, toId: cfg.cards.NATIVE, ready, before, statusBefore,
      key: { ...strip(ev), defaultPrevented: ev.e.defaultPrevented }, after50, after1000, status: statusText(),
      overlayMedia: document.querySelectorAll('#be-viewer-overlay img, #be-viewer-overlay video').length,
      prevConnected: !!prev && prev.isConnected, linkPath: linkEl ? new URL(linkEl.href, location.href).pathname : null,
      seam: V.seam.slice(n0), outsideTrusted: outside.VD6BP5 || 0 };
    await BE.store.set('viewer:volume', 0.37);
    out.cells.VD6BP5 = rec; out.outsideTrusted = outside;
    if (after1000.open && after1000.link === 'card-post' && after1000.currentId === String(cfg.cards.NATIVE)) { await NATIVE_R(out, { reuseOpen: true }); return; }
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    say('Recorded: no failure state with a native link was shown (nothing to click).', 'Return the results file.');
  }
