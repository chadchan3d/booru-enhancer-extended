# IB09 — Held-out live check of the 200 ms dwell candidate (E stage, preparation)

**Checkpoint:** IB09 — Still-image hover dwell and cost. **G-HOVER is OPEN.** Production `Booru_Enhancer.user.js` (blob `bbaf9ac`) is unchanged. 200 ms is an E-stage candidate, not the final constant. This record prepares the live check; it is not live evidence.

## 1. Live package design

**Artifact:** `tests/browser/ib09/IB09_Dwell_Live_Check.user.js`, built by `build_ib09_live_package.cjs`. Operator steps are in `tests/browser/ib09/README.md` (the "Dwell live check" section).

**Body:**
- the committed production at commit `91fa86d` (blob `bbaf9ac`, read from git);
- plus `applyDwellPrototype(…, { dwellMs: 200 })`, the qualified prototype;
- plus **8 observe-only hooks**. Each is `typeof IB09L_HOOK === 'function' && IB09L_HOOK(event, data)`, placed before existing statements or inside existing early-return branches. Hooks never change control flow or values.
- The events: thumbnail assignment, upgrade assignment (image and video), install, install blocked, stale load blocked, dwell fired, pending upgrade cancelled.

**Pinning:**
- the builder reads production from git and refuses any blob other than `bbaf9ac`;
- the verifier proves that the executed body **minus the hooks equals the qualified prototype byte-for-byte**;
- in the browser, check P00 hashes the executed wrapper body against the pinned SHA-256 (`b5362552…`, recorded in `IB09_LIVE_CHECK_VERIFICATION.json`).

The metadata block matches only e621.net and e926.net, with no update target.

