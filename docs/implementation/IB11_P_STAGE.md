# IB11 — P stage: existing viewer hardening

**Checkpoint:** IB11 — Existing viewer hardening (Blueprint §3 IB11). Evidence base: `IB11_BASELINE.md` (E0–E4, final E-stage findings §15).

**Status:** **IB11 PARTIAL / NOT COMPLETE.**
- **P1 (V-D8): COMPLETE, PASS(scope)** for TC (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture), qualified in real Chrome (§2).
- **P2 (V-D1): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§3, §4).
- **P3 (V-D5): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§5, §6).
- **P4 (V-D6a): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§7, §8).
- **P5 (V-D6b): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§9, §10).
- **P6 (V-D4): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§11, §12).
- **P7 (V-D7): COMPLETE, PASS(scope)** for TC, qualified in real Chrome by attempt 2; attempt 1 is retained as NOT QUALIFIED evidence (§13–§15).
- **P8 (focus ownership/return): PARTIAL, NOT COMPLETE.** The production repair is committed and locally qualified; real-Chrome qualification is pending (§16).
- No other P item has started.

## 0. Owner decisions and frozen P scope (recorded at P1)

**Decisions:**
- **Focus:** the viewer owns focus while open. Tab and Shift+Tab stay within viewer-owned interactive elements. Close restores focus to the invoking element when it still exists.
- **V-D4:** the rotated-Fit correction belongs in IB11 P.
- **Placeholder → full-image replacement:** preserve the apparent on-screen view, not the raw numeric scale, and do not automatically refit.
- **Unchanged:** A4, C4, E6 and G4.
- **V-D5 (since E2):** a narrow viewer-key modifier guard.

**Frozen IB11 P scope:**
- V-D1, V-D4, V-D5, V-D6a, V-D6b, V-D7, V-D8, and the approved focus ownership/return behavior.
- Same-ID generation guarding is permitted only as the supporting mechanism for V-D1.
- One item per assignment.

## 1. P1 — V-D8: make the existing native recovery link usable

**Pre-edit gate:**
- `74e8f3dd` = origin, clean; production `4d793a2` / blob `002bdfd`.
- The decisions were recorded in the Ledger first (`cf39118`).

**Baseline defect** (V-VIEW revision 1.3, real Chrome, `IB11_BASELINE.md` §15):
- The visible fallback inherits `pointer-events: none` from `.be-media-state` (`Booru_Enhancer.user.js:4916`).
- Hit-testing at the link lands on `.be-viewer-stage`, and a trusted click on the words closes the viewer (`:3417`).
- No native navigation follows.

**Production change** (commit `9aeab364a2e336039250a31d3183f779a7da16c1`): one line, `Booru_Enhancer.user.js:3595`.

```diff
- fallback.style.cssText = 'margin-left:8px;color:inherit;text-decoration:underline;';
+ fallback.style.cssText = 'margin-left:8px;color:inherit;text-decoration:underline;pointer-events:auto;';
```

| Artifact | Value |
| --- | --- |
| Blob | `039b99e81fe844d864cbcc047cdca1e5b16ee1e2` |
| Production body SHA-256 | `35474709e617b3adedbd273c929f683d9d140670748cba0de55ee8baff06c46b` |

**Why this is the minimum.** The defect is solely the inherited computed value on the anchor.
- Declaring `pointer-events:auto` on the anchor itself makes the anchor alone win hit-testing at its own box.
- `.be-media-state` keeps `pointer-events: none`, so the spinner and the "Loading…/Buffering…" pill stay click-through exactly as before.
- Clicks anywhere else still reach the stage and close the viewer.
- No CSS rule, container, handler, text, destination, layout or failure-state structure changes.
- A click on the anchor is not a stage-close click, because the overlay handler closes only when the target is the overlay or the stage. The anchor's default navigation is not prevented by any viewer code.

**Forbidden-scope audit:** none of the following changed:
- the viewer structure or the failure state;
- focus, V-D1/V-D4/V-D5/V-D6/V-D7, blocked-Play UI, or a new fallback destination;
- stage click-to-close, or IB12.

**Permanent regression:** `tests/host/ib11/p1_native_link.cjs` **6/6** (result `p1-native-link-result.json`).
- **Method:** jsdom computes the inherited `pointer-events`; `elementFromPoint` returns the deepest element whose computed `pointer-events` is not `none`.
- **Sources:** each check runs on the repair, on the `4d793a2` baseline, and on a **mutant** that removes the declaration.

| Check | Repair | Baseline `4d793a2` | Mutant |
| --- | --- | --- | --- |
| P1-1 fallback present ("Open native post", card post href, inside the failure state) | true | true | true |
| P1-2 anchor pointer-interactive while `.be-media-state` stays `none` | **true** | **false** | **false** |
| P1-3 hit test at the link centre = the anchor | **true** | **false** | **false** |
| P1-4 click on the words targets the anchor, not prevented, viewer not closed by the stage handler | **true** | **false** | **false** |
| P1-5 click elsewhere on the stage still closes | true | true | true |
| P1-6 presentation unchanged (text, underline, spacing, colour) | true | true | true |

The V-D8 checks (P1-2, P1-3, P1-4) fail on the baseline (known-failure oracle) and on the mutant (fault control). The preservation checks hold everywhere.

**Real-browser qualification package (prepared): `tests/browser/ib11/IB11_P1_Native.user.js`** (SHA-256 `5842a1dad2a291c36e8c691d579e83d2fa7452c25a8974b8e037fa04552fe718`).
- **Build:** `build_ib11_p1.cjs` from `9aeab36`. The production body is byte-identical (35474709…c46b).
- **Runner:** the V-VIEW recorder and runner plus a declared runner-only patch (`p1_stageclose.js`) that adds the P1 page:
  1. **STAGECLOSE:** a trusted click on the empty stage must still close the viewer.
  2. **The revision-1.3 NATIVE cell, unchanged:** link box; computed `pointer-events` chain; `elementFromPoint`; one trusted in-box click with its actual target; navigation; the controlled destination's arrival.
- **Unchanged:** `vview_postamble.js` and the evidence-pinned V-VIEW package (`598ba6c5…`).
- **Server:** `vview_server.cjs --p1`.
- **Evaluator:** `vview_evaluate.cjs --p1` (revision 1.3 rules). The verdict is **V-D8 REPAIR QUALIFIED** only if both cells have evidence PASS, NATIVE is BEHAVIOR_OK (link hit, click on the link, destination reached), and STAGECLOSE is BEHAVIOR_OK.

**Local qualification: `verify_ib11_p1.cjs --media` 23/23** (`IB11_P1_VERIFICATION.json`; `IB11_P1_SHA256SUMS.txt`).
- **Static checks:**
  - package and body byte identity;
  - the runner equals the V-VIEW runner plus exactly the P1 patches;
  - V-VIEW package unchanged; local scope only;
  - P1 plan; server `--p1`.
- **Smoke (simulated browser):** repaired production → **V-D8 REPAIR QUALIFIED**.
  - The link's `pointer-events` is `auto` while `.be-media-state` stays `none`.
  - The hit test and the click target the link; the click is not prevented; the native post is reached.
  - An empty-stage click still closes the viewer.
- **Production faults (NOT QUALIFIED):**
  - the same probe on `4d793a2` gives NATIVE DEFECT_CONFIRMED;
  - the mutant restoring `pointer-events: none` gives DEFECT_CONFIRMED;
  - a broken stage click-to-close gives STAGECLOSE DEFECT_CONFIRMED.
- **Evidence faults (NOT QUALIFIED):**
  - an untrusted link click; a click outside the box; a zero-size link;
  - no arrival; hit but no navigation;
  - an untrusted stage click; a stage click off the stage;
  - wrong identity; duplicate attempts; wrong result type.

**Regressions on `9aeab36`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only (`fail: []`, `failed: []`, `controlFailures: []`) |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 67/67 |
| IB11 E0 characterization `viewer_baseline.cjs` | 37/38, fault controls 46/46 |
| IB11 G-PLAY | `verify_ib11_gplay` 36/37; recovery 28/28 |
| IB11 V-VIEW | `verify_ib11_vview` 65/66; recovery 32/32 |

**Expected pin failures:**
- `viewer_baseline.cjs`: the only failure is S0, the E-stage blob pin to `4d793a2`.
- `verify_ib11_gplay` and `verify_ib11_vview`: each fails only its "pinned `4d793a2` equals the working tree" pin, now superseded by P1.

**What the regression results show:**
- **Unchanged:**
  - ordinary stage closing, and the modifier/middle-click and `viewer.enabled` bypasses (A1–A3);
  - failure-state display (C1, C2);
  - playback behavior (H1–H3, D6, G4);
  - keys (G1, G5) and close cleanup (D7).
- **Still pinned as before (P1 is V-D8 only):** the other defect witnesses V-D1, V-D4, V-D5, V-D6a/b and V-D7.

Historical result files rewritten by these runs were restored unedited.

**P1 status at the time of the repair commit:** local qualification PASS; real-Chrome qualification was pending. It is now closed (§2).

**Operator step (about 1 minute):** see `tests/browser/ib11/README.md`, "IB11-P1".

## 2. P1 closure: real-Chrome qualification of the V-D8 repair

**Raw result:** `ib11-p1-native.json`, SHA-256 `5b23289a6a73776378466881578ce7644905484f19a6e9f854705e14c6fb0bb8`. Verified; not committed (`.gitignore`); not modified.
- Package `IB11_P1_Native.user.js` (`5842a1da…e718`).
- One attempt, page P1_NATIVE.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `35474709…c46b`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside prompts.

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p1 tests/browser/ib10/ib11-p1-native.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D8 REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**STAGECLOSE:** evidence **PASS**, finding **BEHAVIOR_OK**.
- A trusted click at (1829, 394) on `.be-viewer-stage`, with the viewer open at capture.
- The viewer closed afterwards (`openAfter: false`).

**NATIVE (revision 1.3 rule):** evidence **PASS**, finding **BEHAVIOR_OK**.
- **Before the click:**
  - failure state "Media failed to load" with the native link;
  - destination = the card's `/posts/<id>` (match);
  - link box x 1296.7, y 605.1, w 101.1, h 16.9;
  - computed `pointer-events`: link **auto**, `.be-media-state` **none** (unchanged), stage auto, overlay auto;
  - `elementFromPoint` at the centre (1347.2, 613.5) → the fallback **anchor**.
- **The click:**
  - a trusted pointerdown and a trusted click at (1330, 615), both targeting the anchor, with the link present;
  - not prevented; the viewer stays open (not a stage-close click);
  - the page navigated; the controlled native destination recorded the arrival after the click;
  - no clicks outside the box.

**Conclusion.** **P1 / V-D8: COMPLETE, PASS(scope)** for the qualified TC cell.
- The existing native recovery link now receives real pointer clicks and reaches the native post.
- The media-state overlay stays non-interactive, and empty-stage clicks still close the viewer.

**Production:** commit `9aeab364a2e336039250a31d3183f779a7da16c1`, blob `039b99e81fe844d864cbcc047cdca1e5b16ee1e2`, body SHA-256 `35474709e617b3adedbd273c929f683d9d140670748cba0de55ee8baff06c46b`. This closure is documentation only.

**Remaining frozen P items, all NOT STARTED:**
- V-D1 (with its same-ID generation guard);
- V-D4;
- V-D5;
- V-D6a;
- V-D6b;
- V-D7;
- focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 3. P2 — V-D1: keep an established failure state across late same-post updates

**Pre-edit gate:**
- `26bb6704` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `9aeab36` / blob `039b99e` / body `35474709…c46b`.
- No mismatch with the Ledger.

**Baseline defect.** E0 C3 (local) and V-VIEW VD1 (real Chrome, `ff2fce48…`): after a real media failure, a same-post `updatePost` with unchanged data erases "Media failed to load" and its native link, while the failed media stays.
- Cause: `updatePost` called `clearMediaState()` unconditionally (`Booru_Enhancer.user.js:3740` at `9aeab36`).

**Source facts used for the design:**
- `viewer.updatePost` has exactly one production caller: the gallery's open-time enrichment, `enrichSinglePost(postId).then(updatePost)` (`:4096`).
- `enrichSinglePost` returns the cached post or the single in-flight request for that ID (`:4372–4390`).
- So every same-post update delivers the same cached post data. Its **first** arrival may legitimately differ from the DOM-derived initial target (e.g. sample → original: current work). A **later or duplicate** arrival (re-open, navigation away and back) carries unchanged media.

**Production change** (commit `bef44372688b69968ee75507ff75895b165427ce`; in `updatePost` only):
- the unconditional `clearMediaState()` after `updateStatus(post)` is removed;
- `clearMediaState()` is called inside the branch that starts a new load (`nextUrl` differs), before the src swap.

The `!mediaEl` and type-change paths still go through `replaceMedia`, which manages its own state. Same-post updates that do not change the media now leave the current media state (a failure with its native link, or a pending loading state) untouched.

| Artifact | Value |
| --- | --- |
| Blob | `56c495e2c726a5a17f443d89d729fbd8f206eb46` |
| Production body SHA-256 | `a6d7bcc18b3fb9d2f4383eca2d00ecd13494155d9bb1c82a8e6b518ff4834839` |
| Diff | 1 line removed; 1 call plus a 3-line comment added in the new-load branch |

**Generation guard: not used.** The frozen scope permits a same-ID generation guard only as V-D1's supporting mechanism. Because the only caller always delivers the cached post, no differing stale same-post data can reach the viewer, so a guard would have no consumer. The same-post last-writer behavior (E0 D4) is unchanged.

**Why this is the minimum.** The defect is solely the unconditional clear. Moving it into the one branch that replaces the media's source keeps every legitimate update (a new URL, a type change, a first open) exactly as before, and stops non-media updates from destroying the state.

**Forbidden-scope audit.** No change to:
- V-D4, V-D5, V-D6a/b, V-D7, focus, A4, C4, E6, G4;
- playback policy, the viewer structure, or IB12.

**Permanent regression:** `tests/host/ib11/p2_vd1_failure_durable.cjs` **11/11** (result `p2-vd1-failure-durable-result.json`). Each check runs on the repair, the pre-P2 artifact `9aeab36`, and a **mutant** that restores the unconditional clear.

