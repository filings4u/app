import { buildAdminNavigation } from './navigation.js?v=20260916-admin-final';
import { supabase, authScope, workspaceStorageKey, workspaceStorageKeyFor, createScopedClient, authStorageKeyFor, loginPageForScope, clearPortalSessionState } from './supabase.js?v=20260916-auth-isolation-v4';

const ROOT = new URL('../../', import.meta.url);
const rootUrl = (file='') => new URL(file, ROOT).href;
const entitlementByFile = {
  'employees.html':'employee_management','employers.html':'employer_management','programs.html':'programs','random-pools.html':'consortium_pools',
  'selections.html':'random_selections','testing-orders.html':'testing_orders','results.html':'results_summary',
  'compliance.html':'compliance','documents.html':'documents','reports.html':'standard_reports',
  'integrations.html':'integrations','billing.html':'billing_tools','clearinghouse.html':'clearinghouse_tools','policies.html':'policy_builder','employer-controls.html':'employer_settings','employer-import.html':'employer_import','enrollment.html':'enrollment_documents','notifications.html':'notifications','branding.html':'white_label','audit.html':'audit_history','staff.html':'team_users','rtd-follow-up.html':'rtd_follow_up'
};

function portalFor(ctx){
  if(ctx?.portal==='admin') return 'admin';
  if(ctx?.portal==='owner_operator' || ctx?.portal==='owner-operator') return 'owner-operator';
  if(ctx?.portal==='ctpa') return 'ctpa';
  if(ctx?.portal==='employer') return 'employer';
  const role=ctx?.membership?.role_code;
  const audience=ctx?.subscription?.audience || ctx?.subscription?.plan?.audience;
  const orgType=ctx?.membership?.organization_type;
  if(role==='platform_admin') return 'admin';
  if(role==='owner_operator_admin' || audience==='owner_operator' || orgType==='owner_operator') return 'owner-operator';
  if(role==='ctpa_admin' || audience==='ctpa' || orgType==='ctpa') return 'ctpa';
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

function allowed(ctx,key){
  return !key || ctx?.entitlements?.[key]===true || ctx?.membership?.role_code==='platform_admin';
}

export async function getContext(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){
    location.replace(rootUrl(loginPageForScope(authScope)+'?next='+encodeURIComponent(location.pathname+location.search)));
    return null;
  }

  const params=new URLSearchParams(location.search);
  const workspaceFromUrl=params.get('workspace')||'';
  const selectedMembership=workspaceFromUrl||sessionStorage.getItem(workspaceStorageKey)||'';
  const contextCacheKey=`s4u_portal_context_${currentPortal()||'portal'}_${selectedMembership||'default'}`;
  let cachedContext=null;
  if(!workspaceFromUrl){
    try{const c=JSON.parse(sessionStorage.getItem(contextCacheKey)||'null');if(c&&Date.now()-c.saved_at<30000)cachedContext=c.data;}catch{}
  }
  let data=cachedContext,error=null;
  if(!data){
    ({data,error}=await supabase.functions.invoke('workforce-session-context',{
      body:{requested_portal:currentPortal(),membership_id:selectedMembership}
    }));
    if(data&&!error){try{sessionStorage.setItem(contextCacheKey,JSON.stringify({saved_at:Date.now(),data}));}catch{}}
  }

  if(error && /jwt.*future|issued at future|jwt.*expired|invalid jwt/i.test(error.message||'')){
    const refreshed=await supabase.auth.refreshSession();
    if(!refreshed.error){
      ({data,error}=await supabase.functions.invoke('workforce-session-context',{
        body:{requested_portal:currentPortal(),membership_id:selectedMembership}
      }));
    }
  }

  if(error || !data){
    console.error('Session context unavailable',error);
    location.replace(rootUrl(loginPageForScope(authScope)+'?next='+encodeURIComponent(location.pathname+location.search)+'&reason=session'));
    return null;
  }

  if(!data.has_access){
    location.replace(rootUrl('access-required.html?reason=subscription'));
    return null;
  }

  if(data.requires_workspace_selection){
    location.replace(rootUrl('workspace-select.html?portal='+encodeURIComponent(authScope)+'&next='+encodeURIComponent(location.pathname+location.search)));
    return null;
  }

  if(data?.membership?.id){
    sessionStorage.setItem(workspaceStorageKey,data.membership.id);
    if(workspaceFromUrl){
      params.delete('workspace');
      const clean=location.pathname+(params.toString()?`?${params.toString()}`:'')+location.hash;
      history.replaceState(history.state,'',clean);
    }
  }

  const expected=portalFor(data),actual=currentPortal();
  if(actual && expected!==actual){
    location.replace(rootUrl(expected+'/dashboard.html'));
    return null;
  }
  return data;
}

