/* v0.7.0 — Reportable Work Timeline: Mandatory Overtime + Snow Removal, automatic emergency interruption, no manual Pause button */
(function(){
  const VERSION='0.7.0';
  K.reportableWork=NS+'reportable_work';

  let state=load(K.reportableWork,{version:1,activities:[],activeId:''});
  if(!state||!Array.isArray(state.activities))state={version:1,activities:[],activeId:''};
  window.reportableWorkState=state;

  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const activeSession=()=>[...sessions()].reverse().find(s=>s.status==='ACTIVE')||null;
  const openDrafts=()=>drafts().filter(d=>d.workflowStatus!=='CLOSED');
  const activeEmergency=()=>openDrafts().find(d=>d.workSelected===true&&d.workflowStatus==='IN_PROGRESS')||null;
  const activityById=id=>state.activities.find(a=>a.id===id)||null;
  const currentActivity=()=>{const a=activityById(state.activeId);return a&&a.status!=='CLOSED'?a:null};
  const saveState=()=>{save(K.reportableWork,state);window.reportableWorkState=state};
  const saveSessions=()=>save(K.sessions,window.onCallSessions||[]);
  const saveDrafts=()=>save(K.emergencyDrafts,window.emergencyDrafts||[]);
  const timeMin=t=>t?mins(t):null;
  const labelForType=t=>t==='mandatory_ot'?'Mandatory Overtime':'Snow Removal';
  const isAfter=(a,b)=>a&&b&&timeMin(a)>timeMin(b);
  const isAtOrBefore=(a,b)=>a&&b&&timeMin(a)<=timeMin(b);
  const addMinutes=(t,n)=>timeInput((timeMin(t)||0)+Math.round(Number(n||0)));
  const uniqueLocations=a=>[...new Set((a.segments||[]).map(s=>s.location).filter(Boolean))];

  function ensureStyles(){
    if($('#v070ReportableStyles'))return;
    const st=document.createElement('style');st.id='v070ReportableStyles';st.textContent=`
      .v070-dashboard-card{position:relative;overflow:hidden}
      .v070-dashboard-card .v070-mini{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .v070-dashboard-card .v070-mini span{display:flex;align-items:center;gap:7px;padding:8px;border-radius:10px;background:#f5f9fc;font-size:12px;font-weight:750;color:#24445d}
      .v070-rw-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .v070-choice{border:1px solid #d7e0e6;border-radius:14px;padding:14px;background:#fff}
      .v070-choice h3{margin:0 0 4px;font-size:17px}.v070-choice .v070-icon{font-size:34px;line-height:1;margin-bottom:8px}
      .v070-plan{padding:10px;border-radius:11px;background:#f5f9fc;margin:10px 0;font-weight:750;color:#24445d}
      .v070-active{border:2px solid #1f7fb8!important;background:#f8fcff!important}
      .v070-active.paused{border-color:#d99000!important;background:#fffaf1!important}
      .v070-statusline{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}
      .v070-pill{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#e8f4fb;color:#155f8f}
      .v070-pill.paused{background:#fff0d2;color:#8b5600}.v070-pill.closed{background:#e9f6ed;color:#1f6d38}
      .v070-timeline{display:grid;gap:6px;margin-top:10px}.v070-seg{display:grid;grid-template-columns:125px 1fr;gap:8px;padding:8px 10px;border-radius:9px;background:#f5f7f8;font-size:12px}
      .v070-seg b{white-space:nowrap}.v070-emergency-seg{background:#fff2f0}
      .v070-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.v070-danger-note{font-size:11px;color:#8b5600;margin-top:7px}
      #v070ReportableBanner{border-left:4px solid #1f7fb8}.v070-banner-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      @media(max-width:720px){.v070-rw-grid{grid-template-columns:1fr}.v070-seg{grid-template-columns:105px 1fr}.v070-dashboard-card .v070-mini{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(st);
  }

  function ensureDashboardCard(){
    const grid=$('#dashboard .dashboard-grid');if(!grid||$('#v070ReportableCard'))return;
    const b=document.createElement('button');b.id='v070ReportableCard';b.type='button';b.className='big-card v070-dashboard-card';
    b.innerHTML='<span class="icon">🧾</span><span class="title">Reportable Work</span><span class="desc">Mandatory Overtime and Snow Removal with an activity timeline.</span><span class="v070-mini"><span>🔨 Mandatory Overtime</span><span>☃️ Snow Removal</span></span>';
    b.onclick=()=>{go('reportableWork');renderReportableWork()};
    const before=grid.querySelector('[data-go="knowledge"]');if(before)grid.insertBefore(b,before);else grid.appendChild(b);
  }

  function ensureScreen(){
    if($('#reportableWork'))return;
    const app=$('.app');if(!app)return;
    const s=document.createElement('section');s.id='reportableWork';s.className='screen';
    s.innerHTML=`
      <div class="screen-head"><button class="back" id="v070Back">←</button><div><h2>Reportable Work</h2><p>Mandatory Overtime and Snow Removal are reportable work. The phone timeline tracks what you actually did; it does not replace the office/Humanity punch.</p></div></div>
      <div id="v070ActiveWrap" class="card hidden"></div>
      <div class="card"><div class="v070-rw-grid">
        <div class="v070-choice" id="v070MandatoryChoice"><div class="v070-icon">🔨</div><h3>Mandatory Overtime</h3><div class="muted tiny">Schedule the planned overtime window. If an emergency interrupts it, Start Work on the emergency pauses this timeline automatically.</div>
          <label class="top-space"><span>Service Date</span><input id="v070MandatoryDate" type="date"></label>
          <div class="form-grid top-space"><label><span>Mandatory Hours</span><input id="v070MandatoryHours" type="number" min="0.5" max="8" step="0.5" value="2"></label><label><span>Lunch</span><select id="v070Lunch"><option value="taken">Lunch taken</option><option value="skipped">Skip lunch</option></select></label></div>
          <div class="v070-plan" id="v070MandatoryPlan"></div>
          <label><span>Work / Activity</span><input id="v070MandatoryTask" value="Prep" placeholder="Prep / building work / apartment work"></label>
          <label class="top-space"><span>Location / Apt / Area</span><input id="v070MandatoryLocation" placeholder="61C / 3535 / Building / Area"></label>
          <div class="v070-actions"><button type="button" class="primary" id="v070StartMandatory">IN — Mandatory Overtime</button></div>
        </div>
        <div class="v070-choice" id="v070SnowChoice"><div class="v070-icon">☃️</div><h3>Snow Removal</h3><div class="muted tiny">Snow Removal is reportable for the full actual IN–OUT, even when it crosses 8:00 AM.</div>
          <label class="top-space"><span>Service Date</span><input id="v070SnowDate" type="date"></label>
          <label class="top-space"><span>Location / Area</span><input id="v070SnowLocation" value="Property / Grounds" placeholder="Property / Grounds"></label>
          <div class="v070-actions"><button type="button" class="primary" id="v070StartSnow">IN — Snow Removal</button></div>
        </div>
      </div></div>
      <div class="card"><div class="row between wrap gap"><div><b>Reportable Work History</b><div class="muted tiny">Operational timeline for this pay period. Maintenance Requests are generated when a reportable activity is closed.</div></div></div><div id="v070History" class="list top-space"></div></div>
      <div class="screen-bottom-nav"><button class="back" id="v070BackBottom">←</button></div>`;
    app.appendChild(s);
    $('#v070Back').onclick=$('#v070BackBottom').onclick=()=>go('dashboard');
    $('#v070MandatoryHours').oninput=renderPlanPreview;$('#v070Lunch').onchange=renderPlanPreview;
    $('#v070StartMandatory').onclick=startMandatory;$('#v070StartSnow').onclick=startSnow;
  }

  function mandatoryPlan(){
    const skip=$('#v070Lunch')?.value==='skipped',hours=Math.max(.5,Number($('#v070MandatoryHours')?.value)||2),start=skip?'16:00':'17:00',end=addMinutes(start,hours*60);
    return {skip,hours,start,end};
  }
  function renderPlanPreview(){const p=mandatoryPlan(),el=$('#v070MandatoryPlan');if(el)el.textContent=`Planned window: ${clock(p.start)}–${clock(p.end)} · ${p.hours} hr${p.hours===1?'':'s'} · ${p.skip?'Skip lunch':'Lunch taken'}`}

  function ensureWorkSession(at,date,ownerId){
    let s=activeSession();
    if(!s){
      s={id:uid('ses'),workerId:workerId(),worker:workerName(),date,in:at,out:'',status:'ACTIVE',source:'reportable-work-v070',reportableOwnerId:ownerId,nextWorkStart:at,workSeq:0,createdAt:nowISO(),updatedAt:nowISO()};
      window.onCallSessions.push(s);
    }
    for(const d of openDrafts()){
      if(!d.sessionId&&d.date===date){d.sessionId=s.id;if(d.workflowStatus!=='IN_PROGRESS')d.workflowStatus='WAITING';d.updatedAt=nowISO()}
    }
    saveSessions();saveDrafts();return s;
  }

  function maybeCloseWorkSession(at){
    const s=activeSession();if(!s)return;
    const linkedOpen=openDrafts().filter(d=>d.sessionId===s.id);
    if(linkedOpen.length||currentActivity())return;
    if(s.source==='reportable-work-v070'||s.reportableOwnerId){s.out=at;s.status='CLOSED';s.closedAt=nowISO();s.updatedAt=nowISO();s.nextWorkStart=at;saveSessions()}
  }

  function makeActivity(type,date,start,extra={}){
    return {id:uid('rw'),type,date,workerId:workerId(),worker:workerName(),status:'ACTIVE',start,end:'',createdAt:nowISO(),updatedAt:nowISO(),plannedStart:'',plannedEnd:'',plannedHours:0,skipLunch:false,currentSegmentStart:start,currentLabel:type==='snow'?'Snow Removal':'Prep',currentLocation:'',segments:[],pausedByEmergencyDraftId:'',pauseStartedAt:'',resumeCursor:'',resumeEligible:false,lastEmergencyEventId:'',parentEventId:'',...extra};
  }

  function appendSegment(a,kind,start,end,label,location='',refEventId=''){
    if(!a||!start||!end||timeMin(end)<timeMin(start))return;
    const last=a.segments[a.segments.length-1];
    if(last&&last.kind===kind&&last.start===start&&last.end===end&&last.refEventId===refEventId)return;
    a.segments.push({kind,start,end,label:label||labelForType(a.type),location:location||'',refEventId:refEventId||''});
  }
  function closeCurrentWorkSegment(a,end){
    if(!a?.currentSegmentStart)return;
    appendSegment(a,'work',a.currentSegmentStart,end,a.currentLabel,a.currentLocation);
    a.currentSegmentStart='';a.updatedAt=nowISO();
  }

  function parentLocation(a){
    const locs=uniqueLocations(a);if(locs.length===1)return locs[0];if(locs.length>1)return'MULTIPLE LOCATIONS';return a.type==='snow'?'Property / Grounds':'';
  }
  function timelineText(a){
    return (a.segments||[]).map(s=>`${clock(s.start)}–${clock(s.end)} — ${s.label}${s.location?' · '+s.location:''}`).join('\n');
  }
  function upsertParentEvent(a){
    if(!a||a.status!=='CLOSED'||!a.start||!a.end)return null;
    let ev=a.parentEventId?events.find(e=>e.id===a.parentEventId):null;
    if(!ev){ev=makeEvent(a.type,a.date,a.start,a.end,'reportable-work-v070');a.parentEventId=ev.id;events.push(ev)}
    const loc=parentLocation(a),apt=(window.APARTMENT_DATA||[]).find(x=>String(x.code||'').toUpperCase()===String(loc||'').toUpperCase());
    Object.assign(ev,{type:a.type,date:a.date,in:a.start,out:a.end,dateReceived:a.date,timeReceived:a.start,problem:labelForType(a.type),finding:'',solution:timelineText(a),specialInstructions:'',remarks:a.type==='mandatory_ot'?`Planned Mandatory Overtime: ${clock(a.plannedStart)}–${clock(a.plannedEnd)}${a.skipLunch?' · Skip lunch':''}`:'Snow Removal reportable work timeline.',result:'',status:'Job Complete',source:'reportable-work-v070',reportableWorkId:a.id,reportableSegments:clone(a.segments||[]),locationCode:apt?.code||'',fullAddress:apt?apartmentAddress(apt):'',manualLocation:apt?'':loc,occupant:'',phone:''});
    save(K.events,events);saveState();return ev;
  }

  function finalizeActivity(a,end){
    if(!a||a.status==='CLOSED')return;
    if(a.status==='ACTIVE')closeCurrentWorkSegment(a,end);
    a.end=end;a.status='CLOSED';a.resumeEligible=false;a.pausedByEmergencyDraftId='';a.updatedAt=nowISO();
    if(state.activeId===a.id)state.activeId='';saveState();upsertParentEvent(a);maybeCloseWorkSession(end);
  }

  function createSnowContinuation(date,start,location){
    const a=makeActivity('snow',date,start,{currentLabel:'Snow Removal',currentLocation:location||'Property / Grounds'});state.activities.push(a);state.activeId=a.id;saveState();ensureWorkSession(start,date,a.id);return a;
  }

  function splitMandatorySnowAtBoundary(a,transitionTime){
    if(!a||a.type!=='mandatory_ot'||a.currentLabel!=='Snow Removal'||!a.plannedEnd||!isAfter(transitionTime,a.plannedEnd))return a;
    const boundary=a.plannedEnd;
    closeCurrentWorkSegment(a,boundary);a.end=boundary;a.status='CLOSED';a.updatedAt=nowISO();upsertParentEvent(a);
    const snow=createSnowContinuation(a.date,boundary,a.currentLocation||'Property / Grounds');state.activeId=snow.id;saveState();return snow;
  }

  function canStartReportable(){if(activeEmergency()){toast('Close the emergency currently IN PROGRESS before starting reportable work.');return false}return true}

  function startMandatory(){
    if(!canStartReportable())return;
    const cur=currentActivity();if(cur)return toast(`${labelForType(cur.type)} is already active. Close it before starting another reportable-work session.`);
    const plan=mandatoryPlan(),date=$('#v070MandatoryDate')?.value||todayISO(),start=nowTime(),task=($('#v070MandatoryTask')?.value||'Prep').trim()||'Prep',location=($('#v070MandatoryLocation')?.value||'').trim();
    const a=makeActivity('mandatory_ot',date,start,{plannedStart:plan.start,plannedEnd:plan.end,plannedHours:plan.hours,skipLunch:plan.skip,currentLabel:task,currentLocation:location});
    state.activities.push(a);state.activeId=a.id;saveState();ensureWorkSession(start,date,a.id);renderAll();go('reportableWork');renderReportableWork();toast(`Mandatory Overtime IN ${clock(start)} · planned end ${clock(plan.end)}.`)
  }

  function startSnow(){
    if(!canStartReportable())return;
    const cur=currentActivity(),date=$('#v070SnowDate')?.value||todayISO(),location=($('#v070SnowLocation')?.value||'Property / Grounds').trim()||'Property / Grounds',t=nowTime();
    if(cur){
      if(cur.type==='mandatory_ot'&&cur.status==='ACTIVE'){
        closeCurrentWorkSegment(cur,t);cur.currentLabel='Snow Removal';cur.currentLocation=location;cur.currentSegmentStart=t;cur.updatedAt=nowISO();saveState();renderReportableWork();toast(`Snow Removal started inside Mandatory Overtime at ${clock(t)}.`);return;
      }
      return toast(`${labelForType(cur.type)} is already active.`);
    }
    const a=createSnowContinuation(date,t,location);renderAll();go('reportableWork');renderReportableWork();toast(`Snow Removal IN ${clock(t)}.`)
  }

  function finishCurrentReportable(){
    let a=currentActivity();if(!a)return;
    if(activeEmergency())return toast('The emergency is still IN PROGRESS. Close it first; reportable work is paused automatically.');
    const t=nowTime();
    if(a.status==='PAUSED'){
      const end=a.resumeCursor||a.pauseStartedAt||t;
      finalizeActivity(a,end);renderAll();renderReportableWork();return toast(`${labelForType(a.type)} closed at ${clock(end)}.`)
    }
    if(a.type==='mandatory_ot'&&a.currentLabel==='Snow Removal'&&a.plannedEnd&&isAfter(t,a.plannedEnd)){
      const snow=splitMandatorySnowAtBoundary(a,t);closeCurrentWorkSegment(snow,t);snow.end=t;snow.status='CLOSED';snow.updatedAt=nowISO();state.activeId='';saveState();upsertParentEvent(snow);maybeCloseWorkSession(t);renderAll();renderReportableWork();return toast(`Mandatory Overtime closed at ${clock(a.plannedEnd)}; Snow Removal continued to ${clock(t)}.`)
    }
    finalizeActivity(a,t);renderAll();renderReportableWork();toast(`${labelForType(a.type)} OUT ${clock(t)}.`)
  }

  function resumeReportable(){
    const a=currentActivity();if(!a||a.status!=='PAUSED'||!a.resumeEligible)return;
    if(activeEmergency())return toast('Close the emergency currently IN PROGRESS before resuming reportable work.');
    const cursor=a.resumeCursor||nowTime();
    if(a.type==='mandatory_ot'&&a.plannedEnd&&isAfter(cursor,a.plannedEnd))return toast('Mandatory Overtime planned end has already passed. This activity cannot be resumed.');
    ensureWorkSession(cursor,a.date,a.id);a.status='ACTIVE';a.currentSegmentStart=cursor;a.resumeEligible=false;a.pausedByEmergencyDraftId='';a.pauseStartedAt='';a.updatedAt=nowISO();saveState();renderAll();renderReportableWork();toast(`${labelForType(a.type)} resumed at ${clock(cursor)}.`)
  }

  function updateMandatoryPlan(){
    const a=currentActivity();if(!a||a.type!=='mandatory_ot')return;
    const input=$('#v070ActivePlannedEnd'),v=input?.value;if(!v)return;
    a.plannedEnd=v;a.updatedAt=nowISO();saveState();renderReportableWork();toast(`Mandatory Overtime planned end updated to ${clock(v)}.`)
  }

  function pauseForEmergency(draftId){
    let a=currentActivity();if(!a)return;
    const already=activeEmergency();if(already&&already.id!==draftId)return;
    const transition=a.status==='PAUSED'?(a.resumeCursor||nowTime()):nowTime();
    if(a.status==='ACTIVE'){
      if(a.type==='mandatory_ot'&&a.currentLabel==='Snow Removal'&&a.plannedEnd&&isAfter(transition,a.plannedEnd))a=splitMandatorySnowAtBoundary(a,transition);
      closeCurrentWorkSegment(a,transition);a.status='PAUSED';a.pauseStartedAt=transition;
    }
    a.pausedByEmergencyDraftId=draftId;a.resumeEligible=false;a.updatedAt=nowISO();state.activeId=a.id;saveState();
    const d=drafts().find(x=>x.id===draftId);if(d){d.reportableWorkId=a.id;d.reportableWorkType=a.type;d.reportablePauseAt=transition;d.updatedAt=nowISO();saveDrafts()}
    const s=ensureWorkSession(transition,a.date,a.id);s.nextWorkStart=transition;s.updatedAt=nowISO();saveSessions();renderReportableWork();renderResumeBanner();
  }

  function suppressEmergencyIntoActivity(ev,a){
    ev.suppressStandaloneReport=true;ev.groupedReportableWorkId=a.id;ev.requestNumber='';
    save(K.events,events);
  }
  function unsuppressEmergency(ev){if(!ev)return;ev.suppressStandaloneReport=false;ev.groupedReportableWorkId='';save(K.events,events)}

  function processClosedEmergency(draftId){
    if(!draftId)return;
    const a=state.activities.find(x=>x.status==='PAUSED'&&x.pausedByEmergencyDraftId===draftId);if(!a)return;
    const ev=[...events].reverse().find(e=>e.type==='emergency'&&e.draftId===draftId);if(!ev||!ev.out)return;
    const start=a.pauseStartedAt||ev.in,end=ev.out,loc=ev.locationCode||ev.manualLocation||ev.fullAddress||'';
    if(a.type==='mandatory_ot'&&a.plannedEnd&&isAfter(end,a.plannedEnd)){
      unsuppressEmergency(ev);a.resumeEligible=false;a.pausedByEmergencyDraftId='';a.resumeCursor='';a.end=start;a.status='CLOSED';a.updatedAt=nowISO();if(state.activeId===a.id)state.activeId='';saveState();upsertParentEvent(a);maybeCloseWorkSession(end);renderAll();renderResumeBanner();return;
    }
    appendSegment(a,'emergency',start,end,ev.problem||'Emergency',loc,ev.id);a.resumeCursor=end;a.resumeEligible=true;a.lastEmergencyEventId=ev.id;a.pausedByEmergencyDraftId='';a.updatedAt=nowISO();suppressEmergencyIntoActivity(ev,a);saveState();renderAll();renderResumeBanner();
  }

  function renderSegments(a){
    const rows=[...(a.segments||[])];if(a.status==='ACTIVE'&&a.currentSegmentStart)rows.push({kind:'work',start:a.currentSegmentStart,end:'—',label:a.currentLabel,location:a.currentLocation});
    return rows.length?`<div class="v070-timeline">${rows.map(s=>`<div class="v070-seg ${s.kind==='emergency'?'v070-emergency-seg':''}"><b>${clock(s.start)}–${s.end==='—'?'…':clock(s.end)}</b><span>${esc(s.label||'Work')}${s.location?` · ${esc(s.location)}`:''}</span></div>`).join('')}</div>`:'<div class="muted tiny top-space">No completed segments yet.</div>';
  }

  function renderActive(){
    const box=$('#v070ActiveWrap');if(!box)return;const a=currentActivity();
    if(!a){box.classList.add('hidden');box.innerHTML='';return}
    box.classList.remove('hidden');box.classList.toggle('v070-active',true);box.classList.toggle('paused',a.status==='PAUSED');
    const status=a.status==='PAUSED'?'PAUSED BY EMERGENCY':'ACTIVE';
    box.innerHTML=`<div class="row between wrap gap"><div><b>${labelForType(a.type)}</b><div class="v070-statusline"><span class="v070-pill ${a.status==='PAUSED'?'paused':''}">${status}</span><span class="muted tiny">Actual IN ${clock(a.start)}${a.type==='mandatory_ot'?` · Planned ${clock(a.plannedStart)}–${clock(a.plannedEnd)}`:''}</span></div></div><div class="v070-actions">${a.status==='PAUSED'&&a.resumeEligible?`<button class="primary" id="v070Resume">Resume ${labelForType(a.type)}</button>`:''}<button class="dangerbtn" id="v070Finish">OUT / Finish</button></div></div>
      ${a.type==='mandatory_ot'?`<div class="form-grid top-space"><label><span>Planned End</span><input type="time" id="v070ActivePlannedEnd" value="${esc(a.plannedEnd||'')}"></label><div style="align-self:end"><button type="button" class="secondary" id="v070SavePlan">Update Planned End</button></div></div><div class="v070-danger-note">Planned End is a guide. The actual activity changes only when you start another activity, Resume, or OUT / Finish.</div>`:''}
      ${renderSegments(a)}`;
    $('#v070Resume')?.addEventListener('click',resumeReportable);$('#v070Finish')?.addEventListener('click',finishCurrentReportable);$('#v070SavePlan')?.addEventListener('click',updateMandatoryPlan);
  }

  function renderHistory(){
    const list=$('#v070History');if(!list)return;
    const rows=state.activities.filter(a=>inCurrentPeriod(a.date)).slice().sort((a,b)=>((b.date||'')+(b.start||'')).localeCompare((a.date||'')+(a.start||'')));
    list.innerHTML=rows.length?rows.map(a=>`<div class="item"><div class="row between wrap gap"><div><div class="item-title">${labelForType(a.type)} · ${mdy(a.date)}</div><div class="item-meta">${clock(a.start)}${a.end?'–'+clock(a.end):'–…'}${a.type==='mandatory_ot'?` · planned ${clock(a.plannedStart)}–${clock(a.plannedEnd)}`:''}</div><div class="badges"><span class="badge ${a.status==='CLOSED'?'ok':a.status==='PAUSED'?'warn':''}">${a.status}</span>${a.parentEventId?'<span class="badge">Maintenance Request created</span>':''}</div></div></div>${renderSegments(a)}</div>`).join(''):'<div class="muted">No Reportable Work records in this pay period.</div>';
  }

  function renderReportableWork(){
    ensureStyles();ensureDashboardCard();ensureScreen();
    const d=todayISO();if($('#v070MandatoryDate')&&!$('#v070MandatoryDate').value)$('#v070MandatoryDate').value=d;if($('#v070SnowDate')&&!$('#v070SnowDate').value)$('#v070SnowDate').value=d;
    renderPlanPreview();renderActive();renderHistory();
    const a=currentActivity(),em=activeEmergency();
    const mb=$('#v070StartMandatory'),sb=$('#v070StartSnow');
    if(mb){mb.disabled=!!em||!!a;mb.title=em?'An emergency is IN PROGRESS.':a?'Another reportable-work activity is active.':''}
    if(sb){sb.disabled=!!em||(!!a&&!(a.type==='mandatory_ot'&&a.status==='ACTIVE'));sb.textContent=a?.type==='mandatory_ot'&&a.status==='ACTIVE'?'Start Snow within Mandatory':'IN — Snow Removal';sb.title=em?'An emergency is IN PROGRESS.':''}
    renderResumeBanner();
  }

  function ensureResumeBanner(){
    const root=$('#emergency');if(!root)return null;let b=$('#v070ReportableBanner');if(b)return b;
    b=document.createElement('div');b.id='v070ReportableBanner';b.className='card hidden';const open=$('#workflowOpenCalls');if(open)open.insertAdjacentElement('afterend',b);else root.prepend(b);return b;
  }
  function renderResumeBanner(){
    const b=ensureResumeBanner();if(!b)return;const a=currentActivity();
    if(!a){b.classList.add('hidden');b.innerHTML='';return}
    const em=activeEmergency();b.classList.remove('hidden');
    if(a.status==='ACTIVE')b.innerHTML=`<b>Reportable Work active: ${labelForType(a.type)}</b><div class="muted tiny top-space">Starting an emergency will automatically stop the current reportable-work segment at the emergency Work IN. No manual Pause is required.</div>`;
    else if(em)b.innerHTML=`<b>${labelForType(a.type)} paused automatically</b><div class="muted tiny top-space">Emergency ${esc(em.problem||'in progress')} is currently active. The reportable-work timeline will decide what can resume when the emergency closes.</div>`;
    else if(a.resumeEligible)b.innerHTML=`<b>${labelForType(a.type)} is ready to resume</b><div class="muted tiny top-space">Emergency ended at ${clock(a.resumeCursor)}. Resume starts from that exact OUT time so no artificial gap is created.</div><div class="v070-banner-actions"><button type="button" class="primary" id="v070BannerResume">Resume ${labelForType(a.type)}</button><button type="button" class="secondary" id="v070BannerOpen">Open Reportable Work</button></div>`;
    else b.innerHTML=`<b>${labelForType(a.type)} paused</b><div class="muted tiny top-space">Open Reportable Work to review the current timeline.</div><div class="v070-banner-actions"><button type="button" class="secondary" id="v070BannerOpen">Open Reportable Work</button></div>`;
    $('#v070BannerResume')?.addEventListener('click',resumeReportable);$('#v070BannerOpen')?.addEventListener('click',()=>{go('reportableWork');renderReportableWork()});
  }

  // Report views must not double-count an emergency that was completely absorbed into
  // one reportable-work timeline. The detailed emergency record remains in the raw local history.
  const baseEventsPeriodV070=eventsPeriod;
  eventsPeriod=function(){return baseEventsPeriodV070().filter(e=>!e.suppressStandaloneReport)};

  let closingDraftId='';
  document.addEventListener('click',e=>{
    const sw=e.target.closest?.('.workflow-start-work');
    if(sw){const id=sw.dataset.id||sw.closest('.workflow-call')?.dataset.draftId;if(id)pauseForEmergency(id);setTimeout(renderResumeBanner,40);return}
    if(e.target.closest?.('.workflow-card-close,#workflowOutBtn')){
      const em=activeEmergency();closingDraftId=em?.id||'';if(closingDraftId){setTimeout(()=>{processClosedEmergency(closingDraftId);closingDraftId=''},260)}
    }
  },true);
  document.addEventListener('submit',e=>{
    if(e.target!==$('#fieldEmergencyForm'))return;const em=activeEmergency();closingDraftId=em?.id||closingDraftId;if(closingDraftId)setTimeout(()=>{processClosedEmergency(closingDraftId);closingDraftId=''},260)
  },true);

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:2,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:load(K.activeDraft,'')||'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(state),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
    const hint=$('#v069BackupHint');if(hint)hint.textContent='Full v0.7.0 backup: includes Payroll, emergency calls, Reportable Work timeline (Mandatory Overtime / Snow Removal), sessions, folios, Knowledge Base, vendors, locked periods and settings.';
  }

  const baseRenderAllV070=renderAll;
  renderAll=function(){baseRenderAllV070();ensureDashboardCard();ensureScreen();setTimeout(renderReportableWork,0);installBackupExport()};
  const baseGoV070=go;
  go=function(id){baseGoV070(id);if(id==='reportableWork')setTimeout(renderReportableWork,0);if(id==='emergency')setTimeout(renderResumeBanner,0);installBackupExport()};

  ensureStyles();ensureDashboardCard();ensureScreen();renderReportableWork();installBackupExport();
})();
