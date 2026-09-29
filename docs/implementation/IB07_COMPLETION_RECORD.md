# IB07 — Checkpoint completion record

**Checkpoint:** IB07 — Current-host metadata, Post facts and scope corrections

**Outcome:** **PASS(scope)** (see Scope and Outcome)

**Evidence gate owned (§5):** G-HOST

**Record date:** 2026-09-29

The fields follow the blueprint §11 "Required checkpoint completion record".

## Identity

| Item | Value |
| --- | --- |
| Checkpoint | IB07 — Current-host metadata, Post facts and scope corrections |
| Executor | Implementing agent; live evidence by the operator (ChadChan3D) |
| Source before | `Booru_Enhancer.user.js` blob `74adf9e192d2c00c1d493588cc9202388326402d` (the IB06-conformed artifact) |
| Source after | blob `32d0051fe73505984066a5b69766b5eafc242bb9`, commit `c551bb0` |
| Common artifact hash | production body SHA-256 `132263e8ba33110cd795c839a8958529a4532f2504c4367e76ecfbf83567551a`, identical in both conformance packages; C00 matched it in all seven live runs |

## Scope

Qualified, native-only (no endpoint strategy):

| Host | Qualified contexts | Post facts |
| --- | --- | --- |
| Rule34.xxx | Native listing recognition and identity (no Post built from listing cards); logged-out ordinary image post | sample from `img#image`; original from the native original link; Statistics dimensions; rating, score, source text, tags from `alt`; `siteId` `rule34`; `pageCount` 1; preview and other unobserved fields unknown |
| e621.net | Native listing Posts; logged-out ordinary image post | native file, sample, preview, MD5, size, dimensions, rating, score, tags with categories, source; `pageCount` 1 |
| e926.net | Independently qualified native listing Posts; logged-out ordinary image post | as e621, observed on e926 directly; `siteId` `e926`; `pageCount` 1 |
| Gelbooru.com | Logged-out native ordinary image post (minimal native Post) | sample, original, dimensions, score, `siteId` `gelbooru`, `pageCount` 1; rating, byte size, MD5, Source, date, preview and tag names unknown. Listing facts exist, but production gallery behavior stays inactive where no candidate container matches (none matched live) |

**Excluded or deferred:**
- rule34.us, chan.sankakucomplex.com, idol.sankakucomplex.com, beta.sankakucomplex.com (activation removed; release note);
- other unqualified Gelbooru-family and legacy hosts;
- API/HTML endpoint strategies;
- video/GIF;
- pagination (G-PLACE-T / IB12);
- hover (G-HOVER / G-VIDEO);
- viewer (IB11);
- favorites/actions (G-ACTION / IB14);
- downloads (G-DOWNLOAD / IB13);
- rendition policy (G-RENDITION / IB08);
- Pixiv (IB17).

**Unusual shapes, NOT OBSERVED LIVE and failing closed:**
- a Rule34 post page with no native original link (original stays unknown);
- e621/e926 cards or containers without `data-sample-url` (sample stays unknown).

## Invariant

"Native facts come first; missing facts resolve only for an admitted need through a validated strategy; unknown remains unknown."

Direct evidence:
- Each qualified host resolves Posts only from observed native DOM facts.
- No resolver request exists: the endpoint helpers are unreachable, and the native producers contain no network call.
- Unobserved facts stay unknown: rating, byte size, Source, preview and tag names where not observed, and the three restricted slots.
- `pageCount` is `null` unless a qualified producer establishes a single item.
- §3 item 9 assertions and live conformance demonstrate all of the above.

## Preconditions

G-OWN, G-RUNTIME, G-SETTINGS and G-REQUEST are PASS for the active TC path (IB04–IB06 records). G-HOST rows were passed per host, route and context before each resolver was wired (per-host V1-N records; `IB07_HOST_FACTS.md` §"Current gate state").

## Change

**Conceptual:**
- host-specific native strategies in `BE.adapters`;
- family safeguard shutdown (no DAPI/HTML dispatch, no batch resolver);
- activation allowlist narrowed;
- generic favorite selector removed;
- a minimal Post with slot provenance, canonical `siteId` and `pageCount`.

**Production commits, in order:**

| Commit | Change |
| --- | --- |
| `47423ce` | Scope and safety corrections |
| `8aaefea` | Rule34 native post; family safeguard |
| `4918893`, `3e44cbf`, `c065308`, `8d3927e` | e621 listing and post |
| `5df9891`, `b9ebaf3` | e926 listing and post |
| `9cade1a` | Gelbooru native image post |
| `1c992bc` | Fail-closed slot restriction |
| `0c2e32e` | Rule34 preview unknown |
| `5064dfd` | Rule34 `siteId` |
| `c551bb0` | `pageCount` |

**Forbidden-scope audit:**
- no unverified API/HTML fallback;
- no guessed CDN or extension cascade;
- no credential UI;
- no e926→e621 inheritance;
- no content graph or cursor;
- no readmission of rule34.us or Sankaku;
- no later-checkpoint behavior.

## Tests

| Suite | Result |
| --- | --- |
| §3 item 9 (`tests/host/ib07/item9_assertions.cjs`) | 31/31 PASS, 31/31 controls |
| Post `pageCount` (`pagecount_assertions.cjs`) | 11/11 PASS, 8/8 controls |
| Excluded hosts and stored preferences (`exclusion_assertions.cjs`) | 8/8 PASS, 9/9 controls |
| Gelbooru native-post | 14/14 |
| Rule34/e621/e926 conformance verifier | 60/60 |
| Gelbooru conformance verifier | 29/29 |
| IB01–IB06 regressions | IB01 14/14 sensitive; IB02 21/21; IB03 11/11; IB05 23/23; IB06 21/21 |

