/* GreedBit canonical runtime bootstrap.
 * Version history belongs to Git. Runtime modules are loaded by responsibility, not release number.
 */
(function(){
'use strict';
const MODULES=[
  {path:'src/market/preload.js'},
  {path:'src/chart/renderer.js'},
  {path:'src/app/events.js'},
  {path:'src/trading/advanced-orders.js'},
  {path:'src/ui/preferences.js'},
  {path:'src/ui/home.js'},
  {path:'src/news/feeds.js'},
  {path:'src/market/model.js'},
  {path:'src/ui/shell.js'},
  {path:'src/app/compatibility.js'},
  {path:'src/ui/trading-experience.js'},
  {path:'src/performance/runtime.js'},
  {path:'src/market/extended.js',blockIntervals:['syncPairLabel']},
  {path:'src/market/stock-manifest-preload.js'},
  {path:'src/market/external.js',blockIntervals:['syncExternalLabel']},
  {path:'src/trading/contracts.js',blockIntervals:['syncPairHeader']},
  {path:'src/trading/records.js'},
  {path:'src/ui/terminal-theme.js'},
  {path:'src/ui/runtime.js'},
  {path:'src/strategy/grid.js'},
  {path:'src/app/runtime.js'}
];

function scriptExists(path){return !!document.querySelector(`script[data-gb-module="${path}"]`)}
function loadModule(spec){
  return new Promise((resolve,reject)=>{
    if(scriptExists(spec.path)){resolve();return}
    const nativeSetInterval=window.setInterval;
    if(spec.blockIntervals?.length){
      window.setInterval=function(fn,delay,...args){
        const source=typeof fn==='function'?Function.prototype.toString.call(fn):'';
        if(spec.blockIntervals.some(name=>source.includes(name)))return 0;
        return nativeSetInterval(fn,delay,...args);
      };
    }
    const restore=()=>{window.setInterval=nativeSetInterval};
    const script=document.createElement('script');
    script.src=spec.path;script.async=false;script.dataset.gbModule=spec.path;
    script.onload=()=>{restore();resolve()};
    script.onerror=()=>{restore();reject(new Error(`模块加载失败: ${spec.path}`))};
    document.body.appendChild(script);
  });
}
async function boot(){
  document.documentElement.dataset.gbBoot='loading';
  try{
    for(const spec of MODULES)await loadModule(spec);
    document.documentElement.dataset.gbBoot='ready';
    window.GreedBitBootstrap={modules:MODULES.map(x=>x.path),ready:true};
    document.dispatchEvent(new CustomEvent('greedbit:ready'));
  }catch(error){
    document.documentElement.dataset.gbBoot='error';
    console.error('[GreedBit] bootstrap failed',error);
    const loading=document.getElementById('gbBootLoader');
    if(loading)loading.innerHTML='<strong>GreedBit 启动失败</strong><small>请打开开发者工具查看具体模块错误。</small>';
    throw error;
  }
}
boot();
})();