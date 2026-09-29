# IB07 — Current-host metadata, Post facts and scope corrections

**Checkpoint state:** PASS(scope), see `IB07_COMPLETION_RECORD.md`

**Production source blob:** `32d0051fe73505984066a5b69766b5eafc242bb9` (`9cade1a` plus the IB07 slot-inference restriction, Rule34 preview and site corrections, and the Post `pageCount` fact)

**Prior checkpoint:** IB06 PASS for active TC implementation path

## Controlling invariant

Native facts come first. Missing facts resolve only for an admitted need through a validated host/route/context strategy. Unknown remains unknown.

No host resolver may be implemented or wired until its exact G-HOST row passes.

## Source-only scope corrections already applied

Commit:

- `47423cebb0825c1dbadd0159e8dfc3a519be87db`

Changes:

- removed wildcard activation for `*.donmai.us`; explicit `danbooru.donmai.us` and `atfbooru.ninja` remain;
- removed current-phase activation for `rule34.us`;
- removed current-phase activation for `chan.sankakucomplex.com`;
- removed current-phase activation for `idol.sankakucomplex.com`;
- removed current-phase activation for `beta.sankakucomplex.com`;
- removed the generic adapter's broad favorite selector.

These are scope/safety corrections. They do not claim G-HOST and do not authorize any replacement resolver.

The corresponding broad `@connect` permissions have not been edited in this step. Match activation, not final release permission minimization, is the admitted IB07 scope correction. Final permissions remain subject to later release audit.

## V1-N priority

Run in this order:

1. Rule34.xxx
2. e621.net
3. e926.net
4. Gelbooru.com

For each host, collect:

- one native listing route;
- three visible native cards if available;
- one accessible native post reached from an observed card;
- actual identity/native-link facts;
- thumbnail/currentSrc and any native sample/original/poster candidates already present;
- dimensions/type/byte/count facts only when already exposed by the page;
- native pagination/next URL;
- account context label.

No endpoint probe is part of V1-N. No download for byte discovery. No favorite/action mutation. No automatic background enrichment.

## Current gate state

- G-OWN active TC path: PASS
- G-RUNTIME active TC request/storage subset: PASS
- G-SETTINGS active TC path: PASS
- G-REQUEST active TC path: PASS

G-HOST rows are scoped per host/route/context. The per-host V1-N record is authoritative for each row; this table only indexes them. All passes below are native-only: no endpoint is admitted.

| Host | Row | State | Record |
| --- | --- | --- | --- |
| Rule34.xxx | listing cards | PASS(scope: native-only) | `IB07_RULE34_V1N.md` (`bf836fe`) |
| Rule34.xxx | image post, logged-out/native context | PASS(scope: native-only) | `IB07_RULE34_V1N.md` (`dff90a9`) |
| Rule34.xxx | video post; GIF/animated post; favorite/action | OPEN | `IB07_RULE34_V1N.md` |
| e621.net | listing cards | PASS(scope: native-only) | `IB07_E621_V1N.md` (`5e9b1fb`) |
| e621.net | image post: core file/rendition facts, tag categories, source | PASS(scope: native-only) | `IB07_E621_V1N.md` (`47cccd3`; §"Category DOM observation" recorded in `c43378a`); production `c065308`, `8d3927e` |
| e621.net | video/GIF post; pagination continuation; favorite/action | OPEN | `IB07_E621_V1N.md` |
| e926.net | listing cards | PASS(scope: native-only) | `IB07_E926_V1N.md` (`26e5cc8`) |
| e926.net | image post: core Post facts | PASS(scope: native-only) | `IB07_E926_V1N.md` (`192b995`); production `b9ebaf3` |
| e926.net | video/GIF post; pagination continuation; favorite/action | OPEN | `IB07_E926_V1N.md` |
| Gelbooru.com | listing cards | PASS(scope: native-only) | `IB07_GELBOORU_V1N.md`; probe package `984e89f` |
| Gelbooru.com | image post, logged-out/native context: identity, sample/original URLs and dimensions, score; tag-row category classes and Source presence observed | PASS(scope: native-only; rating, byte size, tag names and Source value UNKNOWN) | `IB07_GELBOORU_V1N.md`; probe package `984e89f`; production `9cade1a`; live production conformance PASS(scope) |
| Gelbooru.com | video post; GIF/animated post | OPEN — not observed | `IB07_GELBOORU_V1N.md` |

