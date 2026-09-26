# IB04 — Browser Ownership and Bounded Production Disposal

**Checkpoint state:** PASS for active TC implementation path  
**Development cell:** Tampermonkey 5.5.0 × Chrome 153  
**Production source blob:** `4f43d0dc57cbbbe70726e36263fc6854d0bd0cad`

## E-stage browser result

The controlled browser ownership probe ran in the measured TC cell and passed **18/18 cases**.

The passing scope includes:

- static restoration and native node identity;
- five mount/dispose cycles;
- later native writes and same-value native writes;
- repeated native edits;
- moved responsive-source identity/location;
- native card replacement;
- late callback suppression;
- O13 focus return;
- later-focus preservation;
- declared fallback and reload recovery;
- real native navigation after synchronous viewer-open failure;
- usable native fallback after later media failure;
- modifier/middle/native-control click preservation;
- accessible hover replacement/restoration;
- append failure versus explicit full disposal;
- preservation of native listeners.

This closes the **E-stage G-OWN premise for those named effects in TC only**. It does not certify live sites, route worlds, VC/TF/VF, or production integration by itself.

## Production integration

After the E-stage pass, the production userscript was changed only within IB04's admitted scope.

The integrated production ownership model now:

- records bounded owned attribute/class/style mutations;
- drains pending attribute mutations before deciding restoration;
- preserves later native changes instead of forcing stale restoration;
- owns gallery delegated listeners and settings/resize cleanup;
- owns thumbnail action UI and card/image classes;
- keeps e621 `<picture>/<source>` nodes intact instead of deleting them;
- temporarily redirects responsive source/srcset values through owned mutations;
- suppresses native hover text only while enhanced hover is enabled;
- supplies an accessible replacement label where appropriate;
- restores hover labels when enhanced hover is disabled;
- owns viewer shell listeners and exposes viewer disposal;
- passes native focus origin/fallback into the viewer;
- returns focus on close only when focus is still inside the viewer;
- exposes an “Open native post” link on media failure;
- leaves modifier/middle/native-control clicks alone;
- calls the viewer synchronously before cancelling ordinary native navigation;
- exposes bounded gallery disposal.

The implementation does **not** introduce a generalized reactive owner, cloned native subtrees, a universal DOM snapshot, new adapters, media policy changes, route ownership, or a new request scheduler.

## Production static conformance

The integrated source was parsed and checked against the IB04 contract.

Static/source checks currently pass for:

- bounded ownership helper;
- viewer ownership/disposal;
- viewer native failure fallback;
- gallery owned listeners/disposal;
- absence of destructive `source.remove()`;
- owned responsive-source mutation;
- hover-setting gate;
- accessible hover replacement;
- nested native-control guard;
- viewer-open-before-`preventDefault()` ordering;
- native focus context;
- settings-listener cleanup.

Static conformance is not being substituted for the required browser run.

## Production browser conformance artifact

A local-only build was generated directly from production source blob:

`4f43d0dc57cbbbe70726e36263fc6854d0bd0cad`

Artifact:

`tests/browser/ib04/IB04_Production_Conformance.user.js`

Git blob:

`618cb0c89990d4e8fc82144d2e1847b6c13b2098`

Only its metadata differs from production to make it safe for the local fixture:

- all public `@match` entries are replaced with `http://127.0.0.1:8775/*`;
- public `@connect` entries are removed;
- update/download URLs are removed;
- a local conformance postamble is appended.

The production code body is otherwise the current IB04 candidate.

The current fixture revision is Git blob:

`ee7d4ac0ddecdcfd3e9b3712ec6c533d48e5e5b1`

The production-conformance postamble also normalizes the original E-stage fixture at runtime, so the operator may reuse the previously extracted local fixture/server.

The browser conformance run checks the actual integrated gallery/viewer call sites, including responsive node ownership, hover restore, synchronous takeover ordering, native controls, viewer focus return, media-failure fallback, full gallery disposal, repeated re-init/dispose and native-listener survival.

## Production browser conformance result

**PASS — 10/10 in TC**

Measured cell:

- Tampermonkey 5.5.0;
- Chrome 153;
- Windows 10 / Win32.

Sanitized result:

- `tests/browser/ib04/TC_PRODUCTION_RESULT_SUMMARY.json`

Passing production cases:

- P01 native node identity;
- P02 responsive source preservation;
- P03 hover suppression, accessible replacement and disable restoration;
- P04 native navigation after synchronous viewer-open failure;
- P05 modifier/native-control bypass;
- P06 viewer focus return;
- P07 native fallback after media failure;
- P08 full gallery disposal/restoration;
- P09 five bounded production re-init/dispose cycles;
- P10 native listener survival.

The first operator run reported 9/10 with P03 failing. Review showed that the conformance postamble had renamed the generic fixture adapter to `e621` while retaining generic wrapper resolution, causing the fixture wrapper to resolve to the native link itself. That made the P03 e621 lookup search inside the link for itself. This was a harness mismatch, not a production defect.

The harness was corrected in commit `c6c8280d5f40254805612d00025edd11bd72f2d0` to retain fixture-safe generic extraction while using the real e621 `getThumbWrapper` contract. Production source was not changed. The corrected conformance artifact is Git blob `618cb0c89990d4e8fc82144d2e1847b6c13b2098`.

## Gate state

- **G-OWN E-stage / named TC fixture effects:** PASS
- **G-OWN production TC / named integrated effects:** PASS
- VC / TF / VF: OPEN—NOT RUN
- live-site ownership: not claimed
- route/world observation: open
- download runtime semantics: open

**IB04 is complete for the active TC implementation path. IB05 is now eligible.**

This completion does not broaden the claim to untested runtime cells, live sites, route worlds, or future mutation classes.
