import {supabase,authScope,workspaceStorageKey,workspaceStorageKeyFor,createScopedClient,authStorageKeyFor,loginPageForScope,clearPortalSessionState} from './supabase.js?v=20260916-auth-isolation-v4';
const form=document.querySelector('#resetForm');
const message=document.querySelector('#message');
const passwordInput=document.querySelector('#password');
const confirmInput=document.querySelector('#confirm');
form?.addEventListener('submit',async event=>{
  event.preventDefault();
  message.textContent='';
  const passwordValue=passwordInput?.value??'';
  const confirmValue=confirmInput?.value??'';
  if(passwordValue!==confirmValue){message.textContent='Passwords do not match.';return;}
  if(passwordValue.length<8){message.textContent='Password must be at least 8 characters.';return;}
  const {error}=await supabase.auth.updateUser({password:passwordValue});
  if(error){message.textContent=error.message;return;}
  message.textContent='Password updated. Redirecting to sign in…';
  await supabase.auth.signOut({scope:'local'});
  setTimeout(()=>location.replace(loginPageForScope(authScope)),900);
});
document.querySelectorAll('[data-eye]').forEach(button=>{
  button.addEventListener('click',()=>{
    const input=document.getElementById(button.dataset.eye);
    if(!input)return;
    const show=input.type==='password';
    input.type=show?'text':'password';
    button.textContent=show?'Hide':'Show';
    button.setAttribute('aria-label',show?'Hide password':'Show password');
  });
});
