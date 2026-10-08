'use strict';
// IB11-P6 (V-D4) permanent regression: automatic configured Fit must fit the
// RENDERED orientation. At an odd quarter turn (90 / 270 / -90 / -270 deg) the
// media's intrinsic width and height are exchanged for the Fit geometry; at an
// even quarter turn (0 / 180 deg) they are not. fit-width / fit-height keep
// their meaning relative to the rendered orientation; original-size stays 1:1;
// a resize does not refit in manual zoom. The expected scale is computed in
// the test from the stage size, the natural size and the rotation (the same
// rule for every case: available = stage - 24 per axis), never from a
// fixture-specific constant. Rotation uses the viewer's own buttons; the
// refit is the production window-resize handler.
//
// Every check runs on three sources:
//   repair  - the working-tree production (must PASS);
//   prior   - 24ee7c2 / blob 68e37d1, the pre-P6 artifact (the V-D4 checks
//             must FAIL there: known-failure oracle);
//   mutant  - the repair with rotation-blind dimensions restored (fault
//             control: the V-D4 checks must FAIL).
// Preservation checks must hold on all three. The previous P repairs are
// covered by their own regressions (P1-P5), run against the same production.
// Usage: node tests/host/ib11/p6_vd4_rotated_fit.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));
const { mustReplace } = require(path.resolve(__dirname, '../ib09/dwell_prototype.cjs'));

const REPAIR = h.productionSource();
const PRIOR = hh.sourceAt('24ee7c2', '68e37d1c9071d2ae78ae44b31f0082cd51010992');
const MUTANT = mustReplace(REPAIR, '\t\t\tconst width = quarterTurns ? intrinsic.height : intrinsic.width;\n\t\t\tconst height = quarterTurns ? intrinsic.width : intrinsic.height;\n',
  '\t\t\tconst width = intrinsic.width;\n\t\t\tconst height = intrinsic.height;\n');
const M = 'https://static.example';
const vset = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [`be:setting:viewer.${k}`, JSON.stringify(v)]));

