# Ledger

## Current milestone
**IB09 — Still-image hover dwell and cost: PARTIAL — NOT COMPLETE. G-HOVER OPEN.**

E stage so far:
- local baseline (`IB09_HOVER_BASELINE.md`);
- V2 live cost pilot, accepted with a regular-Chrome cache limitation (`IB09_DWELL_PROTOTYPE.md` §1);
- frozen decisions (§2): zero new hover media loads before dwell; no downgrade (PREVIEW→SAMPLE only). The earlier V3 acceptance is reopened (below);
- isolated 200 ms dwell prototype, locally qualified (84/84);
- held-out live check package (`IB09_LIVE_CHECK.md`, observer 1.3, 57/57);
- live correctness sessions accepted: e621 A, e926 C, e926 D. The 200 ms upgrade gating and no-downgrade are qualified on them;
- **V3 reopened** (`IB09_V3_REOPEN.md`): e926 D showed 38/80 reuse-initiated fetches (bytes unknown). Operator chose **B, dwell-gated overlay** (local 54/54);
- **E closeout assessment** (`IB09_E_CLOSEOUT.md`): decisions frozen (B overlay; 200 ms; zero pre-dwell metadata/media; PREVIEW→native SAMPLE only, no downgrade; unsupported → thumbnail/View; video IB10). **G-HOVER held OPEN:** the blueprint item 9 throttled observation was never run.

Production is unchanged; 200 ms is an E-stage candidate, not a production constant.

IB08 is COMPLETE, PASS(scope) (`docs/implementation/IB08_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `bbaf9ac63f5c0292018b974f00c7b30d8b478bb5` (commit `91fa86d`), unchanged by closeout.
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
- **IB09 invariant conflicts still in production** (not yet corrected): V1 (`preview` SAMPLE fetch at pointer-enter), V2 (`original` SAMPLE over FILE, `Booru_Enhancer.user.js:3065`), V5 (a 40 ms sweep incurs them). The prototype resolves them in test only. V3 (the t=0 current-rendition overlay) is reopened.
- **IB09 live e621 A** (preview, ordinary; package 1.1): **accepted.** Nothing before dwell, and one upgrade per eligible dwell at 200–220 ms.
  - Package defect: the 3 FILE targets were video posts (IB10 path, after dwell) counted in the still-image statistics. Corrected in observer 1.2.
  - Still-image targets: 38 SAMPLE + 5 native SAMPLE|FILE alias, 0 pure FILE.
  - The usefulness timing includes up to 3 video generations and is indicative only. No rerun.
- **IB09 live e926 C** (sample, ordinary; package 1.2): **accepted.** 80 STILL generations, zero hover media before dwell, no upgrades, no stale install.
  - `resourceTimingLoadsBeforeDwell` 6 was an observer defect: time-window matching of the card's sample/file with no causal provenance. Under Sample, the grid displays the sample, so grid loads and V3 reuse fetches were counted.
  - Corrected in observer 1.3 (causal UPGRADE/REUSE/DISPLAY/OTHER attribution; verifier 57/57). No rerun.
- **IB09 live e926 D** (original, ordinary; package 1.3): **accepted for correctness.** Nothing before dwell, no downgrade, no stale install.
  - It reopened V3: `renditionReuseFetchesBeforeDwell` 38/80 with zero grid/unattributed loads, so the V3 overlay's reuse of the displayed FILE initiated fetches. Bytes are unknown.
- **IB09 V3 decided: B.**
- **IB09 sole E-stage blocker:** e621 B throttled held-out session (Preview; Slow 4G + Disable cache; package 1.3 unchanged). e926 B optional. The operator waived the other per-host correctness rows (e621 C/D, e926 A) by designating e926 D final; the throttled row is a blueprint requirement and is not waived.
- **After G-HOVER PASS(scope):** the P-stage implementation (200 ms gating, ordering rule, overlay B), then live production conformance. G-HOVER OPEN.
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
The operator runs the e621 B throttled session (package 1.3, README "Dwell live check") and returns the labelled results. If they fit the frozen policy, G-HOVER → PASS(scope) as recorded in `IB09_E_CLOSEOUT.md` §3, then the IB09 P stage. No production change before that. Do not start IB10.
