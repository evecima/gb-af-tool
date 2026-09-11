/* v0.6.1 — route live emergencies to their actual pay period + safe current-period emergency cleanup */
(function(){
  const form=$('#fieldEmergencyForm');
  const dateInPeriod=(date,start=currentPeriodStart)=>!!date&&date>=start&&date<=addDays(start,13);

  function activatePeriodForDate(date){
    const d=date||todayISO(),target=periodForDate(d);
    if(target===currentPeriodStart)return false;
    currentPeriodStart=target;
    save(K.period,currentPeriodStart);
    return true;
  }

  function periodEmergencyCounts(){
    const start=currentPeriodStart,end=addDays(start,13);
    const closed=events.filter(e=>e.type==='emergency'&&e.date>=start&&e.date<=end);
    const drafts=(window.emergencyDrafts||[]).filter(d=>(d.date||d.dateReceived||'')>=start&&(d.date||d.dateReceived||'')<=end);
    const sessions=(window.onCallSessions||[]).filter(s=>s.date>=start&&s.date<=end);
    return {start,end,closed,drafts,sessions};
  }

  function ensurePeriodCleanupUI(){
    const actions=$('#workflowExportJson')?.closest('.row.gap.wrap');
    if(actions&&!$('#workflowClearPeriodLog')){
      const b=document.createElement('button');
      b.type='button';b.id='workflowClearPeriodLog';b.className='dangerbtn';b.textContent='Clear This Period';
      b.onclick=clearCurrentPeriodEmergencyHistory;
      actions.appendChild(b);
      const card=actions.closest('.card');
      if(card&&!$('#workflowClearPeriodHint')){
        const hint=document.createElement('div');hint.id='workflowClearPeriodHint';hint.className='muted tiny top-space';
        const stats=$('#workflowLogStats');
        if(stats&&stats.parentElement===card)card.insertBefore(hint,stats);else card.appendChild(hint);
      }
    }
    refreshPeriodCleanupUI();
  }

  function refreshPeriodCleanupUI(){
    const b=$('#workflowClearPeriodLog'),hint=$('#workflowClearPeriodHint');if(!b)return;
    const c=periodEmergencyCounts(),locked=!!(window.isPeriodLocked&&window.isPeriodLocked(c.start));
    b.disabled=locked;
    b.title=locked?'Unlock this pay period before deleting emergency history.':'Delete only emergency calls/sessions in the displayed pay period.';
    if(hint)hint.textContent=`Displayed pay period: ${mdy(c.start)} – ${mdy(c.end)} · ${c.closed.length} closed emergency event(s) · ${c.drafts.length} open call(s) · ${c.sessions.length} on-call session(s).`;
  }

  async function clearCurrentPeriodEmergencyHistory(){
    const c=periodEmergencyCounts();
    if(window.isPeriodLocked&&window.isPeriodLocked(c.start))return toast('This pay period is DELIVERED / LOCKED. Unlock it before clearing emergency history.');
    const total=c.closed.length+c.drafts.length+c.sessions.length;
    if(!total)return toast('There is no emergency history to clear in this pay period.');
    const ok=await appConfirm(`Delete emergency test/history data for ${mdy(c.start)} – ${mdy(c.end)}?\n\nThis removes ${c.closed.length} closed emergency event(s), ${c.drafts.length} open call(s), and ${c.sessions.length} on-call session(s) from this period. Their Maintenance Requests and On-Call Summary rows will also disappear.\n\nPayroll/TIME CARD hours, pool/snow/other events, folios configuration, vendors and Knowledge Base are NOT deleted.`,'Clear This Pay Period');
    if(!ok)return;

    const removedDraftIds=new Set(c.drafts.map(d=>d.id));
    events=events.filter(e=>!(e.type==='emergency'&&dateInPeriod(e.date,c.start)));
    window.emergencyDrafts=(window.emergencyDrafts||[]).filter(d=>!dateInPeriod(d.date||d.dateReceived,c.start));
    window.onCallSessions=(window.onCallSessions||[]).filter(s=>!dateInPeriod(s.date,c.start));
    save(K.events,events);
    save(K.emergencyDrafts,window.emergencyDrafts);
    save(K.sessions,window.onCallSessions);
    const activeId=load(K.activeDraft,'');if(activeId&&removedDraftIds.has(activeId))save(K.activeDraft,'');

    renderAll();
    ensurePeriodCleanupUI();
    go('emergencyLog');
    toast(`Emergency history cleared for ${mdy(c.start)} – ${mdy(c.end)}. Payroll and non-emergency events were preserved.`);
  }

  // New Emergency is a live/current workflow. If the app is still displaying an older
  // pay period (for example because no new Humanity PDF has been imported yet), move the
  // workspace to the period containing the emergency date before the call is recorded.
  const baseGoV061=go;
  go=function(id){
    if(id==='emergency'){
      const date=form?.elements?.date?.value||todayISO();
      if(activatePeriodForDate(date))updateDashboard();
    }
    baseGoV061(id);
    if(id==='emergencyLog')ensurePeriodCleanupUI();
  };

  // Safety net: after a live emergency is closed, make the matching pay period current
  // so Maintenance Requests and On-Call Summary immediately show the new record even
  // when no Humanity TIME CARD has been imported for that period yet.
  document.addEventListener('submit',e=>{
    if(!e.target?.matches?.('#fieldEmergencyForm'))return;
    setTimeout(()=>{
      const recent=events.filter(x=>x.type==='emergency'&&x.closedAt).sort((a,b)=>(b.closedAt||'').localeCompare(a.closedAt||''))[0];
      if(!recent)return;
      const age=Date.now()-Date.parse(recent.closedAt);if(!Number.isFinite(age)||age>5000)return;
      if(activatePeriodForDate(recent.date))renderAll();
      else {renderRequests();renderSummary();}
      ensurePeriodCleanupUI();
    },0);
  },false);

  const baseRenderAllV061=renderAll;
  renderAll=function(){baseRenderAllV061();ensurePeriodCleanupUI()};

  ensurePeriodCleanupUI();
})();