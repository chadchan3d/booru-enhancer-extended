# IB11 — P stage: existing viewer hardening

**Checkpoint:** IB11 — Existing viewer hardening (Blueprint §3 IB11). Evidence base: `IB11_BASELINE.md` (E0–E4, final E-stage findings §15).

**Status:** **IB11 PARTIAL / NOT COMPLETE.**
- **P1 (V-D8):** production repair committed and locally qualified; **real-Chrome qualification pending** (operator).
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

**P1 status: production repair committed; local qualification PASS; real-Chrome qualification PENDING.** V-D8 is **not** marked repaired until the operator's P1 probe returns **V-D8 REPAIR QUALIFIED**.

**Operator step (about 1 minute):** see `tests/browser/ib11/README.md`, "IB11-P1".
