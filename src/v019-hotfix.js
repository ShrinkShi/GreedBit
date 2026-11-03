/* v0.0.19 hotfix: pair-label ownership + slimmer scrollbars */
(function(){
'use strict';

function meta(){return window.GreedBitV13?.META?.[window.symbol]||null}
function desiredPairLabel(){
  const sym=window.symbol;if(!sym)return'';
  const m=meta(),market=m?.market||m?.category||'';
  const code=String(sym).replace('/','');
  if(window.tradingMode==='futures'&&market!=='commodity'&&market!=='forex')return `${code}永续合约`;
  if(window.tradingMode==='spot')return m?.ticker||(typeof window.base==='function'?window.base():String(sym).split('/')[0]);
  if(market==='forex')return m?.ticker||sym;
  return sym;
}
function enforcePairLabel(){
  const el=document.getElementById('pairName'),wanted=desiredPairLabel();
  if(el&&wanted&&el.textContent!==wanted)el.textContent=wanted;
}
function installPairLabelGuard(){
  const el=document.getElementById('pairName');if(!el)return;
  enforcePairLabel();
  const observer=new MutationObserver(()=>enforcePairLabel());
  observer.observe(el,{childList:true,characterData:true,subtree:true});
  window.GreedBitPairLabelGuard={observer,enforce:enforcePairLabel};
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
window.addEventListener('load',enforcePairLabel,{once:true});
})();
