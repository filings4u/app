
const ADMIN_NAV = [
  {section:'Workspace'},
  {label:'Dashboard',icon:'▦',href:'dashboard.html'},

  {group:'Employers',icon:'B',key:'employer',context:'Choose an employer to manage',items:[
    ['All Employers','employers.html','employers'],
    ['Employer Profile','employer-profile.html','profile'],
    ['Subscription & Plan','employer-subscription.html','subscription'],
    ['Account Access','employer-access.html','access'],
    ['Locations / Terminals','employer-locations.html','locations'],
    ['DERs & Supervisors','employer-ders.html','ders'],
    ['Employees / Drivers','employer-employees.html','employees'],
    ['DOT Agency Programs','employer-dot-agencies.html','dot-agencies'],
    ['DOT Programs','employer-dot-programs.html','dot-programs'],
    ['Non-DOT Programs','employer-nondot-programs.html','nondot-programs'],
    ['Random Pools','employer-pools.html','pools'],
    ['Random Selections','employer-selections.html','selections'],
    ['Testing Orders','employer-testing.html','testing'],
    ['Testing Configuration','employer-testing-config.html','testing-config'],
    ['Results','employer-results.html','results'],
    ['Compliance','employer-compliance.html','compliance'],
    ['DOT Post-Accidents','employer-post-accidents.html','post-accidents'],
    ['Non-DOT Post-Accidents','employer-nondot-post-accidents.html','nondot-post-accidents'],
    ['Documents & Certificates','employer-documents.html','documents'],
    ['Reports / MIS','employer-reports.html','reports'],
    ['Invoices & Payments','employer-billing.html','billing'],
    ['Notifications','employer-notifications.html','notifications'],
    ['Audit History','employer-audit.html','audit'],
    ['Admin Support Access','employer-support-access.html','support-access'],
    ['Account Settings','employer-settings.html','settings']
  ]},

  {group:'Owner-Operators',icon:'D',key:'owner',context:'Choose an Owner-Operator',items:[
    ['All Owner-Operators','owner-operators.html','owners'],
    ['Owner-Operator Profile','owner-profile.html','profile'],
    ['Subscription & Plan','owner-subscription.html','subscription'],
    ['Account Access','owner-access.html','access'],
    ['Driver Profile','owner-driver.html','driver'],
    ['Consortium Enrollment','owner-consortium.html','consortium'],
    ['Random Pool','owner-pool.html','pool'],
    ['Random Selections','owner-selections.html','selections'],
    ['Testing','owner-testing.html','testing'],
    ['Results','owner-results.html','results'],
    ['RTD / Follow-Up','owner-rtd.html','rtd'],
    ['Compliance','owner-compliance.html','compliance'],
    ['Documents & Certificates','owner-documents.html','documents'],
    ['Invoices & Payments','owner-billing.html','billing'],
    ['Notifications','owner-notifications.html','notifications'],
    ['Audit History','owner-audit.html','audit'],
    ['Account Settings','owner-settings.html','settings']
  ]},

  {group:'C/TPAs',icon:'C',key:'ctpa',context:'Choose a C/TPA',items:[
    ['All C/TPAs','ctpas.html','ctpas'],
    ['C/TPA Profile','ctpa-profile.html','profile'],
    ['Subscription & Plan','ctpa-subscription.html','subscription'],
    ['Staff & Account Access','ctpa-access.html','access'],
    ['Employer Clients','ctpa-clients.html','clients'],
    ['Client Users / DERs','ctpa-client-access.html','client-access'],
    ['Employees / Drivers','ctpa-workforce.html','workforce'],
    ['Consortium Pools','ctpa-pools.html','pools'],
    ['DOT Programs','ctpa-dot-programs.html','dot-programs'],
    ['Non-DOT Programs','ctpa-nondot-programs.html','nondot-programs'],
    ['Random Selections','ctpa-selections.html','selections'],
    ['Testing Orders','ctpa-testing.html','testing'],
    ['Results','ctpa-results.html','results'],
    ['Compliance','ctpa-compliance.html','compliance'],
    ['Documents & Certificates','ctpa-documents.html','documents'],
    ['Reports / MIS','ctpa-reports.html','reports'],
    ['Billing','ctpa-billing.html','billing'],
    ['Notifications','ctpa-notifications.html','notifications'],
    ['Integrations','ctpa-integrations.html','integrations'],
    ['Audit History','ctpa-audit.html','audit'],
    ['Account Settings','ctpa-settings.html','settings']
  ]},

  {section:'Platform Management'},
  {label:'All Employees / Drivers',icon:'👥',href:'employees.html'},
  {label:'All Testing',icon:'T',href:'testing-orders.html'},
  {label:'All Results',icon:'✓',href:'results.html'},
  {label:'All Compliance',icon:'!',href:'compliance.html'},
  {label:'All Billing / Subscriptions',icon:'$',href:'billing.html'},
  {label:'All Integrations',icon:'↔',href:'integrations.html'},
  {label:'Collection Sites',icon:'C',href:'collection-sites.html'},
  {label:'Laboratories',icon:'L',href:'laboratories.html'},
  {label:'MROs',icon:'M',href:'mros.html'},
  {label:'SAP Providers',icon:'S',href:'saps.html'},
  {label:'Platform Audit',icon:'A',href:'audit.html'},

  {section:'Admin Configuration'},
  {label:'Plans & Features',icon:'P',href:'plan-features.html'},
  {label:'Roles & Permissions',icon:'R',href:'admin-roles.html'},
  {label:'Regulatory Rules',icon:'G',href:'admin-regulatory.html'},
  {label:'Notification Templates',icon:'N',href:'admin-notifications.html'},
  {label:'System Settings',icon:'S',href:'admin-settings.html'}
];

