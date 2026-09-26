'use strict';

const OUTCOME = Object.freeze({
  SUCCESS:'success',
  AUTH_REQUIRED:'auth-required',
  NOT_FOUND:'not-found',
  RATE_LIMITED:'rate-limited',
  TRANSIENT:'transient',
  STRUCTURAL:'structural',
  CANCELLED:'cancelled',
});

function classifyResponse({status=0, bodyKind='valid', authBody=false} = {}) {
  if (authBody) return OUTCOME.AUTH_REQUIRED;
  if (status === 401 || status === 403) return OUTCOME.AUTH_REQUIRED;
  if (status === 404) return OUTCOME.NOT_FOUND;
  if (status === 429) return OUTCOME.RATE_LIMITED;
  if (status >= 500 || status === 0) return OUTCOME.TRANSIENT;
  if (status >= 200 && status < 300) return bodyKind === 'valid' ? OUTCOME.SUCCESS : OUTCOME.STRUCTURAL;
  return OUTCOME.STRUCTURAL;
}

class DeferredTransport {
  constructor({abortable=true, ignoreAbort=false} = {}) {
    this.abortable=abortable;
    this.ignoreAbort=ignoreAbort;
    this.started=0;
    this.aborts=0;
    this.records=[];
  }
  start(meta) {
    this.started++;
    let resolve;
    let reject;
    let settled=false;
    const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
    const rec={
      meta,promise,
      settle(value){ if(settled) return false; settled=true; resolve(value); return true; },
      fail(error){ if(settled) return false; settled=true; reject(error); return true; },
      get settled(){return settled;},
    };
    const handle={
      promise,
      abort: this.abortable ? () => {
        this.aborts++;
        if (!this.ignoreAbort && !settled) {
          settled=true;
          reject(Object.assign(new Error('aborted'),{kind:'abort'}));
        }
        return true;
      } : null,
      record:rec,
    };
    this.records.push(handle);
    return handle;
  }
}

class Gate {
  constructor({transport,maxAttempts=2,now=()=>Date.now()}={}) {
    this.transport=transport;
    this.maxAttempts=maxAttempts;
    this.now=now;
    this.ops=new Map();
    this.activeByKey=new Map();
    this.cooldownUntil=new Map();
    this.queue=[];
    this.seq=0;
    this.events=[];
  }
  _event(type,data={}) { this.events.push({n:++this.seq,type,...data}); }
  _key(req) { return [req.site,req.account,req.operation,JSON.stringify(req.params||{})].join('|'); }
  _endpointKey(req) { return req.endpointKey; }

  acquire(req,{consumerId,lane='background',kind='read'}={}) {
    const identity=this._key(req);
    let op = kind==='read' ? this.ops.get(identity) : null;
    if (op && !op.terminal) {
      op.consumers.set(consumerId,{settled:false,result:null});
      this._event('consumer-join',{identity,consumerId,lane});
      if (lane==='foreground' && op.lane==='background' && op.state==='queued') {
        op.lane='foreground';
        this._event('promote',{identity});
        this._sortQueue();
      }
      return this._lease(op,consumerId);
    }
    op={
      identity,req,kind,lane,state:'queued',terminal:false,attemptsUsed:0,
      consumers:new Map([[consumerId,{settled:false,result:null}]]),
      handle:null,result:null,
    };
    if (kind==='read') this.ops.set(identity,op);
    this.queue.push(op);
    this._event('queued',{identity,lane,kind});
    this._sortQueue();
    this.pump();
    return this._lease(op,consumerId);
  }

  _lease(op,consumerId) {
    return {
      identity:op.identity,
      release:()=>this.release(op,consumerId),
      get result(){return op.consumers.get(consumerId)?.result ?? null;},
      get settled(){return !!op.consumers.get(consumerId)?.settled;},
    };
  }

  _sortQueue() {
    this.queue.sort((a,b)=>{
      const pa=a.lane==='foreground'?0:1;
      const pb=b.lane==='foreground'?0:1;
      return pa-pb || a.identity.localeCompare(b.identity);
    });
  }

  setCooldown(endpointKey,until) {
    this.cooldownUntil.set(endpointKey,until);
    this._event('cooldown-set',{endpointKey,until});
  }

