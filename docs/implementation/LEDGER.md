# Ledger

## Current milestone
**IB08 — Reversible native rendition integration: PARTIAL — NOT COMPLETE.** **G-RENDITION E stage: PASS(scope)** (`docs/implementation/IB08_V9R_EVIDENCE.md` §3). The P-stage design is recorded (§4) and **not implemented**. B2 is decided (`original` kept as a distinct rendition). B1 is OPEN: all four live runs of B1 probe 1.0.0 were blocked by a probe sanitation defect. Probe 1.1.0 repairs it; the four observations must be rerun.

IB07 is complete, PASS(scope) (`docs/implementation/IB07_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `32d0051fe73505984066a5b69766b5eafc242bb9` (commit `c551bb0`), unchanged by closeout.
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
- Production is still pre-P (`Booru_Enhancer.user.js:4033-4051`). `applySiteThumbMedia` overwrites every `source` srcset and the `img` srcset/src with one URL. P-stage conflicts C1–C5 are recorded in the evidence record §4.1.

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
  - B1 login-state probe 1.1.0 verifier 59/59, 12/12 fault controls, synthetic fixtures; includes a regression reproducing the 1.0.0 live block.
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
- **P stage not bounded yet:**
  - **B1 OPEN:** probe 1.0.0 returned `sanitationGuard: BLOCKED` in all four live runs. This is a probe defect, not marker evidence.
    - Cause: the guard also scanned the probe's own fixed `site` label, which an ordinary page value containing the site's short name matched as a substring.
    - Repaired in 1.1.0.
    - All four observations must be rerun: e621 logged out/in, e926 logged out/in.
    - The acceptance rule is unchanged (evidence record §4.2). If no marker qualifies on each host independently, the result is NO RELIABLE NATIVE MARKER and IB08 stops for a decision.
  - **B2 decided (option a):** `original` stays a distinct rendition using the card's native file URL, never mapped to `sample`. It needs its own live production-conformance row.
  - **B3:** a release note is needed for cases that become native with the setting retained.
- After implementation: the local L1–L9 and live per-host production conformance in evidence record §4.4, then the IB08 completion record.
- **Retained limitations (not blockers):**
  - Live request counting starts at the postamble. Synchronous pre-postamble startup requests are not counted live; the local item 9 T1/T2 suite is the startup evidence.
  - The earlier slot-provenance live runs stay POTENTIALLY CONTAMINATED / SUPERSEDED.
  - Tampermonkey and Chrome versions were not relayed.
- Deferred to later checkpoints: video/GIF, pagination, hover, viewer, favorites/actions, downloads, other hosts, Pixiv.
- Parked: raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
The operator reinstalls B1 probe 1.1.0, reruns the four observations (`tests/browser/ib08/README.md`, B1 section) and returns four sanitized JSON results. The results are then evaluated against the B1 acceptance rule. Only if a marker qualifies is the P-stage contract implemented in `applySiteThumbMedia`, followed by production conformance. Production stays unchanged until then. No IB08 completion record before conformance. Do not start IB09.
