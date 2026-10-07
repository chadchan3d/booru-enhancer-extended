'use strict';
// IB11-P1 (V-D8) permanent regression: the viewer's "Open native post" failure
// fallback must be pointer-interactive while the surrounding media-state
// overlay stays non-interactive, and stage clicks elsewhere must still close
// the viewer.
//
// jsdom computes inherited `pointer-events`; a small layout stub gives the
// overlay/stage/state/link boxes, and elementFromPoint() returns the deepest
// element under the point whose computed pointer-events is not 'none' (the
// browser hit-testing rule). Every check runs on three sources:
//   repair    - the working-tree production (must PASS);
//   baseline  - 4d793a2 / blob 002bdfd, the pre-repair artifact (the V-D8
//               checks must FAIL there: known-failure oracle);
//   mutant    - the repair with the link's pointer-events declaration removed
//               (fault control: must FAIL).
// Real-browser hit-testing is qualified separately (tests/browser/ib11, P1
// probe).
// Usage: node tests/host/ib11/p1_native_link.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const BASELINE = hh.sourceAt('4d793a2', '002bdfd1a88adf8ed851df7ed768e6189e2bc958');
const MUTANT = mustReplace(REPAIR, "text-decoration:underline;pointer-events:auto;';", "text-decoration:underline;';");

const BOX = { overlay: [0, 0, 1000, 845], stage: [0, 0, 1000, 800], state: [420, 388, 200, 24], link: [520, 392, 80, 16] };
async function session(source) {
  let clock = null;
  const fx = hh.listing('e621.net', 3);
  const c = h.load({ url: fx.url, html: fx.html, source, settings: {}, setup: (w) => {
    clock = hh.installFakeClock(w);
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    const R = ([x, y, wd, ht]) => ({ x, y, left: x, top: y, width: wd, height: ht, right: x + wd, bottom: y + ht });
    const orig = w.Element.prototype.getBoundingClientRect;
    w.Element.prototype.getBoundingClientRect = function () {
      const ov = w.document.querySelector('#be-viewer-overlay');
      if (!this.isConnected || !ov || ov.style.display !== 'flex') return orig.call(this);
      if (this === ov) return R(BOX.overlay);
      if (this.classList.contains('be-viewer-stage')) return R(BOX.stage);
      if (this.classList.contains('be-viewer-native-fallback')) return R(BOX.link);
      if (this.classList.contains('be-media-state')) return R(BOX.state);
      return orig.call(this);
    };
    w.document.elementFromPoint = (x, y) => {
      const hits = [...w.document.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
      const depth = (el) => { let n = 0; for (let a = el; a; a = a.parentElement) n++; return n; };
      hits.sort((a, b) => depth(b) - depth(a));
      return hits.find((el) => w.getComputedStyle(el).pointerEvents !== 'none') || w.document.body;
    };
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document;
  // A real media failure through the production gallery path.
  const img = doc.querySelector('article img');
  img.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0);
  const media = doc.querySelector('.be-viewer-stage img, .be-viewer-stage video');
  media.dispatchEvent(new w.Event('error')); await clock.advance(50);
  const link = doc.querySelector('.be-viewer-native-fallback');
  const state = doc.querySelector('.be-media-state');
  const clickAt = (x, y) => { const t = doc.elementFromPoint(x, y); const e = new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }); t.dispatchEvent(e); return { target: t, prevented: e.defaultPrevented }; };
  return { w, doc, clock, c, link, state, nativeHref: doc.querySelector('article a').href, clickAt, isOpen: () => c.BE.modules.viewer.isOpen() };
}

const CHECKS = [
  ['P1-1 failure fallback present: "Open native post" to the card native post, inside the failure state', async (src) => { const s = await session(src);
    return !!s.link && s.link.textContent === 'Open native post' && s.link.href === s.nativeHref && !!s.state && /^Media failed to load/.test(s.state.textContent); }, { baseline: true }],
  ['P1-2 the fallback anchor is pointer-interactive (computed pointer-events not none) while the media-state container stays pointer-events:none', async (src) => { const s = await session(src);
    return s.w.getComputedStyle(s.link).pointerEvents !== 'none' && s.w.getComputedStyle(s.state).pointerEvents === 'none'; }, { baseline: false }],
  ['P1-3 hit-testing at the centre of the visible link resolves to the fallback anchor', async (src) => { const s = await session(src);
    return s.doc.elementFromPoint(BOX.link[0] + BOX.link[2] / 2, BOX.link[1] + BOX.link[3] / 2) === s.link; }, { baseline: false }],
  ['P1-4 a click on the displayed words targets the anchor, is not prevented (native navigation proceeds) and is not treated as a stage-close click (viewer stays open)', async (src) => { const s = await session(src);
    const r = s.clickAt(BOX.link[0] + BOX.link[2] / 2, BOX.link[1] + BOX.link[3] / 2); await s.clock.advance(0);
    return r.target === s.link && !r.prevented && s.isOpen(); }, { baseline: false }],
  ['P1-5 a click elsewhere on the stage still closes the viewer', async (src) => { const s = await session(src);
    const r = s.clickAt(100, 100); await s.clock.advance(0); return r.target.classList.contains('be-viewer-stage') && !s.isOpen(); }, { baseline: true }],
  ['P1-6 failure-state presentation unchanged apart from pointer-events (text, underline, spacing, colour inheritance)', async (src) => { const s = await session(src);
    const st = s.link.style; return st.marginLeft === '8px' && st.color === 'inherit' && st.textDecoration === 'underline' && s.state.firstChild && s.state.textContent.startsWith('Media failed to load'); }, { baseline: true }],
];

async function main() {
  const results = [];
  const blob = h.gitBlobId(REPAIR);
  for (const [name, fn, oracle] of CHECKS) {
    let repair = false; let base = null; let mut = null; let err = null;
    try { repair = !!(await fn(REPAIR)); base = !!(await fn(BASELINE)); mut = !!(await fn(MUTANT)); } catch (e) { err = String(e && e.message || e); }
    // Baseline oracle: V-D8 checks must FAIL on 4d793a2; preservation checks must PASS there too.
    const baselineOk = oracle.baseline ? base === true : base === false;
    // Fault control: the mutant restores the broken pointer behavior; V-D8 checks must catch it.
    const mutantOk = oracle.baseline ? true : mut === false;
    results.push({ name, repair, baseline: base, mutant: mut, pass: repair && baselineOk && mutantOk && !err, err });
  }
  let failed = 0;
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, baseline 4d793a2 ${r.baseline}, mutant ${r.mutant}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p1-native-link-result.json'), `${JSON.stringify({ probe: 'ib11-p1-native-link', productionBlob: blob, baseline: '4d793a2', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
