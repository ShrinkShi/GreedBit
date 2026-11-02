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
  if(page==='admin'&&!user?.isAdmin)return notify('无权限','仅管理员可访问管理界面','error');
  currentPage=page;$$('.navbtn[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));$('homePage').classList.toggle('hidden',page!=='home');$('marketPage').classList.toggle('hidden',page!=='market');$('tradePage').classList.toggle('hidden',page!=='trade'&&page!=='futures');$('assetsPage').classList.toggle('hidden',page!=='assets');$('adminPage').classList.toggle('hidden',page!=='admin');
  if(page==='trade'||page==='futures'){tradingMode=page==='trade'?'spot':'futures';renderTradingMode();setTimeout(resize,0)}
  if(page==='market')renderNews();if(page==='assets')renderAssetPage();if(page==='admin')renderAdminPage();if(page==='home'){renderHomeMarkets();updateAssets()}
}
function renderTradingMode(){
  const fut=tradingMode==='futures';$('futuresPanel').classList.toggle('hidden',!fut);$('spotPanel').classList.toggle('hidden',fut);$('futuresBottomTabs').classList.toggle('hidden',!fut);$('spotBottomTabs').classList.toggle('hidden',fut);$$('.futures-only').forEach(x=>x.classList.toggle('hidden',!fut));
  tableMode=fut?'positions':'spotAssets';$$('#futuresBottomTabs button,#spotBottomTabs button').forEach(b=>b.classList.toggle('active',b.dataset.table===tableMode));renderTable();updateAssets();draw();
}

/* splitters/chart events */
function setupTimeframes(){
  const gear=`<button class="chart-icon-btn" id="chartSettingsBtn" title="图表设置" aria-label="图表设置"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8 3.8-.1-1.2 2-1.6-2-3.4-2.5 1a8 8 0 0 0-2-1.2L15 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.6L6 12l.1 1.2-2 1.6 2 3.4 2.5-1a8 8 0 0 0 2 1.2L11 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.5 1 2-3.4-2-1.6.1-1.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>`;
  $('timebar').innerHTML=timeframes.map(x=>`<button data-tfkey="${x.key}" class="${x.key===tfKey?'active':''}">${x.label}</button>`).join('')+`<span class="timebar-spacer"></span>${gear}`;
  $('timebar').onclick=async e=>{
    const settings=e.target.closest('#chartSettingsBtn');if(settings){openChartSettings();return}
    const b=e.target.closest('[data-tfkey]');if(!b)return;
    tfKey=b.dataset.tfkey;tf=tfInfo().sec;
    $$('[data-tfkey]').forEach(x=>x.classList.toggle('active',x===b));
    await loadHistoricalMarket(true);
  };
}
function setupSplitters(){const root=document.documentElement;function drag(id,kind){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('dragging');const sx=e.clientX,sy=e.clientY,cs=getComputedStyle(root),book=parseFloat(cs.getPropertyValue('--book-w')),trade=parseFloat(cs.getPropertyValue('--trade-w')),bottom=parseFloat(cs.getPropertyValue('--bottom-h'));const move=ev=>{if(kind==='book')root.style.setProperty('--book-w',clamp(book-(ev.clientX-sx),190,520)+'px');if(kind==='trade')root.style.setProperty('--trade-w',clamp(trade-(ev.clientX-sx),300,620)+'px');if(kind==='bottom')root.style.setProperty('--bottom-h',clamp(bottom-(ev.clientY-sy),140,520)+'px');resize()};const up=()=>{el.classList.remove('dragging');el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up)})}drag('splitChartBook','book');drag('splitBookTrade','trade');drag('splitChartBottom','bottom')}

