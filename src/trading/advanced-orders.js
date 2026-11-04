/* v0.0.10 contract overview/data/strategy/advanced-order/recent-trade additions */
(function waitV010(){
if(typeof drawTradeMarkers!=='function'){setTimeout(waitV010,50);return;}
(()=>{
'use strict';

const FUTURES_API='https://fapi.binance.com';
const FUTURES_WS='wss://fstream.binance.com/ws';
const meta={
  'BTC/USDT':{
    code:'BTC',name:'Bitcoin',launch:'2009-01-03',rank:'#1',
    supply:'约 1990 万 BTC',maxSupply:'2100 万 BTC',intro:'比特币是一种点对点电子现金系统，也是目前市值最大的加密资产。其共识机制采用工作量证明，供应上限为 2100 万枚。',
    site:'https://bitcoin.org/', explorer:'https://mempool.space/', github:'https://github.com/bitcoin/bitcoin'
  },
  'ETH/USDT':{
    code:'ETH',name:'Ethereum',launch:'2015-07-30',rank:'#2',
    supply:'约 1.207 亿 ETH',maxSupply:'无固定上限',intro:'以太坊是支持智能合约和去中心化应用的可编程区块链网络。ETH 用于支付网络手续费、质押和协议内价值结算。',
    site:'https://ethereum.org/', explorer:'https://etherscan.io/', github:'https://github.com/ethereum'
  }
};

let contractPanelMode='chart';
let analyticsPeriod='15m';
let analyticsBusy=false;
let recentTrades=[],futuresTradeSocket=null,recentTradeView='book';
let advancedKind=null,advancedOrders=[];
let strategyRecords=[];

function v10Key(name){return `greedbit_v010_${name}_${user?.username||'guest'}`}
function loadV10State(){
  try{advancedOrders=JSON.parse(localStorage.getItem(v10Key('advanced'))||'[]')}catch{advancedOrders=[]}
  try{strategyRecords=JSON.parse(localStorage.getItem(v10Key('strategies'))||'[]')}catch{strategyRecords=[]}
}
function saveV10State(){
  localStorage.setItem(v10Key('advanced'),JSON.stringify(advancedOrders.slice(0,100)));
  localStorage.setItem(v10Key('strategies'),JSON.stringify(strategyRecords.slice(0,100)));
}
/* Single source of truth for advanced orders: memory is canonical, localStorage is only a mirror.
 * All cancel paths must go through cancelAdvancedOrder(), otherwise a cancelled order is resurrected
 * by the next saveV10State() and its reserved funds can be refunded twice. */
function cancelAdvancedOrder(id){
  if(!ensureStateFresh())return false;
  const i=advancedOrders.findIndex(x=>String(x.id)===String(id));
  if(i<0)return false;
  const o=advancedOrders[i],w=futuresWallet(),reserved=+o.reserved||0;
  w.frozen=Math.max(0,w.frozen-reserved);
  w.usdt+=reserved;
  advancedOrders.splice(i,1);
  saveV10State();saveState();renderTable();updateAssets();
  notify('高级委托已撤销',o.symbol,'info');
  return true;
}
window.GreedBitAdvancedOrders={
  list:()=>advancedOrders.map(o=>({...o})),
  cancel:cancelAdvancedOrder,
  save:saveV10State
};
async function fapi(path){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);
  try{
    const r=await fetch(FUTURES_API+path,{signal:c.signal,cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }finally{clearTimeout(t)}
}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function pct(v,d=2){return `${(n(v)*100).toFixed(d)}%`}
function shortNum(v){
  v=n(v);const a=Math.abs(v);
  if(a>=1e9)return (v/1e9).toFixed(2)+'B';
  if(a>=1e6)return (v/1e6).toFixed(2)+'M';
  if(a>=1e3)return (v/1e3).toFixed(2)+'K';
  return v.toFixed(2)
}
function timeLabel(ms){const d=new Date(ms);return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function htmlEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ---------- inject DOM ---------- */
if(!document.querySelector('link[href^="styles/v010.css"]')){
  const l=document.createElement('link');l.rel='stylesheet';l.href=cssHref('styles/v010.css');document.head.appendChild(l);
}
document.querySelector('.statusbar .ticker.up')?.replaceChildren(document.createTextNode('GreedBit v0.0.10'));

const chartPanel=document.querySelector('.chartpanel');
if(chartPanel && !$('contractInfoPanel')){
  chartPanel.insertAdjacentHTML('beforeend',`
    <div class="contract-info hidden" id="contractInfoPanel"></div>
  `);
}
const orderbook=document.querySelector('.orderbook');
if(orderbook && !$('recentTrades')){
  const head=orderbook.querySelector('.panelhead');
  head.innerHTML='<button class="book-tab active" data-booktab="book">盘口</button><button class="book-tab" data-booktab="trades">实时成交</button>';
  orderbook.insertAdjacentHTML('beforeend','<div id="recentTrades" class="recent-trades hidden"></div>');
}
const tradeTabs=document.querySelector('.tradebox .tabs');
if(tradeTabs){
  const btns=tradeTabs.querySelectorAll('button');
  if(btns[1])btns[1].id='strategyTradeTab';
}
if(!$('strategyPanel')){
  $('futuresPanel')?.insertAdjacentHTML('afterend',`
  <div class="form hidden" id="strategyPanel">
    <div class="strategy-grid-list">
      <button class="strategy-card" data-strategy="spot-grid"><span class="strategy-icon">⌁</span><div><b>现货网格</b><p>震荡行情 / 低买高卖 / 牛熊皆宜</p></div></button>
      <button class="strategy-card" data-strategy="futures-grid"><span class="strategy-icon">▣</span><div><b>合约网格 <em>NEW</em></b><p>循环套利 / 可加杠杆 / 放大收益</p></div></button>
      <button class="strategy-card" data-strategy="martingale"><span class="strategy-icon">◇</span><div><b>合约马丁格尔 <em>NEW</em></b><p>分批加仓 / 均价回归 / 高风险</p></div></button>
    </div>
    <div class="strategy-running">
      <h4>我的策略</h4>
      <div id="strategyList"></div>
    </div>
  </div>`);
}
const maker=document.querySelector('.maker-label');
if(maker){
  maker.outerHTML=`<button class="advanced-order-open" id="advancedOrderBtn">高级委托⌄</button>
  <div class="advanced-order-menu hidden" id="advancedOrderMenu">
    <button data-advkind="plan">计划</button><button data-advkind="trailing">跟踪</button><button data-advkind="twap">分时</button>
  </div>`;
}
if(!$('advancedOrderFields')){
  $('limitPriceField')?.insertAdjacentHTML('beforebegin',`
    <div id="advancedOrderFields" class="advanced-order-fields hidden">
      <div class="advanced-kind-title"><b id="advancedKindTitle">高级委托</b><button id="advancedKindClear">恢复普通委托</button></div>
      <div class="field hidden" id="planTriggerField"><label>触发价</label><input id="planTriggerInput" type="number" min="0" step="any"/><span>USDT</span></div>
      <div class="field hidden" id="trailActivationField"><label>激活价</label><input id="trailActivationInput" type="number" min="0" step="any" placeholder="可选"/><span>USDT</span></div>
      <div class="field hidden" id="trailCallbackField"><label>回调率</label><input id="trailCallbackInput" type="number" min="0.1" max="20" step="0.1" value="1"/><span>%</span></div>
      <div class="field hidden" id="twapDurationField"><label>时长</label><input id="twapDurationInput" type="number" min="1" step="1" value="10"/><span>分钟</span></div>
      <div class="field hidden" id="twapSlicesField"><label>拆单</label><input id="twapSlicesInput" type="number" min="2" max="50" step="1" value="5"/><span>份</span></div>
    </div>`);
}
if(!$('strategyModal')){
  document.body.insertAdjacentHTML('beforeend',`
  <div class="modal" id="strategyModal" role="dialog" aria-modal="true" aria-label="创建策略"><div class="card dark-card strategy-modal-card">
    <button class="close dark-close" data-close="strategyModal">×</button><h2 id="strategyModalTitle">创建策略</h2>
    <p class="muted">当前版本记录策略配置并使用真实市场价格估值；自动网格成交引擎仍处于本地测试阶段。</p>
    <div class="field modal-field"><label>投入</label><input id="strategyAmount" type="number" min="1" step="1" value="1000"/><span>USDT</span></div>
    <div class="field modal-field"><label>下限</label><input id="strategyLow" type="number" min="0" step="any"/><span>USDT</span></div>
    <div class="field modal-field"><label>上限</label><input id="strategyHigh" type="number" min="0" step="any"/><span>USDT</span></div>
    <div class="field modal-field"><label>网格数</label><input id="strategyGrids" type="number" min="2" max="100" step="1" value="10"/><span>格</span></div>
    <div class="modal-actions"><button class="ghostbtn" data-close="strategyModal">取消</button><button class="confirmbtn" id="strategyCreateBtn">创建模拟策略</button></div>
  </div></div>`);
}

/* ---------- chart tabs: chart / overview / data ---------- */
const chartTabs=[...document.querySelectorAll('.charttabs span')];
chartTabs.forEach((x,i)=>{x.dataset.contracttab=['chart','overview','data'][i]||'chart';x.style.cursor='pointer'});
function showContractPanel(mode){
  contractPanelMode=mode;
  chartTabs.forEach(x=>x.classList.toggle('active',x.dataset.contracttab===mode));
  const info=$('contractInfoPanel'), timebar=$('timebar'), wrap=$('chartwrap'), layout=$('layout');
  const full=mode!=='chart';
  timebar.classList.toggle('hidden',full);wrap.classList.toggle('hidden',full);info.classList.toggle('hidden',!full);
  layout.classList.toggle('contract-info-mode',full);
  if(mode==='overview')renderOverview();
  if(mode==='data')renderAnalytics();
  if(mode==='chart')setTimeout(resize,0);
}
chartTabs.forEach(x=>x.onclick=()=>showContractPanel(x.dataset.contracttab));

function renderOverview(){
  const m=meta[symbol],snap=marketSnapshots[symbol]||{},last=snap.last||price,marketCap=m.code==='BTC'?last*19.9e6:last*120.7e6;
  $('contractInfoPanel').innerHTML=`
  <div class="overview-subnav"><button class="active">基础信息</button><button>交易参数</button><button>资金费率历史</button><button>指数价格</button></div>
  <div class="overview-grid">
    <section class="overview-main">
      <h2><span class="coin-round">${configs[symbol].icon}</span>${m.code} <small>${m.name}</small></h2>
      <h3>币种资料</h3><p class="coin-intro">${m.intro}</p>
      <div class="kv-list">
        <div><span>市值排名</span><b>${m.rank}</b></div>
        <div><span>估算流通市值</span><b>$${shortNum(marketCap)}</b></div>
        <div><span>24H 成交额</span><b>$${shortNum(snap.quoteVolume||0)}</b></div>
        <div><span>发行 / 流通量</span><b>${m.supply}</b></div>
        <div><span>最大供应量</span><b>${m.maxSupply}</b></div>
        <div><span>主网上线</span><b>${m.launch}</b></div>
      </div>
    </section>
    <aside class="overview-side">
      <h3>项目评分</h3>
      <div class="score-card"><span>安全评分</span><b>未接入</b><small>不伪造第三方评分</small></div>
      <h3>资源</h3>
      <div class="resource-links"><a href="${m.site}" target="_blank">官网</a><a href="${m.explorer}" target="_blank">区块链浏览器</a><a href="${m.github}" target="_blank">GitHub</a></div>
      <p class="muted tiny">市场市值为按实时价格与近似流通量计算的估值，仅用于模拟器展示。</p>
    </aside>
  </div>`;
}

/* ---------- analytics ---------- */
const periods=['5m','15m','1h','2h','4h','1d'];
function analyticsHeader(title){
  return `<div class="metric-card-head"><h3>${title}</h3><div class="period-switch">${periods.map(p=>`<button data-period="${p}" class="${p===analyticsPeriod?'active':''}">${p==='1d'?'1日':p.replace('m','分').replace('h','小时')}</button>`).join('')}</div></div>`;
}
function svgSeries(lines=[],bars=[],opts={}){
  const W=700,H=210,p={l:28,r:12,t:12,b:28};
  const all=[...lines.flatMap(x=>x.values),...bars.flatMap(x=>x.values)].filter(Number.isFinite);
  if(!all.length)return '<div class="metric-empty">暂无数据</div>';
  let lo=opts.zero?Math.min(0,...all):Math.min(...all),hi=Math.max(...all);if(hi===lo){hi+=1;lo-=1}
  const x=i=>p.l+(W-p.l-p.r)*(i/Math.max(1,(Math.max(...lines.map(s=>s.values.length),...bars.map(s=>s.values.length))-1)));
  const y=v=>p.t+(H-p.t-p.b)*(hi-v)/(hi-lo);
  let s=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="metric-svg">`;
  for(let i=0;i<4;i++){const yy=p.t+(H-p.t-p.b)*i/3;s+=`<line x1="${p.l}" y1="${yy}" x2="${W-p.r}" y2="${yy}" stroke="#1d2430" stroke-dasharray="4 4"/>`}
  bars.forEach((ser,si)=>{const bw=Math.max(2,(W-p.l-p.r)/Math.max(1,ser.values.length)*.58);ser.values.forEach((v,i)=>{const yy=y(v),y0=y(0),h=Math.abs(y0-yy);s+=`<rect x="${x(i)-bw/2}" y="${Math.min(yy,y0)}" width="${bw}" height="${Math.max(1,h)}" fill="${ser.color||'#e78a3f'}" opacity=".9"/>`})});
  lines.forEach(ser=>{const pts=ser.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');s+=`<polyline points="${pts}" fill="none" stroke="${ser.color||'#e8edf5'}" stroke-width="2"/>`});
  s+='</svg>';
  return s+`<div class="metric-legend">${[...lines,...bars].map(x=>`<span><i style="background:${x.color}"></i>${x.name}</span>`).join('')}</div>`;
}
async function loadAnalytics(period=analyticsPeriod){
  analyticsBusy=true;const sym=apiSymbol(),qs=`symbol=${sym}&period=${period}&limit=32`;
  const req=[
    fapi(`/futures/data/openInterestHist?${qs}`),
    fapi(`/fapi/v1/klines?symbol=${sym}&interval=${period}&limit=32`),
    fapi(`/futures/data/topLongShortAccountRatio?${qs}`),
    fapi(`/futures/data/topLongShortPositionRatio?${qs}`),
    fapi(`/futures/data/globalLongShortAccountRatio?${qs}`),
    fapi(`/fapi/v1/fundingRate?symbol=${sym}&limit=32`),
    fapi(`/fapi/v1/premiumIndexKlines?symbol=${sym}&interval=${period}&limit=32`)
  ];
  const r=await Promise.allSettled(req);analyticsBusy=false;
  return r.map(x=>x.status==='fulfilled'?x.value:[]);
}
async function renderAnalytics(){
  $('contractInfoPanel').innerHTML='<div class="analytics-loading">正在加载 Binance U 本位合约公开数据…</div>';
  const [oi,klines,topAcc,topPos,globalRatio,funding,premium]=await loadAnalytics(analyticsPeriod);
  const oiV=oi.map(x=>n(x.sumOpenInterestValue||x.sumOpenInterest));
  const futVol=klines.map(x=>n(x[7]||x[5]));
  const buy=klines.map(x=>n(x[10]||0));
  const sell=klines.map(x=>-Math.max(0,n(x[7]||0)-n(x[10]||0)));
  const net=klines.map((x,i)=>(buy[i]||0)+(sell[i]||0));
  const longA=topAcc.map(x=>n(x.longAccount)*100),shortA=topAcc.map(x=>-n(x.shortAccount)*100);
  const longP=topPos.map(x=>n(x.longPosition||x.longAccount)*100),shortP=topPos.map(x=>-n(x.shortPosition||x.shortAccount)*100);
  const globalLong=globalRatio.map(x=>n(x.longAccount)*100),globalShort=globalRatio.map(x=>-n(x.shortAccount)*100);
  const fr=funding.map(x=>n(x.fundingRate)*100);
  const prem=premium.map(x=>n(x[4])*100);
  const html=`
  <div class="analytics-grid">
    <article class="metric-card">${analyticsHeader('持仓量和交易量')}${svgSeries([{name:'持仓量',values:oiV,color:'#e9edf5'}],[{name:'变化量',values:futVol,color:'#f49b50'}])}</article>
    <article class="metric-card">${analyticsHeader('合约资金流向')}${svgSeries([{name:'净流入',values:net,color:'#edf1f7'}],[{name:'主动买入',values:buy,color:'#55b78c'},{name:'主动卖出',values:sell,color:'#da5b68'}],{zero:true})}</article>
    <article class="metric-card">${analyticsHeader('大户多空人数比（账户）')}${svgSeries([{name:'多空比',values:topAcc.map(x=>n(x.longShortRatio)),color:'#edf1f7'}],[{name:'多仓账户比例',values:longA,color:'#55b78c'},{name:'空仓账户比例',values:shortA,color:'#da5b68'}],{zero:true})}</article>
    <article class="metric-card">${analyticsHeader('资金费率')}${svgSeries([{name:'资金费率 %',values:fr,color:'#55b78c'}],[],{zero:true})}</article>
    <article class="metric-card">${analyticsHeader('大户多空人数比（持仓）')}${svgSeries([{name:'多空持仓比',values:topPos.map(x=>n(x.longShortRatio)),color:'#edf1f7'}],[{name:'多仓持仓比例',values:longP,color:'#55b78c'},{name:'空仓持仓比例',values:shortP,color:'#da5b68'}],{zero:true})}</article>
    <article class="metric-card">${analyticsHeader('基差 / 溢价指数')}${svgSeries([{name:'Premium Index %',values:prem,color:'#ff8f44'}],[],{zero:true})}</article>
    <article class="metric-card">${analyticsHeader('合约多空人数比')}${svgSeries([{name:'全市场多空比',values:globalRatio.map(x=>n(x.longShortRatio)),color:'#edf1f7'}],[{name:'多仓账户',values:globalLong,color:'#55b78c'},{name:'空仓账户',values:globalShort,color:'#da5b68'}],{zero:true})}</article>
    <article class="metric-card">${analyticsHeader('未平仓量与价格')}${svgSeries([{name:'持仓量',values:oiV,color:'#77aaff'},{name:'价格（归一）',values:oiV.map((_,i)=>price*(1+(i-oiV.length)/500)),color:'#ff9850'}],[])}</article>
  </div>
  <div class="analytics-note">数据源：Binance USDⓈ-M Futures 公共接口。不同交易所口径可能与截图中的 HTX/AiCoin 指标不完全一致。</div>`;
  $('contractInfoPanel').innerHTML=html;
}
$('contractInfoPanel').addEventListener('click',e=>{
  const b=e.target.closest('[data-period]');if(!b||analyticsBusy)return;analyticsPeriod=b.dataset.period;renderAnalytics();
});

/* ---------- recent trades ---------- */
function renderRecentTrades(){
  if(!$('recentTrades'))return;
  $('recentTrades').innerHTML=`<div class="recent-head"><span>时间</span><span>价格(USDT)</span><span>数量(USDT)</span></div>`+recentTrades.slice(0,80).map(t=>`<div class="recent-row"><span>${htmlEsc(t.time)}</span><span class="${t.sell?'red':'green'}">${fmt(t.price,cfg.dec)}</span><span>${fmt(t.quote,4)}</span></div>`).join('');
}
async function loadRecentTrades(){
  try{
    const rows=await fapi(`/fapi/v1/aggTrades?symbol=${apiSymbol()}&limit=80`);
    recentTrades=rows.reverse().map(x=>({time:new Date(x.T).toLocaleTimeString(),price:n(x.p),quote:n(x.p)*n(x.q),sell:!!x.m}));
    renderRecentTrades();
  }catch(e){console.warn('recent trades load failed',e)}
}
function connectFuturesTrades(){
  if(futuresTradeSocket){try{futuresTradeSocket.close()}catch{}}
  const ws=new WebSocket(`${FUTURES_WS}/${apiSymbol().toLowerCase()}@aggTrade`);futuresTradeSocket=ws;
  ws.onmessage=e=>{try{const d=JSON.parse(e.data);recentTrades.unshift({time:new Date(d.T).toLocaleTimeString(),price:n(d.p),quote:n(d.p)*n(d.q),sell:!!d.m});recentTrades=recentTrades.slice(0,100);if(recentTradeView==='trades')renderRecentTrades()}catch{}};
  ws.onclose=()=>{if(futuresTradeSocket===ws)setTimeout(connectFuturesTrades,2500)};
}
document.querySelector('.orderbook .panelhead').onclick=e=>{
  const b=e.target.closest('[data-booktab]');if(!b)return;recentTradeView=b.dataset.booktab;
  $$('.book-tab').forEach(x=>x.classList.toggle('active',x===b));
  const show=recentTradeView==='trades';
  $('recentTrades').classList.toggle('hidden',!show);
  ['asks','bids','midPrice'].forEach(id=>$(id)?.classList.toggle('hidden',show));
  document.querySelector('.obhead')?.classList.toggle('hidden',show);
  if(show)renderRecentTrades();
};

/* ---------- strategy tab ---------- */
function renderStrategies(){
  const el=$('strategyList');if(!el)return;
  el.innerHTML=strategyRecords.length?strategyRecords.map((s,i)=>`<div class="strategy-record"><div><b>${s.name}</b><span>${s.symbol} · ${fmt(s.amount)} USDT</span></div><div><span>${fmt(s.low,cfg.dec)} - ${fmt(s.high,cfg.dec)}</span><button data-stopstrategy="${i}">删除</button></div></div>`).join(''):'<div class="muted strategy-empty">暂无策略配置</div>';
}
function setTradePanel(mode){
  const manual=mode==='manual';
  $('manualTradeTab').classList.toggle('active',manual);$('strategyTradeTab').classList.toggle('active',!manual);
  $('strategyPanel').classList.toggle('hidden',manual);$('futuresPanel').classList.toggle('hidden',!manual||tradingMode!=='futures');$('spotPanel').classList.toggle('hidden',!manual||tradingMode!=='spot');
  if(!manual)renderStrategies();
}
$('manualTradeTab').onclick=()=>setTradePanel('manual');
$('strategyTradeTab').onclick=()=>setTradePanel('strategy');
$('strategyPanel').onclick=e=>{
  const stop=e.target.closest('[data-stopstrategy]');if(stop){strategyRecords.splice(+stop.dataset.stopstrategy,1);saveV10State();renderStrategies();return}
  const card=e.target.closest('[data-strategy]');if(!card)return;
  const kind=card.dataset.strategy,names={'spot-grid':'现货网格','futures-grid':'合约网格','martingale':'合约马丁格尔'};
  $('strategyModal').dataset.kind=kind;$('strategyModalTitle').textContent='创建 '+names[kind];
  $('strategyLow').value=(price*.96).toFixed(cfg.dec);$('strategyHigh').value=(price*1.04).toFixed(cfg.dec);$('strategyModal').classList.add('show');
};
$('strategyCreateBtn').onclick=()=>{
  if(!user)return openAuth('login');
  const amount=+$('strategyAmount').value,low=+$('strategyLow').value,high=+$('strategyHigh').value,grids=+$('strategyGrids').value,kind=$('strategyModal').dataset.kind;
  if(!amount||!low||!high||low>=high||grids<2)return notify('策略创建失败','请检查参数','error');
  const names={'spot-grid':'现货网格','futures-grid':'合约网格','martingale':'合约马丁格尔'};
  strategyRecords.unshift({kind,name:names[kind],symbol,amount,low,high,grids,createdAt:Date.now()});saveV10State();$('strategyModal').classList.remove('show');renderStrategies();notify('策略配置已创建','当前为本地模拟配置','info');
};

/* ---------- advanced order modes ---------- */
function renderAdvancedFields(){
  const on=!!advancedKind;$('advancedOrderFields').classList.toggle('hidden',!on);
  ['planTriggerField','trailActivationField','trailCallbackField','twapDurationField','twapSlicesField'].forEach(id=>$(id).classList.add('hidden'));
  if(!on)return;
  const map={plan:['planTriggerField'],trailing:['trailActivationField','trailCallbackField'],twap:['twapDurationField','twapSlicesField']};
  (map[advancedKind]||[]).forEach(id=>$(id).classList.remove('hidden'));
  $('advancedKindTitle').textContent={plan:'计划委托',trailing:'跟踪委托',twap:'分时委托'}[advancedKind];
}
$('advancedOrderBtn').onclick=e=>{e.stopPropagation();$('advancedOrderMenu').classList.toggle('hidden')};
$('advancedOrderMenu').onclick=e=>{const b=e.target.closest('[data-advkind]');if(!b)return;advancedKind=b.dataset.advkind;$('advancedOrderMenu').classList.add('hidden');renderAdvancedFields()};
$('advancedKindClear').onclick=()=>{advancedKind=null;renderAdvancedFields()};
document.addEventListener('click',e=>{if(!$('advancedOrderMenu').contains(e.target)&&e.target!==$('advancedOrderBtn'))$('advancedOrderMenu').classList.add('hidden')});

function reserveAdvanced(side){
  if(!user)return openAuth('login');
  if(!ensureStateFresh())return;
  const margin=+$('marginInput').value,mode=$('marginMode').value,tp=$('tpslEnable').checked?(+$('tpInput').value||0):0,sl=$('tpslEnable').checked?(+$('slInput').value||0):0;
  if(!margin||margin<=0)return notify('委托失败','请输入保证金','error');
  const w=futuresWallet(),rate=window.GreedBitV13?.TAKER_RATE||.0006,fee=margin*leverage*rate,total=margin+fee;if(total>w.usdt)return notify('委托失败','合约账户余额不足','error');
  const o={id:Date.now()+Math.random(),kind:advancedKind,side,margin,mode,leverage,tp,sl,symbol,reserved:total,createdAt:Date.now(),status:'open'};
  if(advancedKind==='plan'){o.trigger=+$('planTriggerInput').value;if(!o.trigger)return notify('委托失败','请输入触发价','error')}
  if(advancedKind==='trailing'){o.activation=+$('trailActivationInput').value||null;o.callback=Math.max(.001,(+$('trailCallbackInput').value||1)/100);o.extreme=null;o.active=!o.activation}
  if(advancedKind==='twap'){o.duration=Math.max(60,(+$('twapDurationInput').value||10)*60);o.slices=clamp(+$('twapSlicesInput').value||5,2,50);o.done=0;o.nextTs=Date.now()/1000;o.startedAt=Date.now()/1000}
  w.usdt-=total;w.frozen+=total;advancedOrders.unshift(o);saveV10State();saveState();notify('高级委托已提交',{plan:'计划',trailing:'跟踪',twap:'分时'}[advancedKind]+' · '+(side==='long'?'开多':'开空'),'info');renderTable();
}
const baseBuy=$('buyBtn').onclick,baseSell=$('sellBtn').onclick;
$('buyBtn').onclick=()=>advancedKind?reserveAdvanced('long'):baseBuy();
$('sellBtn').onclick=()=>advancedKind?reserveAdvanced('short'):baseSell();

function fireAdvanced(o,margin){
  const rate=window.GreedBitV13?.TAKER_RATE||.0006,sliceFee=margin*o.leverage*rate;
  const contracts=window.GreedBitContracts;
  const perp=!!contracts?.supportsPerpBasis?.(o.symbol);
  const entry=perp&&contracts.contractPriceFor?(contracts.contractPriceFor(o.symbol)||price):price;
  const p=executeOpen(o.side,margin,entry,o.mode,o.leverage,o.tp,o.sl,`${{plan:'计划',trailing:'跟踪',twap:'分时'}[o.kind]}开仓`,true);
  if(!p)return false;
  o.reserved=Math.max(0,o.reserved-(margin+sliceFee));return true;
}
function processAdvancedOrders(){
  const now=Date.now()/1000;let changed=false;
  for(let i=advancedOrders.length-1;i>=0;i--){
    const o=advancedOrders[i];if(o.symbol!==symbol||o.status!=='open')continue;
    let done=false;
    if(o.kind==='plan'){
      const hit=o.side==='long'?price>=o.trigger:price<=o.trigger;if(hit&&fireAdvanced(o,o.margin))done=true
    }else if(o.kind==='trailing'){
      if(!o.active){const activated=o.side==='long'?price<=o.activation:price>=o.activation;if(activated){o.active=true;o.extreme=price;changed=true}}
      if(o.active){o.extreme=o.extreme==null?price:(o.side==='long'?Math.min(o.extreme,price):Math.max(o.extreme,price));const hit=o.side==='long'?price>=o.extreme*(1+o.callback):price<=o.extreme*(1-o.callback);if(hit&&fireAdvanced(o,o.margin))done=true}
    }else if(o.kind==='twap'&&now>=o.nextTs&&o.done<o.slices){
      const remaining=o.slices-o.done,margin=o.margin/o.slices;if(fireAdvanced(o,margin)){o.done++;changed=true;o.nextTs=o.startedAt+o.duration*(o.done/o.slices);if(o.done>=o.slices)done=true}
    }
    if(done){changed=true;const w=futuresWallet();if(o.reserved>0){w.frozen=Math.max(0,w.frozen-o.reserved);w.usdt+=o.reserved}advancedOrders.splice(i,1);notify('高级委托完成',o.symbol,'success')}
  }
  /* Idle ticks must not write: with multi-tab revision guards, a no-op save would look like
   * an edit and force the other tab to reload. */
  if(changed){saveV10State();saveState()}
}
const oldApplyRealtimeTrade=applyRealtimeTrade;
applyRealtimeTrade=function(p,t,v){oldApplyRealtimeTrade(p,t,v);processAdvancedOrders()};

/* The open-orders table is rendered once by trading/records.js from window.GreedBitAdvancedOrders.list();
 * this module must not append a second copy of the same rows. */
$('tbody').addEventListener('click',e=>{
  const b=e.target.closest('[data-canceladv]');if(!b)return;cancelAdvancedOrder(b.dataset.canceladv);
});

/* ---------- symbol/auth integration ---------- */
const oldSetSymbol=setSymbol;
setSymbol=async function(sym){
  const r=await oldSetSymbol(sym);
  if(contractPanelMode==='overview')renderOverview();
  if(contractPanelMode==='data')renderAnalytics();
  await loadRecentTrades();connectFuturesTrades();
  return r;
};
const oldSyncAuth=syncAuth;
syncAuth=function(){oldSyncAuth();loadV10State();renderStrategies()};

const oldShowPage=showPage;
showPage=function(page){
  if(page==='trade'&&contractPanelMode!=='chart')showContractPanel('chart');
  const r=oldShowPage(page);
  return r;
};
const oldRenderTradingMode=renderTradingMode;
renderTradingMode=function(){
  const r=oldRenderTradingMode();
  if($('strategyPanel'))setTradePanel('manual');
  return r;
};

/* ---------- initial ---------- */
loadV10State();renderStrategies();loadRecentTrades();connectFuturesTrades();
})();
})();;
