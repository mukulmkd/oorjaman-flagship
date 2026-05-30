-- =============================================================================
-- Row Level Security - OorjaManDB
-- AUTO-GENERATED from supabase/migrations/ via: node scripts/build-supabase-reference.mjs
-- Apply AFTER schema.sql (or after db push). Migrations remain authoritative for deploy.
-- =============================================================================

-- =============================================================================
-- RLS core helpers + baseline ENABLE RLS (prepended by npm run db:reference)
-- Also applied via migration 20260735000000_rls_core_helper_functions.sql
-- =============================================================================

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

-- ----- migration-derived policies -----

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

-- ----- 20260507173500_default_vendor_marketplace_policies.sql -----
drop policy if exists bookings_select_vendor on public.bookings;

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
  )
);

drop policy if exists bookings_update_vendor on public.bookings;

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
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
);

alter table public.pricing_rules enable row level security;

drop policy if exists pricing_rules_select_authenticated on public.pricing_rules;

drop policy if exists pricing_rules_insert_admin on public.pricing_rules;

drop policy if exists pricing_rules_update_admin on public.pricing_rules;

drop policy if exists pricing_rules_delete_admin on public.pricing_rules;

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

alter table public.payments enable row level security;

drop policy if exists payments_select_own on public.payments;

create policy payments_select_own
on public.payments for select to authenticated
using (customer_id = public.my_customer_id() or public.is_admin());

drop policy if exists payments_insert_own on public.payments;

create policy payments_insert_own
on public.payments for insert to authenticated
with check (customer_id = public.my_customer_id());

drop policy if exists payments_update_own on public.payments;

create policy payments_update_own
on public.payments for update to authenticated
using (customer_id = public.my_customer_id())
with check (customer_id = public.my_customer_id());

alter table public.technician_locations enable row level security;

drop policy if exists technician_locations_select_own on public.technician_locations;

drop policy if exists technician_locations_select_vendor_team on public.technician_locations;

drop policy if exists technician_locations_select_admin on public.technician_locations;

drop policy if exists technician_locations_insert_own on public.technician_locations;

create policy technician_locations_select_own
on public.technician_locations for select to authenticated
using (technician_id = public.my_technician_id());

