# Ledger

## Current milestone
**IB09 — Still-image hover dwell and cost: COMPLETE, PASS(scope)** (`docs/implementation/IB09_COMPLETION_RECORD.md`). G-HOVER(e621/e926 qualified still-image class) PASS(scope), from the E stage and from production conformance.

- **Scope:**
  - e621.net and e926.net independently;
  - logged-out native `/posts`;
  - the IB08-qualified still-image card (rendition fact `NATIVE_PREVIEW`/`OWNED_SAMPLE`/`OWNED_ORIGINAL`).
- **Policy:**
  - 200 ms dwell;
  - no hover metadata request or media assignment before dwell, including the overlay (option B);
  - displayed PREVIEW → native SAMPLE or SAMPLE|FILE alias only;
  - displayed SAMPLE/FILE → no upgrade and never a downgrade.
- **Excluded (previous path or thumbnail/View):** out-of-pattern stills, unsupported and cost-inconclusive classes (including Original targets; not a ban), animated, video (IB10), logged-in pages, other routes and hosts.

IB08 is COMPLETE, PASS(scope) (`docs/implementation/IB08_COMPLETION_RECORD.md`).

## Current state
- Branch `implementation/ib00-baseline`. Production `Booru_Enhancer.user.js` blob `22e843cbe27662fc27d17149534b055d7a249dae`, commit `b9d133c` (the IB09 artifact; production body SHA-256 `6df35f16…f992`).
- **IB07 PASS(scope)** (native Post facts):
  - Rule34 listing identity and logged-out image post;
  - e621 and e926 listing and image post, each independently;
  - Gelbooru logged-out image post.
- **IB08 PASS(scope)**, G-RENDITION PASS(scope): a single owned WebP srcset write on the logged-out e621/e926 `/posts` two-source card; dispose is terminal and restores owned values.
- **IB09 PASS(scope)**, G-HOVER PASS(scope), as in the Current milestone. Release notes: `CHANGELOG.md` ("grid thumbnail quality", "hover preview timing").

## Verified
- **IB09 live production conformance on `b9d133c`** (package `IB09_Production_Conformance.user.js`, identity matched): e621 P1/P2 and e926 P1/P2 all PASS (operator-relayed).
  - e926 P2 (Original): qualified 77 generations (37 quick passes, 40 dwells); 0 new media, overlay, hover fetch or quick-pass work before dwell; overlay at 200/200/220 ms; no upgrade, downgrade or stale install; 3 out-of-scope generations (2 VIDEO, 1 ANIMATED) kept their prior behavior.
- **IB09 local on `22e843c`:**
  - P-stage assertions 111/111 (11/11 fault controls);
  - conformance verifier 30/30 (5/5);
  - E-stage suites, pinned to `bbaf9ac`: 32/32, 84/84, 54/54; live package 57/57.
- **IB09 E stage:** seven held-out live sessions (e621 A/B/C/D, e926 A/C/D), the V2 pilot and the V3 reopening (`IB09_E_CLOSEOUT.md`, `IB09_V3_REOPEN.md`).
- **IB08 on `22e843c`:** 66/66, 24/24, 12/12, 14/14, 90/90. The IB08 live evidence is in its completion record.
- IB07 live exact-artifact conformance on `c551bb0`: 7/7 PASS.
- IB01, IB02, IB03, IB05 and IB06 exit 0 on `22e843c`. IB07 exclusion and Gelbooru exit 0; `item9` and `pagecount` exit 1 on the IB07 blob pin only.

## Unresolved
- **IB09 retained limitations (non-blocking; completion record):**
  - per-field figures for e621 P1/P2 and e926 P1 conformance are not reproduced (verdicts only);
  - throttled usefulness is observed on e621 only;
  - transfer sizes are mostly browser-hidden;
  - out-of-scope cards (out-of-pattern stills, video, GIF, logged-in pages, other hosts) keep their previous immediate hover work by design;
  - no Original-target, animated or unknown class is qualified (thumbnail/View; not a ban).
- **IB08 retained limitations (non-blocking; completion record):**
  - stale owned class tokens stay on site-touched cards after dispose (IB04 rule), with no presentation effect;
  - a site-rewritten container class would keep `be-gallery-grid` (not observed live; D11 detects it);
  - S/P/O/L are carried forward from `4ac1e36`;
  - runtime versions and DPR were not relayed;
  - the first run's four e926 logged-in off-card writes stayed unattributed (not the rendition path).
- **IB07 host suites** pin the IB07 blob, so they exit 1 on the pin alone. All their assertions and controls pass; the historical results are not edited.
- **Retained:** live request counting starts at the postamble; the local item 9 T1/T2 suite is the startup evidence. The earlier slot-provenance live runs stay POTENTIALLY CONTAMINATED / SUPERSEDED.
- **Deferred to later checkpoints:** video/GIF (IB10), viewer (IB11), pagination (IB12), downloads (IB13), favorites/actions (IB14), other hosts, Pixiv (IB17).
- **Deferred UI note (IB15, operator):** increase the settings-window text/font size for readability.
- **Parked:** raw IDs in other hosts' manifest rows; the IB04 checksum/line-ending issue; stale IB08 audit wording.

## Next
**IB10 — Muted hover-video lifecycle** is the next eligible checkpoint. It is not started. Its first step is IB10's own E stage; G-VIDEO is OPEN.
