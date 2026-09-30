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

---

# IB08 B1 native login-state marker probe (version 1.1.0)

**IB08 bounding input B1 only.** `IB08_B1_Login_State_Probe.user.js` is a read-only Tampermonkey script for e621.net and e926.net. It lists candidate login-state markers so the four observations can be compared.

**What it reports:**
- **Login-relevant names only:** `meta` tag names, `<html>`/`<body>` attribute names and class names, where the name relates to user, login, session, account, auth, csrf or level.
- **A value class for each name, never the value:**
  - `EMPTY`;
  - `ANONYMOUS_WORD`;
  - `ZERO`;
  - `NUMERIC_NONZERO`;
  - `BOOLEAN_TRUE`/`BOOLEAN_FALSE`;
  - `OTHER_TEXT`.
- **Counts only for everything else:**
  - all other names (`otherNameCounts`);
  - account-related link types (sign in, sign up, log out, account home, profile, settings, messages).

No username, user ID, token, URL or path appears. Names containing long digit runs are withheld and counted.

The probe never reads cookies or storage, never requests or clicks anything, and never changes the page (apart from its own result box). You tell it the state through the menu command; it decides nothing about login itself.

**Version 1.1.0 fixes the 1.0.0 failure:** every live run returned `sanitationGuard: BLOCKED`.
- **Cause:** the leak guard also scanned the probe's own fixed labels. An ordinary page value containing the site's short name matched the probe's own `site` label.
- **Fix:** the guard now checks all page-derived output at the same strictness. The fixed labels come only from built-in literals.
- **If a result is still blocked,** it now carries `blockDiagnostics`: which page source and which output section caused it, as counts only.

Local verification: `node tests/browser/ib08/verify_b1_login_state_probe.cjs`. The fixtures are synthetic, and the check includes a regression run of the 1.0.0 probe.

## Operator steps: four observations (rerun all four with 1.1.0)

Use Chrome with Tampermonkey. DevTools is not needed. Do not send screenshots, URLs, usernames or IDs.

**Setup:**
1. In Tampermonkey, keep the normal Booru Enhancer and all other IB08 scripts **disabled**.
2. Open the existing **IB08 B1 Native Login-State Marker Probe** script, replace its whole contents with the current `tests/browser/ib08/IB08_B1_Login_State_Probe.user.js`, and save.
3. Confirm Tampermonkey shows version **1.1.0**, and that the script is enabled.

For each of the four observations below:
1. Open the stated page in a fresh tab and wait for it to finish loading.
2. Tampermonkey icon → choose the command that matches your **actual** state:
   - **IB08 login-state: observe (I am logged OUT)**, or
   - **IB08 login-state: observe (I am logged IN)**.
3. Copy the result (it is already selected) and label it with its observation number.

| # | Host | State | Page |
| --- | --- | --- | --- |
| 1 | e621 | logged out (log out first, or use a window where you are not logged in) | `https://e621.net/posts` |
| 2 | e621 | logged in to your own e621 account | `https://e621.net/posts` |
| 3 | e926 | logged out | `https://e926.net/posts` |
| 4 | e926 | logged in to your own account on e926 | `https://e926.net/posts` |

Check that each result shows `"version": "1.1.0"`, the right `site` and `declaredState`, and `route` = `posts-listing`. Log in and out only through the site's normal controls; the probe does nothing to your account. Afterwards, disable the probe and return the four sanitized JSON results. If any result still says `sanitationGuard: BLOCKED`, return it as it is: its `blockDiagnostics` holds only counts and is safe to send.

---

# IB08 P-stage production conformance (e621 / e926 rendition)

**IB08 production conformance only.** `IB08_Rendition_Production_Conformance.user.js` is the committed production `Booru_Enhancer.user.js` (commit `b2b1d9f`, blob `a0f3041`), byte-for-byte, inside the IB07 wrapper, with a read-only postamble (`ib08p_postamble.js`).
- It runs only on e621.net and e926.net, and has no update URL.
- Check P00 proves in the browser that the executed body is the committed artifact.

**How it checks production independently.** Production's gallery mounts asynchronously. Before that, the postamble records the native listing in memory, and it records every rendition-attribute write (`src`/`srcset`/`sizes`/`media`/`type`) and every node change inside a `picture`. Production's writes are judged against that native record, not against production's own report.

**Output:** statuses, enums, booleans and counts only, behind a leak guard.

**What the checks prove:**
- **Check this page** (P00–P11):
  - production identity, route, and that the recorder was installed before enhancement;
  - the login marker;
  - per-card provenance against the contract;
  - exactly one write (WebP srcset) per owned card and none elsewhere;
  - the final attributes;
  - node identity;
  - the displayed rendition on in-view cards;
  - the saved quality value;
  - no enhancer request.
- **Dispose test** (D01–D09): after simulated native edit, move and replacements, production's own `gallery.dispose()` restores only what it owns, keeps native changes, and leaves no sample residue. The window is narrowed afterwards.

Local verification: `node tests/browser/ib08/build_ib08_conformance.cjs --check` and `node tests/browser/ib08/verify_ib08_conformance.cjs`.

## Operator steps (e621 first, then e926)

Use Chrome with Tampermonkey. DevTools is not needed. Do not send screenshots, URLs, usernames or IDs.

**Setup (once):**
1. In Tampermonkey, **disable** the normal Booru Enhancer and every IB08 probe or experiment script.
2. Tampermonkey → Create a new script → replace everything with the full contents of `tests/browser/ib08/IB08_Rendition_Production_Conformance.user.js` → Save. Enable it.

**Changing the quality:** use Tampermonkey icon → **Booru Enhancer: Settings** (listed under the conformance script) → **Grid thumbnail quality**. After each change, close the panel and **reload** the page before running a check. The check measures writes from page load, so a reload is required.

**For each run:** copy the result (it is already selected), label it (for example "e621 S"), and close the box. Each result must show `"production_body_identity": "MATCH_EXPECTED_ARTIFACT"` and the right `site`.

**e621 runs**, in a maximized (wide) window, **logged out**, on `https://e621.net/posts` (no scrolling before a check):

| Run | Setting | What to do |
| --- | --- | --- |
| **S** | Grid thumbnail quality = **Sample** | Reload, wait for thumbnails, then Tampermonkey → **IB08P: Check this page (current quality)**. |
| **D** | still **Sample** | Reload. Run **IB08P: Dispose test step 1 (wide window)** and click Close. Make the **same window** clearly narrower (about half the screen) and wait about 5 seconds. Run **IB08P: Dispose test step 2 (after narrowing)**. Maximize the window again afterwards. |
| **P** | set **Preview** | Reload, then **IB08P: Check this page (current quality)**. |
| **O** | set **Original** | Reload, then **IB08P: Check this page**. This loads each post's full original image, so allow a little longer. |
| **L** | leave **Original** | **Log in** to e621 with the site's normal controls. Reload `/posts`, then **IB08P: Check this page**. Expect `loginMarker: "FALSE"` and no rendition writes. Then log out again. |

**If P09 fails with `"settled": false`** (images still loading), wait a few seconds and run **IB08P: Check this page** again without reloading. The check is read-only, and a repeat is valid. Report which attempt you returned.

**e926 runs:** repeat S, D, P, O and L on `https://e926.net/posts`, logged out except for L.
- The saved setting is shared, so set **Sample** again before e926 run S.
- Do not reuse any e621 result.

**Return** the ten sanitized results (e621 S, D, P, O, L; e926 S, D, P, O, L). If any result says `sanitationGuard: BLOCKED`, return it as it is. Afterwards, disable the conformance script and re-enable your normal enhancer if you use it.
