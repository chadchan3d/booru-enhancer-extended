'use strict';
// Builds IB11_P4_VD6A.user.js: the V-D6a (IB11-P4) qualification package.
// Production = the committed P4 repair (P4_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner with NO runner patches: the
// P4 server mode serves the unchanged TAKEOVER page, whose VD6A cell (armed
// stored volume 1.5, one trusted ordinary click on the video card, volume
// seam, overlay state at the failure and at page exit, native arrival) is the
// qualification. Only the script name and namespace differ. The
// evidence-pinned V-VIEW, P1, P2 and P3 packages stay byte-identical.
// Usage: node build_ib11_p4.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P4_COMMIT = 'fe1e06b';
const P4_EXPECTED_BLOB = 'f2328634aac5d4c597361699f71155f0eb11ac17';
const OUT = path.join(__dirname, 'IB11_P4_VD6A.user.js');
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P4 Failed-Takeover Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p4-vd6a\n'];

function buildP4({ commit = P4_COMMIT, expectedBlob = P4_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP4, P4_COMMIT, P4_EXPECTED_BLOB, OUT };

if (require.main === module) {
  const { text } = buildP4();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
