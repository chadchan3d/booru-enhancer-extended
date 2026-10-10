# IB13 — E0 baseline: download lifecycle and honest outcomes

**Checkpoint:** IB13 — Download lifecycle and honest outcomes (Blueprint §3 IB13; v1.1 proportional qualification). **Stage:** E0 baseline (source audit and deterministic local characterization).

**Result: E0 baseline recorded.** No production change, no live probe, no real download.
- **G-DOWNLOAD-R: OPEN.** **G-DOWNLOAD-S: OPEN.**
- No download integration is claimed from the earlier runtime or request gates.

## 0. Synchronized identity

| Item | Value |
| --- | --- |
| Branch / HEAD | `implementation/ib00-baseline` at `3b2c27e4fc9cbfc7eab46e4f610434676a7b3ce1` = origin |
| Blueprint | Version 1.1 (9 October 2026), blob `fe2b98cd2f294fef4ed2cd0053dc9d13bff05be6` |
| Production | commit `11af9f6de2b47c7b9d13caffd211483102e69ae1`, blob `8d828cd852f74022cda79d4b2d2f86a16b137165`, body SHA-256 `d218b9a22b4e02f076a890a5af0d6df6da2a55605feb8d63d554599e1256085f` (unchanged by E0) |
| Prior state | IB12 COMPLETE, PASS(scope) |

All line numbers refer to `Booru_Enhancer.user.js` at blob `8d828cd`.

**Gate state at E0 start:**
- Recorded as passing for the Tampermonkey × Chrome (TC) path: G-RUNTIME (TC cell only), G-OWN, G-SETTINGS, G-REQUEST and the applicable G-HOST rows.
- **G-DOWNLOAD-R and G-DOWNLOAD-S: OPEN.** IB03 recorded download runtime semantics as explicitly `unvalidated` (`IB03_RUNTIME_PRIMITIVES.md`; `BE.runtime` capability `download: 'unvalidated'`, `:379`). It establishes no download completion or cancel semantics.

## 1. Current downloader (source)

Every expected fact was verified in source; there are **no deviations**.

- **Facade:** `BE.gm.download` (`_GM.download`, `:400–419`) is a direct compatibility facade: `GM_download` if it is a function, else `GM.download(opts)`, else a no-op returning `undefined`. There is **no** normalized `BE.runtime` download contract (`BE.runtime.download` does not exist).
- **`downloadPost(post)`** (`:2721–2789`):
  - It shows "Preparing download…". It resolves the original URL through `resolveOriginalUrl` (`:2702`): the post's own `originalUrl`, else `adapter.fetchPost(id)`, else `adapter.getOriginalUrl()`. No adapter defines `getOriginalUrl`, so that last branch is unreachable.
  - It builds `BE.naming.build(post) + '.' + BE.naming.extensionFor(post)` and calls `_GM.download({ url, name, saveAs: false, onload, onerror, ontimeout })` once.
- **Settlement:**
  - The `onload` / `onerror` / `ontimeout` callbacks **and** a returned Promise (`maybePromise.then(finishOk).catch(finishFail)`, `:2780`) all feed the same local `finishOk` / `finishFail`.
  - A local `settled` flag makes the JS settle only once. The returned Promise resolves `true` (success or fallback dispatched) or `false`.
- **The 8-second timer** (`:2784`): an independent `setTimeout(…, 8000)` calls `finishFail(new Error('GM_download timed out'))` if nothing has settled. It is never cleared.
- **Fallback:** `finishFail` **automatically calls `browserFallbackDownload()`** (`:2685`), a temporary `<a href download target=_blank rel=noopener>` that is clicked and removed.
  - The first manager transfer is **not cancelled**: the returned handle's `abort` is never called.
  - So **one user click can produce two underlying transfer opportunities**, while the JS Promise settles once.
