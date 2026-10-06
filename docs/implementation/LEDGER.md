# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB11 — Existing viewer hardening: PARTIAL, E stage.**
- E0: viewer characterization and G-PLAY tooling.
- E1: first G-PLAY run; evaluator revision 1.1; DELIB recovery tooling.
- E2: recovery ingested.
- **G-PLAY(TC): E → PASS(scope)** (`IB11_BASELINE.md` §10).
- The remaining IB11 browser evidence (keyboard, focus, native link, visual V-D4/V-D6/V-D7) is OPEN.
- No production change and no P work.

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
- Production `Booru_Enhancer.user.js`: commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `00915584…e945`. Unchanged through IB11-E0, E1 and E2.
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

## Owner decisions in force for IB11
- **V-D5 belongs in IB11 (recorded at IB11-E2).**
  - Viewer Ctrl/Meta/Alt chords must not trigger ordinary viewer commands. In particular, Ctrl+F must not invoke Favorite and Ctrl+D must not invoke the viewer download.
  - The eventual repair is a narrow viewer-key modifier guard that preserves normal unmodified viewer keybinds and browser shortcuts.
  - This authorizes eventual P scope only; no production edit yet.
- No other `IB11_BASELINE.md` §4 finding is decided.

## Gates relevant to the next step
- **G-PLAY(TC): PASS(scope)** at the E stage. Chrome 154 + Tampermonkey 5.5.0; controlled local MP4/WebM fixtures only; no general autoplay claim.
  - Preferences are assigned exactly as saved, with no forced remute. autoplay=false stays idle. loop true/false work. Remember-volume works.
  - A deliberate unmute persists for the current media, and the next target starts muted per the saved preference at the remembered volume.
  - MP4 without activation: unmuted autoplay is blocked and the metadata-update `play()` is rejected with NotAllowedError. A trusted Space press is a working Play fallback.
  - WebM unmuted autoplay and its `updatePost` `play()` resolved, but **with page activation already present.** Chrome carried activation across the same-origin navigation, so no-activation behavior and the fallback are evidenced for MP4 only.
  - Failure state with native link, and close/stale cleanup, pass.
- **G-OWN(viewer), G-SETTINGS, G-HOST / G-REQUEST:** PASS for the active TC path.
- **G-VIDEO:** PASS(scope) for the two admitted hover classes in TC; OPEN elsewhere.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **G-PLAY merged evaluation** (`gplay_evaluate.cjs` revision 1.1; exit 0; 32/32 PASS; complete; no page failures; no merge problems):
  - original run (30 cells): raw `ib11-gplay-results.json`, SHA-256 `13888dd9…0048`;
  - DELIB recovery (2 cells): raw `ib11-gplay-recovery.json`, SHA-256 `ebd4f57c…5a90`;
  - replaced exactly U-mp4-DELIB and U-webm-DELIB (FAIL → PASS, attempt 1);
  - the raw files are not committed and were not modified.
- **First-run history:** revision 1.0 gave 28/4. The LOOPF failures were an evaluator defect (cleanup reset read as a loop wrap), corrected in 1.1. The DELIB failures were a prompt timeout, recovered at E2.
- **IB11 local tooling:**
  - viewer characterization 38/38 (46/46 fault controls);
  - `verify_ib11_gplay.cjs` 37/37;
  - `verify_ib11_gplay_recovery.cjs` 28/28.
- **IB10:** targeted PF live PASS (revision 1.2); live P 203/203 and controlled P 54/54 on `8324552`; E stage V3-C 54/54, V3-L 202/202, V3-R 16/16.
- **Regressions on `4d793a2`** (`IB10_P_STAGE.md` §8): IB01–IB10 suites pass, except the known pins.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS.

## Unresolved, parked, deferred
- **IB11 open browser evidence (must be resolved before freezing P scope):**
  - keyboard: Space with the native control focused (G3); real modifier chords;
  - focus: mouse and keyboard origins, open/Escape/✕ return;
  - native link: a real click after a real failure;
  - visual: V-D4 (rotated fit), V-D6a/b, V-D7.
  - The next probe "V-VIEW" is specified in `IB11_BASELINE.md` §10 but not yet built: about 5 automated cells and about 6 operator actions (~3 minutes).
- **IB11 observed defects (E0; not fixed):**
  - V-D1: a late same-ID update erases the failure state and native link;
  - V-D4: fit ignores rotation;
  - V-D5: modifier chords (owner: fix in IB11);
  - V-D6a/b: a synchronous build failure leaves the overlay shown, or a blank viewer;
  - V-D7: no staged image placeholder.
- **IB11 findings needing owner judgment:** `IB11_BASELINE.md` §4. The R8 pack text is not in the repository (UNVERIFIED).
- **G-PLAY limitation:** the WebM no-activation and blocked-fallback paths are not separately measured (activation carried over).
- **IB10 limitations (non-blocking):**
  - unqualified video classes stay OPEN (fallback only);
  - the e926 MP4 ≥ 50 MB fallback is local-only;
  - no-store controlled runs;
  - the e926 20–50 MB band is thin;
  - TC only.
- **IB09 / IB08 limitations:** as recorded in their completion records.
- **Fixtures and raw files:** the IB10 fixtures are externally supplied and not tracked; the G-PLAY raw results are not tracked (`.gitignore`).
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**Active: IB11, E stage.** Build and locally qualify the V-VIEW browser probe (`IB11_BASELINE.md` §10). Then the operator runs it (about 3 minutes). No IB11 P change until that evidence is in and the P repair scope is frozen. Do not start IB12.
