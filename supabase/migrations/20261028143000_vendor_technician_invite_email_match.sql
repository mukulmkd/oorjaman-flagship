-- Allow technicians to see/open invites by matching invite_email as well as phone.
-- Production Partner login is email OTP; invites were phone-only under RLS and API.

update public.vendor_technician_invites
set invite_email = lower(trim(invite_email))
where invite_email is not null
  and invite_email <> lower(trim(invite_email));

create index if not exists vendor_technician_invites_email_lower_idx
  on public.vendor_technician_invites (lower(invite_email))
  where invite_email is not null;

drop policy if exists vendor_technician_invites_select_scope on public.vendor_technician_invites;
create policy vendor_technician_invites_select_scope
  on public.vendor_technician_invites
  as permissive
  for select
  to authenticated
  using (
    is_admin()
    or (is_approved_vendor_user() and vendor_id = my_vendor_id())
    or (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and (
            (
              u.phone is not null
              and u.phone = vendor_technician_invites.invite_phone_e164
            )
            or (
              u.email is not null
              and vendor_technician_invites.invite_email is not null
              and lower(u.email) = lower(vendor_technician_invites.invite_email)
            )
          )
      )
    )
  );

drop policy if exists vendor_technician_invites_update_scope on public.vendor_technician_invites;
create policy vendor_technician_invites_update_scope
  on public.vendor_technician_invites
  as permissive
  for update
  to authenticated
  using (
    is_admin()
    or (is_approved_vendor_user() and vendor_id = my_vendor_id())
    or (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and (
            (
              u.phone is not null
              and u.phone = vendor_technician_invites.invite_phone_e164
            )
            or (
              u.email is not null
              and vendor_technician_invites.invite_email is not null
              and lower(u.email) = lower(vendor_technician_invites.invite_email)
            )
          )
      )
    )
  )
  with check (
    is_admin()
    or (is_approved_vendor_user() and vendor_id = my_vendor_id())
    or (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and (
            (
              u.phone is not null
              and u.phone = vendor_technician_invites.invite_phone_e164
            )
            or (
              u.email is not null
              and vendor_technician_invites.invite_email is not null
              and lower(u.email) = lower(vendor_technician_invites.invite_email)
            )
          )
      )
    )
  );
