-- UAT/dev: finalize seeded technician test accounts (service_role only).

create or replace function public.seed_finalize_test_technician(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.technicians t where t.user_id = p_user_id) then
    raise exception 'technician not found for user %', p_user_id;
  end if;

  alter table public.technicians disable trigger technicians_guard_vendor_review_writes;
  alter table public.technicians disable trigger technicians_guard_verification_writes;
  alter table public.technicians disable trigger technicians_finalize_vendor_approval;

  update public.technicians t
  set
    vendor_review_status = 'approved',
    vendor_reviewed_at = coalesce(t.vendor_reviewed_at, now()),
    vendor_rejection_reason = null,
    verification_status = 'verified'::public.technician_verification_status,
    is_verified = true,
    verification_reviewed_at = coalesce(t.verification_reviewed_at, now()),
    verification_rejection_reason = null,
    employee_code = coalesce(
      nullif(trim(t.employee_code), ''),
      public.generate_technician_employee_code()
    ),
    updated_at = now()
  where t.user_id = p_user_id;

  alter table public.technicians enable trigger technicians_finalize_vendor_approval;
  alter table public.technicians enable trigger technicians_guard_verification_writes;
  alter table public.technicians enable trigger technicians_guard_vendor_review_writes;
end;
$$;

revoke all on function public.seed_finalize_test_technician(uuid) from public;
grant execute on function public.seed_finalize_test_technician(uuid) to service_role;
