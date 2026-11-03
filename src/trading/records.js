/* v0.0.19 HTX-style records / cursor readout / asset list cleanup */
(function(){
'use strict';

const VERSION='0.0.19';
const V=window.GreedBitV13;
const V18=window.GreedBitV18;
const PAGE_SIZE=20;
const pageState={orders:1,history:1,closed:1,ledger:1,spotOrders:1,spotTrades:1};
let openKind='limit';

function installStyle(){
  if(document.querySelector('link[href="styles/v019.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v019.css';document.head.appendChild(l);
}
function updateVersion(){
  const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));
  if(el)el.textContent=`GreedBit v${VERSION}`;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function metaForSymbol(sym){return V?.META?.[sym]||Object.values(V?.META||{}).find(x=>x?.symbol===sym)||null}
function metaForTicker(t){return V?.BY_TICKER?.[t]||Object.values(V?.META||{}).find(x=>x?.ticker===t)||null}
function iconForTicker(t,cls='gb19-asset-icon'){
  if(t==='USDT')return `<span class="${cls} gb19-usdt-icon">₮</span>`;
  const m=metaForTicker(t);return m?.iconPath?`<img class="${cls}" src="${esc(m.iconPath)}" alt="${esc(t)}"/>`:`<span class="${cls} gb19-fallback-icon">${esc(String(t).slice(0,2))}</span>`;
}
function contractLabel(sym){
  const m=metaForSymbol(sym),code=String(sym||'').replace('/','');
  if(!sym)return'-';
  if(m?.market==='forex'||m?.category==='forex'||m?.market==='commodity'||m?.category==='commodity')return `${m.ticker||code}USDT合约`;
  return `${code}永续`;
}
function localDateTime(ms){
  if(!Number.isFinite(+ms)||+ms<=0)return null;
  const d=new Date(+ms),Y=d.getFullYear(),M=String(d.getMonth()+1).padStart(2,'0'),D=String(d.getDate()).padStart(2,'0'),h=String(d.getHours()).padStart(2,'0'),m=String(d.getMinutes()).padStart(2,'0'),s=String(d.getSeconds()).padStart(2,'0');
  return `${Y}/${M}/${D}<br>${h}:${m}:${s}`;
}
function timeCell(ms,fallback){
  const full=localDateTime(ms);if(full)return full;
  const f=String(fallback||'').trim();if(!f)return'--';
  if(/\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(f))return esc(f).replace(/\s+(?=\d{1,2}:\d{2})/,'<br>');
  return `<span class="gb19-legacy-time">日期未记录</span><br>${esc(f)}`;
}
function decFor(sym){return configs?.[sym]?.dec??metaForSymbol(sym)?.dec??2}
function signedClass(v){return +v>0?'gb19-positive':+v<0?'gb19-negative':'gb19-neutral'}
function signed(v,d=4,suffix=''){const n=Number(v);if(!Number.isFinite(n))return'--';return `<span class="${signedClass(n)}">${n>0?'+':''}${fmt(n,d)}${suffix}</span>`}
function orderSide(side,closing=false){
  if(side==='long')return['买入开多','gb19-positive'];
  if(side==='short')return['卖出开空','gb19-negative'];
  if(side==='buy')return[closing?'买入平空':'买入','gb19-positive'];
  if(side==='sell')return[closing?'卖出平多':'卖出','gb19-negative'];
  return[esc(side||'-'),'gb19-neutral'];
}
function shortId(id){const s=String(id??'--');return s.length>8?`${s.slice(0,3)}…${s.slice(-3)}`:s}
function idCell(id){return `<span class="gb19-order-id" title="${esc(id)}">${esc(shortId(id))}</span><button class="gb19-copy" data-gb19-copy="${esc(id)}" title="复制订单编号" aria-label="复制订单编号">▢</button>`}
function tpSlCell(x){const a=[];if(x?.tp)a.push(`止盈 ${fmt(x.tp,decFor(x.symbol))}`);if(x?.sl)a.push(`止损 ${fmt(x.sl,decFor(x.symbol))}`);return a.length?esc(a.join(' / ')):'未设置'}
function spotMark(t){const m=metaForTicker(t);if(!m)return 0;if(V18&&m.market==='stock')return V18.spotReference(m.symbol)||0;return markFor(m.symbol)}
function heldSpotAssets(){
  const w=spotWallet(),keys=new Set([...Object.keys(w.coins||{}),...Object.keys(w.frozenCoins||{})]);
  const rows=[];
  for(const t of keys){
    const total=+w.coins?.[t]||0,frozen=+w.frozenCoins?.[t]||0;if(total<=1e-12&&frozen<=1e-12)continue;
    const p=spotMark(t),m=metaForTicker(t);rows.push({ticker:t,total,frozen,available:Math.max(0,total-frozen),value:total*p,meta:m});
  }
  const rank=new Map((V?.ASSETS||[]).map((x,i)=>[x.ticker,i]));
  rows.sort((a,b)=>(rank.get(a.ticker)??9999)-(rank.get(b.ticker)??9999)||a.ticker.localeCompare(b.ticker));return rows;
}
function assetNameCell(a){const name=a.meta?.name&&a.meta.name!==a.ticker?a.meta.name:'';return `<span class="gb19-asset-name">${iconForTicker(a.ticker)}<span><b>${esc(a.ticker)}</b>${name?`<small>${esc(name)}</small>`:''}</span></span>`}

function advancedOrders(){
  if(!user)return[];try{return JSON.parse(localStorage.getItem(`greedbit_v010_advanced_${user.username}`)||'[]')||[]}catch{return[]}
}
function saveAdvancedOrders(arr){if(!user)return;localStorage.setItem(`greedbit_v010_advanced_${user.username}`,JSON.stringify(arr.slice(0,100)))}
function cancelAdvanced(id){
  const arr=advancedOrders(),i=arr.findIndex(x=>String(x.id)===String(id));if(i<0)return;
  const o=arr[i],w=futuresWallet(),reserved=+o.reserved||0;w.frozen=Math.max(0,w.frozen-reserved);w.usdt+=reserved;arr.splice(i,1);saveAdvancedOrders(arr);saveState();notify('撤单成功',`${contractLabel(o.symbol)} 高级委托已撤销`,'info');renderTable();updateAssets();
}
function advancedKindName(k){return({plan:'计划委托',trailing:'跟踪委托',twap:'分时委托'}[k]||'高级委托')}

function ensureTableChrome(){
  const bottom=document.querySelector('.bottom'),pos=$('positionFilters');if(!bottom||!pos)return;
  if(!$('gb19TableToolbar')){const x=document.createElement('div');x.id='gb19TableToolbar';x.className='gb19-table-toolbar hidden';pos.insertAdjacentElement('beforebegin',x)}
  if(!$('gb19Pagination')){const p=document.createElement('div');p.id='gb19Pagination';p.className='gb19-pagination hidden';bottom.appendChild(p)}
}
function modeCount(kind){if(kind==='limit')return orders.length;return advancedOrders().filter(x=>x.kind===kind&&x.status==='open').length}
function syncTableChrome(){
  ensureTableChrome();const bar=$('gb19TableToolbar'),pos=$('positionFilters');if(!bar||!pos)return;
  pos.classList.toggle('hidden',tradingMode!=='futures'||tableMode!=='positions');
  if(tradingMode!=='futures'||(tableMode!=='open'&&tableMode!=='orders')){bar.classList.add('hidden');bar.innerHTML='';return}
  bar.classList.remove('hidden');
  const defs=[['limit','限价委托'],['plan','计划委托'],['stop','止盈止损'],['trailing','跟踪委托'],['market','市价委托'],['twap','分时委托']];
  bar.innerHTML=`<div class="gb19-kind-tabs">${defs.map(([k,n])=>`<button data-gb19-kind="${k}" class="${openKind===k?'active':''}">${n}${tableMode==='open'?`(${k==='stop'||k==='market'?0:modeCount(k)})`:''}</button>`).join('')}</div><div class="gb19-toolbar-right"><span>全部品种</span><span>全部周期</span></div>`;
}
function pageSlice(arr,key){const pages=Math.max(1,Math.ceil(arr.length/PAGE_SIZE));pageState[key]=Math.min(Math.max(1,pageState[key]||1),pages);const start=(pageState[key]-1)*PAGE_SIZE;return{rows:arr.slice(start,start+PAGE_SIZE),pages,page:pageState[key]}}
function renderPagination(total,key){
  ensureTableChrome();const p=$('gb19Pagination');if(!p)return;
  if(total<=PAGE_SIZE){p.classList.add('hidden');p.innerHTML='';return}
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE)),cur=Math.min(pageState[key]||1,pages),nums=new Set([1,pages,cur-1,cur,cur+1]);
  const arr=[...nums].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);let html='',last=0;
  for(const n of arr){if(last&&n-last>1)html+='<span>…</span>';html+=`<button data-gb19-page="${n}" class="${n===cur?'active':''}">${n}</button>`;last=n}
  p.classList.remove('hidden');p.innerHTML=`<button data-gb19-page="${Math.max(1,cur-1)}" ${cur===1?'disabled':''}>‹</button>${html}<button data-gb19-page="${Math.min(pages,cur+1)}" ${cur===pages?'disabled':''}>›</button>`;p.dataset.key=key;
}
function hidePagination(){const p=$('gb19Pagination');if(p){p.classList.add('hidden');p.innerHTML=''}}
function emptyRow(cols,text){return `<tr><td colspan="${cols}" class="empty">${esc(text)}</td></tr>`}

