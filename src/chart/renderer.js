/* Canonical chart renderer. This module solely owns chart geometry, axes, grid and canvas drawing. */
function viewGeometry(){
  const all=currentSeries(),defaultFuture=Number(chartSettings.rightBars)||0,right=all.length+defaultFuture+viewShift,start=right-visibleCount;
  const from=Math.max(0,Math.floor(Math.min(start,right))-2),to=Math.min(all.length,Math.ceil(Math.max(start,right))+2),visible=[];
  for(let i=from;i<to;i++)visible.push({idx:i,c:all[i]});
  return{all,start,right,visible};
}
function resize(){
  const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.max(1,r.width*dpr);canvas.height=Math.max(1,r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw();
}
function chartDateParts(ts){
  const mode=chartSettings.timezone||'utc8',d=new Date((ts+(mode==='utc8'?8*3600:0))*1000);
  const get=mode==='local'?(k=>d[k]()):(k=>d['getUTC'+k.slice(3)]());
  const Y=get('getFullYear'),M=String(get('getMonth')+1).padStart(2,'0'),D=String(get('getDate')).padStart(2,'0');
  let h=get('getHours'),m=String(get('getMinutes')).padStart(2,'0'),sec=String(get('getSeconds')).padStart(2,'0'),suffix='';
  if(chartSettings.timeFormat==='12'){suffix=h>=12?' PM':' AM';h=h%12||12}
  return{Y,M,D,h:String(h).padStart(2,'0'),m,sec,suffix};
}
function formatTime(ts){
  if(!Number.isFinite(ts)||Math.abs(ts)>8.64e12)return'超出范围';
  const {Y,M,D,h,m,sec,suffix}=chartDateParts(ts),spanSeconds=Math.abs(visibleCount*tf),date=chartSettings.dateFormat==='md'?`${M}/${D}`:`${Y}-${M}-${D}`;
  if(tf>=86400)return date;if(spanSeconds<3600)return`${date} ${h}:${m}:${sec}${suffix}`;return`${date} ${h}:${m}${suffix}`;
}
function candleRemain(){
  const info=tfInfo(),n=Date.now()/1000,end=current?.end||bucketEnd(bucketStart(n,info),info),r=Math.max(0,Math.ceil(end-n)),h=Math.floor(r/3600),m=Math.floor(r%3600/60),s=r%60;
  return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
function visibleCandles(geom=viewGeometry()){
  return geom.visible.filter(x=>x.idx>=geom.start-1&&x.idx<=geom.right+1).map(x=>x.c);
}
function calcPriceBounds(geom=viewGeometry()){
  const d=visibleCandles(geom);let baseHi,baseLo;
  if(d.length){baseHi=Math.max(...d.map(c=>c.h));baseLo=Math.min(...d.map(c=>c.l))}else{baseHi=Math.max(price,1)*1.01;baseLo=Math.max(0,price*.99)}
  const rawRange=(baseHi-baseLo)||Math.max(baseHi*.01,.01),top=Math.max(0,+chartSettings.topMargin||0)/100,bottom=Math.max(0,+chartSettings.bottomMargin||0)/100;
  const paddedLo=baseLo-rawRange*bottom,paddedHi=baseHi+rawRange*top,baseRange=Math.max(paddedHi-paddedLo,Number.EPSILON*Math.max(1,Math.abs(baseHi)));
  const center=(paddedHi+paddedLo)/2+yPan;let range=baseRange*yZoom,precisionFloor=Number.EPSILON*Math.max(1,Math.abs(center));
  if(!Number.isFinite(range)||range<=0)range=Math.max(baseRange,precisionFloor);range=Math.max(range,precisionFloor);
  let lo=center-range/2,hi=center+range/2;if(lo<0){hi-=lo;lo=0}if(hi<=lo){lo=0;hi=Math.max(.01,range)}return{hi,lo};
}
function activeChartOrders(){
  if(tradingMode==='futures')return orders.filter(o=>o.symbol===symbol&&o.status==='open').map(o=>({limit:o.limit,side:o.side==='long'?'buy':'sell',label:`限价 ${o.side==='long'?'开多':'开空'} ${fmt(o.limit,cfg.dec)}`}));
  return spotOrders.filter(o=>o.symbol===symbol&&o.status==='open').map(o=>({limit:o.limit,side:o.side,label:`现货限价 ${o.side==='buy'?'买入':'卖出'} ${fmt(o.limit,cfg.dec)}`}));
}
function xForIndex(idx,geom,pad,plotW){return pad.l+((idx-geom.start)+.5)/visibleCount*plotW}
function timestampAtIndex(idx,all){
  if(!all.length)return Date.now()/1000;
  const info=tfInfo();
  if(!info.calendarMonth){
    const i=Math.floor(idx),frac=idx-i;
    if(i>=0&&i<all.length-1)return all[i].t+(all[i+1].t-all[i].t)*frac;
    if(i>=0&&i<all.length)return all[i].t;
    const step=Math.max(1,info.sec||tf||60),base=i<0?all[0].t:all.at(-1).t,offset=i<0?idx:idx-(all.length-1);
    return base+offset*step;
  }
  const i=Math.floor(idx),frac=idx-i;
  if(i>=0&&i<all.length-1)return all[i].t+(all[i+1].t-all[i].t)*frac;
  const base=i<0?all[0].t:all.at(-1).t,steps=i<0?i:i-all.length+1,d=new Date(base*1000);
  const t0=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+steps,1)/1000,t1=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+steps+1,1)/1000;
  return t0+(t1-t0)*frac;
}
function chartDecimals(){return chartSettings.precision==='auto'?cfg.dec:Math.max(0,+chartSettings.precision||0)}
function chartTradeRecords(){const arr=tradingMode==='futures'?trades:spotTrades;return arr.filter(t=>t.symbol===symbol&&Number.isFinite(+t.ts)&&Number.isFinite(+t.price)).slice(0,250)}
function nearestCandleIndex(ts,all){if(!all.length)return-1;let lo=0,hi=all.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(all[mid].t<ts)lo=mid+1;else hi=mid}if(lo>0&&Math.abs(all[lo-1].t-ts)<Math.abs(all[lo].t-ts))lo--;return lo}
function drawTradeMarkers(geom,pad,plotW,y,lo,hi){
  if(!chartSettings.markers)return;const rows=chartTradeRecords(),stack=new Map();
  for(const tr of rows){if(tr.price<lo||tr.price>hi)continue;const idx=nearestCandleIndex(+tr.ts,geom.all);if(idx<geom.start-1||idx>geom.right+1)continue;
    const x=xForIndex(idx,geom,pad,plotW),key=Math.round(x),n=stack.get(key)||0;stack.set(key,n+1);const isBuy=tr.side==='buy'||tr.side==='long',col=isBuy?chartSettings.bull:chartSettings.bear,label=isBuy?'B':'S',yy=clamp(y(tr.price)-(n*24),pad.t+14,canvas.clientHeight-pad.b-4);
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(x,yy+10);ctx.lineTo(x-8,yy);ctx.lineTo(x-8,yy-17);ctx.lineTo(x+8,yy-17);ctx.lineTo(x+8,yy);ctx.closePath();ctx.fill();ctx.fillStyle='#07110d';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(label,x,yy-4);ctx.textAlign='left';
  }
}
function drawHighLow(geom,pad,plotW,y,lo,hi){
  if(!chartSettings.highLow)return;const vis=geom.visible.filter(x=>x.idx>=geom.start&&x.idx<=geom.right);if(!vis.length)return;
  const high=vis.reduce((a,b)=>b.c.h>a.c.h?b:a),lowp=vis.reduce((a,b)=>b.c.l<a.c.l?b:a);
  for(const [obj,isHigh] of [[high,true],[lowp,false]]){const val=isHigh?obj.c.h:obj.c.l;if(val<lo||val>hi)continue;const yy=y(val),x=xForIndex(obj.idx,geom,pad,plotW),txt=`${isHigh?'最高价':'最低价'} ${fmt(val,chartDecimals())}`;ctx.strokeStyle='#46526a';ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(canvas.clientWidth-pad.r,yy);ctx.stroke();ctx.setLineDash([]);const tw=ctx.measureText(txt).width+8;ctx.fillStyle='#25375d';ctx.fillRect(canvas.clientWidth-pad.r-tw,yy-9,tw,18);ctx.fillStyle='#dce6ff';ctx.fillText(txt,canvas.clientWidth-pad.r-tw+4,yy+3)}
}
function niceGridStep(raw){
  const v=Math.max(Math.abs(raw)||0,Number.EPSILON),p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;
  const m=n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10;return m*p;
}
function buildPriceTicks(lo,hi,target=5){
  const range=Math.max(hi-lo,Number.EPSILON),step=niceGridStep(range/target),first=Math.ceil((lo-step*1e-10)/step)*step,ticks=[];
  for(let value=first,guard=0;value<=hi+step*1e-8&&guard<32;value+=step,guard++)if(value>=lo-step*1e-8)ticks.push(Number(value.toPrecision(15)));
  return ticks;
}
function niceIndexStep(raw){
  const v=Math.max(1,Math.abs(raw)||1),p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;
  const m=n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10;return Math.max(1,Math.round(m*p));
}
function buildIndexTicks(geom,target=8){
  const span=Math.max(1,geom.right-geom.start),step=niceIndexStep(span/target),first=Math.ceil((geom.start-step*1e-10)/step)*step,ticks=[];
  for(let index=first,guard=0;index<=geom.right+step*1e-8&&guard<64;index+=step,guard++){
    if(index<geom.start-step*1e-8)continue;
    ticks.push({index,ts:timestampAtIndex(index,geom.all)});
  }
  return ticks;
}
/* Position entries are price-axis objects, not free-floating labels.
 * Always use the SAME y() transform as grid, candles and price ticks.
 */
