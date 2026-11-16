import test from 'node:test';
import assert from 'node:assert/strict';
import {createSync,validateConfig} from '../sync.js';
const EMPTY={version:1,tasks:[],groups:[]},key='a'.repeat(64);
test('settings reject non-HTTPS, credential and path URLs',()=>{
 for(const url of ['http://test.workers.dev','https://x@example.com','https://test.workers.dev/path','https://test.workers.dev/?key=a'])
  assert.throws(()=>validateConfig({url,key}));
 assert.equal(validateConfig({url:'https://test.workers.dev/',key}).url,'https://test.workers.dev');
});
test('client fetches, merges, retries stale revisions, preserves edits during upload, and keeps working offline',async()=>{
 const values=new Map(),listeners={};let local={version:2,tasks:[],groups:[],settings:{activeArea:'work'}};
 globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 globalThis.window={addEventListener:(event,fn)=>listeners[event]=fn};
 globalThis.document={hidden:false,addEventListener(){}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true,locks:{request:async(_name,_options,fn)=>fn({})}}});
 let remote={revision:0,data:structuredClone(EMPTY)},busy=false,onPut=null,stale=false,status='',conflicts=[];
 globalThis.fetch=async(_url,options)=>{
  if(options.method==='PUT'){
   if(stale){stale=false;remote.revision++;return new Response('{}',{status:409});}
   const body=JSON.parse(options.body);assert.equal(body.revision,remote.revision);
   remote={revision:remote.revision+1,data:body.data};
   if(onPut){const run=onPut;onPut=null;run();}
  }
  return new Response(JSON.stringify(remote),{headers:{'Content-Type':'application/json'}});
 };
 const sync=createSync({getState:()=>structuredClone(local),applyData:data=>{local={...data,version:2,settings:local.settings};},
  isBusy:()=>busy,onStatus:s=>status=s,onConflict:c=>conflicts=c});
 const make=id=>({id,title:id,area:'work',group:'',subtasks:[]});
 sync.connect({url:'https://test.workers.dev',key});
 try{
  local.tasks.push(make('a'));await sync.flush();assert.equal(remote.data.tasks.length,1);assert.equal(status,'Synced');
  remote.data.tasks.push(make('b'));remote.revision++;await sync.flush();assert.equal(local.tasks.length,2);
  local.tasks=local.tasks.filter(t=>t.id!=='a');stale=true;await sync.flush();await sync.flush();assert.equal(remote.data.tasks.some(t=>t.id==='a'),false);
  local.tasks.push(make('c'));onPut=()=>local.tasks.push(make('d'));await sync.flush();assert.equal(local.tasks.some(t=>t.id==='d'),true);
  await sync.flush();assert.equal(remote.data.tasks.some(t=>t.id==='d'),true);
  local.tasks.find(t=>t.id==='b').title='Local';remote.data.tasks.find(t=>t.id==='b').title='Remote';remote.revision++;
  await sync.flush();assert.equal(conflicts.length,1);assert.equal(remote.data.tasks.find(t=>t.id==='b').title,'Remote');
  sync.resolve('local');await sync.flush();assert.equal(remote.data.tasks.find(t=>t.id==='b').title,'Local');
  navigator.onLine=false;local.tasks.push(make('offline'));await sync.flush();assert.match(status,/Offline/);
  navigator.onLine=true;await sync.flush();assert.equal(remote.data.tasks.some(t=>t.id==='offline'),true);
  local.tasks.push(make('pending'));onPut=()=>busy=true;await sync.flush();
  assert.equal(local.tasks.some(t=>t.id==='pending'),true);busy=false;await sync.flush();assert.equal(status,'Synced');
  assert.equal(local.settings.activeArea,'work');
 }finally{sync.disconnect();}
});
