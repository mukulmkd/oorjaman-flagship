-- Realtime UPDATE filters (vendor_id=eq.…) need the full row on vendor_settlements.

alter table public.vendor_settlements replica identity full;
