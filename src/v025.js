/* v0.0.25 runtime ownership consolidation */
(function waitV025(){
if(!window.GreedBitV21||!document.getElementById('pairName')){setTimeout(waitV025,60);return}
(()=>{
'use strict';
const VERSION='0.0.25';
const MANUAL_NEWS_KEY='greedbit_news_manual_original_v25';
let newsPolicyBusy=false,newsPolicyTimer=0;
const nativeText=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');

function isZh(){return !String(document.documentElement.lang||'zh-CN').toLowerCase().startsWith('en')}
function currentSymbol(){try{if(typeof symbol==='string'&&symbol)return symbol}catch{}return document.getElementById('symbol')?.value||''}
function currentMode(){try{if(typeof tradingMode==='string'&&tradingMode)return tradingMode}catch{}return'futures'}
function metaFor(sym){return window.GreedBitV13?.META?.[sym]||null}
function rawSetText(el,value){if(!el)return;const text=String(value??'');if(nativeText?.set)nativeText.set.call(el,text);else el.textContent=text}
function setTextIfChanged(el,value){if(!el)return;const text=String(value??'');let cur='';try{cur=nativeText?.get?nativeText.get.call(el):el.textContent}catch{}if(cur!==text)rawSetText(el,text)}

function releaseLegacyTextGuards(){
  const source=document.querySelector('#lastPrice + .muted.tiny')||document.getElementById('lastPrice')?.parentElement?.querySelector('.muted.tiny');
  for(const el of [document.getElementById('pairName'),source]){
    if(!el)continue;const own=Object.getOwnPropertyDescriptor(el,'textContent');if(own?.configurable){try{delete el.textContent}catch{}}
  }
  try{delete window.GreedBitPairLabelGuard}catch{}
}
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
    const basis=Number(window.GreedBitV18?.basisPct?.(sym));
    return isZh()?`永续合约模拟价格 · 基差 ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`:`Simulated perpetual price · basis ${Number.isFinite(basis)?`${basis>=0?'+':''}${basis.toFixed(3)}%`:'--'}`;
  }
  if(market==='stock'&&mode==='spot'){
    let src='';try{src=marketSnapshots?.[sym]?._source||''}catch{}
    return isZh()?`${m?.name||m?.ticker||sym}股票代币现货 · ${src||'参考行情'}`:`${m?.name||m?.ticker||sym} stock token spot · ${src||'reference market data'}`;
  }
  try{return marketSnapshots?.[sym]?._source||(isZh()?'公开市场行情':'Public market data')}catch{return isZh()?'公开市场行情':'Public market data'}
}
function syncPairUi(){
  releaseLegacyTextGuards();setTextIfChanged(document.getElementById('pairName'),desiredPairLabel());
  const source=document.querySelector('#lastPrice + .muted.tiny')||document.getElementById('lastPrice')?.parentElement?.querySelector('.muted.tiny');setTextIfChanged(source,desiredSourceLabel());
}

function installEventDrivenPairOwnership(){
  try{const prev=setSymbol;if(!prev.__gb25){const wrapped=async function(){const out=await prev.apply(this,arguments);syncPairUi();return out};wrapped.__gb25=true;setSymbol=wrapped}}catch{}
  try{const prev=showPage;if(!prev.__gb25){const wrapped=function(){const out=prev.apply(this,arguments);syncPairUi();return out};wrapped.__gb25=true;showPage=wrapped}}catch{}
  try{const prev=renderTradingMode;if(!prev.__gb25){const wrapped=function(){const out=prev.apply(this,arguments);syncPairUi();return out};wrapped.__gb25=true;renderTradingMode=wrapped}}catch{}
  try{const prev=stats;if(!prev.__gb25){const wrapped=function(){const out=prev.apply(this,arguments);syncPairUi();return out};wrapped.__gb25=true;stats=wrapped}}catch{}
  document.getElementById('symbol')?.addEventListener('change',()=>queueMicrotask(syncPairUi));
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
  if(newsPolicyBusy)return;const list=document.getElementById('newsList');if(!list)return;const prefs=readManualNews();
  const buttons=[...list.querySelectorAll('[data-news-translate]')].filter(b=>!b.disabled&&b.dataset.state!=='translated'&&!isPinnedOriginal(b,prefs));if(!buttons.length)return;
  newsPolicyBusy=true;
  try{for(const btn of buttons.slice(0,20)){if(!document.body.contains(btn)||btn.disabled||isPinnedOriginal(btn,readManualNews()))continue;btn.click();await waitTranslation(btn);await new Promise(r=>setTimeout(r,60))}}
  finally{newsPolicyBusy=false}
}
function scheduleNewsPolicy(delay=140){clearTimeout(newsPolicyTimer);newsPolicyTimer=setTimeout(applyNewsTranslationPolicy,delay)}
function installNewsOwnership(){
  document.addEventListener('click',rememberManualNewsChoice,true);
  try{const prev=renderNews;if(!prev.__gb25){const wrapped=function(){const out=prev.apply(this,arguments);scheduleNewsPolicy();return out};wrapped.__gb25=true;renderNews=wrapped}}catch{}
  const langObserver=new MutationObserver(()=>scheduleNewsPolicy(180));langObserver.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  scheduleNewsPolicy(250);
}

function updateVersion(){const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));if(el)el.textContent=`GreedBit v${VERSION}`}
function runtimeAudit(){
  const source=document.querySelector('#lastPrice + .muted.tiny')||document.getElementById('lastPrice')?.parentElement?.querySelector('.muted.tiny');
  return{
    version:VERSION,
    pairLabelOwner:'v025:event-driven',
    newsTranslationOwner:'v025:user-preference + render/language events',
    pairOwnTextDescriptor:!!Object.getOwnPropertyDescriptor(document.getElementById('pairName')||{},'textContent'),
    sourceOwnTextDescriptor:!!Object.getOwnPropertyDescriptor(source||{},'textContent'),
    legacyGate:window.GreedBitLegacyGate?.audit||null,
    pairGuardPresent:!!window.GreedBitPairLabelGuard
  };
}

releaseLegacyTextGuards();installEventDrivenPairOwnership();installNewsOwnership();syncPairUi();updateVersion();
window.GreedBitV25={VERSION,syncPairUi,applyNewsTranslationPolicy,runtimeAudit};
window.GreedBitRuntime=window.GreedBitV25;
})();
})();
