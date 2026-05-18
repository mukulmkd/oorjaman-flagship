-- Admin/vendor fallback readiness workflow: vendor must confirm after ops nudge.
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'awaiting_confirmation'
  ) then
    alter type public.booking_status add value 'awaiting_confirmation';
  end if;
end $$;
