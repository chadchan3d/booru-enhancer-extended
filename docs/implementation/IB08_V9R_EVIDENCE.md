# IB08 — V9-R evidence record (G-RENDITION)

**Checkpoint:** IB08 — Reversible native rendition integration (blueprint §3 IB08; gate row G-RENDITION, §5).

**Status:** PARTIAL — NOT COMPLETE. G-RENDITION is **OPEN**. This file collects E-stage evidence only. It is not a completion record and not a gate result.

**Production:** `Booru_Enhancer.user.js` blob `32d0051fe73505984066a5b69766b5eafc242bb9` (commit `c551bb0`). No IB08 step has changed it.

## 1. Native baseline (V9-R, live)

**Probe:** `tests/browser/ib08/IB08_V9R_Baseline_Probe.user.js` (committed in `f73fa6a`; local verifier 56/56).

**Context:**
- Tampermonkey × Chrome, versions not relayed;
- normal enhancer disabled;
- logged out;
- native listing route;
- Capture A in a wide window, Capture B after narrowing the same window;
- e621.net and e926.net run separately.

**Evidence form:** operator-relayed summary of the two sanitized results. The raw JSON is not stored here. It contains no URL, post ID or screenshot.

**Operator's relayed finding, verbatim:**

> for the observed logged-out listing pattern on both hosts, all six sampled cards retained card/img/picture/source identity across wide→narrow resize, each picture had two single-candidate WebP/JPEG sources with no sizes or media, and currentSrc remained NATIVE_PREVIEW_WEBP.

| Fact | e621.net | e926.net |
| --- | --- | --- |
| Sampled cards | 6 | 6 |
| Card/img/picture/source identity across resize | retained, all 6 | retained, all 6 |
| Picture structure | 2 sources, WebP then JPEG; single srcset candidate each; no `sizes`, no `media` | same, observed independently |
| `currentSrc` A → B | `NATIVE_PREVIEW_WEBP` → `NATIVE_PREVIEW_WEBP` (unchanged) | same, observed independently |

**Consequence (the "observed pattern"):** on this route, native responsive selection is a fixed type-based choice. There is no viewport-dependent srcset or `sizes` behavior. The browser shows the native WebP preview in both conditions.

**Not established by the baseline:**
- other routes, logged-in state, other DPRs;
- cards outside the pattern (video/animated, missing facts);
- any enhancer behavior.

No result is inherited between hosts.

## 2. Reversible ownership experiment (E stage, locally qualified; live run pending)

**Artifact:** `tests/browser/ib08/IB08_V9R_Ownership_Experiment.user.js`. It is isolated and runs with production disabled.

**Pattern gate.** A card is used only if all of the following hold. Anything else is classified with a reason enum and never touched:
- image media;
- native preview, WebP preview and sample facts present;
- `picture > source[type=image/webp] + source[type=image/jpeg] + img`;
- single-candidate source srcsets;
- no `sizes` or `media`;
- `img` has `src` only;
- the WebP source equals the native WebP preview;
- the sample is distinct from both previews.

With fewer than five pattern cards, the experiment changes nothing and reports `INSUFFICIENT`.

**Smallest mutation.** The experiment owns one attribute per card: the WebP `source` srcset, set to the card's own native sample URL. It uses an IB04-style owner:
- it records the original presence and value;
- it watches the attribute only after its own write, so any later change counts as a native touch;
- `dispose` restores the attribute only if all three hold: not natively touched, node still connected, value still the owned value.

The experiment never creates, clones, moves, replaces or removes a node, and never rewrites `img src`.

**Scenarios.** Five pattern cards, one scenario each. The native changes are simulated by a separately marked section of the experiment that stands in for the site.

| Card | Scenario | Simulated native change after mutation | Expected dispose | Expected after dispose and after resize |
| --- | --- | --- | --- | --- |
| CARD_01 | CONTROL | none | RESTORED | same nodes, order S1,S2, srcset ORIGINAL, `NATIVE_PREVIEW_WEBP` |
| CARD_02 | NATIVE_EDIT | WebP source srcset set to the native JPEG preview | SKIPPED_NATIVE_TOUCHED | native edit kept, `NATIVE_PREVIEW` |
| CARD_03 | MOVED_SOURCE | WebP source moved after the JPEG source | RESTORED | native order S2,S1 kept, srcset ORIGINAL, `NATIVE_PREVIEW` |
| CARD_04 | REPLACED_SOURCE | WebP source replaced by a fresh native source | SKIPPED_DISCONNECTED | replacement untouched and native, `NATIVE_PREVIEW_WEBP` |
| CARD_05 | REPLACED_PICTURE | whole picture replaced by a fresh native picture | SKIPPED_DISCONNECTED | replacement untouched and native, `NATIVE_PREVIEW_WEBP` |

After the mutation, every card must keep the same picture, source and img nodes and show `NATIVE_SAMPLE`. Other pattern cards and every unsupported card must end with unchanged rendition attributes.

**Local qualification:** `node tests/browser/ib08/verify_v9r_ownership_experiment.cjs` gives **65/65** (`tests/browser/ib08/V9R_OWNERSHIP_VERIFICATION.json`). It covers:
- e621 and e926 runs with host-identity checks;
- the experiment's self-report checked against the final DOM independently;
- 12 malformed card shapes, each classified and left untouched;
- insufficient and malformed-only pages with zero mutations;
- unsupported host, Step 2 without Step 1, and the not-narrowed case;
- the leak guard;
- static scope checks.

**Fault controls, 14/14 caught:**
- dispose never restores;
- dispose overwrites a native edit (caught by the self-report; the owned-value check also preserves the edit);
- dispose ignores the value and connection checks;
- dispose moves a source back;
- dispose writes by position;
- the owner counts its own write as a native touch;
- apply clones or replaces the source;
- apply removes srcset;
- apply also rewrites `img src`;
- the pattern gate is disabled;
- e926 is relabeled as e621;
- a leaked URL;
- a leaked post ID;
- a script-side request.

**Local limit:** jsdom has no image selection, so the verifier models `currentSrc`: the first supported-type source before the `img`, otherwise `img src`. Real selection, load timing and resize behavior are what the live run measures.

## Open for G-RENDITION

- Live ownership-experiment results, e621 and e926 independently.
- After that, the P-stage design against production's `applySiteThumbMedia`. Its current behavior is recorded in the Ledger: it overwrites all source and img srcset/src with one URL.
- Danbooru rows are out of scope: its G-HOST is not qualified.
