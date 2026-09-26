# IB03 — Runtime Primitives and Minimal Compatibility Boundary

**Checkpoint:** IB03  
**Status:** PASS — scoped to measured TC primitives; other cells/capabilities remain open  
**Production source modified:** Yes, only the admitted runtime boundary and BE.net transport wiring

## Real runtime evidence

The exact common v2 probe was executed in the first development cell:

- **Cell:** TC — Tampermonkey × Chromium
- **Browser:** Chrome 153.0.0.0
- **Userscript manager:** Tampermonkey 5.5.0
- **Platform:** Windows 10 / Win32
- **Probe result attachment SHA-256:** `663cf8d09e9869de18146db7a5433f153bc0b06a97abef0d74158f8a556a3b2f`

The operator invoked the persistent menu command before the run. The probe recorded both legacy and modern storage/request/menu API forms.

### Storage

Both forms passed typed round trips and missing/delete behavior. Malformed serialized text remained text and the string `"false"` remained a string; the runtime boundary therefore does not silently coerce legacy values.

Observed call shape:

- legacy storage calls are synchronous-returning;
- modern storage calls return thenables.

The production compatibility layer presents an async-facing storage contract over either shape.

### Requests

Observed TC request facts:

- legacy `GM_xmlhttpRequest` returns a non-thenable object with `abort()`;
- modern `GM.xmlHttpRequest` returns a thenable object with `abort()`;
- modern mode can fire callbacks **and** resolve the returned Promise for the same terminal result;
- known-total and unknown-total progress were observed;
- partial-stream error produced the error callback path;
- timeout produced a timeout terminal event, but the requested duration was not millisecond-precise;
- redirects expose final URL/headers;
- HTTP 401/500 arrive through the load/status path, not transport-error classification;
- active abort produced manager `onabort` plus controlled-server `request-aborted` and `response-close` with an unfinished response;
- logical cancellation without transport abort allowed later progress/load to arrive.

Those observations directly determine the production wrapper: one terminal settlement, callback/Promise deduplication, immediate logical cancellation, optional progress, retained raw handle, and separate transport-abort reporting.

### Menu

Registration returned a numeric ID in the measured cell. The operator callback count was 1 before and after the probe run, confirming the persistent command was actually invoked. Temporary command removal executed through the legacy API.

## Production integration

Two bounded production commits implement the runtime boundary:

- `245c392e8d6bdf95e1806774dc1506aad884dc64` — add measured runtime compatibility boundary
- `3c36824e26d199f9be6b832c82e14d36aadbfd9b` — harden logical-cancellation ordering

Current userscript blob:

`aad0742b0e82c6f03f19f02c50f35cafa34545c4`

The integration adds:

- async-facing storage normalization;
- runtime capability inventory;
- privileged-request normalization;
- callback/Promise single-settlement protection;
- optional progress;
- retained raw request handle;
- separate logical cancel vs physical abort;
- menu registration normalization;
- native fetch passthrough;
- BE.net transport through the runtime request boundary while preserving existing retry policy for its later assigned checkpoint.

The existing download/style/notification paths remain intact. Downloads and route observation remain explicitly `unvalidated`.

## Actual wrapper conformance

The production runtime section was extracted from the current branch itself and exercised against deterministic mocks shaped by the real TC observations.

Results:

- **11 tests**
- **11 passed**
- **0 failed**

Qualified checks include whole-userscript syntax parsing, legacy storage/request/menu, modern mode detection, modern callback+Promise deduplication, modern error-callback precedence over later Promise resolution, and cancellation ordering even when a transport invokes `onabort` synchronously.

Permanent runner:

`tests/runtime/ib03/runtime_wrapper_contract.cjs`

## Scoped gate result

The following are admitted for implementation in **TC**:

- legacy storage: **PASS**
- legacy privileged requests: **PASS**
- legacy menu registration: **PASS**
- same-origin native fetch: **PASS**

Modern forms were measured by the probe and are covered by the wrapper, but production metadata still uses its existing legacy grants. Therefore modern production-grant-path support is not separately claimed by this checkpoint.

Still open:

- VC — Violentmonkey × Chromium
- TF — Tampermonkey × Firefox
- VF — Violentmonkey × Firefox
- route/world observation
- download runtime semantics
- exact release support matrix

## Scope audit

IB03 did **not** add or modify:

- site parsers;
- endpoint budgets or the future request gate;
- media scheduling;
- download implementation;
- history interception/page bridge;
- browser-specific editions;
- localStorage substitution;
- site-specific runtime branches.

The existing retry behavior in `BE.net` is preserved deliberately; its policy is assigned to IB06 rather than being silently redesigned here.

**IB03 complete. IB04 — Browser ownership and bounded production disposal — is now eligible in the measured TC development cell.**
