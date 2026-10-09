'use strict';
// Local qualification of the IB12-P1 confirmation package (no real browser):
//   1. static: package current; executed body byte-identical to the committed P1
//      production (= the working tree); recorder = the E1 recorder + exactly the
//      declared P1 patches; the E1 package unchanged; e621-only scope; the only
//      new reference to scrollIntoView is the pass-through counter;
//   2. recorder smoke (jsdom, FAKE viewers): P1 close semantics (one nearest-edge
//      correction at close, focus C) -> P1 TIER0 QUALIFIED; the pre-P1 semantics
//      (focus C, no scroll) -> NOT QUALIFIED; a second correction 300 ms later ->
//      NOT QUALIFIED; sanitized output.
// Usage: node verify_ib12_p1.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const e1b = require('./build_ib12_e1.cjs');
const P = require('./build_ib12_p1.cjs');
const { evaluate } = require('./evaluate_ib12_p1.cjs');
const { WRAP_OPEN, WRAP_CLOSE, split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const { JSDOM } = require(require.resolve('jsdom', { paths: [path.resolve(__dirname, '../../host/ib07')] }));

const REPO = path.resolve(__dirname, '../../..');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 900) });
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. static ----
const built = P.buildP1();
const PKG = fs.readFileSync(P.OUT, 'utf8');
check('package matches a fresh build', PKG === built.text);
const execBody = PKG.slice(PKG.indexOf(WRAP_OPEN) + WRAP_OPEN.length, PKG.indexOf(WRAP_CLOSE));
const workTree = fs.readFileSync(path.join(REPO, 'Booru_Enhancer.user.js'), 'utf8').replace(/\r\n/g, '\n');
check(`executed body = committed P1 production ${P.P1_COMMIT} byte for byte (blob ${P.P1_EXPECTED_BLOB.slice(0, 7)}) = the working tree`,
  execBody === split(git('show', `${P.P1_COMMIT}:Booru_Enhancer.user.js`)).body && sha(execBody) === P.P1_BODY_SHA256 && git('rev-parse', `${P.P1_COMMIT}:Booru_Enhancer.user.js`).trim() === P.P1_EXPECTED_BLOB && split(workTree).body === execBody);
