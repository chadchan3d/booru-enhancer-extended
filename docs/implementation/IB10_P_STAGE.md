# IB10 — P stage: muted, dwell-gated, immediately released hover video

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, item 3 "P", items 2, 7–11).
- **Gate:** G-VIDEO(class, cell) E → PASS(scope) (`IB10_V3L.md` §8).
- **Owner decisions:** 200 ms dwell; viewer opening ends the hover; original-file source; **V3-R Option A, immediate release** (recorded in the Ledger before this change, commit `5e00884`).
- **Status: PARTIAL — NOT COMPLETE.** Local qualification is done. Browser conformance (controlled and live) is prepared and pending with the operator. IB11 not started.

## 1. Gate check before editing
- **Repository:** clean at `b158e72` = origin.
- **Production before the change:** `b9d133c` / `22e843c`.
- **Blueprint IB10 P scope used:** "fix current hover-video pause/detach/reset on leave/close/dispose and stale play/readiness handlers; keep a bounded active hover element count". No cheaper stream, no URL guessing, no native scheduling, no viewer-policy change.
- **Runtime cell:** production has no runtime-cell identity (the IB03 `BE.runtime` boundary has none). As with IB04–IB09, the behavior is not cell-gated, and the **support claim is TC only** (Chrome + Tampermonkey). Adding browser sniffing would itself be new, unmeasured behavior.
- **Class size bound:** the G-VIDEO record admits e621 WebM over the observed range 0.8–100 MB. The predicate bounds it at **100,000,000 bytes**, the observed maximum (99,954,191), not open-ended. e926 MP4 is **under 50 MB** (≤ 49,999,999 bytes).

## 2. Production artifact
- **Commit:** `8324552`
- **Blob:** `Booru_Enhancer.user.js` `4258ad7746c022606f222fc48924055912de4cfc`
- **Production body SHA-256:** `7a0a2b49cde6feb12b28c8a667694e7a7a6a91db50e8e8959dade6bc5fc6bb3a`
- **Diff against `b9d133c`:** 70 lines added, 5 removed. The hover module, plus one line in the gallery's viewer-open path.

| Element | Change |
| --- | --- |
| `hoverVideoAdmittedWrap(img)` | The admitted class, from existing facts only (exact rules below). |
| `releaseHoverVideo(video)` | Pause; remove every `<source>` child and the `src` attribute; `load()` reset. Browser media/HTTP caches are not touched |
| `upgradeWhenReady` | For an admitted card, only the card's own `data-file-url` may be the hover source (anything else keeps the thumbnail). The created video is registered for release. `ready()` refuses to install and releases the video while the viewer is open |
| `show()` | Admitted card: immediate thumbnail as before; the video work waits for the existing 200 ms dwell timer (the IB09 timer, reused), which re-checks the generation and the viewer |
| `resolveHover(img, token, thumbnailShown)` | Skips the duplicate thumbnail when it was already shown at enter |
| `hide()` | After the existing pause/detach, an installed admitted video is released (`releaseHoverVideo`). Pending videos were already released by `cancelPendingUpgrade` |
| `endForViewer()` + gallery click | When the gallery opens the viewer, an admitted hover generation (pending or installed) is ended through `hide()`. Other hovers are unchanged |

Unchanged: muted / defaultMuted / autoplay / loop / playsInline / preload, the stale-generation guards, the viewer, and everything outside the class.

**Exact admission rules** (`hoverVideoAdmittedWrap`). All must hold:
- **Page admission:** the card's IB08 rendition fact is `NATIVE_UNSUPPORTED`. `applySiteThumbMedia` returns `NATIVE_OUT_OF_SCOPE` unless `e6RenditionAdmitted()` holds (adapter e621, host e621.net/e926.net, path `/posts`, `data-user-is-anonymous="true"`). Still-pattern cards carry `NATIVE_PREVIEW` / `OWNED_*` / `REFUSED_NATIVE_TOUCHED`.
- **Host and container:** `location.hostname` is `e621.net` with `data-file-ext` `webm`, or `e926.net` with `mp4`.
- **File URL:** the `data-file-url` extension equals `data-file-ext`.
- **Size:** `data-size` is a positive number ≤ 100,000,000 (e621) or ≤ 49,999,999 (e926).

