-- Storage INSERT/UPDATE for vendor-intake calls vendor_intake_allows_storage_upload() from RLS.
-- Replace SET LOCAL row_security (unsupported when Storage evaluates policies → SQLSTATE 0A000 / 500).

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

drop policy if exists vendor_intake_update_draft on storage.objects;

create policy vendor_intake_update_draft on storage.objects for update to anon,
authenticated using (
  bucket_id = 'vendor-intake'
  and public.vendor_intake_allows_storage_upload (name)
)
with
  check (
    bucket_id = 'vendor-intake'
    and public.vendor_intake_allows_storage_upload (name)
  );
