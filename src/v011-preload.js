/* v0.0.11 market connection acceleration hooks; loaded before events.js init */
(function(){
'use strict';
// v011.js still waits for a legacy renderOverview hook that no longer exists.
// Expose a compatibility no-op so the v0.0.11 UI module can complete initialization.
if(typeof window.renderOverview!=='function')window.renderOverview=function(){};

// Repository-safe logo asset. The original v0.0.11 code referenced a PNG that was never committed.
const GB_LOGO_ASSET='assets/greedbit-logo.svg';
function repairGreedbitLogoAssets(){
  document.querySelectorAll('img[src$="greedbit-logo.png"]').forEach(img=>{img.src=GB_LOGO_ASSET});
  const favicon=document.querySelector('link[rel~="icon"]');
  if(favicon){favicon.type='image/svg+xml';favicon.href=GB_LOGO_ASSET}
}
window.addEventListener('DOMContentLoaded',repairGreedbitLogoAssets,{once:true});

const FAST_API_HOSTS=['https://data-api.binance.vision','https://api1.binance.com','https://api2.binance.com','https://api3.binance.com','https://api4.binance.com','https://api-gcp.binance.com','https://api.binance.com'];
const FAST_WS_HOSTS=['wss://data-stream.binance.vision','wss://stream.binance.com:443','wss://stream.binance.com:9443'];
let preferredApiHost=localStorage.getItem('greedbit_fast_api_host')||'',preferredWsHost=localStorage.getItem('greedbit_fast_ws_host')||'',lastDepthAt=0;

const baseSetMarketStatus=setMarketStatus;
setMarketStatus=function(state,text){baseSetMarketStatus(state,text);const dot=$('marketStatusDot');if(dot)dot.dataset.state=state};

async function fetchHostJson(host,path,timeout=1800){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(host+path,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return{host,data:await r.json()}}finally{clearTimeout(timer)}}
fetchBinance=async function(path){
  if(preferredApiHost){try{return(await fetchHostJson(preferredApiHost,path,1250)).data}catch{preferredApiHost=''}}
  try{const winner=await Promise.any(FAST_API_HOSTS.map(h=>fetchHostJson(h,path,1800)));preferredApiHost=winner.host;localStorage.setItem('greedbit_fast_api_host',preferredApiHost);return winner.data}catch{throw new Error('行情接口不可用')}
};

const baseUpdateMarketSnapshots=updateMarketSnapshots;
updateMarketSnapshots=function(){baseUpdateMarketSnapshots().catch(()=>{});return Promise.resolve()};
const baseLoadRealNews=loadRealNews;
loadRealNews=function(showToast=false){const p=baseLoadRealNews(showToast);return showToast?p:Promise.resolve()};

const baseApplyRealtimeTrade=applyRealtimeTrade;
applyRealtimeTrade=function(p,t,v){const previous=price;baseApplyRealtimeTrade(p,t,v);if(Number.isFinite(previous)&&p!==previous)window.dispatchEvent(new CustomEvent('greedbit:tick',{detail:{price:p,previous,direction:p>previous?1:-1,ts:t}}))};

function renderDepth(d){
  if(!d?.asks||!d?.bids)return;lastDepthAt=Date.now();
  const asks=d.asks.slice(0,9).map(x=>[+x[0],+x[1]]).reverse(),bids=d.bids.slice(0,9).map(x=>[+x[0],+x[1]]);
  const mk=(rows,side)=>{let total=rows.reduce((a,r)=>a+r[1],0),cum=0;return rows.map(r=>{cum+=r[1];return`<div class="obrow"><i class="depth" style="width:${total?cum/total*100:0}%;background:${side==='a'?'#ec5d68':'#3dbb83'}"></i><span class="${side==='a'?'red':'green'}">${fmt(r[0],cfg.dec)}</span><span>${fmt(r[1],4)}</span><span>${fmt(cum,4)}</span></div>`}).join('')};
  $('asks').innerHTML=mk(asks,'a');$('bids').innerHTML=mk(bids,'b');
}

connectMarketSocket=function(hostIndex=0){
  closeMarketSocket(false);const ordered=[...new Set([preferredWsHost,...FAST_WS_HOSTS].filter(Boolean))],host=ordered[hostIndex%ordered.length],s=apiSymbol().toLowerCase(),url=`${host}/stream?streams=${s}@aggTrade/${s}@ticker/${s}@depth20@100ms`;marketSocketHostIndex=hostIndex;setMarketStatus('connecting','正在连接实时行情…');let opened=false,timer;
  try{marketSocket=new WebSocket(url);marketSocket._gbSymbol=symbol}catch{scheduleSocketReconnect(hostIndex+1,180);return}
  const expected=symbol,socket=marketSocket;timer=setTimeout(()=>{if(!opened&&socket===marketSocket){socket.onclose=null;try{socket.close()}catch{};connectMarketSocket(hostIndex+1)}},1400);
  socket.onopen=()=>{if(expected!==symbol)return;opened=true;clearTimeout(timer);preferredWsHost=host;localStorage.setItem('greedbit_fast_ws_host',host);setMarketStatus('live',`真实行情已连接 · ${host.includes('vision')?'Market Data':'Binance'}`)};
  socket.onmessage=ev=>{if(expected!==symbol)return;try{const raw=JSON.parse(ev.data),d=raw?.data||raw;if(d.e==='aggTrade')applyRealtimeTrade(+d.p,+d.T/1000,+d.q);else if(d.e==='24hrTicker'){const previous=price,m={last:+d.c,change:+d.P,high:+d.h,low:+d.l,quoteVolume:+d.q};marketSnapshots[symbol]=m;latestTicker=m;price=+d.c;stats();updateFooterTickers();if(Number.isFinite(previous)&&price!==previous)window.dispatchEvent(new CustomEvent('greedbit:tick',{detail:{price,previous,direction:price>previous?1:-1,ts:+d.E/1000}}))}else if(d.lastUpdateId&&d.asks&&d.bids)renderDepth(d)}catch(e){console.warn('ws message',e)}};
  socket.onerror=()=>{};socket.onclose=()=>{clearTimeout(timer);if(expected===symbol&&socket===marketSocket)scheduleSocketReconnect(hostIndex+1,opened?650:150)};
};
scheduleSocketReconnect=function(nextIndex,delay=650){clearTimeout(marketSocketRetry);setMarketStatus('connecting','实时行情重连中…');marketSocketRetry=setTimeout(()=>connectMarketSocket(nextIndex),delay)};

const baseRenderBook=renderBook;
renderBook=async function(){if(marketReady&&Date.now()-lastDepthAt<3500)return;baseRenderBook().catch?.(()=>{})};

loadHistoricalMarket=async function(resetView=true){
  const seq=++marketLoadSeq,info=tfInfo();historyExhausted=false;historyLoading=false;
  if(!marketSocket||marketSocket.readyState>1||marketSocket._gbSymbol!==symbol){closeMarketSocket();connectMarketSocket()}
  if(!marketReady)setMarketStatus('connecting','实时行情抢连中 · 同步历史K线…');
  try{
    const raw=await fetchBinance(`/api/v3/klines?symbol=${apiSymbol()}&interval=${info.api}&limit=500`);if(seq!==marketLoadSeq)return;let bars=aggregateRealKlines(raw,info),now=Date.now()/1000;current=null;
    if(bars.length){const last=bars.at(-1),end=last.end||bucketEnd(last.t,info);if(now<end+2)current={...bars.pop(),live:true}}
    candles=bars;price=current?.c||candles.at(-1)?.c||price;marketSnapshots[symbol].last=price;if(resetView){visibleCount=72;viewShift=0;yZoom=1;yPan=0;hoverIndex=-1}
    refreshTicker(symbol).catch(()=>{});renderBook();stats();draw();renderCoinList();renderHomeMarkets();if(resetView)setTimeout(()=>{if(viewGeometry().start<100)loadOlderHistory()},350);
  }catch(e){console.error(e);setMarketStatus('error','真实行情加载失败');notify('真实行情连接失败','无法从 Binance 获取行情，请检查网络或地区访问情况。','error',6000)}
};
})();
