-- AMC ops alerts: subscriptions realtime for customer app + push when partner is assigned.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'subscriptions'
  ) then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end $$;

create or replace function public.enqueue_customer_amc_partner_assigned_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_vendor_name text;
  v_title text;
  v_body text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if old.assigned_vendor_id is not null or new.assigned_vendor_id is null then
    return new;
  end if;

  if new.status <> 'active'::public.subscription_status then
    return new;
  end if;

  select c.user_id
    into v_user_id
    from public.customers c
    where c.id = new.customer_id;

  if v_user_id is null then
    return new;
  end if;

  select coalesce(nullif(trim(v.trade_name), ''), nullif(trim(v.business_name), ''), 'your dedicated partner')
    into v_vendor_name
    from public.vendors v
    where v.id = new.assigned_vendor_id;

  v_title := 'OorjaMan - AMC partner assigned';
  v_body := v_vendor_name || ' is assigned to ' || coalesce(nullif(trim(new.plan_name), ''), 'your AMC plan')
    || '. Open the app to schedule your included visits.';

  insert into public.customer_push_outbox (
    user_id,
    customer_id,
    conversation_id,
    message_id,
    event_type,
    title,
    body,
    data
  )
  values (
    v_user_id,
    new.customer_id,
    null,
    null,
    'amc_partner_assigned',
    v_title,
    v_body,
    jsonb_build_object(
      'kind', 'amc_partner_assigned',
      'subscriptionId', new.id,
      'serviceAddressId', new.service_address_id,
      'vendorId', new.assigned_vendor_id
    )
  );

  return new;
end;
$$;

drop trigger if exists subscriptions_enqueue_amc_partner_assigned_push on public.subscriptions;

create trigger subscriptions_enqueue_amc_partner_assigned_push
after update of assigned_vendor_id on public.subscriptions
for each row execute function public.enqueue_customer_amc_partner_assigned_push();
