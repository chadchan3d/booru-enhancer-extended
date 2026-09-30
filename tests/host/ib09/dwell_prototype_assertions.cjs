'use strict';
// IB09 E-stage assertions for the isolated 200 ms dwell prototype
// (dwell_prototype.cjs applied to the real production source; production file
// unchanged). Uses the reusable fake-clock hover harness. e621 and e926 are
// run independently. t = ms since the first pointer-enter.
//   Q1  sustained hover past 200 ms (upgrade load completed at 300)
//   Q2  leave at 199 ms
//   Q3  boundary sweeps: stay T ms then leave, T in 0/40/100/199/200/201/250
//   Q4  40 ms sweep (covered by Q3 T=40)
//   Q5  enter, leave 50, re-enter 100
//   Q6  card A -> card B at 30 (before dwell)
//   Q7  card A dwell fires (200), move to B at 250
//   Q8  upgrade started at 200, leave 250, stale completion at 300
//   Q9  upgrade g1 at 200, leave/re-enter at 250 (g2), g1 completes at 300, g2 at 500
//   Q10 viewer opened at 50 (before dwell)
// Required: at pointer-enter only the displayed rendition (showImmediateThumbnail)
// and no metadata/network; no upgrade before 200 ms after the latest enter; at
// dwell PREVIEW -> one SAMPLE upgrade, SAMPLE/FILE -> none; leave cancels the
// dwell; stale generations and results never apply; viewer takeover suppresses
// the upgrade. Fault-control mutants of the prototype must each be caught.
const fs = require('fs');
const path = require('path');
const hh = require('./hover_harness.cjs');
const { applyDwellPrototype, mustReplace } = require('./dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const PROTO = applyDwellPrototype(PROD, { dwellMs: 200 });
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });
const DWELL = 200;

const upgrades = (tl) => tl.assigns.filter((a) => a.path === 'upgradeWhenReady');
const SCEN = {
  Q1: async (s) => { await s.enter(0); await s.wait(300); const u = s.rec.assigns.find((a) => a.path === 'upgradeWhenReady'); if (u) await s.complete(u); await s.wait(700); return { enters: [0] }; },
  Q2: async (s) => { await s.enter(0); await s.wait(199); await s.leave(0); await s.wait(600); return { enters: [0], leaveAt: 199 }; },
  Q5: async (s) => { await s.enter(0); await s.wait(50); await s.leave(0); await s.wait(50); await s.enter(0); await s.wait(600); return { enters: [0, 100], leaveAt: 50 }; },
  Q6: async (s) => { await s.enter(0); await s.wait(30); await s.leave(0); await s.enter(1); await s.wait(600); return { enters: [0, 30] }; },
  Q7: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(1); await s.wait(600); return { enters: [0, 250] }; },
  Q8: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.wait(50); const u = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady'); if (u) await s.complete(u); await s.wait(300); return { enters: [0], visibleAfter: s.hoverVisible(), staleCompleted: !!u }; },
  Q9: async (s) => {
    await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(0); await s.wait(50);
    const g1 = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady'); if (g1) await s.complete(g1);
    const childGenAfterStale = s.hoverChildGen();
    await s.wait(200); const g2 = s.rec.assigns.find((a) => a.gen === 2 && a.path === 'upgradeWhenReady'); if (g2) await s.complete(g2);
    await s.wait(300);
    return { enters: [0, 250], childGenAfterStale, childGenEnd: s.hoverChildGen(), g1Started: !!g1, g2Started: !!g2 };
  },
  Q10: async (s) => { await s.enter(0); await s.wait(50); await s.click(0); await s.wait(700); return { enters: [0], viewerOpen: !!s.BE.modules.viewer?.isOpen?.() }; },
};
const SWEEP = [0, 40, 100, 199, 200, 201, 250];