No row is inferred from another host. e926 is not inherited from e621; Safebooru and other Gelbooru-family hosts are not inferred from Gelbooru.

## Production integration blocked

Until a specific G-HOST row passes:

- do not enable unverified API/HTML fallback for that row;
- do not infer e926 behavior from e621;
- do not infer Safebooru/other Gelbooru-family behavior from Gelbooru;
- do not import a generic HTML request budget;
- do not add credentials UI;
- do not add guessed CDN/extension fallback chains;
- do not restore Rule34.us or Sankaku;
- do not add generic favorite mutation.

Safeguard shutdown is allowed; replacement strategy is not.

## Evidence expected

The V1-N record must distinguish:

- observed present;
- observed absent;
- not visible / unknown;
- source-only candidate;
- account-context-dependent.

Signed or tokenized media URLs must not be committed. If a URL contains query credentials/signatures/tokens, record only origin/path and redact the query.

After V1-N, only the measured host/route/context rows become eligible for the bounded V1-X single-request strategy checks.


## Rule34 native-only strategy integration

Observed Rule34 image-post facts were sufficient to admit a native-only strategy for that exact context.

Commit:

- `8aaefeaf3abd6723aef48ee8bcfd49f53f9953b4`

Production source blob:

- `bd85dd1fcb515ecb5cfa6c62510528d43d9243b2`

The family adapter now:

- uses exact Rule34 native `img#image` only for the observed image-post context;
- uses the native **Original image** link for the original slot when present;
- uses the native statistics text for original width/height, source, rating and score;
- keeps byte size unknown;
- returns unknown rather than issuing unvalidated family DAPI/HTML requests;
- performs no family-wide thumbnail batch resolver request;
- exposes no family-wide favorite selector/action while action evidence is open.

Existing DAPI/HTML helper code remains in source as an evidence-gated candidate and was not deleted merely for cleanup.

This is a safeguard shutdown plus one scoped native extraction. It does not admit Rule34 video/GIF strategies or any Gelbooru/Safebooru/other family endpoint.


## e621 listing native-metadata integration

Passive V1-N on `https://e621.net/posts` observed three current native cards. Each card exposes identity, tags, rating, original extension, original dimensions, byte size, score/favorite count, MD5, preview/sample/original URLs and preview dimensions directly in `article.thumbnail` data attributes.

Evidence:

- `docs/implementation/IB07_E621_V1N.md`

Commit:

- `4918893ca5a7c626652e97068a9069a4f212955c`

Production source blob:

- `e4f169f6c3514c1555612142c32216b88f83aaec`

Production behavior now:

- e621 listing enrichment reads the observed native article attributes and performs no `/posts.json` request;
- e621 listing full-media slots and core metadata are cached from DOM facts;
- e926 receives no inherited native listing resolver until separately observed;
- e621/e926 favorite mutation remains unavailable pending action evidence;
- synthetic numeric pagination reconstruction is disabled; no `page=2` is invented from bare `/posts`;
- existing native next-link detection is retained, but no continuation was observed in V1-N and no synthetic fallback is admitted.

The current e621 post-page strategy remains OPEN until passive post markup is observed.


## e621 native image-post integration

Passive V1-N on `/posts/<id>` observed `#image-container[data-id]` carrying the same core file/rendition dataset as the listing card.

Commit:

- `3e44cbfebcb2b7331060c4680de7a59caf0f61e5`

Production source blob:

- `1f7c9669f6fcca4e128e51672788675ed7f0b291`

The e621 adapter now resolves the observed image-post core metadata natively from `#image-container`, with no endpoint request. It also attempts to read Source only from a native source anchor inside `#post-information`.

Category-specific tag arrays remain intentionally empty until the exact `#tag-list` DOM grouping is observed. The visible text proves categories exist, but that is not enough to justify guessed selectors.

e926 remains separate and unresolved.


## e621 native tag-category mapping

The post-page tag DOM was observed directly. Production now maps artist, character, copyright, general and meta tags from native `li[data-category][data-name]` rows. Species is a separate native e621 category; because the current Post model has no species slot, species remains represented only in `allTags` rather than being misclassified.

Commit:

- `c065308a0780d71d48b33dd5efad925190852fdf`

The speculative Source-element parser was removed. Source remains unknown until its exact native DOM structure is captured.


## e621 native image-post Source mapping

The Source row was observed as `#post-information li.source-links .source-link a[href]` and is now mapped directly.

