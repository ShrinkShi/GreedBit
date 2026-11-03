/* v0.0.21 layout/source-label/favicon fixes */
(function(){
'use strict';
const VERSION='0.0.21';
let finalized=false;

function installStyle(done){
  let l=document.querySelector('link[href="styles/v021.css"]');
  if(l){
    if(l.sheet){done();return}
    l.addEventListener('load',done,{once:true});
    l.addEventListener('error',done,{once:true});
    return;
  }
  l=document.createElement('link');l.rel='stylesheet';l.href='styles/v021.css';
  l.addEventListener('load',done,{once:true});l.addEventListener('error',done,{once:true});document.head.appendChild(l);
}
function currentSymbol(){
  try{if(typeof symbol==='string'&&symbol)return symbol}catch{}
  return document.getElementById('symbol')?.value||'';
}
function currentMode(){
  try{if(typeof tradingMode==='string'&&tradingMode)return tradingMode}catch{}
  return 'futures';
}
function marketMeta(sym){return window.GreedBitV13?.META?.[sym]||null}
function sourceLabel(){
  const sym=currentSymbol(),mode=currentMode(),m=marketMeta(sym),market=m?.market||m?.category||'';
  if(!sym)return'';
  if(mode==='futures'&&market!=='commodity'&&market!=='forex'){
    const basis=Number(window.GreedBitV18?.basisPct?.(sym));
    return `永续合约模拟价格 · 基差 ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`;
  }
  if(market==='stock'&&mode==='spot'){
    const src=marketSnapshots?.[sym]?._source||'参考行情';
    return `${m?.name||m?.ticker||sym}股票代币现货 · ${src}`;
  }
  return marketSnapshots?.[sym]?._source||'公开市场行情';
}
function installSourceLabelGuard(){
  const el=document.querySelector('#lastPrice + .muted.tiny')||document.getElementById('lastPrice')?.parentElement?.querySelector('.muted.tiny');
  if(!el||el.dataset.gb21Guard==='1')return;
  const native=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  if(!native?.get||!native?.set)return;
  el.dataset.gb21Guard='1';
  try{
    Object.defineProperty(el,'textContent',{
      configurable:true,
      get(){return native.get.call(this)},
      set(v){native.set.call(this,sourceLabel()||String(v??''))}
    });
  }catch{}
  native.set.call(el,sourceLabel());
}
function installFavicon(){
  document.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]').forEach(x=>x.remove());
  const href='assets/greedbit-favicon.png?v=0021';
  const icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.sizes='64x64';icon.href=href;document.head.appendChild(icon);
  const shortcut=document.createElement('link');shortcut.rel='shortcut icon';shortcut.type='image/png';shortcut.href=href;document.head.appendChild(shortcut);
}
function updateVersion(){
  const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));
  if(el)el.textContent=`GreedBit v${VERSION}`;
}
function finalize(){
  if(finalized)return;finalized=true;
  installSourceLabelGuard();installFavicon();updateVersion();
  requestAnimationFrame(()=>{
    installSourceLabelGuard();window.GreedBitPairLabelGuard?.enforce?.();updateVersion();
    document.documentElement.classList.add('gb-runtime-ready');
  });
  window.GreedBitV21={VERSION,sourceLabel};
}
function boot(){
  document.documentElement.classList.add('gb21-ui');
  installStyle(finalize);
  setTimeout(finalize,1500);
}
boot();
})();
