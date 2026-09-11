/* v0.6.0 — live on-call sessions, auto-saved emergency calls, quick timestamps and emergency log */
(function(){
  K.sessions=NS+'sessions';
  K.emergencyDrafts=NS+'emergency_drafts';
  K.activeDraft=NS+'active_emergency_draft';

  window.onCallSessions=load(K.sessions,[]);
  window.emergencyDrafts=load(K.emergencyDrafts,[]);
  let activeDraftId=load(K.activeDraft,'');
  let loadingDraft=false;

  const f=$('#fieldEmergencyForm');
  if(!f)return;

  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const sessionById=id=>window.onCallSessions.find(s=>s.id===id)||null;
  const activeSession=()=>[...window.onCallSessions].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=>window.emergencyDrafts.filter(d=>d.workflowStatus!=='CLOSED').sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const currentDraft=()=>window.emergencyDrafts.find(d=>d.id===activeDraftId&&d.workflowStatus!=='CLOSED')||null;
  const saveSessions=()=>save(K.sessions,window.onCallSessions);
  const saveDrafts=()=>save(K.emergencyDrafts,window.emergencyDrafts);
  const setActiveDraft=id=>{activeDraftId=id||'';save(K.activeDraft,activeDraftId)};
  const lockedForDate=date=>!!(window.isPeriodLocked&&window.isPeriodLocked(periodForDate(date||todayISO())));

  function ensureFieldUI(){
    const dateLabel=f.elements.date?.closest('label');
    const inLabel=f.elements.in?.closest('label'),outLabel=f.elements.out?.closest('label');
    const receivedLabel=f.elements.timeReceived?.closest('label');
    const occupantLabel=f.elements.occupant?.closest('label');
    const phoneLabel=f.elements.phone?.closest('label');
    if(dateLabel&&receivedLabel&&!receivedLabel.classList.contains('workflow-intake')){
      receivedLabel.classList.add('workflow-intake','workflow-received-label');
      occupantLabel?.classList.add('workflow-intake');phoneLabel?.classList.add('workflow-intake');
      dateLabel.insertAdjacentElement('afterend',receivedLabel);
      receivedLabel.insertAdjacentElement('afterend',occupantLabel);
      occupantLabel?.insertAdjacentElement('afterend',phoneLabel);
      const quick=document.createElement('button');quick.type='button';quick.id='workflowRcvdBtn';quick.className='workflow-quick workflow-rcvd';quick.textContent='RCVD';quick.title='Use current device time';
      f.elements.timeReceived.insertAdjacentElement('afterend',quick);
      quick.onclick=stampReceived;
    }
    inLabel?.classList.add('workflow-hidden-original-time');
    outLabel?.classList.add('workflow-hidden-original-time');
    const details=[...f.querySelectorAll('details.form-details')].find(d=>d.querySelector('[name="timeReceived"]'));
    if(details)details.classList.add('workflow-empty-details');

    if(!$('#workflowSessionCard')){
      const card=document.createElement('div');card.id='workflowSessionCard';card.className='card workflow-session-card';
      card.innerHTML=`<div class="workflow-session-head"><div><b>On-Call Work Session</b><div id="workflowSessionState" class="muted tiny top-space"></div></div><div class="workflow-session-actions"><button type="button" id="workflowInBtn" class="workflow-punch workflow-in">IN</button><button type="button" id="workflowOutBtn" class="workflow-punch workflow-out">OUT</button></div></div><div class="muted tiny top-space">IN/OUT belongs to the work session. Multiple emergency calls may be recorded inside the same session.</div>`;
      const formCard=$('#emergency form.card');formCard?.insertAdjacentElement('beforebegin',card);
      $('#workflowInBtn').onclick=startWorkSession;$('#workflowOutBtn').onclick=endWorkSession;
    }

    if(!$('#workflowOpenCalls')){
      const card=document.createElement('div');card.id='workflowOpenCalls';card.className='card workflow-open-card';
      card.innerHTML=`<div class="row between wrap gap"><div><b>Open Emergency Calls</b><div class="muted tiny">Calls are auto-saved. You may close or lock the phone and resume later.</div></div><button type="button" class="primary" id="workflowNewCallBtn">+ New Emergency Call</button></div><div id="workflowOpenCallList" class="workflow-call-list top-space"></div>`;
      $('#workflowSessionCard')?.insertAdjacentElement('afterend',card);
      $('#workflowNewCallBtn').onclick=()=>beginNewDraft(false);
    }

    if(!$('#workflowDraftStatus')){
      const help=f.querySelector('.clean-help');
      if(help){const d=document.createElement('div');d.id='workflowDraftStatus';d.className='span2 workflow-draft-status';help.insertAdjacentElement('afterend',d)}
    }

    if(!f.elements.closeOutcome){
      const statusLabel=f.elements.status?.closest('label');
      const outcome=document.createElement('label');outcome.className='span2';outcome.innerHTML=`<span>Close Outcome</span><select name="closeOutcome"><option>Resolved</option><option>Contractor Scheduled</option><option>Follow-up Required</option><option>Parts Required</option><option>Office / Manager Follow-up</option></select>`;
      statusLabel?.insertAdjacentElement('beforebegin',outcome);
      const follow=document.createElement('div');follow.id='workflowFollowupFields';follow.className='span2 workflow-followup hidden';follow.innerHTML=`<label><span>Follow-up Date (optional)</span><input type="date" name="followUpDate"></label><label><span>Follow-up Time (optional)</span><input type="time" name="followUpTime"></label>`;
      outcome.insertAdjacentElement('afterend',follow);
      f.elements.closeOutcome.onchange=()=>{syncFollowupUI();if(f.elements.status)f.elements.status.value=f.elements.closeOutcome.value==='Resolved'?'Job Complete':'Not Complete';autosaveDraft();};
    }

    const submit=f.querySelector('button[type="submit"]');
    if(submit){submit.textContent='Close Emergency';submit.classList.add('workflow-close-emergency')}
    const hint=submit?.parentElement?.querySelector('.muted.tiny');if(hint)hint.textContent='Closing the emergency does not mean the repair is fully resolved. Choose the correct Close Outcome; edits remain available until the pay period is locked.';

    ensureEditorOutcome();
    ensureDashboardSessionUI();
    ensureEmergencyLogUI();
  }

  function ensureEditorOutcome(){
    const ef=$('#eventEditorForm');if(!ef||ef.elements.closeOutcome)return;
    const statusLabel=ef.elements.status?.closest('label');if(!statusLabel)return;
    const label=document.createElement('label');label.className='span2';label.innerHTML=`<span>Close Outcome</span><select name="closeOutcome"><option>Resolved</option><option>Contractor Scheduled</option><option>Follow-up Required</option><option>Parts Required</option><option>Office / Manager Follow-up</option></select>`;
    statusLabel.insertAdjacentElement('beforebegin',label);
    const follow=document.createElement('div');follow.id='workflowEditFollowup';follow.className='span2 workflow-followup hidden';follow.innerHTML=`<label><span>Follow-up Date (optional)</span><input type="date" name="followUpDate"></label><label><span>Follow-up Time (optional)</span><input type="time" name="followUpTime"></label>`;
    label.insertAdjacentElement('afterend',follow);
    label.querySelector('select').onchange=()=>{syncEditorFollowupUI();if(ef.elements.status)ef.elements.status.value=ef.elements.closeOutcome.value==='Resolved'?'Job Complete':'Not Complete';};
  }

  function ensureDashboardSessionUI(){
    if($('#workflowDashSession'))return;
    const setup=$('#dashboard .card');if(!setup)return;
    const box=document.createElement('div');box.id='workflowDashSession';box.className='workflow-dash-session top-space';
    box.innerHTML=`<div><b>On-Call Session</b><div id="workflowDashSessionState" class="muted tiny"></div></div><div class="row gap wrap"><button type="button" id="workflowDashIn" class="workflow-punch workflow-in">IN</button><button type="button" id="workflowDashOut" class="workflow-punch workflow-out">OUT</button><button type="button" id="workflowDashOpenCalls" class="secondary">Open Calls</button></div>`;
    setup.appendChild(box);
    $('#workflowDashIn').onclick=startWorkSession;$('#workflowDashOut').onclick=endWorkSession;$('#workflowDashOpenCalls').onclick=()=>{go('emergency');renderWorkflowUI()};
  }

  function ensureEmergencyLogUI(){
    if(!$('#emergencyLog')){
      const screen=document.createElement('section');screen.id='emergencyLog';screen.className='screen';
      screen.innerHTML=`<div class="screen-head"><button class="back" id="workflowLogBack">←</button><div><h2>Emergency Log</h2><p>Searchable local history generated from emergency calls. The saved event remains the source of truth.</p></div></div><div class="card"><div class="row between wrap gap"><input id="workflowLogSearch" placeholder="Search title / apartment / occupant / phone / outcome" style="flex:1;min-width:220px"><div class="row gap wrap"><button class="secondary" id="workflowExportTxt">Export TXT</button><button class="secondary" id="workflowExportCsv">Export CSV</button><button class="secondary" id="workflowExportJson">Export JSON</button></div></div><div id="workflowLogStats" class="muted tiny top-space"></div><div id="workflowLogList" class="workflow-log-list top-space"></div></div>`;
      $('.app')?.appendChild(screen);
      $('#workflowLogBack').onclick=()=>go('dashboard');$('#workflowLogSearch').oninput=renderEmergencyLog;
      $('#workflowExportTxt').onclick=()=>exportEmergencyLog('txt');$('#workflowExportCsv').onclick=()=>exportEmergencyLog('csv');$('#workflowExportJson').onclick=()=>exportEmergencyLog('json');
    }
    if(!$('#workflowLogCard')){
      const grid=$('#dashboard .dashboard-grid');if(grid){const b=document.createElement('button');b.id='workflowLogCard';b.className='big-card';b.innerHTML='<span class="icon">📚</span><span class="title">Emergency Log</span><span class="desc">Search received calls, locations, outcomes and session times.</span>';b.onclick=()=>{go('emergencyLog');renderEmergencyLog()};grid.appendChild(b)}
    }
  }

  function syncFollowupUI(){const outcome=f.elements.closeOutcome?.value||'Resolved';$('#workflowFollowupFields')?.classList.toggle('hidden',outcome==='Resolved')}
  function syncEditorFollowupUI(){const ef=$('#eventEditorForm'),outcome=ef?.elements.closeOutcome?.value||'Resolved';$('#workflowEditFollowup')?.classList.toggle('hidden',outcome==='Resolved')}

  function sessionLabel(s){if(!s)return'No active work session.';return `🟢 ACTIVE · ${mdy(s.date)} · IN ${clock(s.in)} · OUT —`}
  function renderSessionUI(){
    const s=activeSession(),locked=lockedForDate(s?.date||f.elements.date?.value||todayISO());
    const text=sessionLabel(s);
    if($('#workflowSessionState'))$('#workflowSessionState').textContent=text;
    if($('#workflowDashSessionState'))$('#workflowDashSessionState').textContent=text;
    ['#workflowInBtn','#workflowDashIn'].forEach(x=>{const b=$(x);if(b)b.disabled=!!s||locked});
    ['#workflowOutBtn','#workflowDashOut'].forEach(x=>{const b=$(x);if(b)b.disabled=!s||locked});
  }

  async function startWorkSession(){
    const date=f.elements.date?.value||todayISO();
    if(lockedForDate(date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before starting a session.');
    if(activeSession())return renderSessionUI();
    const s={id:uid('ses'),workerId:workerId(),worker:workerName(),date,in:nowTime(),out:'',status:'ACTIVE',createdAt:nowISO(),updatedAt:nowISO()};
    window.onCallSessions.push(s);saveSessions();
    for(const d of openDrafts()){if(!d.sessionId&&d.date===date)d.sessionId=s.id}
    saveDrafts();autosaveDraft();renderWorkflowUI();toast(`On-call session started at ${clock(s.in)}.`);
  }

  async function endWorkSession(){
    const s=activeSession();if(!s)return;
    if(lockedForDate(s.date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before changing the session.');
    const open=openDrafts().filter(d=>d.sessionId===s.id);
    if(open.length){const ok=await appConfirm(`${open.length} emergency call(s) are still open. OUT will close the work session but keep those calls saved for later documentation. Continue?`,'Close Work Session');if(!ok)return}
    s.out=nowTime();s.status='CLOSED';s.closedAt=nowISO();s.updatedAt=nowISO();saveSessions();
    let changed=false;for(const e of events){if(e.sessionId===s.id&&!e.out){e.in=e.in||s.in;e.out=s.out;changed=true}}
    if(changed)save(K.events,events);
    renderAll();renderWorkflowUI();renderEmergencyLog();toast(`On-call session closed at ${clock(s.out)}.`);
  }

  function blankDraft(stamp=false){
    const s=activeSession(),date=s?.date||f.elements.date?.value||todayISO();
    return {id:uid('draft'),workerId:workerId(),worker:workerName(),type:'emergency',date,dateReceived:date,timeReceived:stamp?nowTime():'',locationCode:'',fullAddress:'',manualLocation:'',_locationSearch:'',occupant:'',phone:'',problem:'Emergency – Details Pending',finding:'',solution:'',specialInstructions:'',remarks:'',result:'',material:'',quantity:'',vendor:'',vendorWork:'',status:'Job Complete',closeOutcome:'Resolved',followUpDate:'',followUpTime:'',sessionId:s?.id||'',workflowStatus:'RECEIVED',source:'field-v060',createdAt:nowISO(),updatedAt:nowISO()};
  }

  function beginNewDraft(stamp=false){
    const date=f.elements.date?.value||todayISO();if(lockedForDate(date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before adding an emergency.');
    autosaveDraft();const d=blankDraft(stamp);window.emergencyDrafts.push(d);saveDrafts();setActiveDraft(d.id);loadDraftIntoForm(d);renderWorkflowUI();
  }

  function ensureDraft(stamp=false){let d=currentDraft();if(!d){d=blankDraft(stamp);window.emergencyDrafts.push(d);saveDrafts();setActiveDraft(d.id)}return d}

  function stampReceived(){
    const date=f.elements.date?.value||todayISO();if(lockedForDate(date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before adding an emergency.');
    const d=ensureDraft(false),t=nowTime();f.elements.timeReceived.value=t;d.timeReceived=t;d.dateReceived=f.elements.date.value||date;d.date=d.dateReceived;d.updatedAt=nowISO();if(!d.sessionId&&activeSession())d.sessionId=activeSession().id;saveDrafts();setDraftSavedText(`✓ Received ${clock(t)} · auto-saved`);renderWorkflowUI();
  }

  function formDataToDraft(d){
    const data=Object.fromEntries(new FormData(f).entries());
    const keep={id:d.id,createdAt:d.createdAt,workflowStatus:d.workflowStatus||'RECEIVED',sessionId:d.sessionId||activeSession()?.id||'',source:d.source||'field-v060'};
    Object.assign(d,data,keep);
    d.date=d.date||todayISO();d.dateReceived=d.date;d._locationSearch=$('#fieldLocationSearch')?.value||d._locationSearch||'';
    d.vendor=$('#fieldUsedVendor')?.checked?vendorValue('field'):'';d.vendorWork=$('#fieldUsedVendor')?.checked?(data.vendorWork||''):'';
    d.result=d.remarks||'';d.updatedAt=nowISO();
    return d;
  }

  function autosaveDraft(){
    if(loadingDraft)return;
    let d=currentDraft();if(!d)return;
    formDataToDraft(d);saveDrafts();setDraftSavedText('✓ Auto-saved');renderOpenCalls();renderEmergencyLog(false);
  }

  function setDraftSavedText(text){const d=currentDraft(),box=$('#workflowDraftStatus');if(!box)return;box.innerHTML=d?`<div class="row between wrap gap"><div><b>${esc(d.problem||'Emergency')}</b><div class="muted tiny">${esc(d._locationSearch||d.locationCode||d.manualLocation||'Location pending')} · ${text}</div></div><button type="button" class="secondary" id="workflowClearDraft">Clear / New Call</button></div>`:'<span class="muted tiny">No emergency call selected. Tap RCVD or start a new call.</span>';const b=$('#workflowClearDraft');if(b)b.onclick=()=>beginNewDraft(false)}

  function loadDraftIntoForm(d){
    loadingDraft=true;
    f.reset();
    for(const n of ['date','timeReceived','occupant','phone','locationCode','fullAddress','manualLocation','problem','finding','solution','specialInstructions','remarks','material','quantity','vendorWork','status','closeOutcome','followUpDate','followUpTime'])if(f.elements[n])f.elements[n].value=d[n]||'';
    const s=sessionById(d.sessionId);if(f.elements.in)f.elements.in.value=s?.in||'';if(f.elements.out)f.elements.out.value=s?.out||'';
    $('#fieldLocationSearch').value=d._locationSearch||d.locationCode||d.manualLocation||'';
    if(d.fullAddress){$('#fieldSelectedLocation').textContent=d.fullAddress;$('#fieldSelectedLocation').classList.remove('hidden')}else $('#fieldSelectedLocation').classList.add('hidden');
    const manual=!!d.manualLocation&&!d.locationCode;$('#fieldManualLocationWrap').classList.toggle('hidden',!manual);fieldManual=manual;
    const used=!!(d.vendor||d.vendorWork);$('#fieldUsedVendor').checked=used;populateVendorSelect($('#fieldVendorSelect'),d.vendor||'');if(d.vendor&&!vendorNames().includes(d.vendor))$('#fieldVendorManual').value=d.vendor;syncVendorPanel('field',used);
    syncFollowupUI();loadingDraft=false;setDraftSavedText('✓ Auto-saved');
  }

  function clearFormForNoDraft(){loadingDraft=true;f.reset();f.elements.date.value=activeSession()?.date||todayISO();$('#fieldLocationSearch').value='';$('#fieldSelectedLocation').classList.add('hidden');$('#fieldManualLocationWrap').classList.add('hidden');fieldManual=false;$('#fieldUsedVendor').checked=false;populateVendorSelect($('#fieldVendorSelect'),'');syncVendorPanel('field',false);syncFollowupUI();loadingDraft=false;setDraftSavedText('')}

  function draftTitle(d){const p=(d.problem||'').replace(/Emergency\s*[–-]\s*Details Pending/i,'').trim()||'Emergency';const loc=d._locationSearch||d.locationCode||d.manualLocation||'Location pending';return `${p} · ${loc}`}

  function renderOpenCalls(){
    const list=$('#workflowOpenCallList');if(!list)return;const ds=openDrafts();
    if(!ds.length){list.innerHTML='<div class="muted">No open emergency calls.</div>';return}
    list.innerHTML=ds.map((d,i)=>{const s=sessionById(d.sessionId);return `<div class="workflow-call ${d.id===activeDraftId?'selected':''}"><div><div class="item-title">#${String(i+1).padStart(2,'0')} · ${esc(draftTitle(d))}</div><div class="item-meta">RCVD ${clock(d.timeReceived)||'—'} · ${s?`Session IN ${clock(s.in)}${s.out?' / OUT '+clock(s.out):''}`:'Session not started'}</div></div><button type="button" class="secondary workflow-resume" data-id="${esc(d.id)}">Resume</button></div>`}).join('');
    $$('.workflow-resume').forEach(b=>b.onclick=()=>{const d=window.emergencyDrafts.find(x=>x.id===b.dataset.id);if(!d)return;autosaveDraft();setActiveDraft(d.id);loadDraftIntoForm(d);renderOpenCalls();go('emergency')});
  }

  function closeOutcomeStatus(outcome){return outcome==='Resolved'?'Job Complete':'Not Complete'}

  async function closeCurrentEmergency(e){
    e?.preventDefault?.();
    const d=currentDraft()||ensureDraft(false);formDataToDraft(d);
    if(lockedForDate(d.date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before closing an emergency.');
    const title=(d.problem||'').trim();const loc=(d.locationCode||d.manualLocation||d._locationSearch||'').trim();
    if(!title||/Details Pending/i.test(title))return toast('Select or enter the Emergency / Problem Title before closing this emergency.');
    if(!loc)return toast('Enter/select the emergency Location before closing this emergency.');
    let s=sessionById(d.sessionId)||activeSession();if(s&&!d.sessionId)d.sessionId=s.id;
    const ev=makeEvent('emergency',d.date,s?.in||'',s?.out||'','field');
    Object.assign(ev,{dateReceived:d.dateReceived||d.date,timeReceived:d.timeReceived||'',locationCode:d.locationCode||'',fullAddress:d.fullAddress||'',manualLocation:d.manualLocation||'',occupant:d.occupant||'',phone:d.phone||'',problem:title,finding:d.finding||'',solution:d.solution||'',specialInstructions:d.specialInstructions||'',remarks:d.remarks||'',result:d.remarks||'',material:d.material||'',quantity:d.quantity||'',vendor:d.vendor||'',vendorWork:d.vendorWork||'',status:closeOutcomeStatus(d.closeOutcome||'Resolved'),closeOutcome:d.closeOutcome||'Resolved',followUpDate:d.followUpDate||'',followUpTime:d.followUpTime||'',sessionId:d.sessionId||'',workflowStatus:'CLOSED',receivedAt:d.createdAt||'',closedAt:nowISO()});
    events.push(ev);save(K.events,events);learnEvent(ev);
    window.emergencyDrafts=window.emergencyDrafts.filter(x=>x.id!==d.id);saveDrafts();setActiveDraft('');
    clearFormForNoDraft();renderAll();renderWorkflowUI();renderEmergencyLog();toast(`${title} closed and saved. You can still edit it from Maintenance Requests until the pay period is locked.`);
  }

  function renderWorkflowUI(){ensureFieldUI();renderSessionUI();renderOpenCalls();const d=currentDraft();if(d)loadDraftIntoForm(d);else clearFormForNoDraft();renderEmergencyLog(false);applyWorkflowLock()}

  function applyWorkflowLock(){const date=activeSession()?.date||currentDraft()?.date||f.elements.date?.value||todayISO(),locked=lockedForDate(date);['#workflowRcvdBtn','#workflowNewCallBtn','#workflowInBtn','#workflowOutBtn','#workflowDashIn','#workflowDashOut'].forEach(sel=>{const b=$(sel);if(b&&locked)b.disabled=true});if(locked)$$('#fieldEmergencyForm input,#fieldEmergencyForm select,#fieldEmergencyForm textarea,#fieldEmergencyForm button').forEach(x=>x.disabled=true)}

  function logRows(){
    const closed=events.filter(e=>e.type==='emergency').map(e=>({...e,_logState:'CLOSED'}));
    const open=openDrafts().map(d=>({...d,_logState:'OPEN'}));
    return [...open,...closed].sort((a,b)=>{const ak=(a.date||'')+(a.timeReceived||a.in||''),bk=(b.date||'')+(b.timeReceived||b.in||'');return bk.localeCompare(ak)});
  }

  function renderEmergencyLog(scroll=false){
    const list=$('#workflowLogList');if(!list)return;const q=($('#workflowLogSearch')?.value||'').toLowerCase();const rows=logRows().filter(x=>[x.problem,x.locationCode,x.manualLocation,x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor].join(' ').toLowerCase().includes(q));
    const total=logRows(),open=total.filter(x=>x._logState==='OPEN').length;
    $('#workflowLogStats').textContent=`${total.length} emergency record(s) · ${open} open · ${total.length-open} closed`;
    list.innerHTML=rows.length?rows.map(x=>{const s=sessionById(x.sessionId);const loc=x.locationCode||x.manualLocation||x._locationSearch||'Location pending';return `<div class="workflow-log-item"><div class="row between wrap gap"><div><div class="item-title">${esc(x.problem||'Emergency')} · ${esc(loc)}</div><div class="item-meta">${mdy(x.date||x.dateReceived||'')} · RCVD ${clock(x.timeReceived)||'—'}${s?` · IN ${clock(s.in)}${s.out?' · OUT '+clock(s.out):''}`:''}</div></div><span class="badge ${x._logState==='OPEN'?'warn':'ok'}">${x._logState}</span></div><div class="badges top-space">${x.closeOutcome?`<span class="badge">${esc(x.closeOutcome)}</span>`:''}${x.requestNumber?`<span class="badge">Folio ${esc(x.requestNumber)}</span>`:''}</div></div>`}).join(''):'<div class="muted">No matching emergency records.</div>';
    if(scroll)$('#emergencyLog')?.scrollIntoView({behavior:'smooth'});
  }

  function emergencyExportObject(){return {kind:'oncall-emergency-log',version:'0.6.0',exportedAt:nowISO(),technician:workerName(),sessions:window.onCallSessions,openEmergencyDrafts:openDrafts(),emergencies:events.filter(e=>e.type==='emergency')}}
  function exportText(){return logRows().map(x=>{const s=sessionById(x.sessionId),loc=x.locationCode||x.manualLocation||x._locationSearch||'';return [`${x.date||''} | ${x.problem||'Emergency'} | ${loc}`,`Status: ${x._logState}${x.closeOutcome?' / '+x.closeOutcome:''}`,`Received: ${clock(x.timeReceived)||'—'}${s?` | IN: ${clock(s.in)} | OUT: ${clock(s.out)||'—'}`:''}`,x.occupant?`Occupant: ${x.occupant}`:'',x.phone?`Phone: ${x.phone}`:'',x.remarks?`Remarks: ${x.remarks}`:''].filter(Boolean).join('\n')}).join('\n\n----------------------------------------\n\n')}
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
  function exportCsv(){const head=['Date','Title','Location','Received','Session IN','Session OUT','Status','Outcome','Occupant','Phone','Folio'];const body=logRows().map(x=>{const s=sessionById(x.sessionId);return [x.date,x.problem,x.locationCode||x.manualLocation||x._locationSearch,x.timeReceived,s?.in||'',s?.out||'',x._logState,x.closeOutcome||'',x.occupant||'',x.phone||'',x.requestNumber||''].map(csvCell).join(',')});return [head.map(csvCell).join(','),...body].join('\n')}
  async function deliverFile(name,type,text){const blob=new Blob([text],{type});try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  function exportEmergencyLog(kind){const stamp=todayISO();if(kind==='txt')return deliverFile(`Emergency_Log_${stamp}.txt`,'text/plain',exportText());if(kind==='csv')return deliverFile(`Emergency_Log_${stamp}.csv`,'text/csv',exportCsv());return deliverFile(`Emergency_Log_${stamp}.json`,'application/json',JSON.stringify(emergencyExportObject(),null,2))}

  f.addEventListener('input',()=>{if(!loadingDraft){ensureDraft(false);autosaveDraft()}},true);
  f.addEventListener('change',()=>{if(!loadingDraft){ensureDraft(false);autosaveDraft()}},true);
  document.addEventListener('click',e=>{if(e.target.closest?.('#fieldLocationResults button,#fieldManualLocationBtn,#fieldVendorSelect,#fieldUsedVendor'))setTimeout(()=>{if(currentDraft())autosaveDraft()},0)},true);

  f.onsubmit=closeCurrentEmergency;

  const baseOpenEventEditor=openEventEditor;
  openEventEditor=function(id){baseOpenEventEditor(id);const ev=events.find(x=>x.id===id),ef=$('#eventEditorForm');if(!ev||!ef)return;if(ef.elements.closeOutcome)ef.elements.closeOutcome.value=ev.closeOutcome||((ev.status||'Job Complete')==='Job Complete'?'Resolved':'Follow-up Required');if(ef.elements.followUpDate)ef.elements.followUpDate.value=ev.followUpDate||'';if(ef.elements.followUpTime)ef.elements.followUpTime.value=ev.followUpTime||'';syncEditorFollowupUI()};

  const baseRenderRequestsV060=renderRequests;
  renderRequests=function(){baseRenderRequestsV060();$$('#requestList .edit-event').forEach(btn=>{const ev=events.find(x=>x.id===btn.dataset.id),item=btn.closest('.item');if(!ev||!item||item.querySelector('.workflow-outcome-badge')||!ev.closeOutcome)return;const badges=item.querySelector('.badges');if(badges){const span=document.createElement('span');span.className='badge workflow-outcome-badge';span.textContent=ev.closeOutcome;badges.appendChild(span)}})};

  const baseUpdateDashboardV060=updateDashboard;
  updateDashboard=function(){baseUpdateDashboardV060();ensureDashboardSessionUI();renderSessionUI()};

  const baseGoV060=go;
  go=function(id){baseGoV060(id);if(id==='emergency')renderWorkflowUI();if(id==='emergencyLog')renderEmergencyLog()};

  const exportBtn=$('#exportDataBtn');if(exportBtn)exportBtn.onclick=()=>{const data={version:'0.6.0',settings,currentPeriodStart,payrollStore,snapshots,events,problems,folioStarts,localKnowledge,vendors,periodStatuses:window.periodStatuses||{},onCallSessions:window.onCallSessions||[],emergencyDrafts:window.emergencyDrafts||[],activeDraftId};deliverFile('oncall-maintenance-v0.6.0-backup.json','application/json',JSON.stringify(data,null,2))};
  const importInput=$('#importDataFile');if(importInput)importInput.onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const d=JSON.parse(await file.text());const ver=String(d.version||'');if(ver&&!/^0\.[456]/.test(ver))throw new Error('This version imports v0.4, v0.5 or v0.6 backups.');settings=d.settings?{...settings,...d.settings}:settings;currentPeriodStart=d.currentPeriodStart||currentPeriodStart;if(d.payrollStore)payrollStore=d.payrollStore;if(d.snapshots)snapshots=d.snapshots;if(Array.isArray(d.events))events=d.events;if(Array.isArray(d.problems))problems=d.problems;if(d.folioStarts)folioStarts=d.folioStarts;if(Array.isArray(d.localKnowledge))localKnowledge=d.localKnowledge;if(Array.isArray(d.vendors))vendors=d.vendors;if(d.periodStatuses&&typeof d.periodStatuses==='object')window.periodStatuses=d.periodStatuses;if(Array.isArray(d.onCallSessions))window.onCallSessions=d.onCallSessions;if(Array.isArray(d.emergencyDrafts))window.emergencyDrafts=d.emergencyDrafts;activeDraftId=d.activeDraftId||'';save(K.settings,settings);save(K.period,currentPeriodStart);save(K.payroll,payrollStore);save(K.snap,snapshots);save(K.events,events);save(K.problems,problems);save(K.folios,folioStarts);save(K.knowledge,localKnowledge);save(K.vendors,vendors);if(K.periodStatus&&window.periodStatuses)save(K.periodStatus,window.periodStatuses);saveSessions();saveDrafts();setActiveDraft(activeDraftId);const learned=learnFromExistingEvents();applyLanguage();renderAll();renderWorkflowUI();toast(`Backup imported.${learned?` ${learned} report(s) added to local Knowledge Base.`:''}`)}catch(err){toast('Import failed: '+err.message)}finally{e.target.value=''}};

  ensureFieldUI();
  if(!currentDraft()&&openDrafts().length)setActiveDraft(openDrafts()[0].id);
  if(currentDraft())loadDraftIntoForm(currentDraft());else clearFormForNoDraft();
  renderWorkflowUI();
})();
