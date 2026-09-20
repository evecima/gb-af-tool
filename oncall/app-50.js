/* v0.7.19 — Synchronize Mandatory from saved event segments even when activity history is absent. */
(function(){
  const state=()=>window.reportableWorkState;
  const cleanTime=t=>/^\d{2}:\d{2}$/.test(String(t||''))?String(t):'';
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
  const sameDay=(start,end)=>!!(start&&end&&minutes(start)<=minutes(end));
  const work=s=>s&&s.kind!=='emergency';
  const eligible=ev=>ev?.type==='mandatory_ot'&&ev.source==='reportable-work-v070';

  function mandatoryActivity(ev){
    if(!eligible(ev))return null;
    const a=state()?.activities?.find(x=>x.parentEventId===ev.id||(x.id===ev.reportableWorkId&&(!x.parentEventId||x.parentEventId===ev.id)));
    return a?.type==='mandatory_ot'&&a.status==='CLOSED'?a:null;
  }

  function segmentsFor(ev,a){
    // Event segments survive FULL exports even if reportableWork.activities is empty.
    return clone((Array.isArray(ev.reportableSegments)&&ev.reportableSegments.length?ev.reportableSegments:a?.segments)||[]);
  }

  function buildTimeline(segs){
    return segs.map(s=>`${clock(s.start)}–${clock(s.end)} — ${s.label||'Work'}${s.location?' · '+s.location:''}`).join('\n');
  }

  function syncMandatory(ev,commit=true){
    if(!eligible(ev))return {ok:true,changed:false};
    const a=mandatoryActivity(ev),segs=segmentsFor(ev,a);
    if(!segs.length)return {ok:true,changed:false};
    const start=cleanTime(ev.in),end=cleanTime(ev.out);
    if(!sameDay(start,end))return {ok:false,changed:false,reason:'Mandatory IN and OUT must be valid, same-day times.'};
    const first=segs.findIndex(work),last=segs.map(work).lastIndexOf(true);
    if(first<0||last<0)return {ok:true,changed:false};
    if(!segs.every(s=>sameDay(cleanTime(s.start),cleanTime(s.end))))return {ok:false,changed:false,reason:'A saved work segment has invalid hours.'};
    const changeStart=segs[first].start!==start,changeEnd=segs[last].end!==end;
    if(!changeStart&&!changeEnd)return {ok:true,changed:false};
    if(first!==0||last!==segs.length-1){
      return {ok:false,changed:false,reason:'Mandatory starts or finishes during an emergency. Review its full timeline before changing these boundaries.'};
    }
    if(!sameDay(start,segs[first].end)||!sameDay(segs[last].start,end)){
      return {ok:false,changed:false,reason:'The corrected time would cross an existing work segment. Review the timeline before saving.'};
    }
    const oldTimeline=buildTimeline(segs);
    const oldActivityTimeline=buildTimeline(a?.segments||[]);
    segs[first].start=start;segs[last].end=end;
    if(!commit)return {ok:true,changed:true};
    ev.reportableSegments=clone(segs);
    if(a){a.start=start;a.end=end;a.segments=clone(segs);a.updatedAt=new Date().toISOString()}
    const currentText=String(ev.solution||'').trim();
    if(!currentText||currentText===oldTimeline.trim()||currentText===oldActivityTimeline.trim())ev.solution=buildTimeline(segs);
    ev.mandatoryActualMinutes=segs.filter(work).reduce((n,s)=>n+Math.max(0,minutes(s.end)-minutes(s.start)),0);
    return {ok:true,changed:true,activityChanged:!!a};
  }

  function backupBeforeRepair(){
    const key=NS+'mandatory_edit_sync_backup_0719';
    try{
      if(localStorage.getItem(key))return true;
      localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),events:clone(events),reportableWork:clone(state())}));
      return true;
    }catch(error){console.warn('Mandatory sync backup unavailable',error);return false}
  }

  function repairSavedBoundaries(){
    const candidates=(events||[]).filter(eligible);
    const pending=candidates.map(ev=>({ev,check:syncMandatory(ev,false)})).filter(x=>x.check.changed);
    if(!pending.length)return false;
    if(!backupBeforeRepair()){
      toast('Mandatory synchronization needs storage space for a safety backup. Export a full backup before editing.');
      return false;
    }
    let changed=false,activityChanged=false;
    for(const {ev} of pending){
      const result=syncMandatory(ev,true);
      if(result.changed){changed=true;activityChanged=activityChanged||result.activityChanged}
      else if(!result.ok)console.warn('Mandatory timeline left unchanged:',ev.id,result.reason);
    }
    if(changed){
      if(activityChanged&&state()&&K.reportableWork)save(K.reportableWork,state());
      save(K.events,events);
    }
    return changed;
  }

  // Preview the generated timeline as the technician edits the boundary, without saving early.
  document.addEventListener('input',event=>{
    const form=event.target?.closest?.('#eventEditorForm');
    if(!form||!['in','out'].includes(event.target.name))return;
    const ev=(events||[]).find(x=>x.id===editingEventId);
    if(!eligible(ev)||!form.elements.solution)return;
    const original=segmentsFor(ev,mandatoryActivity(ev));
    if(!original.length||String(ev.solution||'').trim()!==buildTimeline(original).trim())return;
    const first=original.findIndex(work),last=original.map(work).lastIndexOf(true);
    if(first!==0||last!==original.length-1)return;
    const start=cleanTime(form.elements.in?.value),end=cleanTime(form.elements.out?.value);
    if(!sameDay(start,end)||!sameDay(start,original[first].end)||!sameDay(original[last].start,end))return;
    original[first].start=start;original[last].end=end;
    form.elements.solution.value=buildTimeline(original);
  },true);

  // Suppress the legacy editor's automatic Preview; return to the source list instead.
  let savingEditor=false;
  const basePreview=previewRequest;
  previewRequest=function(id){if(savingEditor)return;return basePreview(id)};
  document.addEventListener('submit',event=>{
    if(event.target?.id!=='eventEditorForm')return;
    const form=event.target,ev=(events||[]).find(x=>x.id===editingEventId);
    if(!ev)return;
    if(eligible(ev)){
      const candidate={...ev,in:form.elements.in?.value,out:form.elements.out?.value};
      const check=syncMandatory(candidate,false);
      if(!check.ok){event.preventDefault();event.stopImmediatePropagation();toast(check.reason);return}
      if(check.changed&&!backupBeforeRepair()){
        event.preventDefault();event.stopImmediatePropagation();toast('Export a full backup before editing Mandatory times: safety backup could not be saved.');return;
      }
    }
    const origin=[...document.querySelectorAll('.screen.active')].at(-1)?.id||'requests';
    const scroll=window.scrollY;
    savingEditor=true;
    setTimeout(()=>{
      savingEditor=false;
      if(repairSavedBoundaries())renderAll();
      const preview=$('#requestPreview');
      if(preview){preview.classList.add('hidden');preview.classList.remove('print-target');preview.innerHTML='';delete preview.dataset.previewEventId}
      if(origin&&document.getElementById(origin)&&!document.getElementById(origin).classList.contains('active'))go(origin);
      requestAnimationFrame(()=>window.scrollTo(0,scroll));
    },0);
  },true);

  // One-time safe migration of saved discrepancies; never modifies Humanity/Payroll.
  if(repairSavedBoundaries()){renderRequests();renderSummary()}
})();