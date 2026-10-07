'use strict';
// Builds IB11_P5_VD6B.user.js: the V-D6b (IB11-P5) qualification package.
// Production = the committed P5 repair (P5_COMMIT, body UNCHANGED, no hooks),
// wrapped by the same V-VIEW recorder and runner, with runner-only patches
// applied at build time: NATIVE_R may reuse the open viewer (as at P2) and the
// P5 page (trusted in-viewer ArrowRight onto the failing video, then the
// revision-1.3 NATIVE cell on the failing target's link). vview_postamble.js
// and the evidence-pinned V-VIEW, P1-P4 packages stay byte-identical.
// Usage: node build_ib11_p5.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_vview.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P5_COMMIT = '24ee7c2';
const P5_EXPECTED_BLOB = '68e37d1c9071d2ae78ae44b31f0082cd51010992';
const OUT = path.join(__dirname, 'IB11_P5_VD6B.user.js');
const P5 = fs.readFileSync(path.join(__dirname, 'p5_vd6b.js'), 'utf8').replace(/\r\n/g, '\n');
const PATCHES = [
  ["  async function NATIVE_R(out) {\n    cell = 'NATIVE';\n    await openCard('NATIVE');", "  async function NATIVE_R(out, opts = {}) {\n    cell = 'NATIVE';\n    if (!opts.reuseOpen) await openCard('NATIVE');"],
  ['  async function VD6A(out) {', `${P5}  async function VD6A(out) {`],
  ["    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);", "    } else if (cfg.page === 'P5_VD6B') {\n      await P5_VD6B(out);\n    } else if (cfg.page === 'NATIVE_R') {\n      await NATIVE_R(out);"],
];
const NAME = ['// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe\n', '// @name         Booru Enhancer Extended — IB11 P5 In-Viewer Build-Failure Qualification\n'];
const NS = ['// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled\n', '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-p5-vd6b\n'];

function buildP5({ commit = P5_COMMIT, expectedBlob = P5_EXPECTED_BLOB, bodyTransform = null } = {}) {
  const r = b.build({ commit, expectedBlob, bodyTransform, postTransform: (post) => PATCHES.reduce((t, [f, to]) => mustReplace(t, f, to), post) });
  return { ...r, text: mustReplace(mustReplace(r.text, NAME[0], NAME[1]), NS[0], NS[1]) };
}

module.exports = { buildP5, P5_COMMIT, P5_EXPECTED_BLOB, OUT, PATCHES };

if (require.main === module) {
  const { text } = buildP5();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
