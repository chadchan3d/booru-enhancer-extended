'use strict';
// IB07 §6 preservation row "rule34.us and three Sankaku matches":
// explicit removal, no generic actions, stored preferences remain, exclusion
// fixtures including idol. Runs against the COMMITTED production userscript
// (git HEAD), not a historical oracle. Every assertion has a mutant control.
const path = require('path');
const { execFileSync } = require('child_process');
const h = require('./item9_harness.cjs');

const REPO = path.resolve(__dirname, '../../..');
const COMMITTED = execFileSync('git', ['-C', REPO, 'show', 'HEAD:Booru_Enhancer.user.js'], { encoding: 'utf8', maxBuffer: 64 << 20 }).replace(/\r\n/g, '\n');
const EXCLUDED = ['rule34.us', 'chan.sankakucomplex.com', 'idol.sankakucomplex.com', 'beta.sankakucomplex.com'];

// ---- userscript metadata ------------------------------------------------------
function meta(src) {
  const block = src.slice(0, src.indexOf('// ==/UserScript==\n'));
  const lines = block.split('\n');
  const values = (k) => lines.filter((l) => new RegExp(`^// @${k}\\s`).test(l)).map((l) => l.trim().split(/\s+/).pop());
  return { match: values('match'), include: values('include'), exclude: values('exclude'), connect: values('connect') };
}
// Chrome/Tampermonkey match-pattern semantics for the forms used here.
function matches(pattern, url) {
  const m = pattern.match(/^(\*|https?):\/\/([^/]+)(\/.*)$/);
  if (!m) return false;
  const u = new URL(url);
  const scheme = u.protocol.slice(0, -1);
  if (m[1] !== '*' && m[1] !== scheme) return false;
  if (m[1] === '*' && scheme !== 'http' && scheme !== 'https') return false;
  const host = m[2];
  const hostOk = host === '*' || host === u.hostname || (host.startsWith('*.') && (u.hostname === host.slice(2) || u.hostname.endsWith(host.slice(1))));
  const pathRe = new RegExp(`^${m[3].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return hostOk && pathRe.test(u.pathname + u.search);
}
function admittedBy(src, host) {
  const md = meta(src);
  const urls = [`https://${host}/`, `https://${host}/index.php?page=post&s=list`, `http://${host}/post/show/1`];
  return urls.some((u) => md.match.some((p) => matches(p, u))) || md.include.length > 0;
}

// ---- runtime helpers ----------------------------------------------------------
async function adapterFor(src, host) {
  const c = await h.loadAndStart({ url: `https://${host}/`, html: '<!doctype html><html><body></body></html>', source: src }, 60);
  const id = c.adapter?.id || null;
  const generic = c.BE.adapters.registry.find((a) => a.id === 'generic');
  const genericActionKeys = generic ? Object.keys(generic).filter((k) => /fav|action|mutat|vote/i.test(k)) : ['<missing>'];
  c.window.close();
  return { id, genericActionKeys };
}
const SEED = {
  'be:setting:media.hoverPreview': false,
  'be:setting:download.filenameTemplate': '{artist} - {id}',
  'be:setting:download.maxCharacters': 2,
  'be:setting:obsoleteFromEarlierRelease': 'kept',
  'be:legacy:unknown-preference': { note: 'unknown key' },
};
async function preferencesAfterStartup(src, host) {
  const deletes = [];
  const c = await h.loadAndStart({ url: `https://${host}/index.php?page=post&s=list`, html: '<!doctype html><html><body></body></html>', source: src, settings: SEED,
    setup: (w) => { const del = w.GM_deleteValue; w.GM_deleteValue = (k) => { deletes.push(k); return del(k); }; } }, 150);
  const changed = Object.entries(SEED).filter(([k, v]) => JSON.stringify(c.window.GM_getValue(k, '<absent>')) !== JSON.stringify(v)).map(([k]) => k);
  c.window.close();
  return { deletes: deletes.length, changedOrRemoved: changed.length };
}

const results = [];
const record = (id, name, pass, detail, controls) => results.push({ id, name, verdict: pass ? 'PASS' : 'FAIL', detail, controls });
const mut = (src, from, to) => { if (src.split(from).length !== 2) throw new Error(`mutant pattern not unique: ${from}`); return src.replace(from, to); };

(async () => {
  const md = meta(COMMITTED);

  // X1 per host (idol explicitly): not matched by any @match pattern.
  for (const host of EXCLUDED) {
    const ok = !admittedBy(COMMITTED, host);
    const readded = mut(COMMITTED, '// @match        *://e926.net/*', `// @match        *://e926.net/*\n// @match        *://${host}/*`);
    const ctl = { name: `@match re-added for ${host}`, expected: false, observed: !admittedBy(readded, host) };
    // The idol control must not be satisfied by another Sankaku host being present.
    if (host === 'idol.sankakucomplex.com') {
      const others = mut(COMMITTED, '// @match        *://e926.net/*', '// @match        *://e926.net/*\n// @match        *://chan.sankakucomplex.com/*\n// @match        *://beta.sankakucomplex.com/*');
      ctl.idolIndependent = !admittedBy(others, host);
    }
    ctl.ok = ctl.observed === false && (ctl.idolIndependent === undefined || ctl.idolIndependent === true);
    record(`X1-${host}`, `${host} is not admitted by the committed @match list`, ok, null, [ctl]);
  }

  // X2 no other activation mechanism.
  const x2 = md.include.length === 0 && md.exclude.length === 0;
  const x2m = mut(COMMITTED, '// @match        *://e926.net/*', '// @match        *://e926.net/*\n// @include      *');
  record('X2', 'no @include activation (only exact @match hosts are injected)', x2, { include: md.include.length },
    [{ name: '@include * added', expected: false, observed: meta(x2m).include.length === 0, ok: meta(x2m).include.length > 0 }]);

  // X3 generic fallback cannot re-admit: every admitted host has a dedicated
  // adapter (generic is never selected), and the generic adapter has no actions.
  const admitted = [...new Set(md.match.map((p) => p.replace(/^\*:\/\//, '').replace(/\/\*$/, '')))];
  const perHost = [];
  for (const host of admitted) perHost.push({ host, ...(await adapterFor(COMMITTED, host)) });
  const x3 = perHost.every((r) => r.id && r.id !== 'generic') && perHost[0].genericActionKeys.length === 0;
  const m1 = await adapterFor(mut(COMMITTED, 'hostPattern: /donmai\\.us$|atfbooru\\.ninja$/,', 'hostPattern: /donmai\\.us$/,'), 'atfbooru.ninja');
  const m2 = await adapterFor(mut(COMMITTED, "\t\tid: 'generic',\n", "\t\tid: 'generic',\n\t\tfavoriteSelector: 'a.fav',\n"), 'rule34.xxx');
  record('X3', 'no generic fallback or generic action on any admitted host', x3, { admittedHosts: admitted.length, genericSelected: perHost.filter((r) => r.id === 'generic').length },
    [{ name: 'dedicated adapter pattern narrowed (atfbooru falls to generic)', expected: false, observed: m1.id !== 'generic', ok: m1.id === 'generic' },
     { name: 'generic favorite selector re-added', expected: false, observed: m2.genericActionKeys.length === 0, ok: m2.genericActionKeys.length > 0 }]);

  // X4 no code path special-cases an excluded host; @connect is permission only.
  const outsideMeta = COMMITTED.slice(COMMITTED.indexOf('// ==/UserScript==\n'));
  const x4 = EXCLUDED.every((host) => !outsideMeta.includes(host)) && !/sankakucomplex|rule34\.us/.test(outsideMeta);
  const x4m = mut(COMMITTED, "\t\tid: 'generic',\n", "\t\tid: 'generic',\n\t\tnote: 'idol.sankakucomplex.com',\n");
  record('X4', 'production code names no excluded host (only @connect permissions remain, left to release audit)', x4,
    { connectEntriesForExcludedHosts: md.connect.filter((c) => /rule34\.us|sankaku/.test(c)).length },
    [{ name: 'excluded host referenced in code', expected: false, observed: !meta(x4m) || !x4m.slice(x4m.indexOf('// ==/UserScript==\n')).includes('idol.sankakucomplex.com'), ok: x4m.slice(x4m.indexOf('// ==/UserScript==\n')).includes('idol.sankakucomplex.com') }]);

  // P1 stored preferences remain: startup on the admitted sibling hosts deletes
  // and changes nothing that was stored (settings are per-script, not per-host).
  const p = [];
  for (const host of ['rule34.xxx', 'e621.net']) p.push(await preferencesAfterStartup(COMMITTED, host));
  const pm = await preferencesAfterStartup(mut(COMMITTED, '\tBE.dom.ready(BE.modules.init);', "\tGM_deleteValue('be:setting:media.hoverPreview');\n\tBE.dom.ready(BE.modules.init);"), 'rule34.xxx');
  record('P1', 'stored preferences are neither deleted nor changed at startup', p.every((r) => r.deletes === 0 && r.changedOrRemoved === 0),
    { seededKeys: Object.keys(SEED).length, runs: p },
    [{ name: 'startup deletes a stored preference', expected: false, observed: pm.deletes === 0 && pm.changedOrRemoved === 0, ok: pm.deletes > 0 && pm.changedOrRemoved > 0 }]);

  const failed = results.filter((r) => r.verdict !== 'PASS').map((r) => r.id);
  const controlFailures = results.flatMap((r) => r.controls.filter((c) => !c.ok).map((c) => `${r.id}: ${c.name}`));
  console.log(JSON.stringify({ suite: 'IB07 excluded-host assertions', excludedHosts: EXCLUDED, assertions: results.length, pass: results.length - failed.length, failed, controls: results.reduce((n, r) => n + r.controls.length, 0), controlFailures, results }, null, 2));
  if (failed.length || controlFailures.length) process.exitCode = 1;
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
