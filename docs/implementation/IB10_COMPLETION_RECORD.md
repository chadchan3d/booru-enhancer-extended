# IB10 — Checkpoint completion record

**Checkpoint:** IB10 — Muted hover-video lifecycle (blueprint §3 IB10)

**Outcome:** **COMPLETE — PASS(scope)** at production `4d793a2` (closed 2026-10-06; `IB10_P_STAGE.md` §9).

**History:**
- first recorded PASS(scope) at `8a4d6d8` (production `8324552`);
- reopened at `2ee86be` for Blueprint conformance (`IB10_P_STAGE.md` §8);
- corrected in `4d793a2`;
- closed after the targeted browser conformance passed.

> **Reopen and correction (2026-10-05).** This record is kept as historical evidence.
> - **Why reopened:** the Blueprint's "Poster fallback elsewhere" (§3 IB10 item 3; item 11 and the G-VIDEO row "poster/View") was not implemented at `8324552`. Unqualified video cards still auto-played.
> - **Correction:** this record said that keeping the old automatic hover video outside the admitted class was an owner decision or owner instruction. **That was not an owner decision.** The owner chose Blueprint enforcement.
> - **Fix:** production `4d793a2` (blob `002bdfd`) applies the poster/View fallback to every recognized video card outside the admitted class.
> - **Unchanged:** the admitted-class evidence and gate rows below stand.
> - **Closed (2026-10-06):** the targeted browser conformance of `4d793a2` passed (evaluator revision 1.2, both hosts; see Tests). IB10 is COMPLETE, PASS(scope).

**Evidence gate owned (§5):** G-VIDEO (class, cell)

**Record date:** 2026-10-05 (first record); 2026-10-06 (reopen closure)

The fields follow the blueprint §11 "Required checkpoint completion record". Detailed records:
- `IB10_HOVER_VIDEO_BASELINE.md` (local characterization, defects D1–D4);
- `IB10_V3C.md` (controlled byte/lifecycle experiment);
- `IB10_V3L.md` (representative live evidence, G-VIDEO E gate);
- `IB10_V3R.md` (revisit/cache discriminator, retention decision);
- `IB10_P_STAGE.md` (production change, local qualification, conformance).

## Identity

| Item | Value |
| --- | --- |
| Checkpoint | IB10 — Muted hover-video lifecycle |
| Executor | Implementing agent; browser evidence by the operator (ChadChan3D) |
| Source before | `Booru_Enhancer.user.js` blob `22e843cbe27662fc27d17149534b055d7a249dae`, commit `b9d133c` (the IB09 artifact) |
| Source after | blob `002bdfd1a88adf8ed851df7ed768e6189e2bc958`, commit `4d793a2` (poster/View fallback). Admitted-class P evidence was taken on blob `4258ad7746c022606f222fc48924055912de4cfc`, commit `8324552`; `4d793a2` adds 5 lines that only admitted cards bypass |
| Common artifact hash | Final: production body SHA-256 `009155841b194df21a4e1d22bd3f40b5d63e2f58cfa5485b06fd4e66bd64e945`. The PF package executes it byte for byte, and all four targeted sessions reported `MATCH_EXPECTED_ARTIFACT`. Earlier P evidence: body `7a0a2b49cde6feb12b28c8a667694e7a7a6a91db50e8e8959dade6bc5fc6bb3a` (`8324552`); both P packages executed it byte for byte, and every controlled and live session reported `MATCH_EXPECTED_ARTIFACT` |

## Scope

