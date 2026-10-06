# IB11 G-PLAY controlled viewer-playback probe (E stage; operator run pending)

`IB11_GPLAY_Controlled.user.js` contains production `4d793a2` (blob `002bdfd`) **unchanged**, wrapped by:
- an observe-only recorder (`gplay_preamble.js`);
- a cell runner (`gplay_postamble.js`).

It runs only on the local server `http://127.0.0.1:8796/*`. It opens the existing viewer through the gallery's own click path and records preference, actual playback and lifecycle **separately**. An assigned autoplay attribute is never treated as playback. Record: `docs/implementation/IB11_BASELINE.md` §5.

**Preferences** are set in this test script's own storage, never in the production script's. Hover preview is turned off on these pages.

**Pages:**
- **Arm N (MP4, then WebM):** no user activation until the final RETRY prompt.
- **Arm U (MP4, then WebM):** your Start click gives the page activation.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_gplay.cjs --check`
- `node tests/browser/ib11/verify_ib11_gplay.cjs` (28/28; jsdom simulator, not browser evidence)

## Fixtures

These are the IB10 fixtures `ib10_v3c_fixture.mp4` and `ib10_v3c_fixture.webm` (see `tests/browser/ib10/README.md`). They are not tracked. The server refuses to start unless their SHA-256 values match.

## Operator steps (Chrome + Tampermonkey, normal profile; about 5 minutes)

1. **Start the server:** `node tests/browser/ib11/gplay_server.cjs --media <fixture folder> --out <fixture folder>/ib11-gplay-results.json`. It prints "media SHA-256 verified; 4 pages". If it refuses, stop and report.
2. **Prepare Tampermonkey:** **disable** every other Booru Enhancer / IB script. Install `IB11_GPLAY_Controlled.user.js`. Turn the **sound on** (a normal system volume).
3. **Open** `http://127.0.0.1:8796/gplay/start` in a new tab. Keep it in front and visible; DevTools closed.
4. **Arm N pages (MP4, then WebM):**
   - Keep the mouse **outside the window** and do not press keys while the panel says "running".
   - Each page ends with "press the SPACE bar once now". Click nothing; just press **Space** once.
5. **Arm U pages (MP4, then WebM):**
   - Click **Start** in the panel at the top-right.
   - When asked, click **Unmute**. Otherwise don't touch the page.
6. **Finish:** the last page shows "all pages complete" and the server prints "all pages complete". Return `ib11-gplay-results.json`. It contains no URLs or IDs, only cell labels, times, states and browser/manager brand versions.
7. **Clean up:** disable the script and stop the server with Ctrl+C. If a run stops partway, Ctrl+C writes the pages completed so far; return that file.

**Evaluate:** `node tests/browser/ib11/gplay_evaluate.cjs <ib11-gplay-results.json> [--recovery <ib11-gplay-recovery.json>]` (now revision 1.1). The raw results files are not committed (`.gitignore`); only their SHA-256 values and the verdict are recorded.

---

# Targeted DELIB recovery (IB11-E1): only U-mp4-DELIB and U-webm-DELIB

In the first run, both DELIB cells timed out at the Unmute prompt (no click). Those two cells are re-run alone. The 30 other cells of the first run (raw SHA-256 `13888dd9…0048`, unchanged) are kept.

`IB11_GPLAY_Recovery.user.js` is the same evidence package (production `4d793a2` body unchanged, same recorder) with runner-only patches:
- **Hard-to-miss prompts:** a large yellow panel in the middle of the screen, and the tab title reads "ACTION NEEDED".
- **No silent advance:** if you don't click within 3 minutes, the page shows **INVALID** and does not advance. Reload it (F5) to retry. An INVALID attempt is never evidence.
- **Playback first:** the Unmute prompt appears only after the video is actually playing.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_gplay_recovery.cjs --check`
- `node tests/browser/ib11/verify_ib11_gplay_recovery.cjs --media <fixture folder>` (28/28)

## Operator steps (about 1 minute)

1. **Start the server in recovery mode:** `node tests/browser/ib11/gplay_server.cjs --media <fixture folder> --recovery --out <fixture folder>/ib11-gplay-recovery.json`. It prints "2 pages (RECOVERY …)".
2. **Prepare Tampermonkey:** disable every other script, **including `IB11_GPLAY_Controlled.user.js`**. Install and enable `IB11_GPLAY_Recovery.user.js`. Sound on.
3. **Open** `http://127.0.0.1:8796/gplay/start`. On each of the two pages:
   - click **Start**;
   - wait until the video is playing;
   - click the big **Unmute** button.
