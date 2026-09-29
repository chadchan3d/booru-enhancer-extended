# IB07 — Slot-provenance evidence and disposition

**Checkpoint:** IB07 — Current-host metadata, Post facts and scope corrections (G-HOST)  
**Probe:** `tests/browser/ib07/IB07_Slot_Provenance_Probe.js` (SHA-256 `9cdfa30a…`), passive, sanitized in the browser  
**Result summary:** `tests/browser/ib07/SLOT_RESULT_SUMMARY.json`  
**Production source:** commit `9cade1a` (blob `0715587162f65324fc1f85adf40e7f490b4220b3`), unchanged

The evidence is operator-relayed and sanitized: statuses, counts and structural relationships only. Native page noise (blocked ad/tracker requests, Permissions-Policy warnings) was not probe or enhancer activity and is not recorded.

## Live observations

| Host | Runs | Status | Observed | Target shape |
| --- | --- | --- | --- | --- |
| Rule34.xxx | multiple image-post pages (count not relayed) | NOT_QUALIFIED each: a native original link was present | Control shape: `img#image` present; displayed resource structurally a sample; displayed natural dimensions smaller than the Statistics size; display ≠ original-link target. The normal host shape distinguishes sample from original. | `img#image` with no native original link: **NOT OBSERVED LIVE** |
| e621.net | 2 listing pages, 1 post page | NOT_QUALIFIED each | 140 cards: sample attribute absent 0, empty 0, present 140; sample equals file on 10, distinct on 130. Post page: sample and file both present. | Card or container without `data-sample-url`: **NOT OBSERVED LIVE** |
| e926.net | 1 listing page, 1 post page | NOT_QUALIFIED each | 75 cards: absent 0, empty 0, present 75; sample equals file on 3, distinct on 72. Post page: sample and file both present. | Same: **NOT OBSERVED LIVE** |

What this establishes:
- Rule34's normal shape keeps sample and original distinct.
- e621 and e926 each represent sample=file equivalence explicitly, with both attributes present. This was observed on e926 independently, not inferred from e621.

What it does **not** establish: that the target shapes cannot occur, any universal host behavior, or what an absent Original link or absent `data-sample-url` would mean. `G3-3c-rule34.xxx`, `G3-3d-e621.net` and `G3-3d-e926.net` stay **INCONCLUSIVE**. Item 9 stays 26 PASS, 0 FAIL, 3 INCONCLUSIVE.

## Do the three INCONCLUSIVE branches block IB07 closure?

**Conclusion: B.** The current production path enables behavior for the unobserved shapes, so the unresolved semantics block closure. They must be qualified, or bounded by a separate production task.

Basis:

1. **The shapes are reachable in enabled production.** Neither parser limits itself to the observed shape:
   - `rule34NativeImagePost` sets `originalUrl = originalLink?.href || sampleUrl` (line 1946). On a post page with no native original link, the Post's original slot receives the sample URL.
   - `normalizeE621NativeElement` sets `sampleUrl = d.sampleUrl || fileUrl` (line 2332), on both listing cards and post containers. Without `data-sample-url`, the sample slot receives the file URL.

   Whether the shapes are reachable depends on what the host serves, and "not observed in sampled pages" does not exclude them.
2. **Each fallback is an unvalidated resolution strategy.** §3 item 2: "missing facts resolve only for an admitted need through a validated strategy; unknown remains unknown." Each fallback resolves a missing fact by assuming equivalence. No G-HOST pass covers that context, and item 6 requires one "before that resolver is implemented and wired" ("new DOM extraction still requires observed markup"). No admitted need exists for filling the slot inside the adapter either: consumers already fall back across slots on their own.
3. **The live evidence argues against the assumption without deciding it.** e621 and e926 express sample=file equivalence explicitly, with both attributes present. The fallback infers that equivalence from absence, which the hosts were not seen to use.
4. **A (narrower scope) is not supported as the code stands.** Declaring the shapes out of scope while the enabled parser still assigns slot facts for them would leave a gate unqualified behind active code. §11 step 2: "a gate's absence cannot be hidden by an implementation stub." A narrower PASS(scope) needs the code to stop acting on the excluded shape.
5. **B does not rest merely on synthetic construction.** The fixtures only reproduce the parsers' own branches. The deciding facts are that the branches are live in production, and that the invariant they break is IB07's own acceptance condition (§11: "complete only when its invariant is demonstrated").
6. **Preservation does not protect these fallbacks.** Both were introduced inside IB07: Rule34 in `8aaefea`, e621/e926 in `4918893`. They are candidate behavior, not master baseline under §6 or §3 item 8.

