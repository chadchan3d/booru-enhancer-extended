# IB10 — V3-C controlled hover-video byte/lifecycle experiment (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, items 3 E, 9, 10). **G-VIDEO is OPEN.** Production is commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, **unchanged**.
- **Status: prepared and locally qualified; the real-browser run is pending (operator).** No transport finding is claimed yet.

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

## 4. Still to be established by the operator run

Everything below comes from the returned `ib10-v3c-results.json`, analyzed per run. **None of it is inferred here:**
- the exact timelines;
- bytes through +5 s after leave;
- whether requests were complete before leave, stayed active, were interrupted or were re-requested;
- the maximum number of source-holding elements;
- RANGE vs NORANGE vs FAST, and MP4 vs WebM;
- whether D2/D3 are confirmed, narrowed or disproved by transport evidence;
- controlled evidence for D1/D4.

## 5. After V3-C (not started)

The smallest V3-L is an observe-only package on the operator's logged-out e621/e926 `/posts` listing, reusing the IB09P pattern (production unchanged). Per video-card generation it records:
- `src` assignment, readiness and first-frame times;
- the leave time;
- `buffered` end and `networkState` at leave, +1 s and +5 s;
- Resource Timing where visible;
- the class (container × `data-size` band).

Its purpose is representative class usefulness and cost. G-VIDEO cannot pass from V3-C alone.