- **Manager errors and timeouts** (`onerror`, `ontimeout`, Promise rejection) likewise cause an automatic second (anchor) dispatch.
- **Honesty of outcomes:** `browserFallbackDownload` returns `true` when `a.click()` did not throw. That proves only that a handoff was attempted, not that a file was saved. The UI then says "Download started via browser: …". "Download complete: …" is shown on the manager's `onload` / Promise resolution, which is a manager-reported completion.
- **`download.retries`:** read at `:2745` (`const retries = …`) and never used. It does not control attempts (IB00 already noted it as a stored compatibility key).

## 2. Entry surfaces

| Surface | Code path | Calls |
| --- | --- | --- |
| Thumbnail action bar "⭳ Download" | `handleThumbAction('download')` (`:4514`), after `enrichSinglePost` | `downloadPost(post)` |
| Viewer button "⭳ Download (d)" | `:3414` | `downloadPost(currentPost)` |
| Viewer key `keys.download` (default `d`) | `onKeydown` map (`:3519`) | `downloadPost(currentPost)` |
| Post-page action bar "Download" | `makeActionHandlers().download` (`:5305`), spec `:5390` | `downloadPost(getCurrentPost())` |
| Floating toolbar "Download" (post page only) | the same handler, spec `:5353` | `downloadPost(getCurrentPost())` |

- That is four `downloadPost` call sites (the post-page bar and toolbar share one handler) across five user surfaces.
- **No shared in-flight operation:** there is no per-post or per-file lock, map or coordination. Two surfaces, or two clicks on one surface, targeting the same post start two independent `downloadPost` operations (reproduced: E0-6).

**Open Original** (separate from download):

| Surface | Code | Honors `download.openMode`? |
| --- | --- | --- |
| Post-page action bar "Open Original", toolbar "Open Original" | `makeActionHandlers().openOriginal` (`:5310–5316`) | **Yes**: `popup` → `window.open(url, '_blank', 'width=1000,height=800')` (no `noopener`); otherwise `window.open(url, '_blank', 'noopener')` |
| Viewer button "⤢ Open original (o)" and viewer key `keys.openOriginal` (`o`) | `openOriginalInNewTab` (`:3439`, `:3416`, `:3521`) | **No**: always `window.open(url, '_blank', 'noopener')` |
| Thumbnail action "⤢ Open original" | `handleThumbAction('open')` (`:4516`) | **No**: always `window.open(url, '_blank', 'noopener')` |

All three use `originalUrl || sampleUrl || previewUrl`. The inconsistency is recorded, not fixed.

## 3. Deterministic E0 characterization

**Harness:** `tests/host/ib13/e0_downloader_baseline.cjs`. It runs the **real current production source** (item9 harness, jsdom) with a fake download manager, intercepted anchor clicks and fake time. No file is written and no real manager is used.
- **Fake manager modes:** `GM_download` with callbacks returning `{abort}`; `GM.download` Promise-only; and a `GM_download` that both calls back and returns a Promise.
- **Two counts per case:**
  - **logical JS outcomes:** `downloadPost` settlements and their one completion/fallback/failure toast;
  - **underlying dispatches:** manager calls plus anchor clicks.
- **Result: 13/13 baseline facts reproduced** (`e0-downloader-baseline-result.json`, URLs redacted). "Pass" means the current behaviour was reproduced, defects included.