create policy technician_locations_select_vendor_team
on public.technician_locations for select to authenticated
using (
  exists (
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

-- ----- 20260530120000_technician_locations_customer_select.sql -----
drop policy if exists technician_locations_select_customer_booking on public.technician_locations;

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

-- ----- 20260604120000_rls_vendor_approved_scope.sql -----
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

grant execute on function public.is_approved_vendor_user() to authenticated;

drop policy if exists customers_select_scope on public.customers;

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

drop policy if exists vendors_select_scope on public.vendors;

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

drop policy if exists technicians_select_scope on public.technicians;

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

drop policy if exists technicians_update_scope on public.technicians;

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

drop policy if exists technicians_delete_scope on public.technicians;

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

drop policy if exists technician_locations_select_vendor_team on public.technician_locations;

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

drop policy if exists bookings_select_vendor on public.bookings;

create policy bookings_select_vendor
on public.bookings for select to authenticated
using (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
);

drop policy if exists bookings_insert_vendor on public.bookings;

create policy bookings_insert_vendor
on public.bookings for insert to authenticated
with check (
  public.is_approved_vendor_user()
  and vendor_id = public.my_vendor_id()
);

drop policy if exists bookings_update_vendor on public.bookings;

create policy bookings_update_vendor
on public.bookings for update to authenticated
using (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
)
with check (
  public.is_approved_vendor_user()
  and vendor_id is not null
  and vendor_id = public.my_vendor_id()
);

drop policy if exists job_reports_select_via_booking on public.job_reports;

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

-- ----- 20260605120000_rls_vendor_subscriptions_payments.sql -----
drop policy if exists subscriptions_select_customer_or_admin on public.subscriptions;

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

drop policy if exists payments_select_own on public.payments;

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

alter table public.vendor_registration_intake enable row level security;

drop policy if exists vendor_registration_intake_admin_all on public.vendor_registration_intake;

create policy vendor_registration_intake_admin_all on public.vendor_registration_intake for all to authenticated using (public.is_admin ())
with
  check (public.is_admin ());

insert into
  storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'vendor-intake',
    'vendor-intake',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists vendor_intake_select_admin on storage.objects;

drop policy if exists vendor_intake_insert_draft on storage.objects;

drop policy if exists vendor_intake_update_draft on storage.objects;

create policy vendor_intake_select_admin on storage.objects for
select
  to authenticated using (
    bucket_id = 'vendor-intake'
    and public.is_admin ()
  );

create policy vendor_intake_insert_draft on storage.objects for insert to anon,
authenticated
with
  check (
    bucket_id = 'vendor-intake'
    and public.vendor_intake_allows_storage_upload (name)
  );

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

alter table public.vendor_slot_availability enable row level security;

drop policy if exists vendor_slot_availability_select_scope on public.vendor_slot_availability;

create policy vendor_slot_availability_select_scope
on public.vendor_slot_availability for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendor_slot_availability_insert_scope on public.vendor_slot_availability;

create policy vendor_slot_availability_insert_scope
on public.vendor_slot_availability for insert to authenticated
with check (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendor_slot_availability_update_scope on public.vendor_slot_availability;

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

drop policy if exists vendor_slot_availability_delete_scope on public.vendor_slot_availability;

create policy vendor_slot_availability_delete_scope
on public.vendor_slot_availability for delete to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and vendor_id = public.my_vendor_id()
  )
);

alter table public.notification_events enable row level security;

drop policy if exists notification_events_select_scope on public.notification_events;

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

drop policy if exists notification_events_insert_authenticated on public.notification_events;

create policy notification_events_insert_authenticated
on public.notification_events for insert to authenticated
with check (true);

drop policy if exists notification_events_update_admin on public.notification_events;

create policy notification_events_update_admin
on public.notification_events for update to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.notification_templates enable row level security;

drop policy if exists notification_templates_select_authenticated on public.notification_templates;

create policy notification_templates_select_authenticated
on public.notification_templates for select to authenticated
using (public.is_admin());

drop policy if exists notification_templates_insert_admin on public.notification_templates;

create policy notification_templates_insert_admin
on public.notification_templates for insert to authenticated
with check (public.is_admin());

drop policy if exists notification_templates_update_admin on public.notification_templates;

create policy notification_templates_update_admin
on public.notification_templates for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notification_templates_delete_admin on public.notification_templates;

create policy notification_templates_delete_admin
on public.notification_templates for delete to authenticated
using (public.is_admin());

alter table public.notification_channel_settings enable row level security;

drop policy if exists notification_channel_settings_select_admin on public.notification_channel_settings;

create policy notification_channel_settings_select_admin
on public.notification_channel_settings for select to authenticated
using (public.is_admin());

drop policy if exists notification_channel_settings_insert_admin on public.notification_channel_settings;

create policy notification_channel_settings_insert_admin
on public.notification_channel_settings for insert to authenticated
with check (public.is_admin());

drop policy if exists notification_channel_settings_update_admin on public.notification_channel_settings;

create policy notification_channel_settings_update_admin
on public.notification_channel_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notification_channel_settings_delete_admin on public.notification_channel_settings;

create policy notification_channel_settings_delete_admin
on public.notification_channel_settings for delete to authenticated
using (public.is_admin());

-- ----- 20260615120000_technicians_select_for_partner_bookings.sql -----
drop policy if exists technicians_select_for_partner_bookings on public.technicians;

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

-- ----- 20260616133000_vendor_cancel_accepted_reassignment_policy.sql -----
drop policy if exists bookings_update_vendor on public.bookings;

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

-- ----- 20260616134000_vendor_cancel_reassign_select_vendor.sql -----
drop policy if exists bookings_select_vendor on public.bookings;

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

alter table public.pricing_tiers enable row level security;

drop policy if exists pricing_tiers_select_authenticated on public.pricing_tiers;

drop policy if exists pricing_tiers_insert_admin on public.pricing_tiers;

drop policy if exists pricing_tiers_update_admin on public.pricing_tiers;

drop policy if exists pricing_tiers_delete_admin on public.pricing_tiers;

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

alter table public.pricing_city_tiers enable row level security;

drop policy if exists pricing_city_tiers_select_authenticated on public.pricing_city_tiers;

drop policy if exists pricing_city_tiers_insert_admin on public.pricing_city_tiers;

drop policy if exists pricing_city_tiers_update_admin on public.pricing_city_tiers;

drop policy if exists pricing_city_tiers_delete_admin on public.pricing_city_tiers;

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

alter table public.pricing_national_default_audit enable row level security;

drop policy if exists pricing_national_default_audit_select_admin on public.pricing_national_default_audit;

create policy pricing_national_default_audit_select_admin
on public.pricing_national_default_audit for select to authenticated
using (public.is_admin());

alter table public.service_capacity_tiers enable row level security;

alter table public.pricing_one_time_rates enable row level security;

alter table public.pricing_amc_plans enable row level security;

alter table public.pricing_catalog_audit enable row level security;

drop policy if exists service_capacity_tiers_select_authenticated on public.service_capacity_tiers;

create policy service_capacity_tiers_select_authenticated
on public.service_capacity_tiers for select to authenticated using (true);

drop policy if exists service_capacity_tiers_write_admin on public.service_capacity_tiers;

create policy service_capacity_tiers_write_admin
on public.service_capacity_tiers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists pricing_one_time_rates_select_authenticated on public.pricing_one_time_rates;

create policy pricing_one_time_rates_select_authenticated
on public.pricing_one_time_rates for select to authenticated using (true);

drop policy if exists pricing_one_time_rates_write_admin on public.pricing_one_time_rates;

create policy pricing_one_time_rates_write_admin
on public.pricing_one_time_rates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists pricing_amc_plans_select_authenticated on public.pricing_amc_plans;

create policy pricing_amc_plans_select_authenticated
on public.pricing_amc_plans for select to authenticated using (true);

drop policy if exists pricing_amc_plans_write_admin on public.pricing_amc_plans;

create policy pricing_amc_plans_write_admin
on public.pricing_amc_plans for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists pricing_catalog_audit_select_admin on public.pricing_catalog_audit;

create policy pricing_catalog_audit_select_admin
on public.pricing_catalog_audit for select to authenticated using (public.is_admin());

-- ----- 20260622130000_customer_site_photos.sql -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-site-photos',
  'customer-site-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists customer_site_photos_select on storage.objects;

drop policy if exists customer_site_photos_insert on storage.objects;

drop policy if exists customer_site_photos_update on storage.objects;

drop policy if exists customer_site_photos_delete on storage.objects;

create policy customer_site_photos_select
on storage.objects for select to authenticated
using (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_read(name)
);

create policy customer_site_photos_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
);

