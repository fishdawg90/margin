// Margin personal sync. Deploy this file as a separate Cloudflare Worker.
// Bind a D1 database as DB. Add a random SYNC_KEY in Variables and Secrets.
// No task data or credentials belong in GitHub.
const LIMIT=2_000_000;
const ORIGIN='https://fishdawg90.github.io';
const EMPTY={version:1,tasks:[],groups:[]};
const schema='CREATE TABLE IF NOT EXISTS margin_notebook (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, data TEXT NOT NULL)';
export function validNotebook(data){
 if(!data||data.version!==1||!Array.isArray(data.tasks)||!Array.isArray(data.groups)||data.tasks.length>20000||data.groups.length>2000)return false;
 for(const [records,title,max]of [[data.tasks,'title',2000],[data.groups,'name',100]]){
  const ids=new Set();
  for(const item of records){
   if(!item||typeof item.id!=='string'||!/^[\w-]{1,100}$/.test(item.id)||ids.has(item.id)||typeof item[title]!=='string'||!item[title].trim()||item[title].length>max||!['work','home'].includes(item.area))return false;
   ids.add(item.id);
  }
 }
 return true;
}
async function authorised(request,key){
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{32,128}$/.test(key))return false;
 const given=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];
 if(!given)return false;
 const hash=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([hash(key),hash(given)]);let different=0;
 for(let i=0;i<a.length;i++)different|=a[i]^b[i];return different===0;
}
async function readBounded(request){
 const reader=request.body?.getReader();if(!reader)throw Error('body');
 const chunks=[];let total=0;
 while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>LIMIT){await reader.cancel();throw Error('large');}chunks.push(value);}
 const joined=new Uint8Array(total);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.byteLength;}
 return JSON.parse(new TextDecoder().decode(joined));
}
export default{
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin');
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin===ORIGIN)Object.assign(headers,{'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'GET, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'});
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(request.method==='GET'&&url.pathname==='/health')return reply({service:'margin-sync',ready:!!env.DB&&/^[A-Za-z0-9_-]{32,128}$/.test(env.SYNC_KEY||'')});
  if(origin&&origin!==ORIGIN)return reply({error:'Origin is not allowed.'},403);
  if(url.pathname!=='/notebook')return reply({error:'Not found.'},404);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!env.DB||!/^[A-Za-z0-9_-]{32,128}$/.test(env.SYNC_KEY||''))return reply({error:'Configure DB and SYNC_KEY.'},503);
  if(!await authorised(request,env.SYNC_KEY))return reply({error:'Invalid sync key.'},401);
  if(!['GET','PUT'].includes(request.method))return reply({error:'Use GET or PUT.'},405);
  try{
   const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
   await db.prepare(schema).run();
   await db.prepare('INSERT OR IGNORE INTO margin_notebook(id,revision,data) VALUES(1,0,?)').bind(JSON.stringify(EMPTY)).run();
   if(request.method==='GET'){
    const row=await db.prepare('SELECT revision,data FROM margin_notebook WHERE id=1').first();
    return reply({revision:row.revision,data:JSON.parse(row.data)});
   }
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'Use JSON.'},415);
   if(Number(request.headers.get('Content-Length'))>LIMIT)return reply({error:'Notebook is too large.'},413);
   let body;
   try{body=await readBounded(request);}catch(e){return reply({error:e.message==='large'?'Notebook is too large.':'Invalid JSON.'},e.message==='large'?413:400);}
   if(!Number.isSafeInteger(body.revision)||body.revision<0||!validNotebook(body.data))return reply({error:'Invalid notebook.'},400);
   // Compare-and-swap: two devices cannot silently overwrite one another.
   const result=await db.prepare('UPDATE margin_notebook SET data=?, revision=revision+1 WHERE id=1 AND revision=?')
     .bind(JSON.stringify(body.data),body.revision).run();
   if(result.meta.changes!==1)return reply({error:'Notebook changed. Fetch and merge again.'},409);
   return reply({revision:body.revision+1,data:body.data});
  }catch{return reply({error:'Storage unavailable. Local tasks have not been removed.'},503);}
 }
};