| Element | Qualified value |
| --- | --- |
| Runtime cell | TC only: Chrome 154 (Chromium) + Tampermonkey 5.5.0. Production has no runtime-cell identity, so behavior is not cell-gated (as in IB04–IB09); the support claim is TC only |
| Hosts / route / login | e621.net and e926.net, native `/posts` listing, logged out (IB08 rendition fact `NATIVE_UNSUPPORTED`, which arises only on the IB08-admitted page) |
| Class | e621.net WebM, `data-size` ≤ 100,000,000 B; e926.net MP4, `data-size` < 50,000,000 B (≤ 49,999,999); numeric `data-size`; `data-file-url` of the same container |
| Source | the card's own original file (`data-file-url`) only. No other rendition, no guessed URL |
| Behavior | Thumbnail at enter as before. Video work starts only after a 200 ms dwell. Always muted. On hide (leave, dispose) or when the viewer opens, the hover video is paused, its `src` and `<source>` children are removed, and it is reset with `load()`. Nothing installs while the viewer is open. At most one hover video holds a source |

**Excluded from the automatic-video PASS.** Recognized video falls back to poster/View from `4d793a2`; G-VIDEO stays OPEN for these. Non-video stays on its existing path.
- e621 MP4 and e926 WebM;
- e926 MP4 ≥ 50 MB;
- e621 WebM > 100 MB;
- MOV and other containers;
- GIF and animated images;
- cards without a numeric `data-size`;
- logged-in pages, non-`/posts` routes, post pages;
- Rule34, Gelbooru and other hosts;
- other runtime cells (IB18);
- viewer playback (IB11, G-PLAY).

## Invariant

"Hover video is always muted, dwell-gated and class-eligible; leaving before or after readiness releases every owned source and prevents resurrection."

**Direct evidence:**
- **Local** (`tests/host/ib10/p_stage_video_assertions.cjs`, 64/64, 10 fault controls): no source before 200 ms; release before and after `loadeddata`, after the first frame and while buffering; no late resurrection; viewer takeover; bounded ownership; class boundaries.
- **Controlled transport** (P run, 54/54 PASS): every hover request completed, or ended within 100 ms of the hover ending; nothing was streaming at run end; no hover source held at the end. Covered across Range, no-Range and FAST, MP4 and WebM.
- **Live** (203/203 PASS): source ≥ 200 ms after enter (200–217 ms); quick passes create nothing; every created preview detached and source-free at leave, +1 s and +5 s, with `networkState` 0 at +1 s/+5 s; every play muted; at most one source holder.

## Preconditions

- G-OWN, G-RUNTIME (TC), G-REQUEST, G-SETTINGS: PASS (IB04–IB06).
- G-HOST and G-RENDITION: PASS(scope) (IB07, IB08).
- G-HOVER: PASS(scope) (IB09); its cost allowance opened video evaluation.
- **G-VIDEO(class, cell) E → PASS(scope)** before the production change (`IB10_V3L.md` §8, commit `47e7ccb`), on controlled V3-C and representative live V3-L evidence.

## Bounding decisions (owner)

- **Dwell:** 200 ms before video media work.
- **Viewer:** opening the viewer ends the hover preview.
- **Source:** the original file stays the IB10 hover source (no rendition discovery).
- **Retention: V3-R Option A, immediate release** (Ledger, commit `5e00884`). No retained or cached prior hover; the browser's own media/HTTP caching is left alone. Basis: V3-R released revisits were ready in 20–27 ms (AS-IS 20–28 ms), and the released transfer aborted 0–3 ms after leave.
- **Poster/View fallback elsewhere (option B, Blueprint enforcement; Ledger `2ee86be`):** every recognized video card outside the class keeps its thumbnail and the View path, with no automatic hover video.
- **Out-of-scope classes** retained their previous behavior at `8324552`. *Corrected:* this was not an owner instruction. It departed from the Blueprint and was corrected at `4d793a2` (poster/View fallback).

## Change

- **Files:** `Booru_Enhancer.user.js`: hover module, plus one call in the gallery's viewer-open path. +70/−5 lines (`git diff --numstat b9d133c 8324552`). `CHANGELOG.md` gains "Unreleased — e621/e926 hover video previews".
- **Added:**
  - `hoverVideoAdmittedWrap` (the class, from existing facts only);
  - `releaseHoverVideo` (pause, remove `<source>` and `src`, `load()`);
  - in `upgradeWhenReady`: the original-file guard and a viewer-open install guard;
  - in `show()`: the admitted card routes through the existing IB09 dwell timer, with the immediate thumbnail kept;
  - in `hide()`: release of an installed admitted video;
  - `endForViewer()`, called by the gallery when the viewer opens.
