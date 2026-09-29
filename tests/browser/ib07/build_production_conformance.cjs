'use strict';
// Builds IB07_Gelbooru_Production_Conformance.user.js from the committed
// production source at COMMIT (read from git, not the working copy).
// The production body is kept byte-for-byte inside a named wrapper function
// that the script calls once; the metadata block is changed and the IB07P
// postamble is appended. Usage: node build_production_conformance.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Rebuilt for the Post pageCount artifact; the 9cade1a build was run live earlier (historical).
const COMMIT = 'c551bb0';
const BODY_START = '// ==/UserScript==\n';
const POSTAMBLE_MARKER = '/* IB07P GELBOORU PRODUCTION CONFORMANCE POSTAMBLE';
// The production body (one strict-mode IIFE after a comment block) runs
// inside this wrapper so the postamble can hash the executed source text via
// Function.prototype.toString. Tampermonkey's GM_info exposes no script source.
const WRAP_OPEN = 'const IB07P_PRODUCTION_BODY = function () {\n';
const WRAP_FN_HEAD = 'function () {\n';
const WRAP_CLOSE = '};\nIB07P_PRODUCTION_BODY();\n';
const OUT = path.join(__dirname, 'IB07_Gelbooru_Production_Conformance.user.js');

function productionSource() {
  const repo = path.resolve(__dirname, '../../..');
  return execFileSync('git', ['-C', repo, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function split(source) {
  const at = source.indexOf(BODY_START);
  if (at < 0) throw new Error('metadata end not found');
  return { meta: source.slice(0, at), body: source.slice(at + BODY_START.length) };
}

function deriveMeta(meta) {
  const kept = meta.split('\n').filter((line) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(line));
  const out = [];
  for (const line of kept) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB07 Gelbooru Production Conformance');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib07-gelbooru-production-conformance');
    else if (/^\/\/ @run-at\s/.test(line)) {
      out.push('// @match        *://gelbooru.com/*');
      out.push('// @connect      gelbooru.com');
      out.push(line);
    } else out.push(line);
  }
  return out.join('\n');
}

function build() {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body } = split(source);
  if (body.includes(POSTAMBLE_MARKER)) throw new Error('marker collides with production body');
  const bodySha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const postamble = fs.readFileSync(path.join(__dirname, 'ib07p_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
  if (!postamble.startsWith(POSTAMBLE_MARKER)) throw new Error('postamble must start with its marker');
  if (body.includes('IB07P_PRODUCTION_BODY')) throw new Error('wrapper name collides with production body');
  const text = deriveMeta(meta) + BODY_START + WRAP_OPEN + body + WRAP_CLOSE
    + postamble.replace('__EXPECTED_BODY_SHA256__', bodySha);
  return { text, body, bodySha };
}

module.exports = { build, split, COMMIT, BODY_START, POSTAMBLE_MARKER, WRAP_OPEN, WRAP_FN_HEAD, WRAP_CLOSE, OUT };

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
