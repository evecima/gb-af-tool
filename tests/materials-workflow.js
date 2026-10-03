(async function(){
  const results=[],check=(name,value)=>{if(!value)throw Error(name);results.push('PASS '+name)};
  const settle=()=>new Promise(r=>setTimeout(r,120));
  try{
    currentPeriodStart='2026-09-20';settings.language='en';settings.workerName='Test Technician';settings.community='Test Community';
    const legacy=makeEvent('emergency','2026-09-26','11:21','12:18','materials-test');
    Object.assign(legacy,{id:'legacy-material',problem:'Stove Not Working',finding:'TEST finding',solution:'TEST repair',material:'1 infinite switch, 1 burner receptacle, 4 burners, 4 drip pans',quantity:'4'});
    delete legacy.materialItems;
    events=[legacy];save(K.events,events);renderAll();go('requests');
    check('Legacy material fallback is preserved',eventMaterialItems(legacy).length===1&&eventMaterialItems(legacy)[0].quantity==='4');
    openEventEditor(legacy.id);
    check('Legacy request opens as one editable material row',$$('#editMaterialRows .material-row').length===1&&$('#editMaterialRows .edit-material-name').value.includes('infinite switch'));
    const first=$('#editMaterialRows .material-row');
    first.querySelector('.edit-material-name').value='Infinite switch';first.querySelector('.edit-material-qty').value='1';
    const add=$('#addMaterialRowBtn');
    [['Burner receptacle','1'],['Burner','4'],['Drip pan','4']].forEach(([material,qty])=>{
      add.click();const row=$('#editMaterialRows .material-row:last-child');row.querySelector('.edit-material-name').value=material;row.querySelector('.edit-material-qty').value=qty;
    });
    check('Add Material creates separate rows',$$('#editMaterialRows .material-row').length===4);
    $('#eventEditorForm').requestSubmit();await settle();
    const saved=events.find(e=>e.id===legacy.id);
    check('Four structured material rows are saved',saved.materialItems?.length===4&&saved.materialItems[3].material==='Drip pan'&&saved.materialItems[3].quantity==='4');
    check('Legacy fields keep first material for compatibility',saved.material==='Infinite switch'&&saved.quantity==='1');
    const stored=JSON.parse(localStorage.getItem(K.events)).find(e=>e.id===legacy.id);
    check('Structured materials persist in local storage',stored.materialItems?.length===4);
    const rows=$$('#requestPreview .mr-material-table tbody tr');
    const text=rows.slice(0,4).map(r=>r.textContent.replace(/\s+/g,' ').trim());
    check('Preview prints each material on its own row',text[0].includes('1')&&text[0].includes('Infinite switch')&&text[1].includes('Burner receptacle')&&text[2].includes('Burner')&&text[3].includes('Drip pan'));
    check('Preview preserves at least six material lines',rows.length>=7);
    openEventEditor(saved.id);
    $('#addMaterialRowBtn').click();
    const before=$$('#editMaterialRows .material-row').length;
    $('#editMaterialRows .material-row:last-child .remove-material-row').click();
    check('Material row can be removed', $$('#editMaterialRows .material-row').length===before-1);
    closeModal('eventEditorModal');
    parent.postMessage({materialsTest:results.join('\n')+'\n'+results.length+' checks passed.'},location.origin);
  }catch(error){parent.postMessage({materialsTest:results.join('\n')+'\nFAIL '+error.message},location.origin);console.error(error)}
})();