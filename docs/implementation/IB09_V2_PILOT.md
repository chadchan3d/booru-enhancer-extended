# IB09 — V2 hover-cost pilot (E stage, preparation)

**Checkpoint:** IB09 — Still-image hover dwell and cost. **G-HOVER is OPEN.** This record prepares the live V2 cost pilot; it is not live evidence. No dwell is chosen, and production (`bbaf9ac`) is unchanged. V3 (the current-rendition overlay at t=0) is **not decided**.

The findings carried over from the baseline (`IB09_HOVER_BASELINE.md`):
- `preview` and `original` start a SAMPLE load at pointer-enter, including in a 40 ms sweep;
- `sample` starts no upgrade;
- metadata is a cache hit with no network request;
- stale generations cannot apply;
- the overlay shows the current rendition at t=0.

## Probe design

**Artifact:** `tests/browser/ib09/IB09_V2_Hover_Cost_Probe.user.js`. Operator steps are in `tests/browser/ib09/README.md`.

**Preconditions,** enforced; the probe refuses and loads nothing otherwise:
- host e621.net or e926.net;
- the `/posts` route;
- `body[data-user-is-anonymous="true"]`;
- no enhancer DOM on the page;
- Resource Timing available;
- at least 16 IB08-pattern cards.

**Arms,** 4 distinct cards each, 16 cards and 32 image loads per host:

| Arm | Question it answers |
| --- | --- |
| REUSE_PREVIEW | Is assigning the displayed rendition to a new `Image` (today's t=0 overlay) free of additional transfer? |
| COLD_AND_REUSE_SAMPLE_FILE | What do a cold SAMPLE and a cold FILE cost, and is reusing a displayed rendition free? |
| ABORT_SAMPLE | Does `src = 'data:,'` after 40 ms (production's cancel) prevent the transfer? |
| CONTROL_SAMPLE | The time scale of an uncancelled cold SAMPLE, so abort results can be interpreted |

**Mechanism:**
- loads go into detached `Image` objects, never inserted into the page;
- the probe reads the Resource Timing entries for those exact URLs;
- it doesn't alter the page or imitate production hover.

**Privacy and sanitation contract:**
- The output contains aggregates only: class tallies per slot and arm, sizes in KiB and durations rounded to 10 ms as n/min/median/max, abort outcome tallies and capability flags.
- There are no URLs, post IDs, hashes, usernames, tokens or per-card values.
- A leak guard withholds any output that contains a raw card value or a URL scheme.
- The probe grants only `GM_registerMenuCommand`, makes no fetch/XHR, uses no storage or cookies, and writes nothing to the page except its result box.

## What the browser can and cannot measure

**Can measure:**
- Resource Timing entries for image loads: `duration` and start and end times;
- `transferSize`, `encodedBodySize` and `decodedBodySize` **only** when sizes are exposed (same-origin, or a cross-origin response with `Timing-Allow-Origin`);
- `deliveryType` (`'cache'`) where the browser supports it;
- image `load`, `error` and timeout, and the probe's own cancellation.

**Cannot measure, or only indirectly:**
- **Sizes for cross-origin images without `Timing-Allow-Origin`.** Every size counter reads 0; the probe reports `SIZE_UNAVAILABLE` and never counts it as zero. Durations remain.
- **Loads served from the in-memory image cache.** These can leave no Resource Timing entry; the probe reports `NO_ENTRY`, meaning loaded with no observable fetch. That is not proof of zero cost in every state.
- **Bytes transferred before an abort.** A cancelled request usually leaves no entry. The probe infers the outcome from a follow-up load of the same URL:
  - served from cache → the cancelled fetch completed anyway;
  - a full transfer → the cancel prevented it;
  - sizes hidden → not measurable.

  Partial bytes transferred before a cancel are not observable.
- **Cache state beyond the session.** Incognito removes prior disk cache, but CDN and edge caching are invisible. A cache hit in this sample does not make future loads free, and the probe never claims so.

## Local qualification

`node tests/browser/ib09/verify_v2_hover_cost_probe.cjs`: **39/39**, on a synthetic browser model (not live evidence).

**Scenarios:**

| Scenario | What it checks |
| --- | --- |
| Sizes exposed, memory-cache reuse, cancel stops the fetch | Every class and outcome, bounded sampling (16 cards, 32 loads), site identity |
| e926 with sizes hidden | `SIZE_UNAVAILABLE`, never zero; verdicts `NOT_MEASURABLE` |
| Cancel doesn't stop the fetch | `CANCELLED_FETCH_STILL_REACHED_CACHE` |
| Disk-cache reuse | `CACHE` |
| No-cache reuse | `TRANSFER_OBSERVED` |
| Mixed reuse | `TRANSFER_OBSERVED`; a cache hit is not generalized |
| `deliveryType` cache with sizes hidden | `CACHE`, still with no size claim |
| Refusals | Enhancer active, logged in, not `/posts`, too few cards, unsupported host: zero loads, page unchanged |
| Leak guard | A leaking build is blocked |
| Static scope | `@match`/`@grant`, no request/storage/cookie API, no page writes |

**Fault controls, 11/11 caught:**
- raw URL leakage;
- ID leakage;
- incorrect slot classification;
- hidden transfer size treated as zero;
- a cache hit treated as proof of free loads (mixed reuse);
- completed and cancelled loads not distinguished;
- e926 relabelled as e621;
- unrelated resources mixed in;
- unbounded sampling;
- page mutation;
- production-enhancer dependence.

## Decisions this pilot is meant to inform (not made here)

1. Whether any cost before dwell is acceptable, and how much.
2. Whether the t=0 current-rendition overlay (V3) is effectively free enough to keep (REUSE results).
3. Whether cancelling a pending hover image prevents meaningful transfer (ABORT versus CONTROL).
4. Which dwell design to test next.
