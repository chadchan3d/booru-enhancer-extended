# Ledger

## Current milestone
**IB09 — Still-image hover dwell and cost: PARTIAL — NOT COMPLETE. G-HOVER(e621/e926 qualified still-image class) PASS(scope)** (`IB09_E_CLOSEOUT.md`). E stage closed. **P stage implemented** (`IB09_P_STAGE.md`); live production conformance pending.

Frozen policy:
- overlay B (dwell-gated);
- 200 ms dwell;
- no pre-dwell hover metadata request or media assignment;
- in the qualified class, only displayed PREVIEW → native SAMPLE or SAMPLE|FILE alias has cost evidence for an automatic upgrade; displayed SAMPLE/FILE → no upgrade (no downgrade);
- no Original-target class is qualified by this evidence, so cost-inconclusive Original cases retain thumbnail/View. This is not a universal original ban; a separately validated cheap-original class stays possible;
- unsupported and cost-inconclusive classes → thumbnail/View;
- video IB10.

Scope: e621.net and e926.net independently, logged-out native `/posts`, IB08-qualified still card.

Production: commit `16f821e`, blob `3161b51` (hover module only, +50/−0). Local: P-stage assertions 115/115 (10 fault controls); conformance package verifier 29/29 (5).

IB08 is COMPLETE, PASS(scope) (`docs/implementation/IB08_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `3161b51f7ef30e2dd5e7a1b6c94398f2745ad1e5` (commit `16f821e`, IB09 P stage). The previous blob `bbaf9ac` (`91fa86d`) is the IB08 and IB09 E-stage artifact.
- **IB07 PASS(scope)** (native Post facts):
  - Rule34 listing identity and logged-out image post;
  - e621 and e926 listing and image post, each independently;
  - Gelbooru logged-out image post.
- **IB08 PASS(scope)**, G-RENDITION PASS(scope). Scope: e621.net and e926.net independently, logged-out (`body[data-user-is-anonymous="true"]`) native `/posts`, the two-source WebP/JPEG card pattern.
  - **Writes:** a single owned write to the WebP source srcset. `sample` uses the native sample URL; `original` uses the native file URL; `preview` stays native.
  - **Everything else stays native;** `media.thumbQuality` stays stored.
  - **Dispose:** restores owned values, keeps native changes, is terminal for the disposed container, and leaves no enhancer presentation. Card CSS is scoped with `:where(.be-gallery-grid)`.
  - **Release note:** `CHANGELOG.md`, "Unreleased — e621/e926 grid thumbnail quality".

## Verified
- **IB09 held-out live sessions** (operator-run; normal Chrome; same executed body; observer 1.1–1.3). Nothing before dwell, no downgrade and no stale install in every relayed session:
  - e621 A: Preview / ordinary; 38 SAMPLE + 5 alias, 0 pure FILE; start 200–220 ms;
  - **e621 B: Preview / THROTTLED** (Slow 4G, Disable cache): 80 generations, 34/34 eligible started once, at 200–220 ms (median 200); 32 SAMPLE + 2 alias, 0 pure FILE; 6/34 displayable before leave; displayable-after-dwell 0–1490 ms; cost 29 SIZE_UNAVAILABLE + 5 NO_ENTRY;
  - e621 C (Sample), e621 D (Original), e926 A (Preview): operator-accepted. The numeric rows are UNVERIFIED in this record until pasted in verbatim (no rerun);
  - e926 C: Sample; 80 STILL, 0 upgrades;
  - e926 D: Original; 0 downgrade. It reopened V3: 38/80 reuse-initiated fetches led to the decision for B.
- **IB09 P stage on `3161b51`** (`IB09_P_STAGE.md`):
  - `p_stage_assertions.cjs` 115/115 on the real production source: sweeps, Q1–Q10, alias, no-sample fallback, out-of-scope identity to `bbaf9ac`; 10/10 fault controls;
  - conformance package verifier 29/29 (5/5);
  - IB08 66/66, 24/24, 12/12, 14/14, 90/90; IB01–IB03, IB05, IB06 exit 0; IB07 pin-only exit 1 as before;
  - the E-stage suites are pinned to `bbaf9ac` and unchanged: 32/32, 84/84, 54/54; live package 57/57.
- **IB09 hover baseline** (`tests/host/ib09/hover_baseline.cjs`): 32/32 on production `bbaf9ac`, with a reusable fake-clock harness (`hover_harness.cjs`). It covers e621 and e926 × preview/sample/original × S1–S8; the results are identical on both hosts.
  - Zero network requests.
  - Metadata is a cache hit at pointer-enter.
  - The overlay shows the card's current rendition at t=0.
  - `preview` and `original` assign a SAMPLE upgrade at t=0, including in a 40 ms sweep.
  - Stale generations cannot apply (three guards).
  - 7 fault and negative controls are caught.
- **IB09 V2 live** (operator-relayed, e621 and e926 separately, regular Chrome profile): PREVIEW, SAMPLE and FILE reuse 4/4 `NO_ENTRY`, 0 ms on both hosts. The abort experiment is inconclusive.
- **IB09 dwell prototype** (`tests/host/ib09/dwell_prototype.cjs`, a test-time patch; assertions 84/84). The boundary sweep (0/40/100/199/200/201/250) gives no upgrade under 200 and one at 200. Metadata runs only after dwell. SAMPLE/FILE get no upgrade. Leave, re-entry, A→B, stale results and viewer takeover are clean. 10/10 fault controls are caught.
- **IB09 live check package** (`tests/browser/ib09/IB09_Dwell_Live_Check.user.js`). It is production `bbaf9ac` + the 200 ms prototype + 8 observe-only hooks, with its body minus the hooks pinned to the qualified prototype and C00 in the page.
  - Verifier at 1.1.0: 44/44, 10/10 fault controls.
  - Observer 1.1.0: non-blocking click-through toast instead of the blocking result box at session start; session data and executed body identical to the previous package.
  - Observer 1.2.0: the still-image rule is evaluated over STILL cards only; video, animated and unknown cards are reported separately; true SAMPLE, alias, pure FILE and no-usable-sample outcomes are split.
  - Observer 1.3.0: Resource Timing entries are attributed causally; only UPGRADE entries (`hoverLoadsBeforeDwell`) count against the rule. Verifier 57/57.
  - Timing comes from the hooks (cache-independent); cost is classified per observation.
  - Bounded to 80 generations per session.
- **IB09 V2 pilot probe** (`tests/browser/ib09/IB09_V2_Hover_Cost_Probe.user.js`): verifier 39/39 on a synthetic browser model, 11/11 fault controls.
  - Bounded to 16 cards and 32 image loads per host.
  - Sizes hidden by the browser are never counted as zero; no "free" claim is made.
  - Abort is inferred from a follow-up load.
- **IB08 final live D rows on `bbaf9ac`,** operator-relayed, PASS on e621 and e926:
  - D01 67/67 and 70/70;
  - D10 (no re-init, owners, action bars or writes after dispose);
  - D11 (no enhancer presentation);
  - residue 0.
- **IB08 S/P/O/L:** carried forward from the second live run on `4ac1e36`. The only change since then is the CSS scoping, and the rows were requalified locally.
- **IB08 local on `bbaf9ac`:**
  - L1–L9 66/66 (19/19 fault controls);
  - lifecycle 24/24 (8/8);
  - D10 indicators 12/12;
  - presentation 14/14;
  - package verifier 90/90 (23 fault controls).
- IB08 E stage: V9-R baseline and ownership experiment, live on both hosts; B1 marker live on both hosts.
- IB07 live exact-artifact conformance on `c551bb0`: 7/7 PASS.
- IB01–IB06 suites exit 0 on `bbaf9ac`.

## Unresolved
- **IB09 live production conformance pending:** e621 and e926 × P1 Preview, P2 Original (`tests/browser/ib09/README.md`, "IB09 production conformance"; package `IB09_Production_Conformance.user.js` on `16f821e`).
  - Production resolves V1/V2/V5 and replaces V3 with overlay B (`3161b51`), locally proven.
  - Live confirmation of B's zero pre-dwell fetch comes from this run.
- **IB09 scope boundary (unchanged by design):** video (IB10), GIF, logged-in pages, other routes and other hosts keep their existing immediate hover path, including pre-dwell work.
- **IB09 E limitations carried:**
  - the e621 C/D and e926 A numeric rows are UNVERIFIED here until pasted in verbatim;
  - e926 B (optional) was not run, so throttled usefulness is observed on e621 only;
  - transfer sizes are mostly browser-hidden (not counted as zero).
- **IB08 retained limitations (non-blocking; completion record):**
  - stale owned class tokens stay on site-touched cards after dispose (IB04 rule), with no presentation effect;
  - a site-rewritten container class would keep `be-gallery-grid` (not observed live; D11 detects it);
  - S/P/O/L are carried forward from `4ac1e36`;
  - runtime versions and DPR were not relayed;
  - the first run's four e926 logged-in off-card writes stayed unattributed (not the rendition path).
- **IB07 host suites** pin the IB07 blob, so they exit 1 on the pin alone. All their assertions and controls pass; the historical results are not edited.
- **Retained:** live request counting starts at the postamble; the local item 9 T1/T2 suite is the startup evidence. The earlier slot-provenance live runs stay POTENTIALLY CONTAMINATED / SUPERSEDED.
- **Deferred to later checkpoints:** video/GIF (IB10), viewer (IB11), pagination (IB12), downloads (IB13), favorites/actions (IB14), other hosts, Pixiv (IB17).
- **Deferred UI note (IB15, operator):** increase the settings-window text/font size for readability.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
The operator runs the IB09 production conformance: e621 and e926 × P1 Preview, P2 Original. The operator also pastes the e621 C/D and e926 A figures so they can be recorded verbatim. If conformance passes, write the IB09 §11 completion record. Do not mark IB09 complete before that. Do not start IB10.
