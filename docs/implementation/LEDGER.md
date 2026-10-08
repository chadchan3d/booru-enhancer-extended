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
- **P6 (V-D4): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §11–§12).
- **P7 (V-D7): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §13–§15): attempt 1 NOT QUALIFIED (retained); corrected repair `7e4c643` qualified by attempt 2.
- **P8 (focus ownership/return): COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §16–§17).
- **All frozen P items (P1–P8) are complete.** IB11 final closeout is not started.

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
- **Branch:** `implementation/ib00-baseline`, pushed; equals `origin/implementation/ib00-baseline` after the P8 closure commit (documentation only).
- **Production `Booru_Enhancer.user.js`:**
  - commit `9d864845d482f74cc565cf0c6b4ff92ccef7a047` (IB11-P8, focus ownership/return);
  - blob `8453be9447820978b7d4a2886ea9ae2bf4e87c10`;
  - production body SHA-256 `7745efafde2013fa98329c0ff6c9dd9d94995098129b763b05b7abdccd8cf205`.
- **Previous production artifacts:**
  - `7e4c643` / `5da8fd9` / body `822a5a20…780d`: IB11-P7 corrected repair (the P7 qualification artifact);
  - `b856a62` / `b88af38` / body `8c964f02…0ad5`: IB11-P7 first repair (the P7 attempt-1 artifact; NOT QUALIFIED);
  - `39a5ae1` / `0a7f57f` / body `d445d442…b439`: IB11-P6 (V-D4; the P6 qualification artifact);
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
| **P6 — V-D4** (rotated Fit valid across resize) | **COMPLETE, PASS(scope) in TC** |
| **P3 — V-D5** (narrow viewer-key modifier guard) | **COMPLETE, PASS(scope) in TC** |
| **P4 — V-D6a** (safe takeover on a synchronous build failure) | **COMPLETE, PASS(scope) in TC** |
| **P5 — V-D6b** (communicated in-viewer build failure) | **COMPLETE, PASS(scope) in TC** |
| **P7 — V-D7** (staged placeholder; preserve apparent view on replacement) | **COMPLETE, PASS(scope) in TC** (attempt 2; attempt 1 NOT QUALIFIED, retained) |
| **P8 — Focus ownership/return** | **COMPLETE, PASS(scope) in TC** |

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
- **Real-Chrome qualification:** raw `tests/results/ib11-p6-vd4.json` SHA-256 `a8663e3472b1ef92466d3191f7fd461b6a0e719cf0eb0c9eef4c15e818d08be5` (git-ignored). `vview_evaluate.cjs --p6`: revision 1.3, exit 0, **V-D4 REPAIR QUALIFIED**.
  - VD4 PASS / BEHAVIOR_OK: the loaded 2000×1000 fixture, fit-both, `rotate(90deg)` kept, both resizes trusted.
  - Resize 1: stage 2560×1227, Fit area 2536×1203, rotated media 602×1203, no overflow.
  - Resize 2: stage 2560×1395, Fit area 2536×1371, rotated media 686×1371, no overflow.
  - Screenshot Enter trusted with the rotated fit on screen. No client error or unrelated trusted input.
  - **Supplemental visual evidence:** `tests/results/ib11-p6-vd4.png` SHA-256 `c579e5d2a663483f4a40a6997c0cca7c9b92f69d2494af928466001d81690d67` (git-ignored, not committed). It shows the fixture rotated upright and contained in the viewer. It is a multi-monitor capture with unrelated private desktop content, so it must remain private.
  - **Preservation:** Fit modes at 0°/180°, original-size, manual zoom/pan, rotation/flips, E6 (Fit resets rotation and flips) and P1–P5 all unchanged (P6 regression and P1–P5 regressions).

