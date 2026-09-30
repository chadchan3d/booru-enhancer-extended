# IB09 — Checkpoint completion record

**Checkpoint:** IB09 — Still-image hover dwell and cost (blueprint §3 IB09)

**Outcome:** **PASS(scope)** (see Scope and Outcome)

**Evidence gate owned (§5):** G-HOVER (class)

**Record date:** 2026-09-30

The fields follow the blueprint §11 "Required checkpoint completion record". Detailed records:
- `IB09_HOVER_BASELINE.md` (baseline);
- `IB09_DWELL_PROTOTYPE.md` (V2 pilot, frozen decisions, prototype);
- `IB09_LIVE_CHECK.md` (held-out live package and diagnoses);
- `IB09_V3_REOPEN.md` (V3 reopening and the A/B/C comparison);
- `IB09_E_CLOSEOUT.md` (E-stage evidence and gate decision);
- `IB09_P_STAGE.md` (production change and conformance package).

## Identity

| Item | Value |
| --- | --- |
| Checkpoint | IB09 — Still-image hover dwell and cost |
| Executor | Implementing agent; live evidence by the operator (ChadChan3D) |
| Source before | `Booru_Enhancer.user.js` blob `bbaf9ac63f5c0292018b974f00c7b30d8b478bb5`, commit `91fa86d` (the IB08 artifact) |
| Source after | blob `22e843cbe27662fc27d17149534b055d7a249dae`, commit `b9d133c`. The first P commit `16f821e` (blob `3161b51`) was superseded by the scope correction in `b9d133c` |
| Common artifact hash | Production body SHA-256 `6df35f16db1c8356ce7284ce6f58dbd2b1225a316bc2daf7513c359fd40bf992`. The conformance package's executed body (production + 8 observe-only hooks) has SHA-256 `52ab2a5814aa625586bba5df7cba921149674110f68c07d254144781d74f4c41`. It matched live in every conformance session (`MATCH_EXPECTED_ARTIFACT`), and its hook-stripped body equals the production body byte for byte (verifier) |

## Scope

G-HOVER(e621/e926 qualified still-image class). Each host was evidenced independently.

| Element | Qualified value |
| --- | --- |
| Hosts | e621.net, e926.net |
| Route / login | native `/posts` listing, logged out (`body[data-user-is-anonymous="true"]`) |
| Card class | The IB08-qualified still-image card pattern: the card's IB08 rendition fact is `NATIVE_PREVIEW`, `OWNED_SAMPLE` or `OWNED_ORIGINAL`, which requires the IB08 admission and pattern (still extension, two-source WebP/JPEG layout, usable native sample) |
| Dwell | frozen 200 ms |
| Before dwell | no hover metadata request and no hover media assignment, including the overlay (option B, dwell-gated overlay) |
| Upgrade | Only a displayed PREVIEW → that card's native SAMPLE or native SAMPLE\|FILE alias. A displayed SAMPLE or FILE gets no upgrade and is never downgraded |
| Runtime | Tampermonkey × Chrome as used by the operator (versions not relayed) |

**Excluded (previous hover path or native fallback, unchanged):**
- still cards outside the IB08 pattern (for example, no usable sample);
- unsupported and cost-inconclusive classes, which keep thumbnail/View;
- video (IB10) and animated images;
- logged-in pages, other e621/e926 routes, post pages, the viewer (IB11), and other hosts.

**Original targets:** no separate Original-target class is qualified by this evidence, so cost-inconclusive Original cases keep thumbnail/View. This is **not** a universal original ban (blueprint IB09 item 4). A separately validated cheap-original class remains possible.

## Invariant

"No new hover metadata request or upgraded media source assignment precedes dwell; eligibility depends on measured cost/provenance, not slot names."

**Direct evidence:**
- **Local (production `22e843c`):**
  - `p_stage_assertions.cjs` 111/111: stays of 0/40/100/199 ms start nothing; 200/201/250 ms start the overlay and one upgrade at exactly 200.
  - Eligibility follows the displayed/native relationship. The slot-name order (`sampleUrl || originalUrl || previewUrl`) no longer decides for the qualified class.
- **Live (production conformance, all four sessions PASS):** in the qualified class, `newMediaBeforeDwell`, `overlayBeforeDwell`, `hoverFetchesBeforeDwell` and `quickPassesStartingAnything` are all 0. The overlay first appears at ≥ 200 ms.

## Preconditions

