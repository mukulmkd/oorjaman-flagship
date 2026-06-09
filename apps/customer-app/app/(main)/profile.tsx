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
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ALLOWED_CAPACITY_KW,
  AMC_CAPACITY_CHANGE_DISCLAIMER,
  authApi,
  markUserInitiatedSignOut,
  countRawSitePhotoArray,
  customerApi,
  customerCapacityTierWillChangeAmc,
  formatInrFromCents,
  getCustomerOorjamanCreditsSummary,
  getCustomerSolarSizing,
  patchAddressEntryGps,
  queryKeys,
  readAddressEntryGps,
  readSubscriptionCapacityTierCode,
  snapProfileCapacityInputToAllowedKw,
  subscriptionApi,
  type AmcTierRealignmentSummary,
  userApi,
  vendorApi,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, Screen, SCREEN_EDGES_BENEATH_NATIVE_HEADER } from "@oorjaman/ui";
import { fontFamily, fontSize, fontWeight } from "../../constants/fonts";
import { ServiceAddressPickerSheet } from "../../components/service-address-picker-sheet";
import { SitePhotoGallerySection } from "../../components/site-photo-gallery-section";
import {
  buildAddressBookPatch,
  mergeServiceGpsIntoCustomerPatch,
  readPreferredVendorIdsForDefaultServiceLocation,
  readServiceAddressBook,
  serviceAddressFormatted,
  type ServiceAddressEntry,
  type ServiceAddressSaveExtras,
} from "../../lib/service-address-book";
import {
  activeSubscriptionForCurrentServiceSite,
  formatSubscriptionValidThrough,
} from "../../lib/customer-active-amc";
import {
  ACCESS_OPTS,
  type Addr,
  INSTALL_CATEGORIES,
  ROOF_MATERIALS,
  ROOF_TYPES,
  WATER_OPTS,
  addrToJson,
  customerRowToProfileForm,
  parseAddr,
} from "../../lib/customer-site-profile";
import { supabase } from "../../lib/supabase";

function formatAmcRealignmentAlertBody(rows: AmcTierRealignmentSummary[]): string {
  if (rows.length === 0) return "";
  return rows
    .map(
      (r) =>
        `${r.address_label}\n` +
        `• Plan: ${r.new_plan_name}\n` +
        `• Visits: ${r.previous_visits_included} → ${r.new_visits_included}\n` +
        `• Plan amount: ${formatInrFromCents(r.previous_amount_cents)} → ${formatInrFromCents(r.new_amount_cents)}`,
    )
    .join("\n\n");
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
  onChangeText?: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "number-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "sentences"}
        style={[styles.simpleInput, multiline && styles.simpleInputMultiline]}
        {...(Platform.OS === "android"
          ? {
              includeFontPadding: false,
              textAlignVertical: multiline ? "top" : "center",
            }
          : {})}
      />
    </View>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.accountRow}>
      <Text style={styles.accountLabel}>{label}</Text>
      <Text style={styles.accountValue}>{value.trim() ? value : "-"}</Text>
      <Text style={styles.accountHint}>Cannot be changed here</Text>
    </View>
  );
}

