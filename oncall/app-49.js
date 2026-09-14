/* v0.7.18 — Keep one On-Call Work Session continuous across Mandatory → Emergency → Resume */
(function(){
  const VERSION='0.7.18';
  const rwState=()=>window.reportableWorkState||{activities:[]};
  const sessions=()=>window.onCallSessions||[];
  const drafts=()=>window.emergencyDrafts||[];
  const nowISO=()=>new Date().toISOString();

  function sessionTimeRank(s){
    return String(s?.createdAt||'')+'|'+String(s?.date||'')+'|'+String(s?.in||'');
  }

  function activitySessions(a){
    if(!a?.id)return[];
    return sessions().filter(s=>s?.reportableOwnerId===a.id).sort((x,y)=>sessionTimeRank(x).localeCompare(sessionTimeRank(y)));
  }

  function latestCursor(ss,a){
    const vals=ss.map(s=>s?.nextWorkStart).filter(Boolean);
    if(vals.length)return vals[vals.length-1];
    return a?.resumeCursor||a?.pauseStartedAt||a?.currentSegmentStart||a?.start||'';
  }

  function remapSessionRefs(oldIds,primaryId){
    if(!oldIds.size)return false;
    let changed=false;
    for(const d of drafts()){
      if(oldIds.has(d.sessionId)){d.sessionId=primaryId;d.updatedAt=nowISO();changed=true}
    }
    for(const e of events||[]){
      if(oldIds.has(e.sessionId)){e.sessionId=primaryId;changed=true}
    }
    return changed;
  }

  function consolidateActivity(a){
    const ss=activitySessions(a);if(!ss.length)return false;
    const primary=ss[0],duplicates=ss.slice(1),oldIds=new Set(duplicates.map(s=>s.id));
    let changed=false;

    const cursor=latestCursor(ss,a);
    if(cursor&&primary.nextWorkStart!==cursor){primary.nextWorkStart=cursor;changed=true}
    if(primary.reportableOwnerId!==a.id){primary.reportableOwnerId=a.id;changed=true}

    if(a.status==='CLOSED'){
      const end=a.end||[...ss].reverse().find(s=>s.out)?.out||primary.out||'';
      if(primary.status!=='CLOSED'){primary.status='CLOSED';changed=true}
      if(end&&primary.out!==end){primary.out=end;changed=true}
      if(!primary.closedAt){primary.closedAt=a.updatedAt||nowISO();changed=true}
    }else{
      if(primary.status!=='ACTIVE'){primary.status='ACTIVE';changed=true}
      if(primary.out){primary.out='';changed=true}
      if(primary.closedAt){primary.closedAt='';changed=true}
    }

    if(duplicates.length){
      remapSessionRefs(oldIds,primary.id);
      window.onCallSessions=sessions().filter(s=>!oldIds.has(s.id));
      changed=true;
    }

    if(changed){primary.updatedAt=nowISO();primary.mandatorySessionContinuityV0718=true}
    return changed;
  }

  function healMandatorySessions(){
    let changed=false;
    for(const a of rwState().activities||[]){
      if(a?.type!=='mandatory_ot')continue;
      if(consolidateActivity(a))changed=true;
    }
    if(changed){
      save(K.sessions,window.onCallSessions||[]);
      save(K.emergencyDrafts,window.emergencyDrafts||[]);
      save(K.events,events);
    }
    return changed;
  }

  function refreshAfterEmergencyClose(){
    const changed=healMandatorySessions();
    if(changed){
      renderAll();
      if($('#emergency')?.classList.contains('active')&&typeof renderWorkflow==='function')renderWorkflow();
    }
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.workflow-card-close,#workflowOutBtn')){
      [30,320,650].forEach(ms=>setTimeout(refreshAfterEmergencyClose,ms));
    }
    if(e.target?.closest?.('#v070Resume,#v070BannerResume,#v070Finish')){
      [0,120].forEach(ms=>setTimeout(healMandatorySessions,ms));
    }
  },true);

  const baseRenderAllV0718=renderAll;
  renderAll=function(){
    healMandatorySessions();
    baseRenderAllV0718();
    setTimeout(healMandatorySessions,80);
  };

  const baseGoV0718=go;
  go=function(id){
    healMandatorySessions();
    baseGoV0718(id);
    setTimeout(healMandatorySessions,80);
  };

  healMandatorySessions();
})();
