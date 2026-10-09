'use strict';
// Builds IB12_P1_e621_Tier0.user.js: the committed IB12-P1 production (P1_COMMIT,
// body UNCHANGED) inside the IB07P wrapper, followed by the E1 observe-only recorder
// with exactly the declared PATCHES below (probe identity and file name; a
// pass-through counter on Element.prototype.scrollIntoView so the close-time
// correction can be shown to happen once, after close; a count of scroll events
// after close). The E1 package and its recorder file are unchanged.
// Usage: node build_ib12_p1.cjs [--check]
const fs = require('fs');
const path = require('path');
const e1 = require('./build_ib12_e1.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const P1_COMMIT = 'ba6e600';
const P1_EXPECTED_BLOB = 'c6d6655fb6d38c6fb4c2e9bb59f47c756c461913';
const P1_BODY_SHA256 = '62f053761191678ab709b79025319d2be7794422b0f8f856422651a21882099f';
const OUT = path.join(__dirname, 'IB12_P1_e621_Tier0.user.js');

const PATCHES = [
  ["  const PROBE = 'ib12-e1-e621-tier0';\n", "  const PROBE = 'ib12-p1-e621-tier0';\n"],
  ["  const now = () => performance.now() - T0; // relative ms (never an absolute clock)\n",
    "  const now = () => performance.now() - T0; // relative ms (never an absolute clock)\n"
    + "  // [IB12-P1] production's close-time correction, counted pass-through (same arguments and return value).\n"
    + "  const sivCalls = [];\n"
    + "  const sivOrig = Element.prototype.scrollIntoView;\n"
    + "  if (typeof sivOrig === 'function') {\n"
    + "    Element.prototype.scrollIntoView = function observedScrollIntoView() {\n"
    + "      try { const ov = document.getElementById('be-viewer-overlay'); if (sivCalls.length < 20) sivCalls.push({ t: r1(now()), viewerOpen: !!ov && ov.style.display === 'flex', isCOrigin: this === lastOrigin, closed }); } catch (e) { err('scrollIntoView', e); }\n"
    + "      return sivOrig.apply(this, arguments);\n"
    + "    };\n"
    + "  }\n"],
  ['    productionLogErrors: 0, probeErrors: [], complete: false,\n', '    productionLogErrors: 0, scrollIntoViewCalls: null, scrollEventsAfterClose: 0, probeErrors: [], complete: false,\n'],
  ["  for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart']) {\n",
    "  window.addEventListener('scroll', () => { if (closed && !rec.complete) rec.scrollEventsAfterClose++; }, { passive: true });\n  for (const type of ['wheel', 'keydown', 'pointerdown', 'touchstart']) {\n"],
  ['      rec.production_body_identity = await sourceIdentity();\n', '      rec.scrollIntoViewCalls = sivCalls;\n      rec.production_body_identity = await sourceIdentity();\n'],
  ["'IB12-E1 RECORDED. Download the results (or copy the text) and save it as tests/results/ib12-e1-e621-tier0.json.'", "'IB12-P1 RECORDED. Download the results (or copy the text) and save it as tests/results/ib12-p1-e621-tier0.json.'"],
  ["a.download = 'ib12-e1-e621-tier0.json';", "a.download = 'ib12-p1-e621-tier0.json';"],
  ['window.__IB12E1_RESULT__ = text;', 'window.__IB12P1_RESULT__ = text;'],
  ['statusEl.textContent = `IB12-E1: ${text}`;', 'statusEl.textContent = `IB12-P1: ${text}`;'],
];
const patchPostamble = (t) => { let s = t; for (const [a, b] of PATCHES) s = mustReplace(s, a, b); return s; };

function buildP1() {
  return e1.build({
    commit: P1_COMMIT, expectedBlob: P1_EXPECTED_BLOB, expectedBodySha: P1_BODY_SHA256, postambleTransform: patchPostamble,
    name: '// @name         Booru Enhancer Extended — IB12 P1 e621 Tier-0 Viewer Return Confirmation',
    namespace: '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib12-p1-e621-tier0',
  });
}

module.exports = { buildP1, PATCHES, patchPostamble, P1_COMMIT, P1_EXPECTED_BLOB, P1_BODY_SHA256, OUT };

if (require.main === module) {
  const { text } = buildP1();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