Commit:

- `8d3927e72b9b51ebd9b9b1b495e11a5c1cc938e3`

The observed e621 image-post native strategy is now complete for core Post-model facts. It remains deliberately scoped away from video/GIF post structures, pagination continuation and favorite/action behavior.


## e926 listing native-metadata integration

Passive V1-N on `https://e926.net/posts` observed three current native cards carrying the same relevant native data-attribute classes of facts as measured directly on that host: identity, tags, rating, extension, original dimensions/bytes, MD5, preview/sample/original URLs, score/favorite count and flags.

Evidence:

- `docs/implementation/IB07_E926_V1N.md`

Commit:

- `5df9891e1f9e051aef0f9dc46f4f526541c6c021`

Production source blob:

- `207d79063e283f9918e4fc86225f9cedf45f4211`

Production behavior now:

- e926 listing enrichment consumes native card metadata with no endpoint request;
- e926 remains a distinct site ID;
- e926 post-page parsing remains blocked until separately observed;
- synthetic pagination remains disabled;
- favorite/action behavior remains unavailable pending evidence.

This admission is based on direct e926 observation, not inheritance from e621.


## e926 native image-post integration

Passive V1-N on `/posts/<id>` independently established the e926 native image-post contract.

Commit:

- `b9ebaf39ec0703fe7316285d8bb4e07d5deb243a`

Production source blob:

- `dc55026e11a14bd264b024d9727bb167c3873c1a`

Production now admits the observed e926 image-post native parser using `#image-container[data-id]`, native tag rows and native source links with no endpoint request.

e926 additionally exposed a contributor category and multiple source links. Contributor and species are retained only through `allTags` because the current Post model has no dedicated slots. The scalar `source` field retains the first native source link; IB07 does not expand the model to a source array.


## Gelbooru native image-post integration

Passive V1-N (`IB07_GELBOORU_V1N.md`) established the logged-out Gelbooru native image-post facts.

Commit:

- `9cade1a`

Production source blob:

- `0715587162f65324fc1f85adf40e7f490b4220b3`

Production now resolves a Gelbooru image post from the native page only, through `gelbooruNativeImagePost()` in the gelbooru-family `fetchPost`, after the Rule34 path:

- identity from the page's `id` parameter, which must match the requested id;
- site `gelbooru`, media kind `image`;
- sample from `img#image`;
- original from `li a[href*="/images/"]`; empty when that link is absent, never filled from the sample;
- original width, height and score from the native statistics text.

These stay unknown: rating, byte size, MD5, Source, date, preview and all tag arrays. Tag names are unknown because the tag-name element was not observed; Source is unknown because only its presence was observed.

The path returns nothing, leaving the page native, on any other host, on the listing route, on an id mismatch, when `img#image` is missing, when any `<video>` element is present, or when the media is not an image. It makes no request. The candidate DAPI/HTML helpers are retained unchanged and uncalled. The family `fetchThumbBatch` still returns nothing, and `getGalleryContainer` is unchanged.

Implementation test: `tests/host/ib07/gelbooru_native_post.cjs` (14 cases).

### Live production conformance

**PASS(scope: logged-out native Gelbooru image post, production body `9cade1a`)**, in Tampermonkey × Chrome. Package `tests/browser/ib07/` (commit `2e83c33`); result `tests/browser/ib07/TC_PRODUCTION_RESULT_SUMMARY.json`.

- C00: the browser executed the exact `9cade1a` production body (`MATCH_9CADE1A`), established in-browser by hashing the executed production wrapper's source text.
- C01–C14: all PASS. The route qualified, the adapter activated, and the Gelbooru minimal Post was produced with correct identity, site, kind, sample, original, dimensions and score. Sample and original stayed distinct, and no original was fabricated. Unobserved fields stayed unknown. No video element was present, so the video guard did not disable the path. No enhancer request was counted while producing the Post or during the observation window.

Request-observation limitation: a request issued synchronously during production startup, before the postamble loaded, would not itself be counted. Queue and in-flight counts were zero at postamble load, which shows that nothing was still pending then; it does not prove that no such request occurred.

Not tested: video/GIF, pagination, hover, favorite/action, download, rendition policy, other Gelbooru-family hosts. Manager and browser versions were not relayed.

## Slot-inference restriction

Production blob: `30cadd68ebc6ca357a029ebdf1cfb028f081ee7b`.

