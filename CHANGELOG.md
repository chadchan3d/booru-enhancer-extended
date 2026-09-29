# Changelog

## Unreleased — Host scope changes

- Booru Enhancer no longer activates on **rule34.us**, **chan.sankakucomplex.com**, **idol.sankakucomplex.com** or **beta.sankakucomplex.com**. None of these sites has a separately validated adapter or behavior in this release scope. On those sites, pages load without the enhancer.
- **rule34.xxx** is unaffected and remains supported.
- Your stored preferences are kept. Settings are shared across all sites, and removing these sites does not erase or reset any saved value.

## 1.2.7.3 — Rule34 loading and settings UX

- Defer Rule34.xxx gallery metadata enrichment until hover/click instead of batch-fetching the full gallery at startup.
- Deduplicate in-flight per-post metadata requests so hover and click share the same work.
- Add delayed **Loading video…**, **Buffering…**, and failure states to hover and fullscreen video playback.
- Keep the existing thumbnail/poster visible while slow media resolves.
- Remove settings with no runtime behavior: original-media mode, never-upscale, Tags, Filters, Toggle viewer, and Command palette.
- Reduce **Open original in** to the two behaviors currently implemented: New tab and Popup window.
- Keep **Grid thumbnail quality** and present select choices with user-facing labels.
- Make settings sections collapsible, show slider values with units, and make the settings theme/accent/toolbar position update live.
- Add the settings footer: **Extended by ChadChan3D · chadchan3d.com/assets/**, linked directly to the canonical assets URL.

## 1.2.7.2 — Fullscreen viewer correction

- Open the viewer from cached/full metadata immediately when available.
- Prefer original media over sample/preview media in fullscreen.
- Rebuild the media element when enrichment changes the type from image placeholder to video.
- Implement real fit-both, fit-width, fit-height, and original-size scaling against the viewer stage.
- Make **Fit** restore configured fit behavior and **1:1** display native pixel size.
- Preserve thumbnail-first fallback only when full metadata is not yet available.

## 1.2.7.1 — Booru Enhancer Extended

Initial public compatibility-fork release based on upstream Booru Enhancer 1.2.7.

### Rule34.xxx

- Target the actual gallery container rather than the broader page container.
- Force enhancer grid layout where native site styles previously overrode it.
- Make thumbnail-size, column-count, and gap controls visibly effective.
- Clamp fixed-column layouts to available viewport width instead of overflowing horizontally.
- Add responsive large-media hover previews with muted autoplay video.
- Show the already-loaded thumbnail immediately, then replace it with better media after loading.
- Prioritize the currently hovered media and cancel stale hover loads where practical.
- Suppress the site's native tag/text thumbnail tooltip when enhancer hover is active.

### e621 / e926

- Support current `article.thumbnail` gallery markup and current thumbnail metadata attributes.
- Scale nested `a.thm-link`, `picture`, image, and footer elements with enhancer thumbnail sizing.
- Use current preview/sample/original media metadata.
- Add responsive image/video hover preview behavior matching Rule34.xxx.
- Suppress the native tag/text hover overlay on enhanced thumbnails.

### Shared reliability

- Share gallery metadata with hover instead of duplicating independent caches.
- Leave failed/missing metadata IDs retryable rather than permanently marking them complete.
- Enrich newly inserted infinite-scroll thumbnails consistently.
