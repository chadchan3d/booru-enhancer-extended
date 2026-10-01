# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB10 — Muted hover-video lifecycle: PARTIAL — NOT COMPLETE (E stage). G-VIDEO OPEN.** The local baseline is characterized (`IB10_HOVER_VIDEO_BASELINE.md`). **V3-C controlled run complete and analyzed** (`IB10_V3C.md`): 54/54 clean cells, after dropping 2 contaminated attempts. There is no production change. IB09 is COMPLETE, PASS(scope) (`IB09_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. The working tree is clean, and HEAD equals `origin/implementation/ib00-baseline`.
- Production `Booru_Enhancer.user.js`: commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae`, production body SHA-256 `6df35f16…f992`.
- `main` is the untouched published baseline. `origin/implementation/ib01-harness` exists as a separate branch; its PR state is not verified here.

## Completed checkpoints (records in `docs/implementation/`)
- **IB00–IB03:** PASS. IB02 is a local prerequisite only; IB03 is scoped to measured TC (Tampermonkey × Chromium) primitives.
- **IB04, IB05, IB06:** complete for the active TC path. G-OWN, G-SETTINGS and G-REQUEST are PASS in TC, at the E stage and in production.
- **IB07:** PASS(scope). G-HOST covers the Rule34, e621, e926 and Gelbooru rows as recorded.
- **IB08:** PASS(scope). G-RENDITION covers logged-out e621/e926 `/posts`, the two-source WebP/JPEG card.
- **IB09:** PASS(scope). G-HOVER covers the e621/e926 IB08-qualified still-image class:
  - 200 ms dwell;
  - no hover metadata request or media assignment before dwell (overlay at dwell, option B);
  - displayed PREVIEW → native SAMPLE or SAMPLE|FILE alias; SAMPLE/FILE → no upgrade and no downgrade;
  - everything else keeps its previous path or thumbnail/View.

## Gates relevant to the next step
- **G-VIDEO (class, cell): OPEN.** It must reach E → PASS before automatic hover-video integration (blueprint IB10 item 6).
- **IB10 defects found in current production (not corrected):**
  - D1: the video FILE source is assigned at pointer-enter, with no dwell;
  - D2 **CONFIRMED by transport**: after readiness, leave/dispose/viewer-close leaves the request streaming through +5 s (~1.06–1.15 MB/5 s throttled; under FAST the file completes after leave). Pending release aborts within ±1 ms;
  - D3 **CONFIRMED, narrowed**: detached source-holding elements accumulate. Transfer multiplies when URLs differ (A→B: 2 streams) or without Range (5 concurrent streams); with Range, same-URL elements share one request;
  - D4: the viewer takeover does not stop the hover video, and a hover video that becomes ready during the viewer is installed and played (V3-C controlled-confirmed; NORANGE adds a concurrent viewer stream).
- **IB10 facts that hold:** always muted at play; stale generations never install; pending elements are released on leave.
- **IB10 measurable classes:** e621/e926 logged-out `/posts` video cards in TC, by container (webm/mp4) and `data-size` band. The original file is the only hover source; there is no cheaper-stream fact. Rule34 and Gelbooru video contexts are OPEN.
- **G-HOVER:** its cost allowance is available for video evaluation (IB09 item 13). Video admission is not inherited.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB10 V3-C** (`tests/browser/ib10/`): local qualification 29/29 (3/3 faults). The operator run in Chrome 154 + Tampermonkey 5.5.0 was identity-matched in all entries. Clean selection 54/54; evidence in `tests/browser/ib10/results/` (times rebased). Fixture SHA-256 matched the pinned values.
  - The controlled portion of IB10 item 9 is satisfied for the original-file class in TC. Excluded: cached, lower-cost variants, other cells.
- **IB10 E baseline** on `22e843c` (`tests/host/ib10/hover_video_baseline.cjs`): 34/34 on e621 and e926, webm and mp4. 7/7 fault controls, including 2 positive controls (release on leave; dwell for video).
- **IB09 live production conformance on `b9d133c`:** e621 P1/P2 and e926 P1/P2 all PASS, with the artifact identity matched. In the qualified class every session showed 0 before-dwell media, overlay, fetches and quick-pass work, and 0 downgrades and stale installs. Out-of-scope video and animated generations kept their previous behavior.
- **Local on `22e843c`:**
  - IB09 P-stage 111/111 (11 fault controls); conformance verifier 30/30;
  - IB08 66/66, 24/24, 12/12, 14/14, 90/90;
  - IB01, IB02, IB03, IB05 and IB06 exit 0;
  - IB07 exclusion and Gelbooru exit 0; IB07 `item9` and `pagecount` exit 1 on their IB07 blob pin only.

## Unresolved, parked, deferred
- **IB10 V3-C limitations:**
  - first-frame callbacks preceded `loadeddata`, so 5 of 6 first-frame cells were pending leaves;
  - under FAST, readiness beat the 40 ms leave;
  - RANGE viewer cells can't split hover from viewer bytes;
  - the window is +5 s (later buffer-limit pausing is not observed);
  - cache is excluded by design (no-store);
  - TC only.
- **IB10 fixtures:** externally supplied and not tracked. Committed once by mistake in `0a43e73`; removed in `1820c18` without a history rewrite. Their exact paths are in `.gitignore`.
- **IB09 limitations:**
  - throttled usefulness is observed on e621 only;
  - transfer sizes are mostly browser-hidden;
  - out-of-scope cards keep pre-dwell work by design;
  - no Original-target, animated or unknown class is qualified (thumbnail/View; not a ban).
- **IB08 limitations:** stale owned class tokens after dispose (no presentation effect); a container-class rewrite risk (not observed); runtime versions and DPR not relayed.
- **Retained:** live request counting starts at the postamble. The earlier slot-provenance runs are SUPERSEDED.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB11 viewer, IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**Active checkpoint: IB10 — Muted hover-video lifecycle, E stage.**

**One bounded next action (not executed):** prepare **V3-L**, an observe-only live package on logged-out e621/e926 `/posts` with production unchanged. For the operator's real hovers on video cards it records:
- class (container × `data-size` band);
- readiness and first-frame times;
- whether leave came before or after readiness;
- the hover element's `src`, `networkState` and `buffered` at leave, +1 s and +5 s;
- concurrent source-holding elements;
- Resource Timing where visible.

40 generations per host. G-VIDEO stays OPEN until that live-class evidence is reviewed. No production change.
