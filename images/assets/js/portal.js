import { buildAdminNavigation } from './navigation.js';
import { supabase } from './supabase.js';

const ROOT = new URL('../../', import.meta.url);
const rootUrl = (file='') => new URL(file, ROOT).href;
const entitlementByFile = {
  'employees.html':'employee_management','programs.html':'programs','random-pools.html':'random_pool',
  'selections.html':'random_selections','testing-orders.html':'testing_orders','results.html':'results_summary',
  'compliance.html':'compliance','documents.html':'documents','reports.html':'standard_reports',
  'integrations.html':'integrations','billing.html':null
};

function portalFor(ctx){
  const role=ctx?.membership?.role_code;
  const audience=ctx?.subscription?.plan?.audience;
  const orgType=ctx?.membership?.organization_type;
  if(role==='platform_admin') return 'admin';
  if(audience==='owner_operator') return 'owner-operator';
  if(audience==='ctpa' || orgType==='ctpa') return 'ctpa';
  return 'employer';
}
function currentPortal(){
  const parts=location.pathname.split('/').filter(Boolean);
  return ['admin','ctpa','employer','owner-operator'].find(x=>parts.includes(x))||null;
}
function initials(name,email){
  const s=(name||email||'User').trim().split(/\s+/).filter(Boolean);
  return ((s[0]?.[0]||'U')+(s.length>1?s[s.length-1][0]:'')).toUpperCase();
}
function allowed(ctx,key){ return !key || ctx?.entitlements?.[key]===true || ctx?.membership?.role_code==='platform_admin'; }

export async function getContext(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){ location.replace(rootUrl('login.html?next='+encodeURIComponent(location.pathname))); return null; }
  const {data,error}=await supabase.functions.invoke('workforce-session-context');
  if(error || !data){ console.error(error); location.replace(rootUrl('access-required.html?reason=context')); return null; }
  if(!data.has_access){ location.replace(rootUrl('access-required.html')); return null; }
  const expected=portalFor(data), actual=currentPortal();
  const isPlatformAdmin=data?.membership?.role_code==='platform_admin';
  if(actual && expected!==actual && !isPlatformAdmin){
    location.replace(rootUrl(expected+'/dashboard.html'));
    return null;
  }
  return data;
}


const portalViews = [
  { key:'admin', label:'Admin Portal', path:'admin/dashboard.html' },
  { key:'employer', label:'Employer Portal', path:'employer/dashboard.html' },
  { key:'ctpa', label:'C/TPA Portal', path:'ctpa/dashboard.html' },
  { key:'owner-operator', label:'Owner-Operator Portal', path:'owner-operator/dashboard.html' }
];

function portalLabel(key){
  return portalViews.find(v=>v.key===key)?.label || 'Portal';
}

function addPlatformPortalSwitcher(ctx){
  if(ctx?.membership?.role_code!=='platform_admin') return;
  const actions=document.querySelector('.topbar-actions');
  if(!actions || actions.querySelector('[data-portal-viewer]')) return;

  const actual=currentPortal() || 'admin';
  const wrap=document.createElement('div');
  wrap.className='portal-viewer';
  wrap.dataset.portalViewer='';

  const button=document.createElement('button');
  button.type='button';
  button.className='portal-view-button';
  button.setAttribute('aria-haspopup','menu');
  button.setAttribute('aria-expanded','false');
  button.innerHTML=`<span class="portal-view-label">View:</span><span class="portal-view-current">${portalLabel(actual)}</span><span aria-hidden="true">▾</span>`;

  const menu=document.createElement('div');
  menu.className='portal-view-menu';
  menu.setAttribute('role','menu');

  portalViews.forEach(view=>{
    const option=document.createElement('button');
    option.type='button';
    option.className='portal-view-option'+(view.key===actual?' active':'');
    option.textContent=view.label;
    option.addEventListener('click',()=>{
      sessionStorage.setItem('s4u_platform_portal_view',view.key);
      location.href=rootUrl(view.path);
    });
    menu.appendChild(option);
  });

  const note=document.createElement('div');
  note.className='portal-view-note';
  note.textContent='Platform Administrator view. Customer permissions are not changed.';
  menu.appendChild(note);

  button.addEventListener('click',(event)=>{
    event.stopPropagation();
    const open=wrap.classList.toggle('open');
    button.setAttribute('aria-expanded',String(open));
  });

  document.addEventListener('click',()=>{
    wrap.classList.remove('open');
    button.setAttribute('aria-expanded','false');
  });

  wrap.appendChild(button);
  wrap.appendChild(menu);

  const userChip=actions.querySelector('.user-chip');
  actions.insertBefore(wrap,userChip || actions.firstChild);
  addPlatformAccountSwitcher(ctx,actual,actions,userChip);
}

