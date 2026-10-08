'use strict';
// Builds IB11_P7_VD7.user.js: the V-D7 (IB11-P7) qualification package.
// Production = the committed P7 repair (P7_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner, with runner-only patches
// applied at build time: the automatic P7 page (staging of a slow original
// after in-viewer navigation; transforms applied before the upgrade).
// vview_postamble.js and the evidence-pinned V-VIEW, P1-P6 packages stay
// byte-identical.
// Usage: node build_ib11_p7.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P7_COMMIT = 'b856a62';
const P7_EXPECTED_BLOB = 'b88af3817e8aa3a813272a30115204f39854d58c';
const OUT = path.join(__dirname, 'IB11_P7_VD7.user.js');
const P7 = fs.readFileSync(path.join(__dirname, 'p7_vd7.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ['  async function VD6A(out) {', `${P7}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P7_VD7') {\n      await P7_VD7(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P7 Staged-Placeholder Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p7-vd7\n'];

function buildP7({ commit = P7_COMMIT, expectedBlob = P7_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP7, P7_COMMIT, P7_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP7();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
