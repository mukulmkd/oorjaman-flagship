import { forwardRef, useImperativeHandle, useRef } from "react";
import { StyleSheet, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { colors, spacing } from "@oorjaman/config";
import {
  type KeyboardFormScreenProps,
  type KeyboardFormScreenRef,
} from "./KeyboardFormScreen.shared";

export {
  KEYBOARD_AVOIDING_BEHAVIOR,
  type KeyboardFormScreenProps,
  type KeyboardFormScreenRef,
} from "./KeyboardFormScreen.shared";

export const KeyboardFormScreen = forwardRef<
  KeyboardFormScreenRef,
  KeyboardFormScreenProps
>(function KeyboardFormScreen(
  {
    children,
    contentContainerStyle,
    bottomOffset = spacing.xxxl + spacing.md,
  },
  ref,
) {
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  const scrollY = useRef(0);

  const scrollToEnd = (animated = true) => {
    scrollRef.current?.scrollToEnd({ animated });
  };

  const scrollToInput = (
    _input: Parameters<KeyboardFormScreenRef["scrollToInput"]>[0],
    _additionalOffset: number = spacing.md,
  ) => {
    scrollRef.current?.assureFocusedInputVisible();
  };

  const scrollBy = (delta: number, animated = true) => {
    const y = Math.max(0, scrollY.current + delta);
    scrollY.current = y;
    scrollRef.current?.scrollTo({ y, animated });
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = event.nativeEvent.contentOffset.y;
  };

  useImperativeHandle(ref, () => ({ scrollToEnd, scrollToInput, scrollBy }), []);

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      // OTP cells + Android SMS autofill bar sit below the caret; keep a generous gap.
      bottomOffset={bottomOffset}
      extraKeyboardSpace={spacing.lg}
      mode="insets"
      onScroll={onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {children}
    </KeyboardAwareScrollView>
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
});
