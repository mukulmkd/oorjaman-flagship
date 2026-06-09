import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Redirect, router, type Href } from "expo-router";
import {
  authApi,
  queryKeys,
  technicianApi,
  uploadTechnicianDocument,
  userApi,
  vendorApi,
} from "@oorjaman/api";
import type { Json, TechnicianDocKind, TechnicianRow, VendorRow } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { AppScaffold, Button, Input, Screen, SCREEN_EDGES_FULL_SCREEN } from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import {
  allOnboardingSafetyAcksChecked,
  emptyOnboardingSafetyAcks,
  ONBOARDING_SAFETY_ACKS,
  type OnboardingSafetyAckKey,
} from "../lib/onboarding-safety-acks";
import { supabase } from "../lib/supabase";

type PickedDoc = { uri: string; name: string; mime: string | null };

type GenderFormField = "" | NonNullable<TechnicianRow["gender"]>;

type FormFields = {
  vendor_id: string;
  name_as_per_aadhaar: string;
  addr_line1: string;
  addr_city: string;
  addr_state: string;
  addr_pincode: string;
  date_of_birth: string;
  personal_phone: string;
  father_guardian_name: string;
  gender: GenderFormField;
  contact_email: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  pan_number: string;
  aadhaar_last4: string;
  skills_text: string;
  experience_summary: string;
  years_experience: string;
  preferred_locations_text: string;
  service_radius_km: string;
  flag_safety_training: boolean;
  flag_height_work_cert: boolean;
  flag_solar_cleaning_experience: boolean;
  other_skills: string;
  safety_training_org: string;
  bank_account_holder_name: string;
  bank_account_last4: string;
  bank_ifsc: string;
  declaration_information_accurate: boolean;
  declaration_safety_commitment: boolean;
  safety_ack_pre_start_checklist: boolean;
  safety_ack_job_start_code: boolean;
  safety_ack_safety_measures: boolean;
  safety_ack_reviewed_guidelines: boolean;
};

const STEPS = ["Employer & you", "Identity", "Skills", "Safety", "Bank"] as const;

const GENDER_OPTIONS: { value: NonNullable<TechnicianRow["gender"]>; label: string }[] = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

