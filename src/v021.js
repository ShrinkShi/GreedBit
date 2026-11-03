/* final runtime stabilization (release v0.0.23) */
(function(){
'use strict';
const VERSION='0.0.23';
let finalized=false,activeInfoMode='chart',autoTranslateBusy=false,autoTranslateTimer=0;

function installStyle(done){
  let l=document.querySelector('link[href="styles/v021.css"]');
  if(l){if(l.sheet){done();return}l.addEventListener('load',done,{once:true});l.addEventListener('error',done,{once:true});return}
  l=document.createElement('link');l.rel='stylesheet';l.href='styles/v021.css';l.addEventListener('load',done,{once:true});l.addEventListener('error',done,{once:true});document.head.appendChild(l);
}
function currentSymbol(){try{if(typeof symbol==='string'&&symbol)return symbol}catch{}return document.getElementById('symbol')?.value||''}
function currentMode(){try{if(typeof tradingMode==='string'&&tradingMode)return tradingMode}catch{}return'futures'}
function marketMeta(sym){return window.GreedBitV13?.META?.[sym]||null}
function isZh(){return !String(document.documentElement.lang||'zh-CN').toLowerCase().startsWith('en')}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function safeUrl(v){try{const u=new URL(v);return/^https?:$/.test(u.protocol)?u.href:''}catch{return''}}
function fmtLocal(n,d=2){try{return typeof fmt==='function'?fmt(n,d):Number(n||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d})}catch{return String(n??'--')}}

function sourceLabel(){
  const sym=currentSymbol(),mode=currentMode(),m=marketMeta(sym),market=m?.market||m?.category||'';if(!sym)return'';
  if(mode==='futures'&&market!=='commodity'&&market!=='forex'){
    const basis=Number(window.GreedBitV18?.basisPct?.(sym));
    return isZh()?`永续合约模拟价格 · 基差 ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`:`Simulated perpetual price · basis ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`;
  }
  if(market==='stock'&&mode==='spot'){
    let src='';try{src=marketSnapshots?.[sym]?._source||''}catch{}
    return isZh()?`${m?.name||m?.ticker||sym}股票代币现货 · ${src||'参考行情'}`:`${m?.name||m?.ticker||sym} stock token spot · ${src||'reference market data'}`;
  }
  try{return marketSnapshots?.[sym]?._source||(isZh()?'公开市场行情':'Public market data')}catch{return isZh()?'公开市场行情':'Public market data'}
}
function installSourceLabelGuard(){
  const el=document.querySelector('#lastPrice + .muted.tiny')||document.getElementById('lastPrice')?.parentElement?.querySelector('.muted.tiny');
  if(!el||el.dataset.gb21Guard==='1')return;const native=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');if(!native?.get||!native?.set)return;el.dataset.gb21Guard='1';
  try{Object.defineProperty(el,'textContent',{configurable:true,get(){return native.get.call(this)},set(v){native.set.call(this,sourceLabel()||String(v??''))}})}catch{}
  native.set.call(el,sourceLabel());
}
function installFavicon(){
  document.querySelectorAll('link[rel~="icon"],link[rel="shortcut icon"]').forEach(x=>x.remove());const href='assets/greedbit-favicon.png?v=0023';
  const icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.sizes='64x64';icon.href=href;document.head.appendChild(icon);
  const shortcut=document.createElement('link');shortcut.rel='shortcut icon';shortcut.type='image/png';shortcut.href=href;document.head.appendChild(shortcut);
}
function updateVersion(){const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));if(el)el.textContent=`GreedBit v${VERSION}`}

/* Public market-data reliability. */
function installMarketReliability(){
  const REST_HOSTS=['https://data-api.binance.vision','https://api-gcp.binance.com','https://api1.binance.com','https://api2.binance.com','https://api3.binance.com','https://api4.binance.com','https://api.binance.com'];
  try{fetchBinance=async function(path){let lastErr;for(const host of REST_HOSTS){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),2800);try{const r=await fetch(host+path,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}catch(e){lastErr=e}finally{clearTimeout(timer)}}throw lastErr||new Error('公共行情接口不可用')}}catch(e){console.warn('unable to replace market REST fallback',e)}
  if(!window.__gbWsMarketPatch&&window.WebSocket){
    const NativeWS=window.WebSocket;let retryDepth=0;const WrappedWS=new Proxy(NativeWS,{construct(target,args){let url=String(args[0]||'');if(url.startsWith('wss://stream.binance.com:9443'))url=url.replace('wss://stream.binance.com:9443','wss://data-stream.binance.vision:443');const ws=Reflect.construct(target,[url,...args.slice(1)],target),watchdog=setTimeout(()=>{try{if(ws.readyState===NativeWS.CONNECTING)ws.close()}catch{}},5000);ws.addEventListener('open',()=>{clearTimeout(watchdog);retryDepth=0},{once:true});ws.addEventListener('close',()=>clearTimeout(watchdog),{once:true});return ws}});window.WebSocket=WrappedWS;window.__gbWsMarketPatch={NativeWS,WrappedWS};
    try{scheduleSocketReconnect=function(nextIndex){clearTimeout(marketSocketRetry);setMarketStatus('connecting',isZh()?'实时行情重连中…':'Reconnecting live market data…');const count=Math.max(1,typeof WS_HOSTS!=='undefined'?WS_HOSTS.length:2),delay=Math.min(6000,900*Math.pow(1.55,Math.min(retryDepth++,5)))+Math.floor(Math.random()*220);marketSocketRetry=setTimeout(()=>connectMarketSocket(nextIndex%count),delay)}}catch(e){console.warn('unable to replace websocket reconnect policy',e)}
  }
  try{const sym=currentSymbol(),meta=marketMeta(sym);if((currentPage==='trade'||currentPage==='futures')&&(meta?.market==='binance'||!meta)){closeMarketSocket();setMarketStatus('connecting',isZh()?'正在连接公共实时行情…':'Connecting public live market data…');setTimeout(()=>{try{connectMarketSocket(0)}catch{}},80);Promise.resolve(refreshTicker(sym)).then(()=>{try{stats();updateFooterTickers()}catch{}}).catch(()=>{});Promise.resolve(renderBook()).catch(()=>{})}}catch(e){console.warn('market reconnect refresh failed',e)}
}

