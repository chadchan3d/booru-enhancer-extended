# IB02 — Correct O13 and Complete Local Ownership Evidence

**Checkpoint:** IB02  
**Status:** PASS — local prerequisite only  
**Production source modified:** No

## Result

The O13 focus-restoration defect is corrected in the isolated ownership probe.

The local candidate now returns focus to the surviving native origin only when disposal removes the currently focused owned subtree. If focus moved elsewhere first, disposal leaves it alone. If the origin disappeared, a declared surviving native fallback is used. If neither survives, the probe reports reload recovery instead of inventing a target.

The dependency-free local suite executed **21 cases: 21 passed, 0 failed**.

This result completes the **local IB02 prerequisite**. It does **not** close G-OWN. Browser ownership/navigation/focus behavior remains for IB04.

## Relationship to prior EC1 evidence

The prior EC0/EC1 ledger remains authoritative historical evidence:

- O01–O12 had already passed in the earlier jsdom-based probe with negative controls.
- O13 had failed because removing the focused enhancer-owned control left active focus on BODY.
- The original O13 failure artifact is not edited or relabeled.

IB02 introduces a new isolated probe revision. It re-exercises O01–O12 and specifically demonstrates the corrected O13 contract plus the remaining local cases required by the blueprint.

## Candidate policy

The probe remains intentionally small. It records only enhancer-owned attribute edits, enhancer-added nodes, enhancer-owned event listeners, cleanup callbacks, late-callback guards, and a native focus origin with optional declared fallback.

On disposal:

1. later native attribute writes win;
2. untouched enhancer edits restore their original native value/presence;
3. only enhancer additions/listeners/cleanup are removed;
4. focus returns only if the node being removed still owns current focus;
5. later user/native focus is never stolen;
6. a missing origin uses only a declared surviving native fallback;
7. if neither target survives, the result explicitly reports reload recovery.

No generalized reactive owner, global focus manager, DOM snapshot framework or production viewer change was introduced.

## Local test results

| ID | Contract | Result |
| --- | --- | --- |
| O01 | Static attribute/structure restoration | PASS |
| O02 | Native node identity and native listener retained | PASS |
| O03 | Five mount/dispose cycles; idempotent dispose | PASS |
| O04 | Later native attribute edits survive | PASS |
| O05 | Same-value native write prevents stale restoration | PASS |
| O06 | Late guarded work suppressed; cleanup once | PASS |
| O07 | Synchronous viewer-open failure leaves click uncancelled | PASS |
| O08 | Later media failure preserves explicit native destination | PASS |
| O09 | Modifier/middle clicks avoid takeover | PASS |
| O10 | Ordinary append failure retains readable additions/paginator | PASS |
| O11 | Full disposal removes owned addition only | PASS |
| O12 | Nested native control avoids takeover | PASS |
| O13 | Focused owned control returns focus to surviving native origin | PASS |
| O13 mutant | Missing focus return is detected | PASS sensitivity |
| O14 | Later user/native focus is not stolen | PASS |
| O15 | Missing origin uses declared surviving native fallback | PASS |
| O16 | Missing origin and fallback reports reload recovery | PASS |
| O17 | Native card replacement is not overwritten by old-owner disposal | PASS |
| O18 | Moved native source keeps identity and correct restoration | PASS |
| O19 | Repeated native edits preserve the latest native value | PASS |
| O20 | Disabled hover leaves native label; replacement accessibility restores | PASS |

## Evidence boundaries

The new local test model is deterministic and dependency-free. It supplements the previous jsdom evidence; it is not represented as browser evidence.

It does not prove real browser focus/navigation behavior, MutationObserver scheduling in Chromium/Firefox, native framework lifecycle timing, media network cancellation, BFCache, autoplay, or userscript-manager execution-world behavior.

Those remain open and are intentionally assigned to IB03/IB04 and later evidence gates.

## Acceptance audit

- O13 candidate returns focus to native origin: **PASS**
- Missing-return mutant remains detectable: **PASS**
- Focus moved elsewhere is preserved: **PASS**
- Missing origin uses declared fallback only: **PASS**
- No target produces explicit reload-recovery result: **PASS**
- Card replacement/moved source/repeated native writes covered: **PASS**
- Disabled-hover accessibility/restoration covered: **PASS**
- O01–O12 bounded contracts remain green in this probe: **PASS**
- Production userscript changed: **NO**
- G-OWN promoted to PASS: **NO**

**IB02 complete. IB03 — Runtime primitives and minimal compatibility boundary — is independently eligible. IB04 remains blocked until real runtime/browser evidence exists and browser ownership is validated.**
