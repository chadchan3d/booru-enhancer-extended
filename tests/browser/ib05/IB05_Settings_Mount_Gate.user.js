// ==UserScript==
// @name         Booru Enhancer Extended — IB05 Settings Mount Gate
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib05-test
// @version      1.0.0
// @description  Local-only isolated GM storage and migration-before-mount evidence for IB05.
// @author       ChadChan3D
// @license      MIT
// @match        http://127.0.0.1:8776/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @run-at       document-end
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  const RESULT_KEY = 'ib05:last-result:v1';
  const PRODUCT_VERSION = '1.2.7.3';
  const SETTINGS_SCHEMA_VERSION = 1;
  const SCHEMA_VERSION_KEY = 'settings:schemaVersion';
  const SETTING_PREFIX = 'setting:';

  const SCHEMA = {
    'general.enabled': { type:'bool', def:true },
    'general.theme': { type:'select', def:'dark', choices:['dark','light'] },
    'general.accentColor': { type:'color', def:'#ff8ac6' },
    'general.toolbarPosition': { type:'select', def:'bottom-right', choices:['bottom-right','bottom-left','top-right','top-left'] },
    'media.hoverPreview': { type:'bool', def:true },
    'media.thumbQuality': { type:'select', def:'sample', choices:['preview','sample','original'] },
    'download.filenameTemplate': { type:'text', def:'{character} - {artist} ({id})' },
    'download.maxCharacters': { type:'number', def:3, min:1, max:10 },
    'download.tagDelimiter': { type:'text', def:', ' },
    'download.retries': { type:'number', def:3, min:0, max:10 },
    'download.openMode': { type:'select', def:'new-tab', choices:['new-tab','popup'] },
    'viewer.enabled': { type:'bool', def:true },
    'viewer.autoplayVideo': { type:'bool', def:true },
    'viewer.loopVideo': { type:'bool', def:true },
    'viewer.muteVideo': { type:'bool', def:true },
    'viewer.rememberVolume': { type:'bool', def:true },
    'viewer.fitMode': { type:'select', def:'fit-both', choices:['fit-both','fit-width','fit-height','original-size'] },
    'gallery.infiniteScroll': { type:'bool', def:true },
    'gallery.gridDensity': { type:'range', def:0, min:0, max:10 },
    'gallery.thumbnailSize': { type:'range', def:220, min:120, max:500 },
    'gallery.gridGap': { type:'range', def:8, min:0, max:20 },
    'gallery.compactMode': { type:'bool', def:false },
    'keys.download': { type:'text', def:'d' },
    'keys.favorite': { type:'text', def:'f' },
    'keys.openOriginal': { type:'text', def:'o' },
    'keys.next': { type:'text', def:'ArrowRight' },
    'keys.prev': { type:'text', def:'ArrowLeft' },
    'keys.close': { type:'text', def:'Escape' },
    'keys.playPause': { type:'text', def:' ' },
    'debug.verboseLogging': { type:'bool', def:false },
  };

  const storage = {
    async listValues() { return GM_listValues(); },
    async getValue(key) { return GM_getValue(key); },
    async setValue(key, value) { return GM_setValue(key, value); },
    async deleteValue(key) { return GM_deleteValue(key); },
  };

  const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => performance.now();

  function validateValue(def, value) {
    if (!def) return {ok:false,reason:'unknown-setting'};
    if (def.type === 'bool') return typeof value === 'boolean' ? {ok:true,value} : {ok:false,reason:'expected-boolean'};
    if (def.type === 'number' || def.type === 'range') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return {ok:false,reason:'expected-finite-number'};
      if (def.min !== undefined && value < def.min) return {ok:false,reason:'below-min'};
      if (def.max !== undefined && value > def.max) return {ok:false,reason:'above-max'};
      return {ok:true,value};
    }
    if (def.type === 'select') return def.choices.includes(value) ? {ok:true,value} : {ok:false,reason:'invalid-choice'};
    if (def.type === 'text') return typeof value === 'string' ? {ok:true,value} : {ok:false,reason:'expected-string'};
    if (def.type === 'color') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? {ok:true,value} : {ok:false,reason:'invalid-color'};
    return {ok:false,reason:'unsupported-schema-type'};
  }

  function decodeRaw(raw, def = null) {
    if (typeof raw !== 'string') return {ok:true,value:clone(raw),encoding:'typed'};
    try { return {ok:true,value:JSON.parse(raw),encoding:'json-string'}; }
    catch {
      if (def && (def.type === 'text' || def.type === 'select' || def.type === 'color')) {
        return {ok:true,value:raw,encoding:'typed-string'};
      }
      return {ok:false,value:raw,encoding:'malformed-string'};
    }
  }

  async function rawSnapshot(s = storage) {
    const keys = (await s.listValues()).slice().sort();
    const out = {};
    for (const key of keys) out[key] = clone(await s.getValue(key));
    return out;
  }

  async function readSnapshot(s = storage) {
    const raw = await rawSnapshot(s);
    const decoded = {};
    const decodeErrors = {};
    for (const [key, value] of Object.entries(raw)) {
      const def = key.startsWith(SETTING_PREFIX) ? SCHEMA[key.slice(SETTING_PREFIX.length)] : null;
      const dec = decodeRaw(value, def);
      if (dec.ok) decoded[key] = dec.value;
      else decodeErrors[key] = {raw:clone(value),reason:'malformed-storage-value'};
    }
    return {raw,decoded,decodeErrors};
  }

  function resolveSnapshot(snapshot) {
    const marker = snapshot.decoded[SCHEMA_VERSION_KEY];
    if (typeof marker === 'number' && marker > SETTINGS_SCHEMA_VERSION) {
      return {
        status:'UNSUPPORTED_NEWER_SCHEMA',canMount:false,schemaVersion:marker,effective:null,
        invalidKnown:{},unknown:{},migrationWrites:[],provenance:'UNKNOWN',recovery:{raw:clone(snapshot.raw)}
      };
    }

    const effective = {};
    const invalidKnown = {};
    for (const [key,def] of Object.entries(SCHEMA)) {
      const storeKey = SETTING_PREFIX + key;
      if (!(storeKey in snapshot.raw)) {
        effective[key] = clone(def.def);
        continue;
      }
      if (snapshot.decodeErrors[storeKey]) {
        effective[key] = clone(def.def);
        invalidKnown[key] = {raw:clone(snapshot.raw[storeKey]),reason:'malformed-storage-value'};
        continue;
      }
      const value = snapshot.decoded[storeKey];
      const checked = validateValue(def,value);
      if (checked.ok) effective[key] = clone(checked.value);
      else {
        effective[key] = clone(def.def);
        invalidKnown[key] = {raw:clone(snapshot.raw[storeKey]),decoded:clone(value),reason:checked.reason};
      }
    }

    const unknown = {};
    for (const key of Object.keys(snapshot.raw)) {
      if (key === SCHEMA_VERSION_KEY || key === RESULT_KEY) continue;
      if (key.startsWith(SETTING_PREFIX) && SCHEMA[key.slice(SETTING_PREFIX.length)]) continue;
      unknown[key] = clone(snapshot.raw[key]);
    }
    const meaningful = Object.keys(snapshot.raw).filter((k)=>k !== SCHEMA_VERSION_KEY && k !== RESULT_KEY);
    return {
      status:'READY',canMount:true,schemaVersion:typeof marker === 'number' ? marker : 0,
      effective,invalidKnown,unknown,
      migrationWrites:marker === SETTINGS_SCHEMA_VERSION ? [] : [{key:SCHEMA_VERSION_KEY,value:SETTINGS_SCHEMA_VERSION}],
      provenance:meaningful.length === 0 ? 'AMBIGUOUS_EMPTY' : 'LEGACY_OR_EXISTING',
      recovery:{raw:clone(snapshot.raw),invalidKnown:clone(invalidKnown)}
    };
  }

  async function migrate(s = storage, options = {}) {
    const trace = options.trace || [];
    trace.push({event:'migration-start',t:now()});
    let snapshot;
    try { snapshot = await readSnapshot(s); }
    catch (error) {
      trace.push({event:'migration-read-failed',t:now(),error:String(error?.message||error)});
      return {ok:false,canMount:false,error:'READ_FAILED',trace};
    }
    const resolved = resolveSnapshot(snapshot);
    if (!resolved.canMount) {
      trace.push({event:'migration-blocked-newer-schema',t:now(),schemaVersion:resolved.schemaVersion});
      return {ok:false,canMount:false,error:'NEWER_SCHEMA',resolved,trace};
    }
    if (options.beforeCommit) await options.beforeCommit();
    try {
      for (const write of resolved.migrationWrites) await s.setValue(write.key,write.value);
    } catch (error) {
      trace.push({event:'migration-write-failed',t:now(),error:String(error?.message||error)});
      return {ok:false,canMount:false,error:'WRITE_FAILED',resolved,trace};
    }
    trace.push({event:'migration-resolved',t:now()});
    return {ok:true,canMount:true,resolved,trace};
  }

  async function initializeWithBarrier(s, mount, options = {}) {
    const trace = [];
    const r = await migrate(s,{...options,trace});
    if (!r.ok || !r.canMount) return {...r,mounted:false};
    const mountAt = now();
    mount(clone(r.resolved.effective),mountAt);
    trace.push({event:'first-dependent-mount',t:mountAt});
    return {...r,mounted:true,mountAt,trace};
  }

  async function clearAll() {
    for (const key of await storage.listValues()) await storage.deleteValue(key);
  }

  async function seedSemantic(entries, encoding = 'typed') {
    for (const [key,value] of Object.entries(entries)) {
      await storage.setValue(key, encoding === 'json-string' ? JSON.stringify(value) : clone(value));
    }
  }

  function assert(cond,msg) { if (!cond) throw new Error(msg); }
  function same(a,b) { return JSON.stringify(a) === JSON.stringify(b); }

  function show(text) {
    document.querySelector('#ib05-result')?.remove();
    const root=document.createElement('div');
    root.id='ib05-result';
    root.style.cssText='position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta=document.createElement('textarea');
    ta.value=text;
    ta.style.cssText='width:100%;height:75vh;background:#000;color:#eee';
    const close=document.createElement('button');
    close.textContent='Close';
    close.onclick=()=>root.remove();
    root.append(ta,close);
    document.body.appendChild(root);
    ta.focus();
    ta.select();
  }

  async function run() {
    const tests=[];
    const test=async(id,name,fn)=>{
      try { const detail=await fn(); tests.push({id,name,status:'PASS',detail}); }
      catch(e) { tests.push({id,name,status:'FAIL',error:String(e?.stack||e)}); }
    };

    await clearAll();

    await test('B01','actual GM typed-value round trip',async()=>{
      await clearAll();
      await storage.setValue('typed:boolean',false);
      await storage.setValue('typed:number',5);
      await storage.setValue('typed:string','original');
      const snap=await rawSnapshot();
      assert(snap['typed:boolean']===false,'boolean type lost');
      assert(snap['typed:number']===5,'number type lost');
      assert(snap['typed:string']==='original','string type lost');
      return {boolean:typeof snap['typed:boolean'],number:typeof snap['typed:number'],string:typeof snap['typed:string']};
    });

    await test('B02','actual GM JSON-string form decodes production-like values',async()=>{
      await clearAll();
      await seedSemantic({
        'setting:viewer.autoplayVideo':false,
        'setting:gallery.gridDensity':5,
        'setting:media.thumbQuality':'original'
      },'json-string');
      const snap=await readSnapshot();
      assert(snap.decoded['setting:viewer.autoplayVideo']===false,'serialized boolean decode failed');
      assert(snap.decoded['setting:gallery.gridDensity']===5,'serialized number decode failed');
      assert(snap.decoded['setting:media.thumbQuality']==='original','serialized select decode failed');
      return {decoded:true};
    });

    await test('B03','actual M01-style migration preserves explicit nondefaults',async()=>{
      await clearAll();
      await seedSemantic({
        'setting:viewer.autoplayVideo':false,
        'setting:viewer.muteVideo':false,
        'setting:media.thumbQuality':'original',
        'setting:gallery.gridDensity':5,
        'setting:gallery.gridGap':12,
        'setting:general.toolbarPosition':'top-left',
        'setting:gallery.infiniteScroll':false
      },'json-string');
      const r=await migrate();
      assert(r.ok,'migration failed');
      assert(r.resolved.effective['viewer.autoplayVideo']===false,'autoplay reset');
      assert(r.resolved.effective['media.thumbQuality']==='original','quality reset');
      assert(r.resolved.effective['gallery.infiniteScroll']===false,'append reset');
      assert((await storage.getValue(SCHEMA_VERSION_KEY))===SETTINGS_SCHEMA_VERSION,'schema marker missing');
      return {explicitChoicesPreserved:true};
    });

    await test('B04','actual empty store remains ambiguous after schema marker',async()=>{
      await clearAll();
      const first=await migrate();
      assert(first.ok && first.resolved.provenance==='AMBIGUOUS_EMPTY','empty misclassified');
      assert(first.resolved.effective['media.thumbQuality']==='sample','legacy quality default changed');
      assert(first.resolved.effective['gallery.infiniteScroll']===true,'legacy append default changed');
      const second=await migrate();
      assert(second.resolved.provenance==='AMBIGUOUS_EMPTY','marker became freshness proof');
      const keys=(await storage.listValues()).filter(k=>k!==RESULT_KEY);
      assert(keys.length===1 && keys[0]===SCHEMA_VERSION_KEY,'migration persisted absent preferences');
      return {provenance:second.resolved.provenance,storedKeys:keys};
    });

    await test('B05','actual malformed known values are preserved while effective values fall back',async()=>{
      await clearAll();
      await storage.setValue('setting:viewer.muteVideo','not-a-bool');
      await storage.setValue('setting:gallery.thumbnailSize','huge');
      await storage.setValue('setting:viewer.fitMode','stretch');
      await storage.setValue('future:opaque',{x:1});
      const before=await rawSnapshot();
      const r=await migrate();
      assert(r.resolved.effective['viewer.muteVideo']===true,'boolean fallback wrong');
      assert(r.resolved.effective['gallery.thumbnailSize']===220,'numeric fallback wrong');
      assert(r.resolved.effective['viewer.fitMode']==='fit-both','select fallback wrong');
      assert(Object.keys(r.resolved.invalidKnown).length===3,'invalid values not isolated');
      assert('future:opaque' in r.resolved.unknown,'unknown key not retained');
      const after=await rawSnapshot();
      for(const key of ['setting:viewer.muteVideo','setting:gallery.thumbnailSize','setting:viewer.fitMode','future:opaque']) {
        assert(same(before[key],after[key]),'raw value overwritten:'+key);
      }
      return {invalidKnown:Object.keys(r.resolved.invalidKnown),unknownPreserved:true};
    });

    await test('B06','actual newer schema stays untouched and blocks dependent mount',async()=>{
      await clearAll();
      await storage.setValue(SCHEMA_VERSION_KEY,SETTINGS_SCHEMA_VERSION+1);
      await storage.setValue('setting:viewer.autoplayVideo',false);
      const before=await rawSnapshot();
      let mounts=0;
      const r=await initializeWithBarrier(storage,()=>mounts++);
      const after=await rawSnapshot();
      assert(!r.ok && !r.mounted && mounts===0,'newer schema mounted');
      assert(same(before,after),'newer schema store changed');
      return {blockedVersion:SETTINGS_SCHEMA_VERSION+1,mounts};
    });

    await test('B07','delayed migration blocks dependent mount until release',async()=>{
      await clearAll();
      await seedSemantic({'setting:viewer.autoplayVideo':false},'json-string');
      let release;
      const gate=new Promise((resolve)=>{release=resolve;});
      let mounts=0;
      let mountedSettings=null;
      const pending=initializeWithBarrier(storage,(settings)=>{mounts++;mountedSettings=settings;},{beforeCommit:()=>gate});
      await sleep(60);
      assert(mounts===0,'mounted while migration deliberately delayed');
      const releasedAt=now();
      release();
      const r=await pending;
      const resolvedAt=r.trace.find(x=>x.event==='migration-resolved')?.t;
      assert(r.mounted && mounts===1,'did not mount exactly once after release');
      assert(mountedSettings['viewer.autoplayVideo']===false,'mount saw temporary default');
      assert(r.mountAt>=resolvedAt && resolvedAt>=releasedAt,'timestamp ordering invalid');
      return {releasedAt,migrationResolvedAt:resolvedAt,firstMountAt:r.mountAt};
    });

    await test('B08','rejected migration causes zero dependent mount and preserves preference',async()=>{
      await clearAll();
      await seedSemantic({'setting:viewer.autoplayVideo':false},'json-string');
      const deny={
        ...storage,
        listValues:storage.listValues.bind(storage),
        getValue:storage.getValue.bind(storage),
        deleteValue:storage.deleteValue.bind(storage),
        async setValue(key,value) {
          if (key===SCHEMA_VERSION_KEY) throw new Error('controlled schema write denial');
          return storage.setValue(key,value);
        }
      };
      const before=await storage.getValue('setting:viewer.autoplayVideo');
      let mounts=0;
      const r=await initializeWithBarrier(deny,()=>mounts++);
      const after=await storage.getValue('setting:viewer.autoplayVideo');
      assert(!r.ok&&!r.mounted&&mounts===0,'mount occurred after rejection');
      assert(same(before,after),'preference changed after rejected migration');
      return {mounted:false,preferenceUnchanged:true};
    });

    await test('B09','first dependent mount timestamp follows resolved settings and sees explicit choice',async()=>{
      await clearAll();
      await seedSemantic({'setting:gallery.gridGap':12,'setting:media.thumbQuality':'original'},'json-string');
      let observed=null;
      const r=await initializeWithBarrier(storage,(settings,t)=>{observed={settings,t};});
      const resolvedAt=r.trace.find(x=>x.event==='migration-resolved')?.t;
      assert(observed && observed.t>=resolvedAt,'mount timestamp preceded resolution');
      assert(observed.settings['gallery.gridGap']===12,'mount missed explicit gap');
      assert(observed.settings['media.thumbQuality']==='original','mount missed explicit quality');
      return {migrationResolvedAt:resolvedAt,firstMountAt:observed.t};
    });

    await test('B10','isolated test storage cleans up completely',async()=>{
      await clearAll();
      const keys=await storage.listValues();
      assert(keys.length===0,'isolated storage not empty after cleanup: '+keys.join(','));
      return {remainingKeys:0};
    });

    const failed=tests.filter(t=>t.status!=='PASS');
    const result={
      probe:{name:'IB05 Settings Mount Gate',version:'1.0.0',productionVersion:PRODUCT_VERSION,settingsSchemaVersion:SETTINGS_SCHEMA_VERSION},
      environment:{
        userAgent:navigator.userAgent,
        platform:navigator.platform,
        gmInfo:typeof GM_info!=='undefined'?{
          scriptHandler:GM_info.scriptHandler,
          version:GM_info.version,
          grants:GM_info.script?.grant || null
        }:null
      },
      isolation:{
        separateUserscriptIdentity:true,
        productionNamespaceAccessed:false,
        network:false
      },
      summary:{tests:tests.length,passed:tests.length-failed.length,failed:failed.length,status:failed.length?'FAIL':'PASS'},
      tests,
      boundaries:{
        realManagerStorage:true,
        productionPreferences:false,
        liveSite:false,
        network:false,
        productionIntegration:false
      }
    };

    GM_setValue(RESULT_KEY,JSON.stringify(result));
    show(JSON.stringify(result,null,2));
  }

  GM_registerMenuCommand('IB05: Run settings/mount gate',()=>run());
  GM_registerMenuCommand('IB05: Show/export last result',()=>show(GM_getValue(RESULT_KEY,'')||JSON.stringify({error:'No completed run yet.'},null,2)));
})();
