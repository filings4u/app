import { portalReady } from './portal.js?v=20260916-admin-loadfix2';
await portalReady;
import {init,$,status,empty} from './ctpa-admin-common.js';
import {invokeCtpa,esc} from './ctpa-management.js';

const d=await init('access');
if(d){
  const content=$('#content');
  const rows=d.members?.length ? d.members.map(member=>{
    const display=member.profiles?.display_name || [member.profiles?.first_name,member.profiles?.last_name].filter(Boolean).join(' ') || member.user_id;
    const roleOptions=(d.roles||[]).map(role=>`<option value="${role.id}" ${role.id===member.role_id?'selected':''}>${esc(role.name)}</option>`).join('');
    return `<tr><td><strong>${esc(display)}</strong></td><td><select data-role="${member.id}">${roleOptions}</select></td><td><select data-status="${member.id}"><option value="active" ${member.status==='active'?'selected':''}>active</option><option value="suspended" ${member.status==='suspended'?'selected':''}>suspended</option></select></td><td>${member.is_primary?'Yes':'No'}</td><td><button type="button" class="org-action" data-save="${member.id}">Save</button></td></tr>`;
  }).join('') : empty(5,'No C/TPA staff assigned.');
  content.innerHTML=`<div class="management-table-wrap"><table class="management-table"><thead><tr><th>Staff User</th><th>Role</th><th>Status</th><th>Primary</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  document.querySelectorAll('[data-save]').forEach(button=>{
    button.addEventListener('click',async()=>{
      const id=button.dataset.save;
      try{
        await invokeCtpa({action:'save_staff',ctpa_id:d.ctpa.id,member:{id,role_id:document.querySelector(`[data-role="${id}"]`).value,status:document.querySelector(`[data-status="${id}"]`).value}});
        status('Staff access updated.','success');
      }catch(error){status(error.message,'error');}
    });
  });
}

