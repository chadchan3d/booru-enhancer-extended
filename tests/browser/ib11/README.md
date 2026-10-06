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

**Evaluate:** `node tests/browser/ib11/gplay_evaluate.cjs <ib11-gplay-results.json>` (revision 1.0). The raw results file is not committed; only its SHA-256 and the verdict are recorded.
