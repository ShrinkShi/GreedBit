/* spot
 * IMPORTANT: spotFill / placeSpotOrder are implemented in src/market/model.js and
 * src/app/compatibility.js, which bootstrap.js loads after this file and intentionally
 * overrides. This file must keep the global *bindings* because those modules run in
 * strict mode and assign to these names.
 *
 * The stubs throw if called, so a broken load order fails loudly instead of silently
 * using the retired fee model (flat SPOT_FEE, no GREED discount).
 *
 * Only the non-overridden pieces live here: available-balance helper, side panel painter,
 * limit-order cancel/match.
 */
function spotFill(){throw new Error('spotFill: 实现位于 src/market/model.js / src/app/compatibility.js')}
function placeSpotOrder(){throw new Error('placeSpotOrder: 实现位于 src/market/model.js')}

function spotAvailableCoin(c){const w=spotWallet();return Math.max(0,(w.coins[c]||0)-(w.frozenCoins[c]||0))}
function updateSpotPanel(){
  if(!$('spotBalanceLine'))return;const w=spotWallet(),c=base(),buy=spotSide==='buy';
  $('spotBalanceLine').textContent=buy?`可用：${fmt(w.usdt)} USDT`:`可用：${fmt(spotAvailableCoin(c),6)} ${c}`;
  $('spotAmountLabel').textContent=buy?'金额':'数量';$('spotAmountUnit').textContent=buy?'USDT':c;$('spotActionBtn').textContent=(buy?'买入 ':'卖出 ')+c;$('spotActionBtn').className='spot-action '+(buy?'buy':'sell');
}
function cancelSpotOrder(id){
  if(!ensureStateFresh())return;const w=spotWallet(),i=spotOrders.findIndex(o=>o.id===id);if(i<0)return;const o=spotOrders[i],c=o.symbol.split('/')[0];
  if(o.side==='buy'){w.usdt+=o.reserved;w.frozenUsdt=Math.max(0,w.frozenUsdt-o.reserved)}else w.frozenCoins[c]=Math.max(0,(w.frozenCoins[c]||0)-o.qty);
  spotOrderHistory.unshift({...o,status:'已撤销',finishedAt:nowText()});spotOrders.splice(i,1);notify('现货撤单成功',o.symbol);saveState();renderTable();updateAssets();draw();
}
function matchSpotOrders(){
  const w=spotWallet();
  for(let i=spotOrders.length-1;i>=0;i--){const o=spotOrders[i];if(o.symbol!==symbol)continue;const c=o.symbol.split('/')[0],hit=o.side==='buy'?price<=o.limit:price>=o.limit;if(!hit)continue;
    let ok=false;if(o.side==='buy'){const qty=o.amount/o.limit;ok=spotFill('buy',qty,o.limit,'限价买入',o.reserved)}else ok=spotFill('sell',o.qty,o.limit,'限价卖出',o.reserved);
    if(ok){spotOrderHistory.unshift({...o,status:'已成交',finishedAt:nowText()});spotOrders.splice(i,1);notify('现货限价单成交',`${o.symbol} @ ${fmt(o.limit,cfg.dec)}`)}
  }
}
