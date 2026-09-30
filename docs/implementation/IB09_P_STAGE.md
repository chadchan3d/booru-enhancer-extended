# IB09 — P stage: frozen still-image hover policy in production

**Checkpoint:** IB09 — Still-image hover dwell and cost (blueprint §3 IB09, item 3 "P", items 9–11). **G-HOVER(e621/e926 qualified still-image class) PASS(scope)** (`IB09_E_CLOSEOUT.md` §4).
**Status:** superseded by `IB09_COMPLETION_RECORD.md`. All four live production-conformance sessions passed, and IB09 is PASS(scope). IB10 has not started.

## 1. Production artifact

- **Commit:** `b9d133c`
- **Blob:** `Booru_Enhancer.user.js` `22e843cbe27662fc27d17149534b055d7a249dae` (was `bbaf9ac`)
- **Diff against `bbaf9ac`:** 48 added lines, 0 removed, all inside `BE.modules.hover`
- **Scope correction:** the first P commit `16f821e` (blob `3161b51`) also put still cards that fail the IB08 pattern under the dwell. Those cards are outside G-HOVER PASS(scope). `b9d133c` restricts the dwell to the qualified class, and those cards keep their previous path
- **CHANGELOG:** "Unreleased — e621/e926 hover preview timing"

| Element | Change |
| --- | --- |
| `HOVER_DWELL_MS = 200`, `dwellTimer` | The frozen dwell. One timer per hover generation |
| `hoverQualifiedWrap(img)` | The G-HOVER class from an existing fact only: the card's IB08 rendition enum (`BE.modules.gallery.getThumbRendition`) is `NATIVE_PREVIEW`, `OWNED_SAMPLE` or `OWNED_ORIGINAL`. Those values are produced only when `e6RenditionAdmitted()` and `e6RenditionPattern()` pass (`Booru_Enhancer.user.js` `applySiteThumbMedia`). So the page is logged-out e621/e926 `/posts`, the extension is still (`E6_RENDITION_EXT`), the card is the two-source WebP/JPEG layout, and it has a usable native sample. Any other card (`NATIVE_UNSUPPORTED`, `REFUSED_NATIVE_TOUCHED`, `NATIVE_OUT_OF_SCOPE`, no fact) returns null and keeps its existing path |
| `qualifiedUpgradeAllowed(...)` | The E-stage eligibility rule. The card must display its native preview (WebP or JPEG), and the target must be that card's native sample (which covers a native sample/file alias), distinct from what is displayed |
| `upgradeWhenReady` | First gate: for a qualified card, a target is refused (thumbnail kept) unless the rule allows it. Both upgrade triggers, the DOM-direct path and the metadata path, pass through it |
| `show(img)` | Existing invalidation, plus `clearTimeout(dwellTimer)`. A qualified card then gets **only** the timer. At 200 ms it checks the generation token and `BE.modules.viewer.isOpen()`, then runs `resolveHover`. Any other card runs `resolveHover` immediately, as before |
| `resolveHover(img, token)` | The previous body of `show()`, moved unchanged: overlay (`showImmediateThumbnail`), DOM-direct upgrade, metadata path. For a qualified card it runs at dwell, which is option B |
| `hide()` | `clearTimeout(dwellTimer)` before the existing invalidation |

**Behavior.**
- **Qualified still card:**
  - Pointer-enter starts nothing: no overlay, no upgrade, no metadata.
  - Leave, re-entry, a move to another card and a viewer opened before dwell all cancel it.
  - At 200 ms, a displayed PREVIEW shows its overlay and upgrades once, to its native sample or sample/file alias.
  - A displayed SAMPLE or FILE shows the overlay only; nothing is reloaded or downgraded.
- **Out of scope, unchanged** (previous hover path, byte-identical timeline to `bbaf9ac` in the tests): still cards that fail the IB08 pattern (for example, no usable sample), video (IB10), GIF, logged-in pages, other e621/e926 routes and other hosts.
- **Original targets:** no Original-target class is qualified by the E evidence, so such targets keep thumbnail/View. This is **not** a universal original ban. A separately validated cheap-original class can be added later through its own eligibility.

**Not added:** no new module, scheduler, media policy, canvas path or abstraction. No setting, no storage, and no change to the viewer, the gallery or IB08 rendition code.

## 2. Local tests

