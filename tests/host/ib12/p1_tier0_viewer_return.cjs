'use strict';
// IB12-P1 (Tier 0: last-viewed viewer return) permanent regression.
// Defect (E1, real Chrome): after A -> C in the viewer, close focused C's native
// link with preventScroll, so an off-screen C received focus while the page stayed
// at A. Repair: on close, the return card is the last viewed card, else the
// session's original opener A, else the declared fallback, else nothing; when the
// chosen card is entirely outside the viewport it is brought into view once
// (scrollIntoView, nearest edge, instant). Nothing scrolls while the viewer is open.
//
// Harness: the real production source in jsdom (item9 harness) on an e621 listing.
// A layout model gives every card a fixed rectangle in a 3-column grid of 300 px
// rows against a 600 px viewport and a mutable page scroll; scrollIntoView is
// recorded and applies the nearest-edge rule. Sources: repair (working tree) and
// the prior artifact ac3c9e8 (pre-P1), which must fail checks 1 and 3.
// Usage: node tests/host/ib12/p1_tier0_viewer_return.cjs
const fs = require('fs');
const path = require('path');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));
const hh = require(path.resolve(__dirname, '../ib09/hover_harness.cjs'));

const SOURCES = { repair: h.productionSource(), prior: hh.sourceAt('ac3c9e8', 'db5484396de60a90711e3b566fb8f6bbc10b3181') };
const N = 15; const COLS = 3; const ROW = 300; const COLW = 300; const VH = 600; const VW = 1000;

async function session(source) {
  let clock = null; let sy = 0; const scrolls = [];
  const fx = hh.listing('e621.net', N);
  const html = fx.html.replace('</section>', '</section><div id="paginator"><a href="/posts?page=2">2</a></div>');
  const c = h.load({ url: fx.url, html, source, setup: (w) => {
    clock = hh.installFakeClock(w); w.performance.now = () => clock.now();
    if (!w.PointerEvent) w.PointerEvent = w.MouseEvent;
    Object.defineProperty(w, 'innerHeight', { configurable: true, value: VH });
    Object.defineProperty(w, 'innerWidth', { configurable: true, value: VW });
    Object.defineProperty(w, 'scrollY', { configurable: true, get: () => sy });
    const R = (x, y, wd, ht) => ({ x, y, left: x, top: y, width: wd, height: ht, right: x + wd, bottom: y + ht });
    const geo = (el) => { const art = el.closest && el.closest('article'); if (!art) return null; const i = [...w.document.querySelectorAll('article')].indexOf(art); return i < 0 ? null : { x: (i % COLS) * COLW, y: Math.floor(i / COLS) * ROW + 10, w: COLW - 20, h: ROW - 20 }; };
    const gbr = w.HTMLElement.prototype.getBoundingClientRect;
    w.HTMLElement.prototype.getBoundingClientRect = function () {
      if (this.classList && this.classList.contains('be-viewer-stage')) return R(0, 0, VW, VH);
      const g = this.isConnected && geo(this); if (g) return R(g.x, g.y - sy, g.w, g.h);
      return gbr.call(this);
    };
    w.Element.prototype.scrollIntoView = function (opts) {
      const ov = w.document.querySelector('#be-viewer-overlay');
      scrolls.push({ el: this, opts, viewerOpen: !!ov && ov.style.display === 'flex' });
      const g = geo(this); if (!g) return;
      if (g.y < sy) sy = g.y; else if (g.y + g.h > sy + VH) sy = g.y + g.h - VH; // nearest edge
    };
  } });
  const w = c.window; await h.sleep(20); await clock.advance(400);
  const doc = w.document; const V = c.BE.modules.viewer;
  const art = (i) => doc.querySelectorAll('article')[i];
  const link = (i) => art(i).querySelector('a');
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < VH; };
  return {
    w, doc, V, art, link, scrolls, visible, sy: () => sy,
    open: async (i) => { const l = link(i); l.focus(); l.querySelector('img').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); await clock.advance(0); },
    key: async (k) => { (doc.activeElement || doc.body).dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); await clock.advance(0); },
    cardOf: (el) => { const a = el && el.closest && el.closest('article'); return a ? [...doc.querySelectorAll('article')].indexOf(a) : -1; },
  };
}

const CHECKS = [
  ['P1-1 [defect] A -> off-screen C, Escape: focus returns to C, and C is brought into view by exactly one close-time correction (nearest edge, instant); nothing scrolled while the viewer was open', async (src) => {
    const a = await session(src); await a.open(0); for (let k = 0; k < 7; k++) await a.key('ArrowRight');
    const cOff = !a.visible(a.link(7)) && String(a.V.currentPost.id) === a.art(7).getAttribute('data-id'); const whileOpen = a.scrolls.length;
    await a.key('Escape');
    return cOff && whileOpen === 0 && !a.V.isOpen() && a.doc.activeElement === a.link(7) && a.scrolls.length === 1 && a.scrolls[0].el === a.link(7)
      && !a.scrolls[0].viewerOpen && a.scrolls[0].opts && a.scrolls[0].opts.block === 'nearest' && a.scrolls[0].opts.behavior === 'instant' && a.visible(a.link(7)); }, { prior: false }],
  ['P1-2 C already visible: focus returns to C and the page does not scroll', async (src) => {
    const a = await session(src); await a.open(0); await a.key('ArrowRight'); await a.key('ArrowRight'); const y = a.sy();
    await a.key('Escape'); return !a.V.isOpen() && a.doc.activeElement === a.link(2) && a.scrolls.length === 0 && a.sy() === y; }, { prior: true }],
  ['P1-3 C removed before close: focus returns to the original opener A (no unrelated card); A is visible, so no scroll', async (src) => {
    const a = await session(src); await a.open(0); for (let k = 0; k < 7; k++) await a.key('ArrowRight'); a.art(7).remove();
    await a.key('Escape'); return !a.V.isOpen() && a.doc.activeElement === a.link(0) && a.scrolls.length === 0; }, { prior: false }],
  ['P1-4 C and A both unavailable: the existing fallback behaviour stays safe - no card receives focus, nothing scrolls, close completes', async (src) => {
    const a = await session(src); await a.open(0); for (let k = 0; k < 7; k++) await a.key('ArrowRight'); a.art(7).remove(); a.art(0).remove();
    await a.key('Escape'); return !a.V.isOpen() && a.cardOf(a.doc.activeElement) === -1 && a.scrolls.length === 0; }, { prior: true }],
];

async function main() {
  const results = [];
  for (const [name, fn, expect] of CHECKS) {
    const got = {};
    for (const [k, src] of Object.entries(SOURCES)) { try { got[k] = !!(await fn(src)); } catch (e) { got[k] = `ERROR ${e.message}`; } }
    const pass = got.repair === true && Object.entries(expect).every(([k, v]) => got[k] === v);
    results.push({ name, pass, got });
  }
  const passed = results.filter((r) => r.pass).length;
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}  [${Object.entries(r.got).map(([k, v]) => `${k} ${v}`).join(', ')}]`);
  console.log(`\n${passed}/${results.length} checks passed (production blob ${h.gitBlobId(h.productionSource())})`);
  fs.writeFileSync(path.join(__dirname, 'p1-tier0-viewer-return-result.json'), `${JSON.stringify({ test: 'ib12-p1-tier0-viewer-return', productionBlob: h.gitBlobId(h.productionSource()), passed, total: results.length, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 2; });
