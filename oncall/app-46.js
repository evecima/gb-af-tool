/* v0.7.15 — Mandatory Overtime: one MR, standalone Emergency MR, segmented Summary */
(function(){
  const VERSION='0.7.15';
  const WORK_ORDERS='Working on Work Orders';

  const rwState=()=>window.reportableWorkState||{activities:[]};
  const drafts=()=>window.emergencyDrafts||[];
  const activityById=id=>(rwState().activities||[]).find(a=>a.id===id)||null;
  const activityForEvent=e=>activityById(e?.reportableWorkId)||(rwState().activities||[]).find(a=>a.parentEventId===e?.id)||null;
  const clean=s=>String(s||'').trim();
  const normLabel=s=>clean(s)==='Work Orders'?WORK_ORDERS:clean(s)||'Work';
  const eventLoc=e=>clean(e?.locationCode||e?.manualLocation||e?.fullAddress||'');
  const min=t=>t?mins(t):0;
  const dur=(a,b)=>Math.max(0,min(b)-min(a));
  const durHM=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  const durWords=n=>{const h=Math.floor(n/60),m=n%60;return [h?`${h} hr${h===1?'':'s'}`:'',m?`${m} min`:''].filter(Boolean).join(' ')||'0 min'};

  function relatedEmergencies(activityId){
    if(!activityId)return[];
    const dIds=new Set(drafts().filter(d=>d.reportableWorkId===activityId).map(d=>d.id));
    return (events||[]).filter(e=>e?.type==='emergency'&&(e.groupedReportableWorkId===activityId||dIds.has(e.draftId)))
      .sort((a,b)=>String((a.date||'')+(a.in||'')).localeCompare(String((b.date||'')+(b.in||''))));
  }

  function combinedSegments(e){
    const a=activityForEvent(e);
    const base=clone((e?.reportableSegments?.length?e.reportableSegments:a?.segments)||[]);
    const refs=new Set(base.filter(s=>s.kind==='emergency').map(s=>s.refEventId).filter(Boolean));
    for(const em of relatedEmergencies(a?.id||e?.reportableWorkId)){
      if(!em.in||!em.out||refs.has(em.id))continue;
      base.push({kind:'emergency',start:em.in,end:em.out,label:em.problem||'Emergency',location:eventLoc(em),refEventId:em.id,synthetic:true});
    }
    return base.filter(s=>s?.start&&s?.end).sort((x,y)=>String(x.start).localeCompare(String(y.start)));
  }

  function workSegments(e){return combinedSegments(e).filter(s=>s.kind!=='emergency').map(s=>({...s,label:normLabel(s.label)}))}
  function emergencySegments(e){return combinedSegments(e).filter(s=>s.kind==='emergency')}

  function interruptionSentence(e,s){
    const work=workSegments(e),after=work.find(w=>min(w.start)>=min(s.end));
    const where=clean(s.location),what=clean(s.label)||'Emergency';
    const detail=`${what}${where?' · '+where:''}`;
    const a=activityForEvent(e);
    if(after)return `Interrupted by Emergency from ${clock(s.start)} to ${clock(s.end)} — ${detail}. Mandatory Overtime resumed at ${clock(after.start)}.`;
    if(a?.end&&s.start===a.end)return `Mandatory Overtime ended when Emergency response began at ${clock(s.start)} — ${detail}.`;
    return `Interrupted by Emergency from ${clock(s.start)} to ${clock(s.end)} — ${detail}. Mandatory Overtime was not resumed.`;
  }

  function timelineLines(e){
    return combinedSegments(e).map(s=>s.kind==='emergency'
      ?`Interrupted by Emergency ${clock(s.start)}–${clock(s.end)} — ${clean(s.label)||'Emergency'}${clean(s.location)?' · '+clean(s.location):''}`
      :`${clock(s.start)}–${clock(s.end)} — ${normLabel(s.label)}${clean(s.location)?' · '+clean(s.location):''}`);
  }

  function reconcileMandatory(){
    let changed=false;
    const st=rwState();
    for(const a of st.activities||[]){
      if(a?.type!=='mandatory_ot')continue;
      for(const em of relatedEmergencies(a.id)){
        if(em.suppressStandaloneReport!==false){em.suppressStandaloneReport=false;changed=true}
        if(em.groupedReportableWorkId!==a.id){em.groupedReportableWorkId=a.id;changed=true}
        if(!em.requestNumber&&typeof ensureEventFolio==='function'){ensureEventFolio(em);changed=true}
      }
      if(a.status!=='CLOSED'||!a.parentEventId)continue;
      const e=(events||[]).find(x=>x.id===a.parentEventId);if(!e)continue;
      if(!Array.isArray(e.reportableSegments)||!e.reportableSegments.length){e.reportableSegments=clone(a.segments||[]);changed=true}
      if(!e.mandatoryV0715Prepared){
        if((e.timeReceived===e.in||e.reportableTimeReceivedNA)&&e.source==='reportable-work-v070'){e.timeReceived='';e.reportableTimeReceivedNA=true}
        const ints=emergencySegments(e);
        if(ints.length&&!clean(e.specialInstructions))e.specialInstructions=ints.map(s=>interruptionSentence(e,s)).join(' ');
        e.mandatoryActualMinutes=workSegments(e).reduce((n,s)=>n+dur(s.start,s.end),0);
        e.mandatoryV0715Prepared=true;
        changed=true;
      }
    }
    if(changed){save(K.events,events);if(K.reportableWork)save(K.reportableWork,st)}
    return changed;
  }

  function expandedSummaryRows(){
    reconcileMandatory();
    const rows=[];
    for(const e of eventsPeriod()){
      if(e.type!=='mandatory_ot'){rows.push(e);continue}
      const segs=workSegments(e);
      if(!segs.length){rows.push(e);continue}
      segs.forEach((s,i)=>rows.push({
        id:`${e.id}-seg-${i}`,type:'mandatory_ot',date:e.date,in:s.start,out:s.end,
        problem:normLabel(s.label),locationCode:clean(s.location),manualLocation:'',fullAddress:'',
        worker:e.worker,source:'mandatory-segment-v0715',parentMandatoryEventId:e.id
      }));
    }
    return rows.sort((a,b)=>String((a.date||'')+(a.in||'')).localeCompare(String((b.date||'')+(b.in||''))));
  }

  function renderSegmentSummary(){
    const es=expandedSummaryRows(),body=$('#summaryRows');if(!body)return;
    $('#summaryPeriod').textContent=`EMPLOYEE: ${workerName()} · Pay Period Beginning ${mdy(currentPeriodStart)} · Ending ${mdy(periodEnd())}`;
    body.innerHTML=es.length?es.map(e=>`<tr><td>${mdy(e.date)}</td><td>${clock(e.in)}</td><td>${clock(e.out)}</td><td>${esc(eventLabel(e))}</td><td>${esc(locationLabel(e))}</td></tr>`).join(''):'<tr><td colspan="5" class="muted">No events.</td></tr>';
  }

  function installSummaryPreview(){
    const b=$('#previewSummaryBtn');if(!b)return;
    b.onclick=()=>{
      const es=expandedSummaryRows(),p=$('#summaryPreview');p.classList.remove('hidden');p.classList.add('print-target');
      const grouped={};es.forEach(e=>(grouped[e.date]??=[]).push(e));
      Object.values(grouped).forEach(a=>a.sort((x,y)=>(x.in||'').localeCompare(y.in||'')));
      const maxPerDay=Math.max(0,...Object.values(grouped).map(a=>a.length)),pageCount=Math.max(1,Math.ceil(maxPerDay/3));
      p.innerHTML=`<div class="row between"><h3>ON-CALL TIME SUMMARY — Preview</h3><button class="secondary" onclick="printForm('summary')">Print</button></div>${Array.from({length:pageCount},(_,i)=>summaryPage(i,pageCount,grouped)).join('')}`;
      p.scrollIntoView({behavior:'smooth'});
    };
  }

  function customizeMandatoryPreview(id){
    const e=(events||[]).find(x=>x.id===id);if(!e||e.type!=='mandatory_ot')return;
    const segs=workSegments(e),ints=emergencySegments(e),paper=$('#requestPreview .maintenance-request-paper');if(!paper)return;
    const all=timelineLines(e);
    const workText=paper.querySelector('.mr-work-text');
    if(workText&&all.length)workText.innerHTML=all.map(x=>`<div>${esc(x)}</div>`).join('');
    const special=paper.querySelector('.mr-special');
    const note=ints.map(s=>interruptionSentence(e,s)).join(' ');
    if(special&&note)special.innerHTML=`<b>SPECIAL INSTRUCTIONS</b>${esc(note)}`;
    const tbody=paper.querySelector('.mr-worker-table tbody');
    if(tbody&&segs.length){
      const rows=segs.map(s=>`<tr><td>${esc(e.worker||workerName())}</td><td>${mdy(e.date)}</td><td>${clock(s.start)}</td><td>${clock(s.end)}</td><td>${durHM(dur(s.start,s.end))}</td><td></td><td></td></tr>`);
      while(rows.length<4)rows.push('<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>');
      tbody.innerHTML=rows.join('');
    }
    const actual=segs.reduce((n,s)=>n+dur(s.start,s.end),0),remarks=paper.querySelector('.mr-remarks-text');
    if(remarks&&actual){const base=clean(remarks.textContent);const add=`Actual Mandatory work: ${durWords(actual)}.`;if(!base.includes('Actual Mandatory work:'))remarks.textContent=[base,add].filter(Boolean).join(' | ')}
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0715Wrapped){
    const base=previewRequest;
    const wrapped=function(id){reconcileMandatory();base(id);customizeMandatoryPreview(id);setTimeout(()=>customizeMandatoryPreview(id),0)};
    wrapped.__v0715Wrapped=true;previewRequest=wrapped;
  }

  const baseRenderSummary=renderSummary;
  renderSummary=function(){reconcileMandatory();renderSegmentSummary();installSummaryPreview()};

  function refresh(){reconcileMandatory();installSummaryPreview();if($('#summary')?.classList.contains('active'))renderSegmentSummary()}
  function schedule(){[0,120,500,1000,1800,2800].forEach(ms=>setTimeout(refresh,ms))}

  const baseRenderAllV0715=renderAll;
  renderAll=function(){baseRenderAllV0715();schedule()};
  const baseGoV0715=go;
  go=function(id){baseGoV0715(id);if(id==='summary')setTimeout(renderSegmentSummary,0);schedule()};

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.workflow-card-close,#workflowOutBtn,#v070Finish,#v070Resume,#v072ChangeWorkBtn'))schedule();
  },true);
  document.addEventListener('submit',e=>{if(e.target?.id==='fieldEmergencyForm'||e.target?.id==='eventEditorForm')schedule()},true);

  schedule();
})();
