# IB10 — V3-R revisit/cache discriminator (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle.
- **Gate:** G-VIDEO(class, cell) is already E → PASS(scope) (`IB10_V3L.md` §8, commit `47e7ccb`). V3-R resolves the one open owner decision before the P stage: the source-retention and revisit policy.
- **Settled (not reopened):** 200 ms dwell; viewer opening ends the hover; original-file source.
- **Status: prepared and locally qualified; the operator run is pending. No evidence has been collected yet.** Production is commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, **unchanged**.

## 1. Question
After a ready, buffered hover video is properly released on leave (pause, remove `src`, `load()`), is a return to that same video still fast? Does it reuse data, resume, or restart from zero?

Existing evidence (V3-C, V3-L) shows fast repeats only while another element for the same URL still holds its source. It never observes a revisit after releasing a **ready** element.

## 2. Files (`tests/browser/ib10/`)
| File | Role |
| --- | --- |
| `v3r_server.cjs` | Local server: fixture SHA-256 gate; cache arms; conditional handling; Range-throttled transport; per-request byte and header log; 16-cell plan; result collection |
| `v3r_postamble.js` | Scripted cell runner and per-variant identity check |
| `v3c_preamble.js` | Unchanged V3-C recorder and location shim (reused) |
| `build_ib10_v3r.cjs` → `IB10_V3R_Revisit.user.js` | Package with the AS-IS and RELEASE bodies; the cell selects which runs |
| `analyze_ib10_v3r.cjs` | Per-cell element and transport analysis; paired AS-IS vs RELEASE comparison |
| `verify_ib10_v3r.cjs`, `IB10_V3R_VERIFICATION.json`, `IB10_V3R_SHA256SUMS.txt` | Local qualification |

## 3. Variants
- **AS-IS:** the production body, byte for byte.
- **RELEASE:** the production body with exactly one inserted test-only line in `hide()`, after `stopCurrentMedia()` (which has already paused):

  `{ const v = hoverEl.querySelector('video'); if (v) { try { v.removeAttribute('src'); v.load(); } catch {} } }`

  This is the mechanism `cancelPendingUpgrade` already uses for a pending hover video. It is never production code.

## 4. The 16 cells
| Cache | Container | Gap | Variants |
| --- | --- | --- | --- |
| NO_STORE | MP4 | 0.5 s / 5 s | AS-IS, RELEASE |
| NO_STORE | WebM | 0.5 s / 5 s | AS-IS, RELEASE |
| CACHEABLE | MP4 | 0.5 s / 5 s | AS-IS, RELEASE |
| CACHEABLE | WebM | 0.5 s / 5 s | AS-IS, RELEASE |

- **Ordering:** AS-IS and RELEASE of each condition run back to back.
- **Cold URLs:** every cell has unique media URLs.
- **Transport:** Range-capable, throttled to 256 KiB/s (observability only).
- **NO_STORE:** `Cache-Control: no-store`. It removes ordinary HTTP-cache reuse and isolates Chrome's other shared media behavior.
- **CACHEABLE:** `Cache-Control: public, max-age=3600`, a strong per-URL `ETag`, and `Last-Modified: Thu, 01 Jan 2026 00:00:00 GMT`.
  - `If-None-Match` / `If-Modified-Since` without Range get 304.
  - A Range request with `If-Range` matching the ETag or date gets 206; a stale validator gets a 200 full body.
- **Not claimed:** nothing is inferred about e621/e926's real cache headers from this arm.
- **Deferred:** FAST (full buffer) and a 2 s gap, unless these 16 leave a concrete ambiguity.

## 5. Script per cell
1. Hover A until `loadeddata`, then stay 1000 ms (A meaningfully buffered).
2. Leave A. 20 ms later, hover B and leave it after 60 ms (a quick pass under 100 ms).
3. Re-enter A when the gap since A's leave (500 or 5000 ms) has elapsed.
4. Wait for the revisit's `loadeddata` (up to 15 s) and first frame (up to 3 s).
5. Stay 3000 ms (aftermath), leave A, observe 1500 ms.
6. Post the results and load the next cell.

## 6. Output schema (`ib10-v3r-results.json`, per cell)

**Cell:** `cell` {`variant`, `cache`, `container`, `gap`}; `requests[]`; `client`.

