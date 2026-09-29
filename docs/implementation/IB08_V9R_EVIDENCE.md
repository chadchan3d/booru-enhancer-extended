# IB08 — V9-R evidence record (G-RENDITION)

**Checkpoint:** IB08 — Reversible native rendition integration (blueprint §3 IB08; gate row G-RENDITION, §5).

**Status:** IB08 PARTIAL — NOT COMPLETE. **G-RENDITION E stage: PASS(scope)** for the exact observed pattern only (§3). The P stage is designed (§4) but not implemented. This file is not a completion record.

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

## 2. Reversible ownership experiment (E stage)

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

### 2a. Live results

**Evidence form:** operator-relayed summary of the two sanitized results. The raw JSON is not stored here.
- Artifact: `IB08_V9R_Ownership_Experiment.user.js` as committed in `ef19ec3`.
- Tampermonkey × Chrome, versions not relayed.
- Normal enhancer and other userscripts disabled; logged out; native listing route.
- Step 1 in a wide window; Step 2 after narrowing the same window.
- e621.net and e926.net run separately.

**Operator's relayed finding:**
- live ownership experiment on both hosts with `ALL_EXPECTATIONS_MET`;
- control restoration, native-edit preservation, moved-source preservation, replaced-source protection, replaced-picture protection and post-resize behavior all observed live.

| Scenario | e621.net | e926.net |
| --- | --- | --- |
| After the mutation: same nodes, one owned srcset write per card, `NATIVE_SAMPLE` shown | observed | observed independently |
| CONTROL: restored, then `NATIVE_PREVIEW_WEBP` after resize | observed | observed independently |
| NATIVE_EDIT: native edit kept through dispose and resize | observed | observed independently |
| MOVED_SOURCE: native order kept, owned value restored | observed | observed independently |
| REPLACED_SOURCE: replacement untouched and native | observed | observed independently |
| REPLACED_PICTURE: replacement untouched and native | observed | observed independently |
| Other pattern cards and unsupported cards: rendition unchanged | met (part of `ALL_EXPECTATIONS_MET`); counts not relayed | same |
| Viewport narrowed between steps | met (part of `ALL_EXPECTATIONS_MET`) | same |

`ALL_EXPECTATIONS_MET` is computed in the browser and requires every item in this table. It is set only if all of these hold:
- no expectation mismatch on any card in any phase;
- exactly five owned apply writes;
- dispose writes equal to the number of restorations;
- zero changed non-scenario cards;
- a narrowed viewport.

## 3. Gate disposition — G-RENDITION (E stage)

**Decision: PASS(scope).** The E-stage premise required by blueprint §3 IB08 item 6 ("G-RENDITION(host/pattern), E → PASS before source/size integration") holds within this scope and nowhere else:

| Scope element | Value |
| --- | --- |
| Hosts | e621.net and e926.net, each observed independently; neither result is inherited from the other |
| Route and state | native listing, logged out |
| Pattern | `picture > source[type=image/webp] + source[type=image/jpeg] + img`, single-candidate source srcsets, no `sizes` or `media`, `img` with `src` only; image media; native preview, WebP preview and sample facts present, with the sample distinct from both previews |
| Mutation proven reversible | one owned srcset on the WebP source, set to the card's native sample URL |
| Runtime | Tampermonkey × Chrome as used by the operator, at the operator's device-pixel ratio (versions and DPR value not relayed); two viewport widths |
| Outside the pattern | stays native. Proven locally on 12 malformed shapes; live, every non-scenario card stayed unchanged |

**How the blueprint §3 IB08 item 9 tests map to the evidence:**

| Item 9 test | Evidence |
| --- | --- |
| Same picture/source/img references before and after | baseline and experiment, live |
| Two viewport conditions | live |
| Dispose, then resize and `currentSrc` | live |
| Native edit, moved source, replacement | live, as simulated native changes |
| Malformed fallback | local, plus live untouched non-scenario cards |
| No result inherited between e621 and e926 | separate runs |
| Danbooru native size/query/cookie row | **EXCLUDED(scope)**, because Danbooru's G-HOST is not qualified |

**Not covered, and not inferred:**
- other routes: post, search variants, pools, favorites, pagination-inserted cards;
- logged-in state;
- video, GIF or animated media;
- other DPRs and runtimes;
- other hosts and other picture patterns;
- the `original` rendition, which was never applied live;
- live behavior of production's own owner (see below).

**Deviations recorded:**
- Blueprint item 12 lists "viewport/DPR screenshots". They are replaced by in-browser sanitized structural traces, under the repository sanitation policy and the assignment's no-screenshot instruction.
- The experiment used an IB04-style owner written for the experiment, not production's `BE.ownership`. By inspection, production's owner gives the same outcomes for these scenarios:
  - `ownAttribute` at `Booru_Enhancer.user.js:542-552` observes only after its own write;
  - `dispose` at `:642-645` skips natively touched or disconnected records.

  Production conformance (§4.4) must show this live. G-OWN is already PASS for picture/native attributes (`IB04_BROWSER_OWNERSHIP.md`).

