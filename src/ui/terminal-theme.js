/* v0.0.20 HTX-inspired terminal polish */
(function(){
'use strict';
const VERSION='0.0.20';

function installStyle(){
  if(document.querySelector('link[href="styles/v020.css"]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='styles/v020.css';document.head.appendChild(l);
}
function updateVersion(){
  const el=[...document.querySelectorAll('.statusbar .ticker')].find(x=>x.textContent.includes('GreedBit'));
  if(el)el.textContent=`GreedBit v${VERSION}`;
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
function loadV25(){
  if(document.querySelector('script[src="src/v025.js"]'))return;
  const s=document.createElement('script');s.src='src/v025.js';document.body.appendChild(s);
}
function loadV24(){
  const existing=document.querySelector('script[src="src/v024.js"]');
  if(existing){existing.addEventListener('load',loadV25,{once:true});if(existing.dataset.gbLoaded==='1')loadV25();return}
  const s=document.createElement('script');s.src='src/v024.js';s.addEventListener('load',()=>{s.dataset.gbLoaded='1';loadV25()},{once:true});document.body.appendChild(s);
}
function loadV21(){
  const existing=document.querySelector('script[src="src/v021.js"]');
  if(existing){if(window.GreedBitV21)loadV24();else existing.addEventListener('load',loadV24,{once:true});return}
  const n=document.createElement('script');n.src='src/v021.js';n.addEventListener('load',loadV24,{once:true});document.body.appendChild(n);
}
function boot(){
  installStyle();removeLegacyScrollbarOverride();document.body.classList.add('gb20-ui');installLeverageDots();installRangeSync();updateVersion();
  const modal=document.getElementById('leverageModal');if(modal)new MutationObserver(()=>{if(modal.classList.contains('show')){installLeverageDots();syncRange(document.getElementById('levRange'))}}).observe(modal,{attributes:true,attributeFilter:['class']});
  window.GreedBitV20={VERSION,syncRange};
  loadV21();
}
boot();
})();
