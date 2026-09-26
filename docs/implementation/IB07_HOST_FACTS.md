# IB07 — Current-host metadata, Post facts and scope corrections

**Checkpoint state:** ACTIVE — V1-N native observation pending  
**Production source blob:** `1f7c9669f6fcca4e128e51672788675ed7f0b291`  
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
- G-HOST Rule34 listing/post: OPEN
- G-HOST e621 listing/post: OPEN
- G-HOST e926 listing/post: OPEN
- G-HOST Gelbooru listing/post: OPEN

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

Passive V1-N on `/posts/6736194` observed `#image-container[data-id]` carrying the same core file/rendition dataset as the listing card.

Commit:

- `3e44cbfebcb2b7331060c4680de7a59caf0f61e5`

Production source blob:

- `1f7c9669f6fcca4e128e51672788675ed7f0b291`

The e621 adapter now resolves the observed image-post core metadata natively from `#image-container`, with no endpoint request. It also attempts to read Source only from a native source anchor inside `#post-information`.

Category-specific tag arrays remain intentionally empty until the exact `#tag-list` DOM grouping is observed. The visible text proves categories exist, but that is not enough to justify guessed selectors.

e926 remains separate and unresolved.
