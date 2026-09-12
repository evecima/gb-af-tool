/* v0.6.14 — explicit Start Work safety: technician chooses the active call; waiting calls cannot be closed accidentally */
(function(){
  const VERSION='0.6.14';
  const f=$('#fieldEmergencyForm'),root=$('#emergency');
  if(!f||!root||!K.sessions||!K.emergencyDrafts||!K.activeDraft)return;

  const nowISO=()=>new Date().toISOString();
  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=>drafts().filter(d=>d.workflowStatus!=='CLOSED');
  const relevantDrafts=s=>s?openDrafts().filter(d=>d.sessionId===s.id||(!d.sessionId&&d.date===s.date)):[];
  const currentDraftId=()=>load(K.activeDraft,'')||'';
  const currentDraft=()=>openDrafts().find(d=>d.id===currentDraftId())||null;
  const lockedForDate=date=>!!(window.isPeriodLocked&&window.isPeriodLocked(periodForDate(date||todayISO())));
  const saveDrafts=()=>save(K.emergencyDrafts,window.emergencyDrafts||[]);
  const callNo=d=>`#${String(Number(d?.callNumber)||0).padStart(2,'0')}`;

  function explicitActive(s=activeSession()){
    if(!s)return null;
    return relevantDrafts(s).find(d=>d.workSelected===true&&d.workflowStatus==='IN_PROGRESS')||null;
  }

  function normalizeExplicitState(){
    const s=activeSession();let changed=false;
    if(!s){
      for(const d of openDrafts()){
        if(d.workSelected){d.workSelected=false;d.workSelectedAt='';d.workStartCursor='';changed=true}
        if(d.workflowStatus==='IN_PROGRESS'||d.workflowStatus==='WAITING'||d.workflowStatus==='PAUSED'){
          d.workflowStatus='RECEIVED';changed=true;
        }
        if(changed)d.updatedAt=nowISO();
      }
      if(changed)saveDrafts();
      return {s:null,open:[],active:null};
    }

    const rel=relevantDrafts(s);
    for(const d of rel){if(!d.sessionId){d.sessionId=s.id;d.updatedAt=nowISO();changed=true}}
    const marked=rel.filter(d=>d.workSelected===true).sort((a,b)=>String(a.workSelectedAt||'').localeCompare(String(b.workSelectedAt||'')));
    const keeper=marked.length?marked[marked.length-1]:null;
    for(const d of rel){
      if(d===keeper){
        if(d.workflowStatus!=='IN_PROGRESS'){d.workflowStatus='IN_PROGRESS';d.updatedAt=nowISO();changed=true}
      }else{
        if(d.workSelected){d.workSelected=false;d.workSelectedAt='';d.workStartCursor='';changed=true}
        if(d.workflowStatus!=='WAITING'){d.workflowStatus='WAITING';changed=true}
        if(changed)d.updatedAt=nowISO();
      }
    }
    if(changed)saveDrafts();
    return {s,open:rel,active:keeper};
  }

  function ensureStyles(){
    if($('#v014StartWorkStyles'))return;
    const st=document.createElement('style');st.id='v014StartWorkStyles';st.textContent=`
      .workflow-start-work{white-space:nowrap;margin-left:8px}
      .workflow-call.v014-working{border-color:#198754!important;background:#f1fbf4!important;box-shadow:0 0 0 1px rgba(25,135,84,.12)}
      .workflow-call.v014-waiting .workflow-v065-status{background:#fff4df!important;color:#945600!important}
      @media(max-width:640px){.workflow-start-work{padding:7px 9px;font-size:11px}}
    `;document.head.appendChild(st);
  }

  function selectDraftInForm(card,id){
    const resume=card?.querySelector('.workflow-resume')||$(`.workflow-resume[data-id="${id}"]`);
    if(resume){resume.click();return}
    save(K.activeDraft,id);
    go('emergency');
  }

  function startWork(id,card){
    const s=activeSession();if(!s)return toast('Start the On-Call Session before choosing a call to work.');
    if(lockedForDate(s.date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before changing the active emergency.');
    const rel=relevantDrafts(s),d=rel.find(x=>x.id===id);if(!d)return;
    const current=explicitActive(s);
    if(current&&current.id!==d.id)return toast(`${callNo(current)} is already IN PROGRESS. Close that emergency before starting another call.`);
    for(const x of rel){
      const chosen=x.id===d.id;
      x.workSelected=chosen;
      x.workflowStatus=chosen?'IN_PROGRESS':'WAITING';
      if(chosen){x.workSelectedAt=nowISO();x.workStartCursor=s.nextWorkStart||s.in||''}
      else{x.workSelectedAt='';x.workStartCursor=''}
      x.updatedAt=nowISO();
    }
    saveDrafts();
    selectDraftInForm(card,d.id);
    toast(`${callNo(d)} is now IN PROGRESS. Close Emergency will apply only to this call.`);
    setTimeout(refresh,0);setTimeout(refresh,80);
  }

  function enhanceCards(){
    ensureStyles();
    const s=activeSession(),active=explicitActive(s),list=$('#workflowOpenCallList');if(!list)return;
    list.querySelectorAll('.workflow-call').forEach(card=>{
      const id=card.dataset.draftId||card.querySelector('.workflow-resume')?.dataset.id;if(!id)return;
      const d=drafts().find(x=>x.id===id&&x.workflowStatus!=='CLOSED');if(!d)return;
      card.dataset.draftId=id;
      const badge=card.querySelector('.workflow-v065-status');
      const isWorking=!!(s&&active?.id===id);
      card.classList.toggle('v014-working',isWorking);card.classList.toggle('v014-waiting',!!s&&!isWorking);
      if(badge){badge.textContent=s?(isWorking?'IN PROGRESS':'WAITING'):'RECEIVED';badge.className=`workflow-v065-status ${s?(isWorking?'in-progress':'waiting'):'received'}`}
      let b=card.querySelector('.workflow-start-work');
      if(!b){
        b=document.createElement('button');b.type='button';b.className='secondary workflow-start-work';
        const cancel=card.querySelector('.workflow-cancel-call');
        if(cancel)card.insertBefore(b,cancel);else card.appendChild(b);
        b.addEventListener('click',e=>{e.stopPropagation();startWork(b.dataset.id,card)});
      }
      b.dataset.id=id;
      if(!s){b.textContent='Start Work';b.disabled=true;b.title='Start the On-Call Session first.'}
      else if(isWorking){b.textContent='Working';b.disabled=true;b.title='This is the emergency currently being worked.'}
      else if(active){b.textContent='Start Work';b.disabled=true;b.title=`Close ${callNo(active)} before starting another emergency.`}
      else{b.textContent='Start Work';b.disabled=false;b.title='Make this the active emergency. Its IN uses the pending work-start time.'}
    });
  }

  function syncSafetyControls(){
    const {s,open,active}=normalizeExplicitState();
    const d=currentDraft(),isCurrentActive=!!(s&&d&&active&&d.id===active.id),locked=lockedForDate(s?.date||d?.date||todayISO());
    const top=$('#workflowCloseTop'),bottom=f.querySelector('.workflow-close-emergency');
    for(const b of [top,bottom].filter(Boolean)){
      b.disabled=!isCurrentActive||locked;
      b.title=locked?'This pay period is locked.':isCurrentActive?'Close the emergency currently IN PROGRESS.':'Press Start Work on this call before closing it.';
    }
    const out=$('#workflowOutBtn');
    if(out){
      const canOut=!!s&&!locked&&open.length===1&&active?.id===open[0]?.id;
      out.disabled=!canOut;
      out.title=locked?'This pay period is locked.':!s?'Start an On-Call Session first.':open.length>1?`OUT disabled: ${open.length} emergency calls remain open.`:open.length===1&&!active?'Press Start Work on the final emergency before OUT.':canOut?'OUT will close the active final emergency and the On-Call Session together.':'OUT requires one active final emergency.';
    }
    const hint=$('#v070ChainHint');
    if(hint){
      hint.textContent=!s?'Calls remain RECEIVED until you start the On-Call Session.':active?`${callNo(active)} is IN PROGRESS. Close it before starting another call.`:open.length?`${open.length} open call${open.length===1?'':'s'} WAITING · Press Start Work on the emergency you are actually going to handle.`:'No open calls remain in this session.';
    }
  }

  function refresh(){syncSafetyControls();enhanceCards();}

  // Safety gate: a WAITING/RECEIVED call can never be closed accidentally,
  // including a keyboard/form submit that bypasses the visible Close button.
  document.addEventListener('submit',e=>{
    if(e.target!==f)return;
    const s=activeSession(),d=currentDraft(),active=explicitActive(s);
    if(!s||!d||!active||active.id!==d.id){
      e.preventDefault();e.stopImmediatePropagation();
      toast('This call is not IN PROGRESS. Press Start Work on the emergency you are actually handling before closing it.');
      setTimeout(refresh,0);return;
    }
    setTimeout(refresh,80);setTimeout(refresh,180);
  },true);

  document.addEventListener('click',e=>{
    const out=e.target.closest?.('#workflowOutBtn');
    if(out){
      const s=activeSession(),open=s?relevantDrafts(s):[],active=explicitActive(s);
      const allowed=!!s&&open.length===1&&active?.id===open[0]?.id&&!lockedForDate(s.date);
      if(!allowed){e.preventDefault();e.stopImmediatePropagation();toast(open.length===1?'Press Start Work on the final emergency before OUT.':'OUT is available only when one active final emergency remains.');setTimeout(refresh,0);return}
      setTimeout(refresh,100);setTimeout(refresh,220);
    }
    if(e.target.closest?.('#workflowInBtn,#workflowNewCallBtn,.workflow-cancel-call,.workflowCloseTop,.workflow-close-emergency')){
      setTimeout(refresh,30);setTimeout(refresh,120);
    }
  },true);

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:1,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:currentDraftId(),reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
    const hint=$('#v069BackupHint');if(hint)hint.textContent='Full v0.6.14 backup: includes Payroll, events, open calls, explicit Start Work state, On-Call sessions and the pending work-start cursor, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings.';
  }

  const baseRenderAll=renderAll;
  renderAll=function(){baseRenderAll();setTimeout(refresh,0);installBackupExport()};
  const baseGo=go;
  go=function(id){baseGo(id);if(id==='emergency'){setTimeout(refresh,0);setTimeout(refresh,80)}installBackupExport()};

  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})}).observe(root,{subtree:true,childList:true});

  refresh();setTimeout(refresh,80);setTimeout(refresh,180);installBackupExport();
})();
