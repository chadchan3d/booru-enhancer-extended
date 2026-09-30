# IB08 — V9-R evidence record (G-RENDITION)

**Checkpoint:** IB08 — Reversible native rendition integration (blueprint §3 IB08; gate row G-RENDITION, §5).

**Status:** IB08 PARTIAL — NOT COMPLETE. **G-RENDITION E stage: PASS(scope)** for the exact observed pattern only (§3); the diagnosis in §6 does not contradict it. B1 is resolved and B2 decided. The P stage is implemented (§5). **The first live production-conformance run is FAIL/PARTIAL (§6)**: dispose is not terminal in production (diagnosis A, correction proposed, not implemented). This file is not a completion record.

**Production:** `Booru_Enhancer.user.js` blob `a0f3041c409a656f67fe23dc827b020b5cc399e6` (commit `b2b1d9f`), with the IB08 P-stage rendition contract. Before IB08: blob `32d0051` (commit `c551bb0`).

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

## 4. P-stage design against `applySiteThumbMedia` (implemented in §5)

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

*B1 status:* **RESOLVED** (see *B1 live result* below).

*Probe 1.0.0 (`8b07a65`) — live failure:* all four live runs (e621 and e926, each logged out and logged in) returned `sanitationGuard: BLOCKED`. This is a probe failure, not evidence about markers.
- **Root cause:** the guard matched page values against the whole output, including the probe's own fixed labels.
  - Digit-bearing page values of 3 or more characters were matched as substrings.
  - A page value containing the site's short name (for example `e621`) is therefore a substring of the probe's own `site` label (`e621.net`), and blocks every run on that host, in either login state.
- **What is not confirmed:** the blocked output had no diagnostics, so the exact live element holding that value was not recorded. The class is reproduced locally: the committed 1.0.0 probe blocks on a fixture carrying the site's short name, on both hosts and in both states.

*Probe 1.1.0 — repair:*
- **Guard scope:** the guard now checks every page-derived output section (all the facts), with the same matching rule. The fixed labels (probe, version, `site` from a two-host allowlist, declared state, route enum, enhancer-marker boolean) are built only from literals, which a static check enforces. The URL-scheme check still covers the full output.
- **Coarser output:** only login-relevant names are emitted (user/login/session/account/auth/csrf/level/current/signed). All other names are counted only.
- **Diagnostics:** a blocked result carries value-free `blockDiagnostics` (source, section and mode counts).
- **Local qualification:** 59/59 with 12/12 fault controls, including a regression reproducing the live failure with the 1.0.0 probe and a fault control that reintroduces the failure class.
- **Live:** all four observations were rerun with 1.1.0.

*B1 live result (probe 1.1.0), operator-relayed:*
- **Qualifying marker:** `body[data-user-is-anonymous]`, observed independently on e621 and on e926:
  - logged out → `true`;
  - logged in → `false`.
  - It meets all three acceptance conditions.
- **Corroborating, not used for admission:** `data-user-level` (0 logged out, nonzero logged in).
- **Rejected:** `data-user-is-member`, because its logged-in behavior differs between e621 and e926.
- **Production admission:** the rendition path requires `body[data-user-is-anonymous]` to be exactly `"true"`. The attribute absent or any other value stays native.

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

## 5. P-stage implementation (commit `b2b1d9f`)

**Change:** `Booru_Enhancer.user.js`, blob `32d0051` → `a0f3041`.
- `applySiteThumbMedia` is rewritten, with the helpers `e6RenditionAdmitted` and `e6RenditionPattern` beside it.
- `enhanceThumbnail` records the returned provenance.
- The gallery module exposes it read-only as `getThumbRendition(card)`.
- `BE.ownership`, the CSS, the `media.thumbQuality` schema and every other call site are unchanged. The enrichment and pagination calls pass no owner and return `NATIVE_OUT_OF_SCOPE`.

**Mutation contract as implemented:**

**Admission** (all must hold, else `NATIVE_OUT_OF_SCOPE`):
- the `e621` adapter is active;
- the hostname is exactly `e621.net` or `e926.net`;
- the path is `/posts`;
- `body[data-user-is-anonymous]` is exactly `"true"`;
- a card owner is present.

