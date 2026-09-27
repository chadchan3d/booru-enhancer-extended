# Blueprint Reconciliation Audit — IB00–IB08

**Controlling specification:** `docs/implementation/Final_Implementation_Blueprint.md` (commit `4c81cdec`, blob `432768c5ccf3bddba5a1cdc8ce74303a95d95f6a`)
**Branch audited:** `implementation/ib00-baseline` at `4c81cdec`
**Production source at audit:** `Booru_Enhancer.user.js` blob `dc55026e11a14bd264b024d9727bb167c3873c1a` (last changed in `b9ebaf3`)
**Audit mode:** Read-only document and evidence-file review.

## Method and limits

Earlier checkpoint work was carried out without the blueprint present in the implementing session. This audit checks each committed checkpoint record against the blueprint's checkpoint definitions and confirms that the result files it cites exist on the branch and agree with the record.

It does **not** re-execute tests, re-run browser conformance or re-observe live sites. Every scoped PASS below is therefore "record and evidence files consistent", not "independently re-verified".

"TC" is the Tampermonkey × Chromium runtime cell. No record claims VC, TF or VF; those cells remain open, as the blueprint requires.

## Checkpoint state

| Checkpoint | Outcome | Record | Evidence files |
| --- | --- | --- | --- |
| IB00 — Baseline and recovery | PASS(scope) | `docs/implementation/IB00_BASELINE_RECOVERY.md` (`faf1c70`) | Baseline identity, preservation inventory, recovery procedure; open gates explicitly not promoted |
| IB01 — Permanent assertion harness | PASS(scope) | `docs/implementation/IB01_ASSERTION_HARNESS.md` (`f24eef2`) | `tests/assertions/ib01/qualification-result.json` — 14 cases, 14 sensitive; T1–T10 retained as known-failure oracles |
| IB02 — Correct O13, local ownership | PASS(scope: local prerequisite only) | `docs/implementation/IB02_LOCAL_OWNERSHIP.md` (`1e6dc9b`) | `tests/ownership/ib02/qualification-result.json` — 21/21. Does not close G-OWN; browser ownership deferred to IB04 as the blueprint requires |
| IB03 — Runtime primitives | PASS(scope: measured TC primitives) | `docs/implementation/IB03_RUNTIME_PRIMITIVES.md` (`b449074`) | `tests/runtime/ib03/TC_TAMPERMONKEY_CHROMIUM_RESULT_SUMMARY.json`; wrapper conformance 11/11 |
| IB04 — Browser ownership, bounded disposal | PASS(scope: TC path) | `docs/implementation/IB04_BROWSER_OWNERSHIP.md` (`a58c029`) | `tests/browser/ib04/TC_BROWSER_RESULT_SUMMARY.json` (18/18); `tests/browser/ib04/TC_PRODUCTION_RESULT_SUMMARY.json` (10/10, source blob `4f43d0dc`); static checks; `SHA256SUMS.txt` |
| IB05 — Settings schema, migration, mount barrier | PASS(scope: TC path) | `docs/implementation/IB05_SETTINGS_GATE.md` (`9b590d7`) | `tests/settings/ib05/model-result.json` (23/23); `tests/browser/ib05/TC_SETTINGS_MOUNT_RESULT_SUMMARY.json` (10/10); `tests/browser/ib05/TC_PRODUCTION_RESULT_SUMMARY.json` (12/12, source blob `02105f26`) |
| IB06 — Enhancer-HTTP request gate | PASS(scope: TC path) | `docs/implementation/IB06_REQUEST_GATE.md` (`8b08f01`) | `tests/request/ib06/model-result.json` (21/21); `tests/browser/ib06/TC_REQUEST_GATE_RESULT_SUMMARY.json` (corrected run 11/11); `tests/request/ib06/production_static_result.json` (15/15); `tests/request/ib06/production_gate_mock_result.json` (11/11); `tests/browser/ib06/TC_PRODUCTION_RESULT_SUMMARY.json` (12/12, source blob `74adf9e1`) |
| IB07 — Current-host metadata, Post facts, scope corrections | PARTIAL—NOT COMPLETE | See below | See below |
| IB08 — Reversible native rendition integration | NOT STARTED | — | No G-RENDITION records, currentSrc traces or restoration records exist |

