/* v0.6.15 — compact field workspace, card-level Close, Work IN visibility, chronological On-Call Log */
(function(){
  const VERSION='0.6.15';
  const f=$('#fieldEmergencyForm'),root=$('#emergency');
  if(!f||!root||!K.sessions||!K.emergencyDrafts||!K.activeDraft)return;

  const nowISO=()=>new Date().toISOString();
  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=>drafts().filter(d=>d.workflowStatus!=='CLOSED');
  const currentDraftId=()=>load(K.activeDraft,'')||'';
  const currentDraft=()=>openDrafts().find(d=>d.id===currentDraftId())||null;
  const relevantDrafts=s=>s?openDrafts().filter(d=>d.sessionId===s.id||(!d.sessionId&&d.date===s.date)):[];
  const explicitActive=s=>s?relevantDrafts(s).find(d=>d.workSelected===true&&d.workflowStatus==='IN_PROGRESS')||null:null;
  const callNo=d=>`#${String(Number(d?.callNumber)||0).padStart(2,'0')}`;
  let detailsExpanded=false;

  function ensureStyles(){
    if($('#v015FieldStyles'))return;
    const st=document.createElement('style');st.id='v015FieldStyles';st.textContent=`
      #fieldEmergencyForm.v015-collapsed{display:none!important}
      #fieldEmergencyForm #workflowCloseTop,#fieldEmergencyForm .workflow-close-emergency{display:none!important}
      .workflow-call.v014-working .workflow-start-work{display:none!important}
      .workflow-card-close{white-space:nowrap;margin-left:8px}
      #workflowDetailsToggleBar{padding:0;overflow:hidden}
      #workflowDetailsToggleBtn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border:0;background:transparent;text-align:left;font-weight:800;color:#16324a;cursor:pointer}
      #workflowDetailsToggleBtn:hover{background:#f6f9fb}
      #workflowDetailsToggleBtn .detail-sub{display:block;font-size:11px;font-weight:500;color:#6a7885;margin-top:2px}
      #workflowDetailsToggleBtn .chev{font-size:18px;line-height:1}
      @media(max-width:640px){.workflow-card-close{padding:7px 9px;font-size:11px}#workflowDetailsToggleBtn{padding:11px 12px}}
    `;document.head.appendChild(st);
  }

  function ensureDetailsBar(){
    ensureStyles();
    let bar=$('#workflowDetailsToggleBar');
    if(!bar){
      bar=document.createElement('div');bar.id='workflowDetailsToggleBar';bar.className='card hidden';
      bar.innerHTML='<button type="button" id="workflowDetailsToggleBtn"><span><span id="workflowDetailsToggleLabel">View / Edit Emergency Details</span><span class="detail-sub" id="workflowDetailsToggleSub"></span></span><span class="chev" id="workflowDetailsToggleChev">⌄</span></button>';
      f.insertAdjacentElement('beforebegin',bar);
      $('#workflowDetailsToggleBtn').onclick=()=>{detailsExpanded=!detailsExpanded;syncDetailsPanel()};
    }
    return bar;
  }

  function syncDetailsPanel(){
    const bar=ensureDetailsBar(),d=currentDraft();
    if(!d){bar.classList.add('hidden');f.classList.remove('v015-collapsed');return}
    bar.classList.remove('hidden');
    f.classList.toggle('v015-collapsed',!detailsExpanded);
    const es=settings.language==='es';
    const label=$('#workflowDetailsToggleLabel'),sub=$('#workflowDetailsToggleSub'),chev=$('#workflowDetailsToggleChev');
    if(label)label.textContent=detailsExpanded?(es?'Ocultar detalles de la emergencia':'Hide Emergency Details'):(es?'Ver / Editar detalles de la emergencia':'View / Edit Emergency Details');
    if(sub)sub.textContent=`${callNo(d)} · ${(d.problem||'Emergency').replace(/Emergency\s*[–-]\s*Details Pending/i,'Emergency')} · ${d.locationCode||d.manualLocation||d._locationSearch||'Location pending'}`;
    if(chev)chev.textContent=detailsExpanded?'⌃':'⌄';
  }

  function selectDraft(card,id){
    const resume=card?.querySelector('.workflow-resume')||$(`.workflow-resume[data-id="${id}"]`);
    if(resume){resume.click();return}
    save(K.activeDraft,id);go('emergency');
  }

  function closeActiveFromCard(id,card){
    const s=activeSession(),active=explicitActive(s);
    if(!active||active.id!==id)return toast('Only the emergency currently IN PROGRESS can be closed.');
    if(currentDraftId()!==id)selectDraft(card,id);
    detailsExpanded=false;
    setTimeout(()=>f.requestSubmit(),0);
  }

  function enhanceCards(){
    const s=activeSession(),active=explicitActive(s),list=$('#workflowOpenCallList');if(!list)return;
    list.querySelectorAll('.workflow-call').forEach(card=>{
      const id=card.dataset.draftId||card.querySelector('.workflow-resume')?.dataset.id;if(!id)return;
      const d=drafts().find(x=>x.id===id&&x.workflowStatus!=='CLOSED');if(!d)return;
      card.dataset.draftId=id;
      const working=!!(s&&active?.id===id),meta=card.querySelector('.item-meta');
      if(meta){
        const received=`RCVD ${clock(d.timeReceived)||'—'}`;
        const workIn=d.workStartCursor||s?.nextWorkStart||s?.in||'';
        const text=!s?`${received} · Session not started`:working?`${received} · Work IN ${clock(workIn)}`:received;
        if(meta.textContent!==text)meta.textContent=text;
      }
      let close=card.querySelector('.workflow-card-close');
      if(working){
        if(!close){
          close=document.createElement('button');close.type='button';close.className='primary workflow-card-close';close.textContent='Close Emergency';
          const cancel=card.querySelector('.workflow-cancel-call');if(cancel)card.insertBefore(close,cancel);else card.appendChild(close);
          close.onclick=e=>{e.stopPropagation();closeActiveFromCard(close.dataset.id,card)};
        }
        close.dataset.id=id;close.disabled=false;
      }else close?.remove();
    });
  }

  function syncFieldWorkspace(){enhanceCards();syncDetailsPanel()}

  function sourceForCard(card){
    const kind=card.dataset.kind,id=card.dataset.id;
    if(kind==='draft')return drafts().find(d=>d.id===id)||null;
    return events.find(e=>e.id===id)||null;
  }
  function rowDate(x){return x?.date||x?.dateReceived||''}
  function rowTime(x,kind){
    if(!x)return'';
    if(kind==='draft')return x.workStartCursor||x.timeReceived||'';
    return x.in||x.timeReceived||'';
  }
  function compareRows(a,b){
    const ax=a.x,bx=b.x,ad=rowDate(ax),bd=rowDate(bx);if(ad!==bd)return ad.localeCompare(bd);
    if(a.kind==='event'&&b.kind==='event'&&ax?.sessionId&&ax.sessionId===bx?.sessionId){
      const as=Number(ax.workSequence)||0,bs=Number(bx.workSequence)||0;if(as&&bs&&as!==bs)return as-bs;
    }
    const at=rowTime(ax,a.kind),bt=rowTime(bx,b.kind);if(at!==bt)return at.localeCompare(bt);
    return String(ax?.closedAt||ax?.createdAt||'').localeCompare(String(bx?.closedAt||bx?.createdAt||''));
  }

  function reorderLog(){
    const list=$('#workflowLogList');if(!list)return;
    const cards=[...list.querySelectorAll('.workflow-log-item[data-kind][data-id]')];if(cards.length<2)return;
    const rows=cards.map(card=>({card,kind:card.dataset.kind,x:sourceForCard(card)})).filter(r=>r.x).sort(compareRows);
    const current=cards.map(c=>c.dataset.kind+':'+c.dataset.id).join('|'),wanted=rows.map(r=>r.kind+':'+r.x.id).join('|');
    if(current===wanted)return;
    rows.forEach(r=>list.appendChild(r.card));
  }

  function currentLogRows(){
    const selected=$('#workflowPeriodFilter')?.value||'current';
    const kind=$('#workflowLogSubfilter [data-log-kind].active')?.dataset.logKind||'all';
    const q=($('#workflowLogSearch')?.value||'').trim().toLowerCase();
    const rows=[...openDrafts().map(x=>({...x,_kind:'draft',_logState:'OPEN',type:'emergency'})),...events.map(x=>({...x,_kind:'event',_logState:x.type==='emergency'?'CLOSED':'SAVED'}))];
    const start=selected==='current'?currentPeriodStart:selected==='all'?'':selected;
    return rows.filter(x=>{
      const date=rowDate(x),p=date?periodForDate(date):'';
      if(start&&p!==start)return false;
      if(kind==='emergency'&&!(x._kind==='draft'||x.type==='emergency'))return false;
      const title=x.problem?.trim()||(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event');
      const loc=x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'';
      return !q||[title,loc,x.fullAddress,x.occupant,x.phone,x.closeOutcome,x.vendor].join(' ').toLowerCase().includes(q);
    }).map(x=>({x,kind:x._kind})).sort(compareRows).map(r=>r.x);
  }

  function recordTimes(x){
    if(x._kind==='draft'){
      const s=sessions().find(v=>v.id===x.sessionId),active=explicitActive(s);
      return {tin:active?.id===x.id?(x.workStartCursor||s?.nextWorkStart||s?.in||''):'',tout:''};
    }
    return {tin:x.in||'',tout:x.out||''};
  }
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`}
  async function deliverFile(name,type,text){
    const blob=new Blob([text],{type});
    try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }
  function installLogExports(){
    const txt=$('#workflowExportTxt'),csv=$('#workflowExportCsv'),json=$('#workflowExportJson');if(!txt||!csv||!json)return;
    txt.onclick=()=>{const text=currentLogRows().map(x=>{const t=recordTimes(x),loc=x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'',title=x.problem?.trim()||(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event');return [`${rowDate(x)} | ${title} | ${loc}`,`Status: ${x._logState}${x.closeOutcome?' / '+x.closeOutcome:''}`,x.timeReceived?`Received: ${clock(x.timeReceived)}`:'',t.tin?`IN: ${clock(t.tin)}`:'',t.tout?`OUT: ${clock(t.tout)}`:'',x.occupant?`Occupant: ${x.occupant}`:'',x.phone?`Phone: ${x.phone}`:'',x.remarks?`Remarks: ${x.remarks}`:''].filter(Boolean).join('\n')}).join('\n\n----------------------------------------\n\n');deliverFile(`OnCall_Log_${todayISO()}.txt`,'text/plain',text)};
    csv.onclick=()=>{const head=['Date','Type','Title','Location','Received','In','Out','Status','Outcome','Occupant','Phone','Folio'];const body=currentLogRows().map(x=>{const t=recordTimes(x),title=x.problem?.trim()||(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event'),loc=x.locationCode||x.manualLocation||x._locationSearch||x.fullAddress||'';return [rowDate(x),x._kind==='draft'?'Emergency':(typeof eventTypeLabel==='function'?eventTypeLabel(x.type):x.type||'Event'),title,loc,x.timeReceived||'',t.tin,t.tout,x._logState,x.closeOutcome||'',x.occupant||'',x.phone||'',x.requestNumber||''].map(csvCell).join(',')});deliverFile(`OnCall_Log_${todayISO()}.csv`,'text/csv',[head.map(csvCell).join(','),...body].join('\n'))};
    json.onclick=()=>deliverFile(`OnCall_Log_${todayISO()}.json`,'application/json',JSON.stringify({kind:'oncall-log',version:VERSION,exportedAt:nowISO(),technician:workerName(),records:currentLogRows()},null,2));
  }

  function syncLog(){reorderLog();installLogExports()}

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:1,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:currentDraftId(),reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
    const hint=$('#v069BackupHint');if(hint)hint.textContent='Full v0.6.15 backup: includes Payroll, events, open calls, explicit Start Work state, On-Call sessions and pending work-start cursor, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings.';
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#workflowNewCallBtn')){detailsExpanded=true;setTimeout(syncFieldWorkspace,0);setTimeout(syncFieldWorkspace,80);return}
    if(e.target.closest?.('.workflow-start-work')){detailsExpanded=false;setTimeout(syncFieldWorkspace,30);setTimeout(syncFieldWorkspace,120);return}
    if(e.target.closest?.('.workflow-call')&&!e.target.closest('button')){detailsExpanded=false;setTimeout(syncFieldWorkspace,0);setTimeout(syncFieldWorkspace,80)}
  },true);

  const baseRenderAllV015=renderAll;
  renderAll=function(){baseRenderAllV015();setTimeout(syncFieldWorkspace,0);setTimeout(syncLog,0);installBackupExport()};
  const baseGoV015=go;
  go=function(id){baseGoV015(id);if(id==='emergency')setTimeout(syncFieldWorkspace,0);if(id==='emergencyLog')setTimeout(syncLog,0);installBackupExport()};

  let fieldQueued=false;
  new MutationObserver(()=>{if(fieldQueued)return;fieldQueued=true;requestAnimationFrame(()=>{fieldQueued=false;syncFieldWorkspace()})}).observe(root,{subtree:true,childList:true});
  const logList=$('#workflowLogList');
  if(logList){let logQueued=false;new MutationObserver(()=>{if(logQueued)return;logQueued=true;requestAnimationFrame(()=>{logQueued=false;syncLog()})}).observe(logList,{childList:true})}

  ensureStyles();ensureDetailsBar();detailsExpanded=false;syncFieldWorkspace();syncLog();installBackupExport();
})();
