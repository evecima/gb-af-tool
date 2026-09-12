/* v0.6.17 — Quick Emergency Intake: keep call reception fields visible; defer documentation/closeout into a collapsed section */
(function(){
  const VERSION='0.6.17';
  const f=$('#fieldEmergencyForm');
  if(!f)return;

  function closestLabel(name){return f.elements?.[name]?.closest('label')||null}

  function ensureStyles(){
    if($('#v017QuickIntakeStyles'))return;
    const st=document.createElement('style');st.id='v017QuickIntakeStyles';st.textContent=`
      #workflowCloseoutDetails{margin-top:2px}
      #workflowCloseoutDetails>summary{font-weight:800;color:#16324a;cursor:pointer;padding:10px 2px}
      #workflowCloseoutDetails>summary .v017-sub{display:block;font-size:11px;font-weight:500;color:#6a7885;margin-top:3px}
      #workflowCloseoutDetails[open]>summary{margin-bottom:8px}
      #workflowCloseoutBody{align-items:start}
    `;document.head.appendChild(st);
  }

  function ensureCloseoutSection(){
    ensureStyles();
    let details=$('#workflowCloseoutDetails');
    if(!details){
      details=document.createElement('details');details.id='workflowCloseoutDetails';details.className='form-details span2';
      details.innerHTML='<summary><span id="workflowCloseoutTitle">Additional Emergency Details / Closeout</span><span class="v017-sub" id="workflowCloseoutSub">Complete findings, repair details, materials, vendor and outcome after the urgent call intake.</span></summary><div class="form-grid top-space" id="workflowCloseoutBody"></div>';

      const problem=closestLabel('problem');
      const anchor=problem||closestLabel('phone')||closestLabel('date');
      if(anchor)anchor.insertAdjacentElement('afterend',details);else f.appendChild(details);
    }

    const body=$('#workflowCloseoutBody');if(!body)return details;
    const move=[];
    for(const name of ['finding','solution','specialInstructions','remarks','material','quantity']){
      const el=closestLabel(name);if(el)move.push(el);
    }
    const vendorCheck=$('#fieldUsedVendor')?.closest('label');if(vendorCheck)move.push(vendorCheck);
    const vendorPanel=$('#fieldVendorPanel');if(vendorPanel)move.push(vendorPanel);
    const outcome=closestLabel('closeOutcome');if(outcome)move.push(outcome);
    const follow=$('#workflowFollowupFields');if(follow)move.push(follow);
    const status=closestLabel('status');if(status)move.push(status);

    // Move any additional Maintenance Request accordion into the deferred section,
    // but leave the original hidden intake-holder (timeReceived/occupant/phone) alone.
    [...f.querySelectorAll('details.form-details')].forEach(d=>{
      if(d===details||d.classList.contains('workflow-empty-details'))return;
      const txt=(d.querySelector('summary')?.textContent||'').trim().toLowerCase();
      if(txt.includes('additional maintenance request')||txt.includes('additional form details'))move.push(d);
    });

    // The old form submit/hint row is no longer an operational Close button (v0.6.15
    // moved Close Emergency to the active call card), so keep it with deferred documentation.
    const submit=f.querySelector('.workflow-close-emergency');
    const submitRow=submit?.closest('.row');if(submitRow)move.push(submitRow);

    [...new Set(move)].forEach(el=>{if(el&&el.parentElement!==body)body.appendChild(el)});
    return details;
  }

  function syncLabels(){
    const es=settings.language==='es';
    const title=$('#workflowCloseoutTitle'),sub=$('#workflowCloseoutSub');
    if(title)title.textContent=es?'Detalles adicionales / Cierre de emergencia':'Additional Emergency Details / Closeout';
    if(sub)sub.textContent=es?'Completa hallazgos, reparación, materiales, contratista y resultado después de registrar rápidamente la llamada.':'Complete findings, repair details, materials, vendor and outcome after the urgent call intake.';
  }

  function syncQuickIntake(){
    const details=ensureCloseoutSection();
    syncLabels();
    // Always default the administrative section closed when a new call is being captured.
    // User can explicitly expand it whenever they are ready to document the job.
    if(details&&!details.dataset.v017Ready){details.open=false;details.dataset.v017Ready='1'}
  }

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:1,exportedAt:new Date().toISOString(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:load(K.activeDraft,'')||'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
    const hint=$('#v069BackupHint');if(hint)hint.textContent='Full v0.6.17 backup: includes Payroll, events, open calls, Quick Intake and closeout data, explicit Start Work state, On-Call sessions and pending work-start cursor, folios, Knowledge Base, vendors, locked periods, Report Dates and settings.';
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#workflowNewCallBtn')){
      const d=ensureCloseoutSection();if(d)d.open=false;
      setTimeout(syncQuickIntake,0);setTimeout(syncQuickIntake,80);
    }
  },true);

  const baseRenderAllV017=renderAll;
  renderAll=function(){baseRenderAllV017();setTimeout(syncQuickIntake,0);installBackupExport()};
  const baseGoV017=go;
  go=function(id){baseGoV017(id);if(id==='emergency')setTimeout(syncQuickIntake,0);installBackupExport()};

  syncQuickIntake();installBackupExport();
})();
