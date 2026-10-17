const CACHE='math-atelier-a39f5297768daf6c';
const FILES=["assets/index-C99dqq4r.js","assets/index-TJg3lBJc.css","icon-192.png","icon-512.png","icon.svg","index.html","manifest.webmanifest"];
const urls=FILES.map(f=>new URL(f,self.registration.scope).href);
self.addEventListener('install',event=>{event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try { await cache.addAll(urls.map(url=>new Request(url,{cache:'reload'}))); }
  catch(e) { await caches.delete(CACHE); throw e; }
  // No skipWaiting here: existing sessions keep their current version.
})());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
async function complete(){const cache=await caches.open(CACHE);return (await Promise.all(urls.map(url=>cache.match(url)))).every(Boolean);}
self.addEventListener('message',event=>{
  if(event.data?.type==='CHECK_READY')event.waitUntil(complete().then(ready=>event.ports[0]?.postMessage({ready})).catch(()=>event.ports[0]?.postMessage({ready:false})));
  if(event.data?.type==='APPLY_UPDATE')event.waitUntil(complete().then(ready=>{if(ready)return self.skipWaiting();}));
});
self.addEventListener('fetch',event=>{
  const request=event.request;const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const scope=new URL(self.registration.scope);
  if(!url.pathname.startsWith(scope.pathname))return;
  if(request.mode==='navigate'){
    const target=new URL(url.href);target.search='';target.hash='';
    if(target.pathname.endsWith('/'))target.pathname+='index.html';
    // Optional local tools have their own HTML. Never replace them with hub HTML.
    if(target.pathname.startsWith(scope.pathname+'pdf-counter/')){
      event.respondWith(fetch(request));return;
    }
    if(!urls.includes(target.href))return;
    const destination=target.href;
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(destination)).then(hit=>hit||fetch(request)));return;
  }
  if(!urls.includes(url.href))return;
  event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).then(hit=>hit||fetch(request)));
});
