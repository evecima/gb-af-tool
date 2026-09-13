/* v0.7.9 — Clear / N/A control for Time Received on Emergency and Maintenance Request editors */
(function(){
  const VERSION='0.7.9';

  function ensureStyles(){
    if($('#v079TimeReceivedStyles'))return;
    const st=document.createElement('style');
    st.id='v079TimeReceivedStyles';
    st.textContent=`
      .v079-time-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:center;margin-top:4px}
      .v079-time-row input[type="time"]{width:100%;min-width:0}
      .v079-clear-time{white-space:nowrap;padding:8px 10px}
      @media(max-width:520px){.v079-time-row{grid-template-columns:minmax(0,1fr) auto}.v079-clear-time{padding:8px 9px;font-size:11px}}
    `;
    document.head.appendChild(st);
  }

  function clearTime(input){
    if(!input)return;
    input.value='';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
    toast('Time Received cleared. It will remain blank unless you enter a new time.');
  }

  function enhanceInput(input){
    if(!input||input.dataset.v079Clear==='1')return;
    input.dataset.v079Clear='1';
    const parent=input.parentElement;if(!parent)return;
    const row=document.createElement('div');row.className='v079-time-row';
    parent.insertBefore(row,input);row.appendChild(input);
    const b=document.createElement('button');b.type='button';b.className='secondary v079-clear-time';b.textContent='Clear / N/A';b.title='Leave Time Received blank';
    b.addEventListener('click',()=>clearTime(input));row.appendChild(b);
  }

  function enhance(){
    ensureStyles();
    enhanceInput($('#eventEditorForm input[name="timeReceived"]'));
    enhanceInput($('#fieldEmergencyForm input[name="timeReceived"]'));
  }

  const baseRenderAllV079=renderAll;
  renderAll=function(){baseRenderAllV079();setTimeout(enhance,0)};
  const baseGoV079=go;
  go=function(id){baseGoV079(id);setTimeout(enhance,0)};
  document.addEventListener('click',()=>setTimeout(enhance,0),true);
  enhance();
})();
