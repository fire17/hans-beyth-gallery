// Wait briefly for the image-only worker so the first visit is cached too.
window.imageCacheReady=Promise.resolve();
if('serviceWorker' in navigator&&window.isSecureContext){
  const ready=navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(async()=>{
    await navigator.serviceWorker.ready;
    if(navigator.serviceWorker.controller)return;
    await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
  }).catch(()=>{});
  window.imageCacheReady=Promise.race([ready,new Promise(resolve=>setTimeout(resolve,1800))]);
}
