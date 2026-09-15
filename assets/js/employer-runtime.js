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
async function initActionCenter(){const d=await advanced({action:'workforce_action_center'});setText('#actionCredentials',d.credentials?.length||0);setText('#actionTraining',d.training?.length||0);setText('#actionCompliance',d.compliance?.length||0);setText('#actionPostAccident',d.post_accidents?.length||0);const rows=[];(d.credentials||[]).forEach(x=>rows.push(tr(['Credential',employeeName(x.employees),x.credential_type,fmtDate(x.expires_at),pretty(x.status)])));(d.training||[]).forEach(x=>rows.push(tr(['Training',employeeName(x.employees),x.training_title,fmtDate(x.expires_at),pretty(x.status)])));(d.compliance||[]).forEach(x=>rows.push(tr(['Compliance',employeeName(x.employees),x.case_number||x.event_type,fmtDate(x.opened_at),pretty(x.status)])));(d.post_accidents||[]).forEach(x=>rows.push(tr(['Post-Accident',employeeName(x.employees),'Testing required',fmtDateTime(x.occurred_at),'Open'])));tableRows('actionRows',rows,5,'No action-center items.');}
async function initCompliance(){const d=await api({action:'compliance_detail'});tableRows('complianceRows',(d.cases||[]).map(x=>tr([x.case_number||'—',employeeName(x.employees),pretty(x.event_type),pretty(x.priority),pretty(x.status),fmtDate(x.opened_at)])),6,'No compliance cases.');}
async function initPostAccident(){let d=await advanced({action:'post_accidents'});const fill=()=>{setOptions('#paEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');setOptions('#paProgram',d.programs||[],x=>x.id,x=>`${x.name} — ${pretty(x.program_type)}`,'Optional program');};const render=()=>tableRows('postAccidentRows',(d.events||[]).map(x=>tr([employeeName((d.employees||[]).find(e=>e.id===x.employee_id)),fmtDateTime(x.occurred_at),pretty(x.program_type),x.dot_agency||'—',x.testing_required?'Yes':'No',pretty(x.status)])),6,'No post-accident events.');fill();render();$('#paType')?.addEventListener('change',e=>{$('#paAgency').disabled=e.currentTarget.value==='NON_DOT'});$('#postAccidentForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,x=formObject(form);x.decision_data={fatality:!!x.fatality,injury:!!x.injury,tow:!!x.tow,citation:!!x.citation,contribution:'no',faa_accident:!!x.fatality,fra_event:x.fatality?'major_accident':'none',fra_exception:'no',phmsa_accident:!!x.fatality,smi:!!x.fatality,directly_involved:true,disabled_transit:!!x.tow};try{await advanced({action:'save_post_accident',event:x,create_orders:true});form.reset();d=await advanced({action:'post_accidents'});fill();render();notice('Post-accident determination saved and required testing orders created.','success')}catch(e){notice(e.message,'error')}});}
async function initRTD(){const d=await api({action:'rtd_cases'});tableRows('rtdRows',(d.sap_cases||[]).map(x=>tr([x.compliance_cases?.case_number||'—',employeeName(x.compliance_cases?.employees),pretty(x.status),x.sap_name||x.sap_contact_name||'—',String(x.follow_up_tests?.length||0)])),5,'No RTD / follow-up cases.');}
async function initTraining(){let d=await advanced({action:'training'});setOptions('#trainingEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Account-level training');const render=()=>tableRows('trainingRows',(d.records||[]).map(x=>tr([employeeName(x.employees),x.training_title, x.provider||'—',fmtDate(x.completed_at),fmtDate(x.expires_at),pretty(x.status)])),6,'No training records.');render();$('#trainingForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;try{await advanced({action:'save_training',record:formObject(form)});form.reset();d=await advanced({action:'training'});setOptions('#trainingEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Account-level training');render();notice('Training record saved.','success')}catch(e){notice(e.message,'error')}});}
async function initCredentials(){let d=await advanced({action:'credentials'});setOptions('#credentialEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');const render=()=>tableRows('credentialRows',(d.credentials||[]).map(x=>tr([employeeName(x.employees),x.credential_type,x.credential_number||'—',fmtDate(x.expires_at),pretty(x.status)])),5,'No credentials.');render();$('#credentialForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget;try{await advanced({action:'save_credential',credential:formObject(form)});form.reset();d=await advanced({action:'credentials'});setOptions('#credentialEmployee',d.employees||[],e=>e.id,e=>employeeName(e),'Choose employee');render();notice('Credential saved.','success')}catch(e){notice(e.message,'error')}});}
async function initPolicies(){let d=await advanced({action:'policies'});setOptions('#policySelect',d.policies||[],p=>p.id,p=>`${p.title} — ${p.version||'current'}`,'Choose policy');const multi=$('#policyEmployees');if(multi){multi.replaceChildren();for(const e of d.employees||[]){const o=document.createElement('option');o.value=e.id;o.textContent=employeeName(e);multi.append(o)}}const render=()=>tableRows('policyRows',(d.acknowledgments||[]).map(x=>tr([employeeName(x.employees),x.ctpa_policy_documents?.title||'—',x.ctpa_policy_documents?.version||'—',pretty(x.status),fmtDate(x.distributed_at),fmtDate(x.acknowledged_at)])),6,'No policy distributions.');render();$('#policyForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const selected=[...multi.selectedOptions].map(o=>o.value);try{await advanced({action:'distribute_policy',policy_document_id:$('#policySelect').value,employee_ids:selected});d=await advanced({action:'policies'});render();notice('Policy distributed.','success')}catch(e){notice(e.message,'error')}});}
async function initDocuments(){let d=await api({action:'documents'});const render=()=>tableRows('documentRows',(d.documents||[]).map(x=>tr([x.file_name||x.title||'Document',pretty(x.document_type),fmtDateTime(x.uploaded_at||x.created_at),employeeName(x.employees),x.programs?.name||'—'])),5,'No documents.');render();$('#documentForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,file=$('#documentFile')?.files?.[0];if(!file)return notice('Choose a file.','error');if(file.size>10*1024*1024)return notice('File must be 10 MB or smaller.','error');if(!['application/pdf','image/png','image/jpeg'].includes(file.type))return notice('Upload a PDF, PNG, or JPG.','error');try{notice('Uploading document…');const tenant=context?.membership?.tenant_id,employer=context?.membership?.employer_id;if(!tenant||!employer)throw new Error('Employer account context is unavailable.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),path=`${tenant}/${employer}/${Date.now()}-${safe}`;const up=await supabase.storage.from('workforce-documents').upload(path,file,{upsert:false,contentType:file.type});if(up.error)throw up.error;const fd=formObject(form);try{await invoke('workforce-employer-documents',{action:'register',document:{file_name:file.name,storage_bucket:'workforce-documents',storage_path:path,mime_type:file.type,file_size_bytes:file.size,document_type:fd.document_type||'other',title:fd.title||file.name,description:fd.description||null}})}catch(err){await supabase.storage.from('workforce-documents').remove([path]);throw err}form.reset();d=await api({action:'documents'});render();notice('Document uploaded.','success')}catch(e){notice(e.message,'error')}});}
async function initReports(){const d=await api({action:'reports'});$$('[data-report]').forEach(b=>b.addEventListener('click',()=>{const type=b.dataset.report,out=$('#reportOutput');if(!out)return;const rows=type==='testing'?d.testing||[]:type==='compliance'?d.compliance||[]:d.program_enrollment||[];out.replaceChildren();const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=JSON.stringify(rows,null,2);out.append(pre);}));}
async function initAudit(){const d=await api({action:'audit'});tableRows('auditRows',(d.audit_events||[]).map(x=>tr([fmtDateTime(x.event_at||x.created_at),pretty(x.action),`${x.resource_type||'—'}${x.resource_id?' / '+x.resource_id:''}`,x.actor_user_id||'System'])),4,'No audit events.');}
async function initNotifications(){const d=await api({action:'notifications'});tableRows('notificationRows',(d.notifications||[]).map(x=>tr([fmtDateTime(x.queued_at||x.created_at),pretty(x.event_type||x.notification_type),x.title||x.message||'Notification',pretty(x.status),pretty(x.channel)])),5,'No notifications.');}
async function initCompany(){let d=await advanced({action:'company_profile'});fillForm($('#companyForm'),d.employer);$('#companyForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const r=await advanced({action:'save_company_profile',profile:formObject(ev.currentTarget)});fillForm(ev.currentTarget,r.employer);notice('Company profile saved.','success')}catch(e){notice(e.message,'error')}});}
async function initIntegrations(){const d=await advanced({action:'integrations'});tableRows('integrationRows',(d.integrations||[]).map(x=>tr([x.name,pretty(x.integration_type),x.provider||'—',pretty(x.status),fmtDateTime(x.last_sync_at)])),5,'No integrations configured.');}
async function initOrders(){const d=await invoke('workforce-order-history',{portal:'employer'});const rows=d.orders||[];setText('#orderTotal',rows.length);const paid=x=>['paid','provisioned','completed','active'].includes(String(x.status||'').toLowerCase())||!!x.paid_at;setText('#orderPaid',rows.filter(paid).length);setText('#orderOpen',rows.filter(x=>!paid(x)).length);tableRows('orderRows',rows.map(x=>{const a=x.view_url?linkButton('View',x.view_url):x.payment_url?linkButton('Pay',x.payment_url):'—';return tr([x.order_number||'—',x.title||x.description||'Order',fmtDateTime(x.created_at),fmtMoney(x.amount,x.currency),pretty(x.status),a])}),6,'No orders found.');}
async function initSubscription(){const d=await api({action:'subscription'});const s=d.subscription||{};setText('#subPlan',s.plans?.name||s.plan_name||'—');setText('#subStatus',pretty(s.status));setText('#subRenewal',fmtDate(s.renewal_date||s.stripe_current_period_end));const lim=s.employee_limit??s.plans?.employee_limit;setText('#subLimit',lim==null?'Unlimited':String(lim));setText('#billingPlan',s.plans?.name||'—');setText('#billingStatus',pretty(s.status));tableRows('invoiceRows',(d.invoices||[]).map(x=>tr([x.invoice_number||x.id,fmtDate(x.created_at),fmtMoney(x.amount_due??x.total,x.currency),pretty(x.status)])),4,'No invoices.');}
async function initSettings(){const d=await api({action:'settings'});fillForm($('#settingsForm'),d.employer);$('#settingsForm')?.addEventListener('submit',async ev=>{ev.preventDefault();try{const r=await api({action:'save_settings',settings:formObject(ev.currentTarget)});fillForm(ev.currentTarget,r.employer);notice('Account settings saved.','success')}catch(e){notice(e.message,'error')}});}
async function initSupportAccess(){const d=await advanced({action:'support_consent'});const root=$('#supportAccessContent');if(!root)return;root.replaceChildren();const c=d.consent;if(!c){const e=document.createElement('div');e.className='saas-empty';e.textContent='There is no active support-access request.';root.append(e);return;}const p=document.createElement('p');p.textContent=`Status: ${pretty(c.status)}${c.expires_at?' · Expires '+fmtDateTime(c.expires_at):''}`;root.append(p);if(['pending','requested'].includes(String(c.status))){const name=document.createElement('input');name.placeholder='Authorized signer name';name.id='supportSigner';const grant=actionButton('Grant Access',async()=>{try{await advanced({action:'respond_support_consent',id:c.id,decision:'granted',signer_name:name.value});notice('Support access granted.','success');await initSupportAccess()}catch(e){notice(e.message,'error')}});const deny=actionButton('Deny',async()=>{try{await advanced({action:'respond_support_consent',id:c.id,decision:'denied'});notice('Support access denied.','success');await initSupportAccess()}catch(e){notice(e.message,'error')}});root.append(name,grant,deny);}else if(c.status==='granted'){root.append(actionButton('Revoke Access',async()=>{try{await advanced({action:'respond_support_consent',id:c.id,decision:'revoked'});notice('Support access revoked.','success');await initSupportAccess()}catch(e){notice(e.message,'error')}}));}}
async function initSupport(){async function load(){const d=await invoke('workforce-support',{action:'list'});tableRows('supportRows',(d.tickets||[]).map(x=>tr([x.ticket_number,x.subject,pretty(x.category),pretty(x.status),fmtDate(x.created_at)])),5,'No support tickets.');}await load();const f=$('#supportForm');const feature=new URLSearchParams(location.search).get('feature');if(feature&&f){f.elements.category.value='feature_request';f.elements.subject.value=`Request access to ${pretty(feature)}`;f.elements.message.value=`Please review our account and the ${pretty(feature)} feature.`;}f?.addEventListener('submit',async ev=>{ev.preventDefault();try{await invoke('workforce-support',{action:'create',...formObject(ev.currentTarget)});ev.currentTarget.reset();await load();notice('Support ticket opened.','success')}catch(e){notice(e.message,'error')}});}
function parseCSV(text){const rows=[];let row=[],field='',quote=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quote&&n==='"'){field+='"';i++;continue}if(c==='"'){quote=!quote;continue}if(c===','&&!quote){row.push(field);field='';continue}if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(v=>v.trim()!==''))rows.push(row);row=[];continue}field+=c}row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);if(rows.length<2)return[];const head=rows[0].map(x=>x.trim().toLowerCase());return rows.slice(1).map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]||'').trim()])))}
async function initBulk(){ $('#bulkForm')?.addEventListener('submit',async ev=>{ev.preventDefault();const file=$('#bulkFile')?.files?.[0];if(!file)return notice('Choose a CSV file.','error');try{const rows=parseCSV(await file.text());if(!rows.length)throw new Error('The CSV has no data rows.');const r=await advanced({action:'bulk_import',file_name:file.name,rows});const s=$('#bulkSummary');if(s)s.textContent=`Imported ${r.imported||0}; rejected ${r.rejected||0}.`;notice('Import finished.','success')}catch(e){notice(e.message,'error')}});}
async function initEmployeeCompliance(){const [c,t,p,te]=await Promise.all([advanced({action:'credentials'}),advanced({action:'training'}),advanced({action:'policies'}),testing({action:'list'})]);const employees=c.employees||[];const rows=employees.map(e=>{const cs=(c.credentials||[]).filter(x=>x.employee_id===e.id),ts=(t.records||[]).filter(x=>x.employee_id===e.id),ps=(p.acknowledgments||[]).filter(x=>x.employee_id===e.id),xs=(te.orders||[]).filter(x=>x.employee_id===e.id);return tr([employeeName(e),String(cs.length),String(ts.length),String(ps.length),String(xs.length),e.dot_covered?'Yes':'No'])});tableRows('employeeComplianceRows',rows,6,'No employees available.');}
async function initMembers(filterDER=false){
  let d=await invoke('workforce-employer-members',{action:'list'});
  const render=()=>{
    const members=(d.members||[]).filter(x=>!filterDER||['der','supervisor'].includes(x.roles?.code));
    const id=filterDER?'derRows':'memberRows',cols=filterDER?4:5;
    const rows=members.map(m=>{
      const user=m.profiles?.full_name||[m.profiles?.first_name,m.profiles?.last_name].filter(Boolean).join(' ')||m.profiles?.email||'Account User';
      if(filterDER)return tr([user,m.roles?.name||m.roles?.code||'—',pretty(m.status),m.is_primary?'Yes':'No']);
      const select=document.createElement('select');for(const r of d.roles||[]){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;if(r.id===m.role_id)o.selected=true;select.append(o)}
      const save=actionButton('Save',async()=>{try{await api({action:'save_member_role',member:{id:m.id,role_id:select.value,status:m.status}});notice('User role saved.','success')}catch(e){notice(e.message,'error')}});
      return tr([user,select,pretty(m.status),m.is_primary?'Yes':'No',save])
    });
    tableRows(id,rows,cols,filterDER?'No DERs or supervisors.':'No account users.');
  };
  render();
}
async function initOnboarding(){ const data=await invoke('workforce-customer-onboarding',{action:'status',portal:'employer'}); if(data.completed){location.replace('dashboard.html');return;}const f=$('#onboardingForm');fillForm(f,{...data.profile,...data.entity,...data.organization,...data.onboarding,contact_email:data.onboarding?.contact_email||data.user?.email});const same=$('#sameBilling'),box=$('#billingAddress');const sync=()=>{if(box)box.hidden=!!same?.checked};same?.addEventListener('change',sync);sync();f?.addEventListener('submit',async ev=>{ev.preventDefault();const form=ev.currentTarget,x=formObject(form);try{await invoke('workforce-customer-onboarding',{action:'complete',portal:'employer',onboarding:x});location.replace('dashboard.html')}catch(e){notice(e.message,'error')}});}

async function initTestingSetup(){const d=await api({action:'entitlements'});const root=$('#testingSetup');if(!root)return;root.replaceChildren();const vals=[['Plan',d.subscription?.plans?.name||d.subscription?.plan_name||'Active plan'],['Testing Orders',d.entitlements?.testing_orders?'Enabled':'Not enabled'],['Collection Sites',d.entitlements?.collection_sites?'Enabled':'Not enabled'],['Results / MRO workflow',d.entitlements?.results_summary?'Enabled':'Not enabled'],['Post-Accident',d.entitlements?.post_accident?'Enabled':'Not enabled']];for(const [k,v] of vals){const row=document.createElement('div');row.className='setting-row';const a=document.createElement('strong');a.textContent=k;const b=document.createElement('span');b.textContent=v;row.append(a,b);root.append(row)}}
async function initClearinghouse(){const d=await advanced({action:'credentials'});const rows=(d.employees||[]).filter(e=>e.dot_covered&&String(e.dot_agency||'').toUpperCase()==='FMCSA').map(e=>{const creds=(d.credentials||[]).filter(c=>c.employee_id===e.id);const ch=creds.find(c=>/clearinghouse/i.test(c.credential_type||''));return tr([employeeName(e),[e.cdl_number,e.cdl_state].filter(Boolean).join(' / ')||'—','FMCSA',creds.some(c=>String(c.status)==='expired')?'Action required':'Review current',ch?pretty(ch.status):'Not recorded'])});tableRows('clearinghouseRows',rows,5,'No FMCSA-covered drivers found.');}
async function initAuditPacket(){const f=$('#auditPacketForm');f?.addEventListener('submit',async ev=>{ev.preventDefault();const x=formObject(ev.currentTarget),d=await api({action:'reports'});const start=new Date(x.start_date+'T00:00:00'),end=new Date(x.end_date+'T23:59:59');const tests=(d.testing||[]).filter(r=>{const z=new Date(r.created_at);return z>=start&&z<=end});const cases=(d.compliance||[]).filter(r=>{const z=new Date(r.opened_at);return z>=start&&z<=end});const out=$('#auditPacketOutput');if(!out)return;out.replaceChildren();const h=document.createElement('h2');h.textContent=`Audit Packet · ${fmtDate(start)} – ${fmtDate(end)}`;const p=document.createElement('p');p.textContent=`Program enrollments: ${(d.program_enrollment||[]).length} · Pool memberships: ${(d.pool_membership||[]).length} · Testing records: ${tests.length} · Compliance cases: ${cases.length}`;const b=actionButton('Print / Save PDF',()=>window.print());out.append(h,p,b);notice('Audit packet generated.','success')});}
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
