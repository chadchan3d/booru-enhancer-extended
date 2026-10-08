# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added. It is the controlling specification (AGENTS.md); where an instruction conflicts with it, the Blueprint wins.

## Current milestone
**IB11 — Existing viewer hardening: PARTIAL, NOT COMPLETE.**
- **E stage: complete for TC** (`IB11_BASELINE.md`).
  - G-PLAY(TC) E → PASS(scope).
  - V-VIEW browser evidence: 11/11 evidence PASS.
- **P scope: frozen** (owner decisions below).
- **P1 (V-D8): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §1–§2).
- **P2 (V-D1): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §3–§4).
- **P3 (V-D5): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §5–§6).
- **P4 (V-D6a): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §7–§8).
- **P5 (V-D6b): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §9–§10).
- **P6 (V-D4): PARTIAL, NOT COMPLETE** (`IB11_P_STAGE.md` §11):
  - production repair committed at `39a5ae1`;
  - local qualification PASS: regression 15/15 and P6 package verifier 30/30;
  - **real-Chrome qualification PENDING.**
- **All other P items: NOT STARTED.**

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
- **Branch:** `implementation/ib00-baseline`, pushed; equals `origin/implementation/ib00-baseline` after the P6 record commit.
- **Production `Booru_Enhancer.user.js`:**
  - commit `39a5ae126f573a04a10963287581b2c5704df890` (IB11-P6, V-D4);
  - blob `0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6`;
  - production body SHA-256 `d445d442a9e937186de4d99eea9a958252d9850dcba272a8b5448d364333b439`.
- **Previous production artifacts:**
  - `24ee7c2` / `68e37d1` / body `062227fa…9f26`: IB11-P5 (V-D6b; the P5 qualification artifact);
  - `fe1e06b` / `f232863` / body `4fd694e7…282b`: IB11-P4 (V-D6a; the P4 qualification artifact);
  - `48e44d9` / `f2b46eb` / body `c42b71db…5995`: IB11-P3 (V-D5; the P3 qualification artifact);
  - `bef4437` / `56c495e` / body `a6d7bcc1…4839`: IB11-P2 (V-D1; the P2 qualification artifact);
  - `9aeab36` / `039b99e` / body `35474709…c46b`: IB11-P1 (V-D8; the P1 qualification artifact);
  - `4d793a2` / `002bdfd` / body `00915584…e945`: IB10 artifact, and the artifact for all IB11 E-stage evidence;
  - `8324552` / `4258ad7`: IB10 P;
  - `b9d133c` / `22e843c`: IB09.
- **Other branches:** `main` is the untouched published baseline. `origin/implementation/ib01-harness` is a separate branch; its PR state is not verified here.
- **Raw evidence:** raw operator JSON is never committed (`.gitignore`); only SHA-256 values are recorded.
  - **Results path (owner convention, implemented at P6):** operator raw evidence (result JSON, screenshots) goes under `tests/results/`. Everything there is git-ignored except the tracked `tests/results/README.md`. `vview_server.cjs --p6` writes there by default. P1–P5 raw files stay where they were.

## Completed checkpoints (records in `docs/implementation/`)
- **IB00–IB03:** PASS. IB02 is a local prerequisite only; IB03 is scoped to measured TC (Tampermonkey × Chromium) primitives.
- **IB04, IB05, IB06:** complete for the active TC path. G-OWN, G-SETTINGS and G-REQUEST are PASS in TC.
  - IB04's viewer checks covered takeover ordering, modifier bypass, focus return and the failure link's presence (not its clickability; that is V-D8, now repaired).
- **IB07:** PASS(scope). G-HOST covers the Rule34, e621, e926 and Gelbooru rows as recorded.
- **IB08:** PASS(scope). G-RENDITION covers logged-out e621/e926 `/posts`, the two-source WebP/JPEG card.
- **IB09:** PASS(scope). G-HOVER covers the e621/e926 IB08-qualified still-image class.
- **IB10:** PASS(scope). G-VIDEO, as in the Current milestone.
  - Owner decisions: 200 ms dwell; the viewer ends the hover; original-file source; V3-R Option A; Blueprint enforcement of the poster/View fallback (option B).

