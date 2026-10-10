'use strict';
// Builds IB12_E2_Rule34_Back.user.js: the committed production source at COMMIT
// (read from git; body UNCHANGED, no hooks) inside the IB07P wrapper, followed by
// the observe-only IB12E2 postamble. Scope: rule34.xxx only. Production
// (Booru_Enhancer.user.js) is not modified.
// Usage: node build_ib12_e2.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START, WRAP_OPEN, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');

const COMMIT = '466a480';
const EXPECTED_PRODUCTION_BLOB = '3be0e1f849909a3b394c256b12dc09376f44df12';
const EXPECTED_BODY_SHA256 = '9fa6ab28d88d367947ef5807761218f9e5264ba2fd8194da5a1338bb322236b3';
const POSTAMBLE_MARKER = '/* IB12E2 RULE34 NATIVE BACK AND PAGE-ADDRESS OBSERVER POSTAMBLE';
const HOST = 'rule34.xxx';
const OUT = path.join(__dirname, 'IB12_E2_Rule34_Back.user.js');
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
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB12 E2 Rule34 Native Back and Page-Address Observation (E stage)');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib12-e2-rule34');
    else if (/^\/\/ @run-at\s/.test(line)) {
      out.push(`// @match        *://${HOST}/*`);
      out.push(`// @connect      ${HOST}`);
      out.push(line);
    } else out.push(line);
  }
  return out.join('\n');
}

function build() {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body } = split(source);
  const bodySha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  if (bodySha !== EXPECTED_BODY_SHA256) throw new Error('production body is not the expected artifact');
  if (body.includes(POSTAMBLE_MARKER) || body.includes('IB07P_PRODUCTION_BODY')) throw new Error('marker or wrapper name collides with body');
  const postamble = fs.readFileSync(path.join(__dirname, 'ib12e2_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
  if (!postamble.startsWith(POSTAMBLE_MARKER)) throw new Error('postamble must start with its marker');
  const text = deriveMeta(meta) + BODY_START + WRAP_OPEN + body + WRAP_CLOSE + postamble.replace('__EXPECTED_BODY_SHA256__', bodySha);
  return { text, body, bodySha, meta, postamble };
}

module.exports = { build, COMMIT, EXPECTED_PRODUCTION_BLOB, EXPECTED_BODY_SHA256, POSTAMBLE_MARKER, HOST, OUT };

if (require.main === module) {
  const { text } = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
