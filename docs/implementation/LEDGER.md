# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB11 — Existing viewer hardening: PARTIAL, NOT COMPLETE (E stage complete for TC; P not started).**
- E0–E2: viewer characterization; G-PLAY tooling, run and recovery; **G-PLAY(TC): E → PASS(scope)**.
- E3: the V-VIEW probe, plus two G3 corrections (revisions 1.1 and 1.2) after probe defects in real Chrome. G3 preflight COMPLETE.
- **E4: V-VIEW browser evidence complete for TC.**
  - Sources: the full run (nine MAIN cells) plus the NATIVE + VD6A recovery, merged by evaluator revision 1.3.
  - Result: **11/11 evidence PASS** (`IB11_BASELINE.md` §14, §15).
  - **V-D8 confirmed.**
- **Next:** owner review of the remaining judgment items, then an explicit P-scope freeze. No P design or implementation yet; no production change.

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
- Production `Booru_Enhancer.user.js`: commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `00915584…e945`. Unchanged through IB11-E0 to E4.
- **Previous artifacts:**
  - `8324552` / `4258ad7`: IB10 P;
  - `b9d133c` / `22e843c`: IB09.
- `main` is the untouched published baseline. `origin/implementation/ib01-harness` exists as a separate branch; its PR state is not verified here.

## Completed checkpoints (records in `docs/implementation/`)
- **IB00–IB03:** PASS. IB02 is a local prerequisite only; IB03 is scoped to measured TC (Tampermonkey × Chromium) primitives.
- **IB04, IB05, IB06:** complete for the active TC path. G-OWN, G-SETTINGS and G-REQUEST are PASS in TC.
  - IB04 also covered the viewer's takeover ordering, modifier bypass, focus return and the failure link's presence.
  - Its P07 check did not test the link's clickability; see V-D8.
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
  - The repair is a narrow viewer-key modifier guard that preserves normal unmodified viewer keybinds and browser shortcuts.
  - This authorizes eventual P scope only.
- No other IB11 finding is decided (see "Owner decisions needed").

## Gates relevant to the next step
- **G-PLAY(TC): PASS(scope)** at the E stage. Chrome 154 + Tampermonkey 5.5.0; controlled local MP4/WebM fixtures only; no general autoplay claim.
  - Preferences are assigned exactly as saved, with no forced remute. autoplay=false stays idle. loop true/false work. Remember-volume works.
  - A deliberate unmute persists for the current media; the next target starts muted per the saved preference.
  - MP4 without activation: unmuted autoplay is blocked and the `updatePost` `play()` is rejected with NotAllowedError; a trusted Space press is a working Play fallback.
  - WebM no-activation was not separately measured (activation carried over).
  - Failure state with native link present, and close/stale cleanup, pass.
- **IB11 V-VIEW browser evidence (TC): complete,** 11/11 evidence PASS (evaluator revision 1.3).
- **G-OWN(viewer), G-SETTINGS, G-HOST / G-REQUEST:** PASS for the active TC path.
- **G-VIDEO:** PASS(scope) for the two admitted hover classes in TC; OPEN elsewhere.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **V-VIEW merged evaluation:** `vview_evaluate.cjs` revision 1.3; exit 0; evidencePass true; 11/11 PASS; no problems.
  - **Raw files** (not committed; unmodified):
    - original `ib11-vview-results.json` SHA-256 `ff2fce48…1599` (package `878a3cd3…`, revision 1.2): the source of VD7, VD6B, VD1, VD5SYN, VD4, VD5, G3, FOCUS_M, FOCUS_K;
    - recovery `ib11-vview-recovery.json` SHA-256 `a222632a…37e4` (package `598ba6c5…`, revision 1.3): NATIVE from NATIVE_R attempt 1, VD6A from TAKEOVER attempt 1;
    - G3 preflight `ib11-vview-g3-preflight.json` SHA-256 `9e434c09…8f07`: COMPLETE (separate provenance).
  - **Findings:**
    - DEFECT_CONFIRMED: VD7 (V-D7), VD6B (V-D6b), VD1 (V-D1), VD4 (V-D4), VD5 (V-D5), NATIVE (V-D8), VD6A (V-D6a);
    - G3 BEHAVIOR_OK (native-only single);
    - FOCUS_M and FOCUS_K OBSERVED;
    - VD5SYN control only.
