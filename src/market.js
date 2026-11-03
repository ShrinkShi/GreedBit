/* Real market data and market-side account valuation. Chart rendering lives exclusively in src/chart/renderer.js. */
function setMarketStatus(state,text){
  marketReady=state==='live';
  const el=$('marketStatusText'),dot=$('marketStatusDot');
  if(el)el.textContent=text||({live:'真实行情已连接',connecting:'连接真实行情…',error:'真实行情连接失败'}[state]||state);
  if(dot)dot.style.background=state==='live'?'var(--green)':state==='error'?'var(--red)':'var(--yellow)';
}
async function fetchBinance(path){
  let lastErr;
  for(const host of API_HOSTS){
    try{
      const r=await fetch(host+path,{cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return await r.json();
    }catch(e){lastErr=e}
  }
  throw lastErr||new Error('行情接口不可用');
}
function initMarketSnapshots(){
  for(const [sym,c] of Object.entries(configs))marketSnapshots[sym]={last:c.anchor,change:0,high:c.anchor,low:c.anchor,quoteVolume:0};
}
async function refreshTicker(sym){
  const data=await fetchBinance(`/api/v3/ticker/24hr?symbol=${apiSymbol(sym)}`);
  marketSnapshots[sym]={last:+data.lastPrice,change:+data.priceChangePercent,high:+data.highPrice,low:+data.lowPrice,quoteVolume:+data.quoteVolume};
  if(sym===symbol){
    latestTicker=marketSnapshots[sym];
    if(!marketReady&&Number.isFinite(+data.lastPrice))price=+data.lastPrice;
  }
}
async function updateMarketSnapshots(){
  try{
    await Promise.all(Object.keys(configs).map(refreshTicker));
    renderCoinList();renderHomeMarkets();stats();updateFooterTickers();
  }catch(e){console.warn('ticker refresh failed',e)}
}
function updateFooterTickers(){
  const box=$('footerTickers');if(!box)return;
  box.innerHTML=Object.entries(configs).map(([sym,c])=>{const m=marketSnapshots[sym]||{},ch=Number(m.change)||0;return`<span class="ticker ${ch>=0?'up':'down'}">${apiSymbol(sym)} ${ch>=0?'+':''}${ch.toFixed(2)}%</span>`}).join('');
}
function markFor(sym){return sym===symbol?price:(marketSnapshots[sym]?.last||configs[sym]?.anchor||0)}

function bucketStart(ts,info=tfInfo()){
  if(info.calendarMonth){const d=new Date(ts*1000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000}
  return Math.floor(ts/info.sec)*info.sec;
}
function bucketEnd(start,info=tfInfo()){
  if(info.calendarMonth){const d=new Date(start*1000);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/1000}
  return start+info.sec;
}
function aggregateRealKlines(raw,info){
  const parsed=raw.map(k=>({t:+k[0]/1000,end:(+k[6]+1)/1000,o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[5],live:false}));
  if(!info.aggregate)return parsed;
  const out=[];let g=null;
  for(const c of parsed){
    const start=Math.floor(c.t/info.aggregate)*info.aggregate;
    if(!g||g.t!==start){if(g)out.push(g);g={t:start,end:start+info.aggregate,o:c.o,h:c.h,l:c.l,c:c.c,v:c.v,live:false}}
    else{g.h=Math.max(g.h,c.h);g.l=Math.min(g.l,c.l);g.c=c.c;g.v+=c.v;g.end=Math.max(g.end,c.end)}
  }
  if(g)out.push(g);
  return out;
}
function currentSeries(){const a=[...candles];if(current)a.push(current);return a}

async function loadHistoricalMarket(resetView=true){
  const seq=++marketLoadSeq,info=tfInfo();
  historyExhausted=false;historyLoading=false;closeMarketSocket();setMarketStatus('connecting','正在加载真实历史行情…');
  try{
    const raw=await fetchBinance(`/api/v3/klines?symbol=${apiSymbol()}&interval=${info.api}&limit=1000`);
    if(seq!==marketLoadSeq)return;
    let bars=aggregateRealKlines(raw,info),now=Date.now()/1000;
    current=null;
    if(bars.length){
      const last=bars.at(-1),end=last.end||bucketEnd(last.t,info);
      if(now<end+2)current={...bars.pop(),live:true};
    }
    candles=bars;
    price=current?.c||candles.at(-1)?.c||price;
    marketSnapshots[symbol].last=price;
    if(resetView){visibleCount=72;viewShift=0;yZoom=1;yPan=0;hoverIndex=-1}
    await refreshTicker(symbol).catch(()=>{});
    connectMarketSocket();
    renderBook();stats();draw();renderCoinList();renderHomeMarkets();
  }catch(e){
    console.error(e);setMarketStatus('error','真实行情加载失败');
    notify('真实行情连接失败','无法从 Binance 获取行情，请检查网络或地区访问情况。','error',6000);
  }
}
async function loadOlderHistory(){
  if(historyLoading||historyExhausted||!candles.length)return;
  historyLoading=true;
  const info=tfInfo(),first=candles[0].t,expected=symbol,key=tfKey;
  try{
    const raw=await fetchBinance(`/api/v3/klines?symbol=${apiSymbol(expected)}&interval=${info.api}&endTime=${Math.floor(first*1000)-1}&limit=1000`);
    if(expected!==symbol||key!==tfKey)return;
    const older=aggregateRealKlines(raw,info).filter(c=>c.t<first);
    if(!older.length){historyExhausted=true;return}
    candles=[...older,...candles];
    if(raw.length<50)historyExhausted=true;
    draw();
  }catch(e){console.warn('older history failed',e)}
  finally{historyLoading=false}
}
function maybeLoadOlderHistory(){
  const g=viewGeometry();
  if(g.start<80&&!historyLoading&&!historyExhausted)loadOlderHistory();
}

function applyRealtimeTrade(p,t,v){
  const info=tfInfo();
  if(current&&t>=current.t&&t<current.end){
    current.h=Math.max(current.h,p);current.l=Math.min(current.l,p);current.c=p;current.v+=v;
  }else{
    if(current){current.live=false;candles.push(current);if(candles.length>12000)candles.shift()}
    let start;
    if(info.calendarMonth)start=bucketStart(t,info);
    else{
      const prev=candles.at(-1),anchor=prev?.end;
      if(anchor!=null){start=anchor;while(t>=start+info.sec)start+=info.sec}
      else start=bucketStart(t,info);
    }
    current={t:start,end:bucketEnd(start,info),o:p,h:p,l:p,c:p,v:v,live:true};
  }
  price=p;marketSnapshots[symbol].last=p;
  resolveNews();matchOrders();matchSpotOrders();checkRisk();settleFunding();stats();draw();
}
function connectMarketSocket(hostIndex=0){
  closeMarketSocket(false);marketSocketHostIndex=hostIndex;
  const s=apiSymbol().toLowerCase(),host=WS_HOSTS[hostIndex]||WS_HOSTS[0],url=`${host}/stream?streams=${s}@aggTrade/${s}@ticker`;
  setMarketStatus('connecting','正在连接实时行情…');
  try{marketSocket=new WebSocket(url)}catch(e){scheduleSocketReconnect(hostIndex+1);return}
  const expected=symbol;
  marketSocket.onopen=()=>{if(expected!==symbol)return;setMarketStatus('live','Binance 实时行情已连接')};
  marketSocket.onmessage=ev=>{
    if(expected!==symbol)return;
    try{
      const parsed=JSON.parse(ev.data),d=parsed?.data||parsed;
      if(d.e==='aggTrade')applyRealtimeTrade(+d.p,+d.T/1000,+d.q);
      else if(d.e==='24hrTicker'){
        const m={last:+d.c,change:+d.P,high:+d.h,low:+d.l,quoteVolume:+d.q};marketSnapshots[symbol]=m;latestTicker=m;price=+d.c;stats();updateFooterTickers();
      }
    }catch(e){console.warn('ws message',e)}
  };
  marketSocket.onerror=()=>{};
  marketSocket.onclose=()=>{if(expected===symbol)scheduleSocketReconnect(hostIndex+1)};
}
function scheduleSocketReconnect(nextIndex){
  clearTimeout(marketSocketRetry);setMarketStatus('connecting','实时行情重连中…');
  marketSocketRetry=setTimeout(()=>connectMarketSocket(nextIndex%WS_HOSTS.length),2200);
}
function closeMarketSocket(clearRetry=true){
  if(clearRetry)clearTimeout(marketSocketRetry);
  if(marketSocket){marketSocket.onclose=null;try{marketSocket.close()}catch{}marketSocket=null}
}
async function renderBook(){
  const seq=++depthLoadSeq,expected=symbol;
  try{
    const d=await fetchBinance(`/api/v3/depth?symbol=${apiSymbol(expected)}&limit=20`);
    if(seq!==depthLoadSeq||expected!==symbol)return;
    const asks=d.asks.slice(0,9).map(x=>[+x[0],+x[1]]).reverse(),bids=d.bids.slice(0,9).map(x=>[+x[0],+x[1]]);
    const mk=(rows,side)=>{let total=rows.reduce((a,r)=>a+r[1],0),cum=0;return rows.map(r=>{cum+=r[1];return`<div class="obrow"><i class="depth" style="width:${total?cum/total*100:0}%;background:${side==='a'?'#ec5d68':'#3dbb83'}"></i><span class="${side==='a'?'red':'green'}">${fmt(r[0],cfg.dec)}</span><span>${fmt(r[1],4)}</span><span>${fmt(cum,4)}</span></div>`}).join('')};
    $('asks').innerHTML=mk(asks,'a');$('bids').innerHTML=mk(bids,'b');
  }catch(e){console.warn('depth refresh failed',e)}
}

function pnlOf(p,mark=markFor(p.symbol)){return(mark-p.entry)*p.qty*(p.side==='long'?1:-1)}
function usedMargin(){return positions.reduce((a,p)=>a+p.margin,0)}
function totalUnrealized(){return positions.reduce((a,p)=>a+pnlOf(p),0)}
function futuresEquity(){const w=futuresWallet();return w.usdt+w.frozen+usedMargin()+totalUnrealized()}
function spotCoinValue(){const w=spotWallet();return coinKeys.reduce((a,c)=>a+(w.coins[c]||0)*markFor(c+'/USDT'),0)}
function totalAsset(){return walletUsdt('fiat')+walletUsdt('earn')+walletUsdt('strategy')+walletUsdt('spot')+spotWallet().frozenUsdt+spotCoinValue()+futuresEquity()}
function liqPrice(side,entry,mode,margin,notional){let cushion=margin;if(mode==='cross')cushion+=Math.max(0,futuresWallet().usdt);const ratio=Math.min(.95,cushion/Math.max(1,notional));return side==='long'?Math.max(.0000001,entry*(1-ratio+MMR)):entry*(1+ratio-MMR)}
