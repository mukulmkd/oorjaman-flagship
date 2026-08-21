-- Production-grade Razorpay: extend payment_status enum only.
-- New enum values must be committed before use (Postgres SQLSTATE 55P04).
-- Objects that reference these values live in 20260821211000_*.sql.

do $$ begin
  alter type public.payment_status add value if not exists 'authorized';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.payment_status add value if not exists 'cancelled';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.payment_status add value if not exists 'timeout';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.payment_status add value if not exists 'partially_refunded';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.payment_status add value if not exists 'refund_pending';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.payment_status add value if not exists 'refunded';
exception when duplicate_object then null;
end $$;
do $$ begin
  alter type public.payment_status add value if not exists 'refund_failed';
exception when duplicate_object then null;
end $$;