create policy customer_site_photos_update
on storage.objects for update to authenticated
using (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
)
with check (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
);

create policy customer_site_photos_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'customer-site-photos'
  and public.customer_site_photo_can_write(name)
);

drop policy if exists customers_select_scope on public.customers;

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
  or exists (
    select 1
    from public.bookings b
    where b.customer_id = customers.id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
      and b.status in (
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status
      )
  )
);

alter table public.subscription_visit_slots enable row level security;

drop policy if exists subscription_visit_slots_select on public.subscription_visit_slots;

create policy subscription_visit_slots_select
on public.subscription_visit_slots for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
  or (
    public.is_approved_vendor_user()
    and exists (
      select 1
      from public.subscriptions s
      join public.bookings b on b.customer_id = s.customer_id
      where s.id = subscription_visit_slots.subscription_id
        and b.vendor_id is not null
        and b.vendor_id = public.my_vendor_id()
    )
  )
);

drop policy if exists subscription_visit_slots_insert_own on public.subscription_visit_slots;

create policy subscription_visit_slots_insert_own
on public.subscription_visit_slots for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
);

drop policy if exists subscription_visit_slots_update_own on public.subscription_visit_slots;

create policy subscription_visit_slots_update_own
on public.subscription_visit_slots for update to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
);

-- ----- 20260719120000_subscription_visit_slots_delete_policy.sql -----
drop policy if exists subscription_visit_slots_delete_own on public.subscription_visit_slots;

