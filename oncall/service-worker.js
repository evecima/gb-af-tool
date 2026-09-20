const VERSION='0.7.21';
const CACHE='oncall-maintenance-v0-7-21';
const V='?v='+VERSION;
const numbered=(prefix,count)=>Array.from({length:count},(_,i)=>`./${prefix}-${String(i+1).padStart(2,'0')}.js${V}`);
const styles=Array.from({length:8},(_,i)=>`./styles-${i+1}.css${V}`);
const printStyles=Array.from({length:7},(_,i)=>`./styles-${i+1}.css?v=0.5.15`);
const ui=Array.from({length:4},(_,i)=>`./ui-${i+1}.html${V}`);
const seeds=Array.from({length:4},(_,i)=>`./seeds-${i+1}.js${V}`);
const CORE=['./','./index.html','./print.html'+V,...styles,...printStyles,'./vendor/html2canvas.min.js'+V,'./vendor/jspdf.umd.min.js'+V,...ui,...seeds,...numbered('app',48),'./app-50.js'+V,'../apartments.js'+V,'./manifest.webmanifest'+V,'./icons/icon.svg'+V];
const EXTERNAL=['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];
const INDEX_URL=new URL('./index.html',self.location.href).href;
async function fetchFresh(input){return fetch(input,{cache:'no-store'})}
async function cachePut(key,response){if(response&&response.ok){const c=await caches.open(CACHE);await c.put(key,response.clone())}return response}
function isAppRoot(url){const p=url.pathname;return p===new URL('./',self.registration.scope).pathname||p.endsWith('/oncall/index.html')}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const c=await caches.open(CACHE);for(const u of CORE){try{const r=await fetchFresh(u);if(r.ok)await c.put(u,r.clone())}catch(e){}}for(const u of EXTERNAL){try{const r=await fetch(u,{mode:'cors'});if(r.ok)await c.put(u,r.clone())}catch(e){}}})());self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith((async()=>{const req=event.request,url=new URL(req.url);if(req.mode==='navigate'){try{const r=await fetchFresh(req),c=await caches.open(CACHE);await c.put(req,r.clone());if(isAppRoot(url))await c.put(INDEX_URL,r.clone());return r}catch(e){const exact=await caches.match(req);if(exact)return exact;if(isAppRoot(url))return(await caches.match(INDEX_URL))||(await caches.match('./'))||Response.error();return Response.error()}}if(url.origin===self.location.origin){try{const r=await fetchFresh(req);await cachePut(req,r);return r}catch(e){return(await caches.match(req))||Response.error()}}const cached=await caches.match(req);if(cached)return cached;try{const r=await fetch(req);await cachePut(req,r);return r}catch(e){return Response.error()}})())});