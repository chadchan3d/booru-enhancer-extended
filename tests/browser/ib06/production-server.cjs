'use strict';
const http=require('http');

const state={counts:{},aborted:{},order:[]};
function id(origin,key){return origin+':'+key;}
function hit(origin,key,path){
  const k=id(origin,key);
  state.counts[k]=(state.counts[k]||0)+1;
  state.order.push({origin,key,path,n:state.order.length+1});
  return state.counts[k];
}
function markAbort(origin,key){
  const k=id(origin,key);
  state.aborted[k]=(state.aborted[k]||0)+1;
}
function reset(){state.counts={};state.aborted={};state.order=[];}
function json(res,status,obj,headers={}){
  const body=JSON.stringify(obj);
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body),...headers});
  res.end(body);
}
function text(res,status,body,headers={}){
  res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body),...headers});
  res.end(body);
}
function handler(origin,port){
  return (req,res)=>{
    const u=new URL(req.url,'http://127.0.0.1:'+port);
    if(u.pathname==='/'){
      const body='<!doctype html><html><head><meta charset="utf-8"><title>IB06 Production Conformance</title></head><body><h1>IB06 Production Conformance Fixture</h1><p>Run <code>IB06P: Run production conformance</code> from Tampermonkey.</p><div class="content"></div></body></html>';
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Length':Buffer.byteLength(body)});
      return res.end(body);
    }
    if(u.pathname==='/reset'){reset();return json(res,200,{ok:true});}
    if(u.pathname==='/stats'){return json(res,200,state);}
    const key=u.searchParams.get('key')||'none';
    if(u.pathname==='/ok'){hit(origin,key,u.pathname);return json(res,200,{ok:true,key,origin});}
    if(u.pathname==='/status'){
      const code=Number(u.searchParams.get('code')||500);
      hit(origin,key,u.pathname);return json(res,code,{ok:false,code,key});
    }
    if(u.pathname==='/auth200'){hit(origin,key,u.pathname);return text(res,200,'LOGIN_REQUIRED');}
    if(u.pathname==='/malformed'){hit(origin,key,u.pathname);return text(res,200,'not-json');}
    if(u.pathname==='/rate'){
      const seconds=Math.max(0.1,Math.min(10,Number(u.searchParams.get('seconds')||1)));
      hit(origin,key,u.pathname);return json(res,429,{ok:false,rate:true,seconds},{'Retry-After':String(seconds)});
    }
    if(u.pathname==='/retry'){
      const n=hit(origin,key,u.pathname);
      const fail=Number(u.searchParams.get('fail')||0);
      return n<=fail?json(res,500,{ok:false,attempt:n}):json(res,200,{ok:true,attempt:n});
    }
    if(u.pathname==='/delay'){
      hit(origin,key,u.pathname);
      const ms=Math.max(0,Number(u.searchParams.get('ms')||100));
      let completed=false,abortMarked=false;
      const noteAbort=()=>{if(!completed&&!abortMarked){abortMarked=true;markAbort(origin,key);}};
      req.on('aborted',noteAbort);
      res.on('close',noteAbort);
      return setTimeout(()=>{
        if(res.destroyed)return;
        completed=true;
        json(res,200,{ok:true,key,origin,ms});
      },ms);
    }
    text(res,404,'not found');
  };
}

const a=http.createServer(handler('A',8780));
const b=http.createServer(handler('B',8781));
let ready=0;
function onReady(){
  ready++;
  if(ready===2)console.log('IB06 production fixtures listening at http://127.0.0.1:8780 and http://127.0.0.1:8781');
}
a.listen(8780,'127.0.0.1',onReady);
b.listen(8781,'127.0.0.1',onReady);
process.on('SIGINT',()=>{
  let left=2;
  const done=()=>{if(--left===0)process.exit(0);};
  a.close(done);b.close(done);
});
