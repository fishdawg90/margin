export function clone(value){return JSON.parse(JSON.stringify(value));}

export function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

export function snapshotData(state){return {version:1,tasks:clone(state.tasks),groups:clone(state.groups)};}

export function mergeRecords(base,local,remote,kind,conflicts,preference){
 const b=new Map(base.map(x=>[x.id,x])),l=new Map(local.map(x=>[x.id,x])),r=new Map(remote.map(x=>[x.id,x])),out=[];
 for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])){
  const before=b.get(id),mine=l.get(id),cloud=r.get(id);let chosen;
  if(same(mine,before))chosen=cloud;else if(same(cloud,before)||same(mine,cloud))chosen=mine;
  else {conflicts.push({kind,id,title:mine?.title||cloud?.title||mine?.name||cloud?.name||id});chosen=preference==='cloud'?cloud:mine;}
  if(chosen)out.push(clone(chosen));
 }
 return out;
}

export function mergeNotebooks(base,local,remote,preference=''){
 const conflicts=[];
 const groups=mergeRecords(base.groups,local.groups,remote.groups,'group',conflicts,preference);
 const tasks=mergeRecords(base.tasks,local.tasks,remote.tasks,'task',conflicts,preference);
 const groupMap=new Map(groups.map(g=>[g.id,g]));
 for(const task of tasks){const group=groupMap.get(task.group);if(!group)task.group='';else task.area=group.area;}
 return {data:{version:1,tasks,groups},conflicts};
}
