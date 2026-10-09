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

## 3. P2 — append liveness / native paginator recovery (G1 + G2)

**Invariant:** automatic append must never stop making useful forward progress while leaving native pagination hidden.

**Defects** (ruled IB12 defects, `IB12_E_STAGE.md` §1):
- **G1:** a next-page identity already in `visitedPageIdentities` set `EXHAUSTED` and returned **without** restoring the native paginator.
- **G2:** a successfully fetched page with zero unique posts and a further next URL returned to `IDLE` and **hid** the paginator. Nothing had been appended, so the sentinel could stay intersecting with no new IntersectionObserver transition, and append could stall indefinitely with native pagination hidden. If the observer did fire again, the next URL was chased.

**Repair** — production commit `3fcbf152efa61b0aac929ddbec169acd11ec6a48`, blob `5d0b1cf16ca9d75575b29615cb6de5d703ebfef0`, body SHA-256 `4a18aa7619b4a9d97a41222ca4dc1f3452b522357cf15a474c96575126326d9c`. Two branches of `loadNextPage` changed:
- **Loop branch:** after `state = 'EXHAUSTED'`, it now calls `restorePaginatorVisibility()` (`IB12-P2 (G1)`).
- **Zero-progress branch** (`inserted === 0` with a next URL): `state = 'EXHAUSTED'` + `restorePaginatorVisibility()`, replacing `IDLE` + `hidePaginatorIfPresent()` (`IB12-P2 (G2)`). The next URL is not chased (designer ruling: no duplicate-page chasing).
- **What it reuses:** the existing terminal state `EXHAUSTED` ("automatic append has stopped for this page context"); no new state or architecture. The sentinel's observer only calls `loadNextPage` in `IDLE`, so no further automatic request is made.
- **What it doesn't touch:** readable appended content, the stored `gallery.infiniteScroll` preference (a runtime stop, not a settings change), history/URLs, page association, retries, recovery UI and G3.
- **Starting-page identity:** not seeded. The deterministic loop regression does not need it. Pre-fetch loop prediction (A→B→A fetching A once) is left to the page-addressable Tier-2 work, as allowed.

**Regression:** `tests/host/ib12/p2_append_liveness.cjs` **4/4**.
- It runs real production in jsdom on an e621 listing with a native `#paginator`.
- `GM_xmlhttpRequest` answers listing pages from a route table and counts them; the IntersectionObserver is a triggerable stub.
- "Terminal" means further triggers dispatch no request.

| Check | Prior `ba6e600` |
| --- | --- |
| P2-1 [G1] after a successful append, a next page that loops to a visited identity: no request for it; terminal; paginator visible; appended cards kept | **fails** (paginator stays hidden) |
| P2-2 [G2] a zero-unique-post page with a further next URL: exactly that one request; no chase on later triggers; terminal; paginator visible; readable content kept | **fails** (paginator hidden; chases the next page on re-trigger) |
| P2-3 normal append: unique posts appended; paginator hidden after success; still eligible (the next trigger fetches the next page) | passes |
| P2-4 ordinary failure/end after a successful append — 404, malformed page, empty page, no next link: paginator revealed, appended cards kept, no repeat request | passes |

No mutant matrix (v1.1).

**Suite on the P2 working tree:**
- **Identical to the P1 record:** IB01–IB09 (IB07 blob pins); IB10 64/67; E0 25/38, controls 37/46; IB11 P1–P5 as attributed; P6 15/15; P7 28/29; P8 24/25 (P8-13 P1-attributed); P9 12/12; recoveries 28/28 and 32/32; the IB11 package verifiers (pins only); IB12-E1 verifier 14/15 (pin).
- **IB12-P1 regression 4/4** (P1 behaviour preserved).
- **New:** the IB12-P1 package verifier is 10/11; its one failure is its superseded working-tree pin to `ba6e600`.
- Historical result files rewritten by the run were restored unedited.

**Browser qualification:** not required. Paginator class state, append state, request count and inserted-node preservation are established deterministically. No browser-specific behaviour is involved beyond the IntersectionObserver re-trigger, which the repair no longer depends on.

**Accepted limitation:** after a zero-progress page, automatic append stays stopped for that page context, even if a later native page would have had new posts. The user continues with the native paginator.