function splitCsv(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Preferred work location is a single city name (no lists). */
function parsePreferredWorkCity(raw: string): string | null {
  const city = raw.trim();
  if (!city) return null;
  if (/[,;\n]/.test(city)) return null;
  return city;
}

function parseYearsExperience(raw: string): number | null {
  const years = raw.trim();
  if (!years) return null;
  const n = Number.parseFloat(years);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function stepSkillsCanProceed(form: FormFields): boolean {
  if (splitCsv(form.skills_text).length === 0) return false;
  if (!parsePreferredWorkCity(form.preferred_locations_text)) return false;
  if (!form.flag_solar_cleaning_experience) return false;
  if (!parseYearsExperience(form.years_experience)) return false;
  return true;
}

function readEmployerDisplayName(
  vendor: VendorRow | undefined,
  inviteMetadata: Json | null | undefined,
): string {
  if (vendor) {
    const fromVendor = vendor.trade_name?.trim() || vendor.business_name?.trim();
    if (fromVendor) return fromVendor;
  }
  if (inviteMetadata && typeof inviteMetadata === "object" && !Array.isArray(inviteMetadata)) {
    const o = inviteMetadata as Record<string, unknown>;
    const display = typeof o.employer_display_name === "string" ? o.employer_display_name.trim() : "";
    if (display) return display;
    const trade = typeof o.employer_trade_name === "string" ? o.employer_trade_name.trim() : "";
    const business = typeof o.employer_business_name === "string" ? o.employer_business_name.trim() : "";
    if (trade || business) return trade || business;
  }
  return "";
}

function stepSafetyCanProceed(form: FormFields): boolean {
  if (!allOnboardingSafetyAcksChecked(form)) return false;
  if (!form.declaration_information_accurate || !form.declaration_safety_commitment) return false;
  return true;
}

function normalizeBankIfsc(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s/g, "");
}

function isValidBankIfsc(raw: string): boolean {
  const ifsc = normalizeBankIfsc(raw);
  return /^[A-Z0-9]{11}$/.test(ifsc);
}

function parseBankIfsc(raw: string): string | null {
  const ifsc = normalizeBankIfsc(raw);
  return isValidBankIfsc(raw) ? ifsc : null;
}

function stepBankCanProceed(form: FormFields, bankProofReady: boolean): boolean {
  return (
    Boolean(form.bank_account_holder_name.trim()) &&
    /^\d{4}$/.test(form.bank_account_last4.trim()) &&
    isValidBankIfsc(form.bank_ifsc) &&
    bankProofReady
  );
}

function bankStepMissingLabels(form: FormFields, bankProofReady: boolean): string[] {
  const missing: string[] = [];
  if (!form.bank_account_holder_name.trim()) missing.push("account holder name");
  if (!/^\d{4}$/.test(form.bank_account_last4.trim())) missing.push("last 4 digits of account number");
  if (!isValidBankIfsc(form.bank_ifsc)) missing.push("11-character IFSC");
  if (!bankProofReady) missing.push("bank proof document");
  return missing;
}

function readHome(t: TechnicianRow | null | undefined) {
  const h = t?.home_base_address;
  if (h && typeof h === "object" && !Array.isArray(h)) {
    const o = h as Record<string, unknown>;
    return {
      line1: String(o.line1 ?? o.line_1 ?? ""),
      city: String(o.city ?? ""),
      state: String(o.state ?? ""),
      pincode: String(o.pincode ?? ""),
    };
  }
  return { line1: "", city: "", state: "", pincode: "" };
}

const emptyForm = (): FormFields => ({
  vendor_id: "",
  name_as_per_aadhaar: "",
  addr_line1: "",
  addr_city: "",
  addr_state: "",
  addr_pincode: "",
  date_of_birth: "",
  personal_phone: "",
  father_guardian_name: "",
  gender: "" as GenderFormField,
  contact_email: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  pan_number: "",
  aadhaar_last4: "",
  skills_text: "",
  experience_summary: "",
  years_experience: "",
  preferred_locations_text: "",
  service_radius_km: "",
  flag_safety_training: false,
  flag_height_work_cert: false,
  flag_solar_cleaning_experience: false,
  other_skills: "",
  safety_training_org: "",
  bank_account_holder_name: "",
  bank_account_last4: "",
  bank_ifsc: "",
  declaration_information_accurate: false,
  declaration_safety_commitment: false,
  ...emptyOnboardingSafetyAcks(),
});

/** Sign-in / invite phone for the read-only personal phone field. */
function resolveOnboardingPersonalPhone(
  techPhone: string | null | undefined,
  userPhone: string | null | undefined,
  invitePhone: string | null | undefined,
): string {
  return (
    techPhone?.trim() ||
    userPhone?.trim() ||
    invitePhone?.trim() ||
    ""
  );
}

function withOnboardingPersonalPhone(
  form: FormFields,
  techPhone: string | null | undefined,
  userPhone: string | null | undefined,
  invitePhone: string | null | undefined,
): FormFields {
  const personal_phone = resolveOnboardingPersonalPhone(techPhone, userPhone, invitePhone) || form.personal_phone;
  return personal_phone === form.personal_phone ? form : { ...form, personal_phone };
}

function techToForm(t: TechnicianRow): FormFields {
  const a = readHome(t);
  const m = t.metadata;
  const declRaw =
    m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>).declarations : null;
  const decl =
    declRaw && typeof declRaw === "object" && !Array.isArray(declRaw)
      ? (declRaw as Record<string, unknown>)
      : {};
  return {
    ...emptyForm(),
    vendor_id: t.vendor_id ?? "",
    name_as_per_aadhaar: t.name_as_per_aadhaar ?? "",
    addr_line1: a.line1,
    addr_city: a.city,
    addr_state: a.state,
    addr_pincode: a.pincode,
    date_of_birth: t.date_of_birth ?? "",
    personal_phone: t.personal_phone ?? "",
    father_guardian_name: t.father_guardian_name ?? "",
    gender: (t.gender ?? "") as GenderFormField,
    contact_email: t.contact_email ?? "",
    emergency_contact_name: t.emergency_contact_name ?? "",
    emergency_contact_phone: t.emergency_contact_phone ?? "",
    pan_number: t.pan_number ?? "",
    aadhaar_last4: t.aadhaar_last4 ?? "",
    skills_text: t.skills?.join(", ") ?? "",
    experience_summary: t.experience_summary ?? "",
    years_experience: t.years_experience != null ? String(t.years_experience) : "",
    preferred_locations_text: t.preferred_work_locations?.[0]?.trim() ?? "",
    service_radius_km: t.service_radius_km != null ? String(t.service_radius_km) : "",
    flag_safety_training: t.flag_safety_training,
    flag_height_work_cert: t.flag_height_work_cert,
    flag_solar_cleaning_experience: t.flag_solar_cleaning_experience,
    other_skills: t.other_skills ?? "",
    safety_training_org: t.safety_training_org ?? "",
    bank_account_holder_name: t.bank_account_holder_name ?? "",
    bank_account_last4: t.bank_account_last4 ?? "",
    bank_ifsc: t.bank_ifsc ?? "",
    declaration_information_accurate: Boolean(decl["information_accurate"]),
    declaration_safety_commitment: Boolean(decl["safety_commitment"]),
    safety_ack_pre_start_checklist: Boolean(
      (decl.safety_acknowledgements as Record<string, unknown> | undefined)?.pre_start_checklist,
    ),
    safety_ack_job_start_code: Boolean(
      (decl.safety_acknowledgements as Record<string, unknown> | undefined)?.job_start_code,
    ),
    safety_ack_safety_measures: Boolean(
      (decl.safety_acknowledgements as Record<string, unknown> | undefined)?.safety_measures,
    ),
    safety_ack_reviewed_guidelines: Boolean(
      (decl.safety_acknowledgements as Record<string, unknown> | undefined)?.reviewed_guidelines,
    ),
  };
}

