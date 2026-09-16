const $=(s,r=document)=>r.querySelector(s);
function makeButton(cls,attrs,html){const b=document.createElement('button');b.type='button';b.className=cls;for(const [k,v] of Object.entries(attrs||{})){if(k==='dataset'){Object.assign(b.dataset,v)}else b.setAttribute(k,v)}b.innerHTML=html;return b}
function enhance(){
  const topbar=$('.topbar'),left=$('.topbar-left'),actions=$('.topbar-actions');
  if(left&&!$('[data-sidebar-toggle]',left)){
    const mobile=$('[data-mobile-menu]',left);
    const btn=makeButton('sidebar-toggle',{'data-sidebar-toggle':'','aria-label':'Hide sidebar','aria-expanded':'true'},'<span data-sidebar-toggle-icon>‹</span>');
    left.insertBefore(btn,mobile||left.firstChild);
  }
  if(actions&&!$('[data-font-decrease]',actions)){
    const fs=document.createElement('div');fs.className='font-sizer';fs.setAttribute('aria-label','Text size');
    fs.innerHTML='<button type="button" data-font-decrease aria-label="Decrease text size">A−</button><span class="font-sizer-value" data-font-scale-value>100%</span><button type="button" data-font-increase aria-label="Increase text size">A+</button>';
    const chip=$('.user-chip',actions);actions.insertBefore(fs,chip||null);
  }
  if(actions&&!$('[data-logout]',actions)){
    const out=makeButton('btn btn-outline admin-signout',{'data-logout':'','aria-label':'Sign out'},'Sign Out');
    actions.appendChild(out);
  }
  const bell=[...document.querySelectorAll('.top-action')].find(x=>/notification/i.test(x.getAttribute('aria-label')||''));
  if(bell){bell.title='Notification delivery log';bell.addEventListener('click',()=>{location.href='admin-notification-log.html'});}
  const help=[...document.querySelectorAll('.top-action')].find(x=>/help/i.test(x.getAttribute('aria-label')||''));
  if(help){help.title='Support tickets';help.addEventListener('click',()=>{location.href='support.html'});}
  const h1=$('.content h1')||$('.welcome h1');
  const title=$('.page-title strong');if(h1&&title)title.textContent=h1.textContent.trim();
  const support=$('.sidebar-help');if(support){support.innerHTML='<strong>Support queue</strong><span>Review customer tickets and platform requests.</span>';support.tabIndex=0;support.setAttribute('role','link');support.onclick=()=>location.href='support.html';support.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();support.click();}};}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('.sidebar')?.classList.remove('open')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
