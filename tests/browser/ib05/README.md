# IB05 real-manager settings/mount gate

This is the remaining IB05 E-stage V5-O evidence for the active TC cell.

It uses a distinct Tampermonkey script identity and therefore isolated GM storage. It does not read or write the production Booru Enhancer script's preferences.

## Run

1. In this folder run: `node server.cjs`
2. Install `IB05_Settings_Mount_Gate.user.js` in Tampermonkey.
3. Open/refresh `http://127.0.0.1:8776/`
4. Run Tampermonkey menu command: `IB05: Run settings/mount gate`
5. Copy the entire JSON result.
6. Return it for checkpoint review.

The probe performs no external network requests and cleans its isolated test storage before saving only the final result for export.