function render(ctx){
  const name=[ctx?.profile?.first_name,ctx?.profile?.last_name].filter(Boolean).join(' ') || ctx?.user?.email || 'Account User';
  const org=ctx?.membership?.organization_name || 'Workforce Compliance';
  const role=ctx?.membership?.role_name || 'Account User';
  document.querySelectorAll('.page-title span').forEach(el=>{el.textContent=org;});
  document.querySelectorAll('.workspace').forEach(el=>{
    if(currentPortal()!=='admin') el.textContent=(ctx?.subscription?.plan_name||ctx?.subscription?.plan?.name||role)+' Workspace';
  });
  document.querySelectorAll('.user-chip .avatar').forEach(el=>{el.textContent=initials(name,ctx?.user?.email);});
  document.querySelectorAll('.user-meta strong').forEach(el=>{el.textContent=name;});
  document.querySelectorAll('.user-meta span').forEach(el=>{el.textContent=role;});
  document.querySelectorAll('[data-nav]').forEach(a=>{
    const file=(a.getAttribute('href')||'').split('/').pop();
    const key=entitlementByFile[file];
    if(key && !allowed(ctx,key)) a.hidden=true;
    if(location.pathname.endsWith('/'+file)) a.classList.add('active');
  });
  document.querySelectorAll('[data-org]').forEach(el=>{el.textContent=org;});
  document.querySelectorAll('[data-plan]').forEach(el=>{el.textContent=ctx?.subscription?.plan_name||ctx?.subscription?.plan?.name||'Platform Administration';});
}

function sidebarStateKey(){return `s4u_sidebar_collapsed_${currentPortal()||'portal'}`;}
function sidebarScrollKey(){return `s4u_sidebar_scroll_${currentPortal()||'portal'}`;}

function setSidebarCollapsed(collapsed){
  document.body.classList.toggle('sidebar-collapsed',collapsed);
  localStorage.setItem(sidebarStateKey(),collapsed?'1':'0');
  const button=document.querySelector('[data-sidebar-toggle]');
  const icon=button?.querySelector('[data-sidebar-toggle-icon]');
  if(!button)return;
  button.setAttribute('aria-expanded',String(!collapsed));
  button.setAttribute('aria-label',collapsed?'Show sidebar':'Hide sidebar');
  button.title=collapsed?'Show sidebar':'Hide sidebar';
  if(icon) icon.textContent=collapsed?'☰':'‹';
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
    const nr=nav.getBoundingClientRect(),ar=active.getBoundingClientRect();
    if(ar.top<nr.top+8) nav.scrollTop-=((nr.top+8)-ar.top);
    else if(ar.bottom>nr.bottom-8) nav.scrollTop+=(ar.bottom-(nr.bottom-8));
    saveSidebarScroll();
  });
}

function bindOnce(element,key,handler,event='click',options){
  if(!element || element.dataset[key]==='1')return;
  element.dataset[key]='1';
  element.addEventListener(event,handler,options);
}

function wireSidebar(){
  const sidebar=document.querySelector('.sidebar');
  const mobile=document.querySelector('[data-mobile-menu]');
  bindOnce(mobile,'mobileBound',()=>sidebar?.classList.toggle('open'));

  const desktop=document.querySelector('[data-sidebar-toggle]');
  bindOnce(desktop,'sidebarBound',()=>setSidebarCollapsed(!document.body.classList.contains('sidebar-collapsed')));
  setSidebarCollapsed(localStorage.getItem(sidebarStateKey())==='1');

  const nav=document.querySelector('.sidebar-nav');
  if(nav){
    bindOnce(nav,'scrollBound',saveSidebarScroll,'scroll',{passive:true});
    bindOnce(nav,'linkBound',event=>{if(event.target.closest('a[href]'))saveSidebarScroll();});
  }
  document.querySelectorAll('.sidebar-group-toggle').forEach(btn=>{
    bindOnce(btn,'scrollSaveBound',()=>requestAnimationFrame(saveSidebarScroll));
  });
  restoreSidebarScroll();
}

const FONT_SCALE_KEY='s4u_portal_font_scale';
const FONT_SCALES=[0.9,1,1.1,1.2,1.3];
function applyFontScale(value){
  let v=Number(value);
  if(!FONT_SCALES.includes(v))v=1;
  document.documentElement.style.setProperty('--portal-font-scale',String(v));document.documentElement.style.zoom=String(v);
  localStorage.setItem(FONT_SCALE_KEY,String(v));
  document.querySelectorAll('[data-font-scale-value]').forEach(x=>{x.textContent=`${Math.round(v*100)}%`;});
}
function changeFont(step){
  let cur=Number(localStorage.getItem(FONT_SCALE_KEY)||1),i=FONT_SCALES.indexOf(cur);
  if(i<0)i=1;
  i=Math.max(0,Math.min(FONT_SCALES.length-1,i+step));
  applyFontScale(FONT_SCALES[i]);
}
function wireFontSizer(){
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY)||1);
  bindOnce(document.querySelector('[data-font-decrease]'),'fontBound',()=>changeFont(-1));
  bindOnce(document.querySelector('[data-font-increase]'),'fontBound',()=>changeFont(1));
}

function wireLogout(){
  const button=document.querySelector('[data-logout]');
  bindOnce(button,'logoutBound',async()=>{
    sessionStorage.removeItem(workspaceStorageKey);
    await supabase.auth.signOut({scope:'local'});
    location.replace(rootUrl('login.html'));
  });
}

