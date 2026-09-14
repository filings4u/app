import{supabase}from'./supabase.js';
export const $=s=>document.querySelector(s);
export const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export async function poolApi(payload){const{data,error}=await supabase.functions.invoke('workforce-employer-pools',{body:payload});if(error){let m=error.message||'Pool request failed.';try{const x=await error.context.clone().json();m=x.error||m}catch(_){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data}
export const workspace=()=>poolApi({action:'workspace'});
export function msg(el,text,type=''){el.hidden=false;el.textContent=text;el.className='saas-notice '+type}
