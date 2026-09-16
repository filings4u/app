import { supabase } from './supabase.js';
import { portalReady } from './portal.js';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=v=>String(v??'—').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const fmt=v=>v?new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(v)):'—';
const fmtDT=v=>v?new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)):'—';
const money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD'}).format(Number(v||0));
const file=(location.pathname.split('/').pop()||'').toLowerCase();
let employerId=new URLSearchParams(location.search).get('employer_id')||sessionStorage.getItem('s4u_admin_employer_id')||'';
let directory=[];
let detail=null;

async function invoke(name,body={}){
  const {data,error}=await supabase.functions.invoke(name,{body});
  if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m||'Request failed.');}
  if(data?.error)throw new Error(data.error);
  return data;
}
const contextApi=body=>invoke('workforce-admin-employer-context',body);
const actionApi=body=>invoke('workforce-admin-employer-actions',body);
const profileApi=body=>invoke('workforce-admin-employer-profile',body);
const configApi=body=>invoke('workforce-admin-employer-config-actions',body);
const accessApi=body=>invoke('workforce-admin-employer-access-actions',body);
const testApi=body=>invoke('workforce-admin-testing-actions',body);
const poolApi=body=>invoke('workforce-admin-random-pool-management',body);
const selectionApi=body=>invoke('workforce-admin-employer-selections',body);
const resultApi=body=>invoke('workforce-admin-employer-results',body);
const complianceApi=body=>invoke('workforce-admin-employer-compliance',body);
const complianceSyncApi=body=>invoke('workforce-admin-employer-compliance-sync',body);
const documentApi=body=>invoke('workforce-admin-employer-documents',body);
const notificationApi=body=>invoke('workforce-admin-employer-notifications',body);
const reportingApi=body=>invoke('workforce-admin-employer-reporting',body);
const selectionDeliveryApi=body=>invoke('workforce-admin-employer-selection-delivery',body);
const pdfApi=body=>invoke('workforce-pdf-export',body);
const postAccidentApi=body=>invoke('workforce-admin-post-accident',body);
function downloadBase64File(base64,name,type='application/pdf'){const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name||'download.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
const employerManagementApi=body=>invoke('workforce-employer-management',{...body,employer_id:employerId});

function status(message,type=''){
  const el=$('#pageStatus')||$('#profileStatus')||$('#subscriptionMessage');
  if(!el)return; el.textContent=message||''; el.className='inline-status'+(type?` ${type}`:'');
}
function td(v){return `<td>${v??'—'}</td>`}
function table(headers,rows,empty='No records found.'){
  return `<div class="management-table-wrap"><table class="management-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}"><div class="management-empty">${esc(empty)}</div></td></tr>`}</tbody></table></div>`;
}
function button(label,attrs=''){return `<button class="btn btn-outline" type="button" ${attrs}>${esc(label)}</button>`}
function fillForm(form,data){if(!form||!data)return;for(const [k,v] of Object.entries(data)){const el=form.elements.namedItem(k);if(!el||v==null)continue;if(el.type==='checkbox')el.checked=!!v;else el.value=v;}}
function formData(form){const o=Object.fromEntries(new FormData(form));$$('input[type=checkbox]',form).forEach(x=>o[x.name]=x.checked);return o;}
function employeeName(x){return [x?.last_name,x?.first_name].filter(Boolean).join(', ')||'—';}
function setContext(){
  const e=detail?.employer;
  $('#contextEmployerName') && ($('#contextEmployerName').textContent=e?.legal_name||'Choose an employer');
  $('#contextEmployerMeta') && ($('#contextEmployerMeta').textContent=e?`${e.dot_number?'USDOT '+e.dot_number+' · ':''}${e.state||'No state'} · ${pretty(e.status)}`:'Employer management context');
}
async function loadDirectory(){
  const d=await contextApi({action:'list'}); directory=d.employers||[];
  const sel=$('#employerSelector'); if(!sel)return;
  sel.replaceChildren(); const p=document.createElement('option');p.value='';p.textContent='Choose an employer';sel.append(p);
  directory.forEach(e=>{const o=document.createElement('option');o.value=e.id;o.dataset.label=e.legal_name;o.textContent=e.workforce_display_name||`${e.legal_name}${e.workforce_classification?` · ${String(e.workforce_classification).replace('_','-')}`:''}`;o.selected=e.id===employerId;sel.append(o)});
  const actions=sel.closest('.management-context-actions');if(actions&&!actions.querySelector('.context-search-input')){const input=document.createElement('input');input.type='search';input.className='context-search-input';input.placeholder='Search employers';actions.insertBefore(input,sel);input.addEventListener('input',()=>{const q=input.value.trim().toLowerCase();[...sel.options].forEach((o,i)=>{if(i===0)return;o.hidden=!!q&&!o.textContent.toLowerCase().includes(q)});if(q){const match=[...sel.options].find((o,i)=>i>0&&!o.hidden);if(match)sel.value=match.value}})}
  sel.onchange=()=>{if(!sel.value)return;employerId=sel.value;sessionStorage.setItem('s4u_admin_employer_id',employerId);const u=new URL(location.href);u.searchParams.set('employer_id',employerId);history.pushState({},'',u);loadDetail().then(()=>renderCurrent()).catch(e=>status(e.message,'error'));};
  if(!employerId&&directory.length===1){employerId=directory[0].id;sessionStorage.setItem('s4u_admin_employer_id',employerId);sel.value=employerId;}
}
async function loadDetail(){if(!employerId)return null;detail=await contextApi({action:'detail',employer_id:employerId});setContext();return detail;}
function requireEmployer(){const root=$('#managementContent');if(root&&!employerId)root.innerHTML='<div class="management-empty">Choose an employer above to load this Admin workspace.</div>';return !!employerId;}

function renderProfile(){fillForm($('#profileForm'),detail.employer);const f=$('#profileForm');if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();try{status('Saving employer profile…');const r=await profileApi({action:'update',employer_id:employerId,profile:formData(f)});detail.employer=r.employer;fillForm(f,r.employer);setContext();status('Employer profile saved.','success')}catch(e){status(e.message,'error')}};}

function renderSubscription(){
 const s=detail.subscription||{},p=s.plans||{},e=detail.employer||{};
 $('#subscriptionSummary')&&($('#subscriptionSummary').innerHTML=`<div class="subscription-summary-grid"><article class="subscription-summary-card"><span>Current Plan</span><strong>${esc(p.name||'No plan')}</strong><small>${money(p.monthly_price||0)}/month</small></article><article class="subscription-summary-card"><span>Status</span><strong>${esc(pretty(s.status||'No subscription'))}</strong><small>${esc(s.source||'—')}</small></article><article class="subscription-summary-card"><span>Renewal</span><strong>${esc(fmt(s.renewal_date||s.stripe_current_period_end))}</strong><small>${s.cancel_at_period_end?'Cancels at period end':'Recurring'}</small></article><article class="subscription-summary-card"><span>Employee Limit</span><strong>${esc(String(s.employee_limit??p.employee_limit??'Unlimited'))}</strong><small>Current subscription allowance</small></article><article class="subscription-summary-card"><span>Classification</span><strong>${esc(String(e.workforce_classification||'NON_DOT').replace('_','-'))}</strong><small>${esc(e.dot_number?`USDOT ${e.dot_number}`:'No USDOT')}</small></article></div>`);
 const ps=$('#planSelect');if(ps){ps.replaceChildren();(detail.plans||[]).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=`${x.name} — ${money(x.monthly_price)}`;o.selected=x.id===s.plan_id;ps.append(o)})}
 const ss=$('#subscriptionStatus');if(ss){ss.innerHTML=['trial','trialing','active','past_due','cancelled'].map(v=>`<option value="${v}" ${v===String(s.status||'active')?'selected':''}>${esc(pretty(v))}</option>`).join('')}
 const pf=new Map((detail.plan_features||[]).map(x=>[x.feature_id,x])),ov=new Map((detail.overrides||[]).map(x=>[x.feature_id,x])),ent=$('#entitlements');
 if(ent)ent.innerHTML=(detail.features||[]).filter(x=>x.employer_available!==false).map(f=>{const plan=pf.get(f.id),over=ov.get(f.id),enabled=over?!!over.enabled:!!plan?.enabled;return `<div class="feature-row"><div><strong>${esc(f.name||f.code)}</strong><span>${esc(f.code)} · ${over?'Admin override':'Plan'}</span></div><span class="badge ${enabled?'success':'neutral'}">${enabled?'Enabled':'Disabled'}</span></div>`}).join('')||'<div class="management-empty">No Employer features are configured.</div>';
 const area=$('#changePlanBtn')?.parentElement;if(area&&!$('#saveSubscriptionStatusBtn'))area.insertAdjacentHTML('beforeend','<button id="saveSubscriptionStatusBtn" class="btn btn-outline" type="button">Save Subscription Status</button>');
 $('#changePlanBtn')?.addEventListener('click',async()=>{try{await actionApi({action:'change_plan',employer_id:employerId,plan_id:ps.value});status('Plan assignment updated.','success');await refresh()}catch(e){status(e.message,'error')}});
 $('#saveSubscriptionStatusBtn')?.addEventListener('click',async()=>{try{await actionApi({action:'save_subscription_status',employer_id:employerId,status:$('#subscriptionStatus').value});status('Subscription status updated.','success');await refresh()}catch(e){status(e.message,'error')}});
}
function editor(title,fields,saveLabel='Save'){
  return `<section class="admin-inline-editor"><h3>${esc(title)}</h3><form data-admin-editor><div class="management-form-grid">${fields.map(f=>`<label><span>${esc(f.label)}</span>${f.type==='select'?`<select name="${f.name}">${f.options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`:`<input name="${f.name}" type="${f.type||'text'}" ${f.required?'required':''}>`}</label>`).join('')}</div><div class="management-actions"><button class="btn btn-orange">${esc(saveLabel)}</button></div></form></section>`;
}
function renderEmployees(){
  const root=$('#managementContent');
  const employees=detail.employees||[];
  root.innerHTML=`
    <section class="admin-inline-editor employee-admin-editor">
      <div class="ctpa-editor-head">
        <div><h3 id="employeeEditorTitle">Add Employee / Driver</h3><p>Admin changes write directly to the Employer workforce record used by the Employer and Employee portals.</p></div>
      </div>
      <form class="saas-form" id="employeeAdminForm">
        <input type="hidden" name="id">
        <div class="saas-form-grid">
          <label><span>First Name *</span><input name="first_name" required></label>
          <label><span>Last Name *</span><input name="last_name" required></label>
          <label><span>Employee Number</span><input name="employee_number"></label>
          <label><span>Email</span><input name="email" type="email"></label>
          <label><span>Mobile</span><input name="mobile"></label>
          <label><span>Job Title</span><input name="job_title"></label>
          <label><span>Hire Date</span><input name="hire_date" type="date"></label>
          <label><span>DOT Agency</span><select name="dot_agency"><option value="">None</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></label>
          <label><span>CDL Number</span><input name="cdl_number"></label>
          <label><span>CDL State</span><input name="cdl_state"></label>
          <label><span>Employment Status</span><select name="employment_status">${['invited','pending_enrollment','active','suspended','leave','inactive','terminated','compliance_hold'].map(v=>`<option value="${v}">${esc(pretty(v))}</option>`).join('')}</select></label>
          <label class="config-choice"><span>DOT Covered</span><input name="dot_covered" type="checkbox"></label>
          <label class="config-choice"><span>Safety Sensitive</span><input name="safety_sensitive" type="checkbox"></label>
        </div>
        <div class="saas-actions"><button class="btn btn-outline" id="clearEmployeeEditor" type="button">Clear</button><button class="btn btn-orange" type="submit">Save Employee</button></div>
      </form>
    </section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Employees & Employee Portal Access</h2><span>Manage workforce records and the Employee / Driver Portal login from one place.</span></div></div><div class="card-body" id="employeeAccessWorkspace">
      <div class="management-empty">Loading Employee Portal access…</div>
    </div></section>`;
  const form=root.querySelector('#employeeAdminForm');
  const clear=()=>{form.reset();form.elements.id.value='';root.querySelector('#employeeEditorTitle').textContent='Add Employee / Driver';};
  root.querySelector('#clearEmployeeEditor').onclick=clear;
  form.onsubmit=async ev=>{ev.preventDefault();try{const x=formData(form);x.dot_covered=form.elements.dot_covered.checked;x.safety_sensitive=form.elements.safety_sensitive.checked;await actionApi({action:'save_employee',employer_id:employerId,employee:x});status(x.id?'Employee updated.':'Employee added.','success');clear();await refresh()}catch(e){status(e.message,'error')}};

  const renderAccess=async()=>{
    const box=root.querySelector('#employeeAccessWorkspace');
    try{
      const data=await accessApi({action:'employee_access_list',employer_id:employerId});
      const rows=data.employees||[];
      box.innerHTML=table(['Employee','Employee #','Email','Employment','Portal Access','Last Sign In','Actions'],rows.map(e=>{
        const a=e.portal_access||{},state=a.status||'none';
        const linked=!!a.linked;
        const buttons=[];
        if(!linked)buttons.push(`<button class="org-action" type="button" data-employee-invite="${esc(e.id)}" ${!e.email?'disabled title="Add an employee email first"':''}>Enable Portal</button>`);
        else if(state==='active')buttons.push(`<button class="org-action" type="button" data-employee-access="${esc(e.id)}" data-state="suspended">Suspend</button>`);
        else buttons.push(`<button class="org-action" type="button" data-employee-access="${esc(e.id)}" data-state="active">Activate</button>`);
        if(linked && state!=='revoked')buttons.push(`<button class="org-action danger" type="button" data-employee-access="${esc(e.id)}" data-state="revoked">Revoke</button>`);
        return `<tr>
          <td><strong>${esc(employeeName(e))}</strong><small style="display:block;color:var(--muted)">${esc(e.job_title||'')}</small></td>
          <td>${esc(e.employee_number||'—')}</td><td>${esc(e.email||a.email||'—')}</td><td>${esc(pretty(e.employment_status))}</td>
          <td><span class="ctpa-status-pill ${state==='active'?'is-good':state==='suspended'?'is-warn':state==='revoked'?'is-danger':'is-info'}">${esc(linked?pretty(state):'Not Enabled')}</span></td>
          <td>${esc(fmtDT(a.last_sign_in_at))}</td><td><div class="management-actions"><button class="org-action" type="button" data-edit-employee="${esc(e.id)}">Edit</button>${buttons.join(' ')}</div></td>
        </tr>`}).join(''),'No employees or drivers.');
      box.querySelectorAll('[data-edit-employee]').forEach(btn=>btn.onclick=()=>{const e=rows.find(x=>x.id===btn.dataset.editEmployee);if(!e)return;fillForm(form,e);form.elements.dot_covered.checked=!!e.dot_covered;form.elements.safety_sensitive.checked=!!e.safety_sensitive;root.querySelector('#employeeEditorTitle').textContent=`Edit ${employeeName(e)}`;window.scrollTo({top:root.offsetTop-90,behavior:'smooth'});});
      box.querySelectorAll('[data-employee-invite]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;status('Creating Employee Portal access…');const r=await accessApi({action:'invite_employee',employer_id:employerId,employee_id:btn.dataset.employeeInvite});status(r.invited?'Employee Portal invitation sent.':'Existing login linked to the Employee Portal.','success');await renderAccess()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
      box.querySelectorAll('[data-employee-access]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;await accessApi({action:'set_employee_access',employer_id:employerId,employee_id:btn.dataset.employeeAccess,status:btn.dataset.state});status(`Employee Portal access ${btn.dataset.state}.`,'success');await renderAccess()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
      box.querySelectorAll('tr').forEach((row,i)=>{if(i===0)return;});
      box.querySelectorAll('tbody tr').forEach((row,i)=>{const e=rows[i];if(!e)return;const first=row.querySelector('td');first?.addEventListener('dblclick',()=>{fillForm(form,e);root.querySelector('#employeeEditorTitle').textContent=`Edit ${employeeName(e)}`;window.scrollTo({top:root.offsetTop-90,behavior:'smooth'});});});
    }catch(e){box.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')}
  };
  renderAccess();
}

function renderLocations(){
 const root=$('#managementContent'),rows=detail.locations||[];
 root.innerHTML=`<section class="admin-inline-editor"><div class="management-section-head"><div><h3 id="locationEditorTitle">Add Location / Terminal</h3><p>Changes write to the Employer location records used by employees and testing.</p></div></div><form id="adminLocationForm" class="saas-form"><input type="hidden" name="id"><div class="saas-form-grid"><label><span>Name *</span><input name="name" required></label><label><span>Type</span><select name="location_type">${['worksite','terminal','division','department','office'].map(v=>`<option value="${v}">${esc(pretty(v))}</option>`).join('')}</select></label><label><span>Status</span><select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label><span>Address 1</span><input name="address_line1"></label><label><span>Address 2</span><input name="address_line2"></label><label><span>City</span><input name="city"></label><label><span>State</span><input name="state"></label><label><span>Postal Code</span><input name="postal_code"></label><label><span>Phone</span><input name="phone"></label><label><span>Timezone</span><input name="timezone"></label><label class="config-choice"><span>Primary</span><input name="is_primary" type="checkbox"></label></div><div class="saas-actions"><button class="btn btn-outline" id="clearAdminLocation" type="button">Clear</button><button class="btn btn-orange">Save Location</button></div></form></section>${table(['Location','Type','City / State','Primary','Status','Action'],rows.map(x=>`<tr><td><strong>${esc(x.name)}</strong><br><small>${esc(x.address_line1||'')}</small></td><td>${esc(pretty(x.location_type))}</td><td>${esc([x.city,x.state].filter(Boolean).join(', ')||'—')}</td><td>${x.is_primary?'Yes':'No'}</td><td>${esc(pretty(x.status))}</td><td><button class="org-action" data-edit-location="${esc(x.id)}" type="button">Edit</button></td></tr>`).join(''),'No locations configured.')}`;
 const f=root.querySelector('#adminLocationForm'),clear=()=>{f.reset();f.elements.id.value='';root.querySelector('#locationEditorTitle').textContent='Add Location / Terminal'};
 root.querySelector('#clearAdminLocation').onclick=clear;
 root.querySelectorAll('[data-edit-location]').forEach(btn=>btn.onclick=()=>{const x=rows.find(r=>r.id===btn.dataset.editLocation);clear();fillForm(f,x);f.elements.is_primary.checked=!!x.is_primary;root.querySelector('#locationEditorTitle').textContent=`Edit ${x.name}`;f.scrollIntoView({behavior:'smooth',block:'center'})});
 f.onsubmit=async ev=>{ev.preventDefault();try{const x=formData(f);x.is_primary=f.elements.is_primary.checked;await actionApi({action:'save_location',employer_id:employerId,location:x});status(x.id?'Location updated.':'Location added.','success');await refresh()}catch(e){status(e.message,'error')}};
}
function renderPrograms(type){
  const root=$('#managementContent');
  const programs=(detail.programs||[]).filter(x=>!type||x.program_type===type);
  const employees=detail.employees||[];
  const title=type==='DOT'?'DOT Program Management':'Non-DOT Program Management';
  root.innerHTML=`<section class="admin-inline-editor"><div class="ctpa-editor-head"><div><h3 id="programEditorTitle">${title}</h3><p>Create or edit the same program records visible in the Employer portal.</p></div></div>
    <form class="saas-form" id="programAdminForm"><input type="hidden" name="id"><div class="saas-form-grid">
      <label><span>Program Name *</span><input name="name" required></label>
      ${type==='DOT'?`<label><span>DOT Agency *</span><select name="dot_agency" required><option value="">Choose agency</option>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></label>`:''}
      <label><span>Regulatory Authority</span><input name="regulatory_authority"></label>
      <label><span>Testing Panel</span><input name="testing_panel"></label><label><span>Testing Method</span><input name="testing_method"></label>
      <label><span>Testing Frequency</span><input name="testing_frequency"></label><label><span>Effective Date *</span><input name="effective_date" type="date" required></label>
      <label><span>Status</span><select name="status">${['draft','active','suspended','inactive','archived'].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}</select></label>
    </div><div class="saas-actions"><button class="btn btn-outline" id="clearProgramEditor" type="button">Clear</button><button class="btn btn-orange" type="submit">Save Program</button></div></form></section>
    ${table(['Program','Type','Agency','Panel','Effective','Status','Action'],programs.map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(x.program_type)}</td><td>${esc(x.dot_agency||'—')}</td><td>${esc(x.testing_panel||'—')}</td><td>${esc(fmt(x.effective_date))}</td><td>${esc(pretty(x.status))}</td><td><button class="org-action" data-edit-program="${esc(x.id)}" type="button">Edit</button></td></tr>`).join(''),'No programs configured.')}
    <section class="admin-inline-editor" style="margin-top:18px"><div class="ctpa-editor-head"><div><h3>Employee Program Enrollment</h3><p>Assign employees to this Employer's programs. These assignments are immediately visible in the Employer and Employee portals.</p></div></div>
      <form class="saas-form" id="programEnrollmentAdminForm"><input type="hidden" name="id"><div class="saas-form-grid"><label><span>Employee *</span><select name="employee_id" required><option value="">Choose employee</option>${employees.map(e=>`<option value="${esc(e.id)}">${esc(employeeName(e))}</option>`).join('')}</select></label><label><span>Program *</span><select name="program_id" required><option value="">Choose program</option>${(detail.programs||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)} — ${esc(pretty(p.program_type))}</option>`).join('')}</select></label><label><span>Effective Date *</span><input name="effective_date" type="date" required></label><label><span>End Date</span><input name="end_date" type="date"></label><label><span>Status</span><select name="status">${['pending','active','suspended','ended'].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}</select></label></div><div class="saas-actions"><button class="btn btn-orange" type="submit">Save Enrollment</button></div></form>
      <div id="adminEnrollmentRows" style="margin-top:16px"><div class="management-empty">Loading program enrollments…</div></div>
    </section>`;
  const pf=root.querySelector('#programAdminForm');
  const clear=()=>{pf.reset();pf.elements.id.value='';root.querySelector('#programEditorTitle').textContent=title;};root.querySelector('#clearProgramEditor').onclick=clear;
  root.querySelectorAll('[data-edit-program]').forEach(btn=>btn.onclick=()=>{const p=programs.find(x=>x.id===btn.dataset.editProgram);if(!p)return;fillForm(pf,p);root.querySelector('#programEditorTitle').textContent=`Edit ${p.name}`;window.scrollTo({top:root.offsetTop-90,behavior:'smooth'});});
  pf.onsubmit=async ev=>{ev.preventDefault();try{const x=formData(pf);x.program_type=type;await actionApi({action:'save_program',employer_id:employerId,program:x});status(x.id?'Program updated.':'Program added.','success');clear();await refresh()}catch(e){status(e.message,'error')}};
  const loadEnrollments=async()=>{const wrap=root.querySelector('#adminEnrollmentRows');try{const d=await employerManagementApi({action:'employee_programs'});const rows=d.employee_programs||[];wrap.innerHTML=table(['Employee','Program','Type','Effective','End','Status','Action'],rows.map(v=>`<tr><td>${esc(employeeName(v.employees))}</td><td><strong>${esc(v.programs?.name||'—')}</strong></td><td>${esc(pretty(v.programs?.program_type))}</td><td>${esc(fmt(v.effective_date))}</td><td>${esc(fmt(v.end_date))}</td><td>${esc(pretty(v.status))}</td><td><button class="org-action" data-edit-enrollment="${esc(v.id)}" type="button">Edit</button></td></tr>`).join(''),'No program enrollments.');wrap.querySelectorAll('[data-edit-enrollment]').forEach(btn=>btn.onclick=()=>{const v=rows.find(x=>x.id===btn.dataset.editEnrollment);if(!v)return;fillForm(root.querySelector('#programEnrollmentAdminForm'),v);});}catch(e){wrap.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`}};
  root.querySelector('#programEnrollmentAdminForm').onsubmit=async ev=>{ev.preventDefault();try{const enrollment=formData(ev.currentTarget);await employerManagementApi({action:'save_employee_program',enrollment});status(enrollment.id?'Program enrollment updated.':'Employee enrolled in program.','success');ev.currentTarget.reset();ev.currentTarget.elements.id.value='';await loadEnrollments()}catch(e){status(e.message,'error')}};
  loadEnrollments();
}

