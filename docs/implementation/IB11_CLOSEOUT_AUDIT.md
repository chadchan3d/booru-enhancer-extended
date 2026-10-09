# IB11 — Final closeout audit

**Checkpoint:** IB11 — Existing viewer hardening (Blueprint §3 IB11, items 1–14).

**Result (final, under Blueprint v1.1 — §12): IB11 — Existing viewer hardening: COMPLETE, PASS(scope) in TC.**
- **E0 D5 → P9: COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §18–§20).
- **Item 12 → SATISFIED(scope).** Equivalent, stronger structured real-browser failure evidence satisfies it. Literal failure screenshots were not produced and, under v1.1, are not an independent gate (§8, §12).
- **Everything else audited** (items 1–11 and 13–14, the item-9 required tests, item-8 preservation, item-10 acceptance, gates, scope, current-production regressions) is supported as recorded below, within the TC scope.
- **History:** the first audit (`85b4ad2`, Blueprint 1.0) found IB11 **PARTIAL / BLOCKED** on item 12 (ITEM 12 FAILURE-SCREENSHOT ARTIFACT NOT FOUND) and on the unclassified D5. Sections 0–11 keep that audit's text and evidence; resolutions are marked where they apply.

## 0. Synchronized starting identity

| Item | Value |
| --- | --- |
| Branch / HEAD | `implementation/ib00-baseline` at `1aa84a2da6ef007ea30103d2d30e03629060cf36` = origin; tree clean |
| Blueprint | Version 1.0, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a` (unchanged) |
| Production | commit `9d864845d482f74cc565cf0c6b4ff92ccef7a047`, blob `8453be9447820978b7d4a2886ea9ae2bf4e87c10`, body SHA-256 `7745efafde2013fa98329c0ff6c9dd9d94995098129b763b05b7abdccd8cf205` |
| Closed P items | P1 V-D8, P2 V-D1, P3 V-D5, P4 V-D6a, P5 V-D6b, P6 V-D4, P7 V-D7, P8 focus: each COMPLETE, PASS(scope) in TC (`IB11_P_STAGE.md` §1–§17) |

No mismatch.

**Evidence classes used below:**
- **SRC** source-confirmed;
- **REG** permanent local regression/fault control;
- **BRW** controlled real-browser evidence (Chrome 154 + Tampermonkey 5.5.0, local controlled fixtures);
- **OWN** architectural/owner decision.

**Browser evidence and artifacts:** each P item's BRW evidence ran on that item's repair artifact. Its continuation on the final production is carried by REG (the P7/P8 preservation regressions plus the attribution layers in §6).

## 1. Blueprint coverage matrix (items 1–14)

| # | Requirement | Evidence | Class | Scope / limitation | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | Objective: reliable takeover and staged loading without replacing the interaction model | P4, P5 (takeover/failure), P7 (staging), P8 (focus); the viewer module was extended, not replaced (§5) | REG + BRW + SRC | TC | SATISFIED(scope) |
| 2 | Invariant: target's usable placeholder; transforms/preferences preserved; native recovery on load/playback failure | P7 (own placeholder; apparent view), P6 (rotation-aware Fit), G-PLAY (preferences), P1/P2/P5/P7-9 (native link); playback failure has the native controls + Space fallback | REG + BRW | TC; G-PLAY WebM limitation; aspect-ratio limitation (P7) | SATISFIED(scope) |
| 3 | Allowed scope: staged thumbnail/sample, post-ID + generation guards, local loading/buffering/failed states, safe takeover + native link, cleanup + focus return; V3 playback E before playback changes | P7 staging + guards (element/generation/stage/preload); P2 (no extra same-ID guard needed, source argument); existing Loading/Buffering states; P4/P5/P1; P8. G-PLAY(TC) E completed before any playback-touching P item; no P item changed playback policy | SRC + REG | A blocked-Play UI state is allowed, not required; not added (G4 unchanged, OWN) | SATISFIED(scope) |
| 4 | Forbidden scope | §5 audit | SRC | — | SATISFIED |
| 5 | Prerequisites: IB04/05/07, runtime/host facts, media cleanup; IB09/10 classes not prerequisites | Ledger: IB04–IB07 complete for TC; D3/D7 media cleanup; P7 placeholder choice uses only the target's post data (`stagedPlaceholderUrl`), never IB10 eligibility | SRC + REG | TC | SATISFIED(scope) |
| 6 | Gates: G-OWN(viewer), G-RUNTIME, G-SETTINGS, G-REQUEST/G-HOST; G-PLAY(cell) E PASS before playback wiring; fallback not autoplay certification | §7 | Ledger records | TC only; G-RUNTIME other cells OPEN (IB18) | SATISFIED(scope) |
| 7 | Expected files/modules | Every change is in the viewer module's `open`/`updatePost`/media handlers, image readiness, transform-preserving replacement, error/focus handling, plus the gallery takeover catch (P4) | SRC | — | SATISFIED |
| 8 | Master behavior unchanged | §3 | REG (+ BRW for G-PLAY) | TC | SATISFIED(scope) |
| 9 | Required tests | §2 | REG + BRW | Rows 4 and 6 indirect/local (see §2) | SATISFIED(scope) |
| 10 | Acceptance | §4 | REG + BRW | D5 resolved: P9 COMPLETE (§12) | SATISFIED(scope) |
| 11 | Failure/rollback | §9 | SRC | — | SATISFIED (statement) |
| 12 | Artifacts: transform comparison, G-PLAY evidence, generation/takeover/focus timelines, failure screenshots | §8, §12 | BRW (structured) | Literal failure screenshots not produced; structured real-browser failure evidence substitutes (Blueprint v1.1) | SATISFIED(scope) |
| 13 | Gates opened: stable last-viewed identity/focus for IB12; page navigation reuse for IB17 | P8 (the return origin follows in-viewer navigation's explicit card origin; focus returned to it); viewer navigation unchanged (P7-21, P8-15) | REG + BRW | Last-viewed identity semantics not redesigned (as assigned) | SATISFIED(scope) |
| 14 | Checkpoint ID | IB11 — Existing viewer hardening | — | — | SATISFIED |

## 2. Item 9 required tests

| # | Required test | Current-production carrier | Browser evidence | Note |
| --- | --- | --- | --- | --- |
| 1 | Synchronous open throws before cancellation | P4 regression P4-1–P4-3 (pass); P7-17; P8-14 (no focus stolen) | P4 real Chrome (raw `04e21ce5…6b1c`, on `fe1e06b`) | E0 A5 is the historical defect witness (flipped) |
| 2 | Later media failure after takeover | P7-9, P7-14, P7-26; E0 C2 (video, pass); P5 (in-viewer, P5-2–P5-4 pass) | P1 `5b23289a…0bb8`, P2 `d5015823…aece`, P5 `341d4be9…31dc` | E0 C1 is staging-attributed (§6) |
| 3 | Rapid different-ID loads | E0 D2 (stale callbacks, pass); P7-8 (late original of the previous target ignored) | — | E0 D1 is staging-attributed; it passes with staging neutralized |
| 4 | Rapid same-ID loads | E0 D4 (characterizes last-writer, pass); P7-10 (same-post upgrade) | — | **Indirect:** no generation guard; P2's source argument (the only `updatePost` caller delivers the cached/in-flight post). P2-2 is staging-attributed. |
| 5 | Close before decode/readiness | E0 D7 (pass); P7-7 (closed before the original: inert) | — | — |
| 6 | Load fallback where `decode()` is absent | P7 regression (29 checks): the harness has no `HTMLImageElement.decode`, so every staged upgrade runs the decode-absent branch of `startFullPreload` | P7 attempt 2 (`c5d9f11a…4ab7`) covers the decode-present path | **Local only** for the decode-absent path |
| 7 | All transforms across replacement | P7-3, P7-6, P7-10, P7-28 | P7 attempt 2, P7XFORM | E0 E3 is staging-attributed |
| 8 | All transforms across resize | P6 regression 15/15; E0 E2 (pass); P7-5 | P6 `a8663e34…8be5` | — |
| 9 | V3/R8 preference combinations | E0 H1 (all 8 autoplay/loop/mute combinations, pass), H2 (remember volume, pass) | G-PLAY(TC) `13888dd9…0048` + `ebd4f57c…5a90` | Playback handling not changed by any P item |
| 10 | Deliberate unmute | E0 H3 (pass) | G-PLAY(TC) | — |
| 11 | Rejected `play()` plus usable fallback | E0 G4 (rejection swallowed; native controls remain, pass); P8-23 (Space plays) | G-PLAY(TC): MP4 NotAllowedError, trusted Space fallback | **WebM no-activation not separately measured** |
| 12 | Keyboard browser checks | P3 regression P3-1–P3-13 (pass); E0 G1, G5 (pass); P8-16, P8-18 | P3 `6bdf64b0…5436` (trusted Ctrl+F/D, Alt+O, F, D); P8K | — |
| 13 | Focus browser checks | P8 regression 25/25 | P8 `535cf475…8032` (P8M, P8K) | — |
| 14 | Native-link browser checks | P7-25, P8-19, P7-9 | P1, P2, P5 (trusted clicks, hit tests, destination arrivals) | — |

## 3. Item 8 preservation (current production `9d86484`)

| Behavior | Current-production evidence |
| --- | --- |
| Fit modes | E0 E1; P7-19 (all four modes); P6-7/P6-8 |
| Zoom | E0 E2; P7-20; P6-12 |
| Pan | E0 E2; P6-12; P7-20 |
| Rotation | P6 (all quarter turns); P7-6; P8-24 |
| Flip | P6-13; P7-6; P8-24 |
| Navigation | E0 G1; P7-21; P8-15; P8-18 |
| Ordinary viewer keybinds | E0 G1, G5; P3-7–P3-13; P8-18; Space P8-23 |
| `viewer.enabled` / ordinary-click choice | E0 A3; P4-7; P7-9 |
| Autoplay / mute / loop | E0 H1; G-PLAY(TC) |
| Remember volume | E0 H2; G-PLAY(TC) |
| Modified clicks | E0 A2; P4-6; P7-9 |
| Middle clicks | E0 A2; P4-6 |
| Native-action clicks | per-card action button: E0 A4 (unchanged, OWN); native link click: P8-19, P7-25 |

**Classification of changed historical tests** (closed test files unedited):
- **P7 staging-attributed:** P1-1/2/3/4/6, P2-1/2/3/6/11, P3-14/15, P4-4/10/11, P5-1/6/10/11, IB10's three "IB09 still-image class … timelines" checks, and E0 A1, B1 (the intended V-D7 flip), C1, D1, E3.
- **P8 focus-attributed:** P3-16, P4-15, P5-15, P7-23, and E0 F2 (the intended flip).
- **Superseded pins:** E0 S0; IB07 `item9`/`pagecount`; the G-PLAY, V-VIEW and P1–P7 package verifiers (one working-tree pin each).
- **Repaired historical defect witnesses:** E0 A5, A6, C3, E5, G2.

## 4. Item 10 acceptance

| Criterion | Evidence | Verdict |
| --- | --- | --- |
| Existing interaction regressions pass | §3 and §6: every failure is classified; there are no unexplained failures | SATISFIED(scope) |
| No blank uncommunicated failure | V-D6a (P4), V-D6b (P5), V-D1 (P2), staged failure P7-9/P7-26, video failure C2. A target without `postUrl` (C4, owner-frozen) shows the failure text without a link: communicated | SATISFIED(scope) |
| No stale target | E0 D2; P7-8; P2-6 and D1 (staging-attributed; pass neutralized); P8-15 | SATISFIED(scope) |
| No invalid transform reset | P6 (rotation-aware Fit), P7 (apparent view kept, no refit at upgrade), E3/P7-6 (rotation/flip kept), P9 (manual view kept across image → video). E6 (Fit button resets: owner-frozen) | SATISFIED(scope) |
| Deliberate view distinct from hover cost eligibility | P7's placeholder source is the target's own post data only; IB10 behavior is unchanged apart from staging-attributed timeline checks (67/67 neutralized) | SATISFIED |
| Native navigation usable after failure | P1/P2/P5 BRW; P7-25, P8-19 REG | SATISFIED(scope) |
| Playback wording matches evidence | Recorded as G-PLAY(TC) PASS(scope): no general autoplay claim; the WebM no-activation limitation stated | SATISFIED(scope) |

**E0 D5: resolved.** The designer ruled it an IB11 defect, and it is now **P9 COMPLETE, PASS(scope) in TC** (`IB11_P_STAGE.md` §18–§20). The original audit text follows.
- **The finding:** when metadata reveals that an image placeholder is actually a video, the element is rebuilt as `<video>`. Rotation and flip are kept, but manual zoom and pan are discarded (a refit). It still passes on current production.
- **Why it matters:** the owner decisions froze A4, C4, E6 and G4 as unchanged, and froze the placeholder→full *image* replacement rule (P7). D5 (an element-type change) was never classified. Whether it is an "invalid transform reset" under item 10 is a designer decision. No production change was made.

## 5. Scope audit (items 3–4)

**None of the forbidden constructs was introduced:**
- **Viewer rewrite:** none. All changes extend the existing viewer module.
- **Replacement gallery shell:** none. The one gallery change is P4's takeover catch.
- **Global media accounting:** none. P7's preload is per element.
- **Forced remute over explicit preference:** none; playback policy is untouched (G-PLAY: no forced remute).
- **Old-post media as the new target's placeholder:** none. P7 uses the target's own sample/preview; P7-1 and the browser P7STAGE check the first source is the target's.
- **Page-reader abstraction:** none.

**Owner-frozen findings, unchanged and passing on current production:**
- A4: the action button opens even when disabled;
- C4: no native link without `postUrl`;
- E6: the Fit button resets rotation and flip;
- G4: a rejected `play()` is swallowed.

**P8 added no dialog/ARIA/inert.**

**Production changes in IB11:** `9aeab36` (P1), `bef4437` (P2), `48e44d9` (P3), `fe1e06b` (P4), `24ee7c2` (P5), `39a5ae1` (P6), `b856a62` + `7e4c643` (P7), `9d86484` (P8).

## 6. Current-production test reconciliation (no drift since P8)

Run at HEAD `1aa84a2`, production `9d86484`. Historical result files rewritten by these runs were restored unedited (tree clean afterwards).

| Suite | Result | Classification |
| --- | --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 | — |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9`, `pagecount` exit 1 | blob pins |
| IB08 | 66/66, 24/24, 12/12, 14/14 | — |
| IB09 P-stage | 111/111 | — |
| IB10 P-stage | 64/67; 67/67 with staging and focus neutralized | 3 P7 staging-attributed |
| P1–P5 regressions | 1/6, 6/11, 13/16, 11/15, 10/15 | P7 staging-attributed; P3-16, P4-15, P5-15 focus-attributed |
| P6 / P7 / P8 regressions | 15/15; 28/29 (P7-23 focus-attributed); 25/25 | — |
| E0 characterization | 26/38; fault controls 38/46 | S0 pin; A5, A6, C3, E5, G2 repaired witnesses; A1, B1, C1, D1, E3 staging-attributed; F2 focus-attributed. Uncaught controls: the A5, C3, E5, G2 repair probes and G5 (known), plus the D2, D4, F1 anchor pins, which are caught when re-anchored (§16 of the P-stage record) |
| P8 focus attribution | 8/8 | — |
| P7 staging attribution (focus neutralized) | 7/7 | unchanged |
| G-PLAY / V-VIEW verifiers | 36/37, 65/66; recoveries 28/28, 32/32 | pins |
| P1–P7 package verifiers | 22/23, 22/23, 31/32, 26/27, 31/32, 29/30, 44/45 | one superseded pin each |
| P8 package verifier | 34/34 | — |
| All 11 package builds (`--check`) | DERIVED_SCRIPT_UP_TO_DATE | — |

