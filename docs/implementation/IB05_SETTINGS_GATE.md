# IB05 — Settings Schema, Migration and Mount Barrier

**Checkpoint state:** E-stage PASS in TC; production integration implemented; production conformance OPEN  
**Production source changed during IB05:** YES — bounded IB05 integration only  
**Production source blob:** `4f9cb6c1722fc0136266f770c9cfe0cd1784eaf1`

## Controlling invariant

Preferences must resolve before preference-dependent effects mount. Migration must be idempotent, recoverable, preserve effective legacy choices, preserve unknown/inert values, and never infer installation age from an empty store.

The E-stage G-SETTINGS premise has passed in the active TC cell. Production integration is therefore permitted, but IB05 remains open until the integrated production artifact passes conformance.

## E-model result

Artifact:

- `tests/settings/ib05/ib05_settings_gate.cjs`
- `tests/settings/ib05/model-result.json`

Result:

- 23 tests;
- 23 passed;
- 0 failed;
- 30 settings covered;
- schema model version 1, distinct from product version 1.2.7.3.

The model demonstrated:

- M01 explicit nondefaults survive;
- M02 absent settings retain legacy effective defaults without being persisted;
- M03 known import choices survive and unknown imported values round-trip inertly;
- M04 invalid boolean/numeric/select values are isolated for recovery and resolve to legacy-safe defaults;
- M05/M06 byte-equivalent empty stores remain `AMBIGUOUS_EMPTY`;
- an upgrade-written schema marker is not freshness proof;
- schema 0 → 1 migration is idempotent and does not rewrite preferences;
- typed and JSON-string storage forms preserve effective choices;
- delayed initialization does not mount before migration resolution;
- denied migration blocks dependent mount;
- failed migration does not partially overwrite preferences;
- unknown raw keys survive migration/export;
- malformed imports are rejected before writes;
- newer-than-supported schema remains untouched and blocks mount;
- partial import writes roll back to the prior snapshot;
- recovery export preserves invalid raw data and absent-key state.

## Policy established by the isolated model

- `SETTINGS_SCHEMA_VERSION = 1` is independent of the product version.
- Missing settings keep the pinned 30-key legacy defaults.
- In particular, ambiguous empty storage resolves to `media.thumbQuality = sample` and `gallery.infiniteScroll = true`.
- No empty-store state is classified as fresh.
- Unknown keys remain inert and preserved.
- Invalid known values do not become arbitrary valid types; their effective value falls back to the documented legacy default while their raw value remains recoverable.
- Unsupported newer schema blocks migration/mount rather than being down-converted.
- The initial schema migration writes only the schema marker; it does not rewrite existing preferences.
- Import must validate completely before replacement and recover the prior snapshot on write failure.

## Real-manager E-stage result

The TC browser gate ran in Tampermonkey 5.5.0 × Chrome 153 × Windows 10 / Win32.

Result:

- 10 tests;
- 10 passed;
- 0 failed;
- isolated userscript storage only;
- no production preference access;
- no external network.

Sanitized evidence:

- `tests/browser/ib05/TC_SETTINGS_MOUNT_RESULT_SUMMARY.json`

This closes the IB05 E-stage G-SETTINGS premise for the active TC path.

## Production integration

Commit:

- `d69877431fe6839cb375e0aa9128ba47a7447912`

Production source blob:

- `4f9cb6c1722fc0136266f770c9cfe0cd1784eaf1`

Integrated scope is intentionally narrow:

- settings schema version 1, separate from product version 1.2.7.3;
- store raw-value/recovery visibility without changing the `be:` namespace;
- validated bool/number/range/select/text/color values;
- legacy-safe effective defaults for malformed known settings while preserving their raw values;
- schema 0 → 1 migration writes only the schema marker;
- ambiguous empty storage remains ambiguous and keeps legacy Sample + append-on defaults;
- unsupported newer schema blocks enhancer mount rather than down-converting;
- settings initialization is awaited before adapter/UI/gallery mount;
- export preserves absent known keys, invalid-known raw recovery values and inert unknown raw keys;
- import validates the full envelope before replacement, keeps legacy import compatibility, and attempts exact snapshot rollback on persistence failure.

No IB06 request-gate work, host policy, new default policy, route work, or release-version bump entered this change.

## Remaining checkpoint requirement

The E-stage browser gate is complete. The remaining requirement is conformance of the actual integrated production artifact:

- source/static conformance against blob `4f9cb6c1722fc0136266f770c9cfe0cd1784eaf1`;
- a local-only derived production browser run using a separate userscript identity;
- direct checks that the integrated store/settings/init path preserves legacy choices, does not persist absent defaults, validates imports, retains inert unknown values, and reaches preference-dependent UI only after settings are loaded.

**IB05 remains OPEN until production conformance passes.**
