/* v0.0.17 stock icon manifest preload */
(function(){
'use strict';
const TARGET='https://api.github.com/repos/ShrinkShi/GreedBit/contents/assets/stocksicon?ref=main';
const nativeFetch=window.fetch.bind(window);
let intercepted=false;
window.fetch=async function(input,init){
  const url=typeof input==='string'?input:input?.url;
  if(!intercepted&&url===TARGET){
    intercepted=true;
    window.fetch=nativeFetch;
    try{
      const local=await nativeFetch('assets/stocksicon/manifest.json',{cache:'no-store'});
      if(local.ok){
        const names=await local.json();
        if(Array.isArray(names)&&names.length){
          const files=names.filter(n=>typeof n==='string'&&/\.png$/i.test(n)).map(name=>({name,type:'file'}));
          return new Response(JSON.stringify(files),{status:200,headers:{'Content-Type':'application/json'}});
        }
      }
    }catch(e){console.warn('local stock icon manifest unavailable',e)}
    return nativeFetch(input,init);
  }
  return nativeFetch(input,init);
};
})();
