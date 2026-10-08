  // [IB11-P8] focus ownership/return qualification (real Chrome, trusted input).
  // Cards: FOCUS_K (blue; first in the page, reached by Tab), FOCUS_M (pink),
  // VD5 (another card: page controls behind the overlay). Every step records
  // the focused element as a descriptor plus identity flags: the viewer Close
  // button, the first viewer-owned control (the current viewer DOM, document
  // order), the actual invoking element captured at the opening input.
  //  P8M (mouse origin): click the pink card -> Tab (Close wraps to the first
  //   viewer control) -> Shift+Tab (first wraps to Close) -> Escape.
  //  P8K (keyboard origin): Tab to the blue card, Enter -> Shift+Tab (native
  //   move inside the toolbar) -> Tab (back to Close) -> Tab (Close wraps to the
  //   first viewer control) -> click the Close (✕) button.
  async function P8_FOCUS(out) {
    const ov = () => document.querySelector('#be-viewer-overlay');
    const closeBtn = () => [...document.querySelectorAll('.be-viewer-btn')].find((b) => b.title.startsWith('Close'));
    const rendered = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { if (n.hidden) return false; const cs = getComputedStyle(n); if (cs.display === 'none') return false; } return true; };
    const viewerItems = () => { const o = ov(); return o ? [...o.querySelectorAll('button, a[href], input, select, textarea, video[controls], audio[controls], [tabindex]')].filter((el) => el.tabIndex >= 0 && !el.disabled && rendered(el)) : []; };
    let invEl = null;
    const now = (label) => { const a = document.activeElement; const items = viewerItems();
      return { label, t: V.t(), wall: Date.now(), open: isOpen(), active: desc(a), inOverlay: !!(ov() && ov().contains(a)), isClose: a === closeBtn(), isFirst: items.length > 0 && a === items[0], isLast: items.length > 0 && a === items[items.length - 1],
        isInvoker: !!invEl && a === invEl, isBody: a === document.body || !a, itemCount: items.length, first: desc(items[0]), last: desc(items[items.length - 1]) }; };
    const step = async (into, label, text, pred) => {
      prompt(text);
      const ev = await expectEvent(['keydown'], pred, PROMPT_TIMEOUT_MS, label);
      await sleep(200); endPrompt();
      into.push({ label, ...strip(ev), after: now(`${label}:after`) });
    };
    const isTab = (shift) => (e) => e.key === 'Tab' && !!e.shiftKey === shift && !e.ctrlKey && !e.metaKey && !e.altKey;

    // ---- P8M: mouse origin ----
    cell = 'P8M';
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const onPink = (e) => !!(e.target.closest && e.target.closest('article[data-vview-role="FOCUS_M"]'));
    prompt('Click the PINK-outlined card once.');
    const ckP = expectEvent(['click'], onPink, PROMPT_TIMEOUT_MS + 10000, 'pink card click');
    const pd = await expectEvent(['pointerdown'], onPink, PROMPT_TIMEOUT_MS, 'pink card');
    const ck = await ckP;
    invEl = (ck.e.target.closest && ck.e.target.closest('a')) || null;
    const mInvoker = desc(invEl);
    const mOpened = await waitFor(() => isOpen() && BE.modules.viewer.currentPost && String(BE.modules.viewer.currentPost.id) === String(cfg.cards.FOCUS_M), 5000);
    endPrompt(); await sleep(0); const mOpen0 = now('afterOpen0'); await sleep(300); const mOpen300 = now('afterOpen300');
    const mSteps = [];
    await step(mSteps, 'tab', 'Press Tab once.', isTab(false));
    await step(mSteps, 'shiftTab', 'Hold Shift and press Tab once  (Shift+Tab).', isTab(true));
    prompt('Press Escape once.');
    const esc = await expectEvent(['keydown'], (e) => e.key === 'Escape', PROMPT_TIMEOUT_MS, 'Escape');
    await sleep(0); const mClose0 = now('afterClose0'); await sleep(300); const mClose300 = now('afterClose300'); endPrompt();
    out.cells.P8M = { card: 'FOCUS_M', pointer: strip(pd), click: strip(ck), invoker: mInvoker, opened: mOpened, afterOpen0: mOpen0, afterOpen300: mOpen300, steps: mSteps, escape: strip(esc), afterClose0: mClose0, afterClose300: mClose300, outsideTrusted: outside.P8M || 0 };
    closeViewer(); await sleep(300);

    // ---- P8K: keyboard origin ----
    cell = 'P8K'; invEl = null;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const inK = () => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('article[data-vview-role="FOCUS_K"]'));
    prompt('Press Tab until the BLUE-outlined card is focused, then press Enter.');
    const live = setInterval(() => { sub.textContent = inK() ? '✓ The blue card is focused — press Enter now.' : 'Not yet — press Tab.'; }, 100);
    const en = await expectEvent(['keydown'], (e) => { if (e.key === 'Enter' && inK()) { invEl = document.activeElement; return true; } return false; }, PROMPT_TIMEOUT_MS, 'Enter on blue card');
    clearInterval(live);
    const kInvoker = desc(invEl);
    const kOpened = await waitFor(() => isOpen() && BE.modules.viewer.currentPost && String(BE.modules.viewer.currentPost.id) === String(cfg.cards.FOCUS_K), 5000);
    endPrompt(); await sleep(0); const kOpen0 = now('afterOpen0'); await sleep(300); const kOpen300 = now('afterOpen300');
    const kSteps = [];
    await step(kSteps, 'shiftTab', 'Keyboard check: hold Shift and press Tab once  (Shift+Tab).', isTab(true));
    await step(kSteps, 'tab1', 'Keyboard check: press Tab once.', isTab(false));
    await step(kSteps, 'tab2', 'Keyboard check: press Tab once more.', isTab(false));
    prompt('Click the ✕ (Close) button — the last button of the viewer toolbar at the bottom.');
    const cl = await expectEvent(['click'], (e) => !!(e.target.closest && e.target.closest('.be-viewer-btn') && e.target.closest('.be-viewer-btn').title.startsWith('Close')), PROMPT_TIMEOUT_MS, 'Close button');
    await sleep(0); const kClose0 = now('afterClose0'); await sleep(300); const kClose300 = now('afterClose300'); endPrompt();
    out.cells.P8K = { card: 'FOCUS_K', enter: strip(en), invoker: kInvoker, opened: kOpened, afterOpen0: kOpen0, afterOpen300: kOpen300, steps: kSteps, closeClick: strip(cl), afterClose0: kClose0, afterClose300: kClose300, outsideTrusted: outside.P8K || 0 };
    closeViewer();

    out.outsideTrusted = outside;
    await fetch('/vview/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) }).catch(() => {});
    panel.style.cssText = BIG; say('P8 RECORDED', 'Return the results file.'); document.title = 'P8 RECORDED';
  }
