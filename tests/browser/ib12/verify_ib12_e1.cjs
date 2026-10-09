'use strict';
// Local qualification of the IB12-E1 e621 Tier-0 observer package (no real
// browser - the real run belongs to the operator):
//   1. static: package current; executed body byte-identical to production
//      ac3c9e8 (blob db54843, body d64df2a6...8127) = the working tree; scope
//      e621.net only; the postamble makes no history, scroll, focus, network,
//      storage, settings or event-cancelling call; results path git-ignored;
//   2. recorder smoke (jsdom, a FAKE viewer with the production close semantics:
//      focus the origin with preventScroll, no scroll): the observer records the
//      intended values, sanitizes them (no URL, no post ID) and recognizes a
//      completed run -> PREMISE ESTABLISHED; a fake that scrolls C into view ->
//      BROWSER BRINGS C INTO VIEW; a run that never leaves A -> INVALID;
//   3. evaluator: identity mismatch, post-close input and focus elsewhere are not
//      a PASS.
// Usage: node verify_ib12_e1.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const B = require('./build_ib12_e1.cjs');
const { evaluate } = require('./evaluate_ib12_e1.cjs');
const { WRAP_OPEN, WRAP_CLOSE, split } = require('../ib07/build_production_conformance.cjs');
const { JSDOM } = require(require.resolve('jsdom', { paths: [path.resolve(__dirname, '../../host/ib07')] }));

const REPO = path.resolve(__dirname, '../../..');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 900) });
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---- 1. static ----
const built = B.build();
const PKG = fs.readFileSync(B.OUT, 'utf8');
check('package matches a fresh build', PKG === built.text);
const execBody = PKG.slice(PKG.indexOf(WRAP_OPEN) + WRAP_OPEN.length, PKG.indexOf(WRAP_CLOSE));
const workTree = fs.readFileSync(path.join(REPO, 'Booru_Enhancer.user.js'), 'utf8').replace(/\r\n/g, '\n');
check('executed body = production ac3c9e8 byte for byte (blob db54843, body d64df2a6…8127) = the working tree; no hooks',
  execBody === split(git('show', `${B.COMMIT}:Booru_Enhancer.user.js`)).body && sha(execBody) === B.EXPECTED_BODY_SHA256
  && git('rev-parse', `${B.COMMIT}:Booru_Enhancer.user.js`).trim() === B.EXPECTED_PRODUCTION_BLOB && split(workTree).body === execBody);
const meta = split(PKG).meta;
const metaLines = (k) => meta.split('\n').filter((l) => new RegExp(`^// @${k}\\s`).test(l));
const grants = (m) => m.split('\n').filter((l) => /^\/\/ @grant\s/.test(l)).join('\n');
check('scope: @match e621.net only; distinct name/namespace; grants unchanged from production',
  metaLines('match').join() === '// @match        *://e621.net/*' && /IB12 E1 e621 Tier-0/.test(metaLines('name').join()) && /ib12-e1-e621-tier0/.test(metaLines('namespace').join())
  && grants(meta) === grants(split(workTree).meta), metaLines('match').join());
