import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { brandAssets, BrandWordmark } from "@oorjaman/ui";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";

export type WebShellNavItem = {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Match active route (pathname starts with or equals). */
  match: string | ((pathname: string) => boolean);
};

type Props = {
  items: WebShellNavItem[];
};

function isActive(pathname: string, match: WebShellNavItem["match"]): boolean {
  if (typeof match === "function") return match(pathname);
  if (match === "/") {
    return (
      pathname === "/" ||
      pathname === "/(main)" ||
      pathname.endsWith("/(main)") ||
      pathname.endsWith("/(main)/index") ||
      pathname === "/index"
    );
  }
  return pathname === match || pathname.startsWith(`${match}/`);
}

/**
 * Desktop (≥1024 web) sidebar — maps to existing main tabs.
 * Native phone tab bar is unchanged (not rendered here).
 */
export function WebAppShellSidebar({ items }: Props) {
  const pathname = usePathname();

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand} accessibilityRole="header" accessibilityLabel="OorjaMan">
        <Image
          source={brandAssets.logoIcon}
          style={styles.brandIcon}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="OorjaMan logo"
        />
        <BrandWordmark size="compact" showTagline={false} />
      </View>
      <View style={styles.nav}>
        {items.map((item) => {
          const active = isActive(pathname, item.match);
          return (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => router.push(item.href as never)}
              style={[styles.item, active && styles.itemActive]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 220,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.card,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
  },
  brandIcon: {
    width: 36,
    height: 36,
  },
  nav: {
    gap: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: colors.muted,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
    color: colors.mutedForeground,
  },
  labelActive: {
    color: colors.primary,
  },
});
