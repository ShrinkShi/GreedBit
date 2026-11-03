/* v0.0.19 hotfix: pair-label ownership + slimmer scrollbars */
(function(){
'use strict';

function currentSymbol(){
  try{if(typeof symbol==='string'&&symbol)return symbol}catch{}
  const sel=document.getElementById('symbol');
  return typeof sel?.value==='string'?sel.value:'';
}
function currentMode(){
  try{if(typeof tradingMode==='string'&&tradingMode)return tradingMode}catch{}
  return 'futures';
}
function currentMeta(sym){return window.GreedBitV13?.META?.[sym]||null}
function desiredPairLabel(){
  const sym=currentSymbol();if(!sym)return'';
  const mode=currentMode(),m=currentMeta(sym),market=m?.market||m?.category||'';
  const code=String(sym).replaceAll('/','');
  if(mode==='futures'&&market!=='commodity'&&market!=='forex')return `${code}永续合约`;
  if(mode==='spot')return m?.ticker||String(sym).split('/')[0];
  if(market==='forex')return m?.ticker||sym;
  return sym;
}
function installPairLabelGuard(){
  const el=document.getElementById('pairName');if(!el)return;
  const native=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
  if(!native?.get||!native?.set)return;
  try{
    Object.defineProperty(el,'textContent',{
      configurable:true,
      get(){return native.get.call(this)},
      set(v){
        const wanted=desiredPairLabel();
        native.set.call(this,wanted||String(v??''));
      }
    });
  }catch{}
  const wanted=desiredPairLabel();if(wanted)native.set.call(el,wanted);
  window.GreedBitPairLabelGuard={enforce(){const next=desiredPairLabel();if(next)native.set.call(el,next)}};
}
function installScrollbarPolish(){
  if(document.getElementById('gb19ScrollbarPolish'))return;
  const s=document.createElement('style');s.id='gb19ScrollbarPolish';s.textContent=`
    *{scrollbar-width:thin!important;scrollbar-color:rgba(132,145,165,.16) transparent!important}
    *::-webkit-scrollbar{width:3px!important;height:3px!important}
    *::-webkit-scrollbar-track{background:transparent!important}
    *::-webkit-scrollbar-thumb{background:rgba(132,145,165,.12)!important;border:0!important;border-radius:2px!important;min-height:24px}
    *:hover::-webkit-scrollbar-thumb{background:rgba(132,145,165,.28)!important}
    *::-webkit-scrollbar-thumb:hover{background:rgba(152,166,188,.42)!important}
    *::-webkit-scrollbar-button{display:none!important;width:0!important;height:0!important}
    *::-webkit-scrollbar-corner{background:transparent!important}
  `;document.head.appendChild(s);
}

installScrollbarPolish();
installPairLabelGuard();
})();
