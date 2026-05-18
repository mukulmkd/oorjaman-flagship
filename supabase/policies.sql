-- =============================================================================
-- Row Level Security - OorjaManDB (apply AFTER schema.sql)
-- =============================================================================
-- Idempotent (safe to re-run): policies are DROP POLICY IF EXISTS then CREATE;
-- helper functions use CREATE OR REPLACE; GRANT is repeatable; enabling RLS on a
-- table that already has RLS enabled is a no-op; storage buckets use INSERT ...
-- ON CONFLICT DO UPDATE.
-- Rules:
-- - Customers: own profile/subscriptions/bookings only (via customer extension row).
-- - Approved vendors: own vendor row + bookings for their vendor_id (+ linked technicians/customers
--   per policy). Pending / non-approved vendor accounts cannot use operational dashboard data (no
--   bookings or team list via vendor scope).
-- - Technicians: own technician row + bookings jobs assigned to them.
-- - Admin (users.role = 'admin'): full access to all tables below.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER reads bypass RLS on public.users safely by PK)
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'::public.user_role
  );
$$;

create or replace function public.my_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.customers c
  where c.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.my_vendor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id
  from public.vendors v
  where v.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.my_technician_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.id
  from public.technicians t
  where t.user_id = auth.uid()
  limit 1;
$$;

-- True when the current user owns a vendors row with approval_status = approved (operational vendor).
create or replace function public.is_approved_vendor_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select v.approval_status = 'approved'::public.vendor_approval_status
      from public.vendors v
      where v.user_id = auth.uid()
      limit 1
    ),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_customer_id() to authenticated;
grant execute on function public.my_vendor_id() to authenticated;
grant execute on function public.my_technician_id() to authenticated;
grant execute on function public.is_approved_vendor_user() to authenticated;

-- -----------------------------------------------------------------------------
-- Enable RLS
-- -----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.technicians enable row level security;
alter table public.subscriptions enable row level security;
alter table public.bookings enable row level security;
alter table public.job_reports enable row level security;
alter table public.platform_settings enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.pricing_tiers enable row level security;
alter table public.pricing_city_tiers enable row level security;
alter table public.payments enable row level security;
alter table public.technician_locations enable row level security;
alter table public.vendor_technician_invites enable row level security;
alter table public.vendor_slot_availability enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notification_channel_settings enable row level security;

-- -----------------------------------------------------------------------------
-- Drop existing policies (idempotent apply)
-- -----------------------------------------------------------------------------

drop policy if exists users_select_self_or_admin on public.users;
drop policy if exists users_update_self_or_admin on public.users;
drop policy if exists users_insert_admin on public.users;

drop policy if exists customers_select_scope on public.customers;
drop policy if exists customers_insert_self_or_admin on public.customers;
drop policy if exists customers_update_self_or_admin on public.customers;
drop policy if exists customers_delete_admin on public.customers;

drop policy if exists vendors_select_scope on public.vendors;
drop policy if exists vendors_insert_self_or_admin on public.vendors;
drop policy if exists vendors_update_self_or_admin on public.vendors;
drop policy if exists vendors_delete_admin on public.vendors;

drop policy if exists technicians_select_scope on public.technicians;
drop policy if exists technicians_select_for_partner_bookings on public.technicians;
drop policy if exists technicians_insert_self_or_admin on public.technicians;
drop policy if exists technicians_update_scope on public.technicians;
drop policy if exists technicians_delete_scope on public.technicians;
drop policy if exists vendor_technician_invites_select_scope on public.vendor_technician_invites;
drop policy if exists vendor_technician_invites_insert_vendor on public.vendor_technician_invites;
drop policy if exists vendor_technician_invites_update_scope on public.vendor_technician_invites;
drop policy if exists vendor_technician_invites_delete_vendor on public.vendor_technician_invites;
drop policy if exists vendor_slot_availability_select_scope on public.vendor_slot_availability;
drop policy if exists vendor_slot_availability_insert_scope on public.vendor_slot_availability;
drop policy if exists vendor_slot_availability_update_scope on public.vendor_slot_availability;
drop policy if exists vendor_slot_availability_delete_scope on public.vendor_slot_availability;
drop policy if exists notification_events_select_scope on public.notification_events;
drop policy if exists notification_events_insert_authenticated on public.notification_events;
drop policy if exists notification_events_update_admin on public.notification_events;
drop policy if exists notification_templates_select_authenticated on public.notification_templates;
drop policy if exists notification_templates_insert_admin on public.notification_templates;
drop policy if exists notification_templates_update_admin on public.notification_templates;
drop policy if exists notification_templates_delete_admin on public.notification_templates;
drop policy if exists notification_channel_settings_select_admin on public.notification_channel_settings;
drop policy if exists notification_channel_settings_insert_admin on public.notification_channel_settings;
drop policy if exists notification_channel_settings_update_admin on public.notification_channel_settings;
drop policy if exists notification_channel_settings_delete_admin on public.notification_channel_settings;

