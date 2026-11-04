/* Trading experience: favorites picker and PnL-aware notifications. Chart renderer owns overlays. */
(function(){
'use strict';
const V=window.GreedBitV13;if(!V)throw new Error('market/model.js must load before ui/trading-experience.js');
const FAV_KEY='greedbit_pair_favorites_v14';
let pickerMode='favorites';

function installStyle(){if(document.querySelector('link[href^="styles/v014.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=cssHref('styles/v014.css');document.head.appendChild(l)}

/* ---------- notification profit/loss colors ---------- */
function appendColoredMessage(parent,text){
  const s=String(text??''),re=/([+\-]\s*\d[\d,]*(?:\.\d+)?(?:\s*(?:USDT|CNY|BTC|ETH|SOL|DOGE|BNB|FIL|TRX|ZEC|BTW|GREED|%))?)/gi;
  let last=0,m;
  while((m=re.exec(s))){
    if(m.index>last)parent.appendChild(document.createTextNode(s.slice(last,m.index)));
    const token=m[0],span=document.createElement('span'),n=Number(token.replace(/[^+\-\d.]/g,'').replace(/(?!^)[+\-]/g,''));
    span.className=n>0?'notice-pnl-pos':n<0?'notice-pnl-neg':'notice-pnl-zero';span.textContent=token;parent.appendChild(span);last=re.lastIndex;
  }
  if(last<s.length)parent.appendChild(document.createTextNode(s.slice(last)));
}
notify=function(title,msg='',type='success',ttl=3200){
  const n=document.createElement('div');n.className='notice-pop '+type;
  const close=document.createElement('button');close.className='x';close.textContent='×';
  const b=document.createElement('b');b.textContent=String(title??'');
  const p=document.createElement('p');appendColoredMessage(p,msg);
  n.append(close,b,p);$('notifications').prepend(n);const rm=()=>n.remove();close.onclick=rm;if(ttl)setTimeout(rm,ttl);
};

/* ---------- picker favorites + futures / spot tabs ---------- */
function readFavorites(){try{return new Set(JSON.parse(localStorage.getItem(FAV_KEY)||'[]'))}catch{return new Set()}}
function saveFavorites(set){localStorage.setItem(FAV_KEY,JSON.stringify([...set]))}
function favId(market,sym){return`${market}|${sym}`}
function toggleFav(market,sym){const set=readFavorites(),id=favId(market,sym);set.has(id)?set.delete(id):set.add(id);saveFavorites(set)}
function pickerAssets(){
  const q=($('coinSearch')?.value||'').trim().toUpperCase(),all=V.ASSETS||[];
  if(pickerMode==='favorites'){
    const fav=readFavorites(),rows=[];for(const a of all){for(const market of ['futures','spot']){if(fav.has(favId(market,a.symbol)))rows.push({a,market})}}
    return rows.filter(({a})=>(a.symbol+' '+a.ticker+' '+a.name).toUpperCase().includes(q));
  }
  const market=pickerMode==='spot'?'spot':'futures';return all.filter(a=>(a.symbol+' '+a.ticker+' '+a.name).toUpperCase().includes(q)).map(a=>({a,market}));
}
function renderPickerTabs(){
  const tabs=document.querySelector('.coin-tabs');if(!tabs)return;tabs.innerHTML=`<button data-picker-mode="favorites" class="${pickerMode==='favorites'?'active':''}">自选</button><button data-picker-mode="futures" class="${pickerMode==='futures'?'active':''}">永续合约</button><button data-picker-mode="spot" class="${pickerMode==='spot'?'active':''}">现货</button><span class="coin-picker-mode-note-v14">${pickerMode==='favorites'?'收藏的交易':'点击 ☆ 收藏'}</span>`;
}
renderCoinList=function(){
  const box=$('coinList');if(!box)return;renderPickerTabs();const head=document.querySelector('.coin-list-head');if(head?.children?.[0])head.children[0].textContent=pickerMode==='spot'?'币种':pickerMode==='favorites'?'自选交易':'合约';
  const rows=pickerAssets();if(!rows.length){box.innerHTML=`<div class="coin-picker-empty-v14"><b>${pickerMode==='favorites'?'暂无自选交易':'没有匹配结果'}</b>${pickerMode==='favorites'?'在“永续合约”或“现货”中点击交易前的 ☆ 即可收藏。':'请尝试其他关键词。'}</div>`;return}
  const fav=readFavorites();box.innerHTML=rows.map(({a,market})=>{const m=marketSnapshots[a.symbol]||{},last=+m.last||0,ch=+m.change||0,id=favId(market,a.symbol),on=fav.has(id),title=market==='spot'?a.ticker:a.symbol,sub=market==='spot'?a.name:`${a.name} · 永续`,active=a.symbol===symbol&&((market==='spot'&&tradingMode==='spot')||(market==='futures'&&tradingMode==='futures'));
    return`<div class="coin-row ${active?'active':''}" data-symbol="${a.symbol}" data-market="${market}" tabindex="0"><div class="coin-name-v14"><button class="coin-star-v14 ${on?'on':''}" data-fav-symbol="${a.symbol}" data-fav-market="${market}" title="${on?'取消收藏':'加入自选'}" aria-label="${on?'取消收藏':'收藏'} ${title}">${on?'★':'☆'}</button><div class="coin-main-v14"><img class="coin-icon-img" src="${a.iconPath}" alt="${a.ticker}"/><span class="coin-text-v14"><b>${title}${market==='futures'?'<em class="coin-market-badge-v14">永续</em>':''}</b><small>${sub}</small></span></div></div><span>${last?fmt(last,a.dec):'--'}</span><span class="${ch>0?'green':ch<0?'red':'muted'}">${last?(ch>=0?'+':'')+ch.toFixed(2)+'%':'--'}</span></div>`}).join('');
};
function installPicker(){
  const tabs=document.querySelector('.coin-tabs'),list=$('coinList');if(!tabs||!list)return;
  tabs.onclick=e=>{const b=e.target.closest('[data-picker-mode]');if(!b)return;pickerMode=b.dataset.pickerMode;renderCoinList()};
  list.onclick=async e=>{const star=e.target.closest('[data-fav-symbol]');if(star){e.preventDefault();e.stopPropagation();toggleFav(star.dataset.favMarket,star.dataset.favSymbol);renderCoinList();return}const row=e.target.closest('[data-symbol][data-market]');if(!row)return;await setSymbol(row.dataset.symbol);showPage(row.dataset.market==='spot'?'trade':'futures');$('coinPicker')?.classList.add('hidden')};
  list.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('coin-row')){e.preventDefault();e.target.click()}};
  if($('coinSearch'))$('coinSearch').oninput=renderCoinList;renderCoinList();
}

function boot(){installStyle();installPicker();draw();setTimeout(()=>{renderCoinList();draw()},120)}
boot();
window.GreedBitTradingExperience={renderCoinList};
})();
