/* v0.0.18 contract basis / funding / stock spot+perp / interaction polish */
(function(){
'use strict';

const VERSION='0.0.18';
const BASIS_KEY='greedbit_futures_basis_v18';
const V=window.GreedBitV13;
let stockPickerMode='futures';
let requestedTradingMode=null;
let decorateQueued=false;
let basisSaveTimer=0;

const COMPANY_NAMES={
  AAL:'美国航空集团',AAOI:'Applied Optoelectronics',AAPL:'苹果公司',ABBV:'艾伯维',ACN:'埃森哲',ADBE:'Adobe',ADI:'亚德诺半导体',AEHR:'Aehr Test Systems',AKAM:'Akamai',ALAB:'Astera Labs',AMAT:'应用材料',AMC:'AMC院线',AMD:'超威半导体',AMZN:'亚马逊',ANET:'Arista Networks',APP:'AppLovin',ARM:'Arm Holdings',ASML:'阿斯麦',ASTS:'AST SpaceMobile',ASX:'日月光半导体',AVGO:'博通',AXTI:'AXT',
  BA:'波音',BABA:'阿里巴巴',BAC:'美国银行',BBX:'BBX Capital',BE:'Bloom Energy',BKNG:'Booking Holdings',BMNR:'BitMine Immersion Technologies',BRK_B:'伯克希尔·哈撒韦',BX:'黑石集团',CAT:'卡特彼勒',CEG:'Constellation Energy',CIEN:'Ciena',CIFR:'Cipher Mining',CLSK:'CleanSpark',COHR:'Coherent',COIN:'Coinbase',COST:'开市客',CRCL:'Circle Internet Group',CRDO:'Credo Technology',CRM:'Salesforce',CRML:'Critical Metals',CRWD:'CrowdStrike',CRWV:'CoreWeave',CSCO:'思科',CVNA:'Carvana',CVX:'雪佛龙',
  DDOG:'Datadog',DELL:'戴尔科技',DIS:'华特迪士尼',DJT:'Trump Media & Technology Group',DKNG:'DraftKings',EBAY:'eBay',EQT:'EQT Corporation',FCX:'Freeport-McMoRan',FLEX:'伟创力',FLNC:'Fluence Energy',FOXA:'福克斯公司',GE:'GE Aerospace',GEV:'GE Vernova',GFS:'格芯',GILD:'吉利德科学',GLW:'康宁',GME:'GameStop',GOOGL:'Alphabet（Google）',GPRO:'GoPro',GS:'高盛',GTLB:'GitLab',HD:'家得宝',HIMS:'Hims & Hers Health',HOOD:'Robinhood',HPE:'慧与科技',HUT:'Hut 8',
  IBKR:'盈透证券',IBM:'IBM',INTC:'英特尔',INTU:'Intuit',IONQ:'IonQ',IREN:'IREN',ISRG:'直觉外科',JNJ:'强生',JPM:'摩根大通',KLAC:'科磊',KO:'可口可乐',LIN:'林德',LITE:'Lumentum',LLY:'礼来',LMT:'洛克希德·马丁',LRCX:'泛林集团',LULU:'露露乐蒙',LUNR:'Intuitive Machines',MAR:'万豪国际',MCD:'麦当劳',MDB:'MongoDB',MDT:'美敦力',MELI:'MercadoLibre',META:'Meta Platforms',MP:'MP Materials',MRK:'默沙东',MRNA:'Moderna',MRVL:'Marvell Technology',MSFT:'微软',MSTR:'Strategy',MU:'美光科技',
  NBIS:'Nebius Group',NET:'Cloudflare',NFLX:'奈飞',NKE:'耐克',NOK:'诺基亚',NOW:'ServiceNow',NVDA:'英伟达',NVO:'诺和诺德',OKLO:'Oklo',ONDS:'Ondas Holdings',ORCL:'甲骨文',OUST:'Ouster',PANW:'Palo Alto Networks',PATH:'UiPath',PDD:'拼多多（PDD Holdings）',PFE:'辉瑞',PG:'宝洁',PLTR:'Palantir',PYPL:'PayPal',QCOM:'高通',RDDT:'Reddit',RDW:'Redwire',REGN:'再生元制药',RIVN:'Rivian',RKLB:'Rocket Lab',RUM:'Rumble',SBUX:'星巴克',SHOP:'Shopify',SMCI:'超微电脑',SNDK:'闪迪（SanDisk）',SNOW:'Snowflake',SOFI:'SoFi Technologies',SPOT:'Spotify',STM:'意法半导体',TEAM:'Atlassian',TER:'泰瑞达',TLT:'iShares 20+年期美国国债ETF',TSLA:'特斯拉',TSM:'台积电',TTWO:'Take-Two Interactive',TWLO:'Twilio',TWST:'Twist Bioscience',TXN:'德州仪器',UBER:'Uber',UMC:'联华电子',UNH:'联合健康集团',V:'Visa',VICR:'Vicor',VKTX:'Viking Therapeutics',VLO:'Valero Energy',VRT:'Vertiv',VST:'Vistra',WDC:'西部数据',WEN:'Wendy’s',WMT:'沃尔玛',XOM:'埃克森美孚',ZM:'Zoom Communications',ZS:'Zscaler'
};

function installStyle(){
  if(document.querySelector('link[href="styles/v018.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v018.css';document.head.appendChild(l);
}
function updateVersion(){
  const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));
  if(el)el.textContent=`GreedBit v${VERSION}`;
}
function metaFor(sym=symbol){return V?.META?.[sym]||null}
function isStock(sym=symbol){const m=metaFor(sym);return !!m&&(m.market==='stock'||m.category==='stock')}
function isCommodityOrForex(sym=symbol){const m=metaFor(sym);return !!m&&(m.market==='commodity'||m.category==='commodity'||m.market==='forex'||m.category==='forex')}
function supportsPerpBasis(sym=symbol){return !!configs?.[sym]&&!isCommodityOrForex(sym)}
function stockMetas(){return Object.values(V?.META||{}).filter(m=>m&&(m.market==='stock'||m.category==='stock'))}
function companyName(m){
  if(!m)return'';
  const key=String(m.ticker||'').replace('-','_').toUpperCase();
  const known=COMPANY_NAMES[key];if(known)return known;
  const current=String(m.name||'').trim();
  if(current&&current.toUpperCase()!==String(m.ticker||'').toUpperCase())return current;
  return '公司名称待核验';
}
function patchCompanyNames(){
  for(const m of stockMetas()){
    const name=companyName(m);if(name&&name!=='公司名称待核验'){m.name=name;if(configs[m.symbol])configs[m.symbol].name=name}
  }
}

let basisState={};
try{basisState=JSON.parse(localStorage.getItem(BASIS_KEY)||'{}')||{}}catch{basisState={}}
function hash01(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return((h>>>0)%10000)/10000}
function queueBasisSave(){
  clearTimeout(basisSaveTimer);basisSaveTimer=setTimeout(()=>{try{localStorage.setItem(BASIS_KEY,JSON.stringify(basisState))}catch{}},600);
}
function spotReference(sym=symbol){
  const s=marketSnapshots?.[sym],c=configs?.[sym];
  const p=Number(s?.last||c?.anchor||0);return Number.isFinite(p)&&p>0?p:0;
}
function touchBasis(sym=symbol,force=false){
  if(!supportsPerpBasis(sym))return 0;
  const now=Date.now(),snap=marketSnapshots?.[sym]||{},change=Number(snap.change)||0;
  let st=basisState[sym];
  if(!st||!Number.isFinite(+st.basis)){st={basis:(hash01(sym)-.5)*.0008,updatedAt:now}}
  const elapsed=Math.max(1,Math.min(30,(now-(+st.updatedAt||now))/1800));
  if(force||now-(+st.updatedAt||0)>1200){
    const marketMood=Math.max(-.0035,Math.min(.0035,(change/100)*.08));
    const cycle=Math.sin(now/55000+hash01(sym)*9)*.00028;
    const shock=(Math.random()-.5)*.000055*Math.sqrt(elapsed);
    const target=Math.max(-.0042,Math.min(.0042,marketMood+cycle));
    st.basis=Math.max(-.005,Math.min(.005,(+st.basis||0)+(target-(+st.basis||0))*.075*elapsed+shock));
    st.updatedAt=now;basisState[sym]=st;queueBasisSave();
  }
  return +st.basis||0;
}
function contractPriceFor(sym=symbol){const spot=spotReference(sym);if(!spot)return 0;return spot*(1+touchBasis(sym))}
function fundingFor(sym=symbol){return Math.max(-.0006,Math.min(.0006,touchBasis(sym)*.12))}
function basisPct(sym=symbol){return touchBasis(sym)*100}

function chevronSvg(cls=''){return`<svg class="gb18-chevron ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><polygon points="12,7 6,14 18,14" /></svg>`}
function installChevrons(){
  const btn=$('pairPickerBtn');if(btn&&!btn.querySelector('.gb18-pair-chevron')){
    const spans=[...btn.querySelectorAll(':scope > span')],old=spans.find(x=>x.id!=='pairName');
    if(old){old.className='gb18-pair-chevron';old.innerHTML=chevronSvg('gb18-main-chevron')}
  }
  const maker=document.querySelector('.maker-label');if(maker&&!maker.querySelector('.gb18-chevron'))maker.innerHTML=`只做Maker ${chevronSvg()}`;
  document.querySelectorAll('button,span').forEach(el=>{
    if(el.children.length||!el.textContent.includes('⌄'))return;
    const text=el.textContent.replaceAll('⌄','').trim();el.textContent=text+' ';el.insertAdjacentHTML('beforeend',chevronSvg());
  });
}
function syncChevronState(){
  const picker=$('coinPicker'),wrap=document.querySelector('#pairPickerBtn .gb18-pair-chevron');if(!picker||!wrap)return;
  wrap.classList.toggle('is-open',!picker.classList.contains('hidden'));
}

function desiredPairLabel(){
  const m=metaFor(symbol);
  if(tradingMode==='futures'&&supportsPerpBasis(symbol))return `${String(symbol).replace('/','')}永续合约`;
  if(tradingMode==='spot')return m?.ticker||base();
  return m?.market==='forex'?(m.ticker||symbol):symbol;
}
function syncPairHeader(){
  const name=$('pairName'),wanted=desiredPairLabel();if(name&&name.textContent!==wanted)name.textContent=wanted;
  const tiny=$('lastPrice')?.parentElement?.querySelector('.muted.tiny');if(!tiny)return;
  const m=metaFor(symbol),source=marketSnapshots?.[symbol]?._source||'';
  let text=source||'公开市场行情';
  if(tradingMode==='futures'&&supportsPerpBasis(symbol))text=`永续合约模拟价格 · 基差 ${basisPct(symbol)>=0?'+':''}${basisPct(symbol).toFixed(3)}%`;
  else if(isStock(symbol)&&tradingMode==='spot')text=`${companyName(m)}股票代币现货 · ${source||'参考行情'}`;
  if(tiny.textContent!==text)tiny.textContent=text;
}

function ensureStockModeSwitch(){
  const picker=$('coinPicker'),head=picker?.querySelector('.coin-list-head'),list=$('coinList');if(!picker||!head||!list)return;
  let bar=$('gb18StockModeSwitch');
  if(!bar){
    bar=document.createElement('div');bar.id='gb18StockModeSwitch';bar.className='gb18-stock-mode-switch hidden';
    bar.innerHTML='<span>股票代币交易模式</span><div><button data-gb18-stockmode="futures">永续合约</button><button data-gb18-stockmode="spot">现货</button></div>';
    head.insertAdjacentElement('afterend',bar);
    bar.onclick=e=>{const b=e.target.closest('[data-gb18-stockmode]');if(!b)return;e.preventDefault();e.stopPropagation();stockPickerMode=b.dataset.gb18Stockmode;decoratePicker();$('coinPicker')?.classList.remove('hidden')};
  }
  const active=!!document.querySelector('.coin-tabs [data-v17-picker="stocks"].active');bar.classList.toggle('hidden',!active);
  bar.querySelectorAll('[data-gb18-stockmode]').forEach(b=>b.classList.toggle('active',b.dataset.gb18Stockmode===stockPickerMode));
}
function replaceRowTitle(row,title,sub){
  const b=row.querySelector('.coin-text-v14 b'),small=row.querySelector('.coin-text-v14 small');
  if(b&&b.textContent!==title)b.textContent=title;
  if(small&&small.textContent!==sub)small.textContent=sub;
}
function decoratePicker(){
  ensureStockModeSwitch();
  const stockTabActive=!!document.querySelector('.coin-tabs [data-v17-picker="stocks"].active');
  const head=document.querySelector('.coin-list-head');
  if(stockTabActive&&head?.children?.[0])head.children[0].textContent=stockPickerMode==='futures'?'股票代币·永续':'股票代币·现货';
  document.querySelectorAll('#coinList .coin-row[data-symbol]').forEach(row=>{
    const sym=row.dataset.symbol,market=row.dataset.market,m=metaFor(sym);if(!m)return;
    if(market==='futures'){
      replaceRowTitle(row,`${String(sym).replace('/','')}永续合约`,`${m.name||m.ticker} · 永续`);
      const val=row.children?.[1],p=contractPriceFor(sym);if(val&&p)val.textContent=fmt(p,m.dec??configs[sym]?.dec??2);
      row.classList.toggle('active',sym===symbol&&tradingMode==='futures');
    }
    if(market==='stock'){
      const mode=stockPickerMode,company=companyName(m),sim=m.synthetic?'GreedBit 模拟估值':'追踪公开标的价格';
      const title=mode==='futures'?`${m.ticker}USDT永续合约`:m.ticker;
      replaceRowTitle(row,title,`${company}股票 · ${mode==='futures'?'永续合约':'现货'} · ${sim}`);
      const val=row.children?.[1],p=mode==='futures'?contractPriceFor(sym):spotReference(sym);if(val&&p)val.textContent=fmt(p,m.dec??2);
      row.classList.toggle('active',sym===symbol&&tradingMode===mode);
      row.dataset.gb18StockMode=mode;
    }
  });
}
function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;decoratePicker();installChevrons();syncChevronState()})}

