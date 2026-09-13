/* v0.7.11 — Maintenance Request is the master record for closed Reportable Work */
(function(){
  const VERSION='0.7.11';
  const REPORTABLE_TYPES=new Set(['mandatory_ot','snow','pool_open','pool_close']);

  function reportableLabel(type){
    if(type==='mandatory_ot')return'Mandatory Overtime';
    if(type==='snow')return'Snow Removal';
    if(type==='pool_open')return'Pool Opening';
    if(type==='pool_close')return'Pool Closing';
    return'Reportable Work';
  }

  function eventLocation(e){
    return (e?.locationCode||e?.manualLocation||e?.fullAddress||'').trim();
  }

  function inPeriod(date){
    try{return !date||typeof inCurrentPeriod!=='function'||inCurrentPeriod(date)}catch(e){return true}
  }

  function saveReportableState(){
    const s=window.reportableWorkState;
    if(s&&K.reportableWork)save(K.reportableWork,s);
  }

  function savePoolState(){
    const s=window.poolOperationsState;
    if(s&&K.poolOperations)save(K.poolOperations,s);
  }

  function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}

  function reconcileReportableState(){
    const s=window.reportableWorkState;if(!s||!Array.isArray(s.activities))return;
    const before=JSON.parse(JSON.stringify(s.activities));
    s.activities=s.activities.filter(a=>{
      if(a?.status!=='CLOSED'||!a.parentEventId)return true;
      const ev=(events||[]).find(e=>e.id===a.parentEventId);
      if(!ev)return false;
      a.date=ev.date||ev.dateReceived||a.date;
      a.start=ev.in||a.start;
      a.end=ev.out||a.end;
      a.currentLocation=eventLocation(ev)||a.currentLocation||'';
      return true;
    });
    if(!same(before,s.activities))saveReportableState();
  }

  function reconcilePoolState(){
    const s=window.poolOperationsState;if(!s||!Array.isArray(s.operations))return;
    const before=JSON.parse(JSON.stringify(s.operations));
    s.operations=s.operations.filter(op=>{
      if(op?.status!=='CLOSED'||!Array.isArray(op.eventIds)||!op.eventIds.length)return true;
      const linked=op.eventIds.map(id=>(events||[]).find(e=>e.id===id)).filter(Boolean)
        .sort((a,b)=>String((a.date||a.dateReceived||'')+(a.in||'')).localeCompare(String((b.date||b.dateReceived||'')+(b.in||''))));
      if(!linked.length)return false;
      op.eventIds=linked.map(e=>e.id);
      const first=linked[0],last=linked[linked.length-1];
      op.date=first.date||first.dateReceived||op.date;
      op.start=first.in||op.start;
      op.end=last.out||op.end;
      op.location=eventLocation(first)||op.location||'Pool Area';
      op.segments=linked.map(e=>({start:e.in||'',end:e.out||'',location:eventLocation(e)||op.location||'Pool Area'})).filter(x=>x.start&&x.end);
      return true;
    });
    if(!same(before,s.operations))savePoolState();
  }

  function reconcileClosedSources(){
    reconcileReportableState();
    reconcilePoolState();
  }

  function closedRows(){
    return (events||[]).filter(e=>{
      if(!e||!REPORTABLE_TYPES.has(e.type))return false;
      const d=e.date||e.dateReceived||'';
      return inPeriod(d);
    }).map(e=>({kind:'event',date:e.date||e.dateReceived||'',start:e.in||'',end:e.out||'',event:e}));
  }

  function activeRows(){
    const out=[];
    const rw=window.reportableWorkState;
    if(rw?.activities)for(const a of rw.activities){
      if(a?.status==='CLOSED'||!inPeriod(a?.date))continue;
      out.push({kind:'active-rw',date:a.date||'',start:a.start||'',end:a.end||'',activity:a});
    }
    const ps=window.poolOperationsState;
    if(ps?.operations)for(const op of ps.operations){
      if(op?.status==='CLOSED'||!inPeriod(op?.date))continue;
      out.push({kind:'active-pool',date:op.date||'',start:op.start||'',end:op.end||'',operation:op});
    }
    return out;
  }

  function renderEventRow(e){
    const d=e.date||e.dateReceived||'',title=(e.problem||reportableLabel(e.type)).trim(),loc=eventLocation(e);
    const meta=`${e.in?clock(e.in):'—'}${e.out?'–'+clock(e.out):'–…'}${loc?' · '+esc(loc):''}`;
    return `<div class="item v0711-master-row"><div class="row between wrap gap"><div><div class="item-title">${esc(title)} · ${mdy(d)}</div><div class="item-meta">${meta}</div><div class="badges"><span class="badge ok">CLOSED</span><span class="badge">Maintenance Request master</span></div></div></div></div>`;
  }

  function renderActiveReportable(a){
    const title=a.type==='mandatory_ot'?'Mandatory Overtime':'Snow Removal',loc=a.currentLocation||'';
    return `<div class="item"><div class="item-title">${title} · ${mdy(a.date)}</div><div class="item-meta">${a.start?clock(a.start):'—'}${a.end?'–'+clock(a.end):'–…'}${loc?' · '+esc(loc):''}</div><div class="badges"><span class="badge ${a.status==='PAUSED'?'warn':''}">${esc(a.status||'ACTIVE')}</span><span class="badge">Operational timeline</span></div></div>`;
  }

  function renderActivePool(op){
    const title=op.mode==='open'?'Pool Opening':'Pool Closing',loc=op.location||'Pool Area';
    return `<div class="item"><div class="item-title">${title} · ${mdy(op.date)}</div><div class="item-meta">${op.start?clock(op.start):'—'}${op.end?'–'+clock(op.end):'–…'} · ${esc(loc)}</div><div class="badges"><span class="badge ${op.status==='PAUSED'?'warn':''}">${esc(op.status||'ACTIVE')}</span><span class="badge">Operational timeline</span></div></div>`;
  }

  function renderMasterHistory(){
    const list=$('#v070History');if(!list)return;
    reconcileClosedSources();
    $('#v078PoolHistory')?.remove();
    const rows=[...activeRows(),...closedRows()].sort((a,b)=>String((b.date||'')+(b.start||'')).localeCompare(String((a.date||'')+(a.start||''))));
    list.innerHTML=rows.length?rows.map(r=>r.kind==='event'?renderEventRow(r.event):r.kind==='active-pool'?renderActivePool(r.operation):renderActiveReportable(r.activity)).join(''):'<div class="muted">No Reportable Work records in this pay period.</div>';
    const card=list.closest('.card');
    const hint=card?.querySelector('.muted.tiny');
    if(hint)hint.textContent='Active work follows the operational timeline. Once closed, the Maintenance Request is the master record; edits and deletions here flow to this history and all derived reports.';
  }

  function scheduleSync(){setTimeout(renderMasterHistory,0);setTimeout(renderMasterHistory,100);setTimeout(renderMasterHistory,400)}

  const baseRenderAllV0711=renderAll;
  renderAll=function(){baseRenderAllV0711();scheduleSync()};
  const baseGoV0711=go;
  go=function(id){baseGoV0711(id);if(id==='reportableWork')scheduleSync()};

  document.addEventListener('submit',e=>{if(e.target?.id==='eventEditorForm')scheduleSync()},true);
  document.addEventListener('click',e=>{
    const t=e.target?.closest?.('button');if(!t)return;
    const txt=(t.textContent||'').trim().toLowerCase();
    if(txt==='delete'||txt==='save changes')scheduleSync();
  },true);

  scheduleSync();
})();
