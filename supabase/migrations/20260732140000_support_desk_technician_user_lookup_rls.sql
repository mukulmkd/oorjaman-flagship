-- Support desk: read technician app login rows for search (mirrors customer accounts policy).

drop policy if exists users_select_support_technician_accounts on public.users;

create policy users_select_support_technician_accounts
on public.users for select to authenticated
using (
  public.is_support_desk_user()
  and role = 'technician'::public.user_role
);
