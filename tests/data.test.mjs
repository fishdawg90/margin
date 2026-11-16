import test from 'node:test';
import assert from 'node:assert/strict';
import {normalise,blank,makeTask,ensureGroup,moveTask,toggleTask,mergeBackup} from '../data.js';

test('an existing notebook migrates without losing task details',()=>{
 const legacy={version:1,tasks:[{id:'a',title:'Work item',group:'Work',priority:3,tags:['important'],done:true},{id:'b',title:'Home item',group:'Personal'},{id:'c',title:'Project item',group:'Lisbon',notes:'Keep these notes',link:'https://example.com',due:'2026-12-04'}],groups:['Work','Personal','Lisbon','Later'],settings:{advanced:true}};
 const s=normalise(legacy);assert.equal(s.tasks.length,3);assert.equal(s.tasks[0].area,'work');assert.equal(s.tasks[0].group,'');assert.equal(s.tasks[0].priority,3);assert.deepEqual(s.tasks[0].tags,['important']);assert.equal(s.tasks[0].done,true);assert.equal(s.tasks[1].area,'home');assert.equal(s.tasks[1].group,'');assert.equal(s.groups.find(g=>g.id===s.tasks[2].group).name,'Lisbon');assert.equal(s.tasks[2].notes,'Keep these notes');assert.equal(s.tasks[2].due,'2026-12-04');assert(s.groups.some(g=>g.name==='Later'));
});
test('moving across lists keeps the parent and its subtasks together',()=>{
 const s=blank(),g=ensureGroup(s,'Garden','home');const task=makeTask('Order supplies','work','',{subtasks:[{id:'s1',title:'Measure',done:true}]});s.tasks.push(task);assert(moveTask(s,task.id,'home',g));assert.equal(task.area,'home');assert.equal(task.group,g);assert.equal(task.subtasks[0].done,true);assert.equal(moveTask(s,task.id,'work',g),false);assert.equal(task.area,'home');
});
test('reordering moves one task without duplicating or losing other tasks',()=>{
 const s=blank();s.tasks=['First','Second','Third'].map(title=>makeTask(title));const [a,b,c]=s.tasks;assert(moveTask(s,c.id,'work','',a.id));assert.deepEqual(s.tasks.map(t=>t.id),[c.id,a.id,b.id]);assert.equal(moveTask(s,c.id,'work','',c.id),false);assert.equal(new Set(s.tasks.map(t=>t.id)).size,3);
});
test('a recurring task has one successor and fresh child checkboxes',()=>{
 const s=blank(),t=makeTask('Weekly review','home','',{repeat:'weekly',due:'2026-11-16',subtasks:[{id:'s2',title:'Check notes',done:true}]});s.tasks.push(t);toggleTask(s,t.id);const next=s.tasks.find(x=>x.id===t.successorId);assert.equal(next.due,'2026-11-23');assert.equal(next.area,'home');assert.equal(next.subtasks[0].done,false);assert.notEqual(next.subtasks[0].id,t.subtasks[0].id);toggleTask(s,t.id);toggleTask(s,t.id);assert.equal(s.tasks.length,2);
});
test('backups round-trip and merges reuse groups without replacing existing tasks',()=>{
 const s=blank(),g=ensureGroup(s,'Garden','home');s.tasks.push(makeTask('Water plants','home',g,{subtasks:[{id:'s1',title:'Front bed',done:true}]}));const restored=normalise(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);assert.equal(mergeBackup(restored,normalise(s)),0);const incoming=blank();incoming.groups=[{id:'other-garden-id',name:'Garden',area:'home'}];incoming.tasks=[makeTask('Buy compost','home','other-garden-id')];assert.equal(mergeBackup(restored,incoming),1);assert.equal(restored.groups.length,1);assert.equal(restored.tasks.at(-1).group,g);assert.equal(restored.tasks[0].subtasks[0].done,true);
});
