'use strict';
const fs = require('fs');
const path = require('path');
const { oracles } = require('./oracles.cjs');
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures.json'), 'utf8'));

let failures = 0;
const results = [];
for (const c of fixtures.cases) {
  const fn = oracles[c.oracle];
  if (typeof fn !== 'function') {
    failures++;
    results.push({ id: c.id, ok: false, problem: `missing oracle ${c.oracle}` });
    continue;
  }
  const historical = fn(c.historical);
  const corrected = fn(c.correctedControl);
  const sensitive = historical.ok === false && corrected.ok === true;
  if (!sensitive) failures++;
  results.push({
    id: c.id,
    oracle: c.oracle,
    historicalDetected: historical.ok === false,
    correctedAccepted: corrected.ok === true,
    sensitive,
    historical,
    corrected,
  });
}

console.log(JSON.stringify({
  suite: 'IB01 oracle qualification',
  cases: results.length,
  sensitiveCases: results.filter(r => r.sensitive).length,
  failures,
  results,
}, null, 2));
process.exitCode = failures ? 1 : 0;
