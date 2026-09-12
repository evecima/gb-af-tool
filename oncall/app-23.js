/* v0.6.10 — real-world emergency time chain: close order owns work segments; final call can close with OUT */
(function(){
  const VERSION='0.6.10';
  const f=$('#fieldEmergencyForm');
  if(!f||!K.sessions||!K.emergencyDrafts||!K.activeDraft)return;

  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const sessionById=id=>sessions().find(s=>s.id===id)||null;
  const currentDraftId=()=>load(K.activeDraft,'')||'';
  const currentDraft=()=>drafts().find(d=>d.id===currentDraftId()&&d.workflowStatus!=='CLOSED')||null;
  const openDrafts=()=>drafts().filter(d=>d.workflowStatus!=='CLOSED');
  const relevantDrafts=s=>s?openDrafts().filter(d=>d.sessionId===s.id||(!d.sessionId&&d.date===s.date)):[];
  const lockedForDate=date=>!!(window.isPeriodLocked&&window.isPeriodLocked(periodForDate(date||todayISO())));
  const saveDrafts=()=>save(K.emergencyDrafts,window.emergencyDrafts||[]);
  const saveSessions=()=>save(K.sessions,window.onCallSessions||[]);

  function ensureSessionCursor(s){
    if(!s)return'';
    if(s.nextWorkStart)return s.nextWorkStart;
    const closed=(events||[]).filter(e=>e.type==='emergency'&&e.sessionId===s.id&&e.out).sort((a,b)=>String(a.closedAt||a.createdAt||'').localeCompare(String(b.closedAt||b.createdAt||'')));
    const last=closed[closed.length-1];
    s.nextWorkStart=last?.out||s.in||'';
    s.workSeq=Math.max(Number(s.workSeq)||0,...closed.map(e=>Number(e.workSequence)||0));
    s.updatedAt=nowISO();saveSessions();
    return s.nextWorkStart;
  }

  function syncFormIntoDraft(d){
    if(!d||currentDraftId()!==d.id)return d;
    const data=Object.fromEntries(new FormData(f).entries());
    const keep={id:d.id,createdAt:d.createdAt,workflowStatus:d.workflowStatus||'RECEIVED',sessionId:d.sessionId||activeSession()?.id||'',source:d.source||'field-v060',callNumber:d.callNumber||0};
    Object.assign(d,data,keep);
    d.date=d.date||todayISO();d.dateReceived=d.date;
    d._locationSearch=$('#fieldLocationSearch')?.value||d._locationSearch||'';
    if($('#fieldUsedVendor')){
      d.vendor=$('#fieldUsedVendor').checked?(typeof vendorValue==='function'?vendorValue('field'):(d.vendor||'')):'';
      if(!$('#fieldUsedVendor').checked)d.vendorWork='';
    }
    d.result=d.remarks||'';d.updatedAt=nowISO();saveDrafts();return d;
  }

  function draftTitle(d){return (d?.problem||'').trim()}
  function draftLocation(d){return (d?.locationCode||d?.manualLocation||d?._locationSearch||'').trim()}
  function validateDraft(d){
    const title=draftTitle(d),loc=draftLocation(d);
    if(!title||/Details Pending/i.test(title)){toast('Select or enter the Emergency / Problem Title before closing this emergency.');return false}
    if(!loc){toast('Enter/select the emergency Location before closing this emergency.');return false}
    return true;
  }

  function makeClosedEvent(d,s,start,end){
    const ev=makeEvent('emergency',d.date,start,end,'field');
    const seq=(Number(s?.workSeq)||0)+1;
    Object.assign(ev,{
      dateReceived:d.dateReceived||d.date,timeReceived:d.timeReceived||'',locationCode:d.locationCode||'',fullAddress:d.fullAddress||'',manualLocation:d.manualLocation||'',occupant:d.occupant||'',phone:d.phone||'',
      problem:draftTitle(d),finding:d.finding||'',solution:d.solution||'',specialInstructions:d.specialInstructions||'',remarks:d.remarks||'',result:d.remarks||'',material:d.material||'',quantity:d.quantity||'',vendor:d.vendor||'',vendorWork:d.vendorWork||'',
      status:(d.closeOutcome||'Resolved')==='Resolved'?'Job Complete':'Not Complete',closeOutcome:d.closeOutcome||'Resolved',followUpDate:d.followUpDate||'',followUpTime:d.followUpTime||'',
      sessionId:d.sessionId||s?.id||'',workflowStatus:'CLOSED',receivedAt:d.createdAt||'',closedAt:nowISO(),draftId:d.id,callNumber:Number(d.callNumber)||0,workSequence:seq,workTimeSource:'close-order-chain'
    });
    return ev;
  }

  function normalizeRemaining(s){
    const left=relevantDrafts(s);let changed=false;
    for(const d of left){
      if(!d.sessionId){d.sessionId=s.id;changed=true}
      const desired=left.length===1?'IN_PROGRESS':'WAITING';
      if(d.workflowStatus!=='PAUSED'&&d.workflowStatus!==desired){d.workflowStatus=desired;changed=true}
      if(changed)d.updatedAt=nowISO();
    }
    if(changed)saveDrafts();
    return left;
  }

  function removeDraft(id){
    window.emergencyDrafts=drafts().filter(x=>x.id!==id);saveDrafts();
    if(currentDraftId()===id)save(K.activeDraft,'');
  }

  function closeSessionAt(s,end){
    if(!s)return;
    s.out=end;s.status='CLOSED';s.closedAt=nowISO();s.updatedAt=nowISO();s.nextWorkStart=end;saveSessions();
  }

  function finalizeDraft(d,s,end,{finishSession=false}={}){
    if(!d||!s)return null;
    if(!d.sessionId)d.sessionId=s.id;
    const start=ensureSessionCursor(s)||s.in||end;
    const ev=makeClosedEvent(d,s,start,end);
    events.push(ev);save(K.events,events);if(typeof learnEvent==='function')learnEvent(ev);
    s.workSeq=Number(ev.workSequence)||((Number(s.workSeq)||0)+1);s.nextWorkStart=end;s.lastClosedEventId=ev.id;s.updatedAt=nowISO();saveSessions();
    removeDraft(d.id);
    const left=normalizeRemaining(s);
    if(finishSession||left.length===0)closeSessionAt(s,end);
    return {ev,left};
  }

  async function closeByButton(e){
    e.preventDefault();e.stopImmediatePropagation();
    const d=syncFormIntoDraft(currentDraft());if(!d)return toast('Select an open emergency call first.');
    const s=sessionById(d.sessionId)||activeSession();
    if(!s)return toast('Start the On-Call Session before closing an emergency.');
    if(lockedForDate(d.date||s.date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before closing an emergency.');
    if(!validateDraft(d))return;
    const end=nowTime(),before=relevantDrafts(s).length;
    finalizeDraft(d,s,end,{finishSession:before===1});
    renderAll();go('emergency');syncControls();syncLogTimes();
    toast(before===1?`${draftTitle(d)} closed at ${clock(end)}. Final emergency and On-Call Session are complete.`:`${draftTitle(d)} closed at ${clock(end)}. ${clock(end)} is now the pending IN for whichever emergency you close next.`);
  }

  async function closeWithOut(){
    const s=activeSession();if(!s)return;
    if(lockedForDate(s.date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before changing the session.');
    const open=relevantDrafts(s);
    if(open.length!==1){syncControls();return toast(open.length>1?'OUT is available only when one final emergency remains. Close another emergency first.':'No final emergency is available to close with OUT.');}
    let d=open[0];if(currentDraftId()===d.id)d=syncFormIntoDraft(d);
    if(!validateDraft(d)){go('emergency');setTimeout(()=>{const card=document.querySelector(`.workflow-call[data-draft-id="${d.id}"]`);if(card)card.click()},0);return}
    const end=nowTime();finalizeDraft(d,s,end,{finishSession:true});
    renderAll();go('emergency');syncControls();syncLogTimes();
    toast(`${draftTitle(d)} and the On-Call Session closed together at ${clock(end)}.`);
  }

  function syncControls(){
    const s=activeSession(),date=s?.date||f.elements.date?.value||todayISO(),locked=lockedForDate(date),open=s?relevantDrafts(s):[];
    const inBtn=$('#workflowInBtn'),outBtn=$('#workflowOutBtn');
    if(inBtn){inBtn.disabled=!!s||locked||openDrafts().length===0}
    if(outBtn){
      outBtn.disabled=!s||locked||open.length!==1;
      outBtn.onclick=closeWithOut;
      outBtn.dataset.v065Wrapped='1';
      outBtn.title=locked?'This pay period is locked.':!s?'Start an On-Call Session first.':open.length===1?'OUT will close the final emergency and the On-Call Session at the same time.':open.length>1?`OUT disabled: ${open.length} emergency calls remain open.`:'OUT requires one final open emergency.';
    }
    let hint=$('#v070ChainHint');
    if(!hint&&$('#workflowSessionCard')){hint=document.createElement('div');hint.id='v070ChainHint';hint.className='muted tiny top-space';$('#workflowSessionCard').appendChild(hint)}
    if(hint){
      const text=!s?'Close order determines each emergency work segment. OUT becomes available when one final emergency remains.':open.length>1?`${open.length} open calls · Close whichever emergency you actually worked. Its OUT becomes the pending IN for the next one you later close.`:open.length===1?'1 final call remains · Close Emergency or OUT will both finish the emergency and the On-Call Session.':'No open calls remain in this session.';
      if(hint.textContent!==text)hint.textContent=text;
    }
  }

  function recordTimes(x,kind){
    if(kind==='event'||x.workflowStatus==='CLOSED'||x.type!=='emergency')return {tin:x.in||'',tout:x.out||''};
    const s=sessionById(x.sessionId);if(!s)return {tin:'',tout:''};
    const rel=relevantDrafts(s),isSole=rel.length===1&&rel[0].id===x.id;
    return {tin:isSole?(s.nextWorkStart||s.in||''):'',tout:''};
  }

  function syncLogTimes(){
    const list=$('#workflowLogList');if(!list)return;
    list.querySelectorAll('.workflow-log-item[data-kind][data-id]').forEach(card=>{
      const kind=card.dataset.kind,id=card.dataset.id;
      const x=kind==='draft'?drafts().find(d=>d.id===id):events.find(e=>e.id===id);if(!x)return;
      const meta=card.querySelector('.item-meta');if(!meta)return;
      const date=x.date||x.dateReceived||'',parts=[];
      if(x.timeReceived)parts.push(`RCVD ${clock(x.timeReceived)}`);
      const {tin,tout}=recordTimes(x,kind);if(tin)parts.push(`IN ${clock(tin)}`);if(tout)parts.push(`OUT ${clock(tout)}`);
      const text=`${mdy(date)}${parts.length?' · '+parts.join(' · '):''}`;if(meta.textContent!==text)meta.textContent=text;
    });
    overrideLogExports();
  }

  function logRowsForCurrentUI(){
    const selected=$('#workflowPeriodFilter')?.value||'current';
    const kind=$('#workflowLogSubfilter [data-log-kind].active')?.dataset.logKind||'all';
    const q=($('#workflowLogSearch')?.value||'').trim().toLowerCase();
    const rows=[...openDrafts().map(x=>({...x,_kind:'draft',_logState:'OPEN',type:'emergency'})),...events.map(x=>({...x,_kind:'event',_logState:x.type==='emergency'?'CLOSED':'SAVED'}))];
    const start=selected==='current'?currentPeriodStart:selected==='all'?'':selected;
    return rows.filter(x=>{
      const date=x.date||x.dateReceived||'',p=date?periodForDate(date):'';
      if(start&&p!==start)return false;
      if(kind==='emergency'&&!(x._kind==='draft'||x.type==='emergency'))return false;
      const title=x.problem?.trim()||(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event');
      const loc=x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'';
      return !q||[title,loc,x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor].join(' ').toLowerCase().includes(q);
    }).sort((a,b)=>((b.date||b.dateReceived||'')+(b.timeReceived||b.in||'')).localeCompare((a.date||a.dateReceived||'')+(a.timeReceived||a.in||'')));
  }

  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
  async function deliverFile(name,type,text){
    const blob=new Blob([text],{type});
    try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  function overrideLogExports(){
    const txt=$('#workflowExportTxt'),csv=$('#workflowExportCsv'),json=$('#workflowExportJson');if(!txt||!csv||!json)return;
    txt.onclick=()=>{const text=logRowsForCurrentUI().map(x=>{const t=recordTimes(x,x._kind),loc=x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'',title=x.problem?.trim()||(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event');return [`${x.date||x.dateReceived||''} | ${title} | ${loc}`,`Status: ${x._logState}${x.closeOutcome?' / '+x.closeOutcome:''}`,x.timeReceived?`Received: ${clock(x.timeReceived)}`:'',t.tin?`IN: ${clock(t.tin)}`:'',t.tout?`OUT: ${clock(t.tout)}`:'',x.occupant?`Occupant: ${x.occupant}`:'',x.phone?`Phone: ${x.phone}`:'',x.remarks?`Remarks: ${x.remarks}`:''].filter(Boolean).join('\n')}).join('\n\n----------------------------------------\n\n');deliverFile(`OnCall_Log_${todayISO()}.txt`,'text/plain',text)};
    csv.onclick=()=>{const head=['Date','Type','Title','Location','Received','In','Out','Status','Outcome','Occupant','Phone','Folio'];const body=logRowsForCurrentUI().map(x=>{const t=recordTimes(x,x._kind),title=x.problem?.trim()||(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event'),loc=x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'';return [x.date||x.dateReceived||'',x._kind==='draft'?'Emergency':(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event'),title,loc,x.timeReceived||'',t.tin,t.tout,x._logState,x.closeOutcome||'',x.occupant||'',x.phone||'',x.requestNumber||''].map(csvCell).join(',')});deliverFile(`OnCall_Log_${todayISO()}.csv`,'text/csv',[head.map(csvCell).join(','),...body].join('\n'))};
    json.onclick=()=>deliverFile(`OnCall_Log_${todayISO()}.json`,'application/json',JSON.stringify({kind:'oncall-log',version:VERSION,exportedAt:nowISO(),technician:workerName(),records:logRowsForCurrentUI()},null,2));
  }

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:1,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:currentDraftId(),reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
    const hint=$('#v069BackupHint');if(hint)hint.textContent='Full v0.6.10 backup: includes Payroll, events, open calls, On-Call sessions and the work-segment cursor, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings. Import replaces destination-device local data; it does not merge records.';
  }

  // Capture submit after the older call-number hook, but before the old close handlers.
  f.addEventListener('submit',closeByButton,true);

  const baseRenderAllV070=renderAll;
  renderAll=function(){baseRenderAllV070();syncControls();setTimeout(syncLogTimes,0);installBackupExport()};
  const baseGoV070=go;
  go=function(id){baseGoV070(id);syncControls();if(id==='emergencyLog')setTimeout(syncLogTimes,0);installBackupExport()};

  const editor=$('#eventEditorForm');
  if(editor)editor.addEventListener('submit',()=>setTimeout(()=>{syncLogTimes();const s=activeSession();if(!s)return;const closed=(events||[]).filter(e=>e.type==='emergency'&&e.sessionId===s.id&&e.out).sort((a,b)=>String(a.closedAt||'').localeCompare(String(b.closedAt||'')));const last=closed[closed.length-1];if(last&&last.id===s.lastClosedEventId&&last.out){s.nextWorkStart=last.out;s.updatedAt=nowISO();saveSessions();syncControls()}},60));

  ensureSessionCursor(activeSession());syncControls();syncLogTimes();installBackupExport();
  const root=$('#emergency');if(root){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;syncControls()})}).observe(root,{subtree:true,childList:true})}
  const logRoot=$('#emergencyLog');if(logRoot){let logQueued=false;new MutationObserver(()=>{if(logQueued)return;logQueued=true;requestAnimationFrame(()=>{logQueued=false;syncLogTimes()})}).observe(logRoot,{subtree:true,childList:true})}
})();
