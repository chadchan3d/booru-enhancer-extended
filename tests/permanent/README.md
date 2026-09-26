# Permanent synthetic regression suite

This directory is the **new assertion suite** created by implementation checkpoint IB01. It is separate from Claude's historical audit harness.

## Profiles

- `npm test` / `npm run test:baseline` runs against the pinned v1.2.7.3 source and succeeds only when each detector:
  1. detects the known baseline defect;
  2. reports the desired contract as not yet satisfied; and
  3. rejects a deliberately corrected oracle-control result.
- `npm run test:corrected` uses the same scenarios but requires each target contract to pass. Run it only when all listed baseline defects are expected to be corrected. Individual later checkpoints may instead run/filter their owned cases before the full corrected profile is appropriate.

A green **baseline** run does **not** mean the production script is correct. It means the regression oracles are sensitive to the defects they were created to guard.

## Evidence boundary

The suite uses synthetic jsdom fixtures. It can qualify parsing, event/state, request-attempt, DOM-ownership and liveness assertions. It does not certify live site selectors, actual wire cancellation, media byte transfer, autoplay, BFCache, userscript isolated/page worlds, manager permissions, or filesystem download completion.

## Historical material

The original `harness_scripts.zip` remains immutable historical evidence with SHA-256:

`56df21123dfd92bfabf80f0adab9855f92e5c7227b4f5b8172afa9f805aa9a45`

Its ten extracted-file hashes are recorded in `tests/IB01_HISTORICAL_MAPPING.md`; the historical scripts are not edited to make new assertions pass.

The EC0/EC1 ledger's O01-O13 sensitivity outcomes are recorded in `evidence/ec1_ownership_registry.json`. The original EC1 script packet was not part of the public repository handoff, so this registry does not pretend to be a byte-for-byte copy of those missing scripts. IB02 creates a new versioned ownership candidate/tests while preserving the historical result that O13 failed.

## Run

From this directory:

```sh
npm ci
npm test
```

Override the userscript path with `BE_MASTER=/path/to/Booru_Enhancer.user.js` when testing a different working copy.
