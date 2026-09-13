
import {loadEmployerList,loadEmployerContext,invokeEmployer,esc,money} from './employer-management.js';
export const $=s=>document.querySelector(s);
export function status(msg,type=''){const el=$('#pageStatus');if(!el)return;el.textContent=msg;el.className=`inline-status ${type}`.trim();}
export async function init(key){
  await loadEmployerList($('#employerSelector'));
  const x=await loadEmployerContext(key);
  if(!x.id){status('Select an employer to begin management.');return null}
  const d=x.detail;
  $('#contextEmployerName').textContent=d.employer.legal_name;
  $('#contextEmployerMeta').textContent=`${d.employer.dot_number?'USDOT '+d.employer.dot_number+' • ':''}${d.subscription?.plans?.name||'No plan assigned'}`;
  return d;
}
export function formData(form){return Object.fromEntries(new FormData(form));}
export function yn(v){return v?'Yes':'No'}
export function date(v){return v?new Date(v).toLocaleString():'—'}
export function empty(cols,msg='No records found.'){return `<tr><td colspan="${cols}"><div class="management-empty">${esc(msg)}</div></td></tr>`}
export function editor(title,fields,submit='Save'){
 return `<section class="admin-inline-editor" id="inlineEditor" style="display:none"><div class="management-section-head"><div><h3>${esc(title)}</h3><p>Edit the selected record or add a new one.</p></div></div><form id="inlineForm" class="saas-form">${fields}<div class="saas-actions"><button type="button" class="btn btn-outline" id="cancelEdit">Cancel</button><button class="btn btn-orange">${esc(submit)}</button></div></form></section>`;
}
