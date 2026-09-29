import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@oorjaman/config";
import { Button, Card } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../constants/fonts";

type Props = {
  onChangeAddress?: () => void;
};

export function LaunchAreaComingSoon({ onChangeAddress }: Props) {
  return (
    <Card variant="muted" padded>
      <Text style={styles.title}>Coming soon in your area</Text>
      <Text style={styles.body}>
        OorjaMan is expanding to more cities. We will notify you when the service is available in your area.
      </Text>
      {onChangeAddress ? (
        <View style={styles.action}>
          <Button variant="primary" size="lg" onPress={onChangeAddress}>
            Change service address
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
  },
  action: {
    marginTop: spacing.lg,
  },
});
