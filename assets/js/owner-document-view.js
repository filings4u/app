import{supabase}from'./supabase.js';
const q=new URLSearchParams(location.search),packet=q.get('packet'),owner=q.get('owner'),el=document.querySelector('#doc');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>{if(!d)return '—';const x=new Date(String(d).length===10?d+'T12:00:00':d);return Number.isNaN(x.valueOf())?esc(d):x.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})};
const letterhead=()=>`<header class="official-letterhead"><img class="official-letterhead-logo" src="images/logo.png" alt="screenings4u"><div class="official-letterhead-contact"><strong>screenings4u Workforce Compliance</strong>8537 S Pulaski Rd<br>Chicago, IL 60652<br>Office: 773-245-7009<br>workforce.screenings4u.com</div></header>`;
try{
 const{data,error}=await supabase.functions.invoke('workforce-admin-owner-documents',{body:{action:'workspace',owner_operator_id:owner}});
 if(error)throw error;if(data?.error)throw new Error(data.error);
 const p=(data.packets||[]).find(x=>x.id===packet);
 if(!p){el.textContent='Document not found.'}
 else{
  const template=(data.templates||[]).find(t=>t.id===p.template_id),isCertificate=template?.code==='owner_consortium_enrollment_certificate'||template?.document_type==='certificate'||/certificate of enrollment/i.test(p.title||'');
  if(isCertificate){
   const company=esc(data.owner_operator?.legal_name||p.recipient_name||''),signer=esc(p.form_data?.screenings4u_signer||'Andre Erving');
   el.classList.add('certificate-document');
   el.innerHTML=`<div class="consortium-certificate"><img class="certificate-logo" src="images/logo.png" alt="screenings4u"><div class="certificate-kicker">CERTIFICATE</div><div class="certificate-subtitle">OF ENROLLMENT</div><div class="certificate-program">Department of Transportation — 49 CFR Part 40<br>Random Drug and Alcohol Testing Consortium</div><div class="certificate-company">${company}</div><div class="certificate-copy"><em>screenings4u hereby certifies that the above named company is enrolled in our consortium-administered random drug and alcohol testing program.</em></div><div class="certificate-validity">Valid from <strong>${fmt(p.valid_from)}</strong> through <strong>${fmt(p.valid_until)}</strong>.</div><div class="certificate-bottom"><div class="certificate-signature"><span class="certificate-signature-name">${signer}</span><span class="certificate-signature-line"></span><strong>AUTHORIZED SIGNATURE</strong></div><div class="certificate-seal"><strong>Official Enrollment Record</strong>screenings4u Workforce Compliance<div class="certificate-address">8537 S Pulaski Rd • Chicago, IL 60652<br>773-245-7009 • workforce.screenings4u.com</div></div></div></div>`;
  }else{
   el.innerHTML=`${letterhead()}<div class="official-document-body"><div class="branded-document-header"><div><strong>${esc(p.title)}</strong><br><small>Official Workforce Compliance Document</small></div><div><strong>Status: ${esc(p.status)}</strong><br><small>${p.issued_at?'Issued '+fmt(p.issued_at):'Prepared '+fmt(p.created_at)}</small></div></div><article>${p.content_html||''}</article></div><footer class="official-document-footer">screenings4u Workforce Compliance • 8537 S Pulaski Rd, Chicago, IL 60652 • Office 773-245-7009 • workforce.screenings4u.com</footer>`;
  }
 }
}catch(error){el.textContent=error?.message||'Unable to load document.'}