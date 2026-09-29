# Ledger

## Current milestone
IB07 — Current-host metadata, Post facts and scope corrections: close per blueprint §11. Done means the invariant is demonstrated, §3 item 9 acceptance tests pass, prohibited later work did not enter, required master behavior is intact, and the completion record exists.

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `664bfe6366f03a6b1a27611087bcd6a91f2618f0` (commit `5064dfd`), unchanged in this task.
- **IB07 overall: PARTIAL—NOT COMPLETE.** One blocker: the Post count fact (see Unresolved).
- §3 item 9: 31/31 PASS.
- Live production conformance:
  - Rule34, e621 and e926: PASS(scope), 6/6 runs.
  - Gelbooru: PASS(scope) reused on the diff basis.
- The §6 excluded-host row is now satisfied: `tests/host/ib07/exclusion_assertions.cjs` plus the `CHANGELOG.md` release note.

## Verified
- Exclusion assertions against the committed userscript: 8/8 PASS, 9/9 controls.
  - rule34.us, chan, idol and beta are each not admitted by `@match`; idol is tested independently.
  - There is no `@include`.
  - All 15 admitted hosts use a dedicated adapter, so the generic adapter is never selected, and it has no actions.
  - No production code names an excluded host (3 `@connect` permissions remain for the release audit).
- Stored preferences remain (P1): startup deletes or changes no seeded preference, including unknown keys; the deletion mutant is caught. Settings are per-script, not per host.
- Release/migration note: `CHANGELOG.md` §"Unreleased — Host scope changes". It covers the four hosts, states rule34.xxx is unaffected, and states preferences are kept.
- Count contract: the normalized Post (`emptyPost`) has no count field. `favCount` is a favorites tally. No contract document defines a count.
- All other suites pass unchanged (see the latest status block).

## Unresolved
- **Single IB07 blocker: the Post count fact is absent** (§3 item 10: "Post has … kind/count/naming facts"). Determination C: the field doesn't exist, so there is nothing that could be "unknown". Needs a contract decision, then one bounded production change: add a count field to the normalized Post with an unknown default. No host sets it (no observed count fact); no `count: 1` is written.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
Operator decision on the Post count representation (field name and unknown sentinel). Then the bounded IB07 production change with its assertion, then the IB07 §11 completion record. IB08 is not eligible until then.