**P7 detail:**
- **Change** (`b856a62`, corrected by `7e4c643`):
  - an image target with a distinct non-video sample (else preview) opens on that placeholder;
  - once it is displayed, the original is downloaded in a **detached preload**, and the placeholder element stays untouched;
  - when the original is completely loaded and decoded, it is assigned to the displayed element (Chrome reuses it synchronously), and the zoom is rescaled in the same task, so the apparent view is kept (pan, rotation, flips and the manual/fit mode kept; no refit);
  - a failed original keeps the placeholder with "Full image failed to load" and the native link;
  - metadata-pending, video and no-placeholder targets are unchanged.
- **Attempt 1** (raw `b28fbf3db1f5dcbe14f2f3f69d71c84d758469679b8f1ede1bd015d7660b72d2`, production `b856a62`): NOT QUALIFIED.
  - Chrome reads 0×0 for a pending in-place `src`, so the frame queued at open fitted the painted 160×80 placeholder to the 1600×800 metadata (scale 1.50375, 240.6×120.3).
  - Chrome painted the progressive original once its header arrived, and the upgrade then shrank the original 10×.
  - The probe's `naturalWidth === 160` wait could never succeed.
- **Regression:** `tests/host/ib11/p7_vd7_staged_placeholder.cjs` 29/29 under Chrome's measured image semantics. The Chrome-semantics checks fail on `b856a62` and an in-place mutant; staging and apparent-view checks fail on `39a5ae1`, the no-placeholder and raw-zoom mutants; 13 preservation checks hold everywhere.
- **Staging attribution:** `p7_staging_attribution.cjs` 7/7.
  - The closed P1–P5 regressions and E0 are unedited.
  - The neutral run (all staging disabled) passes them fully, and E0 fails exactly its pre-P7 set.
  - E3 is staging-attributed: its harness cannot complete a detached preload.
  - E4 passes as-is for the same reason; the apparent-view repair is proven by P7-3, P7-6 and P7-10 and the browser cell.
  - IB10: 67/67 neutralized.
- **Package verifier:** `verify_ib11_p7.cjs` 45/45; second package `2fee6862…51ab`. VD7X now has an 800×400 placeholder; the placeholder is judged by its layout footprint; painted frames are compared. The verifier rejects `b856a62`, the first-attempt probe logic, and transforms captured after completion.
- **Regressions on `7e4c643`:**
  - IB01–IB09 pass (IB07 blob pins only);
  - P6 15/15, P7 29/29;
  - verifiers fail only their working-tree pins;
  - E0 27/38 and controls 39/46: B1 the intended flip; A1, C1, D1, E3 staging-attributed; D2 and D4 anchor pins (re-anchored: caught).
- **Real-Chrome qualification:**
  - **Attempt 1:** raw `b28fbf3db1f5dcbe14f2f3f69d71c84d758469679b8f1ede1bd015d7660b72d2` (production `b856a62`): NOT QUALIFIED, retained.
  - **Attempt 2:** raw `c5d9f11aa828e681f404511afd2ae67b213e6b4d0c30132edeeef7af9b244ab7` (production `7e4c643`, package `2fee6862…`). `vview_evaluate.cjs --p7`: revision 1.3, exit 0, **V-D7 REPAIR QUALIFIED**.
    - P7STAGE: the target's own 160×80 thumb painted at its fitted 2406×1203 (scale 15.0375) at 300 ms and 1000 ms with the original pending. The upgrade to 1600×800 happened on the same element and target at scale 1.50375 with the rectangle exactly 2406×1203 and centre (1280, 613.5); identical 500 ms later. 1765 frames, 0 blank.
    - P7XFORM: on the retained 800×400 placeholder, rotation 90°, both flips, manual zoom 3.5075 and pan (40, −25) were applied before completion. At the upgrade the scale was 1.75375 with everything else kept, and the rectangle exactly 1403×2806 with the same centre; identical 500 ms later. 1759 frames, 0 blank.
    - Identity MATCH; no client error; no trusted outside input.
- **Settled designer decisions:**
  - The closed P1–P6 regression files stay untouched; their staging-changed assumptions are historical/staging-attributed, and P7's preservation regression carries the protected behavior forward.
  - Differing placeholder/full aspect ratios are an accepted limitation: exact two-axis preservation is qualified for same-aspect replacement, and bounded containment under the uniform-scale transform is acceptable otherwise. No new transform architecture.

