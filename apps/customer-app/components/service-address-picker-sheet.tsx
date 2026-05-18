import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { Button, Card, Input, ModalSheetHeader } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { fillAddressFromCurrentLocation } from "../lib/fill-address-from-gps";
import {
  serviceAddressFormatted,
  type ServiceAddressEntry,
  type ServiceAddressSaveExtras,
} from "../lib/service-address-book";

type Props = {
  visible: boolean;
  entries: ServiceAddressEntry[];
  defaultId: string | null;
  onClose: () => void;
  onSave: (
    entries: ServiceAddressEntry[],
    defaultId: string | null,
    extras?: ServiceAddressSaveExtras,
  ) => void | Promise<void>;
  /** Non-dismissible backdrop, no Cancel in footer for optional mode, Android back ignored. */
  mandatory?: boolean;
  /**
   * Session gate (Swiggy-style): no footer confirm button; tap a saved row to continue.
   * First-time (no addresses): add form is required; after saving the first address we continue automatically.
   */
  mandatorySessionGate?: boolean;
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ServiceAddressPickerSheetBody({
  visible,
  entries,
  defaultId,
  onClose,
  onSave,
  mandatory = false,
  mandatorySessionGate = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const blockDismiss = mandatory || mandatorySessionGate;
  const [draftEntries, setDraftEntries] = useState<ServiceAddressEntry[]>(entries);
  const [draftDefaultId, setDraftDefaultId] = useState<string | null>(defaultId);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsExtras, setGpsExtras] = useState<ServiceAddressSaveExtras | null>(null);
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDraftEntries(entries);
    setDraftDefaultId(defaultId);
    setGpsExtras(null);
    if (mandatorySessionGate || mandatory) {
      setAdding(entries.length === 0);
    }
  }, [visible, entries, defaultId, mandatory, mandatorySessionGate]);

  const canConfirm =
    draftEntries.length > 0 &&
    Boolean(draftDefaultId) &&
    draftEntries.some((e) => e.id === draftDefaultId);

  const commit = async (nextEntries: ServiceAddressEntry[], nextDefaultId: string | null, extras?: ServiceAddressSaveExtras) => {
    if (!nextDefaultId || !nextEntries.some((e) => e.id === nextDefaultId)) return;
    setSaving(true);
    try {
      await Promise.resolve(onSave(nextEntries, nextDefaultId, extras));
      if (!mandatorySessionGate && !mandatory) onClose();
      if (mandatory && !mandatorySessionGate) onClose();
      setGpsExtras(null);
    } finally {
      setSaving(false);
    }
  };

  const onEntryPress = async (entryId: string) => {
    if (saving) return;
    if (mandatorySessionGate) {
      setAdding(false);
      await commit(draftEntries, entryId, undefined);
      return;
    }
    setDraftDefaultId(entryId);
  };

  const onUseCurrentLocation = async () => {
    setGpsBusy(true);
    try {
      const r = await fillAddressFromCurrentLocation();
      if (!r) {
        Alert.alert("Permission needed", "Allow location so we can fill your address from GPS.");
        return;
      }
      setLine1(r.line1);
      setLine2(r.line2);
      setCity(r.city);
      setState(r.state);
      setPincode(r.pincode);
      setGpsExtras({
        service_lat: r.lat,
        service_lng: r.lng,
        location_accuracy_m: r.accuracyM,
      });
    } catch (e: unknown) {
      Alert.alert("Location error", e instanceof Error ? e.message : "Could not read GPS.");
    } finally {
      setGpsBusy(false);
    }
  };

  const showFooterConfirm = !mandatorySessionGate;

  return (
    <View style={styles.modalRoot}>
      {blockDismiss ? (
        <View style={styles.backdropFill} />
      ) : (
        <Pressable style={styles.backdropFill} onPress={onClose} accessibilityLabel="Dismiss" />
      )}
      <View
        style={[
          styles.sheet,
          {
            paddingLeft: spacing.md + insets.left,
            paddingRight: spacing.md + insets.right,
            paddingBottom: spacing.md + insets.bottom,
          },
        ]}
      >
        <ModalSheetHeader
          title={
            mandatorySessionGate || mandatory ? "Select service location" : "Choose service address"
          }
          subtitle={
            mandatorySessionGate && draftEntries.length === 0
              ? "Add your site address or use current location, then you can continue."
              : mandatory
                ? "Add where you want service so we can match you with the right partner."
                : undefined
          }
          onClose={onClose}
          showClose={!blockDismiss}
          closeAccessibilityLabel="Close address picker"
        />
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {draftEntries.map((e) => {
            const selected = draftDefaultId === e.id;
            return (
              <Card key={e.id} variant="elevated" padded>
                <Pressable
                  onPress={() => void onEntryPress(e.id)}
                  style={[styles.entryPress, !mandatorySessionGate && selected && styles.entrySelected]}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.label}. ${serviceAddressFormatted(e.address)}`}
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.entryLabel}>{e.label}</Text>
                  <Text style={styles.entryAddress}>{serviceAddressFormatted(e.address)}</Text>
                  {mandatorySessionGate && saving ? (
                    <ActivityIndicator style={styles.rowSpinner} color={colors.primary} />
                  ) : null}
                </Pressable>
                {!mandatorySessionGate ? (
                  <View style={styles.entryActions}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        const next = draftEntries.filter((x) => x.id !== e.id);
                        setDraftEntries(next);
                        if (draftDefaultId === e.id) setDraftDefaultId(next[0]?.id ?? null);
                        if (mandatory && next.length === 0) setAdding(true);
                      }}
                    >
                      Remove
                    </Button>
                  </View>
                ) : null}
              </Card>
            );
          })}

          {adding ? (
            <Card variant="muted" padded>
              <Button variant="outline" size="md" loading={gpsBusy} onPress={() => void onUseCurrentLocation()}>
                Use current location
              </Button>
              <View style={styles.gap} />
              <Input label="Address label *" value={label} onChangeText={setLabel} placeholder="e.g. Home rooftop, Factory" />
              <View style={styles.gap} />
              <Input label="Address line 1" value={line1} onChangeText={setLine1} />
              <View style={styles.gap} />
              <Input label="Address line 2 (optional)" value={line2} onChangeText={setLine2} />
              <View style={styles.gap} />
              <Input label="City" value={city} onChangeText={setCity} />
              <View style={styles.gap} />
              <Input label="State" value={state} onChangeText={setState} />
              <View style={styles.gap} />
              <Input
                label="PIN code"
                value={pincode}
                onChangeText={(t) => setPincode(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
              />
              <View style={styles.entryActions}>
                <Button
                  size="sm"
                  loading={saving}
                  onPress={() => {
                    if (!label.trim()) {
                      Alert.alert("Address label required", "Enter a short label so you can recognize this site in lists and headers.");
                      return;
                    }
                    if (!line1.trim() || !city.trim() || !state.trim() || pincode.trim().length !== 6) return;
                    const trimmedLabel = label.trim();
                    const address = {
                      line1: line1.trim(),
                      line2: line2.trim() || null,
                      city: city.trim(),
                      state: state.trim(),
                      pincode: pincode.trim(),
                      label: trimmedLabel,
                      formatted: [
                        line1.trim(),
                        line2.trim(),
                        [city.trim(), state.trim()].filter(Boolean).join(", "),
                        pincode.trim(),
                      ]
                        .filter(Boolean)
                        .join(", "),
                    };
                    const next: ServiceAddressEntry = {
                      id: uid(),
                      label: trimmedLabel,
                      address,
                      created_at: new Date().toISOString(),
                    };
                    const wasEmpty = draftEntries.length === 0;
                    const nextEntries = [...draftEntries, next];
                    setDraftEntries(nextEntries);
                    setDraftDefaultId(next.id);
                    setAdding(false);
                    setLabel("");
                    setLine1("");
                    setLine2("");
                    setCity("");
                    setState("");
                    setPincode("");
                    const extras = gpsExtras ?? undefined;
                    if (mandatorySessionGate && wasEmpty) {
                      void commit(nextEntries, next.id, extras);
                    } else {
                      setGpsExtras(null);
                    }
                  }}
                >
                  Save address
                </Button>
                {!(mandatory && draftEntries.length === 0) && !(mandatorySessionGate && draftEntries.length === 0) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setGpsExtras(null);
                      setAdding(false);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </View>
            </Card>
          ) : (
            <Button variant="outline" size="md" onPress={() => setAdding(true)}>
              {draftEntries.length === 0 ? "Add address" : "Add another address"}
            </Button>
          )}
        </ScrollView>
        {showFooterConfirm ? (
          <View style={[styles.footer, mandatory && styles.footerMandatory]}>
            {!mandatory ? (
              <View style={styles.footerBtnCell}>
                <Button variant="outline" size="md" style={styles.footerBtnStretch} onPress={onClose}>
                  Cancel
                </Button>
              </View>
            ) : null}
            <View style={[styles.footerBtnCell, mandatory && styles.footerBtnCellFull]}>
              <Button
                style={mandatory ? styles.footerPrimaryFull : styles.footerBtnStretch}
                size="md"
                disabled={!canConfirm || saving}
                onPress={() => void commit(draftEntries, draftDefaultId, gpsExtras ?? undefined)}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  "Use selected"
                )}
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * RN `Modal` does not inherit the root app's safe-area context; nested `SafeAreaProvider` fixes Android
 * under-padding. `navigationBarTranslucent` / `statusBarTranslucent` extend the modal window edge-to-edge
 * so the dimming layer and sheet cover the tab bar strip.
 */
export function ServiceAddressPickerSheet(props: Props) {
  const blockDismiss = props.mandatory || props.mandatorySessionGate;
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={blockDismiss ? () => {} : props.onClose}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
        <ServiceAddressPickerSheetBody {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000066",
  },
  sheet: {
    maxHeight: "92%",
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: colors.background,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  title: { fontFamily: fontFamily.semiBold, fontSize: fontSize.lg, color: colors.foreground },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginTop: -4,
  },
  list: { maxHeight: 420 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  entryPress: {
    gap: spacing.xs,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  entrySelected: {
    backgroundColor: colors.primaryMuted,
  },
  entryLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.foreground },
  entryAddress: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground },
  entryActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  gap: { height: spacing.xs },
  footer: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between", alignItems: "stretch" },
  footerMandatory: { flexDirection: "column", alignItems: "stretch" },
  footerBtnCell: { flex: 1, minWidth: 0 },
  footerBtnCellFull: { flex: 1, width: "100%" },
  footerBtnStretch: { alignSelf: "stretch", width: "100%" },
  footerPrimaryFull: { alignSelf: "stretch", width: "100%" },
  rowSpinner: { marginTop: spacing.sm },
});
