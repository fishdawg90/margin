export const KEY='margin.notebook.v1';
export const uid=()=>crypto.randomUUID();
export const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export const today=()=>localDate(new Date());
export function safeUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
export function validDate(d){return typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;}
export function blank(){return {version:2,tasks:[],groups:[],settings:{advanced:false,haptics:true,keep:true,subtaskLayout:'bubbles',activeArea:'work'}};}
export function ensureGroup(state,name,area='work'){name=name.trim().slice(0,100);if(!name)return '';let g=state.groups.find(g=>g.name===name&&g.area===area);if(!g){g={id:uid(),name,area};state.groups.push(g);}return g.id;}
export function normalise(input){
 if(!input||![1,2].includes(input.version)||!Array.isArray(input.tasks)||input.tasks.length>20000)throw Error('Choose a Margin backup file.');
 const state=blank(),ids=new Set(),legacy=input.version===1;
 state.settings={advanced:!!input.settings?.advanced,haptics:input.settings?.haptics!==false,keep:input.settings?.keep!==false,subtaskLayout:input.settings?.subtaskLayout==='stacked'?'stacked':'bubbles',activeArea:input.settings?.activeArea==='home'?'home':'work'};
 if(!legacy&&Array.isArray(input.groups))for(const g of input.groups){if(g&&typeof g.id==='string'&&typeof g.name==='string'&&!state.groups.some(x=>x.id===g.id))state.groups.push({id:g.id,name:g.name.slice(0,100),area:g.area==='home'?'home':'work'});}
 for(const t of input.tasks){
  if(!t||typeof t.title!=='string'||!t.title.trim()||t.title.length>2000)throw Error('This backup contains an invalid task.');
  let id=typeof t.id==='string'&&/^[\w-]{1,100}$/.test(t.id)?t.id:uid();if(ids.has(id))id=uid();ids.add(id);
  let area=t.area==='home'?'home':'work',group='';
  if(legacy){const name=typeof t.group==='string'?t.group.trim():'';if(/^(home|personal)$/i.test(name))area='home';else if(name&&!/^work$/i.test(name))group=ensureGroup(state,name,area);}
  else{const g=state.groups.find(g=>g.id===t.group);if(g){group=g.id;area=g.area;}}
  const subIds=new Set();const subtasks=Array.isArray(t.subtasks)?t.subtasks.filter(s=>s&&typeof s.title==='string'&&s.title.trim()).slice(0,500).map(s=>{let sid=typeof s.id==='string'&&/^[\w-]{1,100}$/.test(s.id)?s.id:uid();if(subIds.has(sid))sid=uid();subIds.add(sid);return{id:sid,title:s.title.trim().slice(0,500),done:!!s.done};}):[];
  state.tasks.push({id,title:t.title,area,group,priority:[1,2,3].includes(t.priority)?t.priority:1,done:!!t.done,completed:typeof t.completed==='string'?t.completed:'',created:typeof t.created==='string'?t.created:new Date().toISOString(),tags:Array.isArray(t.tags)?t.tags.filter(s=>typeof s==='string').slice(0,50):[],due:validDate(t.due)?t.due:'',effort:['5','15','30','60','120'].includes(String(t.effort))?String(t.effort):'',link:safeUrl(t.link),notes:typeof t.notes==='string'?t.notes.slice(0,10000):'',repeat:['daily','weekly','monthly'].includes(t.repeat)?t.repeat:'',status:t.status==='waiting'?'waiting':'open',emailId:typeof t.emailId==='string'?t.emailId:'',successorId:typeof t.successorId==='string'?t.successorId:'',subtasks});
 }
 // Preserve empty named legacy groups, while Work and Home become the two main lists.
 if(legacy&&Array.isArray(input.groups))for(const name of input.groups)if(typeof name==='string'&&name.trim()&&!/^(work|home|personal)$/i.test(name.trim()))ensureGroup(state,name,'work');
 return state;
}
export function makeTask(title,area='work',group='',extra={}){return {id:uid(),title:title.slice(0,2000),area,group,priority:1,done:false,completed:'',created:new Date().toISOString(),tags:[],due:'',effort:'',link:'',notes:'',repeat:'',status:'open',emailId:'',successorId:'',subtasks:[],...extra};}
export function moveTask(state,id,area,group='',beforeId=null){
 const index=state.tasks.findIndex(t=>t.id===id);if(index<0)return false;
 if(!['work','home'].includes(area))return false;
 if(group&&!state.groups.some(g=>g.id===group&&g.area===area))return false;
 if(beforeId===id)return false;
 const [task]=state.tasks.splice(index,1);task.area=area;task.group=group;
 let insert=beforeId?state.tasks.findIndex(t=>t.id===beforeId):-1;
 if(insert<0){const matching=state.tasks.map((t,i)=>t.area===area&&t.group===group?i:-1).filter(i=>i>=0);insert=matching.length?matching.at(-1)+1:state.tasks.length;}
 state.tasks.splice(insert,0,task);return true;
}
export function nextDate(value,repeat){const d=validDate(value)?new Date(value+'T12:00:00'):new Date();if(repeat==='monthly'){const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+1);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));}else d.setDate(d.getDate()+(repeat==='weekly'?7:1));return localDate(d);}
export function toggleTask(state,id){const t=state.tasks.find(t=>t.id===id);if(!t)return null;t.done=!t.done;t.completed=t.done?new Date().toISOString():'';if(t.done&&t.repeat&&!state.tasks.some(x=>x.id===t.successorId)){t.successorId=uid();state.tasks.push({...t,id:t.successorId,successorId:'',done:false,completed:'',due:nextDate(t.due,t.repeat),created:new Date().toISOString(),emailId:'',subtasks:t.subtasks.map(s=>({...s,id:uid(),done:false}))});}return t;}
export function mergeBackup(state,incoming){const ids=new Set(state.tasks.map(t=>t.id)),groupMap=new Map();for(const g of incoming.groups)groupMap.set(g.id,ensureGroup(state,g.name,g.area));let added=0;for(const t of incoming.tasks)if(!ids.has(t.id)){state.tasks.push({...t,group:groupMap.get(t.group)||''});ids.add(t.id);added++;}return added;}
