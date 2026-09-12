/* v0.6.12 — clean idle Emergency screen: hide the detail form until a call is created or selected */
(function(){
  const VERSION='0.6.12';
  const form=$('#fieldEmergencyForm');
  const emergency=$('#emergency');
  if(!form||!emergency||!K.emergencyDrafts||!K.activeDraft)return;

  function activeOpenDraft(){
    const id=load(K.activeDraft,'')||'';
    if(!id)return null;
    return (window.emergencyDrafts||[]).find(d=>d.id===id&&d.workflowStatus!=='CLOSED')||null;
  }

  function syncEmergencyFormVisibility(){
    const active=!!activeOpenDraft();
    form.classList.toggle('hidden',!active);
    form.setAttribute('aria-hidden',active?'false':'true');
  }

  function namespacedStorage(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key);
    }
    return out;
  }

  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={
        kind:'oncall-maintenance-backup',version:VERSION,schema:1,exportedAt:new Date().toISOString(),
        settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),
        problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),
        periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),
        activeDraftId:load(K.activeDraft,'')||'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),storage:namespacedStorage()
      };
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{
        const file=new File([blob],name,{type});
        if(navigator.canShare?.({files:[file]})){
          try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}
        }
      }catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
    const hint=$('#v069BackupHint');
    if(hint)hint.textContent='Full v0.6.12 backup: includes Payroll, events, open calls, On-Call sessions and the work-segment cursor, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings. Import replaces destination-device local data; it does not merge records.';
  }

  // Keep the form state aligned with the active draft after every major render/navigation.
  const baseRenderAllV072=renderAll;
  renderAll=function(){baseRenderAllV072();syncEmergencyFormVisibility();installBackupExport()};

  const baseGoV072=go;
  go=function(id){baseGoV072(id);if(id==='emergency')setTimeout(syncEmergencyFormVisibility,0);installBackupExport()};

  // New-call, card-selection and close actions already mutate the emergency area.
  // Observe those UI changes so the form appears/disappears immediately without a new button or extra step.
  let queued=false;
  new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;syncEmergencyFormVisibility()});
  }).observe(emergency,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  emergency.addEventListener('click',e=>{
    if(e.target.closest('#workflowNewCallBtn,.workflow-call,#workflowCloseTop,.workflow-close-emergency,#workflowOutBtn')){
      setTimeout(syncEmergencyFormVisibility,0);
      setTimeout(syncEmergencyFormVisibility,80);
    }
  },true);

  syncEmergencyFormVisibility();installBackupExport();
})();
