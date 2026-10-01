# IB10 V3-C controlled hover-video experiment

**IB10 E-stage evidence only.** It measures what happens to hover-video transfers after leave/cleanup on production commit `b9d133c` (blob `22e843c`), **unchanged**. The executed body equals production byte for byte, with no hooks.

**What it measures.** Event state and transport state are kept apart:
- **Client (the package):** every `<video>` production creates, with:
  - owner (hover or viewer) and card;
  - `src` set/removed and `load`/`pause`/`play`;
  - media events and the first presented frame;
  - sampled attachment, `src`, `networkState`, `readyState` and `buffered` end.
- **Server:** every media request, with:
  - start and end time;
  - `Range` header, status and response range;
  - bytes handed to the socket over time;
  - how it ended: `complete`, `client-abort`, or still open when the run ended.

**How it runs.**
- **Scenarios:** 9 scenarios × MP4/WebM × three transports = 54 runs, each in its own page load with unique no-store URLs.
- **Transports:** `RANGE` (throttled), `NORANGE` (Range ignored, full 200 body, throttled) and `FAST` (Range, unthrottled). The 256 KiB/s throttle exists only to make timing observable; it is not a policy or a byte limit.
- **Observation window:** every run keeps observing for 5 s after its last leave/cleanup.

**Host substitution (test only).** Production is passed a `location` object that reports `hostname` `e621.net` on this local page, so the e621 adapter runs; the verifier shows that without it the hover path does not run. Everything else is the real local page.

**Files:**
- `v3c_server.cjs` (server; refuses fixtures whose SHA-256 differs);
- `v3c_preamble.js` (recorder);
- `v3c_postamble.js` (scenario runner);
- `build_ib10_v3c.cjs` → `IB10_V3C_Controlled.user.js`;
- `analyze_ib10_v3c.cjs` (per-run verdicts);
- `verify_ib10_v3c.cjs` (local qualification).

**Local qualification** (no real browser):
- `node tests/browser/ib10/build_ib10_v3c.cjs --check`
- `node tests/browser/ib10/verify_ib10_v3c.cjs --media <fixture folder>`

## Fixtures (externally supplied; intentionally not tracked)

The two media fixtures come from the operator and are not tracked in the current tree. `.gitignore` excludes them if they are placed in this folder. They were committed once by mistake in `0a43e73` and removed in the next commit; history was not rewritten.

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `ib10_v3c_fixture.mp4` | 3,623,853 | `9ba765f0a3c0e8035f96de18bf9f364d750ff1e9698d80ffe579494ee308b45e` |
| `ib10_v3c_fixture.webm` | 3,091,428 | `467649067aecd56d4d49ca9885eb87a6df5150af1bae6f565a1dba8b3eeb4a61` |

- **MP4:** fast-start (`moov` before `mdat`), 12.0 s.
- **WebM:** Cues near the start.

## Operator steps (Chrome + Tampermonkey, normal profile)

1. **Extract** the two fixtures into a folder outside the repository.
2. **Start the server** in a terminal: `node tests/browser/ib10/v3c_server.cjs --media <that folder> --out <that folder>/ib10-v3c-results.json`. It prints "media SHA-256 verified; 54 runs"; if it refuses, stop and report.
3. **Prepare Tampermonkey:** **disable** every other Booru Enhancer / IB script, then install `IB10_V3C_Controlled.user.js` (Create a new script → paste → Save → enable).
4. **Open the start page:** `http://127.0.0.1:8790/v3c/start` in a normal window.
   - Keep that tab **in front and visible** for the whole run (about 10 minutes); background tabs throttle media.
   - Keep the mouse **outside the browser window**. Real pointer events over the page are counted and mark the run contaminated.
   - DevTools must be closed.
5. **Wait for the result:** the page shows "IB10 V3-C complete" and the server prints "all runs complete" and the results file name.
6. **Return the results:** `ib10-v3c-results.json`. It contains no URLs or IDs, only card labels, times, byte counts and browser/manager brand versions. Then disable the script and stop the server (Ctrl+C).

If the run stops partway, press Ctrl+C in the server terminal (it writes the runs completed so far) and return that file.

---

# IB10 V3-L live observer (prepared; operator run pending)

`IB10_V3L_Live_Observer.user.js` is production `b9d133c` (blob `22e843c`) **unchanged**, wrapped by an observe-only recorder and observer. It runs only on e621.net and e926.net, logged out, on the `/posts` listing (search queries allowed), in the TC cell (Chrome + Tampermonkey).

**What it records.** It records **your real hovers on video cards only** (mp4/webm/mov); it generates no events. Still and GIF cards are counted, not recorded. For each video-card hover generation:
- **Card facts:** host, container, exact `data-size`, native `data-width` / `data-height`, card ordinal and repeat count, and whether production's hover source is the card's own file.
- **Timeline:** enter, `src` assignment, readiness events, first presented frame, and leave (before or after readiness).
- **Element samples:** the hover element's state (attached, holds `src`, `networkState`, `readyState`, buffered end) at leave, +1 s and +5 s, plus the number of hover `<video>` elements still holding a source.
- **Resource Timing:** only what the browser exposes; hidden sizes are never read as zero.

DOM state is never reported as proof that downloading stopped. Output is sanitized (no URLs, post IDs or hashes).

**Local qualification:** `node tests/browser/ib10/build_ib10_v3l.cjs --check` and `node tests/browser/ib10/verify_ib10_v3l.cjs`.

## Operator steps (normal Chrome, logged out, DevTools closed)

1. **Prepare Tampermonkey:** **disable** the normal Booru Enhancer and every other IB script (including the V3-C script), then install `IB10_V3L_Live_Observer.user.js`. Hover preview must be on in its settings (the default).
2. **Open a listing:** a logged-out `https://e621.net/posts` page with video cards. A native search such as `type:webm` or `type:mp4` is fine. Do not open the enlarged viewer during a session; clicking a card contaminates the hovers around it.
3. **Start:** Tampermonkey → **IB10L: Start session (video hovers)**.
4. **Hover naturally over video cards:**
   - some quick passes;
   - some rests of 1–3 s until the preview plays;
   - moves from one card to the next.

   Keep the tab in front. Don't click cards.
5. **About every 10–15 video hovers:** **IB10L: Show results (ends the session)**, copy the JSON, label it (host plus a number), close the box, and **reload the page**.
   - The reload also stops any downloads that hover videos left running (defect D2).
   - Repeat until about 40 video hovers are recorded for the host, or stop earlier if the listing has too few video cards. Record that fact.
6. **Repeat on e926:** steps 2–5 on `https://e926.net/posts`.
7. **Return** all labelled JSON results, including any `sanitationGuard: BLOCKED` result as it is. Afterwards, disable the script.

**Bandwidth warning:** every hover that lasts past readiness downloads the **whole original video**, and it keeps downloading after you leave (that is defect D2 being measured). Large originals can make this run hundreds of MB to several GB. Prefer smaller videos or more quick passes if bandwidth matters, and reload often.
