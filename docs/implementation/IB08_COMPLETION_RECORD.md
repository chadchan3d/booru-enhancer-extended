# IB08 — Checkpoint completion record

**Checkpoint:** IB08 — Reversible native rendition integration (blueprint §3 IB08)

**Outcome:** **PASS(scope)** (see Scope and Outcome)

**Evidence gate owned (§5):** G-RENDITION (host/pattern)

**Record date:** 2026-09-30

The fields follow the blueprint §11 "Required checkpoint completion record". The detailed evidence is in `docs/implementation/IB08_V9R_EVIDENCE.md` (§1–§10).

## Identity

| Item | Value |
| --- | --- |
| Checkpoint | IB08 — Reversible native rendition integration |
| Executor | Implementing agent; live evidence by the operator (ChadChan3D) |
| Source before | `Booru_Enhancer.user.js` blob `32d0051fe73505984066a5b69766b5eafc242bb9`, commit `c551bb0` (the IB07 artifact) |
| Source after | blob `bbaf9ac63f5c0292018b974f00c7b30d8b478bb5`, commit `91fa86d` |
| Common artifact hash | production body SHA-256 `d8943f3bd12444c896dcd3ca2961814dce3adb9d5f8cbb80b76c35387b84648b`. The live P00 check matched it on both final D rows (`MATCH_EXPECTED_ARTIFACT`) |

## Scope

Qualified only here. Each host was evidenced independently; neither is inferred from the other.

| Element | Qualified value |
| --- | --- |
| Hosts | e621.net, e926.net |
| Route | native `/posts` listing |
| Login state | logged out, positively established by `body[data-user-is-anonymous="true"]` |
| Card pattern | native `article` with image `data-file-ext` (jpg/jpeg/png/webp), `data-preview-url`, `data-preview-webp`, srcset-safe `data-sample-url`; exactly `picture > source[type=image/webp] + source[type=image/jpeg] + img`; single-candidate source srcsets; no `sizes`/`media`; `img` with `src` only; WebP source = native WebP preview; sample distinct from both previews |
| Qualities | `preview` (native), `sample` (native sample URL), `original` (native file URL) |
| Runtime | Tampermonkey × Chrome as used by the operator, at the operator's device-pixel ratio (versions and DPR not relayed); two viewport widths |

**Excluded or deferred:**
- logged-in pages and non-`/posts` routes (they stay native);
- cards outside the pattern, video/GIF/animated media, other DPRs, runtimes, hosts and picture patterns (all stay native);
- Danbooru rows: EXCLUDED(scope), because Danbooru's G-HOST is not qualified;
- Pixiv (IB17), hover (IB09), video (IB10), viewer (IB11), pagination (IB12), downloads (IB13), actions (IB14).

## Invariant

"Enhancement preserves native source/picture identity, current preferences and responsive behavior; disposal never overwrites newer native choices."

**Direct evidence:**
- One owned attribute per qualified card. The picture/source/img nodes are unchanged (L1, P08, live).
- The native WebP/JPEG type selection is preserved; the JPEG source and `img` are never written.
- Disposal restores only owned, untouched, connected values. It keeps native edits and moves and never touches replacements (live ownership experiment and final D rows).
- Disposal is terminal (final D10), and it leaves no enhancer presentation (final D11).

## Preconditions

- G-OWN, G-SETTINGS, G-RUNTIME and G-REQUEST are PASS (IB04–IB06 records).
- G-HOST for the e621 and e926 listings is PASS(scope) (IB07).
- **G-RENDITION E stage** was recorded as PASS(scope) before any production change (evidence record §3), on this evidence:
  - the V9-R native baseline (§1);
  - the live reversible-ownership experiment, `ALL_EXPECTATIONS_MET` on both hosts (§2).

## Bounding decisions