const e1Post = fs.readFileSync(path.join(__dirname, 'ib12e1_postamble.js'), 'utf8').replace(/\r\n/g, '\n');
let patched = e1Post; for (const [a, b] of P.PATCHES) patched = mustReplace(patched, a, b);
check('recorder = the E1 recorder + exactly the declared P1 patches', PKG.slice(PKG.indexOf(WRAP_CLOSE) + WRAP_CLOSE.length) === patched.replace('__EXPECTED_BODY_SHA256__', P.P1_BODY_SHA256));
check('the E1 package is unchanged (439bdd87…6d0a; fresh build identical)', sha(fs.readFileSync(e1b.OUT)) === '439bdd873263fc146c5447f09449fdedbafc2aa3e375c1e0a6586a013aa66d0a' && fs.readFileSync(e1b.OUT, 'utf8') === e1b.build().text);
const meta = split(PKG).meta;
check('scope: @match e621.net only; distinct name/namespace', meta.split('\n').filter((l) => /^\/\/ @match\s/.test(l)).join() === '// @match        *://e621.net/*' && /IB12 P1 e621 Tier-0/.test(meta) && /ib12-p1-e621-tier0/.test(meta));
const post = built.postamble;
const forbidden = /history\.|pushState|replaceState|scrollTo|scrollBy|location\.(href|assign|replace)\s*=|\.focus\(|fetch\(|XMLHttpRequest|GM_xmlhttpRequest|GM_setValue|localStorage|sessionStorage|document\.cookie|preventDefault|stopPropagation|BE\.settings\.set/;
check('recorder: no history, scroll, focus, network, storage, settings or event-cancelling call; scrollIntoView appears only in the pass-through counter (never called directly)',
  !forbidden.test(post) && /return sivOrig\.apply\(this, arguments\);/.test(post) && !/\.scrollIntoView\(/.test(post),(post.match(forbidden) || [''])[0]);
const ign = (f) => { try { execFileSync('git', ['-C', REPO, 'check-ignore', '-q', f]); return true; } catch { return false; } };
check('results path tests/results/ib12-p1-e621-tier0.json is git-ignored', ign('tests/results/ib12-p1-e621-tier0.json'));

// ---- 2. recorder smoke (jsdom, fake viewers) ----
const COLS = 5; const ROW = 300; const COLW = 200; const VH = 900; const N = 60;
const ID = (i) => String(5000000 + i * 7919);
async function run({ reveal, again = false }) {
  const arts = Array.from({ length: N }, (_, i) => `<article class="thumbnail" data-id="${ID(i)}"><a class="thm-link" href="/posts/${ID(i)}"><img src="/p/${i}.jpg"></a></article>`).join('');
  const dom = new JSDOM(`<!doctype html><html><body data-user-is-anonymous="true"><div id="posts-container">${arts}</div></body></html>`, { url: 'https://e621.net/posts', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; const d = w.document; let sy = 0;
  Object.defineProperty(w, 'scrollY', { configurable: true, get: () => sy });
  Object.defineProperty(w, 'innerHeight', { configurable: true, value: VH });
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: COLS * COLW });
  Object.defineProperty(w, 'crypto', { configurable: true, value: webcrypto });
  w.TextEncoder = TextEncoder; w.GM_info = { scriptHandler: 'jsdom-smoke', version: '0' };
  const list = [...d.querySelectorAll('article')];
  const geo = (el) => { const art = el.closest('article'); const i = list.indexOf(art); return i < 0 ? null : { top: Math.floor(i / COLS) * ROW + 10, left: (i % COLS) * COLW, w: COLW - 10, h: ROW - 20 }; };
  w.Element.prototype.getBoundingClientRect = function rect() { const g = geo(this); if (!g) return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 }; const top = g.top - sy; return { top, left: g.left, bottom: top + g.h, right: g.left + g.w, width: g.w, height: g.h }; };
  w.Element.prototype.scrollIntoView = function siv() { const g = geo(this); if (!g) return; if (g.top < sy) sy = g.top; else if (g.top + g.h > sy + VH) sy = g.top + g.h - VH; };
  const overlay = d.createElement('div'); overlay.id = 'be-viewer-overlay'; overlay.style.display = 'none';
  const closeBtn = d.createElement('button'); overlay.appendChild(closeBtn); d.body.appendChild(overlay);
  let origin = null; let onNext = null; let current = -1;
  w.BE = { adapters: { active: { getThumbElements: (root) => [...root.querySelectorAll('article.thumbnail img')], getThumbWrapper: (img) => img.closest('article'), getThumbPostId: (img) => img.closest('article').getAttribute('data-id') } },
    log: { error() {} }, modules: { viewer: { open(post, nav, ctx) { overlay.style.display = 'flex'; origin = ctx.origin; onNext = nav.next; closeBtn.focus(); return true; } } } };
  d.addEventListener('keydown', (e) => {
    if (overlay.style.display !== 'flex') return;
    if (e.key === 'ArrowRight') onNext && onNext();
    if (e.key === 'Escape') {
      overlay.style.display = 'none';
      const r = origin.getBoundingClientRect();
      if (reveal && !(r.bottom > 0 && r.top < VH)) origin.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      if (again) setTimeout(() => { sy += 40; origin.scrollIntoView({ block: 'nearest' }); }, 300);
      origin.focus({ preventScroll: true });
    }
  });
  const openCard = (i) => { current = i; w.BE.modules.viewer.open({ id: ID(i) }, { next: () => openCard(current + 1) }, { origin: list[i].querySelector('a') }); };
  w.eval(`const IB07P_PRODUCTION_BODY = function () {\n// fake production body\n};\n` + post.replace('__EXPECTED_BODY_SHA256__', sha('// fake production body\n')));
  await sleep(1100);
  openCard(0);
  for (let k = 0; k < 45; k++) d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await sleep(50);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(1600);
  const raw = w.__IB12P1_RESULT__ || null; w.close();
  return { raw, doc: raw ? JSON.parse(raw) : null };
}

async function main() {
  const a = await run({ reveal: true });
  const ra = a.doc ? evaluate(a.doc) : null;
  check('smoke: P1 close semantics (one nearest-edge correction at close, focus C) -> P1 TIER0 QUALIFIED; one scrollIntoView recorded on C\'s origin after close', ra && ra.verdict === 'P1 TIER0 QUALIFIED' && a.doc.scrollIntoViewCalls.length === 1 && a.doc.scrollIntoViewCalls[0].isCOrigin && !a.doc.scrollIntoViewCalls[0].viewerOpen, JSON.stringify(ra));
  check('smoke: sanitized - no URL and no post ID', a.raw && !/https?:\/\//.test(a.raw) && !Array.from({ length: N }, (_, i) => ID(i)).some((v) => a.raw.includes(v)));
  const b = await run({ reveal: false });
  const rb = b.doc ? evaluate(b.doc) : null;
  check('smoke: pre-P1 semantics (focus C, no scroll) -> NOT QUALIFIED', rb && rb.verdict === 'NOT QUALIFIED', JSON.stringify(rb));
  const c = await run({ reveal: true, again: true });
  const rc = c.doc ? evaluate(c.doc) : null;
  check('smoke: a repeated correction 300 ms after close -> NOT QUALIFIED', rc && rc.verdict === 'NOT QUALIFIED', JSON.stringify(rc));

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB12_P1_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib12-p1-verification', commit: P.P1_COMMIT, blob: P.P1_EXPECTED_BLOB, bodySha256: P.P1_BODY_SHA256, packageSha256: sha(PKG), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
