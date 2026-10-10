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

## 5. Remaining-obligations audit (after E2; documentation only)

**Question:** what, if anything, still blocks IB12 from closing at its narrower qualified scope?

**Basis:** Blueprint §3 IB12, items 2–12. Production `466a480` (blob `3be0e1f`). Records: `IB12_BASELINE.md`, `IB12_E_STAGE.md` §1–§3, and this file §1–§4.

**Append activation boundary (source):**
- `setupInfiniteScroll` runs whenever `gallery.infiniteScroll` is on and the adapter finds a gallery container (`Booru_Enhancer.user.js` mount block; re-init in the body observer). There is no route admission.
- The next URL comes from each adapter:
  - **Danbooru** (`calculateNextUrl`, `:1847`) and **Moebooru** (`:2280`) synthesize `page + 1` without any native observation, on hosts that have no G-HOST row.
  - **gelbooru-family:** a native next link or the smallest advancing `pid` link, then a `pid` stride only after a real link was seen. This covers rule34.xxx, gelbooru.com, and the non-admitted safebooru, realbooru, tbib, xbooru and hypnohub.
  - **e621/e926:** native next-link selectors only, no synthesis. IB07 observed no matching link, so whether append starts at all is unknown.
- The Blueprint says:
  - "append on non-addressable routes" is forbidden (item 4);
  - "G-PLACE-T(route, tier), E → PASS before that restoration/append tier activates" (item 6);
  - "Unavailable append retains its preference inertly" (item 8).
- No route has a G-PLACE-T pass for append; only (e621, Tier 0) has passed. **Current append activation is therefore inconsistent with IB12's required final boundary.** P2 and P3 made append safe and complete where it runs, but did not bound where it runs.

| Remaining obligation | Current production | Evidence / gate | Blocks IB12 close? | Recommended next action |
| --- | --- | --- | --- | --- |
| **Tier-0 return** (last viewed → opener → fallback; one close-time correction) | P1 (`ba6e600`, carried forward) | G-PLACE-T(e621, Tier 0) E PASS; P1 COMPLETE in TC (regression 4/4; real Chrome P1 TIER0 QUALIFIED) | **No**, for e621. The mechanism is host-independent viewer code and runs on every host; it is qualified on e621 only. | **Scope statement for designer acceptance:** Tier 0 is qualified on e621 `/posts` (TC); on other hosts it is the same viewer code, unqualified per route. No new evidence is proposed. |
| **Tier-1 correction** (session anchor / native-page correction) | Not implemented | Rule34 E2: normal Back is fully native (BFCache); fresh load not achieved; e621 not observed | **No.** It is an optional, unactivated tier. | None. OPEN / NOT ACTIVATED. |
| **Tier-2 page association / restoration** | Not implemented: no page association, no URL replacement | Rule34 native-page check NON-DIAGNOSTIC; no route passes | **No.** It is an optional, unactivated tier. | None. OPEN / NOT ACTIVATED. |
| **Append route admission** | **Not bounded.** Append runs on every matched host with a container, including synthesized `page + 1` on non-admitted Danbooru/Moebooru; no G-PLACE-T append pass exists for any route. | Blueprint items 4, 6, 8 | **Yes — the actual blocker.** | One production item: gate automatic append by route admission. Unadmitted routes keep native pagination and retain the saved preference inertly. Which routes are admitted is a designer decision (see recommendation). |
| **Native paginator recovery** | P2: loop and zero-progress reveal; ordinary failure, empty and end reveal (pre-existing) | P2 regression 4/4 | No | None. |
| **Readable appended-content preservation** | Kept on failure, termination and gallery dispose (only enhancer-owned changes revert) | P2-4, P3-2 | No | None. |
| **History/state preservation** | No `pushState`/`replaceState` writes; the SPA watcher only wraps | E0 §1.5; E2 normal Back `history.state` unchanged | No | None. |
| **Settings/preference preservation** | `gallery.infiniteScroll` untouched by P1–P3; IB05 provenance; no new Auto/append-off policy | IB05; P2 (runtime stop, not a settings change) | No today. It becomes part of route admission ("retains its preference inertly"). | Covered by the route-admission item. |
| **G1 / G2 / G3** | Resolved (P2, P3) | P2 4/4, P3 5/5 | No | None. |
| **Deterministic append failures** (item 9: 403/429/malformed/duplicate/loop/end beyond all retry windows) | Behaviour present: the IB06 gate makes 401/403 and 429 terminal and retries 5xx/transport within a finite budget; any terminal failure → `ERROR` + paginator revealed | P2 covers 404, malformed, empty, end, loop and duplicate. **403, 429 and 5xx-after-retry-exhaustion are not in a regression.** | **Minor — required test coverage, not a product defect** | Add 403, 429 and 5xx-retry-exhaustion cases to the next item's regression (no separate item). |
| **Explicit disposal / ownership** | Gallery `dispose()` restores the paginator and disposes card and hover owners; appended cards are owned since P3 | IB08 dispose suites 24/24, 12/12, 14/14; P3-2 | No | None. |

