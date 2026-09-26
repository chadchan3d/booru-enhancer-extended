# IB06 — Small Enhancer HTTP Request Gate

**Checkpoint state:** PASS for active TC implementation path  
**Production source changed during IB06:** YES — bounded IB06 integration only  
**Production source blob:** `74adf9e192d2c00c1d493588cc9202388326402d`

## Controlling invariant

All enhancer HTTP must eventually enter one bounded logical-operation policy. Equivalent reads may share work; mutations do not join read dedupe. One finite attempt budget owns the whole logical read. Each consumer settles once. Releasing the last consumer cancels queued work and requests physical abort where available, but unresolved non-abortable or ignored-abort transport continues to occupy its endpoint slot until the wire actually terminates.

The E-stage G-REQUEST premise has passed in the active TC cell. Production integration is therefore permitted, but IB06 remains open until the integrated production artifact passes real-browser conformance.

## E-model result

Artifacts:

- `tests/request/ib06/ib06_request_gate.cjs`
- `tests/request/ib06/model-result.json`

Result:

- 21 tests;
- 21 passed;
- 0 failed.

The finite model is deliberately restricted to:

- two lanes: foreground/background;
- two endpoint keys: A/B;
- at most two read attempts per logical operation;
- at most two consumers in the required release-order cases.

These are experiment parameters only and are not production host budgets.

The model demonstrated:

- equivalent reads dedupe to one transport;
- read identity includes site, account, operation and parameters;
- mutations do not join read dedupe;
- active work is not preempted;
- queued foreground work precedes queued background work;
- a viewer joining queued hover work promotes that shared read;
- queued release A→B and B→A both cancel before transport start;
- one running consumer may leave without abort while another remains;
- last running release requests abort;
- ignored and unavailable abort do not free endpoint occupancy before actual wire termination;
- transient reads share one finite two-attempt budget;
- 401/403/404, HTTP-200 auth bodies and structural bodies are terminal and not automatically retried;
- 429 creates endpoint-local cooldown rather than immediate retry;
- key B remains usable while key A cools down;
- cooldown expiry admits queued work;
- new consumers may join an existing cooldown-queued read;
- late transport completion after logical cancellation is suppressed;
- timeout/success races settle each consumer once;
- terminal work does not restart from repeated pump/sentinel activity.

Typed terminal outcomes in the model are:

- success;
- auth-required;
- not-found;
- rate-limited;
- transient;
- structural;
- cancelled.

## Remaining E-stage requirement

A controlled two-origin localhost probe must validate the relevant mechanics in a real manager:

- actual request dedupe by server count;
- A/B consumer release with server-observed abort behavior;
- finite actual retry count;
- 401/404/auth-body/malformed-body terminal classification;
- Retry-After cooldown isolation by endpoint key;
- foreground promotion while active work remains unpreempted;
- independent active transport on keys A and B.

Artifacts:

- `tests/browser/ib06/IB06_Request_Gate.user.js`
- `tests/browser/ib06/server.cjs`

Initial browser run:

- 11 tests;
- 9 passed;
- 2 failed;
- both failures traced to probe timing, not production or model logic.

B03 released after a fixed delay without first proving the server had accepted the delayed request. The corrected probe waits for server acceptance before releasing the last consumer and then waits for server-observed close evidence.

B09 used a one-second Retry-After window. Key-B completion pumps the queue; if that short window elapsed first, key A was correctly eligible to start. The corrected fixture uses a longer declared Retry-After window and asserts while safely inside it before later verifying expiry admission.

Corrected artifacts:

- userscript blob `245bbb4d07dadcee7520f52d8741c82618979113`;
- server blob `4f3175ea7203329a74497859a5201654e898d4c7`;
- harness commits `aba1af137814e2a1e6008fb7aaaacfd39baeed9b` and `0d18f6817ab774ce02f62d84a34de9904b4db9de`.

Production source remains unchanged.

**G-REQUEST remains OPEN pending the corrected browser rerun.**

No production `BE.net`, adapter call site, host retry policy or endpoint budget may change before that pass.


