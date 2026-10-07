# IB11 — P stage: existing viewer hardening

**Checkpoint:** IB11 — Existing viewer hardening (Blueprint §3 IB11). Evidence base: `IB11_BASELINE.md` (E0–E4, final E-stage findings §15).

**Status:** **IB11 PARTIAL / NOT COMPLETE.**
- **P1 (V-D8): COMPLETE, PASS(scope)** for TC (Chrome 154 + Tampermonkey 5.5.0, local controlled fixture), qualified in real Chrome (§2).
- **P2 (V-D1): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§3, §4).
- **P3 (V-D5): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§5, §6).
- **P4 (V-D6a): COMPLETE, PASS(scope)** for TC, qualified in real Chrome (§7, §8).
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