4. **Finish:** the server prints "all pages complete". Return `ib11-gplay-recovery.json`.

**Evaluate both files together:** `node tests/browser/ib11/gplay_evaluate.cjs <ib11-gplay-results.json> --recovery <ib11-gplay-recovery.json>`.

---

# IB11 V-VIEW browser-evidence probe (IB11-E3; operator run pending)

`IB11_VVIEW_Controlled.user.js` contains production `4d793a2` (blob `002bdfd`) **unchanged**, wrapped by an observe-only recorder (`vview_preamble.js`) and a page runner (`vview_postamble.js`). It runs only on `http://127.0.0.1:8797/*`.

It characterizes the remaining IB11 viewer behavior:
- V-D7 (placeholder while loading);
- V-D4 (rotated fit after a real resize);
- V-D6a/b (synchronous media-build failure);
- V-D1 (failure state after a same-ID update);
- V-D5 (real Ctrl+F / Ctrl+D);
- Space with the native video control focused (G3);
- focus from mouse and keyboard origins;
- the native link after a real failure.

**Fixture details:**
- Favorite and Download are **stubbed in this test page only**, so no account action or download happens.
- Preferences live in this test script's own storage.
- Images are generated plain PNGs. The video card uses the IB10 WebM fixture.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_vview.cjs --check`
- `node tests/browser/ib11/verify_ib11_vview.cjs --media <fixture folder>` (45/45)

## Operator runbook (Chrome + Tampermonkey, normal profile; about 4 minutes)

**Before:**
1. Start the server: `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --out <fixture folder>/ib11-vview-results.json`. It must print "media SHA-256 verified; 2 pages".
2. In Tampermonkey, **disable** every other script (including the G-PLAY scripts) and install **`IB11_VVIEW_Controlled.user.js`**.
3. Use a normal (not full-screen) window. Open `http://127.0.0.1:8797/vview/start`.

**Page 1 (MAIN).** First, **hands off for about 30 seconds** while the panel at the top says "running automatic checks". Then answer each yellow instruction exactly once. When input is needed, the tab title reads ">>> ACTION NEEDED <<<".

| # | Instruction shown | What you do |
| --- | --- | --- |
| 1 | Press F11 once | Press **F11** (the page goes full screen). Wait. |
| 2 | Press F11 again | Press **F11** (back to normal). |
| 3 | Hold Ctrl and press F once | Press **Ctrl+F**. If a Find bar appears, press **Esc** to close it (you have 6 s; that Esc is not counted). |
| 4 | Hold Ctrl and press D once | Press **Ctrl+D**. If a bookmark dialog appears, press **Esc**. |
| 5 | Click the play/pause button at the bottom-left of the video once | **Click** that button once. |
| 6 | Press the Space bar once | Press **Space** once. |
| 7 | Click the PINK-outlined card once | **Click** the pink-outlined card with the mouse. |
| 8 | Press Escape once | Press **Esc**. |
| 9 | Press Tab until the BLUE-outlined card is focused, then press Enter | Press **Tab** (usually once) until the panel says "✓ … press Enter now", then press **Enter**. |
| 10–12 | Press Tab once (1 of 3), (2 of 3), (3 of 3) | Press **Tab** once for each. |
| 13 | Click the ✕ (Close) button … | **Click ✕**, the last button of the toolbar at the bottom. |
| 14 | Click the underlined "Open native post" link … | **Click** the link. The page changes to "Native post page reached", then continues by itself. |

**Page 2 (TAKEOVER):**

| # | Instruction shown | What you do |
| --- | --- | --- |
| 15 | Click the ORANGE-outlined video card once | **Click** it. The page changes to "Native post page reached", then to the done page. |

**After:**
- **Done:** the server prints "all pages complete". Return **`ib11-vview-results.json`**. Do not open DevTools or the JSON during the run.
- **If the panel ever shows INVALID:** press **F5** to retry that page. An INVALID attempt is never evidence.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs <ib11-vview-results.json>` (revision 1.0). It reports evidence (PASS/FAIL/INVALID) and the product finding separately for every cell.
