/* v0.0.13 compatibility fixes for legacy modules */
(function(){
'use strict';
const V=window.GreedBitV13;if(!V)return;

function ensureLegacyHomeNodes(){
  let host=$('v13LegacyHomeBridge');
  if(!host){host=document.createElement('div');host.id='v13LegacyHomeBridge';host.className='hidden';host.innerHTML='<div id="homeMarkets"></div><span id="homeTotalAsset"></span>';document.body.appendChild(host)}
}
function ensureSymbolOptions(){const sel=$('symbol');if(!sel)return;const existing=new Set([...sel.options].map(o=>o.value));for(const a of V.ASSETS)if(!existing.has(a.symbol)){const o=document.createElement('option');o.value=a.symbol;o.textContent=a.symbol;sel.appendChild(o)}}
function forceChartMode(){
  const tabs=[...document.querySelectorAll('.charttabs span')];tabs.forEach((x,i)=>x.classList.toggle('active',i===0));
  $('timebar')?.classList.remove('hidden');$('chartwrap')?.classList.remove('hidden');$('contractInfoPanel')?.classList.add('hidden');$('layout')?.classList.remove('contract-info-mode');
}
function setRecentTradeAvailability(enabled){
  const trades=document.querySelector('[data-booktab="trades"]'),book=document.querySelector('[data-booktab="book"]');if(trades)trades.classList.toggle('hidden',!enabled);if(!enabled){if(book)book.classList.add('active');trades?.classList.remove('active');$('recentTrades')?.classList.add('hidden');document.querySelector('.orderbook .obhead')?.classList.remove('hidden');$('asks')?.classList.remove('hidden');$('midPrice')?.classList.remove('hidden');$('bids')?.classList.remove('hidden')}
}

ensureLegacyHomeNodes();ensureSymbolOptions();

const inheritedSetSymbol=setSymbol;
setSymbol=async function(sym){
  if(!configs[sym])return;
  const legacySupported=sym==='BTC/USDT'||sym==='ETH/USDT';
  if(legacySupported){setRecentTradeAvailability(true);return inheritedSetSymbol(sym)}
  if(sym===symbol){$('coinPicker')?.classList.add('hidden');return}
  forceChartMode();setRecentTradeAvailability(false);
  symbol=sym;cfg=configs[sym];price=marketSnapshots[sym]?.last||cfg.anchor||price;
  const sel=$('symbol');if(sel)sel.value=sym;if($('pairName'))$('pairName').textContent=sym;
  if($('limitPriceInput'))$('limitPriceInput').value='';if($('spotLimitInput'))$('spotLimitInput').value='';$('coinPicker')?.classList.add('hidden');
  await loadHistoricalMarket(true);renderTable();updateAssets();V.updateFeeUi?.();
};

/* Correct the GREED fee edge case when a GREED limit-sell is already frozen. */
function consumeFeeCompat(q,sym,note,wallet){
  if(q.asset==='GREED'){
    const w=spotWallet(),old=+w.coins.GREED||0,avg=old?(+w.cost.GREED||0)/old:0;
    w.coins.GREED=Math.max(0,old-q.amount);w.cost.GREED=Math.max(0,(+w.cost.GREED||0)-avg*q.amount)
  }
  accountStats.fees+=q.usdt;addLedger(q.asset==='GREED'?'GREED手续费抵扣':'交易手续费',-q.usdt,sym,`${note} · ${q.asset==='GREED'?`${fmt(q.amount,6)} GREED 抵扣`:`${fmt(q.usdt,4)} USDT`}`,wallet)
}
spotFill=function(side,qty,fill,source='市价',reserved=0){
  const w=spotWallet(),c=base(),notional=qty*fill,liquidity=/限价|maker/i.test(source)?'maker':'taker';
  const greedReserved=side==='sell'&&c==='GREED'&&!reserved?qty:0,q=V.feeQuote(notional,liquidity,greedReserved),usdtFee=q.asset==='USDT'?q.usdt:0;
  if(side==='buy'){
    const need=notional+usdtFee;if(!reserved){if(need>w.usdt+1e-10)return false;w.usdt-=need}else{if(need>reserved+w.usdt+1e-10)return false;w.frozenUsdt=Math.max(0,w.frozenUsdt-reserved);if(need>reserved)w.usdt-=need-reserved;else w.usdt+=reserved-need}
    const prev=+w.coins[c]||0;w.coins[c]=prev+qty;w.cost[c]=(+w.cost[c]||0)+notional+q.usdt;
  }else{
    if(qty>spotAvailableCoin(c)+1e-10&&!reserved)return false;if(reserved)w.frozenCoins[c]=Math.max(0,(+w.frozenCoins[c]||0)-qty);const old=+w.coins[c]||0,avg=old?(+w.cost[c]||0)/old:0,realized=(fill-avg)*qty-q.usdt;w.coins[c]=Math.max(0,old-qty);w.cost[c]=Math.max(0,(+w.cost[c]||0)-avg*qty);w.usdt+=notional-usdtFee;if(realized>=0)accountStats.realizedProfit+=realized;else accountStats.realizedLoss+=Math.abs(realized)
  }
  consumeFeeCompat(q,symbol,source,'spot');accountStats.spotTrades++;spotTrades.unshift({time:nowText(),ts:Date.now()/1000,symbol,side,qty,price:fill,type:source,fee:q.usdt,feeAsset:q.asset,feeAmount:q.amount});playFillSound();saveState();return true;
};

/* Keep the compact footer readable after the market universe expands. */
updateFooterTickers=function(){const box=$('footerTickers');if(!box)return;const focus=['BTC/USDT','ETH/USDT','SOL/USDT','GREED/USDT'];box.innerHTML=focus.map(sym=>{const m=marketSnapshots[sym]||{},ch=Number(m.change)||0,a=V.META[sym];return`<span class="ticker ${ch>=0?'up':'down'}">${a?.ticker||sym} ${ch>=0?'+':''}${ch.toFixed(2)}%</span>`}).join('')};
updateFooterTickers();

/* Legacy account.js writes to removed v0.0.12 home IDs. Keep invisible targets alive. */
const bridgeObserver=new MutationObserver(()=>{if(!$('homeMarkets')||!$('homeTotalAsset'))ensureLegacyHomeNodes()});
bridgeObserver.observe(document.body,{childList:true,subtree:false});

/* Persist hourly Earn settlement even when the passive UI refresh was the first caller at an hour boundary. */
setInterval(()=>{if(user){try{saveState()}catch{}}},60000);

function loadV17Core(){if(document.querySelector('script[src="src/v017.js"]'))return;const n=document.createElement('script');n.src='src/v017.js';document.body.appendChild(n)}
function loadV17(){if(document.querySelector('script[src="src/v017-manifest-preload.js"]')){loadV17Core();return}const p=document.createElement('script');p.src='src/v017-manifest-preload.js';p.onload=loadV17Core;document.body.appendChild(p)}
function loadV16(){if(document.querySelector('script[src="src/v016.js"]')){loadV17();return}const n=document.createElement('script');n.src='src/v016.js';n.onload=loadV17;document.body.appendChild(n)}
function loadV15(){if(document.querySelector('script[src="src/v015.js"]')){loadV16();return}const n=document.createElement('script');n.src='src/v015.js';n.onload=loadV16;document.body.appendChild(n)}
/* v0.0.14 -> v0.0.15 -> v0.0.16 -> v0.0.17. Later layers deliberately override earlier behavior. */
if(!document.querySelector('script[src="src/v014.js"]')){const s=document.createElement('script');s.src='src/v014.js';s.onload=loadV15;document.body.appendChild(s)}else loadV15();

})();
