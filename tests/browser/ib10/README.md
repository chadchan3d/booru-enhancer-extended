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
