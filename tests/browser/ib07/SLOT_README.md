# IB07 slot-provenance probe

**IB07 G-HOST evidence only.** This probe resolves three INCONCLUSIVE §3 item 9 cases (`tests/host/ib07/item9-result.json`). Each case asks what a host's native page means when an expected rendition fact is missing:

| Case | Question |
| --- | --- |
| `G3-3c-rule34.xxx` | A Rule34 post page shows `img#image` but has **no native Original link**. Is the displayed image the native original, or does a distinct, unlinked original exist? |
| `G3-3d-e621.net` | An e621 card or post has **no `data-sample-url`**. Is the displayed file the original itself, or is the sample simply unknown? |
| `G3-3d-e926.net` | Same as e621, observed on e926. |

It does not test downloads, hover, pagination, favorites, video or any later gate.

## What the probe does

`IB07_Slot_Provenance_Probe.js` is read-only. It reads the current page once, prints one JSON block and exits. It makes no requests, clicks nothing, never navigates, and reads no cookies, storage or account data.

It compares values in memory and prints only:
- a fixed site label;
- the page type;
- booleans, enums and numeric dimensions.

No URL, host, post ID, hash, folder name, tag, title, username or date is ever printed. On any page that doesn't qualify it prints `NOT_FOUND` or `NOT_QUALIFIED` with a reason, and nothing else.

## Before each run

1. Chrome, with the **normal Booru Enhancer and all other userscripts disabled** for the site. The page must be native.
2. Load the probe once as a DevTools Snippet:
   - open `IB07_Slot_Provenance_Probe.js` in a text editor and copy all of it;
   - on any page, open DevTools → Sources → Snippets → **+ New snippet**;
   - name it `ib07-slot-provenance`, paste, and save (Ctrl+S).
3. Run it on the page you're on: right-click the snippet → **Run**, or press Ctrl+Enter in the snippet. Copy the JSON from the Console.

The three sites are independent. Do them in any order, in any number of sessions.

## Rule34

You need a **post page** (URL contains `page=post&s=view`) that shows an image but has **no "Original image" link**. Most posts have that link, so you'll need to open several. Only open ordinary image posts; skip videos and animations.

The probe reports whether the page qualifies:
- `QUALIFIED`: send the JSON back.
- `NOT_QUALIFIED`: this post has an original link. Try another post.

## e621 and e926 (same steps, separately on each site)

1. Open a **posts listing** page and run the probe. It scans every card on the page.
   - `QUALIFIED`: at least one card lacks `data-sample-url`. Send the JSON back.
   - `NOT_QUALIFIED`: every card has one. Try other listing pages. Its `aggregate` counts are still useful, so send one `NOT_QUALIFIED` listing result per site if you never find a qualifying card.
2. **If the listing qualified:** open one of the cards that lacks a sample. The probe doesn't say which card that is, so if you can't tell, open cards from that page until the post-page run says `QUALIFIED`. On that post page, run the probe again and send that JSON too.

Only ordinary image posts are in scope. If the only qualifying cards are videos or animations, send the result anyway; it records the file type as an enum.

## What to send back

For each site you tried:
- each JSON block, unedited;
- which page type it came from (Rule34 post page; e621/e926 listing or post page);
- logged in or logged out.

Nothing else: no screenshots, URLs, post numbers or tag text. It's fine to report that no qualifying page was found on a site.

## How the results will be read

No case is marked PASS until its evidence is in hand. Evidence decides a case only if the fact is observed directly, never from a missing link alone.

- **Rule34:** a qualifying page counts as "displays the original" only if the displayed image uses the site's original-file path, has no `sample_` prefix, and its loaded dimensions equal the Statistics size. If it uses the sample path or its dimensions differ, a distinct original exists but isn't linked.
- **e621/e926:** a qualifying post page counts as "displays the original" only if the displayed image equals `data-file-url` and its loaded dimensions equal `data-width`/`data-height`. Listing aggregates show how often cards leave out the sample versus set it equal to the file.

## Local verification (no live site)

`node verify_slot_probe.cjs` checks every output branch, runs the sanitation scan on each output, confirms leaking probe variants are caught, and confirms no request is made. It needs `npm install` in `tests/host/ib07` for the pinned jsdom. See `SLOT_VERIFICATION.json`.