**`requests[]`** (server; all requests for the cell's cards):
- `card`, `t0`, `tEnd`, `status`;
- `req` {`range`, `ifNoneMatch`, `ifModifiedSince`, `ifRange`, `cacheControl`, `pragma`};
- `rangeStart`, `contentRange`, `length`, `bytesSent`;
- `writes` [[t, cumulative bytes]];
- `end`: `complete` / `client-abort` / `open-at-run-end`.

**`client`** (page):
- `identity` (`MATCH_ASIS` / `MATCH_RELEASE` / `MISMATCH`), `timeOrigin`;
- `marks` (enter/leave/ready/frame by phase `first`/`pass`/`revisit`/`final`);
- `videos[]`: owner, card, `src`/`removeSrc`/`load`/`pause`/`play` calls, media events with `readyState`, `networkState` and buffered end, first frame, sampled states;
- `trustedPointerEvents`, `browser`, `manager`.

**Analyzer** (`analyze_ib10_v3r.cjs`), per cell:
- **First and revisit timings:** source-assignment offset, `loadedmetadata`, `loadeddata`, `canplay`, `playing`, first frame, all measured from each element's own source assignment.
- **First transfer after leave:** requests active at leave, bytes before leave and between leave and revisit, end reason and time after leave, still open at revisit, element state at leave and at revisit, whether released at leave.
- **Revisit transport:** classification (`NO_NEW_REQUEST` / `VALIDATED_304` / `RESTART_FROM_ZERO` / `PARTIAL_REFETCH` / `RESUME`), new requests with Range and validators, re-fetched bytes, and bytes before the revisit's `loadeddata` and first frame.
- **Paired comparison:** for each cache × container × gap, the readiness and first-frame deltas, and whether RELEASE made a new request where AS-IS made none.

Element events and server bytes are kept separate. Only requests that start on the cell's own page count, because a re-run reuses its token.

## 7. Local qualification
`node tests/browser/ib10/verify_ib10_v3r.cjs --media <fixture folder>`: **53/53**, with 8 fault controls.
- **Identity:** AS-IS equals production; RELEASE equals production plus exactly one line (removing it restores production); the working-tree production blob is `22e843c`.
- **Behavior scope** (jsdom, RELEASE vs production): sustained hover and pending leave are identical. Ready leave, A→B and five cycles differ **only** by `removeSrc` + `load` on installed videos at leave. The IB09 still-image path is identical.
- **Package smoke** (both variants × both gaps):
  - identity `MATCH_ASIS` / `MATCH_RELEASE`;
  - hold ≥ 1000 ms after readiness, B pass < 100 ms, gap within ±30 ms;
  - first and revisit elements recorded;
  - RELEASE releases A at leave, AS-IS keeps the source;
  - no remote URL, no contamination.
- **Server over HTTP:**
  - 16-cell composition and pairing; page and config;
  - NO_STORE and CACHEABLE headers exact;
  - exact Range;
  - 304 on a CACHEABLE validator; NO_STORE ignores validators; If-Range match → 206, stale → 200;
  - accounting for aborted and complete transfers (`bytesSent` equals bytes received; `rangeStart` recorded);
  - request headers logged.
- **Analyzer:** every revisit classification, the earlier-attempt exclusion, and the paired deltas.
- **Fault controls (all caught):**
  - altered fixture;
  - RELEASE patch missing;
  - variant swap;
  - wrong gap scheduling;
  - cacheable arm emitting no-store;
  - wrong byte accounting;
  - Range ignored;
  - classifier ignoring re-fetched bytes.

## 8. Expected run and data
- **Duration:** about 7–12 s per cell, so 3–4 minutes in total.
- **Results:** a few hundred KB of local data. All transfer is localhost (about 2–4 MB per cell).
- **Sanitation:** the results contain no URLs or IDs; times are rebased before anything is committed.

## 9. Known limitations
- **One cell and one throttle rate:** Chrome 154 + Tampermonkey 5.5.0. A 1 s hold yields a partial buffer only; the full-buffer case (FAST) is deferred.
- **Localhost:** no TLS, CDN or connection-warmth effects. The live partial gain on e926 (§V3-L) could involve those, and V3-R cannot reproduce them.
- **Cacheable arm:** shows the browser's mechanism under explicit cacheability only, not the hosts' real headers.
- **Revisit readiness:** measured from source assignment. Production assigns video at enter today; the settled 200 ms dwell would add a fixed delay before assignment in both variants.
- **The B pass:** opens and releases its own request (a different URL); it is recorded.
- **No UX threshold:** none is applied. Measured differences are reported for the owner's decision.