function configureWorkspaceLink(ctx){
  const link=document.querySelector('[data-workspace-switcher]');
  if(!link)return;
  const show=ctx?.membership?.role_code!=='platform_admin' && Array.isArray(ctx?.workspaces) && ctx.workspaces.length>1;
  link.hidden=!show;
  if(show) link.href=rootUrl('workspace-select.html');
}

/* Platform Admin portal switching is intentionally kept separate from customer UI. */
const portalViews=[
  {key:'admin',label:'Admin Portal',path:'admin/dashboard.html'},
  {key:'employer',label:'Employer Portal',path:'employer/dashboard.html'},
  {key:'ctpa',label:'C/TPA Portal',path:'ctpa/dashboard.html'},
  {key:'owner-operator',label:'Owner-Operator Portal',path:'owner-operator/dashboard.html'}
];
function portalLabel(key){return portalViews.find(v=>v.key===key)?.label||'Portal';}
function addPlatformPortalSwitcher(ctx){
  if(ctx?.membership?.role_code!=='platform_admin')return;
  const actions=document.querySelector('.topbar-actions');
  if(!actions || actions.querySelector('[data-portal-viewer]'))return;
  const actual=currentPortal()||'admin';
  const wrap=document.createElement('div');wrap.className='portal-viewer';wrap.dataset.portalViewer='';
  const button=document.createElement('button');button.type='button';button.className='portal-view-button';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');
  const label=document.createElement('span');label.className='portal-view-label';label.textContent='View:';
  const current=document.createElement('span');current.className='portal-view-current';current.textContent=portalLabel(actual);
  const caret=document.createElement('span');caret.setAttribute('aria-hidden','true');caret.textContent='▾';
  button.append(label,current,caret);
  const menu=document.createElement('div');menu.className='portal-view-menu';menu.setAttribute('role','menu');
  portalViews.forEach(view=>{const option=document.createElement('button');option.type='button';option.className='portal-view-option'+(view.key===actual?' active':'');option.textContent=view.label;option.addEventListener('click',()=>{sessionStorage.setItem('s4u_platform_portal_view',view.key);location.href=rootUrl(view.path);});menu.appendChild(option);});
  const note=document.createElement('div');note.className='portal-view-note';note.textContent='Platform Administrator view. Customer permissions are not changed.';menu.appendChild(note);
  button.addEventListener('click',event=>{event.stopPropagation();const open=wrap.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',()=>{wrap.classList.remove('open');button.setAttribute('aria-expanded','false');},{once:false});
  wrap.append(button,menu);
  const userChip=actions.querySelector('.user-chip');
  actions.insertBefore(wrap,userChip||actions.firstChild);
  addPlatformAccountSwitcher(actual,actions,userChip);
}

async function addPlatformAccountSwitcher(actual,actions,userChip){
  if(!['ctpa','employer'].includes(actual) || actions.querySelector('[data-account-viewer]'))return;
  try{
    const fn=actual==='ctpa'?'workforce-admin-ctpa-context':'workforce-admin-employer-context';
    const body=actual==='ctpa'?{action:'list_accounts'}:{action:'list'};
    const {data,error}=await supabase.functions.invoke(fn,{body});
    if(error)throw error;
    const list=actual==='ctpa'?(data?.ctpas||[]):(data?.employers||[]).map(x=>({...x,name:x.name||x.legal_name||'Employer'}));
    const param=actual==='ctpa'?'ctpa':'employer';
    const selected=new URLSearchParams(location.search).get(param)||sessionStorage.getItem(`s4u_platform_${param}_view`)||'';
    const wrap=document.createElement('div');wrap.className='account-viewer';wrap.dataset.accountViewer='';
    const select=document.createElement('select');select.className='account-view-select';select.setAttribute('aria-label',actual==='ctpa'?'Select C/TPA account':'Select Employer account');
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=actual==='ctpa'?'Select C/TPA':'Select Employer';select.appendChild(placeholder);
    list.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=String(item.name||'Account');option.selected=item.id===selected;select.appendChild(option);});
    select.addEventListener('change',()=>{if(!select.value)return;sessionStorage.setItem(`s4u_platform_${param}_view`,select.value);location.href=rootUrl(`${actual}/dashboard.html?${param}=${encodeURIComponent(select.value)}`);});
    wrap.appendChild(select);
    if(!actions.querySelector('[data-account-viewer]'))actions.insertBefore(wrap,userChip||null);
  }catch(error){console.error('Account switcher unavailable',error);}
}

function wireStaticUi(){
  buildAdminNavigation();
  wireFontSizer();
  wireSidebar();
  wireLogout();
}

async function startPortal(){
  wireStaticUi();
  const ctx=await getContext();
  if(!ctx)return;
  render(ctx);
  configureWorkspaceLink(ctx);
  if(ctx?.membership?.role_code==='platform_admin') addPlatformPortalSwitcher(ctx);
  buildAdminNavigation();
  markActiveNavigation();
  return ctx;
}

export const portalReady = new Promise((resolve)=>{
  const run=()=>{
    Promise.resolve(startPortal()).then(resolve).catch(error=>{
      console.error('Portal initialization failed',error);
      resolve(null);
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
});
