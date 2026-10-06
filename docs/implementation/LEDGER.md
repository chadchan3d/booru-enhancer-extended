# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB11 — Existing viewer hardening: PARTIAL, E stage; evidence OPEN.**
- **E0** characterized the viewer and prepared G-PLAY tooling (`IB11_BASELINE.md` §1–§8).
- **E1** recorded the first controlled G-PLAY browser run, corrected the evaluator (revision 1.1) and prepared a targeted recovery of the two DELIB cells (§9).
- **G-PLAY: OPEN (PARTIAL),** 30/32 cells PASS. There is no production change and no P work.

**IB10 — Muted hover-video lifecycle: COMPLETE, PASS(scope)** at `4d793a2` (`IB10_COMPLETION_RECORD.md`).
- **Automatic-video scope:**
  - TC only;
  - logged-out native `/posts`;
  - e621 WebM ≤ 100,000,000 B and e926 MP4 < 50,000,000 B;
  - a numeric `data-size` and a same-container `data-file-url`;
  - original-file source.
- **All other recognized video classes:** poster/View fallback; their G-VIDEO stays OPEN.

**IB12 is not started.**

## Current state
- Branch `implementation/ib00-baseline`, pushed to `origin/implementation/ib00-baseline`.
- Production `Booru_Enhancer.user.js`: commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `00915584…e945`. Unchanged by IB11-E0 and E1.
- **Previous artifacts:**
  - `8324552` / `4258ad7`: IB10 P;
  - `b9d133c` / `22e843c`: IB09.
- `main` is the untouched published baseline. `origin/implementation/ib01-harness` exists as a separate branch; its PR state is not verified here.

## Completed checkpoints (records in `docs/implementation/`)
- **IB00–IB03:** PASS. IB02 is a local prerequisite only; IB03 is scoped to measured TC (Tampermonkey × Chromium) primitives.
- **IB04, IB05, IB06:** complete for the active TC path. G-OWN, G-SETTINGS and G-REQUEST are PASS in TC. IB04 also covered the viewer's takeover ordering, modifier bypass, focus return and failure link in TC.
- **IB07:** PASS(scope). G-HOST covers the Rule34, e621, e926 and Gelbooru rows as recorded.
- **IB08:** PASS(scope). G-RENDITION covers logged-out e621/e926 `/posts`, the two-source WebP/JPEG card.
- **IB09:** PASS(scope). G-HOVER covers the e621/e926 IB08-qualified still-image class.
- **IB10:** PASS(scope). G-VIDEO, as in the Current milestone.
  - Owner decisions:
    - 200 ms dwell;
    - the viewer ends the hover;
    - original-file source;
    - V3-R Option A;
    - Blueprint enforcement of the poster/View fallback (option B).

## Gates relevant to the next step
- **G-PLAY(TC): OPEN (PARTIAL).**
  - First controlled run: 30/32 cells PASS under evaluator revision 1.1.
  - E → PASS requires both targeted DELIB recovery cells to pass and the merged evaluation to pass.
  - Blueprint IB11 item 6: no playback-policy wiring before then.
- **G-OWN(viewer), G-SETTINGS, G-HOST / G-REQUEST:** PASS for the active TC path (prerequisites met).
- **G-VIDEO:** PASS(scope) for the two admitted hover classes in TC; OPEN elsewhere.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB11 first controlled G-PLAY run** (TC: Chrome 154 + Tampermonkey 5.5.0; raw `ib11-gplay-results.json` SHA-256 `13888dd9…0048`; not committed; never modified):
  - All 4 pages identity MATCH, complete.
  - Revision 1.0: 28 PASS / 4 FAIL (both LOOPF, both DELIB).
  - Revision 1.1: **30 PASS / 2 FAIL** (both DELIB).
- **The LOOPF failures were an evaluator defect.** Revision 1.0 read the `currentTime` reset caused by production's close cleanup (removeSrc + `load()` → abort/emptied, time 0, 1 ms after Escape) as a loop wrap; the genuine `ended` came before close in both cells. Revision 1.1 judges LOOP only before the close/reset boundary.
- **The DELIB failures are missing operator evidence,** not a product result: the prompt timed out after 120 s, untrusted, with no click.
- **Real-Chrome observations (cells PASS):**
  - autoplay=false → IDLE, no production `play()`;
  - mute/loop/volume preferences assigned exactly, with no forced remute;
  - loop=true wraps and loop=false ends;
  - remember-volume on/off;
  - MP4 arm N: unmuted autoplay BLOCKED and the `updatePost` `play()` rejected with NotAllowedError; the trusted-Space retry resolved and played;
  - WebM `updatePost` `play()` resolved;
  - failure state with a native link;
  - close (pending and playing) and stale-target cleanup.
- **IB11-E1 tooling** (local):
  - `verify_ib11_gplay.cjs` 37/37, including the 1.0-vs-1.1 LOOP comparison and 7 LOOP controls;
  - `verify_ib11_gplay_recovery.cjs` 28/28, covering recovery package immutability, the server recovery protocol, the merge with provenance, and timeout/INVALID and rejection faults;
  - recovery package SHA-256 `199cbb19…fb58`; evidence package unchanged at `3c613d11…078a`.
- **IB11-E0:** viewer characterization 38/38 (46/46 fault controls).
- **IB10:** targeted PF live PASS (revision 1.2); live P 203/203 and controlled P 54/54 on `8324552`; E stage V3-C 54/54, V3-L 202/202, V3-R 16/16.
- **Regressions on `4d793a2`** (`IB10_P_STAGE.md` §8): IB01–IB10 suites pass, except the known pins.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS.

## Unresolved, parked, deferred
- **IB11 open evidence:**
  - the targeted DELIB recovery (operator; `tests/browser/ib11/README.md`, "Targeted DELIB recovery");
  - the separate keyboard/focus/native-link/visual browser checks (not yet packaged);
  - the R8 pack text, which is not in the repository (UNVERIFIED).
- **IB11 observed defects (E0; not fixed; P scope not decided):**
  - V-D1: a late same-ID update erases the failure state and native link;
  - V-D4: fit ignores rotation;
  - V-D5: viewer keys act on Ctrl/Meta/Alt chords (owner decision);
  - V-D6a/b: a synchronous build failure leaves the overlay shown, or a blank viewer;
  - V-D7: no staged image placeholder.
- **IB11 findings needing owner judgment or browser evidence:** `IB11_BASELINE.md` §4.
- **IB10 limitations (non-blocking):**
  - unqualified video classes stay OPEN (fallback only);
  - the e926 MP4 ≥ 50 MB fallback is local-only;
  - no-store controlled runs;
  - the e926 20–50 MB band is thin;
  - TC only.
- **IB09 / IB08 limitations:** as recorded in their completion records.
- **Fixtures and raw files:**
  - the IB10 fixtures are externally supplied and not tracked; the IB11 G-PLAY server reuses them;
  - the G-PLAY raw results are not tracked (`.gitignore`).
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**Active: IB11, E stage.** The operator runs the targeted DELIB recovery (`gplay_server.cjs --recovery`, `IB11_GPLAY_Recovery.user.js`; U-mp4-DELIB and U-webm-DELIB only) and returns `ib11-gplay-recovery.json`. It is evaluated together with the original: `gplay_evaluate.cjs <ib11-gplay-results.json> --recovery <ib11-gplay-recovery.json>` (revision 1.1). G-PLAY stays OPEN until that merged evaluation passes. No IB11 P change; do not start IB12.
