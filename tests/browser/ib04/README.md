# IB04 Browser Ownership Probe

This packet is the controlled-browser **E stage** for IB04. It tests the minimal ownership/disposal contract on a local fixture before any ownership code is integrated into the production userscript.

It does not contact Rule34, e621/e926, Gelbooru, Pixiv, or any other external site.

## Run it

1. Open Command Prompt in this folder.
2. Run:

   `node server.cjs`

3. Leave that window open. It should say:

   `IB04 fixture listening at http://127.0.0.1:8775`

4. In Tampermonkey, create a new script and replace its contents with all of `IB04_Browser_Ownership_Probe.user.js`. Save it.
5. In Chrome, open:

   `http://127.0.0.1:8775/`

6. Click the Tampermonkey icon and choose:

   `IB04: Run browser ownership probe`

7. A result window will appear. Copy the entire JSON block and send it back for checkpoint review.

If you accidentally close the result, use:

`IB04: Show/export last result`

## Expected result

Do not assume PASS in advance. The probe runs 18 browser cases covering:

- static restoration and native node identity;
- five mount/dispose cycles;
- later native edits and equal-value native writes;
- moved responsive `<source>` identity;
- native card replacement;
- late callback/source resurrection;
- O13 focus return and later-focus preservation;
- missing-origin fallback and explicit reload recovery;
- real same-document native navigation after synchronous viewer-open failure;
- usable native fallback after later viewer media failure;
- modifier/middle/native-control click preservation;
- native title/accessibility replacement/restoration;
- append failure versus explicit full disposal;
- native listener preservation.

A green local/browser fixture does not certify live-site behavior or every future DOM mutation. It only admits the named effects for production integration in the tested runtime cell.
