import{api,$,esc,money}from'./employer-saas.js';
const date=v=>v?new Intl.DateTimeFormat('en-US',{dateStyle:'medium'}).format(new Date(v+'T12:00:00')):'—';
const human=s=>String(s||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
async function load(){const d=await api({action:'subscription'}),s=d.subscription,p=s?.plans,E=d.features||[];if(!s||!p)throw new Error('No active Employer subscription is assigned to this account.');
 $('#subscriptionPlan').textContent=p.name||'Employer Plan';$('#subscriptionDescription').textContent=p.description||'screenings4u Workforce Compliance Employer subscription.';$('#subscriptionStatus').textContent=human(s.status);$('#subscriptionStatus').className='subscription-status '+(s.status==='active'?'active':'');$('#subscriptionPrice').textContent=money(p.monthly_price||0);$('#subscriptionBilling').textContent=human(s.billing_frequency||'monthly');$('#subscriptionRenewal').textContent=date(s.renewal_date);{
  const workforceLimit=s.employee_limit??p.employee_limit;
  $('#subscriptionLimit').textContent=(workforceLimit===null||workforceLimit===undefined||workforceLimit==='')?'Unlimited':workforceLimit;
}$('#subscriptionOrder').textContent=s.order_reference||'—';$('#subscriptionStart').textContent=date(s.start_date);$('#subscriptionStatusText').textContent=human(s.status);$('#subscriptionCancel').textContent=s.cancel_at_period_end?'Cancels at period end':'Renews automatically';
 const enabled=E.filter(x=>x.enabled);$('#subscriptionFeatures').innerHTML=enabled.length?enabled.map(f=>`<article class="subscription-feature"><span class="feature-check">✓</span><div><strong>${esc(f.name||human(f.code))}</strong><p>${esc(f.description||'Included in your current package.')}</p>${f.source==='account_override'?'<small>Enabled by Platform Administration</small>':''}</div></article>`).join(''):'<div class="saas-empty">No software features are currently enabled for this subscription.</div>';
}
load().catch(e=>{console.error(e);const x=$('#subscriptionError');x.hidden=false;x.textContent=e.message||'Unable to load subscription.'});
