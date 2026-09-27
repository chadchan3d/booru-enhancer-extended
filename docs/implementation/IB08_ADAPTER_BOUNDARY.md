# IB08 Adapter Boundary

## Purpose

Establish the boundary before adding additional host-specific production behavior.

The existing production architecture already contains a host adapter registry (`BE.adapters.registry`) with per-host responsibilities. IB08 records the invariant that host support must enter through that boundary rather than by adding scattered host checks throughout gallery, viewer, or network modules.

## Adapter responsibilities

An adapter may define:

- host detection
- post-page detection
- post identity extraction
- thumbnail discovery
- thumbnail wrapper ownership
- gallery container discovery
- native post extraction
- native pagination observation

## Non-responsibilities

Adapters do not directly own:

- viewer behavior
- download behavior
- settings behavior
- ownership cleanup
- request retry policy
- global UI lifecycle

## Current admitted host evidence

### e621/e926

Status: native structured evidence admitted.

Observed capabilities:

- post identity
- media URLs
- dimensions
- tags
- ratings
- sources

### Rule34.xxx

Status: scoped native evidence admitted.

Observed capabilities:

- listing identity
- post media
- original links
- native metadata text

### Gelbooru

Status: native limited evidence admitted.

Observed capabilities:

- image post media
- video post media
- original media links
- tag-list categories
- statistics text

## IB08 invariant

Future host work must:

1. add or modify an adapter boundary;
2. preserve existing host behavior;
3. avoid broad generic selectors replacing proven site contracts;
4. avoid adding network enrichment where native evidence is sufficient;
5. retain unknown fields rather than inventing model mappings.

## Exit criteria

IB08 is complete when:

- adapter routing is documented;
- a host adapter can be tested independently;
- unsupported host behavior remains unchanged;
- production changes are covered by conformance evidence.
