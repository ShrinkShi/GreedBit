const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const book=require('../src/domain/position-book.js');

/* Run the real renderer against a deterministic Canvas mock. The test protects
 * the boot/hydration event path without requiring a network or graphical browser.
 */
function scene(){
  const handlers=new Map(),strokes=[],labels=[],rects=[];
  const dom={
    chartwrap:{classList:{toggle(){}}},
    volumeDividerHint:{style:{}},
    maLegend:{innerHTML:''}
  };
  const ctx={
    dash:[],strokeStyle:'',fillStyle:'',
    clearRect(){},fillRect(x,y,w,h){rects.push({x,y,w,h,color:this.fillStyle})},strokeRect(){},beginPath(){},save(){},restore(){},closePath(){},fill(){},
    moveTo(x,y){this.from=[x,y]},
    lineTo(x,y){this.to=[x,y]},
    setLineDash(items){this.dash=items.slice()},
    stroke(){strokes.push({color:this.strokeStyle,dash:this.dash.slice(),from:this.from?.slice(),to:this.to?.slice()})},
    fillText(text){labels.push(String(text))},
    measureText(text){return{width:String(text).length*6}}
  };
  const candles=[
    {t:1762300000,o:2270,h:2300,l:2240,c:2290,v:12},
    {t:1762300300,o:2290,h:2320,l:2280,c:2310,v:12},
    {t:1762300600,o:2310,h:2340,l:2300,c:2320,v:12},
    {t:1762300900,o:2320,h:2330,l:2300,c:2317,v:12}
  ];
  const sandbox={
    window:{GreedBitPositionBook:book,GreedBitBootstrap:{ready:false},
      GreedBitContracts:{supportsPerpBasis:()=>false}},
    document:{addEventListener(name,fn){handlers.set(name,fn)}},
    requestAnimationFrame(fn){fn()},
    canvas:{clientWidth:1000,clientHeight:600,getBoundingClientRect(){return{top:0,left:0,width:1000,height:600}}},
    $:id=>dom[id]||null,
    ctx,user:{username:'test'},currentPage:'futures',tradingMode:'futures',positions:[],
    orders:[],trades:[],spotOrders:[],spotTrades:[],
    symbol:'ETH/USDT',price:2317,cfg:{dec:2},
    chartSettings:{rightBars:0,topMargin:0,bottomMargin:0,highLow:false,markers:false,
      body:false,border:false,wick:false,countdown:false,symbolLabel:false,crosshair:false,
      precision:'auto',timezone:'utc8',timeFormat:'24',dateFormat:'ymd',
      bull:'#3dbb83',bear:'#ec5d68',grid:'#1d232b',background:'#0b0e12'},
    visibleCount:4,viewShift:0,yPan:0,yZoom:1,hoverIndex:-1,hoverPrice:null,
    crosshairLocked:false,lockedCrosshair:null,tf:300,current:null,
    currentSeries(){return candles},
    markFor(){return 2317},
    tfInfo(){return{sec:300,calendarMonth:false}},
    apiSymbol(){return'ETHUSDT'},
    fmt(value,places=2){return Number(value).toFixed(places)},
    clamp(value,min,max){return Math.max(min,Math.min(max,value))},
    devicePixelRatio:1,console
  };
  const source=fs.readFileSync(path.resolve(__dirname,'../src/chart/renderer.js'),'utf8');
  vm.runInNewContext(source,sandbox,{filename:'renderer.js'});
  return {sandbox,dom,labels,strokes,rects,emit(name){assert.ok(handlers.has(name),'missing event '+name);handlers.get(name)()}};
}
const restoredPosition={id:11,symbol:'ETH/USDT',side:'short',mode:'cross',
  leverage:10,entry:2301.62,qty:2.63,margin:60,notional:6042.67};

