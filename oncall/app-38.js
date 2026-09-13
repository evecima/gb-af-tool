/* v0.7.7 — master Emergency Title system: stable IDs, Rename Everywhere, Merge, Archive, manual-title catalog prompt */
(function(){
  const VERSION='0.7.7';
  if(!K?.problems)return;

  const TITLE_KEY=NS+'emergency_title_catalog_v1';
  const TECHNICAL=new Map([
    ['a/c','A/C'],['ac','AC'],['hvac','HVAC'],['gfci','GFCI'],['hsi','HSI'],['in/out','IN/OUT'],
    ['propress','ProPress'],['flushmate','Flushmate'],['p-trap','P-Trap'],['r-12','R-12'],['r-124a','R-124a']
  ]);
  const key=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const sortByName=arr=>arr.slice().sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
  const smartWord=w=>{
    const clean=String(w||'');if(!clean)return clean;
    const mapped=TECHNICAL.get(clean.toLowerCase());if(mapped)return mapped;
    if(/^[A-Z0-9/.-]{2,}$/.test(clean))return clean;
    return clean.charAt(0).toUpperCase()+clean.slice(1).toLowerCase();
  };
  const smartTitleCase=v=>String(v||'').trim().replace(/\s+/g,' ').split(' ').map(smartWord).join(' ');

  let catalog=load(TITLE_KEY,null);
  if(!catalog||!Array.isArray(catalog.entries)){
    catalog={version:1,entries:[]};
    for(const raw of problems||[]){
      const name=String(raw||'').trim();if(!name||catalog.entries.some(e=>key(e.name)===key(name)))continue;
      catalog.entries.push({id:uid('title'),name,status:'active',aliases:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    }
    save(TITLE_KEY,catalog);
  }
  window.emergencyTitleCatalog=catalog;

  const entries=()=>catalog.entries||[];
  const byId=id=>entries().find(e=>e.id===id)||null;
  const findByNameOrAlias=name=>{
    const k=key(name);if(!k)return null;
    return entries().find(e=>key(e.name)===k||(e.aliases||[]).some(a=>key(a)===k))||null;
  };
  const findByCurrentName=name=>{const k=key(name);return entries().find(e=>key(e.name)===k)||null};
  const activeEntries=()=>sortByName(entries().filter(e=>e.status!=='archived'));
  const saveCatalogState=()=>{catalog.version=1;save(TITLE_KEY,catalog);window.emergencyTitleCatalog=catalog};

  function syncProblems(){
    problems=activeEntries().map(e=>e.name);
    save(K.problems,problems);
    if(typeof refreshProblems==='function')refreshProblems();
    refreshQuickEditor();
  }

  function matchRecord(record,entry,oldName=entry?.name){
    if(!record||!entry)return false;
    if(record.problemTitleId===entry.id)return true;
    const rk=key(record.problem);if(!rk)return false;
    if(rk===key(oldName)||rk===key(entry.name))return true;
    return (entry.aliases||[]).some(a=>rk===key(a));
  }

  function linkRecordsToCatalog(){
    let eChanged=false,dChanged=false,kChanged=false;
    for(const ev of events||[]){
      if(ev?.type!=='emergency'||!ev.problem)continue;
      const entry=byId(ev.problemTitleId)||findByNameOrAlias(ev.problem);
      if(entry&&ev.problemTitleId!==entry.id){ev.problemTitleId=entry.id;eChanged=true}
    }
    if(eChanged)save(K.events,events);
    if(Array.isArray(window.emergencyDrafts)&&K.emergencyDrafts){
      for(const d of window.emergencyDrafts){
        if(!d?.problem)continue;const entry=byId(d.problemTitleId)||findByNameOrAlias(d.problem);
        if(entry&&d.problemTitleId!==entry.id){d.problemTitleId=entry.id;dChanged=true}
      }
      if(dChanged)save(K.emergencyDrafts,window.emergencyDrafts);
    }
    if(Array.isArray(localKnowledge)){
      for(const item of localKnowledge){
        if(!item?.problem)continue;const entry=byId(item.problemTitleId)||findByNameOrAlias(item.problem);
        if(entry&&item.problemTitleId!==entry.id){item.problemTitleId=entry.id;kChanged=true}
      }
      if(kChanged)save(K.knowledge,localKnowledge);
    }
    return eChanged||dChanged||kChanged;
  }

  function usageCount(entry){
    if(!entry)return 0;
    let n=0;
    n+=(events||[]).filter(x=>x.type==='emergency'&&matchRecord(x,entry)).length;
    n+=(window.emergencyDrafts||[]).filter(x=>matchRecord(x,entry)).length;
    n+=(localKnowledge||[]).filter(x=>matchRecord(x,entry)).length;
    return n;
  }

  function updateEverywhere(source,oldName,newName,newId=source.id){
    let eChanged=false,dChanged=false,kChanged=false,rwChanged=false;
    for(const ev of events||[]){
      if(ev?.type!=='emergency'||!matchRecord(ev,source,oldName))continue;
      ev.problem=newName;ev.problemTitleId=newId;eChanged=true;
    }
    if(eChanged)save(K.events,events);

    if(Array.isArray(window.emergencyDrafts)&&K.emergencyDrafts){
      for(const d of window.emergencyDrafts){
        if(!matchRecord(d,source,oldName))continue;
        d.problem=newName;d.problemTitleId=newId;d.updatedAt=new Date().toISOString();dChanged=true;
      }
      if(dChanged)save(K.emergencyDrafts,window.emergencyDrafts);
    }

    if(Array.isArray(localKnowledge)){
      for(const item of localKnowledge){
        if(!matchRecord(item,source,oldName))continue;
        item.problem=newName;item.problemTitleId=newId;kChanged=true;
      }
      if(kChanged)save(K.knowledge,localKnowledge);
    }

    const rw=window.reportableWorkState;
    if(rw&&Array.isArray(rw.activities)){
      for(const a of rw.activities){
        for(const seg of a.segments||[]){
          if(seg.kind!=='emergency')continue;
          const ref=seg.refEventId?(events||[]).find(x=>x.id===seg.refEventId):null;
          if((ref&&ref.problemTitleId===newId)||key(seg.label)===key(oldName)){seg.label=newName;rwChanged=true}
        }
      }
      if(rwChanged&&K.reportableWork)save(K.reportableWork,rw);
    }
    return eChanged||dChanged||kChanged||rwChanged;
  }

  function refreshQuickEditor(){
    const sel=$('#v075EditProblemQuick');if(!sel)return;
    const input=$('#eventEditorForm')?.elements?.problem,current=String(input?.value||'').trim();
    sel.innerHTML='<option value="">— Select saved title —</option>'+activeEntries().map(e=>`<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('')+'<option value="__manual__">Other / Manual</option>';
    const match=findByNameOrAlias(current);sel.value=match&&match.status!=='archived'?match.name:'__manual__';
  }

  function ensureStyles(){
    if($('#v077TitleMasterStyles'))return;
    const st=document.createElement('style');st.id='v077TitleMasterStyles';st.textContent=`
      #v075TitleManager .v077-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
      #v075TitleManager .v077-toolbar input{flex:1;min-width:220px}
      #v075TitleManager .v077-list{max-height:420px;overflow:auto;margin-top:8px;padding-right:4px;border-top:1px solid #e5ebef;padding-top:8px;display:grid;gap:7px}
      #v075TitleManager .v077-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:7px;align-items:center}
      #v075TitleManager .v077-row input{width:100%}
      #v075TitleManager .v077-meta{font-size:10px;color:#6a7885;grid-column:1/-1;margin-top:-4px}
      #v075TitleManager .v077-archived{opacity:.72;background:#f7f8f9;border-radius:8px;padding:6px}
      #v075TitleManager .v077-hidden{display:none!important}
      @media(max-width:680px){#v075TitleManager .v077-row{grid-template-columns:1fr auto}#v075TitleManager .v077-row button{grid-column:2}}
    `;document.head.appendChild(st);
  }

  let renameResolve=null;
  function ensureRenameModal(){
    if($('#v077RenameModal'))return;
    const m=document.createElement('div');m.id='v077RenameModal';m.className='modal-backdrop';
    m.innerHTML='<div class="modal" style="max-width:560px"><div class="modal-head"><h3>Rename Emergency Title</h3><button class="x" id="v077RenameX">×</button></div><p id="v077RenameMessage"></p><div class="row end gap wrap"><button class="secondary" id="v077RenameCancel">Cancel</button><button class="secondary" id="v077CatalogOnly">Catalog Only</button><button class="primary" id="v077RenameEverywhere">Rename Everywhere</button></div></div>';
    document.body.appendChild(m);
    const finish=v=>{m.classList.remove('open');const r=renameResolve;renameResolve=null;r?.(v)};
    $('#v077RenameCancel').onclick=$('#v077RenameX').onclick=()=>finish('cancel');
    $('#v077CatalogOnly').onclick=()=>finish('catalog');
    $('#v077RenameEverywhere').onclick=()=>finish('everywhere');
  }
  function chooseRename(oldName,newName,count){
    ensureRenameModal();
    $('#v077RenameMessage').textContent=`Rename “${oldName}” to “${newName}”? ${count} existing record${count===1?' uses':'s use'} this title. Catalog Only changes future selections. Rename Everywhere also updates existing Maintenance Requests, On-Call views, reportable-work emergency labels and future previews/prints.`;
    $('#v077RenameModal').classList.add('open');
    return new Promise(resolve=>renameResolve=resolve);
  }

  let mergeSourceId='';
  function ensureMergeModal(){
    if($('#v077MergeModal'))return;
    const m=document.createElement('div');m.id='v077MergeModal';m.className='modal-backdrop';
    m.innerHTML='<div class="modal" style="max-width:560px"><div class="modal-head"><div><h3>Merge Emergency Titles</h3><div class="muted tiny">All records using the source title will move to the selected master title.</div></div><button class="x" id="v077MergeX">×</button></div><label class="top-space" style="display:block"><span>Merge Into</span><select id="v077MergeTarget" style="width:100%"></select></label><div class="row end gap top-space"><button class="secondary" id="v077MergeCancel">Cancel</button><button class="primary" id="v077MergeConfirm">Merge Titles</button></div></div>';
    document.body.appendChild(m);
    $('#v077MergeCancel').onclick=$('#v077MergeX').onclick=()=>{mergeSourceId='';m.classList.remove('open')};
    $('#v077MergeConfirm').onclick=async()=>{
      const source=byId(mergeSourceId),target=byId($('#v077MergeTarget').value);if(!source||!target||source.id===target.id)return;
      const count=usageCount(source);
      const ok=await appConfirm(`Merge “${source.name}” into “${target.name}”? ${count} existing record${count===1?'':'s'} will be renamed to the master title. The source title will be archived, not destroyed.`,'Merge Emergency Titles');
      if(!ok)return;
      updateEverywhere(source,source.name,target.name,target.id);
      target.aliases=[...new Set([...(target.aliases||[]),source.name,...(source.aliases||[])])];target.updatedAt=new Date().toISOString();
      source.status='archived';source.mergedInto=target.id;source.updatedAt=new Date().toISOString();
      saveCatalogState();syncProblems();renderMasterRows();renderAll();
      m.classList.remove('open');mergeSourceId='';toast(`Merged into “${target.name}”. Existing reports now use the master title.`);
    };
  }
  function openMerge(source){
    ensureMergeModal();mergeSourceId=source.id;
    const targets=activeEntries().filter(e=>e.id!==source.id);
    if(!targets.length)return toast('No other active Emergency Title is available to merge into.');
    $('#v077MergeTarget').innerHTML=targets.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('');
    $('#v077MergeModal').classList.add('open');
  }

  function ensureMasterManager(){
    const card=$('#v075TitleManager');if(!card)return;
    ensureStyles();
    if(card.dataset.v077Master==='1')return;
    card.dataset.v077Master='1';
    card.innerHTML=`<div class="row between wrap gap"><div><b>Emergency Titles</b><div class="muted tiny">Master catalog with stable internal IDs. Rename Everywhere updates existing records and future previews/prints. Archive removes a title from future selections without deleting history.</div></div><div class="row gap wrap"><button type="button" class="secondary" id="v077ManageTitles">Manage Titles</button><button type="button" class="secondary" id="v077AddTitle">+ Add Title</button></div></div><div id="v077TitleBody" class="v077-hidden"><div class="v077-toolbar"><input id="v077TitleSearch" type="search" placeholder="Search Emergency Title…"><select id="v077TitleScope"><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select><span id="v077TitleCount" class="muted tiny"></span></div><div id="v077TitleList" class="v077-list"></div></div>`;
    $('#v077ManageTitles').onclick=()=>{const body=$('#v077TitleBody');body.classList.toggle('v077-hidden');renderMasterRows();if(!body.classList.contains('v077-hidden'))$('#v077TitleSearch').focus()};
    $('#v077AddTitle').onclick=()=>{const i=$('#newProblemName'),e=$('#newProblemError');if(i)i.value='';if(e)e.textContent='';openModal('newProblemModal');setTimeout(()=>i?.focus(),0)};
    $('#v077TitleSearch').oninput=renderMasterRows;$('#v077TitleScope').onchange=renderMasterRows;
    renderMasterRows();
  }

  function renderMasterRows(){
    const list=$('#v077TitleList');if(!list)return;
    const q=key($('#v077TitleSearch')?.value||''),scope=$('#v077TitleScope')?.value||'active';
    let rows=sortByName(entries()).filter(e=>scope==='all'||(scope==='active'?e.status!=='archived':e.status==='archived'));
    if(q)rows=rows.filter(e=>key(e.name).includes(q)||(e.aliases||[]).some(a=>key(a).includes(q)));
    $('#v077TitleCount').textContent=`${rows.length} shown · ${activeEntries().length} active · ${entries().filter(e=>e.status==='archived').length} archived`;
    $('#v077ManageTitles').textContent=($('#v077TitleBody').classList.contains('v077-hidden')?'Manage Titles':'Hide Titles')+` (${activeEntries().length})`;
    list.innerHTML=rows.length?rows.map(e=>`<div class="v077-row ${e.status==='archived'?'v077-archived':''}" data-id="${esc(e.id)}"><input class="v077-name" value="${esc(e.name)}" aria-label="Emergency title"><button type="button" class="secondary v077-save">Save</button><button type="button" class="secondary v077-merge">Merge</button><button type="button" class="${e.status==='archived'?'secondary':'dangerbtn'} v077-status">${e.status==='archived'?'Restore':'Archive'}</button><div class="v077-meta">ID ${esc(e.id)} · used by ${usageCount(e)} record${usageCount(e)===1?'':'s'}${e.aliases?.length?` · aliases: ${esc(e.aliases.join(', '))}`:''}</div></div>`).join(''):'<div class="muted tiny">No matching Emergency Titles.</div>';
    list.querySelectorAll('.v077-row').forEach(row=>{
      const entry=byId(row.dataset.id),input=row.querySelector('.v077-name');if(!entry)return;
      row.querySelector('.v077-save').onclick=async()=>{
        const oldName=entry.name,newName=smartTitleCase(input.value);
        if(!newName){input.value=oldName;return toast('Emergency Title cannot be blank.')}
        const duplicate=entries().find(x=>x.id!==entry.id&&key(x.name)===key(newName));
        if(duplicate){
          const ok=await appConfirm(`“${newName}” already exists. Merge “${oldName}” into that master title instead?`,'Duplicate Emergency Title');
          if(ok){openMerge(entry);$('#v077MergeTarget').value=duplicate.id} else input.value=oldName;
          return;
        }
        if(newName===oldName){input.value=oldName;return toast('Emergency Title already has that name.')}
        const count=usageCount(entry),choice=count?await chooseRename(oldName,newName,count):'catalog';
        if(choice==='cancel'){input.value=oldName;return}
        entry.aliases=[...new Set([...(entry.aliases||[]),oldName])];entry.name=newName;entry.updatedAt=new Date().toISOString();saveCatalogState();
        if(choice==='everywhere')updateEverywhere(entry,oldName,newName,entry.id);
        syncProblems();renderMasterRows();renderAll();
        toast(choice==='everywhere'?`Renamed everywhere to “${newName}”.`:`Catalog renamed to “${newName}”. Existing records kept their original wording.`);
      };
      row.querySelector('.v077-merge').onclick=()=>openMerge(entry);
      row.querySelector('.v077-status').onclick=async()=>{
        if(entry.status==='archived'){
          entry.status='active';entry.updatedAt=new Date().toISOString();saveCatalogState();syncProblems();renderMasterRows();return toast(`“${entry.name}” restored to future selections.`)
        }
        const count=usageCount(entry),ok=await appConfirm(`Archive “${entry.name}”? It will disappear from New Emergency and Quick Title choices. ${count} existing record${count===1?'':'s'} will remain unchanged and printable.`,'Archive Emergency Title');
        if(!ok)return;entry.status='archived';entry.updatedAt=new Date().toISOString();saveCatalogState();syncProblems();renderMasterRows();toast(`“${entry.name}” archived. Historical records were preserved.`);
      };
    });
  }

  function installNewTitleSave(){
    const b=$('#newProblemSave');if(!b)return;
    b.onclick=()=>{
      const input=$('#newProblemName'),err=$('#newProblemError');
      const typed=String(input?.value||'').trim();if(!typed){if(err)err.textContent='Problem name is required.';return}
      const proposed=smartTitleCase(typed),existing=findByNameOrAlias(proposed);
      let entry=existing;
      if(entry){if(entry.status==='archived')entry.status='active';entry.updatedAt=new Date().toISOString()}
      else{entry={id:uid('title'),name:proposed,status:'active',aliases:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};entries().push(entry)}
      saveCatalogState();syncProblems();renderMasterRows();
      const select=$('#fieldProblemSelect');if(select)select.value=entry.name;
      closeModal('newProblemModal');toast(existing?`Using master Emergency Title “${entry.name}”.`:`Emergency Title “${entry.name}” added to the master catalog.`);
    };
  }

  function installEditorSave(){
    const f=$('#eventEditorForm');if(!f||f.dataset.v077Submit==='1')return;
    f.dataset.v077Submit='1';
    f.onsubmit=async e=>{
      e.preventDefault();
      const ev=events.find(x=>x.id===editingEventId);if(!ev)return;
      const savedId=ev.id,oldType=ev.type,oldTitle=ev.problem||'',d=Object.fromEntries(new FormData(f).entries());
      let titleId='';
      if(d.type==='emergency'){
        const raw=String(d.problem||'').trim();
        let entry=findByNameOrAlias(raw);
        if(entry){d.problem=entry.name;titleId=entry.id}
        else if(raw){
          const proposed=smartTitleCase(raw);d.problem=proposed;
          const trulyNew=key(proposed)!==key(oldTitle)||!ev.problemTitleId;
          if(trulyNew){
            const add=await appConfirm(`“${proposed}” is not in Emergency Titles. Confirm = add it to the master catalog. Cancel = keep it only on this Maintenance Request. Review the spelling before adding.`, 'New Emergency Title');
            if(add){
              entry={id:uid('title'),name:proposed,status:'active',aliases:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};entries().push(entry);saveCatalogState();syncProblems();renderMasterRows();titleId=entry.id;
            }
          }
        }
      }
      Object.assign(ev,d);ev.vendor=$('#editUsedVendor').checked?vendorValue('edit'):'';if(!$('#editUsedVendor').checked)ev.vendorWork='';ev.result=ev.remarks||'';
      applyTypeDefaults(ev,ev.type,oldType);
      if(ev.type==='emergency')ev.problemTitleId=titleId||(findByNameOrAlias(ev.problem)?.id||'');else delete ev.problemTitleId;
      save(K.events,events);learnEvent(ev);linkRecordsToCatalog();closeModal('eventEditorModal');renderAll();previewRequest(savedId);toast(settings.language==='es'?'Maintenance Request guardado. Vista previa actualizada.':'Maintenance Request saved. Preview updated.');
    };
  }

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(NS))out[k]=localStorage.getItem(k)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:3,exportedAt:new Date().toISOString(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),emergencyTitleCatalog:clone(catalog),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:K.activeDraft?(load(K.activeDraft,'')||''):'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(window.reportableWorkState||(K.reportableWork?load(K.reportableWork,{version:1,activities:[],activeId:''}):{})),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    };
  }

  function enhance(){ensureStyles();ensureMasterManager();installNewTitleSave();installEditorSave();refreshQuickEditor();installBackupExport()}
  syncProblems();linkRecordsToCatalog();saveCatalogState();

  const baseRenderAllV077=renderAll;
  renderAll=function(){linkRecordsToCatalog();baseRenderAllV077();setTimeout(enhance,0);setTimeout(()=>{ensureMasterManager();renderMasterRows()},40)};
  const baseGoV077=go;
  go=function(id){baseGoV077(id);setTimeout(enhance,0);if(id==='settings')setTimeout(()=>{ensureMasterManager();renderMasterRows()},40)};

  enhance();
})();
