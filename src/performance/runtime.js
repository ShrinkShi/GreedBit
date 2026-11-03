/* Design system, virtual tables and worker-throttled market rendering. */
(function(){
'use strict';
const V=window.GreedBitV13;if(!V)throw new Error('market/model.js must load before performance/runtime.js');
const ROW_H=40,BUFFER=7,VIRTUAL_THRESHOLD=80;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function installStyle(){if(document.querySelector('link[href="styles/v015.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v015.css';document.head.appendChild(l)}

function migrateChartContrast(){
  if(typeof chartDefaults==='object')chartDefaults.bear='#ff6b78';
  const old=String(chartSettings?.bear||'').toLowerCase();
  if(old==='#ec5d68'||old==='#d65361'){chartSettings.bear='#ff6b78';try{localStorage.setItem('greedbit_chart_settings',JSON.stringify(chartSettings))}catch{}}
  draw();
}

const POSITIVE_IDS=new Set(['marginInput','limitPriceInput','spotLimitInput','spotAmountInput','fundAmount','transferAmount','earnAmount','tpInput','slInput']);
function fieldHost(input){return input.closest('.field')||input.parentElement}
function clearFieldError(input){const host=fieldHost(input);host?.classList.remove('gb-invalid');input.removeAttribute('aria-invalid');const err=host?.nextElementSibling;if(err?.classList.contains('gb-field-error'))err.remove()}
function validateNumber(input){
  if(!input||input.type!=='number'||input.disabled)return true;
  const raw=input.value.trim();if(raw===''){clearFieldError(input);return true}
  const n=Number(raw),min=input.min!==''?Number(input.min):null,max=input.max!==''?Number(input.max):null;
  let bad=!Number.isFinite(n)||(min!=null&&n<min)||(max!=null&&n>max)||(POSITIVE_IDS.has(input.id)&&n<=0);
  if(!bad){clearFieldError(input);return true}
  const host=fieldHost(input);host?.classList.add('gb-invalid');input.setAttribute('aria-invalid','true');
  let err=host?.nextElementSibling;if(!err?.classList.contains('gb-field-error')){err=document.createElement('small');err.className='gb-field-error';host?.insertAdjacentElement('afterend',err)}
  err.textContent=POSITIVE_IDS.has(input.id)?'请输入大于 0 的有效数值。':'请输入有效数值。';return false;
}
function installValidation(){
  document.addEventListener('focusout',e=>{if(e.target instanceof HTMLInputElement&&e.target.type==='number')validateNumber(e.target)},true);
  document.addEventListener('input',e=>{const i=e.target;if(i instanceof HTMLInputElement&&i.type==='number'&&i.getAttribute('aria-invalid')==='true')validateNumber(i)},true);
}

const TERMS={
  '保证金':'用于建立和维持杠杆仓位的抵押资金。保证金越低，距离强制平仓通常越近。',
  '强平价':'当仓位风险达到维持保证金要求时，系统预计触发强制平仓的价格。',
  '爆仓价':'即预计强平价：账户风险达到维持保证金要求时，系统可能强制平仓。',
  '标记价':'用于计算未实现盈亏与强平风险的参考价格，可降低异常成交价对风险计算的影响。',
  '资金费率':'永续合约多空双方定期交换的费用，用于帮助合约价格锚定现货市场。',
  '维持保证金率':'维持当前杠杆仓位所需的最低保证金比例。',
  '未实现盈亏':'尚未平仓仓位按当前标记价计算的浮动盈亏。',
  '杠杆':'名义仓位相对于保证金的放大倍数；收益与风险都会同步放大。',
  'ROE':'按仓位保证金计算的收益率，用于衡量杠杆资金的盈亏比例。'
};
let tooltip=null,tipTimer=null,tipTarget=null;
function termFor(text){const s=String(text||'').replace(/\s+/g,'').replace(/[：:]/g,'');return Object.keys(TERMS).sort((a,b)=>b.length-a.length).find(k=>s.includes(k))||null}
function annotateTerms(){
  const scope=document.querySelectorAll('.trade-page .field label,.trade-page .stat small,.trade-page .metric-grid span,.trade-page th,.trade-page .assetrow span,.assets-page th,.assets-page .asset-list-row span:first-child');
  scope.forEach(el=>{if(el.dataset.termTip)return;const k=termFor(el.textContent);if(k){el.dataset.termTip=TERMS[k];el.classList.add('gb-term-tip');el.tabIndex=0}})
}
function showTermTip(el){
  if(!tooltip){tooltip=document.createElement('div');tooltip.className='gb-term-tooltip';tooltip.setAttribute('role','tooltip');document.body.appendChild(tooltip)}
  tooltip.textContent=el.dataset.termTip||'';const r=el.getBoundingClientRect();tooltip.style.left='0';tooltip.style.top='0';tooltip.classList.add('show');const tr=tooltip.getBoundingClientRect(),left=Math.max(8,Math.min(innerWidth-tr.width-8,r.left)),top=r.bottom+8+tr.height<innerHeight?r.bottom+8:Math.max(8,r.top-tr.height-8);tooltip.style.left=left+'px';tooltip.style.top=top+'px';
}
function hideTermTip(){clearTimeout(tipTimer);tipTarget=null;tooltip?.classList.remove('show')}
function installTerms(){
  document.addEventListener('mouseover',e=>{const el=e.target.closest?.('[data-term-tip]');if(!el||el===tipTarget)return;hideTermTip();tipTarget=el;tipTimer=setTimeout(()=>{if(tipTarget===el)showTermTip(el)},200)});
  document.addEventListener('mouseout',e=>{const el=e.target.closest?.('[data-term-tip]');if(el&&!el.contains(e.relatedTarget))hideTermTip()});
  document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-term-tip]');if(el){hideTermTip();tipTarget=el;tipTimer=setTimeout(()=>showTermTip(el),200)}});
  document.addEventListener('focusout',e=>{if(e.target.closest?.('[data-term-tip]'))hideTermTip()});window.addEventListener('scroll',hideTermTip,true);
  const mo=new MutationObserver(()=>requestAnimationFrame(annotateTerms));mo.observe(document.body,{childList:true,subtree:true});annotateTerms();
}

function chartSkeleton(){return`<div class="gb-chart-skeleton" id="gbChartSkeleton">${[32,58,42,74,48,82,55,68,36,77,49,63].map(h=>`<i style="height:${h}%"></i>`).join('')}</div>`}
function showChartSkeleton(){const host=$('chartwrap');if(host&&!$('gbChartSkeleton'))host.insertAdjacentHTML('beforeend',chartSkeleton())}
function hideChartSkeleton(){const el=$('gbChartSkeleton');if(!el)return;el.style.opacity='0';el.style.transition='opacity .14s ease';setTimeout(()=>el.remove(),150)}
function pageSkeleton(){return`<div class="gb-page-skeleton"><div class="gb-skeleton hero"></div><div class="grid">${'<div class="gb-skeleton card"></div>'.repeat(6)}</div></div>`}
const inheritedSetSymbol=setSymbol;
setSymbol=async function(sym){if(!configs[sym]||sym===symbol)return inheritedSetSymbol.apply(this,arguments);showChartSkeleton();try{return await inheritedSetSymbol.apply(this,arguments)}finally{hideChartSkeleton();setTimeout(annotateTerms,0)}};
const inheritedShowPage=showPage,visitedLocalPages=new Set();
showPage=function(page){const first=!visitedLocalPages.has(page)&&(page==='assets'||page==='earn'),out=inheritedShowPage.apply(this,arguments);if(first){visitedLocalPages.add(page);const host=page==='assets'?$('assetPageBody'):$('earnShell');if(host){host.innerHTML=pageSkeleton();requestAnimationFrame(()=>{if(currentPage!==page)return;if(page==='assets')renderAssetPage();else V.renderEarn?.();annotateTerms()})}}setTimeout(annotateTerms,0);return out};

let virtual={spec:null,key:'',wrap:null,raf:0,onScroll:null};
function fmtDec(sym){return configs[sym]?.dec??2}
function virtualSpec(){
  if(!user)return null;
  if(tradingMode==='futures'){
    if(tableMode==='open')return{key:'f:open',arr:orders,cols:7,head:'<tr><th>时间</th><th>合约</th><th>方向</th><th>限价</th><th>保证金</th><th>杠杆</th><th>操作</th></tr>',row:o=>`<tr><td>${esc(o.createdAt)}</td><td>${esc(o.symbol)}</td><td>${o.side==='long'?'开多':'开空'}</td><td>${fmt(o.limit,fmtDec(o.symbol))}</td><td>${fmt(o.margin)}</td><td>${esc(o.leverage)}X</td><td><button class="cancel" data-cancel="${+o.id}">撤单</button></td></tr>`};
    const maps={orders:[orderHistory,'历史委托'],history:[trades,'成交记录'],closed:[closedPositions,'历史仓位'],ledger:[ledger.filter(x=>x.wallet==='futures'),'财务记录']};const m=maps[tableMode];if(!m)return null;return{key:'f:'+tableMode,arr:m[0],cols:5,head:'<tr><th>时间</th><th>项目</th><th>交易对</th><th>详情</th><th>金额/价格</th></tr>',row:x=>`<tr><td>${esc(x.finishedAt||x.closedAt||x.time||'-')}</td><td>${esc(x.status||x.reason||x.type||m[1])}</td><td>${esc(x.symbol||'-')}</td><td>${esc(x.note||x.side||'-')}</td><td>${x.amount!=null?fmt(x.amount):x.price!=null?fmt(x.price,fmtDec(x.symbol)):x.realized!=null?fmt(x.realized):'-'}</td></tr>`}
  }
  if(tableMode==='spotOpen')return{key:'s:open',arr:spotOrders,cols:6,head:'<tr><th>时间</th><th>交易对</th><th>方向</th><th>限价</th><th>数量/金额</th><th>操作</th></tr>',row:o=>`<tr><td>${esc(o.createdAt)}</td><td>${esc(o.symbol)}</td><td class="${o.side==='buy'?'green':'red'}">${o.side==='buy'?'买入':'卖出'}</td><td>${fmt(o.limit,fmtDec(o.symbol))}</td><td>${o.side==='buy'?fmt(o.amount)+' USDT':fmt(o.qty,6)+' '+esc(o.symbol?.split('/')[0]||'')}</td><td><button class="cancel" data-cancelspot="${+o.id}">撤单</button></td></tr>`};
  if(tableMode==='spotOrders'||tableMode==='spotTrades'){const arr=tableMode==='spotOrders'?spotOrderHistory:spotTrades;return{key:'s:'+tableMode,arr,cols:5,head:'<tr><th>时间</th><th>交易对</th><th>方向</th><th>价格</th><th>状态/类型</th></tr>',row:o=>`<tr><td>${esc(o.finishedAt||o.time)}</td><td>${esc(o.symbol)}</td><td class="${o.side==='buy'?'green':'red'}">${o.side==='buy'?'买入':'卖出'}</td><td>${fmt(o.limit||o.price,fmtDec(o.symbol))}</td><td>${esc(o.status||o.type)}</td></tr>`}}
  return null;
}
function renderVirtualRows(){
  const s=virtual.spec,wrap=virtual.wrap,body=$('tbody');if(!s||!wrap||!body)return;const total=s.arr.length,viewport=wrap.clientHeight||260,start=Math.max(0,Math.floor(wrap.scrollTop/ROW_H)-BUFFER),count=Math.ceil(viewport/ROW_H)+BUFFER*2,end=Math.min(total,start+count),top=start*ROW_H,bottom=Math.max(0,(total-end)*ROW_H),rows=s.arr.slice(start,end).map(s.row).join('');
  body.innerHTML=`<tr class="gb-virtual-spacer"><td colspan="${s.cols}"><div style="height:${top}px"></div></td></tr>${rows}<tr class="gb-virtual-spacer"><td colspan="${s.cols}"><div style="height:${bottom}px"></div></td></tr>`;annotateTerms();
}
function attachVirtualScroll(){const wrap=document.querySelector('.bottom .tablewrap');if(!wrap)return;if(virtual.wrap===wrap&&virtual.onScroll)return;if(virtual.wrap&&virtual.onScroll)virtual.wrap.removeEventListener('scroll',virtual.onScroll);virtual.wrap=wrap;virtual.onScroll=()=>{if(virtual.raf)return;virtual.raf=requestAnimationFrame(()=>{virtual.raf=0;renderVirtualRows()})};wrap.addEventListener('scroll',virtual.onScroll,{passive:true})}
const inheritedRenderTable=renderTable;
renderTable=function(){
  const spec=virtualSpec();
  if(!spec||spec.arr.length<VIRTUAL_THRESHOLD){virtual.spec=null;virtual.key='';return inheritedRenderTable.apply(this,arguments)}
  $('positionFilters')?.classList.add('hidden');$('thead').innerHTML=spec.head;attachVirtualScroll();if(virtual.key!==spec.key){virtual.key=spec.key;if(virtual.wrap)virtual.wrap.scrollTop=0}virtual.spec=spec;renderVirtualRows();
};

let marketWorker=null,activeSeq=0,activeExpected='',uiQueued=false,lastUi=0,uiTimer=0;
function ensureMarketWorker(){
  if(marketWorker)return marketWorker;
  try{marketWorker=new Worker('src/performance/market-worker.js');marketWorker.onmessage=e=>handleWorkerBatch(e.data)}catch(e){console.warn('market worker unavailable; using main-thread fallback',e);marketWorker=null}
  return marketWorker;
}
function applyTradeCore(p,t,v){
  if(!Number.isFinite(p)||!Number.isFinite(t))return;const info=tfInfo();
  if(current&&t>=current.t&&t<current.end){current.h=Math.max(current.h,p);current.l=Math.min(current.l,p);current.c=p;current.v+=(Number(v)||0)}else{
    if(current){current.live=false;candles.push(current);if(candles.length>12000)candles.shift()}
    let start;if(info.calendarMonth)start=bucketStart(t,info);else{const prev=candles.at(-1),anchor=prev?.end;if(anchor!=null){start=anchor;while(t>=start+info.sec)start+=info.sec}else start=bucketStart(t,info)}
    current={t:start,end:bucketEnd(start,info),o:p,h:p,l:p,c:p,v:Number(v)||0,live:true};
  }
  price=p;marketSnapshots[symbol].last=p;resolveNews();matchOrders();matchSpotOrders();checkRisk();settleFunding();
}
function flushMarketUi(){uiQueued=false;clearTimeout(uiTimer);uiTimer=0;lastUi=performance.now();requestAnimationFrame(()=>{stats();updateFooterTickers();draw();renderTable()})}
function scheduleMarketUi(){if(uiQueued)return;uiQueued=true;const wait=Math.max(0,80-(performance.now()-lastUi));if(wait<=1)requestAnimationFrame(flushMarketUi);else uiTimer=setTimeout(()=>requestAnimationFrame(flushMarketUi),wait)}
function handleWorkerBatch(msg){
  if(!msg||msg.type!=='batch'||msg.seq!==activeSeq||symbol!==activeExpected)return;
  for(const t of msg.trades||[])applyTradeCore(+t.p,+t.t,+t.v);
  if(msg.ticker){const m=msg.ticker;marketSnapshots[symbol]={last:+m.last,change:+m.change,high:+m.high,low:+m.low,quoteVolume:+m.quoteVolume};latestTicker=marketSnapshots[symbol];if(Number.isFinite(+m.last))price=+m.last}
  scheduleMarketUi();
}
function directRawFallback(payload,seq){try{const root=JSON.parse(payload),d=root?.data||root;if(d.e==='aggTrade')handleWorkerBatch({type:'batch',seq,trades:[{p:+d.p,t:+d.T/1000,v:+d.q}],ticker:null});else if(d.e==='24hrTicker')handleWorkerBatch({type:'batch',seq,trades:[],ticker:{last:+d.c,change:+d.P,high:+d.h,low:+d.l,quoteVolume:+d.q}})}catch{}}
const inheritedConnectMarket=connectMarketSocket;
connectMarketSocket=function(hostIndex=0){
  const meta=V.META?.[symbol];if(meta?.market!=='binance')return inheritedConnectMarket.apply(this,arguments);
  closeMarketSocket(false);marketSocketHostIndex=hostIndex;const s=apiSymbol().toLowerCase(),host=WS_HOSTS[hostIndex]||WS_HOSTS[0],url=`${host}/stream?streams=${s}@aggTrade/${s}@ticker`;setMarketStatus('connecting','正在连接实时行情…');
  try{marketSocket=new WebSocket(url)}catch{scheduleSocketReconnect(hostIndex+1);return}
  const expected=symbol,seq=++activeSeq;activeExpected=expected;ensureMarketWorker()?.postMessage({type:'reset',seq});
  marketSocket.onopen=()=>{if(expected!==symbol)return;setMarketStatus('live','Binance 实时行情已连接 · Worker批处理')};
  marketSocket.onmessage=ev=>{if(expected!==symbol||seq!==activeSeq)return;const w=ensureMarketWorker();if(w)w.postMessage({type:'raw',seq,payload:ev.data});else directRawFallback(ev.data,seq)};
  marketSocket.onerror=()=>{};marketSocket.onclose=()=>{if(expected===symbol&&seq===activeSeq)scheduleSocketReconnect(hostIndex+1)};
};

function boot(){
  installStyle();migrateChartContrast();installValidation();installTerms();renderTable();annotateTerms();
  const meta=V.META?.[symbol];if((currentPage==='trade'||currentPage==='futures')&&meta?.market==='binance')connectMarketSocket();
}
boot();
window.GreedBitPerformance={annotateTerms,validateNumber};
})();
