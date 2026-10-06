'use strict';
// Builds IB11_GPLAY_Recovery.user.js for the targeted DELIB recovery
// (U-mp4-DELIB, U-webm-DELIB; gplay_server.cjs --recovery). It is the evidence
// package IB11_GPLAY_Controlled.user.js (production 4d793a2 body unchanged,
// same recorder) with three runner-only patches, applied to the runner text
// and checked to match exactly once; the original package and
// gplay_postamble.js stay byte-identical:
//   1. prompts are hard to miss: a large centered panel above the viewer and
//      a tab title "ACTION NEEDED";
//   2. a prompt that is not clicked within 3 minutes makes the page INVALID: the
//      cell is not recorded as evidence, the error is posted, the panel says so
//      and the page does NOT advance (reload to retry);
//   3. DELIB requires actual playback before the Unmute prompt; otherwise the
//      page is INVALID.
// Distinct @name/@namespace (installs beside the original, never replaces it).
// Usage: node build_ib11_gplay_recovery.cjs [--check]
const fs = require('fs');
const path = require('path');
const b = require('./build_ib11_gplay.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');

const OUT = path.join(__dirname, 'IB11_GPLAY_Recovery.user.js');
const PROMPT_TIMEOUT_MS = 180000;
const BIG = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#000;color:#ff0;border:6px solid #ff0;padding:28px 36px;font:bold 26px/1.4 sans-serif;max-width:80vw;text-align:center;box-shadow:0 0 0 9999px rgba(0,0,0,.55)';
const NAME_FROM = '// @name         Booru Enhancer Extended — IB11 G-PLAY Controlled Viewer Playback Probe\n';
const NAME_TO = '// @name         Booru Enhancer Extended — IB11 G-PLAY DELIB Recovery\n';
const NS_FROM = '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-gplay-controlled\n';
const NS_TO = '// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib11-gplay-recovery\n';

const PATCHES = [
  ['    say(text); btn.textContent = label; btn.style.display = \'inline-block\'; promptOpen = true;\n',
    `    const prevCss = panel.style.cssText; const prevTitle = document.title;\n    panel.style.cssText = '${BIG}'; btn.style.fontSize = '30px'; btn.style.padding = '14px 40px'; document.title = '>>> ACTION NEEDED: ' + label + ' <<<';\n    say(text); btn.textContent = label; btn.style.display = 'inline-block'; promptOpen = true;\n`],
  ['    await waitFor(() => done, 120000);\n    btn.style.display = \'none\'; promptOpen = false;\n',
    `    await waitFor(() => done, ${PROMPT_TIMEOUT_MS});\n    btn.style.display = 'none'; promptOpen = false; panel.style.cssText = prevCss; document.title = prevTitle;\n    if (!done) throw new Error('PROMPT_TIMEOUT ' + label);\n`],
  ["      click(c.cards[0]); await waitFor(() => playing(current()), 6000); mark(playing(current()) ? 'playing' : 'not-playing');\n      const r = await promptClick(",
    "      click(c.cards[0]); await waitFor(() => playing(current()), 6000); mark(playing(current()) ? 'playing' : 'not-playing');\n      if (!playing(current())) throw new Error('DELIB_NOT_PLAYING');\n      const r = await promptClick("],
  ['  } catch (e) { out.error = String(e && e.message || e).slice(0, 300); }\n',
    "  } catch (e) { out.error = String(e && e.message || e).slice(0, 300); out.cells = out.cells.filter((x) => x.id !== R.cell); }\n"],
  ['    if (j.next) setTimeout(() => { location.href = j.next; }, 500);\n',
    "    if (out.error) { panel.style.cssText = '" + BIG + "'; say(`INVALID (${out.error}). This attempt is NOT evidence. Reload this page (F5) to retry.`); document.title = 'INVALID - reload to retry'; }\n    else if (j.next) setTimeout(() => { location.href = j.next; }, 500);\n"],
];

function buildRecovery({ bodyTransform = null } = {}) {
  const base = b.build({ bodyTransform });
  const post = fs.readFileSync(path.join(__dirname, 'gplay_postamble.js'), 'utf8').replace(/\r\n/g, '\n').replace('__EXPECTED_BODY_SHA256__', base.expectedSha);
  if (base.text.split(post).length !== 2) throw new Error('runner text not found exactly once in the base package');
  let patched = post;
  for (const [from, to] of PATCHES) patched = mustReplace(patched, from, to);
  let text = base.text.replace(post, patched);
  text = mustReplace(mustReplace(text, NAME_FROM, NAME_TO), NS_FROM, NS_TO);
  return { text, base, patched, original: post };
}

module.exports = { buildRecovery, OUT, PROMPT_TIMEOUT_MS, PATCHES };

if (require.main === module) {
  const { text } = buildRecovery();
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    console.log(current === text ? 'DERIVED_SCRIPT_UP_TO_DATE' : 'DERIVED_SCRIPT_STALE');
    if (current !== text) process.exitCode = 1;
  } else { fs.writeFileSync(OUT, text); console.log('WROTE', path.basename(OUT)); }
}
