/* GreedBit canonical runtime bootstrap.
 * Version history belongs to Git. Runtime modules are loaded by responsibility, not release number.
 */
(function(){
'use strict';
const BUILD='0102-20261104a';
const MODULE_TIMEOUT_MS=20000;
const BOOT_TIMEOUT_MS=90000;
const MODULE_RETRY_LIMIT=1;
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
  'src/market/external.js',
  'src/trading/contracts.js',
  'src/trading/records.js',
  'src/trading/positions-ui.js',
  'src/ui/terminal-theme.js',
  'src/ui/runtime.js',
  'src/strategy/grid.js',
  'src/app/runtime.js'
];
const bootState={build:BUILD,modules:[...MODULES],loaded:[],current:null,ready:false,error:null,compatibilityAliases:['GreedBitV13','GreedBitV18','GreedBitV21']};
window.GreedBitBootstrap=bootState;

function installFavicon(){
  document.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]').forEach(x=>x.remove());
  const png=document.createElement('link');png.rel='icon';png.type='image/png';png.href=`assets/greedbit-favicon.png?gb=${encodeURIComponent(BUILD)}`;document.head.appendChild(png);
  const ico=document.createElement('link');ico.rel='shortcut icon';ico.type='image/x-icon';ico.href=`assets/favicon.ico?gb=${encodeURIComponent(BUILD)}`;document.head.appendChild(ico);
}
function applyCompatibilityAlias(path){
  if(path==='src/market/model.js'&&window.GreedBitV13){
    window.GreedBitMarketModel=window.GreedBitV13;
  }
  if(path==='src/trading/contracts.js'&&window.GreedBitContracts){
    window.GreedBitV18=window.GreedBitContracts;
  }
  if(path==='src/ui/runtime.js'){
    if(window.GreedBitV21)window.GreedBitRuntimeUI=window.GreedBitV21;
    document.documentElement.classList.remove('gb-runtime-ready');
  }
}
function validateModulePostcondition(path){
  if(path==='src/market/model.js'&&!window.GreedBitV13)throw new Error('模块初始化不完整: src/market/model.js 未导出 GreedBitV13');
  if(path==='src/trading/contracts.js'&&!window.GreedBitContracts)throw new Error('模块初始化不完整: src/trading/contracts.js 未导出 GreedBitContracts');
}
function versioned(path,attempt=0){
  const join=path.includes('?')?'&':'?';
  return `${path}${join}gb=${encodeURIComponent(BUILD)}${attempt?`&retry=${attempt}`:''}`;
}
// Start the independent network requests early, but execute modules in dependency order.
function preloadModules(){
  for(const path of MODULES){
    const link=document.createElement('link');
    link.rel='preload';link.as='script';link.href=versioned(path);
    document.head.appendChild(link);
  }
}
function moduleError(path,event){
  const filename=String(event?.filename||'');
  if(filename&&!filename.includes(path))return null;
  const detail=event?.error?.stack||event?.error?.message||event?.message||'未知运行时错误';
  return new Error(`模块执行失败: ${path}\n${detail}`);
}
function loadModule(path,attempt=0){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-gb-module="${path}"]`);
    if(existing&&existing.dataset.gbLoaded==='1'){
      try{validateModulePostcondition(path);applyCompatibilityAlias(path);resolve()}catch(error){reject(error)}
      return;
    }
    if(existing)existing.remove();
    const script=document.createElement('script');
    let settled=false;
    const onRuntimeError=event=>{
      const error=moduleError(path,event);
      if(error)finish(error);
    };
    const finish=(error)=>{
      if(settled)return;
      settled=true;clearTimeout(timer);
      window.removeEventListener('error',onRuntimeError,true);
      script.onload=null;script.onerror=null;
      if(error){script.remove();reject(error);return}
      try{
        validateModulePostcondition(path);
        script.dataset.gbLoaded='1';applyCompatibilityAlias(path);resolve();
      }catch(postError){script.remove();reject(postError)}
    };
    window.addEventListener('error',onRuntimeError,true);
    const timer=setTimeout(()=>finish(new Error(`模块加载超时（${MODULE_TIMEOUT_MS/1000}秒）: ${path}`)),MODULE_TIMEOUT_MS);
    script.src=versioned(path,attempt);script.async=false;script.dataset.gbModule=path;
    script.onload=()=>finish();
    script.onerror=()=>finish(new Error(`模块加载失败: ${path}`));
    document.body.appendChild(script);
  });
}
async function loadWithRetry(path){
  for(let attempt=0;attempt<=MODULE_RETRY_LIMIT;attempt++){
    try{
      bootState.attempt=attempt+1;
      return await loadModule(path,attempt);
    }catch(error){
      // Retry only transport failures. An execution or postcondition error is a code defect.
      if(attempt>=MODULE_RETRY_LIMIT||!/^模块加载(?:失败|超时)/.test(error?.message||''))throw error;
      console.warn('[GreedBit] retrying script load',path,error);
    }
  }
}
function showBootError(error){
  const old=document.getElementById('gbBootError');if(old)old.remove();
  const panel=document.createElement('div');panel.id='gbBootError';
  panel.style.cssText='position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:#0b0e12;color:#e7edf7;font-family:Inter,system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;padding:24px';
  const card=document.createElement('div');card.style.cssText='width:min(760px,92vw);border:1px solid #303846;background:#11151b;border-radius:12px;padding:24px;box-shadow:0 20px 70px #0008';
  const title=document.createElement('h2');title.textContent='GreedBit 启动失败';title.style.cssText='margin:0 0 12px;font-size:20px';
  const msg=document.createElement('pre');msg.textContent=error?.message||String(error);msg.style.cssText='white-space:pre-wrap;color:#ff7a86;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-word;margin:0 0 14px;max-height:45vh;overflow:auto';
  const hint=document.createElement('p');hint.textContent='启动器已停止自动刷新。上面的模块名和错误堆栈就是实际故障点。';hint.style.cssText='color:#98a4b7;line-height:1.7;margin:0 0 18px';
  const btn=document.createElement('button');btn.type='button';btn.textContent='手动重新加载';btn.style.cssText='border:0;border-radius:7px;background:#4f7df3;color:white;padding:9px 18px;cursor:pointer;font-weight:700';btn.onclick=()=>location.reload();
  card.append(title,msg,hint,btn);panel.appendChild(card);document.body.appendChild(panel);
}
async function boot(){
  const root=document.documentElement;
  installFavicon();
  preloadModules();
  root.dataset.gbBoot='loading';
  root.classList.remove('gb-runtime-ready');
  /* Preloaded resources still execute serially; allow cold CDN loads before failing. */
  const deadline=setTimeout(()=>{if(bootState.ready||bootState.error)return;bootState.timedOut=true;bootState.error={message:`启动超时（${BOOT_TIMEOUT_MS/1000} 秒），正在加载 ${bootState.current||'未知模块'}`,module:bootState.current};root.dataset.gbBoot='error';root.classList.add('gb-runtime-ready');showBootError(new Error(bootState.error.message))},BOOT_TIMEOUT_MS);
  try{
    for(const path of MODULES){
      if(bootState.timedOut)throw new Error('启动超时（20 秒）');
      bootState.current=path;
      await loadWithRetry(path);
      bootState.loaded.push(path);
    }
    if(bootState.timedOut)throw new Error('启动已超过全局超时限制');
    clearTimeout(deadline);
    bootState.current=null;bootState.ready=true;
    root.dataset.gbBoot='ready';
    root.classList.add('gb-runtime-ready');
    document.dispatchEvent(new CustomEvent('greedbit:ready'));
  }catch(error){
    clearTimeout(deadline);
    bootState.error={message:error?.message||String(error),module:bootState.current};
    root.dataset.gbBoot='error';
    root.classList.add('gb-runtime-ready');
    console.error('[GreedBit] bootstrap failed',error,bootState);
    showBootError(error);
  }
}
boot();
})();
