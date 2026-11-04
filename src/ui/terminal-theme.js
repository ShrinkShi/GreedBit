/* HTX-inspired terminal theme and range controls. */
(function(){
'use strict';
function installStyle(){
  if(document.querySelector('link[href^="styles/v020.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href=cssHref('styles/v020.css');document.head.appendChild(l);
}
function pct(input){
  if(!input)return 0;const min=Number(input.min)||0,max=Number(input.max)||100,v=Number(input.value)||0;
  return max>min?Math.max(0,Math.min(1,(v-min)/(max-min))):0;
}
function syncRange(input){
  if(!input)return;input.style.setProperty('--gb18-range-pct',`${(pct(input)*100).toFixed(3)}%`);
  const dots=input.id==='pct'?document.getElementById('pctDots'):input.id==='spotPct'?document.getElementById('spotPctDots'):null;
  if(dots){const v=Number(input.value)||0;dots.querySelectorAll('[data-pct]').forEach(d=>d.classList.toggle('passed',Number(d.dataset.pct)<=v))}
  if(input.id==='levRange')syncLeverageDots();
}
function installLeverageDots(){
  const wrap=document.querySelector('.lev-range-wrap'),input=document.getElementById('levRange');if(!wrap||!input)return;
  let dots=document.getElementById('gb20LevDots');
  if(!dots){
    dots=document.createElement('div');dots.id='gb20LevDots';dots.className='gb20-lev-dots';
    const marks=[1,40,80,120,160,200],min=Number(input.min)||1,max=Number(input.max)||200;
    dots.innerHTML=marks.map(v=>{const p=(v-min)/(max-min)*100;return `<i data-value="${v}" style="left:${Math.max(0,Math.min(100,p))}%"></i>`}).join('');
    wrap.appendChild(dots);
  }
  syncLeverageDots();
}
function syncLeverageDots(){
  const input=document.getElementById('levRange'),dots=document.getElementById('gb20LevDots');if(!input||!dots)return;
  const v=Number(input.value)||0;dots.querySelectorAll('[data-value]').forEach(d=>d.classList.toggle('passed',Number(d.dataset.value)<=v));
}
function installRangeSync(){
  for(const id of ['pct','spotPct','levRange']){
    const input=document.getElementById(id);if(!input)continue;syncRange(input);
    input.addEventListener('input',()=>syncRange(input));input.addEventListener('change',()=>syncRange(input));
  }
}
function removeLegacyScrollbarOverride(){document.getElementById('gb19ScrollbarPolish')?.remove()}
function boot(){
  installStyle();removeLegacyScrollbarOverride();document.body.classList.add('gb20-ui');installLeverageDots();installRangeSync();
  const modal=document.getElementById('leverageModal');if(modal)new MutationObserver(()=>{if(modal.classList.contains('show')){installLeverageDots();syncRange(document.getElementById('levRange'))}}).observe(modal,{attributes:true,attributeFilter:['class']});
  window.GreedBitTerminalTheme={syncRange};
}
boot();
})();
