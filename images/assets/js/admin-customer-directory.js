
import {supabase} from './supabase.js';
export const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
export async function orgApi(body){const{data,error}=await supabase.functions.invoke('workforce-admin-organizations',{body});if(error){let m=error.message||'Customer request failed.';try{const x=await error.context.clone().json();m=x.error||m}catch(_){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data}
export function setContext(type,id,name){const k=type==='owner_operator'?'owner':type;localStorage.setItem(`s4u_admin_${k}_id`,id);localStorage.setItem(`s4u_admin_${k}_name`,name)}
export function manageHref(type,o){if(type==='owner_operator')return `owner-profile.html?owner=${encodeURIComponent(o.owner_operators?.[0]?.id||'')}`;if(type==='ctpa')return `ctpa-profile.html?ctpa=${encodeURIComponent(o.ctpas?.[0]?.id||'')}`;return `employer-profile.html?employer=${encodeURIComponent(o.employers?.[0]?.id||'')}`}
export function entityId(type,o){return type==='owner_operator'?o.owner_operators?.[0]?.id:type==='ctpa'?o.ctpas?.[0]?.id:o.employers?.[0]?.id}
export async function plans(){return (await orgApi({action:'plans'})).plans||[]}
export function statusBadge(s){return `<span class="badge ${s==='active'?'success':'warning'}">${esc(s||'unknown')}</span>`}
