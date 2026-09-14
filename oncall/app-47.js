/* v0.7.16 — Live Mandatory date fix + cleaner Mandatory Maintenance Request remarks */
(function(){
  const COMPLETE='Mandatory Overtime completed.';

  function syncMandatoryServiceDate(){
    const input=$('#v070MandatoryDate');
    if(!input)return;
    const d=todayISO();
    if(input.value!==d)input.value=d;
  }

  function shouldNormalizeRemarks(text){
    const r=String(text||'').trim();
    return !r || /^Planned Mandatory Overtime:/i.test(r) || /Actual Mandatory work:/i.test(r);
  }

  function normalizeMandatoryRemarks(){
    let changed=false;
    for(const e of events||[]){
      if(e?.type!=='mandatory_ot'||e.source!=='reportable-work-v070')continue;
      if(shouldNormalizeRemarks(e.remarks)&&e.remarks!==COMPLETE){e.remarks=COMPLETE;changed=true}
    }
    if(changed)save(K.events,events);
  }

  function cleanMandatoryPreview(id){
    const e=(events||[]).find(x=>x.id===id);
    if(!e||e.type!=='mandatory_ot')return;
    const remarks=$('#requestPreview .mr-remarks-text');
    if(remarks)remarks.textContent=COMPLETE;
  }

  // Live Mandatory uses the technician's local calendar date at the exact IN click.
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#v070StartMandatory'))syncMandatoryServiceDate();
    if(e.target?.closest?.('#v070Finish,.workflow-card-close,#workflowOutBtn'))setTimeout(normalizeMandatoryRemarks,0);
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&$('#reportableWork')?.classList.contains('active'))syncMandatoryServiceDate();
  });

  if(typeof previewRequest==='function'&&!previewRequest.__v0716RemarksWrapped){
    const base=previewRequest;
    const wrapped=function(id){
      normalizeMandatoryRemarks();
      base(id);
      cleanMandatoryPreview(id);
      setTimeout(()=>cleanMandatoryPreview(id),0);
    };
    wrapped.__v0716RemarksWrapped=true;
    previewRequest=wrapped;
  }

  const baseGoV0716=go;
  go=function(id){
    baseGoV0716(id);
    if(id==='reportableWork')setTimeout(syncMandatoryServiceDate,0);
    setTimeout(normalizeMandatoryRemarks,0);
  };

  const baseRenderAllV0716=renderAll;
  renderAll=function(){
    baseRenderAllV0716();
    if($('#reportableWork')?.classList.contains('active'))setTimeout(syncMandatoryServiceDate,0);
    setTimeout(normalizeMandatoryRemarks,0);
  };

  if($('#reportableWork')?.classList.contains('active'))syncMandatoryServiceDate();
  normalizeMandatoryRemarks();
})();
