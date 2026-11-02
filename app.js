(()=>{'use strict';
const $=id=>document.getElementById(id), canvas=$('chart'), ctx=canvas.getContext('2d');
const configs={
  'BTC/USDT':{p:68420,vol:.00055,dec:2},
  'ETH/USDT':{p:3520,vol:.00075,dec:2},
  'SOL/USDT':{p:164.2,vol:.0011,dec:3},
  'DOGE/USDT':{p:.1724,vol:.00145,dec:5}
};
const timeframes=[
  ['分时',20],['1分钟',60],['3分钟',180],['5分钟',300],['10分钟',600],['15分钟',900],['30分钟',1800],
  ['1小时',3600],['2小时',7200],['4小时',14400],['8小时',28800],['1日',86400],['3日',259200],['1周',604800],['1月',2592000]
];
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const MMR=.005,FEE=.0002,FUNDING_INTERVAL=8*3600;

let symbol='BTC/USDT',cfg=configs[symbol],price=cfg.p,tf=300,momentum=0,regime=0,regimeLife=0;
let ticks=[],candles=[],current=null,lastTickWall=Date.now();
let visibleCount=72,viewShift=0,yZoom=1,hoverIndex=-1,dragging=false,dragX=0,dragShift=0;
let positions=[],orders=[],orderHistory=[],trades=[],closedPositions=[],ledger=[],nextId=1;
let tableMode='positions',posFilter='all',leverage=10,orderType='market';
let account={usdt:100000,frozen:0},authMode='login',user=null;
let fundingRate=.0001,nextFunding=Math.floor(Date.now()/1000/FUNDING_INTERVAL+1)*FUNDING_INTERVAL;

function base(){return symbol.split('/')[0]}
function randn(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function makeTick(){
  if(--regimeLife<=0){regimeLife=250+Math.random()*900;regime=randn()*cfg.vol*.025}
  const shock=Math.random()<.0015?randn()*cfg.vol*3.8:0;
  momentum=.965*momentum+randn()*cfg.vol*.025;
  const pull=(cfg.p-price)/cfg.p*.000002;
  price=Math.max(cfg.p*.03,price*Math.exp(regime+momentum+randn()*cfg.vol*.11+shock+pull));
  return price;
}
function pushTick(p,t,v){ticks.push({p,t,v});if(ticks.length>120000)ticks.shift()}
function aggregateTick(x){
  const start=Math.floor(x.t/tf)*tf;
  if(!current||start!==current.t){
    if(current){current.live=false;candles.push(current)}
    current={t:start,o:x.p,h:x.p,l:x.p,c:x.p,v:x.v,live:true};
  }else{
    current.h=Math.max(current.h,x.p);current.l=Math.min(current.l,x.p);current.c=x.p;current.v+=x.v;
  }
  if(candles.length>8000)candles.shift();
}
function rebuildCandles(){
  candles=[];current=null;
  for(const x of ticks)aggregateTick(x);
  viewShift=0;hoverIndex=-1;draw();
}
function seed(){
  ticks=[];candles=[];current=null;momentum=0;regimeLife=0;
  const now=Date.now()/1000;
  let p=cfg.p*(.94+Math.random()*.12);
  const oldStart=now-60*86400;
  let histMomentum=0;
  for(let t=oldStart;t<now-12*3600;t+=60){
    histMomentum=.96*histMomentum+randn()*cfg.vol*.035;
    p=Math.max(cfg.p*.05,p*Math.exp(histMomentum+randn()*cfg.vol*.12));
    pushTick(p,t,.2+Math.random()*3);
  }
  for(let t=now-12*3600;t<now;t+=10){
    histMomentum=.95*histMomentum+randn()*cfg.vol*.025;
    p=Math.max(cfg.p*.05,p*Math.exp(histMomentum+randn()*cfg.vol*.1));
    pushTick(p,t,.2+Math.random()*3);
  }
  price=p;cfg.p=p;rebuildCandles();lastTickWall=Date.now();
}
function currentSeries(){const a=[...candles];if(current)a.push(current);return a}
function viewGeometry(){
  const all=currentSeries(),futureMax=Math.max(12,Math.floor(visibleCount*.65)),defaultFuture=3;
  viewShift=clamp(viewShift,-Math.max(0,all.length-visibleCount+8),futureMax);
  const right=all.length+defaultFuture+viewShift,start=right-visibleCount;
  const slots=[];
  for(let i=0;i<visibleCount;i++){const idx=start+i;slots.push(idx>=0&&idx<all.length?all[idx]:null)}
  return {all,slots,start,right,defaultFuture};
}
function resize(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);draw();
}
function formatTime(ts){
  const d=new Date(ts*1000);
  if(tf>=86400)return `${d.getMonth()+1}/${d.getDate()}`;
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function calcPriceBounds(slots){
  const data=slots.filter(Boolean);
  if(!data.length)return {hi:price*1.01,lo:price*.99};
  let hi=Math.max(...data.map(c=>c.h)),lo=Math.min(...data.map(c=>c.l)),rg=(hi-lo)||hi*.01;
  const center=(hi+lo)/2;rg*=1.18*yZoom;
  return {hi:center+rg/2,lo:center-rg/2};
}
function draw(){
  const W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;
  const pad={l:8,r:74,t:28,b:30},plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#0d0f12';ctx.fillRect(0,0,W,H);
  const {slots}=viewGeometry(),cw=plotW/visibleCount,{hi,lo}=calcPriceBounds(slots),y=p=>pad.t+(hi-p)/(hi-lo)*plotH;
  ctx.font='10px sans-serif';ctx.strokeStyle='#1d222a';ctx.fillStyle='#6f7888';
  for(let i=0;i<=5;i++){
    const yy=pad.t+plotH*i/5;
    ctx.beginPath();ctx.moveTo(pad.l,yy+.5);ctx.lineTo(W-pad.r,yy+.5);ctx.stroke();
    ctx.fillText(fmt(hi-(hi-lo)*i/5,cfg.dec),W-pad.r+5,yy+3);
  }
  const labelStep=Math.max(1,Math.ceil(visibleCount/8));
  slots.forEach((c,i)=>{
    const x=pad.l+i*cw+cw*.5;
    if(i%labelStep===0){
      ctx.strokeStyle='#171c22';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
      if(c){ctx.fillStyle='#6f7888';ctx.fillText(formatTime(c.t),Math.max(2,x-18),H-8)}
    }
  });
  slots.forEach((c,i)=>{
    if(!c)return;
    const x=pad.l+i*cw+cw*.5,col=c.c>=c.o?'#2ebd85':'#f04f5f';
    ctx.strokeStyle=col;ctx.fillStyle=col;
    ctx.beginPath();ctx.moveTo(x,y(c.h));ctx.lineTo(x,y(c.l));ctx.stroke();
    const yo=y(c.o),yc=y(c.c),top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo));
    ctx.fillRect(Math.round(x-cw*.31),Math.round(top),Math.max(1,cw*.62),bh);
    if(c.live){ctx.strokeStyle='#4f8cff';ctx.strokeRect(Math.round(x-cw*.37),Math.round(top-2),Math.max(2,cw*.74),bh+4)}
  });
  if(price>=lo&&price<=hi){
    const py=y(price);ctx.setLineDash([4,4]);ctx.strokeStyle='#7e899a';ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(W-pad.r,py);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#28303a';ctx.fillRect(W-pad.r,py-9,pad.r,18);ctx.fillStyle='#e9edf5';ctx.fillText(fmt(price,cfg.dec),W-pad.r+4,py+3);
  }
  for(const o of orders.filter(o=>o.symbol===symbol&&o.status==='open')){
    if(o.limit<lo||o.limit>hi)continue;
    const oy=y(o.limit),col=o.side==='long'?'#2ebd85':'#f04f5f';
    ctx.setLineDash([6,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,oy);ctx.lineTo(W-pad.r,oy);ctx.stroke();ctx.setLineDash([]);
    const label=`限价 ${o.side==='long'?'开多':'开空'} ${fmt(o.limit,cfg.dec)}`;
    ctx.font='10px sans-serif';const tw=ctx.measureText(label).width+12;
    ctx.fillStyle=o.side==='long'?'#14251f':'#2a171b';ctx.fillRect(pad.l+8,oy-10,tw,20);ctx.fillStyle=col;ctx.fillText(label,pad.l+14,oy+3);
  }
  if(hoverIndex>=0&&hoverIndex<slots.length){
    const x=pad.l+hoverIndex*cw+cw*.5;ctx.strokeStyle='#4a5362';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
  }
  ctx.strokeStyle='#303741';ctx.beginPath();ctx.moveTo(W-pad.r,pad.t);ctx.lineTo(W-pad.r,H);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
}
function updateCandleCountdown(){
  const now=Date.now()/1000,remain=Math.max(0,Math.ceil(tf-(now%tf))),h=Math.floor(remain/3600),m=Math.floor(remain%3600/60),s=remain%60;
  $('candleCountdown').textContent='下一根 K 线 '+(h?`${String(h).padStart(2,'0')}:`:'')+`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function markFor(sym){return sym===symbol?price:(configs[sym]?.p||0)}
function pnlOf(p,mark=markFor(p.symbol)){return (mark-p.entry)*p.qty*(p.side==='long'?1:-1)}
function usedMargin(){return positions.reduce((a,p)=>a+p.margin,0)}
function totalUnrealized(){return positions.reduce((a,p)=>a+pnlOf(p),0)}
function equity(){return account.usdt+account.frozen+usedMargin()+totalUnrealized()}
function liqPrice(side,entry,mode,margin,notional){
  let cushion=margin;if(mode==='cross')cushion+=Math.max(0,account.usdt);
  const ratio=Math.min(.95,cushion/Math.max(1,notional));
  return side==='long'?Math.max(.0000001,entry*(1-ratio+MMR)):entry*(1+ratio-MMR);
}
function previewLiq(side){
  const m=+$('marginInput').value||0;if(!m)return null;
  return liqPrice(side,price,$('marginMode').value,m,m*leverage);
}
function updatePreview(){
  const m=+$('marginInput').value||0,n=m*leverage;
  $('notionalPreview').textContent=fmt(n);$('feePreview').textContent=fmt(n*FEE);
  const l=previewLiq('long'),sh=previewLiq('short');
  $('longLiq').textContent=l?fmt(l,cfg.dec):'--';$('shortLiq').textContent=sh?fmt(sh,cfg.dec):'--';
}
function stats(){
  const arr=currentSeries().slice(-80),open=arr[0]?.o||price,ch=(price/open-1)*100,hi=Math.max(...arr.map(c=>c.h)),lo=Math.min(...arr.map(c=>c.l));
  $('lastPrice').textContent=fmt(price,cfg.dec);$('lastPrice').className='pricebig '+(ch>=0?'green':'red');
  $('midPrice').textContent=fmt(price,cfg.dec);$('midPrice').className='mid '+(ch>=0?'green':'red');
  $('change24').textContent=(ch>=0?'+':'')+ch.toFixed(2)+'%';$('change24').className=ch>=0?'green':'red';
  $('high24').textContent=fmt(hi,cfg.dec);$('low24').textContent=fmt(lo,cfg.dec);
  $('vol24').textContent=fmt(arr.reduce((a,c)=>a+c.v*price,0),0);
  updateAssets();updatePreview();updateFundingUI();updateCandleCountdown();
}
function renderBook(){
  const step=price*cfg.vol*.45,asks=[],bids=[];
  for(let i=9;i>=1;i--)asks.push([price+step*i,Math.abs(randn())*10+.3]);
  for(let i=1;i<=9;i++)bids.push([price-step*i,Math.abs(randn())*10+.3]);
  const mk=(rows,side)=>{let total=rows.reduce((a,r)=>a+r[1],0),cum=0;return rows.map(r=>{cum+=r[1];return `<div class="obrow"><i class="depth" style="width:${cum/total*100}%;background:${side==='a'?'#f04f5f':'#2ebd85'}"></i><span class="${side==='a'?'red':'green'}">${fmt(r[0],cfg.dec)}</span><span>${fmt(r[1],4)}</span><span>${fmt(cum,4)}</span></div>`}).join('')};
  $('asks').innerHTML=mk(asks,'a');$('bids').innerHTML=mk(bids,'b');
}
function notify(title,msg='',type='success',ttl=3200){
  const n=document.createElement('div');n.className='notice-pop '+type;
  n.innerHTML=`<button class="x">×</button><b>${title}</b><p>${msg}</p>`;$('notifications').prepend(n);
  const remove=()=>n.remove();n.querySelector('.x').onclick=remove;if(ttl)setTimeout(remove,ttl);
}
function loadAuth(){user=JSON.parse(localStorage.getItem('greedbit_session')||'null');syncAuth()}
function syncAuth(){
  const yes=!!user;$('authbar').style.display=yes?'none':'flex';$('userchip').classList.toggle('show',yes);
  $('loggedTrade').classList.toggle('hidden',!yes);$('tradeLoginBtn').classList.toggle('hidden',yes);
  $('assetLogged').classList.toggle('hidden',!yes);$('assetLogin').classList.toggle('hidden',yes);
  $('usernameTop').textContent=yes?user.username:'';renderTable();updateAssets();
}
function openAuth(mode){authMode=mode;$('authModal').classList.add('show');$('authInput').value='';$('passInput').value='';syncAuthModal()}
function syncAuthModal(){
  const reg=authMode==='register';$('authTitle').textContent=reg?'欢迎注册 GreedBit':'欢迎登录 GreedBit';
  $('authLabel').textContent=reg?'请输入用户名或邮箱':'请输入您的账号';$('switchText').textContent=reg?'已有账号？':'新用户？';
  $('switchMode').textContent=reg?'登录':'注册';$('authSubmit').textContent=reg?'创建模拟账户':'登录';
}
function submitAuth(){
  const name=$('authInput').value.trim(),pass=$('passInput').value;if(!name||pass.length<4)return notify('无法继续','账号不能为空，密码至少 4 位','error');
  const users=JSON.parse(localStorage.getItem('greedbit_users')||'{}');
  if(authMode==='register'){if(users[name])return notify('注册失败','该账号已存在','error');users[name]={username:name,password:pass};localStorage.setItem('greedbit_users',JSON.stringify(users));}
  else if(!users[name]||users[name].password!==pass)return notify('登录失败','账号或密码错误','error');
  user={username:name};localStorage.setItem('greedbit_session',JSON.stringify(user));$('authModal').classList.remove('show');syncAuth();
  notify(authMode==='register'?'注册成功':'登录成功',`欢迎回来，${name}`);
}
function createPosition(side,margin,entry,mode,lev,tp,sl,source='市价'){
  const notional=margin*lev,fee=notional*FEE,qty=notional/entry;
  const p={id:nextId++,symbol,side,mode,leverage:lev,margin,notional,qty,entry,tp,sl,openedAt:new Date().toLocaleTimeString()};
  p.liq=liqPrice(side,entry,mode,margin,notional);positions.unshift(p);
  trades.unshift({time:p.openedAt,symbol,side,qty,price:entry,type:`${source}开仓`});
  ledger.unshift({time:p.openedAt,type:'开仓手续费',amount:-fee,balance:account.usdt});
  notify('下单成功',`${side==='long'?'开多':'开空'} ${symbol} @ ${fmt(entry,cfg.dec)} · ${lev}X`);
}
function place(side){
  if(!user)return openAuth('login');
  const margin=+$('marginInput').value;if(!margin||margin<=0)return notify('下单失败','请输入有效保证金','error');
  const fee=margin*leverage*FEE,total=margin+fee;if(total>account.usdt)return notify('下单失败','可用保证金不足','error');
  const tp=+$('tpInput').value||null,sl=+$('slInput').value||null,mode=$('marginMode').value;
  if(orderType==='limit'){
    const limit=+$('limitPriceInput').value;if(!limit||limit<=0)return notify('下单失败','请输入有效限价','error');
    account.usdt-=total;account.frozen+=total;
    orders.unshift({id:nextId++,symbol,side,mode,leverage,margin,fee,limit,tp,sl,status:'open',createdAt:new Date().toLocaleTimeString()});
    notify('委托已提交',`${side==='long'?'限价开多':'限价开空'} ${symbol} @ ${fmt(limit,cfg.dec)}`);draw();
  }else{
    account.usdt-=total;createPosition(side,margin,price,mode,leverage,tp,sl,'市价');
  }
  $('marginInput').value='';$('pct').value=0;$('pctLabel').textContent='0%';renderTable();updateAssets();updatePreview();
}
function cancelOrder(id){
  const i=orders.findIndex(o=>o.id===id);if(i<0)return;const o=orders[i],refund=o.margin+o.fee;
  account.frozen-=refund;account.usdt+=refund;o.status='cancelled';o.closedAt=new Date().toLocaleTimeString();orderHistory.unshift(o);orders.splice(i,1);
  notify('撤单成功',`${o.symbol} @ ${fmt(o.limit,configs[o.symbol].dec)}`);renderTable();updateAssets();draw();
}
function matchOrders(){
  for(let i=orders.length-1;i>=0;i--){
    const o=orders[i];if(o.symbol!==symbol||o.status!=='open')continue;
    const hit=o.side==='long'?price<=o.limit:price>=o.limit;if(!hit)continue;
    const reserved=o.margin+o.fee;account.frozen-=reserved;
    o.status='filled';o.closedAt=new Date().toLocaleTimeString();orderHistory.unshift({...o});
    createPosition(o.side,o.margin,o.limit,o.mode,o.leverage,o.tp,o.sl,'限价');orders.splice(i,1);
    notify('限价委托成交',`${o.symbol} @ ${fmt(o.limit,cfg.dec)}`);draw();
  }
}
function reducePosition(id,fraction=1,reason='手动平仓',fill=price){
  const i=positions.findIndex(p=>p.id===id);if(i<0)return;const p=positions[i],f=clamp(fraction,.01,1);
  const qty=p.qty*f,margin=p.margin*f,realized=(fill-p.entry)*qty*(p.side==='long'?1:-1),fee=Math.abs(qty*fill)*FEE;
  account.usdt=Math.max(0,account.usdt+margin+realized-fee);
  closedPositions.unshift({...p,qty,margin,close:fill,realized,closeFee:fee,reason,closedAt:new Date().toLocaleTimeString()});
  trades.unshift({time:new Date().toLocaleTimeString(),symbol:p.symbol,side:p.side==='long'?'sell':'buy',qty,price:fill,type:reason});
  ledger.unshift({time:new Date().toLocaleTimeString(),type:reason,amount:realized-fee,balance:account.usdt});
  if(f>=.999){positions.splice(i,1)}else{p.qty-=qty;p.margin-=margin;p.notional-=p.notional*f}
  notify(reason,`${p.symbol} 已实现盈亏 ${realized>=0?'+':''}${fmt(realized)} USDT`,realized>=0?'success':'error');renderTable();updateAssets();
}
function riskChecks(){
  for(let i=positions.length-1;i>=0;i--){
    const p=positions[i];if(p.symbol!==symbol)continue;
    p.liq=liqPrice(p.side,p.entry,p.mode,p.margin,p.notional);
    const liq=p.side==='long'?price<=p.liq:price>=p.liq;
    const tp=p.tp&&(p.side==='long'?price>=p.tp:price<=p.tp);
    const sl=p.sl&&(p.side==='long'?price<=p.sl:price>=p.sl);
    if(liq)reducePosition(p.id,1,'强制平仓',p.liq);else if(tp)reducePosition(p.id,1,'止盈',p.tp);else if(sl)reducePosition(p.id,1,'止损',p.sl);
  }
}
function settleFunding(){
  const now=Date.now()/1000;if(now<nextFunding)return;
  for(const p of positions){
    const payment=p.notional*fundingRate*(p.side==='long'?-1:1);account.usdt+=payment;
    ledger.unshift({time:new Date().toLocaleTimeString(),type:'资金费率',amount:payment,balance:account.usdt});
  }
  fundingRate=clamp(fundingRate+randn()*.000025,-.0005,.0005);nextFunding+=FUNDING_INTERVAL;
  notify('资金费率已结算',`本期费率 ${(fundingRate*100).toFixed(4)}%`);
}
function updateFundingUI(){
  $('fundingRate').textContent=(fundingRate*100).toFixed(4)+'%';
  const remain=Math.max(0,Math.floor(nextFunding-Date.now()/1000)),h=Math.floor(remain/3600),m=Math.floor(remain%3600/60),s=remain%60;
  $('fundingCountdown').textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function updateAssets(){
  if(!user)return;const un=totalUnrealized();
  $('usdtBal').textContent=fmt(account.usdt);$('equity').textContent=fmt(equity())+' USDT';$('assetUsdt').textContent=fmt(account.usdt);
  $('frozenMargin').textContent=fmt(account.frozen);$('usedMargin').textContent=fmt(usedMargin());
  $('pnl').textContent=(un>=0?'+':'')+fmt(un)+' USDT';$('pnl').className=un>=0?'green':'red';
  $('buyBtn').textContent='开多 '+base();$('sellBtn').textContent='开空 '+base();$('posCount').textContent='('+positions.length+')';$('openCount').textContent='('+orders.length+')';
}
function positionRows(){return positions.filter(p=>posFilter==='all'||p.mode===posFilter).map(p=>{const mark=markFor(p.symbol),pnl=pnlOf(p,mark),roe=p.margin?pnl/p.margin*100:0;return {...p,mark,pnl,roe}})}
function renderTable(){
  $('positionFilters').style.display=tableMode==='positions'?'flex':'none';
  if(!user){$('thead').innerHTML='<tr><th></th></tr>';$('tbody').innerHTML='<tr><td class="empty">登录 或 注册后查看账户数据</td></tr>';return}
  let h='',b='';
  if(tableMode==='positions'){
    const rows=positionRows();h='<tr><th>合约</th><th>方向</th><th>模式</th><th>杠杆</th><th>开仓价</th><th>标记价</th><th>保证金</th><th>未实现盈亏</th><th>ROE</th><th>强平价</th><th>止盈/止损</th><th>操作</th></tr>';
    b=rows.length?rows.map(r=>`<tr><td>${r.symbol.replace('/','')}永续</td><td class="${r.side==='long'?'green':'red'}">${r.side==='long'?'多':'空'}</td><td>${r.mode==='cross'?'全仓':'逐仓'}</td><td>${r.leverage}X</td><td>${fmt(r.entry,configs[r.symbol].dec)}</td><td>${fmt(r.mark,configs[r.symbol].dec)}</td><td>${fmt(r.margin)}</td><td class="${r.pnl>=0?'green':'red'}">${fmt(r.pnl)}</td><td>${r.roe.toFixed(2)}%</td><td>${fmt(r.liq,configs[r.symbol].dec)}</td><td>${r.tp?fmt(r.tp,configs[r.symbol].dec):'--'} / ${r.sl?fmt(r.sl,configs[r.symbol].dec):'--'}</td><td><button class="closepos" data-reduce="${r.id}">减仓50%</button> <button class="closepos" data-close="${r.id}">全平</button></td></tr>`).join(''):'<tr><td colspan="12" class="empty">暂无持仓</td></tr>';
  }else if(tableMode==='open'){
    h='<tr><th>时间</th><th>合约</th><th>方向</th><th>委托价</th><th>保证金</th><th>杠杆</th><th>止盈/止损</th><th>操作</th></tr>';
    b=orders.length?orders.map(o=>`<tr><td>${o.createdAt}</td><td>${o.symbol}</td><td class="${o.side==='long'?'green':'red'}">${o.side==='long'?'开多':'开空'}</td><td>${fmt(o.limit,configs[o.symbol].dec)}</td><td>${fmt(o.margin)}</td><td>${o.leverage}X</td><td>${o.tp||'--'} / ${o.sl||'--'}</td><td><button class="cancel" data-cancel="${o.id}">撤单</button></td></tr>`).join(''):'<tr><td colspan="8" class="empty">暂无委托</td></tr>';
  }else if(tableMode==='orders'){
    h='<tr><th>时间</th><th>合约</th><th>方向</th><th>委托价</th><th>状态</th></tr>';
    b=orderHistory.length?orderHistory.map(o=>`<tr><td>${o.createdAt}</td><td>${o.symbol}</td><td>${o.side==='long'?'开多':'开空'}</td><td>${fmt(o.limit,configs[o.symbol].dec)}</td><td>${o.status==='filled'?'已成交':'已撤销'}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">暂无历史委托</td></tr>';
  }else if(tableMode==='history'){
    h='<tr><th>时间</th><th>合约</th><th>类型</th><th>价格</th><th>数量</th></tr>';
    b=trades.length?trades.map(t=>`<tr><td>${t.time}</td><td>${t.symbol}</td><td>${t.type}</td><td>${fmt(t.price,configs[t.symbol].dec)}</td><td>${fmt(t.qty,6)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">暂无成交</td></tr>';
  }else if(tableMode==='closed'){
    h='<tr><th>时间</th><th>合约</th><th>方向</th><th>开仓价</th><th>平仓价</th><th>已实现盈亏</th><th>原因</th></tr>';
    b=closedPositions.length?closedPositions.map(p=>`<tr><td>${p.closedAt}</td><td>${p.symbol}</td><td>${p.side==='long'?'多':'空'}</td><td>${fmt(p.entry,configs[p.symbol].dec)}</td><td>${fmt(p.close,configs[p.symbol].dec)}</td><td class="${p.realized>=0?'green':'red'}">${fmt(p.realized)}</td><td>${p.reason}</td></tr>`).join(''):'<tr><td colspan="7" class="empty">暂无历史仓位</td></tr>';
  }else if(tableMode==='ledger'){
    h='<tr><th>时间</th><th>类型</th><th>金额</th><th>余额</th></tr>';
    b=ledger.length?ledger.map(x=>`<tr><td>${x.time}</td><td>${x.type}</td><td class="${x.amount>=0?'green':'red'}">${x.amount>=0?'+':''}${fmt(x.amount)}</td><td>${fmt(x.balance)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">暂无财务记录</td></tr>';
  }else{
    h='<tr><th>资产</th><th>数量</th></tr>';b=`<tr><td>USDT账户权益</td><td>${fmt(equity())}</td></tr><tr><td>可用余额</td><td>${fmt(account.usdt)}</td></tr><tr><td>冻结保证金</td><td>${fmt(account.frozen)}</td></tr>`;
  }
  $('thead').innerHTML=h;$('tbody').innerHTML=b;
}
function tick(){
  const now=Date.now();lastTickWall=now;
  const p=makeTick(),t=now/1000;pushTick(p,t,.2+Math.random()*2);aggregateTick({p,t,v:.2+Math.random()*2});
  matchOrders();riskChecks();settleFunding();stats();draw();if(tableMode==='positions')renderTable();
}
function setupTimeframes(){
  $('timebar').innerHTML=timeframes.map(([n,s])=>`<button data-tf="${s}" class="${s===tf?'active':''}">${n}</button>`).join('');
  $('timebar').onclick=e=>{const b=e.target.closest('[data-tf]');if(!b)return;tf=+b.dataset.tf;[...$('timebar').querySelectorAll('button')].forEach(x=>x.classList.toggle('active',x===b));rebuildCandles();updateCandleCountdown()};
}
function setupChartInteraction(){
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,W=r.width,H=r.height,padR=74,padB=30;
    if(x>W-padR){yZoom=clamp(yZoom*(e.deltaY>0?1.12:.89),.28,6)}
    else if(y>H-padB||x<=W-padR){visibleCount=Math.round(clamp(visibleCount*(e.deltaY>0?1.13:.88),18,260))}
    draw();
  },{passive:false});
  canvas.addEventListener('mousedown',e=>{dragging=true;dragX=e.clientX;dragShift=viewShift;canvas.style.cursor='grabbing'});
  window.addEventListener('mouseup',()=>{dragging=false;canvas.style.cursor='crosshair'});
  window.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    if(dragging){
      const cw=Math.max(2,(r.width-82)/visibleCount),dx=e.clientX-dragX;
      viewShift=Math.round(dragShift-dx/cw);draw();return;
    }
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    const x=e.clientX-r.left,padL=8,padR=74,cw=(r.width-padL-padR)/visibleCount;
    hoverIndex=clamp(Math.floor((x-padL)/cw),0,visibleCount-1);
    const c=viewGeometry().slots[hoverIndex];
    $('ohlc').textContent=c?`O ${fmt(c.o,cfg.dec)}  H ${fmt(c.h,cfg.dec)}  L ${fmt(c.l,cfg.dec)}  C ${fmt(c.c,cfg.dec)}  ${formatTime(c.t)}`:'未来空白区域';
    draw();
  });
  canvas.addEventListener('mouseleave',()=>{hoverIndex=-1;$('ohlc').textContent='移动鼠标查看 OHLC';draw()});
  canvas.addEventListener('dblclick',()=>{viewShift=0;yZoom=1;visibleCount=72;draw()});
}
function setupSplitters(){
  const layout=$('layout');
  function vertical(id,which){
    const s=$(id);s.addEventListener('pointerdown',e=>{s.setPointerCapture(e.pointerId);s.classList.add('dragging');
      const move=ev=>{const r=layout.getBoundingClientRect(),x=ev.clientX-r.left;
        if(which==='chart'){layout.style.setProperty('--chart-w',clamp(x,430,r.width-530)+'px')}
        else{const chartW=$('chartPanel').getBoundingClientRect().width;layout.style.setProperty('--book-w',clamp(x-chartW-10,220,r.width-chartW-315)+'px')}
        resize();
      };
      const up=()=>{s.classList.remove('dragging');s.removeEventListener('pointermove',move);s.removeEventListener('pointerup',up)};
      s.addEventListener('pointermove',move);s.addEventListener('pointerup',up);
    });
  }
  vertical('splitChartBook','chart');vertical('splitBookTrade','book');
  const sh=$('splitChartBottom');sh.addEventListener('pointerdown',e=>{sh.setPointerCapture(e.pointerId);sh.classList.add('dragging');
    const move=ev=>{const r=layout.getBoundingClientRect(),bottom=clamp(r.bottom-ev.clientY,160,r.height-320);layout.style.setProperty('--bottom-h',bottom+'px');resize()};
    const up=()=>{sh.classList.remove('dragging');sh.removeEventListener('pointermove',move);sh.removeEventListener('pointerup',up)};
    sh.addEventListener('pointermove',move);sh.addEventListener('pointerup',up);
  });
}
function setupUI(){
  $('symbol').onchange=e=>{symbol=e.target.value;cfg=configs[symbol];seed();renderBook();stats();renderTable();draw()};
  $('loginBtn').onclick=()=>openAuth('login');$('registerBtn').onclick=()=>openAuth('register');$('tradeLoginBtn').onclick=()=>openAuth('login');$('assetLoginBtn').onclick=()=>openAuth('login');
  $('logoutBtn').onclick=()=>{localStorage.removeItem('greedbit_session');user=null;syncAuth();notify('已退出登录')};
  $('closeModal').onclick=()=>$('authModal').classList.remove('show');$('switchMode').onclick=()=>{authMode=authMode==='login'?'register':'login';syncAuthModal()};$('authSubmit').onclick=submitAuth;
  $('leverageRow').onclick=e=>{const b=e.target.closest('[data-lev]');if(!b)return;leverage=+b.dataset.lev;$('levLabel').textContent=leverage+'X';[...$('leverageRow').querySelectorAll('button')].forEach(x=>x.classList.toggle('active',x===b));updatePreview()};
  document.querySelectorAll('.order-type').forEach(b=>b.onclick=()=>{orderType=b.dataset.ordertype;document.querySelectorAll('.order-type').forEach(x=>x.classList.toggle('active',x===b));$('limitPriceField').classList.toggle('hidden',orderType!=='limit');if(orderType==='limit')$('limitPriceInput').value=price.toFixed(cfg.dec)});
  $('marginInput').oninput=updatePreview;$('marginMode').onchange=updatePreview;$('buyBtn').onclick=()=>place('long');$('sellBtn').onclick=()=>place('short');
  $('pct').oninput=e=>{const p=+e.target.value;$('pctLabel').textContent=p+'%';$('marginInput').value=(account.usdt*p/100/(1+leverage*FEE)).toFixed(2);updatePreview()};
  document.querySelector('.quick-dots').onclick=e=>{const b=e.target.closest('[data-pct]');if(!b)return;const p=+b.dataset.pct;$('pct').value=p;$('pct').dispatchEvent(new Event('input'))};
  document.querySelectorAll('[data-table]').forEach(b=>b.onclick=()=>{tableMode=b.dataset.table;document.querySelectorAll('[data-table]').forEach(x=>x.classList.toggle('active',x===b));renderTable()});
  document.querySelectorAll('[data-posfilter]').forEach(b=>b.onclick=()=>{posFilter=b.dataset.posfilter;document.querySelectorAll('[data-posfilter]').forEach(x=>x.classList.toggle('active',x===b));renderTable()});
  $('tbody').onclick=e=>{const c=e.target.closest('[data-cancel]');if(c)return cancelOrder(+c.dataset.cancel);const r=e.target.closest('[data-reduce]');if(r)return reducePosition(+r.dataset.reduce,.5,'减仓');const x=e.target.closest('[data-close]');if(x)return reducePosition(+x.dataset.close,1,'手动平仓')};
}
window.addEventListener('resize',resize);
setupTimeframes();setupChartInteraction();setupSplitters();setupUI();loadAuth();seed();renderBook();stats();renderTable();resize();
setInterval(tick,250);setInterval(renderBook,900);setInterval(updateCandleCountdown,250);
notify('GreedBit v0.0.5','图表交互与真实周期 K 线已启用');
})();