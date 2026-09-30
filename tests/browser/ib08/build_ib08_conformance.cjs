'use strict';
// Builds IB08_Rendition_Production_Conformance.user.js for e621 and e926 from
// the committed production source at COMMIT (read from git, not the working
// copy). Same convention and C00 wrapper method as the IB07 packages (wrapper
// constants imported from the IB07 builder): the production body runs
// byte-for-byte inside IB07P_PRODUCTION_BODY, the metadata block gets a test
// identity with narrowed @match/@connect and no update targets, and the IB08P
// postamble is appended. Usage: node build_ib08_conformance.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START, WRAP_OPEN, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');

// Production with the IB08 P-stage rendition contract.
const COMMIT = 'b2b1d9f';
const EXPECTED_PRODUCTION_BLOB = 'a0f3041c409a656f67fe23dc827b020b5cc399e6';
const POSTAMBLE_MARKER = '/* IB08P E621/E926 RENDITION PRODUCTION CONFORMANCE POSTAMBLE';
const HOSTS = ['e621.net', 'e926.net'];
const OUT = path.join(__dirname, 'IB08_Rendition_Production_Conformance.user.js');
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
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB08 e621/e926 Rendition Production Conformance');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib08-rendition-production-conformance');
    else if (/^\/\/ @run-at\s/.test(line)) {
      for (const h of HOSTS) out.push(`// @match        *://${h}/*`);
      for (const h of HOSTS) out.push(`// @connect      ${h}`);
      out.push(line);
    } else out.push(line);
  }
  return out.join('\n');
}

function build() {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body } = split(source);
  if (body.includes(POSTAMBLE_MARKER) || body.includes('IB07P_PRODUCTION_BODY')) throw new Error('marker or wrapper name collides with production body');
  const bodySha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const postamble = fs.readFileSync(path.join(__dirname, 'ib08p_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
  if (!postamble.startsWith(POSTAMBLE_MARKER)) throw new Error('postamble must start with its marker');
  const text = deriveMeta(meta) + BODY_START + WRAP_OPEN + body + WRAP_CLOSE
    + postamble.replace('__EXPECTED_BODY_SHA256__', bodySha);
  return { text, body, bodySha, originalMeta: meta };
}

module.exports = { build, COMMIT, EXPECTED_PRODUCTION_BLOB, POSTAMBLE_MARKER, HOSTS, OUT };

if (require.main === module) {
  const { text } = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    const same = current === text;
    console.log(same ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (!same) process.exitCode = 1;
  } else {
    fs.writeFileSync(OUT, text);
    console.log('WROTE', path.basename(OUT));
  }
}
