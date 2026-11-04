'use strict';
/* Single version source; tools/check-version.mjs keeps it in sync with VERSION/README/index.html. */
window.GB_VERSION='0.1.0';
/* Append the build id to dynamically injected stylesheets so a deploy cannot keep stale CSS. */
/* Periodic task helper: skips work while the tab is hidden. */
function every(a,b){let ms=b,fn=a;if(typeof a!=='function'){ms=a;fn=b}return setInterval(()=>{if(typeof document!=='undefined'&&document.hidden)return;fn()},ms)}
function cssHref(path){return path+'?build='+(window.GreedBitBootstrap?.build||window.GB_VERSION||'0026')}
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('chart'),ctx=canvas.getContext('2d');
/* localStorage is user-writable: a single corrupted key must never break the whole runtime. */
function safeParse(raw,fallback){try{const v=JSON.parse(raw);return v==null?fallback:v}catch{return fallback}}

const configs={
  'BTC/USDT':{anchor:0,vol:.0002,dec:2,icon:'₿',color:'#f39b46'},
  'ETH/USDT':{anchor:0,vol:.0003,dec:2,icon:'◆',color:'#687ef2'}
};
const timeframes=[
  {label:'分时',key:'time',sec:60,api:'1m'},
  {label:'1分钟',key:'1m',sec:60,api:'1m'},
  {label:'3分钟',key:'3m',sec:180,api:'3m'},
  {label:'5分钟',key:'5m',sec:300,api:'5m'},
  {label:'10分钟',key:'10m',sec:600,api:'5m',aggregate:600},
  {label:'15分钟',key:'15m',sec:900,api:'15m'},
  {label:'30分钟',key:'30m',sec:1800,api:'30m'},
  {label:'1小时',key:'1h',sec:3600,api:'1h'},
  {label:'2小时',key:'2h',sec:7200,api:'2h'},
  {label:'4小时',key:'4h',sec:14400,api:'4h'},
  {label:'8小时',key:'8h',sec:28800,api:'8h'},
  {label:'1日',key:'1d',sec:86400,api:'1d'},
  {label:'3日',key:'3d',sec:259200,api:'3d'},
  {label:'1周',key:'1w',sec:604800,api:'1w'},
  {label:'1月',key:'1M',sec:2592000,api:'1M',calendarMonth:true}
];
const API_HOSTS=['https://data-api.binance.vision','https://api-gcp.binance.com','https://api1.binance.com','https://api2.binance.com','https://api3.binance.com','https://api4.binance.com','https://api.binance.com'];
const WS_HOSTS=['wss://data-stream.binance.vision:443','wss://stream.binance.com:443'];
const fmt=(n,d=2)=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FEE=.0002,SPOT_FEE=.001,MMR=.005,FUNDING_INTERVAL=8*3600;
const walletNames={spot:'现货',futures:'合约',earn:'赚币',fiat:'法币',strategy:'策略'};
const coinKeys=['BTC','ETH'];

const chartDefaults={
  bull:'#3dbb83',bear:'#ec5d68',body:true,border:true,wick:true,
  precision:'auto',timezone:'utc8',statusTitle:true,statusValues:true,statusChange:true,statusVolume:true,
  indicatorTitle:true,indicatorValues:true,symbolLabel:true,countdown:true,highLow:true,markers:true,
  dateFormat:'ymd',timeFormat:'24',background:'#0b0e12',grid:'#1d232b',crosshair:true,
  topMargin:12,bottomMargin:8,rightBars:4
};
let chartSettings={...chartDefaults,...safeParse(localStorage.getItem('greedbit_chart_settings'),{})};

