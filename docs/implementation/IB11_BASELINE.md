# IB11-E0 — Existing viewer baseline characterization and G-PLAY evidence preparation

**Checkpoint:** IB11 — Existing viewer hardening (Blueprint §3 IB11). **This step is E0 only:** characterize the existing viewer and prepare the G-PLAY evidence tooling. No production change, no IB11 P work.

**Invariant (Blueprint §3 IB11 item 2):** "The viewer shows the selected target's usable placeholder, preserves transformations/preferences and offers native recovery when loading or playback fails."

**Status:** **IB11 — PARTIAL, E stage.** **G-PLAY(TC): E → PASS(scope)** (§10). The remaining IB11 browser evidence (keyboard, focus, native link, visual V-D4/V-D6/V-D7) is OPEN; its probe, V-VIEW, is built and locally qualified (§11) and awaits the operator run. No production change. IB12 is not started.

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
| V-D5 | Viewer keys act on Ctrl/Meta/Alt chords, including Favorite on Ctrl+F (G2). | §6 "Fit/zoom/pan/rotate/flip/key navigation: keep"; AGENTS forbids unintended favorite mutation. | **Owner decision (IB11-E2): yes, in IB11.** A narrow viewer-key modifier guard; see §10. |
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

## 9. IB11-E1: first controlled G-PLAY run, evaluator correction (revision 1.1), targeted DELIB recovery

**Raw run (operator, TC: Chrome 154 + Tampermonkey 5.5.0):** `ib11-gplay-results.json`.
- SHA-256 `13888dd91061da37d939085172e175222552ec93ad5d56dc1ee118d96c630048`, verified.
- The file is not committed (`.gitignore`) and is never modified.
- All 4 pages report `MATCH_EXPECTED_ARTIFACT`. The arm U Start clicks were trusted.

**Revision 1.0 (as committed at `b1dbaa9`):** reproduced exactly.
- Complete, no page failures; **28 PASS / 4 FAIL**.
- Failing cells: N-mp4-LOOPF, N-webm-LOOPF, U-mp4-DELIB, U-webm-DELIB.

**LOOPF: an evaluator defect, not a product failure.** In both cells (loop=false), the genuine `ended` came before the close: MP4 at seek + 1064 ms (16733); WebM at seek + 1066 ms (16594).
- **MP4:** Escape at 19671. Production's cleanup ran at once: pause, `removeSrc`, `load()`. Then `abort`, `emptied` and a `currentTime` reset to 0 followed at 19672.
- **WebM:** the same pattern, with Escape at 19530 and the reset at 19531.
- **The defect:** the recorder logs a backwards time jump as "wrap". Revision 1.0 counted every wrap after the near-end seek, so the reset caused by cleanup was read as looping.
- **Same artifact on LOOPT:** both LOOPT cells show this reset wrap after close too. Under 1.0, a cleanup reset alone could have satisfied loop=true. Here they also had a genuine pre-close wrap (MP4 22096, WebM 21945).

**Correction: revision 1.1.**
- **LOOP rule:** LOOP is judged only while the tested media is live. It counts events after the near-end seek and before the close/reset boundary. The boundary is the first of: the cell's Escape, a production `removeSrc` on that video, or an `abort`/`emptied` on it.
- **Genuine detection is unchanged:** loop=false needs a pre-boundary `ended` and no wrap; loop=true needs a pre-boundary wrap and no `ended`.
- **Also new in 1.1:** DELIB requires actual playback of A before the Unmute, and there is an explicit recovery merge.

**Re-evaluation of the same raw file under 1.1:** complete, no page failures, **30 PASS / 2 FAIL**.
- N-mp4-LOOPF and N-webm-LOOPF now PASS (boundary ≈ 4002 ms after the seek; ended 1, wrap 0).
- Both LOOPT cells still PASS on their genuine wrap (wrap 1, ended 0).
- The only failures are U-mp4-DELIB and U-webm-DELIB.

**Capability table (actual browser behavior; preferences preserved in every cell):**

