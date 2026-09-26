# IB06 controlled request-gate browser evidence

This is the real-manager transport half of the IB06 E-stage G-REQUEST gate.

It uses only localhost:

- fixture / endpoint key A: http://127.0.0.1:8778
- endpoint key B: http://127.0.0.1:8779

The fixed values of two endpoint keys and at most two read attempts are test parameters only. They are not production host budgets.

Run:

1. `node server.cjs`
2. Install `IB06_Request_Gate.user.js` in Tampermonkey.
3. Open `http://127.0.0.1:8778/`
4. Run `IB06: Run request gate`
5. Copy the entire JSON result.

The probe performs no live-site requests and does not load or modify production Booru Enhancer preferences.
