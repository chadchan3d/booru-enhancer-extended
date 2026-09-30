'use strict';
// IB09 P-stage assertions on the REAL production source (Booru_Enhancer.user.js,
// no patch). Ports the E-stage prototype scenarios (dwell_prototype_assertions.cjs
// Q1-Q10 and the boundary sweep) to production with the frozen policy:
//   - G-HOVER(e621/e926 qualified still-image class) PASS(scope), 200 ms dwell;
//   - nothing before dwell for a still card: no overlay (option B), no upgrade,
//     no metadata; leave / re-entry / viewer cancel the pending dwell;
//   - qualified (IB08 still pattern): displayed PREVIEW -> native SAMPLE or
//     SAMPLE|FILE alias only; displayed SAMPLE / FILE -> no upgrade;
//   - other still cards on the admitted page (e.g. no usable sample): thumbnail
//     at dwell, no automatic upgrade;
//   - out of scope (video, GIF, logged-in page): hover timeline identical to the
//     E-stage production blob bbaf9ac.
// t = ms since the first pointer-enter. Fixtures are synthetic.
const fs = require('fs');
const path = require('path');
const hh = require('./hover_harness.cjs');
const { mustReplace } = require('./dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const BASE = hh.eStageSource();
const DWELL = 200;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 500) });

