# IB12 — P stage record

**Checkpoint:** IB12 — Tiered place restoration and bounded traditional append (Blueprint §3 IB12; v1.1 proportional qualification). E-stage basis: `IB12_E_STAGE.md` (G-PLACE-T(e621, Tier 0) E: PASS).

## 1. P1 — Tier-0 last-viewed viewer return

**Defect** (E1, real Chrome): viewer navigation correctly moves the focus-return origin from A to the viewed card C. On close, though, focus used `preventScroll: true`, so an off-screen C received keyboard focus while the user kept looking at A.

**Change** — production commit `ba6e600fb799504c68afe2ca8bed38f4bbe71963`, blob `c6d6655fb6d38c6fb4c2e9bb59f47c756c461913`, body SHA-256 `62f053761191678ab709b79025319d2be7794422b0f8f856422651a21882099f`. Only the viewer module changed:
- `sessionOpener`: the session's original opener, taken when a new session opens and kept while in-viewer navigation moves the return origin. It is session-local; there is no storage and no anchor system.
- **Return order on close:** the last viewed card, else the original opener, else the declared native fallback, else nothing. No unrelated card is ever chosen.
- `revealReturnTarget`: one close-time correction.
  - It runs only when the chosen card is entirely outside the viewport.
  - It uses the browser's `scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' })`, then focus with `preventScroll`.
  - A visible card keeps the page where it is.
  - It is skipped when the element has no layout box or no `scrollIntoView`.
  - There is no scrolling while the viewer is open, no retry, no tracking, no observer loop and no stored geometry.
- The P8 lines that closed tests anchor on are kept byte-identical (the implicit-origin line and the `if (shouldReturnFocus) {` / origin branch head).

**Regression:** `tests/host/ib12/p1_tier0_viewer_return.cjs` **4/4**. It runs real production in jsdom with a layout model and a recording `scrollIntoView`. The prior artifact `ac3c9e8` must fail the two defect checks.

| Check | Prior `ac3c9e8` |
| --- | --- |
| P1-1 A → off-screen C, Escape: focus C; exactly one close-time correction (nearest, instant); nothing scrolled while open; C visible | fails |
| P1-2 C already visible: focus C, no scroll | passes |
| P1-3 C removed: focus returns to the original opener A; no unrelated card; no scroll (A visible) | fails |
| P1-4 C and A removed: the fallback stays safe; no card focused; no scroll | passes |

No mutant matrix (v1.1).

**Suite on the P1 working tree** (production `c6d6655`):
- **Unchanged from the `ac3c9e8` record** (`IB11_P_STAGE.md` §19):
  - IB01–IB09 pass, except the IB07 blob pins;
  - IB10 64/67 (P7-attributed);
  - E0 25/38, fault controls 37/46;
  - P1–P5 as attributed; P6 15/15; P7 28/29 (P7-23 focus-attributed); P9 12/12;
  - recoveries 28/28 and 32/32;
  - the G-PLAY, V-VIEW and IB11 P1–P9 package verifiers fail only their working-tree production pin (P9 is now 40/41);
  - the IB12-E1 verifier 14/15 (its working-tree pin).
- **One new classification — P8 24/25: P8-13 is P1-attributed.**
  - Production passes P8-13.
  - Its REPLACE-ORIGIN fault control (the open viewer loses its return origin) is now masked: P1's opener fallback returns focus to the same opener A, the intended Tier-0 behaviour.
  - The check's "must fail" expectation assumed no opener fallback existed. It is not a product regression, and the closed P8 test is not edited.
- Historical result files rewritten by the run were restored unedited.

**Browser confirmation (prepared):** `tests/browser/ib12/IB12_P1_e621_Tier0.user.js`, SHA-256 `43dada0abd3791b733ea6bd1dfbb1e4d6cd0801c4a713653e57312e14683598c`.
- **Build:** `build_ib12_p1.cjs` from `ba6e600`, body unchanged. The recorder is the E1 recorder plus declared patches:
  - the probe identity;
  - a pass-through `scrollIntoView` counter (call time, viewer open or not, target = C's origin);
  - scroll events after close.
  - The E1 package is unchanged.
- **Evaluator:** `evaluate_ib12_p1.cjs`. It applies the E1 validity rules, then requires **P1 TIER0 QUALIFIED**:
  - C is connected and focused at every post-close snapshot;
  - C is usefully visible (≥ 0.5) from close through 1000 ms;
  - exactly one `scrollIntoView`, after close, on C's origin;
  - `scrollY` unchanged while the viewer was open;
  - `scrollY` changed at close, then stayed fixed (sync = frame = 250 ms = 1000 ms).
- **Local qualification:** `verify_ib12_p1.cjs` **11/11**:
  - static: fresh build, body = the P1 commit = the working tree, E1 + exactly the patches, E1 package unchanged, scope, no direct scroll/focus/history call, git-ignored path;
  - smoke: P1 semantics → QUALIFIED; pre-P1 semantics → NOT QUALIFIED; a repeated correction → NOT QUALIFIED; sanitized output.
- **Runbook:** `tests/browser/ib12/README.md`, "IB12-P1". It needs one valid run.

**Not in P1:** Tier 1/2, BFCache/Back, append, duplicate URLs, page addressing; G1–G3 (ruled IB12 defects, untouched); Rule34; IB13; Pixiv.

**P1 status at preparation (`20929d8`):** PARTIAL — NOT COMPLETE, browser confirmation pending. See §2.

**Provenance:** no donor code; original to this repository (MIT).

## 2. P1 closure: real-Chrome confirmation

**Synchronized identity:**
- HEAD `20929d882f55d2d0e34233c1a577f14b5dbda559`.
- Production `ba6e600` / blob `c6d6655` / body `62f05376…099f`.
- Package `IB12_P1_e621_Tier0.user.js` SHA-256 `43dada0abd3791b733ea6bd1dfbb1e4d6cd0801c4a713653e57312e14683598c`.

Documentation only.

**Raw result:** private, not committed. It is **not present** in this working tree (`tests/results/ib12-p1-e621-tier0.json`), so no raw SHA-256 is recorded and the file was not recreated. The facts below are the designer-accepted browser facts.

**Run facts:**
- **Run:** probe `ib12-p1-e621-tier0`; e621.net `/posts`, logged out; production body identity `MATCH_EXPECTED_ARTIFACT`; Chrome 154 / Windows / Tampermonkey 5.5.0; viewport 1920×953.
- **Navigation:** A was ordinal 0. C was ordinal 28, after 28 viewer steps, and entirely outside the original viewport before close.
- **Before close:** `scrollY` 0; C visible fraction 0. The close was via Escape.
- **After close**, at sync / frame / 250 ms / 1000 ms:
  - `scrollY` 384 at every sample;
  - C connected;
  - C visible fraction 0.9;
  - focus on C's native origin, inside C.
- **Correction:** `scrollIntoViewCalls` = 1 (`viewerOpen` false, `isCOrigin` true); `scrollEventsAfterClose` = 1.
- **Clean run:** no operator input after close; no production log errors; no probe errors; complete.

**Committed evaluator verdict (`evaluate_ib12_p1.cjs`): P1 TIER0 QUALIFIED.**

**This confirms:**
- no scrolling while the viewer was open;
- exactly one bounded close-time correction, on the correct target C;
- C becomes usefully visible, and focus returns to C;
- no repeated correction.

**Retained:**
- the change in production `ba6e600`; local regression 4/4;
- the original-opener fallback (last viewed → opener → native fallback → nothing);
- the one-shot nearest-edge instant correction;
- no Tier-1 or session-anchor machinery.
- **P8-13:** its REPLACE-ORIGIN fault control is masked by the valid opener fallback. That control rests on an obsolete assumption (no opener fallback), not a product regression.

**P1 — Tier-0 last-viewed viewer return: COMPLETE, PASS(scope) in TC** (e621 `/posts`, logged out; Tampermonkey × Chrome).

IB12 is not complete:
- Tier 1 and Tier 2 remain OPEN;
- G1–G3 remain ruled IB12 defects and are unrepaired.
