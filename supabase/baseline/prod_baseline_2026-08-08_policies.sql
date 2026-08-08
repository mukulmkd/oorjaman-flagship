-- =============================================================================
-- SECURITY_REVIEW H3 baseline — public-schema RLS policies (captured 2026-08-08)
-- Source: supabase/baseline/export-rls-policies.sql run against the linked project
--         (UAT, schema-identical to prod). Idempotent: DROP POLICY IF EXISTS + CREATE.
-- Depends on helper fns (is_admin/my_customer_id/my_vendor_id/my_technician_id/
-- is_approved_vendor_user) + base tables existing first (see policies-base.sql / schema.sql).
-- Reproducibility/DR artifact — NOT auto-applied.
-- =============================================================================
alter table public.amc_wallet_entries enable row level security;

drop policy if exists amc_wallet_entries_select on public.amc_wallet_entries;
create policy amc_wallet_entries_select on public.amc_wallet_entries as permissive for select to authenticated
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM amc_wallets w
  WHERE ((w.id = amc_wallet_entries.wallet_id) AND ((w.customer_id = my_customer_id()) OR ((w.assigned_vendor_id IS NOT NULL) AND (w.assigned_vendor_id = my_vendor_id()))))))));

alter table public.amc_wallets enable row level security;

drop policy if exists amc_wallets_insert_admin on public.amc_wallets;
create policy amc_wallets_insert_admin on public.amc_wallets as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists amc_wallets_insert_customer on public.amc_wallets;
create policy amc_wallets_insert_customer on public.amc_wallets as permissive for insert to authenticated
  with check (((customer_id = my_customer_id()) AND (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = amc_wallets.subscription_id) AND (s.customer_id = amc_wallets.customer_id))))));

drop policy if exists amc_wallets_select on public.amc_wallets;
create policy amc_wallets_select on public.amc_wallets as permissive for select to authenticated
  using ((is_admin() OR (customer_id = my_customer_id()) OR ((assigned_vendor_id IS NOT NULL) AND (assigned_vendor_id = my_vendor_id()))));

drop policy if exists amc_wallets_update_admin on public.amc_wallets;
create policy amc_wallets_update_admin on public.amc_wallets as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.bookings enable row level security;

drop policy if exists bookings_delete_admin on public.bookings;
create policy bookings_delete_admin on public.bookings as permissive for delete to authenticated
  using (is_admin());

drop policy if exists bookings_insert_admin on public.bookings;
create policy bookings_insert_admin on public.bookings as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists bookings_insert_customer on public.bookings;
create policy bookings_insert_customer on public.bookings as permissive for insert to authenticated
  with check ((customer_id = my_customer_id()));

drop policy if exists bookings_insert_vendor on public.bookings;
create policy bookings_insert_vendor on public.bookings as permissive for insert to authenticated
  with check ((is_approved_vendor_user() AND (vendor_id = my_vendor_id())));

drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings as permissive for select to authenticated
  using (is_admin());

drop policy if exists bookings_select_customer on public.bookings;
create policy bookings_select_customer on public.bookings as permissive for select to authenticated
  using ((customer_id = my_customer_id()));

drop policy if exists bookings_select_support_desk on public.bookings;
create policy bookings_select_support_desk on public.bookings as permissive for select to authenticated
  using (is_support_desk_user());

drop policy if exists bookings_select_technician on public.bookings;
create policy bookings_select_technician on public.bookings as permissive for select to authenticated
  using (((technician_id IS NOT NULL) AND (technician_id = my_technician_id())));

drop policy if exists bookings_select_vendor on public.bookings;
create policy bookings_select_vendor on public.bookings as permissive for select to authenticated
  using ((is_approved_vendor_user() AND (((vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id())) OR ((vendor_id IS NULL) AND (status = 'confirmed'::booking_status) AND (metadata @> '{"marketplace": {"mode": "default_vendor", "floated": true}}'::jsonb)) OR ((vendor_id IS NULL) AND (status = 'confirmed'::booking_status) AND (metadata @> '{"marketplace": {"mode": "default_vendor", "vendor_cancelled_reassign": true}}'::jsonb) AND (COALESCE(((metadata -> 'vendor_reassignment'::text) ->> 'previous_vendor_id'::text), ''::text) = (my_vendor_id())::text)))));

