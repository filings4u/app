const groups=[
{label:'Platform',links:[['Dashboard','dashboard.html','D'],['Organizations','organizations.html','O'],['Employers','employers.html','E'],['Owner-Operators','owner-operators.html','OO'],['C/TPAs','ctpas.html','C'],['Employees','employees.html','W']]},
{label:'Selected Employer',employer:true,links:[['Profile','employer-profile.html'],['Subscription','employer-subscription.html'],['Billing','employer-billing.html'],['Account Access','employer-access.html'],['DERs / Supervisors','employer-ders.html'],['Locations','employer-locations.html'],['Employees','employer-employees.html'],['DOT Agencies','employer-dot-agencies.html'],['DOT Programs','employer-dot-programs.html'],['Non-DOT Programs','employer-nondot-programs.html'],['Random Pools','employer-pools.html'],['Random Selections','employer-selections.html'],['Testing Orders','employer-testing.html'],['Testing Configuration','employer-testing-config.html'],['Results / MRO','employer-results.html'],['Compliance / RTD','employer-compliance.html'],['DOT Post-Accident','employer-post-accidents.html'],['Non-DOT Post-Accident','employer-nondot-post-accidents.html'],['Documents','employer-documents.html'],['Notifications','employer-notifications.html'],['Reports','employer-reports.html'],['Audit History','employer-audit.html'],['Feature Settings','employer-settings.html'],['Support Access','employer-support-access.html']]},
{label:'Providers',links:[['Collection Sites','collection-sites.html','CS'],['Laboratories','laboratories.html','LAB'],['MROs','mros.html','M'],['SAPs','saps.html','S']]},
{label:'Operations',links:[['Testing Orders','testing-orders.html','T'],['Results','results.html','R'],['Compliance','compliance.html','C']]},
{label:'Platform Configuration',links:[['Plans & Features','plan-features.html','PF'],['Integrations','integrations.html','I'],['Billing','billing.html','$'],['Notifications','admin-notifications.html','N'],['Regulatory','admin-regulatory.html','R'],['Roles','admin-roles.html','U'],['Settings','admin-settings.html','S'],['Audit','audit.html','A']]}
];
function currentFile(){return location.pathname.split('/').filter(Boolean).pop()||''}
function employerId(){return new URLSearchParams(location.search).get('employer_id')||sessionStorage.getItem('s4u_admin_employer_id')||''}
function employerHref(file){const id=employerId();return id?`${file}?employer_id=${encodeURIComponent(id)}`:file}
function topLink(label,file,icon){return `<a class="nav-link${currentFile()===file?' active':''}" href="${file}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`}
export function buildAdminNavigation(){
 const nav=document.querySelector('.sidebar-nav');if(!nav)return;nav.innerHTML='';
 for(const g of groups){
  if(g.employer){
   const wrap=document.createElement('div'),btn=document.createElement('button'),sub=document.createElement('div');
   btn.type='button';btn.className='sidebar-group-toggle';btn.innerHTML=`<span class="nav-icon">E</span><span>${g.label}</span><span class="caret">▾</span>`;
   sub.className='sidebar-submenu';
   const ctx=document.createElement('div');ctx.className='context-customer';ctx.textContent=employerId()?'Employer management workspace':'Choose an Employer on any Employer Admin page';sub.append(ctx);
   for(const [label,file] of g.links){const a=document.createElement('a');a.href=employerHref(file);a.textContent=label;if(currentFile()===file)a.classList.add('active');sub.append(a)}
   if(g.links.some(([,f])=>f===currentFile())){btn.classList.add('open');sub.classList.add('open')}
   btn.addEventListener('click',()=>{btn.classList.toggle('open');sub.classList.toggle('open')});wrap.append(btn,sub);nav.append(wrap);
  }else{
   const section=document.createElement('div');section.className='nav-section';section.textContent=g.label;nav.append(section);
   for(const [label,file,icon] of g.links)nav.insertAdjacentHTML('beforeend',topLink(label,file,icon));
  }
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildAdminNavigation,{once:true});else buildAdminNavigation();
