'use strict';
// Local qualification for IB08_B1_Login_State_Probe.user.js (no live site).
// Synthetic logged-out / logged-in fixtures (NOT live markup) plant a
// username, user ID, token and tag; every output is scanned for them. The
// page must be unchanged, and cookie, storage, network and click paths are
// counted. Every fault-control mutant must be caught.
// The fixtures also carry the site's short name as an ordinary page value.
// That is the failure class that blocked all four live runs of probe 1.0.0;
// a regression test runs the committed 1.0.0 probe to reproduce it.
// Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { JSDOM } = require(path.resolve(__dirname, '../../host/ib07/node_modules/jsdom'));

const FILE = 'IB08_B1_Login_State_Probe.user.js';
const SRC = fs.readFileSync(path.join(__dirname, FILE), 'utf8').replace(/\r\n/g, '\n');
const OLD_REV = '8b07a65'; // probe 1.0.0, the version that blocked live
const OLD = execFileSync('git', ['show', `${OLD_REV}:tests/browser/ib08/${FILE}`], { cwd: __dirname, encoding: 'utf8' }).replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

const RAW = ['secret_person', '4242424', 'tok_abcdefgh123', 'secret_tag', 'static.example', 'http', '/users/', '/session', 'Secret-Class', 'midnight'];
const leaks = (text) => RAW.filter((r) => text.includes(r));

// shortName: the site's own short name as an ordinary page value (live failure class).
const page = (state, shortName) => {
  const inn = state === 'in';
  return `<!doctype html><html lang="en" data-theme="midnight"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="application-name" content="${shortName}">
    <meta name="csrf-token" content="tok_abcdefgh123">
    <meta name="current-user-name" content="${inn ? 'secret_person' : 'Anonymous'}">
    <meta name="current-user-id" content="${inn ? '4242424' : ''}">
    <meta name="blacklisted-tags" content="secret_tag">
    ${inn ? '<meta name="x-4242424" content="1">' : ''}
  </head><body class="c-posts a-index resp${inn ? ' Secret-Class' : ''}" data-site="${shortName}" data-user-level="${inn ? '20' : '0'}"${inn ? ' data-user-name="secret_person" data-user-4242424="x"' : ''}>
    <nav>${inn
    ? '<a href="/users/4242424">secret_person</a><a href="/users/home">Account</a><a href="/dmails">Mail</a><a href="/session" data-method="delete">Logout</a><a href="/users/4242424/edit">Settings</a>'
    : '<a href="/session/new">Sign in</a><a href="/users/new">Sign up</a>'}
      <a href="https://static.example/data/secret_tag.jpg">x</a><a href="/posts?tags=secret_tag">t</a></nav>
    <section class="posts-container"><article class="thumbnail" data-id="90001"></article></section></body></html>`;
};

async function run(url, html, { src = SRC, cmd = 'OUT' } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const w = dom.window;
  const counters = { network: 0, gm: 0, storage: 0, cookie: 0, clicks: 0 };
  const menu = {};
  w.fetch = () => { counters.network++; return new Promise(() => {}); };
  w.XMLHttpRequest = class { open() { counters.network++; } send() {} };
  for (const n of ['GM_xmlhttpRequest', 'GM_setValue', 'GM_getValue', 'GM_cookie', 'GM_download', 'GM_openInTab']) w[n] = () => { counters.gm++; };
  w.GM_registerMenuCommand = (label, fn) => { menu[label] = fn; };
  for (const store of [w.localStorage, w.sessionStorage]) for (const m of ['setItem', 'removeItem', 'clear', 'getItem', 'key']) { const o = store[m].bind(store); store[m] = (...a) => { counters.storage++; return o(...a); }; }
  const cd = Object.getOwnPropertyDescriptor(w.Document.prototype, 'cookie');
  Object.defineProperty(w.document, 'cookie', { get() { counters.cookie++; return cd.get.call(this); }, set(v) { counters.cookie++; cd.set.call(this, v); } });
  const oc = w.HTMLElement.prototype.click;
  w.HTMLElement.prototype.click = function (...a) { counters.clicks++; return oc.apply(this, a); };
  const sig = () => [w.document.head.innerHTML, w.document.body.innerHTML, ...[w.document.documentElement, w.document.body].map((el) => [...el.attributes].map((a) => a.name + a.value).join())].join('\u0000');
  const before = sig();
  let crashed = false;
  try {
    w.eval(src);
    const k = Object.keys(menu).find((l) => l.includes(cmd === 'OUT' ? 'logged OUT' : 'logged IN'));
    if (k) menu[k]();
  } catch { crashed = true; }
  const overlay = w.document.querySelector('#ib08-b1-result');
  const text = overlay?.querySelector('textarea')?.value || '';
  overlay?.remove();
  const unchanged = before === sig();
  let json = null; try { json = JSON.parse(text); } catch { json = null; }
  const out = { text, json, counters, unchanged, crashed, menu: Object.keys(menu) };
  w.close();
  return out;
}

