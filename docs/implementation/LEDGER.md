# Ledger

## Current milestone
**IB09 — Still-image hover dwell and cost: PARTIAL — NOT COMPLETE. G-HOVER OPEN.**

The E-stage baseline characterization of current production hover is done, locally only (`docs/implementation/IB09_HOVER_BASELINE.md`). No dwell is chosen, and production is unchanged.

IB08 is COMPLETE, PASS(scope) (`docs/implementation/IB08_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `bbaf9ac63f5c0292018b974f00c7b30d8b478bb5` (commit `91fa86d`), unchanged by closeout.
- **IB07 PASS(scope)** (native Post facts):
  - Rule34 listing identity and logged-out image post;
  - e621 and e926 listing and image post, each independently;
  - Gelbooru logged-out image post.
- **IB08 PASS(scope)**, G-RENDITION PASS(scope). Scope: e621.net and e926.net independently, logged-out (`body[data-user-is-anonymous="true"]`) native `/posts`, the two-source WebP/JPEG card pattern.
  - **Writes:** a single owned write to the WebP source srcset. `sample` uses the native sample URL; `original` uses the native file URL; `preview` stays native.
  - **Everything else stays native;** `media.thumbQuality` stays stored.
  - **Dispose:** restores owned values, keeps native changes, is terminal for the disposed container, and leaves no enhancer presentation. Card CSS is scoped with `:where(.be-gallery-grid)`.
  - **Release note:** `CHANGELOG.md`, "Unreleased — e621/e926 grid thumbnail quality".

## Verified
- **IB09 hover baseline** (`tests/host/ib09/hover_baseline.cjs`): 32/32 on production `bbaf9ac`, with a reusable fake-clock harness (`hover_harness.cjs`). It covers e621 and e926 × preview/sample/original × S1–S8; the results are identical on both hosts.
  - Zero network requests.
  - Metadata is a cache hit at pointer-enter.
  - The overlay shows the card's current rendition at t=0.
  - `preview` and `original` assign a SAMPLE upgrade at t=0, including in a 40 ms sweep.
  - Stale generations cannot apply (three guards).
  - 7 fault and negative controls are caught.
- **IB08 final live D rows on `bbaf9ac`,** operator-relayed, PASS on e621 and e926:
  - D01 67/67 and 70/70;
  - D10 (no re-init, owners, action bars or writes after dispose);
  - D11 (no enhancer presentation);
  - residue 0.
- **IB08 S/P/O/L:** carried forward from the second live run on `4ac1e36`. The only change since then is the CSS scoping, and the rows were requalified locally.
- **IB08 local on `bbaf9ac`:**
  - L1–L9 66/66 (19/19 fault controls);
  - lifecycle 24/24 (8/8);
  - D10 indicators 12/12;
  - presentation 14/14;
  - package verifier 90/90 (23 fault controls).
- IB08 E stage: V9-R baseline and ownership experiment, live on both hosts; B1 marker live on both hosts.
- IB07 live exact-artifact conformance on `c551bb0`: 7/7 PASS.
- IB01–IB06 suites exit 0 on `bbaf9ac`.

## Unresolved
- **IB09 invariant conflicts in current production** (baseline §Invariant comparison):
  - V1: `preview` starts a SAMPLE fetch at pointer-enter;
  - V2: `original` starts a SAMPLE "upgrade" over a displayed FILE (slot-name choice, `Booru_Enhancer.user.js:3065`);
  - V5: a 40 ms sweep incurs V1/V2;
  - V3 (decision needed): the overlay shows the current rendition at t=0.
  - Real browser cost (bytes, cache, abort effect) is unmeasured, pending the V2 pilot.
- **IB08 retained limitations (non-blocking; completion record):**
  - stale owned class tokens stay on site-touched cards after dispose (IB04 rule), with no presentation effect;
  - a site-rewritten container class would keep `be-gallery-grid` (not observed live; D11 detects it);
  - S/P/O/L are carried forward from `4ac1e36`;
  - runtime versions and DPR were not relayed;
  - the first run's four e926 logged-in off-card writes stayed unattributed (not the rendition path).
- **IB07 host suites** pin the IB07 blob, so they exit 1 on the pin alone. All their assertions and controls pass; the historical results are not edited.
- **Retained:** live request counting starts at the postamble; the local item 9 T1/T2 suite is the startup evidence. The earlier slot-provenance live runs stay POTENTIALLY CONTAMINATED / SUPERSEDED.
- **Deferred to later checkpoints:** hover (IB09), video/GIF (IB10), viewer (IB11), pagination (IB12), downloads (IB13), favorites/actions (IB14), other hosts, Pixiv (IB17).
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
Await the next bounded IB09 assignment (recommended: the V2 pilot preparation). No dwell choice and no production change before G-HOVER E evidence.
