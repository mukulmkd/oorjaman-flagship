import { Text, StyleSheet } from "react-native";
import {
  computeAmcListPriceFromVisitRate,
  formatAmcPlanSubtitle,
  formatInrFromCents,
  type PricingAmcPlanRow,
} from "@oorjaman/api";
import { colors } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { PriceGstBreakdown } from "./price-gst-breakdown";

type Props = {
  plan: PricingAmcPlanRow;
  visitRatePaise: number;
  geoAddonPaise: number;
  loading?: boolean;
};

export function AmcPlanPriceLine({ plan, visitRatePaise, geoAddonPaise, loading = false }: Props) {
  if (loading) {
    return <Text style={styles.body}>Loading price…</Text>;
  }

  const specialPaise = plan.amount_cents + geoAddonPaise;
  const listPaise =
    computeAmcListPriceFromVisitRate(visitRatePaise, plan.visits_included) + geoAddonPaise;
  const showList = listPaise > specialPaise;

  return (
    <>
      <Text style={styles.body}>
        {formatAmcPlanSubtitle(plan)} ·{" "}
        {showList ? (
          <>
            <Text style={styles.listPrice}>{formatInrFromCents(listPaise)}</Text>{" "}
          </>
        ) : null}
        <Text style={showList ? styles.specialPrice : undefined}>{formatInrFromCents(specialPaise)}</Text>
      </Text>
      <PriceGstBreakdown totalPaise={specialPaise} compact />
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  listPrice: {
    textDecorationLine: "line-through",
    color: colors.mutedForeground,
  },
  specialPrice: {
    fontFamily: fontFamily.semiBold,
    color: colors.textPrimary,
  },
});