async function addPlatformAccountSwitcher(ctx,actual,actions,userChip){
  if(!['ctpa','employer'].includes(actual) || actions.querySelector('[data-account-viewer]')) return;
  const wrap=document.createElement('div');
  wrap.className='account-viewer';
  wrap.dataset.accountViewer='';
  const select=document.createElement('select');
  select.className='account-view-select';
  select.setAttribute('aria-label',actual==='ctpa'?'Select C/TPA account':'Select Employer account');
  select.innerHTML=`<option value="">${actual==='ctpa'?'Select C/TPA':'Select Employer'}</option>`;
  wrap.appendChild(select);
  actions.insertBefore(wrap,userChip || null);
  try{
    const {data,error}=await supabase.functions.invoke('workforce-admin-ctpa-context',{body:{action:'list_accounts'}});
    if(error) throw error;
    const list=actual==='ctpa'?(data?.ctpas||[]):(data?.employers||[]);
    const param=actual==='ctpa'?'ctpa':'employer';
    const current=new URLSearchParams(location.search).get(param)||sessionStorage.getItem(`s4u_platform_${param}_view`)||'';
    select.innerHTML+=list.map(x=>`<option value="${x.id}" ${x.id===current?'selected':''}>${String(x.name||'Account').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</option>`).join('');
    select.addEventListener('change',()=>{
      if(!select.value)return;
      sessionStorage.setItem(`s4u_platform_${param}_view`,select.value);
      location.href=rootUrl(`${actual}/dashboard.html?${param}=${encodeURIComponent(select.value)}`);
    });
  }catch(error){console.error('Account switcher unavailable',error);wrap.remove();}
}

function render(ctx){
  addPlatformPortalSwitcher(ctx);
  const name=[ctx?.profile?.first_name,ctx?.profile?.last_name].filter(Boolean).join(' ') || ctx?.user?.email || 'Account User';
  const org=ctx?.membership?.organization_name || 'Workforce Compliance';
  const role=ctx?.membership?.role_name || 'Account User';
  document.querySelectorAll('.page-title span').forEach(el=>el.textContent=org);
  document.querySelectorAll('.workspace').forEach(el=>{ if(currentPortal()!=='admin') el.textContent=(ctx?.subscription?.plan?.name||role)+' Workspace'; });
  document.querySelectorAll('.user-chip .avatar').forEach(el=>el.textContent=initials(name,ctx?.user?.email));
  document.querySelectorAll('.user-meta strong').forEach(el=>el.textContent=name);
  document.querySelectorAll('.user-meta span').forEach(el=>el.textContent=role);
  document.querySelectorAll('[data-nav]').forEach(a=>{
    const file=(a.getAttribute('href')||'').split('/').pop();
    const key=entitlementByFile[file];
    if(key && !allowed(ctx,key)) a.hidden=true;
    if(location.pathname.endsWith('/'+file)) a.classList.add('active');
  });
  document.querySelectorAll('[data-org]').forEach(el=>el.textContent=org);
  document.querySelectorAll('[data-plan]').forEach(el=>el.textContent=ctx?.subscription?.plan?.name||'Platform Administration');
}


