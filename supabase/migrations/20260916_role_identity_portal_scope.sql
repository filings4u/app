alter table public.roles add column if not exists portal_code text;
alter table public.roles add column if not exists principal_type text;
alter table public.roles add column if not exists expected_organization_type text;
alter table public.roles add column if not exists is_internal_staff boolean not null default false;

update public.roles set portal_code='admin',principal_type='internal_admin',expected_organization_type='platform',is_internal_staff=true where code='platform_admin';
update public.roles set portal_code='employer',principal_type='customer_admin',expected_organization_type='employer' where code='employer_admin';
update public.roles set portal_code='employer',principal_type='customer_staff',expected_organization_type='employer' where code in ('der','supervisor','hr_admin');
update public.roles set portal_code='employee',principal_type='employee',expected_organization_type='employer' where code='employee';
update public.roles set portal_code='ctpa',principal_type='customer_admin',expected_organization_type='ctpa' where code='ctpa_admin';
update public.roles set portal_code='ctpa',principal_type='customer_staff',expected_organization_type='ctpa' where code='ctpa_staff';
update public.roles set portal_code='owner_operator',principal_type='customer_admin',expected_organization_type='owner_operator' where code='owner_operator_admin';
update public.roles set portal_code='owner_operator',principal_type='customer_staff',expected_organization_type='owner_operator' where code='owner_operator_staff';
update public.roles set portal_code='provider',principal_type='provider',expected_organization_type=null where code in ('collector','laboratory','mro','sap');

alter table public.roles drop constraint if exists roles_portal_code_check;
alter table public.roles add constraint roles_portal_code_check check (portal_code is null or portal_code in ('admin','employer','employee','ctpa','owner_operator','provider'));
alter table public.roles drop constraint if exists roles_principal_type_check;
alter table public.roles add constraint roles_principal_type_check check (principal_type is null or principal_type in ('internal_admin','internal_staff','customer_admin','customer_staff','employee','provider'));
alter table public.roles drop constraint if exists roles_expected_organization_type_check;
alter table public.roles add constraint roles_expected_organization_type_check check (expected_organization_type is null or expected_organization_type in ('platform','employer','ctpa','owner_operator'));

create or replace function public.enforce_membership_role_scope() returns trigger language plpgsql set search_path = public as $$
declare v_expected text; v_actual text; v_role text;
begin
  select expected_organization_type,code into v_expected,v_role from public.roles where id=new.role_id;
  select organization_type::text into v_actual from public.organizations where id=new.organization_id;
  if v_expected is not null and v_actual is distinct from v_expected then
    raise exception 'Role % requires organization type %, received %',v_role,v_expected,v_actual;
  end if;
  return new;
end;$$;
drop trigger if exists trg_enforce_membership_role_scope on public.organization_memberships;
create trigger trg_enforce_membership_role_scope before insert or update of role_id,organization_id on public.organization_memberships for each row execute function public.enforce_membership_role_scope();
