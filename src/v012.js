/* v0.0.12 modern home + resilient market center */
(function(){
'use strict';
const VERSION='0.0.12';
const HERO_VIDEO='assets/mammon-home.mp4';

function installV12Style(){
  if(document.querySelector('link[href="styles/v012.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v012.css';document.head.appendChild(l);
}
function safeNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
function changeClass(v){return safeNum(v)>=0?'green':'red'}
function signedPct(v){v=safeNum(v);return`${v>=0?'+':''}${v.toFixed(2)}%`}
function shortVolume(v){v=safeNum(v);const a=Math.abs(v);if(a>=1e9)return(v/1e9).toFixed(2)+'B';if(a>=1e6)return(v/1e6).toFixed(2)+'M';if(a>=1e3)return(v/1e3).toFixed(2)+'K';return fmt(v,0)}
function marketStatusSnapshot(){
  const text=$('marketStatusText')?.textContent||'正在连接真实行情…';
  const state=marketReady?'live':(/失败|不可用|error/i.test(text)?'error':'connecting');
  return{state,text};
}
function assetSnapshot(sym){const c=configs[sym],m=marketSnapshots[sym]||{};return{c,m,last:safeNum(m.last||c.anchor),change:safeNum(m.change),high:safeNum(m.high),low:safeNum(m.low),volume:safeNum(m.quoteVolume)}}

function homeMarkup(){return`
<div class="home-v12">
  <section class="home-hero-v12">
    <div class="home-copy-v12">
      <div class="home-kicker"><span class="home-live-pill">PUBLIC MARKET FEED</span><span>GREEDBIT SIMULATION EXCHANGE</span></div>
      <h1>真实市场，<span>零资金风险。</span></h1>
      <p class="home-lead">BTC / ETH 历史 K 线、实时成交与盘口来自公开市场数据。资金、订单、杠杆和强平全部发生在 GreedBit 的本地模拟账户中——可以测试判断，但不会触碰真实资产。</p>
      <div class="home-actions-v12"><button class="home-primary-action" data-home-goto="futures">进入合约交易</button><button class="home-secondary-action" data-home-goto="market">查看实时行情</button></div>
      <div class="home-proof"><span><i></i>公开市场行情</span><span><i></i>本地模拟撮合</span><span><i></i>无真实资金</span><span><i></i>纯前端运行</span></div>
    </div>
    <div class="home-visual-v12">
      <div class="mammon-stage" id="mammonStage">
        <video class="mammon-video" id="mammonHero" src="${HERO_VIDEO}" autoplay muted loop playsinline preload="metadata"></video>
        <div class="mammon-fallback"><img src="assets/greedbit-logo.png" alt="GreedBit"/></div>
      </div>
      <div class="hero-live-card">
        <div class="hero-live-card-head"><span>BTC / USDT</span><i></i></div>
        <strong id="homeHeroPrice">--</strong>
        <div class="hero-live-card-foot"><span id="homeHeroChange">--</span><span>24H</span></div>
      </div>
    </div>
  </section>
  <section class="home-market-strip" id="homeMarkets"></section>
  <section class="home-info-grid">
    <article class="home-info-card home-account-card"><small>SIMULATED EQUITY</small><strong id="homeTotalAsset">-- USDT</strong><p id="homeAccountHint">登录后查看本地模拟账户总权益。所有资产仅存在于当前浏览器。</p><button class="linkbtn" data-home-goto="assets">管理模拟资产 →</button></article>
    <article class="home-info-card"><small>MARKET ENGINE</small><strong>REST + WebSocket</strong><p>历史 K 线通过公开 REST 接口加载，实时成交、Ticker 与盘口通过 WebSocket 持续更新。</p><button class="linkbtn" data-home-goto="futures">打开专业交易界面 →</button></article>
    <article class="home-info-card"><small>LOCAL FIRST</small><strong>Browser Native</strong><p>账号、配置、持仓和订单均保存在浏览器。本项目长期保持纯前端，不依赖自建服务器。</p><button class="linkbtn" data-home-goto="market">查看市场状态 →</button></article>
  </section>
</div>`}

function marketMarkup(){return`
<div class="market-center-v12">
  <div class="market-title-row">
    <div><span class="eyebrow">MARKET CENTER</span><h1>实时行情</h1><p>真实公开市场价格与 GreedBit 模拟交易之间保持严格隔离。</p></div>
    <div class="market-live-state" id="marketPageState"><i></i><span id="marketPageStatus">正在连接真实行情…</span></div>
  </div>
  <section class="market-overview-grid" id="marketOverviewCards"></section>
  <section class="market-table-card">
    <div class="market-card-head"><h2>市场列表</h2><p>BTC / ETH · USDT</p><span class="spacer"></span><small class="muted">点击交易对进入合约界面</small></div>
    <table class="market-table"><thead><tr><th>交易对</th><th>最新价</th><th>24H 涨跌</th><th>24H 高</th><th>24H 低</th><th>24H 成交额</th></tr></thead><tbody id="marketOverviewBody"></tbody></table>
  </section>
  <section class="market-news-card">
    <div class="market-card-head"><h2>市场资讯</h2><p>外部 RSS 为附加信息源，不影响实时行情</p><span class="spacer"></span><span class="news-health" id="newsHealth">等待资讯源</span></div>
    <div class="news-category-bar" id="newsCategoryBar">
      <button class="active" data-newsfilter="all">精选</button><button data-newsfilter="直播">直播</button><button data-newsfilter="鲸鱼">巨鲸</button><button data-newsfilter="机构">主力</button><button data-newsfilter="监管">监管</button><button data-newsfilter="市场">市场</button><button data-newsfilter="技术">技术</button><button data-newsfilter="BTC">BTC</button><button data-newsfilter="ETH">ETH</button>
      <span class="spacer"></span><label><input id="importantOnly" type="checkbox"/> 只看重要</label><button class="settingsbtn" id="refreshNewsBtn">刷新资讯</button>
    </div>
    <div class="news-timeline" id="newsList"></div>
  </section>
</div>`}

function installHomeAndMarket(){
  const home=$('homePage'),market=$('marketPage');if(home)home.innerHTML=homeMarkup();if(market)market.innerHTML=marketMarkup();
  const stage=$('mammonStage'),video=$('mammonHero');if(video&&stage){
    const ready=()=>stage.classList.add('video-ready');const failed=()=>stage.classList.add('video-failed');
    video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('canplay',ready,{once:true});video.addEventListener('error',failed,{once:true});
    video.play().catch(()=>{});
  }
  home?.addEventListener('click',e=>{const b=e.target.closest('[data-home-goto]');if(b)showPage(b.dataset.homeGoto);const card=e.target.closest('[data-market-symbol]');if(card)openMarketSymbol(card.dataset.marketSymbol)});
  market?.addEventListener('click',e=>{
    const card=e.target.closest('[data-market-symbol]');if(card){openMarketSymbol(card.dataset.marketSymbol);return}
    const filter=e.target.closest('[data-newsfilter]');if(filter){newsFilter=filter.dataset.newsfilter;$$('[data-newsfilter]').forEach(x=>x.classList.toggle('active',x===filter));renderNews();return}
    if(e.target.closest('#refreshNewsBtn')){loadRealNews(true);return}
    if(e.target.closest('#newsRetryBtn')){loadRealNews(true);return}
    const vote=e.target.closest('[data-newsvote]');if(vote)voteNews(vote.dataset.newsid,vote.dataset.newsvote);
  });
  $('importantOnly')?.addEventListener('change',()=>renderNews());
}
async function openMarketSymbol(sym){try{if(sym&&sym!==symbol)await setSymbol(sym);showPage('futures')}catch(e){console.warn('open market symbol failed',e)}}

function renderHomeV12(){
  const box=$('homeMarkets');if(!box)return;
  const rows=Object.keys(configs).map(sym=>{const {c,last,change}=assetSnapshot(sym);return`<article class="home-ticker-card" data-market-symbol="${sym}"><div class="home-ticker-top"><i class="home-ticker-icon" style="background:${c.color}">${c.icon}</i><b>${sym}</b><small>24H</small></div><div class="home-ticker-main"><b>${last?fmt(last,c.dec):'--'}</b><span class="${changeClass(change)}">${signedPct(change)}</span></div></article>`});
  const s=marketStatusSnapshot();rows.push(`<article class="home-ticker-card" data-home-goto="market"><div class="home-ticker-top"><i class="home-ticker-icon" style="background:#1d7f5c">●</i><b>行情连接</b><small>LIVE</small></div><div class="home-ticker-main"><b style="font-size:14px">${s.state==='live'?'实时数据已连接':s.state==='error'?'连接异常':'正在连接'}</b><span class="${s.state==='error'?'red':'green'}">${s.state==='live'?'ONLINE':s.state==='error'?'ERROR':'SYNC'}</span></div></article>`);
  const equity=user?totalAsset():null;rows.push(`<article class="home-ticker-card" data-home-goto="assets"><div class="home-ticker-top"><i class="home-ticker-icon" style="background:#536fce">◎</i><b>模拟账户</b><small>LOCAL</small></div><div class="home-ticker-main"><b>${equity!=null?fmt(equity)+' USDT':'未登录'}</b><span>${user?'本机存档':'LOGIN'}</span></div></article>`);box.innerHTML=rows.join('');
  const btc=assetSnapshot('BTC/USDT');if($('homeHeroPrice'))$('homeHeroPrice').textContent=btc.last?fmt(btc.last,btc.c.dec):'--';if($('homeHeroChange')){$('homeHeroChange').textContent=signedPct(btc.change);$('homeHeroChange').className=changeClass(btc.change)}
  if($('homeTotalAsset'))$('homeTotalAsset').textContent=user?fmt(totalAsset())+' USDT':'-- USDT';if($('homeAccountHint'))$('homeAccountHint').textContent=user?'当前浏览器中的现货、合约与其他模拟账户权益合计。':'登录后查看本地模拟账户总权益。所有资产仅存在于当前浏览器。';
}

function renderMarketV12(){
  const cards=$('marketOverviewCards'),body=$('marketOverviewBody');if(!cards||!body)return;
  const rows=Object.keys(configs).map(sym=>({sym,...assetSnapshot(sym)}));
  cards.innerHTML=rows.map(({sym,c,last,change,high,low,volume})=>`<article class="market-asset-card" data-market-symbol="${sym}"><div class="market-asset-card-head"><i class="market-asset-icon" style="background:${c.color}">${c.icon}</i><div><b>${sym}</b><small>公开市场 · USDT</small></div><span class="market-asset-change ${changeClass(change)}">${signedPct(change)}</span></div><div class="market-asset-price">${last?fmt(last,c.dec):'--'}</div><div class="market-asset-meta"><div><small>24H 高</small><span>${high?fmt(high,c.dec):'--'}</span></div><div><small>24H 低</small><span>${low?fmt(low,c.dec):'--'}</span></div><div><small>成交额</small><span>${volume?shortVolume(volume):'--'}</span></div></div></article>`).join('');
  body.innerHTML=rows.map(({sym,c,last,change,high,low,volume})=>`<tr data-market-symbol="${sym}"><td><div class="market-symbol-cell"><i style="background:${c.color}">${c.icon}</i><div><b>${sym}</b><small> Spot reference</small></div></div></td><td>${last?fmt(last,c.dec):'--'}</td><td class="${changeClass(change)}">${signedPct(change)}</td><td>${high?fmt(high,c.dec):'--'}</td><td>${low?fmt(low,c.dec):'--'}</td><td>${volume?shortVolume(volume):'--'}</td></tr>`).join('');
  syncMarketPageState();
}
function syncMarketPageState(){const el=$('marketPageState'),text=$('marketPageStatus');if(!el||!text)return;const s=marketStatusSnapshot();el.classList.remove('live','error');if(s.state!=='connecting')el.classList.add(s.state);text.textContent=s.text}
function setNewsHealth(state,text){const el=$('newsHealth');if(!el)return;el.className='news-health '+(state||'');el.textContent=text}

const originalRenderNews=renderNews;
renderNews=function(){
  const list=$('newsList');if(!list)return;
  if(!newsItems.length){list.innerHTML=`<div class="news-empty-pro"><b>${newsLoading?'正在获取市场资讯':'资讯源暂不可用'}</b><p>${newsLoading?'正在尝试 CoinDesk 与多个浏览器跨域通道。':'实时价格、K线和盘口不依赖资讯源，仍可正常使用。你可以稍后重试资讯。'}</p>${newsLoading?'':'<button id="newsRetryBtn">重新尝试</button>'}</div>`;return}
  originalRenderNews();
};

async function fetchWithTimeout(url,ms=4500){const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);const text=await r.text();if(!/<(?:rss|feed)(?:\s|>)/i.test(text))throw new Error('not an RSS document');return text}finally{clearTimeout(t)}}
fetchNewsText=async function(url){
  const candidates=[url,'https://api.allorigins.win/raw?url='+encodeURIComponent(url),'https://corsproxy.io/?url='+encodeURIComponent(url),'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(url)];let last;
  for(const candidate of candidates){try{return await fetchWithTimeout(candidate)}catch(e){last=e}}
  throw last||new Error('all RSS routes failed');
};
loadRealNews=async function(showToast=false){
  if(newsLoading)return;newsLoading=true;setNewsHealth('','资讯同步中');renderNews();
  try{
    const batches=[];for(const src of NEWS_SOURCES){try{batches.push(...parseRss(await fetchNewsText(src.url),src))}catch(e){console.warn(`${src.name} news failed`,e)}}
    if(!batches.length)throw new Error('no news source available');const unique=new Map();for(const n of batches.sort((a,b)=>b.publishedAt-a.publishedAt))if(!unique.has(n.id))unique.set(n.id,n);newsItems=[...unique.values()].slice(0,80);setNewsHealth('ok',`${newsItems.length} 条真实资讯`);if(showToast)notify('资讯已刷新',`已获取 ${newsItems.length} 条真实资讯`,'success');
  }catch(e){console.warn('news load failed',e);setNewsHealth('error','资讯源暂不可用');if(showToast)notify('资讯刷新失败','外部 RSS 或跨域通道暂不可用；实时行情不受影响。','error',5000)}finally{newsLoading=false;renderNews();if(user?.isAdmin)renderAdminPage()}
};

const baseRenderHome=renderHomeMarkets;renderHomeMarkets=function(){renderHomeV12()};
const baseUpdateSnapshots=updateMarketSnapshots;updateMarketSnapshots=async function(){const out=await baseUpdateSnapshots.apply(this,arguments);renderHomeV12();renderMarketV12();return out};
const baseSetStatus=setMarketStatus;setMarketStatus=function(state,text){const out=baseSetStatus.apply(this,arguments);syncMarketPageState();renderHomeV12();return out};
const baseSyncAuth=syncAuth;syncAuth=function(){const out=baseSyncAuth.apply(this,arguments);setTimeout(()=>renderHomeV12(),0);return out};
const baseShowPage=showPage;showPage=function(page){const out=baseShowPage.apply(this,arguments);if(page==='home')renderHomeV12();if(page==='market'){renderMarketV12();renderNews();if(!newsItems.length&&!newsLoading)loadRealNews(false)}return out};

function updateVersion(){const v=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));if(v)v.textContent=`GreedBit v${VERSION}`}
function boot(){installV12Style();installHomeAndMarket();renderHomeV12();renderMarketV12();renderNews();updateVersion();setInterval(()=>{if(!$('homePage')?.classList.contains('hidden'))renderHomeV12();if(!$('marketPage')?.classList.contains('hidden'))renderMarketV12()},1500)}
boot();
})();