drop policy if exists bookings_update_admin on public.bookings;
create policy bookings_update_admin on public.bookings as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists bookings_update_customer on public.bookings;
create policy bookings_update_customer on public.bookings as permissive for update to authenticated
  using ((customer_id = my_customer_id()))
  with check ((customer_id = my_customer_id()));

drop policy if exists bookings_update_technician on public.bookings;
create policy bookings_update_technician on public.bookings as permissive for update to authenticated
  using (((technician_id IS NOT NULL) AND (technician_id = my_technician_id())))
  with check (((technician_id IS NOT NULL) AND (technician_id = my_technician_id())));

drop policy if exists bookings_update_vendor on public.bookings;
create policy bookings_update_vendor on public.bookings as permissive for update to authenticated
  using ((is_approved_vendor_user() AND (((vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id())) OR ((vendor_id IS NULL) AND (status = 'confirmed'::booking_status) AND (metadata @> '{"marketplace": {"mode": "default_vendor", "floated": true}}'::jsonb)))))
  with check ((is_approved_vendor_user() AND (((vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id())) OR ((vendor_id IS NULL) AND (status = 'confirmed'::booking_status) AND (metadata @> '{"marketplace": {"mode": "default_vendor", "awaiting_admin_assignment": true}}'::jsonb) AND (metadata @> '{"vendor_reassignment": {"awaiting_admin_assignment": true}}'::jsonb)))));

alter table public.customer_oorjaman_credit_grants enable row level security;

drop policy if exists customer_oorjaman_credit_grants_select on public.customer_oorjaman_credit_grants;
create policy customer_oorjaman_credit_grants_select on public.customer_oorjaman_credit_grants as permissive for select to authenticated
  using ((is_admin() OR (customer_id = my_customer_id())));

alter table public.customer_oorjaman_credit_redemptions enable row level security;

drop policy if exists customer_oorjaman_credit_redemptions_select on public.customer_oorjaman_credit_redemptions;
create policy customer_oorjaman_credit_redemptions_select on public.customer_oorjaman_credit_redemptions as permissive for select to authenticated
  using ((is_admin() OR (customer_id = my_customer_id())));

alter table public.customer_push_outbox enable row level security;

alter table public.customer_push_tokens enable row level security;

drop policy if exists customer_push_tokens_delete_own on public.customer_push_tokens;
create policy customer_push_tokens_delete_own on public.customer_push_tokens as permissive for delete to authenticated
  using ((user_id = auth.uid()));

drop policy if exists customer_push_tokens_insert_own on public.customer_push_tokens;
create policy customer_push_tokens_insert_own on public.customer_push_tokens as permissive for insert to authenticated
  with check (((user_id = auth.uid()) AND (customer_id = my_customer_id())));

drop policy if exists customer_push_tokens_select_own on public.customer_push_tokens;
create policy customer_push_tokens_select_own on public.customer_push_tokens as permissive for select to authenticated
  using ((user_id = auth.uid()));

drop policy if exists customer_push_tokens_update_own on public.customer_push_tokens;
create policy customer_push_tokens_update_own on public.customer_push_tokens as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND (customer_id = my_customer_id())));

alter table public.customer_site_activity_events enable row level security;

drop policy if exists customer_site_activity_events_insert_own on public.customer_site_activity_events;
create policy customer_site_activity_events_insert_own on public.customer_site_activity_events as permissive for insert to authenticated
  with check ((customer_id = my_customer_id()));

drop policy if exists customer_site_activity_events_select_own on public.customer_site_activity_events;
create policy customer_site_activity_events_select_own on public.customer_site_activity_events as permissive for select to authenticated
  using ((customer_id = my_customer_id()));

alter table public.customers enable row level security;

drop policy if exists customers_delete_admin on public.customers;
create policy customers_delete_admin on public.customers as permissive for delete to authenticated
  using (is_admin());

drop policy if exists customers_insert_self_or_admin on public.customers;
create policy customers_insert_self_or_admin on public.customers as permissive for insert to authenticated
  with check ((is_admin() OR (user_id = auth.uid())));

drop policy if exists customers_select_scope on public.customers;
create policy customers_select_scope on public.customers as permissive for select to authenticated
  using ((is_admin() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.customer_id = customers.id) AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = my_vendor_id()))))) OR (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.customer_id = customers.id) AND (b.technician_id IS NOT NULL) AND (b.technician_id = my_technician_id()) AND (b.status = ANY (ARRAY['accepted'::booking_status, 'in_progress'::booking_status, 'completed'::booking_status])))))));