const hygiene = (label, r) => {
  check(`${label}: not blocked`, r.json && !r.json.sanitationGuard, r.text.slice(0, 300));
  check(`${label}: no leak`, leaks(r.text).length === 0, leaks(r.text).join(','));
  check(`${label}: page unchanged (overlay only)`, r.unchanged);
  check(`${label}: no cookie/storage/network/GM/click`, Object.values(r.counters).every((n) => n === 0), JSON.stringify(r.counters));
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  const HOSTS = [['e621', 'https://e621.net/posts', 'e621.net'], ['e926', 'https://e926.net/posts', 'e926.net']];

  // ---- 0. Regression: the live failure class, reproduced with the committed 1.0.0 probe ----
  for (const [label, url] of HOSTS) {
    for (const st of ['out', 'in']) {
      const r = await run(url, page(st, label), { src: OLD, cmd: st === 'out' ? 'OUT' : 'IN' });
      check(`regression 1.0.0 ${label} ${st}: site-name page value blocks output (live failure reproduced)`, r.json && r.json.sanitationGuard === 'BLOCKED' && leaks(r.text).length === 0, r.text.slice(0, 200));
    }
  }

  // ---- 1. Current probe on both hosts, both states ----
  for (const [label, url, host] of HOSTS) {
    const o = await run(url, page('out', label), { cmd: 'OUT' });
    const i = await run(url, page('in', label), { cmd: 'IN' });
    for (const [st, r] of [['logged-out', o], ['logged-in', i]]) {
      hygiene(`${label} ${st}`, r);
      check(`${label} ${st}: site ${host}, listing route, version 1.1.0`, r.json && r.json.site === host && r.json.route === 'posts-listing' && r.json.version === '1.1.0', r.text.slice(0, 200));
    }
    if (!o.json || !i.json || o.json.sanitationGuard || i.json.sanitationGuard) { check(`${label}: facts available`, false, 'blocked or missing'); continue; }
    check(`${label}: declared state echoed`, o.json.declaredState === 'LOGGED_OUT' && i.json.declaredState === 'LOGGED_IN');
    check(`${label}: only login-relevant meta names, with value classes`,
      same(o.json.meta, { 'csrf-token': 'OTHER_TEXT', 'current-user-id': 'EMPTY', 'current-user-name': 'ANONYMOUS_WORD' })
      && same(i.json.meta, { 'csrf-token': 'OTHER_TEXT', 'current-user-id': 'NUMERIC_NONZERO', 'current-user-name': 'OTHER_TEXT' }), JSON.stringify([o.json.meta, i.json.meta]));
    check(`${label}: only login-relevant body attributes, with value classes`,
      same(o.json.bodyAttributes, { 'data-user-level': 'ZERO' }) && same(i.json.bodyAttributes, { 'data-user-level': 'NUMERIC_NONZERO', 'data-user-name': 'OTHER_TEXT' }), JSON.stringify([o.json.bodyAttributes, i.json.bodyAttributes]));
    check(`${label}: irrelevant names counted, not emitted`, same(o.json.htmlAttributes, {}) && same(o.json.bodyClasses, []) && same(o.json.htmlClasses, [])
      && same(o.json.otherNameCounts, { meta: 3, htmlAttributes: 2, bodyAttributes: 1, htmlClasses: 0, bodyClasses: 3 })
      && same(i.json.otherNameCounts, { meta: 4, htmlAttributes: 2, bodyAttributes: 1, htmlClasses: 0, bodyClasses: 4 }), JSON.stringify([o.json.otherNameCounts, i.json.otherNameCounts]));
    check(`${label}: link categories`, same(o.json.accountLinkCategories, { 'a:LOGIN': 1, 'a:SIGNUP': 1 })
      && same(i.json.accountLinkCategories, { 'a:ACCOUNT_HOME': 1, 'a:ACCOUNT_SETTINGS': 1, 'a:DMAIL': 1, 'a:LOGOUT': 1, 'a:USER_PROFILE': 1 }), JSON.stringify([o.json.accountLinkCategories, i.json.accountLinkCategories]));
    check(`${label}: ID-bearing relevant name withheld and counted`, i.json.withheldNames === 1 && o.json.withheldNames === 0, [o.json.withheldNames, i.json.withheldNames]);
    check(`${label}: two menu commands only`, o.menu.length === 2, o.menu.join('|'));
  }

  let r = await run('https://rule34.xxx/index.php?page=post&s=list', page('in', 'rule34'));
  check('unsupported host: error only', r.json && r.json.error === 'unsupported host' && leaks(r.text).length === 0 && r.unchanged, r.text);

  // ---- 2. Guard still blocks real leaks, with value-free diagnostics ----
  const leaky = SRC.replace("if (safeName(n)) meta[n] = valueClass(m.getAttribute('content'));", "if (safeName(n)) meta[n] = m.getAttribute('content');");
  r = await run('https://e621.net/posts', page('in', 'e621'), { src: leaky, cmd: 'IN' });
  check('guard: leaking build is BLOCKED and leak-free', leaky !== SRC && r.json && r.json.sanitationGuard === 'BLOCKED' && leaks(r.text).length === 0, r.text.slice(0, 200));
  const d = r.json && r.json.blockDiagnostics;
  check('guard: diagnostics name the source and section only', d && d.bySource.META_CONTENT >= 1 && d.bySection.meta >= 1 && d.blockingValues >= 1 && r.json.site === 'e621.net', JSON.stringify(d));
  const leakyName = SRC.replace("if (safeName(a.name)) out[a.name] = valueClass(a.value);", "if (safeName(a.name)) out[a.name] = a.value;");
  r = await run('https://e926.net/posts', page('in', 'e926'), { src: leakyName, cmd: 'IN' });
  check('guard: leaking body-attribute build is BLOCKED (e926)', leakyName !== SRC && r.json && r.json.sanitationGuard === 'BLOCKED' && r.json.blockDiagnostics.bySource.BODY_ATTR >= 1 && leaks(r.text).length === 0, r.text.slice(0, 300));

  // ---- 3. Static scope ----
  const header = SRC.slice(0, SRC.indexOf('==/UserScript=='));
  const strip = (s) => s.slice(s.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const code = strip(SRC);
  check('static: @match only e621.net and e926.net', [...header.matchAll(/@match\s+(\S+)/g)].map((x) => x[1]).join() === '*://e621.net/*,*://e926.net/*', header);
  check('static: only GM_registerMenuCommand; no @connect/@require', [...header.matchAll(/@grant\s+(\S+)/g)].map((x) => x[1]).join() === 'GM_registerMenuCommand' && !/@(connect|require|resource|updateURL|downloadURL)/.test(header), header);
  const forbidden = ['fetch(', 'XMLHttpRequest', 'GM_xmlhttpRequest', 'GM.', 'GM_cookie', 'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'setAttribute', 'removeAttribute', 'replaceWith', 'cloneNode', 'innerHTML', 'outerHTML', '.click(', 'sendBeacon', 'WebSocket', 'window.open', 'dispatchEvent', 'textContent)', 'innerText'];
  const hitsS = forbidden.filter((f) => code.includes(f));
  check('static: no network, cookie, storage, attribute-write, HTML-string, text-read or click API', hitsS.length === 0, hitsS.join(','));
  // Read from the unstripped source: the comment stripper would cut the '//' inside these regex literals.
  check('static: guard strictness unchanged and applied to all page-derived facts', SRC.includes("const hits = (text, v) => text.includes(JSON.stringify(v)) || ((v.length >= 8 || /[\\d/]/.test(v)) && text.includes(v));")
    && SRC.includes('const blocking = [...raw.entries()].filter(([v]) => hits(factsText, v));') && SRC.includes('const factsText = JSON.stringify(facts);') && SRC.includes('const schemeLeak = /https?:\\/\\//i.test(full);'), 'guard text changed');
  const constBlock = code.slice(code.indexOf('const constants = {'), code.indexOf('show(guard(constants, facts, raw));'));
  check('static: fixed labels use only literals/allowlist (no captured content)', constBlock.length > 50 && !/getAttribute|querySelector\(|\.content|href|raw|facts/.test(constBlock.replace(/'[^']*'/g, '').replace(/document\.querySelector\('[^']*'\)/g, '').replace(/!!document\.querySelector\(\)/g, '')), constBlock);

  // ---- 4. Fault controls ----
  const unguard = (s) => s.replace('const blocking = [...raw.entries()].filter(([v]) => hits(factsText, v));', 'const blocking = [];').replace('const schemeLeak = /https?:\\/\\//i.test(full);', 'const schemeLeak = false;');
  const E6 = 'https://e621.net/posts'; const E9 = 'https://e926.net/posts';
  const faults = [
    ['guard scans probe constants again (live failure class)', SRC.replace('const blocking = [...raw.entries()].filter(([v]) => hits(factsText, v));', 'const blocking = [...raw.entries()].filter(([v]) => hits(full, v));'), E6, 'OUT'],
    ['guard scans probe constants again, e926', SRC.replace('const blocking = [...raw.entries()].filter(([v]) => hits(factsText, v));', 'const blocking = [...raw.entries()].filter(([v]) => hits(full, v));'), E9, 'IN'],
    ['coarsening disabled (all names emitted)', SRC.replace('const RELEVANT = /user|login|logged|logout|anon|guest|member|session|account|auth|csrf|level|current|signed/;', 'const RELEVANT = /./;'), E6, 'OUT'],
    ['leaked username (value instead of class)', unguard(SRC.replace("if (!t) return 'EMPTY';", "if (!t) return 'EMPTY'; if (t.length > 3) return t;")), E6, 'IN'],
    ['leaked user ID (link path)', unguard(SRC.replace("if (/^\\/users\\/\\d+$/.test(path)) return 'USER_PROFILE';", "if (/^\\/users\\/\\d+$/.test(path)) return path;")), E6, 'IN'],
    ['withheld-name filter disabled', unguard(SRC.replace("const safeName = (n) => SAFE_NAME.test(n) && !/\\d{3,}/.test(n);", 'const safeName = () => true;')), E6, 'IN'],
    ['cookie read', SRC.replace('const { raw, facts } = collect();', 'const { raw, facts } = collect(); void document.cookie;'), E6, 'IN'],
    ['script-side request', SRC.replace('const { raw, facts } = collect();', 'const { raw, facts } = collect(); fetch(location.href);'), E6, 'IN'],
    ['page mutation', SRC.replace('const { raw, facts } = collect();', "const { raw, facts } = collect(); document.body.setAttribute('data-probe', '1');"), E6, 'IN'],
    ['e926 relabeled as e621', SRC.replace("const SITE = SITES.includes(location.hostname) ? SITES[SITES.indexOf(location.hostname)] : null;", "const SITE = SITES.includes(location.hostname) ? 'e621.net' : null;"), E9, 'IN'],
    ['declared state swapped', SRC.replace("() => observe('LOGGED_IN')", "() => observe('LOGGED_OUT')"), E6, 'IN'],
    ['anonymous misclassified', SRC.replace("if (/^anonymous$/i.test(t)) return 'ANONYMOUS_WORD';", ''), E6, 'OUT'],
  ];
  for (const [name, src, url, cmd] of faults) {
    if (src === SRC || src === unguard(SRC)) { check(`fault ${name}: mutant applied`, false, 'replacement did not apply'); continue; }
    const host = new URL(url).hostname;
    const f = await run(url, page(cmd === 'IN' ? 'in' : 'out', host.slice(0, 4)), { src, cmd });
    const by = [];
    if (f.crashed) by.push('crash');
    if (!f.json || f.json.sanitationGuard) by.push('blocked-output');
    if (leaks(f.text).length) by.push('leak-scan');
    if (!f.unchanged) by.push('page-watch');
    if (!Object.values(f.counters).every((n) => n === 0)) by.push('api-counter');
    if (!f.json || f.json.site !== host) by.push('host-identity');
    if (!f.json || f.json.declaredState !== (cmd === 'IN' ? 'LOGGED_IN' : 'LOGGED_OUT')) by.push('declared-state');
    if (f.json && f.json.meta && Object.keys(f.json.meta).some((k) => !/user|csrf/.test(k))) by.push('coarsening');
    if (cmd === 'OUT' && (!f.json || !f.json.meta || f.json.meta['current-user-name'] !== 'ANONYMOUS_WORD')) by.push('value-class');
    if (forbidden.some((x) => strip(src).includes(x))) by.push('static');
    check(`fault ${name}: caught by ${by.join('+') || 'nothing'}`, by.length > 0, 'mutant passed all checks');
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = {
    checkpoint: 'IB08', bounding_input: 'B1 native login-state marker', status: 'LOCAL QUALIFICATION (fixtures are synthetic, not live markup)',
    probe: FILE, probe_version: '1.1.0', probe_sha256_lf: crypto.createHash('sha256').update(SRC).digest('hex'),
    regression_reference: `probe 1.0.0 at ${OLD_REV}`,
    checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })),
    failures: results.filter((x) => !x.pass),
  };
  fs.writeFileSync(path.join(__dirname, 'B1_LOGIN_STATE_VERIFICATION.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
