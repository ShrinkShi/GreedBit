/* tables/assets */
function updateAssets(){
  const yes=!!user;if(!yes)return;
  $('posCount').textContent=`(${positions.length})`;$('openCount').textContent=`(${orders.length})`;$('spotOpenCount').textContent=`(${spotOrders.length})`;
  const c=base(),fw=futuresWallet(),sw=spotWallet(),un=totalUnrealized();
  if(tradingMode==='futures')$('sideAssetBody').innerHTML=`<div class="assetrow"><span>合约账户权益</span><b>${fmt(futuresEquity())} USDT</b></div><div class="assetrow"><span>可用余额</span><span>${fmt(fw.usdt)}</span></div><div class="assetrow"><span>冻结保证金</span><span>${fmt(fw.frozen)}</span></div><div class="assetrow"><span>仓位保证金</span><span>${fmt(usedMargin())}</span></div><div class="assetrow"><span>未实现盈亏</span><span class="${un>=0?'green':'red'}">${un>=0?'+':''}${fmt(un)}</span></div>`;
  else $('sideAssetBody').innerHTML=`<div class="assetrow"><span>现货 USDT</span><b>${fmt(sw.usdt)}</b></div><div class="assetrow"><span>${c} 持仓</span><span>${fmt(sw.coins[c]||0,6)}</span></div><div class="assetrow"><span>${c} 估值</span><span>${fmt((sw.coins[c]||0)*price)} USDT</span></div><div class="assetrow"><span>冻结 USDT</span><span>${fmt(sw.frozenUsdt)}</span></div>`;
  $('usdtBal').textContent=fmt(fw.usdt);$('buyBtn').textContent='开多 '+c;$('sellBtn').textContent='开空 '+c;
  renderAssetPage();$('homeTotalAsset').textContent=fmt(totalAsset())+' USDT';
}
function renderFuturesTable(){
  $('positionFilters').classList.toggle('hidden',tableMode!=='positions');
  if(tableMode==='positions'){const rows=positions.filter(p=>posFilter==='all'||p.mode===posFilter).map(p=>({...p,mark:markFor(p.symbol),pnl:pnlOf(p),roe:p.margin?pnlOf(p)/p.margin*100:0}));$('thead').innerHTML='<tr><th>合约</th><th>方向</th><th>模式</th><th>杠杆</th><th>开仓价</th><th>标记价</th><th>保证金</th><th>未实现盈亏</th><th>ROE</th><th>强平价</th><th>操作</th></tr>';$('tbody').innerHTML=rows.length?rows.map(r=>`<tr><td>${r.symbol} 永续</td><td class="${r.side==='long'?'green':'red'}">${r.side==='long'?'多':'空'}</td><td>${r.mode==='cross'?'全仓':'逐仓'}</td><td>${r.leverage}X</td><td>${fmt(r.entry,(configs[r.symbol]?.dec ?? 2))}</td><td>${fmt(r.mark,(configs[r.symbol]?.dec ?? 2))}</td><td>${fmt(r.margin)}</td><td class="${r.pnl>=0?'green':'red'}">${r.pnl>=0?'+':''}${fmt(r.pnl)}</td><td class="${r.roe>=0?'green':'red'}">${r.roe.toFixed(2)}%</td><td>${fmt(r.liq||0,(configs[r.symbol]?.dec ?? 2))}</td><td><button class="reducepos" data-reduce="${r.id}">减仓50%</button><button class="closepos" data-closepos="${r.id}">全平</button></td></tr>`).join(''):'<tr><td colspan="11" class="empty">暂无持仓</td></tr>';return}
  if(tableMode==='open'){$('thead').innerHTML='<tr><th>时间</th><th>合约</th><th>方向</th><th>限价</th><th>保证金</th><th>杠杆</th><th>操作</th></tr>';$('tbody').innerHTML=orders.length?orders.map(o=>`<tr><td>${o.createdAt}</td><td>${o.symbol}</td><td>${o.side==='long'?'开多':'开空'}</td><td>${fmt(o.limit,(configs[o.symbol]?.dec ?? 2))}</td><td>${fmt(o.margin)}</td><td>${o.leverage}X</td><td><button class="cancel" data-cancel="${o.id}">撤单</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">暂无委托</td></tr>';return}
  const maps={orders:[orderHistory,'历史委托'],history:[trades,'成交记录'],closed:[closedPositions,'历史仓位'],ledger:[ledger.filter(x=>x.wallet==='futures'),'财务记录']},m=maps[tableMode]||maps.history,arr=m[0];
  $('thead').innerHTML='<tr><th>时间</th><th>项目</th><th>交易对</th><th>详情</th><th>金额/价格</th></tr>';
  $('tbody').innerHTML=arr.length?arr.map(x=>`<tr><td>${x.finishedAt||x.closedAt||x.time||'-'}</td><td>${x.status||x.reason||x.type||m[1]}</td><td>${x.symbol||'-'}</td><td>${x.note||x.side||'-'}</td><td>${x.amount!=null?fmt(x.amount):x.price!=null?fmt(x.price,configs[x.symbol]?.dec||2):x.realized!=null?fmt(x.realized):'-'}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">暂无${m[1]}</td></tr>`;
}
function renderSpotTable(){
  $('positionFilters').classList.add('hidden');const sw=spotWallet();
  if(tableMode==='spotAssets'){$('thead').innerHTML='<tr><th>资产</th><th>可用</th><th>冻结</th><th>估值(USDT)</th></tr>';$('tbody').innerHTML=`<tr><td>USDT</td><td>${fmt(sw.usdt)}</td><td>${fmt(sw.frozenUsdt)}</td><td>${fmt(sw.usdt+sw.frozenUsdt)}</td></tr>`+coinKeys.map(c=>`<tr><td>${c}</td><td>${fmt(spotAvailableCoin(c),6)}</td><td>${fmt(sw.frozenCoins[c]||0,6)}</td><td>${fmt((sw.coins[c]||0)*markFor(c+'/USDT'))}</td></tr>`).join('');return}
  if(tableMode==='spotOpen'){$('thead').innerHTML='<tr><th>时间</th><th>交易对</th><th>方向</th><th>限价</th><th>数量/金额</th><th>操作</th></tr>';$('tbody').innerHTML=spotOrders.length?spotOrders.map(o=>`<tr><td>${o.createdAt}</td><td>${o.symbol}</td><td class="${o.side==='buy'?'green':'red'}">${o.side==='buy'?'买入':'卖出'}</td><td>${fmt(o.limit,(configs[o.symbol]?.dec ?? 2))}</td><td>${o.side==='buy'?fmt(o.amount)+' USDT':fmt(o.qty,6)+' '+o.symbol.split('/')[0]}</td><td><button class="cancel" data-cancelspot="${o.id}">撤单</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">暂无现货委托</td></tr>';return}
  const arr=tableMode==='spotOrders'?spotOrderHistory:spotTrades;$('thead').innerHTML='<tr><th>时间</th><th>交易对</th><th>方向</th><th>价格</th><th>状态/类型</th></tr>';$('tbody').innerHTML=arr.length?arr.map(o=>`<tr><td>${o.finishedAt||o.time}</td><td>${o.symbol}</td><td class="${o.side==='buy'?'green':'red'}">${o.side==='buy'?'买入':'卖出'}</td><td>${fmt(o.limit||o.price,(configs[o.symbol]?.dec ?? 2))}</td><td>${o.status||o.type}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">暂无记录</td></tr>';
}
function renderTable(){if(!user){$('positionFilters').classList.add('hidden');$('thead').innerHTML='<tr><th></th></tr>';$('tbody').innerHTML='<tr><td class="empty">登录后查看账户数据</td></tr>';return}tradingMode==='futures'?renderFuturesTable():renderSpotTable()}

function renderAssetPage(){
  if(!user){$('assetPageBody').innerHTML='<div class="asset-detail"><h3>请先登录</h3><p class="muted">登录后可查看分账户资产并进行划转。</p></div>';return}
  const total=totalAsset(),sw=spotWallet(),fw=futuresWallet();
  if(assetTab==='overview'){$('assetPageBody').innerHTML=`<div class="asset-overview-total"><small>总账户估值</small><strong>${fmt(total)} USDT</strong></div><div class="wallet-grid">${['spot','futures','earn','fiat','strategy'].map(k=>`<div class="wallet-card"><div class="wallet-title"><b>${walletNames[k]}账户</b><button class="linkbtn" data-openwallet="${k}">查看</button></div><strong>${fmt(k==='spot'?sw.usdt+sw.frozenUsdt+spotCoinValue():k==='futures'?futuresEquity():walletUsdt(k))} USDT</strong><small>${k==='spot'?'含币种持仓估值':k==='futures'?'含仓位未实现盈亏':'独立可用余额'}</small></div>`).join('')}</div>`;return}
  if(assetTab==='spot'){$('assetPageBody').innerHTML=`<div class="asset-detail"><h3>现货账户</h3><div class="asset-list-row"><b>资产</b><b>数量</b><b>估值</b></div><div class="asset-list-row"><span>USDT</span><span>${fmt(sw.usdt)}</span><span>${fmt(sw.usdt)} USDT</span></div>${coinKeys.map(c=>`<div class="asset-list-row"><span>${c}</span><span>${fmt(sw.coins[c]||0,6)}</span><span>${fmt((sw.coins[c]||0)*markFor(c+'/USDT'))} USDT</span></div>`).join('')}</div>`;return}
  if(assetTab==='futures'){$('assetPageBody').innerHTML=`<div class="asset-detail"><h3>合约账户</h3><div class="asset-list-row"><span>可用 USDT</span><span>${fmt(fw.usdt)}</span><span></span></div><div class="asset-list-row"><span>冻结保证金</span><span>${fmt(fw.frozen)}</span><span></span></div><div class="asset-list-row"><span>仓位保证金</span><span>${fmt(usedMargin())}</span><span></span></div><div class="asset-list-row"><span>未实现盈亏</span><span class="${totalUnrealized()>=0?'green':'red'}">${fmt(totalUnrealized())}</span><span></span></div><div class="asset-list-row"><b>账户权益</b><b>${fmt(futuresEquity())}</b><b>USDT</b></div></div>`;return}
  const val=walletUsdt(assetTab);$('assetPageBody').innerHTML=`<div class="asset-detail"><h3>${walletNames[assetTab]}账户</h3><div class="asset-overview-total"><small>可用余额</small><strong>${fmt(val)} USDT</strong></div><p class="muted">当前版本仅实现 USDT 子账户余额与账户间划转；${walletNames[assetTab]}业务功能将在后续版本补充。</p></div>`;
}

/* realisedProfit/Loss are already net of fees (see closePosition / spotFill / grid),
 * so fees must not be subtracted a second time here. */
function netRealized(){return accountStats.realizedProfit-accountStats.realizedLoss+accountStats.fundingReceived-accountStats.fundingPaid}
function openStatsModal(){const s=accountStats,tiles=[['总资产',totalAsset()],['入金',s.inflow],['出金',s.outflow],['已实现盈利',s.realizedProfit],['已实现亏损',s.realizedLoss],['手续费',s.fees],['资金费净额',s.fundingReceived-s.fundingPaid],['净已实现收益',netRealized()],['爆仓次数',s.liquidations],['合约成交',s.trades],['现货成交',s.spotTrades],['账户划转',s.transfers]];$('statGrid').innerHTML=tiles.map(([k,v])=>`<div class="stat-tile"><small>${k}</small><b class="${typeof v==='number'&&v<0?'negative':''}">${k.includes('次数')||k.includes('成交')||k.includes('划转')?v:fmt(v)+' USDT'}</b></div>`).join('');$('statsModal').classList.add('show')}

/* funding/transfer */
function openFund(mode='deposit'){if(!user)return openAuth('login');fundMode=mode;$('fundTitle').textContent=mode==='deposit'?'模拟入金':'模拟出金';$('fundDesc').textContent=mode==='deposit'?'资金进入法币账户，再通过划转进入现货或合约账户。':'从法币账户扣除 USDT，用于统计模拟出金。';$('fundAmount').value='';$('fundModal').classList.add('show')}
function confirmFund(){if(!ensureStateFresh())return;const amt=+$('fundAmount').value;if(!amt||amt<=0)return notify('操作失败','请输入有效金额','error');if(fundMode==='deposit'){wallets.fiat.usdt+=amt;accountStats.inflow+=amt;addLedger('入金',amt,'','模拟入金','fiat');notify('入金成功',`法币账户 +${fmt(amt)} USDT`)}else{if(amt>wallets.fiat.usdt)return notify('出金失败','法币账户余额不足','error');wallets.fiat.usdt-=amt;accountStats.outflow+=amt;addLedger('出金',-amt,'','模拟出金','fiat');notify('出金成功',`法币账户 -${fmt(amt)} USDT`,'info')}$('fundModal').classList.remove('show');saveState();updateAssets();renderAssetPage()}
function openTransfer(from='fiat',to='futures'){if(!user)return openAuth('login');const opts=Object.entries(walletNames).map(([k,v])=>`<option value="${k}">${v}账户</option>`).join('');$('transferFrom').innerHTML=opts;$('transferTo').innerHTML=opts;$('transferFrom').value=from;$('transferTo').value=to;updateTransferAvailable();$('transferAmount').value='';$('transferModal').classList.add('show')}
function updateTransferAvailable(){$('transferAvailable').textContent=`可用：${fmt(walletUsdt($('transferFrom').value))} USDT`}
function confirmTransfer(){if(!ensureStateFresh())return;const from=$('transferFrom').value,to=$('transferTo').value,amt=+$('transferAmount').value;if(from===to)return notify('划转失败','转出和转入账户不能相同','error');if(!amt||amt<=0)return notify('划转失败','请输入有效金额','error');if(amt>walletUsdt(from))return notify('划转失败',`${walletNames[from]}账户余额不足`,'error');setWalletUsdt(from,walletUsdt(from)-amt);setWalletUsdt(to,walletUsdt(to)+amt);accountStats.transfers++;addLedger('账户划转',amt,'',`${walletNames[from]} → ${walletNames[to]}`,from);$('transferModal').classList.remove('show');notify('划转成功',`${walletNames[from]} → ${walletNames[to]} ${fmt(amt)} USDT`);saveState();updateAssets();renderTable();renderAssetPage()}

/* admin */
function renderAdminPage(){
  if(!isAdminMode())return;
  const users=safeParse(localStorage.getItem('greedbit_users'),{});
  const rows=Object.values(users).map(u=>({...u,role:'用户'}));
  const approxStorage=Object.keys(localStorage).reduce((n,k)=>n+(localStorage.getItem(k)?.length||0)+k.length,0);
  $('adminSummary').innerHTML=`
    <div class="admin-stat"><small>本地账户</small><b>${rows.length}</b></div>
    <div class="admin-stat"><small>真实行情</small><b class="${marketReady?'green':'red'}">${marketReady?'已连接':'未连接'}</b></div>
    <div class="admin-stat"><small>真实快讯</small><b>${newsItems.length}</b></div>
    <div class="admin-stat"><small>LocalStorage</small><b>${(approxStorage/1024).toFixed(1)} KB</b></div>`;
  $('adminUserTable').innerHTML=rows.map(u=>{
    const hasState=!!localStorage.getItem(`greedbit_state_${u.username}`);
    return `<tr><td>${escapeHtml(u.username)}</td><td>${u.role}</td><td>${u.createdAt?new Date(u.createdAt).toLocaleString():'内置账号'}</td><td>${hasState?'有':'无'}</td></tr>`;
  }).join('');
}

/* real news */
const NEWS_SOURCES=[
  {name:'CoinDesk',url:'https://www.coindesk.com/arc/outboundfeeds/rss/'}
];
let newsLoading=false;
function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function stripHtml(v=''){const d=document.createElement('div');d.innerHTML=v;return (d.textContent||'').replace(/\s+/g,' ').trim()}
function newsHash(s=''){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function inferNewsMeta(text=''){
  const t=text.toLowerCase();
  const symbol=/\bbitcoin\b|\bbtc\b/.test(t)?'BTC/USDT':(/\bethereum\b|\bether\b|\beth\b/.test(t)?'ETH/USDT':'MARKET');
  let kind='市场';
  if(/sec|regulat|law|court|government|congress|policy|ban|etf/.test(t))kind='监管';
  else if(/whale|wallet|on-chain|onchain|transfer/.test(t))kind='鲸鱼';
  else if(/fund|institution|blackrock|fidelity|bank|company|treasury/.test(t))kind='机构';
  else if(/upgrade|network|protocol|developer|layer|fork|technology/.test(t))kind='技术';
  const important=/sec|etf|hack|exploit|lawsuit|ban|fed|rate cut|rate hike|liquidat|record high|all-time high/.test(t);
  const pos=/approve|approval|surge|gain|rise|rally|inflow|record high|all-time high|adopt|launch/.test(t);
  const neg=/hack|exploit|drop|fall|plunge|lawsuit|ban|outflow|liquidat|fraud|crash/.test(t);
  return{symbol,kind,important,sentiment:pos&&!neg?1:neg&&!pos?-1:0};
}
async function fetchNewsText(url){
  try{
    const r=await fetch(url,{cache:'no-store'});if(r.ok)return await r.text();
  }catch{}
  const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url);
  const r=await fetch(proxy,{cache:'no-store'});if(!r.ok)throw new Error(`RSS proxy HTTP ${r.status}`);return await r.text();
}
function parseRss(xml,source){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('RSS parse error');
  const voteMap=JSON.parse(localStorage.getItem('greedbit_news_votes')||'{}');
  return [...doc.querySelectorAll('item')].slice(0,60).map((it,i)=>{
    const title=stripHtml(it.querySelector('title')?.textContent||'');
    const desc=stripHtml(it.querySelector('description')?.textContent||'').slice(0,420);
    const link=(it.querySelector('link')?.textContent||'').trim();
    const pub=Date.parse(it.querySelector('pubDate')?.textContent||'')||Date.now();
    const id=`${source.name}-${newsHash(link||title)}`,meta=inferNewsMeta(title+' '+desc),seed=newsHash(title);
    const baseBull=24+(seed%210),baseBear=18+((seed>>>8)%190),userVote=voteMap[id]||null;
    return{id,time:new Date(pub).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),publishedAt:pub,source:source.name,link,title,desc,...meta,bull:baseBull+(userVote==='bull'?1:0),bear:baseBear+(userVote==='bear'?1:0),userVote};
  });
}
function seedNewsHistory(){newsItems=[];renderNews()}
async function loadRealNews(showToast=false){
  if(newsLoading)return;newsLoading=true;
  try{
    const batches=[];
    for(const src of NEWS_SOURCES){
      try{batches.push(...parseRss(await fetchNewsText(src.url),src))}catch(e){console.warn(`${src.name} news failed`,e)}
    }
    if(!batches.length)throw new Error('no news source available');
    const unique=new Map();for(const n of batches.sort((a,b)=>b.publishedAt-a.publishedAt))if(!unique.has(n.id))unique.set(n.id,n);
    newsItems=[...unique.values()].slice(0,80);renderNews();if(showToast)notify('快讯已刷新',`已获取 ${newsItems.length} 条真实资讯`,'success');if(isAdminMode())renderAdminPage();
  }catch(e){
    console.warn('news load failed',e);renderNews();if(showToast)notify('快讯刷新失败','CoinDesk RSS 或跨域代理暂不可用','error',5000);
  }finally{newsLoading=false}
}
function resolveNews(){}
function voteNews(id,vote){
  const n=newsItems.find(x=>String(x.id)===String(id));if(!n||n.userVote===vote)return;
  const map=JSON.parse(localStorage.getItem('greedbit_news_votes')||'{}');map[n.id]=vote;localStorage.setItem('greedbit_news_votes',JSON.stringify(map));
  n.userVote=vote;if(vote==='bull')n.bull++;else n.bear++;renderNews();
}
function newsMatches(n){
  if($('importantOnly').checked&&!n.important)return false;if(newsFilter==='all')return true;
  if(newsFilter==='BTC'||newsFilter==='ETH')return n.symbol.startsWith(newsFilter);
  if(newsFilter==='直播')return true;
  return n.kind===newsFilter;
}
function renderNews(){
  const items=newsItems.filter(newsMatches);
  if(!items.length){$('newsList').innerHTML=`<div class="empty">${newsLoading?'正在加载真实快讯…':'当前筛选条件暂无快讯'}</div>`;return}
  $('newsList').innerHTML=items.map(n=>{
    const total=n.bull+n.bear,bp=total?Math.round(n.bull/total*100):50,href=/^https?:\/\//.test(n.link)?n.link:'#';
    return `<article class="news-card"><span class="news-time">${escapeHtml(n.time)}</span><i class="news-dot"></i><div class="news-box ${n.important?'important':''}">
      <div class="news-title-row"><h3><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.title)}</a></h3><span class="news-status good">${escapeHtml(n.source)}</span></div>
      <p>${escapeHtml(n.desc||'')}</p>
      <div class="news-meta-line"><span>${n.symbol==='MARKET'?'全市场':escapeHtml(n.symbol)}</span><span>${escapeHtml(n.kind)}</span><span class="impact-chip ${n.sentiment<0?'neg':''}">${n.sentiment>0?'偏多':n.sentiment<0?'偏空':'中性'}</span><span>${new Date(n.publishedAt).toLocaleDateString()}</span></div>
      <div class="vote-row"><button class="vote-btn bull ${n.userVote==='bull'?'active':''}" data-newsvote="bull" data-newsid="${escapeHtml(n.id)}">↑ 利好 ${n.bull}</button><button class="vote-btn bear ${n.userVote==='bear'?'active':''}" data-newsvote="bear" data-newsid="${escapeHtml(n.id)}">↓ 利空 ${n.bear}</button><span class="vote-summary">社区倾向（本地模拟）：${bp}% 看多 · ${100-bp}% 看空</span></div>
    </div></article>`;
  }).join('');
}
