# IB07 V1-N — Rule34.xxx native observation

**State:** listing observation PASS; post observation OPEN  
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
