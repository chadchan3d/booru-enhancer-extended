'use strict';
// IB09 E-stage baseline: current production hover behavior on the IB08-
// qualified e621/e926 still-image card pattern (logged out, /posts, two-source
// WebP/JPEG cards), for each grid quality (preview / sample / original).
// No dwell is chosen; "before dwell" means synchronous with, or shortly after,
// pointer-enter while the pointer is still on the card (t < leave time).
// Scenarios:
//   S1 enter + sustained hover (pending upgrade completed at t=300)
//   S2 40 ms sweep (enter, leave at 40)
//   S3 enter, leave at 150
//   S4 enter, leave at 50, re-enter same card at 100
//   S5 enter card A, at 30 leave A and enter card B
//   S6 stale: enter, leave at 50, gen-1 upgrade load completes at 100
//   S7 stale: enter, leave at 30, re-enter at 30 (gen 2), gen-1 load completes at 80, gen-2 at 120
//   S8 viewer: enter, click the card at 50 (viewer opens), observe to 500
// Fault controls (production mutants or harness faults) must each be caught.
// Output holds classes, times, counts and paths only (no URLs).
const fs = require('fs');
const path = require('path');
const Module = require('module');
const hh = require('./hover_harness.cjs');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

const SCENARIOS = {
  S1: async (s) => { await s.enter(0); await s.wait(300); const up = s.rec.assigns.find((a) => a.path === 'upgradeWhenReady'); if (up) await s.complete(up); await s.wait(700); return { leaveAt: null }; },
  S2: async (s) => { await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(500); return { leaveAt: 40 }; },
  S3: async (s) => { await s.enter(0); await s.wait(150); await s.leave(0); await s.wait(500); return { leaveAt: 150 }; },
  S4: async (s) => { await s.enter(0); await s.wait(50); await s.leave(0); await s.wait(50); await s.enter(0); await s.wait(500); return { leaveAt: 50, reenterAt: 100 }; },
  S5: async (s) => { await s.enter(0); await s.wait(30); await s.leave(0); await s.enter(1); await s.wait(500); return { leaveAt: 30 }; },
  S6: async (s) => { await s.enter(0); await s.wait(50); await s.leave(0); await s.wait(50); const up = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady'); if (up) await s.complete(up); await s.wait(400); return { leaveAt: 50, staleCompletedAt: up ? 100 : null, visibleAfter: s.hoverVisible() }; },
  S7: async (s) => {
    await s.enter(0); await s.wait(30); await s.leave(0); await s.enter(0);
    await s.wait(50); const g1 = s.rec.assigns.find((a) => a.gen === 1 && a.path === 'upgradeWhenReady'); if (g1) await s.complete(g1);
    const childGenAfterStale = s.hoverChildGen();
    await s.wait(40); const g2 = s.rec.assigns.find((a) => a.gen === 2 && a.path === 'upgradeWhenReady'); if (g2) await s.complete(g2);
    await s.wait(400);
    return { leaveAt: 30, reenterAt: 30, gen1CompletedAt: g1 ? 80 : null, gen2CompletedAt: g2 ? 120 : null, childGenAfterStale, childGenEnd: s.hoverChildGen() };
  },
  S8: async (s) => { await s.enter(0); await s.wait(50); await s.click(0); const visibleAfterClick = s.hoverVisible(); await s.wait(450); return { clickAt: 50, hoverVisibleAfterClick: visibleAfterClick, viewerOpen: !!s.w.document.querySelector('.be-viewer-overlay, #be-viewer, [class*="be-viewer"]') }; },
};

function findings(tl, meta) {
  const leaveAt = meta.leaveAt;
  const real = tl.assigns.filter((a) => a.slot !== 'CANCEL');
  const onCard = (a) => leaveAt === null || a.t < leaveAt;
  return {
    firstAssignT: real.length ? Math.min(...real.map((a) => a.t)) : null,
    assignsBeforeLeave: real.filter(onCard).length,
    assignSlotsBeforeLeave: [...new Set(real.filter(onCard).map((a) => `${a.path}:${a.slot}`))].sort(),
    upgradeAssignsBeforeLeave: real.filter((a) => onCard(a) && a.path === 'upgradeWhenReady').length,
    cancelsAtLeave: tl.assigns.filter((a) => a.slot === 'CANCEL').length,
    installsTotal: tl.installs.length,
    staleInstalls: tl.installs.filter((i) => i.assignedInGen !== null && (i.assignedInGen < i.currentGen || !i.hoverActive)).length,
    metadataCalls: tl.metadata.map((m) => `${m.t}:${m.name}`),
    network: tl.network,
  };
}

async function runAll(source, { hosts = ['e621.net', 'e926.net'], qualities = ['preview', 'sample', 'original'], only = null } = {}) {
  const out = {};
  for (const host of hosts) for (const quality of qualities) for (const [id, fn] of Object.entries(SCENARIOS)) {
    if (only && !only.includes(id)) continue;
    const s = await hh.session({ host, quality, source });
    s.startAt();
    const meta = await fn(s);
    const tl = hh.timeline(s);
    out[`${host} ${quality} ${id}`] = { meta, timeline: tl, findings: findings(tl, meta) };
    s.close();
  }
  return out;
}

// Classifier self-test (native-slot vocabulary), run against a classifier function.
function classifierSelfTest(classify) {
  const { JSDOM } = require(path.resolve(__dirname, '../ib07/node_modules/jsdom'));
  const d = new JSDOM(hh.card('7')).window.document;
  const el = d.querySelector('article'); const u = hh.U('7'); const base = 'https://e621.net/posts';
  const alias = new JSDOM(hh.card('8').replace(/data-file-url="[^"]*"/, `data-file-url="${hh.U('8').sample}"`)).window.document.querySelector('article');
  return classify(u.preview, el, base) === 'PREVIEW' && classify(u.webp, el, base) === 'PREVIEW' && classify(u.sample, el, base) === 'SAMPLE'
    && classify(u.file, el, base) === 'FILE' && classify(`${hh.M}/other.png`, el, base) === 'UNKNOWN' && classify('data:,', el, base) === 'CANCEL'
    && classify(hh.U('8').sample, alias, base) === 'SAMPLE|FILE';
}

async function main() {
  const base = await runAll(PROD);
  const F = (k) => base[k].findings; const M = (k) => base[k].meta; const T = (k) => base[k].timeline;

  check('classifier: native slots classified (preview, WebP preview, sample, file, unknown, cancel, file==sample alias)', classifierSelfTest(hh.classifySlot));
  for (const host of ['e621.net', 'e926.net']) {
    const k = (q, s) => `${host} ${q} ${s}`;
    // Characterization of current production (these are observed facts, not acceptance).
    check(`${host} S1 all qualities: hover media assigned synchronously with pointer-enter (t=0) and installed at t=0`, ['preview', 'sample', 'original'].every((q) => F(k(q, 'S1')).firstAssignT === 0 && T(k(q, 'S1')).installs[0]?.t === 0), JSON.stringify(['preview', 'sample', 'original'].map((q) => F(k(q, 'S1')))));
    check(`${host} S1 preview: immediate PREVIEW thumbnail plus a SAMPLE upgrade load, both at t=0`, JSON.stringify(F(k('preview', 'S1')).assignSlotsBeforeLeave) === JSON.stringify(['showImmediateThumbnail:PREVIEW', 'upgradeWhenReady:SAMPLE']), JSON.stringify(F(k('preview', 'S1'))));
    check(`${host} S1 sample: immediate SAMPLE thumbnail only (the upgrade equals the displayed rendition)`, JSON.stringify(F(k('sample', 'S1')).assignSlotsBeforeLeave) === JSON.stringify(['showImmediateThumbnail:SAMPLE']), JSON.stringify(F(k('sample', 'S1'))));
    check(`${host} S1 original: immediate FILE thumbnail plus a SAMPLE "upgrade" load at t=0 (slot-name choice)`, JSON.stringify(F(k('original', 'S1')).assignSlotsBeforeLeave) === JSON.stringify(['showImmediateThumbnail:FILE', 'upgradeWhenReady:SAMPLE']), JSON.stringify(F(k('original', 'S1'))));
    check(`${host} S2 40 ms sweep incurs a hover-media assignment before leaving on every quality; a SAMPLE load on preview/original`, ['preview', 'sample', 'original'].every((q) => F(k(q, 'S2')).assignsBeforeLeave >= 1) && F(k('preview', 'S2')).upgradeAssignsBeforeLeave === 1 && F(k('original', 'S2')).upgradeAssignsBeforeLeave === 1, JSON.stringify(['preview', 'sample', 'original'].map((q) => F(k(q, 'S2')))));
    check(`${host} S2/S3 leave cancels the pending upgrade (CANCEL sentinel) and hides the overlay`, F(k('preview', 'S2')).cancelsAtLeave === 1 && F(k('preview', 'S3')).cancelsAtLeave === 1, JSON.stringify([F(k('preview', 'S2')), F(k('preview', 'S3'))]));
    check(`${host} no network request in any scenario; metadata is a cache hit at t=0 (startup native enrichment)`, Object.keys(base).filter((x) => x.startsWith(host)).every((x) => F(x).network === 0) && F(k('preview', 'S1')).metadataCalls.join() === '0:gallery.getCachedPost', JSON.stringify(F(k('preview', 'S1')).metadataCalls));
    check(`${host} S4 re-entry: a new generation assigns again at re-entry`, T(k('preview', 'S4')).assigns.some((a) => a.gen === 2 && a.t === 100 && a.path === 'upgradeWhenReady'), JSON.stringify(T(k('preview', 'S4')).assigns));
    check(`${host} S5 A->B: B assigns at t=30 in a new generation; A's pending upgrade is cancelled`, T(k('preview', 'S5')).assigns.some((a) => a.gen === 2 && a.t === 30 && a.path === 'upgradeWhenReady') && F(k('preview', 'S5')).cancelsAtLeave >= 1, JSON.stringify(T(k('preview', 'S5')).assigns));
    check(`${host} S6 stale after leave: the gen-1 load completing after leave installs nothing; overlay stays hidden`, F(k('preview', 'S6')).staleInstalls === 0 && M(k('preview', 'S6')).visibleAfter === false && M(k('preview', 'S6')).staleCompletedAt === 100, JSON.stringify([F(k('preview', 'S6')), M(k('preview', 'S6'))]));
    check(`${host} S7 stale gen-1 load during gen 2 installs nothing; gen-2 load installs`, F(k('preview', 'S7')).staleInstalls === 0 && M(k('preview', 'S7')).childGenAfterStale === 2 && M(k('preview', 'S7')).childGenEnd === 2, JSON.stringify([F(k('preview', 'S7')), M(k('preview', 'S7'))]));
    check(`${host} S8 viewer: click opens the viewer; hover is not hidden by the click itself`, M(k('preview', 'S8')).hoverVisibleAfterClick === true, JSON.stringify(M(k('preview', 'S8'))));
  }

  // ---- fault controls ----
  const mut = (s, a, b) => { if (s.split(a).length !== 2) throw new Error(`pattern not unique: ${a.slice(0, 60)}`); return s.replace(a, b); };
  const SHOW_HEAD = '\t\t\tconst token = ++requestToken;\n\t\t\tactiveUpgradeUrl = \'\';';
  const faults = [
    ['immediate request on pointer-enter', mut(PROD, SHOW_HEAD, `${SHOW_HEAD}\n\t\t\tBE.net.request({ url: location.origin + '/posts.json' }, 1).catch(() => {});`), 'sample', ['S2'], (r) => r.findings.network > 0],
    ['immediate FILE source swap where baseline has none (sample quality)', mut(PROD, "\t\t\tconst direct = directUpgradeFromDom(img);", "\t\t\tconst direct = { url: img.closest('article')?.getAttribute('data-file-url'), mediaType: 'image' };"), 'sample', ['S1'], (r) => r.findings.assignSlotsBeforeLeave.includes('upgradeWhenReady:FILE')],
    // Every leave-side guard removed: hide() neither bumps the token nor clears activeUpgradeUrl, and nothing is cancelled.
    ['stale result applies after leave (hide invalidates nothing)', mut(PROD, "\t\tfunction hide() {\n\t\t\trequestToken++;\n\t\t\tactiveUpgradeUrl = '';\n\t\t\tclearMediaState();\n\t\t\tcancelPendingUpgrade();", '\t\tfunction hide() {\n\t\t\tclearMediaState();'), 'preview', ['S6'], (r) => r.findings.staleInstalls > 0 || r.meta.visibleAfter === true],
    ['stale gen-1 result applies during gen 2 (load guard removed)', mut(PROD, "\t\t\timage.addEventListener('load', async () => {\n\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;\n\t\t\t\ttry { await image.decode(); } catch { /* load is enough */ }\n\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) return;",
      "\t\t\timage.addEventListener('load', async () => {\n\t\t\t\ttry { await image.decode(); } catch { /* load is enough */ }").replace('\t\t\t\tinstallMedia(image, sourceImg, token);\n\t\t\t}, { once: true });', '\t\t\t\tinstallMedia(image, sourceImg, requestToken);\n\t\t\t}, { once: true });'), 'preview', ['S7'], (r) => r.findings.staleInstalls > 0 || r.meta.childGenAfterStale === 1],
    // Both upgrade triggers (DOM-direct and metadata path) go through upgradeWhenReady; delay it to t=20.
    ['sweep cost moved to t=20 (inside a 40 ms sweep)', mut(PROD, '\t\tfunction upgradeWhenReady(resolved, sourceImg, token) {\n', '\t\tfunction upgradeWhenReady(resolved, sourceImg, token) { setTimeout(() => upgradeLater(resolved, sourceImg, token), 20); }\n\t\tfunction upgradeLater(resolved, sourceImg, token) {\n'), 'preview', ['S2'],
      (r) => r.timeline.assigns.some((a) => a.t === 20 && a.slot === 'SAMPLE') && !r.timeline.assigns.some((a) => a.t === 0 && a.slot === 'SAMPLE') && r.findings.assignsBeforeLeave === 2],
  ];
  for (const [name, src, quality, only, detect] of faults) {
    const r = await runAll(src, { hosts: ['e621.net'], qualities: [quality], only });
    const key = `e621.net ${quality} ${only[0]}`;
    check(`fault ${name}: caught`, detect(r[key]), JSON.stringify(r[key].findings));
  }
  // Negative control: a dwell-gated build (all hover work after 300 ms) shows no assignment in a 40 ms sweep - the detectors are not vacuous.
  {
    const gated = mut(PROD, '\t\tasync function show(img) {\n\t\t\tif (!hoverEl) init();', '\t\tasync function show(img) {\n\t\t\tconst gate = requestToken; await new Promise((r) => setTimeout(r, 300)); if (gate !== requestToken) return;\n\t\t\tif (!hoverEl) init();');
    const r = await runAll(gated, { hosts: ['e621.net'], qualities: ['preview'], only: ['S2', 'S1'] });
    check('negative control: a dwell-gated build has zero assignments in a 40 ms sweep, and still assigns on sustained hover', r['e621.net preview S2'].findings.assignsBeforeLeave === 0 && r['e621.net preview S1'].findings.firstAssignT === 300, JSON.stringify([r['e621.net preview S2'].findings, r['e621.net preview S1'].findings]));
  }
  // Harness fault: a mis-mapped classifier (SAMPLE and FILE swapped) must fail the classifier self-test.
  {
    const file = path.join(__dirname, 'hover_harness.cjs');
    const src = fs.readFileSync(file, 'utf8').replace("['SAMPLE', 'data-sample-url'], ['FILE', 'data-file-url']", "['SAMPLE', 'data-file-url'], ['FILE', 'data-sample-url']");
    const m = new Module(file, module); m.filename = file; m.paths = module.paths; m._compile(src, file);
    check('fault incorrect native-slot classification: caught by the classifier self-test', src !== fs.readFileSync(file, 'utf8') && !classifierSelfTest(m.exports.classifySlot));
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB09', stage: 'E-stage baseline characterization (no production change)', production_blob: h.gitBlobId(PROD), fixtures: 'synthetic',
    clock: 'fake (setTimeout/setInterval/requestAnimationFrame); t = ms since first pointer-enter', scenarios: base,
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ') || x.name.startsWith('negative')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'hover-baseline-result.json'), JSON.stringify(summary, (k, v) => (k === 'el' ? undefined : v), 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
