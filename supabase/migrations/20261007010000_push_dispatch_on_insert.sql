-- Send Expo pushes when an outbox row is inserted. A 5-minute job retries rows
-- that are still queued. The dispatch secret is copied from an existing cron
-- command when one is present; this file does not contain it.

create schema if not exists internal;

revoke all on schema internal from public;
revoke all on schema internal from anon, authenticated;

create table if not exists internal.push_dispatch (
  audience text primary key check (audience in ('customer', 'technician')),
  function_url text not null,
  dispatch_secret text not null,
  updated_at timestamptz not null default now()
);

alter table internal.push_dispatch enable row level security;

revoke all on table internal.push_dispatch from public, anon, authenticated, service_role;

alter table public.customer_push_outbox
  add column if not exists claimed_at timestamptz;

alter table public.technician_push_outbox
  add column if not exists claimed_at timestamptz;

do $checks$
declare
  cname text;
  rel regclass;
  constraint_name text;
begin
  foreach rel in array array[
    'public.customer_push_outbox'::regclass,
    'public.technician_push_outbox'::regclass
  ]
  loop
    for cname in
      select c.conname
      from pg_constraint c
      where c.conrelid = rel
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) ilike '%status%'
        and pg_get_constraintdef(c.oid) ilike '%queued%'
    loop
      execute format('alter table %s drop constraint %I', rel, cname);
    end loop;
    constraint_name := regexp_replace(rel::text, '^.*\.', '') || '_status_check';
    execute format(
      'alter table %s add constraint %I check (status in (''queued'', ''sending'', ''sent'', ''failed''))',
      rel,
      constraint_name
    );
  end loop;
end
$checks$;

create or replace function public.claim_customer_push_outbox(p_id uuid default null, p_limit int default 25)
returns setof public.customer_push_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  return query
  with due as (
    select o.id
    from public.customer_push_outbox o
    where case
      when p_id is not null then o.id = p_id and (
        o.status = 'queued'
        or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes')
      )
      else (
        (o.status = 'queued' and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes')
      )
    end
    order by o.created_at
    limit v_limit
    for update skip locked
  )
  update public.customer_push_outbox o
  set status = 'sending',
      claimed_at = now()
  from due
  where o.id = due.id
  returning o.*;
end;
$$;

create or replace function public.claim_technician_push_outbox(p_id uuid default null, p_limit int default 25)
returns setof public.technician_push_outbox
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  return query
  with due as (
    select o.id
    from public.technician_push_outbox o
    where case
      when p_id is not null then o.id = p_id and (
        o.status = 'queued'
        or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes')
      )
      else (
        (o.status = 'queued' and o.next_attempt_at <= now())
        or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes')
      )
    end
    order by o.created_at
    limit v_limit
    for update skip locked
  )
  update public.technician_push_outbox o
  set status = 'sending',
      claimed_at = now()
  from due
  where o.id = due.id
  returning o.*;
end;
$$;

revoke all on function public.claim_customer_push_outbox(uuid, int) from public, anon, authenticated;
revoke all on function public.claim_technician_push_outbox(uuid, int) from public, anon, authenticated;
grant execute on function public.claim_customer_push_outbox(uuid, int) to service_role;
grant execute on function public.claim_technician_push_outbox(uuid, int) to service_role;

create or replace function public.try_dispatch_customer_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, internal, extensions
as $$
declare
  v_url text;
  v_secret text;
  request_id bigint;
begin
  select nullif(trim(function_url), ''), nullif(trim(dispatch_secret), '')
  into v_url, v_secret
  from internal.push_dispatch
  where audience = 'customer';

  if v_url is null then
    v_url := nullif(trim(current_setting('app.customer_push_function_url', true)), '');
    v_secret := nullif(trim(current_setting('app.push_dispatch_secret', true)), '');
  end if;

  if v_url is null then
    return NEW;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', v_secret
      )
    ),
    body := jsonb_build_object('outbox_id', NEW.id::text)
  )
  into request_id;

  return NEW;