function saveChartSettings(){localStorage.setItem('greedbit_chart_settings',JSON.stringify(chartSettings));draw()}
function syncChartSettingsForm(){
  const pairs={csBody:'body',csBorder:'border',csWick:'wick',csStatusTitle:'statusTitle',csStatusValues:'statusValues',csStatusChange:'statusChange',csStatusVolume:'statusVolume',csIndicatorTitle:'indicatorTitle',csIndicatorValues:'indicatorValues',csSymbolLabel:'symbolLabel',csCountdown:'countdown',csHighLow:'highLow',csMarkers:'markers',csCrosshair:'crosshair'};
  for(const [id,key] of Object.entries(pairs))$(id).checked=!!chartSettings[key];
  $('csBull').value=chartSettings.bull;$('csBear').value=chartSettings.bear;$('csPrecision').value=String(chartSettings.precision);$('csTimezone').value=chartSettings.timezone;
  $('csDateFormat').value=chartSettings.dateFormat;$('csTimeFormat').value=chartSettings.timeFormat;$('csBackground').value=chartSettings.background;$('csGrid').value=chartSettings.grid;
  $('csTopMargin').value=chartSettings.topMargin;$('csBottomMargin').value=chartSettings.bottomMargin;$('csRightBars').value=chartSettings.rightBars;
}
function readChartSettingsForm(){
  const pairs={csBody:'body',csBorder:'border',csWick:'wick',csStatusTitle:'statusTitle',csStatusValues:'statusValues',csStatusChange:'statusChange',csStatusVolume:'statusVolume',csIndicatorTitle:'indicatorTitle',csIndicatorValues:'indicatorValues',csSymbolLabel:'symbolLabel',csCountdown:'countdown',csHighLow:'highLow',csMarkers:'markers',csCrosshair:'crosshair'};
  for(const [id,key] of Object.entries(pairs))chartSettings[key]=$(id).checked;
  chartSettings.bull=$('csBull').value;chartSettings.bear=$('csBear').value;chartSettings.precision=$('csPrecision').value;chartSettings.timezone=$('csTimezone').value;
  chartSettings.dateFormat=$('csDateFormat').value;chartSettings.timeFormat=$('csTimeFormat').value;chartSettings.background=$('csBackground').value;chartSettings.grid=$('csGrid').value;
  chartSettings.topMargin=Math.max(0,+$('csTopMargin').value||0);chartSettings.bottomMargin=Math.max(0,+$('csBottomMargin').value||0);chartSettings.rightBars=Math.max(0,+$('csRightBars').value||0);
}
function openChartSettings(){
  syncChartSettingsForm();$$('[data-cstab]').forEach((b,i)=>b.classList.toggle('active',i===0));$$('[data-cspanel]').forEach((b,i)=>b.classList.toggle('active',i===0));$('chartSettingsModal').classList.add('show');
}
function resetChartView(){visibleCount=72;viewShift=0;yZoom=1;yPan=0;hoverIndex=-1;hoverPrice=null;crosshairLocked=false;lockedCrosshair=null;draw()}
function chartPriceAtClientY(clientY){
  const r=canvas.getBoundingClientRect(),padT=28,padB=42,plotH=Math.max(1,r.height-padT-padB),{hi,lo}=calcPriceBounds(),y=clamp(clientY-r.top,padT,r.height-padB);
  return hi-(y-padT)/plotH*(hi-lo);
}
function updateOhlcText(c){
  if(!c){$('ohlc').textContent='未来/历史空白区域';return}
  const parts=[];if(chartSettings.statusTitle)parts.push(`${symbol} · ${tfInfo().label}`);
  if(chartSettings.statusValues)parts.push(`O ${fmt(c.o,cfg.dec)}  H ${fmt(c.h,cfg.dec)}  L ${fmt(c.l,cfg.dec)}  C ${fmt(c.c,cfg.dec)}`);
  if(chartSettings.statusChange){const ch=c.c-c.o,pct=c.o?ch/c.o*100:0;parts.push(`${ch>=0?'+':''}${fmt(ch,cfg.dec)} (${pct>=0?'+':''}${pct.toFixed(2)}%)`)}
  if(chartSettings.statusVolume)parts.push(`Vol ${fmt(c.v,2)}`);
  $('ohlc').textContent=parts.join('  ');
}