drop policy if exists subscriptions_select_customer_or_admin on public.subscriptions;
drop policy if exists subscriptions_insert_customer_or_admin on public.subscriptions;
drop policy if exists subscriptions_update_customer_or_admin on public.subscriptions;
drop policy if exists subscriptions_delete_admin on public.subscriptions;

drop policy if exists bookings_select_customer on public.bookings;
drop policy if exists bookings_select_vendor on public.bookings;
drop policy if exists bookings_select_technician on public.bookings;
drop policy if exists bookings_select_admin on public.bookings;

drop policy if exists bookings_insert_customer on public.bookings;
drop policy if exists bookings_insert_vendor on public.bookings;
drop policy if exists bookings_insert_admin on public.bookings;

drop policy if exists bookings_update_customer on public.bookings;
drop policy if exists bookings_update_vendor on public.bookings;
drop policy if exists bookings_update_technician on public.bookings;
drop policy if exists bookings_update_admin on public.bookings;

drop policy if exists bookings_delete_admin on public.bookings;

drop policy if exists job_reports_select_via_booking on public.job_reports;
drop policy if exists job_reports_insert_technician_or_admin on public.job_reports;
drop policy if exists job_reports_update_via_booking on public.job_reports;
drop policy if exists job_reports_delete_admin on public.job_reports;

drop policy if exists platform_settings_select_authenticated on public.platform_settings;
drop policy if exists platform_settings_update_admin on public.platform_settings;

drop policy if exists pricing_rules_select_authenticated on public.pricing_rules;
drop policy if exists pricing_rules_insert_admin on public.pricing_rules;
drop policy if exists pricing_rules_update_admin on public.pricing_rules;
drop policy if exists pricing_rules_delete_admin on public.pricing_rules;

drop policy if exists pricing_tiers_select_authenticated on public.pricing_tiers;
drop policy if exists pricing_tiers_insert_admin on public.pricing_tiers;
drop policy if exists pricing_tiers_update_admin on public.pricing_tiers;
drop policy if exists pricing_tiers_delete_admin on public.pricing_tiers;

drop policy if exists pricing_city_tiers_select_authenticated on public.pricing_city_tiers;
drop policy if exists pricing_city_tiers_insert_admin on public.pricing_city_tiers;
drop policy if exists pricing_city_tiers_update_admin on public.pricing_city_tiers;
drop policy if exists pricing_city_tiers_delete_admin on public.pricing_city_tiers;

drop policy if exists payments_select_own on public.payments;
drop policy if exists payments_insert_own on public.payments;
drop policy if exists payments_update_own on public.payments;

drop policy if exists technician_locations_select_own on public.technician_locations;
drop policy if exists technician_locations_select_vendor_team on public.technician_locations;
drop policy if exists technician_locations_select_admin on public.technician_locations;
drop policy if exists technician_locations_insert_own on public.technician_locations;
drop policy if exists technician_locations_select_customer_booking on public.technician_locations;

-- =============================================================================
-- public.users
-- =============================================================================

create policy users_select_self_or_admin
on public.users for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy users_update_self_or_admin
on public.users for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Manual inserts are uncommon (signup trigger inserts); admins may repair rows.
create policy users_insert_admin
on public.users for insert to authenticated
with check (public.is_admin());

-- =============================================================================
-- public.customers
-- =============================================================================

create policy customers_select_scope
on public.customers for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.bookings b
      where b.customer_id = customers.id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
);

create policy customers_insert_self_or_admin
on public.customers for insert to authenticated
with check (
  public.is_admin()
  or user_id = auth.uid()
);

create policy customers_update_self_or_admin
on public.customers for update to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

create policy customers_delete_admin
on public.customers for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.vendors
-- =============================================================================

create policy vendors_select_scope
on public.vendors for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.technicians t
    where t.vendor_id = vendors.id
      and t.user_id = auth.uid()
  )
  or (
    vendors.approval_status = 'approved'::public.vendor_approval_status
    and exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'customer'::public.user_role
    )
  )
);

