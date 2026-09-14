import{api,esc,notice}from'./employer-saas.js';

let cache=null;
async function documents(){
  if(cache)return cache;
  const d=await api({action:'documents'});
  cache=d.documents||[];
  return cache;
}
function optionLabel(d){return `${d.file_name||'Document'}${d.document_type?` — ${d.document_type.replaceAll('_',' ')}`:''}`}
export async function mountLibrarySelector({container,targetType,getTargetId,messageEl,label='Choose from Account Library'}){
  const root=typeof container==='string'?document.querySelector(container):container;
  if(!root)return null;
  root.innerHTML=`<div class="account-library-selector"><div class="account-library-head"><div><strong>${esc(label)}</strong><span>Reuse a document already saved to this Employer account.</span></div><a class="btn btn-outline btn-small" href="documents.html">Open Library</a></div><div class="account-library-controls"><select data-library-document><option value="">Choose saved document</option></select><button type="button" class="btn btn-outline btn-small" data-library-attach>Attach to this record</button></div><div class="saas-notice" data-library-msg style="display:none"></div></div>`;
  const select=root.querySelector('[data-library-document]'),button=root.querySelector('[data-library-attach]'),msg=root.querySelector('[data-library-msg]');
  try{const rows=await documents();select.innerHTML='<option value="">Choose saved document</option>'+rows.map(d=>`<option value="${d.id}">${esc(optionLabel(d))}</option>`).join('');if(!rows.length){button.disabled=true;select.disabled=true;notice(msg,'No reusable documents are in the account library yet. Upload one from Documents & Certificates.');msg.style.display='block';}}
  catch(e){button.disabled=true;notice(msg,e.message,'error');msg.style.display='block';}
  button.onclick=async()=>{const document_id=select.value,target_id=typeof getTargetId==='function'?getTargetId():null;if(!document_id){notice(msg,'Choose a document from the account library.','error');msg.style.display='block';return}if(!target_id){notice(msg,'Save or select the record first, then attach the document.','error');msg.style.display='block';return}button.disabled=true;try{await api({action:'link_document',document_id,target_type:targetType,target_id});notice(msg,'Account library document attached.','success');msg.style.display='block';if(messageEl)messageEl.textContent='Account library document attached.';}catch(e){notice(msg,e.message,'error');msg.style.display='block'}finally{button.disabled=false}};
  return {root,select,button};
}