function currentOrderRows(){
  if(openKind==='limit')return orders.map(o=>({...o,_kind:'limit'}));
  if(['plan','trailing','twap'].includes(openKind))return advancedOrders().filter(o=>o.kind===openKind&&o.status==='open').map(o=>({...o,_kind:o.kind}));
  return[];
}
function renderCurrentOrders(){
  const arr=currentOrderRows();
  $('thead').innerHTML='<tr><th>合约</th><th>倍数</th><th>委托时间</th><th>更新时间</th><th>交易类型</th><th>只减仓</th><th>委托类型</th><th>委托量(USDT)</th><th>委托价(USDT)</th><th>成交量(USDT)</th><th>成交均价(USDT)</th><th>冻结保证金</th><th>手续费</th><th>成交率</th><th>止盈/止损</th><th>订单编号</th><th>操作</th></tr>';
  $('tbody').innerHTML=arr.length?arr.map(o=>{
    const side=orderSide(o.side),notional=(+o.margin||0)*(+o.leverage||1),kind=o._kind||'limit';
    let priceText='--';if(kind==='limit')priceText=fmt(o.limit,decFor(o.symbol));if(kind==='plan')priceText=`触发 ${fmt(o.trigger,decFor(o.symbol))}`;if(kind==='trailing')priceText=o.activation?`激活 ${fmt(o.activation,decFor(o.symbol))}`:`回调 ${fmt((+o.callback||0)*100,2)}%`;if(kind==='twap')priceText='分时市价';
    const cancel=kind==='limit'?`<button class="gb19-link danger" data-cancel="${o.id}">撤单</button>`:`<button class="gb19-link danger" data-gb19-adv-cancel="${o.id}">撤单</button>`;
    return `<tr><td>${contractLabel(o.symbol)}</td><td>${o.leverage||'-'}</td><td>${timeCell(o.createdTs,o.createdAt)}</td><td>${timeCell(o.updatedTs||o.createdTs,o.updatedAt||o.createdAt)}</td><td class="${side[1]}">${side[0]}</td><td>否</td><td>${kind==='limit'?'限价委托':advancedKindName(kind)}</td><td>${fmt(notional,4)}</td><td>${priceText}</td><td>0.0000</td><td>--</td><td>${fmt(+o.reserved||+o.margin||0,4)}</td><td>--</td><td>0%</td><td>${tpSlCell(o)}</td><td>${idCell(o.id)}</td><td>${cancel}</td></tr>`
  }).join(''):emptyRow(17,openKind==='limit'?'暂无当前委托':`暂无${advancedKindName(openKind)}`);
  hidePagination();
}
function renderOrderHistory(){
  const all=openKind==='limit'?orderHistory:[];const {rows,pages}=pageSlice(all,'orders');
  $('thead').innerHTML='<tr><th>合约</th><th>倍数</th><th>委托时间</th><th>更新时间</th><th>交易类型</th><th>只减仓</th><th>委托类型</th><th>委托量(USDT)</th><th>委托价(USDT)</th><th>成交量(USDT)</th><th>成交均价(USDT)</th><th>平仓盈亏 | 收益(USDT)</th><th>手续费</th><th>状态</th><th>订单编号</th><th>止盈/止损</th></tr>';
  $('tbody').innerHTML=rows.length?rows.map(o=>{const side=orderSide(o.side),notional=(+o.margin||0)*(+o.leverage||1),filled=o.status==='已成交';return `<tr><td>${contractLabel(o.symbol)}</td><td>${o.leverage||'-'}</td><td>${timeCell(o.createdTs,o.createdAt)}</td><td>${timeCell(o.finishedTs,o.finishedAt)}</td><td class="${side[1]}">${side[0]}</td><td>否</td><td>${/maker|限价/i.test(o.type||'限价')?'限价委托':'限价委托'}</td><td>${fmt(notional,4)}</td><td>${fmt(o.limit,decFor(o.symbol))}</td><td>${filled?fmt(notional,4):'--'}</td><td>${filled?fmt(o.limit,decFor(o.symbol)):'0.00'}</td><td><span class="gb19-neutral">0.0000 | 0.0000</span></td><td>${o.fee!=null?signed(-Math.abs(o.fee),6,' USDT'):'--'}</td><td class="${filled?'gb19-positive':'gb19-muted'}">${esc(o.status||'-')}</td><td>${idCell(o.id)}</td><td>${tpSlCell(o)}</td></tr>`}).join(''):emptyRow(16,openKind==='limit'?'暂无历史委托':`暂无${advancedKindName(openKind)}历史记录`);
  renderPagination(all.length,'orders');
}
function renderTrades(){
  const all=trades||[],{rows}=pageSlice(all,'history');
  $('thead').innerHTML='<tr><th>合约</th><th>成交时间</th><th>交易类型</th><th>成交量(USDT)</th><th>成交价(USDT)</th><th>成交类型</th><th>平仓盈亏 | 收益(USDT)</th><th>手续费</th><th>操作</th></tr>';
  $('tbody').innerHTML=rows.length?rows.map(t=>{
    const closing=t.side==='buy'||t.side==='sell',side=orderSide(t.side,closing),notional=(+t.qty||0)*(+t.price||0),maker=/限价|maker/i.test(t.type||'');
    let pnl='<span class="gb19-neutral">0.0000 | 0.0000</span>';if(closing)pnl=Number.isFinite(+t.realized)?`${signed(t.realized,4)} | ${signed(t.realized,4)}`:'<span class="gb19-muted">-- | --</span>';
    return `<tr><td>${contractLabel(t.symbol)}</td><td>${timeCell((+t.ts||0)*1000,t.time)}</td><td class="${side[1]}">${side[0]}</td><td>${fmt(notional,4)}</td><td>${fmt(t.price,decFor(t.symbol))}</td><td>${maker?'Maker':'Taker'}</td><td>${pnl}</td><td>${t.fee!=null?signed(-Math.abs(t.fee),6,' USDT'):'--'}</td><td><button class="gb19-link">查看</button></td></tr>`
  }).join(''):emptyRow(9,'暂无成交记录');renderPagination(all.length,'history');
}
function renderClosed(){
  const all=closedPositions||[],{rows}=pageSlice(all,'closed');
  $('thead').innerHTML='<tr><th>合约</th><th>开仓时间</th><th>全部平完时间</th><th>最大持仓量(USDT)</th><th>已平仓量(USDT)</th><th>平仓均价(USDT)</th><th>成本均价(USDT)</th><th>平仓收益率</th><th>平仓收益额(USDT)</th><th>手续费</th><th>状态</th></tr>';
  $('tbody').innerHTML=rows.length?rows.map(p=>{const side=orderSide(p.side),closedValue=(+p.qty||0)*(+p.close||0),roe=(+p.margin||0)?(+p.realized||0)/(+p.margin)*100:0,totalFee=(+p.fee||0)+(+p.closeFee||0);return `<tr><td><div>${contractLabel(p.symbol)}</div><span class="gb19-side-badge ${side[1]}">${p.side==='long'?'买':'卖'}</span><span class="gb19-mode-badge">${p.mode==='cross'?'全':'逐'}</span></td><td>${timeCell((+p.openedTs||0)*1000,p.openedAt)}</td><td>${timeCell(p.closedTs,p.closedAt)}</td><td>${fmt(p.notional||(+p.margin||0)*(+p.leverage||1),4)}</td><td>${fmt(closedValue,4)}</td><td>${fmt(p.close,decFor(p.symbol))}</td><td>${fmt(p.entry,decFor(p.symbol))}</td><td>${signed(roe,4,'%')}</td><td>${signed(p.realized,4)}</td><td>${totalFee?signed(-Math.abs(totalFee),6,' USDT'):'--'}</td><td>${p.partial?'部分平仓':'全部平仓'}</td></tr>`}).join(''):emptyRow(11,'暂无历史仓位');renderPagination(all.length,'closed');
}
function renderLedger(){
  const all=(ledger||[]).filter(x=>x.wallet==='futures'),{rows}=pageSlice(all,'ledger');
  $('thead').innerHTML='<tr><th>合约</th><th>时间</th><th>项目</th><th>说明</th><th>金额</th></tr>';
  $('tbody').innerHTML=rows.length?rows.map(x=>`<tr><td>${x.symbol?contractLabel(x.symbol):'-'}</td><td>${timeCell(x.ts,x.time)}</td><td>${esc(x.type||'-')}</td><td>${esc(x.note||'-')}</td><td>${signed(x.amount,6,' USDT')}</td></tr>`).join(''):emptyRow(5,'暂无财务记录');renderPagination(all.length,'ledger');
}

