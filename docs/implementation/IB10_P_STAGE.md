# IB10 — P stage: muted, dwell-gated, immediately released hover video

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, item 3 "P", items 2, 7–11).
- **Gate:** G-VIDEO(class, cell) E → PASS(scope) (`IB10_V3L.md` §8).
- **Owner decisions:** 200 ms dwell; viewer opening ends the hover; original-file source; **V3-R Option A, immediate release** (recorded in the Ledger before this change, commit `5e00884`).
- **Status:** **COMPLETE — PASS(scope)** at production `4d793a2` (§9).
  - §1–§7 record the first closure at `8a4d6d8` (production `8324552`) as historical evidence.
  - §8 records the reopen for Blueprint conformance and the poster/View fallback.
  - §9 records the targeted browser conformance and the closure.
  - IB11 not started.

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

## 6. Controlled conformance complete; live evaluator correction (revision 1.1)

**Controlled P conformance: 54/54 PASS.**
- **Original run:** 45 clean, SHA-256 `27e90c6c…e175`.
- **Recovery run:** 9 clean, SHA-256 `9eaf56dce39032f8ca07e713f0e96da4474f5856ddea03863695155ef94e7d48`.
- **Merge:** `merge_ib10_p_controlled.cjs` gives 54 clean cells, every one passing C1–C5 with no failing cell.
- Raw files are not committed.

**Live evaluator audit.** Against the Blueprint invariant ("leaving … releases every owned source and prevents resurrection") and the browser evidence, two rules in `p_conformance_ib10.cjs` (live) were wrong. The controlled criteria are unchanged.

1. **L3 at the leave sample required `networkState === 0`.** The leave sample is taken synchronously right after production's `hide()`, which calls `removeAttribute('src')` and `load()`.
   - **The spec:** the HTML media load algorithm runs resource selection, which sets `NETWORK_NO_SOURCE` (3) synchronously and reaches `NETWORK_EMPTY` (0) only at the next stable state.
   - **The controlled evidence:** in all 72 clean P-run releases, `abort` and `emptied` fired with `networkState` 3 within 1–2 ms. Every later sample was 0, the first one 16–31 ms after release.
   - **Correction:** at leave, the element must still be detached with no source held, and `networkState` must be 0 or 3. At +1 s and +5 s, it must be detached, hold no source, and be 0. Byte termination remains proven by the controlled C5 gate.
2. **The dwell rules used a 190 ms allowance**, a tolerance I had introduced myself. Production arms a 200 ms timer at enter, and a leave at exactly 200 ms can run before that timer task, so no video is the correct outcome. Corrected to the exact threshold:
   - **No hover video:** passes only if the stay is ≤ 200 ms. A longer stay without a video FAILS (sustained hover, no preview).
   - **A hover video:** its source must be at ≥ 200 ms. Both values are integer-ms readings of the same clock, and `round(a + d) ≥ round(a) + 200` whenever `d ≥ 200`, so a correct delay never reads below 200.
   - **Host evidence now also requires** at least 3 sustained hovers that produced a preview, so an implementation that never creates videos cannot pass.

**Verifier:** `verify_ib10_p_conformance.cjs` is **35/35**. New live fault controls (all caught):
- source owned at leave;
- attached at leave;
- LOADING at leave;
- NO_SOURCE at +1 s;
- LOADING at +5 s;
- source held at +5 s;
- source at 199 ms;
- a 600 ms hover with no video;
- a 201 ms stay with no video;
- an implementation that never creates videos;
- unmuted play;
- two concurrent source holders;
- a quick pass creating a video before the dwell.

The real-package live smoke still passes. Production, `IB10_P_Live_Observer.user.js` and `IB10_P_Controlled.user.js` are unchanged.

**e621 live P result:** not yet available to this analysis. It was not found in Downloads, Desktop, Documents or the repository, so its SHA-256 and verdict are pending.

## 7. Live conformance result (final)

**e621** (raw `ib10-p-live-e621.json`, SHA-256 `ef0c37b23b27188dac135690c814280ea80fe0e1c85425ccf807472e831b0b70`, not committed):
- 84 WebM generations, all admitted, **84/84 PASS**;
- 57 quick passes, 27 sustained previews, 9 after ready.

**e926** (raw `ib10-p-live-e926.json`, SHA-256 `3d31f6814183fdbf1f239f1d6e6519db3089953c08659df9c07a0d40d8ebb7f1`, not committed):
- 120 MP4 generations: 119 admitted, **119/119 PASS**; 1 OUT_OF_SCOPE (79,810,863 B);
- 90 quick passes, 29 sustained previews, 14 after ready.

