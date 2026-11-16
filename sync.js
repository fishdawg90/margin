import {same,snapshotData,mergeNotebooks} from './sync-core.js?v=3';
const CONFIG='margin.sync.config.v1',CHECKPOINT='margin.sync.checkpoint.v1';
const empty=()=>({version:1,tasks:[],groups:[]});
export function createSync({getState,applyData,isBusy,onStatus,onConflict}){
 let config=null,timer,running=false,generation=0,pending=null,preference='',conflicted=false;
 try{config=validateConfig(JSON.parse(localStorage.getItem(CONFIG)||'null'));}catch{}
 function status(text){onStatus(text);}
 function queue(delay=1000){clearTimeout(timer);timer=setTimeout(run,delay);}
 function checkpoint(){try{const c=JSON.parse(localStorage.getItem(CHECKPOINT)||'null');return c?.url===config.url&&c.data?.version===1?c.data:empty();}catch{return empty();}}
 function remember(data){localStorage.setItem(CHECKPOINT,JSON.stringify({url:config.url,data}));}
 async function request(method,body,active){
  const response=await fetch(active.url+'/notebook',{method,cache:'no-store',credentials:'omit',
   headers:{Authorization:'Bearer '+active.key,...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(response.status===409)return null;
  if(!response.ok)throw Error(response.status===401?'Sync key was not accepted. Check Settings.':response.status===503?'Cloudflare setup is incomplete.':response.status===413?'Notebook exceeds the sync size limit.':'Sync unavailable ('+response.status+').');
  const text=await response.text();if(text.length>2100000)throw Error('Cloud notebook is too large.');
  const result=JSON.parse(text);
  if(!Number.isSafeInteger(result.revision)||result.data?.version!==1||!Array.isArray(result.data.tasks)||!Array.isArray(result.data.groups))throw Error('Unexpected sync response.');
  return result;
 }
 function finishPending(){
  if(!pending)return true;if(isBusy())return false;
  const {captured,data}=pending;
  // Edits made while the network request was running remain on this device.
  const next=mergeNotebooks(captured,snapshotData(getState()),data,'local').data;
  if(!same(next,snapshotData(getState())))applyData(next);
  remember(data);pending=null;return true;
 }
 async function run(){
  clearTimeout(timer);timer=null;if(!config){status('Saved on this device');return;}
  if(running)return;
  if(!navigator.onLine){status('Offline · saved on this device');queue(15000);return;}
  if(isBusy()){queue(1500);return;}
  if(!navigator.locks){status('Sync needs a browser with Web Locks support.');return;}
  if(conflicted&&!preference){status('Sync needs a choice · open Settings');return;}
  running=true;const active=config,epoch=generation;
  try{
   await navigator.locks.request('margin-notebook-sync-v1',{ifAvailable:true},async lock=>{
    if(!lock)return;
    if(epoch!==generation)return;
    if(!finishPending()){queue(1500);return;}
    status('Syncing…');
    const remote=await request('GET',null,active);
    if(epoch!==generation)return;
    if(isBusy()){queue(1500);return;}
    const captured=snapshotData(getState()),base=checkpoint();
    const merged=mergeNotebooks(base,captured,remote.data,preference);
    if(merged.conflicts.length&&!preference){conflicted=true;status('Sync needs a choice · open Settings');onConflict(merged.conflicts);return;}
    const chosen=merged.data;
    let accepted=remote;
    if(!same(chosen,remote.data)){
     accepted=await request('PUT',{revision:remote.revision,data:chosen},active);
     if(epoch!==generation)return;
     if(!accepted){queue(1000);return;}
    }
    if(epoch!==generation)return;
    preference='';conflicted=false;onConflict([]);
    pending={captured,data:accepted.data};
    if(!finishPending()){status('Syncing…');queue(1500);return;}
    status(same(snapshotData(getState()),accepted.data)?'Synced':'Changes saved · syncing soon');
   });
  }catch(error){
   if(epoch===generation)status(navigator.onLine?(error.name==='TimeoutError'?'Sync timed out · saved on this device':error.message):'Offline · saved on this device');
  }finally{running=false;if(config&&!timer)queue(15000);}
 }
 function notify(){if(config){status('Saved on this device · syncing soon');queue(1000);}}
 function connect(value){const next=validateConfig(value);localStorage.setItem(CONFIG,JSON.stringify(next));generation++;config=next;pending=null;conflicted=false;preference='';onConflict([]);status('Connecting…');queue(0);}
 function disconnect(){generation++;config=null;pending=null;conflicted=false;preference='';clearTimeout(timer);timer=null;localStorage.removeItem(CONFIG);onConflict([]);status('Saved on this device');}
 function resolve(choice){if(!['local','cloud'].includes(choice))return;preference=choice;conflicted=false;queue(0);}
 function syncNow(){if(conflicted){status('Sync needs a choice · open Settings');return;}queue(0);}
 window.addEventListener('online',()=>queue(0));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&config)queue(0);});
 window.addEventListener('storage',event=>{if(event.key===CONFIG){generation++;pending=null;conflicted=false;preference='';try{config=validateConfig(JSON.parse(event.newValue));}catch{config=null;}onConflict([]);queue(0);}});
 if(config)queue(500);else status('Saved on this device');
 return {notify,connect,disconnect,resolve,syncNow,flush:run,getConfig:()=>config?{...config}:null};
}
export function validateConfig(value){
 if(!value||typeof value.url!=='string'||typeof value.key!=='string')throw Error('Enter your Worker address and private sync key.');
 const url=new URL(value.url.trim());
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Enter the HTTPS workers.dev address, with no path.');
 const key=value.key.trim();if(!/^[A-Za-z0-9_-]{32,128}$/.test(key))throw Error('Use a random sync key of 32–128 letters, numbers, hyphens or underscores.');
 return {url:url.origin,key};
}