create policy vendors_insert_self_or_admin
on public.vendors for insert to authenticated
with check (
  public.is_admin()
  or user_id = auth.uid()
);

create policy vendors_update_self_or_admin
on public.vendors for update to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

create policy vendors_delete_admin
on public.vendors for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.technicians
-- =============================================================================

create policy technicians_select_scope
on public.technicians for select to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

-- Oorjaman crew assigned to this partner's bookings (technicians are not owned by vendors).
create policy technicians_select_for_partner_bookings
on public.technicians for select to authenticated
using (
  public.is_approved_vendor_user()
  and public.my_vendor_id() is not null
  and exists (
    select 1
    from public.bookings b
    where b.technician_id = technicians.id
      and b.vendor_id = public.my_vendor_id()
  )
);

create policy technicians_insert_self_or_admin
on public.technicians for insert to authenticated
with check (
  public.is_admin()
  or user_id = auth.uid()
);

create policy technicians_update_scope
on public.technicians for update to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
)
with check (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

create policy technicians_delete_scope
on public.technicians for delete to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

-- =============================================================================
-- public.vendor_technician_invites
-- =============================================================================

create policy vendor_technician_invites_select_scope
on public.vendor_technician_invites for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
  or (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.phone is not null
        and u.phone = vendor_technician_invites.invite_phone_e164
    )
  )
);

create policy vendor_technician_invites_insert_vendor
on public.vendor_technician_invites for insert to authenticated
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
    and invited_by_user_id = auth.uid()
  )
);

create policy vendor_technician_invites_update_scope
on public.vendor_technician_invites for update to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
  or (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.phone is not null
        and u.phone = vendor_technician_invites.invite_phone_e164
    )
  )
)
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
  or (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.phone is not null
        and u.phone = vendor_technician_invites.invite_phone_e164
    )
  )
);

create policy vendor_technician_invites_delete_vendor
on public.vendor_technician_invites for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

-- =============================================================================
-- public.vendor_slot_availability
-- =============================================================================

create policy vendor_slot_availability_select_scope
on public.vendor_slot_availability for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

create policy vendor_slot_availability_insert_scope
on public.vendor_slot_availability for insert to authenticated
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

create policy vendor_slot_availability_update_scope
on public.vendor_slot_availability for update to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
)
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

create policy vendor_slot_availability_delete_scope
on public.vendor_slot_availability for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

-- =============================================================================
-- public.notification_events
-- =============================================================================

create policy notification_events_select_scope
on public.notification_events for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and recipient_vendor_id is not null
    and recipient_vendor_id = public.my_vendor_id()
  )
);

create policy notification_events_insert_authenticated
on public.notification_events for insert to authenticated
with check (true);

create policy notification_events_update_admin
on public.notification_events for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =============================================================================
-- public.notification_templates
-- =============================================================================

create policy notification_templates_select_authenticated
on public.notification_templates for select to authenticated
using (public.is_admin());

create policy notification_templates_insert_admin
on public.notification_templates for insert to authenticated
with check (public.is_admin());

create policy notification_templates_update_admin
on public.notification_templates for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy notification_templates_delete_admin
on public.notification_templates for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.notification_channel_settings
-- =============================================================================

create policy notification_channel_settings_select_admin
on public.notification_channel_settings for select to authenticated
using (public.is_admin());

create policy notification_channel_settings_insert_admin
on public.notification_channel_settings for insert to authenticated
with check (public.is_admin());

create policy notification_channel_settings_update_admin
on public.notification_channel_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy notification_channel_settings_delete_admin
on public.notification_channel_settings for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.technician_locations - technician inserts own rows; vendor/admin read
-- =============================================================================

create policy technician_locations_select_own
on public.technician_locations for select to authenticated
using (technician_id = public.my_technician_id());

create policy technician_locations_select_vendor_team
on public.technician_locations for select to authenticated
using (
  public.is_approved_vendor_user()
  and exists (
    select 1
    from public.technicians t
    where t.id = technician_locations.technician_id
      and t.vendor_id is not null
      and t.vendor_id = public.my_vendor_id()
  )
);

create policy technician_locations_select_admin
on public.technician_locations for select to authenticated
using (public.is_admin());

create policy technician_locations_insert_own
on public.technician_locations for insert to authenticated
with check (technician_id = public.my_technician_id());

create policy technician_locations_select_customer_booking
on public.technician_locations for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.customer_id = public.my_customer_id()
      and b.technician_id is not null
      and b.technician_id = technician_locations.technician_id
  )
);

-- =============================================================================
-- public.subscriptions (AMC)
-- =============================================================================