## IB11 E stage: completion and provenance (`IB11_BASELINE.md`)
- **G-PLAY(TC): E → PASS(scope).** `gplay_evaluate.cjs` revision 1.1, 32/32.
  - Raw files: `13888dd9…0048` (original) and `ebd4f57c…5a90` (DELIB recovery).
  - Chrome 154 + Tampermonkey 5.5.0; controlled local MP4/WebM fixtures; no general autoplay claim.
  - Preferences are preserved, with no forced remute. autoplay=false stays idle. loop and remember-volume work. A deliberate unmute persists; the next target starts muted per the saved preference.
  - MP4 without activation: unmuted autoplay is blocked and `play()` is rejected with NotAllowedError; a trusted Space press is a working Play fallback.
  - The WebM no-activation path was not separately measured.
- **V-VIEW (TC): complete.** `vview_evaluate.cjs` revision 1.3, merged, exit 0, 11/11 evidence PASS.
  - **Raw files:**
    - full run `ff2fce48…1599` (9 MAIN cells);
    - recovery `a222632a…37e4` (NATIVE from NATIVE_R, VD6A from TAKEOVER);
    - G3 preflight `9e434c09…8f07` (COMPLETE).
  - **Findings:**
    - DEFECT_CONFIRMED: V-D7 (VD7), V-D6b (VD6B), V-D1 (VD1), V-D4 (VD4), V-D5 (VD5), V-D8 (NATIVE), V-D6a (VD6A);
    - G3 BEHAVIOR_OK (native-only single);
    - FOCUS_M and FOCUS_K OBSERVED (the viewer does not take focus; Tab reaches page controls behind the overlay);
    - VD5SYN control only.

## IB11 owner decisions and frozen P scope
- **Owner decisions:**
  - **V-D5 (E2):** viewer Ctrl/Meta/Alt chords must not trigger ordinary viewer commands (Ctrl+F not Favorite; Ctrl+D not viewer-Download). The repair is a narrow modifier guard that preserves unmodified keybinds and browser shortcuts.
  - **Focus (P1):** the viewer owns focus while open. Tab and Shift+Tab stay within viewer-owned interactive elements. Close restores focus to the invoking element when it still exists.
  - **V-D4 (P1):** the rotated-Fit correction belongs in IB11 P.
  - **Placeholder → full-image replacement (P1):** preserve the apparent on-screen view, not the raw numeric scale, and do not automatically refit.
  - **A4, C4, E6, G4 (P1):** unchanged.
- **Frozen IB11 P scope:**
  - V-D1, V-D4, V-D5, V-D6a, V-D6b, V-D7, V-D8, and the approved focus ownership/return behavior.
  - Same-ID generation guarding is permitted only as the supporting mechanism for V-D1.
  - One item per assignment; each needs its own regression, fault control and qualification.

## IB11 P stage: status (`IB11_P_STAGE.md`)

| Item | Status |
| --- | --- |
| **P1 — V-D8** (native recovery link usable) | **COMPLETE, PASS(scope) in TC** |
| **P2 — V-D1** (durable failure state across late same-post updates) | **COMPLETE, PASS(scope) in TC** |
| **P6 — V-D4** (rotated Fit valid across resize) | **PARTIAL**: repair `39a5ae1` locally qualified; real-Chrome qualification pending |
| **P3 — V-D5** (narrow viewer-key modifier guard) | **COMPLETE, PASS(scope) in TC** |
| **P4 — V-D6a** (safe takeover on a synchronous build failure) | **COMPLETE, PASS(scope) in TC** |
| **P5 — V-D6b** (communicated in-viewer build failure) | **COMPLETE, PASS(scope) in TC** |
| V-D7 (staged placeholder; preserve apparent view on replacement) | NOT STARTED |
| Focus ownership/return | NOT STARTED |

