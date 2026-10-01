# IB10 — V3-L representative live observation: package (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, items 9–10: representative live class eligibility). **G-VIDEO is OPEN.** Production is commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, **unchanged**.
- **Status: live run complete and analyzed (§7). G-VIDEO(class, cell) E → PASS(scope) for the classes in §7.9.** Raw live results are **not** committed (they identify posts). Only the sanitized aggregate is: `tests/browser/ib10/results/ib10-v3l-aggregate.json`.

## 1. Package

| Item | Value |
| --- | --- |
| Package | `tests/browser/ib10/IB10_V3L_Live_Observer.user.js`, built by `build_ib10_v3l.cjs` from `b9d133c`. The executed body equals the production body byte for byte (no hooks), and its in-page identity is checked against production-body SHA-256 `6df35f16…f992` |
| Parts | `v3l_preamble.js` (recorder); `v3l_classify.js` (shared classifier, also used by the analyzer); `v3l_postamble.js` (observer); `analyze_ib10_v3l.cjs`; `verify_ib10_v3l.cjs` |
| Scope | `@match` only `*://e621.net/*` and `*://e926.net/*`. A session starts only on `/posts` (search allowed), logged out (`data-user-is-anonymous="true"`), with hover preview on. The cell is TC |
| Checksums | `tests/browser/ib10/IB10_V3L_SHA256SUMS.txt` |

**Observe-only.**
- **Pass-through wrappers:** every wrapper (`document.createElement` for `video`, the `src` setter, `removeAttribute`, `load`/`pause`/`play`, `BE.modules.hover.show`/`hide`, `BE.modules.viewer.open`) records, then calls the original with the same arguments and returns its result.
- **Static check:** the package code never calls `pause`/`play`/`load`/`removeAttribute('src')` itself, and never assigns `src`/`preload`/`muted`/`autoplay`/`loop`/`currentTime`. It never touches settings, storage, cookies or the network.
- **Runtime check:** production's timed media actions are **identical with and without the package**.

## 2. Live data schema (per session, per video-card generation)

`{ probe: 'ib10-v3l-live', version: '1.0.0', site, production_body_identity, runtime: { browser, manager }, sessions: [ { droppedBeyondCap, otherHovers, summary, generations: [ G ] } ] }`

The classifier sets `G.classification`:
- `status`: `USABLE` / `AMBIGUOUS` / `CONTAMINATED`;
- `reasons`;
- `leave`: `BEFORE_READY` / `AFTER_READY` / `NONE`;
- `rtCompleted`, `rtSizesHidden`, `fullyBufferedAt5s`.

Each `G` carries the following fields. All times are ms relative to that generation's pointer-enter.

| Field | Content |
| --- | --- |
| `n`, `host`, `container` | ordinal; `e621.net`/`e926.net`; `mp4`/`webm`/`mov` as encountered |
| `dataSize`, `width`, `height` | exact native card values (no bands) |
| `cardOrdinal`, `hoverOnCard` | distinct-card number and repeat count (no IDs) |
| `trigger` | `TRUSTED` (real pointer event ≤ 1 s before `show`), `SYNTHETIC` or `UNKNOWN` |
| `enterT`, `leaveT` | session-relative enter; stay (ms) |
| `viewerOpened` | the viewer opened while this generation's window was open |
| `hoverElements` | hover `<video>` elements production created in the generation |
| `element` | `srcMatchesCardFile`, `srcSetT`, `srcRemovedT[]`, `calls[]` (`load`/`pause`/`play`, muted), `readiness` {`loadedmetadata`, `loadeddata`, `canplay`, `playing`}, `firstFrame`, `events[]` (time, name, `readyState`, `networkState`, buffered end) |
| `samples.leave` / `.p1` / `.p5` | `t`; `element` {`attached`, `inHover`, `holdsSrc`, `networkState`, `readyState`, `bufferedEnd`, `duration`, `paused`}; `holdingHoverVideos`; `viewerOpen`; `hidden` |
| `resourceTiming[]` | entries for the card's file only, as exposed: `initiatorType`, `startT`, `responseEnd`, `transferSize`, `encodedBodySize`, `decodedBodySize` |

## 3. Contamination and exclusion rules (`v3l_classify.js`)

- **CONTAMINATED:**
  - the trigger was not `TRUSTED`;
  - the viewer was opened during the generation's window, or open at a sample;
  - the page was hidden at any sample.
- **AMBIGUOUS:**
  - no hover `<video>` was created;
  - more than one was created;
  - the hover `src` is not the card's own `data-file-url`;
  - there is no leave;
  - the leave, +1 s or +5 s sample is missing.