const baseRenderFuturesTable19=renderFuturesTable;
const baseRenderSpotTable19=renderSpotTable;
renderFuturesTable=function(){
  if(tableMode==='positions'){hidePagination();return baseRenderFuturesTable19.apply(this,arguments)}
  if(tableMode==='open')return renderCurrentOrders();
  if(tableMode==='orders')return renderOrderHistory();
  if(tableMode==='history')return renderTrades();
  if(tableMode==='closed')return renderClosed();
  if(tableMode==='ledger')return renderLedger();
  return baseRenderFuturesTable19.apply(this,arguments);
};
renderSpotTable=function(){
  if(tableMode!=='spotAssets')return baseRenderSpotTable19.apply(this,arguments);
  $('positionFilters')?.classList.add('hidden');const w=spotWallet(),assets=heldSpotAssets();
  $('thead').innerHTML='<tr><th>资产</th><th>可用</th><th>冻结</th><th>估值(USDT)</th></tr>';
  const usdt=`<tr><td>${assetNameCell({ticker:'USDT',meta:{name:'Tether'}})}</td><td>${fmt(w.usdt)}</td><td>${fmt(w.frozenUsdt)}</td><td>${fmt((+w.usdt||0)+(+w.frozenUsdt||0))}</td></tr>`;
  $('tbody').innerHTML=usdt+assets.map(a=>`<tr><td>${assetNameCell(a)}</td><td>${fmt(a.available,6)}</td><td>${fmt(a.frozen,6)}</td><td>${fmt(a.value)}</td></tr>`).join('');hidePagination();
};
renderTable=function(){
  if(!user){$('positionFilters')?.classList.add('hidden');$('thead').innerHTML='<tr><th></th></tr>';$('tbody').innerHTML='<tr><td class="empty">登录后查看账户数据</td></tr>';hidePagination();syncTableChrome();return}
  syncTableChrome();tradingMode==='futures'?renderFuturesTable():renderSpotTable();
};

