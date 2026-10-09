# IB12 — E0 baseline: traditional place restoration and append

**Checkpoint:** IB12 — Tiered place restoration and bounded traditional append (Blueprint §3 IB12). **Stage:** E0 baseline (source inspection only).

**Result: E0 baseline recorded.** No production change, no probe, no browser run. **G-PLACE-T is OPEN for every route.** Blueprint v1.1 proportional qualification governs.

## 0. Synchronized identity

| Item | Value |
| --- | --- |
| Branch / HEAD | `implementation/ib00-baseline` at `c66ed72386bf1195233d3a88ee0c47af72768733` = origin; tree clean |
| Blueprint | Version 1.1 (9 October 2026), amendment `1a15eeb`, blob `fe2b98cd2f294fef4ed2cd0053dc9d13bff05be6` |
| Production | commit `ac3c9e8e4fbf425fa473ceae0dfa5b36640f03b3`, blob `db5484396de60a90711e3b566fb8f6bbc10b3181`, body SHA-256 `d64df2a6ec8a3b5985ea5ab3f8e425cee4f1608f11c3308de37b94fd1d138127` (product `@version 1.2.7.3`) |
| Prior state | IB11 COMPLETE, PASS(scope) in TC; IB12 NOT STARTED before this record |

No mismatch. All line numbers below refer to `Booru_Enhancer.user.js` at blob `db54843`.

**Evidence classes:**
- **SRC** — read from current source;
- **REC** — an earlier checkpoint record;
- **UNKNOWN** — needs browser observation (not inferred).

## 1. Current production behaviour

### 1.1 Gallery initialization and the append setting

- **Mount** (SRC 5694–5705): `BE.modules.init` finds the adapter's gallery container, calls `gallery.init(container)`, then calls `setupInfiniteScroll()` only if `gallery.infiniteScroll` is true and a container exists.
- **Setting** (SRC 901–905): `gallery.infiniteScroll` is a bool, default `true`, labelled "Infinite scrolling".
  - **IB05 provenance** (REC `IB05_SETTINGS_GATE.md` §Policy; SRC 1018–1021): ambiguous empty storage resolves to `true`. The only provenance distinction is `AMBIGUOUS_EMPTY` vs `LEGACY_OR_EXISTING`, for the store as a whole. There is no per-key "user chose this" flag.
  - **Effective behaviour:** append is on for every matched host that has a gallery container, admitted or not.
  - **Live toggle** (SRC 4154, 4175–4184): turning the setting off disconnects the observer, removes the sentinel and restores the paginator. Turning it on re-runs setup.
- **Re-init** (SRC 4096–4113, 4084–4095): `init` on a *different* container tears down the old observer, sentinel and owners, then resets page-scoped state (`loadedPostIds`, `visitedPageIdentities`, `nextPageUrl`, `state`). Re-init on the same container is idempotent (`data-be-gallery-init`).
- **Body observer** (SRC 5759–5774): re-initializes only when the adapter returns a container that is genuinely new and not disposed. It then re-runs `setupInfiniteScroll` if the setting is on.

### 1.2 Infinite append (`setupInfiniteScroll`, `loadNextPage`)

- **Trigger** (SRC 4672–4699): one sentinel `div` is placed after the gallery container. An `IntersectionObserver` with `rootMargin: 600px 0px` calls `loadNextPage()` when the sentinel is intersecting and the state is `IDLE`. The paginator element is located but **not hidden** at setup.
- **Next URL** (SRC 4707–4717): `nextPageUrl` (from the previous page), else `adapter.pagination.getNextUrl(document)`, else `adapter.pagination.calculateNextUrl(location.href)`. If none: `EXHAUSTED`.
- **Loop guard** (SRC 4719–4725): `getPageIdentity(nextUrl)` already in `visitedPageIdentities` → `EXHAUSTED`. The *starting* page's identity is never added to the set: only fetched pages are (SRC 4747).
- **Request** (SRC 4730–4743): `BE.net.request`, `lane: 'background'`, operation `gallery-pagination`, retries 3.
  - The IB06 gate classifies the response (SRC 1415–1427): 401/403 → auth-required; 404 → not-found; 429 → rate-limited, terminal for this operation, with an optional Retry-After cooldown (SRC 1549–1556); 5xx/transport → transient, retried within the finite budget (SRC 1557).
  - An extra `detectAuth` heuristic treats any 2xx body containing both "login" and "password" as auth-required (SRC 4739–4742).
