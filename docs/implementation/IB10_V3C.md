# IB10 — V3-C controlled hover-video byte/lifecycle experiment (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, items 3 E, 9, 10). **G-VIDEO is OPEN.** Production is commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, **unchanged**.
- **Status: run complete (operator, real browser) and analyzed (§4).** The controlled portion is satisfied for the single measurable source class, with the exclusions in §4.7. G-VIDEO remains OPEN pending representative live-class evidence (V3-L).

## 1. Identity

| Item | Value |
| --- | --- |
| Fixtures | Operator-supplied archive (SHA-256 `1b81afa9…236a`) containing `ib10_v3c_fixture.mp4`, 3,623,853 B, SHA-256 `9ba765f0a3c0e8035f96de18bf9f364d750ff1e9698d80ffe579494ee308b45e`; and `ib10_v3c_fixture.webm`, 3,091,428 B, SHA-256 `467649067aecd56d4d49ca9885eb87a6df5150af1bae6f565a1dba8b3eeb4a61` |
| Hash status | Computed from the supplied files and pinned in the server, which refuses any mismatch. No separate expected values were supplied, so **the operator is asked to confirm these two values** |
| Container facts | MP4: fast-start (`moov` at byte 32, before `mdat`), 12.0 s. WebM: Cues near the start (byte 102) |
| Package | `tests/browser/ib10/IB10_V3C_Controlled.user.js`, built from `b9d133c`. Its executed body equals the production body **byte for byte** (no hooks). The production-body SHA-256 is `6df35f16…f992`, checked in the page |
| Checksums | `tests/browser/ib10/IB10_V3C_SHA256SUMS.txt` |

## 2. Design

- **Host substitution (test only):** the production body is invoked as `function (location) { … }` with a test `location` whose `hostname` is `e621.net`; `href`, `origin`, `pathname` and `search` are the real local page. Production reads only bare `location.*` (69 reads, no writes or navigation). The verifier shows the shim is load-bearing: without it, no hover video is created.
- **Client recorder (preamble; observe-only):** for every `<video>` production creates, it records:
  - owner (from the stack: hover `upgradeWhenReady`, viewer `buildMedia`) and card;
  - `src` set/remove, `load`/`pause`/`play` (with muted), media events, the first presented frame (`requestVideoFrameCallback`);
  - sampled state (attached, in the hover overlay, holds `src`, `networkState`, `readyState`, `buffered` end, paused);
  - trusted pointer events, as contamination.
- **Server (`v3c_server.cjs`):** it serves:
  - an e621-shaped `/posts` page per run, logged out, with 3 video cards and a `data-size`;
  - no-store media under per-run unique URLs.

  Per request it logs start/end, `Range`, status, response range, cumulative bytes handed to the socket, and the end reason (`complete` / `client-abort` / `open-at-run-end`).
- **Transports:**
  - `RANGE`: 206, throttled to 256 KiB/s;
  - `NORANGE`: Range ignored, 200 full body, throttled;
  - `FAST`: Range, unthrottled.

  The throttle exists only for observability.
- **Scenarios** (scripted pointer events, fixture only). Each observes 5 s after the last leave/cleanup:
  - `LEAVE_PENDING` (leave at 40 ms);
  - `LEAVE_LOADEDDATA`;
  - `LEAVE_FIRST_FRAME`;
  - `CYCLES_5` (after readiness);
  - `A_TO_B`;
  - `VIEWER_PENDING`;
  - `VIEWER_INSTALLED`;
  - `VIEWER_CLOSE` (close, 5 s, then leave, 5 s);
  - `DISPOSE`.

  That gives 9 × 2 containers × 3 transports = 54 runs.
- **Analysis (`analyze_ib10_v3c.cjs`):** per run it reports event state (elements, holding `src`, buffered growth after cleanup) and transport state separately:
  - requests active at cleanup;
  - complete before cleanup;
  - bytes within +5 s;
  - re-requests;
  - abort latency;
  - requests open at run end.

  Element detachment or `src` removal is never reported as bytes stopping.
