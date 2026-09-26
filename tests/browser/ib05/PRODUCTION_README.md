# IB05 production conformance

Derived from production source blob:

`02105f262eb3c128642b5296f4fa4502bc8cfa7b`

The production body is retained; only userscript metadata is made local/isolated and the conformance postamble is appended.

Run:

1. `node server.cjs`
2. Install `IB05_Production_Conformance.user.js` in Tampermonkey.
3. Open `http://127.0.0.1:8777/`
4. Run `IB05P: Run production conformance`.
5. The page reloads automatically twice while testing clean, explicit-preference and newer-schema startup states.
6. Copy the final JSON result.

No production Booru Enhancer preferences are accessed. No external network requests are made by the conformance harness.
