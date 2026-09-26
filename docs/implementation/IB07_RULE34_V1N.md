# IB07 V1-N — Rule34.xxx native observation

**State:** listing/native strategy PASS; observed image-post native strategy PASS; video/GIF contexts OPEN  
**Account context:** user reported passive native browsing with enhancer/test scripts disabled; account state not independently verified  
**Observed listing route:** `https://rule34.xxx/index.php?page=post&s=list`

## Listing evidence

Three visible native cards were observed.

### Native card structure

All three observed cards had the same structural contract:

- native post link is the card wrapper itself: `<a id="p<postId>" href="/index.php?page=post&s=view&id=<postId>">...`;
- the thumbnail is a direct child `<img class="preview">`;
- post identity is available without network resolution from both:
  - anchor id `p<postId>`;
  - native href query parameter `id=<postId>`;
- thumbnail media is already present as the IMG `src/currentSrc`;
- observed thumbnail paths use `/thumbnails/.../thumbnail_<hash>.jpg?<postId>`;
- IMG `alt` contains native tag text;
- IMG `title` contains native tag text plus native score/rating text.

Observed public post IDs:

- 18867124
- 18867123
- 18867122

Observed intrinsic thumbnail dimensions:

- 250 × 141
- 208 × 250
- 208 × 250

These are thumbnail dimensions only. They are not evidence of original-media dimensions.

### Native pagination

A native next link was observed:

- href shape: `?page=post&s=list&pid=42`;
- element shape: `<a ... alt="next">&gt;</a>`.

Therefore Rule34 listing pagination exposes a native `pid` cursor/offset directly in the DOM. The meaning or page-size relationship of the value `42` is not inferred here.

## What V1-N establishes for the listing row

Observed present:

- card identity;
- native post href;
- thumbnail URL;
- native tags on IMG;
- native score/rating text on IMG title;
- thumbnail intrinsic dimensions;
- native next-pagination URL and `pid` value.

Still unknown from listing evidence:

- original/sample media URL;
- original dimensions;
- media byte size;
- authoritative media type beyond the thumbnail itself;
- favorite state/action;
- whether any missing field requires a request at all.

## Gate effect

The Rule34 **listing/native-facts** row has sufficient V1-N evidence to use these DOM facts directly.

No API/DAPI/HTML resolver is admitted by this observation. Rule34 post-page V1-N remains OPEN, and G-HOST remains OPEN until the exact post facts and any actually missing required fields are measured.


## Image-post observation

Observed native post:

- public post ID: `18867124`;
- native post route: `/index.php?page=post&s=view&id=18867124`.

### Main post media

The actual native post image is explicitly identified by:

- element: `<img id="image">`;
- rendered/sample media origin: `wimg.rule34.xxx`;
- sample path shape: `/samples/<bucket>/sample_<hash>.jpg?<postId>`;
- observed rendered intrinsic dimensions: 850 × 478.

The page also exposes an explicit native **Original image** link:

- origin: `wimg.rule34.xxx`;
- original path shape: `/images/<bucket>/<hash>.jpeg?<postId>`;
- link has native `Post.highres()` behavior.

Therefore, for this observed Rule34 image-post context, both sample and original media URLs are native DOM facts. No DAPI/API/HTML resolver request is needed merely to discover either URL.

### Broad-selector false positives

The passive capture also returned 300 × 250 `<video>` / `<source>` elements from another CDN. They are not identified by Rule34 as the post media and are outside the `#image` post-media contract. They are treated as unrelated page media/advertising and must not enter the Post model.

This is evidence that future extraction must prefer the host's exact native post-media selector over broad `video` discovery.

### Native metadata completeness

A second passive inspection of the same native post exposed the following visible metadata text:

- post ID: `18867124`;
- original dimensions: **1920 × 1080**;
- source: native source field present;
- rating: Explicit;
- score: 3 at observation time.

The rendered `#image` itself remains the 850 × 478 sample, while the native statistics block separately exposes the 1920 × 1080 original dimensions. These two dimension facts must not be conflated.

### Still unknown

This observation does **not** establish:

- original byte size;
- whether the original URL extension always reflects authoritative media type for every Rule34 post;
- video-post native structure;
- GIF/animated post native structure;
- favorite-state/action behavior.

Unknown byte size remains unknown; no request is justified merely to fill that optional field.

## Scoped G-HOST conclusion

For the exact observed logged-out/native Rule34 contexts:

- listing route `index.php?page=post&s=list`;
- image-post route `index.php?page=post&s=view&id=<id>`;

the **native-only strategy passes G-HOST** for the facts actually required here. The DOM already supplies identity, thumbnail/sample/original URLs, tags, rating/score/source, native pagination and original dimensions. No DAPI/API/HTML resolver is admitted or needed for those facts.

This PASS is deliberately scoped:

- Rule34 listing/native cards: PASS;
- Rule34 image-post native strategy: PASS;
- Rule34 video-post strategy: OPEN;
- Rule34 GIF/animated strategy: OPEN;
- Rule34 favorite/action strategy: OPEN;
- byte-size discovery: not admitted; remains UNKNOWN.