- **USABLE:** otherwise.
- **Readiness:** the first `loadeddata`. `BEFORE_READY` means the leave came before readiness, or there was none.
- **Transfer facts:** kept apart (Resource Timing completed / sizes hidden; element fully buffered). DOM state never stands in for network evidence.
- **Not recorded:** non-video cards are only counted (`otherHovers`). Generations beyond the cap are only counted (`droppedBeyondCap`).

## 4. Local qualification

`node tests/browser/ib10/verify_ib10_v3l.cjs`: **31/31** (`IB10_V3L_VERIFICATION.json`), with 9 fault controls. The run used the REAL package in jsdom with a fake clock and a simulated media model; this qualifies the recorder, not live behavior.
- **Static and identity:**
  - identity MATCH;
  - host restriction;
  - observe-only, statically and at runtime (identical production media actions).
- **What is recorded:**
  - only video-card hovers (the still card is counted);
  - exact facts per generation;
  - `src` at 0 ms, readiness at 120 ms, leave 40 / 300 ms;
  - samples at +1000 / +5000 ms;
  - before-ready release versus after-ready retention (DOM only);
  - accumulation: holding counts at each leave of 0, 1, 2, 3, 4, 5;
  - Resource Timing recorded only as exposed (hidden-size entry).
- **Classification:**
  - untrusted pointer → every generation CONTAMINATED;
  - with a trusted trigger, G1–G5 are USABLE and G6 is CONTAMINATED (viewer opened and closed before its leave);
  - the AMBIGUOUS rules hold.
- **Output and analyzer:**
  - no URLs or IDs, and no network;
  - the analyzer summarizes per host × container;
  - bounded sampling works.
- **Faults caught:**
  - tampered production body (MISMATCH);
  - a production-affecting wrapper mutation (runtime equivalence breaks);
  - route/login checks removed (session on a logged-in page);
  - viewer-open recording removed;
  - leave sampling removed;
  - readiness recording removed;
  - the +5 s sample removed;
  - the +1 s sample removed;
  - accumulation counted per generation only.
- **Found and fixed during preparation:** a viewer opened and closed between enter and leave was missed by sample-point checks. The observer now records viewer opens through a pass-through wrapper.

## 5. Workload and limitations

- **Workload:**
  - per host, about 40 video-card hovers, in sessions of 10–15 hovers, each ended with Show results and a page reload;
  - expected 10–20 minutes per host, depending on how many video cards the listing has. If a host or container has too few, the record states it, with no forced balance;
  - roughly 30–60 minutes total, including e926.
- **Bandwidth:** every hover past readiness downloads the whole original file and keeps downloading after leave (D2). With large originals this can reach hundreds of MB to several GB. Reloading the page stops the retained downloads.
- **Live byte evidence:** none. Live evidence is DOM and media state plus Resource Timing only. V3-C showed that after-ready retention (`networkState` LOADING with growing buffered end) matched continued server bytes in the controlled setting. Live, that remains a proxy.
- **Resource Timing:** cross-origin media sizes are usually hidden, and entries may appear only for completed responses.
- **Trust test:** "trusted" means a real `pointerover` within 1 s before the gallery's `show`.
- **Viewer contamination:** conservative. It marks every generation whose window overlaps a viewer open.
- **Sanitation:** exact `data-size` with native dimensions was requested. Together they could in principle single out a post, so committing raw live results to this public repository needs a decision. The analyzer's summaries (distributions) avoid that.

## 6. Analysis tooling (revision 1.1)

`analyze_ib10_v3l.cjs` changed in two ways:
- **Card counts:** card ordinals are per session (page load), so distinct cards are counted per session. Version 1.0 merged ordinals across sessions.
- **Added outputs:**
  - after-ready element categories (element state only, not bytes): `COMPLETE_AT_LEAVE`, `GREW_AFTER_LEAVE`, `GREW_AFTER_LEAVE_TO_FULL`, `IDLE_PARTIAL_NO_GROWTH`, `LOADING_NO_GROWTH`;
  - a first-hover versus repeat-hover split;
  - `--aggregate`: no per-generation records, sizes to 0.1 MB, resolution classes instead of exact dimensions.

The verifier still passes 31/31.

## 7. Live results (operator run; analyzed)

### 7.1 Session qualification
| File (not committed) | SHA-256 prefix | Host | Identity | Runtime | Sanitation | Generations |
| --- | --- | --- | --- | --- | --- | --- |
| e621 run 1 | `ba96c84b88024530` | e621.net | MATCH_EXPECTED_ARTIFACT | Chrome 154 + Tampermonkey 5.5.0 | ok | 50 (9 beyond cap) |
| e621 run 2 | `e54b7a79b3b44cfe` | e621.net | MATCH | same | ok | 63 (11 beyond cap) |
| e621 run 3 | `0b587812ed00a57d` | e621.net | MATCH | same | ok | 45 (17 beyond cap) |
| e926 run 1 | `b436877accde9a70` | e926.net | MATCH | same | ok | 44 (86 beyond cap) |

