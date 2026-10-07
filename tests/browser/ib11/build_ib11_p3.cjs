'use strict';
// Builds IB11_P3_VD5.user.js: the V-D5 (IB11-P3) qualification package.
// Production = the committed P3 repair (P3_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner, with runner-only patches
// applied at build time: the P3 page (existing VD5 cell: trusted Ctrl+F and
// Ctrl+D; then trusted Alt+O and unmodified F / D controls). vview_postamble.js
// and the evidence-pinned V-VIEW, P1 and P2 packages stay byte-identical.
// Usage: node build_ib11_p3.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P3_COMMIT = '48e44d9';
const P3_EXPECTED_BLOB = 'f2b46eb443e153e03123742fb5d4baa4be761dd6';
const OUT = path.join(__dirname, 'IB11_P3_VD5.user.js');
const P3 = fs.readFileSync(path.join(__dirname, 'p3_vd5.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ['  async function VD6A(out) {', `${P3}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P3_VD5') {\n      await P3_VD5(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P3 Modifier-Chord Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p3-vd5\n'];

function buildP3({ commit = P3_COMMIT, expectedBlob = P3_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP3, P3_COMMIT, P3_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP3();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
