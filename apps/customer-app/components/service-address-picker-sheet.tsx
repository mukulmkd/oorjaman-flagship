import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { Button, Card, Input, KEYBOARD_AVOIDING_BEHAVIOR, ModalSheetHeader } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";
import { fillAddressFromCurrentLocation, type GpsAddressFill } from "../lib/fill-address-from-gps";
import {
  serviceAddressFormatted,
  extrasFromAddressEntry,
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
  /** Backdrop, header close, and Android back cannot dismiss without choosing an address. */
  blockDismiss?: boolean;
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
  blockDismiss = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draftEntries, setDraftEntries] = useState<ServiceAddressEntry[]>(entries);
  const [adding, setAdding] = useState(false);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const saving = savingEntryId !== null;
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsExtras, setGpsExtras] = useState<ServiceAddressSaveExtras | null>(null);
  const [label, setLabel] = useState("");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  useEffect(() => {
    if (!visible) {
      setSavingEntryId(null);
      return;
    }
    setDraftEntries(entries);
    setGpsExtras(null);
    setAdding(entries.length === 0);
  }, [visible, entries, defaultId]);

  const commit = async (
    nextEntries: ServiceAddressEntry[],
    nextDefaultId: string | null,
    extras?: ServiceAddressSaveExtras,
  ) => {
    if (!nextDefaultId || !nextEntries.some((e) => e.id === nextDefaultId)) return;
    setSavingEntryId(nextDefaultId);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    try {
      await Promise.resolve(onSave(nextEntries, nextDefaultId, extras));
      setGpsExtras(null);
    } finally {
      setSavingEntryId(null);
    }
  };

  const onEntryPress = async (entryId: string) => {
    if (saving) return;
    setAdding(false);
    const entry = draftEntries.find((e) => e.id === entryId);
    await commit(draftEntries, entryId, extrasFromAddressEntry(entry));
  };

  const applyGpsFill = useCallback((r: GpsAddressFill) => {
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
  }, []);

  const runCurrentLocationFill = useCallback(
    async (opts?: { showErrors?: boolean }) => {
      const showErrors = opts?.showErrors === true;
      setGpsBusy(true);
      try {
        const r = await fillAddressFromCurrentLocation({ quiet: !showErrors });
        if (!r) {
          if (showErrors) {
            Alert.alert(
              "Permission needed",
              "Allow location access when prompted so we can fill your address from GPS, or enable it for OorjaMan in Settings.",
            );
          }
          return;
        }
        applyGpsFill(r);
      } catch (e: unknown) {
        if (showErrors) {
          Alert.alert("Location error", e instanceof Error ? e.message : "Could not read GPS.");
        }
      } finally {
        setGpsBusy(false);
      }
    },
    [applyGpsFill],
  );

  const beginAdding = useCallback(() => {
    setLabel("");
    setLine1("");
    setLine2("");
    setCity("");
    setState("");
    setPincode("");
    setGpsExtras(null);
    setAdding(true);
  }, []);

  useEffect(() => {
    if (!visible || !adding) return;
    void runCurrentLocationFill({ showErrors: false });
  }, [adding, visible, runCurrentLocationFill]);

  const onUseCurrentLocation = () => {
    void runCurrentLocationFill({ showErrors: true });
  };

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
          title="Select service location"
          subtitle={
            draftEntries.length === 0
              ? "We’ll pre-fill from your current GPS. Review the fields, add a label, then save."
              : undefined
          }
          onClose={onClose}
          showClose={!blockDismiss}
          closeAccessibilityLabel="Close address picker"
        />
        <KeyboardAvoidingView behavior={KEYBOARD_AVOIDING_BEHAVIOR} style={styles.list}>
          <ScrollView
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          >
          {draftEntries.map((e) => {
            const rowBusy = savingEntryId === e.id;
            return (
              <Card key={e.id} variant="elevated" padded>
                <Pressable
                  onPress={() => void onEntryPress(e.id)}
                  style={styles.entryPress}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.label}. ${serviceAddressFormatted(e.address)}`}
                >
                  <Text style={styles.entryLabel}>{e.label}</Text>
                  <Text style={styles.entryAddress}>{serviceAddressFormatted(e.address)}</Text>
                  {rowBusy ? (
                    <ActivityIndicator style={styles.rowSpinner} color={colors.primary} />
                  ) : null}
                </Pressable>
              </Card>
            );
          })}

          {adding ? (
            <Card variant="muted" padded>
              <Button variant="outline" size="md" loading={gpsBusy} onPress={onUseCurrentLocation}>
                {gpsBusy ? "Reading location…" : "Refresh from current location"}
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
                      Alert.alert(
                        "Address label required",
                        "Enter a short label so you can recognize this site in lists and headers.",
                      );
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
                      ...(gpsExtras?.service_lat != null &&
                      gpsExtras?.service_lng != null &&
                      Number.isFinite(gpsExtras.service_lat) &&
                      Number.isFinite(gpsExtras.service_lng)
                        ? {
                            service_lat: gpsExtras.service_lat,
                            service_lng: gpsExtras.service_lng,
                            location_accuracy_m: gpsExtras.location_accuracy_m ?? null,
                            location_recorded_at: new Date().toISOString(),
                          }
                        : {}),
                    };
                    const wasEmpty = draftEntries.length === 0;
                    const nextEntries = [...draftEntries, next];
                    setDraftEntries(nextEntries);
                    setAdding(false);
                    setLabel("");
                    setLine1("");
                    setLine2("");
                    setCity("");
                    setState("");
                    setPincode("");
                    const extras = gpsExtras ?? undefined;
                    setGpsExtras(null);
                    if (wasEmpty) {
                      void commit(nextEntries, next.id, extras);
                    }
                  }}
                >
                  Save address
                </Button>
                {draftEntries.length > 0 ? (
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
            <Button variant="outline" size="md" onPress={beginAdding}>
              {draftEntries.length === 0 ? "Add address" : "Add another address"}
            </Button>
          )}
          </ScrollView>
        </KeyboardAvoidingView>
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
  const blockDismiss = props.blockDismiss ?? true;
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
        <ServiceAddressPickerSheetBody {...props} blockDismiss={blockDismiss} />
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
    ...StyleSheet.absoluteFill,
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
  list: { maxHeight: 420 },
  listContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  entryPress: {
    gap: spacing.xs,
    borderRadius: 10,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  entryLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.md, color: colors.foreground },
  entryAddress: { fontFamily: fontFamily.regular, fontSize: fontSize.sm, color: colors.mutedForeground },
  entryActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  gap: { height: spacing.xs },
  rowSpinner: { marginTop: spacing.sm },
});
