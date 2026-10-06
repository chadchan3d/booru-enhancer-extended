# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB10 — Muted hover-video lifecycle: PARTIAL — REOPENED FOR BLUEPRINT CONFORMANCE.** The owner chose Blueprint enforcement (option B). The completion recorded at `8a4d6d8` is reopened, because the Blueprint's "Poster fallback elsewhere" (IB10 item 3; item 11 "poster/View") was not implemented: unqualified video cards still auto-played.

**Fixed in production `4d793a2`, qualified locally.** The targeted browser conformance is pending with the operator. Earlier evidence and the admitted-class G-VIDEO PASS(scope) are retained (`IB10_COMPLETION_RECORD.md` is historical, with a reopen note; `IB10_P_STAGE.md` §8).

- **Admitted class (automatic muted hover video):**
  - TC only (Chrome 154 + Tampermonkey 5.5.0);
  - logged-out native `/posts`;
  - e621 WebM ≤ 100,000,000 B and e926 MP4 < 50,000,000 B, with a numeric `data-size` and a same-container `data-file-url`;
  - original-file source.

  Its behavior:
  - immediate thumbnail;
  - 200 ms dwell before video work;
  - always muted;
  - immediate release on leave, dispose and viewer opening;
  - nothing installs while the viewer is open;
  - at most one source-holding hover.
- **Every other recognized video card:** poster/View fallback. It keeps the thumbnail and the View path, with no hover `<video>`, no source and no play. This covers:
  - e621 MP4;
  - e926 WebM;
  - e926 MP4 ≥ 50 MB;
  - e621 WebM > 100 MB;
  - MOV;
  - missing size or a mismatched URL;
  - logged-in pages and other routes;
  - other hosts.

  Their G-VIDEO stays OPEN.

**IB11 is not started.**

## Current state
- Branch `implementation/ib00-baseline`, pushed to `origin/implementation/ib00-baseline`.
- Production `Booru_Enhancer.user.js`: commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `00915584…e945` (IB10 poster/View fallback).
- **Previous artifacts:**
  - `8324552` / `4258ad7`: IB10 P; evidence for the admitted class;
  - `b9d133c` / `22e843c`: IB09, and the IB10 E stage.
- `main` is the untouched published baseline. `origin/implementation/ib01-harness` exists as a separate branch; its PR state is not verified here.

## Completed checkpoints (records in `docs/implementation/`)
- **IB00–IB03:** PASS. IB02 is a local prerequisite only; IB03 is scoped to measured TC (Tampermonkey × Chromium) primitives.
- **IB04, IB05, IB06:** complete for the active TC path. G-OWN, G-SETTINGS and G-REQUEST are PASS in TC, at the E stage and in production.
- **IB07:** PASS(scope). G-HOST covers the Rule34, e621, e926 and Gelbooru rows as recorded.
- **IB08:** PASS(scope). G-RENDITION covers logged-out e621/e926 `/posts`, the two-source WebP/JPEG card.
- **IB09:** PASS(scope). G-HOVER covers the e621/e926 IB08-qualified still-image class: 200 ms dwell, nothing before dwell (overlay at dwell), PREVIEW → native SAMPLE or alias only.
- **IB10:** reopened, PARTIAL (see Current milestone).
  - Owner decisions: 200 ms dwell; the viewer ends the hover; original-file source; V3-R Option A (immediate release, no retained or cached prior hover); Blueprint enforcement of the poster/View fallback (option B).

## Gates relevant to the next step
- **G-VIDEO:**
  - PASS(scope) for the two admitted classes, in TC only (evidence on `8324552`; behavior unchanged at `4d793a2`, shown by local identity and fault checks);
  - OPEN for every other container, size, host, route, logged-in page, GIF/animated class and cell. The poster/View fallback is not a qualification.