**Observer (postamble):**
- It **records the operator's real pointer hovers** and generates no events.
- Generations are tracked by wrapping `BE.modules.hover.show` and `hide`, which the gallery calls through those properties.
- For each generation it keeps, in memory:
  - the enter and leave times;
  - the entry rendition (PREVIEW/SAMPLE/FILE/UNKNOWN, classified against the card's own native attributes);
  - every hover media assignment with its slot and time;
  - whether dwell fired;
  - when the first upgrade starts and when it is installed (displayable);
  - cancellation;
  - stale-blocked and stale-installed events;
  - moves from another card and re-entry of the same card.
- It is bounded to 80 generations per session and 6 sessions per page load; extra hovers are counted as dropped.
- **Sessions** are started from the menu with a condition label (ORDINARY or THROTTLED). The quality comes from production's own setting, read-only.
- **Operator usefulness marks** (useful, noticeable but late, too late) apply to the most recent PREVIEW→SAMPLE upgrade.

**Output:** per-session aggregates only. It contains counts, class tallies and times rounded to 10 ms (n/min/median/max). It contains no URLs, IDs or per-card values, and a leak guard withholds anything else.

**Measured per session:**
- generations;
- entry-rendition tally;
- stay distribution;
- quick passes under 200 ms;
- dwells reached;
- **new hover media before dwell** (from the hooks), which must be 0;
- **Resource Timing card-media loads before dwell** (an independent check), which must be 0;
- quick passes that started an upgrade, which must be 0;
- PREVIEW upgrades:
  - eligible generations, started, and exactly one per generation;
  - start offset, and starts before 200, which must be 0;
  - target slots;
  - **time from dwell to displayable**;
  - left before displayable;
  - cost classes and transferred KiB;
- upgrades on SAMPLE/FILE cards, which must be 0;
- FILE downgraded to SAMPLE, which must be 0;
- stale blocked and stale installed (the latter must be 0);
- moves from another card, and re-entries;
- the usefulness tally.

## 2. Normal-Chrome cache handling

**Timing and correctness do not depend on cache state.** Assignment times come from hooks in the running code, so a cached SAMPLE that produces no network entry is still caught if it is assigned before dwell. A fault control proves that attributing timing from Resource Timing instead would miss cached upgrades.

**Cost is classified per observation, never assumed.** Each upgrade's first Resource Timing entry after it starts is classified as `NETWORK` (with KiB), `CACHE`, `REVALIDATED`, `SIZE_UNAVAILABLE` or `NO_ENTRY`.
- `NO_ENTRY` is never read as zero cost.
- An observation with unknown cache state is never called cold.

**The one cache step, and why.** In the throttled session only, DevTools' **"Disable cache"** is ticked.
- It answers one question the ordinary session cannot: how late the SAMPLE upgrade becomes displayable **when nothing is cached, on a slow link**. That is the worst case for usefulness.
- It needs no manual cache clearing, and it applies only while DevTools is open for that tab.
- The ordinary session uses whatever cache state exists, and its observations are classified accordingly.

## 3. Local qualification

`node tests/browser/ib09/verify_ib09_live_package.cjs`: **37/37**, on a synthetic model (not live evidence).

**Static checks:**
- the derived script is current, and production at the pinned commit is `bbaf9ac`;
- the body minus the hooks equals the qualified prototype, and the hooks are 8 pure, guarded calls;
- the dwell constant is 200;
- only e621/e926 are matched;
- the observer makes no request, storage, cookie or settings write, and dispatches no events.

**Runtime checks,** on e621 and e926 separately, with a scripted pointer mix standing in for the operator (verifier only):

| Quality / case | Result |
| --- | --- |
| preview, operator-like mix | 12 generations; 6 quick passes; 6 dwells; zero new media before dwell (hooks and Resource Timing); quick passes start nothing; 6 SAMPLE upgrades, all at ≥ 200 ms; displayed or left-before-displayable accounted for every upgrade; NETWORK for cold loads and NO_ENTRY for repeats; no stale install; A→B and re-entry recorded; no leak; no enhancer request |
| sample | no hover upgrade |
| original | no upgrade, no FILE→SAMPLE |
| cached samples (NO_ENTRY) | upgrade start still attributed at ≥ 200 ms; cost `NO_ENTRY`, never zero |
| bounded sampling | 90 hovers → 80 recorded, 10 dropped |

**Fault controls, 10/10 caught:**
- package not pinned (body altered);
- upgrade before 200 ms;
- SAMPLE→SAMPLE;
- FILE→SAMPLE;
- stale install after leave;
- old-generation work after re-entry;
- timing attributed from Resource Timing (cache/no-entry);
- raw URL leakage;
- ID leakage;
- unbounded sampling.

## 4. Conditions and hosts: what is required, what can be shared

| Session | Quality | Network | e621 | e926 | Why |
| --- | --- | --- | --- | --- | --- |
| A | Preview | ordinary (DevTools closed) | required | required | Questions 1, 2, 5, 6 and 7 (ordinary). Correctness is host-local; nothing is inherited |
| C | Sample | ordinary | required | required | Question 3 on each host |
| D | Original | ordinary | required | required | Question 4 on each host |
| B | Preview | throttled (Slow 4G, Disable cache) | required | optional | Question 7 under a worst case. This is usefulness evidence only, not a correctness claim |

**Why B is optional on e926:** A, C and D give host-independent correctness on each host. B only characterizes how late the upgrade arrives on a slow, uncached link, which is dominated by the throttle and the image size. If e926 B is skipped, the record states that throttled usefulness was observed on e621 only.

## 5. Package correction 1.1 (operator report; test package only)

**Defect:** the result box stayed open over the gallery during recording, which made natural hovering impractical.

**Root cause:** `start()` (and the error paths) sent its acknowledgement through `note()` → `show()`, which creates the same box used for the final results:
- a full-screen `position:fixed; inset:20px` box at the maximum z-index;
- a focused textarea;
- a Close button.

It stayed until closed by hand.

**Correction** (observer postamble only; version 1.1.0):
- Every message except **Show results** is now a small click-through toast in the bottom-left corner: `pointer-events:none`, at most 280 px wide, removed automatically after 1.5–5 s. This covers session start, errors and usefulness marks.
- `start()` also removes any earlier result box.
- `results()` ends the session before any result UI appears, so the result box cannot create observations.
- The production body, the 200 ms prototype, the hooks, the recording and the analysis are **unchanged**.

**Verification (44/44):**
- Starting a session leaves no result box and no textarea, only one click-through toast, which disappears by itself.
- Nothing of the observer covers the gallery while recording.
- Show results still returns sanitized output.
- Usefulness marks work, one per upgrade and never double-counted.
- **Session data is identical to the previous package for the same pointer sequence.**
- **The executed body is identical to the previous package body**, so the pinning is unchanged.
- A regression shows the previous package opened a blocking box at session start.
- All 10 fault controls still pass.

**Completed valid sessions do not need repeating:** the recorded data and the executed body are unchanged by this correction.

## 6. Live session e621 A (preview, ordinary) and the FILE-target diagnosis

**Operator-relayed result (package 1.1):**
- `MATCH_EXPECTED_ARTIFACT`;
- 80 generations: 34 quick passes under dwell and 46 reached dwell;
- `newMediaBeforeDwell` 0, `resourceTimingLoadsBeforeDwell` 0, `quickPassesStartingUpgrade` 0;
- eligible 46, started 46, exactly one per generation;
- start offset 200/200/220 ms, none before dwell;
- `upgradesOnSampleOrFileCards` 0, `fileDowngradedToSample` 0, `staleInstalled` 0;
- **`targetSlots`: SAMPLE 38, SAMPLE|FILE 5, FILE 3.**

**Root cause of the 3 FILE targets: video posts counted in the still-image statistics (package reporting defect).**

1. **Which URL an eligible still-image upgrade uses.** `hoverUpgradeEligible` (prototype) admits a non-video upgrade only if the card shows its native preview and the target equals that card's own `data-sample-url` (`dwell_prototype.cjs:39`). A started still-image upgrade is therefore always the native sample.
2. **Whether any path can choose `data-file-url` over a usable sample.** For still images, no. `directUpgradeFromDom` prefers `sampleUrl`, and even a metadata-path fallback to the original is refused by the gate. The **only** FILE path is video: for a video post, production's `directUpgradeFromDom` returns the native file (`Booru_Enhancer.user.js:3062-3063`). The prototype deliberately leaves video unchanged behind the same dwell (`dwell_prototype.cjs:33`, IB10 scope). The package records it as an `upgrade-video` assignment.
3. **What `FILE` means in the package.** The assigned URL equals the card's `data-file-url` and not its `data-sample-url`. `SAMPLE|FILE` means it equals both.
4. **Missing or invalid samples?** No. With no usable sample, the gate refuses any upgrade. Such cards appear as eligible but not started, and all 46 started.
5. **Classifier or provenance errors?** The slot classification is correct; these really are file URLs. They are video files, started after dwell by the unchanged video path.
6. **Why they counted as eligible.** Package 1.1 defined eligibility as "PREVIEW at entry and dwell reached" without checking the card's media class. Video posts show the native preview, so they were included, and every upgrade kind was tallied together.
7. **`SAMPLE|FILE`.** This is native aliasing: the site's sample URL equals its file URL. The target is still the card's native sample slot, and nothing is downgraded, so it is **acceptable** under the PREVIEW→SAMPLE rule.
8. **Classification.** A **live-package reporting defect**. It is not a production or prototype defect, and not an unsupported-card admission issue in the code under test. Hover video remains IB10 scope.

**Correction (observer 1.2.0; test package only; executed body unchanged):**
- each generation records the card's media class from its native `data-file-ext`: STILL (jpg/jpeg/png/webp), VIDEO (webm/mp4/mov), ANIMATED (gif/apng) or UNKNOWN;
- `previewUpgrades` (the IB09 still-image rule) now covers **STILL** cards only, with `upgradeKinds`, `nativeSampleTargets`, `sampleFileAliasTargets`, `pureFileTargets` (must be 0), `otherTargets`, `eligibleWithoutUsableSample` and `startedWithoutUsableSample`;
- VIDEO, ANIMATED and UNKNOWN cards are reported separately under `otherMediaClasses`;
- the whole-session invariants (nothing before dwell, no stale install) still cover every generation.

**Local verification: 51/51.**
- A new fixture has a true SAMPLE target, a SAMPLE/FILE alias, a video post (pure FILE), an absent sample and an empty sample:
  - STILL: eligible 4, started 2 (1 SAMPLE, 1 alias), pure FILE 0, and the 2 cards without a usable sample start nothing;
  - VIDEO: 1 `upgrade-video` to FILE, after dwell.
- The previous package reproduces the e621 A shape (FILE counted as a still upgrade).
- The executed body is identical to package 1.1.
- Every field the previous packages reported is unchanged.
- **New fault controls,** both caught:
  - an erroneous FILE fallback when the sample is absent or invalid (a pure FILE target on STILL cards);
  - the observer counting a video post as STILL.
- All earlier fault controls still pass.

**e621 A disposition: ACCEPTED** for correctness on e621 ordinary network (questions 1, 2, 5 and 6), with this reclassification.
- **The 3 FILE targets are video.** The code path above allows no other way to get a pure FILE target.
- **So the still-image rule holds:** 43 still upgrades, 38 SAMPLE + 5 SAMPLE|FILE alias, and 0 pure FILE.
- **Timing invariants hold** across all 46 upgrades, including video.
- **Caveat:** e621 A's usefulness figures (displayable-after-dwell and cost classes) include up to 3 video generations, 3 of 46, so they are indicative only for still images.
- **No rerun is required.**

## 7. Not decided here

This record does not choose the final dwell, and it gives no G-HOVER PASS and no production change.