async function chooseStock(sym,mode){
  requestedTradingMode=mode;tradingMode=mode;
  try{await setSymbol(sym)}finally{requestedTradingMode=null}
  showPage(mode==='spot'?'trade':'futures');tradingMode=mode;renderTradingMode();syncPairHeader();draw();renderTable();updateAssets();
  $('coinPicker')?.classList.add('hidden');syncChevronState();
}
function installPickerFixes(){
  const picker=$('coinPicker'),tabs=picker?.querySelector('.coin-tabs'),list=$('coinList');if(!picker||!tabs||!list)return;
  picker.addEventListener('click',e=>e.stopPropagation());
  tabs.addEventListener('click',e=>{if(!e.target.closest('button'))return;e.stopPropagation();requestAnimationFrame(()=>{picker.classList.remove('hidden');scheduleDecorate()})});
  list.addEventListener('click',e=>{
    const row=e.target.closest('.coin-row[data-market="stock"]');if(!row||e.target.closest('[data-v17-fav]'))return;
    e.preventDefault();e.stopImmediatePropagation();chooseStock(row.dataset.symbol,stockPickerMode);
  },true);
  new MutationObserver(scheduleDecorate).observe(picker,{childList:true,subtree:true});
  new MutationObserver(syncChevronState).observe(picker,{attributes:true,attributeFilter:['class']});
  scheduleDecorate();
}