async function scenario(source, host, quality, id) {
  const s = await hh.session({ host, quality, source });
  s.startAt();
  const meta = await SCEN[id](s);
  const tl = hh.timeline(s);
  s.close();
  return { meta, tl };
}
async function sweep(source, host, quality, T) {
  const s = await hh.session({ host, quality, source });
  s.startAt();
  await s.enter(0); await s.wait(T); await s.leave(0); await s.wait(600);
  const tl = hh.timeline(s);
  s.close();
  return tl;
}

// Invariant checks shared by production verdicts and fault detection.
function invariants(r, quality) {
  const tl = r.tl; const enters = r.meta.enters;
  const ups = upgrades(tl);
  const v = {};
  // every upgrade must start at least DWELL after the enter of its own generation
  v.noUpgradeBeforeDwell = ups.every((a) => a.t >= enters[a.gen - 1] + DWELL);
  // at enter: only the displayed rendition
  v.enterOnlyDisplayed = tl.assigns.filter((a) => enters.includes(a.t) && a.slot !== 'CANCEL').every((a) => a.path === 'showImmediateThumbnail');
  v.noMetadataBeforeDwell = tl.metadata.every((m) => m.t >= enters[m.gen - 1] + DWELL);
  v.noNetwork = tl.network === 0;
  v.ordering = quality === 'preview' ? ups.every((a) => a.slot === 'SAMPLE') : ups.length === 0;
  v.noStaleInstall = tl.installs.every((i) => i.assignedInGen === null || (i.assignedInGen === i.currentGen && i.hoverActive));
  return v;
}

