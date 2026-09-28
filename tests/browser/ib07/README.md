# IB07 Gelbooru V1-N Passive Probe

This packet collects **IB07 G-HOST evidence only** for Gelbooru.com: native listing-card facts, native post facts, and rendition/media facts, per blueprint §3 (IB07) and §5 (G-HOST row).

It does not collect, and must not be used as, evidence for G-ACTION (IB14), G-PLACE-T (IB12) or G-VIDEO (IB09/IB10).

## What the probe does

`IB07_Gelbooru_V1N_Probe.js` is **read-only**. When run, it reads the current page's DOM once, prints one JSON block to the console and exits. It:

- makes no network requests;
- clicks nothing and submits nothing;
- performs no favorite, vote or account action;
- does not read cookies, localStorage or sessionStorage;
- sanitizes every value inside the browser before printing. Post IDs, content hashes, hash-derived bucket directories and cross-origin hosts are replaced with `<id>`, `<hash>`, `<bucket>` and `<host>`. External Source paths keep only known structural words such as `status`. Every other segment becomes `<handle>` or `<segment>`. Query strings are dropped. Tag text, dates and usernames are never printed; only their presence is.

It selects its mode from the page URL and needs no configuration. On any page other than a Gelbooru listing or post, it prints an error and reads nothing.

## Before you start

1. Use Chrome.
2. Disable Booru Enhancer and any other userscripts for gelbooru.com, so the page is native.
3. Note whether you are logged in or logged out. Report it with the output.

## Load the probe once (DevTools Snippet)

This avoids pasting a large script from chat.

1. Open the probe file in a plain text editor. Select all and copy.
2. On any gelbooru.com page, open DevTools (F12) → **Sources** tab → **Snippets** (use the `»` menu if it's hidden).
3. Click **+ New snippet** and name it `ib07-gelbooru-v1n`.
4. Paste the file contents and save (Ctrl+S).

Optional: compare the file's SHA256 with `SHA256SUMS.txt` before pasting.

## Run 1: listing capture

1. Open the Gelbooru post listing (the Posts page). Its URL contains `page=post&s=list`.
2. Let the page finish loading.
3. In DevTools → Sources → Snippets, right-click `ib07-gelbooru-v1n` → **Run** (or press Ctrl+Enter in the snippet).
4. Open the **Console** tab. Copy the whole JSON block, which starts with `"probe": "gelbooru-v1n"` and `"mode": "listing"`.

## Run 2: post capture

1. On that same listing page, click one of the first three cards.
2. Check that the post URL contains `page=post&s=view`.
3. Let the image load fully, then run the snippet again.
4. Copy the whole JSON block with `"mode": "post"`.

Use an ordinary **image** post for this run. If the card you open is a video or animated post, report it as such. Don't pick a different post to hide that.

## What to send back

- The listing JSON block, unedited.
- The post JSON block, unedited.
- Logged-in or logged-out.
- Whether the post was an image, video or animated post.

Send nothing else. Do not add screenshots, URLs, post numbers or tag text.

If either output shows `"mode": "unrecognized"`, or the console shows an error, send that exactly as it appears.
