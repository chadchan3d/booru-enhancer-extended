# IB09 V2 hover-cost pilot probe

**IB09 G-HOVER E-stage evidence only.** `IB09_V2_Hover_Cost_Probe.user.js` measures the real browser cost of the native card renditions that production hover would load today. It measures cost only: it doesn't imitate hover, doesn't choose a dwell, and changes nothing in production.

## What it does

It runs on a logged-out e621.net or e926.net `/posts` listing, with the normal enhancer disabled. It picks 16 cards that match the IB08 WebP/JPEG pattern and splits them into four arms of 4:

| Arm | Measures |
| --- | --- |
| REUSE_PREVIEW | the displayed preview assigned to a new, detached `Image` (today's t=0 hover overlay) |
| COLD_AND_REUSE_SAMPLE_FILE | a cold SAMPLE and FILE load, then each reused |
| ABORT_SAMPLE | a cold SAMPLE load cancelled after 40 ms with `src = 'data:,'` (production's cancel), then the same URL loaded again to see whether the cancelled fetch still reached the cache |
| CONTROL_SAMPLE | a cold SAMPLE load, not cancelled |

**How it measures:** each load goes into a detached `Image`, never into the page. The probe then reads the browser's own Resource Timing entry for that exact URL.

**What it doesn't touch:** it changes nothing on the page except its result box, sends no other request, and uses no storage, cookies or account data.

**The run is bounded:** exactly 16 cards and 32 image loads per host.

**Output:** per slot (PREVIEW, SAMPLE, FILE) and per arm, it reports:
- how many observations fell into each class;
- sizes in KiB and load times rounded to 10 ms, as min/median/max.

It never reports URLs, IDs or per-card values, and a leak guard withholds any output that would contain a raw value.

**Classes:**

| Class | Meaning |
| --- | --- |
| `NETWORK` | bytes were transferred |
| `CACHE` | served from cache; the entry shows 0 bytes transferred |
| `REVALIDATED` | only headers were transferred |
| `NO_ENTRY` | it loaded with no Resource Timing fetch, typically from the in-memory image cache |
| `SIZE_UNAVAILABLE` | the browser hides the sizes (cross-origin, no `Timing-Allow-Origin`). This is **never** counted as zero |
| `FAILED` | the load failed or timed out |
| `CANCELLED` | the load was cancelled (abort arm) |

**Abort outcomes:**

| Outcome | Meaning |
| --- | --- |
| `CANCEL_PREVENTED_FULL_TRANSFER` | the follow-up load was a full network transfer |
| `CANCELLED_FETCH_STILL_REACHED_CACHE` | the follow-up was served from cache, so the cancelled fetch completed anyway |
| `COMPLETED_BEFORE_CANCEL` | the image had already loaded before 40 ms |
| `NOT_MEASURABLE` | the sizes were hidden, or the follow-up failed |

The verdicts never claim "free": they describe this sample, this cache state and this session only.

Local verification: `node tests/browser/ib09/verify_v2_hover_cost_probe.cjs`. It uses a synthetic browser model.

## Operator steps

Use Chrome with Tampermonkey. DevTools is not needed. Do not send screenshots, URLs or IDs.

**One-time setup:**
1. In Tampermonkey, **disable** the normal Booru Enhancer and every IB08/IB09 conformance or probe script.
2. Install this probe: Create a new script → paste the whole file → Save → enable.
3. Allow Tampermonkey in Incognito: `chrome://extensions` → Tampermonkey → Details → **Allow in Incognito**.

An Incognito window starts with an empty cache and logged out, so "cold" loads really are cold.

**e621 run:**
1. Open a **new Incognito window** and go to `https://e621.net/posts`.
2. Wait until the thumbnails have loaded. Do not scroll.
3. Tampermonkey icon → **IB09 V2: Run hover-cost pilot on this page**.
4. Wait for the result box to replace the "running" message (about one to two minutes). Keep the tab in front and don't scroll.
5. Copy the result (it is already selected) and label it "e621".
6. **Close the Incognito window completely.**

**e926 run:** repeat the e621 steps in a **new** Incognito window on `https://e926.net/posts`, and label the result "e926".

**Bandwidth:** each run downloads up to 12 sample images and 4 full original files, typically a few MB to tens of MB.

**Return:** the two sanitized JSON results. If a result says `sanitationGuard: BLOCKED`, `error` or `INSUFFICIENT`, return it as it is.