let currentPage='futures',tradingMode='futures',assetTab='overview';
let symbol='BTC/USDT',cfg=configs[symbol],price=cfg.anchor,tfKey='5m',tf=300;
let candles=[],current=null,visibleCount=72,viewShift=0,yZoom=1,yPan=0,hoverIndex=-1,hoverPrice=null,dragging=false,dragX=0,dragY=0,dragShift=0,dragYPan=0,dragRange=1,crosshairLocked=false,lockedCrosshair=null,contextPrice=null,contextIndex=null;
let positions=[],orders=[],closeOrders=[],orderHistory=[],trades=[],closedPositions=[],ledger=[];
let spotOrders=[],spotOrderHistory=[],spotTrades=[];
let nextId=1,tableMode='positions',posFilter='all',orderType='market',spotOrderType='market',spotSide='buy',leverage=10,levDraft=10;
let wallets=freshWallets(),accountStats=freshStats(),authMode='login',user=null,fundMode='deposit';
let fundingRate=.0001,nextFunding=Math.floor(Date.now()/1000/FUNDING_INTERVAL+1)*FUNDING_INTERVAL;
let newsItems=[],newsSeq=1,newsFilter='all',activeImpacts=[];
let marketSnapshots={},latestTicker={},audioCtx=null;
let marketSocket=null,marketSocketRetry=null,marketSocketHostIndex=0,marketLoadSeq=0,depthLoadSeq=0,marketReady=false,historyLoading=false,historyExhausted=false;

function freshWallets(){
  return {
    spot:{usdt:0,frozenUsdt:0,coins:{BTC:0,ETH:0},frozenCoins:{BTC:0,ETH:0},cost:{BTC:0,ETH:0}},
    futures:{usdt:0,frozen:0},
    earn:{usdt:0},
    fiat:{usdt:0},
    strategy:{usdt:0}
  };
}
function freshStats(){return{inflow:0,outflow:0,realizedProfit:0,realizedLoss:0,fees:0,fundingReceived:0,fundingPaid:0,liquidations:0,trades:0,spotTrades:0,transfers:0}}
function base(){return symbol.split('/')[0]}
function apiSymbol(sym=symbol){return sym.replace('/','')}
function tfInfo(key=tfKey){return timeframes.find(x=>x.key===key)||timeframes.find(x=>x.key==='5m')}
function nowText(){return new Date().toLocaleTimeString()}
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function futuresWallet(){return wallets.futures}
function spotWallet(){return wallets.spot}
function walletUsdt(key){return key==='spot'?wallets.spot.usdt:key==='futures'?wallets.futures.usdt:wallets[key].usdt}
function setWalletUsdt(key,v){if(key==='spot')wallets.spot.usdt=v;else if(key==='futures')wallets.futures.usdt=v;else wallets[key].usdt=v}
function notify(title,msg='',type='success',ttl=3200){
  const n=document.createElement('div');n.className='notice-pop '+type;
  n.innerHTML=`<button class="x">×</button><b>${title}</b><p>${msg}</p>`;$('notifications').prepend(n);
  const rm=()=>n.remove();n.querySelector('.x').onclick=rm;if(ttl)setTimeout(rm,ttl);
}
function ensureAudio(){if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(AC)audioCtx=new AC()}if(audioCtx?.state==='suspended')audioCtx.resume()}
function playFillSound(){
  ensureAudio();if(!audioCtx)return;
  const t=audioCtx.currentTime;
  [0,0.075].forEach((dt,i)=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(i?1175:880,t+dt);g.gain.setValueAtTime(.0001,t+dt);g.gain.exponentialRampToValueAtTime(.12,t+dt+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dt+.12);o.connect(g);g.connect(audioCtx.destination);o.start(t+dt);o.stop(t+dt+.13)});
}
document.addEventListener('pointerdown',ensureAudio,{once:true});

function stateKey(){return user?`greedbit_state_${user.username}`:null}
function stateRevKey(){return user?`greedbit_state_rev_${user.username}`:null}
/* Multi-tab safety: every save bumps a revision stored next to the snapshot.
 * A tab that is behind refuses to write and reloads the newer state instead of silently
 * overwriting the other tab's trades (the old behaviour caused double-spend and lost fills). */