drop policy if exists customers_update_self_or_admin on public.customers;
create policy customers_update_self_or_admin on public.customers as permissive for update to authenticated
  using ((is_admin() OR (user_id = auth.uid())))
  with check ((is_admin() OR (user_id = auth.uid())));

alter table public.job_reports enable row level security;

drop policy if exists job_reports_delete_admin on public.job_reports;
create policy job_reports_delete_admin on public.job_reports as permissive for delete to authenticated
  using (is_admin());

drop policy if exists job_reports_insert_technician_or_admin on public.job_reports;
create policy job_reports_insert_technician_or_admin on public.job_reports as permissive for insert to authenticated
  with check ((is_admin() OR ((technician_id = my_technician_id()) AND (EXISTS ( SELECT 1
   FROM bookings bk
  WHERE ((bk.id = job_reports.booking_id) AND (bk.technician_id = my_technician_id())))))));

drop policy if exists job_reports_select_via_booking on public.job_reports;
create policy job_reports_select_via_booking on public.job_reports as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = job_reports.booking_id) AND (is_admin() OR (b.customer_id = my_customer_id()) OR (is_approved_vendor_user() AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = my_vendor_id())) OR ((b.technician_id IS NOT NULL) AND (b.technician_id = my_technician_id())))))));

drop policy if exists job_reports_update_via_booking on public.job_reports;
create policy job_reports_update_via_booking on public.job_reports as permissive for update to authenticated
  using ((is_admin() OR (technician_id = my_technician_id()) OR (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = job_reports.booking_id) AND (b.customer_id = my_customer_id()))))))
  with check ((is_admin() OR (technician_id = my_technician_id()) OR (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = job_reports.booking_id) AND (b.customer_id = my_customer_id()))))));

alter table public.notification_channel_settings enable row level security;

drop policy if exists notification_channel_settings_delete_admin on public.notification_channel_settings;
create policy notification_channel_settings_delete_admin on public.notification_channel_settings as permissive for delete to authenticated
  using (is_admin());

drop policy if exists notification_channel_settings_insert_admin on public.notification_channel_settings;
create policy notification_channel_settings_insert_admin on public.notification_channel_settings as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists notification_channel_settings_select_admin on public.notification_channel_settings;
create policy notification_channel_settings_select_admin on public.notification_channel_settings as permissive for select to authenticated
  using (is_admin());

drop policy if exists notification_channel_settings_update_admin on public.notification_channel_settings;
create policy notification_channel_settings_update_admin on public.notification_channel_settings as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.notification_events enable row level security;

drop policy if exists notification_events_insert_scoped on public.notification_events;
create policy notification_events_insert_scoped on public.notification_events as permissive for insert to authenticated
  with check ((is_admin() OR ((booking_id IS NOT NULL) AND is_booking_participant(booking_id)) OR ((booking_id IS NOT NULL) AND (recipient_audience = 'admin'::text) AND (recipient_vendor_id IS NULL) AND is_approved_vendor_user()) OR ((booking_id IS NULL) AND (recipient_vendor_id IS NULL) AND (recipient_audience = 'admin'::text) AND (event_type = 'admin_amc_awaiting_partner'::text))));

drop policy if exists notification_events_select_scope on public.notification_events;
create policy notification_events_select_scope on public.notification_events as permissive for select to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (recipient_audience = 'vendor'::text) AND (recipient_vendor_id IS NOT NULL) AND (recipient_vendor_id = my_vendor_id()))));

drop policy if exists notification_events_update_admin on public.notification_events;
create policy notification_events_update_admin on public.notification_events as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists notification_events_update_vendor_read on public.notification_events;
create policy notification_events_update_vendor_read on public.notification_events as permissive for update to authenticated
  using ((is_approved_vendor_user() AND (recipient_audience = 'vendor'::text) AND (recipient_vendor_id = my_vendor_id())))
  with check ((is_approved_vendor_user() AND (recipient_audience = 'vendor'::text) AND (recipient_vendor_id = my_vendor_id())));

alter table public.notification_templates enable row level security;

drop policy if exists notification_templates_delete_admin on public.notification_templates;
create policy notification_templates_delete_admin on public.notification_templates as permissive for delete to authenticated
  using (is_admin());

drop policy if exists notification_templates_insert_admin on public.notification_templates;
create policy notification_templates_insert_admin on public.notification_templates as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists notification_templates_select_authenticated on public.notification_templates;
create policy notification_templates_select_authenticated on public.notification_templates as permissive for select to authenticated
  using (is_admin());