- **Parse and insert** (SRC 4749–4812): the response is parsed with `DOMParser`. Missing container → throw (→ `ERROR`). Zero thumbnails → `EXHAUSTED`, paginator restored.
  - Each thumbnail whose post ID is not in `loadedPostIds` is cloned and appended to the end of the live container (SRC 4805). Duplicates by post ID are skipped. `loadedPostIds` is seeded from the initial DOM (SRC 4067–4082).
  - **No page association is recorded.** Appended cards carry `be-thumb-wrap`, `be-thumb-img` and `data-be-post-id` only. Production does not know which appended card came from page 2 or page 3.
- **After insert** (SRC 4821–4846): the next URL is read from the fetched document (or calculated). None → `EXHAUSTED` + paginator restored. Zero new posts → `IDLE` + paginator **hidden**. Otherwise `IDLE` + paginator hidden. The paginator is hidden only after a successful load.
- **Failure** (SRC 4848–4857): any throw → `ERROR` (terminal for this page context), paginator restored, appended cards kept.
- **Paginator hiding** (SRC 4651–4670, 4993–4995): the class `be-pagination-hidden` (`display:none !important`) on the first element matching the adapter's `containerSelectors`. It is restored only if this module hid it.
- **Dispose** (SRC 4860–4873): disconnects, removes the sentinel, restores the paginator and disposes owners. **Appended cards remain in the container** (they are not owned; see G3).
- **Never done:** no URL or history update when an appended page "becomes current"; no reconstruction of earlier pages; no persisted append state; no viewer-driven append (viewer navigation is limited to the currently loaded cards, SRC 4232–4237, 4271–4279).

### 1.3 Adapter pagination facts (admitted traditional hosts only)

| Adapter (hosts) | `getNextUrl` | `calculateNextUrl` | `getPageIdentity` | Source of truth |
| --- | --- | --- | --- | --- |
| `e621` (e621.net, e926.net) (SRC 2437–2459) | first match of `a[rel="next"]`, `a.next`, `#paginator a[rel="next"]`, `nav.paginator a[rel="next"]`, `section#paginating-nav a[rel="next"]` | always `null` (IB07: no synthetic continuation) | the `page` query value, else the `b` or `a` query value, else `'1'` | IB07 V1-N: **no native next link was observed** with the tested selectors; pagination continuation is **OPEN** for both hosts (REC `IB07_E621_V1N.md` §Pagination, `IB07_E926_V1N.md` §Pagination). Whether these selectors match today is UNKNOWN. |
| `gelbooru-family` (admitted: rule34.xxx, gelbooru.com) (SRC 2066–2122) | the native next link (`#paginator a[alt="next"]` and similar); else the smallest advancing `pid` link | `pid + observed page size`, only after a real next link was seen (≤ 200) | `tags|s|pid` | Rule34 V1-N observed a native next link `?page=post&s=list&pid=<n>` (REC `IB07_RULE34_V1N.md` §Native pagination). Gelbooru V1-N observed `#paginator a[alt="next"]` with `page`, `s`, `tags`, `pid` (REC `IB07_GELBOORU_V1N.md`: "observed only; qualification belongs to G-PLACE-T / IB12"). |

**Not admitted** (no G-HOST row; REC `IB07_HOST_FACTS.md`):
- `danbooru` (SRC 1832–1853): `calculateNextUrl` synthesizes `page + 1` without observation.
- `moebooru`, `generic`, and the other gelbooru-family hosts (safebooru, realbooru, tbib, xbooru, hypnohub).

These are not classified here beyond "unsupported / evidence needed". Note, though, that **current production runs append on them today**: the setting is global and the userscript matches those hosts (SRC header 9–23).

### 1.4 Viewer open/close, focus return and "last viewed"

