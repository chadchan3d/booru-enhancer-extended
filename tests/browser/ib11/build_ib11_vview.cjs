'use strict';
// Builds IB11_VVIEW_Controlled.user.js: the committed production source at
// COMMIT (read from git, body UNCHANGED, no hooks), wrapped as
//   const IB11V_PRODUCTION_BODY = function (location) { <production body> };
//   IB11V_PRODUCTION_BODY(IB11V_LOCATION);
// preceded by the observe-only recorder (vview_preamble.js) and followed by the
// cell runner (vview_postamble.js). The `location` parameter is the test-only
// host substitution for the local fixture (see the preamble). Matches only the
// local V-VIEW server. Usage: node build_ib11_vview.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START } = require('../ib07/build_production_conformance.cjs');
const { PORT } = require('./vview_server.cjs');

const COMMIT = '4d793a2';
const EXPECTED_PRODUCTION_BLOB = '002bdfd1a88adf8ed851df7ed768e6189e2bc958';
const WRAP_OPEN = 'const IB11V_PRODUCTION_BODY = function (location) {\n';
const WRAP_CLOSE = '};\nIB11V_PRODUCTION_BODY(IB11V_LOCATION);\n';
const OUT = path.join(__dirname, 'IB11_VVIEW_Controlled.user.js');
const REPO = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function deriveMeta(meta) {
  const out = [];
  for (const line of meta.split('\n').filter((l) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(l))) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB11 V-VIEW Controlled Viewer Evidence Probe');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-vview-controlled');
    else if (/^\/\/ @run-at\s/.test(line)) { out.push(`// @match        http://127.0.0.1:${PORT}/*`); out.push(line); }
    else out.push(line);
  }
  return out.join('\n');
}

function build({ bodyTransform = null } = {}) {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body: prodBody } = split(source);
  const body = bodyTransform ? bodyTransform(prodBody) : prodBody;
  for (const name of ['IB11V_PRODUCTION_BODY', 'IB11V_LOCATION', 'IB11V']) if (prodBody.includes(name)) throw new Error(`name collides with production body: ${name}`);
  const expectedSha = crypto.createHash('sha256').update(prodBody, 'utf8').digest('hex');
  const text = deriveMeta(meta) + BODY_START + read('vview_preamble.js') + WRAP_OPEN + body + WRAP_CLOSE + read('vview_postamble.js').replace('__EXPECTED_BODY_SHA256__', expectedSha);
  return { text, body, expectedSha, prodBody };
}

module.exports = { build, COMMIT, EXPECTED_PRODUCTION_BLOB, PORT, WRAP_OPEN, WRAP_CLOSE, OUT };

if (require.main === module) {
  const { text } = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
