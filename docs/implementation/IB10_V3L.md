# IB10 — V3-L representative live observation: package (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, items 9–10: representative live class eligibility). **G-VIDEO is OPEN.** Production is commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, **unchanged**.
- **Status: package prepared and locally qualified; the live run is pending (operator).** No live finding is claimed.

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

## 6. After the run

1. Analyze the returned results: `node tests/browser/ib10/analyze_ib10_v3l.cjs <files…>`.
2. Derive classes from the observed `data-size` distribution.
3. Decide the G-VIDEO E evidence for representative live classes.

G-VIDEO is not PASS before that.
