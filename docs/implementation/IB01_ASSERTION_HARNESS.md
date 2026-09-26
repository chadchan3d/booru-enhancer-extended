# IB01 — Permanent Assertion Harness Qualification

**Checkpoint:** IB01  
**Status:** PASS  
**Branch:** `implementation/ib00-baseline`  
**Production source modified:** No

## Objective

Qualify regression assertions before using them to justify fixes, while preserving the historical Claude audit harness as immutable evidence.

## Historical evidence boundary

The supplied historical harness ZIP remains identified by SHA-256:

`56df21123dfd92bfabf80f0adab9855f92e5c7227b4f5b8172afa9f805aa9a45`

Its original scripts/results are not edited or relabeled as passing. The new assertion suite is separate.

## Permanent suite

The dependency-free suite lives at:

`tests/assertions/ib01/`

Run:

```text
cd tests/assertions/ib01
npm test
```

The suite qualifies ten oracle families against fourteen cases. For every case:

1. the historical/broken observation must be rejected;
2. a corrected control must be accepted.

The local qualification run used Node `v22.16.0`.

Result:

- cases: **14**
- sensitive cases: **14**
- failures: **0**

## Qualified defect oracles

| Historical evidence | Qualified oracle | Historical state expected now |
| --- | --- | --- |
| T1 | startup fan-out | **KNOWN FAILURE** |
| T2 | hover pre-dwell request amplification | **KNOWN FAILURE** |
| T3 | viewer takeover cancels navigation on synchronous open failure | **KNOWN FAILURE** |
| T4 | native tooltip removal without active hover replacement | **KNOWN FAILURE** |
| T5 | destructive responsive-picture handling | **KNOWN FAILURE** |
| T6 | overlapping download fallback | **KNOWN FAILURE** |
| T7 | false favorite success on login/error HTML | **KNOWN FAILURE** |
| T8 | append retry/restart liveness | **KNOWN FAILURE** |
| T9 | hover-video source retention | **KNOWN FAILURE** |
| T10 | generic-host mutation risk | **KNOWN FAILURE / SCOPE REMOVAL TARGET** |

The new Sankaku idol fixture covers the source-confirmed generic risk omitted from the original T10 runtime fixture. It is **not** represented as historical T10 execution.

## What PASS means

IB01 PASS means the assertion oracles are sensitive to their assigned defects.

It does **not** mean:

- `Booru_Enhancer.user.js` has been fixed;
- live Rule34/e621/e926/Gelbooru behavior has been validated;
- real media transfer cancellation has been observed;
- BFCache behavior has been tested;
- browser autoplay policy has been tested;
- userscript isolated/page-world behavior has been tested;
- manager download completion has been verified.

Later checkpoints must feed observations from their candidate artifact into these or equivalently qualified assertions.

## Scope audit

Allowed IB01 work:

- separate test runner and fixtures;
- qualification of historical defect assertions;
- explicit missing-idol negative fixture;
- result and mapping documentation.

Forbidden work remained absent:

- no historical harness edits;
- no production source edits;
- no feature fixes;
- no runtime/browser support claims;
- no evidence gate promotions;
- no O13 relabeling.

## Acceptance record

- Historical ZIP identity retained: **PASS**
- New tests separated from historical evidence: **PASS**
- Explicit runnable entry point: **PASS**
- Dependency-free deterministic qualification run exits successfully: **PASS**
- Every oracle rejects its broken/historical observation: **PASS**
- Every oracle accepts its corrected control: **PASS**
- Missing idol risk fixture added without mislabeling it historical execution: **PASS**
- Production source unchanged: **PASS**
- Evidence gates promoted: **NONE**

**IB01 complete. Next checkpoint: IB02 — Correct O13 and complete local ownership evidence.**