let stateRev=0,stateConflictTimer=0,stateQuotaWarned=false;
function readStoredRev(){try{return Number(localStorage.getItem(stateRevKey()))||0}catch{return 0}}
function flagStateConflict(){
  if(stateConflictTimer)return;
  stateConflictTimer=setTimeout(()=>{
    stateConflictTimer=0;
    if(!user)return;
    if(readStoredRev()>stateRev){
      loadState();syncAuth();
      notify('账户已在其他标签页更新','本页未保存的修改已丢弃，并重新加载了最新状态','error',6000);
    }
  },50);
}
function ensureStateFresh(){
  if(!user)return true;
  if(readStoredRev()>stateRev){
    loadState();syncAuth();
    notify('账户已在其他标签页更新','已重新加载最新状态，请重试本次操作','warning',5000);
    return false;
  }
  return true;
}
function saveState(){
  if(!user)return false;
  if(readStoredRev()>stateRev){flagStateConflict();return false}
  /* Bound the append-only history arrays so localStorage cannot grow without limit. */
  const MAX_HISTORY=500;
  if(orderHistory.length>MAX_HISTORY)orderHistory=orderHistory.slice(0,MAX_HISTORY);
  if(trades.length>MAX_HISTORY)trades=trades.slice(0,MAX_HISTORY);
  if(closedPositions.length>MAX_HISTORY)closedPositions=closedPositions.slice(0,MAX_HISTORY);
  if(spotTrades.length>MAX_HISTORY)spotTrades=spotTrades.slice(0,MAX_HISTORY);
  if(spotOrderHistory.length>MAX_HISTORY)spotOrderHistory=spotOrderHistory.slice(0,MAX_HISTORY);
  stateRev++;
  try{
    localStorage.setItem(stateKey(),JSON.stringify({wallets,accountStats,positions,orders,closeOrders,orderHistory,trades,closedPositions,ledger,spotOrders,spotOrderHistory,spotTrades,nextId,rev:stateRev}));
    localStorage.setItem(stateRevKey(),String(stateRev));
  }catch(e){
    if(!stateQuotaWarned){stateQuotaWarned=true;try{notify('本地存储已满','状态未能保存，请清理浏览器数据后重试','error',6000)}catch{}}
    return false;
  }
  return true;
}
function loadState(){
  if(!user)return;
  const raw=localStorage.getItem(stateKey());
  if(!raw){wallets=freshWallets();accountStats=freshStats();positions=[];orders=[];closeOrders=[];orderHistory=[];trades=[];closedPositions=[];ledger=[];spotOrders=[];spotOrderHistory=[];spotTrades=[];nextId=1;stateRev=readStoredRev();return}
  try{
    const s=JSON.parse(raw);
    if(s.wallets)wallets=s.wallets;
    else if(s.account){
      wallets=freshWallets();wallets.fiat.usdt=0;wallets.futures.usdt=s.account.usdt||0;wallets.futures.frozen=s.account.frozen||0;
    }else wallets=freshWallets();
    const fresh=freshWallets();
    wallets.spot={...fresh.spot,...(wallets.spot||{})};
    wallets.spot.coins={...fresh.spot.coins,...(wallets.spot.coins||{})};
    wallets.spot.frozenCoins={...fresh.spot.frozenCoins,...(wallets.spot.frozenCoins||{})};
    wallets.spot.cost={...fresh.spot.cost,...(wallets.spot.cost||{})};
    wallets.futures={...fresh.futures,...(wallets.futures||{})};
    for(const k of ['earn','fiat','strategy'])wallets[k]={...fresh[k],...(wallets[k]||{})};
    accountStats={...freshStats(),...(s.accountStats||{})};
    positions=window.GreedBitPositionBook?.normalize(s.positions||[])||(s.positions||[]);orders=s.orders||[];closeOrders=s.closeOrders||[];orderHistory=s.orderHistory||[];trades=s.trades||[];closedPositions=s.closedPositions||[];ledger=s.ledger||[];
    spotOrders=s.spotOrders||[];spotOrderHistory=s.spotOrderHistory||[];spotTrades=s.spotTrades||[];nextId=Number.isFinite(+s.nextId)&&+s.nextId>0?+s.nextId:1;stateRev=Math.max(readStoredRev(),(+s.rev||0));
  }catch{
    /* Corrupted snapshot: drop every per-account array, not just the wallets,
     * otherwise the previous account's positions leak into the next login. */
    wallets=freshWallets();positions=[];orders=[];closeOrders=[];orderHistory=[];trades=[];closedPositions=[];ledger=[];spotOrders=[];spotOrderHistory=[];spotTrades=[];nextId=1;stateRev=readStoredRev();
  }
}
function addLedger(type,amount,sym='',note='',wallet='futures'){ledger.unshift({time:nowText(),type,symbol:sym,amount,wallet,note});ledger=ledger.slice(0,600)}

