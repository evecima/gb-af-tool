/* v0.7.14 — Mandatory Overtime field rules + calmer Reportable Work palette */
(function(){
  const WORK_ORDERS_LABEL='Working on Work Orders';
  const seenEventIds=new Set((events||[]).map(e=>e.id));

  function ensureStyles(){
    if($('#v0714MandatoryStyles'))return;
    const st=document.createElement('style');
    st.id='v0714MandatoryStyles';
    st.textContent=`
      #reportableWork .v070-choice,
      #reportableWork .v078-pool-choice{background:#fafbfa;border-color:#d8e0de}
      #reportableWork .v070-plan{background:#eef4f2!important;color:#31534f!important}
      #reportableWork .v070-active,
      #reportableWork .v078-pool-active{border-color:#2f6f68!important;background:#f3f8f6!important}
      #reportableWork .v070-pill{background:#e4f0ed!important;color:#285e58!important}
      #reportableWork .v070-pill.paused{background:#fff0d2!important;color:#8b6500!important}
      #reportableWork #v070StartMandatory,
      #reportableWork #v070StartSnow,
      #reportableWork #v078OpenPool,
      #reportableWork #v078ClosePool,
      #reportableWork #v070Resume,
      #reportableWork #v078PoolResume{
        background:#2f6f68!important;border-color:#2f6f68!important;color:#fff!important;box-shadow:none!important
      }
      #reportableWork #v070StartMandatory:hover:not(:disabled),
      #reportableWork #v070StartSnow:hover:not(:disabled),
      #reportableWork #v078OpenPool:hover:not(:disabled),
      #reportableWork #v078ClosePool:hover:not(:disabled),
      #reportableWork #v070Resume:hover:not(:disabled),
      #reportableWork #v078PoolResume:hover:not(:disabled){background:#285e58!important;border-color:#285e58!important}
      #reportableWork #v070StartMandatory:disabled,
      #reportableWork #v070StartSnow:disabled,
      #reportableWork #v078OpenPool:disabled,
      #reportableWork #v078ClosePool:disabled{
        background:#dfe5e4!important;border-color:#dfe5e4!important;color:#7a8785!important;opacity:1!important
      }
      #reportableWork #v072ChangeWorkBtn,
      #reportableWork #v070SavePlan{background:#e8ecef!important;border-color:#d5dde1!important;color:#34424d!important}
      #reportableWork .v072-change-panel{background:#f8faf9!important;border-color:#d8e0de!important}
      #reportableWork .v0714-hidden{display:none!important}
      #reportableWork .v0714-optional-note{display:block;margin-top:3px;color:#718078;font-size:10px;font-weight:600}
    `;
    document.head.appendChild(st);
  }

  function removeSnowOption(sel){
    if(!sel)return;
    [...sel.options].forEach(o=>{if(String(o.value||o.textContent||'').trim().toLowerCase()==='snow removal')o.remove()});
    if(sel.value==='Snow Removal')sel.value='Prep';
  }

  function clearLocation(input){
    if(!input)return;
    input.value='';input.dataset.apartmentCode='';input.dataset.fullAddress='';
    const wrap=input.closest('.v072-apartment-wrap');
    wrap?.querySelector('.v072-results')?.classList.add('hidden');
    const chosen=wrap?.nextElementSibling;
    if(chosen?.classList?.contains('v072-selected-address')){chosen.textContent='';chosen.classList.add('hidden')}
  }

  function setLocationLabel(label,text,optional=false){
    if(!label)return;
    const title=label.querySelector(':scope > span');if(title)title.textContent=text;
    let note=label.querySelector('.v0714-optional-note');
    if(optional){if(!note){note=document.createElement('small');note.className='v0714-optional-note';note.textContent='Optional for this activity.';label.appendChild(note)}}else note?.remove();
  }

  function applySetupRules(){
    const sel=$('#v072MandatoryActivity'),custom=$('#v072MandatoryCustom'),hidden=$('#v070MandatoryTask'),loc=$('#v070MandatoryLocation');
    if(!sel||!hidden||!loc)return;
    removeSnowOption(sel);
    const locLabel=loc.closest('label'),mode=sel.value||'Prep';
    if(custom)custom.placeholder='Describe Work / Activity';
    if(mode==='Work Orders'){
      custom?.classList.add('hidden');locLabel?.classList.add('v0714-hidden');clearLocation(loc);hidden.value=WORK_ORDERS_LABEL;
    }else if(mode==='Other Work'){
      custom?.classList.remove('hidden');locLabel?.classList.remove('v0714-hidden');setLocationLabel(locLabel,'Location / Apt / Area (optional)',true);hidden.value=(custom?.value||'').trim()||'Other Work';
    }else{
      sel.value='Prep';custom?.classList.add('hidden');locLabel?.classList.remove('v0714-hidden');setLocationLabel(locLabel,'Location / Apt / Area',false);hidden.value='Prep';
    }
  }

  function activeMandatory(){
    const st=window.reportableWorkState,a=st?.activities?.find(x=>x.id===st.activeId);
    return a&&a.type==='mandatory_ot'&&a.status!=='CLOSED'?a:null;
  }

  function initializeActiveSelector(){
    const sel=$('#v072ActiveActivity'),custom=$('#v072ActiveCustom');
    if(!sel||sel.dataset.v0714Initialized==='1')return;
    removeSnowOption(sel);
    const a=activeMandatory();
    if(a){
      const cur=String(a.currentLabel||'Prep').trim();
      if(cur===WORK_ORDERS_LABEL||cur==='Work Orders'){sel.value='Work Orders';if(custom)custom.value=''}
      else if(cur==='Prep'){sel.value='Prep';if(custom)custom.value=''}
      else{sel.value='Other Work';if(custom)custom.value=cur}
    }
    sel.dataset.v0714Initialized='1';
  }

  function applyActiveRules(){
    const sel=$('#v072ActiveActivity'),custom=$('#v072ActiveCustom'),loc=$('#v072ActiveLocation');
    if(!sel||!loc)return;
    removeSnowOption(sel);
    const locLabel=loc.closest('label'),mode=sel.value||'Prep';
    if(custom)custom.placeholder='Describe Work / Activity';
    if(mode==='Work Orders'){
      custom?.classList.add('hidden');locLabel?.classList.add('v0714-hidden');clearLocation(loc);
    }else if(mode==='Other Work'){
      custom?.classList.remove('hidden');locLabel?.classList.remove('v0714-hidden');setLocationLabel(locLabel,'Location / Apt / Area (optional)',true);
    }else{
      sel.value='Prep';custom?.classList.add('hidden');locLabel?.classList.remove('v0714-hidden');setLocationLabel(locLabel,'Location / Apt / Area',false);
    }
  }

  function validateSetupStart(ev){
    const sel=$('#v072MandatoryActivity'),custom=$('#v072MandatoryCustom'),hidden=$('#v070MandatoryTask'),loc=$('#v070MandatoryLocation');
    if(!sel||!hidden||!loc)return true;
    applySetupRules();
    if(sel.value==='Prep'){
      if(!String(loc.value||'').trim()){ev.preventDefault();ev.stopImmediatePropagation();toast('Prep requires a Location / Apt / Area.');return false}
      hidden.value='Prep';
    }else if(sel.value==='Work Orders'){
      clearLocation(loc);hidden.value=WORK_ORDERS_LABEL;
    }else{
      const desc=String(custom?.value||'').trim();
      if(!desc){ev.preventDefault();ev.stopImmediatePropagation();toast('Describe the Other Work activity before starting Mandatory Overtime.');return false}
      hidden.value=desc;
    }
    return true;
  }

  function prepareActiveChange(ev){
    const sel=$('#v072ActiveActivity'),custom=$('#v072ActiveCustom'),loc=$('#v072ActiveLocation');
    if(!sel||!loc)return true;
    applyActiveRules();
    if(sel.value==='Prep'){
      if(!String(loc.value||'').trim()){ev.preventDefault();ev.stopImmediatePropagation();toast('Prep requires a Location / Apt / Area.');return false}
    }else if(sel.value==='Work Orders'){
      clearLocation(loc);sel.value='Other Work';if(custom){custom.classList.remove('hidden');custom.value=WORK_ORDERS_LABEL}
    }else{
      const desc=String(custom?.value||'').trim();
      if(!desc){ev.preventDefault();ev.stopImmediatePropagation();toast('Describe the Other Work activity before changing work.');return false}
    }
    return true;
  }

  function normalizeNewMandatoryEvents(){
    let changed=false;
    for(const e of events||[]){
      if(seenEventIds.has(e.id))continue;
      seenEventIds.add(e.id);
      if(e?.type==='mandatory_ot'&&e.source==='reportable-work-v070'&&String(e.timeReceived||'')===String(e.in||'')){
        e.timeReceived='';e.reportableTimeReceivedNA=true;changed=true;
      }
    }
    if(changed)save(K.events,events);
  }

  function enhance(){ensureStyles();applySetupRules();initializeActiveSelector();applyActiveRules();normalizeNewMandatoryEvents()}

  document.addEventListener('change',e=>{
    if(e.target?.id==='v072MandatoryActivity')setTimeout(applySetupRules,0);
    if(e.target?.id==='v072ActiveActivity')setTimeout(applyActiveRules,0);
  },true);
  document.addEventListener('input',e=>{if(e.target?.id==='v072MandatoryCustom')setTimeout(applySetupRules,0)},true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#v070StartMandatory')){validateSetupStart(e);return}
    if(e.target?.closest?.('#v072ChangeWorkBtn')){prepareActiveChange(e);return}
  },true);

  const baseRenderAllV0714=renderAll;
  renderAll=function(){baseRenderAllV0714();setTimeout(enhance,0);setTimeout(enhance,90);setTimeout(enhance,260)};
  const baseGoV0714=go;
  go=function(id){baseGoV0714(id);if(id==='reportableWork'){setTimeout(enhance,0);setTimeout(enhance,100)}};
  enhance();
})();
