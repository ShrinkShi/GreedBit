'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const canvas=$('chart'),ctx=canvas.getContext('2d');
const configs={
  'BTC/USDT':{anchor:68420,vol:.00055,dec:2,icon:'₿',color:'#f39b46'},
  'ETH/USDT':{anchor:3520,vol:.00075,dec:2,icon:'◆',color:'#687ef2'},
  'SOL/USDT':{anchor:164.2,vol:.0011,dec:3,icon:'S',color:'#7f5af0'},
  'DOGE/USDT':{anchor:.1724,vol:.00145,dec:5,icon:'Ð',color:'#b99a49'}
};
const timeframes=[['分时',20],['1分钟',60],['3分钟',180],['5分钟',300],['10分钟',600],['15分钟',900],['30分钟',1800],['1小时',3600],['2小时',7200],['4小时',14400],['8小时',28800],['1日',86400],['3日',259200],['1周',604800],['1月',2592000]];
const fmt=(n,d=2)=>Number(n||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FEE=.0002,SPOT_FEE=.001,MMR=.005,FUNDING_INTERVAL=8*3600;
const walletNames={spot:'现货',futures:'合约',earn:'赚币',fiat:'法币',strategy:'策略'};
const coinKeys=['BTC','ETH','SOL','DOGE'];

let currentPage='futures',tradingMode='futures',assetTab='overview';
let symbol='BTC/USDT',cfg=configs[symbol],price=cfg.anchor,tf=300;
let momentum=0,regime=0,regimeLife=0,ticks=[],candles=[],current=null;
let visibleCount=72,viewShift=0,yZoom=1,yPan=0,hoverIndex=-1,dragging=false,dragX=0,dragY=0,dragShift=0,dragYPan=0,dragRange=1;
let positions=[],orders=[],orderHistory=[],trades=[],closedPositions=[],ledger=[];
let spotOrders=[],spotOrderHistory=[],spotTrades=[];
let nextId=1,tableMode='positions',posFilter='all',orderType='market',spotOrderType='market',spotSide='buy',leverage=10,levDraft=10;
let wallets=freshWallets(),accountStats=freshStats(),authMode='login',user=null,fundMode='deposit';
let fundingRate=.0001,nextFunding=Math.floor(Date.now()/1000/FUNDING_INTERVAL+1)*FUNDING_INTERVAL;
let newsItems=[],activeImpacts=[],newsSeq=1,newsFilter='all';
let marketSnapshots={};
let audioCtx=null;

function freshWallets(){
  return {
    spot:{usdt:0,frozenUsdt:0,coins:{BTC:0,ETH:0,SOL:0,DOGE:0},frozenCoins:{BTC:0,ETH:0,SOL:0,DOGE:0},cost:{BTC:0,ETH:0,SOL:0,DOGE:0}},
    futures:{usdt:0,frozen:0},
    earn:{usdt:0},
    fiat:{usdt:100000},
    strategy:{usdt:0}
  };
}
function freshStats(){return{inflow:0,outflow:0,realizedProfit:0,realizedLoss:0,fees:0,fundingReceived:0,fundingPaid:0,liquidations:0,trades:0,spotTrades:0,transfers:0}}
function base(){return symbol.split('/')[0]}
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
    wallets.spot={...freshWallets().spot,...(wallets.spot||{})};
    wallets.spot.coins={...freshWallets().spot.coins,...(wallets.spot.coins||{})};
    wallets.spot.frozenCoins={...freshWallets().spot.frozenCoins,...(wallets.spot.frozenCoins||{})};
    wallets.spot.cost={...freshWallets().spot.cost,...(wallets.spot.cost||{})};
    wallets.futures={...freshWallets().futures,...(wallets.futures||{})};
    for(const k of ['earn','fiat','strategy'])wallets[k]={...freshWallets()[k],...(wallets[k]||{})};
    accountStats={...freshStats(),...(s.accountStats||{})};
    positions=s.positions||[];orders=s.orders||[];orderHistory=s.orderHistory||[];trades=s.trades||[];closedPositions=s.closedPositions||[];ledger=s.ledger||[];
    spotOrders=s.spotOrders||[];spotOrderHistory=s.spotOrderHistory||[];spotTrades=s.spotTrades||[];nextId=s.nextId||1;
  }catch{wallets=freshWallets()}
}
function addLedger(type,amount,sym='',note='',wallet='futures'){ledger.unshift({time:nowText(),type,symbol:sym,amount,wallet,note});ledger=ledger.slice(0,600)}

