-- Partner self-delete runs as the service role and must clear is_verified.
-- Authenticated technicians still cannot change verification fields.

create or replace function public.technicians_guard_verification_writes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
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
