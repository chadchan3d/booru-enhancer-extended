# IB07 Gelbooru production conformance

This is the §11 step 6 production-conformance run for the Gelbooru native image-post path, rebuilt against production commit `c551bb0` (which adds the Post `pageCount` fact). An earlier build against `9cade1a` was run live and is kept as historical evidence for that artifact. It covers **IB07 G-HOST only**: a logged-out Gelbooru image-post page with the production enhancer running.

It does not test video/GIF, pagination, hover, favorite/action, downloads, rendition policy or other Gelbooru-family hosts.

## What the script is

`IB07_Gelbooru_Production_Conformance.user.js` follows the IB06 production-conformance convention:

- the production body of commit `c551bb0`, byte-for-byte, run once inside a named wrapper function (the body is a single self-running function, so the wrapper does not change what it does);
- a separate userscript identity, so it uses its own storage and never reads your normal Booru Enhancer settings;
- `@match` and `@connect` narrowed to `gelbooru.com`;
- no update URL, so Tampermonkey can never replace it with the published build;
- an appended test postamble with two menu commands.

The postamble is read-only. It clicks nothing and makes no request of its own. It checks, inside the browser, that the production body it is running is exactly the expected production body (check C00). It does this by hashing the source text the browser holds for the wrapper function that actually ran production. Tampermonkey does not expose a script's full source through `GM_info`, which is why the first run reported C00 as `UNAVAILABLE`. Its result contains only booleans, counts, check statuses, dimensions and score. It never contains post IDs, URLs, hosts, hashes, tag text, sources, dates or account data.

## Before you start

1. Use Chrome with Tampermonkey.
2. **Log out** of Gelbooru.
3. In the Tampermonkey dashboard, **disable** your normal Booru Enhancer script and any other userscripts for gelbooru.com. Two copies of the enhancer on one page would invalidate the run.

## Install the test script

1. Open `IB07_Gelbooru_Production_Conformance.user.js` in a plain text editor. Select all and copy.
2. Tampermonkey dashboard → **+** (create a new script) → replace everything in the editor with what you copied → **File → Save** (Ctrl+S).
3. Confirm it's listed as `Booru Enhancer Extended — IB07 Gelbooru Production Conformance` and is enabled.

Check C00 confirms the source. If the pasted copy differs from the expected production body in any way, C00 reports `MISMATCH`.

## Run

1. Open an ordinary **image** post on Gelbooru directly: the post page, whose URL contains `page=post&s=view`. Reload it once after installing the script.
2. Wait for the image to finish loading. **Don't hover, click or open anything the enhancer adds.** Interaction could start requests unrelated to this check.
3. Click the Tampermonkey icon → **IB07P: Run Gelbooru production conformance**.
4. The run waits about 5 seconds to watch for requests, then shows a result window.
5. Copy the entire JSON from the window.

If you close the window, use **IB07P: Show/export last result**.

## What to send back

- The complete result JSON, unedited.
- Confirmation that you were logged out.
- Whether the post was an image post.

Send nothing else: no screenshots, URLs or post numbers.

## Expected result shape

```
{
  "probe":           { "name", "version", "productionVersion" },
  "environment":     { "userAgent", "gmInfo": { "scriptHandler", "version" } },
  "sourceContract":  { "productionCommit": "c551bb0", "productionBodyIdentity", "metadataChange" },
  "summary":         { "checks", "failed", "status" },
  "checks":          [ { "id": "C00".."C14", "name", "status", "detail" } ],
  "observations":    { "route", "activation", "outcome", "fetchError", "guards", "postFacts", "requests" },
  "boundaries":      { ... }
}
```

The checks:

| Check | Question |
| --- | --- |
| C00 | Is the browser running the exact expected production body? |
| C01 | Is this the qualified route (gelbooru.com image post with an id)? |
| C02 | Does production activate the gelbooru-family adapter on the post page? |
| C03 | Does it produce the Gelbooru minimal Post rather than returning nothing? |
| C04 | Does identity come from the page id and agree with the route? |
| C05 | Is the site gelbooru and the media kind image? |
| C06 | Is the sample taken from the native image? |
| C07 | Is the original taken from the native original link? |
| C08 | Do sample and original stay distinct when the page shows distinct files? |
| C09 | Is the original never fabricated from the sample? |
| C10 | Do original dimensions and score reach the Post from the page statistics? |
| C11 | Do rating, byte size, MD5, Source, date, preview and tags stay unknown? |
| C12 | Does the fail-closed video check leave the image path working in your browser? |
| C13 | Is no enhancer request made while the Post is produced? |
| C14 | Is no enhancer request made from load through the observation window? |
| C15 | Does the Post record the known single-item count (`pageCount === 1`)? |

A FAIL is evidence, not an error to fix before sending. Send the result as it is.

## Known limitation

Production starts up before the postamble loads. A request issued synchronously during that startup would not be counted. `observations.requests.netAtPostambleLoad` shows whether any request was still queued or in flight when counting began.

## Local verification (no live site)

- `node build_production_conformance.cjs --check`: the script is current with commit `c551bb0`.
- `node verify_production_conformance.cjs`: static checks plus stub scenarios.

See `PRODUCTION_VERIFICATION.json`.
