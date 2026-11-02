
/* v0.0.10 contract overview/data/strategy/advanced-order/recent-trade additions */
(function waitV010(){
if(typeof drawTradeMarkers!=='function'){setTimeout(waitV010,50);return;}
(()=>{
'use strict';

const FUTURES_API='https://fapi.binance.com';
const FUTURES_WS='wss://fstream.binance.com/ws';
const meta={
  'BTC/USDT':{
    code:'BTC',name:'Bitcoin',launch:'2009-01-03',rank:'#1',
    supply:'çº¦ 1990 ä¸‡ BTC',maxSupply:'2100 ä¸‡ BTC',intro:'æ¯”ç‰¹å¸æ˜¯ä¸€ç§ç‚¹å¯¹ç‚¹ç”µå­çŽ°é‡‘ç³»ç»Ÿï¼Œä¹Ÿæ˜¯ç›®å‰å¸‚å€¼æœ€å¤§çš„åŠ å¯†èµ„äº§ã€‚å…¶å…±è¯†æœºåˆ¶é‡‡ç”¨å·¥ä½œé‡è¯æ˜Žï¼Œä¾›åº”ä¸Šé™ä¸º 2100 ä¸‡æžšã€‚',
    site:'https://bitcoin.org/', explorer:'https://mempool.space/', github:'https://github.com/bitcoin/bitcoin'
  },
  'ETH/USDT':{
    code:'ETH',name:'Ethereum',launch:'2015-07-30',rank:'#2',
    supply:'çº¦ 1.207 äº¿ ETH',maxSupply:'æ— å›ºå®šä¸Šé™',intro:'ä»¥å¤ªåŠæ˜¯æ”¯æŒæ™ºèƒ½åˆçº¦å’ŒåŽ»ä¸­å¿ƒåŒ–åº”ç”¨çš„å¯ç¼–ç¨‹åŒºå—é“¾ç½‘ç»œã€‚ETH ç”¨äºŽæ”¯ä»˜ç½‘ç»œæ‰‹ç»­è´¹ã€è´¨æŠ¼å’Œåè®®å†…ä»·å€¼ç»“ç®—ã€‚',
    site:'https://ethereum.org/', explorer:'https://etherscan.io/', github:'https://github.com/ethereum'
  }
};

let contractPanelMode='chart';
let analyticsPeriod='15m';
let analyticsBusy=false;
let recentTrades=[],futuresTradeSocket=null,recentTradeView='book';
let advancedKind=null,advancedOrders=[];
let strategyRecords=[];

function v10Key(name){return `greedbit_v010_${name}_${user?.username||'guest'}`}
function loadV10State(){
  try{advancedOrders=JSON.parse(localStorage.getItem(v10Key('advanced'))||'[]')}catch{advancedOrders=[]}
  try{strategyRecords=JSON.parse(localStorage.getItem(v10Key('strategies'))||'[]')}catch{strategyRecords=[]}
}
function saveV10State(){
  localStorage.setItem(v10Key('advanced'),JSON.stringify(advancedOrders.slice(0,100)));
  localStorage.setItem(v10Key('strategies'),JSON.stringify(strategyRecords.slice(0,100)));
}
async function fapi(path){
  const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);
  try{
    const r=await fetch(FUTURES_API+path,{signal:c.signal,cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }finally{clearTimeout(t)}
}
function n(v){const x=Number(v);return Number.isFinite(x)?x:0}
function pct(v,d=2){return `${(n(v)*100).toFixed(d)}%`}
function shortNum(v){
  v=n(v);const a=Math.abs(v);
  if(a>=1e9)return (v/1e9).toFixed(2)+'B';
  if(a>=1e6)return (v/1e6).toFixed(2)+'M';
  if(a>=1e3)return (v/1e3).toFixed(2)+'K';
  return v.toFixed(2)
}
function timeLabel(ms){const d=new Date(ms);return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function htmlEsc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* ---------- inject DOM ---------- */
if(!document.querySelector('link[href="styles/v010.css"]')){
  const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v010.css';document.head.appendChild(l);
}
document.querySelector('.statusbar .ticker.up')?.replaceChildren(document.createTextNode('GreedBit v0.0.10'));

const chartPanel=document.querySelector('.chartpanel');
if(chartPanel && !$('contractInfoPanel')){
  chartPanel.insertAdjacentHTML('beforeend',`
    <div class="contract-info hidden" id="contractInfoPanel"></div>
  `);
}
const orderbook=document.querySelector('.orderbook');
if(orderbook && !$('recentTrades')){
  const head=orderbook.querySelector('.panelhead');
  head.innerHTML='<button class="book-tab active" data-booktab="book">ç›˜å£</button><button class="book-tab" data-booktab="trades">å®žæ—¶æˆäº¤</button>';
  orderbook.insertAdjacentHTML('beforeend','<div id="recentTrades" class="recent-trades hidden"></div>');
}
const tradeTabs=document.querySelector('.tradebox .tabs');
if(tradeTabs){
  const btns=tradeTabs.querySelectorAll('button');
  if(btns[1])btns[1].id='strategyTradeTab';
}
if(!$('strategyPanel')){
  $('futuresPanel')?.insertAdjacentHTML('afterend',`
  <div class="form hidden" id="strategyPanel">
    <div class="strategy-grid-list">
      <button class="strategy-card" data-strategy="spot-grid"><span class="strategy-icon">âŒ</span><div><b>çŽ°è´§ç½‘æ ¼</b><p>éœ‡è¡è¡Œæƒ… / ä½Žä¹°é«˜å– / ç‰›ç†Šçš†å®œ</p></div></button>
      <button class="strategy-card" data-strategy="futures-grid"><span class="strategy-icon">â–£</span><div><b>åˆçº¦ç½‘æ ¼ <em>NEW</em></b><p>å¾ªçŽ¯å¥—åˆ© / å¯åŠ æ æ† / æ”¾å¤§æ”¶ç›Š</p></div></button>
      <button class="strategy-card" data-strategy="martingale"><span class="strategy-icon">â—‡</span><div><b>åˆçº¦é©¬ä¸æ ¼å°” <em>NEW</em></b><p>åˆ†æ‰¹åŠ ä»“ / å‡ä»·å›žå½’ / é«˜é£Žé™©</p></div></button>
    </div>
    <div class="strategy-running">
      <h4>æˆ‘çš„ç­–ç•¥</h4>
      <div id="strategyList"></div>
    </div>
  </div>`);
}
const maker=document.querySelector('.maker-label');
if(maker){
  maker.outerHTML=`<button class="advanced-order-open" id="advancedOrderBtn">é«˜çº§å§”æ‰˜âŒ„</button>
  <div class="advanced-order-menu hidden" id="advancedOrderMenu">
    <button data-advkind="plan">è®¡åˆ’</button><button data-advkind="trailing">è·Ÿè¸ª</button><button data-advkind="twap">åˆ†æ—¶</button>
  </div>`;
}
if(!$('advancedOrderFields')){
  $('limitPriceField')?.insertAdjacentHTML('beforebegin',`
    <div id="advancedOrderFields" class="advanced-order-fields hidden">
      <div class="advanced-kind-title"><b id="advancedKindTitle">é«˜çº§å§”æ‰˜</b><button id="advancedKindClear">æ¢å¤æ™®é€šå§”æ‰˜</button></div>
      <div class="field hidden" id="planTriggerField"><label>è§¦å‘ä»·</label><input id="planTriggerInput" type="number" min="0" step="any"/><span>USDT</span></div>
      <div class="field hidden" id="trailActivationField"><label>æ¿€æ´»ä»·</label><input id="trailActivationInput" type="number" min="0" step="any" placeholder="å¯é€‰"/><span>USDT</span></div>
      <div class="field hidden" id="trailCallbackField"><label>å›žè°ƒçŽ‡</label><input id="trailCallbackInput" type="number" min="0.1" max="20" step="0.1" value="1"/><span>%</span></div>
      <div class="field hidden" id="twapDurationField"><label>æ—¶é•¿</label><input id="twapDurationInput" type="number" min="1" step="1" value="10"/><span>åˆ†é’Ÿ</span></div>
      <div class="field hidden" id="twapSlicesField"><label>æ‹†å•</label><input id="twapSlicesInput" type="number" min="2" max="50" step="1" value="5"/><span>ä»½</span></div>
    </div>`);
}
if(!$('strategyModal')){
  document.body.insertAdjacentHTML('beforeend',`
  <div class="modal" id="strategyModal"><div class="card dark-card strategy-modal-card">
    <button class="close dark-close" data-close="strategyModal">Ã—</button><h2 id="strategyModalTitle">åˆ›å»ºç­–ç•¥</h2>
    <p class="muted">å½“å‰ç‰ˆæœ¬è®°å½•ç­–ç•¥é…ç½®å¹¶ä½¿ç”¨çœŸå®žå¸‚åœºä»·æ ¼ä¼°å€¼ï¼›è‡ªåŠ¨ç½‘æ ¼æˆäº¤å¼•æ“Žä»å¤„äºŽæœ¬åœ°æµ‹è¯•é˜¶æ®µã€‚</p>
    <div class="field modal-field"><label>æŠ•å…¥</label><input id="strategyAmount" type="number" min="1" step="1" value="1000"/><span>USDT</span></div>
    <div class="field modal-field"><label>ä¸‹é™</label><input id="strategyLow" type="number" min="0" step="any"/><span>USDT</span></div>
    <div class="field modal-field"><label>ä¸Šé™</label><input id="strategyHigh" type="number" min="0" step="any"/><span>USDT</span></div>
    <div class="field modal-field"><label>ç½‘æ ¼æ•°</label><input id="strategyGrids" type="number" min="2" max="100" step="1" value="10"/><span>æ ¼</span></div>
    <div class="modal-actions"><button class="ghostbtn" data-close="strategyModal">å–æ¶ˆ</button><button class="confirm²È="26:Ã¢ÒŸžöGš‚ðœ°™ÕÑÕÉ•ÌµÉ¥œèŸ–B#žê›žöGš‚ðœ°µ…ÉÑ¥¹…±”œèŸ–B#žê›¦¦³’âš‚ó–ÂPôì(€€ ÍÑÉ…Ñ•å5½‘…°œ¤¹‘…Ñ…Í•Ð¹­¥¹õ­¥¹ì ÍÑÉ…Ñ•å5½‘…±Q¥Ñ±”œ¤¹Ñ•áÑ½¹Ñ•¹ÐôŸ–"o–îè€œ­¹…µ•Ím­¥¹‘tì(€€ ÍÑÉ…Ñ•å1½Üœ¤¹Ù…±Õ”ô¡ÁÉ¥”¨¸äØ¤¹Ñ½¥á•¡™œ¹‘•Œ¤ì ÍÑÉ…Ñ•å!¥ œ¤¹Ù…±Õ”ô¡ÁÉ¥”¨Ä¸ÀÐ¤¹Ñ½¥á•¡™œ¹‘•Œ¤ì ÍÑÉ…Ñ•å5½‘…°œ¤¹±…ÍÍ1¥ÍÐ¹…‘ Í¡½Üœ¤ì)ôì( ÍÑÉ…Ñ•åÉ•…Ñ•	Ñ¸œ¤¹½¹±¥¬ô ¤ôùì(€¥˜ …ÕÍ•È¥É•ÑÕÉ¸½Á•¹ÕÑ  ±½¥¸œ¤ì(€½¹ÍÐ…µ½Õ¹Ðô¬ ÍÑÉ…Ñ•åµ½Õ¹Ðœ¤¹Ù…±Õ”±±½Üô¬ ÍÑÉ…Ñ•å1½Üœ¤¹Ù…±Õ”±¡¥ ô¬ ÍÑÉ…Ñ•å!¥ œ¤¹Ù…±Õ”±É¥‘Ìô¬ ÍÑÉ…Ñ•åÉ¥‘Ìœ¤¹Ù…±Õ”±­¥¹ô ÍÑÉ…Ñ•å5½‘…°œ¤¹‘…Ñ…Í•Ð¹­¥¹ì(€¥˜ ……µ½Õ¹Ññð…±½Ýñð…¡¥¡ññ±½Üøõ¡¥¡ññÉ¥‘ÌðÈ¥É•ÑÕÉ¸¹½Ñ¥™ä Ÿž¶[žV—–"o–îë–’Ç¢Ò”œ°Ÿ¢¾ßšŽš~—–>šVÀœ°•ÉÉ½Èœ¤ì(€½¹ÍÐ¹…µ•ÌõìÍÁ½ÐµÉ¥œèŸž:Ã¢ÒŸžöGš‚ðœ°™ÕÑÕÉ•ÌµÉ¥œèŸ–B#žê›žöGš‚ðœ°µ…ÉÑ¥¹…±”œèŸ–B#žê›¦¦³’âš‚ó–ÂPôì(€ÍÑÉ…Ñ•åI•½É‘Ì¹Õ¹Í¡¥™Ð¡í­¥¹±¹…µ”é¹…µ•Ím­¥¹‘t±Íåµ‰½°±…µ½Õ¹Ð±±½Ü±¡¥ ±É¥‘Ì±É•…Ñ•‘Ðé…Ñ”¹¹½Ü ¥ô¤íÍ…Ù•XÄÁMÑ…Ñ” ¤ì ÍÑÉ…Ñ•å5½‘…°œ¤¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” Í¡½Üœ¤íÉ•¹‘•ÉMÑÉ…Ñ•¥•Ì ¤í¹½Ñ¥™ä Ÿž¶[žV—¦7žö»–ÞË–"o–îèœ°Ÿ–öO–&7’âëšr³–rÃš¢‡š.¦7žö¸œ°¥¹™¼œ¤ì)ôì((¼¨€´´´´´´´´´´…‘Ù…¹•½É‘•Èµ½‘•Ì€´´´´´´´´´´€¨¼)™Õ¹Ñ¥½¸É•¹‘•É‘Ù…¹•‘¥•±‘Ì ¥ì(€½¹ÍÐ½¸ô„……‘Ù…¹•‘-¥¹ì …‘Ù…¹•‘=É‘•É¥•±‘Ìœ¤¹±…ÍÍ1¥ÍÐ¹Ñ½±” ¡¥‘‘•¸œ°…½¸¤ì(€lÁ±…¹QÉ¥•É¥•±œ°ÑÉ…¥±Ñ¥Ù…Ñ¥½¹¥•±œ°ÑÉ…¥±…±±‰…­¥•±œ°ÑÝ…ÁÕÉ…Ñ¥½¹¥•±œ°ÑÝ…ÁM±¥•Í¥•±t¹™½É… ¡¥ôø¡¥¤¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¤¤ì(€¥˜ …½¸¥É•ÑÕÉ¸ì(€½¹ÍÐµ…ÀõíÁ±…¸élÁ±…¹QÉ¥•É¥•±t±ÑÉ…¥±¥¹œélÑÉ…¥±Ñ¥Ù…Ñ¥½¹¥•±œ°ÑÉ…¥±…±±‰…­¥•±t±ÑÝ…ÀélÑÝ…ÁÕÉ…Ñ¥½¹¥•±œ°ÑÝ…ÁM±¥•Í¥•±uôì(€€¡µ…Ám…‘Ù…¹•‘-¥¹‘uññmt¤¹™½É… ¡¥ôø¡¥¤¹±…ÍÍ1¥ÍÐ¹É•µ½Ù” ¡¥‘‘•¸œ¤¤ì(€€ …‘Ù…¹•‘-¥¹‘Q¥Ñ±”œ¤¹Ñ•áÑ½¹Ñ•¹ÐõíÁ±…¸èŸ¢º‡–"K–žSš&`œ±ÑÉ…¥±¥¹œèŸ¢Þ¢â«–žSš&`œ±ÑÝ…ÀèŸ–"š^Û–žSš&`õm…‘Ù…¹•‘-¥¹‘tì)ô( …‘Ù…¹•‘=É‘•É	Ñ¸œ¤¹½¹±¥¬õ”ôùí”¹ÍÑ½ÁAÉ½Á……Ñ¥½¸ ¤ì …‘Ù…¹•‘=É‘•É5•¹Ôœ¤¹±…ÍÍ1¥ÍÐ¹Ñ½±” ¡¥‘‘•¸œ¥ôì( …‘Ù…¹•‘=É‘•É5•¹Ôœ¤¹½¹±¥¬õ”ôùí½¹ÍÐˆõ”¹Ñ…É•Ð¹±½Í•ÍÐ m‘…Ñ„µ…‘Ù­¥¹‘tœ¤í¥˜ …ˆ¥É•ÑÕÉ¸í…‘Ù…¹•‘-¥¹õˆ¹‘…Ñ…Í•Ð¹…‘Ù­¥¹ì …‘Ù…¹•‘=É‘•É5•¹Ôœ¤¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¤íÉ•¹‘•É‘Ù…¹•‘¥•±‘Ì ¥ôì( …‘Ù…¹•‘-¥¹‘±•…Èœ¤¹½¹±¥¬ô ¤ôùí…‘Ù…¹•‘-¥¹õ¹Õ±°íÉ•¹‘•É‘Ù…¹•‘¥•±‘Ì ¥ôì)‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±”ôùí¥˜ „ …‘Ù…¹•‘=É‘•É5•¹Ôœ¤¹½¹Ñ…¥¹Ì¡”¹Ñ…É•Ð¤˜™”¹Ñ…É•Ð„ôô …‘Ù…¹•‘=É‘•É	Ñ¸œ¤¤ …‘Ù…¹•‘=É‘•É5•¹Ôœ¤¹±…ÍÍ1¥ÍÐ¹…‘ ¡¥‘‘•¸œ¥ô¤ì()™Õ¹Ñ¥½¸É•Í•ÉÙ•‘Ù…¹•¡Í¥‘”¥ì(€¥˜ …ÕÍ•È¥É•ÑÕÉ¸½Á•¹ÕÑ  ±½¥¸œ¤ì(€½¹ÍÐµ…É¥¸ô¬ µ…É¥¹%¹ÁÕÐœ¤¹Ù…±Õ”±µ½‘”ô µ…É¥¹5½‘”œ¤¹Ù…±Õ”±ÑÀô ÑÁÍ±¹…‰±”œ¤¹¡•­•ü ¬ ÑÁ%¹ÁÕÐœ¤¹Ù…±Õ•ñðÀ¤èÀ±Í°ô ÑÁÍ±¹…‰±”œ¤¹¡•­•ü ¬ Í±%¹ÁÕÐœ¤¹Ù…±Õ•ñðÀ¤èÀì(€¥˜ …µ…É¥¹ññµ…É¥¸ðôÀ¥É•ÑÕÉ¸¹½Ñ¥™ä Ÿ–žSš&c–’Ç¢Ò”œ°Ÿ¢¾ß¢úO–—’þw¢¾¦Dœ°•ÉÉ½Èœ¤ì(€½¹ÍÐÜõ™ÕÑÕÉ•Í]…±±•Ð ¤±™•”õµ…É¥¸©±•Ù•É…”©±Ñ½Ñ…°õµ…É¥¸­™•”í¥˜¡Ñ½Ñ…°ùÜ¹ÕÍ‘Ð¥É•ÑÕÉ¸¹½Ñ¥™ä Ÿ–žSš&c–’Ç¢Ò”œ°Ÿ–B#žê›¢Ò›š"ß’ög¦Šw’â7¢ÚÌœ°•ÉÉ½Èœ¤ì(€½¹ÍÐ¼õí¥é…Ñ”¹¹½Ü ¤­5…Ñ ¹É…¹‘½´ ¤±­¥¹é…‘Ù…¹•‘-¥¹±Í¥‘”±µ…É¥¸±µ½‘”±±•Ù•É…”±ÑÀ±Í°±Íåµ‰½°±É•Í•ÉÙ•éÑ½Ñ…°±É•…Ñ•‘Ðé…Ñ”¹¹½Ü ¤±ÍÑ…ÑÕÌè½Á•¸ôì(€¥˜¡…‘Ù…¹•‘-¥¹ôôôÁ±…¸œ¥í¼¹ÑÉ¥•Èô¬ Á±…¹QÉ¥•É%¹ÁÕÐœ¤¹Ù…±Õ”í¥˜ …¼¹ÑÉ¥•È¥É•ÑÕÉ¸¹½Ñ¥™ä Ÿ–žSš&c–’Ç¢Ò”œ°Ÿ¢¾ß¢úO–—¢ž›–>G’îÜœ°•ÉÉ½Èœ¥ô(€¥˜¡…‘Ù…¹•‘-¥¹ôôôÑÉ…¥±¥¹œœ¥í¼¹…Ñ¥Ù…Ñ¥½¸ô¬ ÑÉ…¥±Ñ¥Ù…Ñ¥½¹%¹ÁÕÐœ¤¹Ù…±Õ•ññ¹Õ±°í¼¹…±±‰…¬õ5…Ñ ¹µ…à ¸ÀÀÄ° ¬ ÑÉ…¥±…±±‰…­%¹ÁÕÐœ¤¹Ù…±Õ•ñðÄ¤¼ÄÀÀ¤í¼¹•áÑÉ•µ”õ¹Õ±°í¼¹…Ñ¥Ù”ô…¼¹…Ñ¥Ù…Ñ¥½¹ô(€¥˜¡…‘Ù…¹•‘-¥¹ôôôÑÝ…Àœ¥í¼¹‘ÕÉ…Ñ¥½¸õ5…Ñ ¹µ…à ØÀ° ¬ ÑÝ…ÁÕÉ…Ñ¥½¹%¹ÁÕÐœ¤¹Ù…±Õ•ñðÄÀ¤¨ØÀ¤í¼¹Í±¥•Ìõ±…µÀ ¬ ÑÝ…ÁM±¥•Í%¹ÁÕÐœ¤¹Ù…±Õ•ñðÔ°È°ÔÀ¤í¼¹‘½¹”ôÀí¼¹¹•áÑQÌõ…Ñ”¹¹½Ü ¤¼ÄÀÀÀí¼¹ÍÑ…ÉÑ•‘Ðõ…Ñ”¹¹½Ü ¤¼ÄÀÀÁô(€Ü¹ÕÍ‘Ð´õÑ½Ñ…°íÜ¹™É½é•¸¬õÑ½Ñ…°í…‘Ù…¹•‘=É‘•ÉÌ¹Õ¹Í¡¥™Ð¡¼¤íÍ…Ù•XÄÁMÑ…Ñ” ¤íÍ…Ù•MÑ…Ñ” ¤í¹½Ñ¥™ä Ÿ¦®cžêŸ–žSš&c–ÞËš>C’êœ±íÁ±…¸èŸ¢º‡–"Hœ±ÑÉ…¥±¥¹œèŸ¢Þ¢â¨œ±ÑÝ…ÀèŸ–"š^Øõm…‘Ù…¹•‘-¥¹‘t¬œƒ
Ü€œ¬¡Í¥‘”ôôô±½¹œœüŸ–ò–’hœèŸ–òž¦èœ¤°¥¹™¼œ¤íÉ•¹‘•ÉQ…‰±” ¤ì)ô)½¹ÍÐ‰…Í•	Õäô ‰Õå	Ñ¸œ¤¹½¹±¥¬±‰…Í•M•±°ô Í•±±	Ñ¸œ¤¹½¹±¥¬ì( ‰Õå	Ñ¸œ¤¹½¹±¥¬ô ¤ôù…‘Ù…¹•‘-¥¹ýÉ•Í•ÉÙ•‘Ù…¹• ±½¹œœ¤é‰…Í•	Õä ¤ì( Í•±±	Ñ¸œ¤¹½¹±¥¬ô ¤ôù…‘Ù…¹•‘-¥¹ýÉ•Í•ÉÙ•‘Ù…¹• Í¡½ÉÐœ¤é‰…Í•M•±° ¤ì()™Õ¹Ñ¥½¸™¥É•‘Ù…¹•¡¼±µ…É¥¸¥ì(€½¹ÍÐÜõ™ÕÑÕÉ•Í]…±±•Ð ¤±Í±¥••”õµ…É¥¸©¼¹±•Ù•É…”©ì(€½¹ÍÐÀõ•á•ÕÑ•=Á•¸¡¼¹Í¥‘”±µ…É¥¸±ÁÉ¥”±¼¹µ½‘”±¼¹±•Ù•É…”±¼¹ÑÀ±¼¹Í°±€‘ííÁ±…¸èŸ¢º‡–"Hœ±ÑÉ…¥±¥¹œèŸ¢Þ¢â¨œ±ÑÝ…ÀèŸ–"š^Øõm¼¹­¥¹‘u÷–ò’îM€±ÑÉÕ”¤ì(€¥˜ …À¥É•ÑÕÉ¸™…±Í”ì(€¼¹É•Í•ÉÙ•õ5…Ñ ¹µ…à À±¼¹É•Í•ÉÙ•´¡µ…É¥¸­Í±¥••”¤¤íÉ•ÑÕÉ¸ÑÉÕ”ì)ô)™Õ¹Ñ¥½¸ÁÉ½•ÍÍ‘Ù…¹•‘=É‘•ÉÌ ¥ì(€½¹ÍÐ¹½Üõ…Ñ”¹¹½Ü ¤¼ÄÀÀÀì(€™½È¡±•Ð¤õ…‘Ù…¹•‘=É‘•ÉÌ¹±•¹Ñ ´Äí¤øôÀí¤´´¥ì(€€€½¹ÍÐ¼õ…‘Ù…¹•‘=É‘•ÉÍm¥tí¥˜¡¼¹Íåµ‰½°„ôõÍåµ‰½±ññ¼¹ÍÑ…ÑÕÌ„ôô½Á•¸œ¥½¹Ñ¥¹Õ”ì(€€€±•Ð‘½¹”õ™…±Í”ì(€€€¥˜¡¼¹­¥¹ôôôÁ±…¸œ¥ì(€€€€€½¹ÍÐ¡¥Ðõ¼¹Í¥‘”ôôô±½¹œœýÁÉ¥”øõ¼¹ÑÉ¥•ÈéÁÉ¥”ðõ¼¹ÑÉ¥•Èí¥˜¡¡¥Ð¥í™¥É•‘Ù…¹•¡¼±¼¹µ…É¥¸¤í‘½¹”õÑÉÕ•ô(€€€õ•±Í”¥˜¡¼¹­¥¹ôôôÑÉ…¥±¥¹œœ¥ì(€€€€€¥˜ …¼¹…Ñ¥Ù”¥í½¹ÍÐ…Ñ¥Ù…Ñ•õ¼¹Í¥‘”ôôô±½¹œœýÁÉ¥”ðõ¼¹…Ñ¥Ù…Ñ¥½¸éÁÉ¥”øõ¼¹…Ñ¥Ù…Ñ¥½¸í¥˜¡…Ñ¥Ù…Ñ•¥í¼¹…Ñ¥Ù”õÑÉÕ”í¼¹•áÑÉ•µ”õÁÉ¥•õô(€€€€€¥˜¡¼¹…Ñ¥Ù”¥í¼¹•áÑÉ•µ”õ¼¹•áÑÉ•µ”ôõ¹Õ±°ýÁÉ¥”è¡¼¹Í¥‘”ôôô±½¹œœý5…Ñ ¹µ¥¸¡¼¹•áÑÉ•µ”±ÁÉ¥”¤é5…Ñ ¹µ…à¡¼¹•áÑÉ•µ”±ÁÉ¥”¤¤í½¹ÍÐ¡¥Ðõ¼¹Í¥‘”ôôô±½¹œœýÁÉ¥”øõ¼¹•áÑÉ•µ”¨ Ä­¼¹…±±‰…¬¤éÁÉ¥”ðõ¼¹•áÑÉ•µ”¨ Äµ¼¹…±±‰…¬¤í¥˜¡¡¥Ð¥í™¥É•‘Ù…¹•¡¼±¼¹µ…É¥¸¤í‘½¹”õÑÉÕ•õô(€€€õ•±Í”¥˜¡¼¹­¥¹ôôôÑÝ…Àœ˜™¹½Üøõ¼¹¹•áÑQÌ˜™¼¹‘½¹”ñ¼¹Í±¥•Ì¥ì(€€€€€½¹ÍÐÉ•µ…¥¹¥¹œõ¼¹Í±¥•Ìµ¼¹‘½¹”±µ…É¥¸õ¼¹µ…É¥¸½¼¹Í±¥•Ìí¥˜¡™¥É•‘Ù…¹•¡¼±µ…É¥¸¤¥í¼¹‘½¹”¬¬í¼¹¹•áÑQÌõ¼¹ÍÑ…ÉÑ•‘Ð­¼¹‘ÕÉ…Ñ¥½¸¨¡¼¹‘½¹”½¼¹Í±¥•Ì¤í¥˜¡¼¹‘½¹”øõ¼¹Í±¥•Ì¥‘½¹”õÑÉÕ•ô(€€€ô(€€€¥˜¡‘½¹”¥í½¹ÍÐÜõ™ÕÑÕÉ•Í]…±±•Ð ¤í¥˜¡¼¹É•Í•ÉÙ•øÀ¥íÜ¹™É½é•¸õ5…Ñ ¹µ…à À±Ü¹™É½é•¸µ¼¹É•Í•ÉÙ•¤íÜ¹ÕÍ‘Ð¬õ¼¹É•Í•ÉÙ•‘õ…‘Ù…¹•‘=É‘•ÉÌ¹ÍÁ±¥”¡¤°Ä¤í¹½Ñ¥™ä Ÿ¦®cžêŸ–žSš&c–º3š"@œ±¼¹Íåµ‰½°°ÍÕ•ÍÌœ¥ô(€ô(€Í…Ù•XÄÁMÑ…Ñ” ¤íÍ…Ù•MÑ…Ñ” ¤ì)ô)½¹ÍÐ½±‘ÁÁ±åI•…±Ñ¥µ•QÉ…‘”õ…ÁÁ±åI•…±Ñ¥µ•QÉ…‘”ì)…ÁÁ±åI•…±Ñ¥µ•QÉ…‘”õ™Õ¹Ñ¥½¸¡À±Ð±Ø¥í½±‘ÁÁ±åI•…±Ñ¥µ•QÉ…‘”¡À±Ð±Ø¤íÁÉ½•ÍÍ‘Ù…¹•‘=É‘•ÉÌ ¥ôì()½¹ÍÐ½±‘I•¹‘•ÉQ…‰±”õÉ•¹‘•ÉQ…‰±”ì)É•¹‘•ÉQ…‰±”õ™Õ¹Ñ¥½¸ ¥ì(€½±‘I•¹‘•ÉQ…‰±” ¤ì(€¥˜¡Ñ…‰±•5½‘”ôôô½Á•¸œ˜™…‘Ù…¹•‘=É‘•ÉÌ¹±•¹Ñ ¥ì(€€€½¹ÍÐ‰½‘äô Ñ‰½‘äœ¤í¥˜¡‰½‘ä¹ÅÕ•ÉåM•±•Ñ½È œ¹•µÁÑäœ¤¥‰½‘ä¹¥¹¹•É!Q50ôœœì(€€€‰½‘ä¹¥¹Í•ÉÑ‘©…•¹Ñ!Q50 ‰•™½É••¹œ±…‘Ù…¹•‘=É‘•ÉÌ¹µ…À¡¼ôù€ñÑÈøñÑø‘í¹•Ü…Ñ”¡¼¹É•…Ñ•‘Ð¤¹Ñ½1½…±•Q¥µ•MÑÉ¥¹œ ¥ôð½ÑøñÑø‘í¼¹Íåµ‰½±ôð½ÑøñÑø‘í¼¹Í¥‘”ôôô±½¹œœüŸ–ò–’hœèŸ–òž¦èôð½ÑøñÑø‘ííÁ±…¸èŸ¢º‡–"Hœ±ÑÉ…¥±¥¹œèŸ¢Þ¢â¨œ±ÑÝ…ÀèŸ–"š^Øõm¼¹­¥¹‘uôð½ÑøñÑø‘í™µÐ¡¼¹µ…É¥¸¥ôð½ÑøñÑø‘í¼¹±•Ù•É…•õ`ð½ÑøñÑøñ‰ÕÑÑ½¸±…ÍÌô‰…¹•°ˆ‘…Ñ„µ…¹•±…‘Øôˆ‘í¼¹¥‘ôˆûšJ“–6Tð½‰ÕÑÑ½¸øð½Ñøð½ÑÈù€¤¹©½¥¸ œœ¤¤ì(€ô)ôì( Ñ‰½‘äœ¤¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È ±¥¬œ±”ôùì(€½¹ÍÐˆõ”¹Ñ…É•Ð¹±½Í•ÍÐ m‘…Ñ„µ…¹•±…‘Ùtœ¤í¥˜ …ˆ¥É•ÑÕÉ¸í½¹ÍÐ¥ô­ˆ¹‘…Ñ…Í•Ð¹…¹•±…‘Ø±¤õ…‘Ù…¹•‘=É‘•ÉÌ¹™¥¹‘%¹‘•à¡àôùà¹¥ôôõ¥¤í¥˜¡¤ðÀ¥É•ÑÕÉ¸í½¹ÍÐ¼õ…‘Ù…¹•‘=É‘•ÉÍm¥t±Üõ™ÕÑÕÉ•Í]…±±•Ð ¤íÜ¹™É½é•¸õ5…Ñ ¹µ…à À±Ü¹™É½é•¸µ¼¹É•Í•ÉÙ•¤íÜ¹ÕÍ‘Ð¬õ¼¹É•Í•ÉÙ•í…‘Ù…¹•‘=É‘•ÉÌ¹ÍÁ±¥”¡¤°Ä¤íÍ…Ù•XÄÁMÑ…Ñ” ¤íÍ…Ù•MÑ…Ñ” ¤íÉ•¹‘•ÉQ…‰±” ¤í¹½Ñ¥™ä Ÿ¦®cžêŸ–žSš&c–ÞËšJ“¦R œ±¼¹Íåµ‰½°°¥¹™¼œ¤ì)ô¤ì((¼¨€´´´´´´´´´´Íåµ‰½°½…ÕÑ ¥¹Ñ•É…Ñ¥½¸€´´´´´´´´´´€¨¼)½¹ÍÐ½±‘M•ÑMåµ‰½°õÍ•ÑMåµ‰½°ì)Í•ÑMåµ‰½°õ…Íå¹Œ™Õ¹Ñ¥½¸¡Íå´¥ì(€½¹ÍÐÈõ…Ý…¥Ð½±‘M•ÑMåµ‰½°¡Íå´¤ì(€¥˜¡½¹ÑÉ…ÑA…¹•±5½‘”ôôô½Ù•ÉÙ¥•Üœ¥É•¹‘•É=Ù•ÉÙ¥•Ü ¤ì(€¥˜¡½¹ÑÉ…ÑA…¹•±5½‘”ôôô‘…Ñ„œ¥É•¹‘•É¹…±åÑ¥Ì ¤ì(€…Ý…¥Ð±½…‘I••¹ÑQÉ…‘•Ì ¤í½¹¹•ÑÕÑÕÉ•ÍQÉ…‘•Ì ¤ì(€É•ÑÕÉ¸Èì)ôì)½¹ÍÐ½±‘Må¹ÕÑ õÍå¹ÕÑ ì)Íå¹ÕÑ õ™Õ¹Ñ¥½¸ ¥í½±‘Må¹ÕÑ  ¤í±½…‘XÄÁMÑ…Ñ” ¤íÉ•¹‘•ÉMÑÉ…Ñ•¥•Ì ¥ôì(()½¹ÍÐ½±‘M¡½ÝA…”õÍ¡½ÝA…”ì)Í¡½ÝA…”õ™Õ¹Ñ¥½¸¡Á…”¥ì(€¥˜¡Á…”ôôôÑÉ…‘”œ˜™½¹ÑÉ…ÑA…¹•±5½‘”„ôô¡…ÉÐœ¥Í¡½Ý½¹ÑÉ…ÑA…¹•° ¡…ÉÐœ¤ì(€½¹ÍÐÈõ½±‘M¡½ÝA…”¡Á…”¤ì(€É•ÑÕÉ¸Èì)ôì)½¹ÍÐ½±‘I•¹‘•ÉQÉ…‘¥¹5½‘”õÉ•¹‘•ÉQÉ…‘¥¹5½‘”ì)É•¹‘•ÉQÉ…‘¥¹5½‘”õ™Õ¹Ñ¥½¸ ¥ì(€½¹ÍÐÈõ½±‘I•¹‘•ÉQÉ…‘¥¹5½‘” ¤ì(€¥˜  ÍÑÉ…Ñ•åA…¹•°œ¤¥Í•ÑQÉ…‘•A…¹•° µ…¹Õ…°œ¤ì(€É•ÑÕÉ¸Èì)ôì((¼¨€´´´´´´´´´´¥¹¥Ñ¥…°€´´´´´´´´´´€¨¼)±½…‘XÄÁMÑ…Ñ” ¤íÉ•¹‘•ÉMÑÉ…Ñ•¥•Ì ¤í±½…‘I••¹ÑQÉ…‘•Ì ¤í½¹¹•ÑÕÑÕÉ•ÍQÉ…‘•Ì ¤ì)ô¤ ¤ì)ô¤ ¤ìì(