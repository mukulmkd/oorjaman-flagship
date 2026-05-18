-- Allow in-progress technician registration ("save & complete later") without appearing as submitted for review.

alter type public.technician_verification_status add value if not exists 'draft';

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
  if new.verification_status = 'draft'::public.technician_verification_status then
    return new;
  end if;
  new.verification_status := 'pending_review'::public.technician_verification_status;
  return new;
end;
$$;

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
  if new.verification_status is distinct from old.verification_status
     or new.is_verified is distinct from old.is_verified
     or new.verification_reviewed_at is distinct from old.verification_reviewed_at
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    raise exception 'Not allowed to change verification fields';
  end if;
  return new;
end;
$$;