**P1 detail:**
- **Change** (`9aeab36`, `Booru_Enhancer.user.js:3595`): the fallback anchor declares `pointer-events:auto`; `.be-media-state` keeps `none`.
- **Regression:** `tests/host/ib11/p1_native_link.cjs` 6/6. The V-D8 checks fail on `4d793a2` and on a mutant restoring `pointer-events: none`.
- **Package verifier:** `verify_ib11_p1.cjs` 23/23; package `5842a1da…e718`.
- **Regressions on `9aeab36`:**
  - IB01–IB10 pass (IB07 blob pins only);
  - IB11 E0 characterization 37/38, the G-PLAY verifier 36/37 and the V-VIEW verifier 65/66, each failing only its superseded `4d793a2` pin;
  - G-PLAY recovery 28/28; V-VIEW recovery 32/32.
- **Real-Chrome qualification:** raw `ib11-p1-native.json` SHA-256 `5b23289a6a73776378466881578ce7644905484f19a6e9f854705e14c6fb0bb8` (not committed). `vview_evaluate.cjs --p1`: revision 1.3, exit 0, **V-D8 REPAIR QUALIFIED**.
  - STAGECLOSE PASS / BEHAVIOR_OK: a trusted empty-stage click closes the viewer.
  - NATIVE PASS / BEHAVIOR_OK: link `pointer-events` auto, container none; the hit test and a trusted click land on the anchor; not prevented; the viewer is not closed; navigation; destination reached.

**P2 detail:**
- **Change** (`bef4437`, `updatePost` only): the unconditional `clearMediaState()` is removed and called only in the branch that starts a new load (a URL change). `replaceMedia` paths are unchanged.
- **No generation guard:** the only `updatePost` caller (the open-time enrichment) delivers the cached/in-flight post, so stale same-post updates carry unchanged data.
- **Regression:** `tests/host/ib11/p2_vd1_failure_durable.cjs` 11/11. The V-D1 checks fail on `9aeab36` and on a mutant restoring the unconditional clear; current-work and preservation checks hold everywhere.
- **Package verifier:** `verify_ib11_p2.cjs` 23/23; package `d38963eb…f07a`.
- **Regressions on `bef4437`:**
  - IB01–IB10 pass (IB07 blob pins only);
  - P1 regression 6/6;
  - G-PLAY 36/37, V-VIEW 65/66 and P1 verifier 22/23, each failing only its superseded working-tree pin;
  - E0 characterization 36/38 and fault controls 45/46: S0 pin plus the C3 V-D1 witness, now repaired;
  - G-PLAY recovery 28/28; V-VIEW recovery 32/32.
- **Real-Chrome qualification:** raw `ib11-p2-vd1.json` SHA-256 `d50158234cdf224b3ba8514988c38dc075a80749c80930eab942aeb20748aece` (not committed). `vview_evaluate.cjs --p2`: revision 1.3, exit 0, **V-D1 REPAIR QUALIFIED**.
  - VD1P2 PASS / BEHAVIOR_OK: a real failure; after the late same-post update (`viewer.updatePost` with the cached post) "Media failed to load" and the native link remain at 0 ms and 500 ms; same media and same link node.
  - NATIVE PASS / BEHAVIOR_OK on the same viewer (V-D8 preserved): link `pointer-events` auto, container none; the hit test and a trusted click land on the anchor; not prevented; the viewer is not closed; navigation; destination reached.

**P3 detail:**
- **Change** (`48e44d9`, `onKeydown` only): `if (e.ctrlKey || e.metaKey || e.altKey) return;` before the binding lookup. A chord runs no viewer command and is not prevented. Bindings, Shift behavior and the command implementations are unchanged.
- **Regression:** `tests/host/ib11/p3_vd5_modifier_guard.cjs` 16/16.
  - The V-D5 checks (Ctrl+F, Ctrl+D, Meta, Alt, modified navigation/close, a custom binding) fail on `bef4437` and on a mutant without the guard.
  - The preservation checks hold everywhere: unmodified f/d/o, arrows/Escape, Space play, Shift, closed-state inertness, V-D1, V-D8, no focus change.
