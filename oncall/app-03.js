function learnEvent(ev){
  if(!ev||ev.type!=='emergency')return false;
  const problem=(ev.problem||'').trim();
  if(!problem||/^emergency$/i.test(problem))return false;
  const finding=(ev.finding||'').trim(),solution=(ev.solution||'').trim(),result=(ev.remarks||ev.result||'').trim();
  if(!finding&&!solution&&!result)return false;
  const item={id:'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),problem,finding,solution,result,materials:ev.material?[ev.material]:[],vendor:(ev.vendor||'').trim(),vendorWork:(ev.vendorWork||'').trim(),source:'Local technician',active:true,updatedAt:new Date().toISOString()};
  const key=knowledgeKey(item),seedMatch=window.SEED_KNOWLEDGE.some(k=>knowledgeKey(k)===key),idx=localKnowledge.findIndex(k=>knowledgeKey(k)===key);
  if(seedMatch){refreshProblemFromKnowledge(problem);return false}
  if(idx>=0){item.id=localKnowledge[idx].id;localKnowledge[idx]={...localKnowledge[idx],...item};}
  else localKnowledge.unshift(item);
  save(K.knowledge,localKnowledge);refreshProblemFromKnowledge(problem);return true
}
function learnFromExistingEvents(){let n=0;events.forEach(e=>{if(learnEvent(e))n++});return n}

function formatFolio(n){const x=parseInt(n,10);return Number.isFinite(x)&&x>0?String(x).padStart(6,'0'):''}
function periodFolioStart(){const x=parseInt(folioStarts[currentPeriodStart],10);return Number.isFinite(x)&&x>0?x:null}
function assignPeriodFolios(start){
  const n=parseInt(start,10);if(!Number.isFinite(n)||n<1)return false;
  const es=eventsPeriod();es.forEach((e,i)=>e.requestNumber=formatFolio(n+i));
  folioStarts[currentPeriodStart]=n;save(K.folios,folioStarts);save(K.events,events);return true
}
function nextFolioForCurrentPeriod(){
  const start=periodFolioStart();if(!start)return'';
  const used=eventsPeriod().map(e=>parseInt(e.requestNumber,10)).filter(Number.isFinite);
  return formatFolio(used.length?Math.max(...used)+1:start)
}
function ensureEventFolio(e){if(!e.requestNumber&&inCurrentPeriod(e.date)){const n=nextFolioForCurrentPeriod();if(n)e.requestNumber=n}}
function requestUnitNo(e){
  const code=(e.locationCode||'').trim();
  if(!code||/^POOL$/i.test(code))return'';
  const m=code.match(/-(.+)$/);return m?m[1]:''
}
function requestLocationText(e){
  const unit=requestUnitNo(e),full=(e.fullAddress||'').trim();
  if(full&&unit){
    const rx=new RegExp('\\\\s+Apt\\\\s+'+unit.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'(?=,|$)','i');
    return full.replace(rx,'').replace(/\\s+,/g,',').trim();
  }
  return full||e.locationCode||e.manualLocation||''
}

function locationLabel(e){return e.locationCode||e.manualLocation||e.fullAddress||''}
function newBlock(inT='',outT='',source='manual',corrected=false){return {id:uid('blk'),in:inT,out:outT,originalIn:source==='pdf'?inT:'',originalOut:source==='pdf'?outT:'',source,inCorrected:corrected,outCorrected:corrected}}
function reportableMap(day){
 const map={}; const blocks=(day.blocks||[]).map(b=>({b,r:blockRange(b)})).filter(x=>x.r).sort((x,y)=>x.r[0]-y.r[0]); const dow=parseISO(day.date).getDay();
 if(dow===0||dow===6){blocks.forEach(x=>map[x.b.id]=[{start:x.r[0],end:x.r[1],reason:'Weekend'}]);return map}
 let remaining=480;
 for(const x of blocks){let [s,e]=x.r, segs=[];
   if(s<480){const pe=Math.min(e,480);if(pe>s)segs.push({start:s,end:pe,reason:'Before 8:00 AM'});s=Math.max(s,480)}
   if(e>s){if(remaining>0){const reg=Math.min(remaining,e-s);remaining-=reg;s+=reg}if(e>s)segs.push({start:s,end:e,reason:'After 8 regular hours'})}
   if(segs.length)map[x.b.id]=segs;
 }
 return map;
}
function segmentKey(s){return `${s.start}|${s.end}|${s.reason}`}
function isSegmentSkipped(b,s){return (b.skippedReportable||[]).includes(segmentKey(s))}
function linkedEventsForBlock(id){return events.filter(e=>validLinkedIds(e).includes(id))}
function dayUnlinkedEvents(date){return eventsPeriod().filter(e=>e.date===date&&!eventLinked(e))}
function eventFitsBlock(e,b){const er=blockRange(e),br=blockRange(b);return !!(er&&br&&er[0]>=br[0]-2&&er[1]<=br[1]+2)}
function dayHasCandidateForEvent(day,e){return (day.blocks||[]).some(b=>nearOrOverlap(e,{...b,date:day.date}))}
function renderPayroll(){updateDashboard();const days=getPayroll(),wrap=$('#daysEditor');wrap.innerHTML='';$('#resetImportedBtn').classList.toggle('hidden',!snapshots[periodKey()]);
 if(!days){wrap.innerHTML=`<div class="blank-state"><b>${settings.language==='es'?'TIME CARD vacío':'TIME CARD is empty'}</b><div class="top-space">${settings.language==='es'?'Importa Humanity, usa Introducir Manualmente o crea los 14 días. Los eventos guardados permanecen intactos.':'Import Humanity, choose Manual Entry, or create the 14 days. Saved events remain untouched.'}</div></div>`;return}
 days.forEach((day,di)=>{const rmap=reportableMap(day),fieldEvents=dayUnlinkedEvents(day.date),el=document.createElement('div');el.className='day-card';el.innerHTML=`<div class="day-head"><div><div class="day-title">${esc(fmtDate(day.date))}</div><div class="day-source">${esc(day.source==='pdf'?'Humanity PDF':day.source==='manual'?'Manual':'')}</div></div><div class="row gap wrap"><button class="secondary add-day-event" data-di="${di}">+ Event</button><button class="secondary add-block" data-di="${di}">+ IN/OUT</button></div></div><div class="blocks" id="blocks-${di}"></div>${fieldEvents.length?`<div class="day-field-events"><b>${settings.language==='es'?'Eventos capturados en campo/manual pendientes de conciliar':'Field/manual events awaiting reconciliation'}</b><div class="tiny muted">${settings.language==='es'?'Se administran aquí mismo, dentro del TIME CARD.':'Manage them here inside the TIME CARD.'}</div>${fieldEvents.map(e=>`<div class="field-event-line"><div><span class="chip event">${esc(eventTypeLabel(e.type))} · ${esc(clock(e.in))}${e.out?'–'+esc(clock(e.out)):''}</span> <span class="tiny">${esc(eventLabel(e))}</span></div><div class="row gap wrap">${dayHasCandidateForEvent(day,e)?`<button class="secondary review-field-event" data-id="${e.id}" data-di="${di}">${settings.language==='es'?'Conciliar':'Reconcile'}</button>`:(e.in&&e.out?`<button class="secondary add-field-payroll" data-id="${e.id}">${settings.language==='es'?'Agregar IN/OUT faltante':'Add Missing IN/OUT'}</button>`:'')}</div></div>`).join('')}</div>`:''}<label class="daily-note">${settings.language==='es'?'Nota para la manager':'Manager Note'}<input data-note="${di}" class="${day.note?'note-red':''}" value="${esc(day.note||'')}" placeholder="Birthday / Sick / Vacation / Holiday / Personal..."></label>`;wrap.appendChild(el);const be=el.querySelector(`#blocks-${di}`);
   if(!(day.blocks||[]).length)be.innerHTML=`<div class="muted" style="padding:9px">${settings.language==='es'?'Sin registros IN/OUT. Puedes crear un evento o agregar las horas faltantes aquí.':'No In/Out entries. You can create an event or add missing hours here.'}</div>`;
   (day.blocks||[]).forEach((b,bi)=>{const allSegs=rmap[b.id]||[],activeSegs=allSegs.filter(s=>!isSegmentSkipped(b,s)),skippedSegs=allSegs.filter(s=>isSegmentSkipped(b,s)),lev=linkedEventsForBlock(b.id),row=document.createElement('div');row.className='time-block '+(activeSegs.length?'reportable':'');const chips=[...activeSegs.map((s,si)=>`<span class="chip warn">⚠ ${clock(timeInput(s.start))}–${clock(timeInput(s.end))} · ${esc(s.reason)} <button class="skip-seg" data-di="${di}" data-bi="${bi}" data-key="${esc(segmentKey(s))}">${settings.language==='es'?'Omitir':'Skip'}</button></span>`),...skippedSegs.map(s=>`<span class="chip skipped">✓ ${clock(timeInput(s.start))}–${clock(timeInput(s.end))} · ${settings.language==='es'?'No reportable':'Not reportable'} <button class="undo-skip" data-di="${di}" data-bi="${bi}" data-key="${esc(segmentKey(s))}">${settings.language==='es'?'Deshacer':'Undo'}</button></span>`),...lev.map(e=>`<span class="chip event">${esc(eventTypeLabel(e.type))} · ${esc(clock(e.in))}${e.out?'–'+esc(clock(e.out)):''} <button class="edit-chip-event" data-di="${di}" data-bi="${bi}" data-id="${e.id}">${settings.language==='es'?'Editar':'Edit'}</button></span>`)].join('');row.innerHTML=`<label class="${b.inCorrected?'corrected':''}">IN<input type="time" data-di="${di}" data-bi="${bi}" data-f="in" value="${esc(b.in||'')}"></label><label class="${b.outCorrected?'corrected':''}">OUT<input type="time" data-di="${di}" data-bi="${bi}" data-f="out" value="${esc(b.out||'')}"></label><div class="block-info"><div class="report-chips">${chips||'<span class="muted tiny">No reportable/event tags</span>'}</div>${b.inCorrected||b.outCorrected?'<span class="correction-badge">CORRECTION</span>':''}</div><div class="block-actions row gap wrap"><button class="secondary split-events" data-di="${di}" data-bi="${bi}">${lev.length?(settings.language==='es'?'Administrar Eventos':'Manage Events'):(settings.language==='es'?'Eventos / Split':'Events / Split')}</button><button class="secondary mark-red" data-di="${di}" data-bi="${bi}">${settings.language==='es'?'Rojo':'Red'}</button><button class="secondary del-block" data-di="${di}" data-bi="${bi}">×</button></div>`;be.appendChild(row)});
 });
 $$('.add-block').forEach(b=>b.onclick=()=>{const days=ensureDays(),d=days[+b.dataset.di];d.blocks.push(newBlock('','',hoursMode==='manual'?'manual':'user',hoursMode==='review'));setPayroll(days);renderPayroll()});
 $$('.del-block').forEach(b=>b.onclick=async()=>{const days=getPayroll(),d=days[+b.dataset.di],blk=d.blocks[+b.dataset.bi];const linked=linkedEventsForBlock(blk.id);if(linked.length&&!await appConfirm(`${linked.length} event(s) are linked to this payroll block. Deleting the block will NOT delete those events; they will remain on this Payroll day for reconciliation. Continue?`,'Delete Payroll Block'))return;d.blocks.splice(+b.dataset.bi,1);setPayroll(days);renderPayroll()});
 $$('.mark-red').forEach(b=>b.onclick=()=>{const days=getPayroll(),x=days[+b.dataset.di].blocks[+b.dataset.bi];x.inCorrected=x.outCorrected=true;setPayroll(days);renderPayroll()});
 $$('#daysEditor input[type=time]').forEach(i=>i.onchange=()=>{const days=getPayroll(),b=days[+i.dataset.di].blocks[+i.dataset.bi];b[i.dataset.f]=i.value;if(hoursMode==='review')b[i.dataset.f+'Corrected']=true;setPayroll(days);renderPayroll()});
 $$('[data-note]').forEach(i=>i.oninput=()=>{const days=getPayroll();days[+i.dataset.note].note=i.value;setPayroll(days);i.classList.toggle('note-red',!!i.value)});
 $$('.skip-seg').forEach(x=>x.onclick=()=>{const days=getPayroll(),b=days[+x.dataset.di].blocks[+x.dataset.bi];b.skippedReportable=[...new Set([...(b.skippedReportable||[]),x.dataset.key])];setPayroll(days);renderPayroll()});
 $$('.undo-skip').forEach(x=>x.onclick=()=>{const days=getPayroll(),b=days[+x.dataset.di].blocks[+x.dataset.bi];b.skippedReportable=(b.skippedReportable||[]).filter(k=>k!==x.dataset.key);setPayroll(days);renderPayroll()});
 $$('.split-events').forEach(b=>{b.onclick=()=>openEventBuilderForBlock(+b.dataset.di,+b.dataset.bi)});
 $$('.edit-chip-event').forEach(b=>b.onclick=()=>openEventBuilderForBlock(+b.dataset.di,+b.dataset.bi,b.dataset.id));
 $$('.add-day-event').forEach(b=>b.onclick=()=>openEventBuilderManual(getPayroll()[+b.dataset.di].date));
 $$('.review-field-event').forEach(b=>b.onclick=()=>reconcileFieldEventFromDay(b.dataset.id,+b.dataset.di));
 $$('.add-field-payroll').forEach(b=>b.onclick=()=>addEventAsCorrection(b.dataset.id));
}
