import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const U = Deno.env.get("SUPABASE_URL")!;
const K = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(U, K, { auth: { persistSession: false } });
const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json",
};
const J = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });

const portalOf = (m: any) => {
  const role = m?.roles?.code;
  const type = String(m?.organizations?.organization_type || "");
  if (role === "platform_admin") return "admin";
  if (role === "employee") return "employee";
  if (role === "owner_operator_admin" || type === "owner_operator") return "owner_operator";
  if (role === "ctpa_admin" || role === "ctpa_staff" || type === "ctpa") return "ctpa";
  if (["employer_admin", "der", "supervisor", "hr_admin"].includes(role) || type === "employer") return "employer";
  return null;
};

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
    const requested = String(body?.requested_portal || "").replace("-", "_");

    const mr = await db.from("organization_memberships")
      .select("id,user_id,tenant_id,organization_id,status,is_primary,role_id,created_at,roles(code,name),organizations(organization_type,legal_name,status,archived_at)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (mr.error) throw mr.error;

    const ms = (mr.data || []).filter((x: any) => x.organizations?.status === "active" && !x.organizations?.archived_at);
    const platform = ms.find((x: any) => x.roles?.code === "platform_admin");
    if (platform) {
      return J({
        user: { id: user.id, email: user.email }, authenticated: true, has_access: true, portal: "admin",
        membership: {
          id: platform.id, tenant_id: platform.tenant_id, organization_id: platform.organization_id,
          organization_type: platform.organizations?.organization_type || "platform",
          organization_name: platform.organizations?.legal_name || "screenings4u",
          role_code: "platform_admin", role_name: platform.roles?.name || "Platform Administrator",
          employer_id: null, ctpa_id: null, owner_operator_id: null, employee_id: null,
        },
        subscription: null, entitlements: {}, permissions: [], workspaces: [],
      });
    }

    const customer = ms.filter((m: any) => portalOf(m) && portalOf(m) !== "admin");
    const workspaces: any[] = [];
    for (const m of customer) {
      const w = await resolveWorkspace(m);
      if (w?.subscription) workspaces.push(w);
    }

    if (!workspaces.length) {
      return J({ user: { id: user.id, email: user.email }, authenticated: true, has_access: false, reason: "no_active_subscription", workspaces: [] });
    }

    let chosen: any = null;
    if (selected) chosen = workspaces.find((w: any) => w.membership_id === selected) || null;
    if (!chosen && requested) {
      const matches = workspaces.filter((w: any) => w.portal === requested);
      if (matches.length === 1) chosen = matches[0];
    }
    if (!chosen && workspaces.length === 1) chosen = workspaces[0];
    if (!chosen) return J({ user: { id: user.id, email: user.email }, authenticated: true, has_access: true, requires_workspace_selection: true, workspaces });

    const er = await entitlements(chosen);
    const mm = customer.find((m: any) => m.id === chosen.membership_id);
    const pr = await db.from("role_permissions").select("permissions(code)").eq("role_id", mm.role_id);
    if (pr.error) throw pr.error;
    const permissions = (pr.data || []).map((x: any) => x.permissions?.code).filter(Boolean);

    return J({
      user: { id: user.id, email: user.email }, authenticated: true, has_access: true, requires_workspace_selection: false,
      portal: chosen.portal,
      membership: {
        id: chosen.membership_id, tenant_id: chosen.tenant_id, organization_id: chosen.organization_id,
        organization_type: chosen.organization_type, organization_name: chosen.organization_name,
        role_code: chosen.role_code, role_name: chosen.role_name, employer_id: chosen.employer_id,
        ctpa_id: chosen.ctpa_id, owner_operator_id: chosen.owner_operator_id, employee_id: chosen.employee_id,
      },
      subscription: chosen.subscription, entitlements: er, permissions, workspaces,
    });
  } catch (e) {
    console.error("workforce-session-context", e);
    return J({ error: e instanceof Error ? e.message : "Context error" }, 500);
  }
});
