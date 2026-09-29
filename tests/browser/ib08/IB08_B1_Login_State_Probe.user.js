// ==UserScript==
// @name         IB08 B1 Native Login-State Marker Probe
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib08-b1-login-state
// @version      1.0.0
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
 * Lists candidate native login-state markers as NAMES and VALUE CLASSES only:
 * meta names, <html>/<body> attribute names and class tokens, and counts of
 * same-origin account-related link/form categories. It never outputs an
 * attribute value, meta content, link path, username, ID or token, never
 * reads cookies or storage, never requests, clicks or changes the page
 * (except its own result overlay). The operator declares the state via the
 * menu command; the probe itself decides nothing about login state. */
(() => {
  'use strict';

  const SITE = location.hostname === 'e621.net' || location.hostname === 'e926.net' ? location.hostname : null;
  const MAX_NODES = 3000;
  const SAFE_NAME = /^[a-z][a-z0-9_:.-]{0,60}$/;
  const TRIVIAL = new Set(['true', 'false', 'null', 'anonymous', 'yes', 'no', 'on', 'off']);

  // Names are output only if generic; anything else is counted as withheld.
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
    const raw = new Set();
    const addRaw = (v) => { if (v && String(v).trim().length >= 3 && !TRIVIAL.has(String(v).trim().toLowerCase())) raw.add(String(v).trim()); };
    let withheld = 0;
    const attrsOf = (el) => {
      const out = {};
      for (const a of el ? [...el.attributes] : []) {
        if (a.name === 'class') continue; // class tokens are output deliberately, filtered by safeName
        addRaw(a.value);
        if (safeName(a.name)) out[a.name] = valueClass(a.value); else withheld++;
      }
      return Object.fromEntries(Object.entries(out).sort());
    };
    const classesOf = (el) => {
      const toks = el ? [...el.classList] : [];
      const ok = toks.filter((t) => safeName(t.toLowerCase()) && t === t.toLowerCase());
      withheld += toks.length - ok.length;
      return ok.sort();
    };
    const meta = {};
    for (const m of document.querySelectorAll('meta[name]')) {
      const n = (m.getAttribute('name') || '').toLowerCase();
      addRaw(m.getAttribute('content'));
      if (safeName(n)) meta[n] = valueClass(m.getAttribute('content')); else withheld++;
    }
    const links = {};
    let scanned = 0;
    for (const el of document.querySelectorAll('a[href], form[action]')) {
      if (++scanned > MAX_NODES) break;
      const ref = el.getAttribute(el.localName === 'a' ? 'href' : 'action');
      addRaw(ref);
      let url; try { url = new URL(ref, location.href); } catch { continue; }
      addRaw(url.href); addRaw(url.pathname);
      if (url.origin !== location.origin) continue;
      const cat = linkCategory(url.pathname.replace(/\/+$/, '') || '/', el);
      if (cat) links[`${el.localName}:${cat}`] = (links[`${el.localName}:${cat}`] || 0) + 1;
    }
    return {
      raw,
      facts: {
        meta: Object.fromEntries(Object.entries(meta).sort()),
        htmlAttributes: attrsOf(document.documentElement),
        htmlClasses: classesOf(document.documentElement),
        bodyAttributes: attrsOf(document.body),
        bodyClasses: classesOf(document.body),
        accountLinkCategories: Object.fromEntries(Object.entries(links).sort()),
        withheldNames: withheld,
      },
    };
  }

  function guard(text, raw) {
    // Short plain values are matched as exact JSON tokens; long or digit/path-bearing values anywhere.
    const leaked = [...raw].some((v) => text.includes(JSON.stringify(v)) || ((v.length >= 8 || /[\d/]/.test(v)) && text.includes(v))) || /https?:\/\//i.test(text);
    return leaked ? JSON.stringify({ probe: 'ib08-b1-login-state', site: SITE, sanitationGuard: 'BLOCKED', note: 'output withheld: a raw captured value would have been emitted' }, null, 2) : text;
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
    const result = {
      probe: 'ib08-b1-login-state', version: '1.0.0', site: SITE, declaredState,
      route: /^\/posts\/?$/.test(location.pathname) ? 'posts-listing' : 'other',
      evidenceGate: 'IB08 bounding input B1 (native login-state marker)',
      enhancerMarkersPresent: !!document.querySelector('.be-thumb-wrap, .be-thumb-img, #be-toast-container, .be-gallery-grid'),
      ...facts,
      limits: 'Names and value classes only. No values, paths, IDs, usernames or tokens. The probe does not decide login state.',
    };
    show(guard(JSON.stringify(result, null, 2), raw));
  }

  GM_registerMenuCommand('IB08 login-state: observe (I am logged OUT)', () => observe('LOGGED_OUT'));
  GM_registerMenuCommand('IB08 login-state: observe (I am logged IN)', () => observe('LOGGED_IN'));
})();
