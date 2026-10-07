-- Let the push functions accept the secret stored in internal.push_dispatch.
-- Hosted projects cannot ALTER DATABASE to publish that secret, and the
-- value copied from the old cron did not match the Edge Function env secret.

create or replace function public.push_dispatch_secret_ok(p_audience text, p_secret text)
returns boolean
language sql
stable
security definer
set search_path = internal, public
as $$
  select exists (
    select 1
    from internal.push_dispatch d
    where d.audience = p_audience
      and p_secret is not null
      and length(btrim(p_secret)) > 0
      and d.dispatch_secret = p_secret
  );
$$;

comment on function public.push_dispatch_secret_ok(text, text) is
  'True when the dispatch header matches the private secret for that audience. Does not return the secret.';

revoke all on function public.push_dispatch_secret_ok(text, text) from public, anon, authenticated;
grant execute on function public.push_dispatch_secret_ok(text, text) to service_role;
