/* v0.0.12 modern home */
(function(){
'use strict';
const VERSION='0.0.12';
const HERO_VIDEO='assets/mammon-home.mp4';

function installV12Style(){if(document.querySelector('link[href="styles/v012.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v012.css';document.head.appendChild(l)}
function safeNum(v){const n=Number(v);return Number.isFinite(n)?n:0}
function changeClass(v){return safeNum(v)>=0?'green':'red'}
function signedPct(v){v=safeNum(v);return`${v>=0?'+':''}${v.toFixed(2)}%`}
function marketStatusSnapshot(){const text=$('marketStatusText')?.textContent||'正在连接真实行情…',state=marketReady?'live':(/失败|不可用|error/i.test(text)?'error':'connecting');return{state,text}}
function assetSnapshot(sym){const c=configs[sym],m=marketSnapshots[sym]||{};return{c,last:safeNum(m.last||c.anchor),change:safeNum(m.change)}}

function homeMarkup(){return`
<div class="home-v12">
  <section class="home-hero-v12">
    <div class="home-copy-v12">
      <div class="home-kicker"><span class="home-live-pill">PUBLIC MARKET FEED</span><span>GREEDBIT SIMULATION EXCHANGE</span></div>
      <h1>真实市场，<span>零资金风险。</span></h1>
      <p class="home-lead">BTC / ETH 历史 K 线、实时成交与盘口来自公开市场数据。资金、订单、杠杆和强平全部发生在 GreedBit 的本地模拟账户中——可以测试判断，但不会触碰真实资产。</p>
      <div class="home-actions-v12"><button class="home-primary-action" data-home-goto="futures">进入合约交易</button><button class="home-secondary-action" data-home-goto="market">查看市场资讯</button></div>
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
    <article class="home-info-card"><small>MARKET NEWS</small><strong>CoinDesk + CNBC</strong><p>行情资讯使用公开 RSS，多路读取并缓存最近一次成功结果；新闻故障不会影响交易行情。</p><button class="linkbtn" data-home-goto="market">查看市场资讯 →</button></article>
  </section>
</div>`}

function installHome(){
  const home=$('homePage');if(!home)return;home.innerHTML=homeMarkup();
  const stage=$('mammonStage'),video=$('mammonHero');if(video&&stage){const ready=()=>stage.classList.add('video-ready'),failed=()=>stage.classList.add('video-failed');video.addEventListener('loadeddata',ready,{once:true});video.addEventListener('canplay',ready,{once:true});video.addEventListener('error',failed,{once:true});video.play().catch(()=>{})}
  home.addEventListener('click',e=>{const b=e.target.closest('[data-home-goto]');if(b){showPage(b.dataset.homeGoto);return}const card=e.target.closest('[data-market-symbol]');if(card)openMarketSymbol(card.dataset.marketSymbol)})
}
async function openMarketSymbol(sym){try{if(sym&&sym!==symbol)await setSymbol(sym);showPage('futures')}catch(e){console.warn('open market symbol failed',e)}}
function renderHomeV12(){
  const box=$('homeMarkets');if(!box)return;
  const rows=Object.keys(configs).map(sym=>{const {c,last,change}=assetSnapshot(sym);return`<article class="home-ticker-card" data-market-symbol="${sym}"><div class="home-ticker-top"><i class="home-ticker-icon" style="background:${c.color}">${c.icon}</i><b>${sym}</b><small>24H</small></div><div class="home-ticker-main"><b>${last?fmt(last,c.dec):'--'}</b><span class="${changeClass(change)}">${signedPct(change)}</span></div></article>`});
  const s=marketStatusSnapshot();rows.push(`<article class="home-ticker-card" data-home-goto="market"><div class="home-ticker-top"><i class="home-ticker-icon" style="background:#1d7f5c">●</i><b>市场资讯</b><small>RSS</small></div><div class="home-ticker-main"><b style="font-size:14px">CoinDesk + CNBC</b><span class="green">NEWS</span></div></article>`);
  const equity=user?totalAsset():null;rows.push(`<article class="home-ticker-card" data-home-goto="assets"><div class="home-ticker-top"><i class="home-ticker-icon" style="background:#536fce">◎</i><b>模拟账户</b><small>LOCAL</small></div><div class="home-ticker-main"><b>${equity!=null?fmt(equity)+' USDT':'未登录'}</b><span>${user?'本机存档':'LOGIN'}</span></div></article>`);box.innerHTML=rows.join('');
  const btc=assetSnapshot('BTC/USDT');if($('homeHeroPrice'))$('homeHeroPrice').textContent=btc.last?fmt(btc.last,btc.c.dec):'--';if($('homeHeroChange')){$('homeHeroChange').textContent=signedPct(btc.change);$('homeHeroChange').className=changeClass(btc.change)}
  if($('homeTotalAsset'))$('homeTotalAsset').textContent=user?fmt(totalAsset())+' USDT':'-- USDT';if($('homeAccountHint'))$('homeAccountHint').textContent=user?'当前浏览器中的现货、合约与其他模拟账户权益合计。':'登录后查看本地模拟账户总权益。所有资产仅存在于当前浏览器。';
}

const baseUpdateSnapshots=updateMarketSnapshots;updateMarketSnapshots=async function(){const out=await baseUpdateSnapshots.apply(this,arguments);renderHomeV12();return out};
const baseSetStatus=setMarketStatus;setMarketStatus=function(){const out=baseSetStatus.apply(this,arguments);renderHomeV12();return out};
const baseSyncAuth=syncAuth;syncAuth=function(){const out=baseSyncAuth.apply(this,arguments);setTimeout(renderHomeV12,0);return out};
const baseShowPage=showPage;showPage=function(page){const out=baseShowPage.apply(this,arguments);if(page==='home')renderHomeV12();return out};
function updateVersion(){const v=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));if(v)v.textContent=`GreedBit v${VERSION}`}
function loadNewsModule(){if(document.querySelector('script[src="src/v012-news.js"]'))return;const s=document.createElement('script');s.src='src/v012-news.js';document.body.appendChild(s)}
function boot(){installV12Style();installHome();renderHomeV12();updateVersion();loadNewsModule();setInterval(()=>{if(!$('homePage')?.classList.contains('hidden'))renderHomeV12()},1500)}
boot();
})();
