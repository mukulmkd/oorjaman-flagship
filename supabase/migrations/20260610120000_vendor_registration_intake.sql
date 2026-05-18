-- Vendor registration intake: anonymous multi-step form; admin approves via Edge Function (creates auth user + vendors row).

do $enum$
begin
  create type public.vendor_registration_intake_status as enum (
    'draft',
    'submitted',
    'approved',
    'rejected'
  );
exception
  when duplicate_object then null;
end $enum$;

create table if not exists public.vendor_registration_intake (
  id uuid primary key default gen_random_uuid (),
  status public.vendor_registration_intake_status not null default 'draft',
  draft_access_token uuid not null default gen_random_uuid (),
  form_data jsonb not null default '{}'::jsonb,
  step_index integer not null default 0,
  business_name text,
  contact_email text,
  contact_phone text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.users (id) on delete set null,
  rejection_reason text,
  created_user_id uuid references public.users (id) on delete set null,
  created_vendor_id uuid references public.vendors (id) on delete set null,
  created_at timestamptz not null default now (),
  updated_at timestamptz not null default now (),
  constraint vendor_registration_intake_rejection_when_rejected check (
    status <> 'rejected'
    or (
      rejection_reason is not null
      and btrim (rejection_reason) <> ''
    )
  ),
  constraint vendor_registration_intake_approved_links check (
    status <> 'approved'
    or (
      created_user_id is not null
      and created_vendor_id is not null
      and reviewed_at is not null
      and approved_at is not null
    )
  )
);

create unique index if not exists vendor_registration_intake_draft_token_idx
  on public.vendor_registration_intake (draft_access_token);

create index if not exists vendor_registration_intake_status_idx
  on public.vendor_registration_intake (status);

create index if not exists vendor_registration_intake_submitted_at_idx
  on public.vendor_registration_intake (submitted_at desc);

drop trigger if exists vendor_registration_intake_set_updated_at on public.vendor_registration_intake;

create trigger vendor_registration_intake_set_updated_at
before update on public.vendor_registration_intake
for each row execute function public.set_updated_at ();

alter table public.vendor_registration_intake enable row level security;

drop policy if exists vendor_registration_intake_admin_all on public.vendor_registration_intake;

create policy vendor_registration_intake_admin_all on public.vendor_registration_intake for all to authenticated using (public.is_admin ())
with
  check (public.is_admin ());

-- -----------------------------------------------------------------------------
-- RPCs (anon + authenticated): create / read / update draft / submit - no direct anon DML
-- -----------------------------------------------------------------------------

