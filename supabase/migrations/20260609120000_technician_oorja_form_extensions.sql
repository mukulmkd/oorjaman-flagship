-- Oorja Man form extensions: identity, employer ref, passport/safety docs, solar experience, optional profile email.

alter table public.technicians
  add column if not exists father_guardian_name text,
  add column if not exists gender text,
  add column if not exists contact_email text,
  add column if not exists employer_registration_ref text,
  add column if not exists safety_training_org text,
  add column if not exists doc_passport_url text,
  add column if not exists doc_safety_certificate_url text,
  add column if not exists flag_solar_cleaning_experience boolean not null default false,
  add column if not exists other_skills text;

alter table public.technicians
  drop constraint if exists technicians_gender_chk;

alter table public.technicians
  add constraint technicians_gender_chk
  check (
    gender is null
    or gender in ('female', 'male', 'other', 'prefer_not_to_say')
  );
