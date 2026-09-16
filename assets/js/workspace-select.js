import{supabase,authScope,workspaceStorageKeyFor,createScopedClient,authStorageKeyFor}from'./supabase.js?v=20260916-auth-isolation-v4';
const list=document.querySelector('#workspaceList'),message=document.querySelector('#workspaceMessage');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=p=>p==='owner_operator'?'owner-operator':p;
const label=p=>({ctpa:'C/TPA Portal',employer:'Employer Portal',employee:'Employee / Driver Portal',owner_operator:'Owner-Operator Portal',admin:'Staff Administration'}[p]||p);
const requested=(new URLSearchParams(location.search).get('portal')||authScope||'customer').replaceAll('-','_');
const{data:{session}}=await supabase.auth.getSession();
async function migrate(targetScope){const target=String(targetScope||'').replaceAll('-','_');if(!session||target===authScope)return;const client=createScopedClient(target);const{error}=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});if(error)throw error;if(authScope==='customer')localStorage.removeItem(authStorageKeyFor('customer'));sessionStorage.setItem('s4u_auth_scope_tab',target)}
if(!session){location.replace((requested==='admin'?'workforce-staff.html':requested==='employer'?'employer-login.html':requested==='employee'?'employee-login.html':requested==='ctpa'?'ctpa-login.html':requested==='owner_operator'?'owner-operator-login.html':'workforce-logins.html')+'?next=workspace-select.html')}else{
 const{data,error}=await supabase.functions.invoke('workforce-session-context',{body:{requested_portal:requested}});
 if(error||!data){message.textContent=error?.message||'Unable to load your workspaces.';message.className='login-status error'}
 else{const ws=data.workspaces||[];
  if(!data.requires_workspace_selection&&data.portal){await migrate(data.portal);if(data.membership?.id)sessionStorage.setItem(workspaceStorageKeyFor(data.portal),data.membership.id);location.replace(`${route(data.portal)}/dashboard.html`)}
  else if(!ws.length){list.innerHTML='<div class="saas-empty">No active Workforce workspaces are available for this account.</div>'}
  else{list.innerHTML=ws.map(w=>`<article class="workspace-option"><div><strong>${esc(w.organization_name||label(w.portal))}</strong><small>${esc(label(w.portal))} • ${esc(w.role_name||w.role_code||'Account User')}${w.subscription?.plan_name?' • '+esc(w.subscription.plan_name):''}</small></div><button class="btn btn-orange" data-membership="${esc(w.membership_id)}" data-portal="${esc(w.portal)}">Open</button></article>`).join('');list.querySelectorAll('[data-membership]').forEach(b=>b.onclick=async()=>{try{const target=String(b.dataset.portal||'').replaceAll('-','_');await migrate(target);sessionStorage.setItem(workspaceStorageKeyFor(target),b.dataset.membership);location.href=`${route(target)}/dashboard.html`}catch(e){message.textContent=e?.message||'Unable to open this workspace.';message.className='login-status error'}})}
 }
}
