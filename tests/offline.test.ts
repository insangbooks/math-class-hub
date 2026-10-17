import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');
function worker(fail=false,complete=true){
  const handlers:Record<string,(event:any)=>void>={};const removed:string[]=[];const opened:string[]=[];const skipped:string[]=[];const network:string[]=[];
  const cache={async addAll(){if(fail)throw new Error('synthetic download failure');},async match(){return complete?{cached:true}:undefined;}};
  const context=vm.createContext({URL,Request,Promise,fetch:async(request:{url:string})=>{network.push(request.url);return {network:true};},self:{registration:{scope:'http://127.0.0.1:4175/'},location:{origin:'http://127.0.0.1:4175'},clients:{async claim(){}},addEventListener:(name:string,handler:any)=>{handlers[name]=handler;},async skipWaiting(){skipped.push('yes');}},caches:{async open(name:string){opened.push(name);return cache;},async delete(name:string){removed.push(name);return true;}}});
  vm.runInContext(source,context);return {handlers,removed,opened,skipped,network};
}
test('failed new precache removes only failed version, leaves prior versions intact',async()=>{
  const w=worker(true);let pending:Promise<unknown>|undefined;
  w.handlers.install({waitUntil:(p:Promise<unknown>)=>{pending=p;}});await assert.rejects(pending!);assert.equal(w.removed.length,1);assert.equal(w.removed[0],w.opened[0]);assert.ok(!w.removed.includes('math-atelier-prior-working-version'));
});
test('readiness verifies all required shell assets; incomplete cache cannot update',async()=>{
  for(const complete of [false,true]){const w=worker(false,complete);let pending:Promise<unknown>|undefined;let reply:any;
    w.handlers.message({data:{type:'CHECK_READY'},ports:[{postMessage:(r:any)=>{reply=r;}}],waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;assert.equal(reply.ready,complete);
    w.handlers.message({data:{type:'APPLY_UPDATE'},waitUntil:(p:Promise<unknown>)=>{pending=p;}});await pending;assert.equal(w.skipped.length,complete?1:0);
  }
});
test('worker does not intercept external or POST; optional local tools bypass hub cache',()=>{
  const w=worker();let handled=false;
  for(const request of [{method:'GET',url:'https://example.com/'},{method:'POST',url:'http://127.0.0.1:4175/'},{method:'GET',url:'http://127.0.0.1:4175/pdf-counter/app.mjs'}])w.handlers.fetch({request,respondWith(){handled=true;}});
  assert.equal(handled,false);
  w.handlers.fetch({request:{method:'GET',mode:'navigate',url:'http://127.0.0.1:4175/pdf-counter/'},respondWith(){}});
  assert.equal(w.opened.length,0);
});