- G-OWN, G-RUNTIME, G-REQUEST and G-SETTINGS PASS (IB04–IB06 records).
- G-HOST PASS(scope) for the e621/e926 listings (IB07).
- G-RENDITION PASS(scope) (IB08).
- **G-HOVER E stage → PASS(scope)** before the production change (`IB09_E_CLOSEOUT.md` §4). It was based on:
  - the V2 pilot;
  - the frozen operator decisions;
  - the fake-clock prototype (84/84);
  - the V3 alternatives (54/54);
  - held-out live sessions: e621 A (1.2 rerun), B (throttled), C, D; e926 A, C, D.

## Bounding decisions (operator, frozen at E closeout)

- **V3:** option B, the dwell-gated overlay. The e926 D session showed 38/80 fetches started by immediate reuse of the displayed file before dwell.
- **Dwell:** 200 ms.
- **Before dwell:** zero new hover work.
- **Rendition:** cheapest sufficient validated rendition, with no downgrade.
- **Fallback:** unsupported or cost-inconclusive classes keep thumbnail/View.
- **Video:** IB10.
- **Scope correction (operator review):** the dwell applies only within the G-HOVER class. Cards outside it keep their previous path (`b9d133c`).

## Change

- **Files:** `Booru_Enhancer.user.js`, in `BE.modules.hover` only. The change is 48 added lines and 0 removed against `bbaf9ac` (`git diff --numstat 91fa86d b9d133c`). `CHANGELOG.md` has a new entry, "Unreleased — e621/e926 hover preview timing".
- **Added:**
  - `HOVER_DWELL_MS` and `dwellTimer`;
  - `hoverQualifiedWrap` (the class, from the existing IB08 rendition fact);
  - `qualifiedUpgradeAllowed` (the eligibility rule), applied as the first gate in `upgradeWhenReady`;
  - `show()` arms the dwell for qualified cards, and `resolveHover` is the previous `show()` body, moved unchanged;
  - `hide()` clears the timer.
- **Allowed scope used (item 3 P):** dwell/cancel on the existing hover path, cheapest sufficient still selection, and the existing generation guard.
- **Forbidden-scope audit (item 4):**
  - no per-hover HEAD request, no extension/host guessing, no universal original ban, no original-only exception;
  - no automatic animated admission, no decode/byte scheduler, no intuitive numeric limit (200 ms is the frozen, evidenced value);
  - no new module, abstraction, canvas path, setting or storage;
  - no viewer, gallery or IB08 change;
  - no IB10 work.

## Tests

| Suite | Result |
| --- | --- |
| P-stage production assertions (`tests/host/ib09/p_stage_assertions.cjs`) | 111/111 on `22e843c`, including 11/11 fault controls. The faults cover: dwell removed; option A restored; leave not cancelling; viewer check removed; eligibility removed; SAMPLE reloading SAMPLE; stale install guards removed; dwell 199 ms; dwell scope broadened (caught separately for no-sample, video and GIF cards) |
| Out-of-scope identity (in the same suite) | The hover timeline for no-sample, video, GIF and logged-in cards is identical to `bbaf9ac`. The fixture controls are live |
| Conformance package verifier (`tests/browser/ib09/verify_ib09_conformance.cjs`) | 30/30, including 5/5 fault controls |
| IB09 E-stage suites (pinned to `bbaf9ac`) | baseline 32/32, prototype 84/84, V3 alternatives 54/54, live package 57/57 |
| IB08 on `22e843c` | 66/66, 24/24, 12/12, 14/14, 90/90 |
| IB01, IB02, IB03, IB05, IB06 | exit 0 |
| IB07 host suites | Exclusion and Gelbooru exit 0. `item9` and `pagecount` exit 1 only on their IB07 blob pin (`mismatchesAgainstExpected: []`, `failed: []`) |

**Live production conformance** (package `IB09_Production_Conformance.user.js` on `b9d133c`; normal Chrome, logged out, ordinary network). All four sessions are operator-relayed as PASS:

| Session | Result |
| --- | --- |
| e621 P1 Preview | PASS |
| e621 P2 Original | PASS |
| e926 P1 Preview | PASS |
| e926 P2 Original | PASS |

**Per-session figures, as relayed** (qualified class = `qualifiedClass`; timings are min / median / max):

