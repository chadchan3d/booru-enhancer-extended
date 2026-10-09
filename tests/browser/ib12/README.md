# IB12 browser checks

## IB12-E1: e621 Tier-0 viewer return (real Chrome; under one minute)

`IB12_E1_e621_Tier0.user.js` contains production commit `ac3c9e8` (blob `db54843`, body `d64df2a6…8127`) **unchanged**, followed by an observe-only recorder (`ib12e1_postamble.js`). It runs on e621.net only.

**What the recorder does and does not do:**
- It wraps `BE.modules.viewer.open` pass-through to learn the current card and its focus origin. It snapshots state when Escape is pressed, without blocking the key, and detects the close.
- It does not touch history, scroll, focus, network, storage or settings.
- It records card ordinals, rectangles, scroll positions and focus facts. It never records post IDs or URLs; a leak guard withholds the result if any would appear.

The package uses its own userscript storage, so production runs with default settings.

**Local qualification:**
- `node tests/browser/ib12/build_ib12_e1.cjs --check`
- `node tests/browser/ib12/verify_ib12_e1.cjs` (15/15)

**Operator steps:**
1. **Tampermonkey:** disable every other script, including Booru Enhancer Extended itself. Install and enable `IB12_E1_e621_Tier0.user.js`.
2. **Open** `https://e621.net/posts` in a normal Chrome window, **logged out**, at the top of the page. Wait for the bottom-left status line. One card is outlined in pink (A).
3. **Click card A.** The viewer opens.
4. **Click the viewer's Next ▶ button** (top bar) until the status line says the card is outside the original view. Use the button, not the arrow key, so e621's own keyboard shortcuts cannot change the page.
5. **Press Escape once.** Then do not touch the mouse or keyboard for about two seconds.
6. A result box appears. Click **Download results**, or copy the text, and save it as `tests/results/ib12-e1-e621-tier0.json`. This path is git-ignored and private.

**Evaluate:** `node tests/browser/ib12/evaluate_ib12_e1.cjs tests/results/ib12-e1-e621-tier0.json`

| Verdict | Meaning |
| --- | --- |
| **PREMISE ESTABLISHED** | **G-PLACE-T(e621, Tier 0) E: PASS** — focus returned to C, which stayed connected, while the page stayed where it was and C stayed out of view. |
| BROWSER BRINGS C INTO VIEW | Chrome already shows C. The fact is recorded and work stops; nothing is repaired. |
| INVALID / NOT ESTABLISHED | The reasons are listed. Repeat the run if it was an operator slip. |

## IB12-P1: e621 Tier-0 viewer return confirmation (real Chrome; under one minute)

`IB12_P1_e621_Tier0.user.js` contains the IB12-P1 production (commit `ba6e600`, blob `c6d6655`, body `62f05376…099f`) unchanged. It is followed by the E1 recorder with declared patches (`build_ib12_p1.cjs`), which add:
- the P1 probe identity;
- a pass-through counter on `Element.prototype.scrollIntoView`, showing that the close-time correction happens once, after close;
- a count of scroll events after close.

**Local qualification:**
- `node tests/browser/ib12/build_ib12_p1.cjs --check`
- `node tests/browser/ib12/verify_ib12_p1.cjs` (11/11)

**Operator steps:** the same as E1, with the P1 package.
1. **Tampermonkey:** disable every other script, including the E1 package and Booru Enhancer Extended itself. Install and enable `IB12_P1_e621_Tier0.user.js`.
2. **Open** `https://e621.net/posts`, logged out, at the top of the page. Wait for the status line. One card is outlined in pink (A).
3. **Click card A.** Then click the viewer's **Next ▶** button until the status line says the card is outside the original view.
4. **Press Escape once.** Do not touch anything for about two seconds.
5. **Download the results** (or copy the text) and save it as `tests/results/ib12-p1-e621-tier0.json`. This path is private and git-ignored.

**Evaluate:** `node tests/browser/ib12/evaluate_ib12_p1.cjs tests/results/ib12-p1-e621-tier0.json`. The verdict must be **P1 TIER0 QUALIFIED**:
- C is connected and focused;
- C is usefully visible from close through 1000 ms;
- there is exactly one close-time `scrollIntoView` on C;
- nothing scrolled while the viewer was open;
- there is no further scroll after the correction.
