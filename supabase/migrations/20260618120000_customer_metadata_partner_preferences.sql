-- Partner routing preferences for customers (customer-app reads/writes these keys).
-- No new columns: data lives in public.customers.metadata (jsonb).
--
-- Keys:
--   fallback_vendor_id (text, uuid) - optional global fallback when preferred routing cannot assign.
--   service_addresses (jsonb array) - each element may include:
--     preferred_vendor_ids (text[], uuid strings, max 8 per address in app) - ordered preferred partners for that saved site.
--   default_service_address_id (text) - id of the default entry in service_addresses.

comment on column public.customers.metadata is
'Extensible JSON. Partner prefs: metadata.fallback_vendor_id (uuid text), '
'metadata.service_addresses[] entries may include preferred_vendor_ids (uuid text array, app caps length), '
'and metadata.default_service_address_id selects the default saved site.';
