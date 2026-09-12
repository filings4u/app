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
  if(actual && expected!==actual){ location.replace(rootUrl(expected+'/dashboard.html')); return null; }
  return data;
}

function render(ctx){
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

function wireUi(){
  const sidebar=document.querySelector('.sidebar');
  const toggle=document.querySelector('[data-mobile-menu]');
  if(toggle&&sidebar) toggle.addEventListener('click',()=>sidebar.classList.toggle('open'));
  const actions=document.querySelector('.topbar-actions');
  if(actions && !actions.querySelector('[data-logout]')){
    const b=document.createElement('button'); b.className='btn btn-outline'; b.dataset.logout=''; b.textContent='Sign Out';
    b.addEventListener('click',async()=>{ await supabase.auth.signOut(); location.replace(rootUrl('login.html')); });
    actions.appendChild(b);
  }
}

document.addEventListener('DOMContentLoaded',async()=>{ wireUi(); const ctx=await getContext(); if(ctx) render(ctx); });
