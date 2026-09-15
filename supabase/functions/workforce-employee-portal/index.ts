import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const H = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const J = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });

async function caller(req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: { user }, error } = await db.auth.getUser(jwt);
  if (error || !user) return null;

  const mr = await db.from("organization_memberships")
    .select("id,tenant_id,organization_id,status,roles(code,name),organizations(organization_type,legal_name,status,archived_at)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("roles.code", "employee")
    .limit(10);
  if (mr.error) throw mr.error;

  const membership = (mr.data || []).find((m: any) =>
    m.roles?.code === "employee" &&
    m.organizations?.organization_type === "employer" &&
    m.organizations?.status === "active" &&
    !m.organizations?.archived_at
  );
  if (!membership) return null;

  const employerResult = await db.from("employers")
    .select("id,tenant_id,organization_id,legal_name,dba_name,state,status")
    .eq("organization_id", membership.organization_id)
    .is("archived_at", null)
    .maybeSingle();
  if (employerResult.error) throw employerResult.error;
  if (!employerResult.data) return null;

  const employeeResult = await db.from("employees")
    .select("id,tenant_id,employer_id,auth_user_id,employee_number,first_name,middle_name,last_name,email,mobile,address_line1,address_line2,city,state,postal_code,country,hire_date,job_title,dot_covered,dot_agency,cdl_number,cdl_state,safety_sensitive,employment_status")
    .eq("auth_user_id", user.id)
    .eq("employer_id", employerResult.data.id)
    .is("archived_at", null)
    .maybeSingle();
  if (employeeResult.error) throw employeeResult.error;
  if (!employeeResult.data) return null;

  return { user, membership, employer: employerResult.data, employee: employeeResult.data };
}

async function workspace(c: any) {
  const employeeId = c.employee.id;
  const userId = c.user.id;

  const programsResult = await db.from("employee_programs")
    .select("id,status,enrolled_at,effective_date,end_date,programs(id,name,program_type,dot_agency,regulatory_authority,testing_panel,testing_method,status)")
    .eq("employee_id", employeeId)
    .order("effective_date", { ascending: false });
  if (programsResult.error) throw programsResult.error;

  const ordersResult = await db.from("testing_orders")
    .select("id,order_number,reason,test_type,program_type,testing_panel,collection_type,collection_deadline,status,assigned_at,notified_at,scheduled_at,collected_at,completed_at,created_at")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(250);
  if (ordersResult.error) throw ordersResult.error;

  const orders = ordersResult.data || [];
  const orderIds = orders.map((x: any) => x.id);
  let results: any[] = [];
  if (orderIds.length) {
    const rr = await db.from("test_results")
      .select("id,testing_order_id,preliminary_status,mro_status,final_status,result_date,finalized_at,notification_status,created_at")
      .in("testing_order_id", orderIds)
      .order("created_at", { ascending: false });
    if (rr.error) throw rr.error;
    const om = new Map(orders.map((x: any) => [x.id, x]));
    results = (rr.data || []).map((r: any) => {
      const o: any = om.get(r.testing_order_id) || {};
      return { ...r, order_number: o.order_number || null, reason: o.reason || null, test_type: o.test_type || null, program_type: o.program_type || null };
    });
  }

  const docsResult = await db.from("documents")
    .select("id,document_type,storage_bucket,storage_path,file_name,mime_type,size_bytes,uploaded_at,expires_at,access_level,metadata")
    .eq("employee_id", employeeId)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(250);
  if (docsResult.error) throw docsResult.error;

  const notesResult = await db.from("notifications")
    .select("id,event_type,channel,subject,body,status,queued_at,sent_at,delivered_at,related_type,related_id")
    .eq("recipient_user_id", userId)
    .order("queued_at", { ascending: false })
    .limit(100);
  if (notesResult.error) throw notesResult.error;

  return {
    employee: c.employee,
    employer: c.employer,
    programs: programsResult.data || [],
    testing_orders: orders,
    results,
    documents: docsResult.data || [],
    notifications: notesResult.data || [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "POST") return J({ error: "Method not allowed." }, 405);
  try {
    const c = await caller(req);
    if (!c) return J({ error: "Employee / Driver portal access required." }, 403);
    const b = await req.json().catch(() => ({}));
    const action = String(b.action || "workspace");

    if (action === "workspace") return J(await workspace(c));

    if (action === "document_url") {
      const id = String(b.document_id || "");
      if (!id) return J({ error: "Document id is required." }, 400);
      const dr = await db.from("documents")
        .select("id,employee_id,storage_bucket,storage_path,file_name,archived_at")
        .eq("id", id)
        .eq("employee_id", c.employee.id)
        .is("archived_at", null)
        .maybeSingle();
      if (dr.error) throw dr.error;
      if (!dr.data) return J({ error: "Document not found." }, 404);
      const signed = await db.storage.from(dr.data.storage_bucket).createSignedUrl(dr.data.storage_path, 300, { download: dr.data.file_name });
      if (signed.error) throw signed.error;
      return J({ url: signed.data.signedUrl, file_name: dr.data.file_name });
    }

    return J({ error: "Unsupported employee portal action." }, 400);
  } catch (e) {
    console.error("workforce-employee-portal", e);
    return J({ error: e instanceof Error ? e.message : "Employee portal request failed." }, 500);
  }
});
