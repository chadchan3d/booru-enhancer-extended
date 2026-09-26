# Implementation Handoff — Pause During IB04

**Project:** Booru Enhancer Extended  
**Branch:** `implementation/ib00-baseline`  
**Pinned production baseline:** `6f06dfd19fe916be784fd6bafe6dce6ed76503fe`  
**Current production-candidate userscript blob:** `4f43d0dc57cbbbe70726e36263fc6854d0bd0cad`  
**Userscript metadata version:** `1.2.7.3`  
**Current source syntax check:** PASS  
**Main branch merged:** NO

This handoff records the exact point at which implementation is paused. Resume from the repository state on this branch; do not reconstruct earlier work from prose alone.

## Governing implementation rule

Implementation follows the final checkpoint blueprint one checkpoint at a time.

A checkpoint is complete only when:

- its invariant is demonstrated;
- required tests pass;
- later-scope work did not leak in;
- required existing behavior remains intact;
- evidence is recorded.

Do not skip an open evidence gate because code exists.

## Checkpoint state

### IB00 — Baseline and recovery

**PASS**

Established:

- pinned source/recovery baseline;
- 30-setting preservation inventory;
- behavior/surface preservation obligations;
- recovery and preference-backup procedures;
- initial host/runtime scope.

Primary records:

- `docs/implementation/IB00_BASELINE_RECOVERY.md`
- `docs/implementation/IB00_MANIFEST.json`

### IB01 — Permanent assertion harness

**PASS**

Established a separate, dependency-free assertion suite without rewriting the historical Claude defect harness.

Qualification result:

- 14 cases;
- 14 sensitive cases;
- 0 failures.

Primary records:

- `docs/implementation/IB01_ASSERTION_HARNESS.md`
- `tests/assertions/ib01/`

The suite qualifies oracles for the historical T1–T10 defect families. It does not claim the production script is already fixed for every later checkpoint.

### IB02 — Local ownership contract

**PASS — local prerequisite**

The isolated owner probe corrected O13 and completed the bounded local ownership contract.

Result:

- 21 cases;
- 21 passed;
- 0 failed.

Important policy established:

- dispose only owned effects;
- later native writes win;
- same-value native writes invalidate stale restoration;
- focused owned controls return focus only when disposal removes the still-focused owned subtree;
- later user/native focus is not stolen;
- declared fallback is used only when the origin is gone;
- no surviving target produces explicit reload-recovery instead of fabricated restoration.

Primary records:

- `docs/implementation/IB02_LOCAL_OWNERSHIP.md`
- `tests/ownership/ib02/`

This local result by itself did not close browser G-OWN.

### IB03 — Runtime primitives

**PASS — scoped to measured TC primitives**

Measured development cell:

- Tampermonkey 5.5.0;
- Chrome 153;
- Windows 10 / Win32.

The common runtime probe established real behavior for storage, privileged requests, progress, timeout terminal signaling, physical abort, logical cancellation and menus.

Important runtime findings:

- legacy `GM_xmlhttpRequest` returns a non-thenable abortable handle;
- modern `GM.xmlHttpRequest` may return a thenable abortable handle;
- modern mode can signal terminal completion through callback and Promise, so settlement must be deduplicated;
- logical cancellation alone does not stop transport;
- physical abort produced manager abort plus controlled-server early-close evidence;
- HTTP 401/500 remain HTTP responses rather than transport errors;
- timeout is a terminal category, not a millisecond-precision guarantee.

Production integration added a small runtime boundary and hardened cancellation ordering.

Production runtime conformance:

- 11 tests;
- 11 passed;
- 0 failed.

Scoped admitted TC primitives:

- legacy storage;
- legacy privileged request;
- menu registration;
- same-origin native fetch.

Still open:

- Violentmonkey × Chromium;
- Tampermonkey × Firefox;
- Violentmonkey × Firefox;
- route/world observation;
- download runtime semantics.

Primary records:

- `docs/implementation/IB03_RUNTIME_PRIMITIVES.md`
- `docs/implementation/IB03_PROBE_MANIFEST.json`
- `tests/runtime/ib03/`

## IB04 — Current active checkpoint

### E-stage browser ownership fixture

**PASS**

The controlled browser ownership probe was run in the measured TC cell.

Result:

- 18 tests;
- 18 passed;
- 0 failed.

