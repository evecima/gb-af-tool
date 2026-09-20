/* v0.7.22 — Display-only Mandatory Overtime prefix in On-Call Time Summary. */
(function(){
  const baseEventLabel=eventLabel;
  eventLabel=function(e){
    const label=baseEventLabel(e);
    // Only ephemeral rows generated for the Summary have this source.
    // The saved Maintenance Request, segment labels, and Payroll stay unchanged.
    if(e?.type!=='mandatory_ot'||e?.source!=='mandatory-segment-v0715')return label;
    const work=String(label||'').trim();
    if(!work||work==='Mandatory Overtime')return 'Mandatory Overtime';
    return /^Mandatory Overtime(?:\s*[—–:-]\s*|$)/i.test(work)?work:`Mandatory Overtime — ${work}`;
  };
})();
