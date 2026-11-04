/* Futures positions UI: one owner for rows and close/reverse workflows.
 * Domain math lives in position-book.js; settlement remains in market/model.js.
 */
(function(){
'use strict';
const book=window.GreedBitPositionBook;
if(!book)throw new Error('Position book must load before positions UI');
const $id=id=>document.getElementById(id);
let closeId=null;

function marketMark(p){
  const contracts=window.GreedBitContracts;
  const quote=contracts?.supportsPerpBasis?.(p.symbol)?contracts.contractPriceFor(p.symbol):markFor(p.symbol);
  return Number(quote)||0;
}
function profitClass(value){return value>1e-8?'gb-pos-profit':value<-1e-8?'gb-pos-loss':'gb-pos-neutral'}
function label(symbol){return String(symbol).replace('/','')+'永续合约'}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function positionSymbolCell(sym){
  const name=escapeHtml(label(sym));
  if(!configs[sym])return name;
  return `<button type="button" class="gb-pos-symbol" data-gb-pos-symbol="${escapeHtml(sym)}" title="切换到 ${name} 合约图表" aria-label="查看 ${name} 合约图表">${name}</button>`;
}
function number(value,dec=2){return fmt(Number(value)||0,dec)}
function lev(value){return Number(Number(value).toFixed(4))+'X'}

function render(){
  const list=positions.filter(p=>posFilter==='all'||p.mode===posFilter);
  $id('positionFilters')?.classList.remove('hidden');
  $id('thead').innerHTML='<tr><th>合约</th><th>方向</th><th>模式</th><th>杠杆</th><th>仓位价值(USDT)</th><th>开仓均价</th><th>合约标记价</th><th>保证金</th><th>未实现盈亏</th><th>收益率</th><th>强平价</th><th>操作</th></tr>';
  $id('tbody').innerHTML=list.length?list.map(p=>{
    const mark=marketMark(p),pnl=(mark-p.entry)*p.qty*(p.side==='long'?1:-1);
    const roe=p.margin?pnl/p.margin*100:0,kind=profitClass(pnl),dec=configs[p.symbol]?.dec??2,
      liq=liqPrice(p.side,p.entry,p.mode,p.margin,p.notional,p.id,p.symbol)||p.liq;
    return `<tr class="gb-pos-row">
      <td>${positionSymbolCell(p.symbol)}</td><td class="${p.side==='long'?'gb-pos-profit':'gb-pos-loss'}">${p.side==='long'?'多':'空'}</td>
      <td>${p.mode==='cross'?'全仓':'逐仓'}</td><td>${lev(p.leverage)}</td>
      <td>${number(p.qty*mark)}</td><td>${number(p.entry,dec)}</td><td>${number(mark,dec)}</td>
      <td>${number(p.margin)}</td><td class="${kind}">${pnl>0?'+':''}${number(pnl)}</td>
      <td class="${profitClass(roe)}">${roe>0?'+':''}${number(roe)}%</td>
      <td>${liq?number(liq,dec):'--'}</td>
      <td class="gb-pos-actions">
        <button data-gb-pos-action="market" data-id="${p.id}">市价全平</button>
        <button data-gb-pos-action="reverse" data-id="${p.id}">一键反手</button>
        <button data-gb-pos-action="dialog" data-id="${p.id}">平仓</button>
      </td>
    </tr>`}).join(''):'<tr><td colspan="12" class="empty">暂无持仓</td></tr>';
}

function dialogHtml(){
  return `<div id="gbCloseModal" class="gb-pos-modal hidden" role="dialog" aria-modal="true" aria-labelledby="gbCloseTitle">
    <div class="gb-pos-panel">
      <div class="gb-pos-modal-head"><h3 id="gbCloseTitle">平仓</h3><button id="gbCloseDismiss" aria-label="关闭">×</button></div>
      <div class="gb-pos-summary" id="gbCloseInfo"></div>
      <div class="gb-pos-tabs" role="group" aria-label="平仓订单类型">
        <button data-gb-close-type="market" class="active">市价平仓</button><button data-gb-close-type="limit">限价平仓</button>
      </div>
      <label id="gbCloseLimitRow" class="gb-pos-field hidden">委托价格（USDT）
        <input id="gbCloseLimitPrice" type="number" min="0" step="any" inputmode="decimal"/>
      </label>
      <label class="gb-pos-field">平仓数量
        <select id="gbCloseSizeKind"><option value="percent">仓位比例（%）</option><option value="notional">仓位名义价值（USDT）</option></select>
        <input id="gbCloseValue" type="number" min="0" step="any" value="100" inputmode="decimal"/>
      </label>
      <div class="gb-pos-presets"><button data-gb-close-percent="25">25%</button><button data-gb-close-percent="50">50%</button><button data-gb-close-percent="75">75%</button><button data-gb-close-percent="100">100%</button></div>
      <p id="gbCloseEstimate" class="gb-pos-estimate"></p><p id="gbCloseError" class="gb-pos-error" role="alert"></p>
      <div class="gb-pos-modal-actions"><button id="gbCloseCancel">取消</button><button id="gbCloseSubmit" class="gb-pos-submit">确认平仓</button></div>
    </div>
  </div>`;
}
function modal(){return $id('gbCloseModal')}
function current(){return positions.find(p=>p.id===closeId)||null}
function chosenType(){return modal()?.querySelector('[data-gb-close-type].active')?.dataset.gbCloseType||'market'}
function updateEstimate(){
  const p=current(),estimate=$id('gbCloseEstimate'),err=$id('gbCloseError'),submit=$id('gbCloseSubmit');
  if(!p){err.textContent='该仓位已关闭，请重新选择';submit.disabled=true;return}
  const mark=marketMark(p),kind=$id('gbCloseSizeKind').value,value=Number($id('gbCloseValue').value);
  const size=book.closeSize(p,kind,value,mark),limitType=chosenType()==='limit',limit=Number($id('gbCloseLimitPrice').value);
  const error=!size?'平仓数量必须大于零且不得超过当前仓位':limitType&&!(limit>0)?'请输入有效限价':'';
  err.textContent=error;submit.disabled=!!error;
  estimate.textContent=size?`预计平仓 ${number(size.qty,6)} ${p.symbol.split('/')[0]}（约 ${number(size.notional)} USDT，${number(size.fraction*100)}%）；${limitType?'限价委托仅减仓，不会新增反向仓位':'以模拟最新市场价成交'}`:'';
}
function showClose(id){
  const p=positions.find(p=>p.id===id);if(!p)return notify('仓位已变化','请刷新后重试','warning');
  closeId=id;
  $id('gbCloseTitle').textContent='平仓 · '+label(p.symbol);
  $id('gbCloseInfo').textContent=`${p.side==='long'?'多':'空'} · ${p.mode==='cross'?'全仓':'逐仓'} · ${lev(p.leverage)} · 持仓 ${number(p.qty*marketMark(p))} USDT`;
  modal().classList.remove('hidden');
  modal().querySelectorAll('[data-gb-close-type]').forEach(b=>b.classList.toggle('active',b.dataset.gbCloseType==='market'));
  $id('gbCloseLimitRow').classList.add('hidden');
  $id('gbCloseLimitPrice').value=marketMark(p).toFixed(configs[p.symbol]?.dec??2);
  $id('gbCloseSizeKind').value='percent';$id('gbCloseValue').value='100';updateEstimate();
}
function hideClose(){modal()?.classList.add('hidden');closeId=null}
function submitClose(){
  if(!ensureStateFresh())return hideClose();
  const p=current();if(!p)return updateEstimate();
  const mark=marketMark(p),kind=$id('gbCloseSizeKind').value,amount=Number($id('gbCloseValue').value);
  const size=book.closeSize(p,kind,amount,mark),type=chosenType();
  if(!size)return updateEstimate();
  if(type==='market'){
    if(!(mark>0))return notify('平仓失败','行情暂不可用','error');
    const result=closePosition(p.id,'市价平仓',mark,size.fraction,'taker');
    if(result==null)return notify('平仓失败','仓位已变化，请重试','error');
  }else{
    const limit=Number($id('gbCloseLimitPrice').value);
    if(!(limit>0))return updateEstimate();
    closeOrders.unshift({id:nextId++,positionId:p.id,symbol:p.symbol,side:p.side==='long'?'sell':'buy',qty:size.qty,limit,status:'open',reduceOnly:true,kind:'close',createdAt:nowText(),createdTs:Date.now()});
    saveState();notify('限价平仓已挂单',`${label(p.symbol)} · ${number(size.qty,6)} @ ${number(limit,configs[p.symbol]?.dec??2)}`,'info');
    renderTable();draw();matchCloseOrders();
  }
  hideClose();
}
function marketClose(id){
  const p=positions.find(x=>x.id===id);if(!p)return;
  const mark=marketMark(p);if(!(mark>0))return notify('平仓失败','行情暂不可用','error');
  closePosition(p.id,'市价全平',mark,1,'taker');
}
function reverse(id){
  const p=positions.find(x=>x.id===id);if(!p)return;
  const mark=marketMark(p);if(!(mark>0))return notify('反手失败','行情暂不可用','error');
  const remaining=positions.filter(x=>x.id!==p.id);
  if(!book.canOpen(remaining,{symbol:p.symbol,mode:p.mode,leverage:p.leverage}))
    return notify('反手失败','现有全仓持仓杠杆不一致','warning');
  const rate=window.GreedBitV13?.TAKER_RATE??0.0006;
  const other=p.side==='long'?'short':'long',vol=configs[p.symbol]?.vol||0;
  const entry=mark*(1+(other==='long'?1:-1)*vol*.025);
  const costClose=p.qty*mark*rate,costOpen=p.margin*p.leverage*rate;
  const available=futuresWallet().usdt+p.margin+(mark-p.entry)*p.qty*(p.side==='long'?1:-1)-costClose;
  if(available+1e-8<p.margin+costOpen)
    return notify('反手失败','平仓后可用余额不足以重新开立同等保证金仓位，原仓位未改变','warning');
  const margin=p.margin,mode=p.mode,lev=p.leverage,sym=p.symbol;
  const closed=closePosition(p.id,'一键反手平仓',mark,1,'taker');
  if(closed===null)return notify('反手失败','仓位已变化','error');
  const created=executeOpen(other,margin,entry,mode,lev,null,null,'一键反手开仓',false,sym);
  if(!created)return notify('反手未完成','原仓位已平仓，但反向开仓未成功；请检查余额和委托','error',7000);
  notify('反手成功',`${label(sym)} ${other==='long'?'开多':'开空'} · ${lev}X`,'success');renderTable();updateAssets();draw();
}
function cancelCloseOrder(id){
  const i=closeOrders.findIndex(o=>String(o.id)===String(id));if(i<0)return;
  const order=closeOrders[i];closeOrders.splice(i,1);orderHistory.unshift({...order,type:'限价平仓',status:'已撤销',finishedAt:nowText(),finishedTs:Date.now()});saveState();renderTable();notify('限价平仓已撤销','','info');
}
async function openPositionSymbol(target){
  if(!configs[target])return notify('无法跳转','该交易对目前不可用','warning');
  try{
    showPage('futures');
    if(symbol!==target)await setSymbol(target);
    resize();
    draw();
  }catch(error){
    console.error('[GreedBit] position symbol navigation failed',error);
    notify('跳转失败','交易对切换未完成，请重试','error');
  }
}
function handleAction(e){
  const symbolButton=e.target.closest('[data-gb-pos-symbol]');
  if(symbolButton){
    if(!ensureStateFresh())return true;
    void openPositionSymbol(symbolButton.dataset.gbPosSymbol);
    return true;
  }
  const cancel=e.target.closest('[data-gb-pos-cancel-close]');if(cancel){cancelCloseOrder(cancel.dataset.gbPosCancelClose);return true}
  const btn=e.target.closest('[data-gb-pos-action]');if(!btn)return false;
  const id=Number(btn.dataset.id);
  if(!ensureStateFresh())return true;
  if(btn.dataset.gbPosAction==='market')marketClose(id);
  else if(btn.dataset.gbPosAction==='reverse')reverse(id);
  else if(btn.dataset.gbPosAction==='dialog')showClose(id);
  return true;
}
function boot(){
  document.body.insertAdjacentHTML('beforeend',dialogHtml());
  $id('gbCloseDismiss').onclick=hideClose;$id('gbCloseCancel').onclick=hideClose;
  modal().addEventListener('mousedown',e=>{if(e.target===modal())hideClose()});
  modal().querySelectorAll('[data-gb-close-type]').forEach(btn=>btn.onclick=()=>{
    modal().querySelectorAll('[data-gb-close-type]').forEach(b=>b.classList.toggle('active',b===btn));
    $id('gbCloseLimitRow').classList.toggle('hidden',btn.dataset.gbCloseType!=='limit');
    updateEstimate();
  });
  $id('gbCloseSizeKind').onchange=()=>{$id('gbCloseValue').value=$id('gbCloseSizeKind').value==='percent'?'100':'';updateEstimate()};
  $id('gbCloseValue').oninput=updateEstimate;$id('gbCloseLimitPrice').oninput=updateEstimate;
  modal().querySelectorAll('[data-gb-close-percent]').forEach(btn=>btn.onclick=()=>{
    $id('gbCloseSizeKind').value='percent';$id('gbCloseValue').value=btn.dataset.gbClosePercent;updateEstimate();
  });
  $id('gbCloseSubmit').onclick=submitClose;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal().classList.contains('hidden'))hideClose()});
}
boot();
window.GreedBitPositionsUI={render,handleAction,showClose,marketMark,reverse};
renderTable();
})();
