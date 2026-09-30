# Ledger

## Blueprint in force
`docs/implementation/Final_Implementation_Blueprint.md`, Version 1.0 (26 September 2026), commit `4c81cde`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`, SHA-256 `747b297b…8a9f`. Unchanged since it was added.

## Current milestone
**IB09 — Still-image hover dwell and cost: COMPLETE, PASS(scope)** (`IB09_COMPLETION_RECORD.md`). **IB10 is eligible and not started.**

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
- **G-HOVER:** its cost allowance is available for video evaluation (IB09 item 13). Video admission is not inherited.
- **G-RUNTIME:** only the TC cell is measured; other cells are open (IB18).

## Verified
- **IB09 live production conformance on `b9d133c`:** e621 P1/P2 and e926 P1/P2 all PASS, with the artifact identity matched. In the qualified class every session showed 0 before-dwell media, overlay, fetches and quick-pass work, and 0 downgrades and stale installs. Out-of-scope video and animated generations kept their previous behavior.
- **Local on `22e843c`:**
  - IB09 P-stage 111/111 (11 fault controls); conformance verifier 30/30;
  - IB08 66/66, 24/24, 12/12, 14/14, 90/90;
  - IB01, IB02, IB03, IB05 and IB06 exit 0;
  - IB07 exclusion and Gelbooru exit 0; IB07 `item9` and `pagecount` exit 1 on their IB07 blob pin only.

## Unresolved, parked, deferred
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
**Next eligible checkpoint: IB10 — Muted hover-video lifecycle** (blueprint §3 IB10). It is not started.

**One bounded next action (not executed):** open the IB10 E stage by declaring its §11 scope. Then run a local, no-production-change baseline of the existing hover-video path on `b9d133c`, using the IB09 fake-clock harness. It should record source assignment, play/pause and detach on:
- leave before and after `loadeddata`;
- five re-entries;
- late play/readiness handlers.

Report the findings before any G-VIDEO probe or production change.
