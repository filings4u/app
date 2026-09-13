import { supabase } from './supabase.js';
export const qs=s=>document.querySelector(s);export const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));export const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
export async function invokeEmployer(payload){const {data,error}=await supabase.functions.invoke((payload?.action==='list'||payload?.action==='detail')?'workforce-admin-employer-context':'workforce-admin-employers',{body:payload});if(error){let m=error.message||'Employer request failed.';try{const x=await error.context.clone().json();m=x.error||m}catch(_){}throw new Error(m)}if(data?.error)throw new Error(data.error);return data}
export function selectedEmployerId(){return new URLSearchParams(location.search).get('employer')||localStorage.getItem('s4u_admin_employer_id')||''}
export function setEmployer(id,name=''){if(id)localStorage.setItem('s4u_admin_employer_id',id);if(name)localStorage.setItem('s4u_admin_employer_name',name)}
export function employerLink(file,id=selectedEmployerId()){return id?`${file}?employer=${encodeURIComponent(id)}`:file}
export async function loadEmployerList(selectEl){const d=await invokeEmployer({action:'list'}),list=d.employers||[];if(selectEl){const cur=selectedEmployerId();selectEl.innerHTML='<option value="">Choose employer</option>'+list.map(e=>`<option value="${e.id}" ${e.id===cur?'selected':''}>${esc(e.legal_name)}</option>`).join('');selectEl.onchange=()=>{if(selectEl.value){setEmployer(selectEl.value,selectEl.options[selectEl.selectedIndex].textContent);location.href=employerLink(location.pathname.split('/').pop(),selectEl.value)}}}return list}
export async function loadEmployerContext(pageKey=''){const id=selectedEmployerId();if(!id)return {id:'',detail:null};const detail=await invokeEmployer({action:'detail',employer_id:id});setEmployer(id,detail.employer.legal_name);document.querySelectorAll('[data-employer-context]').forEach(el=>el.textContent=detail.employer.legal_name);document.querySelectorAll('[data-employer-page]').forEach(a=>{a.href=employerLink(a.getAttribute('href').split('?')[0],id);a.classList.toggle('active',a.dataset.employerPage===pageKey)});return {id,detail}}

export async function invokeEmployerAdmin(payload){
  const {data,error}=await supabase.functions.invoke((payload?.action==='list'||payload?.action==='detail')?'workforce-admin-employer-context':'workforce-admin-employers',{body:payload});
  if(error){let msg=error.message||'Employer Admin request failed.';try{const j=await error.context.clone().json();msg=j.error||msg}catch(_){}throw new Error(msg)}
  if(data?.error)throw new Error(data.error);return data
}
