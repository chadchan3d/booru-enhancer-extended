# IB12 — E stage record

**Checkpoint:** IB12 — Tiered place restoration and bounded traditional append (Blueprint §3 IB12; v1.1 proportional qualification). The baseline is `IB12_BASELINE.md` (E0).

## 1. Designer rulings on the E0 gaps (recorded; not repaired here)

| Gap | Ruling | Eventual repair direction |
| --- | --- | --- |
| **G1** — loop termination leaves the native paginator hidden (`Booru_Enhancer.user.js:4721–4725`) | **IB12 defect.** A pagination loop may not terminate while the native paginator stays hidden. | Reveal native pagination on loop termination. |
| **G2** — a duplicate-only page stalls append with the paginator hidden (`:4832–4840`) | **IB12 defect.** A fetched page with zero unique forward progress may not leave append stalled with the paginator hidden. | Preferred: stop the append chain and reveal native pagination, not an elaborate duplicate-page chasing mechanism. |
| **G3** — appended cards bypass owner-based enhancement (`buildThumbActions(clonedWrap, clonedImg)` and `applySiteThumbMedia(clonedImg, clonedWrap)` omit the owner, `:4807–4808`) | **IB12 defect** — an append integration defect, not a reopening of IB04/IB08. | Reuse the established owner-based thumbnail enhancement path; do not reimplement it. Host-specific behaviour stays bounded by its existing gates. |

**Route order (designer):**
- The first IB12 product target is **e621 `/posts`, Tier 0 only**.
- Rule34 remains the preferred first **Tier-2 / page-addressable** route; it is not started.

## 2. IB12-E1 — e621 Tier-0 viewer return check (prepared; operator run PENDING)

**Purpose:** establish in real Chrome the current Tier-0 behaviour on a logged-out e621 `/posts` listing. The case: card A is opened, viewer Next is used until the current card C is entirely outside the original viewport, and the viewer is closed with Escape. Expected from source (E0 §1.4): focus returns to C's native link with `preventScroll: true`, so the page stays at A and C remains out of view.

**Package:** `tests/browser/ib12/IB12_E1_e621_Tier0.user.js`, SHA-256 `439bdd873263fc146c5447f09449fdedbafc2aa3e375c1e0a6586a013aa66d0a`.
- **Build:** `build_ib12_e1.cjs` from `ac3c9e8`. The executed body is byte-identical (blob `db54843`, body `d64df2a6…8127`) and carries no hooks. Scope: `@match *://e621.net/*` only.
- **Recorder:** `ib12e1_postamble.js`, observe-only:
  - a pass-through wrapper on `BE.modules.viewer.open` (same arguments and return value) gives the current card and its focus origin;
  - a capture-phase Escape snapshot (never prevented or stopped);
  - a MutationObserver on the viewer overlay detects the close;
  - a pass-through counter on `BE.log.error`;
  - a click-through marker for A and a click-through status line.
  - It makes no history, scroll, focus, network, storage or settings call.
- **Recorded:**
  - identity and runtime;
  - viewport and start `scrollY`;
  - A and C ordinals and rectangles, and the number of viewer steps;
  - whether C is entirely outside the original viewport;
  - `scrollY` and C's rectangle and visibility just before close;
  - after close (sync, next frame, 250 ms, 1000 ms): `scrollY`, C connected, C's rectangle and visible fraction, and focus facts (focus is C's native origin, inside C, or body);
  - operator input after close;
  - probe and production error counts.
  - It records no post IDs or URLs; a leak guard withholds the result otherwise.
- **Evaluator:** `evaluate_ib12_e1.cjs`.
  - **Valid run:** identity MATCH; e621.net `/posts`, logged out; complete; Escape close; C ≠ A; C entirely outside the original viewport; no probe error; no input after close.
  - **PREMISE ESTABLISHED:** C stays connected; focus is on C's native origin at every snapshot; `scrollY` stays within 2 px; C's visible fraction is below 0.5 at 1000 ms.
  - **BROWSER BRINGS C INTO VIEW:** C is usefully visible after close (record the fact and stop).
