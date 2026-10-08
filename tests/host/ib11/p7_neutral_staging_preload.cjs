'use strict';
// IB11-P7 diagnostic preload (node -r): the working-tree production with the
// V-D7 staging disabled - no placeholder is chosen at open
// (stagedPlaceholderUrl returns '') and a same-post enrichment upgrade swaps
// the element's source directly instead of preloading the original. That is
// the repair minus staging. Used by p7_staging_attribution.cjs.
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const SWAPS = [
  ["\t\t\tif (!post?.originalUrl || fullUrl !== post.originalUrl) return '';\n", "\t\t\treturn '';\n"],
  ['\t\t\t\t\t} else if (mediaEl.naturalWidth > 0 && mediaEl.naturalHeight > 0) {\n', '\t\t\t\t\t} else if (false) {\n'],
];
const orig = h.productionSource;
h.productionSource = (...a) => { let s = orig(...a); for (const [from, to] of SWAPS) { if (s.split(from).length !== 2) throw new Error(`P7 staging anchor not found exactly once: ${from.trim()}`); s = s.replace(from, to); } return s; };