**Pattern** (else `NATIVE_UNSUPPORTED`): the card is the native `article`, and all of these hold:
- `data-file-ext` is `jpg`, `jpeg`, `png` or `webp`;
- `data-preview-url`, `data-preview-webp` and a srcset-safe `data-sample-url` are present;
- there is exactly one `img` and one `picture`;
- the picture's children are exactly `source[type=image/webp]`, `source[type=image/jpeg]`, `img`;
- both source srcsets are single-candidate, with no `sizes` or `media`;
- the `img` has `src` and no `srcset`/`sizes`;
- the WebP source equals the native WebP preview and differs from the JPEG source;
- the sample differs from both sources.

While the card owner holds the WebP srcset, the pattern is judged on the native value it replaced.

**Writes:** only `owner.ownAttribute(webpSource, 'srcset', value)`.

| Quality | Value written | Provenance |
| --- | --- | --- |
| `sample` | the card's `data-sample-url` string | `OWNED_SAMPLE` |
| `original` | the card's `data-file-url` string | `OWNED_ORIGINAL` (no usable file: native, `NATIVE_UNSUPPORTED`) |
| `preview` | nothing; only a value this owner wrote earlier is set back to the native one | `NATIVE_PREVIEW` |

A write the owner refuses, because the site touched the attribute, reports `REFUSED_NATIVE_TOUCHED`.

**Never:**
- writing the JPEG source, `img src`/`srcset`/`sizes`, `media` or `type`;
- node creation, cloning, movement or removal;
- URL construction (URLs are parsed only for comparison);
- a request, storage or cookie access;
- writing `media.thumbQuality`.

**Undo:** the card owner's IB04 `dispose`. The stored native value is released through `owner.cleanup`.

**Local qualification** (`tests/host/ib08/rendition_assertions.cjs`, result `rendition-result.json`): **66/66**. The fixtures are synthetic.

| Test | What it checks |
| --- | --- |
| L1 | Per host, independently: one owned WebP write per pattern card; JPEG source and `img` untouched; node identity kept; provenance |
| L2 | `preview`: zero writes. preview → sample → preview switching restores through the owner; a natively touched attribute is refused |
| L3 | `original`: file URL written; no usable file, video and GIF stay native |
| L4 | 13 non-pattern shapes: zero writes, other enhancements kept |
| L5 | dispose restores the control card, keeps a native edit, restores a moved source in its native order, and leaves replacements untouched; 5 dispose/init cycles |
| L6 | logged in, marker absent, marker not exactly `true`, a non-`/posts` route and e926 logged in: all native |
| L7 | an e621 subdomain, Rule34 and Gelbooru: zero writes |
| L8 | no request or cookie access, and `media.thumbQuality` never written, including while inert |
| L9 | IB07 suites: all assertions and controls pass (their exit code reflects only their pin on the IB07 blob). IB08 verifiers: 65/65, 56/56, 59/59 |

**Production fault controls, 19/19 caught:**
- also writes the JPEG source;
- also writes `img src`;
- adds `img srcset`;
- clones the source;
- writes outside the owner;
- constructs a URL;
- preview writes the JPEG preview;
- original mapped to sample;
- switch back to preview not restored;
- login gate removed;
- login gate on presence only;
- route gate removed;
- host gate removed;
- three pattern-gate removals;
- a request from the rendition path;
- saved intent overwritten;
- owner bypassed so dispose cannot restore.

**Other suites:** IB01, IB02, IB03, IB05 and IB06 exit 0 on the new production.

**Live production-conformance package:** `tests/browser/ib08/IB08_Rendition_Production_Conformance.user.js`.
- Built from `b2b1d9f` by `build_ib08_conformance.cjs` (IB07 wrapper convention).
- Production body SHA-256 `dac83443e6ab7105810da8d96d90959349d65d3ac40ff2814396153efa37ab45`.
- Local verifier `verify_ib08_conformance.cjs`: **55/55**. Every check passes on e621 and e926 for logged-out sample/preview/original and for logged in. The dispose test passes on both hosts.
- Fault controls, 13/13 caught: 11 production mutants and 2 postamble leak controls.
- Operator steps are in `tests/browser/ib08/README.md` (P-stage section). The live runs are pending.

## 6. First live production-conformance run (package revision 1, production `a0f3041`) — FAIL/PARTIAL

**Evidence form:** operator-relayed summary of the sanitized results. Every run used the exact expected production artifact (P00 `MATCH_EXPECTED_ARTIFACT`).

