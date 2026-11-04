/* v0.0.11 market connection acceleration hooks; loaded before events.js init */
(function(){
'use strict';
// v011.js still waits for a legacy renderOverview hook that no longer exists.
// Expose a compatibility no-op so the v0.0.11 UI module can complete initialization.
if(typeof window.renderOverview!=='function')window.renderOverview=function(){};

/* adaptive price heartbeat: text-only pulse, strength follows short-term price impulse */
let heartbeatAnchorPrice=0,heartbeatAnchorAt=0,heartbeatDirection=0;
function clamp01(v){return Math.max(0,Math.min(1,v))}
function installAdaptiveHeartbeatStyles(){
  if(document.getElementById('gbAdaptiveHeartbeatStyle'))return;
  const style=document.createElement('style');style.id='gbAdaptiveHeartbeatStyle';style.textContent=`
.market-flash-up,.market-flash-down{background:transparent!important;transform-origin:center center;will-change:transform,text-shadow;animation-duration:var(--gb-heartbeat-duration,145ms)!important;animation-timing-function:cubic-bezier(.18,.78,.25,1)!important}
.market-flash-up{animation-name:gbHeartbeatUp!important}.market-flash-down{animation-name:gbHeartbeatDown!important}
@keyframes gbHeartbeatUp{0%{transform:scale(1);text-shadow:0 0 0 rgba(61,187,131,0)}32%{transform:scale(var(--gb-heartbeat-scale,1.01));text-shadow:0 0 var(--gb-heartbeat-glow,6px) rgba(61,187,131,var(--gb-heartbeat-alpha,.3)),0 0 var(--gb-heartbeat-glow-soft,3px) rgba(107,255,190,var(--gb-heartbeat-alpha-soft,.18))}68%{transform:scale(.998);text-shadow:0 0 2px rgba(61,187,131,.12)}100%{transform:scale(1);text-shadow:0 0 0 rgba(61,187,131,0)}}
@keyframes gbHeartbeatDown{0%{transform:scale(1);text-shadow:0 0 0 rgba(255,81,98,0)}32%{transform:scale(var(--gb-heartbeat-scale,1.01));text-shadow:0 0 var(--gb-heartbeat-glow,6px) rgba(255,81,98,var(--gb-heartbeat-alpha,.3)),0 0 var(--gb-heartbeat-glow-soft,3px) rgba(255,129,142,var(--gb-heartbeat-alpha-soft,.18))}68%{transform:scale(.998);text-shadow:0 0 2px rgba(255,81,98,.12)}100%{transform:scale(1);text-shadow:0 0 0 rgba(255,81,98,0)}}`;
  document.head.appendChild(style);
}
installAdaptiveHeartbeatStyles();
function updateHeartbeatStrength(detail){
  const p=+detail?.price,previous=+detail?.previous,dir=+detail?.direction;if(!Number.isFinite(p)||!Number.isFinite(previous)||previous<=0||!dir)return;
  const now=performance.now();
  if(!heartbeatAnchorPrice||now-heartbeatAnchorAt>650||(heartbeatDirection&&dir!==heartbeatDirection)){heartbeatAnchorPrice=previous;heartbeatAnchorAt=now}
  const elapsed=Math.max(.06,(now-heartbeatAnchorAt)/1000),tickPct=Math.abs(p-previous)/previous*100,burstPct=Math.abs(p-heartbeatAnchorPrice)/heartbeatAnchorPrice*100,speedPct=burstPct/elapsed;
  const raw=clamp01(Math.max(tickPct/.005,burstPct/.020,speedPct/.080)),strength=Math.max(.04,Math.pow(raw,.72));
  const scale=1.004+.060*strength,glow=3+19*strength,alpha=.18+.68*strength,duration=Math.round(150-25*strength);
  for(const el of [$('lastPrice'),$('midPrice')]){if(!el)continue;el.style.setProperty('--gb-heartbeat-scale',scale.toFixed(4));el.style.setProperty('--gb-heartbeat-glow',glow.toFixed(1)+'px');el.style.setProperty('--gb-heartbeat-glow-soft',(glow*.48).toFixed(1)+'px');el.style.setProperty('--gb-heartbeat-alpha',alpha.toFixed(3));el.style.setProperty('--gb-heartbeat-alpha-soft',(alpha*.58).toFixed(3));el.style.setProperty('--gb-heartbeat-duration',duration+'ms')}
  heartbeatDirection=dir;
}
window.addEventListener('greedbit:tick',e=>updateHeartbeatStrength(e.detail));

/* local avatar support until a real account backend exists */
const DEFAULT_AVATAR='assets/default%20avatar.png';
function avatarKey(name=user?.username){return name?`greedbit_avatar_${name}`:''}
function customAvatar(name=user?.username){const k=avatarKey(name);return k?localStorage.getItem(k)||'':''}
function avatarSrc(name=user?.username){return customAvatar(name)||DEFAULT_AVATAR}
function syncAvatarUI(){
  const src=avatarSrc();document.querySelectorAll('.profile-trigger img,.profile-name-row img').forEach(img=>{img.src=src});
  const reset=$('avatarResetBtn');if(reset)reset.classList.toggle('hidden',!customAvatar());
}
function fileAsDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('读取图片失败'));r.readAsDataURL(file)})}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('图片格式无法读取'));img.src=src})}
async function prepareAvatar(file){
  if(!file?.type?.startsWith('image/'))throw new Error('请选择 PNG、JPG 或 WebP 图片');if(file.size>5*1024*1024)throw new Error('头像文件不能超过 5MB');
  const img=await loadImage(await fileAsDataUrl(file)),side=Math.min(img.naturalWidth,img.naturalHeight),sx=(img.naturalWidth-side)/2,sy=(img.naturalHeight-side)/2,canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(img,sx,sy,side,side,0,0,256,256);return canvas.toDataURL('image/webp',.86)
}
async function handleAvatarFile(file){
  if(!user)return;try{const data=await prepareAvatar(file);localStorage.setItem(avatarKey(),data);syncAvatarUI();notify('头像已更新','新头像已保存到当前浏览器','info')}catch(e){notify('头像修改失败',e?.message||'无法处理该图片','error')}
}
function installAvatarControls(){
  const menu=$('profileMenu'),logout=$('profileLogout');if(!menu||!logout)return false;
  if(!$('avatarInput'))logout.insertAdjacentHTML('beforebegin','<button id="avatarChangeBtn" type="button">修改头像 <span>›</span></button><button id="avatarResetBtn" class="hidden" type="button">恢复默认头像 <span>↺</span></button><input id="avatarInput" type="file" accept="image/png,image/jpeg,image/webp" hidden/>');
  const input=$('avatarInput'),change=$('avatarChangeBtn'),reset=$('avatarResetBtn'),summaryAvatar=menu.querySelector('.profile-name-row img');
  if(change&&!change.dataset.wired){change.dataset.wired='1';change.onclick=e=>{e.stopPropagation();input.value='';input.click()}}
  if(input&&!input.dataset.wired){input.dataset.wired='1';input.onchange=()=>{const file=input.files?.[0];if(file)handleAvatarFile(file)}}
  if(reset&&!reset.dataset.wired){reset.dataset.wired='1';reset.onclick=e=>{e.stopPropagation();const k=avatarKey();if(k)localStorage.removeItem(k);syncAvatarUI();notify('头像已恢复','已恢复默认头像','info')}}
  if(summaryAvatar&&!summaryAvatar.dataset.wired){summaryAvatar.dataset.wired='1';summaryAvatar.title='点击修改头像';summaryAvatar.style.cursor='pointer';summaryAvatar.onclick=e=>{e.stopPropagation();input.value='';input.click()}}
  syncAvatarUI();return true;
}
function bootAvatarFeature(attempt=0){if(!installAvatarControls()&&attempt<30)setTimeout(()=>bootAvatarFeature(attempt+1),50)}
document.addEventListener('DOMContentLoaded',()=>bootAvatarFeature(),{once:true});
const baseSyncAuthAvatar=syncAuth;syncAuth=function(){const out=baseSyncAuthAvatar.apply(this,arguments);setTimeout(()=>{installAvatarControls();syncAvatarUI()},0);return out};

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
  $('asks').innerHTML=mk(asks,'a');$('bids').innerHTML=mk(bids,'b');setBookMode(false);
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
  const seq=++marketLoadSeq,expected=symbol,info=tfInfo();historyExhausted=false;historyLoading=false;
  if(!marketSocket||marketSocket.readyState>1||marketSocket._gbSymbol!==symbol){closeMarketSocket();connectMarketSocket()}
  if(!marketReady)setMarketStatus('connecting','实时行情抢连中 · 同步历史K线…');
  try{
    const raw=await fetchBinance(`/api/v3/klines?symbol=${apiSymbol(expected)}&interval=${info.api}&limit=500`);
    if(seq!==marketLoadSeq||expected!==symbol)return;
    let bars=aggregateRealKlines(raw,info),now=Date.now()/1000;current=null;
    if(bars.length){const last=bars.at(-1),end=last.end||bucketEnd(last.t,info);if(now<end+2)current={...bars.pop(),live:true}}
    candles=bars;price=current?.c||candles.at(-1)?.c||price;marketSnapshots[expected].last=price;if(resetView){visibleCount=72;viewShift=0;yZoom=1;yPan=0;hoverIndex=-1}
    refreshTicker(expected).catch(()=>{});renderBook();stats();draw();renderCoinList();renderHomeMarkets();if(resetView)setTimeout(()=>{if(expected===symbol&&viewGeometry().start<100)loadOlderHistory()},350);
  }catch(e){
    console.error(e);
    if(seq!==marketLoadSeq||expected!==symbol)return;
    /* Never let the previous symbol's candles/price survive a failed switch. */
    candles=[];current=null;price=0;draw();
    setMarketStatus('error','真实行情加载失败');
    notify('真实行情连接失败','无法从 Binance 获取行情，请检查网络或地区访问情况。','error',6000);
  }
};
})();
