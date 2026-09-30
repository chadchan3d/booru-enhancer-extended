# IB09 — E-stage closeout assessment (decisions frozen; gate held)

**Checkpoint:** IB09 — Still-image hover dwell and cost (blueprint §3 IB09, items 9–10; §5 G-HOVER row).
**Result: PARTIAL — NOT COMPLETE. G-HOVER stays OPEN.** Production `Booru_Enhancer.user.js` blob `bbaf9ac` is unchanged. No P-stage work has started. IB10 has not started.

## 1. Frozen E-stage decisions (operator)

| Decision | Frozen value | Evidence |
| --- | --- | --- |
| V3 overlay | **B, dwell-gated overlay.** The displayed rendition is shown at dwell, behind the generation and viewer checks. Nothing is assigned at pointer-enter | `IB09_V3_REOPEN.md` §3–4; `tests/host/ib09/v3_alternatives_assertions.cjs` 54/54 |
| Dwell | **200 ms** | Fake-clock boundary sweep 0/40/100/199 → none, 200/201/250 → one at 200 (`dwell_prototype_assertions.cjs:116-117`, 84/84); unthrottled held-out live e621 A, e926 C, e926 D (§2) |
| Before dwell | No new hover metadata request and no upgraded or other hover media assignment | Prototype `afterDwell` is the single authority (`tests/host/ib09/dwell_prototype.cjs:51-104`); variant B also removes the enter-time overlay assignment |
| Still-image selection | Cheapest sufficient validated rendition; a current target is never downgraded. On IB08-qualified e621/e926 cards: displayed PREVIEW → native SAMPLE after dwell; displayed SAMPLE or FILE → no upgrade. A SAMPLE\|FILE native alias is acceptable | `hoverUpgradeEligible` (`dwell_prototype.cjs:32-40`); live e621 A: 38 SAMPLE + 5 alias, 0 pure FILE; e926 D: `fileDowngradedToSample` 0 |
| Unsupported or cost-inconclusive cases | Retain thumbnail/View | Blueprint IB09 item 11 |
| Video | IB10 | Blueprint IB09 item 3 |

## 2. Evidence against blueprint IB09 item 9

| Required evidence | Status | Source |
| --- | --- | --- |
| Fake-clock dwell and 40 ms sweeps | **Met** | `dwell_prototype_assertions.cjs` Q3/Q4 (84/84); variant B sweep 0 assignments (`v3_alternatives_assertions.cjs`, 54/54) |
| No pre-dwell network or source assignment | **Met** locally; **met live** for upgrades (`hoverLoadsBeforeDwell` 0, `newMediaBeforeDwell` 0 in all three sessions). The V3 reuse fetches (e926 D 38/80) are removed by B by construction | `IB09_V3_REOPEN.md` §1–2 |
| Leave / re-entry / viewer joins | **Met** | Q5, Q8–Q10 (`dwell_prototype_assertions.cjs:102-107`); B viewer-before-dwell shows no overlay; live `staleInstalled` 0 in all three sessions |
| Wrong-slot bytes and aliases | **Met** for the qualified class | Eligibility is the displayed/native relationship, not slot names; live SAMPLE\|FILE alias 5, pure FILE 0; video FILE targets were separated out (observer 1.2) |
| Known cheap original / sample / unknown / animated classes | **Met by exclusion.** Only PREVIEW→native SAMPLE is admitted. Originals, unknown and animated classes get no automatic upgrade (thumbnail/View) | `hoverUpgradeEligible`; e926 C/D: 0 upgrades on SAMPLE/FILE cards |
| Stale-generation protection | **Met** | Q8/Q9 plus fault controls (`dwell_prototype_assertions.cjs:134-136`); live `staleInstalled` 0 |
| V2 pilot, unthrottled | **Met** (regular profile; cache-limited) | `IB09_DWELL_PROTOTYPE.md` §1 |
| V2 pilot / held-out, **throttled** | **NOT MET: never run** | Package session B (Preview, Slow 4G + Disable cache) is marked *required* on e621 (`IB09_LIVE_CHECK.md:115`). No throttled result was ever relayed |
| Held-out usefulness / transfer observations | **Partly met.** Unthrottled held-out timing on e621 A (upgrade at 200–220 ms; indicative only, since up to 3 of 46 were video). The worst-case usefulness and a cold SAMPLE transfer observation depend on the throttled session | `IB09_LIVE_CHECK.md` §6 (start offsets 200/200/220 ms, `:155`); e621 A caveat |

**Operator scope decision recorded:** e926 D was designated the final required *correctness* session. The package's other per-host correctness rows (e621 C, e621 D, e926 A) are waived on that basis. The eligibility code is host-shared and the fake-clock results are identical on both hosts. This waiver does not cover the throttled row: that row is a blueprint item 9 requirement (throttled *and* unthrottled), not a package convenience.

## 3. Gate decision

**G-HOVER: OPEN** (not PASS). Every correctness requirement is met for the e621/e926 still-image class. Item 9's throttled pilot / held-out observation is absent. Item 10 also requires that the chosen policy "fits frozen allowance on held-out cases", including usefulness under the throttled condition the operator required. Marking PASS without it would promote a missing evidence class.

**Scope the gate will take when the blocker clears, recorded now so it doesn't drift:**
- **Class:** e621.net and e926.net independently; logged out; native `/posts` listing; the IB08-qualified two-source WebP/JPEG still-image card.
- **Admitted behavior:** after 200 ms dwell, the displayed rendition is shown (overlay B). A displayed PREVIEW then upgrades to that card's native SAMPLE (or native SAMPLE\|FILE alias).
- **Excluded (thumbnail/View):** SAMPLE or FILE upgrades, originals, unknown classes, animated images, video (IB10), logged-in contexts, post pages, the viewer (IB11), other hosts.

## 4. The one remaining E-stage blocker

**The e621 B throttled held-out session:** Preview quality, DevTools Network "Slow 4G" with "Disable cache", DevTools open, one bounded session (80 generations), using the existing live package 1.3 (`tests/browser/ib09/IB09_Dwell_Live_Check.user.js`, unchanged, instructions in `tests/browser/ib09/README.md`).

- **Why package 1.3 is still valid:** the throttled session measures post-dwell upgrade usefulness and cold SAMPLE transfer. Upgrade timing is identical under overlays A and B.
- **Known difference:** under 1.3 the displayed preview is re-assigned at enter, not at dwell. Observer 1.3 attributes it separately as REUSE and does not count it against `hoverLoadsBeforeDwell`. It does not affect the upgrade measurement.
- **e926 B** remains optional (`IB09_LIVE_CHECK.md:117`). If it is skipped, the record states that throttled usefulness was observed on e621 only.
