-- Singleton routing defaults (e.g. platform-wide fallback vendor when customer preferred cannot serve location).
create table if not exists public.platform_settings (
  id smallint primary key default 1 check (id = 1),
  default_vendor_id uuid references public.vendors (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users (id) on delete set null
);

insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

drop trigger if exists platform_settings_set_updated_at on public.platform_settings;
create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select_authenticated on public.platform_settings;
create policy platform_settings_select_authenticated
on public.platform_settings for select to authenticated
using (true);

drop policy if exists platform_settings_update_admin on public.platform_settings;
create policy platform_settings_update_admin
on public.platform_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

comment on table public.platform_settings is 'Singleton (id=1). default_vendor_id used when customer preferred vendor cannot serve the site.';
