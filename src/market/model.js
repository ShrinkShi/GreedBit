/* v0.0.13 multi-asset market model / GREED / fees / earn */
(function(){
'use strict';

const VERSION=window.GB_VERSION||'0.0.26';
const MAKER_RATE=.0002;
const TAKER_RATE=.0006;
const GREED_MAKER_RATE=.00001;
const GREED_TAKER_RATE=.00002;
const GREED_SYMBOL='GREED/USDT';
const HOUR=3600000;

const ASSETS=[
  {ticker:'BTC',symbol:'BTC/USDT',name:'Bitcoin',api:'BTCUSDT',iconPath:'assets/bitcoinicon/btc.png',color:'#f7931a',dec:2,vol:.0002,market:'binance'},
  {ticker:'ETH',symbol:'ETH/USDT',name:'Ethereum',api:'ETHUSDT',iconPath:'assets/bitcoinicon/eth.png',color:'#627eea',dec:2,vol:.0003,market:'binance'},
  {ticker:'SOL',symbol:'SOL/USDT',name:'Solana',api:'SOLUSDT',iconPath:'assets/bitcoinicon/sol.png',color:'#6f6bff',dec:3,vol:.0008,market:'binance'},
  {ticker:'DOGE',symbol:'DOGE/USDT',name:'Dogecoin',api:'DOGEUSDT',iconPath:'assets/bitcoinicon/doge.png',color:'#c2a633',dec:5,vol:.0012,market:'binance'},
  {ticker:'BNB',symbol:'BNB/USDT',name:'BNB',api:'BNBUSDT',iconPath:'assets/bitcoinicon/bnb.png',color:'#f3ba2f',dec:2,vol:.0007,market:'binance'},
  {ticker:'FIL',symbol:'FIL/USDT',name:'Filecoin',api:'FILUSDT',iconPath:'assets/bitcoinicon/fil.png',color:'#0090ff',dec:4,vol:.0013,market:'binance'},
  {ticker:'TRX',symbol:'TRX/USDT',name:'TRON',api:'TRXUSDT',iconPath:'assets/bitcoinicon/trx.png',color:'#ef0027',dec:6,vol:.0007,market:'binance'},
  {ticker:'ZEC',symbol:'ZEC/USDT',name:'Zcash',api:'ZECUSDT',iconPath:'assets/bitcoinicon/zec.png',color:'#f4b728',dec:2,vol:.0013,market:'binance'},
  {ticker:'BTW',symbol:'BTW/USDT',name:'Bitway',api:'BTWUSDT',iconPath:'assets/bitcoinicon/btw.png',color:'#6b8cff',dec:4,vol:.0028,market:'flex',anchor:.95,apiCandidates:['BTWUSDT'],htxCandidates:['btwusdt']},
  {ticker:'牛来',symbol:'牛来/USDT',name:'Niu Lai',api:'牛来USDT',iconPath:'assets/bitcoinicon/牛来.png',color:'#f1b250',dec:5,vol:.0045,market:'flex',anchor:.07,apiCandidates:['牛来USDT','NIULAIUSDT'],htxCandidates:['niulaiusdt']},
  {ticker:'龙虾',symbol:'龙虾/USDT',name:'Lobster',api:'龙虾USDT',iconPath:'assets/bitcoinicon/龙虾.png',color:'#ef6d65',dec:5,vol:.005,market:'flex',anchor:.018,apiCandidates:['龙虾USDT','LOBSTERUSDT'],htxCandidates:['lobsterusdt']},
  {ticker:'GREED',symbol:GREED_SYMBOL,name:'贪婪',api:null,iconPath:'assets/greedbit-logo.png',color:'#5d73ff',dec:4,vol:.012,market:'greed',anchor:.6666}
];
const META=Object.fromEntries(ASSETS.map(x=>[x.symbol,x]));
const BY_TICKER=Object.fromEntries(ASSETS.map(x=>[x.ticker,x]));
const STANDARD=ASSETS.filter(x=>x.market==='binance');
const FLEX=ASSETS.filter(x=>x.market==='flex');

function assetMeta(sym=symbol){return META[sym]||null}
function iconHtml(ticker,cls='coin-icon-img'){
  const m=BY_TICKER[ticker];
  if(m?.iconPath)return `<img class="${cls}" src="${m.iconPath}" alt="${ticker}"/>`;
  return `<span class="${cls}">${String(ticker||'?').slice(0,2)}</span>`;
}

for(const a of ASSETS){
  const prev=configs[a.symbol]||{};
  configs[a.symbol]={...prev,anchor:a.anchor??prev.anchor??0,vol:a.vol??prev.vol??.001,dec:a.dec??prev.dec??4,icon:a.ticker.slice(0,1),color:a.color,iconPath:a.iconPath,api:a.api,market:a.market,name:a.name};
  if(!coinKeys.includes(a.ticker))coinKeys.push(a.ticker);
  if(!marketSnapshots[a.symbol])marketSnapshots[a.symbol]={last:a.market==='greed'?a.anchor:(prev.anchor||a.anchor||0),change:0,high:0,low:0,quoteVolume:0};
}

const baseApiSymbol=apiSymbol;
apiSymbol=function(sym=symbol){const m=META[sym];return m?.api||baseApiSymbol(sym)};

function ensureWalletShape(w){
  if(!w)return w;
  w.spot=w.spot||{usdt:0,frozenUsdt:0,coins:{},frozenCoins:{},cost:{}};
  w.spot.coins=w.spot.coins||{};w.spot.frozenCoins=w.spot.frozenCoins||{};w.spot.cost=w.spot.cost||{};
  for(const a of ASSETS){if(w.spot.coins[a.ticker]==null)w.spot.coins[a.ticker]=0;if(w.spot.frozenCoins[a.ticker]==null)w.spot.frozenCoins[a.ticker]=0;if(w.spot.cost[a.ticker]==null)w.spot.cost[a.ticker]=0}
  w.earn=w.earn||{usdt:0};if(w.earn.usdt==null)w.earn.usdt=0;w.earn.coins=w.earn.coins||{};w.earn.costs=w.earn.costs||{};w.earn.history=Array.isArray(w.earn.history)?w.earn.history:[];
  for(const a of ASSETS){if(w.earn.coins[a.ticker]==null)w.earn.coins[a.ticker]=0;if(w.earn.costs[a.ticker]==null)w.earn.costs[a.ticker]=0}
  if(!Number.isFinite(+w.earn.lastSettled))w.earn.lastSettled=Math.floor(Date.now()/HOUR)*HOUR;
  return w;
}
const baseFreshWallets=freshWallets;
freshWallets=function(){return ensureWalletShape(baseFreshWallets())};
const baseLoadState=loadState;
loadState=function(){baseLoadState();ensureWalletShape(wallets);settleEarnInterest(false)};
ensureWalletShape(wallets);

function greedStateRead(){
  try{const s=JSON.parse(localStorage.getItem('greedbit_greed_state')||'null');if(s&&Number.isFinite(+s.price)&&+s.price>0)return s}catch{}
  const p=configs[GREED_SYMBOL].anchor;return{price:p,open24:p,high:p,low:p,quoteVolume:0,openedAt:Date.now(),lastBtc:0,lastEth:0,eventBias:0,updatedAt:Date.now()}
}
let greedState=greedStateRead();
function saveGreedState(){try{localStorage.setItem('greedbit_greed_state',JSON.stringify(greedState))}catch{}}
function resetGreedDayIfNeeded(){if(Date.now()-Number(greedState.openedAt||0)>=86400000){greedState.open24=greedState.price;greedState.high=greedState.price;greedState.low=greedState.price;greedState.quoteVolume=0;greedState.openedAt=Date.now()}}
function updateGreedSnapshot(){resetGreedDayIfNeeded();const p=+greedState.price||configs[GREED_SYMBOL].anchor;marketSnapshots[GREED_SYMBOL]={last:p,change:greedState.open24?(p/greedState.open24-1)*100:0,high:+greedState.high||p,low:+greedState.low||p,quoteVolume:+greedState.quoteVolume||0,_source:'GreedBit 模拟行情'};}
updateGreedSnapshot();
window.greedbitApplyGreedEvent=function(impact=0){greedState.eventBias=clamp((+greedState.eventBias||0)+clamp(+impact||0,-3,3),-5,5);saveGreedState()};

async function fetchJsonTimeout(url,ms=4500){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(t)}}
async function fetchBinanceTickerCandidate(candidate){return await fetchBinance(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(candidate)}`)}
async function fetchHtxTickerCandidate(candidate){const j=await fetchJsonTimeout(`https://api.huobi.pro/market/detail/merged?symbol=${encodeURIComponent(candidate)}`);if(j.status!=='ok'||!j.tick)throw new Error('HTX ticker unavailable');return{lastPrice:j.tick.close,priceChangePercent:j.tick.open?((j.tick.close/j.tick.open)-1)*100:0,highPrice:j.tick.high,lowPrice:j.tick.low,quoteVolume:j.tick.vol||j.tick.amount||0}}
async function refreshFlexible(sym){
  const m=META[sym],candidates=m.apiCandidates||[m.api];let data=null,source='';
  for(const candidate of candidates){try{data=await fetchBinanceTickerCandidate(candidate);source='Binance';m.api=candidate;break}catch{}}
  if(!data)for(const candidate of (m.htxCandidates||[])){try{data=await fetchHtxTickerCandidate(candidate);source='HTX';break}catch{}}
  if(!data){configs[sym]._v13Fallback=true;return false}
  const snap={last:+data.lastPrice,change:+data.priceChangePercent||0,high:+data.highPrice||+data.lastPrice,low:+data.lowPrice||+data.lastPrice,quoteVolume:+data.quoteVolume||0,_source:source};marketSnapshots[sym]=snap;configs[sym]._v13Fallback=false;configs[sym]._v13Source=source;
  if(sym===symbol&&Number.isFinite(snap.last)&&snap.last>0){price=snap.last;if(currentPage==='trade'||currentPage==='futures'){if(current)applyRealtimeTrade(snap.last,Date.now()/1000,0);else stats()}}
  return true;
}
async function refreshStandardBatch(){
  const symbols=STANDARD.map(x=>x.api);try{
    const rows=await fetchBinance(`/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`);if(!Array.isArray(rows))throw new Error('batch ticker invalid');
    for(const r of rows){const a=STANDARD.find(x=>x.api===r.symbol);if(!a)continue;marketSnapshots[a.symbol]={last:+r.lastPrice,change:+r.priceChangePercent||0,high:+r.highPrice||+r.lastPrice,low:+r.lowPrice||+r.lastPrice,quoteVolume:+r.quoteVolume||0,_source:'Binance'}}
  }catch{
    await Promise.allSettled(STANDARD.map(async a=>{const r=await fetchBinanceTickerCandidate(a.api);marketSnapshots[a.symbol]={last:+r.lastPrice,change:+r.priceChangePercent||0,high:+r.highPrice||+r.lastPrice,low:+r.lowPrice||+r.lastPrice,quoteVolume:+r.quoteVolume||0,_source:'Binance'}}));
  }
}
let lastFlexRefresh=0;
updateMarketSnapshots=async function(){
  await refreshStandardBatch().catch(e=>console.warn('standard ticker refresh failed',e));
  if(Date.now()-lastFlexRefresh>20000){lastFlexRefresh=Date.now();await Promise.allSettled(FLEX.map(x=>refreshFlexible(x.symbol)))}
  updateGreedSnapshot();
  renderCoinList();renderHomeMarkets();updateFooterTickers();if(currentPage==='trade'||currentPage==='futures'){const s=marketSnapshots[symbol];if(s?.last&&symbol!==GREED_SYMBOL&&META[symbol]?.market!=='flex'){latestTicker=s;stats()}}
  if(window.GreedBitV13?.renderEarn)window.GreedBitV13.renderEarn();
};

function htxPeriod(info){const m={time:'1min','1m':'1min','3m':'1min','5m':'5min','10m':'5min','15m':'15min','30m':'30min','1h':'60min','2h':'60min','4h':'4hour','8h':'4hour','1d':'1day','3d':'1day','1w':'1week','1M':'1mon'};return m[info.key]||'5min'}
function aggregateBars(bars,info){if(info.calendarMonth)return bars;const sec=info.sec;if(!bars.length)return[];const out=[];let g=null;for(const c of bars){const t=Math.floor(c.t/sec)*sec;if(!g||g.t!==t){if(g)out.push(g);g={t,end:t+sec,o:c.o,h:c.h,l:c.l,c:c.c,v:c.v,live:false}}else{g.h=Math.max(g.h,c.h);g.l=Math.min(g.l,c.l);g.c=c.c;g.v+=c.v}}if(g)out.push(g);return out}
async function flexibleBars(meta,info){
  for(const candidate of (meta.apiCandidates||[meta.api])){try{const raw=await fetchBinance(`/api/v3/klines?symbol=${encodeURIComponent(candidate)}&interval=${info.api}&limit=500`);if(Array.isArray(raw)&&raw.length){meta.api=candidate;return{bars:aggregateRealKlines(raw,info),source:'Binance'}}}catch{}}
  for(const candidate of (meta.htxCandidates||[])){try{const j=await fetchJsonTimeout(`https://api.huobi.pro/market/history/kline?period=${encodeURIComponent(htxPeriod(info))}&size=500&symbol=${encodeURIComponent(candidate)}`,6000);if(j.status!=='ok'||!Array.isArray(j.data)||!j.data.length)throw new Error('HTX history unavailable');const base=j.data.slice().reverse().map(k=>({t:+k.id,end:+k.id+Math.max(60,info.sec),o:+k.open,h:+k.high,l:+k.low,c:+k.close,v:+k.amount||+k.vol||0,live:false}));return{bars:aggregateBars(base,info),source:'HTX'}}catch{}}
  throw new Error('no public kline source');
}
function seededNoise(seed){const x=Math.sin(seed*12.9898+78.233)*43758.5453;return((x-Math.floor(x))*2-1)}
async function correlatedBars(meta,info,target){
  const [br,er]=await Promise.all([fetchBinance(`/api/v3/klines?symbol=BTCUSDT&interval=${info.api}&limit=500`),fetchBinance(`/api/v3/klines?symbol=ETHUSDT&interval=${info.api}&limit=500`)]);
  let bb=aggregateRealKlines(br,info),ee=aggregateRealKlines(er,info),n=Math.min(bb.length,ee.length);bb=bb.slice(-n);ee=ee.slice(-n);let p=Math.max(.000001,target||meta.anchor||1),tmp=[];
  for(let i=0;i<n;i++){const b=bb[i],e=ee[i],rb=b.o?Math.log(Math.max(1e-9,b.c/b.o)):0,re=e.o?Math.log(Math.max(1e-9,e.c/e.o)):0,beta=meta.market==='greed'?2.65:2.1,noise=seededNoise((b.t||0)+(meta.ticker.charCodeAt(0)||1))*Math.max(.0008,meta.vol*.22),r=clamp(beta*(rb*.58+re*.42)+noise,-.22,.22),o=p,c=Math.max(.000001,o*Math.exp(r)),wick=Math.max(Math.abs(c-o)*.7,o*Math.abs(noise)*1.8);tmp.push({t:b.t,end:b.end||bucketEnd(b.t,info),o,h:Math.max(o,c)+wick,l:Math.max(.000001,Math.min(o,c)-wick),c,v:Math.max(1,(b.v+e.v)*(.03+Math.abs(noise)*3)),live:false});p=c}
  if(tmp.length&&target>0){const scale=target/tmp.at(-1).c;tmp=tmp.map(c=>({...c,o:c.o*scale,h:c.h*scale,l:c.l*scale,c:c.c*scale}))}
  return tmp;
}
function applyBars(bars,resetView,source){
  if(!bars.length)throw new Error('empty bars');const info=tfInfo(),now=Date.now()/1000;current=null;const list=bars.slice();const last=list.at(-1),end=last.end||bucketEnd(last.t,info);if(now<end+2)current={...list.pop(),live:true};candles=list;price=current?.c||candles.at(-1)?.c||price;const all=currentSeries(),lastT=all.at(-1)?.t||0;let ref=all[0];for(let i=all.length-1;i>=0;i--){if(lastT-all[i].t>=86400){ref=all[i];break}}const hi=Math.max(...all.slice(-120).map(x=>x.h)),lo=Math.min(...all.slice(-120).map(x=>x.l));marketSnapshots[symbol]={...(marketSnapshots[symbol]||{}),last:price,high:hi,low:lo,change:ref?.o?(price/ref.o-1)*100:0,_source:source};if(resetView){visibleCount=72;viewShift=0;yZoom=1;yPan=0;hoverIndex=-1}setMarketStatus('live',source);renderBook();stats();draw();renderCoinList();renderHomeMarkets();
}
const baseLoadHistorical=loadHistoricalMarket;
loadHistoricalMarket=async function(resetView=true){
  const meta=META[symbol];if(!meta)return baseLoadHistorical(resetView);
  if(meta.market==='greed'){
    closeMarketSocket();setMarketStatus('connecting','生成 GREED 模拟行情…');try{const bars=await correlatedBars(meta,tfInfo(),greedState.price);applyBars(bars,resetView,'GREED 模拟行情 · BTC/ETH 驱动')}catch(e){console.error(e);setMarketStatus('error','GREED 模拟行情生成失败')}return;
  }
  if(meta.market==='flex'){
    closeMarketSocket();setMarketStatus('connecting',`正在连接 ${meta.ticker} 公共行情…`);try{const r=await flexibleBars(meta,tfInfo());configs[symbol]._v13Fallback=false;configs[symbol]._v13Source=r.source;applyBars(r.bars,resetView,`${r.source} 公共行情已连接`);await refreshFlexible(symbol)}catch(e){console.warn(`${meta.ticker} public market unavailable, using reference simulation`,e);configs[symbol]._v13Fallback=true;try{const target=marketSnapshots[symbol]?.last||meta.anchor;const bars=await correlatedBars(meta,tfInfo(),target);applyBars(bars,resetView,`${meta.ticker} 参考模拟行情 · 公共源暂不可用`)}catch(err){console.error(err);setMarketStatus('error',`${meta.ticker} 行情不可用`)}}return;
  }
  return baseLoadHistorical(resetView);
};

const baseConnectMarketSocket=connectMarketSocket;
connectMarketSocket=function(hostIndex=0){const meta=META[symbol];if(meta?.market==='greed'||meta?.market==='flex'){closeMarketSocket(false);if(meta.market==='greed')setMarketStatus('live','GREED 模拟行情 · BTC/ETH 驱动');else setMarketStatus('live',configs[symbol]._v13Fallback?`${meta.ticker} 参考模拟行情`:`${configs[symbol]._v13Source||'公共'} 行情已连接`);return}return baseConnectMarketSocket(hostIndex)};
const baseRenderBookV13=renderBook;
function renderSyntheticBook(){const p=price||marketSnapshots[symbol]?.last||1,spread=Math.max(p*.00015,Math.pow(10,-cfg.dec)),rows=9;let ac=0,bc=0;const ask=[],bid=[];for(let i=rows;i>=1;i--){const q=(1+Math.abs(seededNoise(Date.now()/4000+i)))*Math.max(.01,100/p);ac+=q;ask.push(`<div class="obrow"><i class="depth" style="width:${(rows-i+1)/rows*100}%;background:#ec5d68"></i><span class="red">${fmt(p+spread*i,cfg.dec)}</span><span>${fmt(q,4)}</span><span>${fmt(ac,4)}</span></div>`)}for(let i=1;i<=rows;i++){const q=(1+Math.abs(seededNoise(Date.now()/5000+i+41)))*Math.max(.01,100/p);bc+=q;bid.push(`<div class="obrow"><i class="depth" style="width:${i/rows*100}%;background:#3dbb83"></i><span class="green">${fmt(Math.max(.000001,p-spread*i),cfg.dec)}</span><span>${fmt(q,4)}</span><span>${fmt(bc,4)}</span></div>`)}if($('asks'))$('asks').innerHTML=ask.join('');if($('bids'))$('bids').innerHTML=bid.join('');setBookMode(true);if($('midPrice'))$('midPrice').textContent=fmt(p,cfg.dec)}
renderBook=async function(){const meta=META[symbol];if(meta?.market==='greed'||configs[symbol]?._v13Fallback||configs[symbol]?._v13Source==='HTX'){renderSyntheticBook();return}return baseRenderBookV13()};

function tickGreed(){
  const b=+marketSnapshots['BTC/USDT']?.last||0,e=+marketSnapshots['ETH/USDT']?.last||0;if(!b||!e)return;resetGreedDayIfNeeded();const rb=greedState.lastBtc?Math.log(b/greedState.lastBtc):0,re=greedState.lastEth?Math.log(e/greedState.lastEth):0;greedState.lastBtc=b;greedState.lastEth=e;greedState.eventBias=(+greedState.eventBias||0)*.985;let r=2.65*(rb*.58+re*.42)+randn()*.00012+greedState.eventBias*.00013;r=clamp(r,-.018,.018);greedState.price=Math.max(.0001,(+greedState.price||configs[GREED_SYMBOL].anchor)*Math.exp(r));greedState.high=Math.max(+greedState.high||greedState.price,greedState.price);greedState.low=Math.min(+greedState.low||greedState.price,greedState.price);const v=Math.max(50,Math.abs(randn())*1800);greedState.quoteVolume=(+greedState.quoteVolume||0)+v*greedState.price;greedState.updatedAt=Date.now();updateGreedSnapshot();if(symbol===GREED_SYMBOL){setMarketStatus('live','GREED 模拟行情 · BTC/ETH + 新闻事件驱动');applyRealtimeTrade(greedState.price,Date.now()/1000,v)}if(Math.random()<.04)saveGreedState()}
every(tickGreed,1000);

function feeQuote(notional,liquidity='taker',greedReserved=0){
  notional=Math.max(0,+notional||0);const maker=liquidity==='maker',normalRate=maker?MAKER_RATE:TAKER_RATE,greedRate=maker?GREED_MAKER_RATE:GREED_TAKER_RATE,gp=+marketSnapshots[GREED_SYMBOL]?.last||+greedState.price||0,discounted=notional*greedRate,gqty=gp?discounted/gp:Infinity,available=user?Math.max(0,spotAvailableCoin('GREED')-(+greedReserved||0)):0;if(gp>0&&gqty>0&&available+1e-12>=gqty)return{asset:'GREED',rate:greedRate,usdt:discounted,amount:gqty,price:gp,liquidity};return{asset:'USDT',rate:normalRate,usdt:notional*normalRate,amount:notional*normalRate,price:1,liquidity}
}
function consumeFee(q,sym,note,wallet){
  if(q.asset==='GREED'){
    const w=spotWallet(),old=+w.coins.GREED||0,avg=old?(+w.cost.GREED||0)/old:0;w.coins.GREED=Math.max(0,old-q.amount);w.cost.GREED=Math.max(0,(+w.cost.GREED||0)-avg*q.amount)
  }
  accountStats.fees+=q.usdt;addLedger(q.asset==='GREED'?'GREED手续费抵扣':'交易手续费',-q.usdt,sym,`${note} · ${q.asset==='GREED'?`${fmt(q.amount,6)} GREED 抵扣`:`${fmt(q.usdt,4)} USDT`}`,wallet)
}
function feeText(q){return q.asset==='GREED'?`${fmt(q.amount,6)} GREED (≈ ${fmt(q.usdt,4)} USDT)`:`${fmt(q.usdt,4)} USDT`}

spotFill=function(side,qty,fill,source='市价',reserved=0){
  const w=spotWallet(),c=base(),notional=qty*fill,liquidity=/限价|maker/i.test(source)?'maker':'taker',greedReserved=side==='sell'&&c==='GREED'?qty:0,q=feeQuote(notional,liquidity,greedReserved),usdtFee=q.asset==='USDT'?q.usdt:0;
  if(side==='buy'){
    const need=notional+usdtFee;if(!reserved){if(need>w.usdt+1e-10)return false;w.usdt-=need}else{if(need>reserved+w.usdt+1e-10)return false;w.frozenUsdt=Math.max(0,w.frozenUsdt-reserved);if(need>reserved)w.usdt-=need-reserved;else w.usdt+=reserved-need}
    const prev=+w.coins[c]||0;w.coins[c]=prev+qty;w.cost[c]=(+w.cost[c]||0)+notional+q.usdt;
  }else{
    if(qty>spotAvailableCoin(c)+1e-10&&!reserved)return false;if(reserved)w.frozenCoins[c]=Math.max(0,(+w.frozenCoins[c]||0)-qty);const old=+w.coins[c]||0,avg=old?(+w.cost[c]||0)/old:0,realized=(fill-avg)*qty-q.usdt;w.coins[c]=Math.max(0,old-qty);w.cost[c]=Math.max(0,(+w.cost[c]||0)-avg*qty);w.usdt+=notional-usdtFee;if(realized>=0)accountStats.realizedProfit+=realized;else accountStats.realizedLoss+=Math.abs(realized)
  }
  consumeFee(q,symbol,source,'spot');accountStats.spotTrades++;spotTrades.unshift({time:nowText(),ts:Date.now()/1000,symbol,side,qty,price:fill,type:source,fee:q.usdt,feeAsset:q.asset,feeAmount:q.amount});playFillSound();saveState();return true;
};
placeSpotOrder=function(){
  if(!user)return openAuth('login');if(!ensureStateFresh())return;if(!marketReady||!price)return notify('下单失败','当前行情尚未连接','error');const w=spotWallet(),c=base(),amt=+$('spotAmountInput').value;if(!amt||amt<=0)return notify('下单失败','请输入有效金额/数量','error');
  if(spotOrderType==='market'){
    if(spotSide==='buy'){const fill=price*(1+cfg.vol*.02),qty=amt/fill;if(!spotFill('buy',qty,fill,'市价买入'))return notify('下单失败','现货账户 USDT 不足','error');notify('现货成交',`买入 ${fmt(qty,6)} ${c} @ ${fmt(fill,cfg.dec)}`)}
    else{const fill=price*(1-cfg.vol*.02),qty=amt;if(!spotFill('sell',qty,fill,'市价卖出'))return notify('下单失败',`${c} 可用数量不足`,'error');notify('现货成交',`卖出 ${fmt(qty,6)} ${c} @ ${fmt(fill,cfg.dec)}`)}
  }else{
    const limit=+$('spotLimitInput').value;if(!limit||limit<=0)return notify('挂单失败','请输入限价','error');if(spotSide==='buy'){const reserve=amt*(1+MAKER_RATE);if(reserve>w.usdt)return notify('挂单失败','现货账户 USDT 不足','error');w.usdt-=reserve;w.frozenUsdt+=reserve;spotOrders.unshift({id:nextId++,symbol,side:'buy',limit,amount:amt,reserved:reserve,status:'open',createdAt:nowText()})}else{const qty=amt;if(qty>spotAvailableCoin(c))return notify('挂单失败',`${c} 可用数量不足`,'error');w.frozenCoins[c]=(+w.frozenCoins[c]||0)+qty;spotOrders.unshift({id:nextId++,symbol,side:'sell',limit,qty,reserved:qty,status:'open',createdAt:nowText()})}notify('现货限价委托已提交',`${spotSide==='buy'?'买入':'卖出'} ${c} @ ${fmt(limit,cfg.dec)}`,'info')
  }
  $('spotAmountInput').value='';$('spotPct').value=0;$('spotPctValue').textContent='0%';renderTable();updateAssets();saveState();draw();
};
if($('spotActionBtn'))$('spotActionBtn').onclick=placeSpotOrder;

executeOpen=function(side,margin,entry,mode,lev,tp,sl,source='市价开仓',fromReserved=false,targetSymbol=symbol){
  const book=window.GreedBitPositionBook;
  if(!(margin>0&&entry>0&&lev>0)||!book?.canOpen(positions,{symbol:targetSymbol,mode,leverage:lev}))return null;
  const w=futuresWallet(),notional=margin*lev,liquidity=/限价|maker/i.test(source)?'maker':'taker',q=feeQuote(notional,liquidity),usdtFee=q.asset==='USDT'?q.usdt:0,qty=notional/entry;
  if(!fromReserved){
    if(margin+usdtFee>w.usdt+1e-10)return null;
    w.usdt-=margin+usdtFee;
  }else{
    const reserved=margin+notional*(liquidity==='maker'?MAKER_RATE:TAKER_RATE);
    if(w.frozen+1e-10<reserved)return null;
    const need=margin+usdtFee;
    if(need>reserved&&need-reserved>w.usdt+1e-10)return null;
    w.frozen=Math.max(0,w.frozen-reserved);
    w.usdt+=reserved-need;
  }
  consumeFee(q,targetSymbol,source,'futures');
  const at=Date.now(),lot={id:nextId++,symbol:targetSymbol,side,mode,leverage:lev,margin,notional,qty,entry,fee:q.usdt,feeAsset:q.asset,tp:tp||null,sl:sl||null,openedAt:nowText(),openedTs:at/1000};
  const position=book.add(positions,lot);
  position.liq=liqPrice(position.side,position.entry,position.mode,position.margin,position.notional,position.id,position.symbol);
  trades.unshift({time:lot.openedAt,ts:lot.openedTs,symbol:targetSymbol,side,qty,price:entry,type:source,fee:q.usdt,feeAsset:q.asset});
  accountStats.trades++;
  playFillSound();saveState();notifyPositionBookChanged();return position;
};
placeOrder=function(side){
  if(!user)return openAuth('login');if(!ensureStateFresh())return;if(!marketReady||!price)return notify('下单失败','当前行情尚未连接','error');const w=futuresWallet(),margin=+$('marginInput').value,mode=$('marginMode').value,tpsl=$('tpslEnable').checked,tp=tpsl?(+$('tpInput').value||0):0,sl=tpsl?(+$('slInput').value||0):0;if(!margin||margin<=0)return notify('下单失败','请输入有效保证金','error');
  const book=window.GreedBitPositionBook;
  if(!book?.canOpen(positions,{symbol,mode,leverage})){
    const locked=book.lockedLeverage(positions,symbol);
    syncCrossLeverage();
    return notify('杠杆已锁定',`${symbol} 全仓持仓使用 ${locked}X，需按该杠杆开仓`,'warning');
  }
  const notional=margin*leverage,liq=orderType==='limit'?'maker':'taker',q=feeQuote(notional,liq),feeUsdt=q.asset==='USDT'?q.usdt:0,total=margin+feeUsdt;if(total>w.usdt)return notify('下单失败','合约账户可用保证金不足','error');
  if(orderType==='market'){const entry=price*(1+(side==='long'?1:-1)*cfg.vol*.025),err=validateTPSL(side,entry,tp,sl);if(err)return notify('下单失败',err,'error');if(!executeOpen(side,margin,entry,mode,leverage,tp,sl))return;notify('下单成功',`${side==='long'?'开多':'开空'} ${base()} @ ${fmt(entry,cfg.dec)}`)}
  else{const limit=+$('limitPriceInput').value;if(!limit||limit<=0)return notify('挂单失败','请输入有效委托价','error');const err=validateTPSL(side,limit,tp,sl);if(err)return notify('挂单失败',err,'error');const reserve=margin+notional*MAKER_RATE;if(reserve>w.usdt)return notify('挂单失败','合约账户可用保证金不足','error');w.usdt-=reserve;w.frozen+=reserve;orders.unshift({id:nextId++,createdAt:nowText(),symbol,side,mode,leverage,margin,limit,tp:tp||null,sl:sl||null,reserved:reserve,status:'open'});notify('限价委托已提交',`${side==='long'?'开多':'开空'} ${base()} @ ${fmt(limit,cfg.dec)}`,'info');matchOrders()}
  $('marginInput').value='';$('tpInput').value='';$('slInput').value='';$('pct').value=0;$('pctValue').textContent='0%';updatePreview();renderTable();updateAssets();saveState();draw();
};
closePosition=function(id,reason='手动平仓',fill=price,fraction=1,liquidity='taker'){
  const w=futuresWallet(),idx=positions.findIndex(p=>p.id===id);
  if(idx<0||!Number.isFinite(+fill)||!(+fill>0)||!(fraction>0&&fraction<=1))return null;
  const p=positions[idx],f=fraction,qty=p.qty*f,margin=p.margin*f;
  const gross=(fill-p.entry)*qty*(p.side==='long'?1:-1),q=feeQuote(Math.abs(qty*fill),liquidity),usdtFee=q.asset==='USDT'?q.usdt:0;
  const openFeeShare=(+p.fee||0)*f;
  const domain=window.GreedBitDomain;
  const settled=domain?.settleClose?.({side:p.side,entry:p.entry,fill,qty,openFee:openFeeShare,closeFee:usdtFee});
  const realized=settled?settled.realized:gross-usdtFee-openFeeShare;
  w.usdt+=margin+(settled?settled.cashDelta:gross-usdtFee);
  consumeFee(q,p.symbol,reason,'futures');
  if(realized>=0)accountStats.realizedProfit+=realized;else accountStats.realizedLoss+=Math.abs(realized);
  if(reason==='强制平仓')accountStats.liquidations++;
  addLedger(realized>=0?'已实现盈利':'已实现亏损',realized,p.symbol,reason,'futures');
  trades.unshift({time:nowText(),ts:Date.now()/1000,symbol:p.symbol,side:p.side==='long'?'sell':'buy',qty,price:fill,type:reason,fee:q.usdt,feeAsset:q.asset});
  closedPositions.unshift({...p,qty,margin,notional:p.notional*f,close:fill,realized,gross,fee:openFeeShare,closeFee:q.usdt,feeAsset:q.asset,reason,closedAt:nowText(),partial:f<1});
  if(f>=1-1e-9){
    positions.splice(idx,1);
    const stale=closeOrders.filter(o=>o.positionId===id);
    for(const o of stale)orderHistory.unshift({...o,type:'限价平仓',status:'已撤销（仓位已平）',finishedAt:nowText(),finishedTs:Date.now()});
    closeOrders=closeOrders.filter(o=>o.positionId!==id);
  }else{
    p.qty-=qty;p.margin-=margin;p.notional*=1-f;
    p.fee=Math.max(0,(+p.fee||0)-openFeeShare);
    p.liq=liqPrice(p.side,p.entry,p.mode,p.margin,p.notional,p.id,p.symbol);
  }
  playFillSound();notify(reason,`${p.symbol} ${realized>=0?'+':''}${fmt(realized)} USDT`,realized>=0?'success':'warning');
  renderTable();updateAssets();saveState();notifyPositionBookChanged();draw();return realized;
};
const baseUpdatePreviewV13=updatePreview;
updatePreview=function(){
  const m=+$('marginInput')?.value||0,n=m*leverage;if($('notionalPreview'))$('notionalPreview').textContent=fmt(n);if($('feePreview')){const q=feeQuote(n,orderType==='limit'?'maker':'taker');$('feePreview').textContent=feeText(q)}const l=previewLiq('long'),s=previewLiq('short');if($('longLiq'))$('longLiq').textContent=l?fmt(l,cfg.dec):'--';if($('shortLiq'))$('shortLiq').textContent=s?fmt(s,cfg.dec):'--';if(!Number.isFinite(n))baseUpdatePreviewV13()
};
if($('marginInput'))$('marginInput').oninput=updatePreview;if($('limitPriceInput'))$('limitPriceInput').oninput=updatePreview;if($('marginMode'))$('marginMode').onchange=()=>{syncCrossLeverage();updatePreview()};

function earnApr(ticker){if(ticker==='USDT')return .04;if(ticker==='BTC')return .01;if(ticker==='ETH')return .016;if(ticker==='SOL')return .018;if(ticker==='DOGE')return .03;if(ticker==='GREED')return .04;return .05}
function earnInterestForHour(ticker,balance){if(balance<=0)return 0;if(ticker==='USDT'){const promo=Math.min(500,balance),rest=Math.max(0,balance-500);return promo*.10/8760+rest*.04/8760}return balance*earnApr(ticker)/8760}
function settleEarnInterest(write=true){
  if(!user||!wallets?.earn)return 0;ensureWalletShape(wallets);const e=wallets.earn,nowHour=Math.floor(Date.now()/HOUR)*HOUR,last=Math.floor((+e.lastSettled||nowHour)/HOUR)*HOUR,hours=Math.max(0,Math.min(24*366*3,Math.floor((nowHour-last)/HOUR)));if(!hours)return 0;let usdtEquivalent=0,paid={};for(let h=0;h<hours;h++){
    if(e.usdt>0){const x=earnInterestForHour('USDT',e.usdt);e.usdt+=x;paid.USDT=(paid.USDT||0)+x;usdtEquivalent+=x}
    for(const a of ASSETS){const t=a.ticker,b=+e.coins[t]||0;if(b<=0)continue;const x=earnInterestForHour(t,b);e.coins[t]=b+x;paid[t]=(paid[t]||0)+x;usdtEquivalent+=x*(+marketSnapshots[a.symbol]?.last||0)}
  }e.lastSettled=nowHour;e.history.unshift({time:Date.now(),hours,paid});e.history=e.history.slice(0,100);if(write){saveState();if(usdtEquivalent>0)notify('赚币利息已到账',`本次结算约 ${fmt(usdtEquivalent,4)} USDT`,'success')}return usdtEquivalent
}
function earnValueNet(){ensureWalletShape(wallets);let v=+wallets.earn.usdt||0;for(const a of ASSETS){const q=+wallets.earn.coins[a.ticker]||0,p=markFor(a.symbol);if(q&&p)v+=q*p*(1-TAKER_RATE)}return v}
function spotCoinValueNet(){const w=spotWallet();return coinKeys.reduce((sum,t)=>{const q=+w.coins[t]||0,m=BY_TICKER[t];if(!m||!q)return sum;const p=markFor(m.symbol);return sum+q*p*(1-TAKER_RATE)},0)}
spotCoinValue=function(){return spotCoinValueNet()};
totalAsset=function(){if(!wallets)return 0;settleEarnInterest(false);return walletUsdt('fiat')+walletUsdt('strategy')+spotWallet().usdt+spotWallet().frozenUsdt+spotCoinValueNet()+futuresEquity()+earnValueNet()};
function dailyPnl(){if(!user)return{value:0,pct:0};const eq=totalAsset(),flow=(+accountStats.inflow||0)-(+accountStats.outflow||0),d=new Date(),day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,key=`greedbit_daily_equity_${user.username}`;let s=null;try{s=JSON.parse(localStorage.getItem(key)||'null')}catch{}if(!s||s.day!==day||!Number.isFinite(+s.equity)){s={day,equity:eq,flow};localStorage.setItem(key,JSON.stringify(s))}const value=eq-(+s.equity||0)-(flow-(+s.flow||0)),pct=(+s.equity||0)>0?value/(+s.equity)*100:0;return{value,pct}}

const baseRenderCoinListV13=renderCoinList;
renderCoinList=function(){const box=$('coinList');if(!box)return;const q=($('coinSearch')?.value||'').toUpperCase();box.innerHTML=ASSETS.filter(a=>(a.symbol+a.name+a.ticker).toUpperCase().includes(q)).map(a=>{const m=marketSnapshots[a.symbol]||{},last=+m.last||0,ch=+m.change||0;return`<div class="coin-row ${a.symbol===symbol?'active':''}" data-symbol="${a.symbol}"><div class="coin-name">${iconHtml(a.ticker,'coin-icon coin-icon-img')}<span><b>${a.ticker}</b><small>${a.name}</small></span></div><span>${last?fmt(last,a.dec):'--'}</span><span class="${ch>=0?'green':'red'}">${last?(ch>=0?'+':'')+ch.toFixed(2)+'%':'--'}</span></div>`}).join('');if(!box.innerHTML)baseRenderCoinListV13()};
const baseSetSymbolV13=setSymbol;
setSymbol=async function(sym){if(!configs[sym])return;if(sym===symbol){$('coinPicker')?.classList.add('hidden');return}++marketLoadSeq;await baseSetSymbolV13(sym);cfg=configs[symbol];if(window.GreedBitV13?.updateFeeUi)window.GreedBitV13.updateFeeUi()};

window.GreedBitV13={VERSION,ASSETS,META,BY_TICKER,MAKER_RATE,TAKER_RATE,GREED_MAKER_RATE,GREED_TAKER_RATE,assetMeta,iconHtml,feeQuote,feeText,earnApr,settleEarnInterest,earnValueNet,dailyPnl,ensureWalletShape,updateFeeUi:null,renderEarn:null};
every(()=>{if(user){const got=settleEarnInterest(true);if(got&&window.GreedBitV13?.renderEarn)window.GreedBitV13.renderEarn()}},60000);
setTimeout(()=>updateMarketSnapshots(),100);
})();