function ensureStockWalletShape(){
  const w=spotWallet?.();if(!w)return;w.coins=w.coins||{};w.frozenCoins=w.frozenCoins||{};w.cost=w.cost||{};
  for(const m of stockMetas()){if(w.coins[m.ticker]==null)w.coins[m.ticker]=0;if(w.frozenCoins[m.ticker]==null)w.frozenCoins[m.ticker]=0;if(w.cost[m.ticker]==null)w.cost[m.ticker]=0}
}
function stockSpotValueNet(){
  const w=spotWallet(),taker=V?.TAKER_RATE??.0006;let sum=0;
  for(const m of stockMetas()){const q=Number(w.coins?.[m.ticker]||0),p=spotReference(m.symbol);if(q>0&&p>0)sum+=q*p*(1-taker)}return sum;
}
const inheritedSpotCoinValue=spotCoinValue;
spotCoinValue=function(){return inheritedSpotCoinValue.apply(this,arguments)+stockSpotValueNet()};
const inheritedTotalAsset=totalAsset;
totalAsset=function(){return inheritedTotalAsset.apply(this,arguments)+stockSpotValueNet()};
const inheritedLoadState=loadState;
loadState=function(){const out=inheritedLoadState.apply(this,arguments);ensureStockWalletShape();return out};
const inheritedFreshWallets=freshWallets;
freshWallets=function(){const w=inheritedFreshWallets.apply(this,arguments),old=wallets;try{wallets=w;ensureStockWalletShape()}finally{wallets=old}return w};
ensureStockWalletShape();

