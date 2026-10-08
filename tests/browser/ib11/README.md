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
- `node tests/browser/ib11/verify_ib11_vview.cjs --media <fixture folder>` (66/66)

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
| 5 | Click the play/pause button at the bottom-left of the video once | **Click the video's own play/pause button** (bottom-left of the video's control bar) once, **not the picture**. If the panel then does not ask for Space, the run continues by itself; that is recorded. |
| 6 | Press the Space bar once | Press **Space** once (do not click anything first). The page may not see the key itself; the probe watches the video. |
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
- **Start a fresh run:** if you have a results file from the first V-VIEW attempt (stalled at the video step), do not reuse it. Start the server with a new `--out` file and run the whole sequence again with the rebuilt package.
- **If the panel ever shows INVALID:** press **F5** to retry that page. An INVALID attempt is never evidence.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs <ib11-vview-results.json>` (revision 1.2). It reports evidence (PASS/FAIL/INVALID) and the product finding separately for every cell.

## G3 real-browser PREFLIGHT (about 30 seconds; do this before any further full V-VIEW run)

This is evidence-tool qualification only: it does not replace the V-VIEW G3 cell. It uses exactly the rebuilt package (SHA-256 `878a3cd39852174ce2fe54c921243c8d7cee9a9df7281a181887377659ec639c`), running only the G3 cell.

1. **Start the server in preflight mode:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --g3-preflight --out <fixture folder>/ib11-vview-g3-preflight.json`. It prints "1 pages (G3 PREFLIGHT only)".
2. **Install the package:** in Tampermonkey, **replace** the V-VIEW script with the rebuilt `IB11_VVIEW_Controlled.user.js`. Keep all other scripts disabled.
3. **Open** `http://127.0.0.1:8797/vview/start`. The video opens in the viewer by itself. Keep your hands off until the yellow instruction appears.
4. **"Click the play/pause button at the bottom-left of the video once":** click the **video's own play/pause button** once, not the picture.
5. **"Press the Space bar once":** press **Space** once. Do not click anything first.
6. **Result:** the panel shows **G3 PREFLIGHT COMPLETE** or **G3 PREFLIGHT INVALID**.
   - On COMPLETE, return `ib11-vview-g3-preflight.json`.
   - On INVALID, press F5 once to retry, or return the file as it is. The Space window waits up to 60 s for a consequence.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --preflight <ib11-vview-g3-preflight.json>`.

## V-VIEW recovery: NATIVE + VD6A only (IB11-E4; about 1 minute)

The full run's other nine MAIN cells are kept from the original raw file. Only these two cells are run again, and they are merged at evaluation time.

1. **Start the server in recovery mode:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --recovery --out <fixture folder>/ib11-vview-recovery.json`. It prints "2 pages (RECOVERY: NATIVE + VD6A only)".
2. **Install the package:** in Tampermonkey, **replace** the V-VIEW script with the rebuilt `IB11_VVIEW_Controlled.user.js` (SHA-256 `598ba6c5be421adab0bf3837f55ce7ee76bfae922b5f2afb515f6db31f41b06a`). Keep all other scripts disabled.
3. **Open** `http://127.0.0.1:8797/vview/start`.
4. **Page 1:** the viewer opens with a failed image and an underlined "Open native post" text.
   - At **"Click the visible underlined "Open native post" text once"**, click **exactly on the underlined words, once**.
   - If nothing seems to happen, that is recorded; do not click again. The page continues by itself after a few seconds.
