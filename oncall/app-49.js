/* v0.7.18 — Mandatory Maintenance Request keeps TOTAL TIME blank */
(function(){
  const VERSION='0.7.18';

  function blankMandatoryTotalTime(id){
    const e=(events||[]).find(x=>x.id===id);
    if(!e||e.type!=='mandatory_ot')return;
    const rows=$$('#requestPreview .maintenance-request-paper .mr-worker-table tbody tr');
    for(const row of rows){
      const cells=row.querySelectorAll('td');
      if(cells.length>=5)cells[4].textContent='';
    }
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0718MandatoryTotalBlank){
    const base=previewRequest;
    const wrapped=function(id){
      base(id);
      blankMandatoryTotalTime(id);
      setTimeout(()=>blankMandatoryTotalTime(id),0);
      setTimeout(()=>blankMandatoryTotalTime(id),80);
    };
    wrapped.__v0718MandatoryTotalBlank=true;
    previewRequest=wrapped;
  }
})();
