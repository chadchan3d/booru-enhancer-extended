# IB02 local ownership probe

This directory is the **isolated V6-L ownership experiment** for checkpoint IB02. It does not modify or import the production userscript.

The prior EC0/EC1 evidence already established O01–O12 in jsdom and exposed the O13 focus defect. This revision addresses that missing contract in a deliberately small deterministic local DOM/focus model and extends the local acceptance cases required by the final implementation blueprint.

Run:

```text
npm test
```

The probe is dependency-free. The model exists only to make node identity, attributes, focus, event listeners, removal, native writes and disposal deterministic. It does **not** certify browser focus behavior, MutationObserver scheduling, navigation, media detachment, BFCache, autoplay or userscript-manager behavior. Those remain browser evidence for IB04 and later gates.

## Ownership policy exercised

The candidate owner:

- records only its own attribute edits, additions, listeners and cleanup callbacks;
- restores an attribute only when no later native write was observed;
- preserves later native writes, including a same-value native write;
- removes only owned additions;
- guards late callbacks after disposal;
- returns focus to a surviving native origin only when disposal removes the currently focused owned subtree;
- does not steal focus if the user/native page moved focus elsewhere;
- uses a declared surviving native fallback when the origin disappeared;
- reports `reloadRecommended: true` instead of fabricating restoration when neither focus target survives.

This is intentionally not a generalized reactive ownership framework.

## Test coverage

O01–O12 mirror the bounded ownership requirements already established in the prior EC1 evidence. O13 is the corrected focused-disposal case and includes a missing-focus-return mutant. O14–O20 cover the remaining local cases named by the blueprint: later focus movement, missing origin/fallback, missing all targets, native card replacement, moved source identity, repeated native edits, and disabled-hover/equivalent-accessibility treatment.

A passing local probe is a prerequisite for browser ownership validation. It does not close G-OWN.
