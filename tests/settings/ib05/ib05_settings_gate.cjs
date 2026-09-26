'use strict';

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

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

function validateValue(def, value) {
  if (!def) return { ok:false, reason:'unknown-setting' };
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
  if (typeof raw !== 'string') return { ok:true, value:clone(raw), encoding:'typed' };
  try { return { ok:true, value:JSON.parse(raw), encoding:'json-string' }; }
  catch {
    if (def && (def.type === 'text' || def.type === 'select' || def.type === 'color')) {
      return { ok:true, value:raw, encoding:'typed-string' };
    }
    return { ok:false, value:raw, encoding:'malformed-string' };
  }
}

class FakeStorage {
  constructor(initial = {}, options = {}) {
    this.encoding = options.encoding || 'typed';
    this.delayTicks = options.delayTicks || 0;
    this.failSetCalls = new Set(options.failSetCalls || []);
    this.failDeleteCalls = new Set(options.failDeleteCalls || []);
    this.failList = !!options.failList;
    this.failGetKeys = new Set(options.failGetKeys || []);
    this.raw = new Map();
    this.setCalls = 0;
    this.deleteCalls = 0;
    this.clock = 0;
    for (const [k,v] of Object.entries(initial)) this.raw.set(k, this._encode(v));
  }
  _encode(v) { return this.encoding === 'json-string' ? JSON.stringify(v) : clone(v); }
  _tick(label) { this.clock += 1 + this.delayTicks; return { label, t:this.clock }; }
  async listValues() { this._tick('list'); if (this.failList) throw new Error('list denied'); return [...this.raw.keys()]; }
  async getValue(k) { this._tick('get:'+k); if (this.failGetKeys.has(k)) throw new Error('get denied:'+k); return clone(this.raw.get(k)); }
  async setValue(k,v) {
    this._tick('set:'+k); this.setCalls++;
    if (this.failSetCalls.has(this.setCalls)) throw new Error('set denied:'+k);
    this.raw.set(k,this._encode(v));
  }
  async deleteValue(k) {
    this._tick('delete:'+k); this.deleteCalls++;
    if (this.failDeleteCalls.has(this.deleteCalls)) throw new Error('delete denied:'+k);
    this.raw.delete(k);
  }
  snapshotRaw() { return Object.fromEntries([...this.raw].map(([k,v])=>[k,clone(v)])); }
  restoreRaw(snapshot) { this.raw = new Map(Object.entries(clone(snapshot))); this._tick('rollback'); }
}

async function readSnapshot(storage) {
  const keys = await storage.listValues();
  const raw = {};
  const decoded = {};
  const decodeErrors = {};
  for (const key of keys) {
    const value = await storage.getValue(key);
    raw[key] = clone(value);
    const def = key.startsWith(SETTING_PREFIX) ? SCHEMA[key.slice(SETTING_PREFIX.length)] : null;
    const dec = decodeRaw(value, def);
    if (dec.ok) decoded[key] = dec.value;
    else decodeErrors[key] = { raw:clone(value), reason:'malformed-storage-value' };
  }
  return { raw, decoded, decodeErrors };
}

