# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB11 — Existing viewer hardening: PARTIAL, E stage; evidence OPEN.** Step E0 is done: the existing viewer is characterized and the G-PLAY evidence tooling is prepared (`IB11_BASELINE.md`). There is no production change and no P work. **G-PLAY is OPEN.** The next step is the operator's controlled G-PLAY run.

**IB10 — Muted hover-video lifecycle: COMPLETE, PASS(scope)** at `4d793a2` (`IB10_COMPLETION_RECORD.md`; history: closed at `8a4d6d8`, reopened at `2ee86be`, corrected in `4d793a2`, closed).
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
- Production `Booru_Enhancer.user.js`: commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `00915584…e945`. Unchanged by IB11-E0.
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
- **G-PLAY(TC): OPEN.** Blueprint IB11 item 6: E → PASS is required before any playback-policy wiring. No controlled or browser playback evidence has run. The jsdom simulator smoke qualifies the tooling only.
- **G-OWN(viewer), G-SETTINGS, G-HOST / G-REQUEST:** PASS for the active TC path (prerequisites met).
- **G-VIDEO:** PASS(scope) for the two admitted hover classes in TC; OPEN elsewhere.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB11-E0, local on `4d793a2`:**
  - **Viewer characterization:** `tests/host/ib11/viewer_baseline.cjs`, 38/38 checks, 46/46 fault controls caught (witnesses use repair probes, which are not fixes).
  - **G-PLAY package and evaluator:** `tests/browser/ib11/verify_ib11_gplay.cjs` 28/28. This covers:
    - a jsdom simulator smoke of all 4 pages;
    - 9 production-mutant faults caught by their named criteria;
    - 9 evidence/evaluator faults.
  - The package SHA-256 is `3c613d11…f078a`.
- **IB10 targeted PF live conformance on `4d793a2`: PASS** (revision 1.2). Raw SHA-256:
  - e621 positive `655e83ca…c922`;
  - e621 negative `786e296e…6c71`;
  - e926 positive `149c10ba…0061`;
  - e926 negative `489ee7d0…faa8`.
- **IB10 earlier evidence:**
  - live P 203/203 and controlled P 54/54 on `8324552`;
  - E stage V3-C 54/54, V3-L 202/202, V3-R 16/16.
- **Regressions on `4d793a2`** (`IB10_P_STAGE.md` §8): IB01–IB10 suites pass, except the known blob/working-tree pins.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS.

## Unresolved, parked, deferred
- **IB11 observed defects (E0; not fixed; P scope not yet decided):**
  - V-D1: a late same-ID metadata update erases the failure state and native link.
  - V-D4: fit ignores rotation.
  - V-D5: viewer keys act on Ctrl/Meta/Alt chords (Ctrl+F toggles Favorite). Owner decision on the checkpoint.
  - V-D6a/b: a synchronous build failure leaves the overlay shown, or a blank viewer.
  - V-D7: no staged image placeholder; the original loads directly with no loading state.
- **IB11 findings needing owner judgment or browser evidence:**
  - the action button bypasses `viewer.enabled`;
  - no native link without `postUrl`;
  - no same-ID generation guard;
  - manual zoom is absolute across replacement / reset on a type change;
  - Fit resets rotation;
  - no dialog focus semantics;
  - Space versus native controls;
  - no blocked-Play state.
- **IB11 evidence still required:**
  - the G-PLAY(TC) controlled run (operator);
  - the separate keyboard/focus/native-link/visual browser checks (not yet packaged).
  - The R8 playback pack text is not in the repository (UNVERIFIED); the Blueprint's IB11 item 9 is used instead.
- **IB10 limitations (non-blocking):**
  - unqualified video classes stay OPEN (fallback only);
  - the e926 MP4 ≥ 50 MB fallback is local-only;
  - no-store controlled runs;
  - the e926 20–50 MB band is thin;
  - TC only.
- **IB09 / IB08 limitations:** as recorded in their completion records.
- **IB10 fixtures:** externally supplied and not tracked; the IB11 G-PLAY server reuses them. They were committed once in `0a43e73` and removed in `1820c18`.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**Active: IB11, E stage.** The operator runs the G-PLAY controlled probe (`tests/browser/ib11/README.md`) and returns `ib11-gplay-results.json` for evaluation with `gplay_evaluate.cjs` (revision 1.0). No IB11 P change before G-PLAY E passes and the P scope is decided. Do not start IB12.
