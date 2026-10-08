'use strict';
// Builds IB11_P6_VD4.user.js: the V-D4 (IB11-P6) qualification package.
// Production = the committed P6 repair (P6_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner, with runner-only patches
// applied at build time: the P6 page (the V-VIEW VD4 steps with two trusted
// resizes, then one operator screenshot of the repaired rotated fit).
// vview_postamble.js and the evidence-pinned V-VIEW, P1-P5 packages stay
// byte-identical.
// Usage: node build_ib11_p6.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P6_COMMIT = '39a5ae1';
const P6_EXPECTED_BLOB = '0a7f57f2cbcd080d3ae91f86f6edddab1f3e50c6';
const OUT = path.join(__dirname, 'IB11_P6_VD4.user.js');
const P6 = fs.readFileSync(path.join(__dirname, 'p6_vd4.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ['  async function VD6A(out) {', `${P6}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P6_VD4') {\n      await P6_VD4(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P6 Rotated-Fit Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p6-vd4\n'];

function buildP6({ commit = P6_COMMIT, expectedBlob = P6_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP6, P6_COMMIT, P6_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP6();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
