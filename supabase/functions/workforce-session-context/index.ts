import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const U = Deno.env.get("SUPABASE_URL")!;
const K = (Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
const db = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};
const J = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });

const norm = (p: any) => String(p || "").trim().toLowerCase().replaceAll("-", "_");
const fallbackPortal = (m: any) => {
  const role = m?.roles?.code;
  const type = String(m?.organizations?.organization_type || "");
  if (role === "platform_admin") return "admin";
  if (role === "employee") return "employee";
  if (["owner_operator_admin", "owner_operator_staff"].includes(role) || type === "owner_operator") return "owner_operator";
  if (["ctpa_admin", "ctpa_staff"].includes(role) || type === "ctpa") return "ctpa";
  if (["employer_admin", "der", "supervisor", "hr_admin"].includes(role) || type === "employer") return "employer";
  return null;
};
const portalOf = (m: any) => norm(m?.roles?.portal_code) || fallbackPortal(m);
const validScope = (m: any) => !m?.roles?.expected_organization_type || m.roles.expected_organization_type === m?.organizations?.organization_type;
const roleIdentity = (m: any) => ({ portal_code: portalOf(m), principal_type: m?.roles?.principal_type || null, is_internal_staff: !!m?.roles?.is_internal_staff, expected_organization_type: m?.roles?.expected_organization_type || null });