- **Package verifier:** `verify_ib11_p3.cjs` 32/32; package `d29d590b…f0d6`.
- **Regressions on `48e44d9`:**
  - IB01–IB10 pass (IB07 blob pins only);
  - P1 regression 6/6; P2 regression 11/11;
  - G-PLAY 36/37, V-VIEW 65/66, P1 verifier 22/23 and P2 verifier 22/23, each failing only its superseded working-tree pin;
  - E0 characterization 35/38 and fault controls 43/46: S0 pin, C3 (V-D1 witness), **G2 (the V-D5 witness, now repaired: expected)**, and the G5 control anchor (re-anchored once: caught);
  - G-PLAY recovery 28/28; V-VIEW recovery 32/32.
- **Real-Chrome qualification:** raw `ib11-p3-vd5.json` SHA-256 `6bdf64b04998703e247fc05d35832d832e73e87a95b786f00c33748c0fa45436` (not committed). `vview_evaluate.cjs --p3`: revision 1.3, exit 0, **V-D5 REPAIR QUALIFIED**.
  - VD5 PASS / BEHAVIOR_OK: trusted Ctrl+F and Ctrl+D run no Favorite/Download/Open, are not viewer-prevented, and the viewer stays open.
  - P3KEYS PASS / BEHAVIOR_OK: trusted Alt+O runs no command and is not prevented; trusted unmodified F runs Favorite once and D runs Download once, both prevented.
  - No trusted input outside the prompts; no client error.
  - Limitations: Ctrl+D's bookmark default was suppressed by the runner after the viewer's decision was measured, so no bookmark was made. Meta is covered locally only (Windows key).

**P4 detail:**
- **Change** (`fe1e06b`, `onGalleryClick` only): record `wasOpen` before the takeover attempt; in the existing "takeover failed before open" catch, call the existing `viewer.close()` if the viewer was not open before. Navigation is still not cancelled. Successful takeover, the bypass rules and in-viewer navigation (V-D6b) are unchanged.
- **Root cause:** `viewer.open` displays the overlay (`:3725`) before `buildMedia` can throw (stored volume 1.5 → `IndexSizeError`); the catch (`:4344`) did not undo it.
- **Regression:** `tests/host/ib11/p4_vd6a_takeover_safe.cjs` 15/15.
  - The V-D6a checks (no overlay, no partial state, inert keys after the failed takeover) fail on `48e44d9` and on a mutant without the cleanup, with the production seam proven to throw.
  - The preservation checks hold everywhere: successful image and video takeover, all bypasses, `viewer.enabled = false`, retry after failure, V-D6b unchanged, V-D8, V-D1, V-D5, close/cleanup, playback, no focus change.
- **Package verifier:** `verify_ib11_p4.cjs` 27/27; package `8c9fd499…c7a2` (unpatched V-VIEW runner, TAKEOVER page).
- **Regressions on `fe1e06b`:**
  - IB01–IB10 pass (IB07 blob pins only);
  - P1 6/6, P2 11/11, P3 16/16;
  - G-PLAY 36/37, V-VIEW 65/66 and the P1/P2/P3 verifiers 22/23, 22/23 and 31/32, each failing only its superseded working-tree pin;
  - E0 characterization 34/38 and controls 43/46: S0 pin, C3 and G2 (repaired earlier), **A5 (the V-D6a witness, now repaired: expected)**, the G5 anchor; **A6 (V-D6b) still witnesses**;
  - G-PLAY recovery 28/28; V-VIEW recovery 32/32.
- **Real-Chrome qualification:** raw `ib11-p4-vd6a.json` SHA-256 `04e21ce5bcb977e584088785e11fd647e4325c15de8563b908921c489ce56b1c` (not committed). `vview_evaluate.cjs --p4`: revision 1.3, exit 0, **V-D6a REPAIR QUALIFIED**.
  - VD6A PASS / BEHAVIOR_OK: a trusted ordinary click; the `buildMedia` seam threw `IndexSizeError` (value 1.5); not prevented; the page navigated and the native destination recorded the arrival.
  - After the failed takeover: `open` false, overlay none, no current post, 0 stage children, no media, state or link; overlay none at page exit. No client error.
  - Preservation: successful takeover, bypasses, P1/P2/P3 and close/playback/focus unchanged (P4 regression and P1–P3 regressions).