**Run conditions (both files):** identity `MATCH_EXPECTED_ARTIFACT`; Chrome 154 + Tampermonkey 5.5.0; every trigger trusted; no viewer opens.

**Command:** `node tests/browser/ib10/p_conformance_ib10.cjs live <e621> <e926>` (revision 1.1). It exits 0 with 203 PASS, 0 FAIL, 1 OUT_OF_SCOPE, overall PASS.

**Checked directly against the raw generations:**
- created previews set their source at 200–217 ms (e621) and 201–215 ms (e926), always the card file;
- every one was detached and source-free at leave (`networkState` 3), +1 s and +5 s (`networkState` 0);
- 23/23 plays muted;
- at most one source-holding hover at any sample;
- no-video generations all ended at ≤ 200 ms.

## 8. Reopen: poster/View fallback for unqualified video (Blueprint conformance)

**Gate.** The owner chose **B — enforce the Blueprint** (Ledger `2ee86be`). The Blueprint text that applies:
- §3 IB10 item 3: "P: fix current hover-video pause/detach/reset …; keep a bounded active hover element count. **Poster fallback elsewhere.**"
- item 11: "Disable automatic video only for failing class/cell; cheaper validated sample **or poster/View**."
- the G-VIDEO row: "otherwise poster/View".

At `8324552`, only the admitted class got the P behavior. Every other recognized video card kept the pre-IB10 automatic hover video, with D1–D4 (`IB10_HOVER_VIDEO_BASELINE.md`). §1–§7 and the completion record called that retention an owner decision or owner instruction. **That wording was wrong.** The owner had set the admitted class for the P change; the owner had not decided to keep automatic video for unqualified classes. The retention was a departure from the Blueprint.

**The departure in the code (`8324552`).** In `upgradeWhenReady` (now `Booru_Enhancer.user.js:3142`), the admission check `hoverVideoAdmittedWrap(sourceImg)` (`:3119`) was used only to constrain admitted cards. A recognized video without that admission fell through to the generic video branch (now `:3172`, `isVideo` → `document.createElement('video')` at `:3177`): it was created at once, with `autoplay`, a `src` and `preload = 'auto'`, and was never registered for release. Production recognizes video on these paths:
- e621/e926 cards (`directUpgradeFromDom`, `:3045`);
- the post-cache path (`mediaFromPost`, `:3078`);
- Rule34 / Gelbooru-family original URLs from the gallery's enrichment (`img.dataset.beOriginalUrl`, `:4428`).

**The correction (`4d793a2`).** One narrow decision in the same function, directly after the admitted branch (`:3152`–`:3157`, 5 lines added):

```js
} else if (resolved.mediaType === 'video' || guessMediaType(resolved.url) === 'video') {
	clearMediaState();
	return;
}
```

- It uses exactly the predicate that the generic video branch already used (`:3172`). No media type, URL, size or rendition is inferred anew.
- A video card that is not admitted returns before any `<video>` exists. The thumbnail overlay shown at enter stays. The View path (the gallery click → viewer) is untouched.
- An admitted card never reaches the new branch, because it is the `else` of `if (videoWrap)`.
- Non-video resolves (stills, GIF) don't match the predicate and are unchanged.

