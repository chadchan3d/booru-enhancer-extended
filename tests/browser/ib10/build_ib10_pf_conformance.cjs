'use strict';
// Builds the IB10 reopen (poster/View fallback) targeted live conformance package
// from the committed production artifact PF_COMMIT (body UNCHANGED, no hooks):
//   IB10_PF_Live_Observer.user.js - the same V3-L observe-only recorder/observer
//     as IB10_P_Live_Observer.user.js, around the corrected production body, for
//     logged-out e621/e926 /posts. Evaluated by p_conformance_ib10.cjs targeted
//     (revision 1.2): admitted cards keep the dwell/release behavior; excluded
//     video cards create no hover video; View still opens.
// The 8324552 packages (build_ib10_p_conformance.cjs) are evidence-pinned and not
// modified.
// Usage: node build_ib10_pf_conformance.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib10_p_conformance.cjs');

const PF_COMMIT = '4d793a2';
const PF_EXPECTED_BLOB = '002bdfd1a88adf8ed851df7ed768e6189e2bc958';
const OUT_PF_LIVE = path.join(__dirname, 'IB10_PF_Live_Observer.user.js');
const NAME_FROM = '// @name         Booru Enhancer Extended — IB10 P Live Conformance\n';
const NAME_TO = '// @name         Booru Enhancer Extended — IB10 PF Live Conformance (poster/View fallback)\n';
const NS_FROM = '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib10-p-live\n';
const NS_TO = '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib10-pf-live\n';

function buildPf() {
  const r = b.build({ commit: PF_COMMIT, expectedBlob: PF_EXPECTED_BLOB });
  if (!r.live.includes(NAME_FROM) || !r.live.includes(NS_FROM)) throw new Error('live package header changed');
  return { live: r.live.replace(NAME_FROM, NAME_TO).replace(NS_FROM, NS_TO), prodBody: r.prodBody, expected: r.expected };
}

module.exports = { buildPf, PF_COMMIT, PF_EXPECTED_BLOB, OUT_PF_LIVE };

if (require.main === module) {
  const { live } = buildPf();
  if (process.argv.includes('--check')) {
    const ok = fs.existsSync(OUT_PF_LIVE) && fs.readFileSync(OUT_PF_LIVE, 'utf8') === live;
    console.log(ok ? 'DERIVED_SCRIPTS_UP_TO_DATE' : 'DERIVED_SCRIPTS_STALE');
    if (!ok) process.exitCode = 1;
  } else { fs.writeFileSync(OUT_PF_LIVE, live); console.log('WROTE', path.basename(OUT_PF_LIVE)); }
}
