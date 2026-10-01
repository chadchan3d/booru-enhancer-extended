'use strict';
// Builds IB10_V3R_Revisit.user.js (test only). It carries two bodies derived from
// the committed production source at COMMIT (read from git):
//   ASIS    - the production body, byte for byte;
//   RELEASE - the production body with ONE inserted test-only line in hide():
//             an installed hover <video> is released on leave the same way
//             cancelPendingUpgrade already releases a pending one (pause has
//             already run in stopCurrentMedia; then removeAttribute('src') and
//             load()). This patch is never production code.
// The page's cell configuration selects which body runs. Both bodies receive the
// V3-C test-only location object (hostname e621.net on the local fixture).
// Preamble: the unchanged V3-C recorder (v3c_preamble.js). Postamble: v3r_postamble.js.
// Matches only the local V3-R server. Usage: node build_ib10_v3r.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const COMMIT = 'b9d133c';
const EXPECTED_PRODUCTION_BLOB = '22e843cbe27662fc27d17149534b055d7a249dae';
const PORT = 8792;
const OUT = path.join(__dirname, 'IB10_V3R_Revisit.user.js');
const REPO = path.resolve(__dirname, '../../..');
const RELEASE_ANCHOR = '\t\t\tif (!hoverEl) return;\n\t\t\tstopCurrentMedia();\n\t\t\thoverEl.style.display';
const RELEASE_LINE = "\t\t\t{ const v = hoverEl.querySelector('video'); if (v) { try { v.removeAttribute('src'); v.load(); } catch { /* noop */ } } } // IB10 V3-R test-only RELEASE\n";
const RELEASE_PATCHED = '\t\t\tif (!hoverEl) return;\n\t\t\tstopCurrentMedia();\n' + RELEASE_LINE + '\t\t\thoverEl.style.display';
const OPEN = (name) => `\t${name}: function (location) {\n`;

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}
const releaseBody = (prodBody) => mustReplace(prodBody, RELEASE_ANCHOR, RELEASE_PATCHED);

function deriveMeta(meta) {
  const kept = meta.split('\n').filter((line) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(line));
  const out = [];
  for (const line of kept) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB10 V3-R Revisit/Cache Experiment');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib10-v3r-revisit');
    else if (/^\/\/ @run-at\s/.test(line)) { out.push(`// @match        http://127.0.0.1:${PORT}/*`); out.push(line); }
    else out.push(line);
  }
  return out.join('\n');
}

// Transforms are for the verifier's fault controls only.
function build({ asisTransform = null, releaseTransform = null, postTransform = null } = {}) {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body: prodBody } = split(source);
  for (const name of ['IB10R_BODIES', 'IB10R_VARIANT', 'IB10C', 'IB10C_LOCATION']) if (prodBody.includes(name)) throw new Error(`name collides with production body: ${name}`);
  let asis = prodBody; if (asisTransform) asis = asisTransform(asis);
  let release = releaseBody(prodBody); if (releaseTransform) release = releaseTransform(release);
  const sha = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
  const expected = { ASIS: sha(prodBody), RELEASE: sha(releaseBody(prodBody)) };
  const pre = fs.readFileSync(path.join(__dirname, 'v3c_preamble.js'), 'utf8').replace(/\r\n/g, '\n');
  let post = fs.readFileSync(path.join(__dirname, 'v3r_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
  if (postTransform) post = postTransform(post);
  const select = "var IB10R_VARIANT = (function () { try { return JSON.parse(document.getElementById('ib10r-run').textContent).variant; } catch (e) { return null; } })();\n";
  const text = deriveMeta(meta) + BODY_START + pre + select
    + 'const IB10R_BODIES = {\n' + OPEN('ASIS') + asis + '},\n' + OPEN('RELEASE') + release + '},\n};\n'
    + 'if (typeof IB10R_BODIES[IB10R_VARIANT] === \'function\') IB10R_BODIES[IB10R_VARIANT](IB10C_LOCATION);\n'
    + post.replace('__ASIS_SHA256__', expected.ASIS).replace('__RELEASE_SHA256__', expected.RELEASE);
  return { text, prodBody, asis, release, expected };
}

function extractBodies(text) {
  const a0 = text.indexOf(OPEN('ASIS')) + OPEN('ASIS').length;
  const a1 = text.indexOf('},\n' + OPEN('RELEASE'));
  const r0 = a1 + ('},\n' + OPEN('RELEASE')).length;
  const r1 = text.indexOf('},\n};\nif (typeof IB10R_BODIES');
  return { asis: text.slice(a0, a1), release: text.slice(r0, r1) };
}

module.exports = { build, extractBodies, releaseBody, COMMIT, EXPECTED_PRODUCTION_BLOB, PORT, OUT, RELEASE_ANCHOR, RELEASE_LINE };

if (require.main === module) {
  const { text } = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