drop policy if exists notification_templates_update_admin on public.notification_templates;
create policy notification_templates_update_admin on public.notification_templates as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.payments enable row level security;

drop policy if exists payments_insert_own on public.payments;
create policy payments_insert_own on public.payments as permissive for insert to authenticated
  with check ((customer_id = my_customer_id()));

drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments as permissive for select to authenticated
  using (((customer_id = my_customer_id()) OR is_admin() OR (is_approved_vendor_user() AND ((EXISTS ( SELECT 1
   FROM bookings bk
  WHERE ((bk.id = payments.booking_id) AND (bk.vendor_id = my_vendor_id())))) OR (EXISTS ( SELECT 1
   FROM bookings bk
  WHERE ((bk.customer_id = payments.customer_id) AND (bk.vendor_id = my_vendor_id()))))))));

drop policy if exists payments_update_own on public.payments;
create policy payments_update_own on public.payments as permissive for update to authenticated
  using ((customer_id = my_customer_id()))
  with check ((customer_id = my_customer_id()));

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select_admin on public.platform_settings;
create policy platform_settings_select_admin on public.platform_settings as permissive for select to authenticated
  using (is_admin());

drop policy if exists platform_settings_update_admin on public.platform_settings;
create policy platform_settings_update_admin on public.platform_settings as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.pricing_amc_plans enable row level security;

drop policy if exists pricing_amc_plans_select_authenticated on public.pricing_amc_plans;
create policy pricing_amc_plans_select_authenticated on public.pricing_amc_plans as permissive for select to authenticated
  using (true);

drop policy if exists pricing_amc_plans_write_admin on public.pricing_amc_plans;
create policy pricing_amc_plans_write_admin on public.pricing_amc_plans as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.pricing_catalog_audit enable row level security;

drop policy if exists pricing_catalog_audit_select_admin on public.pricing_catalog_audit;
create policy pricing_catalog_audit_select_admin on public.pricing_catalog_audit as permissive for select to authenticated
  using (is_admin());

alter table public.pricing_city_tiers enable row level security;

drop policy if exists pricing_city_tiers_delete_admin on public.pricing_city_tiers;
create policy pricing_city_tiers_delete_admin on public.pricing_city_tiers as permissive for delete to authenticated
  using (is_admin());

drop policy if exists pricing_city_tiers_insert_admin on public.pricing_city_tiers;
create policy pricing_city_tiers_insert_admin on public.pricing_city_tiers as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists pricing_city_tiers_select_authenticated on public.pricing_city_tiers;
create policy pricing_city_tiers_select_authenticated on public.pricing_city_tiers as permissive for select to authenticated
  using (true);

drop policy if exists pricing_city_tiers_update_admin on public.pricing_city_tiers;
create policy pricing_city_tiers_update_admin on public.pricing_city_tiers as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.pricing_national_default_audit enable row level security;

drop policy if exists pricing_national_default_audit_select_admin on public.pricing_national_default_audit;
create policy pricing_national_default_audit_select_admin on public.pricing_national_default_audit as permissive for select to authenticated
  using (is_admin());

alter table public.pricing_one_time_rates enable row level security;

drop policy if exists pricing_one_time_rates_select_authenticated on public.pricing_one_time_rates;
create policy pricing_one_time_rates_select_authenticated on public.pricing_one_time_rates as permissive for select to authenticated
  using (true);

drop policy if exists pricing_one_time_rates_write_admin on public.pricing_one_time_rates;
create policy pricing_one_time_rates_write_admin on public.pricing_one_time_rates as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.pricing_rules enable row level security;

drop policy if exists pricing_rules_delete_admin on public.pricing_rules;
create policy pricing_rules_delete_admin on public.pricing_rules as permissive for delete to authenticated
  using (is_admin());

drop policy if exists pricing_rules_insert_admin on public.pricing_rules;
create policy pricing_rules_insert_admin on public.pricing_rules as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists pricing_rules_select_authenticated on public.pricing_rules;
create policy pricing_rules_select_authenticated on public.pricing_rules as permissive for select to authenticated
  using (true);

drop policy if exists pricing_rules_update_admin on public.pricing_rules;
create policy pricing_rules_update_admin on public.pricing_rules as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.pricing_tiers enable row level security;