async function session(source, { settings = {}, n = 3 } = {}) {
  let clock = null; const st = { stageW: 1000, stageH: 800 };
  const fx = hh.listing('e621.net', n);
  const c = h.load({ url: fx.url, html: fx.html, source, settings, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    w.Element.prototype.setPointerCapture = function () {};
    const gbr = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList && this.classList.contains('be-viewer-stage')) return { x: 0, y: 0, left: 0, top: 0, width: st.stageW, height: st.stageH, right: st.stageW, bottom: st.stageH };
      return gbr.call(this);
    };
    for (const [P, wk, hk] of [[w.HTMLImageElement.prototype, 'naturalWidth', 'naturalHeight'], [w.HTMLVideoElement.prototype, 'videoWidth', 'videoHeight']]) {
      Object.defineProperty(P, wk, { configurable: true, get() { return this.__nat ? this.__nat[0] : 0; } });
      Object.defineProperty(P, hk, { configurable: true, get() { return this.__nat ? this.__nat[1] : 0; } });
    }
    const MP = w.HTMLMediaElement.prototype; MP.play = function () { return Promise.resolve(); }; MP.pause = function () {}; MP.load = function () {};
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document; const BE = c.BE;
  const media = () => doc.querySelector('.be-viewer-stage img, .be-viewer-stage video');
  const a = {
    w, doc, BE, st,
    wait: (ms) => clock.advance(ms),
    async open(nat, id = 970) { BE.modules.viewer.open({ id: String(id), originalUrl: `${M}/o/${id}.png`, sampleUrl: '', previewUrl: '', mediaType: 'image', postUrl: `https://e621.net/posts/${id}`, width: 0, height: 0 }, {}, {}); await clock.advance(0);
      const el = media(); el.__nat = nat; el.dispatchEvent(new w.Event('load')); await clock.advance(50); },
    async btn(title) { const b = [...doc.querySelectorAll('.be-viewer-btn')].find((x) => x.title.startsWith(title)); b.click(); await clock.advance(0); },
    async resize(wd, ht) { st.stageW = wd; st.stageH = ht; w.dispatchEvent(new w.Event('resize')); await clock.advance(150); },
    async key(k) { doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); await clock.advance(0); },
    media,
    tf: () => { const s = media()?.style.transform || ''; const g = (re) => { const m = re.exec(s); return m ? Number(m[1]) : null; };
      return { tx: g(/translate\((-?[\d.]+)px/), ty: g(/translate\(-?[\d.]+px, (-?[\d.]+)px/), scale: g(/ scale\((-?[\d.]+)\)/), rot: g(/rotate\((-?[\d.]+)deg\)/), fx: g(/scaleX\((-?[\d.]+)\)/), fy: g(/scaleY\((-?[\d.]+)\)/) }; },
  };
  return a;
}

// The Fit rule, stated once: rendered dimensions (exchanged at odd quarter turns) against the stage minus 24 px per axis.
function expected(mode, [nw, nh], rot, [sw, sh]) {
  const odd = Math.abs(Math.round(rot / 90)) % 2 === 1;
  const rw = odd ? nh : nw; const rh = odd ? nw : nh;
  const aw = Math.max(1, sw - 24); const ah = Math.max(1, sh - 24);
  if (mode === 'original-size') return 1;
  if (mode === 'fit-width') return Math.max(0.01, aw / rw);
  if (mode === 'fit-height') return Math.max(0.01, ah / rh);
  return Math.max(0.01, Math.min(aw / rw, ah / rh));
}
const near = (x, y) => x !== null && Math.abs(x - y) < 1e-9;
const footprint = ([nw, nh], rot, s) => { const odd = Math.abs(Math.round(rot / 90)) % 2 === 1; return { w: (odd ? nh : nw) * s, h: (odd ? nw : nh) * s }; };
const inside = (fp, [sw, sh]) => fp.w <= sw - 24 + 1e-6 && fp.h <= sh - 24 + 1e-6;

// Rotate with the viewer buttons: right n times (n<0: left |n| times); then a real resize triggers the automatic refit.
async function rotatedRefit(src, { mode = 'fit-both', nat = [2000, 1000], turns = 1, stage = [1000, 800] } = {}) {
  const a = await session(src, { settings: vset({ fitMode: mode }) }); await a.open(nat);
  for (let i = 0; i < Math.abs(turns); i++) await a.btn(turns > 0 ? 'Rotate right' : 'Rotate left');
  await a.resize(...stage); const t = a.tf();
  return { a, t, rot: turns * 90, exp: expected(mode, nat, turns * 90, stage) };
}
const fitsRotated = async (src, opt) => { const { t, rot, exp } = await rotatedRefit(src, opt); const nat = opt.nat || [2000, 1000]; const stage = opt.stage || [1000, 800];
  return t.rot === rot && near(t.scale, exp) && ((opt.mode || 'fit-both') !== 'fit-both' || inside(footprint(nat, rot, t.scale), stage)); };

// [name, fn, preserve]: preserve=false -> V-D4 check (must fail on prior and mutant)
const CHECKS = [
  ['P6-1 [V-D4] fit-both, 2000x1000 rotated 90 deg, resize to 1000x800: scale from the exchanged dimensions; the rotated footprint is inside the available stage', (src) => fitsRotated(src, { turns: 1 }), false],
  ['P6-2 [V-D4] fit-both at 270 deg (three right turns), -90 deg (one left turn) and -270 deg (three left turns): exchanged dimensions, inside the stage', async (src) => (await fitsRotated(src, { turns: 3 })) && (await fitsRotated(src, { turns: -1 })) && (await fitsRotated(src, { turns: -3 })), false],
  ['P6-3 [V-D4] fit-width at 90 deg: the rendered width (intrinsic height) fills the available width', (src) => fitsRotated(src, { mode: 'fit-width', turns: 1 }), false],
  ['P6-4 [V-D4] fit-height at 90 deg: the rendered height (intrinsic width) fills the available height', (src) => fitsRotated(src, { mode: 'fit-height', turns: 1 }), false],
  ['P6-5 [V-D4] two successive resizes at 90 deg (1000x800, then 1400x700): each refit uses the exchanged dimensions and stays inside the stage', async (src) => {
    const { a, t } = await rotatedRefit(src, { turns: 1, stage: [1000, 800] }); const ok1 = near(t.scale, expected('fit-both', [2000, 1000], 90, [1000, 800]));
    await a.resize(1400, 700); const t2 = a.tf(); return ok1 && t2.rot === 90 && near(t2.scale, expected('fit-both', [2000, 1000], 90, [1400, 700])) && inside(footprint([2000, 1000], 90, t2.scale), [1400, 700]); }, false],
  ['P6-6 [V-D4] a portrait 1000x2000 image at 90 deg (fit-both, 1000x800): exchanged dimensions (not only the landscape fixture)', (src) => fitsRotated(src, { nat: [1000, 2000], turns: 1 }), false],
  ['P6-7 [preserved] 0 deg: fit-both / fit-width / fit-height / original-size after a resize equal the ordinary unrotated calculation', async (src) => {
    for (const mode of ['fit-both', 'fit-width', 'fit-height', 'original-size']) { const { t, exp } = await rotatedRefit(src, { mode, turns: 0 }); if (!(t.rot === 0 && near(t.scale, exp))) return false; } return true; }, true],
  ['P6-8 [preserved] 180 deg (two right turns): every mode equals the unrotated calculation (no exchange)', async (src) => {
    for (const mode of ['fit-both', 'fit-width', 'fit-height', 'original-size']) { const { t } = await rotatedRefit(src, { mode, turns: 2 }); if (!(t.rot === 180 && near(t.scale, expected(mode, [2000, 1000], 0, [1000, 800])))) return false; } return true; }, true],
  ['P6-9 [preserved] original-size stays 1:1 at 90 and 270 deg after a resize', async (src) => (await rotatedRefit(src, { mode: 'original-size', turns: 1 })).t.scale === 1 && (await rotatedRefit(src, { mode: 'original-size', turns: 3 })).t.scale === 1, true],
  ['P6-10 [preserved] initial open: the loaded unrotated image is fitted with the ordinary calculation', async (src) => { const a = await session(src); await a.open([2000, 1000]); const t = a.tf(); return t.rot === 0 && near(t.scale, expected('fit-both', [2000, 1000], 0, [1000, 800])); }, true],
  ['P6-11 [preserved] rotating alone does not refit (the scale is unchanged until a resize)', async (src) => { const a = await session(src); await a.open([2000, 1000]); const s0 = a.tf().scale; await a.btn('Rotate right'); const t = a.tf(); return t.rot === 90 && t.scale === s0; }, true],
  ['P6-12 [preserved] manual zoom and pan survive a resize while rotated: no automatic refit; rotation kept', async (src) => {
    const a = await session(src); await a.open([2000, 1000]); await a.btn('Rotate right'); await a.btn('Zoom in'); const z = a.tf().scale;
    const el = a.media(); el.dispatchEvent(new a.w.MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 })); el.dispatchEvent(new a.w.MouseEvent('pointermove', { bubbles: true, clientX: 130, clientY: 110 })); el.dispatchEvent(new a.w.MouseEvent('pointerup', { bubbles: true }));
    await a.wait(0); const p = a.tf(); await a.resize(1400, 700); const t = a.tf(); return p.tx === 30 && p.ty === 10 && t.scale === z && t.rot === 90 && t.tx === p.tx && t.ty === p.ty; }, true],
  ['P6-13 [preserved] flips are kept through a rotated refit (transform composition unchanged)', async (src) => {
    const a = await session(src); await a.open([2000, 1000]); await a.btn('Flip horizontal'); await a.btn('Rotate right'); await a.resize(1000, 800); const t = a.tf(); return t.fx === -1 && t.fy === 1 && t.rot === 90; }, true],
  ['P6-14 [preserved] E6 unchanged: the Fit button resets rotation and flips, then fits the unrotated image', async (src) => {
    const a = await session(src); await a.open([2000, 1000]); await a.btn('Rotate right'); await a.btn('Flip horizontal'); await a.btn('Fit'); const t = a.tf();
    return t.rot === 0 && t.fx === 1 && near(t.scale, expected('fit-both', [2000, 1000], 0, [1000, 800])); }, true],
  ['P6-15 [preserved] opening another post resets rotation to 0 and fits it unrotated (navigation/open semantics unchanged)', async (src) => {
    const a = await session(src); await a.open([2000, 1000]); await a.btn('Rotate right'); await a.open([1600, 900], 971); const t = a.tf(); return t.rot === 0 && near(t.scale, expected('fit-both', [1600, 900], 0, [1000, 800])); }, true],
];

