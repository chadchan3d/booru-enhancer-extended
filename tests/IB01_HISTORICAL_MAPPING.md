# IB01 Historical-to-Permanent Test Mapping

Checkpoint IB01 preserves the supplied Claude audit harness as immutable historical evidence and adds a separate assertion suite under `tests/permanent/`.

Original archive SHA-256:

`56df21123dfd92bfabf80f0adab9855f92e5c7227b4f5b8172afa9f805aa9a45`

Extracted historical file SHA-256 values:

```text
af96cf5ac01a1108342086d05e79c0fe8cdabe3fc4f2568b58a150c7ffb265de  README.txt
db30e1d4f099ed36538a11d93beefd594af2de246ae10b87a2a24f2062dc8d6d  package.json
0db8824db3dd814539793a2c9bc9b749d96126730accfb59119f1fb5630f0810  run.js
c6355cd034941bf1603739f63c5f4d0af934e926f3d83e9e7f4eb8fd2d747b27  t1_gelbooru.js
8c90f9341beb20d98510773283ccc3ddb06d9004059e1e7cfc38f7cf0cd02d46  t2_rule34.js
25bb01f2c2cc704997b15d0378890fa75a1ab8016036434ebc615396e44eb8c0  t3_dom.js
f30e688eacfb92e0536aa594c1e11ad1754acb661645e522067b9f142d68e66a  t4_actions.js
168ff32e14c0bef6c97e61fcfe56dd189632aebd844afde6476289150b300fa7  t5_append.js
39bad3c317c63b503ad698045cd5f0081f59ef49c3ac35c0cf2bcbf880af99cd  t6_video.js
64f1e18dbdac51d49f40462941246f4fa2ceeb26dcdd6cd347968ff017db9df9  t7_generic.js
```

The archive and its original scripts are not modified or relabeled as production tests.

| Historical evidence | Permanent detector | Baseline classification | Later owner checkpoint |
| --- | --- | --- | --- |
| T1 `t1_gelbooru.js` | `T1_STARTUP_FANOUT` | Known baseline defect | IB07 |
| T2 `t2_rule34.js` | `T2_HOVER_AMPLIFICATION` | Known baseline defect | IB06/IB09 |
| T3 `t3_dom.js` | `T3_CLICK_TAKEOVER_FAILURE` | Known baseline defect | IB04/IB11 |
| T4 `t3_dom.js` | `T4_NATIVE_TITLE_PRESERVATION` | Known baseline defect | IB04 |
| T5 `t3_dom.js` | `T5_E621_PICTURE_PRESERVATION` | Known baseline defect | IB04/IB08 |
| T6 `t4_actions.js` | `T6_DOWNLOAD_OVERLAP` | Known baseline defect | IB13 |
| T7 `t4_actions.js` | `T7_FAVORITE_FALSE_SUCCESS` | Known baseline defect | IB07/IB14 |
| T8 `t5_append.js` | `T8_APPEND_LIVENESS_403`, `T8_APPEND_LIVENESS_429` | Known baseline defect | IB06/IB12 |
| T9 `t6_video.js` | `T9_VIDEO_SOURCE_RETENTION` | Known baseline defect | IB10 |
| T10 `t7_generic.js` | `T10_GENERIC_HOST_MUTATION_RISK` | Known baseline defect | IB07 |

The permanent T10 detector adds the previously missing `idol.sankakucomplex.com` negative fixture.

## EC1 ownership evidence

The supplied EC0/EC1 evidence ledger records O01-O12 as bounded passing sensitivity evidence and O13 as a real stopped failure. The public handoff did not include the original EC1 script packet, so IB01 does not manufacture byte-identical historical scripts. `tests/permanent/evidence/ec1_ownership_registry.json` preserves the thirteen supplied outcomes and sensitivity descriptions. IB02 owns the new versioned executable ownership candidate and must keep O13 historically failed until its new candidate passes.

A green baseline harness run means the detectors correctly identify the pinned defects. It is not a claim that those production contracts pass.
