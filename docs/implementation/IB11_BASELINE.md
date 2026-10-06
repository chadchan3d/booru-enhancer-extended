# IB11-E0 — Existing viewer baseline characterization and G-PLAY evidence preparation

**Checkpoint:** IB11 — Existing viewer hardening (Blueprint §3 IB11). **This step is E0 only:** characterize the existing viewer and prepare the G-PLAY evidence tooling. No production change, no IB11 P work.

**Invariant (Blueprint §3 IB11 item 2):** "The viewer shows the selected target's usable placeholder, preserves transformations/preferences and offers native recovery when loading or playback fails."

**Status:** **IB11 — PARTIAL, E-stage evidence OPEN.** G-PLAY is **OPEN**: no controlled or browser playback evidence has run. IB12 is not started.

## 1. Source identity and gate check

- **Repository:** `c08190b` = origin, clean before this step.
- **Production under test:** `Booru_Enhancer.user.js`, commit `4d793a2`, blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, production body SHA-256 `009155841b194df21a4e1d22bd3f40b5d63e2f58cfa5485b06fd4e66bd64e945`. It is unchanged by this step.
- **Blueprint sections read:** §2, §3 IB11, §5 (G-PLAY row), §6 (viewer, click, transform and playback rows), §8 (runtime axis: R8 Playback), §11.
- **Prerequisites (§3 IB11 item 5), from the Ledger:**
  - IB04 (G-OWN), IB05 (G-SETTINGS) and IB07 (G-HOST / G-REQUEST) are complete for the active TC path.
  - IB04 measured parts of the viewer in TC (`IB04_BROWSER_OWNERSHIP.md`): synchronous takeover ordering (P04), modifier/native-control bypass (P05), focus return (P06) and native fallback after media failure (P07).
  - Per item 5, IB09/IB10 hover classes are not prerequisites for the deliberate viewer.
- **Gate:** G-PLAY(cell) is **OPEN** (§5; Ledger). Item 6 says G-PLAY E → PASS must come before playback-policy wiring, so this step prepares that E evidence and changes nothing.
- **Conflict check:** no conflict was found between the assignment, the Blueprint, the Ledger and the source.
  - **UNVERIFIED:** the R8 playback execution pack itself. It is named by the Blueprint (§3 preface, §8) but is not present in this repository (`git grep R8` finds only the Blueprint). The matrix below follows the Blueprint's IB11 item 9 and the assignment instead.

## 2. Current viewer behavior map (source-backed, `4d793a2`)

### Viewer module

`BE.modules.viewer`, `Booru_Enhancer.user.js:3352–3802`.

| Area | What production does today (line) |
| --- | --- |
| Preferences | Schema `:884–899`, all defaulting true: `viewer.enabled`, `viewer.autoplayVideo`, `viewer.loopVideo`, `viewer.muteVideo`, `viewer.rememberVolume`; `viewer.fitMode` defaults to `fit-both` (choices `fit-both`, `fit-width`, `fit-height`, `original-size`). The remembered volume is the non-setting store key `viewer:volume` (`:834`). |
| `open(post, nav, ctx)` `:3706` | Lazily runs `init`. Stores focus origin/fallback. Resets rotation, flip, pan, zoom and manual zoom. Sets the overlay to display `flex` **before** `replaceMedia` (`:3723`). Calls `replaceMedia` and `updateStatus`. Always returns `true`. |
| `replaceMedia` `:3676` | `stopMedia(old)` and clears the stage. Calls `buildMedia`. Shows "Loading video…" after 180 ms for video and "Loading media…" after 220 ms only when `metadataPending`; otherwise it clears the state (`:3690`). Refits on the next animation frame. |
| `buildMedia` `:3612` | Increments `mediaGeneration`. The URL is `bestMediaUrl`: original → sample → preview (`:3466`).<br>**Video:** `autoplay`, `loop`, `muted` and `defaultMuted` are set from the preferences; `controls = true`; `playsInline`; `preload = 'auto'`; the poster is the preview when that is not a video. With remember-volume, `el.volume = BE.store.get('viewer:volume', 1)` (`:3635`) and `volumechange` stores the volume. Listeners for `loadedmetadata`, `loadeddata`, `canplay`, `playing`, `waiting`, `stalled` and `error` are each guarded by element and generation.<br>**Image:** `decoding = async`; readiness is the `load` event (the viewer never calls `decode()`). `error` is guarded. |
| `updatePost` `:3730` | Applies only when the post ID equals the current post (`:3731`). Always calls `clearMediaState()` (`:3740`). Rebuilds the element when the media type changes. Otherwise swaps `src` in place on the same element and generation. For video it shows "Loading video…", calls `load()`, and calls `play()` only when autoplay is on (`:3763`), with the rejection swallowed. |
| `stopMedia` `:3560` | Video only: `pause()`, remove `src`, `load()`. |
| `close` `:3772` | Hides the overlay, clears the state, `stopMedia`, empties the stage. Focus returns to the origin, else the fallback, **only if focus was inside the overlay**. |
| `dispose` `:3792` | `close()` plus owner disposal: listeners removed and the overlay removed. |
| Failure state | `showMediaState(..., error)` (`:3573`) appends an "Open native post" link to `currentPost.postUrl` when present (`:3589`). |
| Transforms | Fit uses intrinsic size versus the stage minus 24 px (`:3480`), with no rotation term. Zoom is absolute to native pixels; +/− change it by 0.25; wheel by 0.15; `1:1`. Rotate and flip only re-render. The "Fit" button resets rotation, flip and pan (`:3507`). Resize refits only when zoom is not manual (`:3426`). Pan works only when the image overflows (`:3532`). |
| Keyboard `:3439` | Document-level, active only while the overlay is shown: close, next, prev, download, favorite, open original and play/pause keys from settings. `preventDefault` on a match. **No modifier check.** Space calls `togglePlayPause` (`:3454`), whose `play()` rejection is swallowed. |