function renderTesting(){
  const root=$('#managementContent');
  root.innerHTML='<div class="management-empty">Loading Employer testing orders…</div>';

  const load=async()=>{
    const d=await testApi({action:'workspace',employer_id:employerId});
    const orders=d.orders||[],employees=d.employees||[],programs=d.programs||[],enrollments=d.employee_programs||[],sites=(d.sites||[]).map(x=>({...x,...(x.collection_sites||{})})),results=d.results||[];
    const resultMap=new Map(results.map(x=>[x.testing_order_id,x]));
    const activeOrders=orders.filter(x=>!['closed','cancelled','refused','no_show','unable_to_collect','invalid_specimen'].includes(x.status));
    const randomOrders=orders.filter(x=>x.selection_member_id);
    const awaitingCollection=orders.filter(x=>['assigned','employee_notified','scheduled','at_collection'].includes(x.status));
    const awaitingResult=orders.filter(x=>['collected','laboratory','mro_review'].includes(x.status));

    root.innerHTML=`
      <div class="management-stat-grid" style="margin-bottom:18px">
        <div class="management-stat"><strong>${orders.length}</strong><span>Total Orders</span></div>
        <div class="management-stat"><strong>${activeOrders.length}</strong><span>Open Orders</span></div>
        <div class="management-stat"><strong>${awaitingCollection.length}</strong><span>Awaiting Collection</span></div>
        <div class="management-stat"><strong>${awaitingResult.length}</strong><span>Awaiting Result</span></div>
      </div>

      <section class="admin-inline-editor">
        <div class="management-section-head">
          <div>
            <h3 id="adminTestingEditorTitle">Create Testing Order</h3>
            <p>Create non-random orders here. Random testing orders are generated from locked Random Selection events so the audit chain remains intact.</p>
          </div>
          <button class="btn btn-outline" type="button" id="clearAdminTestingOrder">New Order</button>
        </div>
        <form class="saas-form" id="adminTestingOrderForm">
          <input type="hidden" name="id">
          <div class="saas-form-grid">
            <label><span>Employee / Driver *</span><select name="employee_id" required><option value="">Choose employee / driver</option>${employees.map(x=>`<option value="${esc(x.id)}">${esc(employeeName(x))}${x.employee_number?` · ${esc(x.employee_number)}`:''}</option>`).join('')}</select></label>
            <label><span>Program *</span><select name="program_id" required><option value="">Choose program</option>${programs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(pretty(x.program_type))}${x.dot_agency?` · ${esc(x.dot_agency)}`:''}</option>`).join('')}</select></label>
            <label><span>Reason *</span><select name="reason" required>
              <option value="pre_employment">Pre-Employment</option>
              <option value="reasonable_suspicion">Reasonable Suspicion</option>
              <option value="post_accident">Post-Accident</option>
              <option value="return_to_duty">Return-to-Duty</option>
              <option value="follow_up">Follow-Up</option>
              <option value="other">Other</option>
            </select></label>
            <label><span>Test Type *</span><select name="test_type" required>
              <option value="drug">Drug</option>
              <option value="alcohol">Alcohol</option>
              <option value="drug_and_alcohol">Drug + Alcohol</option>
            </select></label>
            <label><span>Collection Site</span><select name="collection_site_id"><option value="">Not assigned</option>${sites.map(x=>`<option value="${esc(x.id||x.collection_site_id)}">${esc(x.name||'Collection Site')} · ${esc([x.city,x.state].filter(Boolean).join(', ')||'—')}</option>`).join('')}</select></label>
            <label><span>Collection Deadline</span><input name="collection_deadline" type="datetime-local"></label>
            <label><span>Testing Panel</span><input name="testing_panel" placeholder="Uses program default when blank"></label>
            <label><span>Collection Type</span><select name="collection_type"><option value="">Program default</option><option value="urine">Urine</option><option value="oral_fluid">Oral Fluid</option></select></label>
          </div>
          <div id="adminTestingValidation" class="saas-notice" style="margin-top:12px">Choose an employee and program. The employee must be assigned to that program.</div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Save Testing Order</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head">
          <div><h2>Testing Order Lifecycle</h2><span>${randomOrders.length} order(s) originated from Random Selections.</span></div>
        </div>
        <div class="card-body">
          ${table(['Order','Employee / Driver','Program','Reason','Test','Site','Deadline','Status','Result','Actions'],orders.map(o=>{
            const r=resultMap.get(o.id);
            return `<tr>
              <td><strong>${esc(o.order_number)}</strong>${o.selection_member_id?'<br><small>Random Selection</small>':''}</td>
              <td>${esc(employeeName(o.employees))}<br><small>${esc(o.employees?.employee_number||'')}</small></td>
              <td>${esc(o.programs?.name||'—')}<br><small>${esc(pretty(o.program_type))}${o.programs?.dot_agency?` · ${esc(o.programs.dot_agency)}`:''}</small></td>
              <td>${esc(pretty(o.reason))}</td>
              <td>${esc(pretty(o.test_type))}</td>
              <td>${esc(o.collection_sites?.name||'—')}</td>
              <td>${esc(fmtDT(o.collection_deadline))}</td>
              <td><select data-admin-testing-status="${esc(o.id)}">${(d.statuses||[]).map(v=>`<option value="${esc(v)}" ${v===o.status?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></td>
              <td>${r?`<strong>${esc(pretty(r.final_status))}</strong><br><small>${esc(fmtDT(r.finalized_at||r.result_date))}</small>`:'—'}</td>
              <td><div class="row-actions"><button class="org-action" type="button" data-edit-testing-order="${esc(o.id)}">Edit</button></div></td>
            </tr>`;
          }).join(''),'No testing orders for this Employer.')}
        </div>
      </section>`;

    const form=root.querySelector('#adminTestingOrderForm');
    const title=root.querySelector('#adminTestingEditorTitle');
    const helper=root.querySelector('#adminTestingValidation');
    const employeeSelect=form.elements.employee_id;
    const programSelect=form.elements.program_id;
    const siteSelect=form.elements.collection_site_id;
    const testTypeSelect=form.elements.test_type;

    const eligibleProgramsForEmployee=(employeeId,reason)=>{
      return programs.filter(p=>enrollments.some(en=>en.employee_id===employeeId&&en.program_id===p.id&&(
        reason==='pre_employment'?['active','pending'].includes(en.status):en.status==='active'
      )));
    };

    const rebuildPrograms=()=>{
      const employeeId=employeeSelect.value,reason=form.elements.reason.value,prior=programSelect.value;
      const rows=employeeId?eligibleProgramsForEmployee(employeeId,reason):programs;
      programSelect.innerHTML=`<option value="">Choose program</option>${rows.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(pretty(x.program_type))}${x.dot_agency?` · ${esc(x.dot_agency)}`:''}</option>`).join('')}`;
      if(prior&&rows.some(x=>x.id===prior))programSelect.value=prior;
      helper.textContent=employeeId?(rows.length?`${rows.length} assigned program(s) are available for this employee / driver.`:'This employee / driver is not assigned to a qualifying program for this reason.'):'Choose an employee and program. The employee must be assigned to that program.';
      rebuildSites();
    };

    const rebuildSites=()=>{
      const p=programs.find(x=>x.id===programSelect.value),type=testTypeSelect.value,prior=siteSelect.value;
      const rows=sites.filter(s=>{
        if(!p)return true;
        if(p.program_type==='DOT'&&!s.dot_capable)return false;
        if(p.program_type==='NON_DOT'&&!s.non_dot_capable)return false;
        if((type==='drug'||type==='drug_and_alcohol')&&!s.drug_testing)return false;
        if((type==='alcohol'||type==='drug_and_alcohol')&&!s.alcohol_testing)return false;
        return true;
      });
      siteSelect.innerHTML=`<option value="">Not assigned</option>${rows.map(x=>`<option value="${esc(x.id||x.collection_site_id)}">${esc(x.name||'Collection Site')} · ${esc([x.city,x.state].filter(Boolean).join(', ')||'—')}</option>`).join('')}`;
      if(prior&&rows.some(x=>(x.id||x.collection_site_id)===prior))siteSelect.value=prior;
      if(p&&!form.elements.testing_panel.value)form.elements.testing_panel.value=p.testing_panel||'';
      if(p&&!form.elements.collection_type.value&&['urine','oral_fluid'].includes(String(p.testing_method||'').toLowerCase().replace(' ','_')))form.elements.collection_type.value=String(p.testing_method).toLowerCase().replace(' ','_');
    };

    employeeSelect.onchange=rebuildPrograms;
    form.elements.reason.onchange=rebuildPrograms;
    programSelect.onchange=rebuildSites;
    testTypeSelect.onchange=rebuildSites;

    const clear=()=>{
      form.reset();form.elements.id.value='';title.textContent='Create Testing Order';
      [...form.elements].forEach(el=>el.disabled=false);
      rebuildPrograms();
    };
    root.querySelector('#clearAdminTestingOrder').onclick=clear;

    root.querySelectorAll('[data-edit-testing-order]').forEach(btn=>btn.onclick=()=>{
      const o=orders.find(x=>x.id===btn.dataset.editTestingOrder);if(!o)return;
      clear();
      fillForm(form,{
        id:o.id,employee_id:o.employee_id,program_id:o.program_id,reason:o.reason,test_type:o.test_type,
        collection_site_id:o.collection_site_id||'',collection_deadline:o.collection_deadline?new Date(o.collection_deadline).toISOString().slice(0,16):'',
        testing_panel:o.testing_panel||'',collection_type:o.collection_type||''
      });
      rebuildPrograms();programSelect.value=o.program_id;rebuildSites();siteSelect.value=o.collection_site_id||'';
      if(o.selection_member_id){
        employeeSelect.disabled=true;programSelect.disabled=true;form.elements.reason.disabled=true;testTypeSelect.disabled=true;
        helper.textContent='This order came from a locked Random Selection. Employee, program, reason, and test type are protected; collection details may still be updated before finalization.';
      }else helper.textContent='Editing an existing testing order.';
      title.textContent=`Edit ${o.order_number}`;
      window.scrollTo({top:root.offsetTop-90,behavior:'smooth'});
    });

    form.onsubmit=async ev=>{
      ev.preventDefault();
      try{
        const x=formData(form);
        // Disabled fields are not emitted by FormData; retain protected values for selection-generated orders.
        if(x.id){
          const current=orders.find(o=>o.id===x.id);
          if(current?.selection_member_id){
            x.employee_id=current.employee_id;x.program_id=current.program_id;x.reason=current.reason;x.test_type=current.test_type;
          }
        }
        status(x.id?'Saving testing order…':'Creating testing order…');
        await testApi({action:x.id?'save_order':'create_order',employer_id:employerId,test:x});
        status(x.id?'Testing order updated.':'Testing order created.','success');
        await load();
      }catch(e){status(e.message,'error')}
    };

    root.querySelectorAll('[data-admin-testing-status]').forEach(sel=>sel.onchange=async()=>{
      const previous=orders.find(x=>x.id===sel.dataset.adminTestingStatus)?.status||'created';
      try{
        status('Updating testing lifecycle…');
        await testApi({action:'save_test_status',employer_id:employerId,test:{id:sel.dataset.adminTestingStatus,status:sel.value}});
        status('Testing order lifecycle updated.','success');
        await load();
      }catch(e){sel.value=previous;status(e.message,'error')}
    });
  };

  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderResults(){
  const root=$('#managementContent');
  root.innerHTML='<div class="management-empty">Loading Results / MRO workspace…</div>';

  const load=async()=>{
    const d=await resultApi({action:'workspace',employer_id:employerId});
    const orders=d.orders||[],results=d.results||[],specimens=d.specimens||[],reports=d.reports||[],mros=d.mros||[],labs=d.laboratories||[];
    const resultByOrder=new Map();
    results.forEach(r=>{if(!resultByOrder.has(r.testing_order_id))resultByOrder.set(r.testing_order_id,r)});
    const specimenByOrder=new Map();
    specimens.forEach(s=>{if(!specimenByOrder.has(s.testing_order_id))specimenByOrder.set(s.testing_order_id,s)});
    const reportByResult=new Map(reports.map(r=>[r.test_result_id,r]));
    const eligibleOrders=orders.filter(o=>['collected','laboratory','mro_review','final_result','closed'].includes(o.status));
    const pendingMro=results.filter(r=>r.final_status==='mro_pending'||['pending_assignment','pending_review'].includes(String(r.mro_status||''))).length;
    const finalized=results.filter(r=>r.finalized_at&&r.final_status!=='pending'&&r.final_status!=='mro_pending').length;
    const awaitingLab=orders.filter(o=>['collected','laboratory'].includes(o.status)&&!resultByOrder.get(o.id)?.finalized_at).length;

    root.innerHTML=`
      <div class="management-stat-grid" style="margin-bottom:18px">
        <div class="management-stat"><strong>${eligibleOrders.length}</strong><span>Result-Eligible Orders</span></div>
        <div class="management-stat"><strong>${awaitingLab}</strong><span>Awaiting Lab Entry</span></div>
        <div class="management-stat"><strong>${pendingMro}</strong><span>MRO Review Queue</span></div>
        <div class="management-stat"><strong>${finalized}</strong><span>Finalized Results</span></div>
      </div>

      <section class="admin-inline-editor">
        <div class="management-section-head">
          <div><h3 id="resultEditorTitle">Laboratory / Preliminary Result</h3><p>Record the laboratory result after collection. Drug results move into MRO review before a verified final result is released to the Employer.</p></div>
          <button class="btn btn-outline" type="button" id="clearResultEditor">Clear</button>
        </div>
        <form id="adminResultForm" class="saas-form">
          <input type="hidden" name="result_id">
          <div class="saas-form-grid">
            <label><span>Testing Order *</span><select name="testing_order_id" required><option value="">Choose collected order</option>${eligibleOrders.map(o=>`<option value="${esc(o.id)}">${esc(o.order_number)} · ${esc(employeeName(o.employees))} · ${esc(pretty(o.test_type))}</option>`).join('')}</select></label>
            <label><span>Laboratory</span><select name="laboratory_id"><option value="">Choose laboratory</option>${labs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>
            <label><span>Preliminary Result *</span><select name="preliminary_status"><option value="pending">Pending</option><option value="negative">Negative</option><option value="positive">Positive</option><option value="invalid">Invalid</option><option value="cancelled">Cancelled</option><option value="refusal">Refusal</option></select></label>
            <label><span>Result Date</span><input name="result_date" type="datetime-local"></label>
            <label><span>Specimen / Accession ID</span><input name="specimen_external_id"></label>
            <label><span>Specimen Type</span><input name="specimen_type" placeholder="Urine, oral fluid, breath, etc."></label>
            <label style="grid-column:1/-1"><span>Laboratory Notes</span><textarea name="lab_notes" rows="3" placeholder="Sensitive internal result notes. Not shown in Employer summary views."></textarea></label>
          </div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Save Preliminary Result</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Results / MRO Queue</h2><span>Laboratory, MRO, final result, official report, and source-document status.</span></div></div>
        <div class="card-body">
          ${table(['Order','Employee / Driver','Test','Preliminary','MRO','Final','Lab','Specimen','Report','Actions'],eligibleOrders.map(o=>{
            const r=resultByOrder.get(o.id),sp=specimenByOrder.get(o.id),rp=r?reportByResult.get(r.id):null;
            return `<tr>
              <td><strong>${esc(o.order_number)}</strong><br><small>${esc(pretty(o.status))}</small></td>
              <td>${esc(employeeName(o.employees))}<br><small>${esc(o.employees?.employee_number||'')}</small></td>
              <td>${esc(pretty(o.test_type))}<br><small>${esc(o.programs?.name||pretty(o.program_type))}</small></td>
              <td>${esc(pretty(r?.preliminary_status||'pending'))}</td>
              <td>${esc(r?.mros?.name||pretty(r?.mro_status||'—'))}</td>
              <td><strong>${esc(pretty(r?.final_status||'pending'))}</strong><br><small>${esc(fmtDT(r?.finalized_at||r?.result_date))}</small></td>
              <td>${esc(r?.laboratories?.name||'—')}</td>
              <td>${esc(sp?.specimen_id||'—')}</td>
              <td>${rp?`<a class="btn btn-outline btn-small" href="../result-report.html?mode=admin&employer=${encodeURIComponent(employerId)}&report=${encodeURIComponent(rp.id)}" target="_blank">View Report</a>`:'—'}</td>
              <td><div class="row-actions">
                <button class="org-action" type="button" data-edit-result="${esc(o.id)}">${r?'Edit Lab Result':'Record Result'}</button>
                ${r&&!r.finalized_at&&['drug','drug_and_alcohol'].includes(o.test_type)?`<button class="org-action" type="button" data-mro-result="${esc(r.id)}">MRO Review</button>`:''}
                ${r&&!r.finalized_at?`<button class="org-action" type="button" data-finalize-result="${esc(r.id)}">Finalize</button>`:''}
              </div></td>
            </tr>`;
          }).join(''),'No testing orders are ready for Results / MRO processing.')}
        </div>
      </section>

      <section id="mroPanel" class="admin-inline-editor" hidden>
        <div class="management-section-head"><div><h3>MRO Review</h3><p>Assign one of the MROs configured for this Employer.</p></div></div>
        <form id="mroForm" class="saas-form">
          <input type="hidden" name="result_id">
          <div class="saas-form-grid"><label><span>Assigned MRO *</span><select name="mro_id" required><option value="">Choose Employer MRO</option>${mros.map(x=>`<option value="${esc(x.mros?.id||'')}">${esc(x.mros?.name||'MRO')}${x.is_primary?' · Primary':''}${x.mros?.license_number?` · ${esc(x.mros.license_number)}`:''}</option>`).join('')}</select></label></div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Assign for MRO Review</button></div>
        </form>
      </section>

      <section id="finalizeResultPanel" class="admin-inline-editor" hidden>
        <div class="management-section-head"><div><h3>Finalize Verified Result</h3><p>This locks the verified outcome, creates the screenings4u result report, advances the testing order to Final Result, and queues an Employer in-app notice.</p></div></div>
        <form id="finalizeResultForm" class="saas-form">
          <input type="hidden" name="result_id"><input type="hidden" name="testing_order_id">
          <div class="saas-form-grid">
            <label><span>Verified Final Result *</span><select name="final_status" required><option value="">Choose verified outcome</option><option value="negative">Negative</option><option value="positive">Positive</option><option value="invalid">Invalid</option><option value="cancelled">Cancelled</option><option value="refusal">Refusal</option></select></label>
            <label><span>MRO Verified At</span><input name="mro_verified_at" type="datetime-local"></label>
            <label style="grid-column:1/-1"><span>Official MRO / Laboratory Document</span><input id="officialResultFile" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"></label>
          </div>
          <div class="saas-notice">For drug results, an Employer-assigned MRO must be selected before finalization. The uploaded source document is stored as a sensitive Employer document linked to the testing order.</div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Finalize & Create Result Report</button></div>
        </form>
      </section>`;

    const form=root.querySelector('#adminResultForm');
    const clear=()=>{form.reset();form.elements.result_id.value='';root.querySelector('#resultEditorTitle').textContent='Laboratory / Preliminary Result';};
    root.querySelector('#clearResultEditor').onclick=clear;

    root.querySelectorAll('[data-edit-result]').forEach(btn=>btn.onclick=()=>{
      const o=orders.find(x=>x.id===btn.dataset.editResult),r=resultByOrder.get(o.id),sp=specimenByOrder.get(o.id);
      clear();
      fillForm(form,{testing_order_id:o.id,result_id:r?.id||'',laboratory_id:r?.laboratory_id||'',preliminary_status:r?.preliminary_status||'pending',result_date:r?.result_date?new Date(r.result_date).toISOString().slice(0,16):'',specimen_external_id:sp?.specimen_id||'',specimen_type:sp?.specimen_type||o.collection_type||'',lab_notes:r?.sensitive_payload?.lab_notes||''});
      root.querySelector('#resultEditorTitle').textContent=`${r?'Edit':'Record'} Result · ${o.order_number}`;
      form.scrollIntoView({behavior:'smooth',block:'center'});
    });

    form.onsubmit=async ev=>{ev.preventDefault();try{status('Saving preliminary result…');await resultApi({action:'save_preliminary',employer_id:employerId,result:formData(form)});status('Preliminary result saved and testing lifecycle updated.','success');await load()}catch(e){status(e.message,'error')}};

    root.querySelectorAll('[data-mro-result]').forEach(btn=>btn.onclick=()=>{
      const r=results.find(x=>x.id===btn.dataset.mroResult),panel=root.querySelector('#mroPanel'),mf=root.querySelector('#mroForm');
      mf.reset();mf.elements.result_id.value=r.id;if(r.mro_id)mf.elements.mro_id.value=r.mro_id;panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'center'});
    });
    const mf=root.querySelector('#mroForm');
    mf.onsubmit=async ev=>{ev.preventDefault();try{status('Assigning MRO…');const x=formData(mf);await resultApi({action:'assign_mro',employer_id:employerId,result_id:x.result_id,mro_id:x.mro_id});status('Result assigned for MRO review.','success');await load()}catch(e){status(e.message,'error')}};

    root.querySelectorAll('[data-finalize-result]').forEach(btn=>btn.onclick=()=>{
      const r=results.find(x=>x.id===btn.dataset.finalizeResult),o=orders.find(x=>x.id===r.testing_order_id),panel=root.querySelector('#finalizeResultPanel'),ff=root.querySelector('#finalizeResultForm');
      ff.reset();ff.elements.result_id.value=r.id;ff.elements.testing_order_id.value=o.id;ff.elements.mro_verified_at.value=new Date().toISOString().slice(0,16);panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'center'});
    });
    const ff=root.querySelector('#finalizeResultForm');
    ff.onsubmit=async ev=>{
      ev.preventDefault();
      const x=formData(ff),file=root.querySelector('#officialResultFile')?.files?.[0];
      let documentId=null,storagePath=null;
      try{
        if(file){
          if(file.size>10*1024*1024)throw new Error('Official result document must be 10 MB or smaller.');
          if(!['application/pdf','image/png','image/jpeg'].includes(file.type))throw new Error('Upload a PDF, PNG, or JPG result document.');
          const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
          storagePath=`${detail.employer.tenant_id}/${employerId}/results/${x.testing_order_id}/${Date.now()}-${safe}`;
          status('Uploading official result document…');
          const up=await supabase.storage.from('workforce-documents').upload(storagePath,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;
          const reg=await resultApi({action:'register_source_document',employer_id:employerId,document:{testing_order_id:x.testing_order_id,storage_bucket:'workforce-documents',storage_path:storagePath,file_name:file.name,mime_type:file.type,size_bytes:file.size}});
          documentId=reg.document.id;
        }
        if(!window.confirm('Finalize this verified result? Finalized results are locked from the preliminary workflow.')){if(storagePath)await supabase.storage.from('workforce-documents').remove([storagePath]);return}
        status('Finalizing verified result…');
        const r=await resultApi({action:'finalize_result',employer_id:employerId,result_id:x.result_id,final_status:x.final_status,mro_verified_at:x.mro_verified_at||null,official_mro_document_id:documentId});
        if(['positive','refusal'].includes(x.final_status)){try{await complianceSyncApi({employer_id:employerId})}catch(syncError){console.error('Compliance sync',syncError)}}
        status(`Verified result finalized. Report ${r.report?.report_number||''} created.`,'success');await load();
      }catch(e){status(e.message,'error')}
    };
  };
  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderCompliance(){
  const root=$('#managementContent');
  root.innerHTML='<div class="management-empty">Loading compliance / SAP / RTD workspace…</div>';

  const load=async()=>{
    try{await complianceSyncApi({employer_id:employerId})}catch(e){console.error('Compliance violation sync',e)}
    const d=await complianceApi({action:'workspace',employer_id:employerId});
    const cases=d.cases||[],tasks=d.tasks||[],saps=d.sap_cases||[],follow=d.follow_up_tests||[],results=d.results||[],sapOrgs=d.sap_organizations||[];
    const sapByCase=new Map(); saps.forEach(x=>{if(!sapByCase.has(x.compliance_case_id))sapByCase.set(x.compliance_case_id,x)});
    const resultByOrder=new Map(); results.forEach(x=>{if(!resultByOrder.has(x.testing_order_id))resultByOrder.set(x.testing_order_id,x)});
    const openCases=cases.filter(x=>!['resolved','closed'].includes(x.status));
    const critical=openCases.filter(x=>x.priority==='critical');
    const activeSap=saps.filter(x=>!['completed','closed'].includes(x.status));
    const pendingFollow=follow.filter(x=>!['completed','cancelled'].includes(x.status));

    root.innerHTML=`
      <div class="management-stat-grid" style="margin-bottom:18px">
        <div class="management-stat"><strong>${openCases.length}</strong><span>Open Compliance Cases</span></div>
        <div class="management-stat"><strong>${critical.length}</strong><span>Critical Cases</span></div>
        <div class="management-stat"><strong>${activeSap.length}</strong><span>Active SAP / RTD Cases</span></div>
        <div class="management-stat"><strong>${pendingFollow.length}</strong><span>Follow-Up Tests Outstanding</span></div>
      </div>
      <div class="saas-notice"><strong>Automatic violation control:</strong> finalized Positive or Refusal results create a critical compliance case, place the employee / driver on Compliance Hold, create initial action tasks, and open the SAP / Return-to-Duty workflow. This sync is idempotent and will not create duplicate cases for the same testing order.</div>
      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Compliance Cases</h2><span>Positive/refusal cases are tied directly to the source testing order and verified result.</span></div></div>
        <div class="card-body">${table(['Case','Employee / Driver','Event','Source Order','Priority','Status','Clearinghouse','SAP / RTD','Actions'],cases.map(c=>{const s=sapByCase.get(c.id);return `<tr>
          <td><strong>${esc(c.case_number)}</strong><br><small>${esc(fmt(c.violation_date||c.opened_at))}</small></td>
          <td>${esc(employeeName(c.employees))}<br><small>${esc(pretty(c.employees?.employment_status))}</small></td>
          <td>${esc(pretty(c.event_type))}</td>
          <td>${esc(c.testing_orders?.order_number||'—')}<br><small>${esc(pretty(c.testing_orders?.program_type))}</small></td>
          <td>${esc(pretty(c.priority))}</td><td>${esc(pretty(c.status))}</td>
          <td>${esc(pretty(c.clearinghouse_status||'not applicable'))}</td>
          <td>${esc(s?pretty(s.return_to_duty_status||s.status):'Not Started')}</td>
          <td><button class="org-action" type="button" data-open-compliance-case="${esc(c.id)}">Manage</button></td>
        </tr>`}).join(''),'No compliance cases.')}</div>
      </section>
      <section id="complianceCasePanel" class="admin-inline-editor" hidden>
        <div class="management-section-head"><div><h3 id="complianceCaseTitle">Compliance Case</h3><p id="complianceCaseMeta"></p></div></div>
        <div id="complianceCaseBody"></div>
      </section>`;

    const openCase=id=>{
      const c=cases.find(x=>x.id===id);if(!c)return;
      const panel=root.querySelector('#complianceCasePanel'),s=sapByCase.get(c.id),caseTasks=tasks.filter(x=>x.compliance_case_id===c.id),fus=s?follow.filter(x=>x.sap_case_id===s.id):[];
      panel.hidden=false;root.querySelector('#complianceCaseTitle').textContent=`${c.case_number} · ${employeeName(c.employees)}`;
      root.querySelector('#complianceCaseMeta').textContent=`${pretty(c.event_type)} · opened ${fmtDT(c.opened_at)} · source order ${c.testing_orders?.order_number||'—'}`;
      panel.querySelector('#complianceCaseBody').innerHTML=`
        <form id="caseEditor" class="saas-form">
          <input type="hidden" name="id" value="${esc(c.id)}">
          <div class="saas-form-grid">
            <label><span>Priority</span><select name="priority">${['low','normal','high','critical'].map(v=>`<option value="${v}" ${c.priority===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></label>
            <label><span>Case Status</span><select name="status">${['open','in_progress','pending','resolved','closed'].map(v=>`<option value="${v}" ${c.status===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></label>
            <label><span>Clearinghouse Status</span><select name="clearinghouse_status"><option value="" ${!c.clearinghouse_status?'selected':''}>Not Applicable / Blank</option>${['not_recorded','pending','reported','corrected'].map(v=>`<option value="${v}" ${c.clearinghouse_status===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></label>
            <label><span>Clearinghouse Reported At</span><input name="clearinghouse_reported_at" type="datetime-local" value="${c.clearinghouse_reported_at?new Date(c.clearinghouse_reported_at).toISOString().slice(0,16):''}"></label>
            <label><span>Clearinghouse Reference</span><input name="clearinghouse_reference" value="${esc(c.clearinghouse_reference||'')}"></label>
            <label><span>Compliance Due</span><input name="compliance_due_at" type="datetime-local" value="${c.compliance_due_at?new Date(c.compliance_due_at).toISOString().slice(0,16):''}"></label>
            <label style="grid-column:1/-1"><span>Resolution / Case Notes</span><textarea name="resolution" rows="3">${esc(c.resolution||'')}</textarea></label>
          </div><div class="saas-actions"><button class="btn btn-orange">Save Compliance Case</button></div>
        </form>
        <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Compliance Tasks</h2><span>Required actions and due dates.</span></div></div><div class="card-body">
          ${table(['Task','Due','Status','Action'],caseTasks.map(t=>`<tr><td><strong>${esc(t.title)}</strong><br><small>${esc(t.description||'')}</small></td><td>${esc(fmtDT(t.due_at))}</td><td><select data-task-status="${esc(t.id)}">${['open','in_progress','complete','cancelled'].map(v=>`<option value="${v}" ${t.status===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></td><td><button class="org-action" data-save-task-status="${esc(t.id)}" type="button">Save</button></td></tr>`).join(''),'No compliance tasks.')}
          <form id="newComplianceTask" class="saas-form" style="margin-top:14px"><input type="hidden" name="compliance_case_id" value="${esc(c.id)}"><div class="saas-form-grid"><label><span>New Task</span><input name="title" required></label><label><span>Due</span><input name="due_at" type="datetime-local"></label><label style="grid-column:1/-1"><span>Description</span><input name="description"></label></div><div class="saas-actions"><button class="btn btn-outline">Add Task</button></div></form>
        </div></section>
        <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>SAP / Return-to-Duty</h2><span>${sapOrgs.length?sapOrgs.length+' SAP provider organization(s) configured':'No SAP provider organizations are currently configured; the case may remain unassigned until a provider is added.'}</span></div></div><div class="card-body">
          <form id="sapEditor" class="saas-form"><input type="hidden" name="id" value="${esc(s?.id||'')}"><input type="hidden" name="compliance_case_id" value="${esc(c.id)}"><div class="saas-form-grid">
            <label><span>SAP Organization</span><select name="sap_organization_id"><option value="">Unassigned</option>${sapOrgs.map(o=>`<option value="${esc(o.id)}" ${s?.sap_organization_id===o.id?'selected':''}>${esc(o.legal_name)}</option>`).join('')}</select></label>
            <label><span>Evaluation Date</span><input name="evaluation_date" type="date" value="${esc(s?.evaluation_date||'')}"></label>
            <label><span>SAP Case Status</span><select name="status">${['open','in_progress','completed','closed'].map(v=>`<option value="${v}" ${String(s?.status||'open')===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></label>
            <label><span>RTD Status</span><select name="return_to_duty_status">${['sap_referral_required','sap_evaluation_scheduled','sap_evaluation_complete','eligible_for_rtd_test','rtd_test_ordered','rtd_test_passed','rtd_test_failed','follow_up_active','follow_up_complete','completed'].map(v=>`<option value="${v}" ${String(s?.return_to_duty_status||'sap_referral_required')===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></label>
            <label style="grid-column:1/-1"><span>SAP Recommendations</span><textarea name="recommendations" rows="3">${esc(s?.recommendations||'')}</textarea></label>
          </div><div class="saas-actions"><button class="btn btn-orange">Save SAP / RTD Case</button>${s?'<button class="btn btn-outline" type="button" id="createRtdOrder">Create RTD Testing Order</button><button class="btn btn-outline" type="button" id="syncRtdWorkflow">Sync Results</button><button class="btn btn-outline" type="button" id="releaseToDuty">Release to Duty</button>':''}</div></form>
          ${s?`<div style="margin-top:18px">${table(['#','Required By','Status','Testing Order','Order Status','Action'],fus.map(f=>`<tr><td>${f.sequence_number}</td><td>${esc(fmt(f.required_by))}</td><td>${esc(pretty(f.status))}</td><td>${esc(f.testing_orders?.order_number||'Not created')}</td><td>${esc(pretty(f.testing_orders?.status||'—'))}</td><td>${!f.testing_order_id?`<button class="org-action" data-create-follow-order="${esc(f.id)}" type="button">Create Order</button>`:'—'}</td></tr>`).join(''),'No follow-up tests scheduled.')}</div>
          <form id="followUpForm" class="saas-form" style="margin-top:14px"><input type="hidden" name="sap_case_id" value="${esc(s.id)}"><div class="saas-form-grid"><label><span>Sequence #</span><input name="sequence_number" type="number" min="1" required></label><label><span>Required By</span><input name="required_by" type="date"></label><label><span>Status</span><select name="status"><option value="required">Required</option><option value="ordered">Ordered</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></div><div class="saas-actions"><button class="btn btn-outline">Add Follow-Up Requirement</button></div></form>`:''}
        </div></section>`;

      const caseForm=panel.querySelector('#caseEditor');caseForm.onsubmit=async ev=>{ev.preventDefault();try{status('Saving compliance case…');await complianceApi({action:'save_case',employer_id:employerId,case:formData(caseForm)});status('Compliance case saved.','success');await load()}catch(e){status(e.message,'error')}};
      panel.querySelectorAll('[data-save-task-status]').forEach(btn=>btn.onclick=async()=>{const t=caseTasks.find(x=>x.id===btn.dataset.saveTaskStatus),st=panel.querySelector(`[data-task-status="${btn.dataset.saveTaskStatus}"]`).value;try{await complianceApi({action:'save_task',employer_id:employerId,task:{...t,status:st}});status('Task updated.','success');await load()}catch(e){status(e.message,'error')}});
      const nt=panel.querySelector('#newComplianceTask');nt.onsubmit=async ev=>{ev.preventDefault();try{await complianceApi({action:'save_task',employer_id:employerId,task:formData(nt)});status('Compliance task added.','success');await load()}catch(e){status(e.message,'error')}};
      const sf=panel.querySelector('#sapEditor');sf.onsubmit=async ev=>{ev.preventDefault();try{await complianceApi({action:'save_sap',employer_id:employerId,sap:formData(sf)});status('SAP / RTD case saved.','success');await load()}catch(e){status(e.message,'error')}};
      panel.querySelector('#createRtdOrder')?.addEventListener('click',async()=>{try{const r=await complianceApi({action:'create_rtd_order',employer_id:employerId,sap_case_id:s.id});status(r.already_exists?'An open RTD testing order already exists.':'Return-to-duty testing order created.','success');await load()}catch(e){status(e.message,'error')}});
      panel.querySelector('#syncRtdWorkflow')?.addEventListener('click',async()=>{try{const r=await complianceApi({action:'sync_workflow',employer_id:employerId,sap_case_id:s.id});status(`Workflow synced: ${r.follow_up_completed||0}/${r.follow_up_total||0} follow-up tests complete.`,'success');await load()}catch(e){status(e.message,'error')}});
      panel.querySelector('#releaseToDuty')?.addEventListener('click',async()=>{if(!window.confirm('Release this employee from Compliance Hold? A finalized negative RTD result is required.'))return;try{await complianceApi({action:'release_to_duty',employer_id:employerId,sap_case_id:s.id});status('Employee released from Compliance Hold. Follow-up requirements remain active when applicable.','success');await load()}catch(e){status(e.message,'error')}});
      const ff=panel.querySelector('#followUpForm');if(ff)ff.onsubmit=async ev=>{ev.preventDefault();try{await complianceApi({action:'save_follow_up',employer_id:employerId,follow_up:formData(ff)});status('Follow-up requirement saved.','success');await load()}catch(e){status(e.message,'error')}};
      panel.querySelectorAll('[data-create-follow-order]').forEach(btn=>btn.onclick=async()=>{try{await complianceApi({action:'create_follow_up_order',employer_id:employerId,follow_up_test_id:btn.dataset.createFollowOrder});status('Follow-up testing order created.','success');await load()}catch(e){status(e.message,'error')}});
      panel.scrollIntoView({behavior:'smooth',block:'center'});
    };
    root.querySelectorAll('[data-open-compliance-case]').forEach(btn=>btn.onclick=()=>openCase(btn.dataset.openComplianceCase));
  };
  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderDocuments(){
  const root=$('#managementContent');
  root.innerHTML='<div class="management-empty">Loading Employer documents and compliance records…</div>';

  const load=async()=>{
    const d=await documentApi({action:'workspace',employer_id:employerId});
    const docs=d.documents||[],links=d.links||[],employees=d.employees||[],programs=d.programs||[],orders=d.testing_orders||[],cases=d.compliance_cases||[],tasks=d.compliance_tasks||[],saps=d.sap_cases||[],follow=d.follow_up_tests||[],reports=d.result_reports||[];
    const linkMap=new Map();
    links.forEach(l=>{if(!linkMap.has(l.document_id))linkMap.set(l.document_id,[]);linkMap.get(l.document_id).push(l)});
    const sensitive=docs.filter(x=>x.access_level==='sensitive').length;
    const legalHold=docs.filter(x=>x.legal_hold).length;
    const unavailable=docs.filter(x=>x.storage_bucket_available===false).length;
    const complianceDocs=docs.filter(x=>x.compliance_case_id||linkMap.get(x.id)?.some(l=>l.target_type==='compliance_case')).length;

    root.innerHTML=`
      <div class="management-stat-grid" style="margin-bottom:18px">
        <div class="management-stat"><strong>${docs.length}</strong><span>Employer Documents</span></div>
        <div class="management-stat"><strong>${complianceDocs}</strong><span>Compliance-Linked</span></div>
        <div class="management-stat"><strong>${sensitive}</strong><span>Sensitive Records</span></div>
        <div class="management-stat"><strong>${legalHold}</strong><span>Legal Hold</span></div>
      </div>
      ${unavailable?`<div class="saas-notice"><strong>Legacy file warning:</strong> ${unavailable} document record(s) reference a storage bucket that is not currently available. The database records are preserved, but those file bytes cannot be opened until the original storage object is restored or replaced.</div>`:''}

      <section class="admin-inline-editor">
        <div class="management-section-head"><div><h3>Upload Employer Record</h3><p>Store a document once, classify its access level, and link it directly to an employee, program, testing order, or compliance case.</p></div></div>
        <form id="adminDocumentForm" class="saas-form">
          <div class="saas-form-grid">
            <label style="grid-column:1/-1"><span>File *</span><input id="adminDocumentFile" type="file" accept="application/pdf,image/png,image/jpeg" required></label>
            <label><span>Document Type *</span><input name="document_type" value="compliance_record" required></label>
            <label><span>Access Level *</span><select name="access_level"><option value="standard">Standard</option><option value="restricted">Restricted</option><option value="sensitive">Sensitive</option></select></label>
            <label><span>Title</span><input name="title"></label>
            <label><span>Employee / Driver</span><select name="employee_id"><option value="">Not linked</option>${employees.map(x=>`<option value="${esc(x.id)}">${esc(employeeName(x))}${x.employee_number?` · ${esc(x.employee_number)}`:''}</option>`).join('')}</select></label>
            <label><span>Program</span><select name="program_id"><option value="">Not linked</option>${programs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(pretty(x.program_type))}</option>`).join('')}</select></label>
            <label><span>Testing Order</span><select name="testing_order_id"><option value="">Not linked</option>${orders.map(x=>`<option value="${esc(x.id)}">${esc(x.order_number)} · ${esc(pretty(x.reason))}</option>`).join('')}</select></label>
            <label><span>Compliance Case</span><select name="compliance_case_id"><option value="">Not linked</option>${cases.map(x=>`<option value="${esc(x.id)}">${esc(x.case_number)} · ${esc(pretty(x.event_type))}</option>`).join('')}</select></label>
            <label><span>Retention Until</span><input name="retention_until" type="date"></label>
            <label><span>Legal Hold</span><select name="legal_hold"><option value="false">No</option><option value="true">Yes</option></select></label>
            <label style="grid-column:1/-1"><span>Description</span><textarea name="description" rows="3"></textarea></label>
          </div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Upload & Register</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Document Repository</h2><span>Files, access classification, retention, and linked workflow records.</span></div></div>
        <div class="card-body">${table(['File','Type','Access','Linked Records','Uploaded','Retention','Actions'],docs.map(x=>{
          const l=linkMap.get(x.id)||[],linked=[
            x.employee_id?`Employee`:null,x.program_id?`Program`:null,x.testing_order_id?`Testing Order`:null,x.compliance_case_id?`Compliance Case`:null,
            ...l.map(v=>pretty(v.target_type))
          ].filter(Boolean);
          return `<tr>
            <td><strong>${esc(x.metadata?.title||x.file_name)}</strong><br><small>${esc(x.file_name)}</small>${x.legal_hold?'<br><span class="badge warning">Legal Hold</span>':''}${x.storage_bucket_available===false?'<br><span class="badge warning">File Unavailable</span>':''}</td>
            <td>${esc(pretty(x.document_type))}</td><td>${esc(pretty(x.access_level))}</td>
            <td>${esc([...new Set(linked)].join(', ')||'Unlinked')}</td>
            <td>${esc(fmtDT(x.uploaded_at))}</td><td>${esc(fmt(x.retention_until))}</td>
            <td><div class="row-actions"><button class="org-action" type="button" data-view-document="${esc(x.id)}">Open</button><button class="org-action" type="button" data-manage-document="${esc(x.id)}">Manage</button>${!x.legal_hold?`<button class="org-action danger" type="button" data-archive-document="${esc(x.id)}">Archive</button>`:''}</div></td>
          </tr>`;
        }).join(''),'No Employer documents.')}</div>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Compliance Record Index</h2><span>Operational records that should be supported by documents where appropriate.</span></div></div>
        <div class="card-body">
          ${table(['Case','Employee / Driver','Event','Status','Tasks','SAP / RTD','Follow-Up','Result Report'],cases.map(c=>{
            const s=saps.find(x=>x.compliance_case_id===c.id),fts=s?follow.filter(x=>x.sap_case_id===s.id):[],caseTasks=tasks.filter(x=>x.compliance_case_id===c.id),rp=c.testing_order_id?reports.find(x=>x.testing_order_id===c.testing_order_id):null;
            return `<tr><td><strong>${esc(c.case_number)}</strong></td><td>${esc(employeeName(c.employees))}</td><td>${esc(pretty(c.event_type))}</td><td>${esc(pretty(c.status))}</td><td>${caseTasks.filter(x=>!['complete','cancelled'].includes(x.status)).length} open / ${caseTasks.length}</td><td>${esc(s?pretty(s.return_to_duty_status||s.status):'Not Started')}</td><td>${fts.filter(x=>x.status==='completed').length}/${fts.length}</td><td>${rp?esc(rp.report_number):'—'}</td></tr>`;
          }).join(''),'No compliance records.')}</div>
      </section>

      <section id="documentManagePanel" class="admin-inline-editor" hidden>
        <div class="management-section-head"><div><h3 id="documentManageTitle">Manage Document</h3><p>Update classification or add workflow links without duplicating the file.</p></div></div>
        <div id="documentManageBody"></div>
      </section>`;

    const uploadForm=root.querySelector('#adminDocumentForm');
    uploadForm.onsubmit=async ev=>{
      ev.preventDefault();const file=root.querySelector('#adminDocumentFile')?.files?.[0];
      if(!file)return status('Choose a file.','error');
      if(file.size>10*1024*1024)return status('File must be 10 MB or smaller.','error');
      if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return status('Upload a PDF, PNG, or JPG.','error');
      try{
        const x=formData(uploadForm);x.legal_hold=x.legal_hold==='true';
        status('Preparing secure upload…');
        const ticket=await documentApi({action:'create_upload',employer_id:employerId,document:{file_name:file.name,document_type:x.document_type}});
        const up=await supabase.storage.from(ticket.bucket).uploadToSignedUrl(ticket.path,ticket.token,file,{contentType:file.type});
        if(up.error)throw up.error;
        status('Registering Employer document…');
        await documentApi({action:'register',employer_id:employerId,document:{...x,file_name:file.name,storage_bucket:ticket.bucket,storage_path:ticket.path,mime_type:file.type,size_bytes:file.size}});
        status('Document uploaded and registered.','success');await load();
      }catch(e){status(e.message,'error')}
    };

    root.querySelectorAll('[data-view-document]').forEach(btn=>btn.onclick=async()=>{try{status('Creating secure document link…');const r=await documentApi({action:'signed_url',employer_id:employerId,document_id:btn.dataset.viewDocument});window.open(r.url,'_blank','noopener');status('Secure document link created.','success')}catch(e){status(e.message,'error')}});

    root.querySelectorAll('[data-archive-document]').forEach(btn=>btn.onclick=async()=>{if(!window.confirm('Archive this document record? The file remains retained according to its storage and retention rules.'))return;try{await documentApi({action:'archive',employer_id:employerId,document_id:btn.dataset.archiveDocument});status('Document archived.','success');await load()}catch(e){status(e.message,'error')}});

    root.querySelectorAll('[data-manage-document]').forEach(btn=>btn.onclick=()=>{
      const x=docs.find(d=>d.id===btn.dataset.manageDocument),panel=root.querySelector('#documentManagePanel'),body=root.querySelector('#documentManageBody'),existing=linkMap.get(x.id)||[];
      panel.hidden=false;root.querySelector('#documentManageTitle').textContent=x.metadata?.title||x.file_name;
      body.innerHTML=`<form id="documentMetaForm" class="saas-form"><input type="hidden" name="id" value="${esc(x.id)}"><div class="saas-form-grid">
        <label><span>Document Type</span><input name="document_type" value="${esc(x.document_type)}"></label>
        <label><span>Access</span><select name="access_level">${['standard','restricted','sensitive'].map(v=>`<option value="${v}" ${x.access_level===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></label>
        <label><span>Title</span><input name="title" value="${esc(x.metadata?.title||x.file_name)}"></label>
        <label style="grid-column:1/-1"><span>Description</span><textarea name="description" rows="3">${esc(x.metadata?.description||'')}</textarea></label>
      </div><div class="saas-actions"><button class="btn btn-orange">Save Document Metadata</button></div></form>
      <div style="margin-top:18px"><h4>Existing Links</h4>${existing.length?existing.map(l=>`<span class="badge neutral">${esc(pretty(l.target_type))}</span>`).join(' '):'<span class="management-empty">No additional links.</span>'}</div>
      <form id="documentLinkForm" class="saas-form" style="margin-top:16px"><div class="saas-form-grid"><label><span>Link Type</span><select name="target_type"><option value="employee">Employee</option><option value="program">Program</option><option value="testing_order">Testing Order</option><option value="compliance_case">Compliance Case</option></select></label><label><span>Link Target</span><select name="target_id"></select></label></div><div class="saas-actions"><button class="btn btn-outline">Add Link</button></div></form>`;
      const mf=body.querySelector('#documentMetaForm');mf.onsubmit=async ev=>{ev.preventDefault();try{await documentApi({action:'update_document',employer_id:employerId,document:formData(mf)});status('Document metadata updated.','success');await load()}catch(e){status(e.message,'error')}};
      const lf=body.querySelector('#documentLinkForm'),type=lf.elements.target_type,target=lf.elements.target_id;
      const rebuild=()=>{const rows=type.value==='employee'?employees:type.value==='program'?programs:type.value==='testing_order'?orders:cases;target.innerHTML=rows.map(r=>`<option value="${esc(r.id)}">${esc(type.value==='employee'?employeeName(r):type.value==='program'?r.name:type.value==='testing_order'?r.order_number:r.case_number)}</option>`).join('')};type.onchange=rebuild;rebuild();
      lf.onsubmit=async ev=>{ev.preventDefault();const y=formData(lf);try{await documentApi({action:'link',employer_id:employerId,document_id:x.id,target_type:y.target_type,target_id:y.target_id});status('Document linked to workflow record.','success');await load()}catch(e){status(e.message,'error')}};
      panel.scrollIntoView({behavior:'smooth',block:'center'});
    });
  };
  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderNotifications(){
  const root=$('#managementContent');
  root.innerHTML='<div class="management-empty">Loading Employer Notifications / Action Center…</div>';

  const load=async()=>{
    const d=await notificationApi({action:'workspace',employer_id:employerId}),actions=d.actions||[],notifications=d.notifications||[];
    root.innerHTML=`
      <div class="management-stat-grid" style="margin-bottom:18px">
        <div class="management-stat"><strong>${actions.length}</strong><span>Action Items</span></div>
        <div class="management-stat"><strong>${d.counts?.critical||0}</strong><span>Critical</span></div>
        <div class="management-stat"><strong>${d.counts?.queued_notifications||0}</strong><span>Queued Notices</span></div>
        <div class="management-stat"><strong>${d.counts?.failed_notifications||0}</strong><span>Delivery Failures</span></div>
      </div>

      <section class="admin-inline-editor">
        <div class="management-section-head"><div><h3>Send Employer Notice</h3><p>Queue an in-app or email notice without bypassing the notification delivery workflow.</p></div></div>
        <form id="adminEmployerNoticeForm" class="saas-form">
          <div class="saas-form-grid">
            <label><span>Channel</span><select name="channel"><option value="in_app">In-App</option><option value="email">Email</option></select></label>
            <label><span>Recipient</span><select name="recipient_kind"><option value="employer_admins">Employer Admins</option><option value="ders">DERs</option><option value="all_staff">All Employer Staff</option><option value="primary">Primary Contact Email</option><option value="safety">Safety Contact Email</option><option value="hr">HR Contact Email</option><option value="billing">Billing Contact Email</option></select></label>
            <label style="grid-column:1/-1"><span>Subject</span><input name="subject" maxlength="180" required></label>
            <label style="grid-column:1/-1"><span>Message</span><textarea name="body" rows="4" maxlength="5000" required></textarea></label>
          </div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Queue Notice</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Action Center</h2><span>Live operational items generated from testing, MRO, compliance, RTD, training, credentials, post-accident, documents, and delivery failures.</span></div></div>
        <div class="card-body">${table(['Priority','Type','Item','Due','Status','Portal'],actions.map(a=>`<tr>
          <td><span class="badge ${a.priority==='critical'?'danger':a.priority==='high'?'warning':'neutral'}">${esc(pretty(a.priority))}</span></td>
          <td>${esc(pretty(a.type))}</td><td><strong>${esc(a.title)}</strong><br><small>${esc(a.detail||'')}</small></td>
          <td>${esc(fmtDT(a.due_at))}</td><td>${esc(pretty(a.status))}</td><td>${esc(a.url||'—')}</td>
        </tr>`).join(''),'No open action-center items.')}</div>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Notification History</h2><span>Queue and delivery status for notices scoped to this Employer.</span></div></div>
        <div class="card-body">${table(['Queued','Event','Channel','Recipient','Subject','Status','Failure','Actions'],notifications.map(n=>`<tr>
          <td>${esc(fmtDT(n.queued_at))}</td><td>${esc(pretty(n.event_type))}</td><td>${esc(pretty(n.channel))}</td><td>${esc(n.recipient_address||n.recipient_user_id||'In-App')}</td>
          <td>${esc(n.subject||'—')}</td><td>${esc(pretty(n.status))}</td><td>${esc(n.failure_reason||'—')}</td>
          <td>${n.status==='queued'?`<button class="org-action" data-cancel-notice="${esc(n.id)}" type="button">Cancel</button>`:'—'}</td>
        </tr>`).join(''),'No notifications for this Employer.')}</div>
      </section>`;

    const form=root.querySelector('#adminEmployerNoticeForm');
    const channel=form.elements.channel,recipient=form.elements.recipient_kind;
    const adjust=()=>{const email=channel.value==='email';[...recipient.options].forEach(o=>{const isEmail=['primary','safety','hr','billing'].includes(o.value);o.hidden=email?!isEmail:isEmail});if(email&&!['primary','safety','hr','billing'].includes(recipient.value))recipient.value='primary';if(!email&&['primary','safety','hr','billing'].includes(recipient.value))recipient.value='employer_admins'};
    channel.onchange=adjust;adjust();
    form.onsubmit=async ev=>{ev.preventDefault();try{status('Queueing Employer notice…');const r=await notificationApi({action:'queue_notice',employer_id:employerId,notice:formData(form)});status(`${r.count||0} notice(s) queued.`,'success');await load()}catch(e){status(e.message,'error')}};
    root.querySelectorAll('[data-cancel-notice]').forEach(btn=>btn.onclick=async()=>{if(!window.confirm('Cancel this queued notification?'))return;try{await notificationApi({action:'cancel_notification',employer_id:employerId,notification_id:btn.dataset.cancelNotice});status('Queued notification cancelled.','success');await load()}catch(e){status(e.message,'error')}});
  };
  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderAudit(){
  const root=$('#managementContent'),today=new Date(),prior=new Date(today.getTime()-90*86400000),date=x=>x.toISOString().slice(0,10);
  root.innerHTML=`<form id="adminAuditFilter" class="saas-form"><div class="saas-form-grid"><label><span>Start Date</span><input name="start_date" type="date" value="${date(prior)}"></label><label><span>End Date</span><input name="end_date" type="date" value="${date(today)}"></label></div><div class="saas-actions"><button class="btn btn-orange">Load Audit History</button></div></form><div id="adminAuditResults" style="margin-top:18px"><div class="management-empty">Choose a reporting period.</div></div>`;
  const form=root.querySelector('#adminAuditFilter'),out=root.querySelector('#adminAuditResults');
  const load=async()=>{try{const x=formData(form);status('Loading Employer audit history…');const d=await reportingApi({action:'audit_history',employer_id:employerId,...x}),rows=d.audit_events||[];out.innerHTML=`<div class="management-stat-grid" style="margin-bottom:18px"><div class="management-stat"><strong>${rows.length}</strong><span>Audit Events</span></div><div class="management-stat"><strong>${new Set(rows.map(r=>r.actor_user_id).filter(Boolean)).size}</strong><span>Actors</span></div><div class="management-stat"><strong>${new Set(rows.map(r=>r.resource_type)).size}</strong><span>Resource Types</span></div></div>${table(['Date / Time','Actor','Action','Resource','Resource ID'],rows.map(a=>`<tr><td>${esc(fmtDT(a.event_at))}</td><td>${esc(a.actor_name||'System')}</td><td><strong>${esc(pretty(a.action))}</strong></td><td>${esc(pretty(a.resource_type))}</td><td>${esc(a.resource_id||'—')}</td></tr>`).join(''),'No audit events in this period.')}`;status('Audit history loaded.','success')}catch(e){out.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')}};
  form.onsubmit=ev=>{ev.preventDefault();load()};load();
}
function renderAccess(derOnly=false){
  const root=$('#managementContent');
  const allowed=derOnly?['der','supervisor']:['employer_admin','der','supervisor','hr_admin'];
  const members=(detail.members||[]).filter(x=>!derOnly||allowed.includes(x.roles?.code));
  const roleOptions=(detail.roles||[]).filter(r=>allowed.includes(r.code));
  root.innerHTML=`
    ${editor(derOnly?'Invite DER / Supervisor':'Invite Employer User',[
      {name:'first_name',label:'First Name'},{name:'last_name',label:'Last Name'},
      {name:'email',label:'Email',type:'email',required:true},
      {name:'role_code',label:'Role',type:'select',options:allowed.map(v=>({value:v,label:pretty(v)}))}
    ],'Send Invite')}
    ${table(['User','Email','Role','Access Status','Primary','Action'],members.map(x=>`<tr>
      <td><strong>${esc([x.profiles?.first_name,x.profiles?.last_name].filter(Boolean).join(' ')||x.profiles?.display_name||'Account User')}</strong></td>
      <td>${esc(x.profiles?.email||'—')}</td>
      <td><select data-member-role="${esc(x.id)}">${roleOptions.map(r=>`<option value="${esc(r.id)}" ${r.id===x.role_id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></td>
      <td><select data-member-status="${esc(x.id)}">${['active','suspended','revoked'].map(v=>`<option value="${v}" ${x.status===v?'selected':''}>${esc(pretty(v))}</option>`).join('')}</select></td>
      <td>${x.is_primary?'Yes':'No'}</td>
      <td><button class="org-action" type="button" data-save-member="${esc(x.id)}">Save</button></td>
    </tr>`).join(''),'No account users.')}`;
  const inviteForm=root.querySelector('form');
  inviteForm.onsubmit=async ev=>{ev.preventDefault();try{await accessApi({action:'invite_member',employer_id:employerId,member:formData(inviteForm)});status('User invitation sent.','success');inviteForm.reset();await refresh()}catch(e){status(e.message,'error')}};
  root.querySelectorAll('[data-save-member]').forEach(btn=>btn.addEventListener('click',async()=>{
    const id=btn.dataset.saveMember,role_id=root.querySelector(`[data-member-role="${id}"]`)?.value,statusValue=root.querySelector(`[data-member-status="${id}"]`)?.value;
    try{await accessApi({action:'save_member',employer_id:employerId,member:{id,role_id,status:statusValue}});status('Account access updated.','success');await refresh()}catch(e){status(e.message,'error')}
  }));
}
function renderPools(){
  const root=$('#managementContent');
  root.innerHTML=`<div class="management-empty">Loading random pools and pool membership…</div>`;

  const load=async()=>{
    const w=await poolApi({action:'pool_management',employer_id:employerId});
    const programs=w.programs||[];
    const pools=w.pools||[];
    const employees=w.employees||[];
    const enrollments=w.employee_programs||[];
    const memberships=w.memberships||[];
    const counts=new Map();
    memberships.forEach(m=>counts.set(m.pool_id,(counts.get(m.pool_id)||0)+1));

    root.innerHTML=`
      <section class="admin-inline-editor">
        <div class="ctpa-editor-head"><div><h3 id="poolEditorTitle">Create Employer Random Pool</h3><p>Admin controls the same pool records shown in the Employer portal. DOT pool rates are taken from the active regulatory rule when one is configured.</p></div></div>
        <form class="saas-form" id="adminPoolForm">
          <input type="hidden" name="id">
          <div class="saas-form-grid">
            <label><span>Pool Name *</span><input name="name" required></label>
            <label><span>Program *</span><select name="program_id" required><option value="">Choose program</option>${programs.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(pretty(x.program_type))}${x.dot_agency?` / ${esc(x.dot_agency)}`:''}</option>`).join('')}</select></label>
            <label><span>Effective Date *</span><input name="effective_date" type="date" required></label>
            <label><span>Selection Schedule</span><select name="selection_schedule">${['monthly','quarterly','semiannual','annual'].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}</select></label>
            <label><span>Drug Testing Rate %</span><input name="drug_testing_rate" type="number" min="0" max="100" step="0.01"></label>
            <label><span>Alcohol Testing Rate %</span><input name="alcohol_testing_rate" type="number" min="0" max="100" step="0.01"></label>
            <label><span>Status</span><select name="status">${['draft','active','suspended','inactive','archived'].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}</select></label>
          </div>
          <div class="saas-actions"><button class="btn btn-outline" id="clearPoolEditor" type="button">Clear</button><button class="btn btn-orange" type="submit">Save Pool</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Employer Random Pools</h2><span>Pool configuration is administered here and reflected immediately in the Employer portal.</span></div></div>
        <div class="card-body" id="adminPoolsTable"></div>
      </section>

      <section class="admin-inline-editor" style="margin-top:18px">
        <div class="ctpa-editor-head"><div><h3 id="membershipEditorTitle">Pool Membership</h3><p>An employee must have an active enrollment in the selected pool's program before becoming eligible.</p></div></div>
        <form class="saas-form" id="adminPoolMembershipForm">
          <input type="hidden" name="id">
          <div class="saas-form-grid">
            <label><span>Random Pool *</span><select name="pool_id" required><option value="">Choose pool</option>${pools.filter(x=>x.status!=='archived').map(x=>`<option value="${esc(x.id)}">${esc(x.name)} — ${esc(pretty(x.program_type))}${x.dot_agency?` / ${esc(x.dot_agency)}`:''}</option>`).join('')}</select></label>
            <label><span>Employee / Driver *</span><select name="employee_id" required><option value="">Choose pool first</option></select></label>
            <label><span>Effective Date *</span><input name="effective_date" type="date" required></label>
            <label><span>Eligibility</span><select name="eligibility_status">${['pending','eligible','ineligible'].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}</select></label>
            <label style="grid-column:1/-1"><span>Ineligible Reason</span><input name="ineligible_reason" placeholder="Required only when marked ineligible"></label>
          </div>
          <div class="saas-actions"><button class="btn btn-outline" id="clearMembershipEditor" type="button">Clear</button><button class="btn btn-orange" type="submit">Save Membership</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Current Pool Membership</h2><span>Eligibility status is the population basis used by the random selection workflow.</span></div></div>
        <div class="card-body" id="adminMembershipTable"></div>
      </section>`;

    const poolTable=root.querySelector('#adminPoolsTable');
    poolTable.innerHTML=table(['Pool','Program','Type','Agency','Drug Rate','Alcohol Rate','Schedule','Members','Status','Action'],pools.map(x=>{
      const program=programs.find(p=>p.id===x.program_id);
      return `<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(program?.name||'—')}</td><td>${esc(pretty(x.program_type))}</td><td>${esc(x.dot_agency||'—')}</td><td>${x.drug_testing_rate==null?'—':esc(x.drug_testing_rate)+'%'}</td><td>${x.alcohol_testing_rate==null?'—':esc(x.alcohol_testing_rate)+'%'}</td><td>${esc(pretty(x.selection_schedule||'—'))}</td><td>${counts.get(x.id)||0}</td><td><span class="ctpa-status-pill ${x.status==='active'?'is-good':x.status==='suspended'?'is-warn':x.status==='archived'?'is-danger':'is-info'}">${esc(pretty(x.status))}</span></td><td><button class="org-action" type="button" data-edit-pool="${esc(x.id)}">Edit</button></td></tr>`;
    }).join(''),'No random pools configured.');

    const memberTable=root.querySelector('#adminMembershipTable');
    memberTable.innerHTML=table(['Employee','Pool','Program','Effective','Eligibility','Reason','Action'],memberships.map(m=>{
      const employee=m.employees||employees.find(e=>e.id===m.employee_id);
      const pool=m.random_pools||pools.find(p=>p.id===m.pool_id);
      const program=programs.find(p=>p.id===pool?.program_id);
      return `<tr><td><strong>${esc(employeeName(employee))}</strong><small style="display:block;color:var(--muted)">${esc(employee?.employee_number||employee?.job_title||'')}</small></td><td>${esc(pool?.name||'—')}</td><td>${esc(program?.name||'—')}</td><td>${esc(fmt(m.effective_date))}</td><td><span class="ctpa-status-pill ${m.eligibility_status==='eligible'?'is-good':m.eligibility_status==='ineligible'?'is-danger':'is-warn'}">${esc(pretty(m.eligibility_status))}</span></td><td>${esc(m.ineligible_reason||'—')}</td><td><div class="management-actions"><button class="org-action" type="button" data-edit-membership="${esc(m.id)}">Edit</button><button class="org-action danger" type="button" data-remove-membership="${esc(m.id)}">Remove</button></div></td></tr>`;
    }).join(''),'No current pool memberships.');

    const poolForm=root.querySelector('#adminPoolForm');
    const memberForm=root.querySelector('#adminPoolMembershipForm');
    const today=new Date().toISOString().slice(0,10);
    poolForm.elements.effective_date.value=today;
    memberForm.elements.effective_date.value=today;

    const clearPool=()=>{poolForm.reset();poolForm.elements.id.value='';poolForm.elements.effective_date.value=today;root.querySelector('#poolEditorTitle').textContent='Create Employer Random Pool';};
    root.querySelector('#clearPoolEditor').onclick=clearPool;
    poolTable.querySelectorAll('[data-edit-pool]').forEach(btn=>btn.onclick=()=>{
      const x=pools.find(p=>p.id===btn.dataset.editPool);if(!x)return;
      fillForm(poolForm,x);root.querySelector('#poolEditorTitle').textContent=`Edit ${x.name}`;
      window.scrollTo({top:root.offsetTop-90,behavior:'smooth'});
    });
    poolForm.onsubmit=async ev=>{ev.preventDefault();try{
      const pool=formData(poolForm);
      status(pool.id?'Updating random pool…':'Creating random pool…');
      const r=await poolApi({action:'save_pool',employer_id:employerId,pool});
      status(r.regulatory_rate_applied?'Random pool saved. Current DOT regulatory rates were applied.':'Random pool saved.','success');
      await load();
    }catch(e){status(e.message,'error')}};

    const poolSelect=memberForm.elements.pool_id;
    const employeeSelect=memberForm.elements.employee_id;
    const updateEmployeeOptions=()=>{
      const pool=pools.find(x=>x.id===poolSelect.value);
      employeeSelect.replaceChildren();
      const first=document.createElement('option');first.value='';first.textContent=pool?'Choose eligible program enrollee':'Choose pool first';employeeSelect.append(first);
      if(!pool)return;
      const enrolled=new Set(enrollments.filter(x=>x.program_id===pool.program_id&&x.status==='active').map(x=>x.employee_id));
      employees.filter(e=>enrolled.has(e.id)).forEach(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=`${employeeName(e)}${e.employee_number?' · '+e.employee_number:''} · ${pretty(e.employment_status)}`;employeeSelect.append(o)});
    };
    poolSelect.onchange=updateEmployeeOptions;
    const clearMembership=()=>{memberForm.reset();memberForm.elements.id.value='';memberForm.elements.effective_date.value=today;root.querySelector('#membershipEditorTitle').textContent='Pool Membership';updateEmployeeOptions();};
    root.querySelector('#clearMembershipEditor').onclick=clearMembership;
    memberTable.querySelectorAll('[data-edit-membership]').forEach(btn=>btn.onclick=()=>{
      const m=memberships.find(x=>x.id===btn.dataset.editMembership);if(!m)return;
      poolSelect.value=m.pool_id;updateEmployeeOptions();employeeSelect.value=m.employee_id;
      memberForm.elements.id.value=m.id;memberForm.elements.effective_date.value=m.effective_date||today;memberForm.elements.eligibility_status.value=m.eligibility_status||'eligible';memberForm.elements.ineligible_reason.value=m.ineligible_reason||'';
      root.querySelector('#membershipEditorTitle').textContent=`Edit ${employeeName(m.employees)}`;
      memberForm.scrollIntoView({behavior:'smooth',block:'center'});
    });
    memberForm.onsubmit=async ev=>{ev.preventDefault();try{
      const membership=formData(memberForm);
      status('Saving pool membership…');
      await poolApi({action:'save_membership',employer_id:employerId,membership});
      status('Pool membership saved.','success');
      await load();
    }catch(e){status(e.message,'error')}};
    memberTable.querySelectorAll('[data-remove-membership]').forEach(btn=>btn.onclick=async()=>{
      const reason=window.prompt('Reason for removing this employee / driver from the pool:','Removed by screenings4u Admin');
      if(reason===null)return;
      try{btn.disabled=true;await poolApi({action:'remove_pool_member',employer_id:employerId,membership_id:btn.dataset.removeMembership,reason});status('Pool member removed.','success');await load()}catch(e){status(e.message,'error')}finally{btn.disabled=false}
    });
  };

  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderSelections(){
  const root=$('#managementContent');
  root.innerHTML='<div class="management-empty">Loading random-selection workspace…</div>';

  const load=async()=>{
    const w=await selectionApi({action:'workspace',employer_id:employerId});
    const pools=w.pools||[],events=w.events||[],selected=w.selected||[],orders=w.orders||[],notices=w.notices||[],summary=w.pool_summary||[];
    const summaryMap=new Map(summary.map(x=>[x.pool_id,x]));
    const poolMap=new Map(pools.map(x=>[x.id,x]));
    const eventSelected=id=>selected.filter(x=>x.selection_event_id===id);
    const eventOrders=id=>{
      const ids=new Set(eventSelected(id).map(x=>x.id));
      return orders.filter(x=>ids.has(x.selection_member_id));
    };
    const eventNotices=id=>notices.filter(x=>x.related_id===id);
    const activePools=pools.filter(x=>x.status==='active');
    const totalEligible=summary.reduce((n,x)=>n+Number(x.eligible_members||0),0);
    const withoutOrders=events.filter(ev=>eventSelected(ev.id).some(m=>!orders.some(o=>o.selection_member_id===m.id))).length;

    root.innerHTML=`
      <div class="management-stat-grid" style="margin-bottom:18px">
        <div class="management-stat"><strong>${activePools.length}</strong><span>Active Pools</span></div>
        <div class="management-stat"><strong>${totalEligible}</strong><span>Eligible Pool Memberships</span></div>
        <div class="management-stat"><strong>${events.length}</strong><span>Locked Selection Events</span></div>
        <div class="management-stat"><strong>${withoutOrders}</strong><span>Events Needing Orders</span></div>
      </div>

      <section class="admin-inline-editor">
        <div class="management-section-head">
          <div>
            <h3>Run Random Selection</h3>
            <p>Selections are run from the current eligible population snapshot and locked for audit history. The same employee may be selected for both drug and alcohol testing.</p>
          </div>
        </div>
        <form id="adminSelectionForm" class="saas-form">
          <div class="saas-form-grid">
            <label><span>Active Random Pool *</span><select name="pool_id" required><option value="">Choose pool</option>${activePools.map(p=>{const s=summaryMap.get(p.id)||{};return `<option value="${esc(p.id)}">${esc(p.name)} — ${esc(p.programs?.name||pretty(p.program_type))} — ${Number(s.eligible_members||0)} eligible</option>`}).join('')}</select></label>
            <label><span>Drug Selection Count</span><input name="drug_count" type="number" min="0" step="1" value="0"></label>
            <label><span>Alcohol Selection Count</span><input name="alcohol_count" type="number" min="0" step="1" value="0"></label>
          </div>
          <div id="selectionPoolHelp" class="saas-notice" style="margin-top:12px">Choose an active pool to review its eligible population and testing rates.</div>
          <div class="saas-actions"><button class="btn btn-orange" type="submit">Run & Lock Selection</button></div>
        </form>
      </section>

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Selection History</h2><span>Locked random-selection events controlled through screenings4u Admin.</span></div></div>
        <div class="card-body">
          ${table(['Date','Pool','Population','Drug','Alcohol','Selected','Orders','Notice','Actions'],events.map(ev=>{
            const p=poolMap.get(ev.pool_id),members=eventSelected(ev.id),eventOrderRows=eventOrders(ev.id),eventNoticeRows=eventNotices(ev.id);
            const orderComplete=members.length>0&&eventOrderRows.length>=members.length;
            const notice=eventNoticeRows[0];
            return `<tr>
              <td>${esc(fmtDT(ev.selection_date))}</td>
              <td><strong>${esc(p?.name||ev.random_pools?.name||'—')}</strong><br><small>${esc(p?.programs?.name||pretty(p?.program_type||''))}</small></td>
              <td>${Number(ev.population_size||0)}</td>
              <td>${Number(ev.drug_selection_count||0)}</td>
              <td>${Number(ev.alcohol_selection_count||0)}</td>
              <td>${members.length}</td>
              <td><span class="badge ${orderComplete?'success':'warning'}">${eventOrderRows.length}/${members.length}</span></td>
              <td><span class="badge ${notice?.status==='sent'||notice?.status==='delivered'?'success':notice?'warning':'neutral'}">${esc(notice?pretty(notice.status):'Not Queued')}</span></td>
              <td><div class="row-actions">
                ${button('View',`data-view-selection="${ev.id}"`)}
                ${!orderComplete?button('Create Testing Orders',`data-create-selection-orders="${ev.id}"`):''}
                ${button('CSV',`data-selection-csv="${ev.id}"`)} ${button('PDF',`data-selection-pdf="${ev.id}"`)} ${button('Email Employer / DER',`data-send-selection-notice="${ev.id}"`)}
              </div></td>
            </tr>`;
          }).join(''),'No selection events have been run for this Employer.')}
        </div>
      </section>

      <section id="selectionDetailPanel" class="admin-inline-editor" hidden>
        <div class="management-section-head"><div><h3 id="selectionDetailTitle">Selection Details</h3><p id="selectionDetailMeta"></p></div></div>
        <div id="selectionDetailBody"></div>
      </section>`;

    const blobDownload=(content,name,type)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    const sendSelectionNotice=async id=>{try{status('Sending branded selection email to the Employer / DER…');const r=await selectionDeliveryApi({action:'send_notice',employer_id:employerId,selection_event_id:id});status(`Random-selection email sent to ${r.recipient}.`,'success');await load()}catch(e){status(e.message,'error')}};
    const downloadSelectionCsv=async id=>{try{const r=await selectionDeliveryApi({action:'report',employer_id:employerId,selection_event_id:id});blobDownload(r.content,r.file_name||'random-selection.csv',r.mime_type||'text/csv')}catch(e){status(e.message,'error')}};
    const downloadSelectionPdf=async id=>{try{const r=await pdfApi({action:'selection',selection_event_id:id,employer_id:employerId});downloadBase64File(r.base64,r.filename,r.mime_type)}catch(e){status(e.message,'error')}};
    const form=root.querySelector('#adminSelectionForm');
    const poolSelect=form.elements.pool_id,help=root.querySelector('#selectionPoolHelp');
    const updateHelp=()=>{
      const p=poolMap.get(poolSelect.value),s=summaryMap.get(poolSelect.value);
      if(!p){help.textContent='Choose an active pool to review its eligible population and testing rates.';return;}
      help.textContent=`${s?.eligible_members||0} eligible of ${s?.current_members||0} current pool member(s) · Drug rate ${p.drug_testing_rate??'—'}% · Alcohol rate ${p.alcohol_testing_rate??'—'}% · ${pretty(p.selection_schedule)} schedule.`;
      form.elements.drug_count.max=String(s?.eligible_members||0);
      form.elements.alcohol_count.max=String(s?.eligible_members||0);
    };
    poolSelect.onchange=updateHelp;

    form.onsubmit=async ev=>{
      ev.preventDefault();
      const x=formData(form),pool=poolMap.get(x.pool_id),s=summaryMap.get(x.pool_id);
      const drug=Number(x.drug_count||0),alcohol=Number(x.alcohol_count||0);
      if(!pool)return status('Choose an active random pool.','error');
      if(drug<0||alcohol<0||drug+alcohol<1)return status('Enter at least one drug or alcohol selection.','error');
      if(drug>Number(s?.eligible_members||0)||alcohol>Number(s?.eligible_members||0))return status(`Selection count cannot exceed the eligible population (${s?.eligible_members||0}).`,'error');
      if(!window.confirm(`Run and lock this random selection for ${pool.name}? This creates an immutable audit event from the current eligible population snapshot.`))return;
      try{
        status('Running secure random selection…');
        const r=await selectionApi({action:'run_selection',employer_id:employerId,pool_id:x.pool_id,drug_count:drug,alcohol_count:alcohol});
        status(`Random selection locked. ${r.selected?.length||0} employee / driver record(s) selected.`,'success');
        await load();
      }catch(e){status(e.message,'error')}
    };

    root.querySelectorAll('[data-view-selection]').forEach(btn=>btn.onclick=()=>{
      const id=btn.dataset.viewSelection,ev=events.find(x=>x.id===id),p=poolMap.get(ev?.pool_id),members=eventSelected(id),eventOrderRows=eventOrders(id),eventNoticeRows=eventNotices(id);
      const orderMap=new Map(eventOrderRows.map(x=>[x.selection_member_id,x]));
      const panel=root.querySelector('#selectionDetailPanel');
      panel.hidden=false;
      panel.querySelector('#selectionDetailTitle').textContent=`${p?.name||'Random Pool'} · ${fmtDT(ev.selection_date)}`;
      panel.querySelector('#selectionDetailMeta').textContent=`${detail.employer.workforce_display_name||detail.employer.legal_name} · DER ${detail.employer.safety_manager_name||detail.employer.primary_contact_name||'Not configured'} · Population snapshot: ${ev.population_size||0} · ${members.length} selected employee / driver record(s) · Randomization ${ev.randomization_version||'locked'}`;
      panel.querySelector('#selectionDetailBody').innerHTML=`
        ${table(['Employee / Driver','Employee #','Test Type','Employment','Testing Order','Order Status'],members.map(m=>{const o=orderMap.get(m.id);return `<tr><td><strong>${esc(employeeName(m.employees))}</strong></td><td>${esc(m.employees?.employee_number||'—')}</td><td>${esc(pretty(m.test_type))}</td><td>${esc(pretty(m.employees?.employment_status))}</td><td>${esc(o?.order_number||'Not created')}</td><td>${esc(o?pretty(o.status):'—')}</td></tr>`}).join(''),'No selected employees.')}
        <div class="management-actions">
          ${members.some(m=>!orderMap.has(m.id))?button('Create Missing Testing Orders',`data-detail-create-orders="${id}"`):''}
          ${button('Download CSV',`data-detail-csv="${id}"`)} ${button('Download PDF',`data-detail-pdf="${id}"`)} ${button('Email Employer / DER',`data-detail-send-notice="${id}"`)}
        </div>`;
      panel.querySelector('[data-detail-create-orders]')?.addEventListener('click',async()=>{try{status('Creating testing orders…');const r=await selectionApi({action:'create_testing_orders',employer_id:employerId,selection_event_id:id});status(`${r.created_count||0} testing order(s) created; ${r.existing_count||0} already existed.`,'success');await load()}catch(e){status(e.message,'error')}});
      panel.querySelector('[data-detail-send-notice]')?.addEventListener('click',()=>sendSelectionNotice(id));panel.querySelector('[data-detail-csv]')?.addEventListener('click',()=>downloadSelectionCsv(id));panel.querySelector('[data-detail-pdf]')?.addEventListener('click',()=>downloadSelectionPdf(id));
      panel.scrollIntoView({behavior:'smooth',block:'center'});
    });

    root.querySelectorAll('[data-create-selection-orders]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;status('Creating testing orders…');const r=await selectionApi({action:'create_testing_orders',employer_id:employerId,selection_event_id:btn.dataset.createSelectionOrders});status(`${r.created_count||0} testing order(s) created; ${r.existing_count||0} already existed.`,'success');await load()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
    root.querySelectorAll('[data-send-selection-notice]').forEach(btn=>btn.onclick=()=>sendSelectionNotice(btn.dataset.sendSelectionNotice));root.querySelectorAll('[data-selection-csv]').forEach(btn=>btn.onclick=()=>downloadSelectionCsv(btn.dataset.selectionCsv));root.querySelectorAll('[data-selection-pdf]').forEach(btn=>btn.onclick=()=>downloadSelectionPdf(btn.dataset.selectionPdf));
  };

  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderBilling(){
 const root=$('#managementContent'),rows=detail.invoices||[];
 root.innerHTML=`<section class="admin-inline-editor"><div class="management-section-head"><div><h3>Create Manual Invoice</h3><p>Create a draft invoice without fabricating payment status, then push it to the Employer portal.</p></div></div><form id="adminInvoiceForm" class="saas-form"><div class="saas-form-grid"><label><span>Description *</span><input name="description" required></label><label><span>Quantity</span><input name="quantity" type="number" min="1" step="1" value="1"></label><label><span>Unit Amount</span><input name="unit_amount" type="number" min="0" step="0.01" required></label><label><span>Tax</span><input name="tax" type="number" min="0" step="0.01" value="0"></label><label><span>Credits</span><input name="credits" type="number" min="0" step="0.01" value="0"></label><label><span>Due At</span><input name="due_at" type="datetime-local"></label><label style="grid-column:1/-1"><span>Notes</span><textarea name="notes" rows="3"></textarea></label></div><div class="saas-actions"><button class="btn btn-orange">Create Draft Invoice</button></div></form></section><section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Invoices & Payments</h2><span>Paid status appears only when recorded by the billing/payment workflow.</span></div></div><div class="card-body">${table(['Invoice','Created','Due','Total','Paid','Status','Actions'],rows.map(x=>`<tr><td><strong>${esc(x.invoice_number||x.id)}</strong></td><td>${esc(fmt(x.created_at))}</td><td>${esc(fmtDT(x.due_at))}</td><td>${money(x.total??x.amount_due,x.currency)}</td><td>${money(x.amount_paid,x.currency)}</td><td>${esc(pretty(x.status))}</td><td>${x.status==='draft'?`<button class="org-action" data-push-invoice="${esc(x.id)}" type="button">Push to Employer</button>`:'—'}</td></tr>`).join(''),'No invoices.')}</div></section>`;
 const f=root.querySelector('#adminInvoiceForm');f.onsubmit=async ev=>{ev.preventDefault();const x=formData(f);try{await actionApi({action:'save_invoice',employer_id:employerId,subscription_id:detail.subscription?.id||null,invoice:{items:[{description:x.description,quantity:Number(x.quantity||1),unit_amount:Number(x.unit_amount||0)}],tax:Number(x.tax||0),credits:Number(x.credits||0),due_at:x.due_at||null,notes:x.notes||null}});status('Draft invoice created.','success');await refresh()}catch(e){status(e.message,'error')}};
 root.querySelectorAll('[data-push-invoice]').forEach(btn=>btn.onclick=async()=>{try{await actionApi({action:'push_invoice',employer_id:employerId,invoice_id:btn.dataset.pushInvoice});status('Invoice pushed to Employer account.','success');await refresh()}catch(e){status(e.message,'error')}});
}
function renderSettings(){const root=$('#managementContent'),pf=new Map((detail.plan_features||[]).map(x=>[x.feature_id,x])),ov=new Map((detail.overrides||[]).map(x=>[x.feature_id,x]));root.innerHTML=`<div class="feature-grid">${(detail.features||[]).filter(x=>x.employer_available!==false).map(f=>{const plan=!!pf.get(f.id)?.enabled,over=ov.get(f.id);const state=over?String(!!over.enabled):'inherit';return `<div class="feature-row"><div><strong>${esc(f.name||f.code)}</strong><span>${esc(f.code)} · Plan ${plan?'enabled':'disabled'}</span></div><select data-feature="${f.id}"><option value="inherit" ${state==='inherit'?'selected':''}>Use Plan</option><option value="true" ${state==='true'?'selected':''}>Force Enabled</option><option value="false" ${state==='false'?'selected':''}>Force Disabled</option></select></div>`}).join('')}</div>`;$$('[data-feature]',root).forEach(sel=>sel.onchange=async()=>{try{await actionApi({action:'set_override',employer_id:employerId,feature_id:sel.dataset.feature,enabled:sel.value==='inherit'?null:sel.value==='true'});status('Feature access updated.','success')}catch(e){status(e.message,'error')}});}
function renderSupport(){const root=$('#managementContent'),c=detail.support_consent;root.innerHTML=`<div class="saas-notice"><strong>Employer-controlled support session.</strong> screenings4u Admin cannot enter the Employer portal until an Employer Admin or DER approves the request. Sessions expire automatically and are audit logged.</div>${c?`<div class="feature-row" style="margin-top:14px"><div><strong>Support Access</strong><span>${esc(pretty(c.status))}${c.expires_at?' · expires '+esc(fmtDT(c.expires_at)):''}${c.granted_by_name?' · approved by '+esc(c.granted_by_name):''}</span></div><div class="management-actions">${c.status==='granted'?button('Enter Employer Portal','data-enter-support')+button('Revoke Access','data-revoke-support'):''}${['requested','pending'].includes(String(c.status))?'<span class="badge warning">Awaiting Employer Approval</span>':''}</div></div>`:`<div class="management-empty">No support-access consent exists.</div><div class="management-actions">${button('Request Support Access','data-request-support')}</div>`}`;root.querySelector('[data-request-support]')?.addEventListener('click',async()=>{try{await actionApi({action:'request_support_consent',employer_id:employerId,scope:'support_only',reason:'screenings4u Admin requested temporary support access to assist this Employer.'});status('Support-access request sent to the Employer portal and email contact.','success');await refresh()}catch(e){status(e.message,'error')}});root.querySelector('[data-enter-support]')?.addEventListener('click',async()=>{try{status('Creating secure support session…');const r=await actionApi({action:'start_support_session',employer_id:employerId});if(!r.session?.url)throw new Error('Support-session URL was not returned.');status('Support session created. Opening Employer portal…','success');window.open(r.session.url,'_blank','noopener')}catch(e){status(e.message,'error')}});root.querySelector('[data-revoke-support]')?.addEventListener('click',async()=>{try{await actionApi({action:'revoke_support_consent',employer_id:employerId});status('Support access revoked and active sessions ended.','success');await refresh()}catch(e){status(e.message,'error')}});} 
function renderReports(){
  const root=$('#managementContent'),today=new Date(),prior=new Date(today.getTime()-365*86400000),date=x=>x.toISOString().slice(0,10);
  root.innerHTML=`<form id="adminReportFilter" class="saas-form"><div class="saas-form-grid"><label><span>Start Date</span><input name="start_date" type="date" value="${date(prior)}"></label><label><span>End Date</span><input name="end_date" type="date" value="${date(today)}"></label></div><div class="saas-actions"><button class="btn btn-orange">Run Reports</button><button class="btn btn-outline" id="adminAuditPacketBtn" type="button">Download Audit Packet PDF</button></div></form><div id="adminReportResults" style="margin-top:18px"><div class="management-empty">Run the report for this Employer.</div></div>`;
  const form=root.querySelector('#adminReportFilter'),out=root.querySelector('#adminReportResults');
  const load=async()=>{try{const x=formData(form);status('Building Employer reports…');const d=await reportingApi({action:'reports',employer_id:employerId,...x}),s=d.summary||{};out.innerHTML=`
    <div class="management-stat-grid" style="margin-bottom:18px">${[['Employees',s.employees],['Programs',s.programs],['Testing Orders',s.testing_orders],['Finalized Results',s.finalized_results],['Compliance Cases',s.compliance_cases],['Documents',s.documents],['Random Selections',s.selections],['Audit Events',s.audit_events]].map(([n,v])=>`<div class="management-stat"><strong>${v||0}</strong><span>${n}</span></div>`).join('')}</div>
    <section class="card"><div class="card-head"><div><h2>Testing Activity</h2><span>Orders created in the selected reporting period.</span></div></div><div class="card-body">${table(['Created','Order','Employee / Driver','Program','Reason','Test','Status'],(d.testing_orders||[]).map(o=>`<tr><td>${esc(fmtDT(o.created_at))}</td><td>${esc(o.order_number)}</td><td>${esc(employeeName(o.employees))}</td><td>${esc(o.programs?.name||'—')}</td><td>${esc(pretty(o.reason))}</td><td>${esc(pretty(o.test_type))}</td><td>${esc(pretty(o.status))}</td></tr>`).join(''),'No testing activity.')}</div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Compliance Cases</h2><span>Cases opened in the reporting period.</span></div></div><div class="card-body">${table(['Opened','Case','Employee / Driver','Event','Priority','Status','Clearinghouse'],(d.compliance_cases||[]).map(c=>`<tr><td>${esc(fmtDT(c.opened_at))}</td><td>${esc(c.case_number)}</td><td>${esc(employeeName(c.employees))}</td><td>${esc(pretty(c.event_type))}</td><td>${esc(pretty(c.priority))}</td><td>${esc(pretty(c.status))}</td><td>${esc(pretty(c.clearinghouse_status||'—'))}</td></tr>`).join(''),'No compliance cases.')}</div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Random Selection History</h2><span>Locked selection events in the reporting period.</span></div></div><div class="card-body">${table(['Date','Pool','Population','Drug','Alcohol','Status'],(d.selections||[]).map(x=>`<tr><td>${esc(fmtDT(x.selection_date))}</td><td>${esc(x.random_pools?.name||'—')}</td><td>${x.population_size||0}</td><td>${x.drug_selection_count||0}</td><td>${x.alcohol_selection_count||0}</td><td>${esc(pretty(x.status))}</td></tr>`).join(''),'No random selections.')}</div></section>`;status('Employer reports loaded.','success')}catch(e){out.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')}};
  form.onsubmit=ev=>{ev.preventDefault();load()};
  root.querySelector('#adminAuditPacketBtn').onclick=async()=>{try{const x=formData(form);status('Generating audit packet PDF…');const r=await reportingApi({action:'audit_packet',employer_id:employerId,...x});downloadBase64File(r.base64,r.filename,r.mime_type);status('Audit packet generated.','success')}catch(e){status(e.message,'error')}};load();
}
function renderPostAccident(type){
 const root=$('#managementContent'),rows=(detail.post_accidents||[]).filter(x=>x.program_type===type),programs=(detail.programs||[]).filter(x=>x.program_type===type),employees=detail.employees||[];
 root.innerHTML=`<section class="admin-inline-editor"><div class="management-section-head"><div><h3>Record ${type==='DOT'?'DOT':'Non-DOT'} Post-Accident Event</h3><p>The determination is stored with its rule/source. Required testing is then created through the shared Testing Orders workflow when the employee is enrolled in the selected program.</p></div></div><form id="adminPostAccidentForm" class="saas-form"><input type="hidden" name="program_type" value="${type}"><div class="saas-form-grid"><label><span>Employee / Driver *</span><select name="employee_id" required><option value="">Choose employee</option>${employees.map(e=>`<option value="${esc(e.id)}">${esc(employeeName(e))}</option>`).join('')}</select></label><label><span>Program *</span><select name="program_id" required><option value="">Choose program</option>${programs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}${p.dot_agency?` · ${esc(p.dot_agency)}`:''}</option>`).join('')}</select></label>${type==='DOT'?`<label><span>DOT Agency *</span><select name="dot_agency" required>${['FMCSA','FAA','FRA','FTA','PHMSA','USCG'].map(v=>`<option value="${v}">${v}</option>`).join('')}</select></label>`:''}<label><span>Occurred At *</span><input name="occurred_at" type="datetime-local" required></label><label><span>Location</span><input name="location_text"></label><label><span>Report Number</span><input name="report_number"></label><label class="config-choice"><span>Fatality</span><input name="fatality" type="checkbox"></label><label class="config-choice"><span>Injury / Treatment</span><input name="injury" type="checkbox"></label><label class="config-choice"><span>Disabling Tow</span><input name="tow" type="checkbox"></label><label class="config-choice"><span>Moving Citation</span><input name="citation" type="checkbox"></label><label style="grid-column:1/-1"><span>Description</span><textarea name="description" rows="3"></textarea></label></div><div class="saas-actions"><button class="btn btn-orange">Save Determination</button></div></form></section>${table(['Employee','Occurred','Agency','Testing Required','Drug','Alcohol','Status'],rows.map(x=>`<tr><td>${esc(employeeName(employees.find(e=>e.id===x.employee_id)))}</td><td>${esc(fmtDT(x.occurred_at))}</td><td>${esc(x.dot_agency||'—')}</td><td>${x.testing_required?'Yes':'No'}</td><td>${x.drug_test_required?'Yes':'No'}</td><td>${x.alcohol_test_required?'Yes':'No'}</td><td>${esc(pretty(x.status))}</td></tr>`).join(''),'No post-accident events.')}`;
 const f=root.querySelector('#adminPostAccidentForm');f.onsubmit=async ev=>{ev.preventDefault();const x=formData(f),decision={fatality:f.elements.fatality.checked?'yes':'no',injury:f.elements.injury.checked?'yes':'no',tow:f.elements.tow.checked?'yes':'no',citation:f.elements.citation.checked?'yes':'no',contribution:'no',faa_accident:f.elements.fatality.checked?'yes':'no',fra_event:f.elements.fatality.checked?'major_accident':'none',fra_exception:'no',phmsa_accident:f.elements.fatality.checked?'yes':'no',smi:f.elements.fatality.checked?'yes':'no',directly_involved:'yes',disabled_transit:f.elements.tow.checked?'yes':'no'};try{const r=await postAccidentApi({employer_id:employerId,event:{...x,decision_data:decision}});let note='';if(r.event?.testing_required){const tt=r.event.drug_test_required&&r.event.alcohol_test_required?'drug_and_alcohol':r.event.drug_test_required?'drug':'alcohol';try{await testApi({action:'create_order',employer_id:employerId,test:{employee_id:x.employee_id,program_id:x.program_id,reason:'post_accident',test_type:tt,collection_deadline:r.event.drug_test_deadline||r.event.alcohol_test_deadline||null}});note=' Testing order created.'}catch(oe){note=` Determination saved, but testing order was not created: ${oe.message}`}}status(`Post-accident determination saved.${note}`,note.includes('not created')?'error':'success');await refresh()}catch(e){status(e.message,'error')}};
}
function renderTestingConfig(){
 const root=$('#managementContent');root.innerHTML='<div class="management-empty">Loading customer-specific testing configuration…</div>';
 const load=async()=>{const w=await configApi({action:'workspace',employer_id:employerId}),defaults=w.order_defaults||[],services=w.orderable_services||[],labs=w.lab_accounts||[],catalog=w.laboratories||[],reporting=w.result_reporting||{},analytes=w.analytes||[],panels=w.panels||[],classification=w.employer?.workforce_classification||detail.employer?.workforce_classification||'NON_DOT';
 root.innerHTML=`<div class="saas-notice"><strong>${esc(classification.replace('_','-'))} customer:</strong> ${classification==='DOT'?'Federal DOT testing uses the locked DOT 5-Panel. Configure customer-specific laboratories, account numbers, order defaults, and notification delivery below.':'Build one or more customer-specific Non-DOT panels by selecting the analytes the customer orders.'}</div>
 <section class="admin-inline-editor"><div class="management-section-head"><div><h3>Testing Panels</h3><p>${classification==='DOT'?'DOT 5-Panel is federally standardized for this workflow.':'Create custom Non-DOT panels from the analyte catalog.'}</p></div></div><form id="panelForm" class="saas-form"><input type="hidden" name="id"><div class="saas-form-grid"><label><span>Panel Name</span><input name="name" value="${classification==='DOT'?'DOT 5-Panel':''}" ${classification==='DOT'?'readonly':''} required></label><label><span>Specimen Type</span><select name="specimen_type"><option value="urine">Urine</option><option value="oral_fluid">Oral Fluid</option><option value="hair">Hair</option><option value="blood">Blood</option></select></label></div><div class="analyte-grid">${analytes.map(a=>`<label class="analyte-choice"><input type="checkbox" name="analyte" value="${esc(a.code)}" ${classification==='DOT'&&['THC','COC','AMP','OPI','PCP'].includes(a.code)?'checked disabled':''}><span><strong>${esc(a.name||a.code)}</strong><small>${esc(a.category||a.code)}</small></span></label>`).join('')}</div><div class="saas-actions"><button class="btn btn-orange">${classification==='DOT'?'Ensure DOT 5-Panel':'Save Custom Panel'}</button></div></form><div class="panel-list">${panels.map(p=>`<div class="feature-row"><div><strong>${esc(p.name)}</strong><span>${esc(p.specimen_type)} · ${(p.analyte_codes||[]).map(esc).join(', ')}</span></div>${p.is_dot_federal?'<span class="badge success">Federal DOT</span>':`<button class="org-action danger" data-archive-panel="${p.id}">Archive</button>`}</div>`).join('')||'<div class="management-empty">No testing panels configured.</div>'}</div></section>
 <section class="admin-inline-editor"><div class="management-section-head"><div><h3>Result Reporting & Customer Notifications</h3><p>Select how this customer wants finalized results delivered. Email delivery is active; SMS requires an SMS provider connection.</p></div></div><form id="resultReportingForm" class="saas-form"><div class="saas-form-grid"><label><span>Notification Method</span><select name="notification_mode"><option value="email">Email</option><option value="sms">Text / SMS</option><option value="both">Email + Text / SMS</option></select></label><label><span>Result Recipient Email</span><input name="recipient_email" type="email" value="${esc(reporting.recipient_email||detail.employer.safety_manager_email||detail.employer.primary_contact_email||'')}"></label><label><span>Result Recipient Mobile</span><input name="recipient_mobile" value="${esc(reporting.recipient_mobile||'')}"></label></div><div class="saas-actions"><button class="btn btn-orange">Save Reporting Preferences</button></div></form></section>
 <section class="admin-inline-editor"><div class="management-section-head"><div><h3>Laboratory Accounts</h3><p>Add the laboratory and customer-specific account number used for this Employer. Each customer can have different laboratories.</p></div></div><form id="labAccountForm" class="saas-form"><div class="saas-form-grid"><label><span>Laboratory</span><select name="laboratory_id"><option value="">Unlinked / Other</option>${catalog.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></label><label><span>Account Name *</span><input name="name" required></label><label><span>Account Number / Code</span><input name="account_code"></label><label><span>Status</span><select name="status"><option value="active">Active</option><option value="inactive">Inactive</option></select></label><label class="config-choice"><span>Hide on Order</span><input name="hide_on_order" type="checkbox"></label></div><div class="saas-actions"><button class="btn btn-orange">Add Laboratory Account</button></div></form>${table(['Laboratory / Account','Account Number','Status','Order Visibility'],labs.map(x=>`<tr><td><strong>${esc(x.laboratories?.name||x.name)}</strong><small>${esc(x.name||'')}</small></td><td>${esc(x.account_code||'—')}</td><td>${esc(pretty(x.status))}</td><td>${x.hide_on_order?'Hidden':'Available'}</td></tr>`).join(''),'No Employer laboratory accounts configured.')}</section>
 <section class="admin-inline-editor"><div class="management-section-head"><div><h3>Order Defaults</h3><p>Customer-specific order form defaults.</p></div></div><form id="orderDefaultForm" class="saas-form"><div class="saas-form-grid"><label><span>Field Name</span><input name="field_name" required placeholder="Reason for Test"></label><label><span>Field Value</span><input name="field_value" required></label><label class="config-choice"><span>Show</span><input name="show" type="checkbox" checked></label><label class="config-choice"><span>Make Default</span><input name="make_default" type="checkbox"></label></div><div class="saas-actions"><button class="btn btn-orange">Save Default</button></div></form>${table(['Field','Value','Shown','Default'],defaults.map(x=>`<tr><td>${esc(x.field_name)}</td><td>${esc(x.field_value)}</td><td>${x.show?'Yes':'No'}</td><td>${x.make_default?'Yes':'No'}</td></tr>`).join(''),'No testing defaults configured.')}</section>
 <section class="admin-inline-editor"><div class="management-section-head"><div><h3>Orderable Services</h3><p>Configure the testing services this customer is allowed to order.</p></div></div><form id="serviceForm" class="saas-form"><div class="saas-form-grid"><label><span>Service Code</span><input name="service_code" required></label><label><span>Service Name</span><input name="name" required></label><label class="config-choice"><span>Orderable</span><input name="orderable" type="checkbox" checked></label><label class="config-choice"><span>Default</span><input name="is_default" type="checkbox"></label></div><div class="saas-actions"><button class="btn btn-orange">Add Service</button></div></form>${table(['Service','Code','Orderable','Default'],services.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.service_code)}</td><td>${x.orderable?'Yes':'No'}</td><td>${x.is_default?'Yes':'No'}</td></tr>`).join(''),'No Employer orderable services configured.')}</section>`;
 const pf=root.querySelector('#panelForm');if(reporting.notification_mode)root.querySelector('#resultReportingForm').elements.notification_mode.value=reporting.notification_mode;pf.onsubmit=async ev=>{ev.preventDefault();try{const f=formData(pf),codes=classification==='DOT'?['THC','COC','AMP','OPI','PCP']:[...pf.querySelectorAll('input[name=analyte]:checked')].map(x=>x.value);await configApi({action:'save_panel',employer_id:employerId,panel:{...f,program_type:classification,analyte_codes:codes}});status('Testing panel saved.','success');await load()}catch(e){status(e.message,'error')}};
 root.querySelectorAll('[data-archive-panel]').forEach(b=>b.onclick=async()=>{try{await configApi({action:'archive_panel',employer_id:employerId,panel_id:b.dataset.archivePanel});status('Testing panel archived.','success');await load()}catch(e){status(e.message,'error')}});
 const rf=root.querySelector('#resultReportingForm');rf.onsubmit=async ev=>{ev.preventDefault();try{await configApi({action:'save_lab_result_reporting',employer_id:employerId,config:formData(rf)});status('Result reporting preferences saved.','success');await load()}catch(e){status(e.message,'error')}};
 const lf=root.querySelector('#labAccountForm');lf.onsubmit=async ev=>{ev.preventDefault();try{const x=formData(lf);x.hide_on_order=lf.elements.hide_on_order.checked;await configApi({action:'save_lab_account',employer_id:employerId,account:x});status('Laboratory account saved.','success');await load()}catch(e){status(e.message,'error')}};
 const df=root.querySelector('#orderDefaultForm');df.onsubmit=async ev=>{ev.preventDefault();const x=formData(df);x.show=df.elements.show.checked;x.make_default=df.elements.make_default.checked;try{await configApi({action:'save_order_defaults',employer_id:employerId,items:[x]});status('Order default saved.','success');await load()}catch(e){status(e.message,'error')}};
 const sf=root.querySelector('#serviceForm');sf.onsubmit=async ev=>{ev.preventDefault();const x=formData(sf);x.orderable=sf.elements.orderable.checked;x.is_default=sf.elements.is_default.checked;try{await configApi({action:'save_orderable_services',employer_id:employerId,items:[x]});status('Orderable service saved.','success');await load()}catch(e){status(e.message,'error')}};
 };load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderDotAgencies(){
 const root=$('#managementContent'),assigned=new Map((detail.regulatory_agencies||[]).map(x=>[x.agency_code,x])),catalog=detail.agency_catalog||[];
 root.innerHTML=`<div class="saas-notice">Enable every DOT operating administration that applies to this Employer. Mark one enabled agency Primary when appropriate.</div><div class="management-table-wrap" style="margin-top:14px"><table class="management-table"><thead><tr><th>Agency</th><th>Name</th><th>Enabled</th><th>Primary</th><th>Account Identifier</th></tr></thead><tbody>${catalog.map(a=>{const x=assigned.get(a.code);return `<tr><td><strong>${esc(a.code)}</strong></td><td>${esc(a.name||'')}</td><td><input type="checkbox" data-agency-enabled="${esc(a.code)}" ${x&&x.status==='active'?'checked':''}></td><td><input type="radio" name="primaryAgency" value="${esc(a.code)}" ${x?.is_primary?'checked':''}></td><td><input data-agency-account="${esc(a.code)}" value="${esc(x?.account_identifier||'')}"></td></tr>`}).join('')}</tbody></table></div><div class="management-actions"><button id="saveDotAgencies" class="btn btn-orange" type="button">Save DOT Agencies</button></div>`;
 root.querySelector('#saveDotAgencies').onclick=async()=>{try{const primary=root.querySelector('input[name=primaryAgency]:checked')?.value||null,items=catalog.map(a=>({agency_code:a.code,enabled:!!root.querySelector(`[data-agency-enabled="${a.code}"]`)?.checked,is_primary:primary===a.code,account_identifier:root.querySelector(`[data-agency-account="${a.code}"]`)?.value||null}));if(primary&&!items.find(x=>x.agency_code===primary)?.enabled)throw new Error('The primary DOT agency must also be enabled.');await actionApi({action:'save_regulatory_agencies',employer_id:employerId,items});status('DOT agency assignments saved.','success');await refresh()}catch(e){status(e.message,'error')}};
}
function renderCurrent(){if(!detail)return;switch(file){case'employer-profile.html':return renderProfile();case'employer-subscription.html':return renderSubscription();case'employer-employees.html':return renderEmployees();case'employer-locations.html':return renderLocations();case'employer-dot-programs.html':return renderPrograms('DOT');case'employer-nondot-programs.html':return renderPrograms('NON_DOT');case'employer-testing.html':return renderTesting();case'employer-results.html':return renderResults();case'employer-compliance.html':return renderCompliance();case'employer-documents.html':return renderDocuments();case'employer-notifications.html':return renderNotifications();case'employer-audit.html':return renderAudit();case'employer-access.html':return renderAccess(false);case'employer-pools.html':return renderPools();case'employer-selections.html':return renderSelections();case'employer-settings.html':return renderSettings();case'employer-support-access.html':return renderSupport();case'employer-reports.html':return renderReports();case'employer-post-accidents.html':return renderPostAccident('DOT');case'employer-nondot-post-accidents.html':return renderPostAccident('NON_DOT');case'employer-testing-config.html':return renderTestingConfig();case'employer-dot-agencies.html':return renderDotAgencies();default:if($('#managementContent'))$('#managementContent').innerHTML='<div class="management-empty">This Admin Employer page is connected to the shared Employer account context.</div>';}}
async function refresh(){detail=await contextApi({action:'detail',employer_id:employerId});setContext();renderCurrent();}

await portalReady;
try{await loadDirectory();if(!requireEmployer()){}else{await loadDetail();renderCurrent();}}catch(e){console.error('Admin employer runtime',e);status(e.message,'error');}