- **Known limitation:** in the viewer scenarios the viewer's `<video>` requests the same URL, so after takeover the server cannot attribute requests to hover versus viewer. Element-level evidence (the hover element's `buffered` growth) is recorded separately.

## 3. Local qualification

`node tests/browser/ib10/verify_ib10_v3c.cjs --media <fixture folder>`: **29/29** (`IB10_V3C_VERIFICATION.json`).
- **Static:**
  - the package is current;
  - its body equals production;
  - it matches only `http://127.0.0.1:8790/*`, with no update targets and no `@connect`;
  - the runner sends only to `/v3c/result` and writes no settings or storage.
- **Server over real HTTP:**
  - SHA-256 gate;
  - exact `Range` bytes (206, Content-Range, Accept-Ranges, identical bytes);
  - throttled client abort logged as `client-abort`, with no bytes after it;
  - `NORANGE` ignores Range (200, full length, no Accept-Ranges);
  - `FAST` completes with `bytesSent` equal to the size;
  - a still-streaming request is marked `open-at-run-end`;
  - results are stored with the next-run URL;
  - no-store on page and media;
  - 54 unique runs.
- **Package smoke** (jsdom, fake clock, simulated readiness; not a media stack):
  - identity MATCH;
  - the e621 path runs on the shim;
  - hover and viewer owners are detected;
  - scenario marks, and the 5 s window after cleanup;
  - no remote URL, no contamination, no runner errors.
- **Analyzer:** continuing, aborted and complete-then-re-requested transfers are distinguished.
- **Fault controls, 3/3 caught:**
  - altered fixture → server refuses;
  - tampered body → identity MISMATCH;
  - shim removed → the hover path doesn't run.
- **Defect found and fixed in the harness** (not production): the runner's `cleanup` mark was overwritten by its own `what` field. The smoke check caught it; it now uses `kind`.

## 4. Results (operator run; analyzed with the committed tools)

### 4.1 Result identity and selection
- **Returned file:** SHA-256 `9247d2aa…3fdb`, 56 entries; probe `ib10-v3c-controlled` 1.0.0.
- **Media:** the media block matches both pinned fixtures (size and SHA-256).
- **Identity:** every entry is `MATCH_EXPECTED_ARTIFACT`, with no runner errors.
- **Runtime:** Chrome 154 (Chromium 154), Tampermonkey 5.5.0; the TC cell.
- **Selection** (`tests/browser/ib10/select_clean_ib10_v3c.cjs`, deterministic):
  - The two contaminated attempts (RANGE/mp4 `LEAVE_PENDING`, 27 trusted pointer events; RANGE/mp4 `LEAVE_LOADEDDATA`, 261) were dropped.
  - Their clean reruns reuse the same run tokens, so the server had attached the earlier attempts' requests to them. Those requests (1, 3, and 1 on the abandoned first `LEAVE_FIRST_FRAME` page) start before each rerun's own page origin and were excluded.
  - Result: **54 kept = 54 expected cells; none missing, none duplicated.**
- **Committed evidence** (`tests/browser/ib10/results/`), with all times rebased to each page's origin and no wall-clock timestamps:
  - `ib10-v3c-all-rebased.json` (all 56 entries);
  - `ib10-v3c-clean.json`;
  - `ib10-v3c-selection.json`;
  - `ib10-v3c-analysis.json` (from `analyze_ib10_v3c.cjs`, identical before and after rebasing).

### 4.2 Transport through +5 s after cleanup
Event state and transport state are reported separately. Bytes are those handed to the socket by the server.

