/* v0.6.11 — On-Call Log entry fix: prevent legacy full-history render from overwriting filtered view */
(function(){
  const VERSION='0.6.11';

  function fixLogCard(){
    const card=$('#workflowLogCard');
    if(!card)return;
    // The original v0.6.0 card handler called go('emergencyLog') and then
    // renderEmergencyLog(), which repainted the list with the legacy all-history
    // view after the newer pay-period filter had already rendered correctly.
    // Route only through go(); the later wrappers own the canonical filtered log.
    card.onclick=()=>go('emergencyLog');
    card.dataset.logEntryFix='1';
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
    if(hint)hint.textContent='Full v0.6.11 backup: includes Payroll, events, open calls, On-Call sessions and the work-segment cursor, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings. Import replaces destination-device local data; it does not merge records.';
  }

  const baseUpdateDashboardV071=updateDashboard;
  updateDashboard=function(){baseUpdateDashboardV071();fixLogCard();installBackupExport()};

  const baseRenderAllV071=renderAll;
  renderAll=function(){baseRenderAllV071();fixLogCard();installBackupExport()};

  const baseGoV071=go;
  go=function(id){baseGoV071(id);if(id==='dashboard')fixLogCard();installBackupExport()};

  fixLogCard();installBackupExport();
})();
