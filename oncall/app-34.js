/* v0.7.3 — keep Reportable Work History synchronized with Maintenance Request deletion */
(function(){
  const VERSION='0.7.3';
  if(!K.reportableWork)return;

  const getState=()=>window.reportableWorkState||load(K.reportableWork,{version:1,activities:[],activeId:''});
  const persist=st=>{save(K.reportableWork,st);window.reportableWorkState=st};

  function releaseGroupedEmergencies(activity){
    if(!activity)return;
    for(const seg of activity.segments||[]){
      if(seg.kind!=='emergency'||!seg.refEventId)continue;
      const ev=events.find(e=>e.id===seg.refEventId);if(!ev)continue;
      ev.suppressStandaloneReport=false;
      ev.groupedReportableWorkId='';
    }
  }

  function removeLinkedActivityForEvent(eventId){
    const st=getState();
    const activity=st.activities.find(a=>a.parentEventId===eventId||a.id===events.find(e=>e.id===eventId)?.reportableWorkId);
    if(!activity)return false;
    releaseGroupedEmergencies(activity);
    st.activities=st.activities.filter(a=>a.id!==activity.id);
    if(st.activeId===activity.id)st.activeId='';
    persist(st);
    return true;
  }

  function cleanupOrphanedClosedActivities(){
    const st=getState();let changed=false;
    const kept=[];
    for(const a of st.activities||[]){
      const orphan=a.status==='CLOSED'&&a.parentEventId&&!events.some(e=>e.id===a.parentEventId);
      if(orphan){releaseGroupedEmergencies(a);if(st.activeId===a.id)st.activeId='';changed=true;continue}
      kept.push(a);
    }
    if(changed){st.activities=kept;persist(st);save(K.events,events)}
    return changed;
  }

  // Replace the Maintenance Request delete path so a generated Reportable Work
  // record and its timeline are deleted together. Payroll hours remain untouched.
  deleteEvent=async function(id){
    const e=events.find(x=>x.id===id);if(!e)return;
    const st=getState(),linked=st.activities.find(a=>a.parentEventId===id||a.id===e.reportableWorkId);
    const extra=linked?' Its linked Reportable Work History record will also be removed.':'';
    if(!await appConfirm(`Delete ${eventLabel(e)}? This removes its Maintenance Request and On-Call Summary row.${extra} Payroll hours will not change.`,'Delete Event'))return;
    if(linked){releaseGroupedEmergencies(linked);st.activities=st.activities.filter(a=>a.id!==linked.id);if(st.activeId===linked.id)st.activeId='';persist(st)}
    events=events.filter(x=>x.id!==id);save(K.events,events);renderAll();
    toast(linked?'Maintenance Request and linked Reportable Work History deleted.':'Event deleted. Payroll hours were not changed.');
  };

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:2,exportedAt:new Date().toISOString(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:load(K.activeDraft,'')||'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(getState()),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download=name;x.click();setTimeout(()=>URL.revokeObjectURL(x.href),1500);
    };
  }

  const baseRenderAllV073=renderAll;
  renderAll=function(){cleanupOrphanedClosedActivities();baseRenderAllV073();installBackupExport()};

  cleanupOrphanedClosedActivities();
  installBackupExport();
})();
