'use strict';
// Builds IB09_Production_Conformance.user.js: the committed IB09 P-stage
// production source at COMMIT (read from git, unpatched), instrumented with the
// same observe-only hooks as the E-stage live check (the dwell hook sits in
// production's dwell callback). It runs inside the IB07 wrapper, followed by
// the IB09P observer: the E-stage observer 1.3 (ib09l_postamble.js) with its
// labels renamed, each generation tagged with the G-HOVER qualified class
// (the card's IB08 rendition fact, read only), and a qualifiedClass report
// added (see POSTAMBLE_EDITS). Out-of-scope cards keep their previous hover
// path, so the pass criteria read qualifiedClass only.
// Production (Booru_Enhancer.user.js) is not modified.
// Pinning: removing the hook insertions reproduces the committed production body
// byte-for-byte (the verifier checks this), and the C00 in-page hash pins the
// executed body. Usage: node build_ib09_conformance.cjs [--check]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { split, BODY_START, WRAP_OPEN, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const live = require('./build_ib09_live_package.cjs');

const COMMIT = 'b9d133c';
const EXPECTED_PRODUCTION_BLOB = '22e843cbe27662fc27d17149534b055d7a249dae';
const DWELL_MS = 200;
const POSTAMBLE_MARKER = '/* IB09P PRODUCTION CONFORMANCE POSTAMBLE';
const HOSTS = ['e621.net', 'e926.net'];
const OUT = path.join(__dirname, 'IB09_Production_Conformance.user.js');
const REPO = path.resolve(__dirname, '../../..');
const H = (ev, data) => `typeof IB09L_HOOK === 'function' && IB09L_HOOK('${ev}', ${data});`;

// The E-stage hooks, except the dwell hook, which moves from the prototype's
// afterDwell() to production's dwell callback.
const DWELL_ANCHOR = '\t\t\t\t\tdwellTimer = null;\n\t\t\t\t\tif (token !== requestToken || BE.modules.viewer?.isOpen?.()) return;\n';
const HOOKS = live.HOOKS.filter(([a]) => !a.includes('afterDwell')).concat([
  [DWELL_ANCHOR, `\t\t\t\t\tdwellTimer = null;\n\t\t\t\t\t${H('dwell', '{ token, current: token === requestToken }')} // IB09L\n\t\t\t\t\tif (token !== requestToken || BE.modules.viewer?.isOpen?.()) return;\n`],
]);
function instrument(src) { let s = src; for (const [a, b] of HOOKS) s = mustReplace(s, a, b); return s; }
function stripHooks(src) { let s = src; for (const [a, b] of HOOKS) s = mustReplace(s, b, a); return s; }

