/* v0.7.5 — professional Emergency Title catalog + quick titles in Maintenance Request editor */
(function(){
  const VERSION='0.7.5';
  if(!K?.problems)return;

  const EXTRA_CANONICAL=['Refrigerator Not Working'];
  const canonicalTitles=[...(window.SEED_PROBLEMS||[]),...EXTRA_CANONICAL];
  const canonicalMap=new Map(canonicalTitles.map(x=>[String(x).trim().toLowerCase(),String(x).trim()]));
  const canonicalFor=value=>{
    const s=String(value||'').trim();
    if(!s)return s;
    return canonicalMap.get(s.toLowerCase())||s;
  };
  const sortTitles=arr=>arr.slice().sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
  const dedupeTitles=arr=>{
    const seen=new Set(),out=[];
    for(const raw of arr){
      const v=String(raw||'').trim();if(!v)continue;
      const k=v.toLowerCase();if(seen.has(k))continue;
      seen.add(k);out.push(v);
    }
    return out;
  };

  function normalizeExistingTitles(){
    let changedProblems=false,changedEvents=false,changedDrafts=false,changedKnowledge=false;
    let next=dedupeTitles((problems||[]).map(canonicalFor));
    for(const title of EXTRA_CANONICAL){if(!next.some(x=>x.toLowerCase()===title.toLowerCase()))next.push(title)}
    next=sortTitles(next);
    if(JSON.stringify(next)!==JSON.stringify(problems||[])){problems=next;save(K.problems,problems);changedProblems=true}

    for(const ev of events||[]){
      if(ev?.type!=='emergency'||!ev.problem)continue;
      const v=canonicalFor(ev.problem);if(v!==ev.problem){ev.problem=v;changedEvents=true}
    }
    if(changedEvents)save(K.events,events);

    if(Array.isArray(window.emergencyDrafts)){
      for(const d of window.emergencyDrafts){
        if(!d?.problem)continue;const v=canonicalFor(d.problem);if(v!==d.problem){d.problem=v;changedDrafts=true}
      }
      if(changedDrafts&&K.emergencyDrafts)save(K.emergencyDrafts,window.emergencyDrafts);
    }

    if(Array.isArray(localKnowledge)){
      for(const k of localKnowledge){if(!k?.problem)continue;const v=canonicalFor(k.problem);if(v!==k.problem){k.problem=v;changedKnowledge=true}}
      if(changedKnowledge)save(K.knowledge,localKnowledge);
    }

    if(changedProblems&&typeof refreshProblems==='function')refreshProblems();
    return changedProblems||changedEvents||changedDrafts||changedKnowledge;
  }

  function saveCatalog(){
    problems=sortTitles(dedupeTitles(problems));save(K.problems,problems);
    if(typeof refreshProblems==='function')refreshProblems();
    renderTitleManager();refreshEditorQuickOptions();
  }

  function ensureStyles(){
    if($('#v075TitleStyles'))return;
    const s=document.createElement('style');s.id='v075TitleStyles';s.textContent=`
      .v075-title-list{display:grid;gap:7px;margin-top:10px}
      .v075-title-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;align-items:center}
      .v075-title-row input{width:100%}
      .v075-editor-quick{margin-bottom:7px}
      .v075-editor-quick small{display:block;color:#667684;margin-bottom:4px;font-weight:700}
      @media(max-width:640px){.v075-title-row{grid-template-columns:1fr auto}.v075-title-row .v075-save-title{grid-column:2}.v075-title-row .v075-delete-title{grid-column:2}}
    `;document.head.appendChild(s);
  }

  function ensureTitleManager(){
    const screen=$('#settings');if(!screen||$('#v075TitleManager'))return;
    const card=document.createElement('div');card.id='v075TitleManager';card.className='card';
    card.innerHTML=`<div class="row between wrap gap"><div><b>Emergency Titles</b><div class="muted tiny">Master list used by New Emergency and Edit Maintenance Request. Spelling and capitalization are saved exactly as shown. Editing this list affects future selections; existing reports are not renamed by manual catalog edits.</div></div><button type="button" class="secondary" id="v075AddTitle">+ Add Title</button></div><div id="v075TitleList" class="v075-title-list"></div>`;
    const advanced=[...screen.querySelectorAll('details.card')].find(x=>/Advanced \/ Local Backup/i.test(x.querySelector('summary')?.textContent||''));
    if(advanced)screen.insertBefore(card,advanced);else screen.appendChild(card);
    $('#v075AddTitle').onclick=()=>{
      const input=$('#newProblemName'),err=$('#newProblemError');if(input)input.value='';if(err)err.textContent='';openModal('newProblemModal');setTimeout(()=>input?.focus(),0);
    };
    renderTitleManager();
  }

  function renderTitleManager(){
    const list=$('#v075TitleList');if(!list)return;
    list.innerHTML=(problems||[]).map((p,i)=>`<div class="v075-title-row" data-index="${i}"><input class="v075-title-input" value="${esc(p)}" aria-label="Emergency title"><button type="button" class="secondary v075-save-title">Save</button><button type="button" class="dangerbtn v075-delete-title">Delete</button></div>`).join('')||'<div class="muted">No emergency titles saved.</div>';
    list.querySelectorAll('.v075-title-row').forEach(row=>{
      const idx=Number(row.dataset.index),input=row.querySelector('.v075-title-input');
      row.querySelector('.v075-save-title').onclick=()=>{
        const old=problems[idx],next=String(input.value||'').trim();
        if(!next)return toast('Emergency title cannot be blank.');
        const duplicate=problems.findIndex((x,j)=>j!==idx&&x.toLowerCase()===next.toLowerCase());
        if(duplicate>=0)return toast('That Emergency Title already exists.');
        problems[idx]=next;saveCatalog();
        toast(`Emergency Title saved as “${next}”. Existing Maintenance Requests were not changed.`);
      };
      row.querySelector('.v075-delete-title').onclick=async()=>{
        const title=problems[idx];
        if(!await appConfirm(`Delete “${title}” from the Emergency Title catalog? Existing Maintenance Requests will remain unchanged.`,'Delete Emergency Title'))return;
        problems.splice(idx,1);saveCatalog();toast('Emergency Title removed from the catalog.');
      };
    });
  }

  function installNewTitleSave(){
    const b=$('#newProblemSave');if(!b)return;
    b.onclick=()=>{
      const input=$('#newProblemName'),err=$('#newProblemError'),typed=String(input?.value||'').trim();
      if(!typed){if(err)err.textContent='Problem name is required.';return}
      const existing=problems.findIndex(x=>x.toLowerCase()===typed.toLowerCase());
      if(existing>=0)problems[existing]=typed;else problems.push(typed);
      saveCatalog();
      const exact=problems.find(x=>x.toLowerCase()===typed.toLowerCase())||typed;
      const select=$('#fieldProblemSelect');if(select)select.value=exact;
      closeModal('newProblemModal');
      toast(existing>=0?`Emergency Title spelling updated to “${typed}”.`:`Emergency Title “${typed}” added.`);
    };
  }

  function ensureEditorQuick(){
    const f=$('#eventEditorForm'),input=f?.elements?.problem;if(!f||!input||$('#v075EditProblemQuick'))return;
    const wrap=document.createElement('div');wrap.className='v075-editor-quick';
    wrap.innerHTML='<small>Quick Title</small><select id="v075EditProblemQuick"></select>';
    input.parentElement.insertBefore(wrap,input);
    const sel=$('#v075EditProblemQuick');
    sel.onchange=()=>{
      if(sel.value==='__manual__'){input.focus();return}
      if(sel.value){input.value=sel.value;input.dispatchEvent(new Event('input',{bubbles:true}))}
    };
    input.addEventListener('input',syncEditorQuickFromInput);
    refreshEditorQuickOptions();syncEditorQuickFromInput();
  }

  function refreshEditorQuickOptions(){
    const sel=$('#v075EditProblemQuick');if(!sel)return;
    const current=sel.value;
    sel.innerHTML='<option value="">— Select saved title —</option>'+sortTitles(problems||[]).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')+'<option value="__manual__">Other / Manual</option>';
    if([...sel.options].some(o=>o.value===current))sel.value=current;
    syncEditorQuickFromInput();
  }

  function syncEditorQuickFromInput(){
    const f=$('#eventEditorForm'),input=f?.elements?.problem,sel=$('#v075EditProblemQuick');if(!input||!sel)return;
    const value=String(input.value||'').trim();
    const match=(problems||[]).find(p=>p.toLowerCase()===value.toLowerCase());
    sel.value=match||'__manual__';
  }

  if(typeof openEventEditor==='function'&&!openEventEditor.__v075Wrapped){
    const baseOpen=openEventEditor;
    const wrapped=function(id){baseOpen(id);setTimeout(()=>{ensureEditorQuick();refreshEditorQuickOptions();syncEditorQuickFromInput()},0)};
    wrapped.__v075Wrapped=true;openEventEditor=wrapped;
  }

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:2,exportedAt:new Date().toISOString(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:load(K.activeDraft,'')||'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(window.reportableWorkState||load(K.reportableWork,{version:1,activities:[],activeId:''})),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
  }

  function enhance(){ensureStyles();ensureTitleManager();installNewTitleSave();ensureEditorQuick();installBackupExport()}
  const changed=normalizeExistingTitles();
  if(changed)setTimeout(()=>{if(typeof renderAll==='function')renderAll()},0);
  const baseRenderAllV075=renderAll;
  renderAll=function(){baseRenderAllV075();setTimeout(enhance,0)};
  const baseGoV075=go;
  go=function(id){baseGoV075(id);if(id==='settings'||id==='requests')setTimeout(enhance,0);installBackupExport()};

  enhance();
})();
