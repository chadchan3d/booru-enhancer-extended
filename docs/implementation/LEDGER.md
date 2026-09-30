# Ledger

## Current milestone
**IB08 — Reversible native rendition integration: PARTIAL — NOT COMPLETE.** **G-RENDITION E stage: PASS(scope)** (`docs/implementation/IB08_V9R_EVIDENCE.md` §3). B1 is resolved (`body[data-user-is-anonymous]`), and B2 is decided. The P stage is implemented (commit `b2b1d9f`). **The first live production-conformance run is FAIL/PARTIAL** (evidence record §6). Dispose is not terminal in production (diagnosis A), and the correction is proposed, not implemented. IB08 is not closed.

IB07 is complete, PASS(scope) (`docs/implementation/IB07_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `a0f3041c409a656f67fe23dc827b020b5cc399e6` (commit `b2b1d9f`, IB08 P stage). IB07 closed on blob `32d0051` (commit `c551bb0`).
- IB07 PASS(scope):
  - Rule34: native listing identity (no listing Post) and logged-out image post;
  - e621 and e926 (independently): native listing Posts and logged-out image post;
  - Gelbooru: logged-out native image post; listing gallery inactive where no candidate container matches.
  - All native-only; the unusual slot shapes fail closed and stay NOT OBSERVED LIVE.
- Post contract:
  - `siteId` is the canonical site identity for qualified hosts;
  - `pageCount` is `null` (unknown) or a positive integer, set to 1 only by the qualified single-item producers.
- Rebuilt conformance packages and exact-artifact results are committed.
- IB08 artifacts (`tests/browser/ib08/`, operator steps in its `README.md`):
  - baseline probe `IB08_V9R_Baseline_Probe.user.js`, read-only;
  - B1 login-state probe `IB08_B1_Login_State_Probe.user.js` 1.1.0, read-only; reports login-relevant names with value classes, and counts for everything else;
  - ownership experiment `IB08_V9R_Ownership_Experiment.user.js`, isolated E stage. It makes one owned WebP-source srcset change per card on five pattern cards; simulates native edit, moved source, replaced source and replaced picture; disposes; then checks after a resize.
- **G-RENDITION transition (E stage): OPEN → PASS(scope).** Scope:
  - e621.net and e926.net, each independently;
  - logged-out native listing;
  - the observed two-source WebP/JPEG pattern (single-candidate srcsets, no `sizes`/`media`, `img` src only);
  - one owned WebP-source srcset set to the native sample;
  - Tampermonkey × Chrome at the operator's DPR (versions and DPR not relayed);
  - non-pattern cards stay native.

  Not covered: other routes, logged-in state, other media, DPRs, runtimes, hosts or patterns, and the `original` rendition. Danbooru row: EXCLUDED(scope). This is not production conformance and not an IB08 PASS.
- **IB08 P-stage contract in production** (evidence record §5):
  - **Admission:** e621.net/e926.net `/posts` with `body[data-user-is-anonymous="true"]` and the proven two-source WebP/JPEG card pattern.
  - **Writes:** a single owned write to the WebP source srcset. `sample` uses the card's native sample URL; `original` uses its native file URL; `preview` stays native.
  - **Everything else stays native:** logged-in pages, other routes, non-pattern cards, video/GIF. `media.thumbQuality` stays stored.
  - **Undo:** IB04 dispose.
  - The B3 release note is in `CHANGELOG.md`.
- Production-conformance package: `tests/browser/ib08/IB08_Rendition_Production_Conformance.user.js`. It is at revision 2 (write attribution by region and signature, alias-aware P09, D01 at dispose time, new D10), still built from `b2b1d9f`.

## Verified
- IB08 live baseline, operator-relayed, e621 and e926 independently:
  - all 6 sampled cards kept card/img/picture/source identity across the wide→narrow resize;
  - each picture had 2 single-candidate WebP/JPEG sources, with no `sizes` or `media`;
  - `currentSrc` stayed `NATIVE_PREVIEW_WEBP`.
- IB08 live ownership experiment, operator-relayed, e621 and e926 independently: `ALL_EXPECTATIONS_MET`. Observed:
  - control restoration;
  - native-edit preservation;
  - moved-source preservation;
  - replaced-source and replaced-picture protection;
  - post-resize behavior.
- IB08 local:
  - baseline probe verifier 56/56, 6/6 fault controls;
  - ownership experiment verifier 65/65, 14/14 fault controls, `currentSrc` modelled in jsdom;
  - B1 login-state probe 1.1.0 verifier 59/59, 12/12 fault controls, synthetic fixtures; includes a regression reproducing the 1.0.0 live block;
  - P-stage production assertions L1–L9 66/66, 19/19 production fault controls (`tests/host/ib08/rendition-result.json`);
  - production-conformance package revision 2 verifier 75/75, including regressions A/B/C and the known production failure on `a0f3041`;
  - dispose-lifecycle diagnosis `tests/host/ib08/dispose_lifecycle_regression.cjs` 14/14: the known failure is reproduced, the cause isolated, and the proposed fix proven on both hosts.
- IB08 B1 live, operator-relayed, e621 and e926 independently: `body[data-user-is-anonymous]` is `true` when logged out and `false` when logged in.
  - `data-user-level` corroborates.
  - `data-user-is-member` is rejected, because it differs between hosts when logged in.
- Live exact-artifact conformance on `c551bb0`: 7/7 PASS, 0 failed checks, C00 matched on each.
  - Rule34 listing 42 cards and image post;
  - e621 listing 72/72 and image post;
  - e926 listing 74/74 and image post;
  - Gelbooru image post 16/16.
- Local:
  - item 9 31/31; `pageCount` 11/11; excluded hosts and preferences 8/8;
  - Gelbooru native-post 14/14; conformance verifiers 60/60 and 29/29; slot-probe verifier 53/53;
  - IB01 14/14; IB02 21/21; IB03 11/11; IB05 23/23; IB06 21/21.
- No endpoint strategy is reachable: the Gelbooru-family DAPI/HTML helpers and the legacy `normalizeE621` are uncalled, and the native producers contain no network call.

## Unresolved
- **First live production-conformance run (production `a0f3041`, package revision 1): FAIL/PARTIAL.**
  - PASS: e621 S/P/O/L and e926 S/P. e621 O had `settled:false`; P09 passed, so no repeat is required.
  - FAIL:
    - e621 D and e926 D: diagnosis A.
    - e926 O: P09 only. Diagnosis B: a file/sample alias; a package defect, production correct.
    - e926 L: P06 only. Diagnosis C: 4 off-card writes, not the rendition path, source undetermined; a package defect, since there was no provenance.
- **Diagnosis A:** a production lifecycle defect, pre-existing since the import.
  - `gallery.dispose()` removes the owned `data-be-gallery-init` marker.
  - The unowned app-level `bodyObserver` (`Booru_Enhancer.user.js:5427-5441`) then re-inits the gallery within 400 ms and re-owns every card still matching the pattern.
  - The live residue of 67/71 equals owned − 2.
  - Proposed correction, **not implemented**: the gallery records the containers it disposed; `bodyObserver` skips them; explicit init and genuinely new containers are unaffected.
- **Rerun after the correction:** all ten rows on the new artifact, or at least e621 D, e926 D, e926 O and e926 L if carry-forward is accepted.
- IB08 completion record only after that conformance is reviewed.
- IB07 host suites pin the IB07 blob, so they now exit 1 on the pin alone. All their assertions and controls pass (L9). The historical results are not edited.
- **Retained limitations (not blockers):**
  - Live request counting starts at the postamble. Synchronous pre-postamble startup requests are not counted live; the local item 9 T1/T2 suite is the startup evidence.
  - The earlier slot-provenance live runs stay POTENTIALLY CONTAMINATED / SUPERSEDED.
  - Tampermonkey and Chrome versions were not relayed.
- Deferred to later checkpoints: video/GIF, pagination, hover, viewer, favorites/actions, downloads, other hosts, Pixiv.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
Await approval of the diagnosis-A production correction. Then implement it, run the local regression and a package rebuild, and do the live rerun. No IB08 completion record before passing conformance. Do not start IB09.
