# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB11 — Existing viewer hardening: PARTIAL, E stage.**
- E0: viewer characterization and G-PLAY tooling.
- E1: first G-PLAY run; evaluator revision 1.1; DELIB recovery tooling.
- E2: recovery ingested; **G-PLAY(TC): E → PASS(scope)**.
- **E3: the V-VIEW browser-evidence probe is built and locally qualified** (`IB11_BASELINE.md` §11).
- **E3 corrections (§12, §13):** two real V-VIEW attempts stalled at G3, both probe defects with no qualifying browser result.
  - Revision 1.1: Chrome's native controls hide pointer input; the native-control premise is now observed via media/focus consequences.
  - Revision 1.2: the focused native control also consumes Space; Space is now observed via its bounded media consequence plus the production-call trace, and a DOM key event is supplemental only.
  - **G3 preflight: COMPLETE** in real Chrome (SHA-256 `9e434c09…8f07`): native-only single toggle.
- **E4 (§14):** the full revision-1.2 run (`ff2fce48…1599`) gave evidence PASS for 9 MAIN cells, which are kept. NATIVE timed out because the visible fallback link is not clickable (`pointer-events: none` inherited; a likely product defect), and there is no TAKEOVER attempt.
  - A NATIVE + VD6A recovery (revision 1.3) is prepared, to be merged at evaluation time. The operator recovery run is pending.
- The keyboard, focus, native-link and visual V-D4/V-D6/V-D7 evidence stays OPEN until that run is evaluated.
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
- Production `Booru_Enhancer.user.js`: commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `00915584…e945`. Unchanged through IB11-E0 to E3.
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
  - A deliberate unmute persists for the current media; the next target starts muted per the saved preference.
  - MP4 without activation: unmuted autoplay is blocked and the `updatePost` `play()` is rejected with NotAllowedError; a trusted Space press is a working Play fallback.
  - WebM unmuted playback was measured with page activation already present (Chrome carried activation across the same-origin navigation), so the no-activation and fallback paths are evidenced for MP4 only.
  - Failure state with native link, and close/stale cleanup, pass.
- **G-OWN(viewer), G-SETTINGS, G-HOST / G-REQUEST:** PASS for the active TC path.
- **G-VIDEO:** PASS(scope) for the two admitted hover classes in TC; OPEN elsewhere.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB11-E3 V-VIEW tooling** (local; not browser evidence; revision 1.2 after two G3 corrections):
  - `verify_ib11_vview.cjs --media` **66/66**, covering:
    - static checks, including body byte-identity with `00915584…e945`;
    - server routes over real HTTP;
    - a jsdom simulator smoke: evidence PASS on all 11 cells, with the source-characterized findings;
    - G3 controls: the native-control premise; Space observed without a page-visible key; focus before and after; foreign JS calls; INCONCLUSIVE; no toggle; double toggle; production-handled versus native-only; the G3 preflight mode;
    - the other evidence/evaluator and package faults;
    - 6 repair probes, each flipping its defect finding.
  - `verify_ib11_vview_recovery.cjs --media` **32/32**: the merge with per-cell sources and provenance; NATIVE characterizes both a broken link (DEFECT_CONFIRMED, evidence PASS) and a working one (BEHAVIOR_OK); outside-box, untrusted, invisible, hit-test mismatch, missing pointer-events evidence, arrival without the click; duplicate / unauthorized / mismatched / ambiguous recovery rejected.
  - Package SHA-256 `598ba6c5…b06a` (supersedes `878a3cd3…`, which produced the full run's MAIN evidence); evaluator revision 1.3.
- **IB11 V-VIEW real-Chrome evidence (preserved; original raw `ff2fce48…1599`, not committed):**
  - VD7, VD6B, VD1, VD4 and VD5 DEFECT_CONFIRMED;
  - G3 BEHAVIOR_OK (native-only single);
  - FOCUS_M and FOCUS_K OBSERVED (the viewer does not take focus; focus stays on the invoker; Tab moves behind the overlay);
  - VD5SYN control only;
  - all 9 evidence PASS.
- **G-PLAY merged evaluation** (`gplay_evaluate.cjs` revision 1.1; exit 0; 32/32 PASS):
  - original raw `ib11-gplay-results.json` SHA-256 `13888dd9…0048`;
  - recovery raw `ib11-gplay-recovery.json` SHA-256 `ebd4f57c…5a90`;
  - the raw files are not committed.
- **IB11 local tooling:**
  - viewer characterization 38/38 (46/46 fault controls);
  - `verify_ib11_gplay.cjs` 37/37;
  - `verify_ib11_gplay_recovery.cjs` 28/28.
- **IB10:** targeted PF live PASS (revision 1.2); live P 203/203 and controlled P 54/54 on `8324552`; E stage V3-C 54/54, V3-L 202/202, V3-R 16/16.
- **Regressions on `4d793a2`** (`IB10_P_STAGE.md` §8): IB01–IB10 suites pass, except the known pins.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS.

## Unresolved, parked, deferred
- **V-VIEW attempts 1 and 2 (packages `b7bd9ce9…` rev 1.0 and `1662c903…` rev 1.1):** both stalled at G3. They were probe defects (Chrome's native controls hide first the pointer input, then Space, from the page); neither has a qualifying result, and none of their cells is used.
- **Likely new product defect (V-D8, pending recovery evidence):** the viewer's "Open native post" fallback is visible but not clickable.
  - `.be-media-state { pointer-events: none }` (`:4916`) is inherited by the link (`:3591–3596`).
  - A click falls through to the stage, which closes the viewer (`:3417`).
  - IB04 P07 only checked that the link exists and has the right href.
- **Focus policy (owner judgment, not a P decision):** the viewer does not take focus on open, and Tab reaches page controls behind the overlay; focus return works only because focus never leaves the invoker.
- **IB11 open browser evidence:** NATIVE (a real click on the visible fallback link) and VD6A (a real takeover failure through to navigation), both by the prepared recovery. All other V-VIEW cells have real-Chrome evidence.
- **IB11 observed defects (E0; not fixed):**
  - V-D1: a late same-ID update erases the failure state and native link;
  - V-D4: fit ignores rotation;
  - V-D5: modifier chords (owner: fix in IB11);
  - V-D6a/b: a synchronous build failure leaves the overlay shown, or a blank viewer;
  - V-D7: no staged image placeholder.
- **IB11 findings needing owner judgment:** `IB11_BASELINE.md` §4. The R8 pack text is not in the repository (UNVERIFIED).
- **G-PLAY limitation:** the WebM no-activation and blocked-fallback paths are not separately measured.
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
**Active: IB11, E stage.** The operator runs the **V-VIEW recovery (NATIVE + VD6A only)** (`tests/browser/ib11/README.md`, "V-VIEW recovery"; about 1 minute; `vview_server.cjs --recovery`; package `598ba6c5…`) and returns `ib11-vview-recovery.json`. It is evaluated with `vview_evaluate.cjs <ib11-vview-results.json> --recovery <ib11-vview-recovery.json> --g3-preflight-ref <ib11-vview-g3-preflight.json>` (revision 1.3). After that, review the complete findings and obtain owner decisions; the P scope is not frozen yet. No IB11 P change before that evidence is in and the P repair scope is frozen. Do not start IB12.