drop policy if exists pricing_tiers_delete_admin on public.pricing_tiers;
create policy pricing_tiers_delete_admin on public.pricing_tiers as permissive for delete to authenticated
  using (is_admin());

drop policy if exists pricing_tiers_insert_admin on public.pricing_tiers;
create policy pricing_tiers_insert_admin on public.pricing_tiers as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists pricing_tiers_select_authenticated on public.pricing_tiers;
create policy pricing_tiers_select_authenticated on public.pricing_tiers as permissive for select to authenticated
  using (true);

drop policy if exists pricing_tiers_update_admin on public.pricing_tiers;
create policy pricing_tiers_update_admin on public.pricing_tiers as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.service_capacity_tiers enable row level security;

drop policy if exists service_capacity_tiers_select_authenticated on public.service_capacity_tiers;
create policy service_capacity_tiers_select_authenticated on public.service_capacity_tiers as permissive for select to authenticated
  using (true);

drop policy if exists service_capacity_tiers_write_admin on public.service_capacity_tiers;
create policy service_capacity_tiers_write_admin on public.service_capacity_tiers as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.subscription_visit_slots enable row level security;

drop policy if exists subscription_visit_slots_delete_own on public.subscription_visit_slots;
create policy subscription_visit_slots_delete_own on public.subscription_visit_slots as permissive for delete to authenticated
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_visit_slots.subscription_id) AND (s.customer_id = my_customer_id()))))));

drop policy if exists subscription_visit_slots_insert_own on public.subscription_visit_slots;
create policy subscription_visit_slots_insert_own on public.subscription_visit_slots as permissive for insert to authenticated
  with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_visit_slots.subscription_id) AND (s.customer_id = my_customer_id()))))));

drop policy if exists subscription_visit_slots_select on public.subscription_visit_slots;
create policy subscription_visit_slots_select on public.subscription_visit_slots as permissive for select to authenticated
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_visit_slots.subscription_id) AND (s.customer_id = my_customer_id())))) OR (is_approved_vendor_user() AND (EXISTS ( SELECT 1
   FROM (subscriptions s
     JOIN bookings b ON ((b.customer_id = s.customer_id)))
  WHERE ((s.id = subscription_visit_slots.subscription_id) AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = my_vendor_id())))))));

drop policy if exists subscription_visit_slots_update_own on public.subscription_visit_slots;
create policy subscription_visit_slots_update_own on public.subscription_visit_slots as permissive for update to authenticated
  using ((is_admin() OR (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_visit_slots.subscription_id) AND (s.customer_id = my_customer_id()))))))
  with check ((is_admin() OR (EXISTS ( SELECT 1
   FROM subscriptions s
  WHERE ((s.id = subscription_visit_slots.subscription_id) AND (s.customer_id = my_customer_id()))))));

alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_delete_admin on public.subscriptions;
create policy subscriptions_delete_admin on public.subscriptions as permissive for delete to authenticated
  using (is_admin());

drop policy if exists subscriptions_insert_customer_or_admin on public.subscriptions;
create policy subscriptions_insert_customer_or_admin on public.subscriptions as permissive for insert to authenticated
  with check ((is_admin() OR (customer_id = my_customer_id())));

drop policy if exists subscriptions_select_customer_or_admin on public.subscriptions;
create policy subscriptions_select_customer_or_admin on public.subscriptions as permissive for select to authenticated
  using ((is_admin() OR (customer_id = my_customer_id()) OR (is_approved_vendor_user() AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.customer_id = subscriptions.customer_id) AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = my_vendor_id())))))));

drop policy if exists subscriptions_select_support_desk on public.subscriptions;
create policy subscriptions_select_support_desk on public.subscriptions as permissive for select to authenticated
  using (is_support_desk_user());

drop policy if exists subscriptions_update_customer_or_admin on public.subscriptions;
create policy subscriptions_update_customer_or_admin on public.subscriptions as permissive for update to authenticated
  using ((is_admin() OR (customer_id = my_customer_id())))
  with check ((is_admin() OR (customer_id = my_customer_id())));

alter table public.support_agents enable row level security;

drop policy if exists support_agents_insert_admin on public.support_agents;
create policy support_agents_insert_admin on public.support_agents as permissive for insert to authenticated
  with check ((is_admin() OR ((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'support'::user_role)))))));

drop policy if exists support_agents_select on public.support_agents;
create policy support_agents_select on public.support_agents as permissive for select to authenticated
  using ((is_support_desk_user() OR (user_id = auth.uid())));