const post = built.postamble;
const forbidden = /history\.|pushState|replaceState|scrollTo|scrollBy|scrollIntoView|location\.(href|assign|replace)\s*=|\.focus\(|fetch\(|XMLHttpRequest|GM_xmlhttpRequest|GM_setValue|GM_download|localStorage|sessionStorage|document\.cookie|preventDefault|stopPropagation|BE\.settings\.set/;
check('postamble: no history, scroll, focus, network, storage, settings or event-cancelling call', !forbidden.test(post), (post.match(forbidden) || [''])[0]);
check('postamble: BE.modules.viewer.open and BE.log.error wrapped pass-through (same arguments and return value)',
  /const ret = openOrig\.apply\(this, arguments\);[\s\S]*?return ret;/.test(post) && /return logOrig\.apply\(this, arguments\);/.test(post));
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
check('results path tests/results/ib12-e1-e621-tier0.json is git-ignored', ign('tests/results/ib12-e1-e621-tier0.json'));

// ---- 2. recorder smoke (jsdom, fake viewer) ----
const COLS = 5; const ROW = 300; const COLW = 200; const VH = 900; const N = 40;
const ID = (i) => String(5000000 + i * 7919); // stand-in 7-digit post IDs (the leak guard must keep them out)
function page() {
  const arts = Array.from({ length: N }, (_, i) => `<article class="thumbnail" data-id="${ID(i)}"><a class="thm-link" href="/posts/${ID(i)}"><img src="/p/${i}.jpg"></a></article>`).join('');
  return `<!doctype html><html><body data-user-is-anonymous="true"><div id="posts-container">${arts}</div></body></html>`;
}
async function run({ steps, scrollOnClose = false, bodyText = '// fake production body\n', expected = null }) {
  const dom = new JSDOM(page(), { url: 'https://e621.net/posts', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; const d = w.document;
  let sy = 0;
  Object.defineProperty(w, 'scrollY', { configurable: true, get: () => sy });
  Object.defineProperty(w, 'innerHeight', { configurable: true, value: VH });
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: COLS * COLW });
  Object.defineProperty(w, 'crypto', { configurable: true, value: webcrypto });
  w.TextEncoder = TextEncoder;
  w.GM_info = { scriptHandler: 'jsdom-smoke', version: '0' };
  const arts = [...d.querySelectorAll('article')];
  const geo = (el) => { const art = el.closest('article'); const i = arts.indexOf(art); if (i < 0) return null; return { top: Math.floor(i / COLS) * ROW + 10, left: (i % COLS) * COLW, w: COLW - 10, h: ROW - 20 }; };
  w.Element.prototype.getBoundingClientRect = function rect() {
    const g = geo(this); if (!g) return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 };
    const top = g.top - sy; return { top, left: g.left, bottom: top + g.h, right: g.left + g.w, width: g.w, height: g.h };
  };
  // the fake production surface: adapter reads + a viewer with production's close semantics
  const overlay = d.createElement('div'); overlay.id = 'be-viewer-overlay'; overlay.style.display = 'none';
  const closeBtn = d.createElement('button'); overlay.appendChild(closeBtn); d.body.appendChild(overlay);
  let origin = null; let onNext = null; let current = -1;
  w.BE = {
    adapters: { active: {
      getThumbElements: (root) => [...root.querySelectorAll('article.thumbnail img')],
      getThumbWrapper: (img) => img.closest('article'),
      getThumbPostId: (img) => img.closest('article').getAttribute('data-id'),
    } },
    log: { error() {} },
    modules: { viewer: {
      open(post, nav, ctx) { overlay.style.display = 'flex'; origin = ctx.origin; onNext = nav.next; closeBtn.focus(); return true; },
    } },
  };
  d.addEventListener('keydown', (e) => {
    if (overlay.style.display !== 'flex') return;
    if (e.key === 'ArrowRight') onNext && onNext();
    if (e.key === 'Escape') {
      overlay.style.display = 'none';
      if (scrollOnClose) sy = geo(origin).top - 100; // what a browser would do if focus scrolled C into view
      origin.focus({ preventScroll: true });
    }
  });
  const openCard = (i) => { current = i; const a = arts[i].querySelector('a'); w.BE.modules.viewer.open({ id: ID(i) }, { next: () => openCard(current + 1) }, { origin: a }); };
  const text = `const IB07P_PRODUCTION_BODY = function () {\n${bodyText}};\n` + post.replace('__EXPECTED_BODY_SHA256__', expected || sha(bodyText));
  w.eval(text);
  await sleep(1100); // setup runs 800 ms after load
  const marked = d.querySelectorAll('div[aria-hidden="true"]').length;
  openCard(0);
  for (let k = 0; k < steps; k++) d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await sleep(50);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(1600);
  const raw = w.__IB12E1_RESULT__ || null;
  const shown = !!d.getElementById('ib12e1-result');
  w.close();
  return { raw, doc: raw ? JSON.parse(raw) : null, marked, shown };
}

async function main() {
  const a = await run({ steps: 15 });
  const r = a.doc ? evaluate(clone(a.doc)) : null;
  check('smoke: a completed run is recorded and shown (marker and status drawn; result box after the measurement)', a.doc && a.doc.complete && a.shown && a.marked >= 2, JSON.stringify(a.doc).slice(0, 400));
  check('smoke: intended values recorded (identity, runtime, start scrollY, A and C ordinals and rects, before-close and 4 after-close snapshots with focus facts)',
    a.doc && a.doc.production_body_identity === 'MATCH_EXPECTED_ARTIFACT' && a.doc.runtime && a.doc.startScrollY === 0 && a.doc.A.ordinal === 0 && a.doc.C.ordinal === 15 && a.doc.A.rect && a.doc.C.rect
    && a.doc.beforeClose && a.doc.afterClose.map((s) => s.label).join() === 'sync,frame,250ms,1000ms' && a.doc.afterClose.every((s) => s.focus && 'isCOrigin' in s.focus), JSON.stringify(a.doc && a.doc.afterClose));
  check('smoke: sanitized - no URL and no post ID in the result', a.raw && !/https?:\/\//.test(a.raw) && !Array.from({ length: N }, (_, i) => ID(i)).some((v) => a.raw.includes(v)) && !/\/posts\//.test(a.raw));
  check('smoke: production close semantics (focus to C, no scroll) -> PREMISE ESTABLISHED', r && r.verdict === 'PREMISE ESTABLISHED', JSON.stringify(r));
  const b = await run({ steps: 15, scrollOnClose: true });
  const rb = b.doc ? evaluate(clone(b.doc)) : null;
  check('smoke: a browser that scrolls C into view on close -> BROWSER BRINGS C INTO VIEW (not a PASS)', rb && rb.verdict === 'BROWSER BRINGS C INTO VIEW', JSON.stringify(rb));
  const c = await run({ steps: 0 });
  const rc = c.doc ? evaluate(clone(c.doc)) : null;
  check('smoke: closing on A (no viewer navigation) -> INVALID', rc && rc.verdict === 'INVALID', JSON.stringify(rc));
  const m = await run({ steps: 15, expected: '0'.repeat(64) });
  check('smoke: an executed body that is not the expected artifact -> identity MISMATCH -> INVALID', m.doc && m.doc.production_body_identity === 'MISMATCH' && evaluate(clone(m.doc)).verdict === 'INVALID', JSON.stringify(m.doc && m.doc.production_body_identity));
  { const dd = clone(a.doc); dd.inputAfterClose = 1; check('evaluator: operator input after close -> INVALID', evaluate(dd).verdict === 'INVALID'); }
  { const dd = clone(a.doc); dd.afterClose.forEach((s) => { s.focus.isCOrigin = false; s.focus.insideC = false; }); check('evaluator: focus not returned to C -> NOT ESTABLISHED', evaluate(dd).verdict === 'NOT ESTABLISHED'); }

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB12_E1_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib12-e1-verification', commit: B.COMMIT, blob: B.EXPECTED_PRODUCTION_BLOB, bodySha256: B.EXPECTED_BODY_SHA256, packageSha256: sha(PKG), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