| Check | Repair | Prior `9aeab36` | Mutant |
| --- | --- | --- | --- |
| P2-1 [V-D1] late same-post update (unchanged data) keeps the failure text and native link; same media | **true** | **false** | **false** |
| P2-2 [V-D1] superseded work (A → B → A, A fails, two late deliveries) keeps the state | **true** | **false** | **false** |
| P2-3 [V-D1 + V-D8] after the update the link is still hit-tested, clicked, not prevented, viewer open | **true** | **false** | **false** |
| P2-4 [current work] a same-post update with a new URL clears the failure and loads the new source | true | true | true |
| P2-5 [current work] metadata-pending sample → original upgrade in place; the loading state is replaced | true | true | true |
| P2-6 different-post late update ignored | true | true | true |
| P2-7 image → video rebuild | true | true | true |
| P2-8 video URL upgrade: load + autoplay play (playback unchanged) | true | true | true |
| P2-9 empty-stage click closes; close releases the video | true | true | true |
| P2-10 unmodified keys (ArrowRight / ArrowLeft / Escape) | true | true | true |
| P2-11 fresh failure: native fallback present and pointer-interactive (V-D8) | true | true | true |

**Real-browser qualification: required.** The defect was characterized in real Chrome, and "native link remains usable" is browser hit-testing. Prepared package `tests/browser/ib11/IB11_P2_VD1.user.js` (SHA-256 `d38963eb5359ab511e4815195ae6f3aab99a3319c476aa86b19197e88741f07a`):
- **Build:** `build_ib11_p2.cjs` from `bef4437`; the body is byte-identical (a6d7bcc1…4839).
- **Runner:** the V-VIEW runner plus declared runner-only patches (`p2_vd1.js`; NATIVE_R can reuse the open viewer). The V-VIEW (`598ba6c5…`) and P1 (`5842a1da…`) packages are unchanged.
- **Page P2_VD1:**
  1. a real 404 failure → state and link recorded;
  2. the late same-post update through `viewer.updatePost` with the cached post (the enrichment path) → state and link at 0 ms and 500 ms, same media and same link node;
  3. if they survive, the revision-1.3 NATIVE cell: one trusted click on the link in the same viewer → hit test, target, navigation, destination arrival.
- **Server and evaluator:** `vview_server.cjs --p2`; `vview_evaluate.cjs --p2`. The verdict is **V-D1 REPAIR QUALIFIED** only if VD1P2 is PASS/BEHAVIOR_OK and NATIVE is PASS/BEHAVIOR_OK.

**Local qualification: `verify_ib11_p2.cjs --media` 23/23** (`IB11_P2_VERIFICATION.json`; `IB11_P2_SHA256SUMS.txt`).
- **Static:** the package is fresh, its body byte-identical, and its runner equals the V-VIEW runner plus exactly the P2 patches; the V-VIEW and P1 packages are unchanged; local scope; plan; server `--p2`.
- **Smoke (simulated browser):** the repair qualifies. The failure and link survive with the same media and the same node; the link is then clicked and the native post reached.
- **Production faults (NOT QUALIFIED):**
  - the probe on `9aeab36` gives VD1P2 DEFECT_CONFIRMED, with no click prompt;
  - the mutant restoring the clear gives DEFECT_CONFIRMED;
  - V-D8 regressed (`pointer-events` removed) gives a surviving link but NATIVE DEFECT_CONFIRMED.
- **Evidence faults (NOT QUALIFIED):**
  - no error event; no failure before the update; media replaced;
  - link erased at 500 ms; trusted input outside a prompt;
  - untrusted click; no arrival;
  - wrong identity; duplicate attempts; wrong result type.

**Regressions on `bef4437`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only (`fail: []`, `failed: []`, `controlFailures: []`) |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 67/67 |
| IB11 P1 regression | 6/6 (V-D8 preserved on the new production) |
| IB11 P2 regression | 11/11 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1 package verifier | 22/23 |
| IB11 E0 characterization | 36/38; fault controls 45/46 |

**Pin and witness failures (expected; not behavioral):**
- **Blob and working-tree pins,** each superseded by P2:
  - the G-PLAY and V-VIEW verifiers: their `4d793a2` working-tree pin;
  - the P1 package verifier: its `039b99e` working-tree pin;
  - the E0 characterization's S0: its `4d793a2` blob pin.
- **E0 characterization C3:** the V-D1 defect witness, which no longer holds because V-D1 is repaired. Its repair-probe control therefore has nothing left to flip (the 1 of 46).
- **Not reached by the repair:** every other E0 check (stage close, modifier bypass, failure display C1/C2, D1–D7, transforms, focus, keys, playback H1–H3) and every other defect witness (V-D4, V-D5, V-D6a/b, V-D7) still pass as before.

Historical result files rewritten by these runs were restored unedited.

**P2 status at the time of the repair:** local qualification and regressions passed; real-Chrome qualification was pending. It is now closed (§4).

**Provenance:** no donor code; all changes are original to this repository (MIT).

## 4. P2 closure: real-Chrome qualification of the V-D1 repair

**Raw result:** `ib11-p2-vd1.json`, SHA-256 `d50158234cdf224b3ba8514988c38dc075a80749c80930eab942aeb20748aece`. Verified; not committed (`.gitignore`); not modified.
- Package `IB11_P2_VD1.user.js` (`d38963eb…f07a`).
- One attempt, page P2_VD1.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `a6d7bcc1…4839`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside prompts.

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p2 tests/browser/ib10/ib11-p2-vd1.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D1 REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**VD1P2:** evidence **PASS**, finding **BEHAVIOR_OK**.
- **Before the update:** a real failure (error event on the media) showing "Media failed to load" and the native `card-post` link.
- **The update:** the late same-post update via `viewer.updatePost` with the cached post (the enrichment path), at t = 1171 ms.
- **After the update,** at 0 ms and at 500 ms: still "Media failed to load" with the native link.
- The failed media element and the link node are unchanged.

**NATIVE (revision 1.3 rule, on the same viewer after the update):** evidence **PASS**, finding **BEHAVIOR_OK**. V-D8 and native recovery are preserved.
- Link box x 976.7, y 445.6, w 101.1, h 16.9; destination = the card post (match).
- Computed `pointer-events`: link **auto**, `.be-media-state` **none**.
- `elementFromPoint` at the link centre → the anchor.
- A trusted pointerdown and a trusted click at (1035, 456), inside the box, targeted the anchor.
- Not prevented; the viewer stayed open.
- The page navigated, and the controlled native destination recorded the arrival after the click.

**Conclusion:** **P2 / V-D1: COMPLETE, PASS(scope)** for the qualified TC cell (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture).
- An established media-failure state and its native recovery link survive a late same-post update.
- The link remains usable.
- Same-post updates that start a new load are still applied (local P2-4 and P2-5).

**Production:** commit `bef44372688b69968ee75507ff75895b165427ce`, blob `56c495e2c726a5a17f443d89d729fbd8f206eb46`, body SHA-256 `a6d7bcc18b3fb9d2f4383eca2d00ecd13494155d9bb1c82a8e6b518ff4834839`. This closure is documentation only.

**Remaining frozen P items, all NOT STARTED:**
- V-D4, V-D5, V-D6a, V-D6b, V-D7;
- focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 5. P3 — V-D5: viewer keys ignore Ctrl/Meta/Alt chords

**Pre-edit gate:**
- `b9a5ef9` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `bef4437` / blob `56c495e` / body `a6d7bcc1…4839`.
- No mismatch with the Ledger.

**Baseline defect.** E0 G2 (local) and V-VIEW VD5 (real Chrome): viewer `onKeydown` admits any key whose `e.key` matches a binding, regardless of modifiers.
- Trusted Ctrl+F toggled Favorite; trusted Ctrl+D ran the viewer Download.
- Both were `preventDefault`-ed, which blocked the browser's Find and bookmark shortcuts.
- Source: `Booru_Enhancer.user.js:3439–3452` at `bef4437`.

**Source facts used for the design:**
- `onKeydown` is the only viewer keyboard admission path. It is registered once, through `viewerOwner.on(document, 'keydown', onKeydown)` (`:3430`).
- The bindings come from settings with defaults (`:924–930`): close Escape, next ArrowRight, prev ArrowLeft, download d, favorite f, openOriginal o, playPause Space.
- Shift needs no handling. Shift+F produces `e.key` "F", which matches no lower-case binding, and Shift+Arrow still navigates. Both are unchanged (P3-12).

**Production change** (commit `48e44d98d01949001852984d8884966ddb6ae225`; `onKeydown` only): one early return, `if (e.ctrlKey || e.metaKey || e.altKey) return;`, placed after the open-viewer check and before the binding lookup, plus a one-line comment.
- A chord now runs no viewer command and is not `preventDefault`-ed.
- The bindings, the command implementations and unmodified keys are unchanged.

| Artifact | Value |
| --- | --- |
| Blob | `f2b46eb443e153e03123742fb5d4baa4be761dd6` |
| Production body SHA-256 | `c42b71dbb7d660595be20095bac47cc1712a85381464d8327814895fa4745995` |
| Diff | 2 lines added (1 guard, 1 comment) |

**Forbidden-scope audit.** No change to:
- Shift handling, the bindings, or the download/favorite implementations;
- V-D4, V-D6a/b, V-D7, focus, A4, C4, E6, G4;
- playback, the viewer structure, or IB12.

**Permanent regression:** `tests/host/ib11/p3_vd5_modifier_guard.cjs` **16/16** (result `p3-vd5-modifier-guard-result.json`). Each check runs on the repair, the pre-P3 artifact `bef4437`, and a **mutant** without the guard. The unmodified bindings are read from the source defaults.

| Check | Repair | Prior `bef4437` | Mutant |
| --- | --- | --- | --- |
| P3-1 [V-D5] Ctrl+F: no Favorite; not prevented | **true** | **false** | **false** |
| P3-2 [V-D5] Ctrl+D: no Download; not prevented | **true** | **false** | **false** |
| P3-3 [V-D5] Meta+D, Meta+F: no Download / Favorite; not prevented | **true** | **false** | **false** |
| P3-4 [V-D5] Alt+O, Alt+F: no Open original / Favorite; not prevented | **true** | **false** | **false** |
| P3-5 [V-D5] Alt+ArrowLeft, Ctrl+ArrowRight: no navigation; Ctrl+Escape does not close; none prevented | **true** | **false** | **false** |
| P3-6 [V-D5] custom binding `keys.favorite = g`: Ctrl+G does not favorite (g does) | **true** | **false** | **false** |
| P3-7 unmodified f → Favorite once, prevented | true | true | true |
| P3-8 unmodified d → Download once, prevented | true | true | true |
| P3-9 unmodified o → Open original once, prevented | true | true | true |
| P3-10 ArrowRight / ArrowLeft navigate, Escape closes; prevented | true | true | true |
| P3-11 Space plays a paused viewer video (playback unchanged) | true | true | true |
| P3-12 Shift unchanged (Shift+ArrowRight navigates; Shift+F matches no binding) | true | true | true |
| P3-13 keys inert while the viewer is closed | true | true | true |
| P3-14 V-D1 preserved: a late same-post update keeps the failure state and link | true | true | true |
| P3-15 V-D8 preserved: the native link is pointer-interactive and hit-tested | true | true | true |
| P3-16 no focus change: opening the viewer does not move focus | true | true | true |

**Real-browser qualification: required.** The defect was observed with trusted keys in real Chrome. Prepared package `tests/browser/ib11/IB11_P3_VD5.user.js` (SHA-256 `d29d590bd04468f7e4096f055cbbb6af3e16597e6c3296f1050d74252d9cf0d6`):
- **Build:** `build_ib11_p3.cjs` from `48e44d9`; the body is byte-identical (`c42b71db…5995`).
- **Runner:** the V-VIEW runner plus declared runner-only patches (`p3_vd5.js`). The V-VIEW (`598ba6c5…`), P1 (`5842a1da…`) and P2 (`d38963eb…`) packages are unchanged.
- **Page P3_VD5:** five trusted key prompts on an open image viewer: Ctrl+F, Ctrl+D, Alt+O, then unmodified F and D. For each it records:
  - `isTrusted`, the key and the modifier fields;
  - Favorite, Download and Open-original calls (test-page stubs);
  - the viewer's `defaultPrevented`;
  - whether the viewer stayed open.
- **How the viewer's decision is measured:** a window **bubble-phase** listener reads `defaultPrevented` after production's `document` listener has run.
- **Browser-default limitation (stated precisely):**
  - For **Ctrl+D**, that listener then calls `preventDefault` so Chrome adds **no bookmark** (AGENTS.md forbids bookmark mutations). The evidence is the measured viewer decision (not prevented, no Download), not a bookmark dialog.
  - For **Ctrl+F**, nothing is suppressed, and Chrome's Find bar opens: the real browser shortcut reaches the browser.
  - **Alt+O** has no Chrome binding on Windows.
  - **Meta** is not exercised in real Chrome on Windows (the Windows key; Win+D shows the desktop). It is covered by P3-3.
- **Server and evaluator:** `vview_server.cjs --p3`; `vview_evaluate.cjs --p3`. The verdict is **V-D5 REPAIR QUALIFIED** only if all of these hold:
  - every key is trusted with the right modifier fields, and no trusted input fell outside a prompt;
  - Ctrl+F and Ctrl+D run no Favorite or Download, are not viewer-prevented, and leave the viewer open;
  - Alt+O runs no Open original, Favorite or Download and is not viewer-prevented;
  - unmodified F runs Favorite once and unmodified D runs Download once, both prevented;
  - the Ctrl+D browser default was suppressed by the runner.

**Local qualification: `verify_ib11_p3.cjs --media` 32/32** (`IB11_P3_VERIFICATION.json`; `IB11_P3_SHA256SUMS.txt`).
- **Static:** the package is fresh and its body byte-identical; the runner equals the V-VIEW runner plus exactly the P3 patches; the V-VIEW, P1 and P2 packages are unchanged; local scope; recording stubs; the bubble-phase measurement and the Ctrl/Meta+D-only suppression; plan; server `--p3`.
- **Smoke (simulated browser):** the repair qualifies.
- **Production faults (NOT QUALIFIED):**
  - the probe on `bef4437`: Ctrl+F favorites, Ctrl+D downloads, Alt+O opens the original, all prevented;
  - the mutant without the guard;
  - an over-broad guard that also swallows unmodified F.
