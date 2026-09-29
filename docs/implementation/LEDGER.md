# Ledger

## Current milestone
IB07 — Current-host metadata, Post facts and scope corrections: close per blueprint §11. Done means the invariant is demonstrated, §3 item 9 acceptance tests pass, prohibited later work did not enter, required master behavior is intact, and the completion record exists.

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` is unchanged since commit `9cade1a` (blob `0715587162f65324fc1f85adf40e7f490b4220b3`).
- IB07 overall: PARTIAL—NOT COMPLETE.
- G-HOST native-only strategies are admitted for Rule34, e621, e926 and Gelbooru.
- Gelbooru has production integration (`9cade1a`) and live production conformance PASS(scope: logged-out native image post).
- §3 item 10 decision A is recorded (`IB07_ACCEPTANCE_APPLICABILITY.md`).
- §3 item 9 assertions are implemented in `tests/host/ib07/` (`npm test`), with results in `tests/host/ib07/item9-result.json`.

## Verified
- Item 9 suite, run in jsdom against the real production script (blob confirmed `0715587…`): 29 assertions, 26 PASS, 1 FAIL, 2 INCONCLUSIVE. The informational Gelbooru case A row is recorded separately. All 29 controls flip their verdict; nothing is vacuous; every verdict matches the expected register.
  - Group 1 PASS: T1 and T2 (IB01 oracles) for Rule34, e621, e926 and Gelbooru (case B); on-demand zero requests for Rule34, e621 and e926.
  - Group 2 PASS: exact identity for the Rule34 post page and the e621/e926 post page and listing.
  - Group 3 PASS: distinct sample/original slots (Rule34; e621/e926 post and listing); missing original stays missing (e621, e926); missing Rule34 sample not fabricated; native equal sample (e621, e926).
- Existing suites unchanged and passing: IB01 14/14 sensitive, IB02 21/21, IB03 11/11, IB05 23/23, IB06 21/21, IB07 Gelbooru native-post 14/14, IB07 conformance verifier 28/28, package checksums OK.

## Unresolved
- **FAIL, finding 1 (production defect):** `G3-3c-rule34.xxx`. On a Rule34 post page with `img#image` but no native Original link, `fetchPost` returns a Post whose original slot holds the sample URL (`rule34NativeImagePost`: `originalUrl = originalLink?.href || sampleUrl`). The corrected control (original left empty) passes.
- **INCONCLUSIVE, finding 2:** `G3-3d-e621.net`, `G3-3d-e926.net`. With no `data-sample-url`, the sample slot is filled from `data-file-url`. Deciding this needs a G-HOST fact: how e621/e926 represent a post with no distinct sample rendition, and what the native page then displays.
- §11 step 6 production conformance is not run for the Rule34, e621 and e926 integrations.
- Gelbooru T1/T2 on the observed markup (no candidate container) do not reach the gallery path; the proof rests on case B.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
Smallest bounded production correction for finding 1: Rule34 leaves the original slot empty when no native original exists. Then re-run the item 9 suite and update its expected register.
