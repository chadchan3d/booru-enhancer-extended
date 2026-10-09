'use strict';
// IB11-P9 diagnostic preload (node -r): the working-tree production with the P9
// type-change view transfer disabled (an image -> video rebuild never keeps the
// manual view), i.e. the repair minus P9. Used by p9_d5_attribution.cjs and to
// re-run the P7/P8 attributions (via NODE_OPTIONS) on the P9 production.
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const FROM = "\t\t\t\tconst keepView = manualZoom && currentElementType === 'image' && wantedElementType === 'video';\n";
const orig = h.productionSource;
h.productionSource = (...a) => { const s = orig(...a); return s.includes(FROM) ? s.replace(FROM, '\t\t\t\tconst keepView = false;\n') : s; };
