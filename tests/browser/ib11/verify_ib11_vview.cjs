'use strict';
// Local qualification of the IB11 V-VIEW package and evaluator (IB11-E3; no
// real browser - the browser run belongs to the operator):
//   1. static: package current; executed body = committed production 4d793a2
//      body byte for byte; local-only scope; plan and fixtures;
//   2. server (--media): routes, the slow transport's first-byte delay, the
//      404, the native /posts/<id> destination and attempt bookkeeping;
//   3. smoke (jsdom + vview_sim.cjs simulator): both pages run end to end;
//      every cell's evidence PASSes and the findings are the characterized
//      current behavior;
//   4. faults: untrusted/missing operator input, wrong artifact, wrong route,
//      no destination arrival, stubs not invoked, synthetic modifiers,
//      missing invoker, double toggle, zero dimensions, early-complete
//      original, a seam that did not throw, ambiguous attempts;
//   5. repair probes: candidate production changes (test copies only) flip
//      each defect finding, proving the findings are measured, not assumed.
// Usage: node verify_ib11_vview.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const b = require('./build_ib11_vview.cjs');
const srv = require('./vview_server.cjs');
const { evaluate, REVISION } = require('./vview_evaluate.cjs');
const { smoke } = require('./vview_sim.cjs');
const { split } = require('../ib07/build_production_conformance.cjs');
const { mustReplace } = require('../../host/ib09/dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 800) });
const REPO = path.resolve(__dirname, '../../..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const PROD = execFileSync('git', ['-C', REPO, 'show', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ---- 1. static ----
const PKG = fs.readFileSync(b.OUT, 'utf8');
check('package matches a fresh build', PKG === b.build().text);
check('production at the pinned commit is blob 002bdfd and equals the working tree', execFileSync('git', ['-C', REPO, 'rev-parse', `${b.COMMIT}:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === b.EXPECTED_PRODUCTION_BLOB && h.gitBlobId(h.productionSource()) === b.EXPECTED_PRODUCTION_BLOB);
const body = (t) => t.slice(t.indexOf(b.WRAP_OPEN) + b.WRAP_OPEN.length, t.indexOf(b.WRAP_CLOSE));
check('the package executes the committed production body byte for byte (no hooks)', body(PKG) === split(PROD).body && crypto.createHash('sha256').update(body(PKG), 'utf8').digest('hex') === '009155841b194df21a4e1d22bd3f40b5d63e2f58cfa5485b06fd4e66bd64e945');
const metaOf = (t, k) => split(t).meta.split('\n').filter((l) => new RegExp(`@${k}\\s`).test(l)).map((l) => l.replace(new RegExp(`^// @${k}\\s+`), '')).join();
check('scope: matches only the local V-VIEW server; distinct name/namespace', metaOf(PKG, 'match') === `http://127.0.0.1:${srv.PORT}/*` && /V-VIEW/.test(metaOf(PKG, 'name')) && /ib11-vview/.test(metaOf(PKG, 'namespace')));
const pl = srv.plan();
const roles = pl[0].cards.map((c) => c.role);
check('plan: MAIN starts with FOCUS_K (one Tab), VD6B_A is directly followed by VD6B_B, TAKEOVER has only VD6A; native links are the e621 /posts/<id> route', pl.length === 2 && roles[0] === 'FOCUS_K' && roles.indexOf('VD6B_B') === roles.indexOf('VD6B_A') + 1 && pl[1].cards.map((c) => c.role).join() === 'VD6A' && /href="\/posts\/\d+"/.test(srv.page(pl[0], srv.PORT, { webm: 1 })));
const i1 = srv.images(); const i2 = srv.images();
check('generated fixtures are deterministic plain PNGs (thumb 160x80, wide 2000x1000, slow 1600x800 noise > 3 MB)', Object.keys(i1).every((k) => i1[k].sha256 === i2[k].sha256) && i1.slow.size > 3000000 && i1.wide.buf.readUInt32BE(16) === 2000 && i1.slow.buf.readUInt32BE(20) === 800);
let refused = false; try { srv.createServer({ mediaDir: path.join(__dirname, 'no-such-dir') }); } catch { refused = true; }
check('server refuses to start without the pinned media fixture', refused);

async function serverChecks(mediaDir) {
  const port = 18797;
  const s = srv.createServer({ mediaDir, port, log: () => {} }); await s.listen();
  const base = `http://127.0.0.1:${port}`; const [pm, pt] = s.pages;
  const html = await (await fetch(`${base}/posts?page=${pm.token}`)).text();
  const t0 = Date.now(); const slow = await fetch(`${base}/vview/img/${pm.token}/VD7-slow.png`); const firstByte = Date.now() - t0; slow.body && slow.body.cancel && slow.body.cancel().catch(() => {});
  const fail = await fetch(`${base}/vview/img/${pm.token}/VD1-fail.png`);
  const nat = await fetch(`${base}/posts/${pm.cards.find((c) => c.role === 'NATIVE').id}`); const natText = await nat.text();
  await fetch(`${base}/vview/result`, { method: 'POST', body: JSON.stringify({ token: pt.token, identity: 'MATCH_EXPECTED_ARTIFACT', error: 'PROMPT_TIMEOUT x', cells: {} }) });
  await new Promise((r) => s.server.close(r));
  check('server: MAIN page served with the run config', /id="ib11v-run"/.test(html) && html.includes(pm.token));
  check('server: slow original holds its first byte >= 1.4 s', slow.status === 200 && firstByte >= 1400, `status ${slow.status}, ${firstByte} ms`);
  check('server: failure route answers 404', fail.status === 404);
  check('server: /posts/<id> records the native arrival (page + card) and forwards to the next page', nat.status === 200 && s.arrivals.some((a) => a.page === 'MAIN' && a.card === 'NATIVE') && natText.includes(pt.token));
  check('server: an INVALID attempt is kept with its attempt number', s.attempts.length === 1 && s.attempts[0].attempt === 1 && s.attempts[0].client.error);
}

const cellOf = (doc, id) => { for (const p of doc.pages) if (p.client && p.client.cells && p.client.cells[id]) return p.client.cells[id]; return null; };
const cellR = (r, id) => r.cells.find((c) => c.id === id);

async function main() {
  const mediaDir = arg('--media');
  if (mediaDir) await serverChecks(mediaDir); else check('server checks need --media <fixture folder>', false);

  // ---- 3. smoke ----
  const { doc } = await smoke(PKG);
  const r = evaluate(clone(doc));
  check(`smoke: both pages valid; evaluator revision ${REVISION}: evidence PASS on all 11 cells`, r.evidencePass && r.counts.PASS === 11, JSON.stringify({ problems: r.problems, bad: r.cells.filter((c) => c.evidence !== 'PASS') }));
  const want = { VD7: 'DEFECT_CONFIRMED', VD6B: 'DEFECT_CONFIRMED', VD1: 'DEFECT_CONFIRMED', VD5SYN: 'CONTROL_ONLY', VD4: 'DEFECT_CONFIRMED', VD5: 'DEFECT_CONFIRMED', G3: 'BEHAVIOR_OK', FOCUS_M: 'OBSERVED', FOCUS_K: 'OBSERVED', NATIVE: 'BEHAVIOR_OK', VD6A: 'DEFECT_CONFIRMED' };
  check('smoke findings = the source-characterized current behavior (V-D7/V-D4/V-D6b/V-D1/V-D5/V-D6a confirmed; single Space toggle; native link navigates)', Object.entries(want).every(([k, v]) => r.findings[k] === v), JSON.stringify(r.findings));
  check('evidence and product finding are separate: confirmed defects still have evidence PASS', ['VD7', 'VD4', 'VD6B', 'VD1', 'VD5', 'VD6A'].every((k) => cellR(r, k).evidence === 'PASS' && cellR(r, k).finding.code === 'DEFECT_CONFIRMED'));
  check('V-D6a separates "overlay left shown" from "native recovery blocked"', /overlay left shown/.test(cellR(r, 'VD6A').finding.detail.summary) && cellR(r, 'VD6A').finding.detail.destinationArrived === true);

  // ---- 4. faults (evidence) ----
  const ef = (name, id, f, verdict) => { const d = clone(doc); f(d, cellOf(d, id)); const rr = evaluate(d); const c = cellR(rr, id);
    check(`fault: ${name}: ${verdict}`, !rr.evidencePass && c && c.evidence === verdict, JSON.stringify(c)); };
  ef('untrusted operator input (Enter on the blue card)', 'FOCUS_K', (d, c) => { c.enter.trusted = false; }, 'INVALID');
  ef('synthetic modifier input offered as the trusted Ctrl+F', 'VD5', (d, c) => { c.chords[0].trusted = false; }, 'INVALID');
  ef('untrusted F11 resize', 'VD4', (d, c) => { c.resize1.trusted = false; }, 'INVALID');
  ef('programmatic native-link click', 'NATIVE', (d, c) => { c.click.trusted = false; }, 'INVALID');
  ef('wrong fixture route (early media not the slow original)', 'VD7', (d, c) => { c.samples[0].media.label = 'OTHER'; }, 'FAIL');
  ef('fixture route never requested (404 route missing)', 'VD1', (d) => { d.requests = d.requests.filter((x) => x.label !== 'VD1-fail'); }, 'FAIL');
  ef('navigation never reaches the native destination', 'NATIVE', (d) => { d.arrivals = d.arrivals.filter((a) => a.page !== 'MAIN'); }, 'FAIL');
  ef('takeover page left but no destination arrival', 'VD6A', (d) => { d.arrivals = d.arrivals.filter((a) => a.page !== 'TAKEOVER'); }, 'FAIL');
  ef('focus evidence with no invoking element', 'FOCUS_M', (d, c) => { c.invoker = null; }, 'FAIL');
  ef('visual measurement with zero stage dimensions', 'VD4', (d, c) => { c.sA.stage.w = 0; }, 'FAIL');
  ef('visual measurement missing (no media box)', 'VD7', (d, c) => { c.samples[1].stage = null; }, 'FAIL');
  ef('original already complete at the early sample', 'VD7', (d, c) => { c.samples[0].media.complete = true; }, 'INVALID');
  ef('V-D6b seam did not throw', 'VD6B', (d, c) => { c.seam = []; }, 'INVALID');
  ef('V-D6a seam did not throw', 'VD6A', (d, c) => { c.seam = []; }, 'INVALID');
  ef('G3 premise: the native control was not focused at Space', 'G3', (d, c) => { c.space.active = { tag: 'BODY' }; }, 'INVALID');
  ef('trusted input outside a prompt during an automatic cell', 'VD1', (d, c) => { c.outsideTrusted = 1; }, 'INVALID');
  { const d = clone(doc); d.pages.push(clone(d.pages[0])); d.pages[d.pages.length - 1].attempt = 2; const rr = evaluate(d); check('fault: ambiguous duplicate valid attempts: rejected', !rr.evidencePass && rr.problems.some((x) => /AMBIGUOUS/.test(x)) && rr.cells.filter((c) => ['VD7', 'NATIVE'].includes(c.id)).every((c) => c.evidence === 'INVALID'), JSON.stringify(rr.problems)); }
  { const d = clone(doc); const c = cellOf(d, 'VD5'); c.chords.forEach((x) => { x.fav = 0; x.dl = 0; }); const rr = evaluate(d); check('fault: Favorite/Download stubs not invoked -> finding DEFECT_NOT_REPRODUCED (distinguishable; evidence still valid)', cellR(rr, 'VD5').finding.code === 'DEFECT_NOT_REPRODUCED' && cellR(rr, 'VD5').evidence === 'PASS'); }
  { const d = clone(doc); const c = cellOf(d, 'G3'); c.events = [[c.space.t + 10, 'pause'], [c.space.t + 20, 'play']]; c.pausedAfter = c.pausedBefore; const rr = evaluate(d); check('fault: a Space with two effective toggles is distinguished from one (double -> DEFECT_CONFIRMED)', cellR(rr, 'G3').finding.code === 'DEFECT_CONFIRMED' && cellR(rr, 'G3').finding.detail.kind === 'double' && cellR(r, 'G3').finding.detail.kind === 'single'); }
  { const rr = evaluate({ probe: 'something-else' }); check('fault: wrong result type rejected', !rr.evidencePass); }

  // ---- 4b. faults (packages) ----
  const mut = (from, to) => b.build({ bodyTransform: (x) => mustReplace(x, from, to) }).text;
  { const { doc: d } = await smoke(mut("\tBE.modules.viewer = (() => {", "\tBE.modules.viewer = (() => { void 0;")); const rr = evaluate(d);
    check('fault: wrong production artifact -> identity MISMATCH rejected', !rr.evidencePass && rr.problems.some((x) => /identity MISMATCH/.test(x)), JSON.stringify(rr.problems)); }
  { const { doc: d, uis } = await smoke(PKG, { skip: ['Escape'] }); const rr = evaluate(d);
    check('fault: missing prompt action (Escape never pressed) -> PROMPT_TIMEOUT, MAIN attempt INVALID, panel says INVALID', !rr.evidencePass && rr.invalidAttempts.some((x) => x.page === 'MAIN' && /PROMPT_TIMEOUT/.test(x.error)) && /INVALID/.test(uis[0].msg) && /INVALID/.test(uis[0].title), JSON.stringify({ inv: rr.invalidAttempts, ui: uis[0] })); }
  { const { doc: d } = await smoke(mut('\t\t\tif (fn) { e.preventDefault(); fn(); }', '\t\t\tif (fn) { fn(); }'), { forceIdentity: true }); const rr = evaluate(d);
    check('fault: production no longer suppresses the native Space -> double toggle detected (G3 DEFECT_CONFIRMED, double)', cellR(rr, 'G3').finding.code === 'DEFECT_CONFIRMED' && cellR(rr, 'G3').finding.detail.kind === 'double', JSON.stringify(cellR(rr, 'G3'))); }

  // ---- 5. repair probes (test copies only; each flips one finding) ----
  const probe = async (name, id, from, to, code) => { const { doc: d } = await smoke(mut(from, to), { forceIdentity: true }); const rr = evaluate(d); const c = cellR(rr, id);
    check(`repair probe: ${name}: ${id} finding -> ${code}`, c && c.finding && c.finding.code === code, JSON.stringify(c)); };
  await probe('a staged preview placeholder while the original loads (V-D7)', 'VD7', "\t\t\tstage.appendChild(mediaEl);\n\t\t\tif (mediaEl.tagName === 'VIDEO') {", "\t\t\tstage.appendChild(mediaEl);\n\t\t\tif (mediaEl.tagName === 'IMG' && post?.previewUrl) { const ph = document.createElement('img'); ph.src = post.previewUrl; stage.appendChild(ph); mediaEl.addEventListener('load', () => ph.remove()); }\n\t\t\tif (mediaEl.tagName === 'VIDEO') {", 'BEHAVIOR_OK');
  await probe('fit uses the rotated box (V-D4)', 'VD4', '\t\t\tconst { width, height } = intrinsicSize();\n\t\t\tif (!(width > 0) || !(height > 0)) return 1;\n\n\t\t\tconst rect = stage.getBoundingClientRect();\n\t\t\tconst availableWidth',
    '\t\t\tconst nat = intrinsicSize(); const qt = Math.abs(Math.round(rotation / 90)) % 2; const width = qt ? nat.height : nat.width; const height = qt ? nat.width : nat.height;\n\t\t\tif (!(width > 0) || !(height > 0)) return 1;\n\n\t\t\tconst rect = stage.getBoundingClientRect();\n\t\t\tconst availableWidth', 'BEHAVIOR_OK');
  await probe('build failure shows the failed state (V-D6b)', 'VD6B', '\t\t\tmediaEl = buildMedia(post);\n', "\t\t\ttry { mediaEl = buildMedia(post); } catch (err) { mediaEl = null; showMediaState('Media failed to load', ++mediaGeneration, 0, true); return; }\n", 'BEHAVIOR_OK');
  await probe('same-URL update keeps the failed state (V-D1)', 'VD1', '\t\t\tupdateStatus(post);\n\t\t\tclearMediaState();\n', '\t\t\tupdateStatus(post);\n', 'BEHAVIOR_OK');
  await probe('viewer-key modifier guard (V-D5)', 'VD5', "\t\t\tif (!overlay || overlay.style.display !== 'flex') return;\n\t\t\tconst keys = {", "\t\t\tif (!overlay || overlay.style.display !== 'flex') return;\n\t\t\tif (e.ctrlKey || e.metaKey || e.altKey) return;\n\t\t\tconst keys = {", 'DEFECT_NOT_REPRODUCED');
  await probe('safe takeover shows the failure with a native link (V-D6a)', 'VD6A', '\t\t\tmediaEl = buildMedia(post);\n', "\t\t\ttry { mediaEl = buildMedia(post); } catch (err) { mediaEl = null; showMediaState('Media failed to load', ++mediaGeneration, 0, true); return; }\n", 'BEHAVIOR_OK');

  const passed = results.filter((x) => x.pass).length;
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  fs.writeFileSync(path.join(__dirname, 'IB11_VVIEW_VERIFICATION.json'), `${JSON.stringify({ probe: 'ib11-vview-verification', commit: b.COMMIT, blob: b.EXPECTED_PRODUCTION_BLOB, evaluatorRevision: REVISION, passed, total: results.length, smokeFindings: r.findings, results }, null, 1)}\n`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2;
main().catch((e) => { console.error(e); process.exitCode = 2; });