| Cleanup situation | Hover element (event) | Server request (transport) | Cells |
| --- | --- | --- | --- |
| **Leave before readiness** (`src` removed + `load()`) | released, detached | **client-abort within ±1 ms of leave; 0 B after**. Bytes before leave: 16–64 KiB throttled, 768 KiB FAST | RANGE and NORANGE `LEAVE_PENDING` and `LEAVE_FIRST_FRAME` (both containers); FAST webm `LEAVE_FIRST_FRAME` |
| **Leave after readiness** (installed; pause + detach, `src` kept) | detached, paused, **holds `src`, `networkState` LOADING, `buffered` grows +3.5–4.2 s of media** | **not aborted: 1,064,960–1,146,880 B per request in the 5 s window; still streaming at run end** | RANGE and NORANGE `LEAVE_LOADEDDATA`, `CYCLES_5`, `A_TO_B`, `DISPOSE`, `VIEWER_CLOSE` (both containers) |
| Same, FAST | detached, holds `src`, buffered to the full 12 s | **completed after leave**: 1.78–2.58 MB delivered 101–149 ms after leave | FAST `LEAVE_PENDING`/`LEAVE_LOADEDDATA`/`LEAVE_FIRST_FRAME` (readiness at 28–53 ms preceded the leave) |
| FAST, longer holds | detached, holds `src`, full buffer | complete **before** cleanup (whole file); 0 B after | FAST `CYCLES_5`, `A_TO_B`, `DISPOSE`, `VIEWER_*` |
| **Viewer takeover** (no hover cleanup in production) | hover stays attached and loading. **Pending at takeover: becomes ready ~0.2–0.5 s later and is installed while the viewer is open** | hover stream continues (1.10–1.16 MB / 5 s); with **NORANGE a second concurrent request** (the viewer's) also streams | `VIEWER_PENDING`, `VIEWER_INSTALLED` |
| **Viewer close** | the viewer's own element is released | the viewer's request is **client-aborted at close**; the hover request continues | NORANGE `VIEWER_CLOSE` |

**Re-requests and resumption:** none after cleanup, except the viewer's own request (NORANGE). With RANGE, re-entry to the same card created a new element but **no new request** (§4.3).

### 4.3 Range vs no-Range vs FAST
- **Release:**
  - Pending release (`src` removal + `load()`) aborts the request immediately in all three modes.
  - An installed element's retained `src` keeps its request streaming in RANGE and NORANGE. In FAST the transfer simply completes.
- **Same-URL sharing:**
  - **RANGE:** Chrome served all elements with the same URL from **one** request: `CYCLES_5` had 5 elements but 1 request, and RANGE viewer cells had 1 request.
  - **NORANGE:** every element opened its **own full-body request**: `CYCLES_5` had **5 concurrent streams (5.32–5.39 MB in the 5 s window)**, and viewer takeover added a 2nd stream.
- **Different URLs** (`A_TO_B`): 2 concurrent streams in both throttled modes.
- **FAST:** the full file arrives within ~0.1–0.4 s, so there is little post-leave transfer to stop; what remains is retention (full 12 s buffers held by detached elements).

### 4.4 MP4 vs WebM
- **Lifecycle and transport behavior:** identical.
- **Timing:** the only difference. Throttled readiness came at ~0.50–0.54 s for MP4 versus ~0.21–0.23 s for WebM. MP4 needs ~128–196 KiB before `loadeddata`; WebM needs ~64 KiB.
- **Overall:** container doesn't change any defect disposition.

### 4.5 Defect disposition
- **D2 — CONFIRMED by transport evidence.**
  - After readiness, leave, dispose and viewer close→leave leave the hover request **streaming at the full offered rate through +5 s**, not aborted by the client, in RANGE and NORANGE and both containers.
  - Under FAST the file **completes** after leave.
  - Narrowing: a pending element (leave before readiness) **is** released at transport level (abort ±1 ms).
- **D3 — CONFIRMED, narrowed by transport.**
  - Source-holding detached elements accumulate in every mode (5 after `CYCLES_5`).
  - **Transfer multiplies with them when the URLs differ** (`A_TO_B`: 2 streams) **or the server lacks Range** (NORANGE `CYCLES_5`: 5 concurrent streams).
  - Same-URL re-entry against a Range-capable server shares one request, so the cost there is retention, not extra transfer.

### 4.6 Controlled evidence on D1 and D4 (not changed)
- **D1:** the media request starts 4–20 ms after pointer-enter in every cell. A 40–60 ms pass transferred 16–64 KiB (throttled) and 0.77–1.31 MB (FAST). Under FAST, readiness (28–53 ms) beat a 40 ms leave, so **the whole file (3.1–3.6 MB) was transferred for a 40 ms pass**.
- **D4:** in `VIEWER_PENDING` the hover video became ready about 0.2–0.5 s after takeover and was **installed in the overlay while the viewer was open**. Its stream continued; under NORANGE the viewer's own stream ran concurrently. In `VIEWER_INSTALLED` the hover video stayed attached and loading.

### 4.7 Anomalies and limitations
- **Contaminated attempts:** two were dropped (§4.1). The token-sharing artifact is handled by the selection rule and documented.
- **`LEAVE_FIRST_FRAME`:** in Chrome, `requestVideoFrameCallback` fired on the not-yet-installed element **before** `loadeddata` in 5 of 6 cells. Those cells therefore exercised a pending leave. Leaving an installed, playing video is covered by `CYCLES_5`, `DISPOSE` and `VIEWER_CLOSE` (leave 300 ms or more after install).
- **FAST `LEAVE_PENDING`:** readiness beat the 40 ms leave, so FAST has no true pending-leave sample other than webm `LEAVE_FIRST_FRAME`.
- **Viewer cells:** same-URL viewer and hover requests cannot be separated at the server under RANGE (one shared request).
- **Window and byte measure:** the window is +5 s, so whether a throttled stream would later pause on Chrome's own buffering limit, or complete, is not observed. Bytes are those handed to the socket on localhost, not proven delivered (equivalent here).
- **Throttle:** the effective rate was about 210–230 KiB/s against a nominal 256 KiB/s (timer granularity).
- **Cache:** no-store by design, so cached transfers are not exercised.
- **Lower-cost variants:** not applicable; production has no lower-cost stream fact.
- **Cell:** TC only (Chrome 154 + Tampermonkey 5.5.0).

### 4.8 Blueprint IB10 item 9, controlled portion
Covered:
- leave before and after `loadeddata` (and first-frame timing);
- five re-entries;
- A→B;
- late readiness during takeover;
- all hover `src`/release paths (leave, dispose, viewer);
- Range, no-Range and fast-buffering;
- MP4 and WebM;
- +5 s traces distinguishing completed-before, active, aborted and still-open transfers.

**Satisfied for the one measurable class** (original-file source, TC). The exclusions are §4.7: cached cases, lower-cost variants and other cells. Representative live-class eligibility (V3-L) remains required.

## 5. Next: V3-L (not started)

The smallest live experiment justified by V3-C is an **observe-only** package on the operator's logged-out e621 and e926 `/posts` listings (production `b9d133c` unchanged; the IB09P observer pattern; the operator's real hovers; no scripted events, no clicks required). It records per **video-card** hover generation:
- the class: container (`data-file-ext`) × original-size band (`data-size`);
- `src` assignment time, `loadeddata`, first frame and leave time;
- whether leave came **before or after readiness**. V3-C showed that this alone decides release versus continued transfer;
- for the hover element at leave, +1 s and +5 s: holds `src`, attached, `networkState`, `buffered` end.

  Detached `buffered` growth with `networkState` LOADING is the live proxy for continued transfer, which V3-C validated against server bytes (+3.5–4.2 s of media per ~1.07 MB in 5 s). It is a proxy, not a byte count.
- the number of concurrent source-holding hover elements;
- Resource Timing for the file URL where visible (sizes may be hidden; never counted as zero).

**Bounds:** ordinary network, 40 video generations per host. No viewer or dispose cases, which V3-C settled.

**Purpose:**
- representative live readiness and usefulness per class;
- live confirmation of the post-readiness retention signature.

G-VIDEO cannot pass from V3-C alone.
