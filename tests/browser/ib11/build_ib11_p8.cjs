'use strict';
// Builds IB11_P8_Focus.user.js: the IB11-P8 (focus ownership/return)
// qualification package. Production = the committed P8 repair (P8_COMMIT,
// body UNCHANGED, no hooks), wrapped by the same V-VIEW recorder and runner,
// with runner-only patches applied at build time: the P8 page (mouse-origin
// and keyboard-origin cells with trusted Tab / Shift+Tab traversal).
// vview_postamble.js and the evidence-pinned V-VIEW, P1-P7 packages stay
// byte-identical.
// Usage: node build_ib11_p8.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P8_COMMIT = '9d86484';
const P8_EXPECTED_BLOB = '8453be9447820978b7d4a2886ea9ae2bf4e87c10';
const OUT = path.join(__dirname, 'IB11_P8_Focus.user.js');
const P8 = fs.readFileSync(path.join(__dirname, 'p8_focus.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ['  async function VD6A(out) {', `${P8}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P8_FOCUS') {\n      await P8_FOCUS(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P8 Focus Ownership Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p8-focus\n'];

function buildP8({ commit = P8_COMMIT, expectedBlob = P8_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP8, P8_COMMIT, P8_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP8();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