async function main() {
  const results = [];
  const blob = h.gitBlobId(REPAIR);
  for (const [name, fn, preserve] of CHECKS) {
    let repair = false; let prior = null; let mutant = null; let err = null;
    try { repair = !!(await fn(REPAIR)); prior = !!(await fn(PRIOR)); mutant = !!(await fn(MUTANT)); } catch (e) { err = String(e && e.message || e); }
    const pass = !err && repair && (preserve ? prior === true && mutant === true : prior === false && mutant === false);
    results.push({ name, repair, prior, mutant, pass, err });
  }
  let failed = 0;
  for (const r of results) { if (!r.pass) failed++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [repair ${r.repair}, prior 24ee7c2 ${r.prior}, mutant ${r.mutant}]${r.err ? ` -- ${r.err}` : ''}`); }
  console.log(`\n${results.length - failed}/${results.length} checks passed (production blob ${blob})`);
  fs.writeFileSync(path.join(__dirname, 'p6-vd4-rotated-fit-result.json'), `${JSON.stringify({ probe: 'ib11-p6-vd4', productionBlob: blob, prior: '24ee7c2', checks: results.length, passed: results.length - failed, results: results.map(({ err, ...r }) => r) }, null, 1)}\n`);
  process.exitCode = failed ? 1 : 0;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