exception
  when others then
    return NEW;
end;
$$;

create or replace function public.try_dispatch_technician_push_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, internal, extensions
as $$
declare
  v_url text;
  v_secret text;
  request_id bigint;
begin
  select nullif(trim(function_url), ''), nullif(trim(dispatch_secret), '')
  into v_url, v_secret
  from internal.push_dispatch
  where audience = 'technician';

  if v_url is null then
    v_url := nullif(trim(current_setting('app.technician_push_function_url', true)), '');
    v_secret := nullif(trim(current_setting('app.push_dispatch_secret', true)), '');
  end if;

  if v_url is null then
    return NEW;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', v_secret
      )
    ),
    body := jsonb_build_object('outbox_id', NEW.id::text)
  )
  into request_id;

  return NEW;
exception
  when others then
    return NEW;
end;
$$;

create or replace function public.dispatch_due_expo_pushes()
returns void
language plpgsql
security definer
set search_path = public, internal, extensions
as $$
declare
  r record;
  due boolean;
begin
  for r in
    select audience, function_url, dispatch_secret
    from internal.push_dispatch
  loop
    if r.audience = 'customer' then
      select exists (
        select 1
        from public.customer_push_outbox
        where (status = 'queued' and next_attempt_at <= now())
           or (status = 'sending' and claimed_at < now() - interval '10 minutes')
      )
      into due;
    else
      select exists (
        select 1
        from public.technician_push_outbox
        where (status = 'queued' and next_attempt_at <= now())
           or (status = 'sending' and claimed_at < now() - interval '10 minutes')
      )
      into due;
    end if;

    if not due then
      continue;
    end if;

    perform net.http_post(
      url := r.function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-dispatch-secret', r.dispatch_secret
      ),
      body := '{}'::jsonb
    );
  end loop;
end;
$$;

revoke all on function public.dispatch_due_expo_pushes() from public, anon, authenticated;

-- Copy URL and secret from the already-installed minute jobs. No-op when those jobs are absent.
insert into internal.push_dispatch (audience, function_url, dispatch_secret)
select
  case jobname
    when 'send-customer-expo-push-every-minute' then 'customer'
    else 'technician'
  end,
  (regexp_match(command, $re$https://[^'[:space:]]+/functions/v1/send-customer-expo-push|https://[^'[:space:]]+/functions/v1/send-technician-expo-push$re$))[1],
  (regexp_match(command, $re$x-push-dispatch-secret',\s*'([^']+)'$re$))[1]
from cron.job
where jobname in (
  'send-customer-expo-push-every-minute',
  'send-technician-expo-push-every-minute'
)
  and (regexp_match(command, $re$https://[^'[:space:]]+/functions/v1/send-customer-expo-push|https://[^'[:space:]]+/functions/v1/send-technician-expo-push$re$))[1] is not null
  and (regexp_match(command, $re$x-push-dispatch-secret',\s*'([^']+)'$re$))[1] is not null
on conflict (audience) do update
set function_url = excluded.function_url,
    dispatch_secret = excluded.dispatch_secret,
    updated_at = now();

do $jobs$
declare
  r record;
begin
  if exists (
    select 1 from internal.push_dispatch
    where audience = 'customer' and function_url like 'https://%'
  ) then
    for r in
      select jobid from cron.job where jobname = 'send-customer-expo-push-every-minute'
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;

  if exists (
    select 1 from internal.push_dispatch
    where audience = 'technician' and function_url like 'https://%'
  ) then
    for r in
      select jobid from cron.job where jobname = 'send-technician-expo-push-every-minute'
    loop
      perform cron.unschedule(r.jobid);
    end loop;
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'dispatch-due-expo-pushes'
  ) then
    perform cron.schedule(
      'dispatch-due-expo-pushes',
      '*/5 * * * *',
      $cmd$select public.dispatch_due_expo_pushes();$cmd$
    );
  end if;
end
$jobs$;
