/* leverage */
function openLeverage(){levDraft=leverage;$('levRange').value=levDraft;updateLevModal();$('leverageModal').classList.add('show')}
function updateLevModal(){levDraft=clamp(Math.round(levDraft),1,200);$('levRange').value=levDraft;$('levDraftText').textContent=levDraft+'X';$('levLimit').textContent=fmt(300000000/levDraft,4)+' USDT';$('levMaxOpen').textContent=fmt(futuresWallet().usdt*levDraft,4)+' USDT';$('levRange').style.setProperty('--lev-pct',((levDraft-1)/199*100).toFixed(3)+'%')}

/* picker/home/pages */
function renderCoinList(){
  const q=($('coinSearch').value||'').toUpperCase();$('coinList').innerHTML=Object.entries(configs).filter(([s])=>s.includes(q)).map(([s,c])=>{const m=marketSnapshots[s]||{last:c.anchor,change:0};return`<div class="coin-row ${s===symbol?'active':''}" data-symbol="${s}"><div class="coin-name"><span class="coin-icon" style="background:${c.color}">${c.icon}</span>${s.replace('/','')}</div><span>${fmt(m.last,c.dec)}</span><span class="${m.change>=0?'green':'red'}">${m.change>=0?'+':''}${m.change.toFixed(2)}%</span></div>`}).join('');
}
function renderHomeMarkets(){$('homeMarkets').innerHTML=Object.entries(configs).map(([s,c])=>{const m=marketSnapshots[s];return`<div class="home-market-row"><b>${s}</b><span>${fmt(m.last,c.dec)}</span><span class="${m.change>=0?'green':'red'}">${m.change>=0?'+':''}${m.change.toFixed(2)}%</span></div>`}).join('')}
async function setSymbol(sym){
  if(!configs[sym]||sym===symbol){$('coinPicker').classList.add('hidden');return}
  symbol=sym;cfg=configs[sym];$('symbol').value=sym;$('pairName').textContent=sym;price=marketSnapshots[sym]?.last||cfg.anchor;
  $('limitPriceInput').value='';$('spotLimitInput').value='';$('coinPicker').classList.add('hidden');
  await loadHistoricalMarket(true);renderTable();
}
function showPage(page){
  currentPage=page;$$('.navbtn[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('homePage').classList.toggle('hidden',page!=='home');$('marketPage').classList.toggle('hidden',page!=='market');$('tradePage').classList.toggle('hidden',page!=='trade'&&page!=='futures');$('assetsPage').classList.toggle('hidden',page!=='assets');
  if(page==='trade'||page==='futures'){tradingMode=page==='trade'?'spot':'futures';renderTradingMode();setTimeout(resize,0)}
  if(page==='market')renderNews();if(page==='assets')renderAssetPage();if(page==='home'){renderHomeMarkets();updateAssets()}
}
function renderTradingMode(){
  const fut=tradingMode==='futures';$('futuresPanel').classList.toggle('hidden',!fut);$('spotPanel').classList.toggle('hidden',fut);$('futuresBottomTabs').classList.toggle('hidden',!fut);$('spotBottomTabs').classList.toggle('hidden',fut);$$('.futures-only').forEach(x=>x.classList.toggle('hidden',!fut));
  tableMode=fut?'positions':'spotAssets';$$('#futuresBottomTabs button,#spotBottomTabs button').forEach(b=>b.classList.toggle('active',b.dataset.table===tableMode));renderTable();updateAssets();draw();
}

/* splitters/chart events */
function setupTimeframes(){
  $('timebar').innerHTML=timeframes.map(x=>`<button data-tfkey="${x.key}" class="${x.key===tfKey?'active':''}">${x.label}</button>`).join('');
  $('timebar').onclick=async e=>{
    const b=e.target.closest('[data-tfkey]');if(!b)return;
    tfKey=b.dataset.tfkey;tf=tfInfo().sec;
    $$('[data-tfkey]').forEach(x=>x.classList.toggle('active',x===b));
    await loadHistoricalMarket(true);
  };
}
function setupSplitters(){const root=document.documentElement;function drag(id,kind){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('dragging');const sx=e.clientX,sy=e.clientY,cs=getComputedStyle(root),book=parseFloat(cs.getPropertyValue('--book-w')),trade=parseFloat(cs.getPropertyValue('--trade-w')),bottom=parseFloat(cs.getPropertyValue('--bottom-h'));const move=ev=>{if(kind==='book')root.style.setProperty('--book-w',clamp(book-(ev.clientX-sx),190,520)+'px');if(kind==='trade')root.style.setProperty('--trade-w',clamp(trade-(ev.clientX-sx),300,620)+'px');if(kind==='bottom')root.style.setProperty('--bottom-h',clamp(bottom-(ev.clientY-sy),140,520)+'px');resize()};const up=()=>{el.classList.remove('dragging');el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)})}drag('splitChartBook','book');drag('splitBookTrade','trade');drag('splitChartBottom','bottom')}
function setupChartEvents(){
  const scaleValue=(v,f)=>{const n=v*f;return Number.isFinite(n)&&n>0?n:v};
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,priceAxis=x>r.width-82,timeAxis=y>r.height-38;
    const factor=Math.exp(e.deltaY*.002);
    if(priceAxis)yZoom=scaleValue(yZoom,factor);
    else if(timeAxis||!e.shiftKey)visibleCount=scaleValue(visibleCount,factor);
    else yZoom=scaleValue(yZoom,factor);
    draw();maybeLoadOlderHistory();
  },{passive:false});
  canvas.addEventListener('mousedown',e=>{
    dragging=true;dragX=e.clientX;dragY=e.clientY;dragShift=viewShift;dragYPan=yPan;
    const b=calcPriceBounds();dragRange=b.hi-b.lo;
  });
  window.addEventListener('mouseup',()=>dragging=false);
  window.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    if(dragging){
      const plotW=Math.max(1,r.width-90),cw=plotW/visibleCount,dx=e.clientX-dragX,dy=e.clientY-dragY;
      if(Number.isFinite(cw)&&cw!==0)viewShift=dragShift-dx/cw;
      yPan=dragYPan+dy*dragRange/Math.max(80,r.height-66);
      draw();maybeLoadOlderHistory();return;
    }
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    const geom=viewGeometry(),plotW=Math.max(1,r.width-90),frac=(e.clientX-r.left-8)/plotW,idx=Math.floor(geom.start+frac*visibleCount);
    hoverIndex=idx;
    const c=idx>=0&&idx<geom.all.length?geom.all[idx]:null;
    $('ohlc').textContent=c?`O ${fmt(c.o,cfg.dec)}  H ${fmt(c.h,cfg.dec)}  L ${fmt(c.l,cfg.dec)}  C ${fmt(c.c,cfg.dec)}`:'未来/历史空白区域';
    draw();
  });
  canvas.addEventListener('mouseleave',()=>{hoverIndex=-1;$('ohlc').textContent='移动鼠标查看 OHLC';draw()});
  canvas.addEventListener('dblclick',()=>{visibleCount=72;viewShift=0;yZoom=1;yPan=0;draw()});
}
