'use strict';
const fs = require('fs');
const path = require('path');

const sourcePath = path.resolve(__dirname, '../../../Booru_Enhancer.user.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const results = [];

function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail });
  if (!condition) throw new Error(name + ': ' + detail);
}

new Function(source);
check('full-source-syntax', true);

const rtStart = source.indexOf('BE.runtime = (() => {');
const rtEnd = source.indexOf('\n\t/* Compatibility facade', rtStart);
if (rtStart < 0 || rtEnd < 0) throw new Error('runtime section missing');
const rtSource = source.slice(rtStart, rtEnd);

const factory = new Function(
  'BE','GM_getValue','GM_setValue','GM_deleteValue','GM_listValues',
  'GM_xmlhttpRequest','GM_registerMenuCommand','GM_unregisterMenuCommand','GM','fetch','console',
  rtSource + '\nreturn BE.runtime;'
);

const fakeConsole = { error(){}, warn(){}, log(){}, info(){}, debug(){} };
const fakeFetch = (...args) => Promise.resolve({ ok: true, args });

(async () => {
  const store = new Map();
  let menuCalls = 0;
  const BE1 = {};
  const rt1 = factory(
    BE1,
    (k,d) => store.has(k) ? store.get(k) : d,
    (k,v) => { store.set(k,v); },
    (k) => { store.delete(k); },
    () => [...store.keys()],
    (opts) => {
      opts.onprogress?.({ lengthComputable:true, loaded:5, total:10 });
      opts.onload?.({ status:200, responseText:'ok' });
      return { abort(){ opts.onabort?.({ status:0 }); } };
    },
    () => { menuCalls++; return 4; },
    () => {},
    undefined,
    fakeFetch,
    fakeConsole
  );
  await rt1.storage.setValue('x', {a:1});
  check('legacy-storage-roundtrip', JSON.stringify(await rt1.storage.getValue('x')) === '{"a":1}');
  check('legacy-storage-mode', rt1.capabilities.storageMode === 'legacy', rt1.capabilities.storageMode);
  check('legacy-request-mode', rt1.capabilities.requestMode === 'legacy', rt1.capabilities.requestMode);
  let progress = 0;
  let loads = 0;
  const op1 = rt1.request({ url:'x', onprogress:()=>progress++, onload:()=>loads++ });
  const r1 = await op1.promise;
  check('legacy-request-single-settlement', r1.status === 200 && loads === 1 && op1.terminalKind === 'load');
  check('legacy-progress-forwarded', progress === 1, String(progress));
  const ticket = rt1.menu.registerMenuCommand('x', () => {});
  check('legacy-menu-register', ticket?.id === 4 && menuCalls === 1);

  const modernStore = new Map();
  let modernLoads = 0;
  const modernGM = {
    getValue:(k,d)=>Promise.resolve(modernStore.has(k)?modernStore.get(k):d),
    setValue:(k,v)=>{modernStore.set(k,v); return Promise.resolve();},
    deleteValue:(k)=>{modernStore.delete(k); return Promise.resolve();},
    listValues:()=>Promise.resolve([...modernStore.keys()]),
    xmlHttpRequest:(opts)=>{
      const res={status:200,responseText:'modern'};
      opts.onload?.(res);
      const p=Promise.resolve(res);
      p.abort=()=>opts.onabort?.({status:0});
      return p;
    },
    registerMenuCommand:()=>7,
    unregisterMenuCommand:()=>{}
  };
  const rt2 = factory({},undefined,undefined,undefined,undefined,undefined,undefined,undefined,modernGM,fakeFetch,fakeConsole);
  const op2 = rt2.request({ url:'x', onload:()=>modernLoads++ });
  const r2 = await op2.promise;
  await Promise.resolve();
  check('modern-mode-detected', rt2.capabilities.storageMode === 'modern' && rt2.capabilities.requestMode === 'modern');
  check('modern-callback-promise-deduped', r2.status === 200 && modernLoads === 1, String(modernLoads));

  const modernErrGM = {
    ...modernGM,
    xmlHttpRequest:(opts)=>{
      const res={status:0};
      opts.onerror?.(res);
      const p=Promise.resolve(res);
      p.abort=()=>opts.onabort?.({status:0});
      return p;
    }
  };
  const rt3 = factory({},undefined,undefined,undefined,undefined,undefined,undefined,undefined,modernErrGM,fakeFetch,fakeConsole);
  let errorKind = '';
  try { await rt3.request({url:'x'}).promise; } catch (e) { errorKind = e.kind; }
  check('modern-error-callback-beats-promise-resolve', errorKind === 'error', errorKind);

  const syncAbortGM = {
    ...modernGM,
    xmlHttpRequest:(opts)=>({ abort(){ opts.onabort?.({status:0}); } })
  };
  const rt4 = factory({},undefined,undefined,undefined,undefined,undefined,undefined,undefined,syncAbortGM,fakeFetch,fakeConsole);
  const op4 = rt4.request({url:'x'});
  const cancel = op4.cancel({abortTransport:true});
  let cancelKind = '';
  try { await op4.promise; } catch (e) { cancelKind = e.kind; }
  check(
    'logical-cancel-precedes-sync-abort',
    cancelKind === 'cancelled' && op4.terminalKind === 'cancelled' && cancel.logicalCancelled === true,
    JSON.stringify({cancelKind,terminalKind:op4.terminalKind,cancel})
  );

  const failures = results.filter(r => !r.pass);
  console.log(JSON.stringify({
    suite:'IB03 production runtime wrapper conformance',
    source: path.basename(sourcePath),
    tests: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    results
  }, null, 2));
  process.exitCode = failures.length ? 1 : 0;
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
