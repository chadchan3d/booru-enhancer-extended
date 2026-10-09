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

**Status:** **G-PLACE-T(e621, Tier 0): PENDING** (operator run). Production unchanged at `ac3c9e8`. No Tier-0 implementation; G1–G3 not repaired; no Rule34 Tier 2, IB13 or Pixiv work.

**Provenance:** no donor code; original to this repository (MIT).
