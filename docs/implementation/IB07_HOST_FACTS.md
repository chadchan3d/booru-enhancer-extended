# IB07 — Current-host metadata, Post facts and scope corrections

**Checkpoint state:** ACTIVE — V1-N native observation pending  
**Production source blob:** `069c412e4a813d90587649b74a7e40727cd85818`  
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