## Corrected controlled-transport result

The corrected TC browser probe ran in Tampermonkey 5.5.0 × Chrome 153 × Windows 10 / Win32.

Result:

- 11 tests;
- 11 passed;
- 0 failed;
- real manager privileged transport;
- localhost only;
- server-observed physical abort;
- no production preferences;
- no live-site requests.

Sanitized evidence:

- `tests/browser/ib06/TC_REQUEST_GATE_RESULT_SUMMARY.json`

This closes the IB06 E-stage G-REQUEST premise for the active TC path.

## Production integration

Commits:

- `eb96a1b9f3c1b23df7dba1ee6cc445fbcde099b5` — integrate bounded request gate;
- `1f16ec8646bf539f3cc44937007e4f6f02fff0cd` — remove stale pagination retry bookkeeping.

Production source blob:

- `74adf9e192d2c00c1d493588cc9202388326402d`

Integrated scope:

- all existing `BE.net` HTTP enters one logical-operation gate;
- equivalent reads may join a shared in-flight operation;
- mutations never join read dedupe and are limited to one attempt;
- consumer release is logical cancellation; last release requests physical abort where available;
- an unresolved abandoned transport remains endpoint-active until its transport promise terminates;
- transient reads have one finite attempt budget;
- 401/403 → auth-required, 404 → not-found, 429 → rate-limited, 5xx/transport faults → transient, validation failures → structural;
- Retry-After may create a temporary endpoint-local cooldown;
- endpoint concurrency and spacing are policy inputs, but no real-host numeric budgets are assigned here; defaults are unthrottled;
- Gelbooru's existing native-fetch → privileged fallback is now one two-attempt transport plan rather than nested retry allowances;
- the favorite remote action is explicitly a mutation, so it cannot dedupe or automatically retry;
- infinite-scroll terminal failure restores native pagination and no longer starts a fresh delayed request with a replenished budget.

No IB07 resolver/host policy, route strategy, new host activation, content normalization or release-version bump entered this change.

Production-code evidence before browser conformance:

- static checks: 15/15 PASS;
- integrated `BE.net` deterministic mock conformance: 11/11 PASS.

Artifacts:

- `tests/request/ib06/production_static_result.json`
- `tests/request/ib06/production_gate_mock_result.json`

## Production conformance result

The integrated production body passed real-browser conformance in Tampermonkey 5.5.0 × Chrome 153 × Windows 10 / Win32.

Result:

- 12 tests;
- 12 passed;
- 0 failed;
- production source blob `74adf9e192d2c00c1d493588cc9202388326402d`;
- derived conformance blob `410730444919fc3fc823210685030a999372a3c8`.

Sanitized evidence:

- `tests/browser/ib06/TC_PRODUCTION_RESULT_SUMMARY.json`

The production run directly demonstrated:

- equivalent reads share one actual manager transport;
- releasing one consumer does not abort while another remains;
- releasing the final consumer can produce a server-observed physical abort;
- transient reads respect one finite two-attempt budget;
- a transient read may recover on its second and final attempt;
- 401 and 404 are typed terminal outcomes and are not retried;
- HTTP-200 auth bodies are typed auth-required without retry;
- malformed expected JSON is structural and does not replenish attempts;
- Retry-After cooldown is isolated to its endpoint key;
- a foreground join promotes queued shared work without preempting active work;
- mutations neither dedupe nor retry automatically;
- native-fetch → privileged fallback consumes one shared finite attempt budget.

## Gate state

- **G-REQUEST E-stage TC:** PASS
- **G-REQUEST production TC:** PASS
- **G-RUNTIME TC request primitive:** PASS from IB03
- **G-OWN TC lifecycle:** PASS from IB04
- **G-SETTINGS TC:** PASS from IB05
- VC / TF / VF: not claimed
- live-site HTTP behavior: not claimed
- real-host concurrency/spacing budgets: not claimed

**IB06 is complete for the active TC implementation path. IB07 is now eligible.**

This checkpoint does not authorize or claim host-specific resolver policy, new site activation, route/world observation, download semantics or later capabilities.
