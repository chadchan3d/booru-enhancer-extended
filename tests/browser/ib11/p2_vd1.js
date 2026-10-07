  // [IB11-P2] V-D1 qualification: after a real media failure, a late same-post
  // update through the production path (viewer.updatePost with the cached
  // post - exactly what the gallery's open-time enrichment delivers) must keep
  // the failure state and its native link; the link must then still work
  // (revision-1.3 NATIVE cell on the same open viewer).
  async function P2_VD1(out) {
    cell = 'VD1P2';
    await openCard('NATIVE');
    const ok = await waitFor(() => stageInfo().link === 'card-post', 6000);
    if (!ok) throw new Error('P2_NO_FAILURE');
    await sleep(300);
    const el = stageMedia(); const linkBefore = document.querySelector('.be-viewer-native-fallback');
    const before = stageInfo(); const failEvent = !!(V.rec(el) && V.rec(el).ev.some((x) => x[1] === 'error'));
    const updateT = V.t();
    BE.modules.viewer.updatePost({ ...BE.modules.gallery.getCachedPost(cfg.cards.NATIVE) });
    const after0 = stageInfo(); await sleep(500); const after500 = stageInfo();
    const linkAfter = document.querySelector('.be-viewer-native-fallback');
    out.cells.VD1P2 = { card: 'NATIVE', failEvent, updateT, before, after0, after500, sameMedia: stageMedia() === el, sameLinkNode: !!linkAfter && linkAfter === linkBefore, outsideTrusted: outside.VD1P2 || 0 };
    out.outsideTrusted = outside;
    if (after500.open && after500.link === 'card-post') { await NATIVE_R(out, { reuseOpen: true }); return; }
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    say('Recorded: the failure state and link were erased by the late update (no link to click).', 'Return the results file.');
  }
