/* v0.6.4 — Maintenance Request edits save in place; Preview is explicit only */
(function(){
  if(typeof I18N!=='undefined'){
    if(I18N.en)I18N.en.saveChanges='Save Changes';
    if(I18N.es)I18N.es.saveChanges='Guardar Cambios';
  }

  const form=$('#eventEditorForm');
  if(!form)return;

  function syncSaveLabel(){
    const btn=form.querySelector('button[type="submit"]');
    if(btn)btn.textContent=settings.language==='es'?'Guardar Cambios':'Save Changes';
  }

  function hideRequestPreview(){
    const p=$('#requestPreview');
    if(!p)return;
    p.classList.add('hidden');
    p.classList.remove('print-target');
    p.innerHTML='';
  }

  form.onsubmit=e=>{
    e.preventDefault();
    const ev=events.find(x=>x.id===editingEventId);if(!ev)return;
    const d=Object.fromEntries(new FormData(e.currentTarget).entries()),oldType=ev.type;
    Object.assign(ev,d);
    ev.vendor=$('#editUsedVendor').checked?vendorValue('edit'):'';
    if(!$('#editUsedVendor').checked)ev.vendorWork='';
    ev.result=ev.remarks||'';
    applyTypeDefaults(ev,ev.type,oldType);
    save(K.events,events);
    learnEvent(ev);
    closeModal('eventEditorModal');
    hideRequestPreview();
    renderAll();
    toast(settings.language==='es'?'Maintenance Request guardado. Usa Preview cuando quieras revisarlo.':'Maintenance Request saved. Use Preview when you want to review it.');
  };

  const baseApplyLanguageV064=applyLanguage;
  applyLanguage=function(){baseApplyLanguageV064();syncSaveLabel()};

  syncSaveLabel();
})();
