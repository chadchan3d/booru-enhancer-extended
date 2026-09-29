'use strict';
// Local qualification for IB08_B1_Login_State_Probe.user.js (no live site).
// Synthetic logged-out / logged-in fixtures (NOT live markup) plant a
// username, user ID, token and tag; every output is scanned for them. The
// page must be unchanged, and cookie, storage, network and click paths are
// counted. Every fault-control mutant must be caught.
// Requires `npm install` in tests/host/ib07 (pinned jsdom).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require(path.resolve(__dirname, '../../host/ib07/node_modules/jsdom'));

const FILE = 'IB08_B1_Login_State_Probe.user.js';
const SRC = fs.readFileSync(path.join(__dirname, FILE), 'utf8').replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

const RAW = ['secret_person', '4242424', 'tok_abcdefgh123', 'secret_tag', 'static.example', 'http', '/users/', '/session', 'Secret-Class'];
const leaks = (text) => RAW.filter((r) => text.includes(r));

const page = (state) => {
  const inn = state === 'in';
  return `<!doctype html><html lang="en" data-theme="${inn ? 'secret_person' : 'default'}"><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="tok_abcdefgh123">
    <meta name="current-user-name" content="${inn ? 'secret_person' : 'Anonymous'}">
    <meta name="current-user-id" content="${inn ? '4242424' : ''}">
    <meta name="blacklisted-tags" content="secret_tag">
    ${inn ? '<meta name="x-4242424" content="1">' : ''}
  </head><body class="c-posts a-index resp${inn ? ' Secret-Class' : ''}" data-user-level="${inn ? '20' : '0'}"${inn ? ' data-user-name="secret_person" data-user-4242424="x"' : ''}>
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
  const before = { head: w.document.head.innerHTML, html: [...w.document.documentElement.attributes].map((a) => a.name + a.value).join(), body: [...w.document.body.attributes].map((a) => a.name + a.value).join(), bodyInner: w.document.body.innerHTML };
  let crashed = false;
  try {
    w.eval(src);
    const k = Object.keys(menu).find((l) => l.includes(cmd === 'OUT' ? 'logged OUT' : 'logged IN'));
    if (k) menu[k]();
  } catch { crashed = true; }
  const overlay = w.document.querySelector('#ib08-b1-result');
  const text = overlay?.querySelector('textarea')?.value || '';
  overlay?.remove();
  const unchanged = before.head === w.document.head.innerHTML && before.bodyInner === w.document.body.innerHTML
    && before.html === [...w.document.documentElement.attributes].map((a) => a.name + a.value).join() && before.body === [...w.document.body.attributes].map((a) => a.name + a.value).join();
  let json = null; try { json = JSON.parse(text); } catch { json = null; }
  const out = { text, json, counters, unchanged, crashed, menu: Object.keys(menu) };
  w.close();
  return out;
}

const hygiene = (label, r) => {
  check(`${label}: no leak`, leaks(r.text).length === 0, leaks(r.text).join(','));
  check(`${label}: page unchanged (overlay only)`, r.unchanged);
  check(`${label}: no cookie/storage/network/GM/click`, Object.values(r.counters).every((n) => n === 0), JSON.stringify(r.counters));
};

async function main() {
  for (const [label, url, host] of [['e621', 'https://e621.net/posts', 'e621.net'], ['e926', 'https://e926.net/posts', 'e926.net']]) {
    const o = await run(url, page('out'), { cmd: 'OUT' });
    const i = await run(url, page('in'), { cmd: 'IN' });
    for (const [st, r] of [['logged-out', o], ['logged-in', i]]) {
      hygiene(`${label} ${st}`, r);
      check(`${label} ${st}: site ${host}, listing route`, r.json && r.json.site === host && r.json.route === 'posts-listing', r.text.slice(0, 200));
    }
    check(`${label}: declared state echoed`, o.json && o.json.declaredState === 'LOGGED_OUT' && i.json && i.json.declaredState === 'LOGGED_IN', [o.json && o.json.declaredState, i.json && i.json.declaredState]);
    check(`${label}: meta value classes (logged out)`, o.json && o.json.meta['current-user-name'] === 'ANONYMOUS_WORD' && o.json.meta['current-user-id'] === 'EMPTY' && o.json.meta['csrf-token'] === 'OTHER_TEXT', JSON.stringify(o.json && o.json.meta));
    check(`${label}: meta value classes (logged in)`, i.json && i.json.meta['current-user-name'] === 'OTHER_TEXT' && i.json.meta['current-user-id'] === 'NUMERIC_NONZERO', JSON.stringify(i.json && i.json.meta));
    check(`${label}: body attribute classes`, o.json && o.json.bodyAttributes['data-user-level'] === 'ZERO' && i.json && i.json.bodyAttributes['data-user-level'] === 'NUMERIC_NONZERO' && i.json.bodyAttributes['data-user-name'] === 'OTHER_TEXT', JSON.stringify([o.json && o.json.bodyAttributes, i.json && i.json.bodyAttributes]));
    check(`${label}: body classes sanitized`, o.json && o.json.bodyClasses.join() === 'a-index,c-posts,resp' && i.json && i.json.bodyClasses.join() === 'a-index,c-posts,resp', JSON.stringify([o.json && o.json.bodyClasses, i.json && i.json.bodyClasses]));
    check(`${label}: link categories`, o.json && JSON.stringify(o.json.accountLinkCategories) === JSON.stringify({ 'a:LOGIN': 1, 'a:SIGNUP': 1 })
      && i.json && JSON.stringify(i.json.accountLinkCategories) === JSON.stringify({ 'a:ACCOUNT_HOME': 1, 'a:ACCOUNT_SETTINGS': 1, 'a:DMAIL': 1, 'a:LOGOUT': 1, 'a:USER_PROFILE': 1 }), JSON.stringify([o.json && o.json.accountLinkCategories, i.json && i.json.accountLinkCategories]));
    check(`${label}: ID-bearing names withheld and counted`, i.json && i.json.withheldNames === 3 && !('x-4242424' in i.json.meta) && o.json.withheldNames === 0, i.json && i.json.withheldNames);
    check(`${label}: two menu commands only`, o.menu.length === 2, o.menu.join('|'));
  }

  let r = await run('https://rule34.xxx/index.php?page=post&s=list', page('in'));
  check('unsupported host: error only', r.json && r.json.error === 'unsupported host' && leaks(r.text).length === 0 && r.unchanged, r.text);

  // In-probe guard: a build that emits meta content is withheld.
  const leaky = SRC.replace("if (safeName(n)) meta[n] = valueClass(m.getAttribute('content'));", "if (safeName(n)) meta[n] = m.getAttribute('content');");
  r = await run('https://e621.net/posts', page('in'), { src: leaky, cmd: 'IN' });
  check('guard: leaking build output is BLOCKED and leak-free', leaky !== SRC && r.json && r.json.sanitationGuard === 'BLOCKED' && leaks(r.text).length === 0, r.text.slice(0, 200));

  // Static scope.
  const header = SRC.slice(0, SRC.indexOf('==/UserScript=='));
  const code = SRC.slice(SRC.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check('static: @match only e621.net and e926.net', [...header.matchAll(/@match\s+(\S+)/g)].map((x) => x[1]).join() === '*://e621.net/*,*://e926.net/*', header);
  check('static: only GM_registerMenuCommand; no @connect/@require', [...header.matchAll(/@grant\s+(\S+)/g)].map((x) => x[1]).join() === 'GM_registerMenuCommand' && !/@(connect|require|resource|updateURL|downloadURL)/.test(header), header);
  const forbidden = ['fetch(', 'XMLHttpRequest', 'GM_xmlhttpRequest', 'GM.', 'GM_cookie', 'localStorage', 'sessionStorage', 'indexedDB', 'cookie', 'setAttribute', 'removeAttribute', 'replaceWith', 'cloneNode', 'innerHTML', 'outerHTML', '.click(', 'sendBeacon', 'WebSocket', 'window.open', 'dispatchEvent', 'textContent)', 'innerText'];
  const hits = forbidden.filter((f) => code.includes(f));
  check('static: no network, cookie, storage, attribute-write, HTML-string, text-read or click API', hits.length === 0, hits.join(','));

  // Fault controls.
  const unguard = (s) => s.replace(/const leaked = [^;]+;/, 'const leaked = false;');
  const faults = [
    ['leaked username (value instead of class)', unguard(SRC.replace("if (!t) return 'EMPTY';", "if (!t) return 'EMPTY'; if (t.length > 3) return t;")), 'https://e621.net/posts', 'IN'],
    ['leaked user ID (link path)', unguard(SRC.replace("if (/^\\/users\\/\\d+$/.test(path)) return 'USER_PROFILE';", "if (/^\\/users\\/\\d+$/.test(path)) return path;")), 'https://e621.net/posts', 'IN'],
    ['withheld-name filter disabled', unguard(SRC.replace("const safeName = (n) => SAFE_NAME.test(n) && !/\\d{3,}/.test(n);", 'const safeName = () => true;')), 'https://e621.net/posts', 'IN'],
    ['cookie read', SRC.replace('const { raw, facts } = collect();', 'const { raw, facts } = collect(); void document.cookie;'), 'https://e621.net/posts', 'IN'],
    ['script-side request', SRC.replace('const { raw, facts } = collect();', 'const { raw, facts } = collect(); fetch(location.href);'), 'https://e621.net/posts', 'IN'],
    ['page mutation', SRC.replace('const { raw, facts } = collect();', "const { raw, facts } = collect(); document.body.setAttribute('data-probe', '1');"), 'https://e621.net/posts', 'IN'],
    ['e926 relabeled as e621', SRC.replace("location.hostname : null;", "(location.hostname === 'e926.net' ? 'e621.net' : location.hostname) : null;"), 'https://e926.net/posts', 'IN'],
    ['declared state swapped', SRC.replace("() => observe('LOGGED_IN')", "() => observe('LOGGED_OUT')"), 'https://e621.net/posts', 'IN'],
    ['anonymous misclassified', SRC.replace("if (/^anonymous$/i.test(t)) return 'ANONYMOUS_WORD';", ''), 'https://e621.net/posts', 'OUT'],
  ];
  for (const [name, src, url, cmd] of faults) {
    if (src === SRC || src === unguard(SRC)) { check(`fault ${name}: mutant applied`, false, 'replacement did not apply'); continue; }
    const f = await run(url, page(cmd === 'IN' ? 'in' : 'out'), { src, cmd });
    const by = [];
    if (f.crashed) by.push('crash');
    if (leaks(f.text).length) by.push('leak-scan');
    if (!f.unchanged) by.push('page-watch');
    if (!Object.values(f.counters).every((n) => n === 0)) by.push('api-counter');
    if (!f.json || f.json.site !== new URL(url).hostname) by.push('host-identity');
    if (!f.json || f.json.declaredState !== (cmd === 'IN' ? 'LOGGED_IN' : 'LOGGED_OUT')) by.push('declared-state');
    if (cmd === 'OUT' && (!f.json || !f.json.meta || f.json.meta['current-user-name'] !== 'ANONYMOUS_WORD')) by.push('value-class');
    const fcode = src.slice(src.indexOf('==/UserScript==')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (forbidden.some((x) => fcode.includes(x))) by.push('static');
    check(`fault ${name}: caught by ${by.join('+') || 'nothing'}`, by.length > 0, 'mutant passed all checks');
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = {
    checkpoint: 'IB08', bounding_input: 'B1 native login-state marker', status: 'LOCAL QUALIFICATION (fixtures are synthetic, not live markup)',
    probe: FILE, probe_sha256_lf: crypto.createHash('sha256').update(SRC).digest('hex'),
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
