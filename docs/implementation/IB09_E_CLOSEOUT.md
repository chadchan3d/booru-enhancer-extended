# IB09 — E-stage closeout (decisions frozen; G-HOVER PASS(scope))

**Checkpoint:** IB09 — Still-image hover dwell and cost (blueprint §3 IB09, items 9–10; §5 G-HOVER row).
**Result:** G-HOVER(e621/e926 qualified still-image class), E → **PASS(scope)**.
- **IB09 is PARTIAL — NOT COMPLETE:** the P stage and live production conformance remain.
- At E closeout, production was blob `bbaf9ac`. The P stage (commit `16f821e`, blob `3161b51`) is recorded in `IB09_P_STAGE.md`. IB10 has not started.

**Correction:** the first version of this record (commit `a423c33`) is superseded. It held the gate on a missing throttled session and described the other correctness sessions as waived. Both statements were wrong: the sessions below were run by the operator.

## 1. Frozen E-stage decisions (operator)

| Decision | Frozen value | Evidence |
| --- | --- | --- |
| V3 overlay | **B, dwell-gated overlay.** The displayed rendition is shown at dwell, behind the generation and viewer checks. Nothing is assigned at pointer-enter | `IB09_V3_REOPEN.md` §3–4; `tests/host/ib09/v3_alternatives_assertions.cjs` 54/54 |
| Dwell | **200 ms** | Fake-clock boundary sweep: stays of 0/40/100/199 give no upgrade; stays of 200/201/250 give one at 200 (`dwell_prototype_assertions.cjs:116-117`, 84/84). Held-out live sessions (§2) |
| Before dwell | No new hover metadata request, and no upgraded or other hover media assignment | `afterDwell` is the single authority (`tests/host/ib09/dwell_prototype.cjs:51-104`). Variant B also removes the enter-time overlay assignment |
| Still-image selection | Cheapest sufficient validated rendition; a current target is never downgraded. In the qualified e621/e926 still-image class, only displayed PREVIEW → native SAMPLE (or native SAMPLE\|FILE alias) has sufficient cost evidence for an automatic upgrade. A displayed SAMPLE or FILE needs no stronger replacement in this class. No separate Original-target class is qualified by this evidence. This is **not** a universal original ban (blueprint IB09 item 4); a separately validated cheap-original class remains possible | `hoverUpgradeEligible` (`dwell_prototype.cjs:32-40`) |
| Unsupported or cost-inconclusive | Retain thumbnail/View | Blueprint IB09 item 11 |
| Video | IB10 | Blueprint IB09 item 3 |

## 2. Held-out live sessions (operator-run, normal Chrome, logged out, native `/posts`)

All sessions ran the same executed body: production `bbaf9ac` + the 200 ms prototype (overlay A) + observe-only hooks. Package versions 1.1–1.3 differ only in the observer (`IB09_LIVE_CHECK.md` §5–7; `IB09_V3_REOPEN.md`).

| Host | Session | Quality / network | Observer | Record |
| --- | --- | --- | --- | --- |
| e621.net | A | Preview / ordinary | 1.1 | `IB09_LIVE_CHECK.md` §6. Accepted: 38 SAMPLE + 5 alias, 0 pure FILE; start 200–220 ms |
| e621.net | **B** | **Preview / THROTTLED** (DevTools Slow 4G, Disable cache) | 1.2 (by field vocabulary; see below) | This section, operator-relayed |
| e621.net | C | Sample / ordinary | — | Operator-accepted; relayed with the operator's session reports. The numeric rows are not in this agent's working record, so they are marked **UNVERIFIED here** until pasted in verbatim (no rerun) |
| e621.net | D | Original / ordinary | — | Operator-accepted; relayed with the operator's session reports. The numeric rows are not in this agent's working record, so they are marked **UNVERIFIED here** until pasted in verbatim (no rerun) |
| e926.net | A | Preview / ordinary | — | Operator-accepted; relayed with the operator's session reports. The numeric rows are not in this agent's working record, so they are marked **UNVERIFIED here** until pasted in verbatim (no rerun) |
| e926.net | B | Preview / throttled | — | Optional (`IB09_LIVE_CHECK.md:117`); **not run**. Throttled usefulness is observed on e621 only |
| e926.net | C | Sample / ordinary | 1.2 | `IB09_LIVE_CHECK.md` §7. Accepted: 80 STILL, 0 hover media before dwell, 0 upgrades, 0 stale |
| e926.net | D | Original / ordinary | 1.3 | `IB09_V3_REOPEN.md` §1. Accepted for correctness: 0 before dwell, 0 downgrade, 0 stale; reopened V3 (decided: B) |

**e621 B, operator-relayed result:**

| Field | Value |
| --- | --- |
| condition / quality | THROTTLED / preview |
| generations | 80 (43 quick passes under dwell, 37 reached dwell) |
| `newMediaBeforeDwell` | 0 |
| `resourceTimingLoadsBeforeDwell` | 0 |
| `quickPassesStartingUpgrade` | 0 |
| eligible still-image generations | 34; 34 started; exactly one per generation |
| start offset | 200–220 ms, median 200 ms |
| targets | 32 SAMPLE, 2 SAMPLE\|FILE alias, 0 pure FILE, 0 other |
| upgrades without usable sample / on Sample-File cards / FILE→SAMPLE | 0 / 0 / 0 |
| stale installs | 0 |
| displayable before pointer leave | 6 of 34 |
| displayable-after-dwell range | 0–1490 ms |
| cost classes | 29 SIZE_UNAVAILABLE, 5 NO_ENTRY |

