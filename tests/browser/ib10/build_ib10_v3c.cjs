'use strict';
// Builds IB10_V3C_Controlled.user.js: the committed production source at COMMIT
// (read from git, body UNCHANGED, no hooks), wrapped as
//   const IB10C_PRODUCTION_BODY = function (location) { <production body> };
//   IB10C_PRODUCTION_BODY(IB10C_LOCATION);
// preceded by the observe-only recording preamble (v3c_preamble.js) and followed
// by the scenario runner (v3c_postamble.js). The `location` parameter is the
// test-only host substitution for the local fixture (see the preamble). Matches
// only the local V3-C server. Usage: node build_ib10_v3c.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START } = require('../ib07/build_production_conformance.cjs');

const COMMIT = 'b9d133c';
const EXPECTED_PRODUCTION_BLOB = '22e843cbe27662fc27d17149534b055d7a249dae';
const PORT = 8790;
const WRAP_OPEN = 'const IB10C_PRODUCTION_BODY = function (location) {\n';
const WRAP_CLOSE = '};\nIB10C_PRODUCTION_BODY(IB10C_LOCATION);\n';
const OUT = path.join(__dirname, 'IB10_V3C_Controlled.user.js');
const REPO = path.resolve(__dirname, '../../..');

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function deriveMeta(meta) {
  const kept = meta.split('\n').filter((line) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(line));
  const out = [];
  for (const line of kept) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB10 V3-C Controlled Hover-Video Experiment');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib10-v3c-controlled');
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
  for (const name of ['IB10C_PRODUCTION_BODY', 'IB10C_LOCATION', 'IB10C']) if (prodBody.includes(name)) throw new Error(`name collides with production body: ${name}`);
  const bodySha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const expectedSha = crypto.createHash('sha256').update(prodBody, 'utf8').digest('hex');
  const pre = fs.readFileSync(path.join(__dirname, 'v3c_preamble.js'), 'utf8').replace(/\r\n/g, '\n');
  const post = fs.readFileSync(path.join(__dirname, 'v3c_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
  const text = deriveMeta(meta) + BODY_START + pre + WRAP_OPEN + body + WRAP_CLOSE + post.replace('__EXPECTED_BODY_SHA256__', expectedSha);
  return { text, body, bodySha, expectedSha, prodBody };
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