**Live exact-artifact conformance, 7/7 PASS with 0 failed checks and C00 matched on each:**
- Rule34 listing (42 cards) and image post;
- e621 listing (72/72 Posts) and image post;
- e926 listing (74/74 Posts) and image post;
- Gelbooru image post (16/16 checks).

Results: `tests/browser/ib07/TC_R34E6_PRODUCTION_RESULT_SUMMARY_C551BB0.json` and `TC_GELBOORU_PRODUCTION_RESULT_SUMMARY_C551BB0.json`.

**Item 9 applicability:** endpoint, auth, cache and account clauses are NOT APPLICABLE(scope), because no admitted strategy issues a metadata read (`IB07_ACCEPTANCE_APPLICABILITY.md`).

**Not tested:** video/GIF, pagination, hover, viewer, favorites/actions, downloads, rendition, and non-qualified hosts. Runtime cells other than Tampermonkey × Chrome were not tested, and manager/browser versions were not relayed.

## Preservation

- **§3 item 8, dedicated candidate code not deleted merely for neatness:** the Gelbooru-family DAPI/HTML helpers are retained, unreachable.
- **Valid native URLs and links:** native pages stay untouched (R10); the viewer and open actions use their existing slot fallbacks.
- **Saved host preferences:** P1, nothing deleted or changed at startup.
- **§6 row "rule34.us and three Sankaku matches":** explicit removal; no generic actions (X3); stored preferences remain (P1); exclusion fixtures including idol (X1, idol independent); release note in `CHANGELOG.md` §"Unreleased — Host scope changes".
- **Accepted behavior change, confined to an unobserved shape:** on a Rule34 post with no native original link, enhancer download now truthfully reports no original instead of saving the displayed file.

## Evidence

- Per-host records: `IB07_RULE34_V1N.md`, `IB07_E621_V1N.md`, `IB07_E926_V1N.md`, `IB07_GELBOORU_V1N.md`.
- Indexes and manifest: `IB07_HOST_FACTS.md`, `IB07_PROBE_MANIFEST.json`.
- Assessments: `IB07_ACCEPTANCE_APPLICABILITY.md`, `IB07_SLOT_PROVENANCE_EVIDENCE.md`.
- Test results: `tests/host/ib07/*-result.json`.
- Conformance packages and results: `tests/browser/ib07/`.

All live evidence was sanitized in the browser.

**Limitations retained:**
- The live postamble does not count requests issued synchronously during startup before it loads. Live runs show no queued or in-flight reads at postamble load and end, and no requests during the instrumented periods. This is not a live claim of zero startup requests; the fully instrumented local item 9 T1/T2 suite is the startup/request-control evidence.
- The earlier DevTools slot-provenance live runs are POTENTIALLY CONTAMINATED / SUPERSEDED FOR LIVE-HOST CLAIMS and are not used as clean evidence.
- The Gelbooru startup/hover proof uses a fixture with a candidate container (case B), because the observed live listing starts no gallery. This is non-blocking: production gallery behavior there is inactive, and the metadata paths fail closed.

## Provenance

No donor code was copied or translated. All changes are original to this repository (MIT).

## Failure / recovery

**Capability shutdown:** any qualified native path returns null, leaving the native page untouched, when:
- its host, route or identity gate fails;
- its media is out of scope;
- a video element is present (Gelbooru).

Missing facts stay unknown.

**Rollback:** revert the production commits above. User settings are not the rollback substrate, and no preference data depends on IB07 behavior.

## Gate transitions

| Gate row | Before | After |
| --- | --- | --- |
| G-HOST Rule34 listing | OPEN | PASS(scope) |
| G-HOST Rule34 logged-out image post | OPEN | PASS(scope) |
| G-HOST e621 listing | OPEN | PASS(scope) |
| G-HOST e621 image post | OPEN | PASS(scope) |
| G-HOST e926 listing | OPEN | PASS(scope) |
| G-HOST e926 image post | OPEN | PASS(scope) |
| G-HOST Gelbooru logged-out image post | OPEN | PASS(scope) |
| G-HOST Gelbooru listing facts | OPEN | observed, not acted on |
| Video/GIF post rows (all hosts) | OPEN | OPEN |
| Other family and legacy hosts | unknown | unknown (separate policies) |

No row is inferred from another host. Earlier live PASS runs for artifacts `5064dfd` (Rule34/e621/e926) and `9cade1a` (Gelbooru) are historical; the final conformance is on `c551bb0`.

**Opened for later checkpoints:** measured host facts for renditions, hover, place, download and actions on the qualified contexts. IB08 (Reversible native rendition integration) becomes eligible.

## Outcome

**IB07 PASS(scope)** for the Scope above.

§3 item 10 acceptance:
- Rule34 same-origin DAPI and the documented API origin are distinguished by exclusion: no API strategy is admitted, and the DAPI helper is unreachable.
- No imported 60/60 HTML budget.
- The Gelbooru key-required path is not probed.
- Safebooru and other hosts retain separate unknown policies.
- The Post has site, id, native URL, kind, `pageCount` (null unknown / 1 known single item) and naming facts (decision A: ID fallback preserved; unobserved names unknown), plus thumbnail, sample, original and poster optional facts where observed.
- DOM nodes and credentials stay out of the Post.
- No Post or URL is persisted (signed URLs stay in memory).

**Next eligible checkpoint:** IB08 — Reversible native rendition integration. Not started.
