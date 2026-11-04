/* v0.0.11 UX / account menus / persistent notifications / indicators */
(function waitV011(){
  if(typeof drawTradeMarkers!=='function'||typeof renderOverview!=='function'){setTimeout(waitV011,60);return}
  (()=>{
  'use strict';

  const VERSION=window.GB_VERSION||'0.0.26';
  const PREF_KEY='greedbit_ui_prefs';
  const LOGO='assets/greedbit-logo.png';
  const fallbackFx={USD:1,CNY:7.12,EUR:.86,GBP:.76,AUD:1.54,HKD:7.78,JPY:154.0};
  let uiPrefs={lang:'zh-CN',currency:'CNY',...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')};
  let fxRates={...fallbackFx};
  let volumeDragging=false;

  Object.assign(chartDefaults,{maEnabled:true,ma5:true,ma10:true,ma30:true,ma60:true,maDisplay:'line-values',volumeEnabled:true,volumeMode:'separate',volumeRatio:.22});
  for(const [k,v] of Object.entries(chartDefaults))if(chartSettings[k]===undefined)chartSettings[k]=v;

  function injectShell(){
    if(!document.querySelector('link[href^="styles/v011.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href=cssHref('styles/v011.css');document.head.appendChild(l)}
    let favicon=document.querySelector('link[rel~="icon"]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.appendChild(favicon)}favicon.type='image/png';favicon.href=LOGO;
    let brand=document.querySelector('.brand');
    if(brand&&!brand.querySelector('.brand-logo'))brand.insertAdjacentHTML('afterbegin',`<img class="brand-logo" src="${LOGO}" alt="GreedBit"/>`);
    const priceNote=document.querySelector('.pricebig')?.parentElement?.querySelector('.muted.tiny');if(priceNote){priceNote.id='convertedPrice';priceNote.classList.add('converted-price')}
    const authbar=$('authbar');
    if(authbar&&!$('topUtility'))authbar.insertAdjacentHTML('beforebegin',`<div class="top-utility" id="topUtility">
      <button class="icon-only" id="localeBtn" title="语言与折算货币" aria-label="语言与折算货币"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.4 3.2 5.4 3.2 9s-1.1 6.6-3.2 9M12 3C9.9 5.4 8.8 8.4 8.8 12s1.1 6.6 3.2 9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg></button>
      <button class="icon-only hidden" id="notifBtn" title="通知" aria-label="通知"><svg viewBox="0 0 24 24"><path d="M6.5 17.5h11l-1.3-2V10a4.2 4.2 0 0 0-8.4 0v5.5l-1.3 2Z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 19.2a2.1 2.1 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span class="notif-badge hidden" id="notifBadge">0</span></button>
      <div class="utility-menu lang-menu hidden" id="localeMenu"><div class="lang-col" id="langChoices"><div class="menu-heading">语言</div><button class="menu-choice" data-lang="zh-CN">简体中文</button><button class="menu-choice" data-lang="en">English</button></div><div class="lang-col" id="currencyChoices"><div class="menu-heading">折算货币</div>${Object.keys(fallbackFx).map(c=>`<button class="menu-choice" data-currency="${c}">${currencyLabel(c)}</button>`).join('')}</div></div>
      <div class="utility-menu notif-panel hidden" id="notifPanel"><div class="notif-head"><b>通知</b><button id="markAllReadBtn">全部已读</button></div><div class="notif-list" id="notifList"></div></div>
    </div>`);
    const chip=$('userchip');
    if(chip&&!$('profileBtn'))chip.insertAdjacentHTML('beforeend',`<button class="profile-trigger" id="profileBtn" title="账号"><img src="${LOGO}" alt="avatar"/></button><div class="profile-menu hidden" id="profileMenu"><div class="profile-summary"><div class="profile-name-row"><img src="${LOGO}" alt="avatar"/><div><strong id="profileName">--</strong><small id="profileUid">UID: --</small></div></div><div class="profile-levels"><span>Prime 0</span><span>L1</span></div></div><div class="profile-links"><button data-profile-action="fees">我的费率 <span>›</span></button><button data-profile-action="benefits">我的福利 <span>›</span></button><button data-profile-action="invite">我的邀请奖励 <span>›</span></button><button data-profile-action="security">账户安全 <span>›</span></button><button data-profile-action="fiat">法币设置 <span>›</span></button><button data-profile-action="api">API管理 <span>›</span></button><button class="profile-logout" id="profileLogout">退出登录</button></div></div>`);
    const chartwrap=$('chartwrap');
    if(chartwrap&&!$('maLegend'))chartwrap.insertAdjacentHTML('beforeend','<div class="indicator-legend" id="maLegend"></div><div class="volume-divider-hint" id="volumeDividerHint"></div>');
    injectChartSettings();
    injectAdminMailer();
    updateFooterVersion();
  }
  function currencyLabel(c){return({USD:'$ USD',CNY:'¥ CNY',EUR:'€ EUR',GBP:'£ GBP',AUD:'AU$ AUD',HKD:'HK$ HKD',JPY:'¥ JPY'}[c]||c)}
  function updateFooterVersion(){const els=[...document.querySelectorAll('.statusbar .ticker')];const v=els.find(x=>x.textContent.includes('GreedBit'));if(v)v.textContent=`GreedBit v${VERSION}`}
  function injectChartSettings(){
    const symbolPanel=document.querySelector('[data-cspanel="symbol"]');if(!symbolPanel||$('csMAEnabled'))return;
    symbolPanel.insertAdjacentHTML('beforeend',`<div class="chart-settings-extra"><h4>移动平均线</h4><label class="setting-check"><input id="csMAEnabled" type="checkbox"/> 显示 MA</label><div class="ma-options"><label><input id="csMA5" type="checkbox"/><i class="ma-dot" style="background:#9271d7"></i>MA 5</label><label><input id="csMA10" type="checkbox"/><i class="ma-dot" style="background:#86a6da"></i>MA 10</label><label><input id="csMA30" type="checkbox"/><i class="ma-dot" style="background:#65b26d"></i>MA 30</label><label><input id="csMA60" type="checkbox"/><i class="ma-dot" style="background:#c52c98"></i>MA 60</label></div><div class="setting-row"><span>MA 显示模式</span><select id="csMADisplay"><option value="line-values">曲线 + 数值</option><option value="line">仅曲线</option><option value="values">仅数值</option></select></div><h4>成交量</h4><label class="setting-check"><input id="csVolumeEnabled" type="checkbox"/> 显示成交量</label><div class="setting-row"><span>成交量模式</span><select id="csVolumeMode"><option value="separate">独立窗格</option><option value="overlay">叠加主图</option></select></div></div>`);
  }
  function injectAdminMailer(){
    const shell=document.querySelector('#adminPage .admin-shell');if(!shell||$('adminMailPanel'))return;
    shell.insertAdjacentHTML('beforeend',`<div class="admin-mail-panel" id="adminMailPanel"><div class="panelhead">发送站内通知</div><div class="admin-mail-form"><label>收件人<select id="adminMailRecipient"></select></label><label>主题<input id="adminMailSubject" maxlength="80" placeholder="通知主题"/></label><label>正文<textarea id="adminMailBody" maxlength="3000" placeholder="邮件格式正文…"></textarea></label><div class="admin-mail-actions"><button id="adminMailSend">发送通知</button></div></div></div>`);
  }

  function uidFor(name=''){let h=2166136261;for(const ch of name){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return String(h>>>0).padStart(10,'0').slice(0,10)}
  function inboxKey(name){return`greedbit_inbox_${name}`}
  function readInbox(name=user?.username){if(!name)return[];try{return JSON.parse(localStorage.getItem(inboxKey(name))||'[]')}catch{return[]}}
  function writeInbox(name,arr){localStorage.setItem(inboxKey(name),JSON.stringify(arr.slice(0,200)))}
  function addMail(name,msg){const arr=readInbox(name);arr.unshift(msg);writeInbox(name,arr)}
  function renderInbox(){
    const list=$('notifList'),badge=$('notifBadge'),btn=$('notifBtn');if(!list||!badge||!btn)return;
    btn.classList.toggle('hidden',!user);if(!user){list.innerHTML='';badge.classList.add('hidden');return}
    const rows=readInbox(),unread=rows.filter(x=>!x.read).length;badge.textContent=String(Math.min(99,unread));badge.classList.toggle('hidden',!unread);
    list.innerHTML=rows.length?rows.map(x=>`<article class="mail-item ${x.read?'':'unread'}" data-mailid="${x.id}"><div class="mail-top"><b>${escapeHtml(x.subject)}</b><time>${new Date(x.time).toLocaleString()}</time></div><div class="mail-from">${escapeHtml(x.from||'GreedBit')}</div><div class="mail-body">${escapeHtml(x.body)}</div></article>`).join(''):'<div class="empty">暂无通知</div>';
  }
  function markMail(id){const rows=readInbox(),m=rows.find(x=>String(x.id)===String(id));if(m){m.read=true;writeInbox(user.username,rows);renderInbox()}}
  function markAllRead(){if(!user)return;const rows=readInbox();rows.forEach(x=>x.read=true);writeInbox(user.username,rows);renderInbox()}
  function renderRecipientOptions(){const el=$('adminMailRecipient');if(!el)return;const users=safeParse(localStorage.getItem('greedbit_users'),{}),names=Object.keys(users);el.innerHTML='<option value="*">全体用户（本机）</option>'+[...new Set(names)].map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('')}
  function sendAdminMail(){
    if(!isAdminMode())return;const to=$('adminMailRecipient').value,subject=$('adminMailSubject').value.trim(),body=$('adminMailBody').value.trim();if(!subject||!body)return notify('发送失败','请填写主题和正文','error');
    const users=safeParse(localStorage.getItem('greedbit_users'),{}),targets=to==='*'?[...new Set(Object.keys(users))]:[to],msg={id:Date.now()+'_'+Math.random().toString(36).slice(2,7),subject,body,from:'GreedBit Admin',time:Date.now(),read:false};targets.forEach(n=>addMail(n,{...msg,id:msg.id+'_'+n}));$('adminMailSubject').value='';$('adminMailBody').value='';notify('通知已发送',to==='*'?`已写入 ${targets.length} 个本地账号收件箱`:`已发送给 ${to}`);renderInbox();
  }

  const i18n={
    'zh-CN':{home:'主页',market:'行情',trade:'交易',futures:'合约',assets:'资产',admin:'管理',notice:'通知',allRead:'全部已读',profile:'账号'},
    en:{home:'Home',market:'Markets',trade:'Spot',futures:'Futures',assets:'Assets',admin:'Admin',notice:'Notifications',allRead:'Mark all read',profile:'Account'}
  };
  function applyLanguage(){const d=i18n[uiPrefs.lang]||i18n['zh-CN'];document.documentElement.lang=uiPrefs.lang;for(const k of ['home','market','trade','futures','assets','admin']){const b=document.querySelector(`.navbtn[data-page="${k}"]`);if(b)b.textContent=d[k]}const nh=$('notifPanel')?.querySelector('.notif-head b');if(nh)nh.textContent=d.notice;if($('markAllReadBtn'))$('markAllReadBtn').textContent=d.allRead;$$('[data-lang]').forEach(b=>b.classList.toggle('active',b.dataset.lang===uiPrefs.lang));$$('[data-currency]').forEach(b=>b.classList.toggle('active',b.dataset.currency===uiPrefs.currency));localStorage.setItem(PREF_KEY,JSON.stringify(uiPrefs));updateConvertedPrice()}
  async function loadFx(){
    try{const r=await fetch('https://api.frankfurter.app/latest?from=USD&to=CNY,EUR,GBP,AUD,HKD,JPY',{cache:'no-store'});if(r.ok){const j=await r.json();fxRates={...fallbackFx,USD:1,...j.rates};localStorage.setItem('greedbit_fx_cache',JSON.stringify({time:Date.now(),rates:fxRates}))}}
    catch{try{const c=JSON.parse(localStorage.getItem('greedbit_fx_cache')||'null');if(c?.rates)fxRates={...fallbackFx,...c.rates}}catch{}}
    updateConvertedPrice();
  }
  function updateConvertedPrice(){const el=$('convertedPrice');if(!el||!Number.isFinite(price)||price<=0)return;const c=uiPrefs.currency,rate=fxRates[c]||1,value=price*rate,symbols={USD:'$',CNY:'¥',EUR:'€',GBP:'£',AUD:'AU$',HKD:'HK$',JPY:'¥'};el.textContent=`≈ ${symbols[c]||''}${fmt(value,c==='JPY'?0:2)} ${c}`}

  function syncV11Auth(){
    if($('profileName'))$('profileName').textContent=user?.username||'--';if($('profileUid'))$('profileUid').textContent=user?`UID:${uidFor(user.username)}`:'UID: --';renderInbox();renderRecipientOptions();
  }
  const oldSyncAuthV11=syncAuth;syncAuth=function(){oldSyncAuthV11();syncV11Auth()};
  const oldRenderAdminV11=renderAdminPage;renderAdminPage=function(){oldRenderAdminV11();renderRecipientOptions()};

  function wireMenus(){
    $('localeBtn').onclick=e=>{e.stopPropagation();$('localeMenu').classList.toggle('hidden');$('notifPanel').classList.add('hidden');$('profileMenu')?.classList.add('hidden')};
    $('langChoices').onclick=e=>{const b=e.target.closest('[data-lang]');if(!b)return;uiPrefs.lang=b.dataset.lang;applyLanguage()};
    $('currencyChoices').onclick=e=>{const b=e.target.closest('[data-currency]');if(!b)return;uiPrefs.currency=b.dataset.currency;applyLanguage()};
    $('notifBtn').onclick=e=>{e.stopPropagation();$('notifPanel').classList.toggle('hidden');$('localeMenu').classList.add('hidden');$('profileMenu')?.classList.add('hidden');renderInbox()};
    $('notifList').onclick=e=>{const m=e.target.closest('[data-mailid]');if(m)markMail(m.dataset.mailid)};$('markAllReadBtn').onclick=markAllRead;
    $('profileBtn').onclick=e=>{e.stopPropagation();$('profileMenu').classList.toggle('hidden');$('localeMenu').classList.add('hidden');$('notifPanel').classList.add('hidden')};
    $('profileMenu').onclick=e=>{const b=e.target.closest('[data-profile-action]');if(b)notify('本地版账号功能',`${b.textContent.replace('›','').trim()} 将在后端账户系统接入后开放`,'info')};
    $('profileLogout').onclick=()=>$('logoutBtn').click();
    $('adminMailSend').onclick=sendAdminMail;
    document.addEventListener('click',e=>{if(!$('topUtility').contains(e.target)){$('localeMenu').classList.add('hidden');$('notifPanel').classList.add('hidden')}if(!$('userchip').contains(e.target))$('profileMenu')?.classList.add('hidden')});
  }

  function maAt(all,idx,n){if(idx<n-1||idx>=all.length)return null;let s=0;for(let i=idx-n+1;i<=idx;i++)s+=all[i].c;return s/n}
  const maDefs=[[5,'#9271d7','ma5'],[10,'#86a6da','ma10'],[30,'#65b26d','ma30'],[60,'#c52c98','ma60']];
  function chartLayout(){
    const W=canvas.clientWidth,H=canvas.clientHeight,pad={l:8,r:82,t:28,b:42},fullH=Math.max(1,H-pad.t-pad.b),sep=chartSettings.volumeEnabled&&chartSettings.volumeMode==='separate',ratio=clamp(+chartSettings.volumeRatio||.22,.1,.55),volH=sep?fullH*ratio:0,divider=sep?H-pad.b-volH:null,mainBottom=sep?divider-5:H-pad.b,mainH=Math.max(1,mainBottom-pad.t);return{W,H,pad,fullH,sep,ratio,volH,divider,mainBottom,mainH,plotW:Math.max(1,W-pad.l-pad.r)}
  }
  function updateIndicatorLegend(geom){
    const el=$('maLegend');if(!el)return;if(!chartSettings.maEnabled||chartSettings.maDisplay==='line'){el.innerHTML='';return}const idx=Math.min(geom.all.length-1,Math.floor(Math.min(geom.right-1,geom.all.length-1))),rows=[];for(const [n,col,key] of maDefs){if(!chartSettings[key])continue;const v=maAt(geom.all,idx,n);if(v!=null)rows.push(`<span style="color:${col}">MA ${n} close 0&nbsp;&nbsp;${fmt(v,chartDecimals())}</span>`)}el.innerHTML=rows.join('')
  }
  function drawMAs(geom,L,y){if(!chartSettings.maEnabled||chartSettings.maDisplay==='values')return;ctx.lineWidth=1.15;for(const [n,col,key] of maDefs){if(!chartSettings[key])continue;ctx.strokeStyle=col;ctx.beginPath();let started=false;const first=Math.max(0,Math.floor(geom.start)-n-2),last=Math.min(geom.all.length-1,Math.ceil(geom.right)+2);for(let idx=first;idx<=last;idx++){const v=maAt(geom.all,idx,n);if(v==null)continue;const x=xForIndex(idx,geom,L.pad,L.plotW);if(!started){ctx.moveTo(x,y(v));started=true}else ctx.lineTo(x,y(v))}if(started)ctx.stroke()}}
  function drawVolumes(geom,L){
    if(!chartSettings.volumeEnabled)return;const rows=geom.visible.filter(x=>x.idx>=geom.start-1&&x.idx<=geom.right+1);if(!rows.length)return;const maxV=Math.max(1,...rows.map(x=>x.c.v||0)),cw=L.plotW/visibleCount;
    let top,bottom;if(L.sep){top=L.divider+6;bottom=L.H-L.pad.b}else{bottom=L.mainBottom;top=bottom-L.mainH*.2}
    const h=Math.max(1,bottom-top);ctx.save();ctx.globalAlpha=L.sep?0.72:0.28;for(const {idx,c} of rows){const x=xForIndex(idx,geom,L.pad,L.plotW),bar=Math.max(1,(c.v||0)/maxV*h),w=Math.max(1,Math.min(18,Math.abs(cw)*.58));ctx.fillStyle=c.c>=c.o?chartSettings.bull:chartSettings.bear;ctx.fillRect(x-w/2,bottom-bar,w,bar)}ctx.restore();if(L.sep){ctx.strokeStyle='#343b45';ctx.beginPath();ctx.moveTo(0,L.divider+.5);ctx.lineTo(L.W-L.pad.r,L.divider+.5);ctx.stroke();ctx.fillStyle='#7d8796';ctx.font='10px sans-serif';ctx.fillText(`成交量(Volume) ${fmt(rows.at(-1)?.c.v||0,0)}`,10,L.divider+17);$('volumeDividerHint').style.top=(L.divider-3)+'px'}
  }
  function draw(){
    if(currentPage!=='trade'&&currentPage!=='futures')return;const L=chartLayout(),{W,H,pad,plotW,mainH}=L;if(!W||!H)return;ctx.clearRect(0,0,W,H);ctx.fillStyle=chartSettings.background||'#0b0e12';ctx.fillRect(0,0,W,H);const geom=viewGeometry(),{hi,lo}=calcPriceBounds(geom),range=hi-lo,y=p=>pad.t+(hi-p)/range*mainH;
    $('chartwrap').classList.toggle('volume-separate',L.sep);if(!L.sep)$('volumeDividerHint').style.top='';ctx.font='10px sans-serif';ctx.fillStyle='#6f7a8b';for(let i=0;i<=5;i++){const yy=pad.t+mainH*i/5;ctx.strokeStyle=chartSettings.grid||'#1d232b';ctx.beginPath();ctx.moveTo(pad.l,yy+.5);ctx.lineTo(W-pad.r,yy+.5);ctx.stroke();ctx.fillText(fmt(Math.max(0,hi-range*i/5),chartDecimals()),W-pad.r+5,yy+3)}
    const tickCount=8;for(let i=0;i<=tickCount;i++){const frac=i/tickCount,idx=geom.start+visibleCount*frac,x=pad.l+plotW*frac,ts=timestampAtIndex(idx,geom.all);ctx.strokeStyle=chartSettings.grid||'#171c22';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();ctx.fillStyle='#6f7a8b';ctx.fillText(formatTime(ts),Math.max(2,Math.min(W-pad.r-115,x-48)),H-11)}
    if(chartSettings.volumeEnabled&&chartSettings.volumeMode==='overlay')drawVolumes(geom,L);drawMAs(geom,L,y);
    for(const {idx,c} of geom.visible){const x=xForIndex(idx,geom,pad,plotW),cw=plotW/visibleCount;if(x<-Math.abs(cw)*2||x>W-pad.r+Math.abs(cw)*2)continue;const col=c.c>=c.o?chartSettings.bull:chartSettings.bear,yo=y(c.o),yc=y(c.c),top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo)),bodyW=Math.max(1,Math.min(40,Math.abs(cw)*.62));if(chartSettings.wick){ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(x,y(c.h));ctx.lineTo(x,y(c.l));ctx.stroke()}if(chartSettings.body){ctx.fillStyle=col;ctx.fillRect(Math.round(x-bodyW/2),Math.round(top),bodyW,bh)}if(chartSettings.border){ctx.strokeStyle=col;ctx.strokeRect(Math.round(x-bodyW/2),Math.round(top),bodyW,bh)}if(c.live){ctx.strokeStyle='#5d8cff';ctx.strokeRect(Math.round(x-bodyW/2-2),Math.round(top-2),bodyW+4,bh+4)}}
    drawTradeMarkers(geom,pad,plotW,y,lo,hi);drawHighLow(geom,pad,plotW,y,lo,hi);if(chartSettings.volumeEnabled&&chartSettings.volumeMode==='separate')drawVolumes(geom,L);
    if(price>=lo&&price<=hi){const py=y(price),up=!current||current.c>=current.o,col=up?chartSettings.bull:chartSettings.bear;ctx.setLineDash([2,3]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(W-pad.r,py);ctx.stroke();ctx.setLineDash([]);const h=chartSettings.countdown?36:22,boxY=clamp(py-h/2,pad.t,L.mainBottom-h);ctx.fillStyle=col;ctx.fillRect(W-pad.r,boxY,pad.r,h);ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.fillText(fmt(price,chartDecimals()),W-pad.r+5,boxY+14);if(chartSettings.countdown){ctx.font='10px sans-serif';ctx.fillText(candleRemain(),W-pad.r+5,boxY+29)}if(chartSettings.symbolLabel){const lab=apiSymbol().replace('USDT','-USDT'),tw=ctx.measureText(lab).width+10;ctx.fillStyle=col;ctx.fillRect(W-pad.r-tw,boxY,tw,22);ctx.fillStyle='#fff';ctx.fillText(lab,W-pad.r-tw+5,boxY+14)}}
    for(const o of activeChartOrders()){if(o.limit<lo||o.limit>hi)continue;const oy=y(o.limit),col=o.side==='buy'?chartSettings.bull:chartSettings.bear;ctx.setLineDash([6,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,oy);ctx.lineTo(W-pad.r,oy);ctx.stroke();ctx.setLineDash([]);const tw=ctx.measureText(o.label).width+12;ctx.fillStyle=o.side==='buy'?'#14251f':'#2a171b';ctx.fillRect(pad.l+8,oy-10,tw,20);ctx.fillStyle=col;ctx.fillText(o.label,pad.l+14,oy+3)}
    const ch=crosshairLocked&&lockedCrosshair?lockedCrosshair:(hoverIndex>=0?{idx:hoverIndex,price:hoverPrice}:null);if(ch&&chartSettings.crosshair){const x=xForIndex(ch.idx,geom,pad,plotW);if(x>=pad.l&&x<=W-pad.r){ctx.strokeStyle='#697386';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,L.mainBottom);ctx.stroke();if(Number.isFinite(ch.price)){const yy=y(ch.price);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke()}ctx.setLineDash([])}}
    ctx.strokeStyle='#303741';ctx.beginPath();ctx.moveTo(W-pad.r,pad.t);ctx.lineTo(W-pad.r,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();updateIndicatorLegend(geom);
  }
  function chartPriceAtClientY(clientY){const r=canvas.getBoundingClientRect(),L=chartLayout(),{hi,lo}=calcPriceBounds(),y=clamp(clientY-r.top,L.pad.t,L.mainBottom);return hi-(y-L.pad.t)/L.mainH*(hi-lo)}

  const oldSyncSettings=syncChartSettingsForm;syncChartSettingsForm=function(){oldSyncSettings();$('csMAEnabled').checked=!!chartSettings.maEnabled;$('csMA5').checked=!!chartSettings.ma5;$('csMA10').checked=!!chartSettings.ma10;$('csMA30').checked=!!chartSettings.ma30;$('csMA60').checked=!!chartSettings.ma60;$('csMADisplay').value=chartSettings.maDisplay||'line-values';$('csVolumeEnabled').checked=!!chartSettings.volumeEnabled;$('csVolumeMode').value=chartSettings.volumeMode||'separate'};
  const oldReadSettings=readChartSettingsForm;readChartSettingsForm=function(){oldReadSettings();chartSettings.maEnabled=$('csMAEnabled').checked;chartSettings.ma5=$('csMA5').checked;chartSettings.ma10=$('csMA10').checked;chartSettings.ma30=$('csMA30').checked;chartSettings.ma60=$('csMA60').checked;chartSettings.maDisplay=$('csMADisplay').value;chartSettings.volumeEnabled=$('csVolumeEnabled').checked;chartSettings.volumeMode=$('csVolumeMode').value};

  function nearVolumeDivider(e){const r=canvas.getBoundingClientRect(),L=chartLayout();return L.sep&&Math.abs((e.clientY-r.top)-L.divider)<7&&e.clientX-r.left<L.W-L.pad.r}
  canvas.addEventListener('mousedown',e=>{if(e.button!==0||!nearVolumeDivider(e))return;e.preventDefault();e.stopImmediatePropagation();volumeDragging=true;$('chartwrap').classList.add('volume-resizing')},true);
  window.addEventListener('mousemove',e=>{if(volumeDragging){e.preventDefault();e.stopImmediatePropagation();const r=canvas.getBoundingClientRect(),L=chartLayout(),y=e.clientY-r.top,available=Math.max(1,r.height-L.pad.t-L.pad.b);chartSettings.volumeRatio=clamp((r.height-L.pad.b-y)/available,.1,.55);draw();return}if(nearVolumeDivider(e))canvas.style.cursor='row-resize';else if(!dragging)canvas.style.cursor='crosshair'},true);
  window.addEventListener('mouseup',()=>{if(volumeDragging){volumeDragging=false;$('chartwrap').classList.remove('volume-resizing');saveChartSettings()}},true);

  window.draw=draw;window.chartPriceAtClientY=chartPriceAtClientY;

  let flashTimer=0;window.addEventListener('greedbit:tick',e=>{const dir=e.detail?.direction;if(!dir)return;const cls=dir>0?'market-flash-up':'market-flash-down';for(const el of [$('lastPrice'),$('midPrice')]){if(!el)continue;el.classList.remove('market-flash-up','market-flash-down');void el.offsetWidth;el.classList.add(cls)}clearTimeout(flashTimer);flashTimer=setTimeout(()=>[$('lastPrice'),$('midPrice')].forEach(el=>el?.classList.remove('market-flash-up','market-flash-down')),170);updateConvertedPrice()});

  injectShell();wireMenus();applyLanguage();loadFx();syncV11Auth();syncChartSettingsForm();draw();
  })();
})();
