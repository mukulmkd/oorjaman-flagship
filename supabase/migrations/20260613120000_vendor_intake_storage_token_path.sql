-- Fix vendor-intake uploads still blocked by RLS:
-- 1) Path must include draft secret: {intake_id}/{draft_access_token}/{filename...}
-- 2) Helper checks id + draft_access_token + draft (no reliance on anon seeing intake rows).
-- 3) Table owner bypasses RLS unless FORCE ROW LEVEL SECURITY - disable FORCE on this table.
-- 4) REVOKE anon/PUBLIC direct table access (RPCs remain SECURITY DEFINER).
-- 5) Function owner postgres (superuser on Supabase - bypasses RLS when evaluating EXISTS).

create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p text;
  seg1 text;
  seg2 text;
  iid uuid;
  tok uuid;
begin
  p := trim(both '/' from coalesce(object_path, ''));
  seg1 := split_part(p, '/', 1);
  seg2 := split_part(p, '/', 2);
  if seg1 = '' or seg2 = '' then
    return false;
  end if;
  begin
    iid := seg1::uuid;
    tok := seg2::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  return exists (
    select
      1
    from
      public.vendor_registration_intake v
    where
      v.id = iid
      and v.draft_access_token = tok
      and v.status = 'draft'::public.vendor_registration_intake_status
  );
end;
$$;

alter table public.vendor_registration_intake no force row level security;

alter function public.vendor_intake_allows_storage_upload (text) owner to postgres;

-- anon must not SELECT intake rows via PostgREST; RPCs use SECURITY DEFINER.
revoke all on public.vendor_registration_intake from public;

revoke all on public.vendor_registration_intake from anon;

grant select on public.vendor_registration_intake to authenticated;

grant all on public.vendor_registration_intake to service_role;
