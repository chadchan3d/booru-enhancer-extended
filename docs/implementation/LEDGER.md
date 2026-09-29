# Ledger

## Current milestone
IB07 — Current-host metadata, Post facts and scope corrections: close per blueprint §11. Done means the invariant is demonstrated, §3 item 9 acceptance tests pass, prohibited later work did not enter, required master behavior is intact, and the completion record exists.

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `30cadd68ebc6ca357a029ebdf1cfb028f081ee7b`: `9cade1a` plus the approved two-line slot-inference restriction.
- IB07 overall: PARTIAL—NOT COMPLETE.
- G-HOST native-only strategies are admitted for Rule34, e621, e926 and Gelbooru.
- Gelbooru live production conformance PASS(scope: logged-out native image post) is reused for `30cadd6` on an explicit diff basis (`IB07_SLOT_PROVENANCE_EVIDENCE.md` §"Disposition").
- §3 item 10 decision A is recorded.
- §3 item 9: 29 PASS, 0 FAIL, 0 INCONCLUSIVE (`tests/host/ib07/item9-result.json`). Three rows assert production fail-closed behavior; their host shapes stay NOT OBSERVED LIVE.

## Verified
- The production diff is exactly two lines: Rule34 `originalUrl = originalLink?.href || ''`; e621/e926 `sampleUrl = d.sampleUrl || ''`. `git diff --check` is clean and `node --check` passes.
- Item 9 at `30cadd6`: 29/29 PASS, 29/29 controls correct. The three fail-closed rows FAIL under a mutant that restores the old inference. The observed-shape rows are unchanged: Rule34 distinct sample and original, e621/e926 distinct sample and file, and explicit sample=file equivalence.
- Downstream, measured old vs new in the harness with no downstream edits:
  - 0 metadata requests everywhere; the Rule34 native page is untouched.
  - Rule34 download on the unobserved shape now truthfully reports no original (0 transfers, was 1 guessed transfer).
  - The e621/e926 grid never used the fabricated sample, so there is no grid change.
  - e621/e926 hover and viewer are unchanged (their own downstream fallbacks).
  - e621/e926 reverse search on a post page submits the preview instead of the full file.
- Gelbooru reuse basis: both changed lines return first on gelbooru.com (lines 1931, 2325). Old vs new on a Gelbooru post page gives an identical Post and 0 requests, with and without an original link.

## Unresolved
- §11 step 6 production conformance is not run for the Rule34, e621 and e926 integrations.
- Host semantics of the three restricted shapes stay NOT OBSERVED LIVE. Production fails closed on them; nothing claims their meaning.
- Gelbooru T1/T2 on the observed markup do not reach the gallery path; the proof rests on case B.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
Prepare the Rule34, e621 and e926 §11 production-conformance runs against production blob `30cadd6`. Gelbooru is not reopened.
