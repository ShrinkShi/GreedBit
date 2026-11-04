/* Canonical shared-UI runtime owner. */
let runtimeWaitCount=0;
(function waitRuntime(){
if((!window.GreedBitRuntimeUI&&!window.GreedBitV21)||!window.GreedBitContracts||!document.getElementById('pairName')){
  if(++runtimeWaitCount>200){console.error('[GreedBit] app/runtime 依赖等待超时',{runtimeUI:!!window.GreedBitRuntimeUI,v21:!!window.GreedBitV21,contracts:!!window.GreedBitContracts,pairName:!!document.getElementById('pairName')});return}
  setTimeout(waitRuntime,60);return}
(()=>{
'use strict';
const VERSION=window.GB_VERSION||'0.0.26';
const MANUAL_NEWS_KEY='greedbit_news_manual_original';
let newsPolicyBusy=false,newsPolicyTimer=0;

function isZh(){return !String(document.documentElement.lang||'zh-CN').toLowerCase().startsWith('en')}
function currentSymbol(){try{if(typeof symbol==='string'&&symbol)return symbol}catch{}return document.getElementById('symbol')?.value||''}
function currentMode(){try{if(typeof tradingMode==='string'&&tradingMode)return tradingMode}catch{}return'futures'}
function metaFor(sym){return window.GreedBitV13?.META?.[sym]||null}
function setTextIfChanged(el,value){if(!el)return;const text=String(value??'');if(el.textContent!==text)el.textContent=text}
function desiredPairLabel(){
  const sym=currentSymbol();if(!sym)return'';const mode=currentMode(),m=metaFor(sym),market=m?.market||m?.category||'',code=String(sym).replaceAll('/','');
  if(mode==='futures'&&market!=='commodity'&&market!=='forex')return`${code}永续合约`;
  if(mode==='spot')return m?.ticker||String(sym).split('/')[0];
  if(market==='forex')return m?.ticker||sym;
  return sym;
}
function desiredSourceLabel(){
  const sym=currentSymbol(),mode=currentMode(),m=metaFor(sym),market=m?.market||m?.category||'';if(!sym)return'';
  if(mode==='futures'&&market!=='commodity'&&market!=='forex'){
    const basis=Number(window.GreedBitContracts?.basisPct?.(sym));
    return isZh()?`永续合约模拟价格 · 基差 ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`:`Simulated perpetual price · basis ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`;
  }
  if(market==='stock'&&mode==='spot'){
    let src='';try{src=marketSnapshots?.[sym]?._source||''}catch{}
    return isZh()?`${m?.name||m?.ticker||sym}股票代币现货 · ${src||'参考行情'}`:`${m?.name||m?.ticker||sym} stock token spot · ${src||'reference market data'}`;
  }
  try{return marketSnapshots?.[sym]?._source||(isZh()?'公开市场行情':'Public market data')}catch{return isZh()?'公开市场行情':'Public market data'}
}
function syncPairUi(){
  setTextIfChanged(document.getElementById('pairName'),desiredPairLabel());
  const source=document.querySelector('#lastPrice + .muted.tiny')||document.getElementById('lastPrice')?.parentElement?.querySelector('.muted.tiny');setTextIfChanged(source,desiredSourceLabel());
}
function installEventDrivenPairOwnership(){
  try{const prev=setSymbol;if(!prev.__gbCanonicalPair){const wrapped=async function(){const out=await prev.apply(this,arguments);syncPairUi();return out};wrapped.__gbCanonicalPair=true;setSymbol=wrapped}}catch{}
  try{const prev=showPage;if(!prev.__gbCanonicalPair){const wrapped=function(){const out=prev.apply(this,arguments);syncPairUi();return out};wrapped.__gbCanonicalPair=true;showPage=wrapped}}catch{}
  try{const prev=renderTradingMode;if(!prev.__gbCanonicalPair){const wrapped=function(){const out=prev.apply(this,arguments);syncPairUi();return out};wrapped.__gbCanonicalPair=true;renderTradingMode=wrapped}}catch{}
  document.getElementById('symbol')?.addEventListener('change',()=>queueMicrotask(syncPairUi));
  document.addEventListener('greedbit:market-context-changed',syncPairUi);
}

function readManualNews(){try{return JSON.parse(localStorage.getItem(MANUAL_NEWS_KEY)||'{}')}catch{return{}}}
function saveManualNews(v){try{localStorage.setItem(MANUAL_NEWS_KEY,JSON.stringify(v))}catch{}}
function newsLang(){return isZh()?'zh-CN':'en'}
function newsPrefKey(btn){return`${btn?.dataset?.newsid||''}|${newsLang()}`}
function isPinnedOriginal(btn,prefs=readManualNews()){return!!prefs[newsPrefKey(btn)]}
function rememberManualNewsChoice(e){
  const btn=e.target?.closest?.('[data-news-translate]');if(!btn||!e.isTrusted)return;
  const prefs=readManualNews(),key=newsPrefKey(btn);
  if(btn.dataset.state==='translated')prefs[key]=true;else delete prefs[key];
  saveManualNews(prefs);
}
function waitTranslation(btn,timeout=9000){return new Promise(resolve=>{const start=Date.now(),tick=()=>{if(!document.body.contains(btn)||!btn.disabled||Date.now()-start>=timeout)return resolve();setTimeout(tick,100)};tick()})}
async function applyNewsTranslationPolicy(){
  if(newsPolicyBusy)return;const list=document.getElementById('newsList');if(!list)return;newsPolicyBusy=true;
  try{
    /* Only restore cards the user explicitly pinned back to the original text.
     * Auto-translating every rendered card used to fire ~40 third-party requests per render. */
    const all=[...list.querySelectorAll('[data-news-translate]')];
    for(const btn of all){
      if(!document.body.contains(btn)||btn.disabled)continue;
      const pinned=isPinnedOriginal(btn,readManualNews());
      if(pinned&&btn.dataset.state==='translated'){btn.click();await waitTranslation(btn);await new Promise(r=>setTimeout(r,40))}
    }
  }finally{newsPolicyBusy=false}
}
function scheduleNewsPolicy(delay=140){clearTimeout(newsPolicyTimer);newsPolicyTimer=setTimeout(applyNewsTranslationPolicy,delay)}
function installNewsOwnership(){
  document.addEventListener('click',rememberManualNewsChoice,true);
  try{const prev=renderNews;if(!prev.__gbCanonicalNews){const wrapped=function(){const out=prev.apply(this,arguments);scheduleNewsPolicy();return out};wrapped.__gbCanonicalNews=true;renderNews=wrapped}}catch{}
  new MutationObserver(()=>scheduleNewsPolicy(180)).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  scheduleNewsPolicy(250);
}
function updateVersion(){const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));if(el)el.textContent=`GreedBit v${VERSION}`}
function runtimeAudit(){
  return{
    version:VERSION,
    pairLabelOwner:'app/runtime:event-driven',
    newsTranslationOwner:'app/runtime:user-preference + render/language events',
    legacyVersionScripts:[...document.scripts].map(x=>x.getAttribute('src')||'').filter(x=>/src\/v\d{3}/.test(x)),
    loadedModules:window.GreedBitBootstrap?.modules||[]
  };
}
installEventDrivenPairOwnership();installNewsOwnership();syncPairUi();updateVersion();
window.GreedBitRuntime={VERSION,syncPairUi,applyNewsTranslationPolicy,runtimeAudit};
})();
})();
