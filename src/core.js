'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('chart'),ctx=canvas.getContext('2d');

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
let chartSettings={...chartDefaults,...JSON.parse(localStorage.getItem('greedbit_chart_settings')||'{}')};

let currentPage='futures',tradingMode='futures',assetTab='overview';
let symbol='BTC/USDT',cfg=configs[symbol],price=cfg.anchor,tfKey='5m',tf=300;
let candles=[],current=null,visibleCount=72,viewShift=0,yZoom=1,yPan=0,hoverIndex=-1,hoverPrice=null,dragging=false,dragX=0,dragY=0,dragShift=0,dragYPan=0,dragRange=1,crosshairLocked=false,lockedCrosshair=null,contextPrice=null,contextIndex=null;
let positions=[],orders=[],orderHistory=[],trades=[],closedPositions=[],ledger=[];
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
function saveState(){
  if(!user)return;
  localStorage.setItem(stateKey(),JSON.stringify({wallets,accountStats,positions,orders,orderHistory,trades,closedPositions,ledger,spotOrders,spotOrderHistory,spotTrades,nextId}));
}
function loadState(){
  if(!user)return;
  const raw=localStorage.getItem(stateKey());
  if(!raw){wallets=freshWallets();accountStats=freshStats();positions=[];orders=[];orderHistory=[];trades=[];closedPositions=[];ledger=[];spotOrders=[];spotOrderHistory=[];spotTrades=[];nextId=1;return}
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
    positions=s.positions||[];orders=s.orders||[];orderHistory=s.orderHistory||[];trades=s.trades||[];closedPositions=s.closedPositions||[];ledger=s.ledger||[];
    spotOrders=s.spotOrders||[];spotOrderHistory=s.spotOrderHistory||[];spotTrades=s.spotTrades||[];nextId=s.nextId||1;
  }catch{wallets=freshWallets()}
}
function addLedger(type,amount,sym='',note='',wallet='futures'){ledger.unshift({time:nowText(),type,symbol:sym,amount,wallet,note});ledger=ledger.slice(0,600)}

function loadAuth(){user=JSON.parse(localStorage.getItem('greedbit_session')||'null');if(user)loadState();syncAuth()}
function syncAuth(){
  const yes=!!user,isAdmin=!!user?.isAdmin;$('authbar').style.display=yes?'none':'flex';$('userchip').classList.toggle('show',yes);$('usernameTop').textContent=yes?user.username:'';
  $('adminNav').classList.toggle('hidden',!isAdmin);
  if(!isAdmin&&currentPage==='admin')showPage('home');
  $('loggedTrade').classList.toggle('hidden',!yes);$('tradeLoginBtn').classList.toggle('hidden',yes);$('spotLogged').classList.toggle('hidden',!yes);$('spotLoginBtn').classList.toggle('hidden',yes);$('assetLogged').classList.toggle('hidden',!yes);$('assetLogin').classList.toggle('hidden',yes);
  renderTable();updateAssets();renderAssetPage();if(isAdmin)renderAdminPage();
}
function openAuth(mode){authMode=mode;$('authModal').classList.add('show');$('authInput').value='';$('passInput').value='';syncAuthModal()}
function syncAuthModal(){const reg=authMode==='register';$('authTitle').textContent=reg?'欢迎注册 GreedBit':'欢迎登录 GreedBit';$('authLabel').textContent=reg?'请输入用户名或邮箱':'请输入您的账号';$('switchText').textContent=reg?'已有账号？':'新用户？';$('switchMode').textContent=reg?'登录':'注册';$('authSubmit').textContent=reg?'创建模拟账户':'登录'}
function submitAuth(){
  const name=$('authInput').value.trim(),pass=$('passInput').value;if(!name||pass.length<4)return notify('登录失败','账号不能为空，密码至少 4 位','error');
  const users=JSON.parse(localStorage.getItem('greedbit_users')||'{}');
  if(authMode==='register'){
    if(name.toLowerCase()==='admin')return notify('注册失败','admin 为保留管理员账号','error');
    if(users[name])return notify('注册失败','该账号已存在');users[name]={username:name,password:pass,createdAt:Date.now()};localStorage.setItem('greedbit_users',JSON.stringify(users));user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));wallets=freshWallets();accountStats=freshStats();saveState();notify('注册成功','初始资产为 0 USDT，请通过入金获得模拟资金');
  }else{
    if(name==='admin'&&pass==='123456'){
      user={username:'admin',isAdmin:true};localStorage.setItem('greedbit_session',JSON.stringify(user));loadState();notify('管理员登录成功','已启用本地管理界面');
    }else{
      if(!users[name]||users[name].password!==pass)return notify('登录失败','账号或密码错误','error');user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));loadState();notify('登录成功',`欢迎回来，${name}`);
    }
  }
  $('authModal').classList.remove('show');syncAuth();
}
