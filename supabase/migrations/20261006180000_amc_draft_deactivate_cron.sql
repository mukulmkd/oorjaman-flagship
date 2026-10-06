-- Close unpaid AMC drafts after 14 days without waiting for someone to open the app.
-- Runs daily at 00:30 IST (19:00 UTC).

create or replace function public.deactivate_stale_amc_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.subscriptions
  set
    status = 'expired'::public.subscription_status,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'amc_phase', 'draft_inactive',
      'contract_started', false,
      'draft_deactivated_at', now(),
      'draft_deactivated_reason', 'unpaid_14_days'
    ),
    updated_at = now()
  where status = 'trialing'::public.subscription_status
    and created_at < now() - interval '14 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.deactivate_stale_amc_drafts() is
  'Marks unpaid AMC drafts older than 14 days as expired and keeps the row.';

revoke all on function public.deactivate_stale_amc_drafts() from public;
revoke all on function public.deactivate_stale_amc_drafts() from anon, authenticated;
grant execute on function public.deactivate_stale_amc_drafts() to service_role;

create extension if not exists pg_cron with schema pg_catalog;

do $cron$
declare
  job_id bigint;
begin
  for job_id in
    select jobid from cron.job where jobname = 'deactivate-stale-amc-drafts'
  loop
    perform cron.unschedule(job_id);
  end loop;

  perform cron.schedule(
    'deactivate-stale-amc-drafts',
    '0 19 * * *',
    $cmd$select public.deactivate_stale_amc_drafts();$cmd$
  );
exception
  when others then
    raise notice 'pg_cron schedule skipped for deactivate-stale-amc-drafts: %', sqlerrm;
end;
$cron$;