const inheritedRenderSpotTable=renderSpotTable;
renderSpotTable=function(){
  const out=inheritedRenderSpotTable.apply(this,arguments);if(tableMode!=='spotAssets')return out;
  const body=$('tbody'),w=spotWallet();if(!body)return out;
  const rows=stockMetas().filter(m=>(+w.coins?.[m.ticker]||0)>0||(+w.frozenCoins?.[m.ticker]||0)>0).map(m=>{const total=+w.coins[m.ticker]||0,frozen=+w.frozenCoins[m.ticker]||0,avail=Math.max(0,total-frozen),p=spotReference(m.symbol);return`<tr class="gb18-stock-asset-row"><td>${m.ticker}<small>${companyName(m)}股票</small></td><td>${fmt(avail,6)}</td><td>${fmt(frozen,6)}</td><td>${fmt(total*p)} USDT</td></tr>`}).join('');
  if(rows)body.insertAdjacentHTML('beforeend',rows);return out;
};
const inheritedRenderAssetPage=renderAssetPage;
renderAssetPage=function(){
  const out=inheritedRenderAssetPage.apply(this,arguments);if(!user||assetTab!=='spot')return out;
  const box=$('assetPageBody')?.querySelector('.asset-detail'),w=spotWallet();if(!box)return out;
  box.querySelectorAll('.gb18-stock-asset-row').forEach(x=>x.remove());
  for(const m of stockMetas()){
    const q=+w.coins?.[m.ticker]||0;if(q<=0)continue;const p=spotReference(m.symbol),row=document.createElement('div');row.className='asset-list-row gb18-stock-asset-row';row.innerHTML=`<span>${m.ticker}<small>${companyName(m)}股票</small></span><span>${fmt(q,6)}</span><span>${fmt(q*p)} USDT</span>`;box.appendChild(row)
  }
  return out;
};

