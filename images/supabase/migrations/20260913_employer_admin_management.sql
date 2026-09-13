-- Employer Admin management foundation.
-- Apply to the workforce project before enabling the corresponding mutation actions.

create table if not exists public.employer_support_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  employer_id uuid not null references public.employers(id) on delete cascade,
  document_version text not null,
  scope text not null check (scope in ('support_only','account_management','full_delegated')),
  status text not null default 'requested' check (status in ('requested','granted','denied','revoked','expired')),
  reason text,
  requested_by uuid references auth.users(id),
  requested_at timestamptz not null default now(),
  signer_user_id uuid references auth.users(id),
  signer_name text,
  signed_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists employer_support_consents_employer_idx on public.employer_support_consents(employer_id,created_at desc);

create table if not exists public.employer_order_defaults (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  employer_id uuid not null references public.employers(id) on delete cascade,
  field_name text not null,
  field_value text not null,
  show boolean not null default true,
  make_default boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(employer_id,field_name,field_value)
);

create table if not exists public.employer_testing_preferences (
  employer_id uuid primary key references public.employers(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  require_mro_negative boolean not null default false,
  require_mro_nonnegative boolean not null default true,
  require_lab_confirmation boolean not null default true,
  require_mro_confirmation boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.employer_service_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  employer_id uuid not null references public.employers(id) on delete cascade,
  service_code text not null,
  service_name text not null,
  orderable boolean not null default false,
  is_default boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(employer_id,service_code)
);

create table if not exists public.employer_lab_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  employer_id uuid not null references public.employers(id) on delete cascade,
  laboratory_id uuid references public.laboratories(id),
  account_code text not null,
  status text not null default 'active',
  hide_on_order boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique(employer_id,account_code)
);

alter table public.employer_support_consents enable row level security;
alter table public.employer_order_defaults enable row level security;
alter table public.employer_testing_preferences enable row level security;
alter table public.employer_service_settings enable row level security;
alter table public.employer_lab_accounts enable row level security;

-- Customer-side policies should scope by authenticated organization membership.
-- Platform Admin mutations should continue through verified Edge Functions and audit_events.