**P2 — append liveness / native paginator recovery: COMPLETE, PASS(scope)** (local deterministic evidence, per assignment). G1 and G2 are resolved; G3 remains unrepaired.

**Provenance:** no donor code; original to this repository (MIT).

## 4. P3 — appended-card enhancement parity (G3)

**Root cause:** `loadNextPage` kept its own partial enhancer for appended cards. It manually added `be-thumb-wrap`, `be-thumb-img`, `data-be-post-id` and `position: relative`, then called `buildThumbActions(clonedWrap, clonedImg)` and `applySiteThumbMedia(clonedImg, clonedWrap)` **without an owner**. Both functions return early without an owner, so:
- appended cards had no action bar;
- appended cards had no admitted IB08 rendition;
- appended cards had no card owner, so their mutations sat outside the ownership lifecycle.

The `owner` parameter arrived with `edeabcd` (IB04 ownership), and this call site was never updated. This is an append-integration defect; it does not reopen IB04 or IB08.

**Repair** — production commit `466a48092ed280d9f66b54623ccd9bf4231953d1`, blob `3be0e1f849909a3b394c256b12dc09376f44df12`, body SHA-256 `9fa6ab28d88d367947ef5807761218f9e5264ba2fd8194da5a1338bb322236b3`.
- **Canonical path reused:** after the native clone is attached to the live gallery, `loadNextPage` now calls `enhanceThumbnail(clonedImg)`. That gives the card the same treatment as an initial card: card owner, owned classes and position, owned post ID, the action bar, admitted rendition via `applySiteThumbMedia(…, owner)` with `thumbRenditionByWrap` provenance, and native hover-attribute handling.
- **Removed:** the redundant manual class, post-ID and position writes, and the two owner-less calls.
- **Kept:** the clone sanitation that removes a copied `.be-thumb-actions` node before enhancement.
- **Unchanged:** duplicate filtering, page identity, the request flow, P2 liveness, paginator behaviour, page association, history, settings and the metadata-fetch policy. Host-specific behaviour stays governed by the existing functions; the IB08 scope is not broadened.

**Adjacent no-owner call — not changed:** `enrichThumbnails` still calls `applySiteThumbMedia(img, getWrapperForImg(img))` without an owner (the per-post metadata loop). That call returns `NATIVE_OUT_OF_SCOPE` immediately, for initial and appended cards alike. It is a pre-existing no-op and not needed for parity: appended cards now get their admitted rendition from `enhanceThumbnail` (P3-3). It is recorded as a separate pre-existing limitation, and enrichment is not redesigned.

**Regression:** `tests/host/ib12/p3_appended_card_parity.cjs` **5/5**. It runs real production in jsdom on an e621 listing using the IB08 card pattern, with a route-table `GM_xmlhttpRequest` and a triggerable observer.

| Check | Prior `3fcbf15` |
| --- | --- |
| P3-1 [G3] the appended card is present, with enhancer classes and post ID, and exactly one action bar whose action surface equals an initial card's | **fails** (no bar) |
| P3-2 [G3] owner lifecycle: re-enhancing does not duplicate the bar; gallery disposal removes the bar and reverts the owned classes and post ID, while the appended card stays | **fails** (unowned manual classes survive disposal) |
| P3-3 [G3] admitted e621 rendition parity: appended = initial = `OWNED_SAMPLE` (WebP srcset = the card's sample); disposal restores the native WebP srcset | **fails** (no rendition) |
| P3-4 out-of-scope context (not logged out): the appended card makes no rendition mutation | passes |
| P3-5 [preserved] P2: normal append stays live; a zero-unique page stops append and reveals the paginator | passes |

No mutant matrix (v1.1).

**Suite on the P3 working tree:**
- **Identical to the P2 record**, including:
  - IB08 rendition 66/66 and the disposal suites 24/24, 12/12, 14/14;
  - IB09 111/111;
  - IB12-P1 4/4 and P2 4/4;
  - the same historical/attributed classifications and package-verifier pins (no new pin failure).
- Historical result files rewritten by the run were restored unedited.

**Browser qualification:** not required. Owner lifecycle, the action bar and IB08 rendition semantics are already qualified; P3 is a call-site integration repair, established locally by the regression.

**P3 — appended-card enhancement parity: COMPLETE, PASS(scope)** (local deterministic evidence, per assignment). G3 is resolved.

**Provenance:** no donor code; original to this repository (MIT).
