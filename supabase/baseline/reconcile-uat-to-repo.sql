-- =============================================================================
-- Reconcile UAT (caearbriteguqjvnbrcg) support-desk RLS -> repo/prod intended state.
-- Source of truth: live PROD dump (supabase/baseline/prod-dump.json) == repo policies.sql.
-- Run in the UAT SQL editor. Idempotent (drop+create). Re-run the compare after.
-- =============================================================================
drop policy if exists customers_select_scope on public.customers;
create policy customers_select_scope on public.customers as permissive for select to authenticated
  using ((is_admin() OR is_support_desk_user() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.customer_id = customers.id) AND (b.vendor_id IS NOT NULL) AND (b.vendor_id = my_vendor_id()))))) OR (EXISTS ( SELECT 1
   FROM bookings b
  WHERE ((b.customer_id = customers.id) AND (b.technician_id IS NOT NULL) AND (b.technician_id = my_technician_id()) AND (b.status = ANY (ARRAY['accepted'::booking_status, 'in_progress'::booking_status, 'completed'::booking_status])))))));

drop policy if exists support_conversations_insert_customer on public.support_conversations;
create policy support_conversations_insert_customer on public.support_conversations as permissive for insert to authenticated
  with check (((participant_audience = 'customer'::support_participant_audience) AND (customer_id = my_customer_id())));

drop policy if exists support_conversations_select on public.support_conversations;
create policy support_conversations_select on public.support_conversations as permissive for select to authenticated
  using ((is_admin() OR is_support_agent() OR ((participant_audience = 'customer'::support_participant_audience) AND (customer_id = my_customer_id())) OR ((participant_audience = 'technician'::support_participant_audience) AND (technician_id = my_technician_id()))));

drop policy if exists support_conversations_update on public.support_conversations;
create policy support_conversations_update on public.support_conversations as permissive for update to authenticated
  using ((is_admin() OR is_support_agent() OR ((participant_audience = 'customer'::support_participant_audience) AND (customer_id = my_customer_id())) OR ((participant_audience = 'technician'::support_participant_audience) AND (technician_id = my_technician_id()))))
  with check ((is_admin() OR is_support_agent() OR ((participant_audience = 'customer'::support_participant_audience) AND (customer_id = my_customer_id())) OR ((participant_audience = 'technician'::support_participant_audience) AND (technician_id = my_technician_id()))));

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages as permissive for insert to authenticated
  with check ((((is_admin() OR is_support_agent()) AND (sender_role = 'admin'::text)) OR ((sender_role = 'customer'::text) AND (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_messages.conversation_id) AND (c.participant_audience = 'customer'::support_participant_audience) AND (c.customer_id = my_customer_id()) AND (c.status <> 'resolved'::support_conversation_status))))) OR ((sender_role = 'technician'::text) AND (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_messages.conversation_id) AND (c.participant_audience = 'technician'::support_participant_audience) AND (c.technician_id = my_technician_id()) AND (c.status <> 'resolved'::support_conversation_status)))))));

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages as permissive for select to authenticated
  using ((is_admin() OR is_support_agent() OR (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_messages.conversation_id) AND (c.participant_audience = 'customer'::support_participant_audience) AND (c.customer_id = my_customer_id())))) OR (EXISTS ( SELECT 1
   FROM support_conversations c
  WHERE ((c.id = support_messages.conversation_id) AND (c.participant_audience = 'technician'::support_participant_audience) AND (c.technician_id = my_technician_id()))))));

drop policy if exists technicians_select_scope on public.technicians;
create policy technicians_select_scope on public.technicians as permissive for select to authenticated
  using ((is_admin() OR is_support_desk_user() OR (user_id = auth.uid()) OR (is_approved_vendor_user() AND (vendor_id IS NOT NULL) AND (vendor_id = my_vendor_id()))));

drop policy if exists vendors_select_scope on public.vendors;
create policy vendors_select_scope on public.vendors as permissive for select to authenticated
  using ((is_admin() OR is_support_desk_user() OR (user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM technicians t
  WHERE ((t.vendor_id = vendors.id) AND (t.user_id = auth.uid())))) OR ((approval_status = 'approved'::vendor_approval_status) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'customer'::user_role)))))));

-- Drop the stale pre-rename macro policy (repo/prod use support_macros_desk, already present on UAT).
drop policy if exists support_macros_admin on public.support_macros;
