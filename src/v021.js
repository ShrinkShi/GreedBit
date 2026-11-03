/* final runtime stabilization (release v0.0.22) */
(function(){
'use strict';
const VERSION='0.0.22';
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
  const href='assets/greedbit-favicon.png?v=0022';
  const icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.sizes='64x64';icon.href=href;document.head.appendChild(icon);
  const shortcut=document.createElement('link');shortcut.rel='shortcut icon';shortcut.type='image/png';shortcut.href=href;document.head.appendChild(shortcut);
}
function updateVersion(){
  const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));
  if(el)el.textContent=`GreedBit v${VERSION}`;
}

/* Public market-data reliability: prefer Binance's market-data-only endpoints, fail fast, then fall back. */
function installMarketReliability(){
  const REST_HOSTS=[
    'https://data-api.binance.vision',
    'https://api-gcp.binance.com',
    'https://api1.binance.com',
    'https://api2.binance.com',
    'https://api3.binance.com',
    'https://api4.binance.com',
    'https://api.binance.com'
  ];
  try{
    fetchBinance=async function(path){
      let lastErr;
      for(const host of REST_HOSTS){
        const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),2800);
        try{
          const r=await fetch(host+path,{cache:'no-store',signal:ctl.signal});
          if(!r.ok)throw new Error(`HTTP ${r.status}`);
          return await r.json();
        }catch(e){lastErr=e}
        finally{clearTimeout(timer)}
      }
      throw lastErr||new Error('公共行情接口不可用');
    };
  }catch(e){console.warn('unable to replace market REST fallback',e)}

  if(!window.__gbWsMarketPatch&&window.WebSocket){
    const NativeWS=window.WebSocket;
    let retryDepth=0;
    const WrappedWS=new Proxy(NativeWS,{
      construct(target,args){
        let url=String(args[0]||'');
        /* First Binance host becomes the official market-data-only websocket; the :443 host remains fallback. */
        if(url.startsWith('wss://stream.binance.com:9443'))url=url.replace('wss://stream.binance.com:9443','wss://data-stream.binance.vision:443');
        const realArgs=[url,...args.slice(1)],ws=Reflect.construct(target,realArgs,target);
        const watchdog=setTimeout(()=>{try{if(ws.readyState===NativeWS.CONNECTING)ws.close()}catch{}},5000);
        ws.addEventListener('open',()=>{clearTimeout(watchdog);retryDepth=0},{once:true});
        ws.addEventListener('close',()=>clearTimeout(watchdog),{once:true});
        return ws;
      }
    });
    window.WebSocket=WrappedWS;
    window.__gbWsMarketPatch={NativeWS,WrappedWS};

    try{
      scheduleSocketReconnect=function(nextIndex){
        clearTimeout(marketSocketRetry);setMarketStatus('connecting','实时行情重连中…');
        const count=Math.max(1,typeof WS_HOSTS!=='undefined'?WS_HOSTS.length:2);
        const delay=Math.min(6000,900*Math.pow(1.55,Math.min(retryDepth++,5)))+Math.floor(Math.random()*220);
        marketSocketRetry=setTimeout(()=>connectMarketSocket(nextIndex%count),delay);
      };
    }catch(e){console.warn('unable to replace websocket reconnect policy',e)}
  }

  /* Re-open the active Binance stream with the new routing without resetting the user's chart view. */
  try{
    const sym=currentSymbol(),meta=marketMeta(sym);
    if((currentPage==='trade'||currentPage==='futures')&&(meta?.market==='binance'||!meta)){
      closeMarketSocket();
      setMarketStatus('connecting','正在连接公共实时行情…');
      setTimeout(()=>{try{connectMarketSocket(0)}catch{}},80);
      Promise.resolve(refreshTicker(sym)).then(()=>{try{stats();updateFooterTickers()}catch{}}).catch(()=>{});
      Promise.resolve(renderBook()).catch(()=>{});
    }
  }catch(e){console.warn('market reconnect refresh failed',e)}
}

function finalize(){
  if(finalized)return;finalized=true;
  installSourceLabelGuard();installFavicon();updateVersion();installMarketReliability();
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