**P8 detail:**
- **Change** (`9d86484`, viewer module only):
  - **Acquisition:** after a successful new open, focus moves to the viewer's Close (✕) button. A failed initial takeover rethrows first, so no focus is stolen. An open viewer keeps its focused control and only reclaims escaped focus.
  - **Trap:** unmodified Tab / Shift+Tab wrap at the boundaries of the viewer focus set, read from the current viewer DOM (the native link included when present). Ctrl/Meta/Alt+Tab are not handled (the V-D5 guard is unchanged).
  - **Return:** close restores the origin, else the fallback, else nothing. A stage click that blurred focus to body is now covered.
  - **Implicit origin:** a context-less new open returns to the pre-open focused element; an open viewer keeps its targets.
  - **Not added:** dialog/ARIA/inert.
- **Regression:** `tests/host/ib11/p8_focus_ownership.cjs` 25/25 on the repair, `7e4c643` and seven single-obligation mutants (no acquisition, trap, restore, implicit origin; origin replaced; focus before build; modified Tab trapped). Every return check requires focus to have been in the viewer.
- **Attribution:** `p8_focus_attribution.cjs` 8/8.
  - The closed suites are unedited and fail only the recorded P7 staging sets plus the pre-focus "no focus change" checks P3-16, P4-15, P5-15, P7-23 and E0 F2 (the intended flip).
  - The P7 staging attribution is unchanged (7/7 with focus neutralized).
- **Package verifier:** `verify_ib11_p8.cjs` 34/34; package `9e938f4f…d608` (mouse-origin and keyboard-origin cells, all trusted).
- **Regressions on `9d86484`:**
  - IB01–IB09 pass (IB07 blob pins only); IB10 64/67 (P7-attributed);
  - P6 15/15, P7 28/29 (P7-23 focus-attributed), P8 25/25;
  - verifiers fail only their working-tree pins;
  - E0 26/38 and controls 38/46: F2 the intended flip; F1's control an anchor pin (re-anchored with D2 and D4: caught, 41/46).
- **Real-Chrome qualification:** raw `tests/results/ib11-p8-focus.json` SHA-256 `535cf475ad537653413ac71106b4153011c67a084a00be9226ba661306b18032` (git-ignored). Chrome 154 / Windows / Tampermonkey 5.5.0; identity MATCH. `vview_evaluate.cjs --p8`: revision 1.3, exit 0, **P8 FOCUS QUALIFIED**.
  - **P8M** PASS / BEHAVIOR_OK: a trusted click opens the viewer with focus on Close (14 viewer controls). Tab wraps Close → "Previous (←)" and Shift+Tab wraps back to Close. Escape returns focus to the actual FOCUS_M invoker (immediately and at 300 ms; not body).
  - **P8K** PASS / BEHAVIOR_OK: a trusted Enter on the FOCUS_K link opens the viewer with focus on Close. Shift+Tab moves natively to "Open original (o)", Tab goes back to Close, and Tab wraps to "Previous (←)", all inside. A click on Close returns focus to the FOCUS_K invoker.
  - **No false return:** focus entered the viewer in both cells before the close.
  - **Limitation:** focus inside native video controls is browser-managed.

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
- **Designer gate / handoff boundary.** All frozen IB11 P items are closed: P1 (V-D8), P2 (V-D1), P3 (V-D5), P4 (V-D6a), P5 (V-D6b), P6 (V-D4), P7 (V-D7), P8 (focus ownership/return).
  - The next step is the designer closure review, then the **IB11 final closeout**, which needs an explicit assignment.
  - IB12 is not started.
  - Each follows the P1 pattern: a minimal production change, a permanent regression that fails on the prior artifact, a fault control, regressions, and real-browser qualification where needed.
- **Forbidden:**
  - no batching of P items;
  - no scope beyond the frozen list (A4, C4, E6, G4 stay unchanged);
  - no IB12 or later checkpoint before IB11 is complete;
  - no production change without an assigned P item.