const inheritedSetSymbol=setSymbol;
setSymbol=async function(sym){
  const restore=requestedTradingMode&&isStock(sym)?requestedTradingMode:null;
  const out=await inheritedSetSymbol.apply(this,arguments);
  if(restore){tradingMode=restore;renderTradingMode()}
  patchCompanyNames();ensureStockWalletShape();syncPairHeader();scheduleDecorate();return out;
};
const inheritedShowPage=showPage;
showPage=function(page){const out=inheritedShowPage.apply(this,arguments);syncPairHeader();scheduleDecorate();return out};
const inheritedRenderTradingMode=renderTradingMode;
renderTradingMode=function(){const out=inheritedRenderTradingMode.apply(this,arguments);syncPairHeader();return out};

function withContractPrice(fn){
  if(tradingMode!=='futures'||!supportsPerpBasis(symbol))return fn();
  const old=price,p=contractPriceFor(symbol);if(p)price=p;try{return fn()}finally{price=old}
}
const inheritedPlaceOrder=placeOrder;
placeOrder=function(side){return withContractPrice(()=>inheritedPlaceOrder.call(this,side))};
const inheritedMatchOrders=matchOrders;
matchOrders=function(){return withContractPrice(()=>inheritedMatchOrders.apply(this,arguments))};
const inheritedCheckRisk=checkRisk;
checkRisk=function(){return withContractPrice(()=>inheritedCheckRisk.apply(this,arguments))};
const inheritedClosePosition=closePosition;
closePosition=function(id,reason='手动平仓',fill,fraction=1){
  const p=positions.find(x=>x.id===id);if(fill==null&&p&&supportsPerpBasis(p.symbol))fill=contractPriceFor(p.symbol)||spotReference(p.symbol);return inheritedClosePosition.call(this,id,reason,fill,fraction)
};
const inheritedPnlOf=pnlOf;
pnlOf=function(p,mark){if(p&&supportsPerpBasis(p.symbol)){const m=mark==null?contractPriceFor(p.symbol):mark;return(m-p.entry)*p.qty*(p.side==='long'?1:-1)}return inheritedPnlOf.apply(this,arguments)};
const inheritedUpdatePreview=updatePreview;
updatePreview=function(){return withContractPrice(()=>{const out=inheritedUpdatePreview.apply(this,arguments);updateFeeMetric();return out})};
const inheritedRenderBook=renderBook;
renderBook=function(){return withContractPrice(()=>inheritedRenderBook.apply(this,arguments))};

