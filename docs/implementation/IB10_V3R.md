# IB10 — V3-R revisit/cache discriminator (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle.
- **Gate:** G-VIDEO(class, cell) is already E → PASS(scope) (`IB10_V3L.md` §8, commit `47e7ccb`). V3-R resolves the one open owner decision before the P stage: the source-retention and revisit policy.
- **Settled (not reopened):** 200 ms dwell; viewer opening ends the hover; original-file source.
- **Status: run complete and analyzed (§10–§16). The retention policy remains OPEN for the owner.** Production is commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, **unchanged**.

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

## 10. Run qualification (operator run)

**Identity:**
- **Raw result:** `ib10-v3r-results.json`, SHA-256 `1ce9a65a2c4ad9c1b952799b0bf74de107cb917d1b85373a8ddf5230efcad1f4`. **Not committed.**
- **Committed instead:** the sanitized aggregate `tests/browser/ib10/results/ib10-v3r-aggregate.json` (relative values only).
- **Probe:** `ib10-v3r-controlled` 1.0.0.
- **Media:** both fixtures match their pinned SHA-256 values.
- **Runtime:** Chrome 154 (Chromium 154) + Tampermonkey 5.5.0, the TC cell.

**Cells and structure:**
- **Coverage:** 16 of 16 cells, each exactly once.
- **Identity:** every AS-IS cell is `MATCH_ASIS` and every RELEASE cell is `MATCH_RELEASE`.
- **Labels:** each cell's cache, container and gap match its configuration.
- **Errors:** none.
- **Structure in every cell:** one first-A request (cold, from a unique URL, `bytes=0-`) and one B request. RELEASE cells add one revisit-A request.
- **Accounting:** each request's `bytesSent` equals its last write; every end reason is consistent.

**Script timing:**
- hold after readiness 1000–1015 ms;
- B pass 62–76 ms;
- actual gap 502–509 ms and 5000–5011 ms.

**Cleanup:**
- **RELEASE:** removed the first A's source at leave in 8 of 8 cells, and the server saw that request client-aborted 0–3 ms after leave.
- **AS-IS:** kept it in 8 of 8, and that request was still streaming at revisit.

**Trusted pointer events** were counted in three cells. Their timing and position are not recorded.

| Cell | Count |
| --- | --- |
| AS-IS / no-store / MP4 / 0.5 s | 83 |
| AS-IS / no-store / MP4 / 5 s | 33 |
| RELEASE / no-store / WebM / 5 s | 228 |

In each of these cells the hover work exactly matches the script:
- exactly 3 hover elements (A, B, A), each created within 1–2 ms of a scripted enter;
- every `pause` and source removal at a scripted leave;
- requests only for A and B (nothing for card C);
- no extra show or hide.

There is no sign that the events changed any measured result, and their values fall inside the clean cells' ranges. They are **kept but flagged**. Every conclusion below also holds on the clean cells alone (§13):
- **Clean matched pairs:** 5 (no-store WebM 0.5 s; cacheable MP4 and WebM, each at 0.5 s and 5 s).
- **Clean RELEASE cells:** 7 of 8.

## 11. Paired results (times in ms from each element's own source assignment; bytes from the server log)

**Revisit timing.** \* marks a flagged cell. Cold first-hover `loadeddata` shown for scale.

| Cache | Container | Gap | Revisit `loadeddata` AS-IS / RELEASE (Δ) | First frame AS-IS / RELEASE (Δ) | Cold first `loadeddata` |
| --- | --- | --- | --- | --- | --- |
| no-store | MP4 | 0.5 s | 24\* / 23 (−1) | 22\* / 20 (−2) | 524 / 525 |
| no-store | MP4 | 5 s | 28\* / 23 (−5) | 25\* / 21 (−4) | 501 / 521 |
| no-store | WebM | 0.5 s | 21 / 22 (+1) | 18 / 20 (+2) | 237 / 242 |
| no-store | WebM | 5 s | 21 / 25\* (+4) | 18 / 23\* (+5) | 227 / 232 |
| cacheable | MP4 | 0.5 s | 22 / 23 (+1) | 20 / 21 (+1) | 514 / 512 |
| cacheable | MP4 | 5 s | 28 / 27 (−1) | 25 / 25 (0) | 536 / 528 |
| cacheable | WebM | 0.5 s | 20 / 23 (+3) | 20 / 21 (+1) | 231 / 232 |
| cacheable | WebM | 5 s | 25 / 20 (−5) | 22 / 21 (−1) | 219 / 238 |

