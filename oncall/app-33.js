/* v0.7.2 — Mandatory Overtime work switching + Apartment Finder autocomplete */
(function(){
  const VERSION='0.7.2';
  if(!K.reportableWork)return;

  const nowTime=()=>{const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`};
  const nowISO=()=>new Date().toISOString();
  const state=()=>window.reportableWorkState||load(K.reportableWork,{version:1,activities:[],activeId:''});
  const persist=st=>{save(K.reportableWork,st);window.reportableWorkState=st};
  const activeActivity=()=>{const st=state(),a=(st.activities||[]).find(x=>x.id===st.activeId);return a&&a.status!=='CLOSED'?a:null};
  const activeEmergency=()=> (window.emergencyDrafts||[]).find(d=>d.workflowStatus==='IN_PROGRESS'&&d.workSelected===true)||null;
  const codeOf=a=>String(a?.code||`${a?.building||''}-${a?.unit||''}`).trim();
  const normalize=q=>String(q||'').trim().toUpperCase().replace(/\s/g,'');

  function ensureStyles(){
    if($('#v072MandatoryStyles'))return;
    const s=document.createElement('style');s.id='v072MandatoryStyles';s.textContent=`
      #v070MandatoryTask{display:none!important}
      .v072-selected-address{margin-top:5px;padding:7px 9px;border-radius:8px;background:#edf8f5;color:#276455;font-size:11px}
      .v072-activity-custom.hidden,.v072-selected-address.hidden{display:none!important}
      .v072-change-panel{margin-top:12px;padding:11px;border:1px solid #d7e0e6;border-radius:11px;background:#fff}
      .v072-change-panel .form-grid{margin-top:8px}
      .v072-change-help{font-size:11px;color:#6a7885;margin-top:4px}
      .v072-apartment-wrap{position:relative}
      .v072-results{position:absolute;left:0;right:0;top:100%;z-index:50;background:#fff;border:1px solid #cbd5dc;border-radius:9px;box-shadow:0 8px 20px rgba(24,50,70,.15);max-height:230px;overflow:auto}
      .v072-results.hidden{display:none!important}
      .v072-results button{display:block;width:100%;border:0;border-bottom:1px solid #edf1f3;background:#fff;text-align:left;padding:8px 10px;cursor:pointer}
      .v072-results button:hover{background:#f3f8fb}
      .v072-results b{display:block;font-size:12px}.v072-results small{display:block;color:#647684;margin-top:2px}
    `;document.head.appendChild(s);
  }

  function activityValue(sel,custom){
    const v=sel?.value||'Prep';
    if(v==='Other Work')return (custom?.value||'Other Work').trim()||'Other Work';
    return v;
  }

  function wireActivitySelect(sel,custom,hiddenInput){
    if(!sel||sel.dataset.v072Wired)return;
    sel.dataset.v072Wired='1';
    const sync=()=>{
      const other=sel.value==='Other Work';
      custom?.classList.toggle('hidden',!other);
      if(hiddenInput)hiddenInput.value=activityValue(sel,custom);
    };
    sel.onchange=sync;
    if(custom)custom.oninput=sync;
    sync();
  }

  function apartmentMatches(q){
    const n=normalize(q);if(!n)return[];
    return (window.APARTMENT_DATA||[]).filter(a=>{
      const code=normalize(codeOf(a)),unit=normalize(a.unit),building=normalize(a.building);
      return code.includes(n)||unit.includes(n)||building.includes(n);
    }).slice(0,12);
  }

  function attachApartmentFinder(input,tag){
    if(!input||input.dataset.v072Finder)return;
    input.dataset.v072Finder='1';
    const wrap=document.createElement('div');wrap.className='v072-apartment-wrap';
    input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
    const results=document.createElement('div');results.className='v072-results hidden';results.id=`v072Results-${tag}`;wrap.appendChild(results);
    const chosen=document.createElement('div');chosen.className='v072-selected-address hidden';chosen.id=`v072Chosen-${tag}`;wrap.insertAdjacentElement('afterend',chosen);

    const showChosen=a=>{
      if(!a){chosen.classList.add('hidden');chosen.textContent='';input.dataset.fullAddress='';input.dataset.apartmentCode='';return}
      const code=codeOf(a),address=typeof apartmentAddress==='function'?apartmentAddress(a):(typeof apartmentDisplay==='function'?apartmentDisplay(a):code);
      input.value=code;input.dataset.apartmentCode=code;input.dataset.fullAddress=address||'';
      chosen.textContent=address||code;chosen.classList.remove('hidden');results.classList.add('hidden');
    };
    const render=()=>{
      showChosen(null);
      const ms=apartmentMatches(input.value);
      if(!ms.length){results.classList.add('hidden');results.innerHTML='';return}
      results.innerHTML=ms.map(a=>{const code=codeOf(a),address=typeof apartmentDisplay==='function'?apartmentDisplay(a):code;return `<button type="button" data-code="${esc(code)}"><b>${esc(code)}</b><small>${esc(address)}</small></button>`}).join('');
      results.classList.remove('hidden');
      results.querySelectorAll('button').forEach(b=>b.onclick=()=>{const a=(window.APARTMENT_DATA||[]).find(x=>codeOf(x)===b.dataset.code);showChosen(a)});
    };
    input.addEventListener('input',render);
    input.addEventListener('focus',()=>{if(input.value)render()});
    input.addEventListener('blur',()=>setTimeout(()=>results.classList.add('hidden'),160));

    const exact=(window.APARTMENT_DATA||[]).find(a=>normalize(codeOf(a))===normalize(input.value));
    if(exact)showChosen(exact);
  }

  function ensureSetupEnhancements(){
    const input=$('#v070MandatoryTask'),loc=$('#v070MandatoryLocation');if(!input||!loc)return;
    if(!$('#v072MandatoryActivity')){
      const label=input.closest('label');
      const sel=document.createElement('select');sel.id='v072MandatoryActivity';
      sel.innerHTML='<option>Prep</option><option>Work Orders</option><option>Snow Removal</option><option>Other Work</option>';
      const custom=document.createElement('input');custom.id='v072MandatoryCustom';custom.className='v072-activity-custom hidden';custom.placeholder='Describe work';custom.style.marginTop='6px';
      const current=(input.value||'Prep').trim();
      if(['Prep','Work Orders','Snow Removal'].includes(current))sel.value=current;else{sel.value='Other Work';custom.value=current||'Other Work'}
      input.insertAdjacentElement('beforebegin',sel);sel.insertAdjacentElement('afterend',custom);
      wireActivitySelect(sel,custom,input);
      if(label?.querySelector('span'))label.querySelector('span').textContent='Work / Activity';
    }
    attachApartmentFinder(loc,'setup');
  }

  function addSegment(a,start,end){
    if(!start||!end)return;
    if(mins(end)<mins(start))return;
    if(start===end)return;
    const last=(a.segments||[])[(a.segments||[]).length-1];
    if(last&&last.kind==='work'&&last.start===start&&last.end===end&&last.label===a.currentLabel&&last.location===a.currentLocation)return;
    (a.segments??=[]).push({kind:'work',start,end,label:a.currentLabel||'Work',location:a.currentLocation||'',fullAddress:a.currentFullAddress||''});
  }

  function changeMandatoryWork(){
    const st=state(),a=activeActivity();
    if(!a||a.type!=='mandatory_ot'||a.status!=='ACTIVE')return toast('Mandatory Overtime must be ACTIVE to change work.');
    if(activeEmergency())return toast('An emergency is IN PROGRESS. Close it before changing Mandatory work.');
    const sel=$('#v072ActiveActivity'),custom=$('#v072ActiveCustom'),loc=$('#v072ActiveLocation');
    const label=activityValue(sel,custom),location=(loc?.dataset.apartmentCode||loc?.value||'').trim(),fullAddress=(loc?.dataset.fullAddress||'').trim();
    if(!label)return toast('Select the work/activity.');
    const t=nowTime();
    if(label===a.currentLabel&&location===(a.currentLocation||''))return toast('This work/activity is already running.');
    if(a.currentSegmentStart&&a.currentSegmentStart!==t)addSegment(a,a.currentSegmentStart,t);
    a.currentLabel=label;a.currentLocation=location;a.currentFullAddress=fullAddress;a.currentSegmentStart=t;a.updatedAt=nowISO();
    (a.locationBook??={});if(location&&fullAddress)a.locationBook[location]=fullAddress;
    persist(st);renderAll();toast(`${label}${location?' · '+location:''} started at ${clock(t)}. Previous segment ended at the same time.`);
  }

  function ensureActiveChangePanel(){
    const box=$('#v070ActiveWrap'),a=activeActivity();if(!box)return;
    const old=$('#v072ChangeWorkPanel');
    if(!a||a.type!=='mandatory_ot'||a.status!=='ACTIVE'){old?.remove();return}
    if(old)return;
    const panel=document.createElement('div');panel.id='v072ChangeWorkPanel';panel.className='v072-change-panel';
    panel.innerHTML=`<b>Change Work / Next Work Order</b><div class="v072-change-help">Changing work closes the current segment and starts the next one at the exact same minute — no manual Pause and no gap.</div><div class="form-grid"><label><span>Work / Activity</span><select id="v072ActiveActivity"><option>Prep</option><option>Work Orders</option><option>Snow Removal</option><option>Other Work</option></select><input id="v072ActiveCustom" class="v072-activity-custom hidden" placeholder="Describe work" style="margin-top:6px"></label><label><span>Location / Apt / Area</span><input id="v072ActiveLocation" placeholder="61C / 3535 / 3535-61C / Area"></label></div><div class="v070-actions"><button type="button" class="secondary" id="v072ChangeWorkBtn">Change Work / Next Work Order</button></div>`;
    box.appendChild(panel);
    const sel=$('#v072ActiveActivity'),custom=$('#v072ActiveCustom'),loc=$('#v072ActiveLocation');
    const current=(a.currentLabel||'Prep').trim();
    if(['Prep','Work Orders','Snow Removal'].includes(current))sel.value=current;else{sel.value='Other Work';custom.value=current}
    wireActivitySelect(sel,custom,null);
    loc.value=a.currentLocation||'';attachApartmentFinder(loc,'active');
    const exact=(window.APARTMENT_DATA||[]).find(x=>normalize(codeOf(x))===normalize(loc.value));
    if(exact){loc.dispatchEvent(new Event('focus'));setTimeout(()=>{const btn=$(`#v072Results-active button[data-code="${CSS.escape(codeOf(exact))}"]`);btn?.click()},0)}
    $('#v072ChangeWorkBtn').onclick=changeMandatoryWork;
  }

  function enhance(){ensureStyles();ensureSetupEnhancements();ensureActiveChangePanel()}

  function namespacedStorage(){const out={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith(NS))out[key]=localStorage.getItem(key)}return out}
  function installBackupExport(){
    const b=$('#exportDataBtn');if(!b)return;
    b.onclick=async()=>{
      const data={kind:'oncall-maintenance-backup',version:VERSION,schema:2,exportedAt:nowISO(),settings:clone(settings),currentPeriodStart,payrollStore:clone(payrollStore||{}),snapshots:clone(snapshots||{}),events:clone(events||[]),problems:clone(problems||[]),folioStarts:clone(folioStarts||{}),localKnowledge:clone(localKnowledge||[]),vendors:clone(vendors||[]),periodStatuses:clone(window.periodStatuses||{}),onCallSessions:clone(window.onCallSessions||[]),emergencyDrafts:clone(window.emergencyDrafts||[]),activeDraftId:load(K.activeDraft,'')||'',reportDates:clone(window.reportDates||{}),folioHistory:clone(window.folioHistory||{}),reportableWork:clone(state()),storage:namespacedStorage()};
      const text=JSON.stringify(data,null,2),name=`oncall-maintenance-v${VERSION}-FULL-backup.json`,type='application/json',blob=new Blob([text],{type});
      try{const file=new File([blob],name,{type});if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:name});return}catch(err){if(err?.name==='AbortError')return}}}catch(e){}
      const x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download=name;x.click();setTimeout(()=>URL.revokeObjectURL(x.href),1500);
    };
  }

  const baseRenderAllV072=renderAll;
  renderAll=function(){baseRenderAllV072();setTimeout(enhance,0);setTimeout(enhance,100);installBackupExport()};
  const baseGoV072=go;
  go=function(id){baseGoV072(id);if(id==='reportableWork'){setTimeout(enhance,0);setTimeout(enhance,100)}installBackupExport()};

  const root=$('#reportableWork');if(root){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})}).observe(root,{subtree:true,childList:true})}
  enhance();installBackupExport();
})();