- **Evidence faults (NOT QUALIFIED):**
  - untrusted Ctrl+F or Alt+O; Alt+O without `altKey`;
  - Ctrl+D prevented; Ctrl+F favorited; Alt+O opened the original;
  - viewer decision not measured (Ctrl+F, unmodified F); Ctrl+D browser default not suppressed;
  - unmodified F missing or carrying Shift; unmodified D without a download;
  - trusted input outside a prompt (each cell);
  - wrong identity; duplicate attempts; wrong result type.

**Regressions on `48e44d9`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 67/67 |
| IB11 P1 regression | 6/6 (V-D8 preserved) |
| IB11 P2 regression | 11/11 (V-D1 preserved) |
| IB11 P3 regression | 16/16 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1 package verifier | 22/23 |
| IB11 P2 package verifier | 22/23 |
| IB11 P3 package verifier | 32/32 |
| IB11 E0 characterization | 35/38; fault controls 43/46 |

**Pin, anchor and witness failures (expected; not behavioral):**
- **Blob and working-tree pins,** each superseded by P3:
  - the G-PLAY and V-VIEW verifiers: their `4d793a2` working-tree pin;
  - the P1 and P2 package verifiers: their `039b99e` and `56c495e` working-tree pins;
  - the E0 characterization's S0: its `4d793a2` blob pin.
- **E0 characterization G2, the V-D5 defect witness:** it no longer holds because V-D5 is repaired. Measured on the repair: Ctrl+F, Ctrl+D and Ctrl+O call no viewer command (`spies: []`) and are not prevented. Its repair-probe control ("modifier guard") has nothing left to flip. This is the expected change.
- **E0 characterization C3 (V-D1 witness):** as at P2; unchanged.
- **E0 G5 fault control "closed-state check removed": an anchor pin.** Its mutation anchor spans the open-check line and the `const keys = {` line, and the P3 guard now sits between them, so the anchor matches 0 times and the harness counts the control as not caught.
  - G5 itself passes.
  - Rerun once with the anchor narrowed to the open-check line only (a temporary copy, deleted afterwards), the control is **caught**: 44/46. The 2 remaining are the C3 and G2 repair probes.
  - Closed-state inertness is also asserted by P3-13.
- **Not reached by the repair:** every other E0 check and every other defect witness (V-D4, V-D6a/b, V-D7) still pass as before.

Historical result files rewritten by these runs were restored unedited.

**P3 status at the time of the repair:** local qualification and regressions passed; real-Chrome qualification was pending. It is now closed (§6).

**Provenance:** no donor code; all changes are original to this repository (MIT).

## 6. P3 closure: real-Chrome qualification of the V-D5 repair

**Raw result:** `ib11-p3-vd5.json`, SHA-256 `6bdf64b04998703e247fc05d35832d832e73e87a95b786f00c33748c0fa45436`. Verified; not committed (`.gitignore`); not modified.
- Package `IB11_P3_VD5.user.js` (`d29d590b…f0d6`).
- One attempt, page P3_VD5.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `c42b71db…5995`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside the prompts (VD5 0, P3KEYS 0).

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p3 tests/browser/ib10/ib11-p3-vd5.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D5 REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**Per key (all trusted; viewer open before and after each):**

