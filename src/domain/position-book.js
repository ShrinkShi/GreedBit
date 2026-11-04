/* Canonical futures position book and close-size math.
 * No DOM, storage or market IO. Shared by the browser and Node tests.
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GreedBitPositionBook=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EPS=1e-8;
  const number=value=>Number(value);
  const valid=n=>Number.isFinite(n);
  function lockedLeverage(book,symbol){
    const p=book.find(p=>p&&p.mode==='cross'&&p.symbol===symbol&&number(p.qty)>EPS);
    return p?number(p.leverage):null;
  }
  function canOpen(book,{symbol,mode,leverage}){
    if(mode!=='cross')return true;
    // Historical data may contain inconsistent leverage on opposite-side cross positions.
    // Never silently choose one and allow a new order that conflicts with the other.
    const matches=book.filter(p=>p&&p.mode==='cross'&&p.symbol===symbol&&number(p.qty)>EPS);
    return matches.every(p=>valid(number(p.leverage))&&Math.abs(number(p.leverage)-number(leverage))<=EPS*Math.max(1,Math.abs(number(p.leverage))));
  }
  function mergeCross(a,b){
    if(a.mode!=='cross'||b.mode!=='cross'||a.symbol!==b.symbol||a.side!==b.side)throw new Error('只能合并同交易对、同方向的全仓仓位');
    const aq=number(a.qty),bq=number(b.qty),am=number(a.margin),bm=number(b.margin);
    if(!(aq>0&&bq>0&&am>0&&bm>0))throw new Error('仓位数量/保证金无效');
    const qty=aq+bq,margin=am+bm,notional=number(a.notional||am*a.leverage)+number(b.notional||bm*b.leverage);
    const entry=(aq*number(a.entry)+bq*number(b.entry))/qty;
    // A later order with explicit TP/SL replaces that field for the net position.
    return {...a,qty,margin,notional,entry,leverage:notional/margin,
      fee:(number(a.fee)||0)+(number(b.fee)||0),
      tp:b.tp||a.tp||null,sl:b.sl||a.sl||null,
      openedTs:Math.min(number(a.openedTs)||Infinity,number(b.openedTs)||Infinity)};
  }
  function add(book,position){
    if(position.mode==='cross'){
      const existing=book.find(p=>p&&p.mode==='cross'&&p.symbol===position.symbol&&p.side===position.side);
      if(existing){Object.assign(existing,mergeCross(existing,position));return existing;}
    }
    book.unshift(position);return position;
  }
  function normalize(book){
    if(!Array.isArray(book))return[];
    const result=[];
    // Feed oldest first; the surviving id remains stable and the most recent row is first.
    for(let i=book.length-1;i>=0;i--){
      const row=book[i];if(!row||typeof row!=='object')continue;
      try{add(result,{...row});}
      catch{result.unshift({...row});} // preserve malformed legacy lots instead of discarding the entire account
    }
    return result;
  }
  function closeSize(position,kind,value,mark){
    const qty=number(position?.qty),p=number(mark),amount=number(value);
    if(!(qty>0&&p>0&&amount>0))return null;
    let fraction;
    if(kind==='percent'){if(amount>100)return null;fraction=amount/100;}
    else if(kind==='notional'){if(amount>qty*p*(1+EPS))return null;fraction=amount/(qty*p);}
    else return null;
    if(!valid(fraction)||!(fraction>0&&fraction<=1+EPS))return null;
    fraction=Math.min(1,fraction);
    return {fraction,qty:qty*fraction,notional:qty*fraction*p};
  }
  function priceY(value,{lo,hi,top,height}){
    const p=number(value),a=number(lo),b=number(hi),h=number(height);
    if(!valid(p)||!(b>a)||!(h>0))return NaN;
    return number(top)+(b-p)/(b-a)*h;
  }
  return {EPS,lockedLeverage,canOpen,mergeCross,add,normalize,closeSize,priceY};
});
