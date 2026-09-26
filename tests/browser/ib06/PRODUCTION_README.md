# IB06 production conformance

Production source under test:

`74adf9e192d2c00c1d493588cc9202388326402d`

The derived userscript keeps the production body and replaces public metadata with a local-only test identity. The appended harness contacts only ports 8780/8781.

Run:

1. `node production-server.cjs`
2. Install `IB06_Production_Conformance.user.js` in Tampermonkey.
3. Open `http://127.0.0.1:8780/`
4. Run `IB06P: Run production conformance`.
5. Copy the entire final JSON result.

No production Booru Enhancer preferences are accessed. No live booru is contacted.