| Run | e621.net | e926.net |
| --- | --- | --- |
| S (sample) | PASS | PASS |
| P (preview) | PASS | PASS |
| O (original) | PASS; all five sampled cards `NATIVE_FILE`; `settled:false` | **FAIL**, P09 only: 4 cards `NATIVE_FILE`, 1 `NATIVE_SAMPLE`, `settled:true`. Provenance `OWNED_ORIGINAL`, one owned write per pattern card, final attributes and node identity correct |
| L (logged in) | PASS | **FAIL**, P06 only: `loginMarker FALSE`, every card `NATIVE_OUT_OF_SCOPE`, final state and node identity correct, 4 unexplained writes (`totalRenditionWrites: 4`) |
| D (dispose/resize) | **FAIL**: D01 FAIL with `disposeWrites 66 = expected 66`; D02, D05, D06, D07 FAIL (`residue 67`); D03, D04, D08, D09 PASS | **FAIL**, same shape: `disposeWrites 70 = expected 70`, `residue 71` |

### Diagnosis A — dispose not terminal (both hosts): **production lifecycle defect**, plus conformance-package defects that mis-attributed it

**Event sequence:**
1. **Before disposal:** every pattern card is owned (`OWNED_SAMPLE`).
2. **Simulated native changes:** card 2 edit, card 3 move, card 4 source replacement, card 5 picture replacement.
3. **`gallery.dispose()`** (`Booru_Enhancer.user.js:4535-4546`):
   - `disposeCardOwners` restores every owned WebP srcset that was not natively touched and is still connected. That is 66 writes on e621 and 70 on e926, exactly as expected; the owner restoration is correct.
   - `galleryOwner.dispose()` restores the container's owned `data-be-gallery-init` attribute, which was originally absent, so it is **removed**.
4. **The app-level `bodyObserver`** (`:5427-5441`, `watchSpaNavigation`) is created once at startup and owned by nothing, so it is **never disconnected**. Dispose's own removal of each card's action bar is a body mutation. 400 ms later, the observer finds the container without `data-be-gallery-init` and calls `gallery.init` → `enhanceThumbnails`.
5. **New owners are created, and every card still matching the pattern is owned again:**
   - cards 1, 4 and 5 are re-owned, including the fresh replacement source and picture;
   - card 2 no longer matches (its WebP srcset is the native edit) and stays native;
   - card 3 no longer matches (moved order) and stays native.

   So the re-owned count is `owned − 2`: 69 − 2 = **67** on e621 and 73 − 2 = **71** on e926, exactly the live `residue`.
6. **Resize** is not involved; D08 PASS.
7. **At Step 2 (≥ 2.5 s later):** D02/D05/D06/D07 see sample residue. D03/D04 PASS because those cards fall outside the pattern.

**Why D01 failed with matching counts (package defect):** D01 re-read each restored node's value at Step 2, after re-enhancement had written the sample back. It therefore mixed "restored at dispose" with "re-enhanced later". Revision 2 judges D01 at dispose time and adds D10 for re-enhancement.

**Why the local verifier missed it (package defect):** it ran Step 2 immediately, before the 400 ms debounce. The IB04 production conformance (`tests/browser/ib04/IB04_Production_Conformance.user.js:4588-4596`) also asserted only immediately after dispose.

**Other questions:**
- The body observer has existed since the 1.2.7.1 import, so this is **pre-existing**; IB08's dispose-then-resize test exposed it.
- The package **does not cause** it: locally, dispose alone re-enhances within 700 ms with no other page change. Its overlay and simulation are merely further body mutations.
- No other enhancer observer or listener re-applies rendition: the settings listener and hover are owned by the disposed gallery owner.

**Proof** (`tests/host/ib08/dispose_lifecycle_regression.cjs`, 14/14, both hosts):
- restoration happens at dispose;
- **known failure reproduced:** every card is re-owned within the debounce;
- the cause is isolated: with the body-observer re-init disabled, or with the marker kept, dispose stays terminal;
- the proposed correction keeps dispose terminal, while explicit `gallery.init` and a genuinely new container still enhance.

**Proposed production correction (not implemented):** make `gallery.dispose()` terminal for the disposed container, without weakening the owner or the SPA path:
- the gallery module records containers it disposed (`WeakSet`);
- explicit `gallery.init(container)` clears the record;
- the gallery exposes `wasDisposed(container)`;
- `bodyObserver` re-inits only if the container is not marked **and** was not disposed.

