/* v0.7.17 — Keep Mandatory Maintenance Request remarks operational, not payroll-like */
(function(){
  const VERSION='0.7.17';
  const COMPLETE='Mandatory Overtime completed.';

  function shouldNormalizeRemarks(text){
    const r=String(text||'').trim();
    return !r || /^Planned Mandatory Overtime:/i.test(r) || /Actual Mandatory work:/i.test(r);
  }

  function normalizeMandatoryRemarks(){
    let changed=false;
    for(const e of events||[]){
      if(e?.type!=='mandatory_ot'||e.source!=='reportable-work-v070')continue;
      if(shouldNormalizeRemarks(e.remarks)){
        if(e.remarks!==COMPLETE){e.remarks=COMPLETE;changed=true}
      }
    }
    if(changed)save(K.events,events);
  }

  function cleanMandatoryPreview(id){
    const e=(events||[]).find(x=>x.id===id);
    if(!e||e.type!=='mandatory_ot')return;
    const remarks=$('#requestPreview .mr-remarks-text');
    if(remarks)remarks.textContent=COMPLETE;
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0717Wrapped){
    const base=previewRequest;
    const wrapped=function(id){
      normalizeMandatoryRemarks();
      base(id);
      cleanMandatoryPreview(id);
      setTimeout(()=>cleanMandatoryPreview(id),0);
    };
    wrapped.__v0717Wrapped=true;
    previewRequest=wrapped;
  }

  function schedule(){[0,100,350,900].forEach(ms=>setTimeout(normalizeMandatoryRemarks,ms))}

  const baseRenderAllV0717=renderAll;
  renderAll=function(){baseRenderAllV0717();schedule()};

  const baseGoV0717=go;
  go=function(id){baseGoV0717(id);schedule()};

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#v070Finish,.workflow-card-close,#workflowOutBtn'))schedule();
  },true);

  normalizeMandatoryRemarks();
})();
