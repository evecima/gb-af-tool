/* v0.7.10 — fix Time Received controls in Quick Emergency Intake so Clear/N-A and RCVD never overlap */
(function(){
  function ensureStyles(){
    if($('#v080TimeLayoutStyles'))return;
    const st=document.createElement('style');
    st.id='v080TimeLayoutStyles';
    st.textContent=`
      #fieldEmergencyForm .v079-time-row.v080-field-time-row{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto auto!important;
        gap:7px!important;
        align-items:center!important;
        width:100%!important;
      }
      #fieldEmergencyForm .v079-time-row.v080-field-time-row input[type="time"]{min-width:0!important;width:100%!important}
      #fieldEmergencyForm .v079-time-row.v080-field-time-row>button{position:static!important;inset:auto!important;margin:0!important;white-space:nowrap!important}
      @media(max-width:520px){
        #fieldEmergencyForm .v079-time-row.v080-field-time-row{grid-template-columns:minmax(0,1fr) auto auto!important;gap:5px!important}
        #fieldEmergencyForm .v079-time-row.v080-field-time-row>button{padding:7px 8px!important;font-size:10px!important}
      }
    `;
    document.head.appendChild(st);
  }

  function repair(){
    ensureStyles();
    const f=$('#fieldEmergencyForm');
    const input=f?.elements?.timeReceived;
    if(!input)return;
    const row=input.closest('.v079-time-row');
    if(!row)return;
    row.classList.add('v080-field-time-row');
    const label=row.closest('label');
    const rcvd=$('#workflowRcvdBtn');
    if(rcvd&&label?.contains(rcvd)&&rcvd.parentElement!==row)row.appendChild(rcvd);
  }

  const baseRenderAllV080=renderAll;
  renderAll=function(){baseRenderAllV080();setTimeout(repair,0);setTimeout(repair,80)};
  const baseGoV080=go;
  go=function(id){baseGoV080(id);if(id==='emergency'){setTimeout(repair,0);setTimeout(repair,80)}};
  document.addEventListener('click',()=>setTimeout(repair,0),true);
  new MutationObserver(()=>setTimeout(repair,0)).observe(document.body,{subtree:true,childList:true});
  repair();
})();
