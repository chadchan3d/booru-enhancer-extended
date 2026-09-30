'use strict';
// IB09 V3 reopening: compare the three overlay designs on top of the qualified
// 200 ms dwell prototype (dwell_prototype.cjs), real production source, fake clock:
//   A 'immediate' - current V3 (new Image() assigned the displayed rendition at enter)
//   B 'dwell'     - no hover media before dwell; overlay (displayed rendition) at dwell
//   C 'canvas'    - immediate zero-fetch presentation: drawImage of the decoded card image
// Production (Booru_Enhancer.user.js) is not changed. In jsdom a canvas 2d
// context is stubbed to record drawImage sources, and card images report a
// natural width. Fixtures are synthetic. Criteria:
//   - hover-caused resource assignments during a 40 ms sweep (the IB09 cost objective);
//   - perceived immediacy (first overlay install time);
//   - native-node identity (card rendition attributes unchanged; C only reads the card node);
//   - upgrade gating unchanged (no upgrade before 200 ms after its own enter; PREVIEW->SAMPLE only);
//   - stale-generation safety; viewer boundary (overlay when the viewer opens before dwell).
const fs = require('fs');
const path = require('path');
const hh = require('./hover_harness.cjs');
const { applyDwellPrototype, mustReplace } = require('./dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = hh.eStageSource(); // pinned: E-stage evidence on bbaf9ac
const VARIANTS = { A: applyDwellPrototype(PROD, { overlay: 'immediate' }), B: applyDwellPrototype(PROD, { overlay: 'dwell' }), C: applyDwellPrototype(PROD, { overlay: 'canvas' }) };
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

const extraSetup = (w) => {
  w.__draws = [];
  Object.defineProperty(w.HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get() { return this.closest && this.closest('article') ? 300 : 0; } });
  Object.defineProperty(w.HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get() { return this.closest && this.closest('article') ? 400 : 0; } });
  w.HTMLCanvasElement.prototype.getContext = function getContext(kind) { return kind === '2d' ? { drawImage: (src) => w.__draws.push({ fromCardNode: !!(src && src.closest && src.closest('article')), tag: src && src.localName }) } : null; };
};
const rsig = (a) => [...a.querySelectorAll('picture, source, img')].map((el) => el.localName + JSON.stringify(['src', 'srcset', 'sizes', 'media', 'type'].map((n) => el.getAttribute(n)))).join('|');

const SCEN = {
  sweep40: async (s) => { await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(400); return { enters: [0], leaveAt: 40 }; },
  sustained: async (s) => { await s.enter(0); await s.wait(300); const u = s.rec.assigns.find((a) => a.path === 'upgradeWhenReady'); if (u) await s.complete(u); await s.wait(500); return { enters: [0] }; },
  reentry: async (s) => { await s.enter(0); await s.wait(50); await s.leave(0); await s.wait(50); await s.enter(0); await s.wait(500); return { enters: [0, 100] }; },
  aToB: async (s) => { await s.enter(0); await s.wait(30); await s.leave(0); await s.enter(1); await s.wait(500); return { enters: [0, 30] }; },
  stale: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(0); await s.wait(50); const g1 = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady'); if (g1) await s.complete(g1); await s.wait(400); return { enters: [0, 250], childGen: s.hoverChildGen() }; },
  viewer: async (s) => { await s.enter(0); await s.wait(50); await s.click(0); await s.wait(500); return { enters: [0] }; },
};

async function scenario(source, host, quality, id) {
  const s = await hh.session({ host, quality, source, extraSetup });
  const before = s.cards.map(rsig);
  s.startAt();
  const meta = await SCEN[id](s);
  const tl = hh.timeline(s);
  const out = { meta, tl, draws: s.w.__draws.slice(), nativeUnchanged: s.cards.every((a, i) => rsig(a) === before[i]) };
  s.close();
  return out;
}
const upgrades = (tl) => tl.assigns.filter((a) => a.path === 'upgradeWhenReady');
function metrics(r) {
  const tl = r.tl; const enters = r.meta.enters;
  return {
    hoverAssignsBeforeLeave: r.meta.leaveAt === undefined ? null : tl.assigns.filter((a) => a.slot !== 'CANCEL' && a.t < r.meta.leaveAt).length,
    firstOverlayAt: tl.installs.length ? tl.installs[0].t : null,
    overlayKinds: [...new Set(tl.installs.map((i) => i.kind))].join(),
    overlayInstalls: tl.installs.length,
    upgradeGated: upgrades(tl).every((a) => a.t >= enters[a.gen - 1] + 200),
    overlayGatedPerGeneration: tl.installs.every((i) => i.currentGen < 1 || i.t >= enters[i.currentGen - 1]),
    noStaleInstall: tl.installs.every((i) => i.assignedInGen === null || (i.assignedInGen === i.currentGen && i.hoverActive)),
    draws: r.draws.length, drawsAllFromCardNode: r.draws.every((d) => d.fromCardNode),
    nativeUnchanged: r.nativeUnchanged, network: tl.network,
  };
}

