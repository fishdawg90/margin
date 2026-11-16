import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,makeTask,ensureGroup,alphabeticalTasks,clearFinishedTasks,restoreFinishedTasks,toggleTask} from '../data.js';
test('alphabetical sorting ignores case and handles numbered titles naturally without mutating saved order',()=>{
 const tasks=['zebra','Task 10',' apple','Banana','task 2','Éclair'].map(title=>makeTask(title));const original=tasks.map(t=>t.id);
 assert.deepEqual(alphabeticalTasks(tasks).map(t=>t.title),[' apple','Banana','Éclair','task 2','Task 10','zebra']);assert.deepEqual(tasks.map(t=>t.id),original);
 tasks[0].title='Apricot';assert.equal(alphabeticalTasks(tasks)[1].title,'Apricot');
});
test('clearing finished tasks affects only the chosen list and keeps unfinished tasks, children and groups',()=>{
 const s=blank(),group=ensureGroup(s,'Project','work');
 const completed=makeTask('Done','work',group,{done:true,notes:'Keep on undo',subtasks:[{id:'done-child',title:'Finished step',done:true}]});
 const active=makeTask('Open','work',group,{subtasks:[{id:'step',title:'A completed step in open work',done:true}]});
 const home=makeTask('Home done','home','',{done:true});s.tasks=[completed,active,home];
 const removed=clearFinishedTasks(s,'work');assert.equal(removed.length,1);assert.deepEqual(s.tasks.map(t=>t.id),[active.id,home.id]);assert.equal(active.subtasks.length,1);assert.equal(s.groups.length,1);assert.deepEqual(clearFinishedTasks(s,'invalid'),[]);
 assert.equal(restoreFinishedTasks(s,removed),1);assert.deepEqual(s.tasks[0],completed);assert.equal(restoreFinishedTasks(s,removed),0);
});
test('undoing a clear keeps tasks created after the clear',()=>{
 const s=blank();const done=makeTask('Done','work','',{done:true});s.tasks=[done];const removed=clearFinishedTasks(s,'work');const added=makeTask('New work');s.tasks.push(added);restoreFinishedTasks(s,removed);assert.deepEqual(new Set(s.tasks.map(t=>t.id)),new Set([done.id,added.id]));
});
test('clearing a finished recurring task retains its open successor',()=>{
 const s=blank(),t=makeTask('Weekly review','work','',{repeat:'weekly',due:'2026-11-16'});s.tasks=[t];toggleTask(s,t.id);const next=t.successorId;const removed=clearFinishedTasks(s,'work');assert.deepEqual(s.tasks.map(t=>t.id),[next]);restoreFinishedTasks(s,removed);toggleTask(s,t.id);toggleTask(s,t.id);assert.equal(s.tasks.length,2);
});