### Gallery entry points

| Entry point | What production does today (line) |
| --- | --- |
| `onGalleryClick` `:4303` | Thumbnail action buttons are handled before the `viewer.enabled` check. The viewer is skipped when disabled, for `button !== 0`, for Ctrl/Meta/Shift/Alt, and for nested native controls. `openViewerForThumb` runs inside try/catch (`:4338`); only when it returns `true` does the gallery call `endForViewer`, `preventDefault` and `stopPropagation`. |
| `openViewerForThumb` `:4043` | Builds the target from the cache or the card DOM. `metadataPending` is set when there is no original. `postUrl` is the card link (else the page). Next/prev follow the DOM order. An uncached post is enriched and then `updatePost`ed. |
| Page command `viewer()` `:5083` | `viewer.open(post)` with no navigation and no focus context. |

## 3. Local structural characterization

**Suite:** `tests/host/ib11/viewer_baseline.cjs` (jsdom, fake clock, simulated media events, inert network; result `viewer-baseline-result.json`). **38/38 checks pass; 46/46 fault controls caught.**
- Every check carries at least one source mutant that must flip it.
- For witnesses (DEFECT/FINDING) the mutant is a **repair probe**. It is applied only to a test copy, to prove the witness detects the behavior. It is not a chosen fix.

