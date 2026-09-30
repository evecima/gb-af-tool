(async function(){
  const results=[],check=(name,value)=>{if(!value)throw Error(name);results.push('PASS '+name)};
  const settle=()=>new Promise(r=>setTimeout(r,250));
  const review=()=>$('#daysEditor .review-event');
  try{
    currentPeriodStart='2026-09-20';settings.language='es';settings.workerName='Test Technician';settings.community='Test Community';
    const days=make14('pdf');
    days.forEach((day,i)=>{day.blocks=[{id:'test-'+i,in:'08:00',out:'12:00'},{id:'test-pm-'+i,in:'13:00',out:'17:00',outCorrected:i===3}];day.note=i===3?'Vacation':''});
    setPayroll(days);snapshots[periodKey()]=clone(days);
    events=[{id:'test-review',type:'emergency',date:days[0].date,in:'08:00',out:'09:00',timeReceived:'07:55',source:'test',problem:'TEST Water leak',solution:'TEST repair',linkedBlockIds:[]}];
    applyLanguage();go('payroll');
    const hours=JSON.stringify(payrollStore),humanity=JSON.stringify(snapshots);
    $('#payrollDownBtn').click();await settle();
    check('Top shortcut generates a current Time Card',!$('#payrollPreview').classList.contains('hidden')&&!!$('#payrollPreview .timecard-paper'));
    check('Return controls exist beside and below the preview',$$('#payrollPreview .payroll-up').length===2);
    $('#payrollPreview .payroll-up').click();await settle();
    check('Return focuses Payroll shortcut',document.activeElement===$('#payrollDownBtn'));
    check('Edit and review replace Reconcile',!!review()&&!$('#daysEditor .review-field-event')&&!!$('#daysEditor .edit-chip-event'));
    review().click();check('Review persists in saved events',isPayrollEventReviewed(events[0])&&JSON.parse(localStorage.getItem(K.events))[0].payrollReview===events[0].payrollReview);
    check('Review never changes Payroll or Humanity',JSON.stringify(payrollStore)===hours&&JSON.stringify(snapshots)===humanity);
    renderPayroll();check('Review survives rerender',review().getAttribute('aria-pressed')==='true');
    review().click();check('Review can be undone',!events[0].payrollReview);
    review().click();events[0].solution='Updated repair';renderPayroll();check('Changed event needs review again',review().getAttribute('aria-pressed')==='false');
    review().click();days[0].blocks[0].out='11:30';renderPayroll();check('Changed payroll block needs review again',review().getAttribute('aria-pressed')==='false');
    $('#daysEditor .edit-chip-event').click();check('Edit opens the matching Maintenance Request',editingEventId==='test-review'&&$('#eventEditorModal').classList.contains('open'));
    closeModal('eventEditorModal');
    check('Add Event and Events / Split remain',!!$('#daysEditor .add-day-event')&&$('#daysEditor .split-events').textContent==='Eventos / Split');
    events[0].linkedBlockIds=['test-0'];renderPayroll();check('Linked events also have review and direct Edit',!!$('#blocks-0 .review-event')&&!!$('#blocks-0 .edit-chip-event'));
    window.periodStatuses[periodKey()]={locked:true};renderPayroll();check('Locked period disables review',review().disabled);
    $('#payrollDownBtn').click();check('Locked period still allows preview',!$('#payrollPreview').classList.contains('hidden'));
    window.periodStatuses[periodKey()]={locked:false};renderPayroll();
    settings.language='en';applyLanguage();check('English shortcut label',$('#payrollDownBtn').textContent==='↓ Go to Time Card Preview');
    currentPeriodStart='2026-11-01';renderPayroll();check('Empty new period clears previous Time Card',$('#payrollPreview').classList.contains('hidden')&&!$('#payrollPreview').innerHTML);
    $('#payrollDownBtn').click();check('Empty period does not create an incorrect preview',$('#payrollPreview').classList.contains('hidden'));
    currentPeriodStart='2026-09-20';settings.language='es';applyLanguage();
    $('#payrollDownBtn').click();await settle();
    const paper=$('#payrollPreview .timecard-paper');
    check('Navigation stays outside printable paper',!paper.querySelector('.payroll-up'));
    check('Filled dates and times are enlarged',parseFloat(getComputedStyle(paper.querySelector('.tc-date-cell')).fontSize)===9);
    check('Notes are enlarged and red',parseFloat(getComputedStyle(paper.querySelector('td.tc-note-cell')).fontSize)===7&&getComputedStyle(paper.querySelector('td.tc-note-cell')).color==='rgb(193, 18, 31)');
    check('One paper contains all fourteen days',paper.querySelectorAll('.tc-date-cell').length===14);
    const dimensions={width:paper.offsetWidth,height:paper.offsetHeight};
    // Use the actual app PDF handoff without requiring an iPhone user agent.
    const pdfButton=document.createElement('button');pdfButton.textContent='Test PDF output';pdfButton.className='secondary';
    pdfButton.onclick=()=>{sessionStorage.setItem('ocma_ios_print_job',JSON.stringify({kind:'payroll',title:'Payroll Test',html:paper.outerHTML,returnUrl:location.href}));location.href='./print.html'};
    $('#payrollPreview').prepend(pdfButton);
    parent.postMessage({navigationTest:results.join('\n')+'\n'+results.length+' checks passed. Paper '+dimensions.width+' × '+dimensions.height+' px.'},location.origin);
  }catch(error){parent.postMessage({navigationTest:results.join('\n')+'\nFAIL '+error.message},location.origin);console.error(error)}
})();