**There is no new, unexplained behavioral failure.**

## 7. Gates and prerequisites (item 6)

| Gate | Recorded state |
| --- | --- |
| G-OWN(viewer) | PASS for the active TC path |
| G-RUNTIME | TC cell measured; other cells OPEN (IB18) |
| G-SETTINGS | PASS (TC) |
| G-REQUEST / G-HOST (enhanced metadata) | PASS for the active TC path |
| G-PLAY(TC), E | **PASS(scope)** (`gplay_evaluate.cjs` revision 1.1, 32/32; raws `13888dd9…0048`, `ebd4f57c…5a90`) |

**G-PLAY limitation:** the no-activation blocked → fallback path was demonstrated for MP4 only. The WebM page inherited activation, so the WebM no-activation path was not independently measured. **This is not WebM autoplay certification.**

## 8. Item 12 evidence and artifacts

| Category | Retained artifact | Verdict |
| --- | --- | --- |
| Viewer behavior/transform comparison | P6 raw `a8663e34…8be5` (stage/media rects after real resizes); P7 attempt-2 raw `c5d9f11a…4ab7` (painted placeholder vs full frames, transforms); E0 and P6/P7 regression result files | Present |
| G-PLAY evidence | G-PLAY raws `13888dd9…0048`, `ebd4f57c…5a90`; `IB11_GPLAY_VERIFICATION.json` | Present |
| Source-generation and takeover/focus timelines | V-VIEW raws (`ff2fce48…1599`, `a222632a…37e4`, `9e434c09…8f07`); P4 raw `04e21ce5…6b1c` (takeover); P8 raw `535cf475…8032` (focus); P7 frame timelines; recorder seams | Present |
| **Failure screenshots** | **None.** Searched: the repository and its history (no committed image), `tests/results/` (only the P6 repaired-Fit screenshot), and the older raw location `tests/browser/ib10/` (no image). `IB11_BASELINE.md:203` listed failure screenshots as not yet packaged, and every failure qualification (P1, P2, P4, P5) produced structured JSON only. | **ITEM 12 FAILURE-SCREENSHOT ARTIFACT NOT FOUND** |

