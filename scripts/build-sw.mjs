import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../dist/',import.meta.url);
async function walk(dir,prefix=''){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())result.push(...await walk(new URL(entry.name+'/',dir),name+'/'));else if(entry.name!=='sw.js')result.push(name);}return result;}
// Only this hub's required shell is precached. Preserve separately-added tools,
// but do not make their optional vendor assets a prerequisite for hub readiness.
const files=(await walk(root)).filter(file=>['index.html','icon.svg','icon-192.png','icon-512.png','manifest.webmanifest'].includes(file)||file.startsWith('assets/')).sort();
const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(await readFile(new URL(file,root)));}
// Worker logic changes also need a distinct cache; a failed update must never
// delete the active worker's cache when the shell files themselves are unchanged.
hash.update(await readFile(new URL(import.meta.url)));
const version=hash.digest('hex').slice(0,16);
const source=`const CACHE='math-atelier-${version}';
const FILES=${JSON.stringify(files)};
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
`;
await writeFile(new URL('sw.js',root),source);
console.log('Offline bundle: '+files.length+' files, version '+version);
