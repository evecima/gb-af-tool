/* v0.6.13 compatibility — field workflow: clickable calls, autosave-first editing, final-call OUT guard, single close action */
(function(){
  const f=$('#fieldEmergencyForm');
  if(!f||!K.emergencyDrafts||!K.activeDraft)return;

  const nowISO=()=>new Date().toISOString();
  const activeSession=()=>[...(window.onCallSessions||[])].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=> (window.emergencyDrafts||[]).filter(d=>d.workflowStatus!=='CLOSED').sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const currentDraftId=()=>load(K.activeDraft,'')||'';
  const currentDraft=()=>openDrafts().find(d=>d.id===currentDraftId())||null;
  const lockedForDate=date=>!!(window.isPeriodLocked&&window.isPeriodLocked(periodForDate(date||todayISO())));
  const saveDrafts=()=>save(K.emergencyDrafts,window.emergencyDrafts||[]);

  function injectStyles(){
    if($('#v065FieldStyles'))return;
    const s=document.createElement('style');s.id='v065FieldStyles';s.textContent=`
      #workflowClearDraft,.workflow-resume{display:none!important}
      .workflow-call{cursor:pointer;transition:box-shadow .12s ease,border-color .12s ease,background .12s ease}
      .workflow-call:hover{box-shadow:0 2px 8px rgba(18,97,160,.12)}
      .workflow-call:focus{outline:2px solid #1261a0;outline-offset:2px}
      .workflow-call.selected{border-color:#1261a0;background:#f4f9fd}
      .workflow-v065-status{display:inline-block;margin-top:5px;font-size:10px;font-weight:800;letter-spacing:.02em;border-radius:999px;padding:3px 7px;background:#eef3f6;color:#43515d}
      .workflow-v065-status.in-progress{background:#e7f6ec;color:#147a38}
      .workflow-v065-status.waiting{background:#fff4df;color:#945600}
      .workflow-v065-status.received{background:#eaf3fb;color:#125f96}
      .workflow-v065-status.paused{background:#f1edf9;color:#68449a}
      #workflowCloseTop{white-space:nowrap}
    `;document.head.appendChild(s);
  }

  function relevantDrafts(s=activeSession()){
    if(!s)return openDrafts();
    return openDrafts().filter(d=>d.sessionId===s.id||(!d.sessionId&&d.date===s.date));
  }

  function normalizeStatuses(){
    const s=activeSession(),ds=openDrafts();let changed=false,progress=null;
    if(!s){
      for(const d of ds){
        if(d.workflowStatus==='IN_PROGRESS'||d.workflowStatus==='WAITING'){
          d.workflowStatus='RECEIVED';d.updatedAt=nowISO();changed=true;
        }
      }
    }else{
      const candidates=ds.filter(d=>d.sessionId===s.id||(!d.sessionId&&d.date===s.date));
      for(const d of candidates){if(!d.sessionId){d.sessionId=s.id;d.updatedAt=nowISO();changed=true}}
      progress=candidates.find(d=>d.workflowStatus==='IN_PROGRESS')||candidates.find(d=>d.workflowStatus!=='PAUSED')||null;
      for(const d of candidates){
        const desired=d===progress?'IN_PROGRESS':d.workflowStatus==='PAUSED'?'PAUSED':'WAITING';
        if(d.workflowStatus!==desired){d.workflowStatus=desired;d.updatedAt=nowISO();changed=true}
      }
    }
    if(changed)saveDrafts();
    return progress;
  }

  function statusLabel(d){
    const v=d?.workflowStatus||'RECEIVED';
    if(v==='IN_PROGRESS')return['IN PROGRESS','in-progress'];
    if(v==='WAITING')return['WAITING','waiting'];
    if(v==='PAUSED')return['PAUSED','paused'];
    return['RECEIVED','received'];
  }

  function selectDraftByCard(id){
    const resume=$(`.workflow-resume[data-id="${id}"]`);
    if(resume){resume.click();setTimeout(enhanceAll,0)}
  }

  function enhanceOpenCalls(){
    const list=$('#workflowOpenCallList');if(!list)return;
    list.querySelectorAll('.workflow-call').forEach(card=>{
      const resume=card.querySelector('.workflow-resume'),id=resume?.dataset.id;if(!id)return;
      const d=(window.emergencyDrafts||[]).find(x=>x.id===id);if(!d)return;
      resume.setAttribute('aria-hidden','true');resume.tabIndex=-1;
      let badge=card.querySelector('.workflow-v065-status');
      if(!badge){badge=document.createElement('span');badge.className='workflow-v065-status';card.querySelector('.item-title')?.insertAdjacentElement('afterend',badge)}
      const [label,cls]=statusLabel(d);badge.textContent=label;badge.className=`workflow-v065-status ${cls}`;
      card.dataset.draftId=id;card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Open ${card.querySelector('.item-title')?.textContent||'emergency call'}`);
      if(card.dataset.v065Clickable!=='1'){
        card.dataset.v065Clickable='1';
        card.addEventListener('click',e=>{if(e.target.closest('button'))return;selectDraftByCard(card.dataset.draftId)});
        card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectDraftByCard(card.dataset.draftId)}});
      }
    });
  }

  function enhanceDraftHeader(){
    $('#workflowClearDraft')?.remove();
    const box=$('#workflowDraftStatus'),d=currentDraft();if(!box||!d)return;
    const row=box.querySelector('.row')||box;
    let close=$('#workflowCloseTop');
    if(!close){close=document.createElement('button');close.type='button';close.id='workflowCloseTop';close.className='primary';close.textContent='Close Emergency';close.onclick=()=>f.requestSubmit();row.appendChild(close)}
    const bottom=f.querySelector('.workflow-close-emergency');
    if(bottom){const wrap=bottom.parentElement;if(wrap)wrap.style.display='none';else bottom.style.display='none'}
  }

  function syncSessionControls(){
    const s=activeSession(),ds=openDrafts(),date=s?.date||f.elements.date?.value||todayISO(),locked=lockedForDate(date);
    const inBtn=$('#workflowInBtn'),outBtn=$('#workflowOutBtn');
    if(inBtn){
      inBtn.disabled=!!s||locked||ds.length===0;
      inBtn.title=!s&&ds.length===0?'Create or receive an emergency call first.':locked?'This pay period is locked.':'';
    }
    if(outBtn){
      const stillOpen=s?relevantDrafts(s).length:0;
      // v0.6.10+ rule: OUT is intentionally available when exactly one final
      // emergency remains. Newer workflow code owns the actual OUT action.
      outBtn.disabled=!s||locked||stillOpen!==1;
      outBtn.title=locked?'This pay period is locked.':!s?'Start an On-Call Session first.':stillOpen===1?'OUT can close the final emergency and the On-Call Session together.':stillOpen>1?`OUT disabled: ${stillOpen} emergency calls remain open.`:'OUT requires one final open emergency.';
    }
  }

  function enhanceAll(){injectStyles();enhanceOpenCalls();enhanceDraftHeader();syncSessionControls()}

  function wrapSessionButtons(){
    const inBtn=$('#workflowInBtn');
    if(inBtn&&inBtn.dataset.v065Wrapped!=='1'){
      inBtn.dataset.v065Wrapped='1';const base=inBtn.onclick;
      inBtn.onclick=async e=>{
        if(!openDrafts().length){toast('Create or receive an emergency call before starting the On-Call Session.');syncSessionControls();return}
        if(base)await base.call(inBtn,e);
        const progress=normalizeStatuses();enhanceAll();
        if(progress)setTimeout(()=>selectDraftByCard(progress.id),0);
      };
    }
    const outBtn=$('#workflowOutBtn');
    if(outBtn&&outBtn.dataset.v065Wrapped!=='1'){
      inBtn;
      outBtn.dataset.v065Wrapped='1';const base=outBtn.onclick;
      outBtn.onclick=async e=>{
        const s=activeSession(),stillOpen=s?relevantDrafts(s):[];
        if(stillOpen.length>1){toast(`${stillOpen.length} emergency call(s) are still open. Close another emergency before OUT.`);syncSessionControls();return}
        if(base)await base.call(outBtn,e);normalizeStatuses();enhanceAll();
      };
    }
  }

  function wrapNewCall(){
    const b=$('#workflowNewCallBtn');if(!b||b.dataset.v065Wrapped==='1')return;
    b.dataset.v065Wrapped='1';const base=b.onclick;
    b.onclick=e=>{
      const before=new Set(openDrafts().map(d=>d.id));if(base)base.call(b,e);
      const d=openDrafts().find(x=>!before.has(x.id))||currentDraft();if(!d){enhanceAll();return}
      const s=activeSession();
      if(s){d.sessionId=d.sessionId||s.id;const otherProgress=openDrafts().find(x=>x.id!==d.id&&x.sessionId===s.id&&x.workflowStatus==='IN_PROGRESS');d.workflowStatus=otherProgress?'WAITING':'IN_PROGRESS'}
      else d.workflowStatus='RECEIVED';
      d.updatedAt=nowISO();saveDrafts();enhanceAll();
    };
  }

  function promoteAndSelectAfterClose(){
    const s=activeSession();if(!s){normalizeStatuses();enhanceAll();return}
    const progress=normalizeStatuses();enhanceAll();
    if(progress&&!currentDraftId())setTimeout(()=>selectDraftByCard(progress.id),0);
  }

  f.addEventListener('submit',()=>setTimeout(promoteAndSelectAfterClose,40));

  function updateBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=()=>{
      const data={version:'0.6.5',settings,currentPeriodStart,payrollStore,snapshots,events,problems,folioStarts,localKnowledge,vendors,periodStatuses:window.periodStatuses||{},onCallSessions:window.onCallSessions||[],emergencyDrafts:window.emergencyDrafts||[],activeDraftId:currentDraftId()};
      const text=JSON.stringify(data,null,2),blob=new Blob([text],{type:'application/json'}),name='oncall-maintenance-v0.6.5-backup.json';
      try{const file=new File([blob],name,{type:'application/json'});if(navigator.canShare?.({files:[file]})){navigator.share({files:[file],title:name}).catch(()=>{});return}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
  }

  wrapSessionButtons();wrapNewCall();normalizeStatuses();enhanceAll();updateBackupExport();

  const root=$('#emergency');
  if(root){
    let queued=false;
    new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;wrapSessionButtons();wrapNewCall();enhanceAll()})}).observe(root,{subtree:true,childList:true});
  }
})();
