import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const H={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
const ACTIVE_SUBS=['active','trial','trialing'];
const ALLOWED_UPLOADS=new Set(['application/pdf','image/png','image/jpeg']);
const MAX_UPLOAD=10*1024*1024;
const safeName=(v:string)=>String(v||'file').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-120)||'file';

async function entitlements(subscription:any,employerId:string){
  const out:Record<string,boolean>={};
  if(!subscription?.plan_id)return out;
  const pf=await db.from('plan_features').select('enabled,feature_catalog(code)').eq('plan_id',subscription.plan_id);
  if(pf.error)throw pf.error;
  for(const x of pf.data||[]){const code=(x as any).feature_catalog?.code;if(code)out[code]=!!(x as any).enabled}
  const ov=await db.from('account_feature_overrides').select('enabled,subscription_id,employer_id,feature_catalog(code)').or(`subscription_id.eq.${subscription.id},employer_id.eq.${employerId}`);
  if(!ov.error)for(const x of ov.data||[]){const code=(x as any).feature_catalog?.code;if(code)out[code]=!!(x as any).enabled}
  return out;
}

async function context(req:Request,b:any){
  const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  const {data:{user},error}=await db.auth.getUser(jwt);if(error||!user)return null;
  let q=db.from('organization_memberships').select('id,user_id,tenant_id,organization_id,role_id,status,roles(code,name),organizations(organization_type,legal_name,status,archived_at)').eq('user_id',user.id).eq('status','active').eq('roles.code','employee');
  if(b.membership_id)q=q.eq('id',String(b.membership_id));
  const mr=await q.limit(20);if(mr.error)throw mr.error;
  const memberships=(mr.data||[]).filter((m:any)=>m.roles?.code==='employee'&&m.organizations?.organization_type==='employer'&&m.organizations?.status==='active'&&!m.organizations?.archived_at);
  if(!memberships.length)return null;
  if(!b.membership_id&&memberships.length>1)throw new Error('Select an Employee workspace before continuing.');
  const m:any=memberships[0];
  const er=await db.from('employers').select('id,tenant_id,organization_id,legal_name,dba_name,state,status,phone').eq('organization_id',m.organization_id).is('archived_at',null).maybeSingle();
  if(er.error)throw er.error;if(!er.data)return null;
  const xr=await db.from('employees').select('id,tenant_id,employer_id,auth_user_id,employee_number,first_name,middle_name,last_name,date_of_birth,email,mobile,address_line1,address_line2,city,state,postal_code,country,hire_date,termination_date,job_title,dot_covered,dot_agency,cdl_number,cdl_state,safety_sensitive,employment_status,created_at,updated_at').eq('auth_user_id',user.id).eq('employer_id',er.data.id).is('archived_at',null).maybeSingle();
  if(xr.error)throw xr.error;if(!xr.data)return null;
  const sr=await db.from('subscriptions').select('id,status,plan_id,renewal_date,plans(id,code,name,audience)').eq('employer_id',er.data.id).in('status',ACTIVE_SUBS).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(sr.error)throw sr.error;if(!sr.data)return {user,membership:m,employer:er.data,employee:xr.data,subscription:null,entitlements:{}};
  return {user,membership:m,employer:er.data,employee:xr.data,subscription:sr.data,entitlements:await entitlements(sr.data,er.data.id)};
}
const has=(c:any,code:string)=>c.entitlements?.[code]===true;
async function audit(c:any,action:string,type:string,id:string|null,before:any,after:any){
  const r=await db.from('audit_events').insert({tenant_id:c.employer.tenant_id,organization_id:c.employer.organization_id,actor_user_id:c.user.id,action,resource_type:type,resource_id:id,before_data:before||null,after_data:after||null,metadata:{source:'employee_portal',employee_id:c.employee.id}});if(r.error)throw r.error;
}
async function signedDocument(documentId:string,c:any,opts:{requireEmployee?:boolean}={}){
  let q=db.from('documents').select('id,employee_id,employer_id,storage_bucket,storage_path,file_name,archived_at').eq('id',documentId).eq('employer_id',c.employer.id).is('archived_at',null);
  if(opts.requireEmployee!==false)q=q.eq('employee_id',c.employee.id);
  const dr=await q.maybeSingle();if(dr.error)throw dr.error;if(!dr.data)throw new Error('Document not found.');
  const sr=await db.storage.from(dr.data.storage_bucket).createSignedUrl(dr.data.storage_path,300,{download:dr.data.file_name});if(sr.error)throw sr.error;
  return {url:sr.data.signedUrl,file_name:dr.data.file_name};
}
async function workspace(c:any){
  const employeeId=c.employee.id, employerId=c.employer.id;
  let programs:any[]=[],orders:any[]=[],results:any[]=[],reports:any[]=[],documents:any[]=[],notifications:any[]=[],credentials:any[]=[],training:any[]=[],policies:any[]=[];
  if(has(c,'programs')){
    const r=await db.from('employee_programs').select('id,status,enrolled_at,effective_date,end_date,program_id,programs(id,name,program_type,dot_agency,regulatory_authority,testing_panel,testing_method,status)').eq('employee_id',employeeId).order('effective_date',{ascending:false});if(r.error)throw r.error;programs=r.data||[];
  }
  if(has(c,'testing_orders')){
    const r=await db.from('testing_orders').select('id,program_id,order_number,reason,test_type,program_type,testing_panel,collection_type,collection_deadline,status,assigned_at,notified_at,scheduled_at,collected_at,completed_at,created_at,programs(id,name,dot_agency),collection_sites(id,name,address_line1,city,state,postal_code)').eq('employee_id',employeeId).eq('employer_id',employerId).order('created_at',{ascending:false}).limit(250);if(r.error)throw r.error;orders=r.data||[];
  }
  if(has(c,'results_summary')){
    const ids=orders.map((x:any)=>x.id);
    if(ids.length){
      const r=await db.from('test_results').select('id,testing_order_id,final_status,result_date,finalized_at,notification_status,created_at').in('testing_order_id',ids).neq('final_status','pending').order('finalized_at',{ascending:false});if(r.error)throw r.error;
      const om=new Map(orders.map((x:any)=>[x.id,x]));results=(r.data||[]).map((x:any)=>{const o:any=om.get(x.testing_order_id)||{};return {...x,order_number:o.order_number||null,reason:o.reason||null,test_type:o.test_type||null,program_type:o.program_type||null,program_name:o.programs?.name||null}});
    }
    const rr=await db.from('test_result_reports').select('id,testing_order_id,test_result_id,report_number,report_status,test_reason,regulatory_mode,specimen_type,collection_site_name,laboratory_name,mro_name,mro_verified_at,verified_result,finalized_at,testing_orders(id,order_number,reason,test_type,program_type,status)').eq('employer_id',employerId).eq('employee_id',employeeId).eq('report_status','final').order('finalized_at',{ascending:false}).limit(100);if(rr.error)throw rr.error;reports=rr.data||[];
  }
  if(has(c,'documents')){
    const r=await db.from('documents').select('id,document_type,file_name,mime_type,size_bytes,uploaded_at,expires_at,access_level,metadata,testing_order_id,program_id').eq('employee_id',employeeId).eq('employer_id',employerId).is('archived_at',null).order('uploaded_at',{ascending:false}).limit(250);if(r.error)throw r.error;documents=r.data||[];
  }
  if(has(c,'notifications')){
    const r=await db.from('notifications').select('id,event_type,channel,subject,body,status,queued_at,sent_at,delivered_at,related_type,related_id').eq('recipient_user_id',c.user.id).order('queued_at',{ascending:false}).limit(100);if(r.error)throw r.error;notifications=r.data||[];
  }
  if(has(c,'driver_qualification')){
    const r=await db.from('employee_credentials').select('id,credential_type,credential_number,issuing_state,issued_at,expires_at,status,document_id,verified_at,created_at,updated_at,documents(id,file_name)').eq('employee_id',employeeId).eq('employer_id',employerId).order('expires_at',{ascending:true});if(r.error)throw r.error;credentials=r.data||[];
  }
  if(has(c,'training_records')){
    const r=await db.from('employer_training_records').select('id,training_type,training_title,provider,completed_at,expires_at,status,certificate_document_id,notes,created_at,updated_at').eq('employer_id',employerId).eq('employee_id',employeeId).order('created_at',{ascending:false});if(r.error)throw r.error;training=r.data||[];
  }
  if(has(c,'policy_acknowledgments')){
    const r=await db.from('employer_policy_acknowledgments').select('id,status,distributed_at,acknowledged_at,acknowledged_name,acknowledgement_method,notes,policy_document_id,ctpa_policy_documents(id,title,version,program_type,dot_agency,status,generated_document_id)').eq('employer_id',employerId).eq('employee_id',employeeId).order('created_at',{ascending:false});if(r.error)throw r.error;policies=r.data||[];
  }
  return {employee:c.employee,employer:c.employer,subscription:c.subscription?{id:c.subscription.id,status:c.subscription.status,renewal_date:c.subscription.renewal_date,plan_code:c.subscription.plans?.code||null,plan_name:c.subscription.plans?.name||null}:null,entitlements:c.entitlements,programs,testing_orders:orders,results,result_reports:reports,documents,notifications,credentials,training,policies};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:H});if(req.method!=='POST')return J({error:'Method not allowed.'},405);
  try{
    const b=await req.json().catch(()=>({})),c=await context(req,b);if(!c)return J({error:'Employee / Driver portal access required.'},403);if(!c.subscription)return J({error:'An active Employer subscription is required for Employee Portal access.'},403);
    const a=String(b.action||'workspace');
    if(a==='workspace'||a==='context')return J(await workspace(c));
    if(a==='save_profile'){
      const x=b.profile||{},before={mobile:c.employee.mobile,address_line1:c.employee.address_line1,address_line2:c.employee.address_line2,city:c.employee.city,state:c.employee.state,postal_code:c.employee.postal_code,country:c.employee.country};
      const patch={mobile:String(x.mobile||'').trim()||null,address_line1:String(x.address_line1||'').trim()||null,address_line2:String(x.address_line2||'').trim()||null,city:String(x.city||'').trim()||null,state:String(x.state||'').trim().toUpperCase().slice(0,10)||null,postal_code:String(x.postal_code||'').trim()||null,country:String(x.country||'US').trim().toUpperCase().slice(0,2)||'US',updated_at:new Date().toISOString()};
      const r=await db.from('employees').update(patch).eq('id',c.employee.id).eq('employer_id',c.employer.id).select().single();if(r.error)throw r.error;
      await db.from('profiles').update({phone:patch.mobile,updated_at:new Date().toISOString()}).eq('id',c.user.id);
      await audit(c,'employee.profile.update','employee',c.employee.id,before,patch);return J({success:true,employee:r.data});
    }
    if(a==='document_url'){
      if(!has(c,'documents'))return J({error:'Documents are not enabled for this Employer plan.'},403);const id=String(b.document_id||'');if(!id)return J({error:'Document id is required.'},400);return J(await signedDocument(id,c));
    }
    if(a==='get_result_report'){
      if(!has(c,'results_summary'))return J({error:'Results are not enabled for this Employer plan.'},403);const id=String(b.report_id||'');if(!id)return J({error:'Report id is required.'},400);
      const r=await db.from('test_result_reports').select('id,report_number,report_status,test_reason,regulatory_mode,specimen_type,specimen_external_id,collection_site_name,laboratory_name,mro_name,mro_verified_at,verified_result,finalized_at,summary_html,official_mro_document_id,employees(id,first_name,last_name,employee_number),testing_orders(id,order_number,reason,test_type,program_type,status)').eq('id',id).eq('employer_id',c.employer.id).eq('employee_id',c.employee.id).eq('report_status','final').maybeSingle();if(r.error)throw r.error;if(!r.data)return J({error:'Result report not found.'},404);return J({report:r.data});
    }
    if(a==='result_document_url'){
      if(!has(c,'results_summary'))return J({error:'Results are not enabled for this Employer plan.'},403);const id=String(b.report_id||'');const r=await db.from('test_result_reports').select('official_mro_document_id').eq('id',id).eq('employer_id',c.employer.id).eq('employee_id',c.employee.id).eq('report_status','final').maybeSingle();if(r.error)throw r.error;if(!r.data?.official_mro_document_id)return J({error:'No official MRO document is attached to this report.'},404);return J(await signedDocument(r.data.official_mro_document_id,c,{requireEmployee:false}));
    }
    if(a==='credential_upload_ticket'){
      if(!has(c,'driver_qualification'))return J({error:'Credential tracking is not enabled for this Employer plan.'},403);const fileName=safeName(String(b.file_name||'')),mime=String(b.mime_type||''),size=Number(b.size_bytes||0);if(!fileName||!ALLOWED_UPLOADS.has(mime)||!size||size>MAX_UPLOAD)return J({error:'Upload a PDF, PNG, or JPG file up to 10 MB.'},400);
      const path=`employees/${c.employee.id}/credentials/${crypto.randomUUID()}/${fileName}`;const r=await db.storage.from('workforce-documents').createSignedUploadUrl(path);if(r.error)throw r.error;return J({bucket:'workforce-documents',path,token:r.data.token,file_name:fileName});
    }
    if(a==='save_credential'){
      if(!has(c,'driver_qualification'))return J({error:'Credential tracking is not enabled for this Employer plan.'},403);const x=b.credential||{},type=String(x.credential_type||'').trim();if(!type)return J({error:'Credential type is required.'},400);
      let documentId=x.document_id||null;
      if(b.upload?.path){const p=String(b.upload.path),prefix=`employees/${c.employee.id}/credentials/`;if(!p.startsWith(prefix))return J({error:'Invalid credential upload path.'},400);const parts=p.split('/'),name=parts[parts.length-1],folder=parts.slice(0,-1).join('/');const listed=await db.storage.from('workforce-documents').list(folder,{search:name,limit:20});if(listed.error)throw listed.error;if(!(listed.data||[]).some((z:any)=>z.name===name))return J({error:'Credential file upload was not found.'},400);const dr=await db.from('documents').insert({tenant_id:c.employer.tenant_id,employer_id:c.employer.id,employee_id:c.employee.id,document_type:'employee_credential',storage_bucket:'workforce-documents',storage_path:p,file_name:String(b.upload.file_name||name),mime_type:b.upload.mime_type||null,size_bytes:b.upload.size_bytes||null,uploaded_by:c.user.id,access_level:'standard',metadata:{source:'employee_portal',credential_type:type}}).select().single();if(dr.error)throw dr.error;documentId=dr.data.id}
      let old:any=null;if(x.id){const or=await db.from('employee_credentials').select('*').eq('id',String(x.id)).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id).maybeSingle();if(or.error)throw or.error;if(!or.data)return J({error:'Credential not found.'},404);old=or.data}
      const patch:any={tenant_id:c.employer.tenant_id,employer_id:c.employer.id,employee_id:c.employee.id,credential_type:type,credential_number:String(x.credential_number||'').trim()||null,issuing_state:String(x.issuing_state||'').trim().toUpperCase().slice(0,10)||null,issued_at:x.issued_at||null,expires_at:x.expires_at||null,status:'pending',document_id:documentId||null,verified_by:null,verified_at:null,notes:String(x.notes||'').trim()||null,updated_at:new Date().toISOString()};
      const q=x.id?db.from('employee_credentials').update(patch).eq('id',String(x.id)).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id):db.from('employee_credentials').insert(patch);const r=await q.select().single();if(r.error)throw r.error;await audit(c,'employee.credential.submit','employee_credential',r.data.id,old,r.data);return J({success:true,credential:r.data});
    }
    if(a==='credential_document_url'){
      if(!has(c,'driver_qualification'))return J({error:'Credential tracking is not enabled for this Employer plan.'},403);const id=String(b.credential_id||'');const r=await db.from('employee_credentials').select('document_id').eq('id',id).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id).maybeSingle();if(r.error)throw r.error;if(!r.data?.document_id)return J({error:'No supporting document is attached to this credential.'},404);return J(await signedDocument(r.data.document_id,c));
    }
    if(a==='training_certificate_url'){
      if(!has(c,'training_records'))return J({error:'Training records are not enabled for this Employer plan.'},403);const id=String(b.training_id||'');const r=await db.from('employer_training_records').select('certificate_document_id').eq('id',id).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id).maybeSingle();if(r.error)throw r.error;if(!r.data?.certificate_document_id)return J({error:'No training certificate is attached to this record.'},404);return J(await signedDocument(r.data.certificate_document_id,c,{requireEmployee:false}));
    }
    if(a==='policy_document_url'){
      if(!has(c,'policy_acknowledgments'))return J({error:'Policy acknowledgments are not enabled for this Employer plan.'},403);const id=String(b.acknowledgment_id||'');const r=await db.from('employer_policy_acknowledgments').select('id,policy_document_id,ctpa_policy_documents(generated_document_id)').eq('id',id).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id).maybeSingle();if(r.error)throw r.error;const doc=(r.data as any)?.ctpa_policy_documents?.generated_document_id;if(!doc)return J({error:'No policy document is available for this acknowledgment.'},404);return J(await signedDocument(doc,c,{requireEmployee:false}));
    }
    if(a==='acknowledge_policy'){
      if(!has(c,'policy_acknowledgments'))return J({error:'Policy acknowledgments are not enabled for this Employer plan.'},403);const id=String(b.acknowledgment_id||''),name=String(b.acknowledged_name||'').trim();if(!id||!name)return J({error:'Acknowledgment name is required.'},400);const old=await db.from('employer_policy_acknowledgments').select('*').eq('id',id).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id).maybeSingle();if(old.error)throw old.error;if(!old.data)return J({error:'Policy acknowledgment not found.'},404);if(old.data.acknowledged_at)return J({success:true,acknowledgment:old.data});const patch={status:'acknowledged',acknowledged_at:new Date().toISOString(),acknowledged_name:name,acknowledgement_method:'employee_portal',acknowledged_by:c.user.id,updated_at:new Date().toISOString()};const r=await db.from('employer_policy_acknowledgments').update(patch).eq('id',id).eq('employee_id',c.employee.id).eq('employer_id',c.employer.id).select().single();if(r.error)throw r.error;await audit(c,'employee.policy.acknowledge','policy_acknowledgment',id,old.data,r.data);return J({success:true,acknowledgment:r.data});
    }
    return J({error:'Unsupported employee portal action.'},400);
  }catch(e){console.error('workforce-employee-portal',e);return J({error:e instanceof Error?e.message:'Employee portal request failed.'},500)}
});