## IB07 detail

### Done

- **Scope corrections** (commit `47423cebb0825c1dbadd0159e8dfc3a519be87db`, recorded in `IB07_HOST_FACTS.md`): wildcard `*.donmai.us` activation removed, with explicit `danbooru.donmai.us` and `atfbooru.ninja` retained; current-phase activation removed for `rule34.us`, `chan.sankakucomplex.com`, `idol.sankakucomplex.com` and `beta.sankakucomplex.com` (the blueprint's four excluded matches); generic adapter's broad favorite selector removed. Broad `@connect` permissions intentionally left for later release minimization.

### Scoped native G-HOST passes, with open items

| Host | Passed (native-only, no endpoint admitted) | Still open | Record |
| --- | --- | --- | --- |
| Rule34.xxx | Listing cards; image-post (logged-out/native context) | Video posts; GIF/animated; favorite/action | `IB07_RULE34_V1N.md` (`dff90a9`) |
| e621.net | Listing cards; image-post core media/file facts; category-tag DOM structure | Video/GIF posts; pagination continuation; favorite/action | `IB07_E621_V1N.md` (`47cccd3`, `c43378a`) |
| e926.net | Listing cards; image-post core Post facts (source blob `dc55026e`) | Video/GIF posts; pagination continuation; favorite/action | `IB07_E926_V1N.md` (`192b995`) |
| Gelbooru.com | Post-level image and video observation summarized only | Dedicated V1-N record (listing route, cards, raw post facts); structured metadata; pagination; actions | `IB07_HOST_CAPABILITY_MATRIX.md` (`bb0c797`) summary only |

### Not started (correctly blocked until the relevant G-HOST rows pass)

Host-specific resolver policies; auth/body classification; bounded cache and negative results; minimal Post/four-slot normalization; account invalidation; per-host acceptance criteria that depend on these (Rule34 DAPI/API origin distinction, Gelbooru key-required path handling, signed-URL lifetime).

### Audit correction

This table was corrected against the per-host record bodies (commit `c2e69ba`): e621's category-tag DOM structure moved from open to passed (record body, `c43378a`/`c065308`), and e926's post observation moved from open to passed (`192b995`). `IB07_HOST_FACTS.md` §"Current gate state" was updated to index the scoped per-host rows (commit `c2e69ba`); it no longer lists every G-HOST row as OPEN.

## Work outside blueprint scope

- `docs/implementation/IB08_ADAPTER_BOUNDARY.md` (`41cd6e5`) defines an "adapter boundary" checkpoint that does not exist in the blueprint. The blueprint's IB08 is "Reversible native rendition integration." The document also proposes new sub-phases and an adapter-contract surface, which the blueprint's handoff protocol excludes ("Do not launch another broad architecture critique"). Its "admitted host evidence" summary duplicates IB07 records.

**Disposition:** remove it from `docs/implementation/`, or move it to `docs/notes/ADAPTER_BOUNDARY_NOTES.md` with a header stating it is a non-checkpoint note and not IB08. Do not use it as a basis for work.

## Repository hygiene

- `implementation/ib01-harness` (tip `07e0bcd`, open PR #1) has diverged from `implementation/ib00-baseline` and is not contained in it. Decide whether to merge its harness work into the work branch or close it, so there is one implementation line.

## Next eligible work

**Continue IB07.** In blueprint priority order:

1. Commit a Gelbooru V1-N record from operator observations (listing route, three cards, one post, native links, rendition/media facts, pagination, account context).
2. Close or explicitly scope out the open per-host items listed above.
3. Update `IB07_HOST_FACTS.md` gate state.
4. Only for a host whose required facts are *not* supplied natively, admit and implement a resolver under a passed G-HOST row.

IB08 becomes eligible when IB07 supplies the host identity and facts it depends on.