function drawPositionOverlay(y,lo,hi,pad,W,H){
  if(currentPage!=='futures'||tradingMode!=='futures'||!Array.isArray(positions))return;
  const rows=positions.filter(p=>p.symbol===symbol&&Number.isFinite(+p.entry)&&p.entry>=lo&&p.entry<=hi);
  if(!rows.length)return;
  const usedLabels=[];
  ctx.save();ctx.font='600 10px system-ui,sans-serif';ctx.textBaseline='middle';
  for(const p of rows){
    const entry=+p.entry;
    const contracts=window.GreedBitContracts;
    const mark=contracts?.supportsPerpBasis?.(p.symbol)?contracts.contractPriceFor(p.symbol):markFor(p.symbol);
    const pnl=(mark-entry)*(+p.qty||0)*(p.side==='long'?1:-1);
    const positive=pnl>1e-8,negative=pnl<-1e-8;
    const color=positive?'#3dbb83':negative?'#ec5d68':'#7b8798';
    const backdrop=positive?'rgba(31,87,66,.92)':negative?'rgba(91,37,45,.94)':'rgba(50,58,70,.94)';
    const lineY=y(entry);
    // Only the label may shift to avoid overlapping; the line stays at its actual price.
    let labelY=lineY;
    for(let i=0;i<usedLabels.length&&i<rows.length;i++){
      if(usedLabels.some(other=>Math.abs(other-labelY)<20))labelY+=20;
    }
    labelY=clamp(labelY,pad.t+10,H-pad.b-10);
    usedLabels.push(labelY);
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.setLineDash([5,3]);ctx.beginPath();
    ctx.moveTo(pad.l,Math.round(lineY)+.5);ctx.lineTo(W-pad.r,Math.round(lineY)+.5);ctx.stroke();ctx.setLineDash([]);
    const side=p.side==='long'?'多':'空',lev=Number(Number(p.leverage).toFixed(4))+'X',state=positive?'浮盈':negative?'浮亏':'持平';
    const nominal=(+p.qty||0)*entry;
    const label=`${side} ${lev}  ${state} ${pnl>0?'+':''}${fmt(pnl,4)} USDT  ${fmt(nominal,2)} USDT`;
    const width=Math.min(W-pad.r-pad.l-30,ctx.measureText(label).width+18),x=pad.l+10;
    ctx.fillStyle=backdrop;ctx.fillRect(x,labelY-9,width,18);
    ctx.strokeStyle=color;ctx.strokeRect(x+.5,labelY-8.5,width-1,17);
    ctx.fillStyle=color;ctx.fillText(label,x+7,labelY);
    ctx.fillStyle=color;ctx.fillRect(W-pad.r-20,lineY-9,20,18);
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.fillText(p.side==='long'?'L':'S',W-pad.r-10,lineY);
    ctx.textAlign='left';
  }
  ctx.restore();
}
function draw(){
  if(currentPage!=='trade'&&currentPage!=='futures')return;const W=canvas.clientWidth,H=canvas.clientHeight;if(!W||!H)return;const pad={l:8,r:82,t:28,b:42},plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b;
  ctx.clearRect(0,0,W,H);ctx.fillStyle=chartSettings.background||'#0b0e12';ctx.fillRect(0,0,W,H);const geom=viewGeometry(),{hi,lo}=calcPriceBounds(geom),range=hi-lo,axis={lo,hi,top:pad.t,height:plotH};
  const y=p=>window.GreedBitPositionBook.priceY(p,axis);
  ctx.font='10px sans-serif';ctx.fillStyle='#6f7a8b';

  const priceTicks=buildPriceTicks(lo,hi,5);
  ctx.textAlign='left';
  for(const pv of priceTicks){
    const yy=y(pv);if(yy<pad.t-1||yy>H-pad.b+1)continue;
    const lineY=Math.round(yy)+.5;ctx.strokeStyle=chartSettings.grid||'#1d232b';ctx.beginPath();ctx.moveTo(pad.l,lineY);ctx.lineTo(W-pad.r,lineY);ctx.stroke();ctx.fillStyle='#6f7a8b';ctx.fillText(fmt(Math.max(0,pv),chartDecimals()),W-pad.r+5,yy+3);
  }

  const indexTicks=buildIndexTicks(geom,8);
  ctx.textAlign='center';
  for(const tick of indexTicks){
    const x=xForIndex(tick.index,geom,pad,plotW);if(x<pad.l-1||x>W-pad.r+1)continue;
    const lineX=Math.round(x)+.5;ctx.strokeStyle=chartSettings.grid||'#171c22';ctx.beginPath();ctx.moveTo(lineX,pad.t);ctx.lineTo(lineX,H-pad.b);ctx.stroke();
    const label=formatTime(tick.ts),labelW=ctx.measureText(label).width;
    if(x-labelW/2>=pad.l&&x+labelW/2<=W-pad.r){ctx.fillStyle='#6f7a8b';ctx.fillText(label,x,H-11)}
  }
  ctx.textAlign='left';

  for(const {idx,c} of geom.visible){const x=xForIndex(idx,geom,pad,plotW),cw=plotW/visibleCount;if(x<-Math.abs(cw)*2||x>W-pad.r+Math.abs(cw)*2)continue;const col=c.c>=c.o?chartSettings.bull:chartSettings.bear,yo=y(c.o),yc=y(c.c),top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo)),bodyW=Math.max(1,Math.min(40,Math.abs(cw)*.62));if(chartSettings.wick){ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(x,y(c.h));ctx.lineTo(x,y(c.l));ctx.stroke()}if(chartSettings.body){ctx.fillStyle=col;ctx.fillRect(Math.round(x-bodyW/2),Math.round(top),bodyW,bh)}if(chartSettings.border){ctx.strokeStyle=col;ctx.strokeRect(Math.round(x-bodyW/2),Math.round(top),bodyW,bh)}if(c.live){ctx.strokeStyle='#5d8cff';ctx.strokeRect(Math.round(x-bodyW/2-2),Math.round(top-2),bodyW+4,bh+4)}}
  drawTradeMarkers(geom,pad,plotW,y,lo,hi);drawHighLow(geom,pad,plotW,y,lo,hi);
  drawPositionOverlay(y,lo,hi,pad,W,H);
  if(price>=lo&&price<=hi){const py=y(price),up=!current||current.c>=current.o,col=up?chartSettings.bull:chartSettings.bear;ctx.setLineDash([2,3]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,py);ctx.lineTo(W-pad.r,py);ctx.stroke();ctx.setLineDash([]);const h=chartSettings.countdown?36:22,boxY=clamp(py-h/2,pad.t,H-pad.b-h);ctx.fillStyle=col;ctx.fillRect(W-pad.r,boxY,pad.r,h);ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.fillText(fmt(price,chartDecimals()),W-pad.r+5,boxY+14);if(chartSettings.countdown){ctx.font='10px sans-serif';ctx.fillText(candleRemain(),W-pad.r+5,boxY+29)}if(chartSettings.symbolLabel){const lab=apiSymbol().replace('USDT','-USDT'),tw=ctx.measureText(lab).width+10;ctx.fillStyle=col;ctx.fillRect(W-pad.r-tw,boxY,tw,22);ctx.fillStyle='#fff';ctx.fillText(lab,W-pad.r-tw+5,boxY+14)}}
  for(const o of activeChartOrders()){if(o.limit<lo||o.limit>hi)continue;const oy=y(o.limit),col=o.side==='buy'?chartSettings.bull:chartSettings.bear;ctx.setLineDash([6,4]);ctx.strokeStyle=col;ctx.beginPath();ctx.moveTo(pad.l,oy);ctx.lineTo(W-pad.r,oy);ctx.stroke();ctx.setLineDash([]);const tw=ctx.measureText(o.label).width+12;ctx.fillStyle=o.side==='buy'?'#14251f':'#2a171b';ctx.fillRect(pad.l+8,oy-10,tw,20);ctx.fillStyle=col;ctx.fillText(o.label,pad.l+14,oy+3)}
  const ch=crosshairLocked&&lockedCrosshair?lockedCrosshair:(hoverIndex>=0?{idx:hoverIndex,price:hoverPrice}:null);if(ch&&chartSettings.crosshair){const x=xForIndex(ch.idx,geom,pad,plotW);if(x>=pad.l&&x<=W-pad.r){ctx.strokeStyle='#697386';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();if(Number.isFinite(ch.price)){const yy=y(ch.price);ctx.beginPath();ctx.moveTo(pad.l,yy);ctx.lineTo(W-pad.r,yy);ctx.stroke()}ctx.setLineDash([])}}
  ctx.strokeStyle='#303741';ctx.beginPath();ctx.moveTo(W-pad.r,pad.t);ctx.lineTo(W-pad.r,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,H-pad.b);ctx.lineTo(W-pad.r,H-pad.b);ctx.stroke();
}
window.GreedBitChartRenderer={viewGeometry,resize,calcPriceBounds,xForIndex,timestampAtIndex,buildPriceTicks,buildIndexTicks,draw};
draw();
