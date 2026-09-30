# IB09 — Hover baseline characterization (E stage)

**Checkpoint:** IB09 — Still-image hover dwell and cost (blueprint §3 IB09; gate row G-HOVER, §5).

**Status:** IB09 PARTIAL — NOT COMPLETE. **G-HOVER is OPEN.** This record characterizes current production only. No dwell is chosen, production is not changed, and nothing here is a gate result or completion claim.

**Production under test:** `Booru_Enhancer.user.js` blob `bbaf9ac63f5c0292018b974f00c7b30d8b478bb5` (commit `91fa86d`).

**Scope:**
- e621.net and e926.net, logged out, native `/posts`, IB08-qualified two-source WebP/JPEG still-image cards;
- each grid quality: `preview`, `sample`, `original`;
- local jsdom with synthetic fixtures only; no live run;
- animated/video classes, other hosts and viewer hardening are out of scope.

## Harness

`tests/host/ib09/hover_harness.cjs` is reusable for later IB09 implementation tests. It loads the real production in jsdom through the IB07 harness and adds:

- **A fake clock.** `setTimeout`, `setInterval` and `requestAnimationFrame` are replaced before production evaluates, and time moves only through `advance(ms)`. Every time below is ms since the first pointer-enter.
- **An image-source recorder.** Every `HTMLImageElement` `src` assignment records:
  - the time;
  - the hover generation (the number of `hover.show` calls);
  - the initiating production function, taken from the call stack;
  - whether the element was attached;
  - its **native-slot class** against the hovered card's native facts: PREVIEW (`data-preview-url` or `data-preview-webp`), SAMPLE, FILE, UNKNOWN, or CANCEL for the `data:,` abort sentinel.

  URLs never leave the recorder.
- **Controllable completion.** Upgrade images stay pending (`complete === false`) until the test fires `load` or `error`.
- **Install tracking.** Every node added to `#be-hover-preview` is recorded with the generation its source was assigned in, which detects stale installs.
- **Metadata counters:** adapter `fetchPost`, gallery `enrichSinglePost` and `getCachedPost`.
- **Network counters:** all IB07 harness transports.

`tests/host/ib09/hover_baseline.cjs` runs the scenarios for both hosts and all three qualities, checks the characterization, and runs the fault controls. Result: `tests/host/ib09/hover-baseline-result.json`.

## Current production hover path

| Step | Location | Behavior |
| --- | --- | --- |
| Listener registration | `Booru_Enhancer.user.js:3832-3833` | `pointerover` / `pointerout` delegated on the gallery container (gallery-owned) |
| Enter | `:4228-4240` `onGalleryHover` | First entry per card (`data-be-hovering` guard) → `BE.modules.hover.show(img)` |
| Leave | `:4242-4252` `onGalleryHoverEnd` | Pointer fully left the card → `BE.modules.hover.hide()` |
| Show | `:3168-3215` `show` | `token = ++requestToken`; then synchronously: |
| 1. Immediate thumbnail | `:3029-3038` `showImmediateThumbnail` | `new Image().src =` the card's **currentSrc**, installed into the overlay at once (`installMedia`, `:3013`) |
| 2. DOM-direct upgrade | `:3040-3071` `directUpgradeFromDom` → `:3083` `upgradeWhenReady` | e621 adapter: picks **`sampleUrl \|\| originalUrl \|\| previewUrl`** from the card's data attributes (slot-name order). If that differs from the displayed thumbnail, `new Image().src =` it at once (`:3147-3165`); it installs on `load` |
| 3. Metadata path | `:3192-3209` | `getCachedPost` (cache filled at startup by native enrichment, `:5381`), else `enrichSinglePost` (`:4254`) → adapter `fetchPost` (native DOM on e621/e926). Then `mediaFromPost` (`:3073`) → `upgradeWhenReady` again (a no-op if the same URL is active) |
| Hide | `:3217-3228` `hide` | `requestToken++`; `activeUpgradeUrl = ''`; `cancelPendingUpgrade` (`:2982`: pending image `src = 'data:,'`); overlay hidden and emptied |
| Guards | `:3014` `installMedia`; `:3154`, `:3156` load handler | Each checks `token === requestToken`; the load handler also checks `activeUpgradeUrl` |