create policy subscriptions_select_customer_or_admin
on public.subscriptions for select to authenticated
using (
  public.is_admin()
  or customer_id = public.my_customer_id()
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.bookings b
      where b.customer_id = subscriptions.customer_id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
);

create policy subscriptions_insert_customer_or_admin
on public.subscriptions for insert to authenticated
with check (
  public.is_admin()
  or customer_id = public.my_customer_id()
);

create policy subscriptions_update_customer_or_admin
on public.subscriptions for update to authenticated
using (public.is_admin() or customer_id = public.my_customer_id())
with check (public.is_admin() or customer_id = public.my_customer_id());

create policy subscriptions_delete_admin
on public.subscriptions for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.bookings - core visibility rules
-- =============================================================================

create policy bookings_select_customer
on public.bookings for select to authenticated
using (customer_id = public.my_customer_id());

create policy bookings_select_vendor
on public.bookings for select to authenticated
using (
  public.is_approved_vendor_user()
  and (
    (vendor_id is not null and vendor_id = public.my_vendor_id())
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","floated":true}}'::jsonb
    )
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","vendor_cancelled_reassign":true}}'::jsonb
      and coalesce(metadata->'vendor_reassignment'->>'previous_vendor_id', '') = public.my_vendor_id()::text
    )
  )
);

create policy bookings_select_technician
on public.bookings for select to authenticated
using (
  technician_id is not null
  and technician_id = public.my_technician_id()
);

create policy bookings_select_admin
on public.bookings for select to authenticated
using (public.is_admin());

create policy bookings_insert_customer
on public.bookings for insert to authenticated
with check (
  customer_id = public.my_customer_id()
);

create policy bookings_insert_vendor
on public.bookings for insert to authenticated
with check (
  public.is_approved_vendor_user()
  and vendor_id = public.my_vendor_id()
);

create policy bookings_insert_admin
on public.bookings for insert to authenticated
with check (public.is_admin());

create policy bookings_update_customer
on public.bookings for update to authenticated
using (customer_id = public.my_customer_id())
with check (customer_id = public.my_customer_id());

create policy bookings_update_vendor
on public.bookings for update to authenticated
using (
  public.is_approved_vendor_user()
  and (
    (vendor_id is not null and vendor_id = public.my_vendor_id())
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","floated":true}}'::jsonb
    )
  )
)
with check (
  public.is_approved_vendor_user()
  and (
    (vendor_id is not null and vendor_id = public.my_vendor_id())
    or (
      vendor_id is null
      and status = 'confirmed'::public.booking_status
      and metadata @> '{"marketplace":{"mode":"default_vendor","awaiting_admin_assignment":true}}'::jsonb
      and metadata @> '{"vendor_reassignment":{"awaiting_admin_assignment":true}}'::jsonb
    )
  )
);

create policy bookings_update_technician
on public.bookings for update to authenticated
using (
  technician_id is not null
  and technician_id = public.my_technician_id()
)
with check (
  technician_id is not null
  and technician_id = public.my_technician_id()
);

create policy bookings_update_admin
on public.bookings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy bookings_delete_admin
on public.bookings for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.job_reports - inherit visibility from parent booking + write rules
-- =============================================================================

create policy job_reports_select_via_booking
on public.job_reports for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = job_reports.booking_id
      and (
        public.is_admin()
        or b.customer_id = public.my_customer_id()
        or (
          public.is_approved_vendor_user()
          and b.vendor_id is not null
          and b.vendor_id = public.my_vendor_id()
        )
        or (
          b.technician_id is not null
          and b.technician_id = public.my_technician_id()
        )
      )
  )
);

create policy job_reports_insert_technician_or_admin
on public.job_reports for insert to authenticated
with check (
  public.is_admin()
  or (
    technician_id = public.my_technician_id()
    and exists (
      select 1
      from public.bookings bk
      where bk.id = booking_id
        and bk.technician_id = public.my_technician_id()
    )
  )
);

create policy job_reports_update_via_booking
on public.job_reports for update to authenticated
using (
  public.is_admin()
  or technician_id = public.my_technician_id()
  or exists (
    select 1
    from public.bookings b
    where b.id = job_reports.booking_id
      and b.customer_id = public.my_customer_id()
  )
)
with check (
  public.is_admin()
  or technician_id = public.my_technician_id()
  or exists (
    select 1
    from public.bookings b
    where b.id = job_reports.booking_id
      and b.customer_id = public.my_customer_id()
  )
);