const inheritedRenderFuturesTable=renderFuturesTable;
renderFuturesTable=function(){
  if(tableMode!=='positions')return inheritedRenderFuturesTable.apply(this,arguments);
  $('positionFilters').classList.remove('hidden');
  const rows=positions.filter(p=>posFilter==='all'||p.mode===posFilter).map(p=>{const mark=supportsPerpBasis(p.symbol)?contractPriceFor(p.symbol):markFor(p.symbol),pnl=pnlOf(p,mark);return{...p,mark,pnl,roe:p.margin?pnl/p.margin*100:0}});
  $('thead').innerHTML='<tr><th>合约</th><th>方向</th><th>模式</th><th>杠杆</th><th>开仓价</th><th>合约标记价</th><th>保证金</th><th>未实现盈亏</th><th>ROE</th><th>强平价</th><th>操作</th></tr>';
  $('tbody').innerHTML=rows.length?rows.map(r=>`<tr><td>${String(r.symbol).replace('/','')}永续合约</td><td class="${r.side==='long'?'green':'red'}">${r.side==='long'?'多':'空'}</td><td>${r.mode==='cross'?'全仓':'逐仓'}</td><td>${r.leverage}X</td><td>${fmt(r.entry,configs[r.symbol]?.dec??2)}</td><td>${fmt(r.mark,configs[r.symbol]?.dec??2)}</td><td>${fmt(r.margin)}</td><td class="${r.pnl>=0?'green':'red'}">${r.pnl>=0?'+':''}${fmt(r.pnl)}</td><td class="${r.roe>=0?'green':'red'}">${r.roe.toFixed(2)}%</td><td>${fmt(r.liq||0,configs[r.symbol]?.dec??2)}</td><td><button class="reducepos" data-reduce="${r.id}">减仓50%</button><button class="closepos" data-closepos="${r.id}">全平</button></td></tr>`).join(''):'<tr><td colspan="11" class="empty">暂无持仓</td></tr>';
};

const inheritedDraw=draw;
draw=function(){
  if(tradingMode!=='futures'||!supportsPerpBasis(symbol))return inheritedDraw.apply(this,arguments);
  const factor=1+touchBasis(symbol),savedPrice=price,savedCandles=candles,savedCurrent=current,savedSnap=marketSnapshots[symbol];
  const scale=c=>c?{...c,o:c.o*factor,h:c.h*factor,l:c.l*factor,c:c.c*factor}:c;
  try{
    candles=savedCandles.map(scale);current=scale(savedCurrent);price=contractPriceFor(symbol)||savedPrice;
    if(savedSnap)marketSnapshots[symbol]={...savedSnap,last:price,high:(+savedSnap.high||spotReference(symbol))*factor,low:(+savedSnap.low||spotReference(symbol))*factor};
    return inheritedDraw.apply(this,arguments)
  }finally{price=savedPrice;candles=savedCandles;current=savedCurrent;if(savedSnap)marketSnapshots[symbol]=savedSnap}
};

const inheritedStats=stats;
stats=function(){
  const out=inheritedStats.apply(this,arguments);
  if(tradingMode==='futures'&&supportsPerpBasis(symbol)){
    const p=contractPriceFor(symbol),factor=spotReference(symbol)?p/spotReference(symbol):1,s=marketSnapshots[symbol]||{};
    if(p){$('lastPrice').textContent=fmt(p,cfg.dec);$('midPrice').textContent=fmt(p,cfg.dec)}
    if(s.high)$('high24').textContent=fmt(+s.high*factor,cfg.dec);if(s.low)$('low24').textContent=fmt(+s.low*factor,cfg.dec);
  }
  syncPairHeader();scheduleDecorate();return out;
};