| ID | Case (assignment number) | Current behavior pinned |
| --- | --- | --- |
| A1 | takeover (15) | Plain click: opened, native navigation cancelled, target = clicked card, media = original. |
| A2 | 15 | Ctrl/Meta/Shift/Alt/middle click: native behavior kept. |
| A3 | 15 | `viewer.enabled=false`: native behavior kept. |
| A4 | FINDING | The per-card "Open viewer" action opens the viewer even with `viewer.enabled=false` (explicit action, not an ordinary click). |
| A5 | 1, **DEFECT V-D6a** | A synchronous throw during takeover is triggered by real stored state: remembered volume 1.5, which the media element rejects with `IndexSizeError`. Native navigation is correctly **not** cancelled, but the overlay is left displayed with an empty stage. |
| A6 | 1, **DEFECT V-D6b** | The same throw during in-viewer navigation (ArrowRight onto a video) leaves the viewer open on the new target with an empty stage: no message, no native link. This is a blank, uncommunicated failure. |
| B1 | 7, **DEFECT V-D7** | An image card loads the **original** file directly. No staged thumbnail or sample placeholder; no loading state while it loads. |
| B2 | 7 | Video: the preview is the poster; "Loading video…" appears at 180 ms and clears at `loadeddata`. |
| B3 | 7 | Metadata-pending target: sample/preview with "Loading media…" at 220 ms. |
| C1 | 2, 14 | Image failure: "Media failed to load" plus an "Open native post" link to the card post; the link click is not intercepted. |
| C2 | 2 | Video failure: "Video failed to load" plus the link. |
| C3 | 2, 14, **DEFECT V-D1** | A later same-ID metadata update with an unchanged URL (late enrichment) **erases** the failed state and its native link; the failed media stays. |
| C4 | FINDING | A target without `postUrl` (direct `open` callers) fails with no native link. |
| D1 | 3 | A late update for the previous post is ignored (post-ID guard). |
| D2 | 9 | Stale `loadeddata`/`canplay`/`playing`/`error`/`waiting`/`stalled` from the previous video do not touch the current state (generation guards). |
| D3 | 9, 12 | Replacement stops the previous video (pause, remove `src`, `load`) and detaches it. |
| D4 | 4, FINDING | Same-ID updates have no generation guard: the last applied update wins regardless of request order. |
| D5 | 8 | Image → video rebuild when metadata reveals a video. Rotation and flip are kept; **FINDING:** manual zoom and pan are discarded (refit). |
| D6 | 7, 8 | Same-element video URL upgrade: `src` swap plus `load()`; `play()` only when autoplay is on. |
| D7 | 5, 12 | Close before readiness: the video is stopped; late events change nothing; an image closed before load is inert. |
| E1 | 10 | The fit modes compute exactly (landscape and portrait). |
| E2 | 11 | Resize refits non-manual zoom; manual zoom and pan survive resize. |
| E3 | 11 | Rotation and flip survive an in-place placeholder → better upgrade. |
| E4 | 11, FINDING | Manual zoom is absolute to native pixels, so across a 300 px → 3000 px upgrade the apparent size jumps 10×. |
| E5 | 10, 11, **DEFECT V-D4** | Fit ignores rotation: a 2000×1000 image rotated 90° and refit on resize overflows the available height. |
| E6 | FINDING | The "Fit" button also resets rotation and flip. |
| F1 | 12 | Close returns focus to the native card link when focus was inside the viewer; otherwise focus is left alone. |
| F2 | 12, FINDING | `open` does not move focus into the viewer; the overlay has no `role` and no `aria-modal`. |
| F3 | 12 | Dispose: the overlay is removed, keys are inert, a late update is a no-op, and re-open re-initializes. |
| G1 | 13 | Escape, ArrowRight/ArrowLeft and Space work, and they are `preventDefault`-ed. |
| G2 | 13, **DEFECT V-D5** | Viewer keys ignore modifiers. Ctrl+F toggles **Favorite** (an account-mutation path) and blocks the browser's Find; Ctrl+D downloads; Ctrl/Meta+O opens the original. |
| G3 | 13, FINDING | Space is handled at document level even when the native video control has focus. The real-browser interaction is UNKNOWN. |
| G4 | FINDING | A rejected `play()` is swallowed: no blocked-Play state; native controls are the only Play affordance. |
| G5 | 13 | Keys are inert, and page keys are not prevented, while the viewer is closed. |
| H1 | prefs | For all 8 autoplay/loop/mute combinations, the element reflects them exactly (`muted` and `defaultMuted` follow mute); controls on; preload auto. |
| H2 | prefs | Remember-volume on: the stored volume is applied and changes are stored. Off: volume 1 and nothing stored. |
| H3 | prefs | After a deliberate unmute, the next video starts muted again (preference) at the remembered volume. |

**Not applicable in this form:** "image load where `decode()` is absent or rejects" (6). The viewer does not use `decode()`; image readiness is the `load` event (B1, D7). This is recorded as current behavior, not a defect.

## 4. Defects versus untested behavior

### Observed defects (source-backed, reproduced locally)

| ID | Defect | Invariant / Blueprint clause | Would justify a P change? |
| --- | --- | --- | --- |
| V-D1 | A late same-ID metadata update erases the failure state and native link (C3). | "offers native recovery when loading … fails"; item 10 "no blank uncommunicated failure". | Yes. In scope: "local … failed … states"; "native link". |
| V-D4 | Fit ignores rotation (E5). | §6 "Fit/zoom/pan/rotate/flip … Keep behavior"; item 9 "all transforms across replacement/resize"; item 10 "no … invalid transform". | Yes, if it is confirmed visually in a browser (the transform matrix is a source fact; the visual overflow needs a browser screenshot). |
| V-D5 | Viewer keys act on Ctrl/Meta/Alt chords, including Favorite on Ctrl+F (G2). | §6 "Fit/zoom/pan/rotate/flip/key navigation: keep"; AGENTS forbids unintended favorite mutation. Not a named IB11 scope item. | Owner decision. The fix is a narrow key filter; it may belong in IB11 (keybinds, item 8) or IB14. |
| V-D6a/b | A synchronous media-build failure leaves the overlay shown (takeover) or a blank viewer (navigation) (A5, A6). | Item 9 "Synchronous open throws before cancellation"; item 10 "no blank uncommunicated failure"; "safe shell takeover". | Yes. In scope: "safe shell takeover and native link". |
| V-D7 | No staged placeholder for images: the original loads directly with no loading state (B1). | Invariant "shows the selected target's usable placeholder"; item 3 "Stage target thumbnail/sample before ready upgrade". | Yes. This is exactly item 3's allowed scope. |