function currentFile(){ return location.pathname.split('/').filter(Boolean).pop() || 'dashboard.html'; }
function contextId(key){
  if(key==='employer') return new URLSearchParams(location.search).get('employer') || localStorage.getItem('s4u_admin_employer_id') || '';
  if(key==='owner') return new URLSearchParams(location.search).get('owner') || localStorage.getItem('s4u_admin_owner_id') || '';
  if(key==='ctpa') return new URLSearchParams(location.search).get('ctpa') || localStorage.getItem('s4u_admin_ctpa_id') || '';
  return '';
}
function contextName(key){
  if(key==='employer') return localStorage.getItem('s4u_admin_employer_name') || 'Choose an employer to manage';
  if(key==='owner') return localStorage.getItem('s4u_admin_owner_name') || 'Choose an Owner-Operator';
  if(key==='ctpa') return localStorage.getItem('s4u_admin_ctpa_name') || 'Choose a C/TPA';
  return '';
}
function withContext(href,key){
  const id=contextId(key);
  if(!id) return href;
  const u=new URL(href,location.href);
  u.searchParams.set(key,id);
  return u.pathname.split('/').pop()+u.search;
}
function groupOwnsFile(group,file){
  return group.items?.some(([,href])=>href===file);
}
function renderNavItem(item){
  if(item.section) return `<div class="nav-section">${item.section}</div>`;
  if(item.group){
    const file=currentFile(), open=groupOwnsFile(item,file);
    return `<button class="sidebar-group-toggle ${open?'open':''}" type="button" data-nav-group="${item.key}">
      <span class="nav-icon">${item.icon}</span><span>${item.group}</span><span class="caret">⌄</span>
    </button>
    <div class="sidebar-submenu ${open?'open':''}" data-nav-submenu="${item.key}">
      ${item.items.map(([label,href,pageKey])=>{
        const active=href===file?'active':'';
        return `<a class="${active}" href="${withContext(href,item.key)}" data-${item.key}-page="${pageKey}">${label}</a>`;
      }).join('')}
    </div>`;
  }
  const active=item.href===currentFile()?'active':'';
  return `<a class="nav-link ${active}" data-nav href="${item.href}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></a>`;
}
export function buildAdminNavigation(){
  const nav=document.querySelector('.sidebar-nav');
  if(!nav) return;
  nav.innerHTML=ADMIN_NAV.map(renderNavItem).join('');
  nav.querySelectorAll('[data-nav-group]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.navGroup;
      const menu=nav.querySelector(`[data-nav-submenu="${key}"]`);
      btn.classList.toggle('open');
      menu?.classList.toggle('open');
    });
  });
  document.dispatchEvent(new CustomEvent('s4u:navigation-built'));
}
document.addEventListener('DOMContentLoaded',buildAdminNavigation);


export function refreshNavigationContext(){
  document.querySelectorAll('[data-context-label="employer"]').forEach(el=>el.textContent=localStorage.getItem('s4u_admin_employer_name')||'Choose an employer to manage');
  document.querySelectorAll('[data-context-label="owner"]').forEach(el=>el.textContent=localStorage.getItem('s4u_admin_owner_name')||'Choose an Owner-Operator');
  document.querySelectorAll('[data-context-label="ctpa"]').forEach(el=>el.textContent=localStorage.getItem('s4u_admin_ctpa_name')||'Choose a C/TPA');
}
document.addEventListener('s4u:navigation-built',refreshNavigationContext);