function initMarketSnapshots(){
  for(const [sym,c] of Object.entries(configs))marketSnapshots[sym]={last:c.anchor,change:(Math.random()-.45)*2.2};
}
function updateMarketSnapshots(){
  for(const [sym,c] of Object.entries(configs)){
    if(sym===symbol){marketSnapshots[sym].last=price}
    else marketSnapshots[sym].last=Math.max(c.anchor*.05,marketSnapshots[sym].last*Math.exp(randn()*c.vol*.05));
    marketSnapshots[sym].change=clamp(marketSnapshots[sym].change+randn()*.025,-9.99,9.99);
  }
  renderCoinList();renderHomeMarkets();
}
function markFor(sym){return sym===symbol?price:(marketSnapshots[sym]?.last||configs[sym]?.anchor||0)}

function marketImpact(){
  const n=Date.now();activeImpacts=activeImpacts.filter(x=>x.until>n);let drift=0,vol=0;
  for(const x of activeImpacts)if(x.symbol===symbol||x.symbol==='MARKET'){drift+=x.drift;vol+=x.vol}
  return{drift,vol};
}
function makeTick(){
  if(--regimeLife<=0){regimeLife=250+Math.random()*900;regime=randn()*cfg.vol*.025}
  const impact=marketImpact(),shock=Math.random()<.0015?randn()*cfg.vol*3.8:0;
  momentum=.965*momentum+randn()*cfg.vol*.025;
  const pull=(cfg.anchor-price)/cfg.anchor*.000002;
  price=Math.max(cfg.anchor*.03,price*Math.exp(regime+momentum+randn()*cfg.vol*(.11+impact.vol)+shock+pull+impact.drift));
  return price;
}
function pushTick(p,t,v){ticks.push({p,t,v});if(ticks.length>140000)ticks.shift()}
function aggregateTick(x){
  const start=Math.floor(x.t/tf)*tf;
  if(!current||start!==current.t){if(current){current.live=false;candles.push(current)}current={t:start,o:x.p,h:x.p,l:x.p,c:x.p,v:x.v,live:true}}
  else{current.h=Math.max(current.h,x.p);current.l=Math.min(current.l,x.p);current.c=x.p;current.v+=x.v}
  if(candles.length>10000)candles.shift();
}
function rebuildCandles(){candles=[];current=null;for(const x of ticks)aggregateTick(x);viewShift=0;yPan=0;hoverIndex=-1;draw()}
function seed(){
  ticks=[];candles=[];current=null;momentum=0;regimeLife=0;
  const n=Date.now()/1000;let p=cfg.anchor*(.94+Math.random()*.12),hm=0;
  for(let t=n-75*86400;t<n-12*3600;t+=60){hm=.96*hm+randn()*cfg.vol*.035;p=Math.max(cfg.anchor*.05,p*Math.exp(hm+randn()*cfg.vol*.12));pushTick(p,t,.2+Math.random()*3)}
  for(let t=n-12*3600;t<n;t+=10){hm=.95*hm+randn()*cfg.vol*.025;p=Math.max(cfg.anchor*.05,p*Math.exp(hm+randn()*cfg.vol*.1));pushTick(p,t,.2+Math.random()*3)}
  price=p;marketSnapshots[symbol].last=p;rebuildCandles();
}
function currentSeries(){const a=[...candles];if(current)a.push(current);return a}
function viewGeometry(){
  const all=currentSeries(),defaultFuture=4;
  const right=all.length+defaultFuture+viewShift,start=right-visibleCount,slots=[];
  for(let i=0;i<visibleCount;i++){const idx=Math.floor(start+i);slots.push(idx>=0&&idx<all.length?all[idx]:null)}
  return{all,slots,start,right};
}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()}
function formatTime(ts){const d=new Date(ts*1000);if(tf>=86400)return`${d.getMonth()+1}/${d.getDate()}`;return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function candleRemain(){const n=Date.now()/1000,r=Math.max(0,Math.ceil(tf-(n%tf))),h=Math.floor(r/3600),m=Math.floor(r%3600/60),s=r%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function calcPriceBounds(slots){
  const d=slots.filter(Boolean);if(!d.length)return{hi:price*1.01+yPan,lo:price*.99+yPan};
  let hi=Math.max(...d.map(c=>c.h)),lo=Math.min(...d.map(c=>c.l)),rg=(hi-lo)||hi*.01,center=(hi+lo)/2+yPan;
  rg*=1.18*yZoom;return{hi:center+rg/2,lo:center-rg/2};
}
function activeChartOrders(){
  if(tradingMode==='futures')return orders.filter(o=>o.symbol===symbol&&o.status==='open').map(o=>({limit:o.limit,side:o.side==='long'?'buy':'sell',label:`限价 ${o.side==='long'?'开多':'开空'} ${fmt(o.limit,cfg.dec)}`}));
  return spotOrders.filter(o=>o.symbol===symbol&&o.status==='open').map(o=>({limit:o.limit,side:o.side,label:`现货限价 ${o.side==='buy'?'买入':'卖出'} ${fmt(o.limit,cfg.dec)}`}));
}
function draw(){
  if(currentPage!=='trade'&&currentPage!=='futures')return;
  const W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;
  const pad={l:8,r:82,t:28,b:34},plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#0b0e12';ctx.fillRect(0,0,W,H);
  const geom=viewGeometry(),slots=geom.slots,cw=plotW/visibleCount,{hi,lo}=calcPriceBounds(slots),y=p=>pad.t+(hi-p)/(hi-lo)*plotH;
  ctx.font='10px sans-serif';ctx.strokeStyle='#1d232b';ctx.fillStyle='#6f7a8b';
  for(let i=0;i<=5;i++){const yy=pad.t+plotH*i/5;ctx.beginPath();ctx.moveTo(pad.l,yy+.5);ctx.lineTo(W-pad.r,yy+.5);ctx.stroke();ctx.fillText(fmt(hi-(hi-lo)*i/5,cfg.dec),W-pad.r+5,yy+3)}
  const labelStep=Math.max(1,Math.ceil(visibleCount/8)),firstTs=geom.all[0]?.t||Date.now()/1000,lastTs=geom.all.at(-1)?.t||Date.now()/1000;
  slots.forEach((c,i)=>{const x=pad.l+i*cw+cw*.5;if(i%labelStep===0){ctx.strokeStyle='#171c22';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();const idx=Math.floor(geom.start+i),ts=c?.t??(idx<0?firstTs+idx*tf:lastTs+(idx-geom.all.length+1)*tf);ctx.fillStyle='#6f7a8b';ctx.fillText(formatTime(ts),Math.max(2,x-18),H-9)}});
  slots.forEach((c,i)=>{if(!c)return;const x=pad.l+i*cw+cw*.5,col=c.c>=c.o?'#3dbb83':'#ec5d68';ctx.strokeStyle=col;ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x,y(c.h));ctx.lineTo(x,y(c.l));ctx.stroke();const yo=y(c.o),yc=y(c.c),top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo));ctx.fillRect(Math.round(x-cw*.31),Math.round(top),Math.max(1,cw*.62),bh);if(c.live){ctx.strokeStyle='#5d8cff';ctx.strokeRect(Math.round(x-cw*.37),Math.round(top-2),Math.max(2,cw*.74),bh+4)}});
  if(price>=lo&&price<=hi){
    const py=y(price),up=!current||current.c>=current.o,col=up?'#48a77d':'#d65361';ctx.setLineDash([4,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(W-pad.r,py);ctx.stroke();ctx.setLineDash([]);
    const boxY=clamp(py-18,pad.t,H-pad.b-36);ctx.fillStyle=col;ctx.fillRect(W-pad.r,boxY,pad.r,36);ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.fillText(fmt(price,cfg.dec),W-pad.r+5,boxY+14);ctx.font='10px sans-serif';ctx.fillText(candleRemain(),W-pad.r+5,boxY+29);
  }
  for(const o of activeChartOrders()){
    if(o.limit<lo||o.limit>hi)continue;const oy=y(o.limit),col=o.side==='buy'?'#3dbb83':'#ec5d68';
    ctx.setLineDash([6,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,oy);ctx.lineTo(W-pad.r,oy);ctx.stroke();ctx.setLineDash([]);
    const tw=ctx.measureText(o.label).width+12;ctx.fillStyle=o.side==='buy'?'#14251f':'#2a171b';ctx.fillRect(pad.l+8,oy-10,tw,20);ctx.fillStyle=col;ctx.fillText(o.label,pad.l+14,oy+3);
  }
  if(hoverIndex>=0&&hoverIndex<slots.length){const x=pad.l+hoverIndex*cw+cw*.5;ctx.strokeStyle='#4a5362';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke()}
  ctx.strokeStyle='#303741';ctx.beginPath();ctx.moveTo(W-pad.r,pad.t);ctx.lineTo(W-pad.r,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
}

function pnlOf(p,mark=markFor(p.symbol)){return(mark-p.entry)*p.qty*(p.side==='long'?1:-1)}
function usedMargin(){return positions.reduce((a,p)=>a+p.margin,0)}
function totalUnrealized(){return positions.reduce((a,p)=>a+pnlOf(p),0)}
function futuresEquity(){const w=futuresWallet();return w.usdt+w.frozen+usedMargin()+totalUnrealized()}
function spotCoinValue(){const w=spotWallet();return coinKeys.reduce((a,c)=>a+(w.coins[c]||0)*markFor(c+'/USDT'),0)}
function totalAsset(){return walletUsdt('fiat')+walletUsdt('earn')+walletUsdt('strategy')+walletUsdt('spot')+spotWallet().frozenUsdt+spotCoinValue()+futuresEquity()}
function liqPrice(side,entry,mode,margin,notional){let cushion=margin;if(mode==='cross')cushion+=Math.max(0,futuresWallet().usdt);const ratio=Math.min(.95,cushion/Math.max(1,notional));return side==='long'?Math.max(.0000001,entry*(1-ratio+MMR)):entry*(1+ratio-MMR)}
function previewLiq(side){const m=+$('marginInput').value||0;if(!m)return null;const entry=orderType==='limit'?(+$('limitPriceInput').value||price):price;return liqPrice(side,entry,$('marginMode').value,m,m*leverage)}
function updatePreview(){const m=+$('marginInput').value||0,n=m*leverage;$('notionalPreview').textContent=fmt(n);$('feePreview').textContent=fmt(n*FEE);const l=previewLiq('long'),s=previewLiq('short');$('longLiq').textContent=l?fmt(l,cfg.dec):'--';$('shortLiq').textContent=s?fmt(s,cfg.dec):'--'}
function stats(){
  const arr=currentSeries().slice(-80),open=arr[0]?.o||price,ch=(price/open-1)*100,hi=Math.max(...arr.map(c=>c.h)),lo=Math.min(...arr.map(c=>c.l));
  $('lastPrice').textContent=fmt(price,cfg.dec);$('lastPrice').className='pricebig '+(ch>=0?'green':'red');$('midPrice').textContent=fmt(price,cfg.dec);$('midPrice').className='mid '+(ch>=0?'green':'red');
  $('change24').textContent=(ch>=0?'+':'')+ch.toFixed(2)+'%';$('change24').className=ch>=0?'green':'red';$('high24').textContent=fmt(hi,cfg.dec);$('low24').textContent=fmt(lo,cfg.dec);$('vol24').textContent=fmt(arr.reduce((a,c)=>a+c.v*price,0),0);
  updateAssets();updatePreview();updateFundingUI();updateSpotPanel();renderCoinList();
}
function renderBook(){
  const step=price*cfg.vol*.45,asks=[],bids=[];for(let i=9;i>=1;i--)asks.push([price+step*i,Math.abs(randn())*10+.3]);for(let i=1;i<=9;i++)bids.push([price-step*i,Math.abs(randn())*10+.3]);
  const mk=(rows,side)=>{let total=rows.reduce((a,r)=>a+r[1],0),cum=0;return rows.map(r=>{cum+=r[1];return`<div class="obrow"><i class="depth" style="width:${cum/total*100}%;background:${side==='a'?'#ec5d68':'#3dbb83'}"></i><span class="${side==='a'?'red':'green'}">${fmt(r[0],cfg.dec)}</span><span>${fmt(r[1],4)}</span><span>${fmt(cum,4)}</span></div>`}).join('')};
  $('asks').innerHTML=mk(asks,'a');$('bids').innerHTML=mk(bids,'b');
}

function loadAuth(){user=JSON.parse(localStorage.getItem('greedbit_session')||'null');if(user)loadState();syncAuth()}
function syncAuth(){
  const yes=!!user;$('authbar').style.display=yes?'none':'flex';$('userchip').classList.toggle('show',yes);$('usernameTop').textContent=yes?user.username:'';
  $('loggedTrade').classList.toggle('hidden',!yes);$('tradeLoginBtn').classList.toggle('hidden',yes);$('spotLogged').classList.toggle('hidden',!yes);$('spotLoginBtn').classList.toggle('hidden',yes);$('assetLogged').classList.toggle('hidden',!yes);$('assetLogin').classList.toggle('hidden',yes);
  renderTable();updateAssets();renderAssetPage();
}
function openAuth(mode){authMode=mode;$('authModal').classList.add('show');$('authInput').value='';$('passInput').value='';syncAuthModal()}
function syncAuthModal(){const reg=authMode==='register';$('authTitle').textContent=reg?'欢迎注册 GreedBit':'欢迎登录 GreedBit';$('authLabel').textContent=reg?'请输入用户名或邮箱':'请输入您的账号';$('switchText').textContent=reg?'已有账号？':'新用户？';$('switchMode').textContent=reg?'登录':'注册';$('authSubmit').textContent=reg?'创建模拟账户':'登录'}
function submitAuth(){
  const name=$('authInput').value.trim(),pass=$('passInput').value;if(!name||pass.length<4)return notify('登录失败','账号不能为空，密码至少 4 位','error');
  const users=JSON.parse(localStorage.getItem('greedbit_users')||'{}');
  if(authMode==='register'){
    if(users[name])return notify('注册失败','该账号已存在','error');users[name]={username:name,password:pass,createdAt:Date.now()};localStorage.setItem('greedbit_users',JSON.stringify(users));user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));wallets=freshWallets();accountStats=freshStats();saveState();notify('注册成功','100,000 USDT 已进入法币账户');
  }else{
    if(!users[name]||users[name].password!==pass)return notify('登录失败','账号或密码错误','error');user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));loadState();notify('登录成功',`欢迎回来，${name}`);
  }
  $('authModal').classList.remove('show');syncAuth();
}
