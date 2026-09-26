// ==UserScript==
// @name         Booru Enhancer Extended — IB04 Browser Ownership Probe
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended
// @version      1.0.0
// @description  Local-only browser ownership validation for IB04.
// @author       ChadChan3D
// @license      MIT
// @match        http://127.0.0.1:8775/*
// @grant        GM_info
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(() => {
  'use strict';
  const RESULT_KEY = 'ib04:last-result:v1';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const now = () => performance.now();
  const q = (sel, root = document) => root.querySelector(sel);

  function snapshot(node) {
    if (!node) return null;
    return {
      tag: node.tagName,
      attrs: [...node.attributes].map(a => [a.name, a.value]).sort((a,b)=>a[0].localeCompare(b[0])),
      text: node.childNodes.length === 1 && node.firstChild?.nodeType === Node.TEXT_NODE ? node.textContent : null,
      children: [...node.children].map(snapshot),
    };
  }

  function sameJSON(a,b) { return JSON.stringify(a) === JSON.stringify(b); }
  function cssPath(node) {
    if (!node) return null;
    if (node.id) return `#${node.id}`;
    return node.tagName || String(node);
  }

  function makeOwner({ origin = null, fallback = null } = {}) {
    let disposed = false;
    const attrRecords = [];
    const additions = [];
    const listeners = [];
    const timers = new Set();
    const observers = [];
    const cleanups = [];
    const stats = { added:0, removed:0, listeners:0, listenersRemoved:0, timers:0, timersCleared:0, observers:0, observersDisconnected:0, guardedLateCalls:0 };

    function ownAttribute(node, name, value) {
      const record = {
        node, name,
        originalPresent: node.hasAttribute(name),
        originalValue: node.getAttribute(name),
        nativeTouched: false,
      };
      if (value === null || value === undefined) node.removeAttribute(name);
      else node.setAttribute(name, value);
      const observer = new MutationObserver((records) => {
        for (const m of records) if (m.type === 'attributes' && m.attributeName === name) record.nativeTouched = true;
      });
      observer.observe(node, { attributes:true, attributeFilter:[name], attributeOldValue:true });
      observers.push({ observer, record }); stats.observers++;
      attrRecords.push(record);
      return record;
    }

    function add(node, parent, before = null) {
      if (before) parent.insertBefore(node, before); else parent.appendChild(node);
      additions.push(node); stats.added++;
      return node;
    }
    function on(node, type, fn, options) {
      node.addEventListener(type, fn, options);
      listeners.push([node,type,fn,options]); stats.listeners++;
      return fn;
    }
    function timeout(fn, ms) {
      const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); else stats.guardedLateCalls++; }, ms);
      timers.add(id); stats.timers++;
      return id;
    }
    function guard(fn) { return (...args) => { if (disposed) { stats.guardedLateCalls++; return; } return fn(...args); }; }
    function cleanup(fn) { cleanups.push(fn); }

    function dispose() {
      if (disposed) return { alreadyDisposed:true, focusOutcome:'unchanged', reloadRecommended:false, stats:{...stats} };
      disposed = true;
      for (const entry of observers) {
        try {
          for (const m of entry.observer.takeRecords()) {
            if (m.type === 'attributes' && m.attributeName === entry.record.name) entry.record.nativeTouched = true;
          }
          entry.observer.disconnect(); stats.observersDisconnected++;
        } catch {}
      }
      for (const [node,type,fn,options] of listeners) { try { node.removeEventListener(type,fn,options); stats.listenersRemoved++; } catch {} }
      for (const id of timers) { clearTimeout(id); stats.timersCleared++; }
      timers.clear();

      for (const r of attrRecords) {
        if (r.nativeTouched || !r.node.isConnected) continue;
        if (r.originalPresent) r.node.setAttribute(r.name, r.originalValue);
        else r.node.removeAttribute(r.name);
      }

      const active = document.activeElement;
      const removingFocused = additions.some(node => node === active || node.contains(active));
      for (const node of [...additions].reverse()) {
        if (node.isConnected) { node.remove(); stats.removed++; }
      }

      let focusOutcome = 'unchanged';
      let reloadRecommended = false;
      if (removingFocused) {
        if (origin?.isConnected) { origin.focus(); focusOutcome = 'origin'; }
        else if (fallback?.isConnected) { fallback.focus(); focusOutcome = 'fallback'; }
        else { focusOutcome = 'unresolved'; reloadRecommended = true; }
      }
      for (const fn of cleanups.splice(0)) { try { fn(); } catch {} }
      return { alreadyDisposed:false, focusOutcome, reloadRecommended, stats:{...stats} };
    }

    return { ownAttribute, add, on, timeout, guard, cleanup, dispose, get disposed(){return disposed;}, stats };
  }

  function safeViewerClick(event, { openShell, isNativeControl = false } = {}) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || isNativeControl) return false;
    let opened = false;
    try { opened = openShell() === true; } catch { opened = false; }
    if (!opened) return false;
    event.preventDefault();
    return true;
  }

  function modal(title, text) {
    q('#ib04-result-modal')?.remove();
    const root = document.createElement('div'); root.id='ib04-result-modal';
    root.style.cssText='position:fixed;inset:20px;z-index:2147483647;background:#111;color:#eee;padding:16px;border:2px solid #888;overflow:auto;font:13px/1.4 monospace';
    const h=document.createElement('h2'); h.textContent=title; h.style.fontFamily='system-ui';
    const ta=document.createElement('textarea'); ta.value=text; ta.style.cssText='width:100%;height:70vh;background:#000;color:#eee';
    const close=document.createElement('button'); close.textContent='Close'; close.style.marginTop='8px'; close.onclick=()=>root.remove();
    root.append(h,ta,close); document.body.appendChild(root); ta.focus(); ta.select();
  }

  async function waitMutationTick() { await Promise.resolve(); await sleep(0); }
  function resetHash() { history.replaceState(null,'',location.pathname); }

  async function runAll() {
    const startedAt = new Date().toISOString();
    const testResults=[];
    const assert=(c,m)=>{if(!c)throw new Error(m)};
    const parts=()=>({card:q('#native-card'),link:q('#native-link'),picture:q('#native-picture'),source:q('#native-source'),img:q('#native-img'),nested:q('#native-nested-control'),paginator:q('#native-paginator'),moveTarget:q('#native-move-target'),appendedHost:q('#native-appended-host'),other:q('#native-other-focus')});
    const test=async(id,name,fn)=>{const t=now();try{const detail=await fn();testResults.push({id,name,status:'PASS',dt:Math.round((now()-t)*10)/10,detail});}catch(e){testResults.push({id,name,status:'FAIL',dt:Math.round((now()-t)*10)/10,error:String(e?.stack||e)});}};

    await test('B01','static restoration + node identity',async()=>{const p=parts();const refs={link:p.link,picture:p.picture,source:p.source,img:p.img};const before=snapshot(p.card);const o=makeOwner({origin:p.link});o.ownAttribute(p.link,'title',null);o.ownAttribute(p.img,'style','object-fit:contain');o.ownAttribute(p.source,'srcset','enhanced 1x');const b=document.createElement('button');o.add(b,p.card);const out=o.dispose();assert(sameJSON(snapshot(p.card),before),'static DOM not restored');assert(parts().link===refs.link&&parts().picture===refs.picture&&parts().source===refs.source&&parts().img===refs.img,'native identity changed');return {stats:out.stats};});
    await test('B02','five mount/dispose cycles + listener cleanup',async()=>{const p=parts();let calls=0;for(let i=0;i<5;i++){const o=makeOwner({origin:p.link});const b=document.createElement('button');o.add(b,p.card);o.on(b,'click',()=>calls++);b.click();o.dispose();o.dispose();b.dispatchEvent(new MouseEvent('click',{bubbles:true}));}assert(calls===5,`listener calls ${calls}`);return {calls};});
    await test('B03','later native title change survives',async()=>{const p=parts();const o=makeOwner({origin:p.link});o.ownAttribute(p.link,'title',null);q('#native-change-title').click();await waitMutationTick();o.dispose();assert(p.link.getAttribute('title')==='native title newer','native title overwritten');p.link.setAttribute('title','native title');return {title:'native title newer'};});
    await test('B04','same-value native write invalidates restoration',async()=>{const p=parts();const original=p.img.getAttribute('style');const o=makeOwner({origin:p.link});o.ownAttribute(p.img,'style','object-fit:contain');q('#native-same-style').click();o.dispose();assert(p.img.getAttribute('style')==='object-fit:contain','same-value native write lost');p.img.setAttribute('style',original);return {preserved:true};});
    await test('B05','repeated native edits keep latest',async()=>{const p=parts();const o=makeOwner({origin:p.link});o.ownAttribute(p.link,'title','enhanced');q('#native-title-twice').click();await waitMutationTick();o.dispose();assert(p.link.getAttribute('title')==='native title two','latest native value lost');p.link.setAttribute('title','native title');return {title:'native title two'};});
    await test('B06','moved source keeps identity and location',async()=>{const p=parts();const source=p.source;const original=source.getAttribute('srcset');const o=makeOwner({origin:p.link});o.ownAttribute(source,'srcset','enhanced');q('#native-move-source').click();await waitMutationTick();o.dispose();assert(source===q('#native-source'),'identity lost');assert(source.parentElement===q('#native-move-target'),'location overwritten');assert(source.getAttribute('srcset')===original,'srcset not restored');p.picture.prepend(source);return {identity:true};});
    await test('B07','native card replacement survives stale disposal',async()=>{const p=parts();const old=p.card;const o=makeOwner({origin:p.link});o.ownAttribute(p.link,'title','enhanced');q('#native-replace-card').click();await waitMutationTick();const replacement=q('#native-card');assert(replacement!==old,'not replaced');o.dispose();assert(q('#native-link').getAttribute('title')==='replacement native title','replacement altered');return {generation:replacement.dataset.nativeGeneration};});
    await test('B08','late work cannot resurrect disposed source',async()=>{const p=parts();const original=p.img.getAttribute('src');const o=makeOwner({origin:p.link});let fired=0;o.timeout(()=>{fired++;p.img.setAttribute('src','late-owned.jpg');},35);o.dispose();await sleep(80);assert(fired===0,'late callback executed');assert(p.img.getAttribute('src')===original,'source changed');return {timersCleared:o.stats.timersCleared,guardedLateCalls:o.stats.guardedLateCalls};});
    await test('B09','focused owned control returns native origin',async()=>{const p=parts();p.link.focus();assert(document.activeElement===p.link,'origin not focused');const o=makeOwner({origin:p.link});const b=document.createElement('button');o.add(b,p.card);b.focus();const out=o.dispose();assert(document.activeElement===p.link,`focus ${cssPath(document.activeElement)}`);assert(out.focusOutcome==='origin','wrong focus outcome');return {active:cssPath(document.activeElement)};});
    await test('B10','later user/native focus is not stolen',async()=>{const p=parts();const o=makeOwner({origin:p.link});const b=document.createElement('button');o.add(b,p.card);b.focus();p.other.focus();const out=o.dispose();assert(document.activeElement===p.other,`focus ${cssPath(document.activeElement)}`);return {focusOutcome:out.focusOutcome};});
    await test('B11','missing origin uses declared fallback',async()=>{const p=parts();const fallback=p.paginator;const originalParent=p.card.parentElement;const next=p.card.nextSibling;const o=makeOwner({origin:p.link,fallback});const b=document.createElement('button');o.add(b,p.card);b.focus();p.card.remove();document.body.appendChild(b);b.focus();const out=o.dispose();assert(document.activeElement===fallback,`focus ${cssPath(document.activeElement)}`);assert(out.focusOutcome==='fallback','wrong focus outcome');if(next)originalParent.insertBefore(p.card,next);else originalParent.appendChild(p.card);return {focusOutcome:out.focusOutcome};});
    await test('B12','no surviving target declares reload recovery',async()=>{const p=parts();const originalParent=p.card.parentElement;const next=p.card.nextSibling;const paginatorParent=p.paginator.parentElement;const paginatorNext=p.paginator.nextSibling;const o=makeOwner({origin:p.link,fallback:p.paginator});const b=document.createElement('button');o.add(b,p.card);b.focus();p.card.remove();p.paginator.remove();document.body.appendChild(b);b.focus();const out=o.dispose();assert(out.focusOutcome==='unresolved','not unresolved');assert(out.reloadRecommended===true,'reload not declared');if(next)originalParent.insertBefore(p.card,next);else originalParent.appendChild(p.card);if(paginatorNext)paginatorParent.insertBefore(p.paginator,paginatorNext);else paginatorParent.appendChild(p.paginator);return {reloadRecommended:out.reloadRecommended};});
    await test('B13','sync viewer failure preserves real native navigation',async()=>{resetHash();const p=parts();let opens=0;const handler=(e)=>safeViewerClick(e,{openShell:()=>{opens++;throw new Error('sync shell failure');}});p.link.addEventListener('click',handler);p.link.click();await sleep(20);p.link.removeEventListener('click',handler);assert(location.hash==='#native-destination',`hash ${location.hash}`);assert(opens===1,`opens ${opens}`);resetHash();return {hashNavigation:true};});
    await test('B14','later viewer media failure exposes usable native fallback',async()=>{resetHash();const p=parts();const o=makeOwner({origin:p.link});let takeover=0;const handler=(e)=>safeViewerClick(e,{openShell:()=>{takeover++;return true;}});o.on(p.link,'click',handler);p.link.click();await sleep(10);assert(location.hash==='',`native navigation escaped takeover: ${location.hash}`);const fallback=document.createElement('a');fallback.href=p.link.href;fallback.textContent='Native fallback';fallback.id='ib04-fallback';o.add(fallback,p.card);fallback.click();await sleep(20);assert(location.hash==='#native-destination',`fallback hash ${location.hash}`);o.dispose();resetHash();return {takeover,usableFallback:true};});
    await test('B15','modifier/middle and native nested controls avoid takeover',async()=>{const p=parts();let opens=0;const handler=(e)=>safeViewerClick(e,{openShell:()=>{opens++;return true;},isNativeControl:e.target.closest?.('#native-nested-control')!=null});p.card.addEventListener('click',handler);const variants=[{button:1},{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true}];for(const init of variants){const e=new MouseEvent('click',{bubbles:true,cancelable:true,...init});p.link.dispatchEvent(e);assert(!e.defaultPrevented,'protected click prevented');}const nestedEvent=new MouseEvent('click',{bubbles:true,cancelable:true});p.nested.dispatchEvent(nestedEvent);assert(!nestedEvent.defaultPrevented,'nested control prevented');p.card.removeEventListener('click',handler);assert(opens===0,`viewer opened ${opens}`);return {opens};});
    await test('B16','hover disabled keeps native title; enabled replacement restores',async()=>{const p=parts();assert(p.link.getAttribute('title')==='replacement native title','native title absent while disabled');const original=p.link.getAttribute('title');const o=makeOwner({origin:p.link});o.ownAttribute(p.link,'title',null);o.ownAttribute(p.link,'aria-label',original);assert(p.link.getAttribute('aria-label')===original,'replacement label missing');o.dispose();assert(p.link.getAttribute('title')===original,'title not restored');assert(!p.link.hasAttribute('aria-label'),'owned aria-label leaked');return {restored:true};});
    await test('B17','append failure retains content; full disposal removes only owned append',async()=>{const p=parts();const o=makeOwner({origin:p.link});const added=document.createElement('article');added.id='ib04-owned-appended';added.textContent='owned appended card';o.add(added,p.appendedHost);assert(added.isConnected&&p.paginator.isConnected,'append/paginator missing before failure');await sleep(5);assert(added.isConnected&&p.paginator.isConnected,'ordinary failure destroyed readable content');const out=o.dispose();assert(!added.isConnected,'full disposal retained owned addition');assert(p.paginator.isConnected,'full disposal removed native paginator');return {removed:out.stats.removed};});
    await test('B18','native listener remains after enhancer disposal',async()=>{const p=parts();const before=Number(document.documentElement.dataset.nativeLinkClicks||'0');const o=makeOwner({origin:p.link});const noop=()=>{};o.on(p.link,'pointerenter',noop);o.dispose();resetHash();p.link.click();await sleep(10);const after=Number(document.documentElement.dataset.nativeLinkClicks||'0');assert(after===before+1,`native listener count ${before}->${after}`);resetHash();return {nativeListenerDelta:after-before};});

    const failed=testResults.filter(x=>x.status!=='PASS');
    const result={
      probe:{name:'IB04 Browser Ownership Probe',version:'1.0.0'},
      startedAt,completedAt:new Date().toISOString(),
      environment:{href:location.href,userAgent:navigator.userAgent,platform:navigator.platform,gmInfo:typeof GM_info!=='undefined'?{scriptHandler:GM_info.scriptHandler,version:GM_info.version,script:GM_info.script}:null},
      summary:{tests:testResults.length,passed:testResults.length-failed.length,failed:failed.length,status:failed.length?'FAIL':'PASS'},
      tests:testResults,
      boundaries:{realBrowser:true,liveSite:false,productionUserscript:false,routeWorld:false,network:false},
    };
    try { GM_setValue(RESULT_KEY, JSON.stringify(result)); } catch {}
    modal(`IB04 result — ${result.summary.status}`, JSON.stringify(result,null,2));
    return result;
  }

  GM_registerMenuCommand('IB04: Run browser ownership probe', () => runAll());
  GM_registerMenuCommand('IB04: Show/export last result', () => {
    try {
      const raw=GM_getValue(RESULT_KEY,'');
      modal('IB04 last result', raw || JSON.stringify({error:'No completed run yet.'},null,2));
    } catch (e) { modal('IB04 last result', JSON.stringify({error:String(e)},null,2)); }
  });
})();
