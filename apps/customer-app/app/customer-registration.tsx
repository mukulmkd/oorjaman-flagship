import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Redirect, router } from "expo-router";
import { customerApi, queryKeys, userApi } from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, FadeInView, Input, Screen, SCREEN_EDGES_FULL_SCREEN } from "@oorjaman/ui";
import { Ionicons } from "@expo/vector-icons";
import { fontFamily, fontSize, fontWeight } from "../constants/fonts";
import {
  ACCESS_OPTS,
  type Addr,
  INSTALL_CATEGORIES,
  ROOF_MATERIALS,
  ROOF_TYPES,
  WATER_OPTS,
  addrToJson,
  customerRowToProfileForm,
} from "../lib/customer-site-profile";
import { supabase } from "../lib/supabase";

const STEPS = ["About you", "Address", "Location", "Solar & site", "Safety & terms"] as const;

export default function CustomerRegistrationScreen() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [addr, setAddr] = useState<Addr>({
    label: "",
    line1: "",
    line2: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
  });
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracyM, setAccuracyM] = useState<number | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [panels, setPanels] = useState("");
  const [installationCategory, setInstallationCategory] = useState<"" | "residential" | "commercial">("");
  const [roofMaterial, setRoofMaterial] = useState<"" | "tin_metal" | "rcc" | "mixed" | "other">("");
  const [roofType, setRoofType] = useState("");
  const [roofAccess, setRoofAccess] = useState("");
  const [water, setWater] = useState("");
  const [hazards, setHazards] = useState("");
  const [lastCleaning, setLastCleaning] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [panelBrand, setPanelBrand] = useState("");
  const [inverterBrand, setInverterBrand] = useState("");
  const [epcVendorName, setEpcVendorName] = useState("");
  const [consentAccurate, setConsentAccurate] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentContact, setConsentContact] = useState(false);

  const userQuery = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const custQuery = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase),
  });

  const customer = custQuery.data;

  useEffect(() => {
    if (customer && !customer.onboarding_completed_at) {
      const f = customerRowToProfileForm(customer);
      setDisplayName(f.display_name);
      setContactEmail(f.contact_email);
      setAlternatePhone(f.alternate_phone);
      setAddr(f.addr);
      setCapacity(f.capacity);
      setPanels(f.panels);
      setInstallationCategory(f.installationCategory || "");
      setRoofMaterial(f.roofMaterial || "");
      setRoofType(f.roofType);
      setRoofAccess(f.roofAccess);
      setWater(f.water);
      setHazards(f.hazards);
      setLastCleaning(f.lastCleaning);
      setSpecialInstructions(f.specialInstructions);
      setPanelBrand(f.panelBrand);
      setInverterBrand(f.inverterBrand);
      setEpcVendorName(f.epcVendorName);
      if (f.lat != null && f.lng != null) {
        setLat(f.lat);
        setLng(f.lng);
        setAccuracyM(f.accuracyM);
      }
    }
  }, [customer?.id]);

  const wrongRole = userQuery.data && userQuery.data.role !== "customer";

  const submitMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Missing Supabase");
      const cap = capacity.trim();
      const pan = panels.trim();
      const capN = cap === "" ? null : Number.parseFloat(cap);
      const panN = pan === "" ? null : Number.parseInt(pan, 10);
      if (capN === null || Number.isNaN(capN) || capN <= 0) throw new Error("Enter a valid system capacity (kW).");
      if (panN === null || Number.isNaN(panN) || panN <= 0) throw new Error("Enter a valid panel count.");
      if (!installationCategory) throw new Error("Select residential or commercial.");
      if (!roofMaterial) throw new Error("Select roof structure (Tin / RCC / etc.).");
      if (!roofType) throw new Error("Select a roof layout.");
      if (!roofAccess) throw new Error("Select roof access.");
      if (!water) throw new Error("Select water availability.");
      if (!consentAccurate || !consentTerms || !consentContact) {
        throw new Error("Confirm all service terms to continue.");
      }
      if (!addr.label.trim()) throw new Error("Enter a short site label (e.g. Home, Factory).");

      let lastCleaningIso: string | null = null;
      const lc = lastCleaning.trim();
      if (lc.length > 0) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(lc)) {
          throw new Error("Last cleaning: use YYYY-MM-DD or leave blank.");
        }
        const d = Date.parse(`${lc}T12:00:00`);
        if (Number.isNaN(d)) throw new Error("Last cleaning: invalid date.");
        lastCleaningIso = lc;
      }

      await customerApi.completeCustomerOnboarding(supabase, {
        display_name: displayName.trim(),
        contact_email: contactEmail.trim() || null,
        alternate_phone: alternatePhone.trim() || null,
        billing_address: addrToJson(addr),
        service_default_address: addrToJson(addr),
        service_lat: lat,
        service_lng: lng,
        location_accuracy_m: accuracyM,
        solar_capacity_kw: capN,
        solar_panel_count: panN,
        installation_category: installationCategory,
        solar_roof_type: roofType,
        solar_roof_material: roofMaterial,
        last_cleaning_at: lastCleaningIso,
        safety_roof_access: roofAccess,
        safety_water_availability: water,
        safety_hazards: hazards.trim() || null,
        special_instructions: specialInstructions.trim() || null,
        registration_consents: {
          information_accurate: consentAccurate,
          terms_safety_privacy: consentTerms,
          contact_for_scheduling: consentContact,
        },
        panel_brand: panelBrand.trim() || null,
        inverter_brand: inverterBrand.trim() || null,
        epc_vendor_name: epcVendorName.trim() || null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
      router.replace("/(main)");
    },
    onError: (e: unknown) => {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again.");
    },
  });

  const captureLocation = useCallback(async () => {
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Location helps crews find your site. You can continue without it.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setAccuracyM(pos.coords.accuracy ?? null);
    } catch (e: unknown) {
      Alert.alert("Location error", e instanceof Error ? e.message : "Could not read GPS.");
    } finally {
      setLocBusy(false);
    }
  }, []);

  const clearLocation = useCallback(() => {
    setLat(null);
    setLng(null);
    setAccuracyM(null);
  }, []);

  const canNext = useMemo(() => {
    if (step === 0) return displayName.trim().length > 0;
    if (step === 1)
      return (
        addr.label.trim().length > 0 &&
        addr.line1.trim().length > 0 &&
        addr.city.trim().length > 0 &&
        addr.state.trim().length > 0 &&
        addr.pincode.trim().length >= 4
      );
    if (step === 2) return true;
    if (step === 3) {
      const cap = Number.parseFloat(capacity);
      const pan = Number.parseInt(panels, 10);
      return (
        !Number.isNaN(cap) &&
        cap > 0 &&
        !Number.isNaN(pan) &&
        pan > 0 &&
        installationCategory.length > 0 &&
        roofMaterial.length > 0 &&
        roofType.length > 0
      );
    }
    return (
      roofAccess.length > 0 &&
      water.length > 0 &&
      consentAccurate &&
      consentTerms &&
      consentContact
    );
  }, [
    step,
    displayName,
    addr,
    capacity,
    panels,
    installationCategory,
    roofMaterial,
    roofType,
    roofAccess,
    water,
    consentAccurate,
    consentTerms,
    consentContact,
  ]);

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!supabase) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <Text style={styles.muted}>Configure Supabase.</Text>
      </Screen>
    );
  }

  if (userQuery.isPending || custQuery.isPending) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }

  if (wrongRole) {
    return (
      <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
        <Text style={styles.title}>Customer registration</Text>
        <Text style={styles.muted}>This flow is for customer accounts only.</Text>
        <View style={styles.sectionTop}>
          <Button variant="primary" size="lg" onPress={() => router.replace("/wrong-role")}>
            Sign out
          </Button>
        </View>
      </Screen>
    );
  }

  if (customer?.onboarding_completed_at) {
    return <Redirect href="/(main)" />;
  }

  return (
    <Screen edges={SCREEN_EDGES_FULL_SCREEN}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Your solar site</Text>
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.lede}>A few steps so we can match the right crew and equipment.</Text>

          <View style={styles.progressTrack}>
            {STEPS.map((_, i) => (
              <View
                key={`reg-step-${i}`}
                style={[styles.progressSeg, i <= step && styles.progressSegActive]}
              />
            ))}
          </View>
          <Text style={styles.stepMeta}>
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </Text>

          <FadeInView key={step} style={styles.stepBody}>
            {step === 0 ? (
              <>
                <Field label="Full name *" value={displayName} onChangeText={setDisplayName} placeholder="As on utility bill" />
                <Field
                  label="Email (optional)"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="For booking confirmations"
                />
                <Field
                  label="Alternate phone (optional)"
                  value={alternatePhone}
                  onChangeText={(t) => setAlternatePhone(t.replace(/\D/g, "").slice(0, 15))}
                  keyboardType="number-pad"
                  placeholder="Backup contact for the visit"
                />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <Field
                  label="Site label *"
                  value={addr.label}
                  onChangeText={(t) => setAddr((a) => ({ ...a, label: t }))}
                  placeholder="e.g. Home rooftop, Factory block A"
                />
                <Field label="Address line 1 *" value={addr.line1} onChangeText={(t) => setAddr((a) => ({ ...a, line1: t }))} />
                <Field label="Address line 2" value={addr.line2} onChangeText={(t) => setAddr((a) => ({ ...a, line2: t }))} />
                <Field label="City *" value={addr.city} onChangeText={(t) => setAddr((a) => ({ ...a, city: t }))} />
                <Field label="District" value={addr.district} onChangeText={(t) => setAddr((a) => ({ ...a, district: t }))} placeholder="Optional" />
                <Field label="State *" value={addr.state} onChangeText={(t) => setAddr((a) => ({ ...a, state: t }))} />
                <Field label="PIN code *" value={addr.pincode} onChangeText={(t) => setAddr((a) => ({ ...a, pincode: t.replace(/\D/g, "").slice(0, 6) }))} keyboardType="number-pad" />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <Text style={styles.blockText}>
                  Capture GPS for faster navigation and ETAs. You can skip if you prefer.
                </Text>
                {lat != null && lng != null ? (
                  <View style={styles.locCard}>
                    <Text style={styles.locTitle}>Captured</Text>
                    <Text style={styles.locCoords}>
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </Text>
                    {accuracyM != null ? (
                      <Text style={styles.locAcc}>±{Math.round(accuracyM)} m accuracy</Text>
                    ) : null}
                    <View style={styles.locActions}>
                      <Button variant="outline" size="sm" onPress={() => void captureLocation()}>
                        Refresh
                      </Button>
                      <Button variant="ghost" size="sm" onPress={clearLocation}>
                        Clear
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Button variant="primary" size="md" loading={locBusy} onPress={() => void captureLocation()}>
                    Use current location
                  </Button>
                )}
              </>
            ) : null}

            {step === 3 ? (
              <>
                <Field
                  label="Installed capacity (kW) *"
                  value={capacity}
                  onChangeText={setCapacity}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 5.5"
                />
                <Field
                  label="Panel count *"
                  value={panels}
                  onChangeText={(t) => setPanels(t.replace(/\D/g, ""))}
                  keyboardType="number-pad"
                  placeholder="e.g. 16"
                />
                <Text style={styles.fieldLabel}>Installation *</Text>
                <View style={styles.chipGrid}>
                  {INSTALL_CATEGORIES.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => setInstallationCategory(r.value)}
                      style={[styles.chip, installationCategory === r.value && styles.chipOn]}
                    >
                      <Text style={[styles.chipLabel, installationCategory === r.value && styles.chipLabelOn]}>
                        {r.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Roof structure *</Text>
                <Text style={styles.blockText}>Tin vs RCC (per site survey).</Text>
                <View style={styles.chipGrid}>
                  {ROOF_MATERIALS.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => setRoofMaterial(r.value)}
                      style={[styles.chip, roofMaterial === r.value && styles.chipOn]}
                    >
                      <Text style={[styles.chipLabel, roofMaterial === r.value && styles.chipLabelOn]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Roof layout *</Text>
                <View style={styles.chipGrid}>
                  {ROOF_TYPES.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => setRoofType(r.value)}
                      style={[styles.chip, roofType === r.value && styles.chipOn]}
                    >
                      <Text style={[styles.chipLabel, roofType === r.value && styles.chipLabelOn]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.blockText, { marginTop: spacing.md }]}>Equipment (optional - helps the crew)</Text>
                <Field label="Panel brand / model" value={panelBrand} onChangeText={setPanelBrand} placeholder="e.g. Waaree 540 W" />
                <Field label="Inverter brand" value={inverterBrand} onChangeText={setInverterBrand} placeholder="e.g. SolarEdge" />
                <Field
                  label="Original installer / EPC"
                  value={epcVendorName}
                  onChangeText={setEpcVendorName}
                  placeholder="Who installed the system"
                />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <Text style={styles.fieldLabel}>Roof access *</Text>
                <View style={styles.chipGrid}>
                  {ACCESS_OPTS.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => setRoofAccess(r.value)}
                      style={[styles.chip, roofAccess === r.value && styles.chipOn]}
                    >
                      <Text style={[styles.chipLabel, roofAccess === r.value && styles.chipLabelOn]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Water availability *</Text>
                <View style={styles.chipGrid}>
                  {WATER_OPTS.map((r) => (
                    <Pressable
                      key={r.value}
                      onPress={() => setWater(r.value)}
                      style={[styles.chip, water === r.value && styles.chipOn]}
                    >
                      <Text style={[styles.chipLabel, water === r.value && styles.chipLabelOn]}>{r.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Field
                  label="Electrical / access hazards (optional)"
                  value={hazards}
                  onChangeText={setHazards}
                  multiline
                  placeholder="Power lines nearby, fragile tiles, dogs on site…"
                />
                <Field
                  label="Last cleaning date (optional)"
                  value={lastCleaning}
                  onChangeText={(t) => setLastCleaning(t.replace(/[^\d-]/g, "").slice(0, 10))}
                  placeholder="YYYY-MM-DD"
                />
                <Field
                  label="Special instructions (optional)"
                  value={specialInstructions}
                  onChangeText={setSpecialInstructions}
                  multiline
                  placeholder="Access restrictions, height, inverter location, gate codes…"
                />
                <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Confirm to continue *</Text>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentAccurate }}
                  onPress={() => setConsentAccurate((v) => !v)}
                  style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
                >
                  <Ionicons
                    name={consentAccurate ? "checkbox" : "square-outline"}
                    size={24}
                    color={consentAccurate ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={styles.checkLabel}>My site information is accurate to the best of my knowledge.</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentTerms }}
                  onPress={() => setConsentTerms((v) => !v)}
                  style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
                >
                  <Ionicons
                    name={consentTerms ? "checkbox" : "square-outline"}
                    size={24}
                    color={consentTerms ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={styles.checkLabel}>I agree to service terms, safety guidance, and privacy practices.</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consentContact }}
                  onPress={() => setConsentContact((v) => !v)}
                  style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed]}
                >
                  <Ionicons
                    name={consentContact ? "checkbox" : "square-outline"}
                    size={24}
                    color={consentContact ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={styles.checkLabel}>Oorjaman may contact me to schedule or coordinate this service.</Text>
                </Pressable>
              </>
            ) : null}
          </FadeInView>

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
                disabled={submitMut.isPending || !canNext}
                onPress={() => void submitMut.mutateAsync()}
              >
                Finish
              </Button>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
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
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Input
        label={label}
        value={value}
        placeholder={placeholder}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
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
  },
  kicker: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  progressTrack: {
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.sm,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressSegActive: {
    backgroundColor: colors.primary,
  },
  stepMeta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  stepBody: {
    minHeight: 120,
  },
  blockText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: 6,
  },
  locCard: {
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.sm,
  },
  locTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  locCoords: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.foreground,
    marginTop: 4,
  },
  locAcc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  locActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.muted,
  },
  chipLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  chipLabelOn: {
    color: colors.primary,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  checkRowPressed: {
    opacity: 0.92,
  },
  checkLabel: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
  },
  fieldWrap: {
    marginBottom: spacing.sm,
  },
  loading: {
    marginTop: spacing.lg,
  },
  sectionTop: {
    marginTop: spacing.md,
  },
  flexFill: {
    flex: 1,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
});
