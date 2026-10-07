  // [IB11-P1] Stage-close control for the V-D8 qualification page: after a
  // real media failure, a trusted click on the empty stage (away from the
  // failure message) must still close the viewer.
  async function STAGECLOSE(out) {
    cell = 'STAGECLOSE';
    await openCard('NATIVE');
    const ok = await waitFor(() => stageInfo().link === 'card-post', 6000);
    if (!ok) throw new Error('STAGECLOSE_NO_FAILURE');
    await sleep(300);
    const st = document.querySelector('.be-media-state'); const sb = st ? st.getBoundingClientRect() : null;
    const away = (e) => typeof e.clientX === 'number' && (!sb || e.clientX < sb.left - 30 || e.clientX > sb.right + 30 || e.clientY < sb.top - 30 || e.clientY > sb.bottom + 30);
    prompt('Click once on the dark empty area of the viewer, away from the message.', 'Not on the toolbar and not on the message.');
    const ck = await expectEvent(['click'], away, PROMPT_TIMEOUT_MS, 'empty stage area');
    await sleep(300);
    out.cells.STAGECLOSE = { card: 'NATIVE', click: { ...strip(ck), x: ck.e.clientX, y: ck.e.clientY, targetIsStage: !!(ck.e.target && ck.e.target.classList && ck.e.target.classList.contains('be-viewer-stage')) }, openAfter: isOpen(), outsideTrusted: outside.STAGECLOSE || 0 };
    endPrompt();
  }
