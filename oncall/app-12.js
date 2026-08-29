/* v0.5.15 — Pay-period lifecycle + safe local storage manager */
(function(){
  K.periodStatus=NS+'period_status';
  window.periodStatuses=load(K.periodStatus,{});

  const keyFor=start=>`${workerId()||'local'}|${start||currentPeriodStart}`;
  const endFor=start=>addDays(start,13);
  const statusFor=start=>window.periodStatuses[keyFor(start)]||{};
  const isLocked=start=>!!statusFor(start||currentPeriodStart).locked;
  const eventInPeriod=(e,start)=>!!e?.date&&e.date>=start&&e.date<=endFor(start);
  const hasData=start=>!!payrollStore[keyFor(start)]||!!snapshots[keyFor(start)]||events.some(e=>eventInPeriod(e,start))||!!folioStarts[start];

  window.isPeriodLocked=isLocked;
  window.periodHasData=hasData;

  function saveStatuses(){save(K.periodStatus,window.periodStatuses)}
  function setStatus(start,patch){
    const k=keyFor(start),old=window.periodStatuses[k]||{};
    window.periodStatuses[k]={...old,...patch};
    saveStatuses();
  }
  function lockPeriod(start=currentPeriodStart,source='manual'){
    setStatus(start,{locked:true,status:'delivered',deliveredAt:new Date().toISOString(),source,unlockedAt:null});
  }
  window.lockPayPeriod=lockPeriod;

  function fmtBytes(n){
    if(!Number.isFinite(n)||n<=0)return'0 KB';
    if(n<1024)return n+' B';
    if(n<1024*1024)return (n/1024).toFixed(n<10240?1:0)+' KB';
    return (n/(1024*1024)).toFixed(2)+' MB';
  }
  function localRecordBytes(){
    let n=0;
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);if(!k||!k.startsWith(NS))continue;
      const v=localStorage.getItem(k)||'';n+=(k.length+v.length)*2;
    }
    return n;
  }
  function snapshotBytesFor(start){
    const v=snapshots[keyFor(start)];
    return v?JSON.stringify(v).length*2:0;
  }

  function ensureLifecycleUI(){
    if(!$('#dashPeriodState')){
      const box=$('#dashPeriod')?.closest('.setup-box');
      if(box){const d=document.createElement('div');d.id='dashPeriodState';d.className='period-state-line';box.appendChild(d)}
    }
    if(!$('#periodLifecycleCard')){
      const bar=$('#payroll .periodbar');
      if(bar){
        const card=document.createElement('div');card.id='periodLifecycleCard';card.className='card period-lifecycle';
        card.innerHTML=`<div class="row between wrap gap"><div><b>Pay Period Status</b><div id="periodLifecycleStatus" class="muted tiny top-space"></div></div><div class="row gap wrap"><button class="primary" id="togglePeriodLockBtn" type="button"></button><button class="secondary hidden" id="compactPeriodBtn" type="button">Archive & Free Space</button></div></div><div id="periodLockHint" class="tiny muted top-space"></div>`;
        bar.insertAdjacentElement('afterend',card);
        $('#togglePeriodLockBtn').onclick=togglePeriodLock;
        $('#compactPeriodBtn').onclick=()=>compactOne(currentPeriodStart,true);
      }
    }
    if(!$('#lockedEmergencyNotice')){
      const head=$('#emergency .screen-head');
      if(head){const n=document.createElement('div');n.id='lockedEmergencyNotice';n.className='notice warn hidden';n.textContent='This pay period is DELIVERED / LOCKED. Unlock it from Payroll before adding or changing reportable events.';head.insertAdjacentElement('afterend',n)}
    }
    if(!$('#storageManagerCard')){
      const advanced=$('#settings > details.card.form-details');
      const card=document.createElement('div');card.id='storageManagerCard';card.className='card';
      card.innerHTML=`<div class="row between wrap gap"><div><h3 style="margin:0">Storage & Archived Periods</h3><div class="muted tiny top-space">Locked periods stay available for Preview/Print. Safe compaction removes only duplicate Humanity snapshots; Payroll, events, Requests, folios and Knowledge Base remain.</div></div><button class="secondary" id="compactAllLockedBtn" type="button">Compact Locked Periods</button></div><div id="storageStats" class="storage-stats top-space">Calculating storage…</div>`;
      if(advanced)advanced.insertAdjacentElement('beforebegin',card);else $('#settings')?.appendChild(card);
      $('#compactAllLockedBtn').onclick=compactAllLocked;
    }
  }

  async function togglePeriodLock(){
    const start=currentPeriodStart;
    if(isLocked(start)){
      const ok=await appConfirm(`Unlock pay period ${mdy(start)} – ${mdy(endFor(start))} for corrections? Editing will be enabled again.`,'Unlock Pay Period');
      if(!ok)return;
      setStatus(start,{locked:false,status:'open',unlockedAt:new Date().toISOString()});
      renderAll();toast('Pay period unlocked for corrections.');return;
    }
    const ok=await appConfirm(`Mark pay period ${mdy(start)} – ${mdy(endFor(start))} as DELIVERED / LOCKED? Payroll hours, events, Maintenance Requests and folios will become read-only. Preview and Print remain available.`,'Close Pay Period');
    if(!ok)return;
    lockPeriod(start,'manual');
    renderAll();toast('Pay period marked DELIVERED / LOCKED.');
  }

  function lockDisable(el,locked){
    if(!el)return;
    if(locked){if(!el.disabled){el.disabled=true;el.dataset.periodLockDisabled='1'}}
    else if(el.dataset.periodLockDisabled==='1'){el.disabled=false;delete el.dataset.periodLockDisabled}
  }

  function applyLockUI(){
    ensureLifecycleUI();
    const locked=isLocked(),s=statusFor(currentPeriodStart),label=locked?'🔒 DELIVERED / LOCKED':'OPEN';
    const dash=$('#dashPeriodState');if(dash){dash.className='period-state-line '+(locked?'locked':'open');dash.textContent=label}
    const life=$('#periodLifecycleStatus');if(life)life.textContent=`${mdy(currentPeriodStart)} – ${mdy(periodEnd())} · ${label}${locked&&s.deliveredAt?' · Closed '+new Date(s.deliveredAt).toLocaleDateString():''}`;
    const toggle=$('#togglePeriodLockBtn');if(toggle){toggle.textContent=locked?'Unlock for Correction':'Close Pay Period';toggle.className=locked?'secondary':'primary'}
    $('#compactPeriodBtn')?.classList.toggle('hidden',!locked);
    const hint=$('#periodLockHint');if(hint)hint.textContent=locked?'Read-only: you may still Preview, create PDF/Print, navigate to other periods, or upload a newer Humanity PDF to start a new period.':'When the paperwork has been delivered, close this period to prevent accidental edits.';
    $('#lockedEmergencyNotice')?.classList.toggle('hidden',!locked);

    const selectors=[
      '#manualHoursBtn','#reviewHoursBtn','#fill14Btn','#saveHoursBtn','#resetImportedBtn','#clearHoursBtn',
      '#daysEditor input','#daysEditor select','#daysEditor textarea','#daysEditor button',
      '#fieldEmergencyForm input','#fieldEmergencyForm select','#fieldEmergencyForm textarea','#fieldEmergencyForm button',
      '#folioStartInput','#assignFoliosBtn','#requestList .edit-event','#requestList .delete-event',
      '#saveEventRowsBtn','#addEventRowBtn'
    ];
    selectors.forEach(sel=>$$(sel).forEach(el=>lockDisable(el,locked)));
    $('#payroll')?.classList.toggle('period-locked',locked);
    $('#emergency')?.classList.toggle('period-locked',locked);
    $('#requests')?.classList.toggle('period-locked',locked);
    refreshStorageStats();
  }

  async function refreshStorageStats(){
    const box=$('#storageStats');if(!box)return;
    const totalLocal=localRecordBytes();
    const statuses=Object.values(window.periodStatuses||{}),lockedCount=statuses.filter(x=>x?.locked).length;
    const snapshotCount=Object.keys(snapshots||{}).length;
    let origin='';
    try{
      const est=await navigator.storage?.estimate?.();
      if(est&&Number.isFinite(est.usage))origin=` · Site storage incl. offline app cache: <b>${fmtBytes(est.usage)}</b>`;
    }catch(e){}
    box.innerHTML=`On-Call local records: <b>${fmtBytes(totalLocal)}</b>${origin}<br><span class="muted tiny">${lockedCount} locked period(s) · ${snapshotCount} Humanity snapshot(s) currently retained.</span>`;
  }

  async function compactOne(start,ask=false){
    if(!isLocked(start))return toast('Close the pay period before archiving it.');
    const bytes=snapshotBytesFor(start);
    if(ask){
      const ok=await appConfirm(`Archive the locked period ${mdy(start)} – ${mdy(endFor(start))} and free safe space? This removes only the duplicate imported Humanity snapshot. Payroll, events, Requests, folios and Knowledge Base remain available.`,'Archive & Free Space');
      if(!ok)return;
    }
    const k=keyFor(start);if(snapshots[k]){delete snapshots[k];save(K.snap,snapshots)}
    try{sessionStorage.removeItem('ocma_ios_print_job')}catch(e){}
    setStatus(start,{compactedAt:new Date().toISOString()});
    applyLockUI();
    if(ask)toast(bytes?`Locked period compacted. Approx. ${fmtBytes(bytes)} of duplicate snapshot data removed.`:'This locked period was already compacted.');
    return bytes;
  }

  async function compactAllLocked(){
    const keys=Object.entries(window.periodStatuses||{}).filter(([,v])=>v?.locked).map(([k])=>k);
    if(!keys.length)return toast('No locked periods to compact.');
    const ok=await appConfirm(`Compact ${keys.length} locked pay period(s)? Only duplicate Humanity snapshots will be removed. Historical Payroll, events, Requests, folios and Knowledge Base will remain.`,'Compact Locked Periods');
    if(!ok)return;
    let freed=0;
    for(const k of keys){
      if(snapshots[k]){freed+=JSON.stringify(snapshots[k]).length*2;delete snapshots[k]}
      window.periodStatuses[k]={...window.periodStatuses[k],compactedAt:new Date().toISOString()};
    }
    save(K.snap,snapshots);saveStatuses();
    try{sessionStorage.removeItem('ocma_ios_print_job')}catch(e){}
    applyLockUI();toast(`Locked periods compacted. Approx. ${fmtBytes(freed)} removed safely.`);
  }

  // Block period mutations even if a stale/dynamic control somehow remains enabled.
  document.addEventListener('submit',e=>{
    if(!isLocked())return;
    if(e.target?.matches?.('#fieldEmergencyForm,#eventEditorForm')){e.preventDefault();e.stopImmediatePropagation();toast('This pay period is DELIVERED / LOCKED. Unlock it before making changes.')}
  },true);
  document.addEventListener('click',e=>{
    if(!isLocked())return;
    const t=e.target?.closest?.('.add-block,.del-block,.mark-red,.split-events,.edit-chip-event,.add-day-event,.review-field-event,.add-field-payroll,.edit-event,.delete-event,#assignFoliosBtn,#saveEventRowsBtn,#addEventRowBtn,.remove-event-row,.use-seg,.use-existing-event');
    if(t){e.preventDefault();e.stopImmediatePropagation();toast('This pay period is DELIVERED / LOCKED. Unlock it before making changes.')}
  },true);

  // Safe Humanity import: a locked period cannot be overwritten. Moving to a newer
  // PDF automatically offers to close an open period that still contains work.
  const humanity=$('#humanityPdf');
  if(humanity)humanity.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    $('#pdfStatus').className='notice';$('#pdfStatus').textContent='Reading '+file.name+'…';
    try{
      const r=await parseHumanityPdf(file),oldStart=currentPeriodStart,targetStart=r.start;
      if(isLocked(targetStart)){
        $('#pdfStatus').className='notice warn';$('#pdfStatus').textContent=`Pay period ${mdy(targetStart)} – ${mdy(endFor(targetStart))} is DELIVERED / LOCKED and was not overwritten.`;return;
      }
      if(targetStart!==oldStart&&hasData(oldStart)&&!isLocked(oldStart)){
        const ok=await appConfirm(`The current pay period ${mdy(oldStart)} – ${mdy(endFor(oldStart))} still has data and is OPEN. Mark it DELIVERED / LOCKED and continue importing ${mdy(targetStart)} – ${mdy(endFor(targetStart))}?`,'Close Previous Pay Period');
        if(!ok){$('#pdfStatus').className='notice warn';$('#pdfStatus').textContent='Import cancelled. Current pay period remains open.';return}
        lockPeriod(oldStart,'new-humanity-import');
      }
      currentPeriodStart=targetStart;save(K.period,currentPeriodStart);
      const k=periodKey();payrollStore[k]=clone(r.days);snapshots[k]=clone(r.days);save(K.payroll,payrollStore);save(K.snap,snapshots);
      hoursMode='review';renderAll();$('#pdfStatus').className='notice good';$('#pdfStatus').textContent=`Imported ${r.rowCount} IN/OUT blocks. Existing field events were preserved and now appear inside the matching Payroll days for reconciliation.`;
    }catch(err){console.error(err);$('#pdfStatus').className='notice bad';$('#pdfStatus').textContent='Could not read PDF: '+err.message}
    finally{e.target.value=''}
  };

  // Wrap renderers so dynamically-created edit controls inherit the current lock state.
  const baseRenderPayroll=renderPayroll,baseRenderRequests=renderRequests,baseRenderAll=renderAll,baseUpdateDashboard=updateDashboard;
  renderPayroll=function(){baseRenderPayroll();applyLockUI()};
  renderRequests=function(){baseRenderRequests();applyLockUI()};
  updateDashboard=function(){baseUpdateDashboard();applyLockUI()};
  renderAll=function(){baseRenderAll();applyLockUI()};

  ensureLifecycleUI();
  applyLockUI();
  renderAll();
})();