- **G-PLAY merged evaluation:** `gplay_evaluate.cjs` revision 1.1; exit 0; 32/32 PASS. Raw files `13888dd9…0048` and `ebd4f57c…5a90` (not committed).
- **IB11 local tooling:**
  - viewer characterization 38/38 (46/46 fault controls);
  - `verify_ib11_gplay.cjs` 37/37; `verify_ib11_gplay_recovery.cjs` 28/28;
  - `verify_ib11_vview.cjs` 66/66; `verify_ib11_vview_recovery.cjs` 32/32.
- **IB10:** targeted PF live PASS (revision 1.2); live P 203/203 and controlled P 54/54 on `8324552`; E stage V3-C 54/54, V3-L 202/202, V3-R 16/16.
- **Regressions on `4d793a2`** (`IB10_P_STAGE.md` §8): IB01–IB10 suites pass, except the known pins.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS.

## IB11 E-stage classification (`IB11_BASELINE.md` §15)
- **A. Repairs already required by the Blueprint:**
  - V-D7: staged placeholder;
  - V-D1: durable failed state, with the same-ID generation guard (D4) as its supporting mechanism;
  - V-D6a / V-D6b: safe takeover and build-failure communication with a native link;
  - **V-D8:** a usable native link. Confirmed: the visible fallback inherits `pointer-events: none` (`:4916`, link at `:3591–3596`); a trusted in-box click hits `.be-viewer-stage` and closes the viewer (`:3417`); no navigation;
  - V-D4: valid Fit with rotation across resize (acceptance items 9/10), subject to a scope confirmation.
- **B. Owner decision made:** V-D5, the narrow modifier guard.
- **Resolved by evidence:** G3 (one native toggle; production not involved).

## Owner decisions needed before the IB11 P scope can be frozen
1. **Focus policy.** Today the viewer does not take focus on open, focus stays on the invoking link, Tab reaches page controls behind the overlay, and close "returns" focus only because it never left. The Blueprint requires focus return and stable focus for IB12, but does not dictate a modal-focus policy.
2. **V-D4 scope confirmation:** the fit-with-rotation correction in IB11 P (item 3 does not name fit computation explicitly).
3. **Manual zoom across a placeholder → better upgrade (D5/E4):** keep the absolute scale, keep the apparent size, or refit. This becomes material once V-D7 staging lands.
4. **Optional, defaulting to "leave unchanged":**
   - A4: the card "Open viewer" action ignores `viewer.enabled`;
   - C4: no native link for targets without `postUrl`;
   - E6: Fit also resets rotation/flip;
   - G4: no visible blocked-Play state (the native-control/Space fallback is evidenced).

## Unresolved, parked, deferred
- **Superseded attempts:** V-VIEW attempts 1 and 2 (packages `b7bd9ce9…` rev 1.0 and `1662c903…` rev 1.1) stalled at G3 because of probe defects; none of their cells is used.
- **G-PLAY limitation:** the WebM no-activation and blocked-fallback paths are not separately measured.
- **R8 pack text:** not in the repository (UNVERIFIED); the Blueprint's IB11 item 9 was used instead.
- **IB10 limitations (non-blocking):**
  - unqualified video classes stay OPEN (fallback only);
  - the e926 MP4 ≥ 50 MB fallback is local-only;
  - no-store controlled runs;
  - the e926 20–50 MB band is thin;
  - TC only.
- **IB09 / IB08 limitations:** as recorded in their completion records.
- **Fixtures and raw files:** the IB10 fixtures are externally supplied and not tracked; the G-PLAY and V-VIEW raw results are not tracked (`.gitignore`).
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**Owner review** of the decisions listed above, then an **explicit IB11 P-scope freeze**. No P design or implementation before that. Do not start IB12.