**Classification:**
- **Required for a narrower valid IB12 close:** append route admission (the actual blocker), plus the missing 403/429/retry-exhaustion regression cases.
- **Optional / unactivated tiers:** Tier 1 and Tier 2 on every route.
- **Accepted limitations:** E2 fresh-load path unqualified; native `pid`-page check non-diagnostic; P2 zero-progress stop; Tier-0 per-route scope (pending acceptance); the `enrichThumbnails` owner-less no-op.
- **No other blocker found.**

## 6. P4 — automatic append route admission

**Admission decision (designer):** automatic append is admitted **only on the `rule34.xxx` native listing route** (`index.php?page=post&s=list`). Tags are ordinary parameters of that route; there is no tag allowlist.

**Evidence basis** (append-route admission only):
- IB07 observed a native next link (`page=post&s=list&pid=42`).
- IB12-E2 (E2R2) observed production follow two advancing native listing addresses (`pid` 42, 84), both on the same native route.
- Normal Back restored the appended DOM and place through native BFCache, with no enhancer reconstruction and no history writes.
- **This does not pass or activate Rule34 Tier 1 or Tier 2.** G-PLACE-T(rule34, Tier 1/2) stays OPEN / NOT ACTIVATED.

**Not admitted** (saved preference retained, inert):
- **gelbooru.com:** its next link was only observed (IB07), with no append observation.
- **e621 / e926:** no native next link was observed (IB07).
- **Danbooru and the Moebooru family:** no G-HOST row; their adapters synthesize `page + 1` without observation.
- **Generic fallback, and the other Gelbooru-family hosts** (safebooru, realbooru, tbib, xbooru, hypnohub): no G-HOST row.
- **Rule34 post pages and other Rule34 routes.**

**Implementation boundary** — production commit `11af9f6de2b47c7b9d13caffd211483102e69ae1`, blob `8d828cd852f74022cda79d4b2d2f86a16b137165`, body SHA-256 `d218b9a22b4e02f076a890a5af0d6df6da2a55605feb8d63d554599e1256085f`:
- **The predicate:** one narrow helper, `appendAdmitted()`, true only for hostname `rule34.xxx` + active adapter `gelbooru-family` + pathname `/index.php` + `page=post` + `s=list`. There is no capability registry or route framework.
- **Where it sits:** `setupInfiniteScroll()` checks it after removing any previous observer and sentinel. When it is false, the function restores the paginator if the enhancer had hidden it and returns: no sentinel, no observer, so no `gallery-pagination` request and no synthesized continuation.
- **Coverage:** all three activation paths go through `setupInfiniteScroll` — startup mount, body-observer re-init and the live `gallery.infiniteScroll` toggle.
- **Native continuation:** on Rule34, append still starts from a real native advancing page address. The Gelbooru-family `getNextUrl` prefers the native next link, and the `pid` stride is learned only after a real link was seen. Without a usable native continuation, append stays unavailable.
- **Preference inert:** route admission never writes the setting. The stored value follows only the operator.
- **Adapters unchanged:** the Danbooru, Moebooru and generic `calculateNextUrl` synthesis remains in the source but is now **unreachable by automatic append**. Removing it is separate cleanup, not needed for IB12.

