-- Put live tables back on supabase_realtime, schedule the 1-hour vendor fallback,
-- and stop the minute push crons from calling Edge Functions when the outbox is empty.

do $pub$
declare
  t text;
begin
  foreach t in array array[
    'bookings',
    'subscriptions',
    'vendor_settlements',
    'support_messages',
    'support_conversations',
    'notification_events',
    'customer_site_activity_events',
    'technician_activity_events'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise exception 'missing table public.%', t;
    end if;
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$pub$;

do $cron$
begin
  if to_regprocedure('public.notify_overdue_vendor_responses_batch(int)') is null then
    raise exception 'notify_overdue_vendor_responses_batch(int) is missing';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'notify-overdue-vendor-responses'
  ) then
    perform cron.schedule(
      'notify-overdue-vendor-responses',
      '*/5 * * * *',
      $cmd$select public.notify_overdue_vendor_responses_batch(200);$cmd$
    );
  end if;
end
$cron$;

-- Rewrite an existing select net.http_post(...) command so it runs only when a row is due.
-- The dispatch secret stays in the job; this migration does not store it.
do $gate$
declare
  r record;
  inner_sql text;
  outbox text;
  gated text;
begin
  for r in
    select jobid, jobname, command
    from cron.job
    where jobname in (
      'send-customer-expo-push-every-minute',
      'send-technician-expo-push-every-minute'
    )
  loop
    if r.command ~* 'push_outbox' then
      continue;
    end if;
    if r.command !~* 'net\.http_post' then
      continue;
    end if;

    inner_sql := regexp_replace(btrim(r.command), '^\s*select\s+', '', 'i');
    inner_sql := regexp_replace(inner_sql, ';\s*$', '');

    outbox := case r.jobname
      when 'send-customer-expo-push-every-minute' then 'customer_push_outbox'
      else 'technician_push_outbox'
    end;

    gated := format(
      $fmt$do $body$
begin
  if exists (
    select 1
    from public.%I
    where status = 'queued'
      and next_attempt_at <= now()
  ) then
    perform %s;
  end if;
end
$body$;$fmt$,
      outbox,
      inner_sql
    );

    perform cron.alter_job(job_id := r.jobid, command := gated);
  end loop;
end
$gate$;

delete from cron.job_run_details
where status = 'succeeded'
  and start_time < now() - interval '1 day'
  and jobid in (
    select jobid
    from cron.job
    where jobname in (
      'send-customer-expo-push-every-minute',
      'send-technician-expo-push-every-minute'
    )
  );