- **G-PLAY: OPEN.** Viewer playback and preference cases belong to IB11. IB10 makes no G-PLAY claim.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB10 reopen, local on `4d793a2`:**
  - P-stage suite 67/67 (12 fault controls, including the old automatic hover video restored for an excluded class, and the fallback applied to the admitted class);
  - PF package and evaluator revision 1.2: 25/25 (including the `8324552` package failing N1 on both hosts).
- **Regressions on `4d793a2`:**
  - IB01, IB02, IB03, IB05 and IB06 exit 0;
  - IB07 passes (`item9` and `pagecount` exit 1 on their IB07 blob pin only);
  - IB08: 66/66, 24/24, 12/12, 14/14; browser 90/90, 59/59, 56/56, 65/65;
  - IB09: 32/32, 84/84, 54/54, P-stage 111/111; browser 30/30, 57/57, 39/39;
  - IB10 E: 34/34, V3-C 29/29, V3-L 31/31, V3-R 52/53 (its E-stage pin);
  - IB10 P (`8324552`) verifiers: 34/35 and 22/23 (their working-tree pins only).
- **IB10 live P conformance on `8324552`: PASS** (evaluator revision 1.1). 203 PASS, 0 FAIL, 1 OUT_OF_SCOPE.
  - e621 WebM 84/84: raw SHA-256 `ef0c37b2…0b70`.
  - e926 MP4 119/119: raw `3d31f681…b7f1`.
  - Raw files are not committed.
- **IB10 controlled P conformance on `8324552`: 54/54 PASS** (C1–C5): `27e90c6c…e175` plus recovery `9eaf56dc…7d48`.
- **IB10 E stage:** baseline 34/34; V3-C 54/54 cells; V3-L 202/202 live; V3-R 16/16 cells. Records: `IB10_HOVER_VIDEO_BASELINE.md`, `IB10_V3C.md`, `IB10_V3L.md`, `IB10_V3R.md`.
- **IB09 live production conformance on `b9d133c`:** all four sessions PASS (`IB09_COMPLETION_RECORD.md`).

## Unresolved, parked, deferred
- **IB10 open items:**
  - The targeted browser conformance of `4d793a2` is pending (package `IB10_PF_Live_Observer.user.js`, SHA-256 `58074ab1…6ebe`).
  - Unqualified video classes: G-VIDEO stays OPEN.
  - *Correction:* the earlier record called the retained automatic video outside the admitted class an owner decision. It was not; it was the unimplemented Blueprint fallback, now corrected.
  - Controlled runs used no-store; nothing is claimed about real cache headers.
  - The e926 20–50 MB band is thin; live viewer takeover of an admitted hover was not exercised.
  - TC only; the e621 ≤ 100 MB bound is the observed maximum.
- **IB09 limitations:**
  - throttled usefulness observed on e621 only;
  - transfer sizes mostly browser-hidden;
  - out-of-scope still cards keep pre-dwell work by design;
  - no Original-target, animated or unknown class qualified (thumbnail/View; not a ban).
- **IB08 limitations:** stale owned class tokens after dispose (no presentation effect); a container-class rewrite risk (not observed); runtime versions and DPR not relayed.
- **IB10 fixtures:** externally supplied and not tracked. Committed once by mistake in `0a43e73`; removed in `1820c18` without a history rewrite. Their exact paths are in `.gitignore`.
- **Retained:** live request counting starts at the postamble. The earlier slot-provenance runs are SUPERSEDED.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.
- **Deferred:**
  - IB11 viewer, IB12 pagination, IB13 downloads, IB14 favorites/actions, IB16/IB17 Pixiv, IB18 other runtime cells;
  - IB15 UI note: increase the settings-window text/font size for readability.

## Next
**Active: IB10, reopened.** The operator runs the targeted browser conformance of `4d793a2`, following `tests/browser/ib10/README.md` ("IB10 PF targeted conformance"): e621 WebM positive + MP4 negative + View; e926 MP4 < 50 MB positive + WebM negative (+ MP4 ≥ 50 MB if available) + View. The result is evaluated with `p_conformance_ib10.cjs targeted` (revision 1.2). IB10 completes only if it passes. Do not start IB11.