**Regression:** `tests/host/ib12/p4_append_route_admission.cjs` **10/10**. It runs real production in jsdom, with a route-table `GM_xmlhttpRequest`, a triggerable observer, and pass-through counters on `BE.net.request` and `calculateNextUrl`.

| Check | Prior `466a480` |
| --- | --- |
| P4-1 Rule34 admitted listing: sentinel/observer install; the trigger requests the native next page (`pid` 42), then 84; unique posts append; the paginator hides only after success; no synthesis | passes |
| P4-2 Rule34 `s=view` (gallery container present): not admitted; no sentinel, observer or request; paginator native; preference true | **fails** (global append) |
| P4-3 gelbooru.com (same adapter, native next link): adapter membership is not admission; inert; preference unchanged | **fails** |
| P4-4 Danbooru, whose `calculateNextUrl` could synthesize `page=2`: never invoked; zero requests; no sentinel | **fails** |
| P4-5a unadmitted route: true at startup → inert; toggled false → inert; toggled true → inert; exactly the operator's two writes | **fails** |
| P4-5b admitted Rule34: disabling removes the sentinel/observer and restores the paginator; re-enabling restores append | passes |
| P4-6 preserved P2/P3 on Rule34: loop → paginator visible, terminal; zero-unique → paginator visible, no chase; appended action bar = initial; disposal reverts it | passes |
| P4-7 403 after a success: terminal (one attempt), paginator visible, content kept | passes |
| P4-8 429 after a success: terminal after the gate's rate-limited handling (one attempt), paginator visible, content kept | passes |
| P4-9 5xx on every attempt: the finite budget (4 attempts) is used, then append stops; paginator visible; content kept; no further request | passes |

The prior fails exactly the four unadmitted-route checks. The **403/429/5xx cases close IB12 item 9's missing deterministic append coverage**. They pass on the prior too: they are missing coverage, not ruled defects.

**Suite on the P4 working tree:**
- **Identical to the P3 record**, including IB08 66/66 and the disposal suites, IB09 111/111, IB12-P1 4/4, and the same historical/attributed classifications and package pins.
- **Two intended, P4-attributed changes:**
  - `p2_append_liveness.cjs` **0/4** and `p3_appended_card_parity.cjs` **0/5**. Both closed regressions use e621 fixtures, where automatic append is now intentionally not admitted.
  - Their behaviours are re-established on the admitted Rule34 route by P4-6 (loop, zero-progress, appended-card parity and disposal) and P4-7 to P4-9.
  - P3-3's e621 IB08 rendition parity for appended cards is now moot rather than lost: no appended cards exist on e621.
  - The closed tests are not edited.
- Historical result files rewritten by the run were restored unedited.

**Browser qualification:** not required. The route boundary is deterministic in the production-code regression, and Rule34's admitted path is the native mechanism already observed in real Chrome (E2R2).

**P4 — automatic append route admission: COMPLETE, PASS(scope).** IB12 itself is not closed here; that is a separate designer closeout.

**Provenance:** no donor code; original to this repository (MIT).

## 7. Closeout regression realignment (tests and records only)

**Why:** P4 narrowed automatic append to the Rule34 native listing. The P2 and P3 permanent regressions used e621 fixtures under the then-global append, so after P4 they reported 0/4 and 0/5. Those were not product regressions, but permanently red "permanent regressions" would make the suite misleading. Production is unchanged (`11af9f6`, blob `8d828cd`).

**History is preserved:**
- P2 (§3) and P3 (§4) were qualified with e621 fixtures while append was global. Their recorded results stay historically valid for the production on which they were collected.
- P4 (§6) later narrowed automatic append to Rule34.
- The permanent regressions were then realigned to that surviving scope. The P2/P3 qualification commits and their results are not rewritten.

**`tests/host/ib12/p2_append_liveness.cjs` — realigned to the Rule34 native listing (`pid` pagination, native next links): 4/4.**
- The same four checks:
  - G1 visited-page loop;
  - G2 zero-unique page, no chase;
  - normal append fetches the native advancing page and stays eligible;
  - 404, malformed, empty and native end reveal the paginator and keep appended cards.
- The pre-P2 artifact `ba6e600` (global append, so it runs on Rule34) still **fails G1 and G2** and passes 3 and 4.