function resolveSnapshot(snapshot) {
  const marker = snapshot.decoded[SCHEMA_VERSION_KEY];
  if (typeof marker === 'number' && marker > SETTINGS_SCHEMA_VERSION) {
    return {
      status:'UNSUPPORTED_NEWER_SCHEMA', canMount:false, schemaVersion:marker,
      effective:null, storedKnown:{}, absentKnown:[], invalidKnown:{},
      unknown:{}, migrationWrites:[], provenance:'UNKNOWN', recovery:{raw:clone(snapshot.raw),decodeErrors:clone(snapshot.decodeErrors)}
    };
  }
  const effective = {};
  const storedKnown = {};
  const invalidKnown = {};
  const absentKnown = [];
  for (const [key,def] of Object.entries(SCHEMA)) {
    const storeKey = SETTING_PREFIX + key;
    if (!(storeKey in snapshot.raw)) {
      absentKnown.push(key);
      effective[key] = clone(def.def);
      continue;
    }
    if (snapshot.decodeErrors[storeKey]) {
      effective[key] = clone(def.def);
      invalidKnown[key] = { raw:clone(snapshot.raw[storeKey]), reason:'malformed-storage-value' };
      continue;
    }
    const value = snapshot.decoded[storeKey];
    const checked = validateValue(def,value);
    if (checked.ok) {
      effective[key] = clone(checked.value);
      storedKnown[key] = clone(checked.value);
    } else {
      effective[key] = clone(def.def);
      invalidKnown[key] = { raw:clone(snapshot.raw[storeKey]), decoded:clone(value), reason:checked.reason };
    }
  }
  const unknown = {};
  for (const key of Object.keys(snapshot.raw)) {
    if (key === SCHEMA_VERSION_KEY) continue;
    if (key.startsWith(SETTING_PREFIX) && SCHEMA[key.slice(SETTING_PREFIX.length)]) continue;
    unknown[key] = clone(snapshot.raw[key]);
  }
  const nonMarkerKeys = Object.keys(snapshot.raw).filter((k)=>k !== SCHEMA_VERSION_KEY);
  const provenance = nonMarkerKeys.length === 0 ? 'AMBIGUOUS_EMPTY' : 'LEGACY_OR_EXISTING';
  return {
    status:'READY', canMount:true,
    schemaVersion: typeof marker === 'number' ? marker : 0,
    effective, storedKnown, absentKnown, invalidKnown, unknown,
    migrationWrites: marker === SETTINGS_SCHEMA_VERSION ? [] : [{key:SCHEMA_VERSION_KEY,value:SETTINGS_SCHEMA_VERSION}],
    provenance,
    recovery:{raw:clone(snapshot.raw),decodeErrors:clone(snapshot.decodeErrors),invalidKnown:clone(invalidKnown)}
  };
}

async function migrate(storage, trace = []) {
  trace.push({event:'migration-start',t:++storage.clock});
  let snapshot;
  try { snapshot = await readSnapshot(storage); }
  catch (error) { trace.push({event:'migration-read-failed',t:++storage.clock,error:String(error.message||error)}); return {ok:false,canMount:false,error:'READ_FAILED',trace}; }
  const resolved = resolveSnapshot(snapshot);
  if (!resolved.canMount) {
    trace.push({event:'migration-blocked-newer-schema',t:++storage.clock,schemaVersion:resolved.schemaVersion});
    return {ok:false,canMount:false,error:'NEWER_SCHEMA',resolved,trace};
  }
  try {
    for (const write of resolved.migrationWrites) await storage.setValue(write.key,write.value);
  } catch (error) {
    trace.push({event:'migration-write-failed',t:++storage.clock,error:String(error.message||error)});
    return {ok:false,canMount:false,error:'WRITE_FAILED',resolved,trace};
  }
  trace.push({event:'migration-resolved',t:++storage.clock});
  return {ok:true,canMount:true,resolved,trace};
}

async function initializeWithBarrier(storage, mount) {
  const trace = [];
  const result = await migrate(storage,trace);
  if (!result.ok || !result.canMount) return { ...result, mounted:false };
  const mountAt = ++storage.clock;
  mount(clone(result.resolved.effective),mountAt);
  trace.push({event:'first-dependent-mount',t:mountAt});
  return { ...result, mounted:true, mountAt, trace };
}

function exportEnvelope(resolved) {
  return {
    __booruEnhancerSettings:true,
    productVersion:PRODUCT_VERSION,
    schemaVersion:SETTINGS_SCHEMA_VERSION,
    storedKnown:clone(resolved.storedKnown),
    absentKnown:[...resolved.absentKnown],
    unknown:clone(resolved.unknown),
    recovery:{invalidKnown:clone(resolved.invalidKnown),raw:clone(resolved.recovery.raw)}
  };
}

function validateImportEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || envelope.__booruEnhancerSettings !== true) return {ok:false,reason:'invalid-envelope'};
  if (!Number.isInteger(envelope.schemaVersion) || envelope.schemaVersion < 0) return {ok:false,reason:'invalid-schema-version'};
  if (envelope.schemaVersion > SETTINGS_SCHEMA_VERSION) return {ok:false,reason:'newer-schema'};
  if (!envelope.storedKnown || typeof envelope.storedKnown !== 'object' || Array.isArray(envelope.storedKnown)) return {ok:false,reason:'invalid-known-map'};
  if (!Array.isArray(envelope.absentKnown)) return {ok:false,reason:'invalid-absent-list'};
  if (!envelope.unknown || typeof envelope.unknown !== 'object' || Array.isArray(envelope.unknown)) return {ok:false,reason:'invalid-unknown-map'};
  const known = {};
  for (const [key,value] of Object.entries(envelope.storedKnown)) {
    const def = SCHEMA[key];
    const checked = validateValue(def,value);
    if (!checked.ok) return {ok:false,reason:'invalid-known-value:'+key};
    known[key] = clone(checked.value);
  }
  for (const key of envelope.absentKnown) {
    if (!SCHEMA[key]) return {ok:false,reason:'unknown-absent-key:'+key};
    if (key in known) return {ok:false,reason:'known-and-absent-conflict:'+key};
  }
  for (const key of Object.keys(envelope.unknown)) {
    if (key === SCHEMA_VERSION_KEY || (key.startsWith(SETTING_PREFIX) && SCHEMA[key.slice(SETTING_PREFIX.length)])) {
      return {ok:false,reason:'unknown-collides-reserved:'+key};
    }
  }
  return {ok:true,known,absent:[...envelope.absentKnown],unknown:clone(envelope.unknown)};
}

async function importEnvelope(storage,envelope) {
  const valid = validateImportEnvelope(envelope);
  if (!valid.ok) return {ok:false,reason:valid.reason,writes:0,rolledBack:false};
  const before = storage.snapshotRaw();
  let writes=0;
  try {
    for (const key of Object.keys(SCHEMA)) {
      const storeKey=SETTING_PREFIX+key;
      if (key in valid.known) { await storage.setValue(storeKey,valid.known[key]); writes++; }
      else if (valid.absent.includes(key) && storage.raw.has(storeKey)) { await storage.deleteValue(storeKey); writes++; }
    }
    for (const [key,rawValue] of Object.entries(valid.unknown)) {
      storage._tick('import-unknown:'+key);
      storage.raw.set(key,clone(rawValue));
      writes++;
    }
    await storage.setValue(SCHEMA_VERSION_KEY,SETTINGS_SCHEMA_VERSION); writes++;
    return {ok:true,writes,rolledBack:false};
  } catch (error) {
    storage.restoreRaw(before);
    return {ok:false,reason:'write-failed',writes,rolledBack:true};
  }
}

function assert(condition,message) { if(!condition) throw new Error(message); }
function same(a,b) { return JSON.stringify(a)===JSON.stringify(b); }