create policy subscription_visit_slots_delete_own
on public.subscription_visit_slots for delete to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.subscriptions s
    where s.id = subscription_visit_slots.subscription_id
      and s.customer_id = public.my_customer_id()
  )
);

alter table public.customer_site_activity_events enable row level security;

drop policy if exists customer_site_activity_events_select_own on public.customer_site_activity_events;

create policy customer_site_activity_events_select_own
on public.customer_site_activity_events for select to authenticated
using (customer_id = public.my_customer_id());

drop policy if exists customer_site_activity_events_insert_own on public.customer_site_activity_events;

create policy customer_site_activity_events_insert_own
on public.customer_site_activity_events for insert to authenticated
with check (customer_id = public.my_customer_id());

alter table public.support_conversations enable row level security;

alter table public.support_messages enable row level security;

drop policy if exists support_conversations_select on public.support_conversations;

create policy support_conversations_select
on public.support_conversations for select to authenticated
using (
  public.is_admin()
  or customer_id = public.my_customer_id()
);

drop policy if exists support_conversations_insert_customer on public.support_conversations;

create policy support_conversations_insert_customer
on public.support_conversations for insert to authenticated
with check (customer_id = public.my_customer_id());

drop policy if exists support_conversations_update on public.support_conversations;

create policy support_conversations_update
on public.support_conversations for update to authenticated
using (public.is_admin() or customer_id = public.my_customer_id())
with check (public.is_admin() or customer_id = public.my_customer_id());

drop policy if exists support_messages_select on public.support_messages;

create policy support_messages_select
on public.support_messages for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.customer_id = public.my_customer_id()
  )
);

drop policy if exists support_messages_insert on public.support_messages;

create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    public.is_admin()
    and sender_role = 'admin'
  )
  or (
    sender_role = 'customer'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
        and c.status <> 'resolved'
    )
  )
);

drop policy if exists notification_events_select_scope on public.notification_events;

create policy notification_events_select_scope
on public.notification_events for select to authenticated
using (
  public.is_admin()
  or (
    public.is_approved_vendor_user()
    and recipient_audience = 'vendor'
    and recipient_vendor_id is not null
    and recipient_vendor_id = public.my_vendor_id()
  )
);

drop policy if exists notification_events_update_admin on public.notification_events;

create policy notification_events_update_admin
on public.notification_events for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists notification_events_update_vendor_read on public.notification_events;

create policy notification_events_update_vendor_read
on public.notification_events for update to authenticated
using (
  public.is_approved_vendor_user()
  and recipient_audience = 'vendor'
  and recipient_vendor_id = public.my_vendor_id()
)
with check (
  public.is_approved_vendor_user()
  and recipient_audience = 'vendor'
  and recipient_vendor_id = public.my_vendor_id()
);

drop policy if exists support_messages_select on public.support_messages;

create policy support_messages_select
on public.support_messages for select to authenticated
using (
  (
    public.is_admin()
    or exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
    )
  )
  and (
    public.is_admin()
    or support_messages.sender_role <> 'internal'
  )
);

drop policy if exists support_messages_insert on public.support_messages;

create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    public.is_admin()
    and sender_role in ('admin', 'internal')
  )
  or (
    sender_role = 'customer'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
        and c.status <> 'resolved'
    )
  )
);

alter table public.support_macros enable row level security;

drop policy if exists support_macros_admin on public.support_macros;

create policy support_macros_admin
on public.support_macros for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.is_support_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.support_agents sa
    where sa.user_id = auth.uid()
      and sa.is_active = true
  );

create or replace function public.is_support_desk_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_support_agent();

alter table public.support_agents enable row level security;

drop policy if exists support_agents_select on public.support_agents;

create policy support_agents_select
on public.support_agents for select to authenticated
using (public.is_support_desk_user() or user_id = auth.uid());

drop policy if exists support_agents_insert_admin on public.support_agents;