**P5 detail:**
- **Change** (`24ee7c2`, `replaceMedia` and `open` only):
  - `replaceMedia` catches a `buildMedia` throw, drops the media reference and, inside an open viewer, shows the existing failure state with the target's native link.
  - `open` passes `rethrowBuildError` when the viewer was closed, so the P4 / V-D6a takeover path still rethrows and abandons.
- **Root cause:** the in-viewer `open` → `replaceMedia` path emptied the stage and then `buildMedia` threw (stored volume 1.5 → `IndexSizeError`). The exception escaped before any status or state, leaving a blank stage on the new target, a stale status and a stale media reference.
- **Regression:** `tests/host/ib11/p5_vd6b_inviewer_failure.cjs` 15/15.
  - The V-D6b checks fail on `fe1e06b` and on an always-rethrow mutant: failure text, the target's pointer-usable native link, coherence (no media, previous image detached, status), durability under a late update.
  - The preservation checks hold everywhere: operable after the failure, successful image and video navigation, P4/V-D6a, takeover and bypasses, V-D8, V-D1, V-D5, close, playback, focus.
- **Package verifier:** `verify_ib11_p5.cjs` 32/32; package `2f5495a4…299b` (trusted ArrowRight, then the revision-1.3 NATIVE cell on the same viewer).
- **Regressions on `24ee7c2`:**
  - IB01–IB10 pass (IB07 blob pins only);
  - P1 6/6, P2 11/11, P3 16/16, P4 15/15;
  - G-PLAY 36/37, V-VIEW 65/66 and the P1–P4 verifiers 22/23, 22/23, 31/32 and 26/27, each failing only its superseded working-tree pin;
  - E0 characterization 33/38 and controls 42/46: S0 pin, A5/C3/G2 (repaired earlier), **A6 (the V-D6b witness, now repaired: expected)**, and the A5-probe and G5 control anchors;
  - G-PLAY recovery 28/28; V-VIEW recovery 32/32.
- **Real-Chrome qualification:** raw `ib11-p5-vd6b.json` SHA-256 `341d4be9b334d9de5e153c18fb1122bc34b31e769b8405f538acee924ac931dc` (not committed). `vview_evaluate.cjs --p5`: revision 1.3, exit 0, **V-D6b REPAIR QUALIFIED**.
  - VD6BP5 PASS / BEHAVIOR_OK: a loaded image on 8001; a trusted unmodified ArrowRight; the `buildMedia` seam threw `IndexSizeError` (1.5); open on 8002 at 50 ms and 1000 ms with "Media failed to load" and the `card-post` link; no media in the overlay; previous image disconnected; status `#8002`; link `/posts/8002`.
  - NATIVE PASS / BEHAVIOR_OK on the same viewer: `pointer-events` auto; the hit test and a trusted click land on the anchor; not prevented; navigation; destination reached.
  - No client error or unrelated trusted input.
  - Preservation: successful takeover and navigation, P1–P4, close, playback and focus unchanged (P5 regression and P1–P4 regressions).

**P6 detail:**
- **Change** (`39a5ae1`, `configuredFitScale` only): at an odd quarter turn (same rule as `canPan()`) the intrinsic width and height are exchanged for the Fit geometry. The modes keep their meaning relative to the rendered orientation. E6 (the Fit button resets rotation), manual zoom/pan and the rotation controls are unchanged.
- **Root cause:** Fit divided the available stage by the unrotated size. The resize refit at 90° therefore scaled 2000×1000 by 0.488 (footprint 488×976 > 776 available) instead of 0.388.
- **Regression:** `tests/host/ib11/p6_vd4_rotated_fit.cjs` 15/15.
  - The V-D4 checks fail on `24ee7c2` and on a rotation-blind mutant: fit-both at 90/270/−90/−270, fit-width and fit-height at 90, two resizes, and a portrait image.
  - The preservation checks hold everywhere: 0° and 180° in all modes, original-size, initial fit, no refit on rotate, manual zoom/pan through a resize, flips, E6, open resets rotation.