create policy job_reports_delete_admin
on public.job_reports for delete to authenticated
using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Storage: vendor-documents (KYC / registration - vendors upload; admins read all)
-- Requires storage schema (Supabase default). Apply after storage migration or Supabase init.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vendor-documents',
  'vendor-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vendor_documents_select_scope on storage.objects;
drop policy if exists vendor_documents_insert_own on storage.objects;
drop policy if exists vendor_documents_update_own on storage.objects;
drop policy if exists vendor_documents_delete_own on storage.objects;

create policy vendor_documents_select_scope
on storage.objects for select to authenticated
using (
  bucket_id = 'vendor-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

create policy vendor_documents_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy vendor_documents_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy vendor_documents_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- Storage bucket `vendor-intake` + RLS: see migration `20260610120000_vendor_registration_intake.sql`.

-- -----------------------------------------------------------------------------
-- Storage: technician-documents (KYC - technician uploads; employer vendor & admin read)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technician-documents',
  'technician-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists technician_documents_select_scope on storage.objects;
drop policy if exists technician_documents_insert_own on storage.objects;
drop policy if exists technician_documents_update_own on storage.objects;
drop policy if exists technician_documents_delete_own on storage.objects;

create policy technician_documents_select_scope
on storage.objects for select to authenticated
using (
  bucket_id = 'technician-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
    or exists (
      select 1
      from public.technicians t
      join public.vendors v on v.id = t.vendor_id
      where split_part(storage.objects.name, '/', 1) = t.user_id::text
        and v.user_id = auth.uid()
    )
  )
);

create policy technician_documents_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy technician_documents_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy technician_documents_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'technician-documents'
  and split_part(name, '/', 1) = auth.uid()::text
);

-- =============================================================================
-- public.platform_settings - singleton read for routing; admin writes
-- =============================================================================

create policy platform_settings_select_authenticated
on public.platform_settings for select to authenticated
using (true);

create policy platform_settings_update_admin
on public.platform_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- =============================================================================
-- public.pricing_rules - read for estimates; admin writes
-- =============================================================================

create policy pricing_rules_select_authenticated
on public.pricing_rules for select to authenticated
using (true);

create policy pricing_rules_insert_admin
on public.pricing_rules for insert to authenticated
with check (public.is_admin());

create policy pricing_rules_update_admin
on public.pricing_rules for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_rules_delete_admin
on public.pricing_rules for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.pricing_national_default_audit - admin read only; rows inserted by trigger
-- =============================================================================

alter table public.pricing_national_default_audit enable row level security;

drop policy if exists pricing_national_default_audit_select_admin on public.pricing_national_default_audit;
create policy pricing_national_default_audit_select_admin
on public.pricing_national_default_audit for select to authenticated
using (public.is_admin());

-- =============================================================================
-- public.pricing_tiers / public.pricing_city_tiers - admin writes; authenticated read (estimates)
-- =============================================================================

create policy pricing_tiers_select_authenticated
on public.pricing_tiers for select to authenticated
using (true);

create policy pricing_tiers_insert_admin
on public.pricing_tiers for insert to authenticated
with check (public.is_admin());

create policy pricing_tiers_update_admin
on public.pricing_tiers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_tiers_delete_admin
on public.pricing_tiers for delete to authenticated
using (public.is_admin());

create policy pricing_city_tiers_select_authenticated
on public.pricing_city_tiers for select to authenticated
using (true);

create policy pricing_city_tiers_insert_admin
on public.pricing_city_tiers for insert to authenticated
with check (public.is_admin());

create policy pricing_city_tiers_update_admin
on public.pricing_city_tiers for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy pricing_city_tiers_delete_admin
on public.pricing_city_tiers for delete to authenticated
using (public.is_admin());

-- =============================================================================
-- public.payments - customer dummy gateway; admin read all
-- =============================================================================

create policy payments_select_own
on public.payments for select to authenticated
using (
  customer_id = public.my_customer_id()
  or public.is_admin()
  or (
    public.is_approved_vendor_user()
    and (
      exists (
        select 1
        from public.bookings bk
        where bk.id = payments.booking_id
          and bk.vendor_id = public.my_vendor_id()
      )
      or exists (
        select 1
        from public.bookings bk
        where bk.customer_id = payments.customer_id
          and bk.vendor_id = public.my_vendor_id()
      )
    )
  )
);

create policy payments_insert_own
on public.payments for insert to authenticated
with check (customer_id = public.my_customer_id());

create policy payments_update_own
on public.payments for update to authenticated
using (customer_id = public.my_customer_id())
with check (customer_id = public.my_customer_id());
