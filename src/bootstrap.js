/* GreedBit canonical runtime bootstrap.
 * Version history belongs to Git. Runtime modules are loaded by responsibility, not release number.
 */
(function(){
'use strict';
const MODULES=[
  'src/market/preload.js',
  'src/chart/renderer.js',
  'src/app/events.js',
  'src/trading/advanced-orders.js',
  'src/ui/preferences.js',
  'src/ui/home.js',
  'src/news/feeds.js',
  'src/market/model.js',
  'src/ui/shell.js',
  'src/app/compatibility.js',
  'src/ui/trading-experience.js',
  'src/performance/runtime.js',
  'src/market/extended.js',
  'src/market/stock-manifest-preload.js',
  'src/market/external.js',
  'src/trading/contracts.js',
  'src/trading/records.js',
  'src/ui/terminal-theme.js',
  'src/ui/runtime.js',
  'src/strategy/grid.js',
  'src/app/runtime.js'
];
function loadModule(path){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[data-gb-module="${path}"]`)){resolve();return}
    const script=document.createElement('script');
    script.src=path;script.async=false;script.dataset.gbModule=path;
    script.onload=resolve;
    script.onerror=()=>reject(new Error(`模块加载失败: ${path}`));
    document.body.appendChild(script);
  });
}
async function boot(){
  document.documentElement.dataset.gbBoot='loading';
  try{
    for(const path of MODULES)await loadModule(path);
    document.documentElement.dataset.gbBoot='ready';
    window.GreedBitBootstrap={modules:[...MODULES],ready:true};
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