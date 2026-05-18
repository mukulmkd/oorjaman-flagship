import { Stack } from "expo-router";
import { colors } from "@oorjaman/config";

/** Tab bar supplies the kicker title; stack screens stay headerless. */
export default function BookingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "fade",
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
