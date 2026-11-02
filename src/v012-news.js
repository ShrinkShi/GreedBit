/* v0.0.12 news-only market page + resilient RSS loading */
(function(){
'use strict';
const CACHE_KEY='greedbit_news_cache_v2';
const CACHE_MAX_AGE=24*60*60*1000;
const AUTO_REFRESH=5*60*1000;
const FEEDS=[
  {name:'CoinDesk',kind:'crypto',url:'https://www.coindesk.com/arc/outboundfeeds/rss/'},
  {name:'CNBC Investing',kind:'finance',url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069'},
  {name:'CNBC Top News',kind:'finance',url:'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114',fallback:true}
];
let sourceState={},lastSuccessfulFetch=0,usingCache=false;

function installCss(){if(document.querySelector('link[href="styles/v012-news.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v012-news.css';document.head.appendChild(l)}
function marketNewsMarkup(){return`<div class="news-center-v12">
  <header class="news-center-head">
    <div><span class="eyebrow">MARKET NEWS</span><h1>市场资讯</h1><p>聚合 CoinDesk 加密市场资讯，并以 CNBC 财经新闻作为独立兜底源。新闻加载失败不会影响交易与行情功能。</p></div>
    <div class="news-source-state" id="newsSourceState"><i></i><span id="newsSourceStateText">正在连接新闻源…</span></div>
  </header>
  <div class="news-source-strip" id="newsSourceStrip"></div>
  <section class="news-center-card">
    <div class="news-category-bar" id="newsCategoryBar">
      <button class="active" data-newsfilter="all">精选</button><button data-newsfilter="直播">直播</button><button data-newsfilter="鲸鱼">巨鲸</button><button data-newsfilter="机构">主力</button><button data-newsfilter="监管">监管</button><button data-newsfilter="市场">市场</button><button data-newsfilter="技术">技术</button><button data-newsfilter="BTC">BTC</button><button data-newsfilter="ETH">ETH</button>
      <span class="spacer"></span><span class="news-source-note-v12">真实 RSS</span><label><input id="importantOnly" type="checkbox"/> 只看重要</label><button class="settingsbtn" id="refreshNewsBtn">刷新资讯</button>
    </div>
    <div class="news-timeline" id="newsList"></div>
  </section>
</div>`}
function installMarket(){const market=$('marketPage');if(!market)return;market.innerHTML=marketNewsMarkup();market.addEventListener('click',e=>{const f=e.target.closest('[data-newsfilter]');if(f){newsFilter=f.dataset.newsfilter;$$('[data-newsfilter]').forEach(x=>x.classList.toggle('active',x===f));renderNews();return}if(e.target.closest('#refreshNewsBtn')||e.target.closest('#newsRetryBtn')){loadRealNews(true);return}const v=e.target.closest('[data-newsvote]');if(v)voteNews(v.dataset.newsid,v.dataset.newsvote)});$('importantOnly')?.addEventListener('change',renderNews)}
function setOverallState(state,text){const el=$('newsSourceState'),t=$('newsSourceStateText');if(!el||!t)return;el.className='news-source-state '+(state||'');t.textContent=text}
function renderSourceStrip(){const box=$('newsSourceStrip');if(!box)return;box.innerHTML=FEEDS.map(s=>{const st=sourceState[s.name]||'idle',cls=st==='live'?'live':st==='fallback'?'fallback':'',label=st==='live'?'在线':st==='fallback'?'备用':st==='error'?'失败':'等待';return`<span class="news-source-chip ${cls}"><i></i><b>${s.name}</b><span>${label}</span></span>`}).join('')}
function readCache(){try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(!c||!Array.isArray(c.items)||!c.items.length)return null;if(Date.now()-Number(c.savedAt||0)>CACHE_MAX_AGE)return null;return c}catch{return null}}
function writeCache(items){try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),items:items.slice(0,80)}))}catch{}}
function applyCache(){const c=readCache();if(!c)return false;newsItems=c.items;usingCache=true;setOverallState('cached',`显示缓存资讯 · ${new Date(c.savedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`);renderNews();return true}
function voteInfo(id,title){const voteMap=JSON.parse(localStorage.getItem('greedbit_news_votes')||'{}'),seed=newsHash(title),userVote=voteMap[id]||null;return{bull:24+(seed%210)+(userVote==='bull'?1:0),bear:18+((seed>>>8)%190)+(userVote==='bear'?1:0),userVote}}
function normalizeItem(raw,source){const title=stripHtml(raw.title||''),desc=stripHtml(raw.description||raw.content||'').slice(0,420),link=String(raw.link||raw.guid||'').trim(),pub=Date.parse(raw.pubDate||raw.published||raw.date||'')||Date.now(),id=`${source.name}-${newsHash(link||title)}`,meta=inferNewsMeta(title+' '+desc);return{id,time:new Date(pub).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),publishedAt:pub,source:source.name,link,title,desc,...meta,...voteInfo(id,title)}}
function parseXml(xml,source){const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.querySelector('parsererror'))throw new Error('RSS parse error');const nodes=[...doc.querySelectorAll('item')];if(!nodes.length)throw new Error('RSS has no items');return nodes.slice(0,60).map(it=>normalizeItem({title:it.querySelector('title')?.textContent||'',description:it.querySelector('description')?.textContent||'',link:it.querySelector('link')?.textContent||'',pubDate:it.querySelector('pubDate')?.textContent||''},source)).filter(x=>x.title)}
async function fetchText(url,timeout=4200){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.text()}finally{clearTimeout(timer)}}
async function fetchJson(url,timeout=4200){const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}}
async function fetchFeed(source){
  const direct=source.url,proxied='https://proxy.cors.dev/'+source.url,allOrigins='https://api.allorigins.win/raw?url='+encodeURIComponent(source.url),rss2json='https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(source.url);
  const xmlRoute=url=>parseXml.bind(null);
  try{return await Promise.any([fetchText(direct).then(x=>parseXml(x,source)),fetchText(proxied).then(x=>parseXml(x,source))])}catch{}
  try{return await Promise.any([fetchText(allOrigins).then(x=>parseXml(x,source)),fetchJson(rss2json).then(j=>{if(j.status!=='ok'||!Array.isArray(j.items)||!j.items.length)throw new Error(j.message||'rss2json failed');return j.items.map(x=>normalizeItem(x,source))})])}catch(e){throw e}
}

