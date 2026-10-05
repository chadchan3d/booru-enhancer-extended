'use strict';
// Builds the two IB10 P-stage conformance packages from the committed IB10
// production artifact (COMMIT; body UNCHANGED, no hooks):
//   IB10_P_Controlled.user.js - the V3-C controlled harness (v3c_preamble.js
//     recorder + v3c_postamble.js runner) around the new production body, for the
//     local V3-C server on PORT. Test-only host substitution: the location object
//     reports e926.net for MP4 runs and e621.net for WebM runs, so both fixture
//     containers fall inside the admitted G-VIDEO classes;
//   IB10_P_Live_Observer.user.js - the V3-L observe-only recorder/observer
//     (v3l_preamble.js, v3l_classify.js, v3l_postamble.js) around the new body,
//     for logged-out e621/e926 /posts.
// The E-stage builders and packages are not modified.
// Usage: node build_ib10_p_conformance.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const COMMIT = '8324552';
const EXPECTED_PRODUCTION_BLOB = '4258ad7746c022606f222fc48924055912de4cfc';
const PORT = 8794;
const HOSTS = ['e621.net', 'e926.net'];
const OUT_CONTROLLED = path.join(__dirname, 'IB10_P_Controlled.user.js');
const OUT_LIVE = path.join(__dirname, 'IB10_P_Live_Observer.user.js');
const REPO = path.resolve(__dirname, '../../..');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');
const C_WRAP_OPEN = 'const IB10C_PRODUCTION_BODY = function (location) {\n';
const C_WRAP_CLOSE = '};\nIB10C_PRODUCTION_BODY(IB10C_LOCATION);\n';
const L_WRAP_OPEN = 'const IB10L_PRODUCTION_BODY = function () {\n';
const L_WRAP_CLOSE = '};\nIB10L_PRODUCTION_BODY();\n';
const HOST_SHIM_FROM = "  get hostname() { return 'e621.net'; },\n  get host() { return 'e621.net'; },\n";
const HOST_SHIM_TO = "  get hostname() { return IB10P_HOST; },\n  get host() { return IB10P_HOST; },\n";
const HOST_SELECT = "var IB10P_HOST = (function () { try { return JSON.parse(document.getElementById('ib10c-run').textContent).container === 'mp4' ? 'e926.net' : 'e621.net'; } catch (e) { return 'e621.net'; } })(); // IB10 P: MP4 runs as e926, WebM runs as e621\n";

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
function meta(m, name, ns, matches) {
  const out = [];
  for (const line of m.split('\n').filter((l) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(l))) {
    if (/^\/\/ @name\s/.test(line)) out.push(`// @name         ${name}`);
    else if (/^\/\/ @namespace\s/.test(line)) out.push(`// @namespace    ${ns}`);
    else if (/^\/\/ @run-at\s/.test(line)) { for (const x of matches) out.push(x); out.push(line); }
    else out.push(line);
  }
  return out.join('\n');
}

function build({ bodyTransform = null } = {}) {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta: m, body: prodBody } = split(source);
  const body = bodyTransform ? bodyTransform(prodBody) : prodBody;
  const expected = crypto.createHash('sha256').update(prodBody, 'utf8').digest('hex');
  const cPre = HOST_SELECT + mustReplace(read('v3c_preamble.js'), HOST_SHIM_FROM, HOST_SHIM_TO);
  const controlled = meta(m, 'Booru Enhancer Extended — IB10 P Controlled Conformance', 'https://github.com/chadchan3d/booru-enhancer-extended/ib10-p-controlled', [`// @match        http://127.0.0.1:${PORT}/*`])
    + BODY_START + cPre + C_WRAP_OPEN + body + C_WRAP_CLOSE + read('v3c_postamble.js').replace('__EXPECTED_BODY_SHA256__', expected);
  const live = meta(m, 'Booru Enhancer Extended — IB10 P Live Conformance', 'https://github.com/chadchan3d/booru-enhancer-extended/ib10-p-live', [...HOSTS.map((h) => `// @match        *://${h}/*`), ...HOSTS.map((h) => `// @connect      ${h}`)])
    + BODY_START + read('v3l_preamble.js') + read('v3l_classify.js') + L_WRAP_OPEN + body + L_WRAP_CLOSE + read('v3l_postamble.js').replace('__EXPECTED_BODY_SHA256__', expected);
  return { controlled, live, prodBody, expected };
}

module.exports = { build, COMMIT, EXPECTED_PRODUCTION_BLOB, PORT, OUT_CONTROLLED, OUT_LIVE, C_WRAP_OPEN, C_WRAP_CLOSE, L_WRAP_OPEN, L_WRAP_CLOSE };

if (require.main === module) {
  const { controlled, live } = build();
  if (process.argv.includes('--check')) {
    const ok = [[OUT_CONTROLLED, controlled], [OUT_LIVE, live]].every(([f, t]) => fs.existsSync(f) && fs.readFileSync(f, 'utf8') === t);
    console.log(ok ? 'DERIVED_SCRIPTS_UP_TO_DATE' : 'DERIVED_SCRIPTS_STALE');
    if (!ok) process.exitCode = 1;
  } else { fs.writeFileSync(OUT_CONTROLLED, controlled); fs.writeFileSync(OUT_LIVE, live); console.log('WROTE', path.basename(OUT_CONTROLLED), path.basename(OUT_LIVE)); }
}