async function main() {
  const detail = {};
  for (const host of ['e621.net', 'e926.net']) {
    for (const quality of ['preview', 'sample', 'original']) {
      const res = {};
      for (const id of Object.keys(SCEN)) res[id] = await scenario(PROTO, host, quality, id);
      detail[`${host} ${quality}`] = res;
      const k = `${host} ${quality}`;
      for (const [id, r] of Object.entries(res)) {
        const inv = invariants(r, quality);
        check(`${k} ${id}: invariants (no upgrade/metadata before dwell, only the displayed rendition at enter, ordering, no stale install, no network)`, Object.values(inv).every(Boolean), JSON.stringify([inv, r.tl.assigns, r.tl.metadata]));
      }
      const ups = (id) => upgrades(res[id].tl);
      if (quality === 'preview') {
        check(`${k} Q1: exactly one SAMPLE upgrade, at 200; installed after load`, ups('Q1').length === 1 && ups('Q1')[0].t === 200 && res.Q1.tl.installs.length === 2, JSON.stringify(res.Q1.tl));
        check(`${k} Q2 leave at 199: no upgrade ever; the dwell was cancelled`, ups('Q2').length === 0 && res.Q2.tl.metadata.length === 0, JSON.stringify(res.Q2.tl));
        check(`${k} Q5 re-entry: no upgrade at 200 (old generation), one at 300 (fresh dwell)`, ups('Q5').length === 1 && ups('Q5')[0].t === 300 && ups('Q5')[0].gen === 2, JSON.stringify(ups('Q5')));
        check(`${k} Q6 A->B before dwell: A never upgrades; B upgrades at 230`, ups('Q6').length === 1 && ups('Q6')[0].t === 230 && ups('Q6')[0].gen === 2, JSON.stringify(ups('Q6')));
        check(`${k} Q7 A dwell fires then B: A upgrade at 200, cancelled at 250; B upgrade at 450`, ups('Q7').map((a) => `${a.t}g${a.gen}`).join() === '200g1,450g2' && res.Q7.tl.assigns.some((a) => a.slot === 'CANCEL' && a.t === 250), JSON.stringify(res.Q7.tl.assigns));
        check(`${k} Q8 stale completion after leave installs nothing; overlay hidden`, res.Q8.meta.staleCompleted && res.Q8.meta.visibleAfter === false && res.Q8.tl.installs.length === 1, JSON.stringify([res.Q8.meta, res.Q8.tl.installs]));
        check(`${k} Q9 stale g1 completion during g2 installs nothing; g2 upgrade at 450 installs`, res.Q9.meta.g1Started && res.Q9.meta.g2Started && res.Q9.meta.childGenAfterStale === 2 && res.Q9.meta.childGenEnd === 2 && ups('Q9').map((a) => `${a.t}g${a.gen}`).join() === '200g1,450g2', JSON.stringify([res.Q9.meta, ups('Q9')]));
        check(`${k} Q10 viewer opened before dwell: no hover upgrade, no hover metadata`, res.Q10.meta.viewerOpen && ups('Q10').length === 0 && res.Q10.tl.metadata.length === 0, JSON.stringify([res.Q10.meta, res.Q10.tl]));
      } else {
        check(`${k} Q1: no hover upgrade (displayed ${quality === 'sample' ? 'SAMPLE' : 'FILE'} is never reloaded or downgraded); metadata only at 200`, ups('Q1').length === 0 && res.Q1.tl.metadata.map((m) => m.t).join() === '200', JSON.stringify(res.Q1.tl));
      }
    }
    // Boundary sweeps (preview): the first upgrade appears only when the stay is >= 200.
    const sweepOut = {};
    for (const T of SWEEP) { const tl = await sweep(PROTO, host, 'preview', T); sweepOut[T] = upgrades(tl).map((a) => a.t); }
    detail[`${host} sweep`] = sweepOut;
    check(`${host} boundary sweep: no upgrade for stays 0/40/100/199; one upgrade at exactly 200 for stays 200/201/250`,
      [0, 40, 100, 199].every((T) => sweepOut[T].length === 0) && [200, 201, 250].every((T) => sweepOut[T].join() === '200'), JSON.stringify(sweepOut));
    // Prototype sweeps with other candidate boundaries prove the dwell constant is the only authority.
    for (const d of [100, 300]) {
      const alt = applyDwellPrototype(PROD, { dwellMs: d });
      const tlA = await sweep(alt, host, 'preview', d - 1); const tlB = await sweep(alt, host, 'preview', d);
      check(`${host} dwell ${d} ms variant: no upgrade at ${d - 1}, upgrade at ${d}`, upgrades(tlA).length === 0 && upgrades(tlB).map((a) => a.t).join() === String(d), JSON.stringify([upgrades(tlA), upgrades(tlB)]));
    }
  }

  // ---- fault controls (mutants of the prototype) ----
  const m = (from, to) => mustReplace(PROTO, from, to);
  const faults = [
    ['upgrade starts at pointer-enter', m("\t\t\tdwellTimer = setTimeout(() => { dwellTimer = null; afterDwell(img, token); }, HOVER_DWELL_MS);", '\t\t\tafterDwell(img, token);'), 'preview', 'Q1', (r) => !invariants(r, 'preview').noUpgradeBeforeDwell],
    ['only one of the two upgrade triggers delayed (metadata path left at enter)', m('\t\t\t// Every new or costly step waits for dwell, behind one timer.\n', "\t\t\t// Every new or costly step waits for dwell, behind one timer.\n\t\t\t{ const pid = img.dataset.bePostId || BE.adapters.active?.getThumbPostId?.(img); const p = pid && BE.modules.gallery?.getCachedPost?.(pid); const rs = p && mediaFromPost(p); if (rs?.url) upgradeWhenReady(rs, img, token); }\n"), 'preview', 'Q1', (r) => !invariants(r, 'preview').noUpgradeBeforeDwell || !invariants(r, 'preview').noMetadataBeforeDwell],
    ['FILE downgraded to SAMPLE (eligibility removed)', m("\t\t\tif (!hoverUpgradeEligible(sourceImg, resolved)) { clearMediaState(); return; }\n", ''), 'original', 'Q1', (r) => !invariants(r, 'original').ordering],
    ['SAMPLE unnecessarily reloads SAMPLE', m("\t\t\treturn showingPreview && same(resolved.url, wrap.dataset.sampleUrl) && !same(resolved.url, current);", '\t\t\treturn true;').replace("\t\t\tif (resolved.mediaType !== 'video' && resolved.url === currentThumbUrl) {\n\t\t\t\tclearMediaState();\n\t\t\t\treturn;\n\t\t\t}", ''), 'sample', 'Q1', (r) => !invariants(r, 'sample').ordering],
    ['leave fails to cancel the pending dwell (timer kept and token check removed)', m('\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n', '\t\tfunction hide() {\n').replace("\t\tasync function afterDwell(img, token) {\n\t\t\tif (token !== requestToken) return;", '\t\tasync function afterDwell(img, token) {\n\t\t\ttoken = requestToken;'), 'preview', 'Q2', (r) => upgrades(r.tl).length > 0],
    ['stale dwell generation fires after re-entry', m("\t\t\tclearTimeout(dwellTimer);\n\n\t\t\t// V3", '\n\t\t\t// V3').replace('\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n', '\t\tfunction hide() {\n').replace("\t\tasync function afterDwell(img, token) {\n\t\t\tif (token !== requestToken) return;", '\t\tasync function afterDwell(img, token) {\n\t\t\ttoken = requestToken;'), 'preview', 'Q5', (r) => !invariants(r, 'preview').noUpgradeBeforeDwell],
    ['stale image completion installs (install guards removed)', m("\t\t\timage.addEventListener('load', async () => {\n\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;\n\t\t\t\ttry { await image.decode(); } catch { /* load is enough */ }\n\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;\n\t\t\t\tinstallMedia(image, sourceImg, token);",
      "\t\t\timage.addEventListener('load', async () => {\n\t\t\t\ttry { await image.decode(); } catch { /* load is enough */ }\n\t\t\t\tinstallMedia(image, sourceImg, requestToken);"), 'preview', 'Q9', (r) => !invariants(r, 'preview').noStaleInstall || r.meta.childGenAfterStale === 1],
    ["fast card A -> card B starts A's upgrade", m('\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n', '\t\tfunction hide() {\n').replace("\t\t\tclearTimeout(dwellTimer);\n\n\t\t\t// V3", '\n\t\t\t// V3').replace("\t\tasync function afterDwell(img, token) {\n\t\t\tif (token !== requestToken) return;", '\t\tasync function afterDwell(img, token) {\n\t\t\ttoken = requestToken;'), 'preview', 'Q6', (r) => !invariants(r, 'preview').noUpgradeBeforeDwell || upgrades(r.tl).length !== 1],
    ['viewer takeover leaves the delayed hover upgrade armed', m("\t\t\tif (BE.modules.viewer?.isOpen?.()) return; // the viewer took over before dwell: no hover upgrade\n", ''), 'preview', 'Q10', (r) => upgrades(r.tl).length > 0],
  ];
  for (const [name, src, quality, id, caught] of faults) {
    const r = await scenario(src, 'e621.net', quality, id);
    check(`fault ${name}: caught`, caught(r), JSON.stringify([r.meta, upgrades(r.tl), r.tl.metadata]));
  }
  {
    const early = applyDwellPrototype(PROD, { dwellMs: 199 });
    const tl = await sweep(early, 'e621.net', 'preview', 199);
    check('fault upgrade fires at 199 ms: caught by the boundary sweep', upgrades(tl).length === 1 && upgrades(tl)[0].t === 199);
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'E-stage isolated dwell prototype (200 ms candidate); production unchanged', production_blob: h.gitBlobId(PROD), dwellMs: DWELL, fixtures: 'synthetic',
    timelines: Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, k.endsWith('sweep') ? v : Object.fromEntries(Object.entries(v).map(([id, r]) => [id, { meta: r.meta, assigns: r.tl.assigns, installs: r.tl.installs, metadata: r.tl.metadata, network: r.tl.network }]))])),
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'dwell-prototype-result.json'), JSON.stringify(summary, (k, v) => (k === 'el' ? undefined : v), 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