| Cell | N-mp4 | N-webm | U-mp4 | U-webm |
| --- | --- | --- | --- | --- |
| PREF (muted autoplay) | PLAYED | PLAYED | — | — |
| UNMUTED (autoplay, mute off) | BLOCKED | PLAYED | PLAYED | PLAYED |
| NOAUTO | IDLE | IDLE | — | — |
| LOOPF / LOOPT | PLAYED / PLAYED | PLAYED / PLAYED | — | — |
| RVOFF / RVON | PLAYED / PLAYED | PLAYED / PLAYED | — | — |
| PLAYREJ / PLAYAPI (`updatePost` `play()`) | BLOCKED (NotAllowedError) | PLAYED (resolved) | PLAYED | PLAYED |
| FAIL | ERROR (+ native link) | ERROR (+ native link) | — | — |
| CLOSEPEND | CLOSED_BEFORE_READY | CLOSED_BEFORE_READY | — | — |
| CLOSEPLAY / STALE | PLAYED / PLAYED | PLAYED / PLAYED | — | — |
| RETRY | PLAYED (blocked → trusted Space → resolved) | PLAYED | — | — |
| DELIB | — | — | PLAYED; no Unmute (prompt timeout) | PLAYED; no Unmute (prompt timeout) |

**Reading the table:**
- **Arm N without activation:** unmuted autoplay of the MP4 fixture was blocked, and its programmatic `play()` was rejected with NotAllowedError. The same cells on the WebM page played; the WebM page ran after the MP4 page's trusted Space retry.
- **No support claim:** the evaluator makes no general autoplay-support claim from this. It records what each cell did, and a blocked capability counts only with the tested fallback (RETRY passed).

**DELIB: missing evidence, not a product result.** Both cells played A (trusted Start), but `promptInputs` was 0. The `unmute` mark is untrusted, exactly 120 s after playback began: the evidence runner's prompt timed out and the cell continued. No inference is drawn from those cells.

**Targeted recovery (prepared; operator pending).** Only U-mp4-DELIB and U-webm-DELIB are re-run.
- **Package:** `IB11_GPLAY_Recovery.user.js` (SHA-256 `199cbb19…fb58`). It is the evidence package with 5 declared runner-only patches:
  - a large centered prompt with an "ACTION NEEDED" tab title;
  - a 3-minute prompt timeout that makes the attempt INVALID: no cell, error posted, no advance;
  - playback required before the Unmute prompt;
  - the failed cell is dropped from an errored attempt;
  - no navigation on error.
- **Unchanged:** the evidence-run package `IB11_GPLAY_Controlled.user.js` and `gplay_postamble.js` stay byte-identical (`3c613d11…078a`).
- **Server:** `gplay_server.cjs --recovery`. It keeps INVALID attempts with attempt numbers, refuses a second valid attempt for a page (409), and finishes only with one valid attempt per page.
- **Merge:** `gplay_evaluate.cjs <original> --recovery <recovery>` (revision 1.1). It accepts only the two recovery cells, each from exactly one valid attempt (identity MATCH, trusted Start, no error). It rejects ambiguous, foreign, missing and wrong-probe recoveries. It records both files' SHA-256 values and lists every replaced cell with its original and recovery status. The original document is never modified.
- **What a recovered DELIB cell must show:**
  - trusted Start;
  - A actually played;
  - a trusted Unmute while the prompt was active;
  - A unmuted, with no production re-mute;
  - navigation to B;
  - B starting muted (the stored preference) at A's remembered volume;
  - normal release.

**Local qualification:**
- `verify_ib11_gplay.cjs` **37/37**. That is the previous 28 plus:
  - the simulator now models Chrome's release reset and reproduces the artifact;
  - revision 1.0 (read from git `b1dbaa9`) fails both LOOPF cells on it, and 1.1 passes them;
  - 7 LOOP controls: loop=false with a genuine ended plus cleanup resets passes; loop=false with a pre-close wrap fails; loop=false without ended fails; loop=true with a pre-close ended fails; loop=true without a pre-close wrap fails; loop=true whose only wrap is the cleanup reset fails; and the same when the boundary is a `removeSrc` without Escape.
