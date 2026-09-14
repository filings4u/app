import{overview,esc}from'./employer-saas.js';
const $=s=>document.querySelector(s);
const n=v=>Number(v||0).toLocaleString();
const status=v=>String(v||'').replaceAll('_',' ');
async function load(){
 const d=await overview(), employees=d.employees||[], tests=d.testing_orders||[], cases=d.compliance_cases||[], docs=d.documents||[], programs=d.programs||[], pools=d.pools||[];
 const org=d.employer?.legal_name||d.employer?.dba_name||'Your organization';
 $('[data-dashboard-title]').textContent=`Welcome, ${org}`;
 $('[data-dashboard-subtitle]').textContent='Your live workforce compliance activity and account status.';
 $('#metricEmployees').textContent=n(employees.filter(x=>x.employment_status!=='inactive').length);
 $('#metricDot').textContent=`${n(employees.filter(x=>x.dot_covered).length)} DOT-covered`;
 $('#metricTests').textContent=n(tests.filter(x=>!['completed','cancelled'].includes(x.status)).length);
 $('#metricCases').textContent=n(cases.filter(x=>!['closed','resolved'].includes(x.status)).length);
 $('#metricDocs').textContent=n(docs.length);
 $('#programRows').innerHTML=programs.length?programs.slice(0,6).map(p=>`<div class="status-row"><div><strong>${esc(p.name)}</strong><small>${esc((p.program_type||'').toUpperCase())}${p.dot_agency?' • '+esc(p.dot_agency):''}</small></div><span class="badge success">${esc(status(p.status||'active'))}</span></div>`).join(''):'<div class="saas-empty">No programs configured yet.</div>';
 $('#testRows').innerHTML=tests.length?tests.slice(0,6).map(t=>`<div class="status-row"><div><strong>${esc(t.order_number||'Testing order')}</strong><small>${esc([t.employees?.first_name,t.employees?.last_name].filter(Boolean).join(' ')||'Employee')} • ${esc(status(t.reason))}</small></div><span class="badge">${esc(status(t.status))}</span></div>`).join(''):'<div class="saas-empty">No testing orders yet.</div>';
 $('#poolRows').innerHTML=pools.length?pools.slice(0,6).map(p=>`<div class="status-row"><div><strong>${esc(p.name)}</strong><small>${esc((p.program_type||'').toUpperCase())}${p.dot_agency?' • '+esc(p.dot_agency):''}</small></div><span class="badge success">${esc(status(p.status||'active'))}</span></div>`).join(''):'<div class="saas-empty">No random pools configured yet.</div>';
}
load().catch(e=>{console.error(e);const x=$('#dashboardError');x.hidden=false;x.textContent=e.message||'Unable to load Employer dashboard.'});