const baseRenderAssetPage19=renderAssetPage;
renderAssetPage=function(){
  if(!user||assetTab!=='spot')return baseRenderAssetPage19.apply(this,arguments);
  const w=spotWallet(),assets=heldSpotAssets(),usdtTotal=(+w.usdt||0)+(+w.frozenUsdt||0);
  $('assetPageBody').innerHTML=`<div class="asset-detail gb19-asset-detail"><h3>现货账户</h3><div class="asset-list-row gb19-asset-head"><b>资产</b><b>数量</b><b>估值</b></div><div class="asset-list-row gb19-asset-row">${assetNameCell({ticker:'USDT',meta:{name:'Tether'}})}<span>${fmt(usdtTotal)}</span><span>${fmt(usdtTotal)} USDT</span></div>${assets.map(a=>`<div class="asset-list-row gb19-asset-row">${assetNameCell(a)}<span>${fmt(a.total,6)}</span><span>${fmt(a.value)} USDT</span></div>`).join('')}</div>`;
};

function renderSpotSideAssets(){
  if(!user||tradingMode!=='spot'||!$('sideAssetBody'))return;
  const w=spotWallet(),assets=heldSpotAssets(),usdt=(+w.usdt||0)+(+w.frozenUsdt||0);
  $('sideAssetBody').innerHTML=`<div class="assetrow gb19-side-asset"><span>${iconForTicker('USDT','gb19-mini-icon')}USDT</span><b>${fmt(usdt)}</b></div>${assets.map(a=>`<div class="assetrow gb19-side-asset"><span>${iconForTicker(a.ticker,'gb19-mini-icon')}${esc(a.ticker)}</span><span>${fmt(a.total,6)}</span></div>`).join('')}`;
}
const baseUpdateAssets19=updateAssets;
updateAssets=function(){const out=baseUpdateAssets19.apply(this,arguments);renderSpotSideAssets();return out};

