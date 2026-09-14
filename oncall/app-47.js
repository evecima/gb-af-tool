/* v0.7.16 — Live Mandatory Overtime always starts on the technician's current local date */
(function(){
  const VERSION='0.7.16';

  function syncMandatoryServiceDate(){
    const input=$('#v070MandatoryDate');
    if(!input)return;
    const d=todayISO();
    if(input.value!==d)input.value=d;
  }

  // Mandatory Overtime is a live field action. Its service date must be the
  // local calendar date at the instant IN is pressed, even if the app stayed
  // open across midnight with yesterday's date still displayed.
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#v070StartMandatory'))syncMandatoryServiceDate();
  },true);

  // Keep the visible setup current when returning to Reportable Work or when
  // the installed PWA becomes active after midnight. The IN click above is
  // still the authoritative safeguard.
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&$('#reportableWork')?.classList.contains('active'))syncMandatoryServiceDate();
  });

  const baseGoV0716=go;
  go=function(id){
    baseGoV0716(id);
    if(id==='reportableWork')setTimeout(syncMandatoryServiceDate,0);
  };

  const baseRenderAllV0716=renderAll;
  renderAll=function(){
    baseRenderAllV0716();
    if($('#reportableWork')?.classList.contains('active'))setTimeout(syncMandatoryServiceDate,0);
  };

  if($('#reportableWork')?.classList.contains('active'))syncMandatoryServiceDate();
})();
