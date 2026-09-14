(function(){
  'use strict';

  const NAV = [
    { section: 'Workspace' },
    { label: 'Dashboard', icon: '▦', href: 'dashboard.html' },

    { section: 'Workforce Management' },
    { label: 'Employees & Drivers', icon: '👥', href: 'employees.html', feature: 'employee_management' },
    { label: 'DERs & Supervisors', icon: 'D', href: 'ders-supervisors.html', feature: 'ders_supervisors' },
    { label: 'Account Users', icon: 'U', href: 'account-users.html', feature: 'team_users' },
    { label: 'Locations / Terminals', icon: 'L', href: 'locations.html', feature: 'locations' },

    { section: 'Programs & Random Testing' },
    { label: 'Programs', icon: 'P', href: 'programs.html', feature: 'programs' },
    { label: 'Program Enrollment', icon: 'E', href: 'program-enrollment.html', feature: 'programs' },
    { label: 'Random Pools', icon: 'R', href: 'random-pools.html', feature: 'random_pool' },
    { label: 'Pool Membership', icon: 'M', href: 'pool-membership.html', feature: 'random_pool' },
    { label: 'Random Selections', icon: 'S', href: 'random-selections.html', feature: 'random_selections' },

    { section: 'Testing & Compliance' },
    { label: 'Testing Orders', icon: 'T', href: 'testing-orders.html', feature: 'testing_orders' },
    { label: 'Results', icon: '✓', href: 'results.html', feature: 'results_summary' },
    { label: 'Compliance', icon: '!', href: 'compliance.html', feature: 'compliance' },
    { label: 'RTD / Follow-Up', icon: 'R', href: 'rtd-follow-up.html', feature: 'rtd_follow_up' },
    { label: 'Documents', icon: 'D', href: 'documents.html', feature: 'documents' },
    { label: 'Reports', icon: '↗', href: 'reports.html', feature: 'standard_reports' },
    { label: 'Audit History', icon: 'A', href: 'audit-history.html', feature: 'audit_history' },
    { label: 'Notifications', icon: 'N', href: 'notifications.html', feature: 'notifications' },

    { section: 'Account' },
    { label: 'Subscription', icon: 'S', href: 'subscription.html' },
    { label: 'Order History', icon: 'O', href: 'order-history.html' },
    { label: 'Billing & Invoices', icon: '$', href: 'billing.html' },
    { label: 'Account Settings', icon: 'G', href: 'account-settings.html' }
  ];

  function esc(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function currentFile(){
    return location.pathname.split('/').filter(Boolean).pop() || 'dashboard.html';
  }

  function navHtml(){
    const active = currentFile();
    return NAV.map(item => {
      if(item.section) return `<div class="nav-section">${esc(item.section)}</div>`;
      const cls = `nav-link${item.href === active ? ' active' : ''}`;
      const feature = item.feature ? ` data-feature="${esc(item.feature)}"` : '';
      return `<a class="${cls}" data-nav href="${esc(item.href)}"${feature}><span class="nav-icon">${esc(item.icon)}</span><span>${esc(item.label)}</span></a>`;
    }).join('');
  }

  function render(){
    const sidebar = document.querySelector('[data-employer-sidebar]');
    if(!sidebar) return;
    sidebar.innerHTML = `
      <div class="sidebar-brand">
        <img alt="screenings4u" src="../images/logo2.png">
        <div class="product-name">Workforce Compliance</div>
        <div class="workspace">Employer Workspace</div>
      </div>
      <nav class="sidebar-nav" data-employer-nav>${navHtml()}</nav>
      <div class="sidebar-bottom">
        <a class="sidebar-help employer-help-link" href="account-settings.html#support">
          <strong>Need help?</strong>
          <span>Contact screenings4u support from your account.</span>
        </a>
      </div>`;
    document.dispatchEvent(new CustomEvent('s4u:employer-navigation-built'));
  }

  window.S4UEmployerNavigation = Object.freeze({ render, items: NAV.slice() });
  render();
})();
