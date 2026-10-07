  // [IB11-P3] V-D5 qualification: trusted Ctrl+F, Ctrl+D and Alt+O, then
  // unmodified F and D as controls. Favorite, Download and window.open are
  // recording stubs in this test page only. The viewer's decision is measured
  // by a window BUBBLE-phase listener, which runs after production's document
  // keydown listener: it records e.defaultPrevented as the viewer left it.
  // Only for Ctrl/Meta+D does that listener then preventDefault, so Chrome
  // never adds a bookmark (no bookmark mutation); Ctrl+F's Find bar is left to
  // open (harmless) as the real demonstration that the browser receives it.
  async function P3_VD5(out) {
    const opened = []; window.open = (u) => { opened.push(String(u)); return null; };
    let last = null;
    window.addEventListener('keydown', (e) => {
      const k = String(e.key || '').toLowerCase();
      const suppress = (e.ctrlKey || e.metaKey) && k === 'd';
      last = { key: e.key, viewerPrevented: e.defaultPrevented, runnerSuppressed: suppress };
      if (suppress) e.preventDefault();
    });
    const step = async (into, want, label, pred, extra = {}) => {
      if (!isOpen()) await openCard('VD5');
      const f0 = stubs.fav.length; const d0 = stubs.dl.length; const o0 = opened.length; const openBefore = isOpen(); last = null;
      prompt(label);
      const ev = await expectEvent(['keydown'], pred, PROMPT_TIMEOUT_MS, want);
      await sleep(300);
      const m = last && last.key === ev.e.key ? last : null;
      into.push({ want, ...strip(ev), defaultPrevented: m ? m.viewerPrevented : null, runnerSuppressedBrowserDefault: m ? m.runnerSuppressed : null, fav: stubs.fav.length - f0, dl: stubs.dl.length - d0, open: opened.length - o0, openBefore, openAfter: isOpen(), ...extra });
      endPrompt(); grace = true;
      say('Recorded.', 'If a browser bar, menu or dialog opened, press Esc to close it. Continuing in 5 seconds…');
      await sleep(5000); grace = false;
    };
    const chord = (w) => (e) => String(e.key || '').toLowerCase() === w && (e.ctrlKey || e.metaKey);
    const plain = (k) => (e) => e.key === k && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey;
    cell = 'VD5'; await openCard('VD5'); const chords = [];
    await step(chords, 'f', 'Hold Ctrl and press F once  (Ctrl+F)', chord('f'));
    await step(chords, 'd', 'Hold Ctrl and press D once  (Ctrl+D)', chord('d'));
    closeViewer();
    out.cells.VD5 = { card: 'VD5', chords, outsideTrusted: outside.VD5 || 0 };
    cell = 'P3KEYS'; const rows = [];
    await step(rows, 'alt+o', 'Hold Alt and press O once  (Alt+O)', (e) => String(e.key || '').toLowerCase() === 'o' && e.altKey);
    await step(rows, 'f', 'Press F once (no other key held)', plain('f'));
    await step(rows, 'd', 'Press D once (no other key held)', plain('d'));
    closeViewer();
    out.cells.P3KEYS = { card: 'VD5', rows, outsideTrusted: outside.P3KEYS || 0 };
    out.outsideTrusted = outside;
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say('P3 RECORDED', 'Return the results file.'); document.title = 'P3 RECORDED';
  }
