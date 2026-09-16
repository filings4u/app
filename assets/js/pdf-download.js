import{supabase}from'./supabase.js?v=20260916-auth-isolation-v4';
function save(base64,filename){const bin=atob(base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=filename.endsWith('.pdf')?filename:filename+'.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
export async function pdfExport(payload){const{data,error}=await supabase.functions.invoke('workforce-pdf-export',{body:payload});if(error){let m=error.message||'PDF download failed.';try{m=(await error.context.clone().json()).error||m}catch(_){}throw new Error(m)}if(data?.error)throw new Error(data.error);save(data.base64,data.filename);return data}
export const selectionPdf=id=>pdfExport({action:'selection',selection_event_id:id});
export const documentPdf=id=>pdfExport({action:'document',document_id:id});
export const reportPdf=(rows,title,filename)=>pdfExport({action:'report',rows,title,filename});
