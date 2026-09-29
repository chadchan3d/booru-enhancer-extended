# Ledger

## Current milestone
IB07 — Current-host metadata, Post facts and scope corrections: close per blueprint §11. Done means the invariant is demonstrated, §3 item 9 acceptance tests pass, prohibited later work did not enter, required master behavior is intact, and the completion record exists.

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` is unchanged since commit `9cade1a` (blob `0715587162f65324fc1f85adf40e7f490b4220b3`).
- IB07 overall: PARTIAL—NOT COMPLETE.
- G-HOST native-only strategies are admitted for Rule34, e621, e926 and Gelbooru.
- Gelbooru has production integration (`9cade1a`) and live production conformance PASS(scope: logged-out native image post).
- §3 item 10 decision A is recorded.
- §3 item 9 is in `tests/host/ib07/`: 26 PASS, 0 FAIL, 3 INCONCLUSIVE.
- Slot-provenance probe package, live observations and closure assessment are recorded: `tests/browser/ib07/SLOT_*`, `docs/implementation/IB07_SLOT_PROVENANCE_EVIDENCE.md`, and pointers in the Rule34, e621 and e926 V1-N records and in the applicability record.

## Verified
- Live slot-provenance runs, sanitized (`SLOT_RESULT_SUMMARY.json`). Every run was NOT_QUALIFIED.
  - Rule34: multiple image posts, each with a native original link; the control shape keeps sample and original distinct.
  - e621: 140 cards with `data-sample-url` present (10 explicitly equal to the file, 130 distinct) plus a post page with both attributes.
  - e926: 75 cards present (3 equal, 72 distinct) plus a post page with both attributes.
  - Target shapes: **NOT OBSERVED LIVE**.
- Both slot fallbacks were introduced inside IB07 (Rule34 `8aaefea`, e621/e926 `4918893`) and are reachable in enabled production (lines 1946, 2332).
- Consumer effects of disabling the fallbacks were read from the source. In the unobserved shapes only: Rule34 download reports failure; the e621/e926 grid thumbnail and reverse search use the preview. Viewer and open actions are unchanged.
- Test and verification results for this state are in the latest status block.

## Unresolved
- **Closure assessment B:** `G3-3c-rule34.xxx`, `G3-3d-e621.net` and `G3-3d-e926.net` block IB07 closure while the enabled parsers fill those slots by unvalidated inference. The smallest follow-up is a bounded production task disabling only the two inferences (Rule34 `originalUrl = originalLink?.href || ''`; e621/e926 `sampleUrl = d.sampleUrl || ''`). It needs explicit approval of its consequences, including the Rule34 download change in the unobserved shape, which the earlier option B deferral avoided.
- §11 step 6 production conformance is not run for the Rule34, e621 and e926 integrations.
- Gelbooru T1/T2 on the observed markup do not reach the gallery path; the proof rests on case B.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
Operator decision on the bounded restriction. If approved: one IB07 production task disabling the two slot inferences, then updating the item 9 expectations. After that, prepare the Rule34, e621 and e926 §11 production-conformance runs.