The archive holding all four files has SHA-256 `adab7967…5db4`.

### 7.2 Classification
- **Usable:** 202 of 202 (e621 158, e926 44). There were 0 ambiguous and 0 contaminated generations.
- **Clean conditions:** no viewer opens, no hidden page, every trigger trusted.

### 7.3 Container coverage (as naturally encountered)
- **e621:** every encountered video card was **WebM**, 158 generations on 67 distinct cards (per session).
- **e926:** every encountered video card was **MP4**, 44 generations on 19 cards.
- **Limitation:** this records what these sessions encountered. It does **not** show that MP4 is absent on e621 or WebM on e926.

### 7.4 Before readiness (e621 96, e926 24)
- **Release:** in every case production removed the source **at leave** (within 5 ms), and the element fired `abort` and `emptied`.
- **At +5 s:** the element was not holding a source, `networkState` was EMPTY, and buffered growth was 0.
- **Interpretation:** this matches V3-C, where the transport aborted within ±1 ms. Live, this is element evidence only.

### 7.5 After readiness (e621 62, e926 20)
At leave, +1 s and +5 s, every element was detached and still **holding its source** (62/62, 20/20). What the element state shows (element evidence, not bytes):

| State | e621 | e926 | Meaning |
| --- | --- | --- | --- |
| `GREW_AFTER_LEAVE` | 25 | 5 | still loading after leave |
| `GREW_AFTER_LEAVE_TO_FULL` | 6 | 2 | loaded to the end after leave |
| `COMPLETE_AT_LEAVE` | 15 | 10 | already fully buffered before leave: nothing left to stop |
| `IDLE_PARTIAL_NO_GROWTH` | 16 | 3 | partially buffered and the browser had suspended loading (`networkState` IDLE); no growth in 5 s |

- **Growth where it grew:** e621 0.2 / 8.5 / 23.6 s of media (min/median/max); e926 2.8 / 11.1 / 50.9 s.
- **`networkState` (leave/+1 s/+5 s), e621:** LOADING throughout 13; LOADING→IDLE 17; IDLE throughout 32.
- **`networkState`, e926:** IDLE throughout 12; LOADING→IDLE 8.
- **Completed versus repeat:** `COMPLETE_AT_LEAVE` occurs mostly on **repeat** hovers (e621 13 of 15, e926 8 of 10).

### 7.6 Source-holding accumulation
At most **29 (e621)** and **31 (e926)** detached hover `<video>` elements held a source at the same time. Every after-ready generation added one.

### 7.7 Readiness, D1 and caching
- **Source assignment:** the original file was assigned **0–2 ms after enter in every generation**, including all 58 (e621) and 26 (e926) passes under 200 ms.
- **`loadeddata` on first hovers:** median 515 ms (e621, n=22) and 197 ms (e926, n=6).
- **`loadeddata` on repeat hovers:** median 33 ms and 65 ms. Repeat hovers benefit from what the browser already holds. The data cannot separate the HTTP cache from same-URL sharing with retained elements.
- **Muted:** every observed `play()` was muted.

### 7.8 Reconciliation with V3-C
| Finding | V3-C (controlled transport) | V3-L (live, element evidence) | Disposition |
| --- | --- | --- | --- |
| **D1** no dwell | request starts 4–20 ms after enter; a 40 ms pass can fetch the whole file under FAST | source assigned 0–2 ms after enter in all 202, including every pass under 200 ms | **reproduced** |
| **D2** installed source kept after leave | throttled: stream continues through +5 s; FAST: completes | holds src 82/82; still loading or loaded to the end after leave in 38/82; already complete in 25; browser-idle partial in 19 | **reproduced, narrowed**: the live cost after leave is active transfer in about half the cases; the rest is retention (complete or idle partial) |
| **D3** accumulation | 5 elements; multiplied streams without Range or with different URLs | up to 29 / 31 holding elements at once | **reproduced** (element level; live transfer multiplication not observable) |
| **D4** viewer takeover | hover stays and installs during the viewer | not exercised live (no viewer opens, by design) | **V3-C only** |
| pending release | abort within ±1 ms | src removed at leave; `abort`/`emptied`; EMPTY | **reproduced** |
| muted | every play muted | every play muted | **holds** |

### 7.9 Data-size and resolution distribution (sanitized)
| Class | Size, MB (min / median / max, all generations) | First-hover size bands | First-hover resolution |
| --- | --- | --- | --- |
| e621 WebM | 0.8 / 12.1 / 100.0 | <5 MB 19, 5–20 MB 22, 20–50 MB 17, ≥50 MB 9 | ≤720p 11, 1080p 38, >1080p 18 |
| e926 MP4 | 0.2 / 5.3 / 39.6 | <5 MB 9, 5–20 MB 8, 20–50 MB 2, ≥50 MB 0 | ≤720p 11, 1080p 7, >1080p 1 |

