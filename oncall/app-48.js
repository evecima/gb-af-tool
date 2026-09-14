/* v0.7.17 — Mandatory Maintenance Request uses community header; work locations stay in WORK REQUESTED */
(function(){
  const VERSION='0.7.17';
  const WORK_ORDERS='Working on Work Orders';

  const clean=s=>String(s||'').trim();
  const rwState=()=>window.reportableWorkState||{activities:[]};

  function communityName(){
    return clean(settings?.community)||'Greenbrier Apartments';
  }

  function activityForEvent(e){
    const st=rwState();
    return (st.activities||[]).find(a=>a.id===e?.reportableWorkId||a.parentEventId===e?.id)||null;
  }

  function mandatorySegments(e){
    const a=activityForEvent(e);
    return clone((Array.isArray(e?.reportableSegments)&&e.reportableSegments.length?e.reportableSegments:a?.segments)||[])
      .filter(s=>s?.start&&s?.end)
      .sort((x,y)=>String(x.start).localeCompare(String(y.start)));
  }

  function normalizeLabel(label){
    const v=clean(label);
    return v==='Work Orders'?WORK_ORDERS:(v||'Work');
  }

  function apartmentByCode(code){
    const c=clean(code).toUpperCase();
    if(!c)return null;
    return (window.APARTMENT_DATA||[]).find(a=>String(a.code||`${a.building||''}-${a.unit||''}`).trim().toUpperCase()===c)||null;
  }

  function segmentLocation(s){
    if(clean(s?.fullAddress))return clean(s.fullAddress);
    const loc=clean(s?.location);if(!loc)return'';
    const a=apartmentByCode(loc);
    if(a&&typeof apartmentAddress==='function')return apartmentAddress(a);
    return loc;
  }

  function workRequestedLines(e){
    return mandatorySegments(e).map(s=>{
      if(s.kind==='emergency'){
        const loc=segmentLocation(s);
        return `Interrupted by Emergency ${clock(s.start)}–${clock(s.end)} — ${clean(s.label)||'Emergency'}${loc?' · '+loc:''}`;
      }
      const loc=segmentLocation(s);
      return `${clock(s.start)}–${clock(s.end)} — ${normalizeLabel(s.label)}${loc?' · '+loc:''}`;
    });
  }

  function normalizeMandatoryMasterData(){
    let changed=false;
    const community=communityName();
    for(const e of events||[]){
      if(e?.type!=='mandatory_ot'||e.source!=='reportable-work-v070')continue;
      if(e.locationCode!==''){e.locationCode='';changed=true}
      if(e.fullAddress!==''){e.fullAddress='';changed=true}
      if(e.manualLocation!==community){e.manualLocation=community;changed=true}
    }
    if(changed)save(K.events,events);
  }

  function customizeMandatoryPreview(id){
    const e=(events||[]).find(x=>x.id===id);if(!e||e.type!=='mandatory_ot')return;
    const paper=$('#requestPreview .maintenance-request-paper');if(!paper)return;

    const loc=paper.querySelector('.mr-location-value');if(loc)loc.textContent=communityName();
    const no=paper.querySelector('.mr-location-no-line');if(no)no.textContent='';

    const lines=workRequestedLines(e),workText=paper.querySelector('.mr-work-text');
    if(workText&&lines.length)workText.innerHTML=lines.map(x=>`<div>${esc(x)}</div>`).join('');
  }

  if(typeof previewRequest==='function'&&!previewRequest.__v0717CommunityWrapped){
    const base=previewRequest;
    const wrapped=function(id){
      normalizeMandatoryMasterData();
      base(id);
      customizeMandatoryPreview(id);
      setTimeout(()=>customizeMandatoryPreview(id),0);
    };
    wrapped.__v0717CommunityWrapped=true;
    previewRequest=wrapped;
  }

  function schedule(){[0,100,350,900].forEach(ms=>setTimeout(normalizeMandatoryMasterData,ms))}

  const baseRenderAllV0717=renderAll;
  renderAll=function(){baseRenderAllV0717();schedule()};

  const baseGoV0717=go;
  go=function(id){baseGoV0717(id);schedule()};

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#v070Finish,.workflow-card-close,#workflowOutBtn'))schedule();
  },true);

  normalizeMandatoryMasterData();
})();