- Rule34 native image post: without a native original link, the original slot stays empty (it was the sample URL).
- e621/e926 native cards and post containers: without `data-sample-url`, the sample slot stays empty (it was the file URL).

The shapes are NOT OBSERVED LIVE (`IB07_SLOT_PROVENANCE_EVIDENCE.md`). No request, selector or other slot changed.

Gelbooru live production conformance is reused on the diff basis recorded there: neither changed line is reachable on gelbooru.com, and a harness check old vs new shows an identical Post and 0 requests. Rule34, e621 and e926 production conformance remains OPEN_NOT_RUN.

## Rule34 preview slot

Production blob: `2011b22b58e9a36a6cebed7aba71c88f7fdd7fd0`.

`rule34NativeImagePost` no longer sets `previewUrl` from the sample. The preview is the thumbnail slot: §3 item 10 lists thumbnail, sample, original and poster as distinct optional facts, and production's own `media.thumbQuality` choices name preview, sample and original as separate renditions. A Rule34 post page exposes no native preview, so the slot stays unknown, as it does on Gelbooru.

No code documents the preview as an alias of the sample. Every consumer uses it either as a later fallback after the sample and original (viewer, open, media URL, reverse search) or as a video poster. In the old-vs-new harness check each of these resolves to the same URL, and requests are 0 in both.

Item 9 `G3-3f-rule34.xxx` asserts that the preview stays unknown; restoring `previewUrl: sampleUrl` makes it FAIL.

## Post `siteId`: canonical site identity (decided)

Operator decision (option a): for IB07-qualified hosts, `siteId` is the canonical site identity, not the adapter/family label. Rule34 Posts now carry `rule34` (was `gelbooru-family`). Production blob: `664bfe6366f03a6b1a27611087bcd6a91f2618f0`.

This matches the existing qualified slugs `e621`, `e926` and `gelbooru`. The adapter id, family routing and policies, and legacy adapters' values are unchanged. No production code reads `siteId`. Exact browser host and route are still proven separately by conformance checks C01/C02.

Item 9 `G2-SITE-rule34.xxx` asserts `rule34`; restoring the family label makes it FAIL. Old vs new in the harness: the Rule34 Post differs only in `siteId`, the e621, e926 and Gelbooru Posts are identical, and requests are 0.

## Gelbooru conformance reuse (reassessed)

Since the Gelbooru-conformed body, production has changed only in host-gated code:
- the two slot-restriction lines (Rule34 parser; e621/e926 normalizer);
- one Rule34 preview line and one Rule34 `siteId` line in `rule34NativeImagePost`, after its rule34.xxx hostname gate.

None of these is reachable on gelbooru.com. In the harness, old vs new on a Gelbooru post gives an identical Post. The live Gelbooru PASS(scope) remains reusable on this diff basis.

## Rule34 / e621 / e926 live production conformance

**PASS(scope: logged-out native listing and ordinary image post; production commit `5064dfd`, blob `664bfe6366f03a6b1a27611087bcd6a91f2618f0`)**, 6 of 6 runs, 0 failed checks.

- Package: `tests/browser/ib07/IB07_R34E6_Production_Conformance.user.js` (builder `build_r34e6_conformance.cjs`, verifier 57/57).
- Result: `tests/browser/ib07/TC_R34E6_PRODUCTION_RESULT_SUMMARY.json`.
- Every run: C00 `MATCH_EXPECTED_ARTIFACT`; host/context and adapter PASS; no enhancer request during Post production or during the postamble window.

Per host:
- **Rule34:** listing, 42 cards, 0 identity mismatches, no Post guessed. Image post: sample = native `img#image`; original = native link target; Statistics dimensions; preview and other unobserved fields unknown; `siteId` `rule34`; native page untouched.
- **e621:** listing, 75/75 Posts, 0 mismatches, sample absent/empty 0. Image post: all checks PASS.
- **e926:** independently, listing 75/75 Posts, 0 mismatches, absent/empty 0. Image post: all checks PASS.

Request limitation: a request issued synchronously during startup before the postamble loaded is not counted live. Fully instrumented startup and hover evidence is the local item 9 T1/T2 suite.

## Gelbooru gallery-container caveat: disposition A (does not block)

Production starts the gallery module (card enhancement, startup enrichment, hover) only when `getGalleryContainer()` finds a container, both at init and on mutation re-init. On the observed live Gelbooru listing none of `#post-list-posts`, `#post-list`, `.content` matched (`IB07_GELBOORU_V1N.md`), so no gallery behavior is enabled there. The qualified live Gelbooru scope is the native image post (production conformance PASS) plus the listing's native facts, which production does not act on.