function setupChartEvents(){
  const scaleValue=(v,f)=>{const n=v*f;return Number.isFinite(n)&&n>0?n:v};
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,priceAxis=x>=r.width-82,timeAxis=y>=r.height-42&&x<r.width-82;
    const factor=Math.exp(e.deltaY*.002);
    if(priceAxis)yZoom=scaleValue(yZoom,factor);
    else if(timeAxis)visibleCount=scaleValue(visibleCount,factor);
    else{visibleCount=scaleValue(visibleCount,factor);yZoom=scaleValue(yZoom,factor)}
    draw();maybeLoadOlderHistory();
  },{passive:false});
  canvas.addEventListener('mousedown',e=>{
    if(e.button!==0)return;dragging=true;dragX=e.clientX;dragY=e.clientY;dragShift=viewShift;dragYPan=yPan;
    const b=calcPriceBounds();dragRange=b.hi-b.lo;
  });
  window.addEventListener('mouseup',()=>dragging=false);
  window.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    if(dragging){
      const plotW=Math.max(1,r.width-90),cw=plotW/visibleCount,dx=e.clientX-dragX,dy=e.clientY-dragY;
      if(Number.isFinite(cw)&&cw!==0)viewShift=dragShift-dx/cw;
      yPan=dragYPan+dy*dragRange/Math.max(80,r.height-70);
      draw();maybeLoadOlderHistory();return;
    }
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    if(crosshairLocked)return;
    const geom=viewGeometry(),plotW=Math.max(1,r.width-90),frac=(e.clientX-r.left-8)/plotW,idx=Math.floor(geom.start+frac*visibleCount);
    hoverIndex=idx;hoverPrice=chartPriceAtClientY(e.clientY);
    const c=idx>=0&&idx<geom.all.length?geom.all[idx]:null;updateOhlcText(c);draw();
  });
  canvas.addEventListener('mouseleave',()=>{if(!crosshairLocked){hoverIndex=-1;hoverPrice=null;$('ohlc').textContent='移动鼠标查看 OHLC';draw()}});
  canvas.addEventListener('dblclick',resetChartView);
  canvas.addEventListener('contextmenu',e=>{
    e.preventDefault();const r=canvas.getBoundingClientRect(),geom=viewGeometry(),plotW=Math.max(1,r.width-90),frac=(e.clientX-r.left-8)/plotW;
    contextIndex=Math.floor(geom.start+frac*visibleCount);contextPrice=chartPriceAtClientY(e.clientY);
    $('contextCopyLabel').textContent=`复制价格 ${fmt(contextPrice,cfg.dec)}`;$('contextLockLabel').textContent=crosshairLocked?'解锁十字光标线':'锁定十字光标线';$('contextMarkerLabel').textContent=chartSettings.markers?'隐藏K线上的标记':'显示K线上的标记';
    const menu=$('chartContextMenu');menu.classList.remove('hidden');menu.style.left=Math.min(innerWidth-290,e.clientX)+'px';menu.style.top=Math.min(innerHeight-360,e.clientY)+'px';
  });
}

/* v0.0.11 brand favicon can be installed without changing index.html */
if(!document.querySelector('link[rel~="icon"]')){const gbIcon=document.createElement('link');gbIcon.rel='icon';gbIcon.type='image/png';gbIcon.href='assets/greedbit-logo.png';document.head.appendChild(gbIcon)}

/* v0.0.11 preload must execute before events.js initializes the market */
if(!window.__greedbitV011PreloadRequested){
  window.__greedbitV011PreloadRequested=true;
  document.write('<script src="src/v011-preload.js"><\/script>');
}

/* v0.0.11 UI enhancements load after the base page and v0.0.9/v0.0.10 extensions */
window.addEventListener('load',()=>{
  if(!document.querySelector('script[src="src/v011.js"]')){
    const ext=document.createElement('script');ext.src='src/v011.js';document.body.appendChild(ext);
  }
});

/* load v0.0.10 extensions; module waits until v0.0.9 chart overrides are ready */
if(!document.querySelector('script[src="src/v010.js"]')){
  const v010Ext=document.createElement('script');v010Ext.src='src/v010.js';document.body.appendChild(v010Ext);
}
