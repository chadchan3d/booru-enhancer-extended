# IB09 — V3 reopened: immediate current-rendition overlay (E stage)

**Checkpoint:** IB09 — Still-image hover dwell and cost. **G-HOVER is OPEN.** Production (`bbaf9ac`) is unchanged. The 200 ms upgrade gating and the no-downgrade rule are **not** reopened.

## 1. The session that reopened V3: e926 D (original, ordinary; package 1.3)

**Operator-relayed result:**
- identity matched;
- 80 generations: 54 quick passes, 26 reached dwell;
- `newMediaBeforeDwell` 0, `hoverLoadsBeforeDwell` 0, `quickPassesStartingUpgrade` 0;
- no eligible still-image PREVIEW upgrade;
- `upgradesOnSampleOrFileCards` 0, `fileDowngradedToSample` 0, `staleInstalled` 0.

This session **qualifies the 200 ms dwell and no-downgrade behavior** on e926 with the Original quality.

**But** `renditionReuseFetchesBeforeDwell` = **38**, with `cardDisplayLoadsDuringHover` 0, `unattributedCardMediaLoadsDuringHover` 0 and `cardImageLoadingAtEnter` 0.

## 2. Interpretation

1. **What causes the event.** A REUSE event is counted when observer 1.3 finds a Resource Timing entry that meets all four conditions:
   - its URL is exactly the URL the V3 overlay assigned at pointer-enter (`showImmediateThumbnail` → `new Image().src = currentSrc`, `Booru_Enhancer.user.js:3029-3038`, unchanged in the prototype);
   - it started at or after that assignment;
   - it started before the dwell boundary;
   - the card's own image was already loaded at pointer-enter.

   With Original, IB08 makes the card display its FILE, so the reused URL is the FILE.
2. **Does it prove a new request after pointer-enter?** It establishes that the browser created a new Resource Timing entry, meaning the load went through its fetch path rather than being satisfied from the in-memory image list (`NO_ENTRY`). Three facts rule out the grid itself as the cause:
   - the entry is URL-matched and time-ordered after the assignment;
   - the card image was already loaded;
   - `cardDisplayLoadsDuringHover` and `unattributedCardMediaLoadsDuringHover` were both 0.

   So the V3 assignment initiated these requests, on 38 of 80 generations.
3. **Transferred bytes: not established.** Observer 1.3 does not record `transferSize` for REUSE entries, and cross-origin sizes may be hidden in any case. Each entry may be any of:
   - an HTTP disk-cache hit (0 bytes);
   - a revalidation (headers only);
   - a full transfer.

   The events prove request initiation, not network bytes.
4. **Why V2 reuse was `NO_ENTRY`.** The V2 probe reused each URL *immediately after its own completed load* of 4 cards, so the in-memory image cache was fresh. e926 D displays full originals across the whole grid. The most likely explanation is memory-cache pressure: large decoded FILE resources are evicted, so a later reuse misses the in-memory cache and falls back to a fetch. This is **not proven**; it is consistent with the data (0 grid, lazy or unattributed loads).
5. **Does Original make V3 more expensive?** Plausibly yes, for the reason above: FILE resources are the largest, and they are what the Original grid displays. Preview and Sample reuse has **not** been measured with 1.3 attribution, so no rate can be claimed for them.
6. **Cross-session V3 evidence** (only where the package version makes it trustworthy):

   | Evidence | Package | Hosts / quality | V3 reuse finding |
   | --- | --- | --- | --- |
   | V2 pilot | V2 probe | e621, e926; reuse right after its own load | PREVIEW, SAMPLE, FILE: 4/4 `NO_ENTRY` each (regular Chrome) |
   | e621 A | 1.1 | e621 preview | not measured (no REUSE attribution) |
   | e926 C | 1.2 | e926 sample | 6 unattributed card-media entries; REUSE cannot be separated (no causal attribution) |
   | **e926 D** | **1.3** | **e926 original** | **38 of 80 generations initiated a fetch on reuse** (bytes unknown) |

7. **Can immediate V3 reuse still be defended?** Not as recorded. The V3 exception was granted on the premise that reuse "introduces … no additional Resource Timing fetch". e926 D contradicts that premise for Original. Under the IB09 cost objective (zero new hover media loads before dwell), a reuse that initiates a request on nearly half of hovers, **including 40 ms sweeps**, is not acceptable without evidence that it transfers nothing. That evidence doesn't exist.

## 3. Alternatives (local E-stage comparison; production unchanged)

`tests/host/ib09/dwell_prototype.cjs` gains `overlay: 'immediate' | 'dwell' | 'canvas'`. The default output is unchanged, so the qualified prototype and the live package pin are untouched.

`tests/host/ib09/v3_alternatives_assertions.cjs`: **54/54**, on e621 and e926 × preview and original.

| Criterion | A: current V3 | B: dwell-gated overlay | C: canvas paint |
| --- | --- | --- | --- |
| Hover resource assignments in a 40 ms sweep | **1** (the displayed URL) | **0** | **0** |
| Overlay first visible | 0 ms | 200 ms (after the latest enter) | 0 ms |
| Native node | unchanged | unchanged | unchanged; only read (drawImage source is the card node) |
| Upgrade gating / stale safety | unchanged, pass | unchanged, pass | unchanged, pass |
| Viewer opened before dwell | t=0 overlay stays until pointer-out | **no hover overlay at all** | t=0 canvas stays |
| Implementation | none | one call moved into `afterDwell` | new painting path: canvas sizing and DPR, `drawImage` of possibly very large decoded FILE images, fallback when not decoded |
| Live risk not measurable locally | fetch rate (e926 D: 38/80) | none for cost (zero by construction) | visual fidelity, paint cost and memory for large originals in a real browser; cross-origin canvases are tainted (display is fine) |

**Fault controls, 5/5 caught:**
- B with the overlay still at enter;
- C falling back to an `Image` assignment;
- C cloning the card node (a clone can load its `src`);
- C mutating the native node;
- B showing a stale dwell of the previous card.

C also does nothing when the card image isn't decoded yet: no paint, no request, no overlay in the sweep.

## 4. Recommendation: **B (dwell-gated overlay)**

**Narrowest rationale:**
- It is the only option that meets the frozen cost objective (zero hover-caused requests before dwell) **by construction**, whatever the cache state.
- It is a one-call change inside the already-qualified prototype, and it keeps every existing guard.
- It also removes the stale t=0 overlay when the viewer takes over before dwell.

**The cost:** the overlay appears at 200 ms instead of at pointer-enter. That is the dwell interval the operator already chose for upgrades.

**C is technically feasible and zero-fetch,** but it adds a painting path whose appearance, CPU and memory cost on large originals can only be judged live. It is not adopted merely because it keeps immediacy. It remains an option if the operator later values t=0 presentation enough to run that live check.

## 5. Is another live run necessary?

- **For the V3 decision: no.** B's pre-dwell cost is zero by construction and locally proven, so no live measurement can change that conclusion.
- **Still required later:** live production conformance of the implemented P-stage change, covering B's overlay timing and the upgrade behavior, as for IB08.
- **If C is chosen instead:** a live appearance and performance check would be required.
