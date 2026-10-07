'use strict';
// Builds IB11_P2_VD1.user.js: the V-D1 (IB11-P2) qualification package.
// Production = the committed P2 repair (P2_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner, with runner-only patches
// applied at build time: the P2 page (real failure -> late same-post update ->
// state recorded -> revision-1.3 NATIVE cell on the same open viewer) and a
// reuse-the-open-viewer option for NATIVE_R. vview_postamble.js and the
// evidence-pinned V-VIEW and P1 packages stay byte-identical.
// Usage: node build_ib11_p2.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P2_COMMIT = 'bef4437';
const P2_EXPECTED_BLOB = '56c495e2c726a5a17f443d89d729fbd8f206eb46';
const OUT = path.join(__dirname, 'IB11_P2_VD1.user.js');
const P2 = fs.readFileSync(path.join(__dirname, 'p2_vd1.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ["  async function NATIVE_R(out) {\n    cell = 'NATIVE';\n    await openCard('NATIVE');", "  async function NATIVE_R(out, opts = {}) {\n    cell = 'NATIVE';\n    if (!opts.reuseOpen) await openCard('NATIVE');"],
  ['  async function VD6A(out) {', `${P2}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P2_VD1') {\n      await P2_VD1(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P2 Failure-State Durability Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p2-vd1\n'];

function buildP2({ commit = P2_COMMIT, expectedBlob = P2_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP2, P2_COMMIT, P2_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP2();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
