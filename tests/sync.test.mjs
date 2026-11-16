import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeNotebooks,snapshotData} from '../sync-core.js';
import {validNotebook} from '../cloudflare/worker.mjs';
import worker from '../cloudflare/worker.mjs';
const empty=()=>({version:1,tasks:[],groups:[]});
const task=(id,title=id)=>({id,title,area:'work',group:'',subtasks:[]});
const doc=(tasks)=>({...empty(),tasks});
test('independent task edits merge without overwriting either device',()=>{
 const base=doc([task('a'),task('b')]),local=structuredClone(base),remote=structuredClone(base);
 local.tasks[0].title='Laptop edit';remote.tasks[1].done=true;
 const merged=mergeNotebooks(base,local,remote);
 assert.equal(merged.conflicts.length,0);assert.equal(merged.data.tasks[0].title,'Laptop edit');assert.equal(merged.data.tasks[1].done,true);
 assert.equal(base.tasks[0].title,'a');
});
test('first connection merges tasks already on different devices',()=>{
 assert.equal(mergeNotebooks(empty(),doc([task('a')]),doc([task('b')])).data.tasks.length,2);
});
test('deletions persist and editing a deleted task requires a choice',()=>{
 const base=doc([task('a')]);
 assert.deepEqual(mergeNotebooks(base,empty(),base).data.tasks,[]);
 const edited=doc([task('a','Changed')]);
 assert.equal(mergeNotebooks(base,empty(),edited).conflicts.length,1);
 assert.equal(mergeNotebooks(base,empty(),edited,'cloud').data.tasks[0].title,'Changed');
 assert.equal(mergeNotebooks(base,empty(),edited,'local').data.tasks.length,0);
});
test('same-task changes pause; explicit choice keeps unrelated tasks',()=>{
 const base=doc([task('a')]),mine=doc([task('a','Mine'),task('b')]),cloud=doc([task('a','Cloud'),task('c')]);
 assert.equal(mergeNotebooks(base,mine,cloud).conflicts.length,1);
 const merged=mergeNotebooks(base,mine,cloud,'cloud').data;
 assert.equal(merged.tasks.length,3);assert.equal(merged.tasks.find(t=>t.id==='a').title,'Cloud');
});
test('removed groups ungroup tasks without dropping them',()=>{
 const base={...doc([{...task('a'),group:'g'}]),groups:[{id:'g',name:'Project',area:'work'}]};
 const remote=structuredClone(base);remote.groups=[];
 const merged=mergeNotebooks(base,base,remote);
 assert.equal(merged.data.tasks.length,1);assert.equal(merged.data.tasks[0].group,'');
});
test('sync excludes device preferences and connection secrets',()=>{
 const data=snapshotData({...doc([task('a')]),settings:{key:'never-upload'}});
 assert.equal(data.settings,undefined);assert.equal(JSON.stringify(data).includes('never-upload'),false);
});
test('worker validates duplicate IDs and malformed notebooks',()=>{
 assert.equal(validNotebook(doc([task('a')])),true);
 assert.equal(validNotebook(doc([task('a'),task('a')])),false);
 assert.equal(validNotebook(doc([{...task('a'),area:'other'}])),false);
 assert.equal(validNotebook({...empty(),groups:[{id:'g',name:'',area:'work'}]}),false);
});
test('worker fails closed before accessing storage',async()=>{
 const db={prepare(){throw Error('Must not access DB');}};
 let response=await worker.fetch(new Request('https://sync.example/notebook'),{DB:db,SYNC_KEY:'a'.repeat(64)});
 assert.equal(response.status,401);
 response=await worker.fetch(new Request('https://sync.example/notebook',{headers:{Origin:'https://other.example'}}),{DB:db,SYNC_KEY:'a'.repeat(64)});
 assert.equal(response.status,403);
 response=await worker.fetch(new Request('https://sync.example/notebook'),{});
 assert.equal(response.status,503);
});
test('worker uses a conditional revision update to reject stale writes',async()=>{
 let revision=0,data=empty();
 const db={prepare(sql){let args=[];return{
  bind(...values){args=values;return this;},
  async first(){return {revision,data:JSON.stringify(data)};},
  async run(){
   if(sql.startsWith('UPDATE')){
    if(args[1]!==revision)return {meta:{changes:0}};
    data=JSON.parse(args[0]);revision++;return {meta:{changes:1}};
   }return {meta:{changes:0}};
  }
 };}};
 const env={DB:db,SYNC_KEY:'a'.repeat(64)};
 const put=()=>new Request('https://sync.example/notebook',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.SYNC_KEY,Origin:'https://fishdawg90.github.io'},body:JSON.stringify({revision:0,data:doc([task('a')])})});
 assert.equal((await worker.fetch(put(),env)).status,200);
 assert.equal((await worker.fetch(put(),env)).status,409);
 assert.equal(revision,1);
});
