-- Backfill public.users.full_name from role profile tables (display labels for desk/search).

update public.users u
set
  full_name = trim(c.display_name),
  updated_at = now()
from public.customers c
where c.user_id = u.id
  and nullif(trim(c.display_name), '') is not null;

update public.users u
set
  full_name = trim(t.name_as_per_aadhaar),
  updated_at = now()
from public.technicians t
where t.user_id = u.id
  and nullif(trim(t.name_as_per_aadhaar), '') is not null;

update public.users u
set
  full_name = coalesce(nullif(trim(v.trade_name), ''), nullif(trim(v.business_name), '')),
  updated_at = now()
from public.vendors v
where v.user_id = u.id
  and coalesce(nullif(trim(v.trade_name), ''), nullif(trim(v.business_name), '')) is not null;

update public.users u
set
  full_name = trim(sa.display_name),
  updated_at = now()
from public.support_agents sa
where sa.user_id = u.id
  and nullif(trim(sa.display_name), '') is not null;
