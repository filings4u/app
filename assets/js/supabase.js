const CONFIG = window.S4U_SUPABASE_CONFIG;
if(!CONFIG?.url || !CONFIG?.publishableKey){
  throw new Error('Screenings4u Supabase configuration is missing. Load supabase-config.js before portal modules.');
}

const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');

const normalizeScope=(value='')=>String(value||'').trim().toLowerCase().replaceAll('-','_');
const knownScopes=new Set(['admin','employer','employee','ctpa','owner_operator','customer','public']);

function scopeFromLocation(){
  const bodyScope=normalizeScope(document.body?.dataset?.portal||'');
  if(knownScopes.has(bodyScope)) return bodyScope;

  const query=new URLSearchParams(location.search);
  const queryScope=normalizeScope(query.get('portal')||query.get('mode')||'');
  if(knownScopes.has(queryScope)) return queryScope;
  if(queryScope==='owner') return 'owner_operator';

  const parts=location.pathname.split('/').filter(Boolean).map(normalizeScope);
  if(parts.includes('admin')) return 'admin';
  if(parts.includes('employer')) return 'employer';
  if(parts.includes('employee')) return 'employee';
  if(parts.includes('ctpa')) return 'ctpa';
  if(parts.includes('owner_operator')) return 'owner_operator';

  const file=(location.pathname.split('/').pop()||'').toLowerCase();
  if(file==='workforce-staff.html') return 'admin';
  if(file==='employer-login.html') return 'employer';
  if(file==='employee-login.html') return 'employee';
  if(file==='ctpa-login.html') return 'ctpa';
  if(file==='owner-operator-login.html') return 'owner_operator';
  if(file==='owner-document.html') return 'admin';
  if(['invoice.html','checkout.html'].includes(file)) return 'public';
  if(file==='login.html') return 'customer';

  const tabScope=normalizeScope(sessionStorage.getItem('s4u_auth_scope_tab')||'');
  if(knownScopes.has(tabScope)) return tabScope;
  return 'customer';
}

export const authScope=scopeFromLocation();
if(authScope!=='public') sessionStorage.setItem('s4u_auth_scope_tab',authScope);

const projectRef=(()=>{try{return new URL(CONFIG.url).hostname.split('.')[0]||'workforce'}catch{return'workforce'}})();
export const authStorageKeyFor=(scope=authScope)=>`s4u-${projectRef}-auth-${normalizeScope(scope)||'customer'}`;
export const workspaceStorageKeyFor=(scope=authScope)=>`s4u_workspace_membership_${normalizeScope(scope)||'customer'}`;
export const authStorageKey=authStorageKeyFor(authScope);
export const workspaceStorageKey=workspaceStorageKeyFor(authScope);

export function loginPageForScope(scope=authScope){
  return ({admin:'workforce-staff.html',employer:'employer-login.html',employee:'employee-login.html',ctpa:'ctpa-login.html',owner_operator:'owner-operator-login.html'})[normalizeScope(scope)]||'workforce-logins.html';
}

export function createScopedClient(scope,{detectSessionInUrl=false}={}){
  const s=normalizeScope(scope)||'customer';
  return createClient(CONFIG.url,CONFIG.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl,storageKey:authStorageKeyFor(s)}});
}

export function clearPortalSessionState(scope=authScope){
  const s=normalizeScope(scope)||'customer';
  sessionStorage.removeItem(workspaceStorageKeyFor(s));
  sessionStorage.removeItem(`s4u_portal_context_${s}`);
  for(let i=sessionStorage.length-1;i>=0;i--){
    const k=sessionStorage.key(i)||'';
    if(k.startsWith(`s4u_portal_context_${s}_`) || k.startsWith(`s4u_platform_${s}_`)) sessionStorage.removeItem(k);
  }
}

const detectAuthCallback=/reset-password\.html$/i.test(location.pathname) || /(?:#|[?&])(access_token|refresh_token|code)=/i.test(location.href);
const supabase=createScopedClient(authScope,{detectSessionInUrl:detectAuthCallback});
export {supabase};
