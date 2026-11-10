/* v0.7.32 — Pay Period transfer packages with safe merge (Add / Skip / Update). */
(function(){
  const VERSION='0.7.32';
  const PACKAGE_KIND='oncall-pay-period-package';
  K.periodImportSafety=NS+'period_import_safety_v1';

  const clean=v=>String(v??'').trim();
  const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(clean(v));
  const endFor=start=>addDays(start,13);
  const keyFor=start=>`${workerId()||'local'}|${start}`;
  const inPeriod=(date,start)=>validDate(date)&&date>=start&&date<=endFor(start);
  const periodFromKey=key=>{const m=String(key||'').match(/(\d{4}-\d{2}-\d{2})$/);return m?m[1]:''};
  const rwState=()=>window.reportableWorkState||((K.reportableWork&&load(K.reportableWork,null))||{version:1,activities:[],activeId:''});
  const nowISO=()=>new Date().toISOString();

  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(k=>{if(k!=='updatedAt'&&k!=='problemTitleId')out[k]=stable(value[k])});
      return out;
    }
    return value;
  }
  const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
  function changedFields(a,b){
    const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);
    return [...keys].filter(k=>k!=='updatedAt'&&k!=='problemTitleId'&&!same(a?.[k],b?.[k])).sort();
  }

  function collectPeriods(){
    const found=new Set();
    const addStart=s=>{if(validDate(s))found.add(s)};
    const addDate=d=>{if(validDate(d))addStart(periodForDate(d))};
    addStart(currentPeriodStart);
    Object.keys(payrollStore||{}).forEach(k=>addStart(periodFromKey(k)));
    Object.keys(snapshots||{}).forEach(k=>addStart(periodFromKey(k)));
    Object.keys(folioStarts||{}).forEach(addStart);
    Object.keys(window.reportDates||{}).forEach(k=>addStart(periodFromKey(k)));
    Object.keys(window.periodStatuses||{}).forEach(k=>addStart(periodFromKey(k)));
    Object.keys(window.folioHistory||{}).forEach(addStart);
    (events||[]).forEach(e=>addDate(e?.date));
    (window.onCallSessions||[]).forEach(s=>addDate(s?.date));
    (window.emergencyDrafts||[]).forEach(d=>addDate(d?.date||d?.dateReceived));
    (rwState().activities||[]).forEach(a=>addDate(a?.date));
    return [...found].sort().reverse();
  }

  function packageFor(start){
    if(!validDate(start))throw new Error('Invalid pay period start date.');
    const end=endFor(start),storeKey=keyFor(start);
    const periodEvents=(events||[]).filter(e=>inPeriod(e?.date,start));
    const eventIds=new Set(periodEvents.map(e=>e.id).filter(Boolean));
    const sessionIds=new Set(periodEvents.map(e=>e.sessionId).filter(Boolean));
    const activityIds=new Set();
    periodEvents.forEach(e=>{if(e.reportableWorkId)activityIds.add(e.reportableWorkId);if(e.groupedReportableWorkId)activityIds.add(e.groupedReportableWorkId)});

    const sessions=(window.onCallSessions||[]).filter(s=>inPeriod(s?.date,start)||sessionIds.has(s?.id));
    sessions.forEach(s=>{if(s?.id)sessionIds.add(s.id)});
    const drafts=(window.emergencyDrafts||[]).filter(d=>inPeriod(d?.date||d?.dateReceived,start)||sessionIds.has(d?.sessionId));

    const state=rwState();
    const activities=(state.activities||[]).filter(a=>{
      if(inPeriod(a?.date,start)||activityIds.has(a?.id)||eventIds.has(a?.parentEventId))return true;
      return (a?.segments||[]).some(seg=>eventIds.has(seg?.refEventId));
    });
    activities.forEach(a=>activityIds.add(a.id));

    const activeDraftId=load(K.activeDraft,'')||'';
    const includedDraftIds=new Set(drafts.map(d=>d.id));
    const includedActivityIds=new Set(activities.map(a=>a.id));

    return {
      kind:PACKAGE_KIND,
      version:VERSION,
      schema:1,
      exportedAt:nowISO(),
      technician:{id:workerId()||'',name:workerName()||''},
      periodStart:start,
      periodEnd:end,
      payroll:payrollStore?.[storeKey]!==undefined?clone(payrollStore[storeKey]):null,
      snapshot:snapshots?.[storeKey]!==undefined?clone(snapshots[storeKey]):null,
      events:clone(periodEvents),
      onCallSessions:clone(sessions),
      emergencyDrafts:clone(drafts),
      activeDraftId:includedDraftIds.has(activeDraftId)?activeDraftId:'',
      reportableWork:{activities:clone(activities),activeId:includedActivityIds.has(state.activeId)?state.activeId:''},
      folioStart:folioStarts?.[start]!==undefined?clone(folioStarts[start]):null,
      reportDate:window.reportDates?.[storeKey]!==undefined?clone(window.reportDates[storeKey]):null,
      periodStatus:window.periodStatuses?.[storeKey]!==undefined?clone(window.periodStatuses[storeKey]):null,
      folioHistory:window.folioHistory?.[start]!==undefined?clone(window.folioHistory[start]):null
    };
  }

  async function deliverJson(data,name){
    const text=JSON.stringify(data,null,2),type='application/json',blob=new Blob([text],{type});
    try{
      const file=new File([blob],name,{type});
      if(navigator.canShare?.({files:[file]})){
        try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}
      }
    }catch(e){}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }

  async function exportPeriod(start){
    const data=packageFor(start);
    const name=`OnCall_PayPeriod_${start}_to_${data.periodEnd}.json`;
    await deliverJson(data,name);
    toast(`Pay period exported: ${mdy(start)} – ${mdy(data.periodEnd)}.`);
  }

  function localTitleEntry(problem){
    const k=clean(problem).toLowerCase().replace(/\s+/g,' ');
    if(!k)return null;
    const entries=window.emergencyTitleCatalog?.entries||[];
    return entries.find(e=>{
      if(clean(e?.name).toLowerCase().replace(/\s+/g,' ')===k)return true;
      return (e?.aliases||[]).some(a=>clean(a).toLowerCase().replace(/\s+/g,' ')===k);
    })||null;
  }

  function destinationCopy(raw){
    const localId=workerId()||'',localName=workerName()||'';
    const x=clone(raw);
    if(x&&typeof x==='object'){
      if('workerId' in x&&localId)x.workerId=localId;
      if('worker' in x&&localName)x.worker=localName;
      // Emergency-title IDs are device-local catalog metadata. The visible
      // title is the portable identity; translate it to this device's catalog.
      if(clean(x.problem)){
        const entry=localTitleEntry(x.problem);
        if(entry)x.problemTitleId=entry.id;
        else if('problemTitleId' in x)delete x.problemTitleId;
      }
    }
    return x;
  }

  function normalizePackage(d){
    if(!d||d.kind!==PACKAGE_KIND||d.schema!==1)throw new Error('This file is not an On-Call Pay Period package. Use Full Backup Import only for complete device backups.');
    if(!validDate(d.periodStart))throw new Error('Pay Period package has an invalid start date.');
    const start=d.periodStart,end=endFor(start);
    if(d.periodEnd&&d.periodEnd!==end)throw new Error('Pay Period package date range is invalid.');
    return {
      ...d,
      periodStart:start,periodEnd:end,
      events:(Array.isArray(d.events)?d.events:[]).map(destinationCopy),
      onCallSessions:(Array.isArray(d.onCallSessions)?d.onCallSessions:[]).map(destinationCopy),
      emergencyDrafts:(Array.isArray(d.emergencyDrafts)?d.emergencyDrafts:[]).map(destinationCopy),
      reportableWork:{activities:(Array.isArray(d.reportableWork?.activities)?d.reportableWork.activities:[]).map(destinationCopy),activeId:clean(d.reportableWork?.activeId)}
    };
  }

  function classifyById(localRows,sourceRows,kind,labeler){
    const map=new Map((localRows||[]).filter(x=>x?.id).map(x=>[String(x.id),x]));
    const result={kind,newItems:[],changed:[],identical:[]};
    for(const source of sourceRows||[]){
      if(!source?.id)continue;
      const local=map.get(String(source.id));
      if(!local){result.newItems.push(source);continue}
      if(same(local,source)){result.identical.push(source);continue}
      result.changed.push({local,source,fields:changedFields(local,source),label:labeler(source)});
    }
    return result;
  }

  function eventLabelForImport(e){return `${e?.problem||eventTypeLabel(e?.type)||'Event'} · ${validDate(e?.date)?mdy(e.date):'No date'}${clean(e?.locationCode||e?.manualLocation)?' · '+clean(e.locationCode||e.manualLocation):''}`}
  function sessionLabelForImport(s){return `On-Call Session · ${validDate(s?.date)?mdy(s.date):'No date'}${s?.in?' · IN '+clock(s.in):''}`}
  function draftLabelForImport(d){return `Emergency Draft · ${validDate(d?.date||d?.dateReceived)?mdy(d.date||d.dateReceived):'No date'} · ${d?.problem||'Emergency'}`}
  function activityLabelForImport(a){return `${a?.type==='mandatory_ot'?'Mandatory Overtime':a?.type==='snow'?'Snow Removal':'Reportable Work'} · ${validDate(a?.date)?mdy(a.date):'No date'}`}

  function addSingleton(plan,name,label,localValue,sourceValue){
    if(sourceValue===null||sourceValue===undefined)return;
    if(localValue===undefined||localValue===null){plan.singletons.push({name,label,state:'new',source:sourceValue});plan.counts.added++;return}
    if(same(localValue,sourceValue)){plan.singletons.push({name,label,state:'identical',source:sourceValue});plan.counts.identical++;return}
    plan.singletons.push({name,label,state:'changed',local:localValue,source:sourceValue,fields:changedFields(localValue,sourceValue)});plan.counts.changed++;
    plan.changedDetails.push(`${label}${typeof sourceValue==='object'?' · '+changedFields(localValue,sourceValue).join(', '):''}`);
  }

  function analyzeImport(data){
    const start=data.periodStart,storeKey=keyFor(start),state=rwState();
    const groups=[
      classifyById(events||[],data.events,'events',eventLabelForImport),
      classifyById(window.onCallSessions||[],data.onCallSessions,'sessions',sessionLabelForImport),
      classifyById(window.emergencyDrafts||[],data.emergencyDrafts,'drafts',draftLabelForImport),
      classifyById(state.activities||[],data.reportableWork.activities,'activities',activityLabelForImport)
    ];
    const plan={data,groups,singletons:[],counts:{added:0,changed:0,identical:0},changedDetails:[],blocking:[]};
    groups.forEach(g=>{
      plan.counts.added+=g.newItems.length;plan.counts.changed+=g.changed.length;plan.counts.identical+=g.identical.length;
      g.changed.forEach(x=>plan.changedDetails.push(`${x.label} · ${x.fields.join(', ')||'record changed'}`));
    });

    addSingleton(plan,'payroll','Payroll Time Card',payrollStore?.[storeKey],data.payroll);
    addSingleton(plan,'snapshot','Humanity Snapshot',snapshots?.[storeKey],data.snapshot);
    addSingleton(plan,'folioStart','Starting Folio',folioStarts?.[start],data.folioStart);
    addSingleton(plan,'reportDate','Report Date',window.reportDates?.[storeKey],data.reportDate);
    addSingleton(plan,'periodStatus','Pay Period Status',window.periodStatuses?.[storeKey],data.periodStatus);
    addSingleton(plan,'folioHistory','Folio History',window.folioHistory?.[start],data.folioHistory);

    const localActiveSession=(window.onCallSessions||[]).find(s=>s?.status==='ACTIVE');
    const sourceActiveSession=(data.onCallSessions||[]).find(s=>s?.status==='ACTIVE');
    if(localActiveSession&&sourceActiveSession&&String(localActiveSession.id)!==String(sourceActiveSession.id)){
      plan.blocking.push('Both devices contain different ACTIVE On-Call sessions. Close the active session on one device and export again before merging.');
    }
    const localActiveWork=clean(state.activeId),sourceActiveWork=clean(data.reportableWork.activeId);
    if(localActiveWork&&sourceActiveWork&&localActiveWork!==sourceActiveWork){
      plan.blocking.push('Both devices contain different active Mandatory/Snow work timelines. Finish or close one active work timeline before merging.');
    }
    return plan;
  }

  function ensureReviewStyles(){
    if($('#v0731TransferStyles'))return;
    const s=document.createElement('style');s.id='v0731TransferStyles';s.textContent=`
      #v0731TransferCard .v0731-transfer-grid{display:grid;grid-template-columns:minmax(210px,1fr) auto auto;gap:8px;align-items:end}
      #v0731TransferCard select{width:100%;border:1px solid #cbd5dc;border-radius:9px;padding:9px;background:#fff}
      #v0731TransferCard .v0731-import-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}
      .v0731-backdrop{position:fixed;inset:0;z-index:100000;background:rgba(18,28,38,.55);display:grid;place-items:center;padding:16px}
      .v0731-dialog{width:min(720px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.28);padding:18px}
      .v0731-dialog h3{margin:0}.v0731-summary{margin-top:12px;padding:10px;border-radius:10px;background:#f4f8fb;font-weight:750}
      .v0731-change-list{margin-top:10px;display:grid;gap:6px}.v0731-change{font-size:11px;padding:7px 9px;border:1px solid #dce5ea;border-radius:8px;background:#fff}
      .v0731-warning{margin-top:10px;padding:10px;border-radius:10px;background:#fff4e5;color:#7a4b00;font-weight:700}
      .v0731-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:15px}
      @media(max-width:720px){#v0731TransferCard .v0731-transfer-grid{grid-template-columns:1fr}#v0731TransferCard .v0731-transfer-grid button{width:100%}.v0731-actions button{flex:1;min-width:140px}}
    `;document.head.appendChild(s);
  }

  function ensureTransferUI(){
    ensureReviewStyles();
    if($('#v0731TransferCard'))return;
    const advanced=$('#settings > details.card.form-details');
    const card=document.createElement('div');card.id='v0731TransferCard';card.className='card';
    card.innerHTML=`
      <div><h3 style="margin:0">Pay Period Transfer</h3><div class="muted tiny top-space">Move one 14-day work period between iPhone, iPad or another device. Import merges by stable record ID: new records are added, identical records are skipped, and changed existing records can be updated. It never clears the rest of the device.</div></div>
      <div class="v0731-transfer-grid top-space">
        <label><span class="tiny"><b>Pay Period</b></span><select id="v0731PeriodSelect"></select></label>
        <button type="button" class="primary" id="v0731ExportCurrent">Export Current Pay Period</button>
        <button type="button" class="secondary" id="v0731ExportSelected">Export Selected Period</button>
      </div>
      <div class="v0731-import-row"><label class="secondary" id="v0731ImportLabel"><input type="file" id="v0731ImportFile" accept="application/json" hidden>Import / Merge Pay Period</label><span class="muted tiny">A local safety snapshot of the affected period is created before any merge is written.</span></div>`;
    if(advanced)advanced.insertAdjacentElement('beforebegin',card);else $('#settings')?.appendChild(card);
    $('#v0731ExportCurrent').onclick=()=>exportPeriod(currentPeriodStart);
    $('#v0731ExportSelected').onclick=()=>exportPeriod($('#v0731PeriodSelect')?.value||currentPeriodStart);
    $('#v0731ImportFile').onchange=handleImportFile;
    refreshPeriodSelect();
  }

  function refreshPeriodSelect(){
    const select=$('#v0731PeriodSelect');if(!select)return;
    const keep=select.value||currentPeriodStart,periods=collectPeriods();
    select.innerHTML=periods.map(p=>`<option value="${p}">${mdy(p)} – ${mdy(endFor(p))}${p===currentPeriodStart?' · Current':''}</option>`).join('');
    select.value=periods.includes(keep)?keep:currentPeriodStart;
  }

  function reviewImport(plan,fileName){
    return new Promise(resolve=>{
      const old=$('#v0731ImportReview');old?.remove();
      const back=document.createElement('div');back.id='v0731ImportReview';back.className='v0731-backdrop';
      const changed=plan.changedDetails.slice(0,14);
      const more=Math.max(0,plan.changedDetails.length-changed.length);
      back.innerHTML=`<div class="v0731-dialog" role="dialog" aria-modal="true">
        <h3>Merge Pay Period</h3>
        <div class="muted tiny top-space">${esc(fileName)} · ${mdy(plan.data.periodStart)} – ${mdy(plan.data.periodEnd)}</div>
        <div class="v0731-summary">${plan.counts.added} new · ${plan.counts.changed} existing with changes · ${plan.counts.identical} already identical</div>
        ${plan.blocking.length?`<div class="v0731-warning">${plan.blocking.map(esc).join('<br>')}</div>`:''}
        ${changed.length?`<div class="v0731-change-list"><b class="tiny">Changed existing records</b>${changed.map(x=>`<div class="v0731-change">${esc(x)}</div>`).join('')}${more?`<div class="muted tiny">+ ${more} more changed record(s)</div>`:''}</div>`:''}
        <div class="muted tiny top-space">Update Existing uses the imported version only for matching IDs/data that changed. Records that exist only on this device are never deleted.</div>
        <div class="v0731-actions"><button type="button" class="secondary" data-action="cancel">Cancel</button><button type="button" class="secondary" data-action="keep" ${plan.blocking.length?'disabled':''}>Add New / Keep Local</button><button type="button" class="primary" data-action="update" ${plan.blocking.length?'disabled':''}>Add New / Update Existing</button></div>
      </div>`;
      document.body.appendChild(back);
      const finish=value=>{back.remove();resolve(value)};
      back.addEventListener('click',e=>{const a=e.target?.dataset?.action;if(a)finish(a)});
    });
  }

  function saveSafetySnapshot(start){
    const data=packageFor(start);
    const payload={kind:'oncall-period-import-safety',version:VERSION,savedAt:nowISO(),periodStart:start,data};
    try{localStorage.setItem(K.periodImportSafety,JSON.stringify(payload));return true}catch(err){
      try{data.snapshot=null;localStorage.setItem(K.periodImportSafety,JSON.stringify(payload));return true}catch(err2){console.error('Pay Period safety snapshot failed',err2);return false}
    }
  }

  function mergeRows(localRows,sourceRows,mode){
    const out=localRows||[],index=new Map(out.map((x,i)=>[String(x?.id||''),i]).filter(x=>x[0]));
    for(const source of sourceRows||[]){
      if(!source?.id)continue;
      const key=String(source.id),i=index.get(key);
      if(i===undefined){index.set(key,out.length);out.push(clone(source));continue}
      if(!same(out[i],source)&&mode==='update')out[i]=clone(source);
    }
    return out;
  }

  function applySingleton(name,source,mode,start){
    if(source===null||source===undefined)return;
    const storeKey=keyFor(start);
    if(name==='payroll'){
      if(payrollStore[storeKey]===undefined||mode==='update')payrollStore[storeKey]=clone(source);
      save(K.payroll,payrollStore);return;
    }
    if(name==='snapshot'){
      if(snapshots[storeKey]===undefined||mode==='update')snapshots[storeKey]=clone(source);
      save(K.snap,snapshots);return;
    }
    if(name==='folioStart'){
      if(folioStarts[start]===undefined||mode==='update')folioStarts[start]=clone(source);
      save(K.folios,folioStarts);return;
    }
    if(name==='reportDate'&&K.reportDates){
      window.reportDates=window.reportDates||{};
      if(window.reportDates[storeKey]===undefined||mode==='update')window.reportDates[storeKey]=clone(source);
      save(K.reportDates,window.reportDates);return;
    }
    if(name==='periodStatus'&&K.periodStatus){
      window.periodStatuses=window.periodStatuses||{};
      if(window.periodStatuses[storeKey]===undefined||mode==='update')window.periodStatuses[storeKey]=clone(source);
      save(K.periodStatus,window.periodStatuses);return;
    }
    if(name==='folioHistory'&&K.folioHistory){
      window.folioHistory=window.folioHistory||{};
      if(window.folioHistory[start]===undefined||mode==='update')window.folioHistory[start]=clone(source);
      save(K.folioHistory,window.folioHistory);
    }
  }

  function applyImport(plan,mode){
    const data=plan.data,start=data.periodStart;
    if(!saveSafetySnapshot(start))throw new Error('Could not create the local pre-import safety snapshot. No data was changed. Export a Full Backup first or free storage space, then try again.');

    events=mergeRows(events||[],data.events,mode);save(K.events,events);
    if(K.sessions){window.onCallSessions=mergeRows(window.onCallSessions||[],data.onCallSessions,mode);save(K.sessions,window.onCallSessions)}
    if(K.emergencyDrafts){window.emergencyDrafts=mergeRows(window.emergencyDrafts||[],data.emergencyDrafts,mode);save(K.emergencyDrafts,window.emergencyDrafts)}

    if(K.reportableWork){
      const state=rwState();state.activities=mergeRows(state.activities||[],data.reportableWork.activities,mode);
      if(!state.activeId&&data.reportableWork.activeId&&state.activities.some(a=>a.id===data.reportableWork.activeId))state.activeId=data.reportableWork.activeId;
      window.reportableWorkState=state;save(K.reportableWork,state);
    }

    if(K.activeDraft&&!load(K.activeDraft,'')&&data.activeDraftId&&(window.emergencyDrafts||[]).some(d=>d.id===data.activeDraftId&&d.workflowStatus!=='CLOSED'))save(K.activeDraft,data.activeDraftId);

    plan.singletons.forEach(x=>applySingleton(x.name,x.source,mode,start));
    currentPeriodStart=start;save(K.period,currentPeriodStart);
    if(typeof learnFromExistingEvents==='function')learnFromExistingEvents();
    try{sessionStorage.removeItem('ocma_ios_print_job')}catch(e){}
    renderAll();refreshPeriodSelect();
  }

  async function handleImportFile(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      const raw=JSON.parse(await file.text()),data=normalizePackage(raw),plan=analyzeImport(data);
      const action=await reviewImport(plan,file.name);
      if(action==='cancel'||!action)return;
      if(plan.blocking.length)return;
      const mode=action==='update'?'update':'keep';
      applyImport(plan,mode);
      toast(`Pay period merged safely: ${plan.counts.added} new, ${mode==='update'?plan.counts.changed:0} updated, ${plan.counts.identical} identical skipped.`);
    }catch(err){console.error(err);toast('Pay Period import failed: '+(err?.message||String(err)))}
    finally{e.target.value=''}
  }

  const baseRenderSettingsV0731=renderSettings;
  renderSettings=function(){baseRenderSettingsV0731();ensureTransferUI();refreshPeriodSelect()};
  const baseRenderAllV0731=renderAll;
  renderAll=function(){baseRenderAllV0731();ensureTransferUI();refreshPeriodSelect()};

  ensureTransferUI();refreshPeriodSelect();
})();
