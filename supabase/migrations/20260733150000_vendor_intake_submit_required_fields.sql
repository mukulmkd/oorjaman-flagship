-- Enforce partner registration intake completeness on submit (matches vendor-web wizard).

create or replace function public.vendor_intake_form_text(p_form jsonb, p_key text)
returns text
language sql
immutable
as $$
  select nullif(trim(coalesce(p_form ->> p_key, '')), '');
$$;

create or replace function public.vendor_intake_form_bool(p_form jsonb, p_key text)
returns boolean
language sql
immutable
as $$
  select coalesce((p_form ->> p_key)::boolean, false);
$$;

create or replace function public.vendor_intake_validate_submit_form(p_form jsonb)
returns void
language plpgsql
immutable
as $$
declare
  v_addr jsonb;
  v_line1 text;
  v_city text;
  v_state text;
  v_pin text;
  v_years numeric;
  v_workforce integer;
  v_equipment text[];
  v_regions text[];
  v_areas text[];
  v_pan text;
  v_gstin text;
  v_ifsc text;
  v_bank_digits text;
begin
  if public.vendor_intake_form_text(p_form, 'business_name') is null then
    raise exception 'business_name is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'partner_login_email') is null then
    raise exception 'partner_login_email is required';
  end if;

  if coalesce(
    public.vendor_intake_form_text(p_form, 'partner_login_phone_e164'),
    public.vendor_intake_form_text(p_form, 'partner_login_phone'),
    ''
  ) = '' then
    raise exception 'partner_login_phone is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'trade_name') is null then
    raise exception 'trade_name is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'company_type') is null then
    raise exception 'company_type is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'company_registration_number') is null then
    raise exception 'company_registration_number is required';
  end if;

  v_gstin := upper(public.vendor_intake_form_text(p_form, 'gstin'));
  if v_gstin is null or v_gstin !~ '^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$' then
    raise exception 'valid gstin is required';
  end if;

  v_pan := upper(public.vendor_intake_form_text(p_form, 'pan'));
  if v_pan is null or v_pan !~ '^[A-Z]{5}\d{4}[A-Z]$' then
    raise exception 'valid pan is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'website_url') is null then
    raise exception 'website_url is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'contact_email') is null then
    raise exception 'contact_email is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'contact_phone') is null then
    raise exception 'contact_phone is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'contact_person_name') is null then
    raise exception 'contact_person_name is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'contact_person_role') is null then
    raise exception 'contact_person_role is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'contact_person_phone') is null then
    raise exception 'contact_person_phone is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'contact_person_email') is null then
    raise exception 'contact_person_email is required';
  end if;

  v_addr := p_form -> 'registered_address';
  if v_addr is null or jsonb_typeof(v_addr) <> 'object' then
    raise exception 'registered_address is required';
  end if;

  v_line1 := nullif(trim(coalesce(v_addr ->> 'line1', '')), '');
  v_city := nullif(trim(coalesce(v_addr ->> 'city', '')), '');
  v_state := nullif(trim(coalesce(v_addr ->> 'state', '')), '');
  v_pin := regexp_replace(coalesce(v_addr ->> 'pincode', ''), '\D', '', 'g');

  if v_line1 is null then
    raise exception 'registered_address.line1 is required';
  end if;
  if v_city is null then
    raise exception 'registered_address.city is required';
  end if;
  if v_state is null then
    raise exception 'registered_address.state is required';
  end if;
  if length(v_pin) <> 6 then
    raise exception 'registered_address.pincode must be 6 digits';
  end if;

  v_regions := coalesce(
    (
      select array_agg(trim(x))
      from unnest(
        regexp_split_to_array(
          coalesce(public.vendor_intake_form_text(p_form, 'operating_regions_text'), ''),
          '[,;\n]+'
        )
      ) as x
      where trim(x) <> ''
    ),
    '{}'::text[]
  );
  if coalesce(array_length(v_regions, 1), 0) = 0 then
    v_regions := coalesce(
      (
        select array_agg(trim(x))
        from jsonb_array_elements_text(coalesce(p_form -> 'operating_regions', '[]'::jsonb)) as x
        where trim(x) <> ''
      ),
      '{}'::text[]
    );
  end if;
  if coalesce(array_length(v_regions, 1), 0) = 0 then
    raise exception 'operating_regions is required';
  end if;

  v_areas := coalesce(
    (
      select array_agg(trim(x))
      from unnest(
        regexp_split_to_array(
          coalesce(public.vendor_intake_form_text(p_form, 'service_areas_text'), ''),
          '[,;\n]+'
        )
      ) as x
      where trim(x) <> ''
    ),
    '{}'::text[]
  );
  if coalesce(array_length(v_areas, 1), 0) = 0 then
    v_areas := coalesce(
      (
        select array_agg(trim(x))
        from jsonb_array_elements_text(coalesce(p_form -> 'service_areas', '[]'::jsonb)) as x
        where trim(x) <> ''
      ),
      '{}'::text[]
    );
  end if;
  if coalesce(array_length(v_areas, 1), 0) = 0 then
    raise exception 'service_areas is required';
  end if;

  begin
    v_years := nullif(trim(coalesce(p_form ->> 'years_in_business', '')), '')::numeric;
  exception
    when others then
      raise exception 'years_in_business must be a number';
  end;
  if v_years is null or v_years <= 0 then
    raise exception 'years_in_business is required';
  end if;

  begin
    v_workforce := nullif(trim(coalesce(p_form ->> 'workforce_headcount', '')), '')::integer;
  exception
    when others then
      raise exception 'workforce_headcount must be a whole number';
  end;
  if v_workforce is null or v_workforce <= 0 then
    raise exception 'workforce_headcount is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'experience_summary') is null then
    raise exception 'experience_summary is required';
  end if;

  v_equipment := coalesce(
    (
      select array_agg(trim(x))
      from unnest(
        regexp_split_to_array(
          coalesce(public.vendor_intake_form_text(p_form, 'equipment_text'), ''),
          '[,;\n]+'
        )
      ) as x
      where trim(x) <> ''
    ),
    '{}'::text[]
  );
  if coalesce(array_length(v_equipment, 1), 0) = 0 then
    v_equipment := coalesce(
      (
        select array_agg(trim(x))
        from jsonb_array_elements_text(coalesce(p_form -> 'equipment_available', '[]'::jsonb)) as x
        where trim(x) <> ''
      ),
      '{}'::text[]
    );
  end if;
  if coalesce(array_length(v_equipment, 1), 0) = 0 then
    raise exception 'equipment_available is required';
  end if;

  if not public.vendor_intake_form_bool(p_form, 'flag_safety_training') then
    raise exception 'flag_safety_training must be true';
  end if;
  if not public.vendor_intake_form_bool(p_form, 'flag_ppe_available') then
    raise exception 'flag_ppe_available must be true';
  end if;
  if not public.vendor_intake_form_bool(p_form, 'flag_insurance_coverage') then
    raise exception 'flag_insurance_coverage must be true';
  end if;

  if public.vendor_intake_form_text(p_form, 'bank_name') is null then
    raise exception 'bank_name is required';
  end if;

  v_ifsc := upper(regexp_replace(coalesce(public.vendor_intake_form_text(p_form, 'bank_ifsc'), ''), '\s', '', 'g'));
  if v_ifsc is null or v_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'valid bank_ifsc is required';
  end if;

  v_bank_digits := regexp_replace(coalesce(public.vendor_intake_form_text(p_form, 'bank_account_number'), ''), '\D', '', 'g');
  if length(v_bank_digits) < 9 then
    raise exception 'bank_account_number is required';
  end if;

  if public.vendor_intake_form_text(p_form, 'doc_pan_url') is null then
    raise exception 'doc_pan_url is required';
  end if;
  if public.vendor_intake_form_text(p_form, 'doc_aadhaar_url') is null then
    raise exception 'doc_aadhaar_url is required';
  end if;
  if public.vendor_intake_form_text(p_form, 'doc_gst_url') is null then
    raise exception 'doc_gst_url is required';
  end if;
  if public.vendor_intake_form_text(p_form, 'doc_bank_proof_url') is null then
    raise exception 'doc_bank_proof_url is required';
  end if;
end;
$$;

create or replace function public.submit_vendor_registration_intake (p_id uuid, p_token uuid, p_form jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
  v_business text;
begin
  perform public.vendor_intake_validate_submit_form(p_form);

  v_email := nullif(
    trim(
      coalesce(
        p_form ->> 'partner_login_email',
        p_form ->> 'contact_email',
        ''
      )
    ),
    ''
  );
  v_phone := nullif(
    trim(coalesce(p_form ->> 'partner_login_phone_e164', p_form ->> 'partner_login_phone', '')),
    ''
  );
  v_business := left(trim(coalesce(p_form ->> 'business_name', '')), 200);

  update public.vendor_registration_intake
  set
    form_data = coalesce(p_form, '{}'::jsonb),
    step_index = greatest (0, step_index),
    business_name = v_business,
    contact_email = v_email,
    contact_phone = v_phone,
    status = 'submitted',
    submitted_at = now ()
  where
    id = p_id
    and draft_access_token = p_token
    and status = 'draft';

  if not found then
    raise exception 'Invalid intake, wrong token, or intake is not editable';
  end if;
end;
$$;