## Measured timelines

**The results are identical on e621 and e926 in every scenario.** Notation: `t gen path:slot`. Installs are listed as `t g<assigned>/<current>`. Metadata was `getCachedPost` at each entry, a cache hit. There was **no network request in any scenario.**

| Scenario | preview | sample | original |
| --- | --- | --- | --- |
| **S1** enter + sustained hover (upgrade load completed at 300) | 0 g1 thumb:PREVIEW; 0 g1 upgrade:SAMPLE · installs 0, 300 | 0 g1 thumb:SAMPLE · install 0 | 0 g1 thumb:FILE; 0 g1 upgrade:SAMPLE · installs 0, 300 (SAMPLE replaces FILE) |
| **S2** 40 ms sweep | 0 thumb:PREVIEW; 0 upgrade:SAMPLE; 40 cancel | 0 thumb:SAMPLE | 0 thumb:FILE; 0 upgrade:SAMPLE; 40 cancel |
| **S3** leave at 150 | as S2, cancel at 150 | 0 thumb:SAMPLE | as S2, cancel at 150 |
| **S4** leave 50, re-enter 100 | 0 g1 thumb + upgrade; 50 cancel; 100 g2 thumb:PREVIEW + upgrade:SAMPLE | 0 g1 thumb; 100 g2 thumb | as preview, with FILE thumbs |
| **S5** card A → card B at 30 | 0 g1 A thumb + upgrade; 30 cancel A; 30 g2 B thumb:PREVIEW + upgrade:SAMPLE | 0 g1, 30 g2 thumbs | as preview, with FILE thumbs |
| **S6** leave 50, gen-1 load completes at 100 | stale load installs **nothing**; overlay stays hidden | no pending load | stale load installs nothing |
| **S7** leave and re-enter at 30; gen-1 load at 80, gen-2 load at 120 | gen-1 load installs **nothing** (overlay still gen 2); gen-2 installs at 120 | no pending load | same as preview |
| **S8** click at 50 (viewer) | viewer `replaceMedia` assigns **FILE** at 50; the hover overlay stays visible and the gen-1 SAMPLE upgrade stays pending (hover is hidden only by pointer leave) | viewer FILE at 50 | viewer FILE at 50 |

## Findings

**Requests:**
- **Network:** zero requests in all scenarios on both hosts.
- **Metadata:** resolved at pointer-enter by `getCachedPost` (t=0, and at each re-entry). It is a cache hit, because startup native enrichment (`:5381`, `fetchThumbBatch`) pre-fills the cache.
- **Cache-miss path:** not exercised. It would call `enrichSinglePost` → `fetchPost`, which is native DOM on e621/e926 with no network.

**Media source assignments (all before any dwell):**
- **Every quality:** at t=0 (synchronous with pointer-enter) the hover overlay gets a new image assigned the card's `currentSrc`, and it is installed and shown at t=0. That URL is already displayed on the card, so it is likely a browser-cache hit, but it is a hover media swap before any dwell.
- **`preview`:** at t=0 an upgrade image is assigned the card's **SAMPLE**. In a browser this starts a network fetch at pointer-enter. A 40 ms sweep starts that fetch and only cancels it at leave (`src = 'data:,'`), after the request is already in flight.
- **`original`:** at t=0 an "upgrade" image is assigned **SAMPLE** while the card already shows **FILE**. When it loads, SAMPLE replaces FILE in the overlay: extra cost for a weaker image. The choice comes from slot-name order (`sampleUrl || originalUrl`, `:3065`), not from measured cost or provenance.
- **`sample`:** no upgrade assignment, because the upgrade URL equals the displayed rendition.
- **Two upgrade triggers:** the DOM-direct upgrade and the metadata path both call `upgradeWhenReady` synchronously at t=0. Delaying only one of them does not delay the cost; a fault control shows this.

