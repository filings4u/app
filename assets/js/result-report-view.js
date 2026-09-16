import { supabase } from './supabase.js';
const q=new URLSearchParams(location.search),rid=q.get('report'),employer=q.get('employer'),ctpa=q.get('ctpa'),mode=q.get('mode')||'employer',el=document.querySelector('#report');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>x?new Date(x).toLocaleString():'—';
const pretty=x=>String(x??'—').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase());
const letterhead=`<header class="official-letterhead"><img class="official-letterhead-logo" src="images/logo.png" alt="screenings4u"><div class="official-letterhead-contact"><strong>screenings4u Workforce Compliance</strong>8537 S Pulaski Rd<br>Chicago, IL 60652<br>Office: 773-245-7009<br>workforce.screenings4u.com</div></header>`;
async function invoke(name,body){const {data,error}=await supabase.functions.invoke(name,{body});if(error){let m=error.message;try{m=(await error.context?.clone?.().json())?.error||m}catch{}throw new Error(m||'Unable to load result report.')}if(data?.error)throw new Error(data.error);return data}
try{
  if(!rid||(mode!=='ctpa'&&!employer))throw new Error('Result report reference is incomplete.');
  const data=mode==='admin'
    ?await invoke('workforce-admin-employer-results',{action:'get_report',employer_id:employer,report_id:rid})
    :mode==='ctpa'
      ?await invoke('workforce-ctpa-results',{action:'get_report',ctpa_id:ctpa||undefined,report_id:rid})
      :await invoke('workforce-employer-results',{action:'get_report',membership_id:sessionStorage.getItem('s4u_workspace_membership')||'',report_id:rid});
  const r=data.report;if(!r)throw new Error('Result report not found.');
  const driver=r.employees?`${r.employees.first_name||''} ${r.employees.last_name||''}`.trim():'—',order=r.testing_orders?.order_number||'—',reason=r.testing_orders?.reason||r.test_reason||'—';
  el.className='result-report-document';
  el.innerHTML=`${letterhead}<div class="official-document-body"><div class="branded-document-header"><div><strong>Verified Test Result</strong><br><small>Report ${esc(r.report_number||'')}</small></div><div><strong>${esc(pretty(r.report_status||'final'))}</strong><br><small>Finalized ${esc(fmt(r.finalized_at))}</small></div></div><div class="result-meta"><p><strong>Employee / Driver:</strong> ${esc(driver)}</p><p><strong>Order:</strong> ${esc(order)}</p><p><strong>Reason:</strong> ${esc(pretty(reason))}</p><p><strong>Regulatory Mode:</strong> ${esc(pretty(r.regulatory_mode||'—'))}</p><p><strong>Specimen:</strong> ${esc(r.specimen_type||'—')}</p><p><strong>Laboratory:</strong> ${esc(r.laboratory_name||'—')}</p><p><strong>MRO:</strong> ${esc(r.mro_name||'—')}</p><p><strong>Verified Result:</strong> ${esc(pretty(r.verified_result||'—'))}</p></div>${r.summary_html||''}<div class="result-verification"><p><strong>Overall Verified Result:</strong> ${esc(pretty(r.verified_result||'—'))}</p><p><strong>MRO:</strong> ${esc(r.mro_name||'—')}</p><p><strong>MRO Verified:</strong> ${esc(fmt(r.mro_verified_at))}</p><p><strong>Finalized:</strong> ${esc(fmt(r.finalized_at))}</p></div></div><footer class="official-document-footer">screenings4u Workforce Compliance • 8537 S Pulaski Rd, Chicago, IL 60652 • Office 773-245-7009 • workforce.screenings4u.com</footer>`;
}catch(error){el.textContent=error?.message||'Unable to load result report.'}
