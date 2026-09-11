/* v0.6.7 — Report Date belongs to Payroll/pay period; auto-propose first Monday after period end */
(function(){
  K.reportDates=NS+'report_dates';
  window.reportDates=load(K.reportDates,{});

  const reportKey=(start=currentPeriodStart)=>`${workerId()||'local'}|${start}`;
  const periodLocked=start=>!!(window.isPeriodLocked&&window.isPeriodLocked(start));

  function proposedReportDate(start=currentPeriodStart){
    let d=parseISO(addDays(start,13));
    do d.setDate(d.getDate()+1); while(d.getDay()!==1);
    return iso(d);
  }

  function migrateLegacyOnce(){
    if(Object.keys(window.reportDates||{}).length||!settings.reportDate)return;
    const r=settings.reportDate;
    try{
      const containing=periodForDate(r),prior=addDays(containing,-14),priorEnd=addDays(prior,13);
      if(r>priorEnd&&r<=addDays(priorEnd,3)){
        window.reportDates[reportKey(prior)]=r;
        save(K.reportDates,window.reportDates);
      }
    }catch(e){}
  }

  function reportDateFor(start=currentPeriodStart){
    const k=reportKey(start);
    if(!window.reportDates[k]){
      window.reportDates[k]=proposedReportDate(start);
      save(K.reportDates,window.reportDates);
    }
    return window.reportDates[k];
  }

  function syncLegacyReportDate(){
    settings.reportDate=reportDateFor(currentPeriodStart);
    return settings.reportDate;
  }

  function removeReportDateFromSettings(){
    const f=$('#settingsForm');
    const old=f?.elements?.reportDate;
    old?.closest('label')?.remove();
    $('#useTodayBtn')?.remove();
    const p=$('#settings .screen-head p');
    if(p)p.textContent=settings.language==='es'?'Configuración local del técnico. La Fecha del Reporte se administra dentro de Payroll Time Card.':'Local technician settings. Report Date is managed inside Payroll Time Card.';
  }

  function ensureStyles(){
    if($('#v067ReportDateStyles'))return;
    const s=document.createElement('style');s.id='v067ReportDateStyles';s.textContent=`
      .payroll-report-date-card{padding:12px 14px}
      .payroll-report-date-card .report-date-main{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .payroll-report-date-card .report-date-field{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;font-weight:800}
      .payroll-report-date-card input[type=date]{min-width:155px}
      .payroll-report-date-card .report-date-help{margin-top:4px}
      @media(max-width:640px){.payroll-report-date-card .report-date-field{width:100%}.payroll-report-date-card input[type=date]{flex:1}}
    `;document.head.appendChild(s);
  }

  function ensurePayrollReportDateUI(){
    ensureStyles();
    const bar=$('#payroll .periodbar');if(!bar)return;
    let card=$('#workflowPayrollReportDate');
    if(!card){
      card=document.createElement('div');card.id='workflowPayrollReportDate';card.className='card payroll-report-date-card';
      card.innerHTML=`<div class="report-date-main"><div><b>Report Date</b><div id="workflowReportDateHelp" class="muted tiny report-date-help"></div></div><label class="report-date-field"><span>Delivery / Signature Date</span><input type="date" id="workflowReportDateInput"></label></div>`;
      bar.insertAdjacentElement('afterend',card);
      $('#workflowReportDateInput').onchange=e=>{
        const start=currentPeriodStart;
        if(periodLocked(start)){e.target.value=reportDateFor(start);return toast('This pay period is DELIVERED / LOCKED. Unlock it before changing Report Date.');}
        const value=e.target.value||proposedReportDate(start);
        window.reportDates[reportKey(start)]=value;save(K.reportDates,window.reportDates);syncLegacyReportDate();
        updateDashboard();
        toast(`Report Date saved for ${mdy(start)} – ${mdy(addDays(start,13))}: ${mdy(value)}.`);
      };
    }
    const input=$('#workflowReportDateInput'),help=$('#workflowReportDateHelp'),value=reportDateFor(currentPeriodStart),suggested=proposedReportDate(currentPeriodStart),locked=periodLocked(currentPeriodStart);
    if(input){input.value=value;input.disabled=locked;input.title=locked?'Unlock this pay period to change Report Date.':'Editable delivery/signature date for this pay period.'}
    if(help)help.textContent=locked?`🔒 ${mdy(currentPeriodStart)} – ${mdy(addDays(currentPeriodStart,13))} · Unlock the pay period to change this date.`:`Suggested automatically: first Monday after the pay period (${mdy(suggested)}). Change it if you deliver on another day.`;
  }

  function refreshDashboardReportDate(){
    syncLegacyReportDate();
    const meta=$('#workflowPayrollCardMeta');
    if(meta){
      const rows=meta.querySelectorAll('.meta-row');
      if(rows[1]){
        const value=rows[1].querySelector('.meta-value');if(value)value.textContent=mdy(reportDateFor(currentPeriodStart));
      }
    }
  }

  migrateLegacyOnce();syncLegacyReportDate();

  const baseRenderPayroll=renderPayroll;
  renderPayroll=function(){syncLegacyReportDate();baseRenderPayroll();ensurePayrollReportDateUI()};

  const baseUpdateDashboard=updateDashboard;
  updateDashboard=function(){syncLegacyReportDate();baseUpdateDashboard();refreshDashboardReportDate()};

  const baseRenderSettings=renderSettings;
  renderSettings=function(){baseRenderSettings();removeReportDateFromSettings()};

  const baseRenderAll=renderAll;
  renderAll=function(){syncLegacyReportDate();baseRenderAll();removeReportDateFromSettings();ensurePayrollReportDateUI();refreshDashboardReportDate()};

  const exportBtn=$('#exportDataBtn');
  if(exportBtn)exportBtn.onclick=()=>{
    syncLegacyReportDate();
    const activeDraftId=load(K.activeDraft,'')||'';
    const data={version:'0.6.7',settings,currentPeriodStart,payrollStore,snapshots,events,problems,folioStarts,localKnowledge,vendors,periodStatuses:window.periodStatuses||{},onCallSessions:window.onCallSessions||[],emergencyDrafts:window.emergencyDrafts||[],activeDraftId,reportDates:window.reportDates||{}};
    const text=JSON.stringify(data,null,2),blob=new Blob([text],{type:'application/json'}),name='oncall-maintenance-v0.6.7-backup.json';
    try{const file=new File([blob],name,{type:'application/json'});if(navigator.canShare?.({files:[file]})){navigator.share({files:[file],title:name}).catch(()=>{});return}}catch(e){}
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  };

  const importInput=$('#importDataFile'),baseImport=importInput?.onchange;
  if(importInput&&baseImport){
    importInput.onchange=async e=>{
      const file=e.target.files?.[0];let imported=null;
      if(file){try{const d=JSON.parse(await file.text());if(d.reportDates&&typeof d.reportDates==='object')imported=d.reportDates}catch(err){}}
      await baseImport.call(importInput,e);
      if(imported){window.reportDates={...(window.reportDates||{}),...imported};save(K.reportDates,window.reportDates)}
      syncLegacyReportDate();renderAll();
    };
  }

  removeReportDateFromSettings();ensurePayrollReportDateUI();refreshDashboardReportDate();
})();
