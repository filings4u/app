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
  directory.forEach(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.legal_name;o.selected=e.id===employerId;sel.append(o)});
  sel.onchange=()=>{if(!sel.value)return;employerId=sel.value;sessionStorage.setItem('s4u_admin_employer_id',employerId);const u=new URL(location.href);u.searchParams.set('employer_id',employerId);location.href=u.href;};
  if(!employerId&&directory.length===1){employerId=directory[0].id;sessionStorage.setItem('s4u_admin_employer_id',employerId);sel.value=employerId;}
}
async function loadDetail(){if(!employerId)return null;detail=await contextApi({action:'detail',employer_id:employerId});setContext();return detail;}
function requireEmployer(){const root=$('#managementContent');if(root&&!employerId)root.innerHTML='<div class="management-empty">Choose an employer above to load this Admin workspace.</div>';return !!employerId;}

function renderProfile(){fillForm($('#profileForm'),detail.employer);const f=$('#profileForm');if(!f)return;f.onsubmit=async ev=>{ev.preventDefault();try{status('Saving employer profile…');const r=await profileApi({action:'update',employer_id:employerId,profile:formData(f)});detail.employer=r.employer;fillForm(f,r.employer);setContext();status('Employer profile saved.','success')}catch(e){status(e.message,'error')}};}

