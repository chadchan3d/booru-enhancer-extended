'use strict';
// IB11-P8 diagnostic preload (node -r): the working-tree production with the
// P8 focus acquisition disabled (the viewer does not move focus into itself
// on open), i.e. the repair minus focus ownership. Used by
// p8_focus_attribution.cjs; it can be chained after
// p7_neutral_staging_preload.cjs (each wraps productionSource).
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const FROM = '\t\t\tif (closeBtn && (!wasOpen || !overlay.contains(document.activeElement))) closeBtn.focus({ preventScroll: true });\n';
const orig = h.productionSource;
h.productionSource = (...a) => { const s = orig(...a); if (s.split(FROM).length !== 2) throw new Error('P8 focus anchor not found exactly once'); return s.replace(FROM, ''); };