create policy support_agents_insert_admin
on public.support_agents for insert to authenticated
with check (
  public.is_admin()
  or (
    user_id = auth.uid()
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role = 'support'::public.user_role
    )
  )
);

drop policy if exists support_agents_update_admin on public.support_agents;

create policy support_agents_update_admin
on public.support_agents for update to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.support_message_attachments enable row level security;

drop policy if exists support_conversations_select on public.support_conversations;

create policy support_conversations_select
on public.support_conversations for select to authenticated
using (
  public.is_support_desk_user()
  or customer_id = public.my_customer_id()
);

drop policy if exists support_conversations_update on public.support_conversations;

create policy support_conversations_update
on public.support_conversations for update to authenticated
using (public.is_support_desk_user() or customer_id = public.my_customer_id())
with check (public.is_support_desk_user() or customer_id = public.my_customer_id());

drop policy if exists support_messages_select on public.support_messages;

create policy support_messages_select
on public.support_messages for select to authenticated
using (
  (
    public.is_support_desk_user()
    or exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
    )
  )
  and (
    public.is_support_desk_user()
    or support_messages.sender_role <> 'internal'
  )
);

drop policy if exists support_messages_insert on public.support_messages;

create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    public.is_support_desk_user()
    and sender_role in ('admin', 'internal')
  )
  or (
    sender_role = 'customer'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = public.my_customer_id()
        and c.status <> 'resolved'
    )
  )
);

drop policy if exists support_macros_admin on public.support_macros;

create policy support_macros_desk
on public.support_macros for all to authenticated
using (public.is_support_desk_user())
with check (public.is_support_desk_user());

drop policy if exists support_message_attachments_select on public.support_message_attachments;

create policy support_message_attachments_select
on public.support_message_attachments for select to authenticated
using (
  public.is_support_desk_user()
  or exists (
    select 1
    from public.support_messages m
    join public.support_conversations c on c.id = m.conversation_id
    where m.id = support_message_attachments.message_id
      and c.customer_id = public.my_customer_id()
  )
);

drop policy if exists support_message_attachments_insert on public.support_message_attachments;

create policy support_message_attachments_insert
on public.support_message_attachments for insert to authenticated
with check (public.is_support_desk_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists support_attachments_select on storage.objects;

create policy support_attachments_select
on storage.objects for select to authenticated
using (
  bucket_id = 'support-attachments'
  and (
    public.is_support_desk_user()
    or exists (
      select 1
      from public.support_message_attachments a
      join public.support_messages m on m.id = a.message_id
      join public.support_conversations c on c.id = m.conversation_id
      where a.storage_path = storage.objects.name
        and c.customer_id = public.my_customer_id()
    )
  )
);

drop policy if exists support_attachments_insert on storage.objects;

create policy support_attachments_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-attachments'
  and public.is_support_desk_user()
);

alter table public.support_conversation_events enable row level security;

drop policy if exists support_conversation_events_select on public.support_conversation_events;

create policy support_conversation_events_select
on public.support_conversation_events for select to authenticated
using (
  public.is_support_desk_user()
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_conversation_events.conversation_id
      and c.customer_id = public.my_customer_id()
  )
);

drop policy if exists support_conversation_events_insert_desk on public.support_conversation_events;

create policy support_conversation_events_insert_desk
on public.support_conversation_events for insert to authenticated
with check (public.is_support_desk_user());

drop policy if exists support_conversation_events_insert_customer on public.support_conversation_events;

create policy support_conversation_events_insert_customer
on public.support_conversation_events for insert to authenticated
with check (
  actor_role = 'customer'
  and exists (
    select 1
    from public.support_conversations c
    where c.id = support_conversation_events.conversation_id
      and c.customer_id = public.my_customer_id()
  )
);

-- ----- 20260729120000_support_desk_customer_lookup_rls.sql -----
drop policy if exists customers_select_scope on public.customers;

create policy customers_select_scope
on public.customers for select to authenticated
using (
  public.is_admin()
  or public.is_support_desk_user()
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
  or exists (
    select 1
    from public.bookings b
    where b.customer_id = customers.id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
      and b.status in (
        'accepted'::public.booking_status,
        'in_progress'::public.booking_status,
        'completed'::public.booking_status
      )
  )
);

