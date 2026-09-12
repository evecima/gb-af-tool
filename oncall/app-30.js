/* v0.6.18 — make Mandatory Overtime available in the field New Emergency / Work Request flow */
(function(){
  const REQUIRED_FIELD_TITLES=['Mandatory Overtime'];
  let changed=false;
  for(const title of REQUIRED_FIELD_TITLES){
    if(!problems.some(p=>String(p).trim().toLowerCase()===title.toLowerCase())){
      problems.push(title);changed=true;
    }
  }
  if(changed){problems.sort((a,b)=>a.localeCompare(b));save(K.problems,problems)}
  if(typeof refreshProblems==='function')refreshProblems();
})();
