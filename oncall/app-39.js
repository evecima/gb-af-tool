/* v0.7.8 — Pool Operations inside Reportable Work: Pool Opening / Pool Closing as standalone reportable work */
(function(){
  const VERSION='0.7.8';
  K.poolOperations=NS+'pool_operations_v1';
  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const poolLabel=mode=>mode==='open'?'Pool Opening':'Pool Closing';
  const poolType=mode=>mode==='open'?'pool_open':'pool_close';
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
      .v078-pool-choice{border:1px solid #d7e0e6;border-radius:14px;padding:14px;background:#fff}
      .v078-pool-choice h3{margin:0 0 4px;font-size:17px}.v078-pool-icon{font-size:34px;line-height:1;margin-bottom:8px}
      .v078-pool-toggle{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.v078-pool-toggle button{width:100%}
      .v078-pool-active{border:2px solid #1f7fb8;background:#f8fcff;border-radius:12px;padding:12px;margin-top:10px}
      .v078-pool-history{margin-top:8px;display:grid;gap:6px}.v078-pool-history .item{margin:0}
      @media(max-width:720px){.v078-pool-toggle{grid-template-columns:1fr}}
    `;document.head.appendChild(s)
  }

  function ensurePoolChoice(){
    const grid=$('#reportableWork .v070-rw-grid');if(!grid||$('#v078PoolChoice'))return;
    const c=document.createElement('div');c.id='v078PoolChoice';c.className='v078-pool-choice';
    c.innerHTML=`<div class="v078-pool-icon">🏊</div><h3>Pool Operations</h3><div class="muted tiny">Pool Opening and Pool Closing are standalone reportable work. Use IN when the pool task actually begins and OUT when it is complete.</div>
      <label class="top-space"><span>Service Date</span><input id="v078PoolDate" type="date"></label>
      <label class="top-space"><span>Location / Area</span><input id="v078PoolLocation" value="Pool Area" placeholder="Pool Area"></label>
      <div class="v078-pool-toggle"><button type="button" class="secondary" id="v078OpenPool">IN — Pool Opening</button><button type="button" class="primary" id="v078ClosePool">IN — Pool Closing</button></div>
      <div id="v078PoolStatus"></div>`;
    grid.appendChild(c);
    $('#v078OpenPool').onclick=()=>startPool('open');$('#v078ClosePool').onclick=()=>startPool('close');
  }

  function eventForOperation(op){return op.eventId?events.find(e=>e.id===op.eventId):null}
  function createOrUpdateEvent(op){
    if(!op||op.status!=='CLOSED'||!op.start||!op.end)return null;
    let ev=eventForOperation(op);
    if(!ev){ev=makeEvent(poolType(op.mode),op.date,op.start,op.end,'pool-operations-v078');op.eventId=ev.id;events.push(ev)}
    const title=poolLabel(op.mode),loc=op.location||'Pool Area';
    Object.assign(ev,{type:poolType(op.mode),date:op.date,in:op.start,out:op.end,dateReceived:op.date,timeReceived:op.start,problem:title,locationCode:'POOL',fullAddress:poolAreaAddress(),manualLocation:loc,finding:'',solution:op.mode==='open'?'Pool area was inspected for daily opening. Restrooms were unlocked and inspected. General area conditions and cleanliness were verified.':'Pool area was inspected for daily closing. Restrooms were secured. General area conditions and cleanliness were verified.',specialInstructions:'',remarks:op.mode==='open'?'Pool opened for operation.':'Pool secured for the night.',result:op.mode==='open'?'Pool opened for operation.':'Pool secured for the night.',status:'Job Complete',source:'pool-operations-v078',poolOperationId:op.id,worker:op.worker||workerName(),workerId:op.workerId||workerId()});
    save(K.events,events);saveState();return ev;
  }

  function startPool(mode){
    if(activeEmergency())return toast('Close the emergency currently IN PROGRESS before starting Pool Operations.');
    if(current())return toast(`${poolLabel(current().mode)} is already active.`);
    const other=otherReportableActive();if(other)return toast('Another Reportable Work activity is already active. Finish it before starting Pool Operations.');
    const date=$('#v078PoolDate')?.value||todayISO(),location=($('#v078PoolLocation')?.value||'Pool Area').trim()||'Pool Area',start=nowTime();
    const op={id:uid('pool'),mode,date,start,end:'',status:'ACTIVE',location,workerId:workerId(),worker:workerName(),eventId:'',createdAt:nowISO(),updatedAt:nowISO(),interruptedByEmergencyDraftId:'',resumeOffered:false};
    state.operations.push(op);state.activeId=op.id;saveState();ensureWorkSession(start,date,op.id);renderPool();toast(`${poolLabel(mode)} IN ${clock(start)}.`)
  }

  function finishPool(reason='manual'){
    const op=current();if(!op)return;
    if(activeEmergency())return toast('The emergency is still IN PROGRESS. Finish the emergency first.');
    const end=nowTime();op.end=end;op.status='CLOSED';op.updatedAt=nowISO();op.closeReason=reason;state.activeId='';saveState();createOrUpdateEvent(op);maybeCloseWorkSession(end);renderAll();renderPool();toast(`${poolLabel(op.mode)} OUT ${clock(end)}.`)
  }

  function renderPoolStatus(){
    const box=$('#v078PoolStatus');if(!box)return;const op=current();
    if(!op){box.innerHTML='';return}
    box.innerHTML=`<div class="v078-pool-active"><div class="row between wrap gap"><div><b>${esc(poolLabel(op.mode))}</b><div class="muted tiny">ACTIVE · Actual IN ${clock(op.start)} · ${esc(op.location||'Pool Area')}</div></div><button type="button" class="dangerbtn" id="v078PoolFinish">OUT / Finish</button></div></div>`;
    $('#v078PoolFinish').onclick=()=>finishPool('manual')
  }

  function renderPoolHistory(){
    const hist=$('#v070History');if(!hist||$('#v078PoolHistory'))return;
    const wrap=document.createElement('div');wrap.id='v078PoolHistory';wrap.className='v078-pool-history';hist.insertAdjacentElement('afterend',wrap)
  }
  function updatePoolHistory(){
    renderPoolHistory();const wrap=$('#v078PoolHistory');if(!wrap)return;
    const rows=state.operations.filter(op=>inCurrentPeriod(op.date)).slice().sort((a,b)=>((b.date||'')+(b.start||'')).localeCompare((a.date||'')+(a.start||'')));
    wrap.innerHTML=rows.length?`<div class="muted tiny" style="margin-bottom:4px">Pool Operations</div>`+rows.map(op=>`<div class="item"><div class="item-title">${esc(poolLabel(op.mode))} · ${mdy(op.date)}</div><div class="item-meta">${clock(op.start)}${op.end?'–'+clock(op.end):'–…'} · ${esc(op.location||'Pool Area')}</div><div class="badges"><span class="badge ${op.status==='CLOSED'?'ok':''}">${op.status}</span>${op.eventId?'<span class="badge">Maintenance Request created</span>':''}</div></div>`).join(''):''
  }

  function renderPool(){
    ensureStyles();ensurePoolChoice();
    const d=todayISO();if($('#v078PoolDate')&&!$('#v078PoolDate').value)$('#v078PoolDate').value=d;
    const op=current(),other=otherReportableActive(),em=activeEmergency();
    const ob=$('#v078OpenPool'),cb=$('#v078ClosePool');
    for(const b of [ob,cb])if(b){b.disabled=!!op||!!other||!!em;b.title=em?'An emergency is IN PROGRESS.':other?'Another Reportable Work activity is active.':op?'Pool Operations is already active.':''}
    renderPoolStatus();updatePoolHistory();
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

  function enhance(){archivePoolEmergencyTitles();cleanupAliases();ensureStyles();ensurePoolChoice();renderPool()}
  const baseRenderAllV078=renderAll;
  renderAll=function(){baseRenderAllV078();setTimeout(enhance,0)};
  const baseGoV078=go;
  go=function(id){baseGoV078(id);if(id==='reportableWork'||id==='settings')setTimeout(enhance,0)};

  enhance();
})();
