import { forwardRef, useImperativeHandle, useRef } from "react";
import { ScrollView, StyleSheet, type TextInput } from "react-native";
import { colors, spacing } from "@oorjaman/config";
import {
  type KeyboardFormScreenProps,
  type KeyboardFormScreenRef,
} from "./KeyboardFormScreen.shared";
import { webContentColumnStyle } from "./web-layout";

export {
  KEYBOARD_AVOIDING_BEHAVIOR,
  type KeyboardFormScreenProps,
  type KeyboardFormScreenRef,
} from "./KeyboardFormScreen.shared";

/**
 * Web: plain ScrollView. `react-native-keyboard-controller` KeyboardAwareScrollView
 * requires a native KeyboardProvider context and throws on RN Web without it.
 */
export const KeyboardFormScreen = forwardRef<
  KeyboardFormScreenRef,
  KeyboardFormScreenProps
>(function KeyboardFormScreen(
  {
    children,
    contentContainerStyle,
    webVariant = "form",
    webMaxWidth,
    centerVertically = false,
  },
  ref,
) {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = (animated = true) => {
    scrollRef.current?.scrollToEnd({ animated });
  };

  const scrollToInput = (
    input: TextInput | null,
    additionalOffset: number = spacing.md,
  ) => {
    if (!input || !scrollRef.current) return;
    input.measureInWindow((_x, y, _w, height) => {
      const targetY = Math.max(0, y - additionalOffset);
      scrollRef.current?.scrollTo({ y: targetY, animated: true });
      void height;
    });
  };

  useImperativeHandle(ref, () => ({ scrollToEnd, scrollToInput }), []);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[
        styles.scrollContent,
        centerVertically && styles.centerVertically,
        webContentColumnStyle(webVariant, { maxWidth: webMaxWidth }),
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {children}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerVertically: {
    justifyContent: "center",
  },
});
