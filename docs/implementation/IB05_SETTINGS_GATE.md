# IB05 — Settings Schema, Migration and Mount Barrier

**Checkpoint state:** E-stage in progress — isolated model PASS; real-manager V5-O browser evidence OPEN  
**Production source changed during IB05:** NO  
**Production source blob:** `4f43d0dc57cbbbe70726e36263fc6854d0bd0cad`

## Controlling invariant

Preferences must resolve before preference-dependent effects mount. Migration must be idempotent, recoverable, preserve effective legacy choices, preserve unknown/inert values, and never infer installation age from an empty store.

IB05 production integration remains blocked until the E-stage G-SETTINGS evidence passes.

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

## Remaining E-stage requirement

The blueprint also requires V5-O in a real userscript manager using isolated storage:

- actual GM get/set/list/delete round-trip;
- production-like JSON-string setting values and typed storage values;
- delayed migration with first-dependent-mount timestamp;
- rejected migration with zero dependent mount;
- empty-store ambiguity after a written schema marker;
- malformed/unknown preservation;
- unsupported newer-schema blocking;
- test storage isolated from production preferences.

Artifact:

- `tests/browser/ib05/IB05_Settings_Mount_Gate.user.js`

**G-SETTINGS remains OPEN until that browser result is reviewed.**

No changes to `BE.store`, `BE.settings`, init ordering, import/export, or public release metadata are permitted before that result passes.