async function run() {
  const tests=[];
  const test=async(id,name,fn)=>{try{const detail=await fn();tests.push({id,name,status:'PASS',detail});}catch(e){tests.push({id,name,status:'FAIL',error:String(e.stack||e)});}};

  const m01={
    'setting:viewer.autoplayVideo':false,
    'setting:viewer.muteVideo':false,
    'setting:media.thumbQuality':'original',
    'setting:gallery.gridDensity':5,
    'setting:gallery.gridGap':12,
    'setting:general.toolbarPosition':'top-left',
    'setting:gallery.infiniteScroll':false
  };
  const m02={'setting:gallery.gridGap':12};
  const m03={'setting:viewer.muteVideo':false,'setting:gallery.gridDensity':4,'setting:download.filenameTemplate':'{id}'};
  const m04={
    'setting:media.thumbQuality':'ultra',
    'setting:viewer.autoplayVideo':'yes',
    'setting:gallery.gridGap':'wide',
    'setting:future.option':{enabled:true}
  };

  await test('E01','M01 explicit legacy nondefaults survive',async()=>{
    const st=new FakeStorage(m01); const r=await migrate(st);
    assert(r.ok,'migration failed');
    const e=r.resolved.effective;
    assert(e['viewer.autoplayVideo']===false,'autoplay reset');
    assert(e['viewer.muteVideo']===false,'mute reset');
    assert(e['media.thumbQuality']==='original','quality reset');
    assert(e['gallery.gridDensity']===5,'columns reset');
    assert(e['gallery.gridGap']===12,'gap reset');
    assert(e['general.toolbarPosition']==='top-left','toolbar reset');
    assert(e['gallery.infiniteScroll']===false,'append reset');
    return {preserved:7};
  });

  await test('E02','M02 missing keys use legacy defaults without persistence',async()=>{
    const st=new FakeStorage(m02); const r=await migrate(st);
    const e=r.resolved.effective;
    assert(e['gallery.gridGap']===12,'explicit gap lost');
    assert(e['media.thumbQuality']==='sample','quality default changed');
    assert(e['viewer.autoplayVideo']===true,'autoplay default changed');
    assert(e['viewer.muteVideo']===true,'mute default changed');
    assert(e['gallery.infiniteScroll']===true,'append default changed');
    assert(!st.raw.has('setting:media.thumbQuality'),'missing quality was persisted');
    return {legacyDefaultsPreserved:true};
  });

  await test('E03','M03 known import choices validate and survive',async()=>{
    const st=new FakeStorage({}); const base=resolveSnapshot(await readSnapshot(new FakeStorage(m03)));
    const env=exportEnvelope(base);
    env.unknown['setting:future.imported']='keep-me';
    const ir=await importEnvelope(st,env);
    assert(ir.ok,'import failed');
    const rr=resolveSnapshot(await readSnapshot(st));
    assert(rr.effective['viewer.muteVideo']===false,'mute import lost');
    assert(rr.effective['gallery.gridDensity']===4,'columns import lost');
    assert(rr.effective['download.filenameTemplate']==='{id}','template import lost');
    assert('setting:future.imported' in rr.unknown,'unknown import lost');
    return {unknownRoundTrip:true};
  });

  await test('E04','M04 invalid known values quarantine; unknown raw key remains inert',async()=>{
    const st=new FakeStorage(m04); const r=await migrate(st);
    const e=r.resolved.effective;
    assert(e['media.thumbQuality']==='sample','invalid select not defaulted');
    assert(e['viewer.autoplayVideo']===true,'invalid boolean not defaulted');
    assert(e['gallery.gridGap']===8,'invalid numeric not defaulted');
    assert(Object.keys(r.resolved.invalidKnown).length===3,'invalid values not quarantined');
    assert('setting:future.option' in r.resolved.unknown,'unknown raw key lost');
    assert(st.raw.has('setting:future.option'),'unknown raw key deleted');
    return {invalidKnown:Object.keys(r.resolved.invalidKnown),unknownPreserved:true};
  });

  await test('E05','M05 empty storage remains ambiguous and uses legacy defaults',async()=>{
    const st=new FakeStorage({}); const r=await migrate(st);
    assert(r.resolved.provenance==='AMBIGUOUS_EMPTY','empty classified as fresh/existing');
    assert(r.resolved.effective['media.thumbQuality']==='sample','empty quality changed');
    assert(r.resolved.effective['gallery.infiniteScroll']===true,'empty append changed');
    return {provenance:r.resolved.provenance};
  });

  await test('E06','M06 indistinguishable empty legacy state resolves identically to M05',async()=>{
    const a=await migrate(new FakeStorage({})); const b=await migrate(new FakeStorage({}));
    assert(same(a.resolved.effective,b.resolved.effective),'empty states diverged');
    assert(a.resolved.provenance===b.resolved.provenance,'empty provenance diverged');
    return {byteEquivalentInput:true};
  });

  await test('E07','migration is idempotent',async()=>{
    const st=new FakeStorage(m01);
    const a=await migrate(st); const afterA=st.snapshotRaw(); const b=await migrate(st); const afterB=st.snapshotRaw();
    assert(a.ok&&b.ok,'migration run failed');
    assert(same(afterA,afterB),'second migration changed store');
    assert(b.resolved.migrationWrites.length===0,'second migration planned writes');
    return {secondWrites:0};
  });

  await test('E08','typed storage form preserves explicit choices',async()=>{
    const st=new FakeStorage(m01,{encoding:'typed'}); const r=await migrate(st);
    assert(r.resolved.effective['media.thumbQuality']==='original','typed storage failed');
    return {encoding:'typed'};
  });

  await test('E09','JSON-string storage form preserves explicit choices',async()=>{
    const st=new FakeStorage(m01,{encoding:'json-string'}); const r=await migrate(st);
    assert(r.resolved.effective['media.thumbQuality']==='original','json-string storage failed');
    assert(r.resolved.effective['gallery.gridDensity']===5,'json number failed');
    return {encoding:'json-string'};
  });

  await test('E10','mount occurs only after delayed migration resolution',async()=>{
    const st=new FakeStorage(m01,{delayTicks:3}); let mounted=null;
    const r=await initializeWithBarrier(st,(settings,t)=>{mounted={settings,t};});
    const resolvedEvent=r.trace.find(x=>x.event==='migration-resolved');
    assert(r.mounted,'did not mount');
    assert(resolvedEvent && mounted.t>resolvedEvent.t,'mount preceded migration resolution');
    assert(mounted.settings['viewer.autoplayVideo']===false,'mount saw temporary default');
    return {migrationResolvedAt:resolvedEvent.t,firstMountAt:mounted.t};
  });

  await test('E11','denied schema write blocks mount and leaves preferences unchanged',async()=>{
    const st=new FakeStorage(m01,{failSetCalls:[1]}); const before=st.snapshotRaw(); let mounts=0;
    const r=await initializeWithBarrier(st,()=>mounts++);
    assert(!r.ok&&!r.mounted&&mounts===0,'mount occurred after failed migration');
    const after=st.snapshotRaw();
    for(const key of Object.keys(m01)) assert(same(before[key],after[key]),'preference changed:'+key);
    return {mounted:false,preferencesUnchanged:true};
  });

  await test('E12','write failure cannot partially overwrite production preferences',async()=>{
    const st=new FakeStorage(m01,{failSetCalls:[1]}); const before=st.snapshotRaw();
    const r=await migrate(st);
    assert(!r.ok,'expected failure');
    for(const key of Object.keys(m01)) assert(same(before[key],st.snapshotRaw()[key]),'preference overwritten:'+key);
    return {onlySchemaMarkerWasAttempted:true};
  });

  await test('E13','unknown raw keys survive migration and export',async()=>{
    const st=new FakeStorage({'setting:future.foo':{x:1},'legacy:opaque':'abc'}); const r=await migrate(st);
    const env=exportEnvelope(r.resolved);
    assert('setting:future.foo' in r.resolved.unknown,'future key lost');
    assert('legacy:opaque' in env.unknown,'opaque key absent export');
    return {unknownKeys:Object.keys(env.unknown).sort()};
  });

  await test('E14','invalid boolean is isolated and resolves legacy-safe default',async()=>{
    const st=new FakeStorage({'setting:viewer.muteVideo':'not-a-bool'}); const r=await migrate(st);
    assert(r.resolved.effective['viewer.muteVideo']===true,'boolean fallback wrong');
    assert(r.resolved.invalidKnown['viewer.muteVideo'],'boolean not quarantined');
    return r.resolved.invalidKnown['viewer.muteVideo'];
  });

  await test('E15','invalid numeric is isolated and resolves legacy-safe default',async()=>{
    const st=new FakeStorage({'setting:gallery.thumbnailSize':'huge'}); const r=await migrate(st);
    assert(r.resolved.effective['gallery.thumbnailSize']===220,'numeric fallback wrong');
    assert(r.resolved.invalidKnown['gallery.thumbnailSize'],'numeric not quarantined');
    return r.resolved.invalidKnown['gallery.thumbnailSize'];
  });

  await test('E16','invalid select is isolated and resolves legacy-safe default',async()=>{
    const st=new FakeStorage({'setting:viewer.fitMode':'stretch'}); const r=await migrate(st);
    assert(r.resolved.effective['viewer.fitMode']==='fit-both','select fallback wrong');
    assert(r.resolved.invalidKnown['viewer.fitMode'],'select not quarantined');
    return r.resolved.invalidKnown['viewer.fitMode'];
  });

  await test('E17','malformed import is rejected before any write',async()=>{
    const st=new FakeStorage(m01); const before=st.snapshotRaw();
    const ir=await importEnvelope(st,{__booruEnhancerSettings:true,schemaVersion:1,storedKnown:{'gallery.gridGap':'wide'},absentKnown:[],unknown:{}});
    assert(!ir.ok,'malformed import accepted');
    assert(same(before,st.snapshotRaw()),'malformed import wrote store');
    return {reason:ir.reason,writes:ir.writes};
  });

  await test('E18','unsupported newer schema remains untouched and blocks mount',async()=>{
    const st=new FakeStorage({...m01,[SCHEMA_VERSION_KEY]:SETTINGS_SCHEMA_VERSION+1}); const before=st.snapshotRaw(); let mounts=0;
    const r=await initializeWithBarrier(st,()=>mounts++);
    assert(!r.ok&&!r.mounted&&mounts===0,'newer schema mounted');
    assert(same(before,st.snapshotRaw()),'newer schema store changed');
    return {blockedVersion:SETTINGS_SCHEMA_VERSION+1};
  });

  await test('E19','unknown imported values round-trip inertly',async()=>{
    const base=await migrate(new FakeStorage({'future:blob':{a:[1,2,3]}}));
    const env=exportEnvelope(base.resolved);
    const st=new FakeStorage({});
    const ir=await importEnvelope(st,env);
    assert(ir.ok,'roundtrip import failed');
    const rr=await migrate(st);
    assert(same(rr.resolved.unknown['future:blob'],env.unknown['future:blob']),'unknown value changed');
    return {roundTrip:true};
  });

  await test('E20','partial import write rolls back to exact prior snapshot',async()=>{
    const st=new FakeStorage(m01,{failSetCalls:[2]}); const before=st.snapshotRaw();
    const env={__booruEnhancerSettings:true,schemaVersion:1,storedKnown:{'viewer.autoplayVideo':true,'gallery.gridGap':4},absentKnown:Object.keys(SCHEMA).filter(k=>!['viewer.autoplayVideo','gallery.gridGap'].includes(k)),unknown:{}};
    const ir=await importEnvelope(st,env);
    assert(!ir.ok&&ir.rolledBack,'partial import did not roll back');
    assert(same(before,st.snapshotRaw()),'rollback did not restore exact snapshot');
    return {rolledBack:true};
  });

  await test('E21','schema version is distinct from product version',async()=>{
    assert(typeof SETTINGS_SCHEMA_VERSION==='number','schema version not numeric');
    assert(String(SETTINGS_SCHEMA_VERSION)!==PRODUCT_VERSION,'schema/product version conflated');
    return {productVersion:PRODUCT_VERSION,schemaVersion:SETTINGS_SCHEMA_VERSION};
  });

  await test('E22','upgrade-written marker does not convert empty provenance into fresh-install proof',async()=>{
    const st=new FakeStorage({}); await migrate(st); const second=await migrate(st);
    assert(second.resolved.provenance==='AMBIGUOUS_EMPTY','marker became freshness proof');
    assert(second.resolved.effective['gallery.infiniteScroll']===true,'marker changed append default');
    return {provenance:second.resolved.provenance};
  });

  await test('E23','recovery export preserves invalid raw data and absent-key state',async()=>{
    const st=new FakeStorage({'setting:viewer.muteVideo':'invalid','legacy:opaque':{z:9}});
    const r=await migrate(st); const env=exportEnvelope(r.resolved);
    assert(env.recovery.invalidKnown['viewer.muteVideo'],'invalid recovery missing');
    assert(env.absentKnown.includes('media.thumbQuality'),'absence state missing');
    assert('legacy:opaque' in env.unknown,'unknown missing');
    return {invalidRecovered:true,absentCount:env.absentKnown.length};
  });

  const failed=tests.filter(t=>t.status!=='PASS');
  const m01Resolved=(await migrate(new FakeStorage(m01))).resolved;
  const keyTable=Object.entries(SCHEMA).map(([key,def])=>({
    key,legacyDefault:clone(def.def),
    m01Stored:Object.prototype.hasOwnProperty.call(m01,SETTING_PREFIX+key) ? clone(m01[SETTING_PREFIX+key]) : null,
    m01Effective:clone(m01Resolved.effective[key])
  }));
  return {
    checkpoint:'IB05',
    stage:'E_MODEL',
    gateStatus:'OPEN_V5_O_BROWSER_PENDING',
    productionSourceChanged:false,
    model:{productVersion:PRODUCT_VERSION,schemaVersion:SETTINGS_SCHEMA_VERSION,settingsCount:Object.keys(SCHEMA).length},
    summary:{tests:tests.length,passed:tests.length-failed.length,failed:failed.length,status:failed.length?'FAIL':'PASS'},
    tests,
    keyTable,
    policy:{
      emptyStore:'AMBIGUOUS_EMPTY; never fresh-install proof',
      legacyDefaults:{thumbQuality:'sample',infiniteScroll:true},
      unknown:'preserve inertly and round-trip',
      malformed:'preserve for recovery; effective legacy-safe default',
      newerSchema:'leave untouched; block dependent mount',
      mountBarrier:'dependent mount only after successful migration resolution',
      migrationWrites:'schema marker only; no preference rewrite in schema 0 -> 1',
      import:'validate fully before writes; rollback exact prior snapshot on write failure'
    }
  };
}

module.exports={run,SCHEMA,SETTINGS_SCHEMA_VERSION,PRODUCT_VERSION,FakeStorage,readSnapshot,resolveSnapshot,migrate,initializeWithBarrier,exportEnvelope,validateImportEnvelope,importEnvelope};
