import { portalReady } from './portal.js?v=20260916-admin-loadfix2';
await portalReady;
import { init, $, status, empty } from './ctpa-admin-common.js';
import { invokeCtpa, esc } from './ctpa-management.js';
import { op } from './ctpa-ops.js';
const d = await init('clients');
if (d) {
  const extra = await op({ action: 'get', ctpa_id: d.ctpa.id });
  const contacts = extra.contacts || [];
  const rows = (d.employers || []).map(employer => {
    const people = contacts.filter(c => c.employer_id === employer.id);
    if (!people.length && (employer.primary_contact_name || employer.primary_contact_email)) people.push({full_name: employer.primary_contact_name, email: employer.primary_contact_email, contact_type:'primary', source:'employer'});
    const contactHtml = people.length ? people.map(c => `<div><strong>${esc(c.full_name || [c.first_name,c.last_name].filter(Boolean).join(' ') || 'Contact')}</strong>${c.title ? ` · ${esc(c.title)}` : ''}<br><small>${esc(c.email || 'No email')}${c.phone ? ` · ${esc(c.phone)}` : ''} · ${esc(c.contact_type || 'contact')}</small></div>`).join('<hr>') : '<small>No contacts uploaded.</small>';
    return `<tr><td><strong>${esc(employer.legal_name)}</strong>${employer.dba_name ? `<br><small>${esc(employer.dba_name)}</small>` : ''}</td><td>${contactHtml}</td><td>${esc(employer.dot_number || '—')}</td><td>${esc(employer.state || '—')}</td><td>${employer.employee_count ?? '—'}</td><td><select data-status="${employer.id}"><option ${employer.status==='active'?'selected':''}>active</option><option ${employer.status==='inactive'?'selected':''}>inactive</option><option ${employer.status==='suspended'?'selected':''}>suspended</option></select></td><td><button class="org-action" data-save="${employer.id}">Save</button></td></tr>`;
  }).join('');
  $('#content').innerHTML = `<div class="saas-notice"><strong>Employer contacts:</strong> Contacts uploaded with Employer imports are retained under the Employer account and shown here.</div><div class="management-table-wrap"><table class="management-table"><thead><tr><th>Employer</th><th>Contacts</th><th>USDOT</th><th>State</th><th>Employees</th><th>Status</th><th></th></tr></thead><tbody>${rows || empty(7,'No employer clients assigned.')}</tbody></table></div>`;
  document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', async () => {
    try {
      await invokeCtpa({ action:'save_client_status', ctpa_id:d.ctpa.id, client:{ id:button.dataset.save, status:document.querySelector(`[data-status="${button.dataset.save}"]`).value } });
      status('Employer client status updated.','success');
    } catch(error) { status(error.message,'error'); }
  }));
}