**`tests/host/ib12/p3_appended_card_parity.cjs` — realigned to the Rule34 native listing: 4/4, with 2 retired.**
- **Run on Rule34:**
  - P3-1: enhancer classes, post ID, exactly one action bar, action surface equal to an initial card's;
  - P3-2: re-enhancement does not duplicate; disposal reverts owned UI and keeps the native appended card;
  - P3-6: the appended card enters the canonical owner path, with its rendition provenance recorded exactly as for an initial card;
  - P3-5: P2 liveness preserved.
- The pre-P3 artifact `3fcbf15` **fails P3-1, P3-2 and P3-6** (the owner-less defect) and passes P3-5.
- **Retired, not run:** the former P3-3 (appended-e621 `OWNED_SAMPLE` rendition parity) and P3-4 (appended-e621 out-of-scope rendition) — **SUPERSEDED BY P4 ROUTE ADMISSION — e621 automatic append unavailable; no appended-e621 rendition claim remains.** No impossible appended-e621 card is simulated. Ordinary e621 IB08 rendition of native cards stays covered by IB08 (66/66) and is not reopened.

**`tests/host/ib12/p4_append_route_admission.cjs` — 11/11.**
- Added P4-4b: **e621 and e926** `/posts` listings, with a gallery container and a plausible native next control, are not admitted. No sentinel, no active observer, zero `gallery-pagination` requests, native paginator untouched, preference true.
- The prior `466a480` fails it (global append), as it fails the other unadmitted-route checks.

**Surrounding suite (production `11af9f6`):**
- **IB12:** P1 4/4; P2 4/4; P3 4/4 (2 retired); P4 11/11.
- **IB08:** rendition 66/66; disposal suites 24/24, 12/12, 14/14.
- **IB09:** 111/111.
- **Unchanged historical classifications** (exactly as recorded at P3/P4):
  - IB01–IB07 pass, except the IB07 blob pins (`item9`, `pagecount`);
  - IB10 64/67 (P7-attributed);
  - E0 25/38, fault controls 37/46;
  - IB11 P1–P5 as attributed; P6 15/15; P7 28/29 (P7-23 focus-attributed); P8 24/25 (P8-13 IB12-P1-attributed); P9 12/12;
  - recoveries 28/28 and 32/32;
  - the G-PLAY, V-VIEW and IB11 P1–P9 package verifiers and the IB12 E1/P1 package verifiers fail only their superseded working-tree production pins.
- Historical result files rewritten by the run were restored unedited.

**Result:** no current-production P2/P3 failure attributable merely to e621 append being disabled. The realigned P2/P3 and P4 (with e621/e926) are green. There is no new product failure.

## 8. IB12 final checkpoint closeout (designer decision)

**IB12 — Tiered place restoration and bounded traditional append: COMPLETE, PASS(scope).** This is a deliberately narrower Blueprint-v1.1 closure. It does not claim every optional restoration tier or every host. Documentation only: no production, test or probe change.

**Synchronized identity:**
- HEAD `e3ef764760b014fd839ed2902e2d7c11969c48fc`.
- Production `11af9f6de2b47c7b9d13caffd211483102e69ae1`, blob `8d828cd852f74022cda79d4b2d2f86a16b137165`, body SHA-256 `d218b9a22b4e02f076a890a5af0d6df6da2a55605feb8d63d554599e1256085f`.

### Qualified final scope

- **Tier 0 — G-PLACE-T(e621, Tier 0): PASS.**
  - P1 is COMPLETE. Its real-Chrome confirmation established: A → off-screen C; close returns to C with one bounded correction; C visible and focused.
  - The regression established the missing-C opener fallback and no unrelated-card jump.
  - The same viewer implementation exists on other hosts, but **no Tier-0 qualification is claimed for them from code sharing alone**.
- **Rule34 automatic append:**
  - **Where:** admitted only on `rule34.xxx/index.php?page=post&s=list` with the Gelbooru-family adapter.
  - **Preference:** the saved `gallery.infiniteScroll` preference is preserved. On every other route it is inert, and native pagination stays authoritative.
  - **Supported by:** the native Rule34 next-page evidence (IB07); the E2 observation of advancing native `pid` addresses; the P4 route-admission regression; the P2/P3 liveness and ownership regressions realigned to Rule34; and the deterministic append-failure coverage (403/429/5xx).
  - **This is not a Tier-2 restoration PASS.**