If a page ever did match a candidate container, the enabled G-HOST paths still build no Post and make no metadata request: the family `fetchThumbBatch` returns nothing, and `fetchPost` returns null on the listing route. Item 9 case B proves this locally with zero requests. Grid layout and hover beyond metadata belong to later gates. The fixture therefore covers fail-closed behavior only, not an unqualified enabled capability.

## §6 excluded-host row: satisfied

Row "rule34.us and three Sankaku matches" (§3 item 8; validation "Exclusion fixtures including idol; release note"):

- **Explicit removal:** `@match` activation was removed in `47423ce`.
- **Exclusion fixtures including idol:** `tests/host/ib07/exclusion_assertions.cjs`, result `exclusion-result.json`, runs against the committed production userscript. 8/8 PASS, 9/9 controls:
  - X1: rule34.us, chan, idol and beta are each not admitted by `@match`. Idol is tested independently: adding only chan and beta does not admit it.
  - X2: there is no `@include`.
  - X3: all 15 admitted hosts resolve to a dedicated adapter, so the generic adapter is never selected, and it has no action members.
  - X4: no production code names an excluded host. Only three `@connect` permissions remain, left to the release audit.
- **No generic actions:** X3.
- **Stored preferences remain:** P1. Startup on rule34.xxx and e621.net deletes or changes none of the seeded preferences, including unknown legacy keys; a startup-deletion mutant is caught. Settings are per-script (`be:setting:*`), not per host, and store deletion happens only inside a user-initiated settings import.
- **Release note:** `CHANGELOG.md` §"Unreleased — Host scope changes".

## Post `pageCount` fact (count blocker resolved in production)

Operator contract decision:

    pageCount: null | positive integer
    null = unknown / not established
    1    = known single-item Post
    0 is not the unknown sentinel; unknown never silently becomes 1

Production blob `32d0051fe73505984066a5b69766b5eafc242bb9`:
- `emptyPost` now has `pageCount: null`.
- `pageCount: 1` is set only by the qualified single-item producers:
  - `rule34NativeImagePost`;
  - `gelbooruNativeImagePost`;
  - `normalizeE621NativeElement`, the single native producer for e621/e926 listing cards and post containers, whose observed contract exposes one `data-file-url` per post.
- Unqualified or unreachable producers stay `null`: danbooru, the Gelbooru candidate helpers, moebooru, the uncalled legacy `normalizeE621`, and generic.
- Rule34 and Gelbooru listings still build no Post.

Merge and cache semantics are unchanged:
- `viewer.updatePost` replaces the placeholder (null) with the producer Post for the same id;
- `resolveOriginalUrl` spreads the existing Post;
- the post cache stores producer Posts by replacement;
- nothing reads or coerces `pageCount`.

Tests: `tests/host/ib07/pagecount_assertions.cjs` (`pagecount-result.json`), 11/11 PASS with 8 controls. Removing the field, defaulting to 1, leaving each producer null, and a cache overwrite are all caught. All other Post facts are identical to the previous artifact, and requests are 0.

**Exact-artifact production conformance is reopened.** The shared Post shape changed on every qualified host, including Gelbooru. The earlier live runs remain historical evidence for their artifacts (Rule34/e621/e926 at `5064dfd`; Gelbooru at `9cade1a`). Final conformance needs reruns against `32d0051`.

## Exact-artifact production conformance (final)

Final live conformance on commit `c551bb0` (blob `32d0051fe73505984066a5b69766b5eafc242bb9`), 7/7 PASS with 0 failed checks and C00 matched on each:
- Rule34 listing (42 cards) and image post (`siteId` `rule34`, `pageCount` 1);
- e621 listing (72/72 Posts, `pageCount` 1) and image post;
- e926 listing (74/74 Posts, `pageCount` 1) and image post;
- Gelbooru image post (16/16 checks, `pageCount` 1).

Results: `tests/browser/ib07/TC_R34E6_PRODUCTION_RESULT_SUMMARY_C551BB0.json`, `TC_GELBOORU_PRODUCTION_RESULT_SUMMARY_C551BB0.json`. The earlier runs on `5064dfd` and `9cade1a` remain historical evidence for those artifacts. The request-observation limitation is retained as recorded there.
