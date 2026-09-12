/* v0.6.9 — complete device backup/restore for Phase 1 phone ↔ PC transfer */
(function(){
  const VERSION='0.6.9';
  const exportBtn=$('#exportDataBtn'),importInput=$('#importDataFile');
  if(!exportBtn||!importInput)return;

  function namespacedStorage(){
    const out={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key);
    }
    return out;
  }

  function fullBackupObject(){
    return {
      kind:'oncall-maintenance-backup',
      version:VERSION,
      schema:1,
      exportedAt:new Date().toISOString(),
      settings:clone(settings),
      currentPeriodStart,
      payrollStore:clone(payrollStore||{}),
      snapshots:clone(snapshots||{}),
      events:clone(events||[]),
      problems:clone(problems||[]),
      folioStarts:clone(folioStarts||{}),
      localKnowledge:clone(localKnowledge||[]),
      vendors:clone(vendors||[]),
      periodStatuses:clone(window.periodStatuses||{}),
      onCallSessions:clone(window.onCallSessions||[]),
      emergencyDrafts:clone(window.emergencyDrafts||[]),
      activeDraftId:load(K.activeDraft,'')||'',
      reportDates:clone(window.reportDates||{}),
      folioHistory:clone(window.folioHistory||{}),
      storage:namespacedStorage()
    };
  }

  async function deliverBackup(){
    const data=fullBackupObject();
    const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json';
    const blob=new Blob([text],{type});
    try{
      const file=new File([blob],name,{type});
      if(navigator.canShare?.({files:[file]})){
        try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}
      }
    }catch(e){}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  }

  function looksLikeBackup(d){
    if(!d||typeof d!=='object'||Array.isArray(d))return false;
    if(d.kind==='oncall-maintenance-backup')return true;
    return !!(d.settings&&(d.payrollStore||Array.isArray(d.events)||d.currentPeriodStart));
  }

  function summaryOf(d){
    const eventCount=Array.isArray(d.events)?d.events.length:0;
    const sessionCount=Array.isArray(d.onCallSessions)?d.onCallSessions.length:0;
    const openCount=Array.isArray(d.emergencyDrafts)?d.emergencyDrafts.filter(x=>x?.workflowStatus!=='CLOSED').length:0;
    const lockedCount=d.periodStatuses&&typeof d.periodStatuses==='object'?Object.values(d.periodStatuses).filter(x=>x?.locked).length:0;
    return `Backup ${d.version||'legacy'} · ${eventCount} saved event(s) · ${sessionCount} on-call session(s) · ${openCount} open call(s) · ${lockedCount} locked period(s)`;
  }

  function clearOnCallNamespace(){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(NS))keys.push(k)}
    keys.forEach(k=>localStorage.removeItem(k));
  }

  function putJson(key,value){if(!key||value===undefined)return;localStorage.setItem(key,JSON.stringify(value))}

  function restoreStructured(d){
    putJson(K.settings,d.settings||{});
    putJson(K.period,d.currentPeriodStart||periodForDate(todayISO()));
    putJson(K.payroll,d.payrollStore||{});
    putJson(K.snap,d.snapshots||{});
    putJson(K.events,Array.isArray(d.events)?d.events:[]);
    if(Array.isArray(d.problems))putJson(K.problems,d.problems);
    putJson(K.folios,d.folioStarts||{});
    putJson(K.knowledge,Array.isArray(d.localKnowledge)?d.localKnowledge:[]);
    if(Array.isArray(d.vendors))putJson(K.vendors,d.vendors);
    if(K.periodStatus)putJson(K.periodStatus,d.periodStatuses||{});
    if(K.sessions)putJson(K.sessions,Array.isArray(d.onCallSessions)?d.onCallSessions:[]);
    if(K.emergencyDrafts)putJson(K.emergencyDrafts,Array.isArray(d.emergencyDrafts)?d.emergencyDrafts:[]);
    if(K.activeDraft)putJson(K.activeDraft,d.activeDraftId||'');
    if(K.reportDates)putJson(K.reportDates,d.reportDates||{});
    if(K.folioHistory)putJson(K.folioHistory,d.folioHistory||{});
  }

  function restoreBackup(d){
    clearOnCallNamespace();
    if(d.storage&&typeof d.storage==='object'&&!Array.isArray(d.storage)){
      for(const [key,value] of Object.entries(d.storage)){
        if(key.startsWith(NS)&&typeof value==='string')localStorage.setItem(key,value);
      }
      // Structured values are also written so backups from a partially older build
      // cannot omit newly introduced keys that exist in the JSON payload.
      if(d.reportDates&&K.reportDates)putJson(K.reportDates,d.reportDates);
      if(d.folioHistory&&K.folioHistory)putJson(K.folioHistory,d.folioHistory);
      return;
    }
    restoreStructured(d);
  }

  exportBtn.textContent=settings.language==='es'?'Exportar Backup Completo JSON':'Export Full JSON Backup';
  exportBtn.title=settings.language==='es'?'Copia completa para respaldo o transferencia de teléfono a PC.':'Complete backup for safekeeping or phone-to-PC transfer.';
  exportBtn.onclick=deliverBackup;

  const importLabel=importInput.closest('label');
  if(importLabel){
    const text=settings.language==='es'?'Importar / Reemplazar Datos':'Import / Replace Device Data';
    const node=[...importLabel.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);
    if(node)node.textContent=text;else importLabel.append(document.createTextNode(text));
    importLabel.title=settings.language==='es'?'Reemplaza los datos locales de este dispositivo con el backup seleccionado.':'Replaces this device’s local On-Call data with the selected backup.';
  }

  importInput.onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const d=JSON.parse(await file.text());
      if(!looksLikeBackup(d))throw new Error('The selected JSON is not an On-Call Maintenance backup.');
      const info=summaryOf(d);
      const ok=await appConfirm(`${info}\n\nREPLACE the On-Call data currently stored on this device with this backup?\n\nThis is intended for phone → PC transfer. Existing local On-Call records on this device will be replaced, not merged. The source backup file is not changed.`,'Import / Replace Device Data');
      if(!ok)return;
      restoreBackup(d);
      try{sessionStorage.removeItem('ocma_ios_print_job')}catch(err){}
      toast('Backup restored. Reloading the app with the transferred data…');
      setTimeout(()=>location.reload(),700);
    }catch(err){
      console.error(err);toast('Import failed: '+(err?.message||String(err)));
    }finally{e.target.value=''}
  };

  // Small explanation directly in Advanced / Local Backup.
  const advanced=exportBtn.closest('details');
  if(advanced&&!$('#v069BackupHint')){
    const hint=document.createElement('div');hint.id='v069BackupHint';hint.className='notice good top-space';
    hint.textContent=settings.language==='es'?'Backup completo v0.6.9: incluye Payroll, eventos, llamadas abiertas, sesiones On-Call, folios, último folio, Knowledge Base, vendors, periodos bloqueados, Report Dates y configuración. Importar reemplaza los datos locales del dispositivo destino; no mezcla registros.':'Full v0.6.9 backup: includes Payroll, events, open calls, On-Call sessions, folios, last-folio history, Knowledge Base, vendors, locked periods, Report Dates and settings. Import replaces the destination device’s local data; it does not merge records.';
    exportBtn.closest('.row')?.insertAdjacentElement('afterend',hint);
  }
})();