/* ---------- asset details: one compact HTX-style renderer for every supported asset ---------- */
const CRYPTO_DETAILS={
 BTC:{site:'https://bitcoin.org/',siteLabel:'Bitcoin 社区资源',intro:'比特币是最早形成规模市场的去中心化加密资产，采用工作量证明并具有 2100 万枚供应上限。'},
 ETH:{site:'https://ethereum.org/',intro:'以太坊是支持智能合约与去中心化应用的可编程区块链网络。'},
 SOL:{site:'https://solana.com/',intro:'Solana 是面向高吞吐应用与链上资本市场的高性能区块链网络。'},
 DOGE:{site:'https://dogecoin.com/',intro:'Dogecoin 是历史较早、社区属性鲜明的点对点加密资产。'},
 BNB:{site:'https://www.bnbchain.org/',intro:'BNB 是 BNB Chain 生态中的核心资产，用于网络手续费及生态应用。'},
 FIL:{site:'https://filecoin.io/',intro:'Filecoin 是面向去中心化数据存储市场的开放网络。'},
 TRX:{site:'https://tron.network/',intro:'TRON 是支持智能合约、支付与稳定币流通的区块链网络。'},
 ZEC:{site:'https://z.cash/',intro:'Zcash 是强调零知识证明与隐私保护的数字现金协议。'},
 AAVE:{site:'https://aave.com/',intro:'AAVE 是 Aave 去中心化借贷协议的治理与生态资产。'},
 ADA:{site:'https://cardano.org/',intro:'Cardano 是采用权益证明机制的区块链平台。'},
 ATOM:{site:'https://cosmos.network/',intro:'ATOM 是 Cosmos Hub 的核心资产，Cosmos 聚焦区块链互操作。'},
 BCH:{site:'https://bitcoincash.org/',intro:'Bitcoin Cash 是由比特币协议分叉形成、聚焦点对点支付的加密资产。'},
 DOT:{site:'https://polkadot.com/',intro:'DOT 是 Polkadot 多链生态的核心资产。'},
 ETC:{site:'https://ethereumclassic.org/',intro:'Ethereum Classic 延续早期以太坊链历史并采用工作量证明。'},
 ICP:{site:'https://internetcomputer.org/',intro:'ICP 是 Internet Computer 网络的核心资产。'},
 LINK:{site:'https://chain.link/',intro:'LINK 是 Chainlink 去中心化预言机网络的核心资产。'},
 PEPE:{site:'https://www.pepe.vip/',intro:'PEPE 属于高波动 Meme 类加密资产。'},
 SHIB:{site:'https://shib.io/',intro:'SHIB 是以社区与 Meme 文化为核心的加密资产。'},
 SUI:{site:'https://sui.io/',intro:'SUI 是 Sui 高性能区块链网络的核心资产。'},
 TRUMP:{site:'https://gettrumpmemes.com/',intro:'TRUMP 属于高波动 Meme 类加密资产。'},
 UNI:{site:'https://uniswap.org/',intro:'UNI 是 Uniswap 去中心化交易协议的治理资产。'},
 XRP:{site:'https://xrpl.org/',intro:'XRP 是 XRP Ledger 网络的原生资产。'}
};
const STOCK_SITES={
 AAL:'https://www.aa.com/',AAOI:'https://www.ao-inc.com/',AAPL:'https://www.apple.com/',ABBV:'https://www.abbvie.com/',ACN:'https://www.accenture.com/',ADBE:'https://www.adobe.com/',ADI:'https://www.analog.com/',AEHR:'https://www.aehr.com/',AKAM:'https://www.akamai.com/',ALAB:'https://www.asteralabs.com/',AMAT:'https://www.appliedmaterials.com/',AMC:'https://www.amctheatres.com/',AMD:'https://www.amd.com/',AMZN:'https://www.amazon.com/',ANET:'https://www.arista.com/',APP:'https://www.applovin.com/',ARM:'https://www.arm.com/',ASML:'https://www.asml.com/',ASTS:'https://ast-science.com/',AVGO:'https://www.broadcom.com/',BA:'https://www.boeing.com/',BABA:'https://www.alibabagroup.com/',BAC:'https://www.bankofamerica.com/',BE:'https://www.bloomenergy.com/',BKNG:'https://www.bookingholdings.com/',BX:'https://www.blackstone.com/',CAT:'https://www.caterpillar.com/',CEG:'https://www.constellationenergy.com/',CIEN:'https://www.ciena.com/',CIFR:'https://www.ciphermining.com/',CLSK:'https://www.cleanspark.com/',COHR:'https://www.coherent.com/',COIN:'https://www.coinbase.com/',COST:'https://www.costco.com/',CRCL:'https://www.circle.com/',CRDO:'https://www.credosemi.com/',CRM:'https://www.salesforce.com/',CRWD:'https://www.crowdstrike.com/',CRWV:'https://www.coreweave.com/',CSCO:'https://www.cisco.com/',CVNA:'https://www.carvana.com/',CVX:'https://www.chevron.com/',DDOG:'https://www.datadoghq.com/',DELL:'https://www.dell.com/',DIS:'https://thewaltdisneycompany.com/',DKNG:'https://www.draftkings.com/',EBAY:'https://www.ebayinc.com/',EQT:'https://www.eqt.com/',FCX:'https://www.fcx.com/',FLEX:'https://flex.com/',FLNC:'https://fluenceenergy.com/',FOXA:'https://www.foxcorporation.com/',GE:'https://www.geaerospace.com/',GEV:'https://www.gevernova.com/',GFS:'https://gf.com/',GILD:'https://www.gilead.com/',GLW:'https://www.corning.com/',GME:'https://www.gamestop.com/',GOOGL:'https://abc.xyz/',GPRO:'https://gopro.com/',GS:'https://www.goldmansachs.com/',GTLB:'https://about.gitlab.com/',HD:'https://corporate.homedepot.com/',HIMS:'https://www.hims.com/',HOOD:'https://robinhood.com/',HPE:'https://www.hpe.com/',HUT:'https://www.hut8.com/',IBKR:'https://www.interactivebrokers.com/',IBM:'https://www.ibm.com/',INTC:'https://www.intel.com/',INTU:'https://www.intuit.com/',IONQ:'https://ionq.com/',IREN:'https://iren.com/',ISRG:'https://www.intuitive.com/',JNJ:'https://www.jnj.com/',JPM:'https://www.jpmorganchase.com/',KLAC:'https://www.kla.com/',KO:'https://www.coca-colacompany.com/',LIN:'https://www.linde.com/',LITE:'https://www.lumentum.com/',LLY:'https://www.lilly.com/',LMT:'https://www.lockheedmartin.com/',LRCX:'https://www.lamresearch.com/',LULU:'https://corporate.lululemon.com/',LUNR:'https://www.intuitivemachines.com/',MAR:'https://www.marriott.com/',MCD:'https://corporate.mcdonalds.com/',MDB:'https://www.mongodb.com/',MDT:'https://www.medtronic.com/',MELI:'https://www.mercadolibre.com/',META:'https://about.meta.com/',MP:'https://mpmaterials.com/',MRK:'https://www.merck.com/',MRNA:'https://www.modernatx.com/',MRVL:'https://www.marvell.com/',MSFT:'https://www.microsoft.com/',MSTR:'https://www.strategy.com/',MU:'https://www.micron.com/',NBIS:'https://nebius.com/',NET:'https://www.cloudflare.com/',NFLX:'https://about.netflix.com/',NKE:'https://about.nike.com/',NOK:'https://www.nokia.com/',NOW:'https://www.servicenow.com/',NVDA:'https://www.nvidia.com/',NVO:'https://www.novonordisk.com/',OKLO:'https://oklo.com/',ONDS:'https://www.ondas.com/',ORCL:'https://www.oracle.com/',OUST:'https://ouster.com/',PANW:'https://www.paloaltonetworks.com/',PATH:'https://www.uipath.com/',PFE:'https://www.pfizer.com/',PG:'https://us.pg.com/',PLTR:'https://www.palantir.com/',PYPL:'https://www.paypal.com/',QCOM:'https://www.qualcomm.com/',RDDT:'https://www.redditinc.com/',RDW:'https://redwirespace.com/',REGN:'https://www.regeneron.com/',RIVN:'https://rivian.com/',RKLB:'https://www.rocketlabusa.com/',RUM:'https://rumble.com/',SBUX:'https://www.starbucks.com/',SHOP:'https://www.shopify.com/',SMCI:'https://www.supermicro.com/',SNDK:'https://www.sandisk.com/',SNOW:'https://www.snowflake.com/',SOFI:'https://www.sofi.com/',SPOT:'https://www.spotify.com/',STM:'https://www.st.com/',TEAM:'https://www.atlassian.com/',TER:'https://www.teradyne.com/',TSLA:'https://www.tesla.com/',TSM:'https://www.tsmc.com/',TTWO:'https://www.take2games.com/',TWLO:'https://www.twilio.com/',TWST:'https://www.twistbioscience.com/',TXN:'https://www.ti.com/',UBER:'https://www.uber.com/',UMC:'https://www.umc.com/',UNH:'https://www.unitedhealthgroup.com/',V:'https://www.visa.com/',VICR:'https://www.vicorpower.com/',VKTX:'https://vikingtherapeutics.com/',VLO:'https://www.valero.com/',VRT:'https://www.vertiv.com/',VST:'https://www.vistracorp.com/',WDC:'https://www.westerndigital.com/',WEN:'https://www.wendys.com/',WMT:'https://corporate.walmart.com/',XOM:'https://corporate.exxonmobil.com/',ZM:'https://www.zoom.com/',ZS:'https://www.zscaler.com/',
 TCEHY:'https://www.tencent.com/',XIAOMI:'https://www.mi.com/global/about/',MEITUAN:'https://about.meituan.com/',KUAISHOU:'https://ir.kuaishou.com/',POPMART:'https://www.popmart.com/',SMIC:'https://www.smics.com/',BYD:'https://www.bydglobal.com/',SONY:'https://www.sony.com/',SOFTBANK:'https://group.softbank/en',KIOXIA:'https://www.kioxia-holdings.com/en-jp/',TAIYO:'https://www.yuden.co.jp/en/',SAMSUNG:'https://www.samsung.com/',SAMSUNGEM:'https://www.samsungsem.com/',SKHYNIX:'https://www.skhynix.com/',NAVER:'https://www.navercorp.com/',HYUNDAI:'https://www.hyundai.com/worldwide/en/',LGE:'https://www.lg.com/global/',HANMI:'https://www.hanmisemi.com/',GIGADEVICE:'https://www.gigadevice.com/',
 OPENAI:'https://openai.com/',ANTHROPIC:'https://www.anthropic.com/',MINIMAX:'https://www.minimax.io/',UNITREE:'https://www.unitree.com/',SHEIN:'https://ir.sheingroup.com/',OURA:'https://ouraring.com/',POLYMARKET:'https://polymarket.com/',ZHIPU:'https://www.zhipuai.cn/',CXMT:'https://www.cxmt.com/',JIO:'https://www.jio.com/about/',SPACEX:'https://www.spacex.com/'
};
const FX_LINKS={
 'EUR/USD':[{label:'欧洲央行 ECB',url:'https://www.ecb.europa.eu/'},{label:'美联储 Federal Reserve',url:'https://www.federalreserve.gov/'}],
 'GBP/USD':[{label:'英格兰银行',url:'https://www.bankofengland.co.uk/'},{label:'美联储 Federal Reserve',url:'https://www.federalreserve.gov/'}],
 'USD/JPY':[{label:'美联储 Federal Reserve',url:'https://www.federalreserve.gov/'},{label:'日本银行',url:'https://www.boj.or.jp/en/'}]
};
function assetKind(m){const k=m?.market||m?.category||'';if(k==='stock')return isZh()?'股票代币':'Stock token';if(k==='forex')return isZh()?'外汇代币':'FX token';if(k==='commodity')return isZh()?'大宗商品参考合约':'Commodity reference contract';if(k==='greed')return'GREED';return isZh()?'加密资产':'Crypto asset'}
function websiteLinks(m){
  if(!m)return[];const t=String(m.ticker||'').toUpperCase(),k=m.market||m.category||'';
  if(k==='forex')return FX_LINKS[m.ticker]||[];
  if(k==='stock'){const u=safeUrl(STOCK_SITES[t]);return u?[{label:isZh()?'公司官网':'Company website',url:u}]:[]}
  const d=CRYPTO_DETAILS[t],u=safeUrl(d?.site);return u?[{label:d.siteLabel||(isZh()?'项目官网':'Project website'),url:u}]:[];
}
function detailIntro(m){
  if(!m)return'';const t=String(m.ticker||'').toUpperCase(),k=m.market||m.category||'';
  if(k==='stock')return isZh()?`${m.name||m.ticker} 在 GreedBit 中以股票代币形式模拟。它不是真实股票、不代表股权；已上市标的仅追踪公开参考价格，未上市公司代币使用 GreedBit 模拟估值。`:`${m.name||m.ticker} is represented as a simulated stock token in GreedBit. It is not real equity and conveys no ownership; listed references track public prices while private-company tokens use simulated valuation.`;
  if(k==='forex')return isZh()?`${m.ticker} 在 GreedBit 中以 USDT 结算的模拟外汇代币形式交易。参考汇率来自公开市场数据，相关官方链接指向货币发行/政策机构。`:`${m.ticker} trades in GreedBit as a simulated USDT-settled FX token. Reference rates come from public market data; official links point to the relevant monetary authorities.`;
  if(k==='commodity')return m.desc||(isZh()?'该品种使用公开大宗商品期货行情作为 GreedBit 模拟交易的参考基准。':'This instrument uses public commodity futures prices as a GreedBit simulation reference.');
  if(k==='greed')return isZh()?'GREED（贪婪）是 GreedBit 原创平台币，不真实上链，价格由主流市场、随机波动与模拟事件共同驱动。':'GREED is GreedBit’s internal platform token. It is not on-chain and its price is simulated from major-market moves, randomness and platform events.';
  return CRYPTO_DETAILS[t]?.intro||(isZh()?'该资产已经接入 GreedBit 市场。为避免误导，本页仅展示能够从当前行情与已核验项目资料中确认的信息。':'This asset is available in GreedBit. To avoid misleading claims, this page shows only current market data and verified project information.');
}
function renderUnifiedOverview(){
  const sym=currentSymbol(),m=marketMeta(sym),s=(()=>{try{return marketSnapshots?.[sym]||{}}catch{return{}}})();if(!m)return;
  const dec=m.dec??2,last=Number(s.last)||Number(price)||0,ch=Number(s.change)||0,links=websiteLinks(m),source=s._source||sourceLabel(),icon=m.iconPath?`<img src="${esc(m.iconPath)}" alt="${esc(m.ticker||'')}"/>`:`<span>${esc(String(m.ticker||'?').slice(0,2))}</span>`;
  const marketText=currentMode()==='futures'?(isZh()?'永续合约模拟':'Perpetual simulation'):(isZh()?'现货模拟':'Spot simulation');
  const resource=links.length?links.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a>`).join(''):`<span class="gb23-unverified">${isZh()?'官网未核验，不提供猜测链接':'Website not verified; no guessed link shown'}</span>`;
  document.getElementById('contractInfoPanel').innerHTML=`<div class="overview-subnav"><button class="active">${isZh()?'基础信息':'Overview'}</button><button>${isZh()?'市场属性':'Market'}</button><button>${isZh()?'资源':'Resources'}</button></div><div class="overview-grid gb23-overview-grid"><section class="overview-main"><div class="gb23-detail-head"><div class="gb23-detail-icon">${icon}</div><div><h2>${esc(m.ticker||sym)}</h2><small>${esc(m.name||'')}</small></div><em>${esc(assetKind(m))}</em></div><p class="coin-intro">${esc(detailIntro(m))}</p><div class="kv-list gb23-kv"><div><span>${isZh()?'最新价':'Last'}</span><b>${last?fmtLocal(last,dec):'--'} ${kQuote(m)}</b></div><div><span>${isZh()?'24H 涨跌':'24h change'}</span><b class="${ch>0?'green':ch<0?'red':''}">${last?(ch>=0?'+':'')+ch.toFixed(2)+'%':'--'}</b></div><div><span>${isZh()?'24H 高':'24h high'}</span><b>${Number(s.high)?fmtLocal(s.high,dec):'--'}</b></div><div><span>${isZh()?'24H 低':'24h low'}</span><b>${Number(s.low)?fmtLocal(s.low,dec):'--'}</b></div><div><span>${isZh()?'24H 成交额 / 参考额':'24h volume / reference'}</span><b>${Number(s.quoteVolume)?fmtLocal(s.quoteVolume,0):'--'}</b></div><div><span>${isZh()?'GreedBit 市场':'GreedBit market'}</span><b>${marketText}</b></div></div></section><aside class="overview-side"><h3>${isZh()?'数据说明':'Data source'}</h3><div class="score-card gb23-source-card"><span>${isZh()?'行情来源':'Market source'}</span><b>${esc(source||'--')}</b><small>${isZh()?'外部行情只作为价格参考；账户、撮合、杠杆与资产均为浏览器本地模拟。':'External market data is a price reference only; accounts, matching, leverage and assets are simulated locally in the browser.'}</small></div><h3>${isZh()?'官方资源':'Official resources'}</h3><div class="resource-links gb23-resource-links">${resource}</div></aside></div>`;
}
function kQuote(m){return(m?.market==='forex'&&m?.quote)?m.quote:'USDT'}
function renderUnifiedData(){
  const sym=currentSymbol(),m=marketMeta(sym),s=(()=>{try{return marketSnapshots?.[sym]||{}}catch{return{}}})();if(!m)return;const dec=m.dec??2,last=Number(s.last)||Number(price)||0,ch=Number(s.change)||0,mode=currentMode();let basis='--',funding='--';
  if(mode==='futures'&&window.GreedBitV18){const b=Number(window.GreedBitV18.basisPct?.(sym)),f=Number(window.GreedBitV18.fundingFor?.(sym));if(Number.isFinite(b))basis=`${b>=0?'+':''}${b.toFixed(4)}%`;if(Number.isFinite(f))funding=`${f>=0?'+':''}${(f*100).toFixed(4)}%`}
  const cards=[[isZh()?'最新价':'Last',last?fmtLocal(last,dec):'--',''],[isZh()?'24H 涨跌':'24h change',last?(ch>=0?'+':'')+ch.toFixed(2)+'%':'--',ch>0?'green':ch<0?'red':''],[isZh()?'24H 高':'24h high',Number(s.high)?fmtLocal(s.high,dec):'--',''],[isZh()?'24H 低':'24h low',Number(s.low)?fmtLocal(s.low,dec):'--','']];
  document.getElementById('contractInfoPanel').innerHTML=`<div class="overview-subnav"><button class="active">${isZh()?'市场数据':'Market data'}</button><button>${isZh()?'合约参数':'Contract'}</button><button>${isZh()?'来源':'Source'}</button></div><div class="gb23-data-shell"><div class="gb23-data-grid">${cards.map(c=>`<div><span>${c[0]}</span><b class="${c[2]}">${c[1]}</b></div>`).join('')}</div><div class="gb23-data-lines"><div><span>${isZh()?'资产类型':'Asset type'}</span><b>${esc(assetKind(m))}</b></div><div><span>${isZh()?'行情来源':'Market source'}</span><b>${esc(s._source||sourceLabel())}</b></div><div><span>${isZh()?'计价 / 结算':'Quote / settlement'}</span><b>${esc(kQuote(m))}</b></div><div><span>${isZh()?'当前模式':'Mode'}</span><b>${mode==='futures'?(isZh()?'永续合约':'Perpetual'):(isZh()?'现货':'Spot')}</b></div>${mode==='futures'?`<div><span>${isZh()?'模拟基差':'Simulated basis'}</span><b>${basis}</b></div><div><span>${isZh()?'资金费率':'Funding rate'}</span><b>${funding}</b></div>`:''}</div><p class="analytics-note">${isZh()?'本页只展示当前项目能够可靠获取或内部明确模拟的数据，不伪造持仓量、链上指标或第三方评分。':'Only reliably available or explicitly simulated data is shown. Open interest, on-chain metrics and third-party scores are not fabricated.'}</p></div>`;
}
function showUnifiedPanel(mode){
  activeInfoMode=mode;const tabs=document.querySelector('.charttabs'),info=document.getElementById('contractInfoPanel'),timebar=document.getElementById('timebar'),wrap=document.getElementById('chartwrap'),layout=document.getElementById('layout');if(!tabs||!info||!timebar||!wrap||!layout)return;
  [...tabs.querySelectorAll('span')].forEach(x=>x.classList.toggle('active',x.dataset.gb23Panel===mode));const full=mode!=='chart';timebar.classList.toggle('hidden',full);wrap.classList.toggle('hidden',full);info.classList.toggle('hidden',!full);layout.classList.toggle('contract-info-mode',full);if(mode==='overview')renderUnifiedOverview();else if(mode==='data')renderUnifiedData();else setTimeout(()=>{try{resize()}catch{}},0);
}
function installUnifiedContractPanels(){
  const old=document.querySelector('.charttabs');if(!old||old.dataset.gb23==='1')return;const bar=old.cloneNode(true);old.replaceWith(bar);bar.dataset.gb23='1';const spans=[...bar.querySelectorAll('span')];['chart','overview','data'].forEach((m,i)=>{if(spans[i])spans[i].dataset.gb23Panel=m});bar.addEventListener('click',e=>{const x=e.target.closest('span[data-gb23-panel]');if(x){e.preventDefault();showUnifiedPanel(x.dataset.gb23Panel)}});
  let info=document.getElementById('contractInfoPanel');if(!info){info=document.createElement('div');info.id='contractInfoPanel';info.className='contract-info hidden';document.querySelector('.chartpanel')?.appendChild(info)}
  try{const inherited=setSymbol;setSymbol=async function(){const before=currentSymbol(),out=await inherited.apply(this,arguments);if(currentSymbol()!==before)syncAmountUnit(true);if(activeInfoMode==='overview')renderUnifiedOverview();else if(activeInfoMode==='data')renderUnifiedData();return out}}catch(e){console.warn('setSymbol detail hook failed',e)}
}

/* ---------- order amount: USDT margin or base-asset position size ---------- */
let amountUnit='USDT';
function unitBase(){const m=marketMeta(currentSymbol());return String(m?.ticker||currentSymbol().split('/')[0]||'BASE')}
function unitPrice(){const sym=currentSymbol();let p=0;try{if(currentMode()==='futures'&&window.GreedBitV18?.contractPriceFor)p=Number(window.GreedBitV18.contractPriceFor(sym))||0}catch{};try{p=p||Number(price)||Number(marketSnapshots?.[sym]?.last)||0}catch{}return p}
function nativeMargin(){return document.getElementById('marginInput')}
function proxyAmount(){return document.getElementById('gbOrderAmountInput')}
function syncNativeFromProxy(){const n=nativeMargin(),p=proxyAmount();if(!n||!p)return;let v=Math.max(0,Number(p.value)||0);if(amountUnit!=='USDT'){const px=unitPrice(),lev=Math.max(1,Number(leverage)||1);v=px>0?v*px/lev:0}n.value=v?v.toFixed(8):'';n.dispatchEvent(new Event('input',{bubbles:true}));try{updatePreview()}catch{}}
function syncProxyFromNative(){const n=nativeMargin(),p=proxyAmount();if(!n||!p)return;const v=Math.max(0,Number(n.value)||0);if(amountUnit==='USDT')p.value=v?v.toFixed(2):'';else{const px=unitPrice(),lev=Math.max(1,Number(leverage)||1),qty=px>0?v*lev/px:0;p.value=qty?qty.toFixed(8).replace(/0+$/,'').replace(/\.$/,''):''}}
function syncAmountUnit(reset=false){if(reset)amountUnit='USDT';const b=document.getElementById('gbOrderUnitLabel'),base=unitBase();if(b)b.textContent=amountUnit==='USDT'?'USDT':base;document.querySelectorAll('[data-gb23-unit]').forEach(x=>{x.textContent=x.dataset.gb23Unit==='BASE'?base:'USDT';x.classList.toggle('active',(x.dataset.gb23Unit==='BASE'&&amountUnit!=='USDT')||(x.dataset.gb23Unit==='USDT'&&amountUnit==='USDT'))});syncProxyFromNative()}
function installAmountSelector(){
  const n=nativeMargin(),field=n?.closest('.field');if(!n||!field||document.getElementById('gbOrderAmountInput'))return;field.classList.add('gb23-amount-field');const label=field.querySelector('label');if(label)label.textContent=isZh()?'金额':'Amount';n.classList.add('gb23-native-margin');
  const p=document.createElement('input');p.id='gbOrderAmountInput';p.type='number';p.min='0';p.step='any';p.placeholder='0.00';p.inputMode='decimal';n.insertAdjacentElement('afterend',p);
  const oldUnit=[...field.children].find(x=>x.tagName==='SPAN'&&x!==label);oldUnit?.remove();const picker=document.createElement('div');picker.className='gb23-unit-picker';picker.innerHTML=`<button type="button" id="gbOrderUnitButton" class="gb23-unit-button"><span id="gbOrderUnitLabel">USDT</span><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,9 18,9 12,15"></polygon></svg></button><div id="gbOrderUnitMenu" class="gb23-unit-menu hidden"><button type="button" data-gb23-unit="USDT">USDT</button><button type="button" data-gb23-unit="BASE">${esc(unitBase())}</button></div>`;field.appendChild(picker);
  p.addEventListener('input',syncNativeFromProxy);document.getElementById('gbOrderUnitButton').onclick=e=>{e.stopPropagation();document.getElementById('gbOrderUnitMenu').classList.toggle('hidden')};picker.addEventListener('click',e=>{const b=e.target.closest('[data-gb23-unit]');if(!b)return;e.preventDefault();const oldMargin=Number(n.value)||0;amountUnit=b.dataset.gb23Unit==='BASE'?'BASE':'USDT';n.value=oldMargin?String(oldMargin):'';syncAmountUnit(false);document.getElementById('gbOrderUnitMenu').classList.add('hidden')});document.addEventListener('click',e=>{if(!picker.contains(e.target))document.getElementById('gbOrderUnitMenu')?.classList.add('hidden')});
  document.getElementById('pct')?.addEventListener('input',()=>requestAnimationFrame(syncProxyFromNative));document.getElementById('levRange')?.addEventListener('input',()=>{if(amountUnit!=='USDT')syncNativeFromProxy();else syncProxyFromNative()});
  try{const inheritedPlace=placeOrder;placeOrder=function(){syncNativeFromProxy();const out=inheritedPlace.apply(this,arguments);requestAnimationFrame(syncProxyFromNative);return out}}catch(e){console.warn('amount selector order hook failed',e)}
  syncAmountUnit(false);
}