drop policy if exists users_select_support_customer_accounts on public.users;

create policy users_select_support_customer_accounts
on public.users for select to authenticated
using (
  public.is_support_desk_user()
  and role = 'customer'::public.user_role
);

drop policy if exists bookings_select_support_desk on public.bookings;

create policy bookings_select_support_desk
on public.bookings for select to authenticated
using (public.is_support_desk_user());

drop policy if exists subscriptions_select_support_desk on public.subscriptions;

create policy subscriptions_select_support_desk
on public.subscriptions for select to authenticated
using (public.is_support_desk_user());

alter table public.customer_push_tokens enable row level security;

drop policy if exists customer_push_tokens_select_own on public.customer_push_tokens;

create policy customer_push_tokens_select_own
on public.customer_push_tokens for select to authenticated
using (user_id = auth.uid());

drop policy if exists customer_push_tokens_insert_own on public.customer_push_tokens;

create policy customer_push_tokens_insert_own
on public.customer_push_tokens for insert to authenticated
with check (
  user_id = auth.uid()
  and customer_id = public.my_customer_id()
);

drop policy if exists customer_push_tokens_update_own on public.customer_push_tokens;

create policy customer_push_tokens_update_own
on public.customer_push_tokens for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and customer_id = public.my_customer_id()
);

drop policy if exists customer_push_tokens_delete_own on public.customer_push_tokens;

create policy customer_push_tokens_delete_own
on public.customer_push_tokens for delete to authenticated
using (user_id = auth.uid());

alter table public.customer_push_outbox enable row level security;

drop policy if exists support_conversations_select on public.support_conversations;

create policy support_conversations_select
on public.support_conversations for select to authenticated
using (
  public.is_admin()
  or public.is_support_agent()
  or (
    participant_audience = 'customer'
    and customer_id = public.my_customer_id()
  )
  or (
    participant_audience = 'technician'
    and technician_id = public.my_technician_id()
  )
);

drop policy if exists support_conversations_insert_customer on public.support_conversations;

create policy support_conversations_insert_customer
on public.support_conversations for insert to authenticated
with check (
  participant_audience = 'customer'
  and customer_id = public.my_customer_id()
);

drop policy if exists support_conversations_insert_technician on public.support_conversations;

create policy support_conversations_insert_technician
on public.support_conversations for insert to authenticated
with check (
  participant_audience = 'technician'
  and technician_id = public.my_technician_id()
);

drop policy if exists support_conversations_update on public.support_conversations;

create policy support_conversations_update
on public.support_conversations for update to authenticated
using (
  public.is_admin()
  or public.is_support_agent()
  or (
    participant_audience = 'customer'
    and customer_id = public.my_customer_id()
  )
  or (
    participant_audience = 'technician'
    and technician_id = public.my_technician_id()
  )
)
with check (
  public.is_admin()
  or public.is_support_agent()
  or (
    participant_audience = 'customer'
    and customer_id = public.my_customer_id()
  )
  or (
    participant_audience = 'technician'
    and technician_id = public.my_technician_id()
  )
);

drop policy if exists support_messages_select on public.support_messages;

create policy support_messages_select
on public.support_messages for select to authenticated
using (
  public.is_admin()
  or public.is_support_agent()
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.participant_audience = 'customer'
      and c.customer_id = public.my_customer_id()
  )
  or exists (
    select 1
    from public.support_conversations c
    where c.id = support_messages.conversation_id
      and c.participant_audience = 'technician'
      and c.technician_id = public.my_technician_id()
  )
);

drop policy if exists support_messages_insert on public.support_messages;

create policy support_messages_insert
on public.support_messages for insert to authenticated
with check (
  (
    (public.is_admin() or public.is_support_agent())
    and sender_role = 'admin'
  )
  or (
    sender_role = 'customer'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.participant_audience = 'customer'
        and c.customer_id = public.my_customer_id()
        and c.status <> 'resolved'
    )
  )
  or (
    sender_role = 'technician'
    and exists (
      select 1
      from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.participant_audience = 'technician'
        and c.technician_id = public.my_technician_id()
        and c.status <> 'resolved'
    )
  )
);

