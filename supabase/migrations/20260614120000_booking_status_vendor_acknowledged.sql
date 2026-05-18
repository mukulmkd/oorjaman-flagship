-- Partner accepts the job first; OorjaMan admin assigns a verified technician afterward.
-- Enum addition only - must commit before any SQL can cast to the new label (see next migration).

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on t.typnamespace = n.oid
    where n.nspname = 'public'
      and t.typname = 'booking_status'
      and e.enumlabel = 'vendor_acknowledged'
  ) then
    alter type public.booking_status add value 'vendor_acknowledged';
  end if;
end $$;