| Key | Modifier fields | Favorite | Download | Open original | Viewer `defaultPrevented` | Runner suppressed browser default |
| --- | --- | --- | --- | --- | --- | --- |
| Ctrl+F | ctrl only | 0 | 0 | 0 | **false** | no (Chrome's Find received the shortcut) |
| Ctrl+D | ctrl only | 0 | 0 | 0 | **false** | **yes** (no bookmark added) |
| Alt+O | alt only | 0 | 0 | 0 | **false** | no |
| F | none | **1** | 0 | 0 | true | no |
| D | none | 0 | **1** | 0 | true | no |

**VD5:** evidence **PASS**, finding **BEHAVIOR_OK**. **P3KEYS:** evidence **PASS**, finding **BEHAVIOR_OK**.

**Limitation (as declared in §5):**
- For Ctrl+D the evidence is the viewer's measured decision (no command, not prevented). Chrome's bookmark action was deliberately suppressed by the runner afterwards.
- Meta chords were not exercised in real Chrome (the Windows key). They are covered by the local regression P3-3 only.

**Conclusion:** **P3 / V-D5: COMPLETE, PASS(scope)** for the qualified TC cell (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture).
- Ctrl and Alt chords run no viewer command and are left to the browser (not prevented).
- Unmodified F and D still run Favorite and Download once.

**Production:** commit `48e44d98d01949001852984d8884966ddb6ae225`, blob `f2b46eb443e153e03123742fb5d4baa4be761dd6`, body SHA-256 `c42b71dbb7d660595be20095bac47cc1712a85381464d8327814895fa4745995`. This closure is documentation only.

**Remaining frozen P items, all NOT STARTED:**
- V-D4, V-D6a, V-D6b, V-D7;
- focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 7. P4 — V-D6a: safe abandonment of a failed ordinary-click takeover

**Pre-edit gate (synchronized):**
- HEAD `1e96c5c3bab5c1e9ab3e6c2cafb2ee5d180f1211` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `48e44d9` / blob `f2b46eb` / body `c42b71db…5995`.
- No mismatch with the assignment or the Ledger.

**Baseline defect.** E0 A5 (local) and V-VIEW VD6A (real Chrome, recovery `a222632a…37e4`): with stored remembered volume 1.5, an ordinary click on a video card starts the takeover, and `buildMedia`'s `el.volume = vol` throws `IndexSizeError` synchronously. The gallery's catch correctly does not cancel the native navigation. But the overlay stays displayed with an empty stage and the failed post as current, over the page while the native navigation proceeds.

**Root cause** (at `48e44d9`):
- `viewer.open` sets `overlay.style.display = 'flex'` (`Booru_Enhancer.user.js:3725`) and then calls `replaceMedia` (`:3726`).
- `replaceMedia` empties the stage and calls `buildMedia`, which throws (`:3637`).
- The exception reaches `onGalleryClick`'s catch (`:4343–4344`). That catch only logs and returns without `preventDefault`, so nothing undoes the shell or the state that `open` had already set: the display, `currentPost`, `onNext` and `onPrev`.

**Production change** (commit `fe1e06b92e7703692d38dc00cf09824cbfbfee9b`; `onGalleryClick` only, `:4342–4350`):
- record `wasOpen = BE.modules.viewer.isOpen()` before the takeover attempt;
- in the existing catch, after the existing log, call `BE.modules.viewer.close()` if the viewer was not open before.

`close()` is the existing cleanup. It hides the overlay, clears the media state, stops and releases the media, empties the stage, and clears `currentPost` and `onNext`/`onPrev`. It moves focus only if focus is inside the overlay, which it never is during a takeover. The catch still does not cancel navigation, so the native path proceeds as before.

| Artifact | Value |
| --- | --- |
| Blob | `f2328634aac5d4c597361699f71155f0eb11ac17` |
| Production body SHA-256 | `4fd694e7cb24509953559249c65e3b95e695793e1b250730a108d9bf216d282b` |
| Diff | 7 lines added, 1 changed (the one-line catch became a block: log, a 2-line comment, the guarded `close()`); `wasOpen` added before the attempt |

**Why this is the minimum and stays in scope:**
- **Ordinary-click takeover path only.** The change is in the catch that already owns "takeover failed before open".
- **Successful takeover unchanged.** On success the catch is never entered.
- **Bypass rules unchanged.** The modifier, middle-click and `viewer.enabled` checks return before the attempt.
- **V-D6b untouched.** In-viewer navigation reaches `viewer.open` through `navigateBy` → `openViewerForThumb`, not through `onGalleryClick`, so it keeps its current behavior.
- **`viewer.open` not redesigned.** The `wasOpen` guard keeps the cleanup from closing a viewer the user already had open.

**Forbidden-scope audit.** No change to:
- V-D6b, V-D4, V-D7, focus;
- V-D1, V-D5, V-D8 (preservation only);
- A4, C4, E6, G4;
- playback;
- successful takeover or bypass semantics;
- IB12.

**Permanent regression:** `tests/host/ib11/p4_vd6a_takeover_safe.cjs` **15/15** (result `p4-vd6a-takeover-safe-result.json`).
- **Sources:** each check runs on the repair, the pre-P4 artifact `48e44d9`, and a **mutant** without the guarded `close()`.
- **The seam** is production's own: stored volume 1.5 on a video card, an ordinary click, and the catch logging "[Gallery] viewer takeover failed before open" with an `IndexSizeError`.
- **Diagnosis:** on all three sources the seam threw and navigation was not prevented. On the prior and the mutant the overlay stayed `flex` with post `101` current and an empty stage. On the repair it was `none` with no current post.

| Check | Repair | Prior `48e44d9` | Mutant |
| --- | --- | --- | --- |
| P4-1 [V-D6a] seam threw; navigation not cancelled; no overlay displayed | **true** | **false** | **false** |
| P4-2 [V-D6a] no partial state: no current post, empty stage; the late enrichment is ignored | **true** | **false** | **false** |
| P4-3 [V-D6a] failed shell not active: Escape / ArrowRight / f afterwards not prevented, no action | **true** | **false** | **false** |
| P4-4 successful image takeover: opens, cancelled, card file, no error | true | true | true |
| P4-5 successful video takeover (volume 0.5): opens, volume 0.5, cancelled, no error | true | true | true |
| P4-6 Ctrl / Meta / Shift / Alt / middle clicks native even with the failure armed (no build attempted) | true | true | true |
| P4-7 `viewer.enabled = false`: ordinary click native (no build attempted) | true | true | true |
| P4-8 after a failed takeover, an image card takes over normally | true | true | true |
| P4-9 [out of scope, unchanged] V-D6b: in-viewer ArrowRight onto the failing video still leaves an open, empty viewer | true | true | true |
| P4-10 V-D8 preserved: native link pointer-interactive and hit-tested | true | true | true |
| P4-11 V-D1 preserved: late same-post update keeps the failure state and link | true | true | true |
| P4-12 V-D5 preserved: Ctrl+F / Ctrl+D inert and not prevented; f favorites | true | true | true |
| P4-13 close / cleanup: Escape hides, pauses and releases the video, empties the stage | true | true | true |
| P4-14 playback: Space plays a paused viewer video | true | true | true |
| P4-15 no focus behavior: neither a successful nor a failed takeover moves focus | true | true | true |

**Real-browser qualification: required.** The defect concerns real takeover and native navigation in Chrome. Prepared package `tests/browser/ib11/IB11_P4_VD6A.user.js` (SHA-256 `8c9fd4997617564a7f20d70e7cdf0f66b7cdda106a3e92efe4d823d45ab6c7a2`):
- **Build:** `build_ib11_p4.cjs` from `fe1e06b`; the body is byte-identical (`4fd694e7…282b`).
- **Runner:** the V-VIEW runner **unpatched**. The TAKEOVER page and its VD6A cell are the ones that produced the E-stage V-D6a evidence. The seam is the package recorder's media `volume` setter, which records a throw from `buildMedia`; production is not hooked.
- **Unchanged packages:** V-VIEW, P1, P2 and P3.
- **Server:** `vview_server.cjs --p4` serves the TAKEOVER page (probe `ib11-p4-vd6a`).
- **Evaluator:** `vview_evaluate.cjs --p4`. The verdict is **V-D6a REPAIR QUALIFIED** only if all of these hold:
  - the revision-1.3 VD6A rule gives PASS / BEHAVIOR_OK: a trusted click, the seam threw from `buildMedia`, no overlay shown, and the destination reached;
  - navigation was not cancelled and the page left;
  - right after the failure the overlay is not displayed, the viewer is not open, there is no current post, and the stage is empty (no media, state or link);
  - the overlay is not displayed at page exit;
  - no trusted input fell outside the prompt, and identity is MATCH.

**Local qualification: `verify_ib11_p4.cjs --media` 27/27** (`IB11_P4_VERIFICATION.json`; `IB11_P4_SHA256SUMS.txt`).
- **Static:** fresh build; byte-identical body; unpatched runner; the pinned V-VIEW, P1, P2 and P3 packages unchanged; local scope; recorder seam and armed volume; plan; server `--p4` with arrival.
- **Smoke:** the repair qualifies (seam `IndexSizeError` from `buildMedia`, not cancelled, no shell, arrival).
- **Production faults (NOT QUALIFIED):** the probe on `48e44d9` (DEFECT_CONFIRMED, overlay left `flex` with the failed post current), and the mutant without the cleanup.
- **Evidence faults (NOT QUALIFIED):**
  - untrusted click; no seam; navigation cancelled;
  - overlay state not recorded; overlay displayed; failed post current; stage not empty;
  - overlay displayed at exit; page did not leave; no arrival;
  - trusted input outside a prompt;
  - wrong identity; duplicate attempts; wrong result type.

**Regressions on `fe1e06b`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 67/67 |
| IB11 P1 / P2 / P3 regressions | 6/6, 11/11, 16/16 (V-D8, V-D1, V-D5 preserved) |
| IB11 P4 regression | 15/15 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1 / P2 / P3 package verifiers | 22/23, 22/23, 31/32 |
| IB11 P4 package verifier | 27/27 |
| IB11 E0 characterization | 34/38; fault controls 43/46 |

**Pin, anchor and witness failures (expected; not behavioral):**
- **Blob and working-tree pins,** each superseded by P4:
  - G-PLAY and V-VIEW: `4d793a2`;
  - P1, P2 and P3 verifiers: `039b99e`, `56c495e`, `f2b46eb`;
  - E0 S0: `4d793a2`.
- **E0 A5, the V-D6a defect witness:** it no longer holds because V-D6a is repaired. Measured on the repair: not prevented, overlay not `flex`, no media, no state. This is the expected change.
  - Its two fault controls still count as caught, but only vacuously, because A5's defect oracle no longer holds without them. The P4 regression's mutant is now the sensitive fault control for V-D6a.
- **E0 C3 and G2 (V-D1 and V-D5 witnesses) and the G5 control anchor:** as at P2/P3; unchanged.
- **E0 A6 (V-D6b witness) still holds,** confirming that V-D6b is untouched. So do every other E0 check and every other defect witness (V-D4, V-D7).

Historical result files rewritten by these runs were restored unedited.

**P4 status at the time of the repair:** local qualification and regressions passed; real-Chrome qualification was pending. It is now closed (§8).

**Provenance:** no donor code; all changes are original to this repository (MIT).

## 8. P4 closure: real-Chrome qualification of the V-D6a repair

**Raw result:** `ib11-p4-vd6a.json`, SHA-256 `04e21ce5bcb977e584088785e11fd647e4325c15de8563b908921c489ce56b1c`. Verified; not committed (`.gitignore`); not modified.
- Probe `ib11-p4-vd6a`; package `IB11_P4_VD6A.user.js` (`8c9fd499…c7a2`).
- One attempt, page TAKEOVER.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `4fd694e7…282b`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside the prompt.

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p4 tests/browser/ib10/ib11-p4-vd6a.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D6a REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**VD6A:** evidence **PASS**, finding **BEHAVIOR_OK**.
- **The click:** one trusted ordinary click on the video card.
- **The failure:** the production `buildMedia` volume seam threw `IndexSizeError` with the characterized value 1.5.
- **Navigation:** not cancelled (`defaultPrevented` false). The page navigated, and the controlled native destination recorded the TAKEOVER / VD6A arrival.
- **Right after the failed takeover:** viewer `open` false, overlay `display` none, `currentId` null, 0 stage children, no media, no state text, no native-link shell.
- **At page exit:** overlay `display` none.

**Limitation:** the overlay is measured by the page right after the click and at page exit. How long the old page stays visible before the next page commits is up to the browser.

**Preservation** (local; production unchanged since §7):
- **Successful takeover:** image and video takeovers open normally and cancel navigation (P4-4, P4-5); a takeover after a failed one works (P4-8).
- **Bypass rules:** modifier, middle-click and `viewer.enabled = false` clicks stay native (P4-6, P4-7).
- **P1 / V-D8:** 6/6 and P4-10.
- **P2 / V-D1:** 11/11 and P4-11.
- **P3 / V-D5:** 16/16 and P4-12.
- **Close/cleanup, playback and focus:** unchanged (P4-13 to P4-15).
- **V-D6b:** untouched (P4-9; E0 A6 still witnesses).

**Conclusion:** **P4 / V-D6a: COMPLETE, PASS(scope)** for the qualified TC cell (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture). A synchronous viewer-build failure during an ordinary card-click takeover now leaves no viewer shell or partial state, and the native navigation proceeds to its destination.

**Production:** commit `fe1e06b92e7703692d38dc00cf09824cbfbfee9b`, blob `f2328634aac5d4c597361699f71155f0eb11ac17`, body SHA-256 `4fd694e7cb24509953559249c65e3b95e695793e1b250730a108d9bf216d282b`. This closure is documentation only.

**Remaining frozen P items, all NOT STARTED:**
- V-D4, V-D6b, V-D7;
- focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 9. P5 — V-D6b: communicated failure during in-viewer navigation

**Pre-edit gate (synchronized):**
- HEAD `5520545470665dc6cafe1ca1f94a0791634380d2` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `fe1e06b` / blob `f232863` / body `4fd694e7…282b`.
- No mismatch with the assignment or the Ledger.

**Baseline defect.** E0 A6 (local) and V-VIEW VD6B (real Chrome, `ff2fce48…`): with the viewer open on an image and stored volume 1.5, an in-viewer ArrowRight onto a video card makes `buildMedia` throw `IndexSizeError` synchronously. The viewer stays open on the new target with a blank stage, no failure text and no native link.

**Root cause** (at `fe1e06b`):
- **The call path:** in-viewer navigation goes keydown → `onNext` → `navigateBy` → `openViewerForThumb` → `viewer.open`. `open` sets `currentPost` and `onNext`/`onPrev` to the target, then calls `replaceMedia` (`Booru_Enhancer.user.js:3726`).
- **The failure:** `replaceMedia` stops the old media and empties the stage (`:3683–3684`), and `buildMedia` throws at `el.volume = vol` (`:3637`).
- **The escape:** the exception leaves `open` before `updateStatus` and before any state display, and escapes the keydown handler.
- **The result:**
  - a blank stage with no failure text and no native link;
  - the status still naming the previous post;
  - `mediaEl` still referencing the detached previous element.

**Production change** (commit `24ee7c299d1aac393f3a53f5a8151e423d6ac848`; `replaceMedia` and `open` only):
- **`replaceMedia`** wraps the `buildMedia` call. On a throw it sets `mediaEl = null`. If the caller asked for `rethrowBuildError`, it rethrows. Otherwise it logs "[Viewer] media build failed" and shows the **existing** failure state, `showMediaState('Media failed to load', mediaGeneration, 0, true)`, which carries the current target's native-post link (the V-D8 anchor). It returns without attaching any media.
- **`open`** records `wasOpen = isOpen()` before showing the overlay and passes `rethrowBuildError: !wasOpen`.
  - A takeover from a closed viewer still rethrows, so the P4 / V-D6a gallery cleanup runs unchanged.
  - Navigation inside an open viewer shows the failure. `open` then continues normally: `updateStatus`, `viewer:open`, enrichment.
- **The two `updatePost` → `replaceMedia` rebuilds** use the default, the in-viewer behavior. They only run once a viewer owns the interaction, and this keeps a late enrichment from blanking a communicated failure (P5-4).

| Artifact | Value |
| --- | --- |
| Blob | `68e37d1c9071d2ae78ae44b31f0082cd51010992` |
| Production body SHA-256 | `062227fa23a6b637098cf553b29a543e03bf342240354a61d1f587bd414d9f26` |
| Diff | 15 insertions, 3 deletions |

**Why this keeps V-D6a and V-D6b distinct:**
- **V-D6a** (failure before a takeover is established): the build error still propagates to `onGalleryClick`, which abandons the shell and does not cancel native navigation (P5-8; P4 regression 15/15).
- **V-D6b** (the viewer already owns the interaction): the failure is shown in the viewer on the failing target, with its native link.

**Forbidden-scope audit.** No change to:
- V-D4, V-D7, focus;
- V-D6a, V-D1, V-D5, V-D8 (preservation only);
- A4, C4, E6, G4;
- playback;
- successful navigation;
- IB12.

**Permanent regression:** `tests/host/ib11/p5_vd6b_inviewer_failure.cjs` **15/15** (result `p5-vd6b-inviewer-failure-result.json`).
- **Sources:** each check runs on the repair, the pre-P5 artifact `fe1e06b`, and a **mutant** whose catch always rethrows (the pre-P5 behavior, through the same production path).
- **The seam:** a test-page wrapper of the media `volume` setter records `IndexSizeError` 1.5 thrown from `buildMedia`, the same way on all three sources.
- **Diagnosis:** all three start from a valid open image, and on all three the seam threw and post 102 became current.
  - On the prior and the mutant the stage is blank, with no state and no link, and the status still reads `#101`.
  - On the repair the stage shows "Media failed to load" with a link to `/posts/102`, and the status reads `#102`.

| Check | Repair | Prior `fe1e06b` | Mutant |
| --- | --- | --- | --- |
| P5-1 [V-D6b] valid open image → ArrowRight onto the video; seam throws; open on the target with "Media failed to load" | **true** | **false** | **false** |
| P5-2 [V-D6b] the target's native-post link, pointer-interactive and hit-tested (V-D8 semantics) | **true** | **false** | **false** |
| P5-3 [V-D6b] coherent: no img/video in the viewer, previous image detached, status names the target | **true** | **false** | **false** |
| P5-4 [V-D6b] durable: a late same-post update for the target keeps the failure and link | **true** | **false** | **false** |
| P5-5 after the failure: ArrowLeft back to the image works; Escape closes and cleans up | true | true | true |
| P5-6 successful in-viewer navigation image → image → back unchanged | true | true | true |
| P5-7 successful in-viewer navigation onto a video (volume 0.5) unchanged | true | true | true |
| P5-8 P4 / V-D6a: a failed takeover still abandons the shell; navigation not cancelled | true | true | true |
| P5-9 successful image/video takeover; modifier and disabled clicks native | true | true | true |
| P5-10 P1 / V-D8 native link usable | true | true | true |
| P5-11 P2 / V-D1 durable load-failure state | true | true | true |
| P5-12 P3 / V-D5 modifier guard | true | true | true |
| P5-13 close / cleanup of a video | true | true | true |
| P5-14 playback: Space plays a paused video | true | true | true |
| P5-15 no focus behavior on open or after the in-viewer failure | true | true | true |

**Real-browser qualification: required.** Prepared package `tests/browser/ib11/IB11_P5_VD6B.user.js` (SHA-256 `2f5495a42199ab729501756481b7ae2ec200f7f85b087e3496f888489d15299b`):
- **Build:** `build_ib11_p5.cjs` from `24ee7c2`; the body is byte-identical (`062227fa…9f26`).
- **Runner:** the V-VIEW runner plus declared runner-only patches (`p5_vd6b.js`; NATIVE_R may reuse the open viewer). The V-VIEW and P1–P4 packages are unchanged.
- **Page P5_VD6B** (image card VD6B_A, then the video card NATIVE):
  1. a valid open, loaded image;
  2. stored volume 1.5 armed;
  3. a **trusted** unmodified ArrowRight (the E-stage VD6B cell used a synthetic key; P5 requires a trusted one);
  4. the recorder seam;
  5. the viewer at 50 ms and 1000 ms, the status, the media count in the viewer, the previous image's attachment, and the link's path;
  6. if communicated, the revision-1.3 NATIVE cell on the same viewer: link box, pointer-events chain, hit test, one trusted click, navigation and destination arrival for the failing card.
  - Using a second step on the same open viewer keeps the primary evidence, which is recorded before the click.
- **Server and evaluator:** `vview_server.cjs --p5`; `vview_evaluate.cjs --p5`. The verdict is **V-D6b REPAIR QUALIFIED** only if all of these hold:
  - identity MATCH;
  - a valid start, a trusted ArrowRight, and the seam threw from `buildMedia`;
  - the selection reached the target;
  - at 50 ms and at 1000 ms: open on the target, no stage media, failure text, and the native link to the target's post;
  - no img/video in the viewer, the previous image detached, and the status names the target;
  - NATIVE PASS / BEHAVIOR_OK;
  - no trusted input outside a prompt.

**Local qualification: `verify_ib11_p5.cjs --media` 32/32** (`IB11_P5_VERIFICATION.json`; `IB11_P5_SHA256SUMS.txt`).
- **Static:** fresh build; byte-identical body; runner equals the V-VIEW runner plus exactly the P5 patches; the pinned V-VIEW and P1–P4 packages unchanged; local scope; recorder seam; armed volume after the image is open; trusted unmodified ArrowRight; plan; server `--p5` with arrival.
- **Smoke:** the repair qualifies.
- **Production faults (NOT QUALIFIED):**
  - the probe on `fe1e06b`: blank, stale status, no link to click;
  - the rethrow mutant: blank;
  - V-D8 regressed: the failure is communicated, but NATIVE gives DEFECT_CONFIRMED.
- **Evidence faults (NOT QUALIFIED):**
  - untrusted or modified ArrowRight; no seam; image not loaded;
  - selection not on the target; no text at 50 ms; no link at 1000 ms; link to another post;
  - a media element remaining; previous image attached; stale status;
  - trusted input outside a prompt;
  - untrusted link click; no arrival; NATIVE missing;
  - wrong identity; duplicate attempts; wrong result type.

**Regressions on `24ee7c2`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 67/67 |
| IB11 P1 / P2 / P3 / P4 regressions | 6/6, 11/11, 16/16, 15/15 (V-D8, V-D1, V-D5, V-D6a preserved) |
| IB11 P5 regression | 15/15 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1 / P2 / P3 / P4 package verifiers | 22/23, 22/23, 31/32, 26/27 |
| IB11 P5 package verifier | 32/32 |
| IB11 E0 characterization | 33/38; fault controls 42/46 |

**Pin, anchor and witness failures (expected; not behavioral):**
- **Blob and working-tree pins,** each superseded by P5:
  - G-PLAY and V-VIEW: `4d793a2`;
  - P1, P2, P3 and P4 verifiers: `039b99e`, `56c495e`, `f2b46eb`, `f232863`;
  - E0 S0: `4d793a2`.
- **E0 A6, the V-D6b defect witness:** it **no longer reproduces the old blank state** because V-D6b is repaired. Measured on the repair: open on post 102 with the failure state and link. This is the expected change. Its repair-probe control is caught only vacuously; the P5 regression's mutant is now the sensitive control.
- **E0 A5's repair-probe control** "overlay shown only after media was built" is no longer caught: its anchor (`overlay.style.display = 'flex';` + `replaceMedia(post);`) matches 0 times, because `open` now passes options to `replaceMedia`. It is the repair probe of a witness already repaired at P4, so this is an anchor pin.
- **E0 A5, C3, G2 (repaired at P4, P2, P3) and the G5 control anchor:** as before.
- **Not reached by the repair:** every other E0 check and the remaining defect witnesses (V-D4, V-D7) still pass as before.

Historical result files rewritten by these runs were restored unedited.

**Limitations:**
- The failure text is the existing generic "Media failed to load" (the same text as a load failure).
- The `updatePost` rebuild path shares the in-viewer handling (P5-4).

**P5 status at the time of the repair:** local qualification and regressions passed; real-Chrome qualification was pending. It is now closed (§10).

**Provenance:** no donor code; all changes are original to this repository (MIT).

## 10. P5 closure: real-Chrome qualification of the V-D6b repair

**Raw result:** `ib11-p5-vd6b.json`, SHA-256 `341d4be9b334d9de5e153c18fb1122bc34b31e769b8405f538acee924ac931dc`. Verified; not committed (`.gitignore`); not modified or relocated.
- Probe `ib11-p5-vd6b`; package `IB11_P5_VD6B.user.js` (`2f5495a4…299b`).
- One attempt, page P5_VD6B.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `062227fa…9f26`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside the prompts.

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p5 tests/browser/ib10/ib11-p5-vd6b.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D6b REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**VD6BP5:** evidence **PASS**, finding **BEHAVIOR_OK**.
- **Start:** a valid loaded image on fixture post 8001 (status `#8001`).
- **Navigation:** one trusted, unmodified ArrowRight.
- **Failure:** the `buildMedia` seam threw `IndexSizeError` with the stored value 1.5. The selection moved to the failing fixture post 8002.
- **At 50 ms and at 1000 ms:** the viewer is open on 8002, with no stage media, "Media failed to load", and the `card-post` native link.
- **Coherence:**
  - zero img/video elements in the overlay;
  - the previous image disconnected;
  - the status `#8002`;
  - the link path `/posts/8002` (the failing target).

**NATIVE (revision-1.3 rule, the same viewer after the failure):** evidence **PASS**, finding **BEHAVIOR_OK**.
- Link box x 1296.7, y 605.1, w 101.1, h 16.9.
- Computed `pointer-events` auto.
- `elementFromPoint` at the link centre → the anchor.
- A trusted click at (1326, 620) inside the box targeted the anchor; it was not prevented.
- The page navigated, and the controlled destination recorded the P5_VD6B / NATIVE arrival.

**Preservation** (local; production unchanged since §9):
- **Viewer after the failure:** remains operable; back to the image and close work (P5-5).
- **Successful in-viewer navigation:** image and video (P5-6, P5-7).
- **Successful takeover and bypasses:** P5-9.
- **P1 / V-D8:** 6/6 and P5-10; also the real-Chrome NATIVE above.
- **P2 / V-D1:** 11/11 and P5-11.
- **P3 / V-D5:** 16/16 and P5-12.
- **P4 / V-D6a:** 15/15 and P5-8 (a failed takeover still abandons the shell and does not cancel navigation).
- **Close/cleanup, playback and focus:** unchanged (P5-13 to P5-15).

**Limitation:** the failure text is the existing generic "Media failed to load".

**Conclusion:** **P5 / V-D6b: COMPLETE, PASS(scope)** for the qualified TC cell (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture). A synchronous media-build failure during navigation inside an open viewer is now communicated on the failing target, with a usable native-post link, instead of a blank stage.

**Production:** commit `24ee7c299d1aac393f3a53f5a8151e423d6ac848`, blob `68e37d1c9071d2ae78ae44b31f0082cd51010992`, body SHA-256 `062227fa23a6b637098cf553b29a543e03bf342240354a61d1f587bd414d9f26`. This closure is documentation only.

**Remaining frozen P items, all NOT STARTED:**
- V-D4, V-D7;
- focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 11. P6 — V-D4: configured Fit uses the rendered orientation

**Pre-edit gate (synchronized):**
- HEAD `46084ba452801d2f42341354a015ab54882794c3` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `24ee7c2` / blob `68e37d1` / body `062227fa…9f26`.
- No mismatch with the assignment or the Ledger.

**Baseline defect.** E0 E5 (local) and V-VIEW VD4 (real Chrome, `ff2fce48…`): a 2000×1000 image is fitted correctly unrotated, then rotated 90° with the viewer control. After a real resize, the automatic configured Fit scales it for the unrotated box, and the rotated image exceeds the available stage height.

**Root cause** (at `24ee7c2`): `configuredFitScale()` (`Booru_Enhancer.user.js:3482`) divides the available stage (stage − 24 px per axis) by the **unrotated** `intrinsicSize()`. The rendered footprint at an odd quarter turn has width and height exchanged; `canPan()` (`:3534–3537`) already accounts for this. The resize handler (`:3426–3428`) calls `applyConfiguredFit()` whenever not in manual zoom.

**Production change** (commit `39a5ae126f573a04a10963287581b2c5704df890`; `configuredFitScale` only):
- it takes `intrinsicSize()`;
- it computes `quarterTurns = Math.abs(Math.round(rotation / 90)) % 2`, the same rule as `canPan()`;
- it uses the exchanged width and height when `quarterTurns` is 1.

The mode logic (fit-both / fit-width / fit-height / original-size) is unchanged and now applies to the rendered orientation.

| Artifact | Value |
| --- | --- |
| Blob | `0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6` |
| Production body SHA-256 | `d445d442a9e937186de4d99eea9a958252d9850dcba272a8b5448d364333b439` |
| Diff | 5 insertions, 1 deletion |

**Forbidden-scope audit.** No change to:
- the Fit button (E6: it still resets rotation and flips, then fits);
- rotation or flip controls, manual zoom, pan;
- whether rotation triggers a refit (it does not);
- V-D7, focus;
- V-D1, V-D5, V-D6a/b, V-D8 (preservation only);
- A4, C4, G4;
- playback, the viewer architecture, IB12.

**Permanent regression:** `tests/host/ib11/p6_vd4_rotated_fit.cjs` **15/15** (result `p6-vd4-rotated-fit-result.json`).
- **Sources:** each check runs on the repair, the pre-P6 artifact `24ee7c2`, and a **mutant** that restores rotation-blind dimensions.
- **Method:** rotation uses the viewer buttons, and the refit is production's window-resize handler. Every expected scale is computed from the stage, the natural size and the rotation by one stated rule; there is no fixture constant.
- **Diagnosis** (2000×1000, fit-both, 90°, stage 1000×800, available 976×776):
  - repair: scale 0.388, rotated footprint 388×776 (inside);
  - prior and mutant: scale 0.488, footprint 488×976 (976 > 776, overflow).

| Check | Repair | Prior `24ee7c2` | Mutant |
| --- | --- | --- | --- |
| P6-1 [V-D4] fit-both 90°: exchanged dimensions; footprint inside | **true** | **false** | **false** |
| P6-2 [V-D4] fit-both 270° (3 right), −90° (1 left), −270° (3 left) | **true** | **false** | **false** |
| P6-3 [V-D4] fit-width 90°: rendered width (= intrinsic height) fills the width | **true** | **false** | **false** |
| P6-4 [V-D4] fit-height 90°: rendered height (= intrinsic width) fills the height | **true** | **false** | **false** |
| P6-5 [V-D4] two successive resizes at 90° (1000×800, 1400×700) | **true** | **false** | **false** |
| P6-6 [V-D4] portrait 1000×2000 at 90° (not only the landscape fixture) | **true** | **false** | **false** |
| P6-7 0°: all four modes equal the unrotated calculation | true | true | true |
| P6-8 180°: all four modes equal the unrotated calculation (no exchange) | true | true | true |
| P6-9 original-size stays 1:1 at 90° and 270° | true | true | true |
| P6-10 initial open fits the unrotated image | true | true | true |
| P6-11 rotating alone does not refit | true | true | true |
| P6-12 manual zoom and a real pan (30, 10) survive a rotated resize | true | true | true |
| P6-13 flips kept through a rotated refit | true | true | true |
| P6-14 E6 unchanged: Fit resets rotation and flips, then fits unrotated | true | true | true |
| P6-15 opening another post resets rotation and fits unrotated | true | true | true |

**Preservation of P1–P5 and viewer behavior:** their permanent regressions run unchanged against the new production:
- P1 (V-D8): 6/6;
- P2 (V-D1): 11/11;
- P3 (V-D5): 16/16;
- P4 (V-D6a): 15/15;
- P5 (V-D6b): 15/15.

Between them these cover successful takeover and navigation, close/cleanup, playback and focus.

**Real-browser qualification: required** (a visual geometry defect). Prepared package `tests/browser/ib11/IB11_P6_VD4.user.js` (SHA-256 `77f233fe68de1a88b6807a7ddbb0fe646ff5ad07a40fc53189b0bf0aea381055`):
- **Build:** `build_ib11_p6.cjs` from `39a5ae1`; the body is byte-identical (`d445d442…b439`).
- **Runner:** the V-VIEW runner plus declared runner-only patches (`p6_vd4.js`). The V-VIEW and P1–P5 packages are unchanged.
- **Page P6_VD4:** the V-VIEW VD4 steps on the loaded 2000×1000 `wide` fixture:
  1. fit-both, with the unrotated fit measured;
  2. the viewer's own "Rotate right" control;
  3. two **trusted** resizes (F11 in, F11 out), with stage and rendered-media rectangles after each;
  4. the viewer kept open for one operator screenshot (Windows+PrtScn, confirmed with a trusted Enter; no page click, so the stage-close behavior is not triggered), then measured again.
- **Evaluator:** `vview_evaluate.cjs --p6`. The verdict is **V-D4 REPAIR QUALIFIED** only if all of these hold:
  - the revision-1.3 VD4 rule gives PASS / BEHAVIOR_OK: trusted resizes, fit-both, the fixture complete at 2000×1000, non-zero rectangles, unrotated fit inside, `rotate(90deg)` after each resize, and no overflow beyond the stage;
  - after each resize the rotated media lies within the Fit area (stage − 24 px per axis, 2 px rounding tolerance);
  - the two resizes produced different stages, and the control applied the rotation;
  - the screenshot step completed with the rotated fit on screen;
  - no trusted input fell outside a prompt, and identity is MATCH.
- **Visual evidence:** one screenshot of the repaired rotated fit, returned by the operator as `tests/results/ib11-p6-vd4.png` (git-ignored). Its SHA-256 is recorded at closure. Automatic capture is not available to a userscript.

**Results-path convention, implemented with P6:**
- `vview_server.cjs --p6` writes `tests/results/ib11-p6-vd4.json` by default and creates the folder if it is missing.
- `.gitignore` ignores `tests/results/*` except the tracked `tests/results/README.md`, which documents the folder.
- The runbook and evaluator use that path.
- P1–P5 evidence is not moved.

**Local qualification: `verify_ib11_p6.cjs --media` 30/30** (`IB11_P6_VERIFICATION.json`; `IB11_P6_SHA256SUMS.txt`).
- **Static:** fresh build; byte-identical body; runner equals the V-VIEW runner plus exactly the P6 patches; the pinned V-VIEW and P1–P5 packages unchanged; local scope; the cell steps; plan; results path ignored with a tracked README; the server's default output path.
- **Server:** `--p6` probe with the wide fixture dimensions.
- **Smoke:** the repair qualifies.
- **Production faults (NOT QUALIFIED):** the probe on `24ee7c2` (rotated media exceeds the stage after both resizes), and the rotation-blind mutant.
- **Evidence faults (NOT QUALIFIED):**
  - untrusted resize; wrong fit mode; incomplete fixture; zero rectangle;
  - rotation missing after a resize; rotation not applied by the control;
  - overflow beyond the stage; overflow beyond the Fit area only; stage unchanged by the resizes;
  - trusted input outside a prompt;
  - screenshot step missing, untrusted, or without the rotated fit;
  - wrong identity; duplicate attempts; wrong result type.

**Regressions on `39a5ae1`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 67/67 |
| IB11 P1–P5 regressions | 6/6, 11/11, 16/16, 15/15, 15/15 |
| IB11 P6 regression | 15/15 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1–P5 package verifiers | 22/23, 22/23, 31/32, 26/27, 31/32 |
| IB11 P6 package verifier | 30/30 |
| IB11 E0 characterization | 32/38; fault controls 41/46 |

**Classification:**
- **Superseded artifact/blob pins:**
  - G-PLAY and V-VIEW: `4d793a2`;
  - P1–P5 verifiers: `039b99e`, `56c495e`, `f2b46eb`, `f232863`, `68e37d1`;
  - E0 S0: `4d793a2`;
  - IB07 `item9`/`pagecount`.
- **V-D4 witness change caused by the repair (intended):** E0 E5 no longer reports overflow. Measured on the repair: scale 0.388, rotated height 776 = the 776 px available, `rotate(90deg)`. Its repair-probe control ("fit uses the rotated box") no longer finds its anchor, which the repair replaced.
- **Already-known witness flips and anchor failures:** A5, A6, C3 and G2 (repaired at P4, P5, P2 and P3); the A5-probe, C3-probe, G2-probe and G5 control anchors.
- **Behavioral regressions:** none. Every other E0 check, including E4 and E6, and the remaining V-D7 witness still pass as before.

Historical result files rewritten by these runs were restored unedited.

**Limitations:**
- The screenshot is operator-captured (Windows+PrtScn); the evaluator cannot inspect it, so its hash is recorded at closure.
- Rotation-aware Fit applies wherever configured Fit is computed: resize refit, image readiness and the Fit button. The Fit button resets rotation first (E6), so its result is unchanged.

**P6 status at the time of the repair:** local qualification and regressions passed; real-Chrome qualification was pending. It is now closed (§12).

**Provenance:** no donor code; all changes are original to this repository (MIT).

## 12. P6 closure: real-Chrome qualification of the V-D4 repair

**Raw result:** `tests/results/ib11-p6-vd4.json`, SHA-256 `a8663e3472b1ef92466d3191f7fd461b6a0e719cf0eb0c9eef4c15e818d08be5`. The first raw result under the `tests/results/` convention. Verified; git-ignored, not committed; not modified.
- Probe `ib11-p6-vd4`; package `IB11_P6_VD4.user.js` (`77f233fe…1055`).
- One attempt, page P6_VD4.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `d445d442…b439`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside the prompts.

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p6 tests/results/ib11-p6-vd4.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D4 REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**VD4:** evidence **PASS**, finding **BEHAVIOR_OK**.
- **Start:** the loaded fixture at 2000×1000; Fit mode `fit-both`; unrotated fit inside the stage (stage 1920×851, image 1654×827).
- **Rotation:** applied by the viewer's Rotate right control; `rotate(90deg)` present after both resizes and at the screenshot step.
- **Resizes:** both prompted resizes trusted. The window logged three trusted resize events during the F11 transitions (2560×1215, 2560×1272, 2560×1440).

| Measurement | Stage | Fit area (stage − 24) | Rotated media | Overflow |
| --- | --- | --- | --- | --- |
| After resize 1 | 2560×1227 | 2536×1203 | 602×1203 | none (12 px margin top and bottom) |
| After resize 2 | 2560×1395 | 2536×1371 | 686×1371 | none (12 px margin top and bottom) |

- **Fit:** the rotated height equals the available Fit height in both states, which is the exchanged-dimension fit-both.
- **Screenshot step:** the confirmation Enter was trusted, and the rotated fit (scale 0.6855, `rotate(90deg)`) was still on screen.

**Supplemental visual evidence (not committed):** `tests/results/ib11-p6-vd4.png`, SHA-256 `c579e5d2a663483f4a40a6997c0cca7c9b92f69d2494af928466001d81690d67` (the operator's archived file; a re-encoded copy with different bytes is not authoritative).
- **What it shows:** on the display running the viewer, the fixture image rotated upright (vertical), fully contained within the viewer stage, with the P6 screenshot prompt above it.
- **Privacy:** it is a full multi-monitor capture that also shows unrelated desktop content. It must remain private and uncommitted; `tests/results/*` is git-ignored. It is described here only by its viewer region.

**Preservation** (local; production unchanged since §11):
- **Fit modes:** all four at 0° and 180° unchanged; original-size 1:1 (P6-7 to P6-9); the initial fit unchanged (P6-10).
- **Manual transforms:** manual zoom and a real pan survive a resize without refit (P6-12); rotating alone does not refit (P6-11); flips are kept (P6-13).
- **E6 unchanged:** the Fit button still resets rotation and flips, then fits unrotated (P6-14). Opening another post still resets rotation (P6-15).
- **P1–P5:** regressions 6/6, 11/11, 16/16, 15/15, 15/15 on this production (V-D8, V-D1, V-D5, V-D6a, V-D6b). They cover successful takeover and navigation, close/cleanup, playback and focus.

**Conclusion:** **P6 / V-D4: COMPLETE, PASS(scope)** for the qualified TC cell (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture). Automatic configured Fit now fits the rendered orientation: a 90°-rotated image stays within the stage across real browser resizes.

**Production:** commit `39a5ae126f573a04a10963287581b2c5704df890`, blob `0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6`, body SHA-256 `d445d442a9e937186de4d99eea9a958252d9850dcba272a8b5448d364333b439`. This closure is documentation only.

**Remaining frozen P items, all NOT STARTED:**
- V-D7;
- focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 13. P7 — V-D7: staged image placeholder, then a ready upgrade that keeps the apparent view

**Pre-edit gate (synchronized):**
- HEAD `e9219c648b275bc3d4df6c85bf582a608908b470` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `39a5ae1` / blob `0a7f57f` / body `d445d442…b439`.
- No mismatch with the assignment or the Ledger.

**Baseline defect:**
- **V-D7:** E0 B1 (local) and V-VIEW VD7 (real Chrome, `ff2fce48…`). An image target's single `<img>` pointed straight at the original (`buildMedia`, `Booru_Enhancer.user.js:3678` at `39a5ae1`). A slow original left the viewer without a usable placeholder; the early media was the slow original.
- **E4 (owner decision P1: keep the apparent view):** a same-post in-place upgrade (`updatePost`, `:3786`) kept the raw zoom. A 300×150 → 3000×1500 upgrade therefore appeared 10× larger.

**Source-selection rule** (`stagedPlaceholderUrl`, image targets only):
- **When it applies:** only when the full URL is the target's own `originalUrl` (so not for metadata-pending targets).
- **What it chooses:** a non-video `sampleUrl` distinct from the original, else a non-video `previewUrl` distinct from it; otherwise no staging, and the original loads directly as before.
- **Sources:** the values come from the selected target's own post data (cached card data). Nothing is fetched or invented, and another post's image is never used.

**Staging and upgrade lifecycle** (per element, `el.__beStage`):
1. **`placeholder`:** the element opens on the placeholder. Its load is ordinary readiness (configured Fit when not manual).
2. **`upgrading`:** once the placeholder is displayed, the original is requested **in place** (`el.src = original`). The browser keeps the current image displayed while a new source is pending, then switches and fires `load` in one task, so there is no blank stage.
3. **Upgrade:** at the original's `load`, `onMediaUpgraded` runs.
4. **`restored`:** if the original fails, the placeholder is restored (`el.src = placeholder`) and "Full image failed to load" is shown with the target's native-post link. This is the existing failure state; V-D8 makes the link pointer-usable, and V-D1 keeps it durable. The restored load only re-renders and does not clear the state.
5. **`direct`:** if the placeholder itself fails, the original is loaded directly. A failure of that load is the ordinary "Media failed to load" with the native link.
6. **Same-post enrichment upgrades** of an image that is already displayed follow the same `upgrading` path. A not-yet-displayed or failed element is still swapped directly, exactly as before (P2-4, P2-5 semantics).
7. **Guards:** every step checks `el === mediaEl && generation === mediaGeneration`. A closed viewer or another target ignores late readiness.

**Transform and apparent-view rule** (`onMediaUpgraded`):
- `zoom *= min(placeholderW / fullW, placeholderH / fullH)`, using the displayed sizes before and after.
- Pan (the `translate()` offset in screen pixels), rotation, flips and the manual/fit mode are kept.
- Configured Fit is **not** invoked at the upgrade.
- A later real resize still refits a non-manual view, rotation-aware since P6.
- For a same-aspect placeholder the rendered size is identical. For a different aspect ratio, the existing transform model cannot keep both dimensions, so the bounded rule keeps the upgraded image within the placeholder's footprint (the smaller ratio). This is recorded as a limitation for designer review.

**Production change** (commit `b856a623d02581f89f50938bfd1f30590267708e`):
- `stagedPlaceholderUrl` and `onMediaUpgraded` (new, `:3620`, `:3632`);
- the image branch of `buildMedia` (`:3691–3729`);
- the image branch of `updatePost` (`:3838–3850`).

| Artifact | Value |
| --- | --- |
| Blob | `b88af3817e8aa3a813272a30115204f39854d58c` |
| Production body SHA-256 | `8c964f02b72c133a40bc5d51df295eb91e6f0ee1f73c2dcf6ac2a09dcacc0ad5` |
| Diff | 66 insertions, 3 deletions |

**Forbidden-scope audit.** No change to:
- focus or dialog/ARIA;
- E6 (the Fit button still resets);
- A4, C4, G4;
- playback policy;
- video staging (video targets are never staged, and their poster and loading behavior are unchanged);
- download/favorite, IB12;
- any generalized rendition framework.

**Permanent regression:** `tests/host/ib11/p7_vd7_staged_placeholder.cjs` **26/26** (result `p7-vd7-staged-placeholder-result.json`).
- **Sources:** each check runs on four sources:
  - the repair;
  - the pre-P7 artifact `39a5ae1`;
  - the **no-placeholder** mutant (direct original restored);
  - the **raw-zoom** mutant (the upgrade keeps the numeric zoom: the apparent-size jump).
- **Harness:** it models the browser's pending-request rule (the displayed size changes only when a load completes). Apparent geometry is the displayed size × zoom, exchanged at odd quarter turns, plus the pan offset.

| Check | Repair | Prior | No-placeholder | Raw-zoom |
| --- | --- | --- | --- | --- |
| P7-1 opens on the target's own distinct sample; one media; right target | true | **false** | **false** | true |
| P7-2 placeholder shown, original requested in place but not presented early | true | **false** | **false** | true |
| P7-3 non-manual upgrade: same element, same apparent size and position | true | **false** | **false** | **false** |
| P7-4 no configured refit at the upgrade (stage changed silently) | true | **false** | **false** | **false** |
| P7-5 a later real resize still refits a non-manual view | true | **false** | **false** | true |
| P7-6 manual zoom, pan, rotation, both flips survive in apparent screen space | true | **false** | **false** | **false** |
| P7-7 close before the original is ready: closed and inert | true | **false** | **false** | true |
| P7-8 navigation away before the old original is ready: new target untouched | true | **false** | **false** | true |
| P7-9 original fails: placeholder restored, "Full image failed to load", pointer-usable native link | true | **false** | **false** | true |
| P7-10 enrichment upgrade 300×150 → 3000×1500 (E4): same element, no 10× jump | true | **false** | true | **false** |
| P7-24 staged failure durable under a late same-post update (V-D1) | true | **false** | **false** | true |
| P7-25 staged failure link hit-tested; click not prevented; viewer stays open (V-D8) | true | **false** | **false** | true |
| P7-26 failing placeholder → direct original; its failure is the ordinary state + link | true | **false** | **false** | true |
| P7-11 to P7-23 preservation (below) | true | true | true | true |

**Preservation checks (P7-11 to P7-23):**
- no distinct placeholder → direct load;
- metadata-pending → sample with "Loading media…";
- video poster and "Loading video…";
- ordinary image failure and native link (V-D8);
- V-D1, V-D5, V-D6a, V-D6b;
- P6 rotation-aware Fit and all four Fit modes;
- manual zoom/pan across a resize, and E6;
- in-viewer navigation and close;
- playback (Space plays; close releases);
- focus unchanged.

**Closed P1–P6 regressions and the E0 characterization: staging attribution.** Their checks open a card and assert that the displayed media **is** the original file, or they simulate "the image failed" by firing one `error` on the opened element, which is now the placeholder. Those assertions no longer model the lifecycle. They were **not edited**.

`tests/host/ib11/p7_staging_attribution.cjs` runs each suite unmodified, as-is and again with **only** the placeholder selection disabled (`p7_neutral_staging_preload.cjs`), and restores their result files byte for byte. **7/7 attributed.**

| Suite | As-is | Staging neutralized | Failures attributed to staging |
| --- | --- | --- | --- |
| P1 (V-D8) | 1/6 | 6/6 | P1-1, P1-2, P1-3, P1-4, P1-6 |
| P2 (V-D1) | 6/11 | 11/11 | P2-1, P2-2, P2-3, P2-6, P2-11 |
| P3 (V-D5) | 14/16 | 16/16 | P3-14, P3-15 |
| P4 (V-D6a) | 12/15 | 15/15 | P4-4, P4-10, P4-11 |
| P5 (V-D6b) | 11/15 | 15/15 | P5-1, P5-6, P5-10, P5-11 |
| P6 (V-D4) | 15/15 | 15/15 | none |
| E0 characterization | 27/38 | 31/38 (exactly the pre-P7 set S0, A5, A6, C3, E5, G2 plus E4) | A1, B1, C1, D1 |
| IB10 P-stage (run separately) | 64/67 | 67/67 | the three "IB09 still-image class … hover timelines identical to b9d133c" checks (their viewer sequence now requests the sample first) |

The behaviors those failing checks guarded are re-asserted on the **staged** path in the P7 regression:
- V-D8: P7-9, P7-25;
- V-D1: P7-24;
- V-D6b: P7-18;
- the takeover and navigation targets: P7-1, P7-8, P7-21.

**Real-browser qualification: required** (apparent screen geometry). Prepared package `tests/browser/ib11/IB11_P7_VD7.user.js` (SHA-256 `da6b9f8896fa20e544d332523fe745fefdbdac1e9e4686a92f27de82f97d798a`):
- **Build:** `build_ib11_p7.cjs` from `b856a62`; the body is byte-identical (`8c964f02…0ad5`).
- **Runner:** the V-VIEW runner plus declared runner-only patches (`p7_vd7.js`). The V-VIEW and P1–P6 packages are unchanged.
- **Simulator:** `vview_sim.cjs` now models the browser's pending-request rule. All earlier package verifiers still pass apart from their superseded pins.
- **Page P7_VD7 (automatic, no prompts, real layout):**
  - **P7STAGE:** VD7P → ArrowRight → VD7.
    - At 300 ms and 1000 ms: the viewer is open on VD7 with exactly one media element showing **VD7's own** thumb (first source VD7-thumb, 160×80, non-zero area), and the original pending (not complete; the upgrade comes later).
    - No blank animation frame once displayed.
    - The upgrade, measured inside the original's own load: the complete 1600×800 original on the same element and target.
    - Rendered geometry before the upgrade, at it and 500 ms after: within max(2 px, 0.5 %) in size and 2 px at the centre. No state text.
  - **P7XFORM:** on VD7X's displayed thumb, the viewer controls apply Rotate right, Flip horizontal, Flip vertical and Zoom out ×2 (a manual zoom by the viewer's clamp rule; Zoom in is capped at 8), plus a pan.
    - At the upgrade and 500 ms after: the same rotation, flips and pan, the scale × 160/1600, the same rendered geometry, and no blank frame.
- **Evaluator:** `vview_evaluate.cjs --p7`; the verdict is **V-D7 REPAIR QUALIFIED** only if both cells are PASS / BEHAVIOR_OK.
- **Screenshot:** not required, because apparent-view continuity is measured from layout geometry. None is requested.

**Local qualification: `verify_ib11_p7.cjs --media` 37/37** (`IB11_P7_VERIFICATION.json`; `IB11_P7_SHA256SUMS.txt`).
- **Static:** fresh build; byte-identical body; exact patches; pinned packages unchanged; scope; automatic page with the upgrade measured in the original's own load; plan; results path ignored; the simulator's pending model.
- **Server:** `--p7` with distinct thumbs.
- **Smoke:** the repair qualifies.
- **Production faults (NOT QUALIFIED):**
  - `39a5ae1`: the slow original is the early media;
  - the no-placeholder mutant: the same;
  - the raw-zoom mutant: staging intact, ×10 geometry jump in both cells.
- **Evidence faults (21, all NOT QUALIFIED):**
  - the previous target not shown first; early media from another post, or the original; original already complete; wrong target; two media; a blank frame;
  - no upgrade; upgrade on a different element; geometry jump; state text left;
  - rotation, flip or pan lost; raw scale kept; drift at 500 ms; transforms after completion;
  - trusted input; wrong identity; duplicate attempts; wrong result type.

**Regressions on `b856a62`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 64/67; the 3 failures staging-attributed (67/67 neutralized) |
| IB11 P1–P5 regressions | 1/6, 6/11, 14/16, 12/15, 11/15; every failure staging-attributed (all full passes neutralized) |
| IB11 P6 regression | 15/15 |
| IB11 P7 regression | 26/26 |
| IB11 staging attribution | 7/7 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1–P6 package verifiers | 22/23, 22/23, 31/32, 26/27, 31/32, 29/30 |
| IB11 P7 package verifier | 37/37 |
| IB11 E0 characterization | 27/38; fault controls 39/46 |

**Classification:**
- **Superseded artifact/blob pins:**
  - G-PLAY and V-VIEW: `4d793a2`;
  - P1–P6 verifiers: `039b99e`, `56c495e`, `f2b46eb`, `f232863`, `68e37d1`, `0a7f57f`;
  - E0 S0;
  - IB07 `item9`/`pagecount`.
- **Intended witness flips:**
  - **E0 B1 (V-D7)** no longer reports direct-original/no-placeholder behavior: the opened media is the target's sample.
  - **E0 E4** no longer reports the raw-scale 10× jump: the scale is rescaled and the apparent size is kept.
- **E3 remains valid:** rotation and flip survive the same-element upgrade (it passes).
- **Staging-attributed (not behavioral regressions; attribution above):** E0 A1, C1, D1; P1–P5 as listed; IB10's three timeline checks.
- **E0 fault controls 39/46:**
  - **New anchor pins:** D2 "readiness guard removed" (its anchor now also opens `onMediaUpgraded`, so it matches twice) and D4 "URL changes not applied in place" (the branch was restructured). Re-anchored once in a temporary copy, both are **caught** (41/46).
  - **Remaining uncaught (known from earlier P items):** the A5, C3, E5 and G2 repair-probe anchors, and G5.

Historical result files rewritten by these runs were restored unedited.

**Limitations:**
- **Aspect ratio:** for a placeholder whose aspect ratio differs from the original's, only one dimension can be preserved, so the upgraded image stays within the placeholder footprint. This is for designer review.
- **Sequential loading:** the original is requested only after the placeholder is displayed, so a target whose placeholder loads slowly starts its original later.
- **Background download:** a superseded original (viewer closed, target changed) keeps downloading under browser control; its readiness is ignored.
- **Closed regressions:** the P1–P5 regressions and parts of E0 no longer model the staged lifecycle for their opening-source and single-error assumptions. They are kept unedited; P7 and the attribution tool carry the evidence.

**P7 status: PARTIAL, NOT COMPLETE.** The production repair is committed, and the local qualification, attribution and regressions pass as classified. **Real-Chrome qualification is PENDING.** The operator step is in `tests/browser/ib11/README.md`, "IB11-P7".

**Provenance:** no donor code; all changes are original to this repository (MIT).

## 14. P7 attempt 1 (NOT QUALIFIED) and the correction

**Attempt 1 raw result:** `tests/results/ib11-p7-vd7.json`, SHA-256 `b28fbf3db1f5dcbe14f2f3f69d71c84d758469679b8f1ede1bd015d7660b72d2`. Valid evidence, kept unmodified and not committed.
- Package `da6b9f88…` (production `b856a62`).
- Chrome 154 / Windows / Tampermonkey 5.5.0; identity MATCH; `error: null`.
- `vview_evaluate.cjs --p7`: exit 1, **NOT QUALIFIED** (P7STAGE and P7XFORM evidence PASS, both DEFECT_CONFIRMED).

**What real Chrome established** (stage 2560×1227):
- **A pending in-place `src` reads 0×0.** Once production assigned the slow original to the `<img>` showing the placeholder, Chrome kept painting the placeholder but reported `naturalWidth`/`naturalHeight` 0, `complete` false, and the original as the `src`. At 300 ms and 1000 ms the target was 8002, the first rendition was `VD7-thumb`, and the rendered rectangle was 240.6×120.3 at transform scale 1.50375.
- **The placeholder was misfitted.** Scale 1.50375 fits the 1600×800 original, not the 160×80 placeholder. The frame queued at open (`replaceMedia`'s `requestAnimationFrame` fit) ran after the placeholder's load handler had already switched `src`. `intrinsicSize()` therefore fell back to the post's 1600×800 metadata, and the painted placeholder shrank about 10×.
- **The progressive original replaced the placeholder early.** From about 1.5 s (the fixture's header delay; `firstShownMs` 1524) the element reported `naturalWidth` 1600 before completion, with a 2406×1203 layout box. Chrome painted the progressively loading original from then on.
- **The upgrade shrank the original.** At completion `onMediaUpgraded` multiplied the (misfitted) scale by 0.1, leaving the full image at 240.6×120.3.
- **Images already loaded in the document are reused.** Each thumb was requested from the server exactly once, although the card and the viewer placeholder both used it (and despite `Cache-Control: no-store`). `VD7-slow` was requested 3 ms after the in-viewer navigation.
- **The probe also had a measurement fault.** P7XFORM waited for `naturalWidth === 160`, a state Chrome never reports once the original is pending. So `phOk` was false, the transforms landed after the original had completed (fitted state 1600×800, `earlyComplete` true), and `beforeUpgrade` was null.

**Correction (production, P7 only)** (commit `7e4c643b018794ba1026f42faa4109ebda5a548c`):
- **Why not only an intrinsic-size fallback:** that would have fixed the misfit, but not the progressive replacement at header time.
- **Detached preload:** `startFullPreload` downloads the original in a detached `<img>`. The displayed placeholder element (its `src`, natural size and painted box) stays untouched. The frame queued at open therefore fits the placeholder's real size.
- **Swap when ready:** after the preload's `load` and `decode()`, `swapToFull` assigns the original to the displayed element. Chrome reuses the image just loaded in the document, so the switch is synchronous, and `onMediaUpgraded` rescales in the same task. The apparent view is kept with no intermediate frame, and configured Fit is not invoked.
- **Refetch fallback:** if a browser did not reuse the image, the element would pend; the rescale is then applied at its `load`.
- **Failure:** a failed preload keeps the placeholder untouched and shows "Full image failed to load" with the native link (the restore step is no longer needed). A failing placeholder still falls back to a direct load.
- **Enrichment:** same-post enrichment upgrades of a displayed image use the same preload.
- **Unchanged:** guards (element, generation, stage object, current preload); the source-selection rule; metadata-pending, video and no-placeholder targets.

| Artifact | Value |
| --- | --- |
| Blob | `5da8fd9d69a65af6009fed66a0874bb8b96ce64b` |
| Production body SHA-256 | `822a5a20e1a387340618c08267b8bd7a09b2bf1ce0ab463ad371a99a4b37780d` |
| Diff vs `b856a62` | 52 insertions, 23 deletions (image branch of `buildMedia`, the enrichment branch of `updatePost`, new `startFullPreload` / `swapToFull`) |

**Regression rewritten to Chrome's measured image semantics:** `tests/host/ib11/p7_vd7_staged_placeholder.cjs` **29/29**.
- **Image model:**
  - an image already loaded in the document is reused synchronously (load queued at 0 ms);
  - a fetched `src` reads 0×0 with the painted box retained;
  - the header switches to the progressive original;
  - frames run after queued loads;
  - the sample may be cached or fetched.
- **Sources:** the repair, `39a5ae1`, the **first-attempt `b856a62`**, the no-placeholder and raw-zoom mutants, and an **in-place** mutant (the detached preload removed; the original assigned to the displayed element at once).
- **Chrome-semantics checks:** the existing staging and apparent-view assertions are kept, and new checks are added:
  - P7-2: a cached placeholder is still the placeholder, fitted for itself, after the queued frame;
  - P7-27: the same for an uncached placeholder;
  - P7-29: no progressive original is painted while it downloads;
  - P7-28: the refetch fallback keeps the view.
  - All of them fail on `b856a62` and on the in-place mutant.
- **The other mutants:** the staging checks fail on `39a5ae1` and the no-placeholder mutant; the apparent-view checks fail on the raw-zoom mutant. 13 preservation checks hold on all six sources.

**Staging attribution (re-run on `7e4c643`): 7/7.** The neutral preload now also disables the enrichment preload, so it is the repair minus all staging. Closed P1–P5 regressions as before: 1/6, 6/11, 14/16, 12/15, 11/15 as-is; all full passes neutralized. P6 15/15 both ways. In E0:
- **Neutralized:** it fails exactly the pre-P7 set S0, A5, A6, C3, E5, G2.
- **As-is, staging-attributed:** A1, B1, C1, D1 and **E3**. E3's harness never completes a detached preload, so its same-element upgrade cannot occur.
- **E4 passes as-is** for the same reason (its harness cannot observe the upgrade). That is not evidence of a jump; the apparent-view repair is proven by P7-3, P7-6 and P7-10 and by the browser P7XFORM cell.
- **IB10:** 64/67 as-is, 67/67 neutralized.

**Browser probe corrections (second package, `IB11_P7_VD7.user.js`, SHA-256 `2fee6862a9f6c540cf8dcdfd8be5ecc19cfec5b0892bf8e10a38f31f7f6251ab`):**
- **Fixture:** VD7X now has an 800×400 placeholder (`mid`), served by the fixture server. A zoomed thumb is capped at 8×, which left no reliable pan room. This also gives an uncached placeholder (VD7's thumb is the page's own card thumbnail) and a 2× upgrade next to the 10× one.
- **No `naturalWidth` waits:** the retained placeholder is the conjunction of:
  - the right target and exactly one viewer media element;
  - the target's placeholder as the first rendition;
  - not the completed original;
  - a non-zero real layout rectangle at the fitted footprint of the placeholder in the measured stage.
- **Frame watcher:** a painted element counts as visible by its layout rectangle (not by `naturalWidth`). Every frame records the last painted placeholder state and the first painted full-image state, and these two painted states are compared. A DOM state that was never painted is not used.
- **P7XFORM:** it waits for the retained-placeholder state, then applies the transforms (the pan via pointer events, which needs the placeholder to exceed the stage). The evaluator requires the transforms to be in place before completion (fixture streaming log) and held in the last painted placeholder frame.
- **Simulator** (`vview_sim.cjs`): models the measured Chrome semantics (reuse of loaded images including card thumbnails, 0×0 pending with the painted box retained, progressive header).
- **Server and evaluator:** the server accepts an optional per-card placeholder kind. `evaluateP7` is rewritten to these rules.

**Local qualification: `verify_ib11_p7.cjs --media` 45/45.**
- **Static:** includes "the probe never waits on a placeholder's naturalWidth" and the simulator's Chrome model.
- **Production faults (NOT QUALIFIED):**
  - `39a5ae1`;
  - **`b856a62`**: the placeholder is painted far below its fitted footprint, as Chrome showed, and the progressive original appears at the old zoom;
  - the no-placeholder, raw-zoom and in-place mutants.
- **Probe-logic fault:** the first-attempt probe logic (waiting on `naturalWidth`) against `b856a62` gives NOT QUALIFIED, because the transforms were not applied before completion.
- **25 evidence faults,** including:
  - a placeholder painted at a tenth of its footprint;
  - a progressive original as the last placeholder frame;
  - transforms captured after the original completed;
  - transforms not held until the upgrade.

**Regressions on `7e4c643`:**
- IB01–IB09 pass (IB07 blob pins only); IB10 64/67 (staging-attributed).
- P1–P5 as attributed; P6 15/15; P7 29/29.
- Verifiers fail only their working-tree pins; P7 verifier 45/45.
- **E0 27/38, fault controls 39/46:**
  - B1 is the intended V-D7 flip;
  - A1, C1, D1, E3 are staging-attributed;
  - D2 and D4 are anchor pins (re-anchored to `7e4c643`: both caught, 41/46);
  - the remaining uncaught controls are known from earlier P items.
- Historical result files rewritten by these runs were restored unedited.

**Limitations (in addition to §13):**
- E3 and E4 in the historical E0 harness cannot exercise the detached preload; see the attribution above.
- The aspect-ratio limitation is unchanged.

**P7 status at the time of the correction:** local qualification passed; the second real-Chrome run was pending. It is now closed (§15).

## 15. P7 closure: real-Chrome qualification of the corrected V-D7 repair

**Attempt history:**

| Attempt | Raw file | SHA-256 | Production | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `tests/results/ib11-p7-vd7-attempt1.json` | `b28fbf3db1f5dcbe14f2f3f69d71c84d758469679b8f1ede1bd015d7660b72d2` | `b856a62` (package `da6b9f88…`) | **NOT QUALIFIED** (retained evidence, §14) |
| 2 | `tests/results/ib11-p7-vd7.json` | `c5d9f11aa828e681f404511afd2ae67b213e6b4d0c30132edeeef7af9b244ab7` | `7e4c643` (package `2fee6862…`) | **V-D7 REPAIR QUALIFIED** |

Both raw files are git-ignored, not committed and not modified.

**Attempt 2:**
- One attempt, page P7_VD7.
- Identity `MATCH_EXPECTED_ARTIFACT` (body `822a5a20…780d`).
- Chrome 154 / Windows / Tampermonkey 5.5.0.
- `error: null`; no trusted input outside the prompts.

**Authoritative evaluation:** `node tests/browser/ib11/vview_evaluate.cjs --p7 tests/results/ib11-p7-vd7.json`.
- **Exit 0.** Revision **1.3**, verdict **V-D7 REPAIR QUALIFIED**.
- No problems; 0 invalid attempts.

**P7STAGE:** evidence **PASS**, finding **BEHAVIOR_OK** (stage 2560×1227).
- **At 300 ms and 1000 ms:**
  - target 8002 and exactly one viewer media element;
  - the target's own `VD7-thumb` (160×80) as the retained placeholder, painted at its fitted footprint 2406×1203 (configured Fit scale 15.0375);
  - the original still pending; no blank stage.
- **Upgrade:**
  - the complete 1600×800 `VD7-slow` on the same element and target;
  - the scale changed to 1.50375 while the rendered rectangle stayed exactly 2406×1203 and the centre exactly (1280, 613.5);
  - identical 500 ms later; no state text.
- **Frames:** 1765 frames, 0 blank. The last painted placeholder and the first painted full image are both 2406×1203 (delta 0 px).

**P7XFORM:** evidence **PASS**, finding **BEHAVIOR_OK**.
- **Before completion:** the retained 800×400 `VD7X-mid` placeholder of target 8003 at its fitted scale 3.0075. While it was still displayed, rotation 90°, both flips (−1, −1), manual zoom to 3.5075 (two Zoom in steps) and a pan (40, −25) were applied, and they were held in the last painted placeholder frame.
- **At the upgrade:** the complete 1600×800 `VD7X-slow` on the same element and target.
  - The scale went to 1.75375, keeping the apparent size across the 2× intrinsic change.
  - Rotation, flips and pan were unchanged.
  - The rendered rectangle stayed exactly 1403×2806 with the same centre; identical 500 ms later.
- **Frames:** 1759 frames, 0 blank.
- **Extent:** the transformed image deliberately extends beyond the stage. This is the user's manual zoom/pan/rotation view being preserved, not a configured-Fit result.

**Conclusion:** **P7 / V-D7: COMPLETE, PASS(scope)** for the qualified TC cell (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture). An image target opens on its own placeholder; the placeholder stays painted, at its own fit, while the original downloads; the original replaces it on the same element with the apparent on-screen view preserved (fit or manual, including rotation, flips and pan), without a blank frame or a configured refit.

**Local evidence** (production unchanged since §14):
- P7 regression 29/29 (Chrome image semantics; faults: `39a5ae1`, `b856a62`, no-placeholder, raw-zoom, in-place);
- staging attribution 7/7;
- P7 package verifier 45/45;
- P6 15/15.

**Preservation classification:**
- The closed P1–P6 regression files are unchanged.
- Their changed checks (P1–P5) and the E0 checks A1, B1 (the intended V-D7 flip), C1, D1 and E3 are historical/staging-attributed: they pass completely with staging disabled.
- P7's preservation regression carries the protected behaviors forward on current production: V-D1, V-D5, V-D6a, V-D6b, V-D8, P6/V-D4 and the Fit modes, manual zoom/pan, E6, video, metadata-pending, navigation, close, playback and focus.

**Settled designer decisions (not open items):**
1. **Closed regressions:** the P1–P6 regression files stay untouched. Tests whose assumptions changed because P7 introduced staged image loading are historical/staging-attributed, and P7's current-production preservation regression carries the protected behavior forward.
2. **Aspect ratio:** placeholder/full aspect-ratio differences are an accepted P7 limitation. Exact two-axis apparent-geometry preservation is qualified for compatible (same-aspect) replacement. With differing aspect ratios, bounded containment under the existing uniform-scale transform is acceptable; no new transform architecture is authorized.

**Production:** commit `7e4c643b018794ba1026f42faa4109ebda5a548c`, blob `5da8fd9d69a65af6009fed66a0874bb8b96ce64b`, body SHA-256 `822a5a20e1a387340618c08267b8bd7a09b2bf1ce0ab463ad371a99a4b37780d`. This closure is documentation only.

**Remaining frozen P item, NOT STARTED:** focus ownership/return.

IB11 remains **PARTIAL / NOT COMPLETE**.

## 16. P8 — viewer focus ownership and focus return

**Pre-edit gate (synchronized):**
- HEAD `d39dd0847d51701e6567e070528a0a1007b25a59` = origin, clean.
- Blueprint blob `432768c5…` (unchanged).
- Production `7e4c643` / blob `5da8fd9` / body `822a5a20…780d`.
- No mismatch with the assignment or the Ledger.

**Confirmed baseline** (V-VIEW FOCUS_M / FOCUS_K, real Chrome; E0 F1/F2):
- **Opening moves no focus.** Mouse origin: focus stays on the invoking card link. Keyboard origin: Tab and Enter leave focus on the link.
- **Tab escapes.** Three Tabs reach card controls behind the visible overlay.
- **Return only appears to work.** `open()` never took focus (`Booru_Enhancer.user.js:3803–3810` at `7e4c643`). `close()` restored focus only when the active element was inside the overlay (`:3887`, `:3897–3900`).

**Production change** (commit `9d864845d482f74cc565cf0c6b4ff92ccef7a047`; viewer module only):
- **Initial focus target:** the existing Close (✕) toolbar button (`closeBtn`). After a successful closed → open transition, `open()` focuses it once `replaceMedia` has succeeded. A synchronous initial build failure rethrows before that (P4 / V-D6a), so an abandoned viewer never takes focus. An already-open viewer keeps its focused control and reclaims focus to Close only if it has escaped. Media or metadata updates (`updatePost`) do not move focus.
- **Tab / Shift+Tab boundary rule:** `onKeydown` handles an **unmodified** Tab or Shift+Tab before the unchanged V-D5 Ctrl/Meta/Alt guard (`trapTab`).
  - From the last viewer control, Tab wraps to the first; from the first, Shift+Tab wraps to the last.
  - From a control outside the set, Tab focuses the first (Shift+Tab the last).
  - Otherwise the browser's native move is left alone.
  - Ctrl/Meta/Alt+Tab are not handled.
- **Dynamic focusable-set rule:** `viewerFocusables()` reads the **current** overlay DOM, in document order: buttons, `a[href]`, inputs, `video[controls]`/`audio[controls]` and `[tabindex]`, keeping those with `tabIndex >= 0`, not disabled, and rendered (no `hidden` or `display:none` ancestor, not `visibility:hidden`). It uses no layout queries, so a present native recovery link joins the set (stage first, then the toolbar ending with Close).
- **Return-origin/fallback rule:** `close()` restores focus when it is inside the viewer, or lost to `body`. A press on the empty stage blurs focus to `body` first, so that close path is now covered. It restores to the origin if it is a usable target (connected, rendered, focusable, not body/html/the viewer, not disabled), else to the fallback, else to nothing (no invented target, no throw). `context.origin` / `context.fallback` and `viewerOwner.setFocusTargets` are kept.
- **Implicit origin for context-less new opens:**
  - When `open()` gets no `context.origin` on a **new** session, the element focused before it opened becomes the return origin, if it is a usable target (not body/html, the viewer, hidden or disconnected). Example: the post-page toolbar's `viewer.open(post)`.
  - On an **open** viewer, a context-less call keeps the existing origin and fallback.
  - Explicit `context.origin` and `context.fallback` behave as before.

| Artifact | Value |
| --- | --- |
| Blob | `8453be9447820978b7d4a2886ea9ae2bf4e87c10` |
| Production body SHA-256 | `7745efafde2013fa98329c0ff6c9dd9d94995098129b763b05b7abdccd8cf205` |
| Diff | 68 insertions, 7 deletions |

**Forbidden-scope audit:**
- **Not added:** `role="dialog"`, `aria-modal`, `inert`, or any page tabindex rewriting.
- **`BE.ownership` not broadened:** `setFocusTargets` is reused.
- **No change to:** P1–P7 behavior, A4, C4, E6, G4, playback policy, staging, renditions, download/favorite, pagination, IB12.

**Permanent regression:** `tests/host/ib11/p8_focus_ownership.cjs` **25/25** (result `p8-focus-ownership-result.json`).
- **Harness:** the browser's native Tab move is applied after dispatch unless prevented, over the whole page, so an untrapped Tab escapes to the card controls behind the overlay. A stage press blurs to `body` first.
- **Sources:** the repair, the prior `7e4c643`, and seven single-obligation mutants:
  - no acquisition, no trap, no restore;
  - no implicit origin, origin replaced while open;
  - focus taken before the build, modified Tab trapped.
- **Return checks:** every return check also requires that focus was inside the viewer, so the prior's never-left focus is not accepted as a return.

| Check | Must fail on |
| --- | --- |
| P8-1 mouse-origin open moves focus into the viewer | prior, no-acquire |
| P8-2 initial focus = Close (mouse and keyboard origin) | prior, no-acquire |
| P8-3 Tab from the last (Close) wraps to the first | prior, no-trap |
| P8-4 Shift+Tab from the first wraps to Close | prior, no-trap |
| P8-5 two full Tab and Shift+Tab cycles never leave the viewer and visit every control | prior, no-trap |
| P8-6 a present native recovery link joins the focus set (first) without escape | prior, no-trap |
| P8-7 Escape restores the origin (after owning focus) | prior, no-acquire, no-restore |
| P8-8 Close (✕) restores the origin | prior, no-restore |
| P8-9 stage click (focus blurred to body) restores the origin | prior, no-restore |
| P8-10 removed origin → the connected fallback | prior, no-restore |
| P8-11 neither origin nor fallback: nothing invented, no throw | (holds everywhere) |
| P8-12 a context-less `viewer.open()` returns to the pre-open focused element | prior, no-implicit, no-restore |
| P8-13 a context-less operation on an open viewer keeps the origin | prior, origin-replaced |
| P8-14 a synchronous initial takeover failure takes no focus (no focusin in the viewer) | early-focus |
| P8-15 in-viewer navigation keeps the focused Next button; escaped focus is reclaimed to Close | prior |
| P8-16 Ctrl/Meta/Alt(+Shift)+Tab not handled, not prevented | trap-all |
| P8-17 Tab is not intercepted while closed | (holds everywhere) |
| P8-18 to P8-25 preservation (below) | (hold everywhere) |

**Preservation checks P8-18 to P8-25:**
- V-D5 (and the unmodified f / Escape / arrows);
- V-D8 link hit test and click (not prevented, viewer open);
- V-D1; V-D6b; P6 rotated Fit; P7 staging;
- Space playback while Close is focused (Close not activated);
- E6 and the Fit, zoom and flip controls;
- close and dispose cleanup (keys inert after dispose).

**Attribution of the closed regressions** (`tests/host/ib11/p8_focus_attribution.cjs` **8/8**; the closed suites are unedited).
- **Method:** each suite runs as-is, with only the P8 focus acquisition disabled (`p8_neutral_focus_preload.cjs`), and with focus and P7 staging both disabled.
- **Focus-only neutralization** leaves exactly the recorded P7 staging-attributed sets. The P7 classification is unchanged, and `p7_staging_attribution.cjs` reproduces 7/7 with focus neutralized for its child runs.
- **Both neutralized,** P1–P6 pass fully and E0 fails exactly its pre-P7 set. (The P7 regression needs staging; it passes 29/29 with focus neutralized.)
- **The only focus-attributed checks** are the pre-focus assertions that opening moves no focus: **P3-16, P4-15, P5-15, P7-23** and **E0 F2**. F2 is the intended witness flip: focus now moves into the viewer.

**Real-browser qualification: required.** Prepared package `tests/browser/ib11/IB11_P8_Focus.user.js` (SHA-256 `9e938f4ffd2f4239ceeeabf5ad2b69da1e1343efaa439745c69a6c2da1b6d608`):
- **Build:** `build_ib11_p8.cjs` from `9d86484`; the body is byte-identical (`7745efaf…f205`).
- **Runner:** the V-VIEW runner plus declared runner-only patches (`p8_focus.js`). The V-VIEW and P1–P7 packages are unchanged.
- **Page P8_FOCUS:** cards FOCUS_K (blue, first), FOCUS_M (pink) and VD5 (page controls).
  - **P8M (mouse origin):** a trusted click on the pink card (the invoking link is captured at the click); then trusted Tab, trusted Shift+Tab and a trusted Escape.
  - **P8K (keyboard origin):** trusted Tabs to the blue card and a trusted Enter (the invoker is captured at the Enter); then trusted Shift+Tab, Tab, Tab; then a trusted click on ✕.
  - **Recorded per step:** the focused element's descriptor, and flags for Close, the first viewer control, the invoker and body; whether the viewer was open when the input arrived.
- **Simulator:** `vview_sim.cjs` dispatches Tab to the focused element and makes the native move only when not prevented (over rendered controls).
- **Evaluator:** `vview_evaluate.cjs --p8`. The verdict is **P8 FOCUS QUALIFIED** only when both cells hold:
  - **P8M:** focus on Close after open (not the invoker); Tab wraps to the first control; Shift+Tab wraps back to Close; Escape (made while open) returns focus to the actual invoking link.
  - **P8K:** focus on Close after open; Shift+Tab stays inside (a native move); Tab back to Close; Tab wraps to the first; ✕ returns focus to the invoking link.
  - Every input trusted; no trusted input outside a prompt; identity MATCH.

**Local qualification: `verify_ib11_p8.cjs --media` 34/34** (`IB11_P8_VERIFICATION.json`; `IB11_P8_SHA256SUMS.txt`).
- **Static:** fresh build; byte-identical body; exact patches; pinned packages unchanged; scope; probe captures; plan; results path; simulator Tab.
- **Server:** `--p8`.
- **Smoke:** the repair qualifies.
- **Production faults (NOT QUALIFIED):**
  - `7e4c643`: focus never enters; Tab reaches the cards. Its apparent return is refused.
  - the no-acquire, no-trap and no-restore mutants.
- **Evidence faults (NOT QUALIFIED):**
  - initial focus on the card; focus that never left yet "returned";
  - Tab, Shift+Tab or the keyboard wrap escaping behind the overlay;
  - close result `body`, or not the invoking element; the claimed invoker in another card;
  - an untrusted Tab or Enter; a Tab or Escape captured after the viewer closed; a modified Tab used as evidence;
  - trusted outside input; wrong identity; duplicate attempts; wrong result type.

**Regressions on `9d86484`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only |
| IB08 | 66/66, 24/24, 12/12, 14/14 |
| IB09 P-stage | 111/111 |
| IB10 P-stage | 64/67 (the three P7 staging-attributed timeline checks; unchanged) |
| IB11 P1–P5 regressions | 1/6, 6/11, 13/16, 11/15, 10/15 (P7 staging set, plus P3-16, P4-15, P5-15 focus-attributed) |
| IB11 P6 / P7 regressions | 15/15; 28/29 (P7-23 focus-attributed) |
| IB11 P8 regression | 25/25 |
| IB11 G-PLAY | 36/37; recovery 28/28 |
| IB11 V-VIEW | 65/66; recovery 32/32 |
| IB11 P1–P7 package verifiers | each fails only its superseded working-tree pin (P7 44/45) |
| IB11 P8 package verifier | 34/34 |
| IB11 E0 characterization | 26/38; fault controls 38/46 |

**E0 classification:**
- **F2** is the intended focus witness flip.
- **F1 still passes**: focus moved by the page outside the viewer is left alone.
- **Fault control F1 "no focus return"** is a new anchor pin: the line it targets was rewritten. Re-anchored in a temporary copy together with D2 and D4, all three are **caught** (41/46). The remaining uncaught controls (the A5, C3, E5 and G2 probes, and G5) are known from earlier P items.

Historical result files rewritten by these runs were restored unedited.

**Limitations:**
- Real-browser focus inside native video controls (shadow controls) is browser-managed. The trap handles the boundary elements of the viewer set only.
- No dialog semantics or background `inert` are added (not part of the frozen decision).

**P8 status: PARTIAL, NOT COMPLETE.** The production repair is committed, and the local qualification, attribution and regressions pass as classified. **Real-Chrome qualification is PENDING.** The operator step is in `tests/browser/ib11/README.md`, "IB11-P8".

**Provenance:** no donor code; all changes are original to this repository (MIT).