| Case | Current-production fact | Logical / underlying |
| --- | --- | --- |
| E0-1 slow unresolved transfer past 8 s | Nothing happens at 7999 ms. At 8000 ms the anchor fallback dispatches while the manager attempt is still unresolved and **not aborted**; JS settles `true` with "Download started via browser". A later manager `onload` still arrives and is ignored by JS. | **1 / 2** |
| E0-2 manager `onerror` | An automatic anchor dispatch follows immediately | 1 / 2 |
| E0-2b manager `ontimeout` | The same automatic anchor fallback | 1 / 2 |
| E0-3 callback-only success before 8 s | One manager attempt, no fallback (the armed timer finds it settled) | 1 / 1 |
| E0-4 Promise-only success before 8 s | One manager attempt, no fallback | 1 / 1 |
| E0-4b Promise-only rejection | Automatic anchor fallback | 1 / 2 |
| E0-5 callback + Promise | (a) `onload` then the Promise resolves: settled once, one manager attempt. (b) `onload` then the Promise rejects: the rejection is ignored, no fallback. (c) The Promise rejects first: a fallback anchor is dispatched, and a later `onload` is ignored. One settlement does **not** mean one transport. | (a) 1 / 1, (b) 1 / 1, (c) 1 / 2 |
| E0-6 two calls, **same** post, before completion | Two independent manager attempts (same URL, no shared operation); after 8 s, two anchor fallbacks | **2 / 4** |
| E0-7 two **different** posts | Independent attempts and settlements: one succeeds, the other times out to its own fallback | 2 / 3 |
| E0-8 browser fallback | The intercepted click does nothing, yet `downloadPost` resolves `true` with "Download started via browser". Only the attempt is known, not file completion. | 1 / 2 |
| E0-9 `download.retries` 0 vs 10 | The effective setting changes, but the attempt count does not (1 manager call + 1 anchor in both) | 1 / 2 |
| E0-S static facts | Direct facade; no runtime download; 8 s timer; fallback inside `finishFail`; `retries` unused; 4 call sites; `openMode` read only by the post-page/toolbar handler | — |
| E0-N naming | §4 | — |

E0-7 is only a characterization of independence. No global lock is proposed from it.

## 4. Naming baseline (`BE.naming`, `:2617–2650`; synthetic tags)

| Aspect | Current behaviour (reproduced) |
| --- | --- |
| Template | Setting `download.filenameTemplate`, default `{character} - {artist} ({id})`. Fields: `character`, `artist`, `copyright`, `id`, `md5`, `rating`, `score`, `resolution` (`WxH` or empty), `date` (`createdAt` first 10 characters). Unknown fields render as empty. |
| ID fallback | `{md5}` falls back to `post.id`. An empty generated name falls back to `post.id`, else `download`. |
| Character limit | `download.maxCharacters` (default 3) limits **characters only**. Artists and copyrights are not limited. |
| Tag delimiter | `download.tagDelimiter` (default `, `) joins characters, artists and copyrights. |
| Missing values | `Unknown Character`, `Unknown Artist`, `Unknown Copyright`. |
| Tag prettifying | Underscores become spaces; a trailing ` (qualifier)` is removed; words are title-cased. |
| Sanitation | `BE.dom.sanitizeFilename` (`:475`): replaces `/ \ ? % * : \| " < >` with `_`, collapses whitespace, trims, caps at **180** characters, and returns `untitled` if empty. Leading/trailing spaces, hyphens and commas are trimmed before sanitation. |
| Extension | From `originalUrl`, else `sampleUrl`, with the query stripped and case preserved (`JPG` stays `JPG`). With no extension: `mp4` for video, otherwise `jpg`. |
| Page-index naming | **Does not exist.** There is no `{page}` field (it renders as empty). `pageCount` exists on the Post model but is not used in naming. |
| Malformed input | A malformed object without the tag arrays makes `build` throw a `TypeError`. Production Posts (`emptyPost`, `:1731`, and the native parsers) always supply the arrays, and that shape builds normally. These are two separate scopes. |

## 5. Existing site-download premises (from repository evidence only; no live discovery)

