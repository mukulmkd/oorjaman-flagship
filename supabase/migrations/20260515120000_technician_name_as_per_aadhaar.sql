-- Legal name as printed on Aadhaar (KYC alignment)
alter table public.technicians
  add column if not exists name_as_per_aadhaar text;

comment on column public.technicians.name_as_per_aadhaar is
  'Full name as on Aadhaar / identity — required at technician onboarding step 1.';
