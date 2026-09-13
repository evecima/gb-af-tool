/* v0.7.6 — emergency title cleanup + dedupe + compact searchable title manager */
(function(){
  const VERSION='0.7.6';
  if(!K?.problems)return;

  const ALIASES=new Map([
    ['a/c not working','Air Conditioner Not Cooling'],
    ['air conditioner not cooling','Air Conditioner Not Cooling'],
    ['boiler system service','Boiler System Service'],
    ['heating service could not be completed','Heating Service Could Not Be Completed'],
    ['heating pipe leak','Heating Pipe Leak'],
    ['kitchen sink backing up into dishwasher','Kitchen Sink Backup'],
    ['main line backup affecting toilet, bathtub and sink','Main Sewer Backup'],
    ['main line backup affecting toilet, bathtub, and sink','Main Sewer Backup'],
    ['recurring main-line blockage','Recurring Main Line Blockage'],
    ['toilet clogged / not flushing','Toilet Clogged / Not Flushing'],
    ['water entered apartment and soaked living room carpet','Water Entered Apartment and Soaked Living Room Carpet'],
    ['water leak damaged closet ceiling and wall','Water Leak Damaged Closet Ceiling and Wall'],
    ['whole-unit power loss','No Power'],
    ['lockout - entry door deadbolt','Entry Door Deadbolt Lockout'],
    ['refrigerator not working','Refrigerator Not Working'],
    ['kitchen ceiling leak','Kitchen Ceiling Leak']
  ]);

  const normalizeKey=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
  const canonical=v=>{
    const s=String(v||'').trim();
    if(!s)return'';
    return ALIASES.get(normalizeKey(s))||s;
  };
  const dedupe=arr=>{
    const seen=new Set(),out=[];
    for(const raw of arr||[]){
      const v=canonical(raw);if(!v)continue;
      const k=normalizeKey(v);if(seen.has(k))continue;
      seen.add(k);out.push(v);
    }
    return out.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
  };

  function migrateTitles(){
    let changed=false;
    const next=dedupe(problems||[]);
    if(JSON.stringify(next)!==JSON.stringify(problems||[])){problems=next;save(K.problems,problems);changed=true}

    for(const ev of events||[]){
      if(ev?.type!=='emergency'||!ev.problem)continue;
      const v=canonical(ev.problem);if(v!==ev.problem){ev.problem=v;changed=true}
    }
    if(changed)save(K.events,events);

    if(Array.isArray(window.emergencyDrafts)&&K.emergencyDrafts){
      let dChanged=false;
      for(const d of window.emergencyDrafts){if(d?.problem){const v=canonical(d.problem);if(v!==d.problem){d.problem=v;dChanged=true}}}
      if(dChanged){save(K.emergencyDrafts,window.emergencyDrafts);changed=true}
    }

    if(Array.isArray(localKnowledge)){
      let kChanged=false;
      for(const k of localKnowledge){if(k?.problem){const v=canonical(k.problem);if(v!==k.problem){k.problem=v;kChanged=true}}}
      if(kChanged){save(K.knowledge,localKnowledge);changed=true}
    }

    if(typeof refreshProblems==='function')refreshProblems();
    return changed;
  }

  function ensureStyles(){
    if($('#v076TitleCompactStyles'))return;
    const s=document.createElement('style');s.id='v076TitleCompactStyles';s.textContent=`
      #v075TitleManager .v076-title-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
      #v075TitleManager .v076-title-toolbar input{flex:1;min-width:220px}
      #v075TitleManager .v076-title-body{margin-top:8px}
      #v075TitleManager .v075-title-list{max-height:420px;overflow:auto;padding-right:4px;margin-top:8px;border-top:1px solid #e5ebef;padding-top:8px}
      #v075TitleManager .v076-hidden{display:none!important}
      #v075TitleManager .v076-no-match{padding:10px;color:#6a7885;font-size:12px}
      #v075TitleManager .v076-count{font-size:11px;color:#667684}
      #v075TitleManager .v076-manage-btn{white-space:nowrap}
    `;document.head.appendChild(s);
  }

  function applyFilter(){
    const list=$('#v075TitleList'),search=$('#v076TitleSearch');if(!list)return;
    const q=String(search?.value||'').trim().toLowerCase();let shown=0,total=0;
    list.querySelectorAll('.v075-title-row').forEach(row=>{
      total++;
      const input=row.querySelector('.v075-title-input');
      const match=!q||String(input?.value||'').toLowerCase().includes(q);
      row.classList.toggle('v076-hidden',!match);if(match)shown++;
    });
    let empty=$('#v076NoMatch');
    if(!empty){empty=document.createElement('div');empty.id='v076NoMatch';empty.className='v076-no-match v076-hidden';empty.textContent='No matching Emergency Titles.';list.appendChild(empty)}
    empty.classList.toggle('v076-hidden',shown>0||!q);
    const count=$('#v076TitleCount');if(count)count.textContent=q?`${shown} of ${total} titles`:`${total} titles saved`;
    const btn=$('#v076ManageTitles');if(btn)btn.textContent=($('#v076TitleBody')?.classList.contains('v076-hidden')?'Manage Titles':'Hide Titles')+` (${total})`;
  }

  function ensureCompactManager(){
    const card=$('#v075TitleManager'),list=$('#v075TitleList');if(!card||!list)return;
    ensureStyles();
    if(!$('#v076TitleBody')){
      const body=document.createElement('div');body.id='v076TitleBody';body.className='v076-title-body v076-hidden';
      const toolbar=document.createElement('div');toolbar.className='v076-title-toolbar';
      toolbar.innerHTML='<input id="v076TitleSearch" type="search" placeholder="Search Emergency Title…"><span id="v076TitleCount" class="v076-count"></span>';
      list.parentNode.insertBefore(body,list);body.appendChild(toolbar);body.appendChild(list);

      const top=card.querySelector('.row.between.wrap.gap');
      if(top&&!$('#v076ManageTitles')){
        const btn=document.createElement('button');btn.type='button';btn.id='v076ManageTitles';btn.className='secondary v076-manage-btn';btn.textContent='Manage Titles';
        const add=$('#v075AddTitle');if(add)add.insertAdjacentElement('beforebegin',btn);else top.appendChild(btn);
        btn.onclick=()=>{body.classList.toggle('v076-hidden');applyFilter();if(!body.classList.contains('v076-hidden'))$('#v076TitleSearch')?.focus()};
      }
      $('#v076TitleSearch').addEventListener('input',applyFilter);
    }
    applyFilter();
    if(!list.dataset.v076Observed){
      list.dataset.v076Observed='1';
      new MutationObserver(()=>setTimeout(applyFilter,0)).observe(list,{childList:true,subtree:true});
    }
  }

  function refreshEditorQuick(){
    const sel=$('#v075EditProblemQuick');if(!sel)return;
    const input=$('#eventEditorForm')?.elements?.problem,current=String(input?.value||'').trim();
    sel.innerHTML='<option value="">— Select saved title —</option>'+dedupe(problems).map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('')+'<option value="__manual__">Other / Manual</option>';
    const match=problems.find(p=>normalizeKey(p)===normalizeKey(current));sel.value=match||'__manual__';
  }

  function enhance(){ensureCompactManager();refreshEditorQuick()}
  const changed=migrateTitles();
  const baseRenderAllV076=renderAll;
  renderAll=function(){baseRenderAllV076();setTimeout(enhance,0)};
  const baseGoV076=go;
  go=function(id){baseGoV076(id);if(id==='settings'||id==='requests')setTimeout(enhance,0)};

  if(changed)setTimeout(()=>{renderAll();toast('Emergency Titles were standardized and duplicate aliases were unified.')},0);
  enhance();
})();
