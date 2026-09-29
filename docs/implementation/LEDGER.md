# Ledger

## Current milestone
IB07 — Current-host metadata, Post facts and scope corrections: close per blueprint §11. Done means the invariant is demonstrated, §3 item 9 acceptance tests pass, prohibited later work did not enter, required master behavior is intact, and the completion record exists.

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `664bfe6366f03a6b1a27611087bcd6a91f2618f0` (commit `5064dfd`), unchanged in this task.
- **IB07 overall: PARTIAL—NOT COMPLETE.** One blocker remains (see Unresolved).
- §3 item 9: 31 PASS, 0 FAIL, 0 INCONCLUSIVE.
- Live production conformance:
  - Rule34, e621 and e926: PASS(scope: logged-out native listing and ordinary image post), 6/6 runs (`TC_R34E6_PRODUCTION_RESULT_SUMMARY.json`).
  - Gelbooru: PASS(scope) reused on the recorded diff basis.
- The Rule34/e621/e926 conformance package, its results and the harness `setup` hook are committed with this update.

## Verified
- Six live runs: failed=0 each; C00 `MATCH_EXPECTED_ARTIFACT` each; rows 1–6 match their route and context; host/context and adapter PASS; no enhancer request during Post production or the postamble window. The pre-postamble startup limitation is preserved.
- The package corresponds to the committed artifact (`--check` up to date against `5064dfd`); verifier 57/57.
- Earlier DevTools slot-provenance live runs are qualified as POTENTIALLY CONTAMINATED / SUPERSEDED FOR LIVE-HOST CLAIMS. They are preserved; the clean conformance runs are the current live basis. The unusual shapes stay NOT OBSERVED LIVE and fail closed.
- **Gelbooru container caveat: disposition A.** The gallery starts only on a matched container; none matched live. If one ever matched, the G-HOST paths still build no Post and make no request (item 9 case B).
- Acceptance checks from source:
  - no Post or URL is persisted (storage writes are settings and viewer volume only), so signed URLs stay in memory;
  - the Gelbooru API and HTML helpers are unreachable;
  - the Gelbooru and Rule34 native parsers are host-gated.

## Unresolved
- **Single IB07 blocker, the §6 row for rule34.us and three Sankaku matches** (§3 item 8: "Excluded hosts receive an explicit release/migration notice"; validation "Exclusion fixtures including idol; release note"). The matches were removed in `47423ce`, but:
  - no release/migration notice exists in `CHANGELOG.md`/`README.md`;
  - no exclusion assertion runs against the IB07 candidate (the only idol fixture is IB01's historical T10 oracle).
- Note for the completion record: §3 item 10 "count" is read as a multi-page work count (G-PAGES/IB17). Booru posts here are single-media, so the Post model has no count field. This reading is to be stated explicitly in the completion record.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
One bounded IB07 task: add a candidate exclusion assertion (production `@match` excludes rule34.us and the three Sankaku hosts, including idol; stored preferences untouched) and an explicit release/migration note. Then write the IB07 §11 completion record. IB08 is not eligible until then.
