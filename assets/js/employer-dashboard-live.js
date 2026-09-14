import{overview,esc}from'./employer-saas.js';
const $=s=>document.querySelector(s),n=v=>Number(v||0).toLocaleString(),status=v=>String(v||'').replaceAll('_',' ');
const set=(sel,v)=>{const x=$(sel);if(x)x.textContent=v};
async function load(){const d=await overview(),E=d.entitlements||{},employees=d.employees||[],tests=d.testing_orders||[],cases=d.compliance_cases||[],docs=d.documents||[],programs=d.programs||[],pools=d.pools||[],org=d.employer?.legal_name||d.employer?.dba_name||'Your organization',plan=d.subscription?.plans?.name||'Workforce Compliance';
 set('[data-dashboard-title]',org);set('[data-dashboard-subtitle]',`${plan} management workspace. Only features enabled for your package are shown.`);
 if(E.employee_management){set('#metricEmployees',n(employees.filter(x=>x.employment_status!=='inactive').length));set('#metricDot',`${n(employees.filter(x=>x.dot_covered).length)} DOT-covered`)}
 if(E.testing_orders)set('#metricTests',n(tests.filter(x=>!['completed','cancelled'].includes(x.status)).length));
 if(E.compliance)set('#metricCases',n(cases.filter(x=>!['closed','resolved'].includes(x.status)).length));
 if(E.documents)set('#metricDocs',n(docs.length));
 if(E.programs&&$('#programRows'))$('#programRows').innerHTML=programs.length?programs.slice(0,6).map(p=>`<div class="status-row"><div><strong>${esc(p.name)}</strong><small>${esc((p.program_type||'').toUpperCase())}${p.dot_agency?' • '+esc(p.dot_agency):''}</small></div><span class="badge success">${esc(status(p.status||'active'))}</span></div>`).join(''):'<div class="saas-empty">No programs configured yet.</div>';
 if(E.testing_orders&&$('#testRows'))$('#testRows').innerHTML=tests.length?tests.slice(0,6).map(t=>`<div class="status-row"><div><strong>${esc(t.order_number||'Testing order')}</strong><small>${esc([t.employees?.first_name,t.employees?.last_name].filter(Boolean).join(' ')||'Employee')} • ${esc(status(t.reason))}</small></div><span class="badge">${esc(status(t.status))}</span></div>`).join(''):'<div class="saas-empty">No testing orders yet.</div>';
 if(E.random_pool&&$('#poolRows'))$('#poolRows').innerHTML=pools.length?pools.slice(0,6).map(p=>`<div class="status-row"><div><strong>${esc(p.name)}</strong><small>${esc((p.program_type||'').toUpperCase())}${p.dot_agency?' • '+esc(p.dot_agency):''}</small></div><span class="badge success">${esc(status(p.status||'active'))}</span></div>`).join(''):'<div class="saas-empty">No random pools configured yet.</div>';
}
load().catch(e=>{console.error(e);const x=$('#dashboardError');if(x){x.hidden=false;x.textContent=e.message||'Unable to load Employer workspace.'}});
