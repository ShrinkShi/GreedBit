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
  if(page==='admin'&&!user?.isAdmin)return notify('æ— æƒé™','ä»…ç®¡ç†å‘˜å¯è®¿é—®ç®¡ç†ç•Œé¢','error');
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
  const gear=`<button class="chart-icon-btn" id="chartSettingsBtn" title="å›¾è¡¨è®¾ç½®" aria-label="å›¾è¡¨è®¾ç½®"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8 3.8-.1-1.2 2-1.6-2-3.4-2.5 1a8 8 0 0 0-2-1.2L15 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.6L6 12l.1 1.2-2 1.6 2 3.4 2.5-1a8 8 0 0 0 2 1.2L11 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.5 1 2-3.4-2-1.6.1-1.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>`;
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
function openChartSettings(){syncChartSettingsForm();$('chartSettingsModal').classList.add('show')}

function resize(){const r=canvas.getboundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function setupChartInteraction(){
  let start=null;canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;isDragging=true;canvas.setPointerCapture(e.pointerId);start={x:e.clientX,Y:e.clientY,shift:viewShift,off:viewPriceOffset};loadMoreHistoryIfNeeded();});
  canvas.addEventListener('pointermove',e=>{
    const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(!isDragging||!start)return dr]Ê
NÂˆÛÛœİİÏSX]›X^
Ø[˜\Ë˜ÛY[ÚYMM
KÚSX]›X^

Ø[˜\Ë˜ÛY[ZYÚL
NØÛÛœİYK˜ÛY[\İ\OYK˜ÛY[K\İ\NÂˆšY]ÔÚY\İ\œÚY
ÙÊİËÓX]›X^
Kš\ÚX›PÛİ[
JNİšY]ÔšXÙSÙ™œÙ]\İ\›Ù™œÙ]YKØÚ
ËÙ\XØ[ØØ[NÂˆ˜]Ê
NÛØY[Ü™R\İÜRY“™YYY

NÂˆJNÂˆÛÛœİ\J
OOÚ\Ñ˜YÙÚ[™ÏY˜[ÙNÜİ\[[NØØ[˜\Ë˜Y]™[\İ[™\Š	ÜÚ[\\	Ë\
NØØ[˜\Ë˜Y]™[\İ[™\Š	ÜÚ[\˜Ø[˜Ù[	Ë\
NÂˆØ[˜\Ë˜Y]™[\İ[™\Š	İÚY[	ËOOÂˆKœ™]™[Y˜][

NØÛÛœİXØ[˜\Ë™Ù]›İ[™[™ĞÛY[™Xİ

KYK˜ÛY[\‹›YOYK˜ÛY[K\‹ÜÏ\‹ÚY\‹šZYÚØÛÛœİÛšXÙP^\Ï^•ËMÛ•[YP^\Ï^O’LÍØÛÛœİ˜XİÜSX]™^
K™[VJ‹ŒMŠNÂˆYŠÛ”šXÙP^\Ê^İ™\XØ[ØØ[OSX]›X^
LKLL‹™\XØ[ØØ[J™˜XİÜŠ_H[ÙHYŠÛ•[YP^\Ê^İš\ÚX›PÛİ[SX]›X^
ŒKš\ÚX›PÛİ[
™˜XİÜŠ_Y[Ù^İš\ÚX›PÛİ[SX]›X^
ŒKš\ÚX›PÛİ[
™˜XİÜŠNİ™\XØ[ØØ[OSX]›X^
LKLL‹™\XØ[ØØ[J™˜XİÜŠ_Y˜]Ê
NÂˆKÜ\ÜÚ]™N™˜[Ù_JNÂˆØ[˜\Ë˜Y]™[\İ[™\Š	Ù›ÛXÚÉË[\ÙY]™[Oœ™\Ù]Ú\šY]Ê
JNÂˆØ[˜\Ë˜Y]™[\İ[™\Š	Û[İ\Ù[[İ™IËOOÚYŠ\Ñ˜YÙÚ[™Ê\™]\›ÚYŠÜ›ÜÜÚZ\“ØÚÙY
\™]\›ØÛÛœİ\œ]š\ÚX›PØ[™\Ê
NÚYŠX\œ‹›[™İ
\™]\›ØÛÛœİXØ[˜\Ë™Ù]›İ[™[™ĞÛY[™Xİ

KİÏSX]›X^
‹ÚYMM
NØÛÛœİOXÛ[\
X]™›ÛÜŠ
K˜ÛY[\‹›YN
KÊİËØ\œ‹›[™İ
JK\œ‹›[™İLJKÏX\œ–ÚWNÉ
	ÛÚÉÊK^ÛÛ[XÈ	Ù›]
Ë›ËÙ™Ë™XÊ_H	Ù›]
ËšÙ™Ë™XÊ_H	Ù›]
Ë›Ù™Ë™XÊ_HÈ	Ù›]
Ë˜ËÙ™Ë™XÊ_X
NßJNØØ[˜\Ë˜Y]™[\İ[™\Š	Û[İ\Ù[X]™IË

OOÚYŠXÜ›ÜÜÚZ\“ØÚÙY
I
	ÛÚÉÊK^ÛÛ[Iùéîùbª:o(9¨!ùkçùç"ÈÒÉßJNÂŸB‚™[˜İ[ÛˆÙ]\˜[™ÙJ
JÂˆ	
	Üİ	ÊK˜Y]™[\İ[™\Š	Ú[œ]	ËOOØÛÛœİJÙK\™Ù]˜[Y_ÙK\™Ù]œİ[KœÙ]›Ü\J	ËK\™Ë\İ	ËŠÙÉIÊ_JNÉ
	Üİ	ÊKœİ[KœÙ]›Ü\J	ËK\™Ë\İ	Ë	Ì	IÊNÂˆ	
	ÜÜİİ	ÊK˜Y]™[\İ[™\Š	Ú[œ]	ËOOØÛÛœİJÙK\™Ù]˜[Y_ÙK\™Ù]œİ[KœÙ]›Ü\J	ËK\™Ë\İ	ËŠÉÉIÊ_JNÉ
	ÜÜİİ	ÊKœİ[KœÙ]›Ü\J	ËK\™Ë\İ	Ë	Ì	IÊNÂŸB‚œÙ]\[YYœ˜[Y\Ê
NÜÙ]\Ú\[\˜Xİ[ÛŠ
NÜÙ]\Ü]\œÊ
NÜÙ]\˜[™ÙJ
NÂ‹ÊˆØYŒŒŒL^[œÚ[ÛœÎÈ[Ù[HØZ]È[[ŒŒHÚ\İ™\œšY\È\™H™XYH
‹ÂšYŠYØİ[Y[œ]Y\TÙ[XİÜŠ	ÜØÜš\ÜÜ˜ÏHœÜ˜ËİŒLšœÈ—IÊJ^ÂˆÛÛœİŒL^YØİ[Y[˜Ü™X]Q[[Y[
	ÜØÜš\	ÊNİŒL^œÜ˜ÏIÜÜ˜ËİŒLšœÉÎÙØİ[Y[˜›ÙK˜\[™Ú[
ŒL^
NÂŸB