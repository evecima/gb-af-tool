/* v0.6.16 — IN-first workflow: Start Work is a field decision only after the On-Call Session has begun */
(function(){
  const VERSION='0.6.16';
  const root=$('#emergency');
  if(!root||!K.sessions||!K.emergencyDrafts)return;

  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=>drafts().filter(d=>d.workflowStatus!=='CLOSED');
  const relevantDrafts=s=>s?openDrafts().filter(d=>d.sessionId===s.id||(!d.sessionId&&d.date===s.date)):[];
  const explicitActive=s=>s?relevantDrafts(s).find(d=>d.workSelected===true&&d.workflowStatus==='IN_PROGRESS')||null:null;
  const nowISO=()=>new Date().toISOString();

  function syncStartWorkGate(){
    const s=activeSession(),active=explicitActive(s),list=$('#workflowOpenCallList');
    if(list){
      list.querySelectorAll('.workflow-call').forEach(card=>{
        const id=card.dataset.draftId||card.querySelector('.workflow-resume')?.dataset.id;
        const d=id?drafts().find(x=>x.id===id&&x.workflowStatus!=='CLOSED'):null;
        const b=card.querySelector('.workflow-start-work');
        if(!d||!b)return;
        const isActive=!!(s&&active?.id===d.id);
        if(!s){
          b.textContent=settings.language==='es'?'IN requerido':'IN Required';
          b.disabled=true;
          b.title=settings.language==='es'?'Primero pulsa IN para iniciar la sesión On-Call. Después elige la emergencia con Start Work.':'Press IN first to start the On-Call Session. Then choose the emergency with Start Work.';
          b.setAttribute('aria-disabled','true');
        }else if(isActive){
          b.textContent=settings.language==='es'?'Trabajando':'Working';
          b.disabled=true;
          b.title=settings.language==='es'?'Esta es la emergencia actualmente en trabajo.':'This is the emergency currently being worked.';
          b.setAttribute('aria-disabled','true');
        }else if(active){
          b.textContent='Start Work';
          b.disabled=true;
          b.title=settings.language==='es'?'Cierra primero la emergencia que está IN PROGRESS.':'Close the emergency currently IN PROGRESS before starting another call.';
          b.setAttribute('aria-disabled','true');
        }else{
          b.textContent='Start Work';
          b.disabled=false;
          b.title=settings.language==='es'?'Selecciona esta emergencia como el trabajo activo.':'Make this the active emergency.';
          b.setAttribute('aria-disabled','false');
        }
      });
    }

    const hint=$('#v070ChainHint');
    if(hint&&!s&&openDrafts().length){
      hint.textContent=settings.language==='es'?'Primero pulsa IN para iniciar la sesión On-Call. Después elige con Start Work cuál emergencia atenderás primero.':'Press IN first to start the On-Call Session. Then use Start Work to choose which emergency you will handle first.';
    }
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
        kind:'oncall-maintenance-backup',version:VERSION,schema:1,exportedAt:nowISO(),
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
    if(hint)hint.textContent='Full v0.6.16 backup: includes Payroll, events, open calls, explicit Start Work state, On-Call sessions and pending work-start cursor, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings.';
  }

  const baseRenderAllV016=renderAll;
  renderAll=function(){baseRenderAllV016();setTimeout(syncStartWorkGate,0);installBackupExport()};

  const baseGoV016=go;
  go=function(id){baseGoV016(id);if(id==='emergency'){setTimeout(syncStartWorkGate,0);setTimeout(syncStartWorkGate,80)}installBackupExport()};

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#workflowInBtn,#workflowNewCallBtn,.workflow-start-work,.workflow-card-close,.workflow-cancel-call')){
      setTimeout(syncStartWorkGate,30);setTimeout(syncStartWorkGate,120);
    }
  },true);

  let queued=false;
  new MutationObserver(()=>{
    if(queued)return;queued=true;
    requestAnimationFrame(()=>{queued=false;syncStartWorkGate()});
  }).observe(root,{subtree:true,childList:true});

  syncStartWorkGate();installBackupExport();
})();