- **Allowed scope used (item 3 P):** pause/detach/reset on leave, close and dispose; stale readiness/play handlers; a bounded active hover count. "Choose observed cheaper stream" is not used: no cheaper-stream fact exists, and the owner decided to keep the original file.
- **Forbidden-scope audit (item 4):**
  - no native video scheduling and no new scheduler (the IB09 timer is reused);
  - no byte cap from pointer duration (the `data-size` bound is a class admission rule from measured evidence);
  - no guessed 480p/720p URLs;
  - no ugoira or archive processing;
  - the viewer's mute, autoplay and loop are untouched.

## Tests

| Suite | Result |
| --- | --- |
| P-stage production assertions (`tests/host/ib10/p_stage_video_assertions.cjs`) | 64/64 on `4258ad7`, 10 fault controls |
| P controlled conformance (`IB10_P_Controlled.user.js`, 54 cells: 9 scenarios × MP4/WebM × Range / no-Range / FAST; +5 s server byte observation) | **54/54 PASS** (C1–C5). Original run: 45 clean (raw SHA-256 `27e90c6c5b023f0e49146cf129b1d8878e52ae8e08c666acc02b79fd572fe175`); targeted recovery: 9 clean (raw `9eaf56dce39032f8ca07e713f0e96da4474f5856ddea03863695155ef94e7d48`); merged by `merge_ib10_p_controlled.cjs`; no failing cell. 10 entries were rejected by the unchanged trusted-pointer rule |
| P live conformance (`IB10_P_Live_Observer.user.js`, evaluator revision 1.1) | **PASS.** 203 PASS, 0 FAIL, 1 OUT_OF_SCOPE (an e926 MP4 of 79,810,863 B). e621 WebM (raw SHA-256 `ef0c37b23b27188dac135690c814280ea80fe0e1c85425ccf807472e831b0b70`): 84/84, 57 quick passes, 27 sustained previews, 9 after ready. e926 MP4 < 50 MB (raw `3d31f6814183fdbf1f239f1d6e6519db3089953c08659df9c07a0d40d8ebb7f1`): 119/119, 90 quick passes, 29 sustained previews, 14 after ready |
| Conformance packages + evaluator (`verify_ib10_p_conformance.cjs`) | 35/35 (live and controlled fault controls) |
| Recovery tooling (`verify_ib10_p_recovery.cjs`) | 23/23 |
| E-stage | baseline 34/34; V3-C 29/29; V3-L 31/31; V3-R 53/53 at its stage (52/53 now, by design: its working-tree pin is superseded by the P change) |
| **Reopen: P-stage assertions on `002bdfd`** (revised suite) | **67/67**, 12 fault controls (old automatic video restored for an excluded class; fallback applied to the admitted class; class broadened ×3; dwell, release, stale-guard, viewer and mute faults) |
| **Reopen: PF targeted live conformance** (`IB10_PF_Live_Observer.user.js`, evaluator revision 1.2, one invocation over four files) | **PASS, exit 0.** 114 PASS, 0 FAIL, 26 OUT_OF_SCOPE (the excluded generations, judged by N1/N2/V1), 9 CONTAMINATED (all are deliberate View clicks on excluded cards). **e621:** positive WebM 84/84 (63 quick passes, 21 sustained previews, 16 after ready); negative MP4: 21 generations, 0 failures, 14 trusted sustained, 4 View. **e926:** positive MP4 < 50 MB 30/30 (17 quick, 13 sustained, 12 after ready); negative WebM: 14 generations, 0 failures, 8 trusted sustained, 5 View. Raw SHA-256: e621 positive `655e83ca979ad1b70fff0b370e4b7926a177da53dd9e9900cced07b8bfeec922`, e621 negative `786e296e70e4da117323b38e62736789a00f708c267d87908254863129a26c71`, e926 positive `149c10ba42171882fd1a3b01e4434502a61018dfd16bf6e1c8395b6874ac0061`, e926 negative `489ee7d05ba9761f1f7a3e8fe870e4ff58f5a59676adc78831b8b3a267f2faa8` |
| Reopen: PF package + evaluator (`verify_ib10_pf_conformance.cjs`) | 25/25 (the `8324552` package fails N1 on both hosts) |
| Regressions on `002bdfd` | as on `4258ad7`, plus IB08 browser 59/59, 56/56, 65/65 and IB09 browser 30/30, 57/57, 39/39; IB10 E V3-R 52/53 and the `8324552` P verifiers 34/35 and 22/23, each failing only on its superseded working-tree pin (`IB10_P_STAGE.md` §8) |
| Regressions on `4258ad7` | IB01, IB02, IB03, IB05, IB06 exit 0; IB07 pass (`item9` and `pagecount` exit 1 on their IB07 blob pin only); IB08 66/66, 24/24, 12/12, 14/14, 90/90; IB09 suites pass (P-stage 111/111, pinned to `b9d133c`) |

