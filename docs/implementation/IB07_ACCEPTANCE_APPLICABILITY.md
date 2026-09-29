# IB07 — §3 item 9 applicability and item 10 naming decision

**Checkpoint:** IB07 — Current-host metadata, Post facts and scope corrections  
**Record type:** planning record. It classifies which §3 item 9 tests apply; it implements none.  
**Production source:** commit `9cade1a` (blob `0715587162f65324fc1f85adf40e7f490b4220b3`), unchanged at record commit. Line numbers below refer to `Booru_Enhancer.user.js` at that source.

## §3 item 10: naming facts (approved decision A)

§3 item 10 requires the Post to carry "naming facts". It does not require every naming field to be populated.

- `BE.naming.build()` (line 2615) consumes `id`, `md5` (falls back to `id`), `rating`, `score`, `resolution`, `date`, and the character, artist and copyright tag names. Empty tag arrays become "Unknown Character", "Unknown Artist" and "Unknown Copyright". The default template is `{id}`.
- §6 ("Filename/template/open mode") preserves the template, character cap, delimiter and **ID fallback**, and assigns **cleaning missing fields** to IB13.
- IB07's invariant requires unknown to remain unknown rather than guessed.
- Precedent inside IB07: the Rule34 native image-post path passed G-HOST with its category tag arrays empty.

**Decision:** Gelbooru's unobserved category tag names remain UNKNOWN and do not hold IB07 open. No Gelbooru tag-name selector is added or guessed. This decision does **not** mean tag-name support has been proven. It records only that item 10 is satisfied by the naming facts the host has qualified, together with the preserved ID fallback.

## Admitted strategies

All four admitted IB07 strategies are **native-only**. None performs an enhancer metadata read.

| Host | Post page | Listing | Batch enrichment |
| --- | --- | --- | --- |
| Rule34.xxx | `rule34NativeImagePost()` (1930) | none | deferred to hover/click (4227); family `fetchThumbBatch` returns `[]` (2060–2063) |
| e621.net | `e6NativePostPage()` (2400) | `e621NativeListingPost()` (2391) | `fetchThumbBatch` maps native listing Posts (2431–2433) |
| e926.net | same functions, host branch; directly observed, not inherited | same | same |
| Gelbooru.com | `gelbooruNativeImagePost()` (1984) | none | family `fetchThumbBatch` returns `[]` (2060–2063) |

Metadata request reachability at this source:

- The Gelbooru-family endpoint helpers are unreachable. `gelbooruApiFetch` and `normalizeGelbooru` have no callers. `gelbooruFetchPostHTML` is called only by `gelbooruFetchPostsHTMLBounded`, which has no callers.
- `enrichThumbnails` (4224) logs ids the batch did not return as retryable (4261). It issues no per-id fallback request.
- The request call sites that remain belong to other adapters (danbooru 1822/1828, moebooru 2255/2261) or to other gates: infinite-scroll pagination (4355, G-PLACE-T / IB12) and favorite actions (2822/2827, G-ACTION / IB14).
- Post caches: the gallery module's `postCache` (3697) is page-memory, set only by replacement (4204, 4248), never merged and never persisted. The UI's `currentPostCache` (4505) is cleared on navigation (`invalidateCurrentPost`, 5194). No account-relative field is mapped into a Post.

## §3 item 9 applicability matrix

Classes: **REQUIRED/OPEN**: applies to the admitted strategy and has not yet been proven. **ALREADY PROVEN**: existing evidence or test satisfies it. **NOT APPLICABLE(scope)**: the admitted strategy has no mechanism the test could exercise. The "no unauthorized retries/fan-out" clause is split in two because its parts classify differently.

| Clause | Rule34.xxx | e621.net | e926.net | Gelbooru.com |
| --- | --- | --- | --- | --- |
| T1 desired assertion: no startup metadata fan-out | REQUIRED/OPEN | REQUIRED/OPEN | REQUIRED/OPEN | REQUIRED/OPEN |
| T2 desired assertion: no metadata request before hover dwell | REQUIRED/OPEN | REQUIRED/OPEN | REQUIRED/OPEN | REQUIRED/OPEN |
| No unauthorized fan-out on on-demand paths (`fetchPost` for viewer/hover/UI) | REQUIRED/OPEN | REQUIRED/OPEN | REQUIRED/OPEN | ALREADY PROVEN (post page) |
| No unauthorized retries | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) |
| One selected on-demand read | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) |
| Exact identity validation | REQUIRED/OPEN | REQUIRED/OPEN | REQUIRED/OPEN | ALREADY PROVEN |
| 200-auth / login / malformed bodies | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) |
| Cache expiry / account switch | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) |
| Partial merge versus explicit invalidation | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) | NOT APPLICABLE(scope) |
| Original bytes never assigned to a distinct sample | REQUIRED/OPEN | REQUIRED/OPEN (see finding 2) | REQUIRED/OPEN (see finding 2) | ALREADY PROVEN |
| Live host strategy and route evidence | ALREADY PROVEN | ALREADY PROVEN | ALREADY PROVEN | ALREADY PROVEN |

### Basis for each row