/* Add full timestamps to new records without inventing dates for legacy records. */
const baseAddLedger19=addLedger;
addLedger=function(){const before=ledger.length,out=baseAddLedger19.apply(this,arguments);if(ledger.length>before&&!ledger[0].ts)ledger[0].ts=Date.now();return out};
const basePlaceOrder19=placeOrder;
placeOrder=function(){const before=orders.length,out=basePlaceOrder19.apply(this,arguments);if(orders.length>before&&!orders[0].createdTs){orders[0].createdTs=Date.now();orders[0].updatedTs=orders[0].createdTs;saveState();renderTable()}return out};
const baseCancelOrder19=cancelOrder;
cancelOrder=function(){const before=orderHistory.length,out=baseCancelOrder19.apply(this,arguments);if(orderHistory.length>before&&!orderHistory[0].finishedTs){orderHistory[0].finishedTs=Date.now();saveState();renderTable()}return out};
const baseMatchOrders19=matchOrders;
matchOrders=function(){const before=orderHistory.length,out=baseMatchOrders19.apply(this,arguments);if(orderHistory.length>before){const now=Date.now();for(let i=0;i<orderHistory.length-before;i++)if(!orderHistory[i].finishedTs)orderHistory[i].finishedTs=now;saveState()}return out};
const baseClosePosition19=closePosition;
closePosition=function(){const before=closedPositions.length,out=baseClosePosition19.apply(this,arguments);if(closedPositions.length>before){const c=closedPositions[0];if(!c.closedTs)c.closedTs=Date.now();if(trades[0]&&trades[0].symbol===c.symbol&&trades[0].realized==null)trades[0].realized=out;saveState();renderTable()}return out};

