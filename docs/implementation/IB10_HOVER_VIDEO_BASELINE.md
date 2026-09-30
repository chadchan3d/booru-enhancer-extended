# IB10 — Hover-video baseline characterization (E stage)

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10, items 2, 3 E, 9). **G-VIDEO is OPEN.**
- Production `Booru_Enhancer.user.js` commit `b9d133c`, blob `22e843cbe27662fc27d17149534b055d7a249dae` — **unchanged**. No production change, no source choice, no URL guessing.

**§11 scope declaration.**
- **Objective:** retain useful streamed previews only where transfer and cleanup evidence permit.
- **Invariant:** hover video is always muted, dwell-gated and class-eligible; leaving before or after readiness releases every owned source and prevents resurrection.
- **Subset examined here:** the existing hover-video path on logged-out e621/e926 `/posts` listing cards whose native `data-file-ext` is a video, TC cell only.
- **Forbidden and not touched:** viewer autoplay/mute, GIF/animated handling, stream selection, byte caps.

## 1. Harness

`tests/host/ib10/hover_video_baseline.cjs` reuses the IB09 fake-clock jsdom session (`tests/host/ib09/hover_harness.cjs`) with the synthetic listing cards turned into video posts (`data-file-ext` webm, one mp4 variant).
- **Recorded per `<video>` production creates:**
  - the owner: hover (`upgradeWhenReady`) or viewer (`buildMedia`), taken from the call stack;
  - creation time and generation;
  - each `src` assignment (slot class only) and `src` removal;
  - `load` / `pause` / `play` calls, with the muted state at play;
  - attachment to `#be-hover-preview`.
- **Readiness:** `loadeddata`, and late `playing` / `waiting` / `stalled` / `canplay` / `error`, are fired by the test.
- **Not modelled:** nothing fetches, so **bytes are not measured** here. DOM-level release is not proof that bytes stopped (item 10).

## 2. Current lifecycle (production `22e843c`; identical on e621 and e926; webm and mp4)

| Step | Behavior | Source |
| --- | --- | --- |
| Class and dwell | Video cards are outside the IB09 qualified class (IB08 rendition `NATIVE_UNSUPPORTED`), so `show()` runs `resolveHover` **immediately**, with no dwell | `:3091`, `:3198–3221` |
| t = 0 | Thumbnail overlay (displayed PREVIEW) is assigned. The cached-post lookup runs; no network | `resolveHover` |
| t = 0 | **One hover `<video>` is created, and its `src` is set to the card's FILE** (`data-file-url`). The DOM-direct path picks FILE when the file URL's extension is video; the metadata path (`mediaFromPost`) picks `originalUrl` for video. Both resolve to the same URL, and `activeUpgradeUrl` deduplicates them | `:3065`, `:3076`, `:3129–3131` |
| t = 0, same task | `muted` and `defaultMuted` = true, `autoplay`, `loop` and `playsInline` are set, `preload = 'auto'`, `controls = false`. `muted` is set **after** `src` in the same synchronous block; every observed `play()` ran muted. Then `load()` | `:3131–3170` |
| `loadeddata` (still current) | `ready()` installs the video in the overlay and calls `play()` (muted) | `:3140–3149` |
| Leave before readiness | `hide()` → `cancelPendingUpgrade`: `pause`, `removeAttribute('src')`, `load()`. The pending element is **released** | `:2985`, `:3263` |
| Leave after readiness | `hide()` → `stopCurrentMedia` (`pause`), then `innerHTML = ''` (detach). **`src` is kept and no reset `load()` follows** | `:2977`, `:3263` |
| Late events | A stale `loadeddata` only pauses. `playing`/`canplay` clear state only for the current token; `waiting`/`stalled` act only while the element is in the overlay. **No late event revived a stale generation** | `:3140–3166` |
| Viewer takeover | The viewer does **not** call `hover.hide()`; the hover overlay and its muted video keep playing while the viewer is open and after it closes. Only the later pointer-out stops them. A hover video that becomes ready **while the viewer is open** is installed and played | `:3974`, `:4234` |
| Dispose | `gallery.dispose()` → `hover.hide()`: same as leave (pending released; installed paused and detached, `src` kept) | `:4589` |

## 3. Defects against the IB10 invariant

