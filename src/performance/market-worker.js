/* v0.0.15 market worker: parse and batch websocket payloads off the main thread. */
'use strict';
postMessage({type:'ready'});
let batch={seq:0,trades:[],ticker:null};
let timer=null;
const FLUSH_MS=80;
function flush(){
  timer=null;
  if(!batch.trades.length&&!batch.ticker)return;
  postMessage({type:'batch',seq:batch.seq,trades:batch.trades,ticker:batch.ticker});
  batch={seq:batch.seq,trades:[],ticker:null};
}
function schedule(){if(timer==null)timer=setTimeout(flush,FLUSH_MS)}
onmessage=e=>{
  const msg=e.data||{};
  if(msg.type==='reset'){
    batch={seq:+msg.seq||0,trades:[],ticker:null};
    if(timer!=null){clearTimeout(timer);timer=null}
    return;
  }
  if(msg.type!=='raw')return;
  const seq=+msg.seq||0;
  if(batch.seq!==seq)batch={seq,trades:[],ticker:null};
  try{
    const root=typeof msg.payload==='string'?JSON.parse(msg.payload):msg.payload;
    const d=root?.data||root;
    if(!d)return;
    if(d.e==='aggTrade'){
      batch.trades.push({p:+d.p,t:+d.T/1000,v:+d.q});
      /* Keep pathological bursts bounded while preserving first/last and volume. */
      if(batch.trades.length>240){
        const first=batch.trades[0],last=batch.trades.at(-1),v=batch.trades.reduce((a,x)=>a+(+x.v||0),0),hi=Math.max(...batch.trades.map(x=>x.p)),lo=Math.min(...batch.trades.map(x=>x.p));
        batch.trades=[{...first,v:v*.25},{p:hi,t:last.t,v:v*.25},{p:lo,t:last.t,v:v*.25},{...last,v:v*.25}];
      }
    }else if(d.e==='24hrTicker'){
      batch.ticker={last:+d.c,change:+d.P,high:+d.h,low:+d.l,quoteVolume:+d.q};
    }
    schedule();
  }catch{}
};
