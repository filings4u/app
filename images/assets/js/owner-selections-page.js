import{init,$,status,empty}from'./owner-admin-common.js';import{invokeOwnerSelections,esc}from'./owner-management.js';
const d=await init('selections');
if(d){
 let w=await invokeOwnerSelections({action:'workspace',owner_operator_id:d.owner_operator.id});
 const poolName=id=>w.pools.find(p=>p.id===id)?.name||'—';
 const fmt=x=>x?new Date(x).toLocaleString():'—';
 const render=()=>{
  $('#content').innerHTML=`<div id="pageStatus" class="inline-status" aria-live="polite"></div>
  <div class="saas-notice"><strong>Random-selection control:</strong> Every eligible member in the selected pool has an equal chance of selection each time a selection event is run. Drug and alcohol draws are randomized independently. The resulting event is locked and retained for audit history.</div>
  <div class="admin-inline-editor selection-runner"><h3>Run Random Selection</h3>
   <form id="selectionForm" class="saas-form-grid">
    <label><span>Active Random Pool *</span><select name="pool_id" required><option value="">Choose pool</option>${w.pools.filter(p=>p.status==='active').map(p=>`<option value="${p.id}">${esc(p.name)} — ${esc(p.dot_agency||p.program_type)}</option>`).join('')}</select></label>
    <label><span>Drug selections *</span><input name="drug_count" type="number" min="0" step="1" value="1" required></label>
    <label><span>Alcohol selections *</span><input name="alcohol_count" type="number" min="0" step="1" value="0" required></label>
    <div class="form-action-cell"><button class="btn btn-orange">Run Selection</button></div>
   </form>
   <p class="management-help">Selection counts are explicit for this event. The pool's configured regulatory rates remain visible in the history and are stored with the locked selection record.</p>
  </div>
  <h3>Selection History</h3>
  <div class="management-table-wrap"><table class="management-table"><thead><tr><th>Date</th><th>Pool</th><th>Population</th><th>Drug</th><th>Alcohol</th><th>Status</th><th>Employer Notice</th></tr></thead><tbody>${w.events.length?w.events.map(e=>`<tr><td>${esc(fmt(e.selection_date))}</td><td><strong>${esc(poolName(e.pool_id))}</strong></td><td>${e.population_size}</td><td>${e.drug_selection_count}</td><td>${e.alcohol_selection_count}</td><td>${esc(e.status)}</td><td><button class="btn btn-outline btn-small" data-notify="${e.id}">Send Employer Notice</button></td></tr>`).join(''):empty(7,'No random selection events yet.')}</tbody></table></div>
  <h3>Selected Employees</h3>
  <div class="management-table-wrap"><table class="management-table"><thead><tr><th>Selection Date</th><th>Pool</th><th>Employer</th><th>Employee / Driver</th><th>Employee #</th><th>Test</th></tr></thead><tbody>${w.events.some(e=>e.members?.length)?w.events.flatMap(e=>(e.members||[]).map(m=>`<tr><td>${esc(fmt(e.selection_date))}</td><td>${esc(poolName(e.pool_id))}</td><td>${esc(m.employers?.legal_name||'—')}</td><td><strong>${esc(`${m.employees?.first_name||''} ${m.employees?.last_name||''}`.trim())}</strong></td><td>${esc(m.employees?.employee_number||'—')}</td><td>${esc(m.test_type)}</td></tr>`)).join(''):empty(6,'No selected employees yet.')}</tbody></table></div>
  <div class="saas-notice"><strong>Notification responsibility:</strong> screenings4u sends the selection notice to the employer/DER. The employer/DER is responsible for notifying the selected driver or employee when ready to direct that person to test. Random testing must remain unannounced, and after notification the employee should proceed immediately as required by the applicable DOT rule.</div>`;
  $('#selectionForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget));try{await invokeOwnerSelections({action:'run_selection',owner_operator_id:d.owner_operator.id,pool_id:f.pool_id,drug_count:Number(f.drug_count),alcohol_count:Number(f.alcohol_count)});w=await invokeOwnerSelections({action:'workspace',owner_operator_id:d.owner_operator.id});render();status('Random selection completed and locked. Review the selected employees below.','success')}catch(x){status(x.message,'error')}};
  document.querySelectorAll('[data-notify]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const r=await invokeOwnerSelections({action:'notify_employers',owner_operator_id:d.owner_operator.id,selection_event_id:b.dataset.notify});status(`Employer notification created for ${r.employers_notified} employer${r.employers_notified===1?'':'s'}. No direct driver notification was sent.`,'success')}catch(x){status(x.message,'error')}finally{b.disabled=false}});
 };render()
}