function sidebarStateKey(){
  return `s4u_sidebar_collapsed_${currentPortal()||'portal'}`;
}
function sidebarScrollKey(){
  return `s4u_sidebar_scroll_${currentPortal()||'portal'}`;
}
function setSidebarCollapsed(collapsed){
  document.body.classList.toggle('sidebar-collapsed',collapsed);
  localStorage.setItem(sidebarStateKey(),collapsed?'1':'0');
  const b=document.querySelector('[data-sidebar-toggle]');
  if(b){
    b.setAttribute('aria-expanded',String(!collapsed));
    b.setAttribute('aria-label',collapsed?'Show sidebar':'Hide sidebar');
    b.title=collapsed?'Show sidebar':'Hide sidebar';
    b.innerHTML=collapsed?'<span aria-hidden="true">☰</span>':'<span aria-hidden="true">‹</span>';
  }
}
function saveSidebarScroll(){
  const nav=document.querySelector('.sidebar-nav');
  if(nav) sessionStorage.setItem(sidebarScrollKey(),String(nav.scrollTop||0));
}
function markActiveNavigation(){
  const file=location.pathname.split('/').filter(Boolean).pop()||'';
  let active=null;
  document.querySelectorAll('.sidebar-nav a[href]').forEach(a=>{
    const href=(a.getAttribute('href')||'').split('?')[0].split('#')[0];
    const target=href.split('/').pop();
    const isActive=target===file;
    a.classList.toggle('active',isActive);
    if(isActive) active=a;
  });
  if(active){
    const submenu=active.closest('.sidebar-submenu');
    if(submenu){
      submenu.classList.add('open');
      const previous=submenu.previousElementSibling;
      if(previous?.classList.contains('sidebar-group-toggle')) previous.classList.add('open');
    }
  }
  return active;
}
function restoreSidebarScroll(){
  const nav=document.querySelector('.sidebar-nav');
  if(!nav)return;
  const active=markActiveNavigation();
  const saved=Number(sessionStorage.getItem(sidebarScrollKey()));
  if(Number.isFinite(saved) && saved>0) nav.scrollTop=saved;
  requestAnimationFrame(()=>{
    if(!active)return;
    const nr=nav.getBoundingClientRect(), ar=active.getBoundingClientRect();
    if(ar.top<nr.top+8) nav.scrollTop-=((nr.top+8)-ar.top);
    else if(ar.bottom>nr.bottom-8) nav.scrollTop+=(ar.bottom-(nr.bottom-8));
    saveSidebarScroll();
  });
}
function addDesktopSidebarToggle(){
  const left=document.querySelector('.topbar-left');
  if(!left || left.querySelector('[data-sidebar-toggle]'))return;
  const b=document.createElement('button');
  b.type='button';
  b.className='sidebar-toggle';
  b.dataset.sidebarToggle='';
  b.addEventListener('click',()=>setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
  left.insertBefore(b,left.firstChild);
  setSidebarCollapsed(localStorage.getItem(sidebarStateKey())==='1');
}
function wireSidebarPersistence(){
  const nav=document.querySelector('.sidebar-nav');
  if(!nav)return;
  nav.addEventListener('scroll',saveSidebarScroll,{passive:true});
  nav.addEventListener('click',e=>{
    const link=e.target.closest('a[href]');
    if(link) saveSidebarScroll();
  });
  document.querySelectorAll('.sidebar-group-toggle').forEach(btn=>{
    btn.addEventListener('click',()=>requestAnimationFrame(saveSidebarScroll));
  });
  window.addEventListener('pagehide',saveSidebarScroll);
  restoreSidebarScroll();
}

const FONT_SCALE_KEY='s4u_portal_font_scale';
const FONT_SCALES=[0.9,1,1.1,1.2,1.3];
function applyFontScale(value){
  let v=Number(value);if(!FONT_SCALES.includes(v))v=1;
  document.documentElement.style.setProperty('--portal-font-scale',String(v));
  localStorage.setItem(FONT_SCALE_KEY,String(v));
  document.querySelectorAll('[data-font-scale-value]').forEach(x=>x.textContent=`${Math.round(v*100)}%`);
}
function addFontSizer(){
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY)||1);
  const actions=document.querySelector('.topbar-actions');
  if(!actions||actions.querySelector('[data-font-sizer]'))return;
  const wrap=document.createElement('div');wrap.className='font-sizer';wrap.dataset.fontSizer='';
  const down=document.createElement('button');down.type='button';down.textContent='A−';down.setAttribute('aria-label','Decrease portal text size');
  const value=document.createElement('span');value.className='font-sizer-value';value.dataset.fontScaleValue='';
  const up=document.createElement('button');up.type='button';up.textContent='A+';up.setAttribute('aria-label','Increase portal text size');
  const change=step=>{let cur=Number(localStorage.getItem(FONT_SCALE_KEY)||1),i=FONT_SCALES.indexOf(cur);if(i<0)i=1;i=Math.max(0,Math.min(FONT_SCALES.length-1,i+step));applyFontScale(FONT_SCALES[i])};
  down.addEventListener('click',()=>change(-1));up.addEventListener('click',()=>change(1));
  wrap.append(down,value,up);
  const bell=[...actions.querySelectorAll('button')].find(x=>/notification/i.test(x.getAttribute('aria-label')||''));
  if(bell)bell.insertAdjacentElement('afterend',wrap);else actions.insertBefore(wrap,actions.firstChild);
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY)||1);
}

function wireUi(){
  buildAdminNavigation();
  addFontSizer();
  const sidebar=document.querySelector('.sidebar');
  const toggle=document.querySelector('[data-mobile-menu]');
  if(toggle&&sidebar) toggle.addEventListener('click',()=>sidebar.classList.toggle('open'));
  addDesktopSidebarToggle();
  wireSidebarPersistence();
  const actions=document.querySelector('.topbar-actions');
  if(actions && !actions.querySelector('[data-logout]')){
    const b=document.createElement('button'); b.className='btn btn-outline'; b.dataset.logout=''; b.textContent='Sign Out';
    b.addEventListener('click',async()=>{ await supabase.auth.signOut(); location.replace(rootUrl('login.html')); });
    actions.appendChild(b);
  }
}

document.addEventListener('DOMContentLoaded',async()=>{
  wireUi();
  const ctx=await getContext();
  if(ctx){
    render(ctx);
    buildAdminNavigation();
    wireSidebarPersistence();
    markActiveNavigation();
    restoreSidebarScroll();
  }
});