alter table public.technician_push_tokens enable row level security;

drop policy if exists technician_push_tokens_select_own on public.technician_push_tokens;

create policy technician_push_tokens_select_own
on public.technician_push_tokens for select to authenticated
using (user_id = auth.uid());

drop policy if exists technician_push_tokens_insert_own on public.technician_push_tokens;

create policy technician_push_tokens_insert_own
on public.technician_push_tokens for insert to authenticated
with check (
  user_id = auth.uid()
  and technician_id = public.my_technician_id()
);

drop policy if exists technician_push_tokens_update_own on public.technician_push_tokens;

create policy technician_push_tokens_update_own
on public.technician_push_tokens for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and technician_id = public.my_technician_id()
);

drop policy if exists technician_push_tokens_delete_own on public.technician_push_tokens;

create policy technician_push_tokens_delete_own
on public.technician_push_tokens for delete to authenticated
using (user_id = auth.uid());

alter table public.technician_push_outbox enable row level security;

-- ----- 20260732130000_support_desk_technician_lookup_rls.sql -----
drop policy if exists technicians_select_scope on public.technicians;

create policy technicians_select_scope
on public.technicians for select to authenticated
using (
  public.is_admin()
  or public.is_support_desk_user()
  or user_id = auth.uid()
  or (
    public.is_approved_vendor_user()
    and vendor_id is not null
    and vendor_id = public.my_vendor_id()
  )
);

drop policy if exists vendors_select_scope on public.vendors;

create policy vendors_select_scope
on public.vendors for select to authenticated
using (
  public.is_admin()
  or public.is_support_desk_user()
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

-- ----- 20260732140000_support_desk_technician_user_lookup_rls.sql -----
drop policy if exists users_select_support_technician_accounts on public.users;

create policy users_select_support_technician_accounts
on public.users for select to authenticated
using (
  public.is_support_desk_user()
  and role = 'technician'::public.user_role
);

alter table public.technician_activity_events enable row level security;

drop policy if exists technician_activity_events_select_own on public.technician_activity_events;

create policy technician_activity_events_select_own
on public.technician_activity_events for select to authenticated
using (technician_id = public.my_technician_id());

alter table public.vendor_settlements enable row level security;

drop policy if exists vendor_settlements_select on public.vendor_settlements;

create policy vendor_settlements_select
on public.vendor_settlements for select to authenticated
using (
  public.is_admin()
  or vendor_id = public.my_vendor_id()
);

drop policy if exists vendor_settlements_insert on public.vendor_settlements;

create policy vendor_settlements_insert
on public.vendor_settlements for insert to authenticated
with check (
  public.is_admin()
  or (
    vendor_id = public.my_vendor_id()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.vendor_id = vendor_settlements.vendor_id
    )
  )
  or exists (
    select 1
    from public.bookings b
    join public.technicians t on t.id = b.technician_id
    where b.id = booking_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists vendor_settlements_update_admin on public.vendor_settlements;

create policy vendor_settlements_update_admin
on public.vendor_settlements for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ----- 20260733240000_vendor_settlements_technician_insert_rls.sql -----
drop policy if exists vendor_settlements_insert on public.vendor_settlements;

create policy vendor_settlements_insert
on public.vendor_settlements for insert to authenticated
with check (
  public.is_admin()
  or (
    vendor_id = public.my_vendor_id()
    and exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and b.vendor_id = vendor_settlements.vendor_id
    )
  )
  or exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and b.vendor_id is not null
      and b.vendor_id = vendor_settlements.vendor_id
      and b.technician_id is not null
      and b.technician_id = public.my_technician_id()
  )
);

-- ----- 20260735000000_rls_core_helper_functions.sql -----
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

grant execute on function public.is_admin() to authenticated;

grant execute on function public.my_customer_id() to authenticated;

grant execute on function public.my_vendor_id() to authenticated;

grant execute on function public.my_technician_id() to authenticated;

grant execute on function public.is_approved_vendor_user() to authenticated;

-- End of policies (generated)