- **B1 (login state):** resolved from four live observations with probe 1.1.0 (evidence record §4.2).
  - `body[data-user-is-anonymous]` is `true` when logged out and `false` when logged in, observed on e621 and e926 independently.
  - `data-user-level` corroborates the distinction but is not used for admission.
  - `data-user-is-member` is rejected, because its logged-in behavior differs between the hosts.
  - The first probe version (1.0.0) blocked all four runs through a sanitation-guard defect. That was diagnosed, repaired and regression-tested; it was a probe failure, not marker evidence.
- **B2 (`original`):** the operator's decision. `original` is a distinct rendition using the card's native `data-file-url`, never mapped to `sample`, with its own live conformance row.
- **B3 (release note):** `CHANGELOG.md`, "Unreleased — e621/e926 grid thumbnail quality". It covers:
  - the cases that now stay native: the Preview setting, logged-in pages, other e621/e926 pages, video/GIF and non-standard thumbnails;
  - that the saved Grid thumbnail quality is kept.

## Change

**Production commits, in order:**

| Commit | Blob | Change |
| --- | --- | --- |
| `b2b1d9f` | `a0f3041` | P-stage rendition contract in `applySiteThumbMedia`: admission helpers, pattern gate, single owned write, provenance enum via `gallery.getThumbRendition` |
| `2765b9d` | `4ac1e36` | Terminal gallery disposal: a disposed-container `WeakSet`; the app-level `bodyObserver` does not re-init a disposed container; explicit `init` clears it; `gallery.wasDisposed` |
| `91fa86d` | `bbaf9ac` | Presentation scoping: `.be-thumb-wrap` and `.be-thumb-img` rules become `:where(.be-gallery-grid) …`, with specificity unchanged |

**P-stage mutation contract (final):**

**Admission** (else `NATIVE_OUT_OF_SCOPE`):
- the `e621` adapter is active;
- the hostname is exactly `e621.net` or `e926.net`;
- the path is `/posts`;
- `data-user-is-anonymous` is exactly `"true"`;
- a card owner is present.

**Pattern:** as in Scope; otherwise `NATIVE_UNSUPPORTED`.

**The only write:** `owner.ownAttribute(webpSource, 'srcset', value)`.

| Quality | Value written | Provenance |
| --- | --- | --- |
| `sample` | native `data-sample-url` | `OWNED_SAMPLE` |
| `original` | native `data-file-url` | `OWNED_ORIGINAL`; with no usable file, native and `NATIVE_UNSUPPORTED` |
| `preview` | none; only an earlier owned value is set back to native | `NATIVE_PREVIEW` |

A write refused because the site touched the attribute reports `REFUSED_NATIVE_TOUCHED`.

**Never:**
- the JPEG source, `img src`/`srcset`/`sizes`, `media` or `type`;
- node creation, cloning, movement or removal;
- URL construction (URLs are parsed only for comparison);
- a request, storage or cookie access;
- writing `media.thumbQuality`.

**Not changed:** `BE.ownership` (IB04 semantics, including the whole-record native-touch rule), the settings schema, host admission outside `applySiteThumbMedia`, and the grid and contain CSS apart from the two scoped selectors.

**Forbidden-scope audit (blueprint IB08 item 4):**
- no cloning or deletion of native source trees;
- no unconditional srcset removal;
- no global cookie override;
- no new crop mode;
- no broad URL rewriting;
- no Pixiv integration.

## Tests

**Local**, run on the final artifact `bbaf9ac` unless stated. All fixtures are synthetic.

| Suite | Result |
| --- | --- |
| P-stage production assertions L1–L9 (`tests/host/ib08/rendition_assertions.cjs`) | 66/66, 19/19 production fault controls |
| Terminal-disposal lifecycle (`dispose_lifecycle_regression.cjs`) | 24/24 on both hosts; 8/8 fault controls, including the pre-fix production `a0f3041` |
| D10 re-enhancement indicators (`dispose_reenhancement_indicators.cjs`) | 12/12 on both hosts (positive control and barrier-removed fault) |
| Presentation residue (`presentation_residue_regression.cjs`) | 14/14 on both hosts; the previous unscoped CSS is the fault control |
| Production-conformance package revision 4 (`tests/browser/ib08/verify_ib08_conformance.cjs`) | 90/90, 23 fault controls; regressions reproduce every earlier live failure shape |
| E-stage artifacts | baseline probe 56/56 (6/6); ownership experiment 65/65 (14/14); B1 probe 1.1.0 59/59 (12/12) |
| IB01, IB02, IB03, IB05, IB06 | exit 0 |
| IB07 host suites | every assertion and control passes. They exit 1 only because they pin the IB07 blob by design; their historical results are unedited |

