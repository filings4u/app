import { supabase } from './supabase.js';

const $=s=>document.querySelector(s);
const DASHBOARD=new URL('/employer/dashboard.html',location.origin).href;

async function api(body){
  const {data,error}=await supabase.functions.invoke('workforce-customer-onboarding',{
    body:{...body,portal:'employer'}
  });
  if(error){
    let message=error.message||'Onboarding request failed.';
    try{message=(await error.context.clone().json()).error||message}catch(_){}
    throw new Error(message);
  }
  if(data?.error)throw new Error(data.error);
  return data;
}

function set(form,name,value){
  const input=form.elements[name];
  if(!input||value==null)return;
  if(input.type==='checkbox')input.checked=!!value;
  else input.value=value;
}

function fill(data){
  const f=$('#onboardingForm'),x=data.onboarding||{},e=data.entity||{},o=data.organization||{},p=data.profile||{};
  const values={
    first_name:x.first_name||p.first_name,
    middle_initial:x.middle_initial||p.middle_initial,
    last_name:x.last_name||p.last_name,
    contact_email:x.contact_email||e.primary_contact_email||o.email||data.user?.email,
    contact_phone:x.contact_phone||e.phone||o.phone,
    legal_name:x.legal_name||e.legal_name||o.legal_name,
    dba_name:x.dba_name||e.dba_name||o.dba_name,
    ein:x.ein||e.ein,
    dot_number:x.dot_number||e.dot_number,
    mc_number:x.mc_number||e.mc_number,
    business_type:x.business_type||e.business_type,
    website:x.website||e.website||o.website,
    address_line1:x.address_line1||e.address_line1,
    address_line2:x.address_line2||e.address_line2,
    city:x.city||e.city,
    state:x.state||e.state,
    postal_code:x.postal_code||e.postal_code,
    country:x.country||e.country||'US',
    billing_contact_email:x.billing_contact_email||e.billing_contact_email||data.user?.email,
    billing_contact_phone:x.billing_contact_phone||e.billing_phone||e.phone,
    billing_address_line1:x.billing_address_line1||e.billing_address_line1,
    billing_address_line2:x.billing_address_line2||e.billing_address_line2,
    billing_city:x.billing_city||e.billing_city,
    billing_state:x.billing_state||e.billing_state,
    billing_postal_code:x.billing_postal_code||e.billing_postal_code,
    billing_country:x.billing_country||e.billing_country||'US'
  };
  Object.entries(values).forEach(([k,v])=>set(f,k,v));
  set(f,'billing_same_as_company',x.billing_same_as_company??true);
  $('#billingAddress').hidden=f.billing_same_as_company.checked;
}

$('#sameBilling').addEventListener('change',()=>{
  $('#billingAddress').hidden=$('#sameBilling').checked;
});

$('#onboardingForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const f=e.currentTarget,x=Object.fromEntries(new FormData(f));
  x.billing_same_as_company=f.billing_same_as_company.checked;
  ['acknowledged_portal','acknowledged_support','acknowledged_billing','acknowledged_subscription']
    .forEach(k=>x[k]=f.elements[k].checked);

  try{
    await api({action:'complete',onboarding:x});
    location.replace(DASHBOARD);
  }catch(error){
    console.error(error);
    const box=document.createElement('div');
    box.className='saas-notice error';
    box.textContent=error.message;
    f.prepend(box);
  }
});

try{
  const data=await api({action:'status'});
  if(data.completed)location.replace(DASHBOARD);
  else fill(data);
}catch(error){
  console.error(error);
}
