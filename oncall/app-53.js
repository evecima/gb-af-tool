/* v0.7.29 — Dedicated Mandatory Overtime segment editor.
   Closed Mandatory records edit their structured work timeline directly so Preview,
   On-Call Summary and printed TIME CARD stay synchronized. */
(function(){
  const VERSION='0.7.29';
  const FORM_ID='eventEditorForm';
  const SECTION_ID='v0729MandatorySegments';
  const WORK_ORDERS='Working on Work Orders';

  const clean=v=>String(v??'').trim();
  const timeOk=t=>/^\d{2}:\d{2}$/.test(clean(t));
  const timeMinutes=t=>timeOk(t)?Number(t.slice(0,2))*60+Number(t.slice(3,5)):null;
  const normalizeLabel=v=>clean(v)==='Work Orders'?WORK_ORDERS:clean(v);
  const state=()=>window.reportableWorkState||null;

  function activityFor(ev){
    const s=state();if(!s?.activities||!ev)return null;
    return s.activities.find(a=>a.id===ev.reportableWorkId||a.parentEventId===ev.id)||null;
  }

  function emergencyEventFor(seg){
    return seg?.refEventId?(events||[]).find(e=>e.id===seg.refEventId&&e.type==='emergency')||null:null;
  }

  function segmentLocationFromEvent(e){
    return clean(e?.locationCode||e?.manualLocation||e?.fullAddress);
  }

  function segmentsFor(ev){
    const a=activityFor(ev);
    const source=clone((Array.isArray(ev?.reportableSegments)&&ev.reportableSegments.length?ev.reportableSegments:a?.segments)||[]);
    const activityId=a?.id||ev?.reportableWorkId||'';
    const seenRefs=new Set();

    for(const seg of source){
      seg.kind=seg.kind==='emergency'?'emergency':'work';
      seg.label=normalizeLabel(seg.label);
      if(seg.kind==='emergency'){
        const ref=emergencyEventFor(seg);
        if(ref){
          seg.start=ref.in||seg.start||'';
          seg.end=ref.out||seg.end||'';
          seg.label=ref.problem||seg.label||'Emergency';
          seg.location=segmentLocationFromEvent(ref)||seg.location||'';
          seg.fullAddress=ref.fullAddress||seg.fullAddress||'';
        }
        if(seg.refEventId)seenRefs.add(seg.refEventId);
      }
    }

    if(activityId){
      for(const em of events||[]){
        if(em?.type!=='emergency'||seenRefs.has(em.id))continue;
        if(em.groupedReportableWorkId!==activityId)continue;
        source.push({
          kind:'emergency',start:em.in||'',end:em.out||'',label:em.problem||'Emergency',
          location:segmentLocationFromEvent(em),fullAddress:em.fullAddress||'',refEventId:em.id
        });
        seenRefs.add(em.id);
      }
    }

    return source.filter(s=>timeOk(s.start)&&timeOk(s.end))
      .sort((x,y)=>(timeMinutes(x.start)||0)-(timeMinutes(y.start)||0));
  }

  function timelineText(segs){
    return segs.slice().sort((a,b)=>(timeMinutes(a.start)||0)-(timeMinutes(b.start)||0)).map(s=>{
      const label=s.kind==='emergency'?('Emergency: '+(clean(s.label)||'Emergency')):normalizeLabel(s.label);
      return `${clock(s.start)}–${clock(s.end)} — ${label}${clean(s.location)?' · '+clean(s.location):''}`;
    }).join('\n');
  }

  function ensureStyles(){
    if($('#v0729MandatoryStyles'))return;
    const st=document.createElement('style');st.id='v0729MandatoryStyles';st.textContent=`
      #${SECTION_ID}{border:1px solid #cbd9e2;border-radius:12px;background:#f7fafc;padding:12px;margin:2px 0 6px}
      #${SECTION_ID}.hidden{display:none!important}
      #${SECTION_ID} .v0729-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}
      #${SECTION_ID} .v0729-head b{font-size:13px}
      #${SECTION_ID} .v0729-help{font-size:10px;color:#657684;margin-top:3px;max-width:720px}
      #${SECTION_ID} .v0729-overall{margin-top:9px;padding:8px 10px;border-radius:9px;background:#eaf3f8;font-size:11px;font-weight:750;color:#29485b}
      #${SECTION_ID} .v0729-list{display:grid;gap:7px;margin-top:9px}
      #${SECTION_ID} .v0729-row{display:grid;grid-template-columns:108px 108px minmax(145px,1fr) minmax(135px,1fr) 44px;gap:7px;align-items:end;padding:8px;border:1px solid #dbe4ea;border-radius:10px;background:#fff}
      #${SECTION_ID} .v0729-row.v0729-emergency{grid-template-columns:108px 108px minmax(180px,1fr) minmax(135px,1fr);background:#fff5f3;border-color:#f0d2cb}
      #${SECTION_ID} .v0729-cell{min-width:0}
      #${SECTION_ID} .v0729-cell>span{display:block;font-size:9px;font-weight:800;color:#5b6b76;margin-bottom:3px;text-transform:uppercase;letter-spacing:.02em}
      #${SECTION_ID} input{width:100%;min-width:0;border:1px solid #cbd5dc;border-radius:8px;padding:8px;background:#fff}
      #${SECTION_ID} .v0729-emergency-value{min-height:36px;display:flex;align-items:center;padding:7px 8px;border-radius:8px;background:#fff;color:#4f3a35;font-size:11px;font-weight:650}
      #${SECTION_ID} .v0729-remove{width:44px;min-height:36px;padding:6px 0}
      #${SECTION_ID} .v0729-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:9px}
      #${SECTION_ID} .v0729-error{color:#a62b1f;font-size:11px;font-weight:700;min-height:15px;margin-top:6px}
      #eventEditorForm.v0729-mandatory-mode input[name="in"],
      #eventEditorForm.v0729-mandatory-mode input[name="out"]{background:#eef3f6;color:#40515d;font-weight:700}
      #eventEditorForm.v0729-mandatory-mode .v0729-hide-for-mandatory{display:none!important}
      @media(max-width:760px){
        #${SECTION_ID} .v0729-row,#${SECTION_ID} .v0729-row.v0729-emergency{grid-template-columns:1fr 1fr}
        #${SECTION_ID} .v0729-cell.v0729-wide{grid-column:1/-1}
        #${SECTION_ID} .v0729-remove{grid-column:2;justify-self:end}
      }
    `;document.head.appendChild(st);
  }

  function ensureSection(){
    ensureStyles();
    const f=$('#'+FORM_ID);if(!f)return null;
    let section=$('#'+SECTION_ID);if(section)return section;
    section=document.createElement('div');section.id=SECTION_ID;section.className='span2 hidden';
    section.innerHTML=`
      <div class="v0729-head"><div><b>Mandatory Work Segments</b><div class="v0729-help">Edit the actual overtime timeline here. Start/End above are calculated from the first and last work segment. Emergency interruptions are locked and remain managed by their own Maintenance Request.</div></div></div>
      <div class="v0729-overall" id="v0729Overall">Overall Mandatory: —</div>
      <div class="v0729-list" id="v0729SegmentList"></div>
      <div class="v0729-actions"><button type="button" class="secondary" id="v0729AddSegment">+ Add Segment</button><span class="muted tiny">Gaps are allowed; overlapping segments are not.</span></div>
      <div class="v0729-error" id="v0729SegmentError"></div>`;
    const outLabel=f.elements?.out?.closest('label');
    if(outLabel)outLabel.insertAdjacentElement('afterend',section);else f.prepend(section);
    $('#v0729AddSegment').onclick=addWorkRow;
    return section;
  }

  function workRow(seg={}){
    const row=document.createElement('div');row.className='v0729-row v0729-work';row.dataset.kind='work';
    row.dataset.originalLocation=clean(seg.location);row.dataset.fullAddress=clean(seg.fullAddress);
    row.innerHTML=`
      <label class="v0729-cell"><span>Start</span><input type="time" class="v0729-start" value="${esc(seg.start||'')}"></label>
      <label class="v0729-cell"><span>End</span><input type="time" class="v0729-end" value="${esc(seg.end||'')}"></label>
      <label class="v0729-cell v0729-wide"><span>Activity</span><input class="v0729-label" list="v0729ActivityOptions" value="${esc(normalizeLabel(seg.label||'')||'Work')}" placeholder="Drywall / Work Orders / Prep..."></label>
      <label class="v0729-cell v0729-wide"><span>Location</span><input class="v0729-location" value="${esc(seg.location||'')}" placeholder="3548-425A / Building / Area"></label>
      <button type="button" class="dangerbtn v0729-remove" title="Delete work segment" aria-label="Delete work segment">×</button>`;
    row.querySelector('.v0729-remove').onclick=()=>{row.remove();syncDerivedTimes();clearError()};
    row.querySelectorAll('input').forEach(i=>{i.addEventListener('input',()=>{syncDerivedTimes();clearError()});i.addEventListener('change',()=>{syncDerivedTimes();clearError()})});
    return row;
  }

  function emergencyRow(seg){
    const row=document.createElement('div');row.className='v0729-row v0729-emergency';row.dataset.kind='emergency';
    row.dataset.start=clean(seg.start);row.dataset.end=clean(seg.end);row.dataset.label=clean(seg.label)||'Emergency';
    row.dataset.location=clean(seg.location);row.dataset.fullAddress=clean(seg.fullAddress);row.dataset.refEventId=clean(seg.refEventId);
    row.innerHTML=`
      <div class="v0729-cell"><span>Start</span><div class="v0729-emergency-value">${esc(clock(seg.start))}</div></div>
      <div class="v0729-cell"><span>End</span><div class="v0729-emergency-value">${esc(clock(seg.end))}</div></div>
      <div class="v0729-cell v0729-wide"><span>Locked Emergency</span><div class="v0729-emergency-value">${esc(seg.label||'Emergency')}</div></div>
      <div class="v0729-cell v0729-wide"><span>Location</span><div class="v0729-emergency-value">${esc(seg.location||'—')}</div></div>`;
    return row;
  }

  function ensureDatalist(){
    if($('#v0729ActivityOptions'))return;
    const dl=document.createElement('datalist');dl.id='v0729ActivityOptions';
    dl.innerHTML=['Working on Work Orders','Prep','Drywall','Snow Removal','Painting','Plumbing','Electrical','HVAC','Other Work'].map(x=>`<option value="${x}"></option>`).join('');
    document.body.appendChild(dl);
  }

  function renderSegments(ev){
    const section=ensureSection();if(!section)return;
    ensureDatalist();
    const list=$('#v0729SegmentList');list.innerHTML='';
    const segs=segmentsFor(ev);
    segs.forEach(seg=>list.appendChild(seg.kind==='emergency'?emergencyRow(seg):workRow(seg)));
    if(!list.querySelector('.v0729-work'))list.appendChild(workRow({start:ev.in||'',end:ev.out||'',label:'Work',location:''}));
    syncDerivedTimes();
  }

  function addWorkRow(){
    const list=$('#v0729SegmentList');if(!list)return;
    const workRows=[...list.querySelectorAll('.v0729-work')];
    const last=workRows[workRows.length-1];
    const start=last?.querySelector('.v0729-end')?.value||'';
    const row=workRow({start,end:'',label:'',location:''});
    list.appendChild(row);row.querySelector('.v0729-label')?.focus();syncDerivedTimes();
  }

  function rowSegments(){
    const list=$('#v0729SegmentList');if(!list)return[];
    const out=[];
    list.querySelectorAll('.v0729-row').forEach(row=>{
      if(row.dataset.kind==='emergency'){
        out.push({kind:'emergency',start:row.dataset.start||'',end:row.dataset.end||'',label:row.dataset.label||'Emergency',location:row.dataset.location||'',fullAddress:row.dataset.fullAddress||'',refEventId:row.dataset.refEventId||''});
        return;
      }
      const location=clean(row.querySelector('.v0729-location')?.value);
      out.push({
        kind:'work',
        start:clean(row.querySelector('.v0729-start')?.value),
        end:clean(row.querySelector('.v0729-end')?.value),
        label:normalizeLabel(row.querySelector('.v0729-label')?.value),
        location,
        fullAddress:location===row.dataset.originalLocation?(row.dataset.fullAddress||''):''
      });
    });
    return out;
  }

  function workSegmentsFromRows(){
    return rowSegments().filter(s=>s.kind==='work'&&timeOk(s.start)&&timeOk(s.end));
  }

  function derivedBounds(){
    const work=workSegmentsFromRows().sort((a,b)=>timeMinutes(a.start)-timeMinutes(b.start));
    if(!work.length)return {start:'',end:''};
    return {start:work[0].start,end:work.reduce((best,s)=>timeMinutes(s.end)>timeMinutes(best)?s.end:best,work[0].end)};
  }

  function syncDerivedTimes(){
    const f=$('#'+FORM_ID);if(!f||String(f.elements?.type?.value||'')!=='mandatory_ot')return;
    const {start,end}=derivedBounds();
    if(start)f.elements.in.value=start;if(end)f.elements.out.value=end;
    const overall=$('#v0729Overall');
    if(overall)overall.textContent=start&&end?`Overall Mandatory: ${clock(start)}–${clock(end)} · calculated from work segments`:'Overall Mandatory: complete at least one work segment.';
  }

  function setError(msg=''){
    const box=$('#v0729SegmentError');if(box)box.textContent=msg;
  }
  function clearError(){setError('')}

  function validateSegments(segs){
    const work=segs.filter(s=>s.kind==='work');
    if(!work.length)return 'Mandatory Overtime needs at least one work segment.';
    for(const s of work){
      if(!timeOk(s.start)||!timeOk(s.end))return 'Every work segment needs a valid Start and End time.';
      if(timeMinutes(s.end)<=timeMinutes(s.start))return `Work segment ${clock(s.start)} must end after it starts.`;
      if(!clean(s.label))return 'Every work segment needs an Activity.';
    }
    for(const s of segs.filter(s=>s.kind==='emergency')){
      if(!timeOk(s.start)||!timeOk(s.end)||timeMinutes(s.end)<=timeMinutes(s.start))return 'A linked Emergency has invalid saved times. Edit that Emergency before changing Mandatory Overtime.';
    }
    const sorted=segs.slice().sort((a,b)=>timeMinutes(a.start)-timeMinutes(b.start));
    for(let i=1;i<sorted.length;i++){
      if(timeMinutes(sorted[i].start)<timeMinutes(sorted[i-1].end)){
        return `Segments overlap: ${clock(sorted[i-1].start)}–${clock(sorted[i-1].end)} and ${clock(sorted[i].start)}–${clock(sorted[i].end)}.`;
      }
    }
    const bounds=derivedBounds();
    for(const s of segs.filter(s=>s.kind==='emergency')){
      if(timeMinutes(s.start)<timeMinutes(bounds.start)||timeMinutes(s.end)>timeMinutes(bounds.end)){
        return `The locked Emergency ${clock(s.start)}–${clock(s.end)} would fall outside the edited Mandatory window. Keep surrounding work segments or edit the Emergency relationship separately.`;
      }
    }
    return '';
  }

  function totalWorkMinutes(segs){
    return segs.filter(s=>s.kind==='work').reduce((n,s)=>n+Math.max(0,timeMinutes(s.end)-timeMinutes(s.start)),0);
  }

  function persistSegments(ev,segs,form){
    const oldSegs=segmentsFor(ev),oldTimeline=timelineText(oldSegs),newTimeline=timelineText(segs);
    const work=segs.filter(s=>s.kind==='work').sort((a,b)=>timeMinutes(a.start)-timeMinutes(b.start));
    const first=work[0],last=work.reduce((best,s)=>timeMinutes(s.end)>timeMinutes(best.end)?s:best,work[0]);

    ev.reportableSegments=clone(segs);
    ev.in=first.start;ev.out=last.end;
    ev.mandatoryActualMinutes=totalWorkMinutes(segs);
    if(form?.elements?.in)form.elements.in.value=ev.in;
    if(form?.elements?.out)form.elements.out.value=ev.out;

    const currentSolution=clean(form?.elements?.solution?.value);
    if(form?.elements?.solution&&(!currentSolution||currentSolution===clean(oldTimeline)))form.elements.solution.value=newTimeline;

    const a=activityFor(ev);
    if(a){
      a.segments=clone(segs);a.start=ev.in;a.end=ev.out;a.status='CLOSED';a.parentEventId=ev.id;
      a.currentSegmentStart='';a.resumeEligible=false;a.pausedByEmergencyDraftId='';
      a.currentLabel=last.label||a.currentLabel;a.currentLocation=last.location||'';a.currentFullAddress=last.fullAddress||'';
      a.updatedAt=new Date().toISOString();
      if(state()?.activeId===a.id)state().activeId='';
      if(K.reportableWork)save(K.reportableWork,state());
    }
    save(K.events,events);
  }

  function genericLocationLabel(){
    const f=$('#'+FORM_ID);return f?.elements?.locationCode?.closest('label')||null;
  }

  function quickTitleWrap(){
    return $('#v075EditProblemQuick')?.closest('.v075-editor-quick')||null;
  }

  function setMandatoryMode(ev){
    const f=$('#'+FORM_ID),section=ensureSection();if(!f||!section)return;
    const isMandatory=ev?.type==='mandatory_ot';
    f.classList.toggle('v0729-mandatory-mode',isMandatory);
    f.dataset.v0729MandatorySegments=isMandatory?'1':'';
    section.classList.toggle('hidden',!isMandatory);
    if(f.elements?.in)f.elements.in.readOnly=isMandatory;
    if(f.elements?.out)f.elements.out.readOnly=isMandatory;

    const locLabel=genericLocationLabel();if(locLabel)locLabel.classList.toggle('v0729-hide-for-mandatory',isMandatory);
    const quick=quickTitleWrap();if(quick)quick.classList.toggle('v0729-hide-for-mandatory',isMandatory);

    if(isMandatory){
      if(f.elements?.problem){f.elements.problem.value='Mandatory Overtime';f.elements.problem.readOnly=true}
      renderSegments(ev);
    }else{
      if(f.elements?.problem&&f.elements.problem.classList.contains('v0729-fixed-title'))f.elements.problem.readOnly=false;
      clearError();
    }
  }

  if(typeof openEventEditor==='function'&&!openEventEditor.__v0729Wrapped){
    const baseOpen=openEventEditor;
    const wrapped=function(id){
      const result=baseOpen(id);
      const ev=(events||[]).find(e=>String(e.id)===String(id));
      setTimeout(()=>setMandatoryMode(ev),0);
      setTimeout(()=>setMandatoryMode(ev),90);
      return result;
    };
    wrapped.__v0729Wrapped=true;openEventEditor=wrapped;
  }

  const form=$('#'+FORM_ID);
  if(form&&typeof form.onsubmit==='function'&&!form.onsubmit.__v0729Wrapped){
    const baseSubmit=form.onsubmit;
    const wrappedSubmit=async function(e){
      const ev=(events||[]).find(x=>x.id===editingEventId);
      if(ev?.type==='mandatory_ot'){
        const segs=rowSegments();
        const error=validateSegments(segs);
        if(error){
          e.preventDefault();e.stopPropagation();setError(error);toast(error);return;
        }
        persistSegments(ev,segs,form);
      }
      return baseSubmit.call(this,e);
    };
    wrappedSubmit.__v0729Wrapped=true;form.onsubmit=wrappedSubmit;
  }

  document.addEventListener('change',e=>{
    const f=$('#'+FORM_ID);if(!f||!f.contains(e.target))return;
    if(e.target===f.elements?.type){
      const ev=(events||[]).find(x=>x.id===editingEventId);
      setTimeout(()=>setMandatoryMode({...ev,type:f.elements.type.value}),0);
    }
  },true);

  ensureSection();
})();