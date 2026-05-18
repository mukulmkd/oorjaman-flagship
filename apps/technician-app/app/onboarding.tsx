import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@oorjaman/config";
import { fontFamily, fontSize } from "../constants/fonts";
import { STORAGE_KEY_ONBOARDING } from "../constants/storage";

type Slide = {
  key: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    key: "1",
    title: "Your day, organised",
    body: "See assigned visits, routes, and priorities without digging through messages.",
  },
  {
    key: "2",
    title: "Check in with confidence",
    body: "Photo proof, notes, and customer updates captured in a consistent flow.",
  },
  {
    key: "3",
    title: "Get paid for completed work",
    body: "Job status and history stay transparent for you and the operations team.",
  },
];

const { width: SCREEN_W } = Dimensions.get("window");

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const finish = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING, "true");
    router.replace("/permissions");
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const i = Math.round(x / SCREEN_W);
    setIndex(i);
  }, []);

  const goNext = useCallback(() => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void finish();
    }
  }, [index, finish]);

  const renderItem: ListRenderItem<Slide> = useCallback(
    ({ item }) => (
      <View style={[styles.slide, { width: SCREEN_W }]}>
        <View style={styles.slideCopy}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideBody}>{item.body}</Text>
        </View>
      </View>
    ),
    [],
  );

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Oorjaman</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          onPress={() => void finish()}
          hitSlop={12}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        style={styles.list}
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        renderItem={renderItem}
        onMomentumScrollEnd={onScroll}
        getItemLayout={(_, i) => ({
          length: SCREEN_W,
          offset: SCREEN_W * i,
          index: i,
        })}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, i === index ? styles.dotActive : styles.dotIdle]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Get started" : "Next slide"}
          onPress={goNext}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaLabel}>{isLast ? "Get started" : "Continue"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
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
  slide: {
    flex: 1,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    paddingBottom: spacing.lg,
  },
  slideCopy: {
    gap: spacing.sm,
  },
  slideTitle: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.xxl,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: colors.foreground,
  },
  slideBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.lg,
    lineHeight: 26,
    color: colors.mutedForeground,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotIdle: {
    width: 8,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.primary,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
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