export default function ProfileTab() {
  const qc = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
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
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);

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

  const subsQuery = useQuery({
    queryKey: queryKeys.subscriptions.list(),
    queryFn: () => subscriptionApi.listVisibleSubscriptions(supabase!),
    enabled: Boolean(supabase),
  });

  const creditsQuery = useQuery({
    queryKey: queryKeys.finance.customerOorjamanCredits(),
    queryFn: () => getCustomerOorjamanCreditsSummary(supabase!),
    enabled: Boolean(supabase),
  });

  const vendorsDirQuery = useQuery({
    queryKey: queryKeys.vendors.approvedDirectory(),
    queryFn: () => vendorApi.listApprovedVendors(supabase!),
    enabled: Boolean(supabase && custQuery.data?.onboarding_completed_at),
  });

  const customer = custQuery.data;
  const user = userQuery.data;
  const addressBook = useMemo(() => readServiceAddressBook(customer ?? null), [customer]);
  const activeAmc = useMemo(
    () => activeSubscriptionForCurrentServiceSite(customer ?? null, subsQuery.data),
    [customer, subsQuery.data],
  );
  const profileSizing = useMemo(() => getCustomerSolarSizing(customer ?? null), [customer]);
  const amcTierMismatch = useMemo(() => {
    if (!activeAmc || !profileSizing.ready) return false;
    const subTier = readSubscriptionCapacityTierCode(activeAmc);
    return subTier != null && subTier !== profileSizing.tierCode;
  }, [activeAmc, profileSizing]);
  const selectedAddress = useMemo(
    () =>
      addressBook.defaultId
        ? addressBook.entries.find((e) => e.id === addressBook.defaultId) ?? null
        : null,
    [addressBook],
  );

  const rawSitePhotoCount = useMemo(() => {
    if (!customer?.metadata || !addressBook.defaultId) return 0;
    const m = customer.metadata as Record<string, unknown>;
    const rows = Array.isArray(m.service_addresses) ? m.service_addresses : [];
    const row = rows.find(
      (r) =>
        r &&
        typeof r === "object" &&
        !Array.isArray(r) &&
        (r as { id?: string }).id === addressBook.defaultId,
    ) as { site_photos?: unknown } | undefined;
    return countRawSitePhotoArray(row?.site_photos);
  }, [addressBook.defaultId, customer?.metadata]);

  const preferredPartnerSummary = useMemo(() => {
    const ids = readPreferredVendorIdsForDefaultServiceLocation(customer ?? null);
    if (ids.length === 0) return "None selected";
    const names = ids
      .map((id) => vendorsDirQuery.data?.find((x) => x.id === id)?.business_name?.trim() || id.slice(0, 8))
      .filter(Boolean);
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  }, [customer, vendorsDirQuery.data]);

  useEffect(() => {
    if (!customer?.onboarding_completed_at) {
      setHydrated(false);
      return;
    }
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
    const book = readServiceAddressBook(customer);
    const defaultEntry = book.defaultId
      ? book.entries.find((e) => e.id === book.defaultId) ?? null
      : book.entries[0] ?? null;
    const entryGps = readAddressEntryGps(defaultEntry);
    setLat(entryGps?.lat ?? f.lat);
    setLng(entryGps?.lng ?? f.lng);
    setAccuracyM(entryGps?.accuracy_m ?? f.accuracyM);
    setHydrated(true);
  }, [customer?.id, customer?.updated_at, customer?.onboarding_completed_at]);

  const buildProfilePayload = useCallback(() => {
    const cap = capacity.trim();
    const pan = panels.trim();
    const snappedKw = snapProfileCapacityInputToAllowedKw(cap);
    const capN = snappedKw ?? null;
    const panN = pan === "" ? null : Number.parseInt(pan, 10);
    if (capN === null) {
      throw new Error(`Choose installed capacity: ${ALLOWED_CAPACITY_KW.map((k) => `${k} kW`).join(", ")}.`);
    }
    if (panN === null || Number.isNaN(panN) || panN <= 0) throw new Error("Enter a valid panel count.");
    if (!installationCategory) throw new Error("Select residential or commercial.");
    if (!roofMaterial) throw new Error("Select roof structure (Tin / RCC / etc.).");
    if (!roofType) throw new Error("Select a roof layout.");
    if (!roofAccess) throw new Error("Select roof access.");
    if (!water) throw new Error("Select water availability.");
    if (!addr.label.trim()) throw new Error("Enter a short site label (e.g. Home, Office plant).");
    if (!addr.line1.trim()) throw new Error("Enter address line 1.");

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

    return {
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
      panel_brand: panelBrand.trim() || null,
      inverter_brand: inverterBrand.trim() || null,
      epc_vendor_name: epcVendorName.trim() || null,
    };
  }, [
    capacity,
    panels,
    installationCategory,
    roofMaterial,
    roofType,
    roofAccess,
    water,
    addr,
    displayName,
    contactEmail,
    alternatePhone,
    lat,
    lng,
    accuracyM,
    lastCleaning,
    hazards,
    specialInstructions,
    panelBrand,
    inverterBrand,
    epcVendorName,
  ]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Missing Supabase");
      const payload = buildProfilePayload();
      return customerApi.updateCustomerProfileAfterOnboarding(supabase, payload);
    },
    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
      await qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all() });
      const realign = result.amc_realignments;
      if (realign.length > 0) {
        Alert.alert(
          "Profile & AMC updated",
          `Your system size was updated and your AMC plan was re-priced.\n\n${formatAmcRealignmentAlertBody(realign)}`,
        );
      } else {
        Alert.alert("Saved", "Your site profile has been updated.");
      }
    },
    onError: (e: unknown) => {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Try again.");
    },
  });

  const requestSaveProfile = useCallback(() => {
    try {
      const payload = buildProfilePayload();
      if (!customer) {
        void saveMut.mutateAsync();
        return;
      }
      const willRealign = customerCapacityTierWillChangeAmc(
        customer,
        subsQuery.data ?? [],
        payload.solar_capacity_kw!,
      );
      if (!willRealign) {
        void saveMut.mutateAsync();
        return;
      }
      Alert.alert("Update system size & AMC?", AMC_CAPACITY_CHANGE_DISCLAIMER, [
        { text: "Cancel", style: "cancel" },
        { text: "Save & update AMC", onPress: () => void saveMut.mutateAsync() },
      ]);
    } catch (e: unknown) {
      Alert.alert("Could not save", e instanceof Error ? e.message : "Check your entries.");
    }
  }, [buildProfilePayload, customer, subsQuery.data, saveMut]);
  const addressBookMut = useMutation({
    mutationFn: async (payload: {
      entries: ServiceAddressEntry[];
      defaultId: string | null;
      extras?: ServiceAddressSaveExtras;
      suppressAlert?: boolean;
    }) => {
      if (!supabase || !customer) throw new Error("Customer profile unavailable.");
      const patch = buildAddressBookPatch(customer, payload.entries, payload.defaultId);
      return customerApi.updateMyCustomer(supabase, mergeServiceGpsIntoCustomerPatch(patch, payload.extras));
    },
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
      if (!variables.suppressAlert) {
        Alert.alert("Saved", "Address book updated.");
      }
    },
    onError: (e: unknown) => {
      Alert.alert("Could not save addresses", e instanceof Error ? e.message : "Try again.");
    },
  });

  const captureLocation = useCallback(async () => {
    if (!customer || !addressBook.defaultId) {
      Alert.alert("Address required", "Save a service address before setting GPS.");
      return;
    }
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location needed",
          "Allow location so we can save GPS for this site and stamp it on your photos.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy ?? null,
      };
      setLat(geo.lat);
      setLng(geo.lng);
      setAccuracyM(geo.accuracy_m);
      const nextEntries = patchAddressEntryGps(addressBook.entries, addressBook.defaultId, geo);
      await addressBookMut.mutateAsync({
        entries: nextEntries,
        defaultId: addressBook.defaultId,
        suppressAlert: true,
      });
    } catch (e: unknown) {
      Alert.alert("Location error", e instanceof Error ? e.message : "Could not read GPS.");
    } finally {
      setLocBusy(false);
    }
  }, [addressBook.defaultId, addressBook.entries, customer, addressBookMut]);

  const clearLocation = useCallback(() => {
    if (!customer || !addressBook.defaultId) {
      setLat(null);
      setLng(null);
      setAccuracyM(null);
      return;
    }
    setLat(null);
    setLng(null);
    setAccuracyM(null);
    const nextEntries = addressBook.entries.map((e) =>
      e.id === addressBook.defaultId
        ? {
            ...e,
            service_lat: null,
            service_lng: null,
            location_accuracy_m: null,
            location_recorded_at: null,
          }
        : e,
    );
    void addressBookMut.mutateAsync({
      entries: nextEntries,
      defaultId: addressBook.defaultId,
      suppressAlert: true,
    });
  }, [addressBook.defaultId, addressBook.entries, customer, addressBookMut]);

  const signOut = useCallback(async () => {
    setSignOutBusy(true);
    try {
      if (supabase) {
        markUserInitiatedSignOut();
        await authApi.signOut(supabase);
      }
      router.replace("/login");
    } finally {
      setSignOutBusy(false);
    }
  }, []);

  const onSitePhotoGpsChange = useCallback(
    (nextLat: number | null, nextLng: number | null, nextAcc: number | null) => {
      setLat(nextLat);
      setLng(nextLng);
      setAccuracyM(nextAcc);
    },
    [],
  );

  const onSitePhotoSaveEntries = useCallback(
    async (entries: ServiceAddressEntry[], defaultId: string | null) => {
      await addressBookMut.mutateAsync({ entries, defaultId, suppressAlert: true });
    },
    [addressBookMut],
  );

  const accountPhone = user?.phone?.trim() ?? "";
  const accountEmail = user?.email?.trim() ?? "";

  if (!supabase) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <Text style={styles.muted}>Configure Supabase.</Text>
      </Screen>
    );
  }

  if (userQuery.isPending || custQuery.isPending) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }

  if (!customer?.onboarding_completed_at) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <Text style={styles.muted}>Complete registration first to manage your site details.</Text>
        <View style={styles.sectionTop}>
          <Button variant="primary" size="lg" onPress={() => router.push("/customer-registration")}>
            Continue registration
          </Button>
        </View>
      </Screen>
    );
  }

  if (!hydrated && customer) {
    return (
      <Screen padded edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={SCREEN_EDGES_BENEATH_NATIVE_HEADER}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: "padding", android: undefined })}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.lede}>
            Account phone and email are tied to sign-in. Everything else matches what you entered during onboarding and
            can be updated anytime.
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sign-in account</Text>
            <Text style={styles.sectionHint}>Used for login - contact support to change.</Text>
            <AccountRow label="Phone" value={accountPhone} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About you</Text>
            <Field label="Full name *" value={displayName} onChangeText={setDisplayName} placeholder="As on utility bill" />
            <Field
              label="Email for booking updates (optional)"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Confirmations and reminders"
            />
            <Field
              label="Alternate phone (optional)"
              value={alternatePhone}
              onChangeText={(t) => setAlternatePhone(t.replace(/\D/g, "").slice(0, 15))}
              keyboardType="number-pad"
              placeholder="Backup contact for visits"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OorjaMan Credits</Text>
            <Text style={styles.sectionHint}>
              Apology wallet credits when a partner cancels within the last hour before your visit. 1 Credit = ₹1 off a
              future one-time booking.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View OorjaMan Credits wallet"
              onPress={() => router.push("/credits")}
              style={({ pressed }) => [styles.prefPartnerRow, pressed && styles.prefPartnerRowPressed]}
            >
              <View style={styles.prefPartnerRowText}>
                <Text style={styles.prefPartnerValue}>
                  {creditsQuery.isPending
                    ? "Loading…"
                    : `${creditsQuery.data?.balance_credits ?? 0} Credits available`}
                </Text>
                <Text style={styles.prefPartnerCta}>
                  {creditsQuery.data && creditsQuery.data.balance_paise > 0
                    ? `Worth ${formatInrFromCents(creditsQuery.data.balance_paise)} · Tap to view wallet`
                    : "Tap to view wallet"}
                </Text>
              </View>
              <Text style={styles.prefPartnerChevron}>›</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service address</Text>
            {activeAmc ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View AMC subscription"
                onPress={() => router.push("/(main)/subscription")}
                style={({ pressed }) => [styles.amcProfileRow, pressed && styles.amcProfileRowPressed]}
              >
                <View style={styles.amcPill}>
                  <Text style={styles.amcPillText}>AMC active</Text>
                </View>
                <Text style={styles.amcProfileMeta} numberOfLines={2}>
                  {activeAmc.plan_name} · valid through {formatSubscriptionValidThrough(activeAmc.ends_at)}
                </Text>
              </Pressable>
            ) : null}
            {selectedAddress ? (
              <View style={styles.addressBookCard}>
                <Text style={styles.addressBookLabel}>Current booking address ({selectedAddress.label})</Text>
                <Text style={styles.addressBookValue}>{serviceAddressFormatted(selectedAddress.address)}</Text>
              </View>
            ) : null}
            <View style={styles.addressManageBtn}>
              <Button variant="outline" size="sm" onPress={() => setAddressSheetOpen(true)}>
                Manage saved addresses
              </Button>
            </View>
            <View style={styles.prefPartnerSection}>
              <Text style={styles.prefPartnerLabel}>Preferred partners</Text>
              <Text style={styles.prefPartnerHint}>
                Optional defaults for visits to this saved address (you still choose one partner when you book).
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Preferred partners settings"
                onPress={() => router.push("/preferred-partner")}
                style={({ pressed }) => [styles.prefPartnerRow, pressed && styles.prefPartnerRowPressed]}
              >
                <View style={styles.prefPartnerRowText}>
                  <Text style={styles.prefPartnerValue}>
                    {vendorsDirQuery.isPending ? "Loading…" : preferredPartnerSummary}
                  </Text>
                  <Text style={styles.prefPartnerCta}>Tap to set or clear</Text>
                </View>
                <Text style={styles.prefPartnerChevron}>›</Text>
              </Pressable>
            </View>
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
            <Field
              label="PIN code *"
              value={addr.pincode}
              onChangeText={(t) => setAddr((a) => ({ ...a, pincode: t.replace(/\D/g, "").slice(0, 6) }))}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Site location &amp; photos</Text>
            {user?.id ? (
              <SitePhotoGallerySection
                addressId={addressBook.defaultId}
                addressLabel={selectedAddress?.label ?? "Default site"}
                customerUserId={user.id}
                entries={addressBook.entries}
                defaultId={addressBook.defaultId}
                lat={lat}
                lng={lng}
                accuracyM={accuracyM}
                locBusy={locBusy}
                onCaptureLocation={() => void captureLocation()}
                onClearLocation={clearLocation}
                onGpsChange={onSitePhotoGpsChange}
                onSaveEntries={onSitePhotoSaveEntries}
                rawSitePhotoCount={rawSitePhotoCount}
              />
            ) : (
              <Text style={styles.blockText}>Sign in to add site photos.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Solar &amp; site</Text>
            {activeAmc ? (
              <View style={styles.amcDisclaimerCard}>
                <Text style={styles.amcDisclaimerTitle}>Active AMC on your account</Text>
                <Text style={styles.amcDisclaimerBody}>{AMC_CAPACITY_CHANGE_DISCLAIMER}</Text>
                {amcTierMismatch ? (
                  <Text style={styles.amcDisclaimerWarn}>
                    Your saved system size does not match this AMC plan yet. Save Profile to re-price and update visit
                    allowances.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.fieldLabel}>Installed capacity (kW) *</Text>
            <Text style={styles.blockText}>
              Pick your system size. AMC and visit pricing use these bands (no 7 kW or 9 kW).
            </Text>
            <View style={styles.chipGrid}>
              {ALLOWED_CAPACITY_KW.map((kw) => {
                const selected = capacity.trim() === String(kw) || Number.parseFloat(capacity) === kw;
                return (
                  <Pressable
                    key={kw}
                    onPress={() => setCapacity(String(kw))}
                    style={[styles.chip, selected && styles.chipOn]}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{kw} kW</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field
              label="Panel count *"
              value={panels}
              onChangeText={(t) => setPanels(t.replace(/\D/g, ""))}
              keyboardType="number-pad"
              placeholder="e.g. 10"
            />
            <Text style={styles.fieldLabel}>Installation *</Text>
            <View style={styles.chipGrid}>
              {INSTALL_CATEGORIES.map((r) => (
                <Pressable
                  key={r.value}
                  onPress={() => setInstallationCategory(r.value)}
                  style={[styles.chip, installationCategory === r.value && styles.chipOn]}
                >
                  <Text style={[styles.chipLabel, installationCategory === r.value && styles.chipLabelOn]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { marginTop: spacing.sm }]}>Roof structure *</Text>
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
            <Text style={[styles.blockText, { marginTop: spacing.md }]}>Equipment (optional)</Text>
            <Field label="Panel brand / model" value={panelBrand} onChangeText={setPanelBrand} placeholder="e.g. Waaree 540 W" />
            <Field label="Inverter brand" value={inverterBrand} onChangeText={setInverterBrand} placeholder="e.g. SolarEdge" />
            <Field label="Original installer / EPC" value={epcVendorName} onChangeText={setEpcVendorName} placeholder="Who installed the system" />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Safety &amp; access</Text>
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
              placeholder="Access restrictions, gate codes…"
            />
          </View>

          <Button
            variant="primary"
            size="lg"
            loading={saveMut.isPending}
            disabled={saveMut.isPending}
            onPress={requestSaveProfile}
          >
            Save changes
          </Button>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            disabled={signOutBusy}
            onPress={() => void signOut()}
            style={({ pressed }) => [
              styles.outline,
              pressed && !signOutBusy && styles.outlinePressed,
              signOutBusy && styles.outlineDisabled,
            ]}
          >
            <Text style={signOutBusy ? styles.outlineBusy : styles.outlineLabel}>
              {signOutBusy ? "Signing out…" : "Sign out"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <ServiceAddressPickerSheet
        visible={addressSheetOpen}
        entries={addressBook.entries}
        defaultId={addressBook.defaultId}
        onClose={() => setAddressSheetOpen(false)}
        onSave={async (entries, defaultId, extras) => {
          const selected = defaultId ? entries.find((e) => e.id === defaultId) ?? null : entries[0] ?? null;
          if (selected) {
            const parsed = parseAddr(selected.address);
            setAddr({ ...parsed, label: selected.label.trim() || parsed.label });
          }
          await addressBookMut.mutateAsync({ entries, defaultId, extras });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: 0,
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
  lede: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  muted: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  section: {
    marginBottom: spacing.lg,
  },
  addressBookCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  addressBookLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  addressBookValue: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  addressManageBtn: {
    marginBottom: spacing.sm,
  },
  prefPartnerSection: {
    marginBottom: spacing.md,
  },
  prefPartnerLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
    marginBottom: spacing["3xs"],
  },
  prefPartnerHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  prefPartnerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  prefPartnerRowPressed: {
    opacity: 0.92,
  },
  prefPartnerRowText: {
    flex: 1,
    minWidth: 0,
  },
  prefPartnerValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  prefPartnerCta: {
    marginTop: 2,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  prefPartnerChevron: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xl,
    color: colors.mutedForeground,
    marginLeft: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  accountRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.muted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  accountLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accountValue: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  accountHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  fieldWrap: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  simpleInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    minHeight: 46,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.foreground,
    ...(Platform.OS === "ios" ? { lineHeight: 22 } : {}),
  },
  simpleInputMultiline: {
    minHeight: 88,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
    textAlignVertical: "top",
  },
  blockText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 22,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  chipLabel: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  chipLabelOn: {
    color: colors.primary,
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
  loading: {
    marginTop: spacing.lg,
  },
  sectionTop: {
    marginTop: spacing.md,
  },
  outline: {
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    minHeight: 48,
  },
  outlinePressed: { opacity: 0.9 },
  outlineDisabled: { opacity: 0.55 },
  outlineLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  outlineBusy: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.mutedForeground,
  },
  amcProfileRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  amcProfileRowPressed: { opacity: 0.88 },
  amcPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: `${colors.primary}18`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}40`,
  },
  amcPillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.3,
    color: colors.primary,
    textTransform: "uppercase",
  },
  amcProfileMeta: {
    flex: 1,
    minWidth: 120,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  amcDisclaimerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryMuted,
    gap: spacing.xs,
  },
  amcDisclaimerTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  amcDisclaimerBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  amcDisclaimerWarn: {
    marginTop: spacing.xs,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.primary,
  },
});