**Production artifact:**
- commit `4d793a2ce24454a2f08816887dfedca5d307bfcc`;
- blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`;
- production body SHA-256 `009155841b194df21a4e1d22bd3f40b5d63e2f58cfa5485b06fd4e66bd64e945`.

**Local qualification.** `tests/host/ib10/p_stage_video_assertions.cjs` (revised) gives **67/67**, with 12 fault controls.
- **Admitted classes, unchanged:**
  - immediate thumbnail;
  - source at the 200 ms dwell;
  - muted;
  - immediate release on leave, dispose and viewer;
  - no stale resurrection;
  - at most one source holder;
  - class boundaries (100,000,000 B WebM; 49,999,999 B MP4).
- **Excluded video, poster/View fallback.** In each case: no hover `<video>`, no `src` or `play`, thumbnail at enter, no network, and the View click opens the viewer with the same viewer media as `b9d133c`. Each case is non-vacuous: `b9d133c` auto-played the same input. The 12 inputs:
  - e621 MP4;
  - e926 WebM;
  - e926 MP4 at exactly 50 MB and at 60 MB;
  - e621 WebM over 100 MB;
  - e621 MOV;
  - WebM without `data-size`;
  - WebM with a non-WebM file URL;
  - logged-in e621 WebM and e926 MP4;
  - non-`/posts` routes on both hosts.
- **Another host:** a Rule34 card recognized as video from its enriched original URL gets no hover video and keeps the thumbnail overlay (`b9d133c` created one).
- **Unchanged:** e621/e926 GIF behave identically to `b9d133c`. The IB09 still-image class is identical to `b9d133c` for 7 sequences × 3 qualities.
- **Fault controls (all caught):**
  - the fallback removed (old automatic hover video restored for an excluded class);
  - the fallback applied to the admitted class;
  - the size limit, container check or page admission ignored (class broadened);
  - dwell bypass;
  - no source removal;
  - no release at hide;
  - stale-guard removal;
  - no viewer takeover;
  - the viewer-open guard removed;
  - unmuted.

**Regressions on `4d793a2`:**

| Suite | Result |
| --- | --- |
| IB01, IB02 (21), IB03 (11), IB05, IB06 | exit 0 |
| IB07 | exclusion and Gelbooru (14) exit 0; `item9` and `pagecount` exit 1 on their IB07 blob pin only (`fail: []`, `failed: []`, `controlFailures: []`) |
| IB08 | 66/66, 24/24, 12/12, 14/14; browser packages 90/90, 59/59, 56/56, 65/65 |
| IB09 | baseline 32/32, prototype 84/84, alternatives 54/54, P-stage 111/111; browser conformance 30/30, live package 57/57, V2 probe 39/39 |
| IB10 E | baseline 34/34; V3-C 29/29; V3-L 31/31; V3-R 52/53 (its E-stage working-tree pin only, superseded by design) |
| IB10 P (`8324552` packages) | conformance verifier 34/35 and recovery verifier 22/23. Each failure is only its working-tree pin to `4258ad7`, superseded by this change. The pinned packages are still equal to a fresh build. |

Historical result files that these runs rewrote were restored unedited.

**Targeted browser conformance (prepared; operator pending).**
- **Package:** `tests/browser/ib10/IB10_PF_Live_Observer.user.js`, built by `build_ib10_pf_conformance.cjs` from `4d793a2`. Its body is byte-identical to the production body. It is the same V3-L observer as `IB10_P_Live_Observer.user.js`, under a distinct script name and namespace. The `8324552` packages are unchanged.
- **Evaluator:** `p_conformance_ib10.cjs targeted`, **revision 1.2**. Revisions 1.1 `live` and `controlled` are unchanged.
  - **T0:** artifact identity matches; no sanitation block.
  - **Positive, per host:** admitted generations pass L1–L4; ≥ 4 usable, ≥ 1 quick pass, ≥ 2 sustained hovers with a preview.
  - **Negative:** every excluded video-card generation, whatever its trigger or viewer state, must satisfy N1 (no hover video created) and N2 (no hover video holds a source at leave, +1 s or +5 s). Evidence per host: ≥ 3 trusted sustained (> 200 ms) hovers of the required class — e621 MP4 on e621, e926 WebM on e926. Other excluded classes (e926 MP4 ≥ 50 MB, e621 WebM > 100 MB, MOV) are reported per class and are not required.
  - **V1 View:** per host, ≥ 1 excluded card opened in the viewer, finalized, with no hover video.
- **Verifier:** `verify_ib10_pf_conformance.cjs`, **25/25**.
  - Static: identity, scope, distinct name, old packages unchanged.
  - jsdom smoke on both hosts: admitted, excluded and View paths; evaluator PASS.
  - Fault package: the same session on the `8324552` package fails N1 on both hosts.
  - 13 evaluator fault controls.
- **Checksums:** `IB10_PF_SHA256SUMS.txt`. Package SHA-256 `58074ab1e2ab03991f01ee2d7eb5ee5314ea6b0e5bac05f9e8ed6899a7416ebe`.
- **Operator steps:** `tests/browser/ib10/README.md`, "IB10 PF targeted conformance".

**Status at §8 (superseded by §9).** IB10 stayed **PARTIAL**.
- The admitted classes keep their G-VIDEO PASS(scope) from §7.
- The unqualified video classes now fall back to the poster/View path, but their G-VIDEO stays **OPEN**. The fallback is not a qualification.
- IB10 is not complete until the targeted browser conformance passes.
- IB11 is not started.

## 9. Targeted PF browser conformance and closure

**Repository state at ingestion:**
- `41f0295` = origin, working tree clean;
- production `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`;
- `p_conformance_ib10.cjs` and production are unchanged since `41f0295` (`git diff --quiet`).

**Raw operator files (TC: Chrome 154 + Tampermonkey 5.5.0). Not committed; SHA-256 verified equal to the operator's values:**

| File | SHA-256 |
| --- | --- |
| e621 positive | `655e83ca979ad1b70fff0b370e4b7926a177da53dd9e9900cced07b8bfeec922` |
| e621 negative | `786e296e70e4da117323b38e62736789a00f708c267d87908254863129a26c71` |
| e926 positive | `149c10ba42171882fd1a3b01e4434502a61018dfd16bf6e1c8395b6874ac0061` |
| e926 negative | `489ee7d05ba9761f1f7a3e8fe870e4ff58f5a59676adc78831b8b3a267f2faa8` |

**Evaluator:** `node tests/browser/ib10/p_conformance_ib10.cjs targeted <e621 positive> <e621 negative> <e926 positive> <e926 negative>` (revision 1.2, one invocation). **Exit 0, `pass: true`.**
- **T0:** all four files report `MATCH_EXPECTED_ARTIFACT`, with no sanitation block.
- **Counts:** 114 PASS, 0 FAIL, 26 OUT_OF_SCOPE (excluded generations, judged by N1/N2/V1), 9 CONTAMINATED.
- The 9 CONTAMINATED generations are all deliberate View clicks on excluded cards (the V3-L classifier marks viewer opens). None is an admitted generation.

| Host | Positive (admitted) | Negative (required class) | View |
| --- | --- | --- | --- |
| e621 | WebM: 84 usable, 84 PASS, 0 FAIL; 63 quick passes, 21 sustained previews, 16 after ready | MP4: 21 generations, 0 N1/N2 failures, 14 trusted sustained | 4 |
| e926 | MP4 < 50 MB: 30 usable, 30 PASS, 0 FAIL; 17 quick passes, 13 sustained previews, 12 after ready | WebM: 14 generations, 0 N1/N2 failures, 8 trusted sustained | 5 |

**Independent reading of the raw files (agrees with the evaluator):**
- Admitted sources set at 201–214 ms (e621) and 200–214 ms (e926).
- All 28 plays muted.
- At most one source-holding hover at any sample; 0 in the negative sessions.
- Excluded generations: 0 hover `<video>` elements in total.
- No e926 MP4 ≥ 50 MB was encountered (optional class; not evidenced live).

**Closure review against Blueprint §3 IB10:**
- **The reopened defect is resolved.** Admitted e621 WebM and e926 MP4 keep the qualified automatic muted hover video (live, both hosts). Every other recognized video class falls back to thumbnail + deliberate View (locally for 12 inputs plus Rule34; live for e621 MP4 and e926 WebM).
- **Excluded classes are not qualified.** Their G-VIDEO stays OPEN.
- **History is kept.** `8a4d6d8` is kept as the first closure, now marked reopened. The owner's choice is recorded as Blueprint enforcement (option B). No record still claims that keeping D1–D4 outside the class was an owner decision (`grep`: the remaining mentions are corrections).
- **Acceptance (unchanged from §7):**
  - 200 ms dwell;
  - always muted;
  - immediate source release;
  - no stale resurrection (local and controlled);
  - viewer takeover (local and controlled);
  - bounded ownership;
  - controlled Range / no-Range / FAST with +5 s transport;
  - representative live eligibility.
- **Forbidden items: none in the IB10 production diff** `b9d133c..4d793a2`, which is 75 lines added and 5 removed:
  - no native scheduler;
  - no guessed URL or rendition (the IB08 rendition fact is read only);
  - no byte or duration cap on transfers (`maxBytes` is the admission bound read from `data-size`);
  - no archive work;
  - no viewer mute coupling.

**Outcome:** **IB10 COMPLETE — PASS(scope)**.
- **Automatic-video scope:**
  - TC only;
  - logged-out native `/posts`;
  - e621 WebM ≤ 100,000,000 B and e926 MP4 < 50,000,000 B;
  - numeric `data-size` and a same-container `data-file-url`;
  - original-file source.
- **All other video classes:** poster/View fallback; their G-VIDEO stays OPEN.
- IB11 not started.