| ID | Defect | Evidence (scenario) |
| --- | --- | --- |
| **D1** | **Not dwell-gated.** The full FILE video source is assigned at pointer-enter, including in a 40 ms sweep | S1, S2 |
| **D2** | **Installed hover video is not released** on leave, dispose or viewer close. It is paused and detached with `src` still set and no reset `load()`, so buffering may continue. Bytes are unknown | S4, S9, S11 |
| **D3** | **Source-holding elements accumulate.** Each post-readiness generation leaves one detached element holding its source: 5 after five cycles, and 2 at once on A→B | S5, S8 |
| **D4** | **Viewer takeover does not stop hover.** The hover video keeps playing, muted, behind or over the open viewer, and a hover video that becomes ready after takeover is installed and played | S9, S10 |
| — | **Not a defect:** muted always holds at play. The `src`-before-`muted` order is in one synchronous task. Stale generations never install (S3, S7). Pending elements are released on leave (S2, S6, S12) | |

Every class served on video cards uses the **original file**. Production has no cheaper-stream fact, and none was invented.

## 4. Distinguishable source classes and cells (existing production facts only)

| Host / context | Facts production reads for hover video | Distinguishable now |
| --- | --- | --- |
| e621 / e926 logged-out `/posts` listing (DOM-direct) | `data-file-ext` (webm/mp4), `data-file-url` (the only hover source), `data-size` (original bytes; IB07 V1-N listing attribute), `data-width` / `data-height`, `data-preview-url` / `-webp` (image) | Container (webm vs mp4), original byte size and dimensions, per card. The live `data-sample-url` value on **video** cards is not recorded (UNVERIFIED), and production never uses it for video. Duration is not read by production |
| e621 metadata fallback (`normalizeE621`, API) | `file.ext`, `file.url`, `file.size`, `sample.url` | Same classes; the API is used only on a cache miss. Sample alternates are not read (no 480p/720p) |
| Rule34 / Gelbooru-family | Listing cards expose no media URL; hover resolves through metadata; video is decided by the URL extension | Not qualifiable: IB07 video-post contexts are OPEN (Rule34) or not observed (Gelbooru) |
| Other matched hosts | — | Outside qualified G-HOST scope |
| Cells | TC (Tampermonkey × Chrome) only is measured; VC/TF/VF OPEN | TC only |

**What the V3 experiment can measure, therefore:**
- e621 and e926 logged-out `/posts` video cards in TC, classed by container (webm/mp4) and original size band (`data-size`);
- one source per class: the original file.

## 5. Local results

- `tests/host/ib10/hover_video_baseline.cjs`: **34/34**. That is 12 scenarios × 2 hosts, plus mp4 on both hosts, plus the blob identity. Result file: `hover-video-baseline-result.json` (no URLs).
- **Fault controls: 7/7 change the observed lifecycle:**
  - mute removed (S1);
  - pending release removed (S2);
  - stale readiness guard removed (S3);
  - leave pause removed (S4);
  - leave detach removed (S4);
  - **positive control:** leave releases the installed video (S4), so D2/D3 are visible to the harness;
  - **positive control:** video cards dwell-gated (S1), so D1 is visible to the harness.
- **Regression:** IB09 P-stage 111/111 and baseline 32/32 are unchanged (shared harness).

## 6. Smallest next V3 experiment (not executed)

**V3-C, controlled first (TC).** It answers the byte question that DOM state cannot answer: does D2's detached, paused, source-holding element keep transferring, and does removal plus `load()` stop the transfer?
- **Setup:** a local Range-capable static server that logs each request's range and bytes, serving one webm and one mp4 test clip. The test media must be supplied, because no encoder is available in this environment.
- **Page:** an e621-shaped `/posts` fixture page with production `b9d133c` unchanged. Scripted pointer events are allowed, because it is a fixture and not a live site.
- **Runs:**
  - leave before readiness;
  - leave after `loadeddata`;
  - five re-entries;
  - A→B;
  - viewer takeover.

  Each run records server bytes up to **5 s after leave**, with and without Range, and marks cached, completed and prebuffered transfers.
- **Output:** bytes per run, sanitized.

**V3-L, live after V3-C.** An observe-only package on the operator's logged-out e621/e926 listing, reusing the IB09P pattern. Per video-card generation it records:
- `src` assignment, readiness and first-frame times;
- the leave time;
- `buffered` end and `networkState` at leave and at +1 s / +5 s;
- Resource Timing where visible;
- the class (container and `data-size` band).

Its purpose is representative class usefulness and cost, not a byte cap.
