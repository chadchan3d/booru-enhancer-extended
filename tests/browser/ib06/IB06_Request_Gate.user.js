// ==UserScript==
// @name         Booru Enhancer Extended — IB06 Request Gate
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended/ib06-test
// @version      1.0.0
// @description  Local-only controlled transport evidence for IB06 G-REQUEST.
// @author       ChadChan3D
// @license      MIT
// @match        http://127.0.0.1:8778/*
// @connect      127.0.0.1
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_info
// @run-at       document-end
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  const A='http://127.0.0.1:8778';
  const B='http://127.0.0.1:8779';
  const RESULT_KEY='ib06:last-result:v1';
  const OUTCOME={
    SUCCESS:'success',AUTH:'auth-required',NOT_FOUND:'not-found',
    RATE:'rate-limited',TRANSIENT:'transient',STRUCTURAL:'structural',CANCELLED:'cancelled'
  };
  const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
  const assert=(c,m)=>{if(!c)throw new Error(m);};

  function parseHeader(headers,name){
    const lower=name.toLowerCase();
    for(const line of String(headers||'').split(/\r?\n/)){
      const i=line.indexOf(':');
      if(i<0)continue;
      if(line.slice(0,i).trim().toLowerCase()===lower)return line.slice(i+1).trim();
    }
    return null;
  }

  function transportStart(meta){
    let settled=false;
    let resolve,reject;
    let handle=null;
    const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
    const settleOk=(res)=>{if(settled)return false;settled=true;resolve(res);return true;};
    const settleErr=(kind,detail)=>{if(settled)return false;settled=true;reject({kind,detail});return true;};
    handle=GM_xmlhttpRequest({
      method:'GET',
      url:meta.url,
      timeout:meta.timeout||2500,
      onload:(res)=>settleOk({
        status:res.status,
        text:res.responseText||'',
        headers:res.responseHeaders||'',
        finalUrl:res.finalUrl||meta.url,
        expectedJson:meta.expectedJson!==false,
      }),
      onerror:(e)=>settleErr('error',e),
      ontimeout:(e)=>settleErr('timeout',e),
      onabort:(e)=>settleErr('abort',e),
    });
    return {
      promise,
      abort(){
        if(!handle||typeof handle.abort!=='function')return false;
        try{handle.abort();return true;}catch{return false;}
      }
    };
  }

  function classify(res){
    if(res.status===401||res.status===403)return OUTCOME.AUTH;
    if(res.status===404)return OUTCOME.NOT_FOUND;
    if(res.status===429)return OUTCOME.RATE;
    if(res.status>=500||res.status===0)return OUTCOME.TRANSIENT;
    if(res.status>=200&&res.status<300){
      if(/LOGIN_REQUIRED/.test(res.text))return OUTCOME.AUTH;
      if(res.expectedJson){
        try{JSON.parse(res.text);}catch{return OUTCOME.STRUCTURAL;}
      }
      return OUTCOME.SUCCESS;
    }
    return OUTCOME.STRUCTURAL;
  }

  class Gate{
    constructor(){
      this.ops=new Map();
      this.queue=[];
      this.active=new Map();
      this.cooldown=new Map();
      this.events=[];
      this.seq=0;
    }
    event(type,data={}){this.events.push({n:++this.seq,type,...data});}
    identity(req){return [req.site,req.account,req.operation,JSON.stringify(req.params||{})].join('|');}
    acquire(req,{consumerId,lane='background'}){
      const id=this.identity(req);
      let op=this.ops.get(id);
      if(op&&!op.terminal){
        const c=this.consumer(consumerId);
        op.consumers.set(consumerId,c);
        this.event('join',{id,consumerId,lane});
        if(lane==='foreground'&&op.lane==='background'&&op.state==='queued'){
          op.lane='foreground';this.event('promote',{id});this.sort();
        }
        return this.lease(op,consumerId,c);
      }
      const c=this.consumer(consumerId);
      op={id,req,lane,state:'queued',terminal:false,attempts:0,consumers:new Map([[consumerId,c]]),handle:null};
      this.ops.set(id,op);this.queue.push(op);this.event('queued',{id,lane});this.sort();this.pump();
      return this.lease(op,consumerId,c);
    }
    consumer(id){
      let resolve;
      const promise=new Promise(r=>resolve=r);
      return {id,promise,resolve,settled:false,result:null};
    }
    lease(op,id,c){
      return {promise:c.promise,release:()=>this.release(op,id),get state(){return op.state;}};
    }
    sort(){
      this.queue.sort((x,y)=>(x.lane==='foreground'?0:1)-(y.lane==='foreground'?0:1)||x.id.localeCompare(y.id));
    }
    pump(){
      this.sort();
      for(const op of [...this.queue]){
        if(op.terminal||op.state!=='queued')continue;
        if(op.consumers.size===0){this.cancelQueued(op);continue;}
        const until=this.cooldown.get(op.req.endpointKey)||0;
        if(until>Date.now())continue;
        if(this.active.has(op.req.endpointKey))continue;
        this.start(op);
      }
    }
    start(op){
      op.state='running';op.attempts++;
      this.active.set(op.req.endpointKey,op);
      this.queue=this.queue.filter(x=>x!==op);
      this.event('attempt-start',{id:op.id,attempt:op.attempts,key:op.req.endpointKey});
      op.handle=transportStart(op.req);
      op.handle.promise.then(
        res=>this.transportTerminal(op,{res}),
        err=>this.transportTerminal(op,{err})
      );
    }
    transportTerminal(op,term){
      if(this.active.get(op.req.endpointKey)===op)this.active.delete(op.req.endpointKey);
      if(op.terminal){this.event('late-terminal',{id:op.id});this.pump();return;}
      let outcome;
      let retry=false;
      if(term.err){
        outcome=term.err.kind==='abort'?OUTCOME.CANCELLED:OUTCOME.TRANSIENT;
        retry=outcome===OUTCOME.TRANSIENT;
      }else{
        outcome=classify(term.res);
        retry=outcome===OUTCOME.TRANSIENT;
        if(outcome===OUTCOME.RATE){
          const seconds=Number(parseHeader(term.res.headers,'retry-after')||0);
          if(seconds>0)this.cooldown.set(op.req.endpointKey,Date.now()+seconds*1000);
        }
      }
      if(retry&&op.consumers.size>0&&op.attempts<2){
        op.state='queued';op.handle=null;this.queue.push(op);this.event('retry',{id:op.id});this.pump();return;
      }
      this.finish(op,outcome);this.pump();
    }
    finish(op,outcome){
      if(op.terminal)return;
      op.terminal=true;op.state='terminal';op.outcome=outcome;
      for(const c of op.consumers.values()){
        if(!c.settled){c.settled=true;c.result=outcome;c.resolve(outcome);this.event('settle',{id:op.id,consumerId:c.id,outcome});}
      }
      this.ops.delete(op.id);this.event('terminal',{id:op.id,outcome,attempts:op.attempts});
    }
    cancelQueued(op){
      this.queue=this.queue.filter(x=>x!==op);op.terminal=true;op.state='cancelled';this.ops.delete(op.id);
      this.event('cancel-queued',{id:op.id});
    }
    release(op,id){
      if(!op.consumers.has(id))return false;
      op.consumers.delete(id);this.event('release',{id:op.id,consumerId:id,remaining:op.consumers.size,state:op.state});
      if(op.consumers.size)return true;
      if(op.state==='queued'){this.cancelQueued(op);return true;}
      if(op.state==='running'){
        op.terminal=true;op.state='cancelled-wait-wire';this.ops.delete(op.id);
        const issued=op.handle?.abort?.()===true;
        this.event('cancel-running',{id:op.id,abortIssued:issued});
      }
      return true;
    }
  }

  async function direct(url,expectedJson=true){
    const h=transportStart({url,expectedJson,timeout:3000});
    return h.promise;
  }
  async function reset(){
    await direct(A+'/reset',true);
  }
  async function stats(){
    return JSON.parse((await direct(A+'/stats',true)).text);
  }
  async function waitFor(predicate,{timeoutMs=1500,intervalMs=25,label='condition'}={}){
    const deadline=Date.now()+timeoutMs;
    let last=null;
    while(Date.now()<deadline){
      last=await stats();
      if(predicate(last)) return last;
      await sleep(intervalMs);
    }
    throw new Error('timed out waiting for '+label+'; last stats='+JSON.stringify(last));
  }
  function rq(base,key,operation,extra=''){
    return {
      site:'fixture',account:'anon',operation,params:{key},
      endpointKey:base===A?'A':'B',
      url:base+extra,
      expectedJson:true,
      timeout:2500,
    };
  }

  function show(text){
    document.querySelector('#ib06-result')?.remove();
    const root=document.createElement('div');
    root.id='ib06-result';
    root.style.cssText='position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const ta=document.createElement('textarea');
    ta.value=text;ta.style.cssText='width:100%;height:75vh;background:#000;color:#eee';
    const b=document.createElement('button');b.textContent='Close';b.onclick=()=>root.remove();
    root.append(ta,b);document.body.appendChild(root);ta.focus();ta.select();
  }

  async function run(){
    const tests=[];
    const test=async(id,name,fn)=>{
      try{tests.push({id,name,status:'PASS',detail:await fn()});}
      catch(e){tests.push({id,name,status:'FAIL',error:String(e?.stack||e)});}
    };

    await test('B01','actual manager transport dedupes equivalent reads',async()=>{
      await reset();const g=new Gate();
      const req=rq(A,'dedupe','meta','/delay?key=dedupe&ms=120');
      const a=g.acquire(req,{consumerId:'A'});const b=g.acquire(req,{consumerId:'B'});
      const [ra,rb]=await Promise.all([a.promise,b.promise]);
      const s=await stats();
      assert(ra==='success'&&rb==='success','consumers not successful');
      assert(s.counts['A:dedupe']===1,'server saw duplicate reads');
      return {serverRequests:1};
    });

    await test('B02','releasing one running consumer does not abort while another remains',async()=>{
      await reset();const g=new Gate();
      const req=rq(A,'share','meta','/delay?key=share&ms=180');
      const a=g.acquire(req,{consumerId:'A'});const b=g.acquire(req,{consumerId:'B'});
      await sleep(40);a.release();
      const outcome=await b.promise;const s=await stats();
      assert(outcome==='success','remaining consumer lost success');
      assert((s.aborted['A:share']||0)===0,'server observed abort with consumer remaining');
      assert(s.counts['A:share']===1,'shared read duplicated');
      return {aborted:0,requests:1};
    });

    await test('B03','last running release issues a real transport abort observed by server after server acceptance',async()=>{
      await reset();const g=new Gate();
      const req=rq(A,'abort','meta','/delay?key=abort&ms=3000');
      const a=g.acquire(req,{consumerId:'A'});
      await waitFor(s=>s.counts['A:abort']===1,{timeoutMs:1500,label:'server acceptance of abort fixture'});
      a.release();
      const s=await waitFor(s=>(s.aborted['A:abort']||0)>=1,{timeoutMs:1500,label:'server-observed abort'});
      return {serverAcceptedBeforeRelease:true,serverObservedAbort:s.aborted['A:abort']};
    });

    await test('B04','transient failure uses at most two actual attempts',async()=>{
      await reset();const g=new Gate();
      const req=rq(A,'twice','meta','/retry?key=twice&fail=99');
      const a=g.acquire(req,{consumerId:'A'});
      const outcome=await a.promise;const s=await stats();
      assert(outcome==='transient','wrong final outcome');
      assert(s.counts['A:twice']===2,'attempt ceiling not two');
      return {attempts:2};
    });

    await test('B05','one transient failure then success shares the same finite budget',async()=>{
      await reset();const g=new Gate();
      const req=rq(A,'recover','meta','/retry?key=recover&fail=1');
      const a=g.acquire(req,{consumerId:'A'});
      const outcome=await a.promise;const s=await stats();
      assert(outcome==='success','did not recover on second attempt');
      assert(s.counts['A:recover']===2,'unexpected attempt count');
      return {attempts:2,outcome};
    });

    await test('B06','401 and 404 are typed terminal outcomes with no retry',async()=>{
      await reset();
      const observed={};
      for(const [code,expected] of [[401,'auth-required'],[404,'not-found']]){
        const g=new Gate();const key='s'+code;
        const a=g.acquire(rq(A,key,'status','/status?key='+key+'&code='+code),{consumerId:'A'});
        observed[code]=await a.promise;
        assert(observed[code]===expected,'wrong outcome '+code);
      }
      const s=await stats();
      assert(s.counts['A:s401']===1&&s.counts['A:s404']===1,'nonretryable status retried');
      return observed;
    });

    await test('B07','HTTP 200 login/auth body is auth-required and is not retried',async()=>{
      await reset();const g=new Gate();
      const a=g.acquire(rq(A,'auth200','meta','/auth200?key=auth200'),{consumerId:'A'});
      const outcome=await a.promise;const s=await stats();
      assert(outcome==='auth-required','200 auth body misclassified');
      assert(s.counts['A:auth200']===1,'auth body retried');
      return {outcome,attempts:1};
    });

    await test('B08','HTTP 200 malformed expected JSON is structural and is not retried',async()=>{
      await reset();const g=new Gate();
      const a=g.acquire(rq(A,'malformed','meta','/malformed?key=malformed'),{consumerId:'A'});
      const outcome=await a.promise;const s=await stats();
      assert(outcome==='structural','malformed body misclassified');
      assert(s.counts['A:malformed']===1,'structural body retried');
      return {outcome,attempts:1};
    });

    await test('B09','429 cooldown is local to key A while key B remains usable',async()=>{
      await reset();const g=new Gate();
      const cooldownSeconds=4;
      const rate=g.acquire(rq(A,'rate','meta','/rate?key=rate&seconds='+cooldownSeconds),{consumerId:'rate'});
      const rateOutcome=await rate.promise;
      assert(rateOutcome==='rate-limited','429 misclassified');

      const cooldownUntil=g.cooldown.get('A')||0;
      assert(cooldownUntil-Date.now()>2500,'Retry-After header did not establish the expected cooldown window');

      const afterA=g.acquire(rq(A,'after-rate','meta','/ok?key=after-rate'),{consumerId:'A'});
      const onB=g.acquire(rq(B,'b-ok','meta','/ok?key=b-ok'),{consumerId:'B'});
      const bOutcome=await onB.promise;
      assert(bOutcome==='success','key B blocked by key A cooldown');
      let s=await stats();
      assert(Date.now()<cooldownUntil,'test observation escaped the cooldown window');
      assert(!s.counts['A:after-rate'],'key A request started during cooldown');
      assert(s.counts['B:b-ok']===1,'key B request missing');

      await sleep(Math.max(0,cooldownUntil-Date.now()+100));
      g.pump();
      const aOutcome=await afterA.promise;
      s=await stats();
      assert(aOutcome==='success'&&s.counts['A:after-rate']===1,'key A did not resume after cooldown');
      return {rateOutcome,retryAfterSeconds:cooldownSeconds,bUsableDuringCooldown:true,aResumed:true};
    });

    await test('B10','foreground join promotes a queued hover read without preempting active work',async()=>{
      await reset();const g=new Gate();
      const active=g.acquire(rq(A,'block','block','/delay?key=block&ms=160'),{consumerId:'block',lane:'background'});
      const hoverReq=rq(A,'hover','hover','/ok?key=hover');
      const hover=g.acquire(hoverReq,{consumerId:'hover',lane:'background'});
      const other=g.acquire(rq(A,'other','other','/ok?key=other'),{consumerId:'other',lane:'background'});
      const viewer=g.acquire(hoverReq,{consumerId:'viewer',lane:'foreground'});
      await active.promise;
      await Promise.all([hover.promise,viewer.promise,other.promise]);
      const s=await stats();
      const order=s.order.filter(x=>x.origin==='A'&&['hover','other'].includes(x.key)).map(x=>x.key);
      assert(order[0]==='hover','promoted hover was not admitted first');
      return {order};
    });

    await test('B11','different endpoint keys can have one active request each',async()=>{
      await reset();const g=new Gate();
      const a=g.acquire(rq(A,'parallel-a','a','/delay?key=parallel-a&ms=160'),{consumerId:'A'});
      const b=g.acquire(rq(B,'parallel-b','b','/delay?key=parallel-b&ms=160'),{consumerId:'B'});
      await sleep(50);const mid=await stats();
      assert(mid.counts['A:parallel-a']===1&&mid.counts['B:parallel-b']===1,'both keys were not active independently');
      await Promise.all([a.promise,b.promise]);
      return {parallelKeys:['A','B']};
    });

    const failed=tests.filter(t=>t.status!=='PASS');
    const result={
      probe:{name:'IB06 Request Gate',version:'1.0.0'},
      environment:{
        userAgent:navigator.userAgent,
        platform:navigator.platform,
        gmInfo:typeof GM_info!=='undefined'?{scriptHandler:GM_info.scriptHandler,version:GM_info.version}:null
      },
      policy:{
        lanes:['foreground','background'],
        endpointKeys:['A','B'],
        maxReadAttempts:2,
        numericPolicy:'test-only; no production host budget inferred'
      },
      summary:{tests:tests.length,passed:tests.length-failed.length,failed:failed.length,status:failed.length?'FAIL':'PASS'},
      tests,
      boundaries:{realManagerTransport:true,localhostOnly:true,liveSite:false,productionIntegration:false}
    };
    localStorage.setItem(RESULT_KEY,JSON.stringify(result));
    show(JSON.stringify(result,null,2));
  }

  GM_registerMenuCommand('IB06: Run request gate',()=>run());
  GM_registerMenuCommand('IB06: Show/export last result',()=>show(localStorage.getItem(RESULT_KEY)||JSON.stringify({error:'No completed run yet.'},null,2)));
})();