- **Rule34 native Back (observed):** normal browser Back restored the appended Rule34 DOM, the exact scroll position and a visible C entirely through BFCache. There was no reconstruction, no enhancer request, and `history.state` was unchanged. Native behaviour was sufficient for that observed workflow.

### Unactivated tiers

- **Rule34 Tier 1 — OPEN / NOT ACTIVATED.** No production Tier-1 session-anchor correction exists.
- **Rule34 Tier 2 — OPEN / NOT ACTIVATED.** No production Tier-2 page-association/restoration integration exists.
- The fresh-load case was not established, so proportional qualification did not justify adding those mechanisms merely to make the tiers exist. **These OPEN rows are accepted, unimplemented capability boundaries, not unfinished IB12 blockers.**

### E2 final disposition

**E2 CLOSED — FRESH BACK NOT ACHIEVED.**
- Normal Back gave valid positive BFCache evidence. The probe's attempted fresh-load Back still used BFCache.
- Per the predetermined stop rule: no further BFCache-defeat machinery was built, no negative conclusion is drawn about fresh-load product behaviour, and no further owner run is required.
- The native `pid` page check is **NON-DIAGNOSTIC — readiness/timing not established**. It is not cited as proving either that C is or that C is not on that native page.

### P-stage final state

| Item | Status | Current-scope regression |
| --- | --- | --- |
| **P1** — Tier-0 last-viewed viewer return | **COMPLETE, PASS(scope)** (e621, TC) | 4/4 |
| **P2** — append liveness / native paginator recovery (G1, G2 resolved) | **COMPLETE, PASS(scope)** | 4/4 (realigned to Rule34) |
| **P3** — canonical appended-card enhancement/ownership (G3 resolved) | **COMPLETE, PASS(scope)** | 4/4 (realigned to Rule34) |
| **P4** — automatic append route admission (Rule34 native listing only) | **COMPLETE, PASS(scope)** | 11/11 |

The two former appended-e621 rendition tests remain recorded as **SUPERSEDED BY P4 ROUTE ADMISSION — e621 automatic append unavailable**. They are non-applicable, not failures. Ordinary e621 rendition stays covered by IB08.

### Accepted limitations (non-blocking)

- Fresh-load traditional return remains unqualified.
- The E2 native-page check was non-diagnostic.
- Tier-0 qualification is route-scoped to e621.
- Tier 1 and Tier 2 remain unactivated.
- A valid append page with zero unique new posts stops automatic append and exposes native pagination, rather than chasing another page.
- The pre-existing owner-less `applySiteThumbMedia` call in `enrichThumbnails` remains an inert no-op. Appended cards already enter the canonical P3 enhancement path, and no user-facing defect has been demonstrated from it.
- The historical Danbooru, Moebooru and generic pagination synthesis remains in adapter code but is unreachable from automatic append after P4. Removing it is not an IB12 requirement.

### Blueprint acceptance statement

IB12 closes under Blueprint v1.1's proportional qualification rule:
- native behaviour is preferred where sufficient;
- unavailable or unqualified tiers stay inactive;
- no reconstruction journal was introduced;
- no preceding appended pages are fetched on return;
- no generalized GalleryPage/cursor abstraction was added;
- no SPA history ownership was added;
- production makes no enhancer `pushState` or `replaceState` writes;
- failure stays bounded and returns control to native pagination;
- the saved append preference survives even where the capability is unavailable.

**No known significant IB12 defect remains within the qualified scope.**

### Gates and downstream effect

- `G-PLACE-T(e621, Tier 0)` — **PASS**
- `G-PLACE-T(rule34, Tier 1)` — **OPEN / NOT ACTIVATED**
- `G-PLACE-T(rule34, Tier 2)` — **OPEN / NOT ACTIVATED**
- Other traditional-host Tier-1/2 rows stay **OPEN** unless independently qualified later. There is no blanket G-PLACE-T pass.
- IB12 opens its qualified place/append primitives for later checkpoints, **without granting SPA history authority**.