drop policy if exists support_agents_update_admin on public.support_agents;
create policy support_agents_update_admin on public.support_agents as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.support_conversation_events enable row level security;

drop policy if exists support_conversation_events_insert_customer on public.support_conversation_events;
create policy support_conversation_events_insert_customer on public.support_conversation_events as permissive for insert to authenticated
  with check (((actor_role = 'customer'::text) AND (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_conversation_events.conversation_id) AND (c.customer_id = my_customer_id()))))));

drop policy if exists support_conversation_events_insert_desk on public.support_conversation_events;
create policy support_conversation_events_insert_desk on public.support_conversation_events as permissive for insert to authenticated
  with check (is_support_desk_user());

drop policy if exists support_conversation_events_select on public.support_conversation_events;
create policy support_conversation_events_select on public.support_conversation_events as permissive for select to authenticated
  using ((is_support_desk_user() OR (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_conversation_events.conversation_id) AND (c.customer_id = my_customer_id()))))));

alter table public.support_conversations enable row level security;

drop policy if exists support_conversations_insert_customer on public.support_conversations;
create policy support_conversations_insert_customer on public.support_conversations as permissive for insert to authenticated
  with check ((customer_id = my_customer_id()));

drop policy if exists support_conversations_insert_technician on public.support_conversations;
create policy support_conversations_insert_technician on public.support_conversations as permissive for insert to authenticated
  with check (((participant_audience = 'technician'::support_participant_audience) AND (technician_id = my_technician_id())));

drop policy if exists support_conversations_select on public.support_conversations;
create policy support_conversations_select on public.support_conversations as permissive for select to authenticated
  using ((is_admin() OR (customer_id = my_customer_id())));

drop policy if exists support_conversations_update on public.support_conversations;
create policy support_conversations_update on public.support_conversations as permissive for update to authenticated
  using ((is_admin() OR (customer_id = my_customer_id())))
  with check ((is_admin() OR (customer_id = my_customer_id())));

alter table public.support_macros enable row level security;

drop policy if exists support_macros_admin on public.support_macros;
create policy support_macros_admin on public.support_macros as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists support_macros_desk on public.support_macros;
create policy support_macros_desk on public.support_macros as permissive for all to authenticated
  using (is_support_desk_user())
  with check (is_support_desk_user());

alter table public.support_message_attachments enable row level security;

drop policy if exists support_message_attachments_insert on public.support_message_attachments;
create policy support_message_attachments_insert on public.support_message_attachments as permissive for insert to authenticated
  with check (is_support_desk_user());

drop policy if exists support_message_attachments_select on public.support_message_attachments;
create policy support_message_attachments_select on public.support_message_attachments as permissive for select to authenticated
  using ((is_support_desk_user() OR (EXISTS ( SELECT 1
   FROM (support_messages m
     JOIN support_conversations c ON ((c.id = m.conversation_id)))
  WHERE ((m.id = support_message_attachments.message_id) AND (c.customer_id = my_customer_id()))))));

alter table public.support_messages enable row level security;

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages as permissive for insert to authenticated
  with check (((is_admin() AND (sender_role = ANY (ARRAY['admin'::text, 'internal'::text]))) OR ((sender_role = 'customer'::text) AND (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_messages.conversation_id) AND (c.customer_id = my_customer_id()) AND (c.status <> 'resolved'::support_conversation_status)))))));

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages as permissive for select to authenticated
  using (((is_admin() OR (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_messages.conversation_id) AND (c.customer_id = my_customer_id()))))) AND (is_admin() OR (sender_role <> 'internal'::text))));

alter table public.technician_activity_events enable row level security;

drop policy if exists technician_activity_events_select_own on public.technician_activity_events;
create policy technician_activity_events_select_own on public.technician_activity_events as permissive for select to authenticated
  using ((technician_id = my_technician_id()));

alter table public.technician_locations enable row level security;

drop policy if exists technician_locations_insert_own on public.technician_locations;
create policy technician_locations_insert_own on public.technician_locations as permissive for insert to authenticated
  with check ((technician_id = my_technician_id()));

drop policy if exists technician_locations_select_admin on public.technician_locations;
create policy technician_locations_select_admin on public.technician_locations as permissive for select to authenticated
  using (is_admin());