**Revisit transport.** Bytes before the first leave were 344,064 (MP4) and 278,528 (WebM) in RELEASE cells, and 278,528–360,448 in AS-IS cells.

| Cache | Container | Gap | New A request on revisit, AS-IS / RELEASE | RELEASE revisit request | Re-fetched | Revisit bytes until `loadeddata` and first frame (RELEASE) | First-A bytes leave → revisit, AS-IS / RELEASE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| no-store | MP4 | 0.5 s | no / yes | `bytes=327680-` | 16,384 | 16,384 | 114,688 / 0 |
| no-store | MP4 | 5 s | no / yes | `bytes=327680-` | 16,384 | 16,384 | 1,097,728 / 0 |
| no-store | WebM | 0.5 s | no / yes | `bytes=262144-` | 16,384 | 16,384 | 114,688 / 0 |
| no-store | WebM | 5 s | no / yes | `bytes=262144-` | 16,384 | 16,384 | 1,114,112 / 0 |
| cacheable | MP4 | 0.5 s | no / yes | `bytes=344064-3623852` + `If-Range` | 0 | 16,384 | 98,304 / 0 |
| cacheable | MP4 | 5 s | no / yes | `bytes=344064-3623852` + `If-Range` | 0 | 16,384 | 1,097,728 / 0 |
| cacheable | WebM | 0.5 s | no / yes | `bytes=278528-3091427` + `If-Range` | 0 | 16,384 | 98,304 / 0 |
| cacheable | WebM | 5 s | no / yes | `bytes=278528-3091427` + `If-Range` | 0 | 16,384 | 1,114,112 / 0 |

**What these show:**
- **No restart from zero:** in no cell did the revisit request start at byte 0.
- **AS-IS:** the original A request never ended at leave. It was still streaming at the revisit and at run end; the revisit made no request and was served from that still-running transfer.
- **RELEASE:** the original A request was client-aborted 0–3 ms after leave and transferred 0 bytes after leave.

## 12. Mechanism (Chrome 154 + Tampermonkey 5.5.0 only)

- **Retaining the old element is not needed for a fast revisit.** Production always creates a new element on revisit. After RELEASE nothing held A's source, yet the revisit was ready in 20–27 ms, against 219–536 ms cold and 20–28 ms under AS-IS.
- **The no-store arm (ordinary HTTP caching disabled):** after release, Chrome still had A's first ~320 KiB (MP4) or ~256 KiB (WebM) available to the new element. It requested only the rest (`bytes=327680-` / `bytes=262144-`), re-fetching one 16 KiB block.
  - This is **in-memory media data shared by URL that outlived the element's release**, here for at least 5 s.
  - It is not the HTTP cache (disabled) and not the old element (released).
- **The cacheable arm:** Chrome resumed exactly where the first transfer stopped (`bytes=344064-` / `bytes=278528-`) with an `If-Range` validator, and re-fetched nothing. This is consistent with the HTTP cache holding the partial response and completing it by a validated Range request.
  - It does **not** show what e621/e926 actually send. Their real cache headers were not measured.
- **Range resumption:** in both arms the revisit continued the download rather than restarting it.
- **Revisit cost:** after release the revisit needs a **new request**, but only one 16 KiB chunk had to arrive before it was ready.
  - On localhost a new request costs about nothing.
  - On a real network it costs at least one round trip (DNS/TLS/connection warmth and CDN behavior are not represented here). That is the one revisit cost this experiment cannot size. AS-IS needs no request.