- **Open** (SRC 4281–4288, 3870–3881): a card click opens the viewer with `context.origin` = the card's native link and `context.fallback` = the paginator element. In-viewer next/prev re-opens through the same path for the neighbouring loaded card. Since P8, the return origin therefore follows in-viewer navigation (A → C ⇒ origin = C's link).
- **Close** (SRC 3966–3986): hides the overlay, clears media, and — if focus was in the viewer or on body — focuses the origin, else the fallback, **with `preventScroll: true`**. Both targets are then nulled.
- **Last viewed after close:** nothing is retained. There is no last-viewed post ID, no session record, and no persistent anchor (SRC grep: no `sessionStorage`, `scrollTo`, `scrollIntoView`, `scrollBy`, `scrollRestoration`, `pageshow` or `pagehide` anywhere).
- **Page scroll while open:** the viewer does not lock or move page scroll, so the page stays where A was opened.

**Focus return vs place restoration:**

| Case | What happens today |
| --- | --- |
| Close after viewing A only | Focus returns to A's link. The page did not move, so A is still where the user left it. **Place is unchanged.** |
| Close after A → C (C still in DOM, possibly off-screen) | Focus moves to C's link **without scrolling**. The visible place stays at A while keyboard focus sits on an off-screen C. There is no scroll to C. |
| Close when C was removed/re-rendered | `usableReturnTarget(C)` fails (disconnected/not rendered), so focus goes to the paginator fallback if rendered — but while append is active the paginator is `display:none`, so it fails too and focus stays where it was (body). No scroll correction, no recovery of C. |
| Persistent/session anchor | None. |

### 1.5 Native history

**Production writes to `history.pushState` / `history.replaceState`: none.**

| Site | Kind |
| --- | --- |
| SRC 5743–5750 | **Wraps** `history.pushState`/`replaceState` (calls the original, then a debounced URL-change refresh of toolbar/post-bar UI and adapter re-detection). Observation only; arguments and `history.state` are passed through unchanged. |
| SRC 5751 | `popstate` listener → the same refresh. Observation only. |
| SRC 5294, 5298 | Post-page toolbar prev/next: `location.href = <native link>` (an ordinary navigation that creates a normal history entry; not a history-API write). |
| SRC 3439, 4493, 5279–5280, 5361 | `window.open` (new tab/window; no history change in this tab). |

No production code reads or writes `history.state`. The SPA watcher stays as it is (out of scope here).

## 2. Route / tier classification (source facts only)

| Route | Tier 0 (last-viewed / opener) | Tier 1 (session anchor / native-page correction) | Tier 2 (native page-addressable append association) | Notes |
| --- | --- | --- | --- | --- |
| **rule34.xxx** listing `index.php?page=post&s=list[&tags=…]&pid=<n>` | **Candidate** | **Candidate** (the native `pid` URL is a real page address) | **Candidate, evidence needed**: a native next link was observed (IB07); the `pid` offset is a real native page address and production already follows the native link. Page size and stability (listing shift) are unmeasured. | Most complete traditional evidence today. |
| **gelbooru.com** listing (same scheme) | Candidate | Candidate | Candidate, evidence needed (next link "observed only") | Same adapter as Rule34; needs its own host confirmation (no inheritance, IB07). |
| **e621.net** `/posts[?tags=…]` | **Candidate** (host-independent viewer path) | **Evidence needed**: no native page address observed; `page` values may be numeric or cursor-like, which source treats as opaque | **Unsupported / evidence needed**: no native next link observed (IB07). A cursor or "next" URL alone would not qualify. | Whether production's append ever starts on e621 today is UNKNOWN. |
| **e926.net** `/posts` | Candidate | Evidence needed | Unsupported / evidence needed | Shares e621's adapter; separate observation required (IB07 no-inheritance). |
| Danbooru, Moebooru, other gelbooru-family, generic | — | — | **Unsupported / evidence needed** (not G-HOST admitted) | Append currently runs there by legacy default (see G5). |

## 3. Meaningful gaps

### Confirmed defects (source)

