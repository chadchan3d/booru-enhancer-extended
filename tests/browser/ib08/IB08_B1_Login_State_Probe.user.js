// ==UserScript==
// @name         IB08 B1 Native Login-State Marker Probe
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib08-b1-login-state
// @version      1.1.0
// @description  Read-only, sanitized listing of native login-state marker candidates on e621/e926 listings (IB08 bounding input B1).
// @author       ChadChan3D
// @license      MIT
// @match        *://e621.net/*
// @match        *://e926.net/*
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @noframes
// ==/UserScript==

/* IB08 B1 login-state probe — observational only.
 * Reports only login-relevant candidate markers (meta names, <html>/<body>
 * attribute names and class tokens whose names relate to user/login/session/
 * account state) with a VALUE CLASS each, plus counts of every other name and
 * of same-origin account-related link/form categories. It never outputs an
 * attribute value, meta content, link path, username, ID or token, never
 * reads cookies or storage, never requests, clicks or changes the page
 * (except its own result overlay). The operator declares the state via the
 * menu command; the probe itself decides nothing about login state.
 *
 * 1.1.0: the leak guard now checks the page-derived facts, the only output
 * that carries captured content, at unchanged strictness. The probe's own
 * fixed labels (site, state, route) come only from literal allowlists.
 * Under 1.0.0 an ordinary page value containing the site's short name
 * matched the probe's own site label and blocked every live run. A blocked
 * result now carries value-free diagnostics (sources and sections only). */