**Targeted PF live detail (from the raw files):**
- Admitted sources set at 201–214 ms (e621) and 200–214 ms (e926).
- All 28 plays were muted.
- At most one source-holding hover at any sample; 0 in the negative sessions.
- Excluded cards: 0 hover `<video>` elements were created, across 35 generations. MP4 sizes reached 66,591,290 B on e621; WebM reached 23,048,528 B on e926.
- No e926 MP4 ≥ 50 MB was encountered; that class was optional.

**P live detail at `8324552` (from the raw files):**
- Created previews set their source at 200–217 ms (e621) and 201–215 ms (e926), always the card's own file.
- At leave every one was detached and source-free, with `networkState` 3 (NETWORK_NO_SOURCE, the synchronous state after `load()`). At +1 s and +5 s, `networkState` was 0.
- All 23 plays were muted.
- No-video generations all ended at ≤ 200 ms, including one at exactly 200 ms (left before the dwell task ran).
- At most one source-holding hover at any sample.
- No viewer opened and every trigger was trusted (no contamination).

**Evaluator revision 1.1** (before the live verdict; `IB10_P_STAGE.md` §6) corrected two rules:
- the leave sample now accepts the HTML media load algorithm's transient NETWORK_NO_SOURCE. All 72 controlled releases show it, followed by NETWORK_EMPTY;
- the dwell rules use the exact 200 ms threshold.

No release, detachment, mute or ownership requirement was weakened.

**Unexecuted / not measured:**
- live viewer takeover (covered locally and by the controlled viewer cells);
- live byte counts (live evidence is element state; byte proof is controlled);
- the real-network round trip of a revisit's one new request;
- other cells.

## Preservation (§6 "Hover enabled"; item 8)

- **Hover video stays a feature** in passing classes: previews play after the dwell, muted.
- **Viewer:** autoplay, mute and loop are unchanged; the viewer itself is unchanged. Only the hover ends when the viewer opens.
- **Native media and deliberate View:** reachable as before.
- **IB09 still-image class:** identical to `b9d133c` (7 sequences × 3 qualities).
- **Out-of-scope classes:** identical to `b9d133c` at `8324552`. Superseded at `4d793a2`: excluded video classes fall back to poster/View; GIF and the IB09 still class remain identical.
- **Accepted behavior change** (CHANGELOG): admitted video previews start after a 200 ms rest instead of at enter, and stop downloading when the hover ends.

## Evidence

- **Records:** listed at the top.
- **Packages, evaluators and verifiers:** `tests/browser/ib10/`, including `IB10_P_CONFORMANCE_VERIFICATION.json`, `IB10_P_RECOVERY_VERIFICATION.json` and the SHA-256 lists.
- **Local suites:** `tests/host/ib10/`.
- **Raw operator results are not committed;** their SHA-256 values are recorded above.
- **Sanitized E-stage aggregates:** `tests/browser/ib10/results/`.

