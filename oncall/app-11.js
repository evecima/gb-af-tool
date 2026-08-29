/* v0.5.14 — iOS preview scaling + local PDF print handoff */
(function(){
  const isIOS=/iPad|iPhone|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(!isIOS)return;
  document.documentElement.classList.add('ios-device');

  const paperSelectors=['#payrollPreview .timecard-paper','#summaryPreview .summary-paper','#requestPreview .maintenance-request-paper'];

  function ensureStage(paper){
    if(!paper||paper.closest('.ios-paper-stage'))return paper?.closest('.ios-paper-stage')||null;
    const stage=document.createElement('div');
    stage.className='ios-paper-stage';
    paper.parentNode.insertBefore(stage,paper);
    stage.appendChild(paper);
    return stage;
  }

  function fitStage(stage){
    if(!stage)return;
    const paper=stage.firstElementChild;
    if(!paper)return;
    paper.style.transform='none';
    paper.style.transformOrigin='top left';
    const naturalW=paper.offsetWidth||paper.scrollWidth;
    const naturalH=paper.offsetHeight||paper.scrollHeight;
    const parentW=Math.max(260,(stage.parentElement?.clientWidth||window.innerWidth)-4);
    const scale=Math.min(1,parentW/naturalW);
    paper.style.transform=`scale(${scale})`;
    stage.style.width=Math.ceil(naturalW*scale)+'px';
    stage.style.height=Math.ceil(naturalH*scale)+'px';
  }

  function fitAll(){
    paperSelectors.forEach(sel=>document.querySelectorAll(sel).forEach(p=>fitStage(ensureStage(p))));
  }

  ['payrollPreview','summaryPreview','requestPreview'].forEach(id=>{
    const node=document.getElementById(id);
    if(node)new MutationObserver(()=>requestAnimationFrame(()=>requestAnimationFrame(fitAll))).observe(node,{childList:true,subtree:false});
  });
  window.addEventListener('resize',()=>requestAnimationFrame(fitAll));
  window.addEventListener('orientationchange',()=>setTimeout(fitAll,180));
  requestAnimationFrame(fitAll);

  function cleanClone(node){
    const c=node.cloneNode(true);
    c.removeAttribute('style');
    c.querySelectorAll('[style]').forEach(el=>{
      el.style.removeProperty('transform');
      el.style.removeProperty('transform-origin');
      if(!el.getAttribute('style'))el.removeAttribute('style');
    });
    return c.outerHTML;
  }

  function printJob(kind){
    let nodes=[],title='Print';
    if(kind==='payroll'){
      nodes=[...document.querySelectorAll('#payrollPreview .timecard-paper')];
      title='Payroll TIME CARD';
    }else if(kind==='summary'){
      nodes=[...document.querySelectorAll('#summaryPreview .summary-paper')];
      title='On-Call Time Summary';
    }else if(kind==='request'){
      nodes=[...document.querySelectorAll('#requestPreview .maintenance-request-paper')];
      title='Maintenance Request';
    }
    if(!nodes.length){
      if(typeof toast==='function')toast('Open the preview before printing.');
      return;
    }
    const job={kind,title,html:nodes.map(cleanClone).join(''),returnUrl:location.href,createdAt:Date.now()};
    try{
      sessionStorage.setItem('ocma_ios_print_job',JSON.stringify(job));
      location.href='./print.html?v=0.5.14';
    }catch(err){
      if(typeof toast==='function')toast('Could not open the iOS PDF view: '+err.message);
    }
  }

  window.printForm=printJob;
})();