- **Local qualification:** `verify_ib12_e1.cjs` **15/15** (`IB12_E1_VERIFICATION.json`).
  - **Static:** package current; body identical to production and the working tree; e621-only scope; grants unchanged; no forbidden calls in the recorder; pass-through wrappers; results path git-ignored.
  - **Recorder smoke** (jsdom with a fake viewer that has production's close semantics):
    - the run is recorded and shown, with the intended values;
    - the output is sanitized (no URL, no post ID);
    - production semantics → PREMISE ESTABLISHED;
    - a browser that scrolls C into view → BROWSER BRINGS C INTO VIEW;
    - closing on A → INVALID;
    - a wrong body → identity MISMATCH → INVALID.
  - **Evaluator:** input after close → INVALID; focus elsewhere → NOT ESTABLISHED.
  - No mutant matrix (v1.1).
- **Operator flow** (`tests/browser/ib12/README.md`, "IB12-E1"; under one minute):
  1. Open the logged-out listing.
  2. Click the pink-outlined card A.
  3. Click the viewer's Next ▶ button until told.
  4. Press Escape once.
  5. Save the result as `tests/results/ib12-e1-e621-tier0.json` (git-ignored).
  - The on-screen button is used instead of → because the viewer's key handling calls `preventDefault` but not `stopPropagation` (`:3505`), and e621's own shortcuts must not change the page.

**Decision rule:**
- **PREMISE ESTABLISHED** → **G-PLACE-T(e621, Tier 0) E: PASS** — current behaviour establishes the bounded Tier-0 correction premise. This is not a pass for Tier 1 or Tier 2.
- If Chrome already brings C usefully into view, record that and stop; no repair is invented.

**Status at preparation (`f3f09ec`):** G-PLACE-T(e621, Tier 0) PENDING the operator run.

### E1 result (real Chrome) — designer accepted

- **Raw:** `tests/results/ib12-e1-e621-tier0.json`, SHA-256 `a7dbf863177e3878ddd9cb850aaf837b5cf3c38ab65f492f1e2248d8950be93c`. Private and not committed.
  - **UNVERIFIED locally:** the file is not present in this working tree, so it was not re-hashed or re-evaluated here. The values below are as the designer relayed them.
- **Run facts:**
  - e621.net `/posts`, logged out; production identity MATCH; Chrome 154 / Windows / Tampermonkey 5.5.0.
  - A was ordinal 0. After viewer navigation, C was ordinal 45, entirely outside the original viewport.
  - Before close: `scrollY` 0; C visible fraction 0.
  - After Escape, through 1000 ms: `scrollY` 0; C connected; C visible fraction 0; focus on C's native origin, inside C.
  - No input after close; no production or probe errors; complete.
- **Committed evaluator verdict:** **PREMISE ESTABLISHED**.

**G-PLACE-T(e621, Tier 0) E: PASS** — current behaviour establishes the bounded Tier-0 correction premise. Tier 1 and Tier 2 remain OPEN. E1 is not rerun.

**Provenance:** no donor code; original to this repository (MIT).

## 3. IB12-E2 — Rule34 native Back and page-address observation (prepared; operator run PENDING)

**Purpose (designer decision):** do not assume Tier 1 should exist. First establish the user-facing problem on the workflow that matters:

> Rule34 listing → infinite append → the user reaches a card from a later native page → native same-tab post navigation → browser Back.

The run should answer two questions:
- **A.** Is Tier 1 materially useful on Rule34?
- **B.** Does Rule34 provide enough stable native-page information to proceed toward Tier 2?

Rule34 is the first route because its observed `pid` pagination (IB07) is a genuine native page-address candidate. This is observation only: no production change, no restoration.

**Synchronized identity:**
- HEAD `b7be7c0a2c4678a3e705ab2e1a375987c02b0dff`.
- Production `466a480` / blob `3be0e1f` / body `9fa6ab28…36b3`.
- P1–P3 COMPLETE; G1–G3 resolved; Tier 1 and Tier 2 OPEN.

**Package:** `tests/browser/ib12/IB12_E2_Rule34_Back.user.js`, SHA-256 `3e7036399b7ba25a75647ec4e45a25a19b14f2cc95691fd2c10d819106ec372d`.
- **Build:** `build_ib12_e2.cjs` from `466a480`; body unchanged, no hooks; `@match *://rule34.xxx/*` only.
- **Recorder** (`ib12e2_postamble.js`, observe-only):
  - pass-through wrappers on `BE.net.request` / `BE.net.json`, which return the same promise. The `gallery-pagination` URL of each appended batch is attributed to the cards it inserted. Requests after a return are counted.
  - Probe state survives the navigations under **one** `sessionStorage` key. Post IDs, URLs and tag text stay private.
  - A panel outside the gallery offers plain native links, which the enhancer does not intercept.
  - For the second leave only, it adds BFCache-ineligibility (an `unload` listener and a held Web Lock) right before navigating.
  - It makes no settings, history, scroll, append or account change.
- **Run design:**
  1. Ordinary production append supplies at least two native pages. Each batch records its `pid`, whether it has the same route parameters, the number inserted and its ordinal range. **C** is the first card of the second appended batch, recorded with its batch `pid` and whether that `pid` is later than the first batch's.
  2. **Normal Back:** with C visible, the operator follows C's native post link, then browser Back. Recorded: `pageshow.persisted`, navigation type, `notRestoredReasons`, and snapshots at pageshow, 300 ms and 1500 ms (`scrollY`, C connected, C's visible fraction, card count, appended cards present). Also the listing and other enhancer requests after the return, whether `history.state` is unchanged, and operator input.
  3. **Fresh-load Back:** the same, with the listing made BFCache-ineligible by the probe only. A fresh load is **confirmed** only if `pageshow.persisted` is false **and** the navigation type is `back_forward`; it is never assumed. Recorded: C present or not, where scroll lands, whether only the starting native page is present, any listing request after the return and its `pid` (reconstruction would be a request for an earlier appended page), and `history.state`.
  4. **Native later-page check:** a fresh native load of the **exact URL observed** for C's batch; no synthesized `pid`. Recorded: whether the parameters equal the observed ones, whether C is on that page and at what ordinal, and the card count.