## 3. Local qualification
**`tests/host/ib10/p_stage_video_assertions.cjs`** on production `4258ad7`: **64/64**, including 10 fault controls. The comparison base is `b9d133c`.
- **Admitted (e621 WebM 5 MB, e926 MP4 5 MB):**
  - quick passes of 0/40/199 ms: no video and no source, but the thumbnail at enter;
  - dwell: source at exactly 200 ms, muted and defaultMuted, installed after `loadeddata`, play muted;
  - leave before `loadeddata`: released; late `loadeddata`/`playing`/`canplay` never install;
  - leave after `loadeddata`, after the first frame, or while buffering: paused, `src` removed and reset at leave, detached, not revived by late events;
  - a `<source>` child is removed;
  - five re-entries: at most one source holder at a time, none at the end;
  - A→B and A→B→A: the prior video released, one holder during a hover, none after;
  - dispose before dwell, while pending, and when ready;
  - viewer before dwell, while pending, while installed; viewer close (no resurrection); viewer opened by another path while pending (the `ready()` guard);
  - no audible play, no network.
- **Class boundaries:** e621 WebM at exactly 100 MB and e926 MP4 at 49,999,999 B are admitted.
- **Out of scope, hover behavior identical to `b9d133c`** across a 40 ms sweep, ready+leave, and cycles:
  - e621 MP4;
  - e926 WebM;
  - e926 MP4 at 50 MB and at 60 MB;
  - e621 WebM over 100 MB;
  - MOV and GIF;
  - no `data-size`;
  - a non-WebM file URL;
  - a logged-in page;
  - non-`/posts` routes (e621 `/favorites`, e926 `/pools/1`);
  - rule34.xxx and gelbooru.com.

  The last two produce no hover with the e621-shaped fixture. Their exclusion rests on the predicate's host and e621-only rendition-fact requirements.
- **IB09 still-image class:** identical to `b9d133c` for 7 IB09 sequences × preview/sample/original.
- **Fault controls (all caught):**
  - dwell bypassed;
  - cleanup without source removal/reset;
  - release not applied at hide;
  - an old generation installs after leave;
  - viewer takeover not ending the hover;
  - viewer-open install guard removed;
  - the class broadened three ways (size limit, container check, page admission);
  - mute removed.

**Regressions:**

| Suite | Result |
| --- | --- |
| IB01, IB02, IB03, IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only (`mismatchesAgainstExpected: []`, `failed: []`) |
| IB08 | 66/66, 24/24, 12/12, 14/14; package 90/90 (historical result files left unedited) |
| IB09 | baseline 32/32, prototype 84/84, alternatives 54/54, live package 57/57, conformance 30/30 |
| IB09 P-stage suite | 111/111; now pinned to its artifact `b9d133c` (its fault controls patch the IB09 text) |
| IB10 | E baseline 34/34 (now pinned to `b9d133c`); V3-C 29/29; V3-L 31/31 |
| IB10 V3-R | 52/53. The single failure is its E-stage assertion that the *working-tree* production is still `22e843c`, superseded by design by this P change (like the IB07 pins); its result file is left unedited |

## 4. Browser conformance (prepared; operator pending)
Packages are built by `tests/browser/ib10/build_ib10_p_conformance.cjs` from `8324552`, with the body byte-identical:
- `IB10_P_Controlled.user.js`: the V3-C harness on port 8794. MP4 runs report e926.net and WebM runs e621.net (test-only), so both are in the class.
- `IB10_P_Live_Observer.user.js`: the V3-L observer for logged-out e621/e926 `/posts`.

