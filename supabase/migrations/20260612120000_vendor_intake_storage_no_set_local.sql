-- SET LOCAL row_security inside vendor_intake_allows_storage_upload caused SQLSTATE 0A000 (feature not
-- supported) when Supabase Storage evaluated the policy. Remove it; keep SECURITY DEFINER + match table owner.

create or replace function public.vendor_intake_allows_storage_upload (object_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  seg text;
  iid uuid;
begin
  seg := split_part(trim(both '/' from coalesce(object_path, '')), '/', 1);
  if seg = '' then
    return false;
  end if;
  begin
    iid := seg::uuid;
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
      and v.status = 'draft'::public.vendor_registration_intake_status
  );
end;
$$;

do $owner$
declare
  tbl_owner name;
begin
  select pg_catalog.pg_get_userbyid (c.relowner)::name
    into tbl_owner
  from
    pg_class c
    join pg_namespace n on n.oid = c.relnamespace
  where
    n.nspname = 'public'
    and c.relname = 'vendor_registration_intake'
    and c.relkind = 'r';

  if tbl_owner is not null then
    execute format(
      'alter function public.vendor_intake_allows_storage_upload(text) owner to %I',
      tbl_owner
    );
  end if;
end
$owner$;