- **Evaluator** (`evaluate_ib12_e2.cjs`): validity checks, then **CASE A / B / C / FRESH BACK NOT ACHIEVED / OTHER**, as defined in the assignment. A return is "useful" when C is connected and at least 0.5 visible at 1500 ms. If the probe's method does not produce a confirmed fresh load, the result is recorded and work stops; no further browser machinery is added.
- **Local qualification:** `verify_ib12_e2.cjs` **15/15** (`IB12_E2_VERIFICATION.json`).
  - **Static:** fresh build; body = production = working tree; Rule34-only scope; no history-write, scroll, focus, network, settings, cookie/localStorage or event-cancelling call; one `sessionStorage` key; pass-through wrappers; git-ignored path.
  - **Multi-document jsdom smoke** (fake production surface, shared `sessionStorage`):
    - two batches (`pid` 42 and 84) with their ordinal ranges; C chosen correctly;
    - BFCache normal Back; confirmed fresh Back; C found on its page;
    - sanitized output; the evaluator gives CASE B;
    - a non-fresh second Back gives FRESH BACK NOT ACHIEVED.
  - **Evaluator edits:** CASE A, CASE C and INVALID.
- **Proportionality:** one valid Rule34 run; no mutants, other browsers, e621/e926 or screenshots.

**Provisional tier-boundary analysis** (from source; final after the run). After a fresh-load Back the appended cards are gone, and production does not reconstruct them (E0 §1.2). A remembered post ID alone therefore cannot bring the user back to an appended card C after a fresh load: the card is not in the DOM. A useful fresh-load correction has to know **which native page supplied C** — the Tier-2 page association — and send the user there or offer it. If the run shows Case B, Tier 1 (a bounded session anchor) is not useful on its own for the appended-card workflow. It depends on Tier-2 page association, and the two would be designed together, though still implemented in separate assignments. If normal Back with BFCache already restores the place (and fresh loads are uncommon in practice), Tier 1 may be omitted for this route. The run decides.

