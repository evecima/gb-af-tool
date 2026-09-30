/* Runs inside the real app, using a fresh local origin and synthetic records. */
(async function(){
  const results=[];
  const check=(name,condition)=>{if(!condition)throw Error(name);results.push('PASS '+name)};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,150));
  const p=$('#requestPreview'),previous=()=>p.querySelector('.request-previous'),next=()=>p.querySelector('.request-next');
  const status=()=>p.querySelector('[role="status"]')?.textContent;
  const fixture=(id,date,time,type='emergency')=>({id,date,in:time,out:'20:00',type,source:'navigation-test',problem:'TEST '+id,manualLocation:'TEST location '+id,timeReceived:'17:55',remarks:'TEST remarks '+id,solution:'TEST work '+id,linkedBlockIds:[]});
  try{
    currentPeriodStart='2026-09-20';settings.language='es';settings.workerName='Test Technician';
    events=[fixture('last','2026-09-22','19:00','pool_close'),fixture('first','2026-09-20','18:00'),fixture('middle','2026-09-21','18:00','mandatory_ot'),fixture('outside','2026-10-04','18:00'),{...fixture('hidden','2026-09-21','17:00'),suppressStandaloneReport:true}];
    events.find(e=>e.id==='middle').reportableSegments=[{kind:'work',start:'18:00',end:'20:00',label:'TEST Mandatory segment',location:'TEST Mandatory location'}];
    events.find(e=>e.id==='middle').timeReceived='';
    go('requests');
    const originalEvents=JSON.stringify(events),originalPayroll=JSON.stringify(payrollStore);
    $('.preview-request').click();await settle();
    check('Chronological first request, with previous disabled',p.dataset.previewEventId==='first'&&previous().disabled&&!next().disabled&&status()==='1 de 3');
    next().click();await settle();
    check('Next opens Mandatory in the middle',p.dataset.previewEventId==='middle'&&status()==='2 de 3'&&!previous().disabled&&!next().disabled);
    check('Mandatory layout is retained',p.querySelector('.mr-work-text').textContent.includes('TEST Mandatory segment'));
    next().click();await settle();
    check('Last request disables next',p.dataset.previewEventId==='last'&&next().disabled&&status()==='3 de 3');
    previous().click();await settle();
    check('Previous returns to middle',p.dataset.previewEventId==='middle');
    // Same-turn navigation forces the old deferred callbacks to run after a new preview.
    previewRequest('middle');previewRequest('first');await settle();
    check('Rapid navigation does not overwrite emergency details',p.querySelector('.mr-work-text').textContent==='TEST work first'&&p.querySelector('.mr-remarks-text').textContent==='TEST remarks first'&&p.querySelector('.mr-location-value').textContent.includes('first'));
    check('Rapid navigation retains Time Received',p.querySelectorAll('.mr-received-row .mr-line')[1].textContent==='5:55 PM');
    check('Controls stay outside the printed form',!p.querySelector('.maintenance-request-paper .request-preview-nav'));
    check('Browsing preserves events and Payroll',JSON.stringify(events)===originalEvents&&JSON.stringify(payrollStore)===originalPayroll);
    settings.language='en';renderRequests();check('English labels update',previous().textContent.includes('Previous')&&next().textContent.includes('Next')&&status()==='1 of 3');
    settings.language='es';renderRequests();
    events=events.filter(e=>e.id!=='middle');renderRequests();
    next().click();await settle();check('Navigation uses current list after removal',p.dataset.previewEventId==='last'&&status()==='2 de 2');
    events=events.filter(e=>e.id!=='last');renderRequests();
    check('Removed current request clears stale preview',p.classList.contains('hidden')&&!p.innerHTML&&!p.dataset.previewEventId);
    previewRequest('first');await settle();check('Single request disables both controls',previous().disabled&&next().disabled&&status()==='1 de 1');
    currentPeriodStart='2026-11-01';renderRequests();check('Changing period clears old preview',p.classList.contains('hidden')&&!p.innerHTML);
    events=[];renderRequests();check('Empty period has no navigation',!p.querySelector('.request-preview-nav'));
    // Leave an illustrative, unsaved preview for manual checks.
    currentPeriodStart='2026-09-20';events=[fixture('Water leak','2026-09-20','18:00'),fixture('Pool closing','2026-09-21','19:00','pool_close'),fixture('Snow removal','2026-09-22','06:00','snow')];
    renderRequests();previewRequest('Pool closing');await settle();
    parent.postMessage({navigationTest:results.join('\n')+'\n'+results.length+' checks passed. Synthetic preview ready.'},location.origin);
  }catch(error){parent.postMessage({navigationTest:results.join('\n')+'\nFAIL '+error.message},location.origin);console.error(error)}
})();