test('existing position becomes visible after boot-ready hydration repaint',()=>{
  const s=scene();
  assert.ok(!s.labels.some(t=>t.includes('浮亏')));
  s.sandbox.positions=[restoredPosition];
  s.emit('greedbit:positions-changed');
  assert.ok(!s.labels.some(t=>t.includes('浮亏')),'no mid-bootstrap redraw');
  s.sandbox.window.GreedBitBootstrap.ready=true;
  s.emit('greedbit:ready');
  assert.ok(s.labels.some(t=>t.includes('浮亏')&&t.includes('10X')));
  const line=s.strokes.find(x=>x.color==='#ec5d68'&&x.dash.join(',')==='5,3');
  assert.ok(line,'no red dashed position line drawn');
  const expected=book.priceY(2301.62,{lo:2240,hi:2340,top:28,height:530});
  assert.ok(Math.abs(line.from[1]-(Math.round(expected)+.5))<1e-7);
  assert.equal(line.from[1],line.to[1],'position line must be price-horizontal');
});
test('futures positions render on a shared trade route and disappear on logout',()=>{
  const s=scene();
  s.sandbox.window.GreedBitBootstrap.ready=true;
  s.sandbox.currentPage='trade';
  s.sandbox.positions=[restoredPosition];
  s.emit('greedbit:positions-changed');
  const before=s.strokes.filter(x=>x.dash.join(',')==='5,3').length;
  assert.equal(before,1,'futures position must be visible on shared trade route');
  s.sandbox.user=null;
  s.emit('greedbit:positions-changed');
  const after=s.strokes.filter(x=>x.dash.join(',')==='5,3').length;
  assert.equal(after,before,'logout must not draw stale position overlays');
});

test('position overlay survives MA and separate-volume rendering in the same canvas pass',()=>{
  const s=scene();
  s.sandbox.chartSettings.volumeEnabled=true;
  s.sandbox.chartSettings.volumeMode='separate';
  s.sandbox.chartSettings.volumeRatio=.25;
  s.sandbox.chartSettings.maEnabled=true;
  s.sandbox.chartSettings.ma5=true;
  s.sandbox.chartSettings.maDisplay='line-values';
  s.sandbox.window.GreedBitBootstrap.ready=true;
  s.sandbox.positions=[restoredPosition];
  s.emit('greedbit:positions-changed');
  const L=s.sandbox.window.GreedBitChartRenderer.chartLayout();
  assert.equal(L.sep,true);
  assert.ok(L.mainH<530);
  assert.equal(s.dom.chartwrap.classList.toggle instanceof Function,true);
  assert.ok(s.rects.length>0,'separate volume must render bars');
  const line=s.strokes.find(x=>x.color==='#ec5d68'&&x.dash.join(',')==='5,3');
  assert.ok(line,'position line must not disappear when separate volume is on');
  const priceY=book.priceY(restoredPosition.entry,{lo:2240,hi:2340,top:L.pad.t,height:L.mainH});
  assert.equal(line.from[1],Math.round(priceY)+.5);
  assert.equal(line.to[1],line.from[1]);
  const inverse=s.sandbox.window.GreedBitChartRenderer.chartPriceAtClientY(priceY);
  assert.ok(Math.abs(inverse-restoredPosition.entry)<1e-6);
});
test('UI preferences cannot replace the canonical chart renderer',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../src/ui/preferences.js'),'utf8');
  assert.doesNotMatch(source,/window\\.draw\\s*=/);
  assert.doesNotMatch(source,/function\\s+draw\\s*\\(/);
  assert.doesNotMatch(source,/ctx\\.(?:clearRect|fillRect|stroke|beginPath)/);
  const renderer=fs.readFileSync(path.resolve(__dirname,'../src/chart/renderer.js'),'utf8');
  assert.match(renderer,/drawPositionOverlay\\(y,lo,hi,pad,W,L\\.mainBottom\\)/);
  assert.match(renderer,/drawVolumes\\(geom,L\\)/);
  assert.match(renderer,/drawMAs\\(geom,L,y\\)/);
});
