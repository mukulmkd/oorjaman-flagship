-- Vendor registration fields + private document storage (apply after base schema & policies).
-- Safe to re-run: uses IF NOT EXISTS where supported.

alter table public.vendors add column if not exists company_type text;
alter table public.vendors add column if not exists company_registration_number text;
alter table public.vendors add column if not exists website_url text;
alter table public.vendors add column if not exists contact_person_name text;
alter table public.vendors add column if not exists contact_person_role text;
alter table public.vendors add column if not exists contact_person_phone text;
alter table public.vendors add column if not exists contact_person_email text;
alter table public.vendors add column if not exists service_areas text[];
alter table public.vendors add column if not exists experience_summary text;
alter table public.vendors add column if not exists years_in_business numeric(6, 1);
alter table public.vendors add column if not exists equipment_available text[];
alter table public.vendors add column if not exists flag_safety_training boolean not null default false;
alter table public.vendors add column if not exists flag_ppe_available boolean not null default false;
alter table public.vendors add column if not exists flag_insurance_coverage boolean not null default false;
alter table public.vendors add column if not exists doc_pan_url text;
alter table public.vendors add column if not exists doc_aadhaar_url text;
alter table public.vendors add column if not exists doc_gst_url text;
alter table public.vendors add column if not exists doc_bank_proof_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-documents',
  'vendor-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vendor_documents_select_scope on storage.objects;
drop policy if exists vendor_documents_insert_own on storage.objects;
drop policy if exists vendor_documents_update_own on storage.objects;
drop policy if exists vendor_documents_delete_own on storage.objects;

create policy vendor_documents_select_scope
on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

create policy vendor_documents_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy vendor_documents_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy vendor_documents_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Prevent vendors from editing approval/review columns (except rejected → pending resubmit).
create or replace function public.vendors_guard_approval_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if old.approval_status = 'rejected'::public.vendor_approval_status
     and new.approval_status = 'pending'::public.vendor_approval_status then
    new.reviewed_at := null;
    new.approved_at := null;
    new.approved_by := null;
    new.rejection_reason := null;
    return new;
  end if;
  if new.approval_status is distinct from old.approval_status
     or new.reviewed_at is distinct from old.reviewed_at
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Not allowed to change approval or review fields';
  end if;
  return new;
end;
$$;

drop trigger if exists vendors_guard_approval_writes on public.vendors;
create trigger vendors_guard_approval_writes
before update on public.vendors
for each row execute function public.vendors_guard_approval_writes();
