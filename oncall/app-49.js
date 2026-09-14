/* v0.7.18 — Clear stale Maintenance Request preview after deleting the previewed event */
(function(){
  const VERSION='0.7.18';

  function requestPreview(){return $('#requestPreview')}

  function markPreview(id){
    const p=requestPreview();
    if(!p)return;
    p.dataset.previewEventId=String(id||'');
  }

  function clearPreviewIfDeleted(id){
    const p=requestPreview();
    if(!p)return;
    const target=String(id||'');
    if(String(p.dataset.previewEventId||'')!==target)return;
    if((events||[]).some(e=>String(e.id)===target))return;
    p.innerHTML='';
    p.classList.add('hidden');
    p.classList.remove('print-target');
    delete p.dataset.previewEventId;
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0718TracksPreview){
    const basePreview=previewRequest;
    const wrappedPreview=function(id){
      basePreview(id);
      markPreview(id);
    };
    wrappedPreview.__v0718TracksPreview=true;
    previewRequest=wrappedPreview;
  }

  if(typeof deleteEvent==='function'&&!deleteEvent.__v0718ClearsPreview){
    const baseDelete=deleteEvent;
    const wrappedDelete=async function(id){
      await baseDelete(id);
      clearPreviewIfDeleted(id);
    };
    wrappedDelete.__v0718ClearsPreview=true;
    deleteEvent=wrappedDelete;
  }
})();
