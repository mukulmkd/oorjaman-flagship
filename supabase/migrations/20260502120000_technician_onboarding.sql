-- Technician onboarding: profile fields, verification workflow, private document storage.

do $$ begin
  create type public.technician_verification_status as enum (
    'pending_review',
    'verified',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.technicians add column if not exists verification_status public.technician_verification_status;
alter table public.technicians add column if not exists verification_submitted_at timestamptz;
alter table public.technicians add column if not exists verification_reviewed_at timestamptz;
alter table public.technicians add column if not exists verification_rejection_reason text;
alter table public.technicians add column if not exists date_of_birth date;
alter table public.technicians add column if not exists personal_phone text;
alter table public.technicians add column if not exists emergency_contact_name text;
alter table public.technicians add column if not exists emergency_contact_phone text;
alter table public.technicians add column if not exists aadhaar_last4 text;
alter table public.technicians add column if not exists pan_number text;
alter table public.technicians add column if not exists doc_aadhaar_url text;
alter table public.technicians add column if not exists doc_pan_url text;
alter table public.technicians add column if not exists experience_summary text;
alter table public.technicians add column if not exists years_experience numeric(6, 1);
alter table public.technicians add column if not exists flag_safety_training boolean not null default false;
alter table public.technicians add column if not exists flag_height_work_cert boolean not null default false;
alter table public.technicians add column if not exists bank_account_holder_name text;
alter table public.technicians add column if not exists bank_account_last4 text;
alter table public.technicians add column if not exists bank_ifsc text;
alter table public.technicians add column if not exists doc_bank_proof_url text;
alter table public.technicians add column if not exists preferred_work_locations text[];

update public.technicians
set verification_status = 'verified'::public.technician_verification_status
where verification_status is null and coalesce(is_verified, false) = true;

update public.technicians
set verification_status = 'pending_review'::public.technician_verification_status
where verification_status is null;

update public.technicians
set verification_submitted_at = created_at
where verification_submitted_at is null;

alter table public.technicians
  alter column verification_status set default 'pending_review'::public.technician_verification_status;
alter table public.technicians
  alter column verification_status set not null;

create index if not exists technicians_verification_status_idx on public.technicians (verification_status);

create or replace function public.technicians_normalize_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.is_verified := false;
  new.verification_status := 'pending_review'::public.technician_verification_status;
  return new;
end;
$$;

drop trigger if exists technicians_normalize_insert on public.technicians;
create trigger technicians_normalize_insert
before insert on public.technicians
for each row execute function public.technicians_normalize_insert();

create or replace function public.technicians_guard_verification_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if old.verification_status = 'rejected'::public.technician_verification_status
     and new.verification_status = 'pending_review'::public.technician_verification_status then
    new.verification_rejection_reason := null;
    new.verification_reviewed_at := null;
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.is_verified is distinct from old.is_verified
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Not allowed to change verification fields';
  end if;
  return new;
end;
$$;

drop trigger if exists technicians_guard_verification_writes on public.technicians;
create trigger technicians_guard_verification_writes
before update on public.technicians
for each row execute function public.technicians_guard_verification_writes();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technician-documents',
  'technician-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists technician_documents_select_scope on storage.objects;
drop policy if exists technician_documents_insert_own on storage.objects;
drop policy if exists technician_documents_update_own on storage.objects;
drop policy if exists technician_documents_delete_own on storage.objects;

create policy technician_documents_select_scope
on storage.objects for select to authenticated
using (
  bucket_id = 'technician-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.technicians t
      join public.vendors v on v.id = t.vendor_id
      where split_part(storage.objects.name, '/', 1) = t.user_id::text
        and v.user_id = auth.uid()
    )
  )
);

create policy technician_documents_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy technician_documents_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy technician_documents_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);
