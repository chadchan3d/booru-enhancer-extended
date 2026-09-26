# IB06 — Small Enhancer HTTP Request Gate

**Checkpoint state:** E-stage in progress — finite model PASS; controlled real-manager transport OPEN  
**Production source changed during IB06:** NO  
**Production source blob:** `02105f262eb3c128642b5296f4fa4502bc8cfa7b`

## Controlling invariant

All enhancer HTTP must eventually enter one bounded logical-operation policy. Equivalent reads may share work; mutations do not join read dedupe. One finite attempt budget owns the whole logical read. Each consumer settles once. Releasing the last consumer cancels queued work and requests physical abort where available, but unresolved non-abortable or ignored-abort transport continues to occupy its endpoint slot until the wire actually terminates.

IB06 production integration remains blocked until E-stage G-REQUEST passes.

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
