// Only image bytes are cached. HTML, scripts and collection data stay fresh.
const IMAGE_CACHE='hans-beyth-images-v1',MAX_BYTES=128*1024*1024,MAX_ENTRIES=160;
let writes=Promise.resolve();
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function imageRequest(request){
  const url=new URL(request.url);
  return request.method==='GET'&&url.origin===self.location.origin&&
    (/\/assets\/(?:previews\/)?[\da-f]{16}(?:-v1-\d+)?\.(?:jpe?g|png|webp|gif)$/.test(url.pathname)||url.pathname.endsWith('/hans-beyth-share.jpg'));
}
async function storeImage(request,response){
  if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))return;
  const blob=await response.blob();if(blob.size>MAX_BYTES)return;
  const cache=await caches.open(IMAGE_CACHE),keys=await cache.keys();
  const sizes=await Promise.all(keys.map(async key=>Number((await cache.match(key))?.headers.get('x-hans-image-bytes')||0)));
  let bytes=sizes.reduce((sum,n)=>sum+n,0),count=keys.length;
  for(let i=0;i<keys.length&&(bytes+blob.size>MAX_BYTES||count>=MAX_ENTRIES);i++){await cache.delete(keys[i]);bytes-=sizes[i];count--}
  const headers=new Headers(response.headers);headers.set('x-hans-image-bytes',String(blob.size));
  const stored=new Response(blob,{status:response.status,statusText:response.statusText,headers});
  try{await cache.put(request,stored)}catch(error){
    // Low storage must never prevent displaying a photograph.
    if(error.name==='QuotaExceededError'){for(const key of keys.slice(0,Math.max(1,Math.ceil(keys.length/4))))await cache.delete(key);try{await cache.put(request,new Response(blob,{headers}))}catch{}}
  }
}
self.addEventListener('fetch',event=>{
  if(!imageRequest(event.request)||event.request.headers.has('range'))return;
  const url=new URL(event.request.url);url.search='';
  const key=new Request(url.href);
  // Register this lifetime promise synchronously, before the first await.
  let complete;event.waitUntil(new Promise(resolve=>complete=resolve));
  event.respondWith((async()=>{
    try{const cached=await (await caches.open(IMAGE_CACHE)).match(key);if(cached){complete();return cached}}catch{}
    try{
      const response=await fetch(event.request),copy=response.clone();
      writes=writes.then(()=>storeImage(key,copy)).catch(()=>{});writes.finally(complete);
      return response;
    }catch(error){complete();throw error}
  })());
});