| Site | Original-media URL | Native original link | Origin / CDN | Cookies / referrer / headers for download | Redirects | Enhanced download qualified |
| --- | --- | --- | --- | --- | --- | --- |
| **Rule34.xxx** | Native DOM fact on the image post (IB07 V1-N). Not on listing cards; the listing yields thumbnails only. | Explicit native **Original image** link (IB07) | `wimg.rule34.xxx`, path shape `/images/<bucket>/<hash>.jpeg?<postId>` (IB07, recorded) | **UNKNOWN** (never measured) | **UNKNOWN** | **No** |
| **e621.net** | Native DOM fact: listing `data-file-url` and post `#image-container` (IB07 V1-N, IB08) | Native "view original" link to the same URL, plus a native **Download** link (IB07) | **UNKNOWN** (the original host was not recorded) | **UNKNOWN** | **UNKNOWN** | **No** |
| **e926.net** | Native DOM fact, observed independently (IB07 V1-N) | Native "view original" link and native Download link (IB07, observed on e926 itself) | **UNKNOWN** | **UNKNOWN** (not inferred from e621) | **UNKNOWN** | **No** |
| **Gelbooru.com** | Native original link on the image post (IB07 V1-N); none on listing cards | Matched `li a[href*="/images/"]`; `a.download-link` / `a[download]` did not match (IB07) | Media served from another origin; **host not recorded** (IB07) | **UNKNOWN** | **UNKNOWN** | **No** |

Media loading (IB08 renditions, IB10 hover video of e621/e926 original files) is not download evidence. Whether `GM_download` needs `@connect` permission for a media origin was never measured: **UNKNOWN**.

## 6. Runtime boundary

- **`G-DOWNLOAD-R(Tampermonkey × Chromium, mode)` — OPEN.** Every other runtime download cell (VC, TF, VF; Safari deferred) is **OPEN**: no evidence says otherwise (Blueprint §8: Downloads R7 OPEN—NOT RUN).
- **`G-DOWNLOAD-S(site, cell)` — OPEN for every site.**
- IB03 runtime qualification does **not** establish download completion or cancel semantics.

## 7. Recommended single next step: V8-R(TC) manager-outcome observation (not built)

**One controlled experiment in Tampermonkey × Chromium,** using a **local controlled fixture server**, never a booru site. It is run only after explicit owner authorization of the controlled test and a dedicated download directory. It measures what the real manager exposes, for one file per case, against a tiny probe page.

| # | Case (fixture server behaviour) | What is recorded |
| --- | --- | --- |
| 1 | Capability | `typeof GM_download`, `GM.download`, the `GM_info` download mode/permissions; whether the call is available at all → **unavailable** vs available |
| 2 | Small file, immediate 200 | Return value (handle with `abort`? Promise?); which callbacks fire (`onload` / `onprogress` / `onerror` / `ontimeout`) and in what order; Promise settlement; timings → **dispatch**, **manager-reported completion** |
| 3 | Slow file (> 12 s, trickled) | Whether progress events are exposed (**progress**); the state at 8 s (unresolved); the final completion; whether `abort()` is honoured (**cancel**). One dispatch only. |
| 4 | 404 / 403 | **Manager-reported failure** and its shape (`onerror` details) |
| 5 | Redirect 302 → 200 | Whether the manager follows it and reports completion |
| 6 | Operator cancels in the browser download UI (or `saveAs` dialog dismissed) | Whether any callback or Promise reports it, or it stays **unresolved/unknown** |

- **Outcomes to normalize:** only the ones the real manager can expose — capability unavailable / dispatched-handoff / progress (if exposed) / manager-reported completion / manager-reported failure or cancel / unresolved-unknown.
- **Controlled evidence:** the fixture server logs request count per file, so underlying dispatches are counted independently of callbacks. The saved file length and digest are compared against the served bytes in the dedicated directory, the only saved-file evidence.
- **Not included:** no booru site, no cookies or referrer (those belong to V8-S per site), no other runtime cell, no production integration.

## 8. Explicit exclusions (E0)

- No production change (production stays byte-identical to `11af9f6`), no V8-R probe built or run, no real download, no P-stage repair.
- No fix of the Open Original `openMode` inconsistency, no page-index naming, no lock or single-flight.
- No live site discovery; e926 is not inferred from e621.

## 9. Outcome

**IB13 — E0 baseline: recorded.** **PARTIAL—NOT COMPLETE** (E stage open). G-DOWNLOAD-R and G-DOWNLOAD-S are **OPEN**. The next step is the single V8-R(TC) experiment above, after owner authorization.

**Provenance:** no donor code; source inspection and local tests of this repository only (MIT).
