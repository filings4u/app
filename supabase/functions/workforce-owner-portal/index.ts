import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const H = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const J = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: H });
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const clean = (v: unknown) => String(v ?? '').trim();
const nullable = (v: unknown) => clean(v) || null;
const numOrNull = (v: unknown) => clean(v) === '' ? null : Number(v);

const WRITE_TEST_STATUSES = new Set([
  'created', 'assigned', 'employee_notified', 'scheduled', 'at_collection', 'collected',
  'cancelled', 'refused', 'no_show', 'unable_to_collect', 'collection_issue',
]);
const TEST_REASONS = new Set(['pre_employment', 'reasonable_suspicion', 'post_accident', 'return_to_duty', 'follow_up', 'other']);
const TEST_TYPES = new Set(['drug', 'alcohol', 'drug_and_alcohol']);
const EMPLOYEE_STATUSES = new Set(['invited', 'pending_enrollment', 'active', 'suspended', 'leave', 'inactive', 'terminated', 'compliance_hold']);
const PROGRAM_STATUSES = new Set(['draft', 'active', 'suspended', 'inactive', 'archived']);
const COMPLIANCE_STATUSES = new Set(['open', 'in_progress', 'pending', 'resolved', 'closed']);
const COMPLIANCE_PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);

async function context(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: ue } = await db.auth.getUser(jwt);
  if (ue || !user) return null;

  const mr = await db.from('organization_memberships')
    .select('id,user_id,tenant_id,organization_id,role_id,status,is_primary,roles(code,name),organizations(organization_type,legal_name,status,archived_at)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (mr.error) throw mr.error;

  for (const m of (mr.data || []) as any[]) {
    if (m.roles?.code !== 'owner_operator_admin') continue;
    if (m.organizations?.organization_type !== 'owner_operator' || m.organizations?.status !== 'active' || m.organizations?.archived_at) continue;

    const or = await db.from('owner_operators')
      .select('*')
      .eq('organization_id', m.organization_id)
      .is('archived_at', null)
      .maybeSingle();
    if (or.error) throw or.error;
    if (!or.data || or.data.status !== 'active') continue;

    const [pr, sr] = await Promise.all([
      db.from('role_permissions').select('permissions(code)').eq('role_id', m.role_id),
      db.from('subscriptions')
        .select('*,plans(id,code,name,audience,monthly_price,employee_limit,driver_limit,included_services,feature_entitlements)')
        .eq('employer_id', or.data.employer_id)
        .in('status', ['active', 'trial', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (pr.error) throw pr.error;
    if (sr.error) throw sr.error;
    if (!sr.data) continue;

    const permissions = new Set((pr.data || []).map((x: any) => x.permissions?.code).filter(Boolean));
    const entitlements: Record<string, boolean> = {};
    const pf = await db.from('plan_features').select('feature_id,enabled,feature_catalog(code)').eq('plan_id', sr.data.plan_id);
    if (pf.error) throw pf.error;
    for (const x of pf.data || []) {
      const code = (x as any).feature_catalog?.code;
      if (code) entitlements[code] = !!(x as any).enabled;
    }
    const ov = await db.from('account_feature_overrides')
      .select('enabled,feature_catalog(code)')
      .or(`subscription_id.eq.${sr.data.id},employer_id.eq.${or.data.employer_id}`);
    if (!ov.error) {
      for (const x of ov.data || []) {
        const code = (x as any).feature_catalog?.code;
        if (code) entitlements[code] = !!(x as any).enabled;
      }
    }

    return { user, membership: m, owner: or.data, subscription: sr.data, permissions, entitlements };
  }
  return null;
}

const can = (c: any, permission: string) => c.permissions?.has(permission) === true;
const has = (c: any, feature: string) => c.entitlements?.[feature] === true;
function guard(c: any, permission?: string, feature?: string) {
  if (permission && !can(c, permission)) throw new Error('Your Owner-Operator role does not include this action.');
  if (feature && !has(c, feature)) throw new Error('This feature is not enabled for your current Owner-Operator plan.');
}

async function audit(req: Request, c: any, action: string, resourceType: string, resourceId: string, beforeData: any, afterData: any) {
  const r = await db.from('audit_events').insert({
    tenant_id: c.owner.tenant_id,
    organization_id: c.owner.organization_id,
    actor_user_id: c.user.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    before_data: beforeData || null,
    after_data: afterData || null,
    ip_address: (req.headers.get('x-forwarded-for') || '').split(',')[0] || null,
    user_agent: req.headers.get('user-agent'),
    metadata: { source: 'workforce-owner-portal' },
  });
  if (r.error) throw r.error;
}

async function getDrivers(c: any) {
  const r = await db.from('employees').select('*').eq('employer_id', c.owner.employer_id).is('archived_at', null).order('last_name').order('first_name');
  if (r.error) throw r.error;
  return r.data || [];
}

async function getPrograms(c: any) {
  const r = await db.from('programs').select('*').eq('employer_id', c.owner.employer_id).is('archived_at', null).order('name');
  if (r.error) throw r.error;
  return r.data || [];
}

async function getProgramEnrollments(c: any) {
  const r = await db.from('employee_programs')
    .select('*,employees!inner(id,employer_id,first_name,last_name,employee_number),programs(id,name,program_type,dot_agency)')
    .eq('employees.employer_id', c.owner.employer_id)
    .order('created_at', { ascending: false });
  if (r.error) throw r.error;
  return r.data || [];
}

async function overview(c: any) {
  const eid = c.owner.employer_id;
  const [drivers, programs, testing, cases, packets, invoices, enrollments] = await Promise.all([
    db.from('employees').select('id,first_name,last_name,employment_status,dot_agency,cdl_state').eq('employer_id', eid).is('archived_at', null),
    db.from('programs').select('id,name,status,program_type,dot_agency').eq('employer_id', eid).is('archived_at', null),
    db.from('testing_orders').select('id,order_number,reason,test_type,status,collection_deadline,created_at,employees(first_name,last_name)').eq('employer_id', eid).order('created_at', { ascending: false }).limit(25),
    db.from('compliance_cases').select('id,case_number,event_type,priority,status,compliance_due_at,opened_at,employees(first_name,last_name)').eq('employer_id', eid).order('opened_at', { ascending: false }).limit(25),
    db.from('owner_document_packets').select('id,title,status,blocks_portal_access,requires_owner_signature,valid_until,updated_at').eq('owner_operator_id', c.owner.id).neq('status', 'void').order('updated_at', { ascending: false }).limit(25),
    db.from('invoices').select('id,invoice_number,status,total,amount_due,due_at,payment_url,view_url').eq('employer_id', eid).order('created_at', { ascending: false }).limit(25),
    db.from('owner_consortium_enrollments').select('id,status,dot_agency,effective_date,expiration_date').eq('owner_operator_id', c.owner.id).order('created_at', { ascending: false }),
  ]);
  for (const r of [drivers, programs, testing, cases, packets, invoices, enrollments]) if (r.error) throw r.error;
  return {
    owner: c.owner,
    subscription: c.subscription,
    entitlements: c.entitlements,
    permissions: [...c.permissions],
    drivers: drivers.data || [],
    programs: programs.data || [],
    testing: testing.data || [],
    compliance: cases.data || [],
    document_packets: packets.data || [],
    invoices: invoices.data || [],
    consortium_enrollments: enrollments.data || [],
  };
}

async function saveProfile(req: Request, c: any, b: any) {
  const x = b.profile || {};
  const patch: any = {
    legal_name: clean(x.legal_name) || c.owner.legal_name,
    dba_name: nullable(x.dba_name),
    dot_number: nullable(x.dot_number),
    mc_number: nullable(x.mc_number),
    state: nullable(x.state),
    phone: nullable(x.phone),
    email: nullable(x.email),
    timezone: clean(x.timezone) || c.owner.timezone || 'America/Chicago',
    owner_is_driver: x.owner_is_driver === undefined ? c.owner.owner_is_driver : !!x.owner_is_driver,
    vehicle_count: Math.max(0, Number(x.vehicle_count ?? c.owner.vehicle_count ?? 1) || 0),
    updated_at: now(),
  };
  const before = c.owner;
  const r = await db.from('owner_operators').update(patch).eq('id', c.owner.id).select().single();
  if (r.error) throw r.error;
  const er = await db.from('employers').update({
    legal_name: patch.legal_name, dba_name: patch.dba_name, dot_number: patch.dot_number, mc_number: patch.mc_number,
    state: patch.state, phone: patch.phone, timezone: patch.timezone, updated_at: now(),
  }).eq('id', c.owner.employer_id);
  if (er.error) throw er.error;
  await audit(req, c, 'owner.profile.update', 'owner_operator', c.owner.id, before, r.data);
  return r.data;
}

async function saveDriver(req: Request, c: any, b: any) {
  guard(c, 'employees.manage', 'employee_management');
  const x = b.driver || {};
  const id = clean(x.id);
  const eid = c.owner.employer_id;
  let before: any = null;
  if (id) {
    const q = await db.from('employees').select('*').eq('id', id).eq('employer_id', eid).is('archived_at', null).maybeSingle();
    if (q.error) throw q.error;
    if (!q.data) throw new Error('Driver not found.');
    before = q.data;
  } else {
    const limit = c.subscription?.driver_limit ?? c.subscription?.plans?.driver_limit ?? null;
    if (limit != null) {
      const count = await db.from('employees').select('id', { count: 'exact', head: true }).eq('employer_id', eid).is('archived_at', null).neq('employment_status', 'terminated');
      if (count.error) throw count.error;
      if ((count.count || 0) >= Number(limit)) throw new Error(`Your current plan supports up to ${limit} active driver record${Number(limit) === 1 ? '' : 's'}.`);
    }
  }
  const status = clean(x.employment_status || before?.employment_status || 'active');
  if (!EMPLOYEE_STATUSES.has(status)) throw new Error('Choose a valid driver status.');
  const first = clean(x.first_name || before?.first_name);
  const last = clean(x.last_name || before?.last_name);
  if (!first || !last) throw new Error('Driver first and last name are required.');
  const row: any = {
    first_name: first,
    middle_name: nullable(x.middle_name ?? before?.middle_name),
    last_name: last,
    employee_number: clean(x.employee_number ?? before?.employee_number) || before?.employee_number || `OO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    date_of_birth: nullable(x.date_of_birth ?? before?.date_of_birth),
    email: nullable(x.email ?? before?.email),
    mobile: nullable(x.mobile ?? before?.mobile),
    address_line1: nullable(x.address_line1 ?? before?.address_line1),
    address_line2: nullable(x.address_line2 ?? before?.address_line2),
    city: nullable(x.city ?? before?.city),
    state: nullable(x.state ?? before?.state),
    postal_code: nullable(x.postal_code ?? before?.postal_code),
    country: clean(x.country ?? before?.country) || 'US',
    hire_date: nullable(x.hire_date ?? before?.hire_date),
    job_title: nullable(x.job_title ?? before?.job_title) || 'Driver',
    dot_covered: x.dot_covered === undefined ? (before?.dot_covered ?? true) : !!x.dot_covered,
    dot_agency: nullable(x.dot_agency ?? before?.dot_agency) || 'FMCSA',
    cdl_number: nullable(x.cdl_number ?? before?.cdl_number),
    cdl_state: nullable(x.cdl_state ?? before?.cdl_state),
    safety_sensitive: x.safety_sensitive === undefined ? (before?.safety_sensitive ?? true) : !!x.safety_sensitive,
    employment_status: status,
    updated_at: now(),
  };
  let r: any;
  if (id) r = await db.from('employees').update(row).eq('id', id).eq('employer_id', eid).select().single();
  else r = await db.from('employees').insert({ ...row, tenant_id: c.owner.tenant_id, employer_id: eid }).select().single();
  if (r.error) throw r.error;
  await audit(req, c, id ? 'owner.driver.update' : 'owner.driver.create', 'employee', r.data.id, before, r.data);
  return r.data;
}

async function saveProgram(req: Request, c: any, b: any) {
  guard(c, 'programs.manage', 'programs');
  const x = b.program || {};
  const id = clean(x.id);
  let before: any = null;
  if (id) {
    const q = await db.from('programs').select('*').eq('id', id).eq('employer_id', c.owner.employer_id).is('archived_at', null).maybeSingle();
    if (q.error) throw q.error;
    if (!q.data) throw new Error('Program not found.');
    before = q.data;
  }
  const name = clean(x.name || before?.name);
  if (!name) throw new Error('Program name is required.');
  const programType = clean(x.program_type || before?.program_type || 'DOT');
  if (!['DOT', 'NON_DOT'].includes(programType)) throw new Error('Choose DOT or Non-DOT.');
  const status = clean(x.status || before?.status || 'active');
  if (!PROGRAM_STATUSES.has(status)) throw new Error('Choose a valid program status.');
  const row: any = {
    name,
    program_type: programType,
    regulatory_authority: nullable(x.regulatory_authority ?? before?.regulatory_authority),
    dot_agency: programType === 'DOT' ? (nullable(x.dot_agency ?? before?.dot_agency) || 'FMCSA') : null,
    testing_panel: nullable(x.testing_panel ?? before?.testing_panel),
    testing_method: nullable(x.testing_method ?? before?.testing_method),
    drug_random_rate: numOrNull(x.drug_random_rate ?? before?.drug_random_rate),
    alcohol_random_rate: numOrNull(x.alcohol_random_rate ?? before?.alcohol_random_rate),
    testing_frequency: nullable(x.testing_frequency ?? before?.testing_frequency),
    effective_date: clean(x.effective_date || before?.effective_date) || today(),
    status,
    updated_at: now(),
  };
  let r: any;
  if (id) r = await db.from('programs').update(row).eq('id', id).eq('employer_id', c.owner.employer_id).select().single();
  else r = await db.from('programs').insert({ ...row, tenant_id: c.owner.tenant_id, employer_id: c.owner.employer_id }).select().single();
  if (r.error) throw r.error;
  await audit(req, c, id ? 'owner.program.update' : 'owner.program.create', 'program', r.data.id, before, r.data);
  return r.data;
}

async function saveProgramEnrollment(req: Request, c: any, b: any) {
  guard(c, 'programs.manage', 'programs');
  const x = b.enrollment || {};
  const employeeId = clean(x.employee_id), programId = clean(x.program_id);
  if (!employeeId || !programId) throw new Error('Driver and program are required.');
  const [er, pr] = await Promise.all([
    db.from('employees').select('id').eq('id', employeeId).eq('employer_id', c.owner.employer_id).is('archived_at', null).maybeSingle(),
    db.from('programs').select('id').eq('id', programId).eq('employer_id', c.owner.employer_id).is('archived_at', null).maybeSingle(),
  ]);
  if (er.error) throw er.error; if (pr.error) throw pr.error;
  if (!er.data || !pr.data) throw new Error('Driver or program does not belong to this Owner-Operator account.');
  const existing = await db.from('employee_programs').select('*').eq('employee_id', employeeId).eq('program_id', programId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  const row: any = {
    tenant_id: c.owner.tenant_id,
    employee_id: employeeId,
    program_id: programId,
    effective_date: clean(x.effective_date || existing.data?.effective_date) || today(),
    end_date: nullable(x.end_date ?? existing.data?.end_date),
    status: clean(x.status || existing.data?.status || 'active'),
    updated_at: now(),
  };
  let r: any;
  if (existing.data) r = await db.from('employee_programs').update(row).eq('id', existing.data.id).select().single();
  else r = await db.from('employee_programs').insert({ ...row, enrolled_at: now() }).select().single();
  if (r.error) throw r.error;
  await audit(req, c, existing.data ? 'owner.program_enrollment.update' : 'owner.program_enrollment.create', 'employee_program', r.data.id, existing.data, r.data);
  return r.data;
}

async function consortium(c: any) {
  guard(c, 'pools.read', 'random_pool');
  const enroll = await db.from('owner_consortium_enrollments')
    .select('*,employees(first_name,last_name,employee_number),programs(name,program_type,dot_agency),random_pools(name,pool_type,status)')
    .eq('owner_operator_id', c.owner.id).order('created_at', { ascending: false });
  if (enroll.error) throw enroll.error;
  const poolIds = [...new Set((enroll.data || []).map((x: any) => x.pool_id).filter(Boolean))];
  const direct = await db.from('random_pools').select('*').eq('employer_id', c.owner.employer_id).is('archived_at', null).order('name');
  if (direct.error) throw direct.error;
  const directIds = (direct.data || []).map((x: any) => x.id);
  const allPoolIds = [...new Set([...poolIds, ...directIds])];
  let pools: any[] = direct.data || [], memberships: any[] = [], selections: any[] = [], selected: any[] = [];
  if (poolIds.length) {
    const other = await db.from('random_pools').select('*').in('id', poolIds).is('archived_at', null);
    if (other.error) throw other.error;
    const map = new Map(pools.map((x: any) => [x.id, x]));
    for (const x of other.data || []) map.set(x.id, x);
    pools = [...map.values()];
  }
  if (allPoolIds.length) {
    const [mr, sr] = await Promise.all([
      db.from('pool_memberships').select('*,employees!inner(id,employer_id,first_name,last_name,employee_number)').in('pool_id', allPoolIds).eq('employees.employer_id', c.owner.employer_id),
      db.from('selection_events').select('id,pool_id,selection_type,selection_date,population_size,drug_required_rate,alcohol_required_rate,drug_selection_count,alcohol_selection_count,status,locked_at').in('pool_id', allPoolIds).order('selection_date', { ascending: false }).limit(250),
    ]);
    if (mr.error) throw mr.error; if (sr.error) throw sr.error;
    memberships = mr.data || []; selections = sr.data || [];
    const selectionIds = selections.map((x: any) => x.id);
    if (selectionIds.length) {
      const sm = await db.from('selection_members').select('*,employees(first_name,last_name,employee_number),testing_orders(id,order_number,status)').in('selection_event_id', selectionIds).eq('employer_id', c.owner.employer_id).order('selected_at', { ascending: false });
      if (sm.error) throw sm.error;
      selected = sm.data || [];
    }
  }
  const certs = await db.from('owner_consortium_certificates').select('*').eq('owner_operator_id', c.owner.id).order('issued_at', { ascending: false });
  if (certs.error) throw certs.error;
  return { owner: c.owner, enrollments: enroll.data || [], pools, memberships, selections, selected_members: selected, certificates: certs.data || [] };
}

async function testing(c: any) {
  guard(c, 'testing.read', 'testing_orders');
  const [orders, drivers, programs, enrollments] = await Promise.all([
    db.from('testing_orders').select('*,employees(id,first_name,last_name,employee_number),programs(id,name,program_type,dot_agency,testing_panel,testing_method)').eq('employer_id', c.owner.employer_id).order('created_at', { ascending: false }).limit(500),
    db.from('employees').select('id,first_name,last_name,employee_number,employment_status').eq('employer_id', c.owner.employer_id).is('archived_at', null).neq('employment_status', 'terminated').order('last_name'),
    db.from('programs').select('id,name,program_type,dot_agency,testing_panel,testing_method,status').eq('employer_id', c.owner.employer_id).is('archived_at', null).eq('status', 'active').order('name'),
    db.from('employee_programs').select('id,employee_id,program_id,effective_date,end_date,status,employees!inner(employer_id)').eq('employees.employer_id', c.owner.employer_id).in('status', ['active', 'pending']),
  ]);
  for (const r of [orders, drivers, programs, enrollments]) if (r.error) throw r.error;
  return { orders: orders.data || [], drivers: drivers.data || [], programs: programs.data || [], employee_programs: enrollments.data || [], can_manage: can(c, 'testing.manage') };
}

async function validateOwnerTest(c: any, x: any, existing: any = null) {
  const employeeId = clean(x.employee_id || existing?.employee_id), programId = clean(x.program_id || existing?.program_id);
  const reason = clean(x.reason || existing?.reason), testType = clean(x.test_type || existing?.test_type);
  if (!employeeId || !programId || !reason || !testType) throw new Error('Driver, program, testing reason, and test type are required.');
  if (reason === 'random' || !TEST_REASONS.has(reason)) throw new Error('Random orders are created from a locked selection event; choose another valid reason.');
  if (!TEST_TYPES.has(testType)) throw new Error('Choose a valid test type.');
  const [er, pr] = await Promise.all([
    db.from('employees').select('*').eq('id', employeeId).eq('employer_id', c.owner.employer_id).is('archived_at', null).maybeSingle(),
    db.from('programs').select('*').eq('id', programId).eq('employer_id', c.owner.employer_id).is('archived_at', null).eq('status', 'active').maybeSingle(),
  ]);
  if (er.error) throw er.error; if (pr.error) throw pr.error;
  if (!er.data || !pr.data) throw new Error('Choose a driver and active program from this account.');
  if (er.data.employment_status === 'terminated') throw new Error('A terminated driver cannot receive a new testing order.');
  const enr = await db.from('employee_programs').select('*').eq('employee_id', employeeId).eq('program_id', programId).in('status', reason === 'pre_employment' ? ['active', 'pending'] : ['active']).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (enr.error) throw enr.error;
  if (!enr.data) throw new Error('The driver must be enrolled in this program before a testing order can be created.');
  return { employee: er.data, program: pr.data, enrollment: enr.data, employeeId, programId, reason, testType };
}

async function saveTestingOrder(req: Request, c: any, b: any) {
  guard(c, 'testing.manage', 'testing_orders');
  const x = b.test || {};
  const id = clean(x.id);
  let before: any = null;
  if (id) {
    const q = await db.from('testing_orders').select('*').eq('id', id).eq('employer_id', c.owner.employer_id).maybeSingle();
    if (q.error) throw q.error;
    if (!q.data) throw new Error('Testing order not found.');
    before = q.data;
    if (q.data.selection_member_id) throw new Error('Selection-generated testing orders are managed from the Random Selection workflow.');
    if (['laboratory', 'mro_review', 'final_result', 'closed'].includes(q.data.status)) throw new Error('Laboratory/MRO/finalized testing orders cannot be edited from the Owner-Operator portal.');
  }
  const v = await validateOwnerTest(c, x, before);
  const row: any = {
    employee_id: v.employeeId,
    program_id: v.programId,
    reason: v.reason,
    test_type: v.testType,
    program_type: v.program.program_type,
    testing_panel: nullable(x.testing_panel ?? before?.testing_panel ?? v.program.testing_panel),
    collection_type: nullable(x.collection_type ?? before?.collection_type ?? v.program.testing_method),
    collection_deadline: nullable(x.collection_deadline ?? before?.collection_deadline),
    scheduled_at: nullable(x.scheduled_at ?? before?.scheduled_at),
    updated_at: now(),
  };
  let r: any;
  if (id) r = await db.from('testing_orders').update(row).eq('id', id).eq('employer_id', c.owner.employer_id).select('*,employees(first_name,last_name),programs(name)').single();
  else r = await db.from('testing_orders').insert({
    ...row,
    tenant_id: c.owner.tenant_id,
    employer_id: c.owner.employer_id,
    pool_id: null,
    selection_member_id: null,
    order_number: `OO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    status: 'created',
    created_by: c.user.id,
  }).select('*,employees(first_name,last_name),programs(name)').single();
  if (r.error) throw r.error;
  await audit(req, c, id ? 'owner.testing_order.update' : 'owner.testing_order.create', 'testing_order', r.data.id, before, r.data);
  return r.data;
}

async function updateTestingStatus(req: Request, c: any, b: any) {
  guard(c, 'testing.manage', 'testing_orders');
  const id = clean(b.test?.id), status = clean(b.test?.status);
  if (!id || !WRITE_TEST_STATUSES.has(status)) throw new Error('Choose a valid Owner-Operator testing status.');
  const q = await db.from('testing_orders').select('*').eq('id', id).eq('employer_id', c.owner.employer_id).maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Testing order not found.');
  if (['laboratory', 'mro_review', 'final_result', 'closed'].includes(q.data.status)) throw new Error('This testing order is now provider/final-result controlled.');
  const patch: any = { status, updated_at: now() };
  const t = now();
  if (status === 'assigned' && !q.data.assigned_at) patch.assigned_at = t;
  if (status === 'employee_notified' && !q.data.notified_at) patch.notified_at = t;
  if (status === 'scheduled') patch.scheduled_at = nullable(b.test?.scheduled_at) || q.data.scheduled_at || t;
  if (status === 'collected' && !q.data.collected_at) patch.collected_at = t;
  if (['cancelled', 'refused', 'no_show', 'unable_to_collect'].includes(status) && !q.data.completed_at) patch.completed_at = t;
  const r = await db.from('testing_orders').update(patch).eq('id', id).eq('employer_id', c.owner.employer_id).select().single();
  if (r.error) throw r.error;
  await audit(req, c, `owner.testing_order.status.${status}`, 'testing_order', id, q.data, r.data);
  return r.data;
}

async function results(c: any) {
  guard(c, 'results.summary', 'results_summary');
  const r = await db.from('test_results')
    .select('id,testing_order_id,preliminary_status,mro_status,final_status,result_date,finalized_at,notification_status,created_at,testing_orders!inner(id,employer_id,order_number,reason,test_type,program_type,employees(first_name,last_name,employee_number),programs(name,dot_agency))')
    .eq('testing_orders.employer_id', c.owner.employer_id)
    .order('created_at', { ascending: false }).limit(500);
  if (r.error) throw r.error;
  return { results: r.data || [], sensitive_enabled: has(c, 'results_sensitive') };
}

async function compliance(c: any) {
  guard(c, 'compliance.read', 'compliance');
  const cases = await db.from('compliance_cases').select('*,employees(first_name,last_name,employee_number),testing_orders(order_number,reason,test_type,status)').eq('employer_id', c.owner.employer_id).order('opened_at', { ascending: false }).limit(500);
  if (cases.error) throw cases.error;
  const ids = (cases.data || []).map((x: any) => x.id);
  let tasks: any[] = [];
  if (ids.length) {
    const tr = await db.from('compliance_tasks').select('*').in('compliance_case_id', ids).order('created_at', { ascending: false });
    if (tr.error) throw tr.error;
    tasks = tr.data || [];
  }
  return { cases: cases.data || [], tasks, can_manage: can(c, 'compliance.manage') };
}

async function saveCompliance(req: Request, c: any, b: any) {
  guard(c, 'compliance.manage', 'compliance');
  const x = b.case || {}, id = clean(x.id);
  if (!id) throw new Error('Compliance case id is required.');
  const q = await db.from('compliance_cases').select('*').eq('id', id).eq('employer_id', c.owner.employer_id).maybeSingle();
  if (q.error) throw q.error;
  if (!q.data) throw new Error('Compliance case not found.');
  const status = clean(x.status || q.data.status), priority = clean(x.priority || q.data.priority);
  if (!COMPLIANCE_STATUSES.has(status) || !COMPLIANCE_PRIORITIES.has(priority)) throw new Error('Choose a valid compliance status and priority.');
  const patch: any = {
    status, priority,
    resolution: nullable(x.resolution ?? q.data.resolution),
    compliance_due_at: nullable(x.compliance_due_at ?? q.data.compliance_due_at),
    updated_at: now(),
  };
  if (['resolved', 'closed'].includes(status) && !q.data.closed_at) patch.closed_at = now();
  if (!['resolved', 'closed'].includes(status)) patch.closed_at = null;
  const r = await db.from('compliance_cases').update(patch).eq('id', id).eq('employer_id', c.owner.employer_id).select('*,employees(first_name,last_name,employee_number)').single();
  if (r.error) throw r.error;
  await audit(req, c, 'owner.compliance.update', 'compliance_case', id, q.data, r.data);
  return r.data;
}

async function rtd(c: any) {
  guard(c, 'compliance.read', 'compliance');
  const r = await db.from('sap_cases')
    .select('*,compliance_cases!inner(id,employer_id,case_number,event_type,status,employees(first_name,last_name,employee_number)),follow_up_tests(*)')
    .eq('compliance_cases.employer_id', c.owner.employer_id)
    .order('created_at', { ascending: false }).limit(250);
  if (r.error) throw r.error;
  return { cases: r.data || [] };
}

async function documents(c: any) {
  guard(c, 'documents.read', 'documents');
  const [docs, packets, certs] = await Promise.all([
    db.from('documents').select('id,document_type,file_name,mime_type,size_bytes,uploaded_at,expires_at,retention_until,legal_hold,access_level,employee_id,program_id,testing_order_id,compliance_case_id').eq('employer_id', c.owner.employer_id).is('archived_at', null).order('uploaded_at', { ascending: false }).limit(500),
    db.from('owner_document_packets').select('id,title,status,requires_owner_signature,blocks_portal_access,pushed_at,viewed_at,submitted_at,approved_at,issued_at,valid_from,valid_until,view_url,updated_at').eq('owner_operator_id', c.owner.id).neq('status', 'void').order('updated_at', { ascending: false }),
    db.from('owner_consortium_certificates').select('*').eq('owner_operator_id', c.owner.id).order('issued_at', { ascending: false }),
  ]);
  for (const r of [docs, packets, certs]) if (r.error) throw r.error;
  return { documents: docs.data || [], packets: packets.data || [], certificates: certs.data || [], can_manage: can(c, 'documents.manage') };
}

async function billing(c: any) {
  guard(c, 'billing.read');
  const ir = await db.from('invoices').select('*,invoice_items(*)').eq('employer_id', c.owner.employer_id).order('created_at', { ascending: false }).limit(250);
  if (ir.error) throw ir.error;
  return { subscription: c.subscription, invoices: ir.data || [] };
}

async function accountNotifications(c: any) {
  const queries: Promise<any>[] = [
    db.from('notifications').select('id,event_type,channel,recipient_user_id,recipient_address,related_type,related_id,subject,body,status,queued_at,sent_at,delivered_at,failure_reason,metadata').eq('tenant_id', c.owner.tenant_id).eq('recipient_user_id', c.user.id).order('queued_at', { ascending: false }).limit(100),
    db.from('notifications').select('id,event_type,channel,recipient_user_id,recipient_address,related_type,related_id,subject,body,status,queued_at,sent_at,delivered_at,failure_reason,metadata').eq('tenant_id', c.owner.tenant_id).contains('metadata', { owner_operator_id: c.owner.id }).order('queued_at', { ascending: false }).limit(100),
  ];
  if (c.owner.email) queries.push(db.from('notifications').select('id,event_type,channel,recipient_user_id,recipient_address,related_type,related_id,subject,body,status,queued_at,sent_at,delivered_at,failure_reason,metadata').eq('tenant_id', c.owner.tenant_id).ilike('recipient_address', c.owner.email).order('queued_at', { ascending: false }).limit(100));
  const rs = await Promise.all(queries);
  for (const r of rs) if (r.error) throw r.error;
  const map = new Map<string, any>();
  for (const r of rs) for (const x of r.data || []) map.set(x.id, x);
  const notifications = [...map.values()].sort((a, b) => String(b.queued_at).localeCompare(String(a.queued_at))).slice(0, 150);
  const threads = await db.from('owner_message_threads').select('*,owner_messages(*)').eq('owner_operator_id', c.owner.id).order('last_message_at', { ascending: false }).limit(100);
  if (threads.error) throw threads.error;
  return { notifications, threads: threads.data || [] };
}

async function sendOwnerMessage(req: Request, c: any, b: any) {
  const subject = clean(b.subject), body = clean(b.body);
  if (!subject || !body) throw new Error('Subject and message are required.');
  if (subject.length > 180 || body.length > 10000) throw new Error('Message is too long.');
  let thread: any = null;
  const threadId = clean(b.thread_id);
  if (threadId) {
    const tr = await db.from('owner_message_threads').select('*').eq('id', threadId).eq('owner_operator_id', c.owner.id).maybeSingle();
    if (tr.error) throw tr.error;
    if (!tr.data) throw new Error('Message thread not found.');
    thread = tr.data;
  } else {
    const tr = await db.from('owner_message_threads').insert({ tenant_id: c.owner.tenant_id, owner_operator_id: c.owner.id, subject, status: 'open', created_by: c.user.id }).select().single();
    if (tr.error) throw tr.error;
    thread = tr.data;
  }
  const mr = await db.from('owner_messages').insert({
    thread_id: thread.id, tenant_id: c.owner.tenant_id, owner_operator_id: c.owner.id,
    sender_type: 'owner', sender_user_id: c.user.id, body, read_by_owner_at: now(),
  }).select().single();
  if (mr.error) throw mr.error;
  const ur = await db.from('owner_message_threads').update({ last_message_at: now(), updated_at: now(), status: 'open' }).eq('id', thread.id);
  if (ur.error) throw ur.error;
  await audit(req, c, 'owner.message.send', 'owner_message', mr.data.id, null, { thread_id: thread.id, subject, sender_type: 'owner' });
  return { thread_id: thread.id, message: mr.data };
}

async function auditHistory(c: any) {
  guard(c, undefined, 'audit_history');
  const r = await db.from('audit_events')
    .select('id,actor_user_id,action,resource_type,resource_id,event_at,metadata')
    .eq('organization_id', c.owner.organization_id)
    .order('event_at', { ascending: false }).limit(1000);
  if (r.error) throw r.error;
  return { audit: r.data || [] };
}

async function reporting(c: any, b: any) {
  guard(c, 'reports.read', 'standard_reports');
  const start = clean(b.start_date) || `${new Date().getFullYear()}-01-01`;
  const end = clean(b.end_date) || today();
  const startIso = `${start}T00:00:00.000Z`, endIso = `${end}T23:59:59.999Z`;
  const eid = c.owner.employer_id;
  const [drivers, programs, tests, resultsR, cases, docs] = await Promise.all([
    db.from('employees').select('id', { count: 'exact' }).eq('employer_id', eid).is('archived_at', null),
    db.from('programs').select('id', { count: 'exact' }).eq('employer_id', eid).is('archived_at', null),
    db.from('testing_orders').select('id,order_number,reason,test_type,program_type,status,created_at,completed_at,employees(first_name,last_name)').eq('employer_id', eid).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }).limit(5000),
    db.from('test_results').select('id,final_status,result_date,finalized_at,testing_orders!inner(id,employer_id,order_number,reason,test_type,employees(first_name,last_name))').eq('testing_orders.employer_id', eid).gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false }).limit(5000),
    db.from('compliance_cases').select('id,case_number,event_type,priority,status,opened_at,closed_at,employees(first_name,last_name)').eq('employer_id', eid).gte('opened_at', startIso).lte('opened_at', endIso).order('opened_at', { ascending: false }).limit(5000),
    db.from('documents').select('id,document_type,file_name,uploaded_at,expires_at').eq('employer_id', eid).is('archived_at', null).gte('uploaded_at', startIso).lte('uploaded_at', endIso).order('uploaded_at', { ascending: false }).limit(5000),
  ]);
  for (const r of [drivers, programs, tests, resultsR, cases, docs]) if (r.error) throw r.error;

  const enroll = await db.from('owner_consortium_enrollments').select('pool_id').eq('owner_operator_id', c.owner.id);
  if (enroll.error) throw enroll.error;
  const poolIds = [...new Set((enroll.data || []).map((x: any) => x.pool_id).filter(Boolean))];
  let selections: any[] = [];
  if (poolIds.length && can(c, 'selections.read')) {
    const sr = await db.from('selection_events').select('id,pool_id,selection_type,selection_date,population_size,drug_selection_count,alcohol_selection_count,status').in('pool_id', poolIds).gte('selection_date', startIso).lte('selection_date', endIso).order('selection_date', { ascending: false }).limit(5000);
    if (sr.error) throw sr.error;
    selections = sr.data || [];
  }
  let audit: any[] = [];
  if (has(c, 'audit_history')) {
    const ar = await db.from('audit_events').select('id,actor_user_id,action,resource_type,resource_id,event_at').eq('organization_id', c.owner.organization_id).gte('event_at', startIso).lte('event_at', endIso).order('event_at', { ascending: false }).limit(5000);
    if (ar.error) throw ar.error;
    audit = ar.data || [];
  }
  return {
    period: { start_date: start, end_date: end },
    current: { drivers: drivers.count || 0, programs: programs.count || 0 },
    selected_period: {
      testing_orders: tests.data || [], results: resultsR.data || [], compliance_cases: cases.data || [], documents: docs.data || [], selections, audit,
    },
    advanced_enabled: has(c, 'advanced_reports'),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: H });
  if (req.method !== 'POST') return J({ error: 'Method not allowed.' }, 405);
  try {
    const c = await context(req);
    if (!c) return J({ error: 'Active Owner-Operator account and subscription required.' }, 403);
    const b = await req.json().catch(() => ({}));
    const action = clean(b.action) || 'overview';

    if (action === 'context' || action === 'entitlements') return J({ owner: c.owner, subscription: c.subscription, entitlements: c.entitlements, permissions: [...c.permissions] });
    if (action === 'overview') return J(await overview(c));
    if (action === 'profile') return J({ owner: c.owner });
    if (action === 'save_profile') return J({ success: true, owner: await saveProfile(req, c, b) });

    if (action === 'drivers' || action === 'driver') { guard(c, 'employees.read', 'employee_management'); return J({ drivers: await getDrivers(c) }); }
    if (action === 'save_driver') return J({ success: true, driver: await saveDriver(req, c, b) });

    if (action === 'programs') { guard(c, 'programs.read', 'programs'); return J({ programs: await getPrograms(c), drivers: await getDrivers(c), enrollments: await getProgramEnrollments(c) }); }
    if (action === 'save_program') return J({ success: true, program: await saveProgram(req, c, b) });
    if (action === 'save_program_enrollment') return J({ success: true, enrollment: await saveProgramEnrollment(req, c, b) });

    if (action === 'consortium' || action === 'pool') return J(await consortium(c));

    if (action === 'testing') return J(await testing(c));
    if (action === 'save_testing_order' || action === 'create_testing_order') return J({ success: true, order: await saveTestingOrder(req, c, b) });
    if (action === 'update_testing_status') return J({ success: true, order: await updateTestingStatus(req, c, b) });

    if (action === 'results') return J(await results(c));
    if (action === 'compliance') return J(await compliance(c));
    if (action === 'save_compliance') return J({ success: true, case: await saveCompliance(req, c, b) });
    if (action === 'rtd') return J(await rtd(c));
    if (action === 'documents') return J(await documents(c));
    if (action === 'billing') return J(await billing(c));
    if (action === 'notifications') return J(await accountNotifications(c));
    if (action === 'send_message') return J({ success: true, ...(await sendOwnerMessage(req, c, b)) });
    if (action === 'audit') return J(await auditHistory(c));
    if (action === 'reports') return J(await reporting(c, b));

    return J({ error: 'Unsupported Owner-Operator action.' }, 400);
  } catch (e) {
    console.error('workforce-owner-portal', e);
    const msg = e instanceof Error ? e.message : 'Owner-Operator request failed.';
    const status = /does not include|not enabled|required|choose|not found|cannot|must|supports up to/i.test(msg) ? 400 : 500;
    return J({ error: msg }, status);
  }
});
