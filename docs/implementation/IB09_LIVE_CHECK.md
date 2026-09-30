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

## 5. Not decided here

This record does not choose the final dwell, and it gives no G-HOVER PASS and no production change.