- **T1, T2.** These are the IB01 qualified oracles (`tests/assertions/ib01/oracles.cjs`: `startupFanout`, `hoverDwell`). They are still labeled KNOWN FAILURE for the historical baseline. IB01 requires later checkpoints to feed observations from their candidate into these oracles. No IB07 candidate observation has been recorded for any host. Gelbooru's C13/C14 counted zero requests on a **post** page with no interaction. That is neither a listing startup nor a pointer sweep, so it does not prove T1 or T2.
- **On-demand fan-out.** Gelbooru: ALREADY PROVEN on the post page by live production conformance C13 (zero requests while `fetchPost` produced the Post) and C14 (`tests/browser/ib07/TC_PRODUCTION_RESULT_SUMMARY.json`), within the recorded startup-observation limitation. Rule34, e621 and e926: their `fetchPost` has never been run with request instrumentation. Reading the code shows no call site, but reading code is not evidence.
- **Retries, one on-demand read, auth/login/malformed bodies.** Each concerns a response to an admitted enhancer read. No admitted strategy issues one, and the only endpoint helpers are unreachable. Retry and response classification for reads that do happen are owned by G-REQUEST (IB06 PASS).
- **Cache expiry / account switch, partial merge / invalidation.** The strategies read the current page's DOM. They cache in page memory only, replace entries without merging, persist nothing, and map no account-relative field. There is no expiry, account-scoped entry or merge to exercise. The allowed item 3 P-stage elements (bounded cache, negative results, account invalidation) were not built because no admitted strategy needs them.
- **Identity validation.** Each native parser checks that the element matches the requested id: Rule34 1933; Gelbooru 1989; e621/e926 post page 2405; listing 2396. Gelbooru is ALREADY PROVEN by `tests/host/ib07/gelbooru_native_post.cjs` (identity mismatch and missing id return null; mutation-checked) and live C04. The other three have no test.
- **Original never in a distinct sample.** Gelbooru is ALREADY PROVEN: live C06 and C08 (sample from `img#image`, distinct from the native original) and the implementation test. Rule34 takes its sample from `img#image` (1945) and e621/e926 from `data-sample-url` (2332), but neither is tested.
- **Live host strategy and route evidence.** V1-N records: `IB07_RULE34_V1N.md`, `IB07_E621_V1N.md`, `IB07_E926_V1N.md`, `IB07_GELBOORU_V1N.md`, indexed in `IB07_HOST_FACTS.md` §"Current gate state".

## Smallest remaining item 9 set

Three bounded groups. All are REQUIRED/OPEN; nothing else in item 9 is open.

1. **Request behavior of the candidate (T1, T2, on-demand fan-out).** For Rule34, e621, e926 and Gelbooru:
   - startup on a native listing issues zero enhancer metadata requests (T1);
   - a pointer sweep before dwell issues zero (T2);
   - for Rule34, e621 and e926, producing a Post on demand issues zero.

   Observations are fed into the IB01 `startupFanout` and `hoverDwell` oracles.
2. **Identity validation.** Rule34, e621 (post page and listing) and e926 native parsers return nothing on id mismatch or missing id.
3. **Original never in a distinct sample.** Rule34, e621 and e926 native parsers keep a distinct native sample in the sample slot and never put the original there. This includes a case with no sample attribute (see finding 2).

## Findings for decision (no change made)

1. **Rule34 fabricates an original from the sample** (1946: `originalUrl = originalLink?.href || sampleUrl`). When the native Original link is absent, the original slot receives the sample URL. This is not item 9's clause, which is about original→sample, but it conflicts with "unknown remains unknown" and with the rule the Gelbooru path enforces. A production change needs approval.
2. **e621/e926 fill the sample slot with the original** when the card has no `data-sample-url` (2332: `sampleUrl = d.sampleUrl || fileUrl`). If the host omits the attribute only when no distinct sample exists, this does not violate the clause. That has not been observed. The group 3 test will show the behavior. How to resolve a failure needs approval.
3. **Outside item 9, but required for closure:** §11 step 6 production conformance is `OPEN_NOT_RUN` for the Rule34, e621 and e926 integrations (`IB07_PROBE_MANIFEST.json`), and PASS(scope) only for Gelbooru. IB07 closure needs it for the other three hosts as well.

## Update: slot-provenance evidence and closure assessment

Item 9 is implemented (`tests/host/ib07/item9_assertions.cjs`): 26 PASS, 0 FAIL, 3 INCONCLUSIVE. Findings 1 and 2 correspond to `G3-3c-rule34.xxx` and `G3-3d-e621.net`/`G3-3d-e926.net`. The live slot-provenance runs left the target shapes **NOT OBSERVED LIVE**, so all three remain INCONCLUSIVE. The closure assessment in `IB07_SLOT_PROVENANCE_EVIDENCE.md` concludes that these branches block IB07 closure while the enabled parsers still fill the slot by inference (Rule34 line 1946; e621/e926 line 2332). The smallest follow-up is to disable only those two inferences.

## Update: restriction applied

The bounded restriction is in production blob `30cadd6`. Item 9 now reads 29 PASS, 0 FAIL, 0 INCONCLUSIVE. The three former INCONCLUSIVE rows assert production's fail-closed behavior; their host shapes stay NOT OBSERVED LIVE (`IB07_SLOT_PROVENANCE_EVIDENCE.md` §"Disposition").