function loadAuth(){user=safeParse(localStorage.getItem('greedbit_session'),null);if(user)loadState();syncAuth()}
/* Another tab saved: refresh this tab's view (never write back from here). */
window.addEventListener('storage',e=>{
  if(!user)return;
  if(e.key!==stateKey()&&e.key!==stateRevKey())return;
  if(readStoredRev()>stateRev){loadState();syncAuth()}
});
function newSalt(){
  try{const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')}
  catch{return Math.random().toString(36).slice(2)+Date.now().toString(36)}
}
/* Admin is a local development switch, not a password: open the page with ?admin=1. */
function isAdminMode(){
  try{if(new URLSearchParams(location.search).get('admin')==='1')sessionStorage.setItem('greedbit_admin','1')}catch{}
  try{return sessionStorage.getItem('greedbit_admin')==='1'}catch{return false}
}
function hashPass(pass,salt,iter){const h=window.GreedBitHash;return h&&h.hashPassword?h.hashPassword(pass,salt,iter):`${salt}:${pass}`}
function verifyPassword(record,pass){
  if(!record)return false;
  if(record.hash)return hashPass(pass,record.salt||'',record.iter)===record.hash;
  if(typeof record.password==='string')return record.password===pass; /* legacy plaintext record */
  return false;
}
function upgradeUserRecord(users,name,pass){
  const rec=users[name];if(!rec)return;
  if(rec.hash&&rec.password===undefined)return;
  const salt=rec.salt||newSalt();
  users[name]={username:name,salt,hash:rec.hash||hashPass(pass,salt,rec.iter),iter:rec.iter||window.GreedBitHash?.DEFAULT_ITERATIONS||800,createdAt:rec.createdAt||Date.now()};
  try{localStorage.setItem('greedbit_users',JSON.stringify(users))}catch{}
}
function syncAuth(){
  const yes=!!user,isAdmin=yes&&isAdminMode();$('authbar').style.display=yes?'none':'flex';$('userchip').classList.toggle('show',yes);$('usernameTop').textContent=yes?user.username:'';
  $('adminNav').classList.toggle('hidden',!isAdmin);
  if(!isAdmin&&currentPage==='admin')showPage('home');
  $('loggedTrade').classList.toggle('hidden',!yes);$('tradeLoginBtn').classList.toggle('hidden',yes);$('spotLogged').classList.toggle('hidden',!yes);$('spotLoginBtn').classList.toggle('hidden',yes);$('assetLogged').classList.toggle('hidden',!yes);$('assetLogin').classList.toggle('hidden',yes);
  renderTable();updateAssets();renderAssetPage();if(isAdmin)renderAdminPage();
}
function openAuth(mode){authMode=mode;$('authModal').classList.add('show');$('authInput').value='';$('passInput').value='';syncAuthModal()}
function syncAuthModal(){const reg=authMode==='register';$('authTitle').textContent=reg?'欢迎注册 GreedBit':'欢迎登录 GreedBit';$('authLabel').textContent=reg?'请输入用户名或邮箱':'请输入您的账号';$('switchText').textContent=reg?'已有账号？':'新用户？';$('switchMode').textContent=reg?'登录':'注册';$('authSubmit').textContent=reg?'创建模拟账户':'登录'}
function submitAuth(){
  const name=$('authInput').value.trim(),pass=$('passInput').value;
  if(!name||pass.length<4)return notify('登录失败','账号不能为空，密码至少 4 位','error');
  if(name.toLowerCase()==='admin')return notify('登录失败','admin 为开发模式保留名，请用 ?admin=1 打开管理界面','error');
  const users=safeParse(localStorage.getItem('greedbit_users'),{});
  if(authMode==='register'){
    if(users[name])return notify('注册失败','该账号已存在');
    const salt=newSalt();
    users[name]={username:name,salt,hash:hashPass(pass,salt),iter:window.GreedBitHash?.DEFAULT_ITERATIONS||800,createdAt:Date.now()};
    try{localStorage.setItem('greedbit_users',JSON.stringify(users))}catch{return notify('注册失败','本地存储写入失败','error')}
    user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));wallets=freshWallets();accountStats=freshStats();saveState();notify('注册成功','初始资产为 0 USDT，请通过入金获得模拟资金');
  }else{
    if(!users[name]||!verifyPassword(users[name],pass))return notify('登录失败','账号或密码错误','error');
    upgradeUserRecord(users,name,pass);
    user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));loadState();notify('登录成功',`欢迎回来，${name}`);
  }
  $('authModal').classList.remove('show');syncAuth();
}
