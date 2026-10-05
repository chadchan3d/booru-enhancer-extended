'use strict';
// IB10 P controlled conformance: merge an original run with targeted recovery
// run(s), then evaluate with the unchanged committed criteria
// (p_conformance_ib10.cjs evaluateControlled, C1-C5).
//   - Each input file is reduced to its clean results by the unchanged selector
//     (select_clean_ib10_v3c.cjs: trusted pointer events > 0, identity mismatch
//     or runner error -> dropped; requests from earlier attempts excluded).
//   - Clean results are combined across files. A cell that is clean in more than
//     one file is refused (no choosing between results), as is any difference in
//     the media identity (sizes / SHA-256) between files.
//   - The merged document must then hold exactly the 54 plan cells; the
//     evaluator re-applies the selector and the criteria to it.
// Usage: node merge_ib10_p_controlled.cjs <original.json> <recovery.json> [more recovery files...] [--out merged-evaluation.json]
const fs = require('fs');
const { select } = require('./select_clean_ib10_v3c.cjs');
const { evaluateControlled } = require('./p_conformance_ib10.cjs');

function merge(docs) {
  if (docs.length < 2) throw new Error('need the original result and at least one recovery result');
  const media = JSON.stringify(docs[0].media);
  docs.forEach((d, i) => { if (JSON.stringify(d.media) !== media) throw new Error(`file ${i + 1}: media identity differs from the original`); });
  const byCell = new Map();
  const perFile = docs.map((d, i) => {
    const { doc, report } = select(d);
    for (const r of doc.runs) {
      const k = `${r.run.transport}|${r.run.container}|${r.run.scenario}`;
      if (byCell.has(k)) throw new Error(`cell ${k} is clean in more than one file (files ${byCell.get(k).file + 1} and ${i + 1})`);
      byCell.set(k, { file: i, run: r });
    }
    return { file: i + 1, entries: report.entries, clean: report.kept, dropped: report.dropped };
  });
  const merged = { ...docs[0], runs: [...byCell.values()].map((x) => x.run) };
  const evaluation = evaluateControlled(merged);
  return { perFile, cellsBySource: Object.fromEntries([...byCell].map(([k, v]) => [k, v.file + 1])), evaluation };
}

module.exports = { merge };

if (require.main === module) {
  const args = process.argv.slice(2);
  const oi = args.indexOf('--out');
  const out = oi >= 0 ? args.splice(oi, 2)[1] : null;
  let r;
  try { r = merge(args.map((f) => JSON.parse(fs.readFileSync(f, 'utf8')))); } catch (e) { console.error(`IB10 P merge refused: ${e.message}`); process.exit(1); }
  const summary = { perFile: r.perFile, complete: r.evaluation.complete, pass: r.evaluation.pass, selection: r.evaluation.selection,
    failingCells: r.evaluation.cells.filter((c) => !c.pass).map((c) => ({ cell: c.cell, fails: c.fails })), cellsBySource: r.cellsBySource };
  if (out) fs.writeFileSync(out, JSON.stringify({ ...summary, cells: r.evaluation.cells }, null, 1) + '\n');
  console.log(JSON.stringify(summary, null, 1));
  process.exitCode = r.evaluation.pass ? 0 : 1;
}
