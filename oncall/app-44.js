/* v0.7.13 — Maintenance Request preview respects a deliberately blank Time Received */
(function(){
  const VERSION='0.7.13';

  function applyBlankTimeReceived(id){
    const ev=(events||[]).find(e=>e.id===id);
    if(!ev||String(ev.timeReceived||'').trim())return;
    const rows=[...document.querySelectorAll('#requestPreview .mr-received-row')];
    const row=rows.find(r=>String(r.querySelector('b')?.textContent||'').trim().toUpperCase()==='TIME RECEIVED');
    const line=row?.querySelector('.mr-line');
    if(line)line.textContent='';
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0713Wrapped){
    const basePreviewRequest=previewRequest;
    const wrapped=function(id){
      basePreviewRequest(id);
      applyBlankTimeReceived(id);
      setTimeout(()=>applyBlankTimeReceived(id),0);
    };
    wrapped.__v0713Wrapped=true;
    previewRequest=wrapped;
  }
})();
