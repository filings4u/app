const groups=[
  {label:'Platform',links:[
    ['Dashboard','dashboard.html','D'],['Employers','employers.html','E'],['Owner-Operators','owner-operators.html','OO'],['C/TPAs','ctpas.html','C'],['Employees','employees.html','W']
  ]},
  {label:'Selected Employer',context:'employer',icon:'E',links:[
    ['Profile','employer-profile.html'],['Subscription','employer-subscription.html'],['Account Access & DER Management','employer-access.html'],['Locations','employer-locations.html'],['Employees','employer-employees.html'],['DOT Agencies','employer-dot-agencies.html'],['DOT Programs','employer-dot-programs.html'],['Non-DOT Programs','employer-nondot-programs.html'],['Random Pools','employer-pools.html'],['Random Selections','employer-selections.html'],['Testing Orders','employer-testing.html'],['Testing Configuration','employer-testing-config.html'],['Results / MRO','employer-results.html'],['Compliance / RTD','employer-compliance.html'],['DOT Post-Accident','employer-post-accidents.html'],['Non-DOT Post-Accident','employer-nondot-post-accidents.html'],['Documents','employer-documents.html'],['Notifications','employer-notifications.html'],['Reports','employer-reports.html'],['Audit History','employer-audit.html'],['Feature Settings','employer-settings.html'],['Support Access','employer-support-access.html']
  ]},
  {label:'Selected Owner-Operator',context:'owner',icon:'OO',links:[
    ['Profile','owner-profile.html'],['USDOT / Account','owner-usdot.html'],['Subscription','owner-subscription.html'],['Access & Staff','owner-access.html'],['Driver','owner-driver.html'],['Consortium','owner-consortium.html'],['Random Pool','owner-pool.html'],['Random Selections','owner-selections.html'],['Testing Orders','owner-testing.html'],['Results','owner-results.html'],['Compliance','owner-compliance.html'],['SAP / RTD','owner-rtd.html'],['Documents','owner-documents.html'],['Notifications','owner-notifications.html'],['Audit History','owner-audit.html'],['Settings','owner-settings.html']
  ]},
  {label:'Selected C/TPA',context:'ctpa',icon:'C',links:[
    ['Profile','ctpa-profile.html'],['Subscription','ctpa-subscription.html'],['Access','ctpa-access.html'],['Client Access','ctpa-client-access.html'],['Clients','ctpa-clients.html'],['Workforce','ctpa-workforce.html'],['DOT Programs','ctpa-dot-programs.html'],['Non-DOT Programs','ctpa-nondot-programs.html'],['Pools','ctpa-pools.html'],['Pool Access','ctpa-pool-access.html'],['Random Selections','ctpa-selections.html'],['Testing','ctpa-testing.html'],['Results','ctpa-results.html'],['Compliance','ctpa-compliance.html'],['Documents','ctpa-documents.html'],['Policies','ctpa-policies.html'],['Enrollment','ctpa-enrollment.html'],['Employer Import','ctpa-employer-import.html'],['Employer Settings','ctpa-employer-settings.html'],['Clearinghouse','ctpa-clearinghouse.html'],['Branding','ctpa-branding.html'],['Integrations','ctpa-integrations.html'],['Notifications','ctpa-notifications.html'],['Reports','ctpa-reports.html'],['Audit History','ctpa-audit.html'],['Settings','ctpa-settings.html']
  ]},
  {label:'Providers',links:[['Collection Sites','collection-sites.html','CS'],['Laboratories','laboratories.html','LAB'],['MROs','mros.html','M'],['SAPs','saps.html','S']]},
  {label:'Operations',links:[['Testing Orders','testing-orders.html','T'],['Results','results.html','R'],['Compliance','compliance.html','C'],['Notification Delivery','admin-notification-log.html','N'],['Support Tickets','support.html','?']]},
  {label:'Platform Configuration',links:[['Plans & Features','plan-features.html','PF'],['Integrations','integrations.html','I'],['Enterprise Invoicing & Payments','invoicing.html','$'],['Notification Templates','admin-notifications.html','NT'],['Regulatory','admin-regulatory.html','R'],['Roles','admin-roles.html','U'],['Settings','admin-settings.html','S'],['Audit','audit.html','A']]}
];

function currentFile(){return location.pathname.split('/').filter(Boolean).pop()||''}
function params(){return new URLSearchParams(location.search)}
function selectedId(type){
  const p=params();
  if(type==='employer')return p.get('employer_id')||sessionStorage.getItem('s4u_admin_employer_id')||'';
  if(type==='owner')return p.get('owner')||localStorage.getItem('s4u_admin_owner_id')||'';
  if(type==='ctpa')return p.get('ctpa')||localStorage.getItem('s4u_admin_ctpa_id')||'';
  return '';
}
function selectedName(type){
  if(type==='owner')return localStorage.getItem('s4u_admin_owner_name')||'';
  if(type==='ctpa')return localStorage.getItem('s4u_admin_ctpa_name')||'';
  return '';
}
function contextHref(type,file){
  const id=selectedId(type);if(!id)return file;
  const key=type==='employer'?'employer_id':type;
  return `${file}?${key}=${encodeURIComponent(id)}`;
}
function contextCopy(type){
  const name=selectedName(type),id=selectedId(type);
  if(name)return name;
  if(id)return type==='owner'?'Owner-Operator management workspace':type==='ctpa'?'C/TPA management workspace':'Employer management workspace';
  return type==='owner'?'Choose an Owner-Operator from the directory':type==='ctpa'?'Choose a C/TPA from the directory':'Choose an Employer from the directory';
}
function topLink(label,file,icon){return `<a class="nav-link${currentFile()===file?' active':''}" href="${file}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`}
function contextGroup(g){
  const wrap=document.createElement('div'),btn=document.createElement('button'),sub=document.createElement('div');
  wrap.className='sidebar-context-group';
  btn.type='button';btn.className='sidebar-group-toggle';btn.innerHTML=`<span class="nav-icon">${g.icon}</span><span>${g.label}</span><span class="caret">▾</span>`;
  sub.className='sidebar-submenu';
  const ctx=document.createElement('div');ctx.className='context-customer';ctx.textContent=contextCopy(g.context);sub.append(ctx);
  for(const [label,file] of g.links){const a=document.createElement('a');a.href=contextHref(g.context,file);a.textContent=label;if(currentFile()===file)a.classList.add('active');sub.append(a)}
  const belongs=g.links.some(([,f])=>f===currentFile());
  if(belongs){btn.classList.add('open');sub.classList.add('open')}
  btn.addEventListener('click',()=>{btn.classList.toggle('open');sub.classList.toggle('open')});wrap.append(btn,sub);return wrap;
}
export function buildAdminNavigation(){
  if(!location.pathname.split('/').filter(Boolean).includes('admin'))return;
  const nav=document.querySelector('.sidebar-nav');if(!nav)return;nav.innerHTML='';
  for(const g of groups){
    if(g.context){nav.append(contextGroup(g));continue}
    const section=document.createElement('div');section.className='nav-section';section.textContent=g.label;nav.append(section);
    for(const [label,file,icon] of g.links)nav.insertAdjacentHTML('beforeend',topLink(label,file,icon));
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildAdminNavigation,{once:true});else buildAdminNavigation();
