# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB10 — Muted hover-video lifecycle: COMPLETE, PASS(scope)** (`IB10_COMPLETION_RECORD.md`). G-VIDEO(class, cell) PASS(scope), from the E stage and production conformance.
- **Scope:**
  - TC only (Chrome 154 + Tampermonkey 5.5.0);
  - logged-out native `/posts`;
  - e621 WebM ≤ 100,000,000 B and e926 MP4 < 50,000,000 B, with a numeric `data-size` and a same-container `data-file-url`;
  - original-file source.
- **Behavior:**
  - immediate thumbnail;
  - 200 ms dwell before video work;
  - always muted;
  - immediate release on leave, dispose and viewer opening (pause, remove `src` and `<source>`, `load()`);
  - nothing installs while the viewer is open;
  - at most one source-holding hover.

All other classes and cells keep their previous path and remain OPEN or deferred. **IB11 is not started.**

## Current state
- Branch `implementation/ib00-baseline`. The working tree is clean, and HEAD equals `origin/implementation/ib00-baseline`.
- Production `Booru_Enhancer.user.js`: commit `8324552`, blob `4258ad7746c022606f222fc48924055912de4cfc`, production body SHA-256 `7a0a2b49…bb3a` (the IB10 artifact). The previous artifact, `b9d133c` / `22e843c`, is the IB09 and IB10 E-stage artifact.
- `main` is the untouched published baseline. `origin/implementation/ib01-harness` exists as a separate branch; its PR state is not verified here.

## Completed checkpoints (records in `docs/implementation/`)
- **IB00–IB03:** PASS. IB02 is a local prerequisite only; IB03 is scoped to measured TC (Tampermonkey × Chromium) primitives.
- **IB04, IB05, IB06:** complete for the active TC path. G-OWN, G-SETTINGS and G-REQUEST are PASS in TC, at the E stage and in production.
- **IB07:** PASS(scope). G-HOST covers the Rule34, e621, e926 and Gelbooru rows as recorded.
- **IB08:** PASS(scope). G-RENDITION covers logged-out e621/e926 `/posts`, the two-source WebP/JPEG card.
- **IB09:** PASS(scope). G-HOVER covers the e621/e926 IB08-qualified still-image class: 200 ms dwell, nothing before dwell (overlay at dwell), PREVIEW → native SAMPLE or alias only.
- **IB10:** PASS(scope). G-VIDEO, as in the Current milestone.
  - Owner decisions: 200 ms dwell; the viewer ends the hover; original-file source; V3-R Option A (immediate release, no retained or cached prior hover).

## Gates relevant to the next step
- **G-PLAY: OPEN.** Viewer playback and preference cases belong to IB11. IB10 makes no G-PLAY claim.
- **G-VIDEO:** PASS(scope) for the two measured classes in TC only. Other containers, sizes, hosts, routes, logged-in pages, GIF/animated and other cells stay OPEN.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB10 live P conformance: PASS** (evaluator revision 1.1). 203 PASS, 0 FAIL, 1 OUT_OF_SCOPE (an e926 MP4 of 79,810,863 B).
  - e621 WebM 84/84: raw SHA-256 `ef0c37b2…0b70`.
  - e926 MP4 119/119: raw `3d31f681…b7f1`.
  - Sources set at 200–217 ms; detached and source-free at leave, +1 s and +5 s; all plays muted; at most one source holder.
  - Raw files are not committed.
- **IB10 controlled P conformance: 54/54 PASS** (C1–C5). Original run 45 clean (`27e90c6c…e175`) plus recovery 9 clean (`9eaf56dc…7d48`). Range / no-Range / FAST × MP4/WebM, with +5 s server byte observation.
- **IB10 local on `4258ad7`:**
  - P-stage assertions 64/64 (10 fault controls);
  - conformance packages and evaluator 35/35;
  - recovery tooling 23/23.
- **IB10 E stage:** baseline 34/34; V3-C 54/54 cells; V3-L 202/202 live (G-VIDEO E gate); V3-R 16/16 cells (retention decision basis). Records: `IB10_HOVER_VIDEO_BASELINE.md`, `IB10_V3C.md`, `IB10_V3L.md`, `IB10_V3R.md`. Sanitized aggregates are in `tests/browser/ib10/results/`.
- **Regressions on `4258ad7`:**
  - IB01, IB02, IB03, IB05 and IB06 exit 0;
  - IB07 passes (`item9` and `pagecount` exit 1 on their IB07 blob pin only);
  - IB08 66/66, 24/24, 12/12, 14/14, 90/90;
  - IB09 suites pass (P-stage 111/111, pinned to `b9d133c`);
  - V3-R verifier 52/53 by design (its E-stage working-tree pin is superseded).
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS (`IB09_COMPLETION_RECORD.md`).

## Unresolved, parked, deferred
- **IB10 retained limitations (completion record):**
  - Outside the admitted class, the pre-IB10 hover-video path remains, with D1–D4: no dwell, source kept after leave, accumulation, and no viewer takeover. This is by owner decision, so the Blueprint's "poster fallback elsewhere" is not applied there; those classes are unqualified, not failed.
  - Controlled runs used no-store; cached transfers were covered only by V3-R's cacheable arm. Nothing is claimed about e621/e926's real cache headers.
  - One container per host was observed live; the e926 20–50 MB band is thin; live viewer takeover was not exercised.
  - The real-network round trip of a revisit's one new request is unmeasured.
  - TC only; the e621 ≤ 100 MB bound is the observed maximum.
- **IB09 limitations:**
  - throttled usefulness observed on e621 only;
  - transfer sizes mostly browser-hidden;
  - out-of-scope cards keep pre-dwell work by design;
  - no Original-target, animated or unknown class qualified (thumbnail/View; not a ban).
- **IB08 limitations:** stale owned class tokens after dispose (no presentation effect); a container-class rewrite risk (not observed); runtime versions and DPR not relayed.
- **IB10 fixtures:** externally supplied and not tracked. Committed once by mistake in `0a43e73`; removed in `1820c18` without a history rewrite. Their exact paths are in `.gitignore`.
- **Retained:** live request counting starts at the postamble. The earlier slot-provenance runs are SUPERSEDED.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB11 viewer, IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**IB10 checkpoint handoff.** IB10 is COMPLETE, PASS(scope). The next eligible checkpoint in the blueprint sequence is **IB11 — Existing viewer hardening**. It is not started and not assigned here.