The change is confined to the gallery lifecycle (`:3693`, `:3780`, `:4535-4546`, `:5430`). `applySiteThumbMedia` and `BE.ownership` are unchanged.

### Diagnosis B — e926 O, one `NATIVE_SAMPLE`: **conformance-package defect (label order); production correct**

The recorded facts force the conclusion:
- P07 passed, so the WebP srcset holds exactly the native `data-file-url` string, and the JPEG source and `img` are native.
- The browser can only select one of those: the file URL, or the JPEG preview (labelled `NATIVE_PREVIEW`).
- `currentSrc` is labelled `NATIVE_SAMPLE` with `settled:true`, so it equals both the file URL and the sample URL. For that card, **native file URL = native sample URL** (an alias).
- Revision 1 returned the first matching label, and SAMPLE was checked before FILE.
- The alias class exists live: IB07 recorded 10 of 140 cards with sample equal to file.

**Correction (revision 2):** P09 accepts the expected label from all matching labels, and reports `sampledAliased` and `fileEqualsSampleCards` (counts only, never values). Production is unchanged.

**Proof:**
- the revision-1 package fails P09 on a local alias card, on both hosts;
- revision 2 passes it and records the alias;
- a fault control restoring first-label comparison fails P09.

### Diagnosis C — e926 L, 4 unexplained writes: **not the rendition path; source undetermined (package defect: no provenance)**

**Not `applySiteThumbMedia` or the card owner:**
- `applySiteThumbMedia` returns before any write when the marker isn't `"true"` (`:4085`);
- P05 shows every card `NATIVE_OUT_OF_SCOPE`;
- P06 `writeMismatch 0` means no write on any snapshot card media;
- revision 1 counted as "unexplained" only writes on nodes outside the snapshot cards.

**No other enhancer path writes rendition attributes on native pre-existing nodes:** every other `src` write (`:2997`, `:3036`, `:3101`, `:3165`, `:3555`, `:3644`, `:3648`) targets enhancer-created hover or viewer media.

**Remaining candidates, not distinguishable from the revision-1 output:**
- enhancer UI (hover-preview media, settings-panel inputs);
- native e926 logged-in page behavior;
- cards or nodes added after load.

A local hover sweep in jsdom produced no such writes, so no candidate is confirmed. e621 L had none.

**Correction (revision 2):**
- writes are attributed by region at the moment they occur;
- enhancer rendition writes are identified by value (a card's native sample/file URL) on any native node;
- P06 fails only on card writes or stray signature writes, and reports the other regions.

**Proof:**
- revision 1 fails P06 on a local logged-in page with native and enhancer-UI off-card writes;
- revision 2 passes it with the writes attributed by region;
- a fault control writing a card's sample URL onto a native non-card node while logged in fails P06.

### e621 O `settled:false`

P09 checks the selected rendition (`currentSrc`); it was `NATIVE_FILE` on all five sampled cards. `settled` records whether the loads also finished within 8 seconds, and is informational in both package revisions; a repeat is required only when P09 fails. **No repeat is required** by the package definition. The row is still rerun, because production changes (below).

**E-stage scope:** unaffected. The E-stage experiment used its own owner and made no gallery re-init, and its live results stand. The defect is in the production lifecycle around the owner, not in the proven mutation premise.

**Package revision 2:** rebuilt from the same production `b2b1d9f` for local qualification. Verifier **75/75**, including:
- regressions A, B and C: revision 1 reproduces each live shape, and revision 2 attributes it;
- the known production failure on `a0f3041`: D02/D05/D06/D07/D10 FAIL, D01 PASS;
- 4 new fault controls.

**Rerun after the production correction:**
- The correction changes the production blob. Exact-artifact conformance therefore requires **all ten rows** on the new artifact: e621 and e926, each S, D, P, O and L.
- If carrying unaffected rows forward is accepted instead, the minimum is **e621 D, e926 D, e926 O and e926 L**. That requires the local proof that `applySiteThumbMedia` is byte-identical and that the diff is confined to the gallery lifecycle.

## Open for G-RENDITION / IB08

- **Production correction for diagnosis A:** needs approval, then implementation, local regression (the dispose-lifecycle test's known-failure oracle flips to PASS), and a package rebuild.
- **Live production conformance on the corrected artifact,** e621 and e926 independently: all ten rows (minimum four if carry-forward is accepted).
- IB08 completion record only after that conformance is reviewed.
- Danbooru rows: EXCLUDED(scope).