const HOVER_PATHS = ['showImmediateThumbnail', 'upgradeWhenReady'];
const hoverAssigns = (tl) => tl.assigns.filter((a) => HOVER_PATHS.includes(a.path) && a.slot !== 'CANCEL');
const upgrades = (tl) => tl.assigns.filter((a) => a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL');
const overlays = (tl) => tl.assigns.filter((a) => a.path === 'showImmediateThumbnail');

// Card fixtures applied before production runs (extraSetup).
const FIX = {
  pattern: null,
  alias: (w) => { for (const a of w.document.querySelectorAll('article')) a.setAttribute('data-sample-url', a.getAttribute('data-file-url')); },
  noSample: (w) => { for (const a of w.document.querySelectorAll('article')) a.setAttribute('data-sample-url', ''); },
  video: (w) => { for (const a of w.document.querySelectorAll('article')) { a.setAttribute('data-file-ext', 'webm'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.webm')); } },
  gif: (w) => { for (const a of w.document.querySelectorAll('article')) { a.setAttribute('data-file-ext', 'gif'); a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, '.gif')); } },
  loggedIn: (w) => { w.document.body.setAttribute('data-user-is-anonymous', 'false'); },
};
// Video elements created by production, counted per session (not an image src).
const withVideoLog = (fix) => (w) => {
  if (fix) fix(w);
  w.__videos = 0;
  const ce = w.document.createElement.bind(w.document);
  w.document.createElement = (tag, ...a) => { if (String(tag).toLowerCase() === 'video') w.__videos++; return ce(tag, ...a); };
};

const SCEN = {
  Q1: async (s) => { await s.enter(0); await s.wait(300); const u = s.rec.assigns.find((a) => a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (u) await s.complete(u); await s.wait(700); return { enters: [0] }; },
  Q2: async (s) => { await s.enter(0); await s.wait(199); await s.leave(0); await s.wait(600); return { enters: [0], leaveAt: 199, visibleAfter: s.hoverVisible() }; },
  Q5: async (s) => { await s.enter(0); await s.wait(50); await s.leave(0); await s.wait(50); await s.enter(0); await s.wait(600); return { enters: [0, 100], leaveAt: 50 }; },
  Q6: async (s) => { await s.enter(0); await s.wait(30); await s.leave(0); await s.enter(1); await s.wait(600); return { enters: [0, 30] }; },
  Q7: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(1); await s.wait(600); return { enters: [0, 250] }; },
  Q8: async (s) => { await s.enter(0); await s.wait(250); await s.leave(0); await s.wait(50); const u = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (u) await s.complete(u); await s.wait(300); return { enters: [0], visibleAfter: s.hoverVisible(), staleCompleted: !!u }; },
  Q9: async (s) => {
    await s.enter(0); await s.wait(250); await s.leave(0); await s.enter(0); await s.wait(50);
    const g1 = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (g1) await s.complete(g1);
    const childGenAfterStale = s.hoverChildGen();
    await s.wait(200); const g2 = s.rec.assigns.find((a) => a.gen === 2 && a.path === 'upgradeWhenReady' && a.slot !== 'CANCEL'); if (g2) await s.complete(g2);
    await s.wait(300);
    return { enters: [0, 250], childGenAfterStale, childGenEnd: s.hoverChildGen(), g1Started: !!g1, g2Started: !!g2 };
  },
  Q10: async (s) => { await s.enter(0); await s.wait(50); await s.click(0); await s.wait(700); return { enters: [0], viewerOpen: !!s.BE.modules.viewer?.isOpen?.() }; },
};
const SWEEP = [0, 40, 100, 199, 200, 201, 250];

async function scenario(source, host, quality, id, fix = null) {
  const s = await hh.session({ host, quality, source, extraSetup: withVideoLog(fix) });
  s.startAt();
  const meta = await SCEN[id](s);
  const tl = hh.timeline(s);
  tl.videos = s.w.__videos;
  s.close();
  return { meta, tl };
}
async function sweep(source, host, quality, T, fix = null) {
  const s = await hh.session({ host, quality, source, extraSetup: withVideoLog(fix) });
  s.startAt();
  await s.enter(0); await s.wait(T);
  const videosBeforeLeave = s.w.__videos;
  await s.leave(0); await s.wait(600);
  const tl = hh.timeline(s);
  tl.videos = s.w.__videos; tl.videosBeforeLeave = videosBeforeLeave;
  s.close();
  return tl;
}

const DISPLAYED = { preview: 'PREVIEW', sample: 'SAMPLE', original: 'FILE' };
function invariants(r, quality, { target = 'SAMPLE' } = {}) {
  const tl = r.tl; const enters = r.meta.enters;
  const v = {};
  v.nothingBeforeDwell = hoverAssigns(tl).every((a) => a.t >= enters[a.gen - 1] + DWELL);
  v.noMetadataBeforeDwell = tl.metadata.every((m) => m.t >= enters[m.gen - 1] + DWELL);
  v.overlayIsDisplayedRendition = overlays(tl).every((a) => a.slot.split('|').includes(DISPLAYED[quality]));
  v.ordering = quality === 'preview' ? upgrades(tl).every((a) => a.slot === target) : upgrades(tl).length === 0;
  v.noStaleInstall = tl.installs.every((i) => i.assignedInGen === null || (i.assignedInGen === i.currentGen && i.hoverActive));
  v.noNetwork = tl.network === 0;
  return v;
}

async function main() {
  const detail = {};
  check('production declares the frozen dwell (HOVER_DWELL_MS = 200) exactly once', (PROD.match(/const HOVER_DWELL_MS = 200;/g) || []).length === 1);
  check('production blob differs from the E-stage blob (P-stage change present)', h.gitBlobId(PROD) !== 'bbaf9ac63f5c0292018b974f00c7b30d8b478bb5');

  for (const host of ['e621.net', 'e926.net']) {
    for (const quality of ['preview', 'sample', 'original']) {
      const res = {};
      for (const id of Object.keys(SCEN)) res[id] = await scenario(PROD, host, quality, id);
      const k = `${host} ${quality}`;
      detail[k] = res;
      for (const [id, r] of Object.entries(res)) {
        const inv = invariants(r, quality);
        check(`${k} ${id}: invariants (nothing before dwell, overlay = displayed rendition, ordering, no stale install, no network)`, Object.values(inv).every(Boolean), JSON.stringify([inv, r.tl.assigns, r.tl.metadata]));
      }
      const ups = (id) => upgrades(res[id].tl);
      const ov = (id) => overlays(res[id].tl);
      check(`${k} Q1: overlay (option B) appears at 200, not at enter`, ov('Q1').length === 1 && ov('Q1')[0].t === 200, JSON.stringify(res.Q1.tl.assigns));
      check(`${k} Q2 leave at 199: no overlay, no upgrade, no metadata; overlay hidden`, hoverAssigns(res.Q2.tl).length === 0 && res.Q2.tl.metadata.length === 0 && res.Q2.meta.visibleAfter === false, JSON.stringify(res.Q2.tl));
      check(`${k} Q10 viewer opened before dwell: no hover overlay, upgrade or metadata`, res.Q10.meta.viewerOpen && hoverAssigns(res.Q10.tl).length === 0 && res.Q10.tl.metadata.length === 0, JSON.stringify([res.Q10.meta, res.Q10.tl]));
      if (quality === 'preview') {
        check(`${k} Q1: exactly one SAMPLE upgrade, at 200; thumbnail and upgrade installed`, ups('Q1').length === 1 && ups('Q1')[0].t === 200 && res.Q1.tl.installs.length === 2, JSON.stringify(res.Q1.tl));
        check(`${k} Q5 re-entry: nothing for the old generation; overlay and upgrade at 300`, ups('Q5').map((a) => `${a.t}g${a.gen}`).join() === '300g2' && ov('Q5').map((a) => `${a.t}g${a.gen}`).join() === '300g2', JSON.stringify(res.Q5.tl.assigns));
        check(`${k} Q6 A->B before dwell: A never starts; B at 230`, ups('Q6').map((a) => `${a.t}g${a.gen}`).join() === '230g2' && ov('Q6').map((a) => `${a.t}g${a.gen}`).join() === '230g2', JSON.stringify(res.Q6.tl.assigns));
        check(`${k} Q7 A dwell fires then B: A at 200, cancelled at 250; B at 450`, ups('Q7').map((a) => `${a.t}g${a.gen}`).join() === '200g1,450g2' && res.Q7.tl.assigns.some((a) => a.slot === 'CANCEL' && a.t === 250), JSON.stringify(res.Q7.tl.assigns));
        check(`${k} Q8 stale completion after leave installs nothing; overlay hidden`, res.Q8.meta.staleCompleted && res.Q8.meta.visibleAfter === false && res.Q8.tl.installs.length === 1, JSON.stringify([res.Q8.meta, res.Q8.tl.installs]));
        check(`${k} Q9 stale g1 completion during g2's dwell installs nothing; g2 at 450 installs`, res.Q9.meta.g1Started && res.Q9.meta.g2Started && res.Q9.meta.childGenAfterStale === null && res.Q9.meta.childGenEnd === 2 && ups('Q9').map((a) => `${a.t}g${a.gen}`).join() === '200g1,450g2', JSON.stringify([res.Q9.meta, ups('Q9')]));
      } else {
        check(`${k} Q1: no hover upgrade (displayed ${DISPLAYED[quality]} is neither reloaded nor downgraded); metadata only at 200`, ups('Q1').length === 0 && res.Q1.tl.metadata.map((m) => m.t).join() === '200', JSON.stringify(res.Q1.tl));
      }
    }
    const sweepOut = {};
    for (const T of SWEEP) { const tl = await sweep(PROD, host, 'preview', T); sweepOut[T] = { upgrades: upgrades(tl).map((a) => a.t), overlays: overlays(tl).map((a) => a.t), metadata: tl.metadata.length }; }
    detail[`${host} sweep`] = sweepOut;
    check(`${host} boundary sweep: stays 0/40/100/199 start nothing (no overlay, upgrade or metadata); 200/201/250 start one upgrade at exactly 200`,
      [0, 40, 100, 199].every((T) => !sweepOut[T].upgrades.length && !sweepOut[T].overlays.length && !sweepOut[T].metadata)
      && [200, 201, 250].every((T) => sweepOut[T].upgrades.join() === '200' && sweepOut[T].overlays.join() === '200'), JSON.stringify(sweepOut));

    // Alias: the native sample equals the file.
    for (const quality of ['preview', 'original']) {
      const r = await scenario(PROD, host, quality, 'Q1', FIX.alias);
      const inv = invariants(r, quality, { target: 'SAMPLE|FILE' });
      const ok = quality === 'preview' ? upgrades(r.tl).length === 1 && upgrades(r.tl)[0].t === 200 && upgrades(r.tl)[0].slot === 'SAMPLE|FILE' : upgrades(r.tl).length === 0;
      check(`${host} alias ${quality}: ${quality === 'preview' ? 'one SAMPLE|FILE alias upgrade at 200' : 'displayed alias gets no upgrade'}; invariants`, ok && Object.values(inv).every(Boolean), JSON.stringify([inv, r.tl.assigns]));
    }
    // No usable sample (IB08 pattern not met): thumbnail at dwell, never a FILE load.
    for (const quality of ['preview', 'original']) {
      const r = await scenario(PROD, host, quality, 'Q1', FIX.noSample);
      check(`${host} no usable sample ${quality}: nothing before dwell, thumbnail at 200, no upgrade (no FILE load)`, upgrades(r.tl).length === 0 && overlays(r.tl).map((a) => a.t).join() === '200' && hoverAssigns(r.tl).every((a) => a.t >= 200), JSON.stringify(r.tl.assigns));
      const sw = await sweep(PROD, host, quality, 40, FIX.noSample);
      check(`${host} no usable sample ${quality}: 40 ms sweep starts nothing`, hoverAssigns(sw).length === 0 && sw.metadata.length === 0, JSON.stringify(sw.assigns));
    }
    // Out of scope: identical hover behavior to the E-stage blob.
    for (const [name, fix] of [['video (IB10)', FIX.video], ['GIF (animated)', FIX.gif], ['logged-in page', FIX.loggedIn]]) {
      const strip = (tl) => JSON.stringify({ assigns: tl.assigns, installs: tl.installs, metadata: tl.metadata, network: tl.network, videos: tl.videos, vbl: tl.videosBeforeLeave });
      const same = [];
      for (const T of [40, 250]) same.push(strip(await sweep(PROD, host, 'preview', T, fix)) === strip(await sweep(BASE, host, 'preview', T, fix)));
      const a = await scenario(PROD, host, 'preview', 'Q1', fix); const b = await scenario(BASE, host, 'preview', 'Q1', fix);
      same.push(strip(a.tl) === strip(b.tl));
      check(`${host} out of scope ${name}: hover timeline identical to E-stage production (40 ms sweep, 250 ms stay, sustained)`, same.every(Boolean), JSON.stringify([same, a.tl.assigns, b.tl.assigns]));
    }
  }
  // The video fixture must actually exercise the video path (otherwise the equality above is vacuous).
  {
    const tl = await sweep(BASE, 'e621.net', 'preview', 40, FIX.video);
    check('control: the video fixture starts a video element at enter on the E-stage blob (fixture is live)', tl.videosBeforeLeave >= 1, JSON.stringify(tl));
  }

  // ---- fault controls (mutants of production) ----
  const m = (from, to) => mustReplace(PROD.replace(/\r\n/g, '\n'), from, to);
  const DWELL_ARM = '\t\t\tif (hoverStillCard(img)) {\n\t\t\t\tdwellTimer = setTimeout(() => {';
  const faults = [
    ['dwell removed (work at pointer-enter)', m(DWELL_ARM, '\t\t\tif (false) {\n\t\t\t\tdwellTimer = setTimeout(() => {'), 'preview', 'Q1', null, (r) => !invariants(r, 'preview').nothingBeforeDwell],
    ['option A restored (overlay at pointer-enter)', m(DWELL_ARM, `\t\t\tshowImmediateThumbnail(img, token);\n${DWELL_ARM}`), 'preview', 'Q1', null, (r) => !invariants(r, 'preview').nothingBeforeDwell],
    ['leave fails to cancel the pending dwell (timer kept, token check removed)', m('\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n', '\t\tfunction hide() {\n').replace('\t\t\t\t\tif (token !== requestToken || BE.modules.viewer?.isOpen?.()) return;\n\t\t\t\t\tresolveHover(img, token);', '\t\t\t\t\tif (BE.modules.viewer?.isOpen?.()) return;\n\t\t\t\t\tresolveHover(img, requestToken);'), 'preview', 'Q2', null, (r) => upgrades(r.tl).length > 0],
    ['viewer-before-dwell check removed', m('\t\t\t\t\tif (token !== requestToken || BE.modules.viewer?.isOpen?.()) return;\n', '\t\t\t\t\tif (token !== requestToken) return;\n'), 'preview', 'Q10', null, (r) => hoverAssigns(r.tl).length > 0],
    ['eligibility gate removed (FILE downgraded to SAMPLE)', m('\t\t\tif (still && !(still.qualified && qualifiedUpgradeAllowed(sourceImg, still.wrap, resolved))) {', '\t\t\tif (false) {'), 'original', 'Q1', null, (r) => !invariants(r, 'original').ordering],
    ['SAMPLE redundantly reloads SAMPLE', m('\t\t\treturn showingPreview && same(resolved.url, wrap.dataset.sampleUrl) && !same(resolved.url, current);', '\t\t\treturn true;').replace("\t\t\tif (resolved.mediaType !== 'video' && resolved.url === currentThumbUrl) {\n\t\t\t\tclearMediaState();\n\t\t\t\treturn;\n\t\t\t}", ''), 'sample', 'Q1', null, (r) => !invariants(r, 'sample').ordering],
    ['unqualified still card upgrades (fallback removed)', m('\t\t\tif (still && !(still.qualified && qualifiedUpgradeAllowed(sourceImg, still.wrap, resolved))) {', '\t\t\tif (still && still.qualified && !qualifiedUpgradeAllowed(sourceImg, still.wrap, resolved)) {'), 'preview', 'Q1', FIX.noSample, (r) => upgrades(r.tl).length > 0],
    ['stale image completion installs (install guards removed)', m("\t\t\timage.addEventListener('load', async () => {\n\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;\n\t\t\t\ttry { await image.decode(); } catch { /* load is enough */ }\n\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;\n\t\t\t\tinstallMedia(image, sourceImg, token);",
      "\t\t\timage.addEventListener('load', async () => {\n\t\t\t\ttry { await image.decode(); } catch { /* load is enough */ }\n\t\t\t\tinstallMedia(image, sourceImg, requestToken);"), 'preview', 'Q9', null, (r) => !invariants(r, 'preview').noStaleInstall || r.meta.childGenAfterStale !== null],
  ];
  for (const [name, src, quality, id, fix, caught] of faults) {
    const r = await scenario(src, 'e621.net', quality, id, fix);
    check(`fault ${name}: caught`, caught(r), JSON.stringify([r.meta, hoverAssigns(r.tl), r.tl.metadata]));
  }
  {
    const early = m('\t\tconst HOVER_DWELL_MS = 200;', '\t\tconst HOVER_DWELL_MS = 199;');
    const tl = await sweep(early, 'e621.net', 'preview', 199);
    check('fault dwell 199 ms: caught by the boundary sweep', upgrades(tl).length === 1 && upgrades(tl)[0].t === 199);
  }
  {
    const vid = m("\t\t\tif (!/^(jpe?g|png|webp)$/.test(String(wrap.getAttribute('data-file-ext') || '').toLowerCase())) return null;\n", '');
    const [a, b] = [await sweep(vid, 'e621.net', 'preview', 40, FIX.video), await sweep(BASE, 'e621.net', 'preview', 40, FIX.video)];
    check('fault video brought under the still-image dwell: caught by the out-of-scope equality', JSON.stringify([a.assigns, a.videosBeforeLeave]) !== JSON.stringify([b.assigns, b.videosBeforeLeave]));
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'P-stage production (G-HOVER(e621/e926 qualified still-image class) PASS(scope))', production_blob: h.gitBlobId(PROD), e_stage_blob: h.gitBlobId(BASE), dwellMs: DWELL, fixtures: 'synthetic',
    timelines: Object.fromEntries(Object.entries(detail).map(([k, v]) => [k, k.endsWith('sweep') ? v : Object.fromEntries(Object.entries(v).map(([id, r]) => [id, { meta: r.meta, assigns: r.tl.assigns, installs: r.tl.installs, metadata: r.tl.metadata, network: r.tl.network }]))])),
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'p-stage-result.json'), JSON.stringify(summary, (k, v) => (k === 'el' ? undefined : v), 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