function renderSubscription(){
  const s=detail.subscription||{},p=s.plans||{};
  $('#subscriptionSummary') && ($('#subscriptionSummary').innerHTML=`<div class="feature-grid"><div class="feature-row"><div><strong>Plan</strong><span>${esc(p.name||'No plan')}</span></div></div><div class="feature-row"><div><strong>Monthly Price</strong><span>${money(p.monthly_price||0)}</span></div></div><div class="feature-row"><div><strong>Status</strong><span>${esc(pretty(s.status))}</span></div></div><div class="feature-row"><div><strong>Renewal</strong><span>${esc(fmt(s.renewal_date))}</span></div></div></div>`);
  const ps=$('#planSelect'); if(ps){ps.replaceChildren();(detail.plans||[]).forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=`${x.name} — ${money(x.monthly_price)}`;o.selected=x.id===s.plan_id;ps.append(o)});}
  $('#subscriptionStatus') && ($('#subscriptionStatus').value=s.status||'');
  const pf=new Map((detail.plan_features||[]).map(x=>[x.feature_id,x]));const ov=new Map((detail.overrides||[]).map(x=>[x.feature_id,x]));
  const ent=$('#entitlements');if(ent)ent.innerHTML=(detail.features||[]).filter(x=>x.employer_available!==false).map(f=>{const plan=pf.get(f.id),over=ov.get(f.id);const enabled=over?!!over.enabled:!!plan?.enabled;return `<div class="feature-row"><div><strong>${esc(f.name||f.code)}</strong><span>${esc(f.category||'Feature')} · ${over?'Admin override':'Plan'}</span></div><span class="badge ${enabled?'success':'neutral'}">${enabled?'Enabled':'Disabled'}</span></div>`}).join('')||'<div class="management-empty">No Employer features are configured.</div>';
  $('#changePlanBtn')?.addEventListener('click',async()=>{try{await actionApi({action:'change_plan',employer_id:employerId,plan_id:ps.value});status('Plan assignment updated.','success');detail=await contextApi({action:'detail',employer_id:employerId});renderSubscription()}catch(e){status(e.message,'error')}});
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
          <td>${esc(fmtDT(a.last_sign_in_at))}</td><td><div class="management-actions">${buttons.join(' ')}</div></td>
        </tr>`}).join(''),'No employees or drivers.');
      box.querySelectorAll('[data-employee-invite]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;status('Creating Employee Portal access…');const r=await accessApi({action:'invite_employee',employer_id:employerId,employee_id:btn.dataset.employeeInvite});status(r.invited?'Employee Portal invitation sent.':'Existing login linked to the Employee Portal.','success');await renderAccess()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
      box.querySelectorAll('[data-employee-access]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;await accessApi({action:'set_employee_access',employer_id:employerId,employee_id:btn.dataset.employeeAccess,status:btn.dataset.state});status(`Employee Portal access ${btn.dataset.state}.`,'success');await renderAccess()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
      box.querySelectorAll('tr').forEach((row,i)=>{if(i===0)return;});
      box.querySelectorAll('tbody tr').forEach((row,i)=>{const e=rows[i];if(!e)return;const first=row.querySelector('td');first?.addEventListener('dblclick',()=>{fillForm(form,e);root.querySelector('#employeeEditorTitle').textContent=`Edit ${employeeName(e)}`;window.scrollTo({top:root.offsetTop-90,behavior:'smooth'});});});
    }catch(e){box.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')}
  };
  renderAccess();
}

function renderLocations(){const root=$('#managementContent');const rows=(detail.locations||[]).map(x=>`<tr><td><strong>${esc(x.name)}</strong></td><td>${esc(pretty(x.location_type))}</td><td>${esc([x.city,x.state].filter(Boolean).join(', ')||'—')}</td><td>${x.is_primary?'Yes':'No'}</td><td>${esc(pretty(x.status))}</td></tr>`).join('');root.innerHTML=editor('Add Location / Terminal',[{name:'name',label:'Name',required:true},{name:'location_type',label:'Type'},{name:'city',label:'City'},{name:'state',label:'State'},{name:'postal_code',label:'Postal Code'}],'Add Location')+table(['Location','Type','City / State','Primary','Status'],rows,'No locations configured.');root.querySelector('form').onsubmit=async ev=>{ev.preventDefault();try{await actionApi({action:'save_location',employer_id:employerId,location:formData(ev.currentTarget)});status('Location added.','success');await refresh()}catch(e){status(e.message,'error')}};}
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
        status(`Verified result finalized. Report ${r.report?.report_number||''} created.`,'success');await load();
      }catch(e){status(e.message,'error')}
    };
  };
  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderCompliance(){const root=$('#managementContent');root.innerHTML=table(['Case','Employee','Event','Priority','Status','Opened'],(detail.compliance_cases||[]).map(x=>`<tr><td><strong>${esc(x.case_number||'—')}</strong></td><td>${esc(employeeName(x.employees))}</td><td>${esc(pretty(x.event_type))}</td><td>${esc(pretty(x.priority))}</td><td>${esc(pretty(x.status))}</td><td>${esc(fmt(x.opened_at))}</td></tr>`).join(''),'No compliance cases.');}
function renderDocuments(){const root=$('#managementContent');root.innerHTML=table(['File','Type','Uploaded','Access'],(detail.documents||[]).map(x=>`<tr><td><strong>${esc(x.file_name)}</strong></td><td>${esc(pretty(x.document_type))}</td><td>${esc(fmtDT(x.uploaded_at))}</td><td>${esc(pretty(x.access_level))}</td></tr>`).join(''),'No documents.');}
function renderNotifications(){const root=$('#managementContent');root.innerHTML=table(['Queued','Event','Channel','Recipient','Subject','Status'],(detail.notifications||[]).map(x=>`<tr><td>${esc(fmtDT(x.queued_at))}</td><td>${esc(pretty(x.event_type))}</td><td>${esc(pretty(x.channel))}</td><td>${esc(x.recipient_address||'—')}</td><td>${esc(x.subject||'—')}</td><td>${esc(pretty(x.status))}</td></tr>`).join(''),'No notifications.');}
function renderAudit(){const root=$('#managementContent');root.innerHTML=table(['Date','Action','Resource','ID'],(detail.audit_events||[]).map(x=>`<tr><td>${esc(fmtDT(x.event_at))}</td><td><strong>${esc(pretty(x.action))}</strong></td><td>${esc(pretty(x.resource_type))}</td><td>${esc(x.resource_id||'—')}</td></tr>`).join(''),'No audit events.');}
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
                ${!notice?button('Queue Employer Notice',`data-queue-selection-notice="${ev.id}"`):''}
              </div></td>
            </tr>`;
          }).join(''),'No selection events have been run for this Employer.')}
        </div>
      </section>

      <section id="selectionDetailPanel" class="admin-inline-editor" hidden>
        <div class="management-section-head"><div><h3 id="selectionDetailTitle">Selection Details</h3><p id="selectionDetailMeta"></p></div></div>
        <div id="selectionDetailBody"></div>
      </section>`;

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
      panel.querySelector('#selectionDetailMeta').textContent=`Population snapshot: ${ev.population_size||0} · ${members.length} selected employee / driver record(s) · Randomization ${ev.randomization_version||'locked'}`;
      panel.querySelector('#selectionDetailBody').innerHTML=`
        ${table(['Employee / Driver','Employee #','Test Type','Employment','Testing Order','Order Status'],members.map(m=>{const o=orderMap.get(m.id);return `<tr><td><strong>${esc(employeeName(m.employees))}</strong></td><td>${esc(m.employees?.employee_number||'—')}</td><td>${esc(pretty(m.test_type))}</td><td>${esc(pretty(m.employees?.employment_status))}</td><td>${esc(o?.order_number||'Not created')}</td><td>${esc(o?pretty(o.status):'—')}</td></tr>`}).join(''),'No selected employees.')}
        <div class="management-actions">
          ${members.some(m=>!orderMap.has(m.id))?button('Create Missing Testing Orders',`data-detail-create-orders="${id}"`):''}
          ${!eventNoticeRows.length?button('Queue Employer Notice',`data-detail-queue-notice="${id}"`):''}
        </div>`;
      panel.querySelector('[data-detail-create-orders]')?.addEventListener('click',async()=>{try{status('Creating testing orders…');const r=await selectionApi({action:'create_testing_orders',employer_id:employerId,selection_event_id:id});status(`${r.created_count||0} testing order(s) created; ${r.existing_count||0} already existed.`,'success');await load()}catch(e){status(e.message,'error')}});
      panel.querySelector('[data-detail-queue-notice]')?.addEventListener('click',async()=>{try{status('Queueing Employer notice…');const r=await selectionApi({action:'create_selection_notice',employer_id:employerId,selection_event_id:id});status(r.already_exists?'Employer notice was already queued.':'Employer notice queued for the notification workflow.','success');await load()}catch(e){status(e.message,'error')}});
      panel.scrollIntoView({behavior:'smooth',block:'center'});
    });

    root.querySelectorAll('[data-create-selection-orders]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;status('Creating testing orders…');const r=await selectionApi({action:'create_testing_orders',employer_id:employerId,selection_event_id:btn.dataset.createSelectionOrders});status(`${r.created_count||0} testing order(s) created; ${r.existing_count||0} already existed.`,'success');await load()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
    root.querySelectorAll('[data-queue-selection-notice]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;status('Queueing Employer notice…');const r=await selectionApi({action:'create_selection_notice',employer_id:employerId,selection_event_id:btn.dataset.queueSelectionNotice});status(r.already_exists?'Employer notice was already queued.':'Employer notice queued for the notification workflow.','success');await load()}catch(e){status(e.message,'error')}finally{btn.disabled=false}});
  };

  load().catch(e=>{root.innerHTML=`<div class="management-empty">${esc(e.message)}</div>`;status(e.message,'error')});
}
function renderBilling(){const root=$('#managementContent');root.innerHTML=table(['Invoice','Created','Due','Paid','Status'],(detail.invoices||[]).map(x=>`<tr><td><strong>${esc(x.invoice_number||x.id)}</strong></td><td>${esc(fmt(x.created_at))}</td><td>${money(x.amount_due??x.total,x.currency)}</td><td>${money(x.amount_paid,x.currency)}</td><td>${esc(pretty(x.status))}</td></tr>`).join(''),'No invoices.');}
function renderSettings(){const root=$('#managementContent'),pf=new Map((detail.plan_features||[]).map(x=>[x.feature_id,x])),ov=new Map((detail.overrides||[]).map(x=>[x.feature_id,x]));root.innerHTML=`<div class="feature-grid">${(detail.features||[]).filter(x=>x.employer_available!==false).map(f=>{const plan=!!pf.get(f.id)?.enabled,over=ov.get(f.id);const state=over?String(!!over.enabled):'inherit';return `<div class="feature-row"><div><strong>${esc(f.name||f.code)}</strong><span>${esc(f.code)} · Plan ${plan?'enabled':'disabled'}</span></div><select data-feature="${f.id}"><option value="inherit" ${state==='inherit'?'selected':''}>Use Plan</option><option value="true" ${state==='true'?'selected':''}>Force Enabled</option><option value="false" ${state==='false'?'selected':''}>Force Disabled</option></select></div>`}).join('')}</div>`;$$('[data-feature]',root).forEach(sel=>sel.onchange=async()=>{try{await actionApi({action:'set_override',employer_id:employerId,feature_id:sel.dataset.feature,enabled:sel.value==='inherit'?null:sel.value==='true'});status('Feature access updated.','success')}catch(e){status(e.message,'error')}});}
function renderSupport(){const root=$('#managementContent'),c=detail.support_consent;root.innerHTML=c?`<div class="feature-row"><div><strong>Support Access</strong><span>${esc(pretty(c.status))}${c.expires_at?' · expires '+esc(fmtDT(c.expires_at)):''}</span></div>${c.status==='granted'?button('Revoke Access','data-revoke-support'):''}</div>`:`<div class="management-empty">No support-access consent exists.</div><div class="management-actions">${button('Request Support Access','data-request-support')}</div>`;root.querySelector('[data-request-support]')?.addEventListener('click',async()=>{try{await actionApi({action:'request_support_consent',employer_id:employerId,scope:'support_only',reason:'Requested by screenings4u Admin'});status('Support-access request created.','success');await refresh()}catch(e){status(e.message,'error')}});root.querySelector('[data-revoke-support]')?.addEventListener('click',async()=>{try{await actionApi({action:'revoke_support_consent',employer_id:employerId});status('Support access revoked.','success');await refresh()}catch(e){status(e.message,'error')}});}
function renderReports(){const root=$('#managementContent');root.innerHTML=`<div class="feature-grid">${[['Employees',detail.employees?.length],['Programs',detail.programs?.length],['Testing Orders',detail.testing_orders?.length],['Results',detail.results?.length],['Compliance Cases',detail.compliance_cases?.length],['Documents',detail.documents?.length]].map(([n,c])=>`<div class="feature-row"><div><strong>${n}</strong><span>${c||0} records</span></div></div>`).join('')}</div>`;}
function renderPostAccident(type){const root=$('#managementContent');const rows=(detail.post_accidents||[]).filter(x=>x.program_type===type).map(x=>`<tr><td>${esc(employeeName((detail.employees||[]).find(e=>e.id===x.employee_id)))}</td><td>${esc(fmtDT(x.occurred_at))}</td><td>${esc(x.dot_agency||'—')}</td><td>${x.testing_required?'Yes':'No'}</td><td>${esc(pretty(x.status))}</td></tr>`).join('');root.innerHTML=table(['Employee','Occurred','Agency','Testing Required','Status'],rows,'No post-accident events.');}
function renderTestingConfig(){const root=$('#managementContent');root.innerHTML=`<section class="admin-inline-editor"><h3>Testing Configuration</h3><p>Admin-configured order defaults, result-reporting preferences, orderable services, and laboratory accounts are stored on the Employer account and consumed by the Employer portal.</p></section>${table(['Field','Value','Shown','Default'],(detail.order_defaults||[]).map(x=>`<tr><td>${esc(x.field_name)}</td><td>${esc(x.field_value)}</td><td>${x.show?'Yes':'No'}</td><td>${x.make_default?'Yes':'No'}</td></tr>`).join(''),'No testing defaults configured.')}`;}
function renderDotAgencies(){const root=$('#managementContent');root.innerHTML=table(['Agency','Primary','Account Identifier','Status'],(detail.regulatory_agencies||[]).map(x=>`<tr><td><strong>${esc(x.agency_code)}</strong></td><td>${x.is_primary?'Yes':'No'}</td><td>${esc(x.account_identifier||'—')}</td><td>${esc(pretty(x.status))}</td></tr>`).join(''),'No DOT agencies assigned.');}

function renderCurrent(){if(!detail)return;switch(file){case'employer-profile.html':return renderProfile();case'employer-subscription.html':return renderSubscription();case'employer-employees.html':return renderEmployees();case'employer-locations.html':return renderLocations();case'employer-dot-programs.html':return renderPrograms('DOT');case'employer-nondot-programs.html':return renderPrograms('NON_DOT');case'employer-testing.html':return renderTesting();case'employer-results.html':return renderResults();case'employer-compliance.html':return renderCompliance();case'employer-documents.html':return renderDocuments();case'employer-notifications.html':return renderNotifications();case'employer-audit.html':return renderAudit();case'employer-access.html':return renderAccess(false);case'employer-ders.html':return renderAccess(true);case'employer-pools.html':return renderPools();case'employer-selections.html':return renderSelections();case'employer-billing.html':return renderBilling();case'employer-settings.html':return renderSettings();case'employer-support-access.html':return renderSupport();case'employer-reports.html':return renderReports();case'employer-post-accidents.html':return renderPostAccident('DOT');case'employer-nondot-post-accidents.html':return renderPostAccident('NON_DOT');case'employer-testing-config.html':return renderTestingConfig();case'employer-dot-agencies.html':return renderDotAgencies();default:if($('#managementContent'))$('#managementContent').innerHTML='<div class="management-empty">This Admin Employer page is connected to the shared Employer account context.</div>';}}
async function refresh(){detail=await contextApi({action:'detail',employer_id:employerId});setContext();renderCurrent();}

await portalReady;
try{await loadDirectory();if(!requireEmployer()){}else{await loadDetail();renderCurrent();}}catch(e){console.error('Admin employer runtime',e);status(e.message,'error');}
