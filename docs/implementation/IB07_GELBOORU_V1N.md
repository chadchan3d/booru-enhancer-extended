# IB07 V1-N — Gelbooru.com native observation

**State:** listing/native identity and thumbnail facts PASS; observed image-post native facts PASS; rating UNKNOWN; video/GIF contexts not observed  
**Account context:** logged out; enhancer and userscripts disabled; passive native page  
**Probe:** `tests/browser/ib07/IB07_Gelbooru_V1N_Probe.js` revision 2 (package commit `984e89f`), read-only, sanitized in the browser before output  
**Evidence:** two sanitized probe JSON blocks (listing, image post) returned by the operator. Revision 1 output is superseded and not used: it failed sanitation.

## Listing evidence

Observed listing route: `index.php?page=post&s=list` with a `tags` parameter.

### Cards

- The probe's candidate thumbnail selectors matched **42** thumbnail images.
- Three cards were inspected. All three resolved identity by the same strategy: the enclosing link's `id` query parameter (`href-id-param`).
- Thumbnail URL shape on all three: `/thumbnails/<bucket>/<bucket>/thumbnail_<hash>.jpg`.
- The thumbnails are served from an origin other than the page's origin. The host was not recorded.
- The thumbnail IMG carries non-empty `alt` and `title` text on all three cards. The text was not recorded.

The probe tested thumbnail selectors as one combined list, so which individual selector matched is not recorded.

### Gallery container

None of the tested container selectors (`#post-list-posts`, `#post-list`, `.content`) matched. This records only that those selectors do not identify the container. It is not evidence that no native gallery structure exists.

### Native pagination (observed only)

- A native next link matched `#paginator a[alt="next"]`.
- Its query parameters are `page`, `s`, `tags` and `pid`.

This is recorded as an observed host fact only. Continuation and append qualification belong to G-PLACE-T / IB12.

### Not established by listing evidence

- sample or original media URL on the card;
- original dimensions, byte size or media type beyond the thumbnail;
- tag categories, rating or score on the card.

## Image-post evidence

Observed route: `index.php?page=post&s=view` with an `id` parameter. The post was reached from the listing. Post identity is available from the page's own `id` query parameter.

### Main post media

- `#image` matched; the rendered media is an image.
- Rendered sample URL shape: `//samples/<bucket>/<bucket>/sample_<hash>.jpg`. The leading double slash is part of the observed path.
- Rendered sample intrinsic dimensions: **850 × 1202**.
- Served from an origin other than the page's origin. The host was not recorded.

### Original media

- A native original link matched `li a[href*="/images/"]`. The candidates `a.download-link` and `a[download]` did not match.
- Original URL shape: `/images/<bucket>/<bucket>/<hash>.png`.
- The native statistics text gives original dimensions **1448 × 2048**.

The sample (850 × 1202, JPG) and the original (1448 × 2048, PNG) are distinct renditions with different dimensions and extensions. They must not be conflated, and original bytes must never be assigned to the sample slot.

### Tags

- 93 tag rows matched the candidate tag selectors.
- Category classes observed on those rows: `tag-type-artist`, `tag-type-character`, `tag-type-copyright`, `tag-type-general`, `tag-type-metadata`.
- None of the numeric `category-N` class patterns tested by the probe were observed.

The observed category classes map to the Post model's artist, character, copyright, general and meta fields.

### Statistics text

- Size field present: 1448 × 2048 (see Original media).
- Score field present: 0 at observation time.
- Date field present. The value was not recorded.
- Source field present. It is displayed **without a scheme**, and its path shape is `/artworks/<id>` on an external host. The host was not recorded.

A production parser must not assume a Source value carries a scheme.

### Rating

The probe's rating selector (`[id*="rating"]`) did not match, and no rating value was detected. Rating is **UNKNOWN** from this evidence. This is not evidence that the page lacks a rating.

### Account context

On this logged-out public page, the probe detected no login-shaped link and no element whose class or id contains `user`. These are logged-out observations only. They are not evidence about account features.

### Not established by post evidence

- original byte size (not probed);
- rating value;
- which hosts serve thumbnail, sample and original media;
- video post structure: `videoSelectorMatched` was false on an **image** post, which is not evidence about video posts;
- GIF/animated post structure;
- favorite or action behavior.

## Scoped G-HOST conclusion

For the exact observed logged-out native Gelbooru contexts:

- listing route `index.php?page=post&s=list`;
- image-post route `index.php?page=post&s=view&id=<id>`;

a **native-only strategy passes G-HOST** for the facts observed here:

- listing: card identity from the native link and the native thumbnail URL;
- image post: identity, sample URL, original URL, sample and original dimensions, original extension, categorized tags, score and Source presence.

No DAPI, API or HTML resolver is admitted or needed for those facts. No endpoint was probed, so the key-required API path was not touched.

This PASS is deliberately scoped:

- Gelbooru listing/native cards: PASS;
- Gelbooru image-post native facts: PASS;
- rating: UNKNOWN (not detected);
- byte size: UNKNOWN (not probed);
- video and GIF/animated post facts: not observed; they remain open for the host-fact record, and hover-video qualification belongs to G-VIDEO / IB10;
- pagination continuation: observed only; qualification belongs to G-PLACE-T / IB12;
- favorite/action: not observed; belongs to G-ACTION / IB14.

This record does not infer Safebooru or any other Gelbooru-family host behavior.

## Production status

This is an evidence record. Production does not yet consume these facts:

- `Booru_Enhancer.user.js:2009-2016`: the family adapter's `fetchPost` returns native facts only through the Rule34-specific parser, so a Gelbooru post currently resolves to no Post.
- `Booru_Enhancer.user.js:2007`: the family `getGalleryContainer` uses the three container selectors that did not match on the observed listing.

Wiring a Gelbooru native-only image-post strategy is remaining IB07 P-stage work. It is not established by this record.