This is an E-stage gate transition only. It does not claim production conformance, and it does not pass IB08.

## 4. P-stage design against `applySiteThumbMedia` (not implemented)

### 4.1 Current production behavior (`Booru_Enhancer.user.js:4033-4051`, blob `32d0051`)

- **Shared path:** the `e621` adapter serves both e621 and e926.
- **Quality setting:** `media.thumbQuality` (`:865-871`; default `sample`; choices `preview`/`sample`/`original`) picks one target URL.
- **What it writes,** through the card owner:
  - **every** `source` srcset in the picture;
  - the `img` srcset, **adding** it when the native `img` has none;
  - the `img` src.

**Conflicts with the scoped gate:**

| # | Conflict |
| --- | --- |
| C1 | The JPEG source is rewritten, so the native WebP/JPEG format-selection structure is collapsed |
| C2 | An `img` srcset is added and `img src` is rewritten. Neither is part of the proven mutation |
| C3 | `preview` writes the JPEG preview into the WebP source. That is a mutation where native already shows the preview |
| C4 | No pattern gate: sources with `sizes`/`media`, multi-candidate srcsets and other shapes are rewritten too |
| C5 | No route or login-state limit, and no strict host check beyond the adapter's `hostPattern` |

### 4.2 Proposed P-stage mutation contract

**Activation.** A card receives a rendition mutation only if **all** of these hold. Otherwise its rendition stays native and `media.thumbQuality` stays stored but inert (blueprint item 11). Other card enhancements are unaffected.
1. `BE.adapters.active.id === 'e621'`, and `location.hostname` is exactly `e621.net` or `e926.net`.
2. The call comes from the gallery listing path with a card owner (`enhanceThumbnail`, `:4088`).
3. **Logged-out state is positively established** from a native marker. **Bounding input B1 below (UNVERIFIED).**
4. The card passes the same pattern gate as the qualified experiment:
   - `wrap` is the native `article` with image `data-file-ext` (`jpg`/`jpeg`/`png`/`webp`), `data-preview-url`, `data-preview-webp` and `data-sample-url`;
   - exactly one `img`, whose parent is the card's only `picture`;
   - the picture's children are exactly `source[type=image/webp]`, `source[type=image/jpeg]`, `img`;
   - both source srcsets are single-candidate with no `sizes` or `media`;
   - the `img` has `src` and no `srcset`/`sizes`;
   - the WebP source equals the native WebP preview;
   - the sample is distinct from both previews and srcset-safe.

**Mutation, per `media.thumbQuality`:**

| Value | Effect on the WebP source srcset (the only rendition attribute ever written) |
| --- | --- |
| `preview` | No write; the native preview stays. If this owner changed the attribute earlier (the setting was switched), write back the native value captured before the first write, through `owner.ownAttribute`. That write is refused if the site has touched the attribute. |
| `sample` | `owner.ownAttribute(webpSource, 'srcset', nativeSampleUrl)`, exactly as proven. |
| `original` | Same single attribute, set to the native file URL. **Bounding input B2 below.** |

**Invariants:**
- Never written: the JPEG source, `img src`, `img srcset`, `sizes`, `media`, `type`, or any other node.
- No node is created, cloned, moved, replaced or removed.
- No URL is constructed; values are only the card's own native `data-*` facts.
- No request, storage or cookie use.
- The CSS contain rules (`:4549-4592`) and the grid settings are unchanged, so whole-image/contain behavior stays.

**Reversibility.** Only the existing IB04 owner is used, with no change to `BE.ownership`:
- `gallery.dispose` → `disposeCardOwners` (`:4489`) restores the WebP srcset unless the site touched it or the node was disconnected;
- a native edit is never overwritten, a native move is kept, and replaced nodes are never touched.

**Provenance** (blueprint item 10):
- `applySiteThumbMedia` returns one enum: `NATIVE_UNSUPPORTED`, `NATIVE_OUT_OF_SCOPE`, `NATIVE_PREVIEW`, `OWNED_SAMPLE`, `OWNED_ORIGINAL`, `REFUSED_NATIVE_TOUCHED`.
- `enhanceThumbnail` keeps the value in an in-memory `WeakMap` keyed by the card, so the owner and conformance can read which rendition is shown.
- Nothing is persisted. The grid never claims a sharper image than the one actually selected.

**Bounding inputs still required before implementation:**

**B1 — logged-out marker.** No native logged-in/logged-out marker for the e621/e926 listing is recorded (IB07 V1-N records contain none). Without one, activation cannot be limited to the proven logged-out state. This needs a sanitized V1-N observation of a native marker on both hosts, in both states, recorded as presence/absence only. If no reliable marker exists, logged-in activation needs its own evidence or stays native.

*B1 status:*
- The observation probe `tests/browser/ib08/IB08_B1_Login_State_Probe.user.js` is locally qualified: 46/46 with 9/9 fault controls (`B1_LOGIN_STATE_VERIFICATION.json`); the fixtures are synthetic.
- It reports candidate markers as names and value classes only, and the operator declares the state.
- The four live observations are pending: e621 and e926, each logged out and logged in.

