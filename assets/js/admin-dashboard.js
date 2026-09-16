import { portalReady } from './portal.js?v=20260916-admin-loadfix2';
await portalReady;
import { supabase } from './supabase.js';

const setText=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;

async function loadAdminDashboard(){
  try{
    const {data,error}=await supabase.functions.invoke('workforce-admin-dashboard');
    if(error||!data) throw error || new Error('No dashboard data returned');
    const m=data.metrics||{}, o=data.operations||{}, mix=data.revenue_mix||{};
    setText('[data-admin-metric="active_organizations"]',m.active_organizations??0);
    setText('[data-admin-note="new_organizations_this_month"]',`${m.new_organizations_this_month??0} new this month`);
    setText('[data-admin-metric="active_subscriptions"]',m.active_subscriptions??0);
    setText('[data-admin-note="trial_subscriptions"]',`${m.trial_subscriptions??0} trial / onboarding`);
    setText('[data-admin-metric="open_testing_workflows"]',m.open_testing_workflows??0);
    setText('[data-admin-note="screenings4u_testing_orders"]',`${m.screenings4u_testing_orders??0} open testing orders`);
    setText('[data-admin-metric="compliance_exceptions"]',m.compliance_exceptions??0);

    setText('[data-admin-op="employer_accounts"]',plural(o.employer_accounts??0,'active employer subscription'));
    setText('[data-admin-op="owner_operator_accounts"]',plural(o.owner_operator_accounts??0,'active owner-operator subscription'));
    setText('[data-admin-op="ctpa_accounts"]',plural(o.ctpa_accounts??0,'active C/TPA subscription'));
    const failed=Number(o.failed_billing_events??0);
    setText('[data-admin-op="failed_billing_events"]',failed?`${failed} require review`:'No failed billing events');
    const billingBadge=document.querySelector('[data-admin-health="billing"]');
    if(billingBadge){billingBadge.textContent=failed?'Review':'Clear';billingBadge.className='badge '+(failed?'warning':'success');}

    for(const key of ['employer','owner_operator','ctpa']){
      const pct=mix[key]?.percent??0;
      setText(`[data-admin-mix-label="${key}"]`,`${pct}%`);
      const bar=document.querySelector(`[data-admin-mix="${key}"]`);
      if(bar) bar.style.width=`${pct}%`;
    }
  }catch(error){
    console.error('Admin dashboard live data failed:',error);
    document.querySelectorAll('[data-admin-metric]').forEach(el=>el.textContent='—');
    document.querySelectorAll('[data-admin-note]').forEach(el=>el.textContent='Live data unavailable');
  }
}

loadAdminDashboard();