| Suite | Result |
| --- | --- |
| **P-stage production assertions** (`tests/host/ib09/p_stage_assertions.cjs`, the real production source, unpatched) | **111/111** on `22e843c`, including 11 production fault controls. Result file: `p-stage-result.json` |
| IB09 E-stage suites (baseline 32/32, prototype 84/84, V3 alternatives 54/54) | Unchanged results. They now pin their source to the E-stage blob `bbaf9ac` (`hover_harness.cjs` `eStageSource`), so their evidence keeps describing what it measured |
| IB09 E-stage live package verifier | 57/57; still pinned to `91fa86d`; `DERIVED_SCRIPT_UP_TO_DATE` |
| **P conformance package verifier** (`tests/browser/ib09/verify_ib09_conformance.cjs`) | **30/30**, including 5 fault controls |
| IB08 on `22e843c` | rendition L1–L9 66/66; lifecycle 24/24; D10 indicators 12/12; presentation 14/14; conformance package verifier 90/90. The historical IB08 result files are left unedited |
| IB01, IB02, IB03, IB05, IB06 | exit 0 |
| IB07 host suites | exclusion and Gelbooru exit 0. `item9_assertions` and `pagecount_assertions` exit 1 only because they pin the IB07 blob by design (`mismatchesAgainstExpected: []`, `failed: []`) |

**What the P-stage assertions prove on production** (e621 and e926 independently; Preview, Sample and Original):
- **Boundary sweep:** stays of 0/40/100/199 start nothing (no overlay, no upgrade, no metadata). Stays of 200/201/250 start the overlay and one upgrade at exactly 200.
- **Q1–Q10:**
  - sustained hover;
  - leave at 199;
  - re-entry (resets the dwell to 300);
  - A→B before dwell (B at 230);
  - A's dwell fired, then a move to B (A cancelled at 250, B at 450);
  - stale completion after leave, and during the next generation's dwell (nothing installed);
  - viewer opened at 50 (no hover overlay, upgrade or metadata).
- **SAMPLE and FILE cards:** no upgrade, metadata only at 200. FILE is never downgraded.
- **Alias:** with Preview, one SAMPLE|FILE upgrade at 200; with Original, none.
- **Out of scope** (no usable sample / pattern not met, video, GIF, logged-in page): the hover timeline is identical to `bbaf9ac` for a 40 ms sweep, a 250 ms stay and a sustained hover. Controls confirm the video fixture really starts a video, and the no-sample card really keeps its immediate path.

**Fault controls (all caught):**
- dwell removed;
- option A overlay restored at pointer-enter;
- leave fails to cancel;
- viewer check removed;
- eligibility removed (FILE → SAMPLE);
- SAMPLE reloading SAMPLE;
- stale install guards removed;
- dwell 199 ms;
- dwell scope broadened beyond the qualified class (caught separately for no-sample, video and GIF cards).

## 3. Live production conformance (prepared; operator run pending)

- **Package:** `tests/browser/ib09/IB09_Production_Conformance.user.js`, built by `build_ib09_conformance.cjs` from commit `b9d133c`, unpatched, with the 8 observe-only hooks (the E-stage set, with the dwell hook in production's dwell callback).
- **Observer:** the E-stage observer 1.3 with its labels renamed to IB09P. Each generation is tagged with the qualified class (the card's IB08 rendition fact, read only).
  - A `qualifiedClass` report covers only those generations: `newMediaBeforeDwell`, `overlayBeforeDwell`, `overlayOffsetMs`, `hoverFetchesBeforeDwell` (UPGRADE + REUSE Resource Timing entries before dwell) and `quickPassesStartingAnything`.
  - Out-of-scope generations keep their previous path and are only counted (`outOfScopeGenerations`).
- **Pinning:** C00 in-page body hash; `SHA256SUMS` in `IB09_CONFORMANCE_SHA256SUMS.txt`.
- **Sessions (smallest set):** e621 and e926, each with **P1 Preview** and **P2 Original**, ordinary, normal Chrome, logged out.
  - P1 confirms the qualified upgrade path and zero pre-dwell work.
  - P2 is the case that reopened V3 (reuse of the displayed file). It confirms that option B removes the pre-dwell fetches, and that there is no downgrade.
  - No throttled session is needed: the upgrade timing is unchanged from the accepted E-stage sessions.
- **Pass criteria and steps:** `tests/browser/ib09/README.md`, "IB09 production conformance (P stage)".

## 4. Completion

All four live conformance sessions passed. See `IB09_COMPLETION_RECORD.md`.
