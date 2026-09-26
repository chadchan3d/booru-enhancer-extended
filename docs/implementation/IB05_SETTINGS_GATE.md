# IB05 — Settings Schema, Migration and Mount Barrier

**Checkpoint state:** PASS for active TC implementation path  
**Production source changed during IB05:** YES — bounded IB05 integration only  
**Production source blob:** `02105f262eb3c128642b5296f4fa4502bc8cfa7b`

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

- `02105f262eb3c128642b5296f4fa4502bc8cfa7b`

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

## Production conformance result

The integrated production body was tested in Tampermonkey 5.5.0 × Chrome 153 × Windows 10 / Win32 using a separate userscript identity and isolated GM storage.

Result:

- 12 tests;
- 12 passed;
- 0 failed;
- production source blob `02105f262eb3c128642b5296f4fa4502bc8cfa7b`;
- derived conformance blob `ededd3b910dec484f9be11627187cedebd8b574c`.

Sanitized evidence:

- `tests/browser/ib05/TC_PRODUCTION_RESULT_SUMMARY.json`

The production run directly demonstrated:

- product version and settings schema version remain distinct;
- empty storage writes only the schema marker;
- empty storage remains `AMBIGUOUS_EMPTY` and keeps Sample + append-on legacy defaults;
- preference-dependent UI mounts only after settings are resolved;
- invalid direct values do not persist;
- legacy imports preserve valid known values and retain inert unknown values;
- new export preserves absent keys and unknown raw values;
- malformed new-format import is rejected before writes;
- malformed stored known values remain recoverable while effective behavior uses the safe legacy default;
- export/import round-trips valid, invalid and unknown state;
- explicit legacy preferences govern the first actual production mount;
- unsupported newer schema remains untouched and prevents enhancer mount.

## Gate state

- **G-SETTINGS E-stage TC:** PASS
- **G-SETTINGS production TC:** PASS
- **G-RUNTIME TC storage primitive:** PASS from IB03
- **G-OWN TC mount lifecycle:** PASS from IB04
- VC / TF / VF: not claimed
- live-site settings behavior: not claimed

**IB05 is complete for the active TC implementation path. IB06 is now eligible.**

This checkpoint does not authorize or claim request scheduling, host transport behavior, live-site metadata, downloads, route observation or other later capabilities.