The bands are derived from the observed distribution. Lifecycle behavior did not differ by band; the bands mark live coverage only.

### 7.10 Resource Timing and evidence limits
- **Resource Timing:** 256 entries (all `initiatorType` `video`), and **every one hid its sizes**. Entries appeared for aborted (before-ready) loads too, so an entry with `responseEnd` is **not** evidence of completion. Resource Timing contributes nothing to byte accounting here.
- **Live evidence is DOM/media state:** buffered growth, `networkState`, and whether the source is held. It is **not direct byte-level proof**. The byte-level proof of release and continuation is V3-C, controlled and TC only.
- **Other limits:**
  - one cell;
  - one container per host, as encountered;
  - e926 20–50 MB has only 2 first-hover cards;
  - repeat hovers dominate the `COMPLETE_AT_LEAVE` cases.

## 8. Gate disposition: G-VIDEO(class, cell), E → **PASS(scope)**

**Basis:** blueprint IB10 items 9–10 require both controlled lifecycle evidence and representative live eligibility.
- **Controlled:** V3-C covered both containers, three transports and every hover release path, with byte-level traces to +5 s.
- **Live:** V3-L, 202 usable generations.

The live evidence reproduces the controlled lifecycle. It shows no audible hover, no stale reattachment (stale generations never install: baseline and V3-C), and no live class whose behavior departs from V3-C. The orphan-element and abandoned-transfer defects (D2/D3) are what the P stage must correct. They are evidence for the policy, not a failure of the class.

**Admitted (TC cell: Chrome 154 + Tampermonkey 5.5.0; logged-out native `/posts` listing; production original-file hover source):**
- **e621.net WebM video cards:** observed range 0.8–100 MB, all four size bands.
- **e926.net MP4 video cards:** observed range 0.2–39.6 MB (<50 MB; the 20–50 MB band is thin, 2 cards).

**The PASS admits a lifecycle policy, not a stream or a cap.** E-stage decisions recorded with the gate (the operator may revise them before the P stage):
1. **No video source before dwell:** the same 200 ms dwell as the IB09 class (D1).
2. **Release on leave, dispose and viewer takeover:** pause, remove `src`, `load()` for installed as well as pending hover video. V3-C shows this aborts an active transfer immediately (D2).
3. **Bounded holding:** at most one hover video element holding a source at a time (D3).
4. **Viewer takeover ends the hover:** no hover install while the viewer is open (D4).
5. **Muted as today; source as today:** the original file. No cheaper stream, no guessed URLs, no byte cap.

**Trade-off to measure in P conformance, not assume:** releasing the source stops abandoned active transfer, but it also drops the element's own buffer. Repeat-hover readiness (median 33–65 ms live) may then depend on the HTTP cache alone. Already-complete media (25 of 82) costs nothing further either way.

**Excluded / OPEN:**
- e621 MP4 and e926 WebM (not encountered live; controlled evidence only);
- e926 MP4 ≥ 50 MB and MOV;
- logged-in pages, other routes, post pages;
- Rule34 / Gelbooru video;
- GIF / animated;
- other cells (VC/TF/VF);
- viewer playback (IB11, G-PLAY).

These keep their previous behavior.

## 9. Smallest justified P-stage change (not implemented)

This change is in the existing hover module only, for the admitted classes, identified by existing facts:
- the card's IB08 rendition fact is `NATIVE_UNSUPPORTED` (admitted page) and not `NATIVE_OUT_OF_SCOPE`;
- the host is e621 with `data-file-ext` `webm`, or e926 with `data-file-ext` `mp4` and `data-size` < 50 MB.

The steps:
1. **Dwell** (D1): route these cards through the existing qualified dwell path, so the overlay and the video source assignment happen only at 200 ms.
2. **Release on hide** (D2, D3): for an installed hover video of these classes, `hide()` does what `cancelPendingUpgrade` already does for a pending one: `pause`, `removeAttribute('src')`, `load()`. Then detach.
3. **Viewer takeover** (D4): the gallery's viewer-open path ends the hover (`BE.modules.hover.hide()`), and `ready()` refuses to install while the viewer is open.

**Tests:**
- port `tests/host/ib10/hover_video_baseline.cjs` scenarios to production assertions, with the admitted-class expectations inverted (released and dwell-gated) and out-of-scope identity to `b9d133c`;
- rerun V3-C on the new artifact: transport abort after ready, and the repeat-readiness trade-off;
- live conformance with the V3-L observer on e621 and e926.

**Not in scope:** stream choice, caps, viewer policy, GIF.
