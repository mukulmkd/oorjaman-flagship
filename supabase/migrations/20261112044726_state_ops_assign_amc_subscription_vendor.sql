-- State desks may assign (or reassign) the dedicated AMC partner for subscriptions
-- whose service site is in their operation. National admins stay unrestricted.
-- UI already calls this RPC; only the admin-only guard blocked state_ops.

create or replace function public.admin_assign_amc_subscription_vendor(
  p_subscription_id uuid,
  p_vendor_id uuid,
  p_reassign_open_bookings boolean default true
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub public.subscriptions;
  v_vendor public.vendors;
  v_site_state text;
  v_actor text;
begin
  if public.is_admin() then
    v_actor := 'admin';
  elsif public.is_state_ops() then
    v_actor := 'state_ops';
  else
    raise exception 'admin or state_ops only';
  end if;

  select * into v_vendor from public.vendors where id = p_vendor_id;
  if not found then raise exception 'vendor not found'; end if;
  if v_vendor.approval_status <> 'approved'::public.vendor_approval_status then
    raise exception 'vendor must be approved';
  end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'subscription not found'; end if;

  if v_actor = 'state_ops' then
    v_site_state := nullif(trim(v_sub.metadata -> 'service_site_address' ->> 'state'), '');
    if not public.state_in_my_operation(v_site_state) then
      raise exception 'subscription site is outside your state desk';
    end if;
    if not public.vendor_in_my_operation(p_vendor_id) then
      raise exception 'partner is outside your state desk';
    end if;
  end if;

  update public.subscriptions
  set
    assigned_vendor_id = p_vendor_id,
    assigned_vendor_at = now(),
    updated_at = now()
  where id = p_subscription_id
  returning * into v_sub;

  update public.amc_wallets
  set assigned_vendor_id = p_vendor_id, updated_at = now()
  where subscription_id = p_subscription_id;

  if p_reassign_open_bookings then
    update public.bookings b
    set
      vendor_id = p_vendor_id,
      technician_id = null,
      status = case
        when b.status = 'accepted'::public.booking_status then 'confirmed'::public.booking_status
        else b.status
      end,
      metadata = coalesce(b.metadata, '{}'::jsonb) || jsonb_build_object(
        'amc_vendor_reassignment', jsonb_build_object(
          'previous_vendor_id', b.vendor_id,
          'reassigned_at', now(),
          'reassigned_by', v_actor,
          'scope', 'subscription',
          'subscription_id', p_subscription_id
        ),
        'vendor_reassignment', coalesce(b.metadata->'vendor_reassignment', '{}'::jsonb) || jsonb_build_object(
          'awaiting_admin_assignment', false,
          'reassigned_at', now(),
          'reassigned_vendor_id', p_vendor_id,
          'previous_vendor_id', b.vendor_id
        ),
        'vendor_response', jsonb_build_object('anchor_at', now())
      ),
      updated_at = now()
    where b.subscription_id = p_subscription_id
      and b.status in (
        'confirmed'::public.booking_status,
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status
      )
      and b.vendor_id is distinct from p_vendor_id;
  end if;

  return v_sub;
end;
$$;

revoke all on function public.admin_assign_amc_subscription_vendor(uuid, uuid, boolean) from public;
grant execute on function public.admin_assign_amc_subscription_vendor(uuid, uuid, boolean) to authenticated;
