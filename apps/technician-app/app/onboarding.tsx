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
import { BrandLockup } from "../components/brand-lockup";
import { BrandNameInline } from "../components/brand-wordmark";

type TrustRow = { title: string; subtitle: string };

type SlideIcon = keyof typeof Ionicons.glyphMap;

type Slide = {
  id: string;
  icon: SlideIcon;
  title: string;
  titleHasBrand?: boolean;
  titleBrandPrefix?: string;
  body?: string;
  trustRows?: TrustRow[];
  /** First slide: compact lockup + field-app intro (not customer “book a visit”). */
  welcomeHero?: boolean;
};

const SLIDES: Slide[] = [
  {
    id: "1",
    icon: "construct-outline",
    welcomeHero: true,
    title: "Your field workspace",
    body:
      "This app is for OorjaMan field partners on solar cleaning jobs — not for booking visits. See what dispatch assigned you, run the on-site workflow, and submit proof your employer and operations can rely on.",
  },
  {
    id: "2",
    icon: "navigate-outline",
    title: "Assignments, not guesswork",
    body:
      "Each job card shows address, scope, customer notes, and site photos before you travel. Status updates stay in one place instead of scattered calls and chat threads.",
  },
  {
    id: "3",
    icon: "clipboard-outline",
    title: "Same steps, every roof",
    body:
      "Confirm the Job Start Code, complete safety checks, capture before/after photos, and close the visit with a structured report — so every handoff looks the same to ops.",
  },
  {
    id: "4",
    icon: "shield-checkmark-outline",
    title: "",
    titleHasBrand: true,
    titleBrandPrefix: "Why partners use ",
    trustRows: [
      {
        title: "Employer-linked sign-in",
        subtitle: "Use the mobile number your vendor or OorjaMan ops registered — consumer accounts stay in the customer app.",
      },
      {
        title: "Guided field workflow",
        subtitle: "Start code, checklist, timed visit, and photo evidence in one flow built for rooftop work.",
      },
      {
        title: "Dispatch visibility",
        subtitle: "Job history and visit status stay visible to operations — raise help from the job when something is unclear.",
      },
    ],
  },
];

const { width: SCREEN_W } = Dimensions.get("window");

const ICON_LARGE = 48;
const ICON_TRUST = 22;

/** Primary with ~13% opacity (same idea as Solar's `primary + '22'`). */
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
        {item.welcomeHero ? (
          <View style={styles.welcomeHero}>
            <View style={styles.rolePill}>
              <Ionicons name="construct-outline" size={14} color={colors.primary} />
              <Text style={styles.rolePillText}>Partner app</Text>
            </View>
            <BrandLockup iconSize={92} />
          </View>
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: iconWrapBg }]}>
            <Ionicons name={item.icon} size={ICON_LARGE} color={colors.primary} />
          </View>
        )}
        {item.titleHasBrand ? (
          <BrandNameInline prefix={item.titleBrandPrefix ?? ""} style={styles.title} />
        ) : (
          <Text style={styles.title}>{item.title}</Text>
        )}
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
    ? "Continue to setup"
    : index === SLIDES.length - 2
      ? "Almost done"
      : "Next";

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
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
          accessibilityLabel={isLast ? "Continue to setup" : "Go to next slide"}
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
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  welcomeHero: {
    alignItems: "center",
    marginBottom: 28,
    gap: 14,
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${colors.primary}14`,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: `${colors.primary}33`,
  },
  rolePillText: {
    fontFamily: fontFamily.semiBold,
    fontSize: fontSize.xs,
    color: colors.primary,
    letterSpacing: 1.1,
    textTransform: "uppercase",
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
