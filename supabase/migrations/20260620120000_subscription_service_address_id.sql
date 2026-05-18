-- AMC subscriptions are scoped to a saved service address (address book entry id).

alter table public.subscriptions
  add column if not exists service_address_id text;

comment on column public.subscriptions.service_address_id is
  'Id of customers.metadata.service_addresses[].id; at most one active/trialing AMC per customer per address.';

-- Backfill legacy rows: default book entry, then "default" synthetic id.
update public.subscriptions s
set service_address_id = coalesce(
  (
    select nullif(trim(c.metadata->>'default_service_address_id'), '')
    from public.customers c
    where c.id = s.customer_id
  ),
  'default'
)
where s.service_address_id is null;

update public.subscriptions s
set metadata = coalesce(s.metadata, '{}'::jsonb) || jsonb_build_object('service_address_id', s.service_address_id)
where s.service_address_id is not null
  and (s.metadata->>'service_address_id') is null;

create index if not exists subscriptions_service_address_id_idx
  on public.subscriptions (customer_id, service_address_id);

create unique index if not exists subscriptions_one_active_amc_per_address_idx
  on public.subscriptions (customer_id, service_address_id)
  where status in ('trialing'::public.subscription_status, 'active'::public.subscription_status)
    and service_address_id is not null
    and service_address_id <> '';