drop policy if exists technician_locations_select_customer_booking on public.technician_locations;
create policy technician_locations_select_customer_booking on public.technician_locations as permissive for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.customer_id = my_customer_id()) AND (b.technician_id IS NOT NULL) AND (b.technician_id = technician_locations.technician_id)))));

drop policy if exists technician_locations_select_own on public.technician_locations;
create policy technician_locations_select_own on public.technician_locations as permissive for select to authenticated
  using ((technician_id = my_technician_id()));

drop policy if exists technician_locations_select_vendor_team on public.technician_locations;
create policy technician_locations_select_vendor_team on public.technician_locations as permissive for select to authenticated
  using ((is_approved_vendor_user() AND (EXISTS ( SELECT 1
   FROM technicians t
  WHERE ((t.id = technician_locations.technician_id) AND (t.vendor_id IS NOT NULL) AND (t.vendor_id = my_vendor_id()))))));

alter table public.technician_push_outbox enable row level security;

alter table public.technician_push_tokens enable row level security;

drop policy if exists technician_push_tokens_delete_own on public.technician_push_tokens;
create policy technician_push_tokens_delete_own on public.technician_push_tokens as permissive for delete to authenticated
  using ((user_id = auth.uid()));

drop policy if exists technician_push_tokens_insert_own on public.technician_push_tokens;
create policy technician_push_tokens_insert_own on public.technician_push_tokens as permissive for insert to authenticated
  with check (((user_id = auth.uid()) AND (technician_id = my_technician_id())));

drop policy if exists technician_push_tokens_select_own on public.technician_push_tokens;
create policy technician_push_tokens_select_own on public.technician_push_tokens as permissive for select to authenticated
  using ((user_id = auth.uid()));

drop policy if exists technician_push_tokens_update_own on public.technician_push_tokens;
create policy technician_push_tokens_update_own on public.technician_push_tokens as permissive for update to authenticated
  using ((user_id = auth.uid()))
  with check (((user_id = auth.uid()) AND (technician_id = my_technician_id())));

alter table public.technicians enable row level security;

drop policy if exists technicians_delete_scope on public.technicians;
create policy technicians_delete_scope on public.technicians as permissive for delete to authenticated
  using ((is_admin() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id()))));

drop policy if exists technicians_insert_self_or_admin on public.technicians;
create policy technicians_insert_self_or_admin on public.technicians as permissive for insert to authenticated
  with check ((is_admin() OR (user_id = auth.uid())));

drop policy if exists technicians_select_for_partner_bookings on public.technicians;
create policy technicians_select_for_partner_bookings on public.technicians as permissive for select to authenticated
  using ((is_approved_vendor_user() AND (my_vendor_id() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.technician_id = technicians.id) AND (b.vendor_id = my_vendor_id()))))));

drop policy if exists technicians_select_scope on public.technicians;
create policy technicians_select_scope on public.technicians as permissive for select to authenticated
  using ((is_admin() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id()))));

drop policy if exists technicians_update_scope on public.technicians;
create policy technicians_update_scope on public.technicians as permissive for update to authenticated
  using ((is_admin() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id()))))
  with check ((is_admin() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id()))));

alter table public.users enable row level security;

drop policy if exists users_insert_admin on public.users;
create policy users_insert_admin on public.users as permissive for insert to authenticated
  with check (is_admin());

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin on public.users as permissive for select to authenticated
  using (((id = auth.uid()) OR is_admin()));

drop policy if exists users_select_support_customer_accounts on public.users;
create policy users_select_support_customer_accounts on public.users as permissive for select to authenticated
  using ((is_support_desk_user() AND (role = 'customer'::user_role)));

drop policy if exists users_select_support_technician_accounts on public.users;
create policy users_select_support_technician_accounts on public.users as permissive for select to authenticated
  using ((is_support_desk_user() AND (role = 'technician'::user_role)));

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin on public.users as permissive for update to authenticated
  using (((id = auth.uid()) OR is_admin()))
  with check (((id = auth.uid()) OR is_admin()));

alter table public.vendor_deferred_penalties enable row level security;

drop policy if exists vendor_deferred_penalties_select on public.vendor_deferred_penalties;
create policy vendor_deferred_penalties_select on public.vendor_deferred_penalties as permissive for select to authenticated
  using ((is_admin() OR (vendor_id = my_vendor_id())));

alter table public.vendor_registration_intake enable row level security;

drop policy if exists vendor_registration_intake_admin_all on public.vendor_registration_intake;
create policy vendor_registration_intake_admin_all on public.vendor_registration_intake as permissive for all to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.vendor_settlements enable row level security;