### Findings that are not defects in themselves

These are observed behavior that needs owner judgment or browser evidence:

| Finding | Status |
| --- | --- |
| A4 action button bypasses `viewer.enabled` | Explicit action, not an ordinary click; §6 names only the ordinary click. |
| C4 no native link without `postUrl` | Affects only direct `open` callers (the page command on a post page, where the native page is the current page). |
| D4 no same-ID generation guard | Harmful only through V-D1 today, because enrichment returns the same data. Item 3 allows "post-ID plus generation guards". |
| D5 / E4 manual zoom across replacement | Zoom is absolute to native pixels; whether apparent size should be kept is a product question. Item 10 forbids an "invalid transform reset"; D5's reset applies on a type change only. |
| E6 Fit resets rotation | Existing affordance (§6 "keep affordances"). |
| F2 no dialog focus semantics | Accessibility gap; focus *return* is in scope (item 3). |
| G3 Space versus native controls | Browser evidence needed. |
| G4 no blocked-Play state | Item 3 allows "blocked-Play" states; G-PLAY E decides whether the native-controls fallback is enough. |

## 5. G-PLAY E matrix (controlled; prepared, not run)

**Package:** `tests/browser/ib11/IB11_GPLAY_Controlled.user.js`.
- It is built by `build_ib11_gplay.cjs` from `4d793a2`. The body is byte-identical to production; there are no hooks.
- It uses a test-only location shim (`e621.net` on the local page; the IB10 V3-C pattern).
- It matches only `http://127.0.0.1:8796/*`.

**Server:** `gplay_server.cjs`. It serves the IB10 MP4/WebM fixtures, refusing to start unless their pinned SHA-256 values match. Range is honored. `*-FAIL` answers 404; `*-PEND` holds the response for 3 s.

**Recorder:** `gplay_preamble.js`. It keeps PREFERENCE (assigned values and later writes, tagged production or harness), CALLS (`play` caller and promise outcome), EVENTS and SAMPLES separately.

**Preferences:** set in the **test script's own storage**, never the production script's. Hover preview is turned off on these pages.

**Pages:** arm N has no user activation until its final RETRY prompt; arm U is given activation by a trusted Start click. Both run on MP4 and WebM.

**Cell preferences:** `[autoplay, loop, mute, rememberVolume]`, with a stored volume of 0.37 in every cell.

| Cell | Arm | Preferences | Drive | Criterion |
| --- | --- | --- | --- | --- |
| PREF | N | T T T T | open; 4 s | PREF; capability recorded |
| UNMUTED | N, U | T T F T | open; 4 s | PREF (no forced remute); capability: N expected BLOCKED, U recorded |
| NOAUTO | N | F T T T | open; 4 s | NOAUTO: no production `play()`, no `play` event |
| LOOPF | N | T F T T | play, seek near the end | LOOP: `ended`, no wrap |
| LOOPT | N | T T T T | play, seek near the end | LOOP: wrap, no `ended` |
| RVOFF | N | T T T F | harness volume 0.6, then next | VOL: volume 1, nothing stored, next at 1 |
| RVON | N | T T T T | harness volume 0.6, then next | VOL: 0.37 applied, 0.6 stored, next at 0.6 |
| PLAYREJ / PLAYAPI | N / U | T T F T | metadata update (production `play()`) | API: outcome recorded (N: a rejection expected; U: recorded) |
| FAIL | N | T T T T | 404 media | FAILN: failed state plus native post link |
| CLOSEPEND | N | T T T T | close at 300 ms of a held load | CLOSE: no `playing` after close; no full body after close |
| CLOSEPLAY | N | T T T T | close while playing | CLOSE / REL |
| STALE | N | T T T T | metadata-update `play()` on A, then next to B | STALE: nothing from A after B; no failure shown for B |
| RETRY | N (last) | T T F T | blocked → trusted **Space** | RETRY: resolved production `play()` (`togglePlayPause`) and playback; NOT_BLOCKED if it already played |
| DELIB | U | T T T T | trusted **Unmute**, then next | DELIB: A stays unmuted (no production remute); B starts muted at A's volume |