- **Package verifier:** `verify_ib11_p6.cjs` 30/30; package `77f233fe…1055` (VD4 steps with two trusted resizes, then one operator screenshot).
- **Regressions on `39a5ae1`:**
  - IB01–IB10 pass (IB07 blob pins only);
  - P1–P5 regressions 6/6, 11/11, 16/16, 15/15, 15/15;
  - G-PLAY 36/37, V-VIEW 65/66 and the P1–P5 verifiers, each failing only its superseded working-tree pin;
  - E0 characterization 32/38 and controls 41/46: S0 pin; A5, A6, C3, G2 (repaired earlier); **E5 (the V-D4 witness, now repaired: expected; 0.388, rotated height 776)**; and the known control anchors plus E5's probe anchor;
  - G-PLAY recovery 28/28; V-VIEW recovery 32/32.
- **Real-Chrome qualification:** PENDING (`vview_server.cjs --p6` → `tests/results/ib11-p6-vd4.json`; `vview_evaluate.cjs --p6` must report **V-D4 REPAIR QUALIFIED**). The screenshot goes to `tests/results/ib11-p6-vd4.png`.

## Gates
- **G-PLAY(TC): PASS(scope)** (E stage), as above.
- **IB11 V-VIEW browser evidence (TC): complete.**
- **G-OWN(viewer), G-SETTINGS, G-HOST / G-REQUEST:** PASS for the active TC path.
- **G-VIDEO:** PASS(scope) for the two admitted hover classes in TC; OPEN elsewhere.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified (other)
- **IB11 local tooling:**
  - viewer characterization 38/38 on `4d793a2` (37/38 on `9aeab36`, S0 pin);
  - `verify_ib11_gplay` 37/37 and `verify_ib11_gplay_recovery` 28/28;
  - `verify_ib11_vview` 66/66 and `verify_ib11_vview_recovery` 32/32 (pinned to `4d793a2`).
- **IB10:** targeted PF live PASS (revision 1.2); live P 203/203 and controlled P 54/54 on `8324552`; E stage V3-C 54/54, V3-L 202/202, V3-R 16/16.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS.

## Unresolved, parked, deferred
- **Superseded attempts:** V-VIEW attempts 1 and 2 (packages `b7bd9ce9…` and `1662c903…`) stalled at G3 because of probe defects; none of their cells is used.
- **R8 pack text:** not in the repository (UNVERIFIED); the Blueprint's IB11 item 9 was used instead.
- **G-PLAY limitation:** the WebM no-activation and blocked-fallback paths are not separately measured.
- **IB10 limitations (non-blocking):**
  - unqualified video classes stay OPEN (fallback only);
  - the e926 MP4 ≥ 50 MB fallback is local-only;
  - no-store controlled runs;
  - the e926 20–50 MB band is thin;
  - TC only.
- **IB09 / IB08 limitations:** as recorded in their completion records.
- **Fixtures:** the IB10 fixtures are externally supplied and not tracked.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
- **Active: IB11-P6 (V-D4 only), operator step.**
  - Run the P6 real-Chrome qualification (`tests/browser/ib11/README.md`, "IB11-P6"; about 2 minutes; `vview_server.cjs --p6`; package `77f233fe…`).
  - Return `tests/results/ib11-p6-vd4.json` and the screenshot `tests/results/ib11-p6-vd4.png`.
  - It is evaluated with `vview_evaluate.cjs --p6`, which must report **V-D4 REPAIR QUALIFIED** before V-D4 is marked COMPLETE.
  - After P6 closes, the next eligible assignment is **one** remaining frozen item, chosen by the owner from: V-D7, focus ownership/return.
  - Each follows the P1 pattern: a minimal production change, a permanent regression that fails on the prior artifact, a fault control, regressions, and real-browser qualification where needed.
- **Forbidden:**
  - no batching of P items;
  - no scope beyond the frozen list (A4, C4, E6, G4 stay unchanged);
  - no IB12 or later checkpoint before IB11 is complete;
  - no production change without an assigned P item.
