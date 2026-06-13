import { useEffect, useMemo, useState } from "react";
import {
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
import {
  AMC_PLAN_UPGRADE_DISCLAIMER,
  formatInrFromCents,
  type PricingAmcPlanRow,
  type SubscriptionRow,
} from "@oorjaman/api";
import { colors, spacing } from "@oorjaman/config";
import { Button, ModalSheetHeader } from "@oorjaman/ui";
import { AmcPlanPriceLine } from "./amc-plan-price-line";
import { fontFamily, fontSize } from "../constants/fonts";

type Props = {
  visible: boolean;
  subscription: SubscriptionRow | null;
  /** All published packages for this kW band. */
  tierPlans: PricingAmcPlanRow[];
  currentPlanCode: string | null;
  /** Plan codes the customer may upgrade into (strictly higher packages). */
  upgradePlanCodes: string[];
  geoAddonCents: number;
  visitRatePaise: number;
  geoTierLabel: string | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (planCode: string) => void | Promise<void>;
};

function AmcUpgradeSheetBody({
  visible,
  subscription,
  tierPlans,
  currentPlanCode,
  upgradePlanCodes,
  geoAddonCents,
  visitRatePaise,
  geoTierLabel,
  loading = false,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);

  const upgradeCodeSet = useMemo(() => new Set(upgradePlanCodes), [upgradePlanCodes]);

  useEffect(() => {
    if (!visible) return;
    const firstUpgrade = tierPlans.find((p) => upgradeCodeSet.has(p.plan_code));
    setSelectedPlanCode(firstUpgrade?.plan_code ?? null);
  }, [visible, tierPlans, upgradeCodeSet]);

  if (!visible || !subscription) return null;

  const selected = tierPlans.find((p) => p.plan_code === selectedPlanCode) ?? null;
  const canConfirm = selected != null && upgradeCodeSet.has(selected.plan_code);

  return (
    <View style={styles.modalRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close upgrade plans"
        style={styles.backdropFill}
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <ModalSheetHeader
          title="Upgrade AMC plan"
          subtitle={`Current: ${subscription.plan_name}. All packages for your system size are listed below - select a higher plan to upgrade.`}
          onClose={onClose}
          closeAccessibilityLabel="Close upgrade plans"
        />

        {tierPlans.length === 0 ? (
          <Text style={styles.emptyHint}>
            No published plans for your system size. Contact support if this looks wrong.
          </Text>
        ) : (
          <ScrollView
            style={styles.planScroll}
            contentContainerStyle={[
              styles.planScrollContent,
              { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {tierPlans.map((p) => {
              const isCurrent = p.plan_code === currentPlanCode;
              const canUpgrade = upgradeCodeSet.has(p.plan_code);
              const picked = p.plan_code === selectedPlanCode;
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: picked, disabled: !canUpgrade }}
                  disabled={!canUpgrade}
                  onPress={() => {
                    if (canUpgrade) setSelectedPlanCode(p.plan_code);
                  }}
                  style={({ pressed }) => [
                    styles.planRow,
                    isCurrent && styles.planRowCurrent,
                    picked && canUpgrade && styles.planRowSelected,
                    !canUpgrade && styles.planRowDisabled,
                    pressed && canUpgrade && styles.planRowPressed,
                  ]}
                >
                  <View style={styles.planTextCol}>
                    <View style={styles.planTitleRow}>
                      <Text style={[styles.planTitle, !canUpgrade && styles.planTitleMuted]}>{p.plan_name}</Text>
                      {isCurrent ? (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Current</Text>
                        </View>
                      ) : null}
                    </View>
                    <AmcPlanPriceLine
                      plan={p}
                      visitRatePaise={visitRatePaise}
                      geoAddonPaise={geoAddonCents}
                    />
                    {geoAddonCents > 0 && geoTierLabel ? (
                      <Text style={styles.planAddonHint}>
                        Includes {formatInrFromCents(geoAddonCents)} city-tier add-on ({geoTierLabel}).
                      </Text>
                    ) : null}
                    {isCurrent ? (
                      <Text style={styles.planStatusHint}>Your active package for this contract.</Text>
                    ) : !canUpgrade ? (
                      <Text style={styles.planStatusHint}>Lower package - not available as an upgrade.</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.planChevron, !canUpgrade && styles.planChevronMuted]}>
                    {isCurrent ? "✓" : picked ? "●" : canUpgrade ? "○" : "-"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.disclaimer}>{AMC_PLAN_UPGRADE_DISCLAIMER}</Text>

        <View style={styles.actions}>
          <Button variant="outline" size="md" disabled={loading} onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={loading}
            disabled={!canConfirm}
            onPress={() => {
              if (selected && canConfirm) void onConfirm(selected.plan_code);
            }}
          >
            Confirm upgrade
          </Button>
        </View>
      </View>
    </View>
  );
}

export function AmcUpgradeSheet(props: Props) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="slide"
      onRequestClose={props.onClose}
      statusBarTranslucent={Platform.OS === "android"}
      navigationBarTranslucent={Platform.OS === "android"}
    >
      <SafeAreaProvider initialMetrics={initialWindowMetrics ?? undefined}>
        <AmcUpgradeSheetBody {...props} />
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  emptyHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  planScroll: {
    maxHeight: 360,
  },
  planScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  planRowCurrent: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryMuted,
  },
  planRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  planRowDisabled: {
    opacity: 0.72,
  },
  planRowPressed: {
    opacity: 0.94,
  },
  planTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  planTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
    flexShrink: 1,
  },
  planTitleMuted: {
    color: colors.mutedForeground,
  },
  currentBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing["3xs"],
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  currentBadgeText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.primaryForeground,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  planBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  planAddonHint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  planStatusHint: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  planChevron: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    color: colors.primary,
  },
  planChevronMuted: {
    color: colors.mutedForeground,
  },
  disclaimer: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 18,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
