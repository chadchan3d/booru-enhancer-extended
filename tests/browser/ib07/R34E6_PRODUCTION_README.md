# IB07 Rule34 / e621 / e926 production conformance

This is the §11 step 6 production-conformance run for the IB07 native integrations on Rule34, e621 and e926. It runs against the current production artifact, which includes the slot-inference restriction, the Rule34 preview and site corrections, and the Post `pageCount` fact. It covers **IB07 G-HOST only**: each host's admitted native listing and image-post contexts, with production Booru Enhancer running. Gelbooru is covered separately and is not re-run.

It does not test video/GIF, pagination, hover, favorite/action, downloads, rendition policy or other hosts.

## What the script is

`IB07_R34E6_Production_Conformance.user.js` follows the Gelbooru production-conformance convention:

- the production body, byte-for-byte, run inside a named wrapper function;
- a separate userscript identity, so it uses its own storage and never reads your normal settings;
- `@match`/`@connect` narrowed to rule34.xxx, e621.net and e926.net;
- no update URL;
- an appended read-only postamble with two menu commands.

Check C00 confirms in the browser that the running production body is exactly the expected artifact. It hashes the source text of the wrapper that actually ran.

The result contains only check statuses, booleans, counts and fixed labels. It never contains post IDs, URLs, hosts, hashes, tags, titles or account data.

## Before you start

1. Chrome with Tampermonkey. **Log out** of Rule34, e621 and e926.
2. In the Tampermonkey dashboard, **disable** your normal Booru Enhancer and any other userscripts for these three sites.
3. Install the test script: open `IB07_R34E6_Production_Conformance.user.js` in a text editor and copy all of it. In the Tampermonkey dashboard, press **+**, replace everything with what you copied, and save.

## Runs: six pages, two per host

On each page:
1. Open the page directly and reload it once.
2. Let it finish loading. Don't hover or click anything the enhancer adds.
3. Tampermonkey icon → **IB07P3: Run production conformance on this page**.
4. After about 5 seconds a result window appears. Copy all of the JSON.

| # | Host | Page to open |
| --- | --- | --- |
| 1 | Rule34 | A posts **listing** page (`page=post&s=list`) |
| 2 | Rule34 | An ordinary **image post** page (`page=post&s=view`) that has an "Original image" link, as normal posts do |
| 3 | e621 | A posts **listing** page (`/posts`) |
| 4 | e621 | An ordinary **image post** page (`/posts/<number>`) |
| 5 | e926 | A posts **listing** page (`/posts`) |
| 6 | e926 | An ordinary **image post** page (`/posts/<number>`) |

You don't need to hunt for unusual posts. The shapes that were never observed live (Rule34 with no Original link; e621/e926 with no sample attribute) are covered by local tests.

If you close a result window, use **IB07P3: Show/export last result**. It shows only the most recent run, so copy each result before moving to the next page.

## What to send back

- Six JSON blocks, unedited, each labeled with its row number from the table.
- Confirmation that you were logged out.

Nothing else: no screenshots, URLs or post numbers.

## Expected result

No check is a known failure on the current artifact. Every check is expected to PASS if the live pages match the qualified evidence. A FAIL is a real finding; send it as is.

R11 checks that the Rule34 Post carries the canonical site identity `rule34`. R12 (Rule34 post), E10 (e621/e926 post) and EL09 (every e621/e926 listing card) check `pageCount === 1`, the known single-item count. `siteId` is a Post fact, not proof of the browser host. C01 and C02 prove the exact host and route from the page itself.

## Known limitation

A request issued synchronously during production startup, before the postamble loaded, would not be counted. `observations.requests.netAtPostambleLoad` shows whether anything was still queued or in flight when counting began. The local jsdom item 9 suite instruments startup fully; that is a separate class of evidence.

## Local verification (no live site)

- `node build_r34e6_conformance.cjs --check`: the script is current with the committed production artifact.
- `node verify_r34e6_conformance.cjs`: static checks, the real derived script run in jsdom on all host fixtures, 15 production mutants and 4 leak mutants. Needs `npm install` in `tests/host/ib07`.

See `R34E6_PRODUCTION_VERIFICATION.json`.
