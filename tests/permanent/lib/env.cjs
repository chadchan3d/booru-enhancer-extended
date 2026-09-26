'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const BASELINE_COMMIT = '6f06dfd19fe916be784fd6bafe6dce6ed76503fe';
const BASELINE_SHA256 = '9c432eee32b16f144f4553ae439b7097bf4b48cf6858d601f4d16b0d4e602af0';
const DEFAULT_MASTER = path.resolve(__dirname, '../../../Booru_Enhancer.user.js');

class FakeClock {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = new Map();
    this.cancelled = new Set();
  }

  setTimeout(fn, delay = 0, ...args) {
    const id = this.nextId++;
    const at = this.now + Math.max(0, Number(delay) || 0);
    this.tasks.set(id, { id, at, fn, args, interval: null });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
    this.cancelled.add(id);
  }

  setInterval(fn, delay = 0, ...args) {
    const id = this.nextId++;
    const interval = Math.max(1, Number(delay) || 0);
    this.tasks.set(id, { id, at: this.now + interval, fn, args, interval });
    return id;
  }

  clearInterval(id) {
    this.tasks.delete(id);
    this.cancelled.add(id);
  }

  _nextDue(target) {
    let selected = null;
    for (const task of this.tasks.values()) {
      if (task.at > target) continue;
      if (!selected || task.at < selected.at || (task.at === selected.at && task.id < selected.id)) selected = task;
    }
    return selected;
  }

  async flushMicrotasks(rounds = 4) {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
  }

  async tick(ms, maxTasks = 20000) {
    const target = this.now + Math.max(0, Number(ms) || 0);
    let executed = 0;
    while (true) {
      const task = this._nextDue(target);
      if (!task) break;
      if (++executed > maxTasks) throw new Error('fake clock exceeded ' + maxTasks + ' tasks before ' + target + 'ms');
      this.tasks.delete(task.id);
      this.now = task.at;
      task.fn(...task.args);
      if (task.interval !== null && !this.cancelled.has(task.id)) {
        task.at = this.now + task.interval;
        this.tasks.set(task.id, task);
      }
      await this.flushMicrotasks();
    }
    this.now = target;
    await this.flushMicrotasks();
  }

  clearAll() {
    this.tasks.clear();
    this.cancelled.clear();
  }
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function loadMaster() {
  const sourcePath = path.resolve(process.env.BE_MASTER || DEFAULT_MASTER);
  const source = fs.readFileSync(sourcePath, 'utf8');
  return { sourcePath, source, sha256: sha256(source) };
}

function makeEnv({ source, url, html, respond, settings = {}, gmDownload, useFakeClock = true }) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const clock = useFakeClock ? new FakeClock() : null;
  const log = [];
  const store = {};
  const toasts = [];
  const downloads = [];
  const aborts = [];
  const ioCallbacks = [];

  if (clock) {
    w.setTimeout = clock.setTimeout.bind(clock);
    w.clearTimeout = clock.clearTimeout.bind(clock);
    w.setInterval = clock.setInterval.bind(clock);
    w.clearInterval = clock.clearInterval.bind(clock);
    w.Date.now = () => clock.now;
  }

  for (const [k, v] of Object.entries(settings)) store['be:setting:' + k] = JSON.stringify(v);

  w.GM_getValue = (k, d) => (k in store ? store[k] : d);
  w.GM_setValue = (k, v) => { store[k] = v; };
  w.GM_deleteValue = (k) => { delete store[k]; };
  w.GM_listValues = () => Object.keys(store);
  w.GM_addStyle = (css) => {
    const s = w.document.createElement('style');
    s.textContent = css;
    w.document.head.appendChild(s);
    return s;
  };
  w.GM_registerMenuCommand = () => {};
  w.GM_notification = () => {};
  w.GM_info = { script: { version: 'ib01-test' } };

  const schedule = (fn, ms) => clock ? w.setTimeout(fn, ms) : setTimeout(fn, ms);

  w.GM_download = gmDownload || ((o) => {
    downloads.push({ at: clock ? clock.now : Date.now(), via: 'GM_download', url: o.url });
    schedule(() => o.onload && o.onload(), 50);
    return { abort() { aborts.push({ via: 'GM_download', url: o.url }); } };
  });

  w.GM_xmlhttpRequest = (o) => {
    const res = respond(o.url, 'GM_xhr', o.method || 'GET');
    log.push({ at: clock ? clock.now : Date.now(), via: 'GM_xhr', method: o.method || 'GET', url: o.url, status: res.status });
    let cancelled = false;
    const id = schedule(() => {
      if (!cancelled) o.onload && o.onload({ status: res.status, responseText: res.body, finalUrl: o.url, responseHeaders: res.headers || '' });
    }, 20);
    return {
      abort() {
        cancelled = true;
        if (clock) clock.clearTimeout(id); else clearTimeout(id);
        aborts.push({ via: 'GM_xhr', url: o.url });
        o.onabort && o.onabort({});
      },
    };
  };

  w.fetch = async (u, init = {}) => {
    const url_ = String(u);
    const res = respond(url_, 'fetch', init.method || 'GET');
    log.push({ at: clock ? clock.now : Date.now(), via: 'fetch', method: init.method || 'GET', url: url_, status: res.status });
    if (clock) {
      await new Promise((resolve) => w.setTimeout(resolve, 20));
    } else {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      url: url_,
      headers: new Map(),
      text: async () => res.body,
      json: async () => JSON.parse(res.body),
    };
  };

  w.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; ioCallbacks.push(this); }
    observe(el) { this.el = el; }
    unobserve() {}
    disconnect() { this.dead = true; }
  };

  if (!w.CSS) w.CSS = {};
  if (!w.CSS.escape) w.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c);
  w.HTMLMediaElement.prototype.load = function () {};
  w.HTMLMediaElement.prototype.pause = function () {};
  w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  w.HTMLImageElement.prototype.decode = function () { return Promise.resolve(); };
  w.console.log = () => {};
  w.console.debug = () => {};
  w.console.info = () => {};
  w.console.warn = () => {};
  w.console.error = () => {};

  function boot() {
    w.eval(source);
    const mo = new w.MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.parentElement && /toast/i.test(n.parentElement.id + ' ' + n.parentElement.className)) toasts.push(n.textContent);
        }
      }
    });
    mo.observe(w.document.body, { childList: true, subtree: true });
    return mo;
  }

  async function advance(ms) {
    if (clock) return clock.tick(ms);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  function close() {
    if (clock) clock.clearAll();
    dom.window.close();
  }

  return { dom, w, clock, log, store, toasts, downloads, aborts, ioCallbacks, boot, advance, close };
}

module.exports = {
  BASELINE_COMMIT,
  BASELINE_SHA256,
  FakeClock,
  loadMaster,
  makeEnv,
};