5. **Page 2:** at **"Click the ORANGE-outlined video card once"**, click it. The page shows "Native post page reached", then the done page.
6. **Return** `ib11-vview-recovery.json`. If a page shows INVALID, press F5 to retry that page.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs <ib11-vview-results.json> --recovery <ib11-vview-recovery.json> --g3-preflight-ref <ib11-vview-g3-preflight.json>` (revision 1.3).

---

# IB11-P1: V-D8 repair qualification (real Chrome; about 1 minute)

`IB11_P1_Native.user.js` (SHA-256 `5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718`) contains the **repaired** production (commit `9aeab36`, blob `039b99e`) unchanged, wrapped by the V-VIEW recorder and runner. The P1 page runs two checks:
- an empty-stage click must still close the viewer;
- the revision-1.3 NATIVE cell, which characterizes the native link.

It qualifies only V-D8. The evidence-pinned V-VIEW package is unchanged.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p1.cjs --check`
- `node tests/browser/ib11/verify_ib11_p1.cjs --media <fixture folder>` (23/23)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p1 --out <fixture folder>/ib11-p1-native.json`. It prints "1 pages (IB11-P1 V-D8 qualification)".
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW script**. Install and enable `IB11_P1_Native.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start`. The viewer opens with a failed image and an underlined "Open native post" text.
4. **At "Click once on the dark empty area of the viewer, away from the message":** click once on the dark area, not on the toolbar and not on the message. The viewer closes.
5. **The viewer opens again. At "Click the visible underlined "Open native post" text once":** click exactly on the underlined words, once. The page should change to "Native post page reached", then to the done page.
6. **Return** `ib11-p1-native.json`. If a page shows INVALID, press F5 to retry.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p1 <ib11-p1-native.json>`. The verdict must be **V-D8 REPAIR QUALIFIED**.

---

# IB11-P2: V-D1 repair qualification (real Chrome; about 1 minute)