- `verify_ib11_gplay_recovery.cjs --media <fixtures>` **28/28**:
  - **static:** recovery = evidence package + exactly the declared patches; evidence package unchanged; plan;
  - **server:** INVALID kept and no advance; valid advances; duplicate refused; finishes correctly;
  - **smoke:** an unanswered original gives 30/2; the recovery smoke passes; the merge passes 32/32 with provenance and an untouched original;
  - **faults (all caught):** timeout → INVALID, not evidence; no playback → INVALID; ambiguous, foreign, missing, wrong-probe, identity and untrusted-Start recoveries rejected; untrusted Unmute rejected; no playback before the Unmute rejected; and three production mutants in the recovery package (re-mute after unmute; mute preference ignored; remembered volume lost).

**Gate statement.** **G-PLAY(TC): OPEN (PARTIAL).** 30 of 32 cells pass on real Chrome evidence under revision 1.1. G-PLAY E cannot pass until both DELIB recovery cells pass and the merged evaluation passes. No production change.

## 10. IB11-E2: DELIB recovery ingested; G-PLAY(TC) E → PASS(scope)

**Repository at ingestion:**
- `e2ec05e` = origin, clean;
- production `4d793a2` / blob `002bdfd`, body SHA-256 `00915584…e945`, unchanged;
- `gplay_evaluate.cjs` unchanged since `e2ec05e` (revision 1.1).

**Raw evidence.** Neither file is committed (`.gitignore`), and neither was modified.

| File | SHA-256 | Verified |
| --- | --- | --- |
| Original run `ib11-gplay-results.json` | `13888dd91061da37d939085172e175222552ec93ad5d56dc1ee118d96c630048` | yes |
| DELIB recovery `ib11-gplay-recovery.json` | `ebd4f57ce2ecf3d93037ebbbe28104fed0ae83b4a203827a2e7b32bc91485a90` | yes |