*Acceptance rule, fixed before the live runs:* a marker is reliable only if all of these hold:
1. it is present and readable, without cookies or requests, in all four observations;
2. on **each host independently**, its logged-out value class differs from its logged-in value class;
3. the same marker and the same class mapping hold on both hosts. Otherwise, each host's marker is recorded separately and neither is inferred from the other.

Logged-out detection must be positive, meaning the logged-out class is required for activation. Absence or an unknown class stays native. If no candidate meets the rule, B1 is reported as **NO RELIABLE NATIVE MARKER**, and IB08 stops at that point for a decision.

**B2 — `original`.** The mechanism is the one proven, but no `original` URL was applied live. Two options:
- (a) include `original` in P and require it as a live conformance row;
- (b) map `original` to `sample` inside scope until observed.

**B2 decided by the operator: option (a).** `media.thumbQuality = original` stays a distinct rendition: the WebP-source srcset is set to the card's own native file URL (`data-file-url`), through the same single owned attribute. It is **not** mapped to `sample`. It needs its own live production-conformance row after implementation. Cards whose file is not a still image (`jpg`/`jpeg`/`png`/`webp`) fail the pattern gate and stay native.

**B3 — release note.** Rendition becomes native, with the setting retained, in these cases that are enhanced today:
- the `preview` setting;
- logged-in pages (pending B1);
- non-pattern cards;
- sources with `sizes`/`media`.

`CHANGELOG.md` needs an entry.

### 4.3 Files and call sites that would change

| Location | Change |
| --- | --- |
| `Booru_Enhancer.user.js:4033-4051` `applySiteThumbMedia` | Rewritten to the contract: pattern gate, one owned attribute, provenance enum. A small pattern-gate helper and a native-value `WeakMap` sit beside it. |
| `:4078-4090` `enhanceThumbnail` | Keeps the returned enum; no other change. |
| `:3837` settings listener | Unchanged: re-runs `enhanceThumbnails`, which now handles switching back to `preview`. |
| `:4257` enrichment and `:4432` pagination clone | Unchanged. They pass no owner, so the new function returns `NATIVE_OUT_OF_SCOPE` as the current one returns immediately. Pagination is IB12 (G-PLACE-T). |
| `BE.ownership` (`:500-680`), CSS (`:4549-4592`), `media.thumbQuality` schema (`:865-871`) | Unchanged. |
| B1 marker helper, in or beside the `e621` adapter (`:2426` area) | Only after B1 is observed. |
| `CHANGELOG.md` | Release note (B3). |
| New tests | `tests/host/ib08/` (local production assertions); `tests/browser/ib08/` production-conformance package, built by the IB07 convention (derived script, C00 body hash, builder check, verifier, checksums). |

### 4.4 Production-conformance tests required after implementation

**Local, running production source in the jsdom harness with request instrumentation. Each item has fault-control mutants:**

| # | Test |
| --- | --- |
| L1 | Pattern card, `sample`: exactly one attribute write (WebP srcset = native sample); JPEG source and `img` untouched; no `img srcset` added; node identity unchanged. |
| L2 | `preview`: zero rendition writes. Switching sample → preview → sample restores and re-applies through the owner; a natively touched attribute is refused. |
| L3 | `original`: per B2. Video/GIF/unknown media stays native. |
| L4 | The 12 non-pattern shapes plus `sizes`/`media` sources: zero rendition writes; other card enhancements still applied. |
| L5 | `BE.modules.gallery.dispose()` covers control restored, native edit kept, moved source restored in native order, and replaced source/picture untouched. Re-init and dispose cycles stay bounded. |
| L6 | Logged-in marker (B1): zero rendition writes. |
| L7 | Rule34/Gelbooru/generic adapters: zero rendition writes. e621 and e926 are asserted separately. |
| L8 | No request, storage or cookie use from the rendition path. `media.thumbQuality` stays stored unchanged while inert. |
| L9 | IB01–IB07 regression suites and IB08 verifiers stay green. |

**Live, exact-artifact derived conformance package, run separately on e621 and on e926, logged out, other scripts disabled:**
- C00 production-body identity.
- Classification counts.
- Per sampled card: one owned write, same nodes, `NATIVE_SAMPLE` shown, JPEG source and `img` untouched.
- Two viewport widths.
- Postamble-simulated native edit, move and replacements, then `BE.modules.gallery.dispose()` and a resize, with the same expectations as §2.
- Unsupported cards unchanged.
- `preview` stays native; `original` per B2.
- No enhancer request.
- Sanitized output.

Afterwards, a logged-in check shows no rendition writes (per B1).

## Open for G-RENDITION / IB08

- B1: four live login-state observations, evaluated against the acceptance rule in §4.2. B2 is decided (option a).
- P-stage implementation and production conformance, local and live, on each host.
- IB08 completion record only after production conformance.
- Danbooru rows: EXCLUDED(scope).
