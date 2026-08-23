/* v0.5.1 print isolation / page setup */
(function(){
  const BODY_CLASSES=['print-payroll','print-summary','print-request'];
  const PAGE_RULES={
    payroll:'@page { size: letter portrait; margin: 0.28in; }',
    summary:'@page { size: letter landscape; margin: 0.22in; }',
    request:'@page { size: letter portrait; margin: 0.25in; }'
  };

  function clearPrintMode(){
    document.body.classList.remove(...BODY_CLASSES);
    const s=document.getElementById('ocma-dynamic-page-style');
    if(s)s.remove();
  }

  window.printForm=function(kind){
    if(!PAGE_RULES[kind])return;
    clearPrintMode();
    document.body.classList.add('print-'+kind);
    const style=document.createElement('style');
    style.id='ocma-dynamic-page-style';
    style.media='print';
    style.textContent=PAGE_RULES[kind];
    document.head.appendChild(style);
    requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
  };

  window.addEventListener('afterprint',clearPrintMode);
})();