`IB11_P2_VD1.user.js` (SHA-256 `d38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a`) contains the **repaired** production (commit `bef4437`, blob `56c495e`) unchanged, wrapped by the V-VIEW recorder and runner. The P2 page runs automatically:
1. it opens a card whose media fails (a real 404) and waits for the failure state and its native link;
2. it applies a late same-post update through the production path (`viewer.updatePost` with the cached post, which is what the gallery's enrichment delivers);
3. it records the failure text and the link 0 ms and 500 ms later.

If they survive, the revision-1.3 NATIVE cell then asks for one click on the link in the **same** open viewer. The package qualifies only V-D1. The V-VIEW and P1 packages are unchanged.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p2.cjs --check`
- `node tests/browser/ib11/verify_ib11_p2.cjs --media <fixture folder>` (23/23)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p2 --out <fixture folder>/ib11-p2-vd1.json`. It prints "1 pages (IB11-P2 V-D1 qualification)".
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW and P1 scripts**. Install and enable `IB11_P2_VD1.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start`. The viewer opens with a failed image and an underlined "Open native post" text. Keep hands off for about 2 seconds.
4. **At "Click the visible underlined "Open native post" text once":** click exactly on the underlined words, once. The page should change to "Native post page reached", then to the done page.
   - If instead the panel says the failure state was erased, nothing needs clicking; return the file.
5. **Return** `ib11-p2-vd1.json`. If a page shows INVALID, press F5 to retry.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p2 <ib11-p2-vd1.json>`. The verdict must be **V-D1 REPAIR QUALIFIED**.

---

# IB11-P3: V-D5 repair qualification (real Chrome; about 2 minutes)

`IB11_P3_VD5.user.js` (SHA-256 `d29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6`) contains the **repaired** production (commit `48e44d9`, blob `f2b46eb`) unchanged, wrapped by the V-VIEW recorder and runner. The P3 page opens one image in the viewer and asks for five key presses, one at a time:
1. Ctrl+F;
2. Ctrl+D;
3. Alt+O;
4. F (no modifier);
5. D (no modifier).

**What the page does:**
- Favorite, Download and "open original" are recording stubs in this test page. No real favorite, download or tab is made.
- The viewer's decision is measured after production's key handler: which command ran, and whether the viewer called `preventDefault`.
- **Ctrl+D:** after that measurement the runner blocks Chrome's default, so **no bookmark is added**.
- **Ctrl+F:** Chrome's Find bar opens. That is expected and harmless; press Esc to close it.

The package qualifies only V-D5. The V-VIEW, P1 and P2 packages are unchanged.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p3.cjs --check`
- `node tests/browser/ib11/verify_ib11_p3.cjs --media <fixture folder>` (32/32)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p3 --out <fixture folder>/ib11-p3-vd5.json`. It prints "1 pages (IB11-P3 V-D5 qualification)".
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW, P1 and P2 scripts**. Install and enable `IB11_P3_VD5.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start`. The viewer opens with an image. Keep hands off until the first yellow prompt.
4. **At each prompt, press exactly the keys shown, once:**
   - "Hold Ctrl and press F once": Chrome's Find bar may open. After "Recorded.", press Esc to close it.
   - "Hold Ctrl and press D once": nothing should appear (no bookmark dialog).
   - "Hold Alt and press O once".
   - "Press F once (no other key held)".
   - "Press D once (no other key held)".
   After each "Recorded." the page continues by itself after 5 seconds. Press Esc only to close a browser bar, menu or dialog.
5. **Return** `ib11-p3-vd5.json` when the page shows "P3 RECORDED". If a page shows INVALID, press F5 to retry.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p3 <ib11-p3-vd5.json>`. The verdict must be **V-D5 REPAIR QUALIFIED**.

**Limitation:** Meta is not exercised in real Chrome on Windows. It is the Windows key, and Win+D shows the desktop. Meta chords are covered by the local regression (P3-3).

---

# IB11-P4: V-D6a repair qualification (real Chrome; about 1 minute)

`IB11_P4_VD6A.user.js` (SHA-256 `8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2`) contains the **repaired** production (commit `fe1e06b`, blob `f232863`) unchanged, wrapped by the V-VIEW recorder and runner with **no runner patches**. The server's `--p4` mode serves the same TAKEOVER page used for the E-stage V-D6a evidence:
- the page stores remembered volume 1.5, so building the viewer's video throws `IndexSizeError` synchronously;
- one trusted ordinary click on the orange video card;
- the page records the failure seam, whether navigation was cancelled, and the viewer overlay right after the failure and at page exit;
- the native post page records its arrival.

The package qualifies only V-D6a. The V-VIEW, P1, P2 and P3 packages are unchanged.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p4.cjs --check`
- `node tests/browser/ib11/verify_ib11_p4.cjs --media <fixture folder>` (27/27)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p4 --out <fixture folder>/ib11-p4-vd6a.json`. It prints "1 pages (IB11-P4 V-D6a qualification)".
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW, P1, P2 and P3 scripts**. Install and enable `IB11_P4_VD6A.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start`. Keep hands off until the yellow prompt.
4. **At "Click the ORANGE-outlined video card once":** click it once. The page should change to "Native post page reached", then to the done page.
5. **Return** `ib11-p4-vd6a.json`. If a page shows INVALID, press F5 to retry.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p4 <ib11-p4-vd6a.json>`. The verdict must be **V-D6a REPAIR QUALIFIED**.

**Limitation:** the overlay is measured by the page, right after the click is dispatched and again at page exit. How long the old page stays visible before the next page commits is up to the browser.

---

# IB11-P5: V-D6b repair qualification (real Chrome; about 1 minute)

`IB11_P5_VD6B.user.js` (SHA-256 `2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b`) contains the **repaired** production (commit `24ee7c2`, blob `68e37d1`) unchanged, wrapped by the V-VIEW recorder and runner with declared runner-only patches (`p5_vd6b.js`; NATIVE_R can reuse the open viewer, as at P2). The P5 page:
1. opens an image card in the viewer and waits until it has loaded;
2. stores remembered volume 1.5, then asks for **one Right Arrow press**, which moves the viewer onto a video card whose media build throws `IndexSizeError`;
3. records the viewer 50 ms and 1000 ms later: the target, the stage, the failure text, the native link, the status, and any remaining media;
4. if the failure is shown with the target's native link, asks for one click on that link in the same viewer (the revision-1.3 NATIVE cell: hit test, target, navigation, destination arrival).

The stored volume is reset to 0.37 afterwards. The package qualifies only V-D6b. The V-VIEW and P1–P4 packages are unchanged.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p5.cjs --check`
- `node tests/browser/ib11/verify_ib11_p5.cjs --media <fixture folder>` (32/32)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p5 --out <fixture folder>/ib11-p5-vd6b.json`. It prints "1 pages (IB11-P5 V-D6b qualification)".
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW and P1–P4 scripts**. Install and enable `IB11_P5_VD6B.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start`. The viewer opens with an image. Keep hands off until the yellow prompt.
4. **At "Press the Right Arrow key once":** press → once, and nothing else. The viewer should show "Media failed to load" with an underlined "Open native post" text.
5. **At "Click the visible underlined "Open native post" text once":** click exactly on the underlined words, once. The page should change to "Native post page reached", then to the done page.
   - If instead the panel says no failure state with a native link was shown, nothing needs clicking; return the file.
6. **Return** `ib11-p5-vd6b.json`. If a page shows INVALID, press F5 to retry.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p5 <ib11-p5-vd6b.json>`. The verdict must be **V-D6b REPAIR QUALIFIED**.

---

# IB11-P6: V-D4 repair qualification (real Chrome; about 2 minutes)

`IB11_P6_VD4.user.js` (SHA-256 `77f233fe68de1a88b6807a7ddbb0fe646ff5ad07a40fc53189b0bf0aea381055`) contains the **repaired** production (commit `39a5ae1`, blob `0a7f57f`) unchanged, wrapped by the V-VIEW recorder and runner with declared runner-only patches (`p6_vd4.js`). The P6 page repeats the V-VIEW VD4 steps:
1. it opens the 2000×1000 fixture image in the viewer with Fit mode `fit-both` and measures the unrotated fit;
2. it presses the viewer's own "Rotate right" control;
3. it asks for **two real browser resizes** (F11 into full screen, then F11 out), measuring the stage and the rendered image after each;
4. it keeps the rotated viewer open and asks for **one screenshot** (Windows+PrtScn), confirmed with Enter.

The package qualifies only V-D4. The V-VIEW and P1–P5 packages are unchanged.

**Results path (from P6 on):** operator results go under `tests/results/`. That folder is git-ignored except for its README. The P6 server writes `tests/results/ib11-p6-vd4.json` by default.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p6.cjs --check`
- `node tests/browser/ib11/verify_ib11_p6.cjs --media <fixture folder>` (30/30)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p6`. It prints "1 pages (IB11-P6 V-D4 qualification)" and writes `tests/results/ib11-p6-vd4.json`.
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW and P1–P5 scripts**. Install and enable `IB11_P6_VD4.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start` in a normal (not full-screen, not maximised-to-full-screen) window. The viewer opens with the wide image and rotates it by itself. Keep hands off until the yellow prompt.
4. **At "Press F11 once":** press F11. Then, at **"Press F11 again"**, press F11 again.
5. **At "Press Windows+PrtScn once…":** press Windows+PrtScn once (Windows saves the whole screen to Pictures › Screenshots), then press Enter. **Do not click the page.**
6. **Return** `tests/results/ib11-p6-vd4.json`. Copy the screenshot to `tests/results/ib11-p6-vd4.png` and return it too. If a page shows INVALID, press F5 to retry.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p6 tests/results/ib11-p6-vd4.json`. The verdict must be **V-D4 REPAIR QUALIFIED**.

---

# IB11-P7: V-D7 repair qualification (real Chrome; automatic, about 30 seconds)

`IB11_P7_VD7.user.js` (SHA-256 `2fee6862a9f6c540cf8dcdfd8be5ecc19cfec5b0892bf8e10a38f31f7f6251ab`) contains the **corrected** repair (commit `7e4c643`, blob `5da8fd9`) unchanged, wrapped by the V-VIEW recorder and runner with declared runner-only patches (`p7_vd7.js`). This is the second P7 package. The first (`da6b9f88…`, production `b856a62`) produced the attempt-1 result `b28fbf3d…72d2`, which was NOT QUALIFIED.

The page runs by itself; there are no prompts.

**Fixture:** the page has three cards:
- VD7P, a quick 2000×1000 image;
- VD7, a slow 1600×800 original (about 9 s) whose placeholder is the 160×80 card thumbnail, already loaded by the page;
- VD7X, a slow original whose placeholder is an 800×400 image fetched by the viewer.

**What the page does:**
1. **P7STAGE:** it opens VD7P, then moves to VD7 with ArrowRight inside the viewer. It records the viewer at 300 ms and 1000 ms, and every animation frame until 500 ms after the original arrives.
2. **P7XFORM:** it opens VD7X and waits until the placeholder is painted at its fitted size. It then applies Rotate right, Flip horizontal, Flip vertical, Zoom in ×2 and a pan before the original arrives, and measures the same way.

**How the placeholder is measured:** by its real on-screen rectangle against the expected fitted size, never by `naturalWidth`. In Chrome, an image whose source is still loading reports a natural size of 0.

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p7.cjs --check`
- `node tests/browser/ib11/verify_ib11_p7.cjs --media <fixture folder>` (45/45)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p7`. It writes `tests/results/ib11-p7-vd7.json`.
   - **The first attempt's file is at that same path.** Move it aside first (for example, rename it to `tests/results/ib11-p7-vd7-attempt1.json`; its SHA-256 is recorded) so the new run does not overwrite it.
2. **Prepare Tampermonkey:** disable every other script, including the V-VIEW and P1–P6 scripts **and the first P7 script**. Install and enable this `IB11_P7_VD7.user.js`, replacing the first one.
3. **Open** `http://127.0.0.1:8797/vview/start` in a normal window. Keep the tab **in front and visible**: Chrome throttles animation frames in background tabs. Do not touch the page or resize the window.
4. **Wait** for "P7 RECORDED" (about 30 seconds). If a page shows INVALID, press F5 to retry.
5. **Return** `tests/results/ib11-p7-vd7.json`.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p7 tests/results/ib11-p7-vd7.json`. The verdict must be **V-D7 REPAIR QUALIFIED**.

---

# IB11-P8: focus ownership/return qualification (real Chrome; about 2 minutes)

`IB11_P8_Focus.user.js` (SHA-256 `9e938f4ffd2f4239ceeeabf5ad2b69da1e1343efaa439745c69a6c2da1b6d608`) contains the **repaired** production (commit `9d86484`, blob `8453be9`) unchanged, wrapped by the V-VIEW recorder and runner with declared runner-only patches (`p8_focus.js`).

**Fixture:** the page has three cards: a blue card (FOCUS_K, first in the page), a pink card (FOCUS_M), and a third card (page controls behind the overlay).

**What the page records:** every step records which element has focus, as a descriptor plus flags:
- the viewer's Close (✕) button;
- the first viewer control;
- the actual invoking card link;
- the page body.

It also records whether the viewer was open when the input arrived. All focus input is yours (trusted).

**Local qualification:**
- `node tests/browser/ib11/build_ib11_p8.cjs --check`
- `node tests/browser/ib11/verify_ib11_p8.cjs --media <fixture folder>` (34/34)

**Operator steps:**
1. **Start the server:** `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --p8`. It prints "1 pages (IB11-P8 focus qualification)" and writes `tests/results/ib11-p8-focus.json`.
2. **Prepare Tampermonkey:** disable every other script, **including the V-VIEW and P1–P7 scripts**. Install and enable `IB11_P8_Focus.user.js`.
3. **Open** `http://127.0.0.1:8797/vview/start` in a normal window. Keep hands off until the first yellow prompt.
4. **Mouse part:**
   - At **"Click the PINK-outlined card once"**, click the pink card.
   - At **"Press Tab once"**, press Tab.
   - At **"Hold Shift and press Tab once"**, press Shift+Tab.
   - At **"Press Escape once"**, press Escape.
5. **Keyboard part:**
   - At **"Press Tab until the BLUE-outlined card is focused, then press Enter"**, press Tab until the panel says the blue card is focused, then press Enter.
   - Then, at each prompt: **Shift+Tab**, **Tab**, **Tab** (the prompts start with "Keyboard check").
   - At **"Click the ✕ (Close) button"**, click the last toolbar button.
6. **Return** `tests/results/ib11-p8-focus.json` when the page shows "P8 RECORDED". If a page shows INVALID, press F5 to retry.

Press only the keys asked for, once each. The page does not need a screenshot.

**Evaluate:** `node tests/browser/ib11/vview_evaluate.cjs --p8 tests/results/ib11-p8-focus.json`. The verdict must be **P8 FOCUS QUALIFIED**.
