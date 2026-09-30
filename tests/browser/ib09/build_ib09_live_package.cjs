'use strict';
// Builds IB09_Dwell_Live_Check.user.js: the committed production source at
// COMMIT (read from git), patched with the locally qualified 200 ms dwell
// prototype (tests/host/ib09/dwell_prototype.cjs) and instrumented with
// observe-only hooks. Each hook calls IB09L_HOOK(event, data) and changes no
// control flow or value. It runs inside the IB07 wrapper, followed by the IB09L
// observer postamble. Production (Booru_Enhancer.user.js) is not modified.
// Pinning: removing the hook insertions reproduces applyDwellPrototype(production)
// byte-for-byte (the verifier checks this), and the C00 in-page hash pins the
// executed body. Usage: node build_ib09_live_package.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START, WRAP_OPEN, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');
const { applyDwellPrototype, mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const COMMIT = '91fa86d';
const EXPECTED_PRODUCTION_BLOB = 'bbaf9ac63f5c0292018b974f00c7b30d8b478bb5';
const DWELL_MS = 200;
const POSTAMBLE_MARKER = '/* IB09L DWELL LIVE CHECK POSTAMBLE';
const HOSTS = ['e621.net', 'e926.net'];
const OUT = path.join(__dirname, 'IB09_Dwell_Live_Check.user.js');
const REPO = path.resolve(__dirname, '../../..');
const H = (ev, data) => `typeof IB09L_HOOK === 'function' && IB09L_HOOK('${ev}', ${data});`;

// Observe-only hook insertions (each is a pure addition; see stripHooks).
const HOOKS = [
  ['\t\t\tpreview.src = url;\n', `\t\t\t${H('assign', "{ kind: 'thumb', url, token, el: preview }")} // IB09L\n\t\t\tpreview.src = url;\n`],
  ['\t\t\timage.src = resolved.url;\n', `\t\t\t${H('assign', "{ kind: 'upgrade', url: resolved.url, token, el: image }")} // IB09L\n\t\t\timage.src = resolved.url;\n`],
  ['\t\t\t\tvideo.src = resolved.url;\n', `\t\t\t\t${H('assign', "{ kind: 'upgrade-video', url: resolved.url, token, el: video }")} // IB09L\n\t\t\t\tvideo.src = resolved.url;\n`],
  ['\t\t\tif (!hoverEl || token !== requestToken || !media) return false;\n', `\t\t\tif (!hoverEl || token !== requestToken || !media) { ${H('installBlocked', '{ token, el: media }')} return false; } // IB09L\n\t\t\t${H('install', '{ token, el: media }')} // IB09L\n`],
  ['\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;\n\t\t\t\ttry { await image.decode(); }', `\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) { ${H('staleBlocked', '{ token, el: image }')} return; } // IB09L\n\t\t\t\ttry { await image.decode(); }`],
  ['\t\tasync function afterDwell(img, token) {\n', `\t\tasync function afterDwell(img, token) {\n\t\t\t${H('dwell', '{ token, current: token === requestToken }')} // IB09L\n`],
  ['\t\tfunction cancelPendingUpgrade() {\n\t\t\tconst media = pendingUpgradeMedia;\n', `\t\tfunction cancelPendingUpgrade() {\n\t\t\tconst media = pendingUpgradeMedia;\n\t\t\tif (media) ${H('cancel', '{ el: media }')} // IB09L\n`],
];
function instrument(patched) { let s = patched; for (const [a, b] of HOOKS) s = mustReplace(s, a, b); return s; }
function stripHooks(instrumented) { let s = instrumented; for (const [a, b] of HOOKS) s = mustReplace(s, b, a); return s; }

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function deriveMeta(meta) {
  const kept = meta.split('\n').filter((line) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(line));
  const out = [];
  for (const line of kept) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB09 200 ms Dwell Live Check (E stage)');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib09-dwell-live-check');
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
  const { meta, body: prodBody } = split(source);
  const prototypeBody = split(applyDwellPrototype(source, { dwellMs: DWELL_MS })).body;
  const body = instrument(prototypeBody);
  if (body.includes(POSTAMBLE_MARKER) || body.includes('IB07P_PRODUCTION_BODY')) throw new Error('marker or wrapper name collides with body');
  const bodySha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const postamble = fs.readFileSync(path.join(__dirname, 'ib09l_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
  if (!postamble.startsWith(POSTAMBLE_MARKER)) throw new Error('postamble must start with its marker');
  const text = deriveMeta(meta) + BODY_START + 'var IB09L_HOOK = null; // IB09L observer hook, assigned by the postamble\n' + WRAP_OPEN + body + WRAP_CLOSE
    + postamble.replace('__EXPECTED_BODY_SHA256__', bodySha).replace('__DWELL_MS__', String(DWELL_MS));
  return { text, body, bodySha, prodBody, prototypeBody, originalMeta: meta };
}

module.exports = { build, instrument, stripHooks, HOOKS, COMMIT, EXPECTED_PRODUCTION_BLOB, DWELL_MS, POSTAMBLE_MARKER, OUT };

if (require.main === module) {
  const { text } = build();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
