const CACHE='margin-v2.2.0';
const ASSETS=['./','./index.html','./style.css?v=2.2','./app.js?v=2.2','./data.js?v=2.2','./manifest.webmanifest?identity=1','./icon.svg','./icon-192.png','./icon-512.png','./hand.woff'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('margin-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith(new URL(self.registration.scope).pathname))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(r=>{if(r.ok&&!u.search){const copy=r.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));}return r;}).catch(()=>caches.open(CACHE).then(c=>c.match('./index.html'))));return;}event.respondWith(caches.open(CACHE).then(c=>c.match(event.request)).then(c=>c||fetch(event.request)));});

