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

/* Legacy account.js writes to removed v0.0.12 home IDs. Keep invisible targets alive. */
const bridgeObserver=new MutationObserver(()=>{if(!$('homeMarkets')||!$('homeTotalAsset'))ensureLegacyHomeNodes()});
bridgeObserver.observe(document.body,{childList:true,subtree:false});

/* Persist hourly Earn settlement even when the passive UI refresh was the first caller at an hour boundary. */
setInterval(()=>{if(user){try{saveState()}catch{}}},60000);

})();