Passing contracts included:

- exact static restoration and native node identity;
- five mount/dispose cycles;
- later native edits;
- same-value native write invalidation;
- repeated native edits;
- moved responsive-source identity/location;
- native card replacement;
- late callback suppression;
- O13 focus return;
- later-focus preservation;
- declared fallback;
- explicit reload recovery;
- real native navigation after synchronous viewer-open failure;
- usable native fallback after later media failure;
- modifier/middle/native-control click preservation;
- accessible hover replacement/restoration;
- append failure versus explicit full disposal;
- native listener preservation.

This closes the **E-stage G-OWN premise for those named effects in TC only**.

Primary evidence:

- `tests/browser/ib04/TC_BROWSER_RESULT_SUMMARY.json`
- `tests/browser/ib04/IB04_Browser_Ownership_Probe.user.js`
- `tests/browser/ib04/fixture.html`

### Production IB04 integration

**IMPLEMENTED — production browser conformance still OPEN**

The production userscript has already been modified within IB04's admitted scope.

Current production-candidate userscript Git blob:

`4f43d0dc57cbbbe70726e36263fc6854d0bd0cad`

Current whole-source syntax parse:

**PASS**

Production IB04 commits recorded by the checkpoint manifest:

1. `9faa012d4f59aad5ff035165de5a0643184995bc` — Add bounded effect ownership helper
2. `ea1d9380113efc9ef7729ba290920b240351ef50` — Own viewer lifecycle and failure fallback
3. `5270345d2726b425e67fbd39e9a13c9dbfbc5c15` — Own gallery container lifecycle
4. `edeabcdaae28d73bfe2aac222f67705b0b106223` — Own thumbnail mutations and preserve native sources
5. `1cca41345e6ab74151a5967a7b803c71afd7e396` — Pass native focus context into viewer
6. `2f6cb1dfd1981333d615ffa994a628d590d46489` — Make gallery viewer takeover fail-safe
7. `01fd0f96555745e390ea16fc7ce6a84e50360b8b` — Add bounded gallery disposal

Integrated behavior now includes:

- bounded attribute/class/style ownership;
- pending MutationObserver record draining before restoration decisions;
- preservation of later native changes;
- owned gallery delegated listeners;
- owned settings/resize cleanup;
- owned thumbnail action UI;
- owned wrapper/image classes;
- preservation of e621 native `<picture>/<source>` node identity instead of deleting source nodes;
- temporary owned responsive source/srcset changes;
- hover suppression only while enhanced hover is enabled;
- accessible replacement labels where native hover labels are temporarily suppressed;
- restoration of hover labels on disable/disposal;
- viewer lifecycle ownership and disposal;
- native focus origin/fallback passed to viewer;
- focus return only if focus is still within the viewer;
- native-post fallback link on media load failure;
- modifier/middle/native-control click preservation;
- synchronous viewer shell must open successfully before ordinary navigation is cancelled;
- bounded gallery disposal.

Explicitly **not** added in IB04:

- generalized reactive owner;
- cloned native subtree restoration;
- universal DOM snapshot restoration;
- new adapters;
- request scheduler/gate;
- new hover/rendition policy;
- SPA route ownership;
- download changes.

### Production static conformance

**PASS**

Current record:

`tests/browser/ib04/production_static_result.json`

Static checks cover:

- bounded ownership helper present;
- viewer lifecycle owned;
- viewer disposer exported;
- native viewer failure fallback present;
- gallery delegated listeners owned;
- gallery disposer exported;
- destructive `source.remove()` absent;
- responsive source mutations owned;
- hover suppression gated by hover setting;
- accessible hover replacement present;
- nested native-control guard present;
- viewer takeover occurs before `preventDefault()`;
- native focus context passed to viewer;
- settings-listener cleanup owned.

This static result must **not** be treated as the required browser conformance result.

## Exact blocker / next action

**IB04 is not complete. Do not start IB05 yet.**

The next required action is the real-browser run of:

`tests/browser/ib04/IB04_Production_Conformance.user.js`

against the existing local IB04 fixture/server in the measured TC cell.

The artifact was derived from production source blob:

`4f43d0dc57cbbbe70726e36263fc6854d0bd0cad`

Recorded artifact Git blob:

`d282a13c745b5bfcfd95fddd9d516166c4881532`

It is local-only:

- public site `@match` entries replaced with `http://127.0.0.1:8775/*`;
- public `@connect` entries removed;
- update/download URLs removed;
- production code body retained;
- local production-conformance postamble appended.

Current fixture Git blob:

`ee7d4ac0ddecdcfd3e9b3712ec6c533d48e5e5b1`

The operator may reuse the already extracted local fixture/server.

### Operator sequence

1. Run the existing IB04 local server with `node server.cjs`.
2. Disable/remove the earlier `IB04_Browser_Ownership_Probe.user.js` test script so only the production-conformance script acts on the fixture.
3. Install `IB04_Production_Conformance.user.js` in Tampermonkey.
4. Open/refresh `http://127.0.0.1:8775/`.
5. Run the production conformance command exposed by the script.
6. Return the entire result JSON.
7. Review the JSON before changing any more production code.

Expected disposition:

- if all named integrated cases pass, close **G-OWN production TC** for those named effects and complete IB04;
- if any case fails, identify the smallest affected production call site and reduce/revert that call site;
- do not mask a failure by expanding the ownership framework.

## Gate state at pause

- G-RUNTIME TC admitted primitives: PASS for implementation
- G-OWN E-stage named TC effects: PASS
- **G-OWN production TC: OPEN—NOT RUN**
- G-OWN VC: OPEN—NOT RUN
- G-OWN TF: OPEN—NOT RUN
- G-OWN VF: OPEN—NOT RUN
- live-site ownership: NOT CLAIMED
- route/world observation: OPEN
- download runtime semantics: OPEN

## IB05 must remain blocked

IB05 is the settings-schema/migration/mount-barrier checkpoint.

Do not begin IB05 until IB04 production browser conformance passes for the active TC development path.

When IB05 becomes eligible, its purpose is to introduce schema versioning and migration without changing effective saved choices or inferring installation age from an empty store. That work must consume the existing IB03 storage contract and the completed IB04 mount/disposal contract.

## Branch / release discipline

- Continue on `implementation/ib00-baseline`.
- Do not merge this branch into `main` merely because source compiles.
- Do not increment the public release version during an incomplete checkpoint unless the blueprint explicitly assigns it.
- Do not rewrite historical evidence files to make a new result look passing.
- Keep raw operator traces out of the public repository; commit sanitized summaries only.
- Preserve upstream MIT attribution and current project attribution.
- Do not commit private local paths, personal identity, credentials, account IDs, cookies, CSRF values or signed private URLs.

## Current repository delta from production baseline

At pause, the implementation branch is **53 commits ahead** of the pinned production baseline and **0 commits behind** that baseline.

The branch includes checkpoint documentation/tests plus the partial IB04 production implementation. It has **not** been merged into `main`.

## Resume checklist for the next implementation window

1. Fetch/read this handoff first.
2. Confirm branch is `implementation/ib00-baseline`.
3. Fetch `Booru_Enhancer.user.js` and verify Git blob `4f43d0dc57cbbbe70726e36263fc6854d0bd0cad` before further source edits.
4. Confirm whole-source syntax still parses.
5. Read:
   - `docs/implementation/IB04_BROWSER_OWNERSHIP.md`
   - `docs/implementation/IB04_PROBE_MANIFEST.json`
   - `tests/browser/ib04/TC_BROWSER_RESULT_SUMMARY.json`
   - `tests/browser/ib04/production_static_result.json`
6. Do **not** alter production source before the production-conformance browser result is reviewed.
7. Run/review `IB04_Production_Conformance.user.js` in TC.
8. Close or repair IB04 strictly from that evidence.
9. Only after IB04 passes, move to IB05.

## Product/architecture constraints that remain controlling

The product is still one userscript, not separate manager/browser editions.

Generalization rule:

**Generalize behavior/infrastructure; localize extraction, semantics and actions.**

UX principle:

**Users should feel that their native gallery became better, not that another application replaced it.**

Failure principle:

**Failure by disappearing, not breaking the page.**

Deferred architecture remains deferred: no universal scheduler, resource leases, decode quotas, generalized content graph, reconstruction journal, reader/EH/ExH/nhentai, FurAffinity adapter, ugoira, votes, ZIP packaging, Pixiv infinite append, or cross-tab coordination.

The next window should treat checkpoint evidence and this branch state as authoritative implementation history, not reopen the architecture from scratch.
