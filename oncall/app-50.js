/* v0.7.18 — Single-save Mandatory boundary synchronization + return to source list. */
(function(){
  const state=()=>window.reportableWorkState;
  const cleanTime=t=>/^\d{2}:\d{2}$/.test(String(t||''))?String(t):'';
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
  const sameDay=(start,end)=>!!(start&&end&&minutes(start)<=minutes(end));
  const work=s=>s&&s.kind!=='emergency';

  function mandatoryActivity(ev){
    if(ev?.type!=='mandatory_ot'||ev.source!=='reportable-work-v070')return null;
    const st=state();
    const a=st?.activities?.find(x=>x.id===ev.reportableWorkId||x.parentEventId===ev.id);
    return a?.type==='mandatory_ot'&&a.status==='CLOSED'&&a.parentEventId===ev.id?a:null;
  }

  function buildTimeline(segs){
    return segs.map(s=>`${clock(s.start)}–${clock(s.end)} — ${s.label||'Work'}${s.location?' · '+s.location:''}`).join('\n');
  }

  function syncMandatory(ev,commit=true){
    const a=mandatoryActivity(ev);
    if(!a)return {ok:true,changed:false};
    const start=cleanTime(ev.in),end=cleanTime(ev.out);
    if(!sameDay(start,end))return {ok:false,reason:'The Mandatory IN and OUT must be valid, same-day times.'};
    const segs=clone((a.segments?.length?a.segments:ev.reportableSegments)||[]);
    if(!segs.length)return {ok:true,changed:false};
    const first=segs.findIndex(work),last=segs.map(work).lastIndexOf(true);
    // Edits to sessions bounded by an Emergency require an explicit timeline editor.
    if(first!==0||last!==segs.length-1)return {ok:true,changed:false};
    if(!segs.every(s=>sameDay(cleanTime(s.start),cleanTime(s.end))))return {ok:true,changed:false};
    const beforeStart=segs[first].start,beforeEnd=segs[last].end;
    const changeStart=beforeStart!==start,changeEnd=beforeEnd!==end;
    if(!changeStart&&!changeEnd)return {ok:true,changed:false};
    if(!sameDay(start,segs[first].end)||!sameDay(segs[last].start,end)){
      return {ok:false,reason:'The corrected time would cross an existing work segment. Review the timeline before saving.'};
    }
    const oldTimeline=buildTimeline(segs),oldActivityTimeline=buildTimeline(a.segments||[]);
    segs[first].start=start;segs[last].end=end;
    if(!commit)return {ok:true,changed:true};
    a.start=start;a.end=end;a.segments=clone(segs);a.updatedAt=new Date().toISOString();
    ev.reportableSegments=clone(segs);
    if(!String(ev.solution||'').trim()||[oldTimeline,oldActivityTimeline].includes(String(ev.solution||'').trim())){
      ev.solution=buildTimeline(segs);
    }
    ev.mandatoryActualMinutes=segs.filter(work).reduce((n,s)=>n+Math.max(0,minutes(s.end)-minutes(s.start)),0);
    return {ok:true,changed:true};
  }

  function backupBeforeRepair(){
    const key=NS+'mandatory_edit_sync_backup_0718';
    try{
      if(localStorage.getItem(key))return true;
      localStorage.setItem(key,JSON.stringify({savedAt:new Date().toISOString(),events:clone(events),reportableWork:clone(state())}));
      return true;
    }catch(error){console.warn('Mandatory sync backup unavailable',error);return false}
  }

  function repairSavedBoundaries(){
    const candidates=(events||[]).filter(ev=>mandatoryActivity(ev));
    if(!candidates.some(ev=>syncMandatory(ev,false).changed))return false;
    if(!backupBeforeRepair()){
      toast('Mandatory synchronization needs storage space for a safety backup. Export your full backup before editing.');
      return false;
    }
    let changed=false;
    for(const ev of candidates){
      const outcome=syncMandatory(ev);
      if(outcome.changed)changed=true;
      if(!outcome.ok)console.warn('Mandatory timeline left unchanged:',ev.id,outcome.reason);
    }
    if(changed){save(K.reportableWork,state());save(K.events,events)}
    return changed;
  }

  // Show the corrected generated text in the editor before Save, without altering stored data.
  document.addEventListener('input',event=>{
    const form=event.target?.closest?.('#eventEditorForm');
    if(!form||!['in','out'].includes(event.target.name))return;
    const ev=(events||[]).find(x=>x.id===editingEventId),a=mandatoryActivity(ev);
    if(!a||!form.elements.solution)return;
    const original=clone((a.segments?.length?a.segments:ev.reportableSegments)||[]);
    if(!original.length||String(ev.solution||'').trim()!==buildTimeline(original).trim())return;
    const first=original.findIndex(work),last=original.map(work).lastIndexOf(true);
    if(first!==0||last!==original.length-1)return;
    const start=cleanTime(form.elements.in?.value),end=cleanTime(form.elements.out?.value);
    if(!sameDay(start,end)||!sameDay(start,original[first].end)||!sameDay(original[last].start,end))return;
    original[first].start=start;original[last].end=end;
    form.elements.solution.value=buildTimeline(original);
  },true);

  // Preserve the editor's own field handling but stop its forced Preview navigation.
  let savingEditor=false;
  const basePreview=previewRequest;
  previewRequest=function(id){if(savingEditor)return;return basePreview(id)};

  document.addEventListener('submit',event=>{
    if(event.target?.id!=='eventEditorForm')return;
    const form=event.target,ev=(events||[]).find(x=>x.id===editingEventId);
    if(!ev)return;
    if(mandatoryActivity(ev)){
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
      const changed=repairSavedBoundaries();
      if(changed){renderAll()}
      const preview=$('#requestPreview');
      if(preview){preview.classList.add('hidden');preview.classList.remove('print-target');preview.innerHTML='';delete preview.dataset.previewEventId}
      if(origin&&document.getElementById(origin)&&!document.getElementById(origin).classList.contains('active'))go(origin);
      requestAnimationFrame(()=>window.scrollTo(0,scroll));
    },0);
  },true);

  // Repair previously saved, inconsistent Mandatory records without touching Humanity.
  if(repairSavedBoundaries()){
    renderRequests();renderSummary();
  }
})();
