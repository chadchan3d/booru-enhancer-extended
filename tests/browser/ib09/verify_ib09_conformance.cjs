'use strict';
// Local qualification for IB09_Production_Conformance.user.js (no live site).
// Static: the package is pinned. The derived script is current; its body minus
// the observe-only hooks equals the committed P-stage production body (16f821e,
// blob 3161b51); metadata is narrowed. Runtime: the REAL derived script runs
// in jsdom with a fake clock and the same synthetic image-load / Resource Timing
// model as the E-stage verifier. Scripted pointer sequences stand in for the
// operator here only; the observer itself generates no events. Every
// fault-control mutant must be caught. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const { execFileSync } = require('child_process');
const b = require('./build_ib09_conformance.cjs');
const { split, WRAP_OPEN, WRAP_CLOSE } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const hh = require('../../host/ib09/hover_harness.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 500) });

// ---- static pinning ----
const derived = fs.readFileSync(b.OUT, 'utf8');
const REPO = path.resolve(__dirname, '../../..');
const prodAtCommit = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
check('derived script matches a fresh build', derived === b.build().text);
check('production blob at the pinned commit is 3161b51 (IB09 P stage)', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB);
const bodyInScript = derived.slice(derived.indexOf(WRAP_OPEN) + WRAP_OPEN.length, derived.indexOf(WRAP_CLOSE));
check('executed body minus the observe-only hooks equals the committed production body (no prototype, no patch)', b.stripHooks(bodyInScript) === split(prodAtCommit).body);
check('hooks are pure additions: 8 IB09L_HOOK calls, each guarded by typeof', (bodyInScript.match(/IB09L_HOOK\(/g) || []).length === 8 && (bodyInScript.match(/typeof IB09L_HOOK === 'function' && IB09L_HOOK\(/g) || []).length === 8);
check('dwell constant in the executed body is 200; no E-stage prototype function present', /const HOVER_DWELL_MS = 200;/.test(bodyInScript) && !/function afterDwell|function hoverUpgradeEligible/.test(bodyInScript));
const meta = split(derived).meta.split('\n');
check('only e621/e926 matched and connected; no update target', meta.filter((l) => /@match\s/.test(l)).map((l) => l.split(/\s+/).pop()).join() === '*://e621.net/*,*://e926.net/*' && !meta.some((l) => /@(downloadURL|updateURL)/.test(l)));
const post = derived.slice(derived.indexOf(b.POSTAMBLE_MARKER));
check('observer makes no request, storage, cookie or settings write, and dispatches no pointer events', !/\bfetch\(|XMLHttpRequest|GM_xmlhttpRequest\(|localStorage|sessionStorage|document\.cookie|settings\.set\(|dispatchEvent|new MouseEvent|new PointerEvent/.test(post));

// ---- runtime model (as in verify_ib09_live_package.cjs) ----
const listingWith = (host, n, ext) => {
  const html = hh.listing(host, n).html;
  if (!ext) return html;
  return html.replace(/data-file-ext="png"/g, `data-file-ext="${ext}"`).replace(/(data-file-url="[^"]*)\.png"/g, `$1.${ext}"`);
};
async function run({ url = 'https://e621.net/posts', quality = 'preview', text = derived, script, ext = null }) {
  const menu = {}; let clock = null; const entries = []; const pending = new Set(); const cached = new Set();
  const host = new URL(url).hostname;
  const c = h.load({ url, html: listingWith(host, 4, ext), source: text, settings: { 'be:setting:media.thumbQuality': JSON.stringify(quality) }, setup: (w) => {
    clock = hh.installFakeClock(w);
    w.performance.now = () => clock.now();
    w.performance.getEntriesByName = (n, t) => entries.filter((e) => e.name === n && (!t || e.entryType === t));
    if (!w.crypto || !w.crypto.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.TextEncoder) w.TextEncoder = TextEncoder;
    w.GM_registerMenuCommand = (name, fn) => { menu[name] = fn; return 0; };
    const desc = Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype, 'src');
    Object.defineProperty(w.HTMLImageElement.prototype, 'src', { configurable: true, get() { return desc.get.call(this); }, set(v) {
      desc.set.call(this, v);
      if (this.closest && this.closest('article')) return;
      const u = String(v); const img = this;
      if (u === 'data:,') { if (img.__cancel) img.__cancel(); return; }
      const isCached = cached.has(u);
      const start = clock.now(); let cancelled = false;
      pending.add(img); img.__cancel = () => { cancelled = true; pending.delete(img); };
      w.setTimeout(() => {
        if (cancelled) return;
        if (!isCached) entries.push({ name: u, entryType: 'resource', startTime: start, duration: clock.now() - start, transferSize: 300 * 1024 + 300, encodedBodySize: 300 * 1024, decodedBodySize: 600 * 1024 });
        cached.add(u); pending.delete(img); img.dispatchEvent(new w.Event('load'));
      }, isCached ? 5 : 150);
    } });
    Object.defineProperty(w.HTMLImageElement.prototype, 'complete', { configurable: true, get() { return !pending.has(this); } });
    Object.defineProperty(w.HTMLImageElement.prototype, 'currentSrc', { configurable: true, get() {
      const p = this.parentElement;
      if (p && p.localName === 'picture') for (const ch of p.children) { if (ch === this) break; if (ch.localName === 'source' && ch.getAttribute('srcset')) return new URL(ch.getAttribute('srcset').trim().split(/\s+/)[0], w.location.href).href; }
      return this.getAttribute('src') ? new URL(this.getAttribute('src'), w.location.href).href : '';
    } });
  } });
  const w = c.window;
  await h.sleep(30); await clock.advance(400);
  const cards = [...w.document.querySelectorAll('article')];
  const img = (i) => cards[i].querySelector('img');
  const api = {
    enter: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerover', { bubbles: true })); await clock.advance(0); },
    leave: async (i) => { img(i).dispatchEvent(new w.MouseEvent('pointerout', { bubbles: true, relatedTarget: w.document.body })); await clock.advance(0); },
    wait: (ms) => clock.advance(ms),
    menu: async (label) => { const k = Object.keys(menu).find((x) => x.startsWith(label)); const p = menu[k](); await clock.advance(2000); return p; },
  };
  const labels = Object.keys(menu);
  { const k = labels.find((x) => x.startsWith('IB09P: Start session — ordinary')); if (k) menu[k](); await clock.advance(3000); }
  await script(api);
  await api.menu('IB09P: Show results');
  const txt = w.document.querySelector('#ib09p-result textarea')?.value || '';
  let json = null; try { json = JSON.parse(txt); } catch { json = null; }
  const out = { text: txt, json, network: c.requests.length, labels };
  w.close();
  return out;
}
const MIX = async (a) => {
  for (const [i, stay] of [[0, 40], [1, 120], [2, 199], [0, 300], [1, 800], [2, 250], [3, 60]]) { await a.enter(i); await a.wait(stay); await a.leave(i); await a.wait(30); }
  await a.enter(0); await a.wait(30); await a.leave(0); await a.enter(1); await a.wait(400); await a.leave(1); await a.wait(30);
  await a.enter(2); await a.wait(50); await a.leave(2); await a.enter(2); await a.wait(400); await a.leave(2); await a.wait(30);
  await a.enter(3); await a.wait(260); await a.leave(3); await a.wait(400);
};
const RAW = ['101', '102', '103', '104', '0123456789abcdef', 'static.example', 'http'];
const leaks = (t) => RAW.filter((r) => t.includes(r));
const S = (r) => r.json && r.json.sessions && r.json.sessions[0];

async function main() {
  for (const host of ['e621.net', 'e926.net']) {
    const r = await run({ url: `https://${host}/posts`, quality: 'preview', script: MIX });
    const s = S(r);
    check(`${host} menu: IB09P start (ordinary/throttled), marks and results only`, r.labels.filter((l) => l.startsWith('IB09P: ')).length === 6 && !r.labels.some((l) => l.startsWith('IB09L')), r.labels.join('|'));
    check(`${host} preview: identity MATCH, site, version P-1.0.0`, r.json && r.json.production_body_identity === 'MATCH_EXPECTED_ARTIFACT' && r.json.site === host && r.json.version === 'P-1.0.0', r.text.slice(0, 200));
    check(`${host} preview: 12 generations, 6 quick passes under dwell, 6 dwells`, s && s.generations === 12 && s.quickPassesUnderDwell === 6 && s.dwellReached === 6, JSON.stringify(s));
    check(`${host} preview: nothing before dwell (no upgrade, no overlay, no hover-caused fetch); overlay offset >= 200`, s && s.newMediaBeforeDwell === 0 && s.stillOverlayBeforeDwell === 0 && s.hoverFetchesBeforeDwell === 0 && s.quickPassesStartingUpgrade === 0 && s.stillOverlayOffsetMs.min >= 200 && s.thumbNotDisplayedRendition === 0, JSON.stringify(s));
    check(`${host} preview: one SAMPLE upgrade per eligible dwell at >= 200 ms; no stale install`, s && s.previewUpgrades.eligibleGenerations === 6 && s.previewUpgrades.started === 6 && s.previewUpgrades.exactlyOnePerGeneration && s.previewUpgrades.startedBeforeDwell === 0 && s.previewUpgrades.startOffsetMs.min >= 200 && JSON.stringify(s.previewUpgrades.targetSlots) === '{"SAMPLE":6}' && s.staleInstalled === 0, JSON.stringify(s && s.previewUpgrades));
    check(`${host} preview: no leak; no enhancer network request`, leaks(r.text).length === 0 && r.network === 0, leaks(r.text).join(','));
    for (const [q, slot] of [['sample', 'SAMPLE'], ['original', 'FILE']]) {
      const x = await run({ url: `https://${host}/posts`, quality: q, script: MIX });
      const sx = S(x);
      check(`${host} ${q}: entry ${slot}; nothing before dwell (overlay, fetch); no upgrade; FILE never downgraded`, sx && sx.entryRendition[slot] === 12 && sx.stillOverlayBeforeDwell === 0 && sx.hoverFetchesBeforeDwell === 0 && sx.upgradesOnSampleOrFileCards === 0 && sx.fileDowngradedToSample === 0 && sx.newMediaBeforeDwell === 0, JSON.stringify(sx));
    }
  }
  // Out of scope: video keeps its immediate hover path (IB10), reported separately.
  {
    const r = await run({ quality: 'preview', script: MIX, ext: 'webm' });
    const s = S(r);
    check('video cards (IB10): reported under otherMediaClasses.VIDEO; video upgrade still starts at enter (unchanged path); not counted as STILL', s && s.mediaClasses.VIDEO === 12 && s.otherMediaClasses.VIDEO.upgradesStarted > 0 && s.otherMediaClasses.VIDEO.startedBeforeDwell > 0 && s.previewUpgrades.eligibleGenerations === 0 && s.stillOverlayBeforeDwell === 0, JSON.stringify(s));
  }

  // ---- fault controls ----
  const faults = [
    ['dwell removed (production work at pointer-enter)', (body) => mustReplace(body, '\t\t\tif (hoverStillCard(img)) {\n\t\t\t\tdwellTimer = setTimeout(', '\t\t\tif (false) {\n\t\t\t\tdwellTimer = setTimeout('), 'preview', (s) => s.newMediaBeforeDwell > 0 && s.stillOverlayBeforeDwell > 0],
    ['option A overlay at pointer-enter (displayed SAMPLE reused before dwell)', (body) => mustReplace(body, '\t\t\tif (hoverStillCard(img)) {\n\t\t\t\tdwellTimer = setTimeout(', '\t\t\tshowImmediateThumbnail(img, token);\n\t\t\tif (hoverStillCard(img)) {\n\t\t\t\tdwellTimer = setTimeout('), 'sample', (s) => s.stillOverlayBeforeDwell > 0 && s.hoverFetchesBeforeDwell > 0],
    ['eligibility removed (FILE downgraded to SAMPLE)', (body) => mustReplace(body, '\t\t\tif (still && !(still.qualified && qualifiedUpgradeAllowed(sourceImg, still.wrap, resolved))) {', '\t\t\tif (false) {'), 'original', (s) => s.fileDowngradedToSample > 0],
    ['dwell 150 ms', (body) => mustReplace(body, 'const HOVER_DWELL_MS = 200;', 'const HOVER_DWELL_MS = 150;'), 'preview', (s) => s.newMediaBeforeDwell > 0 || s.stillOverlayBeforeDwell > 0],
  ];
  for (const [name, t, q, caught] of faults) {
    const { text } = b.build({ bodyTransform: t });
    const r = await run({ quality: q, text, script: MIX });
    const s = S(r);
    check(`fault ${name}: caught`, s && caught(s), JSON.stringify(s));
  }
  {
    const tampered = derived.replace('const HOVER_DWELL_MS = 200;', 'const HOVER_DWELL_MS = 200; ');
    const r = await run({ quality: 'preview', text: tampered, script: MIX });
    check('fault executed body differs from the pinned artifact: identity MISMATCH', r.json && r.json.production_body_identity === 'MISMATCH', r.text.slice(0, 200));
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'P-stage production-conformance package (local qualification)', production_commit: b.COMMIT, production_blob: b.EXPECTED_PRODUCTION_BLOB, fixtures: 'synthetic',
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB09_CONFORMANCE_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
