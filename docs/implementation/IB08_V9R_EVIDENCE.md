# IB08 — V9-R evidence record (G-RENDITION)

**Checkpoint:** IB08 — Reversible native rendition integration (blueprint §3 IB08; gate row G-RENDITION, §5).

**Status:** **IB08 COMPLETE — PASS(scope)** (`docs/implementation/IB08_COMPLETION_RECORD.md`). G-RENDITION is PASS(scope) for the qualified e621 and e926 logged-out `/posts` two-source WebP/JPEG pattern, each host independently. The final live D rows on production `bbaf9ac` passed (§10); the S/P/O/L rows are carried forward from `4ac1e36` (§10).

**Production:** `Booru_Enhancer.user.js` blob `bbaf9ac63f5c0292018b974f00c7b30d8b478bb5` (commit `91fa86d`). It contains:
- the IB08 P-stage rendition contract (`b2b1d9f`, blob `a0f3041`);
- terminal gallery disposal (`2765b9d`, blob `4ac1e36`);
- card presentation CSS scoped to the active gallery (`91fa86d`).

Before IB08: blob `32d0051` (commit `c551bb0`).

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

## 7. Diagnosis-A correction (commit `2765b9d`, production blob `a0f3041` → `4ac1e36`)

**Approved and implemented; confined to the gallery lifecycle:**

| Location | Change |
| --- | --- |
| `Booru_Enhancer.user.js:3694-3697` | The gallery module keeps `disposedContainers` (`WeakSet`) |
| `:3784` | `init(container)` first clears that container from the set, so explicit init always works |
| `:4548` | `dispose()` records the container it held (it takes no argument) |
| `:4555` | `wasDisposed(container)` is exposed on the gallery module |
| `:5438-5439` | The app-level `bodyObserver` re-inits a container only if it is unmarked **and** not recorded as disposed |

A genuinely new container is a different element, so it is not in the set and still initializes. `applySiteThumbMedia`, the rendition helpers, `BE.ownership`, the CSS and the settings schema are unchanged; the diff against `b2b1d9f` touches none of them.

**Local qualification:**
- **Lifecycle regression** `tests/host/ib08/dispose_lifecycle_regression.cjs`: **24/24**, e621 and e926 independently.
  - Properties checked:
    1. owned values restore at dispose;
    2. no automatic re-enhancement after the 400 ms debounce or an unrelated body mutation;
    3. native edit, move and source/picture replacements stay untouched;
    4. a resize after dispose stays native;
    5. explicit re-init works and clears the disposed state;
    6. a genuinely new container initializes;
    7. five dispose/init cycles are terminal each time, keep one action bar per card, and end native;
    8. the body observer cannot bypass the barrier: marker absent, repeated body mutations, history navigation.
  - **Fault controls (8/8):** barrier removed, dispose not recording and the previous production `a0f3041` are each caught by properties 2 and 8. Init not clearing is caught by property 5.
- **L1–L9:** 66/66 with 19/19 production fault controls.
- **IB01, IB02, IB03, IB05 and IB06:** exit 0.

**Package rebuilt** from `2765b9d` (production body SHA-256 `82fea4833e044e9c046f3f635b49d19d8bd12606caf39fb29a6b945173308e6e`). Verifier **77/77** with 18 fault controls:
- the dispose test past the debounce: every D check PASS on both hosts;
- the barrier-removed production mutant is caught by D10, plus D02/D05/D06/D07;
- regressions A/B/C reproduce the first live run with the revision-1 package.

## 8. Second live production-conformance run (production `4ac1e36`, package revision 2) — PASS except D10 on both hosts

**Evidence form:** operator-relayed summary. P00 was `MATCH_EXPECTED_ARTIFACT` on every row.

| Run | e621.net | e926.net |
| --- | --- | --- |
| S, P, O, L | PASS | PASS (O alias-aware; L with zero rendition writes) |
| D | D01 PASS (65 of 65 restored at dispose); D02–D09 PASS; residue 0. **D10 FAIL:** `afterDisposeSignatureWrites 0`, `afterDisposeCardMediaWrites 0`, `reenhancedCards 70` | D01 PASS (70 of 70); D02–D09 PASS; residue 0. **D10 FAIL:** 0, 0, `reenhancedCards 75` |

### D10 diagnosis: **package measurement defect.** Production dispose is terminal; no production change is needed for D10

**1. What increments `reenhancedCards`.** In revision 2, `reenhancedCards` counted snapshot cards whose `class` still contains `be-thumb-wrap` at Step 2 (`ib08p_postamble.js`, revision 2).

**2. Is that proof of re-init?** No. `be-thumb-wrap` stays whenever dispose does not remove it:
- The IB04 class record marks itself `nativeTouched` on **any** later mutation of the card's `class` attribute (`Booru_Enhancer.user.js:553-575`).
- `dispose` then skips the whole record (`:647-650`).
- A site script rewriting a card's classes after enhancement is enough, even when no token actually changes (for example, `classList.remove` of an absent token still rewrites the attribute).