create or replace function public.create_vendor_registration_intake (p_initial_form jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid ();
  v_token uuid := gen_random_uuid ();
  v_business text;
  v_email text;
  v_phone text;
begin
  v_business := left(
    trim(
      coalesce(
        p_initial_form ->> 'business_name',
        p_initial_form ->> 'partner_login_email',
        'Draft partner application'
      )
    ),
    200
  );
  v_email := nullif(
    trim(
      coalesce(
        p_initial_form ->> 'partner_login_email',
        p_initial_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );
  v_phone := nullif(
    trim(coalesce(p_initial_form ->> 'partner_login_phone_e164', p_initial_form ->> 'partner_login_phone', '')),
    ''
  );

  insert into public.vendor_registration_intake (
    id,
    status,
    form_data,
    draft_access_token,
    business_name,
    contact_email,
    contact_phone,
    step_index
  )
  values (
    v_id,
    'draft',
    coalesce(p_initial_form, '{}'::jsonb),
    v_token,
    v_business,
    v_email,
    v_phone,
    0
  );

  return jsonb_build_object('id', v_id, 'draft_token', v_token);
end;
$$;

create or replace function public.get_vendor_registration_intake (p_id uuid, p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select form_data, step_index, status
    into r
  from public.vendor_registration_intake
  where
    id = p_id
    and draft_access_token = p_token;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'form_data',
    r.form_data,
    'step_index',
    r.step_index,
    'status',
    r.status
  );
end;
$$;

create or replace function public.update_vendor_registration_intake (
  p_id uuid,
  p_token uuid,
  p_form jsonb,
  p_step_index integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business text;
  v_email text;
  v_phone text;
begin
  v_business := left(
    trim(
      coalesce(
        p_form ->> 'business_name',
        p_form ->> 'partner_login_email',
        'Draft partner application'
      )
    ),
    200
  );
  v_email := nullif(
    trim(
      coalesce(
        p_form ->> 'partner_login_email',
        p_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );
  v_phone := nullif(
    trim(coalesce(p_form ->> 'partner_login_phone_e164', p_form ->> 'partner_login_phone', '')),
    ''
  );

  update public.vendor_registration_intake
  set
    form_data = coalesce(p_form, '{}'::jsonb),
    step_index = greatest (0, coalesce(p_step_index, 0)),
    business_name = v_business,
    contact_email = v_email,
    contact_phone = v_phone
  where
    id = p_id
    and draft_access_token = p_token
    and status = 'draft';

  if not found then
    raise exception 'Invalid intake, wrong token, or intake is not editable';
  end if;
end;
$$;

create or replace function public.submit_vendor_registration_intake (p_id uuid, p_token uuid, p_form jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
  v_business text;
begin
  v_email := nullif(
    trim(
      coalesce(
        p_form ->> 'partner_login_email',
        p_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );
  v_phone := nullif(
    trim(coalesce(p_form ->> 'partner_login_phone_e164', p_form ->> 'partner_login_phone', '')),
    ''
  );
  v_business := left(trim(coalesce(p_form ->> 'business_name', '')), 200);

  if v_business is null or v_business = '' then
    raise exception 'business_name is required';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'partner_login_email is required';
  end if;

  if v_phone is null or v_phone = '' then
    raise exception 'partner_login_phone is required';
  end if;

  update public.vendor_registration_intake
  set
    form_data = coalesce(p_form, '{}'::jsonb),
    step_index = greatest (0, step_index),
    business_name = v_business,
    contact_email = v_email,
    contact_phone = v_phone,
    status = 'submitted',
    submitted_at = now ()
  where
    id = p_id
    and draft_access_token = p_token
    and status = 'draft';

  if not found then
    raise exception 'Invalid intake, wrong token, or already submitted';
  end if;
end;
$$;

grant execute on function public.create_vendor_registration_intake (jsonb) to anon,
authenticated;

grant execute on function public.get_vendor_registration_intake (uuid, uuid) to anon,
authenticated;

grant execute on function public.update_vendor_registration_intake (uuid, uuid, jsonb, integer) to anon,
authenticated;

grant execute on function public.submit_vendor_registration_intake (uuid, uuid, jsonb) to anon,
authenticated;

-- Used by Storage RLS. SECURITY DEFINER + owner postgres so SELECT bypasses RLS on vendor_registration_intake.
-- Do not use SET row_security here - Storage evaluates policies in a context where SET LOCAL fails (SQLSTATE 0A000).
create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text;
  iid uuid;
begin
  seg := split_part(trim(both '/' from coalesce(object_path, '')), '/', 1);
  if seg = '' then
    return false;
  end if;
  begin
    iid := seg::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select
      1
    from
      public.vendor_registration_intake v
    where
      v.id = iid
      and v.status = 'draft'::public.vendor_registration_intake_status
  );
end;
$$;

-- Same owner as vendor_registration_intake so SELECT in this SECURITY DEFINER function bypasses RLS (owner bypass).
do $owner$
declare
  tbl_owner name;
begin
  select pg_catalog.pg_get_userbyid (c.relowner)::name
    into tbl_owner
  from
    pg_class c
    join pg_namespace n on n.oid = c.relnamespace
  where
    n.nspname = 'public'
    and c.relname = 'vendor_registration_intake'
    and c.relkind = 'r';

  if tbl_owner is not null then
    execute format(
      'alter function public.vendor_intake_allows_storage_upload(text) owner to %I',
      tbl_owner
    );
  end if;
end
$owner$;

grant execute on function public.vendor_intake_allows_storage_upload (text) to anon,
authenticated;

-- -----------------------------------------------------------------------------
-- Storage: vendor-intake - uploads before auth; first path segment = intake id
-- -----------------------------------------------------------------------------

insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vendor-intake',
    'vendor-intake',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vendor_intake_select_admin on storage.objects;

drop policy if exists vendor_intake_insert_draft on storage.objects;

drop policy if exists vendor_intake_update_draft on storage.objects;

create policy vendor_intake_select_admin on storage.objects for
select
  to authenticated using (
    bucket_id = 'vendor-intake'
    and public.is_admin ()
  );

create policy vendor_intake_insert_draft on storage.objects for insert to anon,
authenticated
with
  check (
    bucket_id = 'vendor-intake'
    and public.vendor_intake_allows_storage_upload (name)
  );

-- Upsert uploads may UPDATE an existing object path.
create policy vendor_intake_update_draft on storage.objects for update to anon,
authenticated using (
  bucket_id = 'vendor-intake'
  and public.vendor_intake_allows_storage_upload (name)
)
with
  check (
    bucket_id = 'vendor-intake'
    and public.vendor_intake_allows_storage_upload (name)
  );