const inheritedSettleFunding=settleFunding;
settleFunding=function(){
  const n=Date.now()/1000;if(n<nextFunding)return;
  let net=0;
  for(const p of positions){
    const rate=supportsPerpBasis(p.symbol)?fundingFor(p.symbol):fundingRate,mark=supportsPerpBasis(p.symbol)?contractPriceFor(p.symbol):markFor(p.symbol),pay=p.qty*mark*rate*(p.side==='long'?-1:1);
    futuresWallet().usdt=Math.max(0,futuresWallet().usdt+pay);net+=pay;addLedger('资金费率',pay,p.symbol,`${rate>=0?'+':''}${(rate*100).toFixed(4)}% · ${rate>0?'多付空收':rate<0?'空付多收':'无费用'}`,'futures')
  }
  if(net>=0)accountStats.fundingReceived+=net;else accountStats.fundingPaid+=Math.abs(net);
  nextFunding=Math.floor(n/FUNDING_INTERVAL+1)*FUNDING_INTERVAL;
  if(positions.length)notify('资金费率已结算',`${net>=0?'+':''}${fmt(net)} USDT`,net>=0?'success':'warning');saveState();
};
const inheritedFundingUi=updateFundingUI;
updateFundingUI=function(){
  if(tradingMode!=='futures'||!supportsPerpBasis(symbol))return inheritedFundingUi.apply(this,arguments);
  const rate=fundingFor(symbol);fundingRate=rate;
  const r=Math.max(0,Math.ceil(nextFunding-Date.now()/1000)),h=Math.floor(r/3600),m=Math.floor((r%3600)/60),s=r%60,el=$('fundingRate');
  if(el){el.textContent=`${rate>0?'+':''}${(rate*100).toFixed(4)}%`;el.classList.remove('gb18-funding-positive','gb18-funding-negative');if(rate>0)el.classList.add('gb18-funding-positive');if(rate<0)el.classList.add('gb18-funding-negative')}
  $('fundingCountdown').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

function updateFeeMetric(){
  const spans=[...document.querySelectorAll('#futuresPanel .metric-grid span')],label=spans.find(x=>x.textContent.trim()==='开仓手续费');if(!label)return;
  const value=label.nextElementSibling,rate=orderType==='limit'?(V?.MAKER_RATE??.0002):(V?.TAKER_RATE??.0006),liquidity=orderType==='limit'?'Maker':'Taker';
  label.classList.add('gb-term-tip');label.tabIndex=0;label.dataset.termTip='普通费率：Maker 0.020%，Taker 0.060%。现货账户持有足够 GREED 时自动使用 GREED 抵扣，Maker 0.001%，Taker 0.002%。市价开仓按 Taker，正常挂入盘口成交的限价开仓按 Maker。';
  if(value)value.textContent=`${(rate*100).toFixed(3)}% ${liquidity}`;
}
function installFeeCleanup(){
  $('feeStripFutures')?.setAttribute('aria-hidden','true');$('feeStripSpot')?.setAttribute('aria-hidden','true');updateFeeMetric();
  document.querySelectorAll('.order-type').forEach(b=>b.addEventListener('click',()=>setTimeout(updateFeeMetric,0)));
}

function updateRangeVisual(input){
  if(!input)return;const min=+input.min||0,max=+input.max||100,val=+input.value||0,p=max>min?(val-min)/(max-min)*100:0;input.style.setProperty('--gb18-range-pct',`${Math.max(0,Math.min(100,p))}%`);
  const dots=input.id==='spotPct'?$('spotPctDots'):input.id==='pct'?$('pctDots'):null;
  dots?.querySelectorAll('[data-pct]').forEach(b=>b.classList.toggle('passed',+b.dataset.pct<=val));
}
function installRangePolish(){
  for(const id of ['pct','spotPct','levRange']){const input=$(id);if(!input)continue;updateRangeVisual(input);input.addEventListener('input',()=>updateRangeVisual(input));input.addEventListener('change',()=>updateRangeVisual(input))}
  $('pctDots')?.addEventListener('click',()=>setTimeout(()=>updateRangeVisual($('pct')),0));$('spotPctDots')?.addEventListener('click',()=>setTimeout(()=>updateRangeVisual($('spotPct')),0));
  const baseOpenLeverage=openLeverage;openLeverage=function(){const out=baseOpenLeverage.apply(this,arguments);updateRangeVisual($('levRange'));return out};
}

function bootWhenReady(){
  if(!window.GreedBitV17||!window.GreedBitV17.STOCKS?.length){setTimeout(bootWhenReady,80);return}
  installStyle();patchCompanyNames();ensureStockWalletShape();installChevrons();installPickerFixes();installFeeCleanup();installRangePolish();updateVersion();syncPairHeader();
  setInterval(()=>{touchBasis(symbol);for(const p of positions)touchBasis(p.symbol);syncPairHeader();if(!$('coinPicker')?.classList.contains('hidden'))scheduleDecorate()},900);
  window.GreedBitV18={VERSION,contractPriceFor,fundingFor,spotReference,basisPct,get stockPickerMode(){return stockPickerMode}};
  stats();draw();renderTable();updateAssets();scheduleDecorate();
}
bootWhenReady();
})();
