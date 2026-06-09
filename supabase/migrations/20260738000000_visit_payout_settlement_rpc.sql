-- Visit payout settlements: create via security definer so technicians completing jobs
-- are not blocked by vendor_settlements RLS (especially when booking.technician_id is unset).

create or replace function public.create_standard_visit_payout_settlement(p_booking_id uuid)
returns public.vendor_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_existing public.vendor_settlements;
  v_fee_pct numeric;
  v_gross bigint;
  v_platform_fee bigint;
  v_net bigint;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'booking not found'; end if;
  if v_booking.status <> 'completed'::public.booking_status then
    raise exception 'booking must be completed';
  end if;
  if v_booking.vendor_id is null then
    raise exception 'booking has no vendor';
  end if;
  if v_booking.subscription_id is not null then
    raise exception 'use release_amc_wallet_visit_payout for amc bookings';
  end if;

  if not public.is_admin() then
    if v_booking.vendor_id is distinct from public.my_vendor_id()
       and v_booking.technician_id is distinct from public.my_technician_id()
       and not exists (
         select 1
         from public.job_reports jr
         where jr.booking_id = p_booking_id
           and jr.technician_id = public.my_technician_id()
       ) then
      raise exception 'not authorized';
    end if;
  end if;

  select * into v_existing from public.vendor_settlements
  where booking_id = p_booking_id and kind = 'visit_payout';
  if found then return v_existing; end if;

  v_gross := greatest(
    0,
    coalesce(
      nullif(v_booking.final_price_cents, 0),
      nullif(v_booking.estimated_price_cents, 0),
      0
    )
  );

  select coalesce(ps.vendor_platform_fee_percent, 10)::numeric into v_fee_pct
  from public.platform_settings ps where ps.id = 1;

  v_platform_fee := round(v_gross * v_fee_pct / 100.0);
  v_net := greatest(0, v_gross - v_platform_fee);

  insert into public.vendor_settlements (
    booking_id, vendor_id, kind, status, currency, reference_code,
    visit_gross_paise, platform_fee_paise, net_payout_paise, metadata
  ) values (
    v_booking.id, v_booking.vendor_id, 'visit_payout', 'pending_review',
    coalesce(v_booking.currency, 'INR'), v_booking.reference_code,
    v_gross, v_platform_fee, v_net,
    jsonb_build_object(
      'platform_fee_percent', v_fee_pct,
      'auto_created', true,
      'source', 'visit_completed'
    )
  ) returning * into v_existing;

  return v_existing;
end;
$$;

revoke all on function public.create_standard_visit_payout_settlement(uuid) from public;
grant execute on function public.create_standard_visit_payout_settlement(uuid) to authenticated;

-- Broaden technician insert policy as a fallback for any legacy client paths.
drop policy if exists vendor_settlements_insert on public.vendor_settlements;

create policy vendor_settlements_insert
on public.vendor_settlements for insert to authenticated
with check (
  public.is_admin()
  or (
    vendor_id = public.my_vendor_id()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.vendor_id = vendor_settlements.vendor_id
    )
  )
  or exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.vendor_id is not null
      and b.vendor_id = vendor_settlements.vendor_id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
  )
  or exists (
    select 1
    from public.bookings b
    join public.job_reports jr on jr.booking_id = b.id
    where b.id = booking_id
      and b.vendor_id is not null
      and b.vendor_id = vendor_settlements.vendor_id
      and jr.technician_id = public.my_technician_id()
  )
);
