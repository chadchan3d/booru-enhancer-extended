'use strict';
// Builds IB11_P9_D5.user.js: the IB11-P9 (E0 D5 image -> video view transfer)
// qualification package. Production = the committed P9 repair (P9_COMMIT, body
// UNCHANGED, no hooks), wrapped by the same V-VIEW recorder and runner, with
// runner-only patches applied at build time: the automatic P9 page (a manual
// view and a fitted control across a same-target IMG -> VIDEO rebuild).
// vview_postamble.js and the evidence-pinned V-VIEW, P1-P8 packages stay
// byte-identical.
// Usage: node build_ib11_p9.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P9_COMMIT = 'ac3c9e8';
const P9_EXPECTED_BLOB = 'db5484396de60a90711e3b566fb8f6bbc10b3181';
const OUT = path.join(__dirname, 'IB11_P9_D5.user.js');
const P9 = fs.readFileSync(path.join(__dirname, 'p9_d5.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ['  async function VD6A(out) {', `${P9}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P9_D5') {\n      await P9_D5(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P9 Image-to-Video View Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p9-d5\n'];

function buildP9({ commit = P9_COMMIT, expectedBlob = P9_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP9, P9_COMMIT, P9_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP9();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