const previousRenderNews=renderNews;
renderNews=function(){const list=$('newsList');if(!list)return;if(!newsItems.length){list.innerHTML=`<div class="news-empty-pro"><b>${newsLoading?'正在连接新闻源':'新闻源暂不可用'}</b><p>${newsLoading?'正在尝试 CoinDesk 官方 RSS、浏览器 CORS 通道与财经备用源。':'所有实时新闻通道当前均未返回内容。你可以重新尝试；交易与实时行情不受影响。'}</p>${newsLoading?'':'<button id="newsRetryBtn">重新连接</button>'}</div>`;return}previousRenderNews();if(usingCache){list.insertAdjacentHTML('afterbegin','<div class="news-cache-note"><b>离线缓存</b> 当前显示上次成功加载的新闻，后台会继续尝试更新。</div>')}};

loadRealNews=async function(showToast=false){
  if(newsLoading)return;if(!showToast&&newsItems.length&&Date.now()-lastSuccessfulFetch<AUTO_REFRESH)return;
  newsLoading=true;usingCache=false;setOverallState('','正在连接新闻源…');sourceState={};renderSourceStrip();if(!newsItems.length)renderNews();
  try{
    const results=[];
    const primary=FEEDS.filter(x=>!x.fallback);const settled=await Promise.allSettled(primary.map(fetchFeed));
    settled.forEach((r,i)=>{const src=primary[i];if(r.status==='fulfilled'&&r.value.length){sourceState[src.name]='live';results.push(...r.value)}else sourceState[src.name]='error'});
    if(!results.length){const fallback=FEEDS.find(x=>x.fallback);try{const items=await fetchFeed(fallback);sourceState[fallback.name]='fallback';results.push(...items)}catch{sourceState[fallback.name]='error'}}else sourceState['CNBC Top News']='fallback';
    if(!results.length)throw new Error('all news feeds unavailable');
    const unique=new Map();for(const n of results.sort((a,b)=>b.publishedAt-a.publishedAt))if(!unique.has(n.id))unique.set(n.id,n);newsItems=[...unique.values()].slice(0,80);writeCache(newsItems);lastSuccessfulFetch=Date.now();const liveNames=Object.entries(sourceState).filter(([,v])=>v==='live').map(([k])=>k);setOverallState('ok',`已连接 ${liveNames.join(' + ')||'财经备用源'}`);if(showToast)notify('资讯已刷新',`已加载 ${newsItems.length} 条真实新闻`,'success')
  }catch(e){console.warn('news load failed',e);if(!applyCache()){newsItems=[];setOverallState('error','新闻源连接失败')}if(showToast)notify('资讯刷新失败',usingCache?'已回退到本地缓存':'CoinDesk 与财经备用源当前均不可用','error',5000)}finally{newsLoading=false;renderSourceStrip();renderNews();if(user?.isAdmin)renderAdminPage()}
};

installCss();installMarket();renderSourceStrip();if(!newsItems.length)applyCache();renderNews();newsLoading=false;setTimeout(()=>loadRealNews(false),300);setTimeout(()=>{if(!lastSuccessfulFetch)loadRealNews(false)},5200);
})();
