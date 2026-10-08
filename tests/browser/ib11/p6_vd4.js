  // [IB11-P6] V-D4 qualification: the V-VIEW VD4 steps on the loaded wide
  // (2000x1000) fixture with fit-both - unrotated fit measured, the viewer's
  // own "Rotate right" control, then two trusted browser resizes (F11 in, F11
  // out) each followed by the stage and rendered-media rectangles. The viewer
  // then stays open in the repaired rotated-fit state for one operator
  // screenshot (Windows+PrtScn saves it without leaving the page), confirmed
  // with Enter, and the state is measured once more before closing.
  async function P6_VD4(out) {
    cell = 'VD4';
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
    out.cells.VD4 = { card: 'VD4', fitMode: BE.settings.get('viewer.fitMode'), s0, sRot, resize1: strip(r1), sA, resize2: strip(r2), sB, resizes, outsideTrusted: outside.VD4 || 0 };
    cell = 'SHOT';
    prompt('Press Windows+PrtScn once to save a screenshot of this screen, then press Enter.', 'Do not click the page. Windows saves the file in Pictures > Screenshots.');
    const en = await expectEvent(['keydown'], (e) => e.key === 'Enter', PROMPT_TIMEOUT_MS, 'Enter after screenshot');
    const sC = stageInfo(); endPrompt();
    out.cells.SHOT = { enter: strip(en), sC, outsideTrusted: outside.SHOT || 0 };
    closeViewer();
    out.outsideTrusted = outside;
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say('P6 RECORDED', 'Return the results file and the screenshot.'); document.title = 'P6 RECORDED';
  }