| Field | e621 P1 Preview | e621 P2 Original | e926 P1 Preview | e926 P2 Original |
| --- | --- | --- | --- | --- |
| identity | matched | matched | matched | matched |
| qualified generations | 69 | 66 | 71 | 77 |
| quick passes / dwell reached | 36 / 33 | 29 / 37 | 42 / 29 | 37 / 40 |
| new media / overlay / hover fetches before dwell | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| quick passes starting anything | 0 | 0 | 0 | 0 |
| overlay offset ms | 200 / 210 / 220 | 200 / 200 / 220 | 200 / 200 / 220 | 200 / 200 / 220 |
| still upgrades: eligible / started | 33 / 33, exactly once | 0 | 29 / 29, exactly once | 0 |
| targets | SAMPLE 30, SAMPLE\|FILE 3, pure FILE 0 | — | SAMPLE 26, SAMPLE\|FILE 3, pure FILE 0 | — |
| upgrades on SAMPLE/FILE cards / FILE→SAMPLE | — / 0 | 0 / 0 | — / 0 | 0 / 0 |
| stale installed | 0 | 0 | 0 | 0 |
| out of scope (previous path kept) | 11 = 6 VIDEO + 5 ANIMATED | 14 = 6 VIDEO + 8 ANIMATED | 9 = 7 VIDEO + 2 ANIMATED | 3 = 2 VIDEO + 1 ANIMATED |

"—" means the field was not relayed. Each session covers 80 generations (qualified + out of scope).

**Unexecuted:**
- e926 throttled (E stage, optional);
- other runtimes and managers (IB18);
- live out-of-scope behavior beyond the video/animated generations reported above (locally proven identical).

## Preservation (§6 "Hover enabled" row; item 8)

- **Hover choice:** preserved. `media.hoverPreview` still gates all hover (`Booru_Enhancer.user.js:4277`, outside the diff), and disabled hover stays off.
- **Useful inexpensive stills:** preserved within the class. A Preview card upgrades after dwell (live start 200–220 ms); Sample and Original cards already show the sufficient rendition.
- **Whole-image intent and explicit View:** unchanged.
- **Video and other classes:** their previous path is unchanged (IB10 owns video).
- **Accepted behavior change** (CHANGELOG): for qualified cards, the hover preview now appears after a 200 ms rest instead of at pointer-enter.

## Evidence

- **Records:** the documents listed at the top.
- **Packages and verification:** `tests/browser/ib09/`, including `IB09_CONFORMANCE_VERIFICATION.json`, `IB09_CONFORMANCE_SHA256SUMS.txt`, `IB09_LIVE_CHECK_SHA256SUMS.txt` and the README.
- **Local suites and results:** `tests/host/ib09/`, including `p-stage-result.json`.

All live output was sanitized in the browser (a leak guard and aggregates only), with no URLs, IDs or screenshots. Resource Timing sizes were mostly hidden by the browser and are never counted as zero.

## Provenance

No donor code was copied or translated. All changes are original to this repository (MIT).

## Failure / recovery

- **Capability shutdown:** any card outside the qualified class keeps its previous hover path. Any target the rule refuses keeps the thumbnail, with View available.
- **Rollback:**
  - revert `b9d133c` and `16f821e` in reverse order;
  - no user data or setting depends on them.
- **Known risk:** under throttling, few upgrades become displayable before the pointer leaves (e621 B: 6/34). The thumbnail stays until a replacement is ready.

## Retained limitations (non-blocking)

- **Overlay A during E stage:** the E-stage live sessions ran overlay A. Option B's pre-dwell zero was proven locally and confirmed live by production conformance.
- **Throttled usefulness:** observed on e621 only (e926 B optional, not run).
- **Unchanged out-of-scope paths:** still cards outside the pattern, video, GIF, logged-in pages and other hosts keep their previous immediate hover work before dwell. This is by design; they are outside G-HOVER scope.
- **Runtime reporting:** Tampermonkey/Chrome versions were not relayed.

## Gate transitions

| Gate row | Before | After |
| --- | --- | --- |
| G-HOVER e621 logged-out `/posts` IB08-qualified still-image class | OPEN | PASS(scope) (E stage and production conformance) |
| G-HOVER e926 logged-out `/posts` IB08-qualified still-image class | OPEN | PASS(scope), independently |
| G-HOVER Original-target class, animated, unknown, out-of-pattern stills, other contexts and hosts | OPEN | OPEN (previous path or thumbnail/View; no inferred PASS) |

**Invalidated dependents:** none. IB08 was requalified on `22e843c`.

**Opened for later checkpoints (item 13):** the tested still-preview class and cost allowance, for video evaluation (IB10). This does **not** include automatic video admission.

## Outcome

**IB09 PASS(scope)** for the Scope above.

§3 IB09 item 10 acceptance:
- The chosen dwell/ordering policy fits the frozen allowance on held-out cases.
- Unknown and cost-inconclusive originals retain thumbnail/View.
- The unknown-byte sample is admitted only as the IB08-validated native sample of a displayed preview.
- The current placeholder remains until its replacement is ready.
- A stale same-ID generation cannot apply.

**Next eligible checkpoint:** IB10 — Muted hover-video lifecycle. It is not started.
