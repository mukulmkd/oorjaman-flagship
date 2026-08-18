-- =============================================================================
-- Edge Function rate limiting (durable, cross-isolate).
--
-- Edge Function isolates are ephemeral; an in-memory Map alone is not enough.
-- This table + SECURITY DEFINER RPC let every function share the same bucket
-- counters via the service role. Clients (anon / authenticated) cannot call it.
--
-- Bucket key convention (set by edge helpers):
--   edge:<functionName>:<subject>
-- where subject is typically "user:<uuid>" or "ip:<addr>" or "dispatch".
-- =============================================================================

create table if not exists public.edge_rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0
    check (request_count >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.edge_rate_limit_buckets is
  'Sliding fixed-window counters for Supabase Edge Function rate limiting. Written only via consume_edge_rate_limit().';

alter table public.edge_rate_limit_buckets enable row level security;

revoke all on public.edge_rate_limit_buckets from anon, authenticated;
grant all on public.edge_rate_limit_buckets to service_role;

-- No policies for anon/authenticated — table is service_role only.

create or replace function public.consume_edge_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_max int;
  v_window int;
  v_now timestamptz := now();
  v_started timestamptz;
  v_count int;
  v_remaining int;
  v_retry int;
begin
  v_key := nullif(trim(p_bucket_key), '');
  if v_key is null then
    raise exception 'bucket_key required';
  end if;

  v_max := greatest(1, coalesce(p_max_requests, 60));
  v_window := greatest(1, coalesce(p_window_seconds, 60));

  insert into public.edge_rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
  values (v_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
  set
    window_started_at = case
      when public.edge_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => v_window)
        then v_now
      else public.edge_rate_limit_buckets.window_started_at
    end,
    request_count = case
      when public.edge_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => v_window)
        then 1
      else public.edge_rate_limit_buckets.request_count + 1
    end,
    updated_at = v_now
  returning window_started_at, request_count
  into v_started, v_count;

  if v_count > v_max then
    v_retry := greatest(
      1,
      ceil(extract(epoch from (v_started + make_interval(secs => v_window) - v_now)))::int
    );
    return jsonb_build_object(
      'allowed', false,
      'limit', v_max,
      'remaining', 0,
      'retry_after_seconds', v_retry,
      'window_seconds', v_window
    );
  end if;

  v_remaining := greatest(0, v_max - v_count);
  return jsonb_build_object(
    'allowed', true,
    'limit', v_max,
    'remaining', v_remaining,
    'retry_after_seconds', 0,
    'window_seconds', v_window
  );
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to service_role;

comment on function public.consume_edge_rate_limit(text, integer, integer) is
  'Atomically consume one request from a fixed-window rate bucket. Service role only. Returns {allowed, limit, remaining, retry_after_seconds, window_seconds}.';

-- Opportunistic cleanup of stale buckets (older than 24h). Safe to call from edge or cron.
create or replace function public.cleanup_edge_rate_limit_buckets(
  p_older_than_hours integer default 24
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  delete from public.edge_rate_limit_buckets
  where updated_at < now() - make_interval(hours => greatest(1, coalesce(p_older_than_hours, 24)));
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_edge_rate_limit_buckets(integer) from public, anon, authenticated;
grant execute on function public.cleanup_edge_rate_limit_buckets(integer) to service_role;
