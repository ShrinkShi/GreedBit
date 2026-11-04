/* futures
 * IMPORTANT: the live implementations of executeOpen / placeOrder / closePosition /
 * settleFunding are in src/market/model.js, src/trading/contracts.js and
 * src/trading/records.js, which bootstrap.js loads after this file and intentionally
 * overrides. This file must keep the global *bindings* because those modules run in
 * strict mode and assign to these names (assigning to an undeclared global would throw).
 *
 * The stubs below throw if they are ever called, so a broken load order fails loudly
 * instead of silently running an outdated fee/margin implementation.
 *
 * Only the non-overridden pieces live here: TP/SL validation, limit-order cancel/match,
 * risk checks and the funding-countdown painter.
 */
function executeOpen(){throw new Error('executeOpen: 实现位于 src/market/model.js，futures.js 仅保留全局绑定')}
function placeOrder(){throw new Error('placeOrder: 实现位于 src/market/model.js / src/trading/records.js')}
function closePosition(){throw new Error('closePosition: 实现位于 src/market/model.js / src/trading/contracts.js')}
function settleFunding(){throw new Error('settleFunding: 实现位于 src/trading/contracts.js')}

function validateTPSL(side,entry,tp,sl){if(tp&&((side==='long'&&tp<=entry)||(side==='short'&&tp>=entry)))return'止盈价方向不正确';if(sl&&((side==='long'&&sl>=entry)||(side==='short'&&sl<=entry)))return'止损价方向不正确';return''}
function cancelOrder(id){if(!ensureStateFresh())return;const w=futuresWallet(),i=orders.findIndex(o=>o.id===id);if(i<0)return;const o=orders[i];w.usdt+=o.reserved;w.frozen=Math.max(0,w.frozen-o.reserved);orderHistory.unshift({...o,status:'已撤销',finishedAt:nowText()});orders.splice(i,1);notify('撤单成功',`${o.symbol} @ ${fmt(o.limit,(configs[o.symbol]?.dec ?? 2))}`);renderTable();updateAssets();saveState();draw()}
function matchCloseOrders(){
  if(!user||!closeOrders.length)return;
  if(!ensureStateFresh())return;
  // Close limits are reduce-only and watch their own market, even when another symbol is selected.
  for(let i=closeOrders.length-1;i>=0;i--){
    const o=closeOrders[i],p=positions.find(p=>p.id===o.positionId);
    if(!p){closeOrders.splice(i,1);saveState();continue;}
    const mark=riskMarkFor(o.symbol)||markFor(o.symbol);
    if(!(mark>0))continue;
    const hit=p.side==='long'?mark>=o.limit:mark<=o.limit;
    if(!hit)continue;
    const qty=Math.min(o.qty,p.qty);
    closeOrders.splice(i,1);
    if(qty>0){
      const realized=closePosition(p.id,'限价平仓',o.limit,Math.min(1,qty/p.qty),'maker');
      if(realized!==null){
        orderHistory.unshift({...o,qty,leverage:p.leverage,status:'已成交',type:'限价平仓',realized,finishedAt:nowText(),finishedTs:Date.now()});
        saveState();renderTable();
      }
    }else saveState();
  }
}
function matchOrders(){
  const book=window.GreedBitPositionBook;
  matchCloseOrders();
  for(let i=orders.length-1;i>=0;i--){
    const o=orders[i];if(o.symbol!==symbol)continue;
    if(!book?.canOpen(positions,{symbol:o.symbol,mode:o.mode,leverage:o.leverage})){
      const w=futuresWallet();w.frozen=Math.max(0,w.frozen-o.reserved);w.usdt+=o.reserved;
      orderHistory.unshift({...o,status:'已撤销（全仓杠杆冲突）',finishedAt:nowText()});
      orders.splice(i,1);
      notify('委托自动撤销',`${o.symbol} 已存在不同杠杆的全仓持仓`,'warning');saveState();continue;
    }
    const hit=o.side==='long'?price<=o.limit:price>=o.limit;if(!hit)continue;
    if(executeOpen(o.side,o.margin,o.limit,o.mode,o.leverage,o.tp,o.sl,'限价开仓',true)){
      orderHistory.unshift({...o,status:'已成交',finishedAt:nowText()});
      orders.splice(i,1);notify('限价单成交',`${o.symbol} @ ${fmt(o.limit,cfg.dec)}`);saveState();
    }
  }
}
function riskMarkFor(sym){
  const c=window.GreedBitContracts;
  if(c&&typeof c.supportsPerpBasis==='function'&&c.supportsPerpBasis(sym)&&typeof c.contractPriceFor==='function'){const p=c.contractPriceFor(sym);if(p)return p}
  return markFor(sym);
}
function checkRisk(){for(let i=positions.length-1;i>=0;i--){const p=positions[i];const mark=riskMarkFor(p.symbol);if(!mark)continue;p.liq=liqPrice(p.side,p.entry,p.mode,p.margin,p.notional,p.id,p.symbol);if(p.tp&&((p.side==='long'&&mark>=p.tp)||(p.side==='short'&&mark<=p.tp))){closePosition(p.id,'止盈',p.tp);continue}if(p.sl&&((p.side==='long'&&mark<=p.sl)||(p.side==='short'&&mark>=p.sl))){closePosition(p.id,'止损',p.sl);continue}if((p.side==='long'&&mark<=p.liq)||(p.side==='short'&&mark>=p.liq))closePosition(p.id,'强制平仓',mark)}}
function updateFundingUI(){const r=Math.max(0,Math.ceil(nextFunding-Date.now()/1000)),h=Math.floor(r/3600),m=Math.floor((r%3600)/60),s=r%60;$('fundingRate').textContent=(fundingRate*100).toFixed(4)+'%';$('fundingCountdown').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
