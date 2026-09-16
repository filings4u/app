import { supabase } from './supabase.js';

const ROOT = new URL('../../', import.meta.url);
const rootUrl = (path='') => new URL(path, ROOT).href;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = v => v ? new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(v)) : '—';
const fmtDateTime = v => v ? new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v)) : '—';
const fmtMoney = (v,c='USD') => v==null ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD'}).format(Number(v||0));
const pretty = v => String(v ?? '—').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const page = document.body?.dataset?.page || '';
let context = null;
let employerIdForAdmin = new URLSearchParams(location.search).get('employer_id') || sessionStorage.getItem('s4u_admin_employer_id') || '';

function notice(message,type=''){
  const el=$('#pageNotice'); if(!el) return;
  el.hidden=!message; el.textContent=message||''; el.className='saas-notice'+(type?` ${type}`:'');
}
function setText(sel,value){ const el=$(sel); if(el) el.textContent=value ?? '—'; }
function setOptions(sel, rows, value, label, first='Choose an option'){
  const el=$(sel); if(!el) return;
  const prior=el.value; el.replaceChildren();
  const firstOpt=document.createElement('option'); firstOpt.value=''; firstOpt.textContent=first; el.append(firstOpt);
  for(const row of rows||[]){ const o=document.createElement('option'); o.value=value(row)??''; o.textContent=label(row); el.append(o); }
  if(prior && [...el.options].some(o=>o.value===prior)) el.value=prior;
}
function tableRows(id, rows, cols, empty='No records found.'){
  const body=document.getElementById(id); if(!body) return;
  body.replaceChildren();
  if(!rows?.length){ const tr=document.createElement('tr'),td=document.createElement('td'); td.colSpan=cols; const div=document.createElement('div'); div.className='saas-empty'; div.textContent=empty; td.append(div); tr.append(td); body.append(tr); return; }
  for(const row of rows) body.append(row);
}
function tr(cells){ const row=document.createElement('tr'); for(const cell of cells){ const td=document.createElement('td'); if(cell instanceof Node) td.append(cell); else td.textContent=cell ?? '—'; row.append(td); } return row; }
function linkButton(label, href){ const a=document.createElement('a'); a.className='btn btn-outline btn-small'; a.textContent=label; a.href=href; return a; }
function actionButton(label, handler){ const b=document.createElement('button'); b.type='button'; b.className='btn btn-outline btn-small'; b.textContent=label; b.addEventListener('click',handler,{once:false}); return b; }
function formObject(form){ const x=Object.fromEntries(new FormData(form)); $$('input[type=checkbox]',form).forEach(i=>x[i.name]=i.checked); return x; }
async function invoke(name, body, retry=true){
  const payload={...body};
  if(context?.membership?.id) payload.membership_id=context.membership.id;
  if(context?.membership?.role_code==='platform_admin' && employerIdForAdmin) payload.employer_id=employerIdForAdmin;
  let {data,error}=await supabase.functions.invoke(name,{body:payload});
  let message=error?.message||data?.error||'';
  if(error && retry && /jwt.*future|issued at future|jwt.*expired|invalid jwt/i.test(message)){
    const refreshed=await supabase.auth.refreshSession();
    if(!refreshed.error){ ({data,error}=await supabase.functions.invoke(name,{body:payload})); message=error?.message||data?.error||''; }
  }
  if(error){ try{const x=await error.context?.clone?.().json(); message=x?.error||message;}catch{} throw new Error(message||'Request failed.'); }
  if(data?.error) throw new Error(data.error);
  return data;
}
const api = body => invoke('workforce-employer-management',body);
const advanced = body => invoke(['save_post_accident','respond_support_consent'].includes(body.action)?'workforce-employer-phase1-actions':'workforce-employer-advanced',body);
const testing = body => invoke('workforce-employer-testing',body);
const pools = body => invoke('workforce-employer-pools',body);
const employeeAccess = body => invoke('workforce-employer-employee-access',body);
const resultWorkflow = body => invoke('workforce-employer-results',body);
const complianceWorkflow = body => invoke('workforce-employer-compliance',body);
const documentWorkflow = body => invoke('workforce-employer-documents',body);
const notificationWorkflow = body => invoke('workforce-employer-notifications',body);
const reportingWorkflow = body => invoke('workforce-employer-reporting',body);
const subscriptionApi = body => invoke('workforce-employer-subscription',body);
function downloadBase64File(base64,name,type='application/pdf'){const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name||'download.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}

async function sessionContext(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session){ location.replace(rootUrl(`login.html?next=${encodeURIComponent(location.pathname+location.search)}`)); return null; }
  const requested=new URLSearchParams(location.search).get('workspace')||'';
  const selected=requested||sessionStorage.getItem('s4u_workspace_membership')||'';
  const data=await invoke('workforce-session-context',{requested_portal:'employer',membership_id:selected});
  if(data.requires_workspace_selection){ location.replace(rootUrl(`workspace-select.html?next=${encodeURIComponent(location.pathname+location.search)}`)); return null; }
  if(!data.has_access){ location.replace(rootUrl('access-required.html?reason=subscription')); return null; }
  if(data.membership?.id) sessionStorage.setItem('s4u_workspace_membership',data.membership.id);
  if(data.portal!=='employer' && data.portal!=='admin'){
    const target=data.portal==='ctpa'?'ctpa/dashboard.html':data.portal==='owner_operator'?'owner-operator/dashboard.html':data.portal==='employee'?'employee/dashboard.html':'workspace-select.html';
    location.replace(rootUrl(target)); return null;
  }
  return data;
}
function renderShell(ctx){
  const org=ctx?.membership?.organization_name||'Employer Account';
  const role=ctx?.membership?.role_name||'Employer User';
  const email=ctx?.user?.email||'';
  const name=[ctx?.profile?.first_name,ctx?.profile?.last_name].filter(Boolean).join(' ')||email||'Account User';
  const initials=name.trim().split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'U';
  $$('[data-org-name]').forEach(el=>el.textContent=org);
  $$('[data-user-name]').forEach(el=>el.textContent=name);
  $$('[data-user-role]').forEach(el=>el.textContent=role);
  $$('[data-user-initials]').forEach(el=>el.textContent=initials);
  $$('[data-workspace-label]').forEach(el=>el.textContent=(ctx?.subscription?.plan_name||role)+' Workspace');
  const file=location.pathname.split('/').pop();
  $$('[data-nav]').forEach(a=>{ const active=(a.getAttribute('href')||'').split('/').pop()===file; a.classList.toggle('active',active); const f=a.dataset.feature; if(f && ctx?.membership?.role_code!=='platform_admin') a.hidden=ctx?.entitlements?.[f]!==true; });
  $$('[data-feature]').forEach(el=>{ const f=el.dataset.feature; if(f && ctx?.membership?.role_code!=='platform_admin') el.hidden=ctx?.entitlements?.[f]!==true; });
  const switcher=$('#switchAccount'); if(switcher) switcher.hidden=ctx?.membership?.role_code==='platform_admin'||!Array.isArray(ctx?.workspaces)||ctx.workspaces.length<2;
}
function bindAccordion(){
  const nav=$('.sidebar-nav'); if(!nav || nav.dataset.accordionBound==='1') return;
  nav.dataset.accordionBound='1';

  const groups=[];
  const sections=[...nav.querySelectorAll('.nav-section')];
  sections.forEach((heading,i)=>{
    heading.tabIndex=0;
    heading.setAttribute('role','button');
    heading.setAttribute('aria-expanded','false');
    heading.dataset.navGroup=String(i);

    const items=[];
    let n=heading.nextElementSibling;
    while(n && !n.classList.contains('nav-section')){
      if(n.matches?.('[data-nav]')){
        n.dataset.entitlementHidden=n.hidden?'1':'0';
        items.push(n);
      }
      n=n.nextElementSibling;
    }

    const group={heading,items,open:false};
    groups.push(group);

    const apply=()=>{
      heading.classList.toggle('open',group.open);
      heading.setAttribute('aria-expanded',String(group.open));
      items.forEach(item=>{
        const blocked=item.dataset.entitlementHidden==='1';
        const active=item.classList.contains('active');
        item.hidden=blocked || (!group.open && !active);
      });
    };
    group.apply=apply;

    const toggle=()=>{
      const next=!group.open;
      groups.forEach(g=>{ if(g!==group){g.open=false;g.apply?.();} });
      group.open=next;
      apply();
    };

    heading.addEventListener('click',toggle);
    heading.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}
    });
  });

  groups.forEach(g=>g.apply?.());
}

const FONT_SCALE_KEY='s4u_portal_font_scale';
const FONT_SCALES=[0.9,1,1.1,1.2,1.3];
function applyFontScale(value){
  let v=Number(value);if(!FONT_SCALES.includes(v))v=1;
  document.documentElement.style.setProperty('--portal-font-scale',String(v));
  localStorage.setItem(FONT_SCALE_KEY,String(v));
  document.querySelectorAll('[data-font-scale-value],#fontSizerValue').forEach(x=>x.textContent=`${Math.round(v*100)}%`);
}
function bindFontSizer(){
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY)||1);
  const actions=document.querySelector('.topbar-actions');
  if(!actions)return;

  const box=document.querySelector('#fontSizer,[data-font-sizer]');
  if(!box)return;
  box.dataset.fontSizer='';
  const down=box.querySelector('[data-font-dec]')||box.querySelector('button:first-of-type');
  const up=box.querySelector('[data-font-inc]')||box.querySelector('button:last-of-type');
  const value=box.querySelector('[data-font-scale-value],#fontSizerValue,.font-sizer-value');
  if(value)value.dataset.fontScaleValue='';

  const switcher=document.querySelector('#switchAccount');
  if(switcher && box.nextElementSibling!==switcher) actions.insertBefore(box,switcher);

  const change=step=>{
    let cur=Number(localStorage.getItem(FONT_SCALE_KEY)||1),i=FONT_SCALES.indexOf(cur);
    if(i<0)i=1;
    i=Math.max(0,Math.min(FONT_SCALES.length-1,i+step));
    applyFontScale(FONT_SCALES[i]);
  };
  down?.addEventListener('click',()=>change(-1));
  up?.addEventListener('click',()=>change(1));
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY)||1);
}

