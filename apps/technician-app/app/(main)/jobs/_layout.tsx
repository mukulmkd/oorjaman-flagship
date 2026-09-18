import { Stack } from "expo-router";
import { colors } from "@oorjaman/config";
import { USE_WEB_LAYOUT, webContentColumnStyle } from "@oorjaman/ui";
import { fontFamily, fontSize } from "../../../constants/fonts";

export default function JobsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: fontFamily.semiBold,
          fontSize: fontSize.lg,
          color: colors.foreground,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.foreground,
        animation: "fade",
        contentStyle: {
          flex: 1,
          backgroundColor: colors.background,
          ...(USE_WEB_LAYOUT ? webContentColumnStyle("form") : null),
        },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Job details" }} />
      <Stack.Screen name="execute/[bookingId]" options={{ title: "Field visit" }} />
      <Stack.Screen name="collect/[bookingId]" options={{ title: "Collect payment" }} />
    </Stack>
  );
}