- **Not established:**
  - retention over longer intervals, or after many other videos (memory pressure, large originals);
  - the full-buffer case (deferred FAST);
  - other cells.

## 13. Cost of AS-IS retention vs RELEASE

- **AS-IS:** the abandoned first-A request kept streaming at the offered rate. That was ~98–115 KB during a 0.5 s gap and ~1.10–1.11 MB during a 5 s gap, at this experiment's 256 KiB/s throttle. It was still streaming when each cell ended.
  - On an unthrottled link the abandoned transfer can run to the whole file (V3-C FAST; live V3-L up to 100 MB originals).
- **RELEASE:** 0 bytes after leave; the request ended 0–3 ms after leave. The revisit then fetched only the missing remainder, starting where the cached data ended; 16 KiB arrived before readiness.
- **In user terms:**
  - In this cell, RELEASE saved all background transfer after leave.
  - Revisits within 0.5–5 s became ready just as fast (RELEASE − AS-IS: −5 to +5 ms), far below the cold first hover (≈ 220–540 ms).
  - The thumbnail would not visibly linger longer on a revisit.
- **Clean cells only:**
  - The 5 clean pairs give Δ −5 to +3 ms.
  - The 7 clean RELEASE cells all aborted at leave and resumed on revisit, with readiness of 20–27 ms.

## 14. Answer to the open question

**Yes.** V3-R fills the evidence gap: a ready, buffered hover is released, B is passed briefly, and A is revisited.
- **Speed:** in this cell, RELEASE revisits **remained near AS-IS speed** at both 0.5 s and 5 s, for MP4 and WebM, with and without ordinary HTTP caching.
- **No restart:** RELEASE caused **no restart and no meaningful refetch**. The no-store arm re-fetched 16 KiB; the cacheable arm re-fetched nothing.
- **What differed** was the request pattern, not visible speed: no-store resumed from an in-memory block boundary, while cacheable resumed exactly with `If-Range`.

## 15. Owner options (not decided)

| | A. Immediate release (Blueprint-normal) | B. Keep one completed/idle prior hover briefly | C. Broader bounded retention |
| --- | --- | --- | --- |
| Revisit effect | Measured: as fast as AS-IS within 0.5–5 s (shared media data / HTTP cache). Needs one new request (one network round trip, not measured live) | Could avoid that one request for the most recent video, only if it had fully buffered | As today: no request on revisit |
| Bandwidth | No transfer after leave (aborted within 0–3 ms) | Nothing extra if limited to fully buffered, idle media; must prove an idle paused element doesn't restart loading | Keeps abandoned transfers alive (~1.1 MB per 5 s at the test rate; up to the whole file live) — the D2/D3 mechanism |
| Memory and resources | Lowest | One retained decoded element and buffer | Several retained elements and buffers (live: up to 29–31) |
| Complexity | Smallest; reuses the existing pending-release path | Added state, timer and "complete and idle" check | Small, but needs a cap and its own cleanup |
| Blueprint | Compatible as written | **Change needed:** the Blueprint says leaving releases owned sources | **Change needed**; it also conflicts with the defects IB10 exists to fix |
| Evidence | V3-R (this record), V3-C abort, V3-L | Only an unmeasured round-trip saving; V3-R shows no visible benefit in this cell | V3-C and V3-L show its cost; V3-R shows no visible revisit benefit over A |
| Residual uncertainty | Real-network round trip on revisit; retention after longer gaps or many videos; full-buffer case | Whether idle elements stay idle; what it gains over A | As for B, plus bandwidth |

## 16. Rerun

**None is required for the question asked.** The three flagged cells show no hover work beyond the script, and the clean cells alone support the same conclusion.

Optional, only if the owner wants them before deciding:
- the deferred full-buffer (FAST) cells;
- a longer-gap or many-videos probe of in-memory retention.

Neither is needed to compare A against B or C for normal back-tracking.
