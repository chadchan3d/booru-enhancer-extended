# IB09 — V2 live evidence, frozen cost decisions and the isolated dwell prototype (E stage)

**Checkpoint:** IB09 — Still-image hover dwell and cost. **G-HOVER is OPEN.** Production `Booru_Enhancer.user.js` blob `bbaf9ac` is **unchanged**. The dwell prototype exists only as a test-time patch. Nothing here is a gate PASS or a completion claim.

## 1. V2 live evidence (operator-relayed)

- **Probe:** `tests/browser/ib09/IB09_V2_Hover_Cost_Probe.user.js` (commit `533c1c7`), run on e621.net and e926.net separately, logged out, native `/posts`, normal enhancer disabled. The runs were accepted by the operator.
- **Qualification:** the runs used a **regular Chrome profile, not an empty Incognito profile**. Prior browser and disk cache state is unknown, so general cold-cache and abort-cost conclusions stay **limited**.
- **Relayed results used here:**

| Arm | e621.net | e926.net |
| --- | --- | --- |
| PREVIEW reuse of the displayed rendition | 4/4 `NO_ENTRY`, 0 ms | 4/4 `NO_ENTRY`, 0 ms |
| SAMPLE reuse after load | 4/4 `NO_ENTRY`, 0 ms | 4/4 `NO_ENTRY`, 0 ms |
| FILE reuse after load | 4/4 `NO_ENTRY`, 0 ms | 4/4 `NO_ENTRY`, 0 ms |
| Abort (40 ms `data:,`) | **inconclusive** (regular profile) | **inconclusive** |

`NO_ENTRY` means the browser loaded the image with no Resource Timing fetch. It is not a claim that these resources are free in every state.

## 2. Frozen decisions (operator)

**V3, the immediate overlay: ACCEPTED.** At pointer-enter, the hover overlay may appear using **only the card's already-displayed rendition**. This is permitted before dwell because it introduces no upgraded media source, and the V2 sample observed no additional fetch. It is not generalized to "free".

**Pre-dwell cost allowance: zero new hover media loads.** Before dwell expires there is:
- no SAMPLE upgrade load;
- no FILE upgrade load;
- no hover-triggered metadata network request;
- no other new hover media source.

Cancellation does not make an early load acceptable; the abort evidence is inconclusive.

**Upgrade ordering.** The slot-name order `sampleUrl || originalUrl || previewUrl` (`Booru_Enhancer.user.js:3065`) is **rejected**. An upgrade never reduces the displayed rendition. On IB08-qualified cards:

| Displayed rendition | Hover upgrade after dwell |
| --- | --- |
| PREVIEW | SAMPLE (eligible) |
| SAMPLE | none |
| FILE | none; FILE is never replaced by SAMPLE |

Eligibility follows the actual displayed/native rendition relationship.

**E-stage dwell candidate: 200 ms.** This is a test candidate, not a production constant.

## 3. Isolated dwell design

**Artifact:** `tests/host/ib09/dwell_prototype.cjs`, `applyDwellPrototype(source, { dwellMs })`. It is a text patch applied to the **real production source inside the test harness**, anchored and failing loudly if an anchor does not match exactly once. `Booru_Enhancer.user.js` is not modified.

| Element | Prototype |
| --- | --- |
| Pointer-enter (`show`) | New generation token; cancel any pending upgrade and dwell timer. `showImmediateThumbnail` shows the displayed rendition (V3). Then **one** timer: `dwellTimer = setTimeout(afterDwell, HOVER_DWELL_MS)`. Nothing else runs at enter |
| Single dwell authority (`afterDwell`) | Both upgrade triggers, the DOM-direct upgrade and the metadata path (cache, `enrichSinglePost`, `fetchPost`), run only here. The call stops if the generation changed, or if the viewer is open (`BE.modules.viewer.isOpen()`) |
| Eligibility (`hoverUpgradeEligible`, the first gate in `upgradeWhenReady`) | e621/e926 pattern card: allowed only if the displayed `currentSrc` is the card's native preview (WebP or JPEG) **and** the target is that card's native sample, distinct from what is displayed. Everything else is refused. Both triggers pass through it. Video and other hosts keep their current resolution behind the same dwell (IB10 and other hosts are out of scope) |
| Leave (`hide`) | `clearTimeout(dwellTimer)`, then the existing invalidation: token bump, `activeUpgradeUrl` reset, pending-image cancel, and hiding and emptying the overlay |
| Stale protection | The existing three guards are unchanged; the generation token also guards `afterDwell` |

