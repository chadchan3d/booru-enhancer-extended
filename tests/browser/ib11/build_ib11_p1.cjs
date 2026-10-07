'use strict';
// Builds IB11_P1_Native.user.js: the V-D8 (IB11-P1) qualification package.
// Production = the committed P1 repair (P1_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner, with a runner-only patch
// applied at build time that adds the P1 page (STAGECLOSE control, then the
// revision-1.3 NATIVE cell). vview_postamble.js and the evidence-pinned
// IB11_VVIEW_Controlled.user.js stay byte-identical. Distinct @name/@namespace.
// Usage: node build_ib11_p1.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P1_COMMIT = '9aeab36';
const P1_EXPECTED_BLOB = '039b99e81fe844d864cbcc047cdca1e5b16ee1e2';
const OUT = path.join(__dirname, 'IB11_P1_Native.user.js');
const STAGECLOSE = fs.readFileSync(path.join(__dirname, 'p1_stageclose.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ['  async function VD6A(out) {', `${STAGECLOSE}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P1_NATIVE') {\n      await STAGECLOSE(out);\n      await NATIVE_R(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P1 Native-Link Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p1-native\n'];

function buildP1({ commit = P1_COMMIT, expectedBlob = P1_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP1, P1_COMMIT, P1_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP1();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
