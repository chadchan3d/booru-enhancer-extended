'use strict';
// Local qualification of the IB10 P controlled-conformance cell recovery
// (test-only; no production or P-package change):
//   1. the exact --cells selector: the nine recovery cells, once each, in the
//      canonical order; malformed / unknown / duplicate / empty selectors and
//      --only combined with --cells are refused; the full plan is unchanged;
//   2. the server over real HTTP with the selector: the start page leads to the
//      first selected cell and the result chain visits exactly the nine;
//      the CLI refuses a bad selector before listening;
//   3. the merge step on synthetic results: original 45 + recovery 9 -> 54 and
//      PASS; refused or failing otherwise (fault controls);
//   4. the P package and production are unchanged.
// Usage: node verify_ib10_p_recovery.cjs --media <fixture folder>
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawnSync, execFileSync } = require('child_process');
const srv = require('./v3c_server.cjs');
const { merge } = require('./merge_ib10_p_controlled.cjs');
const pc = require('./build_ib10_p_conformance.cjs');
const h = require(path.resolve(__dirname, '../../host/ib07/item9_harness.cjs'));

const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 500) });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MEDIA_DIR = arg('--media');
const REPO = path.resolve(__dirname, '../../..');
const RECOVERY = ['RANGE/mp4/LEAVE_PENDING', 'RANGE/mp4/LEAVE_LOADEDDATA', 'RANGE/mp4/LEAVE_FIRST_FRAME', 'RANGE/webm/CYCLES_5', 'NORANGE/mp4/LEAVE_FIRST_FRAME', 'NORANGE/mp4/CYCLES_5', 'NORANGE/mp4/VIEWER_PENDING', 'NORANGE/webm/LEAVE_LOADEDDATA', 'FAST/mp4/DISPOSE'];
const key = (r) => `${r.transport}/${r.container}/${r.scenario}`;
const refused = (fn) => { try { fn(); return false; } catch { return true; } };

