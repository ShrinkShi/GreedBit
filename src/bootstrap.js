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
function applyCompatibilityAlias(path){
  if(path==='src/trading/contracts.js'&&window.GreedBitContracts){
    window.GreedBitV18=window.GreedBitContracts;
  }
  if(path==='src/ui/runtime.js'){
    if(window.GreedBitV21)window.GreedBitRuntimeUI=window.GreedBitV21;
    /* ui/runtime still contains a historical ready marker; bootstrap owns visibility now. */
    document.documentElement.classList.remove('gb-runtime-ready');
  }
}
function loadModule(path){
  return new Promise((resolve,reject)=>{
    if(document.querySelector(`script[data-gb-module="${path}"]`)){applyCompatibilityAlias(path);resolve();return}
    const script=document.createElement('script');
    script.src=path;script.async=false;script.dataset.gbModule=path;
    script.onload=()=>{applyCompatibilityAlias(path);resolve()};
    script.onerror=()=>reject(new Error(`模块加载失败: ${path}`));
    document.body.appendChild(script);
  });
}
async function boot(){
  const root=document.documentElement;
  root.dataset.gbBoot='loading';
  root.classList.remove('gb-runtime-ready');
  try{
    for(const path of MODULES)await loadModule(path);
    root.dataset.gbBoot='ready';
    root.classList.add('gb-runtime-ready');
    window.GreedBitBootstrap={modules:[...MODULES],ready:true,compatibilityAliases:['GreedBitV18','GreedBitV21']};
    document.dispatchEvent(new CustomEvent('greedbit:ready'));
  }catch(error){
    root.dataset.gbBoot='error';
    root.classList.remove('gb-runtime-ready');
    console.error('[GreedBit] bootstrap failed',error);
    const loading=document.getElementById('gbBootLoader');
    if(loading)loading.innerHTML='<strong>GreedBit 启动失败</strong><small>请打开开发者工具查看具体模块错误。</small>';
    throw error;
  }
}
boot();
})();