**Live evidence history.** All runs used Tampermonkey × Chrome, the operator's browser and sanitized output, relayed by the operator.

| Run | Artifact | Result | What it exposed |
| --- | --- | --- | --- |
| V9-R baseline | none (native) | PASS on both hosts | Native pattern: 2 single-candidate WebP/JPEG sources, stable node identity across resize, `NATIVE_PREVIEW_WEBP` |
| Ownership experiment (E stage) | isolated experiment | `ALL_EXPECTATIONS_MET` on both hosts | The single-attribute mutation is reversible; native edit, move and replacements are preserved |
| B1 probe 1.0.0 | probe | BLOCKED × 4 | Probe sanitation-guard defect (the guard scanned its own fixed labels) |
| B1 probe 1.1.0 | probe | 4 observations | The login marker (B1) |
| First production conformance | `a0f3041`, package rev 1 | FAIL/PARTIAL | **A:** production re-enhanced after dispose (unowned body observer; pre-existing). **B:** a file/sample alias mislabelled by the package. **C:** off-card writes not attributed by the package |
| Second production conformance | `4ac1e36`, package rev 2 | PASS except D10 | The package counted a stale class token as re-enhancement. That exposed a real **presentation residue**: the unscoped `.be-thumb-wrap` CSS on site-touched cards |
| **Final D rows** | **`bbaf9ac`, package rev 4** | **PASS on both hosts** | See below |

**Final live D rows** (production `bbaf9ac`; P00 matched):

| Check | e621.net | e926.net |
| --- | --- | --- |
| D01 restored at dispose | 67 of 67 expected | 70 of 70 |
| D02–D07 (control, native edit, move, replacements, others native) | PASS, residue 0 | PASS, residue 0 |
| D10 re-enhancement | PASS: init 0, owners 0, action bars 0, wrapper 0, signature 0, card media 0 | PASS: all 0 |
| Stale state (informational) | 71 cards keep the class, all 71 site-touched | 75 cards, all 75 site-touched |
| D11 presentation | PASS: cards 0, images 0, container no; container kept the gallery class: no | PASS: same |
| D08 resize / D09 requests | PASS / PASS | PASS / PASS |

**Carried-forward rows (not re-run on `bbaf9ac`).** S (sample), P (preview), O (original) and L (logged in) passed live on both hosts in the second run, on production `4ac1e36`. They are carried forward as exact-behavior evidence. They are **not** represented as run on `bbaf9ac`.
- **Why they carry forward:**
  - The only production change after `4ac1e36` is `91fa86d`, which scopes two CSS selectors under the active gallery.
  - Rendition logic, host/login admission, ownership semantics, the mutation contract, settings behavior and saved intent are unchanged.
  - Those contracts were requalified locally on `bbaf9ac`: L1–L9 66/66 with 19/19 fault controls, plus the lifecycle and D10 suites.
  - The behavior `91fa86d` changes (presentation after disposal) was re-run live on both hosts and passes D01–D11.
- **What the carried rows showed in the second run:**
  - S: one owned write per pattern card, `NATIVE_SAMPLE` shown.
  - P: no writes, native preview.
  - O: file URL written, `NATIVE_FILE` shown, alias-aware on e926.
  - L: `loginMarker FALSE`, zero enhancer rendition writes, `NATIVE_OUT_OF_SCOPE` everywhere.

## Preservation

