/* v0.6.2 — dashboard session status + period-filtered Emergency Log + individual delete */
(function(){
  let logFilter='current';
  const activeSession=()=>[...(window.onCallSessions||[])].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=> (window.emergencyDrafts||[]).filter(d=>d.workflowStatus!=='CLOSED');
  const sessionById=id=>(window.onCallSessions||[]).find(s=>s.id===id)||null;
  const dateOf=x=>x.date||x.dateReceived||'';
  const periodOf=x=>dateOf(x)?periodForDate(dateOf(x)):'';
  const lockedPeriod=start=>!!(window.isPeriodLocked&&window.isPeriodLocked(start));

  function allLogRows(){
    const closed=events.filter(e=>e.type==='emergency').map(e=>({...e,_logState:'CLOSED',_kind:'event'}));
    const open=openDrafts().map(d=>({...d,_logState:'OPEN',_kind:'draft'}));
    return [...open,...closed].sort((a,b)=>{
      const ak=(dateOf(a)||'')+(a.timeReceived||a.in||''),bk=(dateOf(b)||'')+(b.timeReceived||b.in||'');
      return bk.localeCompare(ak);
    });
  }

  function availablePeriods(){
    const set=new Set([currentPeriodStart]);
    allLogRows().forEach(x=>{const p=periodOf(x);if(p)set.add(p)});
    return [...set].sort((a,b)=>b.localeCompare(a));
  }

  function currentFilterStart(){return logFilter==='current'?currentPeriodStart:logFilter==='all'?'':logFilter}
  function filteredRows(){
    const rows=allLogRows(),start=currentFilterStart();
    if(!start)return rows;
    return rows.filter(x=>periodOf(x)===start);
  }

  function removeOldBulkCleanup(){
    $('#workflowClearPeriodLog')?.remove();
    $('#workflowClearPeriodHint')?.remove();
  }

  function tuneDashboard(){
    const box=$('#workflowDashSession');if(!box)return;
    $('#workflowDashIn')?.remove();
    $('#workflowDashOut')?.remove();
    const s=activeSession(),open=openDrafts().filter(d=>!s||!d.sessionId||d.sessionId===s.id).length;
    const state=$('#workflowDashSessionState');
    if(state)state.textContent=s?`SESSION RUNNING · IN ${clock(s.in)} · ${open} OPEN CALL${open===1?'':'S'}`:'NO ACTIVE SESSION';
    const quick=$('#workflowDashOpenCalls');
    if(quick){
      const useful=!!s&&open>0;
      quick.classList.toggle('hidden',!useful);
      quick.disabled=!useful;
      quick.textContent=useful?`Open Calls (${open})`:'Open Calls';
    }
  }

  function ensureLogFilterUI(){
    removeOldBulkCleanup();
    const search=$('#workflowLogSearch');if(!search)return;
    const row=search.parentElement;if(!row)return;
    let sel=$('#workflowPeriodFilter');
    if(!sel){
      sel=document.createElement('select');sel.id='workflowPeriodFilter';sel.setAttribute('aria-label','Emergency Log pay period filter');sel.style.minWidth='205px';sel.style.maxWidth='100%';
      search.insertAdjacentElement('afterend',sel);
      sel.onchange=()=>{logFilter=sel.value||'current';renderFilteredLog()};
    }
    const periods=availablePeriods(),selected=logFilter;
    sel.innerHTML=`<option value="current">Current Period · ${mdy(currentPeriodStart)}–${mdy(addDays(currentPeriodStart,13))}</option>`+
      periods.filter(p=>p!==currentPeriodStart).map(p=>`<option value="${esc(p)}">${mdy(p)}–${mdy(addDays(p,13))}</option>`).join('')+
      '<option value="all">All History</option>';
    if([...sel.options].some(o=>o.value===selected))sel.value=selected;else {logFilter='current';sel.value='current'}
    search.oninput=renderFilteredLog;
    overrideExports();
  }

  function periodLabel(){const start=currentFilterStart();return start?`${mdy(start)} – ${mdy(addDays(start,13))}`:'All History'}

  function renderFilteredLog(){
    ensureLogFilterUI();removeOldBulkCleanup();
    const list=$('#workflowLogList');if(!list)return;
    const q=($('#workflowLogSearch')?.value||'').toLowerCase();
    const base=filteredRows(),rows=base.filter(x=>[x.problem,x.locationCode,x.manualLocation,x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor].join(' ').toLowerCase().includes(q));
    const open=base.filter(x=>x._logState==='OPEN').length;
    const stats=$('#workflowLogStats');if(stats)stats.textContent=`${periodLabel()} · ${base.length} emergency record(s) · ${open} open · ${base.length-open} closed${q?` · ${rows.length} match(es)`:''}`;
    list.innerHTML=rows.length?rows.map(x=>{
      const s=sessionById(x.sessionId),loc=x.locationCode||x.manualLocation||x._locationSearch||'Location pending',p=periodOf(x),locked=lockedPeriod(p);
      return `<div class="workflow-log-item" data-kind="${x._kind}" data-id="${esc(x.id)}"><div class="row between wrap gap"><div><div class="item-title">${esc(x.problem||'Emergency')} · ${esc(loc)}</div><div class="item-meta">${mdy(dateOf(x))} · RCVD ${clock(x.timeReceived)||'—'}${s?` · IN ${clock(s.in)}${s.out?' · OUT '+clock(s.out):''}`:''}</div></div><div class="row gap wrap"><span class="badge ${x._logState==='OPEN'?'warn':'ok'}">${x._logState}</span><button type="button" class="dangerbtn workflow-delete-log" data-kind="${x._kind}" data-id="${esc(x.id)}" ${locked?'disabled title="Unlock this pay period before deleting this emergency."':''}>Delete</button></div></div><div class="badges top-space">${x.closeOutcome?`<span class="badge">${esc(x.closeOutcome)}</span>`:''}${x.requestNumber?`<span class="badge">Folio ${esc(x.requestNumber)}</span>`:''}${locked?'<span class="badge">🔒 Period Locked</span>':''}</div></div>`;
    }).join(''):'<div class="muted">No emergency records in this filter.</div>';
    $$('.workflow-delete-log').forEach(b=>b.onclick=()=>deleteOneEmergency(b.dataset.kind,b.dataset.id));
  }

  async function deleteOneEmergency(kind,id){
    const row=kind==='draft'?(window.emergencyDrafts||[]).find(x=>x.id===id):events.find(x=>x.id===id);
    if(!row)return;
    const p=periodOf(row);if(lockedPeriod(p))return toast('This pay period is DELIVERED / LOCKED. Unlock it before deleting this emergency.');
    const title=row.problem||'Emergency',loc=row.locationCode||row.manualLocation||row._locationSearch||'Location pending';
    const consequence=kind==='draft'?'This removes only this open emergency call. The On-Call Session is preserved.':'This removes this emergency from Emergency Log, Maintenance Requests and On-Call Summary. Payroll/TIME CARD hours and the On-Call Session are preserved.';
    const ok=await appConfirm(`Delete ${title} · ${loc}?\n\nDate: ${mdy(dateOf(row))}\n${consequence}`,'Delete Emergency');
    if(!ok)return;
    if(kind==='draft'){
      window.emergencyDrafts=(window.emergencyDrafts||[]).filter(x=>x.id!==id);save(K.emergencyDrafts,window.emergencyDrafts);
      if(load(K.activeDraft,'')===id)save(K.activeDraft,'');
    }else{
      events=events.filter(x=>x.id!==id);save(K.events,events);
    }
    renderAll();renderFilteredLog();tuneDashboard();
    toast(`${title} deleted. Payroll/TIME CARD and the On-Call Session were preserved.`);
  }

  function exportRows(){return filteredRows().filter(x=>{
    const q=($('#workflowLogSearch')?.value||'').toLowerCase();
    return !q||[x.problem,x.locationCode,x.manualLocation,x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor].join(' ').toLowerCase().includes(q);
  })}
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
  async function deliverFile(name,type,text){const blob=new Blob([text],{type});try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  function overrideExports(){
    const txt=$('#workflowExportTxt'),csv=$('#workflowExportCsv'),json=$('#workflowExportJson');if(!txt||txt.dataset.v062)return;
    [txt,csv,json].forEach(b=>b.dataset.v062='1');
    txt.onclick=()=>{const text=exportRows().map(x=>{const s=sessionById(x.sessionId),loc=x.locationCode||x.manualLocation||x._locationSearch||'';return [`${dateOf(x)} | ${x.problem||'Emergency'} | ${loc}`,`Status: ${x._logState}${x.closeOutcome?' / '+x.closeOutcome:''}`,`Received: ${clock(x.timeReceived)||'—'}${s?` | IN: ${clock(s.in)} | OUT: ${clock(s.out)||'—'}`:''}`,x.occupant?`Occupant: ${x.occupant}`:'',x.phone?`Phone: ${x.phone}`:'',x.remarks?`Remarks: ${x.remarks}`:''].filter(Boolean).join('\n')}).join('\n\n----------------------------------------\n\n');deliverFile(`Emergency_Log_${todayISO()}.txt`,'text/plain',text)};
    csv.onclick=()=>{const head=['Date','Title','Location','Received','Session IN','Session OUT','Status','Outcome','Occupant','Phone','Folio'];const body=exportRows().map(x=>{const s=sessionById(x.sessionId);return [dateOf(x),x.problem,x.locationCode||x.manualLocation||x._locationSearch,x.timeReceived,s?.in||'',s?.out||'',x._logState,x.closeOutcome||'',x.occupant||'',x.phone||'',x.requestNumber||''].map(csvCell).join(',')});deliverFile(`Emergency_Log_${todayISO()}.csv`,'text/csv',[head.map(csvCell).join(','),...body].join('\n'))};
    json.onclick=()=>deliverFile(`Emergency_Log_${todayISO()}.json`,'application/json',JSON.stringify({kind:'oncall-emergency-log',version:'0.6.2',filter:logFilter,period:periodLabel(),exportedAt:new Date().toISOString(),technician:workerName(),records:exportRows()},null,2));
  }

  const baseUpdateDashboardV062=updateDashboard;
  updateDashboard=function(){baseUpdateDashboardV062();tuneDashboard()};

  const baseRenderAllV062=renderAll;
  renderAll=function(){baseRenderAllV062();removeOldBulkCleanup();tuneDashboard();if($('#emergencyLog')?.classList.contains('active'))renderFilteredLog()};

  const baseGoV062=go;
  go=function(id){baseGoV062(id);removeOldBulkCleanup();if(id==='dashboard')tuneDashboard();if(id==='emergencyLog'){ensureLogFilterUI();renderFilteredLog()}};

  removeOldBulkCleanup();tuneDashboard();ensureLogFilterUI();
})();