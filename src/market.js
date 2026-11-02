/* real market data + chart */
function setMarketStatus(state,text){
  marketReady=state==='live';
  const el=$('marketStatusText'),dot=$('marketStatusDot');
  if(el)el.textContent=text||({live:'真实行情已连接',connecting:'连接真实行情…',error:'真实行情连接失败'}[state]||state);
  if(dot){dot.style.background=state==='live'?'var(--green)':state==='error'?'var(--red)':'var(--yellow)'}
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
  marketSnapshots[sym]={
    last:+data.lastPrice,change:+data.priceChangePercent,high:+data.highPrice,low:+data.lowPrice,quoteVolume:+data.quoteVolume
  };
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
  box.innerHTML=Object.entries(configs).map(([sym,c])=>{const m=marketSnapshots[sym]||{};const ch=Number(m.change)||0;return`<span class="ticker ${ch>=0?'up':'down'}">${apiSymbol(sym)} ${ch>=0?'+':''}${ch.toFixed(2)}%</span>`}).join('');
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
function viewGeometry(){
  const all=currentSeries(),defaultFuture=4,right=all.length+defaultFuture+viewShift,start=right-visibleCount;
  const from=Math.max(0,Math.floor(Math.min(start,right))-2),to=Math.min(all.length,Math.ceil(Math.max(start,right))+2),visible=[];
  for(let i=from;i<to;i++)visible.push({idx:i,c:all[i]});
  return{all,start,right,visible};
}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function formatTime(ts){
  if(!Number.isFinite(ts)||Math.abs(ts)>8.64e12)return'超出范围';
  const d=new Date(ts*1000),Y=d.getFullYear(),M=String(d.getMonth()+1).padStart(2,'0'),D=String(d.getDate()).padStart(2,'0'),h=String(d.getHours()).padStart(2,'0'),m=String(d.getMinutes()).padStart(2,'0'),sec=String(d.getSeconds()).padStart(2,'0');
  const spanSeconds=Math.abs(visibleCount*tf);
  if(spanSeconds<3600)return`${M}/${D} ${h}:${m}:${sec}`;
  return tf>=86400?`${Y}/${M}/${D}`:`${M}/${D} ${h}:${m}`;
}
function candleRemain(){
  const info=tfInfo(),n=Date.now()/1000,end=current?.end||bucketEnd(bucketStart(n,info),info),r=Math.max(0,Math.ceil(end-n)),h=Math.floor(r/3600),m=Math.floor(r%3600/60),s=r%60;
  return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function visibleCandles(geom=viewGeometry()){
  return geom.visible.filter(x=>x.idx>=geom.start-1&&x.idx<=geom.right+1).map(x=>x.c);
}
function calcPriceBounds(geom=viewGeometry()){
  const d=visibleCandles(geom);
  let baseHi,baseLo;
  if(d.length){baseHi=Math.max(...d.map(c=>c.h));baseLo=Math.min(...d.map(c=>c.l))}
  else{baseHi=Math.max(price,1)*1.01;baseLo=Math.max(0,price*.99)}
  let baseRange=(baseHi-baseLo)||Math.max(baseHi*.01,.01),center=(baseHi+baseLo)/2+yPan;
  let range=baseRange*1.18*yZoom;
  const precisionFloor=Number.EPSILON*Math.max(1,Math.abs(center));
  if(!Number.isFinite(range)||range<=0)range=Math.max(baseRange,precisionFloor);
  range=Math.max(range,precisionFloor);
  let lo=center-range/2,hi=center+range/2;
  if(lo<0){hi-=lo;lo=0}
  if(hi<=lo){lo=0;hi=Math.max(.01,range)}
  return{hi,lo};
}
function activeChartOrders(){
  if(tradingMode==='futures')return orders.filter(o=>o.symbol===symbol&&o.status==='open').map(o=>({limit:o.limit,side:o.side==='long'?'buy':'sell',label:`限价 ${o.side==='long'?'开多':'开空'} ${fmt(o.limit,cfg.dec)}`}));
  return spotOrders.filter(o=>o.symbol===symbol&&o.status==='open').map(o=>({limit:o.limit,side:o.side,label:`现货限价 ${o.side==='buy'?'买入':'卖出'} ${fmt(o.limit,cfg.dec)}`}));
}
function xForIndex(idx,geom,pad,plotW){return pad.l+((idx-geom.start)+.5)/visibleCount*plotW}
function timestampAtIndex(idx,all){
  if(!all.length)return Date.now()/1000;
  const info=tfInfo();
  if(!info.calendarMonth)return all[0].t+idx*info.sec;
  const i=Math.floor(idx),frac=idx-i;
  if(i>=0&&i<all.length-1)return all[i].t+(all[i+1].t-all[i].t)*frac;
  const base=i<0?all[0].t:all.at(-1).t,steps=i<0?i:i-all.length+1,d=new Date(base*1000);
  const t0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+steps,1)/1000,t1=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+steps+1,1)/1000;
  return t0+(t1-t0)*frac;
}
function draw(){
  if(currentPage!=='trade'&&currentPage!=='futures')return;
  const W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;
  const pad={l:8,r:82,t:28,b:38},plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b0e12';ctx.fillRect(0,0,W,H);
  const geom=viewGeometry(),{hi,lo}=calcPriceBounds(geom),range=hi-lo,y=p=>pad.t+(hi-p)/range*plotH;
  ctx.font='10px sans-serif';ctx.strokeStyle='#1d232b';ctx.fillStyle='#6f7a8b';
  for(let i=0;i<=5;i++){const yy=pad.t+plotH*i/5;ctx.beginPath();ctx.moveTo(pad.l,yy+.5);ctx.lineTo(W-pad.r,yy+.5);ctx.stroke();ctx.fillText(fmt(Math.max(0,hi-range*i/5),cfg.dec),W-pad.r+5,yy+3)}
  const tickCount=8;
  for(let i=0;i<=tickCount;i++){
    const frac=i/tickCount,idx=geom.start+visibleCount*frac,x=pad.l+plotW*frac,ts=timestampAtIndex(idx,geom.all);
    ctx.strokeStyle='#171c22';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();ctx.fillStyle='#6f7a8b';ctx.fillText(formatTime(ts),Math.max(2,Math.min(W-pad.r-72,x-30)),H-10);
  }
  for(const {idx,c} of geom.visible){
    const x=xForIndex(idx,geom,pad,plotW),cw=plotW/visibleCount;
    if(x<-Math.abs(cw)*2||x>W-pad.r+Math.abs(cw)*2)continue;
    const col=c.c>=c.o?'#3dbb83':'#ec5d68';ctx.strokeStyle=col;ctx.fillStyle=col;
    ctx.beginPath();ctx.moveTo(x,y(c.h));ctx.lineTo(x,y(c.l));ctx.stroke();
    const yo=y(c.o),yc=y(c.c),top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo)),bodyW=Math.max(1,Math.min(40,Math.abs(cw)*.62));
    ctx.fillRect(Math.round(x-bodyW/2),Math.round(top),bodyW,bh);
    if(c.live){ctx.strokeStyle='#5d8cff';ctx.strokeRect(Math.round(x-bodyW/2-2),Math.round(top-2),bodyW+4,bh+4)}
  }
  if(price>=lo&&price<=hi){
    const py=y(price),up=!current||current.c>=current.o,col=up?'#48a77d':'#d65361';ctx.setLineDash([4,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(W-pad.r,py);ctx.stroke();ctx.setLineDash([]);
    const boxY=clamp(py-18,pad.t,H-pad.b-36);ctx.fillStyle=col;ctx.fillRect(W-pad.r,boxY,pad.r,36);ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.fillText(fmt(price,cfg.dec),W-pad.r+5,boxY+14);ctx.font='10px sans-serif';ctx.fillText(candleRemain(),W-pad.r+5,boxY+29);
  }
  for(const o of activeChartOrders()){
    if(o.limit<lo||o.limit>hi)continue;const oy=y(o.limit),col=o.side==='buy'?'#3dbb83':'#ec5d68';
    ctx.setLineDash([6,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,oy);ctx.lineTo(W-pad.r,oy);ctx.stroke();ctx.setLineDash([]);
    const tw=ctx.measureText(o.label).width+12;ctx.fillStyle=o.side==='buy'?'#14251f':'#2a171b';ctx.fillRect(pad.l+8,oy-10,tw,20);ctx.fillStyle=col;ctx.fillText(o.label,pad.l+14,oy+3);
  }
  if(hoverIndex>=0){
    const x=xForIndex(hoverIndex,geom,pad,plotW);if(x>=pad.l&&x<=W-pad.r){ctx.strokeStyle='#4a5362';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke()}
  }
  ctx.strokeStyle='#303741';ctx.beginPath();ctx.moveTo(W-pad.r,pad.t);ctx.lineTo(W-pad.r,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
}

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
      if(now<end+2){current={...bars.pop(),live:true}}
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
    let older=aggregateRealKlines(raw,info).filter(c=>c.t<first);
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
      const d=JSON.parse(ev.data)?.data||JSON.parse(ev.data);
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
function previewLiq(side){const m=+$('marginInput').value||0;if(!m)return null;const entry=orderType==='limit'?(+$('limitPriceInput').value||price):price;return liqPrice(side,entry,$('marginMode').value,m,m*leverage)}
function updatePreview(){const m=+$('marginInput').value||0,n=m*leverage;$('notionalPreview').textContent=fmt(n);$('feePreview').textContent=fmt(n*FEE);const l=previewLiq('long'),s=previewLiq('short');$('longLiq').textContent=l?fmt(l,cfg.dec):'--';$('shortLiq').textContent=s?fmt(s,cfg.dec):'--'}
function stats(){
  const m=marketSnapshots[symbol]||{},arr=currentSeries(),fallback=arr.length?arr.at(-1):null;
  const ch=Number.isFinite(m.change)?m.change:0,hi=Number.isFinite(m.high)?m.high:(fallback?.h||price),lo=Number.isFinite(m.low)?m.low:(fallback?.l||price),vol=Number.isFinite(m.quoteVolume)?m.quoteVolume:0;
  $('lastPrice').textContent=fmt(price,cfg.dec);$('lastPrice').className='pricebig '+(ch>=0?'green':'red');$('midPrice').textContent=fmt(price,cfg.dec);$('midPrice').className='mid '+(ch>=0?'green':'red');
  $('change24').textContent=(ch>=0?'+':'')+ch.toFixed(2)+'%';$('change24').className=ch>=0?'green':'red';$('high24').textContent=fmt(hi,cfg.dec);$('low24').textContent=fmt(lo,cfg.dec);$('vol24').textContent=fmt(vol,0);
  updateAssets();updatePreview();updateFundingUI();updateSpotPanel();renderCoinList();
}
