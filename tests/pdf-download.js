// Test-only adapter: expose the real PDF blob as a download, instead of a popup.
// This file is never loaded by production pages.
Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
window.open=function(url){
  const a=document.createElement('a');a.href=url;a.download='payroll-test.pdf';
  a.textContent='Download test PDF';a.id='testPdfDownload';
  document.querySelector('.ios-pdf-toolbar').appendChild(a);
  return {closed:false};
};
