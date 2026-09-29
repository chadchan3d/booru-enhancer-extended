# IB08 V9-R native rendition baseline probe

**IB08 G-RENDITION evidence preparation only.** This probe records how the native e621 and e926 listing pages choose and display thumbnail renditions, before any enhancer change. It is not a gate result, and it does not test or change production.

## What the probe does

`IB08_V9R_Baseline_Probe.user.js` is a read-only Tampermonkey script. It runs only on e621.net and e926.net, and adds three menu commands:
- Capture A;
- Capture B;
- Show last result.

Capture A records up to 6 visible listing cards (`CARD_01`…) and keeps references to their card, `img`, `picture` and `source` nodes **in memory only**. Capture B, taken after the window has been narrowed, reads the same nodes again. Capture B's result reports, for each card:
- whether the card, `img`, `picture` and `source` nodes are the same objects in A and B;
- whether the `img` is inside a `picture`, and the number of `source` elements;
- whether `src`/`srcset`/`sizes` exist on the `img`, and whether `srcset`/`sizes`/`media` exist on each `source`, plus its image type;
- the srcset candidate count and descriptor kind, with no URLs;
- rendered and natural dimensions, `object-fit`, and whether the image finished loading;
- a relation label for `currentSrc` in A and in B, and whether it changed.

It also records viewport width, height and device-pixel ratio for both conditions.

### Relation labels

Relation labels compare the displayed image with the native facts in memory:
- `NATIVE_PREVIEW`, `NATIVE_PREVIEW_WEBP`, `NATIVE_SAMPLE` and `NATIVE_FILE` refer to the card's native data attributes;
- `IMG_SRC` refers to the `img` element's `src`;
- `IMG_SRCSET_CANDIDATE_<n>` and `SOURCE_<k>_SRCSET_CANDIDATE_<n>` refer to srcset candidates;
- `OTHER_SAME_ORIGIN` means an unmatched URL on the page's own origin;
- `UNKNOWN` means the facts do not establish which rendition is shown. This covers a missing image, an empty `currentSrc`, an unparsable srcset or an unmatched URL.

When a URL matches several labels, the first is reported as the relation and all of them are listed. The probe never judges sharpness from tile size.

### What the probe never does

The probe never:
- writes attributes or replaces or moves nodes;
- clicks, navigates or requests anything;
- touches storage, cookies or preferences.

Its only DOM change is its own result overlay on `document.body`.

Output contains only ordinals, booleans, counts, dimensions, enums and labels. A built-in guard withholds the whole result (`sanitationGuard: BLOCKED`) if any raw captured value would be printed. Blocked values include post IDs, URLs, hashes and query strings.

## Local verification

```
node tests/browser/ib08/verify_v9r_baseline_probe.cjs
```

It needs the pinned jsdom from `tests/host/ib07` (`npm install` there once). It writes `V9R_BASELINE_VERIFICATION.json`.

## Operator steps

Use Chrome with Tampermonkey. DevTools is not needed. Do not send screenshots, URLs or post IDs.

### Setup (once)

1. In Tampermonkey, **disable the normal Booru Enhancer** and every other userscript for e621 and e926.
2. Install the probe: Tampermonkey → Create a new script → replace everything with the full contents of `tests/browser/ib08/IB08_V9R_Baseline_Probe.user.js` → Save. Make sure it is enabled.

### e621

1. Log out of e621, or use a window where you are not logged in.
2. Maximize a normal (wide) browser window. Open `https://e621.net/posts` directly (no search terms needed) and wait for the thumbnails to finish loading. Do not scroll.
3. Tampermonkey icon → **IB08 baseline: Capture A (wide window)**. A result box appears saying `A captured`. Click **Close**.
4. Without reloading or scrolling, make **the same window** clearly narrower, e.g. drag its edge to about half the screen width. Wait about 5 seconds.
5. Tampermonkey icon → **IB08 baseline: Capture B (after narrowing) and show result**. Wait for the result box, a few seconds.
6. The text is already selected. Copy it (Ctrl+C) and save it as `e621` result JSON. Check that `site` is `e621.net`, `viewportNarrowed` is `true` and `enhancerMarkersPresentAtA` is `false`.

If you reload the page, start again from step 2, because captures are held in memory only.

### e926

Repeat the e621 steps on `https://e926.net/posts`, in a fresh load of that page, logged out. Check that `site` is `e926.net`. e926 is a separate run; do not reuse the e621 result.

### Return

Return the two sanitized JSON results (e621 and e926). If a result says `sanitationGuard: BLOCKED`, return it as it is and do not send anything else from that page.

---

# IB08 V9-R reversible ownership experiment

**IB08 E-stage evidence only.** `IB08_V9R_Ownership_Experiment.user.js` is an isolated Tampermonkey script, separate from production, for e621.net and e926.net. It tests whether one owned rendition change can be applied and then disposed without disturbing native nodes, native edits or native responsive selection. The design and expected outcomes are in `docs/implementation/IB08_V9R_EVIDENCE.md` §2.

## What the experiment does

It picks five listing cards that match the observed pattern:
- a `picture` with a WebP `source` and a JPEG `source` and an `img`;
- single-candidate srcsets;
- no `sizes` or `media`.

On each card it changes **one attribute**: the WebP source's srcset, set to that card's own native sample. It then simulates five native situations, one per card:
- no change;
- a native edit;
- a moved source;
- a replaced source;
- a replaced picture.

It then disposes its change and, after you narrow the window, checks the result. Cards that do not match the pattern are never touched.

The experiment itself makes no requests, and never touches storage, cookies or account data. Because the srcset changes, the browser loads each of the five cards' own sample images, and one or two native previews, as ordinary image loads. The output is sanitized in the same way as the baseline probe, and a leak guard withholds it if needed.

## Local verification

```
node tests/browser/ib08/verify_v9r_ownership_experiment.cjs
```

## Operator steps

Use Chrome with Tampermonkey. DevTools is not needed. Do not send screenshots, URLs or post IDs.

### Setup

1. In Tampermonkey, keep the **normal Booru Enhancer disabled**. **Disable the IB08 V9-R baseline probe** and every other userscript for e621 and e926.
2. Tampermonkey → Create a new script → replace everything with the full contents of `tests/browser/ib08/IB08_V9R_Ownership_Experiment.user.js` → Save. Make sure it is enabled.

### e621

1. Log out of e621, or use a window where you are not logged in.
2. Maximize a normal (wide) window. Open `https://e621.net/posts` directly and wait for the thumbnails to finish loading. Do not scroll.
3. Tampermonkey icon → **IB08 ownership: Step 1 (wide window)**. Wait up to about 30 seconds for the box saying `Step 1 done`, then click **Close**.
   - If the box says `INSUFFICIENT`, copy and return it as it is; the page was not changed.
4. Without reloading or scrolling, make **the same window** clearly narrower, e.g. about half the screen width. Wait about 5 seconds.
5. Tampermonkey icon → **IB08 ownership: Step 2 (after narrowing) and show result**. Wait for the result box.
6. Copy the text (Ctrl+C) and save it as the e621 result. Check that `site` is `e621.net` and `viewportNarrowed` is `true`, and note `experimentVerdict`.

Step 1 runs once per page load. To repeat, reload the page and start again from step 2.

### e926

Repeat the e621 steps on a fresh load of `https://e926.net/posts`, logged out. Check that `site` is `e926.net`. Do not reuse the e621 result.

### Afterwards

Disable the experiment script in Tampermonkey. Return the two sanitized JSON results. If a result says `sanitationGuard: BLOCKED`, return it as it is and nothing else from that page.
