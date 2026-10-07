-- Claim the payment-documents email without replacing the rest of booking metadata.

create or replace function public.claim_payment_documents_email(
  p_booking_id uuid,
  p_payment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.bookings
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'payment_documents_email_sent_at', to_jsonb(now()),
    'payment_documents_payment_id', to_jsonb(p_payment_id::text)
  )
  where id = p_booking_id
    and nullif(metadata->>'payment_documents_email_sent_at', '') is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

create or replace function public.release_payment_documents_email(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
  set metadata = coalesce(metadata, '{}'::jsonb)
    - 'payment_documents_email_sent_at'
    - 'payment_documents_payment_id'
  where id = p_booking_id;
end;
$$;

revoke all on function public.claim_payment_documents_email(uuid, uuid) from public;
revoke all on function public.release_payment_documents_email(uuid) from public;
grant execute on function public.claim_payment_documents_email(uuid, uuid) to service_role;
grant execute on function public.release_payment_documents_email(uuid) to service_role;