**3. What it actually detects:** state that survived the original enhancement: the owned class token left in place under the IB04 native-touch rule. It is not a new owner, a new action bar or a new rendition. Action bars are removed at dispose (`additions`), and the in-memory provenance map is not a DOM class.

**4. Does the barrier hold live?** Yes, on the recorded facts. A re-init after dispose runs `enhanceThumbnail` on every card, and with Sample saved that writes the sample URL on every pattern card (`applySiteThumbMedia`). It would therefore show as signature writes, card-media writes and residue, and all three were **0** on both hosts. D02–D07 also passed, with native `currentSrc` and native changes preserved.

**5. Caller of a re-init:** none. The facts exclude one, and the local instruments below confirm it.

**6. Correction (package revision 3):** D10 now fails only on direct evidence of re-enhancement after dispose:
- a call through `BE.modules.gallery.init`, which the app-level body observer and startup use;
- a new owner (`BE.ownership.create`, used for every card owner);
- an inserted `.be-thumb-actions`;
- an enhancer rendition-signature write.

It also reports `thumbWrapperCalls`, which is `enhanceThumbnail`'s first step. The stale class is reported separately (`staleState`), with counts of cards whose class the site rewrote after load (class-mutation categories, counts only). The invariant is not weakened: every real re-enhancement path trips at least one indicator.

**Local proof, production `4ac1e36`, both hosts:**

**`tests/host/ib08/dispose_reenhancement_indicators.cjs`: 12/12.** Instruments are installed before production runs.

| Case | Stale-class cards | Init calls, owners, wrapper calls, action bars, rendition writes |
| --- | --- | --- |
| Site class touch, then dispose (the live shape) | every card | all 0 |
| No site touch | 0 (class restored) | all 0 |
| Explicit init after dispose (positive control) | — | all register |
| Barrier removed (fault control) | — | all register, plus sample residue |

**Package verifier: 84/84, 19 fault controls:**
- The revision-2 package reproduces the second live shape: D10 FAIL only, with zero writes and `reenhancedCards > 0`.
- Revision 3 passes every D check on the same scenario and reports the stale class, all of it on site-touched cards, with zero re-enhancement indicators.
- The barrier-removed production mutant is caught by D10 through all four direct indicators.
- D10 reverted to the stale-class metric is a fault control that false-fails the site-touch scenario.

### Separate finding: non-rendition presentation residue (not D10; decision needed)

The stale `be-thumb-wrap` class is harmless to renditions, but it is **not inert**:
- the stylesheet stays injected after gallery dispose;
- it contains an **unscoped** rule `.be-thumb-wrap { position: relative; overflow: hidden; aspect-ratio: 3/4; background …; border-radius … }` (`Booru_Enhancer.user.js:4588-4596`).

On cards whose class the site rewrote, dispose therefore leaves enhancer presentation (box aspect ratio, clipping, background) on native cards. This follows from the IB04 whole-record native-touch rule, which the G-OWN evidence accepted. It is outside the rendition-attribute contract, and it is not proven live: revision 3 reports the counts.

**Candidate corrections (not implemented; neither changes renditions):**
- (a) scope the rule under `.be-gallery-grid` (CSS only). This removes the effect wherever the container's gallery class is restored.
- (b) restore owned class **tokens** even when the class attribute was natively touched. This is an IB04 ownership-semantics change, and would need G-OWN review.

Whether this blocks IB08 closure is an operator decision.

**Minimum live rerun:** **e621 D and e926 D** with package revision 3, on the same production `4ac1e36`.
- Production is unchanged since the second run, so the second run's S, P, O and L rows stand on the same exact artifact.
- Revision 3's only behavioral change is the dispose test's D10 measurement, plus load-time counters that observe without changing production behavior.

## 9. Presentation-residue correction (commit `91fa86d`, production `4ac1e36` → `bbaf9ac`)

**Decision (operator):** the presentation residue blocks IB08 closure. The CSS-only correction is approved; ownership semantics stay unchanged.

**CSS audit** (injected stylesheet, `injectStyles`, `Booru_Enhancer.user.js:4571` onward):

| Selector | Before | Outlives the gallery? | Action |
| --- | --- | --- | --- |
| `.be-thumb-wrap` (position, overflow, min sizes, aspect-ratio 3/4, background, border-radius) | unscoped | **yes**, on any element with a stale token | scoped |
| `.be-thumb-img` (display block, 100% size, object-fit contain) | unscoped | **yes**; `ownClass(img, 'be-thumb-img')` follows the same native-touch rule | scoped |
| `.be-gallery-grid > .be-thumb-wrap, .be-gallery-grid .be-thumb-wrap` | scoped | no | none |
| `.be-gallery-grid[data-be-adapter="e621"] …` (wrap, link, picture, image, desc/extra) | scoped | no | none |
| `.be-gallery-grid.be-compact-mode …` (wrap, actions, action buttons) | scoped | no | none |
| Action bars / buttons | removed at dispose (owner additions) | no | none |

