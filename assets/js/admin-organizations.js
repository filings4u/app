import { supabase } from './supabase.js';
let organizations=[];
let plans=[];
const $=s=>document.querySelector(s);
const modal=$('#organizationCreateSection'), form=$('#organizationForm'), body=$('#organizationsBody');

function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function labelType(t){return t==='ctpa'?'C/TPA':t==='owner_operator'?'Owner-Operator':'Employer';}
function fmtDate(v){if(!v)return '—';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(v));}
function badge(status){const active=status==='active';return `<span class="badge ${active?'success':'warning'}">${esc(status||'unknown')}</span>`;}
function subscription(o){const s=o.subscription;if(!s)return '<span class="badge warning">No plan</span>'; const p=s.plans;return `<div class="org-name"><strong>${esc(p?.name||'Plan')}</strong><span>${esc(s.status||'')}</span></div>`;}
function render(){
 const q=$('#organizationSearch').value.trim().toLowerCase(), type=$('#organizationType').value, status=$('#organizationStatus').value;
 const rows=organizations.filter(o=>(!q||[o.legal_name,o.dba_name,o.email,o.phone].some(v=>String(v||'').toLowerCase().includes(q)))&&(!type||(type==='owner_operator'?o.account_class==='owner_operator':(o.organization_type===type&&o.account_class!=='owner_operator')))&&(!status||o.status===status));
 $('#organizationCount').textContent=`${rows.length} of ${organizations.length} organizations`;
 body.innerHTML=rows.length?rows.map(o=>`<tr>
 <td><div class="org-name"><strong>${esc(o.legal_name)}</strong><span>${esc(o.dba_name||o.employers?.[0]?.dot_number||'Workforce Compliance account')}</span></div></td>
 <td><span class="org-type">${labelType(o.account_class||o.organization_type)}</span></td>
 <td>${subscription(o)}</td>
 <td><div class="org-contact"><span>${esc(o.email||o.ctpas?.[0]?.support_email||'—')}</span><span>${esc(o.phone||'')}</span></div></td>
 <td>${badge(o.status)}</td><td>${fmtDate(o.created_at)}</td>
 <td><div class="org-actions"><button class="org-action" data-status-id="${o.id}" data-next-status="${o.status==='active'?'inactive':'active'}">${o.status==='active'?'Deactivate':'Reactivate'}</button></div></td>
 </tr>`).join(''):`<tr><td colspan="7"><div class="org-empty">No organizations match these filters.</div></td></tr>`;
 body.querySelectorAll('[data-status-id]').forEach(b=>b.addEventListener('click',()=>changeStatus(b.dataset.statusId,b.dataset.nextStatus)));
}
function metrics(){
 $('#orgTotal').textContent=organizations.length;
 $('#orgEmployers').textContent=organizations.filter(o=>o.organization_type==='employer'&&o.account_class!=='owner_operator').length;
 $('#orgCtpas').textContent=organizations.filter(o=>o.organization_type==='ctpa').length;
 $('#orgOwners').textContent=organizations.filter(o=>o.account_class==='owner_operator').length;
 $('#orgActive').textContent=organizations.filter(o=>o.status==='active').length;
}
async function invoke(payload){
 const {data,error}=await supabase.functions.invoke('workforce-admin-organizations',{body:payload});
 if(error){
   let detail=error.message||'Organization request failed.';
   try{if(error.context){const response=error.context;const parsed=await response.clone().json();if(parsed?.error)detail=parsed.error;}}catch(_){}
   throw new Error(detail);
 }
 if(data?.error)throw new Error(data.error);
 return data;
}

function planAudienceForType(type){return type==='owner_operator'?'owner_operator':type;}
function updateTypeFields(){
 const type=form.querySelector('[name=organization_type]').value;
 document.querySelectorAll('.owner-dot-fields').forEach(x=>x.style.display=type==='owner_operator'?'grid':'none');
 document.querySelectorAll('.employer-state').forEach(x=>x.style.display=['employer','owner_operator'].includes(type)?'grid':'none');
 const dot=form.querySelector('[name=dot_number]'); if(dot)dot.required=type==='owner_operator';
 const plan=$('#organizationPlan'), audience=planAudienceForType(type);
 const available=plans.filter(p=>p.audience===audience);
 plan.innerHTML='<option value="">Select plan</option>'+available.map(p=>`<option value="${p.id}">${esc(p.name)} — $${Number(p.monthly_price||0).toFixed(2)}/month</option>`).join('');
}
async function loadPlans(){
 const data=await invoke({action:'plans'});plans=data.plans||[];updateTypeFields();
}

async function load(){
 try{body.innerHTML='<tr><td colspan="7"><div class="org-empty">Loading organizations…</div></td></tr>';const data=await invoke({action:'list'});organizations=data.organizations||[];metrics();render();}
 catch(e){console.error(e);body.innerHTML=`<tr><td colspan="7"><div class="org-empty">Could not load organizations. ${esc(e.message||'')}</div></td></tr>`;}
}
function openModal(){updateTypeFields();modal.style.display='block';form.querySelector('[name=legal_name]').focus();modal.scrollIntoView({behavior:'smooth'});}
function closeModal(){modal.style.display='none';form.reset();updateTypeFields();$('#organizationFormMessage').textContent='';}
$('#newOrganizationBtn').addEventListener('click',openModal);
document.querySelectorAll('[data-close-org-modal]').forEach(x=>x.addEventListener('click',closeModal));
form.querySelector('[name=organization_type]').addEventListener('change',updateTypeFields);
['#organizationSearch','#organizationType','#organizationStatus'].forEach(s=>$(s).addEventListener(s.includes('Search')?'input':'change',render));
form.addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('#createOrganizationBtn'),msg=$('#organizationFormMessage');btn.disabled=true;btn.textContent='Creating…';msg.textContent='';
 try{const payload=Object.fromEntries(new FormData(form));await invoke({action:'create',...payload});msg.className='org-form-message success';msg.textContent='Organization created.';await load();setTimeout(closeModal,500);}
 catch(err){console.error(err);msg.className='org-form-message';msg.textContent=err.message||'Organization could not be created.';}
 finally{btn.disabled=false;btn.textContent='Create Organization';}
});
async function changeStatus(id,status){
 const rowBtn=body.querySelector(`[data-status-id="${id}"]`); if(rowBtn){rowBtn.disabled=true;rowBtn.textContent='Saving…';}
 try{await invoke({action:'status',organization_id:id,status});await load();}
 catch(e){console.error(e);$('#organizationCount').textContent=`Update failed: ${e.message||'Could not update organization.'}`;if(rowBtn)rowBtn.disabled=false;}
}
loadPlans().then(load).catch(e=>{console.error(e);load();});
