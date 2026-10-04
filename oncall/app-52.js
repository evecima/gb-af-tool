/* v0.7.26 — Edit current Maintenance Request from Preview and return to the same Preview after Save. */
(function(){
  let previewEditEventId='';

  function currentPreviewId(){
    const p=$('#requestPreview');
    return p?.dataset?.previewEventId?String(p.dataset.previewEventId):'';
  }

  function enhanceRequestPreview(id){
    const p=$('#requestPreview');
    const eventId=String(id||currentPreviewId()||'');
    if(!p||!eventId||p.dataset.previewEventId!==eventId)return;

    const header=p.firstElementChild;
    const printBtn=header?.querySelector('button[onclick*="printForm"]');
    if(!header||!printBtn)return;

    let actions=header.querySelector('.request-preview-actions');
    if(!actions){
      actions=document.createElement('div');
      actions.className='row gap request-preview-actions';
      header.insertBefore(actions,printBtn);
      actions.appendChild(printBtn);
    }

    let editBtn=actions.querySelector('.request-preview-edit');
    if(!editBtn){
      editBtn=document.createElement('button');
      editBtn.type='button';
      editBtn.className='secondary request-preview-edit';
      actions.insertBefore(editBtn,printBtn);
    }

    editBtn.textContent=settings.language==='es'?'Editar':'Edit';
    editBtn.title=settings.language==='es'?'Editar este Maintenance Request':'Edit this Maintenance Request';
    editBtn.onclick=()=>{
      const current=currentPreviewId();
      if(!current)return;
      previewEditEventId=current;
      openEventEditor(current);
    };
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0726Wrapped){
    const basePreviewRequest=previewRequest;
    const wrapped=function(id){
      const result=basePreviewRequest(id);
      enhanceRequestPreview(id);
      setTimeout(()=>enhanceRequestPreview(id),0);
      return result;
    };
    wrapped.__v0726Wrapped=true;
    previewRequest=wrapped;
  }

  const form=$('#eventEditorForm');
  if(form&&typeof form.onsubmit==='function'&&!form.onsubmit.__v0726Wrapped){
    const baseSubmit=form.onsubmit;
    const wrappedSubmit=async function(e){
      const returnId=previewEditEventId&&String(editingEventId)===previewEditEventId?previewEditEventId:'';
      const result=await baseSubmit.call(this,e);
      if(returnId){
        previewEditEventId='';
        setTimeout(()=>{
          if((events||[]).some(ev=>String(ev.id)===returnId))previewRequest(returnId);
        },80);
      }
      return result;
    };
    wrappedSubmit.__v0726Wrapped=true;
    form.onsubmit=wrappedSubmit;
  }

  document.addEventListener('click',e=>{
    if(!previewEditEventId)return;
    const close=e.target?.closest?.('[data-close="eventEditorModal"]');
    if(close)previewEditEventId='';
  },true);

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&previewEditEventId)previewEditEventId='';
  },true);

  const baseApplyLanguageV0726=typeof applyLanguage==='function'?applyLanguage:null;
  if(baseApplyLanguageV0726&&!baseApplyLanguageV0726.__v0726Wrapped){
    const wrappedLanguage=function(){
      const result=baseApplyLanguageV0726();
      setTimeout(()=>enhanceRequestPreview(currentPreviewId()),0);
      return result;
    };
    wrappedLanguage.__v0726Wrapped=true;
    applyLanguage=wrappedLanguage;
  }

  enhanceRequestPreview(currentPreviewId());
})();