**Native behavior kept:**
- the WebP/JPEG type selection;
- responsive selection;
- picture/source/img identity;
- whole-image contain presentation while the gallery is active;
- native account and page controls;
- native renditions everywhere outside Scope.

**Saved preferences:** `media.thumbQuality` keeps its value where it is inert, and applies again where supported.

**Reversibility guarantees:**
- dispose restores owned values, keeps native changes, is terminal for the disposed container, and leaves no enhancer presentation;
- explicit `gallery.init` and genuinely new containers still enhance.

**Accepted behavior changes (release note B3):**
- the Preview setting now leaves the native thumbnail;
- logged-in pages, other routes and non-pattern cards now stay native, where they were previously rewritten.

## Evidence

- Evidence record: `docs/implementation/IB08_V9R_EVIDENCE.md`.
- Probes, experiment, package and operator steps: `tests/browser/ib08/`, including `IB08_CONFORMANCE_VERIFICATION.json` and `IB08_CONFORMANCE_SHA256SUMS.txt`.
- Local suites and results: `tests/host/ib08/`.

All live evidence was sanitized in the browser, and the relayed summaries contain no URLs, IDs or screenshots.

## Provenance

No donor code was copied or translated. All changes are original to this repository (MIT).

## Failure / recovery

**Capability shutdown:** any card or page failing admission or the pattern keeps its native rendition, and the setting stays stored.

**Rollback:**
- revert `91fa86d`, `2765b9d` and `b2b1d9f` in reverse order;
- no user data depends on them;
- a reload is not needed for disposal to restore native renditions.

## Retained limitations (non-blocking)

- **Stale class tokens.** Under the unchanged IB04 whole-record rule, a card or image whose class the site rewrote keeps its owned token after dispose. This was observed on every card on both hosts. After `91fa86d` it carries no enhancer presentation (live D11), and it is reported, not hidden.
- **Container class.** If the site ever rewrote the gallery container's class, `be-gallery-grid` would survive dispose and the scoped rules would apply again. This was not observed live (`containerKeepsGalleryClass: false` on both hosts), and D11 would detect it.
- **Carried-forward rows.** S/P/O/L are carried forward from `4ac1e36`, as described above.
- **Runtime reporting.** Tampermonkey and Chrome versions and the DPR value were not relayed. Live request counting starts at the postamble; the local item 9 T1/T2 suite remains the startup request evidence.
- **Screenshot deviation.** The blueprint's viewport/DPR screenshots are replaced by sanitized structural traces, under the repository sanitation policy.
- **First-run C writes.** The first run's four off-card logged-in writes on e926 were never attributed to a source. They are proven not to come from the rendition path, and later runs attribute such writes by region.

## Gate transitions

| Gate row | Before | After |
| --- | --- | --- |
| G-RENDITION e621 logged-out `/posts` two-source WebP/JPEG pattern | OPEN | PASS(scope) (E stage and production conformance) |
| G-RENDITION e926 logged-out `/posts` two-source WebP/JPEG pattern | OPEN | PASS(scope), independently |
| G-RENDITION other routes, logged-in state, other patterns, media and hosts | OPEN | OPEN (they stay native) |
| G-RENDITION Danbooru rows | OPEN | EXCLUDED(scope) |

**Opened for later checkpoints:** layout and rendition premises for IB09 and IB12 on the qualified pattern. Pixiv pattern evidence remains a separate later scope.

## Outcome

**IB08 PASS(scope)** for the Scope above.

§3 IB08 item 10 acceptance:
- Actual responsive selection and native preference survive.
- The adapter declares source identity and cost provenance (the provenance enum; native `data-*` values only).
- A larger tile does not claim a sharper image; `currentSrc` relations are measured.
- Unsupported patterns remain native.
- Item 11: the stop condition is a native fallback with the setting kept, and reversibility is transparent, with no reload needed.

**Next eligible checkpoint:** IB09 — Still-image hover dwell and cost. Not started.