(() => {
  'use strict';

  const SITES = ['e621.net', 'e926.net'];
  const SITE = SITES.includes(location.hostname) ? SITES[SITES.indexOf(location.hostname)] : null;
  const MAX_NODES = 3000;
  const SAFE_NAME = /^[a-z][a-z0-9_:.-]{0,60}$/;
  const RELEVANT = /user|login|logged|logout|anon|guest|member|session|account|auth|csrf|level|current|signed/;
  const TRIVIAL = new Set(['true', 'false', 'null', 'anonymous', 'yes', 'no', 'on', 'off']);

  const safeName = (n) => SAFE_NAME.test(n) && !/\d{3,}/.test(n);
  function valueClass(v) {
    if (v === null || v === undefined) return 'ABSENT';
    const t = String(v).trim();
    if (!t) return 'EMPTY';
    if (/^anonymous$/i.test(t)) return 'ANONYMOUS_WORD';
    if (t === '0') return 'ZERO';
    if (/^\d+$/.test(t)) return 'NUMERIC_NONZERO';
    if (/^true$/i.test(t)) return 'BOOLEAN_TRUE';
    if (/^false$/i.test(t)) return 'BOOLEAN_FALSE';
    return 'OTHER_TEXT';
  }

  function linkCategory(path, el) {
    const method = (el.getAttribute('data-method') || el.getAttribute('method') || '').toLowerCase();
    if (path === '/session/new' || path === '/login') return 'LOGIN';
    if (path === '/users/new' || path === '/signup') return 'SIGNUP';
    if (path === '/session/sign_out' || path === '/logout' || (path === '/session' && method === 'delete')) return 'LOGOUT';
    if (path === '/session') return 'SESSION_OTHER';
    if (path === '/users/home') return 'ACCOUNT_HOME';
    if (/^\/users\/\d+$/.test(path)) return 'USER_PROFILE';
    if (/^\/users\/\d+\/edit$/.test(path) || path === '/users/settings' || path === '/users/edit') return 'ACCOUNT_SETTINGS';
    if (path === '/dmails' || path.startsWith('/dmails/')) return 'DMAIL';
    return null;
  }

  function collect() {
    const raw = new Map(); // value -> Set(source)
    const addRaw = (v, source) => {
      const t = v === null || v === undefined ? '' : String(v).trim();
      if (t.length < 3 || TRIVIAL.has(t.toLowerCase())) return;
      if (!raw.has(t)) raw.set(t, new Set());
      raw.get(t).add(source);
    };
    let withheld = 0;
    const other = { meta: 0, htmlAttributes: 0, bodyAttributes: 0, htmlClasses: 0, bodyClasses: 0 };
    const attrsOf = (el, key, source) => {
      const out = {};
      for (const a of el ? [...el.attributes] : []) {
        if (a.name === 'class') continue; // class tokens are handled below
        addRaw(a.value, source);
        if (!RELEVANT.test(a.name)) { other[key]++; continue; }
        if (safeName(a.name)) out[a.name] = valueClass(a.value); else withheld++;
      }
      return Object.fromEntries(Object.entries(out).sort());
    };
    const classesOf = (el, key) => {
      const out = [];
      for (const t of el ? [...el.classList] : []) {
        if (!RELEVANT.test(t.toLowerCase())) { other[key]++; continue; }
        if (safeName(t) && t === t.toLowerCase()) out.push(t); else withheld++;
      }
      return out.sort();
    };
    const meta = {};
    for (const m of document.querySelectorAll('meta[name]')) {
      const n = (m.getAttribute('name') || '').toLowerCase();
      addRaw(m.getAttribute('content'), 'META_CONTENT');
      if (!RELEVANT.test(n)) { other.meta++; continue; }
      if (safeName(n)) meta[n] = valueClass(m.getAttribute('content')); else withheld++;
    }
    const links = {};
    let scanned = 0;
    for (const el of document.querySelectorAll('a[href], form[action]')) {
      if (++scanned > MAX_NODES) break;
      const ref = el.getAttribute(el.localName === 'a' ? 'href' : 'action');
      addRaw(ref, 'LINK_REF');
      let url; try { url = new URL(ref, location.href); } catch { continue; }
      addRaw(url.href, 'LINK_URL'); addRaw(url.pathname, 'LINK_PATH');
      if (url.origin !== location.origin) continue;
      const cat = linkCategory(url.pathname.replace(/\/+$/, '') || '/', el);
      if (cat) links[`${el.localName}:${cat}`] = (links[`${el.localName}:${cat}`] || 0) + 1;
    }
    const facts = {
      meta: Object.fromEntries(Object.entries(meta).sort()),
      htmlAttributes: attrsOf(document.documentElement, 'htmlAttributes', 'HTML_ATTR'),
      htmlClasses: classesOf(document.documentElement, 'htmlClasses'),
      bodyAttributes: attrsOf(document.body, 'bodyAttributes', 'BODY_ATTR'),
      bodyClasses: classesOf(document.body, 'bodyClasses'),
      accountLinkCategories: Object.fromEntries(Object.entries(links).sort()),
      otherNameCounts: other,
      withheldNames: withheld,
    };
    return { raw, facts };
  }

  // Unchanged matching rule, applied to every page-derived section: short plain values
  // as exact JSON tokens; long or digit/path-bearing values anywhere.
  const hits = (text, v) => text.includes(JSON.stringify(v)) || ((v.length >= 8 || /[\d/]/.test(v)) && text.includes(v));
  function guard(constants, facts, raw) {
    const factsText = JSON.stringify(facts);
    const full = JSON.stringify({ ...constants, ...facts }, null, 2);
    const blocking = [...raw.entries()].filter(([v]) => hits(factsText, v));
    const schemeLeak = /https?:\/\//i.test(full);
    if (!blocking.length && !schemeLeak) return full;
    const bySource = {}; const bySection = {}; const byMode = { EXACT_TOKEN: 0, SUBSTRING: 0 };
    for (const [v, sources] of blocking) {
      for (const s of sources) bySource[s] = (bySource[s] || 0) + 1;
      for (const [k, sec] of Object.entries(facts)) if (hits(JSON.stringify(sec), v)) bySection[k] = (bySection[k] || 0) + 1;
      byMode[factsText.includes(JSON.stringify(v)) ? 'EXACT_TOKEN' : 'SUBSTRING']++;
    }
    return JSON.stringify({ ...constants, sanitationGuard: 'BLOCKED', note: 'output withheld: a raw captured value would have been emitted',
      blockDiagnostics: { blockingValues: blocking.length, bySource, bySection, byMode, urlSchemeInOutput: schemeLeak } }, null, 2);
  }

  function show(text) {
    document.querySelector('#ib08-b1-result')?.remove();
    const root = document.createElement('div');
    root.id = 'ib08-b1-result';
    root.style.cssText = 'position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.readOnly = true;
    ta.style.cssText = 'width:100%;height:75vh;background:#000;color:#eee';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.onclick = () => root.remove();
    root.append(ta, close);
    document.body.appendChild(root);
    ta.focus();
    ta.select();
  }

  function observe(declaredState) {
    if (!SITE) return show(JSON.stringify({ probe: 'ib08-b1-login-state', error: 'unsupported host' }, null, 2));
    document.querySelector('#ib08-b1-result')?.remove();
    const { raw, facts } = collect();
    // Fixed labels: literals or allowlist members only, never captured content.
    const constants = {
      probe: 'ib08-b1-login-state', version: '1.1.0', site: SITE, declaredState,
      route: /^\/posts\/?$/.test(location.pathname) ? 'posts-listing' : 'other',
      evidenceGate: 'IB08 bounding input B1 (native login-state marker)',
      enhancerMarkersPresent: !!document.querySelector('.be-thumb-wrap, .be-thumb-img, #be-toast-container, .be-gallery-grid'),
      limits: 'Login-relevant names and value classes only; every other name is counted. No values, paths, IDs, usernames or tokens. The probe does not decide login state.',
    };
    show(guard(constants, facts, raw));
  }

  GM_registerMenuCommand('IB08 login-state: observe (I am logged OUT)', () => observe('LOGGED_OUT'));
  GM_registerMenuCommand('IB08 login-state: observe (I am logged IN)', () => observe('LOGGED_IN'));
})();