**Stale-generation behavior (no hazard found):**
- Leave invalidates the generation (`requestToken++`, `:3218`), clears `activeUpgradeUrl` (`:3219`) and cancels the pending image (`:3221`).
- A generation-1 load completing after leave (S6), or during generation 2 (S7), installs nothing. The overlay keeps the newest generation.
- This is protected by **three independent guards**: the token check in `installMedia` (`:3014`), and the token and `activeUpgradeUrl` checks in the load handler (`:3154`, `:3156`). Removing any single one does not produce a stale install; the fault controls must remove the whole chain.
- **Cleanup after leave:** the overlay is hidden and emptied, and the pending image is aborted.

**Viewer interaction (S8; recorded only, no viewer hardening):** clicking a hovered card opens the viewer, which assigns FILE at click time. The click does not hide the hover or cancel its pending SAMPLE upgrade; in a real browser a pointer-leave caused by the overlay would. The two loads can overlap.

## Invariant comparison (IB09 item 2: "No new hover metadata request or upgraded media source assignment precedes dwell")

| # | Current behavior | Conflicts with the IB09 invariant? |
| --- | --- | --- |
| V1 | `preview`: SAMPLE upgrade source assigned at t=0 (network cost at pointer-enter, also in a 40 ms sweep) | **Yes**: an upgraded media source is assigned before dwell |
| V2 | `original`: SAMPLE "upgrade" assigned at t=0 over a displayed FILE (extra cost, weaker image) | **Yes**: before dwell, and eligibility by slot name rather than measured cost or provenance (item 2) |
| V3 | All qualities: hover overlay shown at t=0 with the card's current rendition (same URL, likely cached) | **Needs a decision.** It is not an *upgraded* source, but it is a hover media swap at pointer-enter. The item 8 "native label when disabled / thumbnail" and a placeholder policy decide whether it may stay |
| V4 | Metadata resolution (`getCachedPost`, or on a miss `enrichSinglePost`/`fetchPost`) at t=0 | Not a *request* on e621/e926 (a native cache or DOM read, zero network). The same code path would issue a request on hosts with network `fetchPost`, which is outside this scope |
| V5 | A 40 ms sweep: on `preview`/`original` it starts a SAMPLE fetch; on every quality it shows the overlay | **Yes** for the fetch; V3 for the overlay |
| — | Stale generations | No violation: three guards; stale results cannot apply |

## Local verification

`node tests/host/ib09/hover_baseline.cjs`: **32/32**.
- **Classifier self-test:** PREVIEW (both preview attributes), SAMPLE, FILE, UNKNOWN, CANCEL, and the file==sample alias `SAMPLE|FILE`.
- **24 characterization checks,** 12 per host, covering S1–S8 and all three qualities.
- **7 fault and negative controls:**

| Control | Outcome |
| --- | --- |
| Immediate request on pointer-enter | caught (network count) |
| Immediate FILE source swap where the baseline has none (sample quality) | caught |
| Stale result applying after leave, with every leave-side guard removed | caught (install while hidden) |
| Stale generation-1 result applying during generation 2, with the load and install guards removed | caught |
| Cost moved to t=20, inside a 40 ms sweep, with both upgrade triggers delayed | caught at t=20 |
| Incorrect native-slot classification (SAMPLE/FILE mapping swapped in the harness) | caught by the classifier self-test |
| **Negative control:** a dwell-gated build (all hover work after 300 ms) | zero assignments in a 40 ms sweep, and assignment at 300 on sustained hover; the detectors are not vacuous |

## Limits

- jsdom has no image loading or real network. Load and error completion is driven by the test, and `currentSrc` is modelled (the first `<source>` with a srcset before the `<img>`, else `src`).
- Real browser cost (bytes, cache hits, whether `data:,` aborts an in-flight fetch) is **not** measured here. That belongs to the V2 pilot.
- The fixtures are synthetic. The live card pattern is the IB08-qualified one.