**Recovery review (raw file, independently of the evaluator):**
- **The file:** probe `ib11-gplay-recovery`, recovery cells exactly U-mp4-DELIB and U-webm-DELIB. Two pages, one attempt each (attempt 1). Identity `MATCH_EXPECTED_ARTIFACT`, trusted Start, no page error. Chrome 154 + Tampermonkey 5.5.0.
- **Inputs:** each cell had `trustedOutsidePrompt` 0 and `promptInputs` 2 (the pointerdown and click on Unmute).
- **U-mp4-DELIB:**
  - A played from 1981 (before the Unmute at 3754).
  - The Unmute was trusted. The harness wrote muted=0 at 3735, and `volumechange` reported muted 0 at 3754.
  - There are no production `muted` writes. A kept playing unmuted until navigation (maxTime 3.63 s) and ended muted 0.
  - ArrowRight at 5756 created B at 5757. B was assigned muted=true and defaultMuted=true at volume 0.37 (A's volume), and B played.
  - At the cell end both A and B are detached, hold no source, and are paused.
- **U-webm-DELIB:** the same pattern. A played from 1322; Unmute at 2546 (trusted; harness write at 2522); no production remute; maxTime 3.14 s; B created at 4551, muted at 0.37; both released.

**Official merged evaluation:** `node tests/browser/ib11/gplay_evaluate.cjs "tests/browser/ib10/ib11-gplay-results.json" --recovery "tests/browser/ib10/ib11-gplay-recovery.json"`.
- **Exit 0.** Revision 1.1, `complete: true`, no missing pages, no page failures.
- **Merge:** no problems and no invalid attempts. It replaced exactly U-mp4-DELIB and U-webm-DELIB, each FAIL → PASS from recovery attempt 1, with the recovery hash recorded.
- **Result:** **32/32 PASS** (30 from the original, 2 from the recovery). `pass: true`, with both file hashes in the provenance.

**Gate decision: G-PLAY(TC), E → PASS(scope).**
- **Scope:** only the measured TC cell (Chrome 154 + Tampermonkey 5.5.0) and the controlled local MP4/WebM fixtures of this evidence.
- **Not claimed:** autoplay support in general, other browsers or managers, live sites, or other media.

**Measured capabilities and limitations:**
- **Preferences:** autoplay, loop, mute (muted and defaultMuted), remember-volume and the stored volume are assigned exactly as saved. There is no forced remute anywhere.
- **autoplay=false:** stays IDLE, with no production `play()` (both containers).
- **Muted autoplay:** played without user activation (N-mp4 PREF).
- **Unmuted autoplay without activation (MP4 only):** BLOCKED. The metadata-update `play()` was rejected with **NotAllowedError**. Nothing reported it as playback; native controls stayed available.
- **Play fallback:** after the block, a trusted **Space** press (production `togglePlayPause`) resolved `play()` and played (N-mp4 RETRY).
- **WebM unmuted playback and the WebM `updatePost` `play()` resolved, but with user activation already present.** The N-webm page recorded `navigator.userActivation.hasBeenActive = true` before every cell. Chrome carried activation from the previous page's trusted Space press across the same-origin navigation, so N-webm was not a no-activation measurement. WebM RETRY was therefore NOT_BLOCKED and the fallback was not exercised on WebM. **Limitation:** no-activation behavior and the blocked → Play fallback are evidenced for MP4 only; nothing indicates that WebM differs from MP4.
- **Arm U (activation by the trusted Start):** unmuted autoplay and the `updatePost` `play()` played and resolved on both containers.
- **Loop:** loop=true wraps and loop=false ends (revision 1.1 LOOP rule). **Remember-volume:** on, the volume is restored and stored; off, the volume is 1 and nothing is stored.
- **Deliberate unmute:** it persists for the current media (no production remute). The next target starts according to the saved mute preference (muted) at the remembered volume.
- **Failure and cleanup:** a media failure shows the failed state with a native post link. Close during a pending load or while playing, and stale-target replacement, release the old media (no playback after close; detached, no source, paused).

**Owner decision recorded (IB11-E2): V-D5 belongs in IB11.**
- Viewer Ctrl/Meta/Alt chords must not trigger ordinary viewer commands. In particular, Ctrl+F must not invoke Favorite and Ctrl+D must not invoke the viewer download.
- The eventual repair is a narrow viewer-key modifier guard that preserves normal unmodified viewer keybinds and browser shortcuts.
- This authorizes eventual IB11 P scope only; no production edit is made here.
- No other §4 finding is decided.

**Remaining IB11 E-stage browser evidence (still OPEN).** These must be resolved before the P repair scope is frozen.

| Area | Open question |
| --- | --- |
| Keyboard | G3 (Space while the native video control has focus: single or double toggle); real modifier chords (V-D5; the browser default is suppressed today). |
| Focus | F1/F2 with real mouse and keyboard origins: what has focus after open; return on Escape and on ✕; Tab order behind the overlay. |
| Native link | C1: a real click on "Open native post" after a real failure navigates to the native post. |
| Visual | V-D4 (rotated fit overflow on a real resize); V-D6a (overlay left shown during the real native navigation after a synchronous takeover failure) and V-D6b (blank viewer after in-viewer navigation); V-D7 (blank stage while a large original loads on a slow transport). |

**Proposed next probe (IB11-E3 "V-VIEW"; specification only, not built in this step).** The same pattern as G-PLAY:
- production `4d793a2` unchanged inside an observe-only recorder and runner;
- the local server on its own port, serving a generated image (a plain PNG made on the server, so no third-party content);
- a throttled "original" transport, a 404, a native post page that records arrival, and the G-PLAY video fixtures;
- results in the same sanitized JSON shape, plus real layout measurements: `getBoundingClientRect` of the media and stage, `complete`, `naturalWidth`, the overlay display state and `document.activeElement` descriptors.
- Favorite and download are stubbed **in the test page only**, so no account or download action can occur.

Automated cells (no operator input):
- **V-D7:** open an image card whose original is throttled; sample the stage at 300 / 1000 / 3000 ms (rendered area, state text).
- **V-D4:** open a 2000×1000 image; rotate via the toolbar; send a resize; measure the rendered box against the stage.
- **V-D6b:** in-viewer ArrowRight onto a video while the test store holds volume 1.5; measure the stage and any message.
- **V-D1:** a real 404, then a same-ID update; record the state and link before and after.
- **V-D5:** synthetic Ctrl/Meta chords; record which viewer command ran (stubs) and `defaultPrevented`.

Operator actions (about 6 in total, roughly 3 minutes):
1. **V-D6a:** with volume 1.5 stored, the operator clicks a video card. The page records the overlay state until `pagehide`; the native post page records its arrival.
2. **C1:** after a real failure, the operator clicks "Open native post"; the native page records the arrival.
3. **Focus (mouse):** the operator clicks a card, then presses Escape; `activeElement` is recorded at each step.
4. **Focus (keyboard):** the operator tabs to a card link and presses Enter, then clicks ✕.
5. **G3:** the operator clicks the video's native play/pause control, then presses Space once; play/pause transitions are counted.

Every prompt uses the large-panel / INVALID-on-timeout pattern from the recovery package, and evaluation would be by explicit criteria with fault controls.

**Status:** IB11 PARTIAL, E stage. G-PLAY(TC) PASS(scope); the other IB11 browser evidence is OPEN. No production change; no P work; IB12 not started.

## 11. IB11-E3: V-VIEW browser-evidence probe (built, locally qualified; operator run pending)

**Synchronization:**
- `dddc3dd` = origin, clean;
- production `4d793a2` / blob `002bdfd` / body `00915584…e945`;
- G-PLAY(TC) PASS(scope); IB11 PARTIAL at the E stage; IB12 not started.

**Package:** `tests/browser/ib11/IB11_VVIEW_Controlled.user.js` (SHA-256 `b7bd9ce93f1d0883a92a927dd0909ac637ab93fc553edb1d27531367ea19bd8f`).
- **Build:** `build_ib11_vview.cjs` from `4d793a2`. The executed body is byte-identical to the production body (SHA-256 `00915584…e945`), checked by the verifier. No hooks; a test-only location shim (`e621.net`).
- **Scope:** only `http://127.0.0.1:8797/*`.
- **Recorder:** `vview_preamble.js` (observe-only).
  - It records viewer `<img>`/`<video>` events and `play()`/`pause()` callers.
  - It records the synchronous-failure **seam**: an exception from a media `volume` assignment is recorded (name; whether `buildMedia` was on the stack) and **rethrown unchanged**.
  - Why a seam probe is needed: the V-D6a throw is caught by production's gallery, so no window error would show it.
- **Runner:** `vview_postamble.js`.
  - Prompt discipline: a large yellow top panel; the tab title "ACTION NEEDED"; each prompt records `isTrusted`; a 3-minute timeout makes the page INVALID (posted, not advancing, F5 to retry); trusted input outside a prompt is counted against the running cell.
  - **Favorite and Download are replaced by recording stubs in the test page only.**
- **Server:** `vview_server.cjs`.
  - Generated deterministic plain PNGs: thumb 160×80; wide 2000×1000; slow 1600×800 noise of 3,842,038 B, with its first byte held 1.5 s and then streamed at 512 KiB/s (about 8.8 s).
  - A 404 route; the IB10 WebM fixture.
  - The e621 native route `/posts/<id>` as the controlled destination: it records the arrival (page and card), then forwards.
  - Attempts are kept with numbers.

**Cells:**

| Cell | Drive | Evidence (PASS requires) | Product finding |
| --- | --- | --- | --- |
| VD7 | open the slow-original card; sample at 300 / 1000 / 3000 ms; wait for completion | open; nonzero stage; early media = the slow original route, **not complete at 300 ms**; completes later at 1600×800; route requested | DEFECT_CONFIRMED if no visible staged placeholder at 300 and 1000 ms (detail: original's visible area, loading text) |
| VD4 | fit-both; open the 2000×1000 image; toolbar rotate; **two real F11 resizes** (trusted `resize`) | trusted resizes; complete at 2000×1000; unrotated fit inside the stage; `rotate(90deg)`; nonzero boxes | DEFECT_CONFIRMED if the rotated media box exceeds the stage after either real resize |
| VD6B | open an image, arm stored volume 1.5, ArrowRight onto the video card | valid start; seam threw from `buildMedia`; selection moved to the failing target | DEFECT_CONFIRMED if open with no media, no state, no link |
| VD1 | real 404 → failure state, then `updatePost` with the same post | real failure (error event, 404, state + link) | DEFECT_CONFIRMED if state and link are erased |
| VD5SYN | synthetic Ctrl+F / Ctrl+D | control only | CONTROL_ONLY |
| VD5 | **trusted Ctrl+F, Ctrl+D** with the viewer open | both trusted, ctrlKey, right key (synthetic is INVALID) | per chord: Favorite/Download stub invoked, `defaultPrevented` (browser shortcut suppressed) |
| G3 | **click the native play/pause control, then Space** | trusted click on the video, trusted Space; focus at Space = video (premise) | one effective toggle = BEHAVIOR_OK; zero or two = DEFECT_CONFIRMED (records production handler and `defaultPrevented`) |
| FOCUS_M | **mouse click** on the pink card, **Esc** | trusted inputs; invoker in the card; opened/closed; descriptors | OBSERVED (focus before, after open, before close, after close; returned to invoker) |
| FOCUS_K | **Tab → Enter** on the blue card, **Tab ×3**, **click ✕** | same, plus 3 trusted Tabs | OBSERVED (plus whether Tab leaves the overlay) |
| NATIVE | real 404 → **click "Open native post"** | link visible (nonzero box); trusted click; page left; destination arrival recorded | BEHAVIOR_OK if native recovery navigated |
| VD6A | page 2: armed seam, **ordinary click** on the video card | trusted click; seam threw; overlay state recorded; a page exit without arrival is a FAIL | separates "overlay left shown (blank) while native navigation proceeds", "native recovery blocked", and BEHAVIOR_OK (failure shown with a native link, or no overlay) |

**Evidence versus finding.** The probe characterizes; it does not require conformance.
- Evidence PASS means the cell validly and unambiguously observed what it is designed to observe.
- The product finding is reported separately: DEFECT_CONFIRMED, DEFECT_NOT_REPRODUCED, BEHAVIOR_OK, OBSERVED, or CONTROL_ONLY.
- A confirmed defect has evidence PASS.
- Page rules:
  - exactly one valid attempt per page (more is AMBIGUOUS, a FAIL);
  - INVALID attempts are listed, never used;
  - identity must match.

**Local qualification: `verify_ib11_vview.cjs --media <fixtures>` 45/45** (`IB11_VVIEW_VERIFICATION.json`; `IB11_VVIEW_SHA256SUMS.txt`).
- **Static:** package current; body byte-identical with hash; local-only scope; plan (FOCUS_K first, VD6B_A then VD6B_B, `/posts/<id>` links); deterministic fixtures; refusal without fixtures.
- **Server (real HTTP):** page served; slow first byte ≥ 1.4 s; 404; `/posts/<id>` records the arrival and forwards; INVALID attempts kept.
- **Smoke** (jsdom + `vview_sim.cjs`, which simulates images, layout, video, focus, navigation and operator input; **not browser evidence**):
  - both pages valid; evidence PASS on all 11 cells;
  - findings equal the source-characterized behavior: V-D7, V-D4, V-D6b, V-D1, V-D5 and V-D6a DEFECT_CONFIRMED; single Space toggle; native link navigates; V-D6a "overlay left shown; native recovery not blocked".
- **Evidence and evaluator faults (all caught):**
  - untrusted Enter; synthetic Ctrl+F; untrusted F11 resize; programmatic native-link click;
  - wrong fixture route; route never requested;
  - no native arrival (MAIN and TAKEOVER);
  - no invoking element;
  - zero or missing dimensions (two cells);
  - original complete at the early sample;
  - seam did not throw (V-D6b, V-D6a);
  - G3 premise not met; trusted input outside a prompt;
  - ambiguous duplicate attempts;
  - stubs not invoked → DEFECT_NOT_REPRODUCED (distinguishable);
  - a double toggle distinguished from a single one;
  - wrong result type.
- **Package faults (all caught):**
  - wrong production artifact → MISMATCH;
  - missing prompt action → PROMPT_TIMEOUT, INVALID panel and title;
  - production not suppressing the native Space → a double toggle detected.
- **Repair probes** (candidate production changes applied to test copies only; not chosen fixes). Each flips its finding:
  - a staged preview placeholder (V-D7 → BEHAVIOR_OK);
  - a rotation-aware fit (V-D4 → BEHAVIOR_OK);
  - a build failure shown as the failed state (V-D6b → BEHAVIOR_OK);
  - same-URL update keeps the failure (V-D1 → BEHAVIOR_OK);
  - a viewer-key modifier guard (V-D5 → DEFECT_NOT_REPRODUCED);
  - safe takeover with a native link (V-D6a → BEHAVIOR_OK).

**Operator runbook** (Chrome + Tampermonkey, normal profile; about 4 minutes)


**Before:**
1. Start the server: `node tests/browser/ib11/vview_server.cjs --media <fixture folder> --out <fixture folder>/ib11-vview-results.json`. It must print "media SHA-256 verified; 2 pages".
2. In Tampermonkey, **disable** every other script (including the G-PLAY scripts) and install **`IB11_VVIEW_Controlled.user.js`**.
3. Use a normal (not full-screen) window. Open `http://127.0.0.1:8797/vview/start`.

**Page 1 (MAIN).** First, **hands off for about 30 seconds** while the panel at the top says "running automatic checks". Then answer each yellow instruction exactly once. When input is needed, the tab title reads ">>> ACTION NEEDED <<<".

| # | Instruction shown | What you do |
| --- | --- | --- |
| 1 | Press F11 once | Press **F11** (the page goes full screen). Wait. |
| 2 | Press F11 again | Press **F11** (back to normal). |
| 3 | Hold Ctrl and press F once | Press **Ctrl+F**. If a Find bar appears, press **Esc** to close it (you have 6 s; that Esc is not counted). |
| 4 | Hold Ctrl and press D once | Press **Ctrl+D**. If a bookmark dialog appears, press **Esc**. |
| 5 | Click the play/pause button at the bottom-left of the video once | **Click** that button once. |
| 6 | Press the Space bar once | Press **Space** once. |
| 7 | Click the PINK-outlined card once | **Click** the pink-outlined card with the mouse. |
| 8 | Press Escape once | Press **Esc**. |
| 9 | Press Tab until the BLUE-outlined card is focused, then press Enter | Press **Tab** (usually once) until the panel says "✓ … press Enter now", then press **Enter**. |
| 10–12 | Press Tab once (1 of 3), (2 of 3), (3 of 3) | Press **Tab** once for each. |
| 13 | Click the ✕ (Close) button … | **Click ✕**, the last button of the toolbar at the bottom. |
| 14 | Click the underlined "Open native post" link … | **Click** the link. The page changes to "Native post page reached", then continues by itself. |

**Page 2 (TAKEOVER):**

| # | Instruction shown | What you do |
| --- | --- | --- |
| 15 | Click the ORANGE-outlined video card once | **Click** it. The page changes to "Native post page reached", then to the done page. |

**After:**
- **Done:** the server prints "all pages complete". Return **`ib11-vview-results.json`**. Do not open DevTools or the JSON during the run.
- **If the panel ever shows INVALID:** press **F5** to retry that page. An INVALID attempt is never evidence.

**Known limits of the probe:**
- **V-D4:** the real resize comes from F11 (fullscreen in/out). The window is not resized by script.
- **V-D6a:** the overlay is measured right after the click dispatch and at page exit. The visual duration until the next page commits is the browser's.
- **VD5:** a recorded `defaultPrevented` = true means production suppressed the browser shortcut; the probe does not inspect browser chrome.
- **G3:** the premise requires the click on the native control to focus the `<video>`. If Chrome does not do that, the cell reports INVALID with the focused element, and the premise needs a different approach.

**Remaining after the future run:** evaluate it; record the raw SHA-256 (the file is not committed); settle the P repair scope from the confirmed findings and the owner decisions; then IB11 P. G-PLAY(TC) PASS(scope) is unchanged.
