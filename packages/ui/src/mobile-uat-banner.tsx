import { parseDeployEnvironment } from "@oorjaman/config";
import { StyleSheet, Text, View } from "react-native";

/** Visible strip when `EXPO_PUBLIC_DEPLOY_ENV=uat` (internal / QA builds). */
export function MobileUatEnvironmentBanner() {
  const tier = parseDeployEnvironment();
  if (tier !== "uat") return null;

  return (
    <View style={styles.bar} accessibilityRole="text">
      <Text style={styles.text}>UAT - not production</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#fef3c7",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#fcd34d",
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  text: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: "600",
  },
});
