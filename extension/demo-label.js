/** Mark extension-owned demo surfaces using trusted worker data, without changing record status semantics. */
export function markDemo(enabled){
  if(!enabled||document.getElementById('extensionDemoBanner'))return;
  document.body.dataset.demoMode='true';
  const banner=document.createElement('div');banner.id='extensionDemoBanner';banner.className='demo-mode-banner';banner.setAttribute('role','note');
  banner.textContent='DEMO MODE — SYNTHETIC DATA';document.body.prepend(banner);document.title='DEMO · '+document.title;
  const viewerTitle=document.querySelector('#pdfViewer header h1');if(viewerTitle)viewerTitle.textContent='DEMO · DMV PDF results';
}
