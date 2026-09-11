/* v0.6.8 — optional folio continuity reference from prior closed pay periods */
(function(){
  K.folioHistory=NS+'folio_history';
  let folioHistory=load(K.folioHistory,{});
  window.folioHistory=folioHistory;

  const periodEndFor=start=>addDays(start,13);
  const folioNumber=v=>{const n=parseInt(v,10);return Number.isFinite(n)&&n>0?n:null};
  const lockedStatusFor=start=>{
    const suffix='|'+start;
    return Object.entries(window.periodStatuses||{}).find(([k,v])=>k.endsWith(suffix)&&v?.locked)?.[1]||null;
  };
  const eventsForPeriod=start=>events
    .filter(e=>e?.date>=start&&e.date<=periodEndFor(start)&&folioNumber(e.requestNumber))
    .sort((a,b)=>((a.date||'')+(a.in||'')+(a.id||'')).localeCompare((b.date||'')+(b.in||'')+(b.id||'')));

  function lastFolioInPeriod(start){
    const rows=eventsForPeriod(start);
    return rows.length?folioNumber(rows[rows.length-1].requestNumber):null;
  }

  function rememberClosedPeriod(start,status){
    const last=lastFolioInPeriod(start);if(!last)return false;
    const prev=folioHistory[start]||{};
    const next={last,closedAt:status?.deliveredAt||prev.closedAt||new Date().toISOString()};
    if(prev.last===next.last&&prev.closedAt===next.closedAt)return false;
    folioHistory[start]=next;return true;
  }

  function syncClosedFolioHistory(){
    let changed=false;
    for(const [key,status] of Object.entries(window.periodStatuses||{})){
      if(!status?.locked)continue;
      const start=key.split('|').pop();
      if(/^\d{4}-\d{2}-\d{2}$/.test(start))changed=rememberClosedPeriod(start,status)||changed;
    }
    if(changed){save(K.folioHistory,folioHistory);window.folioHistory=folioHistory}
  }

  function fallbackPreviousReference(start){
    const groups={};
    for(const e of events){
      if(!e?.date||e.date>=start||!folioNumber(e.requestNumber))continue;
      const p=periodForDate(e.date);(groups[p]??=[]).push(e);
    }
    const periods=Object.keys(groups).sort();if(!periods.length)return null;
    const p=periods[periods.length-1];
    const rows=groups[p].sort((a,b)=>((a.date||'')+(a.in||'')+(a.id||'')).localeCompare((b.date||'')+(b.in||'')+(b.id||'')));
    const last=folioNumber(rows[rows.length-1]?.requestNumber);return last?{periodStart:p,last,source:'recorded'}:null;
  }

  function previousFolioReference(start=currentPeriodStart){
    syncClosedFolioHistory();
    const periods=Object.keys(folioHistory).filter(p=>p<start&&folioNumber(folioHistory[p]?.last)).sort();
    if(periods.length){const p=periods[periods.length-1];return {periodStart:p,last:folioNumber(folioHistory[p].last),source:'closed',closedAt:folioHistory[p].closedAt||''}}
    return fallbackPreviousReference(start);
  }
  window.previousFolioReference=previousFolioReference;

  function ensureFolioReferenceUI(){
    const input=$('#folioStartInput');if(!input)return null;
    const row=input.closest('.row.gap.wrap')||input.parentElement?.parentElement;if(!row)return null;
    let box=$('#folioContinuityRef');
    if(!box){
      box=document.createElement('div');box.id='folioContinuityRef';box.className='folio-continuity-ref';
      box.innerHTML='<div class="folio-continuity-copy"><span id="lastFolioLabel" class="muted tiny"></span><b id="lastFolioValue"></b><span id="lastFolioSource" class="muted tiny"></span></div><button type="button" class="secondary" id="useNextFolioBtn"></button>';
      const assign=$('#assignFoliosBtn');if(assign)row.insertBefore(box,assign);else row.appendChild(box);
      $('#useNextFolioBtn').onclick=()=>{
        const ref=previousFolioReference();if(!ref)return;
        const next=ref.last+1;input.value=next;input.focus();
        toast(settings.language==='es'?`Folio inicial propuesto: ${formatFolio(next)}. Puedes cambiarlo si tu block físico comienza con otro número.`:`Suggested starting folio: ${formatFolio(next)}. You can replace it if your physical pad starts with a different number.`);
      };
    }
    if(!$('#folioContinuityStyles')){
      const s=document.createElement('style');s.id='folioContinuityStyles';s.textContent=`
        .folio-continuity-ref{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;border:1px solid rgba(18,97,160,.18);border-radius:10px;background:rgba(18,97,160,.04)}
        .folio-continuity-copy{display:grid;grid-template-columns:auto auto;gap:1px 6px;align-items:baseline;min-width:150px}
        .folio-continuity-copy #lastFolioSource{grid-column:1/-1}
        #useNextFolioBtn{white-space:nowrap}
        @media(max-width:650px){.folio-continuity-ref{width:100%;justify-content:space-between}.folio-continuity-copy{min-width:0}}
      `;document.head.appendChild(s);
    }
    return box;
  }

  function renderFolioReference(){
    const box=ensureFolioReferenceUI();if(!box)return;
    const ref=previousFolioReference(),es=settings.language==='es',locked=!!(window.isPeriodLocked&&window.isPeriodLocked(currentPeriodStart));
    const label=$('#lastFolioLabel'),value=$('#lastFolioValue'),source=$('#lastFolioSource'),btn=$('#useNextFolioBtn');
    if(label)label.textContent=es?'Último folio usado':'Last folio used';
    if(value)value.textContent=ref?formatFolio(ref.last):'—';
    if(source)source.textContent=ref?(ref.source==='closed'?(es?`Periodo cerrado ${mdy(ref.periodStart)}–${mdy(periodEndFor(ref.periodStart))}`:`Closed period ${mdy(ref.periodStart)}–${mdy(periodEndFor(ref.periodStart))}`):(es?'Último registro histórico disponible':'Latest historical record available')):(es?'Sin folio anterior registrado':'No previous folio recorded');
    if(btn){btn.textContent=ref?(es?`Usar siguiente: ${formatFolio(ref.last+1)}`:`Use Next: ${formatFolio(ref.last+1)}`):(es?'Usar siguiente':'Use Next');btn.disabled=!ref||locked;btn.title=locked?(es?'Este periodo está cerrado/bloqueado.':'This pay period is locked.'):''}
  }

  const baseRenderRequestsV068=renderRequests;
  renderRequests=function(){baseRenderRequestsV068();renderFolioReference()};

  const baseRenderAllV068=renderAll;
  renderAll=function(){syncClosedFolioHistory();baseRenderAllV068();renderFolioReference()};

  syncClosedFolioHistory();
  renderFolioReference();
})();