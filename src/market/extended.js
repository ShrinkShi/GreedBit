/* Extended crypto and commodity markets. */
(function(){
'use strict';
const V=window.GreedBitV13;if(!V)throw new Error('market/model.js must load before market/extended.js');
const FAV_KEY='greedbit_pair_favorites_v14';
let pickerMode='favorites',commodityPoll=0,lastCommodityRefresh=0;
const NEW_CRYPTOS=[
  {ticker:'AAVE',name:'Aave',api:'AAVEUSDT',iconPath:'assets/bitcoinicon/aave.png',dec:2,color:'#6b70ff'},
  {ticker:'ADA',name:'Cardano',api:'ADAUSDT',iconPath:'assets/bitcoinicon/ada.png',dec:5,color:'#2a71d0'},
  {ticker:'ATOM',name:'Cosmos',api:'ATOMUSDT',iconPath:'assets/bitcoinicon/atom.png',dec:3,color:'#6f73a8'},
  {ticker:'BCH',name:'Bitcoin Cash',api:'BCHUSDT',iconPath:'assets/bitcoinicon/bch.png',dec:2,color:'#58b978'},
  {ticker:'DOT',name:'Polkadot',api:'DOTUSDT',iconPath:'assets/bitcoinicon/dot.png',dec:4,color:'#e6007a'},
  {ticker:'ETC',name:'Ethereum Classic',api:'ETCUSDT',iconPath:'assets/bitcoinicon/etc.png',dec:3,color:'#37b86d'},
  {ticker:'ICP',name:'Internet Computer',api:'ICPUSDT',iconPath:'assets/bitcoinicon/icp.png',dec:3,color:'#f05fa6'},
  {ticker:'LINK',name:'Chainlink',api:'LINKUSDT',iconPath:'assets/bitcoinicon/link.png',dec:3,color:'#315bd7'},
  {ticker:'PEPE',name:'Pepe',api:'PEPEUSDT',iconPath:'assets/bitcoinicon/pepe.png',dec:8,color:'#5fae53'},
  {ticker:'SHIB',name:'Shiba Inu',api:'SHIBUSDT',iconPath:'assets/bitcoinicon/shib.png',dec:8,color:'#f08537'},
  {ticker:'SUI',name:'Sui',api:'SUIUSDT',iconPath:'assets/bitcoinicon/sui.png',dec:4,color:'#6db9ef'},
  {ticker:'TRUMP',name:'Official Trump',api:'TRUMPUSDT',iconPath:'assets/bitcoinicon/trump.png',dec:3,color:'#d39c50'},
  {ticker:'UNI',name:'Uniswap',api:'UNIUSDT',iconPath:'assets/bitcoinicon/uni.png',dec:3,color:'#ff55aa'},
  {ticker:'WIF',name:'dogwifhat',api:'WIFUSDT',iconPath:'assets/bitcoinicon/wif.png',dec:4,color:'#c7a07c'},
  {ticker:'XRP',name:'XRP',api:'XRPUSDT',iconPath:'assets/bitcoinicon/xrp.png',dec:5,color:'#8d98a8'},
  {ticker:'BEAT',name:'BEAT',api:'BEATUSDT',iconPath:'assets/bitcoinicon/beat.png',dec:5,color:'#8f7cff',flex:true,anchor:1},
  {ticker:'LAB',name:'LAB',api:'LABUSDT',iconPath:'assets/bitcoinicon/lab.png',dec:5,color:'#60a9d8',flex:true,anchor:1},
  {ticker:'币安人生',name:'币安人生',api:'BINANCELIFEUSDT',iconPath:'assets/bitcoinicon/币安人生.png',dec:5,color:'#f0b90b',flex:true,anchor:1}
].map(a=>({...a,symbol:`${a.ticker}/USDT`,market:a.flex?'flex':'binance',vol:a.flex?.003:.001}));
const COMMODITIES=[
  {ticker:'XAU',symbol:'XAU/USDT',name:'黄金',yahoo:'GC=F',iconPath:'assets/bitcoinicon/xau.png',dec:2,color:'#d7aa36',desc:'以 COMEX 黄金期货公开行情作为参考价格，GreedBit 内部以 USDT 计价进行模拟交易。'},
  {ticker:'XAG',symbol:'XAG/USDT',name:'白银',yahoo:'SI=F',iconPath:'assets/bitcoinicon/xag.png',dec:3,color:'#b9c1ce',desc:'以 COMEX 白银期货公开行情作为参考价格，GreedBit 内部以 USDT 计价进行模拟交易。'},
  {ticker:'XPT',symbol:'XPT/USDT',name:'铂金',yahoo:'PL=F',iconPath:'assets/bitcoinicon/xpt.png',dec:2,color:'#aab4c0',desc:'以 NYMEX 铂金期货公开行情作为参考价格。'},
  {ticker:'XPD',symbol:'XPD/USDT',name:'钯金',yahoo:'PA=F',iconPath:'assets/bitcoinicon/xpd.png',dec:2,color:'#bbc6d2',desc:'以 NYMEX 钯金期货公开行情作为参考价格。'},
  {ticker:'COPPER',symbol:'COPPER/USDT',name:'铜',yahoo:'HG=F',iconPath:'assets/bitcoinicon/copper.png',dec:4,color:'#b46c42',desc:'以 COMEX 铜期货公开行情作为参考价格。'},
  {ticker:'USOIL',symbol:'USOIL/USDT',name:'WTI 原油',yahoo:'CL=F',iconPath:'assets/bitcoinicon/usoil.png',dec:3,color:'#6d7886',desc:'以 NYMEX WTI 原油期货公开行情作为参考价格。'},
  {ticker:'BRENTOIL',symbol:'BRENTOIL/USDT',name:'布伦特原油',yahoo:'BZ=F',iconPath:'assets/bitcoinicon/brentoil.png',dec:3,color:'#7b6f62',desc:'以 ICE 布伦特原油期货公开行情作为参考价格。'},
  {ticker:'NATGAS',symbol:'NATGAS/USDT',name:'天然气',yahoo:'NG=F',iconPath:'assets/bitcoinicon/natgas.png',dec:4,color:'#5e95d0',desc:'以 NYMEX 天然气期货公开行情作为参考价格。'}
].map(a=>({...a,market:'commodity',category:'commodity',vol:.0015}));
const COMMODITY_MAP=Object.fromEntries(COMMODITIES.map(x=>[x.symbol,x]));
const PROFILE={BTC:'比特币是最早形成规模化市场的去中心化加密资产，采用工作量证明并具有固定供应上限。',ETH:'以太坊是支持智能合约和去中心化应用的可编程区块链网络。',SOL:'Solana 是面向高吞吐应用的公链生态。',DOGE:'Dogecoin 是历史较早、社区属性明显的加密资产。',BNB:'BNB 是 BNB Chain 与 Binance 生态中的核心资产。',FIL:'Filecoin 聚焦去中心化存储市场。',TRX:'TRON 是支持智能合约与稳定币流通的公链网络。',ZEC:'Zcash 是强调隐私技术的加密资产。',AAVE:'Aave 是去中心化借贷协议的治理与生态资产。',ADA:'Cardano 是采用权益证明机制的公链生态。',ATOM:'ATOM 是 Cosmos Hub 的核心资产。',BCH:'Bitcoin Cash 是从比特币协议分叉形成的支付型加密资产。',DOT:'DOT 是 Polkadot 多链生态的核心资产。',ETC:'Ethereum Classic 延续以太坊早期链历史并采用工作量证明。',ICP:'ICP 是 Internet Computer 网络的核心资产。',LINK:'LINK 是 Chainlink 去中心化预言机网络的核心资产。',PEPE:'PEPE 属于高波动 Meme 类加密资产。',SHIB:'SHIB 是以社区与 Meme 文化为核心的加密资产。',SUI:'SUI 是 Sui 高性能公链生态的核心资产。',TRUMP:'TRUMP 属于高波动 Meme 类加密资产。',UNI:'UNI 是 Uniswap 去中心化交易协议的治理资产。',WIF:'WIF 属于高波动 Meme 类加密资产。',XRP:'XRP 是 XRP Ledger 网络中的原生资产。',GREED:'GREED（贪婪）是 GreedBit 原创平台币，不真实上链，价格由 BTC/ETH、随机波动和平台模拟新闻共同驱动。'};

function installStyle(){if(document.querySelector('link[href="styles/v016.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v016.css';document.head.appendChild(l)}
function registerMarkets(){
  for(const a of NEW_CRYPTOS){if(!V.META[a.symbol]){V.ASSETS.push(a);V.META[a.symbol]=a;V.BY_TICKER[a.ticker]=a;if(!coinKeys.includes(a.ticker))coinKeys.push(a.ticker);configs[a.symbol]={anchor:a.anchor||0,vol:a.vol,dec:a.dec,icon:a.ticker[0],color:a.color,iconPath:a.iconPath,api:a.api,market:a.market,name:a.name};marketSnapshots[a.symbol]={last:a.anchor||0,change:0,high:a.anchor||0,low:a.anchor||0,quoteVolume:0,_source:'等待行情'}}}
  for(const a of COMMODITIES){V.META[a.symbol]=a;configs[a.symbol]={anchor:0,vol:a.vol,dec:a.dec,icon:a.ticker[0],color:a.color,iconPath:a.iconPath,api:null,market:'commodity',name:a.name};if(!marketSnapshots[a.symbol])marketSnapshots[a.symbol]={last:0,change:0,high:0,low:0,quoteVolume:0,_source:'等待 Yahoo Finance 行情'}}
  V.ensureWalletShape?.(wallets);
  const sel=$('symbol');if(sel){const have=new Set([...sel.options].map(o=>o.value));[...V.ASSETS,...COMMODITIES].forEach(a=>{if(!have.has(a.symbol)){const o=document.createElement('option');o.value=a.symbol;o.textContent=a.symbol;sel.appendChild(o)}})}
}
function readFav(){try{return new Set(JSON.parse(localStorage.getItem(FAV_KEY)||'[]'))}catch{return new Set()}}
function saveFav(s){localStorage.setItem(FAV_KEY,JSON.stringify([...s]))}
function favId(m,s){return`${m}|${s}`}
function toggleFav(m,s){const f=readFav(),id=favId(m,s);f.has(id)?f.delete(id):f.add(id);saveFav(f)}
function searchOk(a){const q=($('coinSearch')?.value||'').trim().toUpperCase();return !q||(a.symbol+' '+a.ticker+' '+a.name).toUpperCase().includes(q)}
function pickerRows(){
  if(pickerMode==='forex'||pickerMode==='stocks')return[];
  if(pickerMode==='commodities')return COMMODITIES.filter(searchOk).map(a=>({a,market:'commodity'}));
  if(pickerMode==='futures')return V.ASSETS.filter(searchOk).map(a=>({a,market:'futures'}));
  if(pickerMode==='spot')return V.ASSETS.filter(searchOk).map(a=>({a,market:'spot'}));
  const fav=readFav(),rows=[];for(const a of V.ASSETS){for(const m of ['futures','spot'])if(fav.has(favId(m,a.symbol)))rows.push({a,market:m})}for(const a of COMMODITIES)if(fav.has(favId('commodity',a.symbol)))rows.push({a,market:'commodity'});return rows.filter(x=>searchOk(x.a));
}
function renderTabs(){const tabs=document.querySelector('.coin-tabs');if(!tabs)return;const labels=[['favorites','自选'],['futures','永续合约'],['spot','现货'],['commodities','大宗商品'],['forex','外汇'],['stocks','股票']];tabs.innerHTML=labels.map(([k,n])=>`<button data-v16-picker="${k}" class="${pickerMode===k?'active':''}">${n}</button>`).join('')+`<span class="coin-picker-mode-note-v14">${pickerMode==='favorites'?'收藏的交易':'点击 ☆ 收藏'}</span>`}
renderCoinList=function(){
  const box=$('coinList');if(!box)return;renderTabs();const head=document.querySelector('.coin-list-head');if(head?.children?.[0])head.children[0].textContent=pickerMode==='spot'?'币种':pickerMode==='commodities'?'大宗商品':pickerMode==='favorites'?'自选交易':'合约';
  const rows=pickerRows(),fav=readFav();if(!rows.length){box.innerHTML='<div class="coin-picker-empty-v14"><b>暂无匹配结果</b>可切换分类或清空搜索条件。</div>';return}
  box.innerHTML=rows.map(({a,market})=>{const m=marketSnapshots[a.symbol]||{},last=+m.last||0,ch=+m.change||0,id=favId(market,a.symbol),on=fav.has(id),spot=market==='spot',commodity=market==='commodity',title=spot?a.ticker:a.symbol,sub=commodity?`${a.name} · 大宗商品参考合约`:spot?a.name:`${a.name} · 永续`,active=a.symbol===symbol&&((spot&&tradingMode==='spot')||(!spot&&tradingMode==='futures'));
    return`<div class="coin-row ${active?'active':''}" data-symbol="${a.symbol}" data-market="${market}" tabindex="0"><div class="coin-name-v14"><button class="coin-star-v14 ${on?'on':''}" data-v16-fav="1" data-fav-symbol="${a.symbol}" data-fav-market="${market}" title="${on?'取消收藏':'加入自选'}">${on?'★':'☆'}</button><div class="coin-main-v14"><img class="coin-icon-img" src="${a.iconPath}" alt="${a.ticker}"/><span class="coin-text-v14"><b>${title}${!spot?`<em class="coin-market-badge-v14">${commodity?'商品':'永续'}</em>`:''}</b><small>${sub}</small></span></div></div><span>${last?fmt(last,a.dec):'--'}</span><span class="${ch>0?'green':ch<0?'red':'muted'}">${last?(ch>=0?'+':'')+ch.toFixed(2)+'%':'--'}</span></div>`}).join('')
};
function installPicker(){const tabs=document.querySelector('.coin-tabs'),list=$('coinList');if(!tabs||!list)return;tabs.onclick=e=>{const b=e.target.closest('[data-v16-picker]');if(!b)return;pickerMode=b.dataset.v16Picker;renderCoinList()};list.onclick=async e=>{const star=e.target.closest('[data-v16-fav]');if(star){e.preventDefault();e.stopPropagation();toggleFav(star.dataset.favMarket,star.dataset.favSymbol);renderCoinList();return}const row=e.target.closest('[data-symbol][data-market]');if(!row)return;const market=row.dataset.market;if(market==='commodity')tradingMode='futures';await setSymbol(row.dataset.symbol);showPage(market==='spot'?'trade':'futures');$('coinPicker')?.classList.add('hidden')};list.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('coin-row')){e.preventDefault();e.target.click()}};if($('coinSearch'))$('coinSearch').oninput=renderCoinList;renderCoinList()}

async function fetchYahoo(meta,interval='5m',range='5d'){
  const target=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(meta.yahoo)}?interval=${interval}&range=${range}&includePrePost=false&events=div%2Csplits`;
  const urls=[`https://proxy.cors.dev/${target}`,`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`];let err;
  for(const url of urls){try{const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);const r=await fetch(url,{cache:'no-store',signal:c.signal,credentials:'omit'});clearTimeout(t);if(!r.ok)throw new Error(`HTTP ${r.status}`);const j=await r.json(),res=j?.chart?.result?.[0];if(!res)throw new Error('Yahoo empty');return res}catch(e){err=e}}
  throw err||new Error('Yahoo unavailable')
}
function yahooPlan(info){if(info.calendarMonth)return{interval:'1d',range:'5y'};if(info.sec<=180)return{interval:'1m',range:'5d'};if(info.sec<=900)return{interval:'5m',range:'1mo'};if(info.sec<=1800)return{interval:'15m',range:'1mo'};if(info.sec<=28800)return{interval:'60m',range:'6mo'};return{interval:'1d',range:'5y'}}
function yahooBars(res,info){const q=res?.indicators?.quote?.[0]||{},ts=res?.timestamp||[],raw=[];for(let i=0;i<ts.length;i++){const o=+q.open?.[i],h=+q.high?.[i],l=+q.low?.[i],c=+q.close?.[i],v=+q.volume?.[i]||0;if([o,h,l,c].every(Number.isFinite))raw.push({t:+ts[i],o,h,l,c,v})}if(!raw.length)return[];const out=[];let g=null;for(const c of raw){let start;if(info.calendarMonth){const d=new Date(c.t*1000);start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/1000}else start=Math.floor(c.t/info.sec)*info.sec;if(!g||g.t!==start){if(g)out.push(g);g={t:start,end:info.calendarMonth?bucketEnd(start,info):start+info.sec,o:c.o,h:c.h,l:c.l,c:c.c,v:c.v,live:false}}else{g.h=Math.max(g.h,c.h);g.l=Math.min(g.l,c.l);g.c=c.c;g.v+=c.v}}if(g)out.push(g);return out}
async function refreshCommodity(a,paint=false){const res=await fetchYahoo(a,'5m','5d'),meta=res.meta||{},bars=yahooBars(res,{sec:300,calendarMonth:false}),last=+(meta.regularMarketPrice||bars.at(-1)?.c||0),prev=+(meta.chartPreviousClose||meta.previousClose||bars.at(-2)?.c||last),hi=+(meta.regularMarketDayHigh||Math.max(...bars.slice(-96).map(x=>x.h))),lo=+(meta.regularMarketDayLow||Math.min(...bars.slice(-96).map(x=>x.l))),vol=bars.slice(-96).reduce((s,x)=>s+(x.v||0),0);if(!last)throw new Error('no price');marketSnapshots[a.symbol]={last,change:prev?(last/prev-1)*100:0,high:hi||last,low:lo||last,quoteVolume:vol*last,_source:'Yahoo Finance 期货参考行情'};if(symbol===a.symbol){price=last;latestTicker=marketSnapshots[a.symbol];if(paint){stats();draw();renderBook()}}return marketSnapshots[a.symbol]}
function fallbackFlex(a){const old=marketSnapshots[a.symbol]||{},btc=+(marketSnapshots['BTC/USDT']?.change||0),eth=+(marketSnapshots['ETH/USDT']?.change||0),last=+old.last||a.anchor||1,step=(btc*.55+eth*.45)/100000+(Math.random()-.5)*.0015,next=Math.max(1e-8,last*(1+step));marketSnapshots[a.symbol]={last:next,change:(+old.change||0)+step*100,high:Math.max(+old.high||next,next),low:Math.min(+old.low||next,next),quoteVolume:(+old.quoteVolume||0)+Math.abs(step)*next*100000,_source:'参考模拟行情'};configs[a.symbol]._v13Fallback=true}
async function refreshExtraCrypto(a){try{const d=await fetchBinance(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(a.api)}`);marketSnapshots[a.symbol]={last:+d.lastPrice,change:+d.priceChangePercent||0,high:+d.highPrice||+d.lastPrice,low:+d.lowPrice||+d.lastPrice,quoteVolume:+d.quoteVolume||0,_source:'Binance'};configs[a.symbol]._v13Fallback=false}catch{if(a.flex)fallbackFlex(a);else marketSnapshots[a.symbol]._source='行情暂不可用'}}
const inheritedUpdateSnapshots=updateMarketSnapshots;
updateMarketSnapshots=async function(){await inheritedUpdateSnapshots.apply(this,arguments);await Promise.allSettled(NEW_CRYPTOS.map(refreshExtraCrypto));if(Date.now()-lastCommodityRefresh>30000){lastCommodityRefresh=Date.now();await Promise.allSettled(COMMODITIES.map(a=>refreshCommodity(a,false)))}renderCoinList();if(symbol&&configs[symbol]&&(currentPage==='trade'||currentPage==='futures')){const s=marketSnapshots[symbol];if(s?.last){price=s.last;stats();draw()}}};

const inheritedLoadHistory=loadHistoricalMarket;
loadHistoricalMarket=async function(resetView=true){const a=COMMODITY_MAP[symbol];if(!a)return inheritedLoadHistory.apply(this,arguments);closeMarketSocket();setMarketStatus('connecting',`${a.name} · 正在加载公开参考行情…`);try{const info=tfInfo(),plan=yahooPlan(info),res=await fetchYahoo(a,plan.interval,plan.range),bars=yahooBars(res,info);if(!bars.length)throw new Error('empty commodity history');current=null;candles=bars.slice(0,-1);const last={...bars.at(-1),live:true};current=last;price=last.c;marketSnapshots[symbol].last=price;if(resetView){visibleCount=72;viewShift=0;yZoom=1;yPan=0;hoverIndex=-1}await refreshCommodity(a,false);connectMarketSocket();renderBook();stats();draw();renderCoinList();setMarketStatus('live',`${a.name} · Yahoo Finance 期货参考行情`)}catch(e){console.warn('commodity history failed',e);setMarketStatus('error',`${a.name} 行情连接失败`);candles=[];current=null;draw();notify('大宗商品行情暂不可用',`${a.name} 暂时无法从公开源取得数据。`,'error',5000)}};
const inheritedCloseSocket=closeMarketSocket;
closeMarketSocket=function(clearRetry=true){if(commodityPoll){clearInterval(commodityPoll);commodityPoll=0}return inheritedCloseSocket(clearRetry)};
const inheritedConnect=connectMarketSocket;
connectMarketSocket=function(hostIndex=0){const a=COMMODITY_MAP[symbol];if(!a)return inheritedConnect.apply(this,arguments);inheritedCloseSocket(false);if(commodityPoll)clearInterval(commodityPoll);setMarketStatus('live',`${a.name} · Yahoo Finance 轮询行情`);commodityPoll=setInterval(()=>{if(symbol!==a.symbol)return;refreshCommodity(a,true).catch(()=>{})},12000)};
const inheritedRenderBook=renderBook;
renderBook=async function(){const a=COMMODITY_MAP[symbol];if(!a)return inheritedRenderBook.apply(this,arguments);const p=price||marketSnapshots[symbol]?.last||0;if(!p)return;const spread=Math.max(p*.00018,Math.pow(10,-cfg.dec)),n=9;let ac=0,bc=0;const asks=[],bids=[];for(let i=n;i>=1;i--){const q=(.4+Math.random()*1.2)*Math.max(.01,50/p);ac+=q;asks.push(`<div class="obrow"><i class="depth" style="width:${(n-i+1)/n*100}%;background:#ff6b78"></i><span class="red">${fmt(p+spread*i,cfg.dec)}</span><span>${fmt(q,4)}</span><span>${fmt(ac,4)}</span></div>`)}for(let i=1;i<=n;i++){const q=(.4+Math.random()*1.2)*Math.max(.01,50/p);bc+=q;bids.push(`<div class="obrow"><i class="depth" style="width:${i/n*100}%;background:#3dbb83"></i><span class="green">${fmt(Math.max(.000001,p-spread*i),cfg.dec)}</span><span>${fmt(q,4)}</span><span>${fmt(bc,4)}</span></div>`)}$('asks').innerHTML=asks.join('');$('bids').innerHTML=bids.join('');$('midPrice').textContent=fmt(p,cfg.dec)};

const inheritedSetSymbol=setSymbol;
setSymbol=async function(sym){if(COMMODITY_MAP[sym])tradingMode='futures';return inheritedSetSymbol.apply(this,arguments)};

function overviewDescription(a){return COMMODITY_MAP[a.symbol]?.desc||PROFILE[a.ticker]||'该资产已加入 GreedBit 模拟市场。项目基础资料尚未完整接入，为避免误导，不展示未经核验的发行量、排名或外部评分。'}
function renderOverview(){const a=V.META[symbol]||COMMODITY_MAP[symbol],s=marketSnapshots[symbol]||{};if(!a)return;const source=s._source||'公开市场行情',kind=a.market==='commodity'?'大宗商品参考合约':a.market==='greed'?'GreedBit 原创平台币':a.market==='flex'?(configs[symbol]?._v13Fallback?'参考模拟行情':'加密资产'):'加密资产';$('contractInfoPanel').innerHTML=`<div class="overview-subnav"><button class="active">基础信息</button><button>交易参数</button><button disabled>更多数据</button></div><div class="overview-grid overview-grid-v16"><section class="overview-main"><h2 class="overview-title-v16"><img src="${a.iconPath}" alt="${a.ticker}"/><span>${a.ticker}<small>${a.name}</small></span></h2><div class="overview-tags-v16"><span>${kind}</span><span>${source}</span></div><h3>资产资料</h3><p class="coin-intro">${overviewDescription(a)}</p><div class="kv-list"><div><span>最新价</span><b>${s.last?fmt(s.last,a.dec):'--'} USDT</b></div><div><span>24H 涨跌</span><b class="${(+s.change||0)>=0?'green':'red'}">${s.last?((+s.change||0)>=0?'+':'')+(+s.change||0).toFixed(2)+'%':'--'}</b></div><div><span>24H 高</span><b>${s.high?fmt(s.high,a.dec):'--'}</b></div><div><span>24H 低</span><b>${s.low?fmt(s.low,a.dec):'--'}</b></div><div><span>24H 成交额/参考额</span><b>${s.quoteVolume?fmt(s.quoteVolume,0)+' USDT':'--'}</b></div><div><span>GreedBit 市场</span><b>${a.market==='commodity'?'大宗商品 / 永续模拟':a.market==='greed'?'现货 + 永续模拟':'现货 + 永续模拟'}</b></div></div></section><aside class="overview-side"><h3>数据说明</h3><div class="score-card"><span>行情来源</span><b>${source}</b><small>${a.market==='commodity'?'外部期货价格仅作为 GreedBit USDT 模拟合约的参考基准。':'真实行情与本地模拟交易严格分离。'}</small></div><h3>图标</h3><div class="overview-icon-card-v16"><img src="${a.iconPath}" alt="${a.ticker}"/><span>${a.name}</span></div></aside></div>`}
function showInfoPanel(mode){const tabs=[...document.querySelectorAll('.charttabs span')],info=$('contractInfoPanel'),timebar=$('timebar'),wrap=$('chartwrap'),layout=$('layout');tabs.forEach(x=>x.classList.toggle('active',x.dataset.contracttab===mode));if(mode==='chart'){timebar.classList.remove('hidden');wrap.classList.remove('hidden');info.classList.add('hidden');layout.classList.remove('contract-info-mode');setTimeout(resize,0);return}timebar.classList.add('hidden');wrap.classList.add('hidden');info.classList.remove('hidden');layout.classList.add('contract-info-mode');if(mode==='overview')renderOverview();else info.innerHTML='<div class="v16-data-placeholder"><b>该品种的数据模块正在扩展</b><span>本页不展示未经核验或不适用于该品种的衍生统计数据。</span></div>'}
function installOverview(){const tabs=[...document.querySelectorAll('.charttabs span')];tabs.forEach((x,i)=>{const mode=x.dataset.contracttab||['chart','overview','data'][i];x.dataset.contracttab=mode;const old=x.onclick;x.onclick=()=>{if(mode==='overview'||(mode==='data'&&symbol!=='BTC/USDT'&&symbol!=='ETH/USDT'))showInfoPanel(mode);else old?.()}})}

const oldFill=playFillSound,fillPool=Array.from({length:3},()=>{const a=new Audio('assets/voice/%E6%94%B6%E9%93%B6%E6%9C%BA%E9%9F%B3%E6%95%88.wav');a.preload='auto';a.volume=.62;return a});let fillIndex=0;
playFillSound=function(){const a=fillPool[fillIndex++%fillPool.length];try{a.pause();a.currentTime=0;const p=a.play();if(p?.catch)p.catch(()=>oldFill())}catch{oldFill()}};

function boot(){installStyle();registerMarkets();installPicker();installOverview();updateMarketSnapshots().catch(()=>{});window.GreedBitExtendedMarkets={NEW_CRYPTOS,COMMODITIES,COMMODITY_MAP,renderOverview}}
boot();
})();