// Observer: E-stage 1.3 plus option-B metrics. Every edit must match exactly once.
const POSTAMBLE_EDITS = [
  ['/* IB09L DWELL LIVE CHECK POSTAMBLE — test code, not production.\n * The body above is production (commit 91fa86d) with the qualified 200 ms dwell\n * prototype and observe-only IB09L_HOOK calls.',
    `${POSTAMBLE_MARKER} — test code, not production.\n * The body above is IB09 P-stage production (commit ${COMMIT}, unpatched) with\n * observe-only IB09L_HOOK calls. Derived from the E-stage observer 1.3.`],
  ["          cardImageLoadingAtEnter: !!img && img.complete === false,\n",
    "          cardImageLoadingAtEnter: !!img && img.complete === false,\n"
    + "          qualified: ['NATIVE_PREVIEW', 'OWNED_SAMPLE', 'OWNED_ORIGINAL'].includes(BE?.modules?.gallery?.getThumbRendition?.(card)), // IB09P: G-HOVER class (read only)\n"],
  ["      quickPassesStartingUpgrade: g.filter((x) => stay(x) !== null && stay(x) < DWELL_MS && up(x).length > 0).length,\n",
    "      quickPassesStartingUpgrade: g.filter((x) => stay(x) !== null && stay(x) < DWELL_MS && up(x).length > 0).length,\n"
    + "      // IB09P: the G-HOVER qualified class (IB08 still pattern). Option B: nothing - no overlay,\n"
    + "      // no upgrade, no hover-caused fetch - precedes dwell. Out-of-scope cards keep their previous path.\n"
    + "      qualifiedClass: (() => { const q = g.filter((x) => x.qualified); return {\n"
    + "        generations: q.length,\n"
    + "        quickPassesUnderDwell: q.filter((x) => stay(x) !== null && stay(x) < DWELL_MS).length,\n"
    + "        dwellReached: q.filter((x) => x.dwellT !== null).length,\n"
    + "        newMediaBeforeDwell: q.filter((x) => up(x).some((a) => a.t - x.enterT < DWELL_MS)).length,\n"
    + "        overlayBeforeDwell: q.filter((x) => x.assigns.some((a) => a.kind === 'thumb' && a.t - x.enterT < DWELL_MS)).length,\n"
    + "        overlayOffsetMs: dist(q.map((x) => { const a = x.assigns.find((y) => y.kind === 'thumb'); return a ? a.t - x.enterT : NaN; })),\n"
    + "        hoverFetchesBeforeDwell: q.filter((x) => { const e = attributeEntries(x); return e.UPGRADE + e.REUSE > 0; }).length,\n"
    + "        quickPassesStartingAnything: q.filter((x) => stay(x) !== null && stay(x) < DWELL_MS && x.assigns.length > 0).length,\n"
    + "      }; })(),\n"
    + "      outOfScopeGenerations: g.filter((x) => !x.qualified).length,\n"],
  ["probe: 'ib09l-dwell-live-check', version: '1.3.0'", "probe: 'ib09p-production-conformance', version: 'P-1.0.0'"],
  ["{ probe: 'ib09l-dwell-live-check', site: SITE, sanitationGuard: 'BLOCKED' }", "{ probe: 'ib09p-production-conformance', site: SITE, sanitationGuard: 'BLOCKED' }"],
];
function derivePostamble(source) {
  let s = source.replace(/\r\n/g, '\n');
  for (const [a, b] of POSTAMBLE_EDITS) s = mustReplace(s, a, b);
  // UI labels and element ids: IB09L -> IB09P (the hook name stays IB09L_HOOK).
  return s.replace(/IB09L(?!_HOOK)/g, 'IB09P').replace(/ib09l-/g, 'ib09p-');
}

function productionSource() {
  const blob = execFileSync('git', ['-C', REPO, 'rev-parse', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim();
  if (blob !== EXPECTED_PRODUCTION_BLOB) throw new Error('production blob at COMMIT is not the expected artifact');
  return execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function deriveMeta(meta) {
  const kept = meta.split('\n').filter((line) => !/^\/\/ @(match|connect|downloadURL|updateURL)\b/.test(line));
  const out = [];
  for (const line of kept) {
    if (/^\/\/ @name\s/.test(line)) out.push('// @name         Booru Enhancer Extended — IB09 Production Conformance (P stage)');
    else if (/^\/\/ @namespace\s/.test(line)) out.push('// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib09-production-conformance');
    else if (/^\/\/ @run-at\s/.test(line)) {
      for (const h of HOSTS) out.push(`// @match        *://${h}/*`);
      for (const h of HOSTS) out.push(`// @connect      ${h}`);
      out.push(line);
    } else out.push(line);
  }
  return out.join('\n');
}

// bodyTransform is for the verifier's fault controls only.
function build({ bodyTransform = null } = {}) {
  const source = productionSource();
  if (source.includes('\r')) throw new Error('production blob is not LF');
  const { meta, body: prodBody } = split(source);
  let body = instrument(prodBody);
  if (bodyTransform) body = bodyTransform(body);
  if (body.includes(POSTAMBLE_MARKER) || body.includes('IB07P_PRODUCTION_BODY')) throw new Error('marker or wrapper name collides with body');
  const bodySha = crypto.createHash('sha256').update(body, 'utf8').digest('hex');
  const postamble = derivePostamble(fs.readFileSync(path.join(__dirname, 'ib09l_postamble.js'), 'utf8'));
  const text = deriveMeta(meta) + BODY_START + 'var IB09L_HOOK = null; // IB09L observer hook, assigned by the postamble\n' + WRAP_OPEN + body + WRAP_CLOSE
    + postamble.replace('__EXPECTED_BODY_SHA256__', bodySha).replace('__DWELL_MS__', String(DWELL_MS));
  return { text, body, bodySha, prodBody };
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