The evaluator is `p_conformance_ib10.cjs`, with explicit criteria C1–C5 (controlled) and L1–L4 (live). The verifier is `verify_ib10_p_conformance.cjs`: **25/25**, including 10 fault controls.
- **Static and smoke:** body identity; scope; the controlled smoke on both containers shows the source at the 200 ms dwell and release at leave, and that a 40 ms pass makes nothing; the live smoke on both hosts passes L1–L4.
- **Evaluator fault controls (all caught):**
  - an abandoned transfer streaming after leave;
  - dwell bypassed;
  - release omitted;
  - viewer takeover not releasing;
  - artifact mismatch;
  - audible hover;
  - a 40 ms pass starting work;
  - incomplete run;
  - live: source held at +5 s, a quick pass creating a video, the source before dwell, and out-of-scope cards not counting as evidence.
- **Harness defect found and fixed:** the live smoke first hung silently, because jsdom has no Resource Timing API. A hang now exits non-zero.

**Still required before any IB10 completion claim:**
1. **Controlled run:** 54 cells. It must show, from **server bytes**, that the abandoned active transfer ends at release across Range / no-Range / FAST, with completed and prebuffered transfers distinguished.
2. **Small live run:** about 10 admitted hovers per host, on e621 WebM and e926 MP4 under 50 MB.

Operator steps are in `tests/browser/ib10/README.md` ("IB10 P-stage conformance"). Raw results are not to be committed.

## 5. Controlled run: first result and targeted recovery

**First operator run:**
- **File:** `ib10-p-controlled-results.json`, SHA-256 `27e90c6c5b023f0e49146cf129b1d8878e52ae8e08c666acc02b79fd572fe175`. Not committed.
- **Selection:** 55 entries; 10 rejected by the unchanged rule (trusted pointer events > 0); **45 clean cells, all PASS** C1–C5, every identity `MATCH_EXPECTED_ARTIFACT`.
- **Missing:** nine cells have no clean result.
  - RANGE: mp4 `LEAVE_PENDING`, mp4 `LEAVE_LOADEDDATA`, mp4 `LEAVE_FIRST_FRAME`, webm `CYCLES_5`;
  - NORANGE: mp4 `LEAVE_FIRST_FRAME`, mp4 `CYCLES_5`, mp4 `VIEWER_PENDING`, webm `LEAVE_LOADEDDATA`;
  - FAST: mp4 `DISPOSE`.
- **Status:** controlled conformance is **incomplete, not failed**.

**Recovery mechanism (test-only):**
- **`v3c_server.cjs --cells`:** an exact `TRANSPORT/container/SCENARIO` selector. Unknown, malformed, duplicate or empty selectors are refused, as is combining it with `--only`. The selected cells run in canonical order. Without it, the full 54-cell plan is unchanged (V3-C verifier 29/29).
  - V3-C checksum list: only the `v3c_server.cjs` line changed (`27e82d0a…` → `3b2e539e…`).
- **`merge_ib10_p_controlled.cjs`:** clean results per file come from the unchanged selector. A cell clean in more than one file is refused, as is a media mismatch. The unchanged `evaluateControlled` criteria are applied to the merged 54-cell set.
- **Local verifier:** `verify_ib10_p_recovery.cjs`, **23/23**. Fault controls (all caught):
  - unknown transport, container or scenario;
  - malformed, duplicate or empty selector;
  - `--only` combined with `--cells`;
  - a bad CLI selector, refused before listening;
  - recovery missing a cell;
  - a duplicate clean cell;
  - media mismatch;
  - a failing recovered cell;
  - contaminated recovery (the rule is not weakened);
  - a single-file merge.
- **Defect found and fixed:** an empty `--cells` was first read as "no selector" (it would have run all 54 cells). It is now refused.
- **Unchanged:** production (`8324552` / `4258ad7`) and the P package (`IB10_P_Controlled.user.js` equals a fresh build).