function bindShell(){
  const menu=$('#mobileMenu'), sidebar=$('#employerSidebar');
  menu?.addEventListener('click',()=>{ document.body.classList.toggle('nav-open'); sidebar?.classList.toggle('mobile-open'); });
  $('#signOut')?.addEventListener('click',async()=>{ sessionStorage.removeItem('s4u_workspace_membership'); await supabase.auth.signOut(); location.replace(rootUrl('login.html')); });
  $('#switchAccount')?.addEventListener('click',()=>sessionStorage.removeItem('s4u_workspace_membership'));
  bindFontSizer();
}
async function enforcePageFeature(ctx){ const feature=document.body.dataset.pageFeature; if(!feature||ctx?.membership?.role_code==='platform_admin') return true; if(ctx?.entitlements?.[feature]===true) return true; const content=$('#pageContent'); if(content){ content.replaceChildren(); const box=document.createElement('section'); box.className='card'; const b=document.createElement('div'); b.className='card-body'; const h=document.createElement('h2'); h.textContent='Feature not included'; const p=document.createElement('p'); p.textContent='This feature is not enabled for the selected Employer subscription.'; const a=linkButton('Contact Support',`support.html?feature=${encodeURIComponent(feature)}`); b.append(h,p,a); box.append(b); content.append(box);} return false; }
async function onboardingGuard(){ if(page==='onboarding'||context?.membership?.role_code==='platform_admin') return true; try{const d=await invoke('workforce-customer-onboarding',{action:'status',portal:'employer'}); if(d.completed===false){location.replace('onboarding.html'); return false;}}catch(e){console.warn('Onboarding status check failed',e);} return true; }

function fillForm(form,data){ if(!form||!data)return; for(const [k,v] of Object.entries(data)){ const el=form.elements.namedItem(k); if(!el||v==null)continue; if(el.type==='checkbox')el.checked=!!v; else el.value=v; } }
function employeeName(e){return [e?.last_name,e?.first_name].filter(Boolean).join(', ')||'—';}

async function initDashboard(){ const d=await api({action:'overview'}); setText('#dashboardTitle',`${d.employer?.legal_name||'Employer'} Dashboard`); setText('#dashboardSubtitle',d.subscription?.plans?.name||d.subscription?.plan_name||'Workforce Compliance'); const employees=d.employees||[],tests=d.testing_orders||[],cases=d.compliance_cases||[],docs=d.documents||[]; setText('#metricEmployees',employees.filter(x=>x.employment_status!=='terminated').length); setText('#metricDot',`${employees.filter(x=>x.dot_covered).length} DOT-covered`); setText('#metricTests',tests.filter(x=>!['closed','cancelled'].includes(String(x.status))).length); setText('#metricCases',cases.filter(x=>x.status!=='closed').length); setText('#metricDocs',docs.length);
  const pr=$('#programRows'); if(pr){pr.replaceChildren(); for(const p of (d.programs||[]).slice(0,6)){const div=document.createElement('div'); div.className='status-item'; div.textContent=`${p.name} — ${pretty(p.program_type)}${p.dot_agency?' / '+p.dot_agency:''}`; pr.append(div);} if(!pr.children.length){const e=document.createElement('div');e.className='saas-empty';e.textContent='No programs configured.';pr.append(e)}}
  const trr=$('#testRows'); if(trr){trr.replaceChildren(); for(const x of tests.slice(0,6)){const div=document.createElement('div');div.className='status-item';div.textContent=`${x.order_number||'Order'} — ${employeeName(x.employees)} — ${pretty(x.status)}`;trr.append(div);} if(!trr.children.length){const e=document.createElement('div');e.className='saas-empty';e.textContent='No testing activity.';trr.append(e)}}
  if(context?.entitlements?.action_center){try{const a=await advanced({action:'workforce_action_center'}); const s=$('#actionSummary'); if(s){s.textContent=`${a.credentials?.length||0} credential · ${a.training?.length||0} training · ${a.compliance?.length||0} compliance · ${a.post_accidents?.length||0} post-accident item(s)`;}}catch(e){console.warn(e)}} }
