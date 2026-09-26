# IB00 — Baseline and Recovery

**Checkpoint:** IB00  
**Status:** PASS  
**Implementation branch:** `implementation/ib00-baseline`  
**Production baseline commit:** `6f06dfd19fe916be784fd6bafe6dce6ed76503fe`  
**Production userscript version:** `1.2.7.3`

IB00 establishes the immutable implementation baseline. It makes no production behavior changes.

## Baseline identity

The implementation branch was created directly from the pinned production commit:

`6f06dfd19fe916be784fd6bafe6dce6ed76503fe`

At that commit:

- `Booru_Enhancer.user.js` is version `1.2.7.3`.
- Git blob SHA for `Booru_Enhancer.user.js`: `945fb1442a4608359aeae4cb83f92a5ea93906a5`.
- SHA-256 recorded by the controlling evidence ledger: `9c432eee32b16f144f4553ae439b7097bf4b48cf6858d601f4d16b0d4e602af0`.

The repository's `main` branch is one commit ahead of the production baseline at the start of IB00:

`07a38dc26cd35bb67ce6b696dc5718768b43b430`

That later commit adds only:

- `docs/research/README.md`
- `docs/research/RESEARCH_SNAPSHOT.md`
- `docs/research/SOURCE_CORPUS.md`

The production userscript blob is identical at the pinned baseline and current `main`. Implementation nevertheless starts from the pinned production commit so later source changes remain attributable to the blueprint checkpoint sequence.

## Controlling handoff artifacts

These artifacts are inputs to the implementation workflow but are not copied into this public branch merely to create a second source of truth.

| Input | SHA-256 |
| --- | --- |
| `Architecture_Reconciliation_Report.md` | `4679545d9b5dcf6bbc1cb7152e4675f61575cdc87a98d9f0b21b1658904d1df5` |
| `Pre_Implementation_Validation_Gate_Plan.md` | `531c6d40f1d6669eb5f3bf15ba771cc7e982545f36c7e7e445f11fdb79852b24` |
| `EC0_EC1_Evidence_Ledger.md` | `740ac43c8d9455bf39ebb3f2fb4a42af2807186e8c8353e63265a806d903c425` |
| Original Claude harness ZIP | `56df21123dfd92bfabf80f0adab9855f92e5c7227b4f5b8172afa9f805aa9a45` |

The final implementation blueprint controls checkpoint execution. Open evidence gates remain open; this record does not convert them to passes.

## Preservation inventory

The pinned settings schema contains **30 settings**. Their effective values are preservation obligations unless a later checkpoint explicitly changes presentation or migration behavior.

| Key | Pinned default |
| --- | --- |
| `general.enabled` | `true` |
| `general.theme` | `dark` |
| `general.accentColor` | `#ff8ac6` |
| `general.toolbarPosition` | `bottom-right` |
| `media.hoverPreview` | `true` |
| `media.thumbQuality` | `sample` |
| `download.filenameTemplate` | `{character} - {artist} ({id})` |
| `download.maxCharacters` | `3` |
| `download.tagDelimiter` | `, ` |
| `download.retries` | `3` |
| `download.openMode` | `new-tab` |
| `viewer.enabled` | `true` |
| `viewer.autoplayVideo` | `true` |
| `viewer.loopVideo` | `true` |
| `viewer.muteVideo` | `true` |
| `viewer.rememberVolume` | `true` |
| `viewer.fitMode` | `fit-both` |
| `gallery.infiniteScroll` | `true` |
| `gallery.gridDensity` | `0` |
| `gallery.thumbnailSize` | `220` |
| `gallery.gridGap` | `8` |
| `gallery.compactMode` | `false` |
| `keys.download` | `d` |
| `keys.favorite` | `f` |
| `keys.openOriginal` | `o` |
| `keys.next` | `ArrowRight` |
| `keys.prev` | `ArrowLeft` |
| `keys.close` | `Escape` |
| `keys.playPause` | Space |
| `debug.verboseLogging` | `false` |

### Existing behavior/surfaces to preserve

Unless an assigned later checkpoint explicitly changes them:

- fullscreen viewer enablement and ordinary click-to-view behavior;
- fit-to-window, fit-width, fit-height and 1:1 modes;
- zoom, pan, rotate and flip behavior;
- autoplay, mute, loop and remembered-volume preferences;
- hover preview and muted hover-video feature where supported;
- grid thumbnail size, automatic/fixed columns, gap and square-tile/compact presentation;
- infinite-scroll preference, subject to later capability admission;
- thumbnail action bar;
- post-page action bar;
- floating toolbar and its saved position;
- Download, Open original, Fullscreen, Previous/Next and Settings actions where applicable;
- SauceNAO reverse search;
- filename template, character limit, delimiter and open-original mode;
- keybinds;
- theme and accent settings;
- settings import/export and valid stored choices.

### Explicit exceptions

The preservation obligation does **not** require later checkpoints to preserve behavior already identified as unsafe or nonfunctional:

- generic scraped favorite mutation is not a valid behavior contract;
- `download.retries` is a stored compatibility key, not proof of a functioning user-controlled retry policy;
- unvalidated generic-site support is not a support guarantee;
- open host/runtime evidence gates remain open.

## Initial implementation scope

Priority live-validation hosts remain:

1. Rule34.xxx
2. e621.net
3. e926.net
4. Gelbooru.com

Other dedicated upstream adapters remain candidates until their own scope is validated.

The following are not re-admitted during the current phase:

- rule34.us
- chan.sankakucomplex.com
- idol.sankakucomplex.com
- beta.sankakucomplex.com

Pixiv is a later dedicated light-adapter checkpoint, not part of the pinned master baseline.

Runtime target cells remain:

- Tampermonkey × Chromium
- Violentmonkey × Chromium
- Tampermonkey × Firefox
- Violentmonkey × Firefox

None is marked passed by IB00.

## Recovery procedure

### Source recovery

If an implementation checkpoint damages the working branch:

1. preserve the failed checkpoint diff/evidence for review;
2. do not rewrite the pinned baseline;
3. abandon or reset only the implementation branch;
4. recreate a clean implementation branch from `6f06dfd19fe916be784fd6bafe6dce6ed76503fe`;
5. reapply only checkpoints whose completion records remain valid for the reconstructed artifact.

The public `main` branch is not force-moved as part of recovery.

### Preference recovery

IB00 does not access or modify production userscript storage.

Before the first checkpoint that migrates settings, the implementation workflow must preserve a user-exported settings backup or an equivalently validated recovery representation. Migration experiments use isolated namespaces/fixtures, never production preferences. A failed migration must retain the prior effective configuration and must not overwrite production storage merely to continue testing.

### Evidence recovery

Historical Claude harness files and their original results remain immutable evidence. New assertion suites and checkpoint evidence must be stored separately and identify:

- target commit/artifact;
- test revision;
- environment where relevant;
- result;
- evidence class;
- known limitations.

## IB00 acceptance record

- Baseline production commit identified: **PASS**
- Production source blob identified: **PASS**
- Current main divergence inspected: **PASS — docs-only**
- Implementation branch created directly from production pin: **PASS**
- Thirty-setting preservation inventory recorded: **PASS**
- Existing surface/behavior preservation obligations recorded: **PASS**
- Recovery procedure recorded: **PASS**
- Preference-backup procedure recorded without touching production storage: **PASS**
- Initial host/runtime candidate scope recorded: **PASS**
- Production source changed during IB00: **NO**
- Open evidence gates promoted to PASS: **NO**

**IB00 complete. Next eligible checkpoint: IB01 — Qualify the permanent assertion harness.**