## Provenance

No donor code was copied or translated. All changes are original to this repository (MIT).

## Failure / recovery

- **Capability shutdown:** cards outside the class get the poster/View fallback (no automatic hover video).
- **Rollback:** revert `4d793a2` (restores the out-of-class automatic video; not Blueprint-conformant) and/or `8324552`; no user data or setting depends on either.
- **Known risk:** a revisit after release needs one new request; on a real network that costs a round trip, which was not measured. V3-R measured no visible revisit penalty on localhost.

## Retained limitations (non-blocking)

- **Outside the admitted class** (as recorded at `8324552`), the pre-IB10 hover-video path remained, including D1–D4. *Corrected:* this record called that an owner decision; it was not. It was the unimplemented Blueprint poster/View fallback, and it is the reason this checkpoint was reopened. Fixed at `4d793a2`. The unqualified classes stay OPEN for G-VIDEO.
- **Cached transfers:** the controlled runs used no-store, so cached transfers were exercised only by V3-R's cacheable arm. Nothing is claimed about e621/e926's real cache headers.
- **Live coverage:** one container per host as encountered (e621 MP4 and e926 WebM not observed). The e926 20–50 MB band is thin. Live viewer takeover was not exercised.
- **Runtime:** TC only. Versions are Chrome 154 + Tampermonkey 5.5.0.
- **Size bound:** the e621 WebM bound (≤ 100 MB) is the observed maximum, not a policy limit; larger WebM stays out of scope.

## Gate transitions

| Gate row | Before | After |
| --- | --- | --- |
| G-VIDEO e621 logged-out `/posts` WebM ≤ 100 MB, TC | OPEN → E PASS(scope) | **PASS(scope)** (E stage and production conformance) |
| G-VIDEO e926 logged-out `/posts` MP4 < 50 MB, TC | OPEN → E PASS(scope) | **PASS(scope)**, independently |
| G-VIDEO other containers, sizes, hosts, routes, logged-in pages, GIF/animated, other cells | OPEN | **OPEN.** Recognized video uses the poster/View fallback from `4d793a2`; the fallback was confirmed live for e621 MP4 and e926 WebM. This is a fallback, not a qualification; no inferred PASS. |

**Invalidated dependents:** none. IB08 and IB09 were requalified on `4258ad7` (IB09 P suite pinned to its artifact; IB09 behavior identity checked in the IB10 suite).

**Opened for later checkpoints (item 13):** muted hover in the measured classes. No G-PLAY claim; viewer preference cases belong to IB11.

## Outcome

**IB10 COMPLETE — PASS(scope)** for the Scope above, at production `4d793a2`. The first closure at `8a4d6d8` was reopened at `2ee86be` and is now resolved. The poster/View fallback elsewhere (item 3, item 11, G-VIDEO "otherwise poster/View") is implemented, and it is confirmed locally and live.

§3 IB10 item 10 acceptance:
- **No stale reattachment:** local suite (late readiness/play never revives a released or older generation), plus controlled cells (no hover video attached at the end; viewer cells never install after takeover). The live observer does not track installs, so no live claim is made for this item.
- **No orphan active elements:** controlled C4/C5, plus live ownership ≤ 1 and source-free after leave.
- **No audible hover:** every play muted, locally and live.
- **Measured transfer fits the frozen class policy (immediate release):** controlled transfer ends within 100 ms of the hover ending, in all 54 cells.
- **DOM removal not taken as byte proof:** byte proof is the controlled server log.
- **Both controlled lifecycle and representative live eligibility are recorded.**
- **Poster fallback elsewhere:**
  - local: 12 excluded inputs plus Rule34, each with a fault control;
  - live targeted PF: 35 excluded generations with no hover video; View opened on 9.

**Next eligible checkpoint (blueprint sequence):** IB11 — Existing viewer hardening. It is not started.
