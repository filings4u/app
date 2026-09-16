import { createClient } from 'npm:@supabase/supabase-js@2';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const H={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
async function ctx(req:Request){
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 const {data:{user},error}=await db.auth.getUser(jwt);if(error||!user)return null;
 const mr=await db.from('organization_memberships').select('tenant_id,organization_id,role_id,roles(code),organizations(organization_type,status,archived_at)').eq('user_id',user.id).eq('status','active');if(mr.error)throw mr.error;
 for(const m of mr.data||[]){
  if(!['owner_operator_admin','owner_operator_staff'].includes((m as any).roles?.code)||(m as any).organizations?.organization_type!=='owner_operator'||(m as any).organizations?.status!=='active'||(m as any).organizations?.archived_at)continue;
  const o=await db.from('owner_operators').select('id,tenant_id,organization_id,employer_id,status').eq('organization_id',(m as any).organization_id).is('archived_at',null).maybeSingle();if(o.error)throw o.error;if(!o.data||o.data.status!=='active')continue;
  const pr=await db.from('role_permissions').select('permissions(code)').eq('role_id',(m as any).role_id);if(pr.error)throw pr.error;
  const permissions=new Set((pr.data||[]).map((x:any)=>x.permissions?.code).filter(Boolean));if(!permissions.has('compliance.read'))continue;
  const sr=await db.from('subscriptions').select('id,plan_id,status').eq('employer_id',o.data.employer_id).in('status',['active','trial','trialing']).order('created_at',{ascending:false}).limit(1).maybeSingle();if(sr.error)throw sr.error;if(!sr.data)continue;
  const fr=await db.from('feature_catalog').select('id').eq('code','compliance').maybeSingle();if(fr.error)throw fr.error;if(!fr.data)continue;
  const ov=await db.from('account_feature_overrides').select('enabled').eq('feature_id',fr.data.id).or(`subscription_id.eq.${sr.data.id},employer_id.eq.${o.data.employer_id}`).limit(1).maybeSingle();if(ov.error)throw ov.error;
  let enabled=ov.data?.enabled;if(enabled==null){const pf=await db.from('plan_features').select('enabled').eq('plan_id',sr.data.plan_id).eq('feature_id',fr.data.id).maybeSingle();if(pf.error)throw pf.error;enabled=!!pf.data?.enabled}
  if(!enabled)continue;return{user,owner:o.data};
 }
 return null;
}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:H});if(req.method!=='POST')return J({error:'Method not allowed.'},405);try{const c=await ctx(req);if(!c)return J({error:'Active Owner-Operator compliance access required.'},403);const r=await db.from('sap_cases').select('*,compliance_cases!inner(id,employer_id,case_number,event_type,status,employees(first_name,last_name,employee_number)),follow_up_tests(*)').eq('compliance_cases.employer_id',c.owner.employer_id).order('created_at',{ascending:false}).limit(250);if(r.error)throw r.error;return J({cases:r.data||[]})}catch(e){console.error('workforce-owner-rtd',e);return J({error:e instanceof Error?e.message:'Owner-Operator RTD request failed.'},500)}});