async function main() {
  // ---- 1. selector ----
  const p9 = srv.plan(null, RECOVERY.join(','));
  check('selector: exactly the nine requested cells, once each', p9.length === 9 && new Set(p9.map(key)).size === 9 && RECOVERY.every((c) => p9.some((r) => key(r) === c)), JSON.stringify(p9.map(key)));
  const full = srv.plan(null);
  check('selector: the nine run in the canonical full-plan order (input order does not matter)', JSON.stringify(srv.plan(null, [...RECOVERY].reverse().join(',')).map(key)) === JSON.stringify(full.map(key).filter((k) => RECOVERY.includes(k))));
  check('full plan unchanged without --cells: 54 cells = 3 transports x 2 containers x 9 scenarios, same order as before', full.length === 54 && JSON.stringify(full.map(key)) === JSON.stringify(srv.TRANSPORTS.flatMap((t) => srv.CONTAINERS.flatMap((c) => srv.SCENARIOS.map((s) => `${t}/${c}/${s}`)))));
  check('--only behavior unchanged (scenario filter, 6 cells per scenario)', srv.plan(['DISPOSE']).length === 6 && srv.plan(['DISPOSE']).every((r) => r.scenario === 'DISPOSE'));
  check('fault unknown transport refused', refused(() => srv.plan(null, 'SLOW/mp4/DISPOSE')));
  check('fault unknown container refused', refused(() => srv.plan(null, 'RANGE/mkv/DISPOSE')));
  check('fault unknown scenario refused', refused(() => srv.plan(null, 'RANGE/mp4/LEAVE_LATER')));
  check('fault malformed item refused (missing part / wrong separator / lower-case transport)', refused(() => srv.plan(null, 'RANGE/mp4')) && refused(() => srv.plan(null, 'RANGE|mp4|DISPOSE')) && refused(() => srv.plan(null, 'range/mp4/DISPOSE')));
  check('fault duplicate cell refused', refused(() => srv.plan(null, 'FAST/mp4/DISPOSE,FAST/mp4/DISPOSE')));
  check('fault empty selector refused', refused(() => srv.plan(null, '')) && refused(() => srv.plan(null, ' , ')));
  check('fault --only combined with --cells refused', refused(() => srv.plan(['DISPOSE'], 'FAST/mp4/DISPOSE')));

  // ---- 2. server with the selector ----
  if (MEDIA_DIR) {
    const port = 8797;
    const s = srv.createServer({ mediaDir: MEDIA_DIR, port, cells: RECOVERY.join(','), log: () => {} });
    await s.listen();
    const get = (p, method = 'GET', body = null) => new Promise((resolve) => { const q = http.request({ host: '127.0.0.1', port, path: p, method, headers: body ? { 'Content-Type': 'application/json' } : {} }, (res) => { const c = []; res.on('data', (x) => c.push(x)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(c).toString() })); }); q.end(body); });
    const st = await get('/v3c/start');
    const first = s.runs[0];
    check('server: 9 runs; /v3c/start leads to the first selected cell', s.runs.length === 9 && st.status === 302 && st.headers.location === `/posts?run=${first.token}` && key(first) === p9.map(key)[0]);
    const visited = [];
    let next = `/posts?run=${first.token}`;
    while (next) {
      const tok = /run=([0-9a-f]{16})/.exec(next)[1];
      const run = s.runs.find((r) => r.token === tok); visited.push(key(run));
      const pg = await get(next);
      if (pg.status !== 200 || !pg.body.includes(`"scenario":"${run.scenario}"`) || !pg.body.includes(`"transport":"${run.transport}"`)) { visited.push('BAD_PAGE'); break; }
      const r = await get('/v3c/result', 'POST', JSON.stringify({ token: tok, marks: [], videos: [] }));
      next = JSON.parse(r.body).next;
    }
    check('server: the result chain visits exactly the nine cells once, then ends', JSON.stringify(visited) === JSON.stringify(p9.map(key)), JSON.stringify(visited));
    await new Promise((r) => s.server.close(r));
    const cli = spawnSync(process.execPath, [path.join(__dirname, 'v3c_server.cjs'), '--media', MEDIA_DIR, '--port', '8798', '--cells', 'RANGE/mp4/NOPE'], { encoding: 'utf8', timeout: 20000 });
    check('CLI: a bad --cells selector is refused before listening (exit 1)', cli.status === 1 && /refused: unknown cell/.test(cli.stderr), `${cli.status} ${cli.stderr}`);
  } else check('server checks need --media', false);

  // ---- 3. merge (synthetic results) ----
  const mk = (t, c, s, mutate = null) => {
    const O = 1e6;
    let r = { run: { scenario: s, container: c, transport: t }, client: { identity: 'MATCH_EXPECTED_ARTIFACT', timeOrigin: O, trustedPointerEvents: 0, error: null,
      marks: [{ t: 10, what: 'start' }, { t: 100, what: 'enter', card: 'A' }, ...(s.startsWith('VIEWER_') ? [{ t: 690, what: 'click', card: 'A' }] : []), { t: 700, what: 'leave', card: 'A' }, { t: 700, what: 'cleanup', kind: 'leave' }, { t: 5700, what: 'windowEnd' }],
      videos: s === 'LEAVE_PENDING' ? [] : [{ owner: 'hover', label: 'A', created: 300, ev: [[420, 'loadeddata']], calls: [[300, 'src', 'A'], [300, 'load', 'muted'], [420, 'play', 'muted'], [690, 'pause', 'muted'], [690, 'removeSrc'], [690, 'load', 'muted']], firstFrame: 430,
        states: [[300, 0, 0, 1, 2, 0, 0, 1], [420, 1, 1, 1, 2, 2, 1.2, 0], [690, 0, 0, 0, 0, 0, 0, 1]] }] },
      requests: s === 'LEAVE_PENDING' ? [] : [{ id: 1, card: 'A', t0: O + 305, range: 'bytes=0-', status: 206, length: 3000000, bytesSent: 400000, writes: [[O + 600, 300000], [O + 690, 400000]], tEnd: O + 692, end: 'client-abort' }] };
    if (mutate) r = mutate(r);
    return r;
  };
  const media = { mp4: { size: 3623853, sha256: srv.MEDIA.mp4.sha256 }, webm: { size: 3091428, sha256: srv.MEDIA.webm.sha256 } };
  const cells = full.map(key);
  const runsFor = (list, mut = {}) => list.map((k) => { const [t, c, s] = k.split('/'); return mk(t, c, s, mut[k] || null); });
  const contaminated = (r) => ({ ...r, client: { ...r.client, trustedPointerEvents: 37 } });
  const original = { media, runs: [...runsFor(cells.filter((k) => !RECOVERY.includes(k))), ...runsFor(RECOVERY).map(contaminated)] };
  const recovery = { media, runs: runsFor(RECOVERY) };
  const ok = merge([original, recovery]);
  check('merge: original clean 45 + recovery clean 9 = 54 cells, evaluated PASS by the committed criteria', ok.perFile[0].clean === 45 && ok.perFile[1].clean === 9 && ok.evaluation.complete && ok.evaluation.pass && Object.values(ok.cellsBySource).filter((f) => f === 2).length === 9, JSON.stringify(ok.perFile));
  const partial = merge([original, { media, runs: runsFor(RECOVERY.slice(0, 8)) }]);
  check('fault recovery missing a cell: merged set incomplete, not PASS', !partial.evaluation.complete && !partial.evaluation.pass && partial.evaluation.selection.missing.length === 1);
  check('fault recovery re-supplies a cell already clean in the original: merge refused', refused(() => merge([original, { media, runs: [...runsFor(RECOVERY), ...runsFor(['FAST/webm/DISPOSE'])] }])));
  check('fault media identity differs between files: merge refused', refused(() => merge([original, { media: { ...media, mp4: { size: 1, sha256: '0' } }, runs: runsFor(RECOVERY) }])));
  const bad = merge([original, { media, runs: runsFor(RECOVERY, { 'NORANGE/mp4/CYCLES_5': (r) => { r.requests[0].end = 'open-at-run-end'; r.requests[0].tEnd = null; return r; } }) }]);
  check('fault a recovered cell fails the criteria (transfer still streaming): merged result not PASS', bad.evaluation.complete && !bad.evaluation.pass && bad.evaluation.cells.some((c) => c.cell === 'NORANGE mp4 CYCLES_5' && !c.pass));
  const dirty = merge([original, { media, runs: runsFor(RECOVERY).map(contaminated) }]);
  check('fault recovery cells contaminated by trusted pointer events are still rejected (rule not weakened)', !dirty.evaluation.complete && dirty.perFile[1].clean === 0);
  check('merge input check: a single file is refused', refused(() => merge([original])));

  // ---- 4. unchanged artifacts ----
  check('production unchanged: working tree = commit 8324552 = blob 4258ad7', h.gitBlobId(h.productionSource()) === pc.EXPECTED_PRODUCTION_BLOB && execFileSync('git', ['-C', REPO, 'rev-parse', `HEAD:Booru_Enhancer.user.js`], { encoding: 'utf8' }).trim() === pc.EXPECTED_PRODUCTION_BLOB);
  const built = pc.build();
  check('P controlled package unchanged (a fresh build equals the committed IB10_P_Controlled.user.js)', fs.readFileSync(pc.OUT_CONTROLLED, 'utf8') === built.controlled);

  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB10', stage: 'P controlled conformance: targeted cell recovery (selector + merge), local qualification', recoveryCells: RECOVERY,
    checks: results.length, passed, failed: results.length - passed, fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })), failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'IB10_P_RECOVERY_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
process.exitCode = 2; // stays non-zero if main never completes
main().catch((e) => { console.error(e); process.exitCode = 1; });
