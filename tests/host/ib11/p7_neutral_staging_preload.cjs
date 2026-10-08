'use strict';
// IB11-P7 diagnostic preload (node -r): the working-tree production with ONLY
// the V-D7 placeholder selection disabled (stagedPlaceholderUrl returns ''),
// i.e. the repair minus staging. Used by p7_staging_attribution.cjs.
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const FROM = "\t\t\tif (!post?.originalUrl || fullUrl !== post.originalUrl) return '';\n";
const orig = h.productionSource;
h.productionSource = (...a) => { const s = orig(...a); if (!s.includes(FROM)) throw new Error('P7 staging anchor not found'); return s.replace(FROM, "\t\t\treturn '';\n"); };
