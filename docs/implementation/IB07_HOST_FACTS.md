# IB07 — Current-host metadata, Post facts and scope corrections

**Checkpoint state:** ACTIVE — V1-N native observation pending  
**Production source blob:** `dc55026e11a14bd264b024d9727bb167c3873c1a`  
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
| Gelbooru.com | listing/post | OPEN — no dedicated V1-N record; post-level image/video observation is summarized only | `IB07_HOST_CAPABILITY_MATRIX.md` (`bb0c797`) |

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