- **G1. Loop termination leaves the native paginator hidden.** After at least one successful append the paginator is hidden. If the next identity has already been visited, the loop branch (SRC 4721–4725) sets `EXHAUSTED` and returns **without** `restorePaginatorVisibility()`. The user is left at the end of the appended content with no native pagination. This violates IB12 item 10 ("failure stops appending and reveals paginator"). Related: the starting page's identity is never seeded (SRC 4747), so a next link pointing back to the start page is fetched once more before the guard can act.
- **G2. A duplicate-only page stalls with the paginator hidden.** When a fetched page adds zero new posts, the code sets `IDLE` and hides the paginator (SRC 4832–4840), expecting the chain to continue. Nothing was appended, so the sentinel stays intersecting. An `IntersectionObserver` reports only changes, so no new callback fires. Append stalls until the user scrolls far enough away and back, and the paginator stays hidden meanwhile. (The source reading is definite; the real-browser magnitude belongs in the deterministic append cases.)
- **G3. Appended cards are not enhanced like initial cards** (incidental; outside the place tiers). `loadNextPage` calls `buildThumbActions(clonedWrap, clonedImg)` and `applySiteThumbMedia(clonedImg, clonedWrap)` without the `owner` argument (SRC 4807–4808). Both functions return early without an owner (SRC 4299, 4403), so appended cards get **no action bar and no IB08 rendition**, and no card owner. The `owner` parameter was introduced by `edeabcd` (IB04 ownership); this call site was not updated. The header comment (SRC 145–148) claims parity, which source contradicts. **Designer classification needed:** this is an appender defect, but it touches IB04/IB08 behaviour.

### Missing enhancements (the IB12 tiers)

- **M1 (Tier 0):** after A → C and close, nothing brings C into view. Focus return deliberately uses `preventScroll`, and no last-viewed identity exists. When C is gone there is no opener fallback beyond a paginator that may be hidden.
- **M2 (Tier 1):** no session anchor. After a fresh-load Back to a page whose content was extended by append, the appended cards are gone. Where the browser's native scroll restoration lands is UNKNOWN.
- **M3 (Tier 2):** appended cards carry no native-page association; the visible URL never changes. After a failure, the revealed paginator is the *starting* page's, so its Next leads to native page 2, content the user has already seen appended.

### Acceptable limitations (proposed for operator acceptance)

- A native page's contents shift as new posts arrive (offset addressing), so the "page 3" anchor may move between pages.
- Identical URLs in history are indistinguishable to the enhancer: there are no `history.state` writes, by design.
- Viewer navigation stops at the last loaded card and does not trigger append (preserved behaviour).

### Unknown — needs browser observation

- **U1:** BFCache eligibility of a listing page with the userscript active (Tampermonkey; possibly in-flight `GM_xmlhttpRequest`), and what is restored on BFCache Back (appended cards, scroll).
- **U2:** fresh-load Back after append: where native scroll restoration lands in the shorter document.
- **U3:** whether e621/e926 append starts at all (whether the next-link selectors match).
- **U4:** whether the `detectAuth` "login"+"password" heuristic false-positives on real listing HTML (a failure would be safe: paginator restored).
- **U5:** page size and the listing-shift rate for `pid` routes.

## 4. Preserved behaviour (Blueprint IB12 item 8)