drop policy if exists vendor_settlements_insert on public.vendor_settlements;
create policy vendor_settlements_insert on public.vendor_settlements as permissive for insert to authenticated
  with check ((is_admin() OR ((vendor_id = my_vendor_id()) AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = vendor_settlements.booking_id) AND (b.vendor_id = vendor_settlements.vendor_id))))) OR (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.id = vendor_settlements.booking_id) AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = vendor_settlements.vendor_id) AND (b.technician_id IS NOT NULL) AND (b.technician_id = my_technician_id())))) OR (EXISTS ( SELECT 1
   FROM (bookings b
     JOIN job_reports jr ON ((jr.booking_id = b.id)))
  WHERE ((b.id = jr.booking_id) AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = vendor_settlements.vendor_id) AND (jr.technician_id = my_technician_id()))))));

drop policy if exists vendor_settlements_select on public.vendor_settlements;
create policy vendor_settlements_select on public.vendor_settlements as permissive for select to authenticated
  using ((is_admin() OR (vendor_id = my_vendor_id())));

drop policy if exists vendor_settlements_update_admin on public.vendor_settlements;
create policy vendor_settlements_update_admin on public.vendor_settlements as permissive for update to authenticated
  using (is_admin())
  with check (is_admin());

alter table public.vendor_slot_availability enable row level security;

drop policy if exists vendor_slot_availability_delete_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_delete_scope on public.vendor_slot_availability as permissive for delete to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()))));

drop policy if exists vendor_slot_availability_insert_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_insert_scope on public.vendor_slot_availability as permissive for insert to authenticated
  with check ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()))));

drop policy if exists vendor_slot_availability_select_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_select_scope on public.vendor_slot_availability as permissive for select to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()))));

drop policy if exists vendor_slot_availability_update_scope on public.vendor_slot_availability;
create policy vendor_slot_availability_update_scope on public.vendor_slot_availability as permissive for update to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()))))
  with check ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()))));

alter table public.vendor_technician_invites enable row level security;

drop policy if exists vendor_technician_invites_delete_vendor on public.vendor_technician_invites;
create policy vendor_technician_invites_delete_vendor on public.vendor_technician_invites as permissive for delete to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()))));

drop policy if exists vendor_technician_invites_insert_vendor on public.vendor_technician_invites;
create policy vendor_technician_invites_insert_vendor on public.vendor_technician_invites as permissive for insert to authenticated
  with check ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id()) AND (invited_by_user_id = auth.uid()))));

drop policy if exists vendor_technician_invites_select_scope on public.vendor_technician_invites;
create policy vendor_technician_invites_select_scope on public.vendor_technician_invites as permissive for select to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id())) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.phone IS NOT NULL) AND (u.phone = vendor_technician_invites.invite_phone_e164))))));

drop policy if exists vendor_technician_invites_update_scope on public.vendor_technician_invites;
create policy vendor_technician_invites_update_scope on public.vendor_technician_invites as permissive for update to authenticated
  using ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id())) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.phone IS NOT NULL) AND (u.phone = vendor_technician_invites.invite_phone_e164))))))
  with check ((is_admin() OR (is_approved_vendor_user() AND (vendor_id = my_vendor_id())) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.phone IS NOT NULL) AND (u.phone = vendor_technician_invites.invite_phone_e164))))));

alter table public.vendors enable row level security;

drop policy if exists vendors_delete_admin on public.vendors;
create policy vendors_delete_admin on public.vendors as permissive for delete to authenticated
  using (is_admin());

drop policy if exists vendors_insert_self_or_admin on public.vendors;
create policy vendors_insert_self_or_admin on public.vendors as permissive for insert to authenticated
  with check ((is_admin() OR (user_id = auth.uid())));

drop policy if exists vendors_select_scope on public.vendors;
create policy vendors_select_scope on public.vendors as permissive for select to authenticated
  using ((is_admin() OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM technicians t
  WHERE ((t.vendor_id = vendors.id) AND (t.user_id = auth.uid())))) OR ((approval_status = 'approved'::vendor_approval_status) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'customer'::user_role)))))));

drop policy if exists vendors_update_self_or_admin on public.vendors;
create policy vendors_update_self_or_admin on public.vendors as permissive for update to authenticated
  using ((is_admin() OR (user_id = auth.uid())))
  with check ((is_admin() OR (user_id = auth.uid())));
