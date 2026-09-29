# Ledger

## Current milestone
IB07 — Current-host metadata, Post facts and scope corrections: close per blueprint §11. Done means the invariant is demonstrated, §3 item 9 acceptance tests pass, prohibited later work did not enter, required master behavior is intact, and the completion record exists.

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` is unchanged since commit `9cade1a` (blob `0715587162f65324fc1f85adf40e7f490b4220b3`).
- IB07 overall: PARTIAL—NOT COMPLETE.
- G-HOST native-only strategies are admitted for Rule34, e621, e926 and Gelbooru.
- Gelbooru has production integration (`9cade1a`) and live production conformance PASS(scope: logged-out native image post).
- §3 item 10 decision A is recorded (`IB07_ACCEPTANCE_APPLICABILITY.md`).
- §3 item 9 assertions are in `tests/host/ib07/` (`npm test`), with results in `item9-result.json`.
- Option B approved: the Rule34 missing-original assertion is reclassified FAIL → INCONCLUSIVE. Rule34 and download production are unchanged.
- Slot-provenance G-HOST probe package prepared in `tests/browser/ib07/` (`IB07_Slot_Provenance_Probe.js`, `SLOT_README.md`, `SLOT_VERIFICATION.json`, `SLOT_SHA256SUMS.txt`, `verify_slot_probe.cjs`). It is uncommitted and awaits operator runs.

## Verified
- Item 9 suite at production `0715587…`: 29 assertions, 26 PASS, 0 FAIL, 3 INCONCLUSIVE (`G3-3c-rule34.xxx`, `G3-3d-e621.net`, `G3-3d-e926.net`), plus the informational Gelbooru case A row. All 29 controls are correct; nothing is vacuous; every verdict matches the expected register.
- Rule34 reclassification basis: `IB07_RULE34_V1N.md` observed only a post with a native Original link. With the original slot cleared, `downloadPost` fails ("could not find original media URL"; 0 transfers) where it now succeeds (1 transfer). Both cases made 0 metadata requests (harness comparison, in memory).
- Slot probe: `node --check` PASS. `verify_slot_probe.cjs` 53/53: 15 output branches, each checked for expected facts, no planted raw value and zero requests; 5 leaking probe mutants all caught; static checks. Probe SHA-256 `9cdfa30a…`.
- Existing suites are unchanged (see the latest status block for run results).

## Unresolved
- `G3-3c-rule34.xxx`: needs the G-HOST fact of whether a Rule34 post page with `img#image` but no native Original link displays the original itself.
- `G3-3d-e621.net`, `G3-3d-e926.net`: need the G-HOST fact of how e621/e926 represent a post with no `data-sample-url`, and what the native post page then displays.
- §11 step 6 production conformance is not run for the Rule34, e621 and e926 integrations.
- Gelbooru T1/T2 on the observed markup do not reach the gallery path; the proof rests on case B.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
The operator runs `IB07_Slot_Provenance_Probe.js` per `SLOT_README.md` on Rule34, e621 and e926, in any sessions, and returns the sanitized JSON. Then resolve the three INCONCLUSIVE assertions, and only then decide whether any production correction is needed.
