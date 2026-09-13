/* v0.7.12 — Pool Maintenance Request editor cleanup: fixed Pool title, Pool-specific finding prompt */
(function(){
  const VERSION='0.7.12';
  const POOL_TYPES=new Set(['pool_open','pool_close']);
  const poolTitle=t=>t==='pool_open'?'Pool Opening':'Pool Closing';

  function ensureStyles(){
    if($('#v0712PoolEditorStyles'))return;
    const st=document.createElement('style');st.id='v0712PoolEditorStyles';st.textContent=`
      #eventEditorForm .v0712-pool-fixed-note{display:block;margin-top:4px;color:#667684;font-size:10px;font-weight:600}
      #eventEditorForm .v0712-pool-title[readonly]{background:#f5f8fa;color:#23384a;font-weight:700;cursor:default}
    `;document.head.appendChild(st);
  }

  function currentEditorType(){
    const f=$('#eventEditorForm');if(!f)return'';
    return String(f.elements?.type?.value||f.elements?.eventType?.value||'').trim();
  }

  function syncPoolEditor(explicitType=''){
    ensureStyles();
    const f=$('#eventEditorForm');if(!f)return;
    const type=explicitType||currentEditorType();
    const isPool=POOL_TYPES.has(type);
    const problem=f.elements?.problem;
    const finding=f.elements?.finding;
    const quick=$('#v075EditProblemQuick')?.closest('.v075-editor-quick')||$('#v075EditProblemQuick');

    if(finding&&!finding.dataset.v0712OriginalPlaceholder){
      finding.dataset.v0712OriginalPlaceholder=finding.getAttribute('placeholder')||'';
    }

    if(quick)quick.style.display=isPool?'none':'';

    if(problem){
      let note=$('#v0712PoolTitleNote');
      if(isPool){
        const title=poolTitle(type);
        if(problem.value!==title){problem.value=title;problem.dispatchEvent(new Event('input',{bubbles:true}))}
        problem.readOnly=true;problem.classList.add('v0712-pool-title');
        if(!note){note=document.createElement('small');note.id='v0712PoolTitleNote';note.className='v0712-pool-fixed-note';problem.insertAdjacentElement('afterend',note)}
        note.textContent='Pool Operations title is fixed for this Maintenance Request.';
      }else{
        problem.readOnly=false;problem.classList.remove('v0712-pool-title');
        note?.remove();
      }
    }

    if(finding){
      finding.placeholder=isPool?'Pool area condition / observations, if any.':(finding.dataset.v0712OriginalPlaceholder||'');
    }
  }

  function typeForEvent(id){
    const ev=(events||[]).find(e=>e.id===id);return ev?.type||'';
  }

  if(typeof openEventEditor==='function'&&!openEventEditor.__v0712Wrapped){
    const baseOpen=openEventEditor;
    const wrapped=function(id){
      baseOpen(id);
      const type=typeForEvent(id);
      setTimeout(()=>syncPoolEditor(type),0);
      setTimeout(()=>syncPoolEditor(type),80);
    };
    wrapped.__v0712Wrapped=true;openEventEditor=wrapped;
  }

  document.addEventListener('change',e=>{
    const f=$('#eventEditorForm');
    if(!f||!f.contains(e.target))return;
    if(e.target===f.elements?.type||e.target===f.elements?.eventType)setTimeout(()=>syncPoolEditor(),0);
  },true);

  const baseRenderAllV0712=renderAll;
  renderAll=function(){baseRenderAllV0712();setTimeout(()=>syncPoolEditor(),0)};
  const baseGoV0712=go;
  go=function(id){baseGoV0712(id);if(id==='requests')setTimeout(()=>syncPoolEditor(),0)};

  syncPoolEditor();
})();
