import { supabase } from './supabase.js';

const ROOT = new URL('../../', import.meta.url);
const rootUrl = (file='') => new URL(file, ROOT).href;

function currentPortal(){
  const parts=location.pathname.split('/').filter(Boolean);
  return ['admin','ctpa','employer','owner-operator'].find(x=>parts.includes(x)) || null;
}

export async function ensureCustomerOnboarding(ctx){
  const actual=currentPortal();
  if(!actual || actual==='admin' || ctx?.membership?.role_code==='platform_admin') return true;
  if(location.pathname.endsWith('/onboarding.html')) return true;

  const portal=actual==='owner-operator' ? 'owner_operator' : actual;
  const {data,error}=await supabase.functions.invoke('workforce-customer-onboarding',{
    body:{action:'status',portal}
  });

  if(error){
    console.error('Unable to verify onboarding status',error);
    location.replace(rootUrl(`${actual}/onboarding.html`));
    return false;
  }

  if(!data?.completed){
    location.replace(rootUrl(`${actual}/onboarding.html`));
    return false;
  }

  return true;
}
