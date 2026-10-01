'use strict';
// Builds IB10_V3L_Live_Observer.user.js: the committed production source at
// COMMIT (read from git, body UNCHANGED, no hooks), wrapped as
//   const IB10L_PRODUCTION_BODY = function () { <production body> };
//   IB10L_PRODUCTION_BODY();
// preceded by the observe-only recorder (v3l_preamble.js) and the shared
// classifier (v3l_classify.js), followed by the observer (v3l_postamble.js).
// Matches only e621.net and e926.net. Usage: node build_ib10_v3l.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START } = require('../ib07/build_production_conformance.cjs');

const COMMIT = 'b9d133c';
const EXPECTED_PRODUCTION_BLOB = '22e843cbe27662fc27d17149534b055d7a249dae';
const HOSTS = ['e621.net', 'e926.net'];
const WRAP_OPEN = 'const IB10L_PRODUCTION_BODY = function () {\n';
const WRAP_CLOSE = '};\nIB10L_PRODUCTION_BODY();\n';
const OUT = path.join(__dirname, 'IB10_V3L_Live_Observer.user.js');
const REPO = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function deriveMeta(meta) {
  const kept = meta.split('\n').filter((line) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(line));
  const out = [];
  for (const line of kept) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB10 V3-L Live Hover-Video Observer');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib10-v3l-live');
    else if (/^\/\/ @run-at\s/.test(line)) {
      for (const h of HOSTS) out.push(`// @match        *://${h}/*`);
      for (const h of HOSTS) out.push(`// @connect      ${h}`);
      out.push(line);
    } else out.push(line);
  }
  return out.join('\n');
}

// Transforms are for the verifier's fault controls only.
function build({ bodyTransform = null, preTransform = null, postTransform = null } = {}) {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body: prodBody } = split(source);
  for (const name of ['IB10L_PRODUCTION_BODY', 'IB10L', 'IB10L_CLASSIFY']) if (prodBody.includes(name)) throw new Error(`name collides with production body: ${name}`);
  const body = bodyTransform ? bodyTransform(prodBody) : prodBody;
  const expectedSha = crypto.createHash('sha256').update(prodBody, 'utf8').digest('hex');
  let pre = read('v3l_preamble.js'); if (preTransform) pre = preTransform(pre);
  let post = read('v3l_postamble.js'); if (postTransform) post = postTransform(post);
  const text = deriveMeta(meta) + BODY_START + pre + read('v3l_classify.js') + WRAP_OPEN + body + WRAP_CLOSE + post.replace('__EXPECTED_BODY_SHA256__', expectedSha);
  return { text, body, expectedSha, prodBody };
}

module.exports = { build, COMMIT, EXPECTED_PRODUCTION_BLOB, WRAP_OPEN, WRAP_CLOSE, OUT };

if (require.main === module) {
  const { text } = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