async function initEmployees(){
  let d=await api({action:'overview'}),accessData=null;
  try{accessData=await employeeAccess({action:'list'})}catch(e){console.warn('Employee access list unavailable',e)}
  const render=()=>tableRows('employeeRows',(d.employees||[]).map(e=>{
    const b=actionButton('Edit',()=>fillForm($('#employeeForm'),e));
    const a=accessData?.employees?.find(x=>x.id===e.id)?.portal_access||{linked:!!e.auth_user_id,status:e.auth_user_id?'linked':'none'};
    const wrap=document.createElement('div');wrap.className='management-actions';
    const badge=document.createElement('span');badge.className='access-state '+(a.status==='active'?'is-linked':'is-unlinked');badge.textContent=a.linked?pretty(a.status):'Not Enabled';wrap.append(badge);
    if(accessData?.can_manage){
      if(!a.linked){const enable=actionButton('Enable Portal',async()=>{try{notice('Creating Employee Portal access…');await employeeAccess({action:'invite',employee_id:e.id});d=await api({action:'overview'});accessData=await employeeAccess({action:'list'});render();notice('Employee Portal access enabled.','success')}catch(x){notice(x.message,'error')}});enable.disabled=!e.email;wrap.append(enable)}
      else {const target=a.status==='active'?'suspended':'active';wrap.append(actionButton(target==='active'?'Activate':'Suspend',async()=>{try{await employeeAccess({action:'set_status',employee_id:e.id,status:target});accessData=await employeeAccess({action:'list'});render();notice(`Employee Portal access ${target}.`,'success')}catch(x){notice(x.message,'error')}}));}
    }
    return tr([employeeName(e),e.employee_number||'—',e.email||'—',e.dot_covered?'Yes':'No',pretty(e.employment_status),wrap,b])
  }),7,'No employees or drivers yet.');
  render();
  $('#employeeForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;try{notice('Saving employee…');await api({action:'save_employee',employee:formObject(form)});form.reset();d=await api({action:'overview'});try{accessData=await employeeAccess({action:'list'})}catch{}render();notice('Employee saved.','success')}catch(e){notice(e.message,'error')}});
}

async function initLocations(){ let d=await api({action:'overview'}); const render=()=>tableRows('locationRows',(d.locations||[]).map(x=>tr([x.name,pretty(x.location_type),[x.city,x.state].filter(Boolean).join(', ')||'—',pretty(x.status),actionButton('Edit',()=>fillForm($('#locationForm'),x))])),5,'No locations configured.'); render(); $('#locationForm')?.addEventListener('submit',async ev=>{ev.preventDefault(); const form=ev.currentTarget; try{await api({action:'save_location',location:formObject(form)});form.reset();d=await api({action:'overview'});render();notice('Location saved.','success')}catch(e){notice(e.message,'error')}}); }
async function initPrograms(){
  let d=await api({action:'overview'});
  const render=()=>tableRows('programTableRows',(d.programs||[]).map(x=>tr([x.name,pretty(x.program_type),x.dot_agency||'—',pretty(x.status),actionButton('Edit',()=>fillForm($('#programForm'),x))])),5,'No programs configured.');
  render();
  $('#programForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;try{const x=formObject(form);if(!x.effective_date)throw new Error('Effective date is required.');await api({action:'save_program',program:x});form.reset();d=await api({action:'overview'});render();notice('Program saved.','success')}catch(e){notice(e.message,'error')}});
}

async function initEnrollment(){
  const ov=await api({action:'overview'});let x=await api({action:'employee_programs'});
  setOptions('#enrollEmployee',ov.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');setOptions('#enrollProgram',ov.programs||[],p=>p.id,p=>`${p.name} — ${pretty(p.program_type)}`,'Choose program');
  const form=$('#enrollmentForm');
  const render=()=>tableRows('enrollmentRows',(x.employee_programs||[]).map(v=>{const edit=actionButton('Edit',()=>fillForm(form,v));return tr([employeeName(v.employees),v.programs?.name||'—',pretty(v.programs?.program_type),fmtDate(v.effective_date),pretty(v.status),edit])}),6,'No program enrollments.');render();
  form?.addEventListener('submit',async ev=>{ev.preventDefault();try{const enrollment=formObject(ev.currentTarget);if(!enrollment.effective_date)throw new Error('Effective date is required.');await api({action:'save_employee_program',enrollment});x=await api({action:'employee_programs'});ev.currentTarget.reset();render();notice(enrollment.id?'Enrollment updated.':'Enrollment saved.','success')}catch(e){notice(e.message,'error')}});
}

async function initRandomPools(){
  const w=await pools({action:'workspace'});
  const memberships=w.pool_memberships||[];
  const rows=(w.pools||[]).map(p=>{
    const members=memberships.filter(m=>m.pool_id===p.id);
    const eligible=members.filter(m=>m.eligibility_status==='eligible').length;
    return tr([p.name,w.programs?.find(x=>x.id===p.program_id)?.name||'—',pretty(p.program_type),p.dot_agency||'—',p.drug_testing_rate==null?'—':`${p.drug_testing_rate}%`,p.alcohol_testing_rate==null?'—':`${p.alcohol_testing_rate}%`,`${eligible} / ${members.length}`,fmtDate(p.effective_date),pretty(p.status)]);
  });
  tableRows('poolRows',rows,9,'No random pools configured.');
  const card=$('#poolRows')?.closest('.card');
  const span=card?.querySelector('.card-head span');
  if(span)span.textContent='Pool configuration is managed through screenings4u Admin and reflected here in real time.';
}
async function initPoolMembership(){
  const w=await pools({action:'workspace'});
  const rows=(w.pool_memberships||[]).map(v=>tr([employeeName(v.employees),v.random_pools?.name||'—',w.programs?.find(p=>p.id===v.random_pools?.program_id)?.name||pretty(v.random_pools?.program_type),pretty(v.employees?.employment_status),fmtDate(v.effective_date),pretty(v.eligibility_status),v.ineligible_reason||'—']));
  tableRows('poolMemberRows',rows,7,'No current pool memberships.');
  const card=$('#poolMemberRows')?.closest('.card');
  const span=card?.querySelector('.card-head span');
  if(span)span.textContent='Membership and eligibility are administered against the employee’s active program enrollment.';
}
async function initSelections(){
  const h=await pools({action:'selection_history'}),events=h.events||[],members=h.members||[];
  const content=$('#pageContent');
  const selectedFor=id=>members.filter(x=>x.selection_event_id===id);
  const latest=events[0]||null;
  if(content){
    content.innerHTML=`
      <div class="saas-notice" id="pageNotice" hidden></div>
      <section class="metrics">
        <article class="metric-card"><div class="metric-label">Selection Events</div><div class="metric-value">${events.length}</div><div class="metric-note">Locked Employer selection history</div></article>
        <article class="metric-card"><div class="metric-label">Selected Records</div><div class="metric-value">${members.length}</div><div class="metric-note">Across all retained events</div></article>
        <article class="metric-card"><div class="metric-label">Latest Population</div><div class="metric-value">${latest?.population_size??0}</div><div class="metric-note">${latest?fmtDateTime(latest.selection_date):'No selection yet'}</div></article>
        <article class="metric-card"><div class="metric-label">Administration</div><div class="metric-value" style="font-size:18px">Admin Managed</div><div class="metric-note">Selections are run and locked by screenings4u Admin</div></article>
      </section>
      <section class="card">
        <div class="card-head"><div><h2>Selection History</h2><span>Read-only locked random-selection events supplied by the screenings4u Admin workflow.</span></div></div>
        <div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Date</th><th>Pool</th><th>Population</th><th>Drug</th><th>Alcohol</th><th>Selected</th><th>Status</th><th></th></tr></thead><tbody id="selectionRows"></tbody></table></div></div>
      </section>
      <section class="card" id="employerSelectionDetail" style="margin-top:18px" hidden>
        <div class="card-head"><div><h2 id="employerSelectionTitle">Selected Employees / Drivers</h2><span id="employerSelectionMeta"></span></div></div>
        <div class="card-body" id="employerSelectionBody"></div>
      </section>`;
  }
  tableRows('selectionRows',events.map(ev=>{
    const list=selectedFor(ev.id);
    const b=actionButton('View Selected',()=>{
      const panel=$('#employerSelectionDetail');
      panel.hidden=false;
      setText('#employerSelectionTitle',`${ev.random_pools?.name||'Random Pool'} · ${fmtDateTime(ev.selection_date)}`);
      setText('#employerSelectionMeta',`${ev.population_size||0} in population snapshot · ${list.length} selected`);
      const body=$('#employerSelectionBody');body.replaceChildren();
      const wrap=document.createElement('div');wrap.className='management-table-wrap';
      const table=document.createElement('table');table.className='management-table';
      table.innerHTML='<thead><tr><th>Employee / Driver</th><th>Test Type</th><th>Selected</th></tr></thead>';
      const tbody=document.createElement('tbody');
      if(!list.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=3;cell.innerHTML='<div class="saas-empty">No selected employee records were returned for this event.</div>';row.append(cell);tbody.append(row)}
      else list.forEach(m=>tbody.append(tr([employeeName(m.employees),pretty(m.test_type),fmtDateTime(m.selected_at)])));
      table.append(tbody);wrap.append(table);body.append(wrap);panel.scrollIntoView({behavior:'smooth',block:'center'});
    });
    return tr([fmtDateTime(ev.selection_date),ev.random_pools?.name||'—',String(ev.population_size??0),String(ev.drug_selection_count??0),String(ev.alcohol_selection_count??0),String(list.length),pretty(ev.status),b]);
  }),8,'No random selection events.');
}
async function initTesting(){
  let d=await testing({action:'list'});
  const root=$('#pageContent');
  const draw=()=>{
    const orders=d.orders||[],employees=d.employees||[],programs=d.programs||[],enrollments=d.employee_programs||[],sites=(d.sites||[]).map(x=>({...x,...(x.collection_sites||{})})),results=d.results||[];
    const resultMap=new Map(results.map(x=>[x.testing_order_id,x]));
    const open=orders.filter(x=>!['closed','cancelled','refused','no_show','unable_to_collect','invalid_specimen'].includes(x.status));
    const awaiting=orders.filter(x=>['assigned','employee_notified','scheduled','at_collection'].includes(x.status));
    const lab=orders.filter(x=>['collected','laboratory','mro_review'].includes(x.status));
    const canManage=d.can_manage!==false;

    root.innerHTML=`
      <div class="saas-notice" id="pageNotice" hidden></div>
      <section class="metrics">
        <article class="metric-card"><div class="metric-label">Testing Orders</div><div class="metric-value">${orders.length}</div><div class="metric-note">${open.length} currently open</div></article>
        <article class="metric-card"><div class="metric-label">Awaiting Collection</div><div class="metric-value">${awaiting.length}</div><div class="metric-note">Assigned through at-collection</div></article>
        <article class="metric-card"><div class="metric-label">Lab / MRO</div><div class="metric-value">${lab.length}</div><div class="metric-note">Collected through MRO review</div></article>
        <article class="metric-card"><div class="metric-label">Random Orders</div><div class="metric-value">${orders.filter(x=>x.selection_member_id).length}</div><div class="metric-note">Created from locked selections</div></article>
      </section>

      ${canManage?`<section class="card">
        <div class="card-head"><div><h2 id="employerTestEditorTitle">Create Testing Order</h2><span>Random testing orders are created from Random Selections; use this form for other testing reasons.</span></div><button class="btn btn-outline btn-small" id="newEmployerTestOrder" type="button">New Order</button></div>
        <div class="card-body">
          <form class="management-form" id="testingForm">
            <input type="hidden" name="id">
            <div class="grid grid-2">
              <label>Employee / Driver<select id="testEmployee" name="employee_id" required></select></label>
              <label>Program<select id="testProgram" name="program_id" required></select></label>
              <label>Reason<select name="reason" required><option value="pre_employment">Pre-Employment</option><option value="reasonable_suspicion">Reasonable Suspicion</option><option value="post_accident">Post-Accident</option><option value="return_to_duty">Return-to-Duty</option><option value="follow_up">Follow-Up</option><option value="other">Other</option></select></label>
              <label>Test Type<select name="test_type" required><option value="drug">Drug</option><option value="alcohol">Alcohol</option><option value="drug_and_alcohol">Drug + Alcohol</option></select></label>
              <label>Collection Site<select id="testSite" name="collection_site_id"></select></label>
              <label>Deadline<input name="collection_deadline" type="datetime-local"></label>
              <label>Panel<input name="testing_panel" placeholder="Uses program default when blank"></label>
              <label>Collection Type<select name="collection_type"><option value="">Program default</option><option value="urine">Urine</option><option value="oral_fluid">Oral Fluid</option></select></label>
            </div>
            <div class="saas-notice" id="employerTestHelp" style="margin-top:12px">Choose an employee / driver and an assigned program.</div>
            <div class="saas-actions"><button class="btn btn-orange" type="submit">Save Testing Order</button></div>
          </form>
        </div>
      </section>`:`<div class="saas-notice">Your Employer role has read-only Testing Orders access. screenings4u Admin or an authorized Employer testing manager controls order changes.</div>`}

      <section class="card" style="margin-top:18px">
        <div class="card-head"><div><h2>Testing Order Lifecycle</h2><span>Orders created here and by screenings4u Admin use the same Workforce records.</span></div></div>
        <div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Order</th><th>Employee / Driver</th><th>Program</th><th>Reason</th><th>Test</th><th>Site</th><th>Deadline</th><th>Status</th><th>Result</th><th></th></tr></thead><tbody id="testingRows"></tbody></table></div></div>
      </section>`;

    const rows=orders.map(o=>{
      const r=resultMap.get(o.id);
      const statusWrap=document.createElement('div');
      if(canManage){
        const select=document.createElement('select');
        for(const value of d.statuses||[]){const opt=document.createElement('option');opt.value=value;opt.textContent=pretty(value);opt.selected=value===o.status;select.append(opt)}
        select.addEventListener('change',async()=>{const old=o.status;try{await testing({action:'update_status',test:{id:o.id,status:select.value}});d=await testing({action:'list'});draw();notice('Testing lifecycle updated.','success')}catch(e){select.value=old;notice(e.message,'error')}});
        statusWrap.append(select);
      }else statusWrap.textContent=pretty(o.status);

      let actions='—';
      if(canManage){
        actions=actionButton('Edit',()=>{
          const form=$('#testingForm'); if(!form)return;
          clearForm();
          const set=(name,val)=>{const el=form.elements[name];if(el)el.value=val??''};
          set('id',o.id);set('employee_id',o.employee_id);set('reason',o.reason);set('test_type',o.test_type);
          rebuildPrograms(); set('program_id',o.program_id); rebuildSites(); set('collection_site_id',o.collection_site_id||'');
          set('collection_deadline',o.collection_deadline?new Date(o.collection_deadline).toISOString().slice(0,16):'');
          set('testing_panel',o.testing_panel||'');set('collection_type',o.collection_type||'');
          if(o.selection_member_id){
            form.elements.employee_id.disabled=true;form.elements.program_id.disabled=true;form.elements.reason.disabled=true;form.elements.test_type.disabled=true;
            $('#employerTestHelp').textContent='This order came from a locked Random Selection. Employee, program, reason, and test type are protected.';
          }else $('#employerTestHelp').textContent='Editing an existing testing order.';
          setText('#employerTestEditorTitle',`Edit ${o.order_number}`);
          form.scrollIntoView({behavior:'smooth',block:'center'});
        });
      }
      return tr([
        `${o.order_number}${o.selection_member_id?' · Random':''}`,
        employeeName(o.employees),o.programs?.name||'—',pretty(o.reason),pretty(o.test_type),
        o.collection_sites?.name||'—',fmtDateTime(o.collection_deadline),statusWrap,
        r?`${pretty(r.final_status)}${r.finalized_at||r.result_date?' · '+fmtDate(r.finalized_at||r.result_date):''}`:'—',
        actions
      ]);
    });
    tableRows('testingRows',rows,10,'No testing orders.');

    if(!canManage)return;
    const form=$('#testingForm'),employee=$('#testEmployee'),program=$('#testProgram'),site=$('#testSite'),help=$('#employerTestHelp');
    const eligiblePrograms=(employeeId,reason)=>programs.filter(p=>enrollments.some(en=>en.employee_id===employeeId&&en.program_id===p.id&&(reason==='pre_employment'?['active','pending'].includes(en.status):en.status==='active')));
    const rebuildPrograms=()=>{
      const prior=program.value,employeeId=employee.value,reason=form.elements.reason.value,rows=employeeId?eligiblePrograms(employeeId,reason):programs;
      setOptions('#testProgram',rows,p=>p.id,p=>`${p.name} — ${pretty(p.program_type)}${p.dot_agency?' — '+p.dot_agency:''}`,'Choose program');
      if(prior&&rows.some(p=>p.id===prior))program.value=prior;
      help.textContent=employeeId?(rows.length?`${rows.length} assigned program(s) available.`:'This employee / driver has no qualifying program assignment for this reason.'):'Choose an employee / driver and an assigned program.';
      rebuildSites();
    };
    const rebuildSites=()=>{
      const p=programs.find(x=>x.id===program.value),type=form.elements.test_type.value,prior=site.value;
      const rows=sites.filter(s=>{if(!p)return true;if(p.program_type==='DOT'&&!s.dot_capable)return false;if(p.program_type==='NON_DOT'&&!s.non_dot_capable)return false;if((type==='drug'||type==='drug_and_alcohol')&&!s.drug_testing)return false;if((type==='alcohol'||type==='drug_and_alcohol')&&!s.alcohol_testing)return false;return true;});
      setOptions('#testSite',rows,s=>s.id||s.collection_site_id,s=>`${s.name} — ${[s.city,s.state].filter(Boolean).join(', ')}`,'Not assigned');
      if(prior&&rows.some(s=>(s.id||s.collection_site_id)===prior))site.value=prior;
      if(p&&!form.elements.testing_panel.value)form.elements.testing_panel.value=p.testing_panel||'';
      const method=String(p?.testing_method||'').toLowerCase().replace(' ','_');if(p&&!form.elements.collection_type.value&&['urine','oral_fluid'].includes(method))form.elements.collection_type.value=method;
    };
    const clearForm=()=>{
      form.reset();form.elements.id.value='';[...form.elements].forEach(el=>el.disabled=false);
      setOptions('#testEmployee',employees,e=>e.id,e=>`${employeeName(e)}${e.employee_number?' — '+e.employee_number:''}`,'Choose employee / driver');
      rebuildPrograms();setText('#employerTestEditorTitle','Create Testing Order');help.textContent='Choose an employee / driver and an assigned program.';
    };
    window.clearEmployerTestingOrder=clearForm;
    clearForm();
    employee.onchange=rebuildPrograms;form.elements.reason.onchange=rebuildPrograms;program.onchange=rebuildSites;form.elements.test_type.onchange=rebuildSites;
    $('#newEmployerTestOrder')?.addEventListener('click',clearForm);
    form.addEventListener('submit',async ev=>{
      ev.preventDefault();const x=formObject(form);
      if(x.id){const current=orders.find(o=>o.id===x.id);if(current?.selection_member_id){x.employee_id=current.employee_id;x.program_id=current.program_id;x.reason=current.reason;x.test_type=current.test_type;}}
      try{notice(x.id?'Saving testing order…':'Creating testing order…');await testing({action:x.id?'save':'create',test:x});d=await testing({action:'list'});draw();notice(x.id?'Testing order updated.':'Testing order created.','success')}catch(e){notice(e.message,'error')}
    });
  };
  draw();
}
async function initSites(){const d=await advanced({action:'collection_sites'});const render=()=>{const q=($('#siteSearch')?.value||'').trim().toLowerCase();const rows=(d.sites||[]).filter(x=>{const z=x.collection_sites||{};return !q||[z.name,z.city,z.state,z.postal_code].some(v=>String(v||'').toLowerCase().includes(q))}).map(x=>{const z=x.collection_sites||{};return tr([z.name||'—',[z.city,z.state,z.postal_code].filter(Boolean).join(', ')||'—',z.dot_capable?'Yes':'No',z.non_dot_capable?'Yes':'No',z.drug_testing?'Yes':'No',z.alcohol_testing?'Yes':'No',x.is_primary?'Yes':'No'])});tableRows('siteRows',rows,7,'No matching assigned collection sites.');};render();$('#siteSearch')?.addEventListener('input',render);}
async function initResults(){
  const d=await resultWorkflow({action:'workspace'}),orders=d.orders||[],results=d.results||[],reports=d.reports||[];
  const root=$('#pageContent'),orderMap=new Map(orders.map(x=>[x.id,x])),reportMap=new Map(reports.map(x=>[x.test_result_id,x]));
  const finalized=results.filter(x=>x.finalized_at&&x.final_status!=='pending'&&x.final_status!=='mro_pending');
  const mroQueue=results.filter(x=>x.final_status==='mro_pending'||String(x.mro_status||'').includes('pending'));
  root.innerHTML=`
    <div class="saas-notice" id="pageNotice" hidden></div>
    <section class="metrics">
      <article class="metric-card"><div class="metric-label">Results</div><div class="metric-value">${results.length}</div><div class="metric-note">Current testing-result records</div></article>
      <article class="metric-card"><div class="metric-label">MRO Review</div><div class="metric-value">${mroQueue.length}</div><div class="metric-note">Pending verification</div></article>
      <article class="metric-card"><div class="metric-label">Finalized</div><div class="metric-value">${finalized.length}</div><div class="metric-note">Verified final outcomes</div></article>
      <article class="metric-card"><div class="metric-label">Access</div><div class="metric-value" style="font-size:18px">${d.can_sensitive?'DER Sensitive':'Summary'}</div><div class="metric-note">${d.can_sensitive?'Authorized sensitive-result role':'Employer result summary access'}</div></article>
    </section>
    <div class="saas-notice"><strong>Result workflow:</strong> screenings4u Admin records laboratory activity and MRO verification. Finalized results and official screenings4u Result Reports appear here from the same testing-order record.</div>
    <section class="card">
      <div class="card-head"><div><h2>Testing Results</h2><span>Verified outcomes and current MRO workflow status.</span></div></div>
      <div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Order</th><th>Employee / Driver</th><th>Test</th><th>Preliminary</th><th>MRO</th><th>Final</th><th>Date</th><th>Report</th></tr></thead><tbody id="resultRows"></tbody></table></div></div>
    </section>`;
  const rows=results.map(r=>{
    const o=orderMap.get(r.testing_order_id)||{},rp=reportMap.get(r.id);
    const report=rp?linkButton('View Result Report',rootUrl(`result-report.html?report=${encodeURIComponent(rp.id)}&employer=${encodeURIComponent(context.membership.employer_id)}`)):'—';
    const mro=d.can_sensitive?(r.mros?.name||pretty(r.mro_status||'—')):pretty(r.mro_status||'—');
    return tr([o.order_number||'—',employeeName(o.employees),pretty(o.test_type),pretty(r.preliminary_status),mro,pretty(r.final_status),fmtDateTime(r.finalized_at||r.result_date),report]);
  });
  tableRows('resultRows',rows,8,'No results available.');
}
async function initActionCenter(){
  const d=await notificationWorkflow({action:'workspace'}),actions=d.actions||[],root=$('#pageContent');
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div>
    <section class="metrics">
      <article class="metric-card"><div class="metric-label">Open Actions</div><div class="metric-value">${actions.length}</div><div class="metric-note">Across enabled Workforce workflows</div></article>
      <article class="metric-card"><div class="metric-label">Critical</div><div class="metric-value">${d.counts?.critical||0}</div><div class="metric-note">Immediate attention</div></article>
      <article class="metric-card"><div class="metric-label">High Priority</div><div class="metric-value">${d.counts?.high||0}</div><div class="metric-note">Operational deadlines</div></article>
      <article class="metric-card"><div class="metric-label">Delivery Failures</div><div class="metric-value">${d.counts?.failed_notifications||0}</div><div class="metric-note">Notification failures</div></article>
    </section>
    ${d.action_center_enabled?'<div class="saas-notice">Action Center combines outstanding testing, MRO, compliance, RTD/follow-up, credential, training, post-accident, document-expiration, and notification-delivery items that your role is authorized to see.</div>':'<div class="saas-notice">The Action Center feature is not enabled for this Employer plan.</div>'}
    <section class="card"><div class="card-head"><div><h2>Action Center</h2><span>Prioritized work requiring Employer attention.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Priority</th><th>Type</th><th>Item</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody id="actionRows"></tbody></table></div></div></section>`;
  const rows=actions.map(a=>{const go=linkButton('Open',a.url);return tr([pretty(a.priority),pretty(a.type),`${a.title}${a.detail?' — '+a.detail:''}`,fmtDateTime(a.due_at),pretty(a.status),go])});
  tableRows('actionRows',rows,6,d.action_center_enabled?'No action-center items.':'Action Center is not enabled.');
}
async function initCompliance(){
  const d=await complianceWorkflow({action:'workspace'}),cases=d.cases||[],tasks=d.tasks||[],saps=d.sap_cases||[];
  const root=$('#pageContent'),sapByCase=new Map();saps.forEach(x=>{if(!sapByCase.has(x.compliance_case_id))sapByCase.set(x.compliance_case_id,x)});
  const open=cases.filter(x=>!['resolved','closed'].includes(x.status)),critical=open.filter(x=>x.priority==='critical'),due=tasks.filter(x=>!['complete','cancelled'].includes(x.status));
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div>
    <section class="metrics"><article class="metric-card"><div class="metric-label">Open Cases</div><div class="metric-value">${open.length}</div><div class="metric-note">Employer compliance cases</div></article><article class="metric-card"><div class="metric-label">Critical</div><div class="metric-value">${critical.length}</div><div class="metric-note">Immediate attention</div></article><article class="metric-card"><div class="metric-label">Open Tasks</div><div class="metric-value">${due.length}</div><div class="metric-note">Outstanding compliance actions</div></article><article class="metric-card"><div class="metric-label">Workflow</div><div class="metric-value" style="font-size:18px">Admin Managed</div><div class="metric-note">SAP / RTD controlled by screenings4u Admin</div></article></section>
    <div class="saas-notice"><strong>Positive / refusal workflow:</strong> when screenings4u Admin finalizes a Positive or Refusal result, the linked employee is placed on Compliance Hold and the SAP / Return-to-Duty workflow becomes visible here.</div>
    <section class="card"><div class="card-head"><div><h2>Compliance Cases</h2><span>Read-only account view of Admin-managed compliance cases.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Case</th><th>Employee / Driver</th><th>Event</th><th>Source Order</th><th>Priority</th><th>Status</th><th>Clearinghouse</th><th>RTD</th></tr></thead><tbody id="complianceRows"></tbody></table></div></div></section>`;
  tableRows('complianceRows',cases.map(c=>tr([c.case_number||'—',employeeName(c.employees),pretty(c.event_type),c.testing_orders?.order_number||'—',pretty(c.priority),pretty(c.status),pretty(c.clearinghouse_status||'—'),pretty(sapByCase.get(c.id)?.return_to_duty_status||'not started')])),8,'No compliance cases.');
}
async function initPostAccident(){let d=await advanced({action:'post_accidents'});const fill=()=>{setOptions('#paEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');setOptions('#paProgram',d.programs||[],x=>x.id,x=>`${x.name} — ${pretty(x.program_type)}`,'Optional program');};const render=()=>tableRows('postAccidentRows',(d.events||[]).map(x=>tr([employeeName((d.employees||[]).find(e=>e.id===x.employee_id)),fmtDateTime(x.occurred_at),pretty(x.program_type),x.dot_agency||'—',x.testing_required?'Yes':'No',pretty(x.status)])),6,'No post-accident events.');fill();render();$('#paType')?.addEventListener('change',e=>{$('#paAgency').disabled=e.currentTarget.value==='NON_DOT'});$('#postAccidentForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,x=formObject(form);x.decision_data={fatality:!!x.fatality,injury:!!x.injury,tow:!!x.tow,citation:!!x.citation,contribution:'no',faa_accident:!!x.fatality,fra_event:x.fatality?'major_accident':'none',fra_exception:'no',phmsa_accident:!!x.fatality,smi:!!x.fatality,directly_involved:true,disabled_transit:!!x.tow};try{await advanced({action:'save_post_accident',event:x,create_orders:true});form.reset();d=await advanced({action:'post_accidents'});fill();render();notice('Post-accident determination saved and required testing orders created.','success')}catch(e){notice(e.message,'error')}});}
async function initRTD(){
  const d=await complianceWorkflow({action:'workspace'}),cases=d.cases||[],saps=d.sap_cases||[],follow=d.follow_up_tests||[];
  const caseMap=new Map(cases.map(x=>[x.id,x])),root=$('#pageContent');
  const active=saps.filter(x=>!['completed','closed'].includes(x.status)),outstanding=follow.filter(x=>!['completed','cancelled'].includes(x.status));
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div><section class="metrics"><article class="metric-card"><div class="metric-label">SAP / RTD Cases</div><div class="metric-value">${saps.length}</div><div class="metric-note">${active.length} active</div></article><article class="metric-card"><div class="metric-label">Follow-Up Requirements</div><div class="metric-value">${follow.length}</div><div class="metric-note">${outstanding.length} outstanding</div></article><article class="metric-card"><div class="metric-label">Plan Access</div><div class="metric-value" style="font-size:18px">${d.rtd_enabled?'Enabled':'Not Enabled'}</div><div class="metric-note">RTD / Follow-Up entitlement</div></article><article class="metric-card"><div class="metric-label">Administration</div><div class="metric-value" style="font-size:18px">screenings4u</div><div class="metric-note">Admin-controlled testing workflow</div></article></section>
    <div class="saas-notice">A finalized negative Return-to-Duty result is required before screenings4u Admin can release an employee / driver from Compliance Hold. Follow-up testing may continue after the employee returns to duty.</div>
    <section class="card"><div class="card-head"><div><h2>Return-to-Duty Cases</h2><span>SAP referral, RTD testing, and follow-up progress.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Case</th><th>Employee / Driver</th><th>SAP</th><th>RTD Status</th><th>Case Status</th><th>Follow-Up</th></tr></thead><tbody id="rtdRows"></tbody></table></div></div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Follow-Up Testing Plan</h2><span>Testing orders are generated by screenings4u Admin from these requirements.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Case</th><th>#</th><th>Required By</th><th>Status</th><th>Testing Order</th><th>Order Status</th></tr></thead><tbody id="followUpRows"></tbody></table></div></div></section>`;
  tableRows('rtdRows',saps.map(s=>{const c=caseMap.get(s.compliance_case_id),fs=follow.filter(f=>f.sap_case_id===s.id);return tr([c?.case_number||'—',employeeName(c?.employees),s.organizations?.legal_name||'Unassigned',pretty(s.return_to_duty_status||'—'),pretty(s.status),`${fs.filter(f=>f.status==='completed').length}/${fs.length}`])}),6,'No SAP / Return-to-Duty cases.');
  tableRows('followUpRows',follow.map(f=>{const s=saps.find(x=>x.id===f.sap_case_id),c=caseMap.get(s?.compliance_case_id);return tr([c?.case_number||'—',String(f.sequence_number),fmtDate(f.required_by),pretty(f.status),f.testing_orders?.order_number||'Not created',pretty(f.testing_orders?.status||'—')])}),6,'No follow-up requirements.');
}
async function initTraining(){let d=await advanced({action:'training'});setOptions('#trainingEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Account-level training');const render=()=>tableRows('trainingRows',(d.records||[]).map(x=>tr([employeeName(x.employees),x.training_title, x.provider||'—',fmtDate(x.completed_at),fmtDate(x.expires_at),pretty(x.status)])),6,'No training records.');render();$('#trainingForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;try{await advanced({action:'save_training',record:formObject(form)});form.reset();d=await advanced({action:'training'});setOptions('#trainingEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Account-level training');render();notice('Training record saved.','success')}catch(e){notice(e.message,'error')}});}
async function initCredentials(){let d=await advanced({action:'credentials'});setOptions('#credentialEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');const render=()=>tableRows('credentialRows',(d.credentials||[]).map(x=>tr([employeeName(x.employees),x.credential_type,x.credential_number||'—',fmtDate(x.expires_at),pretty(x.status)])),5,'No credentials.');render();$('#credentialForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;try{await advanced({action:'save_credential',credential:formObject(form)});form.reset();d=await advanced({action:'credentials'});setOptions('#credentialEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');render();notice('Credential saved.','success')}catch(e){notice(e.message,'error')}});}
async function initPolicies(){let d=await advanced({action:'policies'});setOptions('#policySelect',d.policies||[],p=>p.id,p=>`${p.title} — ${p.version||'current'}`,'Choose policy');const multi=$('#policyEmployees');if(multi){multi.replaceChildren();for(const e of d.employees||[]){const o=document.createElement('option');o.value=e.id;o.textContent=employeeName(e);multi.append(o)}}const render=()=>tableRows('policyRows',(d.acknowledgments||[]).map(x=>tr([employeeName(x.employees),x.ctpa_policy_documents?.title||'—',x.ctpa_policy_documents?.version||'—',pretty(x.status),fmtDate(x.distributed_at),fmtDate(x.acknowledged_at)])),6,'No policy distributions.');render();$('#policyForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const selected=[...multi.selectedOptions].map(o=>o.value);try{await advanced({action:'distribute_policy',policy_document_id:$('#policySelect').value,employee_ids:selected});d=await advanced({action:'policies'});render();notice('Policy distributed.','success')}catch(e){notice(e.message,'error')}});}
async function initDocuments(){
  let d=await documentWorkflow({action:'workspace'}),root=$('#pageContent');
  const draw=()=>{
    const docs=d.documents||[],links=d.links||[],employees=d.employees||[],programs=d.programs||[],orders=d.testing_orders||[],cases=d.compliance_cases||[];
    const linkMap=new Map();links.forEach(l=>{if(!linkMap.has(l.document_id))linkMap.set(l.document_id,[]);linkMap.get(l.document_id).push(l)});
    root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div>
      <section class="metrics">
        <article class="metric-card"><div class="metric-label">Documents</div><div class="metric-value">${docs.length}</div><div class="metric-note">Current Employer records</div></article>
        <article class="metric-card"><div class="metric-label">Compliance Linked</div><div class="metric-value">${docs.filter(x=>x.compliance_case_id||linkMap.get(x.id)?.some(l=>l.target_type==='compliance_case')).length}</div><div class="metric-note">Case-related records</div></article>
        <article class="metric-card"><div class="metric-label">Sensitive</div><div class="metric-value">${docs.filter(x=>x.access_level==='sensitive').length}</div><div class="metric-note">${d.can_sensitive?'Authorized DER visibility':'Hidden unless authorized'}</div></article>
        <article class="metric-card"><div class="metric-label">Management</div><div class="metric-value" style="font-size:18px">${d.can_manage?'Enabled':'Read Only'}</div><div class="metric-note">Based on Employer role permissions</div></article>
      </section>
      ${d.can_manage?`<section class="card"><div class="card-head"><div><h2>Upload Employer Document</h2><span>PDF, PNG, or JPG up to 10 MB. Link the file directly to the record it supports.</span></div></div><div class="card-body"><form class="management-form" id="documentForm"><div class="grid grid-2">
        <label>File<input accept="application/pdf,image/png,image/jpeg" id="documentFile" required type="file"></label>
        <label>Document Type<input name="document_type" value="compliance_record"></label>
        <label>Access Level<select name="access_level"><option value="standard">Standard</option><option value="restricted">Restricted</option>${d.can_sensitive?'<option value="sensitive">Sensitive</option>':''}</select></label>
        <label>Title<input name="title"></label>
        <label>Employee / Driver<select name="employee_id"><option value="">Not linked</option>${employees.map(x=>`<option value="${x.id}">${employeeName(x)}${x.employee_number?' — '+x.employee_number:''}</option>`).join('')}</select></label>
        <label>Program<select name="program_id"><option value="">Not linked</option>${programs.map(x=>`<option value="${x.id}">${x.name} — ${pretty(x.program_type)}</option>`).join('')}</select></label>
        <label>Testing Order<select name="testing_order_id"><option value="">Not linked</option>${orders.map(x=>`<option value="${x.id}">${x.order_number} — ${pretty(x.reason)}</option>`).join('')}</select></label>
        <label>Compliance Case<select name="compliance_case_id"><option value="">Not linked</option>${cases.map(x=>`<option value="${x.id}">${x.case_number} — ${pretty(x.event_type)}</option>`).join('')}</select></label>
        <label style="grid-column:1/-1">Description<input name="description"></label>
      </div><button class="btn btn-orange" type="submit">Upload & Register</button></form></div></section>`:`<div class="saas-notice">Your Employer role has read-only document access. Uploading and linking records requires the Documents Manage permission.</div>`}
      <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Document Repository</h2><span>Employer documents and supporting compliance records.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>File</th><th>Type</th><th>Access</th><th>Employee</th><th>Testing / Case</th><th>Uploaded</th><th></th></tr></thead><tbody id="documentRows"></tbody></table></div></div></section>`;
    const rows=docs.map(x=>{
      const workflow=x.compliance_cases?.case_number||x.testing_orders?.order_number||'—';
      const actions=document.createElement('div');actions.className='row-actions';
      const open=actionButton('Open',async()=>{try{const r=await documentWorkflow({action:'signed_url',document_id:x.id});window.open(r.url,'_blank','noopener')}catch(e){notice(e.message,'error')}});actions.append(open);
      if(d.can_manage&&!x.legal_hold){const ar=actionButton('Archive',async()=>{if(!window.confirm('Archive this document record?'))return;try{await documentWorkflow({action:'archive',document_id:x.id});d=await documentWorkflow({action:'workspace'});draw();notice('Document archived.','success')}catch(e){notice(e.message,'error')}});actions.append(ar)}
      return tr([x.metadata?.title||x.file_name,pretty(x.document_type),pretty(x.access_level),employeeName(x.employees),workflow,fmtDateTime(x.uploaded_at),actions]);
    });
    tableRows('documentRows',rows,7,'No documents.');

    if(d.can_manage){
      $('#documentForm')?.addEventListener('submit',async ev=>{
        ev.preventDefault();const form=ev.currentTarget,file=$('#documentFile')?.files?.[0];
        if(!file)return notice('Choose a file.','error');
        if(file.size>10*1024*1024)return notice('File must be 10 MB or smaller.','error');
        if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return notice('Upload a PDF, PNG, or JPG.','error');
        try{
          notice('Uploading document…');
          const tenant=context?.membership?.tenant_id,employer=context?.membership?.employer_id;if(!tenant||!employer)throw new Error('Employer account context is unavailable.');
          const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${tenant}/${employer}/documents/${Date.now()}-${safe}`;
          const up=await supabase.storage.from('workforce-documents').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;
          const fd=formObject(form);
          try{await documentWorkflow({action:'register',document:{...fd,file_name:file.name,storage_bucket:'workforce-documents',storage_path:path,mime_type:file.type,size_bytes:file.size,title:fd.title||file.name}})}
          catch(err){await supabase.storage.from('workforce-documents').remove([path]);throw err}
          d=await documentWorkflow({action:'workspace'});draw();notice('Document uploaded and linked.','success');
        }catch(e){notice(e.message,'error')}
      });
    }
  };
  draw();
}
async function initReports(){
  const root=$('#pageContent'),today=new Date(),prior=new Date(today.getTime()-365*86400000),date=x=>x.toISOString().slice(0,10);
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div><section class="card"><div class="card-head"><div><h2>Employer Reports</h2><span>Operational reporting from the same Workforce records managed through screenings4u Admin.</span></div></div><div class="card-body"><form class="management-form" id="reportFilter"><div class="grid grid-2"><label>Start Date<input name="start_date" type="date" value="${date(prior)}"></label><label>End Date<input name="end_date" type="date" value="${date(today)}"></label></div><button class="btn btn-orange">Run Reports</button></form></div></section><div id="reportOutput" style="margin-top:18px"></div>`;
  const form=$('#reportFilter'),out=$('#reportOutput');
  const load=async()=>{try{notice('Loading reports…');const x=formObject(form),d=await reportingWorkflow({action:'reports',...x}),s=d.summary||{};out.innerHTML=`<section class="metrics">${[['Employees',s.employees],['Programs',s.programs],['Testing Orders',s.testing_orders],['Finalized Results',s.finalized_results],['Compliance Cases',s.compliance_cases],['Documents',s.documents],['Random Selections',s.selections],['Audit Events',s.audit_events]].map(([n,v])=>`<article class="metric-card"><div class="metric-label">${n}</div><div class="metric-value">${v||0}</div><div class="metric-note">Selected reporting period</div></article>`).join('')}</section>
    <section class="card"><div class="card-head"><div><h2>Testing Activity</h2></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Created</th><th>Order</th><th>Employee / Driver</th><th>Program</th><th>Reason</th><th>Test</th><th>Status</th></tr></thead><tbody id="reportTestingRows"></tbody></table></div></div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Compliance Cases</h2></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Opened</th><th>Case</th><th>Employee / Driver</th><th>Event</th><th>Priority</th><th>Status</th></tr></thead><tbody id="reportComplianceRows"></tbody></table></div></div></section>
    <section class="card" style="margin-top:18px"><div class="card-head"><div><h2>Random Selection History</h2></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Date</th><th>Pool</th><th>Population</th><th>Drug</th><th>Alcohol</th><th>Status</th></tr></thead><tbody id="reportSelectionRows"></tbody></table></div></div></section>`;
    tableRows('reportTestingRows',(d.testing_orders||[]).map(o=>tr([fmtDateTime(o.created_at),o.order_number,employeeName(o.employees),o.programs?.name||'—',pretty(o.reason),pretty(o.test_type),pretty(o.status)])),7,'No testing activity.');
    tableRows('reportComplianceRows',(d.compliance_cases||[]).map(c=>tr([fmtDateTime(c.opened_at),c.case_number,employeeName(c.employees),pretty(c.event_type),pretty(c.priority),pretty(c.status)])),6,'No compliance cases.');
    tableRows('reportSelectionRows',(d.selections||[]).map(x=>tr([fmtDateTime(x.selection_date),x.random_pools?.name||'—',String(x.population_size||0),String(x.drug_selection_count||0),String(x.alcohol_selection_count||0),pretty(x.status)])),6,'No random selections.');notice('Reports loaded.','success')}catch(e){out.innerHTML=`<div class="saas-empty">${e.message}</div>`;notice(e.message,'error')}};
  form.onsubmit=ev=>{ev.preventDefault();load()};load();
}
async function initAudit(){
  const root=$('#pageContent'),today=new Date(),prior=new Date(today.getTime()-90*86400000),date=x=>x.toISOString().slice(0,10);
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div><section class="card"><div class="card-head"><div><h2>Audit History</h2><span>Account, testing, compliance, document, and administrative events recorded for this Employer organization.</span></div></div><div class="card-body"><form id="auditHistoryFilter" class="management-form"><div class="grid grid-2"><label>Start Date<input name="start_date" type="date" value="${date(prior)}"></label><label>End Date<input name="end_date" type="date" value="${date(today)}"></label></div><button class="btn btn-orange">Load Audit History</button></form><div class="management-table-wrap" style="margin-top:18px"><table class="management-table"><thead><tr><th>Date / Time</th><th>Actor</th><th>Action</th><th>Resource</th><th>Resource ID</th></tr></thead><tbody id="auditRows"></tbody></table></div></div></section>`;
  const form=$('#auditHistoryFilter');const load=async()=>{try{const d=await reportingWorkflow({action:'audit_history',...formObject(form)});tableRows('auditRows',(d.audit_events||[]).map(x=>tr([fmtDateTime(x.event_at),x.actor_name||'System',pretty(x.action),pretty(x.resource_type),x.resource_id||'—'])),5,'No audit events in this period.');notice('Audit history loaded.','success')}catch(e){tableRows('auditRows',[],5,e.message);notice(e.message,'error')}};form.onsubmit=ev=>{ev.preventDefault();load()};load();
}
async function initNotifications(){
  const d=await notificationWorkflow({action:'workspace'}),rows=d.notifications||[],root=$('#pageContent');
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div>
    <section class="metrics">
      <article class="metric-card"><div class="metric-label">Notifications</div><div class="metric-value">${rows.length}</div><div class="metric-note">Employer-scoped history</div></article>
      <article class="metric-card"><div class="metric-label">Queued</div><div class="metric-value">${d.counts?.queued_notifications||0}</div><div class="metric-note">Awaiting delivery workflow</div></article>
      <article class="metric-card"><div class="metric-label">Failed</div><div class="metric-value">${d.counts?.failed_notifications||0}</div><div class="metric-note">Delivery failures</div></article>
      <article class="metric-card"><div class="metric-label">Role</div><div class="metric-value" style="font-size:18px">${pretty(d.role||'Employer User')}</div><div class="metric-note">${d.can_sensitive?'Sensitive-result notices authorized':'Standard Employer notice visibility'}</div></article>
    </section>
    <div class="saas-notice">Notification status reflects the delivery workflow: Queued means accepted for processing; Sent/Delivered means provider progress was recorded; Failed includes the recorded delivery error.</div>
    <section class="card"><div class="card-head"><div><h2>Notification History</h2><span>Notices related to this Employer account and your authorized workflows.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Queued</th><th>Event</th><th>Channel</th><th>Subject</th><th>Status</th><th>Failure</th></tr></thead><tbody id="notificationRows"></tbody></table></div></div></section>`;
  tableRows('notificationRows',rows.map(x=>tr([fmtDateTime(x.queued_at),pretty(x.event_type),pretty(x.channel),x.subject||'—',pretty(x.status),x.failure_reason||'—'])),6,'No notifications.');
}
async function initCompany(){let d=await advanced({action:'company_profile'});fillForm($('#companyForm'),d.employer);$('#companyForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const r=await advanced({action:'save_company_profile',profile:formObject(ev.currentTarget)});fillForm(ev.currentTarget,r.employer);notice('Company profile saved.','success')}catch(e){notice(e.message,'error')}});}
async function initIntegrations(){const d=await advanced({action:'integrations'});tableRows('integrationRows',(d.integrations||[]).map(x=>tr([x.name,pretty(x.integration_type),x.provider||'—',pretty(x.status),fmtDateTime(x.last_sync_at)])),5,'No integrations configured.');}
async function initOrders(){const d=await invoke('workforce-order-history',{portal:'employer'});const rows=d.orders||[];setText('#orderTotal',rows.length);const paid=x=>['paid','provisioned','completed','active'].includes(String(x.status||'').toLowerCase())||!!x.paid_at;setText('#orderPaid',rows.filter(paid).length);setText('#orderOpen',rows.filter(x=>!paid(x)).length);tableRows('orderRows',rows.map(x=>{const a=x.view_url?linkButton('View',x.view_url):x.payment_url?linkButton('Pay',x.payment_url):'—';return tr([x.order_number||'—',x.title||x.description||'Order',fmtDateTime(x.created_at),fmtMoney(x.amount,x.currency),pretty(x.status),a])}),6,'No orders found.');}
async function initSubscription(){
 const d=await subscriptionApi({}),s=d.subscription||{},p=s.plans||{},root=$('#pageContent'),billing=document.body.dataset.page==='billing';
 if(billing){
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div><section class="metrics"><article class="metric-card"><div class="metric-label">Plan</div><div class="metric-value" style="font-size:18px">${p.name||'—'}</div><div class="metric-note">${pretty(s.status)}</div></article><article class="metric-card"><div class="metric-label">Workforce Usage</div><div class="metric-value">${d.workforce_usage?.display||'—'}</div><div class="metric-note">Active employees / drivers</div></article><article class="metric-card"><div class="metric-label">Invoices</div><div class="metric-value">${(d.invoices||[]).length}</div><div class="metric-note">Billing history</div></article></section><section class="card"><div class="card-head"><div><h2>Invoices & Payments</h2><span>Payment status reflects recorded billing activity.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Invoice</th><th>Created</th><th>Total</th><th>Paid</th><th>Status</th><th></th></tr></thead><tbody id="invoiceRows"></tbody></table></div></div></section>`;
  tableRows('invoiceRows',(d.invoices||[]).map(x=>{let a='—';if(x.payment_url)a=linkButton('Pay',rootUrl(x.payment_url));else if(x.view_url)a=linkButton('View',rootUrl(x.view_url));return tr([x.invoice_number||x.id,fmtDateTime(x.created_at),fmtMoney(x.total??x.amount_due,x.currency),fmtMoney(x.amount_paid,x.currency),pretty(x.status),a])}),6,'No invoices.');
 }else{
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div><section class="metrics"><article class="metric-card"><div class="metric-label">Current Plan</div><div class="metric-value" style="font-size:18px">${p.name||'—'}</div><div class="metric-note">${pretty(s.status)}</div></article><article class="metric-card"><div class="metric-label">Workforce Usage</div><div class="metric-value">${d.workforce_usage?.display||'—'}</div><div class="metric-note">${d.workforce_usage?.remaining==null?'Unlimited plan':`${d.workforce_usage.remaining} remaining`}</div></article><article class="metric-card"><div class="metric-label">Renewal</div><div class="metric-value" style="font-size:18px">${fmtDate(s.renewal_date||s.stripe_current_period_end)}</div><div class="metric-note">Subscription period</div></article></section><section class="card"><div class="card-head"><div><h2>Plan Features</h2><span>Plan entitlements plus screenings4u account overrides.</span></div></div><div class="card-body"><div class="feature-grid">${(d.features||[]).map(f=>`<div class="feature-row"><div><strong>${f.name||pretty(f.code)}</strong><span>${f.description||pretty(f.category||'Feature')} · ${pretty(f.source)}</span></div><span class="badge ${f.enabled?'success':'neutral'}">${f.enabled?'Enabled':'Disabled'}</span></div>`).join('')||'<div class="saas-empty">No plan features returned.</div>'}</div></div></section>`;
 }
}
async function initSettings(){const d=await api({action:'settings'});fillForm($('#settingsForm'),d.employer);$('#settingsForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const r=await api({action:'save_settings',settings:formObject(ev.currentTarget)});fillForm(ev.currentTarget,r.employer);notice('Account settings saved.','success')}catch(e){notice(e.message,'error')}});}
async function initSupportAccess(){const d=await advanced({action:'support_consent'});const root=$('#supportAccessContent');if(!root)return;root.replaceChildren();const c=d.consent;if(!c){const e=document.createElement('div');e.className='saas-empty';e.textContent='There is no active support-access request.';root.append(e);return;}const p=document.createElement('p');p.textContent=`Status: ${pretty(c.status)}${c.expires_at?' · Expires '+fmtDateTime(c.expires_at):''}`;root.append(p);if(['pending','requested'].includes(String(c.status))){const name=document.createElement('input');name.placeholder='Authorized signer name';name.id='supportSigner';const grant=actionButton('Grant Access',async()=>{try{await advanced({action:'respond_support_consent',id:c.id,decision:'granted',signer_name:name.value});notice('Support access granted.','success');await initSupportAccess()}catch(e){notice(e.message,'error')}});const deny=actionButton('Deny',async()=>{try{await advanced({action:'respond_support_consent',id:c.id,decision:'denied'});notice('Support access denied.','success');await initSupportAccess()}catch(e){notice(e.message,'error')}});root.append(name,grant,deny);}else if(c.status==='granted'){root.append(actionButton('Revoke Access',async()=>{try{await advanced({action:'respond_support_consent',id:c.id,decision:'revoked'});notice('Support access revoked.','success');await initSupportAccess()}catch(e){notice(e.message,'error')}}));}}
async function initSupport(){async function load(){const d=await invoke('workforce-support',{action:'list'});tableRows('supportRows',(d.tickets||[]).map(x=>tr([x.ticket_number,x.subject,pretty(x.category),pretty(x.status),fmtDate(x.created_at)])),5,'No support tickets.');}await load();const f=$('#supportForm');const feature=new URLSearchParams(location.search).get('feature');if(feature&&f){f.elements.category.value='feature_request';f.elements.subject.value=`Request access to ${pretty(feature)}`;f.elements.message.value=`Please review our account and the ${pretty(feature)} feature.`;}f?.addEventListener('submit',async ev=>{ev.preventDefault();try{await invoke('workforce-support',{action:'create',...formObject(ev.currentTarget)});ev.currentTarget.reset();await load();notice('Support ticket opened.','success')}catch(e){notice(e.message,'error')}});}
function parseCSV(text){const rows=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quote&&n==='"'){field+='"';i++;continue}if(c==='"'){quote=!quote;continue}if(c===','&&!quote){row.push(field);field='';continue}if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[];continue}field+=c}row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);if(rows.length<2)return[];const head=rows[0].map(x=>x.trim().toLowerCase());return rows.slice(1).map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]||'').trim()])))}
async function initBulk(){ $('#bulkForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const file=$('#bulkFile')?.files?.[0];if(!file)return notice('Choose a CSV file.','error');try{const rows=parseCSV(await file.text());if(!rows.length)throw new Error('The CSV has no data rows.');const r=await advanced({action:'bulk_import',file_name:file.name,rows});const s=$('#bulkSummary');if(s)s.textContent=`Imported ${r.imported||0}; rejected ${r.rejected||0}.`;notice('Import finished.','success')}catch(e){notice(e.message,'error')}});}
async function initEmployeeCompliance(){const [c,t,p,te]=await Promise.all([advanced({action:'credentials'}),advanced({action:'training'}),advanced({action:'policies'}),testing({action:'list'})]);const employees=c.employees||[];const rows=employees.map(e=>{const cs=(c.credentials||[]).filter(x=>x.employee_id===e.id),ts=(t.records||[]).filter(x=>x.employee_id===e.id),ps=(p.acknowledgments||[]).filter(x=>x.employee_id===e.id),xs=(te.orders||[]).filter(x=>x.employee_id===e.id);return tr([employeeName(e),String(cs.length),String(ts.length),String(ps.length),String(xs.length),e.dot_covered?'Yes':'No'])});tableRows('employeeComplianceRows',rows,6,'No employees available.');}
async function initMembers(filterDER=false){
 let d=await invoke('workforce-employer-members',{action:'list'}),root=$('#pageContent'),allowed=filterDER?['der','supervisor']:['employer_admin','der','supervisor','hr_admin'];
 const render=()=>{
  const members=(d.members||[]).filter(x=>!filterDER||allowed.includes(x.roles?.code));
  root.innerHTML=`<div class="saas-notice" id="pageNotice" hidden></div>${d.can_manage?`<section class="card"><div class="card-head"><div><h2>${filterDER?'Invite DER / Supervisor':'Invite Account User'}</h2><span>Employer Admins with Users Manage permission can invite and manage staff accounts.</span></div></div><div class="card-body"><form id="memberInviteForm" class="management-form"><div class="grid grid-2"><label>First Name<input name="first_name"></label><label>Last Name<input name="last_name"></label><label>Email<input name="email" type="email" required></label><label>Role<select name="role_code">${allowed.map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}</select></label></div><button class="btn btn-orange">Send Invite</button></form></div></section>`:`<div class="saas-notice">Your Employer role has read-only Account User access.</div>`}<section class="card" style="margin-top:18px"><div class="card-head"><div><h2>${filterDER?'DERs & Supervisors':'Account Users'}</h2><span>Staff memberships are separate from Employee / Driver portal accounts.</span></div></div><div class="card-body"><div class="management-table-wrap"><table class="management-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Primary</th><th></th></tr></thead><tbody id="${filterDER?'derRows':'memberRows'}"></tbody></table></div></div></section>`;
  const body=$(`#${filterDER?'derRows':'memberRows'}`);body.replaceChildren();
  if(!members.length){const r=document.createElement('tr'),c=document.createElement('td');c.colSpan=6;c.innerHTML='<div class="saas-empty">No account users.</div>';r.append(c);body.append(r)}
  else for(const m of members){const user=m.profiles?.full_name||m.profiles?.email||'Account User';let rc=pretty(m.roles?.code||'—'),sc=pretty(m.status),act='—';if(d.can_manage){const rs=document.createElement('select');for(const r of (d.roles||[]).filter(x=>allowed.includes(x.code))){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;o.selected=r.id===m.role_id;rs.append(o)}const ss=document.createElement('select');for(const v of ['active','suspended','revoked']){const o=document.createElement('option');o.value=v;o.textContent=pretty(v);o.selected=v===m.status;ss.append(o)}const save=actionButton('Save',async()=>{try{await invoke('workforce-employer-members',{action:'save',member:{id:m.id,role_id:rs.value,status:ss.value}});d=await invoke('workforce-employer-members',{action:'list'});render();notice('Account access updated.','success')}catch(e){notice(e.message,'error')}});rc=rs;sc=ss;act=save}body.append(tr([user,m.profiles?.email||'—',rc,sc,m.is_primary?'Yes':'No',act]))}
  $('#memberInviteForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{await invoke('workforce-employer-members',{action:'invite',member:formObject(ev.currentTarget)});d=await invoke('workforce-employer-members',{action:'list'});render();notice('Account invitation sent.','success')}catch(e){notice(e.message,'error')}})
 };
 render();
}
async function initOnboarding(){ const data=await invoke('workforce-customer-onboarding',{action:'status',portal:'employer'}); if(data.completed){location.replace('dashboard.html');return;}const f=$('#onboardingForm');fillForm(f,{...data.profile,...data.entity,...data.organization,...data.onboarding,contact_email:data.onboarding?.contact_email||data.user?.email});const same=$('#sameBilling'),box=$('#billingAddress');const sync=()=>{if(box)box.hidden=!!same?.checked};same?.addEventListener('change',sync);sync();f?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,x=formObject(form);try{await invoke('workforce-customer-onboarding',{action:'complete',portal:'employer',onboarding:x});location.replace('dashboard.html')}catch(e){notice(e.message,'error')}});}

async function initTestingSetup(){const d=await api({action:'entitlements'});const root=$('#testingSetup');if(!root)return;root.replaceChildren();const vals=[['Plan',d.subscription?.plans?.name||d.subscription?.plan_name||'Active plan'],['Testing Orders',d.entitlements?.testing_orders?'Enabled':'Not enabled'],['Collection Sites',d.entitlements?.collection_sites?'Enabled':'Not enabled'],['Results / MRO workflow',d.entitlements?.results_summary?'Enabled':'Not enabled'],['Post-Accident',d.entitlements?.post_accident?'Enabled':'Not enabled']];for(const [k,v] of vals){const row=document.createElement('div');row.className='setting-row';const a=document.createElement('strong');a.textContent=k;const b=document.createElement('span');b.textContent=v;row.append(a,b);root.append(row)}}
async function initClearinghouse(){const d=await advanced({action:'credentials'});const rows=(d.employees||[]).filter(e=>e.dot_covered&&String(e.dot_agency||'').toUpperCase()==='FMCSA').map(e=>{const creds=(d.credentials||[]).filter(c=>c.employee_id===e.id);const ch=creds.find(c=>/clearinghouse/i.test(c.credential_type||''));return tr([employeeName(e),[e.cdl_number,e.cdl_state].filter(Boolean).join(' / ')||'—','FMCSA',creds.some(c=>String(c.status)==='expired')?'Action required':'Review current',ch?pretty(ch.status):'Not recorded'])});tableRows('clearinghouseRows',rows,5,'No FMCSA-covered drivers found.');}
async function initAuditPacket(){
  const form=$('#auditPacketForm'),out=$('#auditPacketOutput');
  if(form){const end=new Date(),start=new Date(end.getTime()-365*86400000);form.elements.start_date.value=start.toISOString().slice(0,10);form.elements.end_date.value=end.toISOString().slice(0,10)}
  form?.addEventListener('submit',async ev=>{ev.preventDefault();try{const x=formObject(ev.currentTarget);notice('Generating audit packet…');const r=await reportingWorkflow({action:'audit_packet',...x});out.innerHTML=`<div class="saas-notice"><strong>Audit packet ready.</strong> ${Object.entries(r.summary||{}).map(([k,v])=>`${pretty(k)}: ${v}`).join(' · ')}</div>`;const b=actionButton('Download Audit Packet PDF',()=>downloadBase64File(r.base64,r.filename,r.mime_type));out.append(b);downloadBase64File(r.base64,r.filename,r.mime_type);notice('Audit packet generated.','success')}catch(e){out.innerHTML=`<div class="saas-empty">${e.message}</div>`;notice(e.message,'error')}});
}
const initializers={dashboard:initDashboard,employees:initEmployees,'employee-compliance':initEmployeeCompliance,'driver-qualification':initCredentials,clearinghouse:initClearinghouse,'ders-supervisors':()=>initMembers(true),'account-users':()=>initMembers(false),locations:initLocations,programs:initPrograms,'program-enrollment':initEnrollment,'random-pools':initRandomPools,'pool-membership':initPoolMembership,'random-selections':initSelections,'testing-orders':initTesting,'testing-setup':initTestingSetup,'collection-sites':initSites,results:initResults,'action-center':initActionCenter,compliance:initCompliance,'post-accident':initPostAccident,'rtd-follow-up':initRTD,'training-records':initTraining,'policy-acknowledgments':initPolicies,documents:initDocuments,reports:initReports,'audit-packet':initAuditPacket,'audit-history':initAudit,notifications:initNotifications,'company-profile':initCompany,integrations:initIntegrations,'order-history':initOrders,subscription:initSubscription,billing:initSubscription,'account-settings':initSettings,'support-access':initSupportAccess,support:initSupport,'bulk-import':initBulk,onboarding:initOnboarding};

async function boot(){
  bindShell();
  try{
    context=await sessionContext(); if(!context)return;
    renderShell(context);
    bindAccordion();
    if(page!=='onboarding' && !await onboardingGuard())return;
    if(!await enforcePageFeature(context))return;
    const init=initializers[page]; if(init) await init();
  }catch(error){ console.error('Employer portal error',error); notice(error?.message||'We could not load this Employer page.','error'); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