**Observer version.** Not relayed.
- `resourceTimingLoadsBeforeDwell` exists only in observers 1.0–1.2 (`git show 4d4f3af:tests/browser/ib09/ib09l_postamble.js`; absent at `6764f72`, 1.3). The STILL split fields exist from 1.2 on. So this is observer 1.2.
- Its `resourceTimingLoadsBeforeDwell` over-counts, because it time-window matches card media (`IB09_LIVE_CHECK.md` §7). A value of 0 is therefore conservative.

**Interpretation.**
- Under the worst case (slow link, no cache) the policy holds: nothing before dwell, and one eligible upgrade per dwell at 200–220 ms. It targets only the native sample or its alias, and never downgrades or installs stale media.
- Usefulness under throttling is limited: 6 of 34 upgrades became displayable before the pointer left. This is the expected throttled cost and needs no policy change. The thumbnail stays shown until a replacement is ready.
- Transfer sizes are cross-origin-hidden (29 SIZE_UNAVAILABLE) and are not counted as zero. 5 NO_ENTRY were served without a fetch entry.

## 3. Evidence against blueprint IB09 item 9

| Required evidence | Status | Source |
| --- | --- | --- |
| Fake-clock dwell and 40 ms sweeps | Met | `dwell_prototype_assertions.cjs` Q3/Q4 (84/84); variant B sweep has 0 assignments (54/54) |
| No pre-dwell network or source assignment | Met locally and live: 0 before dwell in e621 A/B, e926 C/D. The overlay-reuse fetches seen in e926 D (38/80) are removed by B by construction | `IB09_V3_REOPEN.md` §1–4 |
| Leave / re-entry / viewer joins | Met | Q5, Q8–Q10 (`dwell_prototype_assertions.cjs:102-107`); B viewer-before-dwell shows no overlay; live stale installs 0 |
| Wrong-slot bytes and aliases | Met | Eligibility follows the displayed/native relationship. Live: e621 A 5 alias, e621 B 2 alias, 0 pure FILE; video FILE targets separated (observer 1.2) |
| Known cheap original / sample / unknown / animated classes | Met for the evidence collected. The native sample class is qualified. No separate cheap-original class was evidenced, so cost-inconclusive Original targets retain thumbnail/View under the item 11 fallback. Unknown and animated classes are not admitted | `hoverUpgradeEligible`; e926 C/D: 0 upgrades on SAMPLE/FILE cards |
| Stale-generation protection | Met | Q8/Q9 + fault controls (`dwell_prototype_assertions.cjs:134-136`); live stale 0 |
| V2 pilot, unthrottled | Met (regular profile; cache-limited) | `IB09_DWELL_PROTOTYPE.md` §1 |
| Held-out throttled observation | **Met**: e621 B | §2 |
| Held-out usefulness / transfer observations | Met. Ordinary (e621 A) and throttled (e621 B) timing; transfer classified per observation, with hidden sizes never counted as zero | §2 |

**Item 10.**
- The chosen dwell and ordering policy fits the frozen zero-pre-dwell allowance on the held-out cases.
- Cost-inconclusive originals retain thumbnail/View. No Original-target class is qualified here, which is different from a ban: a future cheap-original class can be validated separately.
- The unknown-byte sample is admitted only as the IB08-validated native sample slot (G-RENDITION PASS(scope)) of a displayed preview.
- The current placeholder (thumbnail) remains until the replacement loads.
- Stale same-ID generations cannot apply.

## 4. Gate decision: G-HOVER(e621/e926 qualified still-image class), E → PASS(scope)

**Scope:**
- e621.net and e926.net, each independently; logged-out native `/posts`;
- the IB08-qualified two-source WebP/JPEG still-image card pattern;
- frozen 200 ms dwell;
- no pre-dwell hover metadata request or hover media assignment;
- dwell-gated overlay, option B;
- displayed PREVIEW → native SAMPLE or native SAMPLE\|FILE alias only;
- displayed SAMPLE or FILE → no upgrade.

**Excluded (thumbnail/View, or unchanged native behavior):**
- unsupported and cost-inconclusive classes;
- Original targets: no separate Original-target class is qualified by this evidence, so cost-inconclusive Original cases keep thumbnail/View. This does not prohibit a future, separately validated cheap-original class;
- unknown and animated images;
- video (IB10);
- logged-in contexts, post pages, the viewer (IB11), other hosts.

**Limitations carried:**
- the e621 C/D and e926 A numeric rows are UNVERIFIED in this record until pasted in (the operator accepted the sessions);
- e926 B was not run (throttled usefulness is e621 only);
- transfer sizes are mostly browser-hidden;
- the live sessions ran overlay A. B's pre-dwell zero is local and by construction, and is confirmed by P-stage live production conformance (`IB09_P_STAGE.md`).

**Opens:** the IB09 P stage for this scope only. **It does not open** automatic video admission (IB10).