async function main() {
  const table = {};
  for (const [v, src] of Object.entries(VARIANTS)) for (const host of ['e621.net', 'e926.net']) for (const quality of ['preview', 'original']) {
    const row = {};
    for (const id of Object.keys(SCEN)) row[id] = metrics(await scenario(src, host, quality, id));
    table[`${v} ${host} ${quality}`] = row;
    const k = `${v} ${host} ${quality}`;
    const sw = row.sweep40;
    check(`${k}: upgrade gating, stale safety, native identity and zero network unchanged in every scenario`, Object.values(row).every((m) => m.upgradeGated && m.noStaleInstall && m.nativeUnchanged && m.network === 0), JSON.stringify(row));
    if (v === 'A') {
      check(`${k}: A makes one hover resource assignment in a 40 ms sweep (the displayed rendition), overlay at 0`, sw.hoverAssignsBeforeLeave === 1 && sw.firstOverlayAt === 0 && sw.overlayKinds === 'img', JSON.stringify(sw));
      check(`${k}: A viewer before dwell leaves the t=0 overlay installed`, row.viewer.overlayInstalls === 1 && row.viewer.firstOverlayAt === 0, JSON.stringify(row.viewer));
    }
    if (v === 'B') {
      check(`${k}: B makes zero hover resource assignments and shows no overlay in a 40 ms sweep`, sw.hoverAssignsBeforeLeave === 0 && sw.overlayInstalls === 0, JSON.stringify(sw));
      check(`${k}: B overlay appears at dwell (200 ms)`, row.sustained.firstOverlayAt === 200, JSON.stringify(row.sustained));
      check(`${k}: B viewer before dwell: no hover overlay at all`, row.viewer.overlayInstalls === 0, JSON.stringify(row.viewer));
      check(`${k}: B re-entry and A->B: overlay only at 200 ms after the latest enter`, row.reentry.firstOverlayAt === 300 && row.aToB.firstOverlayAt === 230, JSON.stringify([row.reentry.firstOverlayAt, row.aToB.firstOverlayAt]));
    }
    if (v === 'C') {
      check(`${k}: C makes zero hover resource assignments in a 40 ms sweep yet shows the overlay at 0 (canvas)`, sw.hoverAssignsBeforeLeave === 0 && sw.firstOverlayAt === 0 && sw.overlayKinds === 'canvas', JSON.stringify(sw));
      check(`${k}: C paints only from the native card node, which stays unchanged`, sw.draws === 1 && sw.drawsAllFromCardNode && sw.nativeUnchanged, JSON.stringify(sw));
      check(`${k}: C viewer before dwell leaves the t=0 canvas overlay installed (same as A)`, row.viewer.overlayInstalls === 1, JSON.stringify(row.viewer));
    }
  }
  // C when the card image is not decoded yet: nothing is painted and nothing is requested before dwell.
  {
    const s = await hh.session({ host: 'e621.net', quality: 'preview', source: VARIANTS.C, extraSetup: (w) => { extraSetup(w); Object.defineProperty(w.HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 0 }); } });
    s.startAt(); await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(300);
    const tl = hh.timeline(s); s.close();
    check('C with an undecoded card image: no paint, no request, no overlay in the sweep', tl.assigns.length === 0 && tl.installs.length === 0, JSON.stringify(tl));
  }

  // ---- fault controls ----
  const faults = [
    ['B with the overlay still at enter', mustReplace(VARIANTS.B, '\t\t\t// V3 variant B: no hover media before dwell; the overlay appears at dwell.\n', '\t\t\tshowImmediateThumbnail(img, token);\n'), 'sweep40', (m) => m.hoverAssignsBeforeLeave > 0],
    ['C falling back to an Image assignment', mustReplace(VARIANTS.C, '\t\t\ttry { ctx.drawImage(sourceImg, 0, 0, canvas.width, canvas.height); } catch { return; }\n\t\t\tinstallMedia(canvas, sourceImg, token);', '\t\t\tshowImmediateThumbnail(sourceImg, token); return;'), 'sweep40', (m) => m.hoverAssignsBeforeLeave > 0],
    ['C cloning the card node (a clone can load its src)', mustReplace(VARIANTS.C, '\t\t\ttry { ctx.drawImage(sourceImg, 0, 0, canvas.width, canvas.height); } catch { return; }\n\t\t\tinstallMedia(canvas, sourceImg, token);', '\t\t\tinstallMedia(sourceImg.cloneNode(true), sourceImg, token);'), 'sweep40', (m) => m.overlayKinds !== 'canvas'],
    ['C painting a mutated native node', mustReplace(VARIANTS.C, '\t\t\tconst box = targetBoxFor(sourceImg);\n\t\t\tconst scale', "\t\t\tsourceImg.setAttribute('src', sourceImg.currentSrc);\n\t\t\tconst box = targetBoxFor(sourceImg);\n\t\t\tconst scale"), 'sweep40', (m) => !m.nativeUnchanged],
    ['B stale dwell of the previous card shows before the new dwell', mustReplace(mustReplace(mustReplace(VARIANTS.B, '\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n', '\t\tfunction hide() {\n'), "\t\t\tclearTimeout(dwellTimer);\n\n\t\t\t// V3", '\n\t\t\t// V3'), '\t\tasync function afterDwell(img, token) {\n\t\t\tif (token !== requestToken) return;', '\t\tasync function afterDwell(img, token) {\n\t\t\ttoken = requestToken;'), 'aToB', (m) => m.firstOverlayAt !== 230],
  ];
  for (const [name, src, id, caught] of faults) {
    const m = metrics(await scenario(src, 'e621.net', 'preview', id));
    check(`fault ${name}: caught`, caught(m), JSON.stringify(m));
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'E-stage V3 alternatives (A immediate / B dwell-gated / C canvas) on the 200 ms prototype; production unchanged', production_blob: h.gitBlobId(PROD), fixtures: 'synthetic',
    table, checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'v3-alternatives-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