function installCrosshairReadout(){
  const wrap=$('chartwrap');if(!wrap||$('gb19CursorPrice'))return;
  wrap.insertAdjacentHTML('beforeend','<div id="gb19CursorPrice" class="gb19-cursor-label gb19-cursor-price hidden"></div><div id="gb19CursorTime" class="gb19-cursor-label gb19-cursor-time hidden"></div>');
  const py=$('gb19CursorPrice'),tx=$('gb19CursorTime');
  const hide=()=>{py.classList.add('hidden');tx.classList.add('hidden')};
  window.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,plotW=Math.max(1,r.width-90),plotH=Math.max(1,r.height-66);
    if(dragging||x<8||x>r.width-82||y<28||y>r.height-38){hide();return}
    const geom=viewGeometry(),frac=(x-8)/plotW,idx=geom.start+frac*visibleCount,ts=timestampAtIndex(idx,geom.all),p=chartPriceAtClientY(e.clientY),d=new Date(ts*1000),Y=d.getFullYear(),M=String(d.getMonth()+1).padStart(2,'0'),D=String(d.getDate()).padStart(2,'0'),h=String(d.getHours()).padStart(2,'0'),m=String(d.getMinutes()).padStart(2,'0');
    py.textContent=fmt(p,cfg.dec);py.style.top=clamp(y-13,28,28+plotH-26)+'px';py.classList.remove('hidden');
    tx.textContent=`${Y}-${M}-${D}  ${h}:${m}`;tx.style.left=clamp(x-70,4,Math.max(4,r.width-82-140))+'px';tx.classList.remove('hidden');
  });
  canvas.addEventListener('mouseleave',hide);
}

function installInteractions(){
  const bottom=document.querySelector('.bottom');if(bottom&&!bottom.dataset.gb19Bound){bottom.dataset.gb19Bound='1';bottom.addEventListener('click',async e=>{
    const k=e.target.closest('[data-gb19-kind]');if(k){openKind=k.dataset.gb19Kind;pageState.orders=1;renderTable();return}
    const p=e.target.closest('[data-gb19-page]');if(p&&!p.disabled){const key=$('gb19Pagination')?.dataset.key;if(key){pageState[key]=+p.dataset.gb19Page||1;renderTable()}return}
    const c=e.target.closest('[data-gb19-copy]');if(c){try{await navigator.clipboard.writeText(c.dataset.gb19Copy);notify('订单编号已复制','','info')}catch{}return}
    const a=e.target.closest('[data-gb19-adv-cancel]');if(a){cancelAdvanced(a.dataset.gb19AdvCancel);return}
  })}
}

function boot(){
  installStyle();ensureTableChrome();installInteractions();installCrosshairReadout();updateVersion();renderTable();renderAssetPage();renderSpotSideAssets();
  window.GreedBitV19={VERSION,heldSpotAssets};
}
if(!window.GreedBitV18){setTimeout(boot,120)}else boot();
})();
