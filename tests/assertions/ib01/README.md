# IB01 permanent assertion harness

This directory qualifies the **oracles** that later checkpoints use to turn the historical Claude audit observations into regression tests.

The original historical audit harness remains immutable outside this directory. Its ZIP identity is:

`56df21123dfd92bfabf80f0adab9855f92e5c7227b4f5b8172afa9f805aa9a45`

Do not edit the historical harness or its old results to make future code pass.

`npm test` is dependency-free. Each case supplies:

- a historical observation that the oracle **must reject**;
- a corrected control that the oracle **must accept**.

A green IB01 run therefore means the assertion is sensitive to its targeted defect. It **does not** mean the production userscript has been fixed. Later checkpoints must feed observations from the actual candidate artifact into these or equivalent qualified assertions.

The historical observations correspond to the supplied audit harness:

- T1: Gelbooru startup request amplification.
- T2: Rule34 pointer-sweep request amplification.
- T3: viewer takeover failure cancelling native navigation.
- T4: native tooltip removal when hover preview is disabled.
- T5: destructive e621 responsive-picture handling.
- T6: overlapping download fallback.
- T7: false favorite success on login/error HTML.
- T8: append failure repeatedly restarting.
- T9: hover-video source retention after leaving.
- T10: generic-host mutation risk.

The T10 idol case is a new negative fixture because the original historical script exercised rule34.us plus Sankaku chan/beta, not idol. It records the source-confirmed generic-mutation risk without relabeling it as historical harness execution.

This suite deliberately does not claim to prove live media transfer cancellation, BFCache, browser autoplay policy, userscript isolated-world behavior, manager download completion, or live-site selectors.
