/* v0.7.8 — Pool Operations inside Reportable Work: Pool Opening / Pool Closing, emergency pause/resume, no double-counted minutes */
(function(){
  const VERSION='0.7.8';
  K.poolOperations=NS+'pool_operations_v1';
  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const poolLabel=mode=>mode==='open'?'Pool Opening':'Pool Closing';
  const poolType=mode=>mode==='open'?'pool_open':'pool_close';
  const minute=t=>t?mins(t):null;
  const duration=(a,b)=>{let x=minute(a),y=minute(b);if(x===null||y===null)return 0;if(y<x)y+=1440;return Math.max(0,y-x)};

  let state=load(K.poolOperations,{version:1,operations:[],activeId:''});
  if(!state||!Array.isArray(state.operations))state={version:1,operations:[],activeId:''};
  window.poolOperationsState=state;
  const saveState=()=>{save(K.poolOperations,state);window.poolOperationsState=state};
  const current=()=>{const a=state.operations.find(x=>x.id===state.activeId);return a&&a.status!=='CLOSED'?a:null};
  const otherReportableActive=()=>{const s=window.reportableWorkState,a=s?.activities?.find(x=>x.id===s.activeId);return a&&a.status!=='CLOSED'?a:null};
  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const activeEmergency=()=>drafts().find(d=>d.workflowStatus==='IN_PROGRESS'&&d.workSelected===true)||null;
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const saveSessions=()=>K.sessions&&save(K.sessions,window.onCallSessions||[]);
  const saveDrafts=()=>K.emergencyDrafts&&save(K.emergencyDrafts,window.emergencyDrafts||[]);

  function ensureWorkSession(at,date,ownerId){
    let s=activeSession();
    if(!s){
      s={id:uid('ses'),workerId:workerId(),worker:workerName(),date,in:at,out:'',status:'ACTIVE',source:'pool-operations-v078',poolOperationId:ownerId,nextWorkStart:at,workSeq:0,createdAt:nowISO(),updatedAt:nowISO()};
      window.onCallSessions.push(s);
    }else{
      s.poolOperationId=ownerId;s.updatedAt=nowISO();
    }
    for(const d of drafts().filter(x=>x.workflowStatus!=='CLOSED')){
      if(!d.sessionId&&d.date===date){d.sessionId=s.id;if(d.workflowStatus!=='IN_PROGRESS')d.workflowStatus='WAITING';d.updatedAt=nowISO()}
    }
    saveSessions();saveDrafts();return s;
  }

  function maybeCloseWorkSession(at){
    const s=activeSession();if(!s)return;
    const open=drafts().filter(d=>d.workflowStatus!=='CLOSED'&&d.sessionId===s.id);
    if(open.length||current()||otherReportableActive())return;
    if(s.source==='pool-operations-v078'||s.poolOperationId){s.out=at;s.status='CLOSED';s.closedAt=nowISO();s.updatedAt=nowISO();s.nextWorkStart=at;saveSessions()}
  }

  function ensureStyles(){
    if($('#v078PoolStyles'))return;
    const s=document.createElement('style');s.id='v078PoolStyles';s.textContent=`
      #v078PoolChoice{grid-column:1/-1}.v078-pool-choice{border:1px solid #d7e0e6;border-radius:14px;padding:14px;background:#fff}
      .v078-pool-choice h3{margin:0 0 4px;font-size:17px}.v078-pool-icon{font-size:34px;line-height:1;margin-bottom:8px}
      .v078-pool-toggle{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.v078-pool-toggle button{width:100%}
      .v078-pool-active{border:2px solid #1f7fb8;background:#f8fcff;border-radius:12px;padding:12px;margin-top:10px}.v078-pool-active.paused{border-color:#d99000;background:#fffaf1}
      .v078-pool-history{margin-top:8px;display:grid;gap:6px}.v078-pool-history .item{margin:0}
      .v078-pool-timeline{display:grid;gap:5px;margin-top:8px}.v078-pool-seg{display:grid;grid-template-columns:115px 1fr;gap:8px;padding:7px 9px;border-radius:8px;background:#f5f7f8;font-size:12px}.v078-pool-int{background:#fff2f0}
      #v078PoolBanner{border-left:4px solid #1f7fb8}.v078-banner-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      #v070ReportableCard .v070-mini{grid-template-columns:repeat(3,minmax(0,1fr))}
      @media(max-width:720px){.v078-pool-toggle{grid-template-columns:1fr}.v078-pool-seg{grid-template-columns:100px 1fr}#v070ReportableCard .v070-mini{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }

  function ensurePoolChoice(){
    const grid=$('#reportableWork .v070-rw-grid');if(!grid||$('#v078PoolChoice'))return;
    const c=document.createElement('div');c.id='v078PoolChoice';c.className='v078-pool-choice';
    c.innerHTML=`<div class="v078-pool-icon">🏊</div><h3>Pool Operations</h3><div class="muted tiny">Pool Opening and Pool Closing are standalone reportable work. IN starts the actual pool task; OUT ends it. An emergency pauses Pool Operations automatically at Emergency Start Work.</div>
      <div class="form-grid top-space"><label><span>Service Date</span><input id="v078PoolDate" type="date"></label><label><span>Location / Area</span><input id="v078PoolLocation" value="Pool Area" placeholder="Pool Area"></label></div>
      <div class="v078-pool-toggle"><button type="button" class="secondary" id="v078OpenPool">IN — Pool Opening</button><button type="button" class="primary" id="v078ClosePool">IN — Pool Closing</button></div>
      <div id="v078PoolStatus"></div>`;
    grid.appendChild(c);
    $('#v078OpenPool').onclick=()=>startPool('open');$('#v078ClosePool').onclick=()=>startPool('close');
  }

  function appendSegment(op,end){
    if(!op?.currentSegmentStart||!end)return;
    const start=op.currentSegmentStart;if(duration(start,end)<0)return;
    op.segments=op.segments||[];
    const last=op.segments[op.segments.length-1];
    if(!(last&&last.start===start&&last.end===end))op.segments.push({start,end,location:op.location||'Pool Area'});
    op.currentSegmentStart='';op.updatedAt=nowISO();
  }

  function standardSolution(mode){
    return mode==='open'
      ?'Pool opening work was performed. The pool area and restrooms were checked as part of the opening procedure.'
      :'Pool closing work was performed. The pool area and restrooms were checked and secured as part of the closing procedure.'
  }

  function createSegmentEvents(op){
    if(!op||op.status!=='CLOSED')return;
    const segs=(op.segments||[]).filter(s=>s.start&&s.end);
    if(!segs.length)return;
    const oldIds=new Set(op.eventIds||[]);if(oldIds.size){events=events.filter(e=>!oldIds.has(e.id))}
    op.eventIds=[];
    segs.forEach((seg,i)=>{
      const ev=makeEvent(poolType(op.mode),op.date,seg.start,seg.end,'pool-operations-v078');
      const last=i===segs.length-1,title=poolLabel(op.mode);
      Object.assign(ev,{type:poolType(op.mode),date:op.date,in:seg.start,out:seg.end,dateReceived:op.date,timeReceived:seg.start,problem:title,locationCode:'POOL',fullAddress:poolAreaAddress(),manualLocation:op.location||'Pool Area',finding:'',solution:standardSolution(op.mode),specialInstructions:segs.length>1?`Pool operation segment ${i+1} of ${segs.length}. The operation was interrupted by an emergency and resumed without overlapping reportable minutes.`:'',remarks:last?(op.mode==='open'?'Pool opened for operation.':'Pool secured for the night.'):'Pool operation paused for an emergency.',result:last?(op.mode==='open'?'Pool opened for operation.':'Pool secured for the night.'):'Pool operation paused for an emergency.',status:last?'Job Complete':'Not Complete',source:'pool-operations-v078',poolOperationId:op.id,poolSegmentIndex:i+1,poolSegmentCount:segs.length,worker:op.worker||workerName(),workerId:op.workerId||workerId()});
      events.push(ev);op.eventIds.push(ev.id)
    });
    save(K.events,events);saveState()
  }

  function startPool(mode){
    if(activeEmergency())return toast('Close the emergency currently IN PROGRESS before starting Pool Operations.');
    if(current())return toast(`${poolLabel(current().mode)} is already active or paused.`);
    const other=otherReportableActive();if(other)return toast('Another Reportable Work activity is already active. Finish it before starting Pool Operations.');
    const date=$('#v078PoolDate')?.value||todayISO(),location=($('#v078PoolLocation')?.value||'Pool Area').trim()||'Pool Area',start=nowTime();
    const op={id:uid('pool'),mode,date,start,end:'',status:'ACTIVE',location,workerId:workerId(),worker:workerName(),segments:[],interruptions:[],currentSegmentStart:start,eventIds:[],createdAt:nowISO(),updatedAt:nowISO(),interruptedByEmergencyDraftId:'',pauseStartedAt:'',resumeCursor:'',resumeEligible:false};
    state.operations.push(op);state.activeId=op.id;saveState();ensureWorkSession(start,date,op.id);renderAll();renderPool();toast(`${poolLabel(mode)} IN ${clock(start)}.`)
  }

  function finishPool(reason='manual'){
    const op=current();if(!op)return;
    if(activeEmergency())return toast('The emergency is still IN PROGRESS. Close it first; Pool Operations is paused automatically.');
    let poolEnd=nowTime(),sessionEnd=poolEnd;
    if(op.status==='ACTIVE')appendSegment(op,poolEnd);
    else if(op.status==='PAUSED'){
      poolEnd=(op.segments||[]).slice(-1)[0]?.end||op.pauseStartedAt||op.start;
      sessionEnd=op.resumeCursor||nowTime();
    }
    op.end=poolEnd;op.status='CLOSED';op.resumeEligible=false;op.interruptedByEmergencyDraftId='';op.updatedAt=nowISO();op.closeReason=reason;state.activeId='';saveState();createSegmentEvents(op);maybeCloseWorkSession(sessionEnd);renderAll();renderPool();toast(`${poolLabel(op.mode)} closed. Pool work ended at ${clock(poolEnd)}.`)
  }

  function resumePool(){
    const op=current();if(!op||op.status!=='PAUSED'||!op.resumeEligible)return;
    if(activeEmergency())return toast('Close the emergency currently IN PROGRESS before resuming Pool Operations.');
    if(otherReportableActive())return toast('Another Reportable Work activity is active.');
    const at=op.resumeCursor||nowTime();ensureWorkSession(at,op.date,op.id);op.status='ACTIVE';op.currentSegmentStart=at;op.resumeEligible=false;op.interruptedByEmergencyDraftId='';op.pauseStartedAt='';op.updatedAt=nowISO();saveState();renderAll();renderPool();toast(`${poolLabel(op.mode)} resumed at ${clock(at)}.`)
  }

  function pauseForEmergency(draftId){
    const op=current();if(!op||op.status==='CLOSED')return;
    if(op.status==='ACTIVE'){
      const at=nowTime();appendSegment(op,at);op.status='PAUSED';op.pauseStartedAt=at;
    }
    op.interruptedByEmergencyDraftId=draftId;op.resumeEligible=false;op.updatedAt=nowISO();saveState();
    const d=drafts().find(x=>x.id===draftId);if(d){d.poolOperationId=op.id;d.poolPauseAt=op.pauseStartedAt||nowTime();d.updatedAt=nowISO();saveDrafts()}
    const s=ensureWorkSession(op.pauseStartedAt||nowTime(),op.date,op.id);s.nextWorkStart=op.pauseStartedAt||nowTime();s.updatedAt=nowISO();saveSessions();renderPool();renderPoolBanner()
  }

  function processClosedEmergency(draftId){
    if(!draftId)return;const op=current();if(!op||op.status!=='PAUSED'||op.interruptedByEmergencyDraftId!==draftId)return;
    const ev=[...events].reverse().find(e=>e.type==='emergency'&&e.draftId===draftId);if(!ev||!ev.out)return;
    op.interruptions=op.interruptions||[];op.interruptions.push({draftId,eventId:ev.id,start:op.pauseStartedAt||ev.in||'',end:ev.out,label:ev.problem||'Emergency',location:ev.locationCode||ev.manualLocation||ev.fullAddress||''});
    op.resumeCursor=ev.out;op.resumeEligible=true;op.interruptedByEmergencyDraftId='';op.updatedAt=nowISO();saveState();renderAll();renderPool();renderPoolBanner()
  }

  function timelineRows(op){
    const rows=[];(op.segments||[]).forEach(s=>rows.push({kind:'pool',start:s.start,end:s.end,label:poolLabel(op.mode),location:s.location||op.location||'Pool Area'}));(op.interruptions||[]).forEach(x=>rows.push({kind:'emergency',start:x.start,end:x.end,label:x.label||'Emergency',location:x.location||''}));
    if(op.status==='ACTIVE'&&op.currentSegmentStart)rows.push({kind:'pool',start:op.currentSegmentStart,end:'',label:poolLabel(op.mode),location:op.location||'Pool Area'});
    return rows.sort((a,b)=>(minute(a.start)||0)-(minute(b.start)||0))
  }

  function timelineHtml(op){
    const rows=timelineRows(op);if(!rows.length)return'';
    return `<div class="v078-pool-timeline">${rows.map(r=>`<div class="v078-pool-seg ${r.kind==='emergency'?'v078-pool-int':''}"><b>${clock(r.start)}–${r.end?clock(r.end):'…'}</b><span>${r.kind==='emergency'?'Emergency: ':''}${esc(r.label)}${r.location?` · ${esc(r.location)}`:''}</span></div>`).join('')}</div>`
  }

  function poolMinutes(op){return (op.segments||[]).reduce((n,s)=>n+duration(s.start,s.end),0)+(op.status==='ACTIVE'&&op.currentSegmentStart?duration(op.currentSegmentStart,nowTime()):0)}

  function renderPoolStatus(){
    const box=$('#v078PoolStatus');if(!box)return;const op=current();
    if(!op){box.innerHTML='';return}
    const paused=op.status==='PAUSED',status=paused?'PAUSED BY EMERGENCY':'ACTIVE';
    box.innerHTML=`<div class="v078-pool-active ${paused?'paused':''}"><div class="row between wrap gap"><div><b>${esc(poolLabel(op.mode))}</b><div class="muted tiny">${status} · Actual IN ${clock(op.start)} · ${poolMinutes(op)} pool-work min · ${esc(op.location||'Pool Area')}</div></div><div class="row gap wrap">${paused&&op.resumeEligible?`<button type="button" class="primary" id="v078PoolResume">Resume ${esc(poolLabel(op.mode))}</button>`:''}<button type="button" class="dangerbtn" id="v078PoolFinish">OUT / Finish</button></div></div>${timelineHtml(op)}</div>`;
    $('#v078PoolResume')?.addEventListener('click',resumePool);$('#v078PoolFinish').onclick=()=>finishPool(paused?'finish-after-emergency':'manual')
  }

  function renderPoolHistory(){
    const hist=$('#v070History');if(!hist||$('#v078PoolHistory'))return;
    const wrap=document.createElement('div');wrap.id='v078PoolHistory';wrap.className='v078-pool-history';hist.insertAdjacentElement('afterend',wrap)
  }

  function updatePoolHistory(){
    renderPoolHistory();const wrap=$('#v078PoolHistory');if(!wrap)return;
    const rows=state.operations.filter(op=>inCurrentPeriod(op.date)).slice().sort((a,b)=>((b.date||'')+(b.start||'')).localeCompare((a.date||'')+(a.start||'')));
    wrap.innerHTML=rows.length?`<div class="muted tiny" style="margin-bottom:4px">Pool Operations</div>`+rows.map(op=>`<div class="item"><div class="item-title">${esc(poolLabel(op.mode))} · ${mdy(op.date)}</div><div class="item-meta">${clock(op.start)}${op.end?'–'+clock(op.end):'–…'} · ${poolMinutes(op)} pool-work min · ${esc(op.location||'Pool Area')}</div><div class="badges"><span class="badge ${op.status==='CLOSED'?'ok':op.status==='PAUSED'?'warn':''}">${op.status}</span>${op.eventIds?.length?`<span class="badge">${op.eventIds.length} Maintenance Request${op.eventIds.length===1?'':'s'} created</span>`:''}</div>${timelineHtml(op)}</div>`).join(''):''
  }

  function ensurePoolBanner(){
    const root=$('#emergency');if(!root)return null;let b=$('#v078PoolBanner');if(b)return b;
    b=document.createElement('div');b.id='v078PoolBanner';b.className='card hidden';const anchor=$('#v070ReportableBanner')||$('#workflowOpenCalls');if(anchor)anchor.insertAdjacentElement('afterend',b);else root.prepend(b);return b
  }

  function renderPoolBanner(){
    const b=ensurePoolBanner();if(!b)return;const op=current();if(!op){b.classList.add('hidden');b.innerHTML='';return}
    b.classList.remove('hidden');const em=activeEmergency();
    if(op.status==='ACTIVE')b.innerHTML=`<b>Pool Operations active: ${esc(poolLabel(op.mode))}</b><div class="muted tiny top-space">Emergency Start Work will pause Pool Operations automatically at the same minute. No manual Pause button is required.</div>`;
    else if(em)b.innerHTML=`<b>${esc(poolLabel(op.mode))} paused automatically</b><div class="muted tiny top-space">The emergency is currently IN PROGRESS. Pool time is not accumulating while the emergency is active.</div>`;
    else if(op.resumeEligible)b.innerHTML=`<b>${esc(poolLabel(op.mode))} is ready to resume</b><div class="muted tiny top-space">Emergency ended at ${clock(op.resumeCursor)}. Resume starts at that exact OUT time; Finish Pool leaves the pool task ended at its pre-emergency stop time.</div><div class="v078-banner-actions"><button type="button" class="primary" id="v078BannerResume">Resume ${esc(poolLabel(op.mode))}</button><button type="button" class="secondary" id="v078BannerOpen">Open Reportable Work</button></div>`;
    else b.innerHTML=`<b>${esc(poolLabel(op.mode))} paused</b><div class="muted tiny top-space">Open Reportable Work to review or finish the Pool operation.</div><div class="v078-banner-actions"><button type="button" class="secondary" id="v078BannerOpen">Open Reportable Work</button></div>`;
    $('#v078BannerResume')?.addEventListener('click',resumePool);$('#v078BannerOpen')?.addEventListener('click',()=>go('reportableWork'))
  }

  function renderPool(){
    ensureStyles();ensurePoolChoice();
    const d=todayISO();if($('#v078PoolDate')&&!$('#v078PoolDate').value)$('#v078PoolDate').value=d;
    const op=current(),other=otherReportableActive(),em=activeEmergency();
    const ob=$('#v078OpenPool'),cb=$('#v078ClosePool');
    for(const b of [ob,cb])if(b){b.disabled=!!op||!!other||!!em;b.title=em?'An emergency is IN PROGRESS.':other?'Another Reportable Work activity is active.':op?'Pool Operations is already active or paused.':''}
    if(op){const mb=$('#v070StartMandatory'),sb=$('#v070StartSnow');if(mb){mb.disabled=true;mb.title='Pool Operations is active or paused.'}if(sb){sb.disabled=true;sb.title='Pool Operations is active or paused.'}}
    renderPoolStatus();updatePoolHistory();renderPoolBanner();
    const mini=$('#v070ReportableCard .v070-mini');if(mini&&!mini.querySelector('.v078-mini-pool')){const s=document.createElement('span');s.className='v078-mini-pool';s.textContent='🏊 Pool Operations';mini.appendChild(s)}
    const desc=$('#v070ReportableCard .desc');if(desc)desc.textContent='Mandatory Overtime, Snow Removal and Pool Operations with an activity timeline.';
    const head=$('#reportableWork .screen-head p');if(head)head.textContent='Mandatory Overtime, Snow Removal and Pool Operations are reportable work. The phone timeline tracks what you actually did; it does not replace the office/Humanity punch.';
  }

  function archivePoolEmergencyTitles(){
    const catalog=window.emergencyTitleCatalog;if(!catalog?.entries)return;
    let changed=false;
    for(const e of catalog.entries){if(['opening pool','pool opening','closing pool','pool closing'].includes(String(e.name||'').trim().toLowerCase())&&e.status!=='archived'){e.status='archived';e.updatedAt=nowISO();changed=true}}
    if(changed){save(NS+'emergency_title_catalog_v1',catalog);window.emergencyTitleCatalog=catalog;problems=(catalog.entries||[]).filter(e=>e.status!=='archived').map(e=>e.name).sort((a,b)=>a.localeCompare(b));save(K.problems,problems);if(typeof refreshProblems==='function')refreshProblems()}
  }

  function cleanupAliases(){
    const catalog=window.emergencyTitleCatalog;if(!catalog?.entries)return;
    let changed=false;
    for(const e of catalog.entries){const before=JSON.stringify(e.aliases||[]),seen=new Set(),next=[];for(const a of e.aliases||[]){const v=String(a||'').trim();if(!v||v.toLowerCase()===String(e.name||'').trim().toLowerCase())continue;const k=v.toLowerCase();if(seen.has(k))continue;seen.add(k);next.push(v)}e.aliases=next;if(JSON.stringify(next)!==before)changed=true}
    if(changed)save(NS+'emergency_title_catalog_v1',catalog)
  }

  let closingDraftId='';
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#v070StartMandatory,#v070StartSnow')&&current()){e.preventDefault();e.stopImmediatePropagation();toast('Finish or resume/finish Pool Operations before starting another Reportable Work activity.');return}
    const sw=e.target.closest?.('.workflow-start-work');
    if(sw){const id=sw.dataset.id||sw.closest('.workflow-call')?.dataset.draftId;if(id)pauseForEmergency(id);return}
    if(e.target.closest?.('.workflow-card-close,#workflowOutBtn')){const em=activeEmergency();closingDraftId=em?.id||'';if(closingDraftId)setTimeout(()=>{processClosedEmergency(closingDraftId);closingDraftId=''},360)}
  },true);
  document.addEventListener('submit',e=>{if(e.target!==$('#fieldEmergencyForm'))return;const em=activeEmergency();closingDraftId=em?.id||closingDraftId;if(closingDraftId)setTimeout(()=>{processClosedEmergency(closingDraftId);closingDraftId=''},360)},true);

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(NS))out[k]=localStorage.getItem(k)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:4,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),emergencyTitleCatalog:clone(window.emergencyTitleCatalog||{}),poolOperations:clone(state),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:K.activeDraft?(load(K.activeDraft,'')||''):'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(window.reportableWorkState||(K.reportableWork?load(K.reportableWork,{version:1,activities:[],activeId:''}):{})),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)
    }
  }

  function enhance(){archivePoolEmergencyTitles();cleanupAliases();ensureStyles();ensurePoolChoice();renderPool();installBackupExport()}
  const baseRenderAllV078=renderAll;
  renderAll=function(){baseRenderAllV078();setTimeout(enhance,0)};
  const baseGoV078=go;
  go=function(id){baseGoV078(id);setTimeout(enhance,0)};

  enhance();
})();
