import {KEY,uid,blank,normalise,ensureGroup,makeTask,moveTask,toggleTask as completeTask,safeUrl,today,validDate,mergeBackup,alphabeticalTasks,clearFinishedTasks,restoreFinishedTasks} from './data.js?v=2.2';
import {createSync} from './sync.js?v=3';
const $=s=>document.querySelector(s);
let sync=null,syncApplying=false,syncMessage='Saved on this device';
const icon=(name)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',name==='grip'?'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01':name==='check'?'m6 12 4 4 8-8':'M12 5v14M5 12h14');svg.append(p);return svg;};
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
let finishRenderTimer;
let state=blank(),area='work',view='all',query='',newPriority=1,newGroup='',editing=null,editPriority=1,editSubtasks=[],renamingGroup=null,undoState=null,toastTimer,installPrompt,accessToken=null,inlineTask=null,undoAction=null,clearingFinished=false,storageOkay=true,canWrite=true,drag=null,suppressClickUntil=0;
try{const raw=localStorage.getItem(KEY);if(raw){state=normalise(JSON.parse(raw));if(JSON.parse(raw).version===1){try{if(!localStorage.getItem('margin.notebook.before-v2'))localStorage.setItem('margin.notebook.before-v2',raw);}catch{storageOkay=false;}}}area=state.settings.activeArea;}catch{storageOkay=false;canWrite=false;}
function save(){if(!canWrite){toast('Existing data could not be read. Export a recovery backup in Settings.',false);return false;}state.settings.activeArea=area;try{localStorage.setItem(KEY,JSON.stringify(state));storageOkay=true;if(!syncApplying)sync?.notify();return true;}catch{storageOkay=false;toast('Could not save. Export a backup in Settings.',false);return false;}}
function snapshot(){undoState=JSON.stringify(state);undoAction=null;}
function commit(){save();render();}
function toast(message,undo=true){clearTimeout(toastTimer);$('#toast-text').textContent=message;$('#undo').hidden=!undo||!(undoState||undoAction);$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,12000);}
$('#undo').onclick=()=>{if(undoAction){const restore=undoAction;undoAction=null;undoState=null;restore();}else if(undoState){state=normalise(JSON.parse(undoState));area=state.settings.activeArea;undoState=null;commit();}$('#toast').hidden=true;};
function openDialog(id){const d=$(id);if(!d.open){d.showModal();history.pushState({marginDialog:true},'');}}
function closeDialog(d){d.close();if(history.state?.marginDialog)history.back();}
window.addEventListener('popstate',()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d);});d.querySelector('.close').onclick=()=>closeDialog(d);d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d);});});
function taskMatches(t){const q=query.toLowerCase().replace(/^#/,'');return !q||[t.title,t.notes,...t.tags,...t.subtasks.map(s=>s.title),state.groups.find(g=>g.id===t.group)?.name||''].join(' ').toLowerCase().includes(q);}
function render(){
 document.body.classList.toggle('advanced-mode',state.settings.advanced);
 document.body.classList.toggle('drag-active',!!drag?.active);
 for(const a of ['work','home']){$('#'+a+'-count').textContent=state.tasks.filter(t=>t.area===a&&!t.done).length;const b=document.querySelector('[data-area="'+a+'"]');b.classList.toggle('active',area===a);b.setAttribute('aria-pressed',area===a);}
 const current=state.tasks.filter(t=>t.area===area);
 $('#active-count').textContent=current.filter(t=>!t.done).length||'';$('#done-count').textContent=current.filter(t=>t.done).length||'';
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view);});
 $('#advanced-switch').checked=state.settings.advanced;$('#haptic-switch').checked=state.settings.haptics;$('#keep-switch').checked=state.settings.keep;
 document.querySelectorAll('[data-layout]').forEach(b=>{b.classList.toggle('selected',b.dataset.layout===state.settings.subtaskLayout);b.setAttribute('aria-pressed',b.dataset.layout===state.settings.subtaskLayout);});
 const tasks=alphabeticalTasks(current.filter(t=>taskMatches(t)&&(view==='done'?t.done:state.settings.keep||!t.done)));
 const finished=current.filter(t=>t.done).length;
 $('#clear-finished').hidden=finished===0;$('#clear-finished').disabled=clearingFinished;$('#clear-finished-count').textContent=finished;$('#clear-finished').setAttribute('aria-label','Clear '+finished+' finished tasks from '+(area==='work'?'Work':'Home'));
 const list=$('#task-list');list.replaceChildren();
 const groups=[{id:'',name:'Ungrouped',area},...state.groups.filter(g=>g.area===area)];
 for(const g of groups){const members=tasks.filter(t=>t.group===g.id);if(query&&!members.length)continue;if(view==='done'&&!members.length)continue;
  const zone=el('section','dropzone'+(!g.id&&!members.length?' empty-ungrouped':''));zone.dataset.dropGroup=g.id;zone.dataset.dropArea=area;zone.setAttribute('aria-label',g.name+' tasks');
  if(g.id){const head=el('div','group-heading');const name=el('button','group-name',g.name);name.setAttribute('aria-label','Edit group '+g.name);name.onclick=()=>groupDialog(g.id);const count=el('span','group-count',members.filter(t=>!t.done).length||'');const add=el('button','group-add','+');add.setAttribute('aria-label','Add task to '+g.name);add.onclick=()=>selectGroup(g.id);head.append(name,count,add);zone.append(head);}
  else if(state.groups.some(g=>g.area===area)){const label=el('div','ungrouped-label','Ungrouped');zone.append(label);}
  for(const t of members)zone.append(taskRow(t));
  if(!members.length){const hint=el('button','drop-empty',g.id?'Add a task or drop one here':'Drop here to ungroup');hint.onclick=()=>selectGroup(g.id);zone.append(hint);}
  // Keep an ungrouped drop target even when the page has no tasks yet.
  list.append(zone);
 }
 const active=current.filter(t=>!t.done).length;
 $('#empty-note').textContent=tasks.length?'':query?'Nothing matches that search.':view==='done'?'Finished tasks will be here.':active===0&&current.length?'All done. Take a breath.':'Start with one small thing.';
 if(!current.length&&!state.groups.some(g=>g.area===area)&&!query&&view==='all')list.querySelector('.drop-empty')?.classList.add('invisible');
 $('#add-form').hidden=view==='done';$('#add-form').style.display=view==='done'?'none':'';
 const g=state.groups.find(g=>g.id===newGroup&&g.area===area);if(!g)newGroup='';
 $('#quick-add').placeholder=g?'Add to '+g.name+'…':'Add a task…';
 $('#save-status').textContent=storageOkay?syncMessage:'Not saved · export a backup';
}
function taskRow(t){
 const row=el('article','task'+(t.done?' done':''));row.dataset.id=t.id;row.dataset.dropRow=t.id;
 const grip=el('button','drag-handle');grip.append(icon('grip'));grip.setAttribute('aria-label','Move '+t.title);grip.title='Drag to another group · tasks stay A–Z';grip.onclick=()=>{if(performance.now()<suppressClickUntil)return;editTask(t.id,true);};
 const check=el('button','check');check.setAttribute('aria-label',(t.done?'Restore ':'Complete ')+t.title);check.setAttribute('aria-pressed',t.done);check.append(icon('check'));check.onclick=()=>finishTask(t.id);
 const content=el('div','task-content'),line=el('div','task-line');
 const title=el('button','task-title',t.title);title.setAttribute('aria-label','Edit '+t.title);title.onclick=()=>{if(performance.now()>=suppressClickUntil)editTask(t.id);};line.append(title);
 const subs=el('div','subtasks '+state.settings.subtaskLayout);subs.setAttribute('aria-label','Subtasks for '+t.title);
 for(const s of t.subtasks){const chip=el('button','subtask'+(s.done?' done':''),s.title);chip.setAttribute('aria-label',(s.done?'Restore subtask ':'Complete subtask ')+s.title);chip.setAttribute('aria-pressed',s.done);chip.title=s.title;chip.onclick=()=>{snapshot();s.done=!s.done;commit();toast(s.done?'Small step, done.':'Subtask restored.');};subs.append(chip);}
 line.append(subs);
 const add=el('button','add-subtask','+');add.setAttribute('aria-label','Add subtask to '+t.title);add.title='Add a small step';add.onclick=()=>{inlineTask=inlineTask===t.id?null:t.id;render();document.querySelector('.subtask-entry input')?.focus();};line.append(add);content.append(line);
 if(state.settings.advanced){const meta=el('div','meta');if(t.due){const d=new Date(t.due+'T12:00:00');meta.append(el('span',!t.done&&t.due<today()?'overdue':'',t.due===today()?'Today':d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})));}if(t.effort)meta.append(el('span','',t.effort==='120'?'2h+':t.effort+'m'));for(const tag of t.tags)meta.append(el('span','','#'+tag));if(t.status==='waiting')meta.append(el('span','','Waiting'));if(t.repeat)meta.append(el('span','','Repeats '+t.repeat));if(t.link){const a=el('a','','Open link ↗');a.href=t.link;a.target='_blank';a.rel='noopener noreferrer';meta.append(a);}if(meta.children.length)content.append(meta);}
 if(inlineTask===t.id){const f=el('form','subtask-entry');const input=el('input');input.placeholder='A small step…';input.maxLength=500;input.setAttribute('aria-label','Subtask for '+t.title);const submit=el('button','icon-btn','+');submit.type='submit';submit.setAttribute('aria-label','Save subtask');const close=el('button','icon-btn','×');close.type='button';close.setAttribute('aria-label','Close subtask entry');close.onclick=()=>{inlineTask=null;render();};f.append(input,submit,close);f.onsubmit=e=>{e.preventDefault();const value=input.value.trim();if(!value)return;snapshot();t.subtasks.push({id:uid(),title:value,done:false});commit();document.querySelector('.subtask-entry input')?.focus();};input.onkeydown=e=>{if(e.key==='Escape'){inlineTask=null;render();}};content.append(f);}
 const p=el('button','priority p'+t.priority,String(t.priority));p.setAttribute('aria-label','Priority '+t.priority+' for '+t.title+'. Tap to increase');p.onclick=()=>{snapshot();t.priority=t.priority%3+1;commit();};
 row.append(grip,check,content,p);row.addEventListener('pointerdown',e=>startDrag(e,t,row));return row;
}
function finishTask(id){snapshot();const t=completeTask(state,id);if(!t)return;save();if(state.settings.haptics&&t.done)navigator.vibrate?.([10,20,8]);const row=document.querySelector('[data-id="'+id+'"]');if(row){row.classList.toggle('done',t.done);row.classList.toggle('just-done',t.done);const check=row.querySelector('.check');check.setAttribute('aria-pressed',t.done);check.setAttribute('aria-label',(t.done?'Restore ':'Complete ')+t.title);}toast(t.done?'One less thing.':'Back on the list.');clearTimeout(finishRenderTimer);finishRenderTimer=setTimeout(render,360);}