## Smallest follow-up (not implemented here)

One bounded IB07 production task. §3 item 11 says: "Disable only unvalidated strategy/capability". So it should disable only the two inferences:

- Rule34: `originalUrl = originalLink?.href || ''`;
- e621/e926: `sampleUrl = d.sampleUrl || ''`.

Observed shapes are unaffected: every observed page had the link or the attribute. The slot then stays unknown for the unobserved shapes, which satisfies the invariant whatever the host semantics turn out to be. `G3-3c-rule34.xxx` and `G3-3d-e621/e926` could then be asserted as PASS on the invariant, while the host semantics remain explicitly **NOT OBSERVED LIVE**, a narrower, declared scope.

Consequences, confined to the unobserved shapes (verified by reading the consumers):

| Consumer | Change in the unobserved shape |
| --- | --- |
| Rule34 `downloadPost` (strict on `originalUrl`, line 2719) | Reports "could not find original media URL" instead of saving the displayed file. The native page stays untouched. |
| e621/e926 grid thumbnail upgrade (4253 → `applySiteThumbMedia` 4034) | Stays on the preview instead of loading the file as a "sample". |
| e621/e926 reverse search (4972) | Uses the preview instead of the file. |
| Viewer and open actions (3075/3076, 3316, 3350, 4121, 4888) | None: they fall back across slots to the same URL. |

This conflicts with the earlier option B deferral, which avoided the Rule34 download change. The evidence has now been gathered and the shape was not observed. The download consequence applies only to that unobserved shape, and the behavior removed is IB07's own unvalidated inference. The follow-up still needs explicit approval of that consequence.

## Still open regardless

§11 step 6 production conformance is not run for the Rule34, e621 and e926 integrations. IB07 stays PARTIAL—NOT COMPLETE.

## Disposition: bounded restriction applied

Approved and applied in production (blob `30cadd68ebc6ca357a029ebdf1cfb028f081ee7b`). Exactly two lines changed:

- Rule34 `rule34NativeImagePost`: `originalUrl = originalLink?.href || ''` (was `|| sampleUrl`);
- e621/e926 `normalizeE621NativeElement`: `sampleUrl = d.sampleUrl || ''` (was `|| fileUrl`).

Production now fails closed on the unobserved shapes: the slot stays unknown. The host shapes themselves stay **NOT OBSERVED LIVE**. This restriction does not turn them into evidence.

**Item 9:** `G3-3c-rule34.xxx` and `G3-3d-e621.net`/`G3-3d-e926.net` now assert production's fail-closed behavior (slot empty, the other slot unchanged). All three PASS, and a mutant that restores each inference FAILs. They previously asked a host-semantic question that no evidence decided. The same rows now carry `hostSemantic: NOT OBSERVED LIVE`, so the unanswered host fact stays visible. The suite reads 29/29 PASS with 29 correct controls.

**Downstream result**, measured in the harness against old and new production, with no downstream code edited:

| Consumer (unobserved shape only) | Old | New |
| --- | --- | --- |
| Metadata requests (startup, hover, on-demand, download) | 0 | 0 |
| Rule34 native page (`img#image`, links) | untouched | untouched |
| Rule34 `downloadPost` | saved the displayed image as "original" (1 transfer) | reports "could not find original media URL" (0 transfers) |
| e621/e926 grid thumbnail | preview | preview (the Post sample never reached the grid: `applySiteThumbMedia` returns without an owner at line 4254) |
| e621/e926 hover | full file via its own `sample || original` fallback from native `data-file-url` | same (downstream fallback, untouched) |
| e621/e926 reverse search on a post page (line 4972) | full file | preview |
| Viewer and open actions | slot fallback | same |

This corrects the earlier assessment's prediction of a grid change: there is none.

**Gelbooru production conformance: reused, on an explicit diff basis.** Both changed lines sit behind host gates that return first on gelbooru.com: `rule34NativeImagePost` at line 1931, and `normalizeE621NativeElement` at line 2325, which is called only from the e621 adapter. Harness check, old vs new production, on a Gelbooru post page with and without a native original link: identical Post and 0 requests in both cases. The live PASS attested the `9cade1a` body (C00); the Gelbooru-reachable code is unchanged in `30cadd6`. Release-artifact qualification remains a later-checkpoint concern.