**Not a substitute:**
- `tests/results/ib11-p6-vd4.png` (`c579e5d2…0d67`) is repaired rotated-Fit evidence, not a failure screenshot. It is a full multi-monitor capture with unrelated private content, so it stays private and uncommitted.
- Structured JSON failure evidence is not substituted for screenshots.

Per the assignment, no evidence was created, reconstructed or captured.

**Resolution under Blueprint v1.1 (§12): SATISFIED(scope).** Literal failure screenshots were not produced. The required failure behaviour is supported by stronger structured real-browser evidence. Blueprint v1.1 states that an artifact's form is not an independent hard gate when equivalent or stronger evidence already demonstrates the requirement. The "not a substitute" statement above was correct under Blueprint 1.0 only.

## 9. Rollback statement (item 11)

Each IB11 P item is an isolated, separately committed change. Rollback means reverting the affected item's production commit, which preserves the native link and saved preferences:
- staging: P7 `b856a62` + `7e4c643`;
- focus: P8 `9d86484`;
- takeover/failure: P4 `fe1e06b`, P5 `24ee7c2`;
- Fit: P6 `39a5ae1`.

Playback integration was not changed by IB11 P. No hover-class result disables the deliberate viewer (P7's source rule is independent of IB09/IB10 eligibility).

## 10. Limitations carried forward

- TC-qualified scope only: Chrome 154 + Tampermonkey 5.5.0, controlled local fixtures. Other runtime cells belong to IB18.
- G-PLAY: the WebM no-activation path was not separately measured.
- Focus inside native video controls (shadow internals) is browser-managed.
- P7: differing placeholder/full aspect ratios use bounded containment (owner-accepted), not exact two-axis preservation.
- Raw browser evidence under `tests/results/` (and earlier raws under `tests/browser/ib10/`) is private and git-ignored.
- The P6 multi-monitor screenshot stays private and uncommitted.
- Required tests 4 (rapid same-ID loads) and 6 (decode-absent fallback) are covered indirectly/locally, as stated in §2.

## 11. Decision required from the designer

1. **Item 12 failure screenshots** (still open; not started, by assignment):
   - approve capturing them (for example a controlled, viewer-only, sanitized capture of a failure state); or
   - rule that the recorded structured failure evidence satisfies item 12.
   - Until then IB11 cannot be marked COMPLETE.
2. **E0 D5:** ruled an IB11 defect, now **P9 (active)**. The repair is committed at `ac3c9e8`, with production blob `db54843…`. Real-Chrome qualification is pending.

IB11 stays **PARTIAL / BLOCKED** (item 12 failure screenshots; P9 pending). IB12 is not started.

**Both decisions are resolved in §12** (designer rulings under Blueprint v1.1).

## 12. Final closure under Blueprint v1.1

**Basis:** Blueprint Version 1.1 (9 October 2026), amendment `1a15eeb0a50cd1e07178564613d3f80858376b17`, plus the designer's rulings under it. Documentation only: no production change, no new package, no browser run, no screenshot capture.

**Synchronized identity:**

| Item | Value |
| --- | --- |
| Branch / HEAD | `implementation/ib00-baseline` at `d2d5615dfae4a96e2ee57d5663eb1565cdcddd7f` = origin |
| Blueprint | Version 1.1, blob `fe2b98cd2f294fef4ed2cd0053dc9d13bff05be6` |
| Production | commit `ac3c9e8e4fbf425fa473ceae0dfa5b36640f03b3`, blob `db5484396de60a90711e3b566fb8f6bbc10b3181`, body SHA-256 `d64df2a6ec8a3b5985ea5ab3f8e425cee4f1608f11c3308de37b94fd1d138127` |

**Resolutions:**

| Open item (§11) | Resolution | Evidence |
| --- | --- | --- |
| **E0 D5** | **P9: COMPLETE, PASS(scope) in TC** | `IB11_P_STAGE.md` §18–§20. Repair `ac3c9e8`; regression 12/12. Attempt-1 raw `1ba15c0c…181f` (Chrome 154 / Tampermonkey 5.5.0 / Windows, identity MATCH) is classified **VALID REAL-CHROME PRODUCT EVIDENCE; INITIAL QUALIFICATION VERDICT INVALIDATED BY TOOLING DEFECT; RE-EVALUATED UNDER CORRECTED RULE: P9 D5 QUALIFIED**. The original evaluator's NOT QUALIFIED was caused only by its false 1280×720 assumption; the pinned WebM decodes to 640×360 (`f8a2361`). No second run is required. Stale generation is covered by host regression P9-6. |
| **Item 12 failure screenshots** | **SATISFIED(scope)** through equivalent structured real-browser evidence | Literal failure screenshots were **not produced** and are not captured now. The required failure behaviour — a communicated failure state with a usable native recovery link — is shown in real Chrome by structured evidence: P1 `5b23289a…0bb8` (link hit test, trusted click, destination reached), P2 `d5015823…aece` (failure durable across a late update), P4 `04e21ce5…6b1c` (safe takeover on a build failure), P5 `341d4be9…31dc` (communicated in-viewer failure on the failing target), and the P7 staged-failure regressions (P7-9, P7-26). This evidence is stronger than a screenshot: it records the state text, the hit-testable link and the arrival. Under Blueprint v1.1 the artifact's form is not an independent gate here: no consequential risk depends on a literal image, and the owner has not required one. |

**Current-production reconciliation (`ac3c9e8`):** recorded in `IB11_P_STAGE.md` §19 (run at `f8a2361`; production identical).
- The results match §6, plus the intended E0 D5 flip and its repair-probe anchor: E0 25/38, fault controls 37/46.
- P8 regression 25/25 and P9 regression 12/12. The P8 package verifier is 33/34; its one failure is its superseded working-tree pin.
- Every other failure keeps its historical classification: superseded pins, P7 staging attribution, P8 focus attribution, or repaired defect witnesses. These historical attribution/pin classifications are not new product regressions.
- **No new, unexplained behavioural failure.**

**Limitations retained** (§10, plus P9):
- TC-qualified scope only (Chrome 154 + Tampermonkey 5.5.0, controlled local fixtures); other runtime cells belong to IB18.
- G-PLAY: the WebM no-activation playback path was not separately measured; this is not WebM autoplay certification.
- Focus inside native video controls (shadow internals) is browser-managed.
- Differing-aspect replacement uses bounded containment (P7 placeholder → full image; P9 image → video).
- Raw browser evidence stays private and git-ignored (`tests/results/`, earlier raws under `tests/browser/ib10/`). The private P6 multi-monitor screenshot is unrelated to item 12 and stays private and uncommitted.
- Required tests 4 and 6 are covered indirectly/locally (§2).

**No significant known IB11 product defect remains.** The owner-frozen findings A4, C4, E6 and G4 are unchanged by decision, not defects carried forward.

**IB11 — Existing viewer hardening: COMPLETE, PASS(scope) in TC.**