**Global criteria:**
- T0: identity, and no trusted input outside a prompt.
- PREF / MUTE / PLAY / REL apply to every cell. A resolved `play()` must be followed by `playing`. `playing` requires a resolved `play()` or an autoplay attribute. A pending or rejected outcome is never counted as playback.
- **Capability** is PLAYED only on a `playing` event plus `currentTime` past 0.2 s. Otherwise it is BLOCKED, ERROR, IDLE (autoplay off), CLOSED_BEFORE_READY or NONE.
- An assigned autoplay attribute is **never** autoplay-support evidence.
- G-PLAY(TC) E passes only if all 4 pages and all 32 cells are present and clean and every criterion passes. A blocked capability counts only together with its tested fallback (RETRY; native controls).

**Local qualification:** `verify_ib11_gplay.cjs` **28/28** (`IB11_GPLAY_VERIFICATION.json`; `IB11_GPLAY_SHA256SUMS.txt`).
- **Static:** package current; body byte-identical; scope; plan; the server refuses missing fixtures.
- **jsdom smoke on a media simulator** (muted autoplay allowed; unmuted only after activation; loop/ended; 404; pending load):
  - all 4 pages run end to end and the evaluator passes;
  - the capability table follows the simulated policy, not the assigned attributes;
  - the rejected metadata-update `play()` is recorded as `NotAllowedError` and not counted as played;
  - the trusted-Space retry resolves and plays.
- **Production-mutant packages** (identity forced to MATCH, so a behavioral criterion must catch them), each caught by the named criterion:

  | Mutant | Caught by |
  | --- | --- |
  | forced remute | PREF |
  | autoplay=false still plays | NOAUTO |
  | loop=false ignored | LOOP |
  | remembered volume lost | VOL |
  | previous generation not stopped | STALE |
  | close leaves the video active | CLOSE |
  | native recovery link removed | FAILN |
  | Space no longer retries | RETRY |
  | production re-mutes after a deliberate unmute | MUTE |

- **Evidence/evaluator faults**, all caught:
  - a rejected `play()` reported as resolved;
  - `playing` without a resolved `play()` or autoplay;
  - an old-generation failure shown on the new target;
  - the old video still holding its source;
  - identity mismatch;
  - trusted input outside a prompt;
  - a missing page;
  - an untrusted retry;
  - an untrusted Start.
- **The simulator is not browser evidence.**

## 6. Browser evidence still required

**G-PLAY(TC) controlled run:** the operator runs the package. Steps are in `tests/browser/ib11/README.md`. This is the only evidence that can move G-PLAY from OPEN.

**Separate IB11 browser checks** (item 9 "keyboard/focus/native-link browser checks"; item 12 "takeover/focus timelines, failure screenshots"). Not yet packaged:
- G3: Space with the native video control focused (double toggle or not);
- real focus behavior on open and close (F1/F2), including mouse versus keyboard origin;
- the native link after a real failure (C1), clicked for real;
- the visual effect of V-D4 (rotated fit) and V-D7 (blank while the original loads, on a real network);
- the V-D6 overlay left over during a real native navigation;
- real modifier chords (V-D5) without performing a favorite mutation. Any check here uses a stub-free fixture page; **no live favorite/account action**.

Live-site viewer checks are not needed for E0.

## 7. Which findings would justify P-stage changes (not decided here)

Within item 3's allowed scope, and subject to G-PLAY E for anything that touches playback handling:
1. **Staged placeholder** (V-D7). Show the target's preview/sample first, then upgrade on readiness, preserving transforms (E3 behavior; V-D4).
2. **Failure state durability and native link** (V-D1, C4).
3. **Safe takeover on synchronous build failure** (V-D6a/b). Hide the shell or show the failed state with the native link.
4. **Same-ID generation guard** (D4), as part of staging.
5. **Blocked-Play state** (G4). Only after G-PLAY E shows how the browser refuses, and with wording that matches the evidence.
6. **Modifier-chord filtering** (V-D5). Owner decision on the checkpoint.

**Out of scope** (§3 IB11 item 4): a viewer rewrite, a replacement shell, global media accounting, forced remute, loading the old post image as the new target, a page reader.

## 8. Gate statement

- **G-PLAY(TC): OPEN.** No controlled or browser playback evidence has passed. The jsdom simulator smoke qualifies the tooling only.
- G-OWN(viewer), G-SETTINGS and G-HOST / G-REQUEST: unchanged (PASS for the active TC path, per the Ledger).
- IB11: PARTIAL, E-stage. IB12 not started.
