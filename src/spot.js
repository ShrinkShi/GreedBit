/* spot */
function spotAvailableCoin(c){const w=spotWallet();return Math.max(0,(w.coins[c]||0)-(w.frozenCoins[c]||0))}
function updateSpotPanel(){
  if(!$('spotBalanceLine'))return;const w=spotWallet(),c=base(),buy=spotSide==='buy';
  $('spotBalanceLine').textContent=buy?`可用：${fmt(w.usdt)} USDT`:`可用：${fmt(spotAvailableCoin(c),6)} ${c}`;
  $('spotAmountLabel').textContent=buy?'金额':'数量';$('spotAmountUnit').textContent=buy?'USDT':c;$('spotActionBtn').textContent=(buy?'买入 ':'卖出 ')+c;$('spotActionBtn').className='spot-action '+(buy?'buy':'sell');
}
function spotFill(side,qty,fill,source='市价',reserved=0){
  const w=spotWallet(),c=base(),notional=qty*fill,fee=notional*SPOT_FEE;
  if(side==='buy'){
    if(!reserved){if(notional+fee>w.usdt)return false;w.usdt-=notional+fee}else{w.frozenUsdt=Math.max(0,w.frozenUsdt-reserved)}
    const prevQty=w.coins[c]||0;w.coins[c]=prevQty+qty;w.cost[c]=(w.cost[c]||0)+notional+fee;
  }else{
    if(qty>spotAvailableCoin(c)+1e-10&&!reserved)return false;
    if(reserved)w.frozenCoins[c]=Math.max(0,(w.frozenCoins[c]||0)-qty);
    const oldQty=w.coins[c]||0,avg=oldQty?(w.cost[c]||0)/oldQty:0,realized=(fill-avg)*qty-fee;
    w.coins[c]=Math.max(0,oldQty-qty);w.cost[c]=Math.max(0,(w.cost[c]||0)-avg*qty);w.usdt+=notional-fee;
    if(realized>=0)accountStats.realizedProfit+=realized;else accountStats.realizedLoss+=Math.abs(realized);
  }
  accountStats.fees+=fee;accountStats.spotTrades++;spotTrades.unshift({time:nowText(),symbol,side,qty,price:fill,type:source,fee});addLedger('现货手续费',-fee,symbol,source,'spot');playFillSound();saveState();return true;
}
function placeSpotOrder(){
  if(!user)return openAuth('login');if(!marketReady||!price)return notify('下单失败','真实市场行情尚未连接','error');const w=spotWallet(),c=base(),amt=+$('spotAmountInput').value;if(!amt||amt<=0)return notify('下单失败','请输入有效金额/数量','error');
  if(spotOrderType==='market'){
    if(spotSide==='buy'){const fill=price*(1+cfg.vol*.02),qty=amt/fill;if(!spotFill('buy',qty,fill,'市价买入'))return notify('下单失败','现货账户 USDT 不足','error');notify('现货成交',`买入 ${fmt(qty,6)} ${c} @ ${fmt(fill,cfg.dec)}`)}
    else{const fill=price*(1-cfg.vol*.02),qty=amt;if(!spotFill('sell',qty,fill,'市价卖出'))return notify('下单失败',`${c} 可用数量不足`,'error');notify('现货成交',`卖出 ${fmt(qty,6)} ${c} @ ${fmt(fill,cfg.dec)}`)}
  }else{
    const limit=+$('spotLimitInput').value;if(!limit||limit<=0)return notify('挂单失败','请输入限价','error');
    if(spotSide==='buy'){const reserve=amt*(1+SPOT_FEE);if(reserve>w.usdt)return notify('挂单失败','现货账户 USDT 不足','error');w.usdt-=reserve;w.frozenUsdt+=reserve;spotOrders.unshift({id:nextId++,symbol,side:'buy',limit,amount:amt,reserved:reserve,status:'open',createdAt:nowText()})}
    else{const qty=amt;if(qty>spotAvailableCoin(c))return notify('挂单失败',`${c} 可用数量不足`,'error');w.frozenCoins[c]=(w.frozenCoins[c]||0)+qty;spotOrders.unshift({id:nextId++,symbol,side:'sell',limit,qty,reserved:qty,status:'open',createdAt:nowText()})}
    notify('现货限价委托已提交',`${spotSide==='buy'?'买入':'卖出'} ${c} @ ${fmt(limit,cfg.dec)}`,'info');
  }
  $('spotAmountInput').value='';$('spotPct').value=0;$('spotPctValue').textContent='0%';renderTable();updateAssets();saveState();draw();
}
function cancelSpotOrder(id){
  const w=spotWallet(),i=spotOrders.findIndex(o=>o.id===id);if(i<0)return;const o=spotOrders[i],c=o.symbol.split('/')[0];
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
