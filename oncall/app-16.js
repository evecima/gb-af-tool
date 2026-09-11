/* v0.6.3 — full On-Call Log, ALL/EMERGENCIES filter, locked-delete cleanup, dashboard payroll metadata */
(function(){
  let logPeriodFilter='current';
  let logKindFilter='all';
  const activeSession=()=>[...(window.onCallSessions||[])].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=> (window.emergencyDrafts||[]).filter(d=>d.workflowStatus!=='CLOSED');
  const sessionById=id=>(window.onCallSessions||[]).find(s=>s.id===id)||null;
  const dateOf=x=>x.date||x.dateReceived||'';
  const periodOf=x=>dateOf(x)?periodForDate(dateOf(x)):'';
  const lockedPeriod=start=>!!(window.isPeriodLocked&&window.isPeriodLocked(start));
  const isEmergency=x=>x._kind==='draft'||x.type==='emergency';
  const eventTitle=x=>x.problem?.trim()||eventTypeLabel(x.type);
  const locationOf=x=>x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'Location pending';

  function injectStyles(){
    if($('#v063Styles'))return;
    const s=document.createElement('style');s.id='v063Styles';s.textContent=`
      #dashboard .setup-grid.v063-compact{grid-template-columns:minmax(0,1fr)!important}
      .payroll-card-meta{display:grid;gap:3px;margin-top:10px;padding-top:9px;border-top:1px solid rgba(0,0,0,.09);text-align:left;width:100%}
      .payroll-card-meta .meta-row{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:12px;line-height:1.25}
      .payroll-card-meta .meta-label{color:#657786;font-weight:600}
      .payroll-card-meta .meta-value{color:#18212b;font-weight:800}
      .payroll-card-meta .meta-status.open{color:#14833b}.payroll-card-meta .meta-status.locked{color:#9a5b00}
      .log-subfilter{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 2px}
      .log-subfilter button{padding:7px 12px;border-radius:999px}
      .log-subfilter button.active{background:#1261a0;color:#fff;border-color:#1261a0}
      .workflow-log-item .log-type{font-weight:700}
    `;document.head.appendChild(s);
  }

  function tuneDashboard(){
    injectStyles();
    const setup=$('#dashboard .setup-grid');
    const reportBox=$('#dashReportDate')?.closest('.setup-box');
    const periodBox=$('#dashPeriod')?.closest('.setup-box');
    if(reportBox)reportBox.style.display='none';
    if(periodBox)periodBox.style.display='none';
    setup?.classList.add('v063-compact');
    const hint=$('#dashboard [data-i18n="setupHint"]');if(hint)hint.textContent=settings.language==='es'?'Técnico y estado actual de guardia.':'Technician and current on-call session status.';

    const payroll=$('#dashboard [data-go="payroll"]');
    if(payroll){
      let meta=$('#workflowPayrollCardMeta');
      if(!meta){meta=document.createElement('span');meta.id='workflowPayrollCardMeta';meta.className='payroll-card-meta';payroll.appendChild(meta)}
      const locked=lockedPeriod(currentPeriodStart),report=settings.reportDate||todayISO();
      meta.innerHTML=`<span class="meta-row"><span class="meta-label">Pay Period</span><span class="meta-value">${mdy(currentPeriodStart)} → ${mdy(addDays(currentPeriodStart,13))}</span><span class="meta-status ${locked?'locked':'open'}">${locked?'🔒 DELIVERED / LOCKED':'OPEN'}</span></span><span class="meta-row"><span class="meta-label">Report Date</span><span class="meta-value">${mdy(report)}</span></span>`;
    }

    const logCard=$('#workflowLogCard');
    if(logCard){
      const t=logCard.querySelector('.title'),d=logCard.querySelector('.desc');
      if(t)t.textContent='On-Call Log';
      if(d)d.textContent='Complete reportable history by pay period, with an Emergencies-only view.';
    }

    const box=$('#workflowDashSession');
    if(box){
      $('#workflowDashIn')?.remove();$('#workflowDashOut')?.remove();
      const s=activeSession(),open=s?openDrafts().filter(d=>!d.sessionId||d.sessionId===s.id).length:0;
      const state=$('#workflowDashSessionState');if(state)state.textContent=s?`SESSION RUNNING · IN ${clock(s.in)} · ${open} OPEN CALL${open===1?'':'S'}`:'NO ACTIVE SESSION';
      const quick=$('#workflowDashOpenCalls');if(quick){const useful=!!s&&open>0;quick.classList.toggle('hidden',!useful);quick.disabled=!useful;quick.textContent=useful?`Open Calls (${open})`:'Open Calls';}
    }
  }

  function allLogRows(){
    const saved=events.map(e=>({...e,_kind:'event',_logState:e.type==='emergency'?'CLOSED':'SAVED'}));
    const drafts=openDrafts().map(d=>({...d,type:'emergency',_kind:'draft',_logState:'OPEN'}));
    return [...drafts,...saved].sort((a,b)=>{
      const ak=(dateOf(a)||'')+(a.timeReceived||a.in||''),bk=(dateOf(b)||'')+(b.timeReceived||b.in||'');
      return bk.localeCompare(ak);
    });
  }
  function availablePeriods(){const set=new Set([currentPeriodStart]);allLogRows().forEach(x=>{const p=periodOf(x);if(p)set.add(p)});return [...set].sort((a,b)=>b.localeCompare(a))}
  function filterStart(){return logPeriodFilter==='current'?currentPeriodStart:logPeriodFilter==='all'?'':logPeriodFilter}
  function periodRows(){const rows=allLogRows(),start=filterStart();return start?rows.filter(x=>periodOf(x)===start):rows}
  function kindRows(){const rows=periodRows();return logKindFilter==='emergency'?rows.filter(isEmergency):rows}
  function periodLabel(){const start=filterStart();return start?`${mdy(start)} – ${mdy(addDays(start,13))}`:'All History'}

  function ensureLogUI(){
    const screen=$('#emergencyLog');if(!screen)return;
    const h=screen.querySelector('.screen-head h2'),p=screen.querySelector('.screen-head p');
    if(h)h.textContent='On-Call Log';
    if(p)p.textContent='Complete local history of reportable on-call activity. Use ALL for every reportable event or EMERGENCIES for calls only.';
    $('#workflowClearPeriodLog')?.remove();$('#workflowClearPeriodHint')?.remove();
    const search=$('#workflowLogSearch');if(!search)return;
    search.placeholder='Search title / apartment / occupant / phone / outcome';
    let sel=$('#workflowPeriodFilter');
    if(!sel){sel=document.createElement('select');sel.id='workflowPeriodFilter';search.insertAdjacentElement('afterend',sel)}
    sel.setAttribute('aria-label','On-Call Log pay period filter');sel.style.minWidth='205px';sel.style.maxWidth='100%';
    const selected=logPeriodFilter,periods=availablePeriods();
    sel.innerHTML=`<option value="current">Current Period · ${mdy(currentPeriodStart)}–${mdy(addDays(currentPeriodStart,13))}</option>`+periods.filter(p=>p!==currentPeriodStart).map(p=>`<option value="${esc(p)}">${mdy(p)}–${mdy(addDays(p,13))}</option>`).join('')+'<option value="all">All History</option>';
    if([...sel.options].some(o=>o.value===selected))sel.value=selected;else{logPeriodFilter='current';sel.value='current'}
    sel.onchange=()=>{logPeriodFilter=sel.value||'current';renderLog()};
    search.oninput=renderLog;

    let sub=$('#workflowLogSubfilter');
    if(!sub){sub=document.createElement('div');sub.id='workflowLogSubfilter';sub.className='log-subfilter';$('#workflowLogStats')?.insertAdjacentElement('afterend',sub)}
    overrideExports();
  }

  function rowTimes(x){
    const s=sessionById(x.sessionId),parts=[];
    if(x.timeReceived)parts.push(`RCVD ${clock(x.timeReceived)}`);
    const tin=s?.in||x.in||'',tout=s?.out||x.out||'';
    if(tin)parts.push(`IN ${clock(tin)}`);if(tout)parts.push(`OUT ${clock(tout)}`);
    return parts.length?parts.join(' · '):'Time not recorded';
  }

  function renderLog(){
    ensureLogUI();
    const list=$('#workflowLogList');if(!list)return;
    const periodBase=periodRows(),emergencyCount=periodBase.filter(isEmergency).length;
    const sub=$('#workflowLogSubfilter');if(sub){sub.innerHTML=`<button type="button" class="secondary ${logKindFilter==='all'?'active':''}" data-log-kind="all">ALL ${periodBase.length}</button><button type="button" class="secondary ${logKindFilter==='emergency'?'active':''}" data-log-kind="emergency">EMERGENCIES ${emergencyCount}</button>`;sub.querySelectorAll('[data-log-kind]').forEach(b=>b.onclick=()=>{logKindFilter=b.dataset.logKind;renderLog()})}
    const q=($('#workflowLogSearch')?.value||'').trim().toLowerCase();
    const base=kindRows(),rows=base.filter(x=>!q||[eventTitle(x),locationOf(x),x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor,eventTypeLabel(x.type)].join(' ').toLowerCase().includes(q));
    const open=base.filter(x=>x._logState==='OPEN').length;
    const stats=$('#workflowLogStats');if(stats)stats.textContent=`${periodLabel()} · ${base.length} record(s)${logKindFilter==='emergency'?` · ${open} open · ${base.length-open} closed`:''}${q?` · ${rows.length} match(es)`:''}`;
    list.innerHTML=rows.length?rows.map(x=>{
      const p=periodOf(x),locked=lockedPeriod(p),title=eventTitle(x),loc=locationOf(x),typeLabel=x._kind==='draft'?'Emergency':eventTypeLabel(x.type),canDelete=!locked;
      return `<div class="workflow-log-item" data-kind="${x._kind}" data-id="${esc(x.id)}"><div class="row between wrap gap"><div><div class="item-title">${esc(title)} · ${esc(loc)}</div><div class="item-meta">${mdy(dateOf(x))} · ${rowTimes(x)}</div></div><div class="row gap wrap"><span class="badge ${x._logState==='OPEN'?'warn':'ok'}">${esc(x._logState)}</span>${canDelete?`<button type="button" class="dangerbtn workflow-delete-log-v063" data-kind="${x._kind}" data-id="${esc(x.id)}">Delete</button>`:''}</div></div><div class="badges top-space"><span class="badge log-type">${esc(typeLabel)}</span>${x.closeOutcome?`<span class="badge">${esc(x.closeOutcome)}</span>`:''}${x.requestNumber?`<span class="badge">Folio ${esc(x.requestNumber)}</span>`:''}${locked?'<span class="badge">🔒 Period Locked</span>':''}</div></div>`;
    }).join(''):'<div class="muted">No records in this filter.</div>';
    $$('.workflow-delete-log-v063').forEach(b=>b.onclick=()=>deleteOne(b.dataset.kind,b.dataset.id));
  }

  async function deleteOne(kind,id){
    const row=kind==='draft'?(window.emergencyDrafts||[]).find(x=>x.id===id):events.find(x=>x.id===id);if(!row)return;
    const p=periodOf(row);if(lockedPeriod(p))return toast('This pay period is DELIVERED / LOCKED. Unlock it before deleting this record.');
    const title=eventTitle(row),loc=locationOf(row),what=kind==='draft'?'open emergency call':'reportable event';
    const consequence=kind==='draft'?'This removes only this open emergency call. Payroll/TIME CARD and the On-Call Session are preserved.':'This removes this reportable event from the On-Call Log, Maintenance Requests and On-Call Summary. Payroll/TIME CARD hours and the On-Call Session are preserved.';
    const ok=await appConfirm(`Delete ${title} · ${loc}?\n\nDate: ${mdy(dateOf(row))}\nType: ${kind==='draft'?'Emergency':eventTypeLabel(row.type)}\n\n${consequence}`,'Delete '+what);
    if(!ok)return;
    if(kind==='draft'){
      window.emergencyDrafts=(window.emergencyDrafts||[]).filter(x=>x.id!==id);save(K.emergencyDrafts,window.emergencyDrafts);if(load(K.activeDraft,'')===id)save(K.activeDraft,'');
    }else{events=events.filter(x=>x.id!==id);save(K.events,events)}
    renderAll();renderLog();tuneDashboard();toast(`${title} deleted. Payroll/TIME CARD was preserved.`);
  }

  function exportRows(){
    const q=($('#workflowLogSearch')?.value||'').trim().toLowerCase();
    return kindRows().filter(x=>!q||[eventTitle(x),locationOf(x),x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor,eventTypeLabel(x.type)].join(' ').toLowerCase().includes(q));
  }
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
  async function deliverFile(name,type,text){const blob=new Blob([text],{type});try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
  function overrideExports(){
    const txt=$('#workflowExportTxt'),csv=$('#workflowExportCsv'),json=$('#workflowExportJson');if(!txt||!csv||!json)return;
    txt.onclick=()=>{const text=exportRows().map(x=>{const s=sessionById(x.sessionId),tin=s?.in||x.in||'',tout=s?.out||x.out||'';return [`${dateOf(x)} | ${eventTitle(x)} | ${locationOf(x)}`,`Type: ${x._kind==='draft'?'Emergency':eventTypeLabel(x.type)} | Status: ${x._logState}${x.closeOutcome?' / '+x.closeOutcome:''}`,x.timeReceived?`Received: ${clock(x.timeReceived)}`:'',tin?`IN: ${clock(tin)}`:'',tout?`OUT: ${clock(tout)}`:'',x.occupant?`Occupant: ${x.occupant}`:'',x.phone?`Phone: ${x.phone}`:'',x.remarks?`Remarks: ${x.remarks}`:''].filter(Boolean).join('\n')}).join('\n\n----------------------------------------\n\n');deliverFile(`OnCall_Log_${todayISO()}.txt`,'text/plain',text)};
    csv.onclick=()=>{const head=['Date','Type','Title','Location','Received','In','Out','Status','Outcome','Occupant','Phone','Folio'];const body=exportRows().map(x=>{const s=sessionById(x.sessionId);return [dateOf(x),x._kind==='draft'?'Emergency':eventTypeLabel(x.type),eventTitle(x),locationOf(x),x.timeReceived||'',s?.in||x.in||'',s?.out||x.out||'',x._logState,x.closeOutcome||'',x.occupant||'',x.phone||'',x.requestNumber||''].map(csvCell).join(',')});deliverFile(`OnCall_Log_${todayISO()}.csv`,'text/csv',[head.map(csvCell).join(','),...body].join('\n'))};
    json.onclick=()=>deliverFile(`OnCall_Log_${todayISO()}.json`,'application/json',JSON.stringify({kind:'oncall-log',version:'0.6.3',periodFilter:logPeriodFilter,view:logKindFilter,period:periodLabel(),exportedAt:new Date().toISOString(),technician:workerName(),records:exportRows()},null,2));
  }

  const baseUpdateDashboardV063=updateDashboard;
  updateDashboard=function(){baseUpdateDashboardV063();tuneDashboard()};
  const baseRenderAllV063=renderAll;
  renderAll=function(){baseRenderAllV063();tuneDashboard();if($('#emergencyLog')?.classList.contains('active'))renderLog()};
  const baseGoV063=go;
  go=function(id){baseGoV063(id);if(id==='dashboard')tuneDashboard();if(id==='emergencyLog'){ensureLogUI();renderLog()}};

  const exportBtn=$('#exportDataBtn');if(exportBtn)exportBtn.onclick=()=>{const data={version:'0.6.3',settings,currentPeriodStart,payrollStore,snapshots,events,problems,folioStarts,localKnowledge,vendors,periodStatuses:window.periodStatuses||{},onCallSessions:window.onCallSessions||[],emergencyDrafts:window.emergencyDrafts||[],activeDraftId:load(K.activeDraft,'')};deliverFile('oncall-maintenance-v0.6.3-backup.json','application/json',JSON.stringify(data,null,2))};

  injectStyles();tuneDashboard();ensureLogUI();renderLog();
})();