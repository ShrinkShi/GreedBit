const test=require('node:test');
const assert=require('node:assert/strict');
const book=require('../src/domain/position-book.js');

const short=(id,opts={})=>({id,symbol:'ETH/USDT',side:'short',mode:'cross',leverage:10,entry:2300,qty:0.1,margin:23,notional:230,fee:0.1,openedTs:id,...opts});
test('same-symbol same-side cross lots merge by quantity and preserve notional/margin',()=>{
  const a=short(1,{entry:2300,qty:1,margin:230,notional:2300,fee:1,openedTs:100});
  const b=short(2,{entry:2500,qty:2,margin:500,notional:5000,fee:2,openedTs:200});
  const list=[a];
  const merged=book.add(list,b);
  assert.equal(list.length,1);
  assert.equal(merged.id,1);
  assert.equal(merged.qty,3);
  assert.equal(merged.margin,730);
  assert.equal(merged.notional,7300);
  assert.ok(Math.abs(merged.entry-(2300+2*2500)/3)<1e-9);
  assert.ok(Math.abs(merged.leverage-10)<1e-9);
  assert.equal(merged.fee,3);
  assert.equal(merged.openedTs,100);
});
test('cross leverage is locked across both sides of the same contract',()=>{
  const p=[short(1)];
  assert.equal(book.lockedLeverage(p,'ETH/USDT'),10);
  assert.equal(book.canOpen(p,{symbol:'ETH/USDT',mode:'cross',leverage:10}),true);
  assert.equal(book.canOpen(p,{symbol:'ETH/USDT',mode:'cross',leverage:20}),false);
  assert.equal(book.canOpen(p,{symbol:'ETH/USDT',mode:'isolated',leverage:20}),true);
  assert.equal(book.canOpen(p,{symbol:'BTC/USDT',mode:'cross',leverage:20}),true);
  assert.equal(book.canOpen([],{symbol:'ETH/USDT',mode:'cross',leverage:20}),true);
});
test('opposite cross positions and isolated positions remain separate',()=>{
  const p=[short(1)];
  book.add(p,short(2,{side:'long'}));
  book.add(p,short(3,{mode:'isolated'}));
  book.add(p,short(4,{mode:'isolated'}));
  assert.equal(p.length,4);
});
test('legacy snapshots normalize cross lots but preserve isolated ids',()=>{
  const legacy=[short(2,{qty:.2,margin:46,notional:460}),short(1),short(3,{mode:'isolated'})];
  const out=book.normalize(legacy);
  assert.equal(out.length,2);
  assert.equal(out.filter(x=>x.mode==='cross').length,1);
  assert.ok(Math.abs(out.find(x=>x.mode==='cross').qty-.3)<1e-10);
  assert.equal(out.find(x=>x.mode==='isolated').id,3);
  assert.equal(legacy.length,3);
  assert.equal(legacy[0].qty,.2);
});
test('merged net position uses a single latest explicit TP/SL',()=>{
  const old=short(1,{tp:2000,sl:2600}),incoming=short(2,{tp:1900,sl:0});
  const merged=book.mergeCross(old,incoming);
  assert.equal(merged.tp,1900);
  assert.equal(merged.sl,2600);
});
test('partial close by percent and USDT notional is bounded to the position',()=>{
  const p=short(1,{qty:2});
  assert.deepEqual(book.closeSize(p,'percent',25,2000),{fraction:.25,qty:.5,notional:1000});
  assert.deepEqual(book.closeSize(p,'notional',1000,2000),{fraction:.25,qty:.5,notional:1000});
  assert.equal(book.closeSize(p,'notional',4500,2000),null);
  assert.equal(book.closeSize(p,'percent',101,2000),null);
  assert.equal(book.closeSize(p,'percent',0,2000),null);
  assert.equal(book.closeSize(p,'notional',100,-1),null);
});
test('position line uses the exact same price-space transformation as axis',()=>{
  const axis={lo:2000,hi:2400,top:28,height:400};
  assert.equal(book.priceY(2400,axis),28);
  assert.equal(book.priceY(2200,axis),228);
  assert.equal(book.priceY(2000,axis),428);
  assert.ok(Number.isNaN(book.priceY(2200,{...axis,hi:2000})));
});

test('legacy mixed-leverage hedge cannot accept any additional cross order',()=>{
  const positions=[short(1,{leverage:10}),short(2,{side:'long',leverage:20,notional:460})];
  assert.equal(book.canOpen(positions,{symbol:'ETH/USDT',mode:'cross',leverage:10}),false);
  assert.equal(book.canOpen(positions,{symbol:'ETH/USDT',mode:'cross',leverage:20}),false);
  assert.equal(book.canOpen(positions,{symbol:'ETH/USDT',mode:'isolated',leverage:30}),true);
});
test('legacy normalization does not drop positions with malformed quantities',()=>{
  const raw=[short(1,{qty:0}),short(2,{qty:1}),short(3,{mode:'isolated'})];
  const out=book.normalize(raw);
  assert.equal(out.length,3);
  assert.deepEqual(out.map(p=>p.id).sort(),[1,2,3]);
});

test('visible chart positions include restored in-range ETH cross holdings',()=>{
  const saved=[
    short(1,{entry:2301.62,qty:2.63,margin:60,notional:6042.67}),
    short(2,{symbol:'BTC/USDT',entry:65000}),
    short(3,{entry:2100,mode:'isolated'}),
    short(4,{entry:2300,qty:0})
  ];
  const restored=book.normalize(saved);
  const visible=book.visibleChartPositions(restored,{symbol:'ETH/USDT',lo:2240,hi:2340});
  assert.equal(visible.length,1);
  assert.equal(visible[0].entry,2301.62);
  assert.equal(visible[0].symbol,'ETH/USDT');
});
test('chart position selection has no dependency on page state or order history',()=>{
  const position=short(21,{entry:2297.46});
  assert.deepEqual(book.visibleChartPositions([position],{symbol:'ETH/USDT',lo:2200,hi:2350}),[position]);
  assert.deepEqual(book.visibleChartPositions([position],{symbol:'ETH/USDT',lo:2350,hi:2450}),[]);
  assert.deepEqual(book.visibleChartPositions([position],{symbol:'BTC/USDT',lo:2200,hi:2350}),[]);
  assert.deepEqual(book.visibleChartPositions([position],{symbol:'ETH/USDT',lo:2400,hi:2400}),[]);
});