**Status:** G-PLACE-T(rule34, Tier 1/2) remains OPEN. E2 is **PENDING** the operator run. No production change.

### E2 first owner attempt and the guided revision (IB12-E2R)

**First owner attempt (package `3e703639…372d`): ABORTED — operator flow ambiguous; no product evidence.**
- The owner stopped after navigating to C's post page and pressing browser Back, because the panel left it unclear what to do next.
- Nothing from that attempt is used.
- The E2 package, its recorder and its verifier (15/15) stay as historical artifacts.

**E2 questions unchanged.** The revision changes only the operator panel. These stay the same:
- the production body and the Rule34 route;
- the batch/page-association observation;
- the normal-Back observation;
- the probe-only BFCache-ineligibility for the second leave;
- the fresh-Back criteria (`pageshow.persisted` false and navigation type `back_forward`);
- the exact observed native-page check;
- sanitization;
- no history writes, no scrolling or restoration, no settings changes, and no automatic `history.back()`.

**Revised probe — prepared:** `tests/browser/ib12/IB12_E2R_Rule34_Back.user.js`, SHA-256 `0a458aa17f382f78da4ef230e47bd547a25e2e4e0f21a505f793b1bc62aeb8fe`.
- **Build:** the same `build_ib12_e2.cjs` from production `466a480`, with the guided recorder `ib12e2r_postamble.js` (version `1.1.0-guided`).
- **Guided panel:** a fixed, dominant "IB12-E2 TEST — STEP k OF 4" panel shows exactly one next action at a time:
  - **STEP 1 — LOAD TWO APPENDED PAGES:** "Appended pages: n / 2", then "C FOUND — scroll until the pink card is visible.", then one large probe control, **OPEN C POST IN SAME TAB**. The operator is never told to click the card.
  - **Post page:** **STEP 2 — NORMAL BACK TEST** / **STEP 3 — FRESH-LOAD BACK TEST**, with "Now press Chrome's Back button once."
  - **On return:** **BACK DETECTED — RECORDING**, "Do not scroll or click.", and a countdown. No action and no reset control appear until the observation window is over.
  - **STEP 3:** "Normal Back: Recorded." and **OPEN C POST IN SAME TAB**.
  - **STEP 4 — CHECK C'S OBSERVED NATIVE PAGE:** "Fresh Back confirmed." or "Chrome used BFCache; fresh Back was not achieved. This is a valid recorded outcome.", then **OPEN OBSERVED PAGE**.
  - **TEST COMPLETE:** the result box and Download.
  - **Inconsistent state:** "TEST STATE INVALID — press Reset and start over".
  - **Reset:** an "Emergency: Reset test" control, visually separated below the instructions.
- **Evaluator adjustment (no new requirement):** C must be usefully visible at the second leave only while C still exists. If the normal Back already lost the appended cards, the fresh-load test starts without C.
- **Local qualification:** `verify_ib12_e2r.cjs` **15/15** (`IB12_E2R_VERIFICATION.json`).
  - **Static:** E2R package current; body = production = working tree; the E2 package unchanged; every measurement function, the request wrappers and the pageshow observation byte-identical to E2's (only the panel and one panel refresh differ); no forbidden call; one `sessionStorage` key.
  - **Guided flow** (multi-document jsdom): each specified panel state at each step; exactly one action where one is expected; none while recording.
  - **Outcomes:** the same evidence (CASE B); the BFCache outcome text and completion for a non-fresh second Back; TEST STATE INVALID for an out-of-flow post page.
  - The original E2 verifier still passes 15/15.
- **Runbook:** `tests/browser/ib12/README.md`, "IB12-E2R" (five short lines).

**Status:** E2 is **PENDING** the operator run with the E2R package. G-PLACE-T(rule34, Tier 1/2) stays OPEN. No production change.
