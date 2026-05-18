import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  type ListRenderItem,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { STORAGE_KEY_ONBOARDING } from "../constants/storage";

type TrustRow = { title: string; subtitle: string };

type SlideIcon = keyof typeof Ionicons.glyphMap;

type Slide = {
  id: string;
  icon: SlideIcon;
  title: string;
  body?: string;
  trustRows?: TrustRow[];
};

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "sunny-outline",
    title: "Welcome to OorjaMan",
    body:
      "Professional solar panel cleaning and upkeep at your site. Grimy arrays can shave a noticeable share off your yield-we help keep every kilowatt-hour counting. Verified partners follow safe methods so your warranty stays intact and your system keeps performing season after season.",
  },
  {
    id: "2",
    icon: "checkmark-circle-outline",
    title: "Easy booking, real results",
    body:
      "Pick a slot that fits, see clear pricing upfront, and we’ll dispatch a technician you can trust. They clean and inspect your site, capture photos where it matters, and leave you with a straightforward summary-not guesswork, just cleaner production and confidence.",
  },
  {
    id: "3",
    icon: "sunny-outline",
    title: "Solar cleaning & preventive care",
    body:
      "Stay ahead of soot, dust, and debris. Booking through OorjaMan keeps visits structured: cleaning, inspection, and status you can track in one place-from request through completion.",
  },
  {
    id: "4",
    icon: "checkmark-circle-outline",
    title: "Why book with OorjaMan",
    trustRows: [
      { title: "Verified technicians", subtitle: "Vetted partners, trained for safe solar site work." },
      { title: "Transparent pricing", subtitle: "Clear quotes from your pricing rules-not surprise add-ons." },
      { title: "Real-time tracking", subtitle: "Follow visit status and updates as the job moves along." },
    ],
  },
];

const { width: SCREEN_W } = Dimensions.get("window");

const ICON_LARGE = 48;
const ICON_TRUST = 22;

/** Primary with ~13% opacity (same idea as Solar’s `primary + '22'`). */
const iconWrapBg = `${colors.primary}22`;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, "true");
    router.replace("/permissions");
  }, []);

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const item = info.viewableItems[0];
    if (item?.index != null) setIndex(item.index);
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void finish();
    }
  }, [index, finish]);

  const renderItem: ListRenderItem<Slide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width: SCREEN_W }]}>
        <View style={[styles.iconWrap, { backgroundColor: iconWrapBg }]}>
          <Ionicons name={item.icon} size={ICON_LARGE} color={colors.primary} />
        </View>
        <Text style={styles.title}>{item.title}</Text>
        {item.trustRows ? (
          <View style={styles.trustBlock}>
            {item.trustRows.map((row, i) => (
              <View
                key={`${item.id}-${i}`}
                style={[styles.trustRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              >
                <View style={styles.trustIconWrap}>
                  <Ionicons name="checkmark-circle" size={ICON_TRUST} color={colors.success} />
                </View>
                <View style={styles.trustContent}>
                  <Text style={styles.trustTitle}>{row.title}</Text>
                  <Text style={styles.trustSubtitle}>{row.subtitle}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.body}>{item.body}</Text>
        )}
      </View>
    ),
    [],
  );

  const isLast = index === SLIDES.length - 1;

  const ctaLabel = isLast
    ? "Get started"
    : index === SLIDES.length - 2
      ? "Continue"
      : "Next";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>OorjaMan</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          onPress={() => void finish()}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.skipPressed]}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        style={styles.list}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({
          length: SCREEN_W,
          offset: SCREEN_W * i,
          index: i,
        })}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 12, spacing.xl), backgroundColor: colors.background }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View
              key={SLIDES[i].id}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.primary : colors.border,
                  width: i === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Get started" : "Go to next slide"}
          onPress={() => void handleNext()}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brand: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.foreground,
  },
  skip: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.primary,
  },
  skipPressed: {
    opacity: 0.7,
  },
  list: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xl,
    lineHeight: 30,
    letterSpacing: -0.35,
    color: colors.foreground,
    textAlign: "center",
    marginBottom: 16,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    lineHeight: 24,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  trustBlock: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  trustIconWrap: {
    width: 28,
    marginRight: 12,
    alignItems: "center",
    paddingTop: 2,
  },
  trustContent: {
    flex: 1,
  },
  trustTitle: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.md,
    color: colors.foreground,
  },
  trustSubtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  cta: {
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  ctaPressed: {
    opacity: 0.92,
  },
  ctaLabel: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.lg,
    color: colors.primaryForeground,
  },
});