/* ---------- home + language ---------- */
function syncHomeLanguage(){
  const home=document.querySelector('.home-v13');if(!home)return;const zh=isZh(),title=home.querySelector('.home-title-v13');if(title)title.innerHTML=zh?'用真实行情<br><span>练习最危险的决定</span>':'Trade real markets<br><span>Practice the riskiest decisions</span>';
  const lead=home.querySelector('.home-lead-v13');if(lead)lead.textContent=zh?'主流币使用公开市场数据；资金、订单、杠杆、赚币与平台币 GREED 全部运行在浏览器本地模拟账户。你可以测试策略和风险偏好，但不会触碰真实资金。':'Major assets use public market data; funds, orders, leverage, Earn and GREED all run in a browser-local simulated account. Test strategy and risk without touching real funds.';
  const btns=home.querySelectorAll('[data-v13-goto]');if(btns[0])btns[0].textContent=zh?'进入交易终端':'Open trading terminal';if(btns[1])btns[1].textContent=zh?'浏览市场资讯':'Market news';if(btns[2])btns[2].textContent=zh?'赚币':'Earn';
  const eq=home.querySelector('.home-equity-main small');if(eq)eq.textContent=zh?'模拟总资产':'TOTAL SIMULATED EQUITY';const daily=home.querySelector('.home-daily-pnl small');if(daily)daily.textContent=zh?'今日盈亏':'Daily P&L';
  const trust=home.querySelectorAll('.home-trust-v13 span');const z=['真实公开行情','纯前端账户','本地撮合','无真实资金'],en=['Public market data','Frontend-only account','Local matching','No real funds'];trust.forEach((x,i)=>{const dot=x.querySelector('i');x.textContent=(zh?z:en)[i]||'';if(dot)x.prepend(dot)});
}
function syncMarketLanguage(){
  const zh=isZh(),head=document.querySelector('.news-center-head');if(head){const h=head.querySelector('h1'),p=head.querySelector('p');if(h)h.textContent=zh?'市场资讯':'Market news';if(p)p.textContent=zh?'聚合公开财经与加密市场 RSS；新闻加载失败不会影响交易与行情功能。':'Aggregated public finance and crypto RSS. News failures do not affect trading or live market data.'}
  scheduleAutoTranslate();
}
function scheduleAutoTranslate(){clearTimeout(autoTranslateTimer);autoTranslateTimer=setTimeout(autoTranslateNews,120)}
async function autoTranslateNews(){
  if(autoTranslateBusy)return;const list=document.getElementById('newsList');if(!list)return;const buttons=[...list.querySelectorAll('[data-news-translate]')].filter(b=>!b.disabled&&b.dataset.state!=='translated');if(!buttons.length)return;autoTranslateBusy=true;
  try{for(const b of buttons.slice(0,20)){if(!document.body.contains(b)||b.disabled)continue;b.click();const start=Date.now();while(b.disabled&&Date.now()-start<9000)await new Promise(r=>setTimeout(r,120));await new Promise(r=>setTimeout(r,80))}}finally{autoTranslateBusy=false;if([...list.querySelectorAll('[data-news-translate]')].some(b=>!b.disabled&&b.dataset.state!=='translated'))scheduleAutoTranslate()}
}
function installLanguageSync(){
  syncHomeLanguage();syncMarketLanguage();const list=document.getElementById('newsList');if(list)new MutationObserver(()=>scheduleAutoTranslate()).observe(list,{childList:true,subtree:true});new MutationObserver(()=>{syncHomeLanguage();syncMarketLanguage();if(activeInfoMode==='overview')renderUnifiedOverview();else if(activeInfoMode==='data')renderUnifiedData();const label=document.querySelector('.gb23-amount-field label');if(label)label.textContent=isZh()?'金额':'Amount'}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  try{const inheritedRenderHome=renderHome;renderHome=function(){const out=inheritedRenderHome.apply(this,arguments);syncHomeLanguage();return out}}catch{}
}

/* ---------- price-keyed horizontal grid: lines move when price axis pans ---------- */
function nicePriceStep(raw){if(!Number.isFinite(raw)||raw<=0)return 1;const exp=Math.floor(Math.log10(raw)),pow=10**exp,m=raw/pow,n=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10;return n*pow}
function drawPriceGrid(){
  if(activeInfoMode!=='chart')return;let W,H,bounds;try{W=canvas.clientWidth;H=canvas.clientHeight;bounds=calcPriceBounds()}catch{return}if(!W||!H||!bounds)return;const pad={l:8,r:82,t:28,b:38},plotH=H-pad.t-pad.b,range=bounds.hi-bounds.lo;if(!(range>0))return;const step=nicePriceStep(range/5.4),first=Math.ceil(bounds.lo/step)*step;ctx.save();ctx.font='10px sans-serif';ctx.lineWidth=1;
  for(let p=first;p<=bounds.hi+step*.001;p+=step){const yy=pad.t+(bounds.hi-p)/range*plotH;if(yy<=pad.t+3||yy>=H-pad.b-3)continue;ctx.strokeStyle='rgba(74,80,92,.34)';ctx.beginPath();ctx.moveTo(pad.l,Math.round(yy)+.5);ctx.lineTo(W-pad.r,Math.round(yy)+.5);ctx.stroke();ctx.fillStyle='#6f7a8b';ctx.fillText(fmtLocal(Math.max(0,p),configs?.[currentSymbol()]?.dec??2),W-pad.r+5,yy+3)}ctx.restore();
  try{window.GreedBitV14?.drawPositionOverlay?.()}catch{}
}
function installPriceGrid(){
  if(window.__gb23PriceGrid)return;let inherited;try{inherited=draw}catch{return}if(typeof inherited!=='function')return;draw=function(){const oldStroke=ctx.stroke,oldText=ctx.fillText;ctx.stroke=function(){const s=String(this.strokeStyle||'').toLowerCase();if(s==='#1d232b'||s==='#171c22'||s==='rgb(29, 35, 43)'||s==='rgb(23, 28, 34)')return;return oldStroke.apply(this,arguments)};ctx.fillText=function(text,x,y){const W=canvas.clientWidth,fill=String(this.fillStyle||'').toLowerCase();if(x>=W-80&&(fill==='#6f7a8b'||fill==='rgb(111, 122, 139)')&&/^[-+]?\d[\d,.]*$/.test(String(text)))return;return oldText.apply(this,arguments)};let out;try{out=inherited.apply(this,arguments)}finally{ctx.stroke=oldStroke;ctx.fillText=oldText}drawPriceGrid();return out};window.__gb23PriceGrid=true;try{draw()}catch{}
}

function finalize(){
  if(finalized)return;finalized=true;installSourceLabelGuard();installFavicon();updateVersion();installMarketReliability();installUnifiedContractPanels();installAmountSelector();installPriceGrid();installLanguageSync();
  requestAnimationFrame(()=>{installSourceLabelGuard();window.GreedBitPairLabelGuard?.enforce?.();syncHomeLanguage();syncMarketLanguage();updateVersion();document.documentElement.classList.add('gb-runtime-ready')});
  window.GreedBitV21={VERSION,sourceLabel,renderOverview:renderUnifiedOverview,renderData:renderUnifiedData};
}
function boot(){document.documentElement.classList.add('gb21-ui');installStyle(finalize);setTimeout(finalize,1500)}
boot();
})();