function existingDocPath(row: TechnicianRow | null | undefined, kind: TechnicianDocKind): string | null {
  if (!row) return null;
  if (kind === "aadhaar") return row.doc_aadhaar_url;
  if (kind === "pan") return row.doc_pan_url;
  if (kind === "passport_photo") return row.doc_passport_url;
  if (kind === "safety_certificate") return row.doc_safety_certificate_url;
  return row.doc_bank_proof_url;
}

export default function TechnicianOnboardingScreen() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormFields>(() => emptyForm());
  const [docs, setDocs] = useState<Record<TechnicianDocKind, PickedDoc | null>>({
    aadhaar: null,
    pan: null,
    bank_proof: null,
    passport_photo: null,
    safety_certificate: null,
  });

  const userQuery = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: async () => {
      await userApi.syncMyUserFromAuth(supabase!);
      return userApi.getMyUserRecord(supabase!);
    },
    enabled: Boolean(supabase),
  });

  const techQuery = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorsQuery = useQuery({
    queryKey: queryKeys.vendors.approvedDirectory(),
    queryFn: () => vendorApi.listApprovedVendors(supabase!),
    enabled: Boolean(supabase),
  });
  const inviteQuery = useQuery({
    queryKey: queryKeys.technicians.myInvite(),
    queryFn: () => technicianApi.technicianGetMyInvite(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorAccessQuery = useQuery({
    queryKey: [...queryKeys.technicians.me(), "vendor-access"] as const,
    queryFn: () => technicianApi.technicianHasVendorOnboardingAccess(supabase!),
    enabled: Boolean(supabase),
  });

  const tech = techQuery.data;
  const invite = inviteQuery.data;
  const lockedVendorId = invite?.vendor_id ?? "";
  const vendors = vendorsQuery.data ?? [];

  const hydratedTechId = useRef<string | null>(null);

  useEffect(() => {
    if (!tech?.id || tech.verification_status === "verified") return;
    if (hydratedTechId.current === tech.id) return;
    hydratedTechId.current = tech.id;

    const m = tech.metadata;
    if (m && typeof m === "object" && !Array.isArray(m)) {
      const raw = (m as Record<string, Json>).registration_draft;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const formRaw = (raw as { form?: unknown }).form;
        const stepRaw = (raw as { step?: unknown }).step;
        if (formRaw && typeof formRaw === "object" && !Array.isArray(formRaw)) {
          setForm(
            withOnboardingPersonalPhone(
              { ...emptyForm(), ...(formRaw as FormFields) },
              tech.personal_phone,
              userQuery.data?.phone,
              invite?.invite_phone_e164,
            ),
          );
        }
        if (typeof stepRaw === "number" && stepRaw >= 0) {
          setStep(Math.min(stepRaw, STEPS.length - 1));
        }
        return;
      }
    }
    setForm(
      withOnboardingPersonalPhone(
        techToForm(tech),
        tech.personal_phone,
        userQuery.data?.phone,
        invite?.invite_phone_e164,
      ),
    );
  }, [
    tech?.id,
    tech?.verification_status,
    tech?.metadata,
    tech?.personal_phone,
    userQuery.data?.phone,
    invite?.invite_phone_e164,
  ]);

  useEffect(() => {
    if (!lockedVendorId) return;
    setForm((prev) => (prev.vendor_id === lockedVendorId ? prev : { ...prev, vendor_id: lockedVendorId }));
  }, [lockedVendorId]);

  useEffect(() => {
    const personal_phone = resolveOnboardingPersonalPhone(
      tech?.personal_phone,
      userQuery.data?.phone,
      invite?.invite_phone_e164,
    );
    if (!personal_phone) return;
    setForm((f) => (f.personal_phone === personal_phone ? f : { ...f, personal_phone }));
  }, [tech?.personal_phone, userQuery.data?.phone, invite?.invite_phone_e164]);

  const employerVendorId = form.vendor_id.trim() || lockedVendorId || tech?.vendor_id?.trim() || "";
  const employerVendor = useMemo(
    () => (employerVendorId ? vendors.find((v) => v.id === employerVendorId) : undefined),
    [vendors, employerVendorId],
  );
  const employerDisplayName = useMemo(
    () => readEmployerDisplayName(employerVendor, invite?.metadata),
    [employerVendor, invite?.metadata],
  );

  const pickDoc = useCallback(async (kind: TechnicianDocKind) => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setDocs((d) => ({
      ...d,
      [kind]: { uri: a.uri, name: a.name ?? "document", mime: a.mimeType ?? null },
    }));
  }, []);

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Missing Supabase");
      if (!form.vendor_id.trim()) throw new Error("Select your employer vendor.");
      if (invite && form.vendor_id.trim() !== invite.vendor_id) {
        throw new Error("Your employer is locked to the vendor that invited you.");
      }
      if (!invite && !tech) {
        throw new Error("Your vendor must invite you before you can submit a profile.");
      }

      const preferredCity = parsePreferredWorkCity(form.preferred_locations_text);
      if (!preferredCity) {
        throw new Error("Enter one preferred work city only (no commas or multiple cities).");
      }

      if (!form.flag_solar_cleaning_experience) {
        throw new Error("Solar panel cleaning experience is required.");
      }

      const yexp = parseYearsExperience(form.years_experience);
      if (form.flag_solar_cleaning_experience && yexp === null) {
        throw new Error("Enter years of solar panel cleaning experience.");
      }

      const radius = form.service_radius_km.trim();
      const rkm = radius === "" ? null : Number.parseFloat(radius);
      if (radius !== "" && (rkm === null || Number.isNaN(rkm))) throw new Error("Service radius must be a number.");

      if (!form.father_guardian_name.trim()) throw new Error("Father / guardian name is required.");
      if (!form.name_as_per_aadhaar.trim()) throw new Error("Name as per Aadhaar is required.");
      const dobRaw = form.date_of_birth.trim();
      if (!dobRaw) throw new Error("Date of birth is required.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) throw new Error("Enter a valid date of birth.");
      if (!form.gender) throw new Error("Select gender.");
      if (!allOnboardingSafetyAcksChecked(form)) {
        throw new Error("Confirm all safety awareness items on the Safety step.");
      }
      if (!form.declaration_information_accurate || !form.declaration_safety_commitment) {
        throw new Error("Confirm both declarations on the Safety step.");
      }

      const paths: Partial<Record<TechnicianDocKind, string>> = {};
      for (const kind of [
        "aadhaar",
        "pan",
        "bank_proof",
        "passport_photo",
        "safety_certificate",
      ] as TechnicianDocKind[]) {
        const picked = docs[kind];
        if (picked) {
          const buf = await fetch(picked.uri).then((r) => r.arrayBuffer());
          paths[kind] = await uploadTechnicianDocument(supabase, buf, kind, picked.name, picked.mime ?? undefined);
        } else {
          const ex = existingDocPath(tech, kind);
          if (ex) paths[kind] = ex;
        }
      }
      for (const kind of ["aadhaar", "pan", "bank_proof", "passport_photo"] as TechnicianDocKind[]) {
        if (!paths[kind]) throw new Error(`Attach ${kind.replace(/_/g, " ")}.`);
      }

      const skills = splitCsv(form.skills_text);
      if (skills.length === 0) throw new Error("Add at least one skill.");

      if (!form.bank_account_holder_name.trim()) {
        throw new Error("Account holder name is required.");
      }
      if (!/^\d{4}$/.test(form.bank_account_last4.trim())) {
        throw new Error("Enter the last 4 digits of your account number.");
      }
      const bankIfsc = parseBankIfsc(form.bank_ifsc);
      if (!bankIfsc) {
        throw new Error("Enter an 11-character IFSC code (letters and numbers, e.g. HDFC0001234).");
      }

      const userPhone = userQuery.data?.phone?.trim() ?? "";

      await technicianApi.submitTechnicianOnboarding(supabase, {
        vendor_id: form.vendor_id.trim(),
        name_as_per_aadhaar: form.name_as_per_aadhaar.trim(),
        skills,
        service_radius_km: rkm,
        home_base_address: {
          line1: form.addr_line1.trim(),
          city: form.addr_city.trim(),
          state: form.addr_state.trim(),
          pincode: form.addr_pincode.trim(),
          country: "India",
        },
        date_of_birth: dobRaw,
        personal_phone: userPhone || form.personal_phone.trim() || null,
        father_guardian_name: form.father_guardian_name.trim(),
        gender: form.gender,
        contact_email: form.contact_email.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        aadhaar_last4: form.aadhaar_last4.trim() || null,
        pan_number: form.pan_number.trim() || null,
        doc_aadhaar_url: paths.aadhaar!,
        doc_pan_url: paths.pan!,
        doc_bank_proof_url: paths.bank_proof!,
        doc_passport_url: paths.passport_photo!,
        doc_safety_certificate_url: paths.safety_certificate ?? null,
        experience_summary: form.experience_summary.trim() || null,
        years_experience: yexp,
        preferred_work_locations: [preferredCity],
        flag_safety_training: form.flag_safety_training,
        flag_height_work_cert: form.flag_height_work_cert,
        flag_solar_cleaning_experience: form.flag_solar_cleaning_experience,
        other_skills: form.other_skills.trim() || null,
        safety_training_org: form.safety_training_org.trim() || null,
        bank_account_holder_name: form.bank_account_holder_name.trim(),
        bank_account_last4: form.bank_account_last4.trim(),
        bank_ifsc: bankIfsc,
        declaration_information_accurate: form.declaration_information_accurate,
        declaration_safety_commitment: form.declaration_safety_commitment,
        safety_ack_pre_start_checklist: form.safety_ack_pre_start_checklist,
        safety_ack_job_start_code: form.safety_ack_job_start_code,
        safety_ack_safety_measures: form.safety_ack_safety_measures,
        safety_ack_reviewed_guidelines: form.safety_ack_reviewed_guidelines,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.technicians.me() });
      setDocs({ aadhaar: null, pan: null, bank_proof: null, passport_photo: null, safety_certificate: null });
      router.replace("/pending-vendor-review" as Href);
    },
    onError: (e: unknown) => {
      Alert.alert("Could not submit", e instanceof Error ? e.message : "Try again.");
    },
  });

  const saveDraftMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Missing Supabase");
      const formJson = JSON.parse(JSON.stringify(form)) as Json;
      return technicianApi.saveTechnicianOnboardingDraft(supabase, {
        form: formJson,
        stepIndex: step,
        vendorId: form.vendor_id.trim() || null,
      });
    },
    onSuccess: (row) => {
      qc.setQueryData(queryKeys.technicians.me(), row);
      Alert.alert("Draft saved", "You can sign out and continue registration later.");
    },
    onError: (e: unknown) => {
      Alert.alert("Could not save draft", e instanceof Error ? e.message : "Try again.");
    },
  });

  const user = userQuery.data;
  const wrongRole = user && user.role !== "technician";

  const setField = <K extends keyof FormFields>(key: K, value: FormFields[K]) => {
    setForm((f: FormFields) => ({ ...f, [key]: value }));
  };

  const selectVendor = (v: VendorRow) => {
    if (lockedVendorId) return;
    setField("vendor_id", v.id);
  };

  if (!supabase) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <Text style={styles.body}>Configure Supabase environment variables.</Text>
      </Screen>
    );
  }

  if (userQuery.isPending || techQuery.isPending || vendorAccessQuery.isPending) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }

  if (vendorAccessQuery.data === false) {
    return <Redirect href="/vendor-not-onboarded" />;
  }

  if (wrongRole) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <Text style={styles.title}>Partner profile</Text>
        <Text style={styles.body}>
          This account is not set up for field partner work on OorjaMan. Sign out and use partner sign-in so new
          accounts receive the partner role on first sign-up.
        </Text>
        <View style={styles.sectionTop}>
          <Button
            variant="primary"
            size="lg"
            onPress={async () => {
              await authApi.signOut(supabase!);
              router.replace("/login");
            }}
          >
            Back to sign in
          </Button>
        </View>
      </Screen>
    );
  }

  if (technicianApi.technicianShowsPendingReviewScreen(tech)) {
    return <Redirect href="/pending-vendor-review" />;
  }

  /** Must match `(main)/_layout.tsx` and `resolveTechnicianAppPostAuthPath` - platform + employer approval. */
  const hasActiveDraft = technicianApi.technicianHasActiveOnboardingDraft(tech);
  const canAccessMainApp =
    technicianApi.technicianIsFullyOnboarded(tech) && !hasActiveDraft;

  if (canAccessMainApp) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <Text style={styles.title}>You’re verified</Text>
        <Text style={styles.body}>You can access assigned jobs.</Text>
        <View style={styles.sectionTop}>
          <Button
            variant="primary"
            size="lg"
            onPress={() => router.replace("/(main)/jobs")}
          >
            Continue to jobs
          </Button>
        </View>
      </Screen>
    );
  }

  const employerVendors = lockedVendorId ? vendors.filter((v) => v.id === lockedVendorId) : vendors;

  const aadhaarCopyReady =
    Boolean(docs.aadhaar) || Boolean(existingDocPath(tech, "aadhaar"));
  const panCopyReady = Boolean(docs.pan) || Boolean(existingDocPath(tech, "pan"));
  const passportReady =
    Boolean(docs.passport_photo) || Boolean(existingDocPath(tech, "passport_photo"));
  const bankProofReady =
    Boolean(docs.bank_proof) || Boolean(existingDocPath(tech, "bank_proof"));
  const bankStepReady = stepBankCanProceed(form, bankProofReady);
  const bankStepMissing = step === STEPS.length - 1 ? bankStepMissingLabels(form, bankProofReady) : [];

  const canNext =
    step === 0
      ? Boolean(
        form.vendor_id &&
        form.name_as_per_aadhaar.trim() &&
        /^\d{4}-\d{2}-\d{2}$/.test(form.date_of_birth.trim()) &&
        form.addr_line1.trim() &&
        form.father_guardian_name.trim() &&
        form.gender,
      )
      : step === 1
        ? Boolean(
          form.pan_number.trim() &&
          form.aadhaar_last4.trim().length === 4 &&
          aadhaarCopyReady &&
          panCopyReady &&
          passportReady,
        )
        : step === 2
          ? stepSkillsCanProceed(form)
          : step === 3
            ? stepSafetyCanProceed(form)
            : step === 4
              ? bankStepReady
              : true;

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: "padding", android: undefined })}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
      <AppScaffold
        edges={SCREEN_EDGES_FULL_SCREEN}
        header={
          <>
            <Text style={styles.title}>Partner onboarding</Text>
            <Text style={styles.stepLabel}>
              Step {step + 1} of {STEPS.length}: {STEPS[step]}
            </Text>
          </>
        }
        footer={
          <View style={styles.navRow}>
            {step > 0 ? (
              <Button variant="outline" size="md" onPress={back}>
                Back
              </Button>
            ) : (
              <View style={styles.flexFill} />
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" size="md" disabled={!canNext} onPress={next}>
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                loading={submitMut.isPending}
                disabled={submitMut.isPending || !bankStepReady}
                onPress={() => void submitMut.mutateAsync()}
              >
                Submit profile
              </Button>
            )}
          </View>
        }
      >

        {tech?.verification_status === "rejected" && tech.verification_rejection_reason ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Previous decision</Text>
            <Text style={styles.bannerBody}>{tech.verification_rejection_reason}</Text>
          </View>
        ) : null}

        {tech && tech.verification_status === "draft" ? (
          <Text style={styles.notice}>Draft saved on the server - finish and submit when you are ready.</Text>
        ) : null}

        {tech?.vendor_review_status === "rejected" && tech.vendor_rejection_reason ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Vendor review update</Text>
            <Text style={styles.bannerBody}>{tech.vendor_rejection_reason}</Text>
          </View>
        ) : null}

        {lockedVendorId ? (
          <Text style={styles.notice}>
            Vendor invite detected. Your employer is locked to the inviting vendor for this onboarding.
          </Text>
        ) : null}

        {step === 0 ? (
          <>
            <Text style={styles.sectionLabel}>Employer vendor *</Text>
            {vendorsQuery.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : vendorsQuery.isError ? (
              <Text style={styles.err}>Could not load vendors. Check connection.</Text>
            ) : employerVendors.length > 0 ? (
              <View style={styles.vendorList}>
                {employerVendors.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => selectVendor(v)}
                    disabled={Boolean(lockedVendorId)}
                    style={[
                      styles.vendorChip,
                      form.vendor_id === v.id && styles.vendorChipOn,
                      lockedVendorId && v.id !== form.vendor_id && styles.vendorChipDisabled,
                    ]}
                  >
                    <Text style={[styles.vendorName, form.vendor_id === v.id && styles.vendorNameOn]}>
                      {v.business_name}
                    </Text>
                    {v.trade_name ? <Text style={styles.vendorSub}>{v.trade_name}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : lockedVendorId ? (
              <View style={[styles.vendorChip, styles.vendorChipOn]}>
                <Text style={[styles.vendorName, styles.vendorNameOn]}>Employer assigned by your vendor</Text>
                {invite?.full_name ? <Text style={styles.vendorSub}>{invite.full_name}</Text> : null}
              </View>
            ) : (
              <Text style={styles.err}>
                No employer invite found for this phone. Ask your vendor to add you from the partner portal.
              </Text>
            )}
            <Field
              label="Name as per Aadhaar *"
              value={form.name_as_per_aadhaar}
              onChangeText={(t) => setField("name_as_per_aadhaar", t)}
              placeholder="Must match your ID document"
            />
            <Field label="Home base - line 1 *" value={form.addr_line1} onChangeText={(t) => setField("addr_line1", t)} />
            <Field label="City" value={form.addr_city} onChangeText={(t) => setField("addr_city", t)} />
            <Field label="State" value={form.addr_state} onChangeText={(t) => setField("addr_state", t)} />
            <Field label="PIN code" value={form.addr_pincode} onChangeText={(t) => setField("addr_pincode", t)} keyboardType="number-pad" />
            <DobField value={form.date_of_birth} onChangeIso={(iso) => setField("date_of_birth", iso)} />
            <Field
              label="Personal phone (from your invite)"
              helperText="This number is your sign-in phone - it cannot be changed here."
              value={form.personal_phone}
              editable={false}
              keyboardType="phone-pad"
            />
            <Field label="Emergency contact name" value={form.emergency_contact_name} onChangeText={(t) => setField("emergency_contact_name", t)} />
            <Field
              label="Emergency contact phone"
              value={form.emergency_contact_phone}
              onChangeText={(t) => setField("emergency_contact_phone", t)}
              keyboardType="phone-pad"
            />
            <Field
              label="Father / guardian name *"
              value={form.father_guardian_name}
              onChangeText={(t) => setField("father_guardian_name", t)}
            />
            <Text style={styles.sectionLabel}>Gender *</Text>
            <View style={styles.vendorList}>
              {GENDER_OPTIONS.map((g) => (
                <Pressable
                  key={g.value}
                  onPress={() => setField("gender", g.value)}
                  style={[styles.vendorChip, form.gender === g.value && styles.vendorChipOn]}
                >
                  <Text style={[styles.vendorName, form.gender === g.value && styles.vendorNameOn]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="Contact email (optional)"
              value={form.contact_email}
              onChangeText={(t) => setField("contact_email", t)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="PAN number *" value={form.pan_number} onChangeText={(t) => setField("pan_number", t)} autoCapitalize="characters" />
            <Field label="Aadhaar last 4 digits *" value={form.aadhaar_last4} onChangeText={(t) => setField("aadhaar_last4", t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" />
            <Text style={styles.hint}>Upload scans or PDFs (max 10 MB).</Text>
            {(["aadhaar", "pan", "passport_photo"] as TechnicianDocKind[]).map((kind) => (
              <View key={kind} style={styles.docRow}>
                <View style={styles.flexFill}>
                  <Text style={styles.docTitle}>
                    {kind === "aadhaar"
                      ? "Aadhaar copy *"
                      : kind === "pan"
                        ? "PAN copy *"
                        : "Passport-size photograph *"}
                  </Text>
                  <Text style={styles.docMeta}>
                    {docs[kind]?.name ?? existingDocPath(tech, kind) ?? "No file"}
                  </Text>
                </View>
                <Button variant="outline" size="sm" onPress={() => void pickDoc(kind)}>
                  Choose
                </Button>
              </View>
            ))}
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field
              label="Skills (comma-separated) *"
              value={form.skills_text}
              onChangeText={(t) => setField("skills_text", t)}
              placeholder="e.g. rope access, water-fed poles"
            />
            <ToggleRow
              label="Solar panel cleaning experience *"
              value={form.flag_solar_cleaning_experience}
              onValueChange={(v) => {
                setField("flag_solar_cleaning_experience", v);
                if (!v) setField("years_experience", "");
              }}
            />
            {form.flag_solar_cleaning_experience ? (
              <Field
                label="Years of solar panel cleaning experience *"
                value={form.years_experience}
                onChangeText={(t) => setField("years_experience", t)}
                keyboardType="decimal-pad"
                placeholder="e.g. 3"
              />
            ) : (
              <Text style={styles.hint}>Turn on solar panel cleaning experience to enter your years in this field.</Text>
            )}
            <Field
              label="Preferred work city *"
              value={form.preferred_locations_text}
              onChangeText={(t) => setField("preferred_locations_text", t.replace(/[,;\n]+/g, " ").trimStart())}
              placeholder="e.g. Bengaluru"
            />
            <Text style={styles.hint}>Enter one city only - not a list of areas or districts.</Text>
            <Field label="Experience summary (optional)" value={form.experience_summary} onChangeText={(t) => setField("experience_summary", t)} multiline />
            <Field label="Service radius (km)" value={form.service_radius_km} onChangeText={(t) => setField("service_radius_km", t)} keyboardType="decimal-pad" />
            <Field
              label="Other skills (optional)"
              value={form.other_skills}
              onChangeText={(t) => setField("other_skills", t)}
              multiline
              placeholder="e.g. electrical basics, inverter checks"
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.sectionTitle}>Safety awareness *</Text>
            <Text style={styles.hint}>
              These match how you start jobs in the OorjaMan app - confirm each item to continue.
            </Text>
            {ONBOARDING_SAFETY_ACKS.map((item) => (
              <ToggleRow
                key={item.key}
                label={item.label}
                value={form[item.key as OnboardingSafetyAckKey]}
                onValueChange={(v) => setField(item.key as OnboardingSafetyAckKey, v)}
              />
            ))}
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Declarations *</Text>
            <ToggleRow
              label="I confirm my information is accurate"
              value={form.declaration_information_accurate}
              onValueChange={(v) => setField("declaration_information_accurate", v)}
            />
            <ToggleRow
              label="I will follow on-site safety protocols"
              value={form.declaration_safety_commitment}
              onValueChange={(v) => setField("declaration_safety_commitment", v)}
            />
            <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Certifications (optional)</Text>
            <Text style={styles.hint}>
              Add training details if you have them. Your employer may request certificates later.
            </Text>
            <ToggleRow
              label="I have completed formal safety training"
              value={form.flag_safety_training}
              onValueChange={(v) => {
                setField("flag_safety_training", v);
                if (!v) {
                  setField("safety_training_org", "");
                } else if (employerDisplayName && !form.safety_training_org.trim()) {
                  setField("safety_training_org", employerDisplayName);
                }
              }}
            />
            {form.flag_safety_training ? (
              <>
                <Field
                  label="Safety training organisation (optional)"
                  helperText="e.g. your employer or training provider"
                  value={form.safety_training_org}
                  onChangeText={(t) => setField("safety_training_org", t)}
                />
                <View style={styles.docRow}>
                  <View style={styles.flexFill}>
                    <Text style={styles.docTitle}>Safety training certificate (optional)</Text>
                    <Text style={styles.docMeta}>
                      {docs.safety_certificate?.name ??
                        existingDocPath(tech, "safety_certificate") ??
                        "No file attached"}
                    </Text>
                  </View>
                  <Button variant="outline" size="sm" onPress={() => void pickDoc("safety_certificate")}>
                    Choose
                  </Button>
                </View>
              </>
            ) : null}
            <ToggleRow
              label="Height / rope-work certification"
              value={form.flag_height_work_cert}
              onValueChange={(v) => setField("flag_height_work_cert", v)}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Field
              label="Account holder name *"
              value={form.bank_account_holder_name}
              onChangeText={(t) => setField("bank_account_holder_name", t)}
            />
            <Field
              label="Account number (last 4 digits) *"
              value={form.bank_account_last4}
              onChangeText={(t) => setField("bank_account_last4", t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
            />
            <Field
              label="IFSC *"
              value={form.bank_ifsc}
              onChangeText={(t) => setField("bank_ifsc", t.replace(/\s/g, "").toUpperCase().slice(0, 11))}
              autoCapitalize="characters"
              placeholder="e.g. HDFC0001234"
            />
            <Text style={styles.hint}>Upload a cancelled cheque or bank statement (max 10 MB).</Text>
            <View style={styles.docRow}>
              <View style={styles.flexFill}>
                <Text style={styles.docTitle}>Bank proof *</Text>
                <Text style={styles.docMeta}>{docs.bank_proof?.name ?? existingDocPath(tech, "bank_proof") ?? "No file"}</Text>
              </View>
              <Button variant="outline" size="sm" onPress={() => void pickDoc("bank_proof")}>
                Choose
              </Button>
            </View>
            {bankStepMissing.length > 0 ? (
              <Text style={styles.err}>
                Still needed: {bankStepMissing.join(", ")}.
              </Text>
            ) : null}
          </>
        ) : null}

        <View style={styles.footerSecondaryActions}>
          <Button
            variant="outline"
            size="md"
            loading={saveDraftMut.isPending}
            disabled={saveDraftMut.isPending}
            onPress={() => void saveDraftMut.mutateAsync()}
          >
            Save & complete later
          </Button>
          <Button
            variant="primary"
            size="md"
            onPress={() => void authApi.signOut(supabase!).then(() => router.replace("/login"))}
          >
            Sign out
          </Button>
        </View>
      </AppScaffold>
    </KeyboardAvoidingView>
  );
}

function DobField({ value, onChangeIso }: { value: string; onChangeIso: (iso: string) => void }) {
  const [show, setShow] = useState(false);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const asDate = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(1995, 0, 15);

  const formatDisplay = (iso: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) return "";
    const [y, m, d] = iso.split("-").map((x) => Number.parseInt(x, 10));
    try {
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.fieldWrap}>
        <Input
          label="Date of birth *"
          value={value}
          placeholder="YYYY-MM-DD"
          onChangeText={onChangeIso}
          keyboardType="default"
        />
        <Text style={styles.hint}>Use your device app for a calendar picker, or type the date as shown.</Text>
      </View>
    );
  }

  return (
    <View style={styles.fieldWrap}>
      <Pressable
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose date of birth"
      >
        <View pointerEvents="none">
          <Input
            label="Date of birth *"
            value={value.trim() ? formatDisplay(value) : ""}
            placeholder="Tap to choose"
            editable={false}
          />
        </View>
      </Pressable>
      {show ? (
        <>
          <DateTimePicker
            value={asDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={new Date()}
            minimumDate={new Date(1920, 0, 1)}
            onChange={(ev: DateTimePickerEvent, date?: Date) => {
              if (Platform.OS === "android") {
                setShow(false);
                if (ev.type === "dismissed") return;
              }
              if (!date) return;
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              onChangeIso(`${y}-${m}-${d}`);
            }}
          />
          {Platform.OS === "ios" ? (
            <View style={styles.dobDoneRow}>
              <Button variant="outline" size="sm" onPress={() => setShow(false)}>
                Done
              </Button>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  editable = true,
  helperText,
}: {
  label: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad" | "number-pad" | "decimal-pad" | "email-address";
  autoCapitalize?: "none" | "sentences" | "characters";
  editable?: boolean;
  helperText?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Input
        label={label}
        helperText={helperText}
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText ?? (() => { })}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        editable={editable}
      />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primaryMuted }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    color: colors.foreground,
  },
  stepLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  notice: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  banner: {
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.destructive,
    marginBottom: spacing.sm,
  },
  bannerTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  bannerBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: 4,
    color: colors.foreground,
  },
  vendorList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  vendorChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  vendorChipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.muted,
  },
  vendorChipDisabled: {
    opacity: 0.5,
  },
  vendorName: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  vendorNameOn: {
    color: colors.primary,
  },
  vendorSub: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  err: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.destructive,
  },
  fieldWrap: {
    marginBottom: spacing.sm,
  },
  dobDoneRow: {
    marginTop: spacing.sm,
    alignItems: "flex-end",
  },
  fieldLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingVertical: 4,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  docTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  docMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  loading: {
    marginTop: spacing.lg,
  },
  sectionTop: {
    marginTop: spacing.md,
  },
  footerSecondaryActions: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  waitingActions: {
    gap: spacing.sm,
  },
  flexFill: {
    flex: 1,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
  },
});
