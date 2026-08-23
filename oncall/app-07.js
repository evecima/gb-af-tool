function previewRequest(id){
  const e=events.find(x=>x.id===id),p=$('#requestPreview');if(!e)return;
  const eventTitle=esc(eventLabel(e));
  const workBody=[e.finding,e.solution].filter(Boolean).map(x=>esc(x)).join('\n');
  const contractor=e.vendor?[`Contractor/Vendor: ${e.vendor}`,e.vendorWork?`Contractor work: ${e.vendorWork}`:''].filter(Boolean).join(' — '):'';
  const remarks=[e.remarks||e.result,contractor].filter(Boolean).join(' | ');
  const complete=(e.status||'Job Complete')==='Job Complete';
  const loc=requestLocationText(e),unitNo=requestUnitNo(e);
  const materialRows=[
    `<tr><td>${esc(e.quantity||'')}</td><td>${esc(e.material||'')}</td><td></td></tr>`,
    '<tr><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td></tr>'
  ].join('');
  const workerRows=[
    `<tr><td>${esc(e.worker||workerName())}</td><td>${mdy(e.date)}</td><td>${clock(e.in)}</td><td>${clock(e.out)}</td><td></td><td></td><td></td></tr>`,
    '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>',
    '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'
  ].join('');
  p.classList.remove('hidden');p.classList.add('print-target');
  p.innerHTML=`<div class="row between"><h3>MAINTENANCE REQUEST — Preview</h3><button class="secondary" onclick="printForm('request')">Print</button></div>
  <div class="maintenance-request-paper">
    <div class="mr-property"><div class="mr-name">${esc(settings.community||'Apartment Community')}</div><div>${esc(settings.propertyAddress1||'')}</div><div>${esc(settings.propertyAddress2||'')}</div><div>${esc(settings.propertyPhone||'')}</div></div>

    <div class="mr-top">
      <div class="mr-title-side">
        <div class="mr-title-bar">Maintenance Request</div>
        <div class="mr-number">${esc(e.requestNumber||'')}</div>
      </div>
      <div class="mr-received">
        <div class="mr-received-row"><b>DATE RECEIVED</b><span class="mr-line">${mdy(e.dateReceived||e.date)}</span></div>
        <div class="mr-received-row"><b>TIME RECEIVED</b><span class="mr-line">${clock(e.timeReceived||e.in)}</span></div>
        <div class="mr-received-row"><b>RECEIVED BY</b><span class="mr-line">${esc(workerName())}</span></div>
      </div>
    </div>

    <div class="mr-location">
      <div class="mr-location-main"><b>LOCATION</b><span class="mr-location-value">${esc(loc)}</span></div>
      <div class="mr-location-no-row"><b>NO.</b><span class="mr-location-no-line">${esc(unitNo)}</span></div>
    </div>
    <div class="mr-occ"><div><b>OCCUPANT</b> &nbsp; ${esc(e.occupant||'')}</div><div><b>PHONE</b> &nbsp; ${esc(e.phone||'')}</div></div>

    <div class="mr-work">
      <div class="mr-work-title">WORK REQUESTED</div>
      <div class="mr-event-title">${eventTitle}</div>
      <div class="mr-work-text">${workBody}</div>
      <div class="mr-special"><b>SPECIAL INSTRUCTIONS</b>${esc(e.specialInstructions||'')}</div>
    </div>

    <div class="mr-options">
      <div class="mr-option-row"><span>AUTHORIZATION TO ENTER IN OCCUPANT'S ABSENCE?</span><span class="mr-charge"><span class="mr-box"></span> Yes</span><span class="mr-charge"><span class="mr-box"></span> No</span><span class="mr-charge"><span class="mr-box"></span> N/A</span></div>
      <div class="mr-option-row"><span>TIME SCHEDULED</span><span class="grow"></span><span>ASSIGNED TO</span><span class="grow"></span></div>
      <div class="mr-option-row"><span>CHARGE TO</span><span class="mr-charge"><span class="mr-box"></span> Occupant</span><span class="mr-charge"><span class="mr-box"></span> Management</span><span class="mr-charge"><span class="mr-box"></span> Owner</span><span class="mr-charge"><span class="mr-box"></span> N/A</span><span>AMOUNT $</span><span class="grow"></span></div>
    </div>

    <table class="mr-worker-table">
      <thead><tr><th>WORKER</th><th>DATE</th><th>TIME IN</th><th>TIME OUT</th><th>TOTAL TIME</th><th>RATE</th><th>COST</th></tr></thead>
      <tbody>${workerRows}</tbody>
    </table>

    <table class="mr-material-table">
      <thead><tr><th>QUANTITY</th><th>MATERIALS &amp; OTHER</th><th>&nbsp;</th></tr></thead>
      <tbody>${materialRows}<tr><td></td><td class="mr-total-label">TOTAL</td><td></td></tr></tbody>
    </table>

    <div class="mr-remarks"><b>REMARKS</b> <span class="mr-remarks-text">${esc(remarks)}</span></div>

    <div class="mr-footer">
      <div class="mr-status">
        <div><span class="mr-box ${complete?'checked':''}"></span> JOB COMPLETE</div>
        <div><span class="mr-box ${!complete?'checked':''}"></span> NOT COMPLETE</div>
      </div>
      <div><div class="mr-approved">APPROVED</div></div>
    </div>
  </div>`;
  p.scrollIntoView({behavior:'smooth'})
}
function renderSummary(){const es=eventsPeriod(),body=$('#summaryRows');$('#summaryPeriod').textContent=`EMPLOYEE: ${workerName()} · Pay Period Beginning ${mdy(currentPeriodStart)} · Ending ${mdy(periodEnd())}`;body.innerHTML=es.length?es.map(e=>`<tr><td>${mdy(e.date)}</td><td>${clock(e.in)}</td><td>${clock(e.out)}</td><td>${esc(eventLabel(e))}</td><td>${esc(locationLabel(e))}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">No events.</td></tr>'}
function summaryDayName(date){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][parseISO(date).getDay()]}
function summaryHeader(){return `<tr><th class="day">Day</th><th class="date">Date</th>${Array.from({length:3},()=>`<th class="tin">In</th><th class="tout">Out</th><th class="notes">Notes<br>(i.e., snow removal, salting,<br>lockout, no heat, water leak)</th><th class="apt">Apt #<br>or TH</th>`).join('')}</tr>`}
function summaryWeekRows(startIndex,pageIndex,grouped){let html='';for(let i=0;i<7;i++){const date=addDays(currentPeriodStart,startIndex+i),all=grouped[date]||[],slot=all.slice(pageIndex*3,pageIndex*3+3);html+=`<tr><td class="day">${summaryDayName(date)}</td><td class="date">${mdy(date)}</td>`;for(let s=0;s<3;s++){const e=slot[s];html+=e?`<td class="tin">${clock(e.in)}</td><td class="tout">${clock(e.out)}</td><td class="notes">${esc(eventLabel(e))}</td><td class="apt">${esc(locationLabel(e))}</td>`:`<td class="tin"></td><td class="tout"></td><td class="notes"></td><td class="apt"></td>`}html+='</tr>'}return html}
function summaryPage(pageIndex,pageCount,grouped){return `<div class="summary-paper"><div class="os-title">TIME CARD</div><div class="os-top"><div class="os-employee"><div class="os-employee-label">EMPLOYEE</div><div class="os-employee-value">${esc(workerName())}</div></div><div></div><div class="os-period"><div class="os-period-label">Pay Period Beginning</div><div class="os-period-value">${mdy(currentPeriodStart)}</div><div class="os-period-label">Pay Period Ending</div><div class="os-period-value">${mdy(periodEnd())}</div></div></div><table class="os-table"><thead>${summaryHeader()}</thead><tbody>${summaryWeekRows(0,pageIndex,grouped)}<tr class="os-week-gap"><td colspan="14"></td></tr>${summaryHeader()}${summaryWeekRows(7,pageIndex,grouped)}</tbody></table><div class="os-signatures"><div class="os-sign-left"><div class="os-signline"><span class="filled">${esc(workerName())}</span><small>Employee<br>Signature</small></div><div class="os-signline"><small>Manager<br>Signature</small></div></div><div class="os-sign-right"><div class="os-signline"><span class="filled">${mdy(settings.reportDate)}</span><small>Date</small></div><div class="os-signline"><small>Date</small></div></div></div>${pageCount>1?`<div class="os-page-note">Page ${pageIndex+1} of ${pageCount}</div>`:''}</div>`}
$('#previewSummaryBtn').onclick=()=>{const es=eventsPeriod(),p=$('#summaryPreview');p.classList.remove('hidden');p.classList.add('print-target');const grouped={};es.forEach(e=>(grouped[e.date]??=[]).push(e));Object.values(grouped).forEach(a=>a.sort((x,y)=>(x.in||'').localeCompare(y.in||'')));const maxPerDay=Math.max(0,...Object.values(grouped).map(a=>a.length)),pageCount=Math.max(1,Math.ceil(maxPerDay/3));p.innerHTML=`<div class="row between"><h3>ON-CALL TIME SUMMARY — Preview</h3><button class="secondary" onclick="printForm('summary')">Print</button></div>${Array.from({length:pageCount},(_,i)=>summaryPage(i,pageCount,grouped)).join('')}`;p.scrollIntoView({behavior:'smooth'})};
function renderKnowledge(){
  const q=($('#knowledgeSearch').value||'').toLowerCase(),list=$('#knowledgeList');
  const all=allKnowledge(),ks=all.filter(k=>[k.problem,k.finding,k.solution,k.result,(k.materials||[]).join(' '),k.vendor].join(' ').toLowerCase().includes(q));
  const stats=$('#knowledgeStats');if(stats)stats.textContent=`${all.length} cases · ${window.SEED_KNOWLEDGE.length} historical · ${localKnowledge.length} learned locally`;
  list.innerHTML=ks.slice(0,120).map(k=>`<div class="item"><div class="row between wrap gap"><div><div class="item-title">${esc(k.problem)}</div><div class="badges"><span class="badge ${k.source==='Local technician'?'ok':''}">${k.source==='Local technician'?'Learned locally':'Historical case'}</span></div></div><div class="row gap"><button class="secondary use-knowledge" data-id="${esc(k.id)}">Use as Draft</button>${k.source==='Local technician'?`<button class="dangerbtn delete-knowledge" data-id="${esc(k.id)}">Delete</button>`:''}</div></div><div class="item-meta"><b>Finding:</b> ${esc(k.finding||'—')}<br><b>Solution:</b> ${esc(k.solution||'—')}<br><b>Result:</b> ${esc(k.result||'—')}${(k.materials||[]).length?`<br><b>Materials:</b> ${esc(k.materials.join(', '))}`:''}</div></div>`).join('')||'<div class="muted">No matching knowledge cases.</div>';
  $$('.use-knowledge').forEach(b=>b.onclick=()=>useKnowledgeDraft(b.dataset.id));
  $$('.delete-knowledge').forEach(b=>b.onclick=async()=>{if(!await appConfirm('Delete this locally learned knowledge case?','Delete Knowledge'))return;localKnowledge=localKnowledge.filter(k=>k.id!==b.dataset.id);save(K.knowledge,localKnowledge);renderKnowledge()});
}
function knowledgeById(id){return allKnowledge().find(k=>k.id===id)}
function useKnowledgeDraft(id){const k=knowledgeById(id);if(!k)return;go('new-emergency');const f=$('#fieldEmergencyForm');f.elements.problem.value=k.problem||'';f.elements.finding.value=k.finding||'';f.elements.solution.value=k.solution||'';f.elements.remarks.value=k.result||'';f.elements.material.value=(k.materials||[])[0]||'';if(k.vendor){$('#fieldUsedVendor').checked=true;populateVendorSelect($('#fieldVendorSelect'),k.vendor);if(!vendorNames().includes(k.vendor))$('#fieldVendorManual').value=k.vendor;syncVendorPanel('field',true)}toast('Knowledge loaded as a draft. Add the actual location, times and case-specific details before saving.')}
$('#knowledgeSearch').oninput=renderKnowledge;
$('#addKnowledgeBtn').onclick=()=>{const f=$('#knowledgeForm');f.reset();openModal('knowledgeModal')};
$('#knowledgeForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries()),item={id:'local-'+Date.now().toString(36),problem:(d.problem||'').trim(),finding:(d.finding||'').trim(),solution:(d.solution||'').trim(),result:(d.result||'').trim(),materials:d.material?[d.material.trim()]:[],vendor:(d.vendor||'').trim(),vendorWork:'',source:'Local technician',active:true,updatedAt:new Date().toISOString()};if(!item.problem)return;const key=knowledgeKey(item),idx=localKnowledge.findIndex(k=>knowledgeKey(k)===key);if(idx>=0){item.id=localKnowledge[idx].id;localKnowledge[idx]={...localKnowledge[idx],...item}}else localKnowledge.unshift(item);save(K.knowledge,localKnowledge);refreshProblemFromKnowledge(item.problem);closeModal('knowledgeModal');renderKnowledge();toast('Saved to this technician’s local Knowledge Base.')};