  pump() {
    this._sortQueue();
    for (const op of [...this.queue]) {
      if (op.terminal || op.state!=='queued') continue;
      if (op.consumers.size===0) {
        op.terminal=true;
        op.state='cancelled';
        this.queue=this.queue.filter(x=>x!==op);
        if (op.kind==='read') this.ops.delete(op.identity);
        this._event('cancel-queued-no-consumers',{identity:op.identity});
        continue;
      }
      const ek=this._endpointKey(op.req);
      const cd=this.cooldownUntil.get(ek)||0;
      if (cd>this.now()) {
        this._event('cooldown-block',{identity:op.identity,endpointKey:ek});
        continue;
      }
      if (this.activeByKey.has(ek)) continue;
      this._start(op);
    }
  }

  _start(op) {
    const ek=this._endpointKey(op.req);
    op.state='running';
    this.activeByKey.set(ek,op);
    this.queue=this.queue.filter(x=>x!==op);
    op.attemptsUsed++;
    this._event('attempt-start',{identity:op.identity,attempt:op.attemptsUsed,endpointKey:ek,lane:op.lane});
    const handle=this.transport.start({identity:op.identity,attempt:op.attemptsUsed,endpointKey:ek});
    op.handle=handle;
    handle.promise.then(
      (res)=>this._transportTerminal(op,{kind:'response',res}),
      (err)=>this._transportTerminal(op,{kind:'error',err})
    );
  }

  _transportTerminal(op,term) {
    const ek=this._endpointKey(op.req);
    if (this.activeByKey.get(ek)===op) this.activeByKey.delete(ek);
    if (op.terminal) {
      this._event('late-transport-terminal',{identity:op.identity,kind:term.kind});
      this.pump();
      return;
    }
    let outcome;
    let retryable=false;
    if (term.kind==='error') {
      const k=term.err?.kind;
      if (k==='abort') outcome=OUTCOME.CANCELLED;
      else { outcome=OUTCOME.TRANSIENT; retryable=true; }
    } else {
      outcome=classifyResponse(term.res);
      retryable = outcome===OUTCOME.TRANSIENT;
      if (outcome===OUTCOME.RATE_LIMITED) {
        const retryAfter=Number(term.res.retryAfterMs||0);
        if (retryAfter>0) this.setCooldown(ek,this.now()+retryAfter);
      }
    }
    if (op.kind==='read' && retryable && op.consumers.size>0 && op.attemptsUsed < this.maxAttempts) {
      op.state='queued';
      op.handle=null;
      this.queue.push(op);
      this._event('retry-queued',{identity:op.identity,nextAttempt:op.attemptsUsed+1});
      this.pump();
      return;
    }
    this._finish(op,outcome);
    this.pump();
  }

  _finish(op,outcome) {
    if (op.terminal) return;
    op.terminal=true;
    op.state='terminal';
    op.result=outcome;
    for (const [id,c] of op.consumers) {
      if (!c.settled) {
        c.settled=true;
        c.result=outcome;
        this._event('consumer-settle',{identity:op.identity,consumerId:id,outcome});
      }
    }
    if (op.kind==='read') this.ops.delete(op.identity);
    this._event('operation-terminal',{identity:op.identity,outcome,attemptsUsed:op.attemptsUsed});
  }

  release(op,consumerId) {
    const c=op.consumers.get(consumerId);
    if (!c) return false;
    op.consumers.delete(consumerId);
    this._event('consumer-release',{identity:op.identity,consumerId,state:op.state,remaining:op.consumers.size});
    if (op.consumers.size>0) return true;
    if (op.state==='queued') {
      this.queue=this.queue.filter(x=>x!==op);
      op.terminal=true;
      op.state='cancelled';
      if (op.kind==='read') this.ops.delete(op.identity);
      this._event('cancel-queued-last-release',{identity:op.identity});
      return true;
    }
    if (op.state==='running') {
      op.terminal=true;
      op.state='cancelled-wait-wire';
      if (op.kind==='read') this.ops.delete(op.identity);
      const abortAvailable=typeof op.handle?.abort==='function';
      let abortIssued=false;
      if (abortAvailable) {
        try { abortIssued=op.handle.abort()!==false; } catch {}
      }
      this._event('cancel-running-last-release',{identity:op.identity,abortAvailable,abortIssued});
      return true;
    }
    return true;
  }
}

