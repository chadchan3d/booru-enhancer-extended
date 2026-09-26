# IB04 — Browser Ownership and Bounded Production Disposal

**Checkpoint state:** E-STAGE PREPARED — BLOCKED ON REAL TC BROWSER RUN  
**Production ownership integration:** Not started  
**G-OWN promoted:** None

## Purpose

IB04 first validates the minimal ownership/disposal contract in a real browser fixture, then—only if that named browser gate passes—integrates the same bounded ownership rules into existing production lifecycle boundaries.

The final implementation blueprint requires browser evidence before production ownership activation. Local IB02 evidence alone is insufficient.

## Prepared browser probe

One local-only Tampermonkey fixture has been prepared for the already measured TC development cell.

Artifact:

- `IB04_Browser_Ownership_Probe.user.js`
- version `1.0.0`
- SHA-256 `ff6921b9efc491ac4279a9fd35b378e64cf7db1ed70b23ab0b4e25a53c78e17c`

Fixture:

- `fixture.html`
- SHA-256 `b588ec5265cc7a5a4ab2120ba22081964ad381ea58a0fcc21ad423d0b68a3b24`

Server:

- `server.cjs`
- SHA-256 `ce5abe85c31c9f508e5758fcd017dbfb76c222b1e94890c35b933370d493d406`
- loopback only: `127.0.0.1:8775`

Review packet:

- `IB04_Browser_Ownership_Packet.zip`
- SHA-256 `5bce5ebb5386936e7b220a5bfc22686736e3b3505918bc43a636163d42a85db0`
- ZIP integrity: PASS

The public repository contains the probe source, fixture, server, hashes and static qualification. The ZIP itself is a review convenience and is not required as a committed binary.

## Static qualification

The probe and fixture were syntax/static checked before browser execution.

Checks passed:

- local-only match;
- no `@connect`;
- no Rule34/e621/e926/Gelbooru/Pixiv/Sankaku logic;
- no external runtime request API;
- explicit run/export commands;
- O13 focus case present;
- real same-document native-navigation case present;
- same-value native mutation case present;
- native card replacement case present;
- moved responsive-source case present.

## Browser cases

The browser run contains 18 named cases:

1. static restoration and native node identity;
2. five mount/dispose cycles and listener cleanup;
3. later native title change survives;
4. same-value native write invalidates stale restoration;
5. repeated native edits preserve latest;
6. moved responsive source preserves identity/location;
7. native card replacement survives stale-owner disposal;
8. late callback cannot resurrect disposed source;
9. O13 focus returns to surviving native origin;
10. later user/native focus is not stolen;
11. missing origin uses declared surviving fallback;
12. missing origin+fallback declares reload recovery;
13. synchronous viewer-shell failure preserves actual native hash navigation;
14. later viewer-media failure exposes a usable native fallback;
15. modifier/middle/native nested controls avoid takeover;
16. disabled hover retains native title; accessible replacement restores cleanly;
17. append failure retains readable content while explicit disposal removes only owned addition;
18. native page listener remains after enhancer disposal.

The owner drains pending MutationObserver records before disposal so an immediate same-value native write is not discarded as stale enhancer state.

## Evidence boundary

A PASS here would be real-browser evidence for the named fixture effects in **TC** only.

It would not certify:

- live-site selectors or framework lifecycle;
- route-world observation;
- network/media cancellation;
- every future DOM mutation;
- VC/TF/VF;
- production ownership call sites.

Those remain separate evidence/conformance work.

## Production gate

Production IB04 integration remains forbidden until the exact browser probe is run in the measured TC cell and its JSON result is reviewed.

If any named browser case fails, the affected mutation is reduced/withheld rather than masked by a larger ownership framework.

**Next required action:** run the browser probe in Tampermonkey × Chrome using the supplied loopback fixture and return the complete JSON result.
