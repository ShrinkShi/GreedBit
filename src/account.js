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
  if(tableMode==='positions'){const rows=positions.filter(p=>posFilter==='all'||p.mode===posFilter).map(p=>({...p,mark:markFor(p.symbol),pnl:pnlOf(p),roe:p.margin?pnlOf(p)/p.margin*100:0}));$('thead').innerHTML='<tr><th>合约</th><th>方向</th><th>模式</th><th>杠杆</th><th>开仓价</th><th>标记价</th><th>保证金</th><th>未实现盈亏</th><th>ROE</th><th>强平价</th><th>操作</th></tr>';$('tbody').innerHTML=rows.length?rows.map(r=>`<tr><td>${r.symbol} 永续</td><td class="${r.side==='long'?'green':'red'}">${r.side==='long'?'多':'空'}</td><td>${r.mode==='cross'?'全仓':'逐仓'}</td><td>${r.leverage}X</td><td>${fmt(r.entry,configs[r.symbol].dec)}</td><td>${fmt(r.mark,configs[r.symbol].dec)}</td><td>${fmt(r.margin)}</td><td class="${r.pnl>=0?'green':'red'}">${r.pnl>=0?'+':''}${fmt(r.pnl)}</td><td class="${r.roe>=0?'green':'red'}">${r.roe.toFixed(2)}%</td><td>${fmt(r.liq||0,configs[r.symbol].dec)}</td><td><button class="reducepos" data-reduce="${r.id}">减仓50%</button><button class="closepos" data-closepos="${r.id}">全平</button></td></tr>`).join(''):'<tr><td colspan="11" class="empty">暂无持仓</td></tr>';return}
  if(tableMode==='open'){$('thead').innerHTML='<tr><th>时间</th><th>合约</th><th>方向</th><th>限价</th><th>保证金</th><th>杠杆</th><th>操作</th></tr>';$('tbody').innerHTML=orders.length?orders.map(o=>`<tr><td>${o.createdAt}</td><td>${o.symbol}</td><td>${o.side==='long'?'开多':'开空'}</td><td>${fmt(o.limit,configs[o.symbol].dec)}</td><td>${fmt(o.margin)}</td><td>${o.leverage}X</td><td><button class="cancel" data-cancel="${o.id}">撤单</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">暂无委托</td></tr>';return}
  const maps={orders:[orderHistory,'历史委托'],history:[trades,'成交记录'],closed:[closedPositions,'历史仓位'],ledger:[ledger.filter(x=>x.wallet==='futures'),'财务记录']},m=maps[tableMode]||maps.history,arr=m[0];
  $('thead').innerHTML='<tr><th>时间</th><th>项目</th><th>交易对</th><th>详情</th><th>金额/价格</th></tr>';
  $('tbody').innerHTML=arr.length?arr.map(x=>`<tr><td>${x.finishedAt||x.closedAt||x.time||'-'}</td><td>${x.status||x.reason||x.type||m[1]}</td><td>${x.symbol||'-'}</td><td>${x.note||x.side||'-'}</td><td>${x.amount!=null?fmt(x.amount):x.price!=null?fmt(x.price,configs[x.symbol]?.dec||2):x.realized!=null?fmt(x.realized):'-'}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">暂无${m[1]}</td></tr>`;
}
function renderSpotTable(){
  $('positionFilters').classList.add('hidden');const sw=spotWallet();
  if(tableMode==='spotAssets'){$('thead').innerHTML='<tr><th>资产</th><th>可用</th><th>冻结</th><th>估值(USDT)</th></tr>';$('tbody').innerHTML=`<tr><td>USDT</td><td>${fmt(sw.usdt)}</td><td>${fmt(sw.frozenUsdt)}</td><td>${fmt(sw.usdt+sw.frozenUsdt)}</td></tr>`+coinKeys.map(c=>`<tr><td>${c}</td><td>${fmt(spotAvailableCoin(c),6)}</td><td>${fmt(sw.frozenCoins[c]||0,6)}</td><td>${fmt((sw.coins[c]||0)*markFor(c+'/USDT'))}</td></tr>`).join('');return}
  if(tableMode==='spotOpen'){$('thead').innerHTML='<tr><th>时间</th><th>交易对</th><th>方向</th><th>限价</th><th>数量/金额</th><th>操作</th></tr>';$('tbody').innerHTML=spotOrders.length?spotOrders.map(o=>`<tr><td>${o.createdAt}</td><td>${o.symbol}</td><td class="${o.side==='buy'?'green':'red'}">${o.side==='buy'?'买入':'卖出'}</td><td>${fmt(o.limit,configs[o.symbol].dec)}</td><td>${o.side==='buy'?fmt(o.amount)+' USDT':fmt(o.qty,6)+' '+o.symbol.split('/')[0]}</td><td><button class="cancel" data-cancelspot="${o.id}">撤单</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">暂无现货委托</td></tr>';return}
  const arr=tableMode==='spotOrders'?spotOrderHistory:spotTrades;$('thead').innerHTML='<tr><th>时间</th><th>交易对</th><th>方向</th><th>价格</th><th>状态/类型</th></tr>';$('tbody').innerHTML=arr.length?arr.map(o=>`<tr><td>${o.finishedAt||o.time}</td><td>${o.symbol}</td><td class="${o.side==='buy'?'green':'red'}">${o.side==='buy'?'买入':'卖出'}</td><td>${fmt(o.limit||o.price,configs[o.symbol].dec)}</td><td>${o.status||o.type}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">暂无记录</td></tr>';
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

function netRealized(){return accountStats.realizedProfit-accountStats.realizedLoss-accountStats.fees+accountStats.fundingReceived-accountStats.fundingPaid}
function openStatsModal(){const s=accountStats,tiles=[['总资产',totalAsset()],['入金',s.inflow],['出金',s.outflow],['已实现盈利',s.realizedProfit],['已实现亏损',s.realizedLoss],['手续费',s.fees],['资金费净额',s.fundingReceived-s.fundingPaid],['净已实现收益',netRealized()],['爆仓次数',s.liquidations],['合约成交',s.trades],['现货成交',s.spotTrades],['账户划转',s.transfers]];$('statGrid').innerHTML=tiles.map(([k,v])=>`<div class="stat-tile"><small>${k}</small><b class="${typeof v==='number'&&v<0?'negative':''}">${k.includes('次数')||k.includes('成交')||k.includes('划转')?v:fmt(v)+' USDT'}</b></div>`).join('');$('statsModal').classList.add('show')}

/* funding/transfer */
function openFund(mode='deposit'){if(!user)return openAuth('login');fundMode=mode;$('fundTitle').textContent=mode==='deposit'?'模拟入金':'模拟出金';$('fundDesc').textContent=mode==='deposit'?'资金进入法币账户，再通过划转进入现货或合约账户。':'从法币账户扣除 USDT，用于统计模拟出金。';$('fundAmount').value='';$('fundModal').classList.add('show')}
function confirmFund(){const amt=+$('fundAmount').value;if(!amt||amt<=0)return notify('操作失败','请输入有效金额','error');if(fundMode==='deposit'){wallets.fiat.usdt+=amt;accountStats.inflow+=amt;addLedger('入金',amt,'','模拟入金','fiat');notify('入金成功',`法币账户 +${fmt(amt)} USDT`)}else{if(amt>wallets.fiat.usdt)return notify('出金失败','法币账户余额不足','error');wallets.fiat.usdt-=amt;accountStats.outflow+=amt;addLedger('出金',-amt,'','模拟出金','fiat');notify('出金成功',`法币账户 -${fmt(amt)} USDT`,'info')}$('fundModal').classList.remove('show');saveState();updateAssets();renderAssetPage()}
function openTransfer(from='fiat',to='futures'){if(!user)return openAuth('login');const opts=Object.entries(walletNames).map(([k,v])=>`<option value="${k}">${v}账户</option>`).join('');$('transferFrom').innerHTML=opts;$('transferTo').innerHTML=opts;$('transferFrom').value=from;$('transferTo').value=to;updateTransferAvailable();$('transferAmount').value='';$('transferModal').classList.add('show')}
function updateTransferAvailable(){$('transferAvailable').textContent=`可用：${fmt(walletUsdt($('transferFrom').value))} USDT`}
function confirmTransfer(){const from=$('transferFrom').value,to=$('transferTo').value,amt=+$('transferAmount').value;if(from===to)return notify('划转失败','转出和转入账户不能相同','error');if(!amt||amt<=0)return notify('划转失败','请输入有效金额','error');if(amt>walletUsdt(from))return notify('划转失败',`${walletNames[from]}账户余额不足`,'error');setWalletUsdt(from,walletUsdt(from)-amt);setWalletUsdt(to,walletUsdt(to)+amt);accountStats.transfers++;addLedger('账户划转',amt,'',`${walletNames[from]} → ${walletNames[to]}`,from);$('transferModal').classList.remove('show');notify('划转成功',`${walletNames[from]} → ${walletNames[to]} ${fmt(amt)} USDT`);saveState();updateAssets();renderTable();renderAssetPage()}

/* news */
const newsTemplates=[
  {s:1,k:'监管',important:true,t:c=>`监管机构释放对 ${c} 现货产品更友好的信号`,d:'市场预期合规资金流入可能增加，相关资产短线买盘升温。'},
  {s:-1,k:'监管',important:true,t:c=>`传闻监管部门将加强对 ${c} 相关交易限制`,d:'消息尚未得到官方证实，市场出现避险情绪。'},
  {s:1,k:'机构',important:true,t:c=>`大型机构被曝增持 ${c}`,d:'链上大额转移引发市场对机构买盘的猜测。'},
  {s:-1,k:'安全',important:true,t:c=>`${c} 生态项目疑似出现安全事件`,d:'部分社交媒体账户正在传播未经确认的攻击消息。'},
  {s:1,k:'技术',important:false,t:c=>`${c} 生态宣布重要性能升级计划`,d:'开发者社区认为升级可能改善网络使用体验。'},
  {s:-1,k:'交易所',important:false,t:c=>`大型交易平台出现 ${c} 提现延迟传闻`,d:'用户反馈不一，平台尚未发布正式公告。'},
  {s:1,k:'鲸鱼',important:true,t:c=>`鲸鱼地址出现大额 ${c} 买入行为`,d:'短时买盘明显增强，成交量同步放大。'},
  {s:-1,k:'鲸鱼',important:true,t:c=>`鲸鱼地址向交易所转入大量 ${c}`,d:'市场担忧潜在抛售压力，短线波动上升。'}
];
function seedNewsHistory(){
  newsItems=[
    {id:newsSeq++,time:'17:04',symbol:'SOL/USDT',title:'Solana 生态应用季度收入明显增长',desc:'模拟快讯：生态活跃度回升，但短线价格是否受益仍取决于市场风险偏好。',truth:true,resolved:true,sentiment:1,status:'已确认',kind:'机构',important:false,bull:128,bear:41,userVote:null},
    {id:newsSeq++,time:'17:00',symbol:'MARKET',title:'市场等待关键宏观数据，风险资产波动率上升',desc:'模拟快讯：宏观预期出现分歧，多空双方均在降低高杠杆敞口。',truth:true,resolved:true,sentiment:0,status:'已确认',kind:'市场',important:true,bull:92,bear:88,userVote:null},
    {id:newsSeq++,time:'16:55',symbol:'ETH/USDT',title:'社交媒体流传“某机构将一次性买入大量 ETH”截图',desc:'该截图的来源和真实性尚未确认。',truth:false,resolved:true,sentiment:1,status:'已证伪',kind:'传闻',important:true,bull:211,bear:136,userVote:null}
  ];renderNews();
}
function generateNews(test=false){
  const temp=newsTemplates[Math.floor(Math.random()*newsTemplates.length)],coin=base(),truth=Math.random()<.68,strength=.00004+Math.random()*.00009,vol=.18+Math.random()*.25;
  const item={id:newsSeq++,time:nowText().slice(0,5),symbol,kind:temp.k,title:temp.t(coin),desc:temp.d,truth,resolved:false,sentiment:temp.s,status:'待核实',important:temp.important,bull:Math.floor(20+Math.random()*220),bear:Math.floor(20+Math.random()*220),userVote:null,resolveAt:Date.now()+(test?9000:18000+Math.random()*18000)};
  newsItems.unshift(item);newsItems=newsItems.slice(0,80);activeImpacts.push({symbol,drift:temp.s*strength,vol,until:Date.now()+(truth?45000:22000)});renderNews();notify('市场快讯',item.title,temp.s>0?'success':'warning',5000);
}
function resolveNews(){const n=Date.now();let changed=false;for(const item of newsItems){if(item.resolved||!item.resolveAt||n<item.resolveAt)continue;item.resolved=true;item.status=item.truth?'已确认':'已证伪';changed=true;if(!item.truth){activeImpacts.push({symbol:item.symbol,drift:-item.sentiment*(.00005+Math.random()*.00006),vol:.12,until:n+26000});notify('消息被证伪',item.title,'info',4800)}else notify('消息已确认',item.title,'info',3800)}if(changed)renderNews()}
function voteNews(id,vote){const n=newsItems.find(x=>x.id===id);if(!n)return;if(n.userVote===vote)return;if(n.userVote==='bull')n.bull=Math.max(0,n.bull-1);if(n.userVote==='bear')n.bear=Math.max(0,n.bear-1);n.userVote=vote;n[vote]++;renderNews()}
function newsMatches(n){if($('importantOnly').checked&&!n.important)return false;if(newsFilter==='all')return true;if(newsFilter==='BTC'||newsFilter==='ETH')return n.symbol.startsWith(newsFilter);return n.kind===newsFilter}
function renderNews(){
  const items=newsItems.filter(newsMatches);
  $('newsList').innerHTML=items.map(n=>{const total=n.bull+n.bear,bp=total?Math.round(n.bull/total*100):50;return`<article class="news-card"><span class="news-time">${n.time}</span><i class="news-dot"></i><div class="news-box ${n.important?'important':''}"><div class="news-title-row"><h3>${n.title}</h3><span class="news-status ${n.status==='已确认'?'good':n.status==='已证伪'?'bad':''}">${n.status}</span></div><p>${n.desc}</p><div class="news-meta-line"><span>${n.symbol==='MARKET'?'全市场':n.symbol}</span><span>${n.kind}</span><span class="impact-chip ${n.sentiment<0?'neg':''}">${n.sentiment>0?'偏多':n.sentiment<0?'偏空':'中性'}</span></div><div class="vote-row"><button class="vote-btn bull ${n.userVote==='bull'?'active':''}" data-newsvote="bull" data-newsid="${n.id}">↑ 利好 ${n.bull}</button><button class="vote-btn bear ${n.userVote==='bear'?'active':''}" data-newsvote="bear" data-newsid="${n.id}">↓ 利空 ${n.bear}</button><span class="vote-summary">其他用户：${bp}% 看多 · ${100-bp}% 看空</span></div></div></article>`}).join('')||'<div class="empty">当前筛选条件暂无快讯</div>';
}
