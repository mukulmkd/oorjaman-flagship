-- On vendor approval: platform-verify technician and assign OorjaMan employee code (OMT-…).
-- Fixes RLS-safe trigger reads and backfills rows approved before this migration.

create or replace function public.generate_technician_employee_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  code text;
  tries int := 0;
begin
  loop
    tries := tries + 1;
    if tries > 24 then
      raise exception 'could not allocate technician employee_code';
    end if;
    code := 'OMT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1 from public.technicians t where t.employee_code = code
    );
  end loop;
  return code;
end;
$$;

grant execute on function public.generate_technician_employee_code() to authenticated;

create or replace function public.technicians_finalize_vendor_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.vendor_review_status = 'approved'
     and coalesce(old.vendor_review_status, 'pending') <> 'approved'
     and public.is_approved_vendor_user()
     and new.vendor_id is not null
     and new.vendor_id = public.my_vendor_id() then
    new.verification_status := 'verified'::public.technician_verification_status;
    new.is_verified := true;
    new.verification_reviewed_at := coalesce(new.verification_reviewed_at, now());
    new.verification_rejection_reason := null;
    if new.employee_code is null or trim(new.employee_code) = '' then
      new.employee_code := public.generate_technician_employee_code();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists technicians_finalize_vendor_approval on public.technicians;
create trigger technicians_finalize_vendor_approval
before update on public.technicians
for each row execute function public.technicians_finalize_vendor_approval();

create or replace function public.technicians_guard_vendor_review_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.vendor_review_status is distinct from old.vendor_review_status
     or new.vendor_reviewed_at is distinct from old.vendor_reviewed_at
     or new.vendor_rejection_reason is distinct from old.vendor_rejection_reason then
    if public.is_admin() then
      return new;
    end if;
    if public.is_approved_vendor_user()
       and new.vendor_id is not null
       and new.vendor_id = public.my_vendor_id() then
      return new;
    end if;
    raise exception 'Not allowed to change vendor review fields';
  end if;
  return new;
end;
$$;

drop trigger if exists technicians_guard_vendor_review_writes on public.technicians;
create trigger technicians_guard_vendor_review_writes
before update on public.technicians
for each row execute function public.technicians_guard_vendor_review_writes();

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
  if old.verification_status = 'draft'::public.technician_verification_status
     and new.verification_status = 'pending_review'::public.technician_verification_status then
    return new;
  end if;
  if coalesce(old.vendor_review_status, 'pending') <> 'approved'
     and new.vendor_review_status = 'approved'
     and public.is_approved_vendor_user()
     and new.vendor_id is not null
     and new.vendor_id = public.my_vendor_id() then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.is_verified is distinct from old.is_verified
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Not allowed to change verification fields';
  end if;
  if new.employee_code is distinct from old.employee_code then
    raise exception 'Not allowed to change employee_code';
  end if;
  return new;
end;
$$;

-- Backfill (migration role has no auth.uid(); bypass row guards for this one-shot repair).
alter table public.technicians disable trigger technicians_guard_verification_writes;

do $$
declare
  r record;
begin
  for r in
    select t.id
    from public.technicians t
    where t.vendor_review_status = 'approved'
      and (
        t.verification_status is distinct from 'verified'::public.technician_verification_status
        or t.is_verified is distinct from true
        or t.employee_code is null
        or trim(t.employee_code) = ''
      )
  loop
    update public.technicians t
    set
      verification_status = 'verified'::public.technician_verification_status,
      is_verified = true,
      verification_reviewed_at = coalesce(
        t.verification_reviewed_at,
        t.vendor_reviewed_at,
        now()
      ),
      verification_rejection_reason = null,
      employee_code = coalesce(
        nullif(trim(t.employee_code), ''),
        public.generate_technician_employee_code()
      ),
      updated_at = now()
    where t.id = r.id;
  end loop;
end;
$$;

alter table public.technicians enable trigger technicians_guard_verification_writes;

alter table public.technicians drop column if exists employer_registration_ref;
alter table public.technicians drop column if exists certifications;