async function clearFinished(){
 if(clearingFinished)return;clearTimeout(finishRenderTimer);
 const clearedArea=area,removed=clearFinishedTasks(state,clearedArea);if(!removed.length)return;
 if(!save()){restoreFinishedTasks(state,removed);render();return;}
 undoState=null;
 const restore=()=>{restoreFinishedTasks(state,removed);area=clearedArea;commit();};
 undoAction=restore;clearingFinished=true;$('#clear-finished').disabled=true;
 clearTimeout(toastTimer);$('#toast').hidden=true;
 const ids=new Set(removed.map(x=>x.task.id));
 const rows=[...document.querySelectorAll('.task')].filter(row=>ids.has(row.dataset.id));
 const list=$('#task-list');list.inert=true;
 try{
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   await Promise.all(rows.map(async(row,i)=>{
    const height=row.getBoundingClientRect().height,style=getComputedStyle(row),delay=Math.min(i*45,225);
    row.inert=true;row.style.setProperty('--wipe-delay',delay+'ms');row.classList.add('clearing-finished');
    const wipe=row.animate([{clipPath:'inset(0 0 0 0)',opacity:1},{clipPath:'inset(0 0 0 100%)',opacity:0}],{duration:340,delay,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
    const collapse=row.animate([{height:height+'px',minHeight:height+'px',paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,borderBottomWidth:style.borderBottomWidth},{height:'0px',minHeight:'0px',paddingTop:'0px',paddingBottom:'0px',borderBottomWidth:'0px'}],{duration:180,delay:delay+300,easing:'ease-in-out',fill:'forwards'});
    await Promise.all([wipe.finished.catch(()=>{}),collapse.finished.catch(()=>{})]);
   }));
  }
 }finally{list.inert=false;clearingFinished=false;render();if(undoAction===restore)toast(removed.length+' finished '+(removed.length===1?'task':'tasks')+' cleared.');}
}
$('#clear-finished').onclick=clearFinished;

function parseLine(line){let priority=newPriority,tags=[],due='',effort='';line=line.trim().replace(/^[-*]\s+|^\[ \]\s*/,'');line=line.replace(/(?:^|\s)!([123])(?=\s|$)/g,(_,n)=>{priority=+n;return ' ';});if(state.settings.advanced){line=line.replace(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu,(_,tag)=>{tags.push(tag);return ' ';});line=line.replace(/(?:^|\s)@(\d{4}-\d{2}-\d{2})(?=\s|$)/g,(_,d)=>{if(validDate(d)){due=d;return ' ';}return _;});line=line.replace(/(?:^|\s)~(5|15|30|60|120)(?=\s|$)/g,(_,n)=>{effort=n;return ' ';});}return {title:line.replace(/\s+/g,' ').trim(),priority,tags,due,effort};}
function addLines(value){const tasks=value.split(/\r?\n/).map(parseLine).filter(t=>t.title);if(!tasks.length)return;snapshot();for(const t of tasks)state.tasks.push(makeTask(t.title,area,newGroup,t));view='all';query='';$('#search').value='';commit();$('#quick-add').value='';$('#quick-add').style.height='';$('#quick-add').focus();if(tasks.length>1)toast(tasks.length+' tasks added.');}
$('#add-form').onsubmit=e=>{e.preventDefault();addLines($('#quick-add').value);};$('#quick-add').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();addLines(e.target.value);}};$('#quick-add').oninput=e=>{e.target.style.height='auto';e.target.style.height=Math.min(160,e.target.scrollHeight)+'px';};$('#quick-add').addEventListener('paste',e=>{const s=e.clipboardData.getData('text');if(s.includes('\n')&&!e.target.value){e.preventDefault();addLines(s);}});
$('#add-priority').onclick=()=>{newPriority=newPriority%3+1;const b=$('#add-priority');b.textContent=newPriority;b.className='priority p'+newPriority;b.setAttribute('aria-label','New task priority '+newPriority+'. Tap to increase');};
function selectGroup(id){newGroup=id;view='all';render();$('#quick-add').focus();$('#quick-add').scrollIntoView({block:'nearest',behavior:'smooth'});}
function groupDialog(id=null){renamingGroup=id;const g=state.groups.find(g=>g.id===id);$('#group-name').value=g?.name||'';$('#group-dialog-title').textContent=g?'Edit group':'New group';$('#group-hint').textContent='In your '+(area==='work'?'Work':'Home')+' list.';$('#ungroup-tasks').hidden=!g;openDialog('#group-dialog');setTimeout(()=>$('#group-name').focus(),0);}
$('#new-group').onclick=()=>groupDialog();$('#group-form').onsubmit=e=>{e.preventDefault();const name=$('#group-name').value.trim();if(!name)return;snapshot();const g=state.groups.find(g=>g.id===renamingGroup);if(g){const existing=state.groups.find(x=>x.id!==g.id&&x.area===g.area&&x.name===name);if(existing){state.tasks.filter(t=>t.group===g.id).forEach(t=>t.group=existing.id);state.groups=state.groups.filter(x=>x.id!==g.id);newGroup=existing.id;}else{g.name=name;newGroup=g.id;}}else newGroup=ensureGroup(state,name,area);closeDialog($('#group-dialog'));commit();$('#quick-add').focus();toast('Group saved.');};
$('#ungroup-tasks').onclick=()=>{snapshot();state.tasks.filter(t=>t.group===renamingGroup).forEach(t=>t.group='');state.groups=state.groups.filter(g=>g.id!==renamingGroup);if(newGroup===renamingGroup)newGroup='';closeDialog($('#group-dialog'));commit();toast('Group removed. Tasks kept.');};
function fillGroups(selected=''){const select=$('#edit-group');select.replaceChildren();const none=el('option','','Ungrouped');none.value='';select.append(none);for(const g of state.groups.filter(g=>g.area===$('#edit-area').value)){const o=el('option','',g.name);o.value=g.id;select.append(o);}select.value=selected;}
$('#edit-area').onchange=()=>fillGroups();
function editTask(id,moving=false){const t=state.tasks.find(t=>t.id===id);if(!t)return;editing=id;editPriority=t.priority;editSubtasks=structuredClone(t.subtasks);for(const k of ['title','area','due','effort','link','notes','repeat','status'])$('#edit-'+k).value=t[k]||'';$('#edit-tags').value=t.tags.join(', ');$('#edit-new-subtask').value='';fillGroups(t.group);renderPriority();renderEditSubtasks();openDialog('#editor');if(moving)setTimeout(()=>$('#edit-area').focus(),0);}
function renderPriority(){document.querySelectorAll('[data-p]').forEach(b=>{b.classList.toggle('selected',+b.dataset.p===editPriority);b.setAttribute('aria-pressed',+b.dataset.p===editPriority);});}
document.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{editPriority=+b.dataset.p;renderPriority();});
function renderEditSubtasks(){const box=$('#edit-subtasks');box.replaceChildren();for(const s of editSubtasks){const row=el('div','edit-sub-row');const c=el('input');c.type='checkbox';c.checked=s.done;c.setAttribute('aria-label','Subtask complete: '+s.title);c.onchange=()=>s.done=c.checked;const input=el('input');input.value=s.title;input.maxLength=500;input.setAttribute('aria-label','Edit subtask '+s.title);input.oninput=()=>s.title=input.value;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#edit-new-subtask').focus();}};const del=el('button','icon-btn','×');del.type='button';del.setAttribute('aria-label','Remove subtask '+s.title);del.onclick=()=>{editSubtasks=editSubtasks.filter(x=>x.id!==s.id);renderEditSubtasks();};row.append(c,input,del);box.append(row);}}
function addEditSubtask(){const value=$('#edit-new-subtask').value.trim();if(!value)return;editSubtasks.push({id:uid(),title:value,done:false});$('#edit-new-subtask').value='';renderEditSubtasks();$('#edit-new-subtask').focus();}
$('#edit-add-subtask').onclick=addEditSubtask;$('#edit-new-subtask').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addEditSubtask();}};
$('#edit-form').onsubmit=e=>{e.preventDefault();const t=state.tasks.find(t=>t.id===editing),title=$('#edit-title').value.trim();if(!t||!title)return;addEditSubtask();snapshot();t.title=title;t.priority=editPriority;t.area=$('#edit-area').value;t.group=$('#edit-group').value;t.subtasks=editSubtasks.filter(s=>s.title.trim()).map(s=>({...s,title:s.title.trim()}));if(state.settings.advanced){for(const k of ['due','effort','notes','repeat','status'])t[k]=$('#edit-'+k).value.trim();t.link=safeUrl($('#edit-link').value);t.tags=[...new Set($('#edit-tags').value.split(/[,#\s]+/).filter(Boolean))];}area=t.area;closeDialog($('#editor'));commit();};
$('#delete-task').onclick=()=>{snapshot();state.tasks=state.tasks.filter(t=>t.id!==editing);closeDialog($('#editor'));commit();toast('Task removed.');};
// Dragging changes groups or lists; alphabetical task order is retained.
function startDrag(e,t,row){if(e.button!==0||document.querySelector('dialog[open]'))return;const handle=e.target.closest('.drag-handle'),title=e.target.closest('.task-title');if(!handle&&!(title&&e.pointerType==='mouse'))return;drag={id:t.id,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,pointer:e.pointerId,active:false,row,handle:e.target,raf:0,target:null};if(handle){e.preventDefault();handle.setPointerCapture?.(e.pointerId);}document.addEventListener('pointermove',dragMove,{passive:false});document.addEventListener('pointerup',dragEnd);document.addEventListener('pointercancel',dragCancel);}
function dragMove(e){if(!drag||e.pointerId!==drag.pointer)return;drag.x=e.clientX;drag.y=e.clientY;if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<6)return;e.preventDefault();if(!drag.active){drag.active=true;document.body.classList.add('drag-active');drag.row.classList.add('dragging');const ghost=el('div','drag-ghost',state.tasks.find(t=>t.id===drag.id).title);document.body.append(ghost);drag.ghost=ghost;$('#drag-announcement').textContent='Drag to a group, Work or Home. Tasks stay alphabetical.';drag.raf=requestAnimationFrame(dragScroll);}drag.ghost.style.left=(e.clientX+12)+'px';drag.ghost.style.top=(e.clientY+12)+'px';findDrop();}
function clearDrop(){document.querySelectorAll('.drop-over,.drop-before,.drop-after').forEach(e=>e.classList.remove('drop-over','drop-before','drop-after'));}
function findDrop(){clearDrop();if(!drag?.active)return;const target=document.elementFromPoint(drag.x,drag.y);const areaTab=target?.closest('.area-tab');if(areaTab){drag.target={area:areaTab.dataset.dropArea,group:'',tab:true};areaTab.classList.add('drop-over');return;}const zone=target?.closest('.dropzone');if(!zone){drag.target=null;return;}zone.classList.add('drop-over');drag.target={area:zone.dataset.dropArea,group:zone.dataset.dropGroup,tab:false};}
function dragScroll(){if(!drag?.active)return;const edge=70;let delta=0;if(drag.y>innerHeight-edge)delta=Math.min(14,(drag.y-(innerHeight-edge))/4);else if(drag.y<edge)delta=-Math.min(14,(edge-drag.y)/4);if(delta){window.scrollBy(0,delta);findDrop();}drag.raf=requestAnimationFrame(dragScroll);}
function dragEnd(e){if(!drag||e.pointerId!==drag.pointer)return;const d=drag;if(d.active){suppressClickUntil=performance.now()+400;if(d.target){snapshot();const moved=moveTask(state,d.id,d.target.area,d.target.group);if(moved){if(d.target.tab)area=d.target.area;inlineTask=null;save();const g=state.groups.find(g=>g.id===d.target.group);toast('Moved to '+(g?.name||(d.target.area==='work'?'Work':'Home'))+'.');}}}cleanupDrag();if(d.active)render();}
function cleanupDrag(){if(!drag)return;cancelAnimationFrame(drag.raf);drag.ghost?.remove();drag.row.classList.remove('dragging');clearDrop();drag=null;document.body.classList.remove('drag-active');document.removeEventListener('pointermove',dragMove);document.removeEventListener('pointerup',dragEnd);document.removeEventListener('pointercancel',dragCancel);}
function dragCancel(){cleanupDrag();render();}
document.addEventListener('click',e=>{if(performance.now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('blur',()=>{if(drag)dragCancel();});
document.querySelectorAll('[data-area]').forEach(b=>b.onclick=()=>{area=b.dataset.area;newGroup='';query='';$('#search').value='';inlineTask=null;commit();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;inlineTask=null;render();});
$('#search-toggle').onclick=()=>{$('#search-panel').hidden=!$('#search-panel').hidden;if(!$('#search-panel').hidden)$('#search').focus();else{query='';$('#search').value='';render();}};$('#search').oninput=e=>{query=e.target.value;render();};
$('#advanced-switch').onchange=e=>{state.settings.advanced=e.target.checked;commit();};$('#haptic-switch').onchange=e=>{state.settings.haptics=e.target.checked;save();};$('#keep-switch').onchange=e=>{state.settings.keep=e.target.checked;commit();};document.querySelectorAll('[data-layout]').forEach(b=>b.onclick=()=>{state.settings.subtaskLayout=b.dataset.layout;commit();});
$('#settings').onclick=()=>{$('#storage-info').textContent='Notebook size: '+(new Blob([JSON.stringify(state)]).size/1024).toFixed(1)+' KB';openDialog('#settings-dialog');};$('#help').onclick=()=>openDialog('#help-dialog');
$('#export').onclick=()=>{const a=el('a'),value=canWrite?JSON.stringify(state,null,2):(localStorage.getItem(KEY)||'{}'),url=URL.createObjectURL(new Blob([value],{type:'application/json'}));a.href=url;a.download='margin-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('Backup downloaded.',false);};$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20*1024*1024)throw Error('Choose a backup smaller than 20 MB.');const incoming=normalise(JSON.parse(await f.text()));snapshot();if(!canWrite){localStorage.setItem('margin.notebook.unreadable-backup',localStorage.getItem(KEY)||'');canWrite=true;}const added=mergeBackup(state,incoming);commit();toast(added+' tasks imported. Existing tasks kept.');}catch(e){toast(e.message||'Could not read that file.',false);}e.target.value='';};
$('#load-demo').onclick=()=>{snapshot();const g=ensureGroup(state,'This week','work');const t=makeTask('Get the first draft ready','work',g,{priority:3});t.subtasks=[{id:uid(),title:'Outline',done:true},{id:uid(),title:'Write',done:false},{id:uid(),title:'Review',done:false}];state.tasks.push(t,makeTask('Send the follow-up','work','',{priority:2}),makeTask('A little time outside','home','',{priority:1}));area='work';commit();closeDialog($('#settings-dialog'));toast('Example tasks added.');};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});async function install(){if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else{const d=document.querySelector('dialog[open]');if(d)closeDialog(d);setTimeout(()=>openDialog('#help-dialog'),100);}}$('#install').onclick=install;$('#install-settings').onclick=install;
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){dragCancel();return;}if(e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key.toLowerCase()==='n'){e.preventDefault();view='all';render();$('#quick-add').focus();}if(e.key==='/'){e.preventDefault();$('#search-panel').hidden=false;$('#search').focus();}});
// Outlook: delegated, read-only import via OAuth authorization code + PKCE.
const redirect=location.origin+location.pathname;
$('#redirect-uri').textContent=redirect;
const msConfig=()=>{try{return JSON.parse(localStorage.getItem('margin.ms.config')||'{}');}catch{return {};}};
$('#ms-client').value=msConfig().client||'';$('#ms-tenant').value=msConfig().tenant||'';
$('#outlook').onclick=()=>openDialog('#outlook-dialog');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
$('#ms-connect').onclick=async()=>{if(accessToken){await importEmails();return;}const client=$('#ms-client').value.trim(),tenant=$('#ms-tenant').value.trim();if(!uuid.test(client)||!uuid.test(tenant)){$('#ms-status').textContent='Enter valid application and directory IDs from your IT team.';return;}try{const verifier=base64url(crypto.getRandomValues(new Uint8Array(32))),nonce=uid();const challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));sessionStorage.setItem('margin.ms.pkce',JSON.stringify({verifier,nonce,client,tenant,redirect}));localStorage.setItem('margin.ms.config',JSON.stringify({client,tenant}));const u=new URL('https://login.microsoftonline.com/'+tenant+'/oauth2/v2.0/authorize');u.search=new URLSearchParams({client_id:client,response_type:'code',redirect_uri:redirect,response_mode:'query',scope:'https://graph.microsoft.com/Mail.ReadBasic',state:nonce,code_challenge:challenge,code_challenge_method:'S256'});location.assign(u);}catch{$('#ms-status').textContent='Sign-in could not start. Check browser storage is enabled.';}};
$('#ms-disconnect').onclick=()=>{accessToken=null;sessionStorage.removeItem('margin.ms.pkce');localStorage.removeItem('margin.ms.config');$('#ms-client').value='';$('#ms-tenant').value='';$('#ms-status').textContent='Disconnected. Imported tasks remain in your notebook.';};
async function importEmails(){const btn=$('#ms-connect');btn.disabled=true;$('#ms-status').textContent='Reading flagged email subjects…';try{let next="https://graph.microsoft.com/v1.0/me/messages?$filter=flag/flagStatus%20eq%20'flagged'&$select=id,subject,webLink,flag&$top=100";const messages=[];while(next){if(!next.startsWith('https://graph.microsoft.com/'))throw Error('Unexpected response link.');const r=await fetch(next,{headers:{Authorization:'Bearer '+accessToken,Prefer:'IdType="ImmutableId"'}});if(!r.ok)throw Error(r.status===401?'Your sign-in expired. Disconnect and sign in again.':'Microsoft could not provide flagged mail ('+r.status+'). Your organisation may restrict access.');const data=await r.json();messages.push(...data.value);next=data['@odata.nextLink'];if(messages.length>=2000)break;}snapshot();let added=0;const known=new Set(state.tasks.map(t=>t.emailId).filter(Boolean));for(const m of messages){if(known.has(m.id))continue;state.tasks.push({id:uid(),title:(m.subject||'(No subject)').slice(0,2000),priority:2,done:false,created:new Date().toISOString(),area:'work',group:ensureGroup(state,'Flagged email','work'),subtasks:[],tags:['email'],due:m.flag?.dueDateTime?.dateTime?.slice(0,10)||'',effort:'',link:safeUrl(m.webLink),notes:'',repeat:'',status:'open',emailId:m.id});known.add(m.id);added++;}area='work';state.settings.advanced=true;commit();$('#ms-status').textContent=added+' emails imported. Re-import skips emails already on your page.';toast(added+' flagged emails added.');}catch(e){$('#ms-status').textContent=e.message;}finally{btn.disabled=false;}}
async function oauthCallback(){const params=new URLSearchParams(location.search);if(!params.has('code')&&!params.has('error'))return;let pkce;try{pkce=JSON.parse(sessionStorage.getItem('margin.ms.pkce')||'null');}catch{}history.replaceState({},'',redirect);state.settings.advanced=true;render();openDialog('#outlook-dialog');if(!pkce||params.get('state')!==pkce.nonce){$('#ms-status').textContent='Sign-in could not be verified. Start again from this device.';return;}sessionStorage.removeItem('margin.ms.pkce');if(params.has('error')){$('#ms-status').textContent='Microsoft sign-in was cancelled or access was declined. Your IT team may need to approve the application.';return;}try{const r=await fetch('https://login.microsoftonline.com/'+pkce.tenant+'/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:pkce.client,grant_type:'authorization_code',code:params.get('code'),redirect_uri:pkce.redirect,code_verifier:pkce.verifier,scope:'https://graph.microsoft.com/Mail.ReadBasic'})});const token=await r.json();if(!r.ok||!token.access_token)throw Error('Microsoft sign-in could not finish. Check the SPA redirect URI and your work permissions.');accessToken=token.access_token;await importEmails();}catch(e){$('#ms-status').textContent=e.message;}}

window.addEventListener('storage',event=>{if(event.key!==KEY||!event.newValue)return;try{state=normalise(JSON.parse(event.newValue));render();}catch{toast('Another tab saved unreadable data. Export a backup.',false);}});

sync=createSync({
 getState:()=>normalise(JSON.parse(localStorage.getItem(KEY)||JSON.stringify(state))),
 applyData:data=>{
  const incoming=normalise({...data,version:2,settings:state.settings});
  state=incoming;syncApplying=true;
  try{if(!save())throw Error('Sync paused: this device could not save. Export a backup.');}finally{syncApplying=false;}
  render();
 },
 isBusy:()=>!canWrite||!storageOkay||!!document.querySelector('#editor[open],#group-dialog[open]')||!!drag?.active||clearingFinished||!!inlineTask||(!$('#toast').hidden&&!!(undoState||undoAction)),
 onStatus:message=>{
  syncMessage=message;if(storageOkay)$('#save-status').textContent=message;
  $('#sync-status').textContent=message;
  const connected=!!sync?.getConfig();
  $('#sync-disconnect').hidden=!connected;$('#sync-now').hidden=!connected;
 },
 onConflict:conflicts=>{
  $('#sync-conflict').hidden=!conflicts.length;
  $('#sync-conflict-text').textContent=conflicts.length
   ?'Changed on both devices: '+conflicts.slice(0,3).map(c=>c.title).join(', ')+(conflicts.length>3?' and '+(conflicts.length-3)+' more.':'.')+' Choose which conflicting edits to keep; other changes are merged.'
   :'';
 }
});
const syncConfig=sync.getConfig();
if(syncConfig){$('#sync-url').value=syncConfig.url;$('#sync-key').value=syncConfig.key;$('#sync-disconnect').hidden=false;$('#sync-now').hidden=false;}
$('#sync-connect').onclick=()=>{
 try{
  sync.connect({url:$('#sync-url').value,key:$('#sync-key').value});
  $('#sync-disconnect').hidden=false;$('#sync-now').hidden=false;
 }catch(error){$('#sync-status').textContent=error.message;}
};
$('#sync-now').onclick=()=>sync.syncNow();
$('#sync-disconnect').onclick=()=>{
 sync.disconnect();$('#sync-key').value='';$('#sync-disconnect').hidden=true;$('#sync-now').hidden=true;
 $('#sync-status').textContent='Disconnected. Tasks remain on this device and in Cloudflare.';
};
$('#sync-generate').onclick=()=>{
 $('#sync-key').value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 $('#sync-key').type='text';$('#sync-show').textContent='Hide key';
 $('#sync-status').textContent='Save this key in your password manager and as Cloudflare’s SYNC_KEY secret. Use the same key on each device.';
};
$('#sync-show').onclick=()=>{const input=$('#sync-key');input.type=input.type==='password'?'text':'password';$('#sync-show').textContent=input.type==='password'?'Show key':'Hide key';};
$('#sync-keep-local').onclick=()=>sync.resolve('local');
$('#sync-keep-cloud').onclick=()=>sync.resolve('cloud');

render();oauthCallback();
if('serviceWorker'in navigator&&!['localhost','127.0.0.1'].includes(location.hostname)){const controlled=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)location.reload();});navigator.serviceWorker.register('./sw.js').then(r=>r.update()).catch(()=>{});}
if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});