These must survive any IB12 P change:
- **Native pagination and history payloads:** no enhancer history writes; `history.state` is untouched (§1.5).
- **Viewer navigation:** next/prev over loaded cards; focus ownership and return (P8).
- **Saved legacy append preference:** `gallery.infiniteScroll`, default true; IB05 provenance. "Unavailable append retains its preference inertly" means a route without G-PLACE-T keeps the stored value but does not act on it.
- **Readable appended content after ordinary failure:** kept today (§1.2).
- **Native paginator recovery:** on empty page, end and failure (today's behaviour), extended to loop/duplicate termination by the G1/G2 repairs.

## 5. Recommended first V4-T check (not built)

### Route

**Recommend `rule34.xxx` listing (`index.php?page=post&s=list`, logged-out) as the first G-PLACE-T route**, for these reasons:
- It is the only admitted traditional route where a native next link with a real page address (`pid`) was observed (IB07).
- Production's append therefore actually runs there. One check can decide Tier 0 and Tier 1 and supply the Tier 2 page-address facts.

e621 is the better-known host for the viewer, but its native pagination is unobserved (U3). A V4-T run there today would measure native Back only.

**e621 / e926:**
- **Tier 0 (viewer close):** host-independent code, so the Rule34 result covers the mechanism.
- **Back/BFCache behaviour and native page addressing:** host-dependent and not inherited (IB07). Each host needs its own short check when it is claimed.
- **Before any e621 V4-T:** one passive observation (≈ 2 minutes) of whether production's next-link selectors match on `/posts`, and what page parameter the native paginator uses.
- **e926:** can share the e621 probe, but needs its own run.

### What it measures (current production, no corrections)

The probe would be an observer wrapping unchanged production. It records:
- navigation type;
- `pageshow.persisted`;
- `PerformanceNavigationTiming.notRestoredReasons`;
- `history.length` and `history.state`, before and after;
- `scrollY`;
- anchor-card rects;
- the enhancer's listing requests (`BE.net` operation `gallery-pagination` plus resource timing);
- focus target;
- user-input timestamps.

| # | Blueprint item 9 behaviour | Observation |
| --- | --- | --- |
| 1 | A → C viewer close | After two appends, open A on appended page 3, press → twice, close. Record focus target (C), C's rect and visibility, and `scrollY` before and after. Today's expectation: focus on C, no scroll. |
| 2 | Missing C / opener fallback | The probe detaches C while the viewer is open, then the operator closes. Record the focus outcome and scroll. |
| 3 | BFCache Back | Leave the listing through a same-tab navigation to C's post page, then a trusted browser Back. Record `persisted`, whether appended cards and scroll are restored, and `history.state`. |
| 4 | Fresh-load Back | Same as 3, with BFCache made ineligible by the probe only (for example a probe-added `unload` listener, confirmed through `notRestoredReasons`). Record the landing `scrollY` and anchor position. |
| 5 | Native page-3 anchor | Open the native `pid` URL of page 3 fresh. Record whether the anchor card is present and at what index. |
| 6 | No earlier-page fetches | During 3–5, the enhancer must make zero listing requests for `pid` below the landing page. |
| 7 | Duplicate-URL visits | Visit the same page-3 URL twice in history. Record that the entries are indistinguishable (`history.state` null/unchanged). The limitation is for operator acceptance. |
| 8 | One layout-settle observation | The anchor rect at `load` and again 1000 ms later (image settling). |
| 9 | Input cancels correction / ≤ initial + one settle | Today there are **zero** enhancer corrections (record the count = 0). Record whether native scroll restoration moves the page after the operator's first wheel input. The actual interruption test belongs to the P stage, once a correction exists. |

**Operator interactions** (one tab, about 3 minutes, about 10 actions):
1. Open the start URL.
2. Scroll until two pages have appended.
3. Click card A (marked by the probe).
4. Press → twice; Esc.
5. Press "detach C and reopen" (probe button), then Esc.
6. Press "go to C's post page" (probe button: same-tab navigation, equivalent to following the card link with the viewer bypassed). Then browser Back.
7. Press "arm fresh-load variant"; repeat step 6.
8. Press "open native page 3" (probe button). Then Back, Forward.
9. Return the results file.

The probe would make no settings writes and no account actions.

**Not proposed:** no mutant matrix and no runtime/browser permutations. The deterministic append failure cases (403/429/malformed/duplicate/loop/end beyond retry windows) are **local controlled-fixture regressions**, not live operator checks. Under v1.1 they accompany the G1/G2 repairs.

## 6. Explicit exclusions

- No production change, no probe, no qualification package, no browser run (this record).
- No Tier 0/1/2 implementation; no infinite-scroll or viewer change; no history change; the SPA watcher is unchanged.
- Pixiv route observation belongs to IB16. IB13 and later are not started.
- No reconstruction journal, no earlier-page fetching, no generalized page/cursor model, no SPA push/replace (Blueprint IB12 item 4).
- Hosts without G-HOST admission are not classified beyond "evidence needed".

## 7. Outcome

**IB12 — E0 baseline: recorded.** **PARTIAL—NOT COMPLETE** (E stage open). G-PLACE-T: **OPEN** for every route and tier. Production unchanged at `ac3c9e8`.

**Next:** designer review of this baseline, in particular:
- the route choice (§5);
- the G3 classification;
- whether G1/G2 enter IB12 P as appender failure-handling items.

**Provenance:** no donor code; source inspection of this repository only (MIT).