function assert(c,m){if(!c)throw new Error(m);}
async function flush(){await Promise.resolve();await Promise.resolve();}
function req(endpointKey='A',operation='meta',params={id:1}) {
  return {site:'fixture',account:'anon',operation,params,endpointKey};
}

async function run() {
  const tests=[];
  async function test(id,name,fn){
    try{const detail=await fn();tests.push({id,name,status:'PASS',detail});}
    catch(e){tests.push({id,name,status:'FAIL',error:String(e.stack||e)});}
  }

  await test('E01','equivalent reads dedupe to one transport and both consumers settle once',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    const a=g.acquire(req('A'),{consumerId:'A',lane:'background'});
    const b=g.acquire(req('A'),{consumerId:'B',lane:'background'});
    assert(t.started===1,'dedupe failed');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(a.settled&&b.settled,'consumers not settled');
    assert(a.result==='success'&&b.result==='success','wrong outcome');
    assert(g.events.filter(e=>e.type==='consumer-settle').length===2,'duplicate/missing settlements');
    return {transportStarts:t.started,settlements:2};
  });

  await test('E02','different parameters are different read identities',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    g.acquire(req('A','meta',{id:1}),{consumerId:'A'});
    g.acquire(req('A','meta',{id:2}),{consumerId:'B'});
    assert(t.started===1,'same endpoint key must serialize active work');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(t.started===2,'second identity did not start');
    return {starts:t.started};
  });

  await test('E03','mutations never join read dedupe',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    g.acquire(req('A'),{consumerId:'R',kind:'read'});
    g.acquire(req('A'),{consumerId:'M',kind:'mutation'});
    assert(g.queue.length===1,'mutation not separately queued');
    return {active:1,queued:1};
  });

  await test('E04','foreground queued work precedes queued background without preempting active work',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    g.acquire(req('A','active',{id:0}),{consumerId:'active',lane:'background'});
    g.acquire(req('A','bg',{id:1}),{consumerId:'bg',lane:'background'});
    g.acquire(req('A','fg',{id:2}),{consumerId:'fg',lane:'foreground'});
    assert(t.started===1,'active work was preempted');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(t.records[1].record.meta.identity.includes('|fg|'),'foreground did not win queue');
    return {secondStarted:'foreground'};
  });

  await test('E05','viewer joining queued hover read promotes it',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    g.acquire(req('A','block',{id:0}),{consumerId:'block',lane:'background'});
    g.acquire(req('A','hover',{id:1}),{consumerId:'hover',lane:'background'});
    g.acquire(req('A','other',{id:2}),{consumerId:'other',lane:'background'});
    g.acquire(req('A','hover',{id:1}),{consumerId:'viewer',lane:'foreground'});
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(t.records[1].record.meta.identity.includes('|hover|'),'promoted hover not next');
    return {promoted:true};
  });

  await test('E06','queued release A then B cancels before transport start',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    g.acquire(req('A','block',{id:0}),{consumerId:'block'});
    const a=g.acquire(req('A','shared',{id:1}),{consumerId:'A'});
    const b=g.acquire(req('A','shared',{id:1}),{consumerId:'B'});
    a.release(); b.release();
    assert(t.started===1,'queued shared read started despite no consumers');
    return {sharedStarts:0};
  });

  await test('E07','queued release B then A has same cancellation result',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    g.acquire(req('A','block',{id:0}),{consumerId:'block'});
    const a=g.acquire(req('A','shared',{id:1}),{consumerId:'A'});
    const b=g.acquire(req('A','shared',{id:1}),{consumerId:'B'});
    b.release(); a.release();
    assert(t.started===1,'release order changed queued cancellation');
    return {sharedStarts:0};
  });

  await test('E08','running release A while B remains does not abort',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    const a=g.acquire(req('A'),{consumerId:'A'});
    const b=g.acquire(req('A'),{consumerId:'B'});
    a.release();
    assert(t.aborts===0,'aborted while consumer remained');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(b.settled&&b.result==='success','remaining consumer lost result');
    return {aborts:t.aborts};
  });

  await test('E09','running release B then A aborts only on last release',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    const a=g.acquire(req('A'),{consumerId:'A'});
    const b=g.acquire(req('A'),{consumerId:'B'});
    b.release(); assert(t.aborts===0,'early abort');
    a.release(); assert(t.aborts===1,'last release did not abort');
    await flush();
    return {aborts:t.aborts};
  });

  await test('E10','ignored abort keeps endpoint occupancy until wire terminal',async()=>{
    const t=new DeferredTransport({abortable:true,ignoreAbort:true}); const g=new Gate({transport:t});
    const a=g.acquire(req('A','one',{id:1}),{consumerId:'A'});
    g.acquire(req('A','two',{id:2}),{consumerId:'B'});
    a.release();
    assert(t.aborts===1,'abort not attempted');
    assert(t.started===1,'queued work started as if ignored abort stopped wire');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(t.started===2,'endpoint did not free after actual terminal');
    return {startsBeforeWireTerminal:1,startsAfterWireTerminal:2};
  });

  await test('E11','non-abortable transport also keeps occupancy until terminal',async()=>{
    const t=new DeferredTransport({abortable:false}); const g=new Gate({transport:t});
    const a=g.acquire(req('A','one',{id:1}),{consumerId:'A'});
    g.acquire(req('A','two',{id:2}),{consumerId:'B'});
    a.release();
    assert(t.started===1,'non-abortable transport occupancy released early');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(t.started===2,'next work not admitted after wire terminal');
    return {abortAvailable:false};
  });

  await test('E12','transient read shares one finite attempt budget',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t,maxAttempts:2});
    const a=g.acquire(req('A'),{consumerId:'A'});
    t.records[0].record.settle({status:500,bodyKind:'valid'}); await flush();
    assert(t.started===2,'second finite attempt missing');
    t.records[1].record.settle({status:500,bodyKind:'valid'}); await flush();
    assert(t.started===2,'attempt budget multiplied');
    assert(a.settled&&a.result==='transient','wrong final transient outcome');
    return {attempts:t.started};
  });

  await test('E13','401/403/404/auth-body/structural outcomes do not automatically retry',async()=>{
    const cases=[
      [{status:401},'auth-required'],
      [{status:403},'auth-required'],
      [{status:404},'not-found'],
      [{status:200,authBody:true},'auth-required'],
      [{status:200,bodyKind:'malformed'},'structural'],
    ];
    const observed=[];
    for(let i=0;i<cases.length;i++){
      const [response,expected]=cases[i];
      const t=new DeferredTransport(); const g=new Gate({transport:t,maxAttempts:2});
      const a=g.acquire(req('A','c'+i,{id:i}),{consumerId:'A'});
      t.records[0].record.settle(response); await flush();
      assert(t.started===1,'nonretryable outcome retried '+expected);
      assert(a.result===expected,'wrong classification '+expected);
      observed.push(expected);
    }
    return {outcomes:observed};
  });

  await test('E14','429 establishes key-local cooldown and does not retry immediately',async()=>{
    let clock=1000; const t=new DeferredTransport(); const g=new Gate({transport:t,now:()=>clock});
    const a=g.acquire(req('A','rl',{id:1}),{consumerId:'A'});
    t.records[0].record.settle({status:429,retryAfterMs:500}); await flush();
    assert(a.result==='rate-limited','wrong 429 outcome');
    assert(t.started===1,'429 automatically retried');
    g.acquire(req('A','later',{id:2}),{consumerId:'B'});
    assert(t.started===1,'key A ignored cooldown');
    g.acquire(req('B','other',{id:3}),{consumerId:'C'});
    assert(t.started===2,'key B was blocked by key A cooldown');
    return {aBlocked:true,bUsable:true};
  });

  await test('E15','cooldown expiry admits queued key A work',async()=>{
    let clock=1000; const t=new DeferredTransport(); const g=new Gate({transport:t,now:()=>clock});
    g.setCooldown('A',1500);
    g.acquire(req('A'),{consumerId:'A'});
    assert(t.started===0,'work started during cooldown');
    clock=1600; g.pump();
    assert(t.started===1,'work did not start after cooldown expiry');
    return {startedAfterExpiry:true};
  });

  await test('E16','new consumer can join an existing queued read during cooldown',async()=>{
    let clock=1000; const t=new DeferredTransport(); const g=new Gate({transport:t,now:()=>clock});
    g.setCooldown('A',1500);
    const a=g.acquire(req('A'),{consumerId:'A',lane:'background'});
    const b=g.acquire(req('A'),{consumerId:'B',lane:'foreground'});
    assert(t.started===0,'started during cooldown');
    assert(g.queue.length===1,'dedupe failed in cooldown');
    clock=1600; g.pump();
    assert(t.started===1,'shared op not admitted');
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(a.result==='success'&&b.result==='success','joined consumers did not settle');
    return {sharedStarts:1};
  });

  await test('E17','late success after logical cancellation does not settle a released consumer',async()=>{
    const t=new DeferredTransport({abortable:true,ignoreAbort:true}); const g=new Gate({transport:t});
    const a=g.acquire(req('A'),{consumerId:'A'});
    a.release();
    t.records[0].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(a.settled===false,'released consumer received late result');
    assert(g.events.some(e=>e.type==='late-transport-terminal'),'late terminal not recorded');
    return {lateSuppressed:true};
  });

  await test('E18','timeout race yields one retry path and one final settlement',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t,maxAttempts:2});
    const a=g.acquire(req('A'),{consumerId:'A'});
    t.records[0].record.fail(Object.assign(new Error('timeout'),{kind:'timeout'})); await flush();
    assert(t.started===2,'timeout did not consume one retry');
    t.records[1].record.settle({status:200,bodyKind:'valid'}); await flush();
    assert(a.result==='success','retry success missing');
    assert(g.events.filter(e=>e.type==='consumer-settle').length===1,'consumer settled more than once');
    return {attempts:2,settlements:1};
  });

  await test('E19','error race after success is ignored by transport and cannot duplicate settlement',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    const a=g.acquire(req('A'),{consumerId:'A'});
    const rec=t.records[0].record;
    assert(rec.settle({status:200,bodyKind:'valid'})===true,'success not accepted');
    assert(rec.fail(Object.assign(new Error('late'),{kind:'error'}))===false,'transport accepted second terminal');
    await flush();
    assert(a.result==='success','success lost');
    assert(g.events.filter(e=>e.type==='consumer-settle').length===1,'duplicate settlement');
    return {settlements:1};
  });

  await test('E20','terminal job cannot be restarted by pump/sentinel activity',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    const a=g.acquire(req('A'),{consumerId:'A'});
    t.records[0].record.settle({status:404}); await flush();
    assert(a.result==='not-found','wrong terminal');
    for(let i=0;i<5;i++) g.pump();
    assert(t.started===1,'terminal job restarted');
    return {starts:t.started};
  });

  await test('E21','read identity includes site account operation and parameters',async()=>{
    const t=new DeferredTransport(); const g=new Gate({transport:t});
    const base={site:'s1',account:'a1',operation:'meta',params:{id:1},endpointKey:'A'};
    const variants=[
      {...base,site:'s2'}, {...base,account:'a2'}, {...base,operation:'html'}, {...base,params:{id:2}}
    ];
    const ids=new Set([g._key(base),...variants.map(v=>g._key(v))]);
    assert(ids.size===5,'identity dimensions collapsed');
    return {uniqueIdentities:ids.size};
  });

  const failed=tests.filter(t=>t.status!=='PASS');
  return {
    checkpoint:'IB06',
    stage:'E_MODEL',
    gate:'G-REQUEST',
    productionSourceChanged:false,
    model:{
      lanes:['foreground','background'],
      endpointKeys:['A','B'],
      maxReadAttempts:2,
      maxConsumersPerCase:2,
      numericPolicy:'test parameters only; not production host budgets'
    },
    outcomeTypes:Object.values(OUTCOME),
    summary:{tests:tests.length,passed:tests.length-failed.length,failed:failed.length,status:failed.length?'FAIL':'PASS'},
    tests,
    boundaries:{
      syntheticModel:true,
      realManagerTransport:false,
      liveSite:false,
      productionIntegration:false,
      universalScheduler:false
    }
  };
}

module.exports={run,Gate,DeferredTransport,classifyResponse,OUTCOME};
