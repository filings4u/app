const roleNav = {
  ctpa: [
    ['OVERVIEW',[['dashboard','⌂','Dashboard']]],
    ['OPERATIONS',[['employers','▦','Employers'],['employees','◉','Employees'],['programs','◫','Programs'],['pools','◎','Consortium Pools'],['selections','⌁','Selections'],['testing','✓','Testing']]],
    ['COMPLIANCE',[['compliance','!','Compliance'],['cases','□','Cases'],['documents','▤','Documents']]],
    ['NETWORK',[['vendors','◇','Vendors'],['mro','M','MRO'],['sap','S','SAP']]],
    ['BUSINESS',[['subscriptions','$','Subscriptions'],['billing','＄','Billing'],['reports','▥','Reports']]],
    ['SYSTEM',[['integrations','↔','Integrations'],['users','♙','Users'],['settings','⚙','Settings']]]
  ],
  employer: [
    ['OVERVIEW',[['dashboard','⌂','Dashboard']]],
    ['WORKFORCE',[['employees','◉','Employees'],['programs','◫','Programs'],['selections','⌁','Random Testing'],['testing','✓','Testing']]],
    ['COMPLIANCE',[['compliance','!','Compliance'],['documents','▤','Documents'],['reports','▥','Reports']]],
    ['ACCOUNT',[['billing','＄','Billing'],['company','▦','Company'],['users','♙','Users'],['support','?','Support']]]
  ],
  platform: [
    ['OVERVIEW',[['dashboard','⌂','Dashboard']]],
    ['PLATFORM',[['ctpas','▦','C/TPAs'],['employers','◫','Employers'],['plans','$','Plans'],['subscriptions','↻','Subscriptions'],['billing','＄','Billing']]],
    ['CONTROL',[['regulatory','§','Regulatory Rules'],['integrations','↔','Integrations'],['users','♙','Users'],['security','◇','Security'],['audit','▤','Audit Logs'],['health','●','System Health'],['support','?','Support']]]
  ]
};
const titles={dashboard:'Dashboard',employers:'Employers',employees:'Employees',programs:'Programs',pools:'Consortium Pools',selections:'Selections & Random Testing',testing:'Testing Operations',compliance:'Compliance',cases:'Compliance Cases',documents:'Documents',vendors:'Vendors',mro:'MRO',sap:'SAP',subscriptions:'Subscriptions',billing:'Billing',reports:'Reports',integrations:'Integrations',users:'Users',settings:'Settings',company:'Company Settings',support:'Support',ctpas:'C/TPAs',plans:'Plans',regulatory:'Regulatory Rules',security:'Security',audit:'Audit Logs',health:'System Health'};
let role='ctpa';
function renderNav(){const wrap=document.querySelector('[data-side-nav]');wrap.innerHTML='';roleNav[role].forEach(([label,items])=>{const group=document.createElement('div');group.className='nav-group';group.innerHTML=`<div class="nav-label">${label}</div>`;items.forEach(([id,icon,name])=>{const b=document.createElement('button');b.className='nav-item';b.dataset.view=id;b.innerHTML=`<span class="nav-icon">${icon}</span><span>${name}</span>`;b.onclick=()=>showView(id);group.appendChild(b)});wrap.appendChild(group)});const current=location.hash.replace('#','')||'dashboard';showView(current,true)}
function showView(id,quiet=false){if(!titles[id]) id='dashboard';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===id));document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===id));const title=document.querySelector('[data-page-title]');if(title) title.textContent=titles[id];if(!quiet) history.replaceState(null,'','#'+id);document.querySelector('.sidebar')?.classList.remove('open');document.querySelector('.sidebar-backdrop')?.classList.remove('show')}
function setRole(next){role=next;const names={ctpa:'Midwest Compliance LLC',employer:'ABC Trucking, Inc.',platform:'screenings4u Platform'};document.querySelector('[data-workspace-name]').textContent=names[next];document.querySelector('[data-role-name]').textContent={ctpa:'C/TPA Administrator',employer:'Employer Administrator',platform:'Platform Administrator'}[next];renderNav()}
document.querySelector('[data-role-switch]')?.addEventListener('change',e=>setRole(e.target.value));document.querySelector('[data-menu-btn]')?.addEventListener('click',()=>{document.querySelector('.sidebar').classList.toggle('open');document.querySelector('.sidebar-backdrop').classList.toggle('show')});document.querySelector('.sidebar-backdrop')?.addEventListener('click',()=>{document.querySelector('.sidebar').classList.remove('open');document.querySelector('.sidebar-backdrop').classList.remove('show')});window.addEventListener('hashchange',()=>showView(location.hash.slice(1),true));renderNav();
