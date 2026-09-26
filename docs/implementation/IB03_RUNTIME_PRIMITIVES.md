# IB03 — Runtime Primitives and Minimal Compatibility Boundary

**Checkpoint state:** BLOCKED — E-stage probe prepared, no real userscript-manager cell executed  
**Production source modified:** No  
**G-RUNTIME promoted:** None

## Work completed

A single common runtime probe revision was prepared for all four target cells:

- Tampermonkey × Chromium
- Violentmonkey × Chromium
- Tampermonkey × Firefox
- Violentmonkey × Firefox

The probe is local-only and manual-start. It does not run tests on page load and contains no Rule34/e621/Gelbooru/Pixiv logic, no route/history patch, no download implementation and no browser-specific edition.

Prepared artifact identity:

- `IB03_Common_Runtime_Probe.user.js`
- version `2.0.0`
- SHA-256 `cc66d516826f0c37816d825b0e5ea304b41d209e13ba0c46599591548040d698`

Controlled loopback transport:

- `server.cjs`
- SHA-256 `b347a875ff43dc35fcfffbf76b58e2912dbbd8c1ee6553532f4767dc9764a892`
- origins `127.0.0.1:8765` and `127.0.0.1:8766`

Local qualification:

- userscript syntax check: PASS
- server syntax check: PASS
- server self-test: PASS
- static scope/coupling test: PASS
- packet ZIP integrity test: PASS

The server self-test verifies controlled success/redirect/status/empty/known-length-stream behavior and records a distinguishable server-side response close for an aborted slow stream. This is Node evidence only; it does not certify GM abort behavior.

## V5-P coverage prepared

The common probe records:

- legacy underscore and modern `GM.*` API availability;
- exact manager/browser information exposed through GM info and navigator;
- typed storage round trips;
- absent/delete behavior;
- malformed legacy string and serialized-boolean-string behavior;
- sync/Promise return shapes;
- same-origin native fetch;
- privileged cross-origin request behavior;
- redirect/final URL and response headers;
- empty, malformed, auth-body, 401 and 500 responses;
- known/unknown progress;
- partial-stream error behavior;
- deliberate timeout behavior;
- request return/abort handle before terminal settlement;
- active abort event timeline plus controlled-server close events;
- logical cancellation without transport abort to expose late events;
- menu registration, real operator callback count and temporary menu removal.

The probe intentionally does not manufacture a storage permission denial. If a real manager produces denial/rejection, that result is recorded. Otherwise that condition remains unobserved rather than fabricated.

## Why IB03 is not PASS

The blueprint requires a **real browser/userscript-manager cell** before integrating a runtime primitive into production.

No such cell can be executed from the current implementation environment. Therefore:

- TC remains OPEN—NOT RUN.
- VC remains OPEN—NOT RUN.
- TF remains OPEN—NOT RUN.
- VF remains OPEN—NOT RUN.
- no `_GM` / `BE.gm` / `BE.store` / `BE.net` production wrapper changes are authorized yet;
- no runtime capability claim is made.

Code existence is not a gate pass.

## Exact unblock condition

Run the exact probe SHA in one disposable target cell against the controlled loopback server and preserve:

1. browser/version;
2. userscript manager/version;
3. grants/permission/injection metadata exposed by the manager;
4. the probe's complete result JSON;
5. server terminal output;
6. any browser-console errors.

The operator must invoke the persistent menu command at least once. The result must distinguish logical cancellation, manager abort callbacks and controlled-server early-close evidence.

After review, only the measured primitive/mode for that exact cell may close a scoped G-RUNTIME row. The production runtime boundary may then be integrated and checked against the same observations.

## Scope audit

No site parser, endpoint budget, retry gate, download subsystem, history bridge, browser-specific edition or localStorage substitution was introduced.

The production userscript remains unchanged at the pinned blob while this gate is open.

**Next action:** execute the prepared probe in one real target cell. IB04 remains blocked; IB05/IB06 production integration likewise cannot use unmeasured runtime primitives.
