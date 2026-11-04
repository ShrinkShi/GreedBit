/* v0.0.24 HTX-inspired grid strategy + performance statistics */
(function waitV024(){
if(!window.GreedBitV21||!document.getElementById('strategyPanel')){setTimeout(waitV024,80);return}
(()=>{
'use strict';
const VERSION=window.GB_VERSION||'0.0.26';
const STRATEGY_KEY='greedbit_v024_strategies_';
const SEED_MIGRATION_KEY='greedbit_v024_seed_migrated_';
const MAX_EVENTS=1200;
let strategyTabActive=false;
let strategyKind='spot-grid';
let strategyBottomMode='running';
let strategyState={seq:1,records:[],events:[]};
let lastUser='';

const $v=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const money=v=>fmt(num(v),2);
const pctText=v=>`${num(v)>=0?'+':''}${num(v).toFixed(2)}%`;
function nowStamp(){return Date.now()}
function currentMeta(sym=symbol){return window.GreedBitV13?.META?.[sym]||null}
function currentMark(sym=symbol){return num(marketSnapshots?.[sym]?.last||configs?.[sym]?.anchor||0)}
function assetClass(sym){const m=currentMeta(sym),k=m?.market||m?.category||'';if(k==='stock')return'stock';if(k==='forex')return'forex';if(k==='commodity')return'commodity';return'crypto'}
function classLabel(k){return({crypto:'虚拟币',stock:'股票代币',forex:'外汇',commodity:'大宗商品'}[k]||k)}
function strategyKey(){return STRATEGY_KEY+(user?.username||'guest')}
function blankStrategyState(){return{seq:1,records:[],events:[]}}
function loadStrategyState(){
  lastUser=user?.username||'';
  if(!user){strategyState=blankStrategyState();return}
  try{const x=JSON.parse(localStorage.getItem(strategyKey())||'null');strategyState=x&&Array.isArray(x.records)?x:blankStrategyState()}catch{strategyState=blankStrategyState()}
  strategyState.seq=Math.max(1,num(strategyState.seq)||1);strategyState.events=Array.isArray(strategyState.events)?strategyState.events:[];
}
function saveStrategyState(){if(!user)return;strategyState.events=strategyState.events.slice(0,MAX_EVENTS);localStorage.setItem(strategyKey(),JSON.stringify(strategyState))}
function recordStrategyEvent(r,type,priceValue,qty,pnl=null,fee=0,closed=false,note=''){
  const e={id:`SE${Date.now()}${Math.floor(Math.random()*1000)}`,time:Date.now(),strategyId:r.id,kind:r.kind,symbol:r.symbol,assetClass:assetClass(r.symbol),type,price:num(priceValue),qty:num(qty),pnl:pnl==null?null:num(pnl),fee:num(fee),closed:!!closed,note};
  strategyState.events.unshift(e);r.trades=(r.trades||0)+1;r.fees=(r.fees||0)+num(fee);
  if(closed&&pnl!=null){r.closedTrades=(r.closedTrades||0)+1;if(pnl>1e-9)r.wins=(r.wins||0)+1;else if(pnl<-1e-9)r.losses=(r.losses||0)+1;r.realized=(r.realized||0)+pnl;if(pnl>=0)accountStats.realizedProfit+=pnl;else accountStats.realizedLoss+=Math.abs(pnl)}
  accountStats.fees+=num(fee);saveStrategyState();saveState();return e
}

/* New accounts start from zero. Existing untouched 100k seed accounts are migrated without deleting real activity. */
const inheritedFreshWallets=freshWallets;
freshWallets=function(){const w=inheritedFreshWallets();if(w?.fiat)w.fiat.usdt=0;return w};
const inheritedNotify=notify;
notify=function(title,msg='',type='success',ttl=3200){if(title==='注册成功'&&/100,?000/.test(String(msg)))msg='账户初始余额为 0 USDT，请先通过“入金”获得模拟资金。';return inheritedNotify(title,msg,type,ttl)};

/* ---------- strategy valuation and engine ---------- */
function gridLevels(r){if(Array.isArray(r.levels)&&r.levels.length===r.grids+1)return r.levels;const out=[],step=(r.high-r.low)/r.grids;for(let i=0;i<=r.grids;i++)out.push(r.low+step*i);r.levels=out;return out}
function gridIndex(r,p){if(p<=r.low)return 0;if(p>=r.high)return r.grids;return Math.max(0,Math.min(r.grids,Math.floor((p-r.low)/(r.high-r.low)*r.grids)))}
function strategyEquity(r,p=currentMark(r.symbol)){
  if(!p)return num(r.amount);
  if(r.kind==='spot-grid')return Math.max(0,num(r.cash)+num(r.coinQty)*p);
  let eq=num(r.cash);for(const x of Object.values(r.longTargets||{})){const u=(p-x.entry)*x.qty;eq+=x.margin+u}for(const x of Object.values(r.shortTargets||{})){const u=(x.entry-p)*x.qty;eq+=x.margin+u}return Math.max(0,eq)
}
function activeStrategyEquity(){return strategyState.records.filter(r=>r.status==='running').reduce((a,r)=>a+strategyEquity(r),0)}
const inheritedTotalAsset=totalAsset;
totalAsset=function(){return inheritedTotalAsset()+activeStrategyEquity()};
function openFuture(r,side,entry,targetIndex){
  const leverage=Math.max(1,num(r.leverage)||1),margin=Math.min(num(r.unitMargin),num(r.cash));if(margin<=.01)return false;
  const notional=margin*leverage,fee=notional*FEE;if(margin+fee>r.cash)return false;r.cash-=margin+fee;
  const pos={entry,margin,qty:notional/entry,openFee:fee,targetIndex};if(side==='long')r.longTargets[targetIndex]=pos;else r.shortTargets[targetIndex]=pos;
  recordStrategyEvent(r,side==='long'?'合约网格开多':'合约网格开空',entry,pos.qty,null,fee,false,`${leverage}X`);return true
}
function closeFuture(r,side,targetIndex,exit,reason='网格成交'){
  const map=side==='long'?r.longTargets:r.shortTargets,pos=map[targetIndex];if(!pos)return false;
  const gross=(side==='long'?exit-pos.entry:pos.entry-exit)*pos.qty,closeFee=Math.abs(pos.qty*exit)*FEE,realized=gross-pos.openFee-closeFee;
  r.cash+=Math.max(0,pos.margin+gross-closeFee);delete map[targetIndex];
  recordStrategyEvent(r,side==='long'?'合约网格平多':'合约网格平空',exit,pos.qty,realized,closeFee,true,reason);r.completedRounds=(r.completedRounds||0)+1;return true
}
function processSpotGrid(r,p){
  const levels=gridLevels(r),old=r.gridIndex??gridIndex(r,r.lastPrice||p),next=gridIndex(r,p),unit=Math.max(.01,num(r.unitQuote));
  if(next<old){for(let i=old;i>next;i--){const fill=levels[Math.max(0,i-1)],fee=unit*SPOT_FEE;if(r.cash<unit+fee)break;const q=unit/fill;r.cash-=unit+fee;r.coinQty+=q;r.coinCost+=unit+fee;recordStrategyEvent(r,'现货网格买入',fill,q,null,fee,false)}}
  if(next>old){for(let i=old+1;i<=next;i++){if(r.coinQty<=1e-12)break;const fill=levels[Math.min(r.grids,i)],q=Math.min(r.coinQty,unit/fill),avg=r.coinQty>0?r.coinCost/r.coinQty:0,proceeds=q*fill,fee=proceeds*SPOT_FEE,realized=(fill-avg)*q-fee;r.cash+=proceeds-fee;r.coinQty-=q;r.coinCost=Math.max(0,r.coinCost-avg*q);recordStrategyEvent(r,'现货网格卖出',fill,q,realized,fee,true);r.completedRounds=(r.completedRounds||0)+1}}
  r.gridIndex=next;r.lastPrice=p
}
function processFuturesGrid(r,p){
  const levels=gridLevels(r),old=r.gridIndex??gridIndex(r,r.lastPrice||p),next=gridIndex(r,p),dir=r.direction||'neutral';
  if(next<old){for(let i=old;i>next;i--){const lower=Math.max(0,i-1),fill=levels[lower];closeFuture(r,'short',lower,fill);if((dir==='long'||dir==='neutral')&&!r.longTargets[i])openFuture(r,'long',fill,i)}}
  if(next>old){for(let i=old+1;i<=next;i++){const fill=levels[i];closeFuture(r,'long',i,fill);if((dir==='short'||dir==='neutral')&&!r.shortTargets[i-1])openFuture(r,'short',fill,i-1)}}
  r.gridIndex=next;r.lastPrice=p
}
function finalizeOpenStrategyPositions(r,p,reason){
  if(r.kind==='spot-grid'&&r.coinQty>1e-12){const q=r.coinQty,avg=r.coinCost/q,proceeds=q*p,fee=proceeds*SPOT_FEE,realized=(p-avg)*q-fee;r.cash+=proceeds-fee;r.coinQty=0;r.coinCost=0;recordStrategyEvent(r,'现货网格结束卖出',p,q,realized,fee,true,reason)}
  if(r.kind==='futures-grid'){
    for(const k of Object.keys(r.longTargets||{}))closeFuture(r,'long',k,p,reason);for(const k of Object.keys(r.shortTargets||{}))closeFuture(r,'short',k,p,reason)
  }
}
function stopStrategy(id,reason='手动停止'){
  const r=strategyState.records.find(x=>String(x.id)===String(id));if(!r||r.status!=='running')return;const p=currentMark(r.symbol)||r.lastPrice||r.startPrice;
  finalizeOpenStrategyPositions(r,p,reason);const equity=Math.max(0,num(r.cash));r.status='stopped';r.endedAt=Date.now();r.stopReason=reason;r.finalEquity=equity;r.finalProfit=equity-r.amount;r.finalRoi=r.amount?r.finalProfit/r.amount*100:0;wallets.strategy.usdt+=equity;saveStrategyState();saveState();renderStrategyBottom();if(assetTab==='strategy'||assetTab==='stats')renderAssetPage();updateAssets();notify('策略已停止',`${r.name} ${r.finalProfit>=0?'+':''}${money(r.finalProfit)} USDT`,r.finalProfit>=0?'success':'warning')
}
function processStrategies(){
  if(!user)return;if((user.username||'')!==lastUser)loadStrategyState();let changed=false;
  for(const r of strategyState.records){if(r.status!=='running')continue;const p=currentMark(r.symbol);if(!p)continue;
    const before=r.trades||0;if(r.kind==='spot-grid')processSpotGrid(r,p);else processFuturesGrid(r,p);
    const eq=strategyEquity(r,p),roi=r.amount?(eq-r.amount)/r.amount*100:0;r.liveEquity=eq;r.liveProfit=eq-r.amount;r.liveRoi=roi;
    if(r.takeProfitPct>0&&roi>=r.takeProfitPct){stopStrategy(r.id,'达到止盈率');continue}
    if(r.stopLossPct>0&&roi<=-Math.abs(r.stopLossPct)){stopStrategy(r.id,'达到止损率');continue}
    if(!r.loop&&r.rounds>0&&(r.completedRounds||0)>=r.rounds){stopStrategy(r.id,'达到策略轮次');continue}
    if((r.trades||0)!==before)changed=true;
  }
  if(changed){saveStrategyState();saveState();renderStrategyBottom();if(assetTab==='stats'||assetTab==='strategy')renderAssetPage();updateAssets()}
}

/* ---------- HTX-style strategy creator ---------- */
function recommendedParams(kind=strategyKind){
  const p=currentMark()||price||1,s=marketSnapshots?.[symbol]||{},rawLow=num(s.low),rawHigh=num(s.high),low=rawLow>0?Math.min(rawLow,p*.975):p*.96,high=rawHigh>0?Math.max(rawHigh,p*1.025):p*1.04,span=Math.max(.01,(high-low)/p*100),grids=Math.max(8,Math.min(80,Math.round(span*3.5))),avail=num(wallets?.strategy?.usdt),amount=avail>0?Math.min(avail,Math.max(50,avail*.25)):0;return{low,high,grids,amount,leverage:kind==='futures-grid'?3:1}
}
function strategyName(kind){return kind==='spot-grid'?'现货网格':'合约网格'}
function renderStrategyPanel(fillRecommended=false){
  const panel=$v('strategyPanel');if(!panel)return;const r=recommendedParams(),m=currentMeta(),dec=configs?.[symbol]?.dec??m?.dec??2,available=num(wallets?.strategy?.usdt),isF=strategyKind==='futures-grid';
  panel.innerHTML=`<div class="gb24-strategy-shell">
    <div class="gb24-strategy-type"><button data-gb24-kind="spot-grid" class="${!isF?'active':''}">现货网格</button><button data-gb24-kind="futures-grid" class="${isF?'active':''}">合约网格</button></div>
    <div class="gb24-strategy-title"><div><small>${isF?'PERPETUAL GRID':'SPOT GRID'}</small><b>${esc(symbol)} · ${strategyName(strategyKind)}</b></div><span>策略账户 ${money(available)} USDT</span></div>
    <div class="gb24-strategy-subtabs"><button data-gb24-config="recommend">推荐机器人</button><button data-gb24-config="manual" class="active">手动配置</button></div>
    ${isF?`<div class="gb24-field-group"><label>方向</label><div class="gb24-segment" id="gb24Direction"><button data-dir="long">做多</button><button data-dir="neutral" class="active">中性</button><button data-dir="short">做空</button></div></div>`:''}
    <div class="gb24-field-group"><div class="gb24-field-head"><label>1. 价格区间</label><button id="gb24Recommend">智能参数</button></div><div class="gb24-double"><div><input id="gb24Low" type="number" min="0" step="any" value="${r.low.toFixed(dec)}"><span>最低价 USDT</span></div><div><input id="gb24High" type="number" min="0" step="any" value="${r.high.toFixed(dec)}"><span>最高价 USDT</span></div></div></div>
    <div class="gb24-field-group"><label>2. 网格数量</label><div class="gb24-inline-input"><input id="gb24Grids" type="number" min="2" max="200" step="1" value="${r.grids}"><select id="gb24GridMode"><option value="arithmetic">等差</option><option value="geometric">等比</option></select></div><small class="gb24-field-note">当前执行引擎使用等差价格网格；等比模式先保留界面入口。</small></div>
    ${isF?`<div class="gb24-field-group"><label>3. 杠杆倍数</label><div class="gb24-inline-input"><input id="gb24Leverage" type="number" min="1" max="100" step="1" value="${r.leverage}"><span class="gb24-unit">X</span></div></div>`:''}
    <div class="gb24-field-group"><label>${isF?'4':'3'}. 投入金额</label><div class="gb24-inline-input"><input id="gb24Amount" type="number" min="0" step="0.01" value="${r.amount?r.amount.toFixed(2):''}" placeholder="0.00"><span class="gb24-unit">USDT</span></div><div class="gb24-balance-line"><span>可用 ${money(available)} USDT</span><button id="gb24Transfer">划转资金</button></div></div>
    <details class="gb24-advanced"><summary>高级设置</summary><div class="gb24-advanced-grid"><label>止盈率<input id="gb24TakeProfit" type="number" min="0" max="10000" step="0.1" placeholder="可选"><span>%</span></label><label>止损率<input id="gb24StopLoss" type="number" min="0" max="100" step="0.1" placeholder="可选"><span>%</span></label></div><label class="gb24-check"><input id="gb24Loop" type="checkbox" checked> 策略循环</label><div class="gb24-loop-row"><span>循环轮次</span><input id="gb24Rounds" type="number" min="1" max="9999" step="1" value="20" disabled><small>关闭“策略循环”后生效</small></div></details>
    <div class="gb24-strategy-estimate"><span>当前参考价 <b>${pSafe(currentMark(),dec)}</b></span><span>预计每格投入 <b id="gb24PerGrid">--</b></span></div>
    <button class="gb24-create" id="gb24Create" ${available<=0?'disabled':''}>${available<=0?'请先向策略账户划转 USDT':'创建策略'}</button>
    <p class="gb24-risk">模拟策略仅在本地运行。网格策略不能消除单边行情风险，杠杆会放大盈亏。</p>
  </div>`;
  panel.onclick=handleStrategyPanelClick;panel.oninput=syncStrategyEstimate;panel.onchange=handleStrategyPanelChange;syncStrategyEstimate();
}
function pSafe(v,d){return num(v)>0?fmt(num(v),d):'--'}
function handleStrategyPanelChange(e){if(e.target?.id==='gb24Loop'){$v('gb24Rounds').disabled=e.target.checked}}
function handleStrategyPanelClick(e){
  const kind=e.target.closest('[data-gb24-kind]');if(kind){strategyKind=kind.dataset.gb24Kind;renderStrategyPanel();return}
  const dir=e.target.closest('[data-dir]');if(dir){$v('gb24Direction')?.querySelectorAll('[data-dir]').forEach(x=>x.classList.toggle('active',x===dir));return}
  const conf=e.target.closest('[data-gb24-config]');if(conf){if(conf.dataset.gb24Config==='recommend')applyRecommended();return}
  if(e.target.closest('#gb24Recommend')){applyRecommended();return}
  if(e.target.closest('#gb24Transfer')){openTransfer('fiat','strategy');return}
  if(e.target.closest('#gb24Create'))createGridStrategy();
}
function applyRecommended(){const r=recommendedParams();const dec=configs?.[symbol]?.dec??2;$v('gb24Low').value=r.low.toFixed(dec);$v('gb24High').value=r.high.toFixed(dec);$v('gb24Grids').value=r.grids;if($v('gb24Leverage'))$v('gb24Leverage').value=r.leverage;if(!$v('gb24Amount').value&&r.amount)$v('gb24Amount').value=r.amount.toFixed(2);syncStrategyEstimate();notify('已生成建议参数','基于当前价与 24H 高低区间生成，不代表收益承诺。','info')}
function syncStrategyEstimate(){const amount=num($v('gb24Amount')?.value),grids=Math.max(1,num($v('gb24Grids')?.value)),el=$v('gb24PerGrid');if(el)el.textContent=amount>0?`${money(amount/grids)} USDT`:'--'}
function createGridStrategy(){
  if(!user)return openAuth('login');const low=num($v('gb24Low')?.value),high=num($v('gb24High')?.value),grids=Math.floor(num($v('gb24Grids')?.value)),amount=num($v('gb24Amount')?.value),lev=Math.max(1,Math.min(window.GreedBitDomain?.MAX_LEVERAGE||100,Math.floor(num($v('gb24Leverage')?.value)||1))),p=currentMark(),available=num(wallets.strategy.usdt);
  if(!p)return notify('策略创建失败','当前交易对暂无有效价格','error');if(!(low>0&&high>low&&p>0))return notify('策略创建失败','请检查价格区间','error');if(grids<2||grids>200)return notify('策略创建失败','网格数量需为 2-200','error');if(amount<=0||amount>available+1e-8)return notify('策略创建失败','策略账户可用 USDT 不足','error');
  const direction=$v('gb24Direction')?.querySelector('.active')?.dataset.dir||'neutral',loop=!!$v('gb24Loop')?.checked,rounds=Math.max(1,Math.floor(num($v('gb24Rounds')?.value)||20));wallets.strategy.usdt-=amount;
  const rec={id:strategyState.seq++,kind:strategyKind,name:strategyName(strategyKind),symbol,status:'running',low,high,grids,amount,startPrice:p,lastPrice:p,gridIndex:0,createdAt:Date.now(),trades:0,closedTrades:0,wins:0,losses:0,realized:0,fees:0,takeProfitPct:num($v('gb24TakeProfit')?.value),stopLossPct:num($v('gb24StopLoss')?.value),loop,rounds,completedRounds:0};rec.gridIndex=gridIndex(rec,p);
  if(strategyKind==='spot-grid'){const seed=Math.min(amount*.5,amount),seedFee=seed*SPOT_FEE,seedNet=Math.max(0,seed-seedFee);rec.cash=Math.max(0,amount-seed);rec.coinQty=seedNet/p;rec.coinCost=seed;rec.unitQuote=Math.max(.01,amount/Math.max(4,grids+1));if(seed>0)recordStrategyEvent(rec,'现货网格初始建仓',p,rec.coinQty,null,seedFee,false,'初始化网格库存')}
  else{rec.cash=amount;rec.direction=direction;rec.leverage=lev;rec.unitMargin=Math.max(.01,amount/Math.max(6,Math.min(grids,24)));rec.longTargets={};rec.shortTargets={}}
  strategyState.records.unshift(rec);saveStrategyState();saveState();renderStrategyPanel();renderStrategyBottom();updateAssets();if(assetTab==='strategy'||assetTab==='stats')renderAssetPage();notify('策略已创建',`${rec.name} · ${symbol} · ${money(amount)} USDT`,'success')
}

function installStrategyUI(){
  document.querySelectorAll('[data-strategy="martingale"]').forEach(x=>x.remove());$v('strategyModal')?.classList.remove('show');
  const manual=$v('manualTradeTab'),strategy=$v('strategyTradeTab')||document.querySelector('.tradebox .tabs button:nth-child(2)');if(strategy)strategy.id='strategyTradeTab';
  if(manual)manual.onclick=()=>setStrategyTab(false);if(strategy)strategy.onclick=()=>setStrategyTab(true);
  ensureStrategyBottom();renderStrategyPanel();renderStrategyBottom();
}
function setStrategyTab(active){strategyTabActive=!!active;const manual=$v('manualTradeTab'),strategy=$v('strategyTradeTab'),panel=$v('strategyPanel'),futures=$v('futuresPanel'),spot=$v('spotPanel'),bottom=document.querySelector('.bottom');manual?.classList.toggle('active',!active);strategy?.classList.toggle('active',active);panel?.classList.toggle('hidden',!active);bottom?.classList.toggle('gb24-strategy-active',active);
  if(active){futures?.classList.add('hidden');spot?.classList.add('hidden');renderStrategyPanel();renderStrategyBottom()}
  else{try{renderTradingMode()}catch{if(tradingMode==='futures')futures?.classList.remove('hidden');else spot?.classList.remove('hidden')}renderTable()}
}
function ensureStrategyBottom(){
  const bottom=document.querySelector('.bottom');if(!bottom||$v('gb24StrategyBottom'))return;const d=document.createElement('div');d.id='gb24StrategyBottom';d.className='gb24-strategy-bottom';bottom.appendChild(d);d.onclick=e=>{const tab=e.target.closest('[data-gb24-bottom]');if(tab){strategyBottomMode=tab.dataset.gb24Bottom;renderStrategyBottom();return}const stop=e.target.closest('[data-gb24-stop]');if(stop)stopStrategy(stop.dataset.gb24Stop)}
}
function renderStrategyBottom(){const box=$v('gb24StrategyBottom');if(!box)return;const rows=strategyState.records.filter(r=>strategyBottomMode==='running'?r.status==='running':r.status!=='running');box.innerHTML=`<div class="gb24-bottom-tabs"><button data-gb24-bottom="running" class="${strategyBottomMode==='running'?'active':''}">当前策略 <span>(${strategyState.records.filter(r=>r.status==='running').length})</span></button><button data-gb24-bottom="history" class="${strategyBottomMode==='history'?'active':''}">历史策略 <span>(${strategyState.records.filter(r=>r.status!=='running').length})</span></button></div><div class="gb24-strategy-table-wrap"><table><thead><tr><th>策略名称</th><th>交易对</th><th>价格区间</th><th>网格</th><th>投入</th><th>当前/最终收益</th><th>收益率</th><th>成交次数</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.length?rows.map(strategyRow).join(''):'<tr><td colspan="10" class="empty">暂无策略</td></tr>'}</tbody></table></div>`}
function strategyRow(r){const eq=r.status==='running'?strategyEquity(r):num(r.finalEquity),profit=r.status==='running'?eq-r.amount:num(r.finalProfit),roi=r.amount?profit/r.amount*100:0,cls=profit>1e-9?'green':profit<-1e-9?'red':'muted';return`<tr><td><b>${esc(r.name)}</b><small>${r.kind==='futures-grid'?(r.direction==='long'?'做多':r.direction==='short'?'做空':'中性'):'低买高卖'}</small></td><td>${esc(r.symbol)}</td><td>${fmt(r.low,configs?.[r.symbol]?.dec??2)} - ${fmt(r.high,configs?.[r.symbol]?.dec??2)}</td><td>${r.grids}</td><td>${money(r.amount)} USDT</td><td class="${cls}">${profit>=0?'+':''}${money(profit)} USDT</td><td class="${cls}">${pctText(roi)}</td><td>${r.trades||0}</td><td>${r.status==='running'?'<span class="gb24-running">运行中</span>':esc(r.stopReason||'已停止')}</td><td>${r.status==='running'?`<button class="gb24-link danger" data-gb24-stop="${r.id}">停止策略</button>`:'--'}</td></tr>`}

/* ---------- account statistics ---------- */
function replaySpotStats(){
  const ordered=[...(spotTrades||[])].sort((a,b)=>num(a.ts)-num(b.ts)),book={},out=[];
  for(const t of ordered){const sym=t.symbol||'',q=Math.max(0,num(t.qty)),p=num(t.price),fee=Math.max(0,num(t.fee));if(!sym||!q||!p)continue;const b=book[sym]||(book[sym]={qty:0,cost:0});if(t.side==='buy'){b.qty+=q;b.cost+=q*p+fee}else if(t.side==='sell'){const take=Math.min(q,b.qty),avg=b.qty>0?b.cost/b.qty:0,realized=(p-avg)*take-fee;b.qty=Math.max(0,b.qty-take);b.cost=Math.max(0,b.cost-avg*take);out.push({symbol:sym,pnl:realized})}}
  return out
}
function blankMatrix(){const x={};for(const c of['crypto','stock','forex','commodity'])x[c]={spot:{trades:0,closed:0,wins:0},futures:{trades:0,closed:0,wins:0},strategy:{trades:0,closed:0,wins:0}};return x}
function collectPerformance(){
  const matrix=blankMatrix();for(const t of spotTrades||[]){const c=assetClass(t.symbol);if(matrix[c])matrix[c].spot.trades++}for(const x of replaySpotStats()){const c=assetClass(x.symbol);if(!matrix[c])continue;matrix[c].spot.closed++;if(x.pnl>0)matrix[c].spot.wins++}
  for(const t of trades||[]){const c=assetClass(t.symbol);if(matrix[c])matrix[c].futures.trades++}for(const p of closedPositions||[]){const c=assetClass(p.symbol);if(!matrix[c])continue;matrix[c].futures.closed++;if(num(p.realized)>0)matrix[c].futures.wins++}
  for(const e of strategyState.events||[]){const c=e.assetClass||assetClass(e.symbol);if(!matrix[c])continue;matrix[c].strategy.trades++;if(e.closed&&e.pnl!=null){matrix[c].strategy.closed++;if(num(e.pnl)>0)matrix[c].strategy.wins++}}
  const inflow=num(accountStats.inflow),outflow=num(accountStats.outflow),assets=num(totalAsset()),performance=assets+outflow-inflow,roi=inflow>0?performance/inflow*100:null,deposits=(ledger||[]).filter(x=>x.type==='入金').length,withdrawals=(ledger||[]).filter(x=>x.type==='出金').length;return{matrix,inflow,outflow,assets,performance,roi,deposits,withdrawals,netDeposit:inflow-outflow}
}
function winText(x){return x.closed?`${(x.wins/x.closed*100).toFixed(1)}% (${x.wins}/${x.closed})`:'--'}
function renderPerformanceStats(){
  const box=$v('assetPageBody');if(!box)return;if(!user){box.innerHTML='<div class="asset-detail"><h3>请先登录</h3></div>';return}const d=collectPerformance(),perfCls=d.performance>1e-8?'green':d.performance<-1e-8?'red':'muted';let verdict='尚未入金，暂无可比较的真实资金模拟记录。';if(d.inflow>0)verdict=d.performance>0?'当前模拟结果为净盈利。继续关注样本量和回撤，不要只看短期胜率。':d.performance<0?'当前模拟结果为净亏损。继续追加入金不会改善策略本身，先检查交易方式和风险控制。':'当前模拟结果接近盈亏平衡。';
  const rows=['crypto','stock','forex','commodity'].map(c=>{const r=d.matrix[c];return`<tr><td><b>${classLabel(c)}</b></td><td>${r.spot.trades}</td><td>${winText(r.spot)}</td><td>${r.futures.trades}</td><td>${winText(r.futures)}</td><td>${r.strategy.trades}</td><td>${winText(r.strategy)}</td></tr>`}).join('');
  box.innerHTML=`<div class="gb24-stats-page"><div class="gb24-stats-hero"><div><small>REALISTIC PERFORMANCE</small><h2>账号交易统计</h2><p>所有外部模拟资金只通过“入金”进入账户。核心比较指标使用当前资产、累计出金和累计入金共同计算。</p></div><div class="gb24-performance ${perfCls}"><small>现实等效净收益</small><strong>${d.performance>=0?'+':''}${money(d.performance)} USDT</strong><span>${d.roi==null?'未入金':`相对累计入金 ${pctText(d.roi)}`}</span></div></div>
  <div class="gb24-cashflow-grid"><div><small>累计入金</small><b>${money(d.inflow)} USDT</b><span>${d.deposits} 次</span></div><div><small>累计出金</small><b>${money(d.outflow)} USDT</b><span>${d.withdrawals} 次</span></div><div><small>净入金</small><b class="${d.netDeposit>0?'red':d.netDeposit<0?'green':''}">${d.netDeposit>=0?'+':''}${money(d.netDeposit)} USDT</b><span>入金 - 出金</span></div><div><small>当前总资产</small><b>${money(d.assets)} USDT</b><span>含持仓与运行中策略</span></div></div>
  <div class="gb24-performance-note ${perfCls}"><b>${verdict}</b><span>净收益公式：当前总资产 + 累计出金 − 累计入金。出金大于入金是强盈利信号，但不是唯一判断标准。</span></div>
  <section class="gb24-stat-section"><div class="gb24-stat-head"><h3>交易次数与胜率</h3><span>胜率只统计已完成并产生盈亏的交易；开仓/买入本身不计为胜负。</span></div><div class="gb24-stat-table"><table><thead><tr><th>市场</th><th>现货成交</th><th>现货胜率</th><th>合约成交</th><th>合约胜率</th><th>策略成交</th><th>策略胜率</th></tr></thead><tbody>${rows}</tbody></table></div></section></div>`
}
function renderStrategyAsset(){const box=$v('assetPageBody');if(!box)return;const active=strategyState.records.filter(r=>r.status==='running'),running=active.reduce((a,r)=>a+strategyEquity(r),0),available=num(wallets.strategy.usdt),total=available+running;box.innerHTML=`<div class="asset-detail gb24-strategy-asset"><div class="gb24-asset-head"><div><h3>策略账户</h3><p>策略创建后，投入资金会从可用余额转入运行中的机器人。</p></div><button class="primary" id="gb24AssetTransfer">划转</button></div><div class="gb24-cashflow-grid"><div><small>策略总权益</small><b>${money(total)} USDT</b></div><div><small>可用余额</small><b>${money(available)} USDT</b></div><div><small>运行中策略</small><b>${active.length}</b></div><div><small>策略浮动收益</small><b class="${running-active.reduce((a,r)=>a+r.amount,0)>=0?'green':'red'}">${money(running-active.reduce((a,r)=>a+r.amount,0))} USDT</b></div></div><div class="gb24-asset-strategy-list">${active.length?active.map(r=>`<div><span><b>${esc(r.name)}</b><small>${esc(r.symbol)}</small></span><strong>${money(strategyEquity(r))} USDT</strong></div>`).join(''):'<p class="muted">暂无运行中的策略。</p>'}</div></div>`;$v('gb24AssetTransfer')?.addEventListener('click',()=>openTransfer('fiat','strategy'))}
function installStatsTab(){const sub=$v('assetSubnav');if(sub&&!sub.querySelector('[data-assettab="stats"]'))sub.insertAdjacentHTML('beforeend','<button data-assettab="stats">统计</button>');const inheritedRender=renderAssetPage;renderAssetPage=function(){if(assetTab==='stats')return renderPerformanceStats();if(assetTab==='strategy')return renderStrategyAsset();return inheritedRender()}}

/* sync strategy state across auth changes */
const inheritedSyncAuth=syncAuth;
syncAuth=function(){const out=inheritedSyncAuth.apply(this,arguments);loadStrategyState();renderStrategyBottom();if(strategyTabActive)renderStrategyPanel();return out};

function updateVersion(){const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));if(el)el.textContent=`GreedBit v${VERSION}`}
function installStyle(){if(document.querySelector('link[href^="styles/v024.css"]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href=cssHref('styles/v024.css');document.head.appendChild(l)}
function boot(){
  installStyle();loadStrategyState();installStatsTab();installStrategyUI();updateVersion();
  every(()=>{processStrategies();if(strategyTabActive)renderStrategyBottom()},1200);
  window.GreedBitV24={VERSION,collectPerformance,strategyEquity,stopStrategy,get state(){return strategyState}};
}
boot();
})();
})();