## 4. Fake-clock timelines (`tests/host/ib09/dwell_prototype_assertions.cjs`)

The results are identical on e621 and e926. Times are ms since the first pointer-enter. `thumb` means the displayed rendition; `g` is the hover generation.

| Scenario | preview | sample | original |
| --- | --- | --- | --- |
| Q1 sustained (load completes at 300) | 0 thumb:PREVIEW; **200 upgrade:SAMPLE**; installs 0, 300; metadata 200 | 0 thumb:SAMPLE; no upgrade; metadata 200 | 0 thumb:FILE; no upgrade; metadata 200 |
| Q2 leave at 199 | 0 thumb; **no upgrade, no metadata** | 0 thumb | 0 thumb |
| Q5 leave 50, re-enter 100 | 0 g1 thumb; 100 g2 thumb; **300 g2 upgrade** (none at 200) | thumbs only | thumbs only |
| Q6 A→B at 30 | A: thumb only; B: 30 thumb, **230 upgrade** | thumbs only | thumbs only |
| Q7 A dwell, then B at 250 | A: 200 upgrade, 250 cancel; B: 250 thumb, **450 upgrade** | thumbs only | thumbs only |
| Q8 leave 250, stale load at 300 | upgrade at 200, cancel at 250; stale completion **installs nothing**, overlay hidden | — | — |
| Q9 re-enter at 250; g1 load at 300, g2 at 500 | g1 upgrade 200, cancel 250; g2 450; g1 completion **installs nothing**; g2 installs at 500 | — | — |
| Q10 viewer opened at 50 | **no hover upgrade, no hover metadata**; viewer's own FILE load at 50 (viewer path) | same | same |

**Network requests:** zero in every scenario.

**Boundary sweep** (stay T ms, then leave; preview), both hosts:

| Stay (ms) | 0 | 40 | 100 | 199 | 200 | 201 | 250 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First upgrade | none | none | none | none | at 200 | at 200 | at 200 |

The dwell constant is the only authority: 100 ms and 300 ms variants start exactly at their own boundary, never at boundary − 1.

**Observations:**
- **Viewer:** a viewer opened before dwell does not hide the overlay; it stays until pointer-out. The upgrade is suppressed. Overlay hiding on viewer takeover is IB11 and is not changed here.
- **Metadata:** on SAMPLE/FILE-displayed cards, the metadata path still runs at dwell (a cache read, no network), although eligibility then refuses any upgrade. A production version may skip it; this is recorded, not changed.

## 5. Verification

`node tests/host/ib09/dwell_prototype_assertions.cjs`: **84/84**.
- **Invariant checks** for every scenario × quality × host (48): no upgrade or metadata before 200 ms after its generation's enter; only the displayed rendition at enter; ordering; no stale install; no network.
- **Scenario checks:** 8 per host for preview, and one ordering check per host for each of sample and original.
- **Sweeps:** the boundary sweep and the 100/300 ms variant checks on both hosts.
- **Fault controls, 10/10 caught:**
  - upgrade at pointer-enter;
  - only one trigger delayed (metadata path at enter);
  - upgrade at 199 ms;
  - FILE downgraded to SAMPLE;
  - SAMPLE reloads SAMPLE;
  - leave not cancelling the dwell;
  - stale dwell generation firing after re-entry;
  - stale image completion installing;
  - fast A→B starting A's upgrade;
  - a viewer takeover leaving the delayed upgrade armed.

Existing suites are unaffected: production is unchanged, and the hover baseline stays 32/32.

## 6. Is 200 ms clean enough to propose for production?

**On lifecycle correctness: yes.**
- The boundary is deterministic: nothing costly starts before 200 ms, and one eligible upgrade starts at 200 ms.
- Leave, re-entry and card-to-card movement never start a stale or early upgrade.
- Both triggers share one authority.
- Ordering never downgrades.
- A viewer takeover suppresses the upgrade.

**Not established, and required before a production proposal is final** (blueprint IB09 items 9–10):
- held-out **live** observations of usefulness and transfer at 200 ms, both throttled and unthrottled;
- a clean-profile cost baseline, since the V2 runs used a regular profile.

The 200 ms constant is therefore proposed only as the candidate for that live check, not yet for production.
