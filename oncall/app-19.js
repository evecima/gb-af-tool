/* v0.6.6 — persistent call numbers + safe call cancellation / paid-response outcomes */
(function(){
  const f=$('#fieldEmergencyForm');
  if(!f||!K.emergencyDrafts||!K.sessions)return;

  const CANCEL_AFTER_START='Canceled After Response Began';
  const NO_SHOW='Resident Not Available / No Show';
  const nowISO=()=>new Date().toISOString();
  const drafts=()=>window.emergencyDrafts||[];
  const openDrafts=()=>drafts().filter(d=>d.workflowStatus!=='CLOSED').sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  const sessions=()=>window.onCallSessions||[];
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const sessionById=id=>sessions().find(s=>s.id===id)||null;
  const currentDraftId=()=>load(K.activeDraft,'')||'';
  const lockedForDate=date=>!!(window.isPeriodLocked&&window.isPeriodLocked(periodForDate(date||todayISO())));
  const saveDrafts=()=>save(K.emergencyDrafts,drafts());
  const saveSessions=()=>save(K.sessions,sessions());
  const padCall=n=>String(n||0).padStart(2,'0');

  function ensureStyles(){
    if($('#v066Styles'))return;
    const s=document.createElement('style');s.id='v066Styles';s.textContent=`
      .workflow-cancel-call{margin-left:auto;white-space:nowrap}
      .workflow-call-main{min-width:0;flex:1}
      .workflow-call .workflow-resume{display:none!important}
      @media(max-width:640px){.workflow-cancel-call{padding:7px 9px;font-size:11px}}
    `;document.head.appendChild(s);
  }

  function maxNumberForSession(sessionId){
    let m=0;
    for(const d of drafts())if(d.sessionId===sessionId&&Number(d.callNumber)>m)m=Number(d.callNumber);
    for(const e of events||[])if(e.sessionId===sessionId&&Number(e.callNumber)>m)m=Number(e.callNumber);
    const s=sessionById(sessionId);if(s&&Number(s.callSeq)>m)m=Number(s.callSeq);
    return m;
  }

  function assignNumber(d){
    if(!d||Number(d.callNumber)>0)return false;
    if(d.sessionId){
      const s=sessionById(d.sessionId);
      const next=maxNumberForSession(d.sessionId)+1;
      d.callNumber=next;
      if(s){s.callSeq=Math.max(Number(s.callSeq)||0,next);s.updatedAt=nowISO();}
    }else{
      const same=drafts().filter(x=>x.id!==d.id&&!x.sessionId&&x.workflowStatus!=='CLOSED'&&(x.date||'')===(d.date||'')&&Number(x.callNumber)>0);
      d.callNumber=Math.max(0,...same.map(x=>Number(x.callNumber)||0))+1;
    }
    d.updatedAt=nowISO();return true;
  }

  function syncNumbers(){
    let dChanged=false,sChanged=false;
    for(const d of openDrafts())if(assignNumber(d))dChanged=true;
    for(const s of sessions()){
      const m=Math.max(Number(s.callSeq)||0,...drafts().filter(d=>d.sessionId===s.id).map(d=>Number(d.callNumber)||0),...events.filter(e=>e.sessionId===s.id).map(e=>Number(e.callNumber)||0));
      if((Number(s.callSeq)||0)!==m){s.callSeq=m;s.updatedAt=nowISO();sChanged=true}
    }
    if(dChanged)saveDrafts();if(sChanged)saveSessions();
  }

  function ensureOutcomeOptions(){
    const forms=[f,$('#eventEditorForm')].filter(Boolean);
    for(const form of forms){
      const sel=form.elements?.closeOutcome;if(!sel)continue;
      for(const value of [CANCEL_AFTER_START,NO_SHOW]){
        if(![...sel.options].some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=value;sel.appendChild(o)}
      }
      if(sel.dataset.v066Outcome!=='1'){
        sel.dataset.v066Outcome='1';
        sel.addEventListener('change',()=>setTimeout(()=>{
          const special=[CANCEL_AFTER_START,NO_SHOW].includes(sel.value);
          const follow=form===f?$('#workflowFollowupFields'):$('#workflowEditFollowup');
          if(special)follow?.classList.add('hidden');
        },0));
      }
    }
  }

  function rewriteCallNumber(card,d){
    const title=card.querySelector('.item-title');if(!title||!d?.callNumber)return;
    title.textContent=title.textContent.replace(/^#\d+\s*·/,`#${padCall(d.callNumber)} ·`);
  }

  function selectDraft(id){
    const card=$(`.workflow-call[data-draft-id="${id}"]`);
    if(card){card.click();return true}
    return false;
  }

  async function removeUnstartedCall(d){
    const label=`#${padCall(d.callNumber)} · ${(d.problem||'Emergency').replace(/Emergency\s*[–-]\s*Details Pending/i,'Emergency')} · ${d._locationSearch||d.locationCode||d.manualLocation||'Location pending'}`;
    if(!await appConfirm(`Cancel ${label}? This call will be removed and will NOT create a Maintenance Request or On-Call Summary entry.`,'Cancel Emergency Call'))return;
    window.emergencyDrafts=drafts().filter(x=>x.id!==d.id);saveDrafts();
    if(currentDraftId()===d.id){const next=openDrafts().find(x=>x.workflowStatus==='IN_PROGRESS')||openDrafts()[0]||null;save(K.activeDraft,next?.id||'')}
    go('emergency');setTimeout(enhanceAll,0);
  }

  async function cancelStartedCall(d){
    const label=`#${padCall(d.callNumber)} · ${(d.problem||'Emergency').replace(/Emergency\s*[–-]\s*Details Pending/i,'Emergency')} · ${d._locationSearch||d.locationCode||d.manualLocation||'Location pending'}`;
    if(!await appConfirm(`${label} is already IN PROGRESS. The response time remains paid/reportable. Mark this emergency as “Canceled After Response Began” and close the call? The On-Call Session will remain open until you return and press OUT.`,'Cancel Active Emergency'))return;
    if(currentDraftId()!==d.id){selectDraft(d.id);await new Promise(r=>setTimeout(r,0))}
    ensureOutcomeOptions();
    const sel=f.elements.closeOutcome;if(sel)sel.value=CANCEL_AFTER_START;
    if(f.elements.status)f.elements.status.value='Not Complete';
    if(f.elements.remarks&&!f.elements.remarks.value.trim())f.elements.remarks.value='Emergency was canceled after technician response had already begun.';
    ['change','input'].forEach(type=>f.dispatchEvent(new Event(type,{bubbles:true})));
    f.requestSubmit();
  }

  async function cancelCall(id){
    const d=drafts().find(x=>x.id===id&&x.workflowStatus!=='CLOSED');if(!d)return;
    if(lockedForDate(d.date))return toast('This pay period is DELIVERED / LOCKED. Unlock it before canceling a call.');
    const s=activeSession(),started=!!(s&&d.sessionId===s.id&&['IN_PROGRESS','PAUSED'].includes(d.workflowStatus));
    if(started)return cancelStartedCall(d);
    return removeUnstartedCall(d);
  }

  function enhanceCards(){
    syncNumbers();
    const list=$('#workflowOpenCallList');if(!list)return;
    list.querySelectorAll('.workflow-call').forEach(card=>{
      const id=card.dataset.draftId||card.querySelector('.workflow-resume')?.dataset.id;if(!id)return;
      const d=drafts().find(x=>x.id===id);if(!d)return;
      card.dataset.draftId=id;rewriteCallNumber(card,d);
      const first=card.firstElementChild;if(first)first.classList.add('workflow-call-main');
      let b=card.querySelector('.workflow-cancel-call');
      if(!b){b=document.createElement('button');b.type='button';b.className='dangerbtn workflow-cancel-call';b.textContent='Cancel';b.dataset.id=id;b.onclick=e=>{e.stopPropagation();cancelCall(b.dataset.id)};card.appendChild(b)}
      b.dataset.id=id;
    });
  }

  function captureCallNumberOnClose(){
    const id=currentDraftId(),d=drafts().find(x=>x.id===id);if(!d)return;
    const meta={callNumber:d.callNumber||0,sessionId:d.sessionId||'',date:d.date||'',problem:d.problem||'',captured:Date.now()};
    setTimeout(()=>{
      const candidates=events.filter(e=>!e.callNumber&&e.type==='emergency'&&(!meta.sessionId||e.sessionId===meta.sessionId)&&(!meta.date||e.date===meta.date));
      const ev=candidates[candidates.length-1];if(ev&&meta.callNumber){ev.callNumber=meta.callNumber;save(K.events,events)}
      syncNumbers();enhanceCards();
    },80);
  }

  f.addEventListener('submit',captureCallNumberOnClose,true);

  function updateBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=()=>{
      syncNumbers();
      const data={version:'0.6.6',settings,currentPeriodStart,payrollStore,snapshots,events,problems,folioStarts,localKnowledge,vendors,periodStatuses:window.periodStatuses||{},onCallSessions:window.onCallSessions||[],emergencyDrafts:window.emergencyDrafts||[],activeDraftId:currentDraftId()};
      const text=JSON.stringify(data,null,2),blob=new Blob([text],{type:'application/json'}),name='oncall-maintenance-v0.6.6-backup.json';
      try{const file=new File([blob],name,{type:'application/json'});if(navigator.canShare?.({files:[file]})){navigator.share({files:[file],title:name}).catch(()=>{});return}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
  }

  function enhanceAll(){ensureStyles();ensureOutcomeOptions();enhanceCards();updateBackupExport()}

  enhanceAll();
  const root=$('#emergency');if(root){let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;enhanceAll()})}).observe(root,{subtree:true,childList:true})}
})();