async function resolveWorkspace(m: any) {
  const portal = portalOf(m);
  let employer: any = null;
  let ctpa: any = null;
  let owner: any = null;
  let employee: any = null;

  if (portal === "employer" || portal === "employee") {
    const r = await db.from("employers")
      .select("id,tenant_id,organization_id,legal_name")
      .eq("organization_id", m.organization_id)
      .is("archived_at", null)
      .maybeSingle();
    if (r.error) throw r.error;
    employer = r.data;

    if (portal === "employee" && employer?.id) {
      const er = await db.from("employees")
        .select("id,tenant_id,employer_id,auth_user_id,first_name,last_name,email,employment_status")
        .eq("employer_id", employer.id)
        .eq("auth_user_id", m.user_id)
        .is("archived_at", null)
        .maybeSingle();
      if (er.error) throw er.error;
      employee = er.data;
      if (!employee) return null;
    }
  } else if (portal === "ctpa") {
    const r = await db.from("ctpas")
      .select("id,tenant_id,organization_id,status")
      .eq("organization_id", m.organization_id)
      .maybeSingle();
    if (r.error) throw r.error;
    ctpa = r.data;
  } else if (portal === "owner_operator") {
    const r = await db.from("owner_operators")
      .select("id,tenant_id,organization_id,employer_id,legal_name")
      .eq("organization_id", m.organization_id)
      .is("archived_at", null)
      .maybeSingle();
    if (r.error) throw r.error;
    owner = r.data;
    if (owner?.employer_id) {
      const er = await db.from("employers")
        .select("id,tenant_id,organization_id,legal_name")
        .eq("id", owner.employer_id)
        .maybeSingle();
      if (er.error) throw er.error;
      employer = er.data;
    }
  }

  let sub: any = null;
  if (portal !== "admin") {
    let q = db.from("subscriptions")
      .select("*,plans(id,code,name,audience,monthly_price,employee_limit,driver_limit)")
      .eq("tenant_id", m.tenant_id)
      .in("status", ["active", "trial", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (portal === "ctpa" && ctpa?.id) q = q.eq("ctpa_id", ctpa.id);
    else if (employer?.id) q = q.eq("employer_id", employer.id);

    const sr = await q.maybeSingle();
    if (sr.error) throw sr.error;
    sub = sr.data || null;
  }

  return {
    membership_id: m.id,
    tenant_id: m.tenant_id,
    organization_id: m.organization_id,
    organization_name: m.organizations?.legal_name || owner?.legal_name || employer?.legal_name || "Workforce Account",
    organization_type: m.organizations?.organization_type,
    role_code: m.roles?.code,
    role_name: m.roles?.name,
    role_identity: roleIdentity(m),
    portal,
    employer_id: employer?.id || null,
    ctpa_id: ctpa?.id || null,
    owner_operator_id: owner?.id || null,
    employee_id: employee?.id || null,
    subscription: sub ? {
      id: sub.id,
      status: sub.status,
      plan_id: sub.plan_id,
      plan_code: sub.plans?.code,
      plan_name: sub.plans?.name,
      audience: sub.plans?.audience,
      renewal_date: sub.renewal_date,
      employee_limit: sub.employee_limit ?? sub.plans?.employee_limit ?? null,
      driver_limit: sub.driver_limit ?? sub.plans?.driver_limit ?? null,
    } : null,
  };
}

async function entitlements(w: any) {
  const out: Record<string, boolean> = {};
  const s = w.subscription;
  if (!s?.plan_id) return out;

  const pf = await db.from("plan_features")
    .select("feature_id,enabled,feature_catalog(code)")
    .eq("plan_id", s.plan_id);
  if (pf.error) throw pf.error;
  for (const x of pf.data || []) {
    const code = (x as any).feature_catalog?.code;
    if (code) out[code] = !!x.enabled;
  }

  let oq = db.from("account_feature_overrides")
    .select("feature_id,enabled,feature_catalog(code)")
    .eq("subscription_id", s.id);
  if (w.employer_id) oq = oq.or(`subscription_id.eq.${s.id},employer_id.eq.${w.employer_id}`);
  else if (w.ctpa_id) oq = oq.or(`subscription_id.eq.${s.id},ctpa_id.eq.${w.ctpa_id}`);

  const ov = await oq;
  if (!ov.error) {
    for (const x of ov.data || []) {
      const code = (x as any).feature_catalog?.code;
      if (code) out[code] = !!x.enabled;
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  try {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: { user }, error } = await db.auth.getUser(jwt);
    if (error || !user) return J({ error: "Unauthorized" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const selected = String(body?.membership_id || "");
    const requested = norm(body?.requested_portal || "");

    const mr = await db.from("organization_memberships")
      .select("id,user_id,tenant_id,organization_id,status,is_primary,role_id,created_at,roles(code,name,portal_code,principal_type,expected_organization_type,is_internal_staff),organizations(organization_type,legal_name,status,archived_at)")
      .eq("user_id", user.id).eq("status", "active")
      .order("is_primary", { ascending: false }).order("created_at", { ascending: true });
    if (mr.error) throw mr.error;

    const ms = (mr.data || []).filter((x: any) => x.organizations?.status === "active" && !x.organizations?.archived_at && validScope(x) && portalOf(x));
    const platforms = ms.filter((m: any) => portalOf(m) === "admin");
    const customers = ms.filter((m: any) => !["admin", "provider"].includes(portalOf(m)));

    if (requested === "admin") {
      const m = (selected ? platforms.find((x: any) => x.id === selected) : null) || platforms[0];
      if (!m) return J({ user:{id:user.id,email:user.email}, authenticated:true, has_access:false, reason:"portal_not_authorized", requested_portal:"admin", workspaces:[] }, 403);
      const pr = await db.from("role_permissions").select("permissions(code)").eq("role_id", m.role_id);
      if (pr.error) throw pr.error;
      return J({
        user:{id:user.id,email:user.email}, authenticated:true, has_access:true, requires_workspace_selection:false, portal:"admin",
        membership:{id:m.id,tenant_id:m.tenant_id,organization_id:m.organization_id,organization_type:m.organizations?.organization_type||"platform",organization_name:m.organizations?.legal_name||"screenings4u",role_code:m.roles?.code,role_name:m.roles?.name||"Platform Administrator",role_identity:roleIdentity(m),employer_id:null,ctpa_id:null,owner_operator_id:null,employee_id:null},
        subscription:null, entitlements:{}, permissions:(pr.data||[]).map((x:any)=>x.permissions?.code).filter(Boolean), workspaces:[]
      });
    }

    const candidates = customers.filter((m:any) => requested === "customer" ? true : (!requested || portalOf(m) === requested));
    if (requested && requested !== "customer" && !candidates.length) return J({ user:{id:user.id,email:user.email}, authenticated:true, has_access:false, reason:"portal_not_authorized", requested_portal:requested, workspaces:[] },403);

    const workspaces:any[]=[];
    for (const m of candidates) { const w = await resolveWorkspace(m); if (w?.subscription) workspaces.push(w); }

    if (!workspaces.length) {
      if (!requested && platforms.length) {
        const m=platforms[0]; const pr=await db.from("role_permissions").select("permissions(code)").eq("role_id",m.role_id); if(pr.error)throw pr.error;
        return J({user:{id:user.id,email:user.email},authenticated:true,has_access:true,requires_workspace_selection:false,portal:"admin",membership:{id:m.id,tenant_id:m.tenant_id,organization_id:m.organization_id,organization_type:m.organizations?.organization_type||"platform",organization_name:m.organizations?.legal_name||"screenings4u",role_code:m.roles?.code,role_name:m.roles?.name,role_identity:roleIdentity(m),employer_id:null,ctpa_id:null,owner_operator_id:null,employee_id:null},subscription:null,entitlements:{},permissions:(pr.data||[]).map((x:any)=>x.permissions?.code).filter(Boolean),workspaces:[]});
      }
      return J({user:{id:user.id,email:user.email},authenticated:true,has_access:false,reason:"no_active_subscription",requested_portal:requested||null,workspaces:[]});
    }

    let chosen:any=null;
    if (selected) chosen=workspaces.find((w:any)=>w.membership_id===selected)||null;
    if (!chosen && workspaces.length===1) chosen=workspaces[0];
    if (!chosen) return J({user:{id:user.id,email:user.email},authenticated:true,has_access:true,requires_workspace_selection:true,requested_portal:requested||null,workspaces});

    const mm=candidates.find((m:any)=>m.id===chosen.membership_id);
    if(!mm)return J({error:"Selected workspace is no longer available."},409);
    const pr=await db.from("role_permissions").select("permissions(code)").eq("role_id",mm.role_id); if(pr.error)throw pr.error;
    return J({
      user:{id:user.id,email:user.email},authenticated:true,has_access:true,requires_workspace_selection:false,portal:chosen.portal,
      membership:{id:chosen.membership_id,tenant_id:chosen.tenant_id,organization_id:chosen.organization_id,organization_type:chosen.organization_type,organization_name:chosen.organization_name,role_code:chosen.role_code,role_name:chosen.role_name,role_identity:chosen.role_identity,employer_id:chosen.employer_id,ctpa_id:chosen.ctpa_id,owner_operator_id:chosen.owner_operator_id,employee_id:chosen.employee_id},
      subscription:chosen.subscription,entitlements:await entitlements(chosen),permissions:(pr.data||[]).map((x:any)=>x.permissions?.code).filter(Boolean),workspaces
    });
  } catch (e) {
    console.error("workforce-session-context", e);
    return J({ error: e instanceof Error ? e.message : "Context error" }, 500);
  }
});