**Change:** the two unscoped selectors become `:where(.be-gallery-grid) .be-thumb-wrap` and `:where(.be-gallery-grid) .be-thumb-img`.
- `:where()` adds no specificity, so each rule keeps its original (0,1,0) specificity and source order. Appearance and cascade while the gallery is active are unchanged.
- Once dispose removes `be-gallery-grid` from the container, a stale token matches no enhancer rule.

**Ownership / G-OWN untouched, and why:**
- The operator directed it.
- The residue came from presentation rules that did not require an active gallery, not from an ownership fault. The IB04 whole-record native-touch rule never overwrites site-changed class attributes, and G-OWN passed with it.
- Token-level restoration would change the semantics G-OWN was qualified on, and would need its own review.

The CSS fix removes the residue's effect without writing to a site-touched attribute.

**Residual case, measured rather than assumed:** the container keeps `be-gallery-grid` under the same rule if the site also rewrote the **container's** class. Every gallery-scoped rule would then still apply. The local regression shows this as an observation. Package check D11 measures it live and fails on it.

**Local qualification** on production `bbaf9ac`, both hosts:
- `tests/host/ib08/presentation_residue_regression.cjs`: **14/14**.
  - With the gallery active, enhancer presentation applies to every card and image.
  - After a site class rewrite and then dispose, stale tokens remain on cards and images, but no enhancer rule matches them, and the container lost `be-gallery-grid`.
  - A no-touch dispose restores normally.
  - Explicit re-init makes the presentation active again.
  - A new container initializes with presentation.
  - Fault control: the previous unscoped CSS keeps enhancer rules on stale-token cards and images.
- **D10 indicators** 12/12; **lifecycle** 24/24 (8/8 fault controls); **L1–L9** 66/66 (19/19); **IB01–IB06** exit 0.

**Package revision 4**, built from `91fa86d` (production body SHA-256 `d8943f3bd12444c896dcd3ca2961814dce3adb9d5f8cbb80b76c35387b84648b`), adds **D11**: no enhancer stylesheet rule matches any card, image or the gallery container after dispose.
- Verifier **90/90**, 23 fault controls.
- With a site class rewrite on cards and images, D11 passes: stale tokens are reported, and no enhancer presentation applies.
- The previous unscoped CSS is caught by D11 alone among the D checks.
- The container-class-rewrite detection control fails D11 as intended.
- The dispose test past the debounce passes every D check.

**Live:** one final clean run of **all ten rows** on production `bbaf9ac` (e621 and e926, each S, D, P, O and L). Earlier rows were on superseded artifacts.

## 10. Final live D rows (production `bbaf9ac`, package revision 4) — PASS on both hosts

**Evidence form:** operator-relayed summary. P00 was `MATCH_EXPECTED_ARTIFACT` on both rows.

| Check | e621.net | e926.net |
| --- | --- | --- |
| D01 | PASS: `disposeWrites 67`, `restoredAtDispose 67`, expected 67 | PASS: 70 / 70 / 70 |
| D10 | PASS: galleryInitCalls 0, ownersCreated 0, actionBarsAdded 0, thumbWrapperCalls 0, signatureWrites 0, cardMediaWrites 0 | PASS: all 0 |
| Stale state (informational) | cardsWithEnhancerClass 71, ofWhichSiteTouchedClass 71 | 75, 75 |
| D02–D07 | PASS; residue 0 | PASS; residue 0 |
| D11 | PASS: cards 0, images 0, container presentation false, `containerKeepsGalleryClass` false | PASS: same |
| D08, D09 | PASS, PASS | PASS, PASS |
| Overall | **PASS** | **PASS** |

The stale-state figures confirm the §8 mechanism live: every card that kept the owned class had its class rewritten by the site. D11 confirms the §9 correction live: those tokens carry no enhancer presentation. The container kept no gallery class, so the residual container case (§9) did not occur.

**Carried-forward rows (operator decision).** S, P, O and L passed on both hosts in the second live run, on production `4ac1e36` (§8). They are carried forward as exact-behavior evidence and are **not** re-run on `bbaf9ac`.
- The only production change since then is `91fa86d` (two presentation selectors scoped under the active gallery).
- Rendition logic, admission, ownership, the mutation contract, settings and saved intent are unchanged.
- They were requalified locally on `bbaf9ac` (L1–L9 66/66, 19/19).
- The changed behavior (disposal presentation) passed live in the D rows above.

## Closed

IB08 is complete, PASS(scope). See `docs/implementation/IB08_COMPLETION_RECORD.md`. Danbooru rows: EXCLUDED(scope).
