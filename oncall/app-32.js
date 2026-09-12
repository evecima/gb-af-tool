/* v0.7.1 — Reportable Work reliability patch: retry emergency handoff and resume Snow after a Mandatory boundary overrun */
(function(){
  if(!K.reportableWork)return;
  const nowISO=()=>new Date().toISOString();
  const getState=()=>window.reportableWorkState||load(K.reportableWork,{version:1,activities:[],activeId:''});
  const persist=st=>{save(K.reportableWork,st);window.reportableWorkState=st};
  const after=(a,b)=>a&&b&&mins(a)>mins(b);
  const drafts=()=>window.emergencyDrafts||[];
  const activeEmergency=()=>drafts().find(d=>d.workflowStatus!=='CLOSED'&&d.workSelected===true&&d.workflowStatus==='IN_PROGRESS')||null;

  function addEmergencySegment(a,ev){
    const start=a.pauseStartedAt||ev.in,end=ev.out,loc=ev.locationCode||ev.manualLocation||ev.fullAddress||'';
    const exists=(a.segments||[]).some(s=>s.kind==='emergency'&&s.refEventId===ev.id);
    if(!exists)(a.segments??=[]).push({kind:'emergency',start,end,label:ev.problem||'Emergency',location:loc,refEventId:ev.id});
    a.resumeCursor=end;a.resumeEligible=true;a.lastEmergencyEventId=ev.id;a.pausedByEmergencyDraftId='';a.updatedAt=nowISO();
    ev.suppressStandaloneReport=true;ev.groupedReportableWorkId=a.id;ev.requestNumber='';
  }

  function createSnowResumeCandidate(st,mandatory,ev){
    const exists=st.activities.find(x=>x.sourceMandatoryId===mandatory.id&&x.sourceEmergencyId===ev.id&&x.status!=='CLOSED');
    if(exists){st.activeId=exists.id;return exists}
    const snow={id:uid('rw'),type:'snow',date:mandatory.date,workerId:workerId(),worker:workerName(),status:'PAUSED',start:ev.out,end:'',createdAt:nowISO(),updatedAt:nowISO(),plannedStart:'',plannedEnd:'',plannedHours:0,skipLunch:false,currentSegmentStart:'',currentLabel:'Snow Removal',currentLocation:mandatory.currentLocation||'Property / Grounds',segments:[],pausedByEmergencyDraftId:'',pauseStartedAt:'',resumeCursor:ev.out,resumeEligible:true,lastEmergencyEventId:ev.id,parentEventId:'',sourceMandatoryId:mandatory.id,sourceEmergencyId:ev.id};
    st.activities.push(snow);st.activeId=snow.id;return snow;
  }

  function auditClosedEmergency(draftId){
    if(!draftId)return false;
    const ev=[...events].reverse().find(e=>e.type==='emergency'&&e.draftId===draftId&&e.out);if(!ev)return false;
    const st=getState();
    let a=st.activities.find(x=>x.status==='PAUSED'&&x.pausedByEmergencyDraftId===draftId);
    if(a){
      const start=a.pauseStartedAt||ev.in;
      if(a.type==='mandatory_ot'&&a.plannedEnd&&after(ev.out,a.plannedEnd)){
        ev.suppressStandaloneReport=false;ev.groupedReportableWorkId='';
        a.resumeEligible=false;a.pausedByEmergencyDraftId='';a.resumeCursor='';a.end=start;a.status='CLOSED';a.updatedAt=nowISO();
        if(st.activeId===a.id)st.activeId='';
        if(a.currentLabel==='Snow Removal')createSnowResumeCandidate(st,a,ev);
      }else addEmergencySegment(a,ev);
      persist(st);save(K.events,events);renderAll();return true;
    }

    // app-31 may already have completed the Mandatory-overrun decision. In that case,
    // recover the real-world Snow workflow: the emergency ends, then Snow can resume.
    const mandatory=[...st.activities].reverse().find(x=>x.type==='mandatory_ot'&&x.status==='CLOSED'&&x.currentLabel==='Snow Removal'&&x.end===ev.in&&x.plannedEnd&&after(ev.out,x.plannedEnd));
    if(mandatory&&!st.activities.some(x=>x.sourceMandatoryId===mandatory.id&&x.sourceEmergencyId===ev.id)){
      createSnowResumeCandidate(st,mandatory,ev);persist(st);renderAll();return true;
    }
    return false;
  }

  function scheduleAudit(id){[180,420,850,1400].forEach(ms=>setTimeout(()=>auditClosedEmergency(id),ms))}
  document.addEventListener('click',e=>{
    if(!e.target.closest?.('.workflow-card-close,#workflowOutBtn'))return;
    const em=activeEmergency();if(em?.id)scheduleAudit(em.id);
  },true);
  document.addEventListener('submit',e=>{
    if(e.target!==$('#fieldEmergencyForm'))return;
    const em=activeEmergency();if(em?.id)scheduleAudit(em.id);
  },true);
})();
