# IB07 Host Capability Matrix

## Purpose

Record host capabilities only after direct observation. This document prevents assumptions from becoming adapter behavior.

## Rule34.xxx

### Observed

- Gallery cards observed.
- Native post IDs observed.
- Original media links observed.
- Image and video media contexts observed.
- Native metadata text observed.

### Admitted capability

- Native post media observation.
- Native gallery observation where directly tested.

### Not yet admitted

- Pagination automation.
- Mutation actions.

---

## e621 / e926

### Observed

- Native structured metadata attributes observed.
- Post IDs observed.
- Tags observed.
- Ratings observed.
- Dimensions observed.
- Preview/sample/original URLs observed.

### Admitted capability

- Native listing metadata observation.
- Native post metadata observation.

### Not yet admitted

- Mutation actions.
- Untested media contexts.

---

## Gelbooru

### Observed

- Native image element observed (`#image`).
- Native video player observed (`#gelcomVideoPlayer`).
- Original media links observed.
- Native tag list observed.
- Native statistics block observed.

### Admitted capability

- Native image post observation.
- Native video post observation.

### Not yet admitted

- Structured metadata enrichment.
- Pagination automation.
- Mutation actions.

## Adapter Rule

A host adapter must consume only facts demonstrated by observation. Unknown behavior remains native browser behavior.
