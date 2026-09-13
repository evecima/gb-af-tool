/* v0.7.4 — emergency close guard: preserve first OUT attempt, warn on missing Title/Location, never leave Cancel half-applied */
(function(){
  const VERSION='0.7.4';
  const f=$('#fieldEmergencyForm');
  if(!f||!K.emergencyDrafts||!K.sessions)return;

  const CANCEL_AFTER_START='Canceled After Response Began';
  const TITLE_PENDING='Emergency — Title Pending';
  const LOCATION_PENDING='Location Pending';
  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const drafts=()=>window.emergencyDrafts||[];
  const currentDraftId=()=>load(K.activeDraft,'')||'';
  const currentDraft=()=>drafts().find(d=>d.id===currentDraftId()&&d.workflowStatus!=='CLOSED')||null;
  const saveDrafts=()=>save(K.emergencyDrafts,window.emergencyDrafts||[]);
  const saveSessions=()=>save(K.sessions,window.onCallSessions||[]);

  // Immediate canonical spelling fix for the title observed in the field.
  // A full editable Emergency Types catalog is a separate planned feature.
  (function canonicalizeKnownTitle(){
    const wanted='Refrigerator Not Working';
    const i=problems.findIndex(p=>String(p).trim().toLowerCase()===wanted.toLowerCase());
    if(i>=0&&problems[i]!==wanted){problems[i]=wanted;save(K.problems,problems);if(typeof refreshProblems==='function')refreshProblems()}
  })();

  function criticalFromForm(){
    const title=(f.elements.problem?.value||'').trim();
    const loc=((f.elements.locationCode?.value||'').trim()||(f.elements.manualLocation?.value||'').trim()||($('#fieldLocationSearch')?.value||'').trim());
    const missing=[];
    if(!title||/Details Pending/i.test(title))missing.push('Title / Work Request');
    if(!loc)missing.push('Location');
    return {title,loc,missing};
  }

  function preserveCloseAttempt(d){
    if(!d)return'';
    if(!d.pendingCloseTime){d.pendingCloseTime=nowTime();d.pendingCloseAt=nowISO();d.updatedAt=nowISO();saveDrafts()}
    return d.pendingCloseTime;
  }

  function ensurePendingNotice(){
    let box=$('#v074PendingCloseNotice');
    if(box)return box;
    box=document.createElement('div');box.id='v074PendingCloseNotice';box.className='card hidden';
    box.style.borderLeft='4px solid #d99000';
    const anchor=$('#workflowDetailsToggleBar')||f;
    anchor.insertAdjacentElement('beforebegin',box);
    return box;
  }

  function renderPendingNotice(){
    const box=ensurePendingNotice(),d=currentDraft();
    if(!d?.pendingCloseTime){box.classList.add('hidden');box.innerHTML='';return}
    const c=criticalFromForm();
    box.classList.remove('hidden');
    box.innerHTML=`<b>OUT captured at ${esc(clock(d.pendingCloseTime))}</b><div class="muted tiny top-space">${c.missing.length?`Complete ${esc(c.missing.join(' and '))} and press Close Emergency again. `:''}The original OUT time is preserved so finishing the report later does not change when the work actually ended.</div>`;
  }

  function addTemporaryOption(select,value){
    if(!select||select.tagName!=='SELECT')return;
    if(![...select.options].some(o=>o.value===value)){const o=document.createElement('option');o.value=value;o.textContent=value;select.appendChild(o)}
    select.value=value;
  }

  function injectPendingValues(missing){
    if(missing.includes('Title / Work Request')){
      const el=f.elements.problem;
      if(el?.tagName==='SELECT')addTemporaryOption(el,TITLE_PENDING);else if(el)el.value=TITLE_PENDING;
    }
    if(missing.includes('Location')){
      if(f.elements.manualLocation)f.elements.manualLocation.value=LOCATION_PENDING;
    }
  }

  function patchClosedEvent(draftId,preservedOut,missing){
    if(!draftId||!preservedOut)return false;
    const ev=[...events].reverse().find(e=>e.type==='emergency'&&e.draftId===draftId);
    if(!ev)return false;
    const oldOut=ev.out||'';
    ev.out=preservedOut;
    ev.closeAttemptAt=ev.closeAttemptAt||nowISO();
    ev.criticalDetailsMissing=missing.slice();
    ev.workTimeSource='first-close-attempt-preserved';
    save(K.events,events);

    const s=(window.onCallSessions||[]).find(x=>x.id===ev.sessionId);
    if(s){
      if(s.lastClosedEventId===ev.id||s.nextWorkStart===oldOut)s.nextWorkStart=preservedOut;
      if(s.status==='CLOSED'&&(s.lastClosedEventId===ev.id||s.out===oldOut))s.out=preservedOut;
      s.updatedAt=nowISO();saveSessions();
    }
    renderAll();
    return true;
  }

  function scheduleClosedPatch(id,out,missing){
    [20,70,160,320].forEach(ms=>setTimeout(()=>patchClosedEvent(id,out,missing),ms));
  }

  // Do not teach placeholder titles to the local Knowledge Base.
  if(typeof learnEvent==='function'&&!learnEvent.__v074Wrapped){
    const baseLearn=learnEvent;
    const wrapped=function(ev){if(/Title Pending/i.test(ev?.problem||''))return;return baseLearn(ev)};
    wrapped.__v074Wrapped=true;learnEvent=wrapped;
  }

  // Keep Needs Details visible for records intentionally closed with missing critical information.
  if(typeof needsDetails==='function'&&!needsDetails.__v074Wrapped){
    const baseNeeds=needsDetails;
    const wrapped=function(e){
      const title=(e?.problem||'').trim(),loc=(typeof locationLabel==='function'?locationLabel(e):(e?.locationCode||e?.manualLocation||e?.fullAddress||''));
      return baseNeeds(e)||!title||/Title Pending|Details Pending/i.test(title)||!loc||/Location Pending/i.test(String(loc));
    };
    wrapped.__v074Wrapped=true;needsDetails=wrapped;
  }

  // Card-level Close Emergency and Cancel-after-start both call requestSubmit().
  // Intercept it once so missing critical fields never make the button appear dead.
  const nativeRequestSubmit=f.requestSubmit.bind(f);
  if(!f.dataset.v074RequestSubmit){
    f.dataset.v074RequestSubmit='1';
    f.requestSubmit=function(submitter){
      (async()=>{
        const d=currentDraft();
        if(!d)return nativeRequestSubmit(submitter);
        const out=preserveCloseAttempt(d);
        const {missing}=criticalFromForm();
        const canceling=(f.elements.closeOutcome?.value||d.closeOutcome||'')===CANCEL_AFTER_START;

        if(missing.length&&!canceling){
          renderPendingNotice();
          const ok=await appConfirm(
            `OUT ${clock(out)} has been saved. Missing: ${missing.join(' and ')}. Close this emergency anyway and complete the Maintenance Request later? Press Cancel to go back and complete the missing field(s); the saved OUT time will not change.`,
            'Missing Emergency Details'
          );
          if(!ok){toast(`OUT ${clock(out)} saved. Complete ${missing.join(' / ')} and press Close Emergency again.`);renderPendingNotice();return}
        }

        // Cancel already has its own explicit confirmation in app-19. Once confirmed,
        // do not let missing Title/Location leave a hidden Canceled outcome on the draft.
        if(missing.length)injectPendingValues(missing);
        d.criticalDetailsMissing=missing.slice();d.updatedAt=nowISO();saveDrafts();
        scheduleClosedPatch(d.id,out,missing);
        nativeRequestSubmit(submitter);
      })();
    };
  }

  function activeEmergency(){return drafts().find(d=>d.workflowStatus==='IN_PROGRESS'&&d.workSelected===true)||null}
  function wireOut(){
    const out=$('#workflowOutBtn');if(!out)return;
    if(!out.__v074Handler){
      out.__v074Handler=e=>{
        e?.preventDefault?.();
        const d=activeEmergency();if(!d)return;
        if(currentDraftId()!==d.id){
          const card=$(`.workflow-call[data-draft-id="${d.id}"]`);card?.click();setTimeout(()=>f.requestSubmit(),30);return;
        }
        f.requestSubmit();
      };
    }
    // Older render layers rewrite onclick; re-apply this handler after every render.
    out.onclick=out.__v074Handler;
    out.dataset.v074Out='1';
  }

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:2,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:currentDraftId(),reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(window.reportableWorkState||load(K.reportableWork,{version:1,activities:[],activeId:''})),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
  }

  function enhance(){wireOut();renderPendingNotice();installBackupExport()}
  const baseRenderAllV074=renderAll;
  renderAll=function(){baseRenderAllV074();setTimeout(enhance,0);setTimeout(wireOut,80)};
  const baseGoV074=go;
  go=function(id){baseGoV074(id);if(id==='emergency'){setTimeout(enhance,0);setTimeout(wireOut,80)}installBackupExport()};

  const root=$('#emergency');if(root){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}).observe(root,{subtree:true,childList:true})}
  enhance();
})();
