-- State desks approve, reject, and manage vendors in their assigned states.
-- National admin policies stay in place.

create or replace function public.vendor_in_my_operation(p_vendor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and p_vendor_id is not null
    and exists (
      select 1
      from public.vendors v
      where v.id = p_vendor_id
        and (
          exists (
            select 1
            from unnest(coalesce(v.operating_regions, '{}'::text[])) as region
            where public.state_in_my_operation(region)
          )
          or public.state_in_my_operation(v.registered_address ->> 'state')
        )
    );
$$;

create or replace function public.intake_in_my_operation(p_form jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_state_ops()
    and (
      exists (
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(coalesce(p_form, '{}'::jsonb) -> 'operating_regions') = 'array'
              then p_form -> 'operating_regions'
            else '[]'::jsonb
          end
        ) as region
        where public.state_in_my_operation(region)
      )
      or exists (
        select 1
        from regexp_split_to_table(coalesce(p_form ->> 'operating_regions_text', ''), '[,;\n]+') as part
        where public.state_in_my_operation(part)
      )
      or public.state_in_my_operation(p_form -> 'registered_address' ->> 'state')
    );
$$;

revoke all on function public.vendor_in_my_operation(uuid) from public;
revoke all on function public.intake_in_my_operation(jsonb) from public;
grant execute on function public.vendor_in_my_operation(uuid) to authenticated;
grant execute on function public.intake_in_my_operation(jsonb) to authenticated;

drop policy if exists vendor_registration_intake_select_state_ops on public.vendor_registration_intake;
create policy vendor_registration_intake_select_state_ops
on public.vendor_registration_intake for select to authenticated
using (public.intake_in_my_operation(form_data));

drop policy if exists vendor_registration_intake_update_state_ops on public.vendor_registration_intake;
create policy vendor_registration_intake_update_state_ops
on public.vendor_registration_intake for update to authenticated
using (public.intake_in_my_operation(form_data))
with check (public.intake_in_my_operation(form_data));

drop policy if exists vendors_update_state_ops on public.vendors;
create policy vendors_update_state_ops
on public.vendors for update to authenticated
using (public.vendor_in_my_operation(id))
with check (public.vendor_in_my_operation(id));

drop policy if exists users_update_vendor_state_ops on public.users;
create policy users_update_vendor_state_ops
on public.users for update to authenticated
using (
  exists (
    select 1
    from public.vendors v
    where v.user_id = users.id
      and public.vendor_in_my_operation(v.id)
  )
)
with check (
  role = 'vendor'::public.user_role
  and exists (
    select 1
    from public.vendors v
    where v.user_id = users.id
      and public.vendor_in_my_operation(v.id)
  )
);

create or replace function public.prevent_unprivileged_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;
  if auth.role() = 'service_role' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  -- A state desk may turn the login for a vendor in its states into a vendor login.
  if public.is_state_ops()
     and new.role = 'vendor'::public.user_role
     and old.role in ('customer'::public.user_role, 'vendor'::public.user_role)
     and exists (
       select 1
       from public.vendors v
       where v.user_id = new.id
         and public.vendor_in_my_operation(v.id)
     )
  then
    return new;
  end if;
  raise exception 'Only a national admin can change a user role';
end;
$$;

drop policy if exists vendor_intake_select_state_ops on storage.objects;
create policy vendor_intake_select_state_ops
on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-intake'
  and exists (
    select 1
    from public.vendor_registration_intake i
    where i.id::text = split_part(name, '/', 1)
      and public.intake_in_my_operation(i.form_data)
  )
);

drop policy if exists vendor_documents_select_state_ops on storage.objects;
create policy vendor_documents_select_state_ops
on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-documents'
  and exists (
    select 1
    from public.vendors v
    where v.user_id::text = split_part(name, '/', 1)
      and public.vendor_in_my_operation(v.id)
  )
);

-- New auth users need a public.users row before a vendor record can be created